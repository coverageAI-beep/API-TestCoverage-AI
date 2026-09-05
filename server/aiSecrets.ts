import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

export type AiProviderId = 'openai' | 'gemini' | 'anthropic';

export interface StoredEncryptedSecret {
  iv: string;
  authTag: string;
  ciphertext: string;
  maskedKey: string;
  configuredAt: string;
  lastTestedAt?: string;
  lastStatus?: 'success' | 'failure';
  lastError?: string;
}

export interface UserAiConfig {
  defaultProvider: AiProviderId;
  secrets: Partial<Record<AiProviderId, StoredEncryptedSecret>>;
}

export interface SafeAiProviderInfo {
  id: AiProviderId;
  name: string;
  isConfigured: boolean;
  maskedKey?: string;
  lastTestedAt?: string;
  lastStatus?: 'success' | 'failure';
  lastError?: string;
  configuredAt?: string;
}

export interface SafeAiProvidersResponse {
  defaultProvider: AiProviderId;
  providers: Record<AiProviderId, SafeAiProviderInfo>;
}

// Ensure data folder exists
const DATA_DIR = path.join(process.cwd(), 'data');
if (!fs.existsSync(DATA_DIR)) {
  try {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  } catch (e) {
    console.error('Failed to create data directory:', e);
  }
}

const SECRETS_FILE = path.join(DATA_DIR, 'ai_provider_secrets.json');
const SERVER_KEY_FILE = path.join(DATA_DIR, '.server_encryption_key');

// Get or initialize persistent master encryption key
function getMasterEncryptionKey(): Buffer {
  if (process.env.ENCRYPTION_SECRET) {
    return crypto.createHash('sha256').update(process.env.ENCRYPTION_SECRET).digest();
  }

  try {
    if (fs.existsSync(SERVER_KEY_FILE)) {
      const hexKey = fs.readFileSync(SERVER_KEY_FILE, 'utf-8').trim();
      if (hexKey.length === 64) {
        return Buffer.from(hexKey, 'hex');
      }
    }
    // Generate new random 32-byte key
    const newKey = crypto.randomBytes(32);
    fs.writeFileSync(SERVER_KEY_FILE, newKey.toString('hex'), { mode: 0o600 });
    return newKey;
  } catch (err) {
    console.warn('Could not read/write server key file, using runtime master key:', err);
    return crypto.createHash('sha256').update('coverageai_server_runtime_secret_fallback').digest();
  }
}

const MASTER_KEY = getMasterEncryptionKey();

// In-memory cache synced with disk
let secretsCache: Record<string, UserAiConfig> = {};

function loadSecretsFromDisk(): Record<string, UserAiConfig> {
  try {
    if (fs.existsSync(SECRETS_FILE)) {
      const data = fs.readFileSync(SECRETS_FILE, 'utf-8');
      secretsCache = JSON.parse(data);
      return secretsCache;
    }
  } catch (err) {
    console.error('Failed to load AI secrets from disk:', err);
  }
  secretsCache = {};
  return secretsCache;
}

function saveSecretsToDisk(): void {
  try {
    fs.writeFileSync(SECRETS_FILE, JSON.stringify(secretsCache, null, 2), { mode: 0o600 });
  } catch (err) {
    console.error('Failed to save AI secrets to disk:', err);
  }
}

// Initial load
loadSecretsFromDisk();

export function maskApiKey(key: string, provider: AiProviderId): string {
  const trimmed = key.trim();
  if (!trimmed) return '';
  const lastFour = trimmed.slice(-4);
  if (trimmed.startsWith('sk-ant-')) {
    return `sk-ant-••••${lastFour}`;
  }
  if (trimmed.startsWith('sk-')) {
    return `sk-••••${lastFour}`;
  }
  if (trimmed.startsWith('AIza')) {
    return `AIza••••${lastFour}`;
  }
  if (trimmed.length > 8) {
    return `••••••••••••${lastFour}`;
  }
  return `••••${lastFour}`;
}

