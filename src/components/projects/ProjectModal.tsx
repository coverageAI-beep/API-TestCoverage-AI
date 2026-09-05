import { useState, useEffect, useRef, type FormEvent } from 'react';
import { Modal } from '../ui/Modal';
import { Input } from '../ui/Input';
import { Button } from '../ui/Button';
import { useProjects } from '../../context/ProjectContext';
import { useToast } from '../ui/Toast';
import type { Project } from '../../types';
import { Globe, FileText, FolderGit2 } from 'lucide-react';

interface ProjectModalProps {
  isOpen: boolean;
  onClose: () => void;
  projectToEdit?: Project | null;
  onSuccess?: (project: Project) => void;
}

export function ProjectModal({
  isOpen,
  onClose,
  projectToEdit,
  onSuccess,
}: ProjectModalProps) {
  const { createProject, updateProject } = useProjects();
  const { showToast } = useToast();

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [targetEnvironmentUrl, setTargetEnvironmentUrl] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const nameInputRef = useRef<HTMLInputElement>(null);

  const isEditing = Boolean(projectToEdit);

  useEffect(() => {
    if (isOpen) {
      if (projectToEdit) {
        setName(projectToEdit.name);
        setDescription(projectToEdit.description || '');
        setTargetEnvironmentUrl(projectToEdit.targetEnvironmentUrl || '');
      } else {
        setName('');
        setDescription('');
        setTargetEnvironmentUrl('');
      }
      setError(null);
      setIsSubmitting(false);

      // Auto-focus first field
      setTimeout(() => {
        nameInputRef.current?.focus();
      }, 50);
    }
  }, [isOpen, projectToEdit]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const trimmedName = name.trim();

    if (!trimmedName) {
      setError('Project name is required');
      nameInputRef.current?.focus();
      return;
    }

    // Optional environment URL validation
    const trimmedUrl = targetEnvironmentUrl.trim();
    if (trimmedUrl && !/^https?:\/\/.+/i.test(trimmedUrl)) {
      setError('Target environment URL must start with http:// or https://');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      if (isEditing && projectToEdit) {
        const updated = await updateProject(projectToEdit.id, {
          name: trimmedName,
          description: description.trim(),
          targetEnvironmentUrl: trimmedUrl || undefined,
        });
        showToast({
          type: 'success',
          title: 'Project updated',
          description: `"${updated.name}" has been updated successfully.`,
        });
        onSuccess?.(updated);
      } else {
        const created = await createProject({
          name: trimmedName,
          description: description.trim(),
          targetEnvironmentUrl: trimmedUrl || undefined,
        });
        showToast({
          type: 'success',
          title: 'Project created',
          description: `"${created.name}" is now your active workspace.`,
        });
        onSuccess?.(created);
      }
      onClose();
    } catch (err) {
      console.error('Failed to save project:', err);
      setError(err instanceof Error ? err.message : 'Failed to save project');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={isEditing ? 'Edit Project Specifications' : 'Create New Project'}
      description={
        isEditing
          ? 'Update project workspace metadata, target hosts, and configuration.'
          : 'Define a new isolated workspace for API contracts, specifications, and test suites.'
      }
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <Input
          ref={nameInputRef}
          label="Project Name *"
          placeholder="e.g. Payments Ingestion Gateway"
          value={name}
          onChange={(e) => {
            setName(e.target.value);
            if (error) setError(null);
          }}
          error={error && error.includes('name') ? error : undefined}
          leftElement={<FolderGit2 className="w-4 h-4" />}
          autoComplete="off"
        />

        <div className="flex flex-col gap-1.5 text-left">
          <label
            htmlFor="project-desc"
            className="text-xs font-medium text-stone-700 select-none flex items-center justify-between"
          >
            <span>Description (optional)</span>
            <span className="text-[11px] text-stone-400">Brief summary of service scope</span>
          </label>
          <div className="relative flex">
            <textarea
              id="project-desc"
              rows={2}
              className="w-full rounded-md border border-stone-300 bg-white px-3 py-2 text-sm text-stone-900 placeholder:text-stone-400 transition-colors duration-150 focus:outline-none focus:ring-2 focus:ring-indigo-600 focus:border-transparent hover:border-stone-400"
              placeholder="e.g. OpenAPI 3.1 specifications and automated test fixtures for merchant reconciliation."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>
        </div>

        <Input
          label="Target Environment Base URL (optional)"
          placeholder="https://api.staging.acme.com"
          value={targetEnvironmentUrl}
          onChange={(e) => {
            setTargetEnvironmentUrl(e.target.value);
            if (error) setError(null);
          }}
          helperText="Base host endpoint for automated contract checks and test suites."
          error={error && error.includes('URL') ? error : undefined}
          leftElement={<Globe className="w-4 h-4" />}
          autoComplete="off"
        />

        {error && !error.includes('name') && !error.includes('URL') && (
          <div className="p-2.5 rounded-md bg-red-50 border border-red-200 text-xs text-red-700">
            {error}
          </div>
        )}

        <div className="flex items-center justify-end gap-3 pt-3 border-t border-stone-100">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onClose}
            disabled={isSubmitting}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            variant="primary"
            size="sm"
            isLoading={isSubmitting}
          >
            {isEditing ? 'Save Changes' : 'Create Project'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
