import { expect, test } from "@playwright/test";

// The premade theories and the long tape explanations. Read-only: nothing here changes the shared database.
test.describe("tape explanations", () => {
  test("a tape page has the full explanation, blurred as a spoiler until clicked", async ({ page }) => {
    // Spoiler blur is off by default; a visitor turns it on from the home page.
    await page.goto("/");
    await page.getByRole("button", { name: /Spoiler guard/ }).click();
    await expect(page.locator("html")).toHaveAttribute("data-spoilers", "on");
    await page.goto("/tapes/2");
    const body = page.locator(".detail-body");
    await expect(body).toBeVisible();
    await expect(body.getByRole("heading", { name: "What it settles" })).toBeAttached();
    await expect(body).not.toHaveClass(/\brev\b/);
    expect(await body.evaluate((el) => getComputedStyle(el).filter)).toContain("blur");
    await body.click({ position: { x: 20, y: 20 } });
    await expect(body).toHaveClass(/\brev\b/);
    expect(await body.evaluate((el) => getComputedStyle(el).filter)).toBe("none");
    await expect(body).toContainText("Tell an authority figure");
  });

  test("the home page player links to the explanation and does not ship the long text", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("link", { name: "Full explanation" })).toHaveAttribute("href", /\/tapes\/\d+#detail/);
    const html = await page.content();
    expect(html).not.toContain("## What happens");
    expect(html).not.toContain("What it leaves open");
  });

  test("every tape page shows its explanation", async ({ page }) => {
    for (let id = 1; id <= 19; id++) {
      const res = await page.goto(`/tapes/${id}`);
      expect(res?.status(), `tape ${id}`).toBe(200);
      await expect(page.locator(".detail-body h3.rh").first(), `tape ${id}`).toBeAttached();
    }
  });
});

test.describe("fan theories", () => {
  test("the home page lists them as unconfirmed, with a nav link", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto("/");
    const section = page.locator("#theories");
    await expect(section.getByRole("heading", { level: 2 })).toBeVisible();
    expect(await section.locator(".theory-card").count()).toBeGreaterThanOrEqual(10);
    await expect(section.locator(".theory-card").first().getByText("Unconfirmed")).toBeVisible();
    await page.locator("header.nav").getByRole("link", { name: "Theories", exact: true }).click();
    await expect(page).toHaveURL(/#theories$/);
  });

  test("a theory page shows the claim, the case for and against, the tapes and the source", async ({ page }) => {
    await page.goto("/");
    await page.locator("#theories .theory-card").first().click();
    await expect(page).toHaveURL(/\/theories\/\d+$/);
    await expect(page.getByText("FAN THEORY · UNCONFIRMED")).toBeVisible();
    await expect(page.getByRole("heading", { name: "What supports it" })).toBeAttached();
    await expect(page.getByRole("heading", { name: "What argues against it, or is still open" })).toBeAttached();
    await expect(page.getByText("Where it comes from")).toBeVisible();
    const tape = page.locator(".theory-tapes a").first();
    await tape.click();
    await expect(page).toHaveURL(/\/tapes\/\d+$/);
    await expect(page.locator("#theories .theory-links a").first()).toBeVisible(); // and the tape links back
  });

  test("an unknown theory is a 404, and search finds theories", async ({ page }) => {
    expect((await page.goto("/theories/99999"))?.status()).toBe(404);
    await page.goto("/search?q=Sleeper");
    await expect(page.getByText("Fan theories (unconfirmed)")).toBeVisible();
  });

  test("no horizontal scroll on a phone", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    for (const path of ["/", "/theories/1", "/tapes/9"]) {
      await page.goto(path);
      expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth), path).toBeLessThanOrEqual(0);
    }
  });
});