export function encryptSecret(plainText: string): { iv: string; authTag: string; ciphertext: string } {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', MASTER_KEY, iv);
  let encrypted = cipher.update(plainText, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const authTag = cipher.getAuthTag().toString('hex');
  return {
    iv: iv.toString('hex'),
    authTag,
    ciphertext: encrypted,
  };
}

export function decryptSecret(encrypted: { iv: string; authTag: string; ciphertext: string }): string {
  const decipher = crypto.createDecipheriv('aes-256-gcm', MASTER_KEY, Buffer.from(encrypted.iv, 'hex'));
  decipher.setAuthTag(Buffer.from(encrypted.authTag, 'hex'));
  let decrypted = decipher.update(encrypted.ciphertext, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
}

// Get user configuration
export function getUserAiConfig(userId: string): UserAiConfig {
  if (!secretsCache[userId]) {
    secretsCache[userId] = {
      defaultProvider: 'gemini',
      secrets: {},
    };
  }
  return secretsCache[userId];
}

// Server-only method to retrieve decrypted secret for internal generation calls
export function getDecryptedKey(userId: string, provider: AiProviderId): string | null {
  const userConfig = getUserAiConfig(userId);
  const secretObj = userConfig.secrets[provider];
  if (!secretObj) {
    // If provider is gemini and system has GEMINI_API_KEY, use that as system-level key if user hasn't specified
    if (provider === 'gemini' && process.env.GEMINI_API_KEY) {
      return process.env.GEMINI_API_KEY;
    }
    return null;
  }
  try {
    return decryptSecret(secretObj);
  } catch (err) {
    console.error(`Failed to decrypt API key for provider ${provider}:`, err);
    return null;
  }
}

// Get safe client-facing config (NEVER includes decrypted key)
export function getSafeAiProvidersConfig(userId: string): SafeAiProvidersResponse {
  const userConfig = getUserAiConfig(userId);

  const providerNames: Record<AiProviderId, string> = {
    openai: 'OpenAI',
    gemini: 'Google Gemini',
    anthropic: 'Anthropic Claude',
  };

  const providers: Record<AiProviderId, SafeAiProviderInfo> = {
    openai: {
      id: 'openai',
      name: providerNames.openai,
      isConfigured: false,
    },
    gemini: {
      id: 'gemini',
      name: providerNames.gemini,
      isConfigured: false,
    },
    anthropic: {
      id: 'anthropic',
      name: providerNames.anthropic,
      isConfigured: false,
    },
  };

  for (const p of ['openai', 'gemini', 'anthropic'] as AiProviderId[]) {
    const stored = userConfig.secrets[p];
    if (stored) {
      providers[p] = {
        id: p,
        name: providerNames[p],
        isConfigured: true,
        maskedKey: stored.maskedKey,
        lastTestedAt: stored.lastTestedAt,
        lastStatus: stored.lastStatus,
        lastError: stored.lastError,
        configuredAt: stored.configuredAt,
      };
    } else if (p === 'gemini' && process.env.GEMINI_API_KEY) {
      // System default fallback for Gemini if environment key is present
      providers.gemini = {
        id: 'gemini',
        name: providerNames.gemini,
        isConfigured: true,
        maskedKey: maskApiKey(process.env.GEMINI_API_KEY, 'gemini'),
        lastTestedAt: undefined,
        lastStatus: undefined,
        lastError: undefined,
        configuredAt: 'System Injected',
      };
    }
  }

  return {
    defaultProvider: userConfig.defaultProvider || 'gemini',
    providers,
  };
}

// Save an encrypted API key
export function saveAiProviderKey(
  userId: string,
  provider: AiProviderId,
  plainKey: string
): SafeAiProviderInfo {
  const trimmed = plainKey.trim();
  if (!trimmed) {
    throw new Error('API key cannot be empty');
  }

  const userConfig = getUserAiConfig(userId);
  const encrypted = encryptSecret(trimmed);
  const maskedKey = maskApiKey(trimmed, provider);

  const newSecret: StoredEncryptedSecret = {
    ...encrypted,
    maskedKey,
    configuredAt: new Date().toISOString(),
    lastTestedAt: undefined,
    lastStatus: undefined,
    lastError: undefined,
  };

  userConfig.secrets[provider] = newSecret;
  saveSecretsToDisk();

  return {
    id: provider,
    name: provider === 'openai' ? 'OpenAI' : provider === 'gemini' ? 'Google Gemini' : 'Anthropic Claude',
    isConfigured: true,
    maskedKey,
    configuredAt: newSecret.configuredAt,
  };
}

// Delete an API key
export function deleteAiProviderKey(userId: string, provider: AiProviderId): void {
  const userConfig = getUserAiConfig(userId);
  if (userConfig.secrets[provider]) {
    delete userConfig.secrets[provider];
    saveSecretsToDisk();
  }
}

// Set default provider
export function setDefaultAiProvider(userId: string, defaultProvider: AiProviderId): void {
  const userConfig = getUserAiConfig(userId);
  userConfig.defaultProvider = defaultProvider;
  saveSecretsToDisk();
}

// Update test status
export function recordTestResult(
  userId: string,
  provider: AiProviderId,
  status: 'success' | 'failure',
  errorMsg?: string
): void {
  const userConfig = getUserAiConfig(userId);
  const secret = userConfig.secrets[provider];
  if (secret) {
    secret.lastTestedAt = new Date().toISOString();
    secret.lastStatus = status;
    secret.lastError = errorMsg;
    saveSecretsToDisk();
  }
}

export interface TestConnectionResult {
  success: boolean;
  message: string;
  modelsSample?: string[];
  latencyMs: number;
}

// Execute low-cost call (e.g. list models) to validate the provider key
export async function testProviderConnection(
  provider: AiProviderId,
  apiKey: string
): Promise<TestConnectionResult> {
  const start = Date.now();
  const key = apiKey.trim();

  if (!key) {
    return {
      success: false,
      message: 'API key is empty',
      latencyMs: 0,
    };
  }

  try {
    switch (provider) {
      case 'openai': {
        // Minimal call: GET https://api.openai.com/v1/models
        // Zero token consumption
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 12000);
        const res = await fetch('https://api.openai.com/v1/models', {
          method: 'GET',
          headers: {
            Authorization: `Bearer ${key}`,
            'User-Agent': 'CoverageAI-TestClient/1.0',
          },
          signal: controller.signal,
        });
        clearTimeout(timeout);
        const latency = Date.now() - start;

        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          const errMsg = errData?.error?.message || `HTTP ${res.status} ${res.statusText}`;
          if (res.status === 401) {
            return {
              success: false,
              message: `Authentication failed: ${errMsg}`,
              latencyMs: latency,
            };
          }
          return {
            success: false,
            message: `OpenAI returned error: ${errMsg}`,
            latencyMs: latency,
          };
        }

        const data = await res.json().catch(() => ({ data: [] }));
        const modelList = Array.isArray(data.data) ? data.data.map((m: any) => m.id) : [];
        const sample = modelList
          .filter((m: string) => m.includes('gpt-4') || m.includes('o3') || m.includes('o1'))
          .slice(0, 4);

        return {
          success: true,
          message: `Connected successfully! Access granted (${modelList.length} models accessible).`,
          modelsSample: sample.length > 0 ? sample : modelList.slice(0, 3),
          latencyMs: latency,
        };
      }

      case 'gemini': {
        // Minimal call: GET https://generativelanguage.googleapis.com/v1beta/models?key=...&pageSize=5
        // Zero token consumption
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 12000);
        const res = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(key)}&pageSize=8`,
          {
            method: 'GET',
            headers: {
              'User-Agent': 'CoverageAI-TestClient/1.0',
            },
            signal: controller.signal,
          }
        );
        clearTimeout(timeout);
        const latency = Date.now() - start;

        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          const errMsg = errData?.error?.message || `HTTP ${res.status} ${res.statusText}`;
          return {
            success: false,
            message: `Gemini authentication failed: ${errMsg}`,
            latencyMs: latency,
          };
        }

        const data = await res.json().catch(() => ({ models: [] }));
        const models = Array.isArray(data.models)
          ? data.models.map((m: any) => (m.name || '').replace('models/', ''))
          : [];
        const sample = models
          .filter((m: string) => m.includes('flash') || m.includes('pro'))
          .slice(0, 4);

        return {
          success: true,
          message: `Connected successfully! Access granted to Gemini API (${models.length} models available).`,
          modelsSample: sample.length > 0 ? sample : models.slice(0, 3),
          latencyMs: latency,
        };
      }

      case 'anthropic': {
        // Minimal call: GET https://api.anthropic.com/v1/models
        // Header x-api-key, anthropic-version: 2023-06-01
        // Zero token consumption
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 12000);
        const res = await fetch('https://api.anthropic.com/v1/models', {
          method: 'GET',
          headers: {
            'x-api-key': key,
            'anthropic-version': '2023-06-01',
            'User-Agent': 'CoverageAI-TestClient/1.0',
          },
          signal: controller.signal,
        });
        clearTimeout(timeout);
        const latency = Date.now() - start;

        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          const errMsg = errData?.error?.message || `HTTP ${res.status} ${res.statusText}`;
          if (res.status === 401) {
            return {
              success: false,
              message: `Authentication failed: ${errMsg}`,
              latencyMs: latency,
            };
          }
          return {
            success: false,
            message: `Anthropic returned error: ${errMsg}`,
            latencyMs: latency,
          };
        }

        const data = await res.json().catch(() => ({ data: [] }));
        const modelList = Array.isArray(data.data) ? data.data.map((m: any) => m.id) : [];
        const sample = modelList.slice(0, 4);

        return {
          success: true,
          message: `Connected successfully! Access granted to Claude models (${modelList.length} models available).`,
          modelsSample: sample.length > 0 ? sample : ['claude-3-5-sonnet-20241022', 'claude-3-5-haiku-20241022'],
          latencyMs: latency,
        };
      }

      default:
        return {
          success: false,
          message: `Unknown provider: ${provider}`,
          latencyMs: 0,
        };
    }
  } catch (err: any) {
    const latency = Date.now() - start;
    if (err.name === 'AbortError') {
      return {
        success: false,
        message: 'Connection timed out after 12 seconds. Check network connectivity.',
        latencyMs: latency,
      };
    }
    return {
      success: false,
      message: err.message || 'Connection test failed',
      latencyMs: latency,
    };
  }
}
