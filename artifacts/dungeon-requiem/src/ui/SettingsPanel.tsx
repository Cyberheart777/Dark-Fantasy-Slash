/**
 * SettingsPanel.tsx
 * Shared settings UI used by both PauseMenu (in-game) and MainMenu (start
 * screen). Pure presentational — reads volume from gameStore, visual
 * toggles from metaStore, and exposes a single `onClose` prop for the
 * back button. No phase / view state inside this component.
 */

import { useGameStore } from "../store/gameStore";
import { useMetaStore } from "../store/metaStore";
import { audioManager } from "../audio/AudioManager";

interface SettingsPanelProps {
  onClose: () => void;
}

const click = (fn: () => void) => () => { audioManager.play("menu_click"); fn(); };

export function SettingsPanel({ onClose }: SettingsPanelProps) {
  const {
    masterVolume, sfxVolume, musicVolume, muted, setVolume,
  } = useGameStore();
  const settings = useMetaStore((s) => s.settings);
  const setSettings = useMetaStore((s) => s.setSettings);

  return (
    <>
      <div style={styles.wrapper}>
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

      <button style={styles.btnBack} onClick={click(onClose)}>
        ← BACK
      </button>
    </>
  );
}

// ─── Reusable controls ───────────────────────────────────────────────────────

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
  wrapper: {
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
};
