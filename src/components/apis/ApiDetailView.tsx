import { useState } from 'react';
import type { ApiSpec, ApiEndpoint, ApiCoverageStatus } from '../../types';
import { formatRelativeTime } from '../../lib/utils';
import { Button } from '../ui/Button';
import { useToast } from '../ui/Toast';
import {
  ArrowLeft,
  Edit2,
  ExternalLink,
  Trash2,
  Copy,
  Check,
  Key,
  Shield,
  Layers,
  FileCode2,
  Code2,
  Cloud,
  CheckCircle2,
  AlertCircle,
  Clock,
  Globe,
  FileText,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';

interface ApiDetailViewProps {
  spec: ApiSpec;
  coverageStatus?: ApiCoverageStatus;
  onBack: () => void;
  onEdit: (spec: ApiSpec) => void;
  onDelete: (spec: ApiSpec) => void;
}

export function ApiDetailView({
  spec,
  coverageStatus = 'not_analyzed',
  onBack,
  onEdit,
  onDelete,
}: ApiDetailViewProps) {
  const { showToast } = useToast();
  const [copiedText, setCopiedText] = useState<string | null>(null);
  const [selectedMethodFilter, setSelectedMethodFilter] = useState<string>('ALL');
  const [activeTab, setActiveTab] = useState<'structured' | 'rawJson'>('structured');
  const [expandedEndpoints, setExpandedEndpoints] = useState<Record<string, boolean>>(() => {
    // Expand first endpoint by default
    const initial: Record<string, boolean> = {};
    if (spec.endpoints && spec.endpoints.length > 0) {
      initial[spec.endpoints[0].id] = true;
    }
    return initial;
  });

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopiedText(label);
    showToast({
      type: 'success',
      title: 'Copied to Clipboard',
      description: `${label} copied successfully.`,
    });
    setTimeout(() => {
      setCopiedText(null);
    }, 2000);
  };

  const toggleEndpoint = (id: string) => {
    setExpandedEndpoints((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const expandAll = () => {
    const all: Record<string, boolean> = {};
    spec.endpoints.forEach((ep) => {
      all[ep.id] = true;
    });
    setExpandedEndpoints(all);
  };

  const collapseAll = () => {
    setExpandedEndpoints({});
  };

  const filteredEndpoints = spec.endpoints.filter((ep) => {
    if (selectedMethodFilter === 'ALL') return true;
    return ep.method.toUpperCase() === selectedMethodFilter;
  });

  const renderCoverageBadge = () => {
    switch (coverageStatus) {
      case 'good':
        return (
          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
            <span className="w-2 h-2 rounded-full bg-emerald-500 mr-1.5" />
            Good Coverage
          </span>
        );
      case 'partial':
        return (
          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200">
            <span className="w-2 h-2 rounded-full bg-amber-500 mr-1.5" />
            Partial Coverage
          </span>
        );
      case 'not_analyzed':
      default:
        return (
          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-stone-100 text-stone-600 border border-stone-200">
            <span className="w-2 h-2 rounded-full bg-stone-400 mr-1.5" />
            Not analyzed
          </span>
        );
    }
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
    <div className="space-y-6 max-w-6xl mx-auto pb-16">
      {/* Top Navigation & Action Bar */}
      <div className="flex items-center justify-between gap-4 flex-wrap pb-4 border-b border-stone-200">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={onBack}
            leftIcon={<ArrowLeft className="w-4 h-4" />}
          >
            Back to APIs
          </Button>
          <div className="h-4 w-px bg-stone-300" />
          <span className="text-xs text-stone-500 font-medium">Specification Details</span>
        </div>

        <div className="flex items-center gap-2">
          {spec.oneDriveWebUrl && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => window.open(spec.oneDriveWebUrl, '_blank')}
              leftIcon={<Cloud className="w-3.5 h-3.5 text-indigo-600" />}
              rightIcon={<ExternalLink className="w-3 h-3 text-stone-400" />}
            >
              Open in OneDrive
            </Button>
          )}

          <Button
            variant="primary"
            size="sm"
            onClick={() => onEdit(spec)}
            leftIcon={<Edit2 className="w-3.5 h-3.5" />}
          >
            Edit Specification
          </Button>

          <Button
            variant="ghost"
            size="sm"
            onClick={() => onDelete(spec)}
            className="text-stone-400 hover:text-rose-600"
            title="Delete API"
          >
            <Trash2 className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Hero Header Card */}
      <div className="bg-white border border-stone-200 rounded-xl p-6 shadow-2xs">
        <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2.5 flex-wrap mb-2">
              <h1 className="text-xl font-bold text-stone-900 tracking-tight">{spec.name}</h1>
              <span className="text-xs font-mono font-semibold bg-stone-100 text-stone-700 px-2 py-0.5 rounded border border-stone-200">
                v{spec.version || '1.0.0'}
              </span>
              {renderCoverageBadge()}
            </div>

            <div className="flex items-center gap-2 text-xs text-indigo-600 font-mono mb-3">
              <Globe className="w-3.5 h-3.5 text-indigo-500" />
              <span>{spec.baseUrl}</span>
              <button
                type="button"
                onClick={() => copyToClipboard(spec.baseUrl, 'Base URL')}
                className="p-1 text-stone-400 hover:text-indigo-600 rounded transition-colors"
                title="Copy Base URL"
              >
                {copiedText === 'Base URL' ? (
                  <Check className="w-3 h-3 text-emerald-600" />
                ) : (
                  <Copy className="w-3 h-3" />
                )}
              </button>
            </div>

            {spec.description && (
              <p className="text-xs text-stone-600 max-w-3xl leading-relaxed">
                {spec.description}
              </p>
            )}
          </div>

          <div className="flex flex-col items-start md:items-end gap-1 text-xs text-stone-500 shrink-0">
            <span className="font-semibold text-stone-700">
              {spec.endpoints.length} Total {spec.endpoints.length === 1 ? 'Endpoint' : 'Endpoints'}
            </span>
            <div className="flex items-center gap-1.5 text-[11px] text-stone-400">
              <Clock className="w-3 h-3" />
              <span>Last Updated {formatRelativeTime(spec.updatedAt)}</span>
            </div>
            {spec.oneDriveItemId && (
              <div className="flex items-center gap-1 text-[11px] text-indigo-600 mt-1">
                <Cloud className="w-3 h-3" />
                <span>Synchronized with OneDrive</span>
              </div>
            )}
          </div>
        </div>

        {/* Auth specs row */}
        <div className="mt-5 pt-4 border-t border-stone-100 flex items-center gap-3 text-xs flex-wrap">
          <div className="flex items-center gap-1.5 text-stone-700 font-semibold">
            <Key className="w-3.5 h-3.5 text-stone-500" />
            <span>Authentication:</span>
          </div>
          <span className="capitalize font-mono bg-stone-100 text-stone-800 px-2 py-0.5 rounded text-[11px] border border-stone-200">
            {spec.authType}
          </span>
          {spec.authDetails && (
            <span className="text-stone-500 text-xs font-mono">({spec.authDetails})</span>
          )}
        </div>
      </div>

      {/* Tabs: Structured Format vs Raw JSON */}
      <div className="flex border-b border-stone-200 text-xs">
        <button
          type="button"
          onClick={() => setActiveTab('structured')}
          className={`pb-2.5 px-4 font-semibold border-b-2 transition-colors flex items-center gap-1.5 ${
            activeTab === 'structured'
              ? 'border-indigo-600 text-indigo-600'
              : 'border-transparent text-stone-500 hover:text-stone-800'
          }`}
        >
          <Layers className="w-3.5 h-3.5" />
          Structured Specification
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('rawJson')}
          className={`pb-2.5 px-4 font-semibold border-b-2 transition-colors flex items-center gap-1.5 ${
            activeTab === 'rawJson'
              ? 'border-indigo-600 text-indigo-600'
              : 'border-transparent text-stone-500 hover:text-stone-800'
          }`}
        >
          <Code2 className="w-3.5 h-3.5" />
          Exported JSON Spec
        </button>
      </div>

      {/* RAW JSON VIEW */}
      {activeTab === 'rawJson' && (
        <div className="bg-white border border-stone-200 rounded-xl p-5 shadow-2xs space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-stone-700">
              Contract JSON representation (persisted to OneDrive apis/{spec.name.replace(/[^a-zA-Z0-9_-]/g, '_')}.json)
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => copyToClipboard(JSON.stringify(spec, null, 2), 'Full JSON Spec')}
              leftIcon={<Copy className="w-3 h-3" />}
            >
              Copy JSON
            </Button>
          </div>
          <pre className="text-xs font-mono bg-stone-900 text-stone-100 p-4 rounded-lg overflow-x-auto max-h-[600px] leading-relaxed">
            {JSON.stringify(spec, null, 2)}
          </pre>
        </div>
      )}

      {/* STRUCTURED FORMAT VIEW */}
      {activeTab === 'structured' && (
        <div className="space-y-6">
          {/* Rules Grid: Business Rules + Validation Rules */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Business Rules */}
            <div className="bg-white border border-stone-200 rounded-xl p-5 shadow-2xs">
              <h3 className="text-xs font-bold text-stone-900 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                <Shield className="w-3.5 h-3.5 text-indigo-600" />
                Business Rules & Logic
              </h3>
              {spec.businessRules ? (
                <div className="text-xs text-stone-700 leading-relaxed whitespace-pre-line font-mono bg-stone-50 p-3 rounded-lg border border-stone-100">
                  {spec.businessRules}
                </div>
              ) : (
                <p className="text-xs text-stone-400 italic">
                  No explicit business rules specified.
                </p>
              )}
            </div>

            {/* Validation Rules */}
            <div className="bg-white border border-stone-200 rounded-xl p-5 shadow-2xs">
              <h3 className="text-xs font-bold text-stone-900 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                Validation Rules & Schema Bounds
              </h3>
              {spec.validationRules ? (
                <div className="text-xs text-stone-700 leading-relaxed whitespace-pre-line font-mono bg-stone-50 p-3 rounded-lg border border-stone-100">
                  {spec.validationRules}
                </div>
              ) : (
                <p className="text-xs text-stone-400 italic">
                  Standard JSON Schema validation bounds applied.
                </p>
              )}
            </div>
          </div>

          {/* Endpoints Explorer Header & Filters */}
          <div className="bg-white border border-stone-200 rounded-xl p-5 shadow-2xs">
            <div className="flex items-center justify-between pb-4 border-b border-stone-100 flex-wrap gap-3">
              <div>
                <h3 className="text-sm font-bold text-stone-900 flex items-center gap-2">
                  <Layers className="w-4 h-4 text-indigo-600" />
                  Endpoints & Route Handlers ({spec.endpoints.length})
                </h3>
                <p className="text-xs text-stone-500">
                  Method, route parameters, request payloads, response codes, and error schemas
                </p>
              </div>

              {/* Method Filter Buttons & Expand All */}
              <div className="flex items-center gap-2 flex-wrap">
                <div className="inline-flex rounded-md shadow-2xs border border-stone-200 bg-stone-50 p-0.5 text-xs font-semibold">
                  {['ALL', 'GET', 'POST', 'PUT', 'DELETE', 'PATCH'].map((m) => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => setSelectedMethodFilter(m)}
                      className={`px-2.5 py-1 rounded transition-colors ${
                        selectedMethodFilter === m
                          ? 'bg-white text-indigo-600 shadow-2xs'
                          : 'text-stone-500 hover:text-stone-900'
                      }`}
                    >
                      {m}
                    </button>
                  ))}
                </div>

                <Button variant="ghost" size="sm" onClick={expandAll}>
                  Expand All
                </Button>
                <Button variant="ghost" size="sm" onClick={collapseAll}>
                  Collapse All
                </Button>
              </div>
            </div>

            {/* Endpoints List */}
            <div className="divide-y divide-stone-200 mt-4 space-y-4">
              {filteredEndpoints.length === 0 ? (
                <div className="py-8 text-center text-xs text-stone-500">
                  No endpoints matching method {selectedMethodFilter}.
                </div>
              ) : (
                filteredEndpoints.map((ep) => {
                  const isExpanded = Boolean(expandedEndpoints[ep.id]);
                  return (
                    <div
                      key={ep.id}
                      className="pt-4 first:pt-0 border border-stone-200 rounded-lg overflow-hidden bg-stone-50/40"
                    >
                      {/* Endpoint Header Bar */}
                      <div
                        className="p-3.5 bg-white flex items-center justify-between cursor-pointer hover:bg-stone-50 transition-colors border-b border-stone-100"
                        onClick={() => toggleEndpoint(ep.id)}
                      >
                        <div className="flex items-center gap-3 min-w-0 pr-2">
                          <span
                            className={`text-xs font-bold px-2.5 py-0.5 rounded border uppercase tracking-wider ${getMethodBadgeClass(
                              ep.method
                            )}`}
                          >
                            {ep.method}
                          </span>
                          <span className="font-mono text-sm font-bold text-stone-900 truncate">
                            {ep.path}
                          </span>
                          {ep.summary && (
                            <span className="text-xs text-stone-500 truncate hidden sm:inline">
                              — {ep.summary}
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-3 shrink-0">
                          <span className="text-[11px] font-mono text-stone-400">
                            {ep.errorResponses?.length || 0} error cases
                          </span>
                          <button
                            type="button"
                            className="p-1 text-stone-400 hover:text-stone-700"
                          >
                            {isExpanded ? (
                              <ChevronUp className="w-4 h-4" />
                            ) : (
                              <ChevronDown className="w-4 h-4" />
                            )}
                          </button>
                        </div>
                      </div>

                      {/* Endpoint Expanded Details */}
                      {isExpanded && (
                        <div className="p-5 space-y-5 text-xs bg-white">
                          {ep.description && (
                            <div className="text-xs text-stone-600 bg-stone-50 p-3 rounded-md border border-stone-100 leading-relaxed">
                              {ep.description}
                            </div>
                          )}

                          {/* Parameters Table */}
                          {ep.parameters && ep.parameters.length > 0 && (
                            <div>
                              <h4 className="text-[11px] font-bold text-stone-700 uppercase tracking-wider mb-2">
                                Parameters ({ep.parameters.length})
                              </h4>
                              <div className="border border-stone-200 rounded-lg overflow-hidden">
                                <table className="w-full text-left divide-y divide-stone-200 text-xs">
                                  <thead className="bg-stone-50 font-semibold text-stone-600">
                                    <tr>
                                      <th className="px-3 py-2">Parameter</th>
                                      <th className="px-3 py-2">Location</th>
                                      <th className="px-3 py-2">Type</th>
                                      <th className="px-3 py-2">Requirement</th>
                                      <th className="px-3 py-2">Description</th>
                                    </tr>
                                  </thead>
                                  <tbody className="divide-y divide-stone-100 font-mono text-[11px]">
                                    {ep.parameters.map((param, pIdx) => (
                                      <tr key={pIdx} className="hover:bg-stone-50/50">
                                        <td className="px-3 py-2 font-bold text-stone-900">
                                          {param.name}
                                        </td>
                                        <td className="px-3 py-2 text-stone-600 uppercase text-[10px]">
                                          {param.in}
                                        </td>
                                        <td className="px-3 py-2 text-indigo-600">{param.type || 'string'}</td>
                                        <td className="px-3 py-2">
                                          {param.required ? (
                                            <span className="text-rose-600 font-semibold">Required</span>
                                          ) : (
                                            <span className="text-stone-400">Optional</span>
                                          )}
                                        </td>
                                        <td className="px-3 py-2 font-sans text-xs text-stone-600">
                                          {param.description || '—'}
                                        </td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            </div>
                          )}

                          {/* Schemas: Request & Response */}
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {/* Request Schema */}
                            <div className="border border-stone-200 rounded-lg p-3 bg-stone-50/60">
                              <div className="flex items-center justify-between mb-2">
                                <span className="text-[11px] font-bold text-stone-700 uppercase tracking-wider">
                                  Request Schema / Payload
                                </span>
                                {ep.requestSchema && (
                                  <button
                                    type="button"
                                    onClick={() =>
                                      copyToClipboard(ep.requestSchema || '', `${ep.method} ${ep.path} Request Schema`)
                                    }
                                    className="text-[11px] text-indigo-600 hover:text-indigo-800 flex items-center gap-1 font-medium"
                                  >
                                    <Copy className="w-3 h-3" />
                                    Copy
                                  </button>
                                )}
                              </div>
                              {ep.requestSchema ? (
                                <pre className="text-[11px] font-mono bg-white border border-stone-200 p-2.5 rounded-md overflow-x-auto max-h-56 leading-relaxed text-stone-800">
                                  {ep.requestSchema}
                                </pre>
                              ) : (
                                <p className="text-xs text-stone-400 italic">No request payload required.</p>
                              )}
                            </div>

                            {/* Response Schema */}
                            <div className="border border-stone-200 rounded-lg p-3 bg-stone-50/60">
                              <div className="flex items-center justify-between mb-2">
                                <div className="flex items-center gap-2">
                                  <span className="text-[11px] font-bold text-stone-700 uppercase tracking-wider">
                                    Response Schema
                                  </span>
                                  <span className="text-[10px] font-mono font-semibold bg-emerald-50 text-emerald-700 px-1.5 py-0.2 rounded border border-emerald-200">
                                    HTTP {ep.responseStatusCode || 200}
                                  </span>
                                </div>
                                {ep.responseSchema && (
                                  <button
                                    type="button"
                                    onClick={() =>
                                      copyToClipboard(ep.responseSchema || '', `${ep.method} ${ep.path} Response Schema`)
                                    }
                                    className="text-[11px] text-indigo-600 hover:text-indigo-800 flex items-center gap-1 font-medium"
                                  >
                                    <Copy className="w-3 h-3" />
                                    Copy
                                  </button>
                                )}
                              </div>
                              {ep.responseSchema ? (
                                <pre className="text-[11px] font-mono bg-white border border-stone-200 p-2.5 rounded-md overflow-x-auto max-h-56 leading-relaxed text-stone-800">
                                  {ep.responseSchema}
                                </pre>
                              ) : (
                                <p className="text-xs text-stone-400 italic">Empty response payload.</p>
                              )}
                            </div>
                          </div>

                          {/* Error Responses Section */}
                          {ep.errorResponses && ep.errorResponses.length > 0 && (
                            <div>
                              <h4 className="text-[11px] font-bold text-stone-700 uppercase tracking-wider mb-2">
                                Expected Error Responses ({ep.errorResponses.length})
                              </h4>
                              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5">
                                {ep.errorResponses.map((err) => (
                                  <div
                                    key={err.id}
                                    className="p-3 bg-stone-50 rounded-lg border border-stone-200 text-xs"
                                  >
                                    <div className="flex items-center justify-between mb-1">
                                      <span className="font-mono font-bold text-rose-700 bg-rose-50 px-1.5 py-0.5 rounded border border-rose-200 text-[11px]">
                                        {err.statusCode}
                                      </span>
                                      <span className="font-semibold text-stone-900 text-xs">
                                        {err.name}
                                      </span>
                                    </div>
                                    <p className="text-[11px] text-stone-500 mt-1 leading-snug">
                                      {err.description || 'Triggered on validation error or rule constraint violation.'}
                                    </p>
                                    {err.schema && (
                                      <pre className="mt-2 text-[10px] font-mono bg-white p-1.5 rounded border border-stone-200 overflow-x-auto">
                                        {err.schema}
                                      </pre>
                                    )}
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
