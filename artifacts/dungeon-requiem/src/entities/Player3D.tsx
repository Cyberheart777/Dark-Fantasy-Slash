/**
 * Player3D.tsx
 * Low-poly warrior player mesh with walk/attack/dash animations.
 * Reads game state directly from the gs ref each frame.
 */

import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import type { GameState } from "../game/GameScene";

interface PlayerProps {
  gs: React.RefObject<GameState | null>;
}

export function Player3D({ gs }: PlayerProps) {
  const groupRef      = useRef<THREE.Group>(null);
  const bodyRef       = useRef<THREE.Mesh>(null);
  const leftArmRef    = useRef<THREE.Group>(null);
  const rightArmRef   = useRef<THREE.Group>(null);
  const legsRef       = useRef<THREE.Group>(null);
  const swordRef      = useRef<THREE.Group>(null);
  const capeRef       = useRef<THREE.Mesh>(null);
  const playerLtRef   = useRef<THREE.PointLight>(null);
  const t             = useRef(0);
  const lastX         = useRef(0);
  const lastZ         = useRef(0);

  useFrame((_, delta) => {
    if (!gs.current) return;
    t.current += delta;
    const p = gs.current.player;
    if (!groupRef.current) return;

    // Position & facing
    groupRef.current.position.set(p.x, 0, p.z);
    groupRef.current.rotation.y = p.angle + Math.PI;

    const isMoving = Math.abs(p.x - lastX.current) > 0.001 || Math.abs(p.z - lastZ.current) > 0.001;
    lastX.current = p.x;
    lastZ.current = p.z;

    // Walk animation
    if (leftArmRef.current && rightArmRef.current && legsRef.current) {
      if (isMoving && !p.isDashing) {
        const freq = 8, amp = 0.5;
        leftArmRef.current.rotation.x  =  Math.sin(t.current * freq) * amp;
        rightArmRef.current.rotation.x = -Math.sin(t.current * freq) * amp;
        const lg = legsRef.current.children;
        if (lg[0]) (lg[0] as THREE.Group).rotation.x =  Math.sin(t.current * freq) * amp;
        if (lg[1]) (lg[1] as THREE.Group).rotation.x = -Math.sin(t.current * freq) * amp;
      } else {
        // Idle breathing
        leftArmRef.current.rotation.x  = Math.sin(t.current * 1.5) * 0.05;
        rightArmRef.current.rotation.x = Math.sin(t.current * 1.5) * 0.05 + 0.1;
        const lg = legsRef.current.children;
        if (lg[0]) (lg[0] as THREE.Group).rotation.x = 0;
        if (lg[1]) (lg[1] as THREE.Group).rotation.x = 0;
      }
    }

    // Body bob
    if (bodyRef.current) {
      bodyRef.current.position.y = 1.0 + Math.sin(t.current * 1.5) * 0.03;
    }

    // Sword swing
    if (swordRef.current) {
      if (p.isAttacking) {
        const dur = 1 / gs.current.progression.stats.attackSpeed;
        const prog = 1 - Math.max(0, p.attackTimer) / dur;
        swordRef.current.rotation.x = prog * Math.PI * 1.4 - Math.PI * 0.5;
        swordRef.current.rotation.z = Math.sin(prog * Math.PI) * 0.5;
      } else {
        swordRef.current.rotation.x = THREE.MathUtils.lerp(swordRef.current.rotation.x, 0, 0.15);
        swordRef.current.rotation.z = THREE.MathUtils.lerp(swordRef.current.rotation.z, 0, 0.15);
      }
    }

    // Dash lean
    if (groupRef.current) {
      groupRef.current.rotation.x = THREE.MathUtils.lerp(
        groupRef.current.rotation.x,
        p.isDashing ? -0.25 : 0,
        0.2
      );
    }

    // Cape wave
    if (capeRef.current) {
      capeRef.current.rotation.x = Math.sin(t.current * 3) * 0.1;
    }

    // Player aura light (follows player in world space)
    if (playerLtRef.current) {
      playerLtRef.current.position.set(p.x, 2, p.z);
      const invPct = Math.max(0, p.invTimer / GAME_CONFIG_INV_TIME);
      playerLtRef.current.intensity = 1.5 + invPct * 3;
      if (invPct > 0.1) {
        playerLtRef.current.color.setRGB(1, 0.2, 0.1);
      } else {
        playerLtRef.current.color.setRGB(0.55, 0.45, 1.0);
      }
    }
  });

  const ARMOR  = "#5a7090";
  const SKIN   = "#d0a878";
  const CAPE   = "#8a0025";
  const SWORD  = "#d0d0f0";
  const BELT   = "#6a4a15";
  const EMIS   = "#0a1830";
  const EMIS_I = 0.45;

  return (
    <>
      <group ref={groupRef}>
        {/* Legs */}
        <group ref={legsRef}>
          <group position={[-0.2, 0.5, 0]}>
            <mesh castShadow>
              <boxGeometry args={[0.22, 0.55, 0.22]} />
              <meshStandardMaterial color={ARMOR} roughness={0.6} metalness={0.3} emissive={EMIS} emissiveIntensity={EMIS_I} />
            </mesh>
            <mesh position={[0, -0.32, 0.05]} castShadow>
              <boxGeometry args={[0.25, 0.18, 0.32]} />
              <meshStandardMaterial color="#2a1a0a" roughness={0.8} />
            </mesh>
          </group>
          <group position={[0.2, 0.5, 0]}>
            <mesh castShadow>
              <boxGeometry args={[0.22, 0.55, 0.22]} />
              <meshStandardMaterial color={ARMOR} roughness={0.6} metalness={0.3} emissive={EMIS} emissiveIntensity={EMIS_I} />
            </mesh>
            <mesh position={[0, -0.32, 0.05]} castShadow>
              <boxGeometry args={[0.25, 0.18, 0.32]} />
              <meshStandardMaterial color="#2a1a0a" roughness={0.8} />
            </mesh>
          </group>
        </group>

        {/* Torso */}
        <mesh ref={bodyRef} position={[0, 1.0, 0]} castShadow>
          <boxGeometry args={[0.65, 0.70, 0.38]} />
          <meshStandardMaterial color={ARMOR} roughness={0.55} metalness={0.35} emissive={EMIS} emissiveIntensity={EMIS_I} />
        </mesh>

        {/* Belt */}
        <mesh position={[0, 0.7, 0]} castShadow>
          <boxGeometry args={[0.68, 0.12, 0.40]} />
          <meshStandardMaterial color={BELT} roughness={0.8} />
        </mesh>

        {/* Pauldrons */}
        <mesh position={[-0.42, 1.22, 0]} castShadow>
          <boxGeometry args={[0.22, 0.18, 0.38]} />
          <meshStandardMaterial color="#3a5070" roughness={0.5} metalness={0.4} emissive={EMIS} emissiveIntensity={EMIS_I} />
        </mesh>
        <mesh position={[0.42, 1.22, 0]} castShadow>
          <boxGeometry args={[0.22, 0.18, 0.38]} />
          <meshStandardMaterial color="#3a5070" roughness={0.5} metalness={0.4} emissive={EMIS} emissiveIntensity={EMIS_I} />
        </mesh>

        {/* Cape */}
        <mesh ref={capeRef} position={[0, 1.0, -0.25]} castShadow>
          <boxGeometry args={[0.6, 0.8, 0.06]} />
          <meshStandardMaterial color={CAPE} roughness={0.95} emissive="#3a0010" emissiveIntensity={0.3} />
        </mesh>

        {/* Left arm + shield */}
        <group ref={leftArmRef} position={[-0.45, 1.15, 0]}>
          <mesh castShadow position={[0, -0.2, 0]}>
            <boxGeometry args={[0.2, 0.45, 0.2]} />
            <meshStandardMaterial color={ARMOR} roughness={0.6} metalness={0.3} emissive={EMIS} emissiveIntensity={EMIS_I} />
          </mesh>
          <mesh castShadow position={[0, -0.47, 0]}>
            <boxGeometry args={[0.22, 0.18, 0.22]} />
            <meshStandardMaterial color="#3a5070" roughness={0.5} metalness={0.5} />
          </mesh>
          <mesh position={[-0.08, -0.3, 0.15]} castShadow>
            <boxGeometry args={[0.08, 0.4, 0.3]} />
            <meshStandardMaterial color="#2a3a50" roughness={0.5} metalness={0.5} />
          </mesh>
        </group>

        {/* Right arm + sword */}
        <group ref={rightArmRef} position={[0.45, 1.15, 0]}>
          <mesh castShadow position={[0, -0.2, 0]}>
            <boxGeometry args={[0.2, 0.45, 0.2]} />
            <meshStandardMaterial color={ARMOR} roughness={0.6} metalness={0.3} emissive={EMIS} emissiveIntensity={EMIS_I} />
          </mesh>
          <mesh castShadow position={[0, -0.47, 0]}>
            <boxGeometry args={[0.22, 0.18, 0.22]} />
            <meshStandardMaterial color="#3a5070" roughness={0.5} metalness={0.5} />
          </mesh>
          <group ref={swordRef} position={[0.1, -0.45, 0]}>
            <mesh castShadow position={[0, -0.5, 0]}>
              <boxGeometry args={[0.08, 1.0, 0.04]} />
              <meshStandardMaterial color={SWORD} roughness={0.2} metalness={0.9} emissive="#8080ff" emissiveIntensity={0.4} />
            </mesh>
            <mesh castShadow position={[0, -0.02, 0]}>
              <boxGeometry args={[0.28, 0.06, 0.08]} />
              <meshStandardMaterial color="#c0a020" roughness={0.4} metalness={0.7} />
            </mesh>
          </group>
        </group>

        {/* Head */}
        <group position={[0, 1.65, 0]}>
          <mesh castShadow>
            <boxGeometry args={[0.42, 0.42, 0.38]} />
            <meshStandardMaterial color={SKIN} roughness={0.85} />
          </mesh>
          <mesh castShadow position={[0, 0.2, 0]}>
            <boxGeometry args={[0.46, 0.28, 0.42]} />
            <meshStandardMaterial color="#3a5070" roughness={0.5} metalness={0.4} emissive={EMIS} emissiveIntensity={EMIS_I} />
          </mesh>
          {/* Visor slit — glows red */}
          <mesh position={[0, 0.12, 0.21]}>
            <boxGeometry args={[0.3, 0.05, 0.02]} />
            <meshStandardMaterial color="#ff2200" emissive="#ff2200" emissiveIntensity={3} />
          </mesh>
          <mesh castShadow position={[0, 0.4, 0]}>
            <boxGeometry args={[0.1, 0.2, 0.35]} />
            <meshStandardMaterial color={CAPE} roughness={0.9} />
          </mesh>
        </group>
      </group>

      {/* Player aura light — world space, follows player via useFrame */}
      <pointLight ref={playerLtRef} color="#8070ff" intensity={1.5} distance={10} decay={2} />
    </>
  );
}

// Pulled from config to avoid circular import in the light intensity calc
const GAME_CONFIG_INV_TIME = 0.8;
