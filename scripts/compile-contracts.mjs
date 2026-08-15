import fs from "node:fs";
import path from "node:path";
import solc from "solc";

const root = process.cwd();

const files = [
  "contracts/TestUSDC.sol",
  "contracts/AgenticCommerce.sol",
  "contracts/ClearXEvaluator.sol",
];

const sources = Object.fromEntries(
  files.map((file) => [
    file,
    {
      content: fs.readFileSync(path.join(root, file), "utf8"),
    },
  ]),
);

const input = {
  language: "Solidity",
  sources,
  settings: {
    optimizer: {
      enabled: true,
      runs: 200,
    },
    outputSelection: {
      "*": {
        "*": ["abi", "evm.bytecode.object"],
      },
    },
  },
};

function findImports(importPath) {
  try {
    return {
      contents: fs.readFileSync(
        path.join(root, "node_modules", importPath),
        "utf8",
      ),
    };
  } catch {
    return { error: `Import not found: ${importPath}` };
  }
}

const output = JSON.parse(
  solc.compile(JSON.stringify(input), { import: findImports }),
);

if (output.errors) {
  for (const error of output.errors) {
    console.error(error.formattedMessage);
  }
}

const errors =
  output.errors?.filter((error) => error.severity === "error") ?? [];

if (errors.length > 0) {
  process.exit(1);
}

fs.mkdirSync(path.join(root, "artifacts"), { recursive: true });

for (const [file, contracts] of Object.entries(output.contracts ?? {})) {
  for (const [name, artifact] of Object.entries(contracts)) {
    const outputFile = path.join(
      root,
      "artifacts",
      `${name}.json`,
    );

    fs.writeFileSync(
      outputFile,
      JSON.stringify(
        {
          contractName: name,
          sourceName: file,
          abi: artifact.abi,
          bytecode: `0x${artifact.evm.bytecode.object}`,
        },
        null,
        2,
      ),
    );

    console.log(`compiled ${name} -> ${outputFile}`);
  }
}
