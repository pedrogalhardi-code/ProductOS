import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { marked } from 'marked';
import {
  Plus,
  FileText,
  ChevronRight,
  Upload,
  X,
  Sparkles,
  Users,
  Code,
  Briefcase,
  Map,
  Target,
  Settings,
  Trash2,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { useProjectStore } from '../stores/projectStore';
import { useDocumentStore } from '../stores/documentStore';
import { projects, documents, streamGenerate } from '../services/api';
import Badge from '../components/ui/Badge';
import DocumentCardMenu from '../components/ui/DocumentCardMenu';
import { saveChatHistory, type StoredMessage } from '../services/chatHistoryStorage';
import type { DocumentType, ProjectAttachmentDto, ProjectDto } from '@shared/types';

function initials(name?: string) {
  if (!name) return 'U';
  return name.split(' ').map((p) => p[0]).slice(0, 2).join('').toUpperCase();
}

function formatRelative(dateStr: string) {
  const date = new Date(dateStr);
  const diff = Date.now() - date.getTime();
  const mins = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);
  if (mins < 60) return `${Math.max(1, mins)}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days === 1) return 'yesterday';
  if (days < 30) return `${days}d ago`;
  return date.toLocaleDateString();
}

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

export default function ProjectPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [isLoading, setIsLoading] = useState(true);
  const [showImportModal, setShowImportModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);

  const currentProject = useProjectStore((s) => s.currentProject);
  const setCurrentProject = useProjectStore((s) => s.setCurrentProject);
  const updateProjectInStore = useProjectStore((s) => s.updateProject);
  const docList = useDocumentStore((s) => s.documents);
  const setDocuments = useDocumentStore((s) => s.setDocuments);
  const addDocument = useDocumentStore((s) => s.addDocument);

  useEffect(() => {
    if (!id) return;
    const loadProject = async () => {
      try {
        const [projRes, docRes] = await Promise.all([
          projects.get(id),
          documents.list({ projectId: id }),
        ]);
        setCurrentProject(projRes.data.data);
        setDocuments(docRes.data.data || []);
      } catch (err) {
        toast.error('Failed to load project');
        navigate('/dashboard');
      } finally {
        setIsLoading(false);
      }
    };
    loadProject();
  }, [id, setCurrentProject, setDocuments, navigate]);

  const projectDocs = docList.filter((d) => d.projectId === id);

  const handleImportSuccess = (doc: {
    title: string;
    type: DocumentType;
    content: string;
    chatSeed?: StoredMessage[];
  }) => {
    if (!id) return;
    documents
      .create({
        title: doc.title,
        type: doc.type,
        projectId: id,
        content: doc.content,
      })
      .then((res) => {
        addDocument(res.data.data);
        if (doc.chatSeed && doc.chatSeed.length > 0) {
          saveChatHistory(res.data.data.id, doc.chatSeed);
        }
        toast.success('Document imported');
        navigate(`/documents/${res.data.data.id}`);
      })
      .catch(() => toast.error('Failed to create document'));
  };

  if (isLoading) {
    return (
      <div className="p-8">
        <div className="h-6 w-48 shimmer rounded mb-6" />
        <div className="h-10 w-80 shimmer rounded mb-6" />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-40 shimmer rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  if (!currentProject) {
    return (
      <div className="p-8 text-center">
        <p style={{ color: 'var(--neutral-500)' }}>Project not found</p>
      </div>
    );
  }

  return (
    <div className="p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Breadcrumb */}
        <div
          className="flex items-center gap-2 text-sm"
          style={{ color: 'var(--neutral-500)' }}
        >
          <Link to="/dashboard" style={{ color: 'var(--neutral-500)' }}>
            Dashboard
          </Link>
          <ChevronRight size={14} />
          <span style={{ color: 'var(--neutral-900)' }}>{currentProject.name}</span>
        </div>

        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-semibold mb-2">{currentProject.name}</h1>
            <p style={{ color: 'var(--neutral-500)' }}>
              {projectDocs.length}{' '}
              {projectDocs.length === 1 ? 'document' : 'documents'}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowEditModal(true)}
              className="btn-secondary"
              title="Edit project context & attachments"
            >
              <Settings size={18} />
              Edit Project
            </button>
            <button onClick={() => setShowImportModal(true)} className="btn-secondary">
              <Upload size={18} />
              Import Document
            </button>
            <button
              onClick={() => navigate(`/documents/new?projectId=${id}`)}
              className="btn-primary"
            >
              <Plus size={18} />
              New Document
            </button>
          </div>
        </div>

        {/* Documents */}
        {projectDocs.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {projectDocs.map((doc, index) => (
              <motion.div
                key={doc.id}
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.3, delay: index * 0.05 }}
              >
                <Link
                  to={`/documents/${doc.id}`}
                  className="block bg-white rounded-xl p-5 shadow-sm hover:shadow-md transition-shadow"
                  style={{ border: '1px solid var(--border)' }}
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex gap-2">
                      <Badge type="type" value={doc.type} />
                      <Badge type="status" value={doc.status} />
                    </div>
                    <DocumentCardMenu doc={doc} />
                  </div>
                  <h3 className="font-medium mb-4 line-clamp-2">{doc.title}</h3>
                  <div
                    className="flex items-center justify-between text-xs"
                    style={{ color: 'var(--neutral-500)' }}
                  >
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded-full gradient-mark flex items-center justify-center">
                        <span className="text-white text-[10px] font-medium">
                          {initials(doc.author?.name)}
                        </span>
                      </div>
                      <span>{doc.author?.name || 'Unknown'}</span>
                    </div>
                    <span>{formatRelative(doc.updatedAt)}</span>
                  </div>
                </Link>
              </motion.div>
            ))}
          </div>
        ) : (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
            className="bg-white rounded-2xl p-12 text-center"
            style={{ border: '1px solid var(--border)' }}
          >
            <div
              className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4"
              style={{ backgroundColor: 'var(--neutral-100)' }}
            >
              <FileText size={32} style={{ color: 'var(--neutral-400)' }} />
            </div>
            <h3 className="text-lg font-semibold mb-2">No documents yet</h3>
            <p style={{ color: 'var(--neutral-500)' }} className="mb-6">
              Get started by creating your first document for this project.
            </p>
            <button
              onClick={() => navigate(`/documents/new?projectId=${id}`)}
              className="btn-primary"
            >
              <Plus size={18} />
              Create Document
            </button>
          </motion.div>
        )}
      </div>

      <ImportDocumentModal
        open={showImportModal}
        onClose={() => setShowImportModal(false)}
        projectId={id!}
        onImport={handleImportSuccess}
      />

      <EditProjectModal
        open={showEditModal}
        onClose={() => setShowEditModal(false)}
        project={currentProject}
        onSaved={(updated) => {
          setCurrentProject(updated);
          updateProjectInStore(updated);
        }}
      />
    </div>
  );
}

// ─── Import modal ─────────────────────────────────────────────────────────────

function ImportDocumentModal({
  open,
  onClose,
  projectId,
  onImport,
}: {
  open: boolean;
  onClose: () => void;
  projectId: string;
  onImport: (doc: {
    title: string;
    type: DocumentType;
    content: string;
    chatSeed?: StoredMessage[];
  }) => void;
}) {
  const [selectedType, setSelectedType] = useState<DocumentType | null>(null);
  const [importedFile, setImportedFile] = useState<File | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isImproving, setIsImproving] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<string | null>(null);
  const [extractedText, setExtractedText] = useState<string | null>(null);
  const [userOverride, setUserOverride] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const reset = () => {
    setSelectedType(null);
    setImportedFile(null);
    setIsAnalyzing(false);
    setIsImproving(false);
    setAnalysisResult(null);
    setExtractedText(null);
    setUserOverride('');
  };

  const close = () => {
    reset();
    onClose();
  };

  const handleFileChosen = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !selectedType) return;
    setImportedFile(file);
    setIsAnalyzing(true);
    try {
      const res = await documents.analyze(file, selectedType, projectId);
      setAnalysisResult(res.data.data.analysis);
      setExtractedText(res.data.data.extractedText);
    } catch (err: any) {
      toast.error(err?.response?.data?.error || 'Analysis failed');
      setImportedFile(null);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleImportAndImprove = () => {
    if (!selectedType || !extractedText || !importedFile || !analysisResult) return;
    setIsImproving(true);

    const userBlock = userOverride.trim()
      ? `\n\n=== User adjustments to the feedback (take precedence) ===\n${userOverride.trim()}\n\nFollow these user instructions carefully. If they say to ignore a specific recommendation, skip it. If they request additional changes, apply those too.`
      : '';

    const prompt = `You are rewriting a user's existing product document to apply expert PM feedback. Produce the COMPLETE revised document in polished markdown — well structured, with clear sections, bullet lists, tables where appropriate, and acceptance criteria in GIVEN/WHEN/THEN format where relevant. Do NOT include any preamble or meta-commentary; only output the final document.

=== Original document ===
${extractedText}

=== Expert PM feedback ===
${analysisResult}${userBlock}

Now produce the revised, improved document applying the feedback${userOverride.trim() ? ', adjusted per the user instructions above' : ''}.`;

    let buffered = '';
    streamGenerate(
      {
        projectId,
        documentType: selectedType,
        input: prompt,
        inputType: 'notes',
      },
      (delta) => {
        buffered += delta;
      },
      async (fullContent) => {
        const finalMarkdown = fullContent || buffered;
        try {
          const html = (await Promise.resolve(marked.parse(finalMarkdown))) as string;
          const now = new Date().toISOString();
          const fileName = importedFile.name;
          const chatSeed: StoredMessage[] = [];

          if (userOverride.trim()) {
            chatSeed.push({
              id: `seed-user-${Date.now()}`,
              role: 'user',
              content: userOverride.trim(),
              timestamp: now,
            });
          }

          chatSeed.push({
            id: `seed-assistant-${Date.now() + 1}`,
            role: 'assistant',
            content: `I imported **${fileName}** and applied the expert PM feedback${
              userOverride.trim() ? ', adjusted to your instructions above' : ''
            }. The revised document is on the right — tell me to tweak any section ("undo the OKR change", "tighten the risks", etc.) and I'll update it.`,
            timestamp: now,
            expandable: {
              label: 'See full analysis',
              markdown: analysisResult,
            },
          });

          onImport({
            title: importedFile.name.replace(/\.[^/.]+$/, ''),
            type: selectedType,
            content: html,
            chatSeed,
          });
          close();
        } catch {
          toast.error('Failed to render improved document');
          setIsImproving(false);
        }
      },
      (err) => {
        toast.error(`Improvement failed: ${err}`);
        setIsImproving(false);
      }
    );
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={close}
          className="fixed inset-0 z-40 flex items-center justify-center p-4"
          style={{ backgroundColor: 'rgba(0,0,0,0.4)' }}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            onClick={(e) => e.stopPropagation()}
            className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[80vh] overflow-hidden flex flex-col"
          >
            <div
              className="px-6 py-4 flex items-center justify-between"
              style={{ borderBottom: '1px solid var(--border)' }}
            >
              <div>
                <h2 className="text-xl font-semibold">Import Document</h2>
                <p className="text-sm mt-1" style={{ color: 'var(--neutral-500)' }}>
                  {!selectedType
                    ? 'Step 1 of 3: Select document type'
                    : !importedFile
                    ? 'Step 2 of 3: Upload document'
                    : 'Step 3 of 3: Review analysis'}
                </p>
              </div>
              <button
                onClick={close}
                className="p-2 rounded-lg transition-colors hover:bg-gray-100"
              >
                <X size={20} />
              </button>
            </div>

            <div className="p-6 overflow-y-auto">
              {!selectedType ? (
                <div>
                  <p className="mb-6" style={{ color: 'var(--neutral-600)' }}>
                    First, select the type of document you're importing. I'll analyze it
                    based on product management best practices for that document type.
                  </p>
                  <div className="grid grid-cols-2 gap-3">
                    {documentTypes.map((type) => {
                      const Icon = type.icon;
                      return (
                        <button
                          key={type.id}
                          onClick={() => setSelectedType(type.id)}
                          className="p-4 rounded-xl text-left transition-all hover:bg-purple-50"
                          style={{ border: '2px solid var(--border)' }}
                          onMouseEnter={(e) =>
                            (e.currentTarget.style.borderColor = 'var(--primary)')
                          }
                          onMouseLeave={(e) =>
                            (e.currentTarget.style.borderColor = 'var(--border)')
                          }
                        >
                          <div
                            className="w-10 h-10 rounded-lg flex items-center justify-center mb-3"
                            style={{ backgroundColor: 'var(--neutral-100)' }}
                          >
                            <Icon size={20} style={{ color: 'var(--neutral-600)' }} />
                          </div>
                          <h3 className="font-semibold text-sm mb-1">{type.label}</h3>
                          <p className="text-xs" style={{ color: 'var(--neutral-500)' }}>
                            {type.description}
                          </p>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ) : !importedFile ? (
                <div>
                  <div
                    className="flex items-center gap-3 mb-6 pb-6"
                    style={{ borderBottom: '1px solid var(--border)' }}
                  >
                    <div className="w-10 h-10 rounded-lg gradient-mark flex items-center justify-center">
                      {(() => {
                        const Icon =
                          documentTypes.find((t) => t.id === selectedType)?.icon ||
                          FileText;
                        return <Icon size={20} className="text-white" />;
                      })()}
                    </div>
                    <div className="flex-1">
                      <p className="font-semibold">
                        {documentTypes.find((t) => t.id === selectedType)?.label}
                      </p>
                      <p className="text-sm" style={{ color: 'var(--neutral-500)' }}>
                        Upload your document for analysis
                      </p>
                    </div>
                    <button
                      onClick={() => setSelectedType(null)}
                      className="text-sm hover:underline"
                      style={{ color: 'var(--primary)' }}
                    >
                      Change Type
                    </button>
                  </div>

                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleFileChosen}
                    accept=".pdf,.doc,.docx,.md,.txt"
                    className="hidden"
                  />
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="w-full rounded-xl p-12 text-center transition-all hover:bg-purple-50"
                    style={{ border: '2px dashed var(--border)' }}
                    onMouseEnter={(e) =>
                      (e.currentTarget.style.borderColor = 'var(--primary)')
                    }
                    onMouseLeave={(e) =>
                      (e.currentTarget.style.borderColor = 'var(--border)')
                    }
                  >
                    <Upload
                      size={48}
                      className="mx-auto mb-4"
                      style={{ color: 'var(--neutral-400)' }}
                    />
                    <p className="font-medium mb-2">Upload Document</p>
                    <p className="text-sm" style={{ color: 'var(--neutral-500)' }}>
                      PDF, Word, Markdown, or Text files
                    </p>
                  </button>
                </div>
              ) : (
                <div>
                  <div className="mb-6 space-y-3">
                    <div
                      className="flex items-center gap-3 p-4 rounded-lg"
                      style={{ backgroundColor: 'var(--neutral-50)' }}
                    >
                      <FileText size={24} style={{ color: 'var(--primary)' }} />
                      <div className="flex-1">
                        <p className="font-medium">{importedFile.name}</p>
                        <p className="text-sm" style={{ color: 'var(--neutral-500)' }}>
                          {(importedFile.size / 1024).toFixed(1)} KB
                        </p>
                      </div>
                    </div>
                    <div
                      className="flex items-center gap-3 p-4 rounded-lg"
                      style={{
                        backgroundImage:
                          'linear-gradient(135deg, rgba(75,40,109,0.08), rgba(0,166,81,0.08))',
                        border: '1px solid rgba(75,40,109,0.15)',
                      }}
                    >
                      {(() => {
                        const Icon =
                          documentTypes.find((t) => t.id === selectedType)?.icon ||
                          FileText;
                        return <Icon size={20} style={{ color: 'var(--primary)' }} />;
                      })()}
                      <div className="flex-1">
                        <p className="text-sm" style={{ color: 'var(--neutral-600)' }}>
                          Document Type
                        </p>
                        <p className="font-semibold" style={{ color: 'var(--primary)' }}>
                          {documentTypes.find((t) => t.id === selectedType)?.label}
                        </p>
                      </div>
                      <button
                        onClick={reset}
                        className="text-xs hover:underline"
                        style={{ color: 'var(--primary)' }}
                      >
                        Change
                      </button>
                    </div>
                  </div>

                  {isAnalyzing ? (
                    <div className="flex flex-col items-center justify-center py-12">
                      <motion.span
                        animate={{ rotate: 360 }}
                        transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
                        className="mb-4 inline-flex"
                      >
                        <Sparkles size={48} style={{ color: 'var(--primary)' }} />
                      </motion.span>
                      <p className="text-lg font-medium mb-2">Analyzing Document…</p>
                      <p className="text-sm" style={{ color: 'var(--neutral-500)' }}>
                        Evaluating from a product management perspective
                      </p>
                    </div>
                  ) : analysisResult ? (
                    <div>
                      <div
                        className="rounded-xl p-6 mb-6"
                        style={{
                          backgroundImage:
                            'linear-gradient(135deg, rgba(75,40,109,0.06), rgba(0,166,81,0.06))',
                        }}
                      >
                        <div className="flex items-start gap-3 mb-4">
                          <Sparkles
                            size={24}
                            style={{ color: 'var(--primary)', marginTop: 4 }}
                          />
                          <div>
                            <h3 className="font-semibold text-lg mb-1">
                              AI Analysis Complete
                            </h3>
                            <p
                              className="text-sm"
                              style={{ color: 'var(--neutral-600)' }}
                            >
                              Product Management Expert Feedback
                            </p>
                          </div>
                        </div>
                      </div>

                      <div
                        className="prose prose-sm max-w-none mb-6"
                        style={{ color: 'var(--neutral-700)' }}
                        dangerouslySetInnerHTML={{
                          __html: marked.parse(analysisResult, { async: false }) as string,
                        }}
                      />

                      <div className="mb-6">
                        <label
                          className="block text-sm font-medium mb-2"
                          style={{ color: 'var(--neutral-700)' }}
                        >
                          Anything to change or skip? (optional)
                        </label>
                        <textarea
                          value={userOverride}
                          onChange={(e) => setUserOverride(e.target.value)}
                          rows={3}
                          placeholder="e.g., Ignore the OKR recommendation, keep the original success metrics, and add a competitive analysis section."
                          disabled={isImproving}
                          className="textarea"
                        />
                        <p
                          className="text-xs mt-1"
                          style={{ color: 'var(--neutral-500)' }}
                        >
                          Your instructions override the AI feedback — leave blank to apply
                          everything as suggested.
                        </p>
                      </div>

                      {isImproving ? (
                        <div
                          className="flex items-center justify-center gap-2 py-6 rounded-lg"
                          style={{
                            backgroundImage:
                              'linear-gradient(135deg, rgba(75,40,109,0.06), rgba(0,166,81,0.06))',
                          }}
                        >
                          <motion.span
                            animate={{ rotate: 360 }}
                            transition={{ duration: 1.5, repeat: Infinity, ease: 'linear' }}
                            className="inline-flex"
                          >
                            <Sparkles size={20} style={{ color: 'var(--primary)' }} />
                          </motion.span>
                          <span className="text-sm font-medium" style={{ color: 'var(--primary)' }}>
                            Rewriting document with suggestions…
                          </span>
                        </div>
                      ) : (
                        <div className="flex gap-3">
                          <button
                            onClick={close}
                            className="btn-secondary flex-1 justify-center"
                            disabled={isImproving}
                          >
                            Cancel
                          </button>
                          <button
                            onClick={handleImportAndImprove}
                            disabled={isImproving}
                            className="flex-1 flex items-center justify-center gap-2 px-4 py-3 text-white rounded-lg hover:opacity-90 transition-opacity font-medium disabled:opacity-60 disabled:cursor-not-allowed"
                            style={{
                              backgroundImage:
                                'linear-gradient(135deg, var(--telus-purple), var(--telus-green))',
                            }}
                          >
                            <Sparkles size={18} />
                            Import & Improve
                          </button>
                        </div>
                      )}
                    </div>
                  ) : null}
                </div>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// ─── Edit Project modal ──────────────────────────────────────────────────────

function EditProjectModal({
  open,
  onClose,
  project,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  project: ProjectDto;
  onSaved: (updated: ProjectDto) => void;
}) {
  const [name, setName] = useState(project.name);
  const [clientContext, setClientContext] = useState(project.clientContext);
  const [attachments, setAttachments] = useState<ProjectAttachmentDto[]>(
    project.attachments ?? []
  );
  const [newFiles, setNewFiles] = useState<File[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setName(project.name);
      setClientContext(project.clientContext);
      setAttachments(project.attachments ?? []);
      setNewFiles([]);
    }
  }, [open, project]);

  const handleFileAdd = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    setNewFiles((prev) => [...prev, ...files]);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleRemoveExisting = async (attachmentId: string) => {
    try {
      await projects.deleteAttachment(project.id, attachmentId);
      setAttachments((prev) => prev.filter((a) => a.id !== attachmentId));
      toast.success('Attachment removed');
    } catch {
      toast.error('Failed to remove attachment');
    }
  };

  const handleSave = async () => {
    if (!name.trim() || !clientContext.trim()) {
      toast.error('Name and client context are required');
      return;
    }
    setIsSaving(true);
    try {
      const updateRes = await projects.update(project.id, { name, clientContext });
      let currentAttachments = attachments;

      if (newFiles.length > 0) {
        const addRes = await projects.addAttachments(project.id, newFiles);
        const created = addRes.data.data.map((a) => ({
          id: a.id,
          projectId: a.projectId,
          name: a.name,
          size: a.size,
          createdAt: a.createdAt,
        }));
        currentAttachments = [...attachments, ...created];
      }

      onSaved({ ...updateRes.data.data, attachments: currentAttachments });
      toast.success('Project updated');
      onClose();
    } catch {
      toast.error('Failed to save changes');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="fixed inset-0 z-40 flex items-center justify-center p-4"
          style={{ backgroundColor: 'rgba(0,0,0,0.4)' }}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            onClick={(e) => e.stopPropagation()}
            className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[85vh] overflow-hidden flex flex-col"
          >
            <div
              className="px-6 py-4 flex items-center justify-between flex-shrink-0"
              style={{ borderBottom: '1px solid var(--border)' }}
            >
              <h2 className="text-xl font-semibold">Edit Project</h2>
              <button
                onClick={onClose}
                className="p-2 rounded-lg transition-colors hover:bg-gray-100"
              >
                <X size={20} />
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-6 flex-1 min-h-0">
              <div>
                <label className="label">Project Name</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="input"
                />
              </div>

              <div>
                <label className="label">Client Context</label>
                <textarea
                  value={clientContext}
                  onChange={(e) => setClientContext(e.target.value)}
                  rows={7}
                  className="textarea"
                />
                <p className="mt-2 text-xs" style={{ color: 'var(--neutral-500)' }}>
                  💡 This context is injected into every AI call for this project.
                </p>
              </div>

              <div>
                <label className="label">Attached Documents</label>

                {attachments.length === 0 && newFiles.length === 0 && (
                  <p
                    className="text-sm mb-3"
                    style={{ color: 'var(--neutral-500)' }}
                  >
                    No attachments yet. Upload PDFs, markdown, or text files to give the
                    AI more project context.
                  </p>
                )}

                {attachments.length > 0 && (
                  <div className="space-y-2 mb-3">
                    {attachments.map((a) => (
                      <div
                        key={a.id}
                        className="flex items-center justify-between p-3 rounded-lg"
                        style={{
                          backgroundColor: 'var(--neutral-50)',
                          border: '1px solid var(--border)',
                        }}
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <FileText
                            size={18}
                            style={{ color: 'var(--primary)' }}
                            className="flex-shrink-0"
                          />
                          <div className="min-w-0">
                            <p className="text-sm font-medium truncate">{a.name}</p>
                            <p
                              className="text-xs"
                              style={{ color: 'var(--neutral-500)' }}
                            >
                              {(a.size / 1024).toFixed(1)} KB · existing
                            </p>
                          </div>
                        </div>
                        <button
                          onClick={() => handleRemoveExisting(a.id)}
                          className="p-2 rounded transition-colors hover:bg-gray-200"
                          title="Remove attachment"
                        >
                          <Trash2 size={16} style={{ color: '#DC2626' }} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                {newFiles.length > 0 && (
                  <div className="space-y-2 mb-3">
                    {newFiles.map((file, idx) => (
                      <div
                        key={idx}
                        className="flex items-center justify-between p-3 rounded-lg"
                        style={{
                          backgroundColor: '#faf5ff',
                          border: '1px dashed var(--primary)',
                        }}
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <FileText
                            size={18}
                            style={{ color: 'var(--primary)' }}
                            className="flex-shrink-0"
                          />
                          <div className="min-w-0">
                            <p className="text-sm font-medium truncate">{file.name}</p>
                            <p
                              className="text-xs"
                              style={{ color: 'var(--neutral-500)' }}
                            >
                              {(file.size / 1024).toFixed(1)} KB · pending save
                            </p>
                          </div>
                        </div>
                        <button
                          onClick={() =>
                            setNewFiles((prev) => prev.filter((_, i) => i !== idx))
                          }
                          className="p-2 rounded transition-colors hover:bg-gray-200"
                        >
                          <X size={16} style={{ color: 'var(--neutral-500)' }} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                <input
                  type="file"
                  ref={fileInputRef}
                  accept=".pdf,.md,.txt"
                  multiple
                  onChange={handleFileAdd}
                  className="hidden"
                />
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full rounded-lg p-4 text-center transition-colors flex items-center justify-center gap-2"
                  style={{
                    border: '2px dashed var(--border)',
                    color: 'var(--primary)',
                  }}
                  onMouseEnter={(e) =>
                    (e.currentTarget.style.borderColor = 'var(--primary)')
                  }
                  onMouseLeave={(e) =>
                    (e.currentTarget.style.borderColor = 'var(--border)')
                  }
                >
                  <Upload size={18} />
                  <span className="text-sm font-medium">Add files</span>
                </button>
              </div>
            </div>

            <div
              className="px-6 py-4 flex gap-3 flex-shrink-0"
              style={{ borderTop: '1px solid var(--border)' }}
            >
              <button
                onClick={onClose}
                className="btn-secondary flex-1 justify-center"
                disabled={isSaving}
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                className="btn-primary flex-1 justify-center"
                disabled={isSaving}
              >
                {isSaving ? 'Saving…' : 'Save Changes'}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
