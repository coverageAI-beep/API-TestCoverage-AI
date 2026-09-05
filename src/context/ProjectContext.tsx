import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  type ReactNode,
} from 'react';
import type { Project, ProjectOneDriveFolder } from '../types';
import { useAuth } from './AuthContext';
import {
  fetchUserProjects,
  createProjectRecord,
  updateProjectRecord,
  deleteProjectRecord,
  updateProjectOneDriveFolder,
} from '../lib/mockStorage';

interface ProjectContextType {
  projects: Project[];
  activeProject: Project | null;
  loading: boolean;
  error: string | null;
  setActiveProject: (project: Project | null) => void;
  createProject: (data: {
    name: string;
    description?: string;
    targetEnvironmentUrl?: string;
  }) => Promise<Project>;
  updateProject: (
    id: string,
    data: {
      name: string;
      description?: string;
      targetEnvironmentUrl?: string;
    }
  ) => Promise<Project>;
  attachOneDriveFolder: (
    projectId: string,
    folder: ProjectOneDriveFolder
  ) => Promise<Project>;
  deleteProject: (id: string) => Promise<void>;
  refreshProjects: () => Promise<void>;
  isCreateModalOpen: boolean;
  openCreateModal: () => void;
  closeCreateModal: () => void;
  editingProject: Project | null;
  openEditModal: (project: Project) => void;
  closeEditModal: () => void;
}

const ProjectContext = createContext<ProjectContextType | undefined>(undefined);

export function ProjectProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [projects, setProjects] = useState<Project[]>([]);
  const [activeProject, setActiveProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const [isCreateModalOpen, setIsCreateModalOpen] = useState<boolean>(false);
  const [editingProject, setEditingProject] = useState<Project | null>(null);

  const loadProjects = useCallback(async () => {
    if (!user) {
      setProjects([]);
      setActiveProject(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const data = await fetchUserProjects(user.id);
      setProjects(data);

      // Preserve active project if still in list, otherwise select first or null
      setActiveProject((prev) => {
        if (!prev) return data[0] || null;
        const matched = data.find((p) => p.id === prev.id);
        return matched || data[0] || null;
      });
    } catch (err) {
      console.error('Failed to load projects:', err);
      setError('Unable to load projects. Please try refreshing.');
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    loadProjects();
  }, [loadProjects]);

  const createProject = async (data: {
    name: string;
    description?: string;
    targetEnvironmentUrl?: string;
  }): Promise<Project> => {
    if (!user) {
      throw new Error('You must be signed in to create a project');
    }

    let newProj = await createProjectRecord(user.id, data);

    // If user has OneDrive connected, attempt to automatically provision folder structure
    try {
      const statusRes = await fetch(`/api/onedrive/status?userId=${encodeURIComponent(user.id)}`);
      if (statusRes.ok) {
        const statusData = await statusRes.json();
        if (statusData.connected) {
          const folderRes = await fetch('/api/onedrive/projects/create-folder', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              userId: user.id,
              projectId: newProj.id,
              projectName: newProj.name,
            }),
          });
          if (folderRes.ok) {
            const folderData: ProjectOneDriveFolder = await folderRes.json();
            newProj = await updateProjectOneDriveFolder(user.id, newProj.id, folderData);
          }
        }
      }
    } catch (oneDriveErr) {
      console.warn('Automatic OneDrive folder provisioning deferred:', oneDriveErr);
    }

    setProjects((prev) => [newProj, ...prev]);
    setActiveProject(newProj);
    setIsCreateModalOpen(false);
    return newProj;
  };

  const attachOneDriveFolder = async (
    projectId: string,
    folder: ProjectOneDriveFolder
  ): Promise<Project> => {
    if (!user) {
      throw new Error('You must be signed in to attach OneDrive folder');
    }

    const updated = await updateProjectOneDriveFolder(user.id, projectId, folder);
    setProjects((prev) => prev.map((p) => (p.id === projectId ? updated : p)));
    if (activeProject?.id === projectId) {
      setActiveProject(updated);
    }
    return updated;
  };

  const updateProject = async (
    id: string,
    data: {
      name: string;
      description?: string;
      targetEnvironmentUrl?: string;
    }
  ): Promise<Project> => {
    if (!user) {
      throw new Error('You must be signed in to update a project');
    }

    const updated = await updateProjectRecord(user.id, id, data);
    setProjects((prev) => prev.map((p) => (p.id === id ? updated : p)));
    if (activeProject?.id === id) {
      setActiveProject(updated);
    }
    setEditingProject(null);
    return updated;
  };

  const deleteProject = async (id: string): Promise<void> => {
    if (!user) {
      throw new Error('You must be signed in to delete a project');
    }

    await deleteProjectRecord(user.id, id);
    setProjects((prev) => {
      const filtered = prev.filter((p) => p.id !== id);
      if (activeProject?.id === id) {
        setActiveProject(filtered[0] || null);
      }
      return filtered;
    });
  };

  const openCreateModal = () => setIsCreateModalOpen(true);
  const closeCreateModal = () => setIsCreateModalOpen(false);

  const openEditModal = (project: Project) => setEditingProject(project);
  const closeEditModal = () => setEditingProject(null);

  return (
    <ProjectContext.Provider
      value={{
        projects,
        activeProject,
        loading,
        error,
        setActiveProject,
        createProject,
        updateProject,
        attachOneDriveFolder,
        deleteProject,
        refreshProjects: loadProjects,
        isCreateModalOpen,
        openCreateModal,
        closeCreateModal,
        editingProject,
        openEditModal,
        closeEditModal,
      }}
    >
      {children}
    </ProjectContext.Provider>
  );
}

export function useProjects(): ProjectContextType {
  const context = useContext(ProjectContext);
  if (!context) {
    throw new Error('useProjects must be used within a ProjectProvider');
  }
  return context;
}
