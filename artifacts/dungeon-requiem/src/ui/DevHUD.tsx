/**
 * DevHUD.tsx — Developer overlay for live diagnostics.
 * Activated via ?dev=1 query parameter. Regular players never see it.
 *
 * Reads runtime game state from a gsRef (same pattern as MobileControls)
 * and store-backed values from useGameStore. Refreshes ~10 Hz via rAF.
 */

import { useEffect, useRef, useState } from "react";
import type { GameState } from "../game/GameScene";
import { useGameStore } from "../store/gameStore";
import { GAME_CONFIG } from "../data/GameConfig";

const DEV_ENABLED =
  typeof window !== "undefined" &&
  (new URLSearchParams(window.location.search).get("dev") === "1" ||
    localStorage.getItem("devMode") === "1");

/** How many frames between DOM updates (~10 Hz at 60fps) */
const UPDATE_EVERY = 6;

interface DevHUDProps {
  gsRef: React.RefObject<GameState | null>;
}

interface Snapshot {
  fps: number;
  frameMs: number;
  // world
  wave: number;
  waveTimer: number;
  waveDuration: number;
  bossAlive: boolean;
  bossHpPct: number;
  freezeRemain: number;
  shakeAmp: number;
  shakeTimer: number;
  // entities
  enemyCount: number;
  enemyBreakdown: string;
  projectileCount: number;
  enemyProjCount: number;
  xpOrbCount: number;
  gearDropCount: number;
  deathFxCount: number;
  // player
  hp: number;
  maxHp: number;
  dashCooldown: number;
  invTimer: number;
  inventoryCount: number;
  equippedSlots: string;
  // stats
  damage: number;
  armor: number;
  moveSpeed: number;
  critChance: number;
  lifesteal: number;
  xpMult: number;
  attackSpeed: number;
  healthRegen: number;
}

export function DevHUD({ gsRef }: DevHUDProps) {
  if (!DEV_ENABLED) return null;

  return <DevHUDInner gsRef={gsRef} />;
}

