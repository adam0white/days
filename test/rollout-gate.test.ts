import { portableWriteBlockers } from "@adam0white/lab-client";
import { expect, it } from "vitest";
import { checkpointContinuity } from "../src/continuity.ts";
import { createGame, sharedCast } from "../src/engine.ts";

it("does not publish any person until their peer readers are ready", async () => {
  for (const id of sharedCast) expect(portableWriteBlockers(id, "days").length).toBeGreaterThan(0);
  const game = createGame(42);
  game.chapter = { claims: [], startedAt: 1, completed: false };
  game.outcome = "won";
  let writes = 0;
  await checkpointContinuity(
    {
      request: async () => {
        writes++;
      },
    } as never,
    game,
    () => true,
  );
  expect(writes).toBe(0);
});

it("skips a Voice source without replacing its saved head", async () => {
  const { inspect, restoreRun } = await import("@adam0white/human-framework");
  const { canonicalCast, createPersona, initialPersonaLife, preparePersonaLife } = await import(
    "@adam0white/lab-client"
  );
  const { startContinuity } = await import("../src/continuity.ts");
  const id = sharedCast[0]!;
  const restored = restoreRun(createGame(42).actors);
  if (!restored.ok) throw new Error(restored.error.message);
  const result = inspect(restored.value, {
    perspective: { kind: "host" },
    people: [id],
    select: ["persona"],
    portable: { person: id, castId: id, castRevision: canonicalCast(id).revision },
  });
  if (!result.ok) throw new Error(result.error.message);
  const entry = result.value.people[0];
  if (entry?.kind !== "host") throw new Error("Missing projection");
  const part = entry.parts.find((item) => item.select === "persona");
  if (part?.select !== "persona") throw new Error("Missing person");
  const portable = {
    ...structuredClone(part.value),
    source: { ...part.value.source, game: "voice", personId: "hacer" },
  };
  const parent = await createPersona({
    format: "hf-persona/1",
    castId: id,
    castRevision: canonicalCast(id).revision,
    branchId: "voice-control",
    parentRevision: null,
    source: { game: "voice", engine: "4.8.1", build: "synthetic", rules: "control" },
    transfer: {
      castPassport: "hf-portable-person/2",
      portable,
      life: initialPersonaLife(id, "voice-control", Date.now()),
    },
    limitations: [],
  });
  const before = JSON.stringify(parent);
  let claimed = false;
  const shelf = {
    async request<T>(request: import("@adam0white/lab-client").PersonaRequest): Promise<T> {
      if (request.action === "prepareBatch")
        return {
          inputs: [preparePersonaLife(parent, Date.now())],
          blocked: [],
          expectedHeads: Object.fromEntries(
            sharedCast.map((person) => [person, person === id ? parent.revision : null]),
          ),
        } as T;
      if (request.action === "putBatch") {
        claimed = (request.envelopes ?? []).some((p) => p.castId === id);
        return undefined as T;
      }
      throw new Error("Unexpected request");
    },
  };
  const game = await startContinuity(shelf, 43, () => true);
  expect(game.chapter?.skipped).toContain(id);
  expect(claimed).toBe(false);
  expect(JSON.stringify(parent)).toBe(before);
});
