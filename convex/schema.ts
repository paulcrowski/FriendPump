import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  // "Konto" = sekret zapisany w telefonie. W bazie jest tylko jego hash.
  users: defineTable({
    secretHash: v.string(),
    name: v.string(),
    createdAt: v.number(),
  }).index("by_secretHash", ["secretHash"]),

  circles: defineTable({
    name: v.string(),
    inviteCode: v.string(), // 8 znaków bez mylących liter, bez myślnika
    createdBy: v.id("users"),
    createdAt: v.number(),
  }).index("by_inviteCode", ["inviteCode"]),

  members: defineTable({
    circleId: v.id("circles"),
    userId: v.id("users"),
    joinedAt: v.number(),
  })
    .index("by_circle", ["circleId"])
    .index("by_user", ["userId"])
    .index("by_circle_user", ["circleId", "userId"]),

  activities: defineTable({
    circleId: v.id("circles"),
    name: v.string(),
    emoji: v.string(),
    unit: v.union(v.literal("count"), v.literal("minutes"), v.literal("done")),
    dailyTarget: v.number(),
    archived: v.boolean(),
  }).index("by_circle", ["circleId"]),

  // day = "YYYY-MM-DD" w czasie lokalnym telefonu.
  checkins: defineTable({
    activityId: v.id("activities"),
    circleId: v.id("circles"),
    userId: v.id("users"),
    day: v.string(),
    value: v.number(),
    createdAt: v.number(),
  })
    .index("by_activity_day", ["activityId", "day"])
    .index("by_activity_user_day", ["activityId", "userId", "day"])
    .index("by_circle_day", ["circleId", "day"]),
});
