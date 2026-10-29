import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { fail, findUser, hashSecret, requireUser } from "./auth";

const MAX_NAME = 30;

function cleanName(raw: string): string {
  const name = raw.trim();
  if (name.length < 1 || name.length > MAX_NAME) fail("BAD_NAME");
  return name;
}

// Idempotentne: ten sam sekret zawsze daje tego samego użytkownika (imię można zmienić).
export const register = mutation({
  args: { secret: v.string(), name: v.string() },
  handler: async (ctx, { secret, name }) => {
    const cleaned = cleanName(name);
    const existing = await findUser(ctx, secret);
    if (existing) {
      if (existing.name !== cleaned) await ctx.db.patch(existing._id, { name: cleaned });
      return { id: existing._id, name: cleaned };
    }
    const id = await ctx.db.insert("users", {
      secretHash: await hashSecret(secret),
      name: cleaned,
      createdAt: Date.now(),
    });
    return { id, name: cleaned };
  },
});

export const me = query({
  args: { secret: v.string() },
  handler: async (ctx, { secret }) => {
    const user = await requireUser(ctx, secret);
    return { id: user._id, name: user.name };
  },
});
