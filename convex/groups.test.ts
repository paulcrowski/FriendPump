/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";
import { api } from "./_generated/api";
import { periodKey } from "./groups";
import schema from "./schema";

const modules = import.meta.glob("./**/*.*s");
const A = "a".repeat(64);
const B = "b".repeat(64);
const TODAY = new Date().toISOString().slice(0, 10);

async function setup() {
  const t = convexTest(schema, modules);
  await t.mutation(api.users.register, { secret: A, name: "Ala" });
  await t.mutation(api.users.register, { secret: B, name: "Bob" });
  return t;
}

async function codeOf(promise: Promise<unknown>): Promise<unknown> {
  try {
    await promise;
  } catch (e) {
    return (e as { data?: { code?: string } }).data?.code;
  }
  return "NO_ERROR";
}

type T = Awaited<ReturnType<typeof setup>>;
const row = async (t: T, secret: string, key: string) => (await t.query(api.groups.list, { secret, today: TODAY })).find((g) => g.key === key)!;
const join = (t: T, secret: string, key: string) => t.mutation(api.groups.join, { secret, key, today: TODAY });

describe("periodKey", () => {
  it("grupa półroczna dzieli rok na dwa okresy, roczna na jeden", () => {
    expect(periodKey("2026-03-10", 6)).toBe("2026-0");
    expect(periodKey("2026-09-10", 6)).toBe("2026-1");
    expect(periodKey("2026-01-01", 12)).toBe("2026-0");
    expect(periodKey("2026-12-31", 12)).toBe("2026-0");
  });
});

describe("grupy otwarte jako kręgi", () => {
  it("list pokazuje cały katalog z zerami", async () => {
    const t = await setup();
    const all = await t.query(api.groups.list, { secret: A, today: TODAY });
    expect(all.map((g) => g.key).sort()).toEqual(["blood", "boiler", "car", "dentist", "smoke", "tires"]);
    expect(all.every((g) => g.members === 0 && g.doneThisPeriod === 0 && !g.joined)).toBe(true);
  });

  it("join jest idempotentne, liczniki liczą różnych ludzi, leave odejmuje", async () => {
    const t = await setup();
    await join(t, A, "tires");
    await join(t, A, "tires");
    await join(t, B, "tires");
    expect((await row(t, A, "tires")).members).toBe(2);
    await t.mutation(api.groups.leave, { secret: B, key: "tires" });
    await t.mutation(api.groups.leave, { secret: B, key: "tires" });
    const g = await row(t, A, "tires");
    expect([g.members, g.joined]).toEqual([1, true]);
    expect((await row(t, B, "tires")).joined).toBe(false);
  });

  it("dołączenie daje termin do końca okresu i trafia do dues.mine; wyjście je usuwa", async () => {
    const t = await setup();
    await join(t, A, "blood");
    const due = await t.query(api.dues.mine, { secret: A });
    expect(due).toHaveLength(1);
    expect(due[0].openKey).toBe("blood");
    expect(due[0].nextDue >= TODAY).toBe(true);
    expect(due[0].nextDue.slice(0, 4)).toBe(TODAY.slice(0, 4)); // roczna grupa: koniec bieżącego roku
    await t.mutation(api.groups.leave, { secret: A, key: "blood" });
    expect(await t.query(api.dues.mine, { secret: A })).toEqual([]);
  });

  it("markDone liczy raz na okres, przesuwa termin i ustawia doneByMe", async () => {
    const t = await setup();
    await join(t, A, "blood");
    const first = await t.mutation(api.groups.markDone, { secret: A, key: "blood", day: TODAY });
    const second = await t.mutation(api.groups.markDone, { secret: A, key: "blood", day: TODAY });
    expect([first.counted, second.counted]).toEqual([true, false]);
    const g = await row(t, A, "blood");
    expect([g.doneThisPeriod, g.doneByMe]).toEqual([1, true]);
    const [due] = await t.query(api.dues.mine, { secret: A });
    expect(due.nextDue > TODAY).toBe(true);
  });

  it("krąg otwarty jest ukryty na liście kręgów i niedostępny przez kod, today, week i addActivity", async () => {
    const t = await setup();
    await join(t, A, "car");
    expect(await t.query(api.circles.list, { secret: A })).toEqual([]);
    const { circleId, activityId, code } = await t.run(async (ctx) => {
      const c = (await ctx.db.query("circles").withIndex("by_openKey", (q) => q.eq("openKey", "car")).unique())!;
      const a = (await ctx.db.query("activities").withIndex("by_circle", (q) => q.eq("circleId", c._id)).first())!;
      return { circleId: c._id, activityId: a._id, code: c.inviteCode };
    });
    expect(await codeOf(t.mutation(api.circles.join, { secret: B, code }))).toBe("BAD_CODE");
    expect(await codeOf(t.query(api.checkins.today, { secret: A, circleId, day: TODAY }))).toBe("CIRCLE_NOT_FOUND");
    expect(await codeOf(t.query(api.checkins.week, { secret: A, circleId, endDay: TODAY }))).toBe("CIRCLE_NOT_FOUND");
    expect(await codeOf(t.mutation(api.circles.addActivity, { secret: A, circleId, activity: { name: "X", emoji: "x", unit: "count", dailyTarget: 5 } }))).toBe("NOT_A_MEMBER");
    expect(await codeOf(t.mutation(api.circles.archiveActivity, { secret: A, activityId }))).toBe("NOT_A_MEMBER");
  });

  it("liczniki sumują wiele shardów", async () => {
    const t = await setup();
    await t.run(async (ctx) => {
      for (let shard = 0; shard < 5; shard++) await ctx.db.insert("groupCounters", { groupKey: "car", kind: "members", shard, n: 100 + shard });
    });
    expect((await row(t, A, "car")).members).toBe(510);
  });

  it("markDone bez członkostwa to NOT_A_MEMBER, zły klucz BAD_GROUP, zły dzień BAD_DAY", async () => {
    const t = await setup();
    expect(await codeOf(t.mutation(api.groups.markDone, { secret: A, key: "car", day: TODAY }))).toBe("NOT_A_MEMBER");
    expect(await codeOf(join(t, A, "nope"))).toBe("BAD_GROUP");
    await join(t, A, "car");
    expect(await codeOf(t.mutation(api.groups.markDone, { secret: A, key: "car", day: "2020-01-01" }))).toBe("BAD_DAY");
    expect(await codeOf(t.query(api.groups.list, { secret: "c".repeat(64), today: TODAY }))).toBe("NOT_REGISTERED");
  });
});
