/**
 * LabyrinthProjectile3D.tsx
 *
 * Renders each LabProjectile. "orb" / "dagger" forward to the main
 * game's Projectile3D component (zero edits). "crescent" (the rival
 * warrior's arc slash ported from Trial of Champions) uses a
 * labyrinth-local renderer because the main-game Projectile3D
 * doesn't handle that style — only EnemyProjectile3D inside
 * GameScene.tsx does, and that component isn't exported.
 *
 * The crescent geometry + colours here mirror the main-game
 * warrior_champion arc slash visual exactly (GameScene.tsx:3060-3082,
 * read-only reference) so a labyrinth arc slash reads identically
 * to a Trial of Champions one.
 */

import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { Projectile3D } from "../../entities/Projectile3D";
import type { Projectile } from "../GameScene";
import type { LabProjectile } from "./LabyrinthProjectile";

export function LabyrinthProjectiles3D({ projectiles }: { projectiles: LabProjectile[] }) {
  return (
    <>
      {projectiles.map((p) =>
        p.style === "crescent"
          ? <CrescentProjectile3D key={p.id} proj={p} />
          : <Projectile3D key={p.id} proj={p as unknown as Projectile} />
      )}
    </>
  );
}

/** Arc-slash crescent. Port of the visual at GameScene.tsx:3060-3082
 *  — partial torus + glow shell + bright inner edge + point light.
 *  Flies through the air toward the player along its velocity
 *  vector; collision lives in tickLabProjectiles. */
function CrescentProjectile3D({ proj }: { proj: LabProjectile }) {
  const ref = useRef<THREE.Group>(null);
  useFrame(() => {
    if (!ref.current) return;
    // Y=1.4 matches main-game crescent fly-height so projectiles
    // sit at chest level — readable from the top-down camera.
    ref.current.position.set(proj.x, 1.4, proj.z);
    // Face travel direction + slight forward tilt.
    ref.current.rotation.y = Math.atan2(proj.vx, proj.vz);
    ref.current.rotation.x = -0.3;
  });
  return (
    <group ref={ref}>
      {/* Core crescent — partial torus (bright inner edge) */}
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[1.3, 0.18, 8, 32, Math.PI * 0.75]} />
        <meshStandardMaterial
          color="#ff4400"
          emissive="#ff2200"
          emissiveIntensity={8}
          roughness={0.05}
          metalness={0.9}
        />
      </mesh>
      {/* Outer glow shell — larger, softer */}
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[1.3, 0.35, 6, 32, Math.PI * 0.75]} />
        <meshStandardMaterial
          color="#ff6600"
          emissive="#ff4400"
          emissiveIntensity={3}
          transparent
          opacity={0.3}
          side={THREE.BackSide}
        />
      </mesh>
      {/* Inner bright edge — thinner, hotter core */}
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[1.3, 0.06, 6, 32, Math.PI * 0.75]} />
        <meshStandardMaterial
          color="#ffaa44"
          emissive="#ffcc66"
          emissiveIntensity={12}
        />
      </mesh>
      <pointLight color="#ff4400" intensity={6} distance={10} decay={2} />
    </group>
  );
}
