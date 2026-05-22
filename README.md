# Cencori × Celo Agent Receipt Starter

Forkable starter: **Cencori** for agent infrastructure, **Celo** for onchain proof of agent runs.

```text
Cencori Agent Run → Structured Receipt → SHA-256 Hash → recordRun() on Celo Sepolia (optional)
```

## Configure the agent

Edit **`agent.config.json`** (committed default):

```json
{
  "name": "Cencori project agent",
  "task": "Your default prompt…",
  "systemPrompt": "System instructions for the gateway call…"
}
```

Optional env overrides: `AGENT_TASK`, `AGENT_NAME`, `AGENT_SYSTEM_PROMPT`, `AGENT_CONFIG_PATH`.

Copy **`.env.example`** → **`.env`** and add your keys (never commit `.env`).

## Payments vs onchain proof

- **Onchain in this repo:** `recordRun(receiptHash, …)` on `AgentRunReceipts` (proof event).
- **Not in this repo:** USDC/USDT transfers, x402 charges, or MiniPay sends.
- `DEMO_PAYMENT_*` values are receipt metadata only.

## Quickstart

```bash
npm install
cp .env.example .env   # add CENCORI_API_KEY
npm run dev            # http://localhost:3333
npm run demo           # CLI single run
npm run setup:celo     # wallet + faucet link
npm run deploy         # after funding wallet
npm run ship           # deploy (if funded) + run
```

### Cencori API base URL

Use the gateway on the main domain:

```bash
CENCORI_BASE_URL=https://cencori.com/api/v1
```

Do **not** use `https://api.cencori.com/v1` — that host may be unreachable.

## What you get

- Cencori gateway (chat completions + trace id)
- Structured receipt JSON + deterministic hash
- Optional Celo Sepolia `recordRun` tx
- CLI + local web UI (secrets stay server-side)
- Simulation mode when keys are missing

## Celo Sepolia

```text
Chain ID: 11142220
RPC: https://forno.celo-sepolia.celo-testnet.org
Explorer: https://celo-sepolia.blockscout.com
```

## Internal doc (for Celo team)

**[docs/CELO_TEAM_INTEGRATION.md](docs/CELO_TEAM_INTEGRATION.md)** — architecture, schema, API, scope, demo script.

## Extension ideas

- Real stablecoin settlement on Celo
- Public `receiptURI` (HTTPS / IPFS)
- ERC-8004 agent reputation
- x402 paid tools
- MiniPay-facing flows
