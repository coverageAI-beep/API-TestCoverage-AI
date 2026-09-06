import type { ApiReference } from '../../types';
import { formatRelativeTime } from '../../lib/utils';
import { Dropdown, DropdownItem } from '../ui/Dropdown';
import {
  FileCode2,
  ExternalLink,
  Edit2,
  Trash2,
  Cloud,
  Layers,
  Key,
  Shield,
  Clock,
  MoreVertical,
  FileText,
} from 'lucide-react';

interface ApiCardProps {
  key?: string;
  api: ApiReference;
  onSelect: (api: ApiReference) => void;
  onEdit: (api: ApiReference) => void;
  onDelete: (api: ApiReference) => void;
  onViewRequirements?: (api: ApiReference) => void;
  onViewTestCases?: (api: ApiReference) => void;
}

export function ApiCard({
  api,
  onSelect,
  onEdit,
  onDelete,
  onViewRequirements,
  onViewTestCases,
}: ApiCardProps) {
  // Coverage badge helper (placeholder for now as requested)
  const renderCoverageBadge = () => {
    switch (api.coverageStatus) {
      case 'good':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 mr-1.5" />
            Good Coverage
          </span>
        );
      case 'partial':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-50 text-amber-700 border border-amber-200">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500 mr-1.5" />
            Partial Coverage
          </span>
        );
      case 'not_analyzed':
      default:
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-stone-100 text-stone-600 border border-stone-200">
            <span className="w-1.5 h-1.5 rounded-full bg-stone-400 mr-1.5" />
            Not analyzed
          </span>
        );
    }
  };

  const renderAuthBadge = () => {
    const labelMap: Record<string, string> = {
      bearer: 'Bearer JWT',
      apiKey: 'API Key',
      oauth2: 'OAuth 2.0',
      basic: 'Basic Auth',
      custom: 'Custom Auth',
      none: 'Public / No Auth',
    };
    return (
      <span className="inline-flex items-center text-[10px] text-stone-500 font-mono bg-stone-50 px-1.5 py-0.5 rounded border border-stone-200">
        <Key className="w-2.5 h-2.5 mr-1 text-stone-400" />
        {labelMap[api.authType] || 'No Auth'}
      </span>
    );
  };

  return (
    <div className="group bg-white border border-stone-200 rounded-lg p-5 shadow-2xs hover:border-stone-300 transition-all duration-150 flex flex-col justify-between min-h-[190px]">
      <div>
        {/* Header Row: Title + Dropdown */}
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 mb-1.5 flex-wrap">
              <h3
                onClick={() => onSelect(api)}
                className="font-bold text-stone-900 text-base leading-snug hover:text-indigo-600 cursor-pointer truncate transition-colors"
                title={api.name}
              >
                {api.name}
              </h3>
              {renderCoverageBadge()}
            </div>
            <p className="text-xs text-indigo-600 font-mono truncate" title={api.baseUrl}>
              {api.baseUrl}
            </p>
          </div>

          <Dropdown
            trigger={
              <button
                type="button"
                className="p-1 text-stone-400 hover:text-stone-700 hover:bg-stone-100 rounded-md transition-colors"
                aria-label="API options"
              >
                <MoreVertical className="w-4 h-4" />
              </button>
            }
          >
            {({ close }) => (
              <>
                <DropdownItem
                  icon={<FileCode2 className="w-3.5 h-3.5 text-indigo-600" />}
                  onClick={() => {
                    close();
                    onSelect(api);
                  }}
                >
                  View Specification
                </DropdownItem>
                <DropdownItem
                  icon={<Edit2 className="w-3.5 h-3.5" />}
                  onClick={() => {
                    close();
                    onEdit(api);
                  }}
                >
                  Edit Specification
                </DropdownItem>
                {onViewRequirements && (
                  <DropdownItem
                    icon={<FileText className="w-3.5 h-3.5 text-indigo-600" />}
                    onClick={() => {
                      close();
                      onViewRequirements(api);
                    }}
                  >
                    View / Generate Requirements
                  </DropdownItem>
                )}
                {onViewTestCases && (
                  <DropdownItem
                    icon={<FileCode2 className="w-3.5 h-3.5 text-purple-600" />}
                    onClick={() => {
                      close();
                      onViewTestCases(api);
                    }}
                  >
                    View / Generate Test Cases
                  </DropdownItem>
                )}
                {api.oneDriveWebUrl && (
                  <DropdownItem
                    icon={<Cloud className="w-3.5 h-3.5 text-indigo-600" />}
                    onClick={() => {
                      close();
                      window.open(api.oneDriveWebUrl, '_blank');
                    }}
                  >
                    Open in OneDrive
                  </DropdownItem>
                )}
                <div className="my-1 border-t border-stone-100" />
                <DropdownItem
                  destructive
                  icon={<Trash2 className="w-3.5 h-3.5" />}
                  onClick={() => {
                    close();
                    onDelete(api);
                  }}
                >
                  Delete API
                </DropdownItem>
              </>
            )}
          </Dropdown>
        </div>

        {/* Description */}
        <p className="text-stone-500 text-xs line-clamp-2 leading-relaxed mt-2.5 mb-4">
          {api.description || 'API contract specification with endpoints, validation schemas, and error responses.'}
        </p>
      </div>

      {/* Footer info: Endpoints count, Auth, OneDrive sync, updated date */}
      <div className="pt-3 border-t border-stone-100 flex items-center justify-between text-xs text-stone-500 flex-wrap gap-2">
        <div className="flex items-center gap-2.5">
          <span className="inline-flex items-center text-xs font-semibold text-stone-800 bg-stone-100 px-2 py-0.5 rounded">
            <Layers className="w-3 h-3 mr-1 text-stone-500" />
            {api.endpointCount} {api.endpointCount === 1 ? 'Endpoint' : 'Endpoints'}
          </span>
          {renderAuthBadge()}
          {api.oneDriveItemId && (
            <span
              className="inline-flex items-center text-[11px] text-indigo-600 hover:text-indigo-800 font-medium"
              title="Synchronized to Microsoft OneDrive AppFolder"
            >
              <Cloud className="w-3 h-3 mr-1 text-indigo-500" />
              Synced
            </span>
          )}
        </div>

        <div className="flex items-center gap-1 text-[11px] text-stone-400 font-medium">
          <Clock className="w-3 h-3 text-stone-400" />
          <span>Updated {formatRelativeTime(api.updatedAt)}</span>
        </div>
      </div>
    </div>
  );
}
