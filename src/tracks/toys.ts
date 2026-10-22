import { Matrix4, Quaternion, Vector3 } from 'three';
import { profile, type BoxDef, type DecorDef, type MoverDef, type PropDef } from '../sim/Track';

// Building blocks for the playground's bigger toys: seesaws of every size on their trestles,
// burning hoops to jump through, a half-pipe, a bowl with banked walls, a ski jump, heaps of
// cartons. Parts that touch butt up flush or are a little smaller, so no two faces share a plane.

/** Everything a toy is made of: solid boxes, decor, moving parts, loose props. */
export interface Toys {
  statics: BoxDef[];
  decor: DecorDef[];
  movers: MoverDef[];
  props: PropDef[];
}

/**
 * A seesaw lying tipped back towards where one drives on (−Z of `yaw`), its low end just on
 * the ground, on a trestle under its middle. `half` is half its length.
 */
export function seesaw(t: Toys, x: number, z: number, yaw: number, half: number, width: number, tilt: number, color: number, thick = 0.1): void {
  const y = half * Math.sin(tilt) + 0.02;
  t.movers.push({ type: 'seesaw', pos: [x, y, z], yaw, half: [width / 2, thick, half], angle: tilt, color });
  // the trestle: its top a little under the board, so the board never grazes it as it tips
  const top = y - 2 * thick - 0.08;
  t.decor.push(
    { type: 'box', pos: [x, top / 2, z], half: [width / 2 + 0.5, top / 2, 0.12], yaw, color: 0x5a5f66 },
    { type: 'box', pos: [x, 0.06, z], half: [width / 2 + 0.9, 0.06, 0.3], yaw, color: 0x3a3c40 },
  );
}

/**
 * A ring standing across the way along `yaw`, its middle at height `y`: solid, so whoever
 * jumps too low or too wide hits it. Orange and yellow pieces, smoke rising off the top, and
 * a post either side holding it up.
 */
export function hoop(t: Toys, x: number, y: number, z: number, yaw: number, radius: number, pieces = 28): void {
  const axis = new Vector3(Math.sin(yaw), 0, Math.cos(yaw));
  const side = new Vector3(Math.cos(yaw), 0, -Math.sin(yaw));
  const up = new Vector3(0, 1, 0);
  const chord = radius * Math.tan(Math.PI / pieces) + 0.03;
  for (let k = 0; k < pieces; k++) {
    const a = ((k + 0.5) / pieces) * 2 * Math.PI;
    // out from the middle, and along the ring
    const r = up.clone().multiplyScalar(Math.cos(a)).addScaledVector(side, Math.sin(a));
    const along = side.clone().multiplyScalar(Math.cos(a)).addScaledVector(up, -Math.sin(a));
    const q = new Quaternion().setFromRotationMatrix(new Matrix4().makeBasis(along, r, axis));
    t.statics.push({
      pos: [x + r.x * radius, y + r.y * radius, z + r.z * radius],
      // (every other piece a little deeper, so where neighbours overlap their faces do not share a plane)
      half: [chord, 0.22, 0.25 + (k % 2) * 0.02],
      quat: [q.x, q.y, q.z, q.w],
      color: [0xe8833a, 0xf2c230, 0xd23b3b][k % 3],
    });
  }
  // the posts either side, from the ground to the ring's middle
  for (const s of [-1, 1]) {
    const px = x + side.x * s * (radius + 0.4), pz = z + side.z * s * (radius + 0.4);
    t.statics.push({ pos: [px, y / 2, pz], half: [0.2, y / 2, 0.2], quat: [0, Math.sin(yaw / 2), 0, Math.cos(yaw / 2)], color: 0x3a3c40 });
  }
  // it is burning
  for (const k of [-0.5, 0, 0.5]) {
    t.decor.push({ type: 'smoke', pos: [x + side.x * k * radius, y + radius * Math.sqrt(1 - k * k) + 0.3, z + side.z * k * radius] });
  }
}

