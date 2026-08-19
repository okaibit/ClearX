import "dotenv/config";

import fs from "node:fs";
import path from "node:path";

import {
  createPublicClient,
  createWalletClient,
  http,
} from "viem";

import {
  privateKeyToAccount,
} from "viem/accounts";

import {
  recoverTypedDataAddress,
} from "viem";

const root = process.cwd();

function loadEnv() {
  const envPath = path.join(root, ".env.local");

  if (!fs.existsSync(envPath)) {
    throw new Error("Missing .env.local");
  }

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
    const key = trimmed.slice(0, index).trim();
    const value = trimmed.slice(index + 1).trim();

    process.env[key] = value;
  }
}

loadEnv();

const rpcUrl =
  process.env.X_LAYER_TESTNET_RPC_URL ||
  process.env.X_LAYER_RPC_URL;

const privateKey = process.env.CLEARX_EXECUTOR_PRIVATE_KEY;
const approver2PrivateKey =
  process.env.CLEARX_APPROVER2_PRIVATE_KEY;

if (!rpcUrl) {
  throw new Error("Missing X_LAYER_TESTNET_RPC_URL");
}

if (!privateKey) {
  throw new Error("Missing CLEARX_EXECUTOR_PRIVATE_KEY");
}

if (!approver2PrivateKey) {
  throw new Error("Missing CLEARX_APPROVER2_PRIVATE_KEY");
}

const executor = privateKeyToAccount(
  privateKey.startsWith("0x")
    ? privateKey
    : `0x${privateKey}`,
);

