/**
 * LabyrinthCanvasErrorBoundary.tsx
 *
 * Class-component error boundary that catches crashes inside parts of
 * the R3F Canvas tree and renders a fallback JSX subtree instead.
 * Without this, a single shim-related runtime error (eg. a missing
 * field Player3D/Enemy3D expects) would cascade into the whole Canvas
 * rendering nothing — turning the playable area black even though the
 * HTML HUD overlay is still alive.
 *
 * Use this to isolate the new shim-based wrappers (LabyrinthPlayer3D,
 * LabyrinthEnemies3D) so a crash there keeps the walls + HUD visible
 * and lets us fall back to simpler procedural renderers.
 */

import { Component, type ReactNode } from "react";

interface Props {
  fallback: ReactNode;
  /** Human-readable name used in the console error log. */
  label: string;
  children: ReactNode;
}

interface State {
  hasError: boolean;
  message: string;
}

/** Global ring buffer of captured errors. Readable by the debug overlay
 *  so iOS users without a console can see which subtree crashed.
 *  Module-scope so every boundary instance writes to the same list. */
export const LAB_ERROR_LOG: { label: string; message: string; at: number }[] = [];

function pushLabError(label: string, message: string) {
  LAB_ERROR_LOG.push({ label, message, at: Date.now() });
  if (LAB_ERROR_LOG.length > 12) LAB_ERROR_LOG.shift();
}

export class LabyrinthCanvasErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, message: "" };

  static getDerivedStateFromError(err: unknown): State {
    return {
      hasError: true,
      message: err instanceof Error ? err.message : String(err),
    };
  }

  componentDidCatch(error: unknown, info: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    pushLabError(this.props.label, msg);
    // eslint-disable-next-line no-console
    console.error(`[Labyrinth/${this.props.label}] render error — falling back`, error, info);
  }

  render() {
    if (this.state.hasError) return this.props.fallback;
    return this.props.children;
  }
}
