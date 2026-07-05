/**
 * EscrowPanel Component — calls the deployed kirim-escrow contract.
 *
 * Two flows:
 *  - Send claimable: lock XLM in the contract behind a one-time claim code
 *  - Claim: redeem a code, funds go to the connected wallet
 *
 * Shows a live transaction status timeline (build → sign → submit → confirm)
 * and distinct messages for each error type (wallet / contract / funds /
 * network) — see lib/contract.ts.
 */

'use client';

import { useState } from 'react';
import { stellar } from '@/lib/stellar-helper';
import {
  createEscrow,
  claimEscrow,
  isValidClaimCode,
  ContractCallError,
  type TxStatus,
} from '@/lib/contract';
import { CONTRACT_ID, CONTRACT_EXPLORER_URL } from '@/lib/config';
import { FaCheck, FaLock, FaArrowRight } from 'react-icons/fa';
import {
  Card,
  Input,
  Button,
  Alert,
  LoadingSpinner,
  CopyButton,
} from './example-components';

interface EscrowPanelProps {
  publicKey: string;
  onSuccess?: () => void;
}

type Tab = 'send' | 'claim';

const ERROR_KIND_LABEL: Record<string, string> = {
  wallet: 'Wallet error',
  contract: 'Contract error',
  funds: 'Balance error',
  network: 'Network error',
};

// ── status timeline ────────────────────────────────────────────────────────

const STEPS: Array<{ label: string; statuses: TxStatus[] }> = [
  { label: 'Prepare', statuses: ['building', 'simulating'] },
  { label: 'Sign', statuses: ['awaiting-signature'] },
  { label: 'Submit', statuses: ['submitting'] },
  { label: 'Confirm', statuses: ['confirming'] },
];

function StatusTimeline({ status }: { status: TxStatus }) {
  const activeIndex =
    status === 'success' || status === 'failed'
      ? STEPS.length
      : STEPS.findIndex((s) => s.statuses.includes(status));

  return (
    <div className="animate-fade-up py-6">
      <div className="flex items-center">
        {STEPS.map((step, i) => {
          const done = i < activeIndex;
          const active = i === activeIndex;
          return (
            <div key={step.label} className="flex flex-1 items-center last:flex-none">
              <div className="flex flex-col items-center gap-1.5">
                <div
                  className={`flex h-8 w-8 items-center justify-center rounded-full border text-xs transition-colors duration-150 ${
                    done
                      ? 'border-neutral-900 bg-neutral-900 text-white'
                      : active
                        ? 'border-neutral-900 text-neutral-900'
                        : 'border-neutral-200 text-neutral-300'
                  }`}
                >
                  {done ? <FaCheck /> : active ? <LoadingSpinner /> : i + 1}
                </div>
                <span
                  className={`text-[11px] font-medium ${
                    done || active ? 'text-neutral-900' : 'text-neutral-300'
                  }`}
                >
                  {step.label}
                </span>
              </div>
              {i < STEPS.length - 1 && (
                <div
                  className={`mx-2 mb-5 h-px flex-1 ${
                    done ? 'bg-neutral-900' : 'bg-neutral-200'
                  }`}
                />
              )}
            </div>
          );
        })}
      </div>
      <p className="mt-4 text-center text-xs text-neutral-400">
        {status === 'awaiting-signature'
          ? 'Approve the transaction in your wallet…'
          : 'Live on Stellar testnet — this usually takes a few seconds.'}
      </p>
    </div>
  );
}

// ── main component ─────────────────────────────────────────────────────────

