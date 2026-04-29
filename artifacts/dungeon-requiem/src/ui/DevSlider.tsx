/**
 * DevSlider.tsx
 * Controlled-prop slider used by DevBalancePanel: range input + numeric box +
 * reset-to-default. Bounded as [defaultValue × 0.25, defaultValue × 4] unless
 * an explicit min/max is provided.
 */

import { useEffect, useState } from "react";

interface DevSliderProps {
  label: string;
  value: number;
  defaultValue: number;
  onChange: (v: number) => void;
  onReset?: () => void;
  min?: number;
  max?: number;
  step?: number;
  /** Extra accent for the row (e.g. yellow when value differs from default). */
  modified?: boolean;
}

export function DevSlider({
  label,
  value,
  defaultValue,
  onChange,
  onReset,
  min,
  max,
  step,
  modified,
}: DevSliderProps) {
  // Auto-bound: 0.25× default → 4× default. If default is 0, fall back to 0–10.
  const lo = min ?? (defaultValue > 0 ? defaultValue * 0.25 : 0);
  const hi = max ?? (defaultValue > 0 ? defaultValue * 4 : 10);
  const stepSize =
    step ?? (defaultValue > 0 ? niceStep(defaultValue) : 0.01);

  const [text, setText] = useState(String(round(value)));
  useEffect(() => {
    setText(String(round(value)));
  }, [value]);

  const isModified = modified ?? value !== defaultValue;

  const handleNum = (s: string) => {
    setText(s);
    const n = parseFloat(s);
    if (!Number.isNaN(n)) onChange(n);
  };

  return (
    <div style={styles.row}>
      <span style={{ ...styles.label, color: isModified ? "#ffcc44" : "#888" }}>
        {label}
      </span>
      <input
        type="range"
        min={lo}
        max={hi}
        step={stepSize}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        style={styles.range}
      />
      <input
        type="number"
        value={text}
        onChange={(e) => handleNum(e.target.value)}
        step={stepSize}
        style={styles.num}
      />
      <button
        type="button"
        onClick={onReset ?? (() => onChange(defaultValue))}
        style={{ ...styles.reset, opacity: isModified ? 1 : 0.3 }}
        title={`Reset to ${round(defaultValue)}`}
      >
        ↺
      </button>
    </div>
  );
}

function round(v: number): number {
  return Math.round(v * 1000) / 1000;
}

function niceStep(def: number): number {
  // Pick a step that's roughly default / 100 but rounded to a clean unit
  if (def >= 100) return 1;
  if (def >= 10) return 0.1;
  if (def >= 1) return 0.01;
  return 0.001;
}

const styles: Record<string, React.CSSProperties> = {
  row: {
    display: "grid",
    gridTemplateColumns: "110px 1fr 60px 22px",
    gap: 6,
    alignItems: "center",
    padding: "2px 0",
    fontSize: 11,
  },
  label: {
    textTransform: "uppercase" as const,
    fontSize: 10,
    letterSpacing: 0.5,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
  range: {
    width: "100%",
    accentColor: "#8888ff",
  },
  num: {
    width: 60,
    background: "rgba(0,0,0,0.4)",
    border: "1px solid rgba(120,120,120,0.3)",
    color: "#ddd",
    fontFamily: "monospace",
    fontSize: 11,
    padding: "2px 4px",
    borderRadius: 3,
  },
  reset: {
    background: "transparent",
    border: "1px solid rgba(120,120,120,0.3)",
    color: "#aaa",
    cursor: "pointer",
    fontSize: 11,
    width: 22,
    height: 20,
    padding: 0,
    borderRadius: 3,
  },
};
