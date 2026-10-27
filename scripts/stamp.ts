import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";

// The release names the HF package actually installed, so a pin change cannot leave it stale.
const hf: string = JSON.parse(
  readFileSync("node_modules/@adam0white/human-framework/package.json", "utf8"),
).version;
const commit = execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim();
const dirty =
  execFileSync("git", ["status", "--porcelain"], { encoding: "utf8" }).trim().length > 0;
writeFileSync(
  "public/release.json",
  JSON.stringify({ game: "days", commit, dirty, hf, engine: hf }) + "\n",
);
