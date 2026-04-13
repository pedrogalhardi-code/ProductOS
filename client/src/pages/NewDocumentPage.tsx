import { useState, useRef, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useDocumentStore } from '../stores/documentStore';
import { documents, projects, streamGenerate } from '../services/api';
import {
  FileText,
  List,
  Code2,
  Newspaper,
  Map,
  Target,
  ArrowLeft,
  ChevronRight,
  Loader,
} from 'lucide-react';
import toast from 'react-hot-toast';
import type { DocumentType, ProjectDto } from '@shared/types';

const documentTypes = [
  {
    type: 'PRD' as DocumentType,
    icon: FileText,
    label: 'PRD',
    description: 'Product Requirements Document',
  },
  {
    type: 'USER_STORIES' as DocumentType,
    icon: List,
    label: 'User Stories',
    description: 'Acceptance criteria and user flows',
  },
  {
    type: 'TECHNICAL_SPEC' as DocumentType,
    icon: Code2,
    label: 'Technical Spec',
    description: 'Architecture and implementation details',
  },
  {
    type: 'PRODUCT_BRIEF' as DocumentType,
    icon: Newspaper,
    label: 'Product Brief',
    description: 'Executive summary and overview',
  },
  {
    type: 'ROADMAP' as DocumentType,
    icon: Map,
    label: 'Roadmap',
    description: 'Timeline and feature planning',
  },
  {
    type: 'OKRS' as DocumentType,
    icon: Target,
    label: 'OKRs',
    description: 'Objectives and key results',
  },
];

