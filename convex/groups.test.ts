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

const row = async (t: Awaited<ReturnType<typeof setup>>, secret: string, key: string) =>
  (await t.query(api.groups.list, { secret, today: TODAY })).find((g) => g.key === key)!;

describe("periodKey", () => {
  it("grupa półroczna dzieli rok na dwa okresy, roczna na jeden", () => {
    expect(periodKey("2026-03-10", 6)).toBe("2026-0");
    expect(periodKey("2026-09-10", 6)).toBe("2026-1");
    expect(periodKey("2026-01-01", 12)).toBe("2026-0");
    expect(periodKey("2026-12-31", 12)).toBe("2026-0");
  });
});

describe("groups", () => {
  it("list pokazuje cały katalog z zerami", async () => {
    const t = await setup();
    const all = await t.query(api.groups.list, { secret: A, today: TODAY });
    expect(all.map((g) => g.key).sort()).toEqual(["blood", "boiler", "car", "dentist", "smoke", "tires"]);
    expect(all.every((g) => g.members === 0 && g.doneThisPeriod === 0 && !g.joined)).toBe(true);
  });

  it("join jest idempotentne, liczniki liczą różnych ludzi, leave odejmuje", async () => {
    const t = await setup();
    await t.mutation(api.groups.join, { secret: A, key: "tires" });
    await t.mutation(api.groups.join, { secret: A, key: "tires" });
    await t.mutation(api.groups.join, { secret: B, key: "tires" });
    expect((await row(t, A, "tires")).members).toBe(2);
    await t.mutation(api.groups.leave, { secret: B, key: "tires" });
    await t.mutation(api.groups.leave, { secret: B, key: "tires" });
    const g = await row(t, A, "tires");
    expect([g.members, g.joined]).toEqual([1, true]);
    expect((await row(t, B, "tires")).joined).toBe(false);
  });

  it("markDone liczy raz na okres, drugi raz nie dolicza", async () => {
    const t = await setup();
    await t.mutation(api.groups.join, { secret: A, key: "blood" });
    const first = await t.mutation(api.groups.markDone, { secret: A, key: "blood", day: TODAY });
    const second = await t.mutation(api.groups.markDone, { secret: A, key: "blood", day: TODAY });
    expect([first.counted, second.counted]).toEqual([true, false]);
    const g = await row(t, A, "blood");
    expect([g.doneThisPeriod, g.doneByMe]).toEqual([1, true]);
  });

  it("liczniki sumują wiele shardów", async () => {
    const t = await setup();
    // Wstawiamy ręcznie kilka shardów, jak po wielu równoległych zapisach.
    await t.run(async (ctx) => {
      for (let shard = 0; shard < 5; shard++) await ctx.db.insert("groupCounters", { groupKey: "car", kind: "members", shard, n: 100 + shard });
    });
    expect((await row(t, A, "car")).members).toBe(510);
  });

  it("markDone bez członkostwa to NOT_A_MEMBER, zły klucz BAD_GROUP, zły dzień BAD_DAY", async () => {
    const t = await setup();
    expect(await codeOf(t.mutation(api.groups.markDone, { secret: A, key: "car", day: TODAY }))).toBe("NOT_A_MEMBER");
    expect(await codeOf(t.mutation(api.groups.join, { secret: A, key: "nope" }))).toBe("BAD_GROUP");
    await t.mutation(api.groups.join, { secret: A, key: "car" });
    expect(await codeOf(t.mutation(api.groups.markDone, { secret: A, key: "car", day: "2020-01-01" }))).toBe("BAD_DAY");
    expect(await codeOf(t.query(api.groups.list, { secret: "c".repeat(64), today: TODAY }))).toBe("NOT_REGISTERED");
  });
});
