/**
 * LabyrinthCharSelect.tsx
 *
 * Labyrinth-specific character picker. Two-step: race → class. Differs
 * from the main game's `CharacterSelect`:
 *   - Difficulty is locked to nightmare (no picker shown).
 *   - Trial mode is off.
 *   - Only Warrior is selectable for now; Mage + Rogue show as "coming
 *     soon" but remain present so adding them later is a one-line
 *     unlock (set isClassAvailable('mage') → true).
 *
 * On confirm, writes selectedRace + selectedClass + difficultyTier
 * ("nightmare") + trialMode(false) into the game store and advances
 * to the `labyrinth` phase.
 */

import { useState } from "react";
import { useGameStore } from "../../store/gameStore";
import { useMetaStore } from "../../store/metaStore";
import { audioManager } from "../../audio/AudioManager";
import { CHARACTER_DATA, type CharacterClass } from "../../data/CharacterData";
import { RACE_DATA, RACES, type RaceType } from "../../data/RaceData";

const clickSfx = () => audioManager.play("menu_click");

const CLASSES: CharacterClass[] = ["warrior", "mage", "rogue"];

/** Which classes are playable in the labyrinth today. All three
 *  unlocked as of step 4 commit G — mage + rogue get ranged
 *  projectile attacks via LabyrinthRangedAttack.ts. */
const LABYRINTH_CLASS_AVAILABLE: Record<CharacterClass, boolean> = {
  warrior: true,
  mage: true,
  rogue: true,
  necromancer: true,
};

const LABYRINTH_CLASS_COMING_SOON_HINT = "Playable in a future labyrinth update.";

const BG_URL = `${import.meta.env.BASE_URL}images/character-menu-bg.png`;

