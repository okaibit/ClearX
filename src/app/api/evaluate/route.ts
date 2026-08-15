import { NextResponse } from "next/server";
import { evaluateAction } from "@/lib/clearx/policy";
import { createAuditEvent } from "@/lib/clearx/audit";

export async function POST(request: Request) {
  try {
    const body = await request.json();

    if (!body?.agent || !body?.action) {
      return NextResponse.json(
        {
          error: "agent and action are required",
        },
        { status: 400 },
      );
    }

    const result = evaluateAction(body.action);

    const auditEvent = createAuditEvent(
      body.agent,
      body.action,
      result,
    );

    return NextResponse.json({
      decision: result.decision,
      reason: result.reason,
      checks: result.checks,
      auditEvent,
    });
  } catch {
    return NextResponse.json(
      {
        error: "Invalid evaluation request",
      },
      { status: 400 },
    );
  }
}
