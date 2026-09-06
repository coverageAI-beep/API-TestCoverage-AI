import { GoogleGenAI } from '@google/genai';
import { getDecryptedKey, getUserAiConfig, type AiProviderId } from './aiSecrets';

export interface ApiEndpointParamInfo {
  name: string;
  in: string;
  required: boolean;
  type?: string;
  description?: string;
}

export interface ApiEndpointErrorInfo {
  id?: string;
  statusCode: number;
  name: string;
  description?: string;
  schema?: string;
}

export interface ApiEndpointInfo {
  id: string;
  method: string;
  path: string;
  summary: string;
  description?: string;
  parameters?: ApiEndpointParamInfo[];
  requestSchema?: string;
  responseSchema?: string;
  responseStatusCode?: number;
  errorResponses?: ApiEndpointErrorInfo[];
}

export interface ApiDefinitionPayload {
  id: string;
  name: string;
  description?: string;
  baseUrl: string;
  version?: string;
  authType: string;
  authDetails?: string;
  businessRules?: string;
  validationRules?: string;
  endpoints: ApiEndpointInfo[];
  rawSpecContent?: string;
}

export interface GenerationResult {
  markdown: string;
  provider: AiProviderId;
  model: string;
  generatedAt: string;
  isFallback?: boolean;
}

/**
 * Deterministic, highly detailed enterprise requirements synthesizer
 * Used when API provider is offline, key is invalid, or as a reliable fallback.
 */
