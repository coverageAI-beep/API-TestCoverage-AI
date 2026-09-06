import type { ApiReference, ApiSpec } from '../types';
import { db, isFirebaseConfigured, cleanForFirestore } from './firebase';
import {
  collection,
  doc,
  getDocs,
  getDoc,
  setDoc,
  deleteDoc,
  query,
  where,
} from 'firebase/firestore';

const API_STORAGE_PREFIX = 'coverageai_apis_';
const API_SPEC_PREFIX = 'coverageai_spec_';

// Seed sample APIs for newly loaded projects
const SEED_APIS_BY_NAME: Record<string, Partial<ApiSpec>[]> = {
  'Billing Engine API': [
    {
      name: 'Subscription & Invoicing API',
      description: 'Core subscription lifecycle, tiered billing rate calculations, and automated monthly tax assessments.',
      baseUrl: 'https://api.staging.acme.corp/billing/v2',
      version: '2.4.0',
      authType: 'bearer',
      authDetails: 'Bearer JWT token with billing:write and billing:read scopes',
      businessRules: '• Invoices must be locked 24 hours prior to billing cycle execution.\n• Prorated line items must calculate down to the nearest minute.\n• Card retries follow an exponential backoff strategy (1, 3, 7 days).\n• Failed transactions above $10,000 must alert finance operations immediately.',
      validationRules: '• currency must be a valid ISO 4217 3-letter currency code (e.g. USD, EUR, GBP).\n• amountCents must be a positive integer.\n• customerId must conform to the regex ^cus_[a-zA-Z0-9]{16}$.\n• Idempotency-Key header is mandatory for all POST requests.',
      endpoints: [
        {
          id: 'ep_1_1',
          method: 'POST',
          path: '/v2/subscriptions',
          summary: 'Create Customer Subscription',
          description: 'Provisions a new recurring subscription against a verified payment method.',
          parameters: [
            { name: 'Idempotency-Key', in: 'header', required: true, type: 'string', description: 'Unique UUID v4 request identifier' },
            { name: 'expand', in: 'query', required: false, type: 'string', description: 'Sub-resources to expand (e.g. customer, latest_invoice)' }
          ],
          requestSchema: JSON.stringify({
            customerId: "cus_9A8F71BC62DE3412",
            planId: "plan_enterprise_quarterly",
            seatCount: 25,
            billingCycleAnchor: 1714521600,
            couponCode: "SPRING2026",
            metadata: { costCenter: "ENG-04" }
          }, null, 2),
          responseStatusCode: 201,
          responseSchema: JSON.stringify({
            id: "sub_1082937401",
            status: "active",
            currentPeriodStart: 1714521600,
            currentPeriodEnd: 1722470400,
            items: [{ id: "si_01", planId: "plan_enterprise_quarterly", quantity: 25 }]
          }, null, 2),
          errorResponses: [
            { id: 'err_1', statusCode: 400, name: 'Bad Request', description: 'Invalid plan configuration or invalid discount code' },
            { id: 'err_2', statusCode: 402, name: 'Payment Required', description: 'Customer default payment instrument failed authorization' },
            { id: 'err_3', statusCode: 409, name: 'Conflict', description: 'Idempotency key replayed with mismatched parameters' }
          ]
        },
        {
          id: 'ep_1_2',
          method: 'GET',
          path: '/v2/subscriptions/{subscriptionId}',
          summary: 'Retrieve Subscription Details',
          description: 'Fetches active status, usage metrics, and current billing cycle timeline.',
          parameters: [
            { name: 'subscriptionId', in: 'path', required: true, type: 'string', description: 'Identifier of the subscription' }
          ],
          responseStatusCode: 200,
          responseSchema: JSON.stringify({
            id: "sub_1082937401",
            status: "active",
            cancelAtPeriodEnd: false,
            collectionMethod: "charge_automatically"
          }, null, 2),
          errorResponses: [
            { id: 'err_4', statusCode: 404, name: 'Not Found', description: 'Subscription ID not found or deleted' }
          ]
        },
        {
          id: 'ep_1_3',
          method: 'PATCH',
          path: '/v2/subscriptions/{subscriptionId}/seats',
          summary: 'Adjust Subscription Seats',
          description: 'Scales licensed seats up or down with immediate proration recalculations.',
          parameters: [
            { name: 'subscriptionId', in: 'path', required: true, type: 'string', description: 'Target subscription' }
          ],
          requestSchema: JSON.stringify({
            newSeatCount: 30,
            prorationBehavior: "always_invoice"
          }, null, 2),
          responseStatusCode: 200,
          responseSchema: JSON.stringify({
            id: "sub_1082937401",
            seatCount: 30,
            proratedAmountDue: 45000
          }, null, 2),
          errorResponses: [
            { id: 'err_5', statusCode: 422, name: 'Unprocessable Entity', description: 'Seat count cannot be decreased below active member count' }
          ]
        }
      ]
    },
    {
      name: 'Metered Usage Ingestion API',
      description: 'High-throughput event intake for API requests, compute minutes, and storage consumption metrics.',
      baseUrl: 'https://meters.staging.acme.corp/v1',
      version: '1.2.0',
      authType: 'apiKey',
      authDetails: 'API Key passed via X-Telemetry-Key header',
      businessRules: '• Events older than 72 hours are rejected as stale.\n• Duplicate event IDs within a 24-hour window are silently deduplicated.\n• Aggregations occur hourly across tenant boundaries.',
      validationRules: '• eventName must match standard taxonomy ([a-z_]+).\n• quantity must be a positive decimal or integer.\n• timestamp must be valid ISO 8601 UTC string.',
      endpoints: [
        {
          id: 'ep_1_4',
          method: 'POST',
          path: '/v1/events/batch',
          summary: 'Ingest Metered Usage Batch',
          description: 'Submits up to 1,000 usage telemetry events in a single HTTP POST.',
          requestSchema: JSON.stringify({
            events: [
              { eventId: "evt_01a", customerId: "cus_123", metric: "tokens_generated", quantity: 4520, timestamp: "2026-09-05T09:00:00Z" }
            ]
          }, null, 2),
          responseStatusCode: 202,
          responseSchema: JSON.stringify({ accepted: 1, rejected: 0, batchId: "bch_98765" }, null, 2),
          errorResponses: [
            { id: 'err_6', statusCode: 413, name: 'Payload Too Large', description: 'Batch contains more than 1,000 events' }
          ]
        }
      ]
    }
  ]
};

