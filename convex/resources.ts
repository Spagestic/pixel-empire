import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";

export const list = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("resource_nodes").collect();
  },
});

export const collect = mutation({
  args: { nodeId: v.id("resource_nodes") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const player = await ctx.db
      .query("players")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .unique();
    if (!player) throw new Error("Player not found");

    const node = await ctx.db.get(args.nodeId);
    if (!node || node.depleted) throw new Error("Node not available");

    // Proximity check (optional but good for server-side auth)
    const dist = Math.sqrt(Math.pow(player.x - node.x, 2) + Math.pow(player.y - node.y, 2));
    if (dist > 5) throw new Error("Too far away");

    // Update node
    await ctx.db.patch(args.nodeId, {
      depleted: true,
      respawnAt: Date.now() + 30000, // 30 seconds respawn
    });

    // Update inventory
    const existing = await ctx.db
      .query("inventory")
      .withIndex("by_user_resource", (q) =>
        q.eq("userId", userId).eq("resourceType", node.type)
      )
      .unique();

    if (existing) {
      await ctx.db.patch(existing._id, { amount: existing.amount + 1 });
    } else {
      await ctx.db.insert("inventory", {
        userId,
        resourceType: node.type,
        amount: 1,
      });
    }
  },
});

export const respawn = mutation({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();
    const depletedNodes = await ctx.db
      .query("resource_nodes")
      .withIndex("by_depleted", (q) => q.eq("depleted", true))
      .collect();

    for (const node of depletedNodes) {
      if (node.respawnAt && node.respawnAt <= now) {
        await ctx.db.patch(node._id, {
          depleted: false,
          respawnAt: undefined,
        });
      }
    }
  },
});
