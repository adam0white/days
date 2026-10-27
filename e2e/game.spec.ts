import { expect, test } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.route("https://human.adamwhite.work/lab/api/**", (route) => route.abort());
});

test("a complete run, menu and lab tools fit this screen", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/?lab=1");
  await page.getByRole("button", { name: "Begin the three days" }).click();
  await expect(page.locator("#scene")).toBeVisible();
  for (
    let i = 0;
    i < 25 && (await page.locator("#scene").getAttribute("data-outcome")) === "playing";
    i++
  ) {
    await page.locator(".choice").first().click();
  }
  await expect(page.locator("#scene")).toHaveAttribute("data-outcome", /won|lost/);
  await expect(page.locator("body")).toHaveJSProperty(
    "scrollWidth",
    await page.locator("body").evaluate((e) => e.clientWidth),
  );
  await page.getByRole("button", { name: "Menu", exact: true }).click();
  await page.getByRole("button", { name: "Export this play" }).click();
  await expect(page.locator("#export-data")).toBeVisible();
  await page.getByRole("button", { name: "Check replay" }).click();
  await expect(page.locator("#lab-status")).toContainText("matches");
  expect(errors).toEqual([]);
});

test("feedback selection sends nothing and errors remain visible", async ({ page }) => {
  let submissions = 0;
  await page.route("**/lab/api/**", async (route) => {
    submissions++;
    await route.abort();
  });
  await page.goto("/");
  await page.getByRole("button", { name: "Begin the three days" }).click();
  await page.getByRole("button", { name: "Menu", exact: true }).click();
  await page.getByRole("button", { name: "Feedback", exact: true }).click();
  const before = submissions;
  await page.getByRole("button", { name: "I'm confused", exact: true }).click();
  expect(submissions).toBe(before);
  await page.getByRole("button", { name: "Submit feedback" }).click();
  await expect(page.locator("#feedback-status")).toContainText(/could not|failed|try|network/i, {
    timeout: 15000,
  });
  await expect(page.getByLabel("Your feedback")).toHaveValue("I'm confused");
});

test("ordinary play hides diagnostics and recording has one switch", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Begin the three days" }).click();
  await page.getByRole("button", { name: "Menu", exact: true }).click();
  await expect(page.getByRole("button", { name: "Export this play" })).toHaveCount(0);
  const recording = page.getByRole("checkbox", { name: "Recording" });
  await recording.uncheck();
  await expect(recording).not.toBeChecked();
  await page.reload();
  await page.getByRole("button", { name: "Menu", exact: true }).click();
  await expect(recording).not.toBeChecked();
});

test("feedback explains the Recording switch and has no separate play consent", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Begin with Recording off" }).click();
  await page.getByRole("button", { name: "Menu", exact: true }).click();
  await page.getByRole("button", { name: "Feedback", exact: true }).click();
  await expect(
    page.getByText(
      "With Recording off, feedback sends an unlinked note. With Recording on, it includes your recorded play.",
      { exact: true },
    ),
  ).toBeVisible();
  await expect(page.getByRole("checkbox")).toHaveCount(0);
});

test("New game starts a distinct recorded attempt", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Begin the three days" }).click();
  const previous = await page.evaluate(() => sessionStorage.getItem("hf-lab-run:days"));
  await page.getByRole("button", { name: "Menu", exact: true }).click();
  await page.getByRole("button", { name: "New game", exact: true }).click();
  await page.getByRole("button", { name: "Yes, start again", exact: true }).click();
  await expect
    .poll(() => page.evaluate(() => sessionStorage.getItem("hf-lab-run:days")))
    .not.toBe(previous);
});

