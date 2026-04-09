/**
 * Player3D.tsx
 * Class-specific player meshes.
 * Warrior now loads a Meshy-exported GLB (public/models/warrior/) with a
 * procedural low-poly fallback if the model fails to load or is still
 * streaming. Mage and Rogue remain procedural for now.
 */

import { Component, Suspense, useEffect, useMemo, useRef, type ReactNode } from "react";
import { useFrame } from "@react-three/fiber";
import { useAnimations, useGLTF } from "@react-three/drei";
import * as THREE from "three";
import type { GameState } from "../game/GameScene";

interface PlayerProps {
  gs: React.RefObject<GameState | null>;
}

// ─── Warrior GLB URL ──────────────────────────────────────────────────────────
// Vite exposes the public-asset base path via import.meta.env.BASE_URL. On a
// GitHub Pages build this is `/Dark-Fantasy-Slash/`; locally it's `/`. Both
// forms end in `/`, so concatenating the relative path below resolves cleanly
// without double slashes.
const WARRIOR_GLB_URL = `${import.meta.env.BASE_URL}models/warrior/Character_output.glb`;

export function Player3D({ gs }: PlayerProps) {
  const charClass = gs.current?.charClass ?? "warrior";

  if (charClass === "mage")  return <MageMeshAnimated  gs={gs} />;
  if (charClass === "rogue") return <RogueMeshAnimated gs={gs} />;
  return <WarriorMeshWithGLB gs={gs} />;
}

// ─── Warrior: GLB loader with procedural fallback ────────────────────────────
// Wraps the actual GLB loader in <Suspense> (for loading state) AND an
// <ErrorBoundary> (for fetch / parse failures). If either the network is
// offline or the model is missing, the player still sees the procedural
// warrior instead of an empty scene.

function WarriorMeshWithGLB({ gs }: PlayerProps) {
  return (
    <PlayerErrorBoundary fallback={<WarriorMeshAnimated gs={gs} />}>
      <Suspense fallback={<WarriorMeshAnimated gs={gs} />}>
        <WarriorMeshGLB gs={gs} />
      </Suspense>
    </PlayerErrorBoundary>
  );
}

class PlayerErrorBoundary extends Component<
  { children: ReactNode; fallback: ReactNode },
  { hasError: boolean }
> {
  state = { hasError: false };
  static getDerivedStateFromError() { return { hasError: true }; }
  componentDidCatch(error: unknown) {
    // Don't crash the whole scene — log once and fall back to procedural.
    console.error("[WarriorGLB] load failed, using procedural fallback:", error);
  }
  render() {
    return this.state.hasError ? this.props.fallback : this.props.children;
  }
}

function WarriorMeshGLB({ gs }: PlayerProps) {
  const groupRef = useRef<THREE.Group>(null);
  const gltf = useGLTF(WARRIOR_GLB_URL);

  // Deep-clone the scene so we don't mutate the shared cached instance
  // (useGLTF returns a singleton per URL), then normalize the root transform:
  //   - horizontally center the character on its bounding-box center
  //   - drop it so the bounding-box floor sits at y=0
  // This protects against GLBs that ship with a baked-in world offset on
  // their root node (which is why the character was rendering at the scene
  // origin instead of following the player in the first wiring attempt).
  const scene = useMemo(() => {
    const cloned = gltf.scene.clone(true);
    const bbox = new THREE.Box3().setFromObject(cloned);
    const center = new THREE.Vector3();
    bbox.getCenter(center);
    cloned.position.x -= center.x;
    cloned.position.z -= center.z;
    cloned.position.y -= bbox.min.y;
    console.log("[WarriorGLB] bbox", {
      min: bbox.min.toArray(),
      max: bbox.max.toArray(),
      center: center.toArray(),
      size: new THREE.Vector3().subVectors(bbox.max, bbox.min).toArray(),
    });
    return cloned;
  }, [gltf.scene]);

  // Bind animation clips to the scene so the mixer knows about them, but
  // do NOT auto-play any clip yet. Many Meshy / Mixamo exports animate the
  // root bone's position, which overrides the parent group's transform
  // every frame and makes the character drift away from the player.
  // Logging the detected clip names so we know which ones exist for the
  // next iteration, where we'll wire specific clips (walk / attack) to
  // the gameplay state via actions[clip].play() with root motion disabled.
  const { names } = useAnimations(gltf.animations, scene);
  useEffect(() => {
    console.log("[WarriorGLB] loaded — clips:", names);
  }, [names]);

  useFrame(() => {
    if (!gs.current || !groupRef.current) return;
    const p = gs.current.player;
    groupRef.current.position.set(p.x, 0, p.z);
    groupRef.current.rotation.y = p.angle + Math.PI;
  });

  // Outer group: follows the player each frame.
  // Inner primitive: the normalized scene. Any remaining root-bone motion
  // from an accidentally-played clip would move the scene locally, but the
  // outer group still carries it along with the player.
  return (
    <group ref={groupRef}>
      <primitive object={scene} />
    </group>
  );
}

// Preload the GLB so the first character-select → playing transition doesn't
// hitch waiting on an 8MB fetch. Safe to call at module scope.
useGLTF.preload(WARRIOR_GLB_URL);

// ─── Warrior — low-poly geometry (GLBs load at Electron/Steam package time) ───

function WarriorMeshAnimated({ gs }: PlayerProps) {
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
      else playerLtRef.current.color.setRGB(0.55, 0.45, 1.0);
    }
  });

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
