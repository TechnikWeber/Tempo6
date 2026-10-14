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
  /** Yard beyond the road to the boundary wall (m); 25 if not given. */
  yard?: number;
  /** Lines that pass through the boundary wall (a railway): the wall leaves a gap there. */
  crossings?: [number, number][][];
}

/** Half the thickness of the building's walls: their outer faces stand this far out from the outline. */
export const WALL_HALF = 0.4;

/** Where a straight piece from p to q crosses another, as a share along p→q, or null. */
function cross(p: [number, number], q: [number, number], a: [number, number], b: [number, number]): number | null {
  const rx = q[0] - p[0], rz = q[1] - p[1], sx = b[0] - a[0], sz = b[1] - a[1];
  const d = rx * sz - rz * sx;
  if (Math.abs(d) < 1e-9) return null;
  const t = ((a[0] - p[0]) * sz - (a[1] - p[1]) * sx) / d;
  const u = ((a[0] - p[0]) * rz - (a[1] - p[1]) * rx) / d;
  return t >= 0 && t <= 1 && u >= 0 && u <= 1 ? t : null;
}

/** A straight boundary wall from p to q, with a 20 m gap wherever one of the lines crosses it. */
function boundary(p: [number, number], q: [number, number], crossings: [number, number][][]): BoxDef[] {
  const len = Math.hypot(q[0] - p[0], q[1] - p[1]);
  const cuts: number[] = [];
  for (const line of crossings) for (let i = 0; i + 1 < line.length; i++) {
    const t = cross(p, q, line[i], line[i + 1]);
    if (t !== null) cuts.push(t * len);
  }
  const pieces: [number, number][] = [];
  let from = 0;
  for (const c of cuts.sort((x, y) => x - y)) {
    if (c - 10 > from) pieces.push([from, c - 10]);
    from = Math.max(from, c + 10);
  }
  if (from < len) pieces.push([from, len]);
  const ux = (q[0] - p[0]) / len, uz = (q[1] - p[1]) / len;
  return pieces.map(([a, b]) => {
    const m = (a + b) / 2;
    const alongX = Math.abs(ux) > 0.5;
    return { pos: [p[0] + ux * m, 0.5, p[1] + uz * m], half: alongX ? [(b - a) / 2, 0.5, 0.3] : [0.3, 0.5, (b - a) / 2], color: CONCRETE };
  });
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
export function site(o: SiteOptions): Pick<TrackDef, 'statics' | 'decor' | 'gates' | 'spawn' | 'line'> & { length: number; outline: [number, number][]; lot: [number, number] } {
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

  const reach = (axis: 0 | 1) => Math.max(...lap.line.map((p) => Math.abs(p[axis]))) + (o.yard ?? 25);
  const lotX = reach(0), lotZ = reach(1);
  const corners: [number, number][] = [[-lotX, -lotZ], [lotX, -lotZ], [lotX, lotZ], [-lotX, lotZ]];
  const statics: BoxDef[] = [
    { pos: [0, -0.5, 0], half: [lotX, 0.5, lotZ], color: TARMAC },
    ...corners.flatMap((c, i) => boundary(c, corners[(i + 1) % 4], o.crossings ?? [])),
  ];
  // The building: a wall along every side of the footprint, and a lid on top.
  outline.forEach((p, i) => {
    const q = outline[(i + 1) % outline.length];
    const yaw = Math.atan2(q[0] - p[0], q[1] - p[1]);
    statics.push({
      pos: [(p[0] + q[0]) / 2, o.height / 2, (p[1] + q[1]) / 2],
      half: [WALL_HALF, o.height / 2, Math.hypot(q[0] - p[0], q[1] - p[1]) / 2 + WALL_HALF],
      quat: [0, Math.sin(yaw / 2), 0, Math.cos(yaw / 2)],
      color: o.wallColor,
    });
  });
  const decor: DecorDef[] = [...lap.decor, { type: 'slab', pos: [0, o.height, 0], points: outline, color: o.roofColor }];
  return { statics, decor, gates: lap.gates, spawn: lap.spawn, line: lap.line, length: lap.length, outline, lot: [lotX, lotZ] };
}
