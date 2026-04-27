/**
 * LabyrinthGroundFx3D.tsx
 *
 * Verbatim port of the main game's GroundEffect3D (GameScene.tsx:2776-2800).
 * Renders each LabGroundFx as an emissive ground disc whose opacity and
 * scale follow its remaining lifetime — larger and brighter while fresh,
 * fading as it expires.
 */

import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import type { LabGroundFx } from "./LabyrinthGroundFx";

export function LabyrinthGroundFx3D({ effects }: { effects: LabGroundFx[] }) {
  return (
    <>
      {effects.map((ge) => (
        <GroundFxMesh key={ge.id} ge={ge} />
      ))}
    </>
  );
}

function GroundFxMesh({ ge }: { ge: LabGroundFx }) {
  const ref = useRef<THREE.Mesh>(null);
  useFrame(() => {
    if (!ref.current) return;
    const opacity = Math.min(1, ge.lifetime * 0.8);
    const mat = ref.current.material as THREE.MeshStandardMaterial;
    mat.opacity = opacity;
    mat.emissiveIntensity = 1 + opacity * 2;
    ref.current.scale.setScalar(ge.radius * (0.7 + opacity * 0.3));
  });
  return (
    <mesh ref={ref} position={[ge.x, 0.05, ge.z]} rotation={[-Math.PI / 2, 0, 0]}>
      <circleGeometry args={[1, 12]} />
      <meshStandardMaterial
        color={ge.color}
        emissive={ge.color}
        emissiveIntensity={2}
        transparent
        opacity={0.6}
        depthWrite={false}
        side={THREE.DoubleSide}
      />
    </mesh>
  );
}
