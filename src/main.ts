import { createLab } from "@adam0white/lab-client";
import { choose, createGame, exportRun, hashGame, replay, view } from "./engine.ts";
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
const menu = get<HTMLDialogElement>("menu-dialog");
const notice = get<HTMLDialogElement>("notice");
const recording = get<HTMLInputElement>("recording");
const feedbackNote = get<HTMLTextAreaElement>("feedback-note");
const feedbackStatus = get("feedback-status");
const scene = get("scene");
const storageKey = "days-run-v1";
const newSeed = () => crypto.getRandomValues(new Uint32Array(1))[0] ?? 1;
let game = createGame(newSeed());
const saved = read(storageKey);
if (saved) {
  try {
    game = replay(JSON.parse(saved));
  } catch {
    store(storageKey, "");
  }
}
let room: Awaited<ReturnType<typeof mountRoom>> | undefined;
let disposed = false;
let busy = false;
function save() {
  store(storageKey, JSON.stringify(exportRun(game)));
}
function render(focus = false) {
  const current = view(game);
  scene.dataset.outcome = current.outcome;
  get("progress").textContent = current.progress;
  get("title").textContent = current.title;
  get("text").replaceChildren(
    ...current.text.map((line) => {
      const p = document.createElement("p");
      p.textContent = line;
      return p;
    }),
  );
  get("choices").replaceChildren(
    ...current.choices.map((choice) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "choice";
      button.textContent = choice.label;
      button.addEventListener("click", () => {
        if (busy) return;
        busy = true;
        try {
          game = choose(game, choice.id);
          save();
          render(true);
        } finally {
          busy = false;
        }
      });
      return button;
    }),
  );
  if (current.outcome !== "playing") {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "choice";
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
    if (window.matchMedia("(min-width: 900px)").matches) window.scrollTo(0, 0);
    else scene.scrollIntoView({ block: "start", behavior: "instant" });
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
  game = createGame(newSeed());
  lab.captureSave(exportRun(game));
  save();
  menu.close();
  render(true);
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
if (new URLSearchParams(location.search).get("lab") === "1") {
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
    } catch {
      status.textContent = "This export did not pass the replay check.";
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
  tools.append(exportButton, data, check, download, status);
}
render();
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

// The room is decorative. Loading it must not delay play or the recording controls.
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
