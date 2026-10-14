import type { BoxDef, DecorDef, PropDef } from '../sim/Track';
import { WALL_HALF } from './site';
import { distanceTo } from './scenery';

// Building blocks for the works sites: what sits on a building's walls (windows, gates, doors,
// glass fronts, canopies) and what stands about the yard (lorries, a Unimog, cars, containers,
// shelters). Things on a wall stand just proud of its outer face; parts that touch butt up
// flush or are a little smaller, so no two faces share a plane.

const GLASS = 0x6d8fa8;
const FRAME = 0x3a3c40;
const TYRE = 0x1d1d1f;

/** Everything a works site collects: solid boxes, decor, loose props. */
export interface Yard {
  statics: BoxDef[];
  decor: DecorDef[];
  props: PropDef[];
}

/** One side of a building: from corner a to corner b, `u` along it, `n` out of the building. */
export interface Side {
  a: [number, number];
  b: [number, number];
  u: [number, number];
  n: [number, number];
  len: number;
  /** Heading of the side, a → b: a box with this yaw has its length (Z) along the wall. */
  yaw: number;
}

/** The sides of a footprint, numbered from 0 here (the sketch counts from 1). */
export function sidesOf(outline: [number, number][]): Side[] {
  const n = outline.length;
  const inside = (x: number, z: number) => {
    let c = false;
    for (let i = 0; i < n; i++) {
      const [px, pz] = outline[i], [qx, qz] = outline[(i + 1) % n];
      if (pz > z !== qz > z && x < ((qx - px) * (z - pz)) / (qz - pz) + px) c = !c;
    }
    return c;
  };
  return outline.map((a, i) => {
    const b = outline[(i + 1) % n];
    const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
    const u: [number, number] = [(b[0] - a[0]) / len, (b[1] - a[1]) / len];
    let nrm: [number, number] = [u[1], -u[0]];
    const mx = (a[0] + b[0]) / 2, mz = (a[1] + b[1]) / 2;
    if (inside(mx + nrm[0] * 1.5, mz + nrm[1] * 1.5)) nrm = [-nrm[0], -nrm[1]];
    return { a, b, u, n: nrm, len, yaw: Math.atan2(u[0], u[1]) };
  });
}

/** A point `along` metres from corner a and `out` metres out from the outline. */
export function at(s: Side, along: number, out: number): [number, number] {
  return [s.a[0] + s.u[0] * along + s.n[0] * out, s.a[1] + s.u[1] * along + s.n[1] * out];
}

/** A flat panel on the wall's outer face from `from` to `to` metres along it, between two heights. */
export function panel(s: Side, from: number, to: number, y0: number, y1: number, color: number, proud = 0.03): DecorDef {
  const [x, z] = at(s, (from + to) / 2, WALL_HALF + proud);
  return { type: 'box', pos: [x, (y0 + y1) / 2, z], half: [proud, (y1 - y0) / 2, (to - from) / 2], yaw: s.yaw, color };
}

/** A row of windows along a stretch of wall, each in a dark frame. */
export function windows(s: Side, from: number, to: number, y0: number, h: number, every = 3.6, w = 2.4): DecorDef[] {
  const out: DecorDef[] = [];
  const count = Math.max(1, Math.floor((to - from) / every));
  const pad = (to - from - count * every) / 2;
  for (let k = 0; k < count; k++) {
    const m = from + pad + every * (k + 0.5);
    out.push(panel(s, m - w / 2 - 0.08, m + w / 2 + 0.08, y0 - 0.08, y0 + h + 0.08, FRAME, 0.03));
    out.push(panel(s, m - w / 2, m + w / 2, y0, y0 + h, GLASS, 0.05));
  }
  return out;
}

/** A roller door: a frame, the door and its slats. */
export function gate(s: Side, mid: number, w: number, h: number, color = 0x9aa1a8): DecorDef[] {
  const out = [panel(s, mid - w / 2 - 0.2, mid + w / 2 + 0.2, 0, h + 0.2, 0xe3c04a, 0.02), panel(s, mid - w / 2, mid + w / 2, 0, h, color, 0.05)];
  for (let y = 0.35; y < h; y += 0.45) out.push(panel(s, mid - w / 2 + 0.05, mid + w / 2 - 0.05, y - 0.03, y + 0.03, 0x7d858c, 0.07));
  return out;
}

