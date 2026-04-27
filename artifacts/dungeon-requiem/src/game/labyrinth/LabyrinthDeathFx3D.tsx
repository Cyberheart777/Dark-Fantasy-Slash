/**
 * LabyrinthDeathFx3D.tsx
 *
 * 3D renderer for labyrinth death bursts. Geometry and motion math are
 * a direct port of the main game's DeathFx3D (GameScene.tsx:2701-2772)
 * — 7 puffs travelling along their assigned velocity vectors under
 * gravity, plus a brief expanding white flash disk. Kept in the
 * labyrinth folder so we don't import the un-exported main-game
 * component.
 */

import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import type { LabDeathFx } from "./LabyrinthDeathFx";

export function LabyrinthDeathFx3D({ bursts }: { bursts: LabDeathFx[] }) {
  return (
    <>
      {bursts.map((fx) => (
        <DeathBurst key={fx.id} fx={fx} />
      ))}
    </>
  );
}

function DeathBurst({ fx }: { fx: LabDeathFx }) {
  const groupRef = useRef<THREE.Group>(null);
  const flashRef = useRef<THREE.Mesh>(null);
  const puffRefs = useRef<THREE.Mesh[]>([]);

  useFrame(() => {
    if (!groupRef.current) return;
    const t = fx.age;
    const u = Math.min(1, t / fx.duration);
    // Puffs: outward travel + gravity fall + shrink + fade
    puffRefs.current.forEach((mesh, i) => {
      if (!mesh) return;
      const p = fx.puffs[i];
      if (!p) return;
      const gravity = -3.5;
      mesh.position.set(
        p.vx * t,
        Math.max(0.1, p.vy * t + 0.5 * gravity * t * t),
        p.vz * t,
      );
      const s = (1 - u) * 0.32 + 0.04;
      mesh.scale.setScalar(s);
      const mat = mesh.material as THREE.MeshStandardMaterial;
      mat.opacity = Math.max(0, 1 - u);
      mat.emissiveIntensity = 2 + (1 - u) * 3;
    });
    // White flash plane: expand fast, fade over 0.2s
    if (flashRef.current) {
      const fu = Math.min(1, t / 0.2);
      const flashScale = 0.4 + fu * 2.4;
      flashRef.current.scale.set(flashScale, flashScale, flashScale);
      const fmat = flashRef.current.material as THREE.MeshStandardMaterial;
      fmat.opacity = Math.max(0, 1 - fu);
    }
  });

  return (
    <group ref={groupRef} position={[fx.x, 0, fx.z]}>
      <mesh ref={flashRef} position={[0, 0.1, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[0.7, 16]} />
        <meshStandardMaterial
          color="#ffffff"
          emissive="#ffffff"
          emissiveIntensity={5}
          transparent
          opacity={1}
          depthWrite={false}
          side={THREE.DoubleSide}
        />
      </mesh>
      {fx.puffs.map((_p, i) => (
        <mesh
          key={i}
          ref={(el) => { if (el) puffRefs.current[i] = el; }}
          position={[0, 0.5, 0]}
        >
          <sphereGeometry args={[1, 6, 6]} />
          <meshStandardMaterial
            color={fx.color}
            emissive={fx.color}
            emissiveIntensity={3}
            transparent
            opacity={1}
            depthWrite={false}
          />
        </mesh>
      ))}
    </group>
  );
}
