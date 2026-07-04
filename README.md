# kirim — Stellar Payment Dashboard

## 📖 Project description

**kirim** is a clean, black-and-white payment dashboard running live on the **Stellar testnet**, built for the Stellar Hackathon (Level 1). It lets anyone:

- **Connect / disconnect** a Stellar wallet (Freighter, xBull, Albedo, Lobstr & more via Stellar Wallets Kit)
- **See their XLM balance** at a glance — new, unfunded accounts get a one-click **Fund with Friendbot** button (10,000 free testnet XLM)
- **Send XLM payments** through a safe three-step flow: form → review & confirm → sign in the wallet
- **See the transaction result instantly** — a success screen with the transaction hash linked to [Stellar Expert](https://stellar.expert/explorer/testnet), plus an auto-refreshing activity feed

The design is intentionally minimal: dominant white, hairline borders, near-black text, with color reserved only for meaning (connection status, success/error). All blockchain logic lives in `stellar-frontend-challenge/lib/stellar-helper.ts` (from the [challenge template](https://github.com/Halfgork/stellar-frontend-challenge)) and is untouched per the template rules — the work is 100% UI/UX and product polish.

## 📸 Screenshots

### 1. Wallet connected

The header shows the connected address as a chip with a live status dot, copy button, explorer link, and disconnect.

![Wallet connected](screenshots/wallet-connected.png)

### 2. Balance displayed

The dashboard leads with the account's XLM balance, with refresh and network-reserve hint.

![Balance displayed](screenshots/balance.png)

### 3. Transaction result shown to the user

After signing, the user sees a success panel with the amount, recipient, full transaction hash (copyable), and a direct Stellar Expert link.

![Transaction result](screenshots/transaction-success.png)

### 4. Successful testnet transaction

The same transaction confirmed on-chain, viewed on Stellar Expert (testnet).

![Transaction on Stellar Expert](screenshots/transaction-explorer.png)

## 🚀 Setup — run it locally

### Prerequisites

- **Node.js 18+**
- **[Freighter](https://freighter.app) wallet extension**, switched to **Testnet**:
  Freighter → settings (gear icon) → *Network* → **Testnet**

### Install & run

```bash
git clone <your-repo-url>
cd stellar-hack/stellar-frontend-challenge
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000), then:

1. **Connect** — click *Connect Wallet* and pick Freighter in the modal.
2. **Fund** — a brand-new account shows a *Fund with Friendbot* button; click it to receive free testnet XLM.
3. **Send** — enter a recipient `G…` address and an amount → *Review payment* → *Confirm & sign* in Freighter.
4. **Verify** — the success screen shows the transaction hash; follow the link to see it on Stellar Expert. The Activity panel refreshes automatically.

### Production build

```bash
npm run build
npm start
```

## ✅ Level 1 requirement checklist

| # | Requirement | Where |
|---|-------------|-------|
| 1 | Freighter wallet setup on Testnet | Setup steps above; Wallets Kit modal defaults to Freighter (`lib/stellar-helper.ts`) |
| 2 | Wallet connect / disconnect | `components/WalletConnection.tsx` — header chip + hero CTA |
| 3 | Fetch & display XLM balance | `components/BalanceDisplay.tsx` — balance hero, refresh, Friendbot funding for unfunded accounts (`lib/friendbot.ts`) |
| 4 | Send XLM tx + success/failure feedback with tx hash | `components/PaymentForm.tsx` — validation → confirm step → success panel with hash + explorer link; friendly error states |
| 5 | Development standards | TypeScript throughout, inline error handling (no `alert()`), loading skeletons, empty states, mobile-first responsive |

Extras: confirmation step before signing, activity feed with direction & relative time, subtle animations, fully responsive.

## 🧭 Project structure

```
stellar-hack/
├── README.md                     # ← you are here
├── screenshots/                  # Submission screenshots
├── stellar-frontend-challenge/   # Level 1 — wallet dashboard (Next.js 14)
│   ├── app/                      # Layout, page (hero + dashboard), theme
│   ├── components/               # Wallet, balance, send, activity, UI primitives
│   └── lib/
│       ├── stellar-helper.ts     # ⚠️ DO NOT MODIFY — blockchain logic (template)
│       └── friendbot.ts          # Testnet faucet HTTP call
└── soroban-hello-world/          # Soroban contract workspace (Rust) — later levels
```

## 🛠 Tech stack

Next.js 14 · TypeScript · Tailwind CSS · @stellar/stellar-sdk · Stellar Wallets Kit ([Creit Tech](https://github.com/Creit-Tech/Stellar-Wallets-Kit))

---

⚠️ Testnet only — do not use real funds.
