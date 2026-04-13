import { useCallback, useEffect, useState } from 'react';
import { integrations } from '../../services/api';
import Modal from '../ui/Modal';
import { ChevronRight, Folder, Loader2 } from 'lucide-react';
import type { DriveBrowseItemDto } from '@shared/types';

type Crumb = { id: string; name: string };

interface DriveFolderPickerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectFolder: (folderId: string, folderName: string) => void;
}

export default function DriveFolderPickerModal({
  isOpen,
  onClose,
  onSelectFolder,
}: DriveFolderPickerModalProps) {
  const [crumbs, setCrumbs] = useState<Crumb[]>([]);
  const [items, setItems] = useState<DriveBrowseItemDto[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const parentId = crumbs.length === 0 ? 'root' : crumbs[crumbs.length - 1].id;

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await integrations.googleDriveBrowse(parentId === 'root' ? undefined : parentId);
      setItems(res.data.data.items);
    } catch {
      setError('Could not load Google Drive. Connect Google Drive in Settings and try again.');
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [parentId]);

  useEffect(() => {
    if (!isOpen) {
      setCrumbs([]);
      setItems([]);
      setError(null);
      return;
    }
    load();
  }, [isOpen, load]);

  const enterFolder = (item: DriveBrowseItemDto) => {
    if (item.mimeType !== 'application/vnd.google-apps.folder') return;
    setCrumbs((c) => [...c, { id: item.id, name: item.name }]);
  };

  const goUp = () => {
    setCrumbs((c) => c.slice(0, -1));
  };

  const currentFolderName = crumbs.length === 0 ? 'My Drive' : crumbs[crumbs.length - 1].name;

  const handleUseThisFolder = () => {
    onSelectFolder(parentId, currentFolderName);
    onClose();
  };

  const folders = items.filter((i) => i.mimeType === 'application/vnd.google-apps.folder');

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Choose a Google Drive folder">
      <div className="space-y-4">
        <p className="text-sm text-gray-600">
          Text files and Google Docs under this folder (and subfolders, within limits) are merged into
          project AI context when you sync.
        </p>

        <div className="flex flex-wrap items-center gap-1 text-sm text-gray-700">
          <button type="button" className="text-telus-purple hover:underline" onClick={() => setCrumbs([])}>
            My Drive
          </button>
          {crumbs.map((c, idx) => (
            <span key={c.id} className="flex items-center gap-1">
              <ChevronRight className="w-4 h-4 text-gray-400" />
              <button
                type="button"
                className="text-telus-purple hover:underline truncate max-w-[140px]"
                onClick={() => setCrumbs(crumbs.slice(0, idx + 1))}
              >
                {c.name}
              </button>
            </span>
          ))}
        </div>

        {crumbs.length > 0 && (
          <button type="button" className="text-sm text-gray-600 hover:text-gray-900" onClick={goUp}>
            ↑ Up one level
          </button>
        )}

        {error && <p className="text-sm text-red-600">{error}</p>}

        <div className="border border-gray-200 rounded-lg max-h-64 overflow-y-auto divide-y divide-gray-100">
          {loading ? (
            <div className="flex items-center justify-center py-12 text-gray-500 gap-2">
              <Loader2 className="w-5 h-5 animate-spin" />
              Loading…
            </div>
          ) : folders.length === 0 ? (
            <p className="p-4 text-sm text-gray-500">No subfolders here. Use this folder or go elsewhere.</p>
          ) : (
            folders.map((f) => (
              <button
                key={f.id}
                type="button"
                onClick={() => enterFolder(f)}
                className="w-full flex items-center gap-2 px-3 py-2.5 text-left text-sm hover:bg-gray-50"
              >
                <Folder className="w-4 h-4 text-amber-500 shrink-0" />
                <span className="truncate">{f.name}</span>
              </button>
            ))
          )}
        </div>

        <div className="flex gap-2 justify-end pt-2">
          <button type="button" className="btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button type="button" className="btn-primary" onClick={handleUseThisFolder} disabled={loading}>
            Use “{currentFolderName}”
          </button>
        </div>
      </div>
    </Modal>
  );
}
