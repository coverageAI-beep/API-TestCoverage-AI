import { useState, useMemo } from 'react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import type { RequirementsDiffData } from '../../types';
import {
  FileDiff,
  Sparkles,
  Check,
  X,
  ArrowRight,
  Columns,
  List,
  AlertTriangle,
} from 'lucide-react';

interface RequirementsDiffModalProps {
  isOpen: boolean;
  onClose: () => void;
  diffData: RequirementsDiffData | null;
  onConfirmOverwrite: (diffData: RequirementsDiffData) => Promise<void>;
  isOverwriting: boolean;
}

interface DiffLine {
  type: 'unchanged' | 'added' | 'removed' | 'modified';
  oldText?: string;
  newText?: string;
  oldLineNum?: number;
  newLineNum?: number;
}

export function RequirementsDiffModal({
  isOpen,
  onClose,
  diffData,
  onConfirmOverwrite,
  isOverwriting,
}: RequirementsDiffModalProps) {
  const [viewMode, setViewMode] = useState<'split' | 'unified'>('split');

  const diffAnalysis = useMemo(() => {
    if (!diffData) return { lines: [], stats: { added: 0, removed: 0, unchanged: 0 } };

    const oldLines = diffData.existingContent.split('\n');
    const newLines = diffData.newContent.split('\n');

    const lines: DiffLine[] = [];
    const maxLen = Math.max(oldLines.length, newLines.length);

    let addedCount = 0;
    let removedCount = 0;
    let unchangedCount = 0;

    for (let i = 0; i < maxLen; i++) {
      const oldL = oldLines[i];
      const newL = newLines[i];

      if (oldL === newL && oldL !== undefined) {
        lines.push({
          type: 'unchanged',
          oldText: oldL,
          newText: newL,
          oldLineNum: i + 1,
          newLineNum: i + 1,
        });
        unchangedCount++;
      } else if (oldL !== undefined && newL !== undefined) {
        lines.push({
          type: 'modified',
          oldText: oldL,
          newText: newL,
          oldLineNum: i + 1,
          newLineNum: i + 1,
        });
        addedCount++;
        removedCount++;
      } else if (oldL !== undefined) {
        lines.push({
          type: 'removed',
          oldText: oldL,
          oldLineNum: i + 1,
        });
        removedCount++;
      } else if (newL !== undefined) {
        lines.push({
          type: 'added',
          newText: newL,
          newLineNum: i + 1,
        });
        addedCount++;
      }
    }

    return {
      lines,
      stats: {
        added: addedCount,
        removed: removedCount,
        unchanged: unchangedCount,
        oldWordCount: diffData.existingContent.trim().split(/\s+/).length,
        newWordCount: diffData.newContent.trim().split(/\s+/).length,
      },
    };
  }, [diffData]);

  if (!diffData) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Review Requirements Changes: ${diffData.apiName}`}
      description="Existing requirements were detected in OneDrive. Compare the previous specification with the newly generated version before saving."
      maxWidth="xl"
    >
      <div className="space-y-4">
        {/* Info & Metrics Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-stone-50 border border-stone-200 rounded-lg p-3 text-xs">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold text-stone-800 flex items-center gap-1">
              <FileDiff className="w-3.5 h-3.5 text-indigo-600" />
              {diffData.fileName}
            </span>
            <span className="text-stone-300">•</span>
            <span className="text-stone-600">
              Provider:{' '}
              <span className="font-semibold capitalize text-indigo-700">
                {diffData.provider || 'AI'}
              </span>
              {diffData.model && ` (${diffData.model})`}
            </span>
            {diffData.isFallback && (
              <span className="bg-amber-100 text-amber-800 px-1.5 py-0.5 rounded text-[10px] font-medium">
                Synthesized Spec
              </span>
            )}
          </div>

          <div className="flex items-center gap-3 text-[11px] font-mono shrink-0">
            <span className="text-rose-600 bg-rose-50 px-2 py-0.5 rounded border border-rose-200">
              -{diffAnalysis.stats.removed} lines
            </span>
            <span className="text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
              +{diffAnalysis.stats.added} lines
            </span>
            <div className="flex border border-stone-200 rounded bg-white overflow-hidden">
              <button
                type="button"
                onClick={() => setViewMode('split')}
                className={`px-2 py-1 flex items-center gap-1 transition-colors ${
                  viewMode === 'split'
                    ? 'bg-indigo-600 text-white font-medium'
                    : 'text-stone-600 hover:bg-stone-50'
                }`}
                title="Side-by-side view"
              >
                <Columns className="w-3 h-3" />
                <span className="text-[10px]">Split</span>
              </button>
              <button
                type="button"
                onClick={() => setViewMode('unified')}
                className={`px-2 py-1 flex items-center gap-1 transition-colors ${
                  viewMode === 'unified'
                    ? 'bg-indigo-600 text-white font-medium'
                    : 'text-stone-600 hover:bg-stone-50'
                }`}
                title="Unified diff view"
              >
                <List className="w-3 h-3" />
                <span className="text-[10px]">Unified</span>
              </button>
            </div>
          </div>
        </div>

        {/* Warning Banner */}
        <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-lg p-2.5 text-xs text-amber-900">
          <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
          <p className="leading-relaxed">
            Confirming will overwrite <strong>{diffData.fileName}</strong> in your project's OneDrive{' '}
            <code className="bg-amber-100/70 px-1 py-0.5 rounded text-[11px] font-mono">requirements</code>{' '}
            folder. OneDrive version history will preserve past revisions.
          </p>
        </div>

        {/* Diff Content Box */}
        <div className="border border-stone-200 rounded-lg overflow-hidden bg-white shadow-2xs">
          {viewMode === 'split' ? (
            <div className="grid grid-cols-2 divide-x divide-stone-200 text-xs font-mono">
              {/* Left: Previous (Old) */}
              <div className="flex flex-col">
                <div className="bg-stone-100 border-b border-stone-200 px-3 py-2 font-semibold text-stone-700 flex justify-between items-center text-[11px]">
                  <span className="flex items-center gap-1 text-rose-700">
                    <span className="w-2 h-2 rounded-full bg-rose-500" />
                    Previous Version ({diffAnalysis.stats.oldWordCount} words)
                  </span>
                  <span className="text-stone-400 font-normal">OneDrive Stored</span>
                </div>
                <div className="max-h-96 overflow-y-auto p-3 space-y-0.5 text-[11px] leading-relaxed select-text">
                  {diffData.existingContent.split('\n').map((line, idx) => (
                    <div
                      key={`old-${idx}`}
                      className="flex hover:bg-stone-50 py-0.5 px-1 rounded-xs"
                    >
                      <span className="text-stone-400 w-8 shrink-0 text-right pr-2 select-none">
                        {idx + 1}
                      </span>
                      <span className="text-stone-800 whitespace-pre-wrap break-all">
                        {line || ' '}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Right: New (Generated) */}
              <div className="flex flex-col bg-emerald-50/10">
                <div className="bg-emerald-50 border-b border-emerald-100 px-3 py-2 font-semibold text-emerald-800 flex justify-between items-center text-[11px]">
                  <span className="flex items-center gap-1">
                    <Sparkles className="w-3 h-3 text-emerald-600" />
                    Newly Generated ({diffAnalysis.stats.newWordCount} words)
                  </span>
                  <span className="text-emerald-700 font-normal">Proposed Overwrite</span>
                </div>
                <div className="max-h-96 overflow-y-auto p-3 space-y-0.5 text-[11px] leading-relaxed select-text bg-emerald-50/20">
                  {diffData.newContent.split('\n').map((line, idx) => (
                    <div
                      key={`new-${idx}`}
                      className="flex hover:bg-emerald-100/40 py-0.5 px-1 rounded-xs"
                    >
                      <span className="text-stone-400 w-8 shrink-0 text-right pr-2 select-none">
                        {idx + 1}
                      </span>
                      <span className="text-stone-900 whitespace-pre-wrap break-all">
                        {line || ' '}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            /* Unified Mode */
            <div className="max-h-96 overflow-y-auto p-3 font-mono text-[11px] leading-relaxed space-y-0.5 select-text">
              {diffAnalysis.lines.map((line, idx) => {
                if (line.type === 'unchanged') {
                  return (
                    <div
                      key={`uni-${idx}`}
                      className="flex py-0.5 px-1 text-stone-600 hover:bg-stone-50"
                    >
                      <span className="w-8 text-right pr-2 text-stone-400 select-none">
                        {line.oldLineNum}
                      </span>
                      <span className="w-8 text-right pr-2 text-stone-400 select-none">
                        {line.newLineNum}
                      </span>
                      <span className="w-4 select-none text-stone-300"> </span>
                      <span className="whitespace-pre-wrap break-all">{line.oldText || ' '}</span>
                    </div>
                  );
                }

                if (line.type === 'modified') {
                  return (
                    <div key={`uni-${idx}`} className="space-y-0.5">
                      <div className="flex py-0.5 px-1 bg-rose-50/80 text-rose-900 border-l-2 border-rose-500">
                        <span className="w-8 text-right pr-2 text-rose-400 select-none">
                          {line.oldLineNum}
                        </span>
                        <span className="w-8 text-right pr-2 text-stone-300 select-none">-</span>
                        <span className="w-4 select-none text-rose-600 font-bold">-</span>
                        <span className="whitespace-pre-wrap break-all">{line.oldText || ' '}</span>
                      </div>
                      <div className="flex py-0.5 px-1 bg-emerald-50/80 text-emerald-900 border-l-2 border-emerald-500">
                        <span className="w-8 text-right pr-2 text-stone-300 select-none">-</span>
                        <span className="w-8 text-right pr-2 text-emerald-500 select-none">
                          {line.newLineNum}
                        </span>
                        <span className="w-4 select-none text-emerald-600 font-bold">+</span>
                        <span className="whitespace-pre-wrap break-all">{line.newText || ' '}</span>
                      </div>
                    </div>
                  );
                }

                if (line.type === 'removed') {
                  return (
                    <div
                      key={`uni-${idx}`}
                      className="flex py-0.5 px-1 bg-rose-50/80 text-rose-900 border-l-2 border-rose-500"
                    >
                      <span className="w-8 text-right pr-2 text-rose-400 select-none">
                        {line.oldLineNum}
                      </span>
                      <span className="w-8 text-right pr-2 text-stone-300 select-none">-</span>
                      <span className="w-4 select-none text-rose-600 font-bold">-</span>
                      <span className="whitespace-pre-wrap break-all">{line.oldText || ' '}</span>
                    </div>
                  );
                }

                return (
                  <div
                    key={`uni-${idx}`}
                    className="flex py-0.5 px-1 bg-emerald-50/80 text-emerald-900 border-l-2 border-emerald-500"
                  >
                    <span className="w-8 text-right pr-2 text-stone-300 select-none">-</span>
                    <span className="w-8 text-right pr-2 text-emerald-500 select-none">
                      {line.newLineNum}
                    </span>
                    <span className="w-4 select-none text-emerald-600 font-bold">+</span>
                    <span className="whitespace-pre-wrap break-all">{line.newText || ' '}</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-between pt-2 border-t border-stone-200">
          <Button variant="ghost" size="sm" onClick={onClose} disabled={isOverwriting}>
            Cancel & Keep Existing
          </Button>

          <div className="flex items-center gap-2">
            <Button
              variant="primary"
              size="sm"
              onClick={() => onConfirmOverwrite(diffData)}
              disabled={isOverwriting}
              isLoading={isOverwriting}
              leftIcon={<Check className="w-3.5 h-3.5" />}
              className="bg-emerald-600 hover:bg-emerald-700"
            >
              Confirm & Overwrite in OneDrive
            </Button>
          </div>
        </div>
      </div>
    </Modal>
  );
}
