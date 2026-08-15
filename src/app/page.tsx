"use client";

import { useEffect, useState } from "react";
import { evaluateAction } from "@/lib/clearx/policy";

type Theme = "light" | "dark";

export default function Home() {
 const [theme, setTheme] = useState<Theme>("dark");
 const [amount, setAmount] = useState(250);
 const [recipient, setRecipient] = useState("0x7A3...91F2");

 const decision = evaluateAction({
   type: "TRANSFER",
   amount,
   asset: "USDC",
   recipient,
   network: "Base",
 });

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

 const toggleTheme = () => {
 const next = theme === "dark" ? "light" : "dark";
 setTheme(next);
 localStorage.setItem("clearx-theme", next);
 document.documentElement.dataset.theme = next;
 };

 return (
 <main className="min-h-screen overflow-hidden bg-[var(--background)] text-[var(--foreground)]">
 <nav className="mx-auto flex h-20 max-w-7xl items-center justify-between px-6 lg:px-8">
 <div className="flex items-center gap-3">
 <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[var(--foreground)] text-sm font-bold text-[var(--background)]">
 C
 </div>
 <span className="text-lg font-semibold tracking-tight">ClearX</span>
 </div>

 <div className="hidden items-center gap-8 text-sm text-[var(--muted)] md:flex">
 <a href="#how" className="transition hover:text-[var(--foreground)]">
 How it works
 </a>
 <a href="#product" className="transition hover:text-[var(--foreground)]">
 Product
 </a>
 <a href="#security" className="transition hover:text-[var(--foreground)]">
 Security
 </a>
 </div>

 <div className="flex items-center gap-3">
 <button
 onClick={toggleTheme}
 className="flex h-10 w-10 items-center justify-center rounded-full border border-[var(--border)] bg-[var(--surface)] text-sm transition hover:border-[var(--foreground)]"
 aria-label="Toggle theme"
 >
 {theme === "dark" ? " " : "☾"}
 </button>

 <button className="hidden rounded-full bg-[var(--foreground)] px-5 py-2.5 text-sm font-medium text-[var(--background)] transition hover:opacity-80 sm:block">
 Launch ClearX
 </button>
 </div>
 </nav>

 <section className="relative mx-auto max-w-7xl px-6 pb-24 pt-24 text-center lg:px-8 lg:pb-32 lg:pt-32">
 <div className="pointer-events-none absolute left-1/2 top-10 h-[500px] w-[700px] -translate-x-1/2 rounded-full bg-blue-500/10 blur-[120px]" />

 <div className="relative">
 <div className="mx-auto mb-7 flex w-fit items-center gap-2 rounded-full border border-[var(--border)] bg-[var(--surface)] px-4 py-2 text-xs text-[var(--muted)]">
 <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
 Agent execution control
 </div>

 <h1 className="mx-auto max-w-5xl text-5xl font-semibold tracking-[-0.055em] sm:text-6xl lg:text-8xl">
 Give AI agents freedom.
 <br />
 <span className="text-[var(--muted)]">Keep humans in control.</span>
 </h1>

 <p className="mx-auto mt-8 max-w-2xl text-base leading-7 text-[var(--muted)] sm:text-lg">
 ClearX sits between autonomous agents and execution, evaluating
 intent, enforcing policy, and stopping actions that cross the line.
 </p>

 <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row">
 <button className="w-full rounded-full bg-[var(--foreground)] px-7 py-3.5 text-sm font-semibold text-[var(--background)] transition hover:opacity-80 sm:w-auto">
 Start building
 </button>
 <button className="w-full rounded-full border border-[var(--border)] bg-[var(--surface)] px-7 py-3.5 text-sm font-medium transition hover:border-[var(--foreground)] sm:w-auto">
 Explore the system
 </button>
 </div>
 </div>
 </section>

 <section id="product" className="mx-auto max-w-7xl px-6 pb-28 lg:px-8">
        <div className="rounded-[2rem] border border-[var(--border)] bg-[var(--surface)] p-2 shadow-2xl shadow-black/10">
          <div className="rounded-[1.5rem] border border-[var(--border)] bg-[var(--background)]">
            <div className="flex items-center justify-between border-b border-[var(--border)] px-5 py-4">
              <div className="flex items-center gap-3">
                <div className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
                <span className="text-sm font-medium">ClearX Control</span>
              </div>
              <span className="text-xs text-[var(--muted)]">
                Live policy evaluation
              </span>
            </div>

            <div className="grid lg:grid-cols-2">
              <div className="border-b border-[var(--border)] p-7 lg:border-b-0 lg:border-r lg:p-10">
                <p className="text-xs uppercase tracking-[0.18em] text-[var(--muted)]">
                  Incoming agent action
                </p>

                <h2 className="mt-4 text-2xl font-semibold tracking-tight">
                  Transfer USDC
                </h2>

                <div className="mt-8 space-y-5">
                  <label className="block">
                    <span className="text-sm text-[var(--muted)]">Amount</span>
                    <div className="mt-2 flex items-center rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4">
                      <input
                        type="number"
                        min="0"
                        value={amount}
                        onChange={(event) => setAmount(Number(event.target.value))}
                        className="w-full bg-transparent py-3 text-sm outline-none"
                      />
                      <span className="text-sm text-[var(--muted)]">USDC</span>
                    </div>
                  </label>

                  <label className="block">
                    <span className="text-sm text-[var(--muted)]">Recipient</span>
                    <select
                      value={recipient}
                      onChange={(event) => setRecipient(event.target.value)}
                      className="mt-2 w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4 py-3 text-sm outline-none"
                    >
                      <option value="0x7A3...91F2">0x7A3...91F2 — Allowed</option>
                      <option value="0xUNKNOWN">0xUNKNOWN — Unknown</option>
                    </select>
                  </label>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4">
                      <p className="text-xs text-[var(--muted)]">Network</p>
                      <p className="mt-1 text-sm font-medium">Base</p>
                    </div>
                    <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4">
                      <p className="text-xs text-[var(--muted)]">Agent</p>
                      <p className="mt-1 text-sm font-medium">Treasury Agent</p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="p-7 lg:p-10">
                <p className="text-xs uppercase tracking-[0.18em] text-[var(--muted)]">
                  ClearX decision
                </p>

                <div className="mt-7 flex items-center gap-4">
                  <div
                    className={`flex h-14 w-14 items-center justify-center rounded-2xl border text-xl ${
                      decision.decision === "APPROVE"
                        ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-500"
                        : decision.decision === "REVIEW"
                          ? "border-amber-500/20 bg-amber-500/10 text-amber-500"
                          : "border-red-500/20 bg-red-500/10 text-red-500"
                    }`}
                  >
                    {decision.decision === "APPROVE"
                      ? "✓"
                      : decision.decision === "REVIEW"
                        ? "!"
                        : "×"}
                  </div>

                  <div>
                    <div className="text-xl font-semibold">
                      {decision.decision === "APPROVE"
                        ? "Approved"
                        : decision.decision === "REVIEW"
                          ? "Human review"
                          : "Blocked"}
                    </div>
                    <div className="mt-1 text-sm text-[var(--muted)]">
                      {decision.reason}
                    </div>
                  </div>
                </div>

                <div className="mt-8 space-y-3">
                  {decision.checks.map((check) => (
                    <div
                      key={check.name}
                      className="flex items-center justify-between rounded-xl border border-[var(--border)] px-4 py-3"
                    >
                      <span className="text-sm">{check.name}</span>
                      <span
                        className={`text-sm font-medium ${
                          check.status === "PASSED"
                            ? "text-emerald-500"
                            : check.status === "REVIEW"
                              ? "text-amber-500"
                              : "text-red-500"
                        }`}
                      >
                        {check.status === "PASSED"
                          ? "Passed"
                          : check.status === "REVIEW"
                            ? "Review"
                            : "Blocked"}
                      </span>
                    </div>
                  ))}
                </div>

                <button
                  disabled={decision.decision === "BLOCK"}
                  className="mt-6 w-full rounded-xl bg-[var(--foreground)] py-3 text-sm font-semibold text-[var(--background)] transition hover:opacity-80 disabled:cursor-not-allowed disabled:opacity-30"
                >
                  {decision.decision === "APPROVE"
                    ? "Execute action"
                    : decision.decision === "REVIEW"
                      ? "Review execution"
                      : "Execution blocked"}
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="how" className="mx-auto max-w-7xl px-6 py-28 lg:px-8">
 <div className="max-w-2xl">
 <p className="text-xs uppercase tracking-[0.2em] text-[var(--accent)]">
 The control layer
 </p>
 <h2 className="mt-5 text-4xl font-semibold tracking-[-0.04em] sm:text-5xl">
 Autonomous execution needs boundaries.
 </h2>
 </div>

 <div className="mt-16 grid gap-px overflow-hidden rounded-3xl border border-[var(--border)] bg-[var(--border)] md:grid-cols-3">
 {[
 ["01", "Understand", "Translate what an agent wants to do into a clear, inspectable intent."],
 ["02", "Enforce", "Compare every action against explicit policies and execution limits."],
 ["03", "Verify", "Record decisions and execution outcomes in an auditable trail."],
 ].map(([number, title, body]) => (
 <div key={number} className="bg-[var(--surface)] p-8 lg:p-10">
 <span className="text-xs text-[var(--muted)]">{number}</span>
 <h3 className="mt-12 text-xl font-semibold">{title}</h3>
 <p className="mt-4 text-sm leading-6 text-[var(--muted)]">{body}</p>
 </div>
 ))}
 </div>
 </section>

 <section id="security" className="mx-auto max-w-7xl px-6 pb-32 lg:px-8">
 <div className="relative overflow-hidden rounded-[2rem] border border-[var(--border)] bg-[var(--surface)] px-7 py-16 text-center lg:px-16">
 <div className="pointer-events-none absolute left-1/2 top-0 h-64 w-96 -translate-x-1/2 bg-blue-500/10 blur-[100px]" />

 <div className="relative">
 <p className="text-xs uppercase tracking-[0.2em] text-[var(--accent)]">
 Built for agentic systems
 </p>
 <h2 className="mx-auto mt-5 max-w-3xl text-4xl font-semibold tracking-[-0.04em] sm:text-5xl">
 Let agents move fast without giving them unlimited authority.
 </h2>
 <p className="mx-auto mt-6 max-w-xl text-sm leading-6 text-[var(--muted)]">
 ClearX turns policies into an execution boundary between intent
 and action.
 </p>
 <button className="relative mt-9 rounded-full bg-[var(--foreground)] px-7 py-3.5 text-sm font-semibold text-[var(--background)]">
 Build with ClearX
 </button>
 </div>
 </div>
 </section>

 <footer className="border-t border-[var(--border)]">
 <div className="mx-auto flex max-w-7xl flex-col gap-3 px-6 py-8 text-xs text-[var(--muted)] sm:flex-row sm:items-center sm:justify-between lg:px-8">
 <span>ClearX · Agent execution control</span>
 <span>Policy-first infrastructure for autonomous agents</span>
 </div>
 </footer>
 </main>
 );
}
