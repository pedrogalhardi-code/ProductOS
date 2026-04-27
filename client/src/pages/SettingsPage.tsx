import { useEffect, useRef, useState } from 'react';
import { motion } from 'motion/react';
import { User, Sliders, Puzzle, CheckCircle2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuthStore } from '../stores/authStore';
import { auth, settings, integrations } from '../services/api';
import type { IntegrationDto, Tone } from '@shared/types';

const integrationMeta: Record<
  string,
  { name: string; description: string; logo: string }
> = {
  JIRA: {
    name: 'Jira',
    description: 'Push PRDs and user stories to Jira',
    logo: 'https://cdn.worldvectorlogo.com/logos/jira-1.svg',
  },
  CONFLUENCE: {
    name: 'Confluence',
    description: 'Sync documentation to Confluence',
    logo: 'https://cdn.worldvectorlogo.com/logos/confluence-1.svg',
  },
  SLACK: {
    name: 'Slack',
    description: 'Send notifications to Slack channels',
    logo: 'https://cdn.worldvectorlogo.com/logos/slack-new-logo.svg',
  },
  FIGMA: {
    name: 'Figma',
    description: 'Embed Figma designs in documents',
    logo: 'https://cdn.worldvectorlogo.com/logos/figma-5.svg',
  },
  GOOGLE_DRIVE: {
    name: 'Google Drive',
    description: 'Export documents to Google Drive',
    logo: 'https://cdn.worldvectorlogo.com/logos/google-drive-2020.svg',
  },
};

const toneOptions: { value: Tone; label: string; description: string }[] = [
  {
    value: 'Formal',
    label: 'Formal',
    description:
      'Professional, structured language suited for enterprise stakeholders and executive audiences',
  },
  {
    value: 'Startup',
    label: 'Startup',
    description:
      'Casual, energetic, and direct; works well for fast-moving product teams',
  },
  {
    value: 'Technical',
    label: 'Technical',
    description:
      'Precise, detail-oriented language optimized for engineering audiences and technical specs',
  },
];

function initialsFromName(name?: string) {
  if (!name) return 'U';
  return name.split(' ').map((p) => p[0]).slice(0, 2).join('').toUpperCase();
}

