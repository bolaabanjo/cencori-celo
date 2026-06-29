import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { runCencoriAgent } from "./cencori-agent.mjs";
import { createReceipt, hashReceipt, stableJson } from "./receipt.mjs";
import { loadEnv, readEnv, readOptionalAgentId } from "./env.mjs";
import { loadAgentConfig } from "./agent-config.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const outputDir = path.resolve(__dirname, "../output");

export async function runAgent({ task, tier = "free" } = {}) {
  loadEnv();
  const config = loadAgentConfig();
  const resolvedTask = (task || "").trim() || config.task;

  const agentId = readOptionalAgentId();
  const externalRunId = `run-${Date.now()}`;
  const startedAt = new Date().toISOString();

  const pricingTier = config.pricing?.[tier] || config.pricing?.free || {};
  const model = pricingTier.model || readEnv("CENCORI_MODEL", "llama-3.3-70b-versatile");

  const result = await runCencoriAgent({
    apiKey: readEnv("CENCORI_API_KEY"),
    baseUrl: readEnv("CENCORI_BASE_URL", "https://cencori.com/api/v1"),
    agentId,
    model,
    task: resolvedTask,
    externalRunId,
    systemPrompt: config.systemPrompt,
  });

  const completedAt = new Date().toISOString();

  const receipt = createReceipt({
    agentId,
    agentName: config.name,
    model,
    externalRunId,
    task: resolvedTask.slice(0, 500),
    status: "completed",
    startedAt,
    completedAt,
    outputPreview: result.content.slice(0, 500),
    usage: result.usage,
    controls: {
      tier,
      cencori_request_id: result.requestId,
      cencori_response_simulated: result.simulated,
    },
  });

  const receiptHash = hashReceipt(receipt);

  try { fs.mkdirSync(outputDir, { recursive: true }); } catch {}
  const receiptPath = path.join(outputDir, `${externalRunId}.json`);

  const fullReceipt = {
    ...receipt,
    receipt_hash: receiptHash,
    tier,
  };
  try { fs.writeFileSync(receiptPath, `${stableJson(fullReceipt)}\n`); } catch {}

  return {
    externalRunId,
    tier,
    task: resolvedTask,
    content: result.content,
    requestId: result.requestId,
    simulated: result.simulated,
    usage: result.usage,
    receiptHash,
    receiptPath,
    receipt: fullReceipt,
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
