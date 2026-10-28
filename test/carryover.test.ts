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
  const castId = sharedCast[1]!;
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
          inputs: sharedCast.flatMap((id) => {
            const head = state.revisions.find((p) => p.revision === state.heads[id]);
            return head ? [preparePersonaLife(head, Date.now())] : [];
          }),
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
  let unsafeEnding = game;
  for (const id of [
    "welcome",
    "pay",
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
    unsafeEnding = choose(unsafeEnding, id);
  expect(unsafeEnding.outcome).not.toBe("playing");
  expect(unsafeEnding.paid).toBe(true);
  await expect(checkpointContinuity(shelf, unsafeEnding, () => true)).rejects.toThrow(/Burak/);
  let refusedFresh = false;
  try {
    await startContinuity(shelf, 43, () => true);
  } catch {
    refusedFresh = true;
  }
  expect(refusedFresh).toBe(true);
  expect(state.heads[castId]).toBe(claim.revision);
  const otherActor = game.actors.current.people[castId];
  expect(() =>
    projectPortablePerson({
      castId,
      game: "commonstead",
      engine: "4.0.0",
      person: otherActor,
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
  const next = await startContinuity(shelf, 43, () => true);
  expect(next.carry?.find((input) => input.parent.castId === castId)?.parent.revision).toBe(
    checkpoint.revision,
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

it("keeps explicit continuity opt-out off and starts a local play without shelf writes", async () => {
  const continuity = await import("../src/continuity.ts");
  expect(continuity).toHaveProperty("startFreshGame");
  let writes = 0;
  const shelf = {
    enabled: false,
    get ready() {
      return Promise.resolve(this.enabled);
    },
    setEnabled(value: boolean) {
      writes++;
      this.enabled = value;
    },
    async request<T>(): Promise<T> {
      writes++;
      throw new Error("Unexpected shelf request");
    },
  };
  const game = await continuity.startFreshGame(shelf, 42, () => true);
  expect(game.outcome).toBe("playing");
  expect(game.chapter).toBeUndefined();
  expect(shelf.enabled).toBe(false);
  expect(writes).toBe(0);
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

it("keeps a person locked elsewhere while carrying the rest of the cast", async () => {
  const {
    acceptPersonaBatch,
    canonicalCast,
    createPersona,
    initialPersonaLife,
    preparePersonaLife,
    projectPortablePerson,
  } = await import("@adam0white/lab-client");
  const { startContinuity, checkpointContinuity } = await import("../src/continuity.ts");
  const { choose, exportRun, replay, sharedCast } = await import("../src/engine.ts");
  const base = createGame(42);
  const parentFor = async (castId: string, foreignLock: boolean) => {
    const branchId = `test-${castId}`;
    return createPersona({
      format: "hf-persona/1",
      castId,
      castRevision: canonicalCast(castId).revision,
      branchId,
      parentRevision: null,
      source: { game: "days", build: "test", engine: "4.0.0", rules: "test" },
      transfer: {
        ...projectPortablePerson({
          castId,
          game: "days",
          engine: "4.0.0",
          person: base.actors.current.people[castId],
          history: [],
        }),
        life: initialPersonaLife(castId, branchId, Date.now()),
        ...(foreignLock ? { portableClaim: { game: "voice" } } : {}),
      },
      limitations: [],
    });
  };
  const hacer = await parentFor(sharedCast[0]!, true);
  const burak = await parentFor(sharedCast[1]!, false);
  let state: import("@adam0white/lab-client").PersonaShelfState = {
    revisions: [hacer, burak],
    heads: { [hacer.castId]: hacer.revision, [burak.castId]: burak.revision },
  };
  const batches: import("@adam0white/lab-client").PersonaRequest[] = [];
  const shelf = {
    async request<T>(request: import("@adam0white/lab-client").PersonaRequest): Promise<T> {
      if (request.action === "prepareBatch")
        return {
          inputs: state.revisions
            .filter((p) => state.heads[p.castId] === p.revision)
            .map((p) => preparePersonaLife(p, Date.now())),
          blocked: [],
          expectedHeads: Object.fromEntries(sharedCast.map((id) => [id, state.heads[id] ?? null])),
        } as T;
      if (request.action === "putBatch") {
        batches.push(request);
        state = acceptPersonaBatch(state, request.envelopes ?? [], request.expectedHeads);
        return undefined as T;
      }
      throw new Error("Unexpected shelf request");
    },
  };
  let game = await startContinuity(shelf, 42, () => true);
  expect(game.chapter?.skipped).toContain(hacer.castId);
  expect(state.heads[hacer.castId]).toBe(hacer.revision);
  expect(state.heads[burak.castId]).not.toBe(burak.revision);
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
  await checkpointContinuity(shelf, game, () => true);
  expect(replay(JSON.parse(JSON.stringify(exportRun(game))))).toEqual(game);
  expect(batches.at(-1)?.expectedHeads).not.toHaveProperty(hacer.castId);
  expect(batches.at(-1)?.envelopes?.map((p) => p.castId)).not.toContain(hacer.castId);
  expect(state.heads[hacer.castId]).toBe(hacer.revision);
  expect(state.heads[burak.castId]).not.toBe(burak.revision);
  expect(state.heads[sharedCast[2]!]).toBeDefined();
}, 60_000);
