import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  type ReactNode,
} from 'react';
import { useAuth } from './AuthContext';
import type {
  ProjectOneDriveFolder,
  OneDriveFileItem,
  OneDriveStatusResponse,
} from '../types';

interface OneDriveContextType {
  isConfigured: boolean;
  isConnected: boolean;
  isDemo: boolean;
  account: { email: string; name: string } | null;
  loading: boolean;
  error: string | null;
  connectOneDrive: () => Promise<void>;
  connectDemoOneDrive: () => Promise<void>;
  disconnectOneDrive: () => Promise<void>;
  refreshStatus: () => Promise<void>;
  provisionProjectFolder: (
    projectId: string,
    projectName: string
  ) => Promise<ProjectOneDriveFolder>;
  fetchProjectFiles: (
    projectId: string,
    folderIds?: {
      apis?: string;
      requirements?: string;
      testcases?: string;
      reports?: string;
      root?: string;
    },
    category?: string
  ) => Promise<OneDriveFileItem[]>;
  uploadFile: (
    projectId: string,
    folderId: string,
    category: 'apis' | 'requirements' | 'testcases' | 'reports',
    fileName: string,
    content: string
  ) => Promise<OneDriveFileItem>;
}

const OneDriveContext = createContext<OneDriveContextType | undefined>(undefined);