// Helper: Get local API references
function getLocalApiReferences(projectId: string): ApiReference[] {
  try {
    const raw = localStorage.getItem(`${API_STORAGE_PREFIX}${projectId}`);
    if (!raw) return [];
    return JSON.parse(raw) as ApiReference[];
  } catch {
    return [];
  }
}

// Helper: Save local API references
function saveLocalApiReferences(projectId: string, apis: ApiReference[]): void {
  try {
    localStorage.setItem(`${API_STORAGE_PREFIX}${projectId}`, JSON.stringify(apis));
  } catch (err) {
    console.error('Failed to save local API references:', err);
  }
}

// Helper: Get local spec
function getLocalApiSpec(apiId: string): ApiSpec | null {
  try {
    const raw = localStorage.getItem(`${API_SPEC_PREFIX}${apiId}`);
    if (!raw) return null;
    return JSON.parse(raw) as ApiSpec;
  } catch {
    return null;
  }
}

// Helper: Save local spec
function saveLocalApiSpec(spec: ApiSpec): void {
  try {
    localStorage.setItem(`${API_SPEC_PREFIX}${spec.id}`, JSON.stringify(spec));
  } catch (err) {
    console.error('Failed to save local API spec:', err);
  }
}

// Seed helper if user views a project with no APIs yet
export function seedInitialApisForProject(projectId: string, projectName: string): ApiReference[] {
  const existing = getLocalApiReferences(projectId);
  if (existing.length > 0) return existing;

  const templates = SEED_APIS_BY_NAME[projectName] || [
    {
      name: `${projectName} Core Spec`,
      description: 'Primary REST API contract specification and validation schemas.',
      baseUrl: 'https://api.staging.corp/v1',
      version: '1.0.0',
      authType: 'bearer',
      authDetails: 'Bearer JWT token',
      businessRules: '• All requests must carry an Authorization Bearer header.\n• Rate limit of 60 req/min per tenant API token.',
      validationRules: '• Input fields must be validated against JSON Schema strict typing.',
      endpoints: [
        {
          id: `ep_seed_${Date.now()}_1`,
          method: 'GET',
          path: '/v1/health',
          summary: 'Service Health Check',
          description: 'Returns operational readiness and dependency statuses.',
          responseStatusCode: 200,
          responseSchema: JSON.stringify({ status: "healthy", uptimeSeconds: 84392 }, null, 2),
          errorResponses: [
            { id: 'err_s1', statusCode: 503, name: 'Service Unavailable', description: 'Internal service degraded' }
          ]
        },
        {
          id: `ep_seed_${Date.now()}_2`,
          method: 'POST',
          path: '/v1/resources',
          summary: 'Provision Resource',
          description: 'Creates a new managed entity in this workspace.',
          requestSchema: JSON.stringify({ name: "Primary cluster", region: "us-east-1" }, null, 2),
          responseStatusCode: 201,
          responseSchema: JSON.stringify({ id: "res_01", name: "Primary cluster", status: "active" }, null, 2),
          errorResponses: [
            { id: 'err_s2', statusCode: 400, name: 'Bad Request', description: 'Invalid payload structure' }
          ]
        }
      ]
    }
  ];

  const now = new Date().toISOString();
  const seededRefs: ApiReference[] = [];

  templates.forEach((tpl, idx) => {
    const apiId = `api_${Date.now()}_${idx}_${Math.random().toString(36).slice(2, 6)}`;
    const fullSpec: ApiSpec = {
      id: apiId,
      projectId,
      name: tpl.name || 'Untitled API',
      description: tpl.description || '',
      baseUrl: tpl.baseUrl || 'https://api.example.com',
      version: tpl.version || '1.0.0',
      authType: (tpl.authType as any) || 'none',
      authDetails: tpl.authDetails || '',
      businessRules: tpl.businessRules || '',
      validationRules: tpl.validationRules || '',
      endpoints: tpl.endpoints || [],
      createdAt: now,
      updatedAt: now,
      sourceType: 'manual',
    };

    saveLocalApiSpec(fullSpec);

    seededRefs.push({
      id: apiId,
      projectId,
      name: fullSpec.name,
      baseUrl: fullSpec.baseUrl,
      endpointCount: fullSpec.endpoints.length,
      coverageStatus: idx === 0 ? 'partial' : 'not_analyzed',
      authType: fullSpec.authType,
      createdAt: fullSpec.createdAt,
      updatedAt: fullSpec.updatedAt,
      description: fullSpec.description,
    });
  });

  saveLocalApiReferences(projectId, seededRefs);
  return seededRefs;
}

