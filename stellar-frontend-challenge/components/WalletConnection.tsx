/**
 * WalletConnection Component
 *
 * Handles wallet connect/disconnect (Freighter & friends via Stellar Wallets
 * Kit) and shows the connected address.
 *
 * Two variants:
 * - "header": compact — connect button, or address chip with copy/explorer/disconnect
 * - "hero":   large connect CTA for the landing state
 *
 * Wallet state (publicKey) is owned by the page so both variants stay in sync.
 */

'use client';

import { useState } from 'react';
import { stellar } from '@/lib/stellar-helper';
import { FaCopy, FaCheck, FaExternalLinkAlt } from 'react-icons/fa';
import { MdLogout } from 'react-icons/md';
import { LoadingSpinner } from './example-components';

interface WalletConnectionProps {
  publicKey: string;
  onConnect: (publicKey: string) => void;
  onDisconnect: () => void;
  variant?: 'header' | 'hero';
}

export default function WalletConnection({
  publicKey,
  onConnect,
  onDisconnect,
  variant = 'header',
}: WalletConnectionProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);

  const isConnected = Boolean(publicKey);

  const handleConnect = async () => {
    try {
      setLoading(true);
      setError('');
      const key = await stellar.connectWallet();
      onConnect(key);
    } catch (err: any) {
      console.error('Connection error:', err);
      setError(err?.message || 'Could not connect wallet. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleDisconnect = () => {
    stellar.disconnect();
    setError('');
    onDisconnect();
  };

  const handleCopyAddress = async () => {
    await navigator.clipboard.writeText(publicKey);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // ── Hero variant: large CTA shown on the landing state ──────────────────
  if (variant === 'hero') {
    if (isConnected) return null;

    return (
      <div className="flex w-full flex-col items-center gap-3">
        <button
          onClick={handleConnect}
          disabled={loading}
          className="flex w-full max-w-xs items-center justify-center gap-2 rounded-xl bg-neutral-900 px-6 py-4 text-sm font-semibold text-white transition-all duration-150 hover:bg-neutral-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-neutral-900 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {loading ? (
            <>
              <LoadingSpinner /> Connecting…
            </>
          ) : (
            'Connect Wallet'
          )}
        </button>
        {error && (
          <p className="animate-fade-up max-w-xs text-center text-sm text-red-600">
            {error}
          </p>
        )}
        <p className="text-xs text-neutral-400">
          Freighter, xBull, Albedo, Lobstr &amp; more
        </p>
      </div>
    );
  }

  // ── Header variant ───────────────────────────────────────────────────────
  if (!isConnected) {
    return (
      <div className="relative">
        <button
          onClick={handleConnect}
          disabled={loading}
          className="flex items-center gap-2 rounded-xl bg-neutral-900 px-4 py-2 text-sm font-semibold text-white transition-all duration-150 hover:bg-neutral-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-neutral-900 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {loading ? (
            <>
              <LoadingSpinner /> Connecting…
            </>
          ) : (
            'Connect'
          )}
        </button>
        {error && (
          <div className="animate-fade-up absolute right-0 top-full z-10 mt-2 w-64 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700 shadow-sm">
            {error}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="animate-fade-up flex items-center gap-1 rounded-xl border border-neutral-200 bg-white py-1.5 pl-3 pr-1.5">
      <span className="relative mr-1 flex h-2 w-2" title="Connected">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />
        <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
      </span>

      <span className="font-mono text-sm text-neutral-900">
        {stellar.formatAddress(publicKey, 4, 4)}
      </span>

      <button
        onClick={handleCopyAddress}
        className="rounded-lg p-2 text-neutral-400 transition-colors duration-150 hover:bg-neutral-100 hover:text-neutral-900"
        title={copied ? 'Copied!' : 'Copy address'}
      >
        {copied ? (
          <FaCheck className="text-xs text-emerald-600" />
        ) : (
          <FaCopy className="text-xs" />
        )}
      </button>

      <a
        href={stellar.getExplorerLink(publicKey, 'account')}
        target="_blank"
        rel="noopener noreferrer"
        className="rounded-lg p-2 text-neutral-400 transition-colors duration-150 hover:bg-neutral-100 hover:text-neutral-900"
        title="View account on Stellar Expert"
      >
        <FaExternalLinkAlt className="text-xs" />
      </a>

      <button
        onClick={handleDisconnect}
        className="rounded-lg p-2 text-neutral-400 transition-colors duration-150 hover:bg-neutral-100 hover:text-red-600"
        title="Disconnect"
      >
        <MdLogout className="text-sm" />
      </button>
    </div>
  );
}
