import type { DecorDef, TrafficDef } from '../sim/Track';

// Building blocks for what stands round a track: woods, houses, stands with people on them,
// floodlights, a road outside with traffic. All decor, nothing to crash into, except where a
// track puts them on purpose. Parts that touch butt up flush or are a little smaller, so no
// two faces share a plane.

/** Repeatable dice, so a track looks the same every time it is loaded. */
export function dice(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Distance from a point to the nearest stretch of a closed line. */
export function distanceTo(line: [number, number][], x: number, z: number): number {
  let best = Infinity;
  for (let i = 0; i < line.length; i++) {
    const [ax, az] = line[i], [bx, bz] = line[(i + 1) % line.length];
    const dx = bx - ax, dz = bz - az;
    const t = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / (dx * dx + dz * dz || 1)));
    best = Math.min(best, Math.hypot(ax + dx * t - x, az + dz * t - z));
  }
  return best;
}

/**
 * A wood: `count` trees scattered over a rectangle, none closer to the road than `clear`
 * metres or to each other than 4 m.
 */
export function forest(o: { x: [number, number]; z: [number, number]; count: number; seed: number; avoid?: [number, number][][]; clear?: number }): DecorDef[] {
  const roll = dice(o.seed);
  const out: DecorDef[] = [];
  const placed: [number, number][] = [];
  for (let tries = 0; tries < o.count * 30 && out.length < o.count; tries++) {
    const x = o.x[0] + roll() * (o.x[1] - o.x[0]);
    const z = o.z[0] + roll() * (o.z[1] - o.z[0]);
    if ((o.avoid ?? []).some((line) => distanceTo(line, x, z) < (o.clear ?? 8))) continue;
    if (placed.some(([px, pz]) => Math.hypot(px - x, pz - z) < 4)) continue;
    placed.push([x, z]);
    out.push({ type: 'tree', pos: [x, 0, z] });
  }
  return out;
}

const WALLS = [0xe8e2d0, 0xd9c7a8, 0xc8d2d8, 0xe6d2c4, 0xd0d6c4];
const ROOFS = [0x8a3b2e, 0x5a5f66, 0x7a4a2a, 0x3f4a55];

/** A house: walls, a roof that overhangs them, a door and two windows on the front (+Z of its yaw). */
export function house(x: number, z: number, yaw: number, w: number, d: number, h: number, look: number): DecorDef[] {
  const s = Math.sin(yaw), c = Math.cos(yaw);
  // a point in the house's own frame, out into the world
  const at = (lx: number, y: number, lz: number): [number, number, number] => [x + lx * c + lz * s, y, z - lx * s + lz * c];
  const wall = WALLS[look % WALLS.length], roof = ROOFS[look % ROOFS.length];
  return [
    { type: 'box', pos: at(0, h / 2, 0), half: [w / 2, h / 2, d / 2], yaw, color: wall },
    // roof: a little wider and deeper than the walls, sitting on them
    { type: 'box', pos: at(0, h + 0.25, 0), half: [w / 2 + 0.3, 0.25, d / 2 + 0.3], yaw, color: roof },
    { type: 'box', pos: at(0, h + 0.9, 0), half: [w / 2 - 0.4, 0.4, d / 4], yaw, color: roof },
    // door and windows stand just proud of the front wall
    { type: 'box', pos: at(0, 1, d / 2 + 0.03), half: [0.5, 1, 0.03], yaw, color: 0x5a3d2b },
    { type: 'box', pos: at(-w / 4 - 0.3, h * 0.55, d / 2 + 0.03), half: [0.6, 0.5, 0.03], yaw, color: 0x9fc4d8 },
    { type: 'box', pos: at(w / 4 + 0.3, h * 0.55, d / 2 + 0.03), half: [0.6, 0.5, 0.03], yaw, color: 0x9fc4d8 },
  ];
}

const SHIRTS = [0xd23b3b, 0x2f6db5, 0xe3c04a, 0x4f8a3c, 0xf2f2f2, 0x7b2d8e, 0xe8833a];

/**
 * A grandstand along X (facing +Z of its yaw) with people on its steps: `rows` steps of 0.8 m
 * rising 0.5 m each, `length` long.
 */
