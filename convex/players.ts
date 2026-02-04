import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";

export const join = mutation({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const player = await ctx.db
      .query("players")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .unique();

    if (player) {
      await ctx.db.patch(player._id, { lastSeen: Date.now() });
      return player._id;
    }

    const colors = ["#FF0000", "#00FF00", "#0000FF", "#FFFF00", "#FF00FF", "#00FFFF"];
    const color = colors[Math.floor(Math.random() * colors.length)];

    return await ctx.db.insert("players", {
      userId,
      x: 50,
      y: 50,
      money: 100,
      color,
      lastSeen: Date.now(),
    });
  },
});

export const updatePosition = mutation({
  args: { x: v.number(), y: v.number() },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const player = await ctx.db
      .query("players")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .unique();

    if (!player) throw new Error("Player not found");

    await ctx.db.patch(player._id, {
      x: args.x,
      y: args.y,
      lastSeen: Date.now(),
    });
  },
});

export const list = query({
  args: {},
  handler: async (ctx) => {
    // Return players active in the last 10 minutes
    const tenMinutesAgo = Date.now() - 10 * 60 * 1000;
    return await ctx.db
      .query("players")
      .filter((q) => q.gt(q.field("lastSeen"), tenMinutesAgo))
      .collect();
  },
});

export const me = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return null;

    return await ctx.db
      .query("players")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .unique();
  },
});

export const getInventory = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];

    return await ctx.db
      .query("inventory")
      .withIndex("by_user_resource", (q) => q.eq("userId", userId))
      .collect();
  },
});
