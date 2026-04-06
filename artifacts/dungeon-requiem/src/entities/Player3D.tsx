/**
 * Player3D.tsx
 * Class-specific player meshes.
 * Warrior uses the real Meshy GLB model with skeletal animation.
 * Mage + Rogue retain low-poly geometry until their models arrive.
 */

import { useRef, useEffect, useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import { useGLTF, useAnimations } from "@react-three/drei";
import * as THREE from "three";
import type { GameState } from "../game/GameScene";

// Preload warrior model so there's no pop-in when the scene mounts
useGLTF.preload(`${import.meta.env.BASE_URL}models/warrior/Animation_Left_Slash.glb`);
useGLTF.preload(`${import.meta.env.BASE_URL}models/warrior/Character_output.glb`);

interface PlayerProps {
  gs: React.RefObject<GameState | null>;
}

export function Player3D({ gs }: PlayerProps) {
  const charClass = gs.current?.charClass ?? "warrior";

  if (charClass === "mage")  return <MageMeshAnimated  gs={gs} />;
  if (charClass === "rogue") return <RogueMeshAnimated gs={gs} />;
  return <WarriorGLB gs={gs} />;
}

// ─── Warrior — real 3D model ───────────────────────────────────────────────────

function WarriorGLB({ gs }: PlayerProps) {
  const lightRef = useRef<THREE.PointLight>(null);

  // Load the animation GLB — bundles the full skinned mesh + the slash clip
  const { scene, animations } = useGLTF(
    `${import.meta.env.BASE_URL}models/warrior/Animation_Left_Slash.glb`
  );

  // Clone so this instance has its own transform, materials, and skeleton
  const model = useMemo(() => {
    const clone = scene.clone(true);
    clone.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
        child.castShadow    = true;
        child.receiveShadow = true;
      }
    });
    return clone;
  }, [scene]);

  // Wire animations to the cloned model
  const { actions } = useAnimations(animations, model);

  useEffect(() => {
    const clipName = animations[0]?.name;
    if (!clipName || !actions[clipName]) return;
    actions[clipName]!.reset().setLoop(THREE.LoopRepeat, Infinity).play();
    return () => { actions[clipName]?.stop(); };
  }, [actions, animations]);

  // Priority 1 runs AFTER drei's useAnimations (priority 0), so our position
  // always wins over any root-motion baked into the animation clip.
  useFrame((_, delta) => {
    if (!gs.current) return;
    const p = gs.current.player;

    // Stamp model to exact player position every frame
    model.position.set(p.x, 0, p.z);
    model.rotation.y = p.angle + Math.PI;

    // Aura light
    if (lightRef.current) {
      lightRef.current.position.set(p.x, 2, p.z);
      const invPct = Math.max(0, p.invTimer / GAME_CONFIG_INV_TIME);
      lightRef.current.intensity = 1.5 + invPct * 3;
      lightRef.current.color.setRGB(
        invPct > 0.1 ? 1   : 0.55,
        invPct > 0.1 ? 0.2 : 0.45,
        invPct > 0.1 ? 0.1 : 1.0,
      );
    }

    // Suppress unused delta warning — animation mixer is handled by useAnimations
    void delta;
  }, 1); // <-- higher priority than useAnimations' default 0

  return (
    <>
      {/*
        Render the model directly — no wrapper group needed.
        Position is driven imperatively in useFrame above.
        Scale: Meshy exports in metres (1 unit = 1 m).
        If the character looks giant or tiny, change scale here.
      */}
      <primitive object={model} />
      <pointLight ref={lightRef} color="#8070ff" intensity={1.5} distance={10} decay={2} />
    </>
  );
}

// ─── Mage — low-poly geometry (placeholder until GLB arrives) ─────────────────

