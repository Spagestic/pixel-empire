import { mutation } from "./_generated/server";
import { v } from "convex/values";

export const seed = mutation({
  args: {},
  handler: async (ctx) => {
    // Check if market exists
    const marketItems = await ctx.db.query("market").collect();
    if (marketItems.length === 0) {
      const resources = [
        { type: "wood", price: 10, basePrice: 10 },
        { type: "stone", price: 25, basePrice: 25 },
        { type: "ore", price: 60, basePrice: 60 },
      ];
      for (const res of resources) {
        await ctx.db.insert("market", {
          resourceType: res.type,
          price: res.price,
          basePrice: res.basePrice,
          volume: 0,
        });
      }
    }

    // Check if resource nodes exist
    const nodes = await ctx.db.query("resource_nodes").collect();
    if (nodes.length === 0) {
      // Seed some resource nodes
      const types = ["wood", "stone", "ore"];
      for (let i = 0; i < 50; i++) {
        const type = types[Math.floor(Math.random() * types.length)];
        await ctx.db.insert("resource_nodes", {
          type,
          x: Math.floor(Math.random() * 100),
          y: Math.floor(Math.random() * 100),
          depleted: false,
        });
      }
    }
  },
});