test("story and menu work while the renderer waits or fails", async ({ page }) => {
  let releaseRenderer = () => {};
  const rendererGate = new Promise<void>((resolve) => {
    releaseRenderer = resolve;
  });
  let rendererRequested = false;
  let failRenderer = false;
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.route("**/assets/WebGLRenderer-*.js", async (route) => {
    rendererRequested = true;
    if (failRenderer) {
      await route.abort();
      return;
    }
    await rendererGate;
    await route.continue();
  });
  try {
    await page.goto("/", { waitUntil: "commit" });
    await expect.poll(() => rendererRequested).toBe(true);
    await page.getByRole("button", { name: "Begin the three days" }).click({ timeout: 3000 });
    await page.getByRole("button", { name: "Menu", exact: true }).click();
    await expect(page.getByRole("dialog", { name: "The door can wait" })).toBeVisible();
    await page.getByRole("button", { name: "Resume", exact: true }).click();
    await page.locator(".choice").first().click();
    await expect(page.getByRole("heading", { name: "A folded account" })).toBeVisible();
    await expect(page.locator("#room canvas")).toHaveCount(0);
    releaseRenderer();
    await expect(page.locator("#room canvas")).toBeVisible();
    await expect(page.getByRole("heading", { name: "A folded account" })).toBeVisible();

    failRenderer = true;
    await page.reload({ waitUntil: "commit" });
    await page.getByRole("button", { name: "Menu", exact: true }).click();
    await expect(page.getByRole("dialog", { name: "The door can wait" })).toBeVisible();
    await page.getByRole("button", { name: "Resume", exact: true }).click();
    await expect(page.getByRole("heading", { name: "A folded account" })).toBeVisible();
    await page.locator(".choice").first().click();
    await expect(page.getByRole("heading", { name: "A page folded inwards" })).toBeVisible();
    expect(errors).toEqual([]);
  } finally {
    releaseRenderer();
  }
});

test("room objects expose their action and cost before activation", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Begin with Recording off" }).click();
  const choices = page.locator("#choices .choice");
  await expect(choices).toHaveCount(2);
  await expect(page.locator("#room-status")).toContainText("hours");
  for (const choice of await choices.all()) {
    await expect(choice.locator(".object-mark")).toBeVisible();
    await expect(choice.locator(".action-label")).toBeVisible();
    await expect(choice.locator(".action-cost")).toBeVisible();
    await expect(choice).toHaveAccessibleName(/.+/);
  }
  const boxes = await choices.evaluateAll((nodes) =>
    nodes.map((node) => {
      const rect = node.getBoundingClientRect();
      return { left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom };
    }),
  );
  expect(boxes[0]?.right).toBeLessThanOrEqual(boxes[1]?.left ?? 0);
  await choices.first().focus();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("heading", { name: "A folded account" })).toBeVisible();
});

test("the opening offers a whole first choice without scrolling", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Begin with Recording off" }).click();
  expect(await page.evaluate(() => window.scrollY)).toBe(0);
  const first = page.locator("#choices .choice").first();
  const box = await first.boundingBox();
  expect(box).not.toBeNull();
  expect(box!.y).toBeGreaterThanOrEqual(0);
  expect(box!.y + box!.height).toBeLessThanOrEqual(page.viewportSize()!.height);
  await expect(page.getByText(/^Keep a clear account/)).toBeVisible();
  if (page.viewportSize()!.width <= 700) {
    await expect(page.locator("#opening-cast")).toBeInViewport();
    await expect(page.locator("#opening-cast")).toContainText("Hacer has come to pay her respects");
    await page.getByText("How Leyla came home", { exact: true }).click();
  }
  await expect(page.getByText(/Kemal's coat still hangs/)).toBeVisible();
  await expect(page.getByText(/Hacer says, "I follow the view/)).toBeVisible();
});

test("each decision names distinct objects", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Begin with Recording off" }).click();
  for (let step = 0; step < 12; step++) {
    const names = await page.locator("#choices .object-name").allTextContents();
    expect(new Set(names).size).toBe(names.length);
    if (step === 7) {
      await expect(page.locator('[data-action="protect"] .object-name')).toHaveText(
        "The bill to copy",
      );
      await expect(page.locator('[data-action="publish"] .object-name')).toHaveText(
        "The notebook to lend",
      );
    }
    await page.locator("#choices .choice").first().click();
  }
});
