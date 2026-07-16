/**
 * BalanceDisplay Component
 *
 * Shows the connected wallet's XLM balance as the dashboard hero.
 *
 * Features:
 * - Large, clear XLM figure with refresh
 * - Loading skeleton
 * - Unfunded-account state with one-click Friendbot funding (testnet)
 * - Inline error state with retry (no alert() popups)
 * - Lists non-native assets when present
 */

'use client';

import { useState, useEffect, useCallback } from 'react';
import { stellar } from '@/lib/stellar-helper';
import { fundWithFriendbot } from '@/lib/friendbot';
import { FaSync } from 'react-icons/fa';
import { Card, LoadingSpinner, Skeleton } from './example-components';

interface BalanceDisplayProps {
  publicKey: string;
}

type Status = 'loading' | 'ready' | 'unfunded' | 'error';

function isAccountNotFound(error: any): boolean {
  return (
    error?.name === 'NotFoundError' || error?.response?.status === 404
  );
}

export default function BalanceDisplay({ publicKey }: BalanceDisplayProps) {
  const [balance, setBalance] = useState<string>('0');
  const [assets, setAssets] = useState<
    Array<{ code: string; issuer: string; balance: string }>
  >([]);
  const [status, setStatus] = useState<Status>('loading');
  const [refreshing, setRefreshing] = useState(false);
  const [funding, setFunding] = useState(false);
  const [fundingError, setFundingError] = useState('');

  const fetchBalance = useCallback(async () => {
    try {
      setRefreshing(true);
      const balanceData = await stellar.getBalance(publicKey);
      setBalance(balanceData.xlm);
      setAssets(balanceData.assets);
      setStatus('ready');
    } catch (error: any) {
      console.error('Error fetching balance:', error);
      setStatus(isAccountNotFound(error) ? 'unfunded' : 'error');
    } finally {
      setRefreshing(false);
    }
  }, [publicKey]);

  useEffect(() => {
    if (publicKey) {
      setStatus('loading');
      fetchBalance();
    }
  }, [publicKey, fetchBalance]);

  const handleFund = async () => {
    try {
      setFunding(true);
      setFundingError('');
      await fundWithFriendbot(publicKey);
      await fetchBalance();
    } catch (error: any) {
      console.error('Friendbot error:', error);
      setFundingError(
        error?.message || 'Funding failed. Please try again in a moment.'
      );
    } finally {
      setFunding(false);
    }
  };

  const formatBalance = (value: string): string => {
    const num = parseFloat(value);
    return num.toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 7,
    });
  };

  if (status === 'loading') {
    return (
      <Card>
        <Skeleton className="mb-3 h-4 w-32" />
        <Skeleton className="h-14 max-w-full rounded-xl sm:w-64" />
      </Card>
    );
  }

  if (status === 'unfunded') {
    return (
      <Card>
        <div className="animate-fade-up py-2 text-center sm:py-6">
          <p className="mb-1 text-sm font-semibold text-neutral-900">
            This account isn&apos;t funded yet
          </p>
          <p className="mx-auto mb-5 max-w-sm text-sm text-neutral-500">
            New Stellar accounts need a starting balance. On testnet, Friendbot
            funds your account with 10,000 free XLM.
          </p>
          <button
            onClick={handleFund}
            disabled={funding}
            className="inline-flex items-center gap-2 rounded-xl bg-neutral-900 px-5 py-3 text-sm font-semibold text-white transition-all duration-150 hover:bg-neutral-700 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {funding ? (
              <>
                <LoadingSpinner /> Funding…
              </>
            ) : (
              'Fund with Friendbot'
            )}
          </button>
          {fundingError && (
            <p className="animate-fade-up mt-3 text-sm text-red-600">
              {fundingError}
            </p>
          )}
        </div>
      </Card>
    );
  }

  if (status === 'error') {
    return (
      <Card>
        <div className="animate-fade-up py-2 text-center sm:py-6">
          <p className="mb-1 text-sm font-semibold text-neutral-900">
            Couldn&apos;t load your balance
          </p>
          <p className="mb-5 text-sm text-neutral-500">
            Check your connection and try again.
          </p>
          <button
            onClick={fetchBalance}
            disabled={refreshing}
            className="rounded-xl border border-neutral-300 bg-white px-5 py-3 text-sm font-semibold text-neutral-900 transition-all duration-150 hover:bg-neutral-50 disabled:opacity-40"
          >
            {refreshing ? 'Retrying…' : 'Retry'}
          </button>
        </div>
      </Card>
    );
  }

  return (
    <Card className="animate-fade-up">
      <div className="flex items-start justify-between">
        <p className="text-xs font-medium uppercase tracking-widest text-neutral-400">
          Available balance
        </p>
        <button
          onClick={fetchBalance}
          disabled={refreshing}
          className="rounded-lg p-2 text-neutral-400 transition-colors duration-150 hover:bg-neutral-100 hover:text-neutral-900 disabled:opacity-40"
          title="Refresh balance"
        >
          <FaSync className={refreshing ? 'animate-spin' : ''} />
        </button>
      </div>

      <div className="mt-2 flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <p className="text-5xl font-semibold tracking-tight text-neutral-900 [font-variant-numeric:tabular-nums] sm:text-6xl">
          {formatBalance(balance)}
        </p>
        <p className="text-xl font-medium text-neutral-400">XLM</p>
      </div>

      {assets.length > 0 && (
        <div className="mt-6 border-t border-neutral-100 pt-4">
          <p className="mb-3 text-xs font-medium uppercase tracking-widest text-neutral-400">
            Other assets
          </p>
          <div className="space-y-2">
            {assets.map((asset, index) => (
              <div
                key={index}
                className="flex items-center justify-between rounded-xl border border-neutral-100 px-4 py-3"
              >
                <div>
                  <p className="text-sm font-semibold text-neutral-900">
                    {asset.code}
                  </p>
                  <p className="max-w-[200px] truncate font-mono text-xs text-neutral-400">
                    {stellar.formatAddress(asset.issuer, 6, 6)}
                  </p>
                </div>
                <p className="text-sm font-semibold text-neutral-900 [font-variant-numeric:tabular-nums]">
                  {formatBalance(asset.balance)}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      <p className="mt-4 text-xs text-neutral-400">
        Keep at least 1 XLM in your account for the network reserve.
      </p>
    </Card>
  );
}
