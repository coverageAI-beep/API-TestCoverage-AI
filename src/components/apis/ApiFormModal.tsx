import { useState, useEffect, type FormEvent, type ChangeEvent } from 'react';
import type {
  ApiSpec,
  ApiEndpoint,
  ApiEndpointError,
  ApiAuthType,
  Project,
} from '../../types';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { parseOpenApiSpec } from '../../lib/openApiParser';
import {
  FileCode2,
  Upload,
  Plus,
  Trash2,
  AlertCircle,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Key,
  Shield,
  Layers,
  Code2,
  FileText,
  HelpCircle,
} from 'lucide-react';

interface ApiFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (spec: ApiSpec) => Promise<void>;
  initialSpec?: ApiSpec | null;
  activeProject: Project;
  isSaving: boolean;
}

export function ApiFormModal({
  isOpen,
  onClose,
  onSave,
  initialSpec,
  activeProject,
  isSaving,
}: ApiFormModalProps) {
  const [activeTab, setActiveTab] = useState<'manual' | 'openapi'>('manual');

  // Form State
  const [apiName, setApiName] = useState('');
  const [baseUrl, setBaseUrl] = useState('');
  const [version, setVersion] = useState('1.0.0');
  const [description, setDescription] = useState('');
  const [authType, setAuthType] = useState<ApiAuthType>('bearer');
  const [authDetails, setAuthDetails] = useState('');
  const [businessRules, setBusinessRules] = useState('');
  const [validationRules, setValidationRules] = useState('');
  const [endpoints, setEndpoints] = useState<ApiEndpoint[]>([]);

  // OpenAPI Upload/Paste State
  const [pasteContent, setPasteContent] = useState('');
  const [parseError, setParseError] = useState<string | null>(null);
  const [parseSuccessInfo, setParseSuccessInfo] = useState<string | null>(null);

  // Accordion state for endpoints
  const [expandedEndpointIds, setExpandedEndpointIds] = useState<Record<string, boolean>>({});

  // Reset or initialize form when opening
  useEffect(() => {
    if (initialSpec) {
      setApiName(initialSpec.name || '');
      setBaseUrl(initialSpec.baseUrl || '');
      setVersion(initialSpec.version || '1.0.0');
      setDescription(initialSpec.description || '');
      setAuthType(initialSpec.authType || 'none');
      setAuthDetails(initialSpec.authDetails || '');
      setBusinessRules(initialSpec.businessRules || '');
      setValidationRules(initialSpec.validationRules || '');
      setEndpoints(initialSpec.endpoints || []);
      setActiveTab('manual');
      // expand first endpoint
      if (initialSpec.endpoints.length > 0) {
        setExpandedEndpointIds({ [initialSpec.endpoints[0].id]: true });
      }
    } else {
      // Default new API template
      const defaultId = `ep_${Date.now()}`;
      setApiName('');
      setBaseUrl(activeProject.targetEnvironmentUrl || 'https://api.staging.example.com/v1');
      setVersion('1.0.0');
      setDescription('');
      setAuthType('bearer');
      setAuthDetails('Bearer JWT token in Authorization header');
      setBusinessRules('• Requests must adhere to schema validation and authorization policies.\n• Idempotency-Key required on state-mutating requests.\n• Rate limits enforced at 100 req/min per client.');
      setValidationRules('• All path parameters must be non-empty strings.\n• JSON payload must adhere strictly to declared schema properties.\n• Dates must conform to ISO 8601 UTC format.');
      setEndpoints([
        {
          id: defaultId,
          method: 'GET',
          path: '/v1/resources',
          summary: 'List Workspace Resources',
          description: 'Returns paginated array of resources for the active tenant.',
          parameters: [
            { name: 'limit', in: 'query', required: false, type: 'integer', description: 'Page size limit (max 100)' },
            { name: 'cursor', in: 'query', required: false, type: 'string', description: 'Pagination cursor' }
          ],
          responseStatusCode: 200,
          responseSchema: JSON.stringify({ data: [], nextCursor: null, totalCount: 0 }, null, 2),
          errorResponses: [
            { id: 'err_1', statusCode: 401, name: 'Unauthorized', description: 'Invalid or expired bearer token' },
            { id: 'err_2', statusCode: 500, name: 'Internal Server Error', description: 'Server-side execution fault' }
          ]
        }
      ]);
      setExpandedEndpointIds({ [defaultId]: true });
      setPasteContent('');
      setParseError(null);
      setParseSuccessInfo(null);
      setActiveTab('manual');
    }
  }, [initialSpec, activeProject, isOpen]);

  // Handle OpenAPI Spec parsing
  const handleParseSpec = () => {
    if (!pasteContent.trim()) {
      setParseError('Please paste an OpenAPI or Swagger JSON/YAML specification first.');
      return;
    }

    setParseError(null);
    setParseSuccessInfo(null);

    const result = parseOpenApiSpec(pasteContent, activeProject.id);
    if (!result.success || !result.spec) {
      setParseError(result.error || 'Failed to parse specification.');
      return;
    }

    const s = result.spec;
    setApiName(s.name || apiName);
    if (s.baseUrl) setBaseUrl(s.baseUrl);
    if (s.description) setDescription(s.description);
    if (s.version) setVersion(s.version);
    if (s.authType) setAuthType(s.authType);
    if (s.authDetails) setAuthDetails(s.authDetails);
    if (s.businessRules) setBusinessRules(s.businessRules);
    if (s.validationRules) setValidationRules(s.validationRules);
    if (s.endpoints && s.endpoints.length > 0) {
      setEndpoints(s.endpoints);
      const newExpanded: Record<string, boolean> = {};
      newExpanded[s.endpoints[0].id] = true;
      setExpandedEndpointIds(newExpanded);
    }

    setParseSuccessInfo(
      `Successfully extracted ${s.endpoints?.length || 0} endpoint(s), title "${s.name}", and auth scheme. Switching to form view for review.`
    );

    // Switch back to manual tab after brief moment
    setTimeout(() => {
      setActiveTab('manual');
    }, 1200);
  };

  // Handle file drop/selection for OpenAPI
  const handleFileUpload = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      if (text) {
        setPasteContent(text);
        setParseError(null);
        setParseSuccessInfo(`Loaded ${file.name} (${Math.round(file.size / 1024)} KB). Click "Parse Specification" below.`);
      }
    };
    reader.readAsText(file);
  };

  // Endpoint management
  const addEndpoint = () => {
    const newId = `ep_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const newEndpoint: ApiEndpoint = {
      id: newId,
      method: 'POST',
      path: '/v1/new-endpoint',
      summary: 'New Endpoint',
      description: '',
      responseStatusCode: 200,
      responseSchema: '{\n  "success": true\n}',
      errorResponses: [
        { id: `err_${Date.now()}`, statusCode: 400, name: 'Bad Request', description: 'Invalid request parameters' }
      ]
    };
    setEndpoints((prev) => [...prev, newEndpoint]);
    setExpandedEndpointIds((prev) => ({ ...prev, [newId]: true }));
  };

  const removeEndpoint = (endpointId: string) => {
    if (endpoints.length <= 1) return;
    setEndpoints((prev) => prev.filter((ep) => ep.id !== endpointId));
  };

  const updateEndpoint = (endpointId: string, partial: Partial<ApiEndpoint>) => {
    setEndpoints((prev) =>
      prev.map((ep) => (ep.id === endpointId ? { ...ep, ...partial } : ep))
    );
  };

  const toggleEndpointExpand = (id: string) => {
    setExpandedEndpointIds((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  // Error responses inside an endpoint
  const addErrorResponse = (endpointId: string) => {
    const newErr: ApiEndpointError = {
      id: `err_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      statusCode: 400,
      name: 'Bad Request',
      description: 'Client error description'
    };
    setEndpoints((prev) =>
      prev.map((ep) =>
        ep.id === endpointId
          ? { ...ep, errorResponses: [...ep.errorResponses, newErr] }
          : ep
      )
    );
  };

  const removeErrorResponse = (endpointId: string, errorId: string) => {
    setEndpoints((prev) =>
      prev.map((ep) =>
        ep.id === endpointId
          ? { ...ep, errorResponses: ep.errorResponses.filter((e) => e.id !== errorId) }
          : ep
      )
    );
  };

  const updateErrorResponse = (
    endpointId: string,
    errorId: string,
    partial: Partial<ApiEndpointError>
  ) => {
    setEndpoints((prev) =>
      prev.map((ep) =>
        ep.id === endpointId
          ? {
              ...ep,
              errorResponses: ep.errorResponses.map((err) =>
                err.id === errorId ? { ...err, ...partial } : err
              ),
            }
          : ep
      )
    );
  };

  // Form submit
  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!apiName.trim()) return;

    const now = new Date().toISOString();
    const finalSpec: ApiSpec = {
      id: initialSpec?.id || `api_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      projectId: activeProject.id,
      name: apiName.trim(),
      description: description.trim(),
      baseUrl: baseUrl.trim() || 'https://api.example.com',
      version: version.trim() || '1.0.0',
      authType,
      authDetails: authDetails.trim(),
      businessRules: businessRules.trim(),
      validationRules: validationRules.trim(),
      endpoints,
      oneDriveItemId: initialSpec?.oneDriveItemId,
      oneDriveWebUrl: initialSpec?.oneDriveWebUrl,
      createdAt: initialSpec?.createdAt || now,
      updatedAt: now,
      sourceType: activeTab === 'openapi' ? 'openapi_paste' : (initialSpec?.sourceType || 'manual'),
      rawSpecContent: pasteContent || initialSpec?.rawSpecContent,
    };

    await onSave(finalSpec);
  };

  const getMethodBadgeClass = (method: string) => {
    switch (method.toUpperCase()) {
      case 'GET':
        return 'bg-blue-50 text-blue-700 border-blue-200';
      case 'POST':
        return 'bg-emerald-50 text-emerald-700 border-emerald-200';
      case 'PUT':
        return 'bg-amber-50 text-amber-700 border-amber-200';
      case 'DELETE':
        return 'bg-rose-50 text-rose-700 border-rose-200';
      case 'PATCH':
        return 'bg-purple-50 text-purple-700 border-purple-200';
      default:
        return 'bg-stone-50 text-stone-700 border-stone-200';
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={initialSpec ? `Edit API Specification` : 'Add API Specification'}
      description={`Project: ${activeProject.name} • Saved as JSON in OneDrive "apis" folder & indexed in Firestore`}
      maxWidth="xl"
    >
      {/* Mode Switcher Tabs */}
      <div className="flex border-b border-stone-200 mb-5 text-xs">
        <button
          type="button"
          onClick={() => setActiveTab('manual')}
          className={`pb-2.5 px-4 font-semibold border-b-2 transition-colors flex items-center gap-1.5 ${
            activeTab === 'manual'
              ? 'border-indigo-600 text-indigo-600'
              : 'border-transparent text-stone-500 hover:text-stone-800'
          }`}
        >
          <FileText className="w-3.5 h-3.5" />
          Structured Form Editor
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('openapi')}
          className={`pb-2.5 px-4 font-semibold border-b-2 transition-colors flex items-center gap-1.5 ${
            activeTab === 'openapi'
              ? 'border-indigo-600 text-indigo-600'
              : 'border-transparent text-stone-500 hover:text-stone-800'
          }`}
        >
          <Code2 className="w-3.5 h-3.5" />
          Upload or Paste OpenAPI Spec
        </button>
      </div>

      {/* TAB 1: Upload / Paste OpenAPI */}
      {activeTab === 'openapi' && (
        <div className="space-y-4">
          <div className="bg-indigo-50/70 border border-indigo-100 rounded-lg p-3 text-xs text-indigo-900 leading-relaxed flex items-start gap-2.5">
            <HelpCircle className="w-4 h-4 text-indigo-600 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold mb-0.5">Automated Spec Ingestion</p>
              Upload a <strong>.yaml</strong>, <strong>.yml</strong>, or <strong>.json</strong> OpenAPI (Swagger 2.0 or 3.x) document or paste its content. CoverageAI extracts all endpoints, request schemas, parameters, and error mappings automatically into structured format.
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-stone-700 mb-1.5">
              Upload Specification File
            </label>
            <input
              type="file"
              accept=".yaml,.yml,.json"
              onChange={handleFileUpload}
              className="w-full text-xs text-stone-600 file:mr-3 file:py-1.5 file:px-3 file:rounded-md file:border-0 file:text-xs file:font-semibold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100 cursor-pointer"
            />
          </div>

          <div>
            <div className="flex justify-between items-center mb-1">
              <label className="text-xs font-semibold text-stone-700">
                Or Paste Spec (JSON or YAML)
              </label>
              <span className="text-[11px] text-stone-400 font-mono">OpenAPI 3.x / Swagger 2.0</span>
            </div>
            <textarea
              rows={12}
              value={pasteContent}
              onChange={(e) => setPasteContent(e.target.value)}
              placeholder={`openapi: 3.0.0\ninfo:\n  title: Payments Gateway API\n  version: 1.0.0\npaths:\n  /v1/charges:\n    post:\n      summary: Create charge\n      responses:\n        '200':\n          description: Success\n        '400':\n          description: Invalid card`}
              className="w-full text-xs font-mono bg-stone-50 border border-stone-200 rounded-lg p-3 text-stone-900 focus:ring-2 focus:ring-indigo-600 focus:outline-none leading-relaxed"
            />
          </div>

          {parseError && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-md text-xs text-rose-700 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{parseError}</span>
            </div>
          )}

          {parseSuccessInfo && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-md text-xs text-emerald-800 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
              <span>{parseSuccessInfo}</span>
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setActiveTab('manual')}
            >
              Switch to Form View
            </Button>
            <Button
              type="button"
              variant="primary"
              size="sm"
              onClick={handleParseSpec}
              leftIcon={<Code2 className="w-3.5 h-3.5" />}
            >
              Parse Specification
            </Button>
          </div>
        </div>
      )}

      {/* TAB 2: Manual Structured Form */}
      {activeTab === 'manual' && (
        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Top Section: API Name & Base URL */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="md:col-span-2">
              <label className="block text-xs font-semibold text-stone-700 mb-1">
                API Name <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                required
                value={apiName}
                onChange={(e) => setApiName(e.target.value)}
                placeholder="e.g. Invoicing & Billing Engine"
                className="w-full text-xs bg-white border border-stone-200 rounded-md p-2 text-stone-900 focus:ring-2 focus:ring-indigo-600 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-stone-700 mb-1">
                Specification Version
              </label>
              <input
                type="text"
                value={version}
                onChange={(e) => setVersion(e.target.value)}
                placeholder="e.g. 1.0.0"
                className="w-full text-xs font-mono bg-white border border-stone-200 rounded-md p-2 text-stone-900 focus:ring-2 focus:ring-indigo-600 focus:outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-stone-700 mb-1">
                Base URL <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                required
                value={baseUrl}
                onChange={(e) => setBaseUrl(e.target.value)}
                placeholder="https://api.staging.acme.corp/v1"
                className="w-full text-xs font-mono bg-white border border-stone-200 rounded-md p-2 text-stone-900 focus:ring-2 focus:ring-indigo-600 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-stone-700 mb-1">
                Authentication Type
              </label>
              <select
                value={authType}
                onChange={(e) => setAuthType(e.target.value as ApiAuthType)}
                className="w-full text-xs bg-white border border-stone-200 rounded-md p-2 text-stone-900 focus:ring-2 focus:ring-indigo-600 focus:outline-none"
              >
                <option value="bearer">Bearer Token / JWT</option>
                <option value="apiKey">API Key (Header / Query)</option>
                <option value="oauth2">OAuth 2.0 Flow</option>
                <option value="basic">HTTP Basic Authentication</option>
                <option value="custom">Custom Auth / HMAC Signature</option>
                <option value="none">None (Public Endpoint)</option>
              </select>
            </div>
          </div>

          {authType !== 'none' && (
            <div>
              <label className="block text-xs font-semibold text-stone-700 mb-1">
                Authentication Details & Headers
              </label>
              <input
                type="text"
                value={authDetails}
                onChange={(e) => setAuthDetails(e.target.value)}
                placeholder="e.g. Authorization: Bearer <jwt> with scopes: read:billing, write:billing"
                className="w-full text-xs font-mono bg-stone-50 border border-stone-200 rounded-md p-2 text-stone-900 focus:ring-2 focus:ring-indigo-600 focus:outline-none"
              />
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-stone-700 mb-1">
              Description
            </label>
            <textarea
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="High-level purpose and architecture scope of this API contract."
              className="w-full text-xs bg-white border border-stone-200 rounded-md p-2 text-stone-900 focus:ring-2 focus:ring-indigo-600 focus:outline-none"
            />
          </div>

          {/* Section: Business Rules & Validation Rules */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
            <div className="bg-stone-50/70 border border-stone-200 rounded-lg p-3">
              <label className="block text-xs font-semibold text-stone-800 mb-1">
                Business Rules (Free Text)
              </label>
              <p className="text-[11px] text-stone-500 mb-2 leading-tight">
                Domain constraints, idempotent behaviors, state machine rules, or financial thresholds.
              </p>
              <textarea
                rows={4}
                value={businessRules}
                onChange={(e) => setBusinessRules(e.target.value)}
                placeholder="• Invoices lock 24h before cycle execution&#10;• Prorated credits compute to the second"
                className="w-full text-xs bg-white border border-stone-200 rounded-md p-2 text-stone-900 focus:ring-2 focus:ring-indigo-600 focus:outline-none leading-relaxed font-mono"
              />
            </div>

            <div className="bg-stone-50/70 border border-stone-200 rounded-lg p-3">
              <label className="block text-xs font-semibold text-stone-800 mb-1">
                Validation Rules (Free Text)
              </label>
              <p className="text-[11px] text-stone-500 mb-2 leading-tight">
                Input sanitization rules, payload bounds, regex constraints, and required parameter validations.
              </p>
              <textarea
                rows={4}
                value={validationRules}
                onChange={(e) => setValidationRules(e.target.value)}
                placeholder="• currency must be ISO 4217 code&#10;• amountCents must be positive integer&#10;• Idempotency-Key header is mandatory"
                className="w-full text-xs bg-white border border-stone-200 rounded-md p-2 text-stone-900 focus:ring-2 focus:ring-indigo-600 focus:outline-none leading-relaxed font-mono"
              />
            </div>
          </div>

          {/* Section: Endpoints List */}
          <div className="pt-2 border-t border-stone-200">
            <div className="flex items-center justify-between mb-3">
              <div>
                <h4 className="text-xs font-bold text-stone-900 uppercase tracking-wider flex items-center gap-1.5">
                  <Layers className="w-3.5 h-3.5 text-indigo-600" />
                  API Endpoints ({endpoints.length})
                </h4>
                <p className="text-[11px] text-stone-500">
                  HTTP method, route path, schemas, and possible error responses
                </p>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={addEndpoint}
                leftIcon={<Plus className="w-3.5 h-3.5" />}
              >
                Add Endpoint
              </Button>
            </div>

            <div className="space-y-3">
              {endpoints.map((ep, epIdx) => {
                const isExpanded = Boolean(expandedEndpointIds[ep.id]);
                return (
                  <div
                    key={ep.id}
                    className="border border-stone-200 rounded-lg bg-white overflow-hidden shadow-2xs"
                  >
                    {/* Endpoint Accordion Header */}
                    <div
                      className="p-3 bg-stone-50/80 flex items-center justify-between cursor-pointer hover:bg-stone-100/70 transition-colors border-b border-stone-100"
                      onClick={() => toggleEndpointExpand(ep.id)}
                    >
                      <div className="flex items-center gap-2 min-w-0 pr-2">
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded border uppercase tracking-wider ${getMethodBadgeClass(
                            ep.method
                          )}`}
                        >
                          {ep.method}
                        </span>
                        <span className="font-mono text-xs font-semibold text-stone-900 truncate">
                          {ep.path || '/'}
                        </span>
                        {ep.summary && (
                          <span className="text-xs text-stone-500 truncate hidden sm:inline">
                            — {ep.summary}
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0" onClick={(e) => e.stopPropagation()}>
                        {endpoints.length > 1 && (
                          <button
                            type="button"
                            onClick={() => removeEndpoint(ep.id)}
                            className="p-1 text-stone-400 hover:text-rose-600 rounded transition-colors"
                            title="Remove endpoint"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => toggleEndpointExpand(ep.id)}
                          className="p-1 text-stone-400 hover:text-stone-700 rounded transition-colors"
                        >
                          {isExpanded ? (
                            <ChevronUp className="w-4 h-4" />
                          ) : (
                            <ChevronDown className="w-4 h-4" />
                          )}
                        </button>
                      </div>
                    </div>

                    {/* Endpoint Body */}
                    {isExpanded && (
                      <div className="p-4 space-y-4 text-xs">
                        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                          <div>
                            <label className="block text-[11px] font-semibold text-stone-700 mb-1">
                              Method
                            </label>
                            <select
                              value={ep.method}
                              onChange={(e) =>
                                updateEndpoint(ep.id, { method: e.target.value as any })
                              }
                              className="w-full text-xs font-semibold bg-white border border-stone-200 rounded-md p-1.5 text-stone-900 focus:ring-2 focus:ring-indigo-600 focus:outline-none"
                            >
                              <option value="GET">GET</option>
                              <option value="POST">POST</option>
                              <option value="PUT">PUT</option>
                              <option value="DELETE">DELETE</option>
                              <option value="PATCH">PATCH</option>
                              <option value="HEAD">HEAD</option>
                              <option value="OPTIONS">OPTIONS</option>
                            </select>
                          </div>
                          <div className="sm:col-span-3">
                            <label className="block text-[11px] font-semibold text-stone-700 mb-1">
                              Endpoint Path <span className="text-rose-500">*</span>
                            </label>
                            <input
                              type="text"
                              required
                              value={ep.path}
                              onChange={(e) => updateEndpoint(ep.id, { path: e.target.value })}
                              placeholder="/v1/subscriptions/{id}"
                              className="w-full text-xs font-mono bg-white border border-stone-200 rounded-md p-1.5 text-stone-900 focus:ring-2 focus:ring-indigo-600 focus:outline-none"
                            />
                          </div>
                        </div>

                        <div>
                          <label className="block text-[11px] font-semibold text-stone-700 mb-1">
                            Summary & Purpose
                          </label>
                          <input
                            type="text"
                            value={ep.summary}
                            onChange={(e) => updateEndpoint(ep.id, { summary: e.target.value })}
                            placeholder="e.g. Create Customer Subscription"
                            className="w-full text-xs bg-white border border-stone-200 rounded-md p-1.5 text-stone-900 focus:ring-2 focus:ring-indigo-600 focus:outline-none"
                          />
                        </div>

                        {/* Request & Response Schemas */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          <div>
                            <label className="block text-[11px] font-semibold text-stone-700 mb-1">
                              Request Schema / Payload (JSON / Schema)
                            </label>
                            <textarea
                              rows={5}
                              value={ep.requestSchema || ''}
                              onChange={(e) =>
                                updateEndpoint(ep.id, { requestSchema: e.target.value })
                              }
                              placeholder={`{\n  "customerId": "string",\n  "planId": "string"\n}`}
                              className="w-full text-[11px] font-mono bg-stone-50 border border-stone-200 rounded-md p-2 text-stone-900 focus:ring-2 focus:ring-indigo-600 focus:outline-none leading-relaxed"
                            />
                          </div>

                          <div>
                            <div className="flex justify-between items-center mb-1">
                              <label className="text-[11px] font-semibold text-stone-700">
                                Response Schema (Success)
                              </label>
                              <div className="flex items-center gap-1">
                                <span className="text-[10px] text-stone-500">Status:</span>
                                <input
                                  type="number"
                                  value={ep.responseStatusCode || 200}
                                  onChange={(e) =>
                                    updateEndpoint(ep.id, {
                                      responseStatusCode: parseInt(e.target.value, 10) || 200,
                                    })
                                  }
                                  className="w-14 text-[11px] font-mono text-center bg-white border border-stone-200 rounded px-1 py-0.5"
                                />
                              </div>
                            </div>
                            <textarea
                              rows={5}
                              value={ep.responseSchema || ''}
                              onChange={(e) =>
                                updateEndpoint(ep.id, { responseSchema: e.target.value })
                              }
                              placeholder={`{\n  "id": "sub_123",\n  "status": "active"\n}`}
                              className="w-full text-[11px] font-mono bg-stone-50 border border-stone-200 rounded-md p-2 text-stone-900 focus:ring-2 focus:ring-indigo-600 focus:outline-none leading-relaxed"
                            />
                          </div>
                        </div>

                        {/* Error Responses */}
                        <div className="pt-2 border-t border-stone-100">
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-[11px] font-bold text-stone-700 uppercase tracking-wider">
                              Possible Error Responses ({ep.errorResponses?.length || 0})
                            </span>
                            <button
                              type="button"
                              onClick={() => addErrorResponse(ep.id)}
                              className="text-xs font-semibold text-indigo-600 hover:text-indigo-800 flex items-center gap-1"
                            >
                              <Plus className="w-3 h-3" />
                              Add Error Code
                            </button>
                          </div>

                          <div className="space-y-2">
                            {(ep.errorResponses || []).map((err) => (
                              <div
                                key={err.id}
                                className="flex items-center gap-2 bg-stone-50 p-2 rounded-md border border-stone-200"
                              >
                                <input
                                  type="number"
                                  value={err.statusCode}
                                  onChange={(e) =>
                                    updateErrorResponse(ep.id, err.id, {
                                      statusCode: parseInt(e.target.value, 10) || 400,
                                    })
                                  }
                                  className="w-16 font-mono text-center text-xs font-semibold bg-white border border-stone-300 rounded p-1"
                                  placeholder="Code"
                                />
                                <input
                                  type="text"
                                  value={err.name}
                                  onChange={(e) =>
                                    updateErrorResponse(ep.id, err.id, { name: e.target.value })
                                  }
                                  className="w-36 text-xs bg-white border border-stone-300 rounded p-1 font-semibold"
                                  placeholder="Bad Request"
                                />
                                <input
                                  type="text"
                                  value={err.description || ''}
                                  onChange={(e) =>
                                    updateErrorResponse(ep.id, err.id, {
                                      description: e.target.value,
                                    })
                                  }
                                  className="flex-1 text-xs bg-white border border-stone-300 rounded p-1 text-stone-700"
                                  placeholder="Error reason or trigger conditions"
                                />
                                <button
                                  type="button"
                                  onClick={() => removeErrorResponse(ep.id, err.id)}
                                  className="p-1 text-stone-400 hover:text-rose-600 transition-colors"
                                  title="Delete error response"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Footer Actions */}
          <div className="pt-3 border-t border-stone-200 flex items-center justify-between">
            <div className="text-[11px] text-stone-500">
              Contract will be committed to OneDrive folder: <code className="font-mono font-semibold text-stone-800">apis/</code>
            </div>
            <div className="flex items-center gap-2">
              <Button type="button" variant="ghost" size="sm" onClick={onClose}>
                Cancel
              </Button>
              <Button
                type="submit"
                variant="primary"
                size="sm"
                disabled={isSaving || !apiName.trim()}
              >
                {isSaving ? 'Saving to OneDrive...' : initialSpec ? 'Save Changes' : 'Create API Specification'}
              </Button>
            </div>
          </div>
        </form>
      )}
    </Modal>
  );
}
