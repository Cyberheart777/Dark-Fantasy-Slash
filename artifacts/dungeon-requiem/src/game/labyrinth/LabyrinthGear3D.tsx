/**
 * LabyrinthGear3D.tsx
 *
 * Floating gem renderer for dropped gear. Direct port of the main
 * game's GearDrop3D (GameScene.tsx:2978-3016) — the core component
 * isn't exported so we duplicate rather than import. Rarity colours
 * mirror GEAR_RARITY_3D at GameScene.tsx:2972-2976.
 *
 * meshBasicMaterial throughout (vs. the main game's StandardMaterial)
 * so drops stay visible regardless of scene lighting, per the rest of
 * the labyrinth's iOS-safe palette.
 */

import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import type { LabGearDropRuntime } from "./LabyrinthGear";

const LAB_GEAR_RARITY_3D: Record<string, { color: string; emissive: string; lightColor: string; intensity: number }> = {
  common: { color: "#a0a0b0", emissive: "#606070", lightColor: "#8888aa", intensity: 2 },
  rare:   { color: "#4488ff", emissive: "#2244cc", lightColor: "#4488ff", intensity: 4 },
  epic:   { color: "#bb66ff", emissive: "#8822dd", lightColor: "#aa44ff", intensity: 5 },
};

export function LabyrinthGearDrops3D({ drops }: { drops: LabGearDropRuntime[] }) {
  return (
    <>
      {drops.map((d) => (
        <LabGearGem key={d.id} drop={d} />
      ))}
    </>
  );
}

function LabGearGem({ drop }: { drop: LabGearDropRuntime }) {
  const ref = useRef<THREE.Group>(null);
  const t = useRef(drop.floatOffset);

  useFrame((_, delta) => {
    t.current += delta;
    if (!ref.current) return;
    // Same bob/spin/pulse as main-game GearDrop3D.
    ref.current.position.set(
      drop.x,
      0.6 + Math.sin(t.current * 2.5) * 0.2,
      drop.z,
    );
    ref.current.rotation.y = t.current * 1.8;
    const pulse = 1 + Math.sin(t.current * 4) * 0.08;
    ref.current.scale.setScalar(pulse);
  });

  const style = LAB_GEAR_RARITY_3D[drop.gear.rarity] ?? LAB_GEAR_RARITY_3D.common;

  return (
    <group ref={ref}>
      {/* Core gem */}
      <mesh>
        <octahedronGeometry args={[0.28, 0]} />
        <meshBasicMaterial color={style.color} depthWrite={false} />
      </mesh>
      {/* Outer glow shell — translucent, back-side so the core shows through */}
      <mesh>
        <octahedronGeometry args={[0.4, 0]} />
        <meshBasicMaterial
          color={style.emissive}
          transparent
          opacity={0.35}
          side={THREE.BackSide}
          depthWrite={false}
        />
      </mesh>
      {/* Epic-only bright inner diamond, same as main game */}
      {drop.gear.rarity === "epic" && (
        <mesh rotation={[0.5, 0.5, 0]} scale={0.5}>
          <octahedronGeometry args={[0.28, 0]} />
          <meshBasicMaterial
            color="#ffffff"
            transparent
            opacity={0.85}
            depthWrite={false}
          />
        </mesh>
      )}
      <pointLight
        color={style.lightColor}
        intensity={style.intensity * 0.6}
        distance={5}
        decay={2}
      />
    </group>
  );
}
