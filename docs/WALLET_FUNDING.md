# Wallet Funding Guide

## Overview

Every Indyfren creator gets a **Privy-managed server wallet** on the **Tempo Network** (EVM-compatible testnet). This wallet is used by your AI agent to pay for premium services like brand research, email sending, and content generation.

## Current State

When your wallet is first provisioned, it has:

- ✅ A valid Tempo Network address (0x...)
- ✅ Spending limits configured (per-transaction, daily, monthly)
- ❌ **Zero balance** in pathUSD (Tempo's stablecoin)

Current sandbox limitation: Indyfren does not yet auto-fund newly provisioned Tempo wallets. A paid MPP smoke can reach the Tempo payment path and still fail with `InsufficientBalance` until an operator funds the creator wallet with testnet pathUSD.

## Why You Need to Fund Your Wallet

The AI agent uses **MPP (Micropayment Protocol)** to pay for services like:

- **Brand enrichment** (~$0.50 per lookup) - StableEnrich
- **Web search** (~$0.10 per query) - Exa API
- **Email sending** (~$0.05 per email) - StableEmail
- **Social analytics** (~$0.25 per platform) - StableSocial
- **Media kit generation** (~$1.00 per kit) - StableStudio

Without funds, your agent can still:

- ✅ Use free commands (calendar, finances, content plan)
- ✅ Access your connected platform data
- ❌ Cannot call paid research/automation APIs

## How to Fund Your Wallet (Testnet)

### Option 1: Operator Sandbox Funding (Current Path)

1. **Get your wallet address** from the dashboard:
   - Navigate to **Dashboard → Wallet**
   - Copy your Tempo wallet address (starts with `0x`)

2. **Send the address to the Indyfren operator running the sandbox.**
   - The operator funds the Privy server wallet with Tempo testnet pathUSD.
   - After funding, rerun `npm run test:mpp` with `MPP_TEST_CREATOR_ID` set to that creator.

3. **Verify balance:**
   - Refresh your dashboard
   - Check **Wallet → Balance**
   - You should see your pathUSD balance

### Option 2: Tempo Faucet or Bridge (When Available)

Tempo/Moderato faucet and bridge availability can change. Use official Tempo sandbox docs for the current funding route, then send testnet pathUSD directly to the Privy server wallet address shown in the dashboard.

### Option 3: Bridge from Another Testnet

If you have testnet USDC on another network (Base Sepolia, etc.):

1. Use a testnet bridge to transfer to Tempo:
   - Confirm the current Tempo testnet bridge URL from official Tempo docs
   - Connect your MetaMask or wallet
   - Bridge USDC → pathUSD on Tempo

2. **Important:** Your Indyfren wallet is a **server wallet** managed by Privy. To fund it from your personal wallet:
   - Copy your Indyfren wallet address from the dashboard
   - Send testnet pathUSD directly to that address
   - The transaction will show up in your wallet activity

### Option 4: Request from Indyfren Team

For early beta users:

1. Share your wallet address with the Indyfren team
2. We'll send you testnet pathUSD to get started
3. Contact: support@chainfren.com (or your onboarding contact)

## Recommended Funding Amounts

For testing and evaluation:

- **$10 in pathUSD** - Good for ~20-40 agent actions
- **$50 in pathUSD** - Good for heavy testing (100+ actions)

Remember: This is **testnet**, so these tokens have no real-world value.

## Checking Your Balance

### In the Dashboard

1. Go to **Dashboard → Wallet**
2. Your balance shows in USD equivalent
3. Transaction history shows all funding and spending

### Via API

```bash
curl -H "Authorization: Bearer <your_privy_token>" \
  https://your-api.railway.app/api/wallet/balance
```

## Spending Limits

Your wallet has built-in safeguards:

- **Per-transaction limit:** $5 (default)
  - Prevents any single tool call from costing too much
  - Configurable in Settings

- **Daily limit:** $50 (default)
  - Caps total spending per day
  - Resets at midnight UTC

- **Monthly limit:** $500 (default)
  - Prevents runaway costs
  - Configurable for high-volume users

You can adjust these limits in **Dashboard → Settings → Spending Controls**.

## What Happens When Balance is Low?

When your wallet balance drops below $1:

- ⚠️ Dashboard shows a warning banner
- 📧 You'll receive a notification via your bot (Telegram/WhatsApp)
- 🤖 Agent switches to free-only mode until funded

When balance reaches $0:

- ❌ Paid tool calls are blocked
- ✅ Free features continue working
- 💬 Bot notifies you to fund your wallet

## Mainnet (Production) - Coming Soon

When Indyfren launches on mainnet:

- Wallets will be on **Tempo Mainnet** (not testnet)
- pathUSD will be **real USDC** with actual value
- You'll fund via:
  - Credit card (Privy onramp)
  - Bridge from other chains
  - Direct USDC transfer

Spending will be tracked for:

- Tax reporting
- Business expense tracking
- ROI analysis ($ spent on agent vs. $ earned from deals)

## Troubleshooting

### "Insufficient balance" errors

1. Check your wallet balance in the dashboard
2. Verify the transaction was confirmed (check Tempo block explorer)
3. Try refreshing the dashboard
4. If balance shows $0 after funding, contact support

### Wallet address not showing

1. Make sure you're signed in with Privy
2. Check onboarding status - should be "active" not "wallet_pending"
3. Try the manual retry: **Settings → Wallet → Retry Wallet Setup**

### Transaction failed / Couldn't pay for service

1. Verify wallet balance > tool cost
2. Check spending limits aren't exceeded
3. View transaction history for failed attempts
4. Try again - network issues can cause temporary failures

### Inspecting payment attempts

Paid MPP calls create rows in the `payment_attempts` table as soon as a request starts. Check that ledger when a paid tool fails:

- `started` means the service call was attempted.
- `challenge_created` means the paid endpoint returned a Tempo payment challenge and Indyfren recorded the quote.
- `credential_created` means the wallet created the payment credential.
- `succeeded` includes the receipt/transaction reference and linked wallet transaction.
- `failed` includes the error text, including current sandbox `InsufficientBalance` failures.

If the table is missing in a live environment, set `DATABASE_URL` to a working Supabase direct or pooler Postgres URL and run:

```bash
npm run db:migrate:payment-attempts
```

## Support

Need help with wallet funding?

- 📧 Email: support@chainfren.com
- 💬 Telegram: @indyfren_support
- 📖 Docs: https://docs.indyfren.xyz/wallet

## Security Note

Your wallet is a **Privy server wallet** with:

- ✅ **Policy-based spending controls** (you set the limits)
- ✅ **No seed phrase to manage** (Privy handles key security)
- ✅ **Scoped to agent actions only** (can't be used for other purposes)
- ✅ **Auditable** (all transactions logged and visible)

Your personal funds are never at risk - only the amount you choose to deposit into your agent wallet.
