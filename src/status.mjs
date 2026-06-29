import { loadEnv, readEnv } from "./env.mjs";
import { loadAgentConfig } from "./agent-config.mjs";

export async function getAppStatus() {
  loadEnv();

  const apiKey = readEnv("CENCORI_API_KEY");
  const cencoriReady = Boolean(apiKey && apiKey !== "csk_...");
  const config = loadAgentConfig();

  return {
    cencori: {
      ready: cencoriReady,
      model: readEnv("CENCORI_MODEL", "llama-3.3-70b-versatile"),
      agentId: readEnv("CENCORI_AGENT_ID") || null,
    },
    pricing: config.pricing || {},
    subscription: {
      monthlyPriceUsd: config.subscription?.monthlyPriceUsd || 5,
      paymentToken: config.subscription?.paymentToken || "cUSD",
      contractAddress: config.subscription?.contractAddress || null,
    },
  };
}
