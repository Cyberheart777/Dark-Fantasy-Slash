/**
 * MobileControls.tsx
 * Vampire Survivors-style mobile input: full-screen floating joystick + dash.
 *
 * Touch anywhere → joystick spawns at finger position.
 * Drag to move. Release → joystick vanishes, player stops.
 * Attacks are fully automatic — no attack button needed.
 * Aim is handled by auto-aim (nearest enemy / movement direction).
 *
 * Dash button: bottom-right, always visible.
 * Pause button: top-right corner.
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

  useEffect(() => {
    const onResize = () => setVisible(checkMobile());
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  useEffect(() => {
    if (!visible) return;
    return () => {
      gsRef.current?.input.setMobileMovement(false, false, false, false);
    };
  }, [visible, gsRef]);

  // ── Floating joystick state ──────────────────────────────────────────────
  const joystickId = useRef<number | null>(null);
  const [joystickOrigin, setJoystickOrigin] = useState<{ x: number; y: number } | null>(null);
  const [knobOffset, setKnobOffset] = useState({ x: 0, y: 0 });
  const [dashFlash, setDashFlash] = useState(false);

  const updateJoystick = useCallback((cx: number, cy: number, ox: number, oy: number) => {
    const dx = cx - ox;
    const dy = cy - oy;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const clamped = Math.min(dist, JOYSTICK_RADIUS);
    const angle = Math.atan2(dy, dx);
    setKnobOffset({ x: Math.cos(angle) * clamped, y: Math.sin(angle) * clamped });

    const t = clamped / JOYSTICK_RADIUS;
    if (t < DEAD_ZONE) {
      gsRef.current?.input.setMobileMovement(false, false, false, false);
      return;
    }
    const nx = dx / Math.max(dist, 1);
    const ny = dy / Math.max(dist, 1);
    gsRef.current?.input.setMobileMovement(ny < -0.4, ny > 0.4, nx < -0.4, nx > 0.4);
  }, [gsRef]);

  // ── Touch handlers for full-screen joystick ──────────────────────────────
  const onTouchStart = useCallback((e: React.TouchEvent) => {
    // Don't intercept touches on dash or pause buttons
    const target = e.target as HTMLElement;
    if (target.closest("[data-ctrl]")) return;

    e.preventDefault();
    if (joystickId.current !== null) return; // already tracking a joystick touch

    const t = e.changedTouches[0];
    joystickId.current = t.identifier;
    const origin = { x: t.clientX, y: t.clientY };
    setJoystickOrigin(origin);
    setKnobOffset({ x: 0, y: 0 });
  }, []);

  const onTouchMove = useCallback((e: React.TouchEvent) => {
    e.preventDefault();
    if (joystickId.current === null || !joystickOrigin) return;
    for (let i = 0; i < e.changedTouches.length; i++) {
      if (e.changedTouches[i].identifier === joystickId.current) {
        updateJoystick(
          e.changedTouches[i].clientX,
          e.changedTouches[i].clientY,
          joystickOrigin.x,
          joystickOrigin.y,
        );
      }
    }
  }, [joystickOrigin, updateJoystick]);

  const onTouchEnd = useCallback((e: React.TouchEvent) => {
    e.preventDefault();
    for (let i = 0; i < e.changedTouches.length; i++) {
      if (e.changedTouches[i].identifier === joystickId.current) {
        joystickId.current = null;
        setJoystickOrigin(null);
        setKnobOffset({ x: 0, y: 0 });
        gsRef.current?.input.setMobileMovement(false, false, false, false);
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
      {/* Floating joystick — appears where you touch */}
      {joystickOrigin && (
        <div
          style={{
            ...styles.joystickBase,
            left: joystickOrigin.x - JOYSTICK_RADIUS,
            top: joystickOrigin.y - JOYSTICK_RADIUS,
          }}
        >
          <div
            style={{
              ...styles.joystickKnob,
              transform: `translate(calc(-50% + ${knobOffset.x}px), calc(-50% + ${knobOffset.y}px))`,
            }}
          />
        </div>
      )}

      {/* Dash button — bottom-right */}
      <div
        data-ctrl="dash"
        style={{
          ...styles.dashBtn,
          background: dashFlash
            ? "rgba(120,200,255,0.9)"
            : "rgba(30,70,170,0.65)",
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
    background: "rgba(180,120,255,0.12)",
    border: "2px solid rgba(180,120,255,0.4)",
    pointerEvents: "none",
  },
  joystickKnob: {
    position: "absolute",
    top: "50%",
    left: "50%",
    width: KNOB_RADIUS * 2,
    height: KNOB_RADIUS * 2,
    borderRadius: "50%",
    background: "rgba(210,160,255,0.75)",
    border: "2px solid rgba(230,200,255,0.85)",
    boxShadow: "0 0 14px rgba(180,100,255,0.6)",
    pointerEvents: "none",
  },
  dashBtn: {
    position: "absolute",
    bottom: 30,
    right: 30,
    width: 68,
    height: 68,
    borderRadius: 16,
    border: "2px solid rgba(100,170,255,0.6)",
    display: "flex",
    flexDirection: "column" as const,
    alignItems: "center",
    justifyContent: "center",
    gap: 2,
    pointerEvents: "auto",
    touchAction: "none",
    boxShadow: "0 0 18px rgba(60,130,255,0.4)",
  },
  dashIcon: {
    fontSize: 24,
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
