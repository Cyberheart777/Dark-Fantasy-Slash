/**
 * Player3D.tsx
 * Low-poly character mesh with class-specific appearance.
 * Warrior = sword & shield / Mage = staff + orb / Rogue = twin daggers + hood.
 */

import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import type { GameState } from "../game/GameScene";

interface PlayerProps {
  gs: React.RefObject<GameState | null>;
}

export function Player3D({ gs }: PlayerProps) {
  const groupRef    = useRef<THREE.Group>(null);
  const bodyRef     = useRef<THREE.Mesh>(null);
  const leftArmRef  = useRef<THREE.Group>(null);
  const rightArmRef = useRef<THREE.Group>(null);
  const legsRef     = useRef<THREE.Group>(null);
  const weaponRef   = useRef<THREE.Group>(null);
  const capeRef     = useRef<THREE.Mesh>(null);
  const playerLtRef = useRef<THREE.PointLight>(null);
  const t                = useRef(0);
  const lastX            = useRef(0);
  const lastZ            = useRef(0);
  const weaponSwingProg  = useRef(0);
  const lastAttackTrigger = useRef(0);

  useFrame((_, delta) => {
    if (!gs.current) return;
    t.current += delta;
    const p = gs.current.player;
    if (!groupRef.current) return;

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
        leftArmRef.current.rotation.x  = Math.sin(t.current * 1.5) * 0.05;
        rightArmRef.current.rotation.x = Math.sin(t.current * 1.5) * 0.05 + 0.1;
        const lg = legsRef.current.children;
        if (lg[0]) (lg[0] as THREE.Group).rotation.x = 0;
        if (lg[1]) (lg[1] as THREE.Group).rotation.x = 0;
      }
    }

    if (bodyRef.current) {
      bodyRef.current.position.y = 1.0 + Math.sin(t.current * 1.5) * 0.03;
    }

    // Weapon swing — fire-and-forget, driven by attackTrigger counter
    if (p.attackTrigger !== lastAttackTrigger.current) {
      lastAttackTrigger.current = p.attackTrigger;
      weaponSwingProg.current = 1;
    }
    if (weaponSwingProg.current > 0) {
      weaponSwingProg.current = Math.max(0, weaponSwingProg.current - delta * 5);
    }
    if (weaponRef.current) {
      const swp = weaponSwingProg.current;
      if (swp > 0) {
        const prog = 1 - swp;
        weaponRef.current.rotation.x = prog * Math.PI * 1.4 - Math.PI * 0.5;
        weaponRef.current.rotation.z = Math.sin(prog * Math.PI) * 0.5;
      } else {
        weaponRef.current.rotation.x = THREE.MathUtils.lerp(weaponRef.current.rotation.x, 0, 0.15);
        weaponRef.current.rotation.z = THREE.MathUtils.lerp(weaponRef.current.rotation.z, 0, 0.15);
      }
    }

    // Dash lean
    if (groupRef.current) {
      groupRef.current.rotation.x = THREE.MathUtils.lerp(groupRef.current.rotation.x, p.isDashing ? -0.25 : 0, 0.2);
    }

    if (capeRef.current) {
      capeRef.current.rotation.x = Math.sin(t.current * 3) * 0.1;
    }

    // Aura light
    if (playerLtRef.current) {
      playerLtRef.current.position.set(p.x, 2, p.z);
      const invPct = Math.max(0, p.invTimer / GAME_CONFIG_INV_TIME);
      playerLtRef.current.intensity = 1.5 + invPct * 3;
      if (invPct > 0.1) {
        playerLtRef.current.color.setRGB(1, 0.2, 0.1);
      } else {
        const cls = gs.current.charClass;
        if (cls === "mage") playerLtRef.current.color.setRGB(0.8, 0.3, 1.0);
        else if (cls === "rogue") playerLtRef.current.color.setRGB(0.1, 0.9, 0.5);
        else playerLtRef.current.color.setRGB(0.55, 0.45, 1.0);
      }
    }
  });

  // Read charClass from gs — available because gsRef is initialized before render
  const charClass = gs.current?.charClass ?? "warrior";

  if (charClass === "mage") return <MageMesh groupRef={groupRef} bodyRef={bodyRef} leftArmRef={leftArmRef} rightArmRef={rightArmRef} legsRef={legsRef} weaponRef={weaponRef} capeRef={capeRef} playerLtRef={playerLtRef} />;
  if (charClass === "rogue") return <RogueMesh groupRef={groupRef} bodyRef={bodyRef} leftArmRef={leftArmRef} rightArmRef={rightArmRef} legsRef={legsRef} weaponRef={weaponRef} capeRef={capeRef} playerLtRef={playerLtRef} />;
  return <WarriorMesh groupRef={groupRef} bodyRef={bodyRef} leftArmRef={leftArmRef} rightArmRef={rightArmRef} legsRef={legsRef} weaponRef={weaponRef} capeRef={capeRef} playerLtRef={playerLtRef} />;
}

