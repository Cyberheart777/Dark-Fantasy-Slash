/**
 * DevBalancePanel.tsx
 * In-game GM/balance panel. Activated by the same `?dev=1` query param as
 * DevHUD. Backtick (`) toggles visibility on/off while the gate is open.
 *
 * Sliders mutate `balanceStore` overrides which feed live into GameScene
 * via getter helpers (getCharacter, getEnemy, pickEnemyTypeBalanced,
 * getInvTime, getBossProjSpeed, getDashIframeBonus).
 *
 * EXPORT button copies a paste-ready snippet to the clipboard. User pastes
 * it back into chat and Claude commits the changes to data files. RESET ALL
 * clears all overrides (gameplay reverts to baked defaults instantly).
 */

import { useEffect, useState } from "react";
import { CHARACTER_DATA, type CharacterClass } from "../data/CharacterData";
import { ENEMY_DATA, SPAWN_TABLE, type EnemyType } from "../data/EnemyData";
import { GAME_CONFIG } from "../data/GameConfig";
import { BOSS_PROJECTILE_DATA } from "../data/BossProjectileData";
import {
  useBalanceStore,
  diffSnapshot,
  DEFAULT_DASH_IFRAME_BONUS,
} from "../store/balanceStore";
import { DevSlider } from "./DevSlider";

/**
 * Two ways in: `?dev=1` query param OR `localStorage.devMode === "1"` (set
 * via the password unlock on the main menu). The localStorage flag is
 * sticky across reloads on this device.
 */
const DEV_ENABLED =
  typeof window !== "undefined" &&
  (new URLSearchParams(window.location.search).get("dev") === "1" ||
    localStorage.getItem("devMode") === "1");

type Tab = "player" | "enemies" | "spawn" | "iframes" | "boss";

const PLAYER_TUNABLE_KEYS = [
  "hp", "damage", "attackSpeed", "moveSpeed", "armor", "dashCooldown", "critChance",
  "attackRange", "projectileSpeed", "projectileCount", "projectileSpread",
  "projectileRadius", "projectileLifetime",
] as const;

const ENEMY_TUNABLE_KEYS = [
  "health", "damage", "moveSpeed", "xpReward", "attackRange",
  "attackInterval", "collisionRadius", "scoreValue",
] as const;

export function DevBalancePanel() {
  if (!DEV_ENABLED) return null;
  return <Inner />;
}

