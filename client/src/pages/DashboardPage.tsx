import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'motion/react';
import { useDocumentStore } from '../stores/documentStore';
import { useProjectStore } from '../stores/projectStore';
import { documents, projects } from '../services/api';
import Badge from '../components/ui/Badge';
import DocumentCardMenu from '../components/ui/DocumentCardMenu';
import { FolderOpen, FileText } from 'lucide-react';
import toast from 'react-hot-toast';
import type { DocumentDto, ProjectDto } from '@shared/types';

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

function initials(name?: string) {
  if (!name) return 'U';
  return name.split(' ').map((p) => p[0]).slice(0, 2).join('').toUpperCase();
}

function docCountFor(project: ProjectDto, docs: DocumentDto[]) {
  return docs.filter((d) => d.projectId === project.id).length;
}

export default function DashboardPage() {
  const [isLoading, setIsLoading] = useState(true);

  const docList = useDocumentStore((s) => s.documents);
  const projectList = useProjectStore((s) => s.projects);
  const setDocuments = useDocumentStore((s) => s.setDocuments);
  const setProjects = useProjectStore((s) => s.setProjects);

  useEffect(() => {
    const loadData = async () => {
      try {
        const [docRes, projRes] = await Promise.all([
          documents.list({ limit: '12' }),
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

  return (
    <div className="p-8">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-semibold mb-2">Dashboard</h1>
          <p style={{ color: 'var(--neutral-500)' }}>
            Welcome back! Here's what's happening with your projects.
          </p>
        </div>

        {/* Recent Documents */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold">Recent Documents</h2>
          </div>

          {isLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="h-40 shimmer rounded-xl" />
              ))}
            </div>
          ) : recentDocs.length === 0 ? (
            <div className="card p-12 text-center">
              <FileText
                size={48}
                className="mx-auto mb-4"
                style={{ color: 'var(--neutral-300)' }}
              />
              <h3 className="text-lg font-semibold mb-2">No documents yet</h3>
              <p style={{ color: 'var(--neutral-500)' }} className="mb-6">
                Create a new project and document to get started.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {recentDocs.map((doc, index) => {
                const project = projectList.find((p) => p.id === doc.projectId);
                return (
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
                      <h3 className="font-medium mb-2 line-clamp-2">{doc.title}</h3>
                      <p
                        className="text-sm mb-3"
                        style={{ color: 'var(--neutral-500)' }}
                      >
                        {project?.name || 'Unknown Project'}
                      </p>
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
                );
              })}
            </div>
          )}
        </div>

        {/* Your Projects */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold">Your Projects</h2>
            <Link
              to="/projects/new"
              className="text-sm hover:underline"
              style={{ color: 'var(--primary)' }}
            >
              Create Project
            </Link>
          </div>

          {isLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {[...Array(2)].map((_, i) => (
                <div key={i} className="h-40 shimmer rounded-xl" />
              ))}
            </div>
          ) : projectList.length === 0 ? (
            <div className="card p-12 text-center">
              <FolderOpen
                size={48}
                className="mx-auto mb-4"
                style={{ color: 'var(--neutral-300)' }}
              />
              <h3 className="text-lg font-semibold mb-2">No projects yet</h3>
              <Link to="/projects/new" className="btn-primary mt-4 inline-flex">
                Create First Project
              </Link>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {projectList.slice(0, 6).map((project, index) => (
                <motion.div
                  key={project.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.3, delay: index * 0.1 }}
                >
                  <Link
                    to={`/projects/${project.id}`}
                    className="block bg-white rounded-xl p-6 shadow-sm hover:shadow-md transition-shadow"
                    style={{ border: '1px solid var(--border)' }}
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div className="w-12 h-12 rounded-lg gradient-mark flex items-center justify-center">
                        <FolderOpen size={24} className="text-white" />
                      </div>
                      <span className="px-2 py-1 rounded text-xs font-medium bg-green-50 text-green-700">
                        Active
                      </span>
                    </div>
                    <h3 className="text-lg font-semibold mb-2">{project.name}</h3>
                    <p
                      className="text-sm mb-4 line-clamp-2"
                      style={{ color: 'var(--neutral-500)' }}
                    >
                      {project.description ||
                        project.clientContext?.split('\n')[0] ||
                        'No description'}
                    </p>
                    <div
                      className="flex items-center gap-2 text-sm"
                      style={{ color: 'var(--neutral-600)' }}
                    >
                      <FileText size={16} />
                      <span>{docCountFor(project, docList)} documents</span>
                    </div>
                  </Link>
                </motion.div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
