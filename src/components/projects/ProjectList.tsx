import { useState, useMemo } from 'react';
import type { Project, NavigationView } from '../../types';
import { useProjects } from '../../context/ProjectContext';
import { ProjectCard } from './ProjectCard';
import { ProjectModal } from './ProjectModal';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { useToast } from '../ui/Toast';
import { formatRelativeTime } from '../../lib/utils';
import {
  LayoutGrid,
  Table as TableIcon,
  Search,
  Plus,
  FolderGit2,
  Trash2,
  AlertTriangle,
  Globe,
  Clock,
  MoreVertical,
  Edit2,
  ExternalLink,
  Check,
} from 'lucide-react';
import { Dropdown, DropdownItem } from '../ui/Dropdown';

interface ProjectListProps {
  onNavigateView?: (view: NavigationView) => void;
}

export function ProjectList({ onNavigateView }: ProjectListProps) {
  const {
    projects,
    activeProject,
    setActiveProject,
    deleteProject,
    isCreateModalOpen,
    openCreateModal,
    closeCreateModal,
    editingProject,
    openEditModal,
    closeEditModal,
  } = useProjects();

  const { showToast } = useToast();

  const [viewMode, setViewMode] = useState<'grid' | 'table'>('grid');
  const [searchQuery, setSearchQuery] = useState('');
  const [projectToDelete, setProjectToDelete] = useState<Project | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Filtered projects
  const filteredProjects = useMemo(() => {
    if (!searchQuery.trim()) return projects;
    const q = searchQuery.toLowerCase();
    return projects.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        p.description?.toLowerCase().includes(q) ||
        p.targetEnvironmentUrl?.toLowerCase().includes(q)
    );
  }, [projects, searchQuery]);

  const handleSelectProject = (project: Project) => {
    setActiveProject(project);
    showToast({
      type: 'info',
      title: 'Active project switched',
      description: `Switched workspace to "${project.name}"`,
    });
  };

  const handleConfirmDelete = async () => {
    if (!projectToDelete) return;
    setIsDeleting(true);
    try {
      await deleteProject(projectToDelete.id);
      showToast({
        type: 'success',
        title: 'Project deleted',
        description: `Project "${projectToDelete.name}" has been removed.`,
      });
      setProjectToDelete(null);
    } catch (err) {
      console.error('Failed to delete project:', err);
      showToast({
        type: 'error',
        title: 'Deletion failed',
        description: 'Unable to remove project. Please try again.',
      });
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="flex flex-col">
      {/* Heading & View Mode Switcher */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-stone-900">Projects</h1>
          <p className="text-stone-500 text-sm mt-1">
            Manage your API verification environments and specifications.
          </p>
        </div>

        <div className="flex items-center gap-3 self-end sm:self-auto">
          {/* Grid / Table Toggle */}
          <div className="flex bg-stone-200 p-0.5 rounded-md">
            <button
              type="button"
              onClick={() => setViewMode('grid')}
              className={`px-3 py-1 text-xs font-medium rounded transition-colors cursor-pointer ${
                viewMode === 'grid'
                  ? 'bg-white text-stone-900 shadow-xs'
                  : 'text-stone-500 hover:text-stone-900'
              }`}
            >
              Grid
            </button>
            <button
              type="button"
              onClick={() => setViewMode('table')}
              className={`px-3 py-1 text-xs font-medium rounded transition-colors cursor-pointer ${
                viewMode === 'table'
                  ? 'bg-white text-stone-900 shadow-xs'
                  : 'text-stone-500 hover:text-stone-900'
              }`}
            >
              Table
            </button>
          </div>
        </div>
      </div>

      {/* Filter bar */}
      <div className="mb-6 max-w-md">
        <div className="relative w-full">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-stone-400 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Filter specifications by name, environment, or scope..."
            className="w-full h-9 pl-9 pr-3 text-xs bg-white border border-stone-200 rounded-lg text-stone-900 placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-indigo-600 focus:border-transparent transition-colors hover:border-stone-300 shadow-2xs"
          />
        </div>
      </div>

      {/* Empty State */}
      {projects.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 px-4 text-center bg-white rounded-xl border border-stone-200 shadow-2xs">
          <div className="w-12 h-12 rounded-xl bg-stone-100 border border-stone-200 flex items-center justify-center text-stone-500 mb-4">
            <FolderGit2 className="w-6 h-6 stroke-[1.5]" />
          </div>
          <h3 className="text-sm font-semibold text-stone-900">No QA projects found</h3>
          <p className="mt-1 text-xs text-stone-500 max-w-sm leading-relaxed">
            Create an isolated project workspace to manage API schemas, functional requirements, and automated test suites.
          </p>
          <div className="mt-6">
            <Button
              variant="primary"
              size="md"
              onClick={openCreateModal}
              leftIcon={<Plus className="w-4 h-4" />}
            >
              Create your first Project
            </Button>
          </div>
        </div>
      ) : filteredProjects.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 px-4 text-center bg-white rounded-xl border border-stone-200">
          <p className="text-xs text-stone-500">
            No projects matching query &quot;<span className="font-semibold text-stone-800">{searchQuery}</span>&quot;
          </p>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setSearchQuery('')}
            className="mt-3 text-xs"
          >
            Clear Search Filter
          </Button>
        </div>
      ) : viewMode === 'grid' ? (
        /* Grid View: 2 columns gap-6 */
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {filteredProjects.map((project) => (
            <ProjectCard
              key={project.id}
              project={project}
              isActive={activeProject?.id === project.id}
              onSelect={handleSelectProject}
              onEdit={openEditModal}
              onDeleteRequest={setProjectToDelete}
            />
          ))}

          {/* Dashed Create New Project card from design */}
          <div
            onClick={openCreateModal}
            className="border-2 border-dashed border-stone-200 rounded-lg flex flex-col items-center justify-center p-8 text-stone-400 hover:border-stone-300 hover:text-stone-500 cursor-pointer min-h-[220px] transition-colors"
          >
            <div className="w-10 h-10 border-2 border-current rounded-full flex items-center justify-center mb-3">
              <Plus className="w-5 h-5 stroke-[2.5]" />
            </div>
            <span className="text-xs font-semibold">Create New Project</span>
          </div>
        </div>
      ) : (
        /* Table View */
        <div className="bg-white rounded-xl border border-stone-200 overflow-hidden shadow-2xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-stone-50/80 border-b border-stone-200 text-stone-500 font-medium select-none">
                <tr>
                  <th className="py-3 px-4">Project Name & Scope</th>
                  <th className="py-3 px-4">Target Environment</th>
                  <th className="py-3 px-4">Specs & Suites</th>
                  <th className="py-3 px-4">Updated</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {filteredProjects.map((project) => {
                  const isActive = activeProject?.id === project.id;
                  return (
                    <tr
                      key={project.id}
                      className={`hover:bg-stone-50/60 transition-colors ${
                        isActive ? 'bg-indigo-50/30' : ''
                      }`}
                    >
                      <td className="py-3.5 px-4 max-w-xs">
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => handleSelectProject(project)}
                            className="font-semibold text-stone-900 hover:text-indigo-600 truncate text-left"
                          >
                            {project.name}
                          </button>
                          {isActive && (
                            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-indigo-50 text-indigo-700 border border-indigo-200 shrink-0">
                              <Check className="w-2.5 h-2.5" />
                              Active
                            </span>
                          )}
                        </div>
                        {project.description && (
                          <p className="text-stone-500 text-[11px] truncate mt-0.5">
                            {project.description}
                          </p>
                        )}
                      </td>

                      <td className="py-3.5 px-4">
                        {project.targetEnvironmentUrl ? (
                          <div className="flex items-center gap-1.5 font-mono text-[11px] text-stone-600">
                            <Globe className="w-3 h-3 text-stone-400 shrink-0" />
                            <span className="truncate max-w-[180px]">
                              {project.targetEnvironmentUrl.replace(/^https?:\/\//, '')}
                            </span>
                          </div>
                        ) : (
                          <span className="text-stone-400 text-[11px] italic">Undefined</span>
                        )}
                      </td>

                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-3 text-[11px] text-stone-600">
                          <span>
                            <strong className="text-stone-900">{project.stats?.apiCount ?? 0}</strong> APIs
                          </span>
                          <span>
                            <strong className="text-stone-900">{project.stats?.requirementCount ?? 0}</strong> Req
                          </span>
                          <span>
                            <strong className="text-stone-900">{project.stats?.testCaseCount ?? 0}</strong> Tests
                          </span>
                        </div>
                      </td>

                      <td className="py-3.5 px-4 text-stone-500 text-[11px] whitespace-nowrap">
                        <div className="flex items-center gap-1">
                          <Clock className="w-3 h-3 text-stone-400" />
                          <span>{formatRelativeTime(project.updatedAt)}</span>
                        </div>
                      </td>

                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleSelectProject(project)}
                            className="h-7 px-2 text-xs"
                          >
                            {isActive ? 'Active' : 'Select'}
                          </Button>
                          <Dropdown
                            align="right"
                            trigger={({ toggle }) => (
                              <button
                                type="button"
                                onClick={toggle}
                                className="p-1 text-stone-400 hover:text-stone-700 rounded hover:bg-stone-100"
                              >
                                <MoreVertical className="w-4 h-4" />
                              </button>
                            )}
                          >
                            {({ close }) => (
                              <>
                                <DropdownItem
                                  icon={<Edit2 className="w-3.5 h-3.5" />}
                                  onClick={() => {
                                    close();
                                    openEditModal(project);
                                  }}
                                >
                                  Edit Specs
                                </DropdownItem>
                                <div className="my-1 border-t border-stone-100" />
                                <DropdownItem
                                  destructive
                                  icon={<Trash2 className="w-3.5 h-3.5" />}
                                  onClick={() => {
                                    close();
                                    setProjectToDelete(project);
                                  }}
                                >
                                  Delete Project
                                </DropdownItem>
                              </>
                            )}
                          </Dropdown>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Create / Edit Project Modal */}
      <ProjectModal
        isOpen={isCreateModalOpen || Boolean(editingProject)}
        onClose={() => {
          closeCreateModal();
          closeEditModal();
        }}
        projectToEdit={editingProject}
      />

      {/* Delete Confirmation Modal */}
      <Modal
        isOpen={Boolean(projectToDelete)}
        onClose={() => setProjectToDelete(null)}
        title="Delete Project Workspace"
        maxWidth="sm"
      >
        <div className="flex flex-col gap-3">
          <div className="flex items-start gap-3 p-3 bg-red-50 rounded-lg border border-red-100 text-red-800 text-xs">
            <AlertTriangle className="w-4 h-4 shrink-0 text-red-600 mt-0.5" />
            <div>
              <p className="font-medium">Permanent Action</p>
              <p className="mt-0.5 text-red-700/90 leading-relaxed">
                Deleting &quot;<span className="font-semibold">{projectToDelete?.name}</span>&quot; will permanently purge all associated API schemas, requirements specifications, and test suite definitions.
              </p>
            </div>
          </div>

          <p className="text-xs text-stone-600">
            Are you sure you want to delete this workspace? This operation cannot be reversed.
          </p>

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-stone-100">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setProjectToDelete(null)}
              disabled={isDeleting}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              size="sm"
              isLoading={isDeleting}
              onClick={handleConfirmDelete}
              leftIcon={<Trash2 className="w-3.5 h-3.5" />}
            >
              Confirm Delete
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
