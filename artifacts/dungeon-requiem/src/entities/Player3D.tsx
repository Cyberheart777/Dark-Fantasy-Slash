/**
 * Player3D.tsx
 * Low-poly warrior player mesh with animation.
 * Reads directly from GameManager refs — no React state.
 */

import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import type { GameManager } from "../game/GameManager";

interface PlayerProps {
  manager: GameManager;
}

export function Player3D({ manager }: PlayerProps) {
  const groupRef = useRef<THREE.Group>(null);
  const bodyRef = useRef<THREE.Mesh>(null);
  const leftArmRef = useRef<THREE.Group>(null);
  const rightArmRef = useRef<THREE.Group>(null);
  const legsRef = useRef<THREE.Group>(null);
  const swordRef = useRef<THREE.Group>(null);
  const capeRef = useRef<THREE.Mesh>(null);
  const playerLightRef = useRef<THREE.PointLight>(null);
  const t = useRef(0);
  const lastX = useRef(0);
  const lastZ = useRef(0);

  useFrame((_, delta) => {
    t.current += delta;
    const p = manager.player;
    if (!groupRef.current) return;

    // Position
    groupRef.current.position.set(p.x, 0, p.z);
    groupRef.current.rotation.y = p.angle + Math.PI;

    const isMoving = Math.abs(p.x - lastX.current) > 0.001 || Math.abs(p.z - lastZ.current) > 0.001;
    lastX.current = p.x;
    lastZ.current = p.z;

    // Walk animation
    if (leftArmRef.current && rightArmRef.current && legsRef.current) {
      if (isMoving && !p.isDashing) {
        const walkFreq = 8;
        const walkAmp = 0.5;
        leftArmRef.current.rotation.x = Math.sin(t.current * walkFreq) * walkAmp;
        rightArmRef.current.rotation.x = -Math.sin(t.current * walkFreq) * walkAmp;
        const legGroup = legsRef.current.children;
        if (legGroup[0]) (legGroup[0] as THREE.Group).rotation.x = Math.sin(t.current * walkFreq) * walkAmp;
        if (legGroup[1]) (legGroup[1] as THREE.Group).rotation.x = -Math.sin(t.current * walkFreq) * walkAmp;
      } else {
        // Idle breathing
        leftArmRef.current.rotation.x = Math.sin(t.current * 1.5) * 0.05;
        rightArmRef.current.rotation.x = Math.sin(t.current * 1.5) * 0.05 + 0.1;
        const legGroup = legsRef.current.children;
        if (legGroup[0]) (legGroup[0] as THREE.Group).rotation.x = 0;
        if (legGroup[1]) (legGroup[1] as THREE.Group).rotation.x = 0;
      }
    }

    // Idle body bob
    if (bodyRef.current) {
      bodyRef.current.position.y = 1.0 + Math.sin(t.current * 1.5) * 0.03;
    }

    // Attack animation
    if (swordRef.current) {
      if (p.isAttacking) {
        const attackProgress = 1 - Math.max(0, p.attackTimer) / (1 / manager.progression.stats.attackSpeed);
        const swingAngle = attackProgress * Math.PI * 1.4 - Math.PI * 0.5;
        swordRef.current.rotation.x = swingAngle;
        swordRef.current.rotation.z = Math.sin(attackProgress * Math.PI) * 0.5;
      } else {
        swordRef.current.rotation.x = THREE.MathUtils.lerp(swordRef.current.rotation.x, 0, 0.15);
        swordRef.current.rotation.z = THREE.MathUtils.lerp(swordRef.current.rotation.z, 0, 0.15);
      }
    }

    // Dash: lean forward
    if (p.isDashing && groupRef.current) {
      groupRef.current.rotation.x = THREE.MathUtils.lerp(groupRef.current.rotation.x, -0.25, 0.2);
    } else if (groupRef.current) {
      groupRef.current.rotation.x = THREE.MathUtils.lerp(groupRef.current.rotation.x, 0, 0.1);
    }

    // Cape wave
    if (capeRef.current) {
      capeRef.current.rotation.x = Math.sin(t.current * 3) * 0.1;
    }

    // Player aura light
    if (playerLightRef.current) {
      playerLightRef.current.position.set(p.x, 1.5, p.z);
      // Flash on hit
      const invPct = p.invincibleTimer / 0.8;
      playerLightRef.current.intensity = 0.3 + invPct * 1.5;
      if (invPct > 0.1) {
        playerLightRef.current.color.setRGB(1, 0.2, 0.2);
      } else {
        playerLightRef.current.color.setRGB(0.5, 0.4, 1.0);
      }
    }
  });

  const ARMOR_COLOR = "#5a7090";
  const SKIN_COLOR = "#d0a878";
  const CAPE_COLOR = "#8a0025";
  const SWORD_COLOR = "#d0d0f0";
  const BELT_COLOR = "#6a4a15";
  const ARMOR_EMISSIVE = "#0a1830";
  const ARMOR_EMISSIVE_INT = 0.4;

  return (
    <>
      <group ref={groupRef}>
        {/* Legs */}
        <group ref={legsRef} position={[0, 0, 0]}>
          {/* Left leg */}
          <group position={[-0.2, 0.5, 0]}>
            <mesh castShadow>
              <boxGeometry args={[0.22, 0.55, 0.22]} />
              <meshStandardMaterial color={ARMOR_COLOR} roughness={0.6} metalness={0.3} emissive={ARMOR_EMISSIVE} emissiveIntensity={ARMOR_EMISSIVE_INT} />
            </mesh>
            {/* Boot */}
            <mesh position={[0, -0.32, 0.05]} castShadow>
              <boxGeometry args={[0.25, 0.18, 0.32]} />
              <meshStandardMaterial color="#2a1a0a" roughness={0.8} />
            </mesh>
          </group>
          {/* Right leg */}
          <group position={[0.2, 0.5, 0]}>
            <mesh castShadow>
              <boxGeometry args={[0.22, 0.55, 0.22]} />
              <meshStandardMaterial color={ARMOR_COLOR} roughness={0.6} metalness={0.3} emissive={ARMOR_EMISSIVE} emissiveIntensity={ARMOR_EMISSIVE_INT} />
            </mesh>
            <mesh position={[0, -0.32, 0.05]} castShadow>
              <boxGeometry args={[0.25, 0.18, 0.32]} />
              <meshStandardMaterial color="#2a1a0a" roughness={0.8} />
            </mesh>
          </group>
        </group>

        {/* Body (torso) */}
        <mesh ref={bodyRef} position={[0, 1.0, 0]} castShadow>
          <boxGeometry args={[0.65, 0.70, 0.38]} />
          <meshStandardMaterial color={ARMOR_COLOR} roughness={0.55} metalness={0.35} emissive={ARMOR_EMISSIVE} emissiveIntensity={ARMOR_EMISSIVE_INT} />
        </mesh>

        {/* Belt */}
        <mesh position={[0, 0.7, 0]} castShadow>
          <boxGeometry args={[0.68, 0.12, 0.40]} />
          <meshStandardMaterial color={BELT_COLOR} roughness={0.8} />
        </mesh>

        {/* Pauldrons (shoulders) */}
        <mesh position={[-0.42, 1.22, 0]} castShadow>
          <boxGeometry args={[0.22, 0.18, 0.38]} />
          <meshStandardMaterial color="#3a5070" roughness={0.5} metalness={0.4} />
        </mesh>
        <mesh position={[0.42, 1.22, 0]} castShadow>
          <boxGeometry args={[0.22, 0.18, 0.38]} />
          <meshStandardMaterial color="#3a5070" roughness={0.5} metalness={0.4} />
        </mesh>

        {/* Cape */}
        <mesh ref={capeRef} position={[0, 1.0, -0.25]} castShadow>
          <boxGeometry args={[0.6, 0.8, 0.06]} />
          <meshStandardMaterial color={CAPE_COLOR} roughness={0.95} />
        </mesh>

        {/* Left arm */}
        <group ref={leftArmRef} position={[-0.45, 1.15, 0]}>
          <mesh castShadow position={[0, -0.2, 0]}>
            <boxGeometry args={[0.2, 0.45, 0.2]} />
            <meshStandardMaterial color={ARMOR_COLOR} roughness={0.6} metalness={0.3} />
          </mesh>
          {/* Gauntlet */}
          <mesh castShadow position={[0, -0.47, 0]}>
            <boxGeometry args={[0.22, 0.18, 0.22]} />
            <meshStandardMaterial color="#3a5070" roughness={0.5} metalness={0.5} />
          </mesh>
          {/* Shield */}
          <mesh position={[-0.08, -0.3, 0.15]} castShadow>
            <boxGeometry args={[0.08, 0.4, 0.3]} />
            <meshStandardMaterial color="#2a3a50" roughness={0.5} metalness={0.5} />
          </mesh>
        </group>

        {/* Right arm + sword */}
        <group ref={rightArmRef} position={[0.45, 1.15, 0]}>
          <mesh castShadow position={[0, -0.2, 0]}>
            <boxGeometry args={[0.2, 0.45, 0.2]} />
            <meshStandardMaterial color={ARMOR_COLOR} roughness={0.6} metalness={0.3} />
          </mesh>
          <mesh castShadow position={[0, -0.47, 0]}>
            <boxGeometry args={[0.22, 0.18, 0.22]} />
            <meshStandardMaterial color="#3a5070" roughness={0.5} metalness={0.5} />
          </mesh>
          {/* Sword */}
          <group ref={swordRef} position={[0.1, -0.45, 0]}>
            {/* Blade */}
            <mesh castShadow position={[0, -0.5, 0]}>
              <boxGeometry args={[0.08, 1.0, 0.04]} />
              <meshStandardMaterial
                color={SWORD_COLOR}
                roughness={0.2}
                metalness={0.9}
                emissive="#a0a0ff"
                emissiveIntensity={0.2}
              />
            </mesh>
            {/* Guard */}
            <mesh castShadow position={[0, -0.02, 0]}>
              <boxGeometry args={[0.28, 0.06, 0.08]} />
              <meshStandardMaterial color="#c0a020" roughness={0.4} metalness={0.7} />
            </mesh>
          </group>
        </group>

        {/* Head */}
        <group position={[0, 1.65, 0]}>
          {/* Face */}
          <mesh castShadow>
            <boxGeometry args={[0.42, 0.42, 0.38]} />
            <meshStandardMaterial color={SKIN_COLOR} roughness={0.85} />
          </mesh>
          {/* Helmet */}
          <mesh castShadow position={[0, 0.2, 0]}>
            <boxGeometry args={[0.46, 0.28, 0.42]} />
            <meshStandardMaterial color="#3a5070" roughness={0.5} metalness={0.4} />
          </mesh>
          {/* Helmet visor slit */}
          <mesh position={[0, 0.12, 0.21]}>
            <boxGeometry args={[0.3, 0.05, 0.02]} />
            <meshStandardMaterial color="#ff4400" emissive="#ff2200" emissiveIntensity={2} />
          </mesh>
          {/* Helmet plume */}
          <mesh castShadow position={[0, 0.4, 0]}>
            <boxGeometry args={[0.1, 0.2, 0.35]} />
            <meshStandardMaterial color={CAPE_COLOR} roughness={0.9} />
          </mesh>
        </group>
      </group>

      {/* Follows player position via useFrame above — bright enough to illuminate the warrior */}
      <pointLight
        ref={playerLightRef}
        color="#8070ff"
        intensity={2.0}
        distance={10}
        decay={1.5}
      />
    </>
  );
}
