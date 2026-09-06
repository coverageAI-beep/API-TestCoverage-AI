import { useState } from 'react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import type { TestCase } from '../../types';
import {
  Sparkles,
  User,
  CheckCircle2,
  Copy,
  Check,
  Edit2,
  FileCode,
  Layers,
  Clock,
} from 'lucide-react';

interface TestCaseDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  onEdit: (testCase: TestCase) => void;
  testCase: TestCase | null;
  apiName: string;
}

export function TestCaseDetailModal({
  isOpen,
  onClose,
  onEdit,
  testCase,
  apiName,
}: TestCaseDetailModalProps) {
  const [copied, setCopied] = useState(false);

  if (!testCase) return null;

  const handleCopyPayload = () => {
    navigator.clipboard.writeText(testCase.requestPayload);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const getTypeBadgeColor = (type: string) => {
    switch (type) {
      case 'Positive':
        return 'bg-emerald-50 text-emerald-700 border-emerald-200';
      case 'Negative':
        return 'bg-rose-50 text-rose-700 border-rose-200';
      case 'Edge':
        return 'bg-amber-50 text-amber-700 border-amber-200';
      case 'Boundary':
        return 'bg-purple-50 text-purple-700 border-purple-200';
      default:
        return 'bg-stone-50 text-stone-700 border-stone-200';
    }
  };

  const getPriorityBadgeColor = (priority: string) => {
    switch (priority) {
      case 'High':
        return 'bg-red-50 text-red-700 border-red-200';
      case 'Medium':
        return 'bg-amber-50 text-amber-700 border-amber-200';
      case 'Low':
        return 'bg-sky-50 text-sky-700 border-sky-200';
      default:
        return 'bg-stone-50 text-stone-700 border-stone-200';
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`${testCase.id}: ${testCase.title}`}
      description={`Detailed specification and execution parameters for ${apiName}`}
      maxWidth="lg"
      footer={
        <div className="flex items-center justify-between w-full">
          <div className="flex items-center gap-2 text-xs text-stone-500">
            {testCase.updatedAt && (
              <span className="flex items-center gap-1 font-mono text-[11px]">
                <Clock className="w-3 h-3 text-stone-400" />
                Updated {new Date(testCase.updatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              leftIcon={<Edit2 className="w-3.5 h-3.5" />}
              onClick={() => {
                onClose();
                onEdit(testCase);
              }}
            >
              Edit Test Case
            </Button>
            <Button variant="secondary" size="sm" onClick={onClose}>
              Close
            </Button>
          </div>
        </div>
      }
    >
      <div className="space-y-4 text-xs">
        {/* Badges bar */}
        <div className="flex items-center gap-2 flex-wrap pb-3 border-b border-stone-100">
          <span className={`px-2 py-0.5 rounded text-xs font-medium border ${getTypeBadgeColor(testCase.type)}`}>
            {testCase.type}
          </span>
          <span className={`px-2 py-0.5 rounded text-xs font-medium border ${getPriorityBadgeColor(testCase.priority)}`}>
            {testCase.priority} Priority
          </span>
          <span className="bg-stone-100 text-stone-700 border border-stone-200 px-2 py-0.5 rounded text-xs font-mono font-medium">
            {testCase.linkedEndpoint}
          </span>
          <span className="flex items-center gap-1 text-[11px] px-2 py-0.5 rounded border border-stone-200 bg-stone-50 text-stone-600">
            {testCase.source === 'AI-generated' ? (
              <>
                <Sparkles className="w-3 h-3 text-indigo-500" />
                AI-generated
              </>
            ) : (
              <>
                <User className="w-3 h-3 text-emerald-500" />
                Manual
              </>
            )}
          </span>
        </div>

        {/* Linked Requirements */}
        <div>
          <div className="text-[11px] font-semibold text-stone-500 uppercase tracking-wider mb-1.5 flex items-center gap-1">
            <Layers className="w-3 h-3 text-stone-400" />
            Linked Requirement ID(s)
          </div>
          <div className="flex items-center gap-1.5 flex-wrap">
            {testCase.linkedRequirements && testCase.linkedRequirements.length > 0 ? (
              testCase.linkedRequirements.map((req) => (
                <span
                  key={req}
                  className="px-2 py-0.5 rounded bg-indigo-50 border border-indigo-200 text-indigo-700 font-mono font-medium text-xs"
                >
                  {req}
                </span>
              ))
            ) : (
              <span className="text-stone-400 italic">None specified</span>
            )}
          </div>
        </div>

        {/* Preconditions */}
        <div>
          <div className="text-[11px] font-semibold text-stone-500 uppercase tracking-wider mb-1">
            Preconditions
          </div>
          <div className="bg-stone-50 border border-stone-200 rounded-md p-2.5 text-stone-800 font-normal leading-relaxed">
            {testCase.preconditions || 'No specific preconditions required.'}
          </div>
        </div>

        {/* Request Payload */}
        <div>
          <div className="flex items-center justify-between mb-1">
            <div className="text-[11px] font-semibold text-stone-500 uppercase tracking-wider flex items-center gap-1">
              <FileCode className="w-3 h-3 text-stone-400" />
              Request Payload
            </div>
            <button
              onClick={handleCopyPayload}
              className="text-[11px] text-stone-500 hover:text-stone-800 flex items-center gap-1 px-1.5 py-0.5 rounded hover:bg-stone-100"
            >
              {copied ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
              {copied ? 'Copied' : 'Copy'}
            </button>
          </div>
          <pre className="bg-stone-900 text-stone-100 p-3 rounded-lg font-mono text-xs overflow-x-auto max-h-48 whitespace-pre-wrap">
            {testCase.requestPayload || '// Empty or no payload'}
          </pre>
        </div>

        {/* Expected Response */}
        <div>
          <div className="text-[11px] font-semibold text-stone-500 uppercase tracking-wider mb-1">
            Expected Response
          </div>
          <div className="bg-stone-50 border border-stone-200 rounded-md p-2.5 text-stone-800 font-normal leading-relaxed">
            {testCase.expectedResponse || 'HTTP 200 OK'}
          </div>
        </div>

        {/* Assertions */}
        <div>
          <div className="text-[11px] font-semibold text-stone-500 uppercase tracking-wider mb-1.5">
            Validation Assertions ({testCase.assertions?.length || 0})
          </div>
          <div className="space-y-1.5">
            {testCase.assertions && testCase.assertions.length > 0 ? (
              testCase.assertions.map((assertion, idx) => (
                <div
                  key={idx}
                  className="flex items-start gap-2 bg-emerald-50/50 border border-emerald-100 rounded-md p-2 text-stone-800"
                >
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0 mt-0.5" />
                  <span className="font-mono text-xs leading-relaxed">{assertion}</span>
                </div>
              ))
            ) : (
              <div className="text-stone-400 italic">No assertions defined.</div>
            )}
          </div>
        </div>
      </div>
    </Modal>
  );
}
