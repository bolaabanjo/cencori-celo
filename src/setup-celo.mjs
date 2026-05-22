import { loadEnv, readEnv, writeEnv } from "./env.mjs";

loadEnv();

export async function ensureCeloWallet() {
  const existing = readEnv("CELO_PRIVATE_KEY");
  if (existing && existing !== "0x...") {
    const [{ privateKeyToAccount }, { createPublicClient, http }, { celoSepolia }] =
      await Promise.all([
        import("viem/accounts"),
        import("viem"),
        import("viem/chains"),
      ]);
    const account = privateKeyToAccount(
      existing.startsWith("0x") ? existing : `0x${existing}`
    );
    const rpcUrl = readEnv("CELO_RPC_URL", "https://forno.celo-sepolia.celo-testnet.org");
    const publicClient = createPublicClient({
      chain: celoSepolia,
      transport: http(rpcUrl),
    });
    const balance = await publicClient.getBalance({ address: account.address });
    return { address: account.address, balance, created: false };
  }

  const { generatePrivateKey, privateKeyToAccount } = await import("viem/accounts");
  const privateKey = generatePrivateKey();
  const account = privateKeyToAccount(privateKey);
  writeEnv({ CELO_PRIVATE_KEY: privateKey });

  return { address: account.address, balance: 0n, created: true };
}

async function main() {
  const wallet = await ensureCeloWallet();
  const explorer = readEnv("CELO_EXPLORER_URL", "https://celo-sepolia.blockscout.com");

  console.log("");
  console.log("Celo Sepolia wallet");
  console.log("-------------------");
  console.log(`Address: ${wallet.address}`);
  console.log(`Balance: ${wallet.balance} wei`);
  if (wallet.created) {
    console.log("Generated CELO_PRIVATE_KEY and saved to .env");
  }

  if (wallet.balance === 0n) {
    console.log("");
    console.log("Fund this wallet with test CELO:");
    console.log(`  https://faucet.celo.org/celo-sepolia`);
    console.log(`  https://cloud.google.com/application/web3/faucet/celo/sepolia`);
    console.log("");
    console.log("Then run: npm run deploy && npm run demo");
    process.exit(1);
  }

  console.log(`Explorer: ${explorer.replace(/\/+$/, "")}/address/${wallet.address}`);
}

import path from "node:path";
import { pathToFileURL } from "node:url";

const isMain =
  process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;

if (isMain) {
  main().catch((err) => {
    console.error(err.message || err);
    process.exit(1);
  });
}
