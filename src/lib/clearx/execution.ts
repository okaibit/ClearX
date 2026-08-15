import { evaluateAction, type AgentAction } from "./policy";
import { createAuditEvent } from "./audit";

export type ExecutionResult =
  | {
      execution: "ALLOWED";
      decision: "APPROVE";
      message: string;
      auditEvent: ReturnType<typeof createAuditEvent>;
    }
  | {
      execution: "STOPPED";
      decision: "REVIEW" | "BLOCK";
      message: string;
      auditEvent: ReturnType<typeof createAuditEvent>;
    };

export function executeThroughClearX(
  agent: string,
  action: AgentAction,
): ExecutionResult {
  const result = evaluateAction(action);
  const auditEvent = createAuditEvent(agent, action, result);

  if (result.decision !== "APPROVE") {
    return {
      execution: "STOPPED",
      decision: result.decision,
      message:
        result.decision === "REVIEW"
          ? "Execution stopped. Human approval is required."
          : "Execution stopped. The action violates ClearX policy.",
      auditEvent,
    };
  }

  return {
    execution: "ALLOWED",
    decision: "APPROVE",
    message:
      "ClearX approved the action. It may proceed to the configured execution provider.",
    auditEvent,
  };
}
