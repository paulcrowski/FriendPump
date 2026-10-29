/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";
import { api } from "./_generated/api";
import schema from "./schema";

const modules = import.meta.glob("./**/*.*s");
const A = "a".repeat(64);
const B = "b".repeat(64);
const C = "c".repeat(64);
const NOW = new Date().toISOString().slice(0, 10);

async function setup() {
  const t = convexTest(schema, modules);
  for (const [secret, name] of [[A, "Ala"], [B, "Bob"], [C, "Cyd"]]) await t.mutation(api.users.register, { secret, name });
  const circle = await t.mutation(api.circles.create, {
    secret: A,
    name: "Treningi",
    activities: [{ name: "Pompki", emoji: "💪", unit: "count", dailyTarget: 20 }, { name: "Druty", emoji: "🧶", unit: "done", dailyTarget: 1 }],
  });
  await t.mutation(api.circles.join, { secret: B, code: circle.inviteCode });
  const [full] = await t.query(api.circles.list, { secret: A });
  return { t, circleId: circle.id, pushups: full.activities[0].id, knit: full.activities[1].id };
}

async function codeOf(promise: Promise<unknown>): Promise<unknown> {
  try {
    await promise;
  } catch (e) {
    return (e as { data?: { code?: string } }).data?.code;
  }
  return "NO_ERROR";
}

describe("checkins", () => {
  it("add sumuje, undoLast cofa ostatni wpis", async () => {
    const { t, pushups } = await setup();
    expect((await t.mutation(api.checkins.add, { secret: A, activityId: pushups, day: NOW, value: 10 })).total).toBe(10);
    expect((await t.mutation(api.checkins.add, { secret: A, activityId: pushups, day: NOW, value: 7 })).total).toBe(17);
    expect((await t.mutation(api.checkins.undoLast, { secret: A, activityId: pushups, day: NOW })).total).toBe(10);
  });

  it("widok dnia pokazuje sumy każdej osoby, ja pierwszy", async () => {
    const { t, circleId, pushups } = await setup();
    await t.mutation(api.checkins.add, { secret: A, activityId: pushups, day: NOW, value: 20 });
    await t.mutation(api.checkins.add, { secret: B, activityId: pushups, day: NOW, value: 12 });
    const asB = await t.query(api.checkins.today, { secret: B, circleId, day: NOW });
    expect(asB.members.map((m) => [m.name, m.isMe])).toEqual([["Bob", true], ["Ala", false]]);
    const totals = Object.fromEntries(asB.activities[0].totals.map((x) => [asB.members.find((m) => m.id === x.userId)!.name, x.total]));
    expect(totals).toEqual({ Bob: 12, Ala: 20 });
  });

  it("inny dzień ma osobne sumy", async () => {
    const { t, circleId, pushups } = await setup();
    await t.mutation(api.checkins.add, { secret: A, activityId: pushups, day: NOW, value: 5 });
    const other = new Date(Date.now() - 86_400_000).toISOString().slice(0, 10);
    const view = await t.query(api.checkins.today, { secret: A, circleId, day: other });
    expect(view.activities[0].totals.every((x) => x.total === 0)).toBe(true);
  });

  it("'zrobione' nie dubluje się", async () => {
    const { t, knit } = await setup();
    await t.mutation(api.checkins.add, { secret: A, activityId: knit, day: NOW, value: 1 });
    expect((await t.mutation(api.checkins.add, { secret: A, activityId: knit, day: NOW, value: 1 })).total).toBe(1);
  });

  it("obcy nie wpisuje ani nie czyta", async () => {
    const { t, circleId, pushups } = await setup();
    expect(await codeOf(t.mutation(api.checkins.add, { secret: C, activityId: pushups, day: NOW, value: 5 }))).toBe("NOT_A_MEMBER");
    expect(await codeOf(t.query(api.checkins.today, { secret: C, circleId, day: NOW }))).toBe("NOT_A_MEMBER");
    expect(await codeOf(t.mutation(api.checkins.undoLast, { secret: C, activityId: pushups, day: NOW }))).toBe("NOT_A_MEMBER");
  });

  it("złe dane to jasne błędy", async () => {
    const { t, pushups } = await setup();
    const add = (day: string, value: number) => codeOf(t.mutation(api.checkins.add, { secret: A, activityId: pushups, day, value }));
    expect(await add(NOW, 0)).toBe("BAD_VALUE");
    expect(await add(NOW, 1.5)).toBe("BAD_VALUE");
    expect(await add(NOW, 1001)).toBe("BAD_VALUE");
    expect(await add("2026-13-40", 5)).toBe("BAD_DAY");
    expect(await add("dziś", 5)).toBe("BAD_DAY");
    expect(await add("2020-01-01", 5)).toBe("BAD_DAY");
    expect(await codeOf(t.mutation(api.checkins.undoLast, { secret: A, activityId: pushups, day: NOW }))).toBe("NOTHING_TO_UNDO");
  });
});
