/**
 * LabyrinthDebug.tsx
 *
 * Fixed-position HTML overlay that reads directly from the labyrinth's
 * state refs and displays raw diagnostic values. Rendered OUTSIDE the
 * R3F Canvas so a Canvas crash cannot affect it — which is the whole
 * point: if the player "disappears" but this overlay shows the player
 * position updating, we know the game loop is fine and the problem is
 * strictly in the 3D renderer.
 *
 * Toggle with `?debug=1` in the URL. Default-off so it doesn't clutter
 * normal play. During the visibility-diagnosis phase we may flip it on
 * by default; the toggle is a one-line change.
 */

import { useEffect, useState } from "react";
import type { PlayerAttackState } from "./LabyrinthCombat";
import type { ZoneState } from "./LabyrinthZone";

/** Minimal duck-typed player shape the debug panel reads. Defined here
 *  (rather than importing LabPlayer from LabyrinthScene) to avoid a
 *  circular import between the scene and this debug component. */
interface DebugPlayer {
  x: number; z: number; angle: number;
  hp: number; maxHp: number;
}

/** Subset of `LabSharedState` the debug panel cares about. */
interface DebugShared {
  zone: ZoneState;
  enemyCount: number;
  killCount: number;
  poisonStacks: number;
  poisonDps: number;
  outsideZone: boolean;
  defeated: boolean;
  extracted: boolean;
}

/** Returns `true` if `?debug=1` is in the current URL. */
function isDebugEnabled(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return new URLSearchParams(window.location.search).get("debug") === "1";
  } catch {
    return false;
  }
}

interface Props {
  playerRef: React.MutableRefObject<DebugPlayer>;
  sharedRef: React.MutableRefObject<DebugShared>;
  attackStateRef: React.MutableRefObject<PlayerAttackState>;
}

export function LabyrinthDebug({ playerRef, sharedRef, attackStateRef }: Props) {
  const [visible] = useState(isDebugEnabled);
  const [snapshot, setSnapshot] = useState({
    px: 0, pz: 0, angle: 0, hp: 0, maxHp: 0,
    swingVisualSec: 0, swingCooldownSec: 0,
    enemyCount: 0, killCount: 0,
    poisonStacks: 0, poisonDps: 0,
    outsideZone: false, defeated: false, extracted: false,
    elapsedSec: 0, zoneRadius: 0,
  });

  useEffect(() => {
    if (!visible) return;
    const iv = setInterval(() => {
      const p = playerRef.current;
      const s = sharedRef.current;
      const a = attackStateRef.current;
      setSnapshot({
        px: p.x, pz: p.z, angle: p.angle, hp: p.hp, maxHp: p.maxHp,
        swingVisualSec: a.swingVisualSec, swingCooldownSec: a.cooldownSec,
        enemyCount: s.enemyCount, killCount: s.killCount,
        poisonStacks: s.poisonStacks, poisonDps: s.poisonDps,
        outsideZone: s.outsideZone, defeated: s.defeated, extracted: s.extracted,
        elapsedSec: s.zone.elapsedSec, zoneRadius: s.zone.radius,
      });
    }, 100);
    return () => clearInterval(iv);
  }, [visible, playerRef, sharedRef, attackStateRef]);

  if (!visible) return null;

  const n = (v: number) => v.toFixed(2);

  return (
    <div style={styles.panel}>
      <div style={styles.title}>⚙ LAB DEBUG</div>
      <Row label="player" value={`(${n(snapshot.px)}, ${n(snapshot.pz)}) a=${n(snapshot.angle)}`} />
      <Row label="hp" value={`${Math.ceil(snapshot.hp)}/${snapshot.maxHp}`} />
      <Row label="swing vis" value={`${n(snapshot.swingVisualSec)}s`} />
      <Row label="swing cd" value={`${n(snapshot.swingCooldownSec)}s`} />
      <Row label="enemies" value={`${snapshot.enemyCount} live · ${snapshot.killCount} kills`} />
      <Row label="poison" value={`${snapshot.poisonStacks} stacks · ${n(snapshot.poisonDps)} dps`} />
      <Row label="zone" value={`r=${n(snapshot.zoneRadius)} t=${n(snapshot.elapsedSec)}s ${snapshot.outsideZone ? "(OUTSIDE)" : ""}`} />
      {snapshot.defeated && <Row label="state" value="DEFEATED" />}
      {snapshot.extracted && <Row label="state" value="EXTRACTED" />}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div style={styles.row}>
      <span style={styles.rowLabel}>{label}</span>
      <span style={styles.rowValue}>{value}</span>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  panel: {
    position: "absolute",
    left: 16,
    bottom: 16,
    minWidth: 260,
    padding: "10px 12px",
    background: "rgba(10,8,20,0.82)",
    border: "1px solid rgba(200,150,255,0.35)",
    borderRadius: 6,
    color: "#e6dcff",
    font: "12px/1.45 ui-monospace, Menlo, monospace",
    pointerEvents: "none",
    zIndex: 60,
    boxShadow: "0 0 16px rgba(120,80,180,0.25)",
  },
  title: {
    fontSize: 10,
    fontWeight: "bold",
    letterSpacing: 1,
    color: "#b088ff",
    marginBottom: 6,
    paddingBottom: 4,
    borderBottom: "1px solid rgba(160,110,230,0.25)",
  },
  row: {
    display: "flex",
    justifyContent: "space-between",
    gap: 12,
  },
  rowLabel: {
    color: "#8f7ab8",
  },
  rowValue: {
    color: "#e0d0ff",
    fontWeight: 500,
  },
};
