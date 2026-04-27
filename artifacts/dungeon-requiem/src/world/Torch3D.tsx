/**
 * Torch3D.tsx
 * Animated wall torch with flickering emissive flame (no pointLight).
 */

import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

interface TorchProps {
  position: [number, number, number];
}

export function Torch3D({ position }: TorchProps) {
  const flameRef = useRef<THREE.Mesh>(null);
  const t = useRef(Math.random() * 100);

  useFrame((_, delta) => {
    t.current += delta;
    if (flameRef.current) {
      flameRef.current.scale.y = 0.9 + Math.sin(t.current * 11) * 0.2;
      flameRef.current.scale.x = 0.85 + Math.sin(t.current * 7.3) * 0.15;
    }
  });

  return (
    <group position={position}>
      {/* Bracket */}
      <mesh position={[0, 0, 0.05]} castShadow>
        <boxGeometry args={[0.15, 0.5, 0.1]} />
        <meshStandardMaterial color="#3a2810" roughness={0.9} metalness={0.3} />
      </mesh>
      {/* Bowl */}
      <mesh position={[0, 0.3, 0.1]} castShadow>
        <cylinderGeometry args={[0.12, 0.08, 0.15, 8]} />
        <meshStandardMaterial color="#5a3a15" roughness={0.8} metalness={0.4} />
      </mesh>
      {/* Flame */}
      <mesh ref={flameRef} position={[0, 0.52, 0.1]}>
        <coneGeometry args={[0.08, 0.25, 8]} />
        <meshStandardMaterial
          color="#ff8800"
          emissive="#ff6600"
          emissiveIntensity={3}
          transparent
          opacity={0.9}
        />
      </mesh>
      {/* Inner flame */}
      <mesh position={[0, 0.5, 0.1]}>
        <coneGeometry args={[0.04, 0.15, 6]} />
        <meshStandardMaterial
          color="#ffffaa"
          emissive="#ffff00"
          emissiveIntensity={5}
          transparent
          opacity={0.95}
        />
      </mesh>
    </group>
  );
}
