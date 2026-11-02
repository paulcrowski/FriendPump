import { v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import { mutation, query } from "./_generated/server";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import { fail, requireUser } from "./auth";
import { refreshDue } from "./checkins";
import { addMonths, parseDay } from "./dates";

const DAY_MS = 86_400_000;
const MAX_SKEW_DAYS = 2;
const SHARDS = 16;

// Katalog grup otwartych: klucz -> długość okresu w miesiącach (6 = "2 razy w roku", 12 = "raz w roku").
// Nazwy pokazuje aplikacja (tłumaczone po stronie telefonu), serwer zna tylko klucze.
// Grupa otwarta to krąg z openKey: członkostwo w members, jedna czynność cykliczna, termin w memberDues.
export const CATALOG: Record<string, number> = { car: 12, tires: 6, blood: 12, dentist: 6, boiler: 12, smoke: 12 };

function checkDay(day: string): void {
  if (Math.abs(parseDay(day) - Date.now()) > (MAX_SKEW_DAYS + 1) * DAY_MS) fail("BAD_DAY");
}

function requireGroup(key: string): number {
  const months = CATALOG[key];
  if (months === undefined) fail("BAD_GROUP");
  return months;
}

// "2026-1" = druga połowa 2026 dla grupy półrocznej, "2026-0" = cały rok dla rocznej.
export function periodKey(day: string, months: number): string {
  const d = new Date(parseDay(day));
  return `${d.getUTCFullYear()}-${Math.floor(d.getUTCMonth() / months)}`;
}

export function periodStart(day: string, months: number): string {
  const d = new Date(parseDay(day));
  return new Date(Date.UTC(d.getUTCFullYear(), Math.floor(d.getUTCMonth() / months) * months, 1)).toISOString().slice(0, 10);
}

// Ostatni dzień okresu: termin domyślny po dołączeniu ("zrób w tym okresie").
function periodEnd(day: string, months: number): string {
  return new Date(parseDay(addMonths(periodStart(day, months), months)) - DAY_MS).toISOString().slice(0, 10);
}

async function total(ctx: QueryCtx | MutationCtx, groupKey: string, kind: string): Promise<number> {
  const rows = await ctx.db
    .query("groupCounters")
    .withIndex("by_group_kind_shard", (q) => q.eq("groupKey", groupKey).eq("kind", kind))
    .collect();
  return rows.reduce((s, r) => s + r.n, 0);
}

// Licznik dzielony na shardy, żeby tysiące równoczesnych zapisów nie biły w jeden dokument.
async function bump(ctx: MutationCtx, groupKey: string, kind: string, delta: number): Promise<void> {
  const shard = Math.floor(Math.random() * SHARDS);
  const row = await ctx.db
    .query("groupCounters")
    .withIndex("by_group_kind_shard", (q) => q.eq("groupKey", groupKey).eq("kind", kind).eq("shard", shard))
    .unique();
  if (row) await ctx.db.patch(row._id, { n: row.n + delta });
  else await ctx.db.insert("groupCounters", { groupKey, kind, shard, n: delta });
}

async function openCircle(ctx: QueryCtx | MutationCtx, key: string) {
  return ctx.db.query("circles").withIndex("by_openKey", (q) => q.eq("openKey", key)).unique();
}

async function memberOf(ctx: QueryCtx | MutationCtx, circleId: Id<"circles">, userId: Id<"users">) {
  return ctx.db.query("members").withIndex("by_circle_user", (q) => q.eq("circleId", circleId).eq("userId", userId)).unique();
}

async function dueFor(ctx: QueryCtx | MutationCtx, activityId: Id<"activities">, userId: Id<"users">) {
  return ctx.db.query("memberDues").withIndex("by_activity_user", (q) => q.eq("activityId", activityId).eq("userId", userId)).unique();
}

async function openActivity(ctx: QueryCtx | MutationCtx, circleId: Id<"circles">): Promise<Doc<"activities"> | null> {
  return ctx.db.query("activities").withIndex("by_circle", (q) => q.eq("circleId", circleId)).first();
}

// Tworzy krąg i czynność przy pierwszym dołączeniu; kolejne wywołania zwracają to samo.
async function ensureOpen(ctx: MutationCtx, userId: Id<"users">, key: string, months: number, today: string) {
  let circle = await openCircle(ctx, key);
  if (!circle) {
    const id = await ctx.db.insert("circles", { name: key, inviteCode: `OPEN-${key}`, createdBy: userId, createdAt: Date.now(), openKey: key });
    circle = (await ctx.db.get(id))!;
  }
  let activity = await openActivity(ctx, circle._id);
  if (!activity) {
    const id = await ctx.db.insert("activities", {
      circleId: circle._id, name: key, emoji: "", unit: "done", dailyTarget: 1, archived: false, everyMonths: months, firstDue: periodEnd(today, months),
    });
    activity = (await ctx.db.get(id))!;
  }
  return { circle, activity };
}

// Używane przez join oraz jednorazową migrację (bez zmiany licznika członków).
export async function joinOpen(ctx: MutationCtx, userId: Id<"users">, key: string, today: string, countMember: boolean): Promise<Doc<"activities">> {
  const months = requireGroup(key);
  const { circle, activity } = await ensureOpen(ctx, userId, key, months, today);
  if (await memberOf(ctx, circle._id, userId)) return activity;
  await ctx.db.insert("members", { circleId: circle._id, userId, joinedAt: Date.now() });
  if (!(await dueFor(ctx, activity._id, userId))) await ctx.db.insert("memberDues", { activityId: activity._id, userId, nextDue: periodEnd(today, months) });
  if (countMember) await bump(ctx, key, "members", 1);
  return activity;
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
      const circle = await openCircle(ctx, key);
      const activity = circle ? await openActivity(ctx, circle._id) : null;
      const joined = circle ? (await memberOf(ctx, circle._id, user._id)) !== null : false;
      const due = joined && activity ? await dueFor(ctx, activity._id, user._id) : null;
      out.push({
        key,
        everyMonths: months,
        members: await total(ctx, key, "members"),
        doneThisPeriod: await total(ctx, key, `done:${period}`),
        joined,
        doneByMe: due?.lastDone !== undefined && periodKey(due.lastDone, months) === period,
      });
    }
    return out;
  },
});

