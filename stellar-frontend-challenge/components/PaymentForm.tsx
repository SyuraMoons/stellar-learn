/**
 * PaymentForm Component
 *
 * Sends XLM payments on testnet in three steps:
 *   form → review & confirm → result (success with tx hash / inline error)
 *
 * Features:
 * - Validation (address format, positive amount, not sending to yourself)
 * - Confirmation step before signing (bonus feature)
 * - Success state with transaction hash + Stellar Expert link
 * - Friendly error mapping, loading state while signing/submitting
 */

'use client';

import { useState } from 'react';
import { stellar } from '@/lib/stellar-helper';
import { FaCheck, FaArrowRight } from 'react-icons/fa';
import {
  Card,
  Input,
  Button,
  Alert,
  LoadingSpinner,
  CopyButton,
} from './example-components';

interface PaymentFormProps {
  publicKey: string;
  onSuccess?: () => void;
}

type Step = 'form' | 'review' | 'success';

export default function PaymentForm({ publicKey, onSuccess }: PaymentFormProps) {
  const [step, setStep] = useState<Step>('form');
  const [recipient, setRecipient] = useState('');
  const [amount, setAmount] = useState('');
  const [memo, setMemo] = useState('');
  const [sending, setSending] = useState(false);
  const [errors, setErrors] = useState<{ recipient?: string; amount?: string }>(
    {}
  );
  const [sendError, setSendError] = useState('');
  const [txHash, setTxHash] = useState('');

  const validateForm = (): boolean => {
    const newErrors: { recipient?: string; amount?: string } = {};

    if (!recipient.trim()) {
      newErrors.recipient = 'Recipient address is required';
    } else if (recipient.length !== 56 || !recipient.startsWith('G')) {
      newErrors.recipient =
        'Invalid Stellar address (must start with G and be 56 characters)';
    } else if (recipient === publicKey) {
      newErrors.recipient = 'You can’t send a payment to your own address';
    }

    if (!amount.trim()) {
      newErrors.amount = 'Amount is required';
    } else {
      const numAmount = parseFloat(amount);
      if (isNaN(numAmount) || numAmount <= 0) {
        newErrors.amount = 'Amount must be a positive number';
      } else if (numAmount < 0.0000001) {
        newErrors.amount = 'Amount is too small (minimum: 0.0000001 XLM)';
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleReview = (e: React.FormEvent) => {
    e.preventDefault();
    setSendError('');
    if (validateForm()) {
      setStep('review');
    }
  };

  const handleConfirm = async () => {
    try {
      setSending(true);
      setSendError('');

      const result = await stellar.sendPayment({
        from: publicKey,
        to: recipient,
        amount,
        memo: memo || undefined,
      });

      if (result.success) {
        setTxHash(result.hash);
        setStep('success');
        onSuccess?.();
      } else {
        setSendError('The transaction was not accepted by the network.');
        setStep('form');
      }
    } catch (error: any) {
      console.error('Payment error:', error);
      const raw = error?.message || '';
      let message = 'Payment failed. ';

      if (raw.includes('insufficient')) {
        message += 'Insufficient balance for this amount.';
      } else if (raw.includes('destination')) {
        message +=
          'The destination account doesn’t exist. It may need funding first.';
      } else if (raw.toLowerCase().includes('reject') || raw.includes('denied')) {
        message += 'The request was declined in your wallet.';
      } else {
        message += raw || 'Please try again.';
      }

      setSendError(message);
      setStep('form');
    } finally {
      setSending(false);
    }
  };

  const resetForm = () => {
    setStep('form');
    setRecipient('');
    setAmount('');
    setMemo('');
    setErrors({});
    setSendError('');
    setTxHash('');
  };

  // ── Success state ─────────────────────────────────────────────────────────
  if (step === 'success') {
    return (
      <Card title="Send XLM">
        <div className="animate-fade-up py-2 text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
            <FaCheck />
          </div>
          <p className="mb-1 text-base font-semibold text-neutral-900">
            Payment sent
          </p>
          <p className="mb-6 text-sm text-neutral-500">
            {amount} XLM is on its way to{' '}
            <span className="font-mono">
              {stellar.formatAddress(recipient, 4, 4)}
            </span>
          </p>

          <div className="mb-6 rounded-xl border border-neutral-200 bg-neutral-50 p-4 text-left">
            <div className="mb-1 flex items-center justify-between">
              <p className="text-xs font-medium uppercase tracking-widest text-neutral-400">
                Transaction hash
              </p>
              <CopyButton text={txHash} />
            </div>
            <p className="break-all font-mono text-xs text-neutral-700">
              {txHash}
            </p>
            <a
              href={stellar.getExplorerLink(txHash, 'tx')}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-3 inline-flex items-center gap-1.5 text-sm font-medium text-neutral-900 underline underline-offset-4 transition-colors hover:text-neutral-500"
            >
              View on Stellar Expert <FaArrowRight className="text-xs" />
            </a>
          </div>

          <Button onClick={resetForm} variant="secondary" fullWidth>
            Send another payment
          </Button>
        </div>
      </Card>
    );
  }

  // ── Review step ───────────────────────────────────────────────────────────
  if (step === 'review') {
    return (
      <Card title="Confirm payment">
        <div className="animate-fade-up">
          <div className="mb-6 divide-y divide-neutral-100 rounded-xl border border-neutral-200">
            <div className="flex items-center justify-between gap-4 px-4 py-3">
              <p className="text-sm text-neutral-500">Amount</p>
              <p className="text-lg font-semibold text-neutral-900 [font-variant-numeric:tabular-nums]">
                {parseFloat(amount).toLocaleString('en-US', {
                  maximumFractionDigits: 7,
                })}{' '}
                XLM
              </p>
            </div>
            <div className="flex items-center justify-between gap-4 px-4 py-3">
              <p className="text-sm text-neutral-500">To</p>
              <p className="break-all text-right font-mono text-xs text-neutral-900">
                {recipient}
              </p>
            </div>
            {memo && (
              <div className="flex items-center justify-between gap-4 px-4 py-3">
                <p className="text-sm text-neutral-500">Memo</p>
                <p className="text-right text-sm text-neutral-900">{memo}</p>
              </div>
            )}
            <div className="flex items-center justify-between gap-4 px-4 py-3">
              <p className="text-sm text-neutral-500">Network fee</p>
              <p className="text-sm text-neutral-900">0.00001 XLM</p>
            </div>
          </div>

          <p className="mb-4 text-xs text-neutral-400">
            Blockchain payments are irreversible — double-check the address.
            Your wallet will ask you to sign this transaction.
          </p>

          <div className="flex gap-3">
            <Button
              onClick={() => setStep('form')}
              variant="secondary"
              disabled={sending}
              fullWidth
            >
              Back
            </Button>
            <Button onClick={handleConfirm} disabled={sending} fullWidth>
              {sending ? (
                <span className="flex items-center justify-center gap-2">
                  <LoadingSpinner /> Sending…
                </span>
              ) : (
                'Confirm & sign'
              )}
            </Button>
          </div>
        </div>
      </Card>
    );
  }

  // ── Form step ─────────────────────────────────────────────────────────────
  return (
    <Card title="Send XLM">
      {sendError && (
        <div className="mb-4">
          <Alert
            type="error"
            message={sendError}
            onClose={() => setSendError('')}
          />
        </div>
      )}

      <form onSubmit={handleReview} className="space-y-4">
        <Input
          label="Recipient address"
          placeholder="G…"
          value={recipient}
          onChange={setRecipient}
          error={errors.recipient}
          mono
        />

        <Input
          label="Amount (XLM)"
          type="number"
          placeholder="0.00"
          value={amount}
          onChange={setAmount}
          error={errors.amount}
        />

        <Input
          label="Memo (optional)"
          placeholder="What's it for?"
          value={memo}
          onChange={setMemo}
        />

        <div className="pt-1">
          <Button type="submit" fullWidth>
            <span className="flex items-center justify-center gap-2">
              Review payment <FaArrowRight className="text-xs" />
            </span>
          </Button>
        </div>
      </form>
    </Card>
  );
}
