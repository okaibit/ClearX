"use client";

import { useEffect, useState } from "react";

type VerificationResult = {
  execution?: string;
  verifiedOnchain?: boolean;
  transactionHash?: string;
  blockNumber?: string;
  chainId?: number;
  settlementStatus?: "CLEARED" | "HELD";
  settlement?: {
    jobId?: string;
    provider?: string;
    completed?: boolean;
    evidenceHash?: string;
    certificateId?: string;
    certificateTransactionHash?: string;
    certificateVerified?: boolean;
    attestations?: Array<{
      signer: string;
      signature: string;
    }>;
  };
  evidence?: {
    verified?: boolean;
    checks?: Array<{
      name: string;
      status: "PASSED" | "FAILED";
      expected: string;
      observed: string;
    }>;
  };
  transactions?: Array<{
    step: string;
    hash: string;
    blockNumber: string;
  }>;
};

const EXPLORER = "https://www.oklink.com/xlayer-test";

function explorerTx(hash: string) {
  return `${EXPLORER}/tx/${hash}`;
}

function explorerAddress(address: string) {
  return `${EXPLORER}/address/${address}`;
}

function short(value?: string, start = 10, end = 8) {
  if (!value) return "—";
  if (value.length <= start + end + 3) return value;
  return `${value.slice(0, start)}...${value.slice(-end)}`;
}

