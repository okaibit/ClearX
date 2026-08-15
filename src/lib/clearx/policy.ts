export type Decision = "APPROVE" | "REVIEW" | "BLOCK";

export type AgentAction = {
  type: "TRANSFER" | "CONTRACT_CALL" | "SWAP";
  amount: number;
  asset: string;
  recipient: string;
  network: string;
};

export type ClearXPolicy = {
  maxTransferAmount: number;
  allowedRecipients: string[];
  allowedNetworks: string[];
  allowedActions: AgentAction["type"][];
};

export type PolicyCheck = {
  name: string;
  status: "PASSED" | "REVIEW" | "BLOCKED";
  reason: string;
};

export type PolicyResult = {
  decision: Decision;
  checks: PolicyCheck[];
  reason: string;
};

export const defaultPolicy: ClearXPolicy = {
  maxTransferAmount: 100,
  allowedRecipients: [
    "0x7A3...91F2",
    "0xD6aa751524A94161eAdfF44047266Fa8586F7A77",
    "0xd65Bb2dC678d9f192B5f69Ded613c22C5eF6A6B3",
  ],
  allowedNetworks: ["X Layer"],
  allowedActions: ["TRANSFER", "SWAP"],
};

export function evaluateAction(
  action: AgentAction,
  policy: ClearXPolicy = defaultPolicy,
): PolicyResult {
  const checks: PolicyCheck[] = [];

  const actionAllowed = policy.allowedActions.includes(action.type);

  checks.push({
    name: "Execution scope",
    status: actionAllowed ? "PASSED" : "BLOCKED",
    reason: actionAllowed
      ? "Action type is permitted by policy."
      : `${action.type} is outside the agent execution scope.`,
  });

  const networkAllowed = policy.allowedNetworks.includes(action.network);

  checks.push({
    name: "Network",
    status: networkAllowed ? "PASSED" : "BLOCKED",
    reason: networkAllowed
      ? `${action.network} is an approved network.`
      : `${action.network} is not an approved network.`,
  });

  const recipientAllowed = policy.allowedRecipients.includes(
    action.recipient,
  );

  checks.push({
    name: "Recipient",
    status: recipientAllowed ? "PASSED" : "BLOCKED",
    reason: recipientAllowed
      ? "Recipient is on the policy allowlist."
      : "Recipient is not on the policy allowlist.",
  });

  const amountWithinLimit = action.amount <= policy.maxTransferAmount;

  checks.push({
    name: "Amount boundary",
    status: amountWithinLimit ? "PASSED" : "REVIEW",
    reason: amountWithinLimit
      ? `Amount is within the ${policy.maxTransferAmount} ${action.asset} policy limit.`
      : `Amount exceeds the ${policy.maxTransferAmount} ${action.asset} autonomous limit.`,
  });

  if (checks.some((check) => check.status === "BLOCKED")) {
    return {
      decision: "BLOCK",
      checks,
      reason: "The action violates one or more execution policies.",
    };
  }

  if (checks.some((check) => check.status === "REVIEW")) {
    return {
      decision: "REVIEW",
      checks,
      reason: "The action requires human approval before execution.",
    };
  }

  return {
    decision: "APPROVE",
    checks,
    reason: "The action satisfies the configured execution policy.",
  };
}