export default function NewDocumentPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const projectId = searchParams.get('projectId');

  const [step, setStep] = useState(1);
  const [selectedType, setSelectedType] = useState<DocumentType | null>(null);
  const [inputTab, setInputTab] = useState<'idea' | 'notes' | 'form' | 'url'>(
    'idea'
  );
  const [isGeneratingLocal, setIsGeneratingLocal] = useState(false);
  const [input, setInput] = useState('');
  const [formInput, setFormInput] = useState({
    name: '',
    problem: '',
    goal: '',
  });
  const [urlInput, setUrlInput] = useState('');
  const [language, setLanguage] = useState('English');
  const [tone, setTone] = useState<'Formal' | 'Startup' | 'Technical'>(
    'Formal'
  );
  const [projectForGen, setProjectForGen] = useState<ProjectDto | null>(null);

  const RICH_REFERENCE_MIN = 200;
  const hasRichReference =
    (projectForGen?.referenceContextLength ?? 0) >= RICH_REFERENCE_MIN;

  useEffect(() => {
    if (!projectId) {
      setProjectForGen(null);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const res = await projects.get(projectId);
        if (!cancelled) setProjectForGen(res.data.data);
      } catch {
        if (!cancelled) setProjectForGen(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [projectId]);

  const addDocument = useDocumentStore((s) => s.addDocument);
  const setIsGenerating = useDocumentStore((s) => s.setIsGenerating);
  const generatedContent = useDocumentStore((s) => s.generatedContent);
  const appendGeneratedContent = useDocumentStore(
    (s) => s.appendGeneratedContent
  );
  const clearGeneratedContent = useDocumentStore(
    (s) => s.clearGeneratedContent
  );
  const cleanupRef = useRef<(() => void) | null>(null);

  const getInputContent = () => {
    if (inputTab === 'idea') return input;
    if (inputTab === 'notes') return input;
    if (inputTab === 'form') {
      return JSON.stringify(formInput);
    }
    return urlInput;
  };

  const handleGenerate = () => {
    const content = getInputContent();
    if (!content.trim() && !hasRichReference) {
      toast.error('Please provide input content—or sync reference materials on the project (about 200+ characters)');
      return;
    }

    if (!selectedType || !projectId) {
      toast.error('Please select a document type and project');
      return;
    }

    clearGeneratedContent();
    setIsGeneratingLocal(true); setIsGenerating(true);

    cleanupRef.current = streamGenerate(
      {
        projectId,
        documentType: selectedType,
        input: content,
        inputType: inputTab,
        language,
        tone,
      },
      (delta) => appendGeneratedContent(delta),
      (_fullContent) => {
        setIsGeneratingLocal(false); setIsGenerating(false);
      },
      (error) => {
        toast.error(`Generation failed: ${error}`);
        setIsGeneratingLocal(false); setIsGenerating(false);
      }
    );
  };

  const handleSaveDocument = async () => {
    if (!selectedType || !projectId) {
      toast.error('Missing required information');
      return;
    }

    const title =
      inputTab === 'form' && formInput.name
        ? formInput.name
        : `New ${selectedType.replace('_', ' ')}`;

    try {
      const response = await documents.create({
        title,
        type: selectedType,
        projectId,
        content: generatedContent,
      });

      const newDoc = response.data.data;
      addDocument(newDoc);
      toast.success('Document created successfully!');
      navigate(`/documents/${newDoc.id}`);
    } catch (err) {
      toast.error('Failed to save document');
    }
  };

  return (
    <div className="p-8 max-w-6xl mx-auto">
      <button
        onClick={() => navigate(-1)}
        className="flex items-center gap-2 text-telus-purple hover:text-telus-purple/80 mb-8 transition"
      >
        <ArrowLeft className="w-4 h-4" />
        Back
      </button>

      <h1 className="text-3xl font-bold text-gray-900 mb-2">
        Create New Document
      </h1>
      <p className="text-gray-600 mb-8">
        Step {step} of {generatedContent ? 3 : 2}:{' '}
        {step === 1
          ? 'Select Document Type'
          : step === 2
            ? 'Provide Input'
            : 'Review & Save'}
      </p>

      {step === 1 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
          {documentTypes.map(({ type, icon: Icon, label, description }) => (
            <button
              key={type}
              onClick={() => {
                setSelectedType(type);
                setStep(2);
              }}
              className={`card p-6 text-left transition ${
                selectedType === type
                  ? 'ring-2 ring-telus-purple bg-telus-purple/5'
                  : 'hover:shadow-md'
              }`}
            >
              <Icon className="w-8 h-8 text-telus-purple mb-3" />
              <h3 className="font-semibold text-gray-900 mb-1">{label}</h3>
              <p className="text-sm text-gray-600">{description}</p>
            </button>
          ))}
        </div>
      ) : step === 2 ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <div className="space-y-6">
            {hasRichReference && (
              <div className="rounded-lg border border-telus-purple/30 bg-telus-purple/5 px-4 py-3 text-sm text-gray-700">
                <p className="font-medium text-gray-900 mb-1">Synced reference materials available</p>
                <p>
                  This project includes substantial text from your linked folder or Google Drive. The model will
                  prioritize that material together with client context. You can leave the idea box empty and
                  still generate—or add a short focus note if you want to steer the doc.
                </p>
              </div>
            )}

            <div className="card p-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">
                Input Method
              </h2>

              <div className="flex gap-2 mb-6">
                {(['idea', 'notes', 'form', 'url'] as const).map((tab) => (
                  <button
                    key={tab}
                    onClick={() => setInputTab(tab)}
                    className={`px-3 py-2 rounded-lg text-sm font-medium transition ${
                      inputTab === tab
                        ? 'bg-telus-purple text-white'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    {tab.charAt(0).toUpperCase() + tab.slice(1)}
                  </button>
                ))}
              </div>

              {inputTab === 'idea' && (
                <textarea
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder={
                    hasRichReference
                      ? 'Optional: one line to steer the doc (e.g. audience or release). Leave empty to draft only from project + synced folder text.'
                      : 'Describe your product idea in one or two sentences...'
                  }
                  className="textarea h-32"
                />
              )}

              {inputTab === 'notes' && (
                <textarea
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder={
                    hasRichReference
                      ? 'Optional: extra notes on top of synced materials. Leave empty to rely on project context and folder imports.'
                      : 'Paste your meeting notes or research findings here...'
                  }
                  className="textarea h-32"
                />
              )}

              {inputTab === 'form' && (
                <div className="space-y-4">
                  <input
                    type="text"
                    value={formInput.name}
                    onChange={(e) =>
                      setFormInput((p) => ({ ...p, name: e.target.value }))
                    }
                    placeholder="Feature/Product Name"
                    className="input"
                  />
                  <textarea
                    value={formInput.problem}
                    onChange={(e) =>
                      setFormInput((p) => ({ ...p, problem: e.target.value }))
                    }
                    placeholder="What problem are we solving?"
                    className="textarea"
                  />
                  <textarea
                    value={formInput.goal}
                    onChange={(e) =>
                      setFormInput((p) => ({ ...p, goal: e.target.value }))
                    }
                    placeholder="What's the success criteria?"
                    className="textarea"
                  />
                </div>
              )}

              {inputTab === 'url' && (
                <input
                  type="url"
                  value={urlInput}
                  onChange={(e) => setUrlInput(e.target.value)}
                  placeholder="https://example.com/document"
                  className="input"
                />
              )}
            </div>

            <div className="card p-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">
                Options
              </h2>

              <div className="space-y-4">
                <div>
                  <label className="label">Language</label>
                  <select
                    value={language}
                    onChange={(e) => setLanguage(e.target.value)}
                    className="input"
                  >
                    <option>English</option>
                    <option>French</option>
                    <option>Spanish</option>
                  </select>
                </div>

                <div>
                  <label className="label">Tone</label>
                  <select
                    value={tone}
                    onChange={(e) =>
                      setTone(
                        e.target.value as 'Formal' | 'Startup' | 'Technical'
                      )
                    }
                    className="input"
                  >
                    <option value="Formal">Formal</option>
                    <option value="Startup">Startup</option>
                    <option value="Technical">Technical</option>
                  </select>
                </div>
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setStep(1)}
                className="btn-secondary flex-1 justify-center"
              >
                Back
              </button>
              <button
                onClick={handleGenerate}
                disabled={isGeneratingLocal}
                className="btn-primary flex-1 justify-center"
              >
                {isGeneratingLocal ? (
                  <>
                    <Loader className="w-4 h-4 animate-spin" />
                    Generating...
                  </>
                ) : (
                  <>
                    Generate
                    <ChevronRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </div>
          </div>

          <div className="card p-6 bg-gray-50 h-fit sticky top-8">
            <h3 className="font-semibold text-gray-900 mb-4">
              Generation Preview
            </h3>
            {isGeneratingLocal || generatedContent ? (
              <div className="prose prose-sm max-w-none max-h-96 overflow-y-auto">
                {generatedContent ? (
                  <div
                    dangerouslySetInnerHTML={{
                      __html: generatedContent
                        .substring(0, 500)
                        .replace(/\n/g, '<br />'),
                    }}
                  />
                ) : (
                  <p className="text-gray-500 italic">
                    Click "Generate" to see a preview...
                  </p>
                )}
              </div>
            ) : (
              <p className="text-sm text-gray-500">
                Fill in the input and click "Generate" to see a preview of
                generated content.
              </p>
            )}
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 card p-8">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">
              Generated Content
            </h2>
            <div className="prose prose-sm max-w-none max-h-96 overflow-y-auto">
              <div
                dangerouslySetInnerHTML={{
                  __html: generatedContent,
                }}
              />
            </div>
          </div>

          <div className="space-y-4">
            <div className="card p-6 bg-telus-purple/5">
              <h3 className="font-semibold text-gray-900 mb-4">
                Document Details
              </h3>
              <div className="space-y-3 text-sm">
                <div>
                  <p className="text-gray-600">Type</p>
                  <p className="font-medium text-gray-900">
                    {selectedType?.replace('_', ' ')}
                  </p>
                </div>
                <div>
                  <p className="text-gray-600">Language</p>
                  <p className="font-medium text-gray-900">{language}</p>
                </div>
                <div>
                  <p className="text-gray-600">Tone</p>
                  <p className="font-medium text-gray-900">{tone}</p>
                </div>
              </div>
            </div>

            <div className="flex flex-col gap-3">
              <button
                onClick={() => setStep(2)}
                className="btn-secondary justify-center"
              >
                Back to Edit
              </button>
              <button
                onClick={handleSaveDocument}
                className="btn-primary justify-center"
              >
                Save Document
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
