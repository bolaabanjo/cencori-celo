import { loadEnv, readEnv } from "../src/env.mjs";
import { getAppStatus } from "../src/status.mjs";
import { loadAgentConfig } from "../src/agent-config.mjs";
import { getRun, listRuns, runAgent } from "../src/run-agent.mjs";
import { deployAgentRunReceipts } from "../src/deploy.mjs";
import { writeEnv } from "../src/env.mjs";

loadEnv();

function json(res, status, body) {
  res.writeHead(status, { "Content-Type": "application/json" });
  res.end(JSON.stringify(body));
}

async function readBody(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const raw = Buffer.concat(chunks).toString("utf8");
  if (!raw) return {};
  try {
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

export default async function handler(req, res) {
  try {
    const url = new URL(req.url || "/", "http://localhost");
    const { pathname } = url;

    if (pathname === "/api/status" && req.method === "GET") {
      return json(res, 200, await getAppStatus());
    }

    if (pathname === "/api/config" && req.method === "GET") {
      return json(res, 200, loadAgentConfig());
    }

    if (pathname === "/api/runs" && req.method === "GET") {
      return json(res, 200, { runs: listRuns() });
    }

    const runMatch = pathname.match(/^\/api\/runs\/([^/]+)$/);
    if (runMatch && req.method === "GET") {
      const run = getRun(runMatch[1]);
      if (!run) return json(res, 404, { error: "Run not found" });
      return json(res, 200, { run });
    }

    if (pathname === "/api/run" && req.method === "POST") {
      const body = await readBody(req);
      const config = loadAgentConfig();
      const task = (body.task || "").trim() || config.task;
      const result = await runAgent({ task });
      return json(res, 200, result);
    }

    if (pathname === "/api/deploy" && req.method === "POST") {
      const deployed = await deployAgentRunReceipts({
        rpcUrl: readEnv("CELO_RPC_URL", "https://forno.celo-sepolia.celo-testnet.org"),
        privateKey: readEnv("CELO_PRIVATE_KEY"),
        contractAddress: readEnv("CELO_RECEIPTS_CONTRACT"),
      });
      if (!deployed.skipped) {
        writeEnv({ CELO_RECEIPTS_CONTRACT: deployed.address });
      }
      return json(res, 200, deployed);
    }

    return json(res, 404, { error: "Unknown route" });
  } catch (err) {
    console.error("Handler error:", err);
    return json(res, 500, { error: err.message || "Internal error" });
  }
}
