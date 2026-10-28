import { expect, it } from "vitest";
import { createGame } from "../src/engine.ts";

it("rejects an invalid pinned parent instead of silently starting a fresh person", () => {
  expect(() => createGame(1, [{ parent: { castId: "hf.cast.selin.voice" } } as never])).toThrow();
});

it("carries a person through a fresh play and replays without reading the shelf", async () => {
  const {
    acceptPersonaBatch,
    canonicalCast,
    createPersona,
    initialPersonaLife,
    preparePersonaLife,
    projectPortablePerson,
    validatePortablePerson,
  } = await import("@adam0white/lab-client");
  const { startContinuity, checkpointContinuity } = await import("../src/continuity.ts");
  const { choose, exportRun, replay, sharedCast } = await import("../src/engine.ts");
  const castId = sharedCast[0]!;
  const person = JSON.parse(JSON.stringify(createGame(42).actors.current.people[castId]!));
  person.body.satiety = 0.41;
  const branchId = "days-test-branch";
  const parent = await createPersona({
    format: "hf-persona/1",
    castId,
    castRevision: canonicalCast(castId).revision,
    branchId,
    parentRevision: null,
    source: { game: "days", build: "test", engine: "4.0.0", rules: "test" },
    transfer: {
      ...projectPortablePerson({ castId, game: "days", engine: "4.0.0", person, history: [] }),
      life: initialPersonaLife(castId, branchId, Date.now()),
    },
    limitations: [],
  });
  let state: import("@adam0white/lab-client").PersonaShelfState = {
    revisions: [parent],
    heads: { [castId]: parent.revision },
  };
  let reads = 0;
  const shelf = {
    async request<T>(request: import("@adam0white/lab-client").PersonaRequest): Promise<T> {
      if (request.action === "prepareBatch") {
        reads++;
        return {
          inputs: [preparePersonaLife(parent, Date.now())],
          blocked: [],
          expectedHeads: Object.fromEntries(sharedCast.map((id) => [id, state.heads[id] ?? null])),
        } as T;
      }
      if (request.action === "putBatch") {
        state = acceptPersonaBatch(state, request.envelopes ?? [], request.expectedHeads);
        return undefined as T;
      }
      throw new Error("Unexpected shelf read");
    },
  };
  let game = await startContinuity(shelf, 42, () => true);
  expect(game.actors.current.people[castId]!.body.satiety).toBeCloseTo(0.41);
  const claim = state.revisions.find((p) => p.revision === state.heads[castId])!;
  expect(claim.parentRevision).toBe(parent.revision);
  expect(claim.transfer.portableClaim).toEqual({ game: "days" });
  const voiceActor = { ...game.actors.current.people[castId]!, id: "hacer" };
  expect(() =>
    projectPortablePerson({
      castId,
      game: "voice",
      engine: "4.0.0",
      person: voiceActor,
      history: [],
      previous: claim,
    }),
  ).toThrow(/belongs to another chapter/);
  expect(validatePortablePerson(claim.transfer.portable).state.body.satiety).toBeCloseTo(
    game.actors.current.people[castId]!.body.satiety,
  );
  for (const id of [
    "welcome",
    "check",
    "private",
    "ask",
    "push",
    "compare",
    "delegate",
    "protect",
    "dismiss",
    "confirm",
    "speak",
    "close",
  ])
    game = choose(game, id);
  const beforeReplay = reads;
  expect(replay(JSON.parse(JSON.stringify(exportRun(game))))).toEqual(game);
  expect(reads).toBe(beforeReplay);
  await checkpointContinuity(shelf, game, () => true);
  const checkpoint = state.revisions.find((p) => p.revision === state.heads[castId])!;
  expect(checkpoint.parentRevision).toBe(claim.revision);
  expect(checkpoint.transfer.portableClaim).toBeUndefined();
  expect(validatePortablePerson(checkpoint.transfer.portable).state.body.satiety).toBeCloseTo(
    game.actors.current.people[castId]!.body.satiety,
  );
}, 60_000);

it.each([
  ["notebook return", "protect", "publish"],
  ["mistaken payment", "check", "pay"],
  ["delivery", "confirm", "leave"],
  ["estate follow-up", "dismiss", "name"],
])("refuses a checkpoint with an unresolved Burak %s", async (_name, insteadOf, choice) => {
  const { checkpointContinuity } = await import("../src/continuity.ts");
  const { choose } = await import("../src/engine.ts");
  let game = createGame(42);
  game.chapter = { claims: [], startedAt: 1, completed: false };
  for (const id of [
    "welcome",
    "check",
    "private",
    "ask",
    "push",
    "compare",
    "delegate",
    "protect",
    "dismiss",
    "confirm",
    "speak",
    "close",
  ])
    game = choose(game, id === insteadOf ? choice : id);
  expect(game.outcome).not.toBe("playing");
  let writes = 0;
  const shelf = {
    async request<T>(): Promise<T> {
      writes++;
      return undefined as T;
    },
  };
  await expect(checkpointContinuity(shelf, game, () => true)).rejects.toThrow(/Burak/);
  expect(writes).toBe(0);
});

