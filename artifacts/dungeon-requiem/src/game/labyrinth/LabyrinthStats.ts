/**
 * LabyrinthStats.ts
 *
 * Resolves the labyrinth player's starting stats by composing the
 * same pipeline the main game uses (GameScene.tsx:264-293,
 * makeProgWithMeta), so Soul Forge and Trial of Champions buffs
 * carry into labyrinth runs.
 *
 * Pipeline (identical to main game):
 *
 *   1. Start from createDefaultStats() baseline (main-game defaults
 *      for unspecified fields — critDamageMultiplier, etc.).
 *   2. Overlay the selected class's base values from CHARACTER_DATA
 *      (hp, damage, attackSpeed, moveSpeed, armor, dashCooldown,
 *      critChance, attackRange).
 *   3. Apply race multipliers from RACE_DATA. Race multipliers are
 *      currently at identity (visual-only pass) but the architecture
 *      stays live for post-Alpha racial bonuses.
 *   4. Run buildMetaModifiers(purchased) → all owned Soul Forge
 *      ranks become StatModifier[] entries.
 *   5. Run buildTrialModifiers(trialWins) → Trial of Champions
 *      clears become flat-stat buffs.
 *   6. resolveStats(classBase, [...metaMods, ...trialMods]) returns
 *      the final composed PlayerStats.
 *
 * Unbalancing upgrades audit (per item 3 spec):
 *   All 12 Soul Forge upgrades in MetaUpgradeData.ts are FLAT per-rank
 *   bonuses (Honed Edge, Swift Strikes, Iron Soul, Troll Marrow, etc.).
 *   NONE are wave-relative or tuned around the main-game's 100-wave
 *   arc, so they translate cleanly to labyrinth's time-based 8-min
 *   run. Nothing to exclude. If the balance ever feels wrong in play,
 *   the exclusion list goes right here as a Set<string> of upgrade IDs.
 *
 * Read-only — no main-game file edits; imports from
 * src/data/{StatModifier,MetaUpgradeData,UpgradeData}.ts and
 * src/data/{CharacterData,RaceData}.ts.
 */

import type { CharacterClass } from "../../data/CharacterData";
import { CHARACTER_DATA } from "../../data/CharacterData";
import type { RaceType } from "../../data/RaceData";
import { RACE_DATA } from "../../data/RaceData";
import { buildMetaModifiers, buildTrialModifiers } from "../../data/MetaUpgradeData";
import { resolveStats } from "../../data/StatModifier";
import { createDefaultStats, type PlayerStats } from "../../data/UpgradeData";
import { useMetaStore } from "../../store/metaStore";

/** Resolve the labyrinth player's starting stats. Mirrors the main
 *  game's makeProgWithMeta() resolution step but skips the
 *  ProgressionManager wrapping — labyrinth uses its own per-run
 *  progression (LabProgressionState). Call ONCE at scene mount;
 *  stats are stable for the lifetime of the run. */
export function resolveLabPlayerStats(
  cls: CharacterClass,
  race: RaceType,
): PlayerStats {
  const def = CHARACTER_DATA[cls];
  const raceDef = RACE_DATA[race];

  // Class + race base — identical math to GameScene.tsx:268-282.
  const classBase: PlayerStats = {
    ...createDefaultStats(),
    maxHealth: Math.round(def.hp * raceDef.hpMult),
    currentHealth: Math.round(def.hp * raceDef.hpMult),
    damage: Math.round(def.damage * raceDef.damageMult),
    attackSpeed: parseFloat((def.attackSpeed * raceDef.attackSpeedMult).toFixed(3)),
    moveSpeed: parseFloat((def.moveSpeed * raceDef.moveSpeedMult).toFixed(3)),
    armor: Math.max(0, def.armor + raceDef.armorBonus),
    dashCooldown: def.dashCooldown,
    critChance: Math.min(0.95, def.critChance + raceDef.critBonus),
    attackRange: def.attackRange,
    critDamageMultiplier: cls === "rogue" ? 2.0 : 1.85,
    healthRegen: cls === "mage" ? 1.0 : 0.5,
  };

  // Soul Forge + Trial buffs — read directly from the meta store
  // (persisted purchases + trial-clear history). Same helpers the
  // main game uses. If the player has no Soul Forge ranks or trial
  // wins, these arrays are empty and resolveStats is a no-op copy.
  const metaMods = buildMetaModifiers(useMetaStore.getState().purchased);
  const trialMods = buildTrialModifiers(useMetaStore.getState().trialWins);

  const resolved = resolveStats(classBase, [...metaMods, ...trialMods]);
  resolved.maxHealth = Math.round(resolved.maxHealth);
  resolved.currentHealth = resolved.maxHealth;
  resolved.damage = Math.round(resolved.damage);
  return resolved;
}
