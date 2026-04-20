/**
 * LabyrinthEnemy3D.tsx
 *
 * Renders labyrinth enemies by delegating to the main game's `Enemy3D`
 * component — so Corridor Guardians look like Voidclaw Champions
 * (`elite` type) using the same walk cycles, attack wind-ups, death
 * animations, and hit flashes the main game ships with.
 *
 * How it works:
 *   - We keep a shim `EnemyRuntime` (main-game shape) per live LabEnemy.
 *   - Every frame, `updateEnemyShim` copies the labyrinth's AI-side
 *     position / velocity / HP / flash timer into the shim.
 *   - `<Enemy3D enemy={shim} />` reads the shim and draws the figure.
 *
 * The shim map is keyed by enemy id so that new spawns and evictions
 * (eg. on death eviction in the scene's CombatEnemyLoop) are picked up
 * automatically without tearing down other enemies' animation state.
 */

import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { Enemy3D } from "../../entities/Enemy3D";
import type { EnemyRuntime as CoreEnemyRuntime } from "../GameScene";
import type { EnemyRuntime as LabEnemy } from "./LabyrinthEnemy";
import { STALKER_REVEAL_DIST } from "./LabyrinthEnemy";
import { createEnemyShim, updateEnemyShim } from "./LabyrinthShims";
import { LabyrinthRivalChampions3D } from "./LabyrinthRivalChampion3D";

/** Rival kinds bypass the main-game Enemy3D shim and render via the
 *  labyrinth-local class-mesh renderer. Split here so each call site
 *  only sees its own enemies. */
function isRivalKind(kind: LabEnemy["kind"]): boolean {
  return kind === "rival_warrior" || kind === "rival_mage" || kind === "rival_rogue" || kind === "rival_necromancer" || kind === "rival_bard";
}

/** Minimal duck-typed player shape the stalker phasing check needs. */
interface PlayerPositionRef {
  current: { x: number; z: number };
}

export function LabyrinthEnemies3D({
  enemies,
  playerRef,
  layer = 1,
}: {
  enemies: readonly LabEnemy[];
  playerRef: PlayerPositionRef;
  layer?: number;
}) {
  // Split enemies: non-rivals go through the main-game Enemy3D shim;
  // rivals render via LabyrinthRivalChampion3D (class-mesh reuse).
  const nonRivals = useMemo(() => enemies.filter((e) => !isRivalKind(e.kind)), [enemies]);
  const rivals    = useMemo(() => enemies.filter((e) =>  isRivalKind(e.kind)), [enemies]);

  // Shim map keyed by enemy id — stable across frames so Enemy3D's
  // internal animation refs don't reset on every re-render.
  const shimsRef = useRef<Map<string, CoreEnemyRuntime>>(new Map());

  // Derive the current shim array from the non-rival enemy list.
  const shimList = useMemo(() => {
    const map = shimsRef.current;
    const seen = new Set<string>();
    const out: CoreEnemyRuntime[] = [];
    for (const lab of nonRivals) {
      seen.add(lab.id);
      let shim = map.get(lab.id);
      if (!shim) {
        shim = createEnemyShim(lab, layer);
        map.set(lab.id, shim);
      }
      out.push(shim);
    }
    for (const id of Array.from(map.keys())) {
      if (!seen.has(id)) map.delete(id);
    }
    return out;
  }, [nonRivals]);

  // Per-frame sync of every non-rival shim from the authoritative LabEnemy.
  useFrame(() => {
    const p = playerRef.current;
    for (const lab of nonRivals) {
      const shim = shimsRef.current.get(lab.id);
      if (shim) updateEnemyShim(shim, lab, p.x, p.z, STALKER_REVEAL_DIST);
    }
  });

  return (
    <>
      {shimList.map((shim) => (
        <Enemy3D key={shim.id} enemy={shim} />
      ))}
      <LabyrinthRivalChampions3D enemies={rivals} />
    </>
  );
}