/**
 * A half-pipe along +Z from `z0`, `length` long: a flat bottom `flat` wide at ground level
 * and a quarter circle of `radius` up either side to a vertical lip, with a back wall behind
 * each curve so it reads solid from outside. Open at both ends, to drive in and out.
 */
export function halfpipe(t: Toys, x: number, z0: number, length: number, radius: number, flat: number, color: number, pieces = 14): void {
  const th = 0.1;
  const zc = z0 + length / 2;
  for (const s of [-1, 1]) {
    const at = (a: number): [number, number] => [x + s * (flat / 2 + radius * Math.sin(a)), radius - radius * Math.cos(a)];
    for (let i = 0; i < pieces; i++) {
      const a0 = (i / pieces) * (Math.PI / 2), a1 = ((i + 1) / pieces) * (Math.PI / 2);
      const [x0, y0] = at(a0), [x1, y1] = at(a1);
      const mid = (a0 + a1) / 2;
      // the surface faces the middle of the pipe; the box sits behind it
      const nx = -s * Math.sin(mid), ny = Math.cos(mid);
      const angle = Math.atan2(y1 - y0, x1 - x0);
      t.statics.push({
        pos: [(x0 + x1) / 2 - nx * th, (y0 + y1) / 2 - ny * th, zc],
        half: [Math.hypot(x1 - x0, y1 - y0) / 2 + 0.01, th, length / 2],
        quat: [0, 0, Math.sin(angle / 2), Math.cos(angle / 2)],
        color,
      });
    }
    // a steel edge along the lip, and the wall behind the curve, from the ground to the lip
    const back = x + s * (flat / 2 + radius + 0.45);
    t.decor.push(
      { type: 'box', pos: [x + s * (flat / 2 + radius + 0.12), radius + 0.06, zc], half: [0.1, 0.06, length / 2 + 0.02], color: 0x8c949c },
      { type: 'box', pos: [back, radius / 2, zc], half: [0.25, radius / 2, length / 2 - 0.05], color: 0x8a7a5a },
    );
  }
}

/**
 * A plank whose top surface starts at `start`, `base` metres up, and rises along heading `yaw`
 * at `angle` from level, `length` long: past a quarter turn it leans back over the way it came,
 * its top facing in and down (an overhang). Placed exactly, thickness and all, at any angle.
 */
export function plankAt(start: [number, number], yaw: number, length: number, width: number, angle: number, color: number, base = 0, thick = 0.1): BoxDef {
  const fx = Math.sin(yaw), fz = Math.cos(yaw);
  const along = (length / 2) * Math.cos(angle), up = (length / 2) * Math.sin(angle);
  // the middle of the top surface, then half a thickness back along its normal
  const nOut = -Math.sin(angle), nUp = Math.cos(angle);
  const sy = Math.sin(yaw / 2), cy = Math.cos(yaw / 2);
  const sp = Math.sin(-angle / 2), cp = Math.cos(-angle / 2);
  return {
    pos: [start[0] + fx * (along - thick * nOut), base + up - thick * nUp, start[1] + fz * (along - thick * nOut)],
    half: [width / 2, thick, length / 2],
    quat: [cy * sp, sy * cp, -sy * sp, cy * cp],
    color,
  };
}

/**
 * A bowl: banked walls all the way round a flat middle, ring upon ring, each `[length, bank,
 * colour]` starting where the one below ends: the faster one goes round, the higher up. A ring
 * banked past a quarter turn leans in over the others and closes the bowl off at the top. The
 * way in faces `door` (a heading): a passage `gap` pieces wide through the first ring and the
 * skirt round the outside, under the rings above.
 */