/** A pair of big hinged doors. */
export function wingDoors(s: Side, mid: number, w: number, h: number, color = 0x5a6f80): DecorDef[] {
  return [
    panel(s, mid - w / 2 - 0.15, mid + w / 2 + 0.15, 0, h + 0.15, FRAME, 0.02),
    panel(s, mid - w / 2, mid - 0.03, 0, h, color, 0.05),
    panel(s, mid + 0.03, mid + w / 2, 0, h, color, 0.05),
  ];
}

/** A plain door. */
export function door(s: Side, mid: number, color = 0x5a6f80, w = 1.1, h = 2.3): DecorDef[] {
  return [panel(s, mid - w / 2 - 0.1, mid + w / 2 + 0.1, 0, h + 0.1, FRAME, 0.02), panel(s, mid - w / 2, mid + w / 2, 0, h, color, 0.05)];
}

/** A glass front over a stretch of wall, mullions on it. */
export function glassFront(s: Side, from: number, to: number, y0: number, y1: number): DecorDef[] {
  const out = [panel(s, from, to, y0, y1, GLASS, 0.05)];
  for (let m = from; m <= to + 0.01; m += 1.5) out.push(panel(s, m - 0.05, m + 0.05, y0, y1, FRAME, 0.08));
  out.push(panel(s, from, to, y0 + (y1 - y0) / 2 - 0.05, y0 + (y1 - y0) / 2 + 0.05, FRAME, 0.08));
  return out;
}

/**
 * Where the road crosses the line straight out from a wall: how far out its near and far
 * edges are, at `along` metres along the side.
 */
export function roadSpan(line: [number, number][], s: Side, along: number, halfWidth: number): [number, number] {
  let near = -1;
  for (let d = 0; d < 120; d += 0.25) {
    const [x, z] = at(s, along, d);
    const on = distanceTo(line, x, z) < halfWidth;
    if (on && near < 0) near = d;
    if (!on && near >= 0) return [near, d];
  }
  return [near, near];
}

/**
 * A flat roof sticking out from the wall on slim pillars, `width` wide. The pillars are solid;
 * `pillars` says how far out (from the wall's face) they stand at a given spot along the side,
 * one row or more. The roof reaches just past the outermost.
 */
export function canopy(y: Yard, s: Side, mid: number, width: number, height: number, pillars: (along: number) => number[]): void {
  let depth = 0;
  for (const e of [-1, 1]) {
    const along = mid + e * (width / 2 - 0.4);
    for (const d of pillars(along)) {
      const [px, pz] = at(s, along, WALL_HALF + d);
      y.statics.push({ pos: [px, height / 2, pz], half: [0.15, height / 2, 0.15], quat: quat(s.yaw), color: 0x8c949c });
      depth = Math.max(depth, d + 0.4);
    }
  }
  const [cx, cz] = at(s, mid, WALL_HALF + depth / 2);
  y.decor.push({ type: 'box', pos: [cx, height + 0.15, cz], half: [depth / 2, 0.15, width / 2], yaw: s.yaw, color: 0xd8dde2 });
}

export function quat(yaw: number): [number, number, number, number] {
  return [0, Math.sin(yaw / 2), 0, Math.cos(yaw / 2)];
}

/** A point in an object's own frame (+Z ahead, +X to its left), out into the world. */
function frame(x: number, z: number, yaw: number) {
  const s = Math.sin(yaw), c = Math.cos(yaw);
  return (lx: number, lz: number): [number, number] => [x + lx * c + lz * s, z - lx * s + lz * c];
}

/** A box in an object's frame. */
function part(f: ReturnType<typeof frame>, yaw: number, lx: number, y: number, lz: number, hx: number, hy: number, hz: number, color: number): DecorDef {
  const [x, z] = f(lx, lz);
  return { type: 'box', pos: [x, y, z], half: [hx, hy, hz], yaw, color };
}

function wheels(f: ReturnType<typeof frame>, yaw: number, xs: number, zs: number[], r: number, w = 0.15): DecorDef[] {
  return zs.flatMap((lz) => [-1, 1].map((sd) => part(f, yaw, sd * xs, r, lz, w, r, r, TYRE)));
}

/** A parked car, nose along its yaw. */
export function car(x: number, z: number, yaw: number, color: number): DecorDef[] {
  const f = frame(x, z, yaw);
  return [
    part(f, yaw, 0, 0.6, 0, 0.88, 0.32, 2.1, color),
    part(f, yaw, 0, 1.17, -0.25, 0.8, 0.25, 1.15, 0x26323d),
    ...wheels(f, yaw, 0.93, [1.35, -1.35], 0.3, 0.1),
  ];
}

