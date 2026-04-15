/**
 * LabyrinthRivalChampion3D.tsx
 *
 * Renders a rival champion (rival_warrior / rival_mage / rival_rogue)
 * using the ACTUAL player-side class mesh from `src/entities/Player3D.tsx`.
 * No new assets are created — we reuse the procedural geometries
 * defined there by wrapping `<Player3D/>` with a synthetic GameState-
 * shaped shim pointed at the enemy's position/angle instead of the
 * real player's.
 *
 * After the mesh mounts, a useLayoutEffect walks the group and
 * mutates every MeshStandardMaterial to a corrupted dark variant
 * per the user's rival palette:
 *
 *   rival_warrior → dark crimson tint
 *   rival_mage    → dark void-purple tint
 *   rival_rogue   → dark venomous-green tint
 *
 * The darkening is multiplicative, so a light material goes dark-
 * tinted while a naturally dark material (e.g., cape black) becomes
 * near-black. The mesh silhouette + geometry stays identical so the
 * player still reads each rival as its class at a glance.
 *
 * Zero modifications to Player3D.tsx. The material mutation happens
 * on each mounted mesh's OWN material instance — JSX-created
 * meshStandardMaterials are per-instance, so this doesn't leak into
 * the actual player character.
 */

import { useLayoutEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { Player3D } from "../../entities/Player3D";
import type { GameState } from "../GameScene";
import type { EnemyRuntime as LabEnemy } from "./LabyrinthEnemy";
import { createPlayerShim } from "./LabyrinthShims";

/** Dark-tint colour per rival kind. Chosen to desaturate + darken
 *  the base class palette while staying class-legible. */
const RIVAL_TINT: Record<string, THREE.Color> = {
  rival_warrior: new THREE.Color("#3a0a0a"),  // dark crimson
  rival_mage:    new THREE.Color("#1a0535"),  // void purple
  rival_rogue:   new THREE.Color("#0a2818"),  // venomous green
};

/** Emissive tint — a subtle glow in the same family so the mesh
 *  reads as "corrupted" (not just dim). Intensity stays low so it
 *  doesn't wash out in bright scenes. */
const RIVAL_EMISSIVE: Record<string, THREE.Color> = {
  rival_warrior: new THREE.Color("#660a0a"),
  rival_mage:    new THREE.Color("#300770"),
  rival_rogue:   new THREE.Color("#105030"),
};

const DARKEN_FACTOR = 0.35;   // multiply original color by this
const TINT_BLEND    = 0.55;   // blend weight toward the rival tint
const EMISSIVE_INTENSITY = 0.35;

/** Map a rival enemy kind → the character class its mesh should
 *  borrow. The mapping is 1-1 by design. */
function classForRivalKind(kind: LabEnemy["kind"]): "warrior" | "mage" | "rogue" {
  if (kind === "rival_warrior") return "warrior";
  if (kind === "rival_mage") return "mage";
  return "rogue";
}

export function LabyrinthRivalChampions3D({ enemies }: { enemies: readonly LabEnemy[] }) {
  return (
    <>
      {enemies.map((e) => (
        <RivalChampion3D key={e.id} enemy={e} />
      ))}
    </>
  );
}

function RivalChampion3D({ enemy }: { enemy: LabEnemy }) {
  const groupRef = useRef<THREE.Group>(null);
  // Stable synthetic GameState shim — one per rival instance. Built
  // once on mount; each frame we mutate the nested `player` fields
  // to mirror the enemy's pose so `<Player3D/>`'s useFrame animates
  // around the enemy's world position.
  const shimRef = useRef<GameState | null>(null);
  if (!shimRef.current) shimRef.current = createPlayerShim(classForRivalKind(enemy.kind));

  // Seed initial pose so the first render isn't at (0, 0).
  useMemo(() => {
    const shim = shimRef.current;
    if (!shim) return;
    shim.player.x = enemy.x;
    shim.player.z = enemy.z;
    shim.player.angle = enemy.angle;
    shim.player.hp = enemy.hp;
    shim.player.maxHp = enemy.maxHp;
  }, [enemy]);

  // Apply dark-tint traversal once after mount. Per-instance
  // material mutation — safe because JSX meshStandardMaterials are
  // per-mount, so this doesn't leak to the real player character.
  useLayoutEffect(() => {
    if (!groupRef.current) return;
    const tint = RIVAL_TINT[enemy.kind] ?? new THREE.Color("#333333");
    const emissive = RIVAL_EMISSIVE[enemy.kind] ?? new THREE.Color("#111111");
    groupRef.current.traverse((obj) => {
      const mesh = obj as THREE.Mesh;
      if (!mesh.isMesh) return;
      const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
      for (const m of mats) {
        if (m instanceof THREE.MeshStandardMaterial) {
          // Darken the base colour, then blend toward the rival tint.
          m.color.multiplyScalar(DARKEN_FACTOR);
          m.color.lerp(tint, TINT_BLEND);
          m.emissive.copy(emissive);
          m.emissiveIntensity = EMISSIVE_INTENSITY;
          // Desaturate slightly so it feels cursed rather than painted.
          const hsl = { h: 0, s: 0, l: 0 };
          m.color.getHSL(hsl);
          m.color.setHSL(hsl.h, Math.max(0, hsl.s * 0.55), hsl.l);
        } else if (m instanceof THREE.MeshBasicMaterial) {
          m.color.multiplyScalar(DARKEN_FACTOR);
          m.color.lerp(tint, TINT_BLEND);
        }
      }
    });
  }, [enemy.kind]);

  // Per-frame sync of the shim's pose from the authoritative enemy.
  useFrame(() => {
    const shim = shimRef.current;
    if (!shim) return;
    shim.player.x = enemy.x;
    shim.player.z = enemy.z;
    shim.player.angle = enemy.angle;
    shim.player.hp = enemy.hp;
    shim.player.maxHp = enemy.maxHp;
    // Mark as dashing when the rival's ability-active window is
    // open — that triggers the Player3D dash-pose code path (vapor
    // trail for rogue, ghostly streak for mage blink).
    shim.player.isDashing = (enemy.rival?.activeSec ?? 0) > 0;
  });

  return (
    <group ref={groupRef}>
      <Player3D gs={shimRef} />
    </group>
  );
}
