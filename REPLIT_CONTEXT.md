## IMPORTANT: Codebase Overhaul — Read Before Making Changes

16 files were rewritten or significantly modified. Do NOT revert or overwrite with older patterns.

### Modified Files (16 total)

**Data Layer:**
- `src/data/UpgradeData.ts` — 56 upgrades with class-gating and rarity. PlayerStats has ~48 fields including booleans for mechanic toggles. Bleed is WARRIOR-only, poison is ROGUE-only, slow/control is MAGE-only. Dash flags removed — dashes are baseline per class.
- `src/data/CharacterData.ts` — Warrior damage 35 (was 18). Mage range 22 (was 40), dash cooldown 2.8 (blink tradeoff). Rogue range 20 (was 30), dash cooldown 1.2 (fastest).
- `src/data/MetaUpgradeData.ts` — 12 Soul Forge upgrades. `buildTrialModifiers()` for trial buff application.
- `src/data/EnemyData.ts` — 14-tier spawn table progressing through wave 33+.
- `src/data/StatModifier.ts` — Handles boolean PlayerStats fields by skipping non-numeric keys.

**Store:**
- `src/store/metaStore.ts` — `trialWins` is `Record<string, string>` (highest difficulty per class). 9 permanent trial buffs. `completeTrial(cls, difficulty)`. Version 3 migration.

**Game Engine:**
- `src/game/GameScene.tsx` — Major systems:
  - CLASS-SPECIFIC BASELINE DASHES: Warrior = knockback charge + war cry buff. Mage = blink teleport + slow at origin (+ volatile blink upgrade for explosion). Rogue = poison dash applying venom stacks.
  - Warrior melee: blood momentum, earthbreaker, iron reprisal, fortress, melee lifedrain, BLEED ON CRIT
  - Mage projectiles: extra orbs, piercing, spell echo, chain lightning, arcane fracture, projectile radius bonus, split bolt damage reduction
  - Rogue projectiles: extra daggers, phantom blades, venom on hit, crit cascade, blade orbit
  - DoT system: poison ticks (rogue), bleed ticks (warrior), slow decay (mage)
  - EnemyProjectile has `style` field: "default" | "orb" | "dagger" — champions fire class-matched projectiles
  - Screen shake, XP orb collection animation, trial buffs at run start

**UI:**
- `src/ui/LevelUp.tsx` — Rarity-colored cards with badges
- `src/ui/SoulForge.tsx` — 12 upgrades, per-difficulty trial pips with buff descriptions
- `src/ui/TrialVictory.tsx` — Shows permanent buff awarded on clear
- `src/ui/HUD.tsx` — Wave clear flash ("WAVE X — enemies grow stronger")

**Entities & Effects:**
- `src/entities/Enemy3D.tsx` — Walk cycles, spawn/death animations, wraith/boss improvements
- `src/entities/Projectile3D.tsx` — Dagger spin, orb flicker, motion trail
- `src/entities/XPOrb3D.tsx` — Magnetize + pop collection animation
- `src/effects/AttackEffect.tsx` — 5-layer slash arc

### KEY ARCHITECTURE RULES
1. **Class identity through DoTs:** Warrior = bleed, Rogue = poison, Mage = slow/freeze. Never mix.
2. **Dashes are baseline, not upgrades.** Warrior always knockbacks, Mage always blinks, Rogue always poisons. Upgrades ENHANCE these (Battle Roar, Volatile Blink, Toxic Dash).
3. **PlayerStats has boolean fields.** Code casting to Record<string, number> must skip booleans.
4. **trialWins stores difficulty strings** not booleans. e.g. `{ warrior: "hard" }`.
5. **EnemyProjectile needs style field.** All spawns must include `style: "default" as const` (or "orb"/"dagger" for champions).
6. **Enemy spawns need DoT fields.** `poisonStacks: 0, poisonDps: 0, bleedDps: 0, bleedTimer: 0, slowPct: 0, slowTimer: 0`.
7. **XPOrb spawns need `collectTimer: 0`.**
8. **Meta progression = Soul Forge + Trial Buffs.** Both applied in `makeProgWithMeta()`.
9. **Projectile range starts short** (mage 22, rogue 20). `attack_range_boost` upgrade extends it.

### Files NOT Changed
ProgressionManager.ts, RaceData.ts, DifficultyData.ts, GameConfig.ts, SaveData.ts, gameStore.ts, Player3D.tsx, MainMenu.tsx, CharacterSelect.tsx, GameOver.tsx, PauseMenu.tsx, MobileControls.tsx, AudioManager.ts, SoundData.ts, InputManager3D.ts, DungeonRoom.tsx, Torch3D.tsx, App.tsx, main.tsx, index.css
