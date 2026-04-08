/**
 * AttackEffect.tsx
 * Fire-and-forget attack visual.
 * Improved: smoother arc, more slashes, glow pulse, slight screen presence.
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
      progress.current = Math.max(0, progress.current - delta * 4.0);
    }

    groupRef.current.position.set(x, 0.8, z);
    groupRef.current.rotation.y = angle;

    const p = progress.current;
    // Smooth ease-out curve instead of pure sine
    const eased = 1 - Math.pow(1 - p, 3);
    const scale = eased;
    groupRef.current.scale.setScalar(scale);

    // Rotate the arc through the swing
    const swingAngle = (1 - p) * 1.2; // sweep from left to right
    groupRef.current.children.forEach((child, i) => {
      if (child instanceof THREE.Mesh) {
        const mat = child.material as THREE.MeshStandardMaterial;
        mat.opacity = p * (1 - i * 0.12);
        mat.emissiveIntensity = 2 + p * 3;
      }
    });
    groupRef.current.rotation.y = angle + swingAngle - 0.6;

    // Light intensity follows swing
    lightRef.current.intensity = p * 4;
    lightRef.current.position.set(
      x + Math.sin(angle) * 3,
      1.2,
      z + Math.cos(angle) * 3
    );
  });

  return (
    <>
      <group ref={groupRef}>
        {/* Main arc slashes — 5 layered planes for richer visual */}
        {[0, 0.12, 0.24, 0.36, 0.48].map((offset, i) => (
          <mesh
            key={i}
            position={[
              Math.sin(-0.5 + offset * 2.2) * 2.8,
              offset * 0.25,
              Math.cos(-0.5 + offset * 2.2) * 2.8,
            ]}
            rotation={[0, -0.5 + offset * 2.2, Math.PI / 4 + i * 0.05]}
          >
            <planeGeometry args={[0.12 - i * 0.015, 2.2 - i * 0.25]} />
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
        {/* Inner bright core slash */}
        <mesh position={[Math.sin(0.3) * 2, 0.15, Math.cos(0.3) * 2]} rotation={[0, 0.3, Math.PI / 3.5]}>
          <planeGeometry args={[0.06, 2.6]} />
          <meshStandardMaterial
            color="#ffffff"
            emissive="#ccccff"
            emissiveIntensity={5}
            transparent
            opacity={0.9}
            side={THREE.DoubleSide}
            depthWrite={false}
          />
        </mesh>
      </group>
      <pointLight ref={lightRef} color="#8080ff" intensity={0} distance={10} decay={2} />
    </>
  );
}
