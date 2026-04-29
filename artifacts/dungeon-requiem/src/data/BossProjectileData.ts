/**
 * BossProjectileData.ts
 * Speed constants for boss + champion projectiles. Extracted from GameScene
 * so the GM/balance panel can override them at runtime and so balance changes
 * land in a data file rather than a 3000-line behavior file.
 *
 * radialBurst is indexed by enrage phase: [phase 0/1, phase 2, phase 3+].
 * warriorChampCrescent is the BASE speed; gameplay still adds
 * `e.enragePhase * 1.5` on top to keep the per-phase escalation fixed.
 */

export const BOSS_PROJECTILE_DATA = {
  radialBurst: [9, 10, 11] as [number, number, number],
  warriorChampCrescent: 8,
  mageChampOrb: 11,
  rogueChampDagger: 20,
};

export type BossProjectileKey = keyof typeof BOSS_PROJECTILE_DATA;
