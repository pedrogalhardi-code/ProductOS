import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import {
  ChevronLeft,
  Download,
  MessageSquare,
  Sparkles,
  Send,
  Paperclip,
  X,
  FileText,
  Image as ImageIcon,
  ChevronDown,
  ChevronRight,
} from 'lucide-react';
import toast from 'react-hot-toast';
import TurndownService from 'turndown';
import { marked } from 'marked';
import { useDocumentStore } from '../stores/documentStore';
import { documents, streamChat, extractAttachmentText } from '../services/api';
import {
  loadChatHistory,
  saveChatHistory,
  type StoredMessage,
} from '../services/chatHistoryStorage';
import RichEditor from '../components/editor/RichEditor';
import type { ChatMessage } from '@shared/types';

const turndown = new TurndownService({ headingStyle: 'atx', codeBlockStyle: 'fenced' });

// Detect HTML by looking for any tag — if the string has no tags we treat it
// as markdown and convert it up-front so TipTap renders structure (headings,
// lists, tables) instead of a flat paragraph of raw markdown text.
function ensureHtml(content: string): string {
  if (!content) return content;
  if (/<[a-z][\s\S]*>/i.test(content)) return content;
  return marked.parse(content, { async: false }) as string;
}

interface UIMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  attachments?: { name: string; type: string; url?: string }[];
  timestamp: Date;
  requiresIntegration?: 'confluence' | 'jira';
  expandable?: {
    label: string;
    markdown: string;
  };
}

function detectIntegrationRequest(msg: string): 'confluence' | 'jira' | null {
  const lower = msg.toLowerCase();
  if (
    lower.includes('confluence') &&
    (lower.includes('push') || lower.includes('upload') || lower.includes('publish'))
  ) {
    return 'confluence';
  }
  if (
    lower.includes('jira') &&
    (lower.includes('push') || lower.includes('upload') || lower.includes('create'))
  ) {
    return 'jira';
  }
  return null;
}

