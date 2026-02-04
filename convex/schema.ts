import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";
import { authTables } from "@convex-dev/auth/server";

// The schema is normally optional, but Convex Auth
// requires indexes defined on `authTables`.
// The schema provides more precise TypeScript types.
export default defineSchema({
  ...authTables,
  players: defineTable({
    userId: v.id("users"),
    x: v.number(),
    y: v.number(),
    money: v.number(),
    color: v.string(),
    lastSeen: v.number(),
  }).index("by_user", ["userId"]),

  resource_nodes: defineTable({
    type: v.string(), // "wood", "stone", "ore"
    x: v.number(),
    y: v.number(),
    depleted: v.boolean(),
    respawnAt: v.optional(v.number()),
  }).index("by_depleted", ["depleted"]),

  inventory: defineTable({
    userId: v.id("users"),
    resourceType: v.string(),
    amount: v.number(),
  }).index("by_user_resource", ["userId", "resourceType"]),

  market: defineTable({
    resourceType: v.string(),
    price: v.number(),
    basePrice: v.number(),
    volume: v.number(), // recent sales volume for price adjustment
  }).index("by_type", ["resourceType"]),

  chat: defineTable({
    userId: v.id("users"),
    userName: v.string(),
    message: v.string(),
    x: v.number(),
    y: v.number(),
    timestamp: v.number(),
  }).index("by_timestamp", ["timestamp"]),
});