export function bowl(t: Toys, cx: number, cz: number, r0: number, tiers: [length: number, bank: number, color: number][], door: number, pieces = 56, gap = 3): void {
  let r = r0, base = 0, outer = r0;
  const step = (2 * Math.PI) / pieces;
  const inGap = (k: number) => k >= pieces - Math.ceil(gap / 2) || k < Math.floor(gap / 2);
  for (const [len, bank, color] of tiers) {
    const end = r + len * Math.cos(bank);
    // (as wide as its widest edge needs; the narrow edges overlap their neighbours a little)
    const width = 2 * Math.max(r, end) * Math.tan(Math.PI / pieces) + 0.04;
    // (the way in goes through the first ring only, and under the rest, which go all the way round)
    const open = r === r0;
    for (let k = 0; k < pieces; k++) {
      const a = door + (k + 0.5) * step;
      if (open && inGap(k)) continue;
      t.statics.push(plankAt([cx + Math.sin(a) * r, cz + Math.cos(a) * r], a, len, width, bank, k % 2 ? color : shade(color), base));
    }
    r = end;
    base += len * Math.sin(bank);
    outer = Math.max(outer, r);
  }
  // A shell round the outside from the ground to the very top, closing every seam between the
  // rings, open at the bottom only where the passage comes in, `PASSAGE` metres high.
  const PASSAGE = 3.4;
  const shell = outer + 0.45;
  const shellWidth = 2 * shell * Math.tan(Math.PI / pieces) + 0.04;
  for (let k = 0; k < pieces; k++) {
    const a = door + (k + 0.5) * step;
    const [sx, sz] = [cx + Math.sin(a) * shell, cz + Math.cos(a) * shell];
    const from = inGap(k) ? PASSAGE : 0;
    t.statics.push(plankAt([sx, sz], a, base + 0.3 - from, shellWidth, Math.PI / 2, 0x6b7078, from, 0.15));
  }
  // the passage walled either side up to the rings, so nothing gets in under them
  const surface = (rr: number) => {
    let r1 = r0, h = 0;
    for (const [len, bank] of tiers) {
      const r2 = r1 + len * Math.cos(bank);
      if (bank >= 1.4 || rr <= r2) return bank >= 1.4 ? h : h + (rr - r1) * Math.tan(bank);
      h += len * Math.sin(bank);
      r1 = r2;
    }
    return h;
  };
  for (const a of [door + Math.floor(gap / 2) * step, door - Math.ceil(gap / 2) * step]) {
    for (let rr = r0; rr < shell; rr += 1) {
      const h = Math.max(surface(rr) - 0.05, PASSAGE);
      const m = Math.min(rr + 0.5, shell - 0.5);
      t.statics.push({ pos: [cx + Math.sin(a) * m, h / 2, cz + Math.cos(a) * m], half: [0.15, h / 2, 0.5], quat: [0, Math.sin(a / 2), 0, Math.cos(a / 2)], color: 0x6b7078 });
    }
  }
  // (every other piece a shade darker, so one sees it go round) and a yellow ring round the flat middle
  t.decor.push({ type: 'ring', pos: [cx, 0.012, cz], half: [r0 - 0.5, 0, 0.25], color: 0xf2c230 });
}

/** A colour a shade darker. */
function shade(c: number): number {
  const k = 0.86;
  return (Math.round(((c >> 16) & 255) * k) << 16) | (Math.round(((c >> 8) & 255) * k) << 8) | Math.round((c & 255) * k);
}

/**
 * Points along a smooth step from height `y0` to `y1` between `z0` and `z1`, level at both
 * ends: for a profile, so a slope eases in and out instead of starting at a kink.
 */
export function easedSlope(z0: number, z1: number, y0: number, y1: number, step = 2.5): [number, number][] {
  const n = Math.max(2, Math.round(Math.abs(z1 - z0) / step));
  const out: [number, number][] = [];
  for (let i = 0; i <= n; i++) {
    const u = i / n;
    out.push([z0 + (z1 - z0) * u, y0 + (y1 - y0) * (u - Math.sin(2 * Math.PI * u) / (2 * Math.PI))]);
  }
  return out;
}

/**
 * A ski jump along +Z at `x`: a long climb from the ground at `z0` to the top, a short level
 * bit, the in-run down to a table leaning a touch downhill, and beyond a gap the landing hill
 * easing down to the ground. On posts, the landing hill filled in down to the ground.
 */
