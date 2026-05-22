import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadEnv, readEnv } from "./env.mjs";
import { ensureCeloWallet } from "./setup-celo.mjs";
import { deployAgentRunReceipts } from "./deploy.mjs";

loadEnv();

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

async function main() {
  console.log("Cencori × Celo — ship\n");

  let wallet = await ensureCeloWallet();
  console.log(`Wallet: ${wallet.address} (${wallet.balance} wei)`);

  if (wallet.created && wallet.balance === 0n) {
    console.log("\nNew wallet saved to .env — fund it, then rerun: npm run ship");
    console.log("  https://faucet.celo.org/celo-sepolia\n");
  }

  if (wallet.balance === 0n) {
    console.log("\nWallet needs test CELO before onchain deploy.");
    console.log("Fund at https://faucet.celo.org/celo-sepolia then run: npm run ship");
    console.log("\nRunning agent demo without onchain recording...\n");
    const { execSync } = await import("node:child_process");
    execSync("node src/index.mjs", { stdio: "inherit", cwd: rootDir });
    process.exit(0);
  }

  const deployed = await deployAgentRunReceipts({
    rpcUrl: readEnv("CELO_RPC_URL", "https://forno.celo-sepolia.celo-testnet.org"),
    privateKey: readEnv("CELO_PRIVATE_KEY"),
    contractAddress: readEnv("CELO_RECEIPTS_CONTRACT"),
  });

  if (!deployed.skipped) {
    const { writeEnv } = await import("./env.mjs");
    writeEnv({ CELO_RECEIPTS_CONTRACT: deployed.address });
    console.log(`Contract deployed: ${deployed.address}`);
  }

  const { execSync } = await import("node:child_process");
  execSync("node src/index.mjs", { stdio: "inherit", cwd: rootDir });
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
