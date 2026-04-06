/**
 * Enemy3D.tsx
 * Renders each enemy based on its type.
 * Low-poly distinct silhouettes for each of the 5 enemy types.
 */

import { useRef, useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import type { EnemyRuntime } from "../game/GameScene";

interface EnemyProps {
  enemy: EnemyRuntime;
}

function HealthBar({ healthPct }: { healthPct: number }) {
  const width = Math.max(0, healthPct) * 1.2;
  return (
    <group position={[0, 0.2, 0]}>
      {/* Background */}
      <mesh position={[0, 0, 0]}>
        <planeGeometry args={[1.2, 0.12]} />
        <meshBasicMaterial color="#330000" />
      </mesh>
      {/* Fill */}
      <mesh position={[(width - 1.2) / 2, 0, 0.001]}>
        <planeGeometry args={[width, 0.10]} />
        <meshBasicMaterial color={healthPct > 0.5 ? "#00cc44" : healthPct > 0.25 ? "#ff8800" : "#cc0000"} />
      </mesh>
    </group>
  );
}

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
      {/* Carapace */}
      <mesh castShadow position={[0, 0.35, 0]}>
        <boxGeometry args={[0.8, 0.3, 0.9]} />
        <meshStandardMaterial color={flash ? "#ffffff" : color} emissive={emissive} emissiveIntensity={flash ? 3 : 0.5} roughness={0.6} />
      </mesh>
      {/* Head */}
      <mesh castShadow position={[0, 0.4, 0.5]}>
        <boxGeometry args={[0.5, 0.25, 0.3]} />
        <meshStandardMaterial color={flash ? "#ffffff" : color} emissive={emissive} emissiveIntensity={flash ? 3 : 0.5} roughness={0.7} />
      </mesh>
      {/* Eyes */}
      <mesh position={[-0.12, 0.46, 0.65]}>
        <sphereGeometry args={[0.06, 6, 6]} />
        <meshStandardMaterial color="#ff4400" emissive="#ff2200" emissiveIntensity={3} />
      </mesh>
      <mesh position={[0.12, 0.46, 0.65]}>
        <sphereGeometry args={[0.06, 6, 6]} />
        <meshStandardMaterial color="#ff4400" emissive="#ff2200" emissiveIntensity={3} />
      </mesh>
      {/* Legs (8 of them) */}
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

function BruteMesh({ color, emissive, flash }: { color: string; emissive: string; flash: boolean }) {
  const t = useRef(Math.random() * 100);
  const bodyRef = useRef<THREE.Mesh>(null);

  useFrame((_, delta) => {
    t.current += delta;
    if (bodyRef.current) {
      bodyRef.current.rotation.y = Math.sin(t.current * 0.8) * 0.1;
    }
  });

  const mat = { color: flash ? "#ffffff" : color, emissive, emissiveIntensity: flash ? 3 : 0.3, roughness: 0.7, metalness: 0.2 };

  return (
    <group>
      {/* Legs */}
      <mesh castShadow position={[-0.35, 0.5, 0]}>
        <boxGeometry args={[0.38, 1.0, 0.38]} />
        <meshStandardMaterial {...mat} />
      </mesh>
      <mesh castShadow position={[0.35, 0.5, 0]}>
        <boxGeometry args={[0.38, 1.0, 0.38]} />
        <meshStandardMaterial {...mat} />
      </mesh>
      {/* Torso */}
      <mesh ref={bodyRef} castShadow position={[0, 1.3, 0]}>
        <boxGeometry args={[1.1, 0.9, 0.7]} />
        <meshStandardMaterial {...mat} />
      </mesh>
      {/* Arms */}
      <mesh castShadow position={[-0.8, 1.2, 0.1]}>
        <boxGeometry args={[0.38, 0.85, 0.38]} />
        <meshStandardMaterial {...mat} />
      </mesh>
      <mesh castShadow position={[0.8, 1.2, 0.1]}>
        <boxGeometry args={[0.38, 0.85, 0.38]} />
        <meshStandardMaterial {...mat} />
      </mesh>
      {/* Fists */}
      <mesh castShadow position={[-0.82, 0.7, 0.15]}>
        <boxGeometry args={[0.42, 0.32, 0.42]} />
        <meshStandardMaterial color="#4a5060" roughness={0.5} metalness={0.5} />
      </mesh>
      <mesh castShadow position={[0.82, 0.7, 0.15]}>
        <boxGeometry args={[0.42, 0.32, 0.42]} />
        <meshStandardMaterial color="#4a5060" roughness={0.5} metalness={0.5} />
      </mesh>
      {/* Head */}
      <mesh castShadow position={[0, 2.0, 0]}>
        <boxGeometry args={[0.7, 0.65, 0.6]} />
        <meshStandardMaterial {...mat} />
      </mesh>
      {/* Eyes - angry red */}
      <mesh position={[-0.18, 2.08, 0.31]}>
        <boxGeometry args={[0.15, 0.08, 0.02]} />
        <meshStandardMaterial color="#ff4400" emissive="#ff2200" emissiveIntensity={4} />
      </mesh>
      <mesh position={[0.18, 2.08, 0.31]}>
        <boxGeometry args={[0.15, 0.08, 0.02]} />
        <meshStandardMaterial color="#ff4400" emissive="#ff2200" emissiveIntensity={4} />
      </mesh>
      {/* Spikes */}
      {[-0.3, 0, 0.3].map((x, i) => (
        <mesh key={i} castShadow position={[x, 2.38, 0]}>
          <coneGeometry args={[0.08, 0.2, 5]} />
          <meshStandardMaterial color="#3a4050" roughness={0.5} metalness={0.4} />
        </mesh>
      ))}
    </group>
  );
}

function WraithMesh({ color, emissive, flash }: { color: string; emissive: string; flash: boolean }) {
  const t = useRef(Math.random() * 100);
  const groupRef = useRef<THREE.Group>(null);

  useFrame((_, delta) => {
    t.current += delta;
    if (groupRef.current) {
      groupRef.current.position.y = Math.sin(t.current * 2.5) * 0.2;
    }
  });

  return (
    <group ref={groupRef}>
      {/* Robe/cloak - tapered */}
      <mesh castShadow position={[0, 0.6, 0]}>
        <coneGeometry args={[0.5, 1.2, 8]} />
        <meshStandardMaterial
          color={flash ? "#ffffff" : color}
          emissive={emissive}
          emissiveIntensity={flash ? 3 : 1.0}
          transparent
          opacity={0.85}
          roughness={0.9}
        />
      </mesh>
      {/* Upper body */}
      <mesh castShadow position={[0, 1.1, 0]}>
        <boxGeometry args={[0.6, 0.5, 0.4]} />
        <meshStandardMaterial
          color={flash ? "#ffffff" : color}
          emissive={emissive}
          emissiveIntensity={flash ? 3 : 1.0}
          transparent opacity={0.9} roughness={0.9}
        />
      </mesh>
      {/* Head/hood */}
      <mesh castShadow position={[0, 1.55, 0]}>
        <sphereGeometry args={[0.32, 8, 8]} />
        <meshStandardMaterial
          color={flash ? "#ffffff" : "#2a1550"}
          emissive="#1a0040"
          emissiveIntensity={flash ? 3 : 0.5}
          roughness={0.8}
        />
      </mesh>
      {/* Glowing eyes - cyan */}
      <mesh position={[-0.1, 1.58, 0.3]}>
        <sphereGeometry args={[0.055, 6, 6]} />
        <meshStandardMaterial color="#00ccff" emissive="#00aaff" emissiveIntensity={5} />
      </mesh>
      <mesh position={[0.1, 1.58, 0.3]}>
        <sphereGeometry args={[0.055, 6, 6]} />
        <meshStandardMaterial color="#00ccff" emissive="#00aaff" emissiveIntensity={5} />
      </mesh>
      {/* Arm tendrils */}
      <mesh castShadow position={[-0.45, 1.05, 0]} rotation={[0, 0, 0.6]}>
        <boxGeometry args={[0.08, 0.5, 0.08]} />
        <meshStandardMaterial color={color} emissive={emissive} emissiveIntensity={0.8} transparent opacity={0.7} roughness={0.9} />
      </mesh>
      <mesh castShadow position={[0.45, 1.05, 0]} rotation={[0, 0, -0.6]}>
        <boxGeometry args={[0.08, 0.5, 0.08]} />
        <meshStandardMaterial color={color} emissive={emissive} emissiveIntensity={0.8} transparent opacity={0.7} roughness={0.9} />
      </mesh>
    </group>
  );
}

function EliteMesh({ color, emissive, flash }: { color: string; emissive: string; flash: boolean }) {
  const t = useRef(Math.random() * 100);

  useFrame((_, delta) => { t.current += delta; });

  const mat = { color: flash ? "#ffffff" : color, emissive, emissiveIntensity: flash ? 3 : 0.8, roughness: 0.4, metalness: 0.5 };

  return (
    <group>
      {/* Armored legs */}
      <mesh castShadow position={[-0.28, 0.55, 0]}>
        <boxGeometry args={[0.3, 1.1, 0.3]} />
        <meshStandardMaterial {...mat} />
      </mesh>
      <mesh castShadow position={[0.28, 0.55, 0]}>
        <boxGeometry args={[0.3, 1.1, 0.3]} />
        <meshStandardMaterial {...mat} />
      </mesh>
      {/* Torso */}
      <mesh castShadow position={[0, 1.4, 0]}>
        <boxGeometry args={[0.85, 0.85, 0.55]} />
        <meshStandardMaterial {...mat} />
      </mesh>
      {/* Spiked pauldrons */}
      <mesh castShadow position={[-0.65, 1.55, 0]}>
        <boxGeometry args={[0.3, 0.25, 0.45]} />
        <meshStandardMaterial color="#6a0000" roughness={0.4} metalness={0.6} />
      </mesh>
      <mesh castShadow position={[0.65, 1.55, 0]}>
        <boxGeometry args={[0.3, 0.25, 0.45]} />
        <meshStandardMaterial color="#6a0000" roughness={0.4} metalness={0.6} />
      </mesh>
      {/* Arms */}
      <mesh castShadow position={[-0.62, 1.2, 0]}>
        <boxGeometry args={[0.28, 0.8, 0.28]} />
        <meshStandardMaterial {...mat} />
      </mesh>
      <mesh castShadow position={[0.62, 1.2, 0]}>
        <boxGeometry args={[0.28, 0.8, 0.28]} />
        <meshStandardMaterial {...mat} />
      </mesh>
      {/* Clawed hands */}
      {[-0.62, 0.62].map((x, i) => (
        [-0.1, 0.0, 0.1].map((ox, j) => (
          <mesh key={`${i}-${j}`} castShadow position={[x + ox * 0.5, 0.75, 0.15]}>
            <boxGeometry args={[0.06, 0.2, 0.06]} />
            <meshStandardMaterial color="#aa0000" roughness={0.4} metalness={0.4} />
          </mesh>
        ))
      ))}
      {/* Head */}
      <mesh castShadow position={[0, 2.05, 0]}>
        <boxGeometry args={[0.55, 0.55, 0.5]} />
        <meshStandardMaterial {...mat} />
      </mesh>
      {/* Horns */}
      <mesh castShadow position={[-0.22, 2.38, 0]} rotation={[0, 0, -0.4]}>
        <coneGeometry args={[0.07, 0.4, 6]} />
        <meshStandardMaterial color="#3a0000" roughness={0.5} metalness={0.3} />
      </mesh>
      <mesh castShadow position={[0.22, 2.38, 0]} rotation={[0, 0, 0.4]}>
        <coneGeometry args={[0.07, 0.4, 6]} />
        <meshStandardMaterial color="#3a0000" roughness={0.5} metalness={0.3} />
      </mesh>
      {/* Yellow glowing eyes */}
      <mesh position={[-0.14, 2.1, 0.26]}>
        <boxGeometry args={[0.1, 0.06, 0.02]} />
        <meshStandardMaterial color="#ffff00" emissive="#ffcc00" emissiveIntensity={5} />
      </mesh>
      <mesh position={[0.14, 2.1, 0.26]}>
        <boxGeometry args={[0.1, 0.06, 0.02]} />
        <meshStandardMaterial color="#ffff00" emissive="#ffcc00" emissiveIntensity={5} />
      </mesh>
      {/* Weapon: massive greatsword */}
      <mesh castShadow position={[0.85, 1.0, 0.2]} rotation={[0.2, 0, 0.3]}>
        <boxGeometry args={[0.1, 1.6, 0.06]} />
        <meshStandardMaterial color="#c0c0e0" roughness={0.15} metalness={0.95} emissive="#8080ff" emissiveIntensity={0.5} />
      </mesh>
    </group>
  );
}

function BossMesh({ color, emissive, flash }: { color: string; emissive: string; flash: boolean }) {
  const t = useRef(Math.random() * 100);
  const auraRef = useRef<THREE.Mesh>(null);

  useFrame((_, delta) => {
    t.current += delta;
    if (auraRef.current) {
      auraRef.current.rotation.y = t.current * 0.8;
      auraRef.current.scale.y = 1 + Math.sin(t.current * 2) * 0.1;
    }
  });

  const mat = { color: flash ? "#ffffff" : color, emissive, emissiveIntensity: flash ? 5 : 2.0, roughness: 0.3, metalness: 0.6 };

  return (
    <group>
      {/* Aura ring */}
      <mesh ref={auraRef} position={[0, 0.1, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[1.8, 0.08, 8, 32]} />
        <meshStandardMaterial color="#cc00ff" emissive="#aa00ff" emissiveIntensity={3} transparent opacity={0.7} />
      </mesh>

      {/* Massive legs */}
      <mesh castShadow position={[-0.55, 0.75, 0]}>
        <boxGeometry args={[0.7, 1.5, 0.65]} />
        <meshStandardMaterial {...mat} />
      </mesh>
      <mesh castShadow position={[0.55, 0.75, 0]}>
        <boxGeometry args={[0.7, 1.5, 0.65]} />
        <meshStandardMaterial {...mat} />
      </mesh>
      {/* Torso — imposing */}
      <mesh castShadow position={[0, 2.0, 0]}>
        <boxGeometry args={[1.8, 1.4, 1.0]} />
        <meshStandardMaterial {...mat} />
      </mesh>
      {/* Massive arms */}
      <mesh castShadow position={[-1.35, 1.8, 0.2]}>
        <boxGeometry args={[0.65, 1.4, 0.65]} />
        <meshStandardMaterial {...mat} />
      </mesh>
      <mesh castShadow position={[1.35, 1.8, 0.2]}>
        <boxGeometry args={[0.65, 1.4, 0.65]} />
        <meshStandardMaterial {...mat} />
      </mesh>
      {/* Head */}
      <mesh castShadow position={[0, 3.05, 0]}>
        <boxGeometry args={[1.1, 0.9, 0.85]} />
        <meshStandardMaterial {...mat} />
      </mesh>
      {/* Crown of thorns */}
      {[0, 1, 2, 3, 4, 5].map((i) => {
        const angle = (i / 6) * Math.PI * 2;
        return (
          <mesh key={i} castShadow position={[Math.sin(angle) * 0.45, 3.6, Math.cos(angle) * 0.35]}>
            <coneGeometry args={[0.07, 0.4, 5]} />
            <meshStandardMaterial color="#4a0050" roughness={0.4} metalness={0.5} />
          </mesh>
        );
      })}
      {/* Glowing magenta eyes */}
      <mesh position={[-0.25, 3.1, 0.44]}>
        <boxGeometry args={[0.2, 0.1, 0.02]} />
        <meshStandardMaterial color="#ff00ff" emissive="#cc00cc" emissiveIntensity={6} />
      </mesh>
      <mesh position={[0.25, 3.1, 0.44]}>
        <boxGeometry args={[0.2, 0.1, 0.02]} />
        <meshStandardMaterial color="#ff00ff" emissive="#cc00cc" emissiveIntensity={6} />
      </mesh>
      {/* Boss aura light */}
      <pointLight color="#aa00ff" intensity={3} distance={15} decay={2} />
    </group>
  );
}

export function Enemy3D({ enemy }: EnemyProps) {
  const groupRef = useRef<THREE.Group>(null);
  const healthBarGroupRef = useRef<THREE.Group>(null);

  useFrame(({ camera }) => {
    if (!groupRef.current) return;
    groupRef.current.position.set(enemy.x, 0, enemy.z);

    // Face player direction
    const dx = -enemy.vx;
    const dz = -enemy.vz;
    if (Math.abs(dx) > 0.01 || Math.abs(dz) > 0.01) {
      groupRef.current.rotation.y = Math.atan2(dx, dz) + Math.PI;
    }

    // Health bar always faces camera
    if (healthBarGroupRef.current) {
      healthBarGroupRef.current.quaternion.copy(camera.quaternion);
    }
  });

  const flash = enemy.hitFlashTimer > 0;
  const meshProps = { color: enemy.color, emissive: enemy.emissive, flash };

  // Boss health bar height depends on scale
  const hpBarHeight = enemy.scale * 2.5 + 0.5;

  return (
    <group ref={groupRef}>
      <group scale={enemy.scale}>
        {enemy.type === "scuttler" && <ScuttlerMesh {...meshProps} />}
        {enemy.type === "brute" && <BruteMesh {...meshProps} />}
        {enemy.type === "wraith" && <WraithMesh {...meshProps} />}
        {enemy.type === "elite" && <EliteMesh {...meshProps} />}
        {enemy.type === "boss" && <BossMesh {...meshProps} />}
      </group>

      {/* Health bar */}
      <group ref={healthBarGroupRef} position={[0, hpBarHeight, 0]}>
        <HealthBar healthPct={enemy.hp / enemy.maxHp} />
      </group>
    </group>
  );
}
