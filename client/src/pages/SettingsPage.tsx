import { useEffect, useState } from 'react';
import { useAuthStore } from '../stores/authStore';
import { settings, integrations } from '../services/api';
import { Save, CheckCircle, Circle, ExternalLink } from 'lucide-react';
import toast from 'react-hot-toast';
import type { IntegrationDto, Tone } from '@shared/types';

export default function SettingsPage() {
  const user = useAuthStore((s) => s.user);

  const [activeTab, setActiveTab] = useState<
    'general' | 'ai' | 'integrations' | 'team'
  >('general');
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  const [language, setLanguage] = useState('English');
  const [tone, setTone] = useState<Tone>('Formal');
  const [systemPrompt, setSystemPrompt] = useState('');
  const [integrationsList, setIntegrationsList] = useState<IntegrationDto[]>(
    []
  );
  const [aiUsage, setAiUsage] = useState({
    documents: 0,
    reviews: 0,
    tokens: 0,
  });

  useEffect(() => {
    const loadSettings = async () => {
      try {
        const [settingsRes, integrationsRes, usageRes] = await Promise.all([
          settings.get(),
          integrations.list(),
          settings.aiUsage('month'),
        ]);

        if (settingsRes.data.data) {
          const s = settingsRes.data.data as any;
          setLanguage(s.language || 'English');
          setTone(s.tone || 'Formal');
          setSystemPrompt(s.systemPromptPrefix || '');
        }

        setIntegrationsList(integrationsRes.data.data || []);

        if (usageRes.data.data) {
          setAiUsage(usageRes.data.data as any);
        }
      } catch (err) {
        toast.error('Failed to load settings');
      } finally {
        setIsLoading(false);
      }
    };

    loadSettings();
  }, []);

  const handleSaveSettings = async () => {
    setIsSaving(true);
    try {
      await settings.update({
        language,
        tone,
        systemPromptPrefix: systemPrompt,
      });
      toast.success('Settings saved successfully');
    } catch (err) {
      toast.error('Failed to save settings');
    } finally {
      setIsSaving(false);
    }
  };

  const handleConnectIntegration = async (service: string) => {
    toast(`ℹ️ Connecting ${service}... OAuth flow initiated`);
  };

  const handleDisconnectIntegration = async (service: string) => {
    try {
      await integrations.disconnect(service);
      setIntegrationsList((prev) =>
        prev.map((i) =>
          i.service === service ? { ...i, connected: false } : i
        )
      );
      toast.success(`${service} disconnected`);
    } catch (err) {
      toast.error(`Failed to disconnect ${service}`);
    }
  };

  if (isLoading) {
    return (
      <div className="p-8">
        <div className="h-8 shimmer rounded-lg w-32 mb-6" />
        <div className="h-96 shimmer rounded-lg" />
      </div>
    );
  }

  return (
    <div className="p-8 max-w-6xl mx-auto">
      <h1 className="text-3xl font-bold text-gray-900 mb-8">Settings</h1>

      <div className="flex gap-8">
        <div className="w-48">
          <nav className="space-y-2">
            {(
              [
                { id: 'general', label: 'General' },
                { id: 'ai', label: 'AI Defaults' },
                { id: 'integrations', label: 'Integrations' },
                { id: 'team', label: 'Team' },
              ] as const
            ).map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`w-full text-left px-4 py-2 rounded-lg transition ${
                  activeTab === tab.id
                    ? 'bg-telus-purple text-white'
                    : 'text-gray-700 hover:bg-gray-100'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </nav>
        </div>

        <div className="flex-1">
          {activeTab === 'general' && (
            <div className="card p-8">
              <h2 className="text-xl font-semibold text-gray-900 mb-6">
                General Settings
              </h2>

              <div className="space-y-6 max-w-md">
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
                    <option>German</option>
                    <option>Japanese</option>
                  </select>
                </div>

                <div>
                  <label className="label">Default Tone</label>
                  <select
                    value={tone}
                    onChange={(e) => setTone(e.target.value as Tone)}
                    className="input"
                  >
                    <option value="Formal">Formal</option>
                    <option value="Startup">Startup</option>
                    <option value="Technical">Technical</option>
                  </select>
                </div>

                <button
                  onClick={handleSaveSettings}
                  disabled={isSaving}
                  className="btn-primary"
                >
                  <Save className="w-4 h-4" />
                  {isSaving ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </div>
          )}

          {activeTab === 'ai' && (
            <div className="space-y-8">
              <div className="card p-8">
                <h2 className="text-xl font-semibold text-gray-900 mb-6">
                  AI System Prompt
                </h2>

                <div className="mb-6">
                  <label className="label">System Prompt Prefix</label>
                  <p className="text-sm text-gray-600 mb-3">
                    Define your brand voice and preferences for AI-generated
                    content
                  </p>
                  <textarea
                    value={systemPrompt}
                    onChange={(e) => setSystemPrompt(e.target.value)}
                    placeholder="You are a product strategist at Telus Digital. Focus on user-centric design and enterprise scalability..."
                    className="textarea h-32"
                  />
                </div>

                <button
                  onClick={handleSaveSettings}
                  disabled={isSaving}
                  className="btn-primary"
                >
                  <Save className="w-4 h-4" />
                  Save Prompt
                </button>
              </div>

              <div className="card p-8">
                <h2 className="text-xl font-semibold text-gray-900 mb-6">
                  AI Usage (This Month)
                </h2>

                <div className="grid grid-cols-3 gap-6">
                  <div>
                    <p className="text-sm text-gray-600 mb-2">Documents Generated</p>
                    <p className="text-3xl font-bold text-telus-purple">
                      {aiUsage.documents}
                    </p>
                  </div>

                  <div>
                    <p className="text-sm text-gray-600 mb-2">Reviews Completed</p>
                    <p className="text-3xl font-bold text-telus-green">
                      {aiUsage.reviews}
                    </p>
                  </div>

                  <div>
                    <p className="text-sm text-gray-600 mb-2">Tokens Used</p>
                    <p className="text-3xl font-bold text-amber-600">
                      {aiUsage.tokens.toLocaleString()}
                    </p>
                  </div>
                </div>

                <div className="mt-6 pt-6 border-t border-gray-200">
                  <p className="text-xs text-gray-500 mb-4">Usage breakdown</p>
                  <div className="space-y-3">
                    <div>
                      <div className="flex justify-between text-sm mb-1">
                        <span className="text-gray-600">Generation</span>
                        <span className="font-medium text-gray-900">45%</span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div
                          className="bg-telus-purple h-2 rounded-full"
                          style={{ width: '45%' }}
                        />
                      </div>
                    </div>

                    <div>
                      <div className="flex justify-between text-sm mb-1">
                        <span className="text-gray-600">Review</span>
                        <span className="font-medium text-gray-900">35%</span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div
                          className="bg-telus-green h-2 rounded-full"
                          style={{ width: '35%' }}
                        />
                      </div>
                    </div>

                    <div>
                      <div className="flex justify-between text-sm mb-1">
                        <span className="text-gray-600">Other</span>
                        <span className="font-medium text-gray-900">20%</span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div
                          className="bg-gray-400 h-2 rounded-full"
                          style={{ width: '20%' }}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'integrations' && (
            <div className="space-y-4">
              {[
                { service: 'JIRA', icon: '⚙️' },
                { service: 'CONFLUENCE', icon: '📄' },
                { service: 'SLACK', icon: '💬' },
                { service: 'GOOGLE_DRIVE', icon: '☁️' },
                { service: 'FIGMA', icon: '🎨' },
              ].map((integration) => {
                const connected = integrationsList.find(
                  (i) => i.service === integration.service
                )?.connected || false;

                return (
                  <div key={integration.service} className="card p-6">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className="text-2xl">{integration.icon}</div>
                        <div>
                          <h3 className="font-semibold text-gray-900">
                            {integration.service.replace('_', ' ')}
                          </h3>
                          <p className="text-sm text-gray-600">
                            {connected ? (
                              <span className="flex items-center gap-1 text-telus-green">
                                <CheckCircle className="w-4 h-4" />
                                Connected
                              </span>
                            ) : (
                              <span className="flex items-center gap-1 text-gray-400">
                                <Circle className="w-4 h-4" />
                                Not connected
                              </span>
                            )}
                          </p>
                        </div>
                      </div>

                      <div className="flex gap-2">
                        {connected ? (
                          <>
                            <button
                              onClick={() =>
                                handleDisconnectIntegration(
                                  integration.service
                                )
                              }
                              className="btn-danger text-xs"
                            >
                              Disconnect
                            </button>
                            <a
                              href="#"
                              className="btn-secondary text-xs flex items-center gap-1"
                              onClick={(e) => e.preventDefault()}
                            >
                              <ExternalLink className="w-3 h-3" />
                              View
                            </a>
                          </>
                        ) : (
                          <button
                            onClick={() =>
                              handleConnectIntegration(integration.service)
                            }
                            className="btn-primary text-xs"
                          >
                            Connect
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {activeTab === 'team' && (
            <div className="card p-8">
              <h2 className="text-xl font-semibold text-gray-900 mb-6">
                Team
              </h2>

              <div className="mb-8 p-4 bg-gray-50 rounded-lg">
                <h3 className="font-medium text-gray-900 mb-3">
                  Your Account
                </h3>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Name</span>
                    <span className="font-medium text-gray-900">
                      {user?.name}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Email</span>
                    <span className="font-medium text-gray-900">
                      {user?.email}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Role</span>
                    <span className="font-medium text-telus-purple">
                      {user?.role}
                    </span>
                  </div>
                </div>
              </div>

              <div className="pt-6 border-t border-gray-200">
                <h3 className="font-medium text-gray-900 mb-4">
                  Team Members
                </h3>
                <p className="text-sm text-gray-500 mb-4">
                  Team management coming soon. For now, share project invitations
                  individually.
                </p>
                <button className="btn-secondary" disabled>
                  Invite Team Member
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
