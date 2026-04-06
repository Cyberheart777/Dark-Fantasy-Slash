# Dungeon Requiem

A dark fantasy survival hack-and-slash built on Phaser 3 — architected from day one for a future Steam release.

---

## How to Run in Browser

```bash
pnpm --filter @workspace/dungeon-requiem run dev
```

Open `http://localhost:22112` (or the assigned port shown in terminal).

### Controls
| Key | Action |
|-----|--------|
| WASD | Move |
| Mouse | Aim |
| SPACE | Attack |
| SHIFT | Dash |
| ESC | Pause |

---

## Path to Steam Release

This prototype was built to minimize rework when targeting Steam.

### What's already built for Steam

| System | Status | Notes |
|--------|--------|-------|
| Input abstraction layer | ✅ Done | `InputManager.ts` — add gamepad driver here |
| Save/load abstraction | ✅ Done | `SaveData.ts` — swap `localStorageBackend` for `fsBackend` |
| Data-driven enemies | ✅ Done | `EnemyData.ts` — JSON-loadable |
| Data-driven upgrades | ✅ Done | `UpgradeData.ts` — JSON-loadable |
| Resolution scaling | ✅ Done | Phaser `Scale.FIT` + `CENTER_BOTH` |
| Modular scene architecture | ✅ Done | Each scene is a standalone class |
| Audio manager with volume | ✅ Done | `AudioManager.ts` |
| Settings persistence | ✅ Done | `SettingsScene.ts` + `SaveData.ts` |
| Pause/resume system | ✅ Done | Full pause menu with settings |
| Game over + run summary | ✅ Done | Score, time, level, kills |
| High score tracking | ✅ Done | Last 10 runs + best score |
| No browser-only dependencies | ✅ Done | Only Phaser 3 + React shell |
| Performance-optimized | ✅ Done | Manual update loop, no physics overhead |

### Wrapping for Desktop (Electron)

```bash
npm install --save-dev electron electron-builder
```

Create `electron/main.js`:
```javascript
const { app, BrowserWindow } = require('electron');
const path = require('path');

app.whenReady().then(() => {
  const win = new BrowserWindow({ width: 1280, height: 720, fullscreen: false });
  win.loadFile(path.join(__dirname, '../dist/public/index.html'));
});
```

In `GameInstance.ts`, change:
```typescript
mode: Phaser.Scale.RESIZE  // Instead of FIT
```

Then swap `localStorageBackend` in `SaveData.ts` for:
```typescript
import fs from 'fs';
const fsBackend = {
  load() { try { return JSON.parse(fs.readFileSync('save.json', 'utf8')); } catch { return null; } },
  save(data) { fs.writeFileSync('save.json', JSON.stringify(data)); },
  clear() { if (fs.existsSync('save.json')) fs.unlinkSync('save.json'); },
};
```

### Wrapping for Desktop (Tauri)

```bash
npm create tauri-app
```

Use `tauri-plugin-store` for save data instead of `localStorage`. The `StorageBackend` interface in `SaveData.ts` is already designed to accept this swap.

---

## Top 10 Improvements Before Commercial Release

1. **Replace procedural graphics with professional sprite art**
   All entities currently use Phaser geometry. Replace with spritesheets and animations via `PreloadScene.ts`. The `Enemy.ts` and `Player.ts` constructors are already structured to accept spritesheet keys.

2. **Add real audio — music + SFX**
   `AudioManager.ts` is fully wired. Add `.ogg`/`.mp3` files under `assets/audio/` and load them in `PreloadScene.ts`. All keys are already defined in `AudioManager.ts`.

3. **Controller / Steam Deck support**
   Add a gamepad polling loop in `InputManager.ts` inside the `updateGamepad()` stub. Map `axes[0]`/`axes[1]` to `moveX`/`moveY` and buttons to attack/dash/pause. The `ActionState` interface is already controller-ready.

4. **Fullscreen and resolution options**
   Change `Phaser.Scale.FIT` to `Phaser.Scale.RESIZE` and add a resolution picker in `SettingsScene.ts`. Support 1080p, 1440p, and ultrawide.

5. **Meta-progression / persistent unlocks**
   Add an `unlocks` section to `GameSaveData`. The save system already persists across sessions — extend it with a currency (e.g., "soul shards") and an out-of-run upgrade screen.

6. **Additional enemy types and a real boss fight**
   `EnemyData.ts` is fully extensible. Add boss phases, projectile attacks, and special behaviors as separate enemy update methods. The spawn table is weight-driven — just add rows.

7. **Stage / dungeon room mode**
   The game architecture supports multiple game modes. Add a `mode` parameter to `GameScene.init()` and fork the update loop for stage-based play. Room transitions can be added as a separate scene.

8. **Polish: particle effects, screen flash, hit stop**
   Add a `EffectsManager.ts` using Phaser's particle system for blood splatter, XP trail, and screen flash on kill. Hit stop (1-3 frame pause) on heavy hits significantly improves game feel.

9. **Accessibility options**
   Add colorblind-friendly palettes, larger UI text option, and reduced-motion mode to `SettingsScene.ts`. These are meaningful for a Steam release and straightforward to add.

10. **Steam SDK integration (Steamworks)**
    Add `greenworks` (Node.js Steamworks wrapper) to the Electron build. Hook achievements in `GameOverScene.ts` (e.g., "Survived 10 minutes") and cloud saves via `setStorageBackend()` in `SaveData.ts`.

---

## Folder Structure

```
src/
  data/           — Config, enemy/upgrade/save data (data-driven, Steam-portable)
  entities/       — Player, Enemy (composable game objects)
  scenes/         — Phaser scenes: Boot, Preload, MainMenu, Game, GameOver, Pause, Settings, LevelUp
  systems/        — InputManager, CombatManager, ProgressionManager, SpawnManager, AudioManager
  ui/             — HUD (UIScene), DamagePopup
  game/           — GameInstance (Phaser bootstrap)
  App.tsx         — React shell (can be removed for native desktop builds)
```

---

## Architecture Notes for Porting

- **No browser APIs are used directly** — `localStorage` is isolated behind `StorageBackend` in `SaveData.ts`
- **Input is abstracted** — game logic reads `ActionState`, never raw keyboard/mouse
- **All constants are in `data/GameConfig.ts`** — can be loaded from a JSON file
- **Scenes are modular** — each scene can be tested in isolation
- **Audio is hookable** — `AudioManager.ts` wraps all sound calls
