import fs from "node:fs";
import {
  createPublicClient,
  http,
  parseUnits,
} from "viem";
import { verifyTransferEvidence } from "../src/lib/clearx/evidence.ts";
import { xLayerTestnet } from "../src/lib/clearx/xlayer.ts";

const text = fs.readFileSync(".env.local", "utf8");

const rpcUrl =
  text.match(/^X_LAYER_TESTNET_RPC_URL=(.*)$/m)?.[1]?.trim();

if (!rpcUrl) {
  throw new Error("X_LAYER_TESTNET_RPC_URL is missing.");
}

const transactionHash =
  "0xab1d2755035934a2be1335920aed6240a929b929a475cdc2163eb3969515acc2";

const tokenAddress =
  "0x771fe2efa6208a738cafb7a06c0d272d8eae6d70";

const providerAddress =
  "0xd65Bb2dC678d9f192B5f69Ded613c22C5eF6A6B3";

const expectedAmount = parseUnits("1", 6);

console.log("=================================");
console.log("CLEARX REAL EVIDENCE TEST");
console.log("=================================");
console.log("Transaction:", transactionHash);
console.log("Token:", tokenAddress);
console.log("Expected recipient:", providerAddress);
console.log("Expected amount:", expectedAmount.toString());

const result = await verifyTransferEvidence({
  rpcUrl,
  transactionHash,
  tokenAddress,
  expectedRecipient: providerAddress,
  expectedAmount,
});

console.log("\n===== VERIFICATION =====");

for (const check of result.checks) {
  console.log(
    `${check.status === "PASSED" ? "✓" : "✗"} ${check.name}: ${check.observed}`,
  );
}

console.log("\nVerified:", result.verified);
console.log("Reason:", result.reason);

if (result.evidence) {
  console.log("\n===== BLOCKCHAIN EVIDENCE =====");
  console.log("Block:", result.evidence.blockNumber.toString());
  console.log("From:", result.evidence.from);
  console.log("To:", result.evidence.to);
  console.log("Amount:", result.evidence.amount.toString());
}

if (!result.verified) {
  throw new Error("CLEARX EVIDENCE VERIFICATION FAILED.");
}

console.log("\nCLEARX BLOCKCHAIN EVIDENCE VERIFIED.");
