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
import { clone as skeletonClone } from "three/examples/jsm/utils/SkeletonUtils.js";
import type { GameState } from "../game/GameScene";
import { meshScaleForRace } from "../data/RaceData";

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

  if (charClass === "mage")       return <MageMeshAnimated  gs={gs} />;
  if (charClass === "rogue")      return <RogueMeshAnimated gs={gs} />;
  if (charClass === "necromancer") return <NecromancerMeshAnimated gs={gs} />;
  if (charClass === "bard")       return <BardMeshAnimated gs={gs} />;
  return <WarriorMeshAnimated gs={gs} />;
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
  const gltf = useGLTF(WARRIOR_GLB_URL);

  // Clone the scene using SkeletonUtils, NOT the plain Object3D.clone(true).
  //
  // The previous attempts used scene.clone(true), which produces the classic
  // three.js skinned-mesh clone bug: the cloned Object3D hierarchy gets
  // fresh Groups and SkinnedMesh instances, but those SkinnedMeshes still
  // reference the ORIGINAL Skeleton's bones. The original skeleton lives in
  // the original scene (cached by useGLTF at world origin, never moved), so
  // every frame the visible vertices render at bone_world_position + weight,
  // where the bones are still sitting at origin — no matter how many times
  // I set cloned scene.position.
  //
  // The last deploy's [WarriorGLB] tick logs confirmed this: scenePos
  // tracked the player correctly AND sceneWorld matched scenePos, so the
  // transform hierarchy was healthy — yet the mesh visually stayed put.
  // That's a skinned-mesh bone-ref bug, not a transform bug.
  //
  // SkeletonUtils.clone walks the hierarchy, creates a fresh Skeleton with
  // cloned bones, then rebinds each SkinnedMesh clone to the new skeleton
  // so the bones and the mesh move together with the scene root.
  const scene = useMemo(() => skeletonClone(gltf.scene) as THREE.Group, [gltf.scene]);

  // Strip every position track from every animation clip. The first GLB
  // attempt rendered the character pinned at the world origin because the
  // single clip (Armature|clip0|baselayer) contained .position keyframes
  // on the root bone, and the mixer was overwriting scene.position every
  // frame *after* my useFrame ran. The regex catches both full-property
  // tracks ("…position") and per-axis tracks ("…position[x]").
  const cleanedClips = useMemo(() => {
    return gltf.animations.map((clip) => {
      const copy = clip.clone();
      const beforeCount = copy.tracks.length;
      // Sample a few track names BEFORE the filter so we can see what the
      // clip actually keyed — useful for diagnosing "animation not playing"
      // (maybe all tracks WERE position tracks, in which case the clip is
      // now empty and nothing will animate).
      const sampleBefore = copy.tracks.slice(0, 6).map((t) => t.name);
      copy.tracks = copy.tracks.filter((t) => !/\.position(\[|$)/.test(t.name));
      console.log(
        `[WarriorGLB] clip "${copy.name}" duration=${copy.duration.toFixed(2)}s ` +
        `tracks=${beforeCount}→${copy.tracks.length}`,
        { sampleTracksBefore: sampleBefore },
      );
      return copy;
    });
  }, [gltf.animations]);

  const { actions, names } = useAnimations(cleanedClips, scene);
  useEffect(() => {
    // Log what we know about the loaded asset for one-shot diagnostics.
    const bbox = new THREE.Box3().setFromObject(scene);
    console.log("[WarriorGLB] bbox", {
      min: bbox.min.toArray(),
      max: bbox.max.toArray(),
      center: bbox.getCenter(new THREE.Vector3()).toArray(),
      size: new THREE.Vector3().subVectors(bbox.max, bbox.min).toArray(),
    });
    console.log("[WarriorGLB] loaded — clips:", names);
    if (names.length > 0) {
      const first = names[0];
      const action = actions[first];
      action?.reset().fadeIn(0.25).play();
      console.log(`[WarriorGLB] playing "${first}"`, {
        duration: action?.getClip().duration,
        trackCount: action?.getClip().tracks.length,
        isRunning: action?.isRunning(),
      });
    }
  }, [actions, names, scene]);

  // Direct mutation approach: set scene.position every frame. No parent
  // group, no transform composition, no primitive re-parenting.  This is
  // the dead-simplest possible way to make an Object3D follow a point,
  // and it rules out every category of transform-hierarchy issue I might
  // have missed in the previous wrapping attempts.
  //
  // Throttled console log every ~3 seconds at 60fps so the next playtest
  // can confirm scene.position is actually being written.
  const logCounter = useRef(0);
  useFrame(() => {
    if (!gs.current) return;
    const p = gs.current.player;
    scene.position.set(p.x, 0, p.z);
    // NOTE: facing fix. Previously used `p.angle + Math.PI` to match the
    // procedural warrior, but the Meshy GLB exports with its front facing
    // the opposite direction, so the character was swinging from its back.
    // Removing the +π offset aligns the GLB's front with the aim vector.
    // If a future GLB comes in with the opposite convention, add the +π
    // back — it's a one-line flip.
    scene.rotation.y = p.angle;
    logCounter.current++;
    if (logCounter.current % 180 === 0) {
      console.log("[WarriorGLB] tick", {
        playerXZ: [p.x, p.z],
        scenePos: scene.position.toArray(),
        sceneWorld: scene.getWorldPosition(new THREE.Vector3()).toArray(),
      });
    }
  });

  return <primitive object={scene} />;
}

