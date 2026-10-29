import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import type { MutationCtx } from "./_generated/server";
import { fail, requireUser } from "./auth";

const MAX_NAME = 30;
// Bez 0/O, 1/I/L, żeby kod dało się przepisać z komunikatora.
const CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
const CODE_LENGTH = 8;
const CODE_ATTEMPTS = 8;

const MAX_ACTIVITIES = 12;
const MAX_TARGET = 1000;

const activityInput = v.object({
  name: v.string(),
  emoji: v.string(),
  unit: v.union(v.literal("count"), v.literal("minutes"), v.literal("done")),
  dailyTarget: v.number(),
});

type ActivityInput = {
  name: string;
  emoji: string;
  unit: "count" | "minutes" | "done";
  dailyTarget: number;
};

function cleanActivities(list: ActivityInput[]): ActivityInput[] {
  if (list.length < 1 || list.length > MAX_ACTIVITIES) fail("BAD_ACTIVITIES");
  return list.map((a) => {
    const name = a.name.trim();
    const emoji = a.emoji.trim();
    const target = a.unit === "done" ? 1 : a.dailyTarget;
    const badTarget = !Number.isInteger(target) || target < 1 || target > MAX_TARGET;
    if (name.length < 1 || name.length > MAX_NAME || emoji.length < 1 || emoji.length > 8 || badTarget) fail("BAD_ACTIVITIES");
    return { name, emoji, unit: a.unit, dailyTarget: target };
  });
}

function newCode(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(CODE_LENGTH));
  return Array.from(bytes, (b) => CODE_ALPHABET[b % CODE_ALPHABET.length]).join("");
}

async function uniqueCode(ctx: MutationCtx): Promise<string> {
  for (let i = 0; i < CODE_ATTEMPTS; i++) {
    const code = newCode();
    const taken = await ctx.db
      .query("circles")
      .withIndex("by_inviteCode", (q) => q.eq("inviteCode", code))
      .unique();
    if (!taken) return code;
  }
  return fail("CODE_GENERATION_FAILED");
}

export const create = mutation({
  args: { secret: v.string(), name: v.string(), activities: v.array(activityInput) },
  handler: async (ctx, { secret, name, activities }) => {
    const user = await requireUser(ctx, secret);
    const cleaned = name.trim();
    if (cleaned.length < 1 || cleaned.length > MAX_NAME) fail("BAD_NAME");
    const chosen = cleanActivities(activities);
    const now = Date.now();
    const inviteCode = await uniqueCode(ctx);
    const circleId = await ctx.db.insert("circles", {
      name: cleaned,
      inviteCode,
      createdBy: user._id,
      createdAt: now,
    });
    await ctx.db.insert("members", { circleId, userId: user._id, joinedAt: now });
    for (const a of chosen) {
      await ctx.db.insert("activities", { circleId, ...a, archived: false });
    }
    return { id: circleId, name: cleaned, inviteCode };
  },
});

// Tylko kręgi, których użytkownik jest członkiem.
export const list = query({
  args: { secret: v.string() },
  handler: async (ctx, { secret }) => {
    const user = await requireUser(ctx, secret);
    const memberships = await ctx.db
      .query("members")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .collect();
    const circles = [];
    for (const m of memberships) {
      const circle = await ctx.db.get(m.circleId);
      if (!circle) continue;
      const members = await ctx.db
        .query("members")
        .withIndex("by_circle", (q) => q.eq("circleId", circle._id))
        .collect();
      const activities = await ctx.db
        .query("activities")
        .withIndex("by_circle", (q) => q.eq("circleId", circle._id))
        .collect();
      circles.push({
        id: circle._id,
        name: circle.name,
        inviteCode: circle.inviteCode,
        memberCount: members.length,
        activities: activities
          .filter((a) => !a.archived)
          .map((a) => ({ id: a._id, name: a.name, emoji: a.emoji, unit: a.unit, dailyTarget: a.dailyTarget })),
      });
    }
    return circles;
  },
});

// Kod może mieć myślnik, spacje i małe litery (wklejony z komunikatora).
function normalizeCode(raw: string): string {
  const code = raw.toUpperCase().replace(/[\s-]/g, "");
  if (code.length !== CODE_LENGTH || [...code].some((c) => !CODE_ALPHABET.includes(c))) fail("BAD_CODE");
  return code;
}

// Idempotentne: kolejne dołączenie tym samym kodem nie tworzy drugiego członka.
export const join = mutation({
  args: { secret: v.string(), code: v.string() },
  handler: async (ctx, { secret, code }) => {
    const user = await requireUser(ctx, secret);
    const inviteCode = normalizeCode(code);
    const circle = await ctx.db
      .query("circles")
      .withIndex("by_inviteCode", (q) => q.eq("inviteCode", inviteCode))
      .unique();
    if (!circle) fail("CIRCLE_NOT_FOUND");
    const existing = await ctx.db
      .query("members")
      .withIndex("by_circle_user", (q) => q.eq("circleId", circle._id).eq("userId", user._id))
      .unique();
    if (!existing) {
      await ctx.db.insert("members", { circleId: circle._id, userId: user._id, joinedAt: Date.now() });
    }
    const members = await ctx.db
      .query("members")
      .withIndex("by_circle", (q) => q.eq("circleId", circle._id))
      .collect();
    return { id: circle._id, name: circle.name, memberCount: members.length };
  },
});
