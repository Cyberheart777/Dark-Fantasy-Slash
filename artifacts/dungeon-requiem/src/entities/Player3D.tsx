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

  if (charClass === "mage")  return <MageMeshAnimated  gs={gs} />;
  if (charClass === "rogue") return <RogueMeshAnimated gs={gs} />;
  // Warrior GLB reverted to procedural per user request — consistent,
  // stable visual across both main game and labyrinth. Mage + Rogue
  // GLBs are unaffected. The GLB loader code below is kept for now
  // (dead) in case we ever re-enable; the preload is disabled in
  // WarriorMeshGLB definition so the network fetch no longer fires.
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
    groupRef.current.rotation.y = p.angle + Math.PI;
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

// ─── Mage — robed arcane sorcerer (procedural, iOS-safe) ─────────────────────
// All materials are meshBasicMaterial so no scene lights are required; the
// glowing bits (eye slit, staff orb, sigil) rely on bright accent colors
// rather than emissive — which MeshBasicMaterial doesn't support.
//
// Bounding box ≈ 0.65w × 2.25h × 0.45d, feet just above y=0 (Mage hovers).
// Animation hooks preserved:
//   groupRef   — position + yaw (+ dash tilt)
//   bodyRef    — subtle torso bob
//   leftArmRef / rightArmRef — walk/idle sway (rest pose baked into inner group)
//   legsRef    — walk swing (children indexed 0=left, 1=right)
//   weaponRef  — staff swing driven by p.attackTrigger
//   capeRef    — cape sway
//   playerLtRef — player point light (tint shifts on invulnerability)

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
    // Hover: the Mage barely touches the ground — constant lift + slow sine.
    const hover = 0.08 + Math.sin(t.current * 1.2) * 0.04;
    groupRef.current.position.set(p.x, hover, p.z);
    groupRef.current.rotation.y = p.angle + Math.PI;
    applyRaceScale(gs, groupRef.current);
    const isMoving = Math.abs(p.x - lastX.current) > 0.001 || Math.abs(p.z - lastZ.current) > 0.001;
    lastX.current = p.x; lastZ.current = p.z;
    if (leftArmRef.current && rightArmRef.current && legsRef.current) {
      if (isMoving && !p.isDashing) {
        const freq = 8, amp = 0.4;
        leftArmRef.current.rotation.x  =  Math.sin(t.current * freq) * amp;
        rightArmRef.current.rotation.x = -Math.sin(t.current * freq) * amp;
        const lg = legsRef.current.children;
        if (lg[0]) (lg[0] as THREE.Group).rotation.x =  Math.sin(t.current * freq) * amp;
        if (lg[1]) (lg[1] as THREE.Group).rotation.x = -Math.sin(t.current * freq) * amp;
      } else {
        // Subtle idle drift on the arms; legs still (Mage is hovering).
        leftArmRef.current.rotation.x  = Math.sin(t.current * 1.2) * 0.04;
        rightArmRef.current.rotation.x = Math.sin(t.current * 1.2) * 0.04;
        const lg = legsRef.current.children;
        if (lg[0]) (lg[0] as THREE.Group).rotation.x = 0;
        if (lg[1]) (lg[1] as THREE.Group).rotation.x = 0;
      }
    }
    if (bodyRef.current) bodyRef.current.position.y = 1.02 + Math.sin(t.current * 1.5) * 0.025;
    if (p.attackTrigger !== lastAttack.current) { lastAttack.current = p.attackTrigger; weaponSwing.current = 1; }
    if (weaponSwing.current > 0) weaponSwing.current = Math.max(0, weaponSwing.current - delta * 5);
    if (weaponRef.current) {
      const swp = weaponSwing.current;
      if (swp > 0) { const prog = 1 - swp; weaponRef.current.rotation.x = prog * Math.PI * 1.4 - Math.PI * 0.5; weaponRef.current.rotation.z = Math.sin(prog * Math.PI) * 0.5; }
      else { weaponRef.current.rotation.x = THREE.MathUtils.lerp(weaponRef.current.rotation.x, 0, 0.15); weaponRef.current.rotation.z = THREE.MathUtils.lerp(weaponRef.current.rotation.z, 0, 0.15); }
    }
    groupRef.current.rotation.x = THREE.MathUtils.lerp(groupRef.current.rotation.x, p.isDashing ? -0.25 : 0, 0.2);
    if (capeRef.current) capeRef.current.rotation.x = Math.sin(t.current * 2.5) * 0.08;
    if (playerLtRef.current) {
      playerLtRef.current.position.set(p.x, 2, p.z);
      const invPct = Math.max(0, p.invTimer / GAME_CONFIG_INV_TIME);
      playerLtRef.current.intensity = 1.5 + invPct * 3;
      if (invPct > 0.1) playerLtRef.current.color.setRGB(1, 0.2, 0.1);
      else playerLtRef.current.color.setRGB(0.8, 0.3, 1.0);
    }
  });

  // Palette — MeshBasicMaterial doesn't support emissive, so "glow" comes
  // from picking bright saturated colors for small accent meshes.
  const ROBE_DARK  = "#140818";  // robes — very dark purple-black
  const ROBE_TRIM  = "#25122e";  // hood edge, slightly lighter
  const SKIN       = "#9a96a8";  // pale grey, barely visible
  const EYE_CYAN   = "#5effff";  // bright cyan (glows via additive tone-mapping off)
  const ORB_CORE   = "#c8a0ff";  // staff orb — soft purple
  const ORB_HALO   = "#7a3dd8";  // orb glow shell
  const SIGIL      = "#6a38a0";  // dim arcane purple
  const STAFF_DARK = "#0a0612";  // obsidian staff
  const STAFF_LINE = "#6b3fc4";  // faint purple energy binding

  return (
    <>
      <group ref={groupRef}>

        {/* ── Legs (mostly hidden under robes — hints only) ──────────────── */}
        <group ref={legsRef}>
          <group position={[-0.10, 0.30, 0]}>
            <mesh>
              <cylinderGeometry args={[0.07, 0.06, 0.55, 6]} />
              <meshBasicMaterial color={ROBE_DARK} toneMapped={false} />
            </mesh>
          </group>
          <group position={[0.10, 0.30, 0]}>
            <mesh>
              <cylinderGeometry args={[0.07, 0.06, 0.55, 6]} />
              <meshBasicMaterial color={ROBE_DARK} toneMapped={false} />
            </mesh>
          </group>
        </group>

        {/* ── Flowing robes — wide flat planes around the lower body ────── */}
        {/* Back cape — animated via capeRef */}
        <mesh ref={capeRef} position={[0, 0.90, -0.19]} rotation={[0, 0, 0]}>
          <planeGeometry args={[0.75, 1.30]} />
          <meshBasicMaterial color={ROBE_DARK} side={THREE.DoubleSide} toneMapped={false} />
        </mesh>
        {/* Asymmetric side robe — left is LONGER */}
        <mesh position={[-0.32, 0.75, 0]} rotation={[0, Math.PI / 2, 0]}>
          <planeGeometry args={[0.55, 1.45]} />
          <meshBasicMaterial color={ROBE_DARK} side={THREE.DoubleSide} toneMapped={false} />
        </mesh>
        {/* Right side robe — shorter */}
        <mesh position={[0.32, 0.82, 0]} rotation={[0, Math.PI / 2, 0]}>
          <planeGeometry args={[0.50, 1.30]} />
          <meshBasicMaterial color={ROBE_DARK} side={THREE.DoubleSide} toneMapped={false} />
        </mesh>
        {/* Front robe wrap */}
        <mesh position={[0, 0.80, 0.18]} rotation={[0, 0, 0]}>
          <planeGeometry args={[0.50, 1.35]} />
          <meshBasicMaterial color={ROBE_DARK} side={THREE.DoubleSide} toneMapped={false} />
        </mesh>

        {/* ── Torso — narrow top, flared bottom ──────────────────────────── */}
        <mesh ref={bodyRef} position={[0, 1.02, 0]}>
          <boxGeometry args={[0.40, 0.66, 0.28]} />
          <meshBasicMaterial color={ROBE_DARK} toneMapped={false} />
        </mesh>
        {/* Robe flare skirt — wider than torso */}
        <mesh position={[0, 0.62, 0]}>
          <boxGeometry args={[0.58, 0.22, 0.38]} />
          <meshBasicMaterial color={ROBE_DARK} toneMapped={false} />
        </mesh>
        {/* Layered fabric — a second thin panel offset in front of the torso */}
        <mesh position={[0, 1.00, 0.15]}>
          <planeGeometry args={[0.34, 0.56]} />
          <meshBasicMaterial color={ROBE_TRIM} side={THREE.DoubleSide} toneMapped={false} />
        </mesh>
        {/* Arcane sigil — small torus ring on the chest, dim purple */}
        <mesh position={[0, 1.08, 0.17]}>
          <torusGeometry args={[0.058, 0.011, 6, 14]} />
          <meshBasicMaterial color={SIGIL} toneMapped={false} />
        </mesh>
        {/* Sigil inner tick — a tiny crossbar across the ring */}
        <mesh position={[0, 1.08, 0.17]}>
          <boxGeometry args={[0.11, 0.010, 0.012]} />
          <meshBasicMaterial color={SIGIL} toneMapped={false} />
        </mesh>

        {/* ── Left arm — relaxed down (inner group bakes the rest pose) ──── */}
        <group ref={leftArmRef} position={[-0.27, 1.14, 0]}>
          <group rotation={[0.12, 0, 0.05]}>
            {/* Upper arm sleeve — narrow cylinder */}
            <mesh position={[0, -0.22, 0]}>
              <cylinderGeometry args={[0.065, 0.055, 0.46, 6]} />
              <meshBasicMaterial color={ROBE_DARK} toneMapped={false} />
            </mesh>
            {/* Slightly oversized hand — pale grey sphere */}
            <mesh position={[0, -0.50, 0.02]}>
              <sphereGeometry args={[0.085, 8, 6]} />
              <meshBasicMaterial color={SKIN} toneMapped={false} />
            </mesh>
          </group>
        </group>

        {/* ── Right arm — raised as if casting (inner group −0.55 rad) ───── */}
        <group ref={rightArmRef} position={[0.27, 1.14, 0]}>
          <group rotation={[-0.55, 0, -0.1]}>
            <mesh position={[0, -0.22, 0]}>
              <cylinderGeometry args={[0.065, 0.055, 0.46, 6]} />
              <meshBasicMaterial color={ROBE_DARK} toneMapped={false} />
            </mesh>
            <mesh position={[0, -0.50, 0]}>
              <sphereGeometry args={[0.09, 8, 6]} />
              <meshBasicMaterial color={SKIN} toneMapped={false} />
            </mesh>

            {/* ── Staff — held in the right hand, orb floats above tip ───── */}
            <group ref={weaponRef} position={[0.02, -0.45, 0]}>
              {/* Shaft — long slim obsidian cylinder */}
              <mesh position={[0, -0.55, 0]}>
                <cylinderGeometry args={[0.028, 0.028, 1.35, 8]} />
                <meshBasicMaterial color={STAFF_DARK} toneMapped={false} />
              </mesh>
              {/* Energy lines — three thin glowing bands up the shaft */}
              <mesh position={[0, -0.95, 0]}>
                <cylinderGeometry args={[0.033, 0.033, 0.035, 8]} />
                <meshBasicMaterial color={STAFF_LINE} toneMapped={false} />
              </mesh>
              <mesh position={[0, -0.60, 0]}>
                <cylinderGeometry args={[0.033, 0.033, 0.035, 8]} />
                <meshBasicMaterial color={STAFF_LINE} toneMapped={false} />
              </mesh>
              <mesh position={[0, -0.25, 0]}>
                <cylinderGeometry args={[0.033, 0.033, 0.035, 8]} />
                <meshBasicMaterial color={STAFF_LINE} toneMapped={false} />
              </mesh>
              {/* Staff crown — a small cap just below the floating orb */}
              <mesh position={[0, 0.15, 0]}>
                <coneGeometry args={[0.05, 0.10, 8]} />
                <meshBasicMaterial color={STAFF_DARK} toneMapped={false} />
              </mesh>
              {/* Floating orb — gap between staff tip (0.20) and orb (0.33) */}
              <mesh position={[0, 0.33, 0]}>
                <sphereGeometry args={[0.09, 12, 10]} />
                <meshBasicMaterial color={ORB_CORE} toneMapped={false} />
              </mesh>
              {/* Orb halo — semi-transparent bigger sphere for the glow */}
              <mesh position={[0, 0.33, 0]}>
                <sphereGeometry args={[0.15, 10, 8]} />
                <meshBasicMaterial color={ORB_HALO} transparent opacity={0.35} depthWrite={false} toneMapped={false} />
              </mesh>
            </group>
          </group>
        </group>

        {/* ── Head + hood ─────────────────────────────────────────────────── */}
        <group position={[0, 1.52, 0]}>
          {/* Narrow oval head — pale skin sphere, scaled taller than wide */}
          <mesh position={[0, 0.14, 0.04]} scale={[0.85, 1.15, 0.95]}>
            <sphereGeometry args={[0.16, 12, 10]} />
            <meshBasicMaterial color={SKIN} toneMapped={false} />
          </mesh>
          {/* Tall pointed hood — cone, slightly tilted forward for menace */}
          <mesh position={[0, 0.40, -0.04]} rotation={[0.14, 0, 0]}>
            <coneGeometry args={[0.30, 0.95, 10]} />
            <meshBasicMaterial color={ROBE_DARK} side={THREE.DoubleSide} toneMapped={false} />
          </mesh>
          {/* Hood outer edge — slightly larger & lighter, gives a trim hint */}
          <mesh position={[0, 0.35, -0.09]} rotation={[0.14, 0, 0]}>
            <coneGeometry args={[0.34, 0.80, 10, 1, true]} />
            <meshBasicMaterial color={ROBE_TRIM} side={THREE.DoubleSide} toneMapped={false} />
          </mesh>
          {/* Glowing eye slit — thin horizontal cyan rectangle */}
          <mesh position={[0, 0.14, 0.18]}>
            <boxGeometry args={[0.18, 0.028, 0.012]} />
            <meshBasicMaterial color={EYE_CYAN} toneMapped={false} />
          </mesh>
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

const GAME_CONFIG_INV_TIME = 0.8;
