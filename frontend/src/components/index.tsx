import type { ReactNode } from 'react';
import { useState } from 'react';
import { api } from '../services/api';
import { Check } from 'lucide-react';

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
      aria-busy={isLoading || undefined}
      {...props}
    >
      {isLoading ? (
        <>
          <div className="spinner-sm" style={{ display: 'inline-block' }} aria-hidden="true">
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
  const errorId = `${inputId}-error`;
  const hintId = `${inputId}-hint`;
  const isRequired = label?.includes('*');
  const describedBy = error ? errorId : hint ? hintId : undefined;

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
        aria-required={isRequired || undefined}
        aria-invalid={error ? 'true' : undefined}
        aria-describedby={describedBy}
        {...props}
      />
      {error && <div id={errorId} className="form-error" role="alert">{error}</div>}
      {hint && !error && <div id={hintId} className="form-hint">{hint}</div>}
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
  const errorId = `${textareaId}-error`;
  const hintId = `${textareaId}-hint`;
  const isRequired = label?.includes('*');
  const describedBy = error ? errorId : hint ? hintId : undefined;

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
        aria-required={isRequired || undefined}
        aria-invalid={error ? 'true' : undefined}
        aria-describedby={describedBy}
        {...props}
      />
      {error && <div id={errorId} className="form-error" role="alert">{error}</div>}
      {hint && !error && <div id={hintId} className="form-hint">{hint}</div>}
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
    <nav aria-label="Booking progress" className={`progress-stepper ${className}`} role="navigation">
      {steps.map((step, index) => {
        const isCurrent = index + 1 === currentStep;
        const isCompleted = index < currentStep - 1;
        return (
          <div
            key={index}
            className={`progress-step ${isCurrent ? 'active' : ''} ${isCompleted ? 'completed' : ''}`}
          >
            <div
              className="progress-circle"
              aria-current={isCurrent ? 'step' : undefined}
            >
              {isCompleted ? <Check size={14} /> : index + 1}
            </div>
            <p className="progress-label">{step}</p>
          </div>
        );
      })}
    </nav>
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
    <div className={`spinner spinner-${size} ${className}`} role="status" aria-live="polite">
      <div className="spinner-circle" aria-hidden="true" />
      {message && <p className="spinner-message">{message}</p>}
    </div>
  );
}

// Chat Widget Component
interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  suggestions?: string[];
}

function parseSuggestions(text: string): { clean: string; suggestions: string[] } {
  const match = text.match(/\[SUGGESTIONS\]\s*(.+?)$/m);
  if (match) {
    const suggestions = match[1].split('|').map(s => s.trim()).filter(Boolean);
    const clean = text.replace(/\[SUGGESTIONS\]\s*.+?$/m, '').trim();
    return { clean, suggestions };
  }
  return { clean: text, suggestions: [] };
}

const INITIAL_GREETING = "Hi! I'm Don's Rental booking assistant. I can help you book a car in Barbados. What dates do you need a car for?";
const INITIAL_SUGGESTIONS = [
  "I need a car for specific dates",
  "What's the daily rate?",
  "Tell me about the car",
];

export function ChatWidget() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([
    { role: 'assistant', content: INITIAL_GREETING, timestamp: new Date(), suggestions: INITIAL_SUGGESTIONS }
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const sendMessage = async (text?: string) => {
    const msg = text || input.trim();
    if (!msg || isLoading) return;
    setInput('');
    setMessages(prev => [...prev, { role: 'user', content: msg, timestamp: new Date() }]);
    setIsLoading(true);

    try {
      const { response, bookingRef } = await api.chat(msg);
      const { clean, suggestions } = parseSuggestions(response);
      setMessages(prev => [...prev, { role: 'assistant', content: clean, timestamp: new Date(), suggestions }]);
      if (bookingRef) {
        console.log('Booking created:', bookingRef);
      }
    } catch {
      setMessages(prev => [...prev, { role: 'assistant', content: 'Sorry, something went wrong. Please try again.', timestamp: new Date(), suggestions: INITIAL_SUGGESTIONS }]);
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

  // Get suggestions from the last assistant message
  const lastAssistant = [...messages].reverse().find(m => m.role === 'assistant');
  const activeSuggestions = lastAssistant?.suggestions || [];

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
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
          )}
        </svg>
        {!isOpen && messages.some(m => m.role === 'assistant') && <span className="chat-badge">1</span>}
      </button>

      <div className="chat-window">
        <div className="chat-header">
          <h3>Chat with Don's Rental</h3>
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
          {isLoading && (
            <div className="chat-message assistant">
              <div className="message-bubble">
                <p className="typing-dots">...</p>
              </div>
            </div>
          )}
        </div>
        {activeSuggestions.length > 0 && !isLoading && (
          <div className="chat-suggestions">
            {activeSuggestions.map((s, i) => (
              <button key={i} className="suggestion-chip" onClick={() => sendMessage(s)}>
                {s}
              </button>
            ))}
          </div>
        )}
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
            onClick={() => sendMessage()}
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
