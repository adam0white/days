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
  readPerson,
  restore,
  snapshot,
  TRAIT_KEYS,
  type Traits,
  tick,
  VALUE_KEYS,
  type Values,
} from "@adam0white/human-framework";
import { Story } from "inkjs";
import compiled from "./story.json" with { type: "json" };
import type { GameView, Outcome } from "./types.ts";

const VERSION = "three-days-2";
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
  fatigue: number;
  paid: boolean;
  paidCreditor: boolean;
  privacyManaged: boolean;
  notebookKept: boolean;
  laterDelivery: boolean;
  refused: boolean;
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
  const rng = createRng(seed);
  const game: Game = {
    version: VERSION,
    seed,
    inputs: [],
    step: 0,
    stretches: 6,
    fatigue: 2 + Math.floor(random(rng) * 2),
    paid: false,
    paidCreditor: false,
    privacyManaged: true,
    notebookKept: true,
    laterDelivery: false,
    refused: false,
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
  // An open, fed household needs less work from Selin. Quieting the immediate
  // payment demand makes the agreed shift easier, even when that payment was mistaken.
  const shiftEffort =
    0.07 +
    (game.inputs.includes("welcome") ? 0 : 0.07) +
    (game.paid ? -0.04 : 0.03) +
    (tiredness(game) >= 3 ? 0.02 : 0);
  const selin = required(game.people[3]);
  const assist: Affordance = {
    id: "cover",
    action: "help",
    label: "Cover the door for an agreed short shift",
    duration: 20,
    effort: shiftEffort,
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
function tiredness(game: Game): number {
  // The authored scene demand and HF's bodily readout can each require more care.
  return Math.min(
    5,
    Math.max(game.fatigue, Math.floor(readPerson(required(game.people[0])).body.fatigue * 4)),
  );
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
function apply(game: Game, id: string): string {
  const leyla = required(game.people[0]);
  // Only offer companionship when a person is actually present for this act.
  const companion = ["private", "read", "ask", "speak", "silent"].includes(id) ? SELIN : undefined;
  const completed = act(leyla, id, id === "rest" || id === "welcome", companion);
  game.refused = !completed && id !== "close";
  if (game.refused) {
    tick(leyla, leyla.now + 20);
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
      return "Hacer recognises the dates and offers to sort the entries with Burak. That saves one hour on a private comparison. The room has also heard a private hospital name. Selin pulls her chair back. Containing the disclosure will take an hour; it cannot make people unhear it.";
    case "ask":
      game.asked = true;
      game.helper = requestHelp(game);
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
  if (
    !input ||
    input.version !== VERSION ||
    !Array.isArray(input.inputs) ||
    input.inputs.length > 64 ||
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
