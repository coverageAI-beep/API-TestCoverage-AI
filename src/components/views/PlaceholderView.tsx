import type { NavigationView } from '../../types';
import { useProjects } from '../../context/ProjectContext';
import { Button } from '../ui/Button';
import {
  FileCode2,
  CheckSquare,
  FlaskConical,
  Files,
  ArrowLeft,
  Clock,
} from 'lucide-react';

interface PlaceholderViewProps {
  view: NavigationView;
  onNavigate: (view: NavigationView) => void;
}

export function PlaceholderView({ view, onNavigate }: PlaceholderViewProps) {
  const { activeProject } = useProjects();

  const config: Record<
    'apis' | 'requirements' | 'test-cases' | 'files',
    {
      title: string;
      icon: typeof FileCode2;
      description: string;
      phaseFeatures: string[];
    }
  > = {
    apis: {
      title: 'API Specifications & Contracts',
      icon: FileCode2,
      description:
        'Import, author, and validate OpenAPI 3.0 / 3.1 definitions, GraphQL schemas, and gRPC protobuf descriptors.',
      phaseFeatures: [
        'OpenAPI 3.1 & Swagger specification parser',
        'Endpoint contract drift detection against target host',
        'Automatic JSON schema payload validator generation',
      ],
    },
    requirements: {
      title: 'Functional Requirements Matrix',
      icon: CheckSquare,
      description:
        'Bidirectional traceability between PRDs, Jira epics, user stories, and test verification criteria.',
      phaseFeatures: [
        'Requirement-to-endpoint coverage matrices',
        'Automated acceptance criteria extraction',
        'Traceability gap and orphan requirement alerts',
      ],
    },
    'test-cases': {
      title: 'Automated Test Suites & Fixtures',
      icon: FlaskConical,
      description:
        'Generate regression suites, boundary fuzzing payloads, and end-to-end integration workflows.',
      phaseFeatures: [
        'Dynamic scenario and boundary value synthesis',
        'Target environment execution runner and reporter',
        'Automated Playwright / Vitest test code export',
      ],
    },
    files: {
      title: 'Specification Files & Artifacts',
      icon: Files,
      description:
        'Centralized artifact repository for contract schemas, test output logs, and coverage reports.',
      phaseFeatures: [
        'Multi-format schema file upload (.json, .yaml, .proto)',
        'Diff viewer across schema revisions',
        'Immutable test run artifact storage',
      ],
    },
  };

  const current = config[view as keyof typeof config] || config.apis;
  const Icon = current.icon;

  return (
    <div className="flex flex-col items-center justify-center py-16 px-4 text-center max-w-xl mx-auto">
      {/* Phase 2 Badge */}
      <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-mono font-medium bg-stone-100 border border-stone-200 text-stone-600 mb-6">
        <Clock className="w-3.5 h-3.5 text-stone-500" />
        <span>Planned for Phase 2 Implementation</span>
      </div>

      {/* Icon */}
      <div className="w-14 h-14 rounded-2xl bg-white border border-stone-200 shadow-xs flex items-center justify-center text-stone-700 mb-4">
        <Icon className="w-7 h-7 stroke-[1.5] text-indigo-600" />
      </div>

      {/* Title */}
      <h2 className="text-lg font-semibold text-stone-900 tracking-tight">
        {current.title}
      </h2>

      {/* Description */}
      <p className="mt-2 text-xs text-stone-500 leading-relaxed max-w-md">
        {current.description}
      </p>

      {/* Active project context pill */}
      {activeProject && (
        <div className="mt-4 px-3 py-1 rounded-md bg-stone-100/70 border border-stone-200/80 text-[11px] text-stone-600 font-medium">
          Active Workspace: <span className="font-semibold text-stone-900">{activeProject.name}</span>
        </div>
      )}

      {/* Roadmap Items */}
      <div className="mt-8 w-full bg-white rounded-xl border border-stone-200 p-5 text-left shadow-2xs">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-stone-400 mb-3">
          Upcoming Specification Engine Capabilities
        </p>
        <ul className="flex flex-col gap-2.5">
          {current.phaseFeatures.map((feat) => (
            <li key={feat} className="flex items-start gap-2.5 text-xs text-stone-700">
              <span className="w-1.5 h-1.5 rounded-full bg-indigo-600 mt-1.5 shrink-0" />
              <span>{feat}</span>
            </li>
          ))}
        </ul>
      </div>

      <div className="mt-8">
        <Button
          variant="outline"
          size="sm"
          onClick={() => onNavigate('projects')}
          leftIcon={<ArrowLeft className="w-3.5 h-3.5" />}
        >
          Return to Projects Workspace
        </Button>
      </div>
    </div>
  );
}
