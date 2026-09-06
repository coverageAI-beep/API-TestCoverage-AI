import { useState, useEffect } from 'react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import type { TestCase, TestCasePriority, TestCaseType, TestCaseSource } from '../../types';
import { Plus, Trash2, Check, Sparkles, User, AlertCircle, Code } from 'lucide-react';

interface TestCaseFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (testCase: TestCase) => Promise<void> | void;
  initialData?: TestCase | null;
  endpoints?: { method: string; path: string; summary?: string }[];
  availableRequirements?: string[];
  apiName: string;
}

export function TestCaseFormModal({
  isOpen,
  onClose,
  onSave,
  initialData,
  endpoints = [],
  availableRequirements = [],
  apiName,
}: TestCaseFormModalProps) {
  const isEditing = Boolean(initialData);

  const [title, setTitle] = useState('');
  const [type, setType] = useState<TestCaseType>('Positive');
  const [priority, setPriority] = useState<TestCasePriority>('High');
  const [linkedEndpoint, setLinkedEndpoint] = useState('');
  const [customEndpoint, setCustomEndpoint] = useState(false);
  const [reqInput, setReqInput] = useState('');
  const [linkedRequirements, setLinkedRequirements] = useState<string[]>([]);
  const [preconditions, setPreconditions] = useState('');
  const [requestPayload, setRequestPayload] = useState('{\n  \n}');
  const [expectedResponse, setExpectedResponse] = useState('');
  const [assertions, setAssertions] = useState<string[]>(['']);
  const [source, setSource] = useState<TestCaseSource>('Manual');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);

  useEffect(() => {
    if (initialData) {
      setTitle(initialData.title);
      setType(initialData.type);
      setPriority(initialData.priority);
      setLinkedEndpoint(initialData.linkedEndpoint);
      setLinkedRequirements(initialData.linkedRequirements || []);
      setPreconditions(initialData.preconditions || '');
      setRequestPayload(initialData.requestPayload || '{\n  \n}');
      setExpectedResponse(initialData.expectedResponse || '');
      setAssertions(initialData.assertions && initialData.assertions.length > 0 ? initialData.assertions : ['']);
      setSource(initialData.source || 'Manual');
      setCustomEndpoint(!endpoints.some((e) => `${e.method.toUpperCase()} ${e.path}` === initialData.linkedEndpoint));
    } else {
      // Default for new test case
      setTitle('');
      setType('Positive');
      setPriority('High');
      const firstEp = endpoints[0] ? `${endpoints[0].method.toUpperCase()} ${endpoints[0].path}` : 'GET /api';
      setLinkedEndpoint(firstEp);
      setCustomEndpoint(false);
      setLinkedRequirements(availableRequirements.slice(0, 1));
      setPreconditions('Active API session with authorized credentials.');
      setRequestPayload('{\n  "key": "value"\n}');
      setExpectedResponse('HTTP 200 OK with expected JSON body structure.');
      setAssertions(['HTTP status code is 200', 'Response time is under 1000ms']);
      setSource('Manual');
    }
    setReqInput('');
    setValidationError(null);
  }, [initialData, isOpen, endpoints, availableRequirements]);

  const handleAddRequirement = (req: string) => {
    const trimmed = req.trim();
    if (!trimmed) return;
    if (!linkedRequirements.includes(trimmed)) {
      setLinkedRequirements([...linkedRequirements, trimmed]);
    }
    setReqInput('');
  };

  const handleRemoveRequirement = (reqToRemove: string) => {
    setLinkedRequirements(linkedRequirements.filter((r) => r !== reqToRemove));
  };

  const handleAddAssertion = () => {
    setAssertions([...assertions, '']);
  };

  const handleUpdateAssertion = (index: number, value: string) => {
    const updated = [...assertions];
    updated[index] = value;
    setAssertions(updated);
  };

  const handleRemoveAssertion = (index: number) => {
    if (assertions.length === 1) {
      setAssertions(['']);
      return;
    }
    setAssertions(assertions.filter((_, i) => i !== index));
  };

  const handleFormatJson = () => {
    try {
      const parsed = JSON.parse(requestPayload);
      setRequestPayload(JSON.stringify(parsed, null, 2));
      setValidationError(null);
    } catch {
      setValidationError('Request payload contains invalid JSON syntax.');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      setValidationError('Test Case Title is required.');
      return;
    }
    if (!linkedEndpoint.trim()) {
      setValidationError('Linked Endpoint is required.');
      return;
    }

    const filteredAssertions = assertions.map((a) => a.trim()).filter(Boolean);
    if (filteredAssertions.length === 0) {
      setValidationError('At least one assertion is required.');
      return;
    }

    setValidationError(null);
    setIsSubmitting(true);

    try {
      const now = new Date().toISOString();
      const testCaseToSave: TestCase = {
        id: initialData?.id || `TC-${Date.now().toString().slice(-4)}`,
        title: title.trim(),
        type,
        priority,
        linkedEndpoint: linkedEndpoint.trim(),
        linkedRequirements: linkedRequirements.length > 0 ? linkedRequirements : ['REQ-GEN-01'],
        preconditions: preconditions.trim(),
        requestPayload: requestPayload.trim(),
        expectedResponse: expectedResponse.trim() || 'HTTP 200 OK',
        assertions: filteredAssertions,
        source: isEditing ? source : 'Manual',
        createdAt: initialData?.createdAt || now,
        updatedAt: now,
      };

      await onSave(testCaseToSave);
      onClose();
    } catch (err: any) {
      setValidationError(err.message || 'Failed to save test case.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={isEditing ? `Edit Test Case: ${initialData?.id || ''}` : `Add Manual Test Case (${apiName})`}
      description={
        isEditing
          ? 'Modify test case parameters. All changes will be saved directly to OneDrive.'
          : 'Create a new test scenario with manual source tagging. Will be saved directly into the project OneDrive test suite.'
      }
      maxWidth="lg"
      footer={
        <div className="flex items-center justify-between w-full">
          <div className="flex items-center gap-1.5 text-xs text-stone-600">
            {source === 'AI-generated' ? (
              <span className="flex items-center gap-1 text-indigo-700 bg-indigo-50 border border-indigo-200 px-2 py-0.5 rounded font-medium">
                <Sparkles className="w-3 h-3 text-indigo-600" />
                Source: AI-generated
              </span>
            ) : (
              <span className="flex items-center gap-1 text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded font-medium">
                <User className="w-3 h-3 text-emerald-600" />
                Source: Manual
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={onClose} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={handleSubmit}
              isLoading={isSubmitting}
              leftIcon={<Check className="w-4 h-4" />}
            >
              {isEditing ? 'Save Changes to OneDrive' : 'Add Test Case to OneDrive'}
            </Button>
          </div>
        </div>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4 text-xs">
        {validationError && (
          <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 flex items-start gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <div className="font-medium">{validationError}</div>
          </div>
        )}

        {/* Title */}
        <div>
          <label className="block text-xs font-semibold text-stone-700 mb-1">
            Test Case Title <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            required
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. [Positive] Valid user credentials return 200 and access token"
            className="w-full px-3 py-2 text-xs rounded-md border border-stone-300 focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 bg-white"
          />
        </div>

        {/* Row: Type, Priority, Linked Endpoint */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <label className="block text-xs font-semibold text-stone-700 mb-1">
              Type <span className="text-red-500">*</span>
            </label>
            <select
              value={type}
              onChange={(e) => setType(e.target.value as TestCaseType)}
              className="w-full px-2.5 py-1.5 text-xs rounded-md border border-stone-300 focus:outline-none focus:ring-1 focus:ring-indigo-500 bg-white"
            >
              <option value="Positive">Positive (Happy Path)</option>
              <option value="Negative">Negative (Errors / Auth)</option>
              <option value="Edge">Edge (Large / Special chars)</option>
              <option value="Boundary">Boundary (Ranges / Limits)</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-stone-700 mb-1">
              Priority <span className="text-red-500">*</span>
            </label>
            <select
              value={priority}
              onChange={(e) => setPriority(e.target.value as TestCasePriority)}
              className="w-full px-2.5 py-1.5 text-xs rounded-md border border-stone-300 focus:outline-none focus:ring-1 focus:ring-indigo-500 bg-white"
            >
              <option value="High">High</option>
              <option value="Medium">Medium</option>
              <option value="Low">Low</option>
            </select>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs font-semibold text-stone-700">
                Linked Endpoint <span className="text-red-500">*</span>
              </label>
              {endpoints.length > 0 && (
                <button
                  type="button"
                  onClick={() => setCustomEndpoint(!customEndpoint)}
                  className="text-[10px] text-indigo-600 hover:text-indigo-800 underline"
                >
                  {customEndpoint ? 'Select from API' : 'Custom'}
                </button>
              )}
            </div>

            {customEndpoint || endpoints.length === 0 ? (
              <input
                type="text"
                value={linkedEndpoint}
                onChange={(e) => setLinkedEndpoint(e.target.value)}
                placeholder="e.g. POST /api/v1/auth/login"
                className="w-full px-2.5 py-1.5 text-xs font-mono rounded-md border border-stone-300 focus:outline-none focus:ring-1 focus:ring-indigo-500 bg-white"
              />
            ) : (
              <select
                value={linkedEndpoint}
                onChange={(e) => setLinkedEndpoint(e.target.value)}
                className="w-full px-2.5 py-1.5 text-xs font-mono rounded-md border border-stone-300 focus:outline-none focus:ring-1 focus:ring-indigo-500 bg-white"
              >
                {endpoints.map((ep, i) => {
                  const val = `${ep.method.toUpperCase()} ${ep.path}`;
                  return (
                    <option key={i} value={val}>
                      {val} {ep.summary ? `(${ep.summary.slice(0, 24)})` : ''}
                    </option>
                  );
                })}
              </select>
            )}
          </div>
        </div>

        {/* Linked Requirements */}
        <div>
          <label className="block text-xs font-semibold text-stone-700 mb-1">
            Linked Requirement ID(s)
          </label>
          <div className="flex flex-wrap gap-1.5 mb-1.5">
            {linkedRequirements.map((req) => (
              <span
                key={req}
                className="inline-flex items-center gap-1 px-2 py-0.5 bg-indigo-50 border border-indigo-200 text-indigo-700 rounded text-xs font-mono font-medium"
              >
                {req}
                <button
                  type="button"
                  onClick={() => handleRemoveRequirement(req)}
                  className="hover:text-red-600"
                >
                  &times;
                </button>
              </span>
            ))}
          </div>

          <div className="flex items-center gap-2">
            <input
              type="text"
              value={reqInput}
              onChange={(e) => setReqInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleAddRequirement(reqInput);
                }
              }}
              placeholder="e.g. REQ-AUTH-01 (press Enter to add)"
              className="flex-1 px-2.5 py-1.5 text-xs font-mono rounded-md border border-stone-300 focus:outline-none focus:ring-1 focus:ring-indigo-500 bg-white"
            />
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => handleAddRequirement(reqInput)}
            >
              Add
            </Button>
            {availableRequirements.length > 0 && (
              <div className="flex items-center gap-1 overflow-x-auto max-w-[200px] text-[10px] text-stone-500">
                <span className="text-stone-400">Suggest:</span>
                {availableRequirements.slice(0, 3).map((r) => (
                  <button
                    key={r}
                    type="button"
                    onClick={() => handleAddRequirement(r)}
                    className="underline text-indigo-600 hover:text-indigo-800"
                  >
                    {r}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Preconditions */}
        <div>
          <label className="block text-xs font-semibold text-stone-700 mb-1">
            Preconditions
          </label>
          <textarea
            rows={2}
            value={preconditions}
            onChange={(e) => setPreconditions(e.target.value)}
            placeholder="e.g. Valid auth token present in headers. User account active with verified email."
            className="w-full px-2.5 py-1.5 text-xs rounded-md border border-stone-300 focus:outline-none focus:ring-1 focus:ring-indigo-500 bg-white"
          />
        </div>

        {/* Request Payload */}
        <div>
          <div className="flex items-center justify-between mb-1">
            <label className="text-xs font-semibold text-stone-700">
              Request Payload (JSON or params)
            </label>
            <button
              type="button"
              onClick={handleFormatJson}
              className="text-[10px] text-indigo-600 hover:text-indigo-800 flex items-center gap-1"
            >
              <Code className="w-3 h-3" />
              Format JSON
            </button>
          </div>
          <textarea
            rows={3}
            value={requestPayload}
            onChange={(e) => setRequestPayload(e.target.value)}
            placeholder='{\n  "field": "value"\n}'
            className="w-full px-2.5 py-1.5 text-xs font-mono rounded-md border border-stone-300 focus:outline-none focus:ring-1 focus:ring-indigo-500 bg-stone-50"
          />
        </div>

        {/* Expected Response */}
        <div>
          <label className="block text-xs font-semibold text-stone-700 mb-1">
            Expected Response
          </label>
          <textarea
            rows={2}
            value={expectedResponse}
            onChange={(e) => setExpectedResponse(e.target.value)}
            placeholder="e.g. HTTP 200 OK with payload containing session token and expires_in > 0"
            className="w-full px-2.5 py-1.5 text-xs rounded-md border border-stone-300 focus:outline-none focus:ring-1 focus:ring-indigo-500 bg-white"
          />
        </div>

        {/* Assertions */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="text-xs font-semibold text-stone-700">
              Assertions <span className="text-red-500">*</span>
            </label>
            <button
              type="button"
              onClick={handleAddAssertion}
              className="text-[11px] font-medium text-indigo-600 hover:text-indigo-800 flex items-center gap-1"
            >
              <Plus className="w-3 h-3" />
              Add Assertion
            </button>
          </div>

          <div className="space-y-1.5">
            {assertions.map((assertion, idx) => (
              <div key={idx} className="flex items-center gap-2">
                <span className="text-stone-400 font-mono text-[10px] w-4 shrink-0 text-right">
                  {idx + 1}.
                </span>
                <input
                  type="text"
                  value={assertion}
                  onChange={(e) => handleUpdateAssertion(idx, e.target.value)}
                  placeholder="e.g. response.status === 200 or response.body.token is not null"
                  className="flex-1 px-2.5 py-1.5 text-xs rounded-md border border-stone-300 focus:outline-none focus:ring-1 focus:ring-indigo-500 bg-white"
                />
                <button
                  type="button"
                  onClick={() => handleRemoveAssertion(idx)}
                  className="p-1.5 text-stone-400 hover:text-red-600 hover:bg-stone-100 rounded"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        </div>
      </form>
    </Modal>
  );
}
