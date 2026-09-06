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
  generateTestCasesWithAi,
  synthesizeTestCaseSuite,
  type TestCaseItem,
  type TestCasesGenerationResult,
  type ApiDefinitionPayload,
} from './aiGenerator';
import type { AiProviderId } from './aiSecrets';

export function sanitizeFileName(name: string): string {
  return name.replace(/[/\\?%*:|"<>]/g, '_').trim();
}

export interface TestSuiteFileContent {
  id?: string;
  apiId?: string;
  apiName: string;
  generatedAt?: string;
  updatedAt?: string;
  version?: string;
  provider?: AiProviderId;
  model?: string;
  testCases: TestCaseItem[];
}

/**
 * 1. Check if test cases JSON file already exists for this API in the OneDrive "testcases" folder
 */
export async function checkExistingTestCases(
  userId: string,
  projectId: string,
  apiName: string,
  testcasesFolderId?: string
): Promise<{
  exists: boolean;
  testCases?: TestCaseItem[];
  fileName?: string;
  fileId?: string;
  webUrl?: string;
  rawContent?: string;
}> {
  const tokens = getStoredTokens(userId);
  if (!tokens) {
    return { exists: false };
  }

  const cleanName = sanitizeFileName(apiName);
  const targetFileNames = [
    `${cleanName}-testcases.json`,
    `${cleanName}.json`,
    `${apiName.replace(/\s+/g, '_')}-testcases.json`,
    'test-suite.json',
  ];

  if (tokens.isDemo) {
    const demoFiles = getDemoProjectFiles(projectId);
    const tcFiles = demoFiles.filter((f) => f.category === 'testcases' || f.name.endsWith('.json'));

    const found = tcFiles.find((f) =>
      targetFileNames.some((target) => f.name.toLowerCase() === target.toLowerCase())
    );

    if (found && found.content) {
      try {
        const parsed: TestSuiteFileContent | TestCaseItem[] = JSON.parse(found.content);
        const testCases: TestCaseItem[] = Array.isArray(parsed)
          ? parsed
          : Array.isArray(parsed.testCases)
          ? parsed.testCases
          : [];

        return {
          exists: true,
          testCases,
          fileName: found.name,
          fileId: found.id,
          webUrl: found.webUrl,
          rawContent: found.content,
        };
      } catch (err) {
        console.warn('Error parsing demo test cases JSON:', err);
      }
    }
    return { exists: false };
  }

  if (!testcasesFolderId) {
    return { exists: false };
  }

  try {
    const accessToken = await getValidAccessToken(userId);
    const items = await listGraphFolderChildren(accessToken, testcasesFolderId);

    const matched = items.find((item: any) =>
      targetFileNames.some((target) => item.name?.toLowerCase() === target.toLowerCase())
    );

    if (matched) {
      const rawContent = await getGraphFileContent(accessToken, matched.id);
      try {
        const parsed: TestSuiteFileContent | TestCaseItem[] = JSON.parse(rawContent);
        const testCases: TestCaseItem[] = Array.isArray(parsed)
          ? parsed
          : Array.isArray(parsed.testCases)
          ? parsed.testCases
          : [];

        return {
          exists: true,
          testCases,
          fileName: matched.name,
          fileId: matched.id,
          webUrl: matched.webUrl,
          rawContent,
        };
      } catch (err) {
        console.warn('Error parsing OneDrive test cases JSON:', err);
      }
    }
  } catch (err) {
    console.warn('Error checking existing test cases in OneDrive:', err);
  }

  return { exists: false };
}

/**
 * 2. Save Test Cases JSON file into the OneDrive "testcases" folder via Microsoft Graph
 */
export async function saveTestCasesToOneDrive(
  userId: string,
  projectId: string,
  fileName: string,
  testCases: TestCaseItem[],
  testcasesFolderId?: string,
  apiId?: string,
  apiName?: string,
  provider?: AiProviderId,
  model?: string
): Promise<{
  id: string;
  name: string;
  webUrl: string;
  size: number;
  lastModifiedDateTime: string;
}> {
  const tokens = getStoredTokens(userId);
  if (!tokens) {
    throw new Error('OneDrive authentication required to save test cases');
  }

  const now = new Date().toISOString();
  const filePayload: TestSuiteFileContent = {
    id: `suite_${Date.now()}`,
    apiId: apiId || `api_${Date.now()}`,
    apiName: apiName || fileName.replace(/-testcases\.json$/, ''),
    updatedAt: now,
    version: '1.0.0',
    provider,
    model,
    testCases,
  };

  const jsonContent = JSON.stringify(filePayload, null, 2);

  // Demo mode
  if (tokens.isDemo) {
    const demoItem = updateOrCreateDemoFile(projectId, {
      name: fileName,
      category: 'testcases',
      content: jsonContent,
      folderId: testcasesFolderId || `demo_folder_testcases_${projectId}`,
    });
    return {
      id: demoItem.id,
      name: demoItem.name,
      webUrl: demoItem.webUrl,
      size: demoItem.size,
      lastModifiedDateTime: demoItem.lastModifiedDateTime,
    };
  }

  // Live OneDrive via Microsoft Graph
  if (!testcasesFolderId) {
    throw new Error('OneDrive "testcases" folder ID not found for this project.');
  }

  const accessToken = await getValidAccessToken(userId);
  const uploaded = await uploadGraphFile(
    accessToken,
    testcasesFolderId,
    fileName,
    jsonContent,
    'application/json'
  );

  return {
    id: uploaded.id,
    name: uploaded.name,
    webUrl: uploaded.webUrl,
    size: uploaded.size,
    lastModifiedDateTime: uploaded.lastModifiedDateTime || new Date().toISOString(),
  };
}

/**
 * 3. List all Test Cases files in the project's OneDrive "testcases" folder
 */
export async function listTestCasesFiles(
  userId: string,
  projectId: string,
  testcasesFolderId?: string
): Promise<Array<{ id: string; name: string; size: number; lastModifiedDateTime: string; webUrl?: string }>> {
  const tokens = getStoredTokens(userId);
  if (!tokens) return [];

  if (tokens.isDemo) {
    const demoFiles = getDemoProjectFiles(projectId);
    return demoFiles
      .filter((f) => f.category === 'testcases' || f.name.endsWith('-testcases.json') || f.name.endsWith('.json'))
      .map((f) => ({
        id: f.id,
        name: f.name,
        size: f.size,
        lastModifiedDateTime: f.lastModifiedDateTime,
        webUrl: f.webUrl,
      }));
  }

  if (!testcasesFolderId) return [];

  try {
    const accessToken = await getValidAccessToken(userId);
    const items = await listGraphFolderChildren(accessToken, testcasesFolderId);
    return items
      .filter((i: any) => !i.folder && (i.name.endsWith('.json') || i.file?.mimeType === 'application/json'))
      .map((i: any) => ({
        id: i.id,
        name: i.name,
        size: i.size || 0,
        lastModifiedDateTime: i.lastModifiedDateTime || new Date().toISOString(),
        webUrl: i.webUrl,
      }));
  } catch (err) {
    console.warn('Failed to list testcases folder in OneDrive:', err);
    return [];
  }
}
