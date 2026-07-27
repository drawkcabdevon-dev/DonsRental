import type { ReactNode } from 'react';
import { useState } from 'react';
import { api } from '../services/api';

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

// Chat Widget Component
interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

export function ChatWidget() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([
    { role: 'assistant', content: 'Hi! I\'m your Don\'s Rental booking assistant. How can I help you today?', timestamp: new Date() }
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const sendMessage = async () => {
    if (!input.trim() || isLoading) return;
    const userMessage = input.trim();
    setInput('');
    setMessages(prev => [...prev, { role: 'user', content: userMessage, timestamp: new Date() }]);
    setIsLoading(true);

    try {
      const { response, bookingRef } = await api.chat(userMessage);
      setMessages(prev => [...prev, { role: 'assistant', content: response, timestamp: new Date() }]);
      // If booking was created, could trigger something here
      if (bookingRef) {
        console.log('Booking created:', bookingRef);
      }
    } catch (error) {
      setMessages(prev => [...prev, { role: 'assistant', content: 'Sorry, something went wrong. Please try again.', timestamp: new Date() }]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  return (
    <div className={`chat-widget ${isOpen ? 'open' : ''}`}>
      <button
        className="chat-toggle"
        onClick={() => setIsOpen(!isOpen)}
        aria-label={isOpen ? 'Close chat' : 'Open chat'}
      >
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          {isOpen ? (
            <path d="M18 6L6 18M6 6l12 12" />
          ) : (
            <>
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
            </>
          )}
        </svg>
        {!isOpen && messages.some(m => m.role === 'assistant') && <span className="chat-badge">1</span>}
      </button>

      <div className="chat-window">
        <div className="chat-header">
          <h3>💬 Chat with Don's Rental</h3>
          <button className="chat-close" onClick={() => setIsOpen(false)} aria-label="Close chat">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="chat-messages">
          {messages.map((msg, i) => (
            <div key={i} className={`chat-message ${msg.role}`}>
              <div className="message-bubble">
                <p>{msg.content}</p>
                <span className="message-time">{msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
              </div>
            </div>
          ))}
        </div>
        <div className="chat-input-area">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type your message..."
            rows={1}
            disabled={isLoading}
            className="chat-input"
          />
          <button
            className="chat-send"
            onClick={sendMessage}
            disabled={!input.trim() || isLoading}
            aria-label="Send message"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}
