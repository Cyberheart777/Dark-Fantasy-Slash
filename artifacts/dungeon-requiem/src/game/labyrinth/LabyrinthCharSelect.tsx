/**
 * LabyrinthCharSelect.tsx
 *
 * Labyrinth-specific character picker. Three-step: race -> class -> difficulty.
 * On confirm, writes selectedRace + selectedClass + difficultyTier +
 * labyrinthDifficulty + trialMode(false) into the game store and advances
 * to the `labyrinth` phase.
 */

import { useState } from "react";
import { useGameStore } from "../../store/gameStore";
import { useMetaStore } from "../../store/metaStore";
import { audioManager } from "../../audio/AudioManager";
import { CHARACTER_DATA, type CharacterClass } from "../../data/CharacterData";
import { RACE_DATA, RACES, type RaceType } from "../../data/RaceData";
import type { LabyrinthDifficulty } from "./LabyrinthConfig";

const clickSfx = () => audioManager.play("menu_click");

const CLASSES: CharacterClass[] = ["warrior", "mage", "rogue", "necromancer", "bard"];

const LABYRINTH_CLASS_AVAILABLE: Record<CharacterClass, boolean> = {
  warrior: true,
  mage: true,
  rogue: true,
  necromancer: true,
  bard: true,
};

const LABYRINTH_CLASS_COMING_SOON_HINT = "Playable in a future labyrinth update.";

const BG_URL = `${import.meta.env.BASE_URL}images/character-menu-bg.png`;

type Step = "race" | "class" | "difficulty";

