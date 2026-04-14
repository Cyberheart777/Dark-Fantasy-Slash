/**
 * LabyrinthScene.tsx — Root scene for The Labyrinth game mode.
 *
 * Step 1 (this milestone): navigable maze with player movement and camera.
 * No enemies, no closing zone, no combat — just verify maze generation,
 * collision, and camera work.
 *
 * This is a plugin scene that runs completely independently from the core
 * GameScene. It reuses InputManager3D for keyboard/mouse polling. Combat,
 * power-ups, enemies, and gear will be wired in future steps.
 */

import { useRef, useEffect, useMemo, useState, useCallback } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { useGameStore } from "../../store/gameStore";
import { InputManager3D } from "../InputManager3D";
import {
  LABYRINTH_CONFIG,
  LABYRINTH_HALF,
} from "./LabyrinthConfig";
import {
  generateMaze,
  cellToWorld,
  worldToCell,
  extractWallSegments,
  type Maze,
  WALL_N, WALL_E, WALL_S, WALL_W,
} from "./LabyrinthMaze";
import { LabyrinthMap3D } from "./LabyrinthMap3D";

// ─── Player runtime (lean — no combat yet) ────────────────────────────────────

interface LabPlayer {
  x: number;
  z: number;
  angle: number;
  vx: number;
  vz: number;
}

// ─── Root React component ─────────────────────────────────────────────────────

export function LabyrinthScene() {
  // Generate maze once per scene mount — each run gets a fresh maze.
  const maze = useMemo(() => generateMaze(), []);

  return (
    <div style={styles.root}>
      <Canvas
        shadows
        camera={{ position: [0, 28, 18], fov: 55, near: 0.5, far: 300 }}
        gl={{ antialias: true }}
      >
        <LabyrinthWorld maze={maze} />
      </Canvas>
      <LabyrinthHUD maze={maze} />
    </div>
  );
}

// ─── 3D world contents ────────────────────────────────────────────────────────

function LabyrinthWorld({ maze }: { maze: Maze }) {
  // Spawn position from the maze generator.
  const spawnWorld = useMemo(() => cellToWorld(maze.spawn.col, maze.spawn.row), [maze]);

  const playerRef = useRef<LabPlayer>({
    x: spawnWorld.x,
    z: spawnWorld.z,
    angle: 0,
    vx: 0,
    vz: 0,
  });

  const inputRef = useRef<InputManager3D | null>(null);
  if (!inputRef.current) inputRef.current = new InputManager3D();

  useEffect(() => {
    return () => {
      inputRef.current?.destroy();
      inputRef.current = null;
    };
  }, []);

  return (
    <>
      {/* Lighting — warm-cool contrast matching the core dungeon */}
      <ambientLight intensity={0.35} color="#6a4888" />
      <directionalLight
        position={[30, 50, 20]}
        intensity={0.8}
        color="#b090d0"
        castShadow
      />
      <pointLight
        position={[0, 8, 0]}
        intensity={0.6}
        color="#c080ff"
        distance={40}
      />
      <fog attach="fog" args={["#080410", 20, 80]} />

      <LabyrinthMap3D maze={maze} />
      <PlayerMarker playerRef={playerRef} />
      <CameraFollow playerRef={playerRef} />
      <MovementLoop playerRef={playerRef} maze={maze} inputRef={inputRef} />
    </>
  );
}

// ─── Player marker (placeholder cube — real class rendering comes later) ──────

function PlayerMarker({ playerRef }: { playerRef: React.MutableRefObject<LabPlayer> }) {
  const meshRef = useRef<THREE.Mesh>(null);

  useFrame(() => {
    if (!meshRef.current) return;
    const p = playerRef.current;
    meshRef.current.position.set(p.x, 1.0, p.z);
    meshRef.current.rotation.y = p.angle;
  });

  return (
    <mesh ref={meshRef} castShadow>
      <boxGeometry args={[1.2, 2.0, 1.2]} />
      <meshStandardMaterial
        color="#9040e0"
        emissive="#7020c0"
        emissiveIntensity={0.4}
        roughness={0.5}
      />
    </mesh>
  );
}

// ─── Camera follow ────────────────────────────────────────────────────────────
// Top-down isometric chase, matching the core game's camera feel.

function CameraFollow({ playerRef }: { playerRef: React.MutableRefObject<LabPlayer> }) {
  const { camera } = useThree();
  const target = useRef(new THREE.Vector3());
  const currentPos = useRef(new THREE.Vector3(0, 28, 18));

  useFrame((_, delta) => {
    const p = playerRef.current;
    // Desired camera position: above and behind the player
    const desired = new THREE.Vector3(p.x, 22, p.z + 14);
    currentPos.current.lerp(desired, Math.min(1, delta * 6));
    camera.position.copy(currentPos.current);
    target.current.set(p.x, 0, p.z);
    camera.lookAt(target.current);
  });

  return null;
}

// ─── Movement + collision loop ────────────────────────────────────────────────
// Reads input, moves the player, checks maze wall collisions.

