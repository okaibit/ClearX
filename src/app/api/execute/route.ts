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

    // First live execution is deliberately a tiny native OKB transfer.
    const amount = parseEther("0.000001");

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

    return NextResponse.json({
      ...result,
      execution: "BROADCASTED",
      executor: account.address,
      network: "X Layer Testnet",
      chainId: 1952,
      broadcasted: true,
      transactionHash: hash,
      recipient: TESTNET_EXECUTION_RECIPIENT,
      value: "0.000001 OKB",
      message:
        "ClearX approved the action and broadcast the testnet transaction on X Layer.",
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
