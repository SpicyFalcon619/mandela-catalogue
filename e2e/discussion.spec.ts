import { expect, test, type Browser, type BrowserContext, type Locator, type Page } from "@playwright/test";

const ADMIN = { username: "e2eadmin", password: "e2e-admin-password" };
const PASSWORD = "reader-password-123";
const run = Date.now().toString(36).slice(-5);
let seq = 0;
const uniq = (tag: string) => `${tag}${run}${++seq}`;

// Each simulated visitor sends its own client address, like real people on different connections, so the
// per-address sign-up limit (5 an hour) does not stop a suite that needs several accounts.
let ipSeq = 0;
const fakeIp = () => `10.77.${Math.floor(++ipSeq / 250)}.${(ipSeq % 250) + 1}`;

type Visitor = { ctx: BrowserContext; page: Page; username: string };

async function visitor(browser: Browser, tag: string): Promise<Visitor> {
  const ctx = await browser.newContext({ extraHTTPHeaders: { "x-forwarded-for": fakeIp() }, viewport: { width: 1280, height: 900 } });
  const page = await ctx.newPage();
  const username = `d_${tag}_${run}`.slice(0, 24);
  await page.goto("/register");
  await page.locator('input[name="username"]').fill(username);
  await page.locator('input[name="password"]').fill(PASSWORD);
  await page.locator('input[name="confirm"]').fill(PASSWORD);
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page.locator(".who")).toHaveText(username);
  return { ctx, page, username };
}

async function guest(browser: Browser) {
  const ctx = await browser.newContext({ extraHTTPHeaders: { "x-forwarded-for": fakeIp() }, viewport: { width: 1280, height: 900 } });
  return { ctx, page: await ctx.newPage() };
}

let adminState: Awaited<ReturnType<BrowserContext["storageState"]>>;
test.beforeAll(async ({ browser }) => {
  const ctx = await browser.newContext({ baseURL: "http://127.0.0.1:3100", extraHTTPHeaders: { "x-forwarded-for": fakeIp() } });
  const page = await ctx.newPage();
  await page.goto("/login");
  await page.locator('input[name="username"]').fill(ADMIN.username);
  await page.locator('input[name="password"]').fill(ADMIN.password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.locator(".who")).toHaveText(ADMIN.username);
  adminState = await ctx.storageState();
  await ctx.close();
});
async function asAdmin(browser: Browser) {
  const ctx = await browser.newContext({ storageState: adminState, extraHTTPHeaders: { "x-forwarded-for": fakeIp() } });
  return { ctx, page: await ctx.newPage() };
}

/** The list item for the comment whose own text contains `text` (not the items nested below it). */
const item = (page: Page, text: string): Locator =>
  page.locator("li.cmt").filter({ has: page.locator(`xpath=./div[contains(@class,'cmt-main')]/p[contains(@class,'cmt-body') and contains(normalize-space(.), '${text}')]`) });
const score = (li: Locator) => li.locator(".cmt-vote").first().locator(".cmt-score");
const up = (li: Locator) => li.getByRole("button", { name: "Upvote" }).first();
const down = (li: Locator) => li.getByRole("button", { name: "Downvote" }).first();

async function compose(page: Page, text: string, opts: { kind?: string; spoiler?: boolean } = {}) {
  if (opts.kind) await page.getByLabel("Post type").selectOption(opts.kind);
  await page.getByLabel("Your post").fill(text);
  if (opts.spoiler) await page.getByLabel("Contains spoilers").first().check();
  await page.getByRole("button", { name: "Post", exact: true }).click();
  await expect(page.locator(".cmt-compose .okmsg")).toBeVisible();
}

