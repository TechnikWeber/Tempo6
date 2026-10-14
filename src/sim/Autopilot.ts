import type { DriveInput, Vehicle } from './Vehicle';

/**
 * Drives along a polyline (pure pursuit): steers at a point a little further on, further the
 * faster it goes, and lifts off where the line bends away. The opponents in a race use it;
 * the tests use it to tell whether a course can be got through, and how fast.
 */
export class Autopilot {
  private seg = 0;

  constructor(private readonly pts: [number, number][], private readonly ahead = 1.5, private readonly loop = true) {}

  /** Start from the stretch of the line nearest to a point, e.g. where the vehicle stands. */
  from(x: number, z: number): this {
    let best = Infinity;
    this.pts.forEach(([px, pz], i) => {
      const d = Math.hypot(px - x, pz - z);
      if (d < best) {
        best = d;
        // (the stretch that starts at the nearest corner, or the one before if that is behind)
        this.seg = i;
      }
    });
    const n = this.pts.length;
    const prev = this.pts[(this.seg + n - 1) % n];
    if (this.project(prev, this.pts[this.seg], x, z) < 1) this.seg = (this.seg + n - 1) % n;
    return this;
  }

  drive(v: Vehicle, throttle = 1): DriveInput {
    const p = v.body.translation();
    const r = v.body.rotation();
    // forward is the chassis' +Z
    const fx = 2 * (r.x * r.z + r.w * r.y), fz = 1 - 2 * (r.x * r.x + r.y * r.y);
    const n = this.pts.length;
    // move on along the line while the next corner is closer than the current one
    for (let k = 0; k < 3; k++) {
      const a = this.pts[this.seg % n], b = this.pts[(this.seg + 1) % n];
      const t = this.project(a, b, p.x, p.z);
      if (t < 1) break;
      if (!this.loop && this.seg + 2 >= n) break;
      this.seg++;
    }
    // look further ahead the faster it goes
    const target = this.along(p.x, p.z, Math.max(this.ahead, Math.abs(v.speed) * 0.5));
    const bearing = Math.atan2(target[0] - p.x, target[1] - p.z);
    let e = bearing - Math.atan2(fx, fz);
    e = Math.atan2(Math.sin(e), Math.cos(e));
    const steer = Math.max(-1, Math.min(1, -e * 4));
    // and lift off when the line bends away
    const t = Math.abs(e) > 0.35 && Math.abs(v.speed) > 6 ? -0.5 : throttle;
    return { throttle: t, steer, handbrake: false };
  }

  private project(a: [number, number], b: [number, number], x: number, z: number): number {
    const dx = b[0] - a[0], dz = b[1] - a[1];
    return ((x - a[0]) * dx + (z - a[1]) * dz) / (dx * dx + dz * dz || 1);
  }

  private along(x: number, z: number, ahead: number): [number, number] {
    const n = this.pts.length;
    let left = ahead;
    let i = this.seg;
    let a = this.pts[i % n], b = this.pts[(i + 1) % n];
    const t = Math.max(0, Math.min(1, this.project(a, b, x, z)));
    let from: [number, number] = [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
    for (let k = 0; k < n; k++) {
      const len = Math.hypot(b[0] - from[0], b[1] - from[1]);
      if (len >= left) return [from[0] + ((b[0] - from[0]) * left) / len, from[1] + ((b[1] - from[1]) * left) / len];
      left -= len;
      i++;
      from = b;
      a = this.pts[i % n];
      b = this.pts[(i + 1) % n];
      if (!this.loop && i + 1 >= n) return from;
    }
    return from;
  }
}
