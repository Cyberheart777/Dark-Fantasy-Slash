/**
 * LabyrinthMobileControls.tsx
 * Touch-input for The Labyrinth.
 *
 * Layout:
 *   - Left half of screen: MOVEMENT joystick. First touch-down sets
 *     the anchor; drag sets the movement vector.
 *   - Right half: AIM joystick. Holds the player's attack direction
 *     while dragged. If not touched, the combat loop auto-aims at
 *     the nearest enemy in range (main-game-like auto-attack).
 *   - Dash button (↯) — small circle above-left of where the old
 *     attack button lived. Tap for a one-shot dash.
 *
 * Attack itself is auto-fire now (on cooldown, when a target is in
 * range). The old ⚔ button was removed; the right half of the screen
 * became the aim stick instead.
 */

import { useEffect, useRef, useState } from "react";
import type { InputManager3D } from "../InputManager3D";
import { useGameStore } from "../../store/gameStore";
import type { CharacterClass } from "../../data/CharacterData";

const ACTION_LABEL: Record<CharacterClass, string> = {
  warrior: "WAR CRY",
  mage: "BARRAGE",
  rogue: "KNIVES",
  necromancer: "ARMY",
  bard: "DISCORD",
  death_knight: "CHAINS",
};

const JOYSTICK_RADIUS = 56;
const KNOB_RADIUS = 24;
const DEAD_ZONE = 0.12;

// Dash button — same position as before so muscle memory carries.
const DASH_BUTTON_SIZE = 78;
const DASH_BUTTON_RIGHT = 180;
const DASH_BUTTON_BOTTOM = 80;
const DASH_HIT_PAD = 12;

// Action button — to the right of the dash button.
const ACTION_BUTTON_SIZE = 72;
const ACTION_BUTTON_RIGHT = 80;
const ACTION_BUTTON_BOTTOM = 80;
const ACTION_HIT_PAD = 12;

function checkMobile() {
  return "ontouchstart" in window || navigator.maxTouchPoints > 0 || window.innerWidth < 900;
}

function isDashTouch(cx: number, cy: number): boolean {
  const w = window.innerWidth;
  const h = window.innerHeight;
  const centerX = w - DASH_BUTTON_RIGHT - DASH_BUTTON_SIZE / 2;
  const centerY = h - DASH_BUTTON_BOTTOM - DASH_BUTTON_SIZE / 2;
  const dx = cx - centerX;
  const dy = cy - centerY;
  const r = DASH_BUTTON_SIZE / 2 + DASH_HIT_PAD;
  return dx * dx + dy * dy <= r * r;
}

function isActionTouch(cx: number, cy: number): boolean {
  const w = window.innerWidth;
  const h = window.innerHeight;
  const centerX = w - ACTION_BUTTON_RIGHT - ACTION_BUTTON_SIZE / 2;
  const centerY = h - ACTION_BUTTON_BOTTOM - ACTION_BUTTON_SIZE / 2;
  const dx = cx - centerX;
  const dy = cy - centerY;
  const r = ACTION_BUTTON_SIZE / 2 + ACTION_HIT_PAD;
  return dx * dx + dy * dy <= r * r;
}

/** Shared aim state mutated by the aim stick and read by the combat
 *  loop. Kept outside InputManager3D so we don't need to touch the
 *  main-game input module. */
export interface LabAimOverride {
  active: boolean;
  /** Radians in the same convention as LabPlayer.angle
   *  (atan2(worldDx, -worldDz)). */
  angle: number;
}

interface Props {
  inputRef: React.MutableRefObject<InputManager3D | null>;
  aimOverrideRef: React.MutableRefObject<LabAimOverride>;
}

interface StickState {
  anchorX: number; anchorY: number;
  knobX: number; knobY: number;
}

