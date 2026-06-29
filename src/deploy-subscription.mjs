import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadEnv, readEnv, writeEnv } from "./env.mjs";

loadEnv();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "..");

async function main() {
  const rpcUrl = readEnv("CELO_RPC_URL", "https://forno.celo-sepolia.celo-testnet.org");
  const privateKey = readEnv("CELO_PRIVATE_KEY");
  const explorer = readEnv("CELO_EXPLORER_URL", "https://celo-sepolia.blockscout.com");

  if (!privateKey) {
    console.error("CELO_PRIVATE_KEY is required");
    process.exit(1);
  }

  const bytecodePath = path.join(rootDir, "build/contracts_SubscriptionManager_sol_SubscriptionManager.bin");
  const abiPath = path.join(rootDir, "build/contracts_SubscriptionManager_sol_SubscriptionManager.abi");

  if (!fs.existsSync(bytecodePath)) {
    const { execSync } = await import("node:child_process");
    execSync("npx --yes solc@0.8.23 -o build --bin --abi contracts/SubscriptionManager.sol", {
      cwd: rootDir,
      stdio: "inherit",
    });
  }

  const bytecode = `0x${fs.readFileSync(bytecodePath, "utf8").trim()}`;
  const abi = JSON.parse(fs.readFileSync(abiPath, "utf8"));

  const [{ createPublicClient, createWalletClient, http }, { privateKeyToAccount }, { celoSepolia }] =
    await Promise.all([import("viem"), import("viem/accounts"), import("viem/chains")]);

  const account = privateKeyToAccount(privateKey.startsWith("0x") ? privateKey : `0x${privateKey}`);
  const transport = http(rpcUrl);

  const publicClient = createPublicClient({ chain: celoSepolia, transport });
  const walletClient = createWalletClient({ account, chain: celoSepolia, transport });

  const balance = await publicClient.getBalance({ address: account.address });
  if (balance === 0n) {
    console.error(`Deploy wallet ${account.address} has 0 CELO. Fund it at https://faucet.celo.org/celo-sepolia`);
    process.exit(1);
  }

  const cusdAddress = readEnv("CUSD_TOKEN_ADDRESS", "0x874069Fa1Eb16D44d622F2e0Ca25eeA172369bC1");

  const hash = await walletClient.deployContract({
    abi,
    bytecode,
    args: [cusdAddress],
  });

  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  const address = receipt.contractAddress;

  if (!address) {
    throw new Error("Deploy succeeded but contractAddress is missing.");
  }

  writeEnv({ SUBSCRIPTION_CONTRACT_ADDRESS: address });

  console.log(`SubscriptionManager deployed: ${address}`);
  console.log(`Payment token (cUSD): ${cusdAddress}`);
  console.log(`Tx: ${explorer.replace(/\/+$/, "")}/tx/${hash}`);

  const configPath = path.join(rootDir, "agent.config.json");
  const config = JSON.parse(fs.readFileSync(configPath, "utf8"));
  config.subscription = config.subscription || {};
  config.subscription.contractAddress = address;
  config.subscription.paymentToken = "cUSD";
  fs.writeFileSync(configPath, `${JSON.stringify(config, null, 2)}\n`);

  console.log("Updated agent.config.json with contract address.");
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
