import type { BoxDef, DecorDef, TrackDef } from '../sim/Track';
import { road } from './road';

const TARMAC = 0x45484d;
const CONCRETE = 0x9a9a94;

export interface SiteOptions {
  /** Footprint of the building, clockwise, in the pixels of the picture it was read off. */
  outline: [number, number][];
  /** Size of that picture in pixels, and how many metres of track one pixel becomes. */
  picture: [number, number];
  scale: number;
  /** Distance from the building to the middle of the road. */
  margin: number;
  roadWidth: number;
  wallColor: number;
  roofColor: number;
  height: number;
}

/** Convex hull, clockwise in picture coordinates (y down), i.e. counter-clockwise seen with north up. */
function hull(points: [number, number][]): [number, number][] {
  const p = [...points].sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const cross = (o: [number, number], a: [number, number], b: [number, number]) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const half = (list: [number, number][]) => {
    const out: [number, number][] = [];
    for (const q of list) {
      while (out.length >= 2 && cross(out[out.length - 2], out[out.length - 1], q) <= 0) out.pop();
      out.push(q);
    }
    out.pop();
    return out;
  };
  return [...half(p), ...half(p.reverse())];
}

/**
 * A works site: one building with the given footprint, and a lap round it. Rough layout,
 * to be dressed later.
 */
export function site(o: SiteOptions): Pick<TrackDef, 'statics' | 'decor' | 'gates' | 'spawn' | 'line'> & { length: number } {
  const [w, h] = o.picture;
  // north is up in the picture: +X east, +Z north
  const outline = o.outline.map(([px, py]): [number, number] => [(px - w / 2) * o.scale, (h / 2 - py) * o.scale]);

  // The road: round the hull of the building, pushed out by the margin.
  const ring = hull(outline);
  const n = ring.length;
  const pushed = ring.map((p, i): [number, number] => {
    const a = ring[(i + n - 1) % n], b = ring[(i + 1) % n];
    const unit = (x: number, z: number): [number, number] => {
      const len = Math.hypot(x, z) || 1;
      return [x / len, z / len];
    };
    const [ax, az] = unit(p[0] - a[0], p[1] - a[1]);
    const [bx, bz] = unit(b[0] - p[0], b[1] - p[1]);
    // outward normals of the two edges that meet here; which side is out is checked against the middle
    let [nx, nz] = unit(az + bz, -(ax + bx));
    const cx = ring.reduce((s, q) => s + q[0], 0) / n, cz = ring.reduce((s, q) => s + q[1], 0) / n;
    if ((p[0] - cx) * nx + (p[1] - cz) * nz < 0) [nx, nz] = [-nx, -nz];
    return [p[0] + nx * o.margin * 1.25, p[1] + nz * o.margin * 1.25];
  });
  // start in the middle of the longest side
  let longest = 0;
  pushed.forEach((p, i) => {
    const q = pushed[(i + 1) % n], r = pushed[longest], s = pushed[(longest + 1) % n];
    if (Math.hypot(q[0] - p[0], q[1] - p[1]) > Math.hypot(s[0] - r[0], s[1] - r[1])) longest = i;
  });
  const a = pushed[longest], b = pushed[(longest + 1) % n];
  const points: [number, number][] = [[(a[0] + b[0]) / 2, (a[1] + b[1]) / 2]];
  for (let i = 1; i <= n; i++) points.push(pushed[(longest + i) % n]);
  const lap = road(points, o.roadWidth, 8);

  const reach = (axis: 0 | 1) => Math.max(...lap.line.map((p) => Math.abs(p[axis]))) + 25;
  const lotX = reach(0), lotZ = reach(1);
  const statics: BoxDef[] = [
    { pos: [0, -0.5, 0], half: [lotX, 0.5, lotZ], color: TARMAC },
    { pos: [0, 0.5, lotZ], half: [lotX, 0.5, 0.3], color: CONCRETE },
    { pos: [0, 0.5, -lotZ], half: [lotX, 0.5, 0.3], color: CONCRETE },
    { pos: [lotX, 0.5, 0], half: [0.3, 0.5, lotZ], color: CONCRETE },
    { pos: [-lotX, 0.5, 0], half: [0.3, 0.5, lotZ], color: CONCRETE },
  ];
  // The building: a wall along every side of the footprint, and a lid on top.
  outline.forEach((p, i) => {
    const q = outline[(i + 1) % outline.length];
    const yaw = Math.atan2(q[0] - p[0], q[1] - p[1]);
    statics.push({
      pos: [(p[0] + q[0]) / 2, o.height / 2, (p[1] + q[1]) / 2],
      half: [0.4, o.height / 2, Math.hypot(q[0] - p[0], q[1] - p[1]) / 2 + 0.4],
      quat: [0, Math.sin(yaw / 2), 0, Math.cos(yaw / 2)],
      color: o.wallColor,
    });
  });
  const decor: DecorDef[] = [...lap.decor, { type: 'slab', pos: [0, o.height, 0], points: outline, color: o.roofColor }];
  return { statics, decor, gates: lap.gates, spawn: lap.spawn, line: lap.line, length: lap.length };
}
