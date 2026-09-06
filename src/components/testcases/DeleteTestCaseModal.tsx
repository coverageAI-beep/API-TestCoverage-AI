import { useState } from 'react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import type { TestCase } from '../../types';
import { AlertTriangle, Trash2 } from 'lucide-react';

interface DeleteTestCaseModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => Promise<void> | void;
  testCase: TestCase | null;
  apiName: string;
}

export function DeleteTestCaseModal({
  isOpen,
  onClose,
  onConfirm,
  testCase,
  apiName,
}: DeleteTestCaseModalProps) {
  const [isDeleting, setIsDeleting] = useState(false);

  if (!testCase) return null;

  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      await onConfirm();
      onClose();
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Delete Test Case Confirmation"
      description={`Are you sure you want to delete this test case from ${apiName}?`}
      maxWidth="sm"
      footer={
        <div className="flex items-center justify-end gap-2 w-full">
          <Button variant="ghost" size="sm" onClick={onClose} disabled={isDeleting}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            size="sm"
            onClick={handleDelete}
            isLoading={isDeleting}
            leftIcon={<Trash2 className="w-4 h-4" />}
          >
            Delete from OneDrive
          </Button>
        </div>
      }
    >
      <div className="space-y-3 text-xs">
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2.5 text-red-800">
          <AlertTriangle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
          <div>
            <div className="font-semibold mb-1">Permanent Removal</div>
            <div>
              This action will remove test case <code className="bg-red-100 px-1 py-0.5 rounded font-mono font-medium">{testCase.id}</code> from the test suite and immediately synchronize the changes with your OneDrive JSON file via Microsoft Graph.
            </div>
          </div>
        </div>

        <div className="border border-stone-200 rounded-lg p-3 bg-stone-50 space-y-1.5">
          <div className="flex items-center gap-2">
            <span className="font-mono text-stone-500 font-semibold">{testCase.id}</span>
            <span className="text-stone-300">•</span>
            <span className="font-medium text-stone-900">{testCase.title}</span>
          </div>
          <div className="text-[11px] text-stone-600 flex items-center gap-2 flex-wrap font-mono">
            <span className="bg-stone-200 px-1.5 py-0.5 rounded text-stone-800">{testCase.linkedEndpoint}</span>
            <span>Type: <b>{testCase.type}</b></span>
            <span>Priority: <b>{testCase.priority}</b></span>
            <span>Source: <b>{testCase.source}</b></span>
          </div>
        </div>
      </div>
    </Modal>
  );
}
