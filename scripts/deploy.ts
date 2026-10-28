import { execFileSync } from "node:child_process";

const run = (command: string, args: string[], capture = false) =>
  execFileSync(command, args, { encoding: "utf8", stdio: capture ? "pipe" : "inherit" });
const git = (...args: string[]) => run("git", args, true).trim();

run("git", ["fetch", "origin", "main"]);
const head = git("rev-parse", "HEAD");
if (head !== git("rev-parse", "origin/main"))
  throw new Error("Deploy requires the current origin/main commit.");
if (git("status", "--porcelain")) throw new Error("Deploy requires a clean checkout.");
const runs = JSON.parse(
  run("gh", ["api", `repos/adam0white/days/actions/runs?head_sha=${head}&per_page=100`], true),
).workflow_runs as {
  id: number;
  name: string;
  head_sha: string;
  head_branch: string;
  event: string;
  status: string;
  conclusion: string | null;
}[];
const ci = runs
  .filter(
    (item) =>
      item.name === "CI" &&
      item.head_sha === head &&
      item.head_branch === "main" &&
      item.event === "push",
  )
  .sort((a, b) => b.id - a.id)[0];
if (!ci || ci.status !== "completed" || ci.conclusion !== "success")
  throw new Error(`The latest main CI for ${head} has not passed.`);
const jobs = JSON.parse(
  run("gh", ["api", `repos/adam0white/days/actions/runs/${ci.id}/jobs?per_page=100`], true),
).jobs as { name: string; status: string; conclusion: string | null }[];
if (
  !jobs.some(
    (job) => job.name === "ci" && job.status === "completed" && job.conclusion === "success",
  )
)
  throw new Error(`The ci job for run ${ci.id} has not passed.`);
run("pnpm", ["install", "--frozen-lockfile"]);
run("pnpm", ["check:lane"]);
run("pnpm", ["build"]);
run("pnpm", ["exec", "wrangler", "deploy"]);
