import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { runCencoriAgent } from "./cencori-agent.mjs";
import { recordReceiptOnCelo } from "./celo-record.mjs";
import { createReceipt, hashReceipt, stableJson } from "./receipt.mjs";
import { loadEnv, readEnv, readOptionalAgentId } from "./env.mjs";
import { loadAgentConfig } from "./agent-config.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const outputDir = path.resolve(__dirname, "../output");

export async function runAgent({ task } = {}) {
  loadEnv();
  const config = loadAgentConfig();
  const resolvedTask = (task || "").trim() || config.task;

  const agentId = readOptionalAgentId();
  const externalRunId = `cencori-celo-${Date.now()}`;
  const startedAt = new Date().toISOString();

  const result = await runCencoriAgent({
    apiKey: readEnv("CENCORI_API_KEY"),
    baseUrl: readEnv("CENCORI_BASE_URL", "https://cencori.com/api/v1"),
    agentId,
    model: readEnv("CENCORI_MODEL", "llama-3.3-70b-versatile"),
    task: resolvedTask,
    externalRunId,
    systemPrompt: config.systemPrompt,
  });

  const completedAt = new Date().toISOString();
  const payee = readEnv("DEMO_PAYEE_ADDRESS", "");

  const receipt = createReceipt({
    agentId,
    agentName: config.name,
    model: readEnv("CENCORI_MODEL", "llama-3.3-70b-versatile"),
    externalRunId,
    task: resolvedTask.slice(0, 500),
    status: "completed",
    startedAt,
    completedAt,
    outputPreview: result.content.slice(0, 500),
    usage: result.usage,
    controls: {
      shadow_mode: false,
      approval_required: false,
      max_spend_usd: readEnv("DEMO_MAX_SPEND_USD", "0.10"),
      cencori_request_id: result.requestId,
      cencori_response_simulated: result.simulated,
    },
    celo: {
      chain_id: 11142220,
      payment_token: readEnv("DEMO_PAYMENT_TOKEN", "USDC"),
      payment_amount: readEnv("DEMO_PAYMENT_AMOUNT", "0.05"),
      payee,
      payment_settled_onchain: false,
      payment_note:
        "payment_* fields are receipt metadata only; onchain tx is recordRun(receiptHash), not a token transfer",
    },
  });

  const receiptHash = hashReceipt(receipt);

  try { fs.mkdirSync(outputDir, { recursive: true }); } catch {}
  const receiptPath = path.join(outputDir, `${externalRunId}.json`);

  const onchain = await recordReceiptOnCelo({
    rpcUrl: readEnv("CELO_RPC_URL", "https://forno.celo-sepolia.celo-testnet.org"),
    privateKey: readEnv("CELO_PRIVATE_KEY"),
    contractAddress: readEnv("CELO_RECEIPTS_CONTRACT"),
    receiptHash,
    externalRunId,
    receiptURI: `file://${receiptPath}`,
  });

  const fullReceipt = {
    ...receipt,
    receipt_hash: receiptHash,
    onchain_recorded: !onchain.simulated,
    onchain_tx_hash: onchain.txHash || null,
  };
  try { fs.writeFileSync(receiptPath, `${stableJson(fullReceipt)}\n`); } catch {}

  const explorerBase = readEnv("CELO_EXPLORER_URL", "https://celo-sepolia.blockscout.com");
  const explorerUrl = onchain.txHash
    ? `${explorerBase.replace(/\/+$/, "")}/tx/${onchain.txHash}`
    : null;

  return {
    externalRunId,
    task: resolvedTask,
    content: result.content,
    requestId: result.requestId,
    simulated: result.simulated,
    usage: result.usage,
    receiptHash,
    receiptPath,
    receipt: fullReceipt,
    onchain: {
      recorded: !onchain.simulated,
      txHash: onchain.txHash || null,
      message: onchain.message || null,
      explorerUrl,
    },
    payee: payee || null,
  };
}

export function listRuns() {
  const dir = outputDir;
  if (!fs.existsSync(dir)) return [];
  const files = fs.readdirSync(dir).filter((f) => f.endsWith(".json")).sort().reverse().slice(0, 20);
  return files.map((f) => {
    const id = f.replace(/\.json$/, "");
    const preview = (() => {
      try {
        const data = JSON.parse(fs.readFileSync(path.join(dir, f), "utf8"));
        return { id, taskPreview: data.run?.task?.slice(0, 80) || "Agent run" };
      } catch { return { id, taskPreview: "Agent run" }; }
    })();
    return preview;
  });
}

export function getRun(id) {
  const filePath = path.join(outputDir, `${id}.json`);
  if (!fs.existsSync(filePath)) return null;
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch { return null; }
}

/** @deprecated Use runAgent */
export const runResearchAgent = runAgent;
