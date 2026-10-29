import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  // "Konto" = sekret zapisany w telefonie. W bazie jest tylko jego hash.
  users: defineTable({
    secretHash: v.string(),
    name: v.string(),
    createdAt: v.number(),
  }).index("by_secretHash", ["secretHash"]),
});