// ─── Shared ref type ──────────────────────────────────────────────────────────

interface MeshRefs {
  groupRef: React.RefObject<THREE.Group | null>;
  bodyRef: React.RefObject<THREE.Mesh | null>;
  leftArmRef: React.RefObject<THREE.Group | null>;
  rightArmRef: React.RefObject<THREE.Group | null>;
  legsRef: React.RefObject<THREE.Group | null>;
  weaponRef: React.RefObject<THREE.Group | null>;
  capeRef: React.RefObject<THREE.Mesh | null>;
  playerLtRef: React.RefObject<THREE.PointLight | null>;
}

// ─── Warrior ──────────────────────────────────────────────────────────────────

function WarriorMesh({ groupRef, bodyRef, leftArmRef, rightArmRef, legsRef, weaponRef, capeRef, playerLtRef }: MeshRefs) {
  const ARMOR = "#5a7090"; const SKIN = "#d0a878"; const CAPE = "#8a0025";
  const SWORD = "#d0d0f0"; const BELT = "#6a4a15"; const EMIS = "#0a1830"; const EMIS_I = 0.45;
  return (
    <>
      <group ref={groupRef}>
        <group ref={legsRef}>
          <group position={[-0.2, 0.5, 0]}>
            <mesh castShadow><boxGeometry args={[0.22, 0.55, 0.22]} /><meshStandardMaterial color={ARMOR} roughness={0.6} metalness={0.3} emissive={EMIS} emissiveIntensity={EMIS_I} /></mesh>
            <mesh position={[0, -0.32, 0.05]} castShadow><boxGeometry args={[0.25, 0.18, 0.32]} /><meshStandardMaterial color="#2a1a0a" roughness={0.8} /></mesh>
          </group>
          <group position={[0.2, 0.5, 0]}>
            <mesh castShadow><boxGeometry args={[0.22, 0.55, 0.22]} /><meshStandardMaterial color={ARMOR} roughness={0.6} metalness={0.3} emissive={EMIS} emissiveIntensity={EMIS_I} /></mesh>
            <mesh position={[0, -0.32, 0.05]} castShadow><boxGeometry args={[0.25, 0.18, 0.32]} /><meshStandardMaterial color="#2a1a0a" roughness={0.8} /></mesh>
          </group>
        </group>
        <mesh ref={bodyRef} position={[0, 1.0, 0]} castShadow><boxGeometry args={[0.65, 0.70, 0.38]} /><meshStandardMaterial color={ARMOR} roughness={0.55} metalness={0.35} emissive={EMIS} emissiveIntensity={EMIS_I} /></mesh>
        <mesh position={[0, 0.7, 0]} castShadow><boxGeometry args={[0.68, 0.12, 0.40]} /><meshStandardMaterial color={BELT} roughness={0.8} /></mesh>
        <mesh position={[-0.42, 1.22, 0]} castShadow><boxGeometry args={[0.22, 0.18, 0.38]} /><meshStandardMaterial color="#3a5070" roughness={0.5} metalness={0.4} emissive={EMIS} emissiveIntensity={EMIS_I} /></mesh>
        <mesh position={[0.42, 1.22, 0]} castShadow><boxGeometry args={[0.22, 0.18, 0.38]} /><meshStandardMaterial color="#3a5070" roughness={0.5} metalness={0.4} emissive={EMIS} emissiveIntensity={EMIS_I} /></mesh>
        <mesh ref={capeRef} position={[0, 1.0, -0.25]} castShadow><boxGeometry args={[0.6, 0.8, 0.06]} /><meshStandardMaterial color={CAPE} roughness={0.95} emissive="#3a0010" emissiveIntensity={0.3} /></mesh>
        <group ref={leftArmRef} position={[-0.45, 1.15, 0]}>
          <mesh castShadow position={[0, -0.2, 0]}><boxGeometry args={[0.2, 0.45, 0.2]} /><meshStandardMaterial color={ARMOR} roughness={0.6} metalness={0.3} emissive={EMIS} emissiveIntensity={EMIS_I} /></mesh>
          <mesh castShadow position={[0, -0.47, 0]}><boxGeometry args={[0.22, 0.18, 0.22]} /><meshStandardMaterial color="#3a5070" roughness={0.5} metalness={0.5} /></mesh>
          <mesh position={[-0.08, -0.3, 0.15]} castShadow><boxGeometry args={[0.08, 0.4, 0.3]} /><meshStandardMaterial color="#2a3a50" roughness={0.5} metalness={0.5} /></mesh>
        </group>
        <group ref={rightArmRef} position={[0.45, 1.15, 0]}>
          <mesh castShadow position={[0, -0.2, 0]}><boxGeometry args={[0.2, 0.45, 0.2]} /><meshStandardMaterial color={ARMOR} roughness={0.6} metalness={0.3} emissive={EMIS} emissiveIntensity={EMIS_I} /></mesh>
          <mesh castShadow position={[0, -0.47, 0]}><boxGeometry args={[0.22, 0.18, 0.22]} /><meshStandardMaterial color="#3a5070" roughness={0.5} metalness={0.5} /></mesh>
          <group ref={weaponRef} position={[0.1, -0.45, 0]}>
            <mesh castShadow position={[0, -0.5, 0]}><boxGeometry args={[0.08, 1.0, 0.04]} /><meshStandardMaterial color={SWORD} roughness={0.2} metalness={0.9} emissive="#8080ff" emissiveIntensity={0.4} /></mesh>
            <mesh castShadow position={[0, -0.02, 0]}><boxGeometry args={[0.28, 0.06, 0.08]} /><meshStandardMaterial color="#c0a020" roughness={0.4} metalness={0.7} /></mesh>
          </group>
        </group>
        <group position={[0, 1.65, 0]}>
          <mesh castShadow><boxGeometry args={[0.42, 0.42, 0.38]} /><meshStandardMaterial color={SKIN} roughness={0.85} /></mesh>
          <mesh castShadow position={[0, 0.2, 0]}><boxGeometry args={[0.46, 0.28, 0.42]} /><meshStandardMaterial color="#3a5070" roughness={0.5} metalness={0.4} emissive={EMIS} emissiveIntensity={EMIS_I} /></mesh>
          <mesh position={[0, 0.12, 0.21]}><boxGeometry args={[0.3, 0.05, 0.02]} /><meshStandardMaterial color="#ff2200" emissive="#ff2200" emissiveIntensity={3} /></mesh>
          <mesh castShadow position={[0, 0.4, 0]}><boxGeometry args={[0.1, 0.2, 0.35]} /><meshStandardMaterial color={CAPE} roughness={0.9} /></mesh>
        </group>
      </group>
      <pointLight ref={playerLtRef} color="#8070ff" intensity={1.5} distance={10} decay={2} />
    </>
  );
}

