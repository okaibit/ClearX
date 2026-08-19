# ClearX

An AI-assisted verification layer for agent-to-agent commerce, built on X Layer.

## The problem

Autonomous agents can now negotiate and pay each other, but there's no reliable way to confirm a job was actually done before the money moves. ClearX closes that gap: it compiles a plain-language instruction into a structured obligation, checks the proposed action against a policy engine, and verifies real on-chain evidence before authorizing settlement.

## How it works

1. **Obligation compiler** (`src/lib/clearx/obligation.ts`) parses a raw instruction (amount, recipient, deadline, network, settlement terms) into a structured `ClearXObligation`.
2. **Policy engine** (`src/lib/clearx/policy.ts`) evaluates the proposed action against execution scope, network, recipient allowlist, and amount limits, returning `APPROVE`, `REVIEW`, or `BLOCK`.
3. **Evidence verifier** (`src/lib/clearx/evidence.ts`) reads the actual transaction receipt and decoded ERC-20 `Transfer` event from the chain and checks it against the obligation, no self-reported claims.
4. **Evidence certificate** (`contracts/ClearXEvidenceCertificate.sol`): the independently observed evidence (transaction hash, recipient, amount) is hashed and bound into an EIP-712 typed digest. Two independent approvers each sign that exact digest off-chain; the contract verifies both signatures on-chain before marking the certificate as attested. This is a separate cryptographic attestation layer, distinct from the evaluator below — it proves what evidence was independently observed, not just that a threshold of votes was cast.
5. **On-chain settlement**: `AgenticCommerce.sol` escrows funds per job (Open → Funded → Submitted → Completed/Rejected/Expired). `ClearXEvaluator.sol` is a separate 2-of-2 threshold contract — two independent approvers must each cast an on-chain vote before settlement releases. No single key can approve a payout alone, and the evaluator only votes after the evidence certificate above has already been verified.

## Contracts (X Layer Testnet, chain ID 1952)

| Contract | Address |
|---|---|
| TestUSDC | `0x771fe2efa6208a738cafb7a06c0d272d8eae6d70` |
| AgenticCommerce | `0x3b92251ab1caa54c755595c77126319fe02a5dc5` |
| ClearXEvaluator | `0xd75d6cdf537e1ea30d2c7b03a1b1eafebc7d2ac9` |

## Stack

Next.js 16, viem, OpenZeppelin contracts (ReentrancyGuard, SafeERC20), Groq for AI-assisted analysis.

## Getting started

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

To compile and deploy contracts to X Layer testnet:

```bash
node scripts/compile-contracts.mjs
node scripts/deploy-xlayer.mjs
```

## Built for

OKX BuildX AI Season / KeeperHub Agents Onchain Hackathon.
