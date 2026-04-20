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

// ─── Champion health bar tuning ────────────────────────────────────────────
// Priority-styled bar — wider than the main-game standard enemy bar
// (1.2 units) and ringed in gold so the player reads rivals as a
// priority target at a glance. Positioned above the class-mesh head
// line; billboarded toward the camera each frame.
const RIVAL_BAR_WIDTH = 1.8;       // wider than main-game's 1.2
const RIVAL_BAR_HEIGHT = 0.16;
const RIVAL_BAR_BORDER_INSET = 0.05;
const RIVAL_BAR_Y = 3.6;           // above the class mesh (~2.4 tall)

/** Dark-tint colour per rival kind. Chosen to desaturate + darken
 *  the base class palette while staying class-legible. */
const RIVAL_TINT: Record<string, THREE.Color> = {
  rival_warrior:     new THREE.Color("#3a0a0a"),  // dark crimson
  rival_mage:        new THREE.Color("#1a0535"),  // void purple
  rival_rogue:       new THREE.Color("#0a2818"),  // venomous green
  rival_necromancer: new THREE.Color("#0a3010"),  // sickly green-black
  rival_bard:        new THREE.Color("#2a1a05"),  // tarnished gold
};

/** Emissive tint — a subtle glow in the same family so the mesh
 *  reads as "corrupted" (not just dim). Intensity stays low so it
 *  doesn't wash out in bright scenes. */
const RIVAL_EMISSIVE: Record<string, THREE.Color> = {
  rival_warrior:     new THREE.Color("#660a0a"),
  rival_mage:        new THREE.Color("#300770"),
  rival_rogue:       new THREE.Color("#105030"),
  rival_necromancer: new THREE.Color("#20aa30"),
  rival_bard:        new THREE.Color("#aa8820"),
};

const DARKEN_FACTOR = 0.35;   // multiply original color by this
const TINT_BLEND    = 0.55;   // blend weight toward the rival tint
const EMISSIVE_INTENSITY = 0.35;

/** Map a rival enemy kind → the character class its mesh should
 *  borrow. The mapping is 1-1 by design. */
function classForRivalKind(kind: LabEnemy["kind"]): "warrior" | "mage" | "rogue" | "necromancer" | "bard" {
  if (kind === "rival_warrior") return "warrior";
  if (kind === "rival_mage") return "mage";
  if (kind === "rival_necromancer") return "necromancer";
  if (kind === "rival_bard") return "bard";
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

  // Health bar sits OUTSIDE the tinted group so the traverse above
  // doesn't repaint its gold border + red fill with the rival palette.
  return (
    <>
      <group ref={groupRef}>
        <Player3D gs={shimRef} />
      </group>
      <RivalHealthBar enemy={enemy} />
    </>
  );
}

/** Priority-target HP bar billboarded above a rival champion. Gold
 *  border frames the bar so it's visually distinct from the
 *  main-game standard-enemy bar (which has no border). Fill colour
 *  tints red-to-gold as HP drops — red at high HP (threat cue),
 *  gold at the 50% mark (progress), bright red at <25% (finisher). */
function RivalHealthBar({ enemy }: { enemy: LabEnemy }) {
  const groupRef = useRef<THREE.Group>(null);
  const fillRef = useRef<THREE.Mesh>(null);
  useFrame(({ camera }) => {
    if (!groupRef.current) return;
    // Track the live enemy position + keep the bar camera-facing so
    // it reads flat under the top-down view.
    groupRef.current.position.set(enemy.x, RIVAL_BAR_Y, enemy.z);
    groupRef.current.quaternion.copy(camera.quaternion);
    // Hide once dead so the husk doesn't keep a ghost bar floating.
    groupRef.current.visible = enemy.state !== "dead";
    // Update fill width + colour from live HP.
    if (fillRef.current) {
      const pct = Math.max(0, Math.min(1, enemy.hp / Math.max(1, enemy.maxHp)));
      const innerW = RIVAL_BAR_WIDTH - RIVAL_BAR_BORDER_INSET * 2;
      const w = innerW * pct;
      fillRef.current.scale.x = Math.max(0.0001, w / innerW);
      // Anchor to the left edge by offsetting by (w - innerW)/2.
      fillRef.current.position.x = (w - innerW) / 2;
      const mat = fillRef.current.material as THREE.MeshBasicMaterial;
      if (pct > 0.5) {
        mat.color.set("#ff3030");      // high-HP red — threat
      } else if (pct > 0.25) {
        mat.color.set("#ffb030");      // mid-HP gold — progress
      } else {
        mat.color.set("#ff6010");      // low-HP bright orange — finisher
      }
    }
  });
  return (
    <group ref={groupRef}>
      {/* Gold border — wider than the inner track so the rim reads
          as a frame around the bar. */}
      <mesh position={[0, 0, -0.002]}>
        <planeGeometry args={[RIVAL_BAR_WIDTH + 0.1, RIVAL_BAR_HEIGHT + 0.1]} />
        <meshBasicMaterial color="#ffc040" />
      </mesh>
      {/* Dark background track inside the gold border. */}
      <mesh position={[0, 0, -0.001]}>
        <planeGeometry args={[RIVAL_BAR_WIDTH, RIVAL_BAR_HEIGHT]} />
        <meshBasicMaterial color="#1a0005" />
      </mesh>
      {/* HP fill — scaled horizontally via ref each frame. Base width
          is the inner track minus the border inset; scale goes 0..1. */}
      <mesh ref={fillRef} position={[0, 0, 0]}>
        <planeGeometry args={[RIVAL_BAR_WIDTH - RIVAL_BAR_BORDER_INSET * 2, RIVAL_BAR_HEIGHT - RIVAL_BAR_BORDER_INSET * 2]} />
        <meshBasicMaterial color="#ff3030" />
      </mesh>
    </group>
  );
}
