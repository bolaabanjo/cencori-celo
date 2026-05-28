import { loadEnv, readEnv } from "../src/env.mjs";
import { getAppStatus } from "../src/status.mjs";
import { loadAgentConfig } from "../src/agent-config.mjs";
import { getRun, listRuns, runAgent } from "../src/run-agent.mjs";
import { deployAgentRunReceipts } from "../src/deploy.mjs";
import { writeEnv } from "../src/env.mjs";

loadEnv();

function sendNodeJson(res, status, body) {
  res.writeHead(status, { "Content-Type": "application/json" });
  res.end(JSON.stringify(body));
}

function sendWebJson(status, body) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

async function readNodeBody(req) {
  if (req.body && typeof req.body === "object" && !Buffer.isBuffer(req.body)) {
    return req.body;
  }
  if (typeof req.body === "string") {
    try {
      return JSON.parse(req.body);
    } catch {
      return {};
    }
  }
  if (!req[Symbol.asyncIterator]) return {};

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

async function readWebBody(request) {
  const raw = await request.text().catch(() => "");
  if (!raw) return {};
  try {
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

function resolveApiPath(url) {
  const rewrittenPath = url.searchParams.get("path");
  const isApiEntrypoint =
    url.pathname === "/api" || url.pathname === "/api/" || url.pathname === "/api/handler";
  if (isApiEntrypoint && rewrittenPath) {
    const normalized = rewrittenPath.startsWith("/") ? rewrittenPath : `/${rewrittenPath}`;
    return `/api${normalized}`;
  }
  return url.pathname;
}

async function routeApiRequest({ method, rawUrl, readBody }) {
  const url = new URL(rawUrl || "/", "http://localhost");
  const pathname = resolveApiPath(url);

  if (pathname === "/api/status" && method === "GET") {
    return { status: 200, body: await getAppStatus() };
  }

  if (pathname === "/api/config" && method === "GET") {
    return { status: 200, body: loadAgentConfig() };
  }

  if (pathname === "/api/runs" && method === "GET") {
    return { status: 200, body: { runs: listRuns() } };
  }

  const runMatch = pathname.match(/^\/api\/runs\/([^/]+)$/);
  if (runMatch && method === "GET") {
    const run = getRun(runMatch[1]);
    if (!run) return { status: 404, body: { error: "Run not found" } };
    return { status: 200, body: { run } };
  }

  if (pathname === "/api/run" && method === "POST") {
    const body = await readBody();
    const config = loadAgentConfig();
    const task = (body.task || "").trim() || config.task;
    const result = await runAgent({ task });
    return { status: 200, body: result };
  }

  if (pathname === "/api/deploy" && method === "POST") {
    const deployed = await deployAgentRunReceipts({
      rpcUrl: readEnv("CELO_RPC_URL", "https://forno.celo-sepolia.celo-testnet.org"),
      privateKey: readEnv("CELO_PRIVATE_KEY"),
      contractAddress: readEnv("CELO_RECEIPTS_CONTRACT"),
    });
    if (!deployed.skipped) {
      try { writeEnv({ CELO_RECEIPTS_CONTRACT: deployed.address }); } catch {}
    }
    return { status: 200, body: deployed };
  }

  return { status: 404, body: { error: "Unknown route" } };
}

export default async function handler(req, res) {
  const isNodeResponse = res && typeof res.writeHead === "function";

  try {
    const result = await routeApiRequest({
      method: req.method || "GET",
      rawUrl: req.url,
      readBody: () => (isNodeResponse ? readNodeBody(req) : readWebBody(req)),
    });
    if (isNodeResponse) return sendNodeJson(res, result.status, result.body);
    return sendWebJson(result.status, result.body);
  } catch (err) {
    console.error("Handler error:", err);
    const body = { error: err.message || "Internal error" };
    if (isNodeResponse) return sendNodeJson(res, 500, body);
    return sendWebJson(500, body);
  }
}

export const GET = (request) =>
  routeApiRequest({
    method: "GET",
    rawUrl: request.url,
    readBody: () => readWebBody(request),
  })
    .then((result) => sendWebJson(result.status, result.body))
    .catch((err) => {
      console.error("Handler error:", err);
      return sendWebJson(500, { error: err.message || "Internal error" });
    });

export const POST = (request) =>
  routeApiRequest({
    method: "POST",
    rawUrl: request.url,
    readBody: () => readWebBody(request),
  })
    .then((result) => sendWebJson(result.status, result.body))
    .catch((err) => {
      console.error("Handler error:", err);
      return sendWebJson(500, { error: err.message || "Internal error" });
    });