export default function EscrowPanel({ publicKey, onSuccess }: EscrowPanelProps) {
  const [tab, setTab] = useState<Tab>('send');

  // send flow
  const [amount, setAmount] = useState('');
  const [amountError, setAmountError] = useState('');
  const [sendResult, setSendResult] = useState<{
    secretHex: string;
    txHash: string;
    amount: string;
  } | null>(null);

  // claim flow
  const [code, setCode] = useState('');
  const [codeError, setCodeError] = useState('');
  const [claimResult, setClaimResult] = useState<{
    txHash: string;
    amountXlm: string;
  } | null>(null);

  // shared
  const [status, setStatus] = useState<TxStatus | null>(null);
  const [error, setError] = useState<{ kind: string; message: string } | null>(
    null
  );

  const busy = status !== null && status !== 'success' && status !== 'failed';

  const handleError = (err: any) => {
    if (err instanceof ContractCallError) {
      setError({ kind: err.kind, message: err.message });
    } else {
      setError({ kind: 'network', message: 'Something went wrong. Please try again.' });
    }
    setStatus(null);
  };

  const switchTab = (next: Tab) => {
    if (busy) return;
    setTab(next);
    setError(null);
    setStatus(null);
  };

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const num = parseFloat(amount);
    if (!amount.trim() || isNaN(num) || num <= 0) {
      setAmountError('Enter a positive XLM amount');
      return;
    }
    setAmountError('');

    try {
      const result = await createEscrow({
        sender: publicKey,
        amountXlm: amount,
        onStatus: setStatus,
      });
      setSendResult({ ...result, amount });
      setAmount('');
      onSuccess?.();
    } catch (err) {
      handleError(err);
    }
  };

  const handleClaim = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!isValidClaimCode(code)) {
      setCodeError('A claim code is 64 hex characters');
      return;
    }
    setCodeError('');

    try {
      const result = await claimEscrow({
        secretHex: code.trim(),
        destination: publicKey,
        onStatus: setStatus,
      });
      setClaimResult(result);
      setCode('');
      onSuccess?.();
    } catch (err) {
      handleError(err);
    }
  };

  const reset = () => {
    setSendResult(null);
    setClaimResult(null);
    setStatus(null);
    setError(null);
  };

  const txLink = (hash: string) => (
    <div className="mt-4 rounded-xl border border-neutral-200 bg-neutral-50 p-4 text-left">
      <div className="mb-1 flex items-center justify-between">
        <p className="text-xs font-medium uppercase tracking-widest text-neutral-400">
          Contract call tx
        </p>
        <CopyButton text={hash} />
      </div>
      <p className="break-all font-mono text-xs text-neutral-700">{hash}</p>
      <a
        href={stellar.getExplorerLink(hash, 'tx')}
        target="_blank"
        rel="noopener noreferrer"
        className="mt-2 inline-flex items-center gap-1.5 text-sm font-medium text-neutral-900 underline underline-offset-4 transition-colors hover:text-neutral-500"
      >
        View on Stellar Expert <FaArrowRight className="text-xs" />
      </a>
    </div>
  );

  // ── success screens ──────────────────────────────────────────────────────
  if (sendResult) {
    return (
      <Card title="Claimable payment">
        <div className="animate-fade-up py-2 text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-neutral-900 text-white">
            <FaLock className="text-sm" />
          </div>
          <p className="mb-1 text-base font-semibold text-neutral-900">
            {sendResult.amount} XLM locked in escrow
          </p>
          <p className="mb-5 text-sm text-neutral-500">
            Share this one-time claim code with the recipient. It&apos;s shown
            only once — anyone with the code can claim within 24 hours.
          </p>

          <div className="mb-2 rounded-xl border border-neutral-900 p-4 text-left">
            <div className="mb-1 flex items-center justify-between">
              <p className="text-xs font-medium uppercase tracking-widest text-neutral-400">
                Claim code
              </p>
              <CopyButton text={sendResult.secretHex} />
            </div>
            <p className="break-all font-mono text-xs text-neutral-900">
              {sendResult.secretHex}
            </p>
          </div>

          {txLink(sendResult.txHash)}

          <div className="mt-5">
            <Button onClick={reset} variant="secondary" fullWidth>
              Done
            </Button>
          </div>
        </div>
      </Card>
    );
  }

  if (claimResult) {
    return (
      <Card title="Claimable payment">
        <div className="animate-fade-up py-2 text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
            <FaCheck />
          </div>
          <p className="mb-1 text-base font-semibold text-neutral-900">
            Claimed {claimResult.amountXlm} XLM
          </p>
          <p className="mb-4 text-sm text-neutral-500">
            The escrow paid out to your connected wallet.
          </p>

          {txLink(claimResult.txHash)}

          <div className="mt-5">
            <Button onClick={reset} variant="secondary" fullWidth>
              Done
            </Button>
          </div>
        </div>
      </Card>
    );
  }

  // ── form / busy state ────────────────────────────────────────────────────
  return (
    <Card>
      <div className="mb-1 flex items-center justify-between">
        <h2 className="text-lg font-semibold tracking-tight text-neutral-900">
          Claimable payment
        </h2>
        <a
          href={CONTRACT_EXPLORER_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="font-mono text-xs text-neutral-400 underline-offset-2 transition-colors hover:text-neutral-900 hover:underline"
          title="View the escrow contract on Stellar Expert"
        >
          {CONTRACT_ID.slice(0, 4)}…{CONTRACT_ID.slice(-4)}
        </a>
      </div>
      <p className="mb-4 text-sm text-neutral-500">
        Powered by the kirim-escrow smart contract on testnet.
      </p>

      <div className="mb-5 grid grid-cols-2 rounded-xl border border-neutral-200 p-1">
        {(['send', 'claim'] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => switchTab(t)}
            disabled={busy}
            className={`rounded-lg py-2 text-sm font-semibold transition-colors duration-150 disabled:opacity-40 ${
              tab === t
                ? 'bg-neutral-900 text-white'
                : 'text-neutral-500 hover:text-neutral-900'
            }`}
          >
            {t === 'send' ? 'Send claimable' : 'Claim with code'}
          </button>
        ))}
      </div>

      {error && (
        <div className="mb-4 animate-fade-up">
          <Alert
            type="error"
            message={`${ERROR_KIND_LABEL[error.kind] ?? 'Error'} — ${error.message}`}
            onClose={() => setError(null)}
          />
        </div>
      )}

      {busy && status ? (
        <StatusTimeline status={status} />
      ) : tab === 'send' ? (
        <form onSubmit={handleSend} className="space-y-4">
          <Input
            label="Amount to lock (XLM)"
            type="number"
            placeholder="0.00"
            value={amount}
            onChange={setAmount}
            error={amountError}
          />
          <p className="text-xs text-neutral-400">
            The contract escrows your XLM and gives you a secret claim code.
            Unclaimed payments can be refunded after 24 hours.
          </p>
          <Button type="submit" fullWidth>
            <span className="flex items-center justify-center gap-2">
              <FaLock className="text-xs" /> Lock in escrow
            </span>
          </Button>
        </form>
      ) : (
        <form onSubmit={handleClaim} className="space-y-4">
          <Input
            label="Claim code"
            placeholder="64-character code…"
            value={code}
            onChange={setCode}
            error={codeError}
            mono
          />
          <p className="text-xs text-neutral-400">
            Funds are paid out to your connected wallet:{' '}
            <span className="font-mono">
              {stellar.formatAddress(publicKey, 4, 4)}
            </span>
          </p>
          <Button type="submit" fullWidth>
            Claim funds
          </Button>
        </form>
      )}
    </Card>
  );
}