export const join = mutation({
  args: { secret: v.string(), key: v.string(), today: v.string() },
  handler: async (ctx, { secret, key, today }) => {
    const user = await requireUser(ctx, secret);
    requireGroup(key);
    checkDay(today);
    await joinOpen(ctx, user._id, key, today, true);
    return { joined: true };
  },
});

export const leave = mutation({
  args: { secret: v.string(), key: v.string() },
  handler: async (ctx, { secret, key }) => {
    const user = await requireUser(ctx, secret);
    requireGroup(key);
    const circle = await openCircle(ctx, key);
    const mine = circle ? await memberOf(ctx, circle._id, user._id) : null;
    if (!circle || !mine) return { joined: false };
    const activity = await openActivity(ctx, circle._id);
    const due = activity ? await dueFor(ctx, activity._id, user._id) : null;
    if (due) await ctx.db.delete(due._id);
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
    const circle = await openCircle(ctx, key);
    const activity = circle ? await openActivity(ctx, circle._id) : null;
    if (!circle || !activity || !(await memberOf(ctx, circle._id, user._id))) fail("NOT_A_MEMBER");
    const period = periodKey(day, months);
    const due = await dueFor(ctx, activity._id, user._id);
    if (due?.lastDone !== undefined && periodKey(due.lastDone, months) === period) return { period, counted: false };
    await ctx.db.insert("checkins", { activityId: activity._id, circleId: circle._id, userId: user._id, day, value: 1, createdAt: Date.now() });
    await refreshDue(ctx, activity, user._id);
    await bump(ctx, key, `done:${period}`, 1);
    return { period, counted: true };
  },
});