export function synthesizeRequirementsDocument(api: ApiDefinitionPayload): string {
  const dateStr = new Date().toISOString().split('T')[0];
  const version = api.version || '1.0.0';
  const endpoints = api.endpoints && api.endpoints.length > 0 ? api.endpoints : [
    {
      id: 'ep_default',
      method: 'GET',
      path: '/health',
      summary: 'Service Health Check',
      description: 'Reports operational status and subsystem latency metrics.',
      parameters: [],
      responseStatusCode: 200,
      responseSchema: '{\n  "status": "UP",\n  "uptime": 98234\n}',
      errorResponses: [
        { statusCode: 503, name: 'Service Unavailable', description: 'Underlying dependency is unreachable.' }
      ]
    }
  ];

  let doc = `# API Requirements Specification: ${api.name}

| Attribute | Value |
| :--- | :--- |
| **API Name** | ${api.name} |
| **Version** | ${version} |
| **Base URL** | \`${api.baseUrl || 'https://api.example.com'}\` |
| **Authentication** | ${api.authType ? api.authType.toUpperCase() : 'NONE'} ${api.authDetails ? `(${api.authDetails})` : ''} |
| **Document Status** | Approved for Verification |
| **Last Updated** | ${dateStr} |
| **Traceability ID** | REQ-${api.name.replace(/[^a-zA-Z0-9]/g, '').toUpperCase()}-${version.replace(/\./g, '')} |

---

## 1. Executive Overview & Scope
The **${api.name}** provides a secure, high-availability programmatic interface designed for enterprise integration. ${api.description || 'This specification defines the strict contract requirements, data validation schemas, SLA constraints, and boundary edge cases necessary for reliable automated test coverage and zero-regression deployment.'}

### 1.1 Architectural Preconditions
- **Base Endpoint**: All path endpoints are rooted relative to \`${api.baseUrl || 'https://api.example.com'}\`.
- **Authentication Strategy**: All authenticated operations mandate ${api.authType || 'token'}-based credentials. ${api.authDetails ? `Specific scheme: ${api.authDetails}.` : ''}
- **Content Negotiation**: Endpoints communicate exclusively in \`application/json; charset=utf-8\` unless otherwise specified.
- **Idempotency**: All mutating operations (\`POST\`, \`PUT\`, \`PATCH\`, \`DELETE\`) must adhere to strict idempotency protocols when an \`Idempotency-Key\` header is supplied.

---

## 2. Functional Requirements (Endpoint Specification)
`;

  endpoints.forEach((ep, idx) => {
    const reqNum = String(idx + 1).padStart(3, '0');
    const method = ep.method.toUpperCase();
    const reqId = `REQ-FUNC-${method}-${reqNum}`;

    doc += `
### 2.${idx + 1} Endpoint: \`${method} ${ep.path}\`
**Requirement ID:** \`${reqId}\`  
**Summary:** ${ep.summary || 'Endpoint operation'}  
**Description:** ${ep.description || `Handles ${method} operations for ${ep.path}.`}

#### 2.${idx + 1}.1 Request Parameters
`;

    if (ep.parameters && ep.parameters.length > 0) {
      doc += `| Parameter | Location | Required | Type | Description |
| :--- | :--- | :--- | :--- | :--- |
`;
      ep.parameters.forEach((p) => {
        doc += `| \`${p.name}\` | \`${p.in}\` | ${p.required ? '**Yes**' : 'No'} | \`${p.type || 'string'}\` | ${p.description || 'N/A'} |\n`;
      });
    } else {
      doc += `*No query or path parameters defined for this route.*\n`;
    }

    if (['POST', 'PUT', 'PATCH'].includes(method) && ep.requestSchema) {
      doc += `
#### 2.${idx + 1}.2 Request Payload Schema
\`\`\`json
${ep.requestSchema}
\`\`\`
`;
    }

    doc += `
#### 2.${idx + 1}.3 Expected Response (HTTP ${ep.responseStatusCode || 200})
\`\`\`json
${ep.responseSchema || '{\n  "status": "success"\n}'}
\`\`\`

#### 2.${idx + 1}.4 Business & Validation Rules
`;
    if (api.businessRules) {
      doc += `**Business Rules:**\n${api.businessRules}\n\n`;
    }
    if (api.validationRules) {
      doc += `**Validation Rules:**\n${api.validationRules}\n\n`;
    }
    if (!api.businessRules && !api.validationRules) {
      doc += `- Strict JSON schema schema enforcement on payload structures.\n- All required header tokens must be validated before business execution.\n- Data types, string lengths, and enum values must match specification contracts.\n\n`;
    }
  });

  doc += `
---

## 3. Non-Functional Requirements (NFRs)

### 3.1 Performance & Latency SLAs
- **P95 Latency Threshold**: All synchronous read operations must fulfill within **< 150ms** under normal load.
- **P99 Latency Threshold**: Complex write or aggregation queries must fulfill within **< 400ms**.
- **Throughput Capability**: The API subsystem must sustain a baseline rate of **250 requests/second** with burst headroom up to **500 requests/second**.
- **Payload Limits**: Request payload bodies are strictly capped at **10 MB**; payloads exceeding this threshold must be rejected with HTTP \`413 Payload Too Large\`.

### 3.2 Reliability, Availability & Resilience
- **Service Availability Target**: **99.95%** uptime measured over rolling 30-day windows.
- **Graceful Degradation**: If downstream data stores experience latency surges, read endpoints must serve cached states where business logic permits.
- **Health Checks**: A dedicated health monitoring endpoint must report subsystem connectivity (databases, caches, identity providers) within **50ms**.

### 3.3 Security, Privacy & Compliance
- **Transport Security**: All communication strictly requires **TLS 1.3** (TLS 1.2 minimum). Plaintext HTTP traffic is rejected with immediate redirection.
- **Authentication Enforcement**: Missing, expired, or malformed credentials must consistently trigger HTTP \`401 Unauthorized\`.
- **Authorization & RBAC**: Insufficient permissions must return HTTP \`403 Forbidden\` without leaking internal resource identifiers.
- **Data Protection**: Personal Identifiable Information (PII) and secret credentials must never be written to server access logs or telemetry sinks.
- **Rate Limiting Protection**: Standard tenants are throttled at **60 requests/minute** with an HTTP \`429 Too Many Requests\` response containing \`Retry-After\` headers.

---

## 4. Error Handling, Edge Cases & Boundary Conditions

### 4.1 Standardized Error Response Structure
All error conditions must return an RFC 7807 compliant error payload:
\`\`\`json
{
  "type": "https://api.example.com/errors/invalid-parameter",
  "title": "Invalid Request Parameter",
  "status": 400,
  "detail": "The parameter 'customerId' violates formatting constraint ^cus_[a-zA-Z0-9]{16}$",
  "instance": "/v2/subscriptions",
  "timestamp": "${dateStr}T12:00:00Z",
  "traceId": "c4b9201f-9a41-482f-8a03-7bf1c36081da"
}
\`\`\`

### 4.2 Error Matrix
| HTTP Status | Error Name | Condition Trigger | Expected Behavior |
| :--- | :--- | :--- | :--- |
| **400 Bad Request** | \`INVALID_PAYLOAD\` | Syntactically invalid JSON or unparseable field | Returns detailed schema error array |
| **401 Unauthorized** | \`AUTH_MISSING\` | Missing or malformed Authorization header | Aborts before handler execution |
| **403 Forbidden** | \`INSUFFICIENT_SCOPE\` | Valid token lacking write/read grant | Logs access violation, drops request |
| **404 Not Found** | \`RESOURCE_NOT_FOUND\` | Resource UUID does not exist | Returns clean 404 without stack traces |
| **409 Conflict** | \`CONCURRENT_COLLISION\` | Replayed idempotency key with modified params | Rejects modification with state warning |
| **422 Unprocessable** | \`BUSINESS_CONSTRAINT\` | Valid schema but invalid business rule | Returns semantic constraint error |
| **429 Rate Limited** | \`QUOTA_EXCEEDED\` | Tenant exceeds per-minute rate quota | Returns 429 with \`Retry-After\` header |
| **500 Internal Error**| \`UNHANDLED_EXCEPTION\`| Unexpected runtime failure | Emits alert, masks internal details |

### 4.3 Boundary & Stress Edge Cases
1. **Empty Body Submissions**: Sending empty \`{}\` to write endpoints must reject with HTTP 400, explicitly highlighting missing required keys.
2. **Unicode & Special Characters**: Unicode emoji, RTL characters, and SQL injection strings (\`' OR '1'='1\`) must be sanitized and stored verbatim without interpretation.
3. **Idempotency Key Duplication**: Identical requests with matching \`Idempotency-Key\` must return cached responses without executing side-effects.

---

## 5. Traceability & Acceptance Criteria (Gherkin Format)

### Scenario 1: Successful Primary Endpoint Execution
\`\`\`gherkin
Given a verified tenant with active "${api.authType || 'bearer'}" credentials
When the client transmits a valid request to "${endpoints[0]?.method || 'GET'} ${endpoints[0]?.path || '/health'}"
Then the server must respond with HTTP ${endpoints[0]?.responseStatusCode || 200}
And the payload must strictly match the published JSON schema
And the response time must be under 200ms
\`\`\`

### Scenario 2: Rejection of Unauthenticated Requests
\`\`\`gherkin
Given a client request without an Authorization header
When sending any HTTP method to protected resources
Then the server must respond with HTTP 401 Unauthorized
And no internal system state or diagnostics shall be exposed
\`\`\`

### Scenario 3: Validation Failure on Malformed Payload
\`\`\`gherkin
Given a request containing invalid data types or missing required fields
When evaluated against the validation rules
Then the server must return HTTP 400 or HTTP 422
And the error response must specify the exact field paths that failed
\`\`\`
`;

  return doc;
}

