import { writeFileSync } from "node:fs";
import { choose, createGame, exportRun, type Game, hashGame, replay, view } from "../src/engine.ts";

export type Policy = "careful" | "first" | "careless" | "read-and-repair" | "pay-and-recover";
const careless = [
  "alone",
  "pay",
  "read",
  "hide",
  "push",
  "guess",
  "conceal",
  "publish",
  "dismiss",
  "leave",
  "silent",
  "close",
];
const reading = [
  "alone",
  "check",
  "read",
  "ask",
  "rest",
  "compare",
  "delegate",
  "protect",
  "dismiss",
  "leave",
  "silent",
  "close",
];
const paying = [
  "alone",
  "pay",
  "private",
  "ask",
  "rest",
  "compare",
  "delegate",
  "protect",
  "name",
  "confirm",
  "silent",
  "close",
];

export function policyChoice(game: Game, policy: Policy): string {
  const current = view(game);
  const has = (id: string) => current.choices.some((choice) => choice.id === id);
  if (policy === "first") return current.choices[0]!.id;
  if (policy !== "careful")
    return (policy === "careless" ? careless : policy === "read-and-repair" ? reading : paying)[
      game.step
    ]!;
  // This policy sees the same hours, tiredness, cover and costs that the room shows.
  // It never reads a seed, actor internals, or a future state.
  if (has("welcome")) return current.fatigue >= 3 ? "alone" : "welcome";
  if (has("rest")) return current.fatigue >= 3 ? "rest" : "push";
  if (has("confirm")) return current.helper ? "confirm" : "leave";
  if (has("speak")) return "silent";
  for (const id of ["check", "private", "ask", "compare", "delegate", "protect", "name", "close"])
    if (has(id)) return id;
  throw new Error("No policy choice for this scene.");
}
export function probe(seed: number, policy: Policy) {
  let game = createGame(seed);
  const initialFatigue = view(game).fatigue;
  let attempts = 0;
  while (game.choices.length && attempts++ < 32) game = choose(game, policyChoice(game, policy));
  const hash = hashGame(game);
  const replayMatches = hashGame(replay(JSON.parse(JSON.stringify(exportRun(game))))) === hash;
  if (!replayMatches) throw new Error(`Replay mismatch: ${policy}, seed ${seed}`);
  return {
    hash,
    replayMatches,
    seed,
    policy,
    outcome: game.outcome,
    initialFatigue,
    hours: game.stretches,
    fatigue: view(game).fatigue,
    helper: game.helper,
    disclosed: !game.privacy,
    privacyManaged: game.privacyManaged,
    paid: game.paid,
    inputs: game.inputs,
  };
}
if (import.meta.main) {
  const seeds = Array.from({ length: 32 }, (_, seed) => seed);
  const policies: Policy[] = ["careful", "first", "careless", "read-and-repair", "pay-and-recover"];
  const results = policies.flatMap((policy) => seeds.map((seed) => probe(seed, policy)));
  const summary = policies.map((policy) => {
    const runs = results.filter((run) => run.policy === policy);
    return {
      policy,
      seeds: runs.length,
      wins: runs.filter((run) => run.outcome === "won").length,
      losses: runs.filter((run) => run.outcome === "lost").length,
      covers: runs.filter((run) => run.helper).length,
    };
  });
  const report = {
    seeds,
    summary,
    policyDescription: {
      careful:
        "Use visible initial tiredness: at 3 or more keep the hour at the door and rest next morning; otherwise eat with Hacer and work next morning. Check originals, keep privacy, ask for cover, compare, agree visit, keep notebook, record account. Visit with cover; otherwise pay for agreed delivery. Silence is allowed.",
      first: "Choose the first displayed button at every scene.",
      careless:
        "Choose the second displayed button at every scene; no containment of the page read aloud.",
      "read-and-repair":
        "Give up the soup hour, obtain the original, read for practical help, rest, compare quickly, agree a visit, apologise and contain disclosure, voluntarily pay the verified bill, pay for agreed delivery.",
      "pay-and-recover":
        "Keep the door, pay the initial demand, keep privacy, ask, rest, obtain and compare original later, agree visit, keep notebook, record true account, visit, remain silent.",
    },
    results,
  };
  if (process.argv[2]) writeFileSync(process.argv[2], `${JSON.stringify(report, null, 2)}\n`);
  console.log(JSON.stringify(summary, null, 2));
}