function MovementLoop({
  playerRef,
  maze,
  inputRef,
}: {
  playerRef: React.MutableRefObject<LabPlayer>;
  maze: Maze;
  inputRef: React.MutableRefObject<InputManager3D | null>;
}) {
  // Precompute wall segments for collision (same data as renderer).
  const segments = useMemo(() => extractWallSegments(maze), [maze]);

  useFrame((_, delta) => {
    const input = inputRef.current;
    if (!input) return;
    const s = input.state;
    const p = playerRef.current;

    // Movement input → velocity (simple 8-way)
    let dx = 0, dz = 0;
    if (s.up)    dz -= 1;
    if (s.down)  dz += 1;
    if (s.left)  dx -= 1;
    if (s.right) dx += 1;
    const len = Math.sqrt(dx * dx + dz * dz);
    if (len > 0) { dx /= len; dz /= len; }

    const SPEED = 9;
    const nextX = p.x + dx * SPEED * delta;
    const nextZ = p.z + dz * SPEED * delta;

    // Axis-separated collision: try X first, then Z. Allows wall-sliding.
    const PLAYER_R = 0.7;
    if (!collidesWithAnyWall(nextX, p.z, PLAYER_R, segments)) p.x = nextX;
    if (!collidesWithAnyWall(p.x, nextZ, PLAYER_R, segments)) p.z = nextZ;

    // Facing angle follows movement direction
    if (dx !== 0 || dz !== 0) {
      p.angle = Math.atan2(dx, -dz);
    }
  });

  return null;
}

/** Check if a circle at (cx, cz) with radius r intersects any wall box. */
function collidesWithAnyWall(
  cx: number,
  cz: number,
  r: number,
  segments: ReturnType<typeof extractWallSegments>,
): boolean {
  const wallT = LABYRINTH_CONFIG.WALL_THICKNESS;
  for (const seg of segments) {
    const halfW = seg.orient === "h" ? seg.length / 2 : wallT / 2;
    const halfH = seg.orient === "v" ? seg.length / 2 : wallT / 2;
    // Closest point on the box to the circle
    const closestX = Math.max(seg.cx - halfW, Math.min(cx, seg.cx + halfW));
    const closestZ = Math.max(seg.cz - halfH, Math.min(cz, seg.cz + halfH));
    const dx = cx - closestX;
    const dz = cz - closestZ;
    if (dx * dx + dz * dz < r * r) return true;
  }
  // Outer boundary safety
  if (cx < -LABYRINTH_HALF + r) return true;
  if (cx >  LABYRINTH_HALF - r) return true;
  if (cz < -LABYRINTH_HALF + r) return true;
  if (cz >  LABYRINTH_HALF - r) return true;
  return false;
}

// ─── HUD (dev / placeholder) ──────────────────────────────────────────────────

function LabyrinthHUD({ maze }: { maze: Maze }) {
  const setPhase = useGameStore((s) => s.setPhase);
  const [esc, setEsc] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code === "Escape") setEsc(true);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const exit = useCallback(() => setPhase("menu"), [setPhase]);

  return (
    <>
      <div style={styles.hudBanner}>
        <div style={styles.hudTitle}>THE LABYRINTH</div>
        <div style={styles.hudSub}>Step 1 — Navigate the maze · WASD to move · ESC to exit</div>
        <div style={styles.hudStats}>
          {maze.size}×{maze.size} maze · {maze.deadEnds.length} dead ends · spawn ({maze.spawn.col},{maze.spawn.row}) · center ({maze.center.col},{maze.center.row})
        </div>
      </div>

      {esc && (
        <div style={styles.escOverlay}>
          <div style={styles.escPanel}>
            <div style={styles.escTitle}>PAUSED</div>
            <button style={styles.escBtn} onClick={() => setEsc(false)}>▶ RESUME</button>
            <button style={styles.escBtn} onClick={exit}>⌂ EXIT TO MAIN MENU</button>
          </div>
        </div>
      )}
    </>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const styles: Record<string, React.CSSProperties> = {
  root: {
    position: "absolute",
    inset: 0,
    background: "#04000a",
  },
  hudBanner: {
    position: "absolute",
    top: 16,
    left: "50%",
    transform: "translateX(-50%)",
    padding: "10px 20px",
    background: "rgba(10,15,30,0.7)",
    border: "1px solid rgba(60,140,220,0.4)",
    borderRadius: 8,
    color: "#aadfff",
    fontFamily: "'Segoe UI', monospace",
    textAlign: "center",
    pointerEvents: "none",
  },
  hudTitle: {
    fontSize: 16, fontWeight: 900, letterSpacing: 6,
    textShadow: "0 0 10px rgba(60,140,220,0.6)",
  },
  hudSub: {
    fontSize: 11, letterSpacing: 2, color: "rgba(170,223,255,0.8)", marginTop: 4,
  },
  hudStats: {
    fontSize: 10, letterSpacing: 1, color: "rgba(170,223,255,0.5)", marginTop: 3,
    fontFamily: "monospace",
  },
  escOverlay: {
    position: "absolute",
    inset: 0,
    background: "rgba(0,0,0,0.75)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    backdropFilter: "blur(6px)",
  },
  escPanel: {
    padding: "40px 48px",
    background: "rgba(6,3,12,0.95)",
    border: "1px solid rgba(60,140,220,0.5)",
    borderRadius: 16,
    display: "flex",
    flexDirection: "column",
    gap: 12,
    alignItems: "center",
    minWidth: 320,
  },
  escTitle: {
    fontSize: 28, fontWeight: 900, letterSpacing: 8, color: "#aadfff",
    textShadow: "0 0 14px rgba(60,140,220,0.5)", marginBottom: 12,
  },
  escBtn: {
    width: 240, padding: "12px", fontSize: 13, fontWeight: "bold",
    letterSpacing: 2, color: "#aadfff",
    background: "rgba(10,25,50,0.8)",
    border: "1px solid rgba(60,140,220,0.5)",
    borderRadius: 8, cursor: "pointer", fontFamily: "inherit",
  },
};

// Suppress unused-import lint (reserved for step 2+ collision refinement).
void worldToCell; void WALL_N; void WALL_E; void WALL_S; void WALL_W;
