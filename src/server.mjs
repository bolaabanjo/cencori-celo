import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { readEnv } from "./env.mjs";
import apiHandler from "../api/index.mjs";

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
  const content = fs.readFileSync(filePath);
  res.writeHead(200, { "Content-Type": MIME[ext] || "application/octet-stream" });
  res.end(content);
}

const server = http.createServer((req, res) => {
  const urlPath = req.url?.split("?")[0] || "/";
  if (urlPath.startsWith("/api/")) {
    return apiHandler(req, res);
  }
  return serveStatic(req, res);
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
