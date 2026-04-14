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

### Labyrinth Mode — Step 3a-bis-II (visibility + dash + reused assets)

**Dash.** Class-agnostic dash module lives in
`src/game/labyrinth/LabyrinthDash.ts` (constants copied from
`GameConfig.PLAYER`: `LAB_DASH_SPEED = 22`, `LAB_DASH_DURATION = 0.18`).
Cooldown per-class from `CHARACTER_DATA[class].dashCooldown`
(warrior 2.2 / mage 2.4 / rogue 1.2). `MovementLoop` consumes
`input.state.dash`, overrides joystick velocity while `timer > 0`,
and sets `LabPlayer.isDashing` so the character leans forward. Mobile
gets a dedicated `↯` touch button next to the `⚔` attack button
(`LabyrinthMobileControls.tsx`, separate `dashTouchId` for concurrent
multi-touch). Desktop binds Shift.

**Reused main-game assets via shims (zero core edits).** The labyrinth
now pulls in six main-game systems via adapter modules:

- **Audio** (`src/audio/AudioManager.ts`) — imported directly; called
  from combat/dash/defeat paths for `attack_melee`, `enemy_death`,
  `player_hurt`, `player_death`, `dash`, `xp_pickup`, `level_up`.
- **DeathFx** — ported (not imported) into `LabyrinthDeathFx.ts` +
  `LabyrinthDeathFx3D.tsx`. Matches the main game's 7-puff + flash
  tuning 1:1 (`GameScene.tsx:227-235` / `:2701-2772`). Ported
  because `DeathFx3D` isn't exported from `GameScene`.
- **GroundEffect** — ported into `LabyrinthGroundFx.ts` +
  `LabyrinthGroundFx3D.tsx`. Spawns short-lived toxic-green mist
  pools under the player while outside the safe zone; visual-only
  (damage is still handled by `LabyrinthPoison`).
- **XPOrb3D** — imported directly from `src/entities/XPOrb3D.tsx`
  (this one IS exported). Orbs drop on guardian kill via
  `spawnLabXpOrb`, tier-weighted 70% blue / 20% green / 10% purple.
  Pickup radius 3u. Collection plays `xp_pickup`.
- **Labyrinth-local progression** (`LabyrinthProgression.ts`) —
  mirrors `ProgressionManager`'s XP formula
  (`BASE=70, EXP=1.45, per-10 ×1.15`) without importing the class
  (which is coupled to upgrade-pick UI + meta-store). Level-up
  grants +3 maxHp and a full heal, plays `level_up`.
- **Warrior passives** (`LabyrinthWarrior.ts`) — crits (5% × 2×
  from `CharacterData.ts:54`), Blood Momentum (+3%/stack to 20
  stacks, 3s reset), Bloodforge (+1 maxHp/kill cap 20), auto War
  Cry (+25% dmg for 4s at <30% HP, 20s cooldown). Gated on
  `charClass === "warrior"`; mage/rogue take the base damage path.
  HUD shows Blood Momentum pip row + War Cry state + Bloodforge
  progress under the XP bar.

**Visibility fallback.** `LabyrinthPlayer3D` (shim → `Player3D`
→ warrior GLB) is temporarily commented-out in
`LabyrinthScene.tsx`. In its place, `GeoCharacter` — a procedural
humanoid warrior built entirely from `meshBasicMaterial` primitives
with `depthWrite={false}` on every part. Uses the same walk cycle
and swing animation pattern as the main game's
`WarriorMeshAnimated` (`Player3D.tsx:192-278`). Robust to iOS
Safari quirks that broke the PBR/shadow path. Re-enable the GLB
on top once we confirm the stand-in renders reliably; the
GeoCharacter then stays as the always-on safety net.

**Scene lighting.** `Canvas` no longer has `shadows`; all
`castShadow`/`receiveShadow` props removed. Ambient bumped
(`0.85 → 1.6`), hemisphere fill added (`0.9`), directional
(`1.3 → 2.2`), torch (`2.2 → 4.5`, reach `24 → 36`). Floor and
walls got modest emissive so they read clearly without direct
light. Fixes iOS Safari's dark-scene rendering issue.

**Diagnostics.** `LabyrinthDebug.tsx` renders a fixed HTML overlay
outside the Canvas (gated by `?debug=1`) with live player
position/HP, swing + dash timers, zone state, enemy/kill counts,
and a red `CANVAS ERRORS` block populated from
`LabyrinthCanvasErrorBoundary.LAB_ERROR_LOG`. Map3D / Zone3D /
Portals3D are now each wrapped in their own error boundary with
`null` fallback so a subsystem crash can't blank the scene.

**Invariant (continued):** every file touched in this step is under
`src/game/labyrinth/` — `git diff --stat main..HEAD` confirms.
`Player3D.tsx`, `Enemy3D.tsx`, `XPOrb3D.tsx`, `AudioManager.ts`,
`InputManager3D.ts`, `GameScene.tsx`, all `data/*` tables, are
untouched. Main dungeon / trial / boss modes are behaviourally
identical to pre-change.

### Labyrinth Mode — Step 4 (Full Roster)

The Labyrinth's originally-spec'd roster — 4 enemy types, traps, loot,
boss, and all three classes — now exists. Nine discrete commits under
`src/game/labyrinth/`, zero core-game edits.

