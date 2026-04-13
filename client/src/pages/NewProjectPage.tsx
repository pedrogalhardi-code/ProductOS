import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useProjectStore } from '../stores/projectStore';
import { projects } from '../services/api';
import { ArrowLeft, ChevronRight } from 'lucide-react';
import toast from 'react-hot-toast';

export default function NewProjectPage() {
  const navigate = useNavigate();
  const addProject = useProjectStore((s) => s.addProject);

  const [step, setStep] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    clientContext: '',
  });

  const handleInputChange = (
    field: keyof typeof formData,
    value: string
  ) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleCreateProject = async () => {
    if (!formData.name.trim() || !formData.clientContext.trim()) {
      toast.error('Please fill in all required fields');
      return;
    }

    setIsLoading(true);
    try {
      const response = await projects.create({
        name: formData.name,
        description: formData.description,
        clientContext: formData.clientContext,
      });

      const newProject = response.data.data;
      addProject(newProject);
      toast.success('Project created successfully!');
      navigate(`/projects/${newProject.id}`);
    } catch (err) {
      toast.error('Failed to create project');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <button
        onClick={() => navigate(-1)}
        className="flex items-center gap-2 text-telus-purple hover:text-telus-purple/80 mb-8 transition"
      >
        <ArrowLeft className="w-4 h-4" />
        Back
      </button>

      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">
          Create New Project
        </h1>
        <p className="text-gray-600">
          Step {step} of 2: {step === 1 ? 'Project Details' : 'Client Context'}
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="card p-8">
          {step === 1 ? (
            <div className="space-y-6">
              <h2 className="text-xl font-semibold text-gray-900">
                Project Details
              </h2>

              <div>
                <label className="label">Project Name *</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) =>
                    handleInputChange('name', e.target.value)
                  }
                  placeholder="e.g., Telus Mobile App v2"
                  className="input"
                />
              </div>

              <div>
                <label className="label">Description (Optional)</label>
                <textarea
                  value={formData.description}
                  onChange={(e) =>
                    handleInputChange('description', e.target.value)
                  }
                  placeholder="Brief overview of the project..."
                  className="textarea h-24"
                />
              </div>

              <button
                onClick={() => setStep(2)}
                className="btn-primary w-full justify-center"
              >
                Continue
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <div className="space-y-6">
              <h2 className="text-xl font-semibold text-gray-900">
                Client Context
              </h2>

              <div>
                <label className="label">Client Context *</label>
                <textarea
                  value={formData.clientContext}
                  onChange={(e) =>
                    handleInputChange('clientContext', e.target.value)
                  }
                  placeholder={`Describe your client engagement:
- Client name and industry
- Business goals and KPIs
- Target user types
- Technical constraints
- Regulatory/compliance requirements
- Existing systems and integrations`}
                  className="textarea h-48"
                />
                <p className="text-xs text-gray-500 mt-2">
                  This context will guide AI-generated documents
                </p>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => setStep(1)}
                  className="btn-secondary flex-1 justify-center"
                >
                  Back
                </button>
                <button
                  onClick={handleCreateProject}
                  disabled={isLoading}
                  className="btn-primary flex-1 justify-center"
                >
                  {isLoading ? 'Creating...' : 'Create Project'}
                </button>
              </div>
            </div>
          )}
        </div>

        <div className="lg:block hidden">
          <div className="card p-6 bg-gradient-to-br from-telus-purple/5 to-telus-green/5 sticky top-8">
            <h3 className="font-semibold text-gray-900 mb-4">Preview</h3>

            <div className="space-y-4">
              {formData.name && (
                <div>
                  <p className="text-xs text-gray-600 uppercase tracking-wide mb-1">
                    Project Name
                  </p>
                  <p className="text-lg font-semibold text-gray-900">
                    {formData.name}
                  </p>
                </div>
              )}

              {formData.description && (
                <div>
                  <p className="text-xs text-gray-600 uppercase tracking-wide mb-1">
                    Description
                  </p>
                  <p className="text-sm text-gray-700">
                    {formData.description}
                  </p>
                </div>
              )}

              {formData.clientContext && (
                <div>
                  <p className="text-xs text-gray-600 uppercase tracking-wide mb-1">
                    Client Context
                  </p>
                  <p className="text-sm text-gray-700 line-clamp-4">
                    {formData.clientContext}
                  </p>
                </div>
              )}

              {!formData.name && !formData.description && !formData.clientContext && (
                <div className="py-8 text-center">
                  <p className="text-sm text-gray-400">
                    Fill in the form to see preview
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
