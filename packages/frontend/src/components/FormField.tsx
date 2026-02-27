import { forwardRef, type InputHTMLAttributes, type SelectHTMLAttributes, type TextareaHTMLAttributes, type ReactNode } from 'react';
import clsx from 'clsx';

/* ------------------------------------------------------------------ */
/*  Shared input styling                                               */
/* ------------------------------------------------------------------ */

const inputBase =
  'w-full px-4 py-2 border border-spa-bg-secondary rounded-lg text-spa-text-primary bg-white focus:outline-none focus:ring-2 focus:ring-spa-primary focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed transition-colors';

const inputError =
  'border-spa-error focus:ring-spa-error';

/* ------------------------------------------------------------------ */
/*  Label + Error wrapper                                              */
/* ------------------------------------------------------------------ */

interface FieldWrapperProps {
  label?: string;
  htmlFor?: string;
  error?: string;
  hint?: string;
  required?: boolean;
  children: ReactNode;
  className?: string;
}

export function FieldWrapper({
  label,
  htmlFor,
  error,
  hint,
  required,
  children,
  className,
}: FieldWrapperProps) {
  return (
    <div className={className}>
      {label && (
        <label
          htmlFor={htmlFor}
          className="block text-sm font-medium text-spa-text-primary mb-1"
        >
          {label}
          {required && <span className="text-spa-error ml-0.5">*</span>}
        </label>
      )}
      {children}
      {hint && !error && (
        <p className="text-xs text-spa-text-secondary mt-1">{hint}</p>
      )}
      {error && (
        <p className="text-sm text-spa-error mt-1" role="alert">{error}</p>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Input                                                              */
/* ------------------------------------------------------------------ */

interface InputFieldProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  hint?: string;
}

export const InputField = forwardRef<HTMLInputElement, InputFieldProps>(
  function InputField({ label, error, hint, required, className, id, ...rest }, ref) {
    const fieldId = id || rest.name;
    return (
      <FieldWrapper label={label} htmlFor={fieldId} error={error} hint={hint} required={required} className={className}>
        <input
          ref={ref}
          id={fieldId}
          required={required}
          className={clsx(inputBase, error && inputError)}
          {...rest}
        />
      </FieldWrapper>
    );
  },
);

/* ------------------------------------------------------------------ */
/*  Select                                                             */
/* ------------------------------------------------------------------ */

interface SelectFieldProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
  hint?: string;
  children: ReactNode;
}

export const SelectField = forwardRef<HTMLSelectElement, SelectFieldProps>(
  function SelectField({ label, error, hint, required, className, id, children, ...rest }, ref) {
    const fieldId = id || rest.name;
    return (
      <FieldWrapper label={label} htmlFor={fieldId} error={error} hint={hint} required={required} className={className}>
        <select
          ref={ref}
          id={fieldId}
          required={required}
          className={clsx(inputBase, error && inputError)}
          {...rest}
        >
          {children}
        </select>
      </FieldWrapper>
    );
  },
);

/* ------------------------------------------------------------------ */
/*  Textarea                                                           */
/* ------------------------------------------------------------------ */

interface TextareaFieldProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
  hint?: string;
}

export const TextareaField = forwardRef<HTMLTextAreaElement, TextareaFieldProps>(
  function TextareaField({ label, error, hint, required, className, id, ...rest }, ref) {
    const fieldId = id || rest.name;
    return (
      <FieldWrapper label={label} htmlFor={fieldId} error={error} hint={hint} required={required} className={className}>
        <textarea
          ref={ref}
          id={fieldId}
          required={required}
          className={clsx(inputBase, error && inputError)}
          {...rest}
        />
      </FieldWrapper>
    );
  },
);

/* ------------------------------------------------------------------ */
/*  Toggle / Switch                                                    */
/* ------------------------------------------------------------------ */

interface ToggleFieldProps {
  label: string;
  description?: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
  className?: string;
}

export function ToggleField({
  label,
  description,
  checked,
  onChange,
  disabled = false,
  className,
}: ToggleFieldProps) {
  return (
    <label
      className={clsx(
        'flex items-center justify-between gap-3 cursor-pointer',
        disabled && 'opacity-50 cursor-not-allowed',
        className,
      )}
    >
      <div>
        <span className="text-sm font-medium text-spa-text-primary">{label}</span>
        {description && (
          <p className="text-xs text-spa-text-secondary mt-0.5">{description}</p>
        )}
      </div>
      <div className="relative inline-flex items-center flex-shrink-0">
        <input
          type="checkbox"
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
          disabled={disabled}
          className="sr-only peer"
        />
        <div
          className={clsx(
            'w-11 h-6 rounded-full transition-colors',
            'peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-spa-primary/20',
            'after:content-[\'\'] after:absolute after:top-[2px] after:left-[2px]',
            'after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all',
            'peer-checked:after:translate-x-full',
            checked ? 'bg-spa-primary' : 'bg-gray-300',
          )}
        />
      </div>
    </label>
  );
}
