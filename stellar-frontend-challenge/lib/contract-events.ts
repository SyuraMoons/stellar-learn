/**
 * Live kirim-router + kirim-escrow contract events (Soroban RPC getEvents).
 *
 * The contracts emit:
 *   kirim-escrow: ("created" | "claimed" | "refunded", claim_hash)
 *   kirim-router: ("routed", claim_hash) → (fee, net)
 * A single getEvents call filters both contract IDs (RPC supports up to 5
 * contractIds per filter). Polling starts with a ~4h ledger lookback, then
 * switches to cursor-based paging (cheaper, catches events as soon as they
 * land) — `startLedger` and `cursor` are mutually exclusive, so once we have
 * a cursor we drop the lookback entirely. If a cursor ever comes back
 * invalid/expired, the caller should retry with `undefined` to fall back to
 * a fresh lookback. Polling interval/backoff live in lib/useContractEvents.ts.
 */

import { SorobanRpc, scValToNative } from '@stellar/stellar-sdk';
import { CONTRACT_ID, ROUTER_CONTRACT_ID, SOROBAN_RPC_URL } from './config';
import { stroopsToXlm } from './contract';

export interface ContractEvent {
  id: string;
  type: 'created' | 'claimed' | 'refunded' | 'routed' | string;
  amountXlm?: string;
  feeXlm?: string;
  counterparty?: string;
  txHash: string;
  ledger: number;
  at: Date;
}

export interface FetchEventsResult {
  events: ContractEvent[];
  cursor?: string;
}

const server = new SorobanRpc.Server(SOROBAN_RPC_URL);

// Testnet RPC retains a limited ledger window; look back ~4h (≈5s/ledger)
// the first time we fetch, before we have a cursor to page from.
const LOOKBACK_LEDGERS = 2880;
const EVENT_LIMIT = 50;

function decodeEvent(ev: SorobanRpc.Api.EventResponse): ContractEvent | null {
  try {
    const type = String(scValToNative(ev.topic[0]));
    const value = scValToNative(ev.value);

    let amountXlm: string | undefined;
    let feeXlm: string | undefined;
    let counterparty: string | undefined;

    if (type === 'created') {
      // (amount, expiry)
      amountXlm = stroopsToXlm(value[0]);
    } else if (type === 'claimed' || type === 'refunded') {
      // (destination|sender, amount)
      counterparty = String(value[0]);
      amountXlm = stroopsToXlm(value[1]);
    } else if (type === 'routed') {
      // (fee, net)
      feeXlm = stroopsToXlm(value[0]);
      amountXlm = stroopsToXlm(value[1]);
    }

    return {
      id: ev.id,
      type,
      amountXlm,
      feeXlm,
      counterparty,
      txHash: (ev as any).txHash || '',
      ledger: ev.ledger,
      at: new Date(ev.ledgerClosedAt),
    };
  } catch {
    return null; // skip events we can't decode rather than break the feed
  }
}

async function fetchPage(
  cursor: string | undefined
): Promise<SorobanRpc.Api.GetEventsResponse> {
  const filters = [
    { type: 'contract' as const, contractIds: [CONTRACT_ID, ROUTER_CONTRACT_ID] },
  ];

  if (cursor) {
    return server.getEvents({ cursor, filters, limit: EVENT_LIMIT });
  }

  const latest = await server.getLatestLedger();
  const startLedger = Math.max(latest.sequence - LOOKBACK_LEDGERS, 1);
  return server.getEvents({ startLedger, filters, limit: EVENT_LIMIT });
}

/**
 * Fetch the next page of events. Pass the `cursor` returned by the previous
 * call to page forward incrementally; omit it (or retry with `undefined`
 * after a failure) to re-anchor on the lookback window.
 */
export async function fetchContractEvents(
  cursor?: string
): Promise<FetchEventsResult> {
  let res: SorobanRpc.Api.GetEventsResponse;
  try {
    res = await fetchPage(cursor);
  } catch (error) {
    if (cursor) {
      // Cursor likely expired/invalid — fall back to a fresh lookback.
      res = await fetchPage(undefined);
    } else {
      throw error;
    }
  }

  const events = res.events
    .map(decodeEvent)
    .filter((e): e is ContractEvent => e !== null);

  const nextCursor =
    res.events.length > 0
      ? res.events[res.events.length - 1].pagingToken
      : cursor;

  // newest first for display
  return { events: events.reverse(), cursor: nextCursor };
}
