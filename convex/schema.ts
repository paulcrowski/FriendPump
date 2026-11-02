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
    // Krąg osobisty ("Moje sprawy"): jedna osoba, nie pokazuje się na liście kręgów, nie da się do niego dołączyć kodem.
    personalFor: v.optional(v.id("users")),
    // Krąg otwarty (klucz z katalogu w groups.ts): bez kodu, bez widoku członków, tylko liczniki.
    openKey: v.optional(v.string()),
  })
    .index("by_inviteCode", ["inviteCode"])
    .index("by_personalFor", ["personalFor"])
    .index("by_openKey", ["openKey"]),

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
    // Czynność cykliczna: co N miesięcy zamiast codziennie (unit = "done", dailyTarget = 1).
    // firstDue = termin domyślny dla każdego członka, dopóki nie zrobi jej pierwszy raz.
    everyMonths: v.optional(v.number()),
    firstDue: v.optional(v.string()),
  }).index("by_circle", ["circleId"]),

  // Termin członka dla czynności cyklicznej. Brak wiersza = obowiązuje firstDue czynności.
  memberDues: defineTable({
    activityId: v.id("activities"),
    userId: v.id("users"),
    nextDue: v.string(),
    lastDone: v.optional(v.string()),
  }).index("by_activity_user", ["activityId", "userId"]),

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

  // Licznik dzielony na shardy, żeby tysiące równoczesnych zapisów nie biły w jeden dokument.
  // kind = "members" albo "done:<okres>". Wartość = suma n po shardach.
  groupCounters: defineTable({
    groupKey: v.string(),
    kind: v.string(),
    shard: v.number(),
    n: v.number(),
  }).index("by_group_kind_shard", ["groupKey", "kind", "shard"]),
});
