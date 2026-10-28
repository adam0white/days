import { describe, expect, it } from "vitest";
import { choose, createGame, exportRun, hashGame, replay, view } from "../src/engine.ts";
import { decisions, finished, LEYLA, SELIN, tie } from "./actors.ts";

const win = [
  "welcome",
  "check",
  "private",
  "ask",
  "push",
  "compare",
  "delegate",
  "protect",
  "name",
  "confirm",
  "speak",
  "close",
];
const loss = [
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
function play(seed: number, inputs: string[]) {
  let game = createGame(seed);
  for (const id of inputs) game = choose(game, id);
  return game;
}
describe("Three Days complete runs", () => {
  it("ends all three days with an attainable win and exact JSON replay", () => {
    const game = play(42, win);
    expect(view(game).outcome).toBe("won");
    expect(view(game).day).toBe(3);
    expect(view(game).text.join(" ")).toContain("grief");
    expect(hashGame(replay(JSON.parse(JSON.stringify(exportRun(game)))))).toBe(hashGame(game));
  });
  it("has a loss that names the unresolved obligations", () => {
    const game = play(42, loss);
    expect(view(game).outcome).toBe("lost");
    expect(view(game).text.join(" ")).toMatch(
      /Leyla closes the door, but (the account|the promised visit|the agreed later delivery|nobody has addressed)/,
    );
  });
  it("distributes evidence between living people by seed", () => {
    expect(
      new Set(Array.from({ length: 12 }, (_, seed) => createGame(seed).evidenceHolder)).size,
    ).toBeGreaterThan(1);
  });
  it("rejects malformed seeds, unavailable choices and tampered exports", () => {
    expect(() => createGame(1.2)).toThrow();
    expect(() => choose(createGame(1), "close")).toThrow();
    const run = exportRun(play(42, win));
    run.state.seed = 90;
    expect(() => replay(run)).toThrow();
    expect(() => replay({ ...run, inputs: ["fake"] })).toThrow();
  });
  it("reads without consuming Ink or actor state and never mutates its input", () => {
    const game = createGame(42);
    const before = JSON.stringify(game);
    view(game);
    view(game);
    choose(game, "welcome");
    expect(JSON.stringify(game)).toBe(before);
  });
});

it("cover preserves a visit hour but never makes travel free", () => {
  const withHelp = play(42, [
    "welcome",
    "check",
    "private",
    "ask",
    "push",
    "compare",
    "delegate",
    "protect",
    "name",
    "confirm",
    "speak",
    "close",
  ]);
  const rested = play(42, [
    "welcome",
    "check",
    "private",
    "hide",
    "rest",
    "compare",
    "delegate",
    "protect",
    "name",
    "confirm",
    "speak",
    "close",
  ]);
  const unsupported = play(42, [
    "welcome",
    "check",
    "private",
    "hide",
    "push",
    "compare",
    "delegate",
    "protect",
    "name",
    "confirm",
    "speak",
    "close",
  ]);
  expect(withHelp.helper).toBe(true);
  expect(decisions(withHelp, SELIN)).toEqual(["cover"]);
  expect(finished(withHelp, SELIN)).toEqual(["cover"]);
  expect(view(withHelp).outcome).toBe("won");
  expect(view(rested).outcome).toBe("lost");
  expect(view(unsupported).outcome).toBe("lost");
  const courier = [...win];
  courier[3] = "hide";
  courier[9] = "leave";
  expect(play(42, courier).outcome).toBe("won");
  expect(view(rested).text.join(" ")).toContain("promised visit");
});

it("HF changes Selin’s relationship after witnessing a privacy breach", () => {
  const before = play(42, ["welcome", "check"]);
  const after = choose(before, "read");
  expect(tie(after, SELIN, LEYLA)?.affection).toBeLessThan(
    tie(before, SELIN, LEYLA)?.affection ?? 0,
  );
});

// Loop cases are separate tests: each full play and replay re-runs HF 4.0, which hashes every step.
for (const seed of [0, 2147483648, 4294967295]) {
  it(`accepts the browser's unsigned 32-bit seed ${seed}`, () => {
    const game = play(seed, win);
    expect(hashGame(replay(exportRun(game)))).toBe(hashGame(game));
  });
}
it("refuses a seed outside 32 bits", () => {
  expect(() => createGame(4294967296)).toThrow();
});

it("replays partial runs and refuses changes to HF or Ink state", () => {
  const game = play(42, win.slice(0, 6));
  expect(hashGame(replay(exportRun(game)))).toBe(hashGame(game));
  for (const change of ["actor", "ink"]) {
    const run = exportRun(game);
    const state = JSON.parse(JSON.stringify(run.state));
    if (change === "actor") state.actors.current.people[LEYLA].body.satiety -= 0.01;
    else state.ink += " ";
    expect(() => replay({ ...run, state })).toThrow();
  }
});

it("keeps the last door closed and offers no choices after either ending", () => {
  for (const inputs of [win, loss]) {
    const game = play(42, inputs);
    expect(game.inputs).toEqual(inputs);
    expect(view(game).choices).toEqual([]);
    expect(() => choose(game, "close")).toThrow();
  }
});

for (const [index, alternative] of [
  [1, "pay"],
  [6, "conceal"],
  [7, "publish"],
  [8, "dismiss"],
  [9, "leave"],
  [10, "silent"],
] as const) {
  it(`allows the costly alternative "${alternative}" and never requires disclosing grief`, () => {
    const inputs = [...win];
    inputs[index] = alternative;
    expect(play(42, inputs).outcome).toBe("won");
  });
}

it("HF chooses home after the privacy breach and its choice removes cover", () => {
  const trusted = play(42, ["welcome", "check", "private", "ask"]);
  const harmed = play(42, ["welcome", "check", "read", "ask"]);
  expect(trusted.helper).toBe(true);
  expect(harmed.helper).toBe(false);
  expect(decisions(harmed, SELIN).at(-1)).toBe("home");
});

it("shows hour costs before a choice and never spends below zero", () => {
  let game = play(42, ["welcome", "check", "private", "hide"]);
  expect(view(game).text.join(" ")).toContain("4 free hours");
  game = choose(game, "rest");
  expect(game.stretches).toBe(3);
  expect(view(game).choices.find((c) => c.id === "compare")?.cost).toContain("1 hour");
  game = choose(game, "compare");
  expect(game.stretches).toBe(2);
  for (const id of ["delegate", "protect", "name"]) game = choose(game, id);
  expect(view(game).text.join(" ")).toContain("0 free hours");
  game = choose(game, "confirm");
  expect(game.confirmed).toBe(false);
  expect(game.stretches).toBe(0);
  expect(view(game).text.join(" ")).toContain("visit needs 2 hours");
  expect(hashGame(replay(exportRun(game)))).toBe(hashGame(game));
});

it("refuses a 3.x export before building a run, with a start-fresh message", () => {
  const old = exportRun(play(42, win.slice(0, 3)));
  const state = { ...JSON.parse(JSON.stringify(old.state)), version: "three-days-2" };
  expect(() => replay({ ...old, version: "three-days-2", state })).toThrow(
    /earlier Three Days build \(Human Framework 3\.2\).*Start a new play/,
  );
});

it("charges each Ink choice once: one HF decision and one settled act per choice", () => {
  const game = play(42, win);
  const kinds = game.actors.history.flatMap((t) =>
    t.inputs.map(
      (input) => `${input.kind}:${"person" in input.payload ? input.payload.person : ""}`,
    ),
  );
  const count = (kind: string) => kinds.filter((k) => k === kind).length;
  const acts = win.filter((id) => id !== "close").length;
  expect(count(`decision.requested:${LEYLA}`)).toBe(acts);
  expect(count(`decision.requested:${SELIN}`)).toBe(1);
  expect(decisions(game, LEYLA)).toEqual(win.filter((id) => id !== "close"));
  // Each accepted act is started once and finished once.
  expect(count(`action.resolved:${LEYLA}`)).toBe(2 * acts);
});

it("continues identically from the live run and from the saved archive", () => {
  const game = play(42, win.slice(0, 5));
  const live = choose(game, "compare");
  const restored = choose(game, "compare");
  expect(hashGame(restored)).toBe(hashGame(live));
});

it("checks a changed copy of the archive even while its live run is kept", () => {
  const game = play(42, win.slice(0, 2));
  const copy = JSON.parse(JSON.stringify(game));
  copy.actors.current.people[LEYLA].body.satiety -= 0.01;
  expect(() => choose(copy, win[2] ?? "")).toThrow(/hash-mismatch/);
  expect(choose(game, win[2] ?? "").inputs).toEqual(win.slice(0, 3));
});

it("keeps the 64-choice limit for replay", () => {
  const run = exportRun(play(42, win.slice(0, 2)));
  expect(() => replay({ ...run, inputs: Array.from({ length: 65 }, () => "welcome") })).toThrow(
    /not a supported/,
  );
});

it("refuses the prior HF 4.0 save with an explicit start-fresh message", () => {
  const old = exportRun(createGame(42));
  expect(() => replay({ ...old, version: "three-days-3" })).toThrow(/earlier.*Start a new play/);
});
