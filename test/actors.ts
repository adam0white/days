import {
  type DeepReadonly,
  inspect,
  type Result,
  restoreRun,
  type VisibleEvent,
} from "@adam0white/human-framework";
import type { Game } from "../src/engine.ts";

export const LEYLA = "hf.cast.leyla.days";
export const SELIN = "hf.cast.selin.voice";
function need<T>(result: Result<T>): T {
  if (!result.ok) throw new Error(`${result.error.code} ${result.error.path}`);
  return result.value;
}
/** Read one person's HF state from the game's archive, from the host's perspective. */
function read(game: Game, person: string) {
  const view = need(
    inspect(need(restoreRun(game.actors)), {
      perspective: { kind: "host" },
      people: [person],
      select: ["events", "relationships"],
    }),
  );
  const found = view.people[0];
  if (found?.kind !== "host") throw new Error("HF did not return the person.");
  let events: DeepReadonly<VisibleEvent[]> = [];
  let ties: readonly { otherId: string; affection: number }[] = [];
  for (const part of found.parts) {
    if (part.select === "events") events = part.value;
    if (part.select === "relationships") ties = part.value.ties;
  }
  return { events, ties };
}
/** The offers this person actually chose, in order (reviews of an ongoing act excluded). */
export function decisions(game: Game, person: string): (string | null)[] {
  return read(game, person).events.flatMap((e) =>
    "access" in e && e.access === "host" && e.data.kind === "decision" && !e.data.decision.review
      ? [e.data.decision.chosenAffordanceId]
      : [],
  );
}
export function tie(game: Game, person: string, other: string) {
  return read(game, person).ties.find((t) => t.otherId === other);
}
