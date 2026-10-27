import {
  type ActionResolution,
  type Run as Actors,
  type ActualConsequences,
  step as advance,
  createPerson,
  createRun,
  type DeepReadonly,
  exportRun as exportArchive,
  type HostRequest,
  type Input,
  inspect,
  type Offer,
  type PersonAuthoring,
  type Result,
  type RunArchive,
  type RunSpec,
  replay as replayArchive,
  restoreRun,
  type StepResult,
} from "@adam0white/human-framework";
import { Story } from "inkjs";
import compiled from "./story.json" with { type: "json" };
import type { GameView, Outcome } from "./types.ts";

// HF 4.0.0 run API (pinned 2026-10-27). HF owns the five people: their bodies, needs,
// decisions and ties. The host owns the room, hours, savings, the notebook, the account,
// the promise and whether an act physically succeeded. Every host fact that a person
// should know enters as a timestamped input; every reading leaves through `inspect`.
const VERSION = "three-days-3";
const OLD_VERSION = "three-days-2";
const LEYLA = "hf.cast.leyla.days";
const KEMAL = "hf.cast.kemal.days";
const SELIN = "hf.cast.selin.voice";
const HOST = { type: "host", id: "days" } as const;
const MINUTE = 60_000;
const DAY = 86_400_000;
const YEAR = 525_960 * MINUTE;
const START = 8 * 60 * MINUTE;
const REFUSAL_PAUSE = 20 * MINUTE;
const MAX_INPUTS = 64;
const names = ["Leyla", "Hacer", "Burak", "Selin", "Şükrü"];
const ids = [LEYLA, "hf.cast.hacer.voice", "hf.cast.burak.stairwell", SELIN, "hf.cast.sukru.days"];
export interface Game {
  version: string;
  seed: number;
  inputs: string[];
  step: number;
  stretches: number;
  fatigue: number;
  paid: boolean;
  paidCreditor: boolean;
  privacyManaged: boolean;
  notebookKept: boolean;
  laterDelivery: boolean;
  refused: boolean;
  ink: string;
  /** The HF 4.0 run archive: spec, input log, current state and hashes. */
  actors: DeepReadonly<RunArchive>;
  /** Host revision for the offers it gives each person. */
  offerRevision: number;
  /** Leyla's HF fatigue readout, read with `inspect` at the archive's current time. */
  bodyFatigue: number;
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
  choices: { id: string; label: string; cost?: string }[];
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
function need<T>(result: Result<T>): T {
  if (!result.ok) throw new Error(`HF refused the run: ${result.error.code} ${result.error.path}`);
  return result.value;
}
const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value));
/**
 * Host-owned seeded draws for the two scene facts (splitmix32 seeding, sfc32 draws). They match the
 * HF 3.2 build's draws, so a seed keeps its starting tiredness and receipt holder. HF keeps its own
 * random state inside its run.
 */
