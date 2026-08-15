import { NextResponse } from "next/server";
import { parseEther } from "viem";
import { executeThroughClearX } from "@/lib/clearx/execution";
import { getXLayerExecutor } from "@/lib/clearx/xlayer-executor";

const TESTNET_EXECUTION_RECIPIENT =
  "0xD6aa751524A94161eAdfF44047266Fa8586F7A77";

export async function POST(request: Request) {
  try {
    const body = await request.json();

    const agent = body?.agent;
    const action = body?.action;

    if (typeof agent !== "string" || !action) {
      return NextResponse.json(
        { error: "agent and action are required" },
        { status: 400 },
      );
    }

    const result = executeThroughClearX(agent, action);

    // REVIEW and BLOCK never reach the wallet client.
    if (result.execution === "STOPPED") {
      return NextResponse.json(result);
    }

    const { account, walletClient, publicClient } = getXLayerExecutor();

    // Native OKB execution is the currently supported X Layer execution path.
    // Reject other assets instead of pretending they were executed.
    if (action.asset !== "OKB" || action.network !== "X Layer") {
      return NextResponse.json(
        {
          error:
            "X Layer native execution currently supports OKB transfers only.",
          supportedAsset: "OKB",
          supportedNetwork: "X Layer",
        },
        { status: 400 },
      );
    }

    if (action.recipient !== account.address) {
      return NextResponse.json(
        {
          error:
            "The X Layer test executor only permits transfers to its allowlisted test recipient.",
          executor: account.address,
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

    const amount = parseEther(String(action.amount));

    const balance = await publicClient.getBalance({
      address: account.address,
    });

    if (balance <= amount) {
      return NextResponse.json(
        {
          error: "Executor wallet does not have enough X Layer Testnet OKB.",
          executor: account.address,
          network: "X Layer Testnet",
          chainId: 1952,
        },
        { status: 400 },
      );
    }

    const hash = await walletClient.sendTransaction({
      account,
      to: TESTNET_EXECUTION_RECIPIENT,
      value: amount,
    });

    const receipt = await publicClient.waitForTransactionReceipt({
      hash,
    });

    const verified = receipt.status === "success";

    return NextResponse.json({
      ...result,
      execution: verified ? "VERIFIED_ONCHAIN" : "BROADCASTED",
      executor: account.address,
      network: "X Layer Testnet",
      chainId: 1952,
      broadcasted: true,
      verifiedOnchain: verified,
      transactionHash: hash,
      blockNumber: receipt.blockNumber.toString(),
      transactionIndex: receipt.transactionIndex,
      recipient: TESTNET_EXECUTION_RECIPIENT,
      value: `${action.amount} OKB`,
      message: verified
        ? "ClearX approved the action and verified the successful transaction on X Layer Testnet."
        : "ClearX broadcast the transaction, but on-chain verification did not report success.",
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