// Warrior GLB preload disabled — reverted to procedural warrior.
// The GLB loader + preload below stays as dead code in case the
// asset is re-enabled later; commenting the preload stops the
// browser from fetching the 8 MB file on every page load.
// useGLTF.preload(WARRIOR_GLB_URL);

// ─── Shared race-scale helper ────────────────────────────────────────────────
// Reads `race` from gs.current and applies the corresponding non-uniform
// scale to the character's outer group. Called each frame by all three
// class meshes (Warrior / Mage / Rogue) so race selection is reflected
// consistently across the roster. Hitbox + collision radius + move
// speed are deliberately NOT touched — this is a visual-only scale
// per the Alpha-pass spec. If race is unset (labyrinth shim default),
// falls back to "human" → [1, 1, 1].
function applyRaceScale(gs: React.RefObject<GameState | null>, group: THREE.Group) {
  const race = gs.current?.race ?? "human";
  const [sx, sy, sz] = meshScaleForRace(race);
  group.scale.set(sx, sy, sz);
}

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
    groupRef.current.rotation.y = p.angle;
    applyRaceScale(gs, groupRef.current);
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
          <group ref={weaponRef} position={[0.1, -0.45, 0.18]}>
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
    groupRef.current.rotation.y = p.angle;
    applyRaceScale(gs, groupRef.current);
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

  // Palette — tuned for visibility against the dark stone floor.
  // ROBE reads as deep violet (lighter than original near-black), with
  // emissive accents pushed bright enough to punch through tone mapping.
  const ROBE = "#4a1e80"; const INNER = "#2d1b4e"; const SKIN = "#dac8a8";
  const STAFF = "#1a0a2e"; const ORB = "#cc44ff"; const TRIM = "#8833cc";
  const EYE = "#00ffff"; const STAFF_LINE = "#9933ff";

  // Visual-only scale bump so the Mage reads clearly from the top-down
  // camera without looking oversized. Wrapped in a static inner group so
  // it compounds with the per-race scale on groupRef. Hitbox and
  // collision are runtime-side and unaffected.
  const MAGE_SCALE = 1.12;

  return (
    <>
      <group ref={groupRef}>
       <group scale={[MAGE_SCALE, MAGE_SCALE, MAGE_SCALE]}>
        <group ref={legsRef}>
          <group position={[-0.18, 0.45, 0]}><mesh castShadow><boxGeometry args={[0.24, 0.58, 0.28]} /><meshStandardMaterial color={ROBE} roughness={0.95} emissive={INNER} emissiveIntensity={0.3} /></mesh></group>
          <group position={[0.18, 0.45, 0]}><mesh castShadow><boxGeometry args={[0.24, 0.58, 0.28]} /><meshStandardMaterial color={ROBE} roughness={0.95} emissive={INNER} emissiveIntensity={0.3} /></mesh></group>
        </group>
        <mesh ref={bodyRef} position={[0, 1.02, 0]} castShadow><boxGeometry args={[0.62, 0.72, 0.36]} /><meshStandardMaterial color={ROBE} roughness={0.9} emissive={INNER} emissiveIntensity={0.25} /></mesh>
        {/* Chest sigil — brighter emissive so it reads at distance */}
        <mesh position={[0, 1.02, 0.19]}><boxGeometry args={[0.18, 0.18, 0.01]} /><meshStandardMaterial color={TRIM} emissive={TRIM} emissiveIntensity={4.5} toneMapped={false} /></mesh>
        <mesh position={[-0.40, 1.25, 0]} castShadow><boxGeometry args={[0.18, 0.16, 0.34]} /><meshStandardMaterial color={TRIM} roughness={0.7} metalness={0.2} emissive={TRIM} emissiveIntensity={0.6} /></mesh>
        <mesh position={[0.40, 1.25, 0]} castShadow><boxGeometry args={[0.18, 0.16, 0.34]} /><meshStandardMaterial color={TRIM} roughness={0.7} metalness={0.2} emissive={TRIM} emissiveIntensity={0.6} /></mesh>
        <mesh ref={capeRef} position={[0, 1.0, -0.26]} castShadow><boxGeometry args={[0.58, 0.88, 0.06]} /><meshStandardMaterial color={INNER} roughness={0.95} emissive="#1a004a" emissiveIntensity={0.6} /></mesh>
        <group ref={leftArmRef} position={[-0.42, 1.18, 0]}>
          <mesh castShadow position={[0, -0.2, 0]}><boxGeometry args={[0.18, 0.44, 0.18]} /><meshStandardMaterial color={ROBE} roughness={0.9} /></mesh>
          <mesh castShadow position={[0, -0.46, 0]}><boxGeometry args={[0.16, 0.18, 0.16]} /><meshStandardMaterial color={SKIN} roughness={0.85} /></mesh>
        </group>
        <group ref={rightArmRef} position={[0.42, 1.18, 0]}>
          <mesh castShadow position={[0, -0.2, 0]}><boxGeometry args={[0.18, 0.44, 0.18]} /><meshStandardMaterial color={ROBE} roughness={0.9} /></mesh>
          <mesh castShadow position={[0, -0.46, 0]}><boxGeometry args={[0.16, 0.18, 0.16]} /><meshStandardMaterial color={SKIN} roughness={0.85} /></mesh>
          {/* Staff — proper wizard hold: shaft extends UP from the hand with
              the orb floating above the head. Hand grips near the bottom of
              the shaft. The outer group's static z-tilt gives a slight inward
              lean so the staff isn't perfectly vertical; the inner weaponRef
              is the part the swing animation rotates. */}
          <group position={[0.08, -0.4, 0]} rotation={[0, 0, -0.12]}>
            <group ref={weaponRef}>
              {/* Shaft — length 1.4, centered at y=+0.55 so it spans from
                  slightly below the hand up past the head. */}
              <mesh castShadow position={[0, 0.55, 0]}><boxGeometry args={[0.08, 1.4, 0.08]} /><meshStandardMaterial color={STAFF} roughness={0.8} metalness={0.1} emissive={STAFF_LINE} emissiveIntensity={0.5} /></mesh>
              {/* Staff energy line — thin bright strip on the front face of the shaft */}
              <mesh position={[0, 0.55, 0.045]}><boxGeometry args={[0.014, 1.30, 0.003]} /><meshStandardMaterial color={STAFF_LINE} emissive={STAFF_LINE} emissiveIntensity={3.0} toneMapped={false} /></mesh>
              {/* Shaft grip wrap at the hand — small accent so the hold reads */}
              <mesh position={[0, -0.05, 0]}><boxGeometry args={[0.11, 0.14, 0.11]} /><meshStandardMaterial color={INNER} roughness={0.85} /></mesh>
              {/* Orb — floats above the top of the shaft (small gap, not touching) */}
              <mesh position={[0, 1.40, 0]}><sphereGeometry args={[0.18, 10, 8]} /><meshStandardMaterial color={ORB} emissive={ORB} emissiveIntensity={6.0} toneMapped={false} /></mesh>
              <mesh position={[0, 1.40, 0]}><sphereGeometry args={[0.24, 8, 6]} /><meshStandardMaterial color={ORB} emissive={ORB} emissiveIntensity={2.5} transparent opacity={0.35} depthWrite={false} /></mesh>
            </group>
          </group>
        </group>
        <group position={[0, 1.66, 0]}>
          <mesh castShadow><boxGeometry args={[0.40, 0.40, 0.36]} /><meshStandardMaterial color={SKIN} roughness={0.85} /></mesh>
          <mesh castShadow position={[0, 0.28, 0]}><boxGeometry args={[0.44, 0.44, 0.40]} /><meshStandardMaterial color={INNER} roughness={0.9} emissive={INNER} emissiveIntensity={0.35} /></mesh>
          <mesh castShadow position={[0, 0.58, 0]}><boxGeometry args={[0.22, 0.36, 0.22]} /><meshStandardMaterial color={INNER} roughness={0.9} /></mesh>
          {/* Eye slits — bright cyan emissive */}
          <mesh position={[-0.1, 0.05, 0.19]}><boxGeometry args={[0.07, 0.06, 0.02]} /><meshStandardMaterial color={EYE} emissive={EYE} emissiveIntensity={7.0} toneMapped={false} /></mesh>
          <mesh position={[0.1, 0.05, 0.19]}><boxGeometry args={[0.07, 0.06, 0.02]} /><meshStandardMaterial color={EYE} emissive={EYE} emissiveIntensity={7.0} toneMapped={false} /></mesh>
        </group>
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
    groupRef.current.rotation.y = p.angle;
    applyRaceScale(gs, groupRef.current);
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

// ─── Necromancer — robed scythe-wielder (meshBasicMaterial, iOS-safe) ────────

function NecromancerMeshAnimated({ gs }: PlayerProps) {
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
    groupRef.current.rotation.y = p.angle;
    applyRaceScale(gs, groupRef.current);
    const isMoving = Math.abs(p.x - lastX.current) > 0.001 || Math.abs(p.z - lastZ.current) > 0.001;
    lastX.current = p.x; lastZ.current = p.z;
    if (leftArmRef.current && rightArmRef.current && legsRef.current) {
      if (isMoving && !p.isDashing) {
        const freq = 7, amp = 0.45;
        leftArmRef.current.rotation.x  =  Math.sin(t.current * freq) * amp;
        rightArmRef.current.rotation.x = -Math.sin(t.current * freq) * amp;
        const lg = legsRef.current.children;
        if (lg[0]) (lg[0] as THREE.Group).rotation.x =  Math.sin(t.current * freq) * amp;
        if (lg[1]) (lg[1] as THREE.Group).rotation.x = -Math.sin(t.current * freq) * amp;
      } else {
        leftArmRef.current.rotation.x  = Math.sin(t.current * 1.5) * 0.04;
        rightArmRef.current.rotation.x = Math.sin(t.current * 1.5) * 0.04 + 0.08;
        const lg = legsRef.current.children;
        if (lg[0]) (lg[0] as THREE.Group).rotation.x = 0;
        if (lg[1]) (lg[1] as THREE.Group).rotation.x = 0;
      }
    }
    if (bodyRef.current) bodyRef.current.position.y = 1.0 + Math.sin(t.current * 1.5) * 0.02;
    if (p.attackTrigger !== lastAttack.current) { lastAttack.current = p.attackTrigger; weaponSwing.current = 1; }
    if (weaponSwing.current > 0) weaponSwing.current = Math.max(0, weaponSwing.current - delta * 4);
    if (weaponRef.current) {
      const swp = weaponSwing.current;
      if (swp > 0) {
        const prog = 1 - swp;
        // Wide horizontal slash for scythe
        weaponRef.current.rotation.z = -0.3 + prog * Math.PI * 0.8;
        weaponRef.current.rotation.x = Math.sin(prog * Math.PI) * 0.4;
      } else {
        weaponRef.current.rotation.z = THREE.MathUtils.lerp(weaponRef.current.rotation.z, -0.3, 0.12);
        weaponRef.current.rotation.x = THREE.MathUtils.lerp(weaponRef.current.rotation.x, 0, 0.12);
      }
    }
    groupRef.current.rotation.x = THREE.MathUtils.lerp(groupRef.current.rotation.x, p.isDashing ? -0.2 : 0, 0.2);
    if (capeRef.current) capeRef.current.rotation.x = Math.sin(t.current * 2.5) * 0.08;
    if (playerLtRef.current) {
      playerLtRef.current.position.set(p.x, 2, p.z);
      const invPct = Math.max(0, p.invTimer / GAME_CONFIG_INV_TIME);
      playerLtRef.current.intensity = 1.2 + invPct * 3;
      if (invPct > 0.1) playerLtRef.current.color.setRGB(0.8, 0.1, 0.8);
      else playerLtRef.current.color.setRGB(0.5, 0.15, 0.7);
    }
  });

  // Palette
  const ROBE = "#1a0828"; const INNER = "#0e0418"; const HOOD = "#120620";
  const SKIN = "#c8b8a0"; const SCYTHE_SHAFT = "#2a1840"; const SCYTHE_BLADE = "#6a1e8a";
  const EYE = "#cc66ff";

  return (
    <>
      <group ref={groupRef}>
        {/* Legs (hidden under robe, short stubs) */}
        <group ref={legsRef}>
          <group position={[-0.15, 0.4, 0]}>
            <mesh castShadow><boxGeometry args={[0.18, 0.45, 0.18]} /><meshBasicMaterial color={INNER} /></mesh>
          </group>
          <group position={[0.15, 0.4, 0]}>
            <mesh castShadow><boxGeometry args={[0.18, 0.45, 0.18]} /><meshBasicMaterial color={INNER} /></mesh>
          </group>
        </group>
        {/* Robe body — wide at bottom (tattered skirt look) */}
        <mesh ref={bodyRef} castShadow position={[0, 1.0, 0]}>
          <boxGeometry args={[0.68, 0.95, 0.5]} />
          <meshBasicMaterial color={ROBE} />
        </mesh>
        {/* Robe skirt — wider hem */}
        <mesh castShadow position={[0, 0.55, 0]}>
          <boxGeometry args={[0.78, 0.35, 0.58]} />
          <meshBasicMaterial color={ROBE} />
        </mesh>
        {/* Hood — slightly forward-tilted */}
        <mesh castShadow position={[0, 1.72, 0.06]}>
          <boxGeometry args={[0.52, 0.52, 0.52]} />
          <meshBasicMaterial color={HOOD} />
        </mesh>
        {/* Hood top rim */}
        <mesh castShadow position={[0, 1.95, -0.04]}>
          <boxGeometry args={[0.46, 0.12, 0.48]} />
          <meshBasicMaterial color={HOOD} />
        </mesh>
        {/* Glowing eyes (deep inside hood) */}
        <mesh position={[-0.1, 1.7, 0.27]}>
          <boxGeometry args={[0.08, 0.05, 0.02]} />
          <meshBasicMaterial color={EYE} />
        </mesh>
        <mesh position={[0.1, 1.7, 0.27]}>
          <boxGeometry args={[0.08, 0.05, 0.02]} />
          <meshBasicMaterial color={EYE} />
        </mesh>
        {/* Left arm — skeletal hand visible at hem */}
        <group ref={leftArmRef} position={[-0.42, 1.12, 0]}>
          <mesh castShadow position={[0, -0.15, 0]}><boxGeometry args={[0.2, 0.55, 0.2]} /><meshBasicMaterial color={ROBE} /></mesh>
          {/* Skeletal hand */}
          <mesh castShadow position={[0, -0.48, 0.04]}><boxGeometry args={[0.14, 0.16, 0.1]} /><meshBasicMaterial color={SKIN} /></mesh>
        </group>
        {/* Right arm — holds scythe */}
        <group ref={rightArmRef} position={[0.42, 1.12, 0]}>
          <mesh castShadow position={[0, -0.15, 0]}><boxGeometry args={[0.2, 0.55, 0.2]} /><meshBasicMaterial color={ROBE} /></mesh>
        </group>
        {/* Scythe weapon — shaft up from right hand, blade curves forward at top */}
        <group position={[0.12, -0.35, 0]} rotation={[0, 0, -0.3]}>
          <group ref={weaponRef}>
            {/* Shaft */}
            <mesh castShadow position={[0, 0.8, 0]}><boxGeometry args={[0.06, 1.8, 0.06]} /><meshBasicMaterial color={SCYTHE_SHAFT} /></mesh>
            {/* Curved blade — angled forward */}
            <mesh castShadow position={[0.2, 1.75, 0]} rotation={[0, 0, -0.8]}>
              <boxGeometry args={[0.06, 0.8, 0.03]} />
              <meshBasicMaterial color={SCYTHE_BLADE} />
            </mesh>
            {/* Blade edge glow */}
            <mesh position={[0.25, 1.72, 0]} rotation={[0, 0, -0.8]}>
              <boxGeometry args={[0.02, 0.82, 0.02]} />
              <meshBasicMaterial color="#cc44ff" />
            </mesh>
            {/* Pommel */}
            <mesh position={[0, -0.15, 0]}>
              <sphereGeometry args={[0.06, 6, 6]} />
              <meshBasicMaterial color={SCYTHE_SHAFT} />
            </mesh>
          </group>
        </group>
        {/* Tattered cape */}
        <mesh ref={capeRef} castShadow position={[0, 0.95, -0.28]}>
          <boxGeometry args={[0.6, 0.95, 0.05]} />
          <meshBasicMaterial color={INNER} />
        </mesh>
      </group>
      <pointLight ref={playerLtRef} />
    </>
  );
}

