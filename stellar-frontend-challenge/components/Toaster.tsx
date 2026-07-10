/**
 * Toaster — lightweight toast notifications for live contract events.
 *
 * Monochrome to match the rest of the design system. Auto-dismisses after
 * ~5s; the stack lives fixed at the bottom of the viewport (full-width on
 * mobile, a narrow column on larger screens) and announces politely via
 * aria-live so screen readers pick up new events without stealing focus.
 */

'use client';

import { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';
import { FaCheckCircle, FaInfoCircle } from 'react-icons/fa';

interface Toast {
  id: number;
  message: string;
  kind: 'info' | 'success';
}

interface ToastContextValue {
  showToast: (message: string, kind?: Toast['kind']) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

const AUTO_DISMISS_MS = 5000;

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    // Non-fatal fallback so a missing provider doesn't crash the page —
    // toasts just silently no-op instead of blocking the underlying flow.
    return { showToast: () => {} };
  }
  return ctx;
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const nextId = useRef(0);

  const showToast = useCallback(
    (message: string, kind: Toast['kind'] = 'info') => {
      const id = nextId.current++;
      setToasts((prev) => [...prev, { id, message, kind }]);
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
      }, AUTO_DISMISS_MS);
    },
    []
  );

  const value = useMemo(() => ({ showToast }), [showToast]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div
        aria-live="polite"
        className="pointer-events-none fixed inset-x-0 bottom-0 z-50 flex flex-col items-center gap-2 p-4 sm:items-end"
      >
        {toasts.map((t) => (
          <div
            key={t.id}
            className="animate-fade-up pointer-events-auto flex w-full max-w-sm items-center gap-2.5 rounded-xl border border-neutral-200 bg-white p-3 text-sm text-neutral-900 shadow-lg"
          >
            {t.kind === 'success' ? (
              <FaCheckCircle className="shrink-0 text-emerald-500" />
            ) : (
              <FaInfoCircle className="shrink-0 text-neutral-400" />
            )}
            <span className="min-w-0 flex-1">{t.message}</span>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
