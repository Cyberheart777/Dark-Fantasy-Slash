/**
 * balanceStore.ts
 * Session-only override layer for live game-balance tuning via the GM panel.
 *
 * The store holds *only the deltas* from baked-in defaults. Getter helpers
 * merge overrides onto the canonical data files (CHARACTER_DATA, ENEMY_DATA,
 * SPAWN_TABLE, GAME_CONFIG, BOSS_PROJECTILE_DATA) so call sites in GameScene
 * read live values without caring whether an override exists.
 *
 * No persist middleware — overrides reset on reload. The Export button in
 * DevBalancePanel serialises the diff to a snippet you paste into chat;
 * permanent changes go through git, not localStorage.
 */

import { create } from "zustand";
import { CHARACTER_DATA, type CharacterClass, type CharacterDef } from "../data/CharacterData";
import { ENEMY_DATA, SPAWN_TABLE, type EnemyType, type EnemyDef } from "../data/EnemyData";
import { GAME_CONFIG } from "../data/GameConfig";
import { BOSS_PROJECTILE_DATA } from "../data/BossProjectileData";

type CharacterOverride = Partial<Pick<CharacterDef,
  "hp" | "damage" | "attackSpeed" | "moveSpeed" | "armor" | "dashCooldown" | "critChance" |
  "attackRange" | "projectileSpeed" | "projectileCount" | "projectileSpread" |
  "projectileRadius" | "projectileLifetime"
>>;

type EnemyOverride = Partial<Pick<EnemyDef,
  "health" | "damage" | "moveSpeed" | "xpReward" | "attackRange" |
  "attackInterval" | "collisionRadius" | "scoreValue"
>>;

type PlayerOverride = {
  invincibilityTime?: number;
  invMultMelee?: number; // base ×1.0 sites (generic melee, boss slam, warrior champ slam)
  invMultSlam?: number;  // base ×0.8 (elite ground slam)
  invMultProj?: number;  // base ×0.6 (enemy projectile hit)
  dashIframeBonus?: Partial<Record<CharacterClass, number>>; // per-class extra seconds on top of DASH_DURATION
};

type BossProjOverride = Partial<{
  radialBurst: [number, number, number];
  warriorChampCrescent: number;
  mageChampOrb: number;
  rogueChampDagger: number;
}>;

export interface BalanceState {
  characters: Partial<Record<CharacterClass, CharacterOverride>>;
  enemies: Partial<Record<EnemyType, EnemyOverride>>;
  spawnWeights: Partial<Record<number, Partial<Record<EnemyType, number>>>>;
  player: PlayerOverride;
  bossProj: BossProjOverride;

  setCharacter: (cls: CharacterClass, patch: CharacterOverride) => void;
  setEnemy: (type: EnemyType, patch: EnemyOverride) => void;
  setSpawnWeight: (tier: number, type: EnemyType, weight: number) => void;
  setPlayer: (patch: PlayerOverride) => void;
  setDashIframeBonus: (cls: CharacterClass, value: number) => void;
  setBossProj: (patch: BossProjOverride) => void;
  resetAll: () => void;
}

export const useBalanceStore = create<BalanceState>((set) => ({
  characters: {},
  enemies: {},
  spawnWeights: {},
  player: {},
  bossProj: {},

  setCharacter: (cls, patch) =>
    set((s) => ({
      characters: { ...s.characters, [cls]: { ...s.characters[cls], ...patch } },
    })),
  setEnemy: (type, patch) =>
    set((s) => ({
      enemies: { ...s.enemies, [type]: { ...s.enemies[type], ...patch } },
    })),
  setSpawnWeight: (tier, type, weight) =>
    set((s) => ({
      spawnWeights: {
        ...s.spawnWeights,
        [tier]: { ...s.spawnWeights[tier], [type]: weight },
      },
    })),
  setPlayer: (patch) => set((s) => ({ player: { ...s.player, ...patch } })),
  setDashIframeBonus: (cls, value) =>
    set((s) => ({
      player: {
        ...s.player,
        dashIframeBonus: { ...s.player.dashIframeBonus, [cls]: value },
      },
    })),
  setBossProj: (patch) => set((s) => ({ bossProj: { ...s.bossProj, ...patch } })),
  resetAll: () =>
    set({ characters: {}, enemies: {}, spawnWeights: {}, player: {}, bossProj: {} }),
}));

// ── Getters: merge overrides onto baked defaults ───────────────────────────

export function getCharacter(cls: CharacterClass): CharacterDef {
  const base = CHARACTER_DATA[cls];
  const ov = useBalanceStore.getState().characters[cls];
  return ov ? { ...base, ...ov } : base;
}

export function getEnemy(type: EnemyType): EnemyDef {
  const base = ENEMY_DATA[type];
  const ov = useBalanceStore.getState().enemies[type];
  return ov ? { ...base, ...ov } : base;
}

