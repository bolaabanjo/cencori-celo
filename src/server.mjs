import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadEnv, readEnv } from "./env.mjs";
import { getAppStatus } from "./status.mjs";
import { loadAgentConfig } from "./agent-config.mjs";
import { getRun, listRuns, runAgent } from "./run-agent.mjs";
import { deployAgentRunReceipts } from "./deploy.mjs";
import { writeEnv } from "./env.mjs";

loadEnv();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const publicDir = path.resolve(__dirname, "../public");
const port = Number(readEnv("WEB_PORT", "3333"));

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
};

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

function serveStatic(req, res) {
  let urlPath = req.url?.split("?")[0] || "/";
  if (urlPath === "/") urlPath = "/index.html";
  const filePath = path.join(publicDir, path.normalize(urlPath).replace(/^(\.\.(\/|\\|$))+/, ""));
  if (!filePath.startsWith(publicDir)) {
    res.writeHead(403);
    res.end("Forbidden");
    return;
  }
  if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
    res.writeHead(404);
    res.end("Not found");
    return;
  }
  const ext = path.extname(filePath);
  res.writeHead(200, { "Content-Type": MIME[ext] || "application/octet-stream" });
  fs.createReadStream(filePath).pipe(res);
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url || "/", `http://localhost:${port}`);
  const { pathname } = url;

  try {
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

    if (pathname.startsWith("/api/")) {
      return json(res, 404, { error: "Unknown API route" });
    }

    return serveStatic(req, res);
  } catch (err) {
    const msg = err.message || "Server error";
    console.error(`[${pathname}] ${msg}`);
    return json(res, 500, { error: msg });
  }
});

server.on("error", (err) => {
  if (err.code === "EADDRINUSE") {
    console.error(
      `Port ${port} is already in use. Stop the other process or set WEB_PORT:\n` +
        `  lsof -ti :${port} | xargs kill -9\n` +
        `  WEB_PORT=3334 npm run dev`
    );
    process.exit(1);
  }
  throw err;
});

server.listen(port, () => {
  console.log(`Cencori x Celo UI → http://localhost:${port}`);
});
