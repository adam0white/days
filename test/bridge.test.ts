import assert from "node:assert/strict";
import {
  exportRun,
  type Input,
  preview,
  type Result,
  type Run,
  replay,
  restoreRun,
  step,
} from "@adam0white/human-framework";
import { expect, it } from "vitest";
import { createGame } from "../src/engine.ts";

const need = <T>(r: Result<T>): T => {
  if (!r.ok) throw new Error(JSON.stringify(r.error));
  return r.value;
};

it("restores pending and active game work, previews without mutation and replays exactly", () => {
  const run = need(restoreRun(createGame(42).actors));
  const at = exportRun(run).current.at + 60_000;
  const source = { type: "host", id: "days" } as const;
  const person = "hf.cast.leyla.days";
  const offer = {
    id: "control-rest",
    actionId: "rest",
    label: "rest",
    person,
    durationMs: 60_000,
    participants: [],
    alongside: [],
    demands: { effort: 0, focus: 0, mode: "awake" as const, requires: {} },
    tags: ["rest"],
    norms: [],
    expected: { needs: {}, followedBy: [], provenance: ["control"] },
    fulfills: [],
    advances: [],
    diminishes: [],
  };
  const pending = need(
    step(run, {
      until: at,
      inputs: [
        {
          id: "control:offer",
          at,
          source,
          kind: "offers.received",
          payload: { person, revision: 1, offers: [offer] },
        },
        {
          id: "control:decision",
          at,
          source,
          kind: "decision.requested",
          payload: { person, reason: "control", treatment: "ordinary", offerRevision: 1 },
        },
      ],
    }),
  );
  assert.equal(pending.boundary.type, "world-required");
  const pendingArchive = JSON.parse(JSON.stringify(exportRun(run)));
  const pendingCopy = need(restoreRun(pendingArchive));
  for (const target of [run, pendingCopy])
    expect(need(step(target, { until: at, inputs: [] })).boundary).toEqual(pending.boundary);
  function settle(target: Run, until: number) {
    let result = need(step(target, { until, inputs: [] }));
    for (let n = 0; result.boundary.type === "world-required"; n++) {
      assert.ok(n < 8);
      const inputs: Input[] = result.boundary.requests.map((request) => {
        assert.equal(request.kind, "action");
        if (request.kind !== "action") throw new Error("Unexpected communication");
        return {
          id: `control:answer:${request.id}`,
          at: request.boundaryAt,
          source,
          kind: "action.resolved",
          payload: {
            requestId: request.id,
            requestHash: request.requestHash,
            worldRevision: request.worldRevision,
            person,
            activityId: request.activityId,
            stage: request.stage,
            observations: [],
            ...(request.stage === "start"
              ? { disposition: "accepted" as const }
              : {
                  disposition: "completed" as const,
                  outcome: {
                    activityId: request.activityId,
                    offerId: offer.id,
                    actionId: "rest",
                    start: at,
                    end: request.boundaryAt,
                    status: "completed" as const,
                    evidenceId: request.id,
                    summary: "rested",
                    actual: { exposures: [], observedProgress: [] },
                    fulfills: [],
                    advances: [],
                  },
                }),
          },
        };
      });
      result = need(step(target, { until, inputs }));
    }
  }
  settle(run, at);
  settle(pendingCopy, at);
  const active = exportRun(run);
  expect(exportRun(pendingCopy)).toEqual(active);
  const restored = need(restoreRun(JSON.parse(JSON.stringify(active))));
  const before = JSON.stringify(exportRun(restored));
  need(
    preview(restored, {
      perspective: { kind: "person", observer: person },
      person,
      until: at + 60_000,
      inputs: [],
    }),
  );
  expect(JSON.stringify(exportRun(restored))).toBe(before);
  // Withdraw before completion so the actor cannot take the same offer again.
  const withdraw: Input = {
    id: "control:withdraw",
    at: at + 1,
    source,
    kind: "offers.received",
    payload: { person, revision: 2, offers: [] },
  };
  for (const target of [run, restored]) {
    need(step(target, { until: at + 1, inputs: [withdraw] }));
    settle(target, at + 60_000);
  }
  const final = exportRun(run);
  expect(exportRun(restored)).toEqual(final);
  expect(need(replay(final))).toMatchObject({ verified: true, fullHash: final.hashes.full });
});
