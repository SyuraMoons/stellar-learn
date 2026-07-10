#!/usr/bin/env bash
#
# End-to-end smoke test against the deployed kirim-router contract:
# send_remittance (fee → treasury, net → escrow via cross-contract call)
# → get_payment on the escrow → claim. Prints tx hashes with explorer links.
#
# Usage: ./scripts/smoke-test-router.sh

set -euo pipefail
cd "$(dirname "$0")/.."

NETWORK=testnet
IDENTITY=deployer
ROUTER=kirim-router   # alias created by deploy-router.sh
ESCROW=kirim-escrow   # alias created by deploy-testnet.sh
AMOUNT=100000000      # 10 XLM in stroops (1 XLM = 10^7)

# claim recipient (separate funded key so the payout is visible)
if ! stellar keys address recipient >/dev/null 2>&1; then
  stellar keys generate recipient --network "$NETWORK" --fund
fi
RECIPIENT=$(stellar keys address recipient)
SENDER=$(stellar keys address "$IDENTITY")

SECRET=$(openssl rand -hex 32)
CLAIM_HASH=$(printf %s "$SECRET" | xxd -r -p | shasum -a 256 | cut -d' ' -f1)
EXPIRY=$(( $(date +%s) + 3600 ))

echo "secret      : $SECRET"
echo "claim hash  : $CLAIM_HASH"
echo "recipient   : $RECIPIENT"

echo "── send_remittance (route 10 XLM through the fee router) ─────"
ROUTE_LOG=$(stellar contract invoke --id "$ROUTER" --source "$IDENTITY" --network "$NETWORK" \
  -- send_remittance \
  --sender "$SENDER" \
  --amount "$AMOUNT" \
  --claim_hash "$CLAIM_HASH" \
  --expiry "$EXPIRY" 2>&1) || { echo "$ROUTE_LOG"; exit 1; }
echo "$ROUTE_LOG"
ROUTE_TX=$(echo "$ROUTE_LOG" | grep -o 'Signing transaction: [a-f0-9]*' | cut -d' ' -f3)

echo "── get_payment on kirim-escrow (should show net amount, Pending) ─"
stellar contract invoke --id "$ESCROW" --source "$IDENTITY" --network "$NETWORK" \
  -- get_payment --claim_hash "$CLAIM_HASH" 2>/dev/null

echo "── claim (secret → recipient) ────────────────────────────────"
CLAIM_LOG=$(stellar contract invoke --id "$ESCROW" --source "$IDENTITY" --network "$NETWORK" \
  -- claim --secret "$SECRET" --destination "$RECIPIENT" 2>&1) || { echo "$CLAIM_LOG"; exit 1; }
CLAIM_TX=$(echo "$CLAIM_LOG" | grep -o 'Signing transaction: [a-f0-9]*' | cut -d' ' -f3)

cat <<EOF

══════════════════════════════════════════════════════════════════
 router smoke test passed — fee routed, escrow created and claimed

 send_remittance tx : $ROUTE_TX
   https://stellar.expert/explorer/testnet/tx/$ROUTE_TX
   (should show 2 transfers: fee → treasury, net → escrow — one signature)
 claim tx            : $CLAIM_TX
   https://stellar.expert/explorer/testnet/tx/$CLAIM_TX
══════════════════════════════════════════════════════════════════
EOF
