/**
 * Enemy3D.tsx
 * Renders each enemy based on its type.
 * Low-poly distinct silhouettes with per-type animations:
 *   - Scuttler: leg scurry
 *   - Brute: arm swing + stomp walk
 *   - Wraith: float bob + arm sway + robe sway
 *   - Elite: walk cycle + weapon sway
 *   - Boss: aura + arm slam + breathing
 *   - XP Goblin: hop
 *   - Champions: walk cycles + unique idles
 *   - ALL: spawn scale-in, death shrink+sink, hit flash
 */

import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import type { EnemyRuntime } from "../game/GameScene";

interface EnemyProps {
  enemy: EnemyRuntime;
}

// ─── Shared animation helpers ────────────────────────────────────────────────

/** Returns a walk speed factor based on enemy velocity. */
function getWalkSpeed(e: EnemyRuntime): number {
  return Math.sqrt(e.vx * e.vx + e.vz * e.vz);
}

// ─── Health Bar ──────────────────────────────────────────────────────────────

function HealthBar({ healthPct }: { healthPct: number }) {
  const width = Math.max(0, healthPct) * 1.2;
  return (
    <group position={[0, 0.2, 0]}>
      <mesh position={[0, 0, 0]}>
        <planeGeometry args={[1.2, 0.12]} />
        <meshBasicMaterial color="#330000" />
      </mesh>
      <mesh position={[(width - 1.2) / 2, 0, 0.001]}>
        <planeGeometry args={[width, 0.10]} />
        <meshBasicMaterial color={healthPct > 0.5 ? "#00cc44" : healthPct > 0.25 ? "#ff8800" : "#cc0000"} />
      </mesh>
    </group>
  );
}

// ─── Scuttler ────────────────────────────────────────────────────────────────

function ScuttlerMesh({ color, emissive, flash }: { color: string; emissive: string; flash: boolean }) {
  const t = useRef(Math.random() * 100);
  const legRefs = useRef<THREE.Mesh[]>([]);

  useFrame((_, delta) => {
    t.current += delta;
    legRefs.current.forEach((leg, i) => {
      if (leg) leg.rotation.x = Math.sin(t.current * 12 + i * 1.2) * 0.5;
    });
  });

  return (
    <group>
      <mesh castShadow position={[0, 0.35, 0]}>
        <boxGeometry args={[0.8, 0.3, 0.9]} />
        <meshStandardMaterial color={flash ? "#ffffff" : color} emissive={emissive} emissiveIntensity={flash ? 3 : 0.5} roughness={0.6} />
      </mesh>
      <mesh castShadow position={[0, 0.4, 0.5]}>
        <boxGeometry args={[0.5, 0.25, 0.3]} />
        <meshStandardMaterial color={flash ? "#ffffff" : color} emissive={emissive} emissiveIntensity={flash ? 3 : 0.5} roughness={0.7} />
      </mesh>
      <mesh position={[-0.12, 0.46, 0.65]}>
        <sphereGeometry args={[0.06, 6, 6]} />
        <meshStandardMaterial color="#ff4400" emissive="#ff2200" emissiveIntensity={3} />
      </mesh>
      <mesh position={[0.12, 0.46, 0.65]}>
        <sphereGeometry args={[0.06, 6, 6]} />
        <meshStandardMaterial color="#ff4400" emissive="#ff2200" emissiveIntensity={3} />
      </mesh>
      {[-0.35, 0.35].map((side, si) =>
        [-0.2, 0.0, 0.2, 0.35].map((offset, li) => (
          <mesh
            key={`${si}-${li}`}
            ref={(el) => { if (el) legRefs.current[si * 4 + li] = el; }}
            position={[side, 0.25, offset]}
            castShadow
          >
            <boxGeometry args={[0.25 + Math.abs(side) * 0.2, 0.06, 0.06]} />
            <meshStandardMaterial color={color} roughness={0.8} />
          </mesh>
        ))
      )}
    </group>
  );
}

// ─── Brute (NEW: walk cycle with arm swing + stomp bob) ─────────────────────

