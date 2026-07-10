// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { computeFee, formatFeeBps } from './fees';

describe('computeFee', () => {
  it('splits a round amount at 1% (100 bps)', () => {
    const { fee, net } = computeFee(BigInt(1_000_000_000), 100);
    expect(fee).toBe(BigInt(10_000_000));
    expect(net).toBe(BigInt(990_000_000));
  });

  it('floors the fee like the contract’s i128 integer division', () => {
    // 999 * 25 / 10_000 = 2.4975 -> floors to 2 (matches the router test)
    const { fee, net } = computeFee(BigInt(999), 25);
    expect(fee).toBe(BigInt(2));
    expect(net).toBe(BigInt(997));
  });

  it('takes no fee at 0 bps', () => {
    const { fee, net } = computeFee(BigInt(500_000_000), 0);
    expect(fee).toBe(BigInt(0));
    expect(net).toBe(BigInt(500_000_000));
  });

  it('handles amounts smaller than the fee denominator', () => {
    const { fee, net } = computeFee(BigInt(50), 100);
    // 50 * 100 / 10_000 = 0.5 -> floors to 0
    expect(fee).toBe(BigInt(0));
    expect(net).toBe(BigInt(50));
  });

  it('fee + net always reconstructs the original amount', () => {
    const amount = BigInt(123_456_789);
    const { fee, net } = computeFee(amount, 250);
    expect(fee + net).toBe(amount);
  });
});

describe('formatFeeBps', () => {
  it('formats whole percentages without a decimal', () => {
    expect(formatFeeBps(100)).toBe('1%');
    expect(formatFeeBps(1000)).toBe('10%');
  });

  it('formats fractional percentages', () => {
    expect(formatFeeBps(25)).toBe('0.25%');
  });

  it('formats zero', () => {
    expect(formatFeeBps(0)).toBe('0%');
  });
});