// ─── Mage ─────────────────────────────────────────────────────────────────────

function MageMesh({ groupRef, bodyRef, leftArmRef, rightArmRef, legsRef, weaponRef, capeRef, playerLtRef }: MeshRefs) {
  const ROBE   = "#5a2090"; const INNER  = "#380a60"; const SKIN   = "#dac8a8";
  const STAFF  = "#4a3060"; const ORB    = "#cc66ff"; const TRIM   = "#8030c0";
  return (
    <>
      <group ref={groupRef}>
        {/* Robe lower (wide flowing) */}
        <group ref={legsRef}>
          <group position={[-0.18, 0.45, 0]}>
            <mesh castShadow><boxGeometry args={[0.24, 0.58, 0.28]} /><meshStandardMaterial color={ROBE} roughness={0.95} emissive={INNER} emissiveIntensity={0.3} /></mesh>
          </group>
          <group position={[0.18, 0.45, 0]}>
            <mesh castShadow><boxGeometry args={[0.24, 0.58, 0.28]} /><meshStandardMaterial color={ROBE} roughness={0.95} emissive={INNER} emissiveIntensity={0.3} /></mesh>
          </group>
        </group>
        {/* Robe body */}
        <mesh ref={bodyRef} position={[0, 1.02, 0]} castShadow><boxGeometry args={[0.62, 0.72, 0.36]} /><meshStandardMaterial color={ROBE} roughness={0.9} emissive={INNER} emissiveIntensity={0.25} /></mesh>
        {/* Glowing rune on chest */}
        <mesh position={[0, 1.02, 0.19]}><boxGeometry args={[0.18, 0.18, 0.01]} /><meshStandardMaterial color={ORB} emissive={ORB} emissiveIntensity={2.5} /></mesh>
        {/* Pauldrons */}
        <mesh position={[-0.40, 1.25, 0]} castShadow><boxGeometry args={[0.18, 0.16, 0.34]} /><meshStandardMaterial color={TRIM} roughness={0.7} metalness={0.2} /></mesh>
        <mesh position={[0.40, 1.25, 0]} castShadow><boxGeometry args={[0.18, 0.16, 0.34]} /><meshStandardMaterial color={TRIM} roughness={0.7} metalness={0.2} /></mesh>
        {/* Flowing back cloak */}
        <mesh ref={capeRef} position={[0, 1.0, -0.26]} castShadow><boxGeometry args={[0.58, 0.88, 0.06]} /><meshStandardMaterial color={INNER} roughness={0.95} emissive="#1a004a" emissiveIntensity={0.4} /></mesh>
        {/* Left arm (gesturing) */}
        <group ref={leftArmRef} position={[-0.42, 1.18, 0]}>
          <mesh castShadow position={[0, -0.2, 0]}><boxGeometry args={[0.18, 0.44, 0.18]} /><meshStandardMaterial color={ROBE} roughness={0.9} /></mesh>
          <mesh castShadow position={[0, -0.46, 0]}><boxGeometry args={[0.16, 0.18, 0.16]} /><meshStandardMaterial color={SKIN} roughness={0.85} /></mesh>
        </group>
        {/* Right arm (holding staff) */}
        <group ref={rightArmRef} position={[0.42, 1.18, 0]}>
          <mesh castShadow position={[0, -0.2, 0]}><boxGeometry args={[0.18, 0.44, 0.18]} /><meshStandardMaterial color={ROBE} roughness={0.9} /></mesh>
          <mesh castShadow position={[0, -0.46, 0]}><boxGeometry args={[0.16, 0.18, 0.16]} /><meshStandardMaterial color={SKIN} roughness={0.85} /></mesh>
          {/* Staff */}
          <group ref={weaponRef} position={[0.08, -0.4, 0]}>
            {/* Shaft */}
            <mesh castShadow position={[0, -0.55, 0]}><boxGeometry args={[0.07, 1.1, 0.07]} /><meshStandardMaterial color={STAFF} roughness={0.8} metalness={0.1} /></mesh>
            {/* Orb crown */}
            <mesh position={[0, 0.08, 0]}><sphereGeometry args={[0.18, 8, 6]} /><meshStandardMaterial color={ORB} emissive={ORB} emissiveIntensity={3} roughness={0.1} /></mesh>
            {/* Orb shell glow */}
            <mesh position={[0, 0.08, 0]}><sphereGeometry args={[0.25, 6, 4]} /><meshStandardMaterial color={ORB} emissive={ORB} emissiveIntensity={1.2} transparent opacity={0.25} /></mesh>
          </group>
        </group>
        {/* Head */}
        <group position={[0, 1.66, 0]}>
          <mesh castShadow><boxGeometry args={[0.40, 0.40, 0.36]} /><meshStandardMaterial color={SKIN} roughness={0.85} /></mesh>
          {/* Pointed hood */}
          <mesh castShadow position={[0, 0.28, 0]}><boxGeometry args={[0.44, 0.44, 0.40]} /><meshStandardMaterial color={ROBE} roughness={0.9} emissive={INNER} emissiveIntensity={0.2} /></mesh>
          <mesh castShadow position={[0, 0.58, 0]}><boxGeometry args={[0.22, 0.36, 0.22]} /><meshStandardMaterial color={ROBE} roughness={0.9} /></mesh>
          {/* Glowing eyes */}
          <mesh position={[-0.1, 0.05, 0.19]}><boxGeometry args={[0.07, 0.06, 0.02]} /><meshStandardMaterial color={ORB} emissive={ORB} emissiveIntensity={4} /></mesh>
          <mesh position={[0.1, 0.05, 0.19]}><boxGeometry args={[0.07, 0.06, 0.02]} /><meshStandardMaterial color={ORB} emissive={ORB} emissiveIntensity={4} /></mesh>
        </group>
      </group>
      <pointLight ref={playerLtRef} color="#a030ff" intensity={1.5} distance={10} decay={2} />
    </>
  );
}

