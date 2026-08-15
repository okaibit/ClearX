export type ObligationAction = "TRANSFER" | "CONTRACT_CALL" | "SWAP";

export type ClearXObligation = {
  rawInstruction: string;
  action: ObligationAction;
  amount: number;
  asset: string;
  recipient: string;
  network: string;
  deadlineSeconds: number;
  settlementAmount: number;
  settlementAsset: string;
  conditions: string[];
};

export type ObligationCompileResult = {
  success: boolean;
  obligation?: ClearXObligation;
  errors: string[];
};

const ADDRESS_REGEX = /0x[a-fA-F0-9]{40}/;

function extractAmount(text: string): number | null {
  const match = text.match(/(\d+(?:\.\d+)?)\s*(?:USDC|USDT|USDCe|cUSDC)/i);
  return match ? Number(match[1]) : null;
}

function extractRecipient(text: string): string | null {
  const match = text.match(ADDRESS_REGEX);
  return match?.[0] ?? null;
}

function extractDeadline(text: string): number | null {
  const minuteMatch = text.match(
    /(?:within|in|before)\s+(\d+)\s*(?:seconds?|secs?|s)\b/i,
  );

  if (minuteMatch) {
    return Number(minuteMatch[1]);
  }

  const minutes = text.match(
    /(?:within|in|before)\s+(\d+)\s*(?:minutes?|mins?|m)\b/i,
  );

  if (minutes) {
    return Number(minutes[1]) * 60;
  }

  const hourMatch = text.match(
    /(?:within|in|before)\s+(\d+)\s*(?:hours?|hrs?|h)\b/i,
  );

  if (hourMatch) {
    return Number(hourMatch[1]) * 60 * 60;
  }

  return null;
}

function extractSettlement(
  text: string,
): { amount: number; asset: string } | null {
  const patterns = [
    /pay(?:ment)?\s+(?:the\s+)?provider\s+(\d+(?:\.\d+)?)\s*(USDC|USDT|cUSDC)/i,
    /provider\s+(?:gets?|receives?)\s+(\d+(?:\.\d+)?)\s*(USDC|USDT|cUSDC)/i,
    /settlement\s+(?:of\s+)?(\d+(?:\.\d+)?)\s*(USDC|USDT|cUSDC)/i,
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);

    if (match) {
      return {
        amount: Number(match[1]),
        asset: match[2].toUpperCase(),
      };
    }
  }

  return null;
}

function detectNetwork(text: string): string {
  if (/x\s*layer/i.test(text)) {
    return "X Layer";
  }

  return "X Layer";
}

export function compileObligation(
  rawInstruction: string,
): ObligationCompileResult {
  const errors: string[] = [];
  const text = rawInstruction.trim();

  if (!text) {
    return {
      success: false,
      errors: ["An obligation instruction is required."],
    };
  }

  if (!/\b(send|transfer|pay)\b/i.test(text)) {
    errors.push("Could not identify a transfer obligation.");
  }

  const amount = extractAmount(text);

  if (amount === null) {
    errors.push("Could not identify the execution amount.");
  }

  const recipient = extractRecipient(text);

  if (!recipient) {
    errors.push(
      "Could not identify the recipient wallet address.",
    );
  }

  const deadlineSeconds = extractDeadline(text);

  if (deadlineSeconds === null) {
    errors.push(
      "Could not identify an execution deadline.",
    );
  }

  const settlement = extractSettlement(text);

  if (!settlement) {
    errors.push(
      "Could not identify the provider settlement amount.",
    );
  }

  if (errors.length > 0) {
    return {
      success: false,
      errors,
    };
  }

  const obligation: ClearXObligation = {
    rawInstruction: text,
    action: "TRANSFER",
    amount: amount!,
    asset: "USDC",
    recipient: recipient!,
    network: detectNetwork(text),
    deadlineSeconds: deadlineSeconds!,
    settlementAmount: settlement!.amount,
    settlementAsset: settlement!.asset,
    conditions: [
      "Execution action must be TRANSFER.",
      `Token must be ${"USDC"}.`,
      `Amount must equal ${amount} USDC.`,
      `Recipient must equal ${recipient}.`,
      "Network must be X Layer.",
      `Execution must occur within ${deadlineSeconds} seconds.`,
    ],
  };

  return {
    success: true,
    obligation,
    errors: [],
  };
}