function hostDraws(seed: number): () => number {
  let s = seed >>> 0;
  const word = () => {
    s = (s + 0x9e3779b9) >>> 0;
    let z = s;
    z = Math.imul(z ^ (z >>> 16), 0x85ebca6b) >>> 0;
    z = Math.imul(z ^ (z >>> 13), 0xc2b2ae35) >>> 0;
    return (z ^ (z >>> 16)) >>> 0;
  };
  let [a, b, c, d] = [word(), word(), word(), word()];
  const draw = () => {
    const t = (((a + b) >>> 0) + d) >>> 0;
    d = (d + 1) >>> 0;
    a = b ^ (b >>> 9);
    b = (c + (c << 3)) >>> 0;
    c = ((c << 21) | (c >>> 11)) >>> 0;
    c = (c + t) >>> 0;
    return t / 4294967296;
  };
  for (let i = 0; i < 12; i++) draw();
  return draw;
}
const action = (id: string, effort: number, focus: number, tags: string[]) => ({
  id,
  label: id,
  demands: { effort, focus, mode: "awake" as const, requires: {} },
  tags,
  norms: [],
});
function spec(seed: number): RunSpec {
  return {
    id: "three-days",
    seed,
    start: START,
    host: { id: "days", edition: VERSION, schema: VERSION },
    definitions: {
      actions: [
        action("talk", 0.1, 0.25, ["social"]),
        action("rest", 0, 0, ["rest"]),
        action("help", 0.1, 0, ["help", "social"]),
        action("leave", 0.1, 0, []),
      ],
      norms: [],
      marriageCustoms: [],
      skills: [],
      skillTransfers: [],
      methods: [],
      routines: [],
      sources: [HOST],
      lexicon: {
        names: Object.fromEntries([
          ...ids.map((id, i) => [id, required(names[i])]),
          [KEMAL, "Kemal"],
        ]),
        roles: {},
        prefer: "name",
        actions: {},
      },
      calendar: {
        id: "leave",
        epoch: { id: "midnight", simulationAt: 0, dayIndex: 0, msOfDay: 0 },
        dayMs: DAY,
        days: [0, 1, 2, 3].map((dayIndex) => ({ dayIndex, start: dayIndex * DAY, windows: [] })),
      },
    },
    lifecycle: { kinPremises: [], kinScopes: [] },
    // Kemal is a known person who has died, never an actor in this run.
    world: {
      revision: 0,
      facts: [
        {
          id: "kemal-died",
          subject: KEMAL,
          predicate: "died",
          value: true,
          at: START,
          provenance: { source: "days", evidenceId: "days:death" },
        },
      ],
      hostState: {},
    },
  };
}
const TRAITS = {
  honesty: 0.5,
  emotionality: 0.5,
  extraversion: 0.5,
  agreeableness: 0.5,
  conscientiousness: 0.5,
  openness: 0.5,
};
const VALUES = {
  benevolence: 0.5,
  universalism: 0.5,
  tradition: 0.5,
  conformity: 0.5,
  security: 0.5,
  achievement: 0.5,
  power: 0.5,
  hedonism: 0.5,
  stimulation: 0.5,
  selfDirection: 0.5,
};
function authored(i: number): PersonAuthoring {
  const id = required(ids[i]);
  const traits = [
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
  ][i];
  const tie = (otherId: string, roles: string[], affection: number, familiarity: number) => ({
    otherId,
    roles,
    affection,
    trust: 0.6,
    respect: 0,
    familiarity,
    ledger: 0,
    lastInteraction: START,
  });
  return {
    id,
    identity: {
      name: required(names[i]),
      birthAt: START - required([49, 58, 31, 32, 79][i]) * YEAR,
      sex: i === 2 || i === 4 ? "male" : "female",
      castId: id,
    },
    biography: [],
    origin: {
      kind: "authored",
      basis: { kind: "evidence", id: `days:cast:${id}` },
      traits: {
        kind: "explicit-authoring",
        evidence: { kind: "evidence", id: `days:traits:${id}` },
      },
    },
    state: {
      traits: { ...TRAITS, ...traits },
      values: {
        ...VALUES,
        ...(i === 3 ? { benevolence: 0.8, achievement: 0.6, tradition: 0.4 } : {}),
      },
      body: {
        satiety: 0.8,
        hydration: 0.85,
        sleepPressure: 0.2,
        exertion: 0,
        fitness: 0.5,
        health: 1,
        pain: 0,
        sleepDebtHours: 0,
        depletion: 0,
        circadianPeakMs: 16 * 60 * MINUTE,
        asleep: false,
        since: START,
        doze: {
          context: { posture: "upright", stimulation: 0.5 },
          basis: { kind: "authored", author: "days", at: START },
        },
        bladder: { fill: 0, pending: 0 },
        injuries: [],
        illnesses: [],
        exposures: [],
      },
      needs: {
        safety: 0.8,
        belonging: 0.7,
        esteem: 0.6,
        autonomy: 0.7,
        competence: 0.6,
        leisure: 0.6,
        meaning: 0.6,
      },
      skills: [],
      heldNorms: [],
      beliefs: [],
      consequences: [],
      sourceTrust: [],
      context: {
        scarcity: { kind: "prior", value: 0, basis: "engineering:source-zero-context" },
        smoking: { kind: "unobserved" },
      },
      relationships:
        i === 0 ? [tie(KEMAL, ["parent"], 0.7, 1)] : [tie(LEYLA, ["friend"], 0.4, 0.5)],
      voices: [],
      agenda: {
        exemptions: { traveling: { kind: "unobserved" }, illnessSeverity: { kind: "unobserved" } },
        commitments: [],
        goals: [],
        precommitments: [],
        owed: [],
      },
      family: { contactCovered: [], aptitudes: {} },
      groups: [],
      reserve: {},
      retention: { trace: 32, chronicleDays: 120 },
      habits: [],
      expectations: [],
      affect: { mood: { valence: 0, arousal: 0.3 }, regulation: 0.3, emotions: [] },
      promptings: { reading: "none", responses: [] },
      review: { style: "accounting", atMsOfDay: 21 * 60 * MINUTE },
      bonds: { courtships: [], marriages: [] },
    },
  };
}
function opening(seed: number): Actors {
  const run = need(createRun(spec(seed)));
  for (let i = 0; i < ids.length; i++) need(createPerson(run, authored(i)));
  // Everyone in the room hears of the death through one input; HF words it from the lexicon.
  need(
    advance(run, {
      until: START,
      inputs: ids.map((person) => ({
        id: `days:death:${person}`,
        at: START,
        source: HOST,
        kind: "death.heard",
        payload: { person, evidenceId: "days:death", deceased: KEMAL, reporter: "days" },
      })),
    }),
  );
  return run;
}
/**
 * Live HF runs keyed by the frozen archive object that `keep` put into the game. The archive in
 * the game is the truth: only that exact, unchangeable archive finds its run, and a run is taken
 * out when its game moves on. Any other game object, even an identical copy, restores its own run
 * from the archive, so HF checks every archive it did not export itself.
 */
