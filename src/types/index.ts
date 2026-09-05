export interface User {
  id: string;
  email: string;
  displayName?: string;
  photoURL?: string;
  provider: 'password' | 'microsoft.com' | 'demo';
}

export interface ProjectStats {
  apiCount: number;
  requirementCount: number;
  testCaseCount: number;
}

export interface ProjectOneDriveSubfolder {
  id: string;
  name: string;
  webUrl?: string;
  itemCount?: number;
}

export interface ProjectOneDriveFolder {
  rootFolderId: string;
  rootFolderName: string;
  rootWebUrl?: string;
  subfolders: {
    apis?: ProjectOneDriveSubfolder;
    requirements?: ProjectOneDriveSubfolder;
    testcases?: ProjectOneDriveSubfolder;
    reports?: ProjectOneDriveSubfolder;
  };
  createdAt: string;
}

export interface Project {
  id: string;
  userId: string;
  name: string;
  description: string;
  targetEnvironmentUrl?: string;
  createdAt: string; // ISO string
  updatedAt: string; // ISO string
  stats: ProjectStats;
  oneDriveFolder?: ProjectOneDriveFolder;
}

export interface OneDriveAccount {
  id?: string;
  displayName: string;
  userPrincipalName: string;
  mail?: string;
}

export interface OneDriveFileItem {
  id: string;
  name: string;
  size: number;
  webUrl: string;
  lastModifiedDateTime: string;
  folder?: {
    childCount: number;
  };
  file?: {
    mimeType: string;
  };
  category?: 'apis' | 'requirements' | 'testcases' | 'reports' | 'root';
  description?: string;
  downloadUrl?: string;
}

export interface OneDriveStatusResponse {
  connected: boolean;
  isConfigured: boolean;
  account: {
    email: string;
    name: string;
  } | null;
  error?: string | null;
  message?: string | null;
  isDemo?: boolean;
}

export type NavigationView = 
  | 'dashboard'
  | 'projects'
  | 'apis'
  | 'requirements'
  | 'test-cases'
  | 'files'
  | 'settings';

export interface ToastMessage {
  id: string;
  type: 'success' | 'error' | 'info';
  title: string;
  description?: string;
}
