"use client";

import { useEffect, useState } from "react";
import { evaluateAction } from "@/lib/clearx/policy";
import { createAuditEvent } from "@/lib/clearx/audit";

type Theme = "light" | "dark";

type AIAnalysis = {
  risk: "LOW" | "MEDIUM" | "HIGH";
  recommendation: "APPROVE" | "REVIEW" | "BLOCK";
  summary: string;
  signals: string[];
};

type ExecutionResult = {
  execution?: string;
  decision?: string;
  transactionHash?: string;
  message?: string;
  error?: string;
  executor?: string;
  network?: string;
  chainId?: number;
  recipient?: string;
  value?: string;
  verifiedOnchain?: boolean;
 failureDemo?: boolean;
  failureMode?: boolean;
 settlementStatus?: "CLEARED" | "HELD";
  blockNumber?: string;
  settlement?: {
    protocol?: string;
    jobId?: string;
    budget?: string;
    verifiedBudget?: string;
    paymentToken?: string;
    evaluator?: string;
    provider?: string;
    finalStatus?: number;
    completed?: boolean;
    evidenceHash?: string;
  };
  evidence?: {
    verified?: boolean;
    reason?: string;
    checks?: Array<{
      name: string;
      status: "PASSED" | "FAILED";
      expected: string;
      observed: string;
    }>;
    blockchain?: {
      transactionHash?: string;
      blockNumber?: string;
      token?: string;
      from?: string;
      to?: string;
      amount?: string;
    };
  };
  transactions?: Array<{
    step: string;
    hash: string;
    blockNumber: string;
  }>;
};

const EXECUTOR =
  "0xD6aa751524A94161eAdfF44047266Fa8586F7A77";

function short(value?: string, start = 8, end = 6) {
  if (!value) return "—";
  if (value.length <= start + end + 3) return value;
  return `${value.slice(0, start)}...${value.slice(-end)}`;
}