/** Drop-in replacement for pickEnemyType that respects spawn-weight overrides. */
export function pickEnemyTypeBalanced(wave: number): EnemyType {
  const tier = Math.min(Math.floor((wave - 1) / 2), SPAWN_TABLE.length - 1);
  const base = SPAWN_TABLE[tier];
  const overrides = useBalanceStore.getState().spawnWeights[tier] ?? {};
  const table: Array<[EnemyType, number]> = base.map(([type, w]) => [
    type,
    overrides[type] ?? w,
  ]);
  const totalWeight = table.reduce((sum, [, w]) => sum + w, 0);
  if (totalWeight <= 0) return base[0][0]; // safety: don't divide by zero
  let rand = Math.random() * totalWeight;
  for (const [type, weight] of table) {
    rand -= weight;
    if (rand <= 0) return type;
  }
  return base[0][0];
}

export type IframeKind = "melee" | "slam" | "proj";

export function getInvTime(kind: IframeKind): number {
  const p = useBalanceStore.getState().player;
  const base = p.invincibilityTime ?? GAME_CONFIG.PLAYER.INVINCIBILITY_TIME;
  const mult =
    kind === "melee" ? (p.invMultMelee ?? 1.0) :
    kind === "slam"  ? (p.invMultSlam  ?? 0.8) :
    /* proj */         (p.invMultProj  ?? 0.6);
  return base * mult;
}

const DEFAULT_DASH_BONUS: Record<CharacterClass, number> = {
  warrior: 0.15,
  mage: 0.15,
  rogue: 0.05,
  necromancer: 0.15,
  bard: 0.15,
  death_knight: 0.15,
};

export function getDashIframeBonus(cls: CharacterClass): number {
  const ov = useBalanceStore.getState().player.dashIframeBonus?.[cls];
  return ov ?? DEFAULT_DASH_BONUS[cls];
}

export function getBossProjSpeed(
  key: "radialBurst",
  phase: number
): number;
export function getBossProjSpeed(
  key: "warriorChampCrescent" | "mageChampOrb" | "rogueChampDagger"
): number;
export function getBossProjSpeed(
  key: keyof typeof BOSS_PROJECTILE_DATA,
  phase?: number
): number {
  const ov = useBalanceStore.getState().bossProj;
  if (key === "radialBurst") {
    const arr = ov.radialBurst ?? BOSS_PROJECTILE_DATA.radialBurst;
    const idx = (phase ?? 0) >= 3 ? 2 : (phase ?? 0) >= 2 ? 1 : 0;
    return arr[idx];
  }
  return (ov[key] as number | undefined) ?? BOSS_PROJECTILE_DATA[key];
}

// ── Export: serialise the current diff for paste-back to chat ──────────────

/** Returns a paste-ready TS-style snippet of only the changed values. */
export function diffSnapshot(): string {
  const s = useBalanceStore.getState();
  const blocks: string[] = ["// === BALANCE OVERRIDES — paste back to me ==="];

  // Characters
  for (const cls of Object.keys(s.characters) as CharacterClass[]) {
    const ov = s.characters[cls];
    if (ov && Object.keys(ov).length > 0) {
      blocks.push(`// CHARACTER_DATA.${cls}`);
      blocks.push(formatObj(ov));
    }
  }

  // Enemies
  for (const type of Object.keys(s.enemies) as EnemyType[]) {
    const ov = s.enemies[type];
    if (ov && Object.keys(ov).length > 0) {
      blocks.push(`// ENEMY_DATA.${type}`);
      blocks.push(formatObj(ov));
    }
  }

  // Spawn weights
  for (const tierStr of Object.keys(s.spawnWeights)) {
    const tier = Number(tierStr);
    const ov = s.spawnWeights[tier];
    if (ov && Object.keys(ov).length > 0) {
      const waveLo = tier * 2 + 1;
      const waveHi = tier * 2 + 2;
      blocks.push(`// SPAWN_TABLE[${tier}]  (waves ${waveLo}-${waveHi})`);
      blocks.push(formatObj(ov));
    }
  }

  // Player iframes
  if (Object.keys(s.player).length > 0) {
    blocks.push(`// GAME_CONFIG.PLAYER + iframe multipliers`);
    blocks.push(formatObj(s.player));
  }

  // Boss projectiles
  if (Object.keys(s.bossProj).length > 0) {
    blocks.push(`// BOSS_PROJECTILE_DATA`);
    blocks.push(formatObj(s.bossProj));
  }

  blocks.push("// === END ===");
  return blocks.join("\n");
}

function formatObj(o: object): string {
  const parts = Object.entries(o).map(([k, v]) => {
    if (Array.isArray(v)) return `  ${k}: [${v.join(", ")}]`;
    if (v && typeof v === "object") return `  ${k}: ${JSON.stringify(v)}`;
    return `  ${k}: ${v}`;
  });
  return `{\n${parts.join(",\n")}\n}`;
}

export const DEFAULT_DASH_IFRAME_BONUS = DEFAULT_DASH_BONUS;
