# kirim Soroban contracts

Two contracts, one Cargo workspace, both deployed on Stellar testnet.

```text
.
├── contracts
│   ├── kirim-escrow/     hashlock escrow: create_payment / claim / refund
│   └── kirim-router/     fee router: send_remittance (cross-contract call into kirim-escrow)
├── scripts/              deploy + smoke-test shell scripts
└── Cargo.toml            workspace root
```

## kirim-escrow

Locks a token amount behind `sha256(secret)` with an expiry.

- `initialize(admin, token)`
- `create_payment(sender, amount, claim_hash, expiry) -> Result<(), Error>` — `sender.require_auth()`, transfers `amount` from `sender` into the contract, emits `("created", claim_hash) → (amount, expiry)`
- `claim(secret, destination) -> Result<(), Error>` — anyone who knows `secret` can redeem to any `destination` before `expiry`; emits `("claimed", claim_hash) → (destination, amount)`
- `refund(claim_hash) -> Result<(), Error>` — returns funds to the original `sender` once expired; emits `("refunded", claim_hash) → (sender, amount)`
- `get_payment(claim_hash) -> Option<Payment>`

Deployed: `CAPLG3MZG6LSH2VMGZHIQV7T5DP7RBJNQH44OLAUPIK3FDQHK5K5PW2Y`

## kirim-router

Takes a platform fee before locking the remainder in escrow, on behalf of the user.

- `initialize(admin, token, escrow, treasury, fee_bps)` — `fee_bps` capped at 1000 (10%)
- `send_remittance(sender, amount, claim_hash, expiry) -> Result<i128, Error>` — `sender.require_auth()`, transfers `fee = amount * fee_bps / 10_000` to the treasury, then cross-contract-calls `kirim-escrow.create_payment(sender, net, claim_hash, expiry)` — **with the original user as `sender`**, so a later refund goes to the user, not the router. Emits `("routed", claim_hash) → (fee, net)`. Returns `net`.
- `set_fee_bps(new_bps)` / `set_treasury(new_treasury)` — admin-only
- `get_config() -> Result<Config, Error>`

Deployed: `CCSVW2FTWP7UMB6EVSUUCZ3Y5I3JWHZXBWFJM3JMOT2C7GXSIP37Y6A6` (points at the escrow above, 1% fee)

The cross-contract call uses a minimal `#[contractclient]` trait declared inside `kirim-router` (not a crate dependency or `contractimport!` of the compiled escrow wasm), so the router's wasm exports **only its own 5 functions** — verified with `stellar contract info interface`. The escrow crate is only pulled in as a `[dev-dependencies]` path dependency so integration tests can register the real escrow contract in the same `Env`.

### One signature, two transfers, one cross-contract call

Because `sender` is the transaction's source account, Soroban's recording-mode simulation produces `SourceAccount` auth credentials for every `require_auth()` in the call tree — the router's own, the fee transfer's, and the nested escrow's. All of them are satisfied by the single envelope signature the wallet produces; no extra `authorizeEntry` round trip is needed.

## Error codes

Escrow (1–10) and router (101+) use disjoint ranges so a generic `Error(Contract, #N)` failure can be mapped to the right contract's message without knowing in advance which one raised it — see `stellar-frontend-challenge/lib/contract.ts`.

| Code | Contract | Meaning |
|------|----------|---------|
| 1 | escrow | Already initialized |
| 2 | escrow | Not initialized |
| 3 | escrow | Payment with this claim hash already exists |
| 4 | escrow | No payment found |
| 5 | escrow | Invalid amount |
| 6 | escrow | Invalid expiry |
| 7 | escrow | Already claimed or refunded |
| 8 | escrow | Expired |
| 9 | escrow | Not yet expired |
| 10 | escrow | Wrong secret |
| 101 | router | Already initialized |
| 102 | router | Not initialized |
| 103 | router | Invalid amount |
| 104 | router | Invalid fee (over the 10% cap) |
| 105 | router | Net amount after fee is zero |

## Commands

```bash
cargo test --workspace                              # 19 tests (8 escrow + 11 router)
cargo fmt --check
cargo clippy --workspace --all-targets -- -D warnings
stellar contract build

./scripts/deploy-testnet.sh                          # deploy + initialize kirim-escrow
./scripts/deploy-router.sh                            # deploy + initialize kirim-router
./scripts/smoke-test.sh                               # escrow: create_payment -> get_payment -> claim
./scripts/smoke-test-router.sh                        # router: send_remittance -> get_payment -> claim
```

Requires the [Stellar CLI](https://developers.stellar.org/docs/tools/cli) and the `wasm32v1-none` Rust target.
