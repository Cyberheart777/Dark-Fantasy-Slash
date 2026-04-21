/**
 * LabyrinthProjectile3D.tsx
 *
 * Renders each LabProjectile. Player projectiles forward to the main
 * game's Projectile3D. Enemy projectiles render as simple glowing
 * spheres (no pointLights) for performance. Crescents use a local
 * renderer without pointLight.
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
          : p.owner === "enemy"
            ? <EnemyBall3D key={p.id} proj={p} />
            : <Projectile3D key={p.id} proj={p as unknown as Projectile} />
      )}
    </>
  );
}

function EnemyBall3D({ proj }: { proj: LabProjectile }) {
  const ref = useRef<THREE.Mesh>(null);
  useFrame(() => {
    if (!ref.current) return;
    ref.current.position.set(proj.x, 0.8, proj.z);
  });
  return (
    <mesh ref={ref}>
      <sphereGeometry args={[0.25, 6, 4]} />
      <meshStandardMaterial
        color={proj.color || "#ff4444"}
        emissive={proj.glowColor || "#cc2222"}
        emissiveIntensity={3}
      />
    </mesh>
  );
}

function CrescentProjectile3D({ proj }: { proj: LabProjectile }) {
  const ref = useRef<THREE.Group>(null);
  useFrame(() => {
    if (!ref.current) return;
    ref.current.position.set(proj.x, 1.4, proj.z);
    ref.current.rotation.y = Math.atan2(proj.vx, proj.vz);
    ref.current.rotation.x = -0.3;
  });
  return (
    <group ref={ref}>
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
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[1.3, 0.06, 6, 32, Math.PI * 0.75]} />
        <meshStandardMaterial
          color="#ffaa44"
          emissive="#ffcc66"
          emissiveIntensity={12}
        />
      </mesh>
    </group>
  );
}
