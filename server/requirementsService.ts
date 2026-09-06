import { load as yamlLoad } from 'js-yaml';
import {
  getStoredTokens,
  getValidAccessToken,
  uploadGraphFile,
  listGraphFolderChildren,
  getGraphFileContent,
  getDemoProjectFiles,
  findDemoFileByName,
  updateOrCreateDemoFile,
} from './onedrive';
import {
  generateRequirementsWithAi,
  type ApiDefinitionPayload,
  type ApiEndpointInfo,
  type GenerationResult,
} from './aiGenerator';
import type { AiProviderId } from './aiSecrets';

export function sanitizeFileName(name: string): string {
  return name.replace(/[/\\?%*:|"<>]/g, '_').trim();
}

/**
 * Normalizes an OpenAPI 3.x / Swagger 2.x or CoverageAI JSON spec into ApiDefinitionPayload
 */
export function normalizeApiDefinition(rawContent: string, defaultName: string): ApiDefinitionPayload {
  let parsed: any = null;

  try {
    parsed = JSON.parse(rawContent);
  } catch {
    try {
      parsed = yamlLoad(rawContent);
    } catch (yamlErr) {
      console.warn('Could not parse as JSON or YAML:', yamlErr);
    }
  }

  if (!parsed || typeof parsed !== 'object') {
    return {
      id: `api_${Date.now()}`,
      name: defaultName,
      baseUrl: 'https://api.example.com',
      authType: 'bearer',
      endpoints: [],
    };
  }

  // Case 1: CoverageAI Native ApiSpec format
  if (Array.isArray(parsed.endpoints)) {
    return {
      id: parsed.id || `api_${Date.now()}`,
      name: parsed.name || defaultName,
      description: parsed.description,
      baseUrl: parsed.baseUrl || 'https://api.example.com',
      version: parsed.version || '1.0.0',
      authType: parsed.authType || 'bearer',
      authDetails: parsed.authDetails,
      businessRules: parsed.businessRules || '',
      validationRules: parsed.validationRules || '',
      endpoints: parsed.endpoints,
      rawSpecContent: rawContent,
    };
  }

  // Case 2: Standard OpenAPI 3.x / 2.x specification
  const info = parsed.info || {};
  const paths = parsed.paths || {};
  const servers = parsed.servers || [];
  const baseUrl = servers[0]?.url || parsed.host || 'https://api.example.com';
  const name = info.title || defaultName;
  const version = info.version || '1.0.0';
  const description = info.description || '';

  const endpoints: ApiEndpointInfo[] = [];

  const validMethods = ['get', 'post', 'put', 'delete', 'patch', 'options', 'head'];
  for (const [pathStr, pathItem] of Object.entries<any>(paths)) {
    if (!pathItem || typeof pathItem !== 'object') continue;

    for (const [method, op] of Object.entries<any>(pathItem)) {
      if (!validMethods.includes(method.toLowerCase()) || !op || typeof op !== 'object') continue;

      const parameters: any[] = [];
      if (Array.isArray(op.parameters)) {
        op.parameters.forEach((p: any) => {
          parameters.push({
            name: p.name || 'param',
            in: p.in || 'query',
            required: Boolean(p.required),
            type: p.schema?.type || p.type || 'string',
            description: p.description,
          });
        });
      }

      // Request schema
      let requestSchema = '';
      if (op.requestBody?.content) {
        const firstContentType = Object.keys(op.requestBody.content)[0];
        const schemaObj = op.requestBody.content[firstContentType]?.schema;
        if (schemaObj) {
          requestSchema = JSON.stringify(schemaObj, null, 2);
        }
      }

      // Responses
      let responseStatusCode = 200;
      let responseSchema = '';
      const errorResponses: any[] = [];

      if (op.responses && typeof op.responses === 'object') {
        for (const [codeStr, respObj] of Object.entries<any>(op.responses)) {
          const codeNum = parseInt(codeStr, 10);
          if (codeNum >= 200 && codeNum < 300 && !responseSchema) {
            responseStatusCode = codeNum;
            const contentObj = respObj?.content;
            if (contentObj) {
              const ct = Object.keys(contentObj)[0];
              responseSchema = JSON.stringify(contentObj[ct]?.schema || { status: 'success' }, null, 2);
            } else {
              responseSchema = JSON.stringify({ message: respObj?.description || 'Success' }, null, 2);
            }
          } else if (codeNum >= 400) {
            errorResponses.push({
              statusCode: codeNum,
              name: respObj?.description || `HTTP ${codeNum}`,
              description: respObj?.description,
            });
          }
        }
      }

      endpoints.push({
        id: `ep_${method}_${pathStr.replace(/[^a-zA-Z0-9]/g, '_')}`,
        method: method.toUpperCase(),
        path: pathStr,
        summary: op.summary || `${method.toUpperCase()} ${pathStr}`,
        description: op.description,
        parameters,
        requestSchema: requestSchema || undefined,
        responseStatusCode,
        responseSchema: responseSchema || undefined,
        errorResponses,
      });
    }
  }

  return {
    id: `api_${Date.now()}`,
    name,
    description,
    baseUrl,
    version,
    authType: 'bearer',
    endpoints,
    rawSpecContent: rawContent,
  };
}

/**
 * 1. Load full API definition from the OneDrive "apis" folder via Microsoft Graph
 */
export async function loadApiDefinitionFromOneDrive(
  userId: string,
  projectId: string,
  apiName: string,
  apisFolderId?: string,
  fallbackSpec?: any
): Promise<ApiDefinitionPayload> {
  const tokens = getStoredTokens(userId);
  if (!tokens) {
    throw new Error('OneDrive is not connected. Please connect Microsoft OneDrive first.');
  }

  const cleanName = sanitizeFileName(apiName);
  const possibleFileNames = [
    `${cleanName}.json`,
    `${cleanName}.yaml`,
    `${cleanName}.yml`,
    `${apiName.replace(/\s+/g, '_')}.json`,
    `${apiName.replace(/\s+/g, '-')}.json`,
    'openapi-contract.yaml',
    'openapi-spec.v3.1.yaml',
  ];

  // Demo Sandbox Mode
  if (tokens.isDemo) {
    const demoFiles = getDemoProjectFiles(projectId);
    const apiDemoFiles = demoFiles.filter((f) => f.category === 'apis');

    // Find closest match
    let matched = apiDemoFiles.find((f) =>
      possibleFileNames.some((pName) => f.name.toLowerCase() === pName.toLowerCase())
    );

    if (!matched && apiDemoFiles.length > 0) {
      // Pick first matching or fallback
      matched = apiDemoFiles.find((f) => f.name.toLowerCase().includes(cleanName.toLowerCase())) || apiDemoFiles[0];
    }

    if (matched && matched.content) {
      return normalizeApiDefinition(matched.content, apiName);
    }

    // If fallback spec provided, seed into demo files
    if (fallbackSpec) {
      const serialized = JSON.stringify(fallbackSpec, null, 2);
      updateOrCreateDemoFile(projectId, {
        name: `${cleanName}.json`,
        category: 'apis',
        content: serialized,
        folderId: apisFolderId || `demo_folder_apis_${projectId}`,
      });
      return normalizeApiDefinition(serialized, apiName);
    }

    throw new Error(`API definition file for "${apiName}" not found in OneDrive apis folder.`);
  }

  // Real Microsoft Graph API Integration
  const accessToken = await getValidAccessToken(userId);

  if (!apisFolderId) {
    throw new Error('OneDrive apis folder identifier is required.');
  }

  const items = await listGraphFolderChildren(accessToken, apisFolderId);
  let matchedItem = items.find((item: any) =>
    possibleFileNames.some((pName) => item.name?.toLowerCase() === pName.toLowerCase())
  );

  if (!matchedItem) {
    matchedItem = items.find((item: any) =>
      item.name?.toLowerCase().includes(cleanName.toLowerCase())
    );
  }

  if (matchedItem) {
    const content = await getGraphFileContent(accessToken, matchedItem.id);
    return normalizeApiDefinition(content, apiName);
  }

  // If not yet uploaded to OneDrive but client provided current spec, upload it now
  if (fallbackSpec) {
    const serialized = JSON.stringify(fallbackSpec, null, 2);
    try {
      await uploadGraphFile(accessToken, apisFolderId, `${cleanName}.json`, serialized, 'application/json');
    } catch (e) {
      console.warn('Auto-syncing API to OneDrive apis folder completed with warning:', e);
    }
    return normalizeApiDefinition(serialized, apiName);
  }

  throw new Error(`API definition for "${apiName}" not found in OneDrive apis folder (${items.length} files inspected).`);
}

/**
 * 2. Check if a requirements document already exists for this API in the OneDrive "requirements" folder
 */
export async function checkExistingRequirements(
  userId: string,
  projectId: string,
  apiName: string,
  reqsFolderId?: string
): Promise<{
  exists: boolean;
  content?: string;
  fileName?: string;
  fileId?: string;
  webUrl?: string;
}> {
  const tokens = getStoredTokens(userId);
  if (!tokens) {
    return { exists: false };
  }

  const cleanName = sanitizeFileName(apiName);
  const targetFileNames = [
    `${cleanName}-requirements.md`,
    `${cleanName}.md`,
    `${apiName.replace(/\s+/g, '_')}-requirements.md`,
    'PRD-Acceptance-Criteria.md', // sample seeded in demo
  ];

  if (tokens.isDemo) {
    const demoFiles = getDemoProjectFiles(projectId);
    const reqFiles = demoFiles.filter((f) => f.category === 'requirements');

    const found = reqFiles.find((f) =>
      targetFileNames.some((target) => f.name.toLowerCase() === target.toLowerCase())
    );

    if (found && found.content) {
      return {
        exists: true,
        content: found.content,
        fileName: found.name,
        fileId: found.id,
        webUrl: found.webUrl,
      };
    }
    return { exists: false };
  }

  if (!reqsFolderId) {
    return { exists: false };
  }

  try {
    const accessToken = await getValidAccessToken(userId);
    const items = await listGraphFolderChildren(accessToken, reqsFolderId);

    const matched = items.find((item: any) =>
      targetFileNames.some((target) => item.name?.toLowerCase() === target.toLowerCase())
    );

    if (matched) {
      const content = await getGraphFileContent(accessToken, matched.id);
      return {
        exists: true,
        content,
        fileName: matched.name,
        fileId: matched.id,
        webUrl: matched.webUrl,
      };
    }
  } catch (err) {
    console.warn('Error checking existing requirements in OneDrive:', err);
  }

  return { exists: false };
}

/**
 * 3. Save Markdown Requirements file into the OneDrive "requirements" folder via Microsoft Graph
 */
export async function saveRequirementsFileToOneDrive(
  userId: string,
  projectId: string,
  fileName: string,
  content: string,
  reqsFolderId?: string
): Promise<{
  id: string;
  name: string;
  webUrl: string;
  size: number;
  lastModifiedDateTime: string;
}> {
  const tokens = getStoredTokens(userId);
  if (!tokens) {
    throw new Error('Microsoft OneDrive is not connected.');
  }

  if (tokens.isDemo) {
    const item = updateOrCreateDemoFile(projectId, {
      name: fileName,
      category: 'requirements',
      content,
      folderId: reqsFolderId || `demo_folder_requirements_${projectId}`,
    });

    return {
      id: item.id,
      name: item.name,
      webUrl: item.webUrl,
      size: item.size,
      lastModifiedDateTime: item.lastModifiedDateTime,
    };
  }

  if (!reqsFolderId) {
    throw new Error('Requirements folder identifier is required.');
  }

  const accessToken = await getValidAccessToken(userId);
  const uploaded = await uploadGraphFile(
    accessToken,
    reqsFolderId,
    fileName,
    content,
    'text/markdown'
  );

  return {
    id: uploaded.id,
    name: uploaded.name,
    webUrl: uploaded.webUrl,
    size: uploaded.size,
    lastModifiedDateTime: uploaded.lastModifiedDateTime,
  };
}

/**
 * 4. List all requirement markdown files in the project's OneDrive requirements folder
 */
export async function listRequirementsFiles(
  userId: string,
  projectId: string,
  reqsFolderId?: string
): Promise<Array<{
  id: string;
  name: string;
  size: number;
  webUrl: string;
  lastModifiedDateTime: string;
  matchedApiName?: string;
}>> {
  const tokens = getStoredTokens(userId);
  if (!tokens) return [];

  if (tokens.isDemo) {
    const demoFiles = getDemoProjectFiles(projectId);
    return demoFiles
      .filter((f) => f.category === 'requirements' && f.name.endsWith('.md'))
      .map((f) => ({
        id: f.id,
        name: f.name,
        size: f.size,
        webUrl: f.webUrl,
        lastModifiedDateTime: f.lastModifiedDateTime,
      }));
  }

  if (!reqsFolderId) return [];

  try {
    const accessToken = await getValidAccessToken(userId);
    const items = await listGraphFolderChildren(accessToken, reqsFolderId);
    return items
      .filter((item: any) => item.name && (item.name.endsWith('.md') || item.name.endsWith('.markdown')))
      .map((item: any) => ({
        id: item.id,
        name: item.name,
        size: item.size || 0,
        webUrl: item.webUrl,
        lastModifiedDateTime: item.lastModifiedDateTime,
      }));
  } catch (err) {
    console.warn('Failed to list requirements files from OneDrive:', err);
    return [];
  }
}