export default function VerificationPage() {
  const [result, setResult] = useState<VerificationResult | null>(null);

  useEffect(() => {
    const stored = sessionStorage.getItem("clearx-verification-result");

    if (stored) {
      try {
        setResult(JSON.parse(stored));
      } catch {
        setResult(null);
      }
    }
  }, []);

  if (!result) {
    return (
      <main className="min-h-screen bg-[var(--background)] text-[var(--foreground)]">
        <nav className="mx-auto flex h-20 max-w-7xl items-center px-6 lg:px-8">
          <a href="/" className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[var(--foreground)] text-sm font-bold text-[var(--background)]">
              C
            </div>
            <span className="text-lg font-semibold tracking-tight">
              ClearX
            </span>
          </a>
        </nav>

        <section className="mx-auto max-w-3xl px-6 py-24 text-center">
          <p className="text-xs uppercase tracking-[0.18em] text-[var(--muted)]">
            Verification layer
          </p>

          <h1 className="mt-4 text-4xl font-semibold tracking-tight sm:text-5xl">
            No verification receipt yet
          </h1>

          <p className="mx-auto mt-5 max-w-xl text-sm leading-7 text-[var(--muted)]">
            Execute an approved obligation from the ClearX console first.
            The resulting blockchain evidence will appear here.
          </p>

          <a
            href="/#console"
            className="mt-8 inline-flex rounded-xl bg-[var(--foreground)] px-5 py-3 text-sm font-semibold text-[var(--background)]"
          >
            Return to console →
          </a>
        </section>
      </main>
    );
  }

  const verified =
    result.verifiedOnchain === true &&
    result.evidence?.verified === true &&
    result.settlement?.completed === true;

  return (
    <main className="min-h-screen bg-[var(--background)] text-[var(--foreground)]">
      <nav className="mx-auto flex h-20 max-w-7xl items-center justify-between px-6 lg:px-8">
        <a href="/" className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[var(--foreground)] text-sm font-bold text-[var(--background)]">
            C
          </div>

          <span className="text-lg font-semibold tracking-tight">
            ClearX
          </span>
        </a>

        <a
          href="/#console"
          className="rounded-xl border border-[var(--border)] px-4 py-2 text-xs font-semibold transition hover:bg-[var(--surface)]"
        >
          ← Console
        </a>
      </nav>

      <section className="mx-auto max-w-7xl px-6 pb-24 pt-12 lg:px-8">
        <div className="mb-10">
          <p className="text-xs uppercase tracking-[0.18em] text-emerald-500">
            Proof before payout
          </p>

          <div className="mt-3 flex flex-col justify-between gap-6 md:flex-row md:items-end">
            <div>
              <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">
                Here's the proof
              </h1>

              <p className="mt-4 max-w-2xl text-sm leading-7 text-[var(--muted)]">
                ClearX doesn't take the execution result at face value. This page
                shows the blockchain evidence checked before the payment was
                released.
              </p>
            </div>

            <div
              className={`rounded-full px-4 py-2 text-xs font-semibold ${
                verified
                  ? "bg-emerald-500/10 text-emerald-500"
                  : "bg-amber-500/10 text-amber-500"
              }`}
            >
              {verified ? "✓ VERIFIED ONCHAIN" : "VERIFICATION INCOMPLETE"}
            </div>
          </div>
        </div>

        <div className="grid gap-5 md:grid-cols-4">
          {[
            [
              "01",
              "Evidence",
              result.evidence?.verified ? "Verified" : "Failed",
            ],
            [
              "02",
              "Attestations",
              result.settlement?.attestations
                ? `${result.settlement.attestations.length} of 2`
                : "—",
            ],
            [
              "03",
              "Certificate",
              result.settlement?.certificateVerified
                ? "Confirmed"
                : "Pending",
            ],
            [
              "04",
              "Settlement",
              result.settlement?.completed ? "Completed" : "Held",
            ],
          ].map(([number, title, value]) => (
            <div
              key={number}
              className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5"
            >
              <p className="text-xs text-[var(--muted)]">{number}</p>
              <p className="mt-5 text-xs uppercase tracking-[0.14em] text-[var(--muted)]">
                {title}
              </p>
              <p className="mt-1 text-lg font-semibold">{value}</p>
            </div>
          ))}
        </div>

        <div className="mt-8 grid gap-8 lg:grid-cols-2">
          <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6 lg:p-8">
            <p className="text-xs uppercase tracking-[0.16em] text-emerald-500">
              Proof of the result
            </p>

            <h2 className="mt-2 text-2xl font-semibold">
              2-of-2 evidence attestation
            </h2>

            <p className="mt-3 text-sm leading-7 text-[var(--muted)]">
              Two independent approvers signed the same evidence. ClearX checked the
              certificate onchain before allowing settlement.
            </p>

            <div className="mt-6 space-y-3">
              <div className="rounded-xl border border-[var(--border)] p-4">
                <p className="text-xs text-[var(--muted)]">
                  Evidence hash
                </p>
                <p className="mt-2 break-all font-mono text-[11px]">
                  {result.settlement?.evidenceHash ?? "—"}
                </p>
              </div>

              <div className="rounded-xl border border-[var(--border)] p-4">
                <p className="text-xs text-[var(--muted)]">
                  Certificate ID
                </p>
                <p className="mt-2 break-all font-mono text-[11px]">
                  {result.settlement?.certificateId ?? "—"}
                </p>
              </div>

              <div className="rounded-xl border border-[var(--border)] p-4">
                <p className="text-xs text-[var(--muted)]">
                  Certificate transaction
                </p>

                {result.settlement?.certificateTransactionHash ? (
                  <a
                    href={explorerTx(
                      result.settlement.certificateTransactionHash,
                    )}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-2 block break-all font-mono text-[11px] text-emerald-500 underline-offset-4 hover:underline"
                  >
                    {short(
                      result.settlement.certificateTransactionHash,
                      18,
                      14,
                    )}
                    <span className="ml-2 font-sans">
                      ↗ Verify on OKLink
                    </span>
                  </a>
                ) : (
                  <p className="mt-2 font-mono text-[11px]">—</p>
                )}
              </div>
            </div>
          </section>

          <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6 lg:p-8">
            <p className="text-xs uppercase tracking-[0.16em] text-[var(--muted)]">
              Two independent checks
            </p>

            <h2 className="mt-2 text-2xl font-semibold">
              Who checked it
            </h2>

            <div className="mt-6 space-y-3">
              {(result.settlement?.attestations ?? []).map(
                (attestation, index) => (
                  <div
                    key={attestation.signer}
                    className="rounded-xl border border-[var(--border)] p-4"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-sm font-semibold">
                        Attestant {index + 1}
                      </p>

                      <span className="text-xs font-semibold text-emerald-500">
                        ✓ Signature verified
                      </span>
                    </div>

                    <a
                      href={explorerAddress(attestation.signer)}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-3 block break-all font-mono text-[11px] text-emerald-500 underline-offset-4 hover:underline"
                    >
                      {attestation.signer}
                      <span className="ml-2 font-sans">
                        ↗ Verify
                      </span>
                    </a>
                  </div>
                ),
              )}
            </div>
          </section>
        </div>

        <section className="mt-8 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6 lg:p-8">
          <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
            <div>
              <p className="text-xs uppercase tracking-[0.16em] text-[var(--muted)]">
                What happened onchain
              </p>

              <h2 className="mt-2 text-2xl font-semibold">
                What ClearX checked
              </h2>
            </div>

            <div className="rounded-full border border-[var(--border)] px-3 py-1.5 text-xs text-[var(--muted)]">
              Chain {result.chainId ?? 1952}
            </div>
          </div>

          <div className="mt-6 space-y-3">
            {(result.evidence?.checks ?? []).map((check) => (
              <div
                key={check.name}
                className="grid gap-3 rounded-xl border border-[var(--border)] p-4 md:grid-cols-[1fr_1fr_auto]"
              >
                <div>
                  <p className="text-sm font-medium">{check.name}</p>
                  <p className="mt-1 text-xs text-[var(--muted)]">
                    Expected
                  </p>
                  <p className="mt-1 break-all font-mono text-[11px]">
                    {check.expected}
                  </p>
                </div>

                <div>
                  <p className="text-xs text-[var(--muted)]">
                    Observed
                  </p>
                  <p className="mt-1 break-all font-mono text-[11px]">
                    {check.observed}
                  </p>
                </div>

                <span
                  className={`text-xs font-semibold ${
                    check.status === "PASSED"
                      ? "text-emerald-500"
                      : "text-red-500"
                  }`}
                >
                  {check.status === "PASSED"
                    ? "✓ Passed"
                    : "× Failed"}
                </span>
              </div>
            ))}
          </div>
        </section>

        <section className="mt-8 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6 lg:p-8">
          <p className="text-xs uppercase tracking-[0.16em] text-[var(--muted)]">
            Settlement
          </p>

          <h2 className="mt-2 text-2xl font-semibold">
            ERC-8183 job
          </h2>

          <div className="mt-6 grid gap-3 md:grid-cols-3">
            <div className="rounded-xl border border-[var(--border)] p-4">
              <p className="text-xs text-[var(--muted)]">Job</p>
              <p className="mt-2 font-mono text-sm">
                #{result.settlement?.jobId ?? "—"}
              </p>
            </div>

            <div className="rounded-xl border border-[var(--border)] p-4">
              <p className="text-xs text-[var(--muted)]">Provider</p>
              <p className="mt-2 break-all font-mono text-[11px]">
                {result.settlement?.provider ?? "—"}
              </p>
            </div>

            <div className="rounded-xl border border-[var(--border)] p-4">
              <p className="text-xs text-[var(--muted)]">
                Settlement
              </p>
              <p className="mt-2 text-sm font-semibold text-emerald-500">
                {result.settlement?.completed
                  ? "Completed"
                  : "Held"}
              </p>
            </div>
          </div>

          {result.transactionHash && (
            <div className="mt-4 rounded-xl border border-[var(--border)] p-4">
              <p className="text-xs text-[var(--muted)]">
                Settlement transaction
              </p>

              <a
                href={explorerTx(result.transactionHash)}
                target="_blank"
                rel="noreferrer"
                className="mt-2 block break-all font-mono text-[11px] text-emerald-500 underline-offset-4 hover:underline"
              >
                {short(result.transactionHash, 18, 14)}
                <span className="ml-2 font-sans">
                  ↗ Verify on OKLink
                </span>
              </a>

              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <div>
                  <p className="text-xs text-[var(--muted)]">
                    Block
                  </p>
                  <p className="mt-1 font-mono text-sm">
                    {result.blockNumber ?? "—"}
                  </p>
                </div>

                <div>
                  <p className="text-xs text-[var(--muted)]">
                    Network
                  </p>
                  <p className="mt-1 text-sm">
                    X Layer · {result.chainId ?? 1952}
                  </p>
                </div>
              </div>
            </div>
          )}
        </section>

        {result.transactions &&
          result.transactions.length > 0 && (
            <section className="mt-8 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6 lg:p-8">
              <p className="text-xs uppercase tracking-[0.16em] text-[var(--muted)]">
                What ClearX actually did
              </p>

              <h2 className="mt-2 text-2xl font-semibold">
                From the instruction to the payout
              </h2>

              <div className="mt-6 space-y-3">
                {result.transactions.map((transaction, index) => (
                  <div
                    key={transaction.hash}
                    className="flex gap-4 rounded-xl border border-[var(--border)] p-4"
                  >
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[var(--background)] text-xs font-semibold">
                      {index + 1}
                    </div>

                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium">
                        {transaction.step}
                      </p>

                      <a
                        href={explorerTx(transaction.hash)}
                        target="_blank"
                        rel="noreferrer"
                        className="mt-2 block break-all font-mono text-[11px] text-emerald-500 underline-offset-4 hover:underline"
                      >
                        {short(transaction.hash, 18, 14)}
                        <span className="ml-2 font-sans">
                          ↗ Verify
                        </span>
                      </a>

                      <p className="mt-2 text-xs text-[var(--muted)]">
                        Block {transaction.blockNumber}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}
      </section>
    </main>
  );
}
