/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";
import { api } from "./_generated/api";
import schema from "./schema";

const modules = import.meta.glob("./**/*.*s");
const A = "a".repeat(64);
const B = "b".repeat(64);
const DAY_MS = 86_400_000;
const iso = (d: number) => new Date(Date.now() + d * DAY_MS).toISOString().slice(0, 10);
const TIRES = { name: "Opony", emoji: "🛞", unit: "done", dailyTarget: 1, everyMonths: 6, firstDue: iso(30) } as const;
const CAR = { name: "Auto", emoji: "🚗", unit: "done", dailyTarget: 1, everyMonths: 12, firstDue: iso(10) } as const;
const PUSHUPS = { name: "Pompki", emoji: "💪", unit: "count", dailyTarget: 20 } as const;

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

describe("krąg osobisty", () => {
  it("ensurePersonal jest idempotentny, ukryty na liście, a kod nie wpuszcza obcych", async () => {
    const t = await setup();
    const one = await t.mutation(api.circles.ensurePersonal, { secret: A, name: "Moje sprawy" });
    const two = await t.mutation(api.circles.ensurePersonal, { secret: A, name: "Inna nazwa" });
    expect(two.id).toBe(one.id);
    expect(await t.query(api.circles.list, { secret: A })).toEqual([]);
    const code = await t.run(async (ctx) => (await ctx.db.get(one.id))!.inviteCode);
    expect(await codeOf(t.mutation(api.circles.join, { secret: B, code }))).toBe("CIRCLE_NOT_FOUND");
    expect(await codeOf(t.mutation(api.circles.ensurePersonal, { secret: B, name: " " }))).toBe("BAD_NAME");
  });

  it("today oznacza krąg osobisty", async () => {
    const t = await setup();
    const { id } = await t.mutation(api.circles.ensurePersonal, { secret: A, name: "Moje sprawy" });
    const v = await t.query(api.checkins.today, { secret: A, circleId: id, day: iso(0) });
    expect(v.circle.personal).toBe(true);
  });
});

describe("czynności w istniejącym kręgu", () => {
  it("addActivity tylko dla członka, waliduje, archiveActivity ukrywa", async () => {
    const t = await setup();
    const { id } = await t.mutation(api.circles.ensurePersonal, { secret: A, name: "Moje sprawy" });
    expect(await codeOf(t.mutation(api.circles.addActivity, { secret: B, circleId: id, activity: TIRES }))).toBe("NOT_A_MEMBER");
    expect(await codeOf(t.mutation(api.circles.addActivity, { secret: A, circleId: id, activity: { ...TIRES, everyMonths: 0 } }))).toBe("BAD_ACTIVITIES");
    const added = await t.mutation(api.circles.addActivity, { secret: A, circleId: id, activity: TIRES });
    let v = await t.query(api.checkins.today, { secret: A, circleId: id, day: iso(0) });
    expect(v.activities.map((a) => a.name)).toEqual(["Opony"]);
    expect(await codeOf(t.mutation(api.circles.archiveActivity, { secret: B, activityId: added.id }))).toBe("NOT_A_MEMBER");
    await t.mutation(api.circles.archiveActivity, { secret: A, activityId: added.id });
    v = await t.query(api.checkins.today, { secret: A, circleId: id, day: iso(0) });
    expect(v.activities).toEqual([]);
  });

  it("limit 12 aktywnych czynności", async () => {
    const t = await setup();
    const { id } = await t.mutation(api.circles.ensurePersonal, { secret: A, name: "Moje sprawy" });
    for (let i = 0; i < 12; i++) await t.mutation(api.circles.addActivity, { secret: A, circleId: id, activity: { ...PUSHUPS, name: `P${i}` } });
    expect(await codeOf(t.mutation(api.circles.addActivity, { secret: A, circleId: id, activity: PUSHUPS }))).toBe("BAD_ACTIVITIES");
  });
});

describe("dues.mine", () => {
  it("zbiera cykliczne z kręgu osobistego i wspólnego, posortowane, bez dziennych i zarchiwizowanych", async () => {
    const t = await setup();
    const personal = await t.mutation(api.circles.ensurePersonal, { secret: A, name: "Moje sprawy" });
    await t.mutation(api.circles.addActivity, { secret: A, circleId: personal.id, activity: TIRES });
    await t.mutation(api.circles.create, { secret: A, name: "Rodzina", activities: [CAR, PUSHUPS] });
    const list = await t.query(api.dues.mine, { secret: A });
    expect(list.map((d) => [d.name, d.circleName])).toEqual([["Auto", "Rodzina"], ["Opony", "Moje sprawy"]]);
    const [auto] = list;
    await t.mutation(api.checkins.add, { secret: A, activityId: auto.id, day: iso(0), value: 1 });
    const after = await t.query(api.dues.mine, { secret: A });
    expect(after.map((d) => d.name)).toEqual(["Opony", "Auto"]);
    expect(await t.query(api.dues.mine, { secret: B })).toEqual([]);
  });
});
