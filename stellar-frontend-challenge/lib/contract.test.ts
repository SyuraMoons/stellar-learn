import { describe, it, expect } from 'vitest';
import {
  toHex,
  fromHex,
  isValidClaimCode,
  stroopsToXlm,
  STROOPS_PER_XLM,
  mapError,
} from './contract';

describe('toHex / fromHex', () => {
  it('round-trips arbitrary bytes', () => {
    const bytes = new Uint8Array([0, 1, 15, 16, 255, 128]);
    expect(fromHex(toHex(bytes))).toEqual(bytes);
  });

  it('produces lowercase, zero-padded hex', () => {
    expect(toHex(new Uint8Array([0, 255]))).toBe('00ff');
  });
});

describe('isValidClaimCode', () => {
  it('accepts a 64-char hex string', () => {
    expect(isValidClaimCode('a'.repeat(64))).toBe(true);
    expect(isValidClaimCode('A'.repeat(64))).toBe(true);
  });

  it('rejects wrong length or non-hex characters', () => {
    expect(isValidClaimCode('a'.repeat(63))).toBe(false);
    expect(isValidClaimCode('a'.repeat(65))).toBe(false);
    expect(isValidClaimCode('g'.repeat(64))).toBe(false);
    expect(isValidClaimCode('')).toBe(false);
  });

  it('tolerates surrounding whitespace', () => {
    expect(isValidClaimCode(`  ${'a'.repeat(64)}  `)).toBe(true);
  });
});

describe('stroopsToXlm', () => {
  it('formats whole XLM amounts', () => {
    expect(stroopsToXlm(BigInt(STROOPS_PER_XLM))).toBe('1');
    expect(stroopsToXlm(BigInt(STROOPS_PER_XLM * 100))).toBe('100');
  });

  it('formats fractional amounts, trimming trailing zeros', () => {
    expect(stroopsToXlm(BigInt(15_000_000))).toBe('1.5');
    expect(stroopsToXlm(BigInt(1))).toBe('0.0000001');
  });

  it('accepts a numeric string', () => {
    expect(stroopsToXlm('10000000')).toBe('1');
  });
});

describe('mapError', () => {
  it('classifies escrow contract errors (e.g. #10 wrong secret)', () => {
    const err = mapError(new Error('Error(Contract, #10)'), 'rpc');
    expect(err.kind).toBe('contract');
    expect(err.message).toMatch(/wrong claim code/i);
  });

  it('classifies router contract errors (e.g. #103 invalid amount)', () => {
    const err = mapError(new Error('Error(Contract, #103)'), 'rpc');
    expect(err.kind).toBe('contract');
    expect(err.message).toMatch(/amount is invalid/i);
  });

  it('falls back to a generic message for unknown error codes', () => {
    const err = mapError(new Error('Error(Contract, #999)'), 'rpc');
    expect(err.kind).toBe('contract');
    expect(err.message).toMatch(/#999/);
  });

  it('classifies insufficient balance as a funds error', () => {
    const err = mapError(new Error('insufficient balance'), 'rpc');
    expect(err.kind).toBe('funds');
  });

  it('classifies wallet-signing failures regardless of message', () => {
    const err = mapError(new Error('user rejected'), 'sign');
    expect(err.kind).toBe('wallet');
  });

  it('falls back to a network error for unrecognized RPC failures', () => {
    const err = mapError(new Error('some unexpected RPC hiccup'), 'rpc');
    expect(err.kind).toBe('network');
  });
});
