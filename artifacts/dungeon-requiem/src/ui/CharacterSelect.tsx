/**
 * CharacterSelect.tsx
 * Two-step character creation: Race → Class.
 * Race and class have locked items shown with unlock conditions.
 * Step 2 includes a difficulty tier selector and trial mode indicator.
 */

import { useState } from "react";
import { useGameStore } from "../store/gameStore";
import { useMetaStore } from "../store/metaStore";
import { audioManager } from "../audio/AudioManager";
import { CHARACTER_DATA, type CharacterClass } from "../data/CharacterData";
import { RACE_DATA, RACES, type RaceType } from "../data/RaceData";
import { DIFFICULTY_DATA, DIFFICULTIES, type DifficultyTier } from "../data/DifficultyData";

const clickSfx = () => audioManager.play("menu_click");

/**
 * Character-select background artwork. Used for BOTH step 1 (race picker) and
 * step 2 (class picker) as requested — a single piece of key art that covers
 * the full select flow. File lives at public/images/character-menu-bg.png.
 * Vite's BASE_URL resolves the GitHub Pages subpath; if the file is missing
 * the overlay background shorthand falls through to the existing dark
 * gradient so nothing breaks visually.
 */
const CHARSELECT_BG_URL = `${import.meta.env.BASE_URL}images/character-menu-bg.png`;

const CLASSES: CharacterClass[] = ["warrior", "mage", "rogue"];

const CLASS_UNLOCK_CONDITION: Record<CharacterClass, string | null> = {
  warrior: null,
  mage: "Reach Wave 5",
  rogue: "Slay 100 enemies (cumulative)",
};

// ─── Main component ───────────────────────────────────────────────────────────

