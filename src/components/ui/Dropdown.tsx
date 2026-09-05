import { useState, useRef, useEffect, type ReactNode } from 'react';
import { cn } from '../../lib/utils';

export interface DropdownProps {
  trigger: (props: { isOpen: boolean; toggle: () => void }) => ReactNode;
  children: (props: { close: () => void }) => ReactNode;
  align?: 'left' | 'right';
  className?: string;
}

export function Dropdown({
  trigger,
  children,
  align = 'left',
  className,
}: DropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const toggle = () => setIsOpen((prev) => !prev);
  const close = () => setIsOpen(false);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleEscape);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [isOpen]);

  return (
    <div ref={containerRef} className="relative inline-block text-left">
      {trigger({ isOpen, toggle })}
      {isOpen && (
        <div
          className={cn(
            'absolute z-40 mt-1 min-w-[200px] rounded-lg bg-white p-1 shadow-lg border border-stone-200',
            'animate-in fade-in-0 zoom-in-95 duration-100',
            align === 'right' ? 'right-0' : 'left-0',
            className
          )}
        >
          {children({ close })}
        </div>
      )}
    </div>
  );
}

export interface DropdownItemProps {
  onClick?: () => void;
  children: ReactNode;
  icon?: ReactNode;
  destructive?: boolean;
  disabled?: boolean;
  className?: string;
}

export function DropdownItem({
  onClick,
  children,
  icon,
  destructive = false,
  disabled = false,
  className,
}: DropdownItemProps) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={cn(
        'w-full flex items-center gap-2 px-2.5 py-1.5 text-xs rounded-md transition-colors text-left select-none',
        destructive
          ? 'text-red-600 hover:bg-red-50 focus:bg-red-50'
          : 'text-stone-700 hover:bg-stone-100 hover:text-stone-900 focus:bg-stone-100',
        disabled && 'opacity-50 pointer-events-none',
        className
      )}
    >
      {icon && <span className="w-4 h-4 flex items-center justify-center shrink-0">{icon}</span>}
      <span className="truncate flex-1">{children}</span>
    </button>
  );
}
