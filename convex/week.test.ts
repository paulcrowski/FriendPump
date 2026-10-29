/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";
import { api } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import schema from "./schema";

const modules = import.meta.glob("./**/*.*s");
const A = "a".repeat(64);
const B = "b".repeat(64);
const C = "c".repeat(64);
const END = "2026-10-29";

async function setup() {
  const t = convexTest(schema, modules);
  for (const [s, n] of [[A, "Ala"], [B, "Bob"], [C, "Cyd"]]) await t.mutation(api.users.register, { secret: s, name: n });
  const circle = await t.mutation(api.circles.create, {
    secret: A,
    name: "Treningi",
    activities: [{ name: "Pompki", emoji: "💪", unit: "count", dailyTarget: 20 }, { name: "Druty", emoji: "🧶", unit: "done", dailyTarget: 1 }],
  });
  await t.mutation(api.circles.join, { secret: B, code: circle.inviteCode });
  const [full] = await t.query(api.circles.list, { secret: A });
  const [pushups, knit] = full.activities.map((a) => a.id);
  const put = (who: string, activityId: Id<"activities">, day: string, value: number) =>
    t.run(async (ctx) => {
      const u = await ctx.db.query("users").collect();
      const user = u.find((x) => x.name === who)!;
      await ctx.db.insert("checkins", { activityId, circleId: circle.id as Id<"circles">, userId: user._id, day, value, createdAt: 1 });
    });
  return { t, circleId: circle.id, pushups, knit, put };
}

const day = (n: number) => new Date(Date.parse(END + "T00:00:00Z") - n * 86_400_000).toISOString().slice(0, 10);

describe("checkins.week", () => {
  it("dzień jest kompletny, gdy wszystkie czynności osiągnęły cel; widać 7 dni", async () => {
    const { t, circleId, pushups, knit, put } = await setup();
    await put("Ala", pushups, day(1), 20);
    await put("Ala", knit, day(1), 1);
    await put("Ala", pushups, day(2), 25); // tylko pompki - dzień niekompletny
    const w = await t.query(api.checkins.week, { secret: A, circleId, endDay: END });
    expect(w.days).toHaveLength(7);
    expect(w.days[6]).toBe(END);
    const ala = w.members.find((m) => m.name === "Ala")!;
    expect(ala.isMe).toBe(true);
    expect(ala.days[5]).toEqual({ done: 2, of: 2 });
    expect(ala.days[4]).toEqual({ done: 1, of: 2 });
    expect(ala.days[6]).toEqual({ done: 0, of: 2 });
  });

  it("seria liczy kolejne kompletne dni i nie karze za dzisiejszy niedokończony", async () => {
    const { t, circleId, pushups, knit, put } = await setup();
    for (const n of [1, 2, 3]) { await put("Ala", pushups, day(n), 20); await put("Ala", knit, day(n), 1); }
    await put("Ala", pushups, day(5), 20); await put("Ala", knit, day(5), 1); // przerwa w dniu 4
    let w = await t.query(api.checkins.week, { secret: A, circleId, endDay: END });
    expect(w.members.find((m) => m.name === "Ala")!.streak).toBe(3);
    await put("Ala", pushups, day(0), 20); await put("Ala", knit, day(0), 1); // dziś kompletny
    w = await t.query(api.checkins.week, { secret: A, circleId, endDay: END });
    expect(w.members.find((m) => m.name === "Ala")!.streak).toBe(4);
    expect(w.members.find((m) => m.name === "Bob")!.streak).toBe(0);
  });

  it("sumy tygodnia na czynność i osobę; wpisy sprzed 7 dni nie wchodzą", async () => {
    const { t, circleId, pushups, put } = await setup();
    await put("Bob", pushups, day(0), 10);
    await put("Bob", pushups, day(3), 15);
    await put("Bob", pushups, day(8), 100);
    const w = await t.query(api.checkins.week, { secret: B, circleId, endDay: END });
    const bob = w.members.find((m) => m.name === "Bob")!;
    expect(bob.totals.find((x) => x.activityId === pushups)!.total).toBe(25);
    expect(w.members[0].name).toBe("Bob");
  });

  it("obcy dostaje NOT_A_MEMBER, zły dzień BAD_DAY", async () => {
    const { t, circleId } = await setup();
    const code = async (p: Promise<unknown>) => { try { await p; } catch (e) { return (e as { data?: { code?: string } }).data?.code; } return "NO_ERROR"; };
    expect(await code(t.query(api.checkins.week, { secret: C, circleId, endDay: END }))).toBe("NOT_A_MEMBER");
    expect(await code(t.query(api.checkins.week, { secret: A, circleId, endDay: "wczoraj" }))).toBe("BAD_DAY");
  });
});
