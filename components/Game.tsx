"use client";

import { useEffect, useRef, useState } from "react";
import * as PIXI from "pixi.js";
import { useMutation, useQuery } from "convex/react";
import { api } from "../convex/_generated/api";

const TILE_SIZE = 32;
const MAP_SIZE = 100;

export default function Game() {
  const containerRef = useRef<HTMLDivElement>(null);
  const appRef = useRef<PIXI.Application | null>(null);
  const playersContainerRef = useRef<PIXI.Container | null>(null);
  const resourcesContainerRef = useRef<PIXI.Container | null>(null);
  const playerSpritesRef = useRef<Map<string, { sprite: PIXI.Sprite, text: PIXI.Text }>>(new Map());
  const resourceSpritesRef = useRef<Map<string, PIXI.Sprite>>(new Map());

  const me = useQuery(api.players.me);
  const players = useQuery(api.players.list) || [];
  const resources = useQuery(api.resources.list) || [];
  const marketPrices = useQuery(api.market.getPrices) || [];
  const inventory = useQuery(api.players.getInventory) || [];
  const leaderboard = useQuery(api.market.getLeaderboard) || [];

  const updatePosition = useMutation(api.players.updatePosition);
  const join = useMutation(api.players.join);
  const collect = useMutation(api.resources.collect);
  const sell = useMutation(api.market.sell);
  const seed = useMutation(api.init.seed);

  const [hasJoined, setHasJoined] = useState(false);
  const [showMarket, setShowMarket] = useState(false);
  const [showLeaderboard, setShowLeaderboard] = useState(false);
  const seededRef = useRef(false);

  // Initialize Seed
  useEffect(() => {
    if (!seededRef.current) {
        seed();
        seededRef.current = true;
    }
  }, [seed]);

  // Join the game
  useEffect(() => {
    if (me === null && !hasJoined) {
      join().then(() => setHasJoined(true));
    } else if (me && !hasJoined) {
      setHasJoined(true);
    }
  }, [me, join, hasJoined]);

  // Initialize PixiJS
  useEffect(() => {
    if (!containerRef.current) return;

    const app = new PIXI.Application();

    async function initApp() {
        await app.init({
            width: 800,
            height: 600,
            backgroundColor: 0x2d5a27, // Dark grass green
            resolution: window.devicePixelRatio || 1,
        });
        containerRef.current?.appendChild(app.canvas);
        appRef.current = app;

        // Load assets
        await PIXI.Assets.load([
            { alias: 'player', src: 'https://pixijs.com/assets/bunny.png' },
            { alias: 'wood', src: 'https://pixijs.com/assets/flowerTop.png' },
            { alias: 'stone', src: 'https://pixijs.com/assets/eggHead.png' },
            { alias: 'ore', src: 'https://pixijs.com/assets/p2.jpeg' },
        ]);

        const world = new PIXI.Container();
        app.stage.addChild(world);

        // Grid/Map Background
        const grid = new PIXI.Graphics();
        for (let i = 0; i <= MAP_SIZE; i++) {
            grid.moveTo(i * TILE_SIZE, 0);
            grid.lineTo(i * TILE_SIZE, MAP_SIZE * TILE_SIZE);
            grid.moveTo(0, i * TILE_SIZE);
            grid.lineTo(MAP_SIZE * TILE_SIZE, i * TILE_SIZE);
        }
        grid.stroke({ width: 1, color: 0x3d7a37, alpha: 0.5 });
        world.addChild(grid);

        const resourcesLayer = new PIXI.Container();
        world.addChild(resourcesLayer);
        resourcesContainerRef.current = resourcesLayer;

        const playersLayer = new PIXI.Container();
        world.addChild(playersLayer);
        playersContainerRef.current = playersLayer;
    }

    initApp();

    return () => {
      app.destroy(true, { children: true, texture: true });
    };
  }, []);

  // Handle Movement
  useEffect(() => {
    if (!me) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      let newX = me.x;
      let newY = me.y;
      const speed = 1;

      if (e.key === "w" || e.key === "ArrowUp") newY -= speed;
      if (e.key === "s" || e.key === "ArrowDown") newY += speed;
      if (e.key === "a" || e.key === "ArrowLeft") newX -= speed;
      if (e.key === "d" || e.key === "ArrowRight") newX += speed;

      if (newX !== me.x || newY !== me.y) {
        // Clamp to map
        newX = Math.max(0, Math.min(MAP_SIZE - 1, newX));
        newY = Math.max(0, Math.min(MAP_SIZE - 1, newY));
        updatePosition({ x: newX, y: newY });
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [me, updatePosition]);

  // Render Players
  useEffect(() => {
    const layer = playersContainerRef.current;
    if (!layer || !appRef.current) return;

    const currentIds = new Set<string>(players.map(p => p._id));

    // Remove old players
    for (const [id, { sprite, text }] of playerSpritesRef.current.entries()) {
      if (!currentIds.has(id)) {
        layer.removeChild(sprite);
        layer.removeChild(text);
        playerSpritesRef.current.delete(id);
      }
    }

    // Add or update players
    players.forEach((p) => {
      let entry = playerSpritesRef.current.get(p._id);
      if (!entry) {
        const sprite = PIXI.Sprite.from('player');
        sprite.width = TILE_SIZE * 0.8;
        sprite.height = TILE_SIZE * 0.8;

        const text = new PIXI.Text({
          text: p._id === me?._id ? "You" : "Player",
          style: {
            fontSize: 12,
            fill: 0xffffff,
          }
        });

        layer.addChild(sprite);
        layer.addChild(text);
        entry = { sprite, text };
        playerSpritesRef.current.set(p._id, entry);
      }

      const { sprite, text } = entry;
      sprite.tint = p.color;
      sprite.x = p.x * TILE_SIZE + TILE_SIZE * 0.1;
      sprite.y = p.y * TILE_SIZE + TILE_SIZE * 0.1;
      text.x = sprite.x;
      text.y = sprite.y - 15;
    });

    // Camera follow me
    if (me && appRef.current.stage.children[0]) {
        const world = appRef.current.stage.children[0] as PIXI.Container;
        world.x = -me.x * TILE_SIZE + 400 - TILE_SIZE / 2;
        world.y = -me.y * TILE_SIZE + 300 - TILE_SIZE / 2;
    }
  }, [players, me]);

  // Render Resources
  useEffect(() => {
    const layer = resourcesContainerRef.current;
    if (!layer) return;

    const currentIds = new Set<string>(resources.filter(r => !r.depleted).map(r => r._id));

    // Remove old or depleted resources
    for (const [id, sprite] of resourceSpritesRef.current.entries()) {
      if (!currentIds.has(id)) {
        layer.removeChild(sprite);
        resourceSpritesRef.current.delete(id);
      }
    }

    // Add new resources
    resources.forEach((r) => {
      if (r.depleted) return;
      if (resourceSpritesRef.current.has(r._id)) return;

      let texture = 'wood';
      if (r.type === "stone") texture = 'stone';
      if (r.type === "ore") texture = 'ore';

      const sprite = PIXI.Sprite.from(texture);
      sprite.width = TILE_SIZE * 0.8;
      sprite.height = TILE_SIZE * 0.8;
      sprite.x = r.x * TILE_SIZE + TILE_SIZE * 0.1;
      sprite.y = r.y * TILE_SIZE + TILE_SIZE * 0.1;

      sprite.eventMode = 'static';
      sprite.cursor = 'pointer';
      sprite.on('pointerdown', () => {
        collect({ nodeId: r._id }).catch(err => alert(err.message));
      });

      layer.addChild(sprite);
      resourceSpritesRef.current.set(r._id, sprite);
    });
  }, [resources, collect]);

  if (!me) return <div>Loading player...</div>;

  return (
    <div className="relative flex flex-col items-center">
      <div className="mb-4 flex gap-4 bg-slate-800 p-4 rounded-lg text-white shadow-lg">
        <div>💰 Money: ${me.money}</div>
        <div className="flex gap-2">
          📦 Inventory:
          {inventory.map(i => (
            <span key={i.resourceType} className="bg-slate-700 px-2 py-1 rounded text-xs">
              {i.resourceType}: {i.amount}
            </span>
          ))}
          {inventory.length === 0 && " Empty"}
        </div>
      </div>

      <div ref={containerRef} className="border-4 border-slate-700 rounded-lg overflow-hidden shadow-2xl" />

      <div className="mt-4 flex gap-4">
        <button
          onClick={() => setShowMarket(!showMarket)}
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded font-bold transition"
        >
          🏪 Market
        </button>
        <button
          onClick={() => setShowLeaderboard(!showLeaderboard)}
          className="bg-yellow-600 hover:bg-yellow-700 text-white px-4 py-2 rounded font-bold transition"
        >
          🏆 Leaderboard
        </button>
      </div>

      {showMarket && (
        <div className="absolute top-20 left-1/2 -translate-x-1/2 bg-white dark:bg-slate-900 p-6 rounded-xl shadow-2xl border border-slate-200 dark:border-slate-700 w-80">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-bold">Global Market</h2>
            <button onClick={() => setShowMarket(false)}>✕</button>
          </div>
          <div className="space-y-4">
            {marketPrices.map(item => {
              const inv = inventory.find(i => i.resourceType === item.resourceType);
              return (
                <div key={item.resourceType} className="flex justify-between items-center border-b pb-2">
                  <div>
                    <div className="font-bold capitalize">{item.resourceType}</div>
                    <div className="text-sm text-green-600 font-mono">${item.price}</div>
                  </div>
                  <button
                    disabled={!inv || inv.amount <= 0}
                    onClick={() => sell({ resourceType: item.resourceType, amount: 1 })}
                    className="bg-green-500 hover:bg-green-600 disabled:bg-slate-300 text-white px-3 py-1 rounded text-sm"
                  >
                    Sell 1
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {showLeaderboard && (
        <div className="absolute top-20 left-1/2 -translate-x-1/2 bg-white dark:bg-slate-900 p-6 rounded-xl shadow-2xl border border-slate-200 dark:border-slate-700 w-80">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-bold">Rich List</h2>
            <button onClick={() => setShowLeaderboard(false)}>✕</button>
          </div>
          <div className="space-y-2">
            {leaderboard.map((p, i) => (
              <div key={p._id} className="flex justify-between items-center">
                <span>{i+1}. {p._id === me._id ? <strong>You</strong> : "Player"}</span>
                <span className="font-mono text-yellow-600">${p.money}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="mt-8 text-slate-500 text-sm">
        Use WASD or Arrow Keys to move. Click resource circles to collect.
      </div>
    </div>
  );
}
