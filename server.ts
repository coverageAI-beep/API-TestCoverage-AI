import express, { Request, Response } from 'express';
import path from 'node:path';
import 'dotenv/config';
import {
  getStoredTokens,
  saveTokens,
  clearTokens,
  getValidAccessToken,
  getMicrosoftOAuthConfig,
  buildAuthorizationUrl,
  exchangeCodeForTokens,
  fetchUserProfile,
  getAppRootFolder,
  createGraphFolder,
  uploadGraphFile,
  listGraphFolderChildren,
  getDemoProjectFiles,
  addDemoFile,
  getGraphFileContent,
  getDemoFileContent,
  type StoredOneDriveTokens,
} from './server/onedrive';
import {
  getSafeAiProvidersConfig,
  saveAiProviderKey,
  deleteAiProviderKey,
  setDefaultAiProvider,
  getDecryptedKey,
  recordTestResult,
  testProviderConnection,
  type AiProviderId,
} from './server/aiSecrets';

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: '15mb' }));
  app.use(express.urlencoded({ extended: true, limit: '15mb' }));

  // ==========================================
  // Health & Diagnostics
  // ==========================================
  app.get('/api/health', (req: Request, res: Response) => {
    res.json({ status: 'ok', time: new Date().toISOString() });
  });

  // ==========================================
  // Microsoft OneDrive OAuth & Graph API Routes
  // ==========================================

  // 1. Get OAuth Configuration Status
  app.get('/api/onedrive/config', (req: Request, res: Response) => {
    const config = getMicrosoftOAuthConfig();
    res.json({
      isConfigured: config.isConfigured,
      redirectUri: config.redirectUri,
      clientIdPresent: Boolean(config.clientId),
      scopes: ['Files.ReadWrite.AppFolder', 'offline_access'],
      endpoint: 'https://login.microsoftonline.com/common/oauth2/v2.0',
    });
  });

  // 2. Get User OneDrive Connection Status
  app.get('/api/onedrive/status', async (req: Request, res: Response) => {
    const userId = (req.query.userId as string) || '';
    if (!userId) {
      res.status(400).json({ error: 'userId is required' });
      return;
    }

    const config = getMicrosoftOAuthConfig();
    const stored = getStoredTokens(userId);

    if (!stored) {
      res.json({
        connected: false,
        isConfigured: config.isConfigured,
        account: null,
      });
      return;
    }

    if (stored.isDemo) {
      res.json({
        connected: true,
        isConfigured: config.isConfigured,
        isDemo: true,
        account: stored.account,
      });
      return;
    }

    // Verify token validity or refresh
    try {
      await getValidAccessToken(userId);
      res.json({
        connected: true,
        isConfigured: config.isConfigured,
        isDemo: false,
        account: stored.account,
      });
    } catch (err: any) {
      const isRevoked = err.message === 'TOKEN_REVOKED';
      res.json({
        connected: false,
        isConfigured: config.isConfigured,
        account: stored.account,
        error: isRevoked ? 'TOKEN_REVOKED' : 'TOKEN_EXPIRED',
        message: 'OneDrive authorization expired or revoked. Please reconnect.',
      });
    }
  });

  // 3. Generate OAuth Authorization URL
  app.get('/api/onedrive/auth-url', (req: Request, res: Response) => {
    const userId = (req.query.userId as string) || '';
    if (!userId) {
      res.status(400).json({ error: 'userId is required' });
      return;
    }

    const config = getMicrosoftOAuthConfig();
    if (!config.isConfigured) {
      res.status(400).json({
        error: 'NOT_CONFIGURED',
        message: 'MS_CLIENT_ID and MS_CLIENT_SECRET are not configured in environment variables.',
        redirectUri: config.redirectUri,
      });
      return;
    }

    const url = buildAuthorizationUrl(userId);
    res.json({ url, redirectUri: config.redirectUri });
  });

  // 4. OAuth Callback Handler
  const handleOAuthCallback = async (req: Request, res: Response) => {
    const { code, state, error, error_description } = req.query;

    if (error) {
      console.error('OneDrive OAuth callback error:', error, error_description);
      const safeError = String(error_description || error).replace(/'/g, "\\'");
      res.send(`
        <!DOCTYPE html>
        <html>
          <head><title>OneDrive Authorization Error</title></head>
          <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; background: #fafaf9;">
            <div style="max-width: 480px; padding: 32px; background: white; border: 1px solid #e7e5e4; border-radius: 12px; text-align: center; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05);">
              <div style="width: 44px; height: 44px; border-radius: 50%; background: #fee2e2; color: #dc2626; display: flex; align-items: center; justify-content: center; margin: 0 auto 16px; font-weight: bold; font-size: 20px;">✕</div>
              <h2 style="font-size: 18px; color: #1c1917; margin: 0 0 8px;">Authorization Declined or Failed</h2>
              <p style="font-size: 13px; color: #78716c; line-height: 1.5; margin: 0 0 20px;">${safeError}</p>
              <script>
                if (window.opener) {
                  window.opener.postMessage({ type: 'ONEDRIVE_AUTH_ERROR', error: '${safeError}' }, '*');
                  setTimeout(() => window.close(), 2500);
                }
              </script>
            </div>
          </body>
        </html>
      `);
      return;
    }

    if (!code || typeof code !== 'string') {
      res.status(400).send('Missing authorization code');
      return;
    }

    let userId = '';
    try {
      if (typeof state === 'string') {
        const parsed = JSON.parse(state);
        userId = parsed.userId || '';
      }
    } catch {
      userId = (state as string) || '';
    }

    try {
      const tokenResult = await exchangeCodeForTokens(code);
      const profile = await fetchUserProfile(tokenResult.accessToken);

      const tokensRecord: StoredOneDriveTokens = {
        accessToken: tokenResult.accessToken,
        refreshToken: tokenResult.refreshToken,
        expiresAt: Date.now() + tokenResult.expiresIn * 1000,
        connectedAt: new Date().toISOString(),
        account: {
          id: profile.id,
          email: profile.email,
          name: profile.displayName,
        },
      };

      saveTokens(userId, tokensRecord);

      res.send(`
        <!DOCTYPE html>
        <html>
          <head><title>OneDrive Connected</title></head>
          <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; background: #fafaf9;">
            <div style="max-width: 420px; padding: 32px; background: white; border: 1px solid #e7e5e4; border-radius: 12px; text-align: center; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05);">
              <div style="width: 44px; height: 44px; border-radius: 50%; background: #e0e7ff; color: #4338ca; display: flex; align-items: center; justify-content: center; margin: 0 auto 16px; font-weight: bold; font-size: 20px;">✓</div>
              <h2 style="font-size: 18px; color: #1c1917; margin: 0 0 8px;">OneDrive Connected!</h2>
              <p style="font-size: 13px; color: #78716c; line-height: 1.5; margin: 0 0 16px;">
                Connected as <strong>${profile.email}</strong>. Closing window...
              </p>
              <script>
                if (window.opener) {
                  window.opener.postMessage({
                    type: 'ONEDRIVE_AUTH_SUCCESS',
                    userId: '${userId}',
                    account: {
                      email: '${profile.email}',
                      name: '${profile.displayName}'
                    }
                  }, '*');
                  window.close();
                } else {
                  window.location.href = '/';
                }
              </script>
            </div>
          </body>
        </html>
      `);
    } catch (err: any) {
      console.error('Failed to complete OneDrive authentication:', err);
      const safeMsg = (err.message || 'Authentication error').replace(/'/g, "\\'");
      res.send(`
        <!DOCTYPE html>
        <html>
          <head><title>Connection Failed</title></head>
          <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; padding: 32px; text-align: center;">
            <p style="color: #dc2626;">Error: ${safeMsg}</p>
            <script>
              if (window.opener) {
                window.opener.postMessage({ type: 'ONEDRIVE_AUTH_ERROR', error: '${safeMsg}' }, '*');
              }
            </script>
          </body>
        </html>
      `);
    }
  };

  app.get('/api/onedrive/callback', handleOAuthCallback);
  app.get('/api/onedrive/callback/', handleOAuthCallback);

  // 5. Connect Demo / Sandbox OneDrive
  app.post('/api/onedrive/demo-connect', (req: Request, res: Response) => {
    const { userId, email, name } = req.body;
    if (!userId) {
      res.status(400).json({ error: 'userId is required' });
      return;
    }

    const demoAccount = {
      email: email || 'qa.engineer@outlook.com',
      name: name || 'QA Enterprise Workspace',
    };

    saveTokens(userId, {
      accessToken: 'DEMO_ACCESS_TOKEN',
      refreshToken: 'DEMO_REFRESH_TOKEN',
      expiresAt: Date.now() + 365 * 24 * 3600 * 1000,
      connectedAt: new Date().toISOString(),
      account: demoAccount,
      isDemo: true,
    });

    res.json({
      success: true,
      account: demoAccount,
      isDemo: true,
    });
  });

  // 6. Disconnect OneDrive
  app.post('/api/onedrive/disconnect', (req: Request, res: Response) => {
    const { userId } = req.body;
    if (userId) {
      clearTokens(userId);
    }
    res.json({ success: true });
  });

  // 7. Provision Dedicated OneDrive Folder Structure for Project
  // Subfolders: apis, requirements, testcases, reports
  app.post('/api/onedrive/projects/create-folder', async (req: Request, res: Response) => {
    const { userId, projectId, projectName } = req.body;

    if (!userId || !projectId || !projectName) {
      res.status(400).json({ error: 'userId, projectId, and projectName are required' });
      return;
    }

    const tokens = getStoredTokens(userId);
    if (!tokens) {
      res.status(401).json({
        error: 'NOT_CONNECTED',
        message: 'Please connect your Microsoft OneDrive first.',
      });
      return;
    }

    const now = new Date().toISOString();

    // If demo account: construct simulated folder hierarchy
    if (tokens.isDemo) {
      const demoRootId = `demo_root_${projectId}`;
      const subfolders = {
        apis: {
          id: `demo_folder_apis_${projectId}`,
          name: 'apis',
          webUrl: `https://onedrive.live.com/?id=demo_folder_apis_${projectId}`,
          itemCount: 2,
        },
        requirements: {
          id: `demo_folder_requirements_${projectId}`,
          name: 'requirements',
          webUrl: `https://onedrive.live.com/?id=demo_folder_requirements_${projectId}`,
          itemCount: 2,
        },
        testcases: {
          id: `demo_folder_testcases_${projectId}`,
          name: 'testcases',
          webUrl: `https://onedrive.live.com/?id=demo_folder_testcases_${projectId}`,
          itemCount: 2,
        },
        reports: {
          id: `demo_folder_reports_${projectId}`,
          name: 'reports',
          webUrl: `https://onedrive.live.com/?id=demo_folder_reports_${projectId}`,
          itemCount: 2,
        },
      };

      // Populate demo files
      getDemoProjectFiles(projectId);

      res.json({
        rootFolderId: demoRootId,
        rootFolderName: `CoverageAI - ${projectName}`,
        rootWebUrl: `https://onedrive.live.com/?id=${demoRootId}`,
        subfolders,
        createdAt: now,
      });
      return;
    }

    // Real Microsoft Graph API Integration
    try {
      const accessToken = await getValidAccessToken(userId);
      const approot = await getAppRootFolder(accessToken);

      // Create dedicated project folder inside approot
      const cleanProjectName = projectName.replace(/[/\\?%*:|"<>]/g, '-').trim();
      const folderTitle = `CoverageAI - ${cleanProjectName}`;
      const projectFolder = await createGraphFolder(accessToken, approot.id, folderTitle);

      // Create dedicated subfolders in parallel: apis, requirements, testcases, reports
      const [apisFolder, reqsFolder, testcasesFolder, reportsFolder] = await Promise.all([
        createGraphFolder(accessToken, projectFolder.id, 'apis'),
        createGraphFolder(accessToken, projectFolder.id, 'requirements'),
        createGraphFolder(accessToken, projectFolder.id, 'testcases'),
        createGraphFolder(accessToken, projectFolder.id, 'reports'),
      ]);

      // Seed starter files into subfolders so user can immediately inspect contents
      try {
        const readmeContent = `# ${projectName} - Specification Repository\n\nManaged automatically by CoverageAI.\n\n### Subfolder Structure:\n- **apis/**: OpenAPI 3.0/3.1 specs, JSON schemas, endpoint contracts\n- **requirements/**: Product requirements, acceptance criteria, traceability matrices\n- **testcases/**: Automated test suites, boundary payloads, regression fixtures\n- **reports/**: Execution summaries, test pass/fail logs, contract drift analyses\n`;

        const openApiTemplate = `openapi: 3.1.0\ninfo:\n  title: ${projectName} Contract\n  version: 1.0.0\n  description: API contract managed by CoverageAI\npaths:\n  /health:\n    get:\n      summary: Service Health Check\n      responses:\n        '200':\n          description: Healthy\n`;

        const prdTemplate = `# Acceptance Criteria: ${projectName}\n\n## 1. Scope & Verification\n- All API endpoints must adhere to documented schemas\n- Responses must return within SLA thresholds\n- Error payloads must include correlation IDs\n`;

        await Promise.allSettled([
          uploadGraphFile(accessToken, projectFolder.id, 'README.md', readmeContent, 'text/markdown'),
          uploadGraphFile(accessToken, apisFolder.id, 'openapi-contract.yaml', openApiTemplate, 'text/yaml'),
          uploadGraphFile(accessToken, reqsFolder.id, 'acceptance-criteria.md', prdTemplate, 'text/markdown'),
        ]);
      } catch (seedErr) {
        console.warn('Initial file seeding completed with warnings:', seedErr);
      }

      res.json({
        rootFolderId: projectFolder.id,
        rootFolderName: projectFolder.name,
        rootWebUrl: projectFolder.webUrl,
        subfolders: {
          apis: {
            id: apisFolder.id,
            name: apisFolder.name,
            webUrl: apisFolder.webUrl,
            itemCount: 1,
          },
          requirements: {
            id: reqsFolder.id,
            name: reqsFolder.name,
            webUrl: reqsFolder.webUrl,
            itemCount: 1,
          },
          testcases: {
            id: testcasesFolder.id,
            name: testcasesFolder.name,
            webUrl: testcasesFolder.webUrl,
            itemCount: 0,
          },
          reports: {
            id: reportsFolder.id,
            name: reportsFolder.name,
            webUrl: reportsFolder.webUrl,
            itemCount: 0,
          },
        },
        createdAt: now,
      });
    } catch (err: any) {
      console.error('Failed to create OneDrive project folders:', err);
      if (err.message === 'TOKEN_REVOKED' || err.message === 'NOT_CONNECTED') {
        res.status(401).json({
          error: 'TOKEN_REVOKED',
          message: 'OneDrive authorization revoked or expired. Please reconnect.',
        });
        return;
      }
      res.status(500).json({
        error: 'FOLDER_CREATION_FAILED',
        message: err.message || 'Failed to create folders in Microsoft OneDrive',
      });
    }
  });

  // 8. List Project Files from OneDrive
  app.get('/api/onedrive/projects/:projectId/files', async (req: Request, res: Response) => {
    const { projectId } = req.params;
    const userId = (req.query.userId as string) || '';
    const category = (req.query.category as string) || '';

    if (!userId || !projectId) {
      res.status(400).json({ error: 'userId and projectId are required' });
      return;
    }

    const tokens = getStoredTokens(userId);
    if (!tokens) {
      res.status(401).json({
        error: 'NOT_CONNECTED',
        message: 'Please connect Microsoft OneDrive to view files.',
      });
      return;
    }

    if (tokens.isDemo) {
      let files = getDemoProjectFiles(projectId);
      if (category && category !== 'all') {
        files = files.filter((f) => f.category === category);
      }
      res.json({ files });
      return;
    }

    try {
      const accessToken = await getValidAccessToken(userId);
      const apisFolderId = req.query.apisFolderId as string;
      const reqsFolderId = req.query.reqsFolderId as string;
      const testcasesFolderId = req.query.testcasesFolderId as string;
      const reportsFolderId = req.query.reportsFolderId as string;
      const rootFolderId = req.query.rootFolderId as string;

      const folderQueries: { id: string; category: string }[] = [];

      if (category === 'apis' && apisFolderId) {
        folderQueries.push({ id: apisFolderId, category: 'apis' });
      } else if (category === 'requirements' && reqsFolderId) {
        folderQueries.push({ id: reqsFolderId, category: 'requirements' });
      } else if (category === 'testcases' && testcasesFolderId) {
        folderQueries.push({ id: testcasesFolderId, category: 'testcases' });
      } else if (category === 'reports' && reportsFolderId) {
        folderQueries.push({ id: reportsFolderId, category: 'reports' });
      } else {
        // Fetch all subfolders
        if (apisFolderId) folderQueries.push({ id: apisFolderId, category: 'apis' });
        if (reqsFolderId) folderQueries.push({ id: reqsFolderId, category: 'requirements' });
        if (testcasesFolderId) folderQueries.push({ id: testcasesFolderId, category: 'testcases' });
        if (reportsFolderId) folderQueries.push({ id: reportsFolderId, category: 'reports' });
        if (rootFolderId) folderQueries.push({ id: rootFolderId, category: 'root' });
      }

      if (folderQueries.length === 0 && rootFolderId) {
        folderQueries.push({ id: rootFolderId, category: 'root' });
      }

      const results = await Promise.all(
        folderQueries.map(async ({ id, category: cat }) => {
          try {
            const items = await listGraphFolderChildren(accessToken, id);
            return items.map((item: any) => ({
              id: item.id,
              name: item.name,
              size: item.size || 0,
              webUrl: item.webUrl,
              lastModifiedDateTime: item.lastModifiedDateTime,
              folder: item.folder ? { childCount: item.folder.childCount } : undefined,
              file: item.file ? { mimeType: item.file.mimeType } : undefined,
              category: cat,
              downloadUrl: item['@microsoft.graph.downloadUrl'],
            }));
          } catch (err) {
            console.warn(`Failed to list children for folder ${id}:`, err);
            return [];
          }
        })
      );

      const flatFiles = results.flat();
      res.json({ files: flatFiles });
    } catch (err: any) {
      console.error('Failed to fetch OneDrive project files:', err);
      if (err.message === 'TOKEN_REVOKED' || err.message === 'NOT_CONNECTED') {
        res.status(401).json({
          error: 'TOKEN_REVOKED',
          message: 'OneDrive session expired. Please reconnect.',
        });
        return;
      }
      res.status(500).json({ error: err.message || 'Failed to list files from OneDrive' });
    }
  });

  // 9. Upload or Create File in OneDrive Folder
  app.post('/api/onedrive/upload', async (req: Request, res: Response) => {
    const { userId, projectId, folderId, category, fileName, content } = req.body;

    if (!userId || !folderId || !fileName) {
      res.status(400).json({ error: 'userId, folderId, and fileName are required' });
      return;
    }

    const tokens = getStoredTokens(userId);
    if (!tokens) {
      res.status(401).json({ error: 'NOT_CONNECTED' });
      return;
    }

    const rawContent = content || '';

    if (tokens.isDemo) {
      const demoItem = addDemoFile(projectId || 'demo_proj', {
        name: fileName,
        category: category || 'apis',
        content: rawContent,
        folderId,
      });
      res.json({ file: demoItem });
      return;
    }

    try {
      const accessToken = await getValidAccessToken(userId);
      const mimeType = fileName.endsWith('.json')
        ? 'application/json'
        : fileName.endsWith('.yaml') || fileName.endsWith('.yml')
        ? 'text/yaml'
        : fileName.endsWith('.md')
        ? 'text/markdown'
        : 'text/plain';

      const uploaded = await uploadGraphFile(
        accessToken,
        folderId,
        fileName,
        rawContent,
        mimeType
      );

      res.json({
        file: {
          id: uploaded.id,
          name: uploaded.name,
          size: uploaded.size,
          webUrl: uploaded.webUrl,
          lastModifiedDateTime: uploaded.lastModifiedDateTime,
          category,
        },
      });
    } catch (err: any) {
      console.error('Failed to upload file to OneDrive:', err);
      res.status(500).json({ error: err.message || 'Failed to upload file to OneDrive' });
    }
  });

  // 10. Get File Content from OneDrive
  app.get('/api/onedrive/file-content', async (req: Request, res: Response) => {
    const userId = (req.query.userId as string) || '';
    const itemId = (req.query.itemId as string) || '';
    const projectId = (req.query.projectId as string) || '';

    if (!userId || !itemId) {
      res.status(400).json({ error: 'userId and itemId are required' });
      return;
    }

    const tokens = getStoredTokens(userId);
    if (!tokens) {
      res.status(401).json({ error: 'NOT_CONNECTED' });
      return;
    }

    if (tokens.isDemo) {
      const content = getDemoFileContent(projectId, itemId);
      res.json({ content: content || '' });
      return;
    }

    try {
      const accessToken = await getValidAccessToken(userId);
      const content = await getGraphFileContent(accessToken, itemId);
      res.json({ content });
    } catch (err: any) {
      console.error('Failed to get file content from OneDrive:', err);
      res.status(500).json({ error: err.message || 'Failed to download file content' });
    }
  });

  // ==========================================
  // AI Providers & Encrypted Key Management
  // ==========================================

  // 1. Get user AI Provider configuration (Only returns masked keys, NEVER raw secrets)
  app.get('/api/ai/config', (req: Request, res: Response) => {
    const userId = (req.query.userId as string) || 'default_user';
    try {
      const config = getSafeAiProvidersConfig(userId);
      res.json(config);
    } catch (err: any) {
      console.error('Failed to get AI provider config:', err);
      res.status(500).json({ error: err.message || 'Failed to retrieve AI provider configuration' });
    }
  });

  // 2. Save an encrypted provider key (Server-side AES-256-GCM encryption)
  app.post('/api/ai/save-key', (req: Request, res: Response) => {
    const { userId, provider, apiKey } = req.body;
    if (!userId || !provider || !apiKey) {
      res.status(400).json({ error: 'userId, provider, and apiKey are required' });
      return;
    }

    if (!['openai', 'gemini', 'anthropic'].includes(provider)) {
      res.status(400).json({ error: `Invalid provider: ${provider}. Must be 'openai', 'gemini', or 'anthropic'` });
      return;
    }

    try {
      const savedInfo = saveAiProviderKey(userId, provider as AiProviderId, apiKey);
      res.json({ success: true, provider: savedInfo });
    } catch (err: any) {
      console.error(`Failed to save AI key for ${provider}:`, err);
      res.status(500).json({ error: err.message || 'Failed to save encrypted API key' });
    }
  });

  // 3. Remove an encrypted provider key
  app.post('/api/ai/delete-key', (req: Request, res: Response) => {
    const { userId, provider } = req.body;
    if (!userId || !provider) {
      res.status(400).json({ error: 'userId and provider are required' });
      return;
    }

    try {
      deleteAiProviderKey(userId, provider as AiProviderId);
      res.json({ success: true, message: `Key for ${provider} removed.` });
    } catch (err: any) {
      console.error(`Failed to delete AI key for ${provider}:`, err);
      res.status(500).json({ error: err.message || 'Failed to remove API key' });
    }
  });

  // 4. Update the default provider preference
  app.post('/api/ai/set-default', (req: Request, res: Response) => {
    const { userId, defaultProvider } = req.body;
    if (!userId || !defaultProvider) {
      res.status(400).json({ error: 'userId and defaultProvider are required' });
      return;
    }

    if (!['openai', 'gemini', 'anthropic'].includes(defaultProvider)) {
      res.status(400).json({ error: `Invalid provider: ${defaultProvider}` });
      return;
    }

    try {
      setDefaultAiProvider(userId, defaultProvider as AiProviderId);
      res.json({ success: true, defaultProvider });
    } catch (err: any) {
      console.error('Failed to set default AI provider:', err);
      res.status(500).json({ error: err.message || 'Failed to update default provider' });
    }
  });

  // 5. Test connection with minimal, low-cost call (e.g. list models)
  app.post('/api/ai/test-connection', async (req: Request, res: Response) => {
    const { userId, provider, apiKey } = req.body;
    if (!userId || !provider) {
      res.status(400).json({ error: 'userId and provider are required' });
      return;
    }

    if (!['openai', 'gemini', 'anthropic'].includes(provider)) {
      res.status(400).json({ error: `Invalid provider: ${provider}` });
      return;
    }

    // Use passed apiKey or retrieve stored decrypted key
    let keyToTest = (apiKey || '').trim();
    const isStoredKey = !keyToTest;

    if (!keyToTest) {
      keyToTest = getDecryptedKey(userId, provider as AiProviderId) || '';
    }

    if (!keyToTest) {
      res.status(400).json({
        success: false,
        message: `No API key provided or configured for ${provider}. Please enter a valid API key first.`,
        latencyMs: 0,
      });
      return;
    }

    try {
      const result = await testProviderConnection(provider as AiProviderId, keyToTest);

      // If testing stored key, record the test result
      if (isStoredKey) {
        recordTestResult(
          userId,
          provider as AiProviderId,
          result.success ? 'success' : 'failure',
          result.success ? undefined : result.message
        );
      }

      res.json(result);
    } catch (err: any) {
      console.error(`Error during connection test for ${provider}:`, err);
      res.status(500).json({
        success: false,
        message: err.message || 'Connection test encountered an internal error',
        latencyMs: 0,
      });
    }
  });

  // ==========================================
  // Vite Middleware (Dev) or Static Serving (Prod)
  // ==========================================
  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req: Request, res: Response) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`CoverageAI Server running on port ${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Fatal server startup error:', err);
  process.exit(1);
});
