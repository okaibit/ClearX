import { NextResponse } from "next/server";
import { executeThroughClearX } from "@/lib/clearx/execution";

export async function POST(request: Request) {
  try {
    const body = await request.json();

    if (!body?.agent || !body?.action) {
      return NextResponse.json(
        { error: "agent and action are required" },
        { status: 400 },
      );
    }

    const result = executeThroughClearX(body.agent, body.action);

    return NextResponse.json(result);
  } catch {
    return NextResponse.json(
      { error: "Invalid execution request" },
      { status: 400 },
    );
  }
}
