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
