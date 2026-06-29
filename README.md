# Cencori Agent — General Purpose AI with Celo Subscription Payments

AI agent powered by **Cencori** gateway, with optional **Celo** blockchain subscription payments via MetaMask.

## Quickstart

```bash
npm install
cp .env.example .env   # add CENCORI_API_KEY
npm run dev            # http://localhost:3333
```

## How it works

- **Free tier** — uses the standard model (llama-3.3-70b), no wallet needed
- **Pro tier** — $5/month via Celo cUSD, uses the premium model
- Connect MetaMask, pay the subscription to the `SubscriptionManager` contract, and get Pro access for 30 days
- All agent runs are recorded as structured receipts (internal audit log)

## Configuration

Edit `agent.config.json`:
- `task` / `systemPrompt` — default agent behaviour
- `pricing.free.model` — model for free tier
- `pricing.pro.model` — model for pro tier
- `subscription.monthlyPriceUsd` — subscription price
- `subscription.paymentToken` — token address for payment

## Celo subscription

```bash
npm run compile           # solc → build/
npm run deploy:sub        # deploy SubscriptionManager to Celo Sepolia
```

Requires `CELO_PRIVATE_KEY` and funded wallet (faucet: https://faucet.celo.org/celo-sepolia).

## Commands

| Command | Description |
|---------|-------------|
| `npm run dev` | Web UI at localhost:3333 |
| `npm run demo` | CLI single agent run |
| `npm run compile` | Compile SubscriptionManager.sol |
| `npm run deploy:sub` | Deploy subscription contract |
