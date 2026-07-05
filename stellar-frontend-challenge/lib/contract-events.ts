/**
 * Live kirim-escrow contract events (Soroban RPC getEvents).
 *
 * The contract emits ("created" | "claimed" | "refunded", claim_hash) topics;
 * the frontend polls the RPC and decodes them into a feed. Polling interval
 * lives in components/ContractEvents.tsx.
 */

import { SorobanRpc, scValToNative } from '@stellar/stellar-sdk';
import { CONTRACT_ID, SOROBAN_RPC_URL } from './config';
import { stroopsToXlm } from './contract';

export interface ContractEvent {
  id: string;
  type: 'created' | 'claimed' | 'refunded' | string;
  amountXlm?: string;
  counterparty?: string;
  txHash: string;
  ledger: number;
  at: Date;
}

const server = new SorobanRpc.Server(SOROBAN_RPC_URL);

// Testnet RPC retains a limited ledger window; look back ~4h (≈5s/ledger).
const LOOKBACK_LEDGERS = 2880;

export async function fetchContractEvents(): Promise<ContractEvent[]> {
  const latest = await server.getLatestLedger();
  const startLedger = Math.max(latest.sequence - LOOKBACK_LEDGERS, 1);

  const res = await server.getEvents({
    startLedger,
    filters: [{ type: 'contract', contractIds: [CONTRACT_ID] }],
    limit: 50,
  });

  const events: ContractEvent[] = [];
  for (const ev of res.events) {
    try {
      const type = String(scValToNative(ev.topic[0]));
      const value = scValToNative(ev.value);

      let amountXlm: string | undefined;
      let counterparty: string | undefined;
      if (type === 'created') {
        // (amount, expiry)
        amountXlm = stroopsToXlm(value[0]);
      } else if (type === 'claimed' || type === 'refunded') {
        // (destination|sender, amount)
        counterparty = String(value[0]);
        amountXlm = stroopsToXlm(value[1]);
      }

      events.push({
        id: ev.id,
        type,
        amountXlm,
        counterparty,
        txHash: (ev as any).txHash || '',
        ledger: ev.ledger,
        at: new Date(ev.ledgerClosedAt),
      });
    } catch {
      // skip events we can't decode rather than break the feed
    }
  }

  // newest first
  return events.reverse();
}
