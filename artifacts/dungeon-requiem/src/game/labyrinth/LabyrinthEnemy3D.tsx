/**
 * LabyrinthEnemy3D.tsx
 *
 * Procedural enemy renderer for the Labyrinth. No external assets —
 * geometry + color only. Each enemy is a simple figure (body + head)
 * with a world-space health bar billboarded to face the camera.
 *
 * Corridor Guardians render as a dark blood-red humanoid with a red
 * crest glow — reads as hostile at a glance from top-down.
 *
 * Dead enemies fade out over ENEMY_DEATH_FADE_SEC, then get filtered
 * out of the enemies list by the scene (see isEnemyEvictable).
 */

import { useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import {
  ENEMY_DEATH_FADE_SEC,
  type EnemyRuntime,
} from "./LabyrinthEnemy";

/** Single enemy renderer. The parent mounts/unmounts by EnemyRuntime.id. */
export function LabyrinthEnemy3D({ enemy }: { enemy: EnemyRuntime }) {
  const rootRef = useRef<THREE.Group>(null);
  const bodyMatRef = useRef<THREE.MeshStandardMaterial>(null);
  const headMatRef = useRef<THREE.MeshStandardMaterial>(null);
  const crestMatRef = useRef<THREE.MeshBasicMaterial>(null);

  const hpBarGroupRef = useRef<THREE.Group>(null);
  const hpFillRef = useRef<THREE.Mesh>(null);

  const { camera } = useThree();

  useFrame(() => {
    const root = rootRef.current;
    if (!root) return;

    // Alpha from death fade
    const alpha =
      enemy.state === "dead"
        ? Math.max(0, 1 - enemy.deathFadeSec / ENEMY_DEATH_FADE_SEC)
        : 1;

    // Position + facing
    // Collapse toward the floor as it dies for a subtle "falling" cue.
    const sinkY = enemy.state === "dead" ? (1 - alpha) * -0.8 : 0;
    root.position.set(enemy.x, sinkY, enemy.z);
    root.rotation.y = enemy.angle;

    // Scale-down slightly while dying
    const deathScale = 0.7 + 0.3 * alpha;
    root.scale.set(deathScale, deathScale, deathScale);

    // Material transparency
    if (bodyMatRef.current) {
      bodyMatRef.current.transparent = true;
      bodyMatRef.current.opacity = alpha;
    }
    if (headMatRef.current) {
      headMatRef.current.transparent = true;
      headMatRef.current.opacity = alpha;
    }
    if (crestMatRef.current) {
      crestMatRef.current.opacity = 0.85 * alpha;
    }

    // HP bar: billboard toward camera, hide when dead or full hp.
    if (hpBarGroupRef.current) {
      const showBar = enemy.state !== "dead" && enemy.hp < enemy.maxHp;
      hpBarGroupRef.current.visible = showBar;
      if (showBar) {
        // Counter the root's Y rotation so the bar faces world-space, then
        // rotate to face the camera horizontally.
        const dx = camera.position.x - enemy.x;
        const dz = camera.position.z - enemy.z;
        const camYaw = Math.atan2(dx, dz);
        hpBarGroupRef.current.rotation.y = camYaw - enemy.angle;
      }
    }
    if (hpFillRef.current) {
      const pct = Math.max(0, enemy.hp / enemy.maxHp);
      hpFillRef.current.scale.x = pct;
      // Shift left so the fill shrinks from right-to-left around the bar center.
      hpFillRef.current.position.x = -(1 - pct) * 0.5;
    }
  });

  // Body is a vertical capsule-ish box; head is a small cube; crest ring
  // on the shoulders gives a hostile silhouette.
  return (
    <group ref={rootRef} position={[enemy.x, 0, enemy.z]}>
      {/* Body */}
      <mesh position={[0, 0.9, 0]} castShadow>
        <capsuleGeometry args={[0.55, 1.0, 6, 10]} />
        <meshStandardMaterial
          ref={bodyMatRef}
          color="#5a1a1a"
          roughness={0.75}
          metalness={0.2}
          emissive="#2a0808"
          emissiveIntensity={0.35}
        />
      </mesh>

      {/* Head */}
      <mesh position={[0, 2.1, 0]} castShadow>
        <boxGeometry args={[0.55, 0.55, 0.55]} />
        <meshStandardMaterial
          ref={headMatRef}
          color="#3a0c0c"
          roughness={0.85}
          emissive="#1a0404"
          emissiveIntensity={0.4}
        />
      </mesh>

      {/* Red crest glow (top of head) — top-down visibility marker */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 2.45, 0]}>
        <ringGeometry args={[0.18, 0.40, 18]} />
        <meshBasicMaterial
          ref={crestMatRef}
          color="#ff3030"
          transparent
          opacity={0.85}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
          side={THREE.DoubleSide}
        />
      </mesh>

      {/* Facing indicator — short "muzzle" cube in front of the head */}
      <mesh position={[0, 1.4, -0.55]}>
        <boxGeometry args={[0.22, 0.22, 0.45]} />
        <meshStandardMaterial
          color="#2a0606"
          emissive="#1a0202"
        />
      </mesh>

      {/* HP bar — hidden at full hp and while dead, billboards to camera */}
      <group ref={hpBarGroupRef} position={[0, 2.9, 0]}>
        {/* Background (dark plate) */}
        <mesh>
          <planeGeometry args={[1.15, 0.16]} />
          <meshBasicMaterial color="#1a0004" transparent opacity={0.8} />
        </mesh>
        {/* Fill */}
        <mesh ref={hpFillRef} position={[0, 0, 0.001]}>
          <planeGeometry args={[1.0, 0.1]} />
          <meshBasicMaterial color="#ff4040" />
        </mesh>
      </group>
    </group>
  );
}

/** Collection renderer. */
export function LabyrinthEnemies3D({ enemies }: { enemies: readonly EnemyRuntime[] }) {
  return (
    <>
      {enemies.map((e) => (
        <LabyrinthEnemy3D key={e.id} enemy={e} />
      ))}
    </>
  );
}
