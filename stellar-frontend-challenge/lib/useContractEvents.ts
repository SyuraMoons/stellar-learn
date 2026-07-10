/**
 * Incremental polling hook for kirim-router + kirim-escrow contract events.
 *
 * - Pages forward via cursor (lib/contract-events.ts) instead of re-fetching
 *   the whole lookback window every tick.
 * - Exponential backoff on RPC failures (6s → 12s → 24s → 60s cap), reset to
 *   the base interval on the next success.
 * - Pauses while the tab is hidden and polls immediately on becoming visible
 *   again, so the feed doesn't burn RPC calls for a backgrounded tab but
 *   still catches up right away when the user returns.
 */

'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { fetchContractEvents, type ContractEvent } from './contract-events';

const BASE_POLL_MS = 6000;
const MAX_BACKOFF_MS = 60000;
const MAX_EVENTS = 50;

export function useContractEvents(
  onNewEvents?: (events: ContractEvent[]) => void
) {
  const [events, setEvents] = useState<ContractEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [offline, setOffline] = useState(false);

  const cursorRef = useRef<string | undefined>(undefined);
  const backoffRef = useRef(BASE_POLL_MS);
  const seenIdsRef = useRef<Set<string>>(new Set());
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mountedRef = useRef(true);
  const onNewEventsRef = useRef(onNewEvents);
  onNewEventsRef.current = onNewEvents;
  // The very first poll seeds the feed with the whole lookback window; that
  // backlog shouldn't fire a toast burst, only genuinely new events after.
  const isFirstPollRef = useRef(true);

  const poll = useCallback(async () => {
    try {
      const { events: page, cursor } = await fetchContractEvents(
        cursorRef.current
      );
      cursorRef.current = cursor;
      if (!mountedRef.current) return;

      setOffline(false);
      backoffRef.current = BASE_POLL_MS;

      const fresh = page.filter((e) => !seenIdsRef.current.has(e.id));
      if (fresh.length > 0) {
        fresh.forEach((e) => seenIdsRef.current.add(e.id));
        setEvents((prev) => [...fresh, ...prev].slice(0, MAX_EVENTS));
        if (!isFirstPollRef.current) {
          onNewEventsRef.current?.(fresh);
        }
      }
      isFirstPollRef.current = false;
    } catch (err) {
      if (!mountedRef.current) return;
      console.error('Error fetching contract events:', err);
      setOffline(true);
      backoffRef.current = Math.min(backoffRef.current * 2, MAX_BACKOFF_MS);
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    mountedRef.current = true;

    const scheduleNext = () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(async () => {
        if (!document.hidden) {
          await poll();
        }
        scheduleNext();
      }, backoffRef.current);
    };

    poll().then(scheduleNext);

    const onVisibilityChange = () => {
      if (!document.hidden) {
        // Resume immediately instead of waiting out the remaining interval.
        poll().then(scheduleNext);
      }
    };
    document.addEventListener('visibilitychange', onVisibilityChange);

    return () => {
      mountedRef.current = false;
      if (timerRef.current) clearTimeout(timerRef.current);
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, [poll]);

  return { events, loading, offline };
}
