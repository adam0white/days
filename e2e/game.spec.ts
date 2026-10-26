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
