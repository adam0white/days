import {
  type Affordance,
  begin,
  createPerson,
  createRng,
  decide,
  finish,
  type Person,
  perceive,
  random,
  restore,
  snapshot,
  TRAIT_KEYS,
  type Traits,
  tick,
  VALUE_KEYS,
  type Values,
} from "@adam0white/human-framework";
import { Story } from "inkjs";
import compiled from "./story.json";
import type { GameView, Outcome } from "./types.ts";

const VERSION = "three-days-1";
const LEYLA = "hf.cast.leyla.days";
const KEMAL = "hf.cast.kemal.days";
const SELIN = "hf.cast.selin.voice";
const names = ["Leyla", "Hacer", "Burak", "Selin", "Şükrü"];
const ids = [LEYLA, "hf.cast.hacer.voice", "hf.cast.burak.stairwell", SELIN, "hf.cast.sukru.days"];
export interface Game {
  version: string;
  seed: number;
  inputs: string[];
  step: number;
  stretches: number;
  ink: string;
  people: Person[];
  evidenceHolder: string;
  checked: boolean;
  compared: boolean;
  privacy: boolean;
  asked: boolean;
  helper: boolean;
  rested: boolean;
  visit: boolean;
  confirmed: boolean;
  named: boolean;
  spoken: boolean;
  outcome: Outcome;
  text: string[];
  title: string;
  choices: { id: string; label: string }[];
}
export interface Run {
  version: string;
  seed: number;
  inputs: string[];
  state: Game;
  hash: string;
}
function required<T>(value: T | undefined): T {
  if (value === undefined) throw new Error("Required game data is missing.");
  return value;
}
const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value));
function opening(seed: number): Person[] {
  const traits: Partial<Traits>[] = [
    {
      conscientiousness: 0.75,
      extraversion: 0.35,
      agreeableness: 0.45,
      emotionality: 0.65,
      honesty: 0.7,
      openness: 0.6,
    },
    { extraversion: 0.8, agreeableness: 0.45, honesty: 0.5, emotionality: 0.6 },
    { honesty: 0.8, extraversion: 0.3, agreeableness: 0.7, conscientiousness: 0.8, openness: 0.5 },
    { conscientiousness: 0.7, extraversion: 0.6, agreeableness: 0.65, honesty: 0.75 },
    {
      conscientiousness: 0.65,
      extraversion: 0.45,
      agreeableness: 0.55,
      honesty: 0.65,
      emotionality: 0.55,
      openness: 0.4,
    },
  ];
  return names.map((name, i) => {
    const p = createPerson({
      id: required(ids[i]),
      name,
      seed: seed + i,
      now: 480,
      bornAt: 480 - required([49, 58, 31, 32, 79][i]) * 525960,
      sex: i === 2 || i === 4 ? "male" : "female",
      traits: { ...Object.fromEntries(TRAIT_KEYS.map((k) => [k, 0.5])), ...traits[i] },
      values: {
        ...Object.fromEntries(VALUE_KEYS.map((k) => [k, 0.5])),
        ...(i === 3 ? { benevolence: 0.8, achievement: 0.6, tradition: 0.4 } : {}),
      } as Values,
      relationships:
        i === 0
          ? [{ otherId: KEMAL, roles: ["parent"], affection: 0.7, trust: 0.6, familiarity: 1 }]
          : [{ otherId: LEYLA, roles: ["friend"], affection: 0.4, trust: 0.6, familiarity: 0.5 }],
      enable: { fatigueStore: true },
    });
    perceive(p, [
      {
        at: p.now,
        channel: "told",
        kind: "death",
        targetId: KEMAL,
        salience: 1,
        valence: -0.8,
        summary: "Kemal has died. His daughter is receiving condolences.",
      },
    ]);
    return snapshot(p);
  });
}
function runtime(game: Game, load = true): Story {
  const story = new Story(compiled);
  story.state.storySeed = game.seed & 0x7fffffff;
  // These externals only read host facts. Ink lookahead cannot commit an action.
  story.BindExternalFunction("holder", () => game.evidenceHolder, true);
  story.BindExternalFunction("helped", () => game.helper, true);
  story.BindExternalFunction("account", () => game.named, true);
  story.BindExternalFunction("promise", () => game.visit, true);
  story.BindExternalFunction("checked", () => game.checked, true);
  if (load) story.state.LoadJson(game.ink);
  return story;
}
function collect(game: Game, story: Story, consequence?: string) {
  const lines: string[] = [];
  let title = game.title;
  while (story.canContinue) {
    const line = story.Continue()?.trim();
    if (line) lines.push(line);
    for (const tag of story.currentTags ?? [])
      if (tag.startsWith("title:")) title = tag.slice(6).trim();
  }
  game.ink = story.state.ToJson();
  game.title = title;
  game.text = consequence ? [consequence, ...lines] : lines;
  game.choices = story.currentChoices.map((c) => {
    const tags = (c.tags ?? []).filter((t) => t.startsWith("action:"));
    if (tags.length !== 1) throw new Error("Each choice must have exactly one action.");
    return { id: required(tags[0]).slice(7).trim(), label: c.text };
  });
  if (game.step >= 4 && game.step <= 9) {
    const remaining = ["no", "one", "two"][game.stretches];
    let time = `Around the door duty, Leyla has ${remaining} free ${game.stretches === 1 ? "stretch" : "stretches"} left before departure.`;
    if (game.choices.some((c) => c.id === "rest"))
      time +=
        " Rest uses one stretch. So does comparing the account. A visit uses one more unless Selin covers the door.";
    if (game.choices.some((c) => c.id === "compare"))
      time += " Comparing the account uses one stretch.";
    if (game.choices.some((c) => c.id === "confirm"))
      time += game.helper
        ? " Selin's agreed shift frees the stretch for the visit; it costs no further free time."
        : " Going yourself uses one stretch. With none left, the visit cannot happen before departure.";
    game.text.push(time);
  }
}
export function createGame(seed: number): Game {
  if (!Number.isSafeInteger(seed) || seed < 0 || seed > 0xffffffff)
    throw new Error("Use a whole seed from 0 to 4294967295.");
  const rng = createRng(seed);
  const game: Game = {
    version: VERSION,
    seed,
    inputs: [],
    step: 0,
    stretches: 2,
    ink: "",
    people: opening(seed),
    evidenceHolder: required(["Hacer", "Burak", "Selin"][Math.floor(random(rng) * 3)]),
    checked: false,
    compared: false,
    privacy: true,
    asked: false,
    helper: false,
    rested: false,
    visit: false,
    confirmed: false,
    named: false,
    spoken: false,
    outcome: "playing",
    text: [],
    title: "",
    choices: [],
  };
  collect(game, runtime(game, false));
  return game;
}
function act(person: Person, action: string, rest = false, companion?: string): boolean {
  const offer: Affordance = {
    id: `${action}:${person.now}`,
    action: rest ? "rest" : "talk",
    label: action,
    duration: rest ? 60 : 20,
    effort: rest ? 0 : 0.1,
    focus: rest ? 0 : 0.25,
    advertises: rest ? { leisure: 0.4 } : { belonging: 0.3, esteem: 0.2 },
    ...(companion ? { with: [companion], tags: ["social", "help"] } : {}),
  };
  const record = decide(person, [offer]);
  if (record.chosenAffordanceId !== offer.id || !begin(person, offer, record)) return false;
  tick(person, person.now + offer.duration);
  finish(person, {
    affordanceId: offer.id,
    action: offer.action,
    status: "completed",
    at: person.now,
    needs: rest ? { food: 0.5, water: 0.6, leisure: 0.4 } : { belonging: 0.2 },
    summary: action,
  });
  return true;
}
function requestHelp(game: Game): boolean {
  const selin = required(game.people[3]);
  const assist: Affordance = {
    id: "cover",
    action: "help",
    label: "Cover the door for an agreed short shift",
    duration: 20,
    effort: 0.1,
    advertises: { belonging: 0.25, esteem: 0.15 },
    with: [LEYLA],
    tags: ["help", "social"],
  };
  const leave: Affordance = {
    id: "home",
    action: "leave",
    label: "Go home to your own household",
    duration: 60,
    effort: 0.1,
    advertises: { autonomy: 0.7, leisure: 0.7 },
  };
  const record = decide(selin, [assist, leave]);
  const offer = record.chosenAffordanceId === "cover" ? assist : leave;
  if (!begin(selin, offer, record)) return false;
  tick(selin, selin.now + offer.duration);
  finish(selin, {
    affordanceId: offer.id,
    action: offer.action,
    status: "completed",
    at: selin.now,
    needs: offer.advertises,
    summary: offer.label,
  });
  return offer.id === "cover";
}
function apply(game: Game, id: string): string {
  const leyla = required(game.people[0]);
  // Player intent is offered to the actor. HF owns refusal, activity, body and social effects.
  const completed = act(leyla, id, id === "rest" || id === "welcome", SELIN);
  if (!completed && id !== "close")
    return "Leyla cannot take that on now. The conversation moves on without an agreement.";
  switch (id) {
    case "welcome":
      return "Hacer sets down the soup. Leyla eats before answering the next knock.";
    case "alone":
      return "Hacer leaves the soup by the door. Leyla stays standing.";
    case "check":
      game.checked = true;
      return game.evidenceHolder === "Burak"
        ? "Burak holds the claim open and goes to find his original receipt. No money changes hands."
        : `Burak holds the claim open and asks ${game.evidenceHolder} for the original receipt. No money changes hands.`;
    case "pay":
      return "Burak accepts the offered money but cannot certify the claim. A voluntary payment has not identified the creditor.";
    case "private":
      return "Selin turns the private page face down. She stays beside you without asking for its contents.";
    case "read":
      game.privacy = false;
      perceive(required(game.people[3]), [
        {
          at: required(game.people[3]).now,
          channel: "social",
          kind: "harm",
          actorId: LEYLA,
          targetId: SELIN,
          salience: 1,
          valence: -0.7,
          summary: "Leyla read a private hospital page aloud without permission.",
        },
      ]);
      return "The room hears a private hospital name. Selin pulls her chair back. That disclosure cannot be taken back.";
    case "ask":
      game.asked = true;
      game.helper = requestHelp(game);
      return game.helper
        ? "Selin agrees to one short shift, after work. Hacer will bring food. The arrangement has limits."
        : "Selin decides to go home. She cannot cover the door. You will need to close it for a visit yourself.";
    case "hide":
      return "Nobody knows the envelope needs a visit. Nobody can agree to take it.";
    case "rest":
      if (game.stretches === 0) return "There is no free stretch left for the planned rest.";
      game.stretches--;
      game.rested = true;
      return "Leyla eats, lies down and leaves the door covered or closed. The visitors can wait.";
    case "push":
      return "Leyla stays up. The papers are harder to follow. She saves the stretch she would have spent resting.";
    case "compare":
      if (game.stretches === 0)
        return "There is no free stretch left to compare the papers. The account remains unconfirmed.";
      game.stretches--;
      game.compared = game.checked;
      return game.compared
        ? "The receipt and the two entries now agree: Burak received his advance back; Şükrü still has a separate claim."
        : "Without the original check, the copied receipt cannot settle the disputed entry. Burak marks it unconfirmed.";
    case "guess":
      return "The crossed-out entry is treated as a settlement. Şükrü has not agreed to that account.";
    case "delegate":
      game.visit = true;
      return game.helper
        ? "Şükrü agrees that Selin will cover the door while Leyla visits tomorrow."
        : "Leyla tells Şükrü she will close the door and come herself. He agrees to tomorrow. Without cover, the journey will use one free stretch.";
    case "conceal":
      return "The envelope goes back in the drawer. Şükrü receives no explanation.";
    case "protect":
      return "Hacer accepts the closed page. Burak takes only the bill. The hospital story stays with the person it concerns.";
    case "publish":
      game.privacy = false;
      return "The page moves around the room. The account is still a separate question. The private story is now beyond your control.";
    case "name":
      game.named = game.checked && game.compared;
      return game.named
        ? "Şükrü confirms the open bill. Burak accepts the job of sending a corrected statement to the estate contact. Leyla keeps both names and the next step."
        : "Şükrü gives his name, but the conflicting entries have not been checked. Burak cannot sign a corrected statement.";
    case "dismiss":
      return "Şükrü says he has not been paid. The account leaves the room disputed.";
    case "confirm": {
      game.confirmed = game.visit && (game.helper || game.stretches > 0);
      if (game.confirmed && !game.helper) game.stretches--;
      const fatigue = game.rested
        ? ""
        : " Leyla makes the journey tired; she will need rest after it.";
      return game.confirmed
        ? "The visit happens." +
            fatigue +
            " Şükrü receives the photograph and letter. He says Kemal also failed to return a borrowed folding table. Leyla records the neighbour to contact; she does not excuse him."
        : game.visit && !game.helper && game.stretches === 0
          ? "There is no free stretch left for the visit before departure. Şükrü is still waiting. Leyla must arrange a later answer; this promise is not complete."
          : "The visit has no workable arrangement. Şükrü is still waiting for a person and a time.";
    }
    case "leave":
      return "The envelope stays in the drawer. The promised visit has not happened or been handed on.";
    case "speak":
      game.spoken = true;
      return "Selin listens. Leyla says that her marriage ended and she wanted to tell Kemal. Selin does not turn it into a lesson.";
    case "silent":
      return "Selin does not press. Leyla leaves that part of the conversation unsaid.";
    case "close": {
      game.outcome = game.named && game.confirmed && game.privacy && game.spoken ? "won" : "lost";
      if (game.outcome === "won")
        return "You leave with a checked account and a named next step. The visit was kept. You spoke to Selin without giving away someone else’s privacy. These tasks are complete; grief is not.";
      const missing = [
        !game.named ? "the account is still disputed" : "",
        !game.confirmed ? "the promised visit is still unanswered" : "",
        !game.privacy ? "someone else’s private story was exposed" : "",
        !game.spoken ? "you left without speaking to a witness" : "",
      ].filter(Boolean);
      return `You close the door, but ${missing.join("; ")}. These consequences go with you. There is still work to do after your leave.`;
    }
    default:
      throw new Error("Unknown action.");
  }
}
export function choose(input: Game, id: string): Game {
  if (!input || input.version !== VERSION || input.outcome !== "playing" || typeof id !== "string")
    throw new Error("This run cannot take that choice.");
  const game = clone(input);
  const story = runtime(game);
  const index = game.choices.findIndex((c) => c.id === id);
  if (
    index < 0 ||
    story.currentChoices[index]?.tags?.filter((t) => t === `action:${id}`).length !== 1
  )
    throw new Error("That choice is not available.");
  game.people = game.people.map((p) => restore(p));
  const consequence = apply(game, id);
  game.people = game.people.map((p) => snapshot(p));
  game.inputs.push(id);
  game.step++;
  story.ChooseChoiceIndex(index);
  collect(game, story, consequence);
  return game;
}
export function view(game: Game): GameView {
  return {
    day: Math.min(3, Math.floor(game.step / 4) + 1),
    title: game.title,
    text: [...game.text],
    choices: clone(game.choices),
    outcome: game.outcome,
    people: [...names],
    mood:
      game.step < 4
        ? "The door keeps opening."
        : game.step < 8
          ? "There is time to ask for help."
          : "The departure is getting close.",
    progress:
      game.outcome === "playing"
        ? `${["First", "Second", "Third"][Math.min(2, Math.floor(game.step / 4))]} day of leave`
        : "The leave has ended",
  };
}
export function hashGame(game: Game): string {
  const canonical = (value: unknown): unknown =>
    value && typeof value === "object"
      ? Array.isArray(value)
        ? value.map(canonical)
        : Object.fromEntries(
            Object.entries(value)
              .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
              .map(([k, v]) => [k, canonical(v)]),
          )
      : value;
  let hash = 2166136261;
  for (const c of JSON.stringify(canonical(game)))
    hash = Math.imul(hash ^ c.charCodeAt(0), 16777619) >>> 0;
  return hash.toString(16).padStart(8, "0");
}
export function exportRun(game: Game): Run {
  return {
    version: VERSION,
    seed: game.seed,
    inputs: [...game.inputs],
    state: clone(game),
    hash: hashGame(game),
  };
}
export function replay(input: Run): Game {
  if (
    !input ||
    input.version !== VERSION ||
    !Array.isArray(input.inputs) ||
    input.inputs.length > 12 ||
    !input.state ||
    typeof input.hash !== "string"
  )
    throw new Error("This export is not a supported Three Days run.");
  let game = createGame(input.seed);
  for (const id of input.inputs) game = choose(game, id);
  if (
    hashGame(game) !== input.hash ||
    hashGame(input.state) !== input.hash ||
    JSON.stringify(game.inputs) !== JSON.stringify(input.state.inputs)
  )
    throw new Error("The export does not match its recorded choices.");
  return game;
}
