/**
 * MobileControls.tsx
 * On-screen virtual joystick + attack/aim zone + dash button.
 * Renders on touch devices or any screen narrower than 900px.
 * Writes into InputManager3D via setMobile* methods.
 */

import { useEffect, useRef, useState } from "react";
import type { GameState } from "../game/GameScene";

interface Props {
  gsRef: React.RefObject<GameState | null>;
}

const JOYSTICK_RADIUS = 52;
const KNOB_RADIUS = 22;
const DEAD_ZONE = 0.15;

function checkMobile() {
  return "ontouchstart" in window || navigator.maxTouchPoints > 0 || window.innerWidth < 900;
}

export function MobileControls({ gsRef }: Props) {
  const [visible, setVisible] = useState(checkMobile);

  useEffect(() => {
    const onResize = () => setVisible(checkMobile());
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  useEffect(() => {
    if (!visible) return;
    return () => {
      gsRef.current?.input.setMobileMovement(false, false, false, false);
      gsRef.current?.input.setMobileAttack(false);
    };
  }, [visible, gsRef]);

  const joystickBase = useRef<HTMLDivElement>(null);
  const joystickId = useRef<number | null>(null);
  const joystickOrigin = useRef({ x: 0, y: 0 });
  const [knobPos, setKnobPos] = useState({ x: 0, y: 0 });
  const [joystickDown, setJoystickDown] = useState(false);
  const [attackDown, setAttackDown] = useState(false);
  const [dashFlash, setDashFlash] = useState(false);
  const attackId = useRef<number | null>(null);

  if (!visible) return null;

  // ── Joystick ──────────────────────────────────────────────────────────────

  function onJoystickStart(e: React.TouchEvent) {
    e.preventDefault();
    const t = e.changedTouches[0];
    joystickId.current = t.identifier;
    const rect = joystickBase.current!.getBoundingClientRect();
    joystickOrigin.current = { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
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
    setKnobPos({ x: Math.cos(angle) * clamped, y: Math.sin(angle) * clamped });

    const t = clamped / JOYSTICK_RADIUS;
    if (t < DEAD_ZONE) {
      gsRef.current?.input.setMobileMovement(false, false, false, false);
      return;
    }
    const nx = dx / Math.max(dist, 1);
    const ny = dy / Math.max(dist, 1);
    gsRef.current?.input.setMobileMovement(ny < -0.4, ny > 0.4, nx < -0.4, nx > 0.4);
  }

  // ── Attack / Aim zone ─────────────────────────────────────────────────────

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
    gsRef.current?.input.setMobileAim(
      (cx / window.innerWidth) * 2 - 1,
      -(cy / window.innerHeight) * 2 + 1,
    );
  }

  // ── Dash ─────────────────────────────────────────────────────────────────

  function onDash(e: React.TouchEvent) {
    e.preventDefault();
    e.stopPropagation();
    gsRef.current?.input.triggerMobileDash();
    setDashFlash(true);
    setTimeout(() => setDashFlash(false), 200);
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div style={styles.wrapper}>
      {/* Left — joystick */}
      <div
        ref={joystickBase}
        style={{ ...styles.joystickBase, opacity: joystickDown ? 0.92 : 0.6 }}
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

      {/* Right — attack/aim zone */}
      <div
        style={{
          ...styles.attackZone,
          background: attackDown ? "rgba(255,60,60,0.1)" : "transparent",
        }}
        onTouchStart={onAttackStart}
        onTouchMove={onAttackMove}
        onTouchEnd={onAttackEnd}
        onTouchCancel={onAttackEnd}
      >
        {!attackDown && (
          <div style={styles.attackHint}>HOLD<br />ATTACK</div>
        )}

        {/* Dash button */}
        <div
          style={{
            ...styles.dashBtn,
            background: dashFlash
              ? "rgba(120,200,255,0.9)"
              : "rgba(30,70,170,0.75)",
          }}
          onTouchStart={onDash}
        >
          <span style={styles.dashIcon}>⚡</span>
          <span style={styles.dashLabel}>DASH</span>
        </div>
      </div>
    </div>
  );
}

const JR = JOYSTICK_RADIUS;
const KR = KNOB_RADIUS;

const styles: Record<string, React.CSSProperties> = {
  wrapper: {
    position: "absolute",
    inset: 0,
    pointerEvents: "none",
    userSelect: "none",
    WebkitUserSelect: "none",
    touchAction: "none",
  },
  joystickBase: {
    position: "absolute",
    bottom: 36,
    left: 36,
    width: JR * 2,
    height: JR * 2,
    borderRadius: "50%",
    background: "rgba(180,120,255,0.15)",
    border: "2px solid rgba(180,120,255,0.55)",
    pointerEvents: "auto",
    touchAction: "none",
    transition: "opacity 0.15s",
  },
  joystickKnob: {
    position: "absolute",
    top: "50%",
    left: "50%",
    width: KR * 2,
    height: KR * 2,
    borderRadius: "50%",
    background: "rgba(210,160,255,0.8)",
    border: "2px solid rgba(230,200,255,0.9)",
    boxShadow: "0 0 12px rgba(180,100,255,0.7)",
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
    transition: "background 0.08s",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
  attackHint: {
    color: "rgba(255,100,100,0.2)",
    fontSize: 10,
    fontWeight: "bold",
    letterSpacing: 2,
    textAlign: "center",
    lineHeight: 1.6,
    pointerEvents: "none",
    fontFamily: "inherit",
  },
  dashBtn: {
    position: "absolute",
    bottom: 36,
    right: 36,
    width: 62,
    height: 62,
    borderRadius: 14,
    border: "2px solid rgba(100,170,255,0.7)",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    gap: 2,
    pointerEvents: "auto",
    touchAction: "none",
    transition: "background 0.1s",
    boxShadow: "0 0 16px rgba(60,130,255,0.45)",
  },
  dashIcon: {
    fontSize: 22,
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
