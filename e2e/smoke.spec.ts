import { expect, test, type Browser, type Page } from "@playwright/test";

const ADMIN = { username: "e2eadmin", password: "e2e-admin-password" };
const PASSWORD = "reader-password-123";
const run = Date.now().toString(36).slice(-6);
const name = (tag: string) => `e2e_${tag}_${run}`.slice(0, 24);

async function register(page: Page, username: string) {
  await page.goto("/register");
  await page.locator('input[name="username"]').fill(username);
  await page.locator('input[name="password"]').fill(PASSWORD);
  await page.locator('input[name="confirm"]').fill(PASSWORD);
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page.locator(".who")).toHaveText(username);
}

async function login(page: Page, username: string, password: string) {
  await page.goto("/login");
  await page.locator('input[name="username"]').fill(username);
  await page.locator('input[name="password"]').fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
}

// Signing in is rate limited per account, so the admin signs in once and each test reuses that session.
let adminState: Awaited<ReturnType<import("@playwright/test").BrowserContext["storageState"]>>;

test.beforeAll(async ({ browser }) => {
  const ctx = await browser.newContext({ baseURL: "http://127.0.0.1:3100" });
  const page = await ctx.newPage();
  await login(page, ADMIN.username, ADMIN.password);
  await expect(page.locator(".who")).toHaveText(ADMIN.username);
  adminState = await ctx.storageState();
  await ctx.close();
});

async function asAdmin(browser: Browser) {
  const ctx = await browser.newContext({ storageState: adminState });
  const page = await ctx.newPage();
  await page.goto("/");
  await expect(page.locator(".who")).toHaveText(ADMIN.username);
  return { ctx, page };
}

test.describe("public site", () => {
  test("home and a tape page render", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("h1").first()).toBeVisible();
    await page.goto("/tapes/1");
    await expect(page.getByRole("heading", { name: "Theories and comments" })).toBeVisible();
  });

  test("unknown path shows the 404 page", async ({ page }) => {
    const res = await page.goto("/no-such-page");
    expect(res?.status()).toBe(404);
    await expect(page.getByRole("heading", { name: "No signal" })).toBeVisible();
  });

  test("no horizontal scroll at phone width", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    for (const path of ["/", "/tapes/1", "/login", "/register"]) {
      await page.goto(path);
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      expect(overflow, `${path} overflows by ${overflow}px`).toBeLessThanOrEqual(0);
    }
  });

  test("admin area sends anonymous visitors to sign in", async ({ page }) => {
    await page.goto("/admin/users");
    await expect(page).toHaveURL(/\/login\?next=/);
  });
});

test.describe("accounts", () => {
  test("a wrong password is refused with a generic message", async ({ page }) => {
    await login(page, ADMIN.username, "not-the-password");
    await expect(page.locator("p.err")).toHaveText("Wrong username or password.");
    await expect(page.locator(".who")).toHaveCount(0);
  });

  test("a failed sign-in or sign-up keeps the username but never the passwords", async ({ page }) => {
    await page.goto("/login");
    await page.locator('input[name="username"]').fill(ADMIN.username);
    await page.locator('input[name="password"]').fill("not-the-password");
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page.locator("p.err")).toBeVisible();
    await expect(page.locator('input[name="username"]')).toHaveValue(ADMIN.username);
    await expect(page.locator('input[name="password"]')).toHaveValue("");
    // The retry works without retyping the username.
    await page.locator('input[name="password"]').fill(ADMIN.password);
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page.locator(".who")).toHaveText(ADMIN.username);

    const other = await page.context().browser()!.newContext();
    const p2 = await other.newPage();
    await p2.goto("/register");
    await p2.locator('input[name="username"]').fill(name("echo"));
    await p2.locator('input[name="password"]').fill(PASSWORD);
    await p2.locator('input[name="confirm"]').fill("something-else-123");
    await p2.getByRole("button", { name: "Create account" }).click();
    await expect(p2.locator("p.err")).toHaveText("The two passwords do not match.");
    await expect(p2.locator('input[name="username"]')).toHaveValue(name("echo"));
    await expect(p2.locator('input[name="password"]')).toHaveValue("");
    await expect(p2.locator('input[name="confirm"]')).toHaveValue("");
    await other.close();
  });

  test("register, sign out, sign back in", async ({ page }) => {
    const u = name("acct");
    await register(page, u);
    await page.getByRole("button", { name: "Sign out" }).click();
    await expect(page.locator(".who")).toHaveCount(0);
    await login(page, u, PASSWORD);
    await expect(page.locator(".who")).toHaveText(u);
  });

  test("a regular member is kept out of /admin", async ({ page }) => {
    await register(page, name("plain"));
    await page.goto("/admin");
    await expect(page).toHaveURL(/127\.0\.0\.1:3100\/$/);
    await expect(page.getByRole("link", { name: "Admin" })).toHaveCount(0);
  });
});

