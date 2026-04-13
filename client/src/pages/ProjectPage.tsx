import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useProjectStore } from '../stores/projectStore';
import { useDocumentStore } from '../stores/documentStore';
import { projects, documents } from '../services/api';
import Badge from '../components/ui/Badge';
import Modal from '../components/ui/Modal';
import {
  ArrowLeft,
  Plus,
  Edit2,
  Trash2,
  ChevronDown,
  Copy,
} from 'lucide-react';
import toast from 'react-hot-toast';

export default function ProjectPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [isLoading, setIsLoading] = useState(true);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isContextExpanded, setIsContextExpanded] = useState(false);
  const [filterType, setFilterType] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState<string | null>(null);

  const currentProject = useProjectStore((s) => s.currentProject);
  const setCurrentProject = useProjectStore((s) => s.setCurrentProject);
  const docList = useDocumentStore((s) => s.documents);
  const setDocuments = useDocumentStore((s) => s.setDocuments);

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
  let filteredDocs = projectDocs;

  if (filterType) {
    filteredDocs = filteredDocs.filter((d) => d.type === filterType);
  }
  if (filterStatus) {
    filteredDocs = filteredDocs.filter((d) => d.status === filterStatus);
  }

  const handleDeleteProject = async () => {
    if (!id) return;

    try {
      await projects.delete(id);
      toast.success('Project deleted');
      navigate('/dashboard');
    } catch (err) {
      toast.error('Failed to delete project');
    } finally {
      setIsDeleteModalOpen(false);
    }
  };

  const handleDeleteDocument = async (docId: string) => {
    try {
      await documents.delete(docId);
      const updatedDocs = docList.filter((d) => d.id !== docId);
      setDocuments(updatedDocs);
      toast.success('Document deleted');
    } catch (err) {
      toast.error('Failed to delete document');
    }
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor(diff / (1000 * 60));

    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    if (days === 1) return 'yesterday';
    if (days < 30) return `${days}d ago`;

    return date.toLocaleDateString();
  };

  if (isLoading) {
    return (
      <div className="p-8">
        <div className="h-8 shimmer rounded-lg w-32 mb-6" />
        <div className="card p-6">
          <div className="space-y-3">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-16 shimmer rounded-lg" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (!currentProject) {
    return (
      <div className="p-8 text-center">
        <p className="text-gray-600">Project not found</p>
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
    <div className="p-8">
      <button
        onClick={() => navigate('/dashboard')}
        className="flex items-center gap-2 text-telus-purple hover:text-telus-purple/80 mb-6 transition"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to Dashboard
      </button>

      <div className="flex items-start justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            {currentProject.name}
          </h1>
          {currentProject.description && (
            <p className="text-gray-600">{currentProject.description}</p>
          )}
        </div>

        <div className="flex gap-2">
          <button
            onClick={() => navigate(`/documents/new`)}
            className="btn-primary"
          >
            <Plus className="w-4 h-4" />
            New Document
          </button>

          <button
            onClick={() => {
              // Edit project
            }}
            className="btn-secondary"
          >
            <Edit2 className="w-4 h-4" />
          </button>

          <button
            onClick={() => setIsDeleteModalOpen(true)}
            className="btn-danger"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      <Modal
        isOpen={isDeleteModalOpen}
        onClose={() => setIsDeleteModalOpen(false)}
        title="Delete Project"
      >
        <p className="text-gray-700 mb-4">
          Are you sure you want to delete this project? This action cannot be
          undone. All documents in this project will be deleted.
        </p>
        <div className="flex gap-3">
          <button
            onClick={() => setIsDeleteModalOpen(false)}
            className="btn-secondary flex-1 justify-center"
          >
            Cancel
          </button>
          <button
            onClick={handleDeleteProject}
            className="btn-danger flex-1 justify-center"
          >
            Delete
          </button>
        </div>
      </Modal>

      <div className="card p-6 mb-8">
        <button
          onClick={() => setIsContextExpanded(!isContextExpanded)}
          className="w-full flex items-center justify-between p-4 -m-4 rounded-lg hover:bg-gray-50 transition"
        >
          <h2 className="text-lg font-semibold text-gray-900">
            Client Context
          </h2>
          <ChevronDown
            className={`w-5 h-5 text-gray-600 transition ${
              isContextExpanded ? 'rotate-180' : ''
            }`}
          />
        </button>

        {isContextExpanded && (
          <div className="mt-4 pt-4 border-t border-gray-200">
            <p className="text-gray-700 whitespace-pre-line">
              {currentProject.clientContext}
            </p>
            <button
              onClick={() => {
                navigator.clipboard.writeText(currentProject.clientContext);
                toast.success('Copied to clipboard');
              }}
              className="flex items-center gap-2 text-sm text-telus-purple hover:text-telus-purple/80 mt-4"
            >
              <Copy className="w-4 h-4" />
              Copy to Clipboard
            </button>
          </div>
        )}
      </div>

      <div className="card p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-semibold text-gray-900">Documents</h2>
          <div className="flex gap-2">
            <select
              value={filterType || ''}
              onChange={(e) => setFilterType(e.target.value || null)}
              className="input text-sm w-40"
            >
              <option value="">All Types</option>
              <option value="PRD">PRD</option>
              <option value="USER_STORIES">User Stories</option>
              <option value="TECHNICAL_SPEC">Technical Spec</option>
              <option value="PRODUCT_BRIEF">Product Brief</option>
              <option value="ROADMAP">Roadmap</option>
              <option value="OKRS">OKRs</option>
            </select>

            <select
              value={filterStatus || ''}
              onChange={(e) => setFilterStatus(e.target.value || null)}
              className="input text-sm w-40"
            >
              <option value="">All Statuses</option>
              <option value="DRAFT">Draft</option>
              <option value="IN_REVIEW">In Review</option>
              <option value="APPROVED">Approved</option>
              <option value="ARCHIVED">Archived</option>
            </select>
          </div>
        </div>

        {filteredDocs.length === 0 ? (
          <div className="py-12 text-center">
            <p className="text-gray-600 mb-4">No documents found</p>
            <button
              onClick={() => navigate(`/documents/new`)}
              className="btn-primary"
            >
              <Plus className="w-4 h-4" />
              Create First Document
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-gray-200">
                <tr>
                  <th className="text-left py-3 px-4 font-semibold text-gray-700">
                    Title
                  </th>
                  <th className="text-left py-3 px-4 font-semibold text-gray-700">
                    Type
                  </th>
                  <th className="text-left py-3 px-4 font-semibold text-gray-700">
                    Status
                  </th>
                  <th className="text-left py-3 px-4 font-semibold text-gray-700">
                    Author
                  </th>
                  <th className="text-left py-3 px-4 font-semibold text-gray-700">
                    Updated
                  </th>
                  <th className="text-left py-3 px-4 font-semibold text-gray-700">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {filteredDocs.map((doc) => (
                  <tr
                    key={doc.id}
                    className="hover:bg-gray-50 transition"
                  >
                    <td className="py-3 px-4">
                      <button
                        onClick={() => navigate(`/documents/${doc.id}`)}
                        className="text-telus-purple hover:underline font-medium"
                      >
                        {doc.title}
                      </button>
                    </td>
                    <td className="py-3 px-4">
                      <Badge type="type" value={doc.type} />
                    </td>
                    <td className="py-3 px-4">
                      <Badge type="status" value={doc.status} />
                    </td>
                    <td className="py-3 px-4 text-gray-600">
                      {doc.author?.name || 'Unknown'}
                    </td>
                    <td className="py-3 px-4 text-gray-500">
                      {formatDate(doc.updatedAt)}
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex gap-2">
                        <button
                          onClick={() => navigate(`/documents/${doc.id}`)}
                          className="text-telus-purple hover:text-telus-purple/80 transition"
                          title="Open"
                        >
                          Open
                        </button>
                        <button
                          onClick={() => handleDeleteDocument(doc.id)}
                          className="text-red-600 hover:text-red-700 transition"
                          title="Delete"
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
