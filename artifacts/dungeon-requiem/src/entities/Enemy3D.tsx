/**
 * Enemy3D.tsx
 * Renders each enemy based on its type.
 * Low-poly distinct silhouettes with per-type animations:
 *   - Scuttler: leg scurry + lunge strike
 *   - Brute: arm swing + stomp walk + overhead slam
 *   - Wraith: float bob + arm sway + robe sway + cast pulse
 *   - Elite: walk cycle + weapon sway + sword swing
 *   - Boss: aura + arm slam + breathing + two-handed slam
 *   - XP Goblin: hop (no attack — non-combat)
 *   - Warrior Champion: walk cycle + sword swing
 *   - Mage/Rogue Champion: idle animations (ranged — attack via projectile VFX)
 *   - ALL: spawn scale-in, death shrink+sink, hit flash
 */

import { Component, Suspense, useEffect, useMemo, useRef, type MutableRefObject, type ReactNode } from "react";
import { useFrame } from "@react-three/fiber";
import { useAnimations, useGLTF } from "@react-three/drei";
import * as THREE from "three";
import { clone as skeletonClone } from "three/examples/jsm/utils/SkeletonUtils.js";
import type { EnemyRuntime } from "../game/GameScene";
import { AFFIX_DEFS, AFFIX_TYPES, isAffixed, type EnemyAffix } from "../data/AffixData";

interface EnemyProps {
  enemy: EnemyRuntime;
}

/**
 * Path to the warrior GLB. Same file the player uses, so useGLTF's cache
 * means no double-fetch when both player and champion render in the same
 * scene. Vite's BASE_URL resolves the GitHub Pages subpath.
 */
const WARRIOR_GLB_URL = `${import.meta.env.BASE_URL}models/warrior/Character_output.glb`;

// ─── Shared animation helpers ────────────────────────────────────────────────

/** Returns a walk speed factor based on enemy velocity. */
function getWalkSpeed(e: EnemyRuntime): number {
  return Math.sqrt(e.vx * e.vx + e.vz * e.vz);
}

/**
 * Compute attack animation state from the raw attackTimer/attackInterval
 * values threaded from EnemyRuntime. Returns:
 *   - windup:  0..1, ramps toward 1 as the enemy prepares to strike
 *   - strike:  0..1, momentary pulse right after an attack fires (decays ~0.2s)
 *
 * Detects "attacking" by watching the timer decrease, and "justAttacked" by
 * the reset jump from ~0 back up to attackInterval. When the enemy is out of
 * range the timer is frozen by the game loop, so windup decays back to 0.
 */