export function LabyrinthCharSelect() {
  const {
    setPhase,
    setSelectedClass,
    setSelectedRace,
    setDifficultyTier,
    setTrialMode,
    selectedClass,
  } = useGameStore();
  const { unlockedRaces } = useMetaStore();

  const [step, setStep] = useState<"race" | "class">("race");
  const [race, setRace] = useState<RaceType>("human");
  // If the currently-selected class isn't available in the labyrinth,
  // bump the selection to warrior so the Begin button works immediately.
  const [cls, setCls] = useState<CharacterClass>(
    LABYRINTH_CLASS_AVAILABLE[selectedClass] ? selectedClass : "warrior",
  );

  const isRaceUnlocked = (r: RaceType) => unlockedRaces.includes(r);

  const onPickRace = (r: RaceType) => {
    if (!isRaceUnlocked(r)) return;
    clickSfx();
    setRace(r);
    // Auto-advance on tap. Previously this only highlighted the card
    // and required the user to scroll to a "NEXT" button below the
    // fold on mobile — which looked like the screen was stuck.
    setStep("class");
  };

  const onPickClass = (c: CharacterClass) => {
    if (!LABYRINTH_CLASS_AVAILABLE[c]) return;
    clickSfx();
    setCls(c);
    // Class tap stages the selection; the sticky footer's "DESCEND"
    // button confirms. This is the one place where we keep two-tap
    // semantics so the user can read the class stats card before
    // committing to a run.
  };

  const onBeginRun = () => {
    if (!LABYRINTH_CLASS_AVAILABLE[cls]) return;
    clickSfx();
    setSelectedRace(race);
    setSelectedClass(cls);
    setDifficultyTier("nightmare");
    setTrialMode(false);
    setPhase("labyrinth");
  };

  const onBack = () => {
    clickSfx();
    if (step === "class") setStep("race");
    else setPhase("menu");
  };

  return (
    <div style={{ ...styles.root, backgroundImage: `url(${BG_URL})` }}>
      <div style={styles.vignette} />
      <div style={styles.panel}>
        <div style={styles.header}>
          <div style={styles.eyebrow}>THE LABYRINTH · NIGHTMARE</div>
          <div style={styles.title}>
            {step === "race" ? "CHOOSE YOUR BLOOD" : "CHOOSE YOUR PATH"}
          </div>
          <div style={styles.steps}>
            <span style={step === "race" ? styles.stepActive : styles.stepDim}>
              1 · RACE
            </span>
            <span style={styles.stepSep}>›</span>
            <span style={step === "class" ? styles.stepActive : styles.stepDim}>
              2 · CLASS
            </span>
          </div>
        </div>

        <div style={styles.scrollBody}>
          {step === "race" && (
            <div style={styles.grid}>
              {RACES.map((r) => {
                const def = RACE_DATA[r];
                const unlocked = isRaceUnlocked(r);
                const active = race === r;
                return (
                  <button
                    key={r}
                    disabled={!unlocked}
                    onClick={() => onPickRace(r)}
                    style={{
                      ...styles.card,
                      ...(active ? styles.cardActive : {}),
                      ...(unlocked ? {} : styles.cardLocked),
                    }}
                  >
                    <div style={styles.cardIcon}>{def.icon}</div>
                    <div style={styles.cardName}>{def.name}</div>
                    <div style={styles.cardTitle}>{def.title}</div>
                    <div style={styles.cardDesc}>{def.description}</div>
                    {!unlocked && def.unlockCondition && (
                      <div style={styles.cardLock}>🔒 {def.unlockCondition}</div>
                    )}
                    {unlocked && (
                      <div style={styles.cardTapHint}>TAP TO CHOOSE ›</div>
                    )}
                  </button>
                );
              })}
            </div>
          )}

          {step === "class" && (
            <div style={styles.grid}>
              {CLASSES.map((c) => {
                const def = CHARACTER_DATA[c];
                const available = LABYRINTH_CLASS_AVAILABLE[c];
                const active = cls === c;
                return (
                  <button
                    key={c}
                    disabled={!available}
                    onClick={() => onPickClass(c)}
                    style={{
                      ...styles.card,
                      ...(active ? styles.cardActive : {}),
                      ...(available ? {} : styles.cardLocked),
                    }}
                  >
                    <div style={{ ...styles.cardIcon, color: def.color }}>
                      {c === "warrior" ? "⚔" : c === "mage" ? "✧" : "⚰"}
                    </div>
                    <div style={styles.cardName}>{def.name}</div>
                    <div style={styles.cardTitle}>{def.title}</div>
                    <div style={styles.cardDesc}>{def.description}</div>
                    <div style={styles.cardStats}>
                      HP {def.hp} · DMG {def.damage} · SPD {def.moveSpeed}
                    </div>
                    {!available && (
                      <div style={styles.cardLock}>🔒 {LABYRINTH_CLASS_COMING_SOON_HINT}</div>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Sticky footer so the primary CTA and back button are always
            visible on mobile, even when the card grid overflows. */}
        <div style={styles.footer}>
          <button style={styles.backBtn} onClick={onBack}>
            ← {step === "race" ? "MAIN MENU" : "BACK"}
          </button>
          {step === "class" && (
            <button
              style={LABYRINTH_CLASS_AVAILABLE[cls] ? styles.nextBtn : styles.nextBtnDim}
              onClick={onBeginRun}
              disabled={!LABYRINTH_CLASS_AVAILABLE[cls]}
            >
              DESCEND →
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const styles: Record<string, React.CSSProperties> = {
  root: {
    position: "absolute",
    inset: 0,
    backgroundColor: "#0a0414",
    backgroundSize: "cover",
    backgroundPosition: "center",
    color: "#ddd",
    fontFamily: "serif",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: 12,
    boxSizing: "border-box",
  },
  vignette: {
    position: "absolute", inset: 0,
    background: "radial-gradient(ellipse at center, rgba(0,0,0,0.2) 0%, rgba(0,0,0,0.75) 100%)",
    pointerEvents: "none",
  },
  panel: {
    position: "relative",
    zIndex: 1,
    maxWidth: 960,
    width: "100%",
    maxHeight: "calc(100dvh - 24px)",
    display: "flex",
    flexDirection: "column",
    padding: "20px 20px 0",
    borderRadius: 14,
    background: "rgba(10,4,20,0.82)",
    border: "1px solid rgba(160,80,255,0.35)",
    boxShadow: "0 0 40px rgba(80,40,140,0.25)",
    backdropFilter: "blur(6px)",
    boxSizing: "border-box",
  },
  scrollBody: {
    // Card list scrolls INSIDE the panel while header + footer stay
    // pinned. Gives every mobile viewport a visible NEXT/BACK button.
    flex: 1,
    overflowY: "auto",
    paddingBottom: 14,
    minHeight: 0,
  },
  header: {
    textAlign: "center",
    marginBottom: 18,
    flexShrink: 0,
  },
  eyebrow: {
    fontSize: 11, letterSpacing: 6, color: "rgba(220,120,255,0.85)",
    fontFamily: "monospace", fontWeight: 900,
  },
  title: {
    fontSize: 28, fontWeight: 900, letterSpacing: 5,
    color: "#e8d0ff", textShadow: "0 0 14px rgba(180,100,255,0.6)",
    marginTop: 6, marginBottom: 8,
  },
  steps: {
    fontSize: 12, letterSpacing: 3, fontFamily: "monospace",
    color: "rgba(200,170,230,0.7)",
  },
  stepActive: { color: "#e8d0ff", fontWeight: 900 },
  stepDim: { color: "rgba(180,140,220,0.55)" },
  stepSep: { margin: "0 10px", opacity: 0.5 },
  grid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
    gap: 14,
  },
  card: {
    position: "relative",
    padding: 16,
    borderRadius: 10,
    background: "rgba(20,10,40,0.6)",
    border: "1px solid rgba(140,80,220,0.35)",
    color: "#ddd",
    fontFamily: "inherit",
    cursor: "pointer",
    textAlign: "center",
    transition: "transform 0.1s, border-color 0.1s, background 0.1s",
  },
  cardActive: {
    background: "rgba(60,25,100,0.7)",
    borderColor: "rgba(220,140,255,0.8)",
    boxShadow: "0 0 18px rgba(180,100,255,0.4)",
    transform: "translateY(-2px)",
  },
  cardLocked: {
    opacity: 0.45,
    cursor: "not-allowed",
  },
  cardIcon: {
    fontSize: 30, marginBottom: 8,
    color: "#e8d0ff",
    textShadow: "0 0 10px rgba(200,140,255,0.6)",
  },
  cardName: {
    fontSize: 15, fontWeight: 900, letterSpacing: 3,
  },
  cardTitle: {
    fontSize: 11, letterSpacing: 2, fontStyle: "italic",
    color: "rgba(220,180,255,0.75)",
    marginTop: 2,
  },
  cardDesc: {
    fontSize: 11, lineHeight: 1.35,
    color: "rgba(220,220,230,0.8)",
    marginTop: 10,
  },
  cardStats: {
    fontSize: 10, letterSpacing: 1, fontFamily: "monospace",
    color: "rgba(180,200,255,0.7)",
    marginTop: 10,
  },
  cardLock: {
    marginTop: 10, fontSize: 10, letterSpacing: 1,
    color: "rgba(255,200,120,0.7)", fontFamily: "monospace",
  },
  cardTapHint: {
    marginTop: 10, fontSize: 10, letterSpacing: 3, fontWeight: 900,
    color: "rgba(220,170,255,0.7)", fontFamily: "monospace",
  },
  footer: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12,
    padding: "14px 0 16px",
    borderTop: "1px solid rgba(160,80,255,0.25)",
    flexShrink: 0,
    background: "rgba(10,4,20,0.95)",
  },
  backBtn: {
    padding: "10px 18px", fontSize: 12, fontWeight: 800, letterSpacing: 3,
    color: "rgba(220,180,255,0.75)",
    background: "transparent",
    border: "1px solid rgba(140,90,200,0.4)",
    borderRadius: 8,
    cursor: "pointer",
    fontFamily: "inherit",
  },
  nextBtn: {
    padding: "12px 22px", fontSize: 13, fontWeight: 900, letterSpacing: 4,
    color: "#fff",
    background: "rgba(80,30,140,0.75)",
    border: "1px solid rgba(220,140,255,0.7)",
    borderRadius: 8,
    cursor: "pointer",
    fontFamily: "inherit",
    boxShadow: "0 0 14px rgba(180,100,255,0.35)",
  },
  nextBtnDim: {
    padding: "12px 22px", fontSize: 13, fontWeight: 900, letterSpacing: 4,
    color: "rgba(200,180,220,0.5)",
    background: "rgba(40,20,60,0.5)",
    border: "1px solid rgba(120,80,180,0.3)",
    borderRadius: 8,
    cursor: "not-allowed",
    fontFamily: "inherit",
  },
};
