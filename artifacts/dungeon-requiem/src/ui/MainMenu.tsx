/**
 * MainMenu.tsx
 * Dark fantasy main menu overlay.
 */

import { useEffect, useState } from "react";
import { useGameStore } from "../store/gameStore";
import { useMetaStore } from "../store/metaStore";
import { audioManager } from "../audio/AudioManager";
import { SettingsPanel } from "./SettingsPanel";

/** Play the UI click SFX and invoke the given handler. */
const click = (fn: () => void) => () => { audioManager.play("menu_click"); fn(); };

/**
 * Displayed version. Bump per release — this line is the single source of
 * truth for the version tag shown in the main menu and (eventually) the
 * game-over screen. Format: MAJOR.MINOR.PATCH.
 */
const GAME_VERSION = "v0.1.0";

/**
 * Main menu background artwork. Lives at public/images/main-menu-bg.png.
 * Vite's BASE_URL suffix resolves correctly under the GitHub Pages subpath.
 * If the file is ever missing, the CSS `background:` shorthand in
 * styles.overlay falls through to the purple radial gradient fallback so
 * nothing breaks visually.
 */
const MENU_BG_URL = `${import.meta.env.BASE_URL}images/main-menu-bg.png`;

function useIsMobile() {
  const [mob, setMob] = useState(() => window.innerWidth < 900);
  useEffect(() => {
    const fn = () => setMob(window.innerWidth < 900);
    window.addEventListener("resize", fn);
    return () => window.removeEventListener("resize", fn);
  }, []);
  return mob;
}

type MenuView = "main" | "settings";

