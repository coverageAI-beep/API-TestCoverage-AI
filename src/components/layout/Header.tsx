import type { NavigationView } from '../../types';
import { useAuth } from '../../context/AuthContext';
import { useProjects } from '../../context/ProjectContext';
import { Button } from '../ui/Button';
import {
  ChevronRight,
  Plus,
  Info,
  ExternalLink,
  FolderGit2,
} from 'lucide-react';

interface HeaderProps {
  currentView: NavigationView;
  onNavigate: (view: NavigationView) => void;
}

export function Header({ currentView, onNavigate }: HeaderProps) {
  const { isDemoMode } = useAuth();
  const { activeProject, openCreateModal } = useProjects();

  const viewTitles: Record<NavigationView, string> = {
    dashboard: 'Dashboard',
    projects: 'Projects',
    apis: 'APIs',
    requirements: 'Requirements',
    'test-cases': 'Test Cases',
    files: 'Files',
    settings: 'Settings',
  };

  return (
    <header className="flex flex-col shrink-0 border-b border-stone-200 bg-white z-20">
      {/* Top Banner matching Professional Polish design */}
      {isDemoMode && (
        <div className="bg-indigo-600 text-white text-[11px] py-1 px-4 font-medium flex justify-center items-center space-x-2">
          <span>Running in Local Demo Mode — Configure .env to persist to Firebase</span>
        </div>
      )}

      {/* Main Header bar */}
      <div className="h-14 px-8 flex items-center justify-between">
        {/* Breadcrumbs */}
        <div className="flex items-center text-sm space-x-2">
          <button
            type="button"
            onClick={() => onNavigate('projects')}
            className="text-stone-500 hover:text-stone-900 transition-colors cursor-pointer"
          >
            Projects
          </button>

          <span className="text-stone-300 select-none">/</span>

          <span className="font-medium text-stone-900 truncate max-w-xs">
            {activeProject ? activeProject.name : viewTitles[currentView]}
          </span>
        </div>

        {/* Quick action button */}
        <div className="flex items-center space-x-3">
          {activeProject?.targetEnvironmentUrl && (
            <a
              href={activeProject.targetEnvironmentUrl}
              target="_blank"
              rel="noreferrer"
              className="hidden sm:inline-flex items-center gap-1 text-xs text-stone-500 hover:text-stone-900 transition-colors"
            >
              <span>Target Host</span>
              <ExternalLink className="w-3 h-3" />
            </a>
          )}

          <button
            type="button"
            onClick={openCreateModal}
            className="bg-indigo-600 text-white px-3 py-1.5 rounded-md text-xs font-semibold hover:bg-indigo-700 active:bg-indigo-800 shadow-xs transition-colors cursor-pointer inline-flex items-center gap-1"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>New Project</span>
          </button>
        </div>
      </div>
    </header>
  );
}
