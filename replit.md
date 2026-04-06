# Dungeon Requiem

A 3D low-poly dark fantasy hack-and-slash game built with React Three Fiber.

## Architecture

### Tech Stack
- **Frontend**: React + Vite (TypeScript)
- **3D Engine**: Three.js via React Three Fiber (@react-three/fiber)
- **3D Helpers**: @react-three/drei (camera, controls)
- **Post-processing**: @react-three/postprocessing (Bloom, Vignette)
- **State Management**: Zustand (game UI state)
- **Game Logic**: Plain TypeScript classes (no React state for per-frame values)

### Directory Structure
```
artifacts/dungeon-requiem/src/
  App.tsx                    # Root component: manages phase transitions
  main.tsx                   # Vite entry point
  
  game/
    GameManager.ts           # Orchestrates all game logic each frame
    GameScene.tsx            # R3F Canvas + useFrame game loop
    InputManager3D.ts        # Keyboard/mouse input (no Phaser)
    CombatManager3D.ts       # Attack resolution, damage, crits, lifesteal
    SpawnManager3D.ts        # Enemy wave spawning
  
  entities/
    Player3D.tsx             # Low-poly warrior mesh + animations
    Enemy3D.tsx              # 5 enemy types (scuttler/brute/wraith/elite/boss)
    XPOrb3D.tsx              # Collectible XP orbs
  
  world/
    DungeonRoom.tsx          # Floor, walls, pillars, ceiling (procedural geometry)
    Torch3D.tsx              # Animated torches with flickering PointLights
  
  effects/
    AttackEffect.tsx         # Sword swing arc visual effect
  
  ui/
    HUD.tsx                  # React DOM overlay (HP/XP bars, wave info, upgrades)
    MainMenu.tsx             # Dark fantasy title screen
    GameOver.tsx             # End screen with stats
    LevelUp.tsx              # Upgrade selection (3 choices)
    PauseMenu.tsx            # ESC pause overlay
  
  store/
    gameStore.ts             # Zustand store for UI state
  
  data/
    GameConfig.ts            # 3D unit constants (arena=60x60, speeds in units/s)
    EnemyData.ts             # Enemy definitions (3D scaled)
    UpgradeData.ts           # 16 upgrade/passive abilities
    SaveData.ts              # localStorage save abstraction
  
  systems/
    ProgressionManager.ts    # XP curves, level-up, upgrade tracking
```

## Game Design

### World Scale
- Arena: 60×60 units (radius 30)
- Player: ~2 units tall
- Camera: Fixed isometric at ~28 units height, follows player with lerp

### Game Loop Architecture
- `GameManager.ts` is a singleton class instantiated in App.tsx via `useRef`
- `useFrame` in `GameScene.tsx` calls `manager.update(delta)` each frame
- Per-frame values (positions, velocities) live as plain TS object properties
- Zustand is updated every frame with key values for HUD rendering
- React components read from both zustand (UI) and manager refs (3D positions)

### Enemy AI
- Seek behavior: move toward player with separation from other enemies
- Each type has distinct 3D mesh, speed, health, attack range/interval
- Wave system: escalates every 20 seconds, spawn interval decreases

### Combat
- Attack arc: 120° in front of aim direction, 5 unit range
- Dash: invincibility frames, directional
- Crits, lifesteal, cleave, double-strike all working
- 16 stackable upgrades chosen on level-up

### Visual Features
- Low-poly procedural geometry for all characters and world
- 12 animated torch point lights around arena perimeter
- Bloom post-processing on emissive materials
- Fog for atmospheric depth
- ACES filmic tone mapping
- Enemy health bars (billboard, always face camera)
- Attack arc light flash effect

## Running the Game
The game runs as a Vite dev server. No build step needed for development.

**Controls:**
- WASD: Move
- Mouse: Aim
- LMB / Space: Attack
- Shift: Dash (invincible)
- ESC: Pause