export function MainMenu() {
  const isMobile = useIsMobile();
  const { setPhase, setTrialMode, bestScore, bestWave } = useGameStore();
  const { shards, milestones, trialWins } = useMetaStore();

  const bossKilled = milestones["boss_kill"] ?? false;
  const anyTrialWin = Object.values(trialWins).some(Boolean);
  const [view, setView] = useState<MenuView>("main");

  const handleTrial = () => {
    setTrialMode(true);
    setPhase("charselect");
  };

  return (
    <div style={styles.overlay}>
      <div style={styles.vignette} />

      <div style={styles.panel}>
        <div style={styles.eaBadge}>
          <span style={styles.eaDot} />
          EARLY ACCESS · {GAME_VERSION}
        </div>

        <div style={styles.titleWrapper}>
          <div style={styles.titleGlow}>DUNGEON</div>
          <div style={styles.titleMain}>DUNGEON</div>
          <div style={styles.subtitleGlow}>REQUIEM</div>
          <div style={styles.subtitle}>REQUIEM</div>
        </div>

        <div style={styles.pitch}>
          Dark fantasy roguelike — slay, die, return stronger.
        </div>
        <div style={styles.tagline}>The world did not end in fire… it rotted.</div>

        <div style={styles.divider} />

        {view === "main" && (
          <>
            <button style={styles.btnPrimary} onClick={click(() => { setTrialMode(false); setPhase("charselect"); })}>
              ⚔ BEGIN DESCENT
            </button>

            {bossKilled ? (
              <button style={styles.btnTrial} onClick={click(handleTrial)}>
                <span style={{ color: "#ffd700", fontSize: 16 }}>🏆</span>
                {" "}TRIAL OF CHAMPIONS
                {anyTrialWin && <span style={{ color: "#aa8000", fontSize: 11 }}> · {Object.values(trialWins).filter(Boolean).length}/3 cleared</span>}
              </button>
            ) : (
              <div style={styles.trialLocked}>
                <span style={{ color: "#4a3030" }}>🔒</span>
                {" "}TRIAL OF CHAMPIONS
                <div style={styles.trialLockNote}>Defeat The Warden to unlock</div>
              </div>
            )}

            <button style={styles.btnForge} onClick={click(() => setPhase("soulforge"))}>
              <span style={styles.forgeShard}>◈</span>
              {" "}SOUL FORGE
              {shards > 0 && (
                <span style={styles.forgeShardCount}> · {shards.toLocaleString()} shards</span>
              )}
            </button>

            <button style={styles.btnSettings} onClick={click(() => setView("settings"))}>
              ⚙ SETTINGS
            </button>

            {bestScore > 0 && (
              <div style={styles.bestScore}>
                <span style={{ color: "#888" }}>Best Run:</span>
                <span style={{ color: "#ffcc00" }}> {bestScore.toLocaleString()} pts</span>
                <span style={{ color: "#888" }}> · Wave {bestWave}</span>
              </div>
            )}

            <div style={styles.divider} />

            <div style={styles.controlsList}>
              <div style={styles.controlsTitle}>CONTROLS</div>
              {isMobile ? (
                <div style={styles.controlsGrid}>
                  <span style={styles.key}>Left</span><span style={styles.action}>Joystick — Move</span>
                  <span style={styles.key}>Right</span><span style={styles.action}>Hold — Aim &amp; attack</span>
                  <span style={styles.key}>⚡</span><span style={styles.action}>Dash button</span>
                </div>
              ) : (
                <div style={styles.controlsGrid}>
                  <span style={styles.key}>W A S D</span><span style={styles.action}>Move</span>
                  <span style={styles.key}>Mouse</span><span style={styles.action}>Aim &amp; auto-attack</span>
                  <span style={styles.key}>Shift</span><span style={styles.action}>Dash (invincible)</span>
                  <span style={styles.key}>ESC</span><span style={styles.action}>Pause</span>
                </div>
              )}
            </div>
          </>
        )}

        {view === "settings" && (
          <SettingsPanel onClose={() => setView("main")} />
        )}
      </div>

      <div style={styles.footer}>
        <div style={styles.eaDisclaimer}>
          Early Access: expect bugs, expect updates. Your feedback shapes the dungeon.
        </div>
        <div style={styles.footerQuote}>It calls. Not with words — but with hunger.</div>
      </div>
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
    // Layered background: dark gradient underneath (acts as a fallback
    // AND as tonal tinting) + the key art image on top.
    //
    // Sizing / position notes:
    //   - `background-size: auto 110%` → image is 10% taller than viewport.
    //     Restored to roughly the previous "shifted up" tuning since the
    //     intermediate 103% pushed it down too far.
    //   - `background-position: center 35%` → image content positioned a
    //     bit above center. The 10% overflow is split unevenly: most of
    //     it crops off the bottom, less off the top, so the title near
    //     the top of the source stays fully visible while the
    //     dungeon/character composition fills the lower half of the
    //     viewport behind the menu panel.
    //
    // Tuning knobs (single-number iteration):
    //   bigger value of `auto NNN%` → image larger, more crop top/bottom
    //   smaller `auto NNN%` → image smaller, less crop, more dark margin
    //   smaller `center XX%` → biases image content DOWN (reveals more top of source)
    //   larger `center XX%` → biases image content UP (reveals more bottom of source)
    background: `
      linear-gradient(rgba(0,0,0,0.35), rgba(0,0,0,0.55)),
      url("${MENU_BG_URL}") center 35% / auto 110% no-repeat,
      radial-gradient(ellipse at center, #12001a 0%, #04000a 100%)
    `,
    fontFamily: "'Segoe UI', monospace",
  },
  vignette: {
    position: "absolute",
    inset: 0,
    // Stronger vignette over the key art so the menu panel reads clearly
    // against any bright highlights in the background (torches / portal).
    background:
      "radial-gradient(ellipse at center, transparent 25%, rgba(0,0,0,0.65) 70%, rgba(0,0,0,0.9) 100%)",
    pointerEvents: "none",
  },
  panel: {
    textAlign: "center",
    padding: "clamp(24px, 5vw, 48px) clamp(20px, 6vw, 56px)",
    background: "rgba(0,0,0,0.7)",
    border: "1px solid rgba(120,40,180,0.4)",
    borderRadius: 16,
    backdropFilter: "blur(8px)",
    boxShadow: "0 0 60px rgba(100,0,160,0.3), inset 0 0 30px rgba(80,0,120,0.1)",
    width: "min(460px, 94vw)",
    maxHeight: "96vh",
    overflowY: "auto",
    position: "relative",
    zIndex: 1,
  },
  eaBadge: {
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
    fontSize: 10,
    letterSpacing: 2,
    fontWeight: 900,
    color: "#ffd700",
    background: "rgba(60,40,0,0.55)",
    border: "1px solid rgba(200,150,0,0.5)",
    borderRadius: 12,
    padding: "4px 12px",
    marginBottom: 14,
    fontFamily: "monospace",
    textShadow: "0 0 6px rgba(255,180,0,0.5)",
  },
  eaDot: {
    display: "inline-block",
    width: 6,
    height: 6,
    borderRadius: "50%",
    background: "#ffcc00",
    boxShadow: "0 0 6px #ffaa00",
  },
  pitch: {
    color: "rgba(220,200,240,0.85)",
    fontSize: 13,
    letterSpacing: 1.5,
    marginTop: 12,
    fontWeight: 600,
    textShadow: "0 0 8px rgba(140,60,200,0.4)",
  },
  eaDisclaimer: {
    color: "rgba(200,160,100,0.55)",
    fontSize: 10,
    letterSpacing: 1.5,
    marginBottom: 4,
    fontFamily: "monospace",
  },
  footerQuote: {
    color: "rgba(120,100,140,0.5)",
    fontSize: 11,
    letterSpacing: 2,
    whiteSpace: "nowrap",
    fontStyle: "italic" as const,
  },
  titleWrapper: {
    position: "relative",
    marginBottom: 8,
  },
  titleMain: {
    fontSize: "clamp(36px, 14vw, 62px)",
    fontWeight: "900",
    color: "#cc88ff",
    letterSpacing: "clamp(6px, 3vw, 12px)",
    lineHeight: 1.1,
    position: "relative",
    zIndex: 2,
  },
  titleGlow: {
    position: "absolute",
    fontSize: "clamp(36px, 14vw, 62px)",
    fontWeight: "900",
    color: "transparent",
    letterSpacing: "clamp(6px, 3vw, 12px)",
    lineHeight: 1.1,
    width: "100%",
    textShadow: "0 0 30px #aa00ff, 0 0 60px #8800cc",
    zIndex: 1,
  },
  subtitle: {
    fontSize: "clamp(28px, 10vw, 44px)",
    fontWeight: "900",
    color: "#ff4444",
    letterSpacing: "clamp(6px, 3.5vw, 14px)",
    lineHeight: 1.0,
    position: "relative",
    zIndex: 2,
  },
  subtitleGlow: {
    position: "absolute",
    fontSize: "clamp(28px, 10vw, 44px)",
    fontWeight: "900",
    color: "transparent",
    letterSpacing: "clamp(6px, 3.5vw, 14px)",
    lineHeight: 1.0,
    width: "100%",
    textShadow: "0 0 25px #ff0000, 0 0 50px #cc0000",
    zIndex: 1,
  },
  tagline: {
    color: "rgba(200,180,220,0.7)",
    fontSize: 14,
    letterSpacing: 2,
    marginTop: 16,
    marginBottom: 8,
    fontStyle: "italic",
  },
  divider: {
    height: 1,
    background: "linear-gradient(to right, transparent, rgba(120,40,180,0.5), transparent)",
    margin: "20px 0",
  },
  btnPrimary: {
    padding: "16px 48px",
    fontSize: 18,
    fontWeight: "bold",
    letterSpacing: 3,
    color: "#fff",
    background: "linear-gradient(135deg, #6600aa, #440077)",
    border: "1px solid #8800cc",
    borderRadius: 8,
    cursor: "pointer",
    transition: "all 0.2s",
    boxShadow: "0 0 20px rgba(100,0,180,0.5)",
    fontFamily: "inherit",
    width: "100%",
  },
  btnTrial: {
    marginTop: 10,
    padding: "13px 32px",
    fontSize: 14,
    fontWeight: "bold",
    letterSpacing: 2,
    color: "#ffd700",
    background: "rgba(40,25,5,0.8)",
    border: "1px solid rgba(200,140,0,0.5)",
    borderRadius: 8,
    cursor: "pointer",
    fontFamily: "inherit",
    width: "100%",
    boxShadow: "0 0 14px rgba(200,140,0,0.2)",
  },
  trialLocked: {
    marginTop: 10,
    padding: "13px 32px",
    fontSize: 14,
    fontWeight: "bold",
    letterSpacing: 2,
    color: "#4a3030",
    background: "rgba(20,10,10,0.5)",
    border: "1px solid rgba(80,40,40,0.3)",
    borderRadius: 8,
    fontFamily: "inherit",
    width: "100%",
    cursor: "default",
    boxSizing: "border-box",
  },
  trialLockNote: {
    fontSize: 10,
    letterSpacing: 1,
    color: "#3a2020",
    marginTop: 4,
    fontFamily: "monospace",
  },
  btnForge: {
    marginTop: 10,
    padding: "12px 32px",
    fontSize: 14,
    fontWeight: "bold",
    letterSpacing: 2,
    color: "#c0a0e0",
    background: "rgba(40,10,70,0.7)",
    border: "1px solid rgba(120,60,160,0.5)",
    borderRadius: 8,
    cursor: "pointer",
    fontFamily: "inherit",
    width: "100%",
  },
  btnSettings: {
    marginTop: 10,
    padding: "11px 32px",
    fontSize: 13,
    fontWeight: "bold",
    letterSpacing: 2,
    color: "#a090b0",
    background: "rgba(20,10,30,0.7)",
    border: "1px solid rgba(80,50,120,0.5)",
    borderRadius: 8,
    cursor: "pointer",
    fontFamily: "inherit",
    width: "100%",
  },
  forgeShard: {
    color: "#d0a0ff",
    fontSize: 16,
  },
  forgeShardCount: {
    color: "#9060c0",
    fontSize: 12,
  },
  bestScore: {
    marginTop: 16,
    fontSize: 14,
    color: "#888",
  },
  controlsList: {
    textAlign: "left",
  },
  controlsTitle: {
    color: "rgba(180,160,220,0.7)",
    fontSize: 11,
    letterSpacing: 3,
    fontWeight: "bold",
    marginBottom: 12,
    textAlign: "center",
  },
  controlsGrid: {
    display: "grid",
    gridTemplateColumns: "auto 1fr",
    gap: "8px 20px",
    alignItems: "center",
  },
  key: {
    background: "rgba(255,255,255,0.08)",
    border: "1px solid rgba(255,255,255,0.15)",
    borderRadius: 4,
    padding: "3px 8px",
    fontSize: 12,
    color: "#ddd",
    fontWeight: "bold",
    whiteSpace: "nowrap",
  },
  action: {
    color: "rgba(200,180,220,0.8)",
    fontSize: 13,
  },
  footer: {
    position: "absolute",
    bottom: 18,
    left: "50%",
    transform: "translateX(-50%)",
    display: "flex",
    flexDirection: "column" as const,
    alignItems: "center",
    gap: 4,
    textAlign: "center" as const,
  },
};
