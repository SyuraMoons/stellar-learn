/**
 * Contract / network configuration.
 * Values can be overridden via .env.local (see .env.example).
 */

export const CONTRACT_ID =
  process.env.NEXT_PUBLIC_CONTRACT_ID ||
  'CAPLG3MZG6LSH2VMGZHIQV7T5DP7RBJNQH44OLAUPIK3FDQHK5K5PW2Y';

export const SOROBAN_RPC_URL =
  process.env.NEXT_PUBLIC_SOROBAN_RPC_URL ||
  'https://soroban-testnet.stellar.org';

export const CONTRACT_EXPLORER_URL = `https://stellar.expert/explorer/testnet/contract/${CONTRACT_ID}`;
