/**
 * LabyrinthTrap3D.tsx
 *
 * Renders trap emitters. Each trap has two anchor cubes (one at each
 * wall face). They pulse red during the `warn` phase, strobe bright
 * orange during `fire`, and go dim during `cooldown`. Uses
 * meshBasicMaterial so it's visible regardless of scene lighting.
 * The actual projectile is drawn by LabyrinthProjectiles3D.
 */

import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import type { LabTrap } from "./LabyrinthTrap";

export function LabyrinthTraps3D({ traps }: { traps: LabTrap[] }) {
  return (
    <>
      {traps.map((t) => (
        <TrapEmitters key={t.id} trap={t} />
      ))}
    </>
  );
}

function TrapEmitters({ trap }: { trap: LabTrap }) {
  const aRef = useRef<THREE.Mesh>(null);
  const bRef = useRef<THREE.Mesh>(null);
  const tRef = useRef(0);

  useFrame((_, delta) => {
    tRef.current += delta;
    const intensityByPhase =
      trap.phase === "fire" ? 1.0 :
      trap.phase === "warn" ? 0.5 + 0.5 * Math.sin(tRef.current * 12) :
      0.18;
    const color =
      trap.phase === "fire" ? "#ffdd70" :
      trap.phase === "warn" ? "#ff3020" :
      "#5a1010";
    for (const ref of [aRef, bRef]) {
      const mesh = ref.current;
      if (!mesh) continue;
      const mat = mesh.material as THREE.MeshBasicMaterial;
      mat.color.set(color);
      mat.opacity = 0.55 + 0.45 * intensityByPhase;
    }
  });

  return (
    <>
      <mesh ref={aRef} position={[trap.ax, 1.2, trap.az]}>
        <boxGeometry args={[0.55, 0.55, 0.55]} />
        <meshBasicMaterial color="#ff3020" transparent opacity={0.9} depthWrite={false} />
      </mesh>
      <mesh ref={bRef} position={[trap.bx, 1.2, trap.bz]}>
        <boxGeometry args={[0.55, 0.55, 0.55]} />
        <meshBasicMaterial color="#ff3020" transparent opacity={0.9} depthWrite={false} />
      </mesh>
    </>
  );
}
