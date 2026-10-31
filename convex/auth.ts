import { ConvexError } from "convex/values";
import type { MutationCtx, QueryCtx } from "./_generated/server";

// Telefon losuje 32 bajty i wysyła je jako 64 znaki hex.
const SECRET_FORMAT = /^[0-9a-f]{64}$/;

export type ErrorCode = "BAD_SECRET" | "NOT_REGISTERED" | "BAD_NAME" | "CODE_GENERATION_FAILED" | "BAD_CODE" | "CIRCLE_NOT_FOUND" | "BAD_ACTIVITIES" | "NOT_A_MEMBER" | "BAD_DAY" | "BAD_VALUE" | "ACTIVITY_NOT_FOUND" | "NOTHING_TO_UNDO" | "BAD_CHORE" | "CHORE_NOT_FOUND";

export function fail(code: ErrorCode): never {
  throw new ConvexError({ code });
}

export async function hashSecret(secret: string): Promise<string> {
  if (!SECRET_FORMAT.test(secret)) fail("BAD_SECRET");
  const bytes = new TextEncoder().encode(secret);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
}

export async function findUser(ctx: QueryCtx | MutationCtx, secret: string) {
  const secretHash = await hashSecret(secret);
  return ctx.db
    .query("users")
    .withIndex("by_secretHash", (q) => q.eq("secretHash", secretHash))
    .unique();
}

// Każda funkcja poza register zaczyna od tego. Brak użytkownika = błąd, nie pusty wynik.
export async function requireUser(ctx: QueryCtx | MutationCtx, secret: string) {
  const user = await findUser(ctx, secret);
  if (!user) fail("NOT_REGISTERED");
  return user;
}
