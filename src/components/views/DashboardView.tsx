import type { NavigationView } from '../../types';
import { useProjects } from '../../context/ProjectContext';
import { Button } from '../ui/Button';
import { formatRelativeTime } from '../../lib/utils';
import {
  FileCode2,
  CheckSquare,
  FlaskConical,
  FolderGit2,
  ArrowRight,
  Globe,
  Plus,
  ShieldCheck,
  CheckCircle2,
} from 'lucide-react';

interface DashboardViewProps {
  onNavigate: (view: NavigationView) => void;
}

export function DashboardView({ onNavigate }: DashboardViewProps) {
  const { projects, activeProject, openCreateModal, setActiveProject } = useProjects();

  // Aggregate stats across all user projects
  const totalStats = projects.reduce(
    (acc, p) => ({
      apis: acc.apis + (p.stats?.apiCount ?? 0),
      requirements: acc.requirements + (p.stats?.requirementCount ?? 0),
      testCases: acc.testCases + (p.stats?.testCaseCount ?? 0),
    }),
    { apis: 0, requirements: 0, testCases: 0 }
  );

  return (
    <div className="flex flex-col gap-8 max-w-6xl">
      {/* Top Welcome & Summary */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-stone-900">
            QA Engineering Overview
          </h1>
          <p className="mt-1 text-xs text-stone-500">
            Workspace telemetry across API specifications, functional requirement traceability, and test suites.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="secondary"
            size="sm"
            onClick={() => onNavigate('projects')}
          >
            All Projects
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={openCreateModal}
            leftIcon={<Plus className="w-4 h-4" />}
          >
            New Project
          </Button>
        </div>
      </div>

      {/* Aggregate Metrics Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl border border-stone-200 p-5 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-stone-500">Isolated Projects</span>
            <FolderGit2 className="w-4 h-4 text-stone-400" />
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl font-bold tracking-tight text-stone-900">
              {projects.length}
            </span>
            <span className="text-xs text-stone-400">active</span>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-stone-200 p-5 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-stone-500">API Endpoints</span>
            <FileCode2 className="w-4 h-4 text-stone-400" />
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl font-bold tracking-tight text-stone-900">
              {totalStats.apis}
            </span>
            <span className="text-xs text-stone-400">tracked</span>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-stone-200 p-5 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-stone-500">Requirements</span>
            <CheckSquare className="w-4 h-4 text-stone-400" />
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl font-bold tracking-tight text-stone-900">
              {totalStats.requirements}
            </span>
            <span className="text-xs text-stone-400">mapped</span>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-stone-200 p-5 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-stone-500">Test Cases</span>
            <FlaskConical className="w-4 h-4 text-stone-400" />
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl font-bold tracking-tight text-stone-900">
              {totalStats.testCases}
            </span>
            <span className="text-xs text-stone-400">cases</span>
          </div>
        </div>
      </div>

      {/* Active Project Highlight Card */}
      {activeProject ? (
        <div className="bg-white rounded-xl border border-stone-200 p-6 shadow-2xs">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-stone-100">
            <div>
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200 uppercase tracking-wider">
                  Active Workspace
                </span>
                <h2 className="text-base font-semibold text-stone-900">
                  {activeProject.name}
                </h2>
              </div>
              <p className="mt-1 text-xs text-stone-500 max-w-xl">
                {activeProject.description || 'No description provided.'}
              </p>
            </div>

            <Button
              variant="outline"
              size="sm"
              onClick={() => onNavigate('projects')}
              rightIcon={<ArrowRight className="w-3.5 h-3.5" />}
            >
              Manage Specifications
            </Button>
          </div>

          <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
            <div className="flex items-center gap-2 p-3 bg-stone-50 rounded-lg border border-stone-100">
              <Globe className="w-4 h-4 text-stone-400 shrink-0" />
              <div className="min-w-0">
                <p className="text-[11px] text-stone-500 font-medium">Target Host</p>
                <p className="font-mono text-stone-800 text-[11px] truncate">
                  {activeProject.targetEnvironmentUrl || 'Not configured'}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 p-3 bg-stone-50 rounded-lg border border-stone-100">
              <ShieldCheck className="w-4 h-4 text-stone-400 shrink-0" />
              <div>
                <p className="text-[11px] text-stone-500 font-medium">Test Suite Coverage</p>
                <p className="text-stone-800 font-semibold">
                  {activeProject.stats?.testCaseCount ?? 0} automated assertions
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 p-3 bg-stone-50 rounded-lg border border-stone-100">
              <CheckCircle2 className="w-4 h-4 text-stone-400 shrink-0" />
              <div>
                <p className="text-[11px] text-stone-500 font-medium">Last Modified</p>
                <p className="text-stone-800">
                  {formatRelativeTime(activeProject.updatedAt)}
                </p>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-stone-200 p-8 text-center shadow-2xs">
          <FolderGit2 className="w-8 h-8 text-stone-400 mx-auto mb-2 stroke-[1.5]" />
          <h3 className="text-sm font-semibold text-stone-900">No active workspace selected</h3>
          <p className="text-xs text-stone-500 mt-1 max-w-sm mx-auto">
            Select an existing QA project or create a new workspace to start tracking API specifications.
          </p>
          <Button
            variant="primary"
            size="sm"
            className="mt-4"
            onClick={openCreateModal}
          >
            Create Project
          </Button>
        </div>
      )}

      {/* Recent Projects Switcher */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-stone-500">
            Recent Workspaces
          </h3>
          <button
            type="button"
            onClick={() => onNavigate('projects')}
            className="text-xs text-indigo-600 hover:text-indigo-800 font-medium transition-colors"
          >
            View All ({projects.length})
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {projects.slice(0, 3).map((p) => {
            const isSelected = activeProject?.id === p.id;
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => setActiveProject(p)}
                className={`p-4 rounded-xl border text-left transition-all ${
                  isSelected
                    ? 'bg-white border-indigo-600 ring-1 ring-indigo-600 shadow-xs'
                    : 'bg-white border-stone-200 hover:border-stone-300 shadow-2xs'
                }`}
              >
                <div className="flex items-center justify-between">
                  <p className="text-xs font-semibold text-stone-900 truncate">
                    {p.name}
                  </p>
                  {isSelected && (
                    <span className="w-2 h-2 rounded-full bg-indigo-600 shrink-0" />
                  )}
                </div>
                <p className="text-[11px] text-stone-500 line-clamp-1 mt-1">
                  {p.description || 'No description'}
                </p>
                <div className="mt-3 flex items-center justify-between text-[10px] text-stone-400 pt-2 border-t border-stone-100">
                  <span>{p.stats?.testCaseCount ?? 0} tests</span>
                  <span>{formatRelativeTime(p.updatedAt)}</span>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
