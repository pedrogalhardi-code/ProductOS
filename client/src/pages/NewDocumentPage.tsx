import { useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { marked } from 'marked';
import TurndownService from 'turndown';
import RichEditor from '../components/editor/RichEditor';
import {
  FileText,
  Users,
  Code,
  Briefcase,
  Map,
  Target,
  Send,
  Paperclip,
  X,
  Image as ImageIcon,
  Sparkles,
  ArrowLeft,
  Check,
  Download,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { useDocumentStore } from '../stores/documentStore';
import { documents, streamChat, extractAttachmentText } from '../services/api';
import {
  loadChatHistory,
  saveChatHistory,
  type StoredMessage,
} from '../services/chatHistoryStorage';
import type { ChatMessage, DocumentType } from '@shared/types';

marked.setOptions({ gfm: true, breaks: false });
const turndown = new TurndownService({ headingStyle: 'atx', codeBlockStyle: 'fenced' });

const documentTypes: Array<{
  id: DocumentType;
  label: string;
  icon: typeof FileText;
  description: string;
}> = [
  { id: 'PRD', label: 'PRD', icon: FileText, description: 'Product Requirements Document' },
  { id: 'USER_STORIES', label: 'User Stories', icon: Users, description: 'User stories and scenarios' },
  { id: 'TECHNICAL_SPEC', label: 'Technical Spec', icon: Code, description: 'Technical specifications' },
  { id: 'PRODUCT_BRIEF', label: 'Product Brief', icon: Briefcase, description: 'High-level product overview' },
  { id: 'ROADMAP', label: 'Roadmap', icon: Map, description: 'Product roadmap and timeline' },
  { id: 'OKRS', label: 'OKRs', icon: Target, description: 'Objectives and Key Results' },
];

interface Message {
  id: string;
  role: 'user' | 'assistant';
  /** Text shown in the chat bubble (for user msgs: just what they typed) */
  content: string;
  /** Full text sent to the AI (for user msgs: typed + extracted file text). Falls back to `content`. */
  serverContent?: string;
  attachments?: { name: string; type: string; url?: string }[];
  timestamp: Date;
  showGenerateButton?: boolean;
  options?: string[];
}

/**
 * Extract an OPTIONS: block from an assistant message. The AI is instructed
 * to emit it at the end of its turn so the client can render quick-reply chips.
 * Returns the message text with the block stripped out plus the parsed options.
 */
function parseOptions(text: string): { text: string; options: string[] } {
  const match = text.match(/(^|\n)OPTIONS:\s*\n([\s\S]*?)$/i);
  if (!match) return { text, options: [] };
  const block = match[2];
  const options = block
    .split('\n')
    .map((line) => line.replace(/^\s*[-*•]\s*/, '').trim())
    .filter((line) => line.length > 0 && line.length < 120);
  const cleanText = text.slice(0, match.index! + match[1].length).trimEnd();
  return { text: cleanText, options };
}

const typeWelcomes: Record<DocumentType, string> = {
  PRD: "Excellent! I'll help you create a comprehensive PRD. As a product management expert, I'll guide you to define:\n\n• Clear problem statement and user pain points\n• Value proposition and business objectives\n• User stories and acceptance criteria (GIVEN/WHEN/THEN)\n• Success metrics and KPIs\n• Technical requirements and constraints\n\nTell me about the product problem you're solving and who your users are.",
  USER_STORIES: "Perfect! I'll help you write user stories that drive product value. Let's focus on:\n\n• Who are the users and what are their goals?\n• What value does each story deliver?\n• Clear acceptance criteria using Gherkin syntax\n• Priority and effort estimates\n\nDescribe the user personas and their key workflows.",
  TECHNICAL_SPEC: "Great choice! I'll help you create a technical specification that balances product requirements with technical feasibility:\n\n• Architecture decisions and trade-offs\n• API contracts and data models\n• Performance and scalability requirements\n• Security and compliance considerations\n\nWhat product requirements are driving this technical work?",
  PRODUCT_BRIEF: "Excellent! I'll help you create a compelling product brief that aligns stakeholders:\n\n• Product vision and market opportunity\n• Target users and their problems\n• Key features and differentiation\n• Success metrics and timeline\n\nWhat's the product opportunity you're exploring?",
  ROADMAP: "Perfect! I'll help you build a strategic roadmap that drives product outcomes:\n\n• Quarterly themes and objectives\n• Feature prioritization based on impact\n• Dependencies and milestones\n• Success metrics per initiative\n\nWhat are your product goals for the next quarters?",
  OKRS: "Great! I'll help you define OKRs that drive measurable product outcomes:\n\n• Objectives aligned with product strategy\n• Key Results that are measurable and ambitious\n• Initiatives that deliver on the KRs\n• Timeline and ownership\n\nWhat product outcomes are you trying to achieve?",
};

export default function NewDocumentPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const projectId = searchParams.get('projectId');
  const restoreDocId = searchParams.get('docId');

  const addDocument = useDocumentStore((s) => s.addDocument);
  const updateDocument = useDocumentStore((s) => s.updateDocument);

  const [selectedType, setSelectedType] = useState<DocumentType | null>(null);
  const [showTypeSelector, setShowTypeSelector] = useState(true);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputMessage, setInputMessage] = useState('');
  const [attachedFiles, setAttachedFiles] = useState<File[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [documentGenerated, setDocumentGenerated] = useState(false);
  const [documentContent, setDocumentContent] = useState('');
  const [documentTitle, setDocumentTitle] = useState('');
  const [savedDocId, setSavedDocId] = useState<string | null>(null);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  // Bump to force the editor to re-mount with new AI-generated content. Manual
  // edits from the user go through onChange and don't bump this.
  const [editorKey, setEditorKey] = useState(0);
  const saveDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cleanupRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isGenerating]);

  useEffect(() => () => cleanupRef.current?.(), []);

  // Restore chat + document state when the page is reopened via a saved-doc URL.
  useEffect(() => {
    if (!restoreDocId) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await documents.get(restoreDocId);
        if (cancelled) return;
        const doc = res.data.data;
        setSelectedType(doc.type as DocumentType);
        setShowTypeSelector(false);
        setDocumentTitle(doc.title);
        const md = doc.content.includes('<')
          ? turndown.turndown(doc.content)
          : doc.content;
        setDocumentContent(md);
        setDocumentGenerated(true);
        setSavedDocId(doc.id);
        setSaveStatus('saved');
        setEditorKey((k) => k + 1);

        const stored = loadChatHistory(doc.id);
        if (stored && stored.length > 0) {
          setMessages(
            stored.map((m) => ({
              id: m.id,
              role: m.role,
              content: m.content,
              serverContent: m.serverContent,
              attachments: m.attachments,
              timestamp: new Date(m.timestamp),
              showGenerateButton: m.showGenerateButton,
              options: m.options,
            }))
          );
        }
      } catch {
        toast.error('Failed to restore document');
      }
    })();
    return () => {
      cancelled = true;
    };
    // Only restore on first mount / docId change from URL
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [restoreDocId]);

  // Persist the chat to localStorage whenever it changes, keyed by savedDocId.
  useEffect(() => {
    if (!savedDocId || messages.length === 0) return;
    const storable: StoredMessage[] = messages.map((m) => ({
      id: m.id,
      role: m.role,
      content: m.content,
      serverContent: m.serverContent,
      attachments: m.attachments?.map((a) => ({ name: a.name, type: a.type })),
      timestamp: m.timestamp.toISOString(),
      showGenerateButton: m.showGenerateButton,
      options: m.options,
    }));
    saveChatHistory(savedDocId, storable);
  }, [messages, savedDocId]);

  const autoSaveDocument = async (markdownContent: string, title: string) => {
    if (!selectedType || !projectId || !markdownContent.trim()) return;
    setSaveStatus('saving');
    try {
      const html = await Promise.resolve(marked.parse(markdownContent));
      if (savedDocId) {
        const res = await documents.update(savedDocId, {
          title,
          content: html as string,
        });
        updateDocument(res.data.data);
      } else {
        const res = await documents.create({
          title,
          type: selectedType,
          projectId,
          content: html as string,
        });
        addDocument(res.data.data);
        setSavedDocId(res.data.data.id);
        // Reflect the saved doc in the URL so the page can restore state
        // (chat history + editor content) if the user navigates away and back.
        const next = new URLSearchParams(searchParams);
        next.set('docId', res.data.data.id);
        setSearchParams(next, { replace: true });
      }
      setSaveStatus('saved');
    } catch (err) {
      setSaveStatus('error');
      toast.error('Auto-save failed');
    }
  };

  /** Called by RichEditor when the user types manually. Convert the HTML back
   * to markdown (source of truth), then schedule a debounced auto-save. */
  const handleEditorChange = (html: string) => {
    const markdown = turndown.turndown(html);
    setDocumentContent(markdown);
    if (saveDebounceRef.current) clearTimeout(saveDebounceRef.current);
    saveDebounceRef.current = setTimeout(() => {
      void autoSaveDocument(markdown, documentTitle);
    }, 1500);
  };

  const handleDownloadMarkdown = () => {
    if (!documentContent.trim()) return;
    const blob = new Blob([documentContent], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${documentTitle.replace(/\s+/g, '-').toLowerCase() || 'document'}.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const chatHistory: ChatMessage[] = messages
    .filter((m) => (m.serverContent ?? m.content).trim().length > 0)
    .map((m) => ({
      role: m.role,
      content: m.serverContent ?? m.content,
    }));

  const handleTypeSelect = (typeId: DocumentType) => {
    setSelectedType(typeId);
    setShowTypeSelector(false);
    setMessages([
      {
        id: '1',
        role: 'assistant',
        content: typeWelcomes[typeId],
        timestamp: new Date(),
      },
    ]);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    setAttachedFiles((prev) => [...prev, ...files]);
  };

  const removeAttachment = (index: number) => {
    setAttachedFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const sendChatMessage = (mode: 'chat' | 'edit', nextHistory: ChatMessage[]) => {
    setIsGenerating(true);

    let buffered = '';
    const placeholderId = `assistant-${Date.now()}`;
    setMessages((prev) => [
      ...prev,
      { id: placeholderId, role: 'assistant', content: '', timestamp: new Date() },
    ]);

    cleanupRef.current = streamChat(
      {
        messages: nextHistory,
        mode,
        projectId: projectId ?? undefined,
        documentType: selectedType ?? undefined,
        currentContent: mode === 'edit' ? documentContent : undefined,
      },
      {
        onDelta: (delta) => {
          if (mode === 'edit') {
            buffered += delta;
            setDocumentContent(buffered);
          } else {
            buffered += delta;
            setMessages((prev) =>
              prev.map((m) =>
                m.id === placeholderId ? { ...m, content: buffered } : m
              )
            );
          }
        },
        onDone: async (fullContent) => {
          if (mode === 'edit') {
            setDocumentContent(fullContent);
            setEditorKey((k) => k + 1);
            await autoSaveDocument(fullContent, documentTitle);
            setMessages((prev) =>
              prev.map((m) =>
                m.id === placeholderId
                  ? {
                      ...m,
                      content:
                        '✓ Document updated. Changes are visible in the editor on the right.',
                    }
                  : m
              )
            );
          } else {
            const { text, options } = parseOptions(fullContent);
            const userMsgCount = nextHistory.filter((m) => m.role === 'user').length;
            setMessages((prev) =>
              prev.map((m) =>
                m.id === placeholderId
                  ? {
                      ...m,
                      content: text,
                      options: options.length > 0 ? options : undefined,
                      showGenerateButton: userMsgCount >= 3 && options.length === 0,
                    }
                  : m
              )
            );
          }
          setIsGenerating(false);
        },
        onError: (error) => {
          toast.error(`Chat failed: ${error}`);
          setMessages((prev) => prev.filter((m) => m.id !== placeholderId));
          setIsGenerating(false);
        },
      }
    );
  };

  const handleSendMessage = async () => {
    if ((!inputMessage.trim() && attachedFiles.length === 0) || isGenerating) return;

    const attachments = attachedFiles.map((file) => ({
      name: file.name,
      type: file.type,
      url: URL.createObjectURL(file),
    }));

    const userMsgId = `user-${Date.now()}`;
    const userMsg: Message = {
      id: userMsgId,
      role: 'user',
      content: inputMessage,
      attachments: attachments.length ? attachments : undefined,
      timestamp: new Date(),
    };
    setMessages((prev) => [...prev, userMsg]);

    const filesToExtract = [...attachedFiles];
    const typedMessage = inputMessage;
    setInputMessage('');
    setAttachedFiles([]);

    // Extract text from any attached files server-side so the AI actually sees
    // their contents (otherwise the model just gets "(attachments only)").
    let attachmentBlock = '';
    if (filesToExtract.length > 0) {
      setIsGenerating(true);
      try {
        const extracted = await Promise.all(
          filesToExtract.map(async (file) => {
            if (file.type.startsWith('image/')) {
              return `[Image attached: ${file.name}] — visual content not yet readable by the AI.`;
            }
            try {
              const res = await extractAttachmentText(file);
              return `--- Attached file: ${file.name} ---\n${res.data.data.text}\n--- end ${file.name} ---`;
            } catch {
              return `[Failed to extract text from ${file.name}]`;
            }
          })
        );
        attachmentBlock = extracted.join('\n\n');
      } finally {
        setIsGenerating(false);
      }
    }

    const combinedContent = [typedMessage, attachmentBlock].filter(Boolean).join('\n\n') || '(no content)';

    // Stash the full combined content (typed + extracted attachment text) on
    // the stored message so later turns rebuild chatHistory correctly — without
    // leaking raw file text into the displayed chat bubble.
    setMessages((prev) =>
      prev.map((m) => (m.id === userMsgId ? { ...m, serverContent: combinedContent } : m))
    );

    const nextHistory: ChatMessage[] = [
      ...chatHistory,
      { role: 'user', content: combinedContent },
    ];

    sendChatMessage(documentGenerated ? 'edit' : 'chat', nextHistory);
  };

  const handleOptionClick = (option: string) => {
    if (isGenerating) return;
    const userMsg: Message = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: option,
      timestamp: new Date(),
    };
    setMessages((prev) => [...prev, userMsg]);
    const nextHistory: ChatMessage[] = [...chatHistory, { role: 'user', content: option }];
    sendChatMessage(documentGenerated ? 'edit' : 'chat', nextHistory);
  };

  const handleGenerateDocument = () => {
    if (!selectedType || isGenerating) return;

    setIsGenerating(true);
    setDocumentGenerated(true);
    setDocumentContent('');
    setDocumentTitle(
      selectedType
        ? `New ${documentTypes.find((t) => t.id === selectedType)?.label}`
        : 'New Document'
    );

    setMessages((prev) => [
      ...prev,
      {
        id: `assistant-gen-${Date.now()}`,
        role: 'assistant',
        content:
          "Perfect! I'm generating your document based on our conversation. The content will stream into the editor on the right.",
        timestamp: new Date(),
      },
    ]);

    let buffered = '';
    cleanupRef.current = streamChat(
      {
        messages: chatHistory,
        mode: 'generate',
        projectId: projectId ?? undefined,
        documentType: selectedType,
      },
      {
        onDelta: (delta) => {
          buffered += delta;
          setDocumentContent(buffered);
        },
        onDone: async (fullContent) => {
          setDocumentContent(fullContent);

          // Derive title from first heading if present
          const match = fullContent.match(/^#\s+(.+)$/m);
          const newTitle = match
            ? match[1].trim()
            : `New ${documentTypes.find((t) => t.id === selectedType)?.label ?? 'Document'}`;
          setDocumentTitle(newTitle);

          await autoSaveDocument(fullContent, newTitle);
          setEditorKey((k) => k + 1); // re-mount the editor with the final content

          setMessages((prev) => [
            ...prev,
            {
              id: `assistant-done-${Date.now()}`,
              role: 'assistant',
              content:
                '✅ Your document is ready and has been saved to the project. You can edit it directly in the panel on the right, or ask me to adjust any section (e.g., "make the success metrics more specific").',
              timestamp: new Date(),
            },
          ]);
          setIsGenerating(false);
        },
        onError: (error) => {
          toast.error(`Generation failed: ${error}`);
          setIsGenerating(false);
        },
      }
    );
  };

  // Step 1 — type selector
  if (showTypeSelector) {
    return (
      <div className="p-8">
        <div className="max-w-4xl mx-auto">
          <button
            onClick={() => navigate(projectId ? `/projects/${projectId}` : '/dashboard')}
            className="flex items-center gap-2 mb-6 transition-colors"
            style={{ color: 'var(--neutral-600)' }}
          >
            <ArrowLeft size={18} />
            Back
          </button>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
          >
            <h1 className="text-3xl font-semibold mb-2">Choose Document Type</h1>
            <p className="mb-8" style={{ color: 'var(--neutral-500)' }}>
              Select the type of document you want to create
            </p>

            <div className="grid grid-cols-2 gap-4">
              {documentTypes.map((type) => {
                const Icon = type.icon;
                return (
                  <button
                    key={type.id}
                    onClick={() => handleTypeSelect(type.id)}
                    className="p-6 rounded-xl bg-white text-left transition-all hover:bg-purple-50"
                    style={{ border: '2px solid var(--border)' }}
                    onMouseEnter={(e) =>
                      (e.currentTarget.style.borderColor = 'var(--primary)')
                    }
                    onMouseLeave={(e) =>
                      (e.currentTarget.style.borderColor = 'var(--border)')
                    }
                  >
                    <div
                      className="w-12 h-12 rounded-lg flex items-center justify-center mb-3"
                      style={{ backgroundColor: 'var(--neutral-100)' }}
                    >
                      <Icon size={24} style={{ color: 'var(--neutral-600)' }} />
                    </div>
                    <h3 className="font-semibold mb-1">{type.label}</h3>
                    <p className="text-sm" style={{ color: 'var(--neutral-500)' }}>
                      {type.description}
                    </p>
                  </button>
                );
              })}
            </div>
          </motion.div>
        </div>
      </div>
    );
  }

  // Step 2/3 — chat (full width) or chat+doc split
  return (
    <div
      className="flex flex-col h-full overflow-hidden"
      style={{ backgroundColor: 'var(--neutral-100)' }}
    >
      {/* Header (fixed — never scrolls) */}
      <div
        className="bg-white px-6 py-4 flex-shrink-0"
        style={{ borderBottom: '1px solid var(--border)' }}
      >
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-4 flex-1 min-w-0">
            <button
              onClick={() => {
                cleanupRef.current?.();
                setShowTypeSelector(true);
                setMessages([]);
                setDocumentGenerated(false);
                setDocumentContent('');
              }}
              className="p-2 rounded-lg transition-colors flex-shrink-0"
              style={{ color: 'var(--neutral-700)' }}
              onMouseEnter={(e) =>
                (e.currentTarget.style.backgroundColor = 'var(--neutral-100)')
              }
              onMouseLeave={(e) =>
                (e.currentTarget.style.backgroundColor = 'transparent')
              }
            >
              <ArrowLeft size={20} />
            </button>
            <div className="flex-1 min-w-0">
              <h1
                className="text-lg font-semibold truncate"
                title={documentGenerated ? documentTitle : undefined}
              >
                {documentGenerated
                  ? documentTitle
                  : `New ${documentTypes.find((t) => t.id === selectedType)?.label}`}
              </h1>
              <p
                className="text-sm truncate"
                style={{ color: 'var(--neutral-500)' }}
              >
                {documentGenerated
                  ? 'Edit via chat or directly in the document'
                  : 'Chat with AI to create your document'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 flex-shrink-0">
            {documentGenerated && (
              <span className="text-sm" style={{ color: 'var(--neutral-500)' }}>
                {isGenerating ? (
                  <span className="flex items-center gap-2">
                    <motion.span
                      animate={{ rotate: 360 }}
                      transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                      className="inline-flex"
                    >
                      <Sparkles size={14} style={{ color: 'var(--primary)' }} />
                    </motion.span>
                    Updating document…
                  </span>
                ) : saveStatus === 'saving' ? (
                  'Saving…'
                ) : saveStatus === 'saved' ? (
                  <span className="flex items-center gap-1">
                    <Check size={14} style={{ color: 'var(--telus-green)' }} />
                    Auto-saved
                  </span>
                ) : saveStatus === 'error' ? (
                  <span style={{ color: '#DC2626' }}>Save failed</span>
                ) : (
                  ''
                )}
              </span>
            )}
            {documentGenerated && documentContent.trim() && (
              <button onClick={handleDownloadMarkdown} className="btn-secondary">
                <Download size={16} />
                Download
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 flex overflow-hidden min-h-0">
        <ChatPanel
          documentGenerated={documentGenerated}
          messages={messages}
          isGenerating={isGenerating}
          inputMessage={inputMessage}
          setInputMessage={setInputMessage}
          attachedFiles={attachedFiles}
          removeAttachment={removeAttachment}
          handleFileSelect={handleFileSelect}
          handleSendMessage={handleSendMessage}
          handleGenerateDocument={handleGenerateDocument}
          handleOptionClick={handleOptionClick}
          messagesEndRef={messagesEndRef}
          fileInputRef={fileInputRef}
        />

        {documentGenerated && (
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.4 }}
            className="w-1/2 bg-white flex flex-col min-h-0"
          >
            <div
              className="px-6 py-4 flex-shrink-0"
              style={{ borderBottom: '1px solid var(--border)' }}
            >
              <input
                type="text"
                value={documentTitle}
                onChange={(e) => {
                  setDocumentTitle(e.target.value);
                  if (saveDebounceRef.current) clearTimeout(saveDebounceRef.current);
                  saveDebounceRef.current = setTimeout(() => {
                    void autoSaveDocument(documentContent, e.target.value);
                  }, 1000);
                }}
                className="w-full text-xl font-semibold focus:outline-none bg-transparent"
                placeholder="Document Title"
              />
              <p className="text-xs mt-1" style={{ color: 'var(--neutral-500)' }}>
                {isGenerating
                  ? 'Generating…'
                  : saveStatus === 'saving'
                  ? 'Saving…'
                  : saveStatus === 'saved'
                  ? 'Auto-saved'
                  : saveStatus === 'error'
                  ? 'Save failed — will retry on next edit'
                  : 'Click anywhere below to edit'}
              </p>
            </div>
            <div
              className="flex-1 p-6 min-h-0 overflow-hidden"
              style={{ backgroundColor: 'var(--neutral-50)' }}
            >
              {isGenerating && documentContent.trim() ? (
                // While streaming: render read-only HTML preview that updates
                // as content flows in. This div scrolls internally — the outer
                // wrapper has overflow-hidden so the chat input + editor header
                // stay pinned.
                <div
                  className="bg-white rounded-lg shadow-sm h-full overflow-y-auto p-8 prose prose-sm max-w-none"
                  style={{ border: '1px solid var(--border)' }}
                  dangerouslySetInnerHTML={{
                    __html: marked.parse(documentContent, { async: false }) as string,
                  }}
                />
              ) : isGenerating ? (
                <div
                  className="bg-white rounded-lg shadow-sm h-full flex items-center justify-center"
                  style={{ border: '1px solid var(--border)' }}
                >
                  <div className="flex items-center gap-2" style={{ color: 'var(--neutral-500)' }}>
                    <motion.span
                      animate={{ rotate: 360 }}
                      transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                      className="inline-flex"
                    >
                      <Sparkles size={16} style={{ color: 'var(--primary)' }} />
                    </motion.span>
                    <span className="text-sm">Generating document…</span>
                  </div>
                </div>
              ) : documentContent.trim() ? (
                // RichEditor handles its own scroll internally — the toolbar
                // stays pinned at the top of the editor card while only the
                // content below it scrolls.
                <div className="h-full">
                  <RichEditor
                    key={editorKey}
                    content={marked.parse(documentContent, { async: false }) as string}
                    onChange={handleEditorChange}
                    placeholder="Click to start editing…"
                  />
                </div>
              ) : null}
            </div>
          </motion.div>
        )}
      </div>
    </div>
  );
}

// ─── Chat panel ───────────────────────────────────────────────────────────────

function ChatPanel(props: {
  documentGenerated: boolean;
  messages: Message[];
  isGenerating: boolean;
  inputMessage: string;
  setInputMessage: (v: string) => void;
  attachedFiles: File[];
  removeAttachment: (i: number) => void;
  handleFileSelect: (e: React.ChangeEvent<HTMLInputElement>) => void;
  handleSendMessage: () => void;
  handleGenerateDocument: () => void;
  handleOptionClick: (option: string) => void;
  messagesEndRef: React.RefObject<HTMLDivElement>;
  fileInputRef: React.RefObject<HTMLInputElement>;
}) {
  const {
    documentGenerated,
    messages,
    isGenerating,
    inputMessage,
    setInputMessage,
    attachedFiles,
    removeAttachment,
    handleFileSelect,
    handleSendMessage,
    handleGenerateDocument,
    handleOptionClick,
    messagesEndRef,
    fileInputRef,
  } = props;

  // Only the most recent assistant message shows options (earlier ones are answered)
  const lastAssistantIdx = [...messages].reverse().findIndex((m) => m.role === 'assistant');
  const latestAssistantId =
    lastAssistantIdx >= 0 ? messages[messages.length - 1 - lastAssistantIdx].id : null;

  return (
    <div
      className={`flex flex-col bg-white min-h-0 ${documentGenerated ? 'w-1/2' : 'w-full'}`}
      style={documentGenerated ? { borderRight: '1px solid var(--border)' } : undefined}
    >
      {/* Messages — only this scrolls */}
      <div className="flex-1 overflow-y-auto min-h-0">
        <div className="p-6 space-y-4 max-w-3xl mx-auto">
          <AnimatePresence initial={false}>
            {messages.map((message) => (
              <motion.div
                key={message.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[80%] rounded-2xl px-4 py-3 ${
                    message.role === 'user' ? 'text-white' : 'bg-white'
                  }`}
                  style={
                    message.role === 'user'
                      ? { backgroundColor: 'var(--primary)' }
                      : { border: '1px solid var(--border)' }
                  }
                >
                  {message.content ? (
                    <p className="text-sm leading-relaxed whitespace-pre-wrap">
                      {message.content}
                    </p>
                  ) : (
                    <div className="flex items-center gap-2">
                      <motion.span
                        animate={{ rotate: 360 }}
                        transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                        className="inline-flex"
                      >
                        <Sparkles size={16} style={{ color: 'var(--primary)' }} />
                      </motion.span>
                      <span className="text-sm" style={{ color: 'var(--neutral-500)' }}>
                        AI is thinking…
                      </span>
                    </div>
                  )}

                  {message.attachments && message.attachments.length > 0 && (
                    <div className="mt-3 space-y-2">
                      {message.attachments.map((file, idx) => (
                        <div
                          key={idx}
                          className={`flex items-center gap-2 p-2 rounded-lg ${
                            message.role === 'user' ? 'bg-white/10' : ''
                          }`}
                          style={
                            message.role === 'user'
                              ? undefined
                              : { backgroundColor: 'var(--neutral-50)' }
                          }
                        >
                          {file.type.startsWith('image/') ? (
                            <>
                              <ImageIcon size={16} />
                              {file.url && (
                                <img
                                  src={file.url}
                                  alt={file.name}
                                  className="max-w-full max-h-40 rounded"
                                />
                              )}
                            </>
                          ) : (
                            <>
                              <FileText size={16} />
                              <span className="text-sm">{file.name}</span>
                            </>
                          )}
                        </div>
                      ))}
                    </div>
                  )}

                  {message.options && message.options.length > 0 && message.id === latestAssistantId && (
                    <div className="mt-4 flex flex-wrap gap-2">
                      {message.options.map((opt, idx) => (
                        <button
                          key={idx}
                          onClick={() => handleOptionClick(opt)}
                          disabled={isGenerating}
                          className="px-3 py-1.5 text-sm rounded-full transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                          style={{
                            border: '1px solid var(--primary)',
                            color: 'var(--primary)',
                            backgroundColor: '#faf5ff',
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.backgroundColor = 'var(--primary)';
                            e.currentTarget.style.color = '#fff';
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.backgroundColor = '#faf5ff';
                            e.currentTarget.style.color = 'var(--primary)';
                          }}
                        >
                          {opt}
                        </button>
                      ))}
                    </div>
                  )}

                  {message.showGenerateButton && (
                    <button
                      onClick={handleGenerateDocument}
                      className="mt-4 w-full flex items-center justify-center gap-2 px-4 py-3 text-white rounded-lg hover:opacity-90 transition-opacity font-medium shadow-sm"
                      style={{
                        backgroundImage:
                          'linear-gradient(135deg, var(--telus-purple), var(--telus-green))',
                      }}
                    >
                      <Sparkles size={18} />
                      Generate Document
                    </button>
                  )}

                  <p
                    className="text-xs mt-2"
                    style={
                      message.role === 'user'
                        ? { color: 'rgba(255,255,255,0.7)' }
                        : { color: 'var(--neutral-500)' }
                    }
                  >
                    {message.timestamp.toLocaleTimeString([], {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </p>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>

          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Input */}
      <div className="p-4 flex-shrink-0 bg-white" style={{ borderTop: '1px solid var(--border)' }}>
        <div className="max-w-3xl mx-auto">
          {attachedFiles.length > 0 && (
            <div className="mb-3 flex flex-wrap gap-2">
              {attachedFiles.map((file, index) => (
                <div
                  key={index}
                  className="flex items-center gap-2 rounded-lg px-3 py-2"
                  style={{ backgroundColor: 'var(--neutral-100)' }}
                >
                  {file.type.startsWith('image/') ? (
                    <ImageIcon size={16} style={{ color: 'var(--primary)' }} />
                  ) : (
                    <FileText size={16} style={{ color: 'var(--primary)' }} />
                  )}
                  <span className="text-sm">{file.name}</span>
                  <button
                    onClick={() => removeAttachment(index)}
                    className="p-1 rounded transition-colors hover:bg-gray-200"
                  >
                    <X size={14} />
                  </button>
                </div>
              ))}
            </div>
          )}

          <div className="flex items-end gap-3">
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileSelect}
              multiple
              accept="image/*,.pdf,.doc,.docx,.md,.txt"
              className="hidden"
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              className="p-3 rounded-lg transition-colors hover:bg-gray-100"
              title="Attach files or images"
            >
              <Paperclip size={20} style={{ color: 'var(--neutral-600)' }} />
            </button>

            <textarea
              value={inputMessage}
              onChange={(e) => setInputMessage(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSendMessage();
                }
              }}
              placeholder={documentGenerated ? 'Request changes…' : 'Type your message…'}
              rows={1}
              className="flex-1 px-4 py-3 rounded-lg focus:outline-none focus:ring-2 focus:border-transparent resize-none max-h-32"
              style={{
                border: '1px solid var(--border)',
                minHeight: '48px',
                overflowY: inputMessage ? 'auto' : 'hidden',
                ['--tw-ring-color' as any]: 'var(--primary)',
              }}
            />

            <button
              onClick={handleSendMessage}
              disabled={(!inputMessage.trim() && attachedFiles.length === 0) || isGenerating}
              className="p-3 text-white rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
              style={{ backgroundColor: 'var(--primary)' }}
            >
              <Send size={20} />
            </button>
          </div>

          <p className="text-xs mt-2 text-center" style={{ color: 'var(--neutral-500)' }}>
            {documentGenerated
              ? 'Request edits via chat or edit directly. Press Enter to send, Shift+Enter for new line.'
              : 'Share your ideas, requirements, files, or images. Press Enter to send.'}
          </p>
        </div>
      </div>
    </div>
  );
}
