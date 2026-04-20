/**
 * DamagePopups3D.tsx
 * In-canvas floating damage/heal numbers anchored to world coordinates.
 * Reads the shared gameStore so any game mode can call addDamagePopup()
 * and get consistent popup rendering regardless of camera.
 */

import { Html } from "@react-three/drei";
import { useGameStore } from "../store/gameStore";
import { useMetaStore } from "../store/metaStore";

export function DamagePopups3D() {
  const damagePopups = useGameStore((s) => s.damagePopups);
  const settings = useMetaStore((s) => s.settings);

  return (
    <>
      {damagePopups.slice(-30).map((popup) => {
        const duration = popup.durationSec ?? 0.8;
        const age = (performance.now() - popup.spawnTime) / 1000;
        if (age > duration) return null;
        const isHealNumber = !!popup.text && popup.text.startsWith("+") && duration <= 0.8;
        if (!popup.text && !settings.damageNumbers) return null;
        if (isHealNumber && !settings.damageNumbers) return null;
        const isTextPopup = !!popup.text && !isHealNumber;
        const rise = isTextPopup ? age * 1.5 + 0.8 : age * 2.5;
        const opacity = Math.max(0, 1 - age / duration);
        const scale = isTextPopup ? 1.1 + Math.min(0.3, age * 2) : (popup.isCrit ? 1.3 : 1);
        const defaultColor = popup.isPlayer ? "#ff4444" : popup.isCrit ? "#ffcc00" : "#ffffff";
        const color = popup.color ?? defaultColor;
        const fontSize = isTextPopup ? 22 : isHealNumber ? 14 : popup.isCrit ? 18 : popup.isPlayer ? 16 : 14;
        const textShadow = isTextPopup
          ? `0 0 10px ${color}, 0 0 20px ${color}, 0 2px 4px #000`
          : isHealNumber
            ? `0 0 6px #22aa44, 0 0 12px #118833`
            : popup.isCrit
              ? "0 0 8px #ffaa00, 0 0 16px #ff6600"
              : popup.isPlayer
                ? "0 0 8px #ff0000"
                : "0 0 6px #000000, 0 0 3px #000000";

        return (
          <Html
            key={popup.id}
            position={[popup.x, 1.2 + rise, popup.z]}
            center
            style={{ pointerEvents: "none" }}
            zIndexRange={[40, 30]}
          >
            <div
              style={{
                color,
                fontSize,
                fontWeight: 900,
                fontFamily: "monospace",
                textShadow,
                opacity,
                whiteSpace: "nowrap",
                letterSpacing: isTextPopup ? 2 : 1,
                transform: `scale(${scale})`,
              }}
            >
              {popup.text ?? `${popup.isCrit ? "!" : ""}${popup.value}`}
            </div>
          </Html>
        );
      })}
    </>
  );
}