export default function Home() {
  const [theme, setTheme] = useState<Theme>("dark");
  const [amount, setAmount] = useState(0.01);
  const [recipient, setRecipient] = useState(EXECUTOR);
  const [executing, setExecuting] = useState(false);
  const [failureDemo, setFailureDemo] = useState(false);
  const [executionProgress, setExecutionProgress] = useState(0);
  const [executionResult, setExecutionResult] =
    useState<ExecutionResult | null>(null);
  const [aiAnalysis, setAiAnalysis] =
    useState<AIAnalysis | null>(null);
  const [aiAnalyzing, setAiAnalyzing] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [auditEvent, setAuditEvent] = useState<
    ReturnType<typeof createAuditEvent> | null
  >(null);

  const action = {
    type: "TRANSFER" as const,
    amount,
    asset: "OKB",
    recipient,
    network: "X Layer",
  };

  const decision = evaluateAction(action);

  useEffect(() => {
    const saved = localStorage.getItem("clearx-theme") as Theme | null;
    const next =
      saved ??
      (window.matchMedia("(prefers-color-scheme: dark)").matches
        ? "dark"
        : "light");

    setTheme(next);
    document.documentElement.dataset.theme = next;
  }, []);

  useEffect(() => {
    setAuditEvent(
      createAuditEvent("ClearX Demo Agent", action, decision),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [amount, recipient]);

  const toggleTheme = () => {
    const next = theme === "dark" ? "light" : "dark";
    setTheme(next);
    localStorage.setItem("clearx-theme", next);
    document.documentElement.dataset.theme = next;
  };

  const runAIAnalysis = async () => {
    setAiAnalyzing(true);
    setAiError(null);

    try {
      const response = await fetch("/api/ai-analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          agent: "ClearX Demo Agent",
          action,
          policy: decision,
          failureDemo,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error ?? "AI analysis failed.");
      }

      setAiAnalysis(data.analysis);
    } catch (error) {
      setAiAnalysis(null);
      setAiError(
        error instanceof Error
          ? error.message
          : "AI analysis failed.",
      );
    } finally {
      setAiAnalyzing(false);
    }
  };

  const handleExecute = async () => {
    if (decision.decision !== "APPROVE") return;

    setExecuting(true);
    setExecutionResult(null);
    setExecutionProgress(0);

    const progressTimer = window.setInterval(() => {
      setExecutionProgress((current) =>
        current < 3 ? current + 1 : current,
      );
    }, 2500);

    try {
      const response = await fetch("/api/execute", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          agent: "ClearX Demo Agent",
          action,
          failureDemo,
        }),
      });

      const data = await response.json();

      setExecutionResult(
        response.ok
          ? data
          : { error: data.error ?? "Execution request failed." },
      );
    } catch (error) {
      setExecutionResult({
        error:
          error instanceof Error
            ? error.message
            : "Execution request failed.",
      });
    } finally {
      window.clearInterval(progressTimer);
      setExecutionProgress(3);
      setExecuting(false);
    }
  };

  const verified =
    executionResult?.execution === "VERIFIED_ONCHAIN" &&
    executionResult.verifiedOnchain === true &&
    executionResult.evidence?.verified === true &&
    executionResult.settlement?.completed === true;

  const settlementHeld =
    executionResult?.settlementStatus === "HELD" ||
    (executionResult?.evidence?.verified === false &&
      (executionResult?.failureDemo === true || executionResult?.failureMode === true));

  return (
    <main className="min-h-screen bg-[var(--background)] text-[var(--foreground)]">
      <nav className="mx-auto flex h-20 max-w-7xl items-center justify-between px-6 lg:px-8">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[var(--foreground)] text-sm font-bold text-[var(--background)]">
            C
          </div>
          <span className="text-lg font-semibold tracking-tight">
            ClearX
          </span>
        </div>

        <div className="hidden items-center gap-8 text-sm text-[var(--muted)] md:flex">
          <a href="#console" className="transition hover:text-[var(--foreground)]">
            Console
          </a>
          <a href="#receipt" className="transition hover:text-[var(--foreground)]">
            Receipt
          </a>
          <a href="#architecture" className="transition hover:text-[var(--foreground)]">
            Architecture
          </a>
        </div>

        <button
          onClick={toggleTheme}
          className="flex h-10 w-10 items-center justify-center rounded-full border border-[var(--border)] bg-[var(--surface)] text-sm"
          aria-label="Toggle theme"
        >
          {theme === "dark" ? "☼" : "☾"}
        </button>
      </nav>

      <section className="relative mx-auto max-w-7xl px-6 pb-20 pt-20 text-center lg:px-8 lg:pt-28">
        <div className="pointer-events-none absolute left-1/2 top-0 h-[420px] w-[700px] -translate-x-1/2 rounded-full bg-blue-500/10 blur-[120px]" />

        <div className="relative">
          <div className="mx-auto mb-7 flex w-fit items-center gap-2 rounded-full border border-[var(--border)] bg-[var(--surface)] px-4 py-2 text-xs text-[var(--muted)]">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
            Verifiable agent obligations
          </div>

          <h1 className="mx-auto max-w-5xl text-5xl font-semibold tracking-[-0.055em] sm:text-6xl lg:text-8xl">
            Agents can execute.
            <br />
            <span className="text-[var(--muted)]">
              ClearX makes it provable.
            </span>
          </h1>

          <p className="mx-auto mt-8 max-w-2xl text-base leading-7 text-[var(--muted)] sm:text-lg">
            ClearX turns an agent action into an enforceable obligation,
            verifies the resulting blockchain evidence, and clears
            settlement only when the evidence satisfies the obligation.
          </p>
        </div>
      </section>

      <section
        id="console"
        className="mx-auto max-w-7xl px-6 pb-24 lg:px-8"
      >
        <div className="overflow-hidden rounded-[2rem] border border-[var(--border)] bg-[var(--surface)] shadow-2xl shadow-black/10">
          <div className="flex items-center justify-between border-b border-[var(--border)] px-6 py-5">
            <div>
              <p className="text-xs uppercase tracking-[0.18em] text-[var(--muted)]">
                ClearX clearing console
              </p>
              <h2 className="mt-1 text-lg font-semibold">
                Agent obligation
              </h2>
            </div>

            <div className="flex items-center gap-2 rounded-full border border-[var(--border)] px-3 py-1.5 text-xs text-[var(--muted)]">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
              X Layer Testnet
            </div>
          </div>

          <div className="grid lg:grid-cols-[0.9fr_1.1fr]">
            <div className="border-b border-[var(--border)] p-7 lg:border-b-0 lg:border-r lg:p-10">
              <p className="text-xs uppercase tracking-[0.18em] text-[var(--muted)]">
                Obligation
              </p>

              <div className="mt-6 rounded-2xl border border-[var(--border)] bg-[var(--background)] p-5">
                <p className="text-xs uppercase tracking-[0.14em] text-[var(--muted)]">
                  Agent instruction
                </p>
                <p className="mt-2 text-sm leading-7">
                  &ldquo;Pay the provider{" "}
                  <span className="font-semibold">{amount} OKB</span> on{" "}
                  <span className="font-semibold">X Layer</span> once the
                  job is verified.&rdquo;
                </p>
              </div>

              <div className="mt-6 space-y-4">
                <label className="block">
                  <span className="text-xs text-[var(--muted)]">
                    Transfer amount
                  </span>
                  <div className="mt-2 flex items-center rounded-xl border border-[var(--border)] bg-[var(--background)] px-4">
                    <input
                      type="number"
                      min="0.000001"
                      step="0.000001"
                      value={amount}
                      onChange={(e) => setAmount(Number(e.target.value))}
                      className="w-full bg-transparent py-3 text-sm outline-none"
                    />
                    <span className="text-sm text-[var(--muted)]">
                      OKB
                    </span>
                  </div>
                </label>

                <div>
                  <span className="text-xs text-[var(--muted)]">
                    Recipient
                  </span>
                  <div className="mt-2 rounded-xl border border-[var(--border)] bg-[var(--background)] px-4 py-3 font-mono text-xs">
                    {short(recipient, 12, 10)}
                  </div>
                </div>
              </div>

              <div className="mt-7 grid grid-cols-2 gap-3">
                <div className="rounded-xl border border-[var(--border)] p-4">
                  <p className="text-xs text-[var(--muted)]">Network</p>
                  <p className="mt-1 text-sm font-medium">X Layer</p>
                </div>

                <div className="rounded-xl border border-[var(--border)] p-4">
                  <p className="text-xs text-[var(--muted)]">Agent</p>
                  <p className="mt-1 text-sm font-medium">
                    ClearX Demo Agent
                  </p>
                </div>
              </div>
            </div>

            <div className="p-7 lg:p-10">
              <div className="flex items-start justify-between gap-5">
                <div>
                  <p className="text-xs uppercase tracking-[0.18em] text-[var(--muted)]">
                    Compiled policy
                  </p>
                  <h3 className="mt-2 text-2xl font-semibold">
                    Execution conditions
                  </h3>
                </div>

                <div
                  className={`rounded-full px-3 py-1.5 text-xs font-semibold ${
                    decision.decision === "APPROVE"
                      ? "bg-emerald-500/10 text-emerald-500"
                      : "bg-red-500/10 text-red-500"
                  }`}
                >
                  {decision.decision}
                </div>
              </div>

              <div className="mt-7 space-y-3">
                {decision.checks.map((check) => (
                  <div
                    key={check.name}
                    className="flex items-center justify-between rounded-xl border border-[var(--border)] bg-[var(--background)] px-4 py-3"
                  >
                    <div>
                      <p className="text-sm font-medium">{check.name}</p>
                      <p className="mt-1 text-xs text-[var(--muted)]">
                        {check.reason}
                      </p>
                    </div>

                    <span
                      className={`text-xs font-semibold ${
                        check.status === "PASSED"
                          ? "text-emerald-500"
                          : "text-red-500"
                      }`}
                    >
                      {check.status === "PASSED" ? "✓ Passed" : "× Blocked"}
                    </span>
                  </div>
                ))}
              </div>

              <div className="mt-6 flex items-center justify-between rounded-xl border border-[var(--border)] bg-[var(--background)] px-4 py-3">
                <div>
                  <p className="text-sm font-medium">Failure Demo</p>
                  <p className="mt-1 text-xs text-[var(--muted)]">
                    {failureDemo
                      ? "Simulate an evidence mismatch and hold settlement."
                      : "Run the normal execution and settlement flow."}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => setFailureDemo((value) => !value)}
                  aria-pressed={failureDemo}
                  className={`relative h-6 w-11 rounded-full transition ${
                    failureDemo
                      ? "bg-red-500"
                      : "bg-[var(--muted)]"
                  }`}
                >
                  <span
                    className={`absolute top-1 h-4 w-4 rounded-full bg-white transition ${
                      failureDemo ? "left-6" : "left-1"
                    }`}
                  />
                </button>
              </div>

              <div className="mt-6 rounded-xl border border-[var(--border)] bg-[var(--background)] p-5">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  

                  <button
                    type="button"
                    onClick={runAIAnalysis}
                    disabled={aiAnalyzing}
                    className="rounded-xl border border-[var(--border)] px-4 py-2.5 text-xs font-semibold transition hover:bg-[var(--surface)] disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {aiAnalyzing ? "Analyzing..." : "Run AI analysis"}
                  </button>
                </div>

              </div>

              {executing && (
                <div className="mt-4 rounded-xl border border-[var(--border)] bg-[var(--background)] px-4 py-4">
                  <div className="mb-3 flex items-center justify-between">
                    <p className="text-sm font-medium">
                      Processing on X Layer Testnet
                    </p>
                    <span className="text-xs text-[var(--muted)]">
                      Please wait
                    </span>
                  </div>

                  <div className="space-y-2 text-xs">
                    {[
                      "Preparing commerce job",
                      "Processing X Layer transactions",
                      "Verifying blockchain evidence",
                      "Finalizing settlement",
                    ].map((step, index) => (
                      <div
                        key={step}
                        className="flex items-center gap-2"
                      >
                        <span
                          className={
                            index <= executionProgress
                              ? "text-emerald-500"
                              : "text-[var(--muted)]"
                          }
                        >
                          {index <= executionProgress ? "✓" : "○"}
                        </span>
                        <span
                          className={
                            index <= executionProgress
                              ? "text-[var(--foreground)]"
                              : "text-[var(--muted)]"
                          }
                        >
                          {step}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <button
                onClick={handleExecute}
                disabled={decision.decision !== "APPROVE" || executing}
                className="mt-6 w-full rounded-xl bg-[var(--foreground)] py-3.5 text-sm font-semibold text-[var(--background)] transition hover:opacity-80 disabled:cursor-not-allowed disabled:opacity-30"
              >
                {executing
                  ? "Clearing obligation on X Layer..."
                  : failureDemo ? "Simulate evidence failure" : "Execute & clear obligation"}
              </button>
            </div>
          </div>
        </div>
      </section>

      <section
        id="groq-analysis"
        className="mx-auto max-w-7xl px-6 pb-24 lg:px-8"
      >
        <div className="overflow-hidden rounded-[2rem] border border-[var(--border)] bg-[var(--surface)] shadow-2xl shadow-black/10">
          <div className="border-b border-[var(--border)] px-6 py-5">
            <p className="text-xs uppercase tracking-[0.18em] text-[var(--muted)]">
              Groq AI analysis
            </p>
            <h2 className="mt-1 text-lg font-semibold">
              Advisory assessment
            </h2>
          </div>

          <div className="p-7 lg:p-10">
            <div className="rounded-2xl border border-[var(--border)] bg-[var(--background)] p-5">
              {aiAnalyzing ? (
                <div className="text-sm text-[var(--muted)]">
                  Analyzing obligation...
                </div>
              ) : aiError ? (
                <div className="text-sm text-red-500">
                  AI analysis unavailable: {aiError}
                </div>
              ) : aiAnalysis ? (
                <>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="rounded-xl border border-[var(--border)] p-4">
                      <p className="text-xs text-[var(--muted)]">Risk</p>
                      <p
                        className={`mt-1 text-sm font-semibold ${
                          aiAnalysis.risk === "LOW"
                            ? "text-emerald-500"
                            : aiAnalysis.risk === "MEDIUM"
                              ? "text-amber-500"
                              : "text-red-500"
                        }`}
                      >
                        {aiAnalysis.risk}
                      </p>
                    </div>

                    <div className="rounded-xl border border-[var(--border)] p-4">
                      <p className="text-xs text-[var(--muted)]">
                        Recommendation
                      </p>
                      <p className="mt-1 text-sm font-semibold">
                        {aiAnalysis.recommendation}
                      </p>
                    </div>
                  </div>

                  <div className="mt-4 rounded-xl border border-[var(--border)] p-4">
                    <p className="text-xs text-[var(--muted)]">
                      Assessment
                    </p>
                    <p className="mt-2 text-sm leading-6">
                      {aiAnalysis.summary}
                    </p>
                  </div>

                  {aiAnalysis.signals.length > 0 && (
                    <div className="mt-4">
                      <p className="text-xs text-[var(--muted)]">
                        AI signals
                      </p>

                      <div className="mt-2 space-y-2">
                        {aiAnalysis.signals.map((signal, index) => (
                          <div
                            key={`${signal}-${index}`}
                            className="flex items-start gap-2 text-xs text-[var(--muted)]"
                          >
                            <span className="mt-0.5 text-emerald-500">
                              ✓
                            </span>
                            <span>{signal}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <p className="mt-4 text-[10px] leading-4 text-[var(--muted)]">
                    AI provides advisory risk analysis before execution. Deterministic
                    policy and independent blockchain evidence control settlement.
                  </p>
                </>
              ) : (
                <div className="text-sm text-[var(--muted)]">
                  Run AI analysis to generate an advisory assessment.
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      {executionResult && (
        <section
          id="receipt"
          className="mx-auto max-w-7xl px-6 pb-24 lg:px-8"
        >
          <div
            className={`overflow-hidden rounded-[2rem] border ${
              verified
                ? "border-emerald-500/20"
                : executionResult.error
                  ? "border-red-500/20"
                  : "border-[var(--border)]"
            } bg-[var(--surface)]`}
          >
            <div className="border-b border-[var(--border)] p-7 lg:p-10">
              <div className="flex flex-col justify-between gap-6 sm:flex-row sm:items-center">
                <div>
                  <p className="text-xs uppercase tracking-[0.2em] text-[var(--muted)]">
                    ClearX clearing receipt
                  </p>

                  <h2
                    className={`mt-3 text-3xl font-semibold tracking-tight ${
                      verified
                        ? "text-emerald-500"
                        : settlementHeld
                          ? "text-amber-500"
                          : executionResult.error
                            ? "text-red-500"
                            : ""
                    }`}
                  >
                    {verified
                      ? "VERIFIED ONCHAIN"
                      : settlementHeld
                        ? "SETTLEMENT HELD"
                        : executionResult.error
                          ? "Execution failed"
                          : "Settlement processing"}
                  </h2>

                  <p className="mt-3 max-w-2xl text-sm leading-6 text-[var(--muted)]">
                    {settlementHeld
                      ? "ClearX detected an evidence mismatch. Settlement was held and no evaluator approval was broadcast."
                      : executionResult.message ??
                        executionResult.error}
                  </p>
                </div>

                {verified && (
                  <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-emerald-500/10 text-3xl text-emerald-500">
                    ✓
                  </div>
                )}

                {settlementHeld && (
                  <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-amber-500/10 text-3xl text-amber-500">
                    !
                  </div>
                )}
              </div>
            </div>

            {!executionResult.error && (
              <div className="p-7 lg:p-10">
                <div className="grid gap-3 md:grid-cols-4">
                  {[
                    ["01", "Policy", executionResult.decision === "APPROVE" ? "Satisfied" : "Blocked"],
                    ["02", "Job", executionResult.settlement?.jobId ? `#${executionResult.settlement.jobId}` : "Created"],
                    ["03", "Evidence", executionResult.evidence?.verified ? "Verified" : settlementHeld ? "Failed" : "Pending"],
                    ["04", "Settlement", executionResult.settlement?.completed ? "Completed" : settlementHeld ? "Held" : "Pending"],
                  ].map(([number, title, value]) => (
                    <div
                      key={number}
                      className="rounded-2xl border border-[var(--border)] bg-[var(--background)] p-5"
                    >
                      <p className="text-xs text-[var(--muted)]">
                        {number}
                      </p>
                      <p className="mt-5 text-xs uppercase tracking-wider text-[var(--muted)]">
                        {title}
                      </p>
                      <p className="mt-1 text-lg font-semibold">
                        {value}
                      </p>
                    </div>
                  ))}
                </div>

                <div className="mt-10 grid gap-8 lg:grid-cols-2">
                  <div>
                    <p className="text-xs uppercase tracking-[0.18em] text-[var(--muted)]">
                      Blockchain evidence
                    </p>

                    <div className="mt-4 space-y-3">
                      {executionResult.evidence?.checks?.map((check) => (
                        <div
                          key={check.name}
                          className="flex items-center justify-between rounded-xl border border-[var(--border)] px-4 py-3"
                        >
                          <div>
                            <p className="text-sm font-medium">
                              {check.name}
                            </p>
                            <p className="mt-1 break-all font-mono text-[11px] text-[var(--muted)]">
                              {check.observed}
                            </p>
                          </div>

                          <span className="text-xs font-semibold text-emerald-500">
                            {check.status === "PASSED" ? "✓ Passed" : "× Failed"}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div>
                    <p className="text-xs uppercase tracking-[0.18em] text-[var(--muted)]">
                      Settlement
                    </p>

                    <div className="mt-4 grid gap-3 sm:grid-cols-2">
                      <div className="rounded-xl border border-[var(--border)] p-4">
                        <p className="text-xs text-[var(--muted)]">
                          ERC-8183 job
                        </p>
                        <p className="mt-1 font-mono text-sm">
                          #{executionResult.settlement?.jobId ?? "—"}
                        </p>
                      </div>

                      <div className="rounded-xl border border-[var(--border)] p-4">
                        <p className="text-xs text-[var(--muted)]">
                          Settlement
                        </p>
                        <p className={`mt-1 text-sm font-semibold ${
                          executionResult.settlement?.completed
                            ? "text-emerald-500"
                            : settlementHeld
                              ? "text-amber-500"
                              : "text-[var(--muted)]"
                        }`}>
                          {executionResult.settlement?.completed
                            ? "Completed"
                            : settlementHeld
                              ? "HELD — Not cleared"
                              : "Pending"}
                        </p>
                      </div>

                      <div className="rounded-xl border border-[var(--border)] p-4 sm:col-span-2">
                        <p className="text-xs text-[var(--muted)]">
                          Provider
                        </p>
                        <p className="mt-1 break-all font-mono text-xs">
                          {executionResult.settlement?.provider ?? "—"}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                {!settlementHeld && executionResult.transactionHash && (
                <div className="mt-10 rounded-2xl border border-[var(--border)] bg-[var(--background)] p-5">
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <p className="text-xs uppercase tracking-[0.16em] text-[var(--muted)]">
                        Settlement transaction
                      </p>
                      <p className="mt-2 font-mono text-xs break-all">
                        {executionResult.transactionHash}
                      </p>
                    </div>

                    <span className="shrink-0 text-xs font-semibold text-emerald-500">
                      Confirmed
                    </span>
                  </div>

                  <div className="mt-5 grid gap-3 sm:grid-cols-3">
                    <div>
                      <p className="text-xs text-[var(--muted)]">Block</p>
                      <p className="mt-1 font-mono text-sm">
                        {executionResult.blockNumber ?? "—"}
                      </p>
                    </div>

                    <div>
                      <p className="text-xs text-[var(--muted)]">Chain</p>
                      <p className="mt-1 text-sm">
                        X Layer · {executionResult.chainId}
                      </p>
                    </div>

                    <div>
                      <p className="text-xs text-[var(--muted)]">Evidence</p>
                      <p className="mt-1 text-sm font-semibold text-emerald-500">
                        Independently verified
                      </p>
                    </div>
                  </div>
                </div>

                )}

                {settlementHeld && (
                  <div className="mt-10 rounded-2xl border border-amber-500/30 bg-amber-500/5 p-5">
                    <p className="text-xs uppercase tracking-[0.16em] text-amber-500">
                      Settlement protection
                    </p>
                    <p className="mt-2 text-sm font-semibold">
                      Payment held
                    </p>
                    <p className="mt-1 text-sm leading-6 text-[var(--muted)]">
                      Independent blockchain evidence did not satisfy the obligation. No evaluator approval or settlement transaction was broadcast.
                    </p>
                  </div>
                )}

                {executionResult.transactions &&
                  executionResult.transactions.length > 0 && (
                    <div className="mt-10">
                      <p className="text-xs uppercase tracking-[0.18em] text-[var(--muted)]">
                        Onchain execution trail
                      </p>

                      <div className="mt-4 overflow-hidden rounded-2xl border border-[var(--border)]">
                        {executionResult.transactions.map((tx, index) => (
                          <div
                            key={`${tx.step}-${tx.hash}`}
                            className="flex flex-col gap-3 border-b border-[var(--border)] p-4 last:border-b-0 sm:flex-row sm:items-center sm:justify-between"
                          >
                            <div className="flex items-center gap-3">
                              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-[var(--border)] text-xs font-semibold">
                                {index + 1}
                              </span>

                              <div>
                                <p className="text-sm font-medium">
                                  {tx.step === "createJob"
                                    ? "Create ERC-8183 job"
                                    : tx.step === "setBudget"
                                      ? "Set settlement budget"
                                      : tx.step === "approve"
                                        ? "Approve payment token"
                                        : tx.step === "fund"
                                          ? "Fund job"
                                          : tx.step === "submit"
                                            ? "Submit deliverable"
                                            : tx.step === "agent.transfer"
                                              ? "Agent obligation"
                                              : tx.step === "evaluator.approve"
                                                ? "ClearX evaluator approval"
                                                : tx.step}
                                </p>
                                <p className="mt-1 break-all font-mono text-[11px] text-[var(--muted)]">
                                  {tx.hash}
                                </p>
                              </div>
                            </div>

                            <span className="text-xs font-semibold text-emerald-500">
                              Block {tx.blockNumber}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
              </div>
            )}
          </div>
        </section>
      )}

      <section
        id="architecture"
        className="mx-auto max-w-7xl px-6 pb-28 lg:px-8"
      >
        <div className="rounded-[2rem] border border-[var(--border)] bg-[var(--surface)] p-7 lg:p-10">
          <p className="text-xs uppercase tracking-[0.18em] text-[var(--muted)]">
            ClearX architecture
          </p>

          <h2 className="mt-4 max-w-3xl text-3xl font-semibold tracking-tight sm:text-4xl">
            From agent intent to provable settlement.
          </h2>

          <div className="mt-10 grid gap-3 md:grid-cols-5">
            {[
              ["01", "Obligation", "Agent action"],
              ["02", "Policy", "Executable conditions"],
              ["03", "ERC-8183", "Escrowed job"],
              ["04", "Evidence", "Blockchain proof"],
              ["05", "Settlement", "Payment cleared"],
            ].map(([number, title, body], index) => (
              <div
                key={number}
                className="relative rounded-2xl border border-[var(--border)] bg-[var(--background)] p-5"
              >
                <p className="text-xs text-[var(--muted)]">{number}</p>
                <p className="mt-6 font-semibold">{title}</p>
                <p className="mt-1 text-xs leading-5 text-[var(--muted)]">
                  {body}
                </p>

                {index < 4 && (
                  <span className="absolute -right-2 top-1/2 hidden text-[var(--muted)] md:block">
                    →
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-6 pb-28 lg:px-8">
        <div className="rounded-[2rem] border border-[var(--border)] bg-[var(--surface)] p-7 lg:p-10">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.18em] text-[var(--muted)]">
                Audit trail
              </p>
              <h2 className="mt-3 text-2xl font-semibold">
                Decision record
              </h2>
            </div>

            <span className="rounded-full border border-[var(--border)] px-3 py-1 text-xs text-[var(--muted)]">
              {auditEvent ? "Recorded" : "Waiting"}
            </span>
          </div>

          {auditEvent && (
            <>
              <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                {[
                  ["Agent", auditEvent.agent],
                  [
                    "Action",
                    `Transfer ${auditEvent.action.amount} ${auditEvent.action.asset}`,
                  ],
                  ["Decision", auditEvent.decision],
                  [
                    "Timestamp",
                    new Date(auditEvent.timestamp).toLocaleTimeString(),
                  ],
                ].map(([label, value]) => (
                  <div
                    key={label}
                    className="rounded-xl border border-[var(--border)] p-4"
                  >
                    <p className="text-xs text-[var(--muted)]">{label}</p>
                    <p className="mt-2 text-sm font-medium">{value}</p>
                  </div>
                ))}
              </div>

              <div className="mt-4 rounded-xl border border-[var(--border)] p-4">
                <p className="text-xs text-[var(--muted)]">
                  Decision reason
                </p>
                <p className="mt-2 text-sm">{auditEvent.reason}</p>
              </div>

              <div className="mt-4 rounded-xl border border-[var(--border)] p-4">
                <p className="text-xs text-[var(--muted)]">Event ID</p>
                <p className="mt-2 break-all font-mono text-xs">
                  {auditEvent.id}
                </p>
              </div>
            </>
          )}
        </div>
      </section>

      <footer className="border-t border-[var(--border)]">
        <div className="mx-auto flex max-w-7xl flex-col gap-2 px-6 py-8 text-xs text-[var(--muted)] sm:flex-row sm:items-center sm:justify-between lg:px-8">
          <span>ClearX · Verifiable agent obligations</span>
          <span>Policy → Evidence → Settlement</span>
        </div>
      </footer>
    </main>
  );
}