function updateAttackState(
  attackTimer: number,
  attackInterval: number,
  prevRef: MutableRefObject<number>,
  windupRef: MutableRefObject<number>,
  strikeRef: MutableRefObject<number>,
  delta: number,
): { windup: number; strike: number } {
  const prev = prevRef.current;
  // Timer decreasing → enemy is in range and counting down to next attack
  const attacking = attackTimer < prev - 1e-4;
  // Timer reset (went from ~0 back up to attackInterval) → an attack just fired
  const justAttacked = attackTimer > prev + 0.1;
  prevRef.current = attackTimer;

  const hasValidInterval = attackInterval > 0 && attackInterval < 99;
  // Windup ramps 0→1 over the last 0.4s before the next strike
  const windupTarget = attacking && hasValidInterval
    ? Math.max(0, Math.min(1, 1 - attackTimer / 0.4))
    : 0;
  // Smooth lerp so motion blends with existing walk cycle
  windupRef.current += (windupTarget - windupRef.current) * Math.min(1, delta * 15);

  if (justAttacked) strikeRef.current = 1;
  // Strike pulse decays over ~0.2s
  strikeRef.current = Math.max(0, strikeRef.current - delta * 5);

  return { windup: windupRef.current, strike: strikeRef.current };
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

function ScuttlerMesh({ color, emissive, flash, attackTimer, attackInterval }: { color: string; emissive: string; flash: boolean; attackTimer: number; attackInterval: number }) {
  const t = useRef(Math.random() * 100);
  const legRefs = useRef<THREE.Mesh[]>([]);
  const bodyGroupRef = useRef<THREE.Group>(null);
  // Attack anim state
  const prevAttackRef = useRef(attackTimer);
  const windupRef = useRef(0);
  const strikeRef = useRef(0);

  useFrame((_, delta) => {
    t.current += delta;
    legRefs.current.forEach((leg, i) => {
      if (leg) leg.rotation.x = Math.sin(t.current * 12 + i * 1.2) * 0.5;
    });

    const { windup, strike } = updateAttackState(attackTimer, attackInterval, prevAttackRef, windupRef, strikeRef, delta);
    if (bodyGroupRef.current) {
      // Windup: coil back slightly (tilt up + pull z). Strike: lunge forward.
      const crouch = windup * 0.25;
      const lunge = strike * 0.5 - windup * 0.15;
      bodyGroupRef.current.position.z = lunge;
      bodyGroupRef.current.position.y = crouch * 0.1;
      bodyGroupRef.current.rotation.x = -crouch * 0.3 + strike * 0.2;
    }
  });

  return (
    <group ref={bodyGroupRef}>
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

function BruteMesh({ color, emissive, flash, walkSpeed, attackTimer, attackInterval }: { color: string; emissive: string; flash: boolean; walkSpeed: number; attackTimer: number; attackInterval: number }) {
  const t = useRef(Math.random() * 100);
  const bodyRef = useRef<THREE.Mesh>(null);
  const leftArmRef = useRef<THREE.Mesh>(null);
  const rightArmRef = useRef<THREE.Mesh>(null);
  const leftLegRef = useRef<THREE.Mesh>(null);
  const rightLegRef = useRef<THREE.Mesh>(null);
  const prevAttackRef = useRef(attackTimer);
  const windupRef = useRef(0);
  const strikeRef = useRef(0);

  useFrame((_, delta) => {
    t.current += delta;
    const moving = walkSpeed > 0.3;
    const freq = 5;
    const swing = moving ? Math.sin(t.current * freq) : 0;
    const { windup, strike } = updateAttackState(attackTimer, attackInterval, prevAttackRef, windupRef, strikeRef, delta);
    // Body sway + stomp bob + slight lean forward on strike
    if (bodyRef.current) {
      bodyRef.current.rotation.y = swing * 0.08;
      bodyRef.current.rotation.x = strike * 0.35 - windup * 0.1;
      bodyRef.current.position.y = 1.3 + (moving ? Math.abs(Math.sin(t.current * freq * 2)) * 0.06 : Math.sin(t.current * 0.8) * 0.02);
    }
    // Arm swing overlaid with overhead slam:
    //   windup → arms raise up (rotation.x negative = arm goes backward/up with pivot at shoulder)
    //   strike → arms slam down hard (positive)
    const slam = -windup * 1.8 + strike * 2.2;
    if (leftArmRef.current) {
      const walkSwing = moving ? -swing * 0.4 : Math.sin(t.current * 1.2) * 0.05;
      leftArmRef.current.rotation.x = walkSwing + slam;
    }
    if (rightArmRef.current) {
      const walkSwing = moving ? swing * 0.4 : Math.sin(t.current * 1.2 + 0.5) * 0.05;
      rightArmRef.current.rotation.x = walkSwing + slam;
    }
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

function WraithMesh({ color, emissive, flash, attackTimer, attackInterval }: { color: string; emissive: string; flash: boolean; attackTimer: number; attackInterval: number }) {
  const t = useRef(Math.random() * 100);
  const groupRef = useRef<THREE.Group>(null);
  const leftArmRef = useRef<THREE.Mesh>(null);
  const rightArmRef = useRef<THREE.Mesh>(null);
  const robeRef = useRef<THREE.Mesh>(null);
  const eyeLeftRef = useRef<THREE.Mesh>(null);
  const eyeRightRef = useRef<THREE.Mesh>(null);
  const prevAttackRef = useRef(attackTimer);
  const windupRef = useRef(0);
  const strikeRef = useRef(0);

  useFrame((_, delta) => {
    t.current += delta;
    const { windup, strike } = updateAttackState(attackTimer, attackInterval, prevAttackRef, windupRef, strikeRef, delta);
    if (groupRef.current) {
      // Float bob + slight rise on windup (gathering energy)
      groupRef.current.position.y = Math.sin(t.current * 2.5) * 0.2 + windup * 0.25;
    }
    // Arm sway — ghostly reaching; on windup both arms rise forward for cast; on strike they thrust
    const castRise = windup * 0.9 + strike * 0.4;
    if (leftArmRef.current) {
      leftArmRef.current.rotation.z = 0.6 + Math.sin(t.current * 1.8) * 0.3 - castRise * 0.5;
      leftArmRef.current.rotation.x = Math.sin(t.current * 1.3 + 1) * 0.2 - castRise * 0.7;
    }
    if (rightArmRef.current) {
      rightArmRef.current.rotation.z = -0.6 - Math.sin(t.current * 1.8 + 2) * 0.3 + castRise * 0.5;
      rightArmRef.current.rotation.x = Math.sin(t.current * 1.3) * 0.2 - castRise * 0.7;
    }
    // Robe sway
    if (robeRef.current) {
      robeRef.current.rotation.x = Math.sin(t.current * 1.5) * 0.08;
      robeRef.current.rotation.z = Math.sin(t.current * 1.1) * 0.05;
    }
    // Eye flicker — intensifies on windup, peaks on strike
    const flicker = 3 + Math.sin(t.current * 8) * 2 + windup * 4 + strike * 6;
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

function EliteMesh({ color, emissive, flash, walkSpeed, attackTimer, attackInterval }: { color: string; emissive: string; flash: boolean; walkSpeed: number; attackTimer: number; attackInterval: number }) {
  const t = useRef(Math.random() * 100);
  const leftLegRef = useRef<THREE.Mesh>(null);
  const rightLegRef = useRef<THREE.Mesh>(null);
  const leftArmRef = useRef<THREE.Mesh>(null);
  const rightArmRef = useRef<THREE.Mesh>(null);
  const torsoRef = useRef<THREE.Mesh>(null);
  const weaponRef = useRef<THREE.Mesh>(null);
  const prevAttackRef = useRef(attackTimer);
  const windupRef = useRef(0);
  const strikeRef = useRef(0);

  useFrame((_, delta) => {
    t.current += delta;
    const moving = walkSpeed > 0.3;
    const freq = 6;
    const swing = moving ? Math.sin(t.current * freq) : 0;
    const { windup, strike } = updateAttackState(attackTimer, attackInterval, prevAttackRef, windupRef, strikeRef, delta);
    // Legs
    if (leftLegRef.current) leftLegRef.current.rotation.x = swing * 0.3;
    if (rightLegRef.current) rightLegRef.current.rotation.x = -swing * 0.3;
    // Arms (opposite) — right arm (weapon arm) winds back then swings forward on strike
    if (leftArmRef.current) leftArmRef.current.rotation.x = moving ? -swing * 0.35 : Math.sin(t.current * 1.2) * 0.04;
    if (rightArmRef.current) {
      const walkBase = moving ? swing * 0.35 : Math.sin(t.current * 1.2 + 1) * 0.04;
      rightArmRef.current.rotation.x = walkBase - windup * 0.8 + strike * 1.4;
    }
    // Torso breathing + walk bob + twist into swing
    if (torsoRef.current) {
      torsoRef.current.position.y = 1.4 + (moving ? Math.abs(Math.sin(t.current * freq * 2)) * 0.04 : Math.sin(t.current * 1.5) * 0.02);
      torsoRef.current.rotation.z = (moving ? swing * 0.04 : 0) - windup * 0.12 + strike * 0.25;
    }
    // Weapon sway + diagonal slash on strike (rotate on Z for an arc across the body)
    if (weaponRef.current) {
      weaponRef.current.rotation.z = 0.3 + Math.sin(t.current * 2) * 0.08 + windup * 1.1 - strike * 2.0;
      weaponRef.current.rotation.x = 0.2 - windup * 0.4 + strike * 0.8;
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

function BossMesh({ color, emissive, flash, attackTimer, attackInterval }: { color: string; emissive: string; flash: boolean; attackTimer: number; attackInterval: number }) {
  const t = useRef(Math.random() * 100);
  const auraRef = useRef<THREE.Mesh>(null);
  const leftArmRef = useRef<THREE.Mesh>(null);
  const rightArmRef = useRef<THREE.Mesh>(null);
  const torsoRef = useRef<THREE.Mesh>(null);
  const prevAttackRef = useRef(attackTimer);
  const windupRef = useRef(0);
  const strikeRef = useRef(0);

  useFrame((_, delta) => {
    t.current += delta;
    const { windup, strike } = updateAttackState(attackTimer, attackInterval, prevAttackRef, windupRef, strikeRef, delta);
    if (auraRef.current) {
      auraRef.current.rotation.y = t.current * 0.8;
      // Aura expands on windup, flashes on strike
      auraRef.current.scale.y = 1 + Math.sin(t.current * 2) * 0.1 + strike * 0.8;
      const auraSpread = 1 + windup * 0.25 + strike * 0.4;
      auraRef.current.scale.x = auraSpread;
      auraRef.current.scale.z = auraSpread;
    }
    // Breathing — torso scale pulse + lean forward on strike
    if (torsoRef.current) {
      const breath = 1 + Math.sin(t.current * 1.2) * 0.03;
      torsoRef.current.scale.set(breath, 1, breath);
      torsoRef.current.rotation.x = strike * 0.3 - windup * 0.08;
    }
    // Menacing arm sway + overhead slam:
    //   windup → both arms raise up (negative X = raise)
    //   strike → slam down hard (positive X)
    const slam = -windup * 1.6 + strike * 2.4;
    if (leftArmRef.current) {
      leftArmRef.current.rotation.x = Math.sin(t.current * 1.5) * 0.15 + slam;
      leftArmRef.current.rotation.z = -0.1 + Math.sin(t.current * 0.8) * 0.05;
    }
    if (rightArmRef.current) {
      rightArmRef.current.rotation.x = Math.sin(t.current * 1.5 + 1.5) * 0.15 + slam;
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

// ─── Warrior Champion (GLB version — bigger version of the player) ──────────
//
// Uses the same warrior GLB the player uses (Character_output.glb), cloned
// via SkeletonUtils so the cloned skinned meshes have their own bones (the
// classic three.js skinned-mesh clone bug — see Player3D for the long
// story). All materials are deep-cloned and tinted hostile-red so it
// reads as an enemy at a glance, while still being clearly the same model
// as the player's warrior. Plays the same single clip with .position
// tracks stripped so the mixer can't fight the parent group's transform.
//
// Wrapped in a Suspense + ErrorBoundary fallback to the procedural
// WarriorChampionMesh, so if the GLB ever fails to load the champion
// still renders something.

function WarriorChampionGLBMesh({ flash }: { flash: boolean }) {
  const gltf = useGLTF(WARRIOR_GLB_URL);

  // Clone the scene with proper skeleton rebinding (see Player3D.tsx for
  // the explanation of why .clone(true) is wrong for skinned meshes).
  // Then deep-clone every material and tint it hostile-red.
  const scene = useMemo(() => {
    const cloned = skeletonClone(gltf.scene) as THREE.Group;
    cloned.traverse((obj) => {
      const mesh = obj as THREE.Mesh;
      if (!mesh.isMesh) return;
      const tintMat = (mat: THREE.Material): THREE.Material => {
        if (!(mat as THREE.MeshStandardMaterial).color) return mat;
        // Clone before mutating so we don't poison the shared cache that
        // the player's warrior also reads from.
        const m = (mat as THREE.MeshStandardMaterial).clone();
        m.color = new THREE.Color("#a04030");        // dark crimson
        m.emissive = new THREE.Color("#400a08");     // dim red glow
        m.emissiveIntensity = flash ? 4 : 0.6;
        return m;
      };
      mesh.material = Array.isArray(mesh.material)
        ? mesh.material.map(tintMat)
        : tintMat(mesh.material);
    });
    return cloned;
  }, [gltf.scene, flash]);

  // Strip position tracks like the player does so the mixer can't move
  // the scene root out from under us.
  const cleanedClips = useMemo(() => {
    return gltf.animations.map((clip) => {
      const copy = clip.clone();
      copy.tracks = copy.tracks.filter((t) => !/\.position(\[|$)/.test(t.name));
      return copy;
    });
  }, [gltf.animations]);

  const { actions, names } = useAnimations(cleanedClips, scene);
  useEffect(() => {
    if (names.length > 0) {
      actions[names[0]]?.reset().fadeIn(0.25).play();
    }
  }, [actions, names]);

  // No useFrame here — the parent <group scale={enemy.scale}> in Enemy3D
  // already handles position and per-enemy scale via outer transforms.
  // The cloned scene just renders as a primitive child.
  return <primitive object={scene} />;
}

class GLBErrorBoundary extends Component<
  { children: ReactNode; fallback: ReactNode },
  { hasError: boolean }
> {
  state = { hasError: false };
  static getDerivedStateFromError() { return { hasError: true }; }
  componentDidCatch(error: unknown) {
    console.error("[WarriorChampionGLB] load failed, using procedural fallback:", error);
  }
  render() {
    return this.state.hasError ? this.props.fallback : this.props.children;
  }
}

// Warrior-champion GLB preload disabled alongside the player-warrior
// revert — both now render with the procedural WarriorChampionMesh /
// WarriorMeshAnimated. Commented (not deleted) so the GLB path can
// be re-enabled by uncommenting if the asset is restored.
// useGLTF.preload(WARRIOR_GLB_URL);

function WarriorChampionMesh({ color, emissive, flash, walkSpeed, attackTimer, attackInterval }: { color: string; emissive: string; flash: boolean; walkSpeed: number; attackTimer: number; attackInterval: number }) {
  const t = useRef(Math.random() * 100);
  const auraRef = useRef<THREE.Mesh>(null);
  const leftLegRef = useRef<THREE.Mesh>(null);
  const rightLegRef = useRef<THREE.Mesh>(null);
  const swordArmRef = useRef<THREE.Mesh>(null);
  const prevAttackRef = useRef(attackTimer);
  const windupRef = useRef(0);
  const strikeRef = useRef(0);

  useFrame((_, delta) => {
    t.current += delta;
    const { windup, strike } = updateAttackState(attackTimer, attackInterval, prevAttackRef, windupRef, strikeRef, delta);
    if (auraRef.current) {
      auraRef.current.rotation.y = t.current * 0.6;
      // Aura flares on strike
      const flare = 1 + strike * 0.5 + windup * 0.15;
      auraRef.current.scale.set(flare, 1, flare);
    }
    const moving = walkSpeed > 0.3;
    const freq = 5.5;
    const swing = moving ? Math.sin(t.current * freq) : 0;
    if (leftLegRef.current) leftLegRef.current.rotation.x = swing * 0.3;
    if (rightLegRef.current) rightLegRef.current.rotation.x = -swing * 0.3;
    // Sword arm: idle sway or walk swing, overlaid with big overhead swing
    if (swordArmRef.current) {
      const base = moving ? swing * 0.3 : Math.sin(t.current * 1.5) * 0.1;
      swordArmRef.current.rotation.x = base - windup * 1.5 + strike * 2.2;
      swordArmRef.current.rotation.z = -windup * 0.3 + strike * 0.5;
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

// ─── Status Effect Visuals ───────────────────────────────────────────────────

const _poisonGeo = new THREE.SphereGeometry(0.06, 4, 4);
const _bleedGeo = new THREE.SphereGeometry(0.05, 4, 4);
const _frostGeo = new THREE.OctahedronGeometry(0.08, 0);
const _poisonMat = new THREE.MeshBasicMaterial({ color: "#00ff40", transparent: true, opacity: 0.8 });
const _bleedMat = new THREE.MeshBasicMaterial({ color: "#ff2020", transparent: true, opacity: 0.8 });
const _frostMat = new THREE.MeshBasicMaterial({ color: "#80ddff", transparent: true, opacity: 0.7 });

function StatusFxLayer({ poisonStacks, bleedTimer, slowTimer }: { poisonStacks: number; bleedTimer: number; slowTimer: number }) {
  const groupRef = useRef<THREE.Group>(null);
  const t = useRef(Math.random() * 100);

  useFrame((_, delta) => {
    if (!groupRef.current) return;
    t.current += delta;
    const time = t.current;
    const children = groupRef.current.children;

    // Poison drip particles (indices 0-2)
    for (let i = 0; i < 3; i++) {
      const m = children[i] as THREE.Mesh;
      if (!m) continue;
      m.visible = poisonStacks > 0;
      if (!m.visible) continue;
      const phase = (time * 1.5 + i * 1.3) % 2.0;
      m.position.set(
        Math.sin(i * 2.1) * 0.3,
        1.2 - phase * 0.8,
        Math.cos(i * 2.1) * 0.3,
      );
      const scale = Math.min(1, poisonStacks / 3) * (1 - phase / 2);
      m.scale.setScalar(scale);
    }

    // Bleed trail droplets (indices 3-4)
    for (let i = 0; i < 2; i++) {
      const m = children[3 + i] as THREE.Mesh;
      if (!m) continue;
      m.visible = bleedTimer > 0;
      if (!m.visible) continue;
      const phase = (time * 2.0 + i * 1.5) % 1.5;
      m.position.set(
        Math.sin(time * 3 + i * 4) * 0.2,
        0.8 - phase * 0.6,
        Math.cos(time * 3 + i * 4) * 0.2,
      );
      m.scale.setScalar(1 - phase / 1.5);
    }

    // Frost crystals orbiting (indices 5-6)
    for (let i = 0; i < 2; i++) {
      const m = children[5 + i] as THREE.Mesh;
      if (!m) continue;
      m.visible = slowTimer > 0;
      if (!m.visible) continue;
      const orbitAngle = time * 2 + i * Math.PI;
      m.position.set(
        Math.sin(orbitAngle) * 0.6,
        0.5 + Math.sin(time * 3 + i) * 0.15,
        Math.cos(orbitAngle) * 0.6,
      );
      m.rotation.set(time * 2, time * 3, 0);
    }
  });

  return (
    <group ref={groupRef}>
      {/* Poison drip (3 particles) */}
      <mesh geometry={_poisonGeo} material={_poisonMat} visible={false} />
      <mesh geometry={_poisonGeo} material={_poisonMat} visible={false} />
      <mesh geometry={_poisonGeo} material={_poisonMat} visible={false} />
      {/* Bleed droplets (2 particles) */}
      <mesh geometry={_bleedGeo} material={_bleedMat} visible={false} />
      <mesh geometry={_bleedGeo} material={_bleedMat} visible={false} />
      {/* Frost crystals (2 orbiting) */}
      <mesh geometry={_frostGeo} material={_frostMat} visible={false} />
      <mesh geometry={_frostGeo} material={_frostMat} visible={false} />
    </group>
  );
}

// ─── Elite Affix Aura ────────────────────────────────────────────────────────
// Affix data (color, name, description, icon symbol) lives in
// src/data/AffixData.ts. Renderers read AFFIX_DEFS — no inline color
// duplication. Module-scoped material cache keeps GC pressure down.

const _ringGeo = new THREE.RingGeometry(0.8, 1.0, 24);
const _ringMats: Record<string, THREE.MeshBasicMaterial> = {};
for (const id of AFFIX_TYPES) {
  _ringMats[id] = new THREE.MeshBasicMaterial({
    color: AFFIX_DEFS[id].color,
    transparent: true,
    opacity: 0.4,
    side: THREE.DoubleSide,
  });
}

function AffixAura({ affix, shieldHp, scale }: { affix: string; shieldHp: number; scale: number }) {
  const ref = useRef<THREE.Mesh>(null);
  const t = useRef(Math.random() * 100);

  useFrame((_, delta) => {
    if (!ref.current) return;
    t.current += delta;
    // Pulse opacity for active shield, steady for others
    const mat = ref.current.material as THREE.MeshBasicMaterial;
    if (affix === "shielded" && shieldHp > 0) {
      mat.opacity = 0.3 + Math.sin(t.current * 4) * 0.2;
    } else {
      mat.opacity = 0.25;
    }
    ref.current.rotation.z = t.current * 0.5;
  });

  const mat = _ringMats[affix];
  if (!mat) return null;

  return (
    <mesh ref={ref} geometry={_ringGeo} material={mat} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.05, 0]} scale={scale} />
  );
}

// ─── Affix Icon Overlay ──────────────────────────────────────────────────────
// Floating icon(s) above each affixed enemy. Camera-billboarded so they
// read flat from the top-down view. Today each enemy has at most one
// affix, but the implementation iterates a list so multi-affix support
// drops in trivially when the runtime adds it.
//
// Each affix is rendered as a distinct geometric primitive in the
// affix's color, so players read the SHAPE as the icon and the COLOR
// as the affix family (matching the existing aura ring tint):
//
//   shielded  → octagonal plate with white centre crossbar (shield)
//   vampiric  → diamond-rotated square (drop)
//   berserker → upward-pointing triangle (flame)
//
// Mobile-readable, no asset dependencies, no font/text rendering.

function AffixIcons({ enemy }: { enemy: EnemyRuntime }) {
  const groupRef = useRef<THREE.Group>(null);
  // Today: one affix per enemy. Build as a list so multi-affix drops
  // in without restructuring this component. Filter out "none" via
  // the AffixData helper.
  const affixes: EnemyAffix[] = isAffixed(enemy.affix as EnemyAffix) ? [enemy.affix as EnemyAffix] : [];
  // Sit above the existing health-bar Y (hpBarHeight = scale * 2.5 + 0.5
  // in the main render below) plus 0.55u of clearance. Rendered as a
  // sibling of the scaled enemy mesh so the icon size is fixed on
  // screen regardless of enemy scale.
  const yOffset = (enemy.scale ?? 1) * 2.5 + 1.05;
  useFrame(({ camera }) => {
    if (!groupRef.current) return;
    // Camera-billboard so the icon reads flat from the top-down view.
    // Parent group has no rotation, so a direct quaternion.copy is
    // sufficient (matches the HealthBar pattern at line ~1154).
    groupRef.current.quaternion.copy(camera.quaternion);
    groupRef.current.visible = enemy.dead !== true;
  });
  if (affixes.length === 0) return null;
  return (
    <group ref={groupRef} position={[0, yOffset, 0]}>
      {affixes.map((kind, i) => (
        <AffixIcon
          key={kind}
          affix={kind}
          // Stack horizontally — centred when N items, 0.55u apart.
          offsetX={(i - (affixes.length - 1) / 2) * 0.55}
        />
      ))}
    </group>
  );
}

function AffixIcon({ affix, offsetX }: { affix: EnemyAffix; offsetX: number }) {
  const def = AFFIX_DEFS[affix];
  const color = def.color;
  if (affix === "shielded") {
    return (
      <group position={[offsetX, 0, 0]}>
        {/* Octagonal plate — shield-shaped silhouette. */}
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.2, 0.2, 0.05, 8]} />
          <meshBasicMaterial color={color} transparent opacity={0.92} depthWrite={false} />
        </mesh>
        {/* White centre crossbar reads as a shield boss. */}
        <mesh position={[0, 0, 0.04]}>
          <boxGeometry args={[0.06, 0.22, 0.01]} />
          <meshBasicMaterial color="#ffffff" transparent opacity={0.85} depthWrite={false} />
        </mesh>
      </group>
    );
  }
  if (affix === "vampiric") {
    return (
      <group position={[offsetX, 0, 0]} rotation={[0, 0, Math.PI / 4]}>
        {/* Diamond — rotated cube, reads as a blood drop. */}
        <mesh>
          <boxGeometry args={[0.26, 0.26, 0.05]} />
          <meshBasicMaterial color={color} transparent opacity={0.92} depthWrite={false} />
        </mesh>
        {/* Inner darker centre for depth. */}
        <mesh position={[0, 0, 0.03]}>
          <boxGeometry args={[0.1, 0.1, 0.01]} />
          <meshBasicMaterial color="#660010" transparent opacity={0.7} depthWrite={false} />
        </mesh>
      </group>
    );
  }
  if (affix === "berserker") {
    return (
      <group position={[offsetX, 0, 0]}>
        {/* Triangle — cone pointing up, reads as a flame. */}
        <mesh>
          <coneGeometry args={[0.2, 0.36, 3]} />
          <meshBasicMaterial color={color} transparent opacity={0.92} depthWrite={false} />
        </mesh>
        {/* Hot-yellow inner core. */}
        <mesh scale={0.55}>
          <coneGeometry args={[0.2, 0.36, 3]} />
          <meshBasicMaterial color="#ffe080" transparent opacity={0.85} depthWrite={false} />
        </mesh>
      </group>
    );
  }
  return null;
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
  const attackProps = { attackTimer: enemy.attackTimer, attackInterval: enemy.attackInterval };
  const walkSpeed = getWalkSpeed(enemy);
  const hpBarHeight = enemy.scale * 2.5 + 0.5;

  return (
    <group ref={groupRef}>
      <group scale={enemy.scale}>
        {enemy.type === "scuttler" && <ScuttlerMesh {...meshProps} {...attackProps} />}
        {enemy.type === "brute" && <BruteMesh {...meshProps} {...attackProps} walkSpeed={walkSpeed} />}
        {enemy.type === "wraith" && <WraithMesh {...meshProps} {...attackProps} />}
        {enemy.type === "elite" && <EliteMesh {...meshProps} {...attackProps} walkSpeed={walkSpeed} />}
        {enemy.type === "boss" && <BossMesh {...meshProps} {...attackProps} />}
        {enemy.type === "xp_goblin" && <XPGoblinMesh {...meshProps} />}
        {/* Warrior champion GLB reverted to procedural alongside the
            player-warrior revert. Keeps the warrior silhouette
            consistent across player + champion enemy. */}
        {enemy.type === "warrior_champion" && (
          <WarriorChampionMesh {...meshProps} {...attackProps} walkSpeed={walkSpeed} />
        )}
        {enemy.type === "mage_champion" && <MageChampionMesh {...meshProps} />}
        {enemy.type === "rogue_champion" && <RogueChampionMesh {...meshProps} walkSpeed={walkSpeed} />}
      </group>

      {/* Status effect visuals */}
      <StatusFxLayer poisonStacks={enemy.poisonStacks} bleedTimer={enemy.bleedTimer} slowTimer={enemy.slowTimer} />

      {/* Elite affix aura ring */}
      {enemy.affix !== "none" && <AffixAura affix={enemy.affix} shieldHp={enemy.shieldHp} scale={enemy.scale} />}

      {/* Floating affix icon(s) above the health bar — primary
          communication layer for affix presence. Always visible,
          camera-billboarded, mobile-readable. Empty render when the
          enemy has no affix. */}
      <AffixIcons enemy={enemy} />

      {/* Health bar */}
      <group ref={healthBarGroupRef} position={[0, hpBarHeight, 0]}>
        <HealthBar healthPct={enemy.hp / enemy.maxHp} />
      </group>
    </group>
  );
}
