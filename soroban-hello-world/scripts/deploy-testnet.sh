#!/usr/bin/env bash
#
# Deploy kirim-escrow to Stellar testnet and initialize it with the
# native XLM Stellar Asset Contract (no trustlines needed).
#
# Usage: ./scripts/deploy-testnet.sh
# Requires: stellar CLI, rust wasm32v1-none target, internet access.

set -euo pipefail
cd "$(dirname "$0")/.."

NETWORK=testnet
IDENTITY=deployer

echo "── 1/4 deployer key ──────────────────────────────────────────"
if stellar keys address "$IDENTITY" >/dev/null 2>&1; then
  echo "using existing identity '$IDENTITY'"
else
  stellar keys generate "$IDENTITY" --network "$NETWORK" --fund
  echo "generated + friendbot-funded identity '$IDENTITY'"
fi
DEPLOYER=$(stellar keys address "$IDENTITY")
echo "deployer: $DEPLOYER"

echo "── 2/4 native XLM token contract (SAC) ───────────────────────"
NATIVE_SAC=$(stellar contract id asset --asset native --network "$NETWORK")
echo "native SAC: $NATIVE_SAC"

echo "── 3/4 build + deploy ────────────────────────────────────────"
stellar contract build
CONTRACT_ID=$(stellar contract deploy \
  --wasm target/wasm32v1-none/release/kirim_escrow.wasm \
  --source "$IDENTITY" \
  --network "$NETWORK" \
  --alias kirim-escrow)
echo "contract id: $CONTRACT_ID"

echo "── 4/4 initialize(admin, token=native XLM) ───────────────────"
stellar contract invoke \
  --id "$CONTRACT_ID" \
  --source "$IDENTITY" \
  --network "$NETWORK" \
  -- initialize --admin "$DEPLOYER" --usdc_token "$NATIVE_SAC"

cat <<EOF

══════════════════════════════════════════════════════════════════
 kirim-escrow deployed & initialized on testnet

 CONTRACT_ID : $CONTRACT_ID
 ADMIN       : $DEPLOYER
 TOKEN (XLM) : $NATIVE_SAC
 EXPLORER    : https://stellar.expert/explorer/testnet/contract/$CONTRACT_ID

 Frontend env (stellar-frontend-challenge/.env.local):
   NEXT_PUBLIC_CONTRACT_ID=$CONTRACT_ID
   NEXT_PUBLIC_SOROBAN_RPC_URL=https://soroban-testnet.stellar.org
══════════════════════════════════════════════════════════════════
EOF