/** An articulated lorry, cab ahead: solid (the trailer and cab block the way). */
export function lorry(y: Yard, x: number, z: number, yaw: number, cab: number, box: number): void {
  const f = frame(x, z, yaw);
  const [tx, tz] = f(0, -2);
  const [cx, cz] = f(0, 5.4);
  y.statics.push({ pos: [tx, 2.4, tz], half: [1.25, 1.5, 6.2], quat: quat(yaw), color: box });
  y.statics.push({ pos: [cx, 1.7, cz], half: [1.2, 1.35, 1.05], quat: quat(yaw), color: cab });
  y.decor.push(
    part(f, yaw, 0, 2.3, 6.47, 1.05, 0.5, 0.02, 0x26323d), // windscreen
    part(f, yaw, 0, 0.75, 1.1, 0.9, 0.2, 7.3, 0x2a2a2e), // chassis
    ...wheels(f, yaw, 1.05, [5.4, 2.2, -5.4, -6.8], 0.5, 0.22),
  );
}

/** A Unimog-like utility truck: a short cab, a flat bed, big wheels. */
export function unimog(y: Yard, x: number, z: number, yaw: number, color: number): void {
  const f = frame(x, z, yaw);
  y.decor.push(
    part(f, yaw, 0, 1.75, 1.6, 1.05, 0.65, 0.9, color),
    part(f, yaw, 0, 2.05, 2.52, 0.9, 0.3, 0.02, 0x26323d),
    part(f, yaw, 0, 1.15, 2.7, 1.0, 0.35, 0.3, color), // bonnet
    part(f, yaw, 0, 1.3, -1.2, 1.1, 0.12, 1.9, 0x5a5f66), // bed
    part(f, yaw, 0, 0.8, 0.3, 0.6, 0.25, 2.6, 0x2a2a2e),
    ...wheels(f, yaw, 1.0, [1.9, -1.9], 0.6, 0.25),
  );
}

/** An olive army truck with a canvas over the back. */
export function armyTruck(y: Yard, x: number, z: number, yaw: number): void {
  const f = frame(x, z, yaw);
  y.decor.push(
    part(f, yaw, 0, 1.8, 2.6, 1.15, 0.8, 0.95, 0x4f5a3a),
    part(f, yaw, 0, 2.2, 3.57, 0.95, 0.3, 0.02, 0x26323d),
    part(f, yaw, 0, 2.2, -1.4, 1.2, 1.2, 2.8, 0x6b7350), // canvas
    part(f, yaw, 0, 0.8, 0, 0.7, 0.25, 4, 0x2a2a2e),
    ...wheels(f, yaw, 1.05, [2.8, -0.6, -2.6], 0.55, 0.25),
  );
}

/** A farm tractor, big wheels behind, small ones in front. */
export function tractor(y: Yard, x: number, z: number, yaw: number, color: number): void {
  const f = frame(x, z, yaw);
  y.decor.push(
    part(f, yaw, 0, 1.1, 0.7, 0.45, 0.4, 1.2, color), // bonnet
    part(f, yaw, 0, 1.6, -0.9, 0.7, 0.9, 0.6, color), // cab
    part(f, yaw, 0, 1.9, -0.9, 0.72, 0.45, 0.62, 0x9fc4d8), // (glass a touch wider than the cab, so it shows)
    part(f, yaw, -0.85, 0.85, -0.9, 0.2, 0.85, 0.85, TYRE),
    part(f, yaw, 0.85, 0.85, -0.9, 0.2, 0.85, 0.85, TYRE),
    part(f, yaw, -0.6, 0.45, 1.5, 0.15, 0.45, 0.45, TYRE),
    part(f, yaw, 0.6, 0.45, 1.5, 0.15, 0.45, 0.45, TYRE),
  );
}

/** Exhaust smoke above a point: an engine left running. */
export function smoke(x: number, y: number, z: number): DecorDef {
  return { type: 'smoke', pos: [x, y, z] };
}

/** A skip or container: a box with ribs, solid. */
export function container(y: Yard, x: number, z: number, yaw: number, w: number, d: number, h: number, color: number): void {
  const f = frame(x, z, yaw);
  y.statics.push({ pos: [x, h / 2, z], half: [w / 2, h / 2, d / 2], quat: quat(yaw), color });
  for (let k = -1; k <= 1; k++) y.decor.push(part(f, yaw, 0, h / 2, (k * d) / 3, w / 2 + 0.04, h / 2 - 0.05, 0.06, 0x2a2a2e));
}

