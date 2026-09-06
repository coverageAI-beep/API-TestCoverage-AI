import type { NavigationView } from '../../types';
import { useAuth } from '../../context/AuthContext';
import { useProjects } from '../../context/ProjectContext';
import { Dropdown, DropdownItem } from '../ui/Dropdown';
import { getInitials } from '../../lib/utils';
import {
  Plus,
  ExternalLink,
  LogOut,
  User as UserIcon,
  Settings,
  ChevronDown,
  Sparkles,
} from 'lucide-react';

interface HeaderProps {
  currentView: NavigationView;
  onNavigate: (view: NavigationView) => void;
}

export function Header({ currentView, onNavigate }: HeaderProps) {
  const { user, signOutUser, isDemoMode } = useAuth();
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

  const displayName = user?.displayName || user?.email?.split('@')[0] || 'QA Engineer';
  const displayEmail = user?.email || 'enterprise@coverageai.dev';
  const isMicrosoftAccount = user?.provider === 'microsoft.com';

  return (
    <header className="flex flex-col shrink-0 border-b border-stone-200 bg-white z-20">
      {/* Top Banner matching Professional Polish design */}
      {isDemoMode && (
        <div className="bg-indigo-600 text-white text-[11px] py-1 px-4 font-medium flex justify-center items-center space-x-2">
          <span>Running in Local Sandbox Mode — Configure .env to persist to Microsoft Azure & Firebase</span>
        </div>
      )}

      {/* Main Header bar */}
      <div className="h-14 px-6 md:px-8 flex items-center justify-between">
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

        {/* Quick action button & Top-Right Profile / Sign Out Area */}
        <div className="flex items-center space-x-2 sm:space-x-3">
          {activeProject?.targetEnvironmentUrl && (
            <a
              href={activeProject.targetEnvironmentUrl}
              target="_blank"
              rel="noreferrer"
              className="hidden lg:inline-flex items-center gap-1 text-xs text-stone-500 hover:text-stone-900 transition-colors mr-1"
            >
              <span>Target Host</span>
              <ExternalLink className="w-3 h-3" />
            </a>
          )}

          {/* New Project Button */}
          <button
            type="button"
            onClick={openCreateModal}
            className="bg-indigo-600 text-white px-3 py-1.5 rounded-md text-xs font-semibold hover:bg-indigo-700 active:bg-indigo-800 shadow-xs transition-colors cursor-pointer inline-flex items-center gap-1 shrink-0"
          >
            <Plus className="w-3.5 h-3.5" />
            <span className="hidden xs:inline">New Project</span>
          </button>

          <div className="h-5 w-px bg-stone-200 shrink-0" />

          {/* Profile Dropdown */}
          <Dropdown
            align="right"
            className="w-64"
            trigger={({ toggle, isOpen }) => (
              <button
                type="button"
                onClick={toggle}
                className={`flex items-center gap-2 p-1 pl-1.5 pr-2 rounded-lg border transition-colors cursor-pointer group ${
                  isOpen
                    ? 'bg-stone-100 border-stone-300'
                    : 'bg-white border-stone-200 hover:border-stone-300 hover:bg-stone-50'
                }`}
                title="Account profile & settings"
              >
                {/* User Avatar with Initials */}
                <div className="relative">
                  <div className="w-7 h-7 rounded-full bg-gradient-to-tr from-indigo-600 to-indigo-500 text-white font-semibold text-xs flex items-center justify-center shrink-0 shadow-2xs">
                    {getInitials(displayName)}
                  </div>
                  {isMicrosoftAccount && (
                    <div
                      className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-blue-500 border border-white"
                      title="Microsoft Connected"
                    />
                  )}
                </div>

                {/* Name / Email label for medium+ screens */}
                <div className="flex flex-col text-left max-w-[120px] hidden md:flex">
                  <span className="text-xs font-semibold text-stone-900 truncate leading-tight">
                    {displayName}
                  </span>
                  <span className="text-[10px] text-stone-500 truncate leading-tight">
                    {displayEmail}
                  </span>
                </div>

                <ChevronDown
                  className={`w-3.5 h-3.5 text-stone-400 group-hover:text-stone-700 transition-transform duration-150 ${
                    isOpen ? 'rotate-180' : ''
                  }`}
                />
              </button>
            )}
          >
            {({ close }) => (
              <>
                <div className="px-3 py-2.5 border-b border-stone-100 bg-stone-50/70 rounded-t-md">
                  <div className="flex items-center gap-1.5 mb-0.5">
                    <span className="text-xs font-bold text-stone-900 truncate">
                      {displayName}
                    </span>
                    <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-stone-200 text-stone-700 font-semibold uppercase shrink-0">
                      {isMicrosoftAccount ? 'Microsoft' : user?.provider || 'Active'}
                    </span>
                  </div>
                  <p className="text-[11px] text-stone-500 truncate font-mono">
                    {displayEmail}
                  </p>
                  {isDemoMode && (
                    <div className="mt-1.5 flex items-center gap-1 text-[10px] text-amber-700 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded">
                      <Sparkles className="w-2.5 h-2.5 shrink-0" />
                      <span>Sandbox Session</span>
                    </div>
                  )}
                </div>

                <div className="py-1">
                  <DropdownItem
                    icon={<UserIcon className="w-3.5 h-3.5 text-stone-500" />}
                    onClick={() => {
                      close();
                      onNavigate('settings');
                    }}
                  >
                    Account & Profile
                  </DropdownItem>
                  <DropdownItem
                    icon={<Settings className="w-3.5 h-3.5 text-stone-500" />}
                    onClick={() => {
                      close();
                      onNavigate('settings');
                    }}
                  >
                    AI Providers & OneDrive
                  </DropdownItem>
                </div>

                <div className="pt-1 border-t border-stone-100">
                  <DropdownItem
                    destructive
                    icon={<LogOut className="w-3.5 h-3.5 text-red-600" />}
                    onClick={() => {
                      close();
                      signOutUser();
                    }}
                  >
                    Sign Out
                  </DropdownItem>
                </div>
              </>
            )}
          </Dropdown>

          {/* Dedicated Directly Visible Top-Right Sign Out Button */}
          <button
            type="button"
            onClick={() => signOutUser()}
            className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-stone-600 hover:text-red-700 hover:bg-red-50 active:bg-red-100 border border-stone-200 hover:border-red-200 rounded-md transition-colors cursor-pointer shadow-2xs shrink-0"
            title="Sign out of CoverageAI"
          >
            <LogOut className="w-3.5 h-3.5 text-stone-400 group-hover:text-red-600" />
            <span className="hidden sm:inline">Sign Out</span>
          </button>
        </div>
      </div>
    </header>
  );
}
