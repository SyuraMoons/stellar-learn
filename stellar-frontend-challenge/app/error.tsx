/**
 * App Router error boundary — catches render/runtime errors anywhere in the
 * dashboard tree (e.g. an unexpected RPC/wallet-kit throw that isn't already
 * caught by a component's own try/catch) so the user sees a recoverable
 * screen instead of a blank page.
 */

'use client';

import { useEffect } from 'react';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-white px-4 text-center text-neutral-900">
      <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full border border-neutral-200 text-neutral-400">
        !
      </div>
      <h1 className="mb-2 text-lg font-semibold">Something went wrong</h1>
      <p className="mb-6 max-w-sm text-sm text-neutral-500">
        An unexpected error interrupted the dashboard. Your funds and any
        in-progress escrow are unaffected — this only affects this page.
      </p>
      <button
        onClick={reset}
        className="rounded-xl bg-neutral-900 px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-neutral-700"
      >
        Try again
      </button>
    </div>
  );
}
