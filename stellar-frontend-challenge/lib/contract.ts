/**
 * kirim-escrow contract client (Soroban, Stellar testnet).
 *
 * Calls the deployed hashlock-escrow contract from the browser:
 *   createEscrow  — lock XLM behind a secret claim code (create_payment)
 *   claimEscrow   — pay out to the connected wallet given the code (claim)
 *   getPayment    — read a payment's state (get_payment, simulation only)
 *
 * Transactions are signed with the wallet the user selected at connect time:
 * Stellar Wallets Kit keeps the selected wallet in a module-level store shared
 * by every kit instance, so this module creates its own instance WITHOUT a
 * selectedWalletId (it must not overwrite the user's choice) and inherits the
 * selection made through the connect modal. lib/stellar-helper.ts stays
 * untouched.
 *
 * Error taxonomy (ContractCallError.kind):
 *   'wallet'   — the signing request was rejected/failed in the wallet
 *   'contract' — the contract returned a typed error (wrong code, expired…)
 *   'funds'    — insufficient balance / unfunded account
 *   'network'  — RPC/connection failures, confirmation timeout
 */

import {
  Account,
  Address,
  BASE_FEE,
  Contract,
  Networks,
  SorobanRpc,
  TransactionBuilder,
  nativeToScVal,
  scValToNative,
} from '@stellar/stellar-sdk';
import {
  StellarWalletsKit,
  WalletNetwork,
  allowAllModules,
} from '@creit.tech/stellar-wallets-kit';
import { CONTRACT_ID, SOROBAN_RPC_URL } from './config';

// ── types ────────────────────────────────────────────────────────────────

export type TxStatus =
  | 'building'
  | 'simulating'
  | 'awaiting-signature'
  | 'submitting'
  | 'confirming'
  | 'success'
  | 'failed';

export type OnStatus = (status: TxStatus) => void;

export type ContractErrorKind = 'wallet' | 'contract' | 'funds' | 'network';

export class ContractCallError extends Error {
  kind: ContractErrorKind;

  constructor(kind: ContractErrorKind, message: string) {
    super(message);
    this.kind = kind;
    this.name = 'ContractCallError';
  }
}

export interface EscrowPayment {
  sender: string;
  amountXlm: string;
  expiry: number;
  status: 'Pending' | 'Claimed' | 'Refunded';
}

// ── contract error codes (must match Error enum in kirim-escrow lib.rs) ──

const CONTRACT_ERRORS: Record<number, string> = {
  1: 'The contract is already initialized.',
  2: 'The contract is not initialized yet.',
  3: 'A payment with this claim code already exists — try again to get a fresh code.',
  4: 'No payment found for this claim code.',
  5: 'The amount is invalid.',
  6: 'The expiry time is invalid.',
  7: 'This payment was already claimed or refunded.',
  8: 'This payment has expired and can no longer be claimed.',
  9: 'The payment hasn’t expired yet — refunds only work after expiry.',
  10: 'Wrong claim code — no pending payment matches it.',
};

// ── singletons ───────────────────────────────────────────────────────────

const server = new SorobanRpc.Server(SOROBAN_RPC_URL);
const networkPassphrase = Networks.TESTNET;

// No selectedWalletId here: the kit constructor would overwrite the wallet
// the user picked in the connect modal (shared store across instances).
const kit = new StellarWalletsKit({
  network: WalletNetwork.TESTNET,
  modules: allowAllModules(),
});

// ── helpers ──────────────────────────────────────────────────────────────

const STROOPS_PER_XLM = 10_000_000;

export function toHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

export function fromHex(hex: string): Uint8Array {
  const clean = hex.trim().toLowerCase();
  const bytes = new Uint8Array(clean.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(clean.slice(i * 2, i * 2 + 2), 16);
  }
  return bytes;
}

export function isValidClaimCode(code: string): boolean {
  return /^[0-9a-fA-F]{64}$/.test(code.trim());
}

async function sha256(bytes: Uint8Array): Promise<Uint8Array> {
  const digest = await crypto.subtle.digest('SHA-256', bytes.buffer as ArrayBuffer);
  return new Uint8Array(digest);
}

function xlmToStroops(amountXlm: string): bigint {
  const amount = Number(amountXlm);
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new ContractCallError('contract', 'The amount is invalid.');
  }
  return BigInt(Math.round(amount * STROOPS_PER_XLM));
}

