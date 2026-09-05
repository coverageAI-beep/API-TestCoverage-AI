import { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useProjects } from '../../context/ProjectContext';
import { useOneDrive } from '../../context/OneDriveContext';
import { Button } from '../ui/Button';
import { useToast } from '../ui/Toast';
import { getInitials } from '../../lib/utils';
import { AiProvidersSettings } from '../settings/AiProvidersSettings';
import {
  User,
  Shield,
  Server,
  Key,
  CheckCircle2,
  AlertCircle,
  Copy,
  FolderGit2,
  Cloud,
  ExternalLink,
  RefreshCw,
  Sparkles,
} from 'lucide-react';

export function SettingsView() {
  const { user, isDemoMode, signOutUser } = useAuth();
  const { projects, activeProject } = useProjects();
  const {
    isConnected,
    isConfigured,
    isDemo,
    account,
    loading: oneDriveLoading,
    connectOneDrive,
    connectDemoOneDrive,
    disconnectOneDrive,
  } = useOneDrive();
  const { showToast } = useToast();
  const [activeTab, setActiveTab] = useState<'ai' | 'onedrive' | 'profile' | 'all'>('ai');
  const [copiedVar, setCopiedVar] = useState<string | null>(null);
  const [isConnecting, setIsConnecting] = useState<boolean>(false);

  const envVariables = [
    {
      name: 'VITE_FIREBASE_API_KEY',
      status: import.meta.env.VITE_FIREBASE_API_KEY ? 'Configured' : 'Missing (Using Local Storage)',
      configured: Boolean(import.meta.env.VITE_FIREBASE_API_KEY),
    },
    {
      name: 'VITE_FIREBASE_AUTH_DOMAIN',
      status: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN ? 'Configured' : 'Missing (Using Local Storage)',
      configured: Boolean(import.meta.env.VITE_FIREBASE_AUTH_DOMAIN),
    },
    {
      name: 'VITE_FIREBASE_PROJECT_ID',
      status: import.meta.env.VITE_FIREBASE_PROJECT_ID ? 'Configured' : 'Missing (Using Local Storage)',
      configured: Boolean(import.meta.env.VITE_FIREBASE_PROJECT_ID),
    },
    {
      name: 'MS_CLIENT_ID',
      status: isConfigured ? 'Configured' : 'Optional (Demo Mode Active)',
      configured: isConfigured,
    },
    {
      name: 'MS_CLIENT_SECRET',
      status: isConfigured ? 'Configured' : 'Optional (Demo Mode Active)',
      configured: isConfigured,
    },
  ];

  const handleConnectOneDrive = async () => {
    setIsConnecting(true);
    try {
      await connectOneDrive();
    } catch (err: any) {
      showToast({
        type: 'error',
        title: 'Connection Error',
        description: err.message || 'Failed to connect OneDrive',
      });
    } finally {
      setIsConnecting(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedVar(text);
    showToast({
      type: 'info',
      title: 'Copied to clipboard',
      description: text,
    });
    setTimeout(() => setCopiedVar(null), 2000);
  };

  return (
    <div className="flex flex-col gap-8 max-w-4xl">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-stone-900">
            Workspace Settings
          </h1>
          <p className="mt-1 text-xs text-stone-500">
            Manage your AI model providers, QA authentication profile, and environment configuration.
          </p>
        </div>

        {/* Settings Navigation Tabs */}
        <div className="flex items-center bg-stone-100 p-1 rounded-lg border border-stone-200 self-start sm:self-auto">
          <button
            type="button"
            onClick={() => setActiveTab('ai')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
              activeTab === 'ai'
                ? 'bg-white text-stone-900 shadow-xs'
                : 'text-stone-600 hover:text-stone-900'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
            <span>AI Providers</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('onedrive')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
              activeTab === 'onedrive'
                ? 'bg-white text-stone-900 shadow-xs'
                : 'text-stone-600 hover:text-stone-900'
            }`}
          >
            <Cloud className="w-3.5 h-3.5 text-indigo-600" />
            <span>OneDrive</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('profile')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
              activeTab === 'profile'
                ? 'bg-white text-stone-900 shadow-xs'
                : 'text-stone-600 hover:text-stone-900'
            }`}
          >
            <User className="w-3.5 h-3.5 text-stone-600" />
            <span>Profile & Scope</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('all')}
            className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
              activeTab === 'all'
                ? 'bg-white text-stone-900 shadow-xs'
                : 'text-stone-600 hover:text-stone-900'
            }`}
          >
            All
          </button>
        </div>
      </div>

      {/* AI Providers Section */}
      {(activeTab === 'ai' || activeTab === 'all') && (
        <AiProvidersSettings />
      )}

      {/* User Profile Card */}
      {(activeTab === 'profile' || activeTab === 'all') && (
        <>
          <div className="bg-white rounded-xl border border-stone-200 p-6 shadow-2xs">
        <div className="flex items-center gap-2 pb-4 border-b border-stone-100">
          <User className="w-4 h-4 text-stone-500" />
          <h2 className="text-sm font-semibold text-stone-900">User Identity & Profile</h2>
        </div>

        <div className="mt-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-stone-900 text-white font-mono text-base flex items-center justify-center font-semibold shrink-0">
              {getInitials(user?.displayName || user?.email || 'User')}
            </div>
            <div>
              <p className="text-sm font-semibold text-stone-900">
                {user?.displayName || 'QA Engineer'}
              </p>
              <p className="text-xs text-stone-500 font-mono mt-0.5">
                {user?.email}
              </p>
              <div className="flex items-center gap-2 mt-2">
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-mono bg-stone-100 border border-stone-200 text-stone-700">
                  <Shield className="w-3 h-3 text-stone-500" />
                  Provider: {user?.provider === 'microsoft.com' ? 'Microsoft OAuth' : user?.provider === 'password' ? 'Email & Password' : 'Demo Sandbox'}
                </span>
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-mono bg-indigo-50 border border-indigo-200 text-indigo-700">
                  User ID: {user?.id.slice(0, 16)}...
                </span>
              </div>
            </div>
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={signOutUser}
            className="text-xs"
          >
            Sign Out
          </Button>
        </div>
      </div>

      {/* Workspace & Isolation Status */}
      <div className="bg-white rounded-xl border border-stone-200 p-6 shadow-2xs">
        <div className="flex items-center gap-2 pb-4 border-b border-stone-100">
          <FolderGit2 className="w-4 h-4 text-stone-500" />
          <h2 className="text-sm font-semibold text-stone-900">Data Isolation Scope</h2>
        </div>

        <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="p-4 rounded-lg bg-stone-50 border border-stone-200/80">
            <p className="text-xs font-medium text-stone-500">Active Workspace</p>
            <p className="text-sm font-semibold text-stone-900 mt-1">
              {activeProject ? activeProject.name : 'No active project'}
            </p>
            <p className="text-[11px] text-stone-500 mt-0.5 font-mono">
              {activeProject ? activeProject.id : 'N/A'}
            </p>
          </div>

          <div className="p-4 rounded-lg bg-stone-50 border border-stone-200/80">
            <p className="text-xs font-medium text-stone-500">Total User Projects</p>
            <p className="text-sm font-semibold text-stone-900 mt-1">
              {projects.length} Workspaces
            </p>
            <p className="text-[11px] text-stone-500 mt-0.5">
              Strict per-user data isolation applied
            </p>
          </div>
        </div>
      </div>

      {/* Environment & Backend Fallback Status */}
      <div className="bg-white rounded-xl border border-stone-200 p-6 shadow-2xs">
        <div className="flex items-center justify-between pb-4 border-b border-stone-100">
          <div className="flex items-center gap-2">
            <Server className="w-4 h-4 text-stone-500" />
            <h2 className="text-sm font-semibold text-stone-900">Backend & Persistence Engine</h2>
          </div>
          <span
            className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium border ${
              isDemoMode
                ? 'bg-amber-50 text-amber-800 border-amber-200'
                : 'bg-emerald-50 text-emerald-800 border-emerald-200'
            }`}
          >
            {isDemoMode ? (
              <>
                <AlertCircle className="w-3.5 h-3.5 text-amber-600" />
                Local Demo Mode (Fallback)
              </>
            ) : (
              <>
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                Firebase Cloud Connected
              </>
            )}
          </span>
        </div>

        <p className="mt-4 text-xs text-stone-600 leading-relaxed">
          {isDemoMode
            ? 'Firebase client credentials are not defined in the environment. The platform is running smoothly using a fully portable in-memory and local storage simulation with per-user isolation.'
            : 'Firebase Authentication and Cloud Firestore are active. All project modifications are synchronized directly to your cloud instance.'}
        </p>

        {/* Environment variables checklist */}
        <div className="mt-5 border border-stone-200 rounded-lg overflow-hidden">
          <div className="px-4 py-2.5 bg-stone-50 border-b border-stone-200 text-[11px] font-semibold text-stone-700 uppercase tracking-wider flex items-center gap-1.5">
            <Key className="w-3.5 h-3.5 text-stone-500" />
            Environment Configuration Status (.env)
          </div>
          <div className="divide-y divide-stone-100 text-xs font-mono">
            {envVariables.map((ev) => (
              <div
                key={ev.name}
                className="px-4 py-2.5 flex items-center justify-between hover:bg-stone-50/60"
              >
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => copyToClipboard(ev.name)}
                    className="text-stone-700 hover:text-indigo-600 flex items-center gap-1 text-xs"
                    title="Click to copy name"
                  >
                    <span>{ev.name}</span>
                    <Copy className="w-3 h-3 text-stone-400" />
                  </button>
                  {copiedVar === ev.name && (
                    <span className="text-[10px] text-indigo-600 font-sans">Copied</span>
                  )}
                </div>
                <div className="flex items-center gap-1.5">
                  {ev.configured ? (
                    <span className="inline-flex items-center gap-1 text-emerald-700 text-[11px]">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      Ready
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-stone-400 text-[11px]">
                      Fallback Active
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
      </>
    )}

      {/* Microsoft OneDrive Integration Card */}
      {(activeTab === 'onedrive' || activeTab === 'all') && (
        <div className="bg-white border border-stone-200 rounded-lg p-6 shadow-2xs">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-md bg-indigo-50 border border-indigo-200 flex items-center justify-center text-indigo-600">
                <Cloud className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-stone-900">
                  Microsoft OneDrive (Graph REST API)
                </h3>
                <p className="text-xs text-stone-500">
                  Delegated scope: <code className="font-mono text-stone-700 bg-stone-100 px-1 py-0.5 rounded">Files.ReadWrite.AppFolder</code>
                </p>
              </div>
            </div>
            <span
              className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium border ${
                isConnected
                  ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                  : 'bg-stone-50 text-stone-700 border-stone-200'
              }`}
            >
              {isConnected ? (
                <>
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                  {isDemo ? 'Sandbox Demo Connected' : 'OneDrive Active'}
                </>
              ) : (
                <>
                  <AlertCircle className="w-3.5 h-3.5 text-stone-400" />
                  Not Connected
                </>
              )}
            </span>
          </div>

          <p className="mt-4 text-xs text-stone-600 leading-relaxed">
            CoverageAI utilizes the Microsoft Graph REST API via a standard OAuth 2.0 authorization code flow with automatic token refresh. All API contracts, requirements matrices, and test suites are stored in your dedicated AppFolder.
          </p>

          {isConnected && account && (
            <div className="mt-4 bg-stone-50 border border-stone-200 rounded-md p-3 text-xs flex items-center justify-between flex-wrap gap-2">
              <div>
                <span className="text-stone-500 block text-[11px]">Connected Microsoft Account:</span>
                <span className="font-semibold text-stone-900">{account.email}</span>{' '}
                <span className="text-stone-500">({account.name})</span>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={disconnectOneDrive}
                >
                  Disconnect OneDrive
                </Button>
              </div>
            </div>
          )}

          {!isConnected && (
            <div className="mt-4 flex items-center gap-3">
              <Button
                variant="primary"
                size="sm"
                onClick={handleConnectOneDrive}
                disabled={isConnecting}
                leftIcon={<Cloud className="w-4 h-4" />}
              >
                {isConnecting ? 'Opening OAuth...' : 'Connect Microsoft OneDrive'}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={connectDemoOneDrive}
              >
                Connect with Demo Sandbox
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
