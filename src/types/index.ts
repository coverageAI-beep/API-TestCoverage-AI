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

export type ApiCoverageStatus = 'not_analyzed' | 'partial' | 'good';

export type ApiAuthType = 'none' | 'bearer' | 'apiKey' | 'oauth2' | 'basic' | 'custom';

export interface ApiEndpointError {
  id: string;
  statusCode: number;
  name: string;
  description?: string;
  schema?: string;
}

export interface ApiEndpointParam {
  name: string;
  in: 'path' | 'query' | 'header';
  required: boolean;
  type?: string;
  description?: string;
}

export interface ApiEndpoint {
  id: string;
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH' | 'HEAD' | 'OPTIONS';
  path: string;
  summary: string;
  description?: string;
  parameters?: ApiEndpointParam[];
  requestSchema?: string;
  responseSchema?: string;
  responseStatusCode?: number;
  errorResponses: ApiEndpointError[];
}

export interface ApiSpec {
  id: string;
  projectId: string;
  name: string;
  description?: string;
  baseUrl: string;
  version?: string;
  authType: ApiAuthType;
  authDetails?: string;
  businessRules: string;
  validationRules: string;
  endpoints: ApiEndpoint[];
  oneDriveItemId?: string;
  oneDriveWebUrl?: string;
  createdAt: string;
  updatedAt: string;
  sourceType: 'manual' | 'openapi_upload' | 'openapi_paste';
  rawSpecContent?: string;
}

export interface ApiReference {
  id: string;
  projectId: string;
  name: string;
  baseUrl: string;
  endpointCount: number;
  oneDriveItemId?: string;
  oneDriveWebUrl?: string;
  coverageStatus: ApiCoverageStatus;
  authType: ApiAuthType;
  createdAt: string;
  updatedAt: string;
  description?: string;
}

export interface ToastMessage {
  id: string;
  type: 'success' | 'error' | 'info';
  title: string;
  description?: string;
}

export type AiProviderId = 'openai' | 'gemini' | 'anthropic';

export interface AiProviderInfo {
  id: AiProviderId;
  name: string;
  isConfigured: boolean;
  maskedKey?: string;
  lastTestedAt?: string;
  lastStatus?: 'success' | 'failure';
  lastError?: string;
  configuredAt?: string;
}

export interface AiProvidersConfigResponse {
  defaultProvider: AiProviderId;
  providers: Record<AiProviderId, AiProviderInfo>;
}

export interface RequirementDocument {
  id?: string;
  apiId: string;
  apiName: string;
  fileName: string;
  content: string;
  webUrl?: string;
  lastModifiedDateTime?: string;
  provider?: AiProviderId;
  model?: string;
}

export interface RequirementsDiffData {
  apiId: string;
  apiName: string;
  fileName: string;
  existingContent: string;
  newContent: string;
  existingFileId?: string;
  provider?: AiProviderId;
  model?: string;
  isFallback?: boolean;
}

export type TestCasePriority = 'High' | 'Medium' | 'Low';
export type TestCaseType = 'Positive' | 'Negative' | 'Edge' | 'Boundary';
export type TestCaseSource = 'AI-generated' | 'Manual';

export interface TestCase {
  id: string;
  title: string;
  linkedRequirements: string[];
  linkedEndpoint: string;
  preconditions: string;
  requestPayload: string;
  expectedResponse: string;
  assertions: string[];
  priority: TestCasePriority;
  type: TestCaseType;
  source: TestCaseSource;
  createdAt?: string;
  updatedAt?: string;
}

export interface TestSuiteDocument {
  id?: string;
  apiId: string;
  apiName: string;
  fileName: string;
  webUrl?: string;
  lastModifiedDateTime?: string;
  testCases: TestCase[];
  provider?: AiProviderId;
  model?: string;
  generatedAt?: string;
}


