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
    await page.getByRole("button", { name: "Your account menu" }).click();
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
    await expect(page.locator(".cmt-compose .okmsg")).toHaveText("Posted.");
    await expect(page.getByText(comment)).toBeVisible();

    await page.getByLabel("Post type").selectOption("theory");
    await page.getByLabel("Your post").fill(theory);
    await page.getByRole("button", { name: "Post", exact: true }).click();
    await expect(page.locator(".cmt-compose .okmsg")).toContainText("An admin will review");
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

  test("switching tapes always shows exactly one summary, and it belongs to the selected tape", async ({ page }) => {
    await page.goto("/");
    await page.waitForSelector(".tapewrap");
    const state = () =>
      page.evaluate(() => ({
        title: document.querySelector("#now h3")!.textContent,
        sums: [...document.querySelectorAll("#now .sum")].map((e) => e.textContent!.slice(0, 40)),
        stills: document.querySelectorAll("#now .stills").length,
      }));
    const expectOne = async (label: string, mentions: RegExp) => {
      const st = await state();
      expect(st.sums, `${label}: summaries shown`).toHaveLength(1);
      expect(st.sums[0], `${label}: summary text`).toMatch(mentions);
      expect(st.stills, `${label}: stills blocks`).toBe(1);
      return st;
    };
    await expectOne("initial", /2011/); // Vol. 6, the newest main volume
    for (const [cassette, mentions] of [["PRESTO", /MandelaTech/], ["EXHIBITION", /Heathcliff/], ["INTERLUDE", /population/], ["PRESTO", /MandelaTech/]] as const) {
      await page.locator(".tapewrap", { hasText: cassette }).locator("button.tape").click();
      await expect(page.locator("#now h3")).toHaveText(new RegExp(`^${cassette}$`, "i"));
      await expectOne(cassette, mentions);
    }
    await page.getByRole("button", { name: /Prev/ }).click();
    await expect(page.locator("#now h3")).toHaveText(/mandela catalyst/i);
    await expectOne("Prev", /autopsy/);
    await page.getByRole("button", { name: /Next/ }).click();
    await expectOne("Next", /MandelaTech/);
  });

  test("a revealed spoiler is blurred again when another tape is loaded", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: /Spoiler guard/ }).click();
    await expect(page.locator("html")).toHaveAttribute("data-spoilers", "on");
    await page.locator("#now .sum").click();
    await expect(page.locator("#now .sum")).toHaveClass(/rev/);
    await page.locator(".tapewrap", { hasText: "PRESTO" }).locator("button.tape").click();
    await expect(page.locator("#now h3")).toHaveText(/^presto$/i);
    await expect(page.locator("#now .sum")).not.toHaveClass(/rev/);
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