// 1. Fetch Lightweight List of APIs for a Project
export async function fetchProjectApiReferences(
  projectId: string,
  projectName?: string
): Promise<ApiReference[]> {
  if (isFirebaseConfigured && db) {
    try {
      const q = query(collection(db, 'apis'), where('projectId', '==', projectId));
      const snapshot = await getDocs(q);
      if (!snapshot.empty) {
        const cloudRefs: ApiReference[] = [];
        snapshot.forEach((docSnap) => {
          cloudRefs.push(docSnap.data() as ApiReference);
        });
        cloudRefs.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
        saveLocalApiReferences(projectId, cloudRefs);
        return cloudRefs;
      }
    } catch (err) {
      console.warn('Firestore fetch for APIs failed, falling back to local storage:', err);
    }
  }

  // Local fallback / initial seeding
  const localRefs = getLocalApiReferences(projectId);
  if (localRefs.length === 0 && projectName) {
    return seedInitialApisForProject(projectId, projectName);
  }

  return localRefs.sort(
    (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
  );
}

// 2. Fetch Full Spec for an API
export async function fetchApiSpec(
  projectId: string,
  apiId: string
): Promise<ApiSpec | null> {
  // Check local storage cache first
  const local = getLocalApiSpec(apiId);
  if (local) return local;

  // Try Firestore
  if (isFirebaseConfigured && db) {
    try {
      const docSnap = await getDoc(doc(db, 'api_specs', apiId));
      if (docSnap.exists()) {
        const spec = docSnap.data() as ApiSpec;
        saveLocalApiSpec(spec);
        return spec;
      }
    } catch (err) {
      console.warn('Failed to load spec from Firestore:', err);
    }
  }

  return null;
}

// 3. Save / Update API (Both Reference and Spec)
export async function saveApiRecord(
  projectId: string,
  specData: ApiSpec,
  oneDriveMetadata?: { itemId?: string; webUrl?: string }
): Promise<{ reference: ApiReference; spec: ApiSpec }> {
  const now = new Date().toISOString();

  const finalSpec: ApiSpec = {
    ...specData,
    projectId,
    updatedAt: now,
    createdAt: specData.createdAt || now,
    oneDriveItemId: oneDriveMetadata?.itemId || specData.oneDriveItemId,
    oneDriveWebUrl: oneDriveMetadata?.webUrl || specData.oneDriveWebUrl,
  };

  const reference: ApiReference = {
    id: finalSpec.id,
    projectId,
    name: finalSpec.name,
    baseUrl: finalSpec.baseUrl,
    endpointCount: finalSpec.endpoints.length,
    oneDriveItemId: finalSpec.oneDriveItemId,
    oneDriveWebUrl: finalSpec.oneDriveWebUrl,
    coverageStatus: 'not_analyzed', // default placeholder
    authType: finalSpec.authType,
    createdAt: finalSpec.createdAt,
    updatedAt: finalSpec.updatedAt,
    description: finalSpec.description,
  };

  // 1. Save to local storage
  saveLocalApiSpec(finalSpec);
  const localRefs = getLocalApiReferences(projectId);
  const existingIdx = localRefs.findIndex((r) => r.id === finalSpec.id);
  if (existingIdx >= 0) {
    // preserve existing coverage status if present
    reference.coverageStatus = localRefs[existingIdx].coverageStatus;
    localRefs[existingIdx] = reference;
  } else {
    localRefs.unshift(reference);
  }
  saveLocalApiReferences(projectId, localRefs);

  // 2. Save to Firestore if available
  if (isFirebaseConfigured && db) {
    try {
      await Promise.all([
        setDoc(doc(db, 'apis', finalSpec.id), cleanForFirestore(reference), { merge: true }),
        setDoc(doc(db, 'api_specs', finalSpec.id), cleanForFirestore(finalSpec), { merge: true }),
      ]);
    } catch (err) {
      console.warn('Failed to save API reference to Firestore:', err);
    }
  }

  return { reference, spec: finalSpec };
}

// 4. Delete API Record
export async function deleteApiRecord(projectId: string, apiId: string): Promise<void> {
  // Local storage
  const localRefs = getLocalApiReferences(projectId);
  const filtered = localRefs.filter((r) => r.id !== apiId);
  saveLocalApiReferences(projectId, filtered);
  localStorage.removeItem(`${API_SPEC_PREFIX}${apiId}`);

  // Firestore
  if (isFirebaseConfigured && db) {
    try {
      await Promise.all([
        deleteDoc(doc(db, 'apis', apiId)),
        deleteDoc(doc(db, 'api_specs', apiId)),
      ]);
    } catch (err) {
      console.warn('Failed to delete API from Firestore:', err);
    }
  }
}
