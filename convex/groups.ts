import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";
import { mutation, query } from "./_generated/server";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import { fail, requireUser } from "./auth";

const DAY_FORMAT = /^\d{4}-\d{2}-\d{2}$/;
const DAY_MS = 86_400_000;
const MAX_SKEW_DAYS = 2;
const SHARDS = 16;

// Katalog grup: klucz -> długość okresu w miesiącach (6 = "2 razy w roku", 12 = "raz w roku").
// Nazwy pokazuje aplikacja (tłumaczone po stronie telefonu), serwer zna tylko klucze.
export const CATALOG: Record<string, number> = { car: 12, tires: 6, blood: 12, dentist: 6, boiler: 12, smoke: 12 };

function checkDay(day: string): number {
  const ms = DAY_FORMAT.test(day) ? Date.parse(day + "T00:00:00Z") : NaN;
  if (Number.isNaN(ms) || new Date(ms).toISOString().slice(0, 10) !== day) fail("BAD_DAY");
  if (Math.abs(ms - Date.now()) > (MAX_SKEW_DAYS + 1) * DAY_MS) fail("BAD_DAY");
  return ms;
}

function requireGroup(key: string): number {
  const months = CATALOG[key];
  if (months === undefined) fail("BAD_GROUP");
  return months;
}

// "2026-1" = druga połowa 2026 dla grupy półrocznej, "2026-0" = cały rok dla rocznej.
export function periodKey(day: string, months: number): string {
  const d = new Date(Date.parse(day + "T00:00:00Z"));
  return `${d.getUTCFullYear()}-${Math.floor(d.getUTCMonth() / months)}`;
}

async function total(ctx: QueryCtx | MutationCtx, groupKey: string, kind: string): Promise<number> {
  const rows = await ctx.db
    .query("groupCounters")
    .withIndex("by_group_kind_shard", (q) => q.eq("groupKey", groupKey).eq("kind", kind))
    .collect();
  return rows.reduce((s, r) => s + r.n, 0);
}

async function bump(ctx: MutationCtx, groupKey: string, kind: string, delta: number): Promise<void> {
  const shard = Math.floor(Math.random() * SHARDS);
  const row = await ctx.db
    .query("groupCounters")
    .withIndex("by_group_kind_shard", (q) => q.eq("groupKey", groupKey).eq("kind", kind).eq("shard", shard))
    .unique();
  if (row) await ctx.db.patch(row._id, { n: row.n + delta });
  else await ctx.db.insert("groupCounters", { groupKey, kind, shard, n: delta });
}

async function membership(ctx: QueryCtx | MutationCtx, groupKey: string, userId: Id<"users">) {
  return ctx.db
    .query("groupMembers")
    .withIndex("by_group_user", (q) => q.eq("groupKey", groupKey).eq("userId", userId as never))
    .unique();
}

// Tylko liczniki i moje własne dane. Nikt nie widzi innych członków.
export const list = query({
  args: { secret: v.string(), today: v.string() },
  handler: async (ctx, { secret, today }) => {
    const user = await requireUser(ctx, secret);
    checkDay(today);
    const out = [];
    for (const [key, months] of Object.entries(CATALOG)) {
      const period = periodKey(today, months);
      const mine = await membership(ctx, key, user._id);
      out.push({
        key,
        everyMonths: months,
        members: await total(ctx, key, "members"),
        doneThisPeriod: await total(ctx, key, `done:${period}`),
        joined: mine !== null,
        doneByMe: mine?.lastDonePeriod === period,
      });
    }
    return out;
  },
});

export const join = mutation({
  args: { secret: v.string(), key: v.string() },
  handler: async (ctx, { secret, key }) => {
    const user = await requireUser(ctx, secret);
    requireGroup(key);
    if (await membership(ctx, key, user._id)) return { joined: true };
    await ctx.db.insert("groupMembers", { groupKey: key, userId: user._id, joinedAt: Date.now() });
    await bump(ctx, key, "members", 1);
    return { joined: true };
  },
});

export const leave = mutation({
  args: { secret: v.string(), key: v.string() },
  handler: async (ctx, { secret, key }) => {
    const user = await requireUser(ctx, secret);
    requireGroup(key);
    const mine = await membership(ctx, key, user._id);
    if (!mine) return { joined: false };
    await ctx.db.delete(mine._id);
    await bump(ctx, key, "members", -1);
    return { joined: false };
  },
});

// Jedno wykonanie na okres grupy: drugie kliknięcie niczego nie dolicza.
// Wyjście z grupy nie cofa licznika "zrobiło w tym okresie": to fakt historyczny.
export const markDone = mutation({
  args: { secret: v.string(), key: v.string(), day: v.string() },
  handler: async (ctx, { secret, key, day }) => {
    const user = await requireUser(ctx, secret);
    const months = requireGroup(key);
    checkDay(day);
    const mine = await membership(ctx, key, user._id);
    if (!mine) fail("NOT_A_MEMBER");
    const period = periodKey(day, months);
    if (mine.lastDonePeriod === period) return { period, counted: false };
    await ctx.db.patch(mine._id, { lastDonePeriod: period });
    await bump(ctx, key, `done:${period}`, 1);
    return { period, counted: true };
  },
});
