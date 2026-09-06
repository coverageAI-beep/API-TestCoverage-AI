import { useState } from 'react';
import type { NavigationView } from '../../types';
import { useAuth } from '../../context/AuthContext';
import { useProjects } from '../../context/ProjectContext';
import { getInitials } from '../../lib/utils';
import { Dropdown, DropdownItem } from '../ui/Dropdown';
import {
  ShieldCheck,
  LayoutDashboard,
  FolderGit2,
  FileCode2,
  CheckSquare,
  FlaskConical,
  Files,
  Settings,
  Plus,
  ChevronDown,
  LogOut,
  User as UserIcon,
  Check,
  Sparkles,
} from 'lucide-react';

interface SidebarProps {
  currentView: NavigationView;
  onNavigate: (view: NavigationView) => void;
}

export function Sidebar({ currentView, onNavigate }: SidebarProps) {
  const { user, signOutUser, isDemoMode } = useAuth();
  const {
    projects,
    activeProject,
    setActiveProject,
    openCreateModal,
  } = useProjects();

  const navItems: Array<{
    id: NavigationView;
    label: string;
    icon: typeof LayoutDashboard;
    badge?: string;
    isP2?: boolean;
  }> = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'projects', label: 'Projects', icon: FolderGit2 },
    { id: 'apis', label: 'APIs', icon: FileCode2 },
    { id: 'requirements', label: 'Requirements', icon: CheckSquare, isP2: true },
    { id: 'test-cases', label: 'Test Cases', icon: FlaskConical, isP2: true },
    { id: 'files', label: 'OneDrive Files', icon: Files },
    { id: 'settings', label: 'Settings', icon: Settings },
  ];

  return (
    <aside className="w-[240px] h-screen bg-[#FAFAF9] border-r border-stone-200 flex flex-col justify-between shrink-0 select-none">
      {/* Top section: Brand & Project Switcher */}
      <div className="flex flex-col">
        {/* Brand Header */}
        <div className="p-5 border-b border-stone-200">
          <div className="flex items-center space-x-2">
            <div className="w-6 h-6 bg-indigo-600 rounded flex items-center justify-center text-white font-bold text-xs shadow-xs">
              C
            </div>
            <span className="font-bold text-sm tracking-tight text-stone-900">
              CoverageAI
            </span>
            <span className="text-[9px] px-1.5 py-0.5 rounded font-semibold uppercase tracking-wider bg-stone-200 text-stone-600">
              v0.1.0
            </span>
          </div>
        </div>

        {/* Project Switcher Dropdown */}
        <div className="px-3 py-4 flex-1">
          <div className="mb-6">
            <Dropdown
              className="w-54"
              trigger={({ toggle }) => (
                <button
                  type="button"
                  onClick={toggle}
                  className="w-full flex items-center justify-between px-3 py-2 bg-white border border-stone-200 rounded-md shadow-xs hover:border-stone-300 text-left transition-colors cursor-pointer group"
                >
                  <div className="flex flex-col truncate pr-1">
                    <span className="text-[10px] text-stone-500 uppercase font-bold leading-none mb-1">
                      Project
                    </span>
                    <span className="text-xs font-semibold text-stone-900 truncate">
                      {activeProject ? activeProject.name : 'Select Project'}
                    </span>
                  </div>
                  <ChevronDown className="w-3 h-3 text-stone-400 stroke-[3] group-hover:text-stone-700 shrink-0 ml-1 transition-colors" />
                </button>
              )}
            >
              {({ close }) => (
                <div className="py-1">
                  <div className="px-2.5 py-1 text-[10px] font-medium text-stone-400 uppercase tracking-wider">
                    Workspaces
                  </div>
                  <div className="max-h-48 overflow-y-auto divide-y divide-stone-50">
                    {projects.length === 0 ? (
                      <div className="px-2.5 py-2 text-xs text-stone-400 italic text-center">
                        No projects created
                      </div>
                    ) : (
                      projects.map((proj) => {
                        const isSelected = activeProject?.id === proj.id;
                        return (
                          <button
                            key={proj.id}
                            type="button"
                            onClick={() => {
                              setActiveProject(proj);
                              close();
                            }}
                            className={`w-full flex items-center justify-between px-2.5 py-1.5 text-xs text-left rounded-md transition-colors ${
                              isSelected
                                ? 'bg-indigo-50 text-indigo-700 font-medium'
                                : 'text-stone-700 hover:bg-stone-100'
                            }`}
                          >
                            <span className="truncate pr-2">{proj.name}</span>
                            {isSelected && <Check className="w-3 h-3 text-indigo-600 shrink-0" />}
                          </button>
                        );
                      })
                    )}
                  </div>

                  <div className="mt-1 pt-1 border-t border-stone-100">
                    <button
                      type="button"
                      onClick={() => {
                        close();
                        openCreateModal();
                      }}
                      className="w-full flex items-center gap-2 px-2.5 py-1.5 text-xs text-indigo-600 hover:bg-indigo-50 rounded-md font-medium transition-colors"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Create New Project</span>
                    </button>
                  </div>
                </div>
              )}
            </Dropdown>
          </div>

          {/* Navigation Items */}
          <nav className="flex flex-col">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = currentView === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => onNavigate(item.id)}
                  className={`flex items-center px-3 py-2 rounded-md text-[13px] font-medium my-[2px] transition-colors duration-150 cursor-pointer ${
                    item.isP2 && !isActive ? 'opacity-60' : ''
                  } ${
                    isActive
                      ? 'bg-stone-200 text-stone-900 font-semibold'
                      : 'text-stone-600 hover:bg-stone-100 hover:text-stone-900'
                  }`}
                >
                  <Icon className="w-4 h-4 mr-2.5 shrink-0 opacity-70" />
                  <span className="truncate">{item.label}</span>
                  {item.badge && (
                    <span className="ml-auto text-[10px] px-1.5 py-0.5 rounded font-semibold uppercase tracking-wider bg-stone-200 text-stone-600">
                      {item.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>
        </div>
      </div>

      {/* Footer section: Quick status and settings link */}
      <div className="border-t border-stone-200 bg-stone-100/50 p-3 flex flex-col gap-2">
        {isDemoMode && (
          <div className="px-2 py-1 rounded bg-stone-200/70 border border-stone-300/60 text-[10px] font-mono text-stone-600 flex items-center gap-1.5">
            <Sparkles className="w-3 h-3 text-indigo-600 shrink-0" />
            <span className="truncate font-sans font-medium">Sandbox Mode Active</span>
          </div>
        )}
        <button
          type="button"
          onClick={() => onNavigate('settings')}
          className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-md hover:bg-stone-200/60 text-stone-600 hover:text-stone-900 transition-colors text-xs cursor-pointer group"
        >
          <div className="flex items-center gap-2">
            <Settings className="w-3.5 h-3.5 text-stone-500 group-hover:text-stone-800" />
            <span className="font-medium">System Settings</span>
          </div>
          <span className="text-[10px] text-stone-400 font-mono">v1.2.0</span>
        </button>
      </div>
    </aside>
  );
}