// ─── Rogue ────────────────────────────────────────────────────────────────────

function RogueMesh({ groupRef, bodyRef, leftArmRef, rightArmRef, legsRef, weaponRef, capeRef, playerLtRef }: MeshRefs) {
  const LEATHER = "#2a3a28"; const DARK   = "#1a2618"; const SKIN  = "#c8a070";
  const BLADE   = "#b0e8c0"; const ACCENT = "#30c870"; const TRIM  = "#4a6a44";
  return (
    <>
      <group ref={groupRef}>
        {/* Slim legs */}
        <group ref={legsRef}>
          <group position={[-0.18, 0.48, 0]}>
            <mesh castShadow><boxGeometry args={[0.20, 0.54, 0.20]} /><meshStandardMaterial color={LEATHER} roughness={0.9} /></mesh>
            <mesh position={[0, -0.3, 0.04]} castShadow><boxGeometry args={[0.22, 0.16, 0.30]} /><meshStandardMaterial color={DARK} roughness={0.85} /></mesh>
          </group>
          <group position={[0.18, 0.48, 0]}>
            <mesh castShadow><boxGeometry args={[0.20, 0.54, 0.20]} /><meshStandardMaterial color={LEATHER} roughness={0.9} /></mesh>
            <mesh position={[0, -0.3, 0.04]} castShadow><boxGeometry args={[0.22, 0.16, 0.30]} /><meshStandardMaterial color={DARK} roughness={0.85} /></mesh>
          </group>
        </group>
        {/* Slim torso */}
        <mesh ref={bodyRef} position={[0, 1.0, 0]} castShadow><boxGeometry args={[0.56, 0.68, 0.32]} /><meshStandardMaterial color={LEATHER} roughness={0.85} /></mesh>
        {/* Belt with pouches */}
        <mesh position={[0, 0.68, 0]} castShadow><boxGeometry args={[0.60, 0.10, 0.35]} /><meshStandardMaterial color={DARK} roughness={0.9} /></mesh>
        <mesh position={[-0.22, 0.68, 0.12]} castShadow><boxGeometry args={[0.10, 0.12, 0.08]} /><meshStandardMaterial color={TRIM} roughness={0.8} /></mesh>
        {/* Trim lines on chest */}
        <mesh position={[0, 1.0, 0.17]}><boxGeometry args={[0.04, 0.6, 0.01]} /><meshStandardMaterial color={ACCENT} emissive={ACCENT} emissiveIntensity={1.5} /></mesh>
        {/* Dark hood/cloak back */}
        <mesh ref={capeRef} position={[0, 1.05, -0.20]} castShadow><boxGeometry args={[0.54, 0.72, 0.06]} /><meshStandardMaterial color={DARK} roughness={0.95} /></mesh>
        {/* Left arm + left dagger (idle) */}
        <group ref={leftArmRef} position={[-0.38, 1.14, 0]}>
          <mesh castShadow position={[0, -0.2, 0]}><boxGeometry args={[0.18, 0.42, 0.18]} /><meshStandardMaterial color={LEATHER} roughness={0.85} /></mesh>
          <mesh castShadow position={[0, -0.44, 0]}><boxGeometry args={[0.16, 0.16, 0.16]} /><meshStandardMaterial color={SKIN} roughness={0.85} /></mesh>
          {/* Left dagger */}
          <mesh position={[-0.06, -0.62, 0.08]} castShadow>
            <boxGeometry args={[0.05, 0.38, 0.04]} />
            <meshStandardMaterial color={BLADE} emissive={ACCENT} emissiveIntensity={1.2} metalness={0.9} roughness={0.1} />
          </mesh>
        </group>
        {/* Right arm + right dagger (weapon swing) */}
        <group ref={rightArmRef} position={[0.38, 1.14, 0]}>
          <mesh castShadow position={[0, -0.2, 0]}><boxGeometry args={[0.18, 0.42, 0.18]} /><meshStandardMaterial color={LEATHER} roughness={0.85} /></mesh>
          <mesh castShadow position={[0, -0.44, 0]}><boxGeometry args={[0.16, 0.16, 0.16]} /><meshStandardMaterial color={SKIN} roughness={0.85} /></mesh>
          <group ref={weaponRef} position={[0.06, -0.55, 0.08]}>
            <mesh castShadow position={[0, -0.18, 0]}>
              <boxGeometry args={[0.05, 0.42, 0.04]} />
              <meshStandardMaterial color={BLADE} emissive={ACCENT} emissiveIntensity={1.2} metalness={0.9} roughness={0.1} />
            </mesh>
            {/* Guard */}
            <mesh position={[0, 0.02, 0]}><boxGeometry args={[0.18, 0.05, 0.05]} /><meshStandardMaterial color={TRIM} metalness={0.7} roughness={0.3} /></mesh>
          </group>
        </group>
        {/* Head */}
        <group position={[0, 1.64, 0]}>
          <mesh castShadow><boxGeometry args={[0.38, 0.38, 0.34]} /><meshStandardMaterial color={SKIN} roughness={0.85} /></mesh>
          {/* Hood */}
          <mesh castShadow position={[0, 0.2, 0]}><boxGeometry args={[0.42, 0.30, 0.38]} /><meshStandardMaterial color={DARK} roughness={0.95} /></mesh>
          {/* Face wrap / scarf */}
          <mesh position={[0, 0.0, 0.18]}><boxGeometry args={[0.38, 0.14, 0.04]} /><meshStandardMaterial color={LEATHER} roughness={0.9} /></mesh>
          {/* Glowing eyes */}
          <mesh position={[-0.09, 0.06, 0.18]}><boxGeometry args={[0.07, 0.055, 0.02]} /><meshStandardMaterial color={ACCENT} emissive={ACCENT} emissiveIntensity={4} /></mesh>
          <mesh position={[0.09, 0.06, 0.18]}><boxGeometry args={[0.07, 0.055, 0.02]} /><meshStandardMaterial color={ACCENT} emissive={ACCENT} emissiveIntensity={4} /></mesh>
        </group>
      </group>
      <pointLight ref={playerLtRef} color="#20c870" intensity={1.5} distance={10} decay={2} />
    </>
  );
}

const GAME_CONFIG_INV_TIME = 0.8;