/** Inner component — only mounted when dev mode is active. */
function DevHUDInner({ gsRef }: DevHUDProps) {
  const [snap, setSnap] = useState<Snapshot | null>(null);
  const frameTimesRef = useRef<number[]>([]);
  const lastTimeRef = useRef(performance.now());
  const frameCountRef = useRef(0);

  // Store-backed values for level/xp (not on GameState directly)
  const level = useGameStore((s) => s.level);
  const xp = useGameStore((s) => s.xp);
  const xpToNext = useGameStore((s) => s.xpToNext);

  useEffect(() => {
    let raf = 0;

    const tick = () => {
      const now = performance.now();
      const dt = now - lastTimeRef.current;
      lastTimeRef.current = now;

      // Ring buffer for FPS averaging
      const buf = frameTimesRef.current;
      buf.push(dt);
      if (buf.length > 60) buf.shift();

      frameCountRef.current++;
      if (frameCountRef.current % UPDATE_EVERY === 0) {
        const g = gsRef.current;
        if (g) {
          const avgMs = buf.reduce((a, b) => a + b, 0) / buf.length;
          const fps = avgMs > 0 ? 1000 / avgMs : 0;

          // Enemy type breakdown
          const typeCounts: Record<string, number> = {};
          for (const e of g.enemies) {
            if (!e.dead) typeCounts[e.type] = (typeCounts[e.type] || 0) + 1;
          }
          const breakdown = Object.entries(typeCounts)
            .map(([t, n]) => `${t.slice(0, 3)} ${n}`)
            .join(" · ") || "—";

          const p = g.player;
          const s = g.progression.stats;

          // Equipped slots display
          const slots = [
            g.equippedGear.weapon ? "W" : "w",
            g.equippedGear.armor ? "E" : "e",
            g.equippedGear.trinket ? "T" : "t",
          ].join(" ");

          setSnap({
            fps: Math.round(fps),
            frameMs: Math.round(dt * 10) / 10,
            wave: g.wave,
            waveTimer: Math.round(g.waveTimer * 10) / 10,
            waveDuration: GAME_CONFIG.DIFFICULTY.WAVE_DURATION,
            bossAlive: g.bossAlive,
            bossHpPct: g.bossAlive
              ? Math.round(
                  ((g.enemies.find((e) => e.id === g.bossId)?.hp ?? 0) /
                    (g.enemies.find((e) => e.id === g.bossId)?.maxHp ?? 1)) *
                    100
                )
              : 0,
            freezeRemain: Math.max(0, Math.round(g.freezeUntil - now)),
            shakeAmp: Math.round(g.shakeAmp * 1000) / 1000,
            shakeTimer: Math.round(g.shakeTimer * 100) / 100,
            enemyCount: g.enemies.filter((e) => !e.dead).length,
            enemyBreakdown: breakdown,
            projectileCount: g.projectiles.length,
            enemyProjCount: g.enemyProjectiles.length,
            xpOrbCount: g.xpOrbs.length,
            gearDropCount: g.gearDrops.length,
            deathFxCount: g.deathFx.length,
            hp: Math.ceil(p.hp),
            maxHp: p.maxHp,
            dashCooldown: Math.round(p.dashCooldown * 100) / 100,
            invTimer: Math.round(p.invTimer * 100) / 100,
            inventoryCount: g.inventory.length,
            equippedSlots: slots,
            damage: Math.round(s.damage),
            armor: Math.round(s.armor),
            moveSpeed: Math.round(s.moveSpeed * 10) / 10,
            critChance: Math.round(s.critChance),
            lifesteal: Math.round(s.lifesteal),
            xpMult: Math.round(s.xpMultiplier * 100) / 100,
            attackSpeed: Math.round(s.attackSpeed * 100) / 100,
            healthRegen: Math.round(s.healthRegen * 10) / 10,
          });
        }
      }

      raf = requestAnimationFrame(tick);
    };

    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [gsRef]);

  if (!snap) return null;

  return (
    <div style={styles.container}>
      <div style={styles.header}>DEV HUD</div>

      {/* Performance */}
      <div style={styles.group}>
        <Row label="FPS" value={snap.fps} warn={snap.fps < 50} />
        <Row label="frame" value={`${snap.frameMs}ms`} />
      </div>

      {/* World */}
      <div style={styles.group}>
        <Row label="wave" value={`${snap.wave}  ${snap.waveTimer}/${snap.waveDuration}s`} />
        {snap.bossAlive && <Row label="boss" value={`${snap.bossHpPct}% HP`} warn />}
        {snap.freezeRemain > 0 && <Row label="freeze" value={`${snap.freezeRemain}ms`} />}
        {snap.shakeTimer > 0 && (
          <Row label="shake" value={`amp ${snap.shakeAmp}  t ${snap.shakeTimer}s`} />
        )}
      </div>

      {/* Entities */}
      <div style={styles.group}>
        <Row label="enemies" value={`${snap.enemyCount}`} />
        <div style={styles.sub}>{snap.enemyBreakdown}</div>
        <Row label="proj" value={`${snap.projectileCount} / ${snap.enemyProjCount}`} />
        <Row label="xp orbs" value={snap.xpOrbCount} />
        <Row label="gear" value={snap.gearDropCount} />
        {snap.deathFxCount > 0 && <Row label="deathFx" value={snap.deathFxCount} />}
      </div>

      {/* Player */}
      <div style={styles.group}>
        <Row label="HP" value={`${snap.hp}/${snap.maxHp}`} warn={snap.hp / snap.maxHp < 0.25} />
        <Row label="Lv" value={`${level}  ${xp}/${xpToNext}`} />
        <Row label="inv" value={`${snap.inventoryCount}/20`} />
        <Row label="gear" value={snap.equippedSlots} />
        {snap.dashCooldown > 0 && <Row label="dash cd" value={`${snap.dashCooldown}s`} />}
        {snap.invTimer > 0 && <Row label="i-frame" value={`${snap.invTimer}s`} />}
      </div>

      {/* Stats */}
      <div style={styles.group}>
        <div style={styles.statsLine}>
          DMG {snap.damage} · ARM {snap.armor} · MOV {snap.moveSpeed}
        </div>
        <div style={styles.statsLine}>
          CRIT {snap.critChance}% · LS {snap.lifesteal}% · XP {snap.xpMult}x
        </div>
        <div style={styles.statsLine}>
          ASPD {snap.attackSpeed} · REGEN {snap.healthRegen}/s
        </div>
      </div>
    </div>
  );
}

function Row({
  label,
  value,
  warn,
}: {
  label: string;
  value: string | number;
  warn?: boolean;
}) {
  return (
    <div style={styles.row}>
      <span style={styles.label}>{label}</span>
      <span style={{ ...styles.value, color: warn ? "#ff6644" : "#ccc" }}>{value}</span>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    position: "absolute",
    top: 140,
    right: 8,
    width: 200,
    background: "rgba(0,0,0,0.7)",
    border: "1px solid rgba(100,100,100,0.3)",
    borderRadius: 6,
    padding: "6px 8px",
    fontFamily: "monospace",
    fontSize: 11,
    color: "#aaa",
    pointerEvents: "none",
    zIndex: 100,
    lineHeight: 1.4,
  },
  header: {
    color: "#8888ff",
    fontSize: 9,
    fontWeight: "bold",
    letterSpacing: 3,
    textAlign: "center" as const,
    marginBottom: 4,
    borderBottom: "1px solid rgba(100,100,100,0.2)",
    paddingBottom: 3,
  },
  group: {
    marginBottom: 4,
    paddingBottom: 3,
    borderBottom: "1px solid rgba(60,60,60,0.2)",
  },
  row: {
    display: "flex",
    justifyContent: "space-between",
  },
  label: {
    color: "#777",
    textTransform: "uppercase" as const,
    fontSize: 9,
    letterSpacing: 1,
  },
  value: {
    color: "#ccc",
    textAlign: "right" as const,
  },
  sub: {
    color: "#666",
    fontSize: 9,
    paddingLeft: 4,
    marginTop: 1,
  },
  statsLine: {
    color: "#999",
    fontSize: 9,
    letterSpacing: 0.5,
  },
};
