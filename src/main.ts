import { createLab, personaChannel } from "@adam0white/lab-client";
import { PEOPLE_ACROSS_GAMES } from "@adam0white/lab-kit";
import { checkpointContinuity, restartFreshGame, startFreshGame } from "./continuity.ts";
import { choose, createGame, exportRun, hashGame, replay, sharedCast, view } from "./engine.ts";
import type { mountRoom } from "./room.ts";
import "./style.css";

function get<T extends HTMLElement>(id: string): T {
  const element = document.getElementById(id);
  if (!element) throw new Error(`Missing element: ${id}`);
  return element as T;
}
function read(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}
function store(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* Private browsing can deny storage. */
  }
}
const lab = createLab({ game: "days" });
const shelf = personaChannel();
const menu = get<HTMLDialogElement>("menu-dialog");
const peopleLink = document.createElement("a");
peopleLink.href = "https://human.adamwhite.work/lab/people/";
peopleLink.textContent = PEOPLE_ACROSS_GAMES;
get("menu-home").append(peopleLink);
const notice = get<HTMLDialogElement>("notice");
const recording = get<HTMLInputElement>("recording");
const feedbackNote = get<HTMLTextAreaElement>("feedback-note");
const feedbackStatus = get("feedback-status");
const scene = get("scene");
const storageKey = "days-run-v1";
const newSeed = () => crypto.getRandomValues(new Uint32Array(1))[0] ?? 1;
let game = createGame(newSeed());
let loadNotice = "";
let restored = false;
let preserveOldSave = false;
const saved = read(storageKey);
if (saved) {
  try {
    game = replay(JSON.parse(saved));
    restored = true;
  } catch (error) {
    // A save this build cannot replay is never repaired; the player starts fresh and is told why.
    loadNotice =
      error instanceof Error && error.message.startsWith("This play was saved by an earlier")
        ? error.message
        : "Your saved play could not be checked, so a new play has started.";
    preserveOldSave = true;
    loadNotice +=
      " The earlier saved play remains on this device. This new play is not saved until you confirm New game.";
  }
}
let room: Awaited<ReturnType<typeof mountRoom>> | undefined;
let disposed = false;
let busy = true;
let generation = 0;
async function fresh(focus = false) {
  const current = ++generation;
  busy = true;
  const seed = newSeed();
  let retained = false;
  try {
    if (focus) {
      const restart = await restartFreshGame(shelf, game, seed, () => current === generation);
      game = restart.game;
      retained = restart.retained;
      if (retained)
        loadNotice =
          "A new play could not start. Your current play and any saved progress are kept.";
    } else {
      game = await startFreshGame(shelf, seed, () => current === generation);
    }
  } catch {
    game = createGame(seed);
    loadNotice = [
      loadNotice,
      "Continuity could not be confirmed. This play starts locally; check the shelf before trying again.",
    ]
      .filter(Boolean)
      .join(" ");
  } finally {
    busy = false;
  }
  if (!retained && focus) preserveOldSave = false;
  if (!retained) save();
  render(focus && !retained);
  return !retained;
}
async function checkpoint() {
  if (!game.chapter || game.chapter.completed || game.outcome === "playing") return;
  const finished = game;
  const current = generation;
  busy = true;
  try {
    await checkpointContinuity(shelf, finished, () => current === generation && game === finished);
    finished.chapter!.completed = true;
    save();
  } catch (error) {
    loadNotice =
      error instanceof Error && error.message.startsWith("Burak has unfinished obligations")
        ? error.message
        : "Continuity could not be confirmed. Check the shelf before starting another play.";
  } finally {
    busy = false;
    render();
  }
}
function save() {
  if (preserveOldSave) return;
  store(storageKey, JSON.stringify(exportRun(game)));
}
const objects: Record<string, { name: string; shape: string }> = {
  welcome: { name: "Hacer’s soup", shape: "bowl" },
  alone: { name: "The front door", shape: "door" },
  check: { name: "The account", shape: "paper" },
  pay: { name: "Your savings", shape: "wallet" },
  private: { name: "The closed notebook", shape: "book" },
  read: { name: "The open notebook", shape: "paper" },
  ask: { name: "Selin’s chair", shape: "chair" },
  hide: { name: "Selin’s way home", shape: "door" },
  rest: { name: "Soup and a seat", shape: "bowl" },
  push: { name: "The front door", shape: "door" },
  compare: { name: "The receipts", shape: "paper" },
  guess: { name: "The telephone", shape: "phone" },
  delegate: { name: "The telephone", shape: "phone" },
  conceal: { name: "The envelope", shape: "envelope" },
  protect: { name: "The bill to copy", shape: "paper" },
  publish: { name: "The notebook to lend", shape: "book" },
  name: { name: "The account", shape: "paper" },
  dismiss: { name: "Your savings", shape: "wallet" },
  confirm: { name: "The visit", shape: "envelope" },
  leave: { name: "The delivery", shape: "envelope" },
  speak: { name: "A chair beside Selin", shape: "chair" },
  silent: { name: "The front door", shape: "door" },
  close: { name: "The front door", shape: "door" },
};
const phoneLayout = window.matchMedia("(max-width: 700px)");
phoneLayout.addEventListener("change", () => {
  const context = document.querySelector<HTMLDetailsElement>("#opening-context");
  if (context) context.open = !phoneLayout.matches;
});
function render(focus = false) {
  const current = view(game);
  const skipped = game.chapter?.skipped ?? [];
  const continuityNotice = skipped
    .map((id) => ["Hacer", "Burak", "Selin"][sharedCast.indexOf(id)] ?? "A character")
    .map(
      (name) =>
        `${name}'s shared history could not join this play; this play uses a local version.`,
    )
    .join(" ");
  const displayNotice = [loadNotice, continuityNotice].filter(Boolean).join(" ");
  scene.dataset.outcome = current.outcome;
  get("progress").textContent = current.progress;
  get("title").textContent = current.title;
  const paragraphs = current.text.map((line) => {
    const p = document.createElement("p");
    p.textContent = line;
    return p;
  });
  if (game.step === 0) {
    const context = document.createElement("details");
    context.id = "opening-context";
    context.open = !phoneLayout.matches;
    const summary = document.createElement("summary");
    summary.textContent = "How Leyla came home";
    const goalIndex = current.text.findIndex((line) => line.startsWith("Keep a clear account"));
    context.append(summary, ...paragraphs.filter((_, index) => index !== goalIndex));
    // Phone only: the full opening is folded, so name who is in the room before the first choice.
    const cast = document.createElement("p");
    cast.id = "opening-cast";
    cast.textContent =
      "Leyla's father Kemal has died. Hacer has come to pay her respects. Burak, a visitor, is good with accounts. Şükrü was Kemal's colleague.";
    const notice = document.createElement("p");
    notice.id = "save-notice";
    notice.textContent = displayNotice;
    get("text").replaceChildren(
      ...(displayNotice ? [notice] : []),
      cast,
      context,
      ...paragraphs.filter((_, index) => index === goalIndex),
    );
  } else {
    const status = document.createElement("p");
    status.textContent = displayNotice;
    get("text").replaceChildren(...paragraphs, ...(displayNotice ? [status] : []));
  }
  get("room-instruction").textContent =
    current.outcome === "playing"
      ? "Choose an object. Read its action and cost before choosing."
      : "The three days have ended.";
  get("room-status").replaceChildren(
    ...[
      `${current.hours} ${current.hours === 1 ? "hour" : "hours"} free before departure`,
      current.fatigue >= 4
        ? "Exhausted"
        : current.fatigue >= 3
          ? "Very tired"
          : current.fatigue >= 2
            ? "Tired"
            : "Rested",
      current.helper ? "Door cover agreed" : "No door cover agreed",
    ].map((label) => {
      const item = document.createElement("span");
      item.textContent = label;
      return item;
    }),
  );
  get("choices").replaceChildren(
    ...current.choices.map((choice) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "choice";
      const object = objects[choice.id] ?? { name: "In the room", shape: "paper" };
      button.dataset.object = object.shape;
      button.dataset.action = choice.id;
      const mark = document.createElement("span");
      mark.className = "object-mark";
      mark.setAttribute("aria-hidden", "true");
      const name = document.createElement("span");
      name.className = "object-name";
      name.textContent = object.name;
      name.setAttribute("aria-hidden", "true");
      const label = document.createElement("span");
      label.className = "action-label";
      label.textContent = choice.label;
      button.append(mark, name, label);
      if (choice.cost) {
        const cost = document.createElement("span");
        cost.className = "action-cost";
        cost.textContent = choice.cost;
        button.append(cost);
      }
      if (choice.note) {
        const note = document.createElement("span");
        note.className = "action-note";
        note.textContent = choice.note;
        button.append(note);
      }
      button.addEventListener("click", () => {
        if (busy) return;
        busy = true;
        try {
          game = choose(game, choice.id);
          loadNotice = "";
          save();
          render(true);
        } finally {
          busy = false;
        }
        if (game.outcome !== "playing") void checkpoint();
      });
      return button;
    }),
  );
  if (current.outcome !== "playing") {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "choice restart-choice";
    button.textContent = "Play another three days";
    button.addEventListener("click", () => {
      home();
      menu.showModal();
      get("restart-confirm").hidden = false;
      get("restart").focus();
    });
    get("choices").append(button);
  }
  room?.update(current);
  lab.screen(current.outcome === "playing" ? `day ${current.day}` : "ending");
  if (current.outcome !== "playing") lab.milestone("ending reached");
  if (focus) {
    get("title").focus({ preventScroll: true });
    scene.scrollIntoView({ block: "start", behavior: "instant" });
  }
}
const stopTracking = lab.trackRun(() => exportRun(game), { runKey: () => game.seed });
function recordingState() {
  recording.checked = lab.telemetryOn;
  get("recording-status").textContent = lab.telemetryOn
    ? "Play is recorded on this device."
    : "Play recording is off. You can still send feedback.";
}
function home() {
  get("menu-home").hidden = false;
  get("feedback-form").hidden = true;
  get("restart-confirm").hidden = true;
  get("lab").hidden = false;
  recordingState();
}
const menuButton = get<HTMLButtonElement>("menu");
menuButton.addEventListener("click", () => {
  home();
  menu.showModal();
});
menuButton.disabled = false;
get("resume").addEventListener("click", () => menu.close());
get("feedback").addEventListener("click", () => {
  get("menu-home").hidden = true;
  get("lab").hidden = true;
  get("feedback-form").hidden = false;
  feedbackNote.focus();
});
get("back").addEventListener("click", home);
get("stopping").addEventListener("click", () => {
  feedbackNote.value = "I'm stopping";
  feedbackStatus.textContent = "";
});
get("confused").addEventListener("click", () => {
  feedbackNote.value = "I'm confused";
  feedbackStatus.textContent = "";
});
recording.addEventListener("change", () => {
  if (recording.checked) lab.setPrivacyOverride(true);
  lab.setTelemetryOff(!recording.checked);
  recordingState();
});
get("fullscreen").addEventListener("click", async () => {
  try {
    if (document.fullscreenElement) await document.exitFullscreen();
    else await document.documentElement.requestFullscreen();
  } catch {
    get("recording-status").textContent = "Full screen is not available in this browser.";
  }
});
get("new-game").addEventListener("click", () => {
  get("restart-confirm").hidden = false;
});
get("cancel-restart").addEventListener("click", () => {
  get("restart-confirm").hidden = true;
});
get("restart").addEventListener("click", () => {
  if (busy) return;
  loadNotice = "";
  menu.close();
  void fresh(true).then((started) => {
    if (started) lab.captureSave(exportRun(game));
  });
});
get("submit-feedback").addEventListener("click", async () => {
  const note = feedbackNote.value.trim();
  if (!note) {
    feedbackStatus.textContent = "Write a note or choose a phrase first.";
    return;
  }
  const submit = get<HTMLButtonElement>("submit-feedback");
  submit.disabled = true;
  feedbackStatus.textContent = "Sending your note…";
  try {
    const receipt = await lab.sendFeedback(note);
    feedbackStatus.textContent = `Your note was stored. Receipt: ${receipt}`;
  } catch {
    feedbackStatus.textContent =
      "Your note could not be sent. Please try again. Your words are still here.";
  } finally {
    submit.disabled = false;
  }
});
function begin(off = false) {
  if (off) lab.setTelemetryOff(true);
  store("days-notice-v1", "1");
  notice.close();
  save();
  get("title").focus();
}
get("begin").addEventListener("click", () => begin());
get("begin-off").addEventListener("click", () => begin(true));
{
  const tools = get("lab");
  const exportButton = document.createElement("button");
  exportButton.type = "button";
  exportButton.textContent = "Export this play";
  const data = document.createElement("textarea");
  data.id = "export-data";
  data.setAttribute("aria-label", "Playtest export");
  data.rows = 5;
  data.hidden = true;
  const status = document.createElement("p");
  status.id = "lab-status";
  status.setAttribute("role", "status");
  const diagnostics = get("debug");
  const check = document.createElement("button");
  check.type = "button";
  check.textContent = "Check replay";
  check.hidden = true;
  const download = document.createElement("button");
  download.type = "button";
  download.textContent = "Download play";
  download.hidden = true;
  exportButton.addEventListener("click", () => {
    data.value = JSON.stringify(exportRun(game), null, 2);
    data.hidden = false;
    check.hidden = false;
    download.hidden = false;
  });
  check.addEventListener("click", () => {
    try {
      const restored = replay(JSON.parse(data.value));
      status.textContent =
        hashGame(restored) === hashGame(game)
          ? "Replay matches this play."
          : "Replay is valid but differs from this play.";
    } catch (error) {
      status.textContent =
        error instanceof Error && error.message.startsWith("This play was saved by an earlier")
          ? error.message
          : "This export did not pass the replay check.";
    }
  });
  download.addEventListener("click", () => {
    const url = URL.createObjectURL(new Blob([data.value], { type: "application/json" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = "three-days-play.json";
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  });
  tools.append(exportButton, data, download);
  diagnostics.append(check, status);
}
render();
if (restored) {
  busy = false;
  void checkpoint();
} else {
  void fresh();
}
if (read("days-notice-v1") !== "1") notice.showModal();
window.addEventListener("pagehide", () => {
  save();
  lab.flush();
});
window.addEventListener(
  "beforeunload",
  () => {
    stopTracking();
    disposed = true;
    room?.destroy();
  },
  { once: true },
);

// DOM object controls work before the room renderer loads and if graphics fail.
void import("./room.ts")
  .then(({ mountRoom }) => mountRoom(get("room")))
  .then((illustration) => {
    if (disposed) {
      illustration.destroy();
      return;
    }
    room = illustration;
    room.update(view(game));
  })
  .catch(() => {
    // The story and menu remain usable when graphics are unavailable.
  });
