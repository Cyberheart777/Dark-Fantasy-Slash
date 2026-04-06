/**
 * AttackEffect.tsx
 * Fire-and-forget sword swing arc visual.
 * Each increment of triggerKey plays one clean flash animation.
 */

import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

interface AttackEffectProps {
  x: number;
  z: number;
  angle: number;
  triggerKey: number;
}

export function AttackEffect({ x, z, angle, triggerKey }: AttackEffectProps) {
  const groupRef = useRef<THREE.Group>(null);
  const lightRef = useRef<THREE.PointLight>(null);
  const progress  = useRef(0);
  const prevTrigger = useRef(triggerKey);

  useFrame((_, delta) => {
    if (!groupRef.current || !lightRef.current) return;

    if (triggerKey !== prevTrigger.current) {
      prevTrigger.current = triggerKey;
      progress.current = 1;
    }

    if (progress.current > 0) {
      progress.current = Math.max(0, progress.current - delta * 4.5);
    }

    groupRef.current.position.set(x, 0.8, z);
    groupRef.current.rotation.y = angle;

    const p = progress.current;
    const scale = Math.sin(p * Math.PI);
    groupRef.current.scale.setScalar(scale);
    groupRef.current.children.forEach((child, i) => {
      if (child instanceof THREE.Mesh) {
        (child.material as THREE.MeshStandardMaterial).opacity = p * (1 - i * 0.15);
      }
    });

    lightRef.current.intensity = p * 3;
    lightRef.current.position.set(x + Math.sin(angle) * 3, 1, z + Math.cos(angle) * 3);
  });

  return (
    <>
      <group ref={groupRef}>
        {[0, 0.18, 0.35].map((offset, i) => (
          <mesh
            key={i}
            position={[Math.sin(-0.6 + offset * 2) * 2.5, offset * 0.3, Math.cos(-0.6 + offset * 2) * 2.5]}
            rotation={[0, -0.6 + offset * 2, Math.PI / 4]}
          >
            <planeGeometry args={[0.15 - i * 0.03, 2.0 - i * 0.3]} />
            <meshStandardMaterial
              color="#e0e0ff"
              emissive="#a0a0ff"
              emissiveIntensity={3}
              transparent
              opacity={0.7}
              side={THREE.DoubleSide}
              depthWrite={false}
            />
          </mesh>
        ))}
      </group>
      <pointLight ref={lightRef} color="#8080ff" intensity={0} distance={8} decay={2} />
    </>
  );
}
