/**
 * ProductOS — AI Service
 * Handles all Anthropic API interactions:
 * - Document generation with SSE streaming
 * - CPO review with SSE streaming
 * - Multi-turn chat with SSE streaming (chat/generate/edit modes)
 * - Document analysis for the "Import Document" flow
 * - Post-processing: AC validation and reformatting
 */

import Anthropic from '@anthropic-ai/sdk';
import { Response } from 'express';
import {
  GENERATION_SYSTEM_PROMPT,
  REVIEW_SYSTEM_PROMPT,
  getDocumentTypePrompt,
} from './prompts';
import { containsValidAC, reformatAcceptanceCriteria } from './acParser';
import { logger } from '../middleware/logger';
import type { ChatMessage, ChatMode, DocumentType, Tone } from '../../../shared/types';

const _apiKey = process.env.ANTHROPIC_API_KEY || undefined;
const _authToken = process.env.ANTHROPIC_AUTH_TOKEN || undefined;
const _baseURL = (process.env.ANTHROPIC_BASE_URL || 'https://api.anthropic.com').replace(/\/$/, '');

/**
 * Anthropic client for non-streaming calls only. Streaming bypasses the SDK
 * and uses rawStreamAnthropicMessages() below so we can support proxies (like
 * Fuelix) whose SSE format or auth style the SDK doesn't fully handle.
 */
const client = _authToken && !_apiKey
  ? new Anthropic({
      apiKey: 'unused-proxy-placeholder',
      baseURL: _baseURL,
      defaultHeaders: {
        Authorization: `Bearer ${_authToken}`,
        'X-Api-Key': null,
      },
    })
  : new Anthropic({
      apiKey: _apiKey,
      authToken: _authToken,
      baseURL: _baseURL,
    });

const MODEL = process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-20250514';
const MAX_TOKENS = 8192;

/**
 * Stream Anthropic messages via raw fetch + manual SSE parsing. Supports both
 * direct Anthropic and proxy gateways (Fuelix). Invokes onDelta per text token,
 * returns the full accumulated text on resolve.
 */
async function rawStreamAnthropicMessages(
  body: {
    model: string;
    max_tokens: number;
    system: string;
    messages: Array<{ role: 'user' | 'assistant'; content: string }>;
  },
  onDelta: (delta: string) => void,
): Promise<{ text: string; outputTokens: number }> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Accept: 'text/event-stream',
    'anthropic-version': '2023-06-01',
  };
  if (_authToken && !_apiKey) {
    headers.Authorization = `Bearer ${_authToken}`;
  } else if (_apiKey) {
    headers['x-api-key'] = _apiKey;
  } else if (_authToken) {
    headers.Authorization = `Bearer ${_authToken}`;
  }

  const res = await fetch(`${_baseURL}/v1/messages`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ ...body, stream: true }),
  });

  if (!res.ok || !res.body) {
    const text = await res.text().catch(() => '');
    throw new Error(`Anthropic stream request failed: ${res.status} ${res.statusText} — ${text.slice(0, 300)}`);
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let fullText = '';
  let outputTokens = 0;
  let sawError: string | null = null;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() ?? '';

    for (const line of lines) {
      if (!line.startsWith('data: ')) continue;
      const payload = line.slice(6).trim();
      if (!payload || payload === '[DONE]') continue;
      try {
        const event = JSON.parse(payload) as {
          type?: string;
          delta?: { type?: string; text?: string };
          message?: { usage?: { output_tokens?: number } };
          usage?: { output_tokens?: number };
          error?: { message?: string };
        };
        if (event.error?.message) {
          sawError = event.error.message;
        } else if (event.type === 'content_block_delta' && event.delta?.type === 'text_delta' && event.delta.text) {
          fullText += event.delta.text;
          onDelta(event.delta.text);
        } else if (event.type === 'message_delta' && event.usage?.output_tokens) {
          outputTokens = event.usage.output_tokens;
        } else if (event.type === 'message_start' && event.message?.usage?.output_tokens) {
          outputTokens = event.message.usage.output_tokens;
        }
      } catch {
        // ignore malformed SSE lines
      }
    }
  }

  if (sawError && !fullText) {
    throw new Error(`Anthropic upstream error: ${sawError}`);
  }

  return { text: fullText, outputTokens };
}

interface GenerationParams {
  input: string;
  documentType: DocumentType;
  clientContext: string;
  language?: string;
  tone?: Tone;
}

