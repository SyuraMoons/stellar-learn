/**
 * Contract / network configuration.
 * Values can be overridden via .env.local (see .env.example).
 */

export const CONTRACT_ID =
  process.env.NEXT_PUBLIC_CONTRACT_ID ||
  'CD3HCXPVO5AQXEIYI3LH47Q7MTPUTFSWLHPSVPRZV6E2NFCUXDFMBR27';

export const SOROBAN_RPC_URL =
  process.env.NEXT_PUBLIC_SOROBAN_RPC_URL ||
  'https://soroban-testnet.stellar.org';

export const CONTRACT_EXPLORER_URL = `https://stellar.expert/explorer/testnet/contract/${CONTRACT_ID}`;
