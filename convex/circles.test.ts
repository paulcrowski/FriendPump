/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";
import { api } from "./_generated/api";
import schema from "./schema";

const modules = import.meta.glob("./**/*.*s");
const A = "a".repeat(64);
const B = "b".repeat(64);

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
    const c = await t.mutation(api.circles.create, { secret: A, name: " Treningi " });
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

  it("kody dwóch kręgów są różne", async () => {
    const t = await setup();
    const c1 = await t.mutation(api.circles.create, { secret: A, name: "Jeden" });
    const c2 = await t.mutation(api.circles.create, { secret: B, name: "Dwa" });
    expect(c1.inviteCode).not.toBe(c2.inviteCode);
  });

  it("list pokazuje tylko własne kręgi", async () => {
    const t = await setup();
    await t.mutation(api.circles.create, { secret: A, name: "Alowy" });
    expect(await t.query(api.circles.list, { secret: B })).toEqual([]);
    expect((await t.query(api.circles.list, { secret: A })).map((c) => c.name)).toEqual(["Alowy"]);
  });

  it("brak rejestracji to NOT_REGISTERED, zła nazwa to BAD_NAME", async () => {
    const t = await setup();
    const C = "c".repeat(64);
    expect(await codeOf(t.mutation(api.circles.create, { secret: C, name: "X" }))).toBe("NOT_REGISTERED");
    expect(await codeOf(t.query(api.circles.list, { secret: C }))).toBe("NOT_REGISTERED");
    expect(await codeOf(t.mutation(api.circles.create, { secret: A, name: " " }))).toBe("BAD_NAME");
    expect(await codeOf(t.mutation(api.circles.create, { secret: A, name: "x".repeat(31) }))).toBe("BAD_NAME");
  });
});
