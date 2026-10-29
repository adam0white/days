import framework from "@adam0white/human-framework/package.json" with { type: "json" };
import {
  anchorPersonaLife,
  type CastShelf,
  canonicalCast,
  claimCastChapterBatch,
  createPersona,
  initialPersonaLife,
  type LifePreparation,
  type PersonaEnvelope,
  portableWriteBlockers,
  projectPortablePerson,
} from "@adam0white/lab-client";
import { createGame, type Game, sharedCast } from "./engine.ts";

const source: PersonaEnvelope["source"] = {
  game: "days",
  build: "three-days-5",
  engine: framework.version,
  rules: "three-days-5",
};

/** Respect the shared continuity preference when starting a fresh play. */
export async function startFreshGame(
  shelf: CastShelf & { readonly ready: Promise<boolean>; readonly enabled: boolean },
  seed: number,
  isCurrent: () => boolean,
): Promise<Game> {
  await shelf.ready;
  return shelf.enabled ? startContinuity(shelf, seed, isCurrent) : createGame(seed);
}

/** A refused restart must leave the only resumable chapter intact. */
export async function restartFreshGame(
  shelf: CastShelf & { readonly ready: Promise<boolean>; readonly enabled: boolean },
  previous: Game,
  seed: number,
  isCurrent: () => boolean,
): Promise<{ game: Game; retained: boolean }> {
  try {
    await shelf.ready;
    if (previous.chapter && !previous.chapter.completed && previous.chapter.claims.length)
      return { game: previous, retained: true };
    return { game: await startFreshGame(shelf, seed, isCurrent), retained: false };
  } catch {
    return { game: previous, retained: true };
  }
}

function projection(
  game: Game,
  castId: string,
  history: string[],
  previous?: PersonaEnvelope,
  hostObligations: string[] = [],
) {
  const person = game.actors.current.people[castId];
  if (!person) throw new Error("A shared character is missing from this play.");
  try {
    return projectPortablePerson({
      castId,
      game: "days",
      engine: source.engine,
      person,
      calendar: {
        definition: game.actors.initial.spec.definitions.calendar,
        norms: game.actors.initial.spec.definitions.norms,
      },
      history,
      previous,
      hostObligations,
    });
  } catch (error) {
    if (hostObligations.length)
      throw new Error(
        `Burak has unfinished obligations: ${hostObligations.join("; ")}. Continuity was not saved.`,
      );
    throw error;
  }
}

/** A fresh chapter claims all available parents before the opening can be played. */
export async function startContinuity(
  shelf: CastShelf,
  seed: number,
  isCurrent: () => boolean,
): Promise<Game> {
  const startedAt = Date.now();
  const result = await claimCastChapterBatch(
    shelf,
    sharedCast,
    source,
    async (inputs: LifePreparation[]) => createGame(seed, inputs),
    {
      isCurrent,
      admitPerson: (input: LifePreparation) => {
        createGame(seed, [input]);
      },
      claimTransfer: (initial: Game, input: LifePreparation) => ({
        ...projection(initial, input.parent.castId, [], input.parent),
        life: input.life,
      }),
    },
  );
  const game = result?.initial ?? createGame(seed);
  const skipped = result?.blocked.map((item) => item.castId) ?? [];
  game.chapter = {
    claims: result?.claims ?? [],
    startedAt,
    completed: false,
    ...(skipped.length ? { skipped } : {}),
  };
  return game;
}

/** Publish a single atomic checkpoint using only the heads claimed at the opening. */
export async function checkpointContinuity(
  shelf: CastShelf,
  game: Game,
  isCurrent: () => boolean,
): Promise<void> {
  if (!game.chapter || game.chapter.completed || game.outcome === "playing") return;
  const chapter = game.chapter;
  const blocked = sharedCast.filter((id) => portableWriteBlockers(id, "days").length > 0);
  if (chapter.claims.some((claim) => blocked.includes(claim.castId)))
    throw new Error(
      "A saved history is still held by this play. Keep this play until its other games are ready.",
    );
  const eligible = sharedCast.filter(
    (id) => !chapter.skipped?.includes(id) && !blocked.includes(id),
  );
  if (!eligible.length) return;
  const now = Date.now();
  const envelopes = await Promise.all(
    eligible.map(async (castId) => {
      const claim = chapter.claims.find((item) => item.castId === castId);
      const input = game.carry?.find((item) => item.parent.castId === castId);
      if (Boolean(claim) !== Boolean(input)) throw new Error("The chapter receipt is incomplete.");
      const branchId = claim?.branchId ?? `days-${crypto.randomUUID()}`;
      const life = input
        ? anchorPersonaLife(input.life, castId, now)
        : initialPersonaLife(castId, branchId, now);
      const action =
        castId === sharedCast[0]
          ? "Hacer visited during Leyla's leave."
          : castId === sharedCast[1]
            ? "Burak brought an account to the visit."
            : game.asked
              ? "Selin was asked to cover the door."
              : "Selin was not asked to cover the door.";
      const history = [`Three Days ended with ${game.outcome}. ${action}`];
      const hostObligations =
        castId === sharedCast[1]
          ? [
              ...(!game.notebookKept ? ["return Leyla's notebook"] : []),
              ...(game.paid ? ["return Leyla's mistaken payment"] : []),
              ...(game.deliveryAssigned ? ["deliver the photograph and letter"] : []),
              ...(game.estateFollowup ? ["follow up with the estate contact"] : []),
            ]
          : [];
      return createPersona({
        format: "hf-persona/1",
        castId,
        castRevision: canonicalCast(castId).revision,
        branchId,
        parentRevision: claim?.revision ?? null,
        source,
        transfer: { ...projection(game, castId, history, claim, hostObligations), life },
        limitations: claim?.limitations ?? [],
      });
    }),
  );
  if (!isCurrent()) throw new Error("The play changed before the checkpoint.");
  await shelf.request({
    action: "putBatch",
    envelopes,
    expectedHeads: Object.fromEntries(
      eligible.map((id) => [id, chapter.claims.find((p) => p.castId === id)?.revision ?? null]),
    ),
  });
}
