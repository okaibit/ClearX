import fs from "node:fs";
import path from "node:path";
import {
  createPublicClient,
  createWalletClient,
  http,
  parseUnits,
  zeroAddress,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";

const root = process.cwd();

const envText = fs.readFileSync(
  path.join(root, ".env.local"),
  "utf8"
);

for (const line of envText.split(/\r?\n/)) {
  const trimmed = line.trim();

  if (
    !trimmed ||
    trimmed.startsWith("#") ||
    !trimmed.includes("=")
  ) {
    continue;
  }

  const index = trimmed.indexOf("=");

  const key = trimmed.slice(0, index);
  const value = trimmed.slice(index + 1);

  if (!(key in process.env)) {
    process.env[key] = value;
  }
}

const rpcUrl = process.env.X_LAYER_TESTNET_RPC_URL;
const privateKey = process.env.CLEARX_EXECUTOR_PRIVATE_KEY;

if (!rpcUrl) {
  throw new Error("X_LAYER_TESTNET_RPC_URL is missing.");
}

if (!privateKey) {
  throw new Error("CLEARX_EXECUTOR_PRIVATE_KEY is missing.");
}

const deployment = JSON.parse(
  fs.readFileSync(
    path.join(root, "deployments", "xlayer-testnet.json"),
    "utf8"
  )
);

const loadArtifact = (name) =>
  JSON.parse(
    fs.readFileSync(
      path.join(root, "artifacts", `${name}.json`),
      "utf8"
    )
  );

const usdc = loadArtifact("TestUSDC");
const commerce = loadArtifact("AgenticCommerce");
const evaluator = loadArtifact("ClearXEvaluator");

const account = privateKeyToAccount(
  privateKey.startsWith("0x")
    ? privateKey
    : `0x${privateKey}`
);

const providerPrivateKey = process.env.CLEARX_PROVIDER_PRIVATE_KEY;

if (!providerPrivateKey) {
  throw new Error("CLEARX_PROVIDER_PRIVATE_KEY is missing.");
}

if (!/^0x[0-9a-fA-F]{64}$/.test(providerPrivateKey)) {
  throw new Error("CLEARX_PROVIDER_PRIVATE_KEY must be a 32-byte hex private key.");
}

const providerAccount = privateKeyToAccount(providerPrivateKey);

const approver2PrivateKey = process.env.CLEARX_APPROVER2_PRIVATE_KEY;

if (!approver2PrivateKey) {
  throw new Error("CLEARX_APPROVER2_PRIVATE_KEY is missing.");
}

if (!/^0x[0-9a-fA-F]{64}$/.test(approver2PrivateKey)) {
  throw new Error(
    "CLEARX_APPROVER2_PRIVATE_KEY must be a 32-byte hex private key."
  );
}

const approver2Account = privateKeyToAccount(approver2PrivateKey);

const publicClient = createPublicClient({
  transport: http(rpcUrl),
});

const walletClient = createWalletClient({
  account,
  transport: http(rpcUrl),
});

const providerWalletClient = createWalletClient({
  account: providerAccount,
  transport: http(rpcUrl),
});

const approver2WalletClient = createWalletClient({
  account: approver2Account,
  transport: http(rpcUrl),
});

const USDC = deployment.contracts.TestUSDC.address;
const COMMERCE = deployment.contracts.AgenticCommerce.address;
const EVALUATOR = deployment.contracts.ClearXEvaluator.address;

const amount = parseUnits("1", 6);

async function send(label, request) {
  console.log(`\n${label}...`);

  const hash = await walletClient.writeContract(request);

  console.log(`tx: ${hash}`);

  const receipt =
    await publicClient.waitForTransactionReceipt({
      hash,
    });

  console.log(`status: ${receipt.status}`);
  console.log(`block: ${receipt.blockNumber}`);

  if (receipt.status !== "success") {
    throw new Error(`${label} transaction failed.`);
  }

  return hash;
}

console.log("=================================");
console.log("CLEARX REAL SETTLEMENT TEST");
console.log("=================================");
console.log("Client:", account.address);
console.log("Provider:", providerAccount.address);
console.log("Approver #1:", account.address);
console.log("Approver #2:", approver2Account.address);
console.log(
  "Client/provider roles separated:",
  account.address.toLowerCase() !== providerAccount.address.toLowerCase()
);
console.log("Chain:", await publicClient.getChainId());
console.log("TestUSDC:", USDC);
console.log("AgenticCommerce:", COMMERCE);
console.log("ClearXEvaluator:", EVALUATOR);

const tokenBalanceBefore =
  await publicClient.readContract({
    address: USDC,
    abi: usdc.abi,
    functionName: "balanceOf",
    args: [account.address],
  });

const providerBalanceBefore =
  await publicClient.readContract({
    address: USDC,
    abi: usdc.abi,
    functionName: "balanceOf",
    args: [providerAccount.address],
  });

console.log(
  "Client cUSDC balance:",
  tokenBalanceBefore.toString()
);

console.log(
  "Provider cUSDC balance:",
  providerBalanceBefore.toString()
);

if (tokenBalanceBefore < amount) {
  throw new Error(
    `Insufficient TestUSDC. Need at least ${amount.toString()} base units.`
  );
}

// 1. Create job
const expiry =
  BigInt(Math.floor(Date.now() / 1000) + 3600);

const createHash = await send(
  "1/8 Creating job",
  {
    address: COMMERCE,
    abi: commerce.abi,
    functionName: "createJob",
    args: [
      providerAccount.address,
      EVALUATOR,
      expiry,
      "ClearX agentic commerce settlement test",
      zeroAddress,
    ],
  }
);

const jobCreatedEvent = commerce.abi.find(
  (item) =>
    item.type === "event" &&
    item.name === "JobCreated"
);

if (!jobCreatedEvent) {
  throw new Error(
    "AgenticCommerce ABI does not contain the JobCreated event."
  );
}

const createReceipt =
  await publicClient.getTransactionReceipt({
    hash: createHash,
  });

const jobCreatedLog = createReceipt.logs.find(
  (log) =>
    log.address.toLowerCase() === COMMERCE.toLowerCase() &&
    log.topics[0] ===
      "0xb0f0239bfdd96453e24733e18bfc24b70d8fadf123dd977473518dd577ee79b9"
);

if (!jobCreatedLog || !jobCreatedLog.topics[1]) {
  throw new Error(
    "Could not extract the AgenticCommerce JobCreated event from the transaction receipt."
  );
}

const actualJobId = BigInt(jobCreatedLog.topics[1]);

console.log("Job ID:", actualJobId.toString());

console.log("Job ID:", actualJobId.toString());

// 2. Set budget
await send(
  "2/8 Setting 1 cUSDC budget",
  {
    address: COMMERCE,
    abi: commerce.abi,
    functionName: "setBudget",
    args: [actualJobId, amount, "0x"],
  }
);

// 3. Approve commerce contract to spend TestUSDC
await send(
  "3/8 Approving TestUSDC",
  {
    address: USDC,
    abi: usdc.abi,
    functionName: "approve",
    args: [COMMERCE, amount],
  }
);

// 4. Fund job
await send(
  "4/8 Funding job",
  {
    address: COMMERCE,
    abi: commerce.abi,
    functionName: "fund",
    args: [actualJobId, "0x"],
  }
);

// 5. Submit deliverable
const deliverable =
  "0x1111111111111111111111111111111111111111111111111111111111111111";

console.log("\\n5/7 Submitting deliverable as provider...");

const submitHash = await providerWalletClient.writeContract({
  address: COMMERCE,
  abi: commerce.abi,
  functionName: "submit",
  args: [actualJobId, deliverable, "0x"],
});

console.log(`tx: ${submitHash}`);

const submitReceipt =
  await publicClient.waitForTransactionReceipt({
    hash: submitHash,
  });

console.log(`status: ${submitReceipt.status}`);
console.log(`block: ${submitReceipt.blockNumber}`);

if (submitReceipt.status !== "success") {
  throw new Error("Provider submit transaction failed.");
}

// 6. ClearX evaluator: approver #1 votes

const evidenceHash =
  "0x2222222222222222222222222222222222222222222222222222222222222222";

await send(
  "6/8 ClearX evaluator: approver #1 voting (1 of 2)",
  {
    address: EVALUATOR,
    abi: evaluator.abi,
    functionName: "approve",
    args: [actualJobId, evidenceHash],
  }
);

// Verify that approver #1's vote was recorded and one vote
// is NOT enough to execute settlement.
const approver1Voted = await publicClient.readContract({
  address: EVALUATOR,
  abi: evaluator.abi,
  functionName: "hasVoted",
  args: [actualJobId, account.address],
});

const afterFirstVote = await publicClient.readContract({
  address: EVALUATOR,
  abi: evaluator.abi,
  functionName: "voteCounts",
  args: [actualJobId],
});

console.log(
  "After approver #1:",
  "hasVoted=",
  approver1Voted,
  "approveCount=",
  afterFirstVote[0].toString(),
  "rejectCount=",
  afterFirstVote[1].toString(),
  "executed=",
  afterFirstVote[2]
);

if (!approver1Voted) {
  throw new Error(
    "Approver #1 vote was not recorded on-chain."
  );
}

if (afterFirstVote[0] !== 1n) {
  throw new Error(
    `Expected 1 approval after approver #1, received ${afterFirstVote[0].toString()}.`
  );
}

if (afterFirstVote[2] !== false) {
  throw new Error(
    "Settlement executed after only one approval."
  );
}

// 7. ClearX evaluator: approver #2 votes and reaches threshold

console.log("\n7/8 ClearX evaluator: approver #2 voting (2 of 2)...");

const approval2Hash = await approver2WalletClient.writeContract({
  address: EVALUATOR,
  abi: evaluator.abi,
  functionName: "approve",
  args: [actualJobId, evidenceHash],
});

console.log(`tx: ${approval2Hash}`);

const approval2Receipt =
  await publicClient.waitForTransactionReceipt({
    hash: approval2Hash,
  });

console.log(`status: ${approval2Receipt.status}`);
console.log(`block: ${approval2Receipt.blockNumber}`);

if (approval2Receipt.status !== "success") {
  throw new Error("Approver #2 transaction failed.");
}

// 7. Verify final state
const job =
  await publicClient.readContract({
    address: COMMERCE,
    abi: commerce.abi,
    functionName: "jobs",
    args: [actualJobId],
  });

const tokenBalanceAfter =
  await publicClient.readContract({
    address: USDC,
    abi: usdc.abi,
    functionName: "balanceOf",
    args: [account.address],
  });

const providerBalanceAfter =
  await publicClient.readContract({
    address: USDC,
    abi: usdc.abi,
    functionName: "balanceOf",
    args: [providerAccount.address],
  });

console.log("\n=================================");
console.log("SETTLEMENT TEST COMPLETE");
console.log("=================================");

console.log("Job ID:", actualJobId.toString());
console.log("Final job:", job);

const finalStatus = job[7];
const finalBudget = job[5];

if (finalStatus !== 3) {
  throw new Error(
    `Settlement verification failed: expected Completed status 3, received ${finalStatus}.`
  );
}

if (finalBudget !== amount) {
  throw new Error(
    `Settlement verification failed: expected budget ${amount.toString()}, received ${finalBudget.toString()}.`
  );
}

const providerGain =
  providerBalanceAfter - providerBalanceBefore;

if (providerGain !== amount) {
  throw new Error(
    `Payment verification failed: expected provider gain ${amount.toString()}, received ${providerGain.toString()}.`
  );
}

console.log("Final status: Completed (3)");
console.log("Verified budget:", finalBudget.toString());
console.log("Provider gain:", providerGain.toString());
console.log("PAYMENT RELEASE VERIFIED: client -> escrow -> provider");
console.log(
  "USDC balance before:",
  tokenBalanceBefore.toString()
);
console.log(
  "Client cUSDC balance after:",
  tokenBalanceAfter.toString()
);

console.log(
  "Provider cUSDC balance before:",
  providerBalanceBefore.toString()
);

console.log(
  "Provider cUSDC balance after:",
  providerBalanceAfter.toString()
);

console.log("\nTransaction evidence:");
console.log("Create:", createHash);
console.log("Fund / Approve / Submit / Approver #1 / Approver #2 / Complete: see transactions above");

console.log("\nCLEARX ON-CHAIN SETTLEMENT VERIFIED.");