test.describe("original footage", () => {
  test("a tape page shows the video poster with its credit, and plays from YouTube only after a click", async ({ page }) => {
    await page.goto("/tapes/1");
    const vid = page.locator(".vid");
    await expect(vid).toBeVisible();
    // Poster is the uploader's thumbnail; nothing from the player is loaded yet.
    await expect(vid.locator("img")).toHaveAttribute("src", "https://i.ytimg.com/vi/q0EpOiu8YkI/hqdefault.jpg");
    await expect(vid.locator("iframe")).toHaveCount(0);
    // Credit line: rights holder, the video it came from, and that it is not hosted here.
    const credit = vid.locator("figcaption");
    await expect(credit).toContainText("\u00a9 Alex Kister");
    await expect(credit).toContainText("The Mandela Catalogue");
    await expect(credit).toContainText("does not host it");
    await expect(credit.getByRole("link")).toHaveAttribute("href", "https://www.youtube.com/watch?v=q0EpOiu8YkI");
    await expect(credit.getByRole("link")).toHaveAttribute("rel", /noopener/);
    await vid.getByRole("button", { name: /Play the original video/ }).click();
    const frame = vid.locator("iframe");
    await expect(frame).toHaveCount(1);
    await expect(frame).toHaveAttribute("src", /^https:\/\/www\.youtube-nocookie\.com\/embed\/q0EpOiu8YkI\?/);
    await expect(frame).toHaveAttribute("allowfullscreen", "");
    await expect(frame).toHaveAttribute("title", /original video on YouTube/);
  });

  test("tapes on the affiliated channel credit that channel", async ({ page }) => {
    await page.goto("/tapes/10");
    await expect(page.locator(".vid figcaption")).toContainText("GENESIS APOCRYPHON");
    await expect(page.locator(".vid figcaption")).toContainText("\u00a9 Alex Kister");
    await page.goto("/tapes/13");
    await expect(page.locator(".vid figcaption")).toContainText("GENESIS APOCRYPHON");
  });

  test("the home page player shows the video beside the summary, and switching tapes resets it", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto("/");
    await page.waitForSelector(".tapewrap");
    const vid = page.locator("#now .vid");
    await expect(vid).toBeVisible();
    const sum = (await page.locator("#now .sum").boundingBox())!;
    const box = (await vid.boundingBox())!;
    expect(box.x, "video sits to the right of the summary").toBeGreaterThan(sum.x + sum.width - 5);
    const first = await vid.locator("img").getAttribute("src");
    await vid.getByRole("button", { name: /Play the original video/ }).click();
    await expect(vid.locator("iframe")).toHaveCount(1);
    // Another tape: the old video stops, and the new poster and credit show.
    await page.locator(".tapewrap", { hasText: "PRESTO" }).locator("button.tape").click();
    await expect(page.locator("#now h3")).toHaveText(/^presto$/i);
    await expect(vid.locator("iframe")).toHaveCount(0);
    await expect(vid.locator("img")).toHaveAttribute("src", "https://i.ytimg.com/vi/Ks-_wIWzZdg/hqdefault.jpg");
    expect(await vid.locator("img").getAttribute("src")).not.toBe(first);
    await expect(page.locator("#now .vid figcaption")).toContainText("Presto");
    // On a phone it stacks under the text and nothing scrolls sideways.
    await page.setViewportSize({ width: 390, height: 844 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(0);
    const phoneSum = (await page.locator("#now .sum").boundingBox())!;
    const phoneVid = (await page.locator("#now .vid").boundingBox())!;
    expect(phoneVid.y).toBeGreaterThan(phoneSum.y);
  });

  test("an admin can change the channel credit", async ({ browser }) => {
    const { ctx, page } = await asAdmin(browser);
    await page.goto("/admin/tapes/3");
    await expect(page.locator('input[name="youtube_channel"]')).toHaveValue("Alex Kister");
    await page.locator('input[name="youtube_channel"]').fill("Some Other Channel");
    await page.getByRole("button", { name: "Save" }).click();
    await expect(page.getByText("Saved.")).toBeVisible(); // wait for the save before leaving the page
    await page.goto("/tapes/3");
    await expect(page.locator(".vid figcaption")).toContainText("Some Other Channel");
    // restore it
    await page.goto("/admin/tapes/3");
    await page.locator('input[name="youtube_channel"]').fill("Alex Kister");
    await page.getByRole("button", { name: "Save" }).click();
    await expect(page.getByText("Saved.")).toBeVisible();
    await page.goto("/tapes/3");
    await expect(page.locator(".vid figcaption")).not.toContainText("Some Other Channel");
    await ctx.close();
  });
});

test.describe("site shell: navigation bar, footer and helpers", () => {
  const SECTIONS = ["Premise", "Tapes", "Field guide", "Case files", "Reading it", "Outside", "Test", "Sources"];

  test("on a wide screen the bar is one tidy row with every section and no clutter", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto("/");
    const bar = page.locator("header.nav");
    const nav = bar.getByRole("navigation", { name: "Sections" });
    for (const s of SECTIONS) await expect(nav.getByRole("link", { name: s, exact: true })).toBeVisible();
    await expect(bar.getByRole("link", { name: "Search" })).toBeVisible();
    await expect(bar.getByRole("button", { name: "Display" })).toBeVisible();
    await expect(bar.getByRole("link", { name: "Sign in" })).toBeVisible();
    await expect(bar.getByRole("button", { name: "Menu" })).toBeHidden();
    // One row, nothing wider than the bar, no running clock.
    const box = (await bar.boundingBox())!;
    expect(box.height).toBeLessThan(64);
    expect(await bar.evaluate((el) => el.scrollWidth - el.clientWidth)).toBeLessThanOrEqual(0);
    await expect(bar).not.toContainText(/\d:\d\d:\d\d/);
    // The links do not overlap each other or the tools.
    const rects = await bar.locator(".nav-brand, .nav-links, .nav-tools").evaluateAll((els) => els.map((e) => { const r = e.getBoundingClientRect(); return [r.left, r.right]; }));
    for (let i = 1; i < rects.length; i++) expect(rects[i][0], "bar parts overlap").toBeGreaterThanOrEqual(rects[i - 1][1] - 1);
  });

  test("on a narrower screen the sections move into a menu", async ({ page }) => {
    await page.setViewportSize({ width: 900, height: 800 });
    await page.goto("/");
    const bar = page.locator("header.nav");
    await expect(bar.getByRole("navigation", { name: "Sections" })).toBeHidden();
    const burger = bar.getByRole("button", { name: "Menu" });
    await expect(burger).toBeVisible();
    expect((await bar.boundingBox())!.height).toBeLessThan(64);
    await burger.click();
    const sheet = page.locator("#nav-sheet");
    for (const s of SECTIONS) await expect(sheet.getByRole("link", { name: s, exact: true })).toBeVisible();
    await sheet.getByRole("link", { name: "Field guide", exact: true }).click();
    await expect(page).toHaveURL(/#guide$/);
    await expect(page.locator("#nav-sheet")).toHaveCount(0); // closes after choosing
  });

  test("on a phone the bar stays one row, fits, and the menu works", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/");
    const bar = page.locator("header.nav");
    expect((await bar.boundingBox())!.height).toBeLessThan(64);
    expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(0);
    await expect(bar.locator(".nav-brand")).toBeVisible();
    await expect(bar.getByRole("link", { name: "Search" })).toBeVisible();
    await expect(bar.getByRole("button", { name: "Display" })).toBeVisible();
    await bar.getByRole("button", { name: "Menu" }).click();
    await expect(page.locator("#nav-sheet").getByRole("link", { name: "Sign up" })).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.locator("#nav-sheet")).toHaveCount(0);
    // The menu button itself also fits inside the screen.
    const b = (await bar.getByRole("button", { name: "Menu" }).boundingBox())!;
    expect(b.x + b.width).toBeLessThanOrEqual(390);
  });

  test("the account menu holds account, admin and sign out, and closes on Escape or an outside click", async ({ browser }) => {
    const { ctx, page } = await asAdmin(browser); // signing in over and over would hit the sign-in rate limit
    await page.setViewportSize({ width: 1280, height: 800 });
    const bar = page.locator("header.nav");
    // Closed: none of the account links crowd the bar.
    await expect(bar.getByRole("link", { name: "Account" })).toHaveCount(0);
    await expect(bar.getByRole("button", { name: "Sign out" })).toHaveCount(0);
    const trigger = bar.getByRole("button", { name: "Your account menu" });
    await trigger.click();
    await expect(trigger).toHaveAttribute("aria-expanded", "true");
    const menu = page.locator("#account-menu");
    await expect(menu).toContainText(`Signed in as ${ADMIN.username}`);
    await expect(menu.getByRole("link", { name: "Account" })).toBeVisible();
    await expect(menu.getByRole("link", { name: "Admin" })).toBeVisible();
    await expect(menu.getByRole("button", { name: "Sign out" })).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(menu).toHaveCount(0);
    await trigger.click();
    await expect(menu).toBeVisible();
    await page.locator("h1").first().click({ position: { x: 5, y: 5 } });
    await expect(menu).toHaveCount(0);
    await trigger.click();
    await menu.getByRole("link", { name: "Admin" }).click();
    await expect(page).toHaveURL(/\/admin$/);
    await expect(page.locator("#account-menu")).toHaveCount(0); // closes when you navigate
    await ctx.close();
  });

  test("the first Tab offers a skip link that jumps to the content", async ({ page }) => {
    await page.goto("/login");
    await page.keyboard.press("Tab");
    const skip = page.getByRole("link", { name: "Skip to content" });
    await expect(skip).toBeFocused();
    await expect(skip).toBeVisible();
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(/#content$/);
  });

  test("the footer has real links, and back to top appears after scrolling", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto("/");
    const foot = page.locator("footer.site-foot");
    await expect(foot).toContainText("Content note");
    for (const n of ["Home", "All tapes", "Search", "Sources", "Source code", "Report a mistake"]) {
      await expect(foot.getByRole("link", { name: n, exact: true })).toBeVisible();
    }
    await expect(foot.getByRole("link", { name: "Source code" })).toHaveAttribute("href", /github\.com\/SpicyFalcon619\/mandela-catalogue$/);
    await expect(foot.getByRole("link", { name: "Source code" })).toHaveAttribute("rel", /noopener/);
    await expect(page.getByRole("button", { name: "Back to top" })).toHaveCount(0);
    await page.evaluate(() => { document.documentElement.style.scrollBehavior = "auto"; window.scrollTo(0, 2500); });
    const top = page.getByRole("button", { name: "Back to top" });
    await expect(top).toBeVisible();
    await top.click();
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(0);
    await expect(top).toHaveCount(0);
  });

  test("the hero keeps one main action and the spoiler toggle; effects live in Display", async ({ page }) => {
    await page.goto("/");
    const hero = page.locator(".hero");
    await expect(hero.getByRole("link", { name: "Open the tapes" })).toBeVisible();
    await expect(hero.getByRole("button", { name: /Spoiler guard/ })).toBeVisible();
    await expect(hero.getByRole("button", { name: /Effects/ })).toHaveCount(0);
    await page.getByRole("button", { name: "Display" }).click();
    await expect(page.getByRole("dialog", { name: "Display settings" })).toContainText("Effects");
  });
});

