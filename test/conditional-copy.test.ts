import { expect, it } from "vitest";
import { choose, createGame, exportRun, type Game, replay } from "../src/engine.ts";

function play(ids: string[], seed = 42): Game {
  let game = createGame(seed);
  for (const id of ids) game = choose(game, id);
  return game;
}
const prefix = ["welcome", "check", "private", "ask", "push", "compare", "delegate"];
const text = (game: Game) => game.text.join(" ");

it("asks the actual receipt holder for evidence without Burak asking for his own name", () => {
  for (const holder of ["Burak", "Hacer", "Selin"]) {
    const seed = Array.from({ length: 50 }, (_, i) => i).find(
      (i) => createGame(i).evidenceHolder === holder,
    )!;
    const game = play(["welcome"], seed);
    expect(text(game)).toContain(`${holder} has the receipt`);
    expect(text(game)).toContain(holder === "Burak" ? "He unfolds it" : `Burak asks ${holder}`);
  }
});

it("requests the original only while it is missing", () => {
  const checked = play(["welcome", "check", "private", "hide", "rest"]);
  const unchecked = play(["welcome", "pay", "private", "hide", "rest"]);
  expect(text(checked)).not.toContain("We need the original receipt");
  expect(text(unchecked)).toContain("We need the original receipt");
});

it("describes the notebook as closed only while its private page stayed private", () => {
  for (const page of ["private", "read"]) {
    const game = play(["welcome", "check", page, "ask", "push", "compare", "delegate"]);
    const choice = game.choices.find((c) => c.id === "publish")!;
    expect(choice.label.includes("closed notebook")).toBe(page === "private");
    expect(choice.cost?.includes("closed notebook")).toBe(page === "private");
    const lent = choose(game, "publish");
    expect(text(lent).includes("earlier disclosure")).toBe(page === "read");
    expect(text(lent).includes("takes the closed notebook")).toBe(page === "private");
  }
});

it("does not invent a privacy harm when copying has no time left", () => {
  for (const page of ["private", "read"]) {
    const game = play(["welcome", "check", page, "ask", "push", "compare", "delegate"]);
    game.stretches = 0;
    expect(text(choose(game, "protect")).includes("disclosure")).toBe(page === "read");
  }
});

it("mentions Burak's repayment only after Leyla paid the mistaken demand", () => {
  for (const payment of ["check", "pay"]) {
    const game = play([
      "alone",
      payment,
      "private",
      "ask",
      "rest",
      "compare",
      "delegate",
      "publish",
      "dismiss",
    ]);
    expect(game.paidCreditor).toBe(true);
    expect(text(game).includes("Burak still owes her")).toBe(payment === "pay");
  }
});

it("lets Selin leave before Leyla rests alone", () => {
  const game = play([...prefix, "publish", "dismiss", "leave", "silent"]);
  expect(text(game)).toContain("Selin does not press. She goes home.");
  expect(text(game)).not.toContain("beside her");
});

it("names the unkept visit or unpaid agreed delivery and Şükrü's wait", () => {
  for (const arrangement of ["delegate", "conceal"]) {
    const game = play([
      "welcome",
      "check",
      "private",
      "hide",
      "rest",
      "compare",
      arrangement,
      "protect",
      "name",
      "leave",
      "silent",
      "close",
    ]);
    expect(game.outcome).toBe("lost");
    expect(text(game)).toContain("Şükrü is still waiting");
    expect(text(game)).toContain("photograph and letter");
    expect(text(game)).toContain(
      arrangement === "conceal"
        ? "agreed later delivery has not been paid for"
        : "promised visit has not happened",
    );
    expect(text(game)).not.toContain("visit or delivery");
    expect(replay(exportRun(game))).toEqual(game);
  }
});

