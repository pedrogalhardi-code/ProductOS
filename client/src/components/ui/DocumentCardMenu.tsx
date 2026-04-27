import { useEffect, useRef, useState } from 'react';
import { MoreVertical, Pencil, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { documents } from '../../services/api';
import { useDocumentStore } from '../../stores/documentStore';
import Modal from './Modal';
import type { DocumentDto } from '@shared/types';

/**
 * Three-dot action menu shown on document cards. Supports Rename and Delete.
 * Stops link navigation when the button / menu items are clicked.
 */
export default function DocumentCardMenu({ doc }: { doc: DocumentDto }) {
  const [open, setOpen] = useState(false);
  const [renameOpen, setRenameOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [title, setTitle] = useState(doc.title);
  const [busy, setBusy] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const setDocuments = useDocumentStore((s) => s.setDocuments);
  const updateDocumentInStore = useDocumentStore((s) => s.updateDocument);
  const docList = useDocumentStore((s) => s.documents);

  useEffect(() => {
    setTitle(doc.title);
  }, [doc.title]);

  // Close the dropdown when clicking outside of it.
  useEffect(() => {
    if (!open) return;
    const onDocClick = (e: MouseEvent) => {
      if (!menuRef.current?.contains(e.target as Node)) setOpen(false);
    };
    window.addEventListener('mousedown', onDocClick);
    return () => window.removeEventListener('mousedown', onDocClick);
  }, [open]);

  const stopLink = (e: React.MouseEvent | React.KeyboardEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleRename = async () => {
    const trimmed = title.trim();
    if (!trimmed || trimmed === doc.title) {
      setRenameOpen(false);
      return;
    }
    setBusy(true);
    try {
      const res = await documents.update(doc.id, { title: trimmed });
      updateDocumentInStore(res.data.data);
      toast.success('Document renamed');
      setRenameOpen(false);
    } catch {
      toast.error('Failed to rename document');
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = async () => {
    setBusy(true);
    try {
      await documents.delete(doc.id);
      setDocuments(docList.filter((d) => d.id !== doc.id));
      toast.success('Document deleted');
      setDeleteOpen(false);
    } catch {
      toast.error('Failed to delete document');
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <div
        ref={menuRef}
        className="relative"
        onClick={stopLink}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <button
          onClick={(e) => {
            stopLink(e);
            setOpen((v) => !v);
          }}
          className="p-1 rounded transition-colors hover:bg-gray-100"
          style={{ color: 'var(--neutral-400)' }}
          aria-label="Document actions"
        >
          <MoreVertical size={16} />
        </button>
        {open && (
          <div
            className="absolute right-0 top-full mt-1 z-20 min-w-[140px] bg-white rounded-lg shadow-lg overflow-hidden"
            style={{ border: '1px solid var(--border)' }}
          >
            <button
              onClick={(e) => {
                stopLink(e);
                setOpen(false);
                setTitle(doc.title);
                setRenameOpen(true);
              }}
              className="w-full flex items-center gap-2 px-3 py-2 text-sm text-left hover:bg-gray-50"
            >
              <Pencil size={14} />
              Rename
            </button>
            <button
              onClick={(e) => {
                stopLink(e);
                setOpen(false);
                setDeleteOpen(true);
              }}
              className="w-full flex items-center gap-2 px-3 py-2 text-sm text-left hover:bg-red-50"
              style={{ color: '#DC2626' }}
            >
              <Trash2 size={14} />
              Delete
            </button>
          </div>
        )}
      </div>

      <Modal
        isOpen={renameOpen}
        onClose={() => setRenameOpen(false)}
        title="Rename Document"
      >
        <div className="space-y-4">
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                handleRename();
              }
            }}
            className="input"
            autoFocus
          />
          <div className="flex gap-3">
            <button
              onClick={() => setRenameOpen(false)}
              className="btn-secondary flex-1 justify-center"
              disabled={busy}
            >
              Cancel
            </button>
            <button
              onClick={handleRename}
              className="btn-primary flex-1 justify-center"
              disabled={busy || !title.trim()}
            >
              {busy ? 'Saving…' : 'Save'}
            </button>
          </div>
        </div>
      </Modal>

      <Modal
        isOpen={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        title="Delete Document"
      >
        <p className="text-gray-700 mb-4">
          Are you sure you want to delete <strong>{doc.title}</strong>? This action cannot
          be undone.
        </p>
        <div className="flex gap-3">
          <button
            onClick={() => setDeleteOpen(false)}
            className="btn-secondary flex-1 justify-center"
            disabled={busy}
          >
            Cancel
          </button>
          <button
            onClick={handleDelete}
            className="btn-danger flex-1 justify-center"
            disabled={busy}
          >
            {busy ? 'Deleting…' : 'Delete'}
          </button>
        </div>
      </Modal>
    </>
  );
}
