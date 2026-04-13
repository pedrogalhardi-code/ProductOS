import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDocumentStore } from '../stores/documentStore';
import { useProjectStore } from '../stores/projectStore';
import { documents, projects } from '../services/api';
import Badge from '../components/ui/Badge';
import { Plus, FileText, Folder, Clock } from 'lucide-react';
import toast from 'react-hot-toast';

export default function DashboardPage() {
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(true);

  const docList = useDocumentStore((s) => s.documents);
  const projectList = useProjectStore((s) => s.projects);
  const setDocuments = useDocumentStore((s) => s.setDocuments);
  const setProjects = useProjectStore((s) => s.setProjects);

  useEffect(() => {
    const loadData = async () => {
      try {
        const [docRes, projRes] = await Promise.all([
          documents.list({ limit: '10' }),
          projects.list(),
        ]);
        setDocuments(docRes.data.data || []);
        setProjects(projRes.data.data || []);
      } catch (err) {
        toast.error('Failed to load dashboard data');
      } finally {
        setIsLoading(false);
      }
    };

    loadData();
  }, [setDocuments, setProjects]);

  const recentDocs = docList.slice(0, 6);
  const totalDocs = docList.length;

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

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>
          <p className="text-gray-600 mt-1">Welcome back to ProductOS</p>
        </div>
        <button
          onClick={() => navigate('/projects/new')}
          className="btn-primary"
        >
          <Plus className="w-4 h-4" />
          New Project
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <div className="card p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 mb-1">Total Projects</p>
              <p className="text-3xl font-bold text-gray-900">
                {projectList.length}
              </p>
            </div>
            <Folder className="w-12 h-12 text-telus-purple/20" />
          </div>
        </div>

        <div className="card p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 mb-1">Total Documents</p>
              <p className="text-3xl font-bold text-gray-900">{totalDocs}</p>
            </div>
            <FileText className="w-12 h-12 text-telus-green/20" />
          </div>
        </div>

        <div className="card p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 mb-1">In Review</p>
              <p className="text-3xl font-bold text-gray-900">
                {docList.filter((d) => d.status === 'IN_REVIEW').length}
              </p>
            </div>
            <Clock className="w-12 h-12 text-amber-200" />
          </div>
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-6">
          <div className="card p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">
              Recent Documents
            </h2>
            <div className="space-y-3">
              {[...Array(3)].map((_, i) => (
                <div
                  key={i}
                  className="h-20 shimmer rounded-lg"
                />
              ))}
            </div>
          </div>
        </div>
      ) : recentDocs.length === 0 ? (
        <div className="card p-12 text-center">
          <FileText className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">
            No documents yet
          </h3>
          <p className="text-gray-600 mb-6">
            Create a new project and document to get started
          </p>
          <button
            onClick={() => navigate('/projects/new')}
            className="btn-primary mx-auto"
          >
            <Plus className="w-4 h-4" />
            Create First Project
          </button>
        </div>
      ) : (
        <>
          <div className="card p-6 mb-8">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">
              Recent Documents
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {recentDocs.map((doc) => {
                const proj = projectList.find((p) => p.id === doc.projectId);
                return (
                  <button
                    key={doc.id}
                    onClick={() => navigate(`/documents/${doc.id}`)}
                    className="card p-4 text-left hover:shadow-md transition group"
                  >
                    <div className="flex items-start justify-between mb-3">
                      <Badge type="type" value={doc.type} />
                      <Badge type="status" value={doc.status} />
                    </div>
                    <h3 className="font-semibold text-gray-900 mb-1 line-clamp-2 group-hover:text-telus-purple transition">
                      {doc.title}
                    </h3>
                    <p className="text-xs text-gray-500 mb-3">
                      {proj?.name || 'Unknown Project'}
                    </p>
                    <p className="text-xs text-gray-400">
                      {formatDate(doc.updatedAt)}
                    </p>
                  </button>
                );
              })}
            </div>
          </div>

          {projectList.length > 0 && (
            <div className="card p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">
                Your Projects
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {projectList.slice(0, 4).map((project) => {
                  const projectDocCount = docList.filter(
                    (d) => d.projectId === project.id
                  ).length;

                  return (
                    <button
                      key={project.id}
                      onClick={() => navigate(`/projects/${project.id}`)}
                      className="card p-4 text-left hover:shadow-md transition"
                    >
                      <h3 className="font-semibold text-gray-900 mb-2 line-clamp-1">
                        {project.name}
                      </h3>
                      <p className="text-sm text-gray-600 mb-3 line-clamp-2">
                        {project.clientContext.split('\n')[0] ||
                          'No description'}
                      </p>
                      <div className="flex items-center gap-4 text-xs text-gray-500">
                        <span>{projectDocCount} documents</span>
                        <span>
                          {formatDate(project.updatedAt)}
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
