import type { ReactNode } from 'react';

// Button Component
interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  children: ReactNode;
  isLoading?: boolean;
}

export function Button({
  variant = 'primary',
  size = 'md',
  isLoading = false,
  className = '',
  disabled,
  children,
  ...props
}: ButtonProps) {
  const baseClass = 'btn';
  const variantClass = `btn-${variant}`;
  const sizeClass = size !== 'md' ? `btn-${size}` : '';
  
  return (
    <button
      className={`${baseClass} ${variantClass} ${sizeClass} ${className}`}
      disabled={disabled || isLoading}
      {...props}
    >
      {isLoading ? (
        <>
          <div className="spinner-sm" style={{ display: 'inline-block' }}>
            <div className="spinner-circle" style={{ width: '16px', height: '16px' }} />
          </div>
          Loading...
        </>
      ) : (
        children
      )}
    </button>
  );
}

// Text Input Component
interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  hint?: string;
  error?: string;
  variant?: 'text' | 'number' | 'email' | 'tel' | 'date' | 'time';
}

export function Input({
  label,
  hint,
  error,
  variant = 'text',
  className = '',
  id,
  ...props
}: InputProps) {
  const inputId = id || `input-${Math.random().toString(36).slice(2)}`;
  
  return (
    <div className="form-group">
      {label && (
        <label htmlFor={inputId} className="form-label">
          {label}
        </label>
      )}
      <input
        id={inputId}
        type={variant}
        className={`form-input ${error ? 'border-error' : ''} ${className}`}
        style={error ? { borderColor: 'var(--color-error)' } : {}}
        {...props}
      />
      {error && <div className="form-error">{error}</div>}
      {hint && !error && <div className="form-hint">{hint}</div>}
    </div>
  );
}

// Textarea Component
interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  hint?: string;
  error?: string;
}

export function Textarea({
  label,
  hint,
  error,
  className = '',
  id,
  ...props
}: TextareaProps) {
  const textareaId = id || `textarea-${Math.random().toString(36).slice(2)}`;
  
  return (
    <div className="form-group">
      {label && (
        <label htmlFor={textareaId} className="form-label">
          {label}
        </label>
      )}
      <textarea
        id={textareaId}
        className={`form-textarea ${error ? 'border-error' : ''} ${className}`}
        style={error ? { borderColor: 'var(--color-error)' } : {}}
        {...props}
      />
      {error && <div className="form-error">{error}</div>}
      {hint && !error && <div className="form-hint">{hint}</div>}
    </div>
  );
}

// Card Component
interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
  className?: string;
  elevated?: boolean;
  dense?: boolean;
}

export function Card({ children, className = '', elevated = false, dense = false, ...props }: CardProps) {
  const cardClass = `card ${elevated ? 'card-elevated' : ''} ${dense ? 'card-dense' : ''} ${className}`;
  return <div className={cardClass} {...props}>{children}</div>;
}

// Badge Component
interface BadgeProps {
  children: ReactNode;
  variant?: 'default' | 'secondary' | 'success' | 'error';
  className?: string;
}

export function Badge({ children, variant = 'default', className = '' }: BadgeProps) {
  const badgeClass = `badge ${variant !== 'default' ? `badge-${variant}` : ''} ${className}`;
  return <span className={badgeClass}>{children}</span>;
}

// Divider Component
interface DividerProps {
  dashed?: boolean;
  className?: string;
}

export function Divider({ dashed = false, className = '' }: DividerProps) {
  return <hr className={`${dashed ? 'divider-dashed' : 'divider'} ${className}`} />;
}

// Alert Component
interface AlertProps {
  children: ReactNode;
  type?: 'info' | 'success' | 'error' | 'warning';
  title?: string;
  className?: string;
}

export function Alert({ children, type = 'info', title, className = '' }: AlertProps) {
  const alertClass = `alert alert-${type} ${className}`;
  return (
    <div className={alertClass} role="alert">
      {title && <h4 className="alert-title">{title}</h4>}
      {children}
    </div>
  );
}

// Progress Stepper Component
interface ProgressStepperProps {
  steps: string[];
  currentStep: number;
  className?: string;
}

export function ProgressStepper({ steps, currentStep, className = '' }: ProgressStepperProps) {
  return (
    <div className={`progress-stepper ${className}`}>
      {steps.map((step, index) => (
        <div
          key={index}
          className={`progress-step ${index < currentStep ? 'active' : ''} ${index < currentStep - 1 ? 'completed' : ''}`}
        >
          <div className="progress-circle">{index + 1}</div>
          <p className="progress-label">{step}</p>
        </div>
      ))}
    </div>
  );
}

// Loading Spinner Component
interface SpinnerProps {
  size?: 'sm' | 'md' | 'lg';
  message?: string;
  className?: string;
}

export function Spinner({ size = 'md', message, className = '' }: SpinnerProps) {
  return (
    <div className={`spinner spinner-${size} ${className}`}>
      <div className="spinner-circle" />
      {message && <p className="spinner-message">{message}</p>}
    </div>
  );
}