const live = new WeakMap<object, Actors>();
function keep(game: Game, run: Actors) {
  game.actors = exportArchive(run);
  live.set(game.actors, run);
}
function take(archive: DeepReadonly<RunArchive>): Actors {
  const run = live.get(archive);
  live.delete(archive);
  return run ?? need(restoreRun(archive));
}
function now(run: Actors): number {
  return need(inspect(run, { perspective: { kind: "host" }, people: [LEYLA], select: ["summary"] }))
    .at;
}
function readFatigue(run: Actors): number {
  const view = need(
    inspect(run, { perspective: { kind: "host" }, people: [LEYLA], select: ["body"] }),
  );
  const part = view.people[0]?.parts[0];
  if (view.people[0]?.kind !== "host" || part?.select !== "body" || !("readout" in part.value))
    throw new Error("HF did not return Leyla's body.");
  return part.value.readout.fatigue;
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
  story.BindExternalFunction("burak_holds", () => game.evidenceHolder === "Burak", true);
  story.BindExternalFunction("private_page", () => game.privacy, true);
  story.BindExternalFunction("completed_promise", () => game.confirmed, true);
  story.BindExternalFunction("ate_soup", () => game.inputs.includes("welcome"), true);
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
  game.choices = game.choices.map((choice) => ({ ...choice, cost: choiceCost(game, choice.id) }));
  if (game.choices.length) {
    game.text.push(
      `Leyla has ${game.stretches} free ${game.stretches === 1 ? "hour" : "hours"} before departure. These are hours left after receiving visitors. ${tiredness(game) >= 4 ? "Leyla is exhausted: checking and travel each need an extra hour." : tiredness(game) >= 3 ? "Leyla is very tired: checking needs an extra hour with a second reader." : tiredness(game) >= 2 ? "Leyla is tired, but can still follow the papers." : "Leyla can follow the papers without a second reader."}`,
    );
  }
}
export function createGame(seed: number): Game {
  if (!Number.isSafeInteger(seed) || seed < 0 || seed > 0xffffffff)
    throw new Error("Use a whole seed from 0 to 4294967295.");
  const draw = hostDraws(seed);
  const run = opening(seed);
  const game: Game = {
    version: VERSION,
    seed,
    inputs: [],
    step: 0,
    stretches: 6,
    fatigue: 2 + Math.floor(draw() * 2),
    paid: false,
    paidCreditor: false,
    privacyManaged: true,
    notebookKept: true,
    laterDelivery: false,
    refused: false,
    ink: "",
    actors: exportArchive(run),
    offerRevision: 0,
    bodyFatigue: readFatigue(run),
    evidenceHolder: required(["Hacer", "Burak", "Selin"][Math.floor(draw() * 3)]),
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
  live.set(game.actors, run);
  collect(game, runtime(game, false));
  return game;
}
interface Act {
  offers: Offer[];
  /** What the host saw happen when the person finished the chosen offer. */
  actual: (offer: Offer) => ActualConsequences;
}
function offer(
  person: string,
  id: string,
  actionId: string,
  minutes: number,
  effort: number,
  focus: number,
  needs: Record<string, number>,
  participants: string[] = [],
  tags: string[] = [],
): Offer {
  return {
    id,
    actionId,
    label: id,
    person,
    durationMs: minutes * MINUTE,
    participants,
    alongside: [],
    demands: { effort, focus, mode: "awake", requires: {} },
    tags,
    norms: [],
    expected: { needs, followedBy: [], provenance: ["days:offer"] },
    fulfills: [],
    advances: [],
    diminishes: [],
  };
}
/**
 * One scene for one person. The scene starts one minute after the run's current time, because
 * HF closes each reached time to new inputs. The host gives the offers, asks for a decision,
 * answers every action request exactly once and advances HF only to the end of the act it
 * accepted (or a short pause when the person takes nothing). Returns the settled offer, if any.
 */
type Settled = { offer: Offer; status: "completed" | "interrupted" };
function perform(run: Actors, game: Game, person: string, act: Act): Settled | undefined {
  const at = now(run) + MINUTE;
  const revision = ++game.offerRevision;
  const inputs: Input[] = [
    {
      id: `days:offers:${revision}`,
      at,
      source: HOST,
      kind: "offers.received",
      payload: { person, revision, offers: act.offers },
    },
    {
      id: `days:decide:${revision}`,
      at,
      source: HOST,
      kind: "decision.requested",
      payload: { person, reason: "scene", treatment: "ordinary", offerRevision: revision },
    },
  ];
  let started: { offer: Offer; activityId: string; start: number } | undefined;
  let settled: Settled | undefined;
  let withdrawn = false;
  // Without an accepted act, the scene is a short pause. Accepting an act extends it to the act's end.
  let until = at + REFUSAL_PAUSE;
  let result: DeepReadonly<StepResult> = need(advance(run, { until, inputs }));
  for (let boundary = 0; result.boundary.type === "world-required"; boundary++) {
    if (boundary >= 16) throw new Error("The scene did not settle.");
    const answers = [...result.boundary.requests]
      .sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))
      .map(answer);
    // A taken offer is no longer open: one millisecond after the act starts, the host
    // withdraws the scene's offers, so the same choice cannot be taken (or charged) twice.
    if (started && !withdrawn) {
      until = Math.max(until, started.start + started.offer.durationMs);
      withdrawn = true;
      answers.push({
        id: `days:withdraw:${revision}`,
        at: started.start + 1,
        source: HOST,
        kind: "offers.received",
        payload: { person, revision: ++game.offerRevision, offers: [] },
      });
    }
    result = need(advance(run, { until, inputs: answers }));
  }
  if (!result.reachedUntil || result.at !== until) throw new Error("The scene did not settle.");
  game.bodyFatigue = readFatigue(run);
  return settled;

  function answer(request: DeepReadonly<HostRequest>): Input {
    const id = `days:answer:${request.id}`;
    if (request.kind === "communication")
      return {
        id,
        at: request.boundaryAt,
        source: HOST,
        kind: "communication.resolved",
        payload: {
          requestId: request.id,
          requestHash: request.requestHash,
          worldRevision: request.worldRevision,
          speaker: request.speaker,
          emittedItemIds: [],
          received: [],
        },
      };
    const base = {
      requestId: request.id,
      requestHash: request.requestHash,
      person: request.person,
      activityId: request.activityId,
      stage: request.stage,
      worldRevision: request.worldRevision,
      observations: [],
    };
    const resolved = (payload: ActionResolution): Input => ({
      id,
      at: request.boundaryAt,
      source: HOST,
      kind: "action.resolved",
      payload,
    });
    const chosen = act.offers.find((o) => o.id === request.offerId);
    if (request.stage === "start") {
      // Only the first start of this scene's own offer is accepted; anything else was not offered now.
      if (started || !chosen || request.person !== person || request.offerRevision !== revision)
        return resolved({ ...base, disposition: "rejected" });
      started = { offer: chosen, activityId: request.activityId, start: request.boundaryAt };
      return resolved({ ...base, disposition: "accepted" });
    }
    if (!started || request.activityId !== started.activityId)
      throw new Error("HF asked to settle an act the host never accepted.");
    const status = request.stage === "finish" ? "completed" : "interrupted";
    settled = { offer: started.offer, status };
    return resolved({
      ...base,
      disposition: status,
      outcome: {
        activityId: started.activityId,
        offerId: started.offer.id,
        actionId: started.offer.actionId,
        start: started.start,
        end: request.boundaryAt,
        status,
        evidenceId: `days:outcome:${request.id}`,
        summary: started.offer.label,
        actual:
          status === "completed"
            ? act.actual(started.offer)
            : { exposures: [], observedProgress: [] },
        fulfills: [],
        advances: [],
      },
    });
  }
}
function act(
  run: Actors,
  game: Game,
  id: string,
  rest: boolean,
  companion?: string,
): Settled["status"] | "refused" {
  const done = perform(run, game, LEYLA, {
    offers: [
      rest
        ? offer(LEYLA, id, "rest", 60, 0, 0, { leisure: 0.4 }, [], ["rest"])
        : offer(
            LEYLA,
            id,
            "talk",
            20,
            0.1,
            0.25,
            { belonging: 0.3, esteem: 0.2 },
            companion ? [companion] : [],
            companion ? ["social", "help"] : ["social"],
          ),
    ],
    actual: () =>
      rest
        ? {
            consumed: { food: 0.5, water: 0.6 },
            psychological: { leisure: 0.4 },
            exposures: [],
            observedProgress: [],
          }
        : { psychological: { belonging: 0.2 }, exposures: [], observedProgress: [] },
  });
  return done?.offer.id === id ? done.status : "refused";
}
function requestHelp(run: Actors, game: Game): boolean {
  // An open, fed household needs less work from Selin. Quieting the immediate
  // payment demand makes the agreed shift easier, even when that payment was mistaken.
  // These host facts reach Selin only as the effort of the shift she is offered.
  const shiftEffort =
    0.07 +
    (game.inputs.includes("welcome") ? 0 : 0.07) +
    (game.paid ? -0.04 : 0.03) +
    (tiredness(game) >= 3 ? 0.02 : 0);
  const cover = offer(
    SELIN,
    "cover",
    "help",
    20,
    shiftEffort,
    0,
    { belonging: 0.25, esteem: 0.15 },
    [LEYLA],
    ["help", "social"],
  );
  cover.label = "Cover the door for an agreed short shift";
  const home = offer(SELIN, "home", "leave", 60, 0.1, 0, { autonomy: 0.7, leisure: 0.7 });
  home.label = "Go home to your own household";
  const done = perform(run, game, SELIN, {
    offers: [cover, home],
    actual: (chosen) => ({
      psychological:
        chosen.id === "cover" ? { belonging: 0.25, esteem: 0.15 } : { autonomy: 0.7, leisure: 0.7 },
      exposures: [],
      observedProgress: [],
    }),
  });
  return done?.offer.id === "cover" && done.status === "completed";
}
/** Selin was in the room when the private page was read aloud. HF decides what it does to her tie. */
function witnessHarm(run: Actors) {
  const at = now(run) + MINUTE;
  need(
    advance(run, {
      until: at,
      inputs: [
        {
          id: `days:harm:${at}`,
          at,
          source: HOST,
          kind: "social.received",
          payload: {
            person: SELIN,
            evidenceId: "days:page-read-aloud",
            other: LEYLA,
            event: { kind: "harm", byMe: false, magnitude: 0.7 },
          },
        },
      ],
    }),
  );
}
function tiredness(game: Game): number {
  // The authored scene demand and HF's bodily readout can each require more care.
  return Math.min(5, Math.max(game.fatigue, Math.floor(game.bodyFatigue * 4)));
}
function comparisonHours(game: Game, remote = false): number {
  const original = remote ? 2 : game.checked ? 1 : 2;
  return (
    Math.max(0, original - (!remote && !game.privacy ? 1 : 0)) + (tiredness(game) >= 3 ? 1 : 0)
  );
}
function journeyHours(game: Game): number {
  return (game.helper ? 1 : 2) + (tiredness(game) >= 4 ? 1 : 0);
}
function choiceCost(game: Game, id: string): string {
  const costs: Record<string, string> = {
    welcome: "1 hour; feel steadier while someone else receives the visitors.",
    alone: "Save the hour and keep control of the door; become more tired.",
    check: "1 hour to get the original; keep your savings.",
    pay: "Use your savings to quiet the demand now; recovering the original later takes another hour.",
    private: "Keep the private page closed; no early help with the entries.",
    read: "Get help that saves 1 hour on a private comparison; expose a private story. Containing the harm later takes 1 hour.",
    ask: "Ask Selin to give up part of her evening; she may refuse.",
    hide: `Protect Selin's evening; a visit without cover takes ${2 + (tiredness(game) >= 4 ? 1 : 0)} hours.`,
    rest: "1 hour to recover enough to read; fewer visitors can be received.",
    push: "Save the hour; become more tired, which can add a checking or travel hour.",
    compare: `${comparisonHours(game)} ${comparisonHours(game) === 1 ? "hour" : "hours"} to obtain and check the original; no time to recuperate.`,
    guess: `${comparisonHours(game, true)} ${comparisonHours(game, true) === 1 ? "hour" : "hours"} for Burak's phone check; rest while he calls.`,
    delegate: "Commit to a visit before departure; the journey will still need its hours later.",
    conceal: "Accept a later delivery; give up seeing Şükrü during this leave.",
    protect: game.privacy
      ? "1 hour; keep the notebook, copy the bill, and answer questions yourself."
      : "1 hour; keep the notebook, apologise to the person whose page you read, and ask listeners not to repeat it.",
    publish: `Save 1 hour; entrust the ${game.privacy ? "closed notebook" : "notebook you read aloud"} to Burak until after departure.${game.privacy ? " The private page stays closed." : " Earlier disclosure stays unresolved."}`,
    name: "1 hour to write and agree the next step; preserve your savings.",
    dismiss: "Pay the verified bill from your own savings; save the writing hour.",
    confirm: `${journeyHours(game)} ${journeyHours(game) === 1 ? "hour" : "hours"} for the visit${game.laterDelivery ? "; change the later arrangement" : ""}${tiredness(game) >= 2 ? "; travel while tired" : "; make the journey"}.`,
    leave: "1 hour and a paid delivery; give up making the visit yourself.",
    speak: "Ask Selin to stay and listen; the conversation tires you.",
    silent: "Keep your words private and recover in quiet; leave the conversation unfinished.",
    close: "End this leave; carry any unfinished task home.",
  };
  return required(costs[id]);
}
function spend(game: Game, hours: number): boolean {
  if (game.stretches < hours) return false;
  game.stretches -= hours;
  return true;
}
function apply(run: Actors, game: Game, id: string): string {
  // Only offer companionship when a person is actually present for this act.
  const companion = ["private", "read", "ask", "speak", "silent"].includes(id) ? SELIN : undefined;
  // The close needs no act from Leyla; every other choice is one HF act, charged once.
  const status =
    id === "close" ? "completed" : act(run, game, id, id === "rest" || id === "welcome", companion);
  game.refused = status !== "completed";
  // An interrupted act was started and spent Leyla's time and effort in HF, but the host saw no
  // task done, so the choice stays as after a refusal and says what happened.
  if (status === "interrupted")
    return "Leyla cannot take that on now: she started, but could not finish. No agreement or task has been completed. The choice is still here; she pauses before trying again.";
  if (game.refused) {
    return "Leyla cannot take that on now. No agreement or task has been completed. The choice is still here; she pauses before trying again.";
  }
  switch (id) {
    case "welcome":
      if (!spend(game, 1))
        return "There is no free hour for the meal. Hacer leaves the soup for later.";
      game.fatigue = Math.max(0, game.fatigue - 2);
      return "Hacer brings the soup inside. Leyla eats and feels steadier. Receiving her takes an hour that could have gone to the papers.";
    case "alone":
      game.fatigue = Math.min(5, game.fatigue + 1);
      return "Hacer leaves the soup by the door. Leyla saves an hour and keeps control of the visitors. Standing through it leaves her more tired.";
    case "check":
      game.checked = spend(game, 1);
      return game.checked
        ? `${game.evidenceHolder === "Burak" ? "Burak fetches his" : `${game.evidenceHolder} agrees to bring the`} original receipt. It takes an hour. No money changes hands.`
        : "There is no free hour to obtain the original. The copied entry remains unconfirmed.";
    case "pay":
      game.paid = true;
      return "Burak accepts Leyla's money against the first demand and Şükrü stops asking for an immediate payment. Her savings are smaller. That payment was recorded against Burak's old advance; the boiler bill still needs its own check. Burak must return the mistaken payment.";
    case "private":
      return "Selin turns the private page face down. Trust is preserved, but the room cannot help sort the entries yet. Leyla will need time to check them.";
    case "read":
      game.privacy = false;
      game.privacyManaged = false;
      witnessHarm(run);
      return "Hacer recognises the dates and offers to sort the entries with Burak. That saves one hour on a private comparison. The room has also heard a private hospital name. Selin pulls her chair back. Containing the disclosure will take an hour; it cannot make people unhear it.";
    case "ask":
      game.asked = true;
      game.helper = requestHelp(run, game);
      return game.helper
        ? `Selin agrees to one short shift. It costs her an evening at home. Leyla still needs ${journeyHours(game)} ${journeyHours(game) === 1 ? "hour" : "hours"} for the visit itself.`
        : `Selin decides to go home. She cannot cover the door. A visit will take ${journeyHours(game)} hours, or Leyla can pay for an agreed delivery.`;
    case "hide":
      return `Selin keeps her evening at home. Leyla will have no cover from her. A visit without cover takes ${journeyHours(game)} hours. She can still agree a visit or a later delivery with Şükrü.`;
    case "rest":
      if (!spend(game, 1)) return "There is no free hour left for the planned rest.";
      game.fatigue = Math.max(0, game.fatigue - 3);
      game.rested = true;
      return `Leyla eats and lies down for an hour. ${game.helper ? "Selin covers the door for the agreed shift." : "The door stays closed."} She can follow the papers again, but that hour is gone.`;
    case "push":
      game.fatigue = Math.min(5, game.fatigue + 2);
      return "Leyla stays at the door and saves an hour. Her tiredness rises. A second reader may now take longer, even if Selin covers the visit.";
    case "compare":
    case "guess": {
      const hours = comparisonHours(game, id === "guess");
      if (!spend(game, hours))
        return `The check needs ${hours} ${hours === 1 ? "hour" : "hours"}; only ${game.stretches} ${game.stretches === 1 ? "remains" : "remain"}. Leyla cannot safely confirm the entries before departure.`;
      game.checked = true;
      game.compared = true;
      if (id === "guess") game.fatigue = Math.max(0, game.fatigue - 1);
      return `The original receipt and both entries agree: Burak's earlier advance was returned; Şükrü's boiler bill is separate. The check takes ${hours} ${hours === 1 ? "hour" : "hours"}.${id === "guess" ? " Burak does the phone work while Leyla rests her eyes." : " Leyla keeps working through the papers."}${game.paid ? " Burak acknowledges that Leyla's mistaken payment must be returned to her savings." : ""}`;
    }
    case "delegate":
      game.visit = true;
      return "Şükrü agrees to a visit before departure. Leyla now owes him the time she has named. The photograph and letter are ready.";
    case "conceal":
      game.visit = true;
      game.laterDelivery = true;
      return "Şükrü agrees to receive the photograph and letter after Leyla leaves. He is disappointed not to see her. The later delivery still needs a carrier, payment and a date.";
    case "protect": {
      const hours = 1;
      if (!spend(game, hours))
        return `There is no hour left to ${game.privacy ? "copy the bill and answer the questions. The private page stays private." : "apologise and ask the listeners not to repeat the page. The earlier disclosure is still unanswered."}`;
      game.privacyManaged = true;
      return game.privacy
        ? "Leyla spends an hour copying only the bill and answering questions without sharing the private page. Burak takes the copy. Leyla keeps the notebook."
        : "Leyla contacts the person whose page she read, apologises, and asks the listeners not to repeat it. They agree. It takes an hour. The disclosure happened; this agreement limits further harm without undoing it.";
    }
    case "publish":
      game.notebookKept = false;
      return `Burak takes the ${game.privacy ? "closed notebook" : "notebook Leyla read aloud"} to copy the bill in private. Leyla saves the hour of doing that work herself, but will leave without her father's notebook. He agrees to return it later.${!game.privacy ? " This does not answer the earlier disclosure." : ""}`;
    case "name":
      game.named = game.compared && spend(game, 1);
      return game.named
        ? "Leyla spends an hour recording Şükrü's claim and Burak's agreed next step with the estate contact. She keeps her savings and accepts that this follow-up will continue after leave."
        : `The account cannot be recorded safely: ${!game.compared ? "the entries are unconfirmed" : "no writing hour remains"}.`;
    case "dismiss":
      game.named = game.compared;
      game.paidCreditor = game.named;
      return game.named
        ? `Şükrü confirms receipt of Leyla's voluntary payment for the verified boiler bill. The account is clear now, at the cost of her own savings.${game.paid ? " Burak still owes her the mistaken earlier payment." : ""}`
        : "Without the checked entries, Leyla cannot safely pay the boiler bill. The account remains disputed.";
    case "confirm": {
      const hours = journeyHours(game);
      game.confirmed = game.visit && spend(game, hours);
      return game.confirmed
        ? `The visit happens and uses ${hours} ${hours === 1 ? "hour" : "hours"}.${tiredness(game) >= 3 ? " Leyla is tired; she keeps the visit short and rests before returning." : " Leyla has enough strength to stay awhile."} Şükrü receives the photograph and letter. He also names a borrowed folding table that Kemal never returned. Leyla records whom to contact; she does not excuse him.`
        : `The visit needs ${hours} ${hours === 1 ? "hour" : "hours"}; ${game.stretches} ${game.stretches === 1 ? "remains" : "remain"}. Şükrü is still waiting. This promise needs an agreed delivery or a later answer.`;
    }
    case "leave":
      game.confirmed = game.visit && spend(game, 1);
      return game.confirmed
        ? "Leyla spends an hour arranging and paying for Burak to deliver the photograph and letter. Şükrü agrees to the date and Burak accepts the task. Leyla gives up the visit herself; the handoff is agreed, and the later delivery is still to happen."
        : "No paid delivery can be confirmed without Şükrü's agreement and an hour to arrange it. The envelope leaves with Leyla.";
    case "speak":
      game.spoken = true;
      game.fatigue = Math.min(5, game.fatigue + 1);
      return "Selin stays to listen. Leyla says that her marriage ended and she wanted to tell Kemal. The conversation costs them both energy. Selin does not turn it into a lesson.";
    case "silent":
      game.fatigue = Math.max(0, game.fatigue - 1);
      return "Selin does not press. She goes home. Leyla keeps that part of her life private and rests alone. The conversation remains unfinished; the account and the envelope do not require it.";
    case "close": {
      game.outcome =
        game.named && game.confirmed && (game.privacy || game.privacyManaged) ? "won" : "lost";
      const history = `${!game.privacy ? (game.privacyManaged ? " A private page was read aloud. The agreement to limit its spread does not undo that harm." : "") : " The private page stayed private."}${!game.notebookKept && game.paid ? " Burak still has the notebook and owes its return, and he still owes Leyla the mistaken first payment." : !game.notebookKept ? " Burak still has the notebook and owes its return." : game.paid ? " Burak still owes Leyla the mistaken first payment." : ""}`;
      if (game.outcome === "won")
        return `Leyla leaves with a clear account and a named next step. ${game.inputs.includes("leave") ? "The delivery has an agreed person and date; it has not happened yet." : "The visit was kept."} These tasks are settled for departure; grief is not.${history}`;
      const missing = [
        !game.named ? "the account is still disputed" : "",
        !game.confirmed
          ? game.laterDelivery
            ? "the agreed later delivery has not been paid for or assigned a date; Şükrü is still waiting for the photograph and letter"
            : "the promised visit has not happened; Şükrü is still waiting for the photograph and letter"
          : "",
        !game.privacy && !game.privacyManaged
          ? "nobody has addressed the harm of reading the private page aloud"
          : "",
      ].filter(Boolean);
      return `Leyla closes the door, but ${missing.join("; ")}. There is still work to do after her leave.${history}`;
    }
    default:
      throw new Error("Unknown action.");
  }
}
export function choose(input: Game, id: string): Game {
  if (!input || input.version !== VERSION || input.outcome !== "playing" || typeof id !== "string")
    throw new Error("This run cannot take that choice.");
  if (input.inputs.length >= MAX_INPUTS) throw new Error("This run has reached its choice limit.");
  const game = clone(input);
  const story = runtime(game);
  const index = game.choices.findIndex((c) => c.id === id);
  if (
    index < 0 ||
    story.currentChoices[index]?.tags?.filter((t) => t === `action:${id}`).length !== 1
  )
    throw new Error("That choice is not available.");
  const run = take(input.actors);
  const consequence = apply(run, game, id);
  keep(game, run);
  game.inputs.push(id);
  if (game.refused) {
    game.text = [
      consequence,
      ...input.text.filter((line) => !line.startsWith("Leyla cannot take that on")),
    ];
  } else {
    game.step++;
    story.ChooseChoiceIndex(index);
    collect(game, story, consequence);
  }
  return game;
}
export function view(game: Game): GameView {
  return {
    hours: game.stretches,
    fatigue: tiredness(game),
    helper: game.helper,
    disclosed: !game.privacy,
    privacyManaged: game.privacyManaged,
    paid: game.paid || game.paidCreditor,
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
  if (input && (input.version === OLD_VERSION || input.state?.version === OLD_VERSION))
    throw new Error(
      "This play was saved by an earlier Three Days build (Human Framework 3.2) and cannot continue. Start a new play.",
    );
  if (
    !input ||
    input.version !== VERSION ||
    !Array.isArray(input.inputs) ||
    input.inputs.length > MAX_INPUTS ||
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
  // HF checks the exported archive too: its input log must rebuild the same people and every
  // hash, and it must be the archive these choices rebuild.
  const archive = input.state.actors;
  if (
    !archive?.hashes ||
    archive.hashes.full !== game.actors.hashes.full ||
    !need(replayArchive(archive)).verified
  )
    throw new Error("The export does not match its recorded choices.");
  return game;
}
