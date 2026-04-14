/**
 * LabyrinthMobileControls.tsx
 * Minimal touch-input joystick for The Labyrinth (step 1).
 * Just movement — no aim/attack yet (no combat in step 1).
 *
 * Pattern: left-half of screen is the joystick zone. First touch down
 * sets the anchor; drag from anchor sets the movement vector. The
 * InputManager3D.setMobileMovement() method is called each frame on
 * drag.
 */

import { useEffect, useRef, useState } from "react";
import type { InputManager3D } from "../InputManager3D";

const JOYSTICK_RADIUS = 56;
const KNOB_RADIUS = 24;
const DEAD_ZONE = 0.12;

function checkMobile() {
  return "ontouchstart" in window || navigator.maxTouchPoints > 0 || window.innerWidth < 900;
}

interface Props {
  inputRef: React.MutableRefObject<InputManager3D | null>;
}

export function LabyrinthMobileControls({ inputRef }: Props) {
  const [visible, setVisible] = useState(checkMobile);
  const [moveStick, setMoveStick] = useState<{ anchorX: number; anchorY: number; knobX: number; knobY: number } | null>(null);
  const moveTouchId = useRef<number | null>(null);

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

  // Movement joystick — left half of screen
  const onTouchStart = (e: React.TouchEvent) => {
    if (moveTouchId.current !== null) return;
    const t = e.changedTouches[0];
    if (t.clientX > window.innerWidth / 2) return; // right side reserved for future aim stick
    moveTouchId.current = t.identifier;
    setMoveStick({
      anchorX: t.clientX,
      anchorY: t.clientY,
      knobX: t.clientX,
      knobY: t.clientY,
    });
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
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  zone: {
    position: "absolute",
    left: 0,
    top: 0,
    width: "50vw",
    height: "100vh",
    touchAction: "none",
    zIndex: 50,
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
