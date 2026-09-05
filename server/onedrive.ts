import fs from 'node:fs';
import path from 'node:path';

export interface StoredOneDriveTokens {
  accessToken: string;
  refreshToken: string;
  expiresAt: number; // timestamp in ms
  connectedAt: string; // ISO string
  account: {
    id?: string;
    email: string;
    name: string;
  };
  isDemo?: boolean;
}

const DATA_DIR = path.join(process.cwd(), '.data');
const TOKENS_FILE = path.join(DATA_DIR, 'onedrive_tokens.json');

// In-memory cache backed by file
const tokenCache = new Map<string, StoredOneDriveTokens>();

function initTokenStorage() {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    if (fs.existsSync(TOKENS_FILE)) {
      const raw = fs.readFileSync(TOKENS_FILE, 'utf-8');
      const data = JSON.parse(raw);
      if (data && typeof data === 'object') {
        Object.entries(data).forEach(([uid, tokens]) => {
          tokenCache.set(uid, tokens as StoredOneDriveTokens);
        });
      }
    }
  } catch (err) {
    console.warn('Failed to load onedrive tokens from file:', err);
  }
}

initTokenStorage();

function persistTokensToFile() {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    const obj: Record<string, StoredOneDriveTokens> = {};
    tokenCache.forEach((v, k) => {
      obj[k] = v;
    });
    fs.writeFileSync(TOKENS_FILE, JSON.stringify(obj, null, 2), 'utf-8');
  } catch (err) {
    console.error('Failed to persist onedrive tokens to file:', err);
  }
}

export function getStoredTokens(userId: string): StoredOneDriveTokens | null {
  return tokenCache.get(userId) || null;
}

export function saveTokens(userId: string, tokens: StoredOneDriveTokens): void {
  tokenCache.set(userId, tokens);
  persistTokensToFile();
}

export function clearTokens(userId: string): void {
  tokenCache.delete(userId);
  persistTokensToFile();
}

export function getMicrosoftOAuthConfig() {
  const clientId = process.env.MS_CLIENT_ID || '';
  const clientSecret = process.env.MS_CLIENT_SECRET || '';
  const appUrl = process.env.APP_URL || 'http://localhost:3000';
  const redirectUri =
    process.env.MS_REDIRECT_URI || `${appUrl.replace(/\/$/, '')}/api/onedrive/callback`;

  return {
    clientId,
    clientSecret,
    redirectUri,
    isConfigured: Boolean(clientId && clientSecret),
  };
}

export function buildAuthorizationUrl(userId: string, customRedirectUri?: string): string {
  const { clientId, redirectUri } = getMicrosoftOAuthConfig();
  const finalRedirectUri = customRedirectUri || redirectUri;

  const params = new URLSearchParams({
    client_id: clientId,
    response_type: 'code',
    redirect_uri: finalRedirectUri,
    response_mode: 'query',
    scope: 'Files.ReadWrite.AppFolder offline_access',
    state: JSON.stringify({ userId }),
    prompt: 'select_account',
  });

  return `https://login.microsoftonline.com/common/oauth2/v2.0/authorize?${params.toString()}`;
}

export async function exchangeCodeForTokens(
  code: string,
  customRedirectUri?: string
): Promise<{
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}> {
  const { clientId, clientSecret, redirectUri } = getMicrosoftOAuthConfig();
  const finalRedirectUri = customRedirectUri || redirectUri;

  const bodyParams = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    grant_type: 'authorization_code',
    code,
    redirect_uri: finalRedirectUri,
    scope: 'Files.ReadWrite.AppFolder offline_access',
  });

  const response = await fetch('https://login.microsoftonline.com/common/oauth2/v2.0/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: bodyParams.toString(),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('Microsoft token exchange failed:', response.status, errorText);
    throw new Error(`Token exchange failed: ${errorText}`);
  }

  const data = await response.json();
  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresIn: Number(data.expires_in) || 3600,
  };
}

export async function refreshAccessToken(refreshToken: string): Promise<{
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}> {
  const { clientId, clientSecret } = getMicrosoftOAuthConfig();

  const bodyParams = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    grant_type: 'refresh_token',
    refresh_token: refreshToken,
    scope: 'Files.ReadWrite.AppFolder offline_access',
  });

  const response = await fetch('https://login.microsoftonline.com/common/oauth2/v2.0/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: bodyParams.toString(),
  });

  if (!response.ok) {
    const errText = await response.text();
    console.error('Failed to refresh token:', response.status, errText);
    throw new Error('TOKEN_REVOKED');
  }

  const data = await response.json();
  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token || refreshToken,
    expiresIn: Number(data.expires_in) || 3600,
  };
}

