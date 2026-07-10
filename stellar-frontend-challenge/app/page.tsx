/**
 * Kirim — Stellar payment dashboard (Level 1)
 *
 * Wallet connect/disconnect, XLM balance, send payments, activity feed.
 * All blockchain logic lives in lib/stellar-helper.ts (DO NOT MODIFY).
 */

'use client';

import { useCallback, useState } from 'react';
import dynamic from 'next/dynamic';
import { CONTRACT_ID, CONTRACT_EXPLORER_URL } from '@/lib/config';
import { ToastProvider, useToast } from '@/components/Toaster';
import type { ContractEvent } from '@/lib/contract-events';

// Stellar Wallets Kit touches `window` when lib/stellar-helper.ts loads, so
// everything that imports it must render client-side only.
const WalletConnection = dynamic(
  () => import('@/components/WalletConnection'),
  { ssr: false }
);
const BalanceDisplay = dynamic(() => import('@/components/BalanceDisplay'), {
  ssr: false,
});
const PaymentForm = dynamic(() => import('@/components/PaymentForm'), {
  ssr: false,
});
const TransactionHistory = dynamic(
  () => import('@/components/TransactionHistory'),
  { ssr: false }
);
const EscrowPanel = dynamic(() => import('@/components/EscrowPanel'), {
  ssr: false,
});
const ContractEvents = dynamic(() => import('@/components/ContractEvents'), {
  ssr: false,
});

const GUIDE_STEPS = [
  {
    step: '01',
    title: 'Install a wallet',
    description:
      'Freighter is recommended — install the extension and switch it to Testnet.',
  },
  {
    step: '02',
    title: 'Fund your account',
    description:
      'Connect, then use the built-in Friendbot button to get free testnet XLM.',
  },
  {
    step: '03',
    title: 'Send a payment',
    description:
      'Payments settle in seconds. Every transaction links to the explorer.',
  },
];

const EVENT_TOAST_MESSAGE: Record<string, (ev: ContractEvent) => string> = {
  created: (ev) => `${ev.amountXlm ?? '—'} XLM locked in escrow`,
  claimed: (ev) => `Claimed ${ev.amountXlm ?? '—'} XLM`,
  refunded: (ev) => `Refunded ${ev.amountXlm ?? '—'} XLM`,
  routed: (ev) =>
    `Routed ${ev.amountXlm ?? '—'} XLM (fee ${ev.feeXlm ?? '—'} XLM)`,
};

export default function Home() {
  return (
    <ToastProvider>
      <Dashboard />
    </ToastProvider>
  );
}

function Dashboard() {
  const [publicKey, setPublicKey] = useState<string>('');
  const [refreshKey, setRefreshKey] = useState(0);
  const { showToast } = useToast();

  const isConnected = Boolean(publicKey);

  const handleConnect = (key: string) => setPublicKey(key);
  const handleDisconnect = () => setPublicKey('');
  const handlePaymentSuccess = () => setRefreshKey((prev) => prev + 1);

  const handleNewContractEvents = useCallback(
    (events: ContractEvent[]) => {
      events.forEach((ev) => {
        const message = EVENT_TOAST_MESSAGE[ev.type]?.(ev) ?? `${ev.type} event`;
        showToast(message, ev.type === 'claimed' ? 'success' : 'info');
      });
      setRefreshKey((prev) => prev + 1);
    },
    [showToast]
  );

  return (
    <div className="flex min-h-screen flex-col bg-white text-neutral-900">
      {/* Header */}
      <header className="sticky top-0 z-40 border-b border-neutral-200 bg-white/80 backdrop-blur-md">
        <div className="mx-auto flex h-16 w-full max-w-5xl items-center justify-between px-4 sm:px-6">
          <div className="flex items-center gap-3">
            <span className="text-xl font-bold tracking-tight">
              kirim<span className="text-neutral-300">.</span>
            </span>
            <span className="flex items-center gap-1.5 rounded-full bg-neutral-900 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-widest text-white">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" />
              Testnet
            </span>
          </div>

          <WalletConnection
            publicKey={publicKey}
            onConnect={handleConnect}
            onDisconnect={handleDisconnect}
            variant="header"
          />
        </div>
      </header>

      {/* Main */}
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-10 sm:px-6">
        {!isConnected ? (
          /* ── Landing / hero ─────────────────────────────────────────── */
          <div className="animate-fade-up">
            <section className="mx-auto max-w-xl py-14 text-center sm:py-20">
              <h1 className="mb-4 text-4xl font-bold tracking-tight sm:text-5xl">
                Send XLM in seconds.
              </h1>
              <p className="mx-auto mb-10 max-w-md text-base leading-relaxed text-neutral-500">
                Connect a Stellar wallet to check your balance, send payments,
                and track activity — live on the Stellar testnet.
              </p>

              <WalletConnection
                publicKey={publicKey}
                onConnect={handleConnect}
                onDisconnect={handleDisconnect}
                variant="hero"
              />
            </section>

            <section className="mx-auto max-w-3xl border-t border-neutral-100 pt-10">
              <div className="grid gap-8 sm:grid-cols-3">
                {GUIDE_STEPS.map((item) => (
                  <div key={item.step}>
                    <p className="mb-2 font-mono text-xs text-neutral-300">
                      {item.step}
                    </p>
                    <h3 className="mb-1 text-sm font-semibold">{item.title}</h3>
                    <p className="text-sm leading-relaxed text-neutral-500">
                      {item.description}
                    </p>
                  </div>
                ))}
              </div>
            </section>
          </div>
        ) : (
          /* ── Dashboard ──────────────────────────────────────────────── */
          <div className="animate-fade-up space-y-6">
            <div key={`balance-${refreshKey}`}>
              <BalanceDisplay publicKey={publicKey} />
            </div>

            <div className="grid gap-6 lg:grid-cols-2">
              <PaymentForm
                publicKey={publicKey}
                onSuccess={handlePaymentSuccess}
              />
              <div key={`history-${refreshKey}`}>
                <TransactionHistory publicKey={publicKey} />
              </div>
            </div>

            <div className="grid gap-6 lg:grid-cols-2">
              <EscrowPanel
                publicKey={publicKey}
                onSuccess={handlePaymentSuccess}
              />
              <ContractEvents onNewEvents={handleNewContractEvents} />
            </div>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-neutral-100">
        <div className="mx-auto w-full max-w-5xl px-4 py-6 sm:px-6">
          <p className="text-center text-xs text-neutral-400">
            kirim · built on Stellar testnet — no real funds involved ·{' '}
            <a
              href="https://stellar.expert/explorer/testnet"
              target="_blank"
              rel="noopener noreferrer"
              className="underline underline-offset-2 transition-colors hover:text-neutral-900"
            >
              explorer
            </a>{' '}
            ·{' '}
            <a
              href={CONTRACT_EXPLORER_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="underline underline-offset-2 transition-colors hover:text-neutral-900"
              title={CONTRACT_ID}
            >
              escrow contract
            </a>
          </p>
        </div>
      </footer>
    </div>
  );
}
