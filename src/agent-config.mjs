import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { readEnv } from "./env.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "..");

const BUILTIN_DEFAULT = {
  name: "General purpose AI agent",
  task: "You are a helpful assistant. Respond to the user's request clearly and concisely.",
  systemPrompt:
    "You are a helpful, concise AI assistant. Provide clear, practical answers. Avoid hype and marketing language.",
  pricing: {
    free: { model: "llama-3.3-70b-versatile", label: "Standard" },
    pro: { model: "claude-sonnet-4-20250514", label: "Pro" },
  },
  subscription: {
    monthlyPriceUsd: 5,
    paymentToken: "cUSD",
    contractAddress: "",
  },
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
  const pricing = fileConfig.pricing || BUILTIN_DEFAULT.pricing;
  const subscription = fileConfig.subscription || BUILTIN_DEFAULT.subscription;

  return { name, task, systemPrompt, pricing, subscription, configPath: fs.existsSync(configPath) ? configPath : null };
}
