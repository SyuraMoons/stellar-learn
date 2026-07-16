/**
 * UI Primitives — Kirim design system
 *
 * Monochrome, dominant-white look: white surfaces, hairline neutral borders,
 * near-black text, solid black primary actions. Semantic color (muted
 * red/green) is reserved for success/error states only.
 */

'use client';

import { useState } from 'react';

// Loading Spinner
export function LoadingSpinner({ className = '' }: { className?: string }) {
  return (
    <span
      className={`inline-block h-4 w-4 animate-spin rounded-full border-2 border-solid border-current border-r-transparent align-[-0.125em] motion-reduce:animate-[spin_1.5s_linear_infinite] ${className}`}
      role="status"
      aria-label="Loading"
    />
  );
}

// Skeleton — shared loading placeholder shape used across the dashboard
// cards (balance, history, escrow, events) so loading states feel like one
// consistent system instead of each component inventing its own pulse block.
export function Skeleton({ className = '' }: { className?: string }) {
  return (
    <div
      className={`animate-pulse rounded bg-neutral-100 ${className}`}
      role="status"
      aria-label="Loading"
    />
  );
}

// Copy to Clipboard Button
export function CopyButton({ text, label }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <button
      onClick={handleCopy}
      className="text-sm text-neutral-500 hover:text-neutral-900 transition-colors duration-150"
    >
      {copied ? '✓ Copied' : label || 'Copy'}
    </button>
  );
}

// Alert Component
export function Alert({
  type,
  message,
  onClose,
}: {
  type: 'success' | 'error' | 'info';
  message: string;
  onClose?: () => void;
}) {
  const styles = {
    success: 'border-emerald-200 bg-emerald-50 text-emerald-800',
    error: 'border-red-200 bg-red-50 text-red-700',
    info: 'border-neutral-200 bg-neutral-50 text-neutral-700',
  };

  return (
    <div
      className={`${styles[type]} animate-fade-up flex items-start justify-between gap-3 rounded-xl border px-4 py-3 text-sm`}
      role="alert"
    >
      <span className="leading-relaxed">{message}</span>
      {onClose && (
        <button
          onClick={onClose}
          className="shrink-0 opacity-60 transition-opacity hover:opacity-100"
          aria-label="Dismiss"
        >
          ✕
        </button>
      )}
    </div>
  );
}

// Card Component
export function Card({
  title,
  children,
  className = '',
}: {
  title?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm ${className}`}
    >
      {title && (
        <h2 className="mb-4 text-lg font-semibold tracking-tight text-neutral-900">
          {title}
        </h2>
      )}
      {children}
    </div>
  );
}

// Input Component
export function Input({
  label,
  placeholder,
  type = 'text',
  value,
  onChange,
  error,
  mono = false,
}: {
  label: string;
  placeholder?: string;
  type?: string;
  value: string;
  onChange: (value: string) => void;
  error?: string;
  mono?: boolean;
}) {
  return (
    <div>
      <label className="mb-1.5 block text-sm font-medium text-neutral-700">
        {label}
      </label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className={`w-full rounded-xl border bg-white px-4 py-3 text-sm text-neutral-900 placeholder-neutral-400 transition-colors duration-150 focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-neutral-900 ${
          error ? 'border-red-300' : 'border-neutral-300'
        } ${mono ? 'font-mono' : ''}`}
      />
      {error && <p className="mt-1.5 text-sm text-red-600">{error}</p>}
    </div>
  );
}

// Button Component
export function Button({
  children,
  onClick,
  variant = 'primary',
  disabled = false,
  fullWidth = false,
  type = 'button',
}: {
  children: React.ReactNode;
  onClick?: () => void;
  variant?: 'primary' | 'secondary' | 'danger';
  disabled?: boolean;
  fullWidth?: boolean;
  type?: 'button' | 'submit';
}) {
  const variants = {
    primary:
      'bg-neutral-900 text-white hover:bg-neutral-700 focus-visible:ring-neutral-900',
    secondary:
      'bg-white text-neutral-900 border border-neutral-300 hover:bg-neutral-50 focus-visible:ring-neutral-400',
    danger:
      'bg-white text-red-600 border border-neutral-300 hover:border-red-300 hover:bg-red-50 focus-visible:ring-red-400',
  };

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`${variants[variant]} ${
        fullWidth ? 'w-full' : ''
      } rounded-xl px-5 py-3 text-sm font-semibold transition-all duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-40`}
    >
      {children}
    </button>
  );
}

// Empty State Component
export function EmptyState({
  title,
  description,
}: {
  icon?: string;
  title: string;
  description: string;
}) {
  return (
    <div className="py-12 text-center">
      <div className="mx-auto mb-4 flex h-10 w-10 items-center justify-center rounded-full border border-neutral-200 text-neutral-400">
        —
      </div>
      <h3 className="mb-1 text-sm font-semibold text-neutral-900">{title}</h3>
      <p className="mx-auto max-w-xs text-sm text-neutral-500">{description}</p>
    </div>
  );
}

// Modal Component
export function Modal({
  isOpen,
  onClose,
  title,
  children,
}: {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-neutral-900/40 p-4 backdrop-blur-sm">
      <div className="animate-fade-up w-full max-w-md rounded-2xl border border-neutral-200 bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-neutral-100 p-5">
          <h3 className="text-base font-semibold text-neutral-900">{title}</h3>
          <button
            onClick={onClose}
            className="text-neutral-400 transition-colors hover:text-neutral-900"
            aria-label="Close"
          >
            ✕
          </button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}
