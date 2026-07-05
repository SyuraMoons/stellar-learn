# kirim — Stellar Payment Dashboard + Escrow Contract

## 📖 Project description

**kirim** is a clean, black-and-white payment dashboard running live on the **Stellar testnet**, built for the Stellar Hackathon (Levels 1 & 2). It lets anyone:

- **Connect / disconnect** a Stellar wallet — multi-wallet via Stellar Wallets Kit (Freighter, xBull, Albedo, Lobstr & more)
- **See their XLM balance** at a glance — new, unfunded accounts get a one-click **Fund with Friendbot** button
- **Send XLM payments** through a safe three-step flow: form → review & confirm → sign in the wallet
- **Lock XLM in a smart contract** — the **kirim-escrow** Soroban contract escrows funds behind a one-time claim code; anyone with the code can claim to their own wallet, with a live transaction status timeline (prepare → sign → submit → confirm)
- **Watch contract activity in real time** — the dashboard polls Soroban RPC events and shows every escrow creation/claim/refund as it happens

The design is intentionally minimal: dominant white, hairline borders, near-black text, color reserved for meaning only. Template blockchain logic in `stellar-frontend-challenge/lib/stellar-helper.ts` is untouched; all contract-call logic is our own (`lib/contract.ts`).

## ⛓️ Deployed contract (Stellar testnet)

