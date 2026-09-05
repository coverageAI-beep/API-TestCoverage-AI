import { useState } from 'react';
import type { Project } from '../../types';
import { formatRelativeTime } from '../../lib/utils';
import { Dropdown, DropdownItem } from '../ui/Dropdown';
import { Button } from '../ui/Button';
import {
  MoreVertical,
  ExternalLink,
  Edit2,
  Trash2,
  FileCode2,
  CheckSquare,
  FlaskConical,
  Globe,
  Clock,
  Check,
  Cloud,
} from 'lucide-react';

interface ProjectCardProps {
  key?: string;
  project: Project;
  isActive: boolean;
  onSelect: (project: Project) => void;
  onEdit: (project: Project) => void;
  onDeleteRequest: (project: Project) => void;
  onNavigateView?: (view: 'apis' | 'projects' | 'files') => void;
}

export function ProjectCard({
  project,
  isActive,
  onSelect,
  onEdit,
  onDeleteRequest,
  onNavigateView,
}: ProjectCardProps) {
  return (
    <div
      className={`card flex flex-col bg-white border rounded-lg p-5 shadow-[0_1px_2px_rgba(0,0,0,0.05)] transition-all duration-150 min-h-[220px] ${
        isActive
          ? 'border-indigo-600 ring-1 ring-indigo-600'
          : 'border-stone-200 hover:border-stone-300'
      }`}
    >
      {/* Top row: Name + Env on left, Options menu on right */}
      <div className="flex justify-between items-start mb-4">
        <div className="flex flex-col min-w-0 pr-2">
          <h3
            onClick={() => onSelect(project)}
            className="font-bold text-stone-900 text-base leading-snug hover:text-indigo-600 cursor-pointer select-none truncate"
            title={project.name}
          >
            {project.name}
          </h3>
          {project.targetEnvironmentUrl ? (
            <span
              className="text-xs text-indigo-600 font-mono mt-1 truncate"
              title={project.targetEnvironmentUrl}
            >
              {project.targetEnvironmentUrl.replace(/^https?:\/\//, '')}
            </span>
          ) : (
            <span className="text-xs text-stone-400 font-mono mt-1 italic">
              No environment set
            </span>
          )}
        </div>

        <div className="text-stone-400 cursor-pointer shrink-0">
          <Dropdown
            align="right"
            trigger={({ toggle }) => (
              <button
                type="button"
                onClick={toggle}
                aria-label="Project actions"
                className="p-1 rounded text-stone-400 hover:text-stone-700 hover:bg-stone-100 transition-colors"
              >
                <MoreVertical className="w-4 h-4 stroke-[2.5]" />
              </button>
            )}
          >
            {({ close }) => (
              <>
                <DropdownItem
                  icon={<ExternalLink className="w-3.5 h-3.5" />}
                  onClick={() => {
                    close();
                    onSelect(project);
                  }}
                >
                  {isActive ? 'Workspace Selected' : 'Set as Active'}
                </DropdownItem>
                {onNavigateView && (
                  <DropdownItem
                    icon={<FileCode2 className="w-3.5 h-3.5 text-indigo-600" />}
                    onClick={() => {
                      close();
                      onSelect(project);
                      onNavigateView('apis');
                    }}
                  >
                    View API Specifications
                  </DropdownItem>
                )}
                <DropdownItem
                  icon={<Edit2 className="w-3.5 h-3.5" />}
                  onClick={() => {
                    close();
                    onEdit(project);
                  }}
                >
                  Edit Specifications
                </DropdownItem>
                {project.oneDriveFolder?.rootWebUrl && (
                  <DropdownItem
                    icon={<Cloud className="w-3.5 h-3.5 text-indigo-600" />}
                    onClick={() => {
                      close();
                      window.open(project.oneDriveFolder?.rootWebUrl, '_blank');
                    }}
                  >
                    Open OneDrive Folder
                  </DropdownItem>
                )}
                <div className="my-1 border-t border-stone-100" />
                <DropdownItem
                  destructive
                  icon={<Trash2 className="w-3.5 h-3.5" />}
                  onClick={() => {
                    close();
                    onDeleteRequest(project);
                  }}
                >
                  Delete Project
                </DropdownItem>
              </>
            )}
          </Dropdown>
        </div>
      </div>

      {/* Description */}
      <p className="text-stone-500 text-sm line-clamp-2 leading-relaxed mb-6">
        {project.description ||
          'Isolated workspace for API contract validation, functional specifications, and end-to-end test suites.'}
      </p>

      {/* Footer with stats and relative time */}
      <div className="mt-auto pt-4 border-t border-stone-100 flex items-center justify-between">
        <div className="flex space-x-4">
          <div className="flex items-center text-[11px] text-stone-500 font-medium">
            <div className="w-3 h-3 border border-stone-400 mr-1.5 rounded-[2px] opacity-70 shrink-0" />
            <span>{project.stats?.apiCount ?? 0} APIs</span>
          </div>
          <div className="flex items-center text-[11px] text-stone-500 font-medium">
            <div className="w-3 h-3 border border-stone-400 mr-1.5 rounded-[2px] opacity-70 shrink-0" />
            <span>{project.stats?.testCaseCount ?? 0} Tests</span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {isActive && (
            <span className="text-[10px] font-semibold text-indigo-600 uppercase tracking-wider bg-indigo-50 px-1.5 py-0.5 rounded border border-indigo-200">
              Active
            </span>
          )}
          <span className="text-[10px] text-stone-400 font-medium">
            Updated {formatRelativeTime(project.updatedAt)}
          </span>
        </div>
      </div>
    </div>
  );
}
