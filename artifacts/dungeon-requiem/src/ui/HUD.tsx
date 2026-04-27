/**
 * HUD.tsx
 * React DOM overlay rendered on top of the R3F canvas.
 * Shows HP bar, XP bar, wave info, upgrades, and the Extract Run button.
 */

import { useGameStore } from "../store/gameStore";
import { useMetaStore } from "../store/metaStore";
import { DIFFICULTY_DATA } from "../data/DifficultyData";
import { UPGRADES } from "../data/UpgradeData";
import { useEffect, useRef, useState } from "react";
import { AchievementToast } from "./AchievementToast";

function useIsMobile() {
  const [mob, setMob] = useState(() => window.innerWidth < 900);
  useEffect(() => {
    const fn = () => setMob(window.innerWidth < 900);
    window.addEventListener("resize", fn);
    return () => window.removeEventListener("resize", fn);
  }, []);
  return mob;
}

interface HUDProps {
  onExtract?: () => void;
}

export function HUD({ onExtract }: HUDProps) {
  const isMobile = useIsMobile();
  const {
    playerHP, playerMaxHP, xp, xpToNext, level,
    wave, score, kills, survivalTime,
    acquiredUpgrades, isDashing,
    actionCooldownTimer, actionCooldownMax, actionReady, selectedClass,
    bossHP, bossMaxHP, bossName, bossAlive, bossSpecialWarn,
    nemesisAnnounce,
    highestBossWaveCleared, trialMode,
    equippedWeapon, equippedArmor, equippedTrinket,
    damagePopups, playerX, playerZ,
    difficultyTier, activeBuffs,
  } = useGameStore();
  const shards = useMetaStore((s) => s.shards);
  const diffDef = DIFFICULTY_DATA[difficultyTier];

  // First-run tutorial — show the large prompt panel until the player either
  // (a) levels up for the first time, (b) 20 seconds elapse, or (c) pauses.
  // Desktop only — mobile has its own MobileControls UI.
  const hasSeenTutorial = useMetaStore((s) => s.hasSeenTutorial);
  const markTutorialSeen = useMetaStore((s) => s.markTutorialSeen);
  const showTutorial = !hasSeenTutorial && !isMobile;
  const settings = useMetaStore((s) => s.settings);

  useEffect(() => {
    if (!showTutorial) return;
    const timer = setTimeout(() => markTutorialSeen(), 20000);
    return () => clearTimeout(timer);
  }, [showTutorial, markTutorialSeen]);

  useEffect(() => {
    // Dismiss early on first level-up — the LevelUp overlay itself is the
    // next thing the player will see, so the tutorial is done doing its job.
    if (showTutorial && level > 1) markTutorialSeen();
  }, [level, showTutorial, markTutorialSeen]);

  // Boss arrival announcement
  const prevBossAlive = useRef(false);
  const [bossAnnounce, setBossAnnounce] = useState(false);
  const announceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (bossAlive && !prevBossAlive.current) {
      setBossAnnounce(true);
      if (announceTimer.current) clearTimeout(announceTimer.current);
      announceTimer.current = setTimeout(() => setBossAnnounce(false), 3200);
    }
    prevBossAlive.current = bossAlive;
    return () => { if (announceTimer.current) clearTimeout(announceTimer.current); };
  }, [bossAlive]);

  // Wave clear flash
  const prevWave = useRef(wave);
  const [waveFlash, setWaveFlash] = useState(false);
  const waveFlashTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (wave > prevWave.current && wave > 1) {
      setWaveFlash(true);
      if (waveFlashTimer.current) clearTimeout(waveFlashTimer.current);
      waveFlashTimer.current = setTimeout(() => setWaveFlash(false), 2000);
    }
    prevWave.current = wave;
    return () => { if (waveFlashTimer.current) clearTimeout(waveFlashTimer.current); };
  }, [wave]);

  // Vampiric Shroud can push HP above max — clamp the main fill at 100% and
  // surface the overheal portion as a separate gold segment.
  const isOverheal = playerHP > playerMaxHP;
  const baseHpPct = Math.max(0, Math.min(playerHP, playerMaxHP) / playerMaxHP) * 100;
  const overhealPct = isOverheal ? Math.min(20, ((playerHP - playerMaxHP) / playerMaxHP) * 100) : 0;
  const xpPct = Math.min(100, (xp / xpToNext) * 100);
  const minutes = Math.floor(survivalTime / 60);
  const seconds = Math.floor(survivalTime % 60);
  const timeStr = `${minutes}:${String(seconds).padStart(2, "0")}`;

  const hpColor = baseHpPct > 50 ? "#22cc55" : baseHpPct > 25 ? "#ff8800" : "#cc2222";

  const upgradeEntries = Object.entries(acquiredUpgrades).filter(([, v]) => v > 0);

  const showExtract = !trialMode && highestBossWaveCleared > 0 && onExtract != null;
  const extractFraction =
    highestBossWaveCleared >= 20 ? "100%" :
    highestBossWaveCleared >= 15 ? "75%" :
    highestBossWaveCleared >= 10 ? "50%" :
    "25%";

  return (
    <div style={styles.hud}>
      {/* Top-left: player vitals */}
      <div style={{ ...styles.vitals, width: isMobile ? 140 : 220, padding: isMobile ? "8px 10px" : "12px 16px", top: isMobile ? 12 : 20, left: isMobile ? 10 : 20 }}>
        {/* HP bar */}
        <div style={styles.barLabel}>
          <span style={{ color: isOverheal ? "#ffcc44" : "#ff6666", fontWeight: "bold", textShadow: isOverheal ? "0 0 6px #ffaa00" : undefined }}>
            HP{isOverheal ? " ✦" : ""}
          </span>
          <span style={{ color: isOverheal ? "#ffcc44" : "#ccc", fontSize: 13 }}>
            {Math.ceil(playerHP)}/{playerMaxHP}
          </span>
        </div>
        <div style={{ ...styles.barTrack, position: "relative" }}>
          <div style={{ ...styles.barFill, width: `${baseHpPct}%`, background: hpColor, boxShadow: `0 0 8px ${hpColor}` }} />
          {overhealPct > 0 && (
            <div style={{
              position: "absolute",
              left: 0,
              top: 0,
              bottom: 0,
              width: `${100 + overhealPct}%`,
              background: "linear-gradient(90deg, transparent 80%, #ffcc44 100%)",
              boxShadow: "0 0 10px #ffaa00",
              borderRadius: "inherit",
              pointerEvents: "none",
            }} />
          )}
        </div>

        {/* XP bar */}
        <div style={{ ...styles.barLabel, marginTop: 8 }}>
          <span style={{ color: "#aaffaa", fontWeight: "bold" }}>XP</span>
          <span style={{ color: "#ccc", fontSize: 13 }}>Lv.{level}</span>
        </div>
        <div style={styles.barTrack}>
          <div style={{ ...styles.barFill, width: `${xpPct}%`, background: "#44ff88", boxShadow: "0 0 8px #44ff88" }} />
        </div>
      </div>

      {/* Top-center: wave/score */}
      <div style={{
        ...styles.center,
        padding: isMobile ? "4px 12px" : "8px 24px",
      }}>
        <div style={{
          display: "inline-block",
          padding: "2px 10px",
          borderRadius: 4,
          background: diffDef.color + "22",
          border: `1px solid ${diffDef.color}aa`,
          color: diffDef.accentColor,
          fontSize: isMobile ? 8 : 10,
          fontWeight: 900,
          letterSpacing: 2,
          fontFamily: "monospace",
          marginBottom: isMobile ? 2 : 4,
          textShadow: `0 0 6px ${diffDef.color}80`,
        }}>{diffDef.label}</div>
        <div style={{ ...styles.waveText, fontSize: isMobile ? 14 : 22, letterSpacing: isMobile ? 2 : 3 }}>WAVE {wave}</div>
        <div style={{ ...styles.statsRow, fontSize: isMobile ? 10 : 14, gap: isMobile ? 10 : 20, marginTop: isMobile ? 2 : 4 }}>
          <span>⚔ {kills}</span>
          <span>★ {score.toLocaleString()}</span>
          <span>⏱ {timeStr}</span>
          <span style={{ color: "#ffcc44" }}>◈ {shards.toLocaleString()}</span>
        </div>
      </div>

      {/* Controls hint — desktop only, hidden while first-run tutorial is visible */}
      {!isMobile && !showTutorial && (
        <div style={styles.controls}>
          <span>WASD Move</span>
          <span>Mouse Aim &amp; auto-attack</span>
          <span>Shift Dash</span>
          <span>Space Action</span>
          <span>ESC Pause</span>
        </div>
      )}

      {/* First-run tutorial — prominent bottom-center prompt panel */}
      {showTutorial && (
        <div style={styles.tutorial}>
          <div style={styles.tutorialTitle}>YOUR FIRST DESCENT</div>
          <div style={styles.tutorialRow}>
            <span style={styles.tutorialKey}>W A S D</span>
            <span style={styles.tutorialLabel}>Move</span>
          </div>
          <div style={styles.tutorialRow}>
            <span style={styles.tutorialKey}>Mouse</span>
            <span style={styles.tutorialLabel}>Aim — you auto-attack in that direction</span>
          </div>
          <div style={styles.tutorialRow}>
            <span style={styles.tutorialKey}>Shift</span>
            <span style={styles.tutorialLabel}>Dash — brief invincibility</span>
          </div>
          <div style={styles.tutorialRow}>
            <span style={styles.tutorialKey}>Space</span>
            <span style={styles.tutorialLabel}>Action ability — powerful class skill</span>
          </div>
          <div style={styles.tutorialRow}>
            <span style={styles.tutorialKey}>ESC</span>
            <span style={styles.tutorialLabel}>Pause</span>
          </div>
          <div style={styles.tutorialFoot}>
            Walk over items to pick them up · This panel fades after your first level-up
          </div>
        </div>
      )}

      {/* Bottom-left: upgrades (hidden on mobile to keep joystick area clear) */}
      {upgradeEntries.length > 0 && !isMobile && (
        <div style={styles.upgradePanel}>
          <div style={styles.upgradeTitle}>UPGRADES ({upgradeEntries.length})</div>
          <div style={styles.upgradeGrid}>
            {upgradeEntries.map(([id, count]) => {
              const def = UPGRADES[id as keyof typeof UPGRADES];
              const name = def?.name ?? id.replace(/_/g, " ");
              const icon = def?.icon ?? "";
              const rarityColor = def?.rarity === "epic" ? "#aa44ff" : def?.rarity === "rare" ? "#4488ff" : "#aaa";
              return (
                <div key={id} style={{ ...styles.upgradeChip, borderLeft: `2px solid ${rarityColor}` }}>
                  <span style={{ fontSize: 10, letterSpacing: 1, color: "#ddd" }}>
                    {icon} {name}
                  </span>
                  {count > 1 && <span style={{ color: "#ffcc00", marginLeft: 4, fontWeight: "bold" }}>×{count}</span>}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Gear slots — top-right */}
      <div style={{ ...styles.gearPanel, top: isMobile ? 80 : 120, right: isMobile ? 8 : 12, gap: isMobile ? 4 : 6 }}>
        {([["⚔", equippedWeapon], ["🛡", equippedArmor], ["💎", equippedTrinket]] as [string, any][]).map(([slotIcon, gear], i) => {
          const sz = isMobile ? 40 : 52;
          return (
            <div key={i} style={{
              ...styles.gearSlot,
              width: sz, height: sz,
              borderColor: gear ? (gear.rarity === "epic" ? "#aa44ff" : gear.rarity === "rare" ? "#4488dd" : "#6a6a7a") : "#2a2035",
              boxShadow: gear?.rarity === "epic" ? "0 0 8px rgba(140,40,255,0.3)" : gear?.rarity === "rare" ? "0 0 6px rgba(60,120,255,0.2)" : "none",
            }}>
              <div style={{ fontSize: isMobile ? 13 : 16 }}>{gear ? gear.icon : slotIcon}</div>
              {gear && (
                <div style={{ fontSize: isMobile ? 7 : 8, color: gear.rarity === "epic" ? "#cc88ff" : gear.rarity === "rare" ? "#70b0ff" : "#999", letterSpacing: 1, marginTop: 1, textAlign: "center" as const, lineHeight: 1.1, maxWidth: sz, overflow: "hidden" }}>
                  {gear.name}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Dash cooldown indicator — desktop only (mobile has its own dash button) */}
      {!isMobile && (
        <div style={{ ...styles.actionIndicator, opacity: isDashing ? 1 : 0.3 }}>
          <span style={{ color: isDashing ? "#88aaff" : "#666" }}>◈ DASH</span>
        </div>
      )}

      {/* Action ability indicator — desktop only */}
      {!isMobile && (
        <div style={{
          position: "absolute",
          bottom: 40,
          right: 20,
          display: "flex",
          flexDirection: "column" as const,
          alignItems: "center",
          gap: 4,
          padding: "8px 14px",
          background: actionReady ? "rgba(20,60,20,0.85)" : "rgba(20,20,40,0.75)",
          border: `1px solid ${actionReady ? "#44cc44" : "#444"}`,
          borderRadius: 10,
          transition: "all 0.3s",
          boxShadow: actionReady ? "0 0 12px rgba(60,200,60,0.4)" : "none",
        }}>
          <span style={{
            fontSize: 11,
            fontWeight: 900,
            letterSpacing: 2,
            color: actionReady ? "#88ff88" : "#888",
            fontFamily: "monospace",
          }}>
            {selectedClass === "warrior" ? "WAR CRY" :
             selectedClass === "mage" ? "ARCANE BARRAGE" :
             selectedClass === "rogue" ? "FAN OF KNIVES" :
             selectedClass === "necromancer" ? "ARMY OF DEAD" :
             "DISCORD"}
          </span>
          {!actionReady && (
            <span style={{
              fontSize: 13,
              fontWeight: "bold",
              color: "#ffaa44",
              fontFamily: "monospace",
            }}>
              {Math.ceil(actionCooldownTimer)}s
            </span>
          )}
          {actionReady && (
            <span style={{
              fontSize: 10,
              color: "#66cc66",
              fontFamily: "monospace",
            }}>
              READY
            </span>
          )}
          <span style={{
            fontSize: 9,
            color: "rgba(180,180,180,0.5)",
            letterSpacing: 1,
            fontFamily: "monospace",
          }}>
            SPACE
          </span>
        </div>
      )}

      {/* Extract Run button — shown only after first boss kill, normal mode */}
      {showExtract && (
        <div style={{ ...styles.extractWrapper, top: isMobile ? 12 : 64, right: isMobile ? 8 : 16 }}>
          <button style={{ ...styles.extractBtn, padding: isMobile ? "8px 12px" : "12px 20px", fontSize: isMobile ? 11 : 13 }} onClick={onExtract}>
            ↑ EXTRACT RUN
            <span style={styles.extractSub}>Keep {extractFraction} of run shards</span>
          </button>
        </div>
      )}

      {/* Boss HP bar — full width, center-bottom, shown only when boss is alive */}
      {bossAlive && bossMaxHP > 0 && (
        <div style={styles.bossBar}>
          <div style={styles.bossBarHeader}>
            <span style={styles.bossBarName}>{bossName}</span>
            {bossSpecialWarn && (
              <span style={styles.bossWarn}>⚠ SHOCKWAVE INCOMING</span>
            )}
          </div>
          <div style={styles.bossBarTrack}>
            <div style={{
              ...styles.bossBarFill,
              width: `${Math.max(0, (bossHP / bossMaxHP)) * 100}%`,
            }} />
          </div>
          <div style={styles.bossBarFooter}>
            <span style={{ color: "#aaa", fontSize: 11 }}>
              {Math.max(0, Math.ceil(bossHP)).toLocaleString()} / {bossMaxHP.toLocaleString()}
            </span>
          </div>
        </div>
      )}

      {/* Boss arrival announcement */}
      {bossAnnounce && (
        <div style={styles.bossAnnounce}>
          <div style={styles.bossAnnounceTop}>⚠ BOSS APPROACHES ⚠</div>
          <div style={styles.bossAnnounceBottom}>{bossName}</div>
        </div>
      )}

      {/* Nemesis announcement */}
      {nemesisAnnounce && (
        <div style={{ ...styles.bossAnnounce, background: "radial-gradient(ellipse at center, rgba(180,40,20,0.85), rgba(80,10,0,0.6) 70%, transparent 100%)" }}>
          <div style={{ ...styles.bossAnnounceTop, color: "#ff6030" }}>⚔ {nemesisAnnounce} ⚔</div>
        </div>
      )}

      {/* Wave clear flash */}
      {waveFlash && (
        <div style={styles.waveFlash}>
          <div style={styles.waveFlashText}>WAVE {wave}</div>
          <div style={styles.waveFlashSub}>enemies grow stronger</div>
        </div>
      )}

      {/* Floating damage numbers + heal numbers + text popups */}
      {damagePopups.slice(-20).map((popup) => {
        const duration = popup.durationSec ?? 0.8;
        const age = (performance.now() - popup.spawnTime) / 1000;
        if (age > duration) return null;
        // Heal numbers start with "+" and use short 0.8s duration — treat like
        // damage numbers (fast rise, small font) rather than text popups.
        const isHealNumber = !!popup.text && popup.text.startsWith("+") && duration <= 0.8;
        // Damage number toggle: text popups (Item Dropped, etc.) always render.
        // Numeric popups AND heal numbers are gated on the setting.
        if (!popup.text && !settings.damageNumbers) return null;
        if (isHealNumber && !settings.damageNumbers) return null;
        // Rough world-to-screen: offset from center based on difference from player position
        // Camera is isometric at ~28 units, viewport maps ~60 world units across ~100vw
        const dx = (popup.x - playerX) * 1.5; // % of viewport
        const dz = (popup.z - playerZ) * 1.2;
        // Text popups (gear drops, etc.) rise slower; damage & heal numbers rise fast
        const isTextPopup = !!popup.text && !isHealNumber;
        const rise = isTextPopup ? age * 40 + 20 : age * 60;
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
          <div
            key={popup.id}
            style={{
              position: "absolute",
              left: `calc(50% + ${dx}vw)`,
              top: `calc(42% + ${dz}vh - ${rise}px)`,
              transform: `translateX(-50%) scale(${scale})`,
              color,
              fontSize,
              fontWeight: 900,
              fontFamily: "monospace",
              textShadow,
              opacity,
              pointerEvents: "none",
              whiteSpace: "nowrap",
              letterSpacing: isTextPopup ? 2 : 1,
            }}
          >
            {popup.text ?? (popup.isPlayer ? `-${Math.round(popup.value)}` : Math.round(popup.value))}
            {!isTextPopup && popup.isCrit && <span style={{ fontSize: 10, marginLeft: 2, color: "#ffaa00" }}>!</span>}
          </div>
        );
      })}

      {/* Active buffs/debuffs bar — bottom-center */}
      {activeBuffs.length > 0 && (
        <div style={styles.buffBar}>
          {activeBuffs.map((b) => {
            const fillPct = Math.min(100, (b.value / b.max) * 100);
            return (
              <div
                key={b.id}
                style={{
                  ...styles.buffChip,
                  borderColor: b.isDebuff ? "#882222" : b.color + "88",
                  background: b.isDebuff ? "rgba(60,10,10,0.85)" : "rgba(10,8,20,0.85)",
                }}
              >
                {/* Fill bar behind the content */}
                <div style={{
                  position: "absolute",
                  left: 0, top: 0, bottom: 0,
                  width: `${fillPct}%`,
                  background: (b.isDebuff ? "#cc2222" : b.color) + "30",
                  borderRadius: "inherit",
                  transition: "width 0.15s",
                }} />
                <span style={styles.buffIcon}>{b.icon}</span>
                <div style={styles.buffTextCol}>
                  <div style={{ ...styles.buffLabel, color: b.isDebuff ? "#ff6666" : b.color }}>
                    {b.label}
                  </div>
                  <div style={styles.buffValue}>
                    {b.isStacks ? `${Math.round(b.value)}` : `${b.value.toFixed(1)}s`}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Achievement unlock toast */}
      <AchievementToast />
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  hud: {
    position: "absolute",
    inset: 0,
    pointerEvents: "none",
    zIndex: 10,
    fontFamily: "'Segoe UI', monospace",
    userSelect: "none",
  },
  vitals: {
    position: "absolute",
    top: 20,
    left: 20,
    width: 220,
    background: "rgba(0,0,0,0.65)",
    border: "1px solid #333",
    borderRadius: 8,
    padding: "12px 16px",
    backdropFilter: "blur(4px)",
  },
  barLabel: {
    display: "flex",
    justifyContent: "space-between",
    marginBottom: 4,
    fontSize: 14,
    fontWeight: "600",
  },
  barTrack: {
    width: "100%",
    height: 10,
    background: "#222",
    borderRadius: 5,
    overflow: "hidden",
    border: "1px solid #444",
  },
  barFill: {
    height: "100%",
    borderRadius: 5,
    transition: "width 0.15s ease",
  },
  center: {
    position: "absolute",
    top: 20,
    left: "50%",
    transform: "translateX(-50%)",
    textAlign: "center",
    background: "rgba(0,0,0,0.6)",
    border: "1px solid #333",
    borderRadius: 8,
    padding: "8px 24px",
    backdropFilter: "blur(4px)",
  },
  waveText: {
    fontSize: 22,
    fontWeight: "bold",
    color: "#ff8800",
    letterSpacing: 3,
    textShadow: "0 0 10px #ff6600",
  },
  statsRow: {
    display: "flex",
    gap: 20,
    color: "#ccc",
    fontSize: 14,
    marginTop: 4,
  },
  controls: {
    position: "absolute",
    bottom: 16,
    left: "50%",
    transform: "translateX(-50%)",
    display: "flex",
    gap: 16,
    color: "rgba(180,180,180,0.5)",
    fontSize: 12,
    background: "rgba(0,0,0,0.4)",
    padding: "6px 16px",
    borderRadius: 20,
    border: "1px solid rgba(255,255,255,0.08)",
  },
  tutorial: {
    position: "absolute",
    bottom: 24,
    left: "50%",
    transform: "translateX(-50%)",
    display: "flex",
    flexDirection: "column" as const,
    alignItems: "center",
    gap: 8,
    padding: "18px 32px 14px",
    background: "rgba(10,5,20,0.88)",
    border: "1px solid rgba(140,60,200,0.55)",
    borderRadius: 12,
    boxShadow: "0 0 32px rgba(100,0,160,0.35), inset 0 0 20px rgba(80,0,120,0.15)",
    backdropFilter: "blur(6px)",
    fontFamily: "'Segoe UI', monospace",
    minWidth: 360,
    animation: "tutorialPulse 2.4s ease-in-out infinite",
  },
  tutorialTitle: {
    color: "#cc88ff",
    fontSize: 11,
    letterSpacing: 4,
    fontWeight: 900,
    textTransform: "uppercase" as const,
    textShadow: "0 0 10px rgba(180,80,255,0.6)",
    marginBottom: 4,
  },
  tutorialRow: {
    display: "flex",
    alignItems: "center",
    gap: 14,
    width: "100%",
  },
  tutorialKey: {
    display: "inline-block",
    minWidth: 72,
    textAlign: "center" as const,
    background: "linear-gradient(135deg, rgba(80,30,140,0.6), rgba(40,10,80,0.6))",
    border: "1px solid rgba(180,100,255,0.5)",
    borderRadius: 5,
    padding: "4px 10px",
    fontSize: 12,
    fontWeight: "bold" as const,
    letterSpacing: 1.5,
    color: "#e8d0ff",
    boxShadow: "0 0 8px rgba(120,40,200,0.3)",
  },
  tutorialLabel: {
    color: "rgba(210,190,230,0.9)",
    fontSize: 13,
    letterSpacing: 0.5,
  },
  tutorialFoot: {
    marginTop: 6,
    color: "rgba(160,140,200,0.55)",
    fontSize: 10,
    fontStyle: "italic" as const,
    letterSpacing: 0.5,
    textAlign: "center" as const,
  },
  upgradePanel: {
    position: "absolute",
    bottom: 60,
    left: 20,
    maxWidth: 280,
    background: "rgba(0,0,0,0.65)",
    border: "1px solid #333",
    borderRadius: 8,
    padding: "10px 12px",
    backdropFilter: "blur(4px)",
  },
  upgradeTitle: {
    color: "#ffcc44",
    fontSize: 11,
    letterSpacing: 2,
    fontWeight: "bold",
    marginBottom: 6,
  },
  upgradeGrid: {
    display: "flex",
    flexWrap: "wrap",
    gap: 4,
  },
  upgradeChip: {
    background: "rgba(80,60,20,0.6)",
    border: "1px solid #664",
    borderRadius: 4,
    padding: "3px 7px",
    fontSize: 11,
    color: "#ddd",
  },
  actionIndicator: {
    position: "absolute",
    bottom: 16,
    right: 20,
    fontSize: 13,
    letterSpacing: 2,
    transition: "opacity 0.2s",
  },
  extractWrapper: {
    position: "absolute",
    top: 64,
    right: 16,
    pointerEvents: "auto",
  },
  extractBtn: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    padding: "12px 20px",
    fontSize: 13,
    minHeight: 48,
    fontWeight: "bold",
    letterSpacing: 2,
    color: "#aaff88",
    background: "rgba(10,40,10,0.88)",
    border: "1px solid #44aa22",
    borderRadius: 8,
    cursor: "pointer",
    fontFamily: "'Segoe UI', monospace",
    boxShadow: "0 0 16px rgba(60,200,40,0.35)",
    backdropFilter: "blur(4px)",
    gap: 4,
  },
  extractSub: {
    fontSize: 10,
    color: "rgba(160,255,120,0.65)",
    letterSpacing: 1,
    fontWeight: "normal",
  },
  bossBar: {
    position: "absolute",
    bottom: 52,
    left: "50%",
    transform: "translateX(-50%)",
    width: "min(600px, 90vw)",
    background: "rgba(0,0,0,0.75)",
    border: "1px solid #660033",
    borderRadius: 8,
    padding: "10px 14px 8px",
    backdropFilter: "blur(6px)",
    boxShadow: "0 0 24px rgba(180,0,80,0.4)",
  },
  bossBarHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 6,
  },
  bossBarName: {
    color: "#ff44aa",
    fontSize: 15,
    fontWeight: "bold",
    letterSpacing: 2,
    textShadow: "0 0 10px #ff0066",
    textTransform: "uppercase" as const,
  },
  bossWarn: {
    color: "#ff4400",
    fontSize: 13,
    fontWeight: "bold",
    letterSpacing: 1,
    animation: "none",
    textShadow: "0 0 8px #ff2200",
  },
  bossBarTrack: {
    width: "100%",
    height: 14,
    background: "#1a0010",
    borderRadius: 7,
    overflow: "hidden",
    border: "1px solid #550022",
  },
  bossBarFill: {
    height: "100%",
    borderRadius: 7,
    background: "linear-gradient(90deg, #8b0050, #ff0066, #cc0044)",
    boxShadow: "0 0 10px #ff0066",
    transition: "width 0.12s ease",
  },
  bossBarFooter: {
    marginTop: 4,
    textAlign: "center" as const,
  },
  bossAnnounce: {
    position: "absolute",
    top: "30%",
    left: "50%",
    transform: "translateX(-50%)",
    textAlign: "center" as const,
    pointerEvents: "none",
  },
  bossAnnounceTop: {
    color: "#ff2244",
    fontSize: 28,
    fontWeight: "bold",
    letterSpacing: 4,
    textShadow: "0 0 20px #ff0033, 0 0 40px #880000",
    marginBottom: 8,
    textTransform: "uppercase" as const,
  },
  bossAnnounceBottom: {
    color: "#ff88bb",
    fontSize: 18,
    letterSpacing: 6,
    textShadow: "0 0 12px #ff0055",
    textTransform: "uppercase" as const,
  },
  gearPanel: {
    position: "absolute",
    top: 120,
    right: 12,
    display: "flex",
    gap: 6,
    pointerEvents: "none",
  },
  gearSlot: {
    width: 52,
    height: 52,
    display: "flex",
    flexDirection: "column" as const,
    alignItems: "center",
    justifyContent: "center",
    background: "rgba(10,6,20,0.85)",
    border: "1.5px solid #2a2035",
    borderRadius: 8,
    transition: "border-color 0.2s, box-shadow 0.2s",
  },
  waveFlash: {
    position: "absolute",
    top: "22%",
    left: "50%",
    transform: "translateX(-50%)",
    textAlign: "center" as const,
    pointerEvents: "none",
    animation: "fadeOut 2s ease-out forwards",
  },
  waveFlashText: {
    color: "#ffcc44",
    fontSize: 36,
    fontWeight: 900,
    letterSpacing: 8,
    textShadow: "0 0 20px #ffaa00, 0 0 40px #885500",
    textTransform: "uppercase" as const,
  },
  waveFlashSub: {
    color: "rgba(255,200,100,0.6)",
    fontSize: 13,
    letterSpacing: 4,
    marginTop: 6,
    textTransform: "uppercase" as const,
  },
  buffBar: {
    position: "absolute",
    bottom: 12,
    left: "50%",
    transform: "translateX(-50%)",
    display: "flex",
    gap: 6,
    pointerEvents: "none",
    zIndex: 20,
    flexWrap: "wrap" as const,
    justifyContent: "center",
    maxWidth: "90vw",
  },
  buffChip: {
    position: "relative" as const,
    overflow: "hidden" as const,
    display: "flex",
    alignItems: "center",
    gap: 5,
    padding: "4px 8px",
    borderRadius: 6,
    border: "1px solid",
    fontFamily: "monospace",
    minWidth: 70,
  },
  buffIcon: {
    fontSize: 14,
    lineHeight: 1,
    flexShrink: 0,
    position: "relative" as const,
    zIndex: 1,
  },
  buffTextCol: {
    display: "flex",
    flexDirection: "column" as const,
    gap: 1,
    position: "relative" as const,
    zIndex: 1,
  },
  buffLabel: {
    fontSize: 8,
    fontWeight: 900,
    letterSpacing: 1.5,
    lineHeight: 1,
  },
  buffValue: {
    fontSize: 10,
    color: "#ccc",
    fontWeight: 700,
    lineHeight: 1,
  },
};
