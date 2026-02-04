import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";

export const getPrices = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("market").collect();
  },
});

export const sell = mutation({
  args: { resourceType: v.string(), amount: v.number() },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const inventory = await ctx.db
      .query("inventory")
      .withIndex("by_user_resource", (q) =>
        q.eq("userId", userId).eq("resourceType", args.resourceType)
      )
      .unique();

    if (!inventory || inventory.amount < args.amount) {
      throw new Error("Insufficient resources");
    }

    const marketItem = await ctx.db
      .query("market")
      .withIndex("by_type", (q) => q.eq("resourceType", args.resourceType))
      .unique();
    if (!marketItem) throw new Error("Resource not traded on market");

    const totalSale = marketItem.price * args.amount;

    // Update player money
    const player = await ctx.db
      .query("players")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .unique();
    if (!player) throw new Error("Player not found");

    await ctx.db.patch(player._id, { money: player.money + totalSale });

    // Update inventory
    await ctx.db.patch(inventory._id, { amount: inventory.amount - args.amount });

    // Update market volume (for price adjustment later)
    await ctx.db.patch(marketItem._id, {
      volume: marketItem.volume + args.amount,
    });
  },
});

export const adjustPrices = mutation({
  args: {},
  handler: async (ctx) => {
    const marketItems = await ctx.db.query("market").collect();
    for (const item of marketItems) {
      // Mild supply/demand: price decreases 5% per unit sold in the last interval
      // but also recovers towards basePrice if volume is low.

      let priceChange = 1.0;
      if (item.volume > 0) {
        // Price decreases with volume
        priceChange = Math.max(0.5, 1 - (item.volume * 0.05));
      } else {
        // Price slowly recovers towards basePrice if no one is selling
        if (item.price < item.basePrice) {
          priceChange = 1.05; // 5% recovery
        }
      }

      let newPrice = item.price * priceChange;

      // Clamp to reasonable range (50% to 150% of base price)
      newPrice = Math.max(item.basePrice * 0.5, Math.min(item.basePrice * 1.5, newPrice));

      // Reset volume for next interval
      await ctx.db.patch(item._id, {
        price: Math.round(newPrice),
        volume: 0,
      });
    }
  },
});

export const getLeaderboard = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db
      .query("players")
      .order("desc")
      // Net worth = money + (assets? maybe just money for now)
      .take(10);
  },
});
