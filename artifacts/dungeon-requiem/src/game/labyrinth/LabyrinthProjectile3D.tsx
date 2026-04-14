/**
 * LabyrinthProjectile3D.tsx
 *
 * Thin wrapper that forwards each LabProjectile to the main game's
 * `Projectile3D` renderer (exported from src/entities/Projectile3D.tsx).
 * The LabProjectile struct shape matches the main game's `Projectile`
 * interface — same `style | color | glowColor | x | z | vx | vz`
 * fields — so a TS cast is all the boundary needs. Zero core edits.
 */

import { Projectile3D } from "../../entities/Projectile3D";
import type { Projectile } from "../GameScene";
import type { LabProjectile } from "./LabyrinthProjectile";

export function LabyrinthProjectiles3D({ projectiles }: { projectiles: LabProjectile[] }) {
  return (
    <>
      {projectiles.map((p) => (
        <Projectile3D key={p.id} proj={p as unknown as Projectile} />
      ))}
    </>
  );
}
