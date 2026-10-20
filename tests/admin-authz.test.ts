import { beforeEach, describe, expect, it } from "vitest";
import { deleteEntity, moderateComment, resetAllContent, saveEntity, saveSettings, updateUser } from "@/app/actions/admin";
import { sql } from "@/lib/db";
import { count, form, makeUser, redirectOf, resetRequest, signInAs } from "./helpers";

// Every admin action must check the role itself. Each case calls the action as a stranger and as a
// regular member, then asserts both the redirect and that nothing in the database changed.

const sourceForm = () => form({ id: "new", title: "Injected", url: "https://example.com", note: "" });

type Case = { name: string; run: () => Promise<unknown>; changed: () => Promise<unknown> };

function cases(targetUserId: number, commentId: number): Case[] {
  return [
    {
      name: "saveEntity (create)",
      run: () => saveEntity("sources", sourceForm()),
      changed: async () => await count("SELECT COUNT(*) AS n FROM sources"),
    },
    {
      name: "saveEntity (update)",
      run: () => saveEntity("sources", form({ id: "1", title: "Hacked", url: "https://example.com", note: "" })),
      changed: async () => await sql.get("SELECT title FROM sources WHERE id = 1"),
    },
    {
      name: "deleteEntity",
      run: () => deleteEntity("tapes", form({ id: "1" })),
      changed: async () => await count("SELECT COUNT(*) AS n FROM tapes"),
    },
    {
      name: "saveSettings",
      run: () => saveSettings(form({ site_title: "Defaced" })),
      changed: async () => await sql.all("SELECT key, value FROM settings ORDER BY key"),
    },
    {
      name: "moderateComment (delete)",
      run: () => moderateComment(form({ id: String(commentId), action: "delete", tape_id: "1" })),
      changed: async () => await count("SELECT COUNT(*) AS n FROM comments"),
    },
    {
      name: "moderateComment (approve)",
      run: () => moderateComment(form({ id: String(commentId), action: "approve", tape_id: "1" })),
      changed: async () => await sql.get("SELECT status FROM comments WHERE id = ?", commentId),
    },
    {
      name: "updateUser (make_admin)",
      run: () => updateUser(form({ id: String(targetUserId), action: "make_admin" })),
      changed: async () => await sql.get("SELECT role FROM users WHERE id = ?", targetUserId),
    },
    {
      name: "updateUser (delete)",
      run: () => updateUser(form({ id: String(targetUserId), action: "delete" })),
      changed: async () => await count("SELECT COUNT(*) AS n FROM users"),
    },
    {
      name: "resetAllContent",
      run: () => resetAllContent(form({ confirm: "RESET" })),
      changed: async () => await count("SELECT COUNT(*) AS n FROM comments"),
    },
  ];
}

describe("admin actions reject non-admins", () => {
  let victim: number;
  let comment: number;
  let member: number;

  beforeEach(async () => {
    resetRequest();
    victim = (await makeUser("user")).id;
    member = (await makeUser("user")).id;
    comment = (await sql.run("INSERT INTO comments (tape_id, user_id, kind, body, status) VALUES (1, ?, 'theory', 'pending theory', 'pending')", victim)).lastId;
  });

  it("covers every exported admin action", async () => {
    const mod = await import("@/app/actions/admin");
    const exported = Object.keys(mod).sort();
    const tested = ["deleteEntity", "moderateComment", "resetAllContent", "saveEntity", "saveSettings", "updateUser"];
    expect(exported).toEqual(tested);
  });

  for (const who of ["anonymous", "member"] as const) {
    it(`blocks ${who} callers and leaves the database untouched`, async () => {
      if (who === "member") await signInAs(member);
      const expectedRedirect = who === "anonymous" ? "/login?next=/admin" : "/";
      for (const c of cases(victim, comment)) {
        const before = JSON.stringify(await c.changed());
        const target = await redirectOf(c.run);
        expect(target, `${c.name} as ${who}`).toBe(expectedRedirect);
        expect(JSON.stringify(await c.changed()), `${c.name} as ${who} changed data`).toBe(before);
      }
    });
  }

  it("lets a signed-in admin through", async () => {
    await signInAs((await makeUser("admin")).id);
    const before = await count("SELECT COUNT(*) AS n FROM sources");
    expect(await redirectOf(() => saveEntity("sources", sourceForm()))).toBe("/admin/sources?saved=1");
    expect(await count("SELECT COUNT(*) AS n FROM sources")).toBe(before + 1);
  });

  it("stops treating someone as admin right after a demotion or ban", async () => {
    const admin = (await makeUser("admin")).id;
    await signInAs(admin);
    expect(await redirectOf(() => deleteEntity("sources", form({ id: "999999" })))).toBe("/admin/sources?deleted=1");

    await sql.run("UPDATE users SET role = 'user' WHERE id = ?", admin);
    expect(await redirectOf(() => deleteEntity("sources", form({ id: "999999" })))).toBe("/");

    await sql.run("UPDATE users SET role = 'admin', banned = 1 WHERE id = ?", admin);
    expect(await redirectOf(() => deleteEntity("sources", form({ id: "999999" })))).toBe("/login?next=/admin");
  });
});

describe("admin action behaviour", () => {
  beforeEach(resetRequest);

  it("does not let an admin change their own account", async () => {
    const me = (await makeUser("admin")).id;
    await signInAs(me);
    await updateUser(form({ id: String(me), action: "make_user" }));
    await updateUser(form({ id: String(me), action: "ban" }));
    await updateUser(form({ id: String(me), action: "delete" }));
    expect(await sql.get("SELECT role, banned FROM users WHERE id = ?", me)).toEqual({ role: "admin", banned: 0 });
  });

  it("requires RESET to be typed before wiping content", async () => {
    await signInAs((await makeUser("admin")).id);
    const tapes = await count("SELECT COUNT(*) AS n FROM tapes");
    expect(await redirectOf(() => resetAllContent(form({ confirm: "reset?" })))).toMatch(/^\/admin\?error=/);
    expect(await count("SELECT COUNT(*) AS n FROM tapes")).toBe(tapes);
  });

  it("rejects non-http source URLs", async () => {
    await signInAs((await makeUser("admin")).id);
    const before = await count("SELECT COUNT(*) AS n FROM sources");
    const target = await redirectOf(() => saveEntity("sources", form({ id: "new", title: "Bad", url: "javascript:alert(1)", note: "" })));
    expect(target).toMatch(/^\/admin\/sources\/new\?error=/);
    expect(await count("SELECT COUNT(*) AS n FROM sources")).toBe(before);
  });

  it("ignores unknown entity keys instead of building SQL from them", async () => {
    await signInAs((await makeUser("admin")).id);
    expect(await redirectOf(() => saveEntity("users; DROP TABLE tapes", form({ id: "new" })))).toBe("/admin");
    expect(await redirectOf(() => deleteEntity("users", form({ id: "1" })))).toBe("/admin");
  });
});
