/**
 * PauseMenu.tsx
 * Pause overlay with resume, extract, quit, and a collapsible settings panel
 * (volume sliders, screen shake toggle, damage numbers toggle, keybindings).
 */

import { useState } from "react";
import { useGameStore } from "../store/gameStore";
import { useMetaStore } from "../store/metaStore";
import { audioManager } from "../audio/AudioManager";

const click = (fn: () => void) => () => { audioManager.play("menu_click"); fn(); };

interface PauseMenuProps {
  onExtract?: () => void;
}

export function PauseMenu({ onExtract }: PauseMenuProps) {
  const {
    setPhase, highestBossWaveCleared, trialMode,
    masterVolume, sfxVolume, musicVolume, muted, setVolume,
  } = useGameStore();
  const settings = useMetaStore((s) => s.settings);
  const setSettings = useMetaStore((s) => s.setSettings);

  const [showSettings, setShowSettings] = useState(false);

  const showExtract = !trialMode && highestBossWaveCleared > 0 && onExtract != null;
  const extractLabel =
    highestBossWaveCleared >= 20 ? "100%" :
    highestBossWaveCleared >= 15 ? "75%" :
    highestBossWaveCleared >= 10 ? "50%" :
    "25%";

  const handleMainMenu = () => {
    const s = useGameStore.getState();
    const prevBest = s.bestScore;
    const prevWave = s.bestWave;
    s.resetGame();
    s.setBestScore(prevBest, prevWave);
    s.setPhase("menu");
  };

  return (
    <div style={styles.overlay}>
      <div style={styles.panel}>
        <div style={styles.title}>PAUSED</div>
        <div style={styles.sub}>The dungeon holds its breath...</div>

        <div style={styles.divider} />

        {!showSettings ? (
          <>
            <div style={styles.btnCol}>
              <button style={styles.btnPrimary} onClick={click(() => setPhase("playing"))}>
                ▶ RESUME
              </button>

              {showExtract && (
                <button style={styles.btnExtract} onClick={click(() => onExtract?.())}>
                  ↑ EXTRACT RUN — Keep {extractLabel} of shards
                </button>
              )}

              <button style={styles.btnSettings} onClick={click(() => setShowSettings(true))}>
                ⚙ SETTINGS
              </button>

              <button style={styles.btnSecondary} onClick={click(handleMainMenu)}>
                ⌂ MAIN MENU
              </button>
            </div>

            <div style={styles.controls}>
              <span style={{ color: "rgba(180,160,200,0.4)" }}>Press ESC to resume</span>
            </div>
          </>
        ) : (
          <>
            <div style={styles.settingsWrapper}>
              {/* ── Audio ─────────────────────────────────────────────── */}
              <div style={styles.sectionTitle}>AUDIO</div>

              <Slider
                label="Master"
                value={masterVolume}
                onChange={(v) => setVolume(v, sfxVolume, musicVolume, muted)}
                disabled={muted}
              />
              <Slider
                label="SFX"
                value={sfxVolume}
                onChange={(v) => setVolume(masterVolume, v, musicVolume, muted)}
                disabled={muted}
              />
              <Slider
                label="Music"
                value={musicVolume}
                onChange={(v) => setVolume(masterVolume, sfxVolume, v, muted)}
                disabled={muted}
              />
              <Toggle
                label="Mute all audio"
                value={muted}
                onChange={(v) => setVolume(masterVolume, sfxVolume, musicVolume, v)}
              />

              {/* ── Visual ─────────────────────────────────────────────── */}
              <div style={styles.sectionTitle}>VISUAL</div>

              <Toggle
                label="Screen shake"
                value={settings.screenShake}
                onChange={(v) => setSettings({ screenShake: v })}
              />
              <Toggle
                label="Damage numbers"
                value={settings.damageNumbers}
                onChange={(v) => setSettings({ damageNumbers: v })}
              />

              {/* ── Controls reference ─────────────────────────────────── */}
              <div style={styles.sectionTitle}>CONTROLS</div>
              <div style={styles.keybindGrid}>
                <span style={styles.kbKey}>W A S D</span>
                <span style={styles.kbLabel}>Move</span>
                <span style={styles.kbKey}>Mouse</span>
                <span style={styles.kbLabel}>Aim — auto-attacks</span>
                <span style={styles.kbKey}>Shift</span>
                <span style={styles.kbLabel}>Dash (invincible)</span>
                <span style={styles.kbKey}>ESC</span>
                <span style={styles.kbLabel}>Pause</span>
              </div>
            </div>

            <button style={styles.btnBack} onClick={click(() => setShowSettings(false))}>
              ← BACK
            </button>
          </>
        )}
      </div>
    </div>
  );
}

// ─── Small reusable settings controls ────────────────────────────────────────

function Slider({ label, value, onChange, disabled }: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  disabled?: boolean;
}) {
  return (
    <div style={{ ...styles.row, opacity: disabled ? 0.4 : 1 }}>
      <span style={styles.rowLabel}>{label}</span>
      <input
        type="range"
        min={0}
        max={1}
        step={0.05}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        disabled={disabled}
        style={styles.slider}
      />
      <span style={styles.rowValue}>{Math.round(value * 100)}</span>
    </div>
  );
}

