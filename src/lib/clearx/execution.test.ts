import { executeThroughClearX } from "./execution";

const baseAction = {
  type: "TRANSFER" as const,
  asset: "USDC",
  recipient: "0xD6aa751524A94161eAdfF44047266Fa8586F7A77",
  network: "X Layer",
};

const approved = executeThroughClearX("Treasury Agent", {
  ...baseAction,
  amount: 50,
});

if (approved.execution !== "ALLOWED") {
  throw new Error(`Expected ALLOWED, received ${approved.execution}`);
}

const review = executeThroughClearX("Treasury Agent", {
  ...baseAction,
  amount: 250,
});

if (review.execution !== "STOPPED" || review.decision !== "REVIEW") {
  throw new Error("Expected REVIEW action to be stopped.");
}

const blocked = executeThroughClearX("Treasury Agent", {
  ...baseAction,
  amount: 50,
  recipient: "0xUNKNOWN",
});

if (blocked.execution !== "STOPPED" || blocked.decision !== "BLOCK") {
  throw new Error("Expected BLOCK action to be stopped.");
}

console.log("ClearX execution gate tests passed.");
