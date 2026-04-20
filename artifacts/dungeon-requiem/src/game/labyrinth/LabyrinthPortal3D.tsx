/**
 * LabyrinthPortal3D.tsx
 *
 * Oval extraction portal visual. Procedurally generated from torus +
 * circle geometry — no 3D assets required.
 *
 * The camera is near top-down, so a pure-vertical ring would be seen
 * edge-on. The portal is tilted back ~35 degrees so the oval ring is
 * clearly visible from the chase camera while still reading as a
 * "tall" gateway from the player's eyeline.
 *
 * Visual: outer fuzzy glow (blue) + main ring (purple, pulsing) +
 * inner additive disc that breathes + a subtle floor halo for pure
 * top-down visibility. Fades out smoothly when the parent has marked
 * the portal as consumed.
 */

import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import {
  PORTAL_COLLISION_RX,
  PORTAL_COLLISION_RZ,
  portalFadeAlpha,
  type ExtractionPortal,
} from "./LabyrinthPortal";

/** Visual radii are slightly larger than the hit-test ellipse so the
 *  ring clearly surrounds the invisible collision zone. */
const VISUAL_SCALE = 1.15;
const RX = PORTAL_COLLISION_RX * VISUAL_SCALE;
const RZ = PORTAL_COLLISION_RZ * VISUAL_SCALE;
const RMIN = Math.min(RX, RZ);

/** Tilt back toward the camera so the oval is visible from top-down. */
const TILT_X = -Math.PI * 0.32;

/** Height above the floor where the portal's center sits. */
const CENTER_Y = 2.6;

export function LabyrinthPortal3D({ portal }: { portal: ExtractionPortal }) {
  const rootRef = useRef<THREE.Group>(null);
  const ringMatRef = useRef<THREE.MeshBasicMaterial>(null);
  const discMatRef = useRef<THREE.MeshBasicMaterial>(null);
  const glowMatRef = useRef<THREE.MeshBasicMaterial>(null);
  const coreMatRef = useRef<THREE.MeshBasicMaterial>(null);
  const haloMatRef = useRef<THREE.MeshBasicMaterial>(null);

  useFrame((_, delta) => {
    if (portal.consumed) {
      portal.fadeElapsedSec += delta;
    }
    const alpha = portalFadeAlpha(portal);

    const t = performance.now() / 1000;
    const bobY = Math.sin(t * 1.8) * 0.15;
    const breath = 1 + Math.sin(t * 3.0) * 0.08;
    // Shrink slightly on fade-out so the portal "collapses" as it vanishes.
    const fadeScale = portal.consumed ? 0.7 + 0.3 * alpha : 1;
    const s = breath * fadeScale;

    const root = rootRef.current;
    if (root) {
      root.position.set(portal.x, CENTER_Y + bobY, portal.z);
      // Non-uniform scale gives us the oval (wider than tall).
      root.scale.set(RX * s, RZ * s, RMIN * s);
    }

    // Core pulse
    const pulse = 0.7 + 0.3 * Math.sin(t * 3.2);
    if (discMatRef.current) discMatRef.current.opacity = 0.55 * alpha * pulse;
    if (coreMatRef.current) coreMatRef.current.opacity = 0.85 * alpha * pulse;
    if (ringMatRef.current) ringMatRef.current.opacity = 0.95 * alpha;
    if (glowMatRef.current) glowMatRef.current.opacity = 0.40 * alpha;
    if (haloMatRef.current) haloMatRef.current.opacity = 0.35 * alpha;
  });

  return (
    <group ref={rootRef}>
      {/* Upright oval — tilted back toward camera */}
      <group rotation={[TILT_X, 0, 0]}>
        {/* Outer fuzzy glow — intense */}
        <mesh position={[0, 0, -0.08]}>
          <ringGeometry args={[0.9, 1.6, 48]} />
          <meshBasicMaterial
            ref={glowMatRef}
            color="#6ab0ff"
            transparent
            opacity={0.7}
            blending={THREE.AdditiveBlending}
            depthWrite={false}
            side={THREE.DoubleSide}
          />
        </mesh>

        {/* Back disc — the gateway interior */}
        <mesh position={[0, 0, -0.04]}>
          <circleGeometry args={[0.85, 48]} />
          <meshBasicMaterial
            ref={discMatRef}
            color="#8040ee"
            transparent
            opacity={0.75}
            blending={THREE.AdditiveBlending}
            depthWrite={false}
            side={THREE.DoubleSide}
          />
        </mesh>

        {/* Bright inner core — hot white-purple */}
        <mesh position={[0, 0, 0]}>
          <circleGeometry args={[0.4, 32]} />
          <meshBasicMaterial
            ref={coreMatRef}
            color="#e0b0ff"
            transparent
            opacity={0.95}
            blending={THREE.AdditiveBlending}
            depthWrite={false}
            side={THREE.DoubleSide}
          />
        </mesh>

        {/* Main oval ring — thicker, brighter */}
        <mesh position={[0, 0, 0.04]}>
          <torusGeometry args={[1, 0.14, 14, 48]} />
          <meshBasicMaterial
            ref={ringMatRef}
            color="#c070ff"
            transparent
            opacity={1.0}
            blending={THREE.AdditiveBlending}
            depthWrite={false}
          />
        </mesh>
      </group>

      {/* Ground halo for pure top-down visibility. Lives outside the
          tilted group so it's always flat on the floor. The parent
          scale applies (RX wide, RZ deep) — which is exactly what we
          want for the floor footprint. */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -CENTER_Y / RMIN + 0.01, 0]}>
        <ringGeometry args={[0.7, 1.15, 40]} />
        <meshBasicMaterial
          ref={haloMatRef}
          color="#8040ff"
          transparent
          opacity={0.35}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
          side={THREE.DoubleSide}
        />
      </mesh>
    </group>
  );
}

/** Renders the full list of live portals. Caller should filter out
 *  fully-faded portals before passing them in (or leave them — they'll
 *  render at opacity 0). */
export function LabyrinthPortals3D({
  portals,
}: {
  portals: readonly ExtractionPortal[];
}) {
  return (
    <>
      {portals.map((p) => (
        <LabyrinthPortal3D key={p.id} portal={p} />
      ))}
    </>
  );
}
