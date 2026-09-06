import { useState, useEffect, useMemo, useCallback } from 'react';
import type {
  NavigationView,
  ApiReference,
  TestCase,
  TestCasePriority,
  TestCaseType,
  TestCaseSource,
  ApiSpec,
} from '../../types';
import { useProjects } from '../../context/ProjectContext';
import { useOneDrive } from '../../context/OneDriveContext';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../ui/Toast';
import { fetchProjectApiReferences, fetchApiSpec } from '../../lib/apiStorage';
import { Button } from '../ui/Button';
import { TestCaseFormModal } from '../testcases/TestCaseFormModal';
import { DeleteTestCaseModal } from '../testcases/DeleteTestCaseModal';
import { TestCaseDetailModal } from '../testcases/TestCaseDetailModal';
import { Modal } from '../ui/Modal';
import {
  Sparkles,
  Plus,
  Search,
  CheckCircle2,
  AlertCircle,
  Clock,
  Download,
  Trash2,
  Edit3,
  Eye,
  RefreshCw,
  FolderOpen,
  ArrowRight,
  ExternalLink,
  Loader2,
  FileCode,
  ShieldCheck,
  Check,
} from 'lucide-react';

interface TestCasesViewProps {
  onNavigate: (view: NavigationView, payload?: string) => void;
  initialSelectedApiId?: string | null;
}