function BruteMesh({ color, emissive, flash, walkSpeed }: { color: string; emissive: string; flash: boolean; walkSpeed: number }) {
  const t = useRef(Math.random() * 100);
  const bodyRef = useRef<THREE.Mesh>(null);
  const leftArmRef = useRef<THREE.Mesh>(null);
  const rightArmRef = useRef<THREE.Mesh>(null);
  const leftLegRef = useRef<THREE.Mesh>(null);
  const rightLegRef = useRef<THREE.Mesh>(null);

  useFrame((_, delta) => {
    t.current += delta;
    const moving = walkSpeed > 0.3;
    const freq = 5;
    const swing = moving ? Math.sin(t.current * freq) : 0;
    // Body sway + stomp bob
    if (bodyRef.current) {
      bodyRef.current.rotation.y = swing * 0.08;
      bodyRef.current.position.y = 1.3 + (moving ? Math.abs(Math.sin(t.current * freq * 2)) * 0.06 : Math.sin(t.current * 0.8) * 0.02);
    }
    // Arm swing (opposite to legs)
    if (leftArmRef.current) leftArmRef.current.rotation.x = moving ? -swing * 0.4 : Math.sin(t.current * 1.2) * 0.05;
    if (rightArmRef.current) rightArmRef.current.rotation.x = moving ? swing * 0.4 : Math.sin(t.current * 1.2 + 0.5) * 0.05;
    // Leg swing
    if (leftLegRef.current) leftLegRef.current.rotation.x = moving ? swing * 0.35 : 0;
    if (rightLegRef.current) rightLegRef.current.rotation.x = moving ? -swing * 0.35 : 0;
  });

  const mat = { color: flash ? "#ffffff" : color, emissive, emissiveIntensity: flash ? 3 : 0.3, roughness: 0.7, metalness: 0.2 };

  return (
    <group>
      <mesh ref={leftLegRef} castShadow position={[-0.35, 0.5, 0]}>
        <boxGeometry args={[0.38, 1.0, 0.38]} />
        <meshStandardMaterial {...mat} />
      </mesh>
      <mesh ref={rightLegRef} castShadow position={[0.35, 0.5, 0]}>
        <boxGeometry args={[0.38, 1.0, 0.38]} />
        <meshStandardMaterial {...mat} />
      </mesh>
      <mesh ref={bodyRef} castShadow position={[0, 1.3, 0]}>
        <boxGeometry args={[1.1, 0.9, 0.7]} />
        <meshStandardMaterial {...mat} />
      </mesh>
      <mesh ref={leftArmRef} castShadow position={[-0.8, 1.2, 0.1]}>
        <boxGeometry args={[0.38, 0.85, 0.38]} />
        <meshStandardMaterial {...mat} />
      </mesh>
      <mesh ref={rightArmRef} castShadow position={[0.8, 1.2, 0.1]}>
        <boxGeometry args={[0.38, 0.85, 0.38]} />
        <meshStandardMaterial {...mat} />
      </mesh>
      <mesh castShadow position={[-0.82, 0.7, 0.15]}>
        <boxGeometry args={[0.42, 0.32, 0.42]} />
        <meshStandardMaterial color="#4a5060" roughness={0.5} metalness={0.5} />
      </mesh>
      <mesh castShadow position={[0.82, 0.7, 0.15]}>
        <boxGeometry args={[0.42, 0.32, 0.42]} />
        <meshStandardMaterial color="#4a5060" roughness={0.5} metalness={0.5} />
      </mesh>
      <mesh castShadow position={[0, 2.0, 0]}>
        <boxGeometry args={[0.7, 0.65, 0.6]} />
        <meshStandardMaterial {...mat} />
      </mesh>
      <mesh position={[-0.18, 2.08, 0.31]}>
        <boxGeometry args={[0.15, 0.08, 0.02]} />
        <meshStandardMaterial color="#ff4400" emissive="#ff2200" emissiveIntensity={4} />
      </mesh>
      <mesh position={[0.18, 2.08, 0.31]}>
        <boxGeometry args={[0.15, 0.08, 0.02]} />
        <meshStandardMaterial color="#ff4400" emissive="#ff2200" emissiveIntensity={4} />
      </mesh>
      {[-0.3, 0, 0.3].map((x, i) => (
        <mesh key={i} castShadow position={[x, 2.38, 0]}>
          <coneGeometry args={[0.08, 0.2, 5]} />
          <meshStandardMaterial color="#3a4050" roughness={0.5} metalness={0.4} />
        </mesh>
      ))}
    </group>
  );
}

// ─── Wraith (IMPROVED: arm sway + robe sway + eye flicker) ──────────────────

function WraithMesh({ color, emissive, flash }: { color: string; emissive: string; flash: boolean }) {
  const t = useRef(Math.random() * 100);
  const groupRef = useRef<THREE.Group>(null);
  const leftArmRef = useRef<THREE.Mesh>(null);
  const rightArmRef = useRef<THREE.Mesh>(null);
  const robeRef = useRef<THREE.Mesh>(null);
  const eyeLeftRef = useRef<THREE.Mesh>(null);
  const eyeRightRef = useRef<THREE.Mesh>(null);

  useFrame((_, delta) => {
    t.current += delta;
    if (groupRef.current) {
      groupRef.current.position.y = Math.sin(t.current * 2.5) * 0.2;
    }
    // Arm sway — ghostly reaching
    if (leftArmRef.current) {
      leftArmRef.current.rotation.z = 0.6 + Math.sin(t.current * 1.8) * 0.3;
      leftArmRef.current.rotation.x = Math.sin(t.current * 1.3 + 1) * 0.2;
    }
    if (rightArmRef.current) {
      rightArmRef.current.rotation.z = -0.6 - Math.sin(t.current * 1.8 + 2) * 0.3;
      rightArmRef.current.rotation.x = Math.sin(t.current * 1.3) * 0.2;
    }
    // Robe sway
    if (robeRef.current) {
      robeRef.current.rotation.x = Math.sin(t.current * 1.5) * 0.08;
      robeRef.current.rotation.z = Math.sin(t.current * 1.1) * 0.05;
    }
    // Eye flicker
    const flicker = 3 + Math.sin(t.current * 8) * 2;
    if (eyeLeftRef.current) (eyeLeftRef.current.material as THREE.MeshStandardMaterial).emissiveIntensity = flicker;
    if (eyeRightRef.current) (eyeRightRef.current.material as THREE.MeshStandardMaterial).emissiveIntensity = flicker;
  });

  return (
    <group ref={groupRef}>
      <mesh ref={robeRef} castShadow position={[0, 0.6, 0]}>
        <coneGeometry args={[0.5, 1.2, 8]} />
        <meshStandardMaterial color={flash ? "#ffffff" : color} emissive={emissive} emissiveIntensity={flash ? 3 : 1.0} transparent opacity={0.85} roughness={0.9} />
      </mesh>
      <mesh castShadow position={[0, 1.1, 0]}>
        <boxGeometry args={[0.6, 0.5, 0.4]} />
        <meshStandardMaterial color={flash ? "#ffffff" : color} emissive={emissive} emissiveIntensity={flash ? 3 : 1.0} transparent opacity={0.9} roughness={0.9} />
      </mesh>
      <mesh castShadow position={[0, 1.55, 0]}>
        <sphereGeometry args={[0.32, 8, 8]} />
        <meshStandardMaterial color={flash ? "#ffffff" : "#2a1550"} emissive="#1a0040" emissiveIntensity={flash ? 3 : 0.5} roughness={0.8} />
      </mesh>
      <mesh ref={eyeLeftRef} position={[-0.1, 1.58, 0.3]}>
        <sphereGeometry args={[0.055, 6, 6]} />
        <meshStandardMaterial color="#00ccff" emissive="#00aaff" emissiveIntensity={5} />
      </mesh>
      <mesh ref={eyeRightRef} position={[0.1, 1.58, 0.3]}>
        <sphereGeometry args={[0.055, 6, 6]} />
        <meshStandardMaterial color="#00ccff" emissive="#00aaff" emissiveIntensity={5} />
      </mesh>
      <mesh ref={leftArmRef} castShadow position={[-0.45, 1.05, 0]} rotation={[0, 0, 0.6]}>
        <boxGeometry args={[0.08, 0.5, 0.08]} />
        <meshStandardMaterial color={color} emissive={emissive} emissiveIntensity={0.8} transparent opacity={0.7} roughness={0.9} />
      </mesh>
      <mesh ref={rightArmRef} castShadow position={[0.45, 1.05, 0]} rotation={[0, 0, -0.6]}>
        <boxGeometry args={[0.08, 0.5, 0.08]} />
        <meshStandardMaterial color={color} emissive={emissive} emissiveIntensity={0.8} transparent opacity={0.7} roughness={0.9} />
      </mesh>
    </group>
  );
}

