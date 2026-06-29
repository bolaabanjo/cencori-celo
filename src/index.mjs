import { runAgent } from "./run-agent.mjs";
import { loadAgentConfig } from "./agent-config.mjs";

const config = loadAgentConfig();
const task = process.argv.slice(2).join(" ").trim() || config.task;
const result = await runAgent({ task });

console.log("");
console.log("Cencori Agent Run");
console.log("----------------");
console.log(`Run: ${result.externalRunId}`);
console.log(`Cencori request: ${result.requestId}`);
console.log(`Tier: ${result.tier}`);
console.log(`Receipt hash: ${result.receiptHash}`);
console.log(`Receipt file: ${result.receiptPath}`);
console.log("");
console.log("Agent output preview:");
console.log(result.content.slice(0, 1200));
console.log("");
