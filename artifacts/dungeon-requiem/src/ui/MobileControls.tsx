/**
 * MobileControls.tsx
 * On-screen virtual joystick + attack/aim zone + dash button.
 * Only renders on touch devices. Writes into InputManager3D via setMobile* methods.
 */

import { useEffect, useRef, useState } from "react";
import type { GameState } from "../game/GameScene";

interface Props {
  gsRef: React.RefObject<GameState | null>;
}

const JOYSTICK_RADIUS = 56;
const KNOB_RADIUS = 24;
const DEAD_ZONE = 0.15;

function isTouchDevice() {
  return "ontouchstart" in window || navigator.maxTouchPoints > 0;
}

export function MobileControls({ gsRef }: Props) {
  const [visible] = useState(isTouchDevice);
  const joystickBase = useRef<HTMLDivElement>(null);
  const joystickActive = useRef(false);
  const joystickId = useRef<number | null>(null);
  const joystickOrigin = useRef({ x: 0, y: 0 });
  const [knobPos, setKnobPos] = useState({ x: 0, y: 0 });
  const [joystickDown, setJoystickDown] = useState(false);
  const [attackDown, setAttackDown] = useState(false);
  const [dashFlash, setDashFlash] = useState(false);
  const attackId = useRef<number | null>(null);

  useEffect(() => {
    if (!visible) return;
    return () => {
      gsRef.current?.input.setMobileMovement(false, false, false, false);
      gsRef.current?.input.setMobileAttack(false);
    };
  }, [visible, gsRef]);

  if (!visible) return null;

  // ── Joystick handlers ────────────────────────────────────────────────────

  function onJoystickStart(e: React.TouchEvent) {
    e.preventDefault();
    const t = e.changedTouches[0];
    joystickId.current = t.identifier;
    const rect = joystickBase.current!.getBoundingClientRect();
    joystickOrigin.current = {
      x: rect.left + rect.width / 2,
      y: rect.top + rect.height / 2,
    };
    joystickActive.current = true;
    setJoystickDown(true);
    updateJoystick(t.clientX, t.clientY);
  }

  function onJoystickMove(e: React.TouchEvent) {
    e.preventDefault();
    for (let i = 0; i < e.changedTouches.length; i++) {
      if (e.changedTouches[i].identifier === joystickId.current) {
        updateJoystick(e.changedTouches[i].clientX, e.changedTouches[i].clientY);
      }
    }
  }

  function onJoystickEnd(e: React.TouchEvent) {
    e.preventDefault();
    for (let i = 0; i < e.changedTouches.length; i++) {
      if (e.changedTouches[i].identifier === joystickId.current) {
        joystickActive.current = false;
        joystickId.current = null;
        setJoystickDown(false);
        setKnobPos({ x: 0, y: 0 });
        gsRef.current?.input.setMobileMovement(false, false, false, false);
      }
    }
  }

  function updateJoystick(cx: number, cy: number) {
    const ox = joystickOrigin.current.x;
    const oy = joystickOrigin.current.y;
    const dx = cx - ox;
    const dy = cy - oy;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const clamped = Math.min(dist, JOYSTICK_RADIUS);
    const angle = Math.atan2(dy, dx);
    const kx = Math.cos(angle) * clamped;
    const ky = Math.sin(angle) * clamped;
    setKnobPos({ x: kx, y: ky });

    const nx = dx / Math.max(dist, 1);
    const ny = dy / Math.max(dist, 1);
    const t = clamped / JOYSTICK_RADIUS;
    if (t < DEAD_ZONE) {
      gsRef.current?.input.setMobileMovement(false, false, false, false);
      return;
    }
    const up    = ny < -0.4;
    const down  = ny >  0.4;
    const left  = nx < -0.4;
    const right = nx >  0.4;
    gsRef.current?.input.setMobileMovement(up, down, left, right);
  }

  // ── Attack/aim zone handlers ─────────────────────────────────────────────

  function onAttackStart(e: React.TouchEvent) {
    e.preventDefault();
    const t = e.changedTouches[0];
    attackId.current = t.identifier;
    setAttackDown(true);
    updateAim(t.clientX, t.clientY);
    gsRef.current?.input.setMobileAttack(true);
  }

  function onAttackMove(e: React.TouchEvent) {
    e.preventDefault();
    for (let i = 0; i < e.changedTouches.length; i++) {
      if (e.changedTouches[i].identifier === attackId.current) {
        updateAim(e.changedTouches[i].clientX, e.changedTouches[i].clientY);
      }
    }
  }

  function onAttackEnd(e: React.TouchEvent) {
    e.preventDefault();
    for (let i = 0; i < e.changedTouches.length; i++) {
      if (e.changedTouches[i].identifier === attackId.current) {
        attackId.current = null;
        setAttackDown(false);
        gsRef.current?.input.setMobileAttack(false);
      }
    }
  }

  function updateAim(cx: number, cy: number) {
    const mx = (cx / window.innerWidth) * 2 - 1;
    const my = -(cy / window.innerHeight) * 2 + 1;
    gsRef.current?.input.setMobileAim(mx, my);
  }

  // ── Dash handler ─────────────────────────────────────────────────────────

  function onDash(e: React.TouchEvent) {
    e.preventDefault();
    e.stopPropagation();
    gsRef.current?.input.triggerMobileDash();
    setDashFlash(true);
    setTimeout(() => setDashFlash(false), 200);
  }

  // ── Render ───────────────────────────────────────────────────────────────

  return (
    <div style={styles.wrapper}>
      {/* Left side — joystick */}
      <div
        ref={joystickBase}
        style={{ ...styles.joystickBase, opacity: joystickDown ? 0.9 : 0.55 }}
        onTouchStart={onJoystickStart}
        onTouchMove={onJoystickMove}
        onTouchEnd={onJoystickEnd}
        onTouchCancel={onJoystickEnd}
      >
        <div
          style={{
            ...styles.joystickKnob,
            transform: `translate(calc(-50% + ${knobPos.x}px), calc(-50% + ${knobPos.y}px))`,
          }}
        />
      </div>

      {/* Right side — attack / aim zone */}
      <div
        style={{ ...styles.attackZone, background: attackDown ? "rgba(255,60,60,0.12)" : "transparent" }}
        onTouchStart={onAttackStart}
        onTouchMove={onAttackMove}
        onTouchEnd={onAttackEnd}
        onTouchCancel={onAttackEnd}
      >
        <div style={styles.attackHint}>HOLD TO<br />ATTACK</div>

        {/* Dash button sits inside the attack zone, bottom-right corner */}
        <div
          style={{ ...styles.dashBtn, background: dashFlash ? "rgba(80,160,255,0.85)" : "rgba(40,80,180,0.65)" }}
          onTouchStart={onDash}
        >
          <span style={styles.dashIcon}>⚡</span>
          <span style={styles.dashLabel}>DASH</span>
        </div>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  wrapper: {
    position: "absolute",
    inset: 0,
    pointerEvents: "none",
    display: "flex",
    userSelect: "none",
    touchAction: "none",
  },
  joystickBase: {
    position: "absolute",
    bottom: 36,
    left: 36,
    width: JOYSTICK_RADIUS * 2,
    height: JOYSTICK_RADIUS * 2,
    borderRadius: "50%",
    background: "rgba(180,120,255,0.18)",
    border: "2px solid rgba(180,120,255,0.6)",
    pointerEvents: "auto",
    touchAction: "none",
    transition: "opacity 0.15s",
  },
  joystickKnob: {
    position: "absolute",
    top: "50%",
    left: "50%",
    width: KNOB_RADIUS * 2,
    height: KNOB_RADIUS * 2,
    borderRadius: "50%",
    background: "rgba(200,150,255,0.75)",
    border: "2px solid rgba(220,180,255,0.9)",
    boxShadow: "0 0 10px rgba(180,100,255,0.6)",
    pointerEvents: "none",
    transition: "transform 0.04s",
  },
  attackZone: {
    position: "absolute",
    top: 0,
    right: 0,
    width: "55%",
    height: "100%",
    pointerEvents: "auto",
    touchAction: "none",
    transition: "background 0.1s",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: "0 0 0 80px",
  },
  attackHint: {
    color: "rgba(255,100,100,0.25)",
    fontSize: 11,
    fontWeight: "bold",
    letterSpacing: 2,
    textAlign: "center",
    lineHeight: 1.4,
    pointerEvents: "none",
    fontFamily: "inherit",
  },
  dashBtn: {
    position: "absolute",
    bottom: 36,
    right: 36,
    width: 64,
    height: 64,
    borderRadius: 16,
    border: "2px solid rgba(100,160,255,0.7)",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    gap: 2,
    pointerEvents: "auto",
    touchAction: "none",
    transition: "background 0.1s",
    boxShadow: "0 0 14px rgba(60,120,255,0.5)",
  },
  dashIcon: {
    fontSize: 20,
    lineHeight: 1,
  },
  dashLabel: {
    fontSize: 9,
    fontWeight: "bold",
    letterSpacing: 1.5,
    color: "#aad4ff",
    fontFamily: "inherit",
  },
};
