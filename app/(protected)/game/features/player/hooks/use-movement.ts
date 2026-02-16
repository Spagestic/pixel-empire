import { useEffect, useRef, useState, useCallback } from "react";
import { Property } from "@game/types/property";
import {
  MAP_SIZE,
  HUNGER_SLOW_THRESHOLD,
  getZoneAt,
  ZONES,
  WATER_LINE_Y,
  TREE_GROWTH_STAGES,
  type TreeGrowthStage,
} from "@game/shared/contracts/game-config";
import { useKeysPressed, isControlPressed } from "./use-keyboard";
import type { Tree } from "@game/types/tree";

const BASE_SPEED = 5;
const SYNC_INTERVAL = 100;
const TICK_RATE = 16;
const PLAYER_HITBOX = 40;

interface UseMovementOptions {
  initialPos: { x: number; y: number };
  properties: Property[];
  trees?: Tree[];
  onSync: (pos: { x: number; y: number }) => void;
  hunger?: number;
}

export function useMovement({
  initialPos,
  properties,
  trees = [],
  onSync,
  hunger = 100,
}: UseMovementOptions) {
  const [renderPos, setRenderPos] = useState(initialPos);
  const localPos = useRef(initialPos);
  const keys = useKeysPressed();
  const lastSync = useRef(0);
  const propertiesRef = useRef<Property[]>([]);
  const treesRef = useRef<Tree[]>([]);
  const hungerRef = useRef(hunger);
  const movementLockedRef = useRef(false);

  useEffect(() => {
    propertiesRef.current = properties;
  }, [properties]);

  useEffect(() => {
    treesRef.current = trees;
  }, [trees]);

  useEffect(() => {
    hungerRef.current = hunger;
  }, [hunger]);

  useEffect(() => {
    const onMovementLock = (event: Event) => {
      const customEvent = event as CustomEvent<{ locked?: boolean }>;
      movementLockedRef.current = Boolean(customEvent.detail?.locked);
    };

    window.addEventListener("game:set-movement-locked", onMovementLock);

    return () => {
      movementLockedRef.current = false;
      window.removeEventListener("game:set-movement-locked", onMovementLock);
    };
  }, []);

  const resetPosition = useCallback((pos: { x: number; y: number }) => {
    localPos.current = { ...pos };
    setRenderPos({ ...pos });
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      if (movementLockedRef.current) return;

      const h = hungerRef.current;
      const hungerMultiplier =
        h < HUNGER_SLOW_THRESHOLD
          ? 0.5 + (h / HUNGER_SLOW_THRESHOLD) * 0.5
          : 1.0;

      const currentZoneId = getZoneAt(localPos.current.x, localPos.current.y);
      const zoneMultiplier = ZONES[currentZoneId].speedMultiplier;

      const speed = Math.max(
        1,
        Math.round(BASE_SPEED * hungerMultiplier * zoneMultiplier),
      );

      let dx = 0;
      let dy = 0;

      if (isControlPressed(keys, "move_up")) dy -= speed;
      if (isControlPressed(keys, "move_down")) dy += speed;
      if (isControlPressed(keys, "move_left")) dx -= speed;
      if (isControlPressed(keys, "move_right")) dx += speed;

      if (dx === 0 && dy === 0) return;

      if (dx !== 0 && dy !== 0) {
        const factor = speed / Math.sqrt(dx * dx + dy * dy);
        dx = Math.round(dx * factor);
        dy = Math.round(dy * factor);
      }

      let newX = localPos.current.x + dx;
      let newY = localPos.current.y + dy;

      newX = Math.max(0, Math.min(MAP_SIZE, newX));
      newY = Math.max(0, Math.min(MAP_SIZE, newY));

      const halfSize = PLAYER_HITBOX / 2;
      const playerBottom = newY + halfSize;
      if (playerBottom > WATER_LINE_Y) {
        newY = WATER_LINE_Y - halfSize;
      }

      const pLeft = newX - halfSize;
      const pTop = newY - halfSize;

      const collides = propertiesRef.current.some(
        (prop) =>
          pLeft < prop.x + prop.width &&
          pLeft + PLAYER_HITBOX > prop.x &&
          pTop < prop.y + prop.height &&
          pTop + PLAYER_HITBOX > prop.y,
      );

      if (collides) return;

      const treeCollides = treesRef.current.some((tree) => {
        const stage =
          TREE_GROWTH_STAGES[tree.growthStage as TreeGrowthStage] ??
          TREE_GROWTH_STAGES.seedling;
        const radius = stage.size / 2;

        const rx1 = pLeft;
        const ry1 = pTop;
        const rx2 = pLeft + PLAYER_HITBOX;
        const ry2 = pTop + PLAYER_HITBOX;

        const cx = Math.max(rx1, Math.min(tree.x, rx2));
        const cy = Math.max(ry1, Math.min(tree.y, ry2));

        const dx = tree.x - cx;
        const dy = tree.y - cy;
        return dx * dx + dy * dy <= radius * radius;
      });

      if (treeCollides) return;

      localPos.current.x = newX;
      localPos.current.y = newY;

      setRenderPos({ x: localPos.current.x, y: localPos.current.y });

      const now = Date.now();
      if (now - lastSync.current > SYNC_INTERVAL) {
        onSync({ x: localPos.current.x, y: localPos.current.y });
        lastSync.current = now;
      }
    }, TICK_RATE);

    return () => clearInterval(interval);
  }, [onSync, keys]);

  return { renderPos, resetPosition };
}
