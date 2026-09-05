import { useState, useEffect } from 'react';
import type { AiProviderId, AiProviderInfo, AiProvidersConfigResponse } from '../../types';
import { useAuth } from '../../context/AuthContext';
import { Button } from '../ui/Button';
import { useToast } from '../ui/Toast';
import {
  Sparkles,
  Bot,
  Cpu,
  CheckCircle2,
  AlertCircle,
  Lock,
  Eye,
  EyeOff,
  RefreshCw,
  Key,
  Shield,
  Trash2,
  Check,
  Zap,
  Radio,
  ExternalLink,
} from 'lucide-react';

interface ProviderCardMeta {
  id: AiProviderId;
  name: string;
  badge: string;
  tagline: string;
  accentColor: string;
  bgLight: string;
  borderClass: string;
  icon: typeof Sparkles;
  placeholder: string;
  keyPrefixHint: string;
  docsUrl: string;
  recommendedModels: string[];
}

const PROVIDER_METAS: ProviderCardMeta[] = [
  {
    id: 'gemini',
    name: 'Google Gemini',
    badge: 'Recommended for Speed',
    tagline: 'High-throughput reasoning, schema generation, and high-context analysis.',
    accentColor: 'text-indigo-600',
    bgLight: 'bg-indigo-50/80',
    borderClass: 'border-indigo-200',
    icon: Sparkles,
    placeholder: 'AIzaSy...',
    keyPrefixHint: 'Starts with AIzaSy',
    docsUrl: 'https://aistudio.google.com/app/apikey',
    recommendedModels: ['gemini-2.5-flash', 'gemini-3.8-flash', 'gemini-3.1-pro-preview'],
  },
  {
    id: 'openai',
    name: 'OpenAI',
    badge: 'Frontier Reasoning',
    tagline: 'Deep test architecture planning, structured synthetic payloads, and edge cases.',
    accentColor: 'text-emerald-700',
    bgLight: 'bg-emerald-50/80',
    borderClass: 'border-emerald-200',
    icon: Cpu,
    placeholder: 'sk-proj-... or sk-...',
    keyPrefixHint: 'Starts with sk-',
    docsUrl: 'https://platform.openai.com/api-keys',
    recommendedModels: ['gpt-4o', 'o3-mini', 'gpt-4o-mini'],
  },
  {
    id: 'anthropic',
    name: 'Anthropic Claude',
    badge: 'Nuanced Contracts',
    tagline: 'Fine-grained specification audit, negative test matrices, and boundary rules.',
    accentColor: 'text-amber-700',
    bgLight: 'bg-amber-50/80',
    borderClass: 'border-amber-200',
    icon: Bot,
    placeholder: 'sk-ant-api03-...',
    keyPrefixHint: 'Starts with sk-ant-',
    docsUrl: 'https://console.anthropic.com/settings/keys',
    recommendedModels: ['claude-3-5-sonnet-20241022', 'claude-3-5-haiku-20241022'],
  },
];

