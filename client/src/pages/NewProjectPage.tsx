import { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'motion/react';
import { ArrowLeft, Upload, X, FileText, FolderOpen, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { useProjectStore } from '../stores/projectStore';
import { projects } from '../services/api';
import { pickAndScanLocalContextFolder } from '../lib/scanLocalContextFolder';

export default function NewProjectPage() {
  const navigate = useNavigate();
  const addProject = useProjectStore((s) => s.addProject);

  const [name, setName] = useState('');
  const [clientContext, setClientContext] = useState('');
  const [attachedFiles, setAttachedFiles] = useState<File[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [referenceContextMaterial, setReferenceContextMaterial] = useState('');
  const [localContextFolderLabel, setLocalContextFolderLabel] = useState<string | null>(null);
  const [scanningFolder, setScanningFolder] = useState(false);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    setAttachedFiles((prev) => [...prev, ...files]);
  };

  const removeFile = (index: number) => {
    setAttachedFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !clientContext.trim()) {
      toast.error('Name and Client Context are required');
      return;
    }

    setIsLoading(true);
    try {
      const response = await projects.create({
        name,
        clientContext,
        attachments: attachedFiles,
        ...(referenceContextMaterial.trim()
          ? {
              referenceContextMaterial: referenceContextMaterial.trim(),
              localContextFolderLabel,
            }
          : {}),
      });
      const newProject = response.data.data;
      addProject(newProject);
      toast.success('Project created');
      navigate(`/projects/${newProject.id}`);
    } catch (err) {
      toast.error('Failed to create project');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="p-8">
      <div className="max-w-2xl mx-auto">
        <button
          onClick={() => navigate('/dashboard')}
          className="flex items-center gap-2 mb-6 transition-colors"
          style={{ color: 'var(--neutral-600)' }}
        >
          <ArrowLeft size={18} />
          Back to Dashboard
        </button>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="bg-white rounded-2xl p-8 shadow-sm"
          style={{ border: '1px solid var(--border)' }}
        >
          <h1 className="text-2xl font-semibold mb-2">Create New Project</h1>
          <p style={{ color: 'var(--neutral-500)' }} className="mb-8">
            Set up a new project to organize your product documents and specifications.
          </p>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label className="label">Project Name</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g., Customer Portal Redesign"
                className="input"
                required
              />
            </div>

            <div>
              <label className="label">Client Context</label>
              <textarea
                value={clientContext}
                onChange={(e) => setClientContext(e.target.value)}
                placeholder="Provide context about your client, their industry, goals, and any specific requirements. This context will be used to enhance AI-generated documents for this project."
                rows={8}
                className="textarea"
                required
              />
              <p
                className="mt-2 text-xs"
                style={{ color: 'var(--neutral-500)' }}
              >
                💡 This context is injected into every AI call for this project to ensure
                consistency and relevance.
              </p>
            </div>

            <div>
              <label className="label">Attach Documents (Optional)</label>
              <input
                type="file"
                ref={fileInputRef}
                accept=".pdf,.md,.txt"
                multiple
                onChange={handleFileUpload}
                className="hidden"
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="w-full rounded-lg p-6 text-center transition-colors"
                style={{ border: '2px dashed var(--border)' }}
                onMouseEnter={(e) =>
                  (e.currentTarget.style.borderColor = 'var(--primary)')
                }
                onMouseLeave={(e) =>
                  (e.currentTarget.style.borderColor = 'var(--border)')
                }
              >
                <div className="flex flex-col items-center gap-2">
                  <Upload size={32} style={{ color: 'var(--neutral-400)' }} />
                  <div>
                    <span
                      className="text-sm font-medium"
                      style={{ color: 'var(--primary)' }}
                    >
                      Upload PDF files
                    </span>
                    <p className="text-xs mt-1" style={{ color: 'var(--neutral-500)' }}>
                      or drag and drop
                    </p>
                  </div>
                </div>
              </button>

              {attachedFiles.length > 0 && (
                <div className="mt-4 space-y-2">
                  {attachedFiles.map((file, index) => (
                    <div
                      key={index}
                      className="flex items-center justify-between p-3 rounded-lg"
                      style={{
                        backgroundColor: 'var(--neutral-50)',
                        border: '1px solid var(--border)',
                      }}
                    >
                      <div className="flex items-center gap-3">
                        <FileText size={20} style={{ color: 'var(--primary)' }} />
                        <div>
                          <p className="text-sm font-medium">{file.name}</p>
                          <p
                            className="text-xs"
                            style={{ color: 'var(--neutral-500)' }}
                          >
                            {(file.size / 1024).toFixed(1)} KB
                          </p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => removeFile(index)}
                        className="p-1 rounded transition-colors hover:bg-gray-200"
                      >
                        <X size={16} style={{ color: 'var(--neutral-500)' }} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="rounded-lg p-4 space-y-3" style={{ border: '1px solid var(--border)', backgroundColor: 'var(--neutral-50)' }}>
              <p className="text-sm font-medium" style={{ color: 'var(--neutral-900)' }}>Reference folder (optional)</p>
              <p className="text-xs" style={{ color: 'var(--neutral-600)' }}>
                Choose a folder on this computer. Text-like files are read in the browser and sent with the
                project as extra AI context. Google Drive folders can be linked from the project page after creation.
              </p>
              <div className="flex flex-wrap gap-2 items-center">
                <button
                  type="button"
                  disabled={scanningFolder}
                  onClick={async () => {
                    setScanningFolder(true);
                    try {
                      const result = await pickAndScanLocalContextFolder();
                      if (!result) return;
                      if (!result.text.trim()) {
                        toast.error('No readable text files found in that folder');
                        return;
                      }
                      setReferenceContextMaterial(result.text);
                      setLocalContextFolderLabel(result.label);
                      toast.success(`Imported from "${result.label}"`);
                    } catch (e) {
                      toast.error(e instanceof Error ? e.message : 'Could not read folder');
                    } finally {
                      setScanningFolder(false);
                    }
                  }}
                  className="btn-secondary inline-flex items-center gap-2"
                >
                  {scanningFolder ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <FolderOpen className="w-4 h-4" />
                  )}
                  {scanningFolder ? 'Reading…' : 'Choose local folder…'}
                </button>
                {referenceContextMaterial ? (
                  <button
                    type="button"
                    className="text-sm text-red-600 hover:underline"
                    onClick={() => {
                      setReferenceContextMaterial('');
                      setLocalContextFolderLabel(null);
                    }}
                  >
                    Clear imported folder
                  </button>
                ) : null}
              </div>
              {referenceContextMaterial ? (
                <p className="text-xs" style={{ color: 'var(--neutral-600)' }}>
                  Linked: <span className="font-medium">{localContextFolderLabel}</span> —{' '}
                  {referenceContextMaterial.length.toLocaleString()} characters of reference text
                </p>
              ) : null}
            </div>

            <div className="flex gap-3 pt-4">
              <button
                type="button"
                onClick={() => navigate('/dashboard')}
                className="btn-secondary flex-1 justify-center"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isLoading}
                className="btn-primary flex-1 justify-center"
              >
                {isLoading ? 'Creating…' : 'Create Project'}
              </button>
            </div>
          </form>
        </motion.div>
      </div>
    </div>
  );
}
