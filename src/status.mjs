import { loadEnv, readEnv } from "./env.mjs";
import { ensureCeloWallet } from "./setup-celo.mjs";

export async function getAppStatus() {
  loadEnv();

  const apiKey = readEnv("CENCORI_API_KEY");
  const cencoriReady = Boolean(apiKey && apiKey !== "csk_...");

  let wallet = null;
  try {
    const w = await ensureCeloWallet();
    wallet = {
      address: w.address,
      balanceWei: w.balance.toString(),
      funded: w.balance > 0n,
      created: w.created,
    };
  } catch (err) {
    wallet = {
      error: err.message?.includes("fetch failed")
        ? `Cannot reach Celo RPC at ${readEnv("CELO_RPC_URL")}. Check CELO_RPC_URL or network.`
        : err.message,
    };
  }

  const contract = readEnv("CELO_RECEIPTS_CONTRACT");
  const explorer = readEnv("CELO_EXPLORER_URL", "https://celo-sepolia.blockscout.com");

  return {
    cencori: {
      ready: cencoriReady,
      model: readEnv("CENCORI_MODEL", "llama-3.3-70b-versatile"),
      agentId: readEnv("CENCORI_AGENT_ID") || null,
    },
    celo: {
      network: "celo-sepolia",
      chainId: 11142220,
      wallet,
      contract: contract && contract !== "0x..." ? contract : null,
      explorer,
      faucetUrl: "https://faucet.celo.org/celo-sepolia",
    },
    payment: {
      token: readEnv("DEMO_PAYMENT_TOKEN", "USDC"),
      amount: readEnv("DEMO_PAYMENT_AMOUNT", "0.05"),
      maxSpendUsd: readEnv("DEMO_MAX_SPEND_USD", "0.10"),
      note: "Payment fields are receipt metadata only in this starter.",
    },
  };
}