test.describe("posting and moderation", () => {
  test("comments show at once; theories wait for an admin", async ({ page, browser }) => {
    const author = name("post");
    const comment = `Comment from ${author}`;
    const theory = `Theory from ${author}`;
    await register(page, author);

    await page.goto("/tapes/1");
    await page.getByLabel("Post type").selectOption("comment");
    await page.getByLabel("Your post").fill(comment);
    await page.getByRole("button", { name: "Post", exact: true }).click();
    await expect(page.getByText("Posted.")).toBeVisible();
    await expect(page.getByText(comment)).toBeVisible();

    await page.getByLabel("Post type").selectOption("theory");
    await page.getByLabel("Your post").fill(theory);
    await page.getByRole("button", { name: "Post", exact: true }).click();
    await expect(page.getByText(/An admin will review/)).toBeVisible();
    await page.reload();
    await expect(page.getByText(theory)).toBeVisible(); // the author still sees their own pending post

    // A stranger sees the comment but not the theory.
    const stranger = await browser.newContext();
    const sp = await stranger.newPage();
    await sp.goto("/tapes/1");
    await expect(sp.getByText(comment)).toBeVisible();
    await expect(sp.getByText(theory)).toHaveCount(0);

    // Admin approves it.
    const admin = await asAdmin(browser);
    await admin.page.goto("/admin/moderation");
    const item = admin.page.locator(".cm", { hasText: theory });
    await expect(item).toBeVisible();
    await item.getByRole("button", { name: "Approve" }).click();
    await expect(admin.page.locator(".cm", { hasText: theory }).locator(".pill")).toHaveText("visible");

    await sp.reload();
    await expect(sp.getByText(theory)).toBeVisible();

    // Hiding it takes it away again.
    await admin.page.locator(".cm", { hasText: theory }).getByRole("button", { name: "Hide" }).click();
    await expect(admin.page.locator(".cm", { hasText: theory }).locator(".pill")).toHaveText("hidden");
    await sp.reload();
    await expect(sp.getByText(theory)).toHaveCount(0);

    await stranger.close();
    await admin.ctx.close();
  });
});

test.describe("display preferences", () => {
  test("a theme choice sticks in the browser and follows the account", async ({ page, browser }) => {
    const u = name("theme");
    await register(page, u);
    await page.getByRole("button", { name: "Display" }).click();
    await page.getByLabel("Phosphor green").check();
    await expect(page.locator("html")).toHaveAttribute("data-theme", "phosphor");
    await page.getByLabel("Large").check();
    await expect(page.locator("html")).toHaveAttribute("data-size", "lg");
    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog")).toHaveCount(0);

    await page.reload();
    await expect(page.locator("html")).toHaveAttribute("data-theme", "phosphor");

    // A different browser with no cookie gets it from the account after signing in.
    const other = await browser.newContext();
    const op = await other.newPage();
    await login(op, u, PASSWORD);
    await expect(op.locator(".who")).toHaveText(u);
    await op.reload();
    await expect(op.locator("html")).toHaveAttribute("data-theme", "phosphor");
    await expect(op.locator("html")).toHaveAttribute("data-size", "lg");
    await other.close();
  });
});

test.describe("admin area", () => {
  test("every admin page loads", async ({ browser }) => {
    const { ctx, page } = await asAdmin(browser);
    const paths = ["/admin", "/admin/moderation", "/admin/settings", "/admin/users"];
    for (const e of ["tapes", "characters", "quiz", "sources", "guide", "cards"]) paths.push(`/admin/${e}`, `/admin/${e}/new`);
    for (const p of paths) {
      const res = await page.goto(p);
      expect(res?.status(), p).toBe(200);
      await expect(page.locator("h1").first(), p).toBeVisible();
    }
    await ctx.close();
  });

  test("create, validate and delete a source", async ({ browser }) => {
    const { ctx, page } = await asAdmin(browser);
    const title = `E2E source ${run}`;

    await page.goto("/admin/sources/new");
    await page.locator('input[name="title"]').fill(title);
    await page.locator('input[name="url"]').fill("javascript:alert(1)");
    await page.getByRole("button", { name: "Save" }).click();
    await expect(page.locator(".flash.bad")).toContainText("http");

    await page.goto("/admin/sources/new");
    await page.locator('input[name="title"]').fill(title);
    await page.locator('input[name="url"]').fill("https://example.com/e2e");
    await page.getByRole("button", { name: "Save" }).click();
    await expect(page.getByText("Saved.")).toBeVisible();
    const row = page.locator("tr", { hasText: title });
    await expect(row).toHaveCount(1);

    await row.getByRole("button", { name: "Delete" }).click();
    await expect(page.getByText("Deleted.")).toBeVisible();
    await expect(page.locator("tr", { hasText: title })).toHaveCount(0);
    await ctx.close();
  });

  test("hiding a section removes it from the home page, and showing it brings it back", async ({ browser }) => {
    const { ctx, page } = await asAdmin(browser);
    const setQuiz = async (on: boolean) => {
      await page.goto("/admin/settings");
      await page.locator('input[name="show_quiz"]').setChecked(on);
      await page.getByRole("button", { name: "Save settings" }).click();
      await expect(page.getByText("Saved.")).toBeVisible();
    };
    try {
      await setQuiz(false);
      await page.goto("/");
      await expect(page.locator("section#test")).toHaveCount(0);
    } finally {
      await setQuiz(true);
    }
    await page.goto("/");
    await expect(page.locator("section#test")).toHaveCount(1);
    await ctx.close();
  });
});