**Projectile system** (`LabyrinthProjectile.ts` + `LabyrinthProjectile3D.tsx`).
`LabProjectile` matches the main game's `Projectile` interface
field-for-field plus an `owner: "player" | "enemy"` discriminator, so
`Projectile3D` can render shim projectiles via a structural cast
(no renderer edits). `tickLabProjectiles` handles wall collision,
enemy-circle hit for player-owned, player-circle hit for enemy-owned,
and accumulates damage into the shared `dmgAccum`. Feeds from: wall
traps, turret enemies, warden starburst, mage orbs, rogue daggers.

**Wall traps** (`LabyrinthTrap.ts` + `LabyrinthTrap3D.tsx`). Six
corridor cells with walls on exactly two opposite sides become
beam traps: warn (0.8s, red pulsing anchor cubes) → fire (0.25s,
fat orb travelling cross-corridor) → cooldown (2.2-3.5s randomised
so the maze doesn't pulse in sync). 30 damage. `WALL_TRAP_COUNT=6`
in `LabyrinthConfig.ts`.

**Loot chests** (`LabyrinthChest.ts` + `LabyrinthChest3D.tsx`). Ten
chests at dead-end cells. Kinds weighted:
- **60% treasure** — 3–5 XP orbs + 10 HP heal, `gear_drop` SFX.
- **25% trapped** — poison puddle (`LabGroundFx`) + 2 poison stacks
  on the player, `boss_special` SFX.
- **15% mimic** — 0.35s reveal animation, then converts to a fast
  melee enemy (kind `mimic`, mapped to `scuttler` visual). `boss_spawn`
  SFX.

Interaction is proximity-only (1.5u). Reveal glow colour is the tell:
gold/green/red. All chest visuals use `meshBasicMaterial` +
`depthWrite={false}` so they survive iOS PBR weirdness.

**Enemy roster** (`LabyrinthEnemy.ts` extended with 4 new `EnemyKind`s).

| Kind | HP | Speed | Attack | Shim maps to |
|------|----|-------|--------|--------------|
| corridor_guardian | 60 | 4.2 | melee 10 dmg @ 1.2s | elite |
| trap_spawner (turret) | 80 | 0 (stationary) | ranged 15 dmg orb @ 1.8s | wraith |
| mimic (from chest) | 60 | 4.5 | melee 18 dmg @ 1.0s | scuttler |
| shadow_stalker | 40 | 5.5 | melee 20 dmg @ 0.9s | wraith |
| warden (boss) | 800 | 3.0 (4.5 enraged) | melee 35 dmg + starburst + minions | boss |

Corridor Guardian + Mimic + Shadow Stalker share the patrol/chase/
attack state machine via a per-kind tuning object. Trap Spawner has
its own stationary-turret AI with line-of-sight raycasting. Shadow
Stalker flips the shim's `phasing` / `phaseTimer` fields when far from
player so the main-game wraith renderer draws it semi-transparent —
snaps to opaque at `STALKER_REVEAL_DIST` (1.5 cells). Only one stalker
alive at a time; spawns every `SHADOW_STALKER_INTERVAL_SEC` (45s) at
the farthest dead-end from the player.

**Warden boss** (`LabyrinthWarden.ts`). Spawns once per run at the
centre 3×3 chamber, gated by elapsed time (>=5min) AND zone radius
(<50% initial). Three-phase AI:
- Phase 1 (>66% HP): chase + melee, 35 dmg / 1.6s cd.
- Phase 2 (33-66%): adds a 0.6s-telegraphed 8-projectile starburst
  every 5s (22 dmg per orb).
- Phase 3 (<33%): enrage — speed +50%, summons 2 corridor guardian
  minions every 10s.

Killing the warden sets `shared.victory = true` → new ⚔ WARDEN SLAIN
end screen variant (distinct from ⬭ EXTRACTED portal win).

**Mage + rogue ranged unlock** (`LabyrinthRangedAttack.ts`). Both
classes now selectable in `LabyrinthCharSelect.tsx`. Attack dispatch
in `CombatEnemyLoop` branches on `charClass`:
- Warrior — existing melee arc (unchanged).
- Mage — piercing arcane orb, 20 dmg, 0.95s cd, `attack_orb` SFX.
- Rogue — 3-dagger fan, 12 dmg each, 0.6s cd, `attack_dagger` SFX.

Projectile kills route through the same on-kill callback as warrior
swings (XP orbs, death FX, warden-victory detection).

**Warrior GLB re-enabled.** `LabyrinthPlayer3D` now mounts on top of
the procedural robot-man `GeoCharacter` (the always-on safety net).
If the GLB pipeline throws, the error boundary swallows it and the
robot-man stays visible. Mage + rogue get their main-game procedural
meshes from the same `Player3D` dispatch.

**Invariant (continued):** `git log --name-only main..HEAD` for the
step-4 commits (A–I) lists only files under
`artifacts/dungeon-requiem/src/game/labyrinth/` (+ this doc for step
I). `src/entities/Projectile3D.tsx`, `src/entities/XPOrb3D.tsx`,
`src/entities/Enemy3D.tsx`, `src/entities/Player3D.tsx`,
`src/audio/AudioManager.ts`, `src/game/GameScene.tsx`, and every
`src/data/*` table are untouched. Main dungeon / trial / boss modes
are behaviourally identical to pre-change.

