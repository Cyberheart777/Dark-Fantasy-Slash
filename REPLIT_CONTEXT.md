## IMPORTANT: Codebase Overhaul — Read Before Making Changes

17 files were rewritten or significantly modified. Do NOT revert or overwrite with older patterns.

### Modified Files (17 total)

**Data Layer:**
- `src/data/UpgradeData.ts` — 56+ upgrades with class-gating and rarity. Bleed=WARRIOR, Poison=ROGUE, Slow=MAGE. Dashes are baseline per class (no upgrade gate). Projectile interface has `isFracture` flag.
- `src/data/CharacterData.ts` — Warrior damage 35. Mage range 22, dash cd 2.8. Rogue range 20, dash cd 1.2.
- `src/data/MetaUpgradeData.ts` — 12 Soul Forge upgrades + `buildTrialModifiers()`.
- `src/data/EnemyData.ts` — 14-tier spawn table through wave 33+.
- `src/data/StatModifier.ts` — Handles boolean PlayerStats fields.
- `src/data/GearData.ts` — NEW: 18 equippable items (6 weapon/6 armor/6 trinket), 3 rarities, drop chance per enemy type.

**Store:**
- `src/store/metaStore.ts` — Per-difficulty trial tracking, 9 permanent buffs, v3 migration.
- `src/store/gameStore.ts` — Added gear state (equippedWeapon/Armor/Trinket), setGearEquipped action, GearDef import.

**Game Engine:**
- `src/game/GameScene.tsx` — Major systems:
  - BASELINE DASHES: Warrior=knockback+warCry, Mage=blink+slow, Rogue=poison dash
  - Warrior champion AI: telegraphed wind-up swing (1.2s warning), slower pursuit, 6s slam cooldown
  - Arcane fracture: `isFracture` flag prevents chain reactions, exactly 3 projectiles per death
  - GEAR SYSTEM: GearDropRuntime, trySpawnGear() on kills, equipGear() with stat application, pickup in game loop, GearDrop3D floating gem component
  - EnemyProjectile style field: champions fire class-matched projectiles
  - All previous systems intact (DoTs, screen shake, XP animation, trial buffs)

**UI:**
- `src/ui/LevelUp.tsx` — Rarity-colored cards
- `src/ui/SoulForge.tsx` — 12 upgrades, per-difficulty trial pips
- `src/ui/TrialVictory.tsx` — Permanent buff display on clear
- `src/ui/HUD.tsx` — Wave flash, gear slot display (3 slots top-right with rarity borders)

**Entities & Effects:**
- `src/entities/Enemy3D.tsx` — Walk cycles, spawn/death animations
- `src/entities/Projectile3D.tsx` — Dagger spin, orb flicker
- `src/entities/XPOrb3D.tsx` — Collection animation
- `src/effects/AttackEffect.tsx` — 5-layer slash arc

### KEY RULES
1. Warrior=bleed, Rogue=poison, Mage=slow. Never mix.
2. Dashes are baseline. Upgrades enhance, not enable.
3. PlayerStats has booleans — skip in Record<string,number> casts.
4. trialWins stores difficulty strings not booleans.
5. EnemyProjectile needs `style` field on all spawns.
6. Enemy spawns need DoT fields + gear fields initialized.
7. XPOrb spawns need `collectTimer: 0`.
8. Gear spawns via `trySpawnGear()` after enemy death audio plays.
9. Projectile interface has `isFracture?` — fracture projectiles must not chain.

### Labyrinth Mode — Shroud + Extraction Portals

**Zone shroud applies poison stacks, not percent-HP damage.**
While the player is outside the safe zone in Labyrinth mode, the zone
applies **poison stacks** (same mechanic as the Rogue's Venom Stack
upgrade). The player-side poison state lives in `LabyrinthPoison.ts`
as a *Labyrinth-local mirror* of the enemy poison system — the base
`PlayerRuntime` is intentionally NOT modified.

- Accumulation: +1 stack per second outside the zone, capped at 5.
- Per-stack damage: `max(3, stats.venomStackDps) * stats.deepWoundsMultiplier`,
  identical to the formula at `GameScene.tsx:1026-1034`. When the
  Labyrinth wires up its own progression stats in a later step, the
  Rogue's Venom Stack and Deep Wounds power-ups automatically scale
  shroud damage.
- Falloff: full reset to 0 after 3 continuous seconds in the safe zone.
  (Base game poison has no decay — this 3s falloff is Labyrinth-local.)

**Extraction portals are an alternative win condition.**
Oval purple portals spawn at milestones — 3 @ 3:00, 2 @ 5:00, 1 @ 7:00
(6 total). They spawn in the "about to close" ring (inside current safe
radius, outside next zone target) with buffer margins. Walking into
one triggers an **EXTRACTED** victory screen. Portals are consumed
when the zone overtakes their position (fade-out + console log
`"portal consumed"`).

**Files:**
- `src/game/labyrinth/LabyrinthPoison.ts` — poison state + tick math mirror
- `src/game/labyrinth/LabyrinthPortal.ts` — portal data + spawn algorithm
- `src/game/labyrinth/LabyrinthPortal3D.tsx` — oval portal renderer
- `src/game/labyrinth/LabyrinthScene.tsx` — wired via `ZoneTickLoop`