it("enables the shared shelf for a first play on the game origin", async () => {
  const continuity = await import("../src/continuity.ts");
  expect(continuity).toHaveProperty("enableContinuity");
  const shelf = {
    enabled: false,
    get ready() {
      return Promise.resolve(this.enabled);
    },
    setEnabled(value: boolean) {
      this.enabled = value;
    },
  };
  expect(await continuity.enableContinuity(shelf, "https://days.adamwhite.work")).toBe(true);
  expect(shelf.enabled).toBe(true);
  shelf.enabled = false;
  expect(await continuity.enableContinuity(shelf, "https://example.com")).toBe(false);
});

it("does not create a Burak delivery duty when the delivery attempt has no hour", async () => {
  const { checkpointContinuity } = await import("../src/continuity.ts");
  const { choose } = await import("../src/engine.ts");
  let game = createGame(42);
  game.chapter = { claims: [], startedAt: 1, completed: false };
  for (const id of [
    "welcome",
    "check",
    "private",
    "hide",
    "rest",
    "compare",
    "delegate",
    "protect",
    "dismiss",
  ])
    game = choose(game, id);
  // Use the game's existing host hour counter to exercise a refused agreement.
  game.stretches = 0;
  game = choose(game, "leave");
  expect(game.confirmed).toBe(false);
  for (const id of ["silent", "close"]) game = choose(game, id);
  let writes = 0;
  const shelf = {
    async request<T>(): Promise<T> {
      writes++;
      return undefined as T;
    },
  };
  await expect(checkpointContinuity(shelf, game, () => true)).resolves.toBeUndefined();
  expect(writes).toBe(1);
}, 60_000);

it("refuses an older successful-delivery save that lacks the agreed-delivery fact", async () => {
  const { choose, exportRun, hashGame, replay } = await import("../src/engine.ts");
  let game = createGame(42);
  for (const id of [
    "welcome",
    "check",
    "private",
    "ask",
    "push",
    "compare",
    "delegate",
    "protect",
    "dismiss",
    "leave",
    "speak",
    "close",
  ])
    game = choose(game, id);
  expect(game.deliveryAssigned).toBe(true);
  const old = exportRun(game);
  delete old.state.deliveryAssigned;
  old.hash = hashGame(old.state);
  expect(() => replay(old)).toThrow(/earlier Three Days build.*delivery.*Start a new play/);
});

it("does not assign a delivery when leave is refused and Leyla later makes the visit", async () => {
  const {
    exportRun: exportArchive,
    restoreRun,
    step,
  } = await import("@adam0white/human-framework");
  const { checkpointContinuity } = await import("../src/continuity.ts");
  const { choose } = await import("../src/engine.ts");
  let game = createGame(42);
  game.chapter = { claims: [], startedAt: 1, completed: false };
  for (const id of [
    "welcome",
    "check",
    "private",
    "ask",
    "push",
    "compare",
    "delegate",
    "protect",
    "dismiss",
  ])
    game = choose(game, id);
  const changeBody = (
    receipt: { type: "fallen"; cause: string } | { type: "stood"; actionReceipt: string },
  ) => {
    const run = restoreRun(game.actors);
    if (!run.ok) throw new Error("Unable to restore test run");
    const at = game.actors.current.at + 60_000;
    const result = step(run.value, {
      until: at,
      inputs: [
        {
          id: `test:${receipt.type}`,
          at,
          source: { type: "host", id: "days" },
          kind: "body.received",
          payload: { person: "hf.cast.leyla.days", evidenceId: `test:${receipt.type}`, receipt },
        },
      ],
    });
    if (!result.ok) throw new Error(result.error.message);
    game.actors = exportArchive(run.value);
  };
  changeBody({ type: "fallen", cause: "test" });
  game = choose(game, "leave");
  expect(game.refused).toBe(true);
  changeBody({ type: "stood", actionReceipt: "test:stand" });
  game = choose(game, "confirm");
  expect(game.confirmed).toBe(true);
  for (const id of ["speak", "close"]) game = choose(game, id);
  expect(game.text.join(" ")).toContain("The visit was kept.");
  let writes = 0;
  const shelf = {
    async request<T>(): Promise<T> {
      writes++;
      return undefined as T;
    },
  };
  await expect(checkpointContinuity(shelf, game, () => true)).resolves.toBeUndefined();
  expect(writes).toBe(1);
}, 60_000);
