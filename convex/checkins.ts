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
