/**
 * Friendbot faucet helper (testnet only).
 *
 * This is not blockchain/transaction logic — Friendbot is Stellar's public
 * HTTP faucet that creates and funds testnet accounts. All transaction logic
 * stays in lib/stellar-helper.ts.
 */

export async function fundWithFriendbot(address: string): Promise<void> {
  const res = await fetch(
    `https://friendbot.stellar.org/?addr=${encodeURIComponent(address)}`
  );

  if (!res.ok) {
    // Friendbot returns 400 when the account already exists / other issues
    let detail = '';
    try {
      const body = await res.json();
      detail = body?.detail || body?.title || '';
    } catch {
      // ignore parse errors, fall back to generic message
    }
    throw new Error(detail || `Friendbot request failed (${res.status})`);
  }
}
