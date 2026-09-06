import { useState, useEffect, useMemo } from 'react';
import Markdown from 'react-markdown';
import type {
  ApiReference,
  ApiSpec,
  NavigationView,
  RequirementsDiffData,
} from '../../types';
import { useProjects } from '../../context/ProjectContext';
import { useOneDrive } from '../../context/OneDriveContext';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../ui/Toast';
import { fetchProjectApiReferences, fetchApiSpec } from '../../lib/apiStorage';
import { RequirementsDiffModal } from '../requirements/RequirementsDiffModal';
import { Button } from '../ui/Button';
import {
  FileText,
  Sparkles,
  Edit3,
  Eye,
  Save,
  RotateCcw,
  Search,
  Cloud,
  ExternalLink,
  Copy,
  Check,
  Download,
  Code,
  Bold,
  Italic,
  Heading1,
  Heading2,
  List,
  Table,
  CheckCircle2,
  AlertCircle,
  Clock,
  Layers,
  FileCode2,
  Globe,
  Loader2,
  ShieldAlert,
  CheckSquare,
} from 'lucide-react';

interface RequirementsViewProps {
  onNavigate: (view: NavigationView, payload?: string) => void;
  initialSelectedApiId?: string | null;
}

interface ReqFileInfo {
  id: string;
  name: string;
  size: number;
  webUrl: string;
  lastModifiedDateTime: string;
}

