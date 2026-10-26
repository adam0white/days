import { execFileSync } from "node:child_process";
import { writeFileSync } from "node:fs";

const commit = execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim();
const dirty =
  execFileSync("git", ["status", "--porcelain"], { encoding: "utf8" }).trim().length > 0;
writeFileSync(
  "public/release.json",
  JSON.stringify({ game: "days", commit, dirty, hf: "3.2.0", engine: "3.2.0" }) + "\n",
);