export function stand(x: number, z: number, yaw: number, length: number, rows: number, seed: number): DecorDef[] {
  const s = Math.sin(yaw), c = Math.cos(yaw);
  const at = (lx: number, y: number, lz: number): [number, number, number] => [x + lx * c + lz * s, y, z - lx * s + lz * c];
  const roll = dice(seed);
  const out: DecorDef[] = [];
  for (let r = 0; r < rows; r++) {
    const top = 0.5 * (r + 1);
    out.push({ type: 'box', pos: at(0, top / 2, -r * 0.8), half: [length / 2, top / 2, 0.4], yaw, color: r % 2 ? 0x7d858c : 0x8c949c });
    for (let px = -length / 2 + 0.6; px < length / 2 - 0.4; px += 0.9) {
      if (roll() < 0.35) continue;
      out.push({ type: 'box', pos: at(px, top + 0.35, -r * 0.8), half: [0.2, 0.35, 0.18], yaw, color: SHIRTS[Math.floor(roll() * SHIRTS.length)] });
    }
  }
  // a roof over the top rows on two posts
  const back = -(rows - 0.5) * 0.8, roofY = 0.5 * rows + 2.6;
  for (const lx of [-length / 2 + 0.3, length / 2 - 0.3]) out.push({ type: 'box', pos: at(lx, roofY / 2, back - 0.5), half: [0.12, roofY / 2, 0.12], yaw, color: 0x5a5f66 });
  out.push({ type: 'box', pos: at(0, roofY + 0.1, back + 0.6), half: [length / 2 + 0.2, 0.1, 1.8], yaw, color: 0xd8dde2 });
  return out;
}

/** A floodlight mast with a bank of lamps on top. */
export function floodlight(x: number, z: number, yaw: number): DecorDef[] {
  return [
    { type: 'box', pos: [x, 7, z], half: [0.2, 7, 0.2], color: 0x5a5f66 },
    { type: 'box', pos: [x, 14.4, z], half: [1.4, 0.6, 0.15], yaw, color: 0x3a3c40 },
    { type: 'box', pos: [x + Math.sin(yaw) * 0.17, 14.4, z + Math.cos(yaw) * 0.17], half: [1.25, 0.45, 0.02], yaw, color: 0xfff3b0 },
  ];
}

const CARS = [0x2f6db5, 0xd23b3b, 0xc8c8c8, 0x404850, 0x2e7d4f, 0xe3c04a, 0xf2f2f2, 0x8a2c5a];

/**
 * A straight road outside the track along X at `z`, from `x0` to `x1`, with a centre line, a
 * pavement on the near side (toward -Z… set `near`), and traffic both ways. Keeps right.
 */
export function street(o: { z: number; x0: number; x1: number; near: 1 | -1; cars: number; seed: number }): { decor: DecorDef[]; traffic: TrafficDef[] } {
  const roll = dice(o.seed);
  const mid = (o.x0 + o.x1) / 2, half = (o.x1 - o.x0) / 2;
  const decor: DecorDef[] = [
    { type: 'box', pos: [mid, 0.01, o.z], half: [half, 0.01, 4.5], color: 0x45484d },
    { type: 'box', pos: [mid, 0.07, o.z + o.near * 6], half: [half, 0.06, 1.4], color: 0xb7b2a6 },
  ];
  for (let x = o.x0 + 3; x < o.x1 - 3; x += 6) decor.push({ type: 'box', pos: [x, 0.025, o.z], half: [1.5, 0.005, 0.08], color: 0xf2f2f2 });
  for (let x = o.x0 + 10; x < o.x1 - 10; x += 24) decor.push({ type: 'lamp', pos: [x, 0, o.z + o.near * 6.6], yaw: o.near > 0 ? Math.PI / 2 : -Math.PI / 2 });
  // keeping right: eastwards on the -Z side, westwards on the +Z side
  const path: [number, number][] = [[o.x0, o.z - 2.2], [o.x1, o.z - 2.2], [o.x1, o.z + 2.2], [o.x0, o.z + 2.2]];
  const loop = 2 * (o.x1 - o.x0);
  const traffic: TrafficDef[] = [];
  for (let k = 0; k < o.cars; k++) {
    traffic.push({ type: roll() < 0.25 ? 'van' : 'car', color: CARS[Math.floor(roll() * CARS.length)], speed: 9 + roll() * 5, offset: (k * loop) / o.cars + roll() * 20, path });
  }
  return { decor, traffic };
}