const approver2 = privateKeyToAccount(
  approver2PrivateKey.startsWith("0x")
    ? approver2PrivateKey
    : `0x${approver2PrivateKey}`,
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

const artifactPath = path.join(
  root,
  "artifacts",
  "ClearXEvidenceCertificate.json",
);

if (!fs.existsSync(artifactPath)) {
  throw new Error(
    `Missing artifact: ${artifactPath}. Run node scripts/compile-contracts.mjs first.`,
  );
}

const certificateArtifact = JSON.parse(
  fs.readFileSync(artifactPath, "utf8"),
);

const abi = certificateArtifact.abi;

console.log("=================================");
console.log("CLEARX EVIDENCE CERTIFICATE TEST");
console.log("=================================");
console.log("Executor:", executor.address);
console.log("Approver #2:", approver2.address);

const chainId = await publicClient.getChainId();

console.log("Chain ID:", chainId);

const commerce =
  "0x1de079b6db054b6679eea2575385a9fb2360647c";

const jobId = 5n;

const transactionHash =
  "0xc50a2c2abcb0a434ce2452475d8669aa982e39e690369d1220ce860904f5167c";

const recipient =
  "0xD6aa751524A94161eAdfF44047266Fa8586F7A77";

const amount = 1000000n;

const evidenceHash =
  "0x2222222222222222222222222222222222222222222222222222222222222222";

const domain = {
  name: "ClearX Evidence Certificate",
  version: "1",
  chainId,
  verifyingContract: certificateAddress,
};

const types = {
  EvidenceCertificate: [
    { name: "jobId", type: "uint256" },
    { name: "chainId", type: "uint256" },
    { name: "commerce", type: "address" },
    { name: "transactionHash", type: "bytes32" },
    { name: "recipient", type: "address" },
    { name: "amount", type: "uint256" },
    { name: "evidenceHash", type: "bytes32" },
  ],
};

const message = {
  jobId,
  chainId: BigInt(chainId),
  commerce,
  transactionHash,
  recipient,
  amount,
  evidenceHash,
};

console.log("\nCertificate payload:");
console.log("Job ID:", jobId.toString());
console.log("Chain ID:", chainId);
console.log("Commerce:", commerce);
console.log("Transaction:", transactionHash);
console.log("Recipient:", recipient);
console.log("Amount:", amount.toString());
console.log("Evidence hash:", evidenceHash);

console.log("\nGenerating EIP-712 signatures...");

const signature1 = await executor.signTypedData({
  domain,
  types,
  primaryType: "EvidenceCertificate",
  message,
});

const signature2 = await approver2.signTypedData({
  domain,
  types,
  primaryType: "EvidenceCertificate",
  message,
});

console.log("Approver #1 signature generated.");
console.log("Approver #2 signature generated.");

console.log("\nRecovering signer addresses...");

const recovered1 = await recoverTypedDataAddress({
  domain,
  types,
  primaryType: "EvidenceCertificate",
  message,
  signature: signature1,
});

const recovered2 = await recoverTypedDataAddress({
  domain,
  types,
  primaryType: "EvidenceCertificate",
  message,
  signature: signature2,
});

console.log("Recovered #1:", recovered1);
console.log("Recovered #2:", recovered2);

if (
  recovered1.toLowerCase() !== executor.address.toLowerCase()
) {
  throw new Error(
    "Approver #1 signature recovery does not match executor.",
  );
}

if (
  recovered2.toLowerCase() !== approver2.address.toLowerCase()
) {
  throw new Error(
    "Approver #2 signature recovery does not match approver #2.",
  );
}

console.log("Signature recovery PASSED.");

const signatures = [
  {
    address: recovered1,
    signature: signature1,
  },
  {
    address: recovered2,
    signature: signature2,
  },
].sort((a, b) =>
  a.address.toLowerCase().localeCompare(
    b.address.toLowerCase(),
  ),
);

console.log("\nSignature order required by contract:");

for (const [index, item] of signatures.entries()) {
  console.log(
    `Signer ${index + 1}: ${item.address}`,
  );
}

console.log("\nChecking certificate state before verification...");

const certificateId =
  await publicClient.readContract({
    address: certificateAddress,
    abi,
    functionName: "certificateDigest",
    args: [
      jobId,
      BigInt(chainId),
      commerce,
      transactionHash,
      recipient,
      amount,
      evidenceHash,
    ],
  });

const alreadyVerified =
  await publicClient.readContract({
    address: certificateAddress,
    abi,
    functionName: "certificateVerified",
    args: [certificateId],
  });

console.log("Certificate ID:", certificateId);
console.log("Already verified:", alreadyVerified);

if (alreadyVerified) {
  throw new Error(
    "This certificate has already been verified on-chain.",
  );
}

console.log("\nSubmitting 2-of-2 certificate verification on-chain...");

const verificationHash =
  await walletClient.writeContract({
    address: certificateAddress,
    abi,
    functionName: "verifyCertificate",
    args: [
      jobId,
      BigInt(chainId),
      commerce,
      transactionHash,
      recipient,
      amount,
      evidenceHash,
      signatures.map((item) => item.signature),
    ],
  });

console.log("Verification transaction:", verificationHash);

const verificationReceipt =
  await publicClient.waitForTransactionReceipt({
    hash: verificationHash,
  });

console.log("Transaction status:", verificationReceipt.status);
console.log(
  "Block number:",
  verificationReceipt.blockNumber.toString(),
);

if (verificationReceipt.status !== "success") {
  throw new Error(
    "Certificate verification transaction failed.",
  );
}

const verified =
  await publicClient.readContract({
    address: certificateAddress,
    abi,
    functionName: "certificateVerified",
    args: [certificateId],
  });

console.log("\n=================================");
console.log("CERTIFICATE VERIFICATION RESULT");
console.log("=================================");
console.log("Certificate ID:", certificateId);
console.log("On-chain verified:", verified);
console.log("Verification tx:", verificationHash);

if (!verified) {
  throw new Error(
    "Certificate transaction succeeded but certificateVerified is false.",
  );
}

console.log("\n=================================");
console.log("CRYPTOGRAPHIC CERTIFICATE PASSED");
console.log("=================================");
console.log(
  "Two authorized EIP-712 signatures were recovered,",
);
console.log(
  "submitted in deterministic signer order,",
);
console.log(
  "and independently verified on-chain.",
);
console.log("=================================");
