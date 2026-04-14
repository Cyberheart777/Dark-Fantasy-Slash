/**
 * LabyrinthPlayer3D.tsx
 *
 * Renders the labyrinth player by delegating to the main game's
 * `Player3D`. The player model dispatches on `charClass` — Warrior
 * (GLB), Mage (procedural), Rogue (procedural). All three work today;
 * currently only Warrior is selectable in the labyrinth (see
 * LabyrinthCharSelect), but Mage + Rogue render correctly if the
 * charClass prop is set to them in the future.
 *
 * A single GameState-shaped shim is maintained in a ref and updated
 * every frame from the LabPlayer. Player3D reads `gs.current.charClass`
 * once (for mesh dispatch) and `gs.current.player` each frame for
 * position / angle / attack triggers.
 */

import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import type { CharacterClass } from "../../data/CharacterData";
import { Player3D } from "../../entities/Player3D";
import type { GameState } from "../GameScene";
import type { PlayerAttackState } from "./LabyrinthCombat";
import { createPlayerShim, updatePlayerShim } from "./LabyrinthShims";

interface LabPlayerForVisual {
  x: number;
  z: number;
  angle: number;
  hp: number;
  maxHp: number;
}

interface Props {
  charClass: CharacterClass;
  playerRef: React.MutableRefObject<LabPlayerForVisual>;
  attackStateRef: React.MutableRefObject<PlayerAttackState>;
}

export function LabyrinthPlayer3D({ charClass, playerRef, attackStateRef }: Props) {
  // Built once per mount. Player3D reads charClass once at top-level,
  // so changing charClass mid-scene would need a remount; the labyrinth
  // doesn't change class mid-run, so a single shim is fine.
  const shimRef = useRef<GameState | null>(null);
  if (!shimRef.current) shimRef.current = createPlayerShim(charClass);

  // Track the previous swing-visual timer so updatePlayerShim can bump
  // the shim's `attackTrigger` counter exactly once per swing (on the
  // leading edge), matching the main game's one-shot semantics.
  const prevSwingRef = useRef({ value: 0 });

  // Seed the shim player position from the ref so the first frame
  // shows the character at its spawn rather than (0, 0).
  useMemo(() => {
    const shim = shimRef.current;
    if (!shim) return;
    const p = playerRef.current;
    shim.player.x = p.x;
    shim.player.z = p.z;
    shim.player.angle = p.angle;
  }, [playerRef]);

  useFrame(() => {
    const shim = shimRef.current;
    if (!shim) return;
    updatePlayerShim(
      shim,
      playerRef.current,
      attackStateRef.current,
      prevSwingRef.current,
    );
  });

  return <Player3D gs={shimRef} />;
}
