/**
 * GameScene.tsx
 * Main React Three Fiber scene. This is where the 3D game world lives.
 * The useFrame game loop runs here, calling GameManager.update() each frame.
 */

import { useRef, useEffect, useCallback } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { EffectComposer, Bloom, Vignette } from "@react-three/postprocessing";
import * as THREE from "three";

import { GameManager } from "./GameManager";
import { DungeonRoom } from "../world/DungeonRoom";
import { Torch3D } from "../world/Torch3D";
import { Player3D } from "../entities/Player3D";
import { Enemy3D } from "../entities/Enemy3D";
import { XPOrb3D } from "../entities/XPOrb3D";
import { AttackEffect } from "../effects/AttackEffect";
import { HUD } from "../ui/HUD";
import { LevelUp } from "../ui/LevelUp";
import { PauseMenu } from "../ui/PauseMenu";
import { useGameStore } from "../store/gameStore";
import { GAME_CONFIG } from "../data/GameConfig";

// ─── Torch positions (perimeter of dungeon) ─────────────────────────────────
const H = GAME_CONFIG.ARENA_HALF;
const W = GAME_CONFIG.WALL_THICKNESS;
const TORCH_POSITIONS: [number, number, number][] = [
  // North wall
  [-20, 2.8, -H + 0.2],
  [0,   2.8, -H + 0.2],
  [20,  2.8, -H + 0.2],
  // South wall
  [-20, 2.8,  H - 0.2],
  [0,   2.8,  H - 0.2],
  [20,  2.8,  H - 0.2],
  // West wall
  [-H + 0.2, 2.8, -15],
  [-H + 0.2, 2.8,   0],
  [-H + 0.2, 2.8,  15],
  // East wall
  [ H - 0.2, 2.8, -15],
  [ H - 0.2, 2.8,   0],
  [ H - 0.2, 2.8,  15],
];

// ─── Camera controller ───────────────────────────────────────────────────────
function CameraController({ manager }: { manager: GameManager }) {
  const { camera } = useThree();
  const targetPos = useRef(new THREE.Vector3());

  useEffect(() => {
    camera.position.set(0, 28, 22);
    camera.lookAt(0, 0, 0);
  }, [camera]);

  useFrame(() => {
    const p = manager.player;
    targetPos.current.set(p.x, 28, p.z + 22);
    camera.position.lerp(targetPos.current, 0.06);
    camera.lookAt(p.x, 0, p.z);
  });

  return null;
}

// ─── Raycaster: mouse → world position for aim ────────────────────────────
function AimResolver({ manager }: { manager: GameManager }) {
  const { camera, raycaster, pointer } = useThree();
  const groundPlane = useRef(new THREE.Plane(new THREE.Vector3(0, 1, 0), 0));
  const target = useRef(new THREE.Vector3());

  useFrame(() => {
    raycaster.setFromCamera(pointer, camera);
    raycaster.ray.intersectPlane(groundPlane.current, target.current);
    manager.input.worldAimX = target.current.x;
    manager.input.worldAimZ = target.current.z;
  });

  return null;
}

// ─── Game loop + entity rendering ────────────────────────────────────────────
function GameLoop({ manager }: { manager: GameManager }) {
  const phase = useGameStore((s) => s.phase);
  const enemies = useGameStore((s) => s.enemies);
  const xpOrbs = useGameStore((s) => s.xpOrbs);
  const isAttacking = useGameStore((s) => s.isAttacking);
  const playerX = useGameStore((s) => s.playerX);
  const playerZ = useGameStore((s) => s.playerZ);
  const playerAngle = useGameStore((s) => s.playerAngle);

  useFrame((_, delta) => {
    if (phase === "playing" || phase === "levelup") {
      manager.update(Math.min(delta, 0.05)); // cap delta to avoid spiral of death
    }
  });

  return (
    <>
      <CameraController manager={manager} />
      <AimResolver manager={manager} />

      {/* Player */}
      <Player3D manager={manager} />

      {/* Attack effect */}
      <AttackEffect
        x={playerX}
        z={playerZ}
        angle={playerAngle}
        active={isAttacking}
      />

      {/* Enemies */}
      {manager.enemies.filter((e) => !e.dead).map((enemy) => (
        <Enemy3D key={enemy.id} enemy={enemy} />
      ))}

      {/* XP Orbs */}
      {manager.xpOrbs.map((orb) => (
        <XPOrb3D key={orb.id} orb={orb} />
      ))}
    </>
  );
}

// ─── Lighting setup ──────────────────────────────────────────────────────────
function Lighting() {
  return (
    <>
      {/* Ambient — very dim, cold dungeon feel */}
      <ambientLight color="#1a1030" intensity={0.4} />
      {/* Overhead fill — blue-purple */}
      <directionalLight
        color="#2a1850"
        intensity={0.5}
        position={[10, 20, 10]}
        castShadow
        shadow-mapSize={[1024, 1024]}
        shadow-camera-far={120}
        shadow-camera-left={-40}
        shadow-camera-right={40}
        shadow-camera-top={40}
        shadow-camera-bottom={-40}
      />
    </>
  );
}

// ─── Root scene content ──────────────────────────────────────────────────────
function SceneContent({ manager }: { manager: GameManager }) {
  return (
    <>
      <Lighting />
      <fog attach="fog" color="#04000a" near={20} far={75} />

      <DungeonRoom />

      {/* Torches */}
      {TORCH_POSITIONS.map((pos, i) => (
        <Torch3D key={i} position={pos} />
      ))}

      <GameLoop manager={manager} />

      {/* Post-processing */}
      <EffectComposer>
        <Bloom
          intensity={0.8}
          luminanceThreshold={0.4}
          luminanceSmoothing={0.9}
          mipmapBlur
        />
        <Vignette eskil={false} offset={0.25} darkness={0.7} />
      </EffectComposer>
    </>
  );
}

// ─── GameScene (exported) ────────────────────────────────────────────────────
interface GameSceneProps {
  manager: GameManager;
  onRestart: () => void;
}

export function GameScene({ manager, onRestart }: GameSceneProps) {
  const phase = useGameStore((s) => s.phase);

  const handleUpgradeChoice = useCallback((id: string) => {
    manager.applyUpgrade(id);
  }, [manager]);

  // ESC while paused → resume (handled inside GameManager, but also catch it here)
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.code === "Escape" && phase === "paused") {
        useGameStore.getState().setPhase("playing");
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [phase]);

  return (
    <div style={{ width: "100%", height: "100%", position: "relative" }}>
      <Canvas
        shadows
        camera={{ fov: 50, near: 0.5, far: 200, position: [0, 28, 22] }}
        gl={{ antialias: true, toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 0.9 }}
        style={{ background: "#04000a" }}
        onContextMenu={(e) => e.preventDefault()}
      >
        <SceneContent manager={manager} />
      </Canvas>

      {/* HUD overlay */}
      {(phase === "playing" || phase === "paused" || phase === "levelup") && (
        <HUD />
      )}

      {/* Pause */}
      {phase === "paused" && <PauseMenu />}

      {/* Level up */}
      {phase === "levelup" && (
        <LevelUp onChoice={handleUpgradeChoice} />
      )}
    </div>
  );
}
