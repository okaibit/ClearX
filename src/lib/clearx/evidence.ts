import {
  createPublicClient,
  http,
  type Address,
  type Hex,
} from "viem";

export type TransferEvidence = {
  transactionHash: Hex;
  blockNumber: bigint;
  token: Address;
  from: Address;
  to: Address;
  amount: bigint;
  timestamp?: bigint;
};

export type EvidenceCheck = {
  name: string;
  status: "PASSED" | "FAILED";
  expected: string;
  observed: string;
};

export type EvidenceVerification = {
  verified: boolean;
  checks: EvidenceCheck[];
  reason: string;
  evidence?: TransferEvidence;
};

const erc20TransferAbi = [
  {
    type: "event",
    name: "Transfer",
    inputs: [
      {
        indexed: true,
        name: "from",
        type: "address",
      },
      {
        indexed: true,
        name: "to",
        type: "address",
      },
      {
        indexed: false,
        name: "value",
        type: "uint256",
      },
    ],
  },
] as const;

export async function verifyTransferEvidence({
  rpcUrl,
  transactionHash,
  tokenAddress,
  expectedRecipient,
  expectedAmount,
}: {
  rpcUrl: string;
  transactionHash: Hex;
  tokenAddress: Address;
  expectedRecipient: Address;
  expectedAmount: bigint;
}): Promise<EvidenceVerification> {
  const client = createPublicClient({
    transport: http(rpcUrl),
  });

  const receipt = await client.getTransactionReceipt({
    hash: transactionHash,
  });

  if (receipt.status !== "success") {
    return {
      verified: false,
      checks: [
        {
          name: "Transaction status",
          status: "FAILED",
          expected: "success",
          observed: receipt.status,
        },
      ],
      reason: "The transaction did not execute successfully.",
    };
  }

  // X Layer can briefly expose a transaction receipt before the
  // corresponding block is available to eth_getLogs. Wait for the
  // block to become queryable before extracting independent evidence.
  let blockAvailable = false;

  for (let attempt = 0; attempt < 10; attempt++) {
    try {
      await client.getBlock({
        blockNumber: receipt.blockNumber,
      });
      blockAvailable = true;
      break;
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
  }

  if (!blockAvailable) {
    return {
      verified: false,
      checks: [
        {
          name: "Evidence block availability",
          status: "FAILED",
          expected: receipt.blockNumber.toString(),
          observed: "RPC block unavailable",
        },
      ],
      reason:
        "The transaction receipt exists, but the X Layer RPC has not yet exposed the corresponding block for evidence queries.",
    };
  }

  const logs = await client.getLogs({
    address: tokenAddress,
    event: erc20TransferAbi[0],
    fromBlock: receipt.blockNumber,
    toBlock: receipt.blockNumber,
  });

  const matchingLog = logs.find(
    (log) =>
      log.transactionHash?.toLowerCase() ===
        transactionHash.toLowerCase() &&
      log.args.to?.toLowerCase() ===
        expectedRecipient.toLowerCase() &&
      log.args.value === expectedAmount,
  );

  const transferLog = logs.find(
    (log) =>
      log.transactionHash?.toLowerCase() ===
      transactionHash.toLowerCase(),
  );

  if (!transferLog) {
    return {
      verified: false,
      checks: [
        {
          name: "Transfer evidence",
          status: "FAILED",
          expected: "ERC-20 Transfer event",
          observed: "No matching Transfer event",
        },
      ],
      reason:
        "No ERC-20 Transfer event was found for the transaction.",
    };
  }

  const observedRecipient = transferLog.args.to;
  const observedAmount = transferLog.args.value;

  const recipientPassed =
    observedRecipient?.toLowerCase() ===
    expectedRecipient.toLowerCase();

  const amountPassed =
    observedAmount === expectedAmount;

  const checks: EvidenceCheck[] = [
    {
      name: "Transaction status",
      status: "PASSED",
      expected: "success",
      observed: receipt.status,
    },
    {
      name: "Token",
      status: "PASSED",
      expected: tokenAddress,
      observed: tokenAddress,
    },
    {
      name: "Recipient",
      status: recipientPassed ? "PASSED" : "FAILED",
      expected: expectedRecipient,
      observed: observedRecipient ?? "unknown",
    },
    {
      name: "Amount",
      status: amountPassed ? "PASSED" : "FAILED",
      expected: expectedAmount.toString(),
      observed: observedAmount?.toString() ?? "unknown",
    },
  ];

  const verified =
    matchingLog !== undefined &&
    recipientPassed &&
    amountPassed;

  return {
    verified,
    checks,
    reason: verified
      ? "Blockchain evidence satisfies the execution obligation."
      : "Blockchain evidence does not satisfy the execution obligation.",
    evidence: {
      transactionHash,
      blockNumber: receipt.blockNumber,
      token: tokenAddress,
      from: transferLog.args.from!,
      to: observedRecipient!,
      amount: observedAmount!,
    },
  };
}


export async function verifyNativeTransferEvidence({
  rpcUrl,
  transactionHash,
  expectedRecipient,
  expectedAmount,
}: {
  rpcUrl: string;
  transactionHash: Hex;
  expectedRecipient: Address;
  expectedAmount: bigint;
}): Promise<EvidenceVerification> {
  const client = createPublicClient({
    transport: http(rpcUrl),
  });

  const receipt = await client.getTransactionReceipt({
    hash: transactionHash,
  });

  const transaction = await client.getTransaction({
    hash: transactionHash,
  });

  if (receipt.status !== "success") {
    return {
      verified: false,
      checks: [
        {
          name: "Transaction status",
          status: "FAILED",
          expected: "success",
          observed: receipt.status,
        },
      ],
      reason: "The agent obligation transaction failed.",
    };
  }

  const recipientPassed =
    transaction.to?.toLowerCase() ===
    expectedRecipient.toLowerCase();

  const amountPassed =
    transaction.value === expectedAmount;

  const checks: EvidenceCheck[] = [
    {
      name: "Transaction status",
      status: "PASSED",
      expected: "success",
      observed: receipt.status,
    },
    {
      name: "Recipient",
      status: recipientPassed ? "PASSED" : "FAILED",
      expected: expectedRecipient,
      observed: transaction.to ?? "unknown",
    },
    {
      name: "Amount",
      status: amountPassed ? "PASSED" : "FAILED",
      expected: expectedAmount.toString(),
      observed: transaction.value.toString(),
    },
  ];

  const verified = recipientPassed && amountPassed;

  return {
    verified,
    checks,
    reason: verified
      ? "Blockchain evidence satisfies the agent execution obligation."
      : "Blockchain evidence does not satisfy the agent execution obligation.",
    evidence: {
      transactionHash,
      blockNumber: receipt.blockNumber,
      token: "OKB" as Address,
      from: transaction.from,
      to: transaction.to ?? expectedRecipient,
      amount: transaction.value,
    },
  };
}