export async function getValidAccessToken(userId: string): Promise<string> {
  const record = getStoredTokens(userId);
  if (!record) {
    throw new Error('NOT_CONNECTED');
  }

  if (record.isDemo) {
    return 'DEMO_ACCESS_TOKEN';
  }

  // Check if expiring within 5 minutes (300,000 ms)
  const isExpiringSoon = Date.now() + 300000 >= record.expiresAt;
  if (!isExpiringSoon) {
    return record.accessToken;
  }

  // Refresh token
  try {
    const refreshed = await refreshAccessToken(record.refreshToken);
    const updated: StoredOneDriveTokens = {
      ...record,
      accessToken: refreshed.accessToken,
      refreshToken: refreshed.refreshToken,
      expiresAt: Date.now() + refreshed.expiresIn * 1000,
    };
    saveTokens(userId, updated);
    return refreshed.accessToken;
  } catch (err) {
    // Mark as revoked
    console.warn(`Token refresh failed for user ${userId}, invalidating session`);
    clearTokens(userId);
    throw new Error('TOKEN_REVOKED');
  }
}

export async function fetchUserProfile(accessToken: string): Promise<{
  id: string;
  displayName: string;
  email: string;
}> {
  const response = await fetch('https://graph.microsoft.com/v1.0/me', {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch user profile: ${response.statusText}`);
  }

  const data = await response.json();
  return {
    id: data.id || '',
    displayName: data.displayName || 'Microsoft User',
    email: data.mail || data.userPrincipalName || 'user@outlook.com',
  };
}

// Ensure AppRoot exists and return its metadata
export async function getAppRootFolder(accessToken: string): Promise<{
  id: string;
  name: string;
  webUrl: string;
}> {
  const response = await fetch('https://graph.microsoft.com/v1.0/me/drive/special/approot', {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Failed to access OneDrive approot: ${errText}`);
  }

  const data = await response.json();
  return {
    id: data.id,
    name: data.name || 'Apps/CoverageAI',
    webUrl: data.webUrl,
  };
}