it("mentions carrying the envelope only while the visit or handoff is unfinished", () => {
  for (const answer of ["confirm", "leave"]) {
    const game = play([...prefix, "publish", "dismiss", answer, "silent"]);
    expect(game.confirmed).toBe(true);
    expect(text(game)).not.toContain("envelope must leave with Leyla");
  }
  const unfinished = play([
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
    "silent",
  ]);
  expect(text(unfinished)).toContain("envelope must leave with Leyla");
  expect(text(unfinished)).not.toContain("if its visit");
});

it("quotes the actual uncovered travel hours when Selin goes home", () => {
  const seed = Array.from({ length: 50 }, (_, i) => i).find((i) => createGame(i).fatigue === 3)!;
  const exhausted = play(["alone", "check", "private", "hide"], seed);
  expect(exhausted.fatigue).toBeGreaterThanOrEqual(4);
  expect(exhausted.text.join(" ")).toContain("visit without cover takes 3 hours");
  const asking = play(["alone", "check", "private"], seed);
  expect(text(choose(asking, "ask"))).toContain("visit will take 3 hours");
});

it("offers containment of the actual disclosure instead of copying an already exposed page", () => {
  for (const page of ["private", "read"]) {
    const game = play(["welcome", "check", page, "ask", "push", "compare", "delegate"]);
    expect(game.choices.find((c) => c.id === "protect")?.cost?.includes("apologise")).toBe(
      page === "read",
    );
  }
});

it("names the actual reason the account cannot be recorded", () => {
  const ready = play([...prefix, "publish"]);
  ready.stretches = 0;
  expect(text(choose(ready, "name"))).toContain("no writing hour remains");
  expect(text(choose(ready, "name"))).not.toContain("unconfirmed");
  ready.compared = false;
  ready.stretches = 2;
  expect(text(choose(ready, "name"))).toContain("entries are unconfirmed");
  expect(text(choose(ready, "name"))).not.toContain("no writing hour remains");
});

it("leaves the soup uneaten when Leyla kept the door", () => {
  for (const opening of ["welcome", "alone"]) {
    const game = play([opening, "check", "private", "hide"]);
    expect(text(game).includes("soup bowl is empty")).toBe(opening === "welcome");
    expect(text(game).includes("soup waits by the door")).toBe(opening === "alone");
  }
});

it("does not erase a successful comparison when recording the account has no hour", () => {
  const ready = play([...prefix, "publish"]);
  ready.stretches = 0;
  const unrecorded = choose(ready, "name");
  expect(unrecorded.compared).toBe(true);
  expect(unrecorded.named).toBe(false);
  expect(text(unrecorded)).not.toContain("still being treated as one");
  expect(text(unrecorded)).toContain("still needs a recorded resolution");
});

it("shows actual cover, receipt and account facts in Ink", () => {
  for (const cover of ["ask", "hide"]) {
    const game = play(["welcome", "check", "private", cover, "push", "compare"]);
    expect(game.helper).toBe(cover === "ask");
    expect(text(game).includes("Someone has agreed")).toBe(cover === "ask");
    expect(text(game).includes("Nobody has agreed")).toBe(cover === "hide");
    const arranged = choose(choose(game, "delegate"), "publish");
    expect(text(arranged)).toContain("He can use the original receipt");
    expect(text(choose(arranged, "dismiss"))).toContain("account now has separate entries");
    arranged.compared = false;
    arranged.visit = false; // Defensive branch: authored visit choices both secure agreement.
    const unresolved = choose(arranged, "dismiss");
    expect(text(unresolved)).toContain("no answer about the envelope");
    expect(text(unresolved)).toContain("still needs a recorded resolution");
  }
  let unchecked = play(["alone", "pay", "private", "hide", "push"]);
  unchecked.stretches = 0;
  for (const id of ["guess", "delegate", "publish"]) unchecked = choose(unchecked, id);
  expect(unchecked.checked).toBe(false);
  expect(text(unchecked)).toContain("He needs the original receipt first");
});