test.describe("discussion", () => {
  test("guests can read but are asked to sign in to post and vote", async ({ browser }) => {
    const author = await visitor(browser, "g1");
    const text = uniq("guestread");
    await author.page.goto("/tapes/5");
    await compose(author.page, text);
    const g = await guest(browser);
    await g.page.goto("/tapes/5");
    await expect(item(g.page, text)).toBeVisible();
    await expect(g.page.getByRole("link", { name: "Sign in" }).last()).toBeVisible();
    await expect(g.page.getByLabel("Your post")).toHaveCount(0);
    await expect(up(item(g.page, text))).toBeDisabled();
    await expect(down(item(g.page, text))).toBeDisabled();
    await author.ctx.close();
    await g.ctx.close();
  });

  test("replies nest under their parent, and votes count once per person and persist", async ({ browser }) => {
    const a = await visitor(browser, "a1");
    const b = await visitor(browser, "b1");
    const top = uniq("toplevel");
    const reply = uniq("replytext");
    await a.page.goto("/tapes/5");
    await compose(a.page, top);

    await b.page.goto("/tapes/5");
    const li = item(b.page, top);
    await li.getByRole("button", { name: "Reply", exact: true }).first().click();
    await li.locator(".cmt-reply").getByLabel(/Reply to/).fill(reply);
    await li.locator(".cmt-reply").getByRole("button", { name: "Reply", exact: true }).click();
    await expect(li.locator(".cmt-children .cmt-body", { hasText: reply })).toBeVisible();

    // Voting: up, same arrow again takes it back, down, and it survives a reload.
    await up(li).click();
    await expect(score(li)).toHaveText("1");
    await expect(up(li)).toHaveAttribute("aria-pressed", "true");
    await up(li).click();
    await expect(score(li)).toHaveText("0");
    await down(li).click();
    await expect(score(li)).toHaveText("-1");
    await up(li).click();
    await expect(score(li)).toHaveText("1");
    await b.page.reload();
    await expect(score(item(b.page, top))).toHaveText("1");
    await expect(up(item(b.page, top))).toHaveAttribute("aria-pressed", "true");

    // You cannot vote on your own comment.
    await expect(up(item(b.page, reply))).toBeDisabled();

    // The author sees the vote and the reply too.
    await a.page.reload();
    await expect(score(item(a.page, top))).toHaveText("1");
    await expect(item(a.page, top).locator(".cmt-children .cmt-body", { hasText: reply })).toBeVisible();
    await a.ctx.close();
    await b.ctx.close();
  });

  test("sorting, tabs and searching the discussion", async ({ browser }) => {
    const a = await visitor(browser, "a2");
    const b = await visitor(browser, "b2");
    const first = uniq("firstcomment");
    const second = uniq("secondcomment");
    const theory = uniq("theorytext");
    await a.page.goto("/tapes/6");
    await compose(a.page, first);
    await compose(a.page, second);

    await b.page.goto("/tapes/6");
    await up(item(b.page, first)).click();
    await expect(score(item(b.page, first))).toHaveText("1");
    const order = async () => b.page.locator("ul.cmt-list > li.cmt > .cmt-main > .cmt-body").allTextContents();
    const idx = async (text: string) => (await order()).findIndex((t) => t.includes(text));

    // Best puts the voted comment first even though it is older.
    expect(await idx(first)).toBeLessThan(await idx(second));
    await b.page.getByLabel("Sort").selectOption("new");
    expect(await idx(second)).toBeLessThan(await idx(first));
    await b.page.getByLabel("Sort").selectOption("old");
    expect(await idx(first)).toBeLessThan(await idx(second));

    // Search narrows the thread, highlights the match, and clears.
    await b.page.getByPlaceholder("Search this discussion").fill(second);
    await expect(item(b.page, second)).toBeVisible();
    await expect(item(b.page, first)).toHaveCount(0);
    await expect(b.page.locator(".cmt-body mark")).toHaveText(second);
    await expect(b.page.locator(".cmt-results")).toContainText("1 match");
    await b.page.getByPlaceholder("Search this discussion").fill("zzzznothingzzzz");
    await expect(b.page.locator(".cmt-results")).toContainText("No posts match");
    await b.page.getByRole("button", { name: "Clear search" }).click();
    await expect(item(b.page, first)).toBeVisible();

    // Tabs: a theory waits for review, so only its author sees it, under Theories.
    await a.page.reload();
    await compose(a.page, theory, { kind: "theory" });
    await expect(a.page.locator(".cmt-compose .okmsg")).toContainText("review");
    await a.page.getByRole("button", { name: /^Theories/ }).click();
    await expect(item(a.page, theory)).toBeVisible();
    await expect(item(a.page, first)).toHaveCount(0);
    await expect(item(a.page, theory).getByText("awaiting review")).toBeVisible();
    await a.ctx.close();
    await b.ctx.close();
  });

  test("editing, deleting with replies, and permalinks", async ({ browser }) => {
    const a = await visitor(browser, "a3");
    const b = await visitor(browser, "b3");
    const original = uniq("beforeedit");
    const edited = uniq("afteredit");
    const reply = uniq("theanswer");
    await a.page.goto("/tapes/7");
    await compose(a.page, original);

    // Edit. The comment is held by its id because its text becomes a text box while it is being edited.
    const id = (await item(a.page, original).getAttribute("id"))!;
    const li = a.page.locator(`#${id}`);
    await li.getByRole("button", { name: "Edit", exact: true }).click();
    await li.getByLabel("Edit your post").fill(edited);
    await li.getByRole("button", { name: "Save" }).click();
    await expect(item(a.page, edited)).toBeVisible();
    await expect(item(a.page, edited).getByText("edited", { exact: true })).toBeVisible();
    await a.page.reload();
    await expect(item(a.page, edited).getByText("edited", { exact: true })).toBeVisible();
    await expect(item(a.page, original)).toHaveCount(0);

    // Someone replies; deleting the parent leaves a placeholder and keeps the reply.
    await b.page.goto("/tapes/7");
    const bl = item(b.page, edited);
    await bl.getByRole("button", { name: "Reply", exact: true }).first().click();
    await bl.locator(".cmt-reply").getByLabel(/Reply to/).fill(reply);
    await bl.locator(".cmt-reply").getByRole("button", { name: "Reply", exact: true }).click();
    await expect(item(b.page, reply)).toBeVisible();

    await a.page.reload();
    const al = item(a.page, edited);
    await al.getByRole("button", { name: "Delete", exact: true }).first().click();
    await expect(al.getByText(/replies stay/)).toBeVisible();
    await al.getByRole("button", { name: "Yes, delete" }).click();
    await expect(a.page.locator("li.cmt.gone .cmt-body.removed")).toHaveText("This comment was removed.");
    await expect(item(a.page, reply)).toBeVisible();
    await expect(item(a.page, edited)).toHaveCount(0);

    // Permalink to the reply scrolls to it and flashes it.
    const replyId = await item(a.page, reply).getAttribute("id");
    await a.page.goto(`/tapes/7#${replyId}`);
    await expect(a.page.locator(`#${replyId}.flash`)).toHaveCount(1);
    expect(id).toMatch(/^c\d+$/);
    await a.ctx.close();
    await b.ctx.close();
  });

  test("reporting sends a comment to moderators, who can dismiss or restore", async ({ browser }) => {
    const author = await visitor(browser, "a4");
    const text = uniq("reportedone");
    await author.page.goto("/tapes/8");
    await compose(author.page, text);

    // Three different people report it, which hides it.
    const reporters: Visitor[] = [];
    for (const t of ["r1", "r2", "r3"]) reporters.push(await visitor(browser, t));
    for (const [i, r] of reporters.entries()) {
      await r.page.goto("/tapes/8");
      const li = item(r.page, text);
      await li.getByRole("button", { name: /Report/ }).first().click();
      await li.getByLabel("Why are you reporting this?").selectOption("spam");
      await li.getByRole("button", { name: "Send report" }).click();
      await expect(r.page.locator(".cmt-toast")).toContainText("moderator");
      if (i === 2) await expect(item(r.page, text)).toHaveCount(0); // hidden for the third
    }
    await author.page.reload();
    await expect(item(author.page, text)).toHaveCount(0);

    // An admin sees it in the queue and restores it.
    const admin = await asAdmin(browser);
    await admin.page.goto("/admin/moderation");
    const row = admin.page.locator(".cm", { hasText: text });
    await expect(row).toContainText("3 reports");
    await expect(row.locator(".pill").first()).toHaveText("hidden");
    await row.getByRole("button", { name: "Restore and dismiss" }).click();
    await expect(admin.page.locator(".cm", { hasText: text }).locator(".pill").first()).toHaveText("visible");
    await expect(admin.page.getByRole("heading", { name: /Reported \(/ })).toBeVisible();

    await author.page.reload();
    await expect(item(author.page, text)).toBeVisible();
    for (const r of reporters) await r.ctx.close();
    await author.ctx.close();
    await admin.ctx.close();
  });

  test("an admin can pin a comment to the top", async ({ browser }) => {
    const a = await visitor(browser, "a5");
    const older = uniq("pinme");
    const newer = uniq("notpinned");
    await a.page.goto("/tapes/9");
    await compose(a.page, older);
    await compose(a.page, newer);
    const admin = await asAdmin(browser);
    await admin.page.goto("/tapes/9");
    await admin.page.getByLabel("Sort").selectOption("new");
    await item(admin.page, older).getByRole("button", { name: "Pin", exact: true }).click();
    await expect(item(admin.page, older).getByText("Pinned", { exact: true })).toBeVisible();
    const first = await admin.page.locator("ul.cmt-list > li.cmt > .cmt-main > .cmt-body").first().textContent();
    expect(first).toContain(older);
    // Everyone sees it pinned after a reload, and members have no Pin button.
    await a.page.reload();
    await expect(item(a.page, older).getByText("Pinned", { exact: true })).toBeVisible();
    await expect(item(a.page, older).getByRole("button", { name: "Pin", exact: true })).toHaveCount(0);
    await a.ctx.close();
    await admin.ctx.close();
  });

  test("a spoiler comment stays hidden until clicked", async ({ browser }) => {
    const a = await visitor(browser, "a6");
    const b = await visitor(browser, "b6");
    const text = uniq("spoilerline");
    await a.page.goto("/tapes/10");
    await compose(a.page, text, { spoiler: true });
    await b.page.goto("/tapes/10");
    await expect(b.page.locator(".cmt-spoiler")).toBeVisible();
    await expect(b.page.getByText(text)).toHaveCount(0);
    await b.page.locator(".cmt-spoiler").first().click();
    await expect(b.page.getByText(text)).toBeVisible();
    // The author is never made to click through their own spoiler.
    await expect(item(a.page, text)).toBeVisible();
    await a.ctx.close();
    await b.ctx.close();
  });

  test("replies to you show up in the top bar and on the account page", async ({ browser }) => {
    const a = await visitor(browser, "a7");
    const b = await visitor(browser, "b7");
    const mine = uniq("answerme");
    const answer = uniq("heresmyanswer");
    await a.page.goto("/tapes/11");
    await compose(a.page, mine);
    await b.page.goto("/tapes/11");
    const li = item(b.page, mine);
    await li.getByRole("button", { name: "Reply", exact: true }).first().click();
    await li.locator(".cmt-reply").getByLabel(/Reply to/).fill(answer);
    await li.locator(".cmt-reply").getByRole("button", { name: "Reply", exact: true }).click();
    await expect(item(b.page, answer)).toBeVisible();

    await a.page.goto("/");
    await expect(a.page.locator(".badge-n")).toHaveText("1");
    await a.page.getByRole("link", { name: /Account/ }).click();
    await expect(a.page.getByRole("heading", { name: /Replies to you \(1 new\)/ })).toBeVisible();
    await expect(a.page.locator(".cm.reply.new")).toContainText(answer);
    await a.page.getByRole("link", { name: "tape" }).first().isVisible().catch(() => {});
    await a.page.getByRole("button", { name: "Mark all as read" }).click();
    await expect(a.page.getByRole("heading", { name: /^Replies to you$/ })).toBeVisible();
    await a.page.goto("/");
    await expect(a.page.locator(".badge-n")).toHaveCount(0);
    await a.ctx.close();
    await b.ctx.close();
  });

  test("comment counts show on the home page player", async ({ browser }) => {
    const a = await visitor(browser, "a8");
    await a.page.goto("/tapes/12");
    await compose(a.page, uniq("counted"));
    await a.page.goto("/");
    await a.page.locator(".tapewrap", { hasText: "PRESTO" }).locator("button.tape").click();
    await expect(a.page.locator("#now").getByRole("link", { name: /Open this tape's page.*\(\d+\)/ })).toBeVisible();
    await a.ctx.close();
  });

  test("phone width: no sideways scroll with a deep thread", async ({ browser }) => {
    const a = await visitor(browser, "a9");
    await a.page.goto("/tapes/13");
    await compose(a.page, uniq("narrowroot"));
    await a.page.setViewportSize({ width: 390, height: 844 });
    await a.page.reload();
    const overflow = await a.page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow).toBeLessThanOrEqual(0);
    await a.ctx.close();
  });
});

test.describe("site search", () => {
  test("finds tapes, case files and the guide from the top bar", async ({ browser }) => {
    const g = await guest(browser);
    await g.page.goto("/");
    await g.page.getByRole("link", { name: "Search" }).click();
    await expect(g.page).toHaveURL(/\/search$/);
    await g.page.getByPlaceholder(/Search for a name/).fill("Gabriel");
    await g.page.getByRole("button", { name: "Search", exact: true }).click();
    await expect(g.page).toHaveURL(/q=Gabriel/);
    await expect(g.page.getByRole("status").filter({ hasText: /results? for/ })).toBeVisible();
    await expect(g.page.getByRole("heading", { name: /^Tapes/ })).toBeVisible();
    await expect(g.page.getByRole("heading", { name: /^Field guide/ })).toBeVisible();
    await expect(g.page.locator(".hit a").first()).toBeVisible();
    await expect(g.page.locator(".snip mark").first()).toContainText(/gabriel/i);
    // A result opens the right tape.
    await g.page.locator(".search-group", { has: g.page.getByRole("heading", { name: /^Tapes/ }) }).locator(".hit a").first().click();
    await expect(g.page).toHaveURL(/\/tapes\/\d+$/);
    await g.ctx.close();
  });

  test("handles empty, short, odd and unmatched queries without breaking", async ({ browser }) => {
    const g = await guest(browser);
    await g.page.goto("/search");
    await expect(g.page.getByRole("link", { name: "Gabriel" }).first()).toBeVisible(); // suggestions
    await g.page.goto("/search?q=a");
    await expect(g.page.locator("p.err")).toContainText("at least 2");
    await g.page.goto("/search?q=" + encodeURIComponent("%%"));
    await expect(g.page.getByRole("status").filter({ hasText: /Nothing found/ })).toBeVisible();
    await g.page.goto("/search?q=" + encodeURIComponent("<script>alert(1)</script>"));
    await expect(g.page.getByRole("status").filter({ hasText: /Nothing found/ })).toBeVisible();
    await g.page.goto("/search?q=zzzzzqqqqq");
    await expect(g.page.getByRole("status").filter({ hasText: /Nothing found/ })).toBeVisible();
    await g.ctx.close();
  });

  test("finds a comment by its words", async ({ browser }) => {
    const a = await visitor(browser, "s1");
    const word = uniq("zephyrquartz");
    await a.page.goto("/tapes/14");
    await compose(a.page, `Searchable remark ${word} about this tape`);
    await a.page.goto("/search?q=" + word);
    const group = a.page.locator(".search-group", { has: a.page.getByRole("heading", { name: /^Discussion/ }) });
    await expect(group.locator(".hit")).toHaveCount(1);
    await group.locator(".hit a").click();
    await expect(a.page).toHaveURL(/\/tapes\/14#c\d+$/);
    await expect(a.page.locator("li.cmt.flash")).toHaveCount(1);
    await a.ctx.close();
  });
});