// ─── Elite (NEW: walk cycle + weapon sway + breathing) ──────────────────────

function EliteMesh({ color, emissive, flash, walkSpeed }: { color: string; emissive: string; flash: boolean; walkSpeed: number }) {
  const t = useRef(Math.random() * 100);
  const leftLegRef = useRef<THREE.Mesh>(null);
  const rightLegRef = useRef<THREE.Mesh>(null);
  const leftArmRef = useRef<THREE.Mesh>(null);
  const rightArmRef = useRef<THREE.Mesh>(null);
  const torsoRef = useRef<THREE.Mesh>(null);
  const weaponRef = useRef<THREE.Mesh>(null);

  useFrame((_, delta) => {
    t.current += delta;
    const moving = walkSpeed > 0.3;
    const freq = 6;
    const swing = moving ? Math.sin(t.current * freq) : 0;
    // Legs
    if (leftLegRef.current) leftLegRef.current.rotation.x = swing * 0.3;
    if (rightLegRef.current) rightLegRef.current.rotation.x = -swing * 0.3;
    // Arms (opposite)
    if (leftArmRef.current) leftArmRef.current.rotation.x = moving ? -swing * 0.35 : Math.sin(t.current * 1.2) * 0.04;
    if (rightArmRef.current) rightArmRef.current.rotation.x = moving ? swing * 0.35 : Math.sin(t.current * 1.2 + 1) * 0.04;
    // Torso breathing + walk bob
    if (torsoRef.current) {
      torsoRef.current.position.y = 1.4 + (moving ? Math.abs(Math.sin(t.current * freq * 2)) * 0.04 : Math.sin(t.current * 1.5) * 0.02);
      torsoRef.current.rotation.z = moving ? swing * 0.04 : 0;
    }
    // Weapon sway
    if (weaponRef.current) {
      weaponRef.current.rotation.z = 0.3 + Math.sin(t.current * 2) * 0.08;
    }
  });

  const mat = { color: flash ? "#ffffff" : color, emissive, emissiveIntensity: flash ? 3 : 0.8, roughness: 0.4, metalness: 0.5 };

  return (
    <group>
      <mesh ref={leftLegRef} castShadow position={[-0.28, 0.55, 0]}>
        <boxGeometry args={[0.3, 1.1, 0.3]} />
        <meshStandardMaterial {...mat} />
      </mesh>
      <mesh ref={rightLegRef} castShadow position={[0.28, 0.55, 0]}>
        <boxGeometry args={[0.3, 1.1, 0.3]} />
        <meshStandardMaterial {...mat} />
      </mesh>
      <mesh ref={torsoRef} castShadow position={[0, 1.4, 0]}>
        <boxGeometry args={[0.85, 0.85, 0.55]} />
        <meshStandardMaterial {...mat} />
      </mesh>
      <mesh castShadow position={[-0.65, 1.55, 0]}>
        <boxGeometry args={[0.3, 0.25, 0.45]} />
        <meshStandardMaterial color="#6a0000" roughness={0.4} metalness={0.6} />
      </mesh>
      <mesh castShadow position={[0.65, 1.55, 0]}>
        <boxGeometry args={[0.3, 0.25, 0.45]} />
        <meshStandardMaterial color="#6a0000" roughness={0.4} metalness={0.6} />
      </mesh>
      <mesh ref={leftArmRef} castShadow position={[-0.62, 1.2, 0]}>
        <boxGeometry args={[0.28, 0.8, 0.28]} />
        <meshStandardMaterial {...mat} />
      </mesh>
      <mesh ref={rightArmRef} castShadow position={[0.62, 1.2, 0]}>
        <boxGeometry args={[0.28, 0.8, 0.28]} />
        <meshStandardMaterial {...mat} />
      </mesh>
      {[-0.62, 0.62].map((x, i) => (
        [-0.1, 0.0, 0.1].map((ox, j) => (
          <mesh key={`${i}-${j}`} castShadow position={[x + ox * 0.5, 0.75, 0.15]}>
            <boxGeometry args={[0.06, 0.2, 0.06]} />
            <meshStandardMaterial color="#aa0000" roughness={0.4} metalness={0.4} />
          </mesh>
        ))
      ))}
      <mesh castShadow position={[0, 2.05, 0]}>
        <boxGeometry args={[0.55, 0.55, 0.5]} />
        <meshStandardMaterial {...mat} />
      </mesh>
      <mesh castShadow position={[-0.22, 2.38, 0]} rotation={[0, 0, -0.4]}>
        <coneGeometry args={[0.07, 0.4, 6]} />
        <meshStandardMaterial color="#3a0000" roughness={0.5} metalness={0.3} />
      </mesh>
      <mesh castShadow position={[0.22, 2.38, 0]} rotation={[0, 0, 0.4]}>
        <coneGeometry args={[0.07, 0.4, 6]} />
        <meshStandardMaterial color="#3a0000" roughness={0.5} metalness={0.3} />
      </mesh>
      <mesh position={[-0.14, 2.1, 0.26]}>
        <boxGeometry args={[0.1, 0.06, 0.02]} />
        <meshStandardMaterial color="#ffff00" emissive="#ffcc00" emissiveIntensity={5} />
      </mesh>
      <mesh position={[0.14, 2.1, 0.26]}>
        <boxGeometry args={[0.1, 0.06, 0.02]} />
        <meshStandardMaterial color="#ffff00" emissive="#ffcc00" emissiveIntensity={5} />
      </mesh>
      <mesh ref={weaponRef} castShadow position={[0.85, 1.0, 0.2]} rotation={[0.2, 0, 0.3]}>
        <boxGeometry args={[0.1, 1.6, 0.06]} />
        <meshStandardMaterial color="#c0c0e0" roughness={0.15} metalness={0.95} emissive="#8080ff" emissiveIntensity={0.5} />
      </mesh>
    </group>
  );
}

