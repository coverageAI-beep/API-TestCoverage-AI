import { forwardRef, type InputHTMLAttributes, type ReactNode } from 'react';
import { cn } from '../../lib/utils';

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  helperText?: string;
  leftElement?: ReactNode;
  rightElement?: ReactNode;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  (
    {
      className,
      type = 'text',
      label,
      error,
      helperText,
      leftElement,
      rightElement,
      id,
      ...props
    },
    ref
  ) => {
    const inputId = id || (label ? label.toLowerCase().replace(/\s+/g, '-') : undefined);

    return (
      <div className="w-full flex flex-col gap-1.5 text-left">
        {label && (
          <label
            htmlFor={inputId}
            className="text-xs font-medium text-stone-700 select-none flex items-center justify-between"
          >
            <span>{label}</span>
          </label>
        )}
        <div className="relative flex items-center">
          {leftElement && (
            <div className="absolute left-3 text-stone-400 pointer-events-none flex items-center">
              {leftElement}
            </div>
          )}
          <input
            id={inputId}
            type={type}
            ref={ref}
            className={cn(
              'w-full h-9 rounded-md border bg-white px-3 py-1.5 text-sm text-stone-900 placeholder:text-stone-400 transition-colors duration-150',
              'focus:outline-none focus:ring-2 focus:ring-indigo-600 focus:border-transparent',
              'disabled:cursor-not-allowed disabled:bg-stone-50 disabled:text-stone-500',
              leftElement ? 'pl-9' : '',
              rightElement ? 'pr-9' : '',
              error
                ? 'border-red-500 focus:ring-red-500'
                : 'border-stone-300 hover:border-stone-400',
              className
            )}
            {...props}
          />
          {rightElement && (
            <div className="absolute right-3 text-stone-400 flex items-center">
              {rightElement}
            </div>
          )}
        </div>
        {error && <p className="text-xs text-red-600">{error}</p>}
        {helperText && !error && (
          <p className="text-xs text-stone-500">{helperText}</p>
        )}
      </div>
    );
  }
);

Input.displayName = 'Input';
