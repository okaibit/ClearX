import fs from "node:fs";
import path from "node:path";
import { createPublicClient, http, formatUnits } from "viem";

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
  const key = trimmed.slice(0, index).trim();
  const value = trimmed.slice(index + 1).trim();

  process.env[key] = value;
}

const rpcUrl = process.env.X_LAYER_TESTNET_RPC_URL;

if (!rpcUrl) {
  throw new Error("X_LAYER_TESTNET_RPC_URL is missing.");
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

const client = createPublicClient({
  transport: http(rpcUrl),
});

const USDC = deployment.contracts.TestUSDC.address;
const COMMERCE = deployment.contracts.AgenticCommerce.address;
const EVALUATOR = deployment.contracts.ClearXEvaluator.address;

const JOB_ID = 4n;

const expectedClient =
  "0xD6aa751524A94161eAdfF44047266Fa8586F7A77";

const expectedProvider =
  "0xd65Bb2dC678d9f192B5f69Ded613c22C5eF6A6B3";

const expectedApprover1 =
  "0xD6aa751524A94161eAdfF44047266Fa8586F7A77";

const expectedApprover2 =
  "0xC067Fa683514881B4E5F468fE87920A441e88687";

const expectedBudget = 1_000_000n;

const job = await client.readContract({
  address: COMMERCE,
  abi: commerce.abi,
  functionName: "jobs",
  args: [JOB_ID],
});

const threshold = await client.readContract({
  address: EVALUATOR,
  abi: evaluator.abi,
  functionName: "threshold",
});

const approverCount = await client.readContract({
  address: EVALUATOR,
  abi: evaluator.abi,
  functionName: "approverCount",
});

const approver1 = await client.readContract({
  address: EVALUATOR,
  abi: evaluator.abi,
  functionName: "approvers",
  args: [0n],
});

const approver2 = await client.readContract({
  address: EVALUATOR,
  abi: evaluator.abi,
  functionName: "approvers",
  args: [1n],
});

const approver1Voted = await client.readContract({
  address: EVALUATOR,
  abi: evaluator.abi,
  functionName: "hasVoted",
  args: [JOB_ID, expectedApprover1],
});

const approver2Voted = await client.readContract({
  address: EVALUATOR,
  abi: evaluator.abi,
  functionName: "hasVoted",
  args: [JOB_ID, expectedApprover2],
});

const voteCounts = await client.readContract({
  address: EVALUATOR,
  abi: evaluator.abi,
  functionName: "voteCounts",
  args: [JOB_ID],
});

const clientBalance = await client.readContract({
  address: USDC,
  abi: usdc.abi,
  functionName: "balanceOf",
  args: [expectedClient],
});

const providerBalance = await client.readContract({
  address: USDC,
  abi: usdc.abi,
  functionName: "balanceOf",
  args: [expectedProvider],
});

const code = await client.getCode({
  address: EVALUATOR,
});

const checks = [
  ["Chain ID is 1952", (await client.getChainId()) === 1952],
  [
    "TestUSDC contract deployed",
    Boolean(USDC),
  ],
  [
    "AgenticCommerce contract deployed",
    Boolean(COMMERCE),
  ],
  [
    "ClearXEvaluator contract deployed",
    Boolean(EVALUATOR),
  ],
  [
    "Evaluator threshold is 2",
    threshold === 2n,
  ],
  [
    "Exactly 2 approvers registered",
    approverCount === 2n,
  ],
  [
    "Approver #1 matches deployment",
    approver1.toLowerCase() === expectedApprover1.toLowerCase(),
  ],
  [
    "Approver #2 matches deployment",
    approver2.toLowerCase() === expectedApprover2.toLowerCase(),
  ],
  [
    "Approver #1 voted",
    approver1Voted === true,
  ],
  [
    "Approver #2 voted",
    approver2Voted === true,
  ],
  [
    "Approval count reached 2",
    voteCounts[0] === 2n,
  ],
  [
    "No rejection votes",
    voteCounts[1] === 0n,
  ],
  [
    "Evaluator executed",
    voteCounts[2] === true,
  ],
  [
    "Job client is correct",
    job[1].toLowerCase() === expectedClient.toLowerCase(),
  ],
  [
    "Job provider is correct",
    job[2].toLowerCase() === expectedProvider.toLowerCase(),
  ],
  [
    "Job evaluator is correct",
    job[3].toLowerCase() === EVALUATOR.toLowerCase(),
  ],
  [
    "Job budget is 1 cUSDC",
    job[5] === expectedBudget,
  ],
  [
    "Job status is Completed (3)",
    job[7] === 3,
  ],
  [
    "Provider received 1 cUSDC",
    providerBalance >= expectedBudget,
  ],
  [
    "Evaluator has deployed bytecode",
    Boolean(code && code !== "0x"),
  ],
];

const passed = checks.filter(([, ok]) => ok).length;
const failed = checks.length - passed;

const report = {
  title: "ClearX On-Chain Verification",
  verifiedAt: new Date().toISOString(),
  network: "X Layer Testnet",
  chainId: await client.getChainId(),

  contracts: {
    TestUSDC: USDC,
    AgenticCommerce: COMMERCE,
    ClearXEvaluator: EVALUATOR,
  },

  evaluator: {
    threshold: threshold.toString(),
    approverCount: approverCount.toString(),
    approver1,
    approver2,
    approver1Voted,
    approver2Voted,
    approveCount: voteCounts[0].toString(),
    rejectCount: voteCounts[1].toString(),
    executed: voteCounts[2],
  },

  job: {
    jobId: JOB_ID.toString(),
    client: job[1],
    provider: job[2],
    evaluator: job[3],
    description: job[4],
    budgetBaseUnits: job[5].toString(),
    budgetCUSDC: formatUnits(job[5], 6),
    status: job[7],
    statusName: job[7] === 3 ? "Completed" : `Status ${job[7]}`,
    hook: job[8],
    deliverable: job[9],
  },

  balances: {
    clientCUSDC: formatUnits(clientBalance, 6),
    providerCUSDC: formatUnits(providerBalance, 6),
    providerReceivedAtLeastOneCUSDC:
      providerBalance >= expectedBudget,
  },

  assertions: {
    total: checks.length,
    passed,
    failed,
    allPassed: failed === 0,
  },

  checks: Object.fromEntries(
    checks.map(([name, ok]) => [name, ok])
  ),
};

const jsonPath = path.join(
  root,
  "proofs",
  "clearx-onchain-verification.json"
);

fs.writeFileSync(
  jsonPath,
  JSON.stringify(report, null, 2) + "\n"
);

const markdown = `# ClearX On-Chain Verification

**Network:** X Layer Testnet  
**Chain ID:** ${report.chainId}  
**Job:** #${JOB_ID}  
**Verified:** ${report.verifiedAt}

## Deployed Contracts

| Contract | Address |
|---|---|
| TestUSDC | ${USDC} |
| AgenticCommerce | ${COMMERCE} |
| ClearXEvaluator | ${EVALUATOR} |

## 2-of-2 Evaluator

- Threshold: **${threshold}**
- Approvers registered: **${approverCount}**
- Approver #1: \`${approver1}\`
- Approver #2: \`${approver2}\`
- Approver #1 voted: **${approver1Voted}**
- Approver #2 voted: **${approver2Voted}**
- Approval count: **${voteCounts[0]}**
- Reject count: **${voteCounts[1]}**
- Executed: **${voteCounts[2]}**

## Job #${JOB_ID}

- Client: \`${job[1]}\`
- Provider: \`${job[2]}\`
- Evaluator: \`${job[3]}\`
- Budget: **${formatUnits(job[5], 6)} cUSDC**
- Final status: **${job[7] === 3 ? "Completed (3)" : `Status ${job[7]}`}**
- Deliverable: \`${job[9]}\`

## Settlement

- Client cUSDC balance: **${formatUnits(clientBalance, 6)}**
- Provider cUSDC balance: **${formatUnits(providerBalance, 6)}**
- Provider received at least 1 cUSDC: **${providerBalance >= expectedBudget}**

## Verification Result

**${passed}/${checks.length} assertions passed**

${failed === 0
  ? "### ✅ ALL ON-CHAIN ASSERTIONS PASSED"
  : `### ❌ ${failed} ASSERTION(S) FAILED`}

This report was generated by querying the deployed X Layer Testnet contracts directly. No new settlement transaction was executed by this verification script.
`;

const mdPath = path.join(
  root,
  "proofs",
  "clearx-onchain-verification.md"
);

fs.writeFileSync(mdPath, markdown);

console.log("=================================");
console.log("CLEARX ON-CHAIN VERIFICATION");
console.log("=================================");
console.log("");
console.log("Network:", report.network);
console.log("Chain ID:", report.chainId);
console.log("Job ID:", JOB_ID.toString());
console.log("");
console.log("2-of-2 threshold:", threshold.toString());
console.log("Approvers:", approverCount.toString());
console.log("Approver #1 voted:", approver1Voted);
console.log("Approver #2 voted:", approver2Voted);
console.log("Approve count:", voteCounts[0].toString());
console.log("Reject count:", voteCounts[1].toString());
console.log("Executed:", voteCounts[2]);
console.log("");
console.log("Job status:", job[7] === 3 ? "Completed (3)" : job[7]);
console.log("Budget:", formatUnits(job[5], 6), "cUSDC");
console.log("Provider balance:", formatUnits(providerBalance, 6), "cUSDC");
console.log("");
console.log(`ASSERTIONS: ${passed}/${checks.length} PASSED`);

if (failed === 0) {
  console.log("");
  console.log("✅ ALL ON-CHAIN ASSERTIONS PASSED");
} else {
  console.log("");
  console.log(`❌ ${failed} ASSERTION(S) FAILED`);
  process.exitCode = 1;
}

console.log("");
console.log("JSON:", jsonPath);
console.log("MD:", mdPath);
