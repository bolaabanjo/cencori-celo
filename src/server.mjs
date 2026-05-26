import http from "node:http";
import { readEnv } from "./env.mjs";
import handler from "../api/index.mjs";

const port = Number(readEnv("WEB_PORT", "3333"));

const server = http.createServer(handler);

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
