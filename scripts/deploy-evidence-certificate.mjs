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

const envPath = path.join(root, ".env.local");

if (fs.existsSync(envPath)) {
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

const artifactPath = path.join(
  root,
  "artifacts",
  "ClearXEvidenceCertificate.json",
);

if (!fs.existsSync(artifactPath)) {
  throw new Error(
    "Missing artifacts/ClearXEvidenceCertificate.json. Compile contracts first.",
  );
}

const artifact = JSON.parse(
  fs.readFileSync(artifactPath, "utf8"),
);

const chainId = await publicClient.getChainId();

console.log("=================================");
console.log("CLEARX EVIDENCE CERTIFICATE");
console.log("DEPLOYMENT");
console.log("=================================");
console.log("Deployer:", executor.address);
console.log("Approver #2:", approver2.address);
console.log("Chain ID:", chainId);

const balance = await publicClient.getBalance({
  address: executor.address,
});

console.log("Balance:", balance.toString());

if (balance === 0n) {
  throw new Error(
    "Deployer has zero native-token balance.",
  );
}

const hash = await walletClient.deployContract({
  abi: artifact.abi,
  bytecode: artifact.bytecode,
  args: [
    [executor.address, approver2.address],
    2n,
  ],
});

console.log("\nDeployment transaction:");
console.log(hash);

const receipt =
  await publicClient.waitForTransactionReceipt({
    hash,
  });

if (!receipt.contractAddress) {
  throw new Error(
    "Certificate deployment produced no contract address.",
  );
}

console.log("\nCertificate contract:");
console.log(receipt.contractAddress);

const deploymentPath = path.join(
  root,
  "deployments",
  "xlayer-evidence-certificate.json",
);

const deployment = {
  network: "X Layer Testnet",
  chainId,
  contract: {
    name: "ClearXEvidenceCertificate",
    address: receipt.contractAddress,
    transactionHash: hash,
    approvers: [
      executor.address,
      approver2.address,
    ],
    threshold: 2,
  },
  deployedAt: new Date().toISOString(),
};

fs.writeFileSync(
  deploymentPath,
  JSON.stringify(deployment, null, 2),
);

console.log("\nSaved:");
console.log(deploymentPath);

console.log("\n=================================");
console.log("CERTIFICATE DEPLOYMENT COMPLETE");
console.log("=================================");
console.log(
  JSON.stringify(deployment, null, 2),
);