export function LabyrinthCharSelect() {
  const {
    setPhase,
    setSelectedClass,
    setSelectedRace,
    setDifficultyTier,
    setTrialMode,
    setLabyrinthDifficulty,
    selectedClass,
  } = useGameStore();
  const { unlockedRaces } = useMetaStore();

  const [step, setStep] = useState<Step>("race");
  const [race, setRace] = useState<RaceType>("human");
  const [cls, setCls] = useState<CharacterClass>(
    LABYRINTH_CLASS_AVAILABLE[selectedClass] ? selectedClass : "warrior",
  );
  const [difficulty, setDifficulty] = useState<LabyrinthDifficulty>("normal");

  const isRaceUnlocked = (r: RaceType) => unlockedRaces.includes(r);

  const onPickRace = (r: RaceType) => {
    if (!isRaceUnlocked(r)) return;
    clickSfx();
    setRace(r);
    setStep("class");
  };

  const onPickClass = (c: CharacterClass) => {
    if (!LABYRINTH_CLASS_AVAILABLE[c]) return;
    clickSfx();
    setCls(c);
    setStep("difficulty");
  };

  const onPickDifficulty = (d: LabyrinthDifficulty) => {
    clickSfx();
    setDifficulty(d);
  };

  const onBeginRun = () => {
    if (!LABYRINTH_CLASS_AVAILABLE[cls]) return;
    clickSfx();
    setSelectedRace(race);
    setSelectedClass(cls);
    setDifficultyTier("nightmare");
    setTrialMode(false);
    setLabyrinthDifficulty(difficulty);
    setPhase("labyrinth");
  };

  const onBack = () => {
    clickSfx();
    if (step === "difficulty") setStep("class");
    else if (step === "class") setStep("race");
    else setPhase("menu");
  };

  const stepTitle =
    step === "race" ? "CHOOSE YOUR BLOOD" :
    step === "class" ? "CHOOSE YOUR PATH" :
    "CHOOSE YOUR FATE";

  return (
    <div style={{ ...styles.root, backgroundImage: `url(${BG_URL})` }}>
      <div style={styles.vignette} />
      <div style={styles.panel}>
        <div style={styles.header}>
          <div style={{
            ...styles.eyebrow,
            color: difficulty === "nightmare" && step === "difficulty"
              ? "rgba(255,40,40,0.95)"
              : difficulty === "hard" && step === "difficulty"
              ? "rgba(255,140,60,0.95)"
              : "rgba(220,120,255,0.85)",
          }}>
            THE LABYRINTH{difficulty === "nightmare" && step === "difficulty" ? " · NIGHTMARE" : difficulty === "hard" && step === "difficulty" ? " · HARD MODE" : ""}
          </div>
          <div style={styles.title}>{stepTitle}</div>
          <div style={styles.steps}>
            <span style={step === "race" ? styles.stepActive : styles.stepDim}>
              1 · RACE
            </span>
            <span style={styles.stepSep}>›</span>
            <span style={step === "class" ? styles.stepActive : styles.stepDim}>
              2 · CLASS
            </span>
            <span style={styles.stepSep}>›</span>
            <span style={step === "difficulty" ? styles.stepActive : styles.stepDim}>
              3 · DIFFICULTY
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

          {step === "difficulty" && (
            <div style={{ ...styles.grid, gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))" }}>
              {/* Standard card */}
              <button
                onClick={() => onPickDifficulty("normal")}
                style={{
                  ...styles.card,
                  ...(difficulty === "normal" ? styles.cardActive : {}),
                  padding: 24,
                }}
              >
                <div style={{ fontSize: 40, marginBottom: 10, textShadow: "0 0 14px rgba(160,100,255,0.5)" }}>
                  ☽
                </div>
                <div style={{ ...styles.cardName, fontSize: 18, letterSpacing: 4 }}>STANDARD</div>
                <div style={{ ...styles.cardTitle, marginTop: 4 }}>The Labyrinth Awaits</div>
                <div style={{ ...styles.cardDesc, marginTop: 14, lineHeight: 1.5 }}>
                  Face the labyrinth as intended. Standard enemy power and rewards.
                </div>
                <div style={{
                  marginTop: 16, padding: "8px 0",
                  borderTop: "1px solid rgba(160,80,255,0.2)",
                  fontSize: 10, letterSpacing: 1, fontFamily: "monospace",
                  color: "rgba(200,180,230,0.65)",
                }}>
                  STANDARD ENEMIES · STANDARD REWARDS
                </div>
              </button>

              {/* Hard mode card */}
              <button
                onClick={() => onPickDifficulty("hard")}
                style={{
                  ...styles.card,
                  ...(difficulty === "hard" ? {
                    background: "rgba(80,20,10,0.7)",
                    borderColor: "rgba(255,140,60,0.8)",
                    boxShadow: "0 0 24px rgba(255,80,20,0.4), inset 0 0 30px rgba(255,60,20,0.08)",
                    transform: "translateY(-2px)",
                  } : {}),
                  padding: 24,
                }}
              >
                <div style={{
                  fontSize: 40, marginBottom: 10,
                  textShadow: "0 0 18px rgba(255,80,20,0.7)",
                }}>
                  🔥
                </div>
                <div style={{
                  ...styles.cardName, fontSize: 18, letterSpacing: 4,
                  color: difficulty === "hard" ? "#ffaa44" : "#ddd",
                }}>
                  HARD MODE
                </div>
                <div style={{
                  ...styles.cardTitle, marginTop: 4,
                  color: difficulty === "hard" ? "rgba(255,180,100,0.85)" : "rgba(220,180,255,0.75)",
                }}>
                  The Abyss Hungers
                </div>
                <div style={{ ...styles.cardDesc, marginTop: 14, lineHeight: 1.5 }}>
                  Enemies hit harder, move faster, and have double HP. But the spoils are legendary.
                </div>
                <div style={{
                  marginTop: 14, padding: "8px 12px",
                  background: "rgba(255,60,20,0.08)",
                  borderRadius: 6,
                  border: "1px solid rgba(255,100,40,0.2)",
                }}>
                  <div style={{
                    fontSize: 10, letterSpacing: 1, fontFamily: "monospace",
                    color: "rgba(255,160,100,0.9)", fontWeight: 900,
                    lineHeight: 1.8,
                  }}>
                    +100% ENEMY HP · +25% DAMAGE · +10% SPEED
                  </div>
                </div>
                <div style={{
                  marginTop: 10, padding: "8px 12px",
                  background: "rgba(255,200,60,0.06)",
                  borderRadius: 6,
                  border: "1px solid rgba(255,200,60,0.15)",
                }}>
                  <div style={{
                    fontSize: 10, letterSpacing: 1, fontFamily: "monospace",
                    color: "rgba(255,220,120,0.9)", fontWeight: 900,
                    lineHeight: 1.8,
                  }}>
                    2x CRYSTALS · 1.5x DROPS · 2-4x XP
                  </div>
                </div>
              </button>

              {/* Nightmare card */}
              <button
                onClick={() => onPickDifficulty("nightmare")}
                style={{
                  ...styles.card,
                  ...(difficulty === "nightmare" ? {
                    background: "rgba(60,0,0,0.8)",
                    borderColor: "rgba(255,30,30,0.8)",
                    boxShadow: "0 0 30px rgba(255,0,0,0.5), inset 0 0 40px rgba(255,0,0,0.06)",
                    transform: "translateY(-2px)",
                  } : {}),
                  padding: 24,
                }}
              >
                <div style={{
                  fontSize: 40, marginBottom: 10,
                  textShadow: "0 0 22px rgba(255,0,0,0.8)",
                  animation: difficulty === "nightmare" ? "pulse 1.5s ease-in-out infinite" : undefined,
                }}>
                  💀
                </div>
                <div style={{
                  ...styles.cardName, fontSize: 18, letterSpacing: 4,
                  color: difficulty === "nightmare" ? "#ff4444" : "#ddd",
                }}>
                  NIGHTMARE
                </div>
                <div style={{
                  ...styles.cardTitle, marginTop: 4,
                  color: difficulty === "nightmare" ? "rgba(255,100,100,0.85)" : "rgba(220,180,255,0.75)",
                }}>
                  Beyond Death Itself
                </div>
                <div style={{ ...styles.cardDesc, marginTop: 14, lineHeight: 1.5 }}>
                  Triple HP, devastating damage, relentless speed. Only the worthy survive.
                </div>
                <div style={{
                  marginTop: 14, padding: "8px 12px",
                  background: "rgba(255,0,0,0.08)",
                  borderRadius: 6,
                  border: "1px solid rgba(255,40,40,0.25)",
                }}>
                  <div style={{
                    fontSize: 10, letterSpacing: 1, fontFamily: "monospace",
                    color: "rgba(255,100,100,0.9)", fontWeight: 900,
                    lineHeight: 1.8,
                  }}>
                    +200% ENEMY HP · +50% DAMAGE · +20% SPEED
                  </div>
                </div>
                <div style={{
                  marginTop: 10, padding: "8px 12px",
                  background: "rgba(255,200,60,0.06)",
                  borderRadius: 6,
                  border: "1px solid rgba(255,200,60,0.15)",
                }}>
                  <div style={{
                    fontSize: 10, letterSpacing: 1, fontFamily: "monospace",
                    color: "rgba(255,220,120,0.9)", fontWeight: 900,
                    lineHeight: 1.8,
                  }}>
                    3x CRYSTALS · 2x DROPS · 3-6x XP
                  </div>
                </div>
              </button>
            </div>
          )}
        </div>

        <div style={styles.footer}>
          <button style={styles.backBtn} onClick={onBack}>
            ← {step === "race" ? "MAIN MENU" : "BACK"}
          </button>
          {step === "difficulty" && (
            <button
              style={difficulty === "nightmare" ? styles.nextBtnNightmare : difficulty === "hard" ? styles.nextBtnHard : styles.nextBtn}
              onClick={onBeginRun}
            >
              {difficulty === "nightmare" ? "EMBRACE THE NIGHTMARE →" : difficulty === "hard" ? "DESCEND INTO DARKNESS →" : "DESCEND →"}
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
    transition: "transform 0.1s, border-color 0.1s, background 0.1s, box-shadow 0.15s",
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
  nextBtnHard: {
    padding: "12px 22px", fontSize: 13, fontWeight: 900, letterSpacing: 4,
    color: "#fff",
    background: "rgba(140,40,10,0.8)",
    border: "1px solid rgba(255,140,60,0.8)",
    borderRadius: 8,
    cursor: "pointer",
    fontFamily: "inherit",
    boxShadow: "0 0 18px rgba(255,80,20,0.45)",
  },
  nextBtnNightmare: {
    padding: "12px 22px", fontSize: 13, fontWeight: 900, letterSpacing: 4,
    color: "#fff",
    background: "rgba(120,0,0,0.85)",
    border: "1px solid rgba(255,30,30,0.8)",
    borderRadius: 8,
    cursor: "pointer",
    fontFamily: "inherit",
    boxShadow: "0 0 24px rgba(255,0,0,0.5)",
  },
};