interface ReviewParams {
  documentContent: string;
  clientContext: string;
}

interface ChatStreamParams {
  messages: ChatMessage[];
  mode: ChatMode;
  clientContext?: string;
  documentType?: DocumentType;
  currentContent?: string;
  language?: string;
  tone?: Tone;
}

interface AnalyzeParams {
  fileText: string;
  fileName: string;
  documentType: DocumentType;
  clientContext?: string;
}

function buildGenerationSystemPrompt(params: {
  clientContext: string;
  language: string;
  tone: string;
  globalPrefix?: string;
}): string {
  const base = GENERATION_SYSTEM_PROMPT.replace('{clientContext}', params.clientContext)
    .replace('{language}', params.language)
    .replace('{tone}', params.tone);

  if (params.globalPrefix?.trim()) {
    return `${params.globalPrefix.trim()}\n\n${base}`;
  }

  return base;
}

function setSSEHeaders(res: Response): void {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
}

function makeSendEvent(res: Response) {
  return (type: string, data: Record<string, unknown>): void => {
    res.write(`data: ${JSON.stringify({ type, ...data })}\n\n`);
  };
}

export async function streamDocumentGeneration(
  params: GenerationParams,
  res: Response,
  globalPrefix?: string
): Promise<void> {
  const { input, documentType, clientContext, language = 'en', tone = 'Formal' } = params;

  const systemPrompt = buildGenerationSystemPrompt({
    clientContext,
    language,
    tone,
    globalPrefix,
  });

  const docTypePrompt = getDocumentTypePrompt(documentType).replace('{input}', input);

  setSSEHeaders(res);
  const sendEvent = makeSendEvent(res);

  sendEvent('start', { documentType });

  try {
    const { text: fullContent, outputTokens } = await rawStreamAnthropicMessages(
      {
        model: MODEL,
        max_tokens: MAX_TOKENS,
        system: systemPrompt,
        messages: [{ role: 'user', content: docTypePrompt }],
      },
      (delta) => sendEvent('delta', { content: delta }),
    );

    const processedContent = postProcessContent(fullContent);
    sendEvent('done', {
      content: processedContent,
      tokensUsed: outputTokens,
    });
  } catch (error) {
    logger.error('AI generation error', {
      message: error instanceof Error ? error.message : String(error),
      documentType,
    });
    sendEvent('error', {
      error: error instanceof Error ? error.message : 'AI generation failed',
    });
  } finally {
    res.end();
  }
}

