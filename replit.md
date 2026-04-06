# Workspace

## Overview

pnpm workspace monorepo using TypeScript. Contains a full Phaser 3 dark fantasy
survival action RPG ("Dungeon Requiem") built as a Steam-ready vertical slice prototype.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **API framework**: Express 5 (api-server artifact, minimal use)
- **Database**: PostgreSQL + Drizzle ORM (lib/db — not used by game)
- **Game engine**: Phaser 3 (dungeon-requiem artifact)
- **Game framework**: React + Vite (shell wrapper only)

## Artifacts

### dungeon-requiem (primary — at root `/`)
Full top-down hack-and-slash survival RPG.

**Game architecture:**
```
src/
  assets/         — PixelArtGenerator.ts (procedural 16-bit sprite + tile generation)
  data/           — GameConfig, EnemyData, UpgradeData, SaveData
  entities/       — Player (sprite+anim), Enemy (sprite+anim)
  scenes/         — Boot, Preload, MainMenu, Game, GameOver, Pause, Settings, LevelUp
  systems/        — InputManager, CombatManager, ProgressionManager, SpawnManager, AudioManager
  ui/             — HUD (UIScene), DamagePopup
  game/           — GameInstance (Phaser bootstrap)
```

**Key systems:**
- `InputManager.ts` — input abstraction (keyboard/mouse; gamepad stub ready)
- `SaveData.ts` — save/load abstraction with swappable `StorageBackend`
- `EnemyData.ts` — data-driven enemy definitions (4 archetypes + boss)
- `UpgradeData.ts` — data-driven upgrade system (17 upgrades)
- `CombatManager.ts` — hit detection, crit, armor, lifesteal
- `ProgressionManager.ts` — XP, leveling, upgrade application
- `SpawnManager.ts` — wave escalation, spawn rate scaling

### api-server (supporting — at `/api`)
Minimal Express 5 server. Not actively used by the game in v0.1.

## Key Commands

- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/dungeon-requiem run dev` — run game locally
- `pnpm --filter @workspace/api-server run dev` — run API server locally

## Controls (In-Game)
- WASD — Move
- Mouse — Aim
- SPACE — Attack (hold to auto-attack)
- SHIFT — Dash
- ESC — Pause

## Steam Portability
See `artifacts/dungeon-requiem/README.md` for the full "Path to Steam Release" guide and
"Top 10 Improvements Before Commercial Release" section.
