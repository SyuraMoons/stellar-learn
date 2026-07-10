#!/usr/bin/env bash
#
# Deploy kirim-router to Stellar testnet, pointed at the already-deployed
# kirim-escrow contract, and initialize it with a 1% platform fee.
#
# Usage: ./scripts/deploy-router.sh
# Requires: stellar CLI, rust wasm32v1-none target, internet access,
#           kirim-escrow already deployed (alias 'kirim-escrow', or set
#           ESCROW_CONTRACT_ID to override).

set -euo pipefail
cd "$(dirname "$0")/.."

NETWORK=testnet
IDENTITY=deployer
FEE_BPS="${FEE_BPS:-100}" # 1%

echo "── 1/5 deployer key ──────────────────────────────────────────"
if stellar keys address "$IDENTITY" >/dev/null 2>&1; then
  echo "using existing identity '$IDENTITY'"
else
  stellar keys generate "$IDENTITY" --network "$NETWORK" --fund
  echo "generated + friendbot-funded identity '$IDENTITY'"
fi
DEPLOYER=$(stellar keys address "$IDENTITY")
echo "deployer: $DEPLOYER"

echo "── 2/5 native XLM token contract (SAC) ───────────────────────"
NATIVE_SAC=$(stellar contract id asset --asset native --network "$NETWORK")
echo "native SAC: $NATIVE_SAC"

echo "── 3/5 resolve kirim-escrow contract id ──────────────────────"
if [ -n "${ESCROW_CONTRACT_ID:-}" ]; then
  ESCROW_ID="$ESCROW_CONTRACT_ID"
else
  ESCROW_ID=$(stellar contract alias show kirim-escrow --network "$NETWORK")
fi
echo "escrow id: $ESCROW_ID"

echo "── 4/5 build + deploy ─────────────────────────────────────────"
stellar contract build
CONTRACT_ID=$(stellar contract deploy \
  --wasm target/wasm32v1-none/release/kirim_router.wasm \
  --source "$IDENTITY" \
  --network "$NETWORK" \
  --alias kirim-router)
echo "contract id: $CONTRACT_ID"

echo "── 5/5 initialize(admin, token=native XLM, escrow, treasury=deployer, fee_bps) ──"
stellar contract invoke \
  --id "$CONTRACT_ID" \
  --source "$IDENTITY" \
  --network "$NETWORK" \
  -- initialize \
  --admin "$DEPLOYER" \
  --token "$NATIVE_SAC" \
  --escrow "$ESCROW_ID" \
  --treasury "$DEPLOYER" \
  --fee_bps "$FEE_BPS"

cat <<EOF

══════════════════════════════════════════════════════════════════
 kirim-router deployed & initialized on testnet

 ROUTER CONTRACT_ID : $CONTRACT_ID
 ESCROW CONTRACT_ID  : $ESCROW_ID
 ADMIN / TREASURY    : $DEPLOYER
 TOKEN (XLM)         : $NATIVE_SAC
 FEE_BPS             : $FEE_BPS
 EXPLORER            : https://stellar.expert/explorer/testnet/contract/$CONTRACT_ID

 Frontend env (stellar-frontend-challenge/.env.local):
   NEXT_PUBLIC_CONTRACT_ID=$ESCROW_ID
   NEXT_PUBLIC_ROUTER_CONTRACT_ID=$CONTRACT_ID
   NEXT_PUBLIC_SOROBAN_RPC_URL=https://soroban-testnet.stellar.org
══════════════════════════════════════════════════════════════════
EOF