it("quotes checking costs for originals, disclosure, fatigue and phone work", () => {
  const cases = [
    ["welcome", "check", "private", "rest", "1 hour", "2 hours"],
    ["welcome", "pay", "private", "rest", "2 hours", "2 hours"],
    ["welcome", "check", "read", "rest", "0 hours", "2 hours"],
    ["alone", "check", "private", "push", "2 hours", "3 hours"],
    ["alone", "pay", "private", "push", "3 hours", "3 hours"],
  ];
  for (const [opening, payment, page, rest, local, remote] of cases) {
    const game = play([opening!, payment!, page!, "hide", rest!]);
    expect(game.choices.find((c) => c.id === "compare")?.cost?.startsWith(local!)).toBe(true);
    expect(game.choices.find((c) => c.id === "guess")?.cost?.startsWith(remote!)).toBe(true);
  }
});

it("quotes visit costs for help, fatigue and changing a later arrangement", () => {
  for (const [cover, rest, arrangement, hours, tired] of [
    ["ask", "rest", "delegate", 1, false],
    ["hide", "rest", "conceal", 2, false],
    ["ask", "push", "delegate", 1, true],
  ] as const) {
    const game = play([
      "welcome",
      "check",
      "private",
      cover,
      rest,
      "compare",
      arrangement,
      "publish",
      "dismiss",
    ]);
    const cost = game.choices.find((c) => c.id === "confirm")?.cost;
    expect(cost).toMatch(new RegExp(`^${hours} hour`));
    expect(cost?.includes("change the later arrangement")).toBe(arrangement === "conceal");
    expect(cost?.includes("travel while tired")).toBe(tired);
    const visit = choose(game, "confirm");
    expect(visit.confirmed).toBe(true);
    expect(text(visit).includes("enough strength")).toBe(true);
  }
  const tired = play([
    "alone",
    "pay",
    "private",
    "ask",
    "push",
    "guess",
    "delegate",
    "publish",
    "dismiss",
  ]);
  tired.stretches = 3;
  expect(text(choose(tired, "confirm"))).toContain("keeps the visit short");
});

it("reports actual closed or covered rest and failed budget actions", () => {
  for (const cover of ["ask", "hide"]) {
    const game = play(["welcome", "check", "private", cover]);
    const rested = choose(game, "rest");
    expect(text(rested).includes("Selin covers the door")).toBe(cover === "ask");
    expect(text(rested).includes("door stays closed")).toBe(cover === "hide");
    game.stretches = 0;
    expect(text(choose(game, "rest"))).toContain("no free hour left");
  }
  const door = createGame(42);
  door.stretches = 0;
  expect(text(choose(door, "welcome"))).toContain("no free hour for the meal");
  const claim = play(["welcome"]);
  claim.stretches = 0;
  expect(text(choose(claim, "check"))).toContain("no free hour to obtain");
  const receipt = play(["welcome", "check", "private", "hide", "rest"]);
  receipt.stretches = 0;
  for (const action of ["compare", "guess"]) {
    expect(choose(receipt, action).compared).toBe(false);
    expect(text(choose(receipt, action))).toContain("cannot safely confirm");
  }
});

it("reports each fatigue tier and singular remaining hour", () => {
  const game = play(["welcome"]);
  for (const [fatigue, phrase] of [
    [0, "without a second reader"],
    [2, "tired, but"],
    [3, "very tired"],
    [4, "exhausted"],
  ] as const) {
    game.fatigue = fatigue;
    game.stretches = 2;
    const next = choose(game, "check");
    expect(text(next)).toContain("1 free hour before departure");
    expect(text(next)).toContain(phrase);
  }
});

