/**
 * Pure fee-splitting math mirroring kirim-router's `send_remittance`
 * (fee = amount * fee_bps / 10_000, floor division, same as the Rust i128 math).
 */

export function computeFee(
  amountStroops: bigint,
  feeBps: number
): { fee: bigint; net: bigint } {
  const fee = (amountStroops * BigInt(feeBps)) / BigInt(10000);
  const net = amountStroops - fee;
  return { fee, net };
}

export function formatFeeBps(bps: number): string {
  const pct = bps / 100;
  return `${pct % 1 === 0 ? pct.toFixed(0) : pct.toString()}%`;
}