function Toggle({ label, value, onChange }: {
  label: string;
  value: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div style={styles.row}>
      <span style={styles.rowLabel}>{label}</span>
      <button
        style={{
          ...styles.toggleBtn,
          background: value ? "linear-gradient(135deg, #5500aa, #3a0077)" : "rgba(30,15,45,0.8)",
          borderColor: value ? "#8844cc" : "#3a2050",
          color: value ? "#e8d0ff" : "#6a5080",
        }}
        onClick={() => { audioManager.play("menu_click"); onChange(!value); }}
      >
        {value ? "ON" : "OFF"}
      </button>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  overlay: {
    position: "absolute",
    inset: 0,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    background: "rgba(0,0,0,0.75)",
    backdropFilter: "blur(8px)",
    fontFamily: "'Segoe UI', monospace",
    zIndex: 100,
  },
  panel: {
    textAlign: "center",
    padding: "48px 64px",
    background: "rgba(6,3,12,0.97)",
    border: "1px solid rgba(80,50,120,0.5)",
    borderRadius: 16,
    boxShadow: "0 0 40px rgba(60,0,120,0.25)",
    minWidth: 360,
    maxWidth: 440,
  },
  title: {
    fontSize: 52,
    fontWeight: "900",
    color: "#aa88cc",
    letterSpacing: 10,
    textShadow: "0 0 20px #6600aa",
    marginBottom: 8,
  },
  sub: {
    color: "rgba(180,160,200,0.5)",
    fontSize: 14,
    fontStyle: "italic",
    letterSpacing: 1,
  },
  divider: {
    height: 1,
    background: "linear-gradient(to right, transparent, rgba(80,50,120,0.5), transparent)",
    margin: "28px 0",
  },
  btnCol: {
    display: "flex",
    flexDirection: "column",
    gap: 12,
    alignItems: "center",
  },
  btnPrimary: {
    width: 260,
    padding: "14px",
    fontSize: 16,
    fontWeight: "bold",
    letterSpacing: 3,
    color: "#fff",
    background: "linear-gradient(135deg, #5500aa, #3a0077)",
    border: "1px solid #7700cc",
    borderRadius: 8,
    cursor: "pointer",
    fontFamily: "inherit",
    boxShadow: "0 0 20px rgba(80,0,180,0.4)",
  },
  btnExtract: {
    width: 260,
    padding: "13px",
    fontSize: 13,
    fontWeight: "bold",
    letterSpacing: 1,
    color: "#88ffcc",
    background: "rgba(10,50,30,0.85)",
    border: "1px solid rgba(40,180,90,0.6)",
    borderRadius: 8,
    cursor: "pointer",
    fontFamily: "inherit",
    boxShadow: "0 0 14px rgba(0,160,70,0.25)",
  },
  btnSettings: {
    width: 260,
    padding: "12px",
    fontSize: 14,
    fontWeight: "bold",
    letterSpacing: 2,
    color: "#c0a0e0",
    background: "rgba(40,20,70,0.7)",
    border: "1px solid rgba(120,60,160,0.5)",
    borderRadius: 8,
    cursor: "pointer",
    fontFamily: "inherit",
  },
  btnSecondary: {
    width: 260,
    padding: "12px",
    fontSize: 15,
    fontWeight: "bold",
    letterSpacing: 2,
    color: "#bbb",
    background: "rgba(30,15,45,0.8)",
    border: "1px solid rgba(80,50,120,0.4)",
    borderRadius: 8,
    cursor: "pointer",
    fontFamily: "inherit",
  },
  btnBack: {
    marginTop: 20,
    width: 260,
    padding: "11px",
    fontSize: 14,
    fontWeight: "bold",
    letterSpacing: 2,
    color: "#bbb",
    background: "rgba(30,15,45,0.8)",
    border: "1px solid rgba(80,50,120,0.4)",
    borderRadius: 8,
    cursor: "pointer",
    fontFamily: "inherit",
  },
  controls: {
    marginTop: 24,
    fontSize: 12,
  },
  settingsWrapper: {
    textAlign: "left" as const,
    maxHeight: "60vh",
    overflowY: "auto" as const,
    paddingRight: 8,
  },
  sectionTitle: {
    color: "rgba(200,160,230,0.6)",
    fontSize: 10,
    letterSpacing: 3,
    fontWeight: 900,
    marginTop: 18,
    marginBottom: 10,
    borderBottom: "1px solid rgba(80,50,120,0.3)",
    paddingBottom: 4,
  },
  row: {
    display: "flex",
    alignItems: "center",
    gap: 12,
    marginBottom: 10,
  },
  rowLabel: {
    flex: "0 0 110px",
    color: "rgba(200,180,220,0.85)",
    fontSize: 12,
    letterSpacing: 0.5,
  },
  rowValue: {
    flex: "0 0 32px",
    color: "rgba(180,140,220,0.85)",
    fontSize: 11,
    textAlign: "right" as const,
    fontFamily: "monospace",
  },
  slider: {
    flex: 1,
    accentColor: "#8844cc",
    cursor: "pointer",
  },
  toggleBtn: {
    flex: "0 0 60px",
    padding: "6px 10px",
    fontSize: 11,
    fontWeight: 900,
    letterSpacing: 1.5,
    border: "1px solid",
    borderRadius: 5,
    cursor: "pointer",
    fontFamily: "inherit",
  },
  keybindGrid: {
    display: "grid",
    gridTemplateColumns: "auto 1fr",
    gap: "8px 14px",
    alignItems: "center",
    marginTop: 4,
  },
  kbKey: {
    background: "rgba(255,255,255,0.06)",
    border: "1px solid rgba(255,255,255,0.12)",
    borderRadius: 4,
    padding: "3px 8px",
    fontSize: 11,
    color: "#ddd",
    fontWeight: "bold" as const,
    whiteSpace: "nowrap" as const,
    textAlign: "center" as const,
  },
  kbLabel: {
    color: "rgba(200,180,220,0.8)",
    fontSize: 12,
  },
};