function MageMeshAnimated({ gs }: PlayerProps) {
  const groupRef    = useRef<THREE.Group>(null);
  const bodyRef     = useRef<THREE.Mesh>(null);
  const leftArmRef  = useRef<THREE.Group>(null);
  const rightArmRef = useRef<THREE.Group>(null);
  const legsRef     = useRef<THREE.Group>(null);
  const weaponRef   = useRef<THREE.Group>(null);
  const capeRef     = useRef<THREE.Mesh>(null);
  const playerLtRef = useRef<THREE.PointLight>(null);
  const t           = useRef(0);
  const lastX       = useRef(0);
  const lastZ       = useRef(0);
  const weaponSwing = useRef(0);
  const lastAttack  = useRef(0);

  useFrame((_, delta) => {
    if (!gs.current || !groupRef.current) return;
    t.current += delta;
    const p = gs.current.player;
    groupRef.current.position.set(p.x, 0, p.z);
    groupRef.current.rotation.y = p.angle + Math.PI;
    const isMoving = Math.abs(p.x - lastX.current) > 0.001 || Math.abs(p.z - lastZ.current) > 0.001;
    lastX.current = p.x; lastZ.current = p.z;
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
    if (bodyRef.current) bodyRef.current.position.y = 1.0 + Math.sin(t.current * 1.5) * 0.03;
    if (p.attackTrigger !== lastAttack.current) { lastAttack.current = p.attackTrigger; weaponSwing.current = 1; }
    if (weaponSwing.current > 0) weaponSwing.current = Math.max(0, weaponSwing.current - delta * 5);
    if (weaponRef.current) {
      const swp = weaponSwing.current;
      if (swp > 0) { const prog = 1 - swp; weaponRef.current.rotation.x = prog * Math.PI * 1.4 - Math.PI * 0.5; weaponRef.current.rotation.z = Math.sin(prog * Math.PI) * 0.5; }
      else { weaponRef.current.rotation.x = THREE.MathUtils.lerp(weaponRef.current.rotation.x, 0, 0.15); weaponRef.current.rotation.z = THREE.MathUtils.lerp(weaponRef.current.rotation.z, 0, 0.15); }
    }
    groupRef.current.rotation.x = THREE.MathUtils.lerp(groupRef.current.rotation.x, p.isDashing ? -0.25 : 0, 0.2);
    if (capeRef.current) capeRef.current.rotation.x = Math.sin(t.current * 3) * 0.1;
    if (playerLtRef.current) {
      playerLtRef.current.position.set(p.x, 2, p.z);
      const invPct = Math.max(0, p.invTimer / GAME_CONFIG_INV_TIME);
      playerLtRef.current.intensity = 1.5 + invPct * 3;
      if (invPct > 0.1) playerLtRef.current.color.setRGB(1, 0.2, 0.1);
      else playerLtRef.current.color.setRGB(0.8, 0.3, 1.0);
    }
  });

  const ROBE = "#5a2090"; const INNER = "#380a60"; const SKIN = "#dac8a8";
  const STAFF = "#4a3060"; const ORB = "#cc66ff"; const TRIM = "#8030c0";
  return (
    <>
      <group ref={groupRef}>
        <group ref={legsRef}>
          <group position={[-0.18, 0.45, 0]}><mesh castShadow><boxGeometry args={[0.24, 0.58, 0.28]} /><meshStandardMaterial color={ROBE} roughness={0.95} emissive={INNER} emissiveIntensity={0.3} /></mesh></group>
          <group position={[0.18, 0.45, 0]}><mesh castShadow><boxGeometry args={[0.24, 0.58, 0.28]} /><meshStandardMaterial color={ROBE} roughness={0.95} emissive={INNER} emissiveIntensity={0.3} /></mesh></group>
        </group>
        <mesh ref={bodyRef} position={[0, 1.02, 0]} castShadow><boxGeometry args={[0.62, 0.72, 0.36]} /><meshStandardMaterial color={ROBE} roughness={0.9} emissive={INNER} emissiveIntensity={0.25} /></mesh>
        <mesh position={[0, 1.02, 0.19]}><boxGeometry args={[0.18, 0.18, 0.01]} /><meshStandardMaterial color={ORB} emissive={ORB} emissiveIntensity={2.5} /></mesh>
        <mesh position={[-0.40, 1.25, 0]} castShadow><boxGeometry args={[0.18, 0.16, 0.34]} /><meshStandardMaterial color={TRIM} roughness={0.7} metalness={0.2} /></mesh>
        <mesh position={[0.40, 1.25, 0]} castShadow><boxGeometry args={[0.18, 0.16, 0.34]} /><meshStandardMaterial color={TRIM} roughness={0.7} metalness={0.2} /></mesh>
        <mesh ref={capeRef} position={[0, 1.0, -0.26]} castShadow><boxGeometry args={[0.58, 0.88, 0.06]} /><meshStandardMaterial color={INNER} roughness={0.95} emissive="#1a004a" emissiveIntensity={0.4} /></mesh>
        <group ref={leftArmRef} position={[-0.42, 1.18, 0]}>
          <mesh castShadow position={[0, -0.2, 0]}><boxGeometry args={[0.18, 0.44, 0.18]} /><meshStandardMaterial color={ROBE} roughness={0.9} /></mesh>
          <mesh castShadow position={[0, -0.46, 0]}><boxGeometry args={[0.16, 0.18, 0.16]} /><meshStandardMaterial color={SKIN} roughness={0.85} /></mesh>
        </group>
        <group ref={rightArmRef} position={[0.42, 1.18, 0]}>
          <mesh castShadow position={[0, -0.2, 0]}><boxGeometry args={[0.18, 0.44, 0.18]} /><meshStandardMaterial color={ROBE} roughness={0.9} /></mesh>
          <mesh castShadow position={[0, -0.46, 0]}><boxGeometry args={[0.16, 0.18, 0.16]} /><meshStandardMaterial color={SKIN} roughness={0.85} /></mesh>
          <group ref={weaponRef} position={[0.08, -0.4, 0]}>
            <mesh castShadow position={[0, -0.55, 0]}><boxGeometry args={[0.07, 1.1, 0.07]} /><meshStandardMaterial color={STAFF} roughness={0.8} metalness={0.1} /></mesh>
            <mesh position={[0, 0.08, 0]}><sphereGeometry args={[0.18, 8, 6]} /><meshStandardMaterial color={ORB} emissive={ORB} emissiveIntensity={3} roughness={0.1} /></mesh>
            <mesh position={[0, 0.08, 0]}><sphereGeometry args={[0.25, 6, 4]} /><meshStandardMaterial color={ORB} emissive={ORB} emissiveIntensity={1.2} transparent opacity={0.25} /></mesh>
          </group>
        </group>
        <group position={[0, 1.66, 0]}>
          <mesh castShadow><boxGeometry args={[0.40, 0.40, 0.36]} /><meshStandardMaterial color={SKIN} roughness={0.85} /></mesh>
          <mesh castShadow position={[0, 0.28, 0]}><boxGeometry args={[0.44, 0.44, 0.40]} /><meshStandardMaterial color={ROBE} roughness={0.9} emissive={INNER} emissiveIntensity={0.2} /></mesh>
          <mesh castShadow position={[0, 0.58, 0]}><boxGeometry args={[0.22, 0.36, 0.22]} /><meshStandardMaterial color={ROBE} roughness={0.9} /></mesh>
          <mesh position={[-0.1, 0.05, 0.19]}><boxGeometry args={[0.07, 0.06, 0.02]} /><meshStandardMaterial color={ORB} emissive={ORB} emissiveIntensity={4} /></mesh>
          <mesh position={[0.1, 0.05, 0.19]}><boxGeometry args={[0.07, 0.06, 0.02]} /><meshStandardMaterial color={ORB} emissive={ORB} emissiveIntensity={4} /></mesh>
        </group>
      </group>
      <pointLight ref={playerLtRef} color="#a030ff" intensity={1.5} distance={10} decay={2} />
    </>
  );
}