/**
 * Builds the AI prompt for generating the structured requirements document
 */
function buildPrompt(api: ApiDefinitionPayload): { system: string; user: string } {
  const system = `You are a Principal Software Architect and Lead QA Verification Engineer specializing in API specifications and enterprise test-driven development.
Your task is to generate an authoritative, exhaustive, and rigorously structured API Requirements Document in clean Markdown format.
The document must thoroughly cover:
1. Executive Overview, Architecture Context, & Scope
2. Functional Requirements (organized endpoint by endpoint with inputs, schemas, parameters, business logic, and outputs)
3. Non-Functional Requirements (Performance & Latency SLAs, Scalability, Reliability, Availability, Security, TLS, RBAC, Rate Limiting)
4. Error Handling, Edge Cases & Boundary Conditions (with an explicit RFC 7807 Error Matrix, edge cases, and concurrency)
5. Traceability & Acceptance Criteria (including concrete Gherkin Given-When-Then scenarios for automated test suites)

Do NOT return pleasantries, conversational filler, or wrap the whole document in backtick blocks. Return pure, valid Markdown directly starting with the top-level title.`;

  const apiJsonSummary = JSON.stringify({
    name: api.name,
    version: api.version || '1.0.0',
    baseUrl: api.baseUrl,
    authType: api.authType,
    authDetails: api.authDetails,
    businessRules: api.businessRules,
    validationRules: api.validationRules,
    endpointCount: api.endpoints?.length || 0,
    endpoints: api.endpoints.map((ep) => ({
      method: ep.method,
      path: ep.path,
      summary: ep.summary,
      description: ep.description,
      parameters: ep.parameters,
      requestSchema: ep.requestSchema ? ep.requestSchema.slice(0, 1500) : undefined,
      responseSchema: ep.responseSchema ? ep.responseSchema.slice(0, 1500) : undefined,
      responseStatusCode: ep.responseStatusCode,
      errorResponses: ep.errorResponses,
    })),
  }, null, 2);

  const user = `Generate the complete, exhaustive API Requirements Document for the following API definition:

${apiJsonSummary}

Make sure every single endpoint listed above is represented in detail in Section 2 with its exact method, path, parameter constraints, request/response schemas, and validation requirements.`;

  return { system, user };
}

