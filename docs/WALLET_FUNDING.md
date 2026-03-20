# Wallet Funding Guide

## Overview

Every Indyfren creator gets a **Privy-managed server wallet** on the **Tempo Network** (EVM-compatible testnet). This wallet is used by your AI agent to pay for premium services like brand research, email sending, and content generation.

## Current State

When your wallet is first provisioned, it has:
- ✅ A valid Tempo Network address (0x...)
- ✅ Spending limits configured (per-transaction, daily, monthly)
- ❌ **Zero balance** in pathUSD (Tempo's stablecoin)

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

### Option 1: Tempo Testnet Faucet (Recommended)

1. **Get your wallet address** from the dashboard:
   - Navigate to **Dashboard → Wallet**
   - Copy your Tempo wallet address (starts with `0x`)

2. **Visit the Tempo Testnet Faucet:**
   - URL: `https://faucet.tempo.xyz` (hypothetical - check Tempo docs for actual faucet)
   - OR use the Moderato testnet faucet if Tempo provides one

3. **Request pathUSD:**
   - Paste your wallet address
   - Request testnet pathUSD
   - Wait for transaction confirmation (usually <30 seconds)

4. **Verify balance:**
   - Refresh your dashboard
   - Check **Wallet → Balance**
   - You should see your pathUSD balance

### Option 2: Bridge from Another Testnet

If you have testnet USDC on another network (Base Sepolia, etc.):

1. Use a testnet bridge to transfer to Tempo:
   - Tempo Bridge: `https://bridge.tempo.xyz/testnet`
   - Connect your MetaMask or wallet
   - Bridge USDC → pathUSD on Tempo

2. **Important:** Your Indyfren wallet is a **server wallet** managed by Privy. To fund it from your personal wallet:
   - Copy your Indyfren wallet address from the dashboard
   - Send testnet pathUSD directly to that address
   - The transaction will show up in your wallet activity

### Option 3: Request from Indyfren Team

For early beta users:

1. Share your wallet address with the Indyfren team
2. We'll send you testnet pathUSD to get started
3. Contact: support@indyfren.xyz (or your onboarding contact)

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

## Support

Need help with wallet funding?
- 📧 Email: support@indyfren.xyz
- 💬 Telegram: @indyfren_support
- 📖 Docs: https://docs.indyfren.xyz/wallet

## Security Note

Your wallet is a **Privy server wallet** with:
- ✅ **Policy-based spending controls** (you set the limits)
- ✅ **No seed phrase to manage** (Privy handles key security)
- ✅ **Scoped to agent actions only** (can't be used for other purposes)
- ✅ **Auditable** (all transactions logged and visible)

Your personal funds are never at risk - only the amount you choose to deposit into your agent wallet.