export function skiJump(t: Toys, x: number, z0: number, o: { climb: number; top: number; level: number; inrun: number; table: number; hill: number; low: number; width: number; color: number }): { takeoff: number; end: number } {
  const zTop = z0 + o.climb, zDrop = zTop + o.level, zTable = zDrop + o.inrun, zEdge = zTable + o.table;
  // (it starts a few centimetres up, not level with the ground it would flicker against)
  const up = [...easedSlope(z0, zTop, 0.03, o.top), ...easedSlope(zTop, zDrop, o.top, o.top).slice(1)];
  const down = [...easedSlope(zDrop, zTable, o.top, o.low).slice(1), [zEdge, o.low - o.table * 0.06] as [number, number]];
  const run = [...up, ...down];
  t.statics.push(...profile(x, run, o.width, o.color));
  // posts under the climb and the in-run, two abreast every 5 m
  for (let z = z0 + 6; z < zEdge - 0.5; z += 5) {
    const y = heightOn(run, z) - 0.35;
    if (y < 0.4) continue;
    for (const s of [-1, 1]) t.decor.push({ type: 'box', pos: [x + s * (o.width / 2 - 0.3), y / 2, z], half: [0.15, y / 2, 0.15], color: 0x5a5f66 });
  }
  // the landing hill, a gap beyond the table and a little lower, filled in to the ground
  const hillTop = o.low - o.table * 0.06 - 0.8;
  const hill: [number, number][] = [];
  const n = Math.round(o.hill / 2.5);
  for (let i = 0; i <= n; i++) {
    const u = i / n;
    hill.push([zEdge + 1 + o.hill * u, 0.03 + ((hillTop - 0.03) * (1 + Math.cos(Math.PI * u))) / 2]);
  }
  t.statics.push(...profile(x, hill, o.width + 2, 0xe8eef5));
  for (let i = 0; i + 1 < hill.length; i++) {
    const [za, ya] = hill[i], [zb, yb] = hill[i + 1];
    const h = Math.min(ya, yb) - 0.25;
    if (h < 0.1) continue;
    t.decor.push({ type: 'box', pos: [x, h / 2, (za + zb) / 2], half: [o.width / 2 + 0.9, h / 2, (zb - za) / 2 + 0.01], color: 0x7d8a6a });
  }
  return { takeoff: zEdge, end: zEdge + 1 + o.hill };
}

/** Height of a profile at a spot along it. */
function heightOn(points: [number, number][], z: number): number {
  for (let i = 0; i + 1 < points.length; i++) {
    const [z0, y0] = points[i], [z1, y1] = points[i + 1];
    if (z >= z0 && z <= z1) return y0 + ((y1 - y0) * (z - z0)) / (z1 - z0 || 1);
  }
  return 0;
}

/** A pyramid of cartons, `layers` high, square. */
export function cartonHill(t: Toys, x: number, z: number, layers: number): void {
  for (let l = 0; l < layers; l++) {
    const n = layers - l;
    for (let i = 0; i < n; i++) for (let k = 0; k < n; k++) {
      t.props.push({ type: 'carton', pos: [x + (i - (n - 1) / 2) * 0.52, 0.26 + l * 0.51, z + (k - (n - 1) / 2) * 0.52] });
    }
  }
}

/** Ten big cones set up like skittles, the point of the triangle first, the rows behind it along `yaw`. */
export function skittles(t: Toys, x: number, z: number, yaw: number): void {
  const fx = Math.sin(yaw), fz = Math.cos(yaw);
  const lx = Math.cos(yaw), lz = -Math.sin(yaw);
  for (let row = 0; row < 4; row++) {
    for (let k = 0; k <= row; k++) {
      const ahead = row * 1.9, across = (k - row / 2) * 2.1;
      t.props.push({ type: 'bigcone', pos: [x + fx * ahead + lx * across, 1.01, z + fz * ahead + lz * across] });
    }
  }
}
