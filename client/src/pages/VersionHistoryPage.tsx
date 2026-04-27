import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { motion } from 'motion/react';
import { ArrowLeft, ChevronRight, Eye, RotateCcw } from 'lucide-react';
import toast from 'react-hot-toast';
import { useDocumentStore } from '../stores/documentStore';
import { useProjectStore } from '../stores/projectStore';
import { documents, projects } from '../services/api';
import Modal from '../components/ui/Modal';
import type { DocVersionDto } from '@shared/types';

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

function formatFull(dateStr: string) {
  return new Date(dateStr).toLocaleString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function VersionHistoryPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [isLoading, setIsLoading] = useState(true);
  const [versions, setVersions] = useState<DocVersionDto[]>([]);
  const [previewVersion, setPreviewVersion] = useState<DocVersionDto | null>(null);
  const [pendingRestore, setPendingRestore] = useState<DocVersionDto | null>(null);
  const [isRestoring, setIsRestoring] = useState(false);

  const currentDoc = useDocumentStore((s) => s.currentDocument);
  const setCurrentDocument = useDocumentStore((s) => s.setCurrentDocument);
  const currentProject = useProjectStore((s) => s.currentProject);
  const setCurrentProject = useProjectStore((s) => s.setCurrentProject);

  useEffect(() => {
    if (!id) return;
    const load = async () => {
      try {
        const [versionsRes, docRes] = await Promise.all([
          documents.versions(id),
          documents.get(id),
        ]);
        setVersions(versionsRes.data.data || []);
        setCurrentDocument(docRes.data.data);
        if (docRes.data.data.projectId) {
          const projRes = await projects.get(docRes.data.data.projectId);
          setCurrentProject(projRes.data.data);
        }
      } catch (err) {
        toast.error('Failed to load versions');
        navigate(`/documents/${id}`);
      } finally {
        setIsLoading(false);
      }
    };
    load();
  }, [id, navigate, setCurrentDocument, setCurrentProject]);

  const handleRestoreVersion = async () => {
    if (!id || !pendingRestore) return;
    setIsRestoring(true);
    try {
      await documents.restoreVersion(id, pendingRestore.id);
      toast.success('Version restored');
      navigate(`/documents/${id}`);
    } catch (err) {
      toast.error('Failed to restore version');
    } finally {
      setIsRestoring(false);
      setPendingRestore(null);
    }
  };

  const annotatedVersions = useMemo(
    () =>
      versions.map((v, idx) => ({
        ...v,
        display: `v${versions.length - idx}`,
        isCurrent: idx === 0,
      })),
    [versions]
  );

  if (isLoading) {
    return (
      <div className="p-8">
        <div className="max-w-5xl mx-auto">
          <div className="h-6 w-48 shimmer rounded mb-6" />
          <div className="card p-8">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-24 shimmer rounded-lg mb-4" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8">
      <div className="max-w-5xl mx-auto">
        <Link
          to={`/documents/${id}`}
          className="flex items-center gap-2 mb-6 transition-colors"
          style={{ color: 'var(--neutral-600)' }}
        >
          <ArrowLeft size={18} />
          Back to Document
        </Link>

        <div
          className="flex items-center gap-2 text-sm mb-6 flex-wrap"
          style={{ color: 'var(--neutral-500)' }}
        >
          <Link to="/dashboard">Dashboard</Link>
          <ChevronRight size={14} />
          {currentProject && (
            <>
              <Link to={`/projects/${currentProject.id}`}>{currentProject.name}</Link>
              <ChevronRight size={14} />
            </>
          )}
          {currentDoc && (
            <>
              <Link to={`/documents/${id}`}>{currentDoc.title}</Link>
              <ChevronRight size={14} />
            </>
          )}
          <span style={{ color: 'var(--neutral-900)' }}>Version History</span>
        </div>

        <div className="mb-8">
          <h1 className="text-3xl font-semibold mb-2">Version History</h1>
          <p style={{ color: 'var(--neutral-500)' }}>
            View and restore previous versions of this document
          </p>
        </div>

        {annotatedVersions.length === 0 ? (
          <div className="card p-12 text-center">
            <p style={{ color: 'var(--neutral-500)' }}>
              No previous versions found
            </p>
          </div>
        ) : (
          <div className="card p-8">
            {annotatedVersions.map((version, index) => (
              <motion.div
                key={version.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
                className="relative"
              >
                {index < annotatedVersions.length - 1 && (
                  <div
                    className="absolute left-5 top-12 w-0.5 h-full"
                    style={{ backgroundColor: 'var(--border)' }}
                  />
                )}

                <div
                  className="flex gap-6 pb-8"
                  style={
                    version.isCurrent
                      ? {
                          borderLeft: '4px solid var(--primary)',
                          marginLeft: '-1px',
                          paddingLeft: '21px',
                        }
                      : undefined
                  }
                >
                  <div className="flex-shrink-0">
                    <div
                      className="w-10 h-10 rounded-full flex items-center justify-center font-semibold text-sm"
                      style={
                        version.isCurrent
                          ? {
                              backgroundColor: 'var(--primary)',
                              color: '#fff',
                              boxShadow: '0 0 0 4px rgba(75, 40, 109, 0.15)',
                            }
                          : {
                              backgroundColor: 'var(--neutral-100)',
                              color: 'var(--neutral-700)',
                            }
                      }
                    >
                      {version.display}
                    </div>
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0">
                        <div className="flex items-center gap-3 mb-1 flex-wrap">
                          <div className="flex items-center gap-2">
                            <div className="w-6 h-6 rounded-full gradient-mark flex items-center justify-center">
                              <span className="text-white text-[10px] font-medium">
                                {initials(version.author?.name)}
                              </span>
                            </div>
                            <span className="font-medium">
                              {version.author?.name || 'Unknown'}
                            </span>
                          </div>
                          <span
                            className="text-sm"
                            style={{ color: 'var(--neutral-500)' }}
                          >
                            {formatRelative(version.createdAt)}
                          </span>
                          {(version.isCurrent || version.label) && (
                            <span
                              className="px-2 py-0.5 rounded text-xs font-medium"
                              style={
                                version.isCurrent
                                  ? {
                                      backgroundColor: 'var(--primary)',
                                      color: '#fff',
                                    }
                                  : {
                                      backgroundColor: 'var(--neutral-200)',
                                      color: 'var(--neutral-700)',
                                    }
                              }
                            >
                              {version.isCurrent ? 'Current' : version.label}
                            </span>
                          )}
                        </div>
                        {version.changes && (
                          <p
                            className="text-sm"
                            style={{ color: 'var(--neutral-600)' }}
                          >
                            {version.changes}
                          </p>
                        )}
                        <p
                          className="text-xs mt-1"
                          style={{ color: 'var(--neutral-400)' }}
                        >
                          {formatFull(version.createdAt)}
                        </p>
                      </div>

                      {!version.isCurrent && (
                        <div className="flex gap-2 flex-shrink-0">
                          <button
                            onClick={() => setPreviewVersion(version)}
                            className="px-3 py-1.5 text-sm rounded-lg transition-colors flex items-center gap-1.5 hover:bg-gray-50"
                            style={{ border: '1px solid var(--border)' }}
                          >
                            <Eye size={14} />
                            Preview
                          </button>
                          <button
                            onClick={() => setPendingRestore(version)}
                            className="px-3 py-1.5 text-sm text-white rounded-lg hover:opacity-90 transition-opacity flex items-center gap-1.5"
                            style={{ backgroundColor: 'var(--primary)' }}
                          >
                            <RotateCcw size={14} />
                            Restore
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>

      <Modal
        isOpen={!!pendingRestore}
        onClose={() => setPendingRestore(null)}
        title="Restore Version"
      >
        <p className="text-gray-700 mb-4">
          Are you sure you want to restore this version? The current version will be saved
          as a new version.
        </p>
        <div className="flex gap-3">
          <button
            onClick={() => setPendingRestore(null)}
            className="btn-secondary flex-1 justify-center"
          >
            Cancel
          </button>
          <button
            onClick={handleRestoreVersion}
            disabled={isRestoring}
            className="btn-primary flex-1 justify-center"
          >
            {isRestoring ? 'Restoring…' : 'Restore'}
          </button>
        </div>
      </Modal>

      <Modal
        isOpen={!!previewVersion}
        onClose={() => setPreviewVersion(null)}
        title={`Preview · ${previewVersion?.author?.name || 'Unknown'}`}
      >
        <div className="prose prose-sm max-w-none max-h-96 overflow-y-auto">
          {previewVersion && (
            <div
              dangerouslySetInnerHTML={{ __html: previewVersion.content }}
            />
          )}
        </div>
      </Modal>
    </div>
  );
}
