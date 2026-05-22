const receiptsAbiSource = [
  "function recordRun(bytes32 receiptHash,string externalRunId,string receiptURI)",
];

export async function recordReceiptOnCelo({
  rpcUrl,
  privateKey,
  contractAddress,
  receiptHash,
  externalRunId,
  receiptURI,
}) {
  if (!privateKey || privateKey === "0x...") {
    return {
      simulated: true,
      txHash: null,
      message:
        "Missing CELO_PRIVATE_KEY. Run npm run setup:celo, fund the wallet, then npm run deploy.",
    };
  }

  if (!contractAddress || contractAddress === "0x...") {
    return {
      simulated: true,
      txHash: null,
      message:
        "Missing CELO_RECEIPTS_CONTRACT. Fund wallet, run npm run deploy, then npm run demo.",
    };
  }

  const [{ createPublicClient, createWalletClient, http, parseAbi }, { privateKeyToAccount }, { celoSepolia }] =
    await Promise.all([
      import("viem"),
      import("viem/accounts"),
      import("viem/chains"),
    ]);

  const account = privateKeyToAccount(privateKey.startsWith("0x") ? privateKey : `0x${privateKey}`);
  const transport = http(rpcUrl);
  const abi = parseAbi(receiptsAbiSource);

  const publicClient = createPublicClient({
    chain: celoSepolia,
    transport,
  });

  const walletClient = createWalletClient({
    account,
    chain: celoSepolia,
    transport,
  });

  const txHash = await walletClient.writeContract({
    address: contractAddress,
    abi,
    functionName: "recordRun",
    args: [receiptHash, externalRunId, receiptURI],
  });

  await publicClient.waitForTransactionReceipt({ hash: txHash });

  return {
    simulated: false,
    txHash,
    recorder: account.address,
  };
}
