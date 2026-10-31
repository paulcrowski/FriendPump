/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";
import { api } from "./_generated/api";
import { addMonths } from "./chores";
import schema from "./schema";

const modules = import.meta.glob("./**/*.*s");
const A = "a".repeat(64);
const B = "b".repeat(64);
const DAY_MS = 86_400_000;
const iso = (offsetDays: number) => new Date(Date.now() + offsetDays * DAY_MS).toISOString().slice(0, 10);
const TODAY = iso(0);

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

const tires = (nextDue = iso(30)) => ({ secret: A, name: " Opony ", emoji: "🛞", everyMonths: 6, nextDue, today: TODAY });

describe("addMonths", () => {
  it("ucina do końca krótszego miesiąca i przechodzi przez rok", () => {
    expect(addMonths("2026-01-31", 1)).toBe("2026-02-28");
    expect(addMonths("2028-01-31", 1)).toBe("2028-02-29");
    expect(addMonths("2026-11-15", 6)).toBe("2027-05-15");
    expect(addMonths("2026-12-31", 12)).toBe("2027-12-31");
  });
});

describe("chores", () => {
  it("create + list: przycięta nazwa, sortowanie po terminie, lastDone null", async () => {
    const t = await setup();
    await t.mutation(api.chores.create, tires(iso(30)));
    await t.mutation(api.chores.create, { ...tires(iso(5)), name: "Krew", everyMonths: 12 });
    const list = await t.query(api.chores.list, { secret: A });
    expect(list.map((c) => [c.name, c.everyMonths, c.lastDone])).toEqual([["Krew", 12, null], ["Opony", 6, null]]);
  });

  it("markDone przesuwa termin o cykl liczony od dnia wykonania", async () => {
    const t = await setup();
    const { id } = await t.mutation(api.chores.create, tires(iso(-10)));
    const r = await t.mutation(api.chores.markDone, { secret: A, choreId: id, day: TODAY });
    expect(r.nextDue).toBe(addMonths(TODAY, 6));
    const [c] = await t.query(api.chores.list, { secret: A });
    expect([c.lastDone, c.nextDue]).toEqual([TODAY, addMonths(TODAY, 6)]);
  });

  it("markDone w tym samym dniu jest idempotentne", async () => {
    const t = await setup();
    const { id } = await t.mutation(api.chores.create, tires());
    const first = await t.mutation(api.chores.markDone, { secret: A, choreId: id, day: TODAY });
    const second = await t.mutation(api.chores.markDone, { secret: A, choreId: id, day: TODAY });
    expect(second).toEqual(first);
  });

  it("cudze zadanie i brak zadania dają CHORE_NOT_FOUND", async () => {
    const t = await setup();
    const { id } = await t.mutation(api.chores.create, tires());
    expect(await codeOf(t.mutation(api.chores.markDone, { secret: B, choreId: id, day: TODAY }))).toBe("CHORE_NOT_FOUND");
    expect(await codeOf(t.mutation(api.chores.archive, { secret: B, choreId: id }))).toBe("CHORE_NOT_FOUND");
    expect(await t.query(api.chores.list, { secret: B })).toEqual([]);
  });

  it("archive ukrywa zadanie, a kolejna operacja na nim to CHORE_NOT_FOUND", async () => {
    const t = await setup();
    const { id } = await t.mutation(api.chores.create, tires());
    await t.mutation(api.chores.archive, { secret: A, choreId: id });
    expect(await t.query(api.chores.list, { secret: A })).toEqual([]);
    expect(await codeOf(t.mutation(api.chores.markDone, { secret: A, choreId: id, day: TODAY }))).toBe("CHORE_NOT_FOUND");
  });

  it("walidacja: cykl, nazwa, termin, dzień", async () => {
    const t = await setup();
    expect(await codeOf(t.mutation(api.chores.create, { ...tires(), everyMonths: 0 }))).toBe("BAD_CHORE");
    expect(await codeOf(t.mutation(api.chores.create, { ...tires(), everyMonths: 25 }))).toBe("BAD_CHORE");
    expect(await codeOf(t.mutation(api.chores.create, { ...tires(), everyMonths: 1.5 }))).toBe("BAD_CHORE");
    expect(await codeOf(t.mutation(api.chores.create, { ...tires(), name: "  " }))).toBe("BAD_CHORE");
    expect(await codeOf(t.mutation(api.chores.create, tires(iso(365 * 4))))).toBe("BAD_CHORE");
    expect(await codeOf(t.mutation(api.chores.create, tires("2026-02-30")))).toBe("BAD_DAY");
    expect(await codeOf(t.mutation(api.chores.create, { ...tires(), today: "2020-01-01" }))).toBe("BAD_DAY");
  });

  it("bez rejestracji: NOT_REGISTERED", async () => {
    const t = await setup();
    expect(await codeOf(t.query(api.chores.list, { secret: "c".repeat(64) }))).toBe("NOT_REGISTERED");
  });
});