// ─── Bard — theatrical sniper with lute (meshBasicMaterial, iOS-safe) ────────

function BardMeshAnimated({ gs }: PlayerProps) {
  const groupRef    = useRef<THREE.Group>(null);
  const bodyRef     = useRef<THREE.Mesh>(null);
  const leftArmRef  = useRef<THREE.Group>(null);
  const rightArmRef = useRef<THREE.Group>(null);
  const legsRef     = useRef<THREE.Group>(null);
  const capeRef     = useRef<THREE.Mesh>(null);
  const playerLtRef = useRef<THREE.PointLight>(null);
  const t           = useRef(0);
  const lastX       = useRef(0);
  const lastZ       = useRef(0);

  useFrame((_, delta) => {
    if (!gs.current || !groupRef.current) return;
    t.current += delta;
    const p = gs.current.player;
    groupRef.current.position.set(p.x, 0, p.z);
    groupRef.current.rotation.y = p.angle;
    applyRaceScale(gs, groupRef.current);
    const isMoving = Math.abs(p.x - lastX.current) > 0.001 || Math.abs(p.z - lastZ.current) > 0.001;
    lastX.current = p.x; lastZ.current = p.z;
    if (leftArmRef.current && rightArmRef.current && legsRef.current) {
      if (isMoving && !p.isDashing) {
        const freq = 8, amp = 0.4;
        leftArmRef.current.rotation.x  =  Math.sin(t.current * freq) * amp;
        rightArmRef.current.rotation.x = -Math.sin(t.current * freq) * amp * 0.3;
        const lg = legsRef.current.children;
        if (lg[0]) (lg[0] as THREE.Group).rotation.x =  Math.sin(t.current * freq) * amp;
        if (lg[1]) (lg[1] as THREE.Group).rotation.x = -Math.sin(t.current * freq) * amp;
      } else {
        leftArmRef.current.rotation.x  = Math.sin(t.current * 2) * 0.06;
        rightArmRef.current.rotation.x = Math.sin(t.current * 2.5) * 0.04;
        const lg = legsRef.current.children;
        if (lg[0]) (lg[0] as THREE.Group).rotation.x = 0;
        if (lg[1]) (lg[1] as THREE.Group).rotation.x = 0;
      }
    }
    if (bodyRef.current) bodyRef.current.position.y = 0.95 + Math.sin(t.current * 1.8) * 0.02;
    groupRef.current.rotation.x = THREE.MathUtils.lerp(groupRef.current.rotation.x, p.isDashing ? -0.2 : 0, 0.2);
    if (capeRef.current) capeRef.current.rotation.x = Math.sin(t.current * 2.2) * 0.06;
    if (playerLtRef.current) {
      playerLtRef.current.position.set(p.x, 2, p.z);
      const invPct = Math.max(0, p.invTimer / GAME_CONFIG_INV_TIME);
      playerLtRef.current.intensity = 1.0 + invPct * 3;
      if (invPct > 0.1) playerLtRef.current.color.setRGB(1, 0.7, 0.2);
      else playerLtRef.current.color.setRGB(0.8, 0.6, 0.2);
    }
  });

  const ROBE = "#0a0808"; const TRIM = "#c8a020"; const HOOD = "#3a2810";
  const SKIN = "#c0b0a0"; const EYE = "#ffaa22";
  const LUTE_BODY = "#2a1a08"; const LUTE_STRING = "#ffc030";

  return (
    <>
      <group ref={groupRef}>
        {/* Legs */}
        <group ref={legsRef}>
          <group position={[-0.12, 0.38, 0]}>
            <mesh castShadow><boxGeometry args={[0.16, 0.42, 0.16]} /><meshBasicMaterial color={ROBE} /></mesh>
          </group>
          <group position={[0.12, 0.38, 0]}>
            <mesh castShadow><boxGeometry args={[0.16, 0.42, 0.16]} /><meshBasicMaterial color={ROBE} /></mesh>
          </group>
        </group>
        {/* Robe body — wider at shoulders */}
        <mesh ref={bodyRef} castShadow position={[0, 0.95, 0]}>
          <boxGeometry args={[0.6, 0.8, 0.42]} />
          <meshBasicMaterial color={ROBE} />
        </mesh>
        {/* Gold trim band at waist */}
        <mesh position={[0, 0.6, 0]}>
          <boxGeometry args={[0.55, 0.08, 0.4]} />
          <meshBasicMaterial color={TRIM} />
        </mesh>
        {/* Shoulder accents */}
        <mesh position={[-0.34, 1.22, 0]}>
          <boxGeometry args={[0.14, 0.1, 0.32]} />
          <meshBasicMaterial color={TRIM} />
        </mesh>
        <mesh position={[0.34, 1.22, 0]}>
          <boxGeometry args={[0.14, 0.1, 0.32]} />
          <meshBasicMaterial color={TRIM} />
        </mesh>
        {/* Hood */}
        <mesh castShadow position={[0, 1.58, 0.04]}>
          <boxGeometry args={[0.46, 0.44, 0.44]} />
          <meshBasicMaterial color={HOOD} />
        </mesh>
        {/* Eyes — amber glow */}
        <mesh position={[-0.09, 1.56, 0.24]}>
          <boxGeometry args={[0.07, 0.04, 0.02]} />
          <meshBasicMaterial color={EYE} />
        </mesh>
        <mesh position={[0.09, 1.56, 0.24]}>
          <boxGeometry args={[0.07, 0.04, 0.02]} />
          <meshBasicMaterial color={EYE} />
        </mesh>
        {/* Right arm */}
        <group ref={rightArmRef} position={[0.38, 1.05, 0]}>
          <mesh castShadow position={[0, -0.15, 0]}><boxGeometry args={[0.16, 0.48, 0.16]} /><meshBasicMaterial color={ROBE} /></mesh>
          <mesh position={[0, -0.44, 0.03]}><boxGeometry args={[0.12, 0.12, 0.08]} /><meshBasicMaterial color={SKIN} /></mesh>
        </group>
        {/* Left arm — holds lute */}
        <group ref={leftArmRef} position={[-0.38, 1.05, 0]}>
          <mesh castShadow position={[0, -0.15, 0]}><boxGeometry args={[0.16, 0.48, 0.16]} /><meshBasicMaterial color={ROBE} /></mesh>
          {/* Lute body */}
          <mesh castShadow position={[-0.06, -0.35, 0.12]}>
            <boxGeometry args={[0.22, 0.3, 0.08]} />
            <meshBasicMaterial color={LUTE_BODY} />
          </mesh>
          {/* Lute neck */}
          <mesh position={[-0.06, -0.08, 0.12]}>
            <boxGeometry args={[0.05, 0.35, 0.04]} />
            <meshBasicMaterial color={LUTE_BODY} />
          </mesh>
          {/* Lute strings — amber emissive */}
          <mesh position={[-0.06, -0.22, 0.17]}>
            <boxGeometry args={[0.12, 0.22, 0.01]} />
            <meshBasicMaterial color={LUTE_STRING} />
          </mesh>
        </group>
        {/* Cape */}
        <mesh ref={capeRef} castShadow position={[0, 0.88, -0.24]}>
          <boxGeometry args={[0.52, 0.78, 0.04]} />
          <meshBasicMaterial color={ROBE} />
        </mesh>
      </group>
      <pointLight ref={playerLtRef} />
    </>
  );
}

const GAME_CONFIG_INV_TIME = 0.6;
