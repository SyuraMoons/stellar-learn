/**
 * TransactionHistory Component
 *
 * Recent payments for the connected wallet.
 *
 * Features:
 * - Sent/received direction with amount
 * - Counterparty address, relative time, link to Stellar Expert
 * - Loading skeleton, inline error with retry, empty state
 */

'use client';

import { useState, useEffect, useCallback } from 'react';
import { stellar } from '@/lib/stellar-helper';
import { FaSync, FaArrowUp, FaArrowDown } from 'react-icons/fa';
import { Card, EmptyState } from './example-components';

interface Transaction {
  id: string;
  type: string;
  amount?: string;
  asset?: string;
  from?: string;
  to?: string;
  createdAt: string;
  hash: string;
}

interface TransactionHistoryProps {
  publicKey: string;
}

export default function TransactionHistory({
  publicKey,
}: TransactionHistoryProps) {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(false);
  const limit = 10;

  const fetchTransactions = useCallback(async () => {
    try {
      setRefreshing(true);
      setError(false);
      const txs = await stellar.getRecentTransactions(publicKey, limit);
      setTransactions(txs);
    } catch (err) {
      console.error('Error fetching transactions:', err);
      setError(true);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [publicKey]);

  useEffect(() => {
    if (publicKey) {
      fetchTransactions();
    }
  }, [publicKey, fetchTransactions]);

  const formatDate = (dateString: string): string => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;

    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined,
    });
  };

  const formatAmount = (value?: string): string => {
    if (!value) return '';
    return parseFloat(value).toLocaleString('en-US', {
      maximumFractionDigits: 7,
    });
  };

  if (loading) {
    return (
      <Card title="Activity">
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="animate-pulse">
              <div className="h-16 rounded-xl bg-neutral-100" />
            </div>
          ))}
        </div>
      </Card>
    );
  }

  return (
    <Card>
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-semibold tracking-tight text-neutral-900">
          Activity
        </h2>
        <button
          onClick={fetchTransactions}
          disabled={refreshing}
          className="rounded-lg p-2 text-neutral-400 transition-colors duration-150 hover:bg-neutral-100 hover:text-neutral-900 disabled:opacity-40"
          title="Refresh transactions"
        >
          <FaSync className={refreshing ? 'animate-spin' : ''} />
        </button>
      </div>

      {error ? (
        <div className="py-8 text-center">
          <p className="mb-3 text-sm text-neutral-500">
            Couldn&apos;t load your activity.
          </p>
          <button
            onClick={fetchTransactions}
            className="rounded-xl border border-neutral-300 bg-white px-4 py-2 text-sm font-semibold text-neutral-900 transition-colors hover:bg-neutral-50"
          >
            Retry
          </button>
        </div>
      ) : transactions.length === 0 ? (
        <EmptyState
          title="No transactions yet"
          description="Payments you send or receive will show up here."
        />
      ) : (
        <div className="divide-y divide-neutral-100">
          {transactions.map((tx) => {
            const outgoing = tx.from === publicKey;
            const counterparty = outgoing ? tx.to : tx.from;

            return (
              <a
                key={tx.id}
                href={stellar.getExplorerLink(tx.hash, 'tx')}
                target="_blank"
                rel="noopener noreferrer"
                className="group flex items-center gap-3 py-3.5 transition-colors duration-150 first:pt-0 last:pb-0"
                title="View on Stellar Expert"
              >
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-neutral-200 text-neutral-500 transition-colors duration-150 group-hover:border-neutral-900 group-hover:text-neutral-900">
                  {outgoing ? (
                    <FaArrowUp className="text-xs" />
                  ) : (
                    <FaArrowDown className="text-xs" />
                  )}
                </div>

                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-neutral-900">
                    {outgoing ? 'Sent' : 'Received'}
                  </p>
                  <p className="truncate font-mono text-xs text-neutral-400">
                    {outgoing ? 'to' : 'from'}{' '}
                    {counterparty
                      ? stellar.formatAddress(counterparty, 4, 4)
                      : '—'}
                  </p>
                </div>

                <div className="shrink-0 text-right">
                  {tx.amount && (
                    <p
                      className={`text-sm font-semibold [font-variant-numeric:tabular-nums] ${
                        outgoing ? 'text-neutral-900' : 'text-emerald-700'
                      }`}
                    >
                      {outgoing ? '−' : '+'}
                      {formatAmount(tx.amount)} {tx.asset || 'XLM'}
                    </p>
                  )}
                  <p className="text-xs text-neutral-400">
                    {formatDate(tx.createdAt)}
                  </p>
                </div>
              </a>
            );
          })}
        </div>
      )}

      {!error && transactions.length > 0 && (
        <p className="mt-4 text-center text-xs text-neutral-400">
          Showing the last {transactions.length} payment
          {transactions.length !== 1 ? 's' : ''} · tap a row for details
        </p>
      )}
    </Card>
  );
}
