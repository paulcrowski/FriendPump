import { v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import { mutation, query } from "./_generated/server";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import { fail, requireUser } from "./auth";

const DAY_FORMAT = /^\d{4}-\d{2}-\d{2}$/;
const DAY_MS = 86_400_000;
const MAX_SKEW_DAYS = 2; // strefy czasowe + niedokładny zegar telefonu
const MAX_VALUE = { count: 1000, minutes: 600, done: 1 } as const;

function checkDayFormat(day: string): number {
  const ms = DAY_FORMAT.test(day) ? Date.parse(day + "T00:00:00Z") : NaN;
  if (Number.isNaN(ms) || new Date(ms).toISOString().slice(0, 10) !== day) fail("BAD_DAY");
  return ms;
}

async function requireMember(ctx: QueryCtx | MutationCtx, userId: Id<"users">, circleId: Id<"circles">) {
  const m = await ctx.db
    .query("members")
    .withIndex("by_circle_user", (q) => q.eq("circleId", circleId).eq("userId", userId))
    .unique();
  if (!m) fail("NOT_A_MEMBER");
}

async function activityFor(ctx: QueryCtx | MutationCtx, userId: Id<"users">, activityId: Id<"activities">) {
  const activity = await ctx.db.get(activityId);
  if (!activity || activity.archived) fail("ACTIVITY_NOT_FOUND");
  await requireMember(ctx, userId, activity.circleId);
  return activity;
}

async function myEntries(ctx: QueryCtx | MutationCtx, userId: Id<"users">, activityId: Id<"activities">, day: string) {
  return ctx.db
    .query("checkins")
    .withIndex("by_activity_user_day", (q) => q.eq("activityId", activityId).eq("userId", userId).eq("day", day))
    .collect();
}

const sum = (rows: Doc<"checkins">[]) => rows.reduce((s, r) => s + r.value, 0);

export const add = mutation({
  args: { secret: v.string(), activityId: v.id("activities"), day: v.string(), value: v.number() },
  handler: async (ctx, { secret, activityId, day, value }) => {
    const user = await requireUser(ctx, secret);
    const dayMs = checkDayFormat(day);
    if (Math.abs(dayMs - Date.now()) > (MAX_SKEW_DAYS + 1) * DAY_MS) fail("BAD_DAY");
    const activity = await activityFor(ctx, user._id, activityId);
    if (!Number.isInteger(value) || value < 1 || value > MAX_VALUE[activity.unit]) fail("BAD_VALUE");
    const rows = await myEntries(ctx, user._id, activityId, day);
    // "Zrobione" to tak/nie: drugie kliknięcie niczego nie dubluje.
    if (activity.unit === "done" && rows.length > 0) return { total: sum(rows) };
    await ctx.db.insert("checkins", { activityId, circleId: activity.circleId, userId: user._id, day, value, createdAt: Date.now() });
    return { total: sum(rows) + value };
  },
});

export const undoLast = mutation({
  args: { secret: v.string(), activityId: v.id("activities"), day: v.string() },
  handler: async (ctx, { secret, activityId, day }) => {
    const user = await requireUser(ctx, secret);
    checkDayFormat(day);
    await activityFor(ctx, user._id, activityId);
    const rows = await myEntries(ctx, user._id, activityId, day);
    const last = rows.reduce<Doc<"checkins"> | null>((a, r) => (!a || r._creationTime > a._creationTime ? r : a), null);
    if (!last) fail("NOTHING_TO_UNDO");
    await ctx.db.delete(last._id);
    return { total: sum(rows) - last.value };
  },
});

// Widok dnia: przy każdej czynności suma każdego członka (ja pierwszy).
export const today = query({
  args: { secret: v.string(), circleId: v.id("circles"), day: v.string() },
  handler: async (ctx, { secret, circleId, day }) => {
    const user = await requireUser(ctx, secret);
    checkDayFormat(day);
    await requireMember(ctx, user._id, circleId);
    const circle = await ctx.db.get(circleId);
    if (!circle) fail("NOT_A_MEMBER");
    const memberRows = await ctx.db.query("members").withIndex("by_circle", (q) => q.eq("circleId", circleId)).collect();
    const members = [];
    for (const m of memberRows.sort((a, b) => a.joinedAt - b.joinedAt)) {
      const u = await ctx.db.get(m.userId);
      if (u) members.push({ id: u._id, name: u.name, isMe: u._id === user._id });
    }
    members.sort((a, b) => Number(b.isMe) - Number(a.isMe));
    const activities = await ctx.db.query("activities").withIndex("by_circle", (q) => q.eq("circleId", circleId)).collect();
    const result = [];
    for (const a of activities.filter((x) => !x.archived)) {
      const entries = await ctx.db.query("checkins").withIndex("by_activity_day", (q) => q.eq("activityId", a._id).eq("day", day)).collect();
      const totals = members.map((m) => ({ userId: m.id, total: sum(entries.filter((e) => e.userId === m.id)) }));
      result.push({ id: a._id, name: a.name, emoji: a.emoji, unit: a.unit, dailyTarget: a.dailyTarget, totals });
    }
    return { circle: { id: circle._id, name: circle.name, inviteCode: circle.inviteCode }, members, activities: result };
  },
});

const WINDOW_DAYS = 30; // tyle dni wstecz liczymy serię

function shiftDay(day: string, delta: number): string {
  return new Date(Date.parse(day + "T00:00:00Z") + delta * DAY_MS).toISOString().slice(0, 10);
}

// Tydzień kręgu: dla każdej osoby ile czynności zrobione w każdym z 7 dni, seria i sumy tygodnia.
export const week = query({
  args: { secret: v.string(), circleId: v.id("circles"), endDay: v.string() },
  handler: async (ctx, { secret, circleId, endDay }) => {
    const user = await requireUser(ctx, secret);
    checkDayFormat(endDay);
    await requireMember(ctx, user._id, circleId);
    const startDay = shiftDay(endDay, -(WINDOW_DAYS - 1));
    const activities = (await ctx.db.query("activities").withIndex("by_circle", (q) => q.eq("circleId", circleId)).collect()).filter((a) => !a.archived);
    const entries = await ctx.db
      .query("checkins")
      .withIndex("by_circle_day", (q) => q.eq("circleId", circleId).gte("day", startDay).lte("day", endDay))
      .collect();
    const sums = new Map<string, number>();
    for (const e of entries) {
      const key = `${e.userId}|${e.activityId}|${e.day}`;
      sums.set(key, (sums.get(key) ?? 0) + e.value);
    }
    const days = Array.from({ length: 7 }, (_, i) => shiftDay(endDay, i - 6));
    const memberRows = (await ctx.db.query("members").withIndex("by_circle", (q) => q.eq("circleId", circleId)).collect()).sort((a, b) => a.joinedAt - b.joinedAt);
    const members = [];
    for (const m of memberRows) {
      const u = await ctx.db.get(m.userId);
      if (!u) continue;
      const doneOn = (day: string) => activities.filter((a) => (sums.get(`${u._id}|${a._id}|${day}`) ?? 0) >= a.dailyTarget).length;
      const complete = (day: string) => activities.length > 0 && doneOn(day) === activities.length;
      // Dzisiejszy niedokończony dzień nie przerywa serii.
      let streak = 0;
      for (let i = 0; i < WINDOW_DAYS; i++) {
        if (complete(shiftDay(endDay, -i))) streak++;
        else if (i > 0) break;
      }
      members.push({
        id: u._id,
        name: u.name,
        isMe: u._id === user._id,
        days: days.map((d) => ({ done: doneOn(d), of: activities.length })),
        streak,
        totals: activities.map((a) => ({
          activityId: a._id,
          total: days.reduce((s, d) => s + (sums.get(`${u._id}|${a._id}|${d}`) ?? 0), 0),
        })),
      });
    }
    members.sort((a, b) => Number(b.isMe) - Number(a.isMe));
    return {
      days,
      activities: activities.map((a) => ({ id: a._id, name: a.name, emoji: a.emoji, unit: a.unit, dailyTarget: a.dailyTarget })),
      members,
    };
  },
});