function Inner() {
  // Start hidden so the small hint shows in the top-left rather than the
  // panel covering the page on load. Click hint or press ` to open.
  const [visible, setVisible] = useState(false);
  const [tab, setTab] = useState<Tab>("player");
  const [playerCls, setPlayerCls] = useState<CharacterClass>("warrior");
  const [enemyType, setEnemyType] = useState<EnemyType>("scuttler");
  const [spawnTier, setSpawnTier] = useState(0);
  const [toast, setToast] = useState<string | null>(null);

  // Backtick toggles visibility. Avoid intercepting input fields.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code !== "Backquote") return;
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA")) return;
      setVisible((v) => !v);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  if (!visible) {
    return (
      <div style={styles.hint} onClick={() => setVisible(true)}>
        ` to open balance panel
      </div>
    );
  }

  const handleExport = async () => {
    const snippet = diffSnapshot();
    try {
      await navigator.clipboard.writeText(snippet);
      setToast("Copied — paste in chat");
    } catch {
      setToast("Clipboard blocked — see console");
      console.log(snippet);
    }
    setTimeout(() => setToast(null), 2200);
  };

  const handleReset = () => {
    if (confirm("Reset ALL balance overrides?")) {
      useBalanceStore.getState().resetAll();
    }
  };

  const handleDisableDev = () => {
    if (confirm("Disable dev mode? Panel + DevHUD will hide until you re-enable from the main menu.")) {
      localStorage.removeItem("devMode");
      // Clear ?dev=1 too so a hard refresh actually hides the panel
      const url = new URL(window.location.href);
      url.searchParams.delete("dev");
      window.location.href = url.toString();
    }
  };

  return (
    <div style={styles.panel}>
      <div style={styles.header}>
        <span style={styles.title}>BALANCE</span>
        <button style={styles.btn} onClick={handleExport}>EXPORT</button>
        <button style={styles.btn} onClick={handleReset}>RESET</button>
        <button style={styles.btn} onClick={handleDisableDev}>DISABLE DEV</button>
        <button style={styles.btn} onClick={() => setVisible(false)}>×</button>
      </div>

      <div style={styles.tabs}>
        {(["player", "enemies", "spawn", "iframes", "boss"] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            style={{
              ...styles.tab,
              ...(tab === t ? styles.tabActive : {}),
            }}
          >
            {t.toUpperCase()}
          </button>
        ))}
      </div>

      <div style={styles.body}>
        {tab === "player" && (
          <PlayerTab cls={playerCls} setCls={setPlayerCls} />
        )}
        {tab === "enemies" && (
          <EnemyTab type={enemyType} setType={setEnemyType} />
        )}
        {tab === "spawn" && (
          <SpawnTab tier={spawnTier} setTier={setSpawnTier} />
        )}
        {tab === "iframes" && <IframesTab />}
        {tab === "boss" && <BossTab />}
      </div>

      {toast && <div style={styles.toast}>{toast}</div>}
    </div>
  );
}

// ── Player ────────────────────────────────────────────────────────────────

function PlayerTab({
  cls,
  setCls,
}: {
  cls: CharacterClass;
  setCls: (c: CharacterClass) => void;
}) {
  const overrides = useBalanceStore((s) => s.characters[cls] ?? {});
  const setCharacter = useBalanceStore((s) => s.setCharacter);
  const def = CHARACTER_DATA[cls];

  return (
    <>
      <SubTabs
        options={["warrior", "mage", "rogue", "necromancer", "bard", "death_knight"] as CharacterClass[]}
        value={cls}
        onChange={setCls}
      />
      {PLAYER_TUNABLE_KEYS.map((k) => {
        const baseVal = def[k] as number;
        // Skip projectile fields for melee classes (warrior) — they're zeroed.
        if (def.attackType === "melee" && k.startsWith("projectile")) return null;
        const ov = overrides[k];
        const value = ov ?? baseVal;
        return (
          <DevSlider
            key={k}
            label={k}
            value={value}
            defaultValue={baseVal}
            onChange={(v) => setCharacter(cls, { [k]: v })}
            onReset={() => {
              const next = { ...overrides };
              delete (next as Record<string, unknown>)[k];
              useBalanceStore.setState((s) => ({
                characters: { ...s.characters, [cls]: next },
              }));
            }}
          />
        );
      })}
    </>
  );
}

// ── Enemies ───────────────────────────────────────────────────────────────

function EnemyTab({
  type,
  setType,
}: {
  type: EnemyType;
  setType: (t: EnemyType) => void;
}) {
  const overrides = useBalanceStore((s) => s.enemies[type] ?? {});
  const setEnemy = useBalanceStore((s) => s.setEnemy);
  const def = ENEMY_DATA[type];

  const allTypes = Object.keys(ENEMY_DATA) as EnemyType[];

  return (
    <>
      <select
        value={type}
        onChange={(e) => setType(e.target.value as EnemyType)}
        style={styles.select}
      >
        {allTypes.map((t) => (
          <option key={t} value={t}>{ENEMY_DATA[t].displayName}</option>
        ))}
      </select>
      {ENEMY_TUNABLE_KEYS.map((k) => {
        const baseVal = def[k] as number;
        const ov = overrides[k];
        const value = ov ?? baseVal;
        return (
          <DevSlider
            key={k}
            label={k}
            value={value}
            defaultValue={baseVal}
            onChange={(v) => setEnemy(type, { [k]: v })}
            onReset={() => {
              const next = { ...overrides };
              delete (next as Record<string, unknown>)[k];
              useBalanceStore.setState((s) => ({
                enemies: { ...s.enemies, [type]: next },
              }));
            }}
          />
        );
      })}
    </>
  );
}

// ── Spawn weights ─────────────────────────────────────────────────────────

function SpawnTab({
  tier,
  setTier,
}: {
  tier: number;
  setTier: (t: number) => void;
}) {
  const overrides = useBalanceStore((s) => s.spawnWeights[tier] ?? {});
  const setWeight = useBalanceStore((s) => s.setSpawnWeight);
  const baseTable = SPAWN_TABLE[tier];

  return (
    <>
      <select
        value={tier}
        onChange={(e) => setTier(Number(e.target.value))}
        style={styles.select}
      >
        {SPAWN_TABLE.map((_, i) => (
          <option key={i} value={i}>
            Tier {i} (waves {i * 2 + 1}-{i * 2 + 2})
          </option>
        ))}
      </select>
      {baseTable.map(([type, baseWeight]) => {
        const ov = overrides[type];
        const value = ov ?? baseWeight;
        return (
          <DevSlider
            key={type}
            label={type}
            value={value}
            defaultValue={baseWeight}
            min={0}
            max={20}
            step={1}
            onChange={(v) => setWeight(tier, type, v)}
            onReset={() => {
              const next = { ...overrides };
              delete (next as Record<string, unknown>)[type];
              useBalanceStore.setState((s) => ({
                spawnWeights: { ...s.spawnWeights, [tier]: next },
              }));
            }}
          />
        );
      })}
    </>
  );
}

// ── Iframes ───────────────────────────────────────────────────────────────

function IframesTab() {
  const player = useBalanceStore((s) => s.player);
  const setPlayer = useBalanceStore((s) => s.setPlayer);
  const setDashIframeBonus = useBalanceStore((s) => s.setDashIframeBonus);

  const baseInv = GAME_CONFIG.PLAYER.INVINCIBILITY_TIME;

  return (
    <>
      <div style={styles.sectionTitle}>Base & Multipliers</div>
      <DevSlider
        label="invincibilityTime"
        value={player.invincibilityTime ?? baseInv}
        defaultValue={baseInv}
        min={0}
        max={2.5}
        step={0.05}
        onChange={(v) => setPlayer({ invincibilityTime: v })}
      />
      <DevSlider
        label="× melee (1.0)"
        value={player.invMultMelee ?? 1.0}
        defaultValue={1.0}
        min={0}
        max={2}
        step={0.05}
        onChange={(v) => setPlayer({ invMultMelee: v })}
      />
      <DevSlider
        label="× slam (0.8)"
        value={player.invMultSlam ?? 0.8}
        defaultValue={0.8}
        min={0}
        max={2}
        step={0.05}
        onChange={(v) => setPlayer({ invMultSlam: v })}
      />
      <DevSlider
        label="× projectile (0.6)"
        value={player.invMultProj ?? 0.6}
        defaultValue={0.6}
        min={0}
        max={2}
        step={0.05}
        onChange={(v) => setPlayer({ invMultProj: v })}
      />

      <div style={styles.sectionTitle}>Dash Iframe Bonus (extra seconds on top of dash duration)</div>
      {(["warrior", "mage", "rogue", "necromancer", "bard", "death_knight"] as CharacterClass[]).map((cls) => {
        const def = DEFAULT_DASH_IFRAME_BONUS[cls];
        const value = player.dashIframeBonus?.[cls] ?? def;
        return (
          <DevSlider
            key={cls}
            label={cls}
            value={value}
            defaultValue={def}
            min={0}
            max={0.4}
            step={0.01}
            onChange={(v) => setDashIframeBonus(cls, v)}
          />
        );
      })}
    </>
  );
}

// ── Boss / Champion projectile speeds ─────────────────────────────────────

function BossTab() {
  const bossProj = useBalanceStore((s) => s.bossProj);
  const setBossProj = useBalanceStore((s) => s.setBossProj);
  const burst = bossProj.radialBurst ?? BOSS_PROJECTILE_DATA.radialBurst;

  return (
    <>
      <div style={styles.sectionTitle}>Boss radial burst (by enrage phase)</div>
      {[0, 1, 2].map((phaseIdx) => {
        const def = BOSS_PROJECTILE_DATA.radialBurst[phaseIdx];
        const phaseLabel = phaseIdx === 0 ? "phase 0/1" : phaseIdx === 1 ? "phase 2" : "phase 3+";
        return (
          <DevSlider
            key={phaseIdx}
            label={phaseLabel}
            value={burst[phaseIdx]}
            defaultValue={def}
            min={2}
            max={30}
            step={0.5}
            onChange={(v) => {
              const next: [number, number, number] = [...burst];
              next[phaseIdx] = v;
              setBossProj({ radialBurst: next });
            }}
          />
        );
      })}

      <div style={styles.sectionTitle}>Champion projectiles</div>
      <DevSlider
        label="warrior crescent"
        value={bossProj.warriorChampCrescent ?? BOSS_PROJECTILE_DATA.warriorChampCrescent}
        defaultValue={BOSS_PROJECTILE_DATA.warriorChampCrescent}
        min={2}
        max={30}
        step={0.5}
        onChange={(v) => setBossProj({ warriorChampCrescent: v })}
      />
      <DevSlider
        label="mage orb"
        value={bossProj.mageChampOrb ?? BOSS_PROJECTILE_DATA.mageChampOrb}
        defaultValue={BOSS_PROJECTILE_DATA.mageChampOrb}
        min={2}
        max={30}
        step={0.5}
        onChange={(v) => setBossProj({ mageChampOrb: v })}
      />
      <DevSlider
        label="rogue dagger"
        value={bossProj.rogueChampDagger ?? BOSS_PROJECTILE_DATA.rogueChampDagger}
        defaultValue={BOSS_PROJECTILE_DATA.rogueChampDagger}
        min={2}
        max={40}
        step={0.5}
        onChange={(v) => setBossProj({ rogueChampDagger: v })}
      />
    </>
  );
}

// ── Bits ──────────────────────────────────────────────────────────────────

function SubTabs<T extends string>({
  options,
  value,
  onChange,
}: {
  options: T[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <div style={styles.subTabs}>
      {options.map((o) => (
        <button
          key={o}
          onClick={() => onChange(o)}
          style={{
            ...styles.subTab,
            ...(value === o ? styles.subTabActive : {}),
          }}
        >
          {o}
        </button>
      ))}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  panel: {
    position: "fixed",
    top: 12,
    left: 12,
    width: 440,
    maxHeight: "calc(100vh - 24px)",
    background: "rgba(8,4,16,0.92)",
    border: "1px solid rgba(140,140,200,0.35)",
    borderRadius: 8,
    color: "#ddd",
    fontFamily: "monospace",
    fontSize: 11,
    zIndex: 200,
    display: "flex",
    flexDirection: "column",
    boxShadow: "0 6px 24px rgba(0,0,0,0.5)",
  },
  header: {
    display: "flex",
    alignItems: "center",
    gap: 6,
    padding: "8px 10px",
    borderBottom: "1px solid rgba(140,140,200,0.2)",
  },
  title: {
    flex: 1,
    color: "#ccccff",
    letterSpacing: 3,
    fontSize: 11,
    fontWeight: "bold",
  },
  btn: {
    background: "rgba(60,60,100,0.5)",
    border: "1px solid rgba(140,140,200,0.4)",
    color: "#ddd",
    fontFamily: "monospace",
    fontSize: 10,
    padding: "3px 8px",
    cursor: "pointer",
    borderRadius: 3,
    letterSpacing: 1,
  },
  tabs: {
    display: "flex",
    borderBottom: "1px solid rgba(140,140,200,0.2)",
  },
  tab: {
    flex: 1,
    background: "transparent",
    border: "none",
    color: "#888",
    fontFamily: "monospace",
    fontSize: 10,
    padding: "6px 4px",
    cursor: "pointer",
    letterSpacing: 1,
  },
  tabActive: {
    background: "rgba(80,80,140,0.3)",
    color: "#ccf",
  },
  body: {
    padding: "8px 10px",
    overflowY: "auto",
    flex: 1,
  },
  subTabs: {
    display: "flex",
    gap: 4,
    marginBottom: 6,
  },
  subTab: {
    flex: 1,
    background: "rgba(40,40,70,0.4)",
    border: "1px solid rgba(120,120,180,0.3)",
    color: "#aaa",
    fontFamily: "monospace",
    fontSize: 10,
    padding: "3px 6px",
    cursor: "pointer",
    borderRadius: 3,
    textTransform: "uppercase" as const,
    letterSpacing: 1,
  },
  subTabActive: {
    background: "rgba(100,100,160,0.5)",
    color: "#fff",
  },
  select: {
    width: "100%",
    background: "rgba(0,0,0,0.4)",
    border: "1px solid rgba(120,120,180,0.4)",
    color: "#ddd",
    fontFamily: "monospace",
    fontSize: 11,
    padding: "4px 6px",
    marginBottom: 6,
    borderRadius: 3,
  },
  sectionTitle: {
    color: "#aaaadd",
    fontSize: 9,
    letterSpacing: 2,
    textTransform: "uppercase" as const,
    marginTop: 8,
    marginBottom: 4,
    paddingBottom: 2,
    borderBottom: "1px solid rgba(120,120,180,0.2)",
  },
  toast: {
    position: "absolute",
    bottom: 8,
    left: 8,
    right: 8,
    background: "rgba(40,80,40,0.85)",
    border: "1px solid rgba(120,200,120,0.5)",
    color: "#dfd",
    padding: "6px 10px",
    borderRadius: 4,
    textAlign: "center" as const,
    fontSize: 11,
  },
  hint: {
    position: "fixed",
    top: 12,
    left: 12,
    background: "rgba(0,0,0,0.6)",
    border: "1px solid rgba(140,140,200,0.3)",
    color: "#888",
    padding: "4px 8px",
    fontFamily: "monospace",
    fontSize: 10,
    borderRadius: 4,
    cursor: "pointer",
    zIndex: 200,
    letterSpacing: 1,
  },
};
