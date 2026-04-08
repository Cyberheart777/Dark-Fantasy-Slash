## IMPORTANT: Recent Codebase Overhaul (Read Before Making Changes)

The following 13 files were rewritten or significantly modified as part of a comprehensive upgrade. Do NOT revert these changes or overwrite them with older patterns. If you need to modify any of these files, work WITH the new architecture described below.

### Modified Files (13 total)

**Data Layer:**
- `src/data/UpgradeData.ts` — 50 upgrades with class-gating and rarity. Every UpgradeDef now has `classes: "all" | CharacterClass[]` and `rarity: "common" | "rare" | "epic"`. The `pickUpgradeChoices()` function takes a 4th parameter `charClass` and filters incompatible upgrades. PlayerStats has new boolean and numeric fields for class-specific mechanics (warrior: bloodMomentumPerHit, earthbreakerEnabled, etc. | mage: chainLightningBounces, magePiercingOrbs, etc. | rogue: dashResetOnKill, venomStackDps, etc.).
- `src/data/MetaUpgradeData.ts` — 12 Soul Forge upgrades (was 6). New `buildTrialModifiers()` function that converts trial buff data into StatModifiers.
- `src/data/EnemyData.ts` — 14-tier spawn table (was 5). Progresses every 2 waves through wave 33+.
- `src/data/StatModifier.ts` — `resolveStats()` now handles boolean fields in PlayerStats by skipping non-numeric keys.

**Store:**
- `src/store/metaStore.ts` — `trialWins` is now `Record<string, string>` storing highest difficulty tier cleared per class (was `Record<string, boolean>`). New exports: `TRIAL_BUFFS`, `getEarnedTrialBuffs()`. `completeTrial()` takes a second `difficulty` parameter. localStorage version bumped to 3 with migration.

**Game Engine:**
- `src/game/GameScene.tsx` — Major changes:
  - `PlayerRuntime` has ~15 new fields for class-specific runtime state (momentum stacks, fortress armor, war cry timer, crit cascade timer, singularity timer, blade orbit angle, etc.)
  - `EnemyRuntime` has 6 new DoT/debuff fields (poisonStacks, poisonDps, bleedDps, bleedTimer, slowPct, slowTimer)
  - `XPOrb` interface has a `collectTimer` field for collection animation
  - All 4 spawn factories (makePlayer, spawnEnemy, spawnBoss, spawnChampion, spawnGoblin) initialize the new fields
  - Class-specific dash effects: warrior War Cry buff, mage Blink teleport, rogue Shadowstrike damage
  - Projectile attack block rewritten with `fireVolley()` helper supporting extra projectiles, piercing override, spell echo, phantom blades
  - Warrior melee block includes war cry multiplier, blood momentum multiplier, melee lifedrain, earthbreaker AoE
  - DoT/bleed/slow tick processing in enemy update loop
  - Damage-taken hooks: mana shield, iron reprisal, frost armor, evasion matrix
  - Per-frame passive systems: blood momentum decay, fortress armor, war cry timer, crit cascade, blade orbit, singularity vortex, invisibility
  - Screen shake on player damage (subtle, proportional)
  - XP orb magnetize + delayed filter for collection animation
  - `makeProgWithMeta()` applies both `buildMetaModifiers()` AND `buildTrialModifiers()` at run start
  - `completeTrial()` call passes `difficultyTier`
  - Storm Heart toned down to 8 targets / 1.2× damage

**UI:**
- `src/ui/LevelUp.tsx` — Cards have rarity-colored borders (common=grey, rare=blue, epic=purple) with RARE/EPIC badges. Imports `UpgradeRarity` type from UpgradeData.
- `src/ui/SoulForge.tsx` — Shows 12 upgrade cards. Trial section displays 3 difficulty pips per class with earned buff descriptions. Imports `TRIAL_BUFFS`, `DIFFICULTIES`, `DIFFICULTY_DATA`.
- `src/ui/TrialVictory.tsx` — Shows the specific permanent buff earned on trial clear with new/already-earned distinction. Imports `TRIAL_BUFFS` from metaStore.

**Entities & Effects:**
- `src/entities/Enemy3D.tsx` — Walk cycles for brute/elite/champions, wraith arm sway + eye flicker, boss breathing + arm movement, spawn scale-in animation, death shrink+sink animation. Brute/Elite/WarriorChampion/RogueChampion meshes now take a `walkSpeed` prop.
- `src/entities/Projectile3D.tsx` — Daggers barrel-roll spin along travel axis with motion trail. Orbs have inner glow flicker and tilting ring.
- `src/entities/XPOrb3D.tsx` — Collection animation: scale up + brighten + spin fast + rise, then pop. Reads `orb.collected` and `orb.collectTimer` to drive animation.
- `src/effects/AttackEffect.tsx` — 5 layered slashes + core slash, sweep rotation through attack, cubic ease-out.

### Key Architecture Rules
1. **Never offer melee upgrades to ranged classes.** The `pickUpgradeChoices()` function handles this — don't bypass it.
2. **PlayerStats has boolean fields now.** Any code that casts PlayerStats to `Record<string, number>` must skip booleans (see StatModifier.ts for the pattern).
3. **trialWins stores difficulty strings, not booleans.** e.g. `{ warrior: "hard" }` not `{ warrior: true }`. Old boolean format is auto-migrated.
4. **Enemy spawn factories must include DoT fields.** Every new enemy spawn needs `poisonStacks: 0, poisonDps: 0, bleedDps: 0, bleedTimer: 0, slowPct: 0, slowTimer: 0`.
5. **XPOrb spawns must include `collectTimer: 0`.** Every `g.xpOrbs.push(...)` call needs this field.
6. **Meta progression has two sources now.** `buildMetaModifiers()` for Soul Forge purchases AND `buildTrialModifiers()` for trial buffs. Both are applied in `makeProgWithMeta()`.

### Files NOT Changed (still original)
ProgressionManager.ts, CharacterData.ts, RaceData.ts, DifficultyData.ts, GameConfig.ts, SaveData.ts, gameStore.ts, Player3D.tsx, MainMenu.tsx, CharacterSelect.tsx, GameOver.tsx, PauseMenu.tsx, HUD.tsx, MobileControls.tsx, AudioManager.ts, SoundData.ts, InputManager3D.ts, DungeonRoom.tsx, Torch3D.tsx, App.tsx, main.tsx, index.css
