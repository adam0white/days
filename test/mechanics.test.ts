import { expect, it } from "vitest";
import { probe } from "../scripts/policy-probe.ts";
import { choose, createGame, exportRun, replay, view } from "../src/engine.ts";

function play(seed: number, ids: string[]) {
  let game = createGame(seed);
  for (const id of ids) game = choose(game, id);
  return game;
}
const careful = (seed: number, silent = true) => {
  let game = createGame(seed);
  const tired = game.fatigue >= 3;
  for (const id of [
    tired ? "alone" : "welcome",
    "check",
    "private",
    "ask",
    tired ? "rest" : "push",
    "compare",
    "delegate",
    "protect",
    "name",
    "confirm",
    silent ? "silent" : "speak",
    "close",
  ])
    game = choose(game, id);
  return game;
};
it("private silence does not prevent completing the account and visit", () => {
  const game = careful(42);
  expect(game.named).toBe(true);
  expect(game.confirmed).toBe(true);
  expect(game.spoken).toBe(false);
  expect(game.outcome).toBe("won");
});
it("all first buttons exhaust a real budget, including the helped visit", () => {
  let game = createGame(42);
  while (game.choices.length) game = choose(game, game.choices[0]!.id);
  expect(game.outcome).toBe("lost");
  expect(game.stretches).toBeGreaterThanOrEqual(0);
});
it("paying buys quiet and remains recoverable through the original receipt", () => {
  const game = play(42, ["alone", "pay", "private", "ask", "rest", "compare"]);
  expect(game.paid).toBe(true);
  expect(game.compared).toBe(true);
  expect(view(game).text.join(" ")).toMatch(/savings|payment|paid/);
});
it("reading buys cooperation and containment repairs obligations without erasing disclosure", () => {
  const game = play(42, [
    "alone",
    "check",
    "read",
    "ask",
    "rest",
    "compare",
    "delegate",
    "protect",
  ]);
  expect(game.compared).toBe(true);
  expect(game.privacy).toBe(false);
  expect(game.privacyManaged).toBe(true);
  expect(game.stretches).toBeGreaterThanOrEqual(0);
});
it("fatigue adds the cost of a second reader on either receipt branch", () => {
  const tired = play(42, ["alone", "check", "private", "hide", "push"]);
  const rested = play(42, ["alone", "check", "private", "hide", "rest"]);
  const compared = choose(tired, "compare");
  expect(tired.stretches - compared.stretches).toBe(2);
  expect(rested.stretches - choose(rested, "compare").stretches).toBe(1);
});
it("does not invent Selin as Leyla's companion before she arrives", () => {
  const game = play(42, ["welcome"]);
  expect(
    game.people[0]!.social.relationships.some((r) => r.otherId === "hf.cast.selin.voice"),
  ).toBe(false);
});
it("a refused HF action stays available and names the refusal", () => {
  const game = createGame(42);
  game.people[0]!.body.downed = { since: 480, reason: "injury" };
  const refused = choose(game, "alone");
  expect(refused.step).toBe(0);
  expect(refused.choices.map((c) => c.id)).toContain("alone");
  expect(refused.text.join(" ")).toMatch(/cannot|refus|rest/);
});
it("replays new time, fatigue, payment, and containment facts exactly", () => {
  const game = careful(42);
  expect(replay(JSON.parse(JSON.stringify(exportRun(game))))).toEqual(game);
});
it("Selin's HF decision changes with care and payment, not just the private page", () => {
  const requested = (opening: string, account: string, page: string) =>
    play(42, [opening, account, page, "ask"]);
  const supported = requested("welcome", "check", "private");
  const burdened = requested("alone", "check", "private");
  const quieted = requested("alone", "pay", "private");
  expect(supported.helper).toBe(true);
  expect(burdened.helper).toBe(false);
  expect(quieted.helper).toBe(true);
  for (const game of [supported, burdened, quieted]) {
    expect(game.people[3]!.trace.at(-1)?.chosenAffordanceId).toBe(game.helper ? "cover" : "home");
  }
});

it("allows full reading-with-repair and payment-with-recovery routes", () => {
  for (const policy of ["read-and-repair", "pay-and-recover"] as const) {
    const result = probe(42, policy);
    expect(result.outcome).toBe("won");
    expect(result.hours).toBeGreaterThanOrEqual(0);
    expect(result.privacyManaged).toBe(true);
  }
});
it("a visible-state careful policy succeeds across 32 seeds while automatic policies lose", {
  timeout: 30000,
}, () => {
  for (let seed = 0; seed < 32; seed++) {
    expect(probe(seed, "careful").outcome).toBe("won");
    expect(probe(seed, "first").outcome).toBe("lost");
    expect(probe(seed, "careless").outcome).toBe("lost");
  }
});

it("records an exact replay hash for every measured policy run", () => {
  const result = probe(42, "careful");
  expect(result).toHaveProperty("replayMatches", true);
  expect(result).toHaveProperty("hash", expect.stringMatching(/^[0-9a-f]{8}$/));
});

it("keeping a private notebook spends the copying hour that lending saves", () => {
  const game = play(42, ["welcome", "check", "private", "ask", "push", "compare", "delegate"]);
  const kept = choose(game, "protect");
  const lent = choose(game, "publish");
  expect(kept.stretches).toBe(lent.stretches - 1);
  expect(kept.notebookKept).toBe(true);
  expect(lent.notebookKept).toBe(false);
});
