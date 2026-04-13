/**
 * ProductOS — AI Service
 * Handles all Anthropic API interactions:
 * - Document generation with SSE streaming
 * - CPO review with SSE streaming
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
import type { DocumentType, Tone } from '../../../shared/types';

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

const MODEL = 'claude-sonnet-4-20250514';
const MAX_TOKENS = 8192;

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

/**
 * Build the generation system prompt with dynamic values injected.
 */
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

/**
 * Stream AI document generation via Server-Sent Events.
 * Writes SSE events directly to the Express response object.
 */
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

  // SSE headers
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no'); // Nginx: disable buffering

  const sendEvent = (type: string, data: Record<string, unknown>): void => {
    res.write(`data: ${JSON.stringify({ type, ...data })}\n\n`);
  };

  sendEvent('start', { documentType });

  let fullContent = '';

  try {
    const stream = await client.messages.stream({
      model: MODEL,
      max_tokens: MAX_TOKENS,
      system: systemPrompt,
      messages: [{ role: 'user', content: docTypePrompt }],
    });

    for await (const event of stream) {
      if (
        event.type === 'content_block_delta' &&
        event.delta.type === 'text_delta'
      ) {
        const delta = event.delta.text;
        fullContent += delta;
        sendEvent('delta', { content: delta });
      }

      if (event.type === 'message_stop') {
        // Post-process: validate and fix any malformed AC
        const processedContent = postProcessContent(fullContent);
        sendEvent('done', {
          content: processedContent,
          tokensUsed: stream.finalMessage?.usage?.output_tokens ?? 0,
        });
      }
    }
  } catch (error) {
    logger.error('AI generation error', { error, documentType });
    sendEvent('error', {
      error: error instanceof Error ? error.message : 'AI generation failed',
    });
  } finally {
    res.end();
  }
}

/**
 * Stream CPO review via Server-Sent Events.
 */
export async function streamCPOReview(
  params: ReviewParams,
  res: Response
): Promise<void> {
  const { documentContent, clientContext } = params;

  const systemPrompt = REVIEW_SYSTEM_PROMPT.replace('{clientContext}', clientContext);

  const userPrompt = `Please review the following product document:\n\n${documentContent}`;

  // SSE headers
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');

  const sendEvent = (type: string, data: Record<string, unknown>): void => {
    res.write(`data: ${JSON.stringify({ type, ...data })}\n\n`);
  };

  sendEvent('start', { reviewType: 'CPO_REVIEW' });

  // Section detection: buffer and emit section events as headings appear
  let fullContent = '';
  let currentSection = '';

  const SECTION_HEADINGS = [
    '## 1. Strategic Gap Analysis',
    '## 2. Assumption Audit',
    '## 3. User Empathy Score',
    '## 4. Analytics Readiness Check',
    '## 5. Competitive',
    '## 6. Tough Questions',
    '## 7. Overall Readiness Score',
  ];

  try {
    const stream = await client.messages.stream({
      model: MODEL,
      max_tokens: MAX_TOKENS,
      system: systemPrompt,
      messages: [{ role: 'user', content: userPrompt }],
    });

    for await (const event of stream) {
      if (
        event.type === 'content_block_delta' &&
        event.delta.type === 'text_delta'
      ) {
        const delta = event.delta.text;
        fullContent += delta;
        currentSection += delta;

        sendEvent('delta', { content: delta });

        // Detect and emit section boundaries
        for (const heading of SECTION_HEADINGS) {
          if (currentSection.includes(heading)) {
            sendEvent('section', { section: heading.replace(/^##\s+\d+\.\s+/, '') });
            currentSection = '';
            break;
          }
        }
      }

      if (event.type === 'message_stop') {
        sendEvent('done', {
          content: fullContent,
          tokensUsed: stream.finalMessage?.usage?.output_tokens ?? 0,
        });
      }
    }
  } catch (error) {
    logger.error('CPO review error', { error });
    sendEvent('error', {
      error: error instanceof Error ? error.message : 'CPO review failed',
    });
  } finally {
    res.end();
  }
}

/**
 * Non-streaming version for background jobs and export processing.
 */
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

/**
 * Post-process AI output: validate AC format, reformat if needed.
 */
function postProcessContent(content: string): string {
  // Find all Acceptance Criteria sections and validate/fix them
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

/**
 * Count tokens in a string (approximate — 1 token ≈ 4 chars for English).
 * Used for the AI usage dashboard.
 */
export function estimateTokenCount(text: string): number {
  return Math.ceil(text.length / 4);
}
