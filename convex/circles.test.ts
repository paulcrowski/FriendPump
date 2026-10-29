/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";
import { api } from "./_generated/api";
import schema from "./schema";

const modules = import.meta.glob("./**/*.*s");
const A = "a".repeat(64);
const B = "b".repeat(64);

const PUSHUPS = { name: "Pompki", emoji: "💪", unit: "count", dailyTarget: 20 } as const;
const PULLUPS = { name: "Podciągnięcia", emoji: "🧗", unit: "count", dailyTarget: 10 } as const;
const MEDITATION = { name: "Medytacja", emoji: "🧘", unit: "minutes", dailyTarget: 10 } as const;
const ALL = [PUSHUPS, PULLUPS, MEDITATION];

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

describe("circles", () => {
  it("create daje kod z dozwolonych znaków, członka i 3 domyślne czynności", async () => {
    const t = await setup();
    const c = await t.mutation(api.circles.create, { secret: A, name: " Treningi ", activities: ALL });
    expect(c.name).toBe("Treningi");
    expect(c.inviteCode).toMatch(/^[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{8}$/);
    const [circle] = await t.query(api.circles.list, { secret: A });
    expect(circle.memberCount).toBe(1);
    expect(circle.activities.map((a) => [a.name, a.dailyTarget, a.unit])).toEqual([
      ["Pompki", 20, "count"],
      ["Podciągnięcia", 10, "count"],
      ["Medytacja", 10, "minutes"],
    ]);
  });

  it("tworzy tylko wybrane czynności", async () => {
    const t = await setup();
    await t.mutation(api.circles.create, { secret: A, name: "Druty", activities: [{ name: " Druty ", emoji: "🧶", unit: "done", dailyTarget: 99 }] });
    const [circle] = await t.query(api.circles.list, { secret: A });
    expect(circle.activities.map((a) => [a.name, a.dailyTarget, a.unit])).toEqual([["Druty", 1, "done"]]);
  });

  it("zła lista czynności to BAD_ACTIVITIES", async () => {
    const t = await setup();
    const bad = async (activities: { name: string; emoji: string; unit: "count" | "minutes" | "done"; dailyTarget: number }[]) =>
      codeOf(t.mutation(api.circles.create, { secret: A, name: "X", activities }));
    expect(await bad([])).toBe("BAD_ACTIVITIES");
    expect(await bad([{ ...PUSHUPS, name: " " }])).toBe("BAD_ACTIVITIES");
    expect(await bad([{ ...PUSHUPS, name: "x".repeat(31) }])).toBe("BAD_ACTIVITIES");
    expect(await bad([{ ...PUSHUPS, dailyTarget: 0 }])).toBe("BAD_ACTIVITIES");
    expect(await bad([{ ...PUSHUPS, dailyTarget: 2.5 }])).toBe("BAD_ACTIVITIES");
    expect(await bad([{ ...PUSHUPS, dailyTarget: 1001 }])).toBe("BAD_ACTIVITIES");
    expect(await bad(Array.from({ length: 13 }, () => PUSHUPS))).toBe("BAD_ACTIVITIES");
  });

  it("kody dwóch kręgów są różne", async () => {
    const t = await setup();
    const c1 = await t.mutation(api.circles.create, { secret: A, name: "Jeden", activities: ALL });
    const c2 = await t.mutation(api.circles.create, { secret: B, name: "Dwa", activities: ALL });
    expect(c1.inviteCode).not.toBe(c2.inviteCode);
  });

  it("list pokazuje tylko własne kręgi", async () => {
    const t = await setup();
    await t.mutation(api.circles.create, { secret: A, name: "Alowy", activities: ALL });
    expect(await t.query(api.circles.list, { secret: B })).toEqual([]);
    expect((await t.query(api.circles.list, { secret: A })).map((c) => c.name)).toEqual(["Alowy"]);
  });

  it("brak rejestracji to NOT_REGISTERED, zła nazwa to BAD_NAME", async () => {
    const t = await setup();
    const C = "c".repeat(64);
    expect(await codeOf(t.mutation(api.circles.create, { secret: C, name: "X", activities: ALL }))).toBe("NOT_REGISTERED");
    expect(await codeOf(t.query(api.circles.list, { secret: C }))).toBe("NOT_REGISTERED");
    expect(await codeOf(t.mutation(api.circles.create, { secret: A, name: " ", activities: ALL }))).toBe("BAD_NAME");
    expect(await codeOf(t.mutation(api.circles.create, { secret: A, name: "x".repeat(31), activities: ALL }))).toBe("BAD_NAME");
  });
});

describe("circles.join", () => {
  it("dołącza po kodzie i drugi członek widzi krąg", async () => {
    const t = await setup();
    const c = await t.mutation(api.circles.create, { secret: A, name: "Treningi", activities: ALL });
    const joined = await t.mutation(api.circles.join, { secret: B, code: c.inviteCode });
    expect(joined).toMatchObject({ id: c.id, name: "Treningi", memberCount: 2 });
    const mine = await t.query(api.circles.list, { secret: B });
    expect(mine.map((x) => x.name)).toEqual(["Treningi"]);
    expect(mine[0].activities).toHaveLength(3);
  });

  it("jest idempotentne: drugi raz bez duplikatu członka", async () => {
    const t = await setup();
    const c = await t.mutation(api.circles.create, { secret: A, name: "Treningi", activities: ALL });
    await t.mutation(api.circles.join, { secret: B, code: c.inviteCode });
    const again = await t.mutation(api.circles.join, { secret: B, code: c.inviteCode });
    expect(again.memberCount).toBe(2);
    const own = await t.mutation(api.circles.join, { secret: A, code: c.inviteCode });
    expect(own.memberCount).toBe(2);
  });

  it("akceptuje kod z myślnikiem, spacjami i małymi literami", async () => {
    const t = await setup();
    const c = await t.mutation(api.circles.create, { secret: A, name: "Treningi", activities: ALL });
    const typed = ` ${c.inviteCode.slice(0, 4)}-${c.inviteCode.slice(4)} `.toLowerCase();
    const joined = await t.mutation(api.circles.join, { secret: B, code: typed });
    expect(joined.id).toBe(c.id);
  });

  it("zły format to BAD_CODE, nieistniejący kod to CIRCLE_NOT_FOUND", async () => {
    const t = await setup();
    expect(await codeOf(t.mutation(api.circles.join, { secret: B, code: "abc" }))).toBe("BAD_CODE");
    expect(await codeOf(t.mutation(api.circles.join, { secret: B, code: "0000-0000" }))).toBe("BAD_CODE");
    expect(await codeOf(t.mutation(api.circles.join, { secret: B, code: "AAAA-AAAA" }))).toBe("CIRCLE_NOT_FOUND");
  });

  it("bez rejestracji to NOT_REGISTERED", async () => {
    const t = await setup();
    const c = await t.mutation(api.circles.create, { secret: A, name: "Treningi", activities: ALL });
    expect(await codeOf(t.mutation(api.circles.join, { secret: "c".repeat(64), code: c.inviteCode }))).toBe("NOT_REGISTERED");
  });
});

