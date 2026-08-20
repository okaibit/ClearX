import { NextResponse } from "next/server";
import {
  createPublicClient,
  createWalletClient,
  http,
  parseUnits,
  parseEther,
  zeroAddress,
  encodeAbiParameters,
  keccak256,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { executeThroughClearX } from "@/lib/clearx/execution";
import {
  verifyTransferEvidence,
  verifyNativeTransferEvidence,
} from "@/lib/clearx/evidence";
import { xLayerTestnet } from "@/lib/clearx/xlayer";

import deployment from "../../../../deployments/xlayer-testnet.json";
import testUSDC from "../../../../artifacts/TestUSDC.json";
import commerce from "../../../../artifacts/AgenticCommerce.json";
import evaluator from "../../../../artifacts/ClearXEvaluator.json";
import evidenceCertificate from "../../../../artifacts/ClearXEvidenceCertificate.json";

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

function getApprover2PrivateKey() {
  const value = process.env.CLEARX_APPROVER2_PRIVATE_KEY;

  if (!value) {
    throw new Error(
      "CLEARX_APPROVER2_PRIVATE_KEY is not configured.",
    );
  }

  if (!/^0x[0-9a-fA-F]{64}$/.test(value)) {
    throw new Error(
      "CLEARX_APPROVER2_PRIVATE_KEY must be a 32-byte hex private key.",
    );
  }

  return value as `0x${string}`;
}

const rpcUrl =
  process.env.X_LAYER_TESTNET_RPC_URL ||
  xLayerTestnet.rpcUrls.default.http[0];

const USDC = deployment.contracts.TestUSDC.address as `0x${string}`;
const COMMERCE =
  deployment.contracts.AgenticCommerce.address as `0x${string}`;
const EVALUATOR =
  deployment.contracts.ClearXEvaluator.address as `0x${string}`;

const EVIDENCE_CERTIFICATE =
  deployment.contracts.ClearXEvidenceCertificate.address as `0x${string}`;

export async function POST(request: Request) {
  try {
    const account = privateKeyToAccount(getPrivateKey());
    const approver2Account = privateKeyToAccount(getApprover2PrivateKey());

    const publicClient = createPublicClient({
      chain: xLayerTestnet,
      transport: http(rpcUrl),
    });

    const walletClient = createWalletClient({
      account,
      chain: xLayerTestnet,
      transport: http(rpcUrl),
    });

    const approver2WalletClient = createWalletClient({
      account: approver2Account,
      chain: xLayerTestnet,
      transport: http(rpcUrl),
    });

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

    async function sendAsApprover2(
      label: string,
      request: Parameters<typeof approver2WalletClient.writeContract>[0],
    ) {
      console.log(`[ClearX] ${label}`);

      const hash = await approver2WalletClient.writeContract(request);

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

    const body = await request.json();

    const agent = body?.agent;
    const action = body?.action;
    const failureDemo = body?.failureDemo === true;

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

    // X Layer can briefly expose the transaction receipt before the
    // block is available to eth_getLogs. Wait for the block to become
    // queryable before extracting the JobCreated event.
    let jobCreatedLogs: any[] = [];

    for (let attempt = 0; attempt < 10; attempt++) {
      try {
        await publicClient.getBlock({
          blockNumber: create.blockNumber,
        });

        jobCreatedLogs = await publicClient.getLogs({
          address: COMMERCE,
          event: jobCreatedEvent as any,
          fromBlock: create.blockNumber,
          toBlock: create.blockNumber,
        });

        if (jobCreatedLogs.length > 0) {
          break;
        }
      } catch {
        // X Layer RPC may need a short propagation window.
      }

      await new Promise((resolve) => setTimeout(resolve, 1000));
    }

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

    // 6. Execute the agent's actual OKB obligation on X Layer.
    //
    // ClearX verifies this blockchain action BEFORE allowing settlement.
    // Evidence commitment used by the evaluator/settlement record.
    // 6. Execute the agent obligation on X Layer.
    //
    // Failure demo: do not broadcast an intentionally bad transaction.
    // Instead, deliberately construct a failed evidence result and hold
    // settlement. This demonstrates the safety control without risking funds.
    if (failureDemo) {
      const expectedRecipient =
        action.recipient as `0x${string}`;
      const observedRecipient = zeroAddress;
      const expectedAmount = parseEther(
        action.amount.toString(),
      );

      const checks = [
        {
          name: "Transaction status",
          status: "PASSED" as const,
          expected: "success",
          observed: "success",
        },
        {
          name: "Recipient",
          status: "FAILED" as const,
          expected: expectedRecipient,
          observed: observedRecipient,
        },
        {
          name: "Amount",
          status: "PASSED" as const,
          expected: expectedAmount.toString(),
          observed: expectedAmount.toString(),
        },
      ];

      return NextResponse.json({
        ...result,
        execution: "VERIFIED_ONCHAIN",
        executor: account.address,
        network: "X Layer Testnet",
        chainId: 1952,
        broadcasted: false,
        verifiedOnchain: false,
        failureDemo: true,
        settlementStatus: "HELD",
        settlement: {
          protocol: "ERC-8183-style AgenticCommerce",
          jobId: jobId.toString(),
          budget: settlementAmount.toString(),
          paymentToken: USDC,
          evaluator: EVALUATOR,
          provider: account.address,
          completed: false,
          evidenceHash:
            "0x0000000000000000000000000000000000000000000000000000000000000001",
        },
        evidence: {
          verified: false,
          reason:
            "Failure demo: independently observed recipient does not satisfy the execution obligation. Settlement was held and no evaluator approval was broadcast.",
          checks,
        },
        transactions,
        message:
          "ClearX detected an evidence mismatch and held settlement. No intentionally bad blockchain transaction was sent.",
      });
    }

    const agentTransfer =
      await walletClient.sendTransaction({
        to: action.recipient as `0x${string}`,
        value: parseEther(action.amount.toString()),
      });

    const agentTransferReceipt =
      await publicClient.waitForTransactionReceipt({
        hash: agentTransfer,
      });

    if (agentTransferReceipt.status !== "success") {
      throw new Error("Agent obligation transaction failed.");
    }

    transactions.push({
      step: "agent.transfer",
      hash: agentTransfer,
      blockNumber: agentTransferReceipt.blockNumber.toString(),
    });

    // 7. Independently verify the actual agent execution.
    //
    const expectedEvidenceRecipient =
      action.recipient as `0x${string}`;

    const evidence = await verifyNativeTransferEvidence({
      rpcUrl,
      transactionHash: agentTransfer,
      expectedRecipient: expectedEvidenceRecipient,
      expectedAmount: parseEther(action.amount.toString()),
    });

    // CRITICAL CONTROL POINT:
    //
    // Settlement cannot clear unless the independently observed
    // blockchain evidence satisfies the obligation.
    if (!evidence.verified) {
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

      return NextResponse.json({
        ...result,
        execution: "VERIFIED_ONCHAIN",
        executor: account.address,
        network: "X Layer Testnet",
        chainId: 1952,
        broadcasted: true,
        verifiedOnchain: false,
        transactionHash: agentTransfer,
        blockNumber: agentTransferReceipt.blockNumber.toString(),
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
          completed: false,
          evidenceHash: undefined,
        },
        evidence: {
          verified: false,
          reason:
            "Settlement held: independently verified blockchain evidence does not satisfy the obligation.",
          checks: evidence.checks,
          blockchain: evidence.evidence
            ? {
                transactionHash: evidence.evidence.transactionHash,
                blockNumber: evidence.evidence.blockNumber.toString(),
                token: "OKB",
                from: evidence.evidence.from,
                to: evidence.evidence.to,
                amount: evidence.evidence.amount.toString(),
              }
            : undefined,
        },
        failureMode: true,
        settlementStatus: "HELD",
        message:
          "ClearX detected an evidence mismatch and refused to clear settlement.",
        transactions,
      });
    }

    // 8. Evidence passed. Create a cryptographic certificate over
    // the independently observed execution evidence.

    if (!evidence.evidence) {
      throw new Error(
        "Evidence verification passed without observable blockchain evidence.",
      );
    }

    const observedEvidence = evidence.evidence;

    // Hash the independently observed blockchain facts. This commitment
    // is later bound into the EIP-712 evidence certificate.
    const evidenceHash = keccak256(
      encodeAbiParameters(
        [
          { name: "transactionHash", type: "bytes32" },
          { name: "blockNumber", type: "uint256" },
          { name: "from", type: "address" },
          { name: "to", type: "address" },
          { name: "amount", type: "uint256" },
        ],
        [
          observedEvidence.transactionHash,
          observedEvidence.blockNumber,
          observedEvidence.from,
          observedEvidence.to,
          observedEvidence.amount,
        ],
      ),
    );

    const certificateDomain = {
      name: "ClearX Evidence Certificate",
      version: "1",
      chainId: 1952,
      verifyingContract: EVIDENCE_CERTIFICATE,
    } as const;

    const certificateTypes = {
      EvidenceCertificate: [
        { name: "jobId", type: "uint256" },
        { name: "chainId", type: "uint256" },
        { name: "commerce", type: "address" },
        { name: "transactionHash", type: "bytes32" },
        { name: "recipient", type: "address" },
        { name: "amount", type: "uint256" },
        { name: "evidenceHash", type: "bytes32" },
      ],
    } as const;

    const certificateMessage = {
      jobId,
      chainId: BigInt(1952),
      commerce: COMMERCE,
      transactionHash: observedEvidence.transactionHash,
      recipient: observedEvidence.to,
      amount: observedEvidence.amount,
      evidenceHash,
    };

    console.log(
      "[ClearX] Creating evidence certificate for transaction:",
      observedEvidence.transactionHash,
    );

    // Both independent approvers attest to the exact same evidence.
    const certificateSignature1 = await account.signTypedData({
      domain: certificateDomain,
      types: certificateTypes,
      primaryType: "EvidenceCertificate",
      message: certificateMessage,
    });

    const certificateSignature2 =
      await approver2Account.signTypedData({
        domain: certificateDomain,
        types: certificateTypes,
        primaryType: "EvidenceCertificate",
        message: certificateMessage,
      });

    // The certificate contract requires signatures in strictly increasing
    // recovered-address order.
    const certificateSignatures = [
      {
        address: account.address,
        signature: certificateSignature1,
      },
      {
        address: approver2Account.address,
        signature: certificateSignature2,
      },
    ]
      .sort((a, b) => {
        const aValue = BigInt(a.address);
        const bValue = BigInt(b.address);
        if (aValue < bValue) return -1;
        if (aValue > bValue) return 1;
        return 0;
      })
      .map((item) => item.signature);

    // Calculate the exact certificate ID that the contract will verify.
    const certificateId = await publicClient.readContract({
      address: EVIDENCE_CERTIFICATE,
      abi: evidenceCertificate.abi,
      functionName: "certificateDigest",
      args: [
        jobId,
        BigInt(1952),
        COMMERCE,
        observedEvidence.transactionHash,
        observedEvidence.to,
        observedEvidence.amount,
        evidenceHash,
      ],
    });

    const alreadyVerified = await publicClient.readContract({
      address: EVIDENCE_CERTIFICATE,
      abi: evidenceCertificate.abi,
      functionName: "certificateVerified",
      args: [certificateId],
    });

    if (alreadyVerified) {
      throw new Error(
        "Evidence certificate has already been verified on-chain.",
      );
    }

    // Permanently attest to the evidence on X Layer.
    const certificateVerification = await sendContract(
      "ClearX evidence certificate: 2-of-2 verification",
      {
        address: EVIDENCE_CERTIFICATE,
        abi: evidenceCertificate.abi,
        functionName: "verifyCertificate",
        args: [
          jobId,
          BigInt(1952),
          COMMERCE,
          observedEvidence.transactionHash,
          observedEvidence.to,
          observedEvidence.amount,
          evidenceHash,
          certificateSignatures,
        ],
      },
    );

    transactions.push({
      step: "evidence.certificate (2 of 2, verified on-chain)",
      hash: certificateVerification.hash,
      blockNumber:
        certificateVerification.blockNumber.toString(),
    });

    // X Layer may briefly lag when reading contract state immediately
    // after a successful transaction. Retry the certificate state read
    // before treating the verification as failed.
    let certificateVerified = false;

    for (let attempt = 0; attempt < 10; attempt++) {
      certificateVerified = (await publicClient.readContract({
        address: EVIDENCE_CERTIFICATE,
        abi: evidenceCertificate.abi,
        functionName: "certificateVerified",
        args: [certificateId],
      })) as boolean;

      if (certificateVerified) {
        break;
      }

      await new Promise((resolve) => setTimeout(resolve, 1000));
    }

    if (!certificateVerified) {
      throw new Error(
        "Evidence certificate transaction succeeded but certificate state was not verified after RPC retry window.",
      );
    }

    console.log(
      "[ClearX] Evidence certificate verified on-chain:",
      certificateVerification.hash,
    );

    // 9. Evidence certificate passed. Two independent evaluator
    // approvers must now authorize settlement.

    // 9. Evidence passed. Two independent approvers must each cast
    // a vote before the evaluator's threshold releases settlement.
    const approval1 = await sendContract(
      "ClearX evaluator: approver 1 voting",
      {
        address: EVALUATOR,
        abi: evaluator.abi,
        functionName: "approve",
        args: [jobId, evidenceHash],
      },
    );

    transactions.push({
      step: "evaluator.approve (1 of 2)",
      hash: approval1.hash,
      blockNumber: approval1.blockNumber.toString(),
    });

    const evaluation = await sendAsApprover2(
      "ClearX evaluator: approver 2 voting",
      {
        address: EVALUATOR,
        abi: evaluator.abi,
        functionName: "approve",
        args: [jobId, evidenceHash],
      },
    );

    transactions.push({
      step: "evaluator.approve (2 of 2, threshold met)",
      hash: evaluation.hash,
      blockNumber: evaluation.blockNumber.toString(),
    });

    // 10. Independently verify the settlement transfer itself.
    // This check happens only after evaluator approval because the
    // settlement transaction does not exist before that point.
    const settlementEvidence = await verifyTransferEvidence({
      rpcUrl,
      transactionHash: evaluation.hash,
      tokenAddress: USDC,
      expectedRecipient: account.address,
      expectedAmount: settlementAmount,
    });

    // 9. Read final on-chain job state AFTER settlement approval.
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

    const verified =
      finalStatus === 3 &&
      finalBudget === settlementAmount &&
      evidence.verified &&
      certificateVerified &&
      settlementEvidence.verified;

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
      failureDemo,
      settlementStatus: verified
        ? "CLEARED"
        : "HELD",
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
        certificateId,
        certificateTransactionHash: certificateVerification.hash,
        certificateVerified,
        attestations: [
          {
            signer: account.address,
            signature: certificateSignature1,
          },
          {
            signer: approver2Account.address,
            signature: certificateSignature2,
          },
        ].sort((a, b) =>
          a.signer.toLowerCase().localeCompare(b.signer.toLowerCase()),
        ),
      },
      evidence: {
        verified: verified,
        certificate: {
          verified: certificateVerified,
          certificateId,
          transactionHash: certificateVerification.hash,
        },
        reason: settlementEvidence.reason,
        checks: evidence.checks,
        blockchain: settlementEvidence.evidence
          ? {
              transactionHash: settlementEvidence.evidence.transactionHash,
              blockNumber: settlementEvidence.evidence.blockNumber.toString(),
              token: settlementEvidence.evidence.token,
              from: settlementEvidence.evidence.from,
              to: settlementEvidence.evidence.to,
              amount: settlementEvidence.evidence.amount.toString(),
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
