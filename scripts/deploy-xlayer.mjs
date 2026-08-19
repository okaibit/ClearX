import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import {
  createPublicClient,
  createWalletClient,
  http,
  parseEther,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";


const root = process.cwd();

const envPath = path.join(root, ".env.local");

if (fs.existsSync(envPath)) {
  const envText = fs.readFileSync(envPath, "utf8");

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
}

const rpcUrl =
  process.env.X_LAYER_TESTNET_RPC_URL ||
  process.env.X_LAYER_RPC_URL;

const privateKey = process.env.CLEARX_EXECUTOR_PRIVATE_KEY;

const approver2PrivateKey = process.env.CLEARX_APPROVER2_PRIVATE_KEY;

if (!rpcUrl) {
  throw new Error(
    "Missing X_LAYER_TESTNET_RPC_URL in .env.local"
  );
}

if (!privateKey) {
  throw new Error(
    "Missing CLEARX_EXECUTOR_PRIVATE_KEY in .env.local"
  );
}

if (!approver2PrivateKey) {
  throw new Error(
    "Missing CLEARX_APPROVER2_PRIVATE_KEY in .env.local (second evaluator approver)"
  );
}

const normalizedApprover2Key = approver2PrivateKey.startsWith("0x")
  ? approver2PrivateKey
  : `0x${approver2PrivateKey}`;

const approver2Account = privateKeyToAccount(normalizedApprover2Key);

const normalizedKey = privateKey.startsWith("0x")
  ? privateKey
  : `0x${privateKey}`;

const account = privateKeyToAccount(normalizedKey);

const publicClient = createPublicClient({
  transport: http(rpcUrl),
});

const walletClient = createWalletClient({
  account,
  transport: http(rpcUrl),
});

function artifact(name) {
  const file = path.join(
    root,
    "artifacts",
    `${name}.json`
  );

  if (!fs.existsSync(file)) {
    throw new Error(`Missing artifact: ${file}`);
  }

  return JSON.parse(fs.readFileSync(file, "utf8"));
}

async function deploy(name, constructorArgs = []) {
  const data = artifact(name);

  console.log(`\nDeploying ${name}...`);

  const hash = await walletClient.deployContract({
    abi: data.abi,
    bytecode: data.bytecode,
    args: constructorArgs,
  });

  console.log(`${name} deployment tx: ${hash}`);

  const receipt =
    await publicClient.waitForTransactionReceipt({
      hash,
    });

  if (!receipt.contractAddress) {
    throw new Error(
      `${name} deployment produced no contract address`
    );
  }

  console.log(
    `${name} deployed at: ${receipt.contractAddress}`
  );

  return {
    address: receipt.contractAddress,
    hash,
  };
}

const chainId = await publicClient.getChainId();
const balance = await publicClient.getBalance({
  address: account.address,
});

console.log("=================================");
console.log("CLEARX X LAYER DEPLOYMENT");
console.log("=================================");
console.log("Deployer:", account.address);
console.log("Chain ID:", chainId);
console.log("Balance:", balance.toString());

if (balance === 0n) {
  throw new Error(
    "Deployer has zero native-token balance. Fund the wallet with X Layer Testnet gas first."
  );
}

const testUSDC = await deploy("TestUSDC");

const commerce = await deploy(
  "AgenticCommerce",
  [testUSDC.address]
);

const evaluator = await deploy(
  "ClearXEvaluator",
  [commerce.address, [account.address, approver2Account.address], 2n]
);

const evidenceCertificate = await deploy(
  "ClearXEvidenceCertificate",
  [[account.address, approver2Account.address], 2n]
);

const deployment = {
  network: "X Layer Testnet",
  chainId,
  deployer: account.address,
  contracts: {
    TestUSDC: {
      address: testUSDC.address,
      transactionHash: testUSDC.hash,
    },
    AgenticCommerce: {
      address: commerce.address,
      transactionHash: commerce.hash,
    },
    ClearXEvaluator: {
      address: evaluator.address,
      transactionHash: evaluator.hash,
      approvers: [account.address, approver2Account.address],
      threshold: 2,
    },
    ClearXEvidenceCertificate: {
      address: evidenceCertificate.address,
      transactionHash: evidenceCertificate.hash,
      approvers: [account.address, approver2Account.address],
      threshold: 2,
    },
  },
  deployedAt: new Date().toISOString(),
};

fs.mkdirSync(
  path.join(root, "deployments"),
  { recursive: true }
);

const outputFile = path.join(
  root,
  "deployments",
  "xlayer-testnet.json"
);

fs.writeFileSync(
  outputFile,
  JSON.stringify(deployment, null, 2)
);

console.log("\n=================================");
console.log("DEPLOYMENT COMPLETE");
console.log("=================================");
console.log(JSON.stringify(deployment, null, 2));
console.log(`\nSaved to: ${outputFile}`);
