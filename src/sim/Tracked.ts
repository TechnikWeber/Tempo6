import type RAPIER from '@dimforge/rapier3d-compat';

/** Keeps the previous and current transform of a body so rendering can interpolate between fixed steps. */
export class Tracked {
  /** x, y, z, qx, qy, qz, qw */
  readonly prev = new Float32Array(7);
  readonly cur = new Float32Array(7);

  constructor(readonly body: RAPIER.RigidBody) {
    this.teleport();
  }

  snap(): void {
    this.prev.set(this.cur);
    this.read();
  }

  /** Call after moving a body by hand so it does not get smeared across the jump. */
  teleport(): void {
    this.read();
    this.prev.set(this.cur);
  }

  private read(): void {
    const t = this.body.translation();
    const r = this.body.rotation();
    const c = this.cur;
    c[0] = t.x; c[1] = t.y; c[2] = t.z;
    c[3] = r.x; c[4] = r.y; c[5] = r.z; c[6] = r.w;
  }
}