export function stroopsToXlm(stroops: bigint | string): string {
  const value = BigInt(stroops);
  const whole = value / BigInt(STROOPS_PER_XLM);
  const frac = value % BigInt(STROOPS_PER_XLM);
  if (frac === BigInt(0)) return whole.toString();
  return `${whole}.${frac.toString().padStart(7, '0').replace(/0+$/, '')}`;
}

function mapError(error: any, phase: 'sign' | 'rpc'): ContractCallError {
  if (error instanceof ContractCallError) return error;

  const message: string = error?.message || String(error);

  if (phase === 'sign') {
    return new ContractCallError(
      'wallet',
      'The signing request was declined or failed in your wallet.'
    );
  }

  // insufficient balance surfaces in simulation diagnostics or send results
  if (/balance|underfunded|insufficient/i.test(message)) {
    return new ContractCallError(
      'funds',
      'Insufficient balance — the account can’t cover this amount plus fees.'
    );
  }

  // account never funded on testnet
  if (/not found/i.test(message) && /account/i.test(message)) {
    return new ContractCallError(
      'funds',
      'Your account isn’t funded yet — use the Friendbot button in the balance card first.'
    );
  }

  // typed contract errors, e.g. "Error(Contract, #10)"
  const match = message.match(/Error\(Contract, #(\d+)\)/);
  if (match) {
    const code = Number(match[1]);
    return new ContractCallError(
      'contract',
      CONTRACT_ERRORS[code] || `Contract rejected the call (error #${code}).`
    );
  }

  return new ContractCallError(
    'network',
    'Network error while talking to the Stellar RPC — check your connection and try again.'
  );
}

/**
 * Poll a transaction's status via raw JSON-RPC instead of the SDK's
 * getTransaction: the SDK (v12, pinned by the template) can't parse the
 * TransactionMeta v4 XDR returned by newer Stellar protocols and throws
 * "Bad union switch: 4" even for successful transactions. We only need the
 * status string, so skip XDR parsing entirely.
 */
async function getTransactionStatus(
  hash: string
): Promise<'SUCCESS' | 'FAILED' | 'NOT_FOUND'> {
  const res = await fetch(SOROBAN_RPC_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: 1,
      method: 'getTransaction',
      params: { hash },
    }),
  });
  if (!res.ok) throw new Error(`RPC ${res.status}`);
  const json = await res.json();
  return json?.result?.status ?? 'NOT_FOUND';
}

// ── core invoke pipeline ─────────────────────────────────────────────────

async function invoke(
  source: string,
  method: string,
  args: any[],
  onStatus: OnStatus
): Promise<string> {
  const contract = new Contract(CONTRACT_ID);

  onStatus('building');
  let account;
  try {
    account = await server.getAccount(source);
  } catch (error) {
    throw mapError(error, 'rpc');
  }

  const tx = new TransactionBuilder(account, {
    fee: BASE_FEE,
    networkPassphrase,
  })
    .addOperation(contract.call(method, ...args))
    .setTimeout(60)
    .build();

  onStatus('simulating');
  let prepared;
  try {
    const sim = await server.simulateTransaction(tx);
    if (SorobanRpc.Api.isSimulationError(sim)) {
      throw new Error(sim.error);
    }
    prepared = SorobanRpc.assembleTransaction(tx, sim).build();
  } catch (error) {
    throw mapError(error, 'rpc');
  }

  onStatus('awaiting-signature');
  let signedTxXdr: string;
  try {
    const result = await kit.signTransaction(prepared.toXDR(), {
      networkPassphrase,
      address: source,
    });
    signedTxXdr = result.signedTxXdr;
  } catch (error) {
    throw mapError(error, 'sign');
  }

  onStatus('submitting');
  let hash: string;
  try {
    const signedTx = TransactionBuilder.fromXDR(signedTxXdr, networkPassphrase);
    const sent = await server.sendTransaction(signedTx);
    if (sent.status === 'ERROR' || sent.status === 'DUPLICATE') {
      throw new Error(
        `submit failed: ${JSON.stringify(sent.errorResult ?? sent.status)}`
      );
    }
    hash = sent.hash;
  } catch (error) {
    throw mapError(error, 'rpc');
  }

  onStatus('confirming');
  const deadline = Date.now() + 60_000;
  while (Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, 1500));
    let status: 'SUCCESS' | 'FAILED' | 'NOT_FOUND';
    try {
      status = await getTransactionStatus(hash);
    } catch {
      // transient poll failure — keep retrying until the deadline
      continue;
    }
    if (status === 'SUCCESS') {
      onStatus('success');
      return hash;
    }
    if (status === 'FAILED') {
      onStatus('failed');
      throw new ContractCallError(
        'contract',
        'The transaction was included but failed on-chain — see the explorer for details.'
      );
    }
  }

  onStatus('failed');
  throw new ContractCallError(
    'network',
    'Timed out waiting for confirmation — the transaction may still succeed; check the explorer before retrying.'
  );
}

