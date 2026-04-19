/**
 * MobileControls.tsx
 * Twin-stick mobile input: left = move, right = aim, bottom = dash.
 *
 * Left half:  touch → floating movement joystick. Drag to walk.
 * Right half: touch → floating aim joystick. Drag to set facing/attack direction.
 * Dash:       always-visible opaque button, bottom-center.
 * Pause:      top-right corner.
 *
 * Attacks are automatic — the aim stick controls DIRECTION, not triggering.
 */

import { useEffect, useRef, useState, useCallback } from "react";
import type { GameState } from "../game/GameScene";
import { useGameStore } from "../store/gameStore";

interface Props {
  gsRef: React.RefObject<GameState | null>;
}

const JOYSTICK_RADIUS = 56;
const KNOB_RADIUS = 24;
const DEAD_ZONE = 0.12;

function checkMobile() {
  return "ontouchstart" in window || navigator.maxTouchPoints > 0 || window.innerWidth < 900;
}

export function MobileControls({ gsRef }: Props) {
  const [visible, setVisible] = useState(checkMobile);
  const setPhase = useGameStore(s => s.setPhase);
  const actionReady = useGameStore(s => s.actionReady);
  const actionCooldownTimer = useGameStore(s => s.actionCooldownTimer);
  const selectedClass = useGameStore(s => s.selectedClass);

  useEffect(() => {
    const onResize = () => setVisible(checkMobile());
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  useEffect(() => {
    if (!visible) return;
    // Mark the input manager as mobile so the desktop mouse raycaster
    // (AimResolver in GameScene) doesn't clobber the right-stick aim.
    const input = gsRef.current?.input;
    if (input) input.isMobile = true;
    return () => {
      gsRef.current?.input.setMobileMovement(false, false, false, false);
    };
  }, [visible, gsRef]);

  // ── Movement joystick (left half) ────────────────────────────────────────
  const moveId = useRef<number | null>(null);
  const [moveOrigin, setMoveOrigin] = useState<{ x: number; y: number } | null>(null);
  const [moveKnob, setMoveKnob] = useState({ x: 0, y: 0 });

  // ── Aim joystick (right half) ────────────────────────────────────────────
  const aimId = useRef<number | null>(null);
  const [aimOrigin, setAimOrigin] = useState<{ x: number; y: number } | null>(null);
  const [aimKnob, setAimKnob] = useState({ x: 0, y: 0 });

  const [dashFlash, setDashFlash] = useState(false);
  const [actionFlash, setActionFlash] = useState(false);

  // ── Shared joystick math ─────────────────────────────────────────────────
  function computeStick(cx: number, cy: number, ox: number, oy: number) {
    const dx = cx - ox;
    const dy = cy - oy;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const clamped = Math.min(dist, JOYSTICK_RADIUS);
    const angle = Math.atan2(dy, dx);
    const knob = { x: Math.cos(angle) * clamped, y: Math.sin(angle) * clamped };
    const t = clamped / JOYSTICK_RADIUS;
    const nx = dist > 0 ? dx / dist : 0;
    const ny = dist > 0 ? dy / dist : 0;
    return { knob, t, nx, ny };
  }

  // ── Touch dispatcher ─────────────────────────────────────────────────────
  const onTouchStart = useCallback((e: React.TouchEvent) => {
    const target = e.target as HTMLElement;
    if (target.closest("[data-ctrl]")) return;
    e.preventDefault();

    // Defensive: ensure isMobile is set so the desktop raycaster won't
    // overwrite worldAimX/Z while the right stick is active.
    const input = gsRef.current?.input;
    if (input) input.isMobile = true;

    const halfW = window.innerWidth / 2;

    for (let i = 0; i < e.changedTouches.length; i++) {
      const t = e.changedTouches[i];
      if (t.clientX < halfW) {
        // Left half → movement
        if (moveId.current === null) {
          moveId.current = t.identifier;
          setMoveOrigin({ x: t.clientX, y: t.clientY });
          setMoveKnob({ x: 0, y: 0 });
        }
      } else {
        // Right half → aim
        if (aimId.current === null) {
          aimId.current = t.identifier;
          setAimOrigin({ x: t.clientX, y: t.clientY });
          setAimKnob({ x: 0, y: 0 });
        }
      }
    }
  }, []);

  const onTouchMove = useCallback((e: React.TouchEvent) => {
    e.preventDefault();
    for (let i = 0; i < e.changedTouches.length; i++) {
      const t = e.changedTouches[i];

      // Movement stick
      if (t.identifier === moveId.current && moveOrigin) {
        const s = computeStick(t.clientX, t.clientY, moveOrigin.x, moveOrigin.y);
        setMoveKnob(s.knob);
        if (s.t < DEAD_ZONE) {
          gsRef.current?.input.setMobileMovement(false, false, false, false);
        } else {
          gsRef.current?.input.setMobileMovement(s.ny < -0.4, s.ny > 0.4, s.nx < -0.4, s.nx > 0.4);
        }
      }

      // Aim stick
      if (t.identifier === aimId.current && aimOrigin) {
        const s = computeStick(t.clientX, t.clientY, aimOrigin.x, aimOrigin.y);
        setAimKnob(s.knob);
        if (s.t >= DEAD_ZONE) {
          // Set worldAim to a point far in the aim direction from the player
          const g = gsRef.current;
          if (g) {
            const px = g.player.x;
            const pz = g.player.z;
            // Map screen-space aim to world-space: screen X → world X, screen Y → world Z
            g.input.worldAimX = px + s.nx * 20;
            g.input.worldAimZ = pz + s.ny * 20;
          }
        }
      }
    }
  }, [moveOrigin, aimOrigin, gsRef]);

  const onTouchEnd = useCallback((e: React.TouchEvent) => {
    e.preventDefault();
    for (let i = 0; i < e.changedTouches.length; i++) {
      const t = e.changedTouches[i];

      if (t.identifier === moveId.current) {
        moveId.current = null;
        setMoveOrigin(null);
        setMoveKnob({ x: 0, y: 0 });
        gsRef.current?.input.setMobileMovement(false, false, false, false);
      }

      if (t.identifier === aimId.current) {
        aimId.current = null;
        setAimOrigin(null);
        setAimKnob({ x: 0, y: 0 });
        // Keep last aim direction — don't reset worldAimX/Z
      }
    }
  }, [gsRef]);

  // ── Dash ─────────────────────────────────────────────────────────────────
  const onDash = useCallback((e: React.TouchEvent) => {
    e.preventDefault();
    e.stopPropagation();
    gsRef.current?.input.triggerMobileDash();
    setDashFlash(true);
    setTimeout(() => setDashFlash(false), 200);
  }, [gsRef]);

  // ── Action ──────────────────────────────────────────────────────────────
  const onAction = useCallback((e: React.TouchEvent) => {
    e.preventDefault();
    e.stopPropagation();
    gsRef.current?.input.triggerMobileAction();
    setActionFlash(true);
    setTimeout(() => setActionFlash(false), 200);
  }, [gsRef]);

  // ── Pause ────────────────────────────────────────────────────────────────
  const onPause = useCallback((e: React.TouchEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setPhase("paused");
  }, [setPhase]);

  if (!visible) return null;

  return (
    <div
      style={styles.wrapper}
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
      onTouchCancel={onTouchEnd}
    >
      {/* Left — movement joystick (floating) */}
      {moveOrigin && (
        <div
          style={{
            ...styles.joystickBase,
            left: moveOrigin.x - JOYSTICK_RADIUS,
            top: moveOrigin.y - JOYSTICK_RADIUS,
            borderColor: "rgba(180,120,255,0.4)",
            background: "rgba(180,120,255,0.10)",
          }}
        >
          <div style={{
            ...styles.joystickKnob,
            transform: `translate(calc(-50% + ${moveKnob.x}px), calc(-50% + ${moveKnob.y}px))`,
            background: "rgba(210,160,255,0.75)",
            borderColor: "rgba(230,200,255,0.85)",
            boxShadow: "0 0 14px rgba(180,100,255,0.6)",
          }} />
        </div>
      )}

      {/* Right — aim joystick (floating) */}
      {aimOrigin && (
        <div
          style={{
            ...styles.joystickBase,
            left: aimOrigin.x - JOYSTICK_RADIUS,
            top: aimOrigin.y - JOYSTICK_RADIUS,
            borderColor: "rgba(255,120,80,0.4)",
            background: "rgba(255,120,80,0.10)",
          }}
        >
          <div style={{
            ...styles.joystickKnob,
            transform: `translate(calc(-50% + ${aimKnob.x}px), calc(-50% + ${aimKnob.y}px))`,
            background: "rgba(255,160,120,0.75)",
            borderColor: "rgba(255,200,180,0.85)",
            boxShadow: "0 0 14px rgba(255,100,60,0.6)",
          }} />
        </div>
      )}

      {/* Subtle zone hints — always visible */}
      <div style={styles.moveHint}>MOVE</div>
      <div style={styles.aimHint}>AIM</div>

      {/* Action button — above dash button */}
      <div
        data-ctrl="action"
        style={{
          position: "absolute",
          bottom: 104,
          left: "50%",
          transform: "translateX(-50%)",
          width: 72,
          height: 72,
          borderRadius: 18,
          border: `2px solid ${actionReady ? "rgba(100,255,100,0.7)" : "rgba(100,100,100,0.4)"}`,
          display: "flex",
          flexDirection: "column" as const,
          alignItems: "center",
          justifyContent: "center",
          gap: 2,
          pointerEvents: "auto",
          touchAction: "none",
          boxShadow: actionReady ? "0 2px 16px rgba(60,200,60,0.5)" : "none",
          background: actionFlash
            ? "rgba(120,255,120,1)"
            : actionReady
              ? "rgba(25,100,40,0.85)"
              : "rgba(40,40,50,0.7)",
          opacity: actionReady ? 1 : 0.6,
        }}
        onTouchStart={onAction}
      >
        <span style={{ fontSize: 22, lineHeight: 1 }}>
          {selectedClass === "warrior" ? "📯" : selectedClass === "mage" ? "🔮" : selectedClass === "rogue" ? "🗡" : selectedClass === "necromancer" ? "💀" : "🎵"}
        </span>
        <span style={{
          fontSize: 7,
          fontWeight: "bold",
          letterSpacing: 1,
          color: actionReady ? "#aaffaa" : "#888",
          fontFamily: "monospace",
        }}>
          {actionReady ? (selectedClass === "warrior" ? "WAR CRY" : selectedClass === "mage" ? "BARRAGE" : selectedClass === "rogue" ? "KNIVES" : selectedClass === "necromancer" ? "ARMY" : "DISCORD") : `${Math.ceil(actionCooldownTimer)}s`}
        </span>
      </div>

      {/* Dash button — bottom-center, always visible, opaque */}
      <div
        data-ctrl="dash"
        style={{
          ...styles.dashBtn,
          background: dashFlash
            ? "rgba(120,200,255,1)"
            : "rgba(25,55,140,0.85)",
        }}
        onTouchStart={onDash}
      >
        <span style={styles.dashIcon}>⚡</span>
        <span style={styles.dashLabel}>DASH</span>
      </div>

      {/* Pause button — top-right */}
      <div
        data-ctrl="pause"
        style={styles.pauseBtn}
        onTouchStart={onPause}
      >
        <span style={styles.pauseIcon}>⏸</span>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  wrapper: {
    position: "absolute",
    inset: 0,
    pointerEvents: "auto",
    userSelect: "none",
    WebkitUserSelect: "none",
    touchAction: "none",
    zIndex: 5,
  },
  joystickBase: {
    position: "absolute",
    width: JOYSTICK_RADIUS * 2,
    height: JOYSTICK_RADIUS * 2,
    borderRadius: "50%",
    border: "2px solid",
    pointerEvents: "none",
  },
  joystickKnob: {
    position: "absolute",
    top: "50%",
    left: "50%",
    width: KNOB_RADIUS * 2,
    height: KNOB_RADIUS * 2,
    borderRadius: "50%",
    border: "2px solid",
    pointerEvents: "none",
  },
  moveHint: {
    position: "absolute",
    bottom: 10,
    left: "25%",
    transform: "translateX(-50%)",
    fontSize: 10,
    fontWeight: "bold",
    letterSpacing: 3,
    color: "rgba(180,140,255,0.15)",
    fontFamily: "monospace",
    pointerEvents: "none",
  },
  aimHint: {
    position: "absolute",
    bottom: 10,
    right: "25%",
    transform: "translateX(50%)",
    fontSize: 10,
    fontWeight: "bold",
    letterSpacing: 3,
    color: "rgba(255,140,100,0.15)",
    fontFamily: "monospace",
    pointerEvents: "none",
  },
  dashBtn: {
    position: "absolute",
    bottom: 24,
    left: "50%",
    transform: "translateX(-50%)",
    width: 72,
    height: 72,
    borderRadius: 18,
    border: "2px solid rgba(100,170,255,0.7)",
    display: "flex",
    flexDirection: "column" as const,
    alignItems: "center",
    justifyContent: "center",
    gap: 2,
    pointerEvents: "auto",
    touchAction: "none",
    boxShadow: "0 2px 16px rgba(60,130,255,0.5)",
  },
  dashIcon: {
    fontSize: 26,
    lineHeight: 1,
  },
  dashLabel: {
    fontSize: 9,
    fontWeight: "bold",
    letterSpacing: 1.5,
    color: "#aad4ff",
    fontFamily: "monospace",
  },
  pauseBtn: {
    position: "absolute",
    top: 12,
    right: 12,
    width: 44,
    height: 44,
    borderRadius: 10,
    background: "rgba(40,30,60,0.6)",
    border: "1px solid rgba(180,120,255,0.3)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    pointerEvents: "auto",
    touchAction: "none",
  },
  pauseIcon: {
    fontSize: 18,
    color: "rgba(200,160,255,0.7)",
  },
};
