import { useState, useEffect, useMemo } from 'react';
import type { ApiReference, ApiSpec, NavigationView } from '../../types';
import { useProjects } from '../../context/ProjectContext';
import { useOneDrive } from '../../context/OneDriveContext';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../ui/Toast';
import {
  fetchProjectApiReferences,
  fetchApiSpec,
  saveApiRecord,
  deleteApiRecord,
} from '../../lib/apiStorage';
import { ApiCard } from '../apis/ApiCard';
import { ApiFormModal } from '../apis/ApiFormModal';
import { ApiDetailView } from '../apis/ApiDetailView';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import {
  FileCode2,
  Plus,
  Search,
  Cloud,
  CloudOff,
  ExternalLink,
  Layers,
  Filter,
  RefreshCw,
  FolderGit2,
  AlertCircle,
  CheckCircle2,
} from 'lucide-react';

interface ApisViewProps {
  onNavigate: (view: NavigationView) => void;
}

export function ApisView({ onNavigate }: ApisViewProps) {
  const { activeProject, projects, setActiveProject, updateProjectApiCount } = useProjects();
  const { isConnected, isDemo, uploadFile } = useOneDrive();
  const { user } = useAuth();
  const { showToast } = useToast();

  // State
  const [apiReferences, setApiReferences] = useState<ApiReference[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [authFilter, setAuthFilter] = useState<string>('ALL');

  // Detail View State
  const [selectedApiId, setSelectedApiId] = useState<string | null>(null);
  const [currentSpec, setCurrentSpec] = useState<ApiSpec | null>(null);
  const [detailLoading, setDetailLoading] = useState<boolean>(false);

  // Form Modal State
  const [isFormModalOpen, setIsFormModalOpen] = useState<boolean>(false);
  const [editingSpec, setEditingSpec] = useState<ApiSpec | null>(null);
  const [isSaving, setIsSaving] = useState<boolean>(false);

  // Delete Confirmation Modal State
  const [deleteTarget, setDeleteTarget] = useState<ApiReference | ApiSpec | null>(null);
  const [isDeleting, setIsDeleting] = useState<boolean>(false);

  // Load API references when activeProject changes
  const loadApis = async () => {
    if (!activeProject) return;
    setLoading(true);
    try {
      const refs = await fetchProjectApiReferences(activeProject.id, activeProject.name);
      setApiReferences(refs);
      updateProjectApiCount(activeProject.id, refs.length);
    } catch (err: any) {
      showToast({
        type: 'error',
        title: 'Failed to load APIs',
        description: err.message || 'Could not retrieve specifications.',
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadApis();
    // Reset selected API if switching projects
    setSelectedApiId(null);
    setCurrentSpec(null);
  }, [activeProject?.id]);

  // Load full spec when an API is selected
  const handleSelectApi = async (api: ApiReference) => {
    if (!activeProject) return;
    setSelectedApiId(api.id);
    setDetailLoading(true);
    try {
      const full = await fetchApiSpec(activeProject.id, api.id);
      if (full) {
        setCurrentSpec(full);
      } else {
        // Build fallback spec from reference if not in cache
        const fallback: ApiSpec = {
          id: api.id,
          projectId: activeProject.id,
          name: api.name,
          baseUrl: api.baseUrl,
          version: '1.0.0',
          authType: api.authType,
          businessRules: '• Standard enterprise compliance constraints apply.',
          validationRules: '• Strict payload validation enabled.',
          endpoints: [
            {
              id: `ep_fallback_${Date.now()}`,
              method: 'GET',
              path: '/v1/resource',
              summary: 'Query Resource Details',
              responseStatusCode: 200,
              responseSchema: '{\n  "status": "active"\n}',
              errorResponses: [
                { id: 'err_1', statusCode: 400, name: 'Bad Request', description: 'Invalid query parameters' }
              ]
            }
          ],
          oneDriveItemId: api.oneDriveItemId,
          oneDriveWebUrl: api.oneDriveWebUrl,
          createdAt: api.createdAt,
          updatedAt: api.updatedAt,
          sourceType: 'manual',
          description: api.description,
        };
        setCurrentSpec(fallback);
      }
    } catch (err: any) {
      showToast({
        type: 'error',
        title: 'Error loading specification',
        description: err.message || 'Could not fetch full API details.',
      });
    } finally {
      setDetailLoading(false);
    }
  };

  // Open Edit Form
  const handleEditApi = async (item: ApiReference | ApiSpec) => {
    if (!activeProject) return;
    setIsSaving(false);

    // If it's already a full spec
    if ('endpoints' in item) {
      setEditingSpec(item);
      setIsFormModalOpen(true);
      return;
    }

    // Otherwise load full spec first
    try {
      const full = await fetchApiSpec(activeProject.id, item.id);
      setEditingSpec(full || {
        id: item.id,
        projectId: activeProject.id,
        name: item.name,
        baseUrl: item.baseUrl,
        version: '1.0.0',
        authType: item.authType,
        businessRules: '',
        validationRules: '',
        endpoints: [],
        createdAt: item.createdAt,
        updatedAt: item.updatedAt,
        sourceType: 'manual',
      });
      setIsFormModalOpen(true);
    } catch (err) {
      showToast({
        type: 'error',
        title: 'Edit Error',
        description: 'Failed to retrieve specification for editing.',
      });
    }
  };

  // Handle Save (Both Create and Edit)
  const handleSaveApi = async (specToSave: ApiSpec) => {
    if (!activeProject) return;
    setIsSaving(true);

    try {
      let oneDriveMetadata: { itemId?: string; webUrl?: string } = {};

      // Upload JSON file named after the API into OneDrive "apis" folder
      const safeFileName = `${specToSave.name.replace(/[^a-zA-Z0-9_-]/g, '_')}.json`;
      const apisFolderId =
        activeProject.oneDriveFolder?.subfolders.apis?.id ||
        activeProject.oneDriveFolder?.rootFolderId ||
        'root';

      const specJsonString = JSON.stringify(specToSave, null, 2);

      try {
        const uploaded = await uploadFile(
          activeProject.id,
          apisFolderId,
          'apis',
          safeFileName,
          specJsonString
        );
        if (uploaded) {
          oneDriveMetadata = {
            itemId: uploaded.id,
            webUrl: uploaded.webUrl,
          };
        }
      } catch (uploadErr) {
        console.warn('OneDrive upload failed or not connected, continuing local/cloud save:', uploadErr);
      }

      // Save lightweight reference & spec in Firestore and Local Storage
      const { reference, spec: finalSpec } = await saveApiRecord(
        activeProject.id,
        specToSave,
        oneDriveMetadata
      );

      // Update local state
      setApiReferences((prev) => {
        const idx = prev.findIndex((r) => r.id === reference.id);
        if (idx >= 0) {
          const updated = [...prev];
          updated[idx] = reference;
          return updated;
        }
        return [reference, ...prev];
      });

      updateProjectApiCount(
        activeProject.id,
        apiReferences.some((r) => r.id === reference.id)
          ? apiReferences.length
          : apiReferences.length + 1
      );

      if (selectedApiId === reference.id) {
        setCurrentSpec(finalSpec);
      }

      setIsFormModalOpen(false);
      setEditingSpec(null);

      showToast({
        type: 'success',
        title: editingSpec ? 'Specification Updated' : 'Specification Created',
        description: `Saved to OneDrive "apis/${safeFileName}" & indexed in Firestore.`,
      });
    } catch (err: any) {
      showToast({
        type: 'error',
        title: 'Save Failed',
        description: err.message || 'Could not save API specification.',
      });
    } finally {
      setIsSaving(false);
    }
  };

  // Handle Delete Confirmation
  const handleDeleteConfirm = async () => {
    if (!activeProject || !deleteTarget) return;
    setIsDeleting(true);

    try {
      await deleteApiRecord(activeProject.id, deleteTarget.id);

      const nextRefs = apiReferences.filter((r) => r.id !== deleteTarget.id);
      setApiReferences(nextRefs);
      updateProjectApiCount(activeProject.id, nextRefs.length);

      if (selectedApiId === deleteTarget.id) {
        setSelectedApiId(null);
        setCurrentSpec(null);
      }

      setDeleteTarget(null);
      showToast({
        type: 'info',
        title: 'API Specification Removed',
        description: `"${deleteTarget.name}" was successfully deleted.`,
      });
    } catch (err: any) {
      showToast({
        type: 'error',
        title: 'Delete Failed',
        description: err.message || 'Could not delete specification.',
      });
    } finally {
      setIsDeleting(false);
    }
  };

  // Filtered APIs list
  const filteredApis = useMemo(() => {
    return apiReferences.filter((api) => {
      const matchesSearch =
        api.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        api.baseUrl.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (api.description && api.description.toLowerCase().includes(searchQuery.toLowerCase()));

      const matchesAuth =
        authFilter === 'ALL' || api.authType.toLowerCase() === authFilter.toLowerCase();

      return matchesSearch && matchesAuth;
    });
  }, [apiReferences, searchQuery, authFilter]);

  // If no project is selected
  if (!activeProject) {
    return (
      <div className="flex flex-col items-center justify-center py-20 px-4 text-center max-w-md mx-auto">
        <div className="w-12 h-12 rounded-xl bg-stone-100 border border-stone-200 flex items-center justify-center text-stone-500 mb-4">
          <FolderGit2 className="w-6 h-6 stroke-[1.75]" />
        </div>
        <h3 className="text-base font-bold text-stone-900 mb-1">No Active Project Selected</h3>
        <p className="text-xs text-stone-500 mb-6 leading-relaxed">
          API specifications are isolated within individual project workspaces. Please select an existing project or create one to begin authoring contracts.
        </p>

        {projects.length > 0 ? (
          <div className="w-full space-y-2">
            <span className="text-[11px] font-semibold text-stone-400 uppercase tracking-wider block mb-2">
              Select a workspace:
            </span>
            {projects.slice(0, 3).map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => setActiveProject(p)}
                className="w-full text-left p-3 rounded-lg border border-stone-200 hover:border-indigo-600 bg-white hover:bg-stone-50 transition-colors flex items-center justify-between text-xs"
              >
                <span className="font-semibold text-stone-800">{p.name}</span>
                <span className="text-stone-400 font-mono text-[11px]">{p.stats.apiCount} APIs</span>
              </button>
            ))}
          </div>
        ) : (
          <Button variant="primary" size="sm" onClick={() => onNavigate('projects')}>
            Go to Projects
          </Button>
        )}
      </div>
    );
  }

  // If Detail View is active
  if (selectedApiId) {
    if (detailLoading || !currentSpec) {
      return (
        <div className="flex flex-col items-center justify-center py-24 text-stone-400 text-xs gap-2">
          <RefreshCw className="w-5 h-5 animate-spin text-indigo-600" />
          <span>Loading specification details from workspace...</span>
        </div>
      );
    }

    const currentRef = apiReferences.find((r) => r.id === selectedApiId);

    return (
      <>
        <ApiDetailView
          spec={currentSpec}
          coverageStatus={currentRef?.coverageStatus}
          onBack={() => {
            setSelectedApiId(null);
            setCurrentSpec(null);
          }}
          onEdit={(spec) => handleEditApi(spec)}
          onDelete={(spec) => setDeleteTarget(spec)}
        />

        {/* Edit Modal from Detail View */}
        {isFormModalOpen && (
          <ApiFormModal
            isOpen={isFormModalOpen}
            onClose={() => {
              setIsFormModalOpen(false);
              setEditingSpec(null);
            }}
            onSave={handleSaveApi}
            initialSpec={editingSpec}
            activeProject={activeProject}
            isSaving={isSaving}
          />
        )}

        {/* Delete Confirmation Modal */}
        {deleteTarget && (
          <Modal
            isOpen={Boolean(deleteTarget)}
            onClose={() => setDeleteTarget(null)}
            title="Delete API Specification"
            description="This will permanently delete this API specification from the workspace."
          >
            <p className="text-xs text-stone-600 mb-4 leading-relaxed">
              Are you sure you want to delete <strong>{deleteTarget.name}</strong>? All associated endpoints, request schemas, and error definitions will be removed from Firestore and local cache.
            </p>
            <div className="flex justify-end gap-2">
              <Button variant="ghost" size="sm" onClick={() => setDeleteTarget(null)}>
                Cancel
              </Button>
              <Button
                variant="primary"
                size="sm"
                onClick={handleDeleteConfirm}
                disabled={isDeleting}
                className="bg-rose-600 hover:bg-rose-700"
              >
                {isDeleting ? 'Deleting...' : 'Confirm Delete'}
              </Button>
            </div>
          </Modal>
        )}
      </>
    );
  }

  // List View
  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Header Section */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-stone-200">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <h1 className="text-lg font-bold text-stone-900 tracking-tight">
              API Specifications
            </h1>
            <span className="text-xs font-mono font-semibold bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded border border-indigo-200">
              {apiReferences.length} Total
            </span>
          </div>
          <p className="text-xs text-stone-500">
            Project: <strong className="text-stone-800">{activeProject.name}</strong> • Stored as JSON files in OneDrive <code className="font-mono text-stone-700 bg-stone-100 px-1 py-0.5 rounded">apis/</code> folder
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          {activeProject.oneDriveFolder?.subfolders.apis?.webUrl && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => window.open(activeProject.oneDriveFolder?.subfolders.apis?.webUrl, '_blank')}
              leftIcon={<Cloud className="w-3.5 h-3.5 text-indigo-600" />}
              rightIcon={<ExternalLink className="w-3 h-3 text-stone-400" />}
            >
              Open OneDrive apis/
            </Button>
          )}

          <Button
            variant="primary"
            size="sm"
            onClick={() => {
              setEditingSpec(null);
              setIsFormModalOpen(true);
            }}
            leftIcon={<Plus className="w-4 h-4" />}
          >
            Add API
          </Button>
        </div>
      </div>

      {/* OneDrive Sync Banner */}
      <div className="bg-stone-50 border border-stone-200 rounded-lg p-3.5 flex items-center justify-between text-xs flex-wrap gap-3">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-md bg-indigo-50 border border-indigo-200 flex items-center justify-center text-indigo-600 shrink-0">
            <Cloud className="w-4 h-4" />
          </div>
          <div>
            <div className="font-semibold text-stone-900 flex items-center gap-1.5">
              <span>Microsoft OneDrive AppFolder Synchronization</span>
              {isConnected ? (
                <span className="inline-flex items-center gap-1 text-[11px] text-emerald-700 font-medium">
                  <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                  {isDemo ? 'Demo Mode Active' : 'Connected'}
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 text-[11px] text-stone-500">
                  <CloudOff className="w-3 h-3 text-stone-400" />
                  Offline Storage
                </span>
              )}
            </div>
            <p className="text-[11px] text-stone-500">
              Each API specification is saved as a complete JSON document into <code className="font-mono text-stone-700">CoverageAI - {activeProject.name}/apis/*.json</code> via Microsoft Graph REST API.
            </p>
          </div>
        </div>

        {!isConnected && (
          <Button variant="outline" size="sm" onClick={() => onNavigate('files')}>
            Connect OneDrive
          </Button>
        )}
      </div>

      {/* Search & Filter Controls */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="relative w-full sm:w-80">
          <Search className="w-3.5 h-3.5 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search APIs by name, route, or URL..."
            className="w-full text-xs pl-8 pr-3 py-1.5 bg-white border border-stone-200 rounded-md text-stone-900 focus:ring-2 focus:ring-indigo-600 focus:outline-none"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
          <div className="flex items-center gap-1.5 text-xs text-stone-500">
            <Filter className="w-3.5 h-3.5 text-stone-400" />
            <span className="font-medium">Auth:</span>
            <select
              value={authFilter}
              onChange={(e) => setAuthFilter(e.target.value)}
              className="text-xs bg-white border border-stone-200 rounded-md p-1 text-stone-800 focus:outline-none focus:ring-1 focus:ring-indigo-600 font-mono"
            >
              <option value="ALL">All Auth Types</option>
              <option value="bearer">Bearer JWT</option>
              <option value="apiKey">API Key</option>
              <option value="oauth2">OAuth 2.0</option>
              <option value="basic">Basic Auth</option>
              <option value="none">Public / None</option>
            </select>
          </div>

          <Button variant="ghost" size="sm" onClick={loadApis} title="Refresh list">
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </div>

      {/* APIs Grid or Empty State */}
      {loading ? (
        <div className="py-20 text-center text-xs text-stone-400 flex flex-col items-center gap-2">
          <RefreshCw className="w-5 h-5 animate-spin text-indigo-600" />
          <span>Loading API specifications...</span>
        </div>
      ) : filteredApis.length === 0 ? (
        <div className="border border-dashed border-stone-200 rounded-xl p-12 text-center bg-white">
          <div className="w-10 h-10 rounded-lg bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 mx-auto mb-3">
            <FileCode2 className="w-5 h-5" />
          </div>
          <h3 className="text-sm font-bold text-stone-900 mb-1">
            {searchQuery || authFilter !== 'ALL' ? 'No Matching Specifications' : 'No API Specifications Yet'}
          </h3>
          <p className="text-xs text-stone-500 max-w-sm mx-auto mb-4 leading-relaxed">
            {searchQuery || authFilter !== 'ALL'
              ? 'Try modifying your search query or auth filter to locate specifications.'
              : 'Add an API contract by uploading/pasting an OpenAPI (Swagger) document or manually defining endpoints.'}
          </p>
          <Button
            variant="primary"
            size="sm"
            onClick={() => {
              setEditingSpec(null);
              setIsFormModalOpen(true);
            }}
            leftIcon={<Plus className="w-3.5 h-3.5" />}
          >
            Add First API
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredApis.map((api) => (
            <ApiCard
              key={api.id}
              api={api}
              onSelect={handleSelectApi}
              onEdit={handleEditApi}
              onDelete={(target) => setDeleteTarget(target)}
            />
          ))}
        </div>
      )}

      {/* Form Modal (Create or Edit) */}
      {isFormModalOpen && (
        <ApiFormModal
          isOpen={isFormModalOpen}
          onClose={() => {
            setIsFormModalOpen(false);
            setEditingSpec(null);
          }}
          onSave={handleSaveApi}
          initialSpec={editingSpec}
          activeProject={activeProject}
          isSaving={isSaving}
        />
      )}

      {/* Delete Confirmation Modal */}
      {deleteTarget && (
        <Modal
          isOpen={Boolean(deleteTarget)}
          onClose={() => setDeleteTarget(null)}
          title="Delete API Specification"
          description="This action cannot be undone."
        >
          <p className="text-xs text-stone-600 mb-4 leading-relaxed">
            Are you sure you want to delete <strong>{deleteTarget.name}</strong>? The specification reference will be removed from the project index.
          </p>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" size="sm" onClick={() => setDeleteTarget(null)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={handleDeleteConfirm}
              disabled={isDeleting}
              className="bg-rose-600 hover:bg-rose-700"
            >
              {isDeleting ? 'Deleting...' : 'Confirm Delete'}
            </Button>
          </div>
        </Modal>
      )}
    </div>
  );
}
