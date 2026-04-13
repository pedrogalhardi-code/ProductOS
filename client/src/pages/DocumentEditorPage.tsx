import { useEffect, useState, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useDocumentStore } from '../stores/documentStore';
import { documents, streamReview } from '../services/api';
import RichEditor from '../components/editor/RichEditor';
import CPOReviewDrawer from '../components/editor/CPOReviewDrawer';
import Modal from '../components/ui/Modal';
import Badge from '../components/ui/Badge';
import {
  ArrowLeft,
  Eye,
  Download,
  Send,
  Clock,
  ExternalLink,
  Menu,
  ChevronDown,
} from 'lucide-react';
import toast from 'react-hot-toast';
import type { DocumentStatus, ExportFormat } from '@shared/types';

export default function DocumentEditorPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [isLoading, setIsLoading] = useState(true);
  const [isExporting, setIsExporting] = useState(false);
  const [isJiraModalOpen, setIsJiraModalOpen] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [showComments, _setShowComments] = useState(false);
  const [statusDropdownOpen, setStatusDropdownOpen] = useState(false);

  const currentDoc = useDocumentStore((s) => s.currentDocument);
  const setCurrentDocument = useDocumentStore((s) => s.setCurrentDocument);
  const updateDocument = useDocumentStore((s) => s.updateDocument);
  const setIsReviewing = useDocumentStore((s) => s.setIsReviewing);
  const setReviewOpen = useDocumentStore((s) => s.setReviewOpen);
  const appendReviewContent = useDocumentStore((s) => s.appendReviewContent);
  const clearReviewContent = useDocumentStore((s) => s.clearReviewContent);

  const saveTimeoutRef = useRef<NodeJS.Timeout>();
  const reviewCleanupRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    if (!id) return;

    const loadDoc = async () => {
      try {
        const response = await documents.get(id);
        setCurrentDocument(response.data.data);
        setLastSaved(new Date());
      } catch (err) {
        toast.error('Failed to load document');
        navigate('/dashboard');
      } finally {
        setIsLoading(false);
      }
    };

    loadDoc();
  }, [id, setCurrentDocument, navigate]);

  const handleContentChange = (content: string) => {
    if (!currentDoc) return;

    const updatedDoc = { ...currentDoc, content };
    setCurrentDocument(updatedDoc);

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

  const handleStatusChange = async (newStatus: DocumentStatus) => {
    if (!currentDoc) return;

    try {
      const response = await documents.update(id!, { status: newStatus });
      updateDocument(response.data.data);
      setCurrentDocument(response.data.data);
      setStatusDropdownOpen(false);
      toast.success(`Status updated to ${newStatus}`);
    } catch (err) {
      toast.error('Failed to update status');
    }
  };

  const handleReview = () => {
    if (!id || !currentDoc) return;

    clearReviewContent();
    setIsReviewing(true);
    setReviewOpen(true);

    reviewCleanupRef.current = streamReview(
      id,
      (delta) => appendReviewContent(delta),
      (_section) => {
        // section heading arrived — CPOReviewDrawer renders this automatically
      },
      (_fullContent) => {
        setIsReviewing(false);
      },
      (error) => {
        toast.error(`Review failed: ${error}`);
        setIsReviewing(false);
      }
    );
  };

  const handleExport = async (format: ExportFormat) => {
    if (!id) return;

    setIsExporting(true);
    try {
      const response = await documents.export(id, { format });

      if (format === 'PDF') {
        const url = window.URL.createObjectURL(new Blob([response.data]));
        const link = document.createElement('a');
        link.href = url;
        link.setAttribute('download', `${currentDoc?.title || 'document'}.pdf`);
        document.body.appendChild(link);
        link.click();
        link.parentNode?.removeChild(link);
      } else {
        toast.success(`Document exported as ${format}`);
      }
    } catch (err) {
      toast.error(`Failed to export as ${format}`);
    } finally {
      setIsExporting(false);
    }
  };

  const formatLastSaved = () => {
    if (!lastSaved) return 'Never';
    const now = new Date();
    const diff = now.getTime() - lastSaved.getTime();
    const seconds = Math.floor(diff / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);

    if (seconds < 60) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    return lastSaved.toLocaleDateString();
  };

  if (isLoading) {
    return (
      <div className="p-8">
        <div className="h-8 shimmer rounded-lg w-48 mb-6" />
        <div className="card p-6 h-96 shimmer" />
      </div>
    );
  }

  if (!currentDoc) {
    return (
      <div className="p-8 text-center">
        <p className="text-gray-600">Document not found</p>
        <button
          onClick={() => navigate('/dashboard')}
          className="btn-primary mt-4"
        >
          Back to Dashboard
        </button>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col bg-gray-50 overflow-hidden">
      <header className="bg-white border-b border-gray-200 px-8 py-4">
        <div className="flex items-center justify-between mb-4">
          <button
            onClick={() => navigate(-1)}
            className="text-telus-purple hover:text-telus-purple/80 transition"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>

          <div className="flex-1 mx-6">
            <input
              type="text"
              value={currentDoc.title}
              onChange={(e) => {
                const updated = { ...currentDoc, title: e.target.value };
                setCurrentDocument(updated);
              }}
              onBlur={() => {
                documents.update(id!, { title: currentDoc.title });
              }}
              className="text-2xl font-bold text-gray-900 bg-transparent border-none p-0 focus:outline-none w-full"
            />
          </div>

          <div className="flex items-center gap-3">
            <Badge type="status" value={currentDoc.status} />
            <div className="relative">
              <button
                onClick={() => setStatusDropdownOpen(!statusDropdownOpen)}
                className="btn-secondary text-xs"
              >
                <ChevronDown className="w-4 h-4" />
              </button>
              {statusDropdownOpen && (
                <div className="absolute right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-10">
                  {(['DRAFT', 'IN_REVIEW', 'APPROVED', 'ARCHIVED'] as const).map(
                    (status) => (
                      <button
                        key={status}
                        onClick={() => handleStatusChange(status)}
                        className="block w-full text-left px-4 py-2 text-sm hover:bg-gray-50 first:rounded-t-lg last:rounded-b-lg"
                      >
                        {status.replace('_', ' ')}
                      </button>
                    )
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4 text-sm text-gray-600">
            <div className="flex items-center gap-1">
              <Clock className="w-4 h-4" />
              <span>Last saved {formatLastSaved()}</span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleReview}
              className="btn-secondary"
              title="Review like a CPO"
            >
              <Eye className="w-4 h-4" />
              Review
            </button>

            <div className="relative group">
              <button className="btn-secondary" title="Export">
                <Download className="w-4 h-4" />
                <Menu className="w-4 h-4" />
              </button>
              <div className="absolute right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition z-10">
                {(['PDF', 'MARKDOWN', 'CONFLUENCE', 'GOOGLE_DRIVE'] as const).map(
                  (format) => (
                    <button
                      key={format}
                      onClick={() => handleExport(format)}
                      disabled={isExporting}
                      className="block w-full text-left px-4 py-2 text-sm hover:bg-gray-50 first:rounded-t-lg last:rounded-b-lg"
                    >
                      Export as {format}
                    </button>
                  )
                )}
              </div>
            </div>

            <button
              onClick={() => setIsJiraModalOpen(true)}
              className="btn-secondary"
              title="Push to Jira"
            >
              <Send className="w-4 h-4" />
              Jira
            </button>

            <button
              onClick={() => navigate(`/documents/${id}/versions`)}
              className="btn-secondary"
              title="Version history"
            >
              <Clock className="w-4 h-4" />
            </button>

            {currentDoc.figmaFileUrl && (
              <a
                href={currentDoc.figmaFileUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="btn-secondary"
              >
                <ExternalLink className="w-4 h-4" />
                Figma
              </a>
            )}
          </div>
        </div>
      </header>

      <Modal
        isOpen={isJiraModalOpen}
        onClose={() => setIsJiraModalOpen(false)}
        title="Push to Jira"
      >
        <div className="space-y-4">
          <div>
            <label className="label">Project Key</label>
            <input type="text" placeholder="e.g., PROJ-123" className="input" />
          </div>
          <div>
            <label className="label">Epic Name (Optional)</label>
            <input type="text" placeholder="Feature name" className="input" />
          </div>
          <button
            onClick={() => {
              toast.success('Pushed to Jira');
              setIsJiraModalOpen(false);
            }}
            className="btn-primary w-full justify-center"
          >
            Push Stories
          </button>
        </div>
      </Modal>

      <div className="flex-1 flex overflow-hidden">
        <div className="flex-1 flex flex-col overflow-hidden">
          <div className="flex-1 p-8 overflow-auto">
            <RichEditor
              content={currentDoc.content}
              onChange={handleContentChange}
              placeholder="Start editing your document..."
            />
          </div>

          {showComments && (
            <div className="border-t border-gray-200 bg-white p-6 max-h-48 overflow-y-auto">
              <h3 className="font-semibold text-gray-900 mb-4">Comments</h3>
              <div className="text-sm text-gray-600 text-center py-6">
                No comments yet
              </div>
            </div>
          )}
        </div>

        <CPOReviewDrawer />
      </div>
    </div>
  );
}
