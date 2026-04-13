import { useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useProjectStore } from '../../stores/projectStore';
import { useDocumentStore } from '../../stores/documentStore';
import { useAuthStore } from '../../stores/authStore';
import { projects, documents } from '../../services/api';
import { LayoutDashboard, Settings, Plus, FileText, ChevronRight } from 'lucide-react';
import toast from 'react-hot-toast';

export default function Sidebar() {
  const navigate = useNavigate();
  const location = useLocation();
  const token = useAuthStore((s) => s.token);
  const projectList = useProjectStore((s) => s.projects);
  const docList = useDocumentStore((s) => s.documents);
  const setProjects = useProjectStore((s) => s.setProjects);
  const setDocuments = useDocumentStore((s) => s.setDocuments);

  useEffect(() => {
    if (!token) return;

    const loadData = async () => {
      try {
        const [projRes, docRes] = await Promise.all([
          projects.list(),
          documents.list(),
        ]);
        setProjects(projRes.data.data || []);
        setDocuments(docRes.data.data || []);
      } catch (err) {
        toast.error('Failed to load projects and documents');
      }
    };

    loadData();
  }, [token, setProjects, setDocuments]);

  const isActive = (path: string) => location.pathname === path;

  return (
    <aside className="w-60 bg-white border-r border-gray-200 flex flex-col overflow-hidden">
      <div className="p-6 border-b border-gray-200">
        <div className="flex items-center gap-2 mb-6">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-telus-purple to-telus-green flex items-center justify-center text-white font-bold text-sm">
            P
          </div>
          <h1 className="text-lg font-bold text-telus-purple">ProductOS</h1>
        </div>

        <button
          onClick={() => navigate('/projects/new')}
          className="btn-primary w-full justify-center"
        >
          <Plus className="w-4 h-4" />
          New Project
        </button>
      </div>

      <nav className="flex-1 overflow-y-auto px-4 py-6 space-y-2">
        <div className="space-y-1">
          <button
            onClick={() => navigate('/dashboard')}
            className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition ${
              isActive('/dashboard')
                ? 'bg-telus-purple text-white'
                : 'text-gray-700 hover:bg-gray-100'
            }`}
          >
            <LayoutDashboard className="w-4 h-4" />
            Dashboard
          </button>

          <button
            onClick={() => navigate('/settings')}
            className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition ${
              isActive('/settings')
                ? 'bg-telus-purple text-white'
                : 'text-gray-700 hover:bg-gray-100'
            }`}
          >
            <Settings className="w-4 h-4" />
            Settings
          </button>
        </div>

        {projectList.length > 0 && (
          <div className="pt-4">
            <h3 className="px-3 py-1 text-xs font-semibold text-gray-500 uppercase tracking-wider">
              Projects
            </h3>
            <div className="space-y-1 mt-2">
              {projectList.map((project) => {
                const projectDocs = docList.filter(
                  (d) => d.projectId === project.id
                );
                return (
                  <button
                    key={project.id}
                    onClick={() => navigate(`/projects/${project.id}`)}
                    className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition group ${
                      location.pathname === `/projects/${project.id}`
                        ? 'bg-gray-100 text-telus-purple font-medium'
                        : 'text-gray-700 hover:bg-gray-50'
                    }`}
                  >
                    <FileText className="w-4 h-4 flex-shrink-0" />
                    <div className="flex-1 text-left min-w-0">
                      <div className="truncate">{project.name}</div>
                      <div className="text-xs text-gray-500">
                        {projectDocs.length} doc{projectDocs.length !== 1 ? 's' : ''}
                      </div>
                    </div>
                    <ChevronRight className="w-3 h-3 flex-shrink-0 opacity-0 group-hover:opacity-100 transition" />
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </nav>

      <div className="p-4 border-t border-gray-200 text-xs text-gray-500">
        {projectList.length} projects • {docList.length} documents
      </div>
    </aside>
  );
}
