import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { readEnv } from "./env.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "..");

const BUILTIN_DEFAULT = {
  name: "Cencori project agent",
  task: "Describe what this integration records offchain and onchain in three short bullets.",
  systemPrompt:
    "You are a concise production agent. Respond with clear structure and practical detail.",
};

export function loadAgentConfig() {
  const configPath = readEnv("AGENT_CONFIG_PATH") || path.join(rootDir, "agent.config.json");
  let fileConfig = {};

  if (fs.existsSync(configPath)) {
    try {
      fileConfig = JSON.parse(fs.readFileSync(configPath, "utf8"));
    } catch (err) {
      throw new Error(`Invalid agent config at ${configPath}: ${err.message}`);
    }
  }

  const name = readEnv("AGENT_NAME") || fileConfig.name || BUILTIN_DEFAULT.name;
  const task = readEnv("AGENT_TASK") || fileConfig.task || BUILTIN_DEFAULT.task;
  const systemPrompt =
    readEnv("AGENT_SYSTEM_PROMPT") || fileConfig.systemPrompt || BUILTIN_DEFAULT.systemPrompt;

  return { name, task, systemPrompt, configPath: fs.existsSync(configPath) ? configPath : null };
}
