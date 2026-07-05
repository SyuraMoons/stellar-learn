#!/usr/bin/env bash
#
# End-to-end smoke test against the deployed kirim-escrow contract:
# create_payment (escrow 10 XLM behind a secret) → get_payment → claim.
# Prints the tx hashes with explorer links.
#
# Usage: ./scripts/smoke-test.sh

set -euo pipefail
cd "$(dirname "$0")/.."

NETWORK=testnet
IDENTITY=deployer
CONTRACT=kirim-escrow   # alias created by deploy-testnet.sh
AMOUNT=100000000        # 10 XLM in stroops (1 XLM = 10^7)

# claim recipient (separate funded key so the payout is visible)
if ! stellar keys address recipient >/dev/null 2>&1; then
  stellar keys generate recipient --network "$NETWORK" --fund
fi
RECIPIENT=$(stellar keys address recipient)

SECRET=$(openssl rand -hex 32)
CLAIM_HASH=$(printf %s "$SECRET" | xxd -r -p | shasum -a 256 | cut -d' ' -f1)
EXPIRY=$(( $(date +%s) + 3600 ))

echo "secret      : $SECRET"
echo "claim hash  : $CLAIM_HASH"
echo "recipient   : $RECIPIENT"

echo "── create_payment (escrow 10 XLM) ────────────────────────────"
CREATE_LOG=$(stellar contract invoke --id "$CONTRACT" --source "$IDENTITY" --network "$NETWORK" \
  -- create_payment \
  --sender "$(stellar keys address "$IDENTITY")" \
  --amount "$AMOUNT" \
  --claim_hash "$CLAIM_HASH" \
  --expiry "$EXPIRY" 2>&1) || { echo "$CREATE_LOG"; exit 1; }
CREATE_TX=$(echo "$CREATE_LOG" | grep -o 'Signing transaction: [a-f0-9]*' | cut -d' ' -f3)

echo "── get_payment (should be Pending) ───────────────────────────"
stellar contract invoke --id "$CONTRACT" --source "$IDENTITY" --network "$NETWORK" \
  -- get_payment --claim_hash "$CLAIM_HASH" 2>/dev/null

echo "── claim (secret → recipient) ────────────────────────────────"
CLAIM_LOG=$(stellar contract invoke --id "$CONTRACT" --source "$IDENTITY" --network "$NETWORK" \
  -- claim --secret "$SECRET" --destination "$RECIPIENT" 2>&1) || { echo "$CLAIM_LOG"; exit 1; }
CLAIM_TX=$(echo "$CLAIM_LOG" | grep -o 'Signing transaction: [a-f0-9]*' | cut -d' ' -f3)

cat <<EOF

══════════════════════════════════════════════════════════════════
 smoke test passed — escrow created and claimed on testnet

 create_payment tx : $CREATE_TX
   https://stellar.expert/explorer/testnet/tx/$CREATE_TX
 claim tx          : $CLAIM_TX
   https://stellar.expert/explorer/testnet/tx/$CLAIM_TX
══════════════════════════════════════════════════════════════════
EOF