| | |
|---|---|
| **Contract address** | [`CD3HCXPVO5AQXEIYI3LH47Q7MTPUTFSWLHPSVPRZV6E2NFCUXDFMBR27`](https://stellar.expert/explorer/testnet/contract/CD3HCXPVO5AQXEIYI3LH47Q7MTPUTFSWLHPSVPRZV6E2NFCUXDFMBR27) |
| **Contract** | `kirim-escrow` — hashlock escrow (Rust / Soroban), source in [`soroban-hello-world/contracts/kirim-escrow/`](soroban-hello-world/contracts/kirim-escrow/src/lib.rs) |
| **Token** | Native XLM Stellar Asset Contract (no trustlines needed) |
| **Contract call tx (create_payment)** | [`9fe89306…9f132ae9`](https://stellar.expert/explorer/testnet/tx/9fe893067664fb61bc53bb04dd85cbcee9ec6b3b1df61990bd7068b29f132ae9) |
| **Contract call tx (claim)** | [`17783c97…44713b12`](https://stellar.expert/explorer/testnet/tx/17783c97b24b5da3547dd99efe015d6b36830038d90692863e624eb444713b12) |

How it works: `create_payment` locks XLM behind `sha256(secret)` with a 24h expiry · `claim` pays out to any destination that presents the secret · `refund` returns expired escrows to the sender. 8 unit tests cover the happy path, wrong secret, double claim, expiry, and duplicate-hash cases.

## 📸 Screenshots

### 1. Wallet options available

Multi-wallet connect modal (Stellar Wallets Kit).

![Wallet options](screenshots/wallet-options.png)

### 2. Wallet connected

Header chip with live status dot, copy, explorer link, and disconnect.

![Wallet connected](screenshots/wallet-connected.png)

### 3. Balance displayed

![Balance displayed](screenshots/balance.png)

### 4. Transaction result shown to the user

Success panel with amount, recipient, full transaction hash, and Stellar Expert link.

![Transaction result](screenshots/transaction-success.png)

### 5. Successful testnet transaction

The same transaction confirmed on-chain on Stellar Expert.

![Transaction on Stellar Expert](screenshots/transaction-explorer.png)

### 6. Contract call with status timeline

Locking XLM in the escrow contract: live status steps and the one-time claim code.

![Escrow create](screenshots/escrow-create.png)

### 7. Real-time contract events

Live feed of `created` / `claimed` / `refunded` events polled from Soroban RPC.

![Contract events](screenshots/contract-events.png)

## 🚀 Setup — run it locally

### Prerequisites

- **Node.js 18+**
- **A Stellar wallet extension** — [Freighter](https://freighter.app) recommended, switched to **Testnet** (Freighter → settings → *Network* → **Testnet**)

### Frontend

```bash
git clone <your-repo-url>
cd stellar-hack/stellar-frontend-challenge
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). The deployed contract id is baked into `lib/config.ts`; override via `.env.local` (see `.env.example`) if you redeploy.

Try it:

1. **Connect** — pick your wallet in the modal.
2. **Fund** — new accounts get a *Fund with Friendbot* button.
3. **Send XLM** — recipient + amount → review → sign.
4. **Escrow** — *Claimable payment → Send claimable*: lock XLM, copy the one-time claim code, watch the status timeline and the live event feed. Then *Claim with code* (from any connected wallet) to redeem it.

### Contract (optional — already deployed)

```bash
cd stellar-hack/soroban-hello-world
cargo test                        # 8 unit tests
./scripts/deploy-testnet.sh       # build, deploy, initialize with native XLM
./scripts/smoke-test.sh           # on-chain create_payment → get_payment → claim
```

Requires the [Stellar CLI](https://developers.stellar.org/docs/tools/cli) and the `wasm32v1-none` Rust target.

## ✅ Requirement checklist

### Level 2

| Requirement | Where |
|-------------|-------|
| Contract deployed on testnet | [`CD3HCX…BR27`](https://stellar.expert/explorer/testnet/contract/CD3HCXPVO5AQXEIYI3LH47Q7MTPUTFSWLHPSVPRZV6E2NFCUXDFMBR27), deployed via `soroban-hello-world/scripts/deploy-testnet.sh` |
| Contract called from the frontend | `lib/contract.ts` (simulate → sign → submit → confirm) used by `components/EscrowPanel.tsx` |
| Transaction status visible | Status timeline: *Prepare → Sign → Submit → Confirm* with live updates |
| 3+ error types handled | `lib/contract.ts` error taxonomy: **wallet** (signing declined), **contract** (typed contract error codes, e.g. wrong claim code / already claimed / expired), **funds** (insufficient balance / unfunded account), **network** (RPC failure / confirmation timeout) — each with a distinct message |
| Real-time event integration | `lib/contract-events.ts` polls Soroban RPC `getEvents`; `components/ContractEvents.tsx` renders the live feed |
| Multi-wallet | Stellar Wallets Kit modal (Freighter, xBull, Albedo, Lobstr, …); contract calls sign with whichever wallet the user selected |
| 2+ meaningful commits | Contract, deploy scripts, frontend integration, event feed, and docs are separate commits |

### Level 1

| Requirement | Where |
|-------------|-------|
| Freighter wallet setup on Testnet | Setup steps above |
| Wallet connect / disconnect | `components/WalletConnection.tsx` |
| Fetch & display XLM balance | `components/BalanceDisplay.tsx` + Friendbot funding (`lib/friendbot.ts`) |
| Send XLM tx + feedback with tx hash | `components/PaymentForm.tsx` — confirm step, success panel, explorer link |
| Development standards | TypeScript, inline error handling, loading skeletons, empty states, responsive |

## 🧭 Project structure

```
stellar-hack/
├── README.md
├── screenshots/                  # Submission screenshots
├── stellar-frontend-challenge/   # Frontend (Next.js 14 + Tailwind)
│   ├── app/                      # Layout, dashboard page, theme
│   ├── components/               # Wallet, balance, send, escrow, events UI
│   └── lib/
│       ├── stellar-helper.ts     # ⚠️ template blockchain logic (untouched)
│       ├── contract.ts           # kirim-escrow calls + error taxonomy (ours)
│       ├── contract-events.ts    # Soroban RPC event polling (ours)
│       ├── friendbot.ts          # Testnet faucet
│       └── config.ts             # Contract id + RPC URL
└── soroban-hello-world/          # Soroban workspace (Rust)
    ├── contracts/kirim-escrow/   # Hashlock escrow contract + 8 tests
    └── scripts/                  # deploy-testnet.sh, smoke-test.sh
```

## 🛠 Tech stack

Next.js 14 · TypeScript · Tailwind CSS · @stellar/stellar-sdk (Horizon + Soroban RPC) · Stellar Wallets Kit · Rust / soroban-sdk 26 · Stellar CLI

---

⚠️ Testnet only — do not use real funds. Live demo link: not deployed (optional per checklist).