export function TestCasesView({ onNavigate, initialSelectedApiId }: TestCasesViewProps) {
  const { activeProject } = useProjects();
  const { isConnected, isDemo } = useOneDrive();
  const { user } = useAuth();
  const { showToast } = useToast();

  // API list state
  const [apis, setApis] = useState<ApiReference[]>([]);
  const [loadingApis, setLoadingApis] = useState(true);
  const [selectedApiId, setSelectedApiId] = useState<string | null>(initialSelectedApiId || null);
  const [selectedApiSpec, setSelectedApiSpec] = useState<ApiSpec | null>(null);

  // Requirements status state
  const [hasRequirements, setHasRequirements] = useState<boolean | null>(null);
  const [requirementsContent, setRequirementsContent] = useState<string | null>(null);
  const [reqFileName, setReqFileName] = useState<string | null>(null);
  const [checkingReqs, setCheckingReqs] = useState<boolean>(false);

  // Test cases data state
  const [testCases, setTestCases] = useState<TestCase[]>([]);
  const [loadingTestCases, setLoadingTestCases] = useState<boolean>(false);
  const [fileMeta, setFileMeta] = useState<{
    fileName?: string;
    webUrl?: string;
    lastModified?: string;
    fileId?: string;
    provider?: string;
    model?: string;
  }>({});

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<string>('ALL');
  const [filterPriority, setFilterPriority] = useState<string>('ALL');
  const [filterSource, setFilterSource] = useState<string>('ALL');

  // Saving state for inline edits
  const [isSavingInline, setIsSavingInline] = useState(false);
  const [lastSavedTime, setLastSavedTime] = useState<string | null>(null);

  // Modals
  const [isFormModalOpen, setIsFormModalOpen] = useState(false);
  const [editingCase, setEditingCase] = useState<TestCase | null>(null);
  const [detailCase, setDetailCase] = useState<TestCase | null>(null);
  const [deletingCase, setDeletingCase] = useState<TestCase | null>(null);
  const [isRegenConfirmOpen, setIsRegenConfirmOpen] = useState(false);

  // AI Generation state
  const [isGenerating, setIsGenerating] = useState(false);

  // Active inline cell editing
  const [editingCell, setEditingCell] = useState<{ id: string; field: 'title' | 'endpoint' } | null>(null);
  const [inlineInputValue, setInlineInputValue] = useState('');

  const selectedApi = useMemo(
    () => apis.find((a) => a.id === selectedApiId) || null,
    [apis, selectedApiId]
  );

  // 1. Load project APIs
  const loadApis = useCallback(async () => {
    if (!activeProject) return;
    setLoadingApis(true);
    try {
      const refs = await fetchProjectApiReferences(activeProject.id, activeProject.name);
      setApis(refs);
      if (refs.length > 0) {
        if (initialSelectedApiId && refs.some((r) => r.id === initialSelectedApiId)) {
          setSelectedApiId(initialSelectedApiId);
        } else if (!selectedApiId || !refs.some((r) => r.id === selectedApiId)) {
          setSelectedApiId(refs[0].id);
        }
      }
    } catch (err) {
      console.error('Failed to load API references:', err);
    } finally {
      setLoadingApis(false);
    }
  }, [activeProject, initialSelectedApiId, selectedApiId]);

  useEffect(() => {
    loadApis();
  }, [loadApis]);

  // 2. Load API Spec for selected API (to get endpoints list for form dropdowns)
  useEffect(() => {
    if (!activeProject || !selectedApiId) {
      setSelectedApiSpec(null);
      return;
    }

    const loadSpec = async () => {
      try {
        const spec = await fetchApiSpec(activeProject.id, selectedApiId);
        setSelectedApiSpec(spec);
      } catch (err) {
        console.warn('Could not load detailed API spec:', err);
        setSelectedApiSpec(null);
      }
    };
    loadSpec();
  }, [activeProject, selectedApiId]);

  // 3. Check if Requirements exist in OneDrive for selected API
  const checkRequirements = useCallback(async () => {
    if (!selectedApi || !activeProject || !user) {
      setHasRequirements(null);
      setRequirementsContent(null);
      return;
    }

    setCheckingReqs(true);
    try {
      const reqsFolderId = activeProject.oneDriveFolder?.subfolders?.requirements?.id;
      const res = await fetch(
        `/api/requirements/check?userId=${encodeURIComponent(user.id)}&projectId=${encodeURIComponent(
          activeProject.id
        )}&apiName=${encodeURIComponent(selectedApi.name)}&reqsFolderId=${encodeURIComponent(
          reqsFolderId || ''
        )}`
      );

      if (res.ok) {
        const data = await res.json();
        setHasRequirements(Boolean(data.exists));
        setRequirementsContent(data.content || null);
        setReqFileName(data.fileName || null);
      } else {
        setHasRequirements(false);
        setRequirementsContent(null);
      }
    } catch (err) {
      console.error('Failed to check requirements:', err);
      setHasRequirements(false);
    } finally {
      setCheckingReqs(false);
    }
  }, [selectedApi, activeProject, user]);

  useEffect(() => {
    checkRequirements();
  }, [checkRequirements]);

  // 4. Load Test Cases from OneDrive for selected API
  const loadTestCases = useCallback(async () => {
    if (!selectedApi || !activeProject || !user) {
      setTestCases([]);
      return;
    }

    setLoadingTestCases(true);
    try {
      const testcasesFolderId = activeProject.oneDriveFolder?.subfolders?.testcases?.id;
      const res = await fetch(
        `/api/testcases/check?userId=${encodeURIComponent(user.id)}&projectId=${encodeURIComponent(
          activeProject.id
        )}&apiName=${encodeURIComponent(selectedApi.name)}&testcasesFolderId=${encodeURIComponent(
          testcasesFolderId || ''
        )}`
      );

      if (res.ok) {
        const data = await res.json();
        if (data.exists && Array.isArray(data.testCases)) {
          setTestCases(data.testCases);
          setFileMeta({
            fileName: data.fileName,
            webUrl: data.webUrl,
            fileId: data.fileId,
          });
        } else {
          setTestCases([]);
          setFileMeta({});
        }
      } else {
        setTestCases([]);
        setFileMeta({});
      }
    } catch (err) {
      console.error('Failed to load test cases:', err);
      setTestCases([]);
    } finally {
      setLoadingTestCases(false);
    }
  }, [selectedApi, activeProject, user]);

  useEffect(() => {
    loadTestCases();
  }, [loadTestCases]);

  // Save current test cases to OneDrive via Microsoft Graph
  const saveTestCasesToOneDrive = async (casesToSave: TestCase[]): Promise<boolean> => {
    if (!selectedApi || !activeProject || !user) return false;
    setIsSavingInline(true);
    try {
      const testcasesFolderId = activeProject.oneDriveFolder?.subfolders?.testcases?.id;
      const res = await fetch('/api/testcases/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user.id,
          projectId: activeProject.id,
          apiId: selectedApi.id,
          apiName: selectedApi.name,
          fileName: fileMeta.fileName || `${selectedApi.name.replace(/[/\\?%*:|"<>]/g, '_').trim()}-testcases.json`,
          testCases: casesToSave,
          testcasesFolderId,
        }),
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.message || 'Failed to save test cases to OneDrive');
      }

      const data = await res.json();
      setFileMeta((prev) => ({
        ...prev,
        fileName: data.file?.name || prev.fileName,
        webUrl: data.file?.webUrl || prev.webUrl,
        fileId: data.file?.id || prev.fileId,
        lastModified: data.file?.lastModifiedDateTime,
      }));
      setLastSavedTime(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
      return true;
    } catch (err: any) {
      console.error('Failed saving to OneDrive:', err);
      showToast({
        type: 'error',
        title: 'OneDrive Save Failed',
        description: err.message || 'Could not persist changes to Microsoft Graph.',
      });
      return false;
    } finally {
      setIsSavingInline(false);
    }
  };

  // Trigger AI Test Cases Generation
  const handleGenerateTestCases = async () => {
    if (!selectedApi || !activeProject || !user) return;

    if (!hasRequirements) {
      showToast({
        type: 'error',
        title: 'Requirements Required',
        description: 'Please generate or write requirements specification first before creating test cases.',
      });
      return;
    }

    if (testCases.length > 0) {
      setIsRegenConfirmOpen(true);
      return;
    }

    await executeAiGeneration();
  };

  const executeAiGeneration = async () => {
    if (!selectedApi || !activeProject || !user) return;
    setIsGenerating(true);
    setIsRegenConfirmOpen(false);

    try {
      const apisFolderId = activeProject.oneDriveFolder?.subfolders?.apis?.id;
      const reqsFolderId = activeProject.oneDriveFolder?.subfolders?.requirements?.id;
      const testcasesFolderId = activeProject.oneDriveFolder?.subfolders?.testcases?.id;

      const res = await fetch('/api/testcases/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user.id,
          projectId: activeProject.id,
          apiId: selectedApi.id,
          apiName: selectedApi.name,
          apiSpec: selectedApiSpec,
          requirementsContent: requirementsContent || undefined,
          apisFolderId,
          reqsFolderId,
          testcasesFolderId,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || 'Failed to generate test cases with AI.');
      }

      const data = await res.json();
      setTestCases(data.testCases || []);
      setFileMeta({
        fileName: data.fileName,
        webUrl: data.webUrl,
        fileId: data.fileId,
        provider: data.provider,
        model: data.model,
        lastModified: new Date().toISOString(),
      });
      setLastSavedTime(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }));

      showToast({
        type: 'success',
        title: 'Test Cases Generated & Saved',
        description: `Successfully synthesized ${data.testCases?.length || 0} structured test cases and saved to OneDrive testcases/${data.fileName}.`,
      });
    } catch (err: any) {
      console.error('Generation error:', err);
      showToast({
        type: 'error',
        title: 'Generation Failed',
        description: err.message || 'Failed to generate test suite.',
      });
    } finally {
      setIsGenerating(false);
    }
  };

  // Inline edit handlers
  const handleUpdateTestCaseField = async <K extends keyof TestCase>(
    testCaseId: string,
    field: K,
    value: TestCase[K]
  ) => {
    const updated = testCases.map((tc) => {
      if (tc.id === testCaseId) {
        return {
          ...tc,
          [field]: value,
          updatedAt: new Date().toISOString(),
        };
      }
      return tc;
    });

    setTestCases(updated);
    await saveTestCasesToOneDrive(updated);
  };

  // Submit modal create / edit
  const handleSaveTestCaseFromModal = async (savedCase: TestCase) => {
    let updated: TestCase[];
    const exists = testCases.some((tc) => tc.id === savedCase.id);

    if (exists) {
      updated = testCases.map((tc) => (tc.id === savedCase.id ? savedCase : tc));
      showToast({
        type: 'success',
        title: 'Test Case Updated',
        description: `Changes to ${savedCase.id} saved to OneDrive.`,
      });
    } else {
      updated = [savedCase, ...testCases];
      showToast({
        type: 'success',
        title: 'Manual Test Case Added',
        description: `Test case ${savedCase.id} added and synced with OneDrive.`,
      });
    }

    setTestCases(updated);
    await saveTestCasesToOneDrive(updated);
  };

  // Confirm delete test case
  const handleDeleteTestCaseConfirm = async () => {
    if (!deletingCase) return;
    const updated = testCases.filter((tc) => tc.id !== deletingCase.id);
    setTestCases(updated);
    const success = await saveTestCasesToOneDrive(updated);
    if (success) {
      showToast({
        type: 'info',
        title: 'Test Case Deleted',
        description: `Removed ${deletingCase.id} from OneDrive test suite.`,
      });
    }
    setDeletingCase(null);
  };

  // Export JSON
  const handleExportJson = () => {
    if (testCases.length === 0) return;
    const jsonStr = JSON.stringify(
      {
        apiId: selectedApi?.id,
        apiName: selectedApi?.name,
        exportedAt: new Date().toISOString(),
        count: testCases.length,
        testCases,
      },
      null,
      2
    );

    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileMeta.fileName || `${selectedApi?.name || 'api'}-testcases.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Filtered test cases
  const filteredTestCases = useMemo(() => {
    return testCases.filter((tc) => {
      // Type filter
      if (filterType !== 'ALL' && tc.type !== filterType) return false;
      // Priority filter
      if (filterPriority !== 'ALL' && tc.priority !== filterPriority) return false;
      // Source filter
      if (filterSource !== 'ALL' && tc.source !== filterSource) return false;
      // Search query
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        const matchTitle = tc.title.toLowerCase().includes(query);
        const matchEndpoint = tc.linkedEndpoint.toLowerCase().includes(query);
        const matchReqs = (tc.linkedRequirements || []).some((r) => r.toLowerCase().includes(query));
        const matchPre = (tc.preconditions || '').toLowerCase().includes(query);
        const matchId = tc.id.toLowerCase().includes(query);
        if (!matchTitle && !matchEndpoint && !matchReqs && !matchPre && !matchId) return false;
      }
      return true;
    });
  }, [testCases, filterType, filterPriority, filterSource, searchQuery]);

  // Derived metrics
  const metrics = useMemo(() => {
    return {
      total: testCases.length,
      positive: testCases.filter((t) => t.type === 'Positive').length,
      negative: testCases.filter((t) => t.type === 'Negative').length,
      edge: testCases.filter((t) => t.type === 'Edge').length,
      boundary: testCases.filter((t) => t.type === 'Boundary').length,
      high: testCases.filter((t) => t.priority === 'High').length,
      medium: testCases.filter((t) => t.priority === 'Medium').length,
      low: testCases.filter((t) => t.priority === 'Low').length,
      manual: testCases.filter((t) => t.source === 'Manual').length,
      ai: testCases.filter((t) => t.source === 'AI-generated').length,
    };
  }, [testCases]);

  // Badge stylings
  const getTypeBadgeClass = (type: TestCaseType) => {
    switch (type) {
      case 'Positive':
        return 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100';
      case 'Negative':
        return 'bg-rose-50 text-rose-700 border-rose-200 hover:bg-rose-100';
      case 'Edge':
        return 'bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100';
      case 'Boundary':
        return 'bg-purple-50 text-purple-700 border-purple-200 hover:bg-purple-100';
    }
  };

  const getPriorityBadgeClass = (priority: TestCasePriority) => {
    switch (priority) {
      case 'High':
        return 'bg-red-50 text-red-700 border-red-200 hover:bg-red-100';
      case 'Medium':
        return 'bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100';
      case 'Low':
        return 'bg-sky-50 text-sky-700 border-sky-200 hover:bg-sky-100';
    }
  };

  return (
    <div className="flex flex-col h-full bg-[#FAFAFA]">
      {/* 1. Header Toolbar */}
      <div className="bg-white border-b border-stone-200 px-6 py-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-semibold text-stone-900">Test Cases</h1>
              {activeProject && (
                <span className="text-xs bg-stone-100 text-stone-600 px-2.5 py-0.5 rounded-full font-medium border border-stone-200">
                  {activeProject.name}
                </span>
              )}
              {isConnected && !isDemo && (
                <span className="text-[11px] bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-0.5 rounded-full font-medium flex items-center gap-1">
                  <ShieldCheck className="w-3 h-3 text-emerald-600" />
                  OneDrive Synced
                </span>
              )}
            </div>
            <p className="text-xs text-stone-500 mt-0.5">
              Structured API test suites generated from requirements and saved directly to OneDrive.
            </p>
          </div>

          {/* Right Actions & API Selector */}
          <div className="flex items-center gap-2.5 flex-wrap">
            {/* API Dropdown */}
            <div className="flex items-center gap-1.5 bg-stone-50 border border-stone-300 rounded-md px-2.5 py-1.5 text-xs">
              <span className="text-stone-500 font-medium">API:</span>
              <select
                value={selectedApiId || ''}
                onChange={(e) => setSelectedApiId(e.target.value)}
                disabled={loadingApis || apis.length === 0}
                className="bg-transparent font-semibold text-stone-900 focus:outline-none cursor-pointer"
              >
                {loadingApis ? (
                  <option>Loading APIs...</option>
                ) : apis.length === 0 ? (
                  <option>No APIs in project</option>
                ) : (
                  apis.map((api) => (
                    <option key={api.id} value={api.id}>
                      {api.name} ({api.endpointCount} endpoints)
                    </option>
                  ))
                )}
              </select>
            </div>

            {/* Sync / Saved Indicator */}
            {isSavingInline ? (
              <span className="text-[11px] text-indigo-600 bg-indigo-50 border border-indigo-100 px-2 py-1 rounded flex items-center gap-1">
                <Loader2 className="w-3 h-3 animate-spin" />
                Saving to OneDrive...
              </span>
            ) : lastSavedTime ? (
              <span className="text-[11px] text-stone-500 flex items-center gap-1 font-mono">
                <Check className="w-3 h-3 text-emerald-600" />
                Saved {lastSavedTime}
              </span>
            ) : null}

            {/* Add Manual Test Case */}
            <Button
              variant="outline"
              size="sm"
              leftIcon={<Plus className="w-3.5 h-3.5" />}
              onClick={() => {
                setEditingCase(null);
                setIsFormModalOpen(true);
              }}
              disabled={!selectedApi}
            >
              Add Manual Case
            </Button>

            {/* Generate with AI Button */}
            <Button
              variant="primary"
              size="sm"
              leftIcon={<Sparkles className="w-3.5 h-3.5" />}
              onClick={handleGenerateTestCases}
              isLoading={isGenerating}
              disabled={!selectedApi || checkingReqs}
            >
              {testCases.length > 0 ? 'Regenerate Suite' : 'Generate Test Cases'}
            </Button>

            {/* Export JSON */}
            {testCases.length > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleExportJson}
                title="Download JSON test suite"
                leftIcon={<Download className="w-3.5 h-3.5" />}
              >
                Export
              </Button>
            )}
          </div>
        </div>

        {/* Requirements Status Alert Banner */}
        {selectedApi && !checkingReqs && hasRequirements === false && (
          <div className="mt-3 p-3 bg-amber-50 border border-amber-200 rounded-lg flex items-center justify-between text-xs text-amber-900">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
              <div>
                <span className="font-semibold">Requirements specification missing for {selectedApi.name}.</span>{' '}
                Test case generation requires requirements to ensure full scenario coverage.
              </div>
            </div>
            <Button
              variant="primary"
              size="sm"
              onClick={() => onNavigate('requirements', selectedApi.id)}
              rightIcon={<ArrowRight className="w-3.5 h-3.5" />}
            >
              Generate Requirements First
            </Button>
          </div>
        )}

        {selectedApi && !checkingReqs && hasRequirements === true && (
          <div className="mt-3 px-3 py-1.5 bg-emerald-50 border border-emerald-200 rounded-md flex items-center justify-between text-xs text-emerald-800">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
              <span>
                Requirements verified in OneDrive: <span className="font-mono font-medium">{reqFileName}</span>
              </span>
            </div>
            <button
              onClick={() => onNavigate('requirements', selectedApi.id)}
              className="text-[11px] font-semibold text-emerald-700 hover:text-emerald-900 underline flex items-center gap-1"
            >
              View Requirements Doc
              <ExternalLink className="w-3 h-3" />
            </button>
          </div>
        )}

        {/* Metrics Bar */}
        {testCases.length > 0 && (
          <div className="mt-3 pt-3 border-t border-stone-100 flex items-center gap-2 flex-wrap text-xs">
            <span className="text-stone-500 font-medium mr-1">Suite Breakdown:</span>
            <span className="px-2 py-0.5 rounded bg-stone-100 text-stone-800 font-mono font-medium border border-stone-200">
              Total: {metrics.total}
            </span>
            <span className="px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 font-mono font-medium border border-emerald-200">
              Positive: {metrics.positive}
            </span>
            <span className="px-2 py-0.5 rounded bg-rose-50 text-rose-700 font-mono font-medium border border-rose-200">
              Negative: {metrics.negative}
            </span>
            <span className="px-2 py-0.5 rounded bg-amber-50 text-amber-700 font-mono font-medium border border-amber-200">
              Edge: {metrics.edge}
            </span>
            <span className="px-2 py-0.5 rounded bg-purple-50 text-purple-700 font-mono font-medium border border-purple-200">
              Boundary: {metrics.boundary}
            </span>
            <span className="text-stone-300 mx-1">|</span>
            <span className="px-2 py-0.5 rounded bg-red-50 text-red-700 font-mono font-medium border border-red-200">
              High: {metrics.high}
            </span>
            <span className="px-2 py-0.5 rounded bg-amber-50 text-amber-700 font-mono font-medium border border-amber-200">
              Med: {metrics.medium}
            </span>
            <span className="px-2 py-0.5 rounded bg-sky-50 text-sky-700 font-mono font-medium border border-sky-200">
              Low: {metrics.low}
            </span>
            <span className="text-stone-300 mx-1">|</span>
            <span className="text-stone-500">
              AI: <b>{metrics.ai}</b> • Manual: <b>{metrics.manual}</b>
            </span>

            {fileMeta.webUrl && (
              <a
                href={fileMeta.webUrl}
                target="_blank"
                rel="noreferrer"
                className="ml-auto text-indigo-600 hover:text-indigo-800 text-[11px] font-medium flex items-center gap-1"
              >
                Open in OneDrive
                <ExternalLink className="w-3 h-3" />
              </a>
            )}
          </div>
        )}
      </div>

      {/* 2. Filter Toolbar */}
      <div className="bg-white border-b border-stone-200 px-6 py-2.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-2 flex-1 max-w-md">
          <div className="relative w-full">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-stone-400" />
            <input
              type="text"
              placeholder="Filter by title, endpoint, requirement id, or precondition..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 text-xs rounded-md border border-stone-200 bg-stone-50 focus:bg-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Type Filter */}
          <div className="flex items-center gap-1">
            <span className="text-stone-500">Type:</span>
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              className="bg-stone-50 border border-stone-200 rounded px-2 py-1 text-xs focus:outline-none"
            >
              <option value="ALL">All Types</option>
              <option value="Positive">Positive</option>
              <option value="Negative">Negative</option>
              <option value="Edge">Edge</option>
              <option value="Boundary">Boundary</option>
            </select>
          </div>

          {/* Priority Filter */}
          <div className="flex items-center gap-1">
            <span className="text-stone-500">Priority:</span>
            <select
              value={filterPriority}
              onChange={(e) => setFilterPriority(e.target.value)}
              className="bg-stone-50 border border-stone-200 rounded px-2 py-1 text-xs focus:outline-none"
            >
              <option value="ALL">All Priorities</option>
              <option value="High">High</option>
              <option value="Medium">Medium</option>
              <option value="Low">Low</option>
            </select>
          </div>

          {/* Source Filter */}
          <div className="flex items-center gap-1">
            <span className="text-stone-500">Source:</span>
            <select
              value={filterSource}
              onChange={(e) => setFilterSource(e.target.value)}
              className="bg-stone-50 border border-stone-200 rounded px-2 py-1 text-xs focus:outline-none"
            >
              <option value="ALL">All Sources</option>
              <option value="AI-generated">AI-generated</option>
              <option value="Manual">Manual</option>
            </select>
          </div>

          {(filterType !== 'ALL' || filterPriority !== 'ALL' || filterSource !== 'ALL' || searchQuery) && (
            <button
              onClick={() => {
                setFilterType('ALL');
                setFilterPriority('ALL');
                setFilterSource('ALL');
                setSearchQuery('');
              }}
              className="text-indigo-600 hover:text-indigo-800 underline text-[11px]"
            >
              Reset filters
            </button>
          )}
        </div>
      </div>

      {/* 3. Main Data Table Area */}
      <div className="flex-1 overflow-auto p-6">
        {loadingTestCases || checkingReqs ? (
          <div className="flex flex-col items-center justify-center h-64 gap-2 text-stone-500 text-xs">
            <Loader2 className="w-6 h-6 animate-spin text-indigo-600" />
            <span>Loading test cases from Microsoft OneDrive...</span>
          </div>
        ) : !selectedApi ? (
          <div className="bg-white border border-stone-200 rounded-xl p-12 text-center max-w-md mx-auto mt-8">
            <FolderOpen className="w-10 h-10 text-stone-400 mx-auto mb-3" />
            <h3 className="text-base font-semibold text-stone-900 mb-1">No API Selected</h3>
            <p className="text-xs text-stone-500 mb-4">
              Select or import an API in your project to view and generate its test cases suite.
            </p>
            <Button variant="primary" size="sm" onClick={() => onNavigate('apis')}>
              Go to APIs Catalog
            </Button>
          </div>
        ) : testCases.length === 0 ? (
          <div className="bg-white border border-stone-200 rounded-xl p-12 text-center max-w-lg mx-auto mt-8 space-y-4">
            <div className="w-12 h-12 bg-indigo-50 text-indigo-600 rounded-full flex items-center justify-center mx-auto">
              <FileCode className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-stone-900">No Test Cases Found for {selectedApi.name}</h3>
              <p className="text-xs text-stone-500 mt-1 max-w-sm mx-auto">
                {hasRequirements
                  ? 'Requirements are ready. You can now generate a complete structured test suite using AI, or manually add custom test scenarios.'
                  : 'To generate comprehensive test cases with AI, please create or generate the API requirements specification first.'}
              </p>
            </div>

            <div className="flex items-center justify-center gap-3 pt-2">
              {hasRequirements ? (
                <Button
                  variant="primary"
                  size="md"
                  onClick={handleGenerateTestCases}
                  isLoading={isGenerating}
                  leftIcon={<Sparkles className="w-4 h-4" />}
                >
                  Generate Test Cases with AI
                </Button>
              ) : (
                <Button
                  variant="primary"
                  size="md"
                  onClick={() => onNavigate('requirements', selectedApi.id)}
                  leftIcon={<ArrowRight className="w-4 h-4" />}
                >
                  Generate Requirements First
                </Button>
              )}
              <Button
                variant="outline"
                size="md"
                onClick={() => {
                  setEditingCase(null);
                  setIsFormModalOpen(true);
                }}
                leftIcon={<Plus className="w-4 h-4" />}
              >
                Add Manual Case
              </Button>
            </div>
          </div>
        ) : filteredTestCases.length === 0 ? (
          <div className="bg-white border border-stone-200 rounded-xl p-8 text-center max-w-md mx-auto mt-8">
            <p className="text-xs text-stone-500">No test cases match your search and filter criteria.</p>
            <button
              onClick={() => {
                setFilterType('ALL');
                setFilterPriority('ALL');
                setFilterSource('ALL');
                setSearchQuery('');
              }}
              className="mt-2 text-xs text-indigo-600 font-medium underline"
            >
              Clear filters
            </button>
          </div>
        ) : (
          <div className="bg-white border border-stone-200 rounded-lg shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-stone-50/80 border-b border-stone-200 text-stone-600 font-semibold uppercase tracking-wider text-[10px]">
                    <th className="py-2.5 px-3 w-16">ID</th>
                    <th className="py-2.5 px-3 min-w-[280px]">Title</th>
                    <th className="py-2.5 px-3 w-28">Type</th>
                    <th className="py-2.5 px-3 w-24">Priority</th>
                    <th className="py-2.5 px-3 min-w-[140px]">Linked Req</th>
                    <th className="py-2.5 px-3 min-w-[180px]">Linked Endpoint</th>
                    <th className="py-2.5 px-3 w-28">Source</th>
                    <th className="py-2.5 px-3 w-28 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100">
                  {filteredTestCases.map((tc) => (
                    <tr
                      key={tc.id}
                      className="hover:bg-stone-50/60 transition-colors group"
                    >
                      {/* ID */}
                      <td className="py-2.5 px-3 font-mono font-medium text-stone-500 whitespace-nowrap">
                        {tc.id}
                      </td>

                      {/* Title (Inline Editable) */}
                      <td className="py-2.5 px-3">
                        {editingCell?.id === tc.id && editingCell?.field === 'title' ? (
                          <div className="flex items-center gap-1">
                            <input
                              type="text"
                              autoFocus
                              value={inlineInputValue}
                              onChange={(e) => setInlineInputValue(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  handleUpdateTestCaseField(tc.id, 'title', inlineInputValue);
                                  setEditingCell(null);
                                } else if (e.key === 'Escape') {
                                  setEditingCell(null);
                                }
                              }}
                              onBlur={() => {
                                handleUpdateTestCaseField(tc.id, 'title', inlineInputValue);
                                setEditingCell(null);
                              }}
                              className="w-full px-2 py-1 text-xs rounded border border-indigo-500 bg-white focus:outline-none"
                            />
                            <button
                              onMouseDown={() => {
                                handleUpdateTestCaseField(tc.id, 'title', inlineInputValue);
                                setEditingCell(null);
                              }}
                              className="p-1 text-emerald-600 hover:bg-emerald-50 rounded"
                            >
                              <Check className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-center justify-between gap-2">
                            <button
                              onClick={() => setDetailCase(tc)}
                              className="text-left font-medium text-stone-900 hover:text-indigo-600 line-clamp-2 hover:underline cursor-pointer"
                              title="Click to view details"
                            >
                              {tc.title}
                            </button>
                            <button
                              onClick={() => {
                                setEditingCell({ id: tc.id, field: 'title' });
                                setInlineInputValue(tc.title);
                              }}
                              className="opacity-0 group-hover:opacity-100 p-1 text-stone-400 hover:text-stone-700 rounded transition-opacity"
                              title="Inline edit title"
                            >
                              <Edit3 className="w-3 h-3" />
                            </button>
                          </div>
                        )}
                      </td>

                      {/* Type (Inline Dropdown Selector) */}
                      <td className="py-2.5 px-3 whitespace-nowrap">
                        <select
                          value={tc.type}
                          onChange={(e) =>
                            handleUpdateTestCaseField(tc.id, 'type', e.target.value as TestCaseType)
                          }
                          className={`text-xs font-medium px-2 py-0.5 rounded border focus:outline-none cursor-pointer ${getTypeBadgeClass(
                            tc.type
                          )}`}
                        >
                          <option value="Positive">Positive</option>
                          <option value="Negative">Negative</option>
                          <option value="Edge">Edge</option>
                          <option value="Boundary">Boundary</option>
                        </select>
                      </td>

                      {/* Priority (Inline Dropdown Selector) */}
                      <td className="py-2.5 px-3 whitespace-nowrap">
                        <select
                          value={tc.priority}
                          onChange={(e) =>
                            handleUpdateTestCaseField(tc.id, 'priority', e.target.value as TestCasePriority)
                          }
                          className={`text-xs font-medium px-2 py-0.5 rounded border focus:outline-none cursor-pointer ${getPriorityBadgeClass(
                            tc.priority
                          )}`}
                        >
                          <option value="High">High</option>
                          <option value="Medium">Medium</option>
                          <option value="Low">Low</option>
                        </select>
                      </td>

                      {/* Linked Requirement (Badges) */}
                      <td className="py-2.5 px-3">
                        <div className="flex items-center gap-1 flex-wrap">
                          {tc.linkedRequirements && tc.linkedRequirements.length > 0 ? (
                            tc.linkedRequirements.map((req) => (
                              <span
                                key={req}
                                className="px-1.5 py-0.5 rounded bg-indigo-50 border border-indigo-200 text-indigo-700 font-mono text-[10px] font-medium"
                              >
                                {req}
                              </span>
                            ))
                          ) : (
                            <span className="text-stone-400 text-[11px] italic">None</span>
                          )}
                        </div>
                      </td>

                      {/* Linked Endpoint (Inline Editable) */}
                      <td className="py-2.5 px-3">
                        {editingCell?.id === tc.id && editingCell?.field === 'endpoint' ? (
                          <div className="flex items-center gap-1">
                            <input
                              type="text"
                              autoFocus
                              value={inlineInputValue}
                              onChange={(e) => setInlineInputValue(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  handleUpdateTestCaseField(tc.id, 'linkedEndpoint', inlineInputValue);
                                  setEditingCell(null);
                                } else if (e.key === 'Escape') {
                                  setEditingCell(null);
                                }
                              }}
                              onBlur={() => {
                                handleUpdateTestCaseField(tc.id, 'linkedEndpoint', inlineInputValue);
                                setEditingCell(null);
                              }}
                              className="w-full px-2 py-1 text-xs font-mono rounded border border-indigo-500 bg-white focus:outline-none"
                            />
                            <button
                              onMouseDown={() => {
                                handleUpdateTestCaseField(tc.id, 'linkedEndpoint', inlineInputValue);
                                setEditingCell(null);
                              }}
                              className="p-1 text-emerald-600 hover:bg-emerald-50 rounded"
                            >
                              <Check className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-center justify-between gap-1.5 group/ep">
                            <span className="font-mono text-xs text-stone-700 truncate max-w-[200px]" title={tc.linkedEndpoint}>
                              {tc.linkedEndpoint}
                            </span>
                            <button
                              onClick={() => {
                                setEditingCell({ id: tc.id, field: 'endpoint' });
                                setInlineInputValue(tc.linkedEndpoint);
                              }}
                              className="opacity-0 group-hover/ep:opacity-100 p-0.5 text-stone-400 hover:text-stone-700 rounded transition-opacity"
                              title="Inline edit endpoint"
                            >
                              <Edit3 className="w-3 h-3" />
                            </button>
                          </div>
                        )}
                      </td>

                      {/* Source */}
                      <td className="py-2.5 px-3 whitespace-nowrap">
                        {tc.source === 'AI-generated' ? (
                          <span className="inline-flex items-center gap-1 text-[11px] font-medium text-indigo-700 bg-indigo-50 border border-indigo-200 px-2 py-0.5 rounded">
                            <Sparkles className="w-3 h-3 text-indigo-500" />
                            AI
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded">
                            Manual
                          </span>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="py-2.5 px-3 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => setDetailCase(tc)}
                            className="p-1.5 text-stone-500 hover:text-indigo-600 hover:bg-stone-100 rounded transition-colors"
                            title="View Full Test Case"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => {
                              setEditingCase(tc);
                              setIsFormModalOpen(true);
                            }}
                            className="p-1.5 text-stone-500 hover:text-stone-800 hover:bg-stone-100 rounded transition-colors"
                            title="Edit Test Case"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => setDeletingCase(tc)}
                            className="p-1.5 text-stone-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                            title="Delete Test Case"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Table Footer */}
            <div className="bg-stone-50 border-t border-stone-200 px-4 py-2.5 flex items-center justify-between text-xs text-stone-500">
              <div>
                Showing <span className="font-semibold text-stone-800">{filteredTestCases.length}</span> of{' '}
                <span className="font-semibold text-stone-800">{testCases.length}</span> test cases
              </div>
              <div className="flex items-center gap-2 text-[11px]">
                <span>All edits are automatically saved to Microsoft OneDrive.</span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 4. Modals */}
      {/* Create / Edit Modal */}
      {isFormModalOpen && (
        <TestCaseFormModal
          isOpen={isFormModalOpen}
          onClose={() => {
            setIsFormModalOpen(false);
            setEditingCase(null);
          }}
          onSave={handleSaveTestCaseFromModal}
          initialData={editingCase}
          endpoints={selectedApiSpec?.endpoints || []}
          availableRequirements={requirementsContent ? Array.from(requirementsContent.matchAll(/REQ-[A-Z0-9-]+/g)).map((m) => m[0]) : []}
          apiName={selectedApi?.name || 'API'}
        />
      )}

      {/* Detail Modal */}
      {detailCase && (
        <TestCaseDetailModal
          isOpen={Boolean(detailCase)}
          onClose={() => setDetailCase(null)}
          onEdit={(tc) => {
            setDetailCase(null);
            setEditingCase(tc);
            setIsFormModalOpen(true);
          }}
          testCase={detailCase}
          apiName={selectedApi?.name || 'API'}
        />
      )}

      {/* Delete Modal */}
      {deletingCase && (
        <DeleteTestCaseModal
          isOpen={Boolean(deletingCase)}
          onClose={() => setDeletingCase(null)}
          onConfirm={handleDeleteTestCaseConfirm}
          testCase={deletingCase}
          apiName={selectedApi?.name || 'API'}
        />
      )}

      {/* Regenerate Confirmation Modal */}
      {isRegenConfirmOpen && (
        <Modal
          isOpen={isRegenConfirmOpen}
          onClose={() => setIsRegenConfirmOpen(false)}
          title="Regenerate Test Suite?"
          description={`An existing suite of ${testCases.length} test cases was found for ${selectedApi?.name}.`}
          maxWidth="sm"
          footer={
            <div className="flex items-center justify-end gap-2 w-full">
              <Button variant="ghost" size="sm" onClick={() => setIsRegenConfirmOpen(false)}>
                Cancel
              </Button>
              <Button
                variant="primary"
                size="sm"
                onClick={executeAiGeneration}
                leftIcon={<Sparkles className="w-3.5 h-3.5" />}
              >
                Regenerate Suite with AI
              </Button>
            </div>
          }
        >
          <div className="space-y-3 text-xs text-stone-700">
            <p>
              Generating a new test suite with your selected AI provider will synthesize fresh test cases from the requirements specification and overwrite the existing file{' '}
              <code className="bg-stone-100 px-1 py-0.5 rounded font-mono">{fileMeta.fileName}</code> in OneDrive.
            </p>
            <div className="p-2.5 bg-stone-50 border border-stone-200 rounded text-stone-600">
              Any custom manual test cases can be backed up or re-added after generation.
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
