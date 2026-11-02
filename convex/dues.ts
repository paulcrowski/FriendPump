import { v } from "convex/values";
import { query } from "./_generated/server";
import { requireUser } from "./auth";

// Wszystkie moje czynności cykliczne ze wszystkich kręgów (też osobistego), z moim terminem.
// Z tego telefon planuje przypomnienia: jedno źródło prawdy o terminach.
export const mine = query({
  args: { secret: v.string() },
  handler: async (ctx, { secret }) => {
    const user = await requireUser(ctx, secret);
    const memberships = await ctx.db.query("members").withIndex("by_user", (q) => q.eq("userId", user._id)).collect();
    const out = [];
    for (const m of memberships) {
      const circle = await ctx.db.get(m.circleId);
      if (!circle) continue;
      const activities = await ctx.db.query("activities").withIndex("by_circle", (q) => q.eq("circleId", circle._id)).collect();
      for (const a of activities) {
        if (a.archived || !a.everyMonths) continue;
        const row = await ctx.db.query("memberDues").withIndex("by_activity_user", (q) => q.eq("activityId", a._id).eq("userId", user._id)).unique();
        const nextDue = row?.nextDue ?? a.firstDue;
        if (nextDue) out.push({ id: a._id, circleId: circle._id, circleName: circle.name, openKey: circle.openKey ?? null, name: a.name, emoji: a.emoji, nextDue });
      }
    }
    return out.sort((x, y) => (x.nextDue < y.nextDue ? -1 : x.nextDue > y.nextDue ? 1 : 0));
  },
});
