import { useEffect, useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useProjectStore } from '../../stores/projectStore';
import { useDocumentStore } from '../../stores/documentStore';
import { useAuthStore } from '../../stores/authStore';
import { projects, documents } from '../../services/api';
import {
  Home,
  Settings as SettingsIcon,
  Plus,
  FolderOpen,
  PanelLeftClose,
  PanelLeft,
} from 'lucide-react';
import toast from 'react-hot-toast';

const COLLAPSED_KEY = 'productos-sidebar-collapsed';

export default function Sidebar() {
  const location = useLocation();
  const navigate = useNavigate();
  const token = useAuthStore((s) => s.token);
  const projectList = useProjectStore((s) => s.projects);
  const docList = useDocumentStore((s) => s.documents);
  const setProjects = useProjectStore((s) => s.setProjects);
  const setDocuments = useDocumentStore((s) => s.setDocuments);

  const [collapsed, setCollapsed] = useState<boolean>(() => {
    try {
      return localStorage.getItem(COLLAPSED_KEY) === '1';
    } catch {
      return false;
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(COLLAPSED_KEY, collapsed ? '1' : '0');
    } catch {
      // ignore
    }
  }, [collapsed]);

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

  const isActive = (path: string) => {
    if (path === '/dashboard') return location.pathname === '/dashboard';
    return location.pathname === path;
  };

  const isProjectActive = (id: string) =>
    location.pathname.startsWith(`/projects/${id}`);

  const totalDocs = projectList.reduce(
    (acc, p) => acc + docList.filter((d) => d.projectId === p.id).length,
    0,
  );

  return (
    <aside
      className={`bg-white flex flex-col transition-[width] duration-200 ease-in-out ${
        collapsed ? 'w-16' : 'w-60'
      }`}
      style={{ borderRight: '1px solid var(--border)' }}
    >
      {/* Logo + collapse toggle */}
      <div
        className={`h-16 flex items-center ${collapsed ? 'justify-center px-0' : 'justify-between px-4'}`}
        style={{ borderBottom: '1px solid var(--border)' }}
      >
        {!collapsed && (
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg gradient-mark flex items-center justify-center">
              <span className="text-white font-semibold">P</span>
            </div>
            <span className="font-semibold text-lg">ProductOS</span>
          </div>
        )}
        <button
          onClick={() => setCollapsed((v) => !v)}
          className="p-2 rounded-lg transition-colors hover:bg-gray-100"
          style={{ color: 'var(--neutral-500)' }}
          title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {collapsed ? <PanelLeft size={18} /> : <PanelLeftClose size={18} />}
        </button>
      </div>

      {/* New Project */}
      <div className={collapsed ? 'p-2' : 'p-4'}>
        <button
          onClick={() => navigate('/projects/new')}
          className={`w-full flex items-center justify-center text-white rounded-lg hover:opacity-90 transition-opacity font-medium ${
            collapsed ? 'p-2.5' : 'gap-2 px-4 py-2.5'
          }`}
          style={{ backgroundColor: 'var(--primary)' }}
          title={collapsed ? 'New Project' : undefined}
        >
          <Plus size={18} />
          {!collapsed && 'New Project'}
        </button>
      </div>

      {/* Navigation */}
      <nav
        className={`flex-1 space-y-1 overflow-y-auto overflow-x-hidden ${
          collapsed ? 'px-2' : 'px-3'
        }`}
      >
        <NavLink
          to="/dashboard"
          icon={<Home size={18} />}
          label="Dashboard"
          active={isActive('/dashboard')}
          collapsed={collapsed}
        />
        <NavLink
          to="/settings"
          icon={<SettingsIcon size={18} />}
          label="Settings"
          active={isActive('/settings')}
          collapsed={collapsed}
        />

        {/* Projects list */}
        {projectList.length > 0 && (
          <div className="pt-6">
            {!collapsed && (
              <div
                className="px-3 mb-2 text-xs uppercase tracking-wider"
                style={{ color: 'var(--neutral-500)' }}
              >
                Projects
              </div>
            )}
            {projectList.map((project) => (
              <NavLink
                key={project.id}
                to={`/projects/${project.id}`}
                icon={<FolderOpen size={16} />}
                label={project.name}
                active={isProjectActive(project.id)}
                collapsed={collapsed}
              />
            ))}
          </div>
        )}
      </nav>

      {/* Footer */}
      {!collapsed && (
        <div
          className="p-4 text-xs"
          style={{
            borderTop: '1px solid var(--border)',
            color: 'var(--neutral-500)',
          }}
        >
          {totalDocs} document{totalDocs === 1 ? '' : 's'} across {projectList.length} project
          {projectList.length === 1 ? '' : 's'}
        </div>
      )}
    </aside>
  );
}

function NavLink({
  to,
  icon,
  label,
  active,
  collapsed,
}: {
  to: string;
  icon: React.ReactNode;
  label: string;
  active: boolean;
  collapsed: boolean;
}) {
  return (
    <Link
      to={to}
      title={collapsed ? label : undefined}
      className={`flex items-center rounded-lg transition-colors ${
        collapsed ? 'justify-center px-2 py-2' : 'gap-3 px-3 py-2'
      }`}
      style={
        active
          ? { backgroundColor: 'var(--sidebar-accent)', color: 'var(--primary)' }
          : { color: 'var(--neutral-700)' }
      }
    >
      {icon}
      {!collapsed && (
        <div className="flex-1 min-w-0">
          <div className="truncate text-sm">{label}</div>
        </div>
      )}
    </Link>
  );
}
