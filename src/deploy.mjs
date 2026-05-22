import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadEnv, readEnv, writeEnv } from "./env.mjs";

loadEnv();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "..");
const bytecodePath = path.join(
  rootDir,
  "build/contracts_AgentRunReceipts_sol_AgentRunReceipts.bin"
);
const abiPath = path.join(
  rootDir,
  "build/contracts_AgentRunReceipts_sol_AgentRunReceipts.abi"
);

async function getBalance(publicClient, address) {
  return publicClient.getBalance({ address });
}

export async function deployAgentRunReceipts({
  rpcUrl,
  privateKey,
  contractAddress,
}) {
  if (contractAddress && contractAddress !== "0x...") {
    return { skipped: true, address: contractAddress };
  }

  if (!privateKey) {
    throw new Error("CELO_PRIVATE_KEY is required to deploy AgentRunReceipts.");
  }

  if (!fs.existsSync(bytecodePath)) {
    const { execSync } = await import("node:child_process");
    execSync(
      "npx --yes solc@0.8.23 -o build --bin --abi contracts/AgentRunReceipts.sol",
      { cwd: rootDir, stdio: "inherit" }
    );
  }

  const bytecode = `0x${fs.readFileSync(bytecodePath, "utf8").trim()}`;
  const abi = JSON.parse(fs.readFileSync(abiPath, "utf8"));

  const [
    { createPublicClient, createWalletClient, http },
    { privateKeyToAccount },
    { celoSepolia },
  ] = await Promise.all([
    import("viem"),
    import("viem/accounts"),
    import("viem/chains"),
  ]);

  const account = privateKeyToAccount(
    privateKey.startsWith("0x") ? privateKey : `0x${privateKey}`
  );
  const transport = http(rpcUrl);

  const publicClient = createPublicClient({ chain: celoSepolia, transport });
  const walletClient = createWalletClient({
    account,
    chain: celoSepolia,
    transport,
  });

  const balance = await getBalance(publicClient, account.address);
  if (balance === 0n) {
    throw new Error(
      `Deploy wallet ${account.address} has 0 CELO. Fund it at https://faucet.celo.org/celo-sepolia then rerun npm run deploy.`
    );
  }

  const hash = await walletClient.deployContract({
    abi,
    bytecode,
    args: [],
  });

  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  const address = receipt.contractAddress;
  if (!address) {
    throw new Error("Deploy transaction succeeded but contractAddress is missing.");
  }

  return { skipped: false, address, txHash: hash, deployer: account.address };
}

async function main() {
  const rpcUrl = readEnv("CELO_RPC_URL", "https://forno.celo-sepolia.celo-testnet.org");
  const privateKey = readEnv("CELO_PRIVATE_KEY");
  const existing = readEnv("CELO_RECEIPTS_CONTRACT");

  console.log("Deploying AgentRunReceipts to Celo Sepolia...");

  const result = await deployAgentRunReceipts({
    rpcUrl,
    privateKey,
    contractAddress: existing,
  });

  if (result.skipped) {
    console.log(`Contract already set: ${result.address}`);
    return;
  }

  writeEnv({ CELO_RECEIPTS_CONTRACT: result.address });
  const explorer = readEnv("CELO_EXPLORER_URL", "https://celo-sepolia.blockscout.com").replace(
    /\/+$/,
    ""
  );

  console.log(`Deployed: ${result.address}`);
  console.log(`Deployer: ${result.deployer}`);
  console.log(`Tx: ${explorer}/tx/${result.txHash}`);
}

import { pathToFileURL } from "node:url";

const isMain =
  process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;

if (isMain) {
  main().catch((err) => {
    console.error(err.message || err);
    process.exit(1);
  });
}
