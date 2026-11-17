import { describe, expect, it } from "vitest";
import { AUTOSAVE_INTERVAL_MS, createCloudSaver } from "./autosave";

describe("book autosave", () => {
  it("saves a change to the account", async () => {
    const saved: string[] = [];
    const s = createCloudSaver(async (j) => {
      saved.push(j);
    });
    expect(await s.save('{"a":1}')).toBe(true);
    expect(saved).toEqual(['{"a":1}']);
    expect(s.isDirty('{"a":1}')).toBe(false);
  });

  it("keeps the newest version when several changes queue up", async () => {
    const saved: string[] = [];
    const s = createCloudSaver(async (j) => {
      await new Promise((r) => setTimeout(r, 5));
      saved.push(j);
    });
    s.save("1");
    s.save("2");
    await s.save("3");
    expect(saved.at(-1)).toBe("3");
    expect(saved).not.toContain("2");
  });

  it("does not resend content that is already saved", async () => {
    let calls = 0;
    const s = createCloudSaver(async () => {
      calls++;
    });
    s.markSynced("x");
    await s.save("x");
    expect(calls).toBe(0);
  });

  it("stays unsaved after a failed save so it is retried", async () => {
    let fail = true;
    const s = createCloudSaver(async () => {
      if (fail) throw new Error("offline");
    });
    expect(await s.save("v")).toBe(false);
    expect(s.isDirty("v")).toBe(true);
    fail = false;
    expect(await s.save("v")).toBe(true);
    expect(s.isDirty("v")).toBe(false);
  });

  it("checks for unsaved changes every few seconds", () => {
    expect(AUTOSAVE_INTERVAL_MS).toBeLessThanOrEqual(5000);
  });
});