/** A cardboard baler: a tall grey press with a yellow band and a chute. */
export function baler(y: Yard, x: number, z: number, yaw: number): void {
  const f = frame(x, z, yaw);
  y.statics.push({ pos: [x, 1.6, z], half: [1.1, 1.6, 0.9], quat: quat(yaw), color: 0x8c949c });
  y.decor.push(part(f, yaw, 0, 2.2, 0, 1.13, 0.12, 0.93, 0xe3c04a), part(f, yaw, 0, 1.4, 0.95, 0.7, 0.5, 0.05, 0x3a3c40));
}

/** A shelter for smokers, like a bus stop: a roof, a glass back and one glass side. */
export function shelter(y: Yard, x: number, z: number, yaw: number): void {
  const f = frame(x, z, yaw);
  y.decor.push(
    part(f, yaw, 0, 2.3, 0, 1.7, 0.06, 0.8, 0x5c6670),
    part(f, yaw, 0, 1.2, -0.72, 1.6, 1.04, 0.03, 0x9fc4d8),
    part(f, yaw, 1.6, 1.2, -0.05, 0.03, 1.04, 0.64, 0x9fc4d8),
    part(f, yaw, 0, 0.45, -0.5, 1.2, 0.04, 0.15, 0x8a5a32), // bench
  );
  for (const sd of [-1, 1]) y.decor.push(part(f, yaw, sd * 1.66, 1.12, -0.76, 0.05, 1.12, 0.05, FRAME));
}

/** A bicycle shed: a roof on posts and a row of bikes under it. */
export function bikeShed(y: Yard, x: number, z: number, yaw: number, length: number): void {
  const f = frame(x, z, yaw);
  y.decor.push(part(f, yaw, 0, 2.3, 0, length / 2, 0.06, 1.3, 0x5c6670));
  for (const lx of [-length / 2 + 0.2, length / 2 - 0.2]) for (const lz of [-1.1, 1.1]) y.decor.push(part(f, yaw, lx, 1.12, lz, 0.05, 1.12, 0.05, FRAME));
  for (let lx = -length / 2 + 0.8; lx < length / 2 - 0.5; lx += 0.75) {
    const c = [0xd23b3b, 0x2f6db5, 0x2a2a2e, 0x4f8a3c][Math.floor(lx * 3) & 3];
    y.decor.push(part(f, yaw, lx, 0.5, 0, 0.03, 0.32, 0.85, c), part(f, yaw, lx, 0.82, -0.4, 0.22, 0.03, 0.03, FRAME));
  }
}

/** Light plastic drums in a scatter: knocked, they go flying. */
export function barrels(y: Yard, spots: [number, number][]): void {
  for (const [x, z] of spots) y.props.push({ type: 'barrel', pos: [x, 0.46, z] });
}

/** Pallets of goods, stacked. */
export function pallets(y: Yard, x: number, z: number, yaw: number, count: number): void {
  const f = frame(x, z, yaw);
  for (let k = 0; k < count; k++) {
    y.decor.push(part(f, yaw, k * 1.3, 0.07, 0, 0.6, 0.07, 0.4, 0xb08a5a), part(f, yaw, k * 1.3, 0.6, 0, 0.55, 0.46, 0.36, k % 2 ? 0xc19a6b : 0xd8d4c8));
  }
}

/** A simple shed or hall, solid: walls, a roof that overhangs them, a gate on its front (+Z). */
export function hall(y: Yard, x: number, z: number, yaw: number, w: number, d: number, h: number, wall: number, roof: number, gateW = 0): void {
  const f = frame(x, z, yaw);
  y.statics.push({ pos: [x, h / 2, z], half: [w / 2, h / 2, d / 2], quat: quat(yaw), color: wall });
  y.decor.push(part(f, yaw, 0, h + 0.2, 0, w / 2 + 0.4, 0.2, d / 2 + 0.4, roof));
  if (gateW > 0) {
    y.decor.push(part(f, yaw, 0, Math.min(h - 0.5, 4.5) / 2, d / 2 + 0.05, gateW / 2, Math.min(h - 0.5, 4.5) / 2, 0.05, 0x9aa1a8));
    for (let gy = 0.4; gy < Math.min(h - 0.5, 4.5); gy += 0.45) y.decor.push(part(f, yaw, 0, gy, d / 2 + 0.12, gateW / 2 - 0.05, 0.03, 0.02, 0x7d858c));
  }
}
