import { NextResponse } from "next/server";
import {
  createPublicClient,
  createWalletClient,
  http,
  parseUnits,
  zeroAddress,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { executeThroughClearX } from "@/lib/clearx/execution";
import { verifyTransferEvidence } from "@/lib/clearx/evidence";
import { xLayerTestnet } from "@/lib/clearx/xlayer";

import deployment from "../../../../deployments/xlayer-testnet.json";
import testUSDC from "../../../../artifacts/TestUSDC.json";
import commerce from "../../../../artifacts/AgenticCommerce.json";
import evaluator from "../../../../artifacts/ClearXEvaluator.json";

function getPrivateKey() {
  const value = process.env.CLEARX_EXECUTOR_PRIVATE_KEY;

  if (!value) {
    throw new Error(
      "CLEARX_EXECUTOR_PRIVATE_KEY is not configured.",
    );
  }

  if (!/^0x[0-9a-fA-F]{64}$/.test(value)) {
    throw new Error(
      "CLEARX_EXECUTOR_PRIVATE_KEY must be a 32-byte hex private key.",
    );
  }

  return value as `0x${string}`;
}

const rpcUrl =
  process.env.X_LAYER_TESTNET_RPC_URL ||
  xLayerTestnet.rpcUrls.default.http[0];

const account = privateKeyToAccount(getPrivateKey());

const publicClient = createPublicClient({
  chain: xLayerTestnet,
  transport: http(rpcUrl),
});

const walletClient = createWalletClient({
  account,
  chain: xLayerTestnet,
  transport: http(rpcUrl),
});

const USDC = deployment.contracts.TestUSDC.address as `0x${string}`;
const COMMERCE =
  deployment.contracts.AgenticCommerce.address as `0x${string}`;
const EVALUATOR =
  deployment.contracts.ClearXEvaluator.address as `0x${string}`;

async function sendContract(
  label: string,
  request: Parameters<typeof walletClient.writeContract>[0],
) {
  console.log(`[ClearX] ${label}`);

  const hash = await walletClient.writeContract(request);

  const receipt =
    await publicClient.waitForTransactionReceipt({
      hash,
    });

  if (receipt.status !== "success") {
    throw new Error(`${label} transaction failed.`);
  }

  return {
    hash,
    blockNumber: receipt.blockNumber,
  };
}

export async function POST(request: Request) {
  try {
    const body = await request.json();

    const agent = body?.agent;
    const action = body?.action;

    if (typeof agent !== "string" || !action) {
      return NextResponse.json(
        { error: "agent and action are required" },
        { status: 400 },
      );
    }

    const result = executeThroughClearX(agent, action);

    if (result.execution === "STOPPED") {
      return NextResponse.json(result);
    }

    if (action.asset !== "OKB" || action.network !== "X Layer") {
      return NextResponse.json(
        {
          error:
            "ClearX settlement currently supports the X Layer testnet action surface only.",
          supportedAsset: "OKB",
          supportedNetwork: "X Layer",
        },
        { status: 400 },
      );
    }

    if (
      typeof action.amount !== "number" ||
      !Number.isFinite(action.amount) ||
      action.amount <= 0
    ) {
      return NextResponse.json(
        { error: "Transfer amount must be a positive number." },
        { status: 400 },
      );
    }

    const settlementAmount = parseUnits(
      process.env.CLEARX_SETTLEMENT_AMOUNT_USDC || "1",
      6,
    );

    const expiry =
      BigInt(Math.floor(Date.now() / 1000) + 3600);

    const transactions: Array<{
      step: string;
      hash: string;
      blockNumber: string;
    }> = [];

    // 1. Create job
    const create = await sendContract(
      "Creating AgenticCommerce job",
      {
        address: COMMERCE,
        abi: commerce.abi,
        functionName: "createJob",
        args: [
          account.address,
          EVALUATOR,
          expiry,
          "ClearX agentic commerce execution",
          zeroAddress,
        ],
      },
    );

    transactions.push({
      step: "createJob",
      hash: create.hash,
      blockNumber: create.blockNumber.toString(),
    });

    const jobCreatedEvent = commerce.abi.find(
      (item: any) =>
        item.type === "event" &&
        item.name === "JobCreated",
    );

    if (!jobCreatedEvent) {
      throw new Error(
        "AgenticCommerce ABI does not contain the JobCreated event.",
      );
    }

    const jobCreatedLogs = await publicClient.getLogs({
      address: COMMERCE,
      event: jobCreatedEvent as any,
      fromBlock: create.blockNumber,
      toBlock: create.blockNumber,
    });

    if (jobCreatedLogs.length === 0) {
      throw new Error(
        "Could not extract the AgenticCommerce job ID from the JobCreated event.",
      );
    }

    const createdLog = jobCreatedLogs[0] as unknown as {
      args?: {
        jobId?: bigint;
      };
    };

    const jobId = createdLog.args?.jobId;

    if (jobId === undefined) {
      throw new Error(
        "JobCreated event did not contain a jobId.",
      );
    }

    // 2. Set budget
    const budget = await sendContract(
      "Setting settlement budget",
      {
        address: COMMERCE,
        abi: commerce.abi,
        functionName: "setBudget",
        args: [jobId, settlementAmount, "0x"],
      },
    );

    transactions.push({
      step: "setBudget",
      hash: budget.hash,
      blockNumber: budget.blockNumber.toString(),
    });

    // 3. Approve TestUSDC
    const approval = await sendContract(
      "Approving TestUSDC settlement",
      {
        address: USDC,
        abi: testUSDC.abi,
        functionName: "approve",
        args: [COMMERCE, settlementAmount],
      },
    );

    transactions.push({
      step: "approve",
      hash: approval.hash,
      blockNumber: approval.blockNumber.toString(),
    });

    // 4. Fund job
    const fund = await sendContract(
      "Funding settlement job",
      {
        address: COMMERCE,
        abi: commerce.abi,
        functionName: "fund",
        args: [jobId, "0x"],
      },
    );

    transactions.push({
      step: "fund",
      hash: fund.hash,
      blockNumber: fund.blockNumber.toString(),
    });

    // 5. Submit deliverable
    const deliverable =
      "0x1111111111111111111111111111111111111111111111111111111111111111";

    const submit = await sendContract(
      "Submitting deliverable",
      {
        address: COMMERCE,
        abi: commerce.abi,
        functionName: "submit",
        args: [jobId, deliverable, "0x"],
      },
    );

    transactions.push({
      step: "submit",
      hash: submit.hash,
      blockNumber: submit.blockNumber.toString(),
    });

    // 6. ClearX evaluator approves evidence and releases payment
    const evidenceHash =
      "0x2222222222222222222222222222222222222222222222222222222222222222";

    const evaluation = await sendContract(
      "ClearX evaluator approving evidence",
      {
        address: EVALUATOR,
        abi: evaluator.abi,
        functionName: "approve",
        args: [jobId, evidenceHash],
      },
    );

    transactions.push({
      step: "evaluator.approve",
      hash: evaluation.hash,
      blockNumber: evaluation.blockNumber.toString(),
    });

    // 7. Read final on-chain job state.
    const job = (await publicClient.readContract({
      address: COMMERCE,
      abi: commerce.abi,
      functionName: "jobs",
      args: [jobId],
    })) as readonly [
      bigint,
      `0x${string}`,
      `0x${string}`,
      `0x${string}`,
      string,
      bigint,
      bigint,
      number,
      `0x${string}`,
    ];

    const finalStatus = job[7];
    const finalBudget = job[5];

    // 8. Independently verify the actual settlement transaction.
    // The evaluator transaction releases the escrowed TestUSDC to the provider.
    const evidence = await verifyTransferEvidence({
      rpcUrl,
      transactionHash: evaluation.hash,
      tokenAddress: USDC,
      expectedRecipient: account.address,
      expectedAmount: settlementAmount,
    });

    const verified =
      finalStatus === 3 &&
      finalBudget === settlementAmount &&
      evidence.verified;

    return NextResponse.json({
      ...result,
      execution: verified
        ? "VERIFIED_ONCHAIN"
        : "BROADCASTED",
      executor: account.address,
      network: "X Layer Testnet",
      chainId: 1952,
      broadcasted: true,
      verifiedOnchain: verified,
      transactionHash: evaluation.hash,
      blockNumber: evaluation.blockNumber.toString(),
      recipient: action.recipient,
      value: `${action.amount} OKB`,
      settlement: {
        protocol: "ERC-8183-style AgenticCommerce",
        jobId: jobId.toString(),
        budget: settlementAmount.toString(),
        verifiedBudget: finalBudget.toString(),
        paymentToken: USDC,
        evaluator: EVALUATOR,
        provider: account.address,
        finalStatus,
        completed: finalStatus === 3,
        evidenceHash,
      },
      evidence: {
        verified: evidence.verified,
        reason: evidence.reason,
        checks: evidence.checks,
        blockchain: evidence.evidence
          ? {
              transactionHash: evidence.evidence.transactionHash,
              blockNumber: evidence.evidence.blockNumber.toString(),
              token: evidence.evidence.token,
              from: evidence.evidence.from,
              to: evidence.evidence.to,
              amount: evidence.evidence.amount.toString(),
            }
          : undefined,
      },
      transactions,
      message: verified
        ? "ClearX approved the obligation, completed the on-chain commerce job, independently verified blockchain evidence, and confirmed provider settlement on X Layer Testnet."
        : "ClearX completed the settlement flow, but independent blockchain evidence verification failed.",
    });
  } catch (error) {
    console.error("ClearX execution error:", error);

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Execution request failed.",
      },
      { status: 500 },
    );
  }
}