// ── public API ───────────────────────────────────────────────────────────

const DEFAULT_EXPIRY_SECONDS = 24 * 60 * 60; // 24h claim window

export async function createEscrow(params: {
  sender: string;
  amountXlm: string;
  onStatus: OnStatus;
}): Promise<{ secretHex: string; txHash: string; expiresAt: Date }> {
  const secret = crypto.getRandomValues(new Uint8Array(32));
  const claimHash = await sha256(secret);
  const expiry = Math.floor(Date.now() / 1000) + DEFAULT_EXPIRY_SECONDS;

  // Safety net: if the tab closes or confirmation times out after the tx
  // lands on-chain, the code would otherwise be lost (funds stuck until the
  // expiry refund). Recover it via localStorage key `kirim.lastEscrowSecret`.
  try {
    localStorage.setItem(
      'kirim.lastEscrowSecret',
      JSON.stringify({
        secretHex: toHex(secret),
        amountXlm: params.amountXlm,
        createdAt: new Date().toISOString(),
      })
    );
  } catch {
    // private mode / storage full — non-fatal
  }

  const txHash = await invoke(
    params.sender,
    'create_payment',
    [
      new Address(params.sender).toScVal(),
      nativeToScVal(xlmToStroops(params.amountXlm), { type: 'i128' }),
      nativeToScVal(claimHash, { type: 'bytes' }),
      nativeToScVal(BigInt(expiry), { type: 'u64' }),
    ],
    params.onStatus
  );

  return {
    secretHex: toHex(secret),
    txHash,
    expiresAt: new Date(expiry * 1000),
  };
}

export async function claimEscrow(params: {
  secretHex: string;
  destination: string;
  onStatus: OnStatus;
}): Promise<{ txHash: string; amountXlm: string }> {
  const secret = fromHex(params.secretHex);

  // Look the payment up first so bad codes fail fast with a clear message
  // (and so we can show the amount on success).
  const claimHash = await sha256(secret);
  const payment = await getPayment(toHex(claimHash), params.destination);
  if (!payment) {
    throw new ContractCallError('contract', CONTRACT_ERRORS[10]);
  }
  if (payment.status !== 'Pending') {
    throw new ContractCallError('contract', CONTRACT_ERRORS[7]);
  }

  const txHash = await invoke(
    params.destination,
    'claim',
    [
      nativeToScVal(secret, { type: 'bytes' }),
      new Address(params.destination).toScVal(),
    ],
    params.onStatus
  );

  return { txHash, amountXlm: payment.amountXlm };
}

// A valid strkey (all-zero ed25519 key) used as the tx source when the
// caller doesn't supply one — simulation never checks it.
const SIMULATION_SOURCE =
  'GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF';

export async function getPayment(
  claimHashHex: string,
  sourceAddress?: string
): Promise<EscrowPayment | null> {
  const contract = new Contract(CONTRACT_ID);

  let sim;
  try {
    // Read-only: simulation only, never signed or submitted.
    const tx = new TransactionBuilder(
      new Account(sourceAddress || SIMULATION_SOURCE, '0'),
      { fee: BASE_FEE, networkPassphrase }
    )
      .addOperation(
        contract.call(
          'get_payment',
          nativeToScVal(fromHex(claimHashHex), { type: 'bytes' })
        )
      )
      .setTimeout(60)
      .build();
    sim = await server.simulateTransaction(tx);
  } catch (error) {
    throw mapError(error, 'rpc');
  }

  if (SorobanRpc.Api.isSimulationError(sim)) {
    throw mapError(new Error(sim.error), 'rpc');
  }
  if (!SorobanRpc.Api.isSimulationSuccess(sim) || !sim.result?.retval) {
    return null;
  }

  const value = scValToNative(sim.result.retval);
  if (!value) return null;

  return {
    sender: value.sender,
    amountXlm: stroopsToXlm(value.amount),
    expiry: Number(value.expiry),
    status: value.status?.[0] ?? String(value.status),
  };
}
