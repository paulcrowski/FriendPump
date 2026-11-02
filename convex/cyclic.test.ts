/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";
import { api } from "./_generated/api";
import { addMonths } from "./dates";
import schema from "./schema";

const modules = import.meta.glob("./**/*.*s");
const A = "a".repeat(64);
const B = "b".repeat(64);
const DAY_MS = 86_400_000;
const iso = (offsetDays: number) => new Date(Date.now() + offsetDays * DAY_MS).toISOString().slice(0, 10);
const TODAY = iso(0);
const FIRST_DUE = iso(30);

const DAILY = { name: "Pompki", emoji: "💪", unit: "count", dailyTarget: 20 } as const;
const TIRES = { name: "Opony", emoji: "🛞", unit: "done", dailyTarget: 1, everyMonths: 6, firstDue: FIRST_DUE } as const;

async function setup() {
  const t = convexTest(schema, modules);
  await t.mutation(api.users.register, { secret: A, name: "Ala" });
  await t.mutation(api.users.register, { secret: B, name: "Bob" });
  const circle = await t.mutation(api.circles.create, { secret: A, name: "Rodzina", activities: [DAILY, TIRES] });
  await t.mutation(api.circles.join, { secret: B, code: circle.inviteCode });
  const [full] = await t.query(api.circles.list, { secret: A });
  return { t, circleId: circle.id, tires: full.activities[1].id, daily: full.activities[0].id };
}

async function codeOf(promise: Promise<unknown>): Promise<unknown> {
  try {
    await promise;
  } catch (e) {
    return (e as { data?: { code?: string } }).data?.code;
  }
  return "NO_ERROR";
}

const dueOf = async (t: Awaited<ReturnType<typeof setup>>["t"], secret: string, circleId: never, activityName: string) => {
  const v = await t.query(api.checkins.today, { secret, circleId, day: TODAY });
  const a = v.activities.find((x) => x.name === activityName)!;
  return Object.fromEntries(a.totals.map((m) => [v.members.find((x) => x.id === m.userId)!.name, m.nextDue]));
};

describe("czynność cykliczna w kręgu", () => {
  it("bez wpisu każdy ma termin domyślny firstDue; czynność dzienna nie ma terminu", async () => {
    const { t, circleId } = await setup();
    expect(await dueOf(t, A, circleId as never, "Opony")).toEqual({ Ala: FIRST_DUE, Bob: FIRST_DUE });
    expect(await dueOf(t, A, circleId as never, "Pompki")).toEqual({ Ala: null, Bob: null });
  });

  it("wpis przesuwa tylko termin tej osoby o cykl od dnia wykonania", async () => {
    const { t, circleId, tires } = await setup();
    await t.mutation(api.checkins.add, { secret: A, activityId: tires, day: TODAY, value: 1 });
    await t.mutation(api.checkins.add, { secret: A, activityId: tires, day: TODAY, value: 1 });
    expect(await dueOf(t, A, circleId as never, "Opony")).toEqual({ Ala: addMonths(TODAY, 6), Bob: FIRST_DUE });
  });

  it("cofnięcie przywraca termin domyślny, a przy wcześniejszym wpisie termin z niego", async () => {
    const { t, circleId, tires } = await setup();
    const earlier = iso(-1);
    await t.mutation(api.checkins.add, { secret: A, activityId: tires, day: earlier, value: 1 });
    await t.mutation(api.checkins.add, { secret: A, activityId: tires, day: TODAY, value: 1 });
    await t.mutation(api.checkins.undoLast, { secret: A, activityId: tires, day: TODAY });
    expect((await dueOf(t, A, circleId as never, "Opony")).Ala).toBe(addMonths(earlier, 6));
    await t.mutation(api.checkins.undoLast, { secret: A, activityId: tires, day: earlier });
    expect((await dueOf(t, A, circleId as never, "Opony")).Ala).toBe(FIRST_DUE);
  });

  it("tydzień pomija czynności cykliczne", async () => {
    const { t, circleId, tires } = await setup();
    await t.mutation(api.checkins.add, { secret: A, activityId: tires, day: TODAY, value: 1 });
    const w = await t.query(api.checkins.week, { secret: A, circleId, endDay: TODAY });
    expect(w.activities.map((a) => a.name)).toEqual(["Pompki"]);
    expect(w.members[0].days.every((d) => d.of === 1)).toBe(true);
  });

  it("walidacja: cykl bez terminu, termin bez cyklu, zły cykl, nie-done, termin za daleko", async () => {
    const t = await setup().then((x) => x.t);
    const make = (a: object) => t.mutation(api.circles.create, { secret: A, name: "X", activities: [a as never] });
    expect(await codeOf(make({ ...TIRES, firstDue: undefined }))).toBe("BAD_ACTIVITIES");
    expect(await codeOf(make({ ...TIRES, everyMonths: undefined }))).toBe("BAD_ACTIVITIES");
    expect(await codeOf(make({ ...TIRES, everyMonths: 0 }))).toBe("BAD_ACTIVITIES");
    expect(await codeOf(make({ ...TIRES, everyMonths: 25 }))).toBe("BAD_ACTIVITIES");
    expect(await codeOf(make({ ...TIRES, unit: "count", dailyTarget: 5 }))).toBe("BAD_ACTIVITIES");
    expect(await codeOf(make({ ...TIRES, firstDue: iso(365 * 4) }))).toBe("BAD_ACTIVITIES");
    expect(await codeOf(make({ ...TIRES, firstDue: "2026-02-30" }))).toBe("BAD_DAY");
  });
});
