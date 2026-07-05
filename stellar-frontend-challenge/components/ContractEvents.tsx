/**
 * ContractEvents Component — real-time kirim-escrow contract activity.
 *
 * Polls Soroban RPC getEvents every few seconds and renders the contract's
 * created / claimed / refunded events as a live feed.
 */

'use client';

import { useState, useEffect, useCallback } from 'react';
import { stellar } from '@/lib/stellar-helper';
import { fetchContractEvents, type ContractEvent } from '@/lib/contract-events';
import { FaLock, FaLockOpen, FaUndo, FaExternalLinkAlt } from 'react-icons/fa';
import { Card, EmptyState } from './example-components';

const POLL_MS = 6000;

const EVENT_META: Record<
  string,
  { label: string; icon: React.ReactNode }
> = {
  created: { label: 'Locked in escrow', icon: <FaLock className="text-xs" /> },
  claimed: { label: 'Claimed', icon: <FaLockOpen className="text-xs" /> },
  refunded: { label: 'Refunded', icon: <FaUndo className="text-xs" /> },
};

function relativeTime(date: Date): string {
  const diffMins = Math.floor((Date.now() - date.getTime()) / 60000);
  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export default function ContractEvents() {
  const [events, setEvents] = useState<ContractEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const poll = useCallback(async () => {
    try {
      const list = await fetchContractEvents();
      setEvents(list);
      setError(false);
    } catch (err) {
      console.error('Error fetching contract events:', err);
      setError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    poll();
    const timer = setInterval(poll, POLL_MS);
    return () => clearInterval(timer);
  }, [poll]);

  return (
    <Card>
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-semibold tracking-tight text-neutral-900">
          Contract activity
        </h2>
        <span className="flex items-center gap-1.5 rounded-full border border-neutral-200 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-widest text-neutral-500">
          <span
            className={`h-1.5 w-1.5 rounded-full ${
              error ? 'bg-red-400' : 'animate-pulse bg-emerald-500'
            }`}
          />
          {error ? 'Offline' : 'Live'}
        </span>
      </div>

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="animate-pulse">
              <div className="h-12 rounded-xl bg-neutral-100" />
            </div>
          ))}
        </div>
      ) : events.length === 0 ? (
        <EmptyState
          title="No contract events yet"
          description="Escrow creations, claims, and refunds from the last hours appear here in real time."
        />
      ) : (
        <div className="max-h-80 divide-y divide-neutral-100 overflow-y-auto">
          {events.map((ev) => {
            const meta = EVENT_META[ev.type] ?? {
              label: ev.type,
              icon: <FaLock className="text-xs" />,
            };
            return (
              <div key={ev.id} className="flex items-center gap-3 py-3 first:pt-0">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-neutral-200 text-neutral-500">
                  {meta.icon}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-neutral-900">
                    {meta.label}
                    {ev.amountXlm && (
                      <span className="ml-1.5 [font-variant-numeric:tabular-nums]">
                        · {ev.amountXlm} XLM
                      </span>
                    )}
                  </p>
                  <p className="truncate font-mono text-xs text-neutral-400">
                    {ev.counterparty
                      ? `→ ${stellar.formatAddress(ev.counterparty, 4, 4)} · `
                      : ''}
                    {relativeTime(ev.at)}
                  </p>
                </div>
                {ev.txHash && (
                  <a
                    href={stellar.getExplorerLink(ev.txHash, 'tx')}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="shrink-0 rounded-lg p-2 text-neutral-400 transition-colors hover:bg-neutral-100 hover:text-neutral-900"
                    title="View on Stellar Expert"
                  >
                    <FaExternalLinkAlt className="text-xs" />
                  </a>
                )}
              </div>
            );
          })}
        </div>
      )}

      <p className="mt-4 text-center text-xs text-neutral-400">
        Polling Soroban RPC every {POLL_MS / 1000}s
      </p>
    </Card>
  );
}