**Invariant:** All poison/portal changes are fully self-contained in the
Labyrinth folder. No edits to `GameScene.tsx`, `UpgradeData.ts`, or any
other non-Labyrinth source. Normal dungeon mode and trial mode are
untouched.

### Labyrinth Mode — Combat + Corridor Guardians (Step 3a)

First enemy type wired in with a minimal player-combat model.

**Player combat** (`LabyrinthCombat.ts`):
- Spacebar / mouse click / mobile attack button triggers a 120° forward
  swing. Every live enemy in the arc within `atkRange` takes damage.
- Baseline stats (`LAB_COMBAT_BASELINE`) mirror the main game's
  warrior defaults (damage 30, range 3.2, cooldown 0.6s). When
  Labyrinth progression lands in Step 5, these will be replaced by
  the player's PlayerStats — the interface shape already matches.
- Swing visual is a translucent additive pie-wedge at the player's
  feet, fading over `SWING_VISUAL_DURATION_SEC`.

**Corridor Guardians** (`LabyrinthEnemy.ts`, `LabyrinthEnemy3D.tsx`):
- 10 spawned per run (`CORRIDOR_GUARDIAN_COUNT` in config), placed
  in cells away from both the player spawn and the center chamber.
- AI states: `patrol` → `chase` (within 3 cells) → `attack` (melee
  range). Leashes back to patrol beyond 5 cells.
- Stats: 60 HP (2 hits), 4.2 u/s speed, melee damage 10 per swing,
  1.2s attack cooldown.
- Walls block via the same `collidesWithAnyWall` math the player uses.
  Enemies also softly repel each other to prevent stacking.
- Dead enemies fade out over `ENEMY_DEATH_FADE_SEC` then get evicted
  from the runtime list.

**Mobile attack**: `LabyrinthMobileControls.tsx` now covers the full
screen. Left-half touches drive the movement joystick; right-half
taps fire the attack. Two-thumb play works — both touches track
independently via `moveTouchId` / `attackTouchId`.

**Remaining in Step 3** (not yet wired): Trap Spawners, Shadow
Stalkers, Warden mini-boss, XP/loot drops from kills.

**Invariant (continued):** same self-contained rule — combat/enemy
files live in `src/game/labyrinth/`, no imports from `GameScene.tsx`
or the main game's enemy/projectile code. The main game is untouched.

### Labyrinth Mode — Character Select + Shared Visual Layer (Step 3a-bis)

**Character picker.** Main menu → `labyrinth_charselect` (new phase) →
`LabyrinthCharSelect` (race → class → Begin). Writes
`selectedRace` + `selectedClass` + `difficultyTier="nightmare"` +
`trialMode=false` into the game store, then advances to `labyrinth`.
- Race picker uses `RACE_DATA` unlock gating (shared with main game).
- Class picker only enables Warrior via `LABYRINTH_CLASS_AVAILABLE`;
  Mage + Rogue show as "coming soon". Flipping a flag enables them.
- Difficulty is locked to nightmare (no picker).

**Shared visuals via shims.** The Labyrinth no longer uses procedural
placeholder meshes. Instead, a thin shim layer maps the labyrinth's
AI-focused runtimes to the main game's `PlayerRuntime` /
`EnemyRuntime` shape so the existing `Player3D` + `Enemy3D` renderers
can draw the scene unchanged.
- `LabyrinthShims.ts` — factories + per-frame updaters for the
  GameState/EnemyRuntime shims. Casts through `unknown` to avoid
  populating the entire (irrelevant) main-game surface area.
- `LabyrinthPlayer3D.tsx` — holds one GameState shim, syncs every
  frame from LabPlayer + PlayerAttackState, renders `<Player3D>`.
  Bumps `shim.player.attackTrigger` on swing edges so the weapon
  animation plays.
- `LabyrinthEnemy3D.tsx` — holds a shim map keyed by enemy id,
  syncs every frame from LabEnemy, renders `<Enemy3D>` per shim.
  Corridor Guardian → `"elite"` type (Voidclaw Champion visuals).

**Stats from CharacterData.** Combat stats come from
`CHARACTER_DATA[selectedClass]` (damage, attackRange, attackSpeed →
`1/attackSpeed` for cooldown). HP is `classDef.hp`. The old
`LAB_COMBAT_BASELINE` is gone from the scene; it stays exported from
`LabyrinthCombat.ts` as a reference for future tests.

**Still single attack mode.** All classes currently use the 120°
melee arc attack (warrior's native). Mage + Rogue are locked in
char-select until step 3a-bis-II wires up a projectile attack
pattern. The Player3D dispatch already handles all three classes'
visuals; only the combat pattern is warrior-only for now.

**Invariant (continued):** zero edits to `Player3D.tsx`, `Enemy3D.tsx`,
`GameScene.tsx`, or any main-game data file. Two new imports were
added to `App.tsx` (LabyrinthCharSelect) and `MainMenu.tsx`
(re-routed labyrinth button) — both are routing-only, no logic
changes to the main game.
