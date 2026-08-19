import { evaluateAction } from "./policy";

const baseAction = {
  type: "TRANSFER" as const,
  asset: "USDC",
  recipient: "0xD6aa751524A94161eAdfF44047266Fa8586F7A77",
  network: "X Layer",
};

const approved = evaluateAction({
  ...baseAction,
  amount: 50,
});

if (approved.decision !== "APPROVE") {
  throw new Error(`Expected APPROVE, received ${approved.decision}`);
}

const review = evaluateAction({
  ...baseAction,
  amount: 250,
});

if (review.decision !== "REVIEW") {
  throw new Error(`Expected REVIEW, received ${review.decision}`);
}

const blocked = evaluateAction({
  ...baseAction,
  amount: 50,
  recipient: "0xUNKNOWN",
});

if (blocked.decision !== "BLOCK") {
  throw new Error(`Expected BLOCK, received ${blocked.decision}`);
}

console.log("ClearX policy tests passed.");
