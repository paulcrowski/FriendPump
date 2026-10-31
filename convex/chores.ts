import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";
import { mutation, query } from "./_generated/server";
import type { MutationCtx } from "./_generated/server";
import { fail, requireUser } from "./auth";

const DAY_FORMAT = /^\d{4}-\d{2}-\d{2}$/;
const DAY_MS = 86_400_000;
const MAX_SKEW_DAYS = 2; // strefy czasowe + niedokładny zegar telefonu
const MAX_NAME = 30;
const MAX_CHORES = 50;
const MAX_MONTHS = 24;
const MAX_DUE_YEARS = 3; // termin pierwszego wykonania nie dalej niż 3 lata

function parseDay(day: string): number {
  const ms = DAY_FORMAT.test(day) ? Date.parse(day + "T00:00:00Z") : NaN;
  if (Number.isNaN(ms) || new Date(ms).toISOString().slice(0, 10) !== day) fail("BAD_DAY");
  return ms;
}

function checkToday(day: string): void {
  if (Math.abs(parseDay(day) - Date.now()) > (MAX_SKEW_DAYS + 1) * DAY_MS) fail("BAD_DAY");
}

// 31 stycznia + 1 miesiąc = 28/29 lutego, nie 3 marca.
export function addMonths(day: string, months: number): string {
  const d = new Date(parseDay(day));
  const target = d.getUTCFullYear() * 12 + d.getUTCMonth() + months;
  const year = Math.floor(target / 12);
  const month = target % 12;
  const lastDay = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  return new Date(Date.UTC(year, month, Math.min(d.getUTCDate(), lastDay))).toISOString().slice(0, 10);
}

async function ownChore(ctx: MutationCtx, userId: Id<"users">, choreId: Id<"chores">) {
  const chore = await ctx.db.get(choreId);
  // Cudzy lub nieistniejący to ten sam błąd: nie zdradzamy, że rekord istnieje.
  if (!chore || chore.userId !== userId || chore.archived) fail("CHORE_NOT_FOUND");
  return chore;
}

export const create = mutation({
  args: { secret: v.string(), name: v.string(), emoji: v.string(), everyMonths: v.number(), nextDue: v.string(), today: v.string() },
  handler: async (ctx, { secret, name, emoji, everyMonths, nextDue, today }) => {
    const user = await requireUser(ctx, secret);
    checkToday(today);
    const cleanName = name.trim();
    const cleanEmoji = emoji.trim();
    const dueMs = parseDay(nextDue);
    const badCycle = !Number.isInteger(everyMonths) || everyMonths < 1 || everyMonths > MAX_MONTHS;
    const badDue = dueMs > parseDay(addMonths(today, MAX_DUE_YEARS * 12));
    if (cleanName.length < 1 || cleanName.length > MAX_NAME || cleanEmoji.length < 1 || cleanEmoji.length > 8 || badCycle || badDue) fail("BAD_CHORE");
    const mine = await ctx.db.query("chores").withIndex("by_user", (q) => q.eq("userId", user._id)).collect();
    if (mine.filter((c) => !c.archived).length >= MAX_CHORES) fail("BAD_CHORE");
    const id = await ctx.db.insert("chores", {
      userId: user._id,
      name: cleanName,
      emoji: cleanEmoji,
      everyMonths,
      nextDue,
      archived: false,
      createdAt: Date.now(),
    });
    return { id, nextDue };
  },
});

// Najbliższy termin pierwszy. Termin w przeszłości = zaległe (UI pokaże po dacie, nie po fladze).
export const list = query({
  args: { secret: v.string() },
  handler: async (ctx, { secret }) => {
    const user = await requireUser(ctx, secret);
    const rows = await ctx.db.query("chores").withIndex("by_user", (q) => q.eq("userId", user._id)).collect();
    return rows
      .filter((c) => !c.archived)
      .sort((a, b) => (a.nextDue < b.nextDue ? -1 : a.nextDue > b.nextDue ? 1 : 0))
      .map((c) => ({ id: c._id, name: c.name, emoji: c.emoji, everyMonths: c.everyMonths, nextDue: c.nextDue, lastDone: c.lastDone ?? null }));
  },
});

// Termin liczymy od dnia wykonania, nie od starego terminu: spóźniony przegląd nie zostawia "długu".
// Drugie kliknięcie tego samego dnia niczego nie przesuwa.
export const markDone = mutation({
  args: { secret: v.string(), choreId: v.id("chores"), day: v.string() },
  handler: async (ctx, { secret, choreId, day }) => {
    const user = await requireUser(ctx, secret);
    checkToday(day);
    const chore = await ownChore(ctx, user._id, choreId);
    if (chore.lastDone === day) return { nextDue: chore.nextDue };
    const nextDue = addMonths(day, chore.everyMonths);
    await ctx.db.patch(choreId, { lastDone: day, nextDue });
    return { nextDue };
  },
});

export const archive = mutation({
  args: { secret: v.string(), choreId: v.id("chores") },
  handler: async (ctx, { secret, choreId }) => {
    const user = await requireUser(ctx, secret);
    await ownChore(ctx, user._id, choreId);
    await ctx.db.patch(choreId, { archived: true });
    return { ok: true };
  },
});