it("reports receipt retrieval and comparison without inventing repayment", () => {
  for (const holder of ["Burak", "Hacer"]) {
    const claim = play(["welcome"]);
    claim.evidenceHolder = holder;
    expect(text(choose(claim, "check"))).toContain(
      holder === "Burak" ? "Burak fetches his" : "Hacer agrees to bring the",
    );
  }
  for (const payment of ["check", "pay"]) {
    const receipt = play(["alone", payment, "private", "hide", "rest"]);
    for (const action of ["compare", "guess"]) {
      const compared = choose(receipt, action);
      expect(compared.compared).toBe(true);
      expect(text(compared).includes("mistaken payment must be returned")).toBe(payment === "pay");
      expect(text(compared).includes("rests her eyes")).toBe(action === "guess");
    }
  }
});

it("keeps ending histories and unfinished tasks tied to what happened", () => {
  for (const [page, notebook, payment] of [
    ["private", "protect", "check"],
    ["read", "protect", "pay"],
    ["read", "publish", "check"],
  ] as const) {
    const beforeClose = play([
      "alone",
      payment,
      page,
      "ask",
      "rest",
      "compare",
      "delegate",
      notebook,
      "dismiss",
      "leave",
      "silent",
    ]);
    const final = choose(beforeClose, "close");
    expect(text(final).includes("private page stayed private")).toBe(page === "private");
    expect(text(final).includes("agreement to limit its spread")).toBe(
      page === "read" && notebook === "protect",
    );
    expect(text(final).includes("still has the notebook")).toBe(notebook === "publish");
    expect(text(final).includes("mistaken first payment")).toBe(payment === "pay");
    expect(
      text(final).includes("nobody has addressed the harm of reading the private page aloud"),
    ).toBe(page === "read" && notebook === "publish");
    expect(replay(exportRun(final))).toEqual(final);
  }
  const visit = play([...prefix, "publish", "dismiss", "confirm", "silent", "close"]);
  const delivery = play([...prefix, "publish", "dismiss", "leave", "silent", "close"]);
  expect(text(visit)).toContain("The visit was kept");
  expect(text(delivery)).toContain("has not happened yet");
  const unpaid = play([
    "welcome",
    "check",
    "private",
    "hide",
    "rest",
    "guess",
    "conceal",
    "protect",
    "name",
    "leave",
    "silent",
    "close",
  ]);
  expect(text(unpaid)).toContain("account is still disputed");
});

it("does not describe an unfunded apology as copying a private bill", () => {
  const game = play(["welcome", "check", "read", "ask", "push", "compare", "delegate"]);
  game.stretches = 0;
  expect(text(choose(game, "protect"))).toContain("no hour left to apologise");
});

it("offers the actual door arrangement for rest", () => {
  for (const cover of ["ask", "hide"]) {
    const game = play(["welcome", "check", "private", cover]);
    const label = game.choices.find((c) => c.id === "rest")?.label;
    expect(label?.includes("Selin covers the door")).toBe(cover === "ask");
    expect(label?.includes("door is closed")).toBe(cover === "hide");
  }
});

it("offers apology after disclosure instead of promising to prevent a past disclosure", () => {
  for (const page of ["private", "read"]) {
    const game = play(["welcome", "check", page, "ask", "push", "compare", "delegate"]);
    const label = game.choices.find((c) => c.id === "protect")?.label;
    expect(label?.includes("Apologise")).toBe(page === "read");
    expect(label?.includes("without sharing")).toBe(page === "private");
  }
});

it("limits the advertised disclosure saving to a private comparison", () => {
  const offer = play(["welcome", "check"]);
  expect(offer.choices.find((c) => c.id === "read")?.cost).toContain("private comparison");
  const receipt = (page: string) => play(["welcome", "check", page, "hide", "rest"]);
  const closed = receipt("private");
  const disclosed = receipt("read");
  const cost = (game: Game, id: string) => game.choices.find((c) => c.id === id)?.cost;
  expect(cost(closed, "guess")).toBe(cost(disclosed, "guess"));
  expect(cost(closed, "compare")).not.toBe(cost(disclosed, "compare"));
});