export default function SettingsPage() {
  const user = useAuthStore((s) => s.user);
  const setAuth = useAuthStore((s) => s.setAuth);
  const token = useAuthStore((s) => s.token);

  const [activeTab, setActiveTab] = useState<
    'profile' | 'preferences' | 'integrations'
  >('preferences');
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  const [tone, setTone] = useState<Tone>('Formal');
  const [systemPrompt, setSystemPrompt] = useState('');
  const [integrationsList, setIntegrationsList] = useState<IntegrationDto[]>([]);

  // Profile tab state
  const [profileName, setProfileName] = useState(user?.name ?? '');
  const [profileEmail, setProfileEmail] = useState(user?.email ?? '');
  const [avatarUrl, setAvatarUrl] = useState<string | null>(user?.avatarUrl ?? null);
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const avatarInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const load = async () => {
      try {
        const [settingsRes, integrationsRes] = await Promise.all([
          settings.get(),
          integrations.list(),
        ]);
        if (settingsRes.data.data) {
          const s = settingsRes.data.data as {
            tone?: Tone;
            systemPromptPrefix?: string;
          };
          setTone(s.tone || 'Formal');
          setSystemPrompt(s.systemPromptPrefix || '');
        }
        setIntegrationsList(integrationsRes.data.data || []);
      } catch (err) {
        toast.error('Failed to load settings');
      } finally {
        setIsLoading(false);
      }
    };
    load();
  }, []);

  useEffect(() => {
    setProfileName(user?.name ?? '');
    setProfileEmail(user?.email ?? '');
    setAvatarUrl(user?.avatarUrl ?? null);
  }, [user]);

  const handleSavePreferences = async () => {
    setIsSaving(true);
    try {
      await settings.update({
        tone,
        systemPromptPrefix: systemPrompt,
      });
      toast.success('Preferences saved');
    } catch (err) {
      toast.error('Failed to save preferences');
    } finally {
      setIsSaving(false);
    }
  };

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 1.5 * 1024 * 1024) {
      toast.error('Avatar must be under 1.5 MB');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => setAvatarUrl(reader.result as string);
    reader.readAsDataURL(file);
  };

  const handleSaveProfile = async () => {
    if (!token || !user) return;
    setIsSavingProfile(true);
    try {
      const res = await auth.updateProfile({
        name: profileName,
        email: profileEmail,
        avatarUrl: avatarUrl,
      });
      const updated = res.data.data;
      setAuth(token, {
        ...user,
        name: updated.name,
        email: updated.email,
        avatarUrl: updated.avatarUrl ?? null,
      });
      toast.success('Profile updated');
    } catch (err: any) {
      toast.error(err?.response?.data?.error || 'Failed to save profile');
    } finally {
      setIsSavingProfile(false);
    }
  };

  const handleDisconnect = async (service: string) => {
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

  const handleConnect = (service: string) => {
    toast(`Connecting ${service}… OAuth flow initiated`);
  };

  const tabs = [
    { id: 'profile' as const, label: 'Profile', icon: User },
    { id: 'preferences' as const, label: 'Preferences', icon: Sliders },
    { id: 'integrations' as const, label: 'Integrations', icon: Puzzle },
  ];

  if (isLoading) {
    return (
      <div className="p-8">
        <div className="h-8 w-32 shimmer rounded mb-6" />
        <div className="h-96 shimmer rounded-xl" />
      </div>
    );
  }

  return (
    <div className="p-8">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-3xl font-semibold mb-8">Settings</h1>

        <div className="flex gap-8">
          <div className="w-64 flex-shrink-0">
            <nav className="space-y-1">
              {tabs.map((tab) => {
                const Icon = tab.icon;
                const active = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-left transition-colors"
                    style={
                      active
                        ? { backgroundColor: 'var(--primary)', color: '#fff' }
                        : { color: 'var(--neutral-700)' }
                    }
                  >
                    <Icon size={18} />
                    {tab.label}
                  </button>
                );
              })}
            </nav>
          </div>

          <div className="flex-1">
            {activeTab === 'profile' && (
              <motion.div
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.3 }}
                className="bg-white rounded-xl p-8"
                style={{ border: '1px solid var(--border)' }}
              >
                <h2 className="text-xl font-semibold mb-6">Profile</h2>

                <div className="space-y-6">
                  <div className="flex items-center gap-6">
                    {avatarUrl ? (
                      <img
                        src={avatarUrl}
                        alt="Avatar"
                        className="w-20 h-20 rounded-full object-cover"
                      />
                    ) : (
                      <div className="w-20 h-20 rounded-full gradient-mark flex items-center justify-center">
                        <span className="text-white text-2xl font-semibold">
                          {initialsFromName(profileName)}
                        </span>
                      </div>
                    )}
                    <input
                      ref={avatarInputRef}
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={handleAvatarChange}
                    />
                    <button
                      onClick={() => avatarInputRef.current?.click()}
                      className="btn-secondary"
                    >
                      Change Avatar
                    </button>
                    {avatarUrl && (
                      <button
                        onClick={() => setAvatarUrl(null)}
                        className="text-sm hover:underline"
                        style={{ color: 'var(--neutral-500)' }}
                      >
                        Remove
                      </button>
                    )}
                  </div>

                  <div>
                    <label className="label">Full Name</label>
                    <input
                      type="text"
                      value={profileName}
                      onChange={(e) => setProfileName(e.target.value)}
                      className="input"
                    />
                  </div>

                  <div>
                    <label className="label">Email</label>
                    <input
                      type="email"
                      value={profileEmail}
                      onChange={(e) => setProfileEmail(e.target.value)}
                      className="input"
                    />
                  </div>

                  <div>
                    <label className="label">Role</label>
                    <input
                      type="text"
                      value={user?.role || ''}
                      className="input"
                      readOnly
                    />
                  </div>

                  <button
                    onClick={handleSaveProfile}
                    disabled={isSavingProfile}
                    className="btn-primary"
                  >
                    {isSavingProfile ? 'Saving…' : 'Save Changes'}
                  </button>
                </div>
              </motion.div>
            )}

            {activeTab === 'preferences' && (
              <motion.div
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.3 }}
                className="bg-white rounded-xl p-8"
                style={{ border: '1px solid var(--border)' }}
              >
                <h2 className="text-xl font-semibold mb-6">Preferences</h2>

                <div className="space-y-6">
                  <div>
                    <label className="label">Default Tone</label>
                    <div className="space-y-3">
                      {toneOptions.map((t) => (
                        <button
                          key={t.value}
                          onClick={() => setTone(t.value)}
                          className="w-full text-left p-4 rounded-lg transition-all"
                          style={
                            tone === t.value
                              ? {
                                  border: '2px solid var(--primary)',
                                  backgroundColor: '#faf5ff',
                                }
                              : {
                                  border: '2px solid var(--border)',
                                  backgroundColor: '#fff',
                                }
                          }
                        >
                          <div className="font-medium mb-1">{t.label}</div>
                          <div
                            className="text-sm"
                            style={{ color: 'var(--neutral-600)' }}
                          >
                            {t.description}
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="label">General Instructions</label>
                    <textarea
                      value={systemPrompt}
                      onChange={(e) => setSystemPrompt(e.target.value)}
                      rows={5}
                      className="textarea"
                      placeholder="You are a product strategist at Telus Digital. Focus on user-centric design and enterprise scalability…"
                    />
                    <p
                      className="mt-2 text-xs"
                      style={{ color: 'var(--neutral-500)' }}
                    >
                      This context is prepended to all AI generation requests to customize
                      the output style and focus.
                    </p>
                  </div>

                  <button
                    onClick={handleSavePreferences}
                    disabled={isSaving}
                    className="btn-primary"
                  >
                    {isSaving ? 'Saving…' : 'Save Preferences'}
                  </button>
                </div>
              </motion.div>
            )}

            {activeTab === 'integrations' && (
              <motion.div
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.3 }}
              >
                <h2 className="text-xl font-semibold mb-6">Integrations</h2>

                <div className="grid gap-4">
                  {Object.entries(integrationMeta).map(([key, meta], index) => {
                    const connected =
                      integrationsList.find((i) => i.service === key)?.connected || false;

                    return (
                      <motion.div
                        key={key}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: index * 0.05 }}
                        className="bg-white rounded-xl p-6 flex items-center justify-between"
                        style={{ border: '1px solid var(--border)' }}
                      >
                        <div className="flex items-center gap-4">
                          <div
                            className="w-12 h-12 rounded-lg flex items-center justify-center p-2"
                            style={{ backgroundColor: 'var(--neutral-100)' }}
                          >
                            <img
                              src={meta.logo}
                              alt={meta.name}
                              className="w-full h-full object-contain"
                            />
                          </div>
                          <div>
                            <div className="flex items-center gap-2 mb-1">
                              <h3 className="font-semibold">{meta.name}</h3>
                              {connected && (
                                <span className="flex items-center gap-1 text-xs px-2 py-0.5 rounded bg-green-50 text-green-700">
                                  <CheckCircle2 size={12} />
                                  Connected
                                </span>
                              )}
                            </div>
                            <p
                              className="text-sm"
                              style={{ color: 'var(--neutral-500)' }}
                            >
                              {meta.description}
                            </p>
                          </div>
                        </div>
                        {connected ? (
                          <button
                            onClick={() => handleDisconnect(key)}
                            className="btn-secondary"
                          >
                            Disconnect
                          </button>
                        ) : (
                          <button
                            onClick={() => handleConnect(key)}
                            className="btn-primary"
                          >
                            Connect
                          </button>
                        )}
                      </motion.div>
                    );
                  })}
                </div>
              </motion.div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
