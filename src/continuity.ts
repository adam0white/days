import {
  anchorPersonaLife,
  type CastShelf,
  canonicalCast,
  claimCastChapterBatch,
  createPersona,
  initialPersonaLife,
  type LifePreparation,
  PERSONA_ORIGINS,
  type PersonaEnvelope,
  projectPortablePerson,
} from "@adam0white/lab-client";
import { createGame, type Game, sharedCast } from "./engine.ts";

const source: PersonaEnvelope["source"] = {
  game: "days",
  build: "three-days-3",
  engine: "4.0.0",
  rules: "three-days-3",
};

/** Fresh plays use the shared shelf on supported game origins. */
export async function enableContinuity(
  shelf: {
    readonly ready: Promise<boolean>;
    readonly enabled: boolean;
    setEnabled(value: boolean): void;
  },
  origin: string,
): Promise<boolean> {
  await shelf.ready;
  if (!shelf.enabled && PERSONA_ORIGINS.has(origin)) {
    shelf.setEnabled(true);
    await shelf.ready;
  }
  return shelf.enabled;
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
      claimTransfer: (initial: Game, input: LifePreparation) => ({
        ...projection(initial, input.parent.castId, [], input.parent),
        life: input.life,
      }),
    },
  );
  const game = result?.initial ?? createGame(seed);
  game.chapter = { claims: result?.claims ?? [], startedAt, completed: false };
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
  const now = Date.now();
  const envelopes = await Promise.all(
    sharedCast.map(async (castId) => {
      const claim = chapter.claims.find((item) => item.castId === castId);
      const input = game.carry?.find((item) => item.parent.castId === castId);
      if (Boolean(claim) !== Boolean(input)) throw new Error("The chapter receipt is incomplete.");
      const branchId = claim?.branchId ?? `days-${crypto.randomUUID()}`;
      const life = input
        ? anchorPersonaLife(input.life, castId, now)
        : initialPersonaLife(castId, branchId, now);
      const action =
        castId === sharedCast[0]
          ? game.inputs.includes("welcome")
            ? "Hacer brought soup into the visit."
            : "Hacer left soup at the door."
          : castId === sharedCast[1]
            ? game.compared
              ? "Burak helped check the account."
              : "The account was part of the visit."
            : game.asked
              ? "Selin was asked to cover the door."
              : "Selin was not asked to cover the door.";
      const history = [`Three Days ended with ${game.outcome}. ${action}`];
      const hostObligations =
        castId === sharedCast[1]
          ? [
              ...(!game.notebookKept ? ["return Leyla's notebook"] : []),
              ...(game.paid ? ["return Leyla's mistaken payment"] : []),
              ...(game.inputs.includes("leave") ? ["deliver the photograph and letter"] : []),
              ...(game.named && game.inputs.includes("name")
                ? ["follow up with the estate contact"]
                : []),
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
      sharedCast.map((id) => [id, chapter.claims.find((p) => p.castId === id)?.revision ?? null]),
    ),
  });
}