export function LabyrinthMobileControls({ inputRef, aimOverrideRef }: Props) {
  const [visible, setVisible] = useState(checkMobile);
  const actionReady = useGameStore((s) => s.actionReady);
  const actionCooldownTimer = useGameStore((s) => s.actionCooldownTimer);
  const selectedClass = useGameStore((s) => s.selectedClass);
  const [moveStick, setMoveStick] = useState<StickState | null>(null);
  const moveTouchId = useRef<number | null>(null);
  const [aimStick, setAimStick] = useState<StickState | null>(null);
  const aimTouchId = useRef<number | null>(null);
  const dashTouchId = useRef<number | null>(null);
  const [dashPressed, setDashPressed] = useState(false);
  const actionTouchId = useRef<number | null>(null);
  const [actionPressed, setActionPressed] = useState(false);

  useEffect(() => {
    const onResize = () => setVisible(checkMobile());
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  useEffect(() => {
    if (!visible) return;
    const input = inputRef.current;
    if (input) input.isMobile = true;
    return () => {
      inputRef.current?.setMobileMovement(false, false, false, false);
      aimOverrideRef.current.active = false;
    };
  }, [visible, inputRef, aimOverrideRef]);

  const onTouchStart = (e: React.TouchEvent) => {
    const half = window.innerWidth / 2;
    for (const t of Array.from(e.changedTouches)) {
      if (t.clientX <= half) {
        // Left half → movement joystick
        if (moveTouchId.current !== null) continue;
        moveTouchId.current = t.identifier;
        setMoveStick({
          anchorX: t.clientX, anchorY: t.clientY,
          knobX: t.clientX, knobY: t.clientY,
        });
        continue;
      }
      // Right half — action button, then dash button, then aim stick.
      if (isActionTouch(t.clientX, t.clientY)) {
        if (actionTouchId.current !== null) continue;
        actionTouchId.current = t.identifier;
        setActionPressed(true);
        inputRef.current?.triggerMobileAction();
        continue;
      }
      if (isDashTouch(t.clientX, t.clientY)) {
        if (dashTouchId.current !== null) continue;
        dashTouchId.current = t.identifier;
        setDashPressed(true);
        inputRef.current?.triggerMobileDash();
        continue;
      }
      if (aimTouchId.current !== null) continue;
      aimTouchId.current = t.identifier;
      setAimStick({
        anchorX: t.clientX, anchorY: t.clientY,
        knobX: t.clientX, knobY: t.clientY,
      });
      // Zero-mag at anchor → no aim yet, auto-aim takes over.
      aimOverrideRef.current.active = false;
    }
  };

  const onTouchMove = (e: React.TouchEvent) => {
    const input = inputRef.current;
    if (!input) return;
    for (const t of Array.from(e.changedTouches)) {
      if (t.identifier === moveTouchId.current) {
        setMoveStick((prev) => prev ? { ...prev, knobX: t.clientX, knobY: t.clientY } : prev);
        const ms = moveStick ?? { anchorX: t.clientX, anchorY: t.clientY, knobX: t.clientX, knobY: t.clientY };
        const dx = t.clientX - ms.anchorX;
        const dy = t.clientY - ms.anchorY;
        const mag = Math.sqrt(dx * dx + dy * dy);
        const norm = mag / JOYSTICK_RADIUS;
        if (norm < DEAD_ZONE) {
          input.setMobileMovement(false, false, false, false);
        } else {
          const nx = dx / mag;
          const ny = dy / mag;
          input.setMobileMovement(
            ny < -0.3,
            ny > 0.3,
            nx < -0.3,
            nx > 0.3,
          );
        }
        continue;
      }
      if (t.identifier === aimTouchId.current) {
        setAimStick((prev) => prev ? { ...prev, knobX: t.clientX, knobY: t.clientY } : prev);
        const as = aimStick ?? { anchorX: t.clientX, anchorY: t.clientY, knobX: t.clientX, knobY: t.clientY };
        const dx = t.clientX - as.anchorX;
        const dy = t.clientY - as.anchorY;
        const mag = Math.sqrt(dx * dx + dy * dy);
        const norm = mag / JOYSTICK_RADIUS;
        if (norm < DEAD_ZONE) {
          aimOverrideRef.current.active = false;
        } else {
          // Screen dy+ is world +z (camera looks down), screen dx+ is world +x.
          // Player-angle convention: atan2(worldX, -worldZ).
          const nx = dx / mag;
          const nz = dy / mag;
          aimOverrideRef.current.angle = Math.atan2(nx, -nz);
          aimOverrideRef.current.active = true;
        }
      }
    }
  };

  const onTouchEnd = (e: React.TouchEvent) => {
    for (const t of Array.from(e.changedTouches)) {
      if (t.identifier === moveTouchId.current) {
        moveTouchId.current = null;
        setMoveStick(null);
        inputRef.current?.setMobileMovement(false, false, false, false);
      }
      if (t.identifier === aimTouchId.current) {
        aimTouchId.current = null;
        setAimStick(null);
        aimOverrideRef.current.active = false;
      }
      if (t.identifier === dashTouchId.current) {
        dashTouchId.current = null;
        setDashPressed(false);
      }
      if (t.identifier === actionTouchId.current) {
        actionTouchId.current = null;
        setActionPressed(false);
      }
    }
  };

  if (!visible) return null;

  return (
    <div
      style={styles.zone}
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
      onTouchCancel={onTouchEnd}
    >
      {moveStick && (
        <>
          <div style={{
            ...styles.anchor,
            left: moveStick.anchorX - JOYSTICK_RADIUS,
            top: moveStick.anchorY - JOYSTICK_RADIUS,
          }} />
          <div style={{
            ...styles.knob,
            left: Math.max(
              moveStick.anchorX - JOYSTICK_RADIUS,
              Math.min(moveStick.anchorX + JOYSTICK_RADIUS, moveStick.knobX),
            ) - KNOB_RADIUS,
            top: Math.max(
              moveStick.anchorY - JOYSTICK_RADIUS,
              Math.min(moveStick.anchorY + JOYSTICK_RADIUS, moveStick.knobY),
            ) - KNOB_RADIUS,
          }} />
        </>
      )}
      {aimStick && (
        <>
          <div style={{
            ...styles.aimAnchor,
            left: aimStick.anchorX - JOYSTICK_RADIUS,
            top: aimStick.anchorY - JOYSTICK_RADIUS,
          }} />
          <div style={{
            ...styles.aimKnob,
            left: Math.max(
              aimStick.anchorX - JOYSTICK_RADIUS,
              Math.min(aimStick.anchorX + JOYSTICK_RADIUS, aimStick.knobX),
            ) - KNOB_RADIUS,
            top: Math.max(
              aimStick.anchorY - JOYSTICK_RADIUS,
              Math.min(aimStick.anchorY + JOYSTICK_RADIUS, aimStick.knobY),
            ) - KNOB_RADIUS,
          }} />
        </>
      )}
      {/* Dash button */}
      <div
        style={{
          ...styles.dashHint,
          background: dashPressed
            ? "rgba(150,210,255,0.55)"
            : "rgba(30,60,120,0.35)",
          borderColor: dashPressed
            ? "rgba(200,230,255,0.9)"
            : "rgba(110,180,240,0.55)",
          boxShadow: dashPressed
            ? "0 0 20px rgba(120,200,255,0.75)"
            : "0 0 10px rgba(70,140,220,0.4)",
        }}
      >
        ↯
      </div>
      {/* Action button */}
      <div
        style={{
          ...styles.actionHint,
          background: actionPressed
            ? "rgba(180,255,150,0.55)"
            : actionReady
              ? "rgba(60,140,50,0.5)"
              : "rgba(40,40,50,0.4)",
          borderColor: actionPressed
            ? "rgba(220,255,200,0.95)"
            : actionReady
              ? "rgba(140,240,120,0.8)"
              : "rgba(100,100,120,0.5)",
          boxShadow: actionReady
            ? "0 0 16px rgba(120,240,100,0.6)"
            : "none",
          color: actionReady ? "rgba(230,255,220,0.95)" : "rgba(200,200,220,0.6)",
        }}
      >
        {actionReady ? ACTION_LABEL[selectedClass] ?? "ACT" : `${Math.ceil(actionCooldownTimer)}s`}
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  zone: {
    position: "absolute",
    left: 0,
    top: 0,
    width: "100vw",
    height: "100vh",
    touchAction: "none",
    zIndex: 50,
  },
  dashHint: {
    position: "absolute",
    right: DASH_BUTTON_RIGHT,
    bottom: DASH_BUTTON_BOTTOM,
    width: DASH_BUTTON_SIZE,
    height: DASH_BUTTON_SIZE,
    borderRadius: "50%",
    border: "3px solid rgba(110,180,240,0.55)",
    background: "rgba(30,60,120,0.35)",
    color: "rgba(220,240,255,0.95)",
    fontSize: 40,
    fontWeight: "bold",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    pointerEvents: "none",
    transition: "background 0.1s, box-shadow 0.1s, border-color 0.1s",
  },
  actionHint: {
    position: "absolute",
    right: ACTION_BUTTON_RIGHT,
    bottom: ACTION_BUTTON_BOTTOM,
    width: ACTION_BUTTON_SIZE,
    height: ACTION_BUTTON_SIZE,
    borderRadius: "50%",
    border: "3px solid rgba(140,240,120,0.8)",
    background: "rgba(60,140,50,0.5)",
    color: "rgba(230,255,220,0.95)",
    fontSize: 12,
    fontWeight: 900,
    letterSpacing: 1,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    pointerEvents: "none",
    fontFamily: "monospace",
    transition: "background 0.1s, box-shadow 0.1s, border-color 0.1s",
  },
  anchor: {
    position: "absolute",
    width: JOYSTICK_RADIUS * 2,
    height: JOYSTICK_RADIUS * 2,
    borderRadius: "50%",
    border: "2px solid rgba(140,180,255,0.4)",
    background: "rgba(20,30,60,0.25)",
    pointerEvents: "none",
  },
  knob: {
    position: "absolute",
    width: KNOB_RADIUS * 2,
    height: KNOB_RADIUS * 2,
    borderRadius: "50%",
    background: "rgba(100,150,255,0.55)",
    border: "2px solid rgba(200,220,255,0.7)",
    pointerEvents: "none",
    boxShadow: "0 0 14px rgba(60,140,220,0.5)",
  },
  aimAnchor: {
    position: "absolute",
    width: JOYSTICK_RADIUS * 2,
    height: JOYSTICK_RADIUS * 2,
    borderRadius: "50%",
    border: "2px solid rgba(255,160,120,0.45)",
    background: "rgba(60,20,10,0.28)",
    pointerEvents: "none",
  },
  aimKnob: {
    position: "absolute",
    width: KNOB_RADIUS * 2,
    height: KNOB_RADIUS * 2,
    borderRadius: "50%",
    background: "rgba(255,140,90,0.6)",
    border: "2px solid rgba(255,210,180,0.8)",
    pointerEvents: "none",
    boxShadow: "0 0 14px rgba(220,110,60,0.55)",
  },
};