test.describe("favicon", () => {
  test("the page advertises an SVG, an ICO and an Apple touch icon, and each one is served", async ({ page, request }) => {
    await page.goto("/");
    const links = await page.locator("head link[rel~='icon'], head link[rel='apple-touch-icon']").evaluateAll((ls) =>
      ls.map((l) => ({ rel: (l as HTMLLinkElement).rel, href: (l as HTMLLinkElement).href, type: l.getAttribute("type") })),
    );
    const byType = (frag: string) => links.find((l) => l.href.includes(frag));
    const svg = byType("/icon.svg");
    const ico = byType("/favicon.ico");
    const apple = links.find((l) => l.rel === "apple-touch-icon");
    expect(svg, "svg icon link").toBeTruthy();
    expect(ico, "ico link").toBeTruthy();
    expect(apple, "apple touch icon link").toBeTruthy();
    for (const [name, l, type] of [["svg", svg!, "image/svg+xml"], ["ico", ico!, "image/"], ["apple", apple!, "image/png"]] as const) {
      const res = await request.get(l.href);
      expect(res.status(), `${name} status`).toBe(200);
      expect(res.headers()["content-type"], `${name} type`).toContain(type);
      expect((await res.body()).length, `${name} size`).toBeGreaterThan(100);
    }
    const svgText = await (await request.get(svg!.href)).text();
    expect(svgText).toContain("<svg");
    // The path browsers request by default also works.
    expect((await request.get("/favicon.ico")).status()).toBe(200);
    // No emoji or text glyph is used as the icon.
    expect(svgText).not.toMatch(/<text/);
  });
});
