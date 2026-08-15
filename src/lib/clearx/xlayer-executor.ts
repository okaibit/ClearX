import {
  createPublicClient,
  createWalletClient,
  http,
  type Hex,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { xLayerTestnet } from "./xlayer";

function getPrivateKey(): Hex {
  const value = process.env.CLEARX_EXECUTOR_PRIVATE_KEY;

  if (!value) {
    throw new Error(
      "CLEARX_EXECUTOR_PRIVATE_KEY is not configured. Add it to .env.local.",
    );
  }

  if (!/^0x[0-9a-fA-F]{64}$/.test(value)) {
    throw new Error(
      "CLEARX_EXECUTOR_PRIVATE_KEY must be a 32-byte hex private key.",
    );
  }

  return value as Hex;
}

export function getXLayerExecutor() {
  const account = privateKeyToAccount(getPrivateKey());

  const walletClient = createWalletClient({
    account,
    chain: xLayerTestnet,
    transport: http(),
  });

  const publicClient = createPublicClient({
    chain: xLayerTestnet,
    transport: http(),
  });

  return {
    account,
    walletClient,
    publicClient,
  };
}
