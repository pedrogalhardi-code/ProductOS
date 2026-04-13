import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { documents } from '../services/api';
import RichEditor from '../components/editor/RichEditor';
import Modal from '../components/ui/Modal';
import { ArrowLeft, RotateCcw } from 'lucide-react';
import toast from 'react-hot-toast';
import type { DocVersionDto } from '@shared/types';

export default function VersionHistoryPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [isLoading, setIsLoading] = useState(true);
  const [versions, setVersions] = useState<DocVersionDto[]>([]);
  const [selectedVersion, setSelectedVersion] = useState<DocVersionDto | null>(
    null
  );
  const [isRestoreModalOpen, setIsRestoreModalOpen] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);

  useEffect(() => {
    if (!id) return;

    const loadVersions = async () => {
      try {
        const response = await documents.versions(id);
        const versionList = response.data.data || [];
        setVersions(versionList);
        if (versionList.length > 0) {
          setSelectedVersion(versionList[0]);
        }
      } catch (err) {
        toast.error('Failed to load versions');
        navigate(`/documents/${id}`);
      } finally {
        setIsLoading(false);
      }
    };

    loadVersions();
  }, [id, navigate]);

  const handleRestoreVersion = async () => {
    if (!id || !selectedVersion) return;

    setIsRestoring(true);
    try {
      await documents.restoreVersion(id, selectedVersion.id);
      toast.success('Version restored successfully');
      setIsRestoreModalOpen(false);
      navigate(`/documents/${id}`);
    } catch (err) {
      toast.error('Failed to restore version');
    } finally {
      setIsRestoring(false);
    }
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  if (isLoading) {
    return (
      <div className="p-8">
        <div className="h-8 shimmer rounded-lg w-48 mb-6" />
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="space-y-3">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-20 shimmer rounded-lg" />
            ))}
          </div>
          <div className="lg:col-span-2 h-96 shimmer rounded-lg" />
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col bg-gray-50 overflow-hidden">
      <header className="bg-white border-b border-gray-200 px-8 py-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate(-1)}
            className="text-telus-purple hover:text-telus-purple/80 transition"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="text-2xl font-bold text-gray-900">Version History</h1>
        </div>

        {selectedVersion && (
          <button
            onClick={() => setIsRestoreModalOpen(true)}
            className="btn-primary"
          >
            <RotateCcw className="w-4 h-4" />
            Restore This Version
          </button>
        )}
      </header>

      <Modal
        isOpen={isRestoreModalOpen}
        onClose={() => setIsRestoreModalOpen(false)}
        title="Restore Version"
      >
        <p className="text-gray-700 mb-4">
          Are you sure you want to restore this version? The current version
          will be saved as a new version.
        </p>
        <div className="flex gap-3">
          <button
            onClick={() => setIsRestoreModalOpen(false)}
            className="btn-secondary flex-1 justify-center"
          >
            Cancel
          </button>
          <button
            onClick={handleRestoreVersion}
            disabled={isRestoring}
            className="btn-primary flex-1 justify-center"
          >
            {isRestoring ? 'Restoring...' : 'Restore'}
          </button>
        </div>
      </Modal>

      <div className="flex-1 flex overflow-hidden">
        <div className="w-80 border-r border-gray-200 bg-white overflow-y-auto">
          <div className="p-6 space-y-2">
            {versions.length === 0 ? (
              <p className="text-sm text-gray-500 text-center py-8">
                No versions found
              </p>
            ) : (
              versions.map((version) => (
                <button
                  key={version.id}
                  onClick={() => setSelectedVersion(version)}
                  className={`w-full text-left p-4 rounded-lg border-2 transition ${
                    selectedVersion?.id === version.id
                      ? 'border-telus-purple bg-telus-purple/5'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <p className="text-sm font-medium text-gray-900">
                    {version.label || `Version ${version.id.slice(0, 8)}`}
                  </p>
                  <p className="text-xs text-gray-500 mt-1">
                    {formatDate(version.createdAt)}
                  </p>
                  {version.author && (
                    <p className="text-xs text-gray-400 mt-1">
                      by {version.author.name}
                    </p>
                  )}
                </button>
              ))
            )}
          </div>
        </div>

        <div className="flex-1 p-8 overflow-auto">
          {selectedVersion ? (
            <RichEditor
              content={selectedVersion.content}
              onChange={() => {}}
              editable={false}
              placeholder="No content"
            />
          ) : (
            <div className="flex items-center justify-center h-full">
              <p className="text-gray-500">Select a version to view</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