export async function streamCPOReview(
  params: ReviewParams,
  res: Response
): Promise<void> {
  const { documentContent, clientContext } = params;

  const systemPrompt = REVIEW_SYSTEM_PROMPT.replace('{clientContext}', clientContext);
  const userPrompt = `Please review the following product document:\n\n${documentContent}`;

  setSSEHeaders(res);
  const sendEvent = makeSendEvent(res);

  sendEvent('start', { reviewType: 'CPO_REVIEW' });

  const SECTION_HEADINGS = [
    '## 1. Strategic Gap Analysis',
    '## 2. Assumption Audit',
    '## 3. User Empathy Score',
    '## 4. Analytics Readiness Check',
    '## 5. Competitive',
    '## 6. Tough Questions',
    '## 7. Overall Readiness Score',
  ];

  let currentSection = '';

  try {
    const { text: fullContent, outputTokens } = await rawStreamAnthropicMessages(
      {
        model: MODEL,
        max_tokens: MAX_TOKENS,
        system: systemPrompt,
        messages: [{ role: 'user', content: userPrompt }],
      },
      (delta) => {
        currentSection += delta;
        sendEvent('delta', { content: delta });
        for (const heading of SECTION_HEADINGS) {
          if (currentSection.includes(heading)) {
            sendEvent('section', { section: heading.replace(/^##\s+\d+\.\s+/, '') });
            currentSection = '';
            break;
          }
        }
      },
    );

    sendEvent('done', { content: fullContent, tokensUsed: outputTokens });
  } catch (error) {
    logger.error('CPO review error', {
      message: error instanceof Error ? error.message : String(error),
    });
    sendEvent('error', {
      error: error instanceof Error ? error.message : 'CPO review failed',
    });
  } finally {
    res.end();
  }
}

// ─── Chat streaming (multi-turn) ──────────────────────────────────────────────

function buildChatSystemPrompt(params: ChatStreamParams): string {
  const { mode, clientContext = 'No project context provided.', documentType, language = 'en', tone = 'Formal' } = params;

  const clientBlock = `You are working on a project with this client context:\n${clientContext}\n\nOutput language: ${language}. Tone: ${tone}.`;

  if (mode === 'chat') {
    const typeBlock = documentType
      ? ` The user is creating a ${documentType.replace('_', ' ')} document.`
      : '';
    return `You are ProductOS, an expert AI product manager embedded within Telus Digital.${typeBlock}

You are gathering context to help the user create a product document. The document itself will be generated separately when the user clicks a dedicated button. In this chat mode your responses MUST stay conversational — you are a short-turn Q&A agent, not a document generator.

HARD RULES:

1. **Never produce the document itself in chat.** Do not draft sections, paragraphs, bullet lists of requirements, full user stories, acceptance criteria, or anything resembling deliverable document content. If the user asks you to "just write the PRD" or "give me the full doc", politely redirect them to click the "Generate Document" button — the document will stream into the editor panel on the right, not into this chat.

2. **Max 120 words per response.** Keep preambles to 1-2 sentences. Stay focused.

3. **Ask exactly ONE question per turn** — the single highest-leverage question for this stage of the conversation.

4. **Always end with 3-5 quick-answer options** in this exact format so the client can render them as chips:

OPTIONS:
- First concise answer
- Second concise answer
- Third concise answer

Each option must be one short phrase (2-8 words, no trailing punctuation). The user may type a custom answer instead.

5. Question progression (adapt based on answers):
   - Target user / persona
   - Primary problem being solved
   - Key success metric (measurable)
   - Main constraints (tech/business/regulatory)
   - Acceptance criteria / happy path
   - Risks or dependencies

6. When you have enough context (usually after 3-5 well-answered questions), stop asking — tell the user in one short sentence that they have enough context to generate, and **omit the OPTIONS block** so the UI surfaces the "Generate Document" button.

${clientBlock}`;
  }

  if (mode === 'generate') {
    const typePrompt = documentType ? getDocumentTypePrompt(documentType) : '';
    return `${GENERATION_SYSTEM_PROMPT.replace('{clientContext}', clientContext).replace('{language}', language).replace('{tone}', tone)}

You have been having a conversation with a user about a product. Use the full conversation history as your input and generate the complete document now. Respond with ONLY the final document in markdown — no preamble, no commentary, no chat-style text. The document format should follow this template:

${typePrompt.replace('{input}', '[the product requirements captured in our conversation above]')}`;
  }

  // edit mode
  return `You are ProductOS, an expert AI product manager. The user is editing an existing product document. Apply their requested change to the full document and return the COMPLETE updated document in markdown — no preamble, no explanation, just the full updated document content.

Product best practices to enforce:
- Acceptance criteria in GIVEN/WHEN/THEN format (Gherkin)
- Measurable success metrics with analytics instrumentation
- Clear user value in every story
- Technical feasibility and business alignment

${clientBlock}

Current document:
---
${params.currentContent ?? ''}
---`;
}

export async function streamChat(
  params: ChatStreamParams,
  res: Response
): Promise<void> {
  const systemPrompt = buildChatSystemPrompt(params);

  // Anthropic requires: (1) first message is user, (2) strict role alternation,
  // (3) all messages have non-empty content, (4) conversation ends with user.
  // Client histories can easily violate these after the generate flow (two
  // consecutive assistant messages), so normalize before sending.
  const raw = params.messages
    .filter((m) => m.role !== 'system' && m.content && m.content.trim().length > 0)
    .map((m) => ({
      role: m.role as 'user' | 'assistant',
      content: m.content,
    }));

  const anthropicMessages: typeof raw = [];
  for (const m of raw) {
    // Drop leading non-user messages so the conversation starts with user
    if (anthropicMessages.length === 0 && m.role !== 'user') continue;
    const last = anthropicMessages[anthropicMessages.length - 1];
    if (last && last.role === m.role) {
      // Merge consecutive same-role messages
      last.content = `${last.content}\n\n${m.content}`;
    } else {
      anthropicMessages.push({ ...m });
    }
  }

  // Ensure conversation ends with a user message (Anthropic requirement)
  if (
    anthropicMessages.length > 0 &&
    anthropicMessages[anthropicMessages.length - 1].role === 'assistant'
  ) {
    anthropicMessages.push({ role: 'user', content: 'Please continue.' });
  }

  if (anthropicMessages.length === 0) {
    anthropicMessages.push({ role: 'user', content: 'Hello' });
  }

  setSSEHeaders(res);
  const sendEvent = makeSendEvent(res);

  sendEvent('start', { mode: params.mode });

  try {
    const { text: fullContent, outputTokens } = await rawStreamAnthropicMessages(
      {
        model: MODEL,
        max_tokens: MAX_TOKENS,
        system: systemPrompt,
        messages: anthropicMessages,
      },
      (delta) => sendEvent('delta', { content: delta }),
    );

    const finalContent =
      params.mode === 'chat' ? fullContent : postProcessContent(fullContent);
    sendEvent('done', {
      content: finalContent,
      tokensUsed: outputTokens,
      mode: params.mode,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const stack = error instanceof Error ? error.stack : undefined;
    logger.error('AI chat error', {
      message,
      stack,
      mode: params.mode,
      status: (error as { status?: number })?.status,
      name: (error as { name?: string })?.name,
    });
    sendEvent('error', { error: message });
  } finally {
    res.end();
  }
}

// ─── Document analysis (Import Document) ──────────────────────────────────────

export async function analyzeDocument(params: AnalyzeParams): Promise<string> {
  const { fileText, fileName, documentType, clientContext = 'No project context provided.' } = params;

  const systemPrompt = `You are a seasoned Chief Product Officer reviewing an existing product document. Analyze it from a product management perspective and provide actionable, specific feedback.

Client context:
${clientContext}

Document type: ${documentType.replace('_', ' ')}
File name: ${fileName}

Output FORMAT RULES — strict:
- Use real markdown headings (## Strengths, ## Areas for Improvement, ## Recommendations).
- Use proper markdown bullet lists (one item per line, each starting with "- "). Never use emoji checkmarks or ASCII arrows as bullet markers.
- Leave one blank line between sections.
- Use **bold** sparingly to call out specific metrics or concepts, never for entire bullets.
- Keep bullets crisp (1-2 lines each).
- Do NOT use code blocks, HTML tags, or tables.

Structure (max ~450 words total):

## Strengths
- 2 to 4 bullets on what's done well

## Areas for Improvement
- 3 to 6 bullets of specific gaps or weaknesses

## Recommendations
- 3 to 6 bullets of concrete, specific next steps (mention format, structure, metrics)

End with a single short paragraph (no heading) inviting the user to click "Import & Improve" to apply the recommendations automatically.`;

  try {
    const message = await client.messages.create({
      model: MODEL,
      max_tokens: 2000,
      system: systemPrompt,
      messages: [
        {
          role: 'user',
          content: `Analyze the following document:\n\n---\n${fileText.slice(0, 30000)}\n---`,
        },
      ],
    });

    return message.content[0].type === 'text' ? message.content[0].text : '';
  } catch (error) {
    logger.error('Document analysis error', { error });
    throw new Error(error instanceof Error ? error.message : 'Document analysis failed');
  }
}

// ─── Shared helpers ───────────────────────────────────────────────────────────

export async function generateDocumentContent(
  params: GenerationParams,
  globalPrefix?: string
): Promise<string> {
  const { input, documentType, clientContext, language = 'en', tone = 'Formal' } = params;

  const systemPrompt = buildGenerationSystemPrompt({
    clientContext,
    language,
    tone,
    globalPrefix,
  });

  const docTypePrompt = getDocumentTypePrompt(documentType).replace('{input}', input);

  const message = await client.messages.create({
    model: MODEL,
    max_tokens: MAX_TOKENS,
    system: systemPrompt,
    messages: [{ role: 'user', content: docTypePrompt }],
  });

  const rawContent =
    message.content[0].type === 'text' ? message.content[0].text : '';

  return postProcessContent(rawContent);
}

function postProcessContent(content: string): string {
  return content.replace(
    /(Acceptance Criteria:\s*\n)([\s\S]*?)(?=\n(?:#+\s|\*\*(?:Title|Priority|Story Points)|---|\Z))/gi,
    (match, header, acBlock) => {
      if (!acBlock.trim()) return match;

      if (!containsValidAC(acBlock)) {
        const reformatted = reformatAcceptanceCriteria(acBlock);
        logger.warn('AC block reformatted — original did not contain valid GIVEN/WHEN/THEN');
        return `${header}${reformatted}\n`;
      }

      return match;
    }
  );
}

export function estimateTokenCount(text: string): number {
  return Math.ceil(text.length / 4);
}