// ─── Rogue — low-poly geometry (placeholder until GLB arrives) ────────────────

function RogueMeshAnimated({ gs }: PlayerProps) {
  const groupRef    = useRef<THREE.Group>(null);
  const bodyRef     = useRef<THREE.Mesh>(null);
  const leftArmRef  = useRef<THREE.Group>(null);
  const rightArmRef = useRef<THREE.Group>(null);
  const legsRef     = useRef<THREE.Group>(null);
  const weaponRef   = useRef<THREE.Group>(null);
  const capeRef     = useRef<THREE.Mesh>(null);
  const playerLtRef = useRef<THREE.PointLight>(null);
  const t           = useRef(0);
  const lastX       = useRef(0);
  const lastZ       = useRef(0);
  const weaponSwing = useRef(0);
  const lastAttack  = useRef(0);

  useFrame((_, delta) => {
    if (!gs.current || !groupRef.current) return;
    t.current += delta;
    const p = gs.current.player;
    groupRef.current.position.set(p.x, 0, p.z);
    groupRef.current.rotation.y = p.angle + Math.PI;
    const isMoving = Math.abs(p.x - lastX.current) > 0.001 || Math.abs(p.z - lastZ.current) > 0.001;
    lastX.current = p.x; lastZ.current = p.z;
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
    if (bodyRef.current) bodyRef.current.position.y = 1.0 + Math.sin(t.current * 1.5) * 0.03;
    if (p.attackTrigger !== lastAttack.current) { lastAttack.current = p.attackTrigger; weaponSwing.current = 1; }
    if (weaponSwing.current > 0) weaponSwing.current = Math.max(0, weaponSwing.current - delta * 5);
    if (weaponRef.current) {
      const swp = weaponSwing.current;
      if (swp > 0) { const prog = 1 - swp; weaponRef.current.rotation.x = prog * Math.PI * 1.4 - Math.PI * 0.5; weaponRef.current.rotation.z = Math.sin(prog * Math.PI) * 0.5; }
      else { weaponRef.current.rotation.x = THREE.MathUtils.lerp(weaponRef.current.rotation.x, 0, 0.15); weaponRef.current.rotation.z = THREE.MathUtils.lerp(weaponRef.current.rotation.z, 0, 0.15); }
    }
    groupRef.current.rotation.x = THREE.MathUtils.lerp(groupRef.current.rotation.x, p.isDashing ? -0.25 : 0, 0.2);
    if (capeRef.current) capeRef.current.rotation.x = Math.sin(t.current * 3) * 0.1;
    if (playerLtRef.current) {
      playerLtRef.current.position.set(p.x, 2, p.z);
      const invPct = Math.max(0, p.invTimer / GAME_CONFIG_INV_TIME);
      playerLtRef.current.intensity = 1.5 + invPct * 3;
      if (invPct > 0.1) playerLtRef.current.color.setRGB(1, 0.2, 0.1);
      else playerLtRef.current.color.setRGB(0.1, 0.9, 0.5);
    }
  });

  const LEATHER = "#2a3a28"; const DARK = "#1a2618"; const SKIN = "#c8a070";
  const BLADE = "#b0e8c0"; const ACCENT = "#30c870"; const TRIM = "#4a6a44";
  return (
    <>
      <group ref={groupRef}>
        <group ref={legsRef}>
          <group position={[-0.18, 0.48, 0]}><mesh castShadow><boxGeometry args={[0.20, 0.54, 0.20]} /><meshStandardMaterial color={LEATHER} roughness={0.9} /></mesh><mesh position={[0, -0.3, 0.04]} castShadow><boxGeometry args={[0.22, 0.16, 0.30]} /><meshStandardMaterial color={DARK} roughness={0.85} /></mesh></group>
          <group position={[0.18, 0.48, 0]}><mesh castShadow><boxGeometry args={[0.20, 0.54, 0.20]} /><meshStandardMaterial color={LEATHER} roughness={0.9} /></mesh><mesh position={[0, -0.3, 0.04]} castShadow><boxGeometry args={[0.22, 0.16, 0.30]} /><meshStandardMaterial color={DARK} roughness={0.85} /></mesh></group>
        </group>
        <mesh ref={bodyRef} position={[0, 1.0, 0]} castShadow><boxGeometry args={[0.56, 0.68, 0.32]} /><meshStandardMaterial color={LEATHER} roughness={0.85} /></mesh>
        <mesh position={[0, 0.68, 0]} castShadow><boxGeometry args={[0.60, 0.10, 0.35]} /><meshStandardMaterial color={DARK} roughness={0.9} /></mesh>
        <mesh position={[-0.22, 0.68, 0.12]} castShadow><boxGeometry args={[0.10, 0.12, 0.08]} /><meshStandardMaterial color={TRIM} roughness={0.8} /></mesh>
        <mesh position={[0, 1.0, 0.17]}><boxGeometry args={[0.04, 0.6, 0.01]} /><meshStandardMaterial color={ACCENT} emissive={ACCENT} emissiveIntensity={1.5} /></mesh>
        <mesh ref={capeRef} position={[0, 1.05, -0.20]} castShadow><boxGeometry args={[0.54, 0.72, 0.06]} /><meshStandardMaterial color={DARK} roughness={0.95} /></mesh>
        <group ref={leftArmRef} position={[-0.38, 1.14, 0]}>
          <mesh castShadow position={[0, -0.2, 0]}><boxGeometry args={[0.18, 0.42, 0.18]} /><meshStandardMaterial color={LEATHER} roughness={0.85} /></mesh>
          <mesh castShadow position={[0, -0.44, 0]}><boxGeometry args={[0.16, 0.16, 0.16]} /><meshStandardMaterial color={SKIN} roughness={0.85} /></mesh>
          <mesh position={[-0.06, -0.62, 0.08]} castShadow><boxGeometry args={[0.05, 0.38, 0.04]} /><meshStandardMaterial color={BLADE} emissive={ACCENT} emissiveIntensity={1.2} metalness={0.9} roughness={0.1} /></mesh>
        </group>
        <group ref={rightArmRef} position={[0.38, 1.14, 0]}>
          <mesh castShadow position={[0, -0.2, 0]}><boxGeometry args={[0.18, 0.42, 0.18]} /><meshStandardMaterial color={LEATHER} roughness={0.85} /></mesh>
          <mesh castShadow position={[0, -0.44, 0]}><boxGeometry args={[0.16, 0.16, 0.16]} /><meshStandardMaterial color={SKIN} roughness={0.85} /></mesh>
          <group ref={weaponRef} position={[0.06, -0.55, 0.08]}>
            <mesh castShadow position={[0, -0.18, 0]}><boxGeometry args={[0.05, 0.42, 0.04]} /><meshStandardMaterial color={BLADE} emissive={ACCENT} emissiveIntensity={1.2} metalness={0.9} roughness={0.1} /></mesh>
            <mesh position={[0, 0.02, 0]}><boxGeometry args={[0.18, 0.05, 0.05]} /><meshStandardMaterial color={TRIM} metalness={0.7} roughness={0.3} /></mesh>
          </group>
        </group>
        <group position={[0, 1.64, 0]}>
          <mesh castShadow><boxGeometry args={[0.38, 0.38, 0.34]} /><meshStandardMaterial color={SKIN} roughness={0.85} /></mesh>
          <mesh castShadow position={[0, 0.2, 0]}><boxGeometry args={[0.42, 0.30, 0.38]} /><meshStandardMaterial color={DARK} roughness={0.95} /></mesh>
          <mesh position={[0, 0.0, 0.18]}><boxGeometry args={[0.38, 0.14, 0.04]} /><meshStandardMaterial color={LEATHER} roughness={0.9} /></mesh>
          <mesh position={[-0.09, 0.06, 0.18]}><boxGeometry args={[0.07, 0.055, 0.02]} /><meshStandardMaterial color={ACCENT} emissive={ACCENT} emissiveIntensity={4} /></mesh>
          <mesh position={[0.09, 0.06, 0.18]}><boxGeometry args={[0.07, 0.055, 0.02]} /><meshStandardMaterial color={ACCENT} emissive={ACCENT} emissiveIntensity={4} /></mesh>
        </group>
      </group>
      <pointLight ref={playerLtRef} color="#20c870" intensity={1.5} distance={10} decay={2} />
    </>
  );
}

const GAME_CONFIG_INV_TIME = 0.8;