export default function DocumentEditorPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [isLoading, setIsLoading] = useState(true);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [showChat, setShowChat] = useState(true);
  const [editorKey, setEditorKey] = useState(0);

  const [messages, setMessages] = useState<UIMessage[]>([
    {
      id: 'welcome',
      role: 'assistant',
      content:
        "I'm your product management expert. I'll help you create documents that drive product success through:\n\n• Clear problem statements and user value propositions\n• Data-driven success metrics and KPIs\n• Well-defined acceptance criteria using Gherkin (GIVEN/WHEN/THEN)\n• Alignment with business objectives and technical feasibility\n\nI can also help you push this to Confluence or Jira when ready.\n\nWhat would you like to improve in this document?",
      timestamp: new Date(),
    },
  ]);
  const [inputMessage, setInputMessage] = useState('');
  const [attachedFiles, setAttachedFiles] = useState<File[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);

  const currentDoc = useDocumentStore((s) => s.currentDocument);
  const setCurrentDocument = useDocumentStore((s) => s.setCurrentDocument);
  const updateDocument = useDocumentStore((s) => s.updateDocument);

  const saveTimeoutRef = useRef<NodeJS.Timeout>();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cleanupRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    if (!id) return;
    const loadDoc = async () => {
      try {
        const response = await documents.get(id);
        const doc = response.data.data;
        // Normalize legacy/mixed content: if it's markdown, convert to HTML so
        // TipTap parses it into proper headings, lists, tables.
        setCurrentDocument({ ...doc, content: ensureHtml(doc.content) });
        setLastSaved(new Date());

        // Restore any chat history we have locally for this document. If
        // found, auto-open the chat panel so the user sees the conversation.
        const stored = loadChatHistory(id);
        if (stored && stored.length > 0) {
          setMessages(
            stored.map((m) => ({
              id: m.id,
              role: m.role,
              content: m.content,
              attachments: m.attachments,
              timestamp: new Date(m.timestamp),
              requiresIntegration: m.requiresIntegration,
              expandable: m.expandable,
            }))
          );
          setShowChat(true);
        }
      } catch (err) {
        toast.error('Failed to load document');
        navigate('/dashboard');
      } finally {
        setIsLoading(false);
      }
    };
    loadDoc();
  }, [id, setCurrentDocument, navigate]);

  // Persist chat to localStorage whenever it changes.
  useEffect(() => {
    if (!id || messages.length === 0) return;
    // Skip saving while the welcome-only state is still in play
    if (messages.length === 1 && messages[0].id === 'welcome') return;
    const storable: StoredMessage[] = messages.map((m) => ({
      id: m.id,
      role: m.role,
      content: m.content,
      attachments: m.attachments?.map((a) => ({ name: a.name, type: a.type })),
      timestamp: m.timestamp.toISOString(),
      requiresIntegration: m.requiresIntegration,
      expandable: m.expandable,
    }));
    saveChatHistory(id, storable);
  }, [messages, id]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isGenerating]);

  useEffect(() => () => cleanupRef.current?.(), []);

  const handleContentChange = (content: string) => {
    if (!currentDoc) return;
    setCurrentDocument({ ...currentDoc, content });
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    saveTimeoutRef.current = setTimeout(async () => {
      try {
        const response = await documents.update(id!, { content });
        updateDocument(response.data.data);
        setLastSaved(new Date());
      } catch (err) {
        toast.error('Failed to save document');
      }
    }, 2000);
  };

  const handleTitleChange = (title: string) => {
    if (!currentDoc) return;
    setCurrentDocument({ ...currentDoc, title });
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    saveTimeoutRef.current = setTimeout(async () => {
      try {
        const response = await documents.update(id!, { title });
        updateDocument(response.data.data);
        setLastSaved(new Date());
      } catch (err) {
        toast.error('Failed to save title');
      }
    }, 1000);
  };

  const handleDownloadMarkdown = () => {
    if (!currentDoc) return;
    // currentDoc.content may be HTML (from TipTap) or markdown (legacy). Run it
    // through turndown — it leaves plain-text/markdown mostly untouched and
    // converts HTML to markdown.
    const markdown = currentDoc.content.includes('<')
      ? turndown.turndown(currentDoc.content)
      : currentDoc.content;
    const blob = new Blob([markdown], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${currentDoc.title.replace(/\s+/g, '-').toLowerCase() || 'document'}.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    setAttachedFiles((prev) => [...prev, ...files]);
  };

  const removeAttachment = (index: number) => {
    setAttachedFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSendMessage = async () => {
    if (!currentDoc) return;
    if ((!inputMessage.trim() && attachedFiles.length === 0) || isGenerating) return;

    const attachments = attachedFiles.map((file) => ({
      name: file.name,
      type: file.type,
      url: URL.createObjectURL(file),
    }));

    const userMsg: UIMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: inputMessage,
      attachments: attachments.length ? attachments : undefined,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMsg]);
    const currentInput = inputMessage;
    const filesToExtract = [...attachedFiles];
    setInputMessage('');
    setAttachedFiles([]);

    // Extract text from attachments so the AI actually reads them
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

    const combinedInput = [currentInput, attachmentBlock].filter(Boolean).join('\n\n');

    // Check for integration intent first — respond client-side with a connect button
    const integrationType = detectIntegrationRequest(currentInput);
    if (integrationType) {
      setMessages((prev) => [
        ...prev,
        {
          id: `assistant-${Date.now()}`,
          role: 'assistant',
          content: `To push this to ${
            integrationType === 'confluence' ? 'Confluence' : 'Jira'
          }, you'll need to connect your Atlassian account first. Click below to open Settings.`,
          timestamp: new Date(),
          requiresIntegration: integrationType,
        },
      ]);
      return;
    }

    // Otherwise — call AI in edit mode to update the document
    setIsGenerating(true);

    const chatHistory: ChatMessage[] = [
      ...messages.map((m) => ({ role: m.role, content: m.content } as ChatMessage)),
      { role: 'user', content: combinedInput || '(no content)' },
    ];

    let buffered = '';
    cleanupRef.current = streamChat(
      {
        messages: chatHistory,
        mode: 'edit',
        projectId: currentDoc.projectId,
        documentType: currentDoc.type,
        currentContent: currentDoc.content,
      },
      {
        onDelta: (delta) => {
          buffered += delta;
        },
        onDone: (fullContent) => {
          // AI returns markdown — convert to HTML so TipTap preserves structure
          // (headings, lists, tables). We store HTML as the canonical format.
          if (currentDoc) {
            const html = marked.parse(fullContent, { async: false }) as string;
            const updated = { ...currentDoc, content: html };
            setCurrentDocument(updated);
            setEditorKey((k) => k + 1); // force RichEditor to reload with new content
            handleContentChange(html); // schedule debounced save
          }
          setMessages((prev) => [
            ...prev,
            {
              id: `assistant-${Date.now()}`,
              role: 'assistant',
              content:
                '✓ Document updated. I applied your change with product best practices — clear user value, measurable outcomes, and Gherkin-style acceptance criteria where appropriate.',
              timestamp: new Date(),
            },
          ]);
          setIsGenerating(false);
        },
        onError: (error) => {
          toast.error(`Edit failed: ${error}`);
          setIsGenerating(false);
        },
      }
    );
  };

  if (isLoading) {
    return (
      <div className="p-8">
        <div className="h-8 w-48 shimmer rounded mb-6" />
        <div className="h-96 shimmer rounded-xl" />
      </div>
    );
  }

  if (!currentDoc) {
    return (
      <div className="p-8 text-center">
        <p style={{ color: 'var(--neutral-500)' }}>Document not found</p>
      </div>
    );
  }

  const formatLastSaved = () => {
    if (!lastSaved) return 'Never';
    const diff = Date.now() - lastSaved.getTime();
    const minutes = Math.floor(diff / 60000);
    if (minutes < 1) return 'just now';
    if (minutes < 60) return `${minutes}m ago`;
    return lastSaved.toLocaleTimeString();
  };

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
              onClick={() => navigate(-1)}
              className="p-2 rounded-lg transition-colors flex-shrink-0"
              style={{ color: 'var(--neutral-700)' }}
              onMouseEnter={(e) =>
                (e.currentTarget.style.backgroundColor = 'var(--neutral-100)')
              }
              onMouseLeave={(e) =>
                (e.currentTarget.style.backgroundColor = 'transparent')
              }
            >
              <ChevronLeft size={20} />
            </button>
            <div className="flex-1 min-w-0">
              <input
                type="text"
                value={currentDoc.title}
                onChange={(e) => handleTitleChange(e.target.value)}
                title={currentDoc.title}
                className="text-lg font-semibold bg-transparent border-none p-0 focus:outline-none w-full truncate"
              />
              <p
                className="text-sm truncate"
                style={{ color: 'var(--neutral-500)' }}
              >
                Edit via chat or directly in the document
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 flex-shrink-0">
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
              ) : (
                `Auto-saved ${formatLastSaved()}`
              )}
            </span>
            <button
              onClick={handleDownloadMarkdown}
              className="btn-secondary"
            >
              <Download size={16} />
              Download
            </button>
            <button
              onClick={() => setShowChat(!showChat)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-lg transition-colors font-medium text-sm ${
                showChat ? 'text-white' : ''
              }`}
              style={
                showChat
                  ? { backgroundColor: 'var(--primary)' }
                  : { border: '1px solid var(--border)' }
              }
            >
              <MessageSquare size={16} />
              {showChat ? 'Hide Chat' : 'Show Chat'}
            </button>
          </div>
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 flex overflow-hidden min-h-0">
        <AnimatePresence initial={false}>
          {showChat && (
            <motion.div
              key="chat-panel"
              initial={{ width: 0, opacity: 0 }}
              animate={{ width: '50%', opacity: 1 }}
              exit={{ width: 0, opacity: 0 }}
              transition={{ duration: 0.3 }}
              className="flex flex-col bg-white overflow-hidden min-h-0"
              style={{ borderRight: '1px solid var(--border)' }}
            >
              <div className="flex-1 overflow-y-auto min-h-0">
                <div className="p-6 space-y-4">
                  <AnimatePresence initial={false}>
                    {messages.map((message) => (
                      <motion.div
                        key={message.id}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className={`flex ${
                          message.role === 'user' ? 'justify-end' : 'justify-start'
                        }`}
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
                          <p className="text-sm leading-relaxed whitespace-pre-wrap">
                            {message.content}
                          </p>

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

                          {message.requiresIntegration && (
                            <button
                              onClick={() => navigate('/settings')}
                              className="mt-4 w-full flex items-center justify-center gap-2 px-4 py-3 text-white rounded-lg hover:opacity-90 transition-opacity font-medium shadow-sm"
                              style={{
                                backgroundImage:
                                  'linear-gradient(135deg, var(--telus-purple), var(--telus-green))',
                              }}
                            >
                              <Sparkles size={18} />
                              Connect{' '}
                              {message.requiresIntegration === 'confluence'
                                ? 'Confluence'
                                : 'Jira'}
                            </button>
                          )}

                          {message.expandable && (
                            <ExpandableBlock
                              label={message.expandable.label}
                              markdown={message.expandable.markdown}
                            />
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

                  {isGenerating && (
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="flex justify-start"
                    >
                      <div
                        className="bg-white rounded-2xl px-4 py-3"
                        style={{ border: '1px solid var(--border)' }}
                      >
                        <div className="flex items-center gap-2">
                          <motion.span
                            animate={{ rotate: 360 }}
                            transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                            className="inline-flex"
                          >
                            <Sparkles size={16} style={{ color: 'var(--primary)' }} />
                          </motion.span>
                          <span
                            className="text-sm"
                            style={{ color: 'var(--neutral-500)' }}
                          >
                            AI is thinking…
                          </span>
                        </div>
                      </div>
                    </motion.div>
                  )}
                  <div ref={messagesEndRef} />
                </div>
              </div>

              <div className="p-4 flex-shrink-0 bg-white" style={{ borderTop: '1px solid var(--border)' }}>
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
                    placeholder="Request changes…"
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
                    disabled={
                      (!inputMessage.trim() && attachedFiles.length === 0) || isGenerating
                    }
                    className="p-3 text-white rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
                    style={{ backgroundColor: 'var(--primary)' }}
                  >
                    <Send size={20} />
                  </button>
                </div>

                <p
                  className="text-xs mt-2 text-center"
                  style={{ color: 'var(--neutral-500)' }}
                >
                  Request edits via chat or edit the document directly. Press Enter to send,
                  Shift+Enter for new line.
                </p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <div className={`flex flex-col bg-white min-h-0 ${showChat ? 'w-1/2' : 'w-full'}`}>
          <div
            className="flex-1 p-6 min-h-0 overflow-hidden"
            style={{ backgroundColor: 'var(--neutral-50)' }}
          >
            <div className="max-w-4xl mx-auto h-full">
              <RichEditor
                key={editorKey}
                content={currentDoc.content}
                onChange={handleContentChange}
                placeholder="Start editing your document…"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Expandable block (e.g. full AI analysis) ────────────────────────────────

function ExpandableBlock({ label, markdown }: { label: string; markdown: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div
      className="mt-4 rounded-lg"
      style={{
        border: '1px solid var(--border)',
        backgroundColor: 'var(--neutral-50)',
      }}
    >
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between gap-2 px-3 py-2 text-sm font-medium hover:bg-gray-100 rounded-lg"
        style={{ color: 'var(--neutral-700)' }}
      >
        <span className="flex items-center gap-2">
          {open ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
          {label}
        </span>
      </button>
      {open && (
        <div
          className="prose prose-sm max-w-none px-4 pb-3 pt-1"
          style={{ color: 'var(--neutral-700)' }}
          dangerouslySetInnerHTML={{
            __html: marked.parse(markdown, { async: false }) as string,
          }}
        />
      )}
    </div>
  );
}