export function RequirementsView({
  onNavigate,
  initialSelectedApiId,
}: RequirementsViewProps) {
  const { activeProject } = useProjects();
  const { isConnected, isDemo } = useOneDrive();
  const { user } = useAuth();
  const { showToast } = useToast();

  // API list state
  const [apis, setApis] = useState<ApiReference[]>([]);
  const [loadingApis, setLoadingApis] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Requirements files in OneDrive
  const [reqFiles, setReqFiles] = useState<ReqFileInfo[]>([]);
  const [loadingReqFiles, setLoadingReqFiles] = useState<boolean>(false);

  // Selected API & document state
  const [selectedApiId, setSelectedApiId] = useState<string | null>(initialSelectedApiId || null);
  const [documentContent, setDocumentContent] = useState<string | null>(null);
  const [loadingDoc, setLoadingDoc] = useState<boolean>(false);
  const [docFileMeta, setDocFileMeta] = useState<{ fileName?: string; webUrl?: string; lastModified?: string }>({});

  // Inline edit state
  const [isEditing, setIsEditing] = useState<boolean>(false);
  const [editedContent, setEditedContent] = useState<string>('');
  const [isSaving, setIsSaving] = useState<boolean>(false);

  // AI Generation & Diff state
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [diffModalData, setDiffModalData] = useState<RequirementsDiffData | null>(null);
  const [isOverwriting, setIsOverwriting] = useState<boolean>(false);

  // Copied state
  const [copied, setCopied] = useState<boolean>(false);

  // Load project APIs
  const loadProjectApis = async () => {
    if (!activeProject) return;
    setLoadingApis(true);
    try {
      const refs = await fetchProjectApiReferences(activeProject.id, activeProject.name);
      setApis(refs);
      if (!selectedApiId && refs.length > 0) {
        // If initialSelectedApiId was passed, match it, otherwise select first
        const match = initialSelectedApiId ? refs.find((a) => a.id === initialSelectedApiId) : refs[0];
        setSelectedApiId(match ? match.id : refs[0].id);
      }
    } catch (err: any) {
      console.error('Failed to load APIs:', err);
    } finally {
      setLoadingApis(false);
    }
  };

  // Load list of requirements files from OneDrive
  const loadOneDriveReqFiles = async () => {
    if (!user || !activeProject) return;
    setLoadingReqFiles(true);
    try {
      const reqsFolderId = activeProject.oneDriveFolder?.subfolders.requirements?.id || '';
      const params = new URLSearchParams({
        userId: user.id,
        projectId: activeProject.id,
        reqsFolderId,
      });

      const res = await fetch(`/api/requirements/list?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setReqFiles(data.files || []);
      }
    } catch (err) {
      console.warn('Could not load requirements files list:', err);
    } finally {
      setLoadingReqFiles(false);
    }
  };

  useEffect(() => {
    loadProjectApis();
    loadOneDriveReqFiles();
  }, [activeProject?.id, user?.id]);

  // Selected API object
  const selectedApi = useMemo(() => {
    return apis.find((a) => a.id === selectedApiId) || null;
  }, [apis, selectedApiId]);

  // Filtered APIs for left pane
  const filteredApis = useMemo(() => {
    if (!searchQuery.trim()) return apis;
    const q = searchQuery.toLowerCase();
    return apis.filter(
      (a) =>
        a.name.toLowerCase().includes(q) ||
        a.baseUrl.toLowerCase().includes(q) ||
        a.authType.toLowerCase().includes(q)
    );
  }, [apis, searchQuery]);

  // Check if an API has an existing requirements file
  const getApiReqStatus = (apiName: string) => {
    const cleanName = apiName.replace(/[/\\?%*:|"<>]/g, '_').trim().toLowerCase();
    const match = reqFiles.find((f) => {
      const fn = f.name.toLowerCase();
      return (
        fn === `${cleanName}-requirements.md` ||
        fn === `${cleanName}.md` ||
        fn.includes(cleanName)
      );
    });
    return match || null;
  };

  // Load document content when selectedApiId changes
  useEffect(() => {
    if (!selectedApi || !user || !activeProject) {
      setDocumentContent(null);
      setEditedContent('');
      return;
    }

    let isMounted = true;
    const fetchDoc = async () => {
      setLoadingDoc(true);
      setIsEditing(false);
      try {
        const reqsFolderId = activeProject.oneDriveFolder?.subfolders.requirements?.id || '';
        const params = new URLSearchParams({
          userId: user.id,
          projectId: activeProject.id,
          apiName: selectedApi.name,
          reqsFolderId,
        });

        const res = await fetch(`/api/requirements/file?${params.toString()}`);
        if (res.ok && isMounted) {
          const data = await res.json();
          if (data.exists && data.content) {
            setDocumentContent(data.content);
            setEditedContent(data.content);
            setDocFileMeta({
              fileName: data.fileName,
              webUrl: data.webUrl,
            });
          } else {
            setDocumentContent(null);
            setEditedContent('');
            setDocFileMeta({});
          }
        }
      } catch (err) {
        console.error('Failed to load requirement file:', err);
      } finally {
        if (isMounted) setLoadingDoc(false);
      }
    };

    fetchDoc();
    return () => {
      isMounted = false;
    };
  }, [selectedApi?.id, activeProject?.id, user?.id]);

  // Generate Requirements with AI
  const handleGenerate = async (forceOverwrite: boolean = false) => {
    if (!selectedApi || !user || !activeProject) return;

    setIsGenerating(true);
    try {
      // 1. Fetch full spec in case it needs to be synced or passed as fallback
      const fullSpec = await fetchApiSpec(activeProject.id, selectedApi.id);

      const apisFolderId = activeProject.oneDriveFolder?.subfolders.apis?.id || '';
      const reqsFolderId = activeProject.oneDriveFolder?.subfolders.requirements?.id || '';

      const res = await fetch('/api/requirements/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user.id,
          projectId: activeProject.id,
          apiId: selectedApi.id,
          apiName: selectedApi.name,
          apisFolderId,
          reqsFolderId,
          apiSpec: fullSpec,
          forceOverwrite,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.message || 'Generation failed.');
      }

      // If requirements already exist and overwrite not yet confirmed, show diff
      if (data.status === 'diff_required') {
        setDiffModalData({
          apiId: selectedApi.id,
          apiName: selectedApi.name,
          fileName: data.fileName,
          existingContent: data.existingContent,
          newContent: data.newContent,
          existingFileId: data.fileId,
          provider: data.provider,
          model: data.model,
          isFallback: data.isFallback,
        });
        return;
      }

      // If saved successfully
      if (data.status === 'saved' && data.content) {
        setDocumentContent(data.content);
        setEditedContent(data.content);
        setDocFileMeta({
          fileName: data.fileName,
          webUrl: data.webUrl,
        });
        setIsEditing(false);
        await loadOneDriveReqFiles();

        showToast({
          type: 'success',
          title: 'Requirements Generated',
          description: `Saved to OneDrive "requirements/${data.fileName}".`,
        });
      }
    } catch (err: any) {
      showToast({
        type: 'error',
        title: 'Generation Failed',
        description: err.message || 'Could not generate requirements.',
      });
    } finally {
      setIsGenerating(false);
    }
  };

  // Confirm Overwrite in Diff Modal
  const handleConfirmOverwrite = async (diffData: RequirementsDiffData) => {
    setIsOverwriting(true);
    try {
      const reqsFolderId = activeProject?.oneDriveFolder?.subfolders.requirements?.id || '';
      const res = await fetch('/api/requirements/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user?.id,
          projectId: activeProject?.id,
          apiName: diffData.apiName,
          fileName: diffData.fileName,
          content: diffData.newContent,
          reqsFolderId,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || 'Failed to overwrite file.');
      }

      setDocumentContent(diffData.newContent);
      setEditedContent(diffData.newContent);
      setDocFileMeta({
        fileName: diffData.fileName,
        webUrl: data.file?.webUrl,
      });
      setDiffModalData(null);
      setIsEditing(false);
      await loadOneDriveReqFiles();

      showToast({
        type: 'success',
        title: 'Requirements Updated',
        description: `Overwritten and saved to OneDrive "${diffData.fileName}".`,
      });
    } catch (err: any) {
      showToast({
        type: 'error',
        title: 'Overwrite Failed',
        description: err.message || 'Could not save requirements.',
      });
    } finally {
      setIsOverwriting(false);
    }
  };

  // Save inline edits back to OneDrive
  const handleSaveInlineEdit = async () => {
    if (!selectedApi || !user || !activeProject) return;

    setIsSaving(true);
    try {
      const reqsFolderId = activeProject.oneDriveFolder?.subfolders.requirements?.id || '';
      const cleanName = selectedApi.name.replace(/[/\\?%*:|"<>]/g, '_').trim();
      const fileName = docFileMeta.fileName || `${cleanName}-requirements.md`;

      const res = await fetch('/api/requirements/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user.id,
          projectId: activeProject.id,
          apiName: selectedApi.name,
          fileName,
          content: editedContent,
          reqsFolderId,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || 'Failed to save modifications.');
      }

      setDocumentContent(editedContent);
      setDocFileMeta((prev) => ({
        ...prev,
        fileName,
        webUrl: data.file?.webUrl || prev.webUrl,
      }));
      setIsEditing(false);
      await loadOneDriveReqFiles();

      showToast({
        type: 'success',
        title: 'Changes Saved',
        description: `Updated ${fileName} in OneDrive "requirements" folder.`,
      });
    } catch (err: any) {
      showToast({
        type: 'error',
        title: 'Save Failed',
        description: err.message || 'Could not save modifications.',
      });
    } finally {
      setIsSaving(false);
    }
  };

  // Copy Markdown to Clipboard
  const handleCopyMarkdown = () => {
    const textToCopy = isEditing ? editedContent : documentContent || '';
    if (!textToCopy) return;
    navigator.clipboard.writeText(textToCopy);
    setCopied(true);
    showToast({
      type: 'success',
      title: 'Copied to Clipboard',
      description: 'Requirements Markdown copied successfully.',
    });
    setTimeout(() => setCopied(false), 2000);
  };

  // Download .md file
  const handleDownloadMarkdown = () => {
    const text = isEditing ? editedContent : documentContent || '';
    if (!text || !selectedApi) return;
    const blob = new Blob([text], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    const cleanName = selectedApi.name.replace(/[/\\?%*:|"<>]/g, '_').trim();
    link.download = `${cleanName}-requirements.md`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // Editor Formatting Helper
  const insertEditorSnippet = (before: string, after: string = '', placeholder: string = '') => {
    const textarea = document.getElementById('requirements-editor-textarea') as HTMLTextAreaElement;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const current = editedContent;
    const selectedText = current.substring(start, end) || placeholder;

    const replacement = `${before}${selectedText}${after}`;
    const updated = current.substring(0, start) + replacement + current.substring(end);
    setEditedContent(updated);

    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(
        start + before.length,
        start + before.length + selectedText.length
      );
    }, 0);
  };

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)] max-w-7xl mx-auto px-4 py-4 sm:px-6">
      {/* Top Breadcrumb & Project Context */}
      <div className="flex items-center justify-between pb-3 border-b border-stone-200 shrink-0">
        <div className="flex items-center gap-2 text-xs text-stone-600">
          <span className="font-semibold text-stone-900">{activeProject?.name || 'Project'}</span>
          <span>/</span>
          <span className="font-semibold text-indigo-600 flex items-center gap-1.5">
            <FileText className="w-3.5 h-3.5 text-indigo-600" />
            API Requirements
          </span>
          <span className="text-stone-300">•</span>
          <span className="text-stone-500 font-mono text-[11px]">
            OneDrive: requirements/ folder
          </span>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onNavigate('apis')}
            leftIcon={<FileCode2 className="w-3.5 h-3.5 text-stone-500" />}
          >
            Manage APIs
          </Button>
        </div>
      </div>

      {/* Main Two-Pane Layout */}
      <div className="flex-1 grid grid-cols-1 md:grid-cols-12 gap-4 pt-4 min-h-0 overflow-hidden">
        {/* ============================================================ */}
        {/* LEFT PANE: List of APIs (Col 1-4)                            */}
        {/* ============================================================ */}
        <div className="md:col-span-4 flex flex-col bg-white border border-stone-200 rounded-xl overflow-hidden shadow-2xs">
          {/* Search & Header */}
          <div className="p-3 border-b border-stone-100 bg-stone-50/50 space-y-2.5 shrink-0">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-stone-800 tracking-tight flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5 text-indigo-600" />
                API Specifications
              </span>
              <span className="text-[11px] font-mono font-medium text-stone-500 bg-stone-200/60 px-2 py-0.5 rounded">
                {apis.length} {apis.length === 1 ? 'API' : 'APIs'}
              </span>
            </div>

            <div className="relative">
              <Search className="w-3.5 h-3.5 text-stone-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Filter APIs..."
                className="w-full bg-white border border-stone-200 rounded-lg pl-8 pr-3 py-1.5 text-xs text-stone-900 placeholder:text-stone-400 focus:outline-hidden focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-colors"
              />
            </div>
          </div>

          {/* List of APIs */}
          <div className="flex-1 overflow-y-auto divide-y divide-stone-100 p-1">
            {loadingApis ? (
              <div className="p-8 flex flex-col items-center justify-center gap-2 text-stone-400 text-xs">
                <Loader2 className="w-5 h-5 animate-spin text-indigo-600" />
                <span>Loading APIs...</span>
              </div>
            ) : filteredApis.length === 0 ? (
              <div className="p-8 text-center text-xs text-stone-500 space-y-2">
                <AlertCircle className="w-6 h-6 text-stone-400 mx-auto" />
                <p className="font-medium text-stone-700">No APIs found</p>
                <p className="text-stone-400">
                  {searchQuery ? 'Try matching a different keyword.' : 'Add your first API to generate requirements.'}
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onNavigate('apis')}
                  className="mt-2 text-xs"
                >
                  Create API Spec
                </Button>
              </div>
            ) : (
              filteredApis.map((api) => {
                const isSelected = api.id === selectedApiId;
                const reqStatus = getApiReqStatus(api.name);
                const hasReq = Boolean(reqStatus);

                return (
                  <div
                    key={api.id}
                    onClick={() => {
                      setSelectedApiId(api.id);
                    }}
                    className={`p-3 rounded-lg cursor-pointer transition-all ${
                      isSelected
                        ? 'bg-indigo-50/70 border border-indigo-200 shadow-2xs'
                        : 'hover:bg-stone-50/80 border border-transparent'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2 mb-1">
                      <h3
                        className={`text-xs font-bold leading-snug truncate ${
                          isSelected ? 'text-indigo-900' : 'text-stone-900'
                        }`}
                        title={api.name}
                      >
                        {api.name}
                      </h3>
                      {hasReq ? (
                        <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200 shrink-0">
                          <CheckCircle2 className="w-2.5 h-2.5 text-emerald-600" />
                          Ready
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[10px] font-medium text-stone-500 bg-stone-100 px-1.5 py-0.5 rounded border border-stone-200 shrink-0">
                          No Spec
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-1.5 text-[11px] text-stone-500 font-mono truncate mb-2">
                      <Globe className="w-3 h-3 text-stone-400 shrink-0" />
                      <span className="truncate">{api.baseUrl}</span>
                    </div>

                    <div className="flex items-center justify-between text-[10px] text-stone-400">
                      <span className="font-mono">{api.endpointCount} endpoints</span>
                      {hasReq && reqStatus ? (
                        <span className="truncate max-w-[140px] text-stone-500 font-mono">
                          {reqStatus.name}
                        </span>
                      ) : (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedApiId(api.id);
                            setTimeout(() => handleGenerate(false), 50);
                          }}
                          className="text-indigo-600 font-semibold hover:text-indigo-800 flex items-center gap-1"
                        >
                          <Sparkles className="w-2.5 h-2.5" />
                          Generate
                        </button>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* ============================================================ */}
        {/* RIGHT PANE: Rendered Markdown & Inline Editor (Col 5-12)     */}
        {/* ============================================================ */}
        <div className="md:col-span-8 flex flex-col bg-white border border-stone-200 rounded-xl overflow-hidden shadow-2xs">
          {selectedApi ? (
            <>
              {/* Right Header Bar */}
              <div className="p-3.5 border-b border-stone-200 bg-stone-50/70 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shrink-0">
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <h2 className="text-sm font-bold text-stone-900 tracking-tight">
                      {selectedApi.name} Requirements
                    </h2>
                    {docFileMeta.fileName && (
                      <span className="inline-flex items-center gap-1 text-[11px] font-mono text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-200">
                        <Cloud className="w-3 h-3 text-indigo-500" />
                        {docFileMeta.fileName}
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-stone-500 font-mono mt-0.5">
                    Target: {selectedApi.baseUrl} • {selectedApi.endpointCount} Endpoints
                  </p>
                </div>

                {/* Right Header Action Toolbar */}
                <div className="flex items-center gap-1.5 flex-wrap">
                  {documentContent ? (
                    <>
                      {/* View / Edit Mode Switcher */}
                      <div className="flex border border-stone-200 rounded-lg bg-white overflow-hidden p-0.5 shadow-2xs">
                        <button
                          type="button"
                          onClick={() => {
                            if (isEditing) {
                              setEditedContent(documentContent || '');
                            }
                            setIsEditing(false);
                          }}
                          className={`px-2.5 py-1 text-xs font-semibold rounded-md flex items-center gap-1.5 transition-colors ${
                            !isEditing
                              ? 'bg-indigo-600 text-white shadow-2xs'
                              : 'text-stone-600 hover:text-stone-900 hover:bg-stone-50'
                          }`}
                        >
                          <Eye className="w-3.5 h-3.5" />
                          <span>Preview</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            setEditedContent(documentContent || '');
                            setIsEditing(true);
                          }}
                          className={`px-2.5 py-1 text-xs font-semibold rounded-md flex items-center gap-1.5 transition-colors ${
                            isEditing
                              ? 'bg-indigo-600 text-white shadow-2xs'
                              : 'text-stone-600 hover:text-stone-900 hover:bg-stone-50'
                          }`}
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                          <span>Edit</span>
                        </button>
                      </div>

                      {/* Regenerate with AI */}
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleGenerate(false)}
                        disabled={isGenerating}
                        isLoading={isGenerating}
                        leftIcon={<Sparkles className="w-3.5 h-3.5 text-indigo-600" />}
                        title="Regenerate requirements from OneDrive API spec using AI"
                      >
                        Regenerate
                      </Button>

                      {/* Generate / View Test Cases for this API */}
                      <Button
                        variant="primary"
                        size="sm"
                        onClick={() => onNavigate('test-cases', selectedApi?.id)}
                        leftIcon={<CheckSquare className="w-3.5 h-3.5 text-white" />}
                        className="bg-purple-600 hover:bg-purple-700 text-white shadow-xs"
                        title="Generate or view test cases for this API"
                      >
                        Generate Test Cases
                      </Button>

                      {/* Copy & Download */}
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={handleCopyMarkdown}
                        title="Copy Markdown"
                        className="px-2 text-stone-500 hover:text-stone-800"
                      >
                        {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                      </Button>

                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={handleDownloadMarkdown}
                        title="Download Markdown file"
                        className="px-2 text-stone-500 hover:text-stone-800"
                      >
                        <Download className="w-3.5 h-3.5" />
                      </Button>

                      {docFileMeta.webUrl && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => window.open(docFileMeta.webUrl, '_blank')}
                          title="Open file in Microsoft OneDrive"
                          className="px-2 text-indigo-600 hover:text-indigo-800"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                        </Button>
                      )}
                    </>
                  ) : (
                    /* If no document yet */
                    <Button
                      variant="primary"
                      size="sm"
                      onClick={() => handleGenerate(false)}
                      disabled={isGenerating}
                      isLoading={isGenerating}
                      leftIcon={<Sparkles className="w-3.5 h-3.5 text-amber-300" />}
                    >
                      Generate Requirements
                    </Button>
                  )}
                </div>
              </div>

              {/* Main Content Area */}
              <div className="flex-1 overflow-y-auto relative flex flex-col">
                {loadingDoc ? (
                  <div className="flex-1 flex flex-col items-center justify-center p-12 text-stone-400 text-xs gap-2">
                    <Loader2 className="w-6 h-6 animate-spin text-indigo-600" />
                    <span>Loading requirements from OneDrive...</span>
                  </div>
                ) : documentContent ? (
                  isEditing ? (
                    /* Inline Edit Mode */
                    <div className="flex-1 flex flex-col h-full">
                      {/* Editor Formatting Shortcut Toolbar */}
                      <div className="px-4 py-2 border-b border-stone-200 bg-stone-50 flex items-center gap-1 flex-wrap text-stone-600 text-xs shrink-0">
                        <button
                          type="button"
                          onClick={() => insertEditorSnippet('**', '**', 'bold text')}
                          className="p-1 hover:bg-stone-200 rounded text-stone-700"
                          title="Bold (**text**)"
                        >
                          <Bold className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => insertEditorSnippet('*', '*', 'italic text')}
                          className="p-1 hover:bg-stone-200 rounded text-stone-700"
                          title="Italic (*text*)"
                        >
                          <Italic className="w-3.5 h-3.5" />
                        </button>
                        <div className="w-px h-4 bg-stone-300 mx-1" />
                        <button
                          type="button"
                          onClick={() => insertEditorSnippet('# ', '', 'Heading 1')}
                          className="p-1 hover:bg-stone-200 rounded text-stone-700"
                          title="Heading 1"
                        >
                          <Heading1 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => insertEditorSnippet('## ', '', 'Heading 2')}
                          className="p-1 hover:bg-stone-200 rounded text-stone-700"
                          title="Heading 2"
                        >
                          <Heading2 className="w-3.5 h-3.5" />
                        </button>
                        <div className="w-px h-4 bg-stone-300 mx-1" />
                        <button
                          type="button"
                          onClick={() => insertEditorSnippet('- ', '', 'List item')}
                          className="p-1 hover:bg-stone-200 rounded text-stone-700"
                          title="Bullet List"
                        >
                          <List className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            insertEditorSnippet(
                              '\n| Parameter | Type | Required | Description |\n| :--- | :--- | :--- | :--- |\n| `id` | string | **Yes** | Identifier |\n\n'
                            )
                          }
                          className="p-1 hover:bg-stone-200 rounded text-stone-700"
                          title="Insert Table Template"
                        >
                          <Table className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => insertEditorSnippet('\n```json\n{\n  "status": "ok"\n}\n```\n')}
                          className="p-1 hover:bg-stone-200 rounded text-stone-700"
                          title="Insert JSON Block"
                        >
                          <Code className="w-3.5 h-3.5" />
                        </button>

                        <div className="ml-auto flex items-center gap-2 text-[11px] font-mono text-stone-400">
                          <span>{editedContent.length} chars</span>
                          <span>•</span>
                          <span>{editedContent.split('\n').length} lines</span>
                        </div>
                      </div>

                      {/* Textarea */}
                      <div className="flex-1 p-4 bg-stone-900 text-stone-100 min-h-[400px]">
                        <textarea
                          id="requirements-editor-textarea"
                          value={editedContent}
                          onChange={(e) => setEditedContent(e.target.value)}
                          placeholder="Edit Markdown requirements document..."
                          className="w-full h-full min-h-[400px] bg-transparent text-stone-100 font-mono text-xs leading-relaxed resize-none focus:outline-hidden"
                          spellCheck={false}
                        />
                      </div>

                      {/* Sticky Save Bar */}
                      <div className="p-3 border-t border-stone-200 bg-stone-50 flex items-center justify-between shrink-0">
                        <div className="text-xs text-stone-500 font-mono">
                          {editedContent !== documentContent ? (
                            <span className="text-amber-600 font-medium flex items-center gap-1">
                              <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
                              Unsaved modifications
                            </span>
                          ) : (
                            <span className="text-stone-400">No uncommitted changes</span>
                          )}
                        </div>

                        <div className="flex items-center gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setEditedContent(documentContent || '');
                              setIsEditing(false);
                            }}
                            disabled={isSaving}
                          >
                            Cancel
                          </Button>
                          <Button
                            variant="primary"
                            size="sm"
                            onClick={handleSaveInlineEdit}
                            disabled={isSaving || editedContent === documentContent}
                            isLoading={isSaving}
                            leftIcon={<Save className="w-3.5 h-3.5" />}
                          >
                            Save Changes to OneDrive
                          </Button>
                        </div>
                      </div>
                    </div>
                  ) : (
                    /* Rendered Markdown Preview Mode */
                    <div className="p-6 md:p-8 space-y-4 max-w-4xl">
                      {/* Markdown Container */}
                      <div className="markdown-body prose prose-stone max-w-none text-stone-800 text-sm leading-relaxed">
                        <Markdown
                          components={{
                            h1: ({ children }) => (
                              <h1 className="text-2xl font-bold text-stone-900 border-b border-stone-200 pb-2 mb-4 mt-2">
                                {children}
                              </h1>
                            ),
                            h2: ({ children }) => (
                              <h2 className="text-lg font-bold text-stone-900 border-b border-stone-100 pb-1.5 mt-6 mb-3">
                                {children}
                              </h2>
                            ),
                            h3: ({ children }) => (
                              <h3 className="text-sm font-bold text-stone-800 mt-5 mb-2">
                                {children}
                              </h3>
                            ),
                            h4: ({ children }) => (
                              <h4 className="text-xs font-bold text-stone-700 uppercase tracking-wider mt-4 mb-2">
                                {children}
                              </h4>
                            ),
                            p: ({ children }) => (
                              <p className="text-xs text-stone-700 leading-relaxed mb-3">
                                {children}
                              </p>
                            ),
                            table: ({ children }) => (
                              <div className="my-4 overflow-x-auto border border-stone-200 rounded-lg shadow-2xs">
                                <table className="w-full text-xs text-left text-stone-700 border-collapse">
                                  {children}
                                </table>
                              </div>
                            ),
                            thead: ({ children }) => (
                              <thead className="bg-stone-100 border-b border-stone-200 text-stone-800 font-semibold text-[11px]">
                                {children}
                              </thead>
                            ),
                            th: ({ children }) => (
                              <th className="px-3 py-2 border-r border-stone-200 last:border-r-0 font-semibold">
                                {children}
                              </th>
                            ),
                            td: ({ children }) => (
                              <td className="px-3 py-2 border-b border-r border-stone-200 last:border-r-0 last:border-b-0 font-mono text-[11px]">
                                {children}
                              </td>
                            ),
                            code: ({ children, className }) => {
                              const isBlock = className?.includes('language-');
                              if (isBlock) {
                                return (
                                  <code className="text-xs font-mono text-stone-100 block">
                                    {children}
                                  </code>
                                );
                              }
                              return (
                                <code className="px-1.5 py-0.5 bg-stone-100 text-indigo-700 border border-stone-200 rounded font-mono text-[11px]">
                                  {children}
                                </code>
                              );
                            },
                            pre: ({ children }) => (
                              <pre className="p-3.5 bg-stone-900 text-stone-100 rounded-lg font-mono text-xs overflow-x-auto my-3.5 border border-stone-800 shadow-2xs leading-relaxed">
                                {children}
                              </pre>
                            ),
                            ul: ({ children }) => (
                              <ul className="list-disc pl-5 text-xs text-stone-700 space-y-1 mb-3">
                                {children}
                              </ul>
                            ),
                            ol: ({ children }) => (
                              <ol className="list-decimal pl-5 text-xs text-stone-700 space-y-1 mb-3">
                                {children}
                              </ol>
                            ),
                            blockquote: ({ children }) => (
                              <blockquote className="border-l-4 border-indigo-500 bg-indigo-50/40 pl-3.5 py-1 text-xs italic text-stone-700 my-3 rounded-r">
                                {children}
                              </blockquote>
                            ),
                            hr: () => <hr className="my-6 border-stone-200" />,
                          }}
                        >
                          {documentContent}
                        </Markdown>
                      </div>
                    </div>
                  )
                ) : (
                  /* Empty State: No Requirements Document yet */
                  <div className="flex-1 flex flex-col items-center justify-center p-8 text-center max-w-md mx-auto my-auto space-y-4">
                    <div className="w-12 h-12 rounded-2xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 shadow-xs">
                      <Sparkles className="w-6 h-6" />
                    </div>

                    <div className="space-y-1">
                      <h3 className="text-base font-bold text-stone-900">
                        Generate Requirements for {selectedApi.name}
                      </h3>
                      <p className="text-xs text-stone-500 leading-relaxed">
                        CoverageAI will inspect the full API contract in OneDrive's{' '}
                        <code className="bg-stone-100 text-indigo-600 px-1 py-0.5 rounded font-mono">apis/</code>{' '}
                        folder and use your configured AI provider to produce an exhaustive verification specification.
                      </p>
                    </div>

                    <div className="w-full bg-stone-50 border border-stone-200 rounded-lg p-3 text-left text-xs space-y-1.5 text-stone-600">
                      <div className="flex items-center gap-2 font-semibold text-stone-800">
                        <Check className="w-3.5 h-3.5 text-emerald-600" />
                        <span>Included in Requirements:</span>
                      </div>
                      <ul className="text-[11px] text-stone-500 pl-5 list-disc space-y-0.5">
                        <li>Functional requirements per endpoint (schemas, inputs, rules)</li>
                        <li>Non-functional SLAs (latency, availability, security, RBAC)</li>
                        <li>Error-handling matrix (RFC 7807) & boundary edge cases</li>
                        <li>Traceability matrix & Gherkin automated test criteria</li>
                      </ul>
                    </div>

                    <Button
                      variant="primary"
                      size="md"
                      onClick={() => handleGenerate(false)}
                      disabled={isGenerating}
                      isLoading={isGenerating}
                      leftIcon={<Sparkles className="w-4 h-4 text-amber-300" />}
                      className="w-full sm:w-auto"
                    >
                      {isGenerating ? 'Synthesizing with AI...' : 'Generate Requirements with AI'}
                    </Button>
                  </div>
                )}
              </div>
            </>
          ) : (
            /* Empty State: No API Selected */
            <div className="flex-1 flex flex-col items-center justify-center p-12 text-center text-stone-400 space-y-2">
              <Layers className="w-8 h-8 text-stone-300 mx-auto" />
              <p className="text-sm font-semibold text-stone-700">Select an API Specification</p>
              <p className="text-xs text-stone-500 max-w-sm">
                Choose an API from the left pane to inspect its verified requirements document or generate a new specification.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Diff Confirmation Modal */}
      {diffModalData && (
        <RequirementsDiffModal
          isOpen={Boolean(diffModalData)}
          onClose={() => setDiffModalData(null)}
          diffData={diffModalData}
          onConfirmOverwrite={handleConfirmOverwrite}
          isOverwriting={isOverwriting}
        />
      )}
    </div>
  );
}
