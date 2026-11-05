import { expect, type Page, test } from "@playwright/test";

async function exposed(page: Page, selector: string) {
  const node = page.locator(selector).first();
  await expect(node).toBeInViewport({ ratio: 1 });
  await expect
    .poll(() =>
      node.evaluate((el) => {
        const r = el.getBoundingClientRect();
        return el.contains(document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2));
      }),
    )
    .toBe(true);
}

test("first choices and their real aftermath remain visible and skippable", async ({ page }) => {
  await page.goto("/");
  const begin = page.locator("#begin-off");
  if (await begin.isVisible()) await begin.click();
  await exposed(page, '[data-guide="opening"]');
  await exposed(page, "[data-guide-target]");
  await exposed(page, "[data-guide-skip]");
  await page.locator("[data-guide-target]").first().click();
  await exposed(page, '[data-guide="account"]');
  await exposed(page, "[data-guide-target]");
  await page.locator("[data-guide-target]").first().click();
  await exposed(page, '[data-guide="result"]');
  await expect(page.locator("[data-guide-account]")).toHaveAttribute("data-state", "pending");
  await expect(page.locator("[data-guide-account]")).toContainText("Receipt obtained");
  await expect(page.locator("[data-guide-privacy]")).toHaveAttribute("data-state", "private");
  await exposed(page, '[data-action="read"]');
  await page.locator('[data-action="read"]').click();
  await expect(page.locator("[data-guide-privacy]")).toHaveAttribute("data-state", "exposed");
  await exposed(page, "[data-guide-skip]");
  await page.locator("[data-guide-skip]").click();
  await expect(page.locator("[data-guide]")).toHaveCount(0);
  const saved = await page.evaluate(() => localStorage.getItem("days-run-v1"));
  await page.locator("#menu").click();
  await page.locator("#guide-replay").click();
  await exposed(page, "[data-guide]");
  await expect.poll(() => page.evaluate(() => localStorage.getItem("days-run-v1"))).toBe(saved);
  await page.locator("[data-guide-skip]").click();
});

test("an unfinished guide survives reloading the current run", async ({ page }) => {
  await page.goto("/");
  if (await page.locator("#begin-off").isVisible()) await page.locator("#begin-off").click();
  await exposed(page, '[data-guide="opening"]');
  await page.reload();
  await exposed(page, '[data-guide="opening"]');
  await page.locator("[data-guide-skip]").click();
});