export function AiProvidersSettings() {
  const { user } = useAuth();
  const { showToast } = useToast();

  const [loading, setLoading] = useState<boolean>(true);
  const [defaultProvider, setDefaultProvider] = useState<AiProviderId>('gemini');
  const [providers, setProviders] = useState<Record<AiProviderId, AiProviderInfo>>({
    gemini: { id: 'gemini', name: 'Google Gemini', isConfigured: false },
    openai: { id: 'openai', name: 'OpenAI', isConfigured: false },
    anthropic: { id: 'anthropic', name: 'Anthropic Claude', isConfigured: false },
  });

  // Local input drafts for API keys
  const [inputKeys, setInputKeys] = useState<Record<AiProviderId, string>>({
    gemini: '',
    openai: '',
    anthropic: '',
  });

  // Toggle mask visibility while entering key
  const [showKeyInput, setShowKeyInput] = useState<Record<AiProviderId, boolean>>({
    gemini: false,
    openai: false,
    anthropic: false,
  });

  // Replace / editing key mode for already configured providers
  const [isEditing, setIsEditing] = useState<Record<AiProviderId, boolean>>({
    gemini: false,
    openai: false,
    anthropic: false,
  });

  // Async action states
  const [testing, setTesting] = useState<Record<AiProviderId, boolean>>({
    gemini: false,
    openai: false,
    anthropic: false,
  });

  const [saving, setSaving] = useState<Record<AiProviderId, boolean>>({
    gemini: false,
    openai: false,
    anthropic: false,
  });

  const [testResults, setTestResults] = useState<
    Record<
      AiProviderId,
      { success: boolean; message: string; modelsSample?: string[]; latencyMs: number } | null
    >
  >({
    gemini: null,
    openai: null,
    anthropic: null,
  });

  // Load config on mount
  const fetchConfig = async () => {
    if (!user) return;
    try {
      setLoading(true);
      const res = await fetch(`/api/ai/config?userId=${encodeURIComponent(user.id)}`);
      if (res.ok) {
        const data: AiProvidersConfigResponse = await res.json();
        setDefaultProvider(data.defaultProvider || 'gemini');
        if (data.providers) {
          setProviders(data.providers);
        }
      }
    } catch (err) {
      console.error('Failed to load AI providers configuration:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchConfig();
  }, [user?.id]);

  // Handle setting default provider
  const handleSetDefault = async (providerId: AiProviderId) => {
    if (!user) return;
    const prev = defaultProvider;
    setDefaultProvider(providerId);

    try {
      const res = await fetch('/api/ai/set-default', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id, defaultProvider: providerId }),
      });

      if (!res.ok) {
        throw new Error('Failed to update default provider');
      }

      showToast({
        type: 'success',
        title: 'Default provider updated',
        description: `${
          providerId === 'gemini' ? 'Google Gemini' : providerId === 'openai' ? 'OpenAI' : 'Anthropic Claude'
        } is now your default engine.`,
      });
    } catch (err: any) {
      setDefaultProvider(prev);
      showToast({
        type: 'error',
        title: 'Error updating default provider',
        description: err.message,
      });
    }
  };

  // Test connection
  const handleTestConnection = async (providerId: AiProviderId) => {
    if (!user) return;

    const draftKey = inputKeys[providerId].trim();
    const isConfigured = providers[providerId]?.isConfigured;

    if (!draftKey && !isConfigured) {
      showToast({
        type: 'info',
        title: 'API key required',
        description: 'Please enter or save an API key first to test the connection.',
      });
      return;
    }

    setTesting((prev) => ({ ...prev, [providerId]: true }));
    setTestResults((prev) => ({ ...prev, [providerId]: null }));

    try {
      const res = await fetch('/api/ai/test-connection', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user.id,
          provider: providerId,
          apiKey: draftKey || undefined, // If empty, server tests the stored encrypted key
        }),
      });

      const data = await res.json();
      setTestResults((prev) => ({
        ...prev,
        [providerId]: {
          success: data.success,
          message: data.message || (data.success ? 'Connection validated' : 'Failed to connect'),
          modelsSample: data.modelsSample,
          latencyMs: data.latencyMs || 0,
        },
      }));

      if (data.success) {
        showToast({
          type: 'success',
          title: `${providers[providerId]?.name || providerId} Connected`,
          description: `Connection validated in ${data.latencyMs || 0}ms.`,
        });
      } else {
        showToast({
          type: 'error',
          title: 'Connection Test Failed',
          description: data.message || 'Validation error. Check your API key.',
        });
      }
    } catch (err: any) {
      setTestResults((prev) => ({
        ...prev,
        [providerId]: {
          success: false,
          message: err.message || 'Network request failed',
          latencyMs: 0,
        },
      }));
      showToast({
        type: 'error',
        title: 'Test failed',
        description: err.message || 'Could not verify connection',
      });
    } finally {
      setTesting((prev) => ({ ...prev, [providerId]: false }));
    }
  };

  // Save API key
  const handleSaveKey = async (providerId: AiProviderId) => {
    if (!user) return;

    const draftKey = inputKeys[providerId].trim();
    if (!draftKey) {
      showToast({
        type: 'info',
        title: 'Key cannot be empty',
        description: 'Please paste a valid API key before saving.',
      });
      return;
    }

    setSaving((prev) => ({ ...prev, [providerId]: true }));

    try {
      const res = await fetch('/api/ai/save-key', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user.id,
          provider: providerId,
          apiKey: draftKey,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to save encrypted key');
      }

      const data = await res.json();

      // Clear draft input and reset edit mode
      setInputKeys((prev) => ({ ...prev, [providerId]: '' }));
      setIsEditing((prev) => ({ ...prev, [providerId]: false }));
      setShowKeyInput((prev) => ({ ...prev, [providerId]: false }));

      // Update provider config state with masked representation
      setProviders((prev) => ({
        ...prev,
        [providerId]: {
          ...prev[providerId],
          ...data.provider,
          isConfigured: true,
        },
      }));

      showToast({
        type: 'success',
        title: 'Key Encrypted & Stored',
        description: `${data.provider.name} key stored with AES-256-GCM encryption on the backend.`,
      });

      // Optionally auto-run quick validation after saving
      handleTestConnection(providerId);
    } catch (err: any) {
      showToast({
        type: 'error',
        title: 'Save Failed',
        description: err.message || 'Could not save encrypted key',
      });
    } finally {
      setSaving((prev) => ({ ...prev, [providerId]: false }));
    }
  };

  // Delete API key
  const handleDeleteKey = async (providerId: AiProviderId) => {
    if (!user) return;
    if (!confirm(`Are you sure you want to remove the stored API key for ${providers[providerId]?.name}?`)) {
      return;
    }

    try {
      const res = await fetch('/api/ai/delete-key', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id, provider: providerId }),
      });

      if (!res.ok) {
        throw new Error('Failed to remove key');
      }

      setProviders((prev) => ({
        ...prev,
        [providerId]: {
          ...prev[providerId],
          isConfigured: false,
          maskedKey: undefined,
          lastTestedAt: undefined,
          lastStatus: undefined,
          lastError: undefined,
        },
      }));
      setTestResults((prev) => ({ ...prev, [providerId]: null }));
      setInputKeys((prev) => ({ ...prev, [providerId]: '' }));
      setIsEditing((prev) => ({ ...prev, [providerId]: false }));

      showToast({
        type: 'info',
        title: 'Key Removed',
        description: `API key for ${providers[providerId]?.name} has been removed.`,
      });
    } catch (err: any) {
      showToast({
        type: 'error',
        title: 'Deletion Failed',
        description: err.message,
      });
    }
  };

  return (
    <div className="bg-white rounded-xl border border-stone-200 p-6 shadow-2xs">
      {/* Section Title & Security Guarantee */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-5 border-b border-stone-100">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-indigo-50 border border-indigo-200 flex items-center justify-center text-indigo-600">
            <Sparkles className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-stone-900">AI Model Providers</h2>
            <p className="text-xs text-stone-500">
              Configure intelligence models for automated requirements matrix & test suite generation.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-mono bg-stone-50 border border-stone-200 text-stone-600">
            <Lock className="w-3 h-3 text-stone-500" />
            AES-256-GCM Backend Storage
          </span>
          <Button
            variant="ghost"
            size="sm"
            onClick={fetchConfig}
            disabled={loading}
            className="h-7 px-2 text-stone-400 hover:text-stone-700"
            title="Refresh Provider Configuration"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </div>

      {/* Security Architecture Notice */}
      <div className="mt-4 p-3 rounded-lg bg-stone-50/70 border border-stone-200/70 text-xs text-stone-600 flex items-start gap-2.5">
        <Shield className="w-4 h-4 text-indigo-600 shrink-0 mt-0.5" />
        <div className="leading-relaxed">
          <strong className="text-stone-900 font-medium">Enterprise Secret Security: </strong>
          All API keys are encrypted at rest on the backend using server-side AES-256-GCM. Decryption keys
          reside exclusively in isolated server-side memory. Once saved, only the last 4 characters are
          displayed to prevent credential exposure.
        </div>
      </div>

      {/* ========================================================= */}
      {/* Default Provider Selector */}
      {/* ========================================================= */}
      <div className="mt-6 pt-5 border-t border-stone-100">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3">
          <div>
            <label className="text-xs font-semibold text-stone-900 flex items-center gap-1.5">
              <Zap className="w-3.5 h-3.5 text-amber-500" />
              Default AI Engine for Generation
            </label>
            <p className="text-[11px] text-stone-500 mt-0.5">
              Selected by default when extracting requirements and generating executable tests. Can be
              overridden per-generation.
            </p>
          </div>
          <span className="text-[11px] text-stone-500 font-mono">
            Active: <strong className="text-stone-800 uppercase">{defaultProvider}</strong>
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {PROVIDER_METAS.map((meta) => {
            const isSelected = defaultProvider === meta.id;
            const isConfigured = Boolean(providers[meta.id]?.isConfigured);

            return (
              <div
                key={meta.id}
                onClick={() => handleSetDefault(meta.id)}
                className={`cursor-pointer rounded-lg p-3.5 border transition-all text-left flex flex-col justify-between ${
                  isSelected
                    ? 'border-indigo-600 bg-indigo-50/40 ring-1 ring-indigo-600 shadow-2xs'
                    : 'border-stone-200 bg-white hover:border-stone-300 hover:bg-stone-50/40'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <meta.icon className={`w-4 h-4 ${meta.accentColor}`} />
                    <span className="text-xs font-semibold text-stone-900">{meta.name}</span>
                  </div>
                  <div
                    className={`w-4 h-4 rounded-full border flex items-center justify-center ${
                      isSelected
                        ? 'border-indigo-600 bg-indigo-600 text-white'
                        : 'border-stone-300 bg-white'
                    }`}
                  >
                    {isSelected && <Check className="w-2.5 h-2.5 stroke-[3]" />}
                  </div>
                </div>

                <div className="flex items-center justify-between mt-1 text-[11px]">
                  <span className="text-stone-500 truncate max-w-[120px]">{meta.badge}</span>
                  <span
                    className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${
                      isConfigured
                        ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                        : 'bg-stone-100 text-stone-500 border border-stone-200'
                    }`}
                  >
                    {isConfigured ? 'Ready' : 'Not configured'}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ========================================================= */}
      {/* Provider Configuration Cards (OpenAI, Gemini, Claude)     */}
      {/* ========================================================= */}
      <div className="mt-8 space-y-6">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-stone-600">
          Provider Credentials & Health Verification
        </h3>

        <div className="grid grid-cols-1 gap-5">
          {PROVIDER_METAS.map((meta) => {
            const providerInfo = providers[meta.id];
            const isConfigured = Boolean(providerInfo?.isConfigured);
            const isDefault = defaultProvider === meta.id;
            const isEditingKey = isEditing[meta.id] || !isConfigured;
            const currentDraft = inputKeys[meta.id];
            const isTesting = testing[meta.id];
            const isSaving = saving[meta.id];
            const testResult = testResults[meta.id];
            const showPassword = showKeyInput[meta.id];

            return (
              <div
                key={meta.id}
                className={`rounded-xl border bg-white overflow-hidden transition-all shadow-2xs ${
                  isDefault ? 'border-indigo-300 ring-1 ring-indigo-200/50' : 'border-stone-200'
                }`}
              >
                {/* Card Header */}
                <div className="p-4 sm:p-5 border-b border-stone-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-stone-50/40">
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-9 h-9 rounded-lg ${meta.bgLight} ${meta.borderClass} border flex items-center justify-center shrink-0`}
                    >
                      <meta.icon className={`w-5 h-5 ${meta.accentColor}`} />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h4 className="text-sm font-bold text-stone-900">{meta.name}</h4>
                        {isDefault && (
                          <span className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded text-[10px] font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200">
                            <Zap className="w-2.5 h-2.5 fill-current" />
                            Default Engine
                          </span>
                        )}
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium border ${
                            isConfigured
                              ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                              : 'bg-stone-100 text-stone-600 border-stone-200'
                          }`}
                        >
                          {isConfigured ? (
                            <>
                              <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                              Key Configured
                            </>
                          ) : (
                            <>
                              <AlertCircle className="w-3 h-3 text-stone-400" />
                              Missing Key
                            </>
                          )}
                        </span>
                      </div>
                      <p className="text-xs text-stone-500 mt-0.5">{meta.tagline}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 self-start sm:self-auto">
                    <a
                      href={meta.docsUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-[11px] text-stone-500 hover:text-indigo-600 transition-colors"
                      title="Get an API Key"
                    >
                      <span>Get API Key</span>
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                </div>

                {/* Card Body */}
                <div className="p-4 sm:p-5 space-y-4">
                  {/* Recommended Models Pill List */}
                  <div className="flex items-center gap-2 flex-wrap text-[11px] text-stone-500">
                    <span className="font-medium text-stone-700">Supported Models:</span>
                    {meta.recommendedModels.map((m) => (
                      <span
                        key={m}
                        className="px-2 py-0.5 rounded bg-stone-100/90 text-stone-700 font-mono text-[10px] border border-stone-200"
                      >
                        {m}
                      </span>
                    ))}
                  </div>

                  {/* API Key Input / Masked Display */}
                  <div>
                    <label className="block text-xs font-medium text-stone-700 mb-1.5">
                      Secret API Key
                    </label>

                    {isConfigured && !isEditingKey ? (
                      /* Saved Masked Display State (Never redisplays full key) */
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 bg-stone-50 rounded-lg border border-stone-200">
                        <div className="flex items-center gap-2.5">
                          <Lock className="w-4 h-4 text-emerald-600 shrink-0" />
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-mono text-xs font-semibold text-stone-900 tracking-wider">
                                {providerInfo.maskedKey || '••••••••••••••••'}
                              </span>
                              <span className="text-[10px] text-stone-400 font-mono">
                                (Protected)
                              </span>
                            </div>
                            <p className="text-[11px] text-stone-500 mt-0.5">
                              Encrypted using AES-256-GCM on server. Plaintext is inaccessible from browser.
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setIsEditing((prev) => ({ ...prev, [meta.id]: true }));
                              setInputKeys((prev) => ({ ...prev, [meta.id]: '' }));
                            }}
                            className="h-8 text-xs px-2.5"
                          >
                            Replace Key
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDeleteKey(meta.id)}
                            className="h-8 text-xs text-red-600 hover:text-red-700 hover:bg-red-50 px-2"
                            title="Remove key"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      </div>
                    ) : (
                      /* Editing or Unconfigured State: Masked Input Field */
                      <div className="space-y-2">
                        <div className="relative flex items-center">
                          <div className="absolute left-3 text-stone-400 pointer-events-none">
                            <Key className="w-4 h-4" />
                          </div>
                          <input
                            type={showPassword ? 'text' : 'password'}
                            value={currentDraft}
                            onChange={(e) =>
                              setInputKeys((prev) => ({ ...prev, [meta.id]: e.target.value }))
                            }
                            placeholder={meta.placeholder}
                            autoComplete="off"
                            spellCheck={false}
                            className="w-full h-9.5 rounded-lg border border-stone-300 bg-white pl-9 pr-10 py-1.5 text-xs font-mono text-stone-900 placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-indigo-600 focus:border-transparent transition-all"
                          />
                          <button
                            type="button"
                            onClick={() =>
                              setShowKeyInput((prev) => ({ ...prev, [meta.id]: !prev[meta.id] }))
                            }
                            className="absolute right-3 text-stone-400 hover:text-stone-700 p-1"
                            title={showPassword ? 'Hide key' : 'Show key while typing'}
                          >
                            {showPassword ? (
                              <EyeOff className="w-4 h-4" />
                            ) : (
                              <Eye className="w-4 h-4" />
                            )}
                          </button>
                        </div>

                        <div className="flex items-center justify-between text-[11px] text-stone-500">
                          <span>{meta.keyPrefixHint}</span>
                          {isConfigured && isEditingKey && (
                            <button
                              type="button"
                              onClick={() => {
                                setIsEditing((prev) => ({ ...prev, [meta.id]: false }));
                                setInputKeys((prev) => ({ ...prev, [meta.id]: '' }));
                              }}
                              className="text-stone-500 hover:text-stone-900 font-medium underline"
                            >
                              Cancel replace
                            </button>
                          )}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Test Connection Results Banner */}
                  {testResult && (
                    <div
                      className={`p-3 rounded-lg border text-xs flex items-start gap-2.5 transition-all ${
                        testResult.success
                          ? 'bg-emerald-50/80 border-emerald-200 text-emerald-900'
                          : 'bg-red-50/80 border-red-200 text-red-900'
                      }`}
                    >
                      {testResult.success ? (
                        <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                      ) : (
                        <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                      )}
                      <div className="flex-1 space-y-1">
                        <div className="flex items-center justify-between flex-wrap gap-2">
                          <span className="font-semibold">
                            {testResult.success ? 'Connection Validated' : 'Connection Failed'}
                          </span>
                          {testResult.latencyMs > 0 && (
                            <span className="font-mono text-[10px] opacity-75">
                              {testResult.latencyMs}ms roundtrip
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] leading-relaxed opacity-90">
                          {testResult.message}
                        </p>
                        {testResult.modelsSample && testResult.modelsSample.length > 0 && (
                          <div className="pt-1 flex items-center gap-1.5 flex-wrap">
                            <span className="text-[10px] font-medium opacity-80">Verified Models:</span>
                            {testResult.modelsSample.map((mod) => (
                              <span
                                key={mod}
                                className="px-1.5 py-0.2 rounded bg-white/70 font-mono text-[10px] border border-current/20"
                              >
                                {mod}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Action Buttons */}
                  <div className="pt-2 flex items-center justify-between flex-wrap gap-3">
                    <div className="flex items-center gap-2">
                      {/* Test Connection Button: minimal low-cost call */}
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleTestConnection(meta.id)}
                        disabled={isTesting || (!currentDraft.trim() && !isConfigured)}
                        className="h-8 text-xs"
                      >
                        {isTesting ? (
                          <>
                            <RefreshCw className="w-3 h-3 animate-spin mr-1.5" />
                            Validating Key...
                          </>
                        ) : (
                          'Test Connection'
                        )}
                      </Button>

                      {/* Save Key Button (when editing or entering draft) */}
                      {isEditingKey && (
                        <Button
                          variant="primary"
                          size="sm"
                          onClick={() => handleSaveKey(meta.id)}
                          disabled={isSaving || !currentDraft.trim()}
                          className="h-8 text-xs"
                        >
                          {isSaving ? 'Encrypting & Saving...' : 'Save Key'}
                        </Button>
                      )}
                    </div>

                    {!isDefault && isConfigured && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleSetDefault(meta.id)}
                        className="h-8 text-xs text-stone-600 hover:text-indigo-600"
                      >
                        Set as Default Engine
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
