import "dotenv/config";

import fs from "node:fs";
import path from "node:path";

import {
  createPublicClient,
  createWalletClient,
  http,
} from "viem";

import { privateKeyToAccount } from "viem/accounts";

const root = process.cwd();

function loadEnv() {
  const envPath = path.join(root, ".env.local");

  for (const line of fs.readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();

    if (
      !trimmed ||
      trimmed.startsWith("#") ||
      !trimmed.includes("=")
    ) {
      continue;
    }

    const index = trimmed.indexOf("=");
    process.env[trimmed.slice(0, index).trim()] =
      trimmed.slice(index + 1).trim();
  }
}

loadEnv();

const rpcUrl =
  process.env.X_LAYER_TESTNET_RPC_URL ||
  process.env.X_LAYER_RPC_URL;

const privateKey = process.env.CLEARX_EXECUTOR_PRIVATE_KEY;

const executor = privateKeyToAccount(
  privateKey.startsWith("0x")
    ? privateKey
    : `0x${privateKey}`,
);

const publicClient = createPublicClient({
  transport: http(rpcUrl),
});

const walletClient = createWalletClient({
  account: executor,
  transport: http(rpcUrl),
});

const certificateAddress =
  "0x2d142be8ca4b8a89d9fa8fbafffd12789648afc9";

const artifact = JSON.parse(
  fs.readFileSync(
    path.join(
      root,
      "artifacts",
      "ClearXEvidenceCertificate.json",
    ),
    "utf8",
  ),
);

const abi = artifact.abi;

const chainId = await publicClient.getChainId();

const commerce =
  "0x1de079b6db054b6679eea2575385a9fb2360647c";

const jobId = 5n;

const transactionHash =
  "0xc50a2c2abcb0a434ce2452475d8669aa982e39e690369d1220ce860904f5167c";

const recipient =
  "0xD6aa751524A94161eAdfF44047266Fa8586F7A77";

/*
 * IMPORTANT:
 *
 * The original certificate was signed for:
 *
 * amount = 1000000
 *
 * We intentionally change it to:
 *
 * amount = 1000001
 *
 * WITHOUT changing the original signatures.
 *
 * Therefore the signatures must no longer match the
 * certificate digest.
 */
const tamperedAmount = 1000001n;

const evidenceHash =
  "0x2222222222222222222222222222222222222222222222222222222222222222";

const originalSignature1 =
  "0x8c51b85de777e1fdff06175ad72e6b6e619b7df1acd304f25068e89412465f2851691df2d7bdd51e5d4c1a505bd9b7f6e992c70a0e9c7705c3b7314dff3ccbb01b";

const originalSignature2 =
  "0xc1ede74c70401ff6de5406805cc8960a890b56f37c641f014b575b022b0eda620aa1e8f9b087c996af835d7d6c94fbb81f727d7619a10f93493aa5594375d5251b";

const originalAmount = 1000000n;

console.log("=================================");
console.log("CLEARX EVIDENCE TAMPER TEST");
console.log("=================================");

console.log("Original amount:", originalAmount.toString());
console.log("Tampered amount:", tamperedAmount.toString());

console.log("\nThe signatures were created for:");
console.log("Amount:", originalAmount.toString());

console.log("\nWe will submit those same signatures with:");
console.log("Amount:", tamperedAmount.toString());

console.log(
  "\nExpected result: CONTRACT REJECTS THE CERTIFICATE",
);

try {
  const hash = await walletClient.writeContract({
    address: certificateAddress,
    abi,
    functionName: "verifyCertificate",
    args: [
      jobId,
      BigInt(chainId),
      commerce,
      transactionHash,
      recipient,
      tamperedAmount,
      evidenceHash,
      [
        originalSignature1,
        originalSignature2,
      ],
    ],
  });

  console.log("\nUNEXPECTED: transaction was submitted.");
  console.log("Transaction:", hash);

  const receipt =
    await publicClient.waitForTransactionReceipt({
      hash,
    });

  console.log("Transaction status:", receipt.status);

  throw new Error(
    "SECURITY TEST FAILED: tampered evidence was accepted.",
  );
} catch (error) {
  const message =
    error?.shortMessage ||
    error?.message ||
    String(error);

  console.log("\nContract rejected tampered evidence.");
  console.log("Revert:", message);

  console.log("\n=================================");
  console.log("TAMPER TEST PASSED");
  console.log("=================================");
  console.log(
    "Original signatures could not authorize",
  );
  console.log(
    "a certificate containing altered evidence.",
  );
  console.log("=================================");
}