// ─── Boss (IMPROVED: arm movement + breathing + aura pulse) ─────────────────

function BossMesh({ color, emissive, flash }: { color: string; emissive: string; flash: boolean }) {
  const t = useRef(Math.random() * 100);
  const auraRef = useRef<THREE.Mesh>(null);
  const leftArmRef = useRef<THREE.Mesh>(null);
  const rightArmRef = useRef<THREE.Mesh>(null);
  const torsoRef = useRef<THREE.Mesh>(null);

  useFrame((_, delta) => {
    t.current += delta;
    if (auraRef.current) {
      auraRef.current.rotation.y = t.current * 0.8;
      auraRef.current.scale.y = 1 + Math.sin(t.current * 2) * 0.1;
    }
    // Breathing — torso scale pulse
    if (torsoRef.current) {
      const breath = 1 + Math.sin(t.current * 1.2) * 0.03;
      torsoRef.current.scale.set(breath, 1, breath);
    }
    // Menacing arm sway
    if (leftArmRef.current) {
      leftArmRef.current.rotation.x = Math.sin(t.current * 1.5) * 0.15;
      leftArmRef.current.rotation.z = -0.1 + Math.sin(t.current * 0.8) * 0.05;
    }
    if (rightArmRef.current) {
      rightArmRef.current.rotation.x = Math.sin(t.current * 1.5 + 1.5) * 0.15;
      rightArmRef.current.rotation.z = 0.1 - Math.sin(t.current * 0.8 + 1) * 0.05;
    }
  });

  const mat = { color: flash ? "#ffffff" : color, emissive, emissiveIntensity: flash ? 5 : 2.0, roughness: 0.3, metalness: 0.6 };

  return (
    <group>
      <mesh ref={auraRef} position={[0, 0.1, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[1.8, 0.08, 8, 32]} />
        <meshStandardMaterial color="#cc00ff" emissive="#aa00ff" emissiveIntensity={3} transparent opacity={0.7} />
      </mesh>
      <mesh castShadow position={[-0.55, 0.75, 0]}>
        <boxGeometry args={[0.7, 1.5, 0.65]} />
        <meshStandardMaterial {...mat} />
      </mesh>
      <mesh castShadow position={[0.55, 0.75, 0]}>
        <boxGeometry args={[0.7, 1.5, 0.65]} />
        <meshStandardMaterial {...mat} />
      </mesh>
      <mesh ref={torsoRef} castShadow position={[0, 2.0, 0]}>
        <boxGeometry args={[1.8, 1.4, 1.0]} />
        <meshStandardMaterial {...mat} />
      </mesh>
      <mesh ref={leftArmRef} castShadow position={[-1.35, 1.8, 0.2]}>
        <boxGeometry args={[0.65, 1.4, 0.65]} />
        <meshStandardMaterial {...mat} />
      </mesh>
      <mesh ref={rightArmRef} castShadow position={[1.35, 1.8, 0.2]}>
        <boxGeometry args={[0.65, 1.4, 0.65]} />
        <meshStandardMaterial {...mat} />
      </mesh>
      <mesh castShadow position={[0, 3.05, 0]}>
        <boxGeometry args={[1.1, 0.9, 0.85]} />
        <meshStandardMaterial {...mat} />
      </mesh>
      {[0, 1, 2, 3, 4, 5].map((i) => {
        const angle = (i / 6) * Math.PI * 2;
        return (
          <mesh key={i} castShadow position={[Math.sin(angle) * 0.45, 3.6, Math.cos(angle) * 0.35]}>
            <coneGeometry args={[0.07, 0.4, 5]} />
            <meshStandardMaterial color="#4a0050" roughness={0.4} metalness={0.5} />
          </mesh>
        );
      })}
      <mesh position={[-0.25, 3.1, 0.44]}>
        <boxGeometry args={[0.2, 0.1, 0.02]} />
        <meshStandardMaterial color="#ff00ff" emissive="#cc00cc" emissiveIntensity={6} />
      </mesh>
      <mesh position={[0.25, 3.1, 0.44]}>
        <boxGeometry args={[0.2, 0.1, 0.02]} />
        <meshStandardMaterial color="#ff00ff" emissive="#cc00cc" emissiveIntensity={6} />
      </mesh>
      <pointLight color="#aa00ff" intensity={3} distance={15} decay={2} />
    </group>
  );
}

// ─── XP Goblin ───────────────────────────────────────────────────────────────

function XPGoblinMesh({ color, emissive, flash }: { color: string; emissive: string; flash: boolean }) {
  const t = useRef(Math.random() * 100);
  const groupRef = useRef<THREE.Group>(null);
  const leftLegRef = useRef<THREE.Mesh>(null);
  const rightLegRef = useRef<THREE.Mesh>(null);

  useFrame((_, delta) => {
    t.current += delta;
    if (groupRef.current) {
      groupRef.current.position.y = Math.abs(Math.sin(t.current * 8)) * 0.15;
    }
    // Stubby leg waddle
    if (leftLegRef.current) leftLegRef.current.rotation.x = Math.sin(t.current * 10) * 0.4;
    if (rightLegRef.current) rightLegRef.current.rotation.x = -Math.sin(t.current * 10) * 0.4;
  });

  const mat = { color: flash ? "#ffffff" : color, emissive, emissiveIntensity: flash ? 4 : 1.5, roughness: 0.3, metalness: 0.6 };

  return (
    <group ref={groupRef}>
      <mesh castShadow position={[0, 0.38, 0]}>
        <sphereGeometry args={[0.38, 8, 8]} />
        <meshStandardMaterial {...mat} />
      </mesh>
      <mesh castShadow position={[0, 0.85, 0]}>
        <sphereGeometry args={[0.3, 8, 8]} />
        <meshStandardMaterial {...mat} />
      </mesh>
      <mesh castShadow position={[-0.3, 0.9, 0]}>
        <sphereGeometry args={[0.12, 6, 6]} />
        <meshStandardMaterial {...mat} />
      </mesh>
      <mesh castShadow position={[0.3, 0.9, 0]}>
        <sphereGeometry args={[0.12, 6, 6]} />
        <meshStandardMaterial {...mat} />
      </mesh>
      <mesh position={[-0.1, 0.9, 0.28]}>
        <circleGeometry args={[0.07, 8]} />
        <meshStandardMaterial color="#ff8800" emissive="#ff5500" emissiveIntensity={5} />
      </mesh>
      <mesh position={[0.1, 0.9, 0.28]}>
        <circleGeometry args={[0.07, 8]} />
        <meshStandardMaterial color="#ff8800" emissive="#ff5500" emissiveIntensity={5} />
      </mesh>
      <mesh castShadow position={[0, 0.5, -0.35]}>
        <sphereGeometry args={[0.22, 6, 6]} />
        <meshStandardMaterial color="#ffcc00" emissive="#aa6600" emissiveIntensity={2} roughness={0.2} metalness={0.8} />
      </mesh>
      <mesh ref={leftLegRef} castShadow position={[-0.15, 0.1, 0]}>
        <boxGeometry args={[0.16, 0.2, 0.16]} />
        <meshStandardMaterial {...mat} />
      </mesh>
      <mesh ref={rightLegRef} castShadow position={[0.15, 0.1, 0]}>
        <boxGeometry args={[0.16, 0.2, 0.16]} />
        <meshStandardMaterial {...mat} />
      </mesh>
      <pointLight color="#ffaa00" intensity={2} distance={4} decay={2} position={[0, 0.2, 0]} />
    </group>
  );
}

// ─── Warrior Champion (IMPROVED: walk cycle + sword swing idle) ─────────────

function WarriorChampionMesh({ color, emissive, flash, walkSpeed }: { color: string; emissive: string; flash: boolean; walkSpeed: number }) {
  const t = useRef(Math.random() * 100);
  const auraRef = useRef<THREE.Mesh>(null);
  const leftLegRef = useRef<THREE.Mesh>(null);
  const rightLegRef = useRef<THREE.Mesh>(null);
  const swordArmRef = useRef<THREE.Mesh>(null);

  useFrame((_, delta) => {
    t.current += delta;
    if (auraRef.current) auraRef.current.rotation.y = t.current * 0.6;
    const moving = walkSpeed > 0.3;
    const freq = 5.5;
    const swing = moving ? Math.sin(t.current * freq) : 0;
    if (leftLegRef.current) leftLegRef.current.rotation.x = swing * 0.3;
    if (rightLegRef.current) rightLegRef.current.rotation.x = -swing * 0.3;
    // Sword arm: idle sway or walk swing
    if (swordArmRef.current) {
      swordArmRef.current.rotation.x = moving ? swing * 0.3 : Math.sin(t.current * 1.5) * 0.1;
    }
  });

  const mat = { color: flash ? "#ffffff" : color, emissive, emissiveIntensity: flash ? 5 : 1.2, roughness: 0.25, metalness: 0.85 };
  const goldMat = { color: "#c8a000", emissive: "#5a4000", emissiveIntensity: flash ? 5 : 0.8, roughness: 0.2, metalness: 0.9 };

  return (
    <group>
      <mesh ref={auraRef} position={[0, 0.15, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[1.4, 0.06, 8, 32]} />
        <meshStandardMaterial color="#4488ff" emissive="#2244cc" emissiveIntensity={3} transparent opacity={0.8} />
      </mesh>
      <mesh ref={leftLegRef} castShadow position={[-0.42, 0.65, 0]}>
        <boxGeometry args={[0.48, 1.3, 0.48]} />
        <meshStandardMaterial {...mat} />
      </mesh>
      <mesh ref={rightLegRef} castShadow position={[0.42, 0.65, 0]}>
        <boxGeometry args={[0.48, 1.3, 0.48]} />
        <meshStandardMaterial {...mat} />
      </mesh>
      <mesh castShadow position={[0, 1.65, 0]}>
        <boxGeometry args={[1.35, 1.05, 0.75]} />
        <meshStandardMaterial {...mat} />
      </mesh>
      <mesh castShadow position={[0, 1.72, 0.38]}>
        <boxGeometry args={[0.55, 0.45, 0.05]} />
        <meshStandardMaterial {...goldMat} />
      </mesh>
      <mesh castShadow position={[-0.9, 1.85, 0]}>
        <boxGeometry args={[0.45, 0.35, 0.65]} />
        <meshStandardMaterial color="#2255aa" roughness={0.3} metalness={0.8} />
      </mesh>
      <mesh castShadow position={[0.9, 1.85, 0]}>
        <boxGeometry args={[0.45, 0.35, 0.65]} />
        <meshStandardMaterial color="#2255aa" roughness={0.3} metalness={0.8} />
      </mesh>
      <mesh castShadow position={[-0.88, 1.45, 0.1]}>
        <boxGeometry args={[0.36, 1.0, 0.36]} />
        <meshStandardMaterial {...mat} />
      </mesh>
      <mesh ref={swordArmRef} castShadow position={[0.88, 1.45, 0.1]}>
        <boxGeometry args={[0.36, 1.0, 0.36]} />
        <meshStandardMaterial {...mat} />
      </mesh>
      <mesh castShadow position={[-1.0, 1.2, 0.3]}>
        <boxGeometry args={[0.12, 0.9, 0.75]} />
        <meshStandardMaterial color="#1a3a88" roughness={0.2} metalness={0.9} emissive="#0a1844" emissiveIntensity={0.6} />
      </mesh>
      <mesh castShadow position={[-1.06, 1.2, 0.3]}>
        <sphereGeometry args={[0.14, 6, 6]} />
        <meshStandardMaterial {...goldMat} />
      </mesh>
      <mesh castShadow position={[1.1, 1.0, 0.2]} rotation={[0.15, 0, 0.25]}>
        <boxGeometry args={[0.12, 2.0, 0.07]} />
        <meshStandardMaterial color="#88aaff" roughness={0.1} metalness={1.0} emissive="#2244ff" emissiveIntensity={1.5} />
      </mesh>
      <mesh castShadow position={[0, 2.55, 0]}>
        <boxGeometry args={[0.72, 0.72, 0.65]} />
        <meshStandardMaterial {...mat} />
      </mesh>
      <mesh position={[0, 2.58, 0.34]}>
        <boxGeometry args={[0.55, 0.14, 0.03]} />
        <meshStandardMaterial color="#88bbff" emissive="#4488ff" emissiveIntensity={6} />
      </mesh>
      {[-0.2, 0, 0.2].map((x, i) => (
        <mesh key={i} castShadow position={[x, 3.0, 0]}>
          <coneGeometry args={[0.06, 0.35, 5]} />
          <meshStandardMaterial {...goldMat} />
        </mesh>
      ))}
      <pointLight color="#4488ff" intensity={4} distance={12} decay={2} />
    </group>
  );
}

// ─── Mage Champion (unchanged — already has floating + orbiting orbs) ───────

function MageChampionMesh({ color, emissive, flash }: { color: string; emissive: string; flash: boolean }) {
  const t = useRef(Math.random() * 100);
  const orb1Ref = useRef<THREE.Group>(null);
  const orb2Ref = useRef<THREE.Group>(null);
  const orb3Ref = useRef<THREE.Group>(null);
  const groupRef = useRef<THREE.Group>(null);
  const sleeveLeftRef = useRef<THREE.Mesh>(null);
  const sleeveRightRef = useRef<THREE.Mesh>(null);

  useFrame((_, delta) => {
    t.current += delta;
    if (groupRef.current) {
      groupRef.current.position.y = Math.sin(t.current * 1.8) * 0.18;
    }
    const orbs = [orb1Ref.current, orb2Ref.current, orb3Ref.current];
    orbs.forEach((orb, i) => {
      if (!orb) return;
      const a = t.current * 1.4 + (i * Math.PI * 2) / 3;
      orb.position.set(Math.sin(a) * 1.1, 1.5 + Math.sin(t.current * 2 + i) * 0.2, Math.cos(a) * 1.1);
    });
    // Sleeve sway — casting motion
    if (sleeveLeftRef.current) {
      sleeveLeftRef.current.rotation.z = 0.4 + Math.sin(t.current * 2.2) * 0.15;
      sleeveLeftRef.current.rotation.x = Math.sin(t.current * 1.6 + 1) * 0.1;
    }
    if (sleeveRightRef.current) {
      sleeveRightRef.current.rotation.z = -0.4 - Math.sin(t.current * 2.2 + 2) * 0.15;
      sleeveRightRef.current.rotation.x = Math.sin(t.current * 1.6) * 0.1;
    }
  });

  const mat = { color: flash ? "#ffffff" : color, emissive, emissiveIntensity: flash ? 5 : 1.5, roughness: 0.6, metalness: 0.1 };

  return (
    <group ref={groupRef}>
      {[orb1Ref, orb2Ref, orb3Ref].map((ref, i) => (
        <group key={i} ref={ref}>
          <mesh>
            <sphereGeometry args={[0.14, 8, 8]} />
            <meshStandardMaterial color="#cc66ff" emissive="#9900cc" emissiveIntensity={flash ? 6 : 4} roughness={0.1} />
          </mesh>
        </group>
      ))}
      <mesh castShadow position={[0, 0.55, 0]}>
        <coneGeometry args={[0.75, 1.1, 10]} />
        <meshStandardMaterial {...mat} />
      </mesh>
      <mesh castShadow position={[0, 1.35, 0]}>
        <boxGeometry args={[0.75, 0.85, 0.5]} />
        <meshStandardMaterial {...mat} />
      </mesh>
      <mesh position={[0, 1.45, 0.26]}>
        <octahedronGeometry args={[0.18, 0]} />
        <meshStandardMaterial color="#ee88ff" emissive="#cc00ff" emissiveIntensity={flash ? 8 : 5} roughness={0.05} />
      </mesh>
      <mesh castShadow position={[-0.55, 1.55, 0]}>
        <sphereGeometry args={[0.25, 6, 6]} />
        <meshStandardMaterial {...mat} />
      </mesh>
      <mesh castShadow position={[0.55, 1.55, 0]}>
        <sphereGeometry args={[0.25, 6, 6]} />
        <meshStandardMaterial {...mat} />
      </mesh>
      <mesh ref={sleeveLeftRef} castShadow position={[-0.58, 1.2, 0]} rotation={[0, 0, 0.4]}>
        <boxGeometry args={[0.22, 0.85, 0.22]} />
        <meshStandardMaterial {...mat} />
      </mesh>
      <mesh ref={sleeveRightRef} castShadow position={[0.58, 1.2, 0]} rotation={[0, 0, -0.4]}>
        <boxGeometry args={[0.22, 0.85, 0.22]} />
        <meshStandardMaterial {...mat} />
      </mesh>
      <mesh castShadow position={[0.85, 1.4, 0.1]} rotation={[0.2, 0, 0.1]}>
        <boxGeometry args={[0.08, 2.0, 0.08]} />
        <meshStandardMaterial color="#2a0044" roughness={0.5} metalness={0.4} emissive="#5500aa" emissiveIntensity={0.8} />
      </mesh>
      <mesh position={[0.87, 2.42, 0.14]}>
        <octahedronGeometry args={[0.24, 0]} />
        <meshStandardMaterial color="#dd88ff" emissive="#cc00ff" emissiveIntensity={flash ? 8 : 6} roughness={0.05} />
      </mesh>
      <mesh castShadow position={[0, 2.1, 0]}>
        <boxGeometry args={[0.55, 0.6, 0.48]} />
        <meshStandardMaterial {...mat} />
      </mesh>
      <mesh castShadow position={[0, 2.65, 0]}>
        <coneGeometry args={[0.3, 0.7, 8]} />
        <meshStandardMaterial {...mat} />
      </mesh>
      <mesh position={[-0.14, 2.17, 0.25]}>
        <sphereGeometry args={[0.07, 6, 6]} />
        <meshStandardMaterial color="#ee00ff" emissive="#cc00ff" emissiveIntensity={8} />
      </mesh>
      <mesh position={[0.14, 2.17, 0.25]}>
        <sphereGeometry args={[0.07, 6, 6]} />
        <meshStandardMaterial color="#ee00ff" emissive="#cc00ff" emissiveIntensity={8} />
      </mesh>
      <pointLight color="#9900ff" intensity={5} distance={14} decay={2} />
    </group>
  );
}

// ─── Rogue Champion (IMPROVED: dagger spin + shadow trail pulse) ────────────

function RogueChampionMesh({ color, emissive, flash, walkSpeed }: { color: string; emissive: string; flash: boolean; walkSpeed: number }) {
  const t = useRef(Math.random() * 100);
  const shadowMatRef = useRef<THREE.MeshStandardMaterial>(null);
  const leftDaggerRef = useRef<THREE.Mesh>(null);
  const rightDaggerRef = useRef<THREE.Mesh>(null);
  const leftLegRef = useRef<THREE.Mesh>(null);
  const rightLegRef = useRef<THREE.Mesh>(null);

  useFrame((_, delta) => {
    t.current += delta;
    if (shadowMatRef.current) {
      shadowMatRef.current.emissiveIntensity = 1.5 + Math.sin(t.current * 4) * 1.0;
      shadowMatRef.current.opacity = 0.2 + Math.sin(t.current * 3) * 0.15;
    }
    // Dagger twirl — constant spin on Z axis
    if (leftDaggerRef.current) {
      leftDaggerRef.current.rotation.y = t.current * 6;
      leftDaggerRef.current.rotation.x = 0.4 + Math.sin(t.current * 2) * 0.15;
    }
    if (rightDaggerRef.current) {
      rightDaggerRef.current.rotation.y = -t.current * 6;
      rightDaggerRef.current.rotation.x = 0.4 + Math.sin(t.current * 2 + 1) * 0.15;
    }
    // Leg walk
    const moving = walkSpeed > 0.5;
    const swing = moving ? Math.sin(t.current * 8) : 0;
    if (leftLegRef.current) leftLegRef.current.rotation.x = swing * 0.35;
    if (rightLegRef.current) rightLegRef.current.rotation.x = -swing * 0.35;
  });

  const mat = { color: flash ? "#ffffff" : color, emissive, emissiveIntensity: flash ? 5 : 1.0, roughness: 0.45, metalness: 0.55 };
  const bladeMat = { color: "#88ffcc", emissive: "#00dd88", emissiveIntensity: flash ? 6 : 2.5, roughness: 0.05, metalness: 1.0 };

  return (
    <group>
      <mesh position={[0, 1.0, -0.3]} scale={[0.85, 0.85, 0.85]}>
        <boxGeometry args={[0.6, 1.8, 0.1]} />
        <meshStandardMaterial ref={shadowMatRef} color="#00ff88" emissive="#00cc44" emissiveIntensity={2} transparent opacity={0.4} />
      </mesh>
      <mesh ref={leftLegRef} castShadow position={[-0.24, 0.52, 0]}>
        <boxGeometry args={[0.26, 1.04, 0.26]} />
        <meshStandardMaterial {...mat} />
      </mesh>
      <mesh ref={rightLegRef} castShadow position={[0.24, 0.52, 0]}>
        <boxGeometry args={[0.26, 1.04, 0.26]} />
        <meshStandardMaterial {...mat} />
      </mesh>
      <mesh castShadow position={[0, 1.38, 0]}>
        <boxGeometry args={[0.7, 0.8, 0.45]} />
        <meshStandardMaterial {...mat} />
      </mesh>
      <mesh castShadow position={[0, 1.6, -0.05]}>
        <boxGeometry args={[0.82, 0.45, 0.55]} />
        <meshStandardMaterial color={flash ? "#ffffff" : "#0a3020"} emissive="#003315" emissiveIntensity={flash ? 4 : 0.5} roughness={0.8} />
      </mesh>
      <mesh castShadow position={[-0.54, 1.22, 0.1]}>
        <boxGeometry args={[0.22, 0.78, 0.22]} />
        <meshStandardMaterial {...mat} />
      </mesh>
      <mesh castShadow position={[0.54, 1.22, 0.1]}>
        <boxGeometry args={[0.22, 0.78, 0.22]} />
        <meshStandardMaterial {...mat} />
      </mesh>
      <mesh ref={leftDaggerRef} castShadow position={[-0.68, 0.9, 0.22]} rotation={[0.4, 0, -0.3]}>
        <boxGeometry args={[0.06, 0.72, 0.04]} />
        <meshStandardMaterial {...bladeMat} />
      </mesh>
      <mesh ref={rightDaggerRef} castShadow position={[0.68, 0.9, 0.22]} rotation={[0.4, 0, 0.3]}>
        <boxGeometry args={[0.06, 0.72, 0.04]} />
        <meshStandardMaterial {...bladeMat} />
      </mesh>
      <mesh castShadow position={[0, 2.06, 0]}>
        <boxGeometry args={[0.5, 0.5, 0.45]} />
        <meshStandardMaterial {...mat} />
      </mesh>
      <mesh castShadow position={[0, 2.42, -0.1]} rotation={[-0.3, 0, 0]}>
        <coneGeometry args={[0.22, 0.5, 8]} />
        <meshStandardMaterial color={flash ? "#ffffff" : "#0a3020"} emissive="#003315" emissiveIntensity={flash ? 4 : 0.5} roughness={0.8} />
      </mesh>
      <mesh position={[-0.12, 2.1, 0.23]}>
        <boxGeometry args={[0.12, 0.05, 0.02]} />
        <meshStandardMaterial color="#00ff88" emissive="#00dd66" emissiveIntensity={8} />
      </mesh>
      <mesh position={[0.12, 2.1, 0.23]}>
        <boxGeometry args={[0.12, 0.05, 0.02]} />
        <meshStandardMaterial color="#00ff88" emissive="#00dd66" emissiveIntensity={8} />
      </mesh>
      <pointLight color="#00ff88" intensity={4} distance={12} decay={2} />
    </group>
  );
}

// ─── Main Enemy3D Export (with spawn scale-in + death shrink) ────────────────

export function Enemy3D({ enemy }: EnemyProps) {
  const groupRef = useRef<THREE.Group>(null);
  const healthBarGroupRef = useRef<THREE.Group>(null);
  const spawnScale = useRef(0.01); // start tiny, grow in
  const deathTimer = useRef(-1);   // -1 = alive
  const wasAlive = useRef(true);

  useFrame(({ camera }, delta) => {
    if (!groupRef.current) return;
    groupRef.current.position.set(enemy.x, 0, enemy.z);

    // Face player direction
    const dx = -enemy.vx;
    const dz = -enemy.vz;
    if (Math.abs(dx) > 0.01 || Math.abs(dz) > 0.01) {
      groupRef.current.rotation.y = Math.atan2(dx, dz) + Math.PI;
    }

    // ── Spawn scale-in animation ──
    if (spawnScale.current < 1) {
      spawnScale.current = Math.min(1, spawnScale.current + delta * 3);
      // Elastic overshoot: scale up to 1.1 then settle to 1.0
      const t = spawnScale.current;
      const elastic = t < 0.8 ? t / 0.8 * 1.1 : 1.1 - (t - 0.8) / 0.2 * 0.1;
      groupRef.current.scale.setScalar(enemy.scale * elastic);
    }

    // ── Death shrink + sink animation ──
    if (enemy.dead && wasAlive.current) {
      wasAlive.current = false;
      deathTimer.current = 0;
    }
    if (deathTimer.current >= 0) {
      deathTimer.current += delta;
      const dt = Math.min(deathTimer.current / 0.35, 1); // 0.35s death anim
      groupRef.current.scale.setScalar(enemy.scale * (1 - dt));
      groupRef.current.position.y = -dt * 0.5; // sink into ground
      groupRef.current.rotation.x = dt * 0.3;  // tip forward
    }

    // Health bar always faces camera
    if (healthBarGroupRef.current) {
      healthBarGroupRef.current.quaternion.copy(camera.quaternion);
    }
  });

  const flash = enemy.hitFlashTimer > 0;
  const meshProps = { color: enemy.color, emissive: enemy.emissive, flash };
  const walkSpeed = getWalkSpeed(enemy);
  const hpBarHeight = enemy.scale * 2.5 + 0.5;

  return (
    <group ref={groupRef}>
      <group scale={enemy.scale}>
        {enemy.type === "scuttler" && <ScuttlerMesh {...meshProps} />}
        {enemy.type === "brute" && <BruteMesh {...meshProps} walkSpeed={walkSpeed} />}
        {enemy.type === "wraith" && <WraithMesh {...meshProps} />}
        {enemy.type === "elite" && <EliteMesh {...meshProps} walkSpeed={walkSpeed} />}
        {enemy.type === "boss" && <BossMesh {...meshProps} />}
        {enemy.type === "xp_goblin" && <XPGoblinMesh {...meshProps} />}
        {enemy.type === "warrior_champion" && <WarriorChampionMesh {...meshProps} walkSpeed={walkSpeed} />}
        {enemy.type === "mage_champion" && <MageChampionMesh {...meshProps} />}
        {enemy.type === "rogue_champion" && <RogueChampionMesh {...meshProps} walkSpeed={walkSpeed} />}
      </group>

      {/* Health bar */}
      <group ref={healthBarGroupRef} position={[0, hpBarHeight, 0]}>
        <HealthBar healthPct={enemy.hp / enemy.maxHp} />
      </group>
    </group>
  );
}