/**
 * Calls the specified AI Provider (Google Gemini, OpenAI, or Anthropic)
 */
export async function generateRequirementsWithAi(
  userId: string,
  api: ApiDefinitionPayload,
  requestedProvider?: AiProviderId
): Promise<GenerationResult> {
  const userConfig = getUserAiConfig(userId);
  const provider = requestedProvider || userConfig.defaultProvider || 'gemini';
  const apiKey = getDecryptedKey(userId, provider);
  const now = new Date().toISOString();

  const { system, user } = buildPrompt(api);

  // If no API key is available or running in demo sandbox, synthesize directly
  if (!apiKey) {
    console.info(`No API key configured for provider ${provider}. Using synthetic generator.`);
    return {
      markdown: synthesizeRequirementsDocument(api),
      provider,
      model: 'synthetic-architect-v2',
      generatedAt: now,
      isFallback: true,
    };
  }

  try {
    switch (provider) {
      case 'gemini': {
        try {
          const ai = new GoogleGenAI({ apiKey });
          // Use gemini-2.5-flash as specified in skill guidelines
          const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: `${system}\n\n${user}`,
          });

          let text = response.text || '';
          // Strip enclosing markdown code block if model wrapped it
          if (text.startsWith('```markdown')) {
            text = text.replace(/^```markdown\n/, '').replace(/\n```$/, '');
          } else if (text.startsWith('```md')) {
            text = text.replace(/^```md\n/, '').replace(/\n```$/, '');
          }

          if (text.trim().length > 100) {
            return {
              markdown: text.trim(),
              provider: 'gemini',
              model: 'gemini-2.5-flash',
              generatedAt: now,
            };
          }
        } catch (geminiErr: any) {
          console.warn('Gemini API call failed, falling back to deterministic synthesizer:', geminiErr.message);
        }
        break;
      }

      case 'openai': {
        try {
          const controller = new AbortController();
          const timeout = setTimeout(() => controller.abort(), 25000);

          const res = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${apiKey}`,
            },
            body: JSON.stringify({
              model: 'gpt-4o-mini',
              messages: [
                { role: 'system', content: system },
                { role: 'user', content: user },
              ],
              temperature: 0.2,
            }),
            signal: controller.signal,
          });
          clearTimeout(timeout);

          if (res.ok) {
            const data = await res.json();
            const text = data.choices?.[0]?.message?.content || '';
            if (text.trim().length > 100) {
              return {
                markdown: text.trim(),
                provider: 'openai',
                model: 'gpt-4o-mini',
                generatedAt: now,
              };
            }
          } else {
            const errBody = await res.text();
            console.warn('OpenAI API returned error:', res.status, errBody);
          }
        } catch (openAiErr: any) {
          console.warn('OpenAI call failed, falling back to deterministic synthesizer:', openAiErr.message);
        }
        break;
      }

      case 'anthropic': {
        try {
          const controller = new AbortController();
          const timeout = setTimeout(() => controller.abort(), 25000);

          const res = await fetch('https://api.anthropic.com/v1/messages', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'x-api-key': apiKey,
              'anthropic-version': '2023-06-01',
            },
            body: JSON.stringify({
              model: 'claude-3-5-haiku-20241022',
              max_tokens: 4096,
              system,
              messages: [{ role: 'user', content: user }],
            }),
            signal: controller.signal,
          });
          clearTimeout(timeout);

          if (res.ok) {
            const data = await res.json();
            const text = data.content?.[0]?.text || '';
            if (text.trim().length > 100) {
              return {
                markdown: text.trim(),
                provider: 'anthropic',
                model: 'claude-3-5-haiku-20241022',
                generatedAt: now,
              };
            }
          } else {
            const errBody = await res.text();
            console.warn('Anthropic API returned error:', res.status, errBody);
          }
        } catch (anthropicErr: any) {
          console.warn('Anthropic call failed, falling back to deterministic synthesizer:', anthropicErr.message);
        }
        break;
      }
    }
  } catch (err: any) {
    console.error(`AI generation encountered exception for provider ${provider}:`, err);
  }

  // Fallback to high-fidelity synthesized requirements document
  return {
    markdown: synthesizeRequirementsDocument(api),
    provider,
    model: 'synthetic-architect-v2',
    generatedAt: now,
    isFallback: true,
  };
}

export interface TestCaseItem {
  id: string;
  title: string;
  linkedRequirements: string[];
  linkedEndpoint: string;
  preconditions: string;
  requestPayload: string;
  expectedResponse: string;
  assertions: string[];
  priority: 'High' | 'Medium' | 'Low';
  type: 'Positive' | 'Negative' | 'Edge' | 'Boundary';
  source: 'AI-generated' | 'Manual';
  createdAt?: string;
  updatedAt?: string;
}

export interface TestCasesGenerationResult {
  testCases: TestCaseItem[];
  provider: AiProviderId;
  model: string;
  generatedAt: string;
  isFallback?: boolean;
}

/**
 * Deterministic test case suite generator for fallbacks or offline mode
 */
export function synthesizeTestCaseSuite(
  api: ApiDefinitionPayload,
  requirementsMarkdown: string
): TestCaseItem[] {
  const reqMatches = Array.from(requirementsMarkdown.matchAll(/REQ-[A-Z0-9-]+/g)).map((m) => m[0]);
  const uniqueReqs = Array.from(new Set(reqMatches));
  const fallbackReq = `REQ-${api.name.replace(/[^a-zA-Z0-9]/g, '').toUpperCase()}-01`;
  const primaryReq = uniqueReqs[0] || fallbackReq;
  const secondaryReq = uniqueReqs[1] || `${fallbackReq}-SEC`;

  const endpoints = api.endpoints && api.endpoints.length > 0 ? api.endpoints : [
    {
      id: 'ep_1',
      method: 'GET',
      path: '/api/v1/health',
      summary: 'Service Health Check',
      parameters: [],
      responseStatusCode: 200,
      responseSchema: '{"status": "UP"}',
      errorResponses: [{ statusCode: 503, name: 'Service Unavailable' }]
    }
  ];

  const testCases: TestCaseItem[] = [];
  let tcIndex = 1;

  endpoints.forEach((ep) => {
    const formattedEndpoint = `${ep.method.toUpperCase()} ${ep.path}`;
    const cleanMethod = ep.method.toUpperCase();
    const epSummary = ep.summary || `${ep.method} ${ep.path}`;

    // 1. Positive Test Case (Happy Path)
    const positiveId = `TC-${String(tcIndex++).padStart(3, '0')}`;
    let sampleReqPayload = '{\n  // No request body required for standard GET query\n}';
    if (['POST', 'PUT', 'PATCH'].includes(cleanMethod)) {
      sampleReqPayload = ep.requestSchema || '{\n  "name": "Standard Test Entity",\n  "status": "active",\n  "metadata": { "env": "qa" }\n}';
    }

    testCases.push({
      id: positiveId,
      title: `[Happy Path] ${epSummary} - Valid request executes successfully`,
      linkedRequirements: [primaryReq],
      linkedEndpoint: formattedEndpoint,
      preconditions: `API service is active at ${api.baseUrl || 'https://api.example.com'}. Authentication credentials are valid for user role with read/write permissions.`,
      requestPayload: sampleReqPayload,
      expectedResponse: `HTTP ${ep.responseStatusCode || 200} OK. Response body matches defined JSON schema with all required fields present.`,
      assertions: [
        `HTTP response status code must equal ${ep.responseStatusCode || 200}`,
        'Response Content-Type header must be application/json',
        'Response execution latency must be below 800ms',
        'Response body must contain valid non-null schema payload'
      ],
      priority: 'High',
      type: 'Positive',
      source: 'AI-generated',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    // 2. Negative Test Case (Invalid/Unauthorized/Bad Request)
    const negativeId = `TC-${String(tcIndex++).padStart(3, '0')}`;
    let negativePayload = '{\n  // Invalid or missing required attributes\n}';
    let expectedNegStatus = 400;
    let expectedNegMsg = 'HTTP 400 Bad Request with RFC 7807 problem details object';

    if (api.authType && api.authType !== 'none') {
      expectedNegStatus = 401;
      expectedNegMsg = 'HTTP 401 Unauthorized with error code AUTH_TOKEN_MISSING or INVALID_CREDENTIALS';
    }

    testCases.push({
      id: negativeId,
      title: `[Negative] ${epSummary} - Request fails with missing or invalid authentication/parameters`,
      linkedRequirements: [secondaryReq, primaryReq],
      linkedEndpoint: formattedEndpoint,
      preconditions: `Target endpoint ${formattedEndpoint} is active. Client sends request without required authorization token or with malformed headers.`,
      requestPayload: negativePayload,
      expectedResponse: expectedNegMsg,
      assertions: [
        `HTTP response status code must equal ${expectedNegStatus}`,
        'Response payload must contain "error" or "detail" description string',
        'Sensitive server stack traces or internal environment variables must NOT be exposed',
        'WWW-Authenticate or appropriate error header should be returned'
      ],
      priority: 'High',
      type: 'Negative',
      source: 'AI-generated',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    // 3. Edge Case (Payload size limits, special characters, null values)
    const edgeId = `TC-${String(tcIndex++).padStart(3, '0')}`;
    testCases.push({
      id: edgeId,
      title: `[Edge Case] ${epSummary} - Handles Unicode symbols, emojis, and maximum length strings safely`,
      linkedRequirements: [primaryReq],
      linkedEndpoint: formattedEndpoint,
      preconditions: `Standard authentication active. Payload includes non-ASCII UTF-8 sequences, zero-width characters, and boundary string limits.`,
      requestPayload: '{\n  "name": "Testing \uD83D\uDE80 Multi-Byte \u00A9 \u00AE Text \u0000 Edge",\n  "notes": "'.concat('A'.repeat(512), '"\n}'),
      expectedResponse: 'HTTP 200 or 422 Unprocessable Entity. System gracefully sanitizes or rejects without unhandled 500 exceptions.',
      assertions: [
        'Response HTTP status must be strictly < 500 (no unhandled 500 Internal Server Error)',
        'Unicode strings are correctly parsed or escaped without corrupting database encoding',
        'Database integrity constraints remain intact'
      ],
      priority: 'Medium',
      type: 'Edge',
      source: 'AI-generated',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    // 4. Boundary Test Case (Limit boundaries, numeric limits, empty query filters)
    const boundaryId = `TC-${String(tcIndex++).padStart(3, '0')}`;
    testCases.push({
      id: boundaryId,
      title: `[Boundary] ${epSummary} - Boundary limits for pagination and numeric threshold fields`,
      linkedRequirements: [primaryReq],
      linkedEndpoint: formattedEndpoint,
      preconditions: 'Client submits boundary values (e.g. limit=0, limit=1000, page=-1, id=0, or maximum integer values).',
      requestPayload: '{\n  "limit": 0,\n  "offset": -1,\n  "page": 0\n}',
      expectedResponse: 'HTTP 400 Bad Request or default clamped pagination (e.g. clamped to min limit=1).',
      assertions: [
        'HTTP status code must be either 400 Bad Request or clamp to valid minimum boundary',
        'Response does not crash or loop infinitely on negative or zero indices',
        'Error message cleanly identifies the out-of-range parameter'
      ],
      priority: 'Low',
      type: 'Boundary',
      source: 'AI-generated',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
  });

  return testCases;
}

/**
 * Generate structured test suite JSON from API spec and Requirements via AI
 */
export async function generateTestCasesWithAi(
  api: ApiDefinitionPayload,
  requirementsMarkdown: string,
  userId: string,
  preferredProvider?: AiProviderId
): Promise<TestCasesGenerationResult> {
  const userConfig = getUserAiConfig(userId);
  const provider = preferredProvider || userConfig.defaultProvider;
  const apiKey = getDecryptedKey(userId, provider);
  const now = new Date().toISOString();

  const systemPrompt = `You are a Lead QA Automation Engineer & Security Architect.
You will be provided with an API Specification Contract and its detailed Requirements Markdown Document.
Your task is to generate a comprehensive, structured test case suite in strict JSON format.

RULES FOR THE TEST SUITE:
1. Cover every endpoint thoroughly with a balanced distribution of:
   - "Positive" (Happy path, expected standard workflows)
   - "Negative" (Missing auth, bad inputs, validation failures, wrong types, missing required fields)
   - "Edge" (Special unicode, nulls, concurrency, idempotency, large payloads)
   - "Boundary" (Min/Max lengths, numeric extremes, limit=0, max pagination, off-by-one tests)
2. Priority MUST be strictly one of: "High", "Medium", "Low".
3. Type MUST be strictly one of: "Positive", "Negative", "Edge", "Boundary".
4. Source MUST be set to: "AI-generated".
5. linkedRequirements MUST be an array of requirement IDs found in the requirements document (e.g. ["REQ-AUTH-01", "REQ-SEC-02"]). If specific IDs are absent, derive sensible ones matching the document sections.
6. linkedEndpoint MUST be in the format: "<METHOD> <path>", e.g. "POST /api/v1/auth/login" or "GET /users".
7. requestPayload MUST be a valid formatted JSON string (or empty object if GET with no query params).
8. expectedResponse MUST detail the exact expected HTTP status code and response payload shape.
9. assertions MUST be an array of specific, testable criteria (e.g. ["HTTP status is 200", "response.id is non-empty string"]).

OUTPUT FORMAT:
Output ONLY valid JSON adhering exactly to this JSON schema (no explanation, no markdown text outside the json block):
{
  "testCases": [
    {
      "id": "TC-001",
      "title": "Title describing what is tested",
      "linkedRequirements": ["REQ-01"],
      "linkedEndpoint": "GET /endpoint",
      "preconditions": "Preconditions required before test execution",
      "requestPayload": "{\\"field\\": \\"value\\"}",
      "expectedResponse": "HTTP 200 OK with data",
      "assertions": [
        "Response status code is 200",
        "Body matches schema"
      ],
      "priority": "High",
      "type": "Positive",
      "source": "AI-generated"
    }
  ]
}`;

  const userPrompt = `API NAME: ${api.name}
VERSION: ${api.version || '1.0.0'}
BASE URL: ${api.baseUrl}
AUTH TYPE: ${api.authType || 'none'} (${api.authDetails || 'N/A'})
BUSINESS RULES: ${api.businessRules || 'Standard enterprise business rules'}
VALIDATION RULES: ${api.validationRules || 'Strict input validation'}

ENDPOINTS IN CONTRACT:
${JSON.stringify(
  (api.endpoints || []).map((e) => ({
    method: e.method,
    path: e.path,
    summary: e.summary,
    parameters: e.parameters,
    responseStatusCode: e.responseStatusCode,
    errorResponses: e.errorResponses,
  })),
  null,
  2
)}

REQUIREMENTS DOCUMENT (MARKDOWN):
${requirementsMarkdown.slice(0, 12000)}

Please generate at least 6 to 12 detailed, high-coverage test cases covering Positive, Negative, Edge, and Boundary scenarios across these endpoints and requirements. Return ONLY valid JSON.`;

  if (apiKey) {
    try {
      let rawJsonText = '';

      switch (provider) {
        case 'gemini': {
          try {
            const ai = new GoogleGenAI({ apiKey });
            const response = await ai.models.generateContent({
              model: 'gemini-2.5-flash',
              contents: `${systemPrompt}\n\n${userPrompt}`,
              config: {
                responseMimeType: 'application/json',
              },
            });

            rawJsonText = response.text || '';
          } catch (geminiErr: any) {
            console.warn('Gemini test case generation failed:', geminiErr.message);
          }
          break;
        }

        case 'openai': {
          try {
            const controller = new AbortController();
            const timeout = setTimeout(() => controller.abort(), 30000);

            const res = await fetch('https://api.openai.com/v1/chat/completions', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${apiKey}`,
              },
              body: JSON.stringify({
                model: 'gpt-4o-mini',
                messages: [
                  { role: 'system', content: systemPrompt },
                  { role: 'user', content: userPrompt },
                ],
                response_format: { type: 'json_object' },
                temperature: 0.2,
              }),
              signal: controller.signal,
            });
            clearTimeout(timeout);

            if (res.ok) {
              const data = await res.json();
              rawJsonText = data.choices?.[0]?.message?.content || '';
            }
          } catch (openAiErr: any) {
            console.warn('OpenAI test case generation failed:', openAiErr.message);
          }
          break;
        }

        case 'anthropic': {
          try {
            const controller = new AbortController();
            const timeout = setTimeout(() => controller.abort(), 30000);

            const res = await fetch('https://api.anthropic.com/v1/messages', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'x-api-key': apiKey,
                'anthropic-version': '2023-06-01',
              },
              body: JSON.stringify({
                model: 'claude-3-5-haiku-20241022',
                max_tokens: 4096,
                system: systemPrompt,
                messages: [{ role: 'user', content: userPrompt }],
              }),
              signal: controller.signal,
            });
            clearTimeout(timeout);

            if (res.ok) {
              const data = await res.json();
              rawJsonText = data.content?.[0]?.text || '';
            }
          } catch (anthropicErr: any) {
            console.warn('Anthropic test case generation failed:', anthropicErr.message);
          }
          break;
        }
      }

      if (rawJsonText.trim()) {
        // Clean markdown backticks if present
        let cleaned = rawJsonText.trim();
        if (cleaned.startsWith('```json')) {
          cleaned = cleaned.replace(/^```json\n?/, '').replace(/\n?```$/, '');
        } else if (cleaned.startsWith('```')) {
          cleaned = cleaned.replace(/^```\n?/, '').replace(/\n?```$/, '');
        }

        try {
          const parsed = JSON.parse(cleaned);
          const rawCases = Array.isArray(parsed) ? parsed : parsed.testCases || parsed.tests || [];
          if (Array.isArray(rawCases) && rawCases.length > 0) {
            const normalized: TestCaseItem[] = rawCases.map((tc: any, idx: number) => ({
              id: tc.id || `TC-${String(idx + 1).padStart(3, '0')}`,
              title: tc.title || `Test Case ${idx + 1}`,
              linkedRequirements: Array.isArray(tc.linkedRequirements)
                ? tc.linkedRequirements
                : tc.linkedRequirement
                ? [tc.linkedRequirement]
                : ['REQ-GEN-01'],
              linkedEndpoint: tc.linkedEndpoint || (api.endpoints?.[0] ? `${api.endpoints[0].method} ${api.endpoints[0].path}` : 'GET /'),
              preconditions: tc.preconditions || 'Standard active API session.',
              requestPayload: typeof tc.requestPayload === 'string'
                ? tc.requestPayload
                : JSON.stringify(tc.requestPayload ?? {}, null, 2),
              expectedResponse: tc.expectedResponse || 'HTTP 200 OK',
              assertions: Array.isArray(tc.assertions)
                ? tc.assertions
                : [tc.assertions || 'HTTP status is 200'],
              priority: ['High', 'Medium', 'Low'].includes(tc.priority) ? tc.priority : 'Medium',
              type: ['Positive', 'Negative', 'Edge', 'Boundary'].includes(tc.type) ? tc.type : 'Positive',
              source: 'AI-generated',
              createdAt: now,
              updatedAt: now,
            }));

            return {
              testCases: normalized,
              provider,
              model: provider === 'gemini' ? 'gemini-2.5-flash' : provider === 'openai' ? 'gpt-4o-mini' : 'claude-3-5-haiku-20241022',
              generatedAt: now,
            };
          }
        } catch (parseErr) {
          console.warn('Could not parse AI JSON output for test cases:', parseErr);
        }
      }
    } catch (apiErr: any) {
      console.warn('AI provider call failed for test cases, using high-fidelity synthesizer:', apiErr.message);
    }
  }

  // Fallback to high-fidelity synthesized test cases
  return {
    testCases: synthesizeTestCaseSuite(api, requirementsMarkdown),
    provider,
    model: 'synthetic-qa-engine-v2',
    generatedAt: now,
    isFallback: true,
  };
}

