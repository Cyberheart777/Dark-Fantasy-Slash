/**
 * LabyrinthMobileControls.tsx
 * Touch-input for The Labyrinth.
 *
 * Layout:
 *   - Left half of screen: movement joystick. First touch-down sets
 *     the anchor; drag from anchor sets the movement vector.
 *   - Right half: attack-or-dash. A tap inside the small "↯" dash
 *     button (above-left of the ⚔ attack button) triggers a one-shot
 *     dash via InputManager3D.triggerMobileDash. A tap anywhere else
 *     on the right half triggers an attack swing via setMobileAttack.
 *     Multi-touch is fully supported: the player can hold the joystick
 *     with one thumb and tap dash/attack with the other.
 */

import { useEffect, useRef, useState } from "react";
import type { InputManager3D } from "../InputManager3D";

const JOYSTICK_RADIUS = 56;
const KNOB_RADIUS = 24;
const DEAD_ZONE = 0.12;

// Dash button geometry — small circle above-left of the attack button.
// Kept in module scope so hit-testing code and the rendered hint share
// the same numbers. Coordinates are computed from the window dimensions
// at touch time so the button stays consistent across orientations.
const DASH_BUTTON_SIZE = 78;
const DASH_BUTTON_RIGHT = 180;   // px from right edge to button's right edge
const DASH_BUTTON_BOTTOM = 168;  // px from bottom edge to button's bottom edge
const DASH_HIT_PAD = 12;         // extra hit-area slack around the visual

function checkMobile() {
  return "ontouchstart" in window || navigator.maxTouchPoints > 0 || window.innerWidth < 900;
}

/** Hit-test whether a touch at (cx, cy) lands inside the dash button.
 *  The button is positioned relative to the bottom-right corner of the
 *  viewport; we compute its center each call so rotation / resize don't
 *  desync the hit area from the visual. */
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

interface Props {
  inputRef: React.MutableRefObject<InputManager3D | null>;
}

export function LabyrinthMobileControls({ inputRef }: Props) {
  const [visible, setVisible] = useState(checkMobile);
  const [moveStick, setMoveStick] = useState<{ anchorX: number; anchorY: number; knobX: number; knobY: number } | null>(null);
  const moveTouchId = useRef<number | null>(null);
  // Separate touch id for the attack button so it works concurrently
  // with the movement joystick (common two-thumb play pattern).
  const attackTouchId = useRef<number | null>(null);
  const [attackPressed, setAttackPressed] = useState(false);
  // Separate touch id for dash so the player can press dash while also
  // holding the joystick with the other thumb.
  const dashTouchId = useRef<number | null>(null);
  const [dashPressed, setDashPressed] = useState(false);

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
    };
  }, [visible, inputRef]);

  // Dispatches each new touch to the joystick (left half), the dash
  // button (small circle above-left of the attack button), or attack
  // (the rest of the right half). The dash hit-test happens BEFORE the
  // attack fallback so taps on the dash button don't also register as
  // attacks — overlap would both dash and attack on the same tap.
  const onTouchStart = (e: React.TouchEvent) => {
    const half = window.innerWidth / 2;
    for (const t of Array.from(e.changedTouches)) {
      if (t.clientX <= half) {
        if (moveTouchId.current !== null) continue;
        moveTouchId.current = t.identifier;
        setMoveStick({
          anchorX: t.clientX,
          anchorY: t.clientY,
          knobX: t.clientX,
          knobY: t.clientY,
        });
        continue;
      }
      // Right half — check the dash button first.
      if (isDashTouch(t.clientX, t.clientY)) {
        if (dashTouchId.current !== null) continue;
        dashTouchId.current = t.identifier;
        setDashPressed(true);
        inputRef.current?.triggerMobileDash();
        continue;
      }
      // Otherwise — attack.
      if (attackTouchId.current !== null) continue;
      attackTouchId.current = t.identifier;
      setAttackPressed(true);
      inputRef.current?.setMobileAttack(true);
    }
  };

  const onTouchMove = (e: React.TouchEvent) => {
    const input = inputRef.current;
    if (!input) return;
    for (const t of Array.from(e.changedTouches)) {
      if (t.identifier !== moveTouchId.current) continue;
      setMoveStick((prev) => prev ? { ...prev, knobX: t.clientX, knobY: t.clientY } : prev);

      // Convert drag to directional input
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
          ny < -0.3,  // up
          ny >  0.3,  // down
          nx < -0.3,  // left
          nx >  0.3,  // right
        );
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
      if (t.identifier === attackTouchId.current) {
        attackTouchId.current = null;
        setAttackPressed(false);
        inputRef.current?.setMobileAttack(false);
      }
      if (t.identifier === dashTouchId.current) {
        // Dash is a one-shot — triggerMobileDash already set the latched
        // bit; releasing the finger just clears our visual highlight.
        dashTouchId.current = null;
        setDashPressed(false);
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
      {/* Attack button hint — fixed position on the bottom-right. Taps
          anywhere on the right half (except inside the dash button's hit
          circle) register as attack, so the exact position of this circle
          isn't a hit target — it's a visual cue for where to thumb. */}
      <div
        style={{
          ...styles.attackHint,
          background: attackPressed
            ? "rgba(255,180,120,0.55)"
            : "rgba(140,60,30,0.35)",
          borderColor: attackPressed
            ? "rgba(255,220,160,0.9)"
            : "rgba(220,140,100,0.55)",
          boxShadow: attackPressed
            ? "0 0 22px rgba(255,180,100,0.7)"
            : "0 0 10px rgba(220,110,60,0.4)",
        }}
      >
        ⚔
      </div>
      {/* Dash button — small circle above-left of the attack button. This
          IS a hit-target (isDashTouch gates it). Pressed-state style
          matches the attack button's color language so both read as
          "action buttons". */}
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
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  zone: {
    // Covers the full screen so right-half taps register as attacks.
    // The joystick/attack split is handled by touch coords, not by
    // DOM hit-testing.
    position: "absolute",
    left: 0,
    top: 0,
    width: "100vw",
    height: "100vh",
    touchAction: "none",
    zIndex: 50,
  },
  attackHint: {
    position: "absolute",
    right: 36,
    bottom: 48,
    width: 110,
    height: 110,
    borderRadius: "50%",
    border: "3px solid rgba(220,140,100,0.55)",
    background: "rgba(140,60,30,0.35)",
    color: "rgba(255,220,160,0.95)",
    fontSize: 52,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    pointerEvents: "none",
    transition: "background 0.1s, box-shadow 0.1s, border-color 0.1s",
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
};
