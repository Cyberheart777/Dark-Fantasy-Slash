/**
 * LabyrinthChest3D.tsx
 *
 * Renders each live or revealing chest. Chest itself looks identical
 * regardless of kind — that's the whole point of mimics: you can't
 * tell which chest will betray you until you poke it. During the
 * 0.35s "revealing" phase the lid rotates open and a kind-specific
 * colored glow emerges (gold for treasure, green for trapped, red
 * for mimic) — giving the player a split-second tell before the
 * effect lands. All meshBasicMaterial so it's visible on every GPU.
 */

import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import type { LabChest } from "./LabyrinthChest";

const REVEAL_DURATION_SEC = 0.35;

export function LabyrinthChests3D({ chests }: { chests: LabChest[] }) {
  return (
    <>
      {chests.map((c) => (
        <Chest key={c.id} chest={c} />
      ))}
    </>
  );
}

function Chest({ chest }: { chest: LabChest }) {
  const groupRef = useRef<THREE.Group>(null);
  const lidRef = useRef<THREE.Mesh>(null);
  const glowRef = useRef<THREE.Mesh>(null);

  useFrame(() => {
    if (!groupRef.current) return;
    // Reveal animation: rotate the lid open + fade in the glow.
    if (chest.state === "revealing") {
      const prog = Math.min(1, chest.revealSec / REVEAL_DURATION_SEC);
      if (lidRef.current) {
        lidRef.current.rotation.x = -prog * (Math.PI * 0.45);
      }
      if (glowRef.current) {
        const mat = glowRef.current.material as THREE.MeshBasicMaterial;
        mat.opacity = prog * 0.85;
      }
    } else {
      if (lidRef.current) lidRef.current.rotation.x = 0;
      if (glowRef.current) {
        const mat = glowRef.current.material as THREE.MeshBasicMaterial;
        mat.opacity = 0;
      }
    }
  });

  // Chest exterior stays neutral; glow color is the tell on reveal.
  const BODY = "#6a4822";
  const TRIM = "#b78a3d";
  const glowColor =
    chest.kind === "treasure" ? "#ffdf60" :
    chest.kind === "trapped" ? "#a3ff5a" :
    "#ff4830";

  return (
    <group ref={groupRef} position={[chest.x, 0, chest.z]}>
      {/* Chest base */}
      <mesh position={[0, 0.45, 0]}>
        <boxGeometry args={[1.2, 0.9, 0.85]} />
        <meshBasicMaterial color={BODY} depthWrite={false} />
      </mesh>
      {/* Metal bands */}
      <mesh position={[0, 0.45, 0.43]}>
        <boxGeometry args={[1.22, 0.12, 0.03]} />
        <meshBasicMaterial color={TRIM} depthWrite={false} />
      </mesh>
      <mesh position={[0, 0.45, -0.43]}>
        <boxGeometry args={[1.22, 0.12, 0.03]} />
        <meshBasicMaterial color={TRIM} depthWrite={false} />
      </mesh>
      {/* Lock plate */}
      <mesh position={[0, 0.55, 0.44]}>
        <boxGeometry args={[0.22, 0.22, 0.04]} />
        <meshBasicMaterial color="#3a2a15" depthWrite={false} />
      </mesh>
      {/* Lid — hinged at the back. Rotates open during reveal. */}
      <group position={[0, 0.9, -0.425]}>
        <mesh ref={lidRef} position={[0, 0, 0.425]}>
          <boxGeometry args={[1.2, 0.18, 0.85]} />
          <meshBasicMaterial color={BODY} depthWrite={false} />
        </mesh>
      </group>
      {/* Reveal glow — hidden at rest, fades in during reveal. The color
          is the tell: gold good, green poison, red mimic. */}
      <mesh ref={glowRef} position={[0, 1.0, 0]}>
        <sphereGeometry args={[0.55, 12, 10]} />
        <meshBasicMaterial
          color={glowColor}
          transparent
          opacity={0}
          depthWrite={false}
        />
      </mesh>
    </group>
  );
}
