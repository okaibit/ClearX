import type { AgentAction, PolicyResult } from "./policy";

export type AuditEvent = {
  id: string;
  timestamp: string;
  agent: string;
  action: AgentAction;
  decision: PolicyResult["decision"];
  reason: string;
  checks: PolicyResult["checks"];
};

export function createAuditEvent(
  agent: string,
  action: AgentAction,
  result: PolicyResult,
): AuditEvent {
  return {
    id: crypto.randomUUID(),
    timestamp: new Date().toISOString(),
    agent,
    action,
    decision: result.decision,
    reason: result.reason,
    checks: result.checks,
  };
}