export function OneDriveProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [isConfigured, setIsConfigured] = useState<boolean>(false);
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const [isDemo, setIsDemo] = useState<boolean>(false);
  const [account, setAccount] = useState<{ email: string; name: string } | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const checkStatus = useCallback(async () => {
    if (!user) {
      setIsConnected(false);
      setIsDemo(false);
      setAccount(null);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const res = await fetch(`/api/onedrive/status?userId=${encodeURIComponent(user.id)}`);
      if (!res.ok) {
        throw new Error('Failed to retrieve OneDrive status');
      }
      const data: OneDriveStatusResponse = await res.json();
      setIsConfigured(data.isConfigured);
      setIsConnected(data.connected);
      setIsDemo(Boolean(data.isDemo));
      setAccount(data.account);
      if (data.error) {
        setError(data.message || data.error);
      } else {
        setError(null);
      }
    } catch (err: any) {
      console.warn('OneDrive status fetch error:', err);
      // Still fetch configuration status
      try {
        const cfgRes = await fetch('/api/onedrive/config');
        if (cfgRes.ok) {
          const cfg = await cfgRes.json();
          setIsConfigured(cfg.isConfigured);
        }
      } catch {
        // ignore
      }
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    checkStatus();
  }, [checkStatus]);

  // Listen for OAuth completion message from popup window
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      // Validate origin if needed
      const origin = event.origin;
      if (
        !origin.endsWith('.run.app') &&
        !origin.includes('localhost') &&
        !origin.includes('127.0.0.1')
      ) {
        return;
      }

      if (event.data?.type === 'ONEDRIVE_AUTH_SUCCESS') {
        setError(null);
        checkStatus();
      } else if (event.data?.type === 'ONEDRIVE_AUTH_ERROR') {
        setError(event.data.error || 'Microsoft OAuth authentication failed');
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [checkStatus]);

  // Initiate Microsoft OAuth 2.0 flow
  const connectOneDrive = async (): Promise<void> => {
    if (!user) {
      throw new Error('You must be signed in to CoverageAI to connect OneDrive.');
    }

    setError(null);

    // 1. Fetch OAuth URL from server
    const response = await fetch(
      `/api/onedrive/auth-url?userId=${encodeURIComponent(user.id)}`
    );

    if (!response.ok) {
      const errJson = await response.json().catch(() => ({}));
      if (errJson.error === 'NOT_CONFIGURED') {
        throw new Error(
          'Microsoft OAuth credentials (MS_CLIENT_ID & MS_CLIENT_SECRET) are not configured in environment variables. You can connect via Demo Sandbox mode or configure Azure App Registration.'
        );
      }
      throw new Error(errJson.message || 'Failed to generate authorization URL');
    }

    const { url } = await response.json();

    // 2. Open popup directly to Microsoft OAuth authorization URL
    // (Per iframe guidelines: open provider URL directly in popup)
    const popupWidth = 600;
    const popupHeight = 720;
    const left = window.screenX + (window.outerWidth - popupWidth) / 2;
    const top = window.screenY + (window.outerHeight - popupHeight) / 2;

    const popup = window.open(
      url,
      'microsoft_onedrive_oauth',
      `width=${popupWidth},height=${popupHeight},left=${left},top=${top},status=no,resizable=yes`
    );

    if (!popup) {
      throw new Error(
        'Popup window was blocked by your browser. Please allow popups for this site to complete Microsoft OAuth authorization.'
      );
    }
  };

  // Connect via simulated demo sandbox mode
  const connectDemoOneDrive = async (): Promise<void> => {
    if (!user) return;
    setError(null);
    try {
      setLoading(true);
      const res = await fetch('/api/onedrive/demo-connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user.id,
          email: user.email || 'qa.engineer@outlook.com',
          name: user.displayName || 'QA Workspace User',
        }),
      });
      if (!res.ok) throw new Error('Failed to connect demo OneDrive');
      await checkStatus();
    } catch (err: any) {
      setError(err.message || 'Failed to connect demo OneDrive');
    } finally {
      setLoading(false);
    }
  };

  // Disconnect OneDrive
  const disconnectOneDrive = async (): Promise<void> => {
    if (!user) return;
    try {
      setLoading(true);
      await fetch('/api/onedrive/disconnect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id }),
      });
      setIsConnected(false);
      setIsDemo(false);
      setAccount(null);
      setError(null);
    } catch (err: any) {
      console.error('Failed to disconnect OneDrive:', err);
    } finally {
      setLoading(false);
    }
  };

  // Provision dedicated folder structure in OneDrive for a project
  const provisionProjectFolder = async (
    projectId: string,
    projectName: string
  ): Promise<ProjectOneDriveFolder> => {
    if (!user) throw new Error('Not authenticated');

    const res = await fetch('/api/onedrive/projects/create-folder', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId: user.id,
        projectId,
        projectName,
      }),
    });

    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      if (errData.error === 'TOKEN_REVOKED') {
        setIsConnected(false);
        setError('Your OneDrive authorization expired or was revoked. Please reconnect.');
        throw new Error('TOKEN_REVOKED');
      }
      throw new Error(errData.message || 'Failed to create project OneDrive folders');
    }

    return await res.json();
  };

  // Fetch project files
  const fetchProjectFiles = async (
    projectId: string,
    folderIds?: {
      apis?: string;
      requirements?: string;
      testcases?: string;
      reports?: string;
      root?: string;
    },
    category?: string
  ): Promise<OneDriveFileItem[]> => {
    if (!user) return [];

    const params = new URLSearchParams({
      userId: user.id,
    });

    if (category) params.append('category', category);
    if (folderIds?.apis) params.append('apisFolderId', folderIds.apis);
    if (folderIds?.requirements) params.append('reqsFolderId', folderIds.requirements);
    if (folderIds?.testcases) params.append('testcasesFolderId', folderIds.testcases);
    if (folderIds?.reports) params.append('reportsFolderId', folderIds.reports);
    if (folderIds?.root) params.append('rootFolderId', folderIds.root);

    const res = await fetch(`/api/onedrive/projects/${projectId}/files?${params.toString()}`);
    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      if (errData.error === 'TOKEN_REVOKED') {
        setIsConnected(false);
        setError('Your OneDrive authorization expired. Please reconnect.');
        throw new Error('TOKEN_REVOKED');
      }
      throw new Error(errData.error || 'Failed to list files');
    }

    const data = await res.json();
    return data.files || [];
  };

  // Upload or create a file
  const uploadFile = async (
    projectId: string,
    folderId: string,
    category: 'apis' | 'requirements' | 'testcases' | 'reports',
    fileName: string,
    content: string
  ): Promise<OneDriveFileItem> => {
    if (!user) throw new Error('Not authenticated');

    const res = await fetch('/api/onedrive/upload', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId: user.id,
        projectId,
        folderId,
        category,
        fileName,
        content,
      }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Failed to upload file to OneDrive');
    }

    const data = await res.json();
    return data.file;
  };

  return (
    <OneDriveContext.Provider
      value={{
        isConfigured,
        isConnected,
        isDemo,
        account,
        loading,
        error,
        connectOneDrive,
        connectDemoOneDrive,
        disconnectOneDrive,
        refreshStatus: checkStatus,
        provisionProjectFolder,
        fetchProjectFiles,
        uploadFile,
      }}
    >
      {children}
    </OneDriveContext.Provider>
  );
}

export function useOneDrive(): OneDriveContextType {
  const context = useContext(OneDriveContext);
  if (!context) {
    throw new Error('useOneDrive must be used within a OneDriveProvider');
  }
  return context;
}
