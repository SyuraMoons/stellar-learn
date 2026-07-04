# kirim — Stellar Payment Dashboard (Level 1)

A clean, black-and-white payment dashboard on the **Stellar testnet**. Connect a wallet, check your XLM balance, send payments, and track activity — every transaction verifiable on [Stellar Expert](https://stellar.expert/explorer/testnet).

Built on the [Stellar Frontend Challenge template](https://github.com/Halfgork/stellar-frontend-challenge); all blockchain logic lives in `lib/stellar-helper.ts` (Stellar Wallets Kit) and is untouched.

## ✅ Level 1 requirement checklist

| # | Requirement | Where |
|---|-------------|-------|
| 1 | Freighter wallet setup on Testnet | Setup steps below; Wallets Kit modal defaults to Freighter (`lib/stellar-helper.ts`) |
| 2 | Wallet connect / disconnect | `components/WalletConnection.tsx` — header chip + hero CTA, copy address, explorer link, disconnect |
| 3 | Fetch & display XLM balance | `components/BalanceDisplay.tsx` — large tabular balance, refresh, unfunded-account state with one-click **Friendbot** funding (`lib/friendbot.ts`) |
| 4 | Send XLM tx + feedback (success/failure, tx hash) | `components/PaymentForm.tsx` — validation → review/confirm step → success panel with tx hash + Stellar Expert link, friendly error states |
| 5 | Development standards | TypeScript throughout, inline error handling (no `alert()`), loading skeletons, empty states, mobile-first responsive UI |

Extras: transaction confirmation step before signing, activity feed with direction/relative time (`components/TransactionHistory.tsx`), subtle animations, fully responsive.

## 🚀 Setup

### 1. Wallet (Freighter)

1. Install [Freighter](https://freighter.app) and create a wallet.
2. Open Freighter → settings (gear) → **Network → Testnet**.

### 2. Run the app

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### 3. Use it

1. **Connect** — click *Connect Wallet* and pick Freighter in the modal.
2. **Fund** — if your account is new, the dashboard shows a *Fund with Friendbot* button (free 10,000 testnet XLM).
3. **Send** — enter a recipient `G…` address and amount → *Review payment* → *Confirm & sign* in Freighter.
4. **Verify** — the success screen shows the transaction hash with a link to Stellar Expert; the Activity panel updates automatically.

## 🧭 Project structure

```
app/
  layout.tsx            # Inter font, metadata
  page.tsx              # Header, hero (disconnected), dashboard (connected)
  globals.css           # White base theme, animations
components/
  WalletConnection.tsx  # Connect/disconnect (header chip + hero CTA)
  BalanceDisplay.tsx    # XLM balance, Friendbot funding, error/retry
  PaymentForm.tsx       # Form → review → success/error
  TransactionHistory.tsx# Recent payments with explorer links
  example-components.tsx# UI primitives (Card, Button, Input, Alert, …)
lib/
  stellar-helper.ts     # ⚠️ DO NOT MODIFY — all blockchain logic
  friendbot.ts          # Testnet faucet HTTP call (not tx logic)
```

## 🎨 Design

Monochrome and dominant white: white surfaces, hairline neutral borders, near-black text, solid black actions. Color is reserved for meaning only — a green connection dot and muted red/green success/error states. Inter typeface, tabular numerals for balances, monospace for addresses and hashes.

## 🛠 Tech

Next.js 14 · TypeScript · Tailwind CSS · @stellar/stellar-sdk · Stellar Wallets Kit

---

⚠️ Testnet only — do not use real funds.
