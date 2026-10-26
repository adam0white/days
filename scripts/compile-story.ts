import { readFileSync, writeFileSync } from "node:fs";
import { Compiler } from "inkjs/compiler/Compiler";

const compiler = new Compiler(readFileSync("src/story.ink", "utf8"));
const compiled = JSON.stringify(JSON.parse(compiler.Compile().ToJson())) + "\n";
if (process.argv.includes("--check")) {
  if (JSON.stringify(JSON.parse(readFileSync("src/story.json", "utf8"))) !== compiled.trim())
    throw new Error("The compiled story is stale. Run pnpm story and commit both files.");
} else writeFileSync("src/story.json", compiled);