test.describe("home page behaviour", () => {
  test("pressing the tape filters never moves the page", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto("/");
    await page.waitForSelector(".filters");
    for (const gap of [160, 300]) {
      for (const label of ["Main volumes", "Shorts", "All 19", "Gabriel", "Alternates", "All", "In-story", "Release"]) {
        // Put the filter bar `gap` px above the bottom of the viewport, instantly.
        await page.evaluate((g) => {
          document.documentElement.style.scrollBehavior = "auto";
          const f = document.querySelector(".filters")!;
          window.scrollTo(0, f.getBoundingClientRect().top + window.scrollY - (window.innerHeight - g));
        }, gap);
        const before = await page.evaluate(() => ({ y: Math.round(window.scrollY), top: Math.round(document.querySelector(".filters")!.getBoundingClientRect().top) }));
        await page.getByRole("button", { name: label, exact: true }).first().click();
        await page.waitForTimeout(250); // let the shelf re-render and any scroll anchoring settle
        const after = await page.evaluate(() => ({ y: Math.round(window.scrollY), top: Math.round(document.querySelector(".filters")!.getBoundingClientRect().top) }));
        expect(after, `after clicking "${label}" (bar ${gap}px above the bottom)`).toEqual(before);
      }
    }
  });

  test("the hero shows its readouts", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator(".hero .kicker")).toContainText("Analog horror");
    await expect(page.locator(".hero .kicker .rec")).toBeVisible();
    await expect(page.locator(".hero .sub .cap")).toContainText("field guide");
    const labels = await page.locator(".hero .stats dt").allTextContents();
    expect(labels).toEqual(["volumes", "shorts", "footage", "released"]);
    await expect(page.locator(".hero .stats dd").nth(1)).toHaveText("13");
  });

  test("every cassette links to its original video on YouTube", async ({ page }) => {
    await page.goto("/");
    const links = page.locator(".tapewrap a.yt");
    await expect(links).toHaveCount(19);
    const hrefs = await links.evaluateAll((as) => as.map((a) => (a as HTMLAnchorElement).href));
    for (const h of hrefs) expect(h).toMatch(/^https:\/\/www\.youtube\.com\/watch\?v=[A-Za-z0-9_-]{11}$/);
    expect(new Set(hrefs).size).toBe(19);
    await expect(links.first()).toHaveAttribute("target", "_blank");
    await expect(links.first()).toHaveAttribute("rel", /noopener/);
    await expect(links.first()).toHaveAttribute("aria-label", /Watch .* on YouTube/);
    // The player card and the tape page offer it too.
    await expect(page.locator("#now a.watch")).toHaveAttribute("href", /youtube\.com\/watch/);
    await expect(page.getByRole("link", { name: /^Watch the original/ })).toHaveCount(1);
    await page.goto("/tapes/1");
    await expect(page.locator("a.btn.watch")).toHaveAttribute("href", hrefs[0]);
  });

  test("an admin can set and clear a tape's YouTube link", async ({ browser }) => {
    const { ctx, page } = await asAdmin(browser);
    await page.goto("/admin/tapes/new");
    await page.locator('input[name="title"]').fill(`E2E tape ${run}`);
    await page.locator('input[name="release_date"]').fill("2031-01-01");
    await page.locator('input[name="runtime"]').fill("1:00");
    await page.locator('input[name="youtube_url"]').fill("https://evil.example/x");
    await page.getByRole("button", { name: "Save" }).click();
    await expect(page.locator(".flash.bad")).toContainText("YouTube link");
    await page.goto("/admin/tapes/new");
    await page.locator('input[name="title"]').fill(`E2E tape ${run}`);
    await page.locator('input[name="release_date"]').fill("2031-01-01");
    await page.locator('input[name="runtime"]').fill("1:00");
    await page.locator('input[name="youtube_url"]').fill("https://youtu.be/abcdefghijk");
    await page.getByRole("button", { name: "Save" }).click();
    await expect(page.getByText("Saved.")).toBeVisible();
    await page.goto("/");
    await expect(page.locator('.tapewrap a.yt[href="https://youtu.be/abcdefghijk"]')).toHaveCount(1);
    // Clean up so later runs and other tests see the original 19.
    await page.goto("/admin/tapes");
    await page.locator("tr", { hasText: `E2E tape ${run}` }).getByRole("button", { name: "Delete" }).click();
    await expect(page.getByText("Deleted.")).toBeVisible();
    await ctx.close();
  });
});
