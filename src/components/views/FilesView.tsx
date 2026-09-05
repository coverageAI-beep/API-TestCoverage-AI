import { useState, useEffect, useMemo, type FormEvent } from 'react';
import { useProjects } from '../../context/ProjectContext';
import { useOneDrive } from '../../context/OneDriveContext';
import { useAuth } from '../../context/AuthContext';
import type { OneDriveFileItem, NavigationView } from '../../types';
import { Button } from '../ui/Button';
import { Modal } from '../ui/Modal';
import {
  Folder,
  FolderOpen,
  FileCode2,
  CheckSquare,
  FlaskConical,
  BarChart3,
  ExternalLink,
  RefreshCw,
  Plus,
  Upload,
  Cloud,
  CloudOff,
  AlertTriangle,
  FileText,
  FileSpreadsheet,
  FileJson,
  File,
  Search,
  Check,
  ChevronRight,
  ShieldCheck,
  HardDrive,
  Info,
  Key,
} from 'lucide-react';

interface FilesViewProps {
  onNavigate: (view: NavigationView) => void;
}

type SubfolderCategory = 'all' | 'apis' | 'requirements' | 'testcases' | 'reports';

export function FilesView({ onNavigate }: FilesViewProps) {
  const { user } = useAuth();
  const { activeProject, projects, setActiveProject, attachOneDriveFolder } = useProjects();
  const {
    isConfigured,
    isConnected,
    isDemo,
    account,
    loading: oneDriveLoading,
    error: oneDriveError,
    connectOneDrive,
    connectDemoOneDrive,
    disconnectOneDrive,
    refreshStatus,
    provisionProjectFolder,
    fetchProjectFiles,
    uploadFile,
  } = useOneDrive();

  const [files, setFiles] = useState<OneDriveFileItem[]>([]);
  const [loadingFiles, setLoadingFiles] = useState<boolean>(false);
  const [fileError, setFileError] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<SubfolderCategory>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [isProvisioning, setIsProvisioning] = useState<boolean>(false);

  // Modals
  const [isNewFileModalOpen, setIsNewFileModalOpen] = useState<boolean>(false);
  const [newFileName, setNewFileName] = useState<string>('auth-contract.yaml');
  const [newFileCategory, setNewFileCategory] = useState<'apis' | 'requirements' | 'testcases' | 'reports'>('apis');
  const [newFileContent, setNewFileContent] = useState<string>(
    'openapi: 3.1.0\ninfo:\n  title: API Contract\n  version: 1.0.0\npaths:\n  /v1/resource:\n    get:\n      summary: Sample endpoint\n'
  );
  const [isSubmittingFile, setIsSubmittingFile] = useState<boolean>(false);

  // Upload modal
  const [isUploadModalOpen, setIsUploadModalOpen] = useState<boolean>(false);
  const [uploadCategory, setUploadCategory] = useState<'apis' | 'requirements' | 'testcases' | 'reports'>('apis');
  const [uploadTargetFile, setUploadTargetFile] = useState<globalThis.File | null>(null);
  const [isUploading, setIsUploading] = useState<boolean>(false);

  // Preview modal
  const [previewFile, setPreviewFile] = useState<OneDriveFileItem | null>(null);

  // OAuth connecting state
  const [isConnecting, setIsConnecting] = useState<boolean>(false);

  // Load project files when activeProject or connection changes
  const loadFiles = async () => {
    if (!activeProject || !isConnected) {
      setFiles([]);
      return;
    }

    setLoadingFiles(true);
    setFileError(null);

    try {
      const subfolders = activeProject.oneDriveFolder?.subfolders;
      const folderIds = {
        apis: subfolders?.apis?.id,
        requirements: subfolders?.requirements?.id,
        testcases: subfolders?.testcases?.id,
        reports: subfolders?.reports?.id,
        root: activeProject.oneDriveFolder?.rootFolderId,
      };

      const fetched = await fetchProjectFiles(
        activeProject.id,
        folderIds,
        selectedCategory === 'all' ? undefined : selectedCategory
      );
      setFiles(fetched);
    } catch (err: any) {
      console.error('Failed to load files:', err);
      setFileError(err.message || 'Failed to list OneDrive files');
    } finally {
      setLoadingFiles(false);
    }
  };

  useEffect(() => {
    if (isConnected && activeProject) {
      loadFiles();
    } else {
      setFiles([]);
    }
  }, [isConnected, activeProject?.id, selectedCategory]);

  // Provision OneDrive folder if active project has none
  const handleProvisionFolder = async () => {
    if (!activeProject) return;
    setIsProvisioning(true);
    setFileError(null);
    try {
      const folder = await provisionProjectFolder(activeProject.id, activeProject.name);
      await attachOneDriveFolder(activeProject.id, folder);
      await loadFiles();
    } catch (err: any) {
      console.error('Failed to provision OneDrive folder:', err);
      setFileError(err.message || 'Failed to create OneDrive folder');
    } finally {
      setIsProvisioning(false);
    }
  };

  // Connect OneDrive OAuth
  const handleConnect = async () => {
    setIsConnecting(true);
    setFileError(null);
    try {
      await connectOneDrive();
    } catch (err: any) {
      setFileError(err.message || 'Failed to initiate Microsoft OAuth');
    } finally {
      setIsConnecting(false);
    }
  };

  // Create new spec file
  const handleCreateFile = async (e: FormEvent) => {
    e.preventDefault();
    if (!activeProject) return;

    const subfolderId =
      activeProject.oneDriveFolder?.subfolders[newFileCategory]?.id ||
      activeProject.oneDriveFolder?.rootFolderId ||
      'root';

    setIsSubmittingFile(true);
    try {
      await uploadFile(
        activeProject.id,
        subfolderId,
        newFileCategory,
        newFileName.trim(),
        newFileContent
      );
      setIsNewFileModalOpen(false);
      await loadFiles();
    } catch (err: any) {
      setFileError(err.message || 'Failed to create file in OneDrive');
    } finally {
      setIsSubmittingFile(false);
    }
  };

  // Upload file
  const handleUploadSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!activeProject || !uploadTargetFile) return;

    const subfolderId =
      activeProject.oneDriveFolder?.subfolders[uploadCategory]?.id ||
      activeProject.oneDriveFolder?.rootFolderId ||
      'root';

    setIsUploading(true);
    try {
      const text = await uploadTargetFile.text();
      await uploadFile(
        activeProject.id,
        subfolderId,
        uploadCategory,
        uploadTargetFile.name,
        text
      );
      setIsUploadModalOpen(false);
      setUploadTargetFile(null);
      await loadFiles();
    } catch (err: any) {
      setFileError(err.message || 'Failed to upload file to OneDrive');
    } finally {
      setIsUploading(false);
    }
  };

  // Filtered files
  const filteredFiles = useMemo(() => {
    return files.filter((file) => {
      const matchesCategory =
        selectedCategory === 'all' || file.category === selectedCategory;
      const matchesSearch =
        !searchQuery ||
        file.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        file.category?.toLowerCase().includes(searchQuery.toLowerCase());
      return matchesCategory && matchesSearch;
    });
  }, [files, selectedCategory, searchQuery]);

  // File type icon helper
  const getFileIcon = (name: string, isDir?: boolean) => {
    if (isDir) return <Folder className="w-4 h-4 text-amber-500 fill-amber-100" />;
    const ext = name.split('.').pop()?.toLowerCase();
    switch (ext) {
      case 'yaml':
      case 'yml':
      case 'proto':
        return <FileCode2 className="w-4 h-4 text-indigo-600" />;
      case 'json':
        return <FileJson className="w-4 h-4 text-emerald-600" />;
      case 'md':
      case 'txt':
      case 'doc':
      case 'docx':
        return <FileText className="w-4 h-4 text-blue-600" />;
      case 'xlsx':
      case 'xls':
      case 'csv':
        return <FileSpreadsheet className="w-4 h-4 text-emerald-700" />;
      default:
        return <File className="w-4 h-4 text-stone-500" />;
    }
  };

  const formatFileSize = (bytes: number) => {
    if (!bytes || bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  const formatDate = (isoStr: string) => {
    try {
      const d = new Date(isoStr);
      return d.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return isoStr;
    }
  };

  // Subfolder counts
  const categoryCounts = useMemo(() => {
    const counts = { all: files.length, apis: 0, requirements: 0, testcases: 0, reports: 0 };
    files.forEach((f) => {
      if (f.category && counts[f.category] !== undefined) {
        counts[f.category]++;
      }
    });
    return counts;
  }, [files]);

  return (
    <div className="flex flex-col">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-8">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-stone-900">Project Files</h1>
            {isConnected && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                <Check className="w-3 h-3" />
                OneDrive Connected
              </span>
            )}
          </div>
          <p className="text-stone-500 text-sm mt-1">
            API contracts, requirements matrices, and test suites stored securely in your Microsoft OneDrive AppFolder.
          </p>
        </div>

        {/* Project Selector & Actions */}
        <div className="flex items-center gap-3 self-end sm:self-auto flex-wrap">
          {projects.length > 1 && (
            <select
              value={activeProject?.id || ''}
              onChange={(e) => {
                const found = projects.find((p) => p.id === e.target.value);
                if (found) setActiveProject(found);
              }}
              className="text-xs bg-white border border-stone-200 rounded-md px-2.5 py-1.5 text-stone-800 focus:outline-none focus:ring-2 focus:ring-indigo-600 cursor-pointer shadow-2xs"
            >
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          )}

          {isConnected && (
            <>
              <Button
                variant="ghost"
                size="sm"
                onClick={loadFiles}
                disabled={loadingFiles}
                leftIcon={<RefreshCw className={`w-3.5 h-3.5 ${loadingFiles ? 'animate-spin' : ''}`} />}
              >
                Refresh
              </Button>

              {activeProject?.oneDriveFolder?.rootWebUrl && (
                <a
                  href={activeProject.oneDriveFolder.rootWebUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-stone-700 bg-stone-100 hover:bg-stone-200 rounded-md transition-colors"
                  title="Open Project Folder in OneDrive Web"
                >
                  <ExternalLink className="w-3.5 h-3.5 text-stone-500" />
                  <span>OneDrive Web</span>
                </a>
              )}

              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsUploadModalOpen(true)}
                leftIcon={<Upload className="w-3.5 h-3.5" />}
              >
                Upload File
              </Button>

              <Button
                variant="primary"
                size="sm"
                onClick={() => setIsNewFileModalOpen(true)}
                leftIcon={<Plus className="w-3.5 h-3.5" />}
              >
                New Spec
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Account Info Pill when connected */}
      {isConnected && account && (
        <div className="mb-6 bg-white border border-stone-200 rounded-lg p-3 px-4 shadow-[0_1px_2px_rgba(0,0,0,0.05)] flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-md bg-indigo-50 border border-indigo-200 flex items-center justify-center text-indigo-600">
              <Cloud className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-stone-900">
                  Microsoft OneDrive AppFolder
                </span>
                {isDemo && (
                  <span className="text-[10px] bg-amber-50 text-amber-700 border border-amber-200 px-1.5 py-0.2 rounded font-mono">
                    Sandbox Demo
                  </span>
                )}
              </div>
              <p className="text-[11px] text-stone-500">
                Connected account: <strong className="text-stone-700">{account.email}</strong> ({account.name})
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 text-xs">
            <span className="text-[11px] text-stone-400 font-mono hidden md:inline">
              Scope: Files.ReadWrite.AppFolder
            </span>
            <button
              type="button"
              onClick={disconnectOneDrive}
              className="text-stone-400 hover:text-stone-700 text-xs underline cursor-pointer ml-2"
            >
              Disconnect
            </button>
          </div>
        </div>
      )}

      {/* CASE 1: Expired / Revoked Token Error Prompt */}
      {oneDriveError && (
        <div className="mb-6 bg-amber-50 border border-amber-200 rounded-lg p-5 flex items-start gap-4 shadow-2xs">
          <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
          <div className="flex-1">
            <h3 className="text-sm font-semibold text-amber-900">
              Microsoft OneDrive Connection Interrupted
            </h3>
            <p className="text-xs text-amber-700 mt-1 leading-relaxed">
              {oneDriveError === 'TOKEN_REVOKED' || oneDriveError === 'TOKEN_EXPIRED'
                ? 'Your Microsoft OneDrive authorization token has expired or was revoked. Please reconnect to resume automatic synchronization of your API specifications and test suites.'
                : oneDriveError}
            </p>
            <div className="mt-3 flex items-center gap-3">
              <Button
                size="sm"
                variant="primary"
                onClick={handleConnect}
                disabled={isConnecting}
                leftIcon={<RefreshCw className={`w-3.5 h-3.5 ${isConnecting ? 'animate-spin' : ''}`} />}
              >
                Reconnect OneDrive
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={connectDemoOneDrive}
              >
                Use Demo Sandbox
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* General File Error Banner */}
      {fileError && (
        <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4 flex items-center justify-between text-xs text-red-700">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-red-500 shrink-0" />
            <span>{fileError}</span>
          </div>
          <button
            type="button"
            onClick={() => setFileError(null)}
            className="text-red-500 hover:text-red-800 font-bold ml-4"
          >
            ✕
          </button>
        </div>
      )}

      {/* CASE 2: OneDrive Not Connected State */}
      {!isConnected && (
        <div className="bg-white border border-stone-200 rounded-xl p-8 sm:p-10 shadow-[0_1px_2px_rgba(0,0,0,0.05)] max-w-3xl mx-auto my-6 text-center">
          <div className="w-14 h-14 rounded-2xl bg-indigo-50 border border-indigo-200 text-indigo-600 flex items-center justify-center mx-auto mb-5 shadow-xs">
            <Cloud className="w-7 h-7 stroke-[1.75]" />
          </div>

          <h2 className="text-xl font-bold tracking-tight text-stone-900">
            Connect your Microsoft OneDrive
          </h2>

          <p className="mt-2 text-stone-600 text-sm max-w-lg mx-auto leading-relaxed">
            CoverageAI stores your API specifications, requirement documents, and test verification suites directly in your personal or corporate Microsoft OneDrive.
          </p>

          <div className="mt-6 bg-stone-50 border border-stone-200 rounded-lg p-5 text-left max-w-xl mx-auto">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-stone-500 mb-3 flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-indigo-600" />
              Why OneDrive Connection is Required
            </h4>
            <ul className="space-y-2.5 text-xs text-stone-700">
              <li className="flex items-start gap-2.5">
                <span className="w-1.5 h-1.5 rounded-full bg-indigo-600 mt-1.5 shrink-0" />
                <span>
                  <strong>Zero Proprietary Storage:</strong> Your internal schemas and sensitive endpoint contracts live exclusively in your OneDrive, never on our database servers.
                </span>
              </li>
              <li className="flex items-start gap-2.5">
                <span className="w-1.5 h-1.5 rounded-full bg-indigo-600 mt-1.5 shrink-0" />
                <span>
                  <strong>Least-Privilege AppFolder Scope:</strong> We only request <code className="bg-stone-200 px-1 py-0.5 rounded font-mono text-[11px]">Files.ReadWrite.AppFolder</code>, granting access only to CoverageAI's dedicated subfolder — never your entire drive.
                </span>
              </li>
              <li className="flex items-start gap-2.5">
                <span className="w-1.5 h-1.5 rounded-full bg-indigo-600 mt-1.5 shrink-0" />
                <span>
                  <strong>Any Account Supported:</strong> Seamlessly connect with personal accounts (Outlook / Live / Hotmail) or work/school Microsoft 365 enterprise tenants via standard OAuth 2.0.
                </span>
              </li>
            </ul>
          </div>

          {/* Action buttons */}
          <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3">
            <Button
              variant="primary"
              size="lg"
              onClick={handleConnect}
              disabled={isConnecting}
              leftIcon={<Cloud className="w-4 h-4" />}
            >
              {isConnecting ? 'Opening Microsoft OAuth...' : 'Connect Microsoft OneDrive'}
            </Button>

            <Button
              variant="outline"
              size="lg"
              onClick={connectDemoOneDrive}
            >
              Connect with Demo Sandbox
            </Button>
          </div>

          {/* Environmental setup note if MS_CLIENT_ID is not configured */}
          {!isConfigured && (
            <div className="mt-6 text-xs text-stone-400 flex items-center justify-center gap-1.5">
              <Info className="w-3.5 h-3.5 text-stone-400" />
              <span>
                To configure live Azure AD OAuth, set <code className="bg-stone-100 px-1 py-0.5 rounded text-stone-600 font-mono">MS_CLIENT_ID</code> and <code className="bg-stone-100 px-1 py-0.5 rounded text-stone-600 font-mono">MS_CLIENT_SECRET</code> in environment settings.
              </span>
            </div>
          )}
        </div>
      )}

      {/* CASE 3: OneDrive Connected, but no project selected */}
      {isConnected && !activeProject && (
        <div className="bg-white border border-stone-200 rounded-lg p-10 text-center shadow-2xs">
          <HardDrive className="w-8 h-8 text-stone-400 mx-auto mb-3" />
          <h3 className="text-base font-semibold text-stone-900">No Active Project Selected</h3>
          <p className="text-stone-500 text-xs mt-1">
            Please select or create a project to access its OneDrive folder structure and files.
          </p>
          <div className="mt-4">
            <Button variant="primary" size="sm" onClick={() => onNavigate('projects')}>
              Go to Projects
            </Button>
          </div>
        </div>
      )}

      {/* CASE 4: OneDrive Connected & Project Selected, but folder structure not yet provisioned */}
      {isConnected && activeProject && !activeProject.oneDriveFolder && (
        <div className="bg-white border border-stone-200 rounded-lg p-8 text-center shadow-2xs mb-6">
          <div className="w-12 h-12 rounded-xl bg-indigo-50 border border-indigo-200 text-indigo-600 flex items-center justify-center mx-auto mb-4">
            <FolderOpen className="w-6 h-6" />
          </div>
          <h3 className="text-base font-bold text-stone-900">
            Initialize OneDrive Folder for {activeProject.name}
          </h3>
          <p className="text-xs text-stone-500 max-w-md mx-auto mt-1 leading-relaxed">
            Create a dedicated folder structure inside your OneDrive AppFolder for this project with subfolders for <span className="font-mono text-stone-700">apis/</span>, <span className="font-mono text-stone-700">requirements/</span>, <span className="font-mono text-stone-700">testcases/</span>, and <span className="font-mono text-stone-700">reports/</span>.
          </p>
          <div className="mt-5">
            <Button
              variant="primary"
              size="md"
              onClick={handleProvisionFolder}
              disabled={isProvisioning}
              leftIcon={<Plus className={`w-4 h-4 ${isProvisioning ? 'animate-spin' : ''}`} />}
            >
              {isProvisioning ? 'Creating Folder Structure...' : 'Create Project Folders in OneDrive'}
            </Button>
          </div>
        </div>
      )}

      {/* CASE 5: Connected & Project Has OneDrive Folder -> Clean Tree / List Explorer */}
      {isConnected && activeProject && (
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Left Column: Subfolder Tree Navigation */}
          <div className="lg:col-span-1 bg-white border border-stone-200 rounded-lg p-4 shadow-[0_1px_2px_rgba(0,0,0,0.05)] flex flex-col gap-4">
            <div className="flex items-center justify-between pb-3 border-b border-stone-100">
              <span className="text-xs font-bold uppercase tracking-wider text-stone-500">
                Project Folders
              </span>
              <span className="text-[11px] font-medium text-stone-400">
                {files.length} items
              </span>
            </div>

            {/* Folder list */}
            <div className="flex flex-col space-y-1">
              {/* All files item */}
              <button
                type="button"
                onClick={() => setSelectedCategory('all')}
                className={`w-full flex items-center justify-between px-3 py-2 rounded-md text-xs font-medium transition-colors cursor-pointer ${
                  selectedCategory === 'all'
                    ? 'bg-indigo-50 text-indigo-700 font-semibold'
                    : 'text-stone-700 hover:bg-stone-100'
                }`}
              >
                <div className="flex items-center gap-2 truncate">
                  <Folder className="w-4 h-4 text-stone-400" />
                  <span className="truncate">All Files</span>
                </div>
                <span className="text-[11px] px-1.5 py-0.5 rounded bg-stone-100 text-stone-600 font-mono">
                  {categoryCounts.all}
                </span>
              </button>

              {/* apis folder */}
              <button
                type="button"
                onClick={() => setSelectedCategory('apis')}
                className={`w-full flex items-center justify-between px-3 py-2 rounded-md text-xs font-medium transition-colors cursor-pointer ${
                  selectedCategory === 'apis'
                    ? 'bg-indigo-50 text-indigo-700 font-semibold'
                    : 'text-stone-700 hover:bg-stone-100'
                }`}
              >
                <div className="flex items-center gap-2 truncate">
                  <FileCode2 className="w-4 h-4 text-indigo-600" />
                  <span className="truncate">apis/</span>
                </div>
                <span className="text-[11px] px-1.5 py-0.5 rounded bg-stone-100 text-stone-600 font-mono">
                  {categoryCounts.apis}
                </span>
              </button>

              {/* requirements folder */}
              <button
                type="button"
                onClick={() => setSelectedCategory('requirements')}
                className={`w-full flex items-center justify-between px-3 py-2 rounded-md text-xs font-medium transition-colors cursor-pointer ${
                  selectedCategory === 'requirements'
                    ? 'bg-indigo-50 text-indigo-700 font-semibold'
                    : 'text-stone-700 hover:bg-stone-100'
                }`}
              >
                <div className="flex items-center gap-2 truncate">
                  <CheckSquare className="w-4 h-4 text-blue-600" />
                  <span className="truncate">requirements/</span>
                </div>
                <span className="text-[11px] px-1.5 py-0.5 rounded bg-stone-100 text-stone-600 font-mono">
                  {categoryCounts.requirements}
                </span>
              </button>

              {/* testcases folder */}
              <button
                type="button"
                onClick={() => setSelectedCategory('testcases')}
                className={`w-full flex items-center justify-between px-3 py-2 rounded-md text-xs font-medium transition-colors cursor-pointer ${
                  selectedCategory === 'testcases'
                    ? 'bg-indigo-50 text-indigo-700 font-semibold'
                    : 'text-stone-700 hover:bg-stone-100'
                }`}
              >
                <div className="flex items-center gap-2 truncate">
                  <FlaskConical className="w-4 h-4 text-amber-600" />
                  <span className="truncate">testcases/</span>
                </div>
                <span className="text-[11px] px-1.5 py-0.5 rounded bg-stone-100 text-stone-600 font-mono">
                  {categoryCounts.testcases}
                </span>
              </button>

              {/* reports folder */}
              <button
                type="button"
                onClick={() => setSelectedCategory('reports')}
                className={`w-full flex items-center justify-between px-3 py-2 rounded-md text-xs font-medium transition-colors cursor-pointer ${
                  selectedCategory === 'reports'
                    ? 'bg-indigo-50 text-indigo-700 font-semibold'
                    : 'text-stone-700 hover:bg-stone-100'
                }`}
              >
                <div className="flex items-center gap-2 truncate">
                  <BarChart3 className="w-4 h-4 text-emerald-600" />
                  <span className="truncate">reports/</span>
                </div>
                <span className="text-[11px] px-1.5 py-0.5 rounded bg-stone-100 text-stone-600 font-mono">
                  {categoryCounts.reports}
                </span>
              </button>
            </div>

            {/* Folder IDs Info Card */}
            {activeProject.oneDriveFolder && (
              <div className="mt-auto pt-4 border-t border-stone-100 text-[11px] text-stone-500">
                <span className="font-semibold text-stone-700 block mb-1">
                  Folder IDs in Firestore:
                </span>
                <div className="space-y-1 font-mono text-[10px] text-stone-400 truncate">
                  <div title={activeProject.oneDriveFolder.rootFolderId}>
                    root: {activeProject.oneDriveFolder.rootFolderId.slice(0, 16)}...
                  </div>
                  {activeProject.oneDriveFolder.subfolders.apis && (
                    <div title={activeProject.oneDriveFolder.subfolders.apis.id}>
                      apis: {activeProject.oneDriveFolder.subfolders.apis.id.slice(0, 16)}...
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Right Column: Files List & Explorer */}
          <div className="lg:col-span-3 flex flex-col gap-4">
            {/* Filter and breadcrumb bar */}
            <div className="bg-white border border-stone-200 rounded-lg p-3 px-4 shadow-[0_1px_2px_rgba(0,0,0,0.05)] flex items-center justify-between gap-4 flex-wrap">
              {/* Breadcrumbs */}
              <div className="flex items-center gap-1.5 text-xs text-stone-500">
                <span className="font-semibold text-stone-900">
                  {activeProject.name}
                </span>
                <ChevronRight className="w-3.5 h-3.5 text-stone-300" />
                <span className="text-stone-600 font-medium">
                  {selectedCategory === 'all' ? 'All Files' : `${selectedCategory}/`}
                </span>
              </div>

              {/* Search box */}
              <div className="relative min-w-[200px] max-w-xs">
                <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-stone-400 pointer-events-none" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Filter files by name..."
                  className="w-full text-xs pl-8 pr-3 py-1.5 bg-stone-50 border border-stone-200 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-600 focus:bg-white transition-colors"
                />
              </div>
            </div>

            {/* Files Table / List */}
            <div className="bg-white border border-stone-200 rounded-lg shadow-[0_1px_2px_rgba(0,0,0,0.05)] overflow-hidden">
              {loadingFiles ? (
                <div className="py-16 text-center text-xs text-stone-500 flex flex-col items-center justify-center gap-2">
                  <RefreshCw className="w-5 h-5 text-indigo-600 animate-spin" />
                  <span>Loading files from Microsoft OneDrive...</span>
                </div>
              ) : filteredFiles.length === 0 ? (
                <div className="py-16 text-center text-xs text-stone-400 flex flex-col items-center justify-center gap-2">
                  <Folder className="w-8 h-8 stroke-[1.25] text-stone-300" />
                  <span className="font-medium text-stone-600">No files found</span>
                  <p className="text-[11px] text-stone-400 max-w-xs">
                    {searchQuery
                      ? 'No files matching your search filter.'
                      : 'Upload a contract file or create a new OpenAPI specification to get started.'}
                  </p>
                  <div className="mt-3 flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setIsUploadModalOpen(true)}
                    >
                      Upload File
                    </Button>
                    <Button
                      size="sm"
                      variant="primary"
                      onClick={() => setIsNewFileModalOpen(true)}
                    >
                      New Spec
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-stone-100 bg-stone-50/75 text-[11px] font-semibold text-stone-500 uppercase tracking-wider">
                        <th className="py-2.5 px-4">Name</th>
                        <th className="py-2.5 px-3">Subfolder</th>
                        <th className="py-2.5 px-3">Size</th>
                        <th className="py-2.5 px-3">Last Modified</th>
                        <th className="py-2.5 px-4 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-stone-100 text-xs">
                      {filteredFiles.map((file) => (
                        <tr
                          key={file.id}
                          className="hover:bg-stone-50/70 transition-colors group"
                        >
                          <td className="py-3 px-4">
                            <div className="flex items-center gap-2.5 min-w-0">
                              <span className="shrink-0">
                                {getFileIcon(file.name, Boolean(file.folder))}
                              </span>
                              <span
                                className="font-medium text-stone-900 truncate hover:text-indigo-600 cursor-pointer"
                                onClick={() => setPreviewFile(file)}
                                title={file.name}
                              >
                                {file.name}
                              </span>
                            </div>
                          </td>
                          <td className="py-3 px-3">
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium bg-stone-100 text-stone-700 font-mono">
                              {file.category || 'root'}
                            </span>
                          </td>
                          <td className="py-3 px-3 text-stone-500 font-mono text-[11px]">
                            {file.folder ? '-' : formatFileSize(file.size)}
                          </td>
                          <td className="py-3 px-3 text-stone-500 text-[11px]">
                            {formatDate(file.lastModifiedDateTime)}
                          </td>
                          <td className="py-3 px-4 text-right">
                            <div className="flex items-center justify-end gap-2">
                              {file.webUrl && (
                                <a
                                  href={file.webUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="inline-flex items-center gap-1 text-[11px] font-semibold text-indigo-600 hover:text-indigo-800 bg-indigo-50 hover:bg-indigo-100 px-2 py-1 rounded transition-colors"
                                  title="Open in Microsoft OneDrive Web"
                                >
                                  <span>Open in OneDrive</span>
                                  <ExternalLink className="w-3 h-3" />
                                </a>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* MODAL 1: Create New Specification File */}
      <Modal
        isOpen={isNewFileModalOpen}
        onClose={() => setIsNewFileModalOpen(false)}
        title="Create Specification File"
        description="Author an API contract, requirement, or test fixture directly in OneDrive."
      >
        <form onSubmit={handleCreateFile} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-stone-700 mb-1">
              Target Subfolder
            </label>
            <select
              value={newFileCategory}
              onChange={(e) =>
                setNewFileCategory(
                  e.target.value as 'apis' | 'requirements' | 'testcases' | 'reports'
                )
              }
              className="w-full text-xs bg-white border border-stone-200 rounded-md p-2 text-stone-900 focus:ring-2 focus:ring-indigo-600 focus:outline-none"
            >
              <option value="apis">apis/ (OpenAPI 3.1, JSON Schemas, GraphQL)</option>
              <option value="requirements">requirements/ (Acceptance Criteria, PRD specs)</option>
              <option value="testcases">testcases/ (E2E Suites, Boundary Fixtures)</option>
              <option value="reports">reports/ (Execution Logs, Drift Analyses)</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-stone-700 mb-1">
              File Name
            </label>
            <input
              type="text"
              required
              value={newFileName}
              onChange={(e) => setNewFileName(e.target.value)}
              placeholder="e.g. billing-v2.yaml or requirements.md"
              className="w-full text-xs bg-white border border-stone-200 rounded-md p-2 text-stone-900 focus:ring-2 focus:ring-indigo-600 focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-stone-700 mb-1">
              Initial Content
            </label>
            <textarea
              rows={8}
              value={newFileContent}
              onChange={(e) => setNewFileContent(e.target.value)}
              className="w-full text-xs font-mono bg-stone-50 border border-stone-200 rounded-md p-2.5 text-stone-900 focus:ring-2 focus:ring-indigo-600 focus:outline-none leading-relaxed"
            />
          </div>

          <div className="pt-2 flex justify-end gap-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setIsNewFileModalOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              size="sm"
              disabled={isSubmittingFile}
            >
              {isSubmittingFile ? 'Saving to OneDrive...' : 'Save to OneDrive'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* MODAL 2: Upload File to OneDrive */}
      <Modal
        isOpen={isUploadModalOpen}
        onClose={() => setIsUploadModalOpen(false)}
        title="Upload File to OneDrive"
        description="Upload your local API contracts, requirements, or test artifacts."
      >
        <form onSubmit={handleUploadSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-stone-700 mb-1">
              Destination Folder
            </label>
            <select
              value={uploadCategory}
              onChange={(e) =>
                setUploadCategory(
                  e.target.value as 'apis' | 'requirements' | 'testcases' | 'reports'
                )
              }
              className="w-full text-xs bg-white border border-stone-200 rounded-md p-2 text-stone-900 focus:ring-2 focus:ring-indigo-600 focus:outline-none"
            >
              <option value="apis">apis/ (OpenAPI, JSON Schema, Protobuf)</option>
              <option value="requirements">requirements/ (Markdown, Word, Excel)</option>
              <option value="testcases">testcases/ (Test Suites, Payloads)</option>
              <option value="reports">reports/ (Logs, Summaries)</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-stone-700 mb-1">
              Select File
            </label>
            <input
              type="file"
              required
              onChange={(e) => setUploadTargetFile(e.target.files?.[0] || null)}
              className="w-full text-xs text-stone-600 file:mr-3 file:py-1.5 file:px-3 file:rounded-md file:border-0 file:text-xs file:font-semibold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100 cursor-pointer"
            />
          </div>

          <div className="pt-2 flex justify-end gap-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setIsUploadModalOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              size="sm"
              disabled={isUploading || !uploadTargetFile}
            >
              {isUploading ? 'Uploading...' : 'Upload to OneDrive'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* MODAL 3: File Details & Quick Preview */}
      {previewFile && (
        <Modal
          isOpen={Boolean(previewFile)}
          onClose={() => setPreviewFile(null)}
          title={previewFile.name}
          description={`OneDrive File • ${formatFileSize(previewFile.size)} • ${previewFile.category || 'root'} folder`}
        >
          <div className="space-y-4">
            <div className="bg-stone-50 border border-stone-200 rounded-lg p-3 text-xs space-y-2">
              <div className="flex justify-between">
                <span className="text-stone-500">File ID:</span>
                <span className="font-mono text-[11px] text-stone-800">{previewFile.id}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-stone-500">Last Modified:</span>
                <span className="text-stone-800">{formatDate(previewFile.lastModifiedDateTime)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-stone-500">Storage Location:</span>
                <span className="text-stone-800 font-semibold">
                  Microsoft OneDrive / CoverageAI - {activeProject?.name} / {previewFile.category}
                </span>
              </div>
            </div>

            <div className="flex justify-between items-center pt-2">
              <span className="text-xs text-stone-500">
                Open in official Microsoft Office or OneDrive web viewer:
              </span>
              <a
                href={previewFile.webUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-md shadow-xs transition-colors"
              >
                <span>Open in OneDrive Web</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