export function CharacterSelect() {
  const { setPhase, setSelectedClass, setSelectedRace, setDifficultyTier, setTrialMode, selectedClass, trialMode } = useGameStore();
  const { unlockedClasses, unlockedRaces, milestones, totalKills, bestWaveEver, difficultyClears } = useMetaStore();

  const [step, setStep] = useState<"race" | "class">("race");
  const [race, setRace] = useState<RaceType>("human");
  const [cls, setCls] = useState<CharacterClass>(selectedClass);
  const [difficulty, setDifficulty] = useState<DifficultyTier>("normal");

  const isClassUnlocked = (c: CharacterClass) => unlockedClasses.includes(c);
  const isRaceUnlocked  = (r: RaceType)       => unlockedRaces.includes(r);

  // Difficulty gating — clear wave 20 boss on previous tier to unlock next.
  const normalClearedWave = difficultyClears?.normal ?? 0;
  const hardClearedWave   = difficultyClears?.hard   ?? 0;
  const isDifficultyUnlocked = (tier: DifficultyTier): boolean => {
    if (tier === "normal") return true;
    if (tier === "hard") return normalClearedWave >= 20;
    if (tier === "nightmare") return hardClearedWave >= 20;
    return true;
  };
  const difficultyUnlockHint = (tier: DifficultyTier): string => {
    if (tier === "hard")      return `Clear Wave 20 boss on Normal (${Math.min(normalClearedWave, 20)}/20)`;
    if (tier === "nightmare") return `Clear Wave 20 boss on Hard (${Math.min(hardClearedWave, 20)}/20)`;
    return "";
  };

  const confirmRace = (r: RaceType) => {
    if (!isRaceUnlocked(r)) return;
    clickSfx();
    setRace(r);
    setStep("class");
  };

  const confirmClass = (c: CharacterClass) => {
    if (!isClassUnlocked(c)) return;
    clickSfx();
    if (cls === c) {
      // Reset all run state (shardsThisRun, extraction fields, etc.) before a new run
      const store = useGameStore.getState();
      const prevBest = store.bestScore;
      const prevWave = store.bestWave;
      store.resetGame();
      store.setBestScore(prevBest, prevWave);
      setSelectedRace(race);
      setSelectedClass(c);
      setDifficultyTier(difficulty);
      setTrialMode(trialMode);
      setPhase("playing");
    } else {
      setCls(c);
    }
  };

  // Progress hints
  const wave5Done   = milestones["wave5"]   ?? bestWaveEver >= 5;
  const kills100    = milestones["kills100"] ?? totalKills >= 100;
  const bossKilled  = milestones["boss_kill"] ?? false;
  const wave10Done  = milestones["wave10"]  ?? bestWaveEver >= 10;

  const progressHints: { label: string; done: boolean; unlocks: string }[] = [
    { label: `Wave 5 (best: ${bestWaveEver})`,      done: wave5Done,  unlocks: "Mage" },
    { label: `100 kills (total: ${totalKills})`,    done: kills100,   unlocks: "Rogue" },
    { label: "Defeat The Warden (Boss)",            done: bossKilled, unlocks: "Dwarf race" },
    { label: `Wave 10 (best: ${bestWaveEver})`,     done: wave10Done, unlocks: "Elf race" },
  ];

  return (
    <div style={S.overlay}>
      {/* Fixed gradient overlay for contrast */}
      <div style={S.vignette} />

      {/* Scrollable UI content */}
      <div style={S.content}>
        {/* Header */}
        <div style={S.header}>
          <button style={S.backBtn} onClick={() => { clickSfx(); step === "class" ? setStep("race") : setPhase("menu"); }}>
            ← BACK
          </button>
          {trialMode && (
            <div style={S.trialBanner}>
              🏆 TRIAL OF CHAMPIONS — Defeat the Champion to claim victory
            </div>
          )}
          <div style={S.title}>
            {step === "race" ? "CHOOSE YOUR RACE" : "CHOOSE YOUR CLASS"}
          </div>
          <div style={S.stepIndicator}>
            <span style={{ color: step === "race" ? "#d0a0ff" : "#4a3060" }}>① RACE</span>
            <span style={{ color: "#3a2050", margin: "0 10px" }}>›</span>
            <span style={{ color: step === "class" ? "#d0a0ff" : "#4a3060" }}>② CLASS</span>
          </div>
        </div>

        {/* Scrollable card region */}
        <div style={S.scrollArea}>

          {/* ── STEP 1: Race (horizontal 3-col grid) ── */}
          {step === "race" && (
            <>
              <div style={S.raceGrid}>
                {RACES.map((r) => {
                  const def = RACE_DATA[r];
                  const locked = !isRaceUnlocked(r);
                  const isSelected = race === r;
                  return (
                    <button
                      key={r}
                      style={{
                        ...S.raceCard,
                        borderColor: locked ? "#1a1228"
                          : isSelected ? "#9040e0" : "#2a1f3d",
                        background: locked ? "#080610"
                          : isSelected ? "linear-gradient(135deg, #1a1030 0%, #3010608a 100%)"
                          : "#0e0919",
                        opacity: locked ? 0.55 : 1,
                        cursor: locked ? "not-allowed" : "pointer",
                        boxShadow: isSelected && !locked ? "0 0 22px #7020c044, inset 0 0 20px #7020c014" : "none",
                      }}
                      onClick={() => confirmRace(r)}
                    >
                      <img
                        src={`${import.meta.env.BASE_URL}${def.image}`}
                        alt={def.name}
                        style={locked ? S.racePortraitLocked : S.racePortrait}
                      />
                      <div style={{ ...S.className, color: locked ? "#4a3060" : "#c080ff", textAlign: "center" }}>{def.name}</div>
                      <div style={{ ...S.classTitle, color: locked ? "#3a2050" : "#8050b0", textAlign: "center" }}>{def.title}</div>

                      {locked ? (
                        <div style={{ ...S.lockNote, textAlign: "center", fontSize: 9 }}>🔒 {def.unlockCondition}</div>
                      ) : (
                        <div style={{ ...S.classDesc, textAlign: "center", fontSize: 10 }}>{def.description}</div>
                      )}

                      {isSelected && !locked && (
                        <div style={{ ...S.enterBtn, fontSize: 11, padding: "10px 0" }} onClick={(e) => { e.stopPropagation(); clickSfx(); setStep("class"); }}>
                          ▶ SELECT
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>

              {/* Unlock progress panel */}
              <div style={S.milestoneBox}>
                <div style={S.milestoneTitle}>UNLOCK PROGRESS</div>
                {progressHints.map((h) => (
                  <div key={h.label} style={S.milestoneRow}>
                    <span style={{ color: h.done ? "#60ff40" : "#604050", fontSize: 11 }}>
                      {h.done ? "✔" : "○"}
                    </span>
                    <span style={{ flex: 1, color: h.done ? "#a0e080" : "#504060", fontSize: 10, marginLeft: 6 }}>
                      {h.label}
                    </span>
                    <span style={{ color: h.done ? "#60c040" : "#4a3060", fontSize: 10 }}>
                      → {h.unlocks}
                    </span>
                  </div>
                ))}
              </div>
            </>
          )}

          {/* ── STEP 2: Class (collapsed/expanded cards) ── */}
          {step === "class" && (
            <>
              {/* Selected race reminder */}
              <div style={S.raceBadge}>
                {RACE_DATA[race].icon} {RACE_DATA[race].name} — {RACE_DATA[race].description}
              </div>

              {/* Difficulty selector */}
              <div style={S.diffBox}>
                <div style={S.diffTitle}>DIFFICULTY</div>
                <div style={S.diffRow}>
                  {DIFFICULTIES.map((tier) => {
                    const d = DIFFICULTY_DATA[tier];
                    const active = difficulty === tier;
                    const unlocked = isDifficultyUnlocked(tier);
                    return (
                      <button
                        key={tier}
                        disabled={!unlocked}
                        title={!unlocked ? difficultyUnlockHint(tier) : ""}
                        style={{
                          ...S.diffBtn,
                          borderColor: !unlocked ? "#1a1228"
                            : active ? d.accentColor : "#2a1f3d",
                          color: !unlocked ? "#3a2050"
                            : active ? d.accentColor : "#504060",
                          background: !unlocked ? "#080610"
                            : active ? `${d.color}18` : "#0a0614",
                          boxShadow: active && unlocked ? `0 0 12px ${d.color}44` : "none",
                          cursor: unlocked ? "pointer" : "not-allowed",
                          opacity: unlocked ? 1 : 0.55,
                        }}
                        onClick={() => { if (unlocked) { clickSfx(); setDifficulty(tier); } }}
                      >
                        <div style={{ fontSize: 13, fontWeight: 900, letterSpacing: 2, fontFamily: "monospace" }}>
                          {!unlocked ? "🔒 " : ""}{d.label}
                        </div>
                        <div style={{ fontSize: 9, letterSpacing: 1, fontFamily: "monospace", opacity: 0.8, marginTop: 2 }}>
                          {unlocked ? d.description : difficultyUnlockHint(tier)}
                        </div>
                        {tier !== "normal" && unlocked && (
                          <div style={{ fontSize: 9, color: d.color, fontFamily: "monospace", marginTop: 2 }}>
                            ×{d.shardBonusMult} shards
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div style={S.cards}>
                {CLASSES.map((c) => {
                  const def = CHARACTER_DATA[c];
                  const locked = !isClassUnlocked(c);
                  const isSelected = cls === c;
                  return (
                    <button
                      key={c}
                      style={{
                        ...S.card,
                        borderColor: locked ? "#1a1228"
                          : isSelected ? def.accentColor : "#2a1f3d",
                        background: locked ? "#080610"
                          : isSelected ? `linear-gradient(135deg, #1a1030 0%, ${def.color}28 100%)`
                          : "#0e0919",
                        opacity: locked ? 0.55 : 1,
                        cursor: locked ? "not-allowed" : "pointer",
                        boxShadow: isSelected && !locked ? `0 0 20px ${def.color}44, inset 0 0 20px ${def.color}14` : "none",
                      }}
                      onClick={() => confirmClass(c)}
                    >
                      <div style={S.cardTop}>
                        <img
                          src={`${import.meta.env.BASE_URL}${def.image}`}
                          alt={def.name}
                          style={locked ? S.portraitLocked : S.portrait}
                        />
                        <div style={S.cardTopText}>
                          <div style={{ ...S.className, color: locked ? "#4a3060" : def.accentColor }}>{def.name}</div>
                          <div style={{ ...S.classTitle, color: locked ? "#3a2050" : def.color }}>{def.title}</div>
                        </div>
                        {/* Compact attack badge — always visible */}
                        {!locked && !isSelected && (
                          <span style={{ fontSize: 9, letterSpacing: 1, color: def.accentColor, fontFamily: "monospace", flexShrink: 0 }}>
                            {c === "warrior" ? "⚔ MELEE" : c === "mage" ? "✦ ORB" : "◆ DAGGERS"}
                          </span>
                        )}
                        {isSelected && !locked && <span style={{ ...S.checkmark, color: def.accentColor }}>✔</span>}
                        {locked && <span style={{ fontSize: 14, color: "#4a3060" }}>🔒</span>}
                      </div>

                      {/* Collapsed: only top row shown. Expanded: full detail */}
                      {locked && (
                        <div style={S.lockNote}>🔒 {CLASS_UNLOCK_CONDITION[c]}</div>
                      )}
                      {isSelected && !locked && (
                        <>
                          <div style={S.classDesc}>{def.description}</div>
                          <div style={S.statGrid}>
                            <StatBar label="HP"  value={def.hp}          max={120}  color="#e04040" />
                            <StatBar label="DMG" value={def.damage}       max={32}   color="#e08020" />
                            <StatBar label="SPD" value={def.moveSpeed}    max={11}   color="#20c0e0" />
                            <StatBar label="ATK" value={def.attackSpeed}  max={2.5}  color="#c040e0" />
                          </div>
                          <div style={{ ...S.attackBadge, color: def.accentColor, borderColor: def.color + "50" }}>
                            {c === "warrior" ? "⚔ MELEE SWEEP" : c === "mage" ? "✦ PIERCING ORB" : "◆ TWIN DAGGERS"}
                          </div>
                          <div style={{ ...S.storyBlurb, borderColor: def.color + "40" }}>
                            {def.story}
                          </div>
                          <div
                            style={{
                              ...S.enterBtn,
                              background: trialMode
                                ? "linear-gradient(135deg, #aa6600cc 0%, #ffaa00 100%)"
                                : `linear-gradient(135deg, ${def.color}cc 0%, ${def.accentColor} 100%)`,
                              boxShadow: trialMode
                                ? "0 4px 20px #cc880080"
                                : `0 4px 20px ${def.color}80`,
                            }}
                          >
                            {trialMode
                              ? `🏆 CHALLENGE AS ${RACE_DATA[race].name} ${def.name}`
                              : `▶ ENTER AS ${RACE_DATA[race].name} ${def.name}`}
                          </div>
                        </>
                      )}
                    </button>
                  );
                })}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── StatBar helper ────────────────────────────────────────────────────────────

function StatBar({ label, value, max, color }: { label: string; value: number; max: number; color: string }) {
  const pct = Math.min(1, value / max);
  return (
    <div style={S.statRow}>
      <span style={S.statLabel}>{label}</span>
      <div style={S.statTrack}>
        <div style={{ ...S.statFill, width: `${pct * 100}%`, background: color }} />
      </div>
    </div>
  );
}

// ─── Styles ────────────────────────────────────────────────────────────────────

const S: Record<string, React.CSSProperties> = {
  // ─── Layout layers ────────────────────────────────────────────────────────
  overlay: {
    position: "fixed", inset: 0, overflow: "hidden",
    background: `
      url("${CHARSELECT_BG_URL}") center 60% / auto 110% no-repeat,
      linear-gradient(160deg, #04000a 0%, #0e0620 100%)
    `,
    fontFamily: "'Segoe UI', monospace", userSelect: "none", zIndex: 10,
  },
  vignette: {
    position: "fixed", inset: 0, pointerEvents: "none",
    background: `linear-gradient(
      to bottom,
      rgba(4,0,12,0.25) 0%,
      rgba(4,0,12,0.6) 35%,
      rgba(4,0,12,0.88) 55%,
      rgba(4,0,12,0.97) 100%
    )`,
    zIndex: 1,
  },
  content: {
    position: "relative", zIndex: 2,
    width: "100%", maxWidth: 660, margin: "0 auto",
    height: "100vh",
    display: "flex", flexDirection: "column",
    padding: "12px 16px 0", boxSizing: "border-box",
  },
  header: {
    textAlign: "center", display: "flex", flexDirection: "column",
    gap: 4, paddingTop: 4, flexShrink: 0, paddingBottom: 8,
  },
  scrollArea: {
    flex: 1, overflowY: "auto", display: "flex",
    flexDirection: "column", gap: 10,
    paddingBottom: 32, paddingRight: 4,
  },
  // ─── Header elements ──────────────────────────────────────────────────────
  backBtn: {
    alignSelf: "flex-start", background: "rgba(0,0,0,0.4)",
    border: "1px solid #3a2a50",
    color: "#806090", padding: "8px 16px", borderRadius: 8, cursor: "pointer",
    fontFamily: "monospace", fontSize: 13, letterSpacing: 1, minHeight: 40, marginBottom: 2,
    backdropFilter: "blur(4px)",
  },
  trialBanner: {
    background: "rgba(60,30,0,0.7)",
    border: "1px solid rgba(200,140,0,0.5)",
    borderRadius: 8, padding: "6px 14px", fontSize: 12,
    color: "#ffd700", fontFamily: "monospace", letterSpacing: 1, textAlign: "center",
  },
  title: {
    fontSize: 18, fontWeight: 900, letterSpacing: 5, color: "#d0a0ff",
    textShadow: "0 0 20px #9030d0", fontFamily: "monospace",
  },
  stepIndicator: {
    fontSize: 11, letterSpacing: 3, fontFamily: "monospace",
    display: "flex", justifyContent: "center", alignItems: "center", gap: 0,
  },
  // ─── Race grid (3-column horizontal) ──────────────────────────────────────
  raceGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(3, 1fr)",
    gap: 10,
    width: "100%",
  },
  raceCard: {
    border: "2px solid #2a1f3d", borderRadius: 12, padding: "12px",
    cursor: "pointer", display: "flex", flexDirection: "column",
    alignItems: "center", gap: 6,
    background: "#0e0919", textAlign: "center",
    transition: "border-color 0.15s, box-shadow 0.15s, background 0.15s",
  },
  racePortrait: {
    width: 64, height: 64, borderRadius: 8, objectFit: "cover" as const,
    filter: "drop-shadow(0 0 8px rgba(140,80,255,0.4))",
  },
  racePortraitLocked: {
    width: 64, height: 64, borderRadius: 8, objectFit: "cover" as const,
    opacity: 0.35, filter: "grayscale(1) brightness(0.4)",
  },
  // ─── Class cards (vertical, collapsed/expanded) ───────────────────────────
  cards: { display: "flex", flexDirection: "column", gap: 8, width: "100%" },
  card: {
    width: "100%", border: "2px solid #2a1f3d", borderRadius: 12, padding: "14px",
    cursor: "pointer", display: "flex", flexDirection: "column", gap: 8,
    background: "#0e0919", textAlign: "left",
    transition: "border-color 0.15s, box-shadow 0.15s, background 0.15s",
  },
  cardTop: { display: "flex", alignItems: "center", gap: 12 },
  portrait: {
    width: 56, height: 56, borderRadius: 8, objectFit: "cover" as const, flexShrink: 0,
    filter: "drop-shadow(0 0 8px rgba(140,80,255,0.4))",
  },
  portraitLocked: {
    width: 56, height: 56, borderRadius: 8, objectFit: "cover" as const, flexShrink: 0,
    opacity: 0.35, filter: "grayscale(1) brightness(0.4)",
  },
  cardTopText: { flex: 1, display: "flex", flexDirection: "column", gap: 2 },
  className: { fontSize: 15, fontWeight: 900, letterSpacing: 3, fontFamily: "monospace" },
  classTitle: { fontSize: 10, letterSpacing: 2, fontFamily: "monospace", textTransform: "uppercase" },
  checkmark: { fontSize: 16, fontWeight: 900, flexShrink: 0 },
  classDesc: { fontSize: 11, color: "#9080a8", lineHeight: 1.6, fontFamily: "monospace" },
  lockNote: { fontSize: 11, color: "#5a3870", fontFamily: "monospace", letterSpacing: 1 },
  statGrid: { display: "flex", flexDirection: "column", gap: 5 },
  statRow: { display: "flex", alignItems: "center", gap: 8 },
  statLabel: {
    fontSize: 9, letterSpacing: 1, color: "#605070", fontFamily: "monospace", width: 26,
    textAlign: "right", flexShrink: 0,
  },
  statTrack: { flex: 1, height: 6, background: "#1a1228", borderRadius: 4, overflow: "hidden" },
  statFill: { height: "100%", borderRadius: 4 },
  attackBadge: {
    fontSize: 9, letterSpacing: 2, textAlign: "center", border: "1px solid",
    borderRadius: 4, padding: "5px 8px", fontFamily: "monospace",
  },
  storyBlurb: {
    fontSize: 11, color: "rgba(200,180,220,0.65)", fontStyle: "italic",
    fontFamily: "monospace", lineHeight: 1.65, padding: "10px 12px",
    borderLeft: "2px solid", background: "rgba(80,40,120,0.12)",
    borderRadius: "0 6px 6px 0",
  },
  enterBtn: {
    width: "100%", padding: "13px 0", borderRadius: 8, color: "#fff",
    fontWeight: 900, fontSize: 13, letterSpacing: 2, fontFamily: "monospace",
    textAlign: "center", marginTop: 2, userSelect: "none",
    background: "linear-gradient(135deg, #6020c0cc 0%, #9040e0 100%)",
  },
  // ─── Shared elements ──────────────────────────────────────────────────────
  raceBadge: {
    background: "rgba(13,8,32,0.85)", border: "1px solid #3a1f60",
    borderRadius: 8, padding: "8px 14px", fontSize: 11,
    color: "#b080f0", fontFamily: "monospace", letterSpacing: 1,
    textAlign: "center",
  },
  milestoneBox: {
    background: "rgba(8,6,18,0.85)", border: "1px solid #1e1230",
    borderRadius: 8, padding: "12px 14px",
    display: "flex", flexDirection: "column", gap: 7,
  },
  milestoneTitle: {
    fontSize: 9, letterSpacing: 3, color: "#4a3060",
    fontFamily: "monospace", marginBottom: 2,
  },
  milestoneRow: {
    display: "flex", alignItems: "center", gap: 4,
  },
  diffBox: {
    background: "rgba(8,6,18,0.85)",
    border: "1px solid #1e1230",
    borderRadius: 8, padding: "10px 14px",
    display: "flex", flexDirection: "column", gap: 8,
  },
  diffTitle: {
    fontSize: 9, letterSpacing: 3, color: "#4a3060",
    fontFamily: "monospace",
  },
  diffRow: { display: "flex", gap: 8 },
  diffBtn: {
    flex: 1,
    border: "1.5px solid #2a1f3d", borderRadius: 8,
    padding: "10px 6px", cursor: "pointer",
    background: "#0a0614", textAlign: "center",
    transition: "all 0.15s", minHeight: 56,
    display: "flex", flexDirection: "column",
    alignItems: "center", justifyContent: "center",
  },
};
