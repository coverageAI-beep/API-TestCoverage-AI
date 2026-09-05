import { useEffect, useRef, type ReactNode } from 'react';
import { X } from 'lucide-react';
import { cn } from '../../lib/utils';

export interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: ReactNode;
  footer?: ReactNode;
  maxWidth?: 'sm' | 'md' | 'lg' | 'xl';
}

export function Modal({
  isOpen,
  onClose,
  title,
  description,
  children,
  footer,
  maxWidth = 'md',
}: ModalProps) {
  const modalRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && isOpen) {
        onClose();
      }
    };

    if (isOpen) {
      document.body.style.overflow = 'hidden';
      window.addEventListener('keydown', handleKeyDown);
    }

    return () => {
      document.body.style.overflow = '';
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const maxWidthClasses = {
    sm: 'max-w-sm',
    md: 'max-w-lg',
    lg: 'max-w-2xl',
    xl: 'max-w-3xl',
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6"
    >
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-stone-900/40 backdrop-blur-xs transition-opacity duration-150"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Modal dialog box */}
      <div
        ref={modalRef}
        className={cn(
          'relative w-full bg-white rounded-xl shadow-xl border border-stone-200 overflow-hidden z-10 flex flex-col',
          'animate-in fade-in-0 zoom-in-95 duration-150',
          maxWidthClasses[maxWidth]
        )}
      >
        {/* Header */}
        <div className="flex items-start justify-between px-6 py-5 border-b border-stone-100">
          <div>
            <h3 className="text-base font-semibold text-stone-900 leading-tight">
              {title}
            </h3>
            {description && (
              <p className="mt-1 text-xs text-stone-500 leading-normal">
                {description}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close modal"
            className="p-1 -mr-1 text-stone-400 hover:text-stone-700 rounded-md hover:bg-stone-100 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content body */}
        <div className="px-6 py-5 text-sm text-stone-700 overflow-y-auto max-h-[calc(85vh-130px)]">
          {children}
        </div>

        {/* Optional Footer */}
        {footer && (
          <div className="flex items-center justify-end gap-3 px-6 py-4 bg-stone-50/80 border-t border-stone-100">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}