// Create a folder inside a parent folder
export async function createGraphFolder(
  accessToken: string,
  parentId: string,
  folderName: string
): Promise<{ id: string; name: string; webUrl: string }> {
  const response = await fetch(
    `https://graph.microsoft.com/v1.0/me/drive/items/${parentId}/children`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: folderName,
        folder: {},
        '@microsoft.graph.conflictBehavior': 'rename',
      }),
    }
  );

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Failed to create folder ${folderName}: ${err}`);
  }

  const data = await response.json();
  return {
    id: data.id,
    name: data.name,
    webUrl: data.webUrl,
  };
}

// Upload a text/json/yaml file to a folder
export async function uploadGraphFile(
  accessToken: string,
  folderId: string,
  fileName: string,
  content: string | Buffer,
  contentType: string = 'text/plain'
): Promise<{
  id: string;
  name: string;
  webUrl: string;
  size: number;
  lastModifiedDateTime: string;
}> {
  const encodedName = encodeURIComponent(fileName);
  const response = await fetch(
    `https://graph.microsoft.com/v1.0/me/drive/items/${folderId}:/${encodedName}:/content`,
    {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': contentType,
      },
      body: content,
    }
  );

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Failed to upload file ${fileName}: ${err}`);
  }

  const data = await response.json();
  return {
    id: data.id,
    name: data.name,
    webUrl: data.webUrl,
    size: data.size || 0,
    lastModifiedDateTime: data.lastModifiedDateTime,
  };
}

// Fetch children of a folder
export async function listGraphFolderChildren(
  accessToken: string,
  folderId: string
): Promise<any[]> {
  const response = await fetch(
    `https://graph.microsoft.com/v1.0/me/drive/items/${folderId}/children?$select=id,name,size,webUrl,lastModifiedDateTime,folder,file,@microsoft.graph.downloadUrl`,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    }
  );

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Failed to list children for folder ${folderId}: ${err}`);
  }

  const data = await response.json();
  return data.value || [];
}

// ==========================================
// In-Memory Demo Storage for Sandbox Mode
// ==========================================
interface DemoItem {
  id: string;
  name: string;
  size: number;
  webUrl: string;
  lastModifiedDateTime: string;
  category: 'apis' | 'requirements' | 'testcases' | 'reports';
  folderId: string;
  content?: string;
  file?: { mimeType: string };
}

const demoProjectFiles = new Map<string, DemoItem[]>();

export function getDemoProjectFiles(projectId: string): DemoItem[] {
  if (!demoProjectFiles.has(projectId)) {
    // Generate default template files for this project
    const now = new Date().toISOString();
    const files: DemoItem[] = [
      {
        id: `demo_api_1_${projectId}`,
        name: 'openapi-spec.v3.1.yaml',
        size: 8420,
        webUrl: 'https://onedrive.live.com/view.aspx?resid=DEMO_SPEC_API_1',
        lastModifiedDateTime: now,
        category: 'apis',
        folderId: `demo_folder_apis_${projectId}`,
        file: { mimeType: 'text/yaml' },
        content: `openapi: 3.1.0\ninfo:\n  title: CoverageAI Contract Specification\n  version: 1.0.0\npaths:\n  /v1/auth/tokens:\n    post:\n      summary: Exchange credentials for session token\n      responses:\n        '200':\n          description: Success`,
      },
      {
        id: `demo_api_2_${projectId}`,
        name: 'schema-validation.json',
        size: 3200,
        webUrl: 'https://onedrive.live.com/view.aspx?resid=DEMO_SPEC_API_2',
        lastModifiedDateTime: now,
        category: 'apis',
        folderId: `demo_folder_apis_${projectId}`,
        file: { mimeType: 'application/json' },
      },
      {
        id: `demo_req_1_${projectId}`,
        name: 'PRD-Acceptance-Criteria.md',
        size: 5120,
        webUrl: 'https://onedrive.live.com/view.aspx?resid=DEMO_REQ_1',
        lastModifiedDateTime: now,
        category: 'requirements',
        folderId: `demo_folder_requirements_${projectId}`,
        file: { mimeType: 'text/markdown' },
        content: `# Specification Verification Requirements\n\n1. Token issuance must return JWT within 120ms\n2. Invalid credentials must return 401 Unauthorized\n3. Scopes must enforce least-privilege AppFolder constraints`,
      },
      {
        id: `demo_req_2_${projectId}`,
        name: 'traceability-matrix.xlsx',
        size: 14500,
        webUrl: 'https://onedrive.live.com/view.aspx?resid=DEMO_REQ_2',
        lastModifiedDateTime: now,
        category: 'requirements',
        folderId: `demo_folder_requirements_${projectId}`,
        file: { mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' },
      },
      {
        id: `demo_test_1_${projectId}`,
        name: 'e2e-regression-suite.json',
        size: 12800,
        webUrl: 'https://onedrive.live.com/view.aspx?resid=DEMO_TEST_1',
        lastModifiedDateTime: now,
        category: 'testcases',
        folderId: `demo_folder_testcases_${projectId}`,
        file: { mimeType: 'application/json' },
      },
      {
        id: `demo_test_2_${projectId}`,
        name: 'boundary-payloads.json',
        size: 6700,
        webUrl: 'https://onedrive.live.com/view.aspx?resid=DEMO_TEST_2',
        lastModifiedDateTime: now,
        category: 'testcases',
        folderId: `demo_folder_testcases_${projectId}`,
        file: { mimeType: 'application/json' },
      },
      {
        id: `demo_rep_1_${projectId}`,
        name: 'coverage-execution-summary.html',
        size: 24200,
        webUrl: 'https://onedrive.live.com/view.aspx?resid=DEMO_REP_1',
        lastModifiedDateTime: now,
        category: 'reports',
        folderId: `demo_folder_reports_${projectId}`,
        file: { mimeType: 'text/html' },
      },
      {
        id: `demo_rep_2_${projectId}`,
        name: 'drift-analysis-report.json',
        size: 4100,
        webUrl: 'https://onedrive.live.com/view.aspx?resid=DEMO_REP_2',
        lastModifiedDateTime: now,
        category: 'reports',
        folderId: `demo_folder_reports_${projectId}`,
        file: { mimeType: 'application/json' },
      },
    ];
    demoProjectFiles.set(projectId, files);
  }
  return demoProjectFiles.get(projectId)!;
}

export function addDemoFile(
  projectId: string,
  file: {
    name: string;
    category: 'apis' | 'requirements' | 'testcases' | 'reports';
    content: string;
    folderId: string;
  }
): DemoItem {
  const files = getDemoProjectFiles(projectId);
  const now = new Date().toISOString();
  const newItem: DemoItem = {
    id: `demo_file_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    name: file.name,
    size: Buffer.byteLength(file.content, 'utf8'),
    webUrl: `https://onedrive.live.com/view.aspx?resid=DEMO_${encodeURIComponent(file.name)}`,
    lastModifiedDateTime: now,
    category: file.category,
    folderId: file.folderId,
    content: file.content,
    file: {
      mimeType: file.name.endsWith('.json')
        ? 'application/json'
        : file.name.endsWith('.yaml') || file.name.endsWith('.yml')
        ? 'text/yaml'
        : file.name.endsWith('.md')
        ? 'text/markdown'
        : 'text/plain',
    },
  };
  files.unshift(newItem);
  return newItem;
}
