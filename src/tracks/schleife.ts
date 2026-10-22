import { L } from '../i18n';
import { heightAt, type BoxDef, type DecorDef, type MoverDef, type TrackDef } from '../sim/Track';
import { rimHills, road, terrainFor } from './road';
import { distanceTo, forest, house, stand } from './scenery';
import { person, tractor, type Yard } from './works';

const GRASS = 0x55903f;

// Rough layout only: a long, flowing lap in the spirit of the old mountain circuits, bend
// after bend and one long straight to finish. The shape is our own, not a copy of a real one.
const LOT_X = 190;
const LOT_Z = 125;
const WIDTH = 7;

// x, z and height: flat along the start, up over two ridges and down again
const ROAD = road([
  [-60, -100, 0], [40, -100, 0], [120, -98, 0.5],
  [160, -78, 2], [158, -45, 5],
  [128, -28, 8], [124, 2, 9], [152, 22, 7],
  [166, 52, 4], [142, 84, 3],
  [100, 98, 5], [62, 82, 9], [48, 52, 12],
  [20, 36, 11], [-8, 56, 7], [-18, 86, 4],
  [-50, 104, 3], [-90, 94, 5], [-106, 62, 8],
  [-132, 42, 10], [-162, 46, 9], [-172, 12, 6],
  [-150, -20, 4], [-120, -30, 3], [-126, -62, 1.5], [-108, -92, 0.3],
], WIDTH, 12);
// No boundary wall: the lot's outer rim rises into hills instead, well above the highest
// ridge the road itself climbs to, eased in over the last 10 m so the village and the
// stands at the bends — both set back further than that — stand on their own flat ground.
const TERRAIN = rimHills(terrainFor(ROAD, [LOT_X, LOT_Z], GRASS), 10, 20);

// (no floor: the terrain is the ground)
const statics: BoxDef[] = [];

const decor: DecorDef[] = [...ROAD.decor];
// A village along the start straight, between the road and the wall.
let look = 0;
for (let x = -50; x <= 110; x += 15) {
  if (distanceTo(ROAD.line, x, -114) < 12) continue;
  decor.push(...house(x, -114, 0, 8 + (look % 3), 6.5, 3 + (look % 2) * 1.2, look));
  look++;
}
// People watching at a few bends, on the outside, facing the road. (Where they stand, the
// woods keep clear; so does the village.)
const clearings: [number, number][][] = [[[-60, -118], [118, -118], [118, -110], [-60, -110]]];
const n = ROAD.line.length;
const cx = ROAD.line.reduce((t, p) => t + p[0], 0) / n, cz = ROAD.line.reduce((t, p) => t + p[1], 0) / n;
for (const share of [0.17, 0.36, 0.55, 0.78]) {
  const i = Math.floor(share * n);
  const [x, z] = ROAD.line[i], [nx, nz] = ROAD.line[(i + 1) % n];
  // across the road, on the side away from the middle of the lap
  let ox = nz - z, oz = -(nx - x);
  const len = Math.hypot(ox, oz) || 1;
  ox /= len;
  oz /= len;
  if ((x - cx) * ox + (z - cz) * oz < 0) [ox, oz] = [-ox, -oz];
  const sx = x + ox * 13, sz = z + oz * 13;
  if (distanceTo(ROAD.line, sx, sz) < 9) continue;
  decor.push(...stand(sx, sz, Math.atan2(x - sx, z - sz), 14, 3, 30 + i));
  clearings.push([[sx - 1, sz - 1], [sx + 1, sz - 1], [sx + 1, sz + 1], [sx - 1, sz + 1]]);
}
// The village is out to watch: people at their garden gates, a few at a table.
{
  const shirts = [0x4a7ab5, 0xf2f2f2, 0xd23b3b, 0x3f8f5f, 0x7b2d8e, 0xe3c04a, 0x2a2a2e];
  let k = 0;
  for (let x = -45; x <= 105; x += 9) {
    const z = -108.5 + (k % 2) * 0.6;
    if (distanceTo(ROAD.line, x, z) < 6) continue;
    decor.push(person(x, z, Math.PI + 0.3 * ((k % 3) - 1), shirts[k % shirts.length], (['wave', 'stand', 'phone', 'point'] as const)[k % 4]));
    k++;
  }
}
/** A small square round a spot, for the woods to keep clear of. */
const clearing = (x: number, z: number): [number, number][] => [[x - 1, z - 1], [x + 1, z - 1], [x + 1, z + 1], [x - 1, z + 1]];
const SHIRTS = [0x4a7ab5, 0xf2f2f2, 0xd23b3b, 0x3f8f5f, 0x7b2d8e, 0xe3c04a, 0x2a2a2e];

// The church at the west end of the village, its tower with a clock telling the real time.
{
  const CX = -80, CZ = -111;
  decor.push(
    { type: 'box', pos: [CX, 3.5, CZ], half: [7, 3.5, 4], color: 0xe8e2d0 },
    { type: 'box', pos: [CX, 7.4, CZ], half: [7.3, 0.4, 4.3], color: 0x8a3b2e },
    { type: 'box', pos: [CX, 8.5, CZ], half: [6.6, 0.7, 2.4], color: 0x8a3b2e },
    { type: 'box', pos: [CX - 9, 9, CZ], half: [2.2, 9, 2.2], color: 0xe8e2d0 }, // the tower
    { type: 'box', pos: [CX - 9, 19.2, CZ], half: [1.6, 1.2, 1.6], color: 0x4f7a5a }, // its spire, in steps
    { type: 'box', pos: [CX - 9, 21.2, CZ], half: [0.9, 0.8, 0.9], color: 0x4f7a5a },
    { type: 'box', pos: [CX - 9, 22.6, CZ], half: [0.3, 0.6, 0.3], color: 0x4f7a5a },
    { type: 'clock', pos: [CX - 9, 14, CZ + 2.25], half: [1.3, 0, 0], yaw: 0 },
    { type: 'box', pos: [CX, 1.4, CZ + 4.03], half: [1, 1.4, 0.03], color: 0x5a3d2b }, // the door
  );
  for (const dx of [-4.5, 4.5]) decor.push({ type: 'box', pos: [CX + dx, 3.6, CZ + 4.03], half: [0.7, 1.6, 0.03], color: 0x9fc4d8 });
  clearings.push(clearing(CX - 4, CZ));
}

// A footbridge over the start straight, full of people watching the field come past.
{
  const BX = 17.5, ZS = -109.5, ZN = -90.5;
  decor.push(
    // (the deck a little narrower and shorter than the towers it rests on, so no faces meet flush)
    { type: 'box', pos: [BX, 5.5, (ZS + ZN) / 2], half: [1.4, 0.15, (ZN - ZS) / 2 + 1.4], color: 0x8c949c },
    { type: 'box', pos: [BX, 2.75, ZS], half: [1.5, 2.75, 1.5], color: 0x9a9a94 },
    { type: 'box', pos: [BX, 2.75, ZN], half: [1.5, 2.75, 1.5], color: 0x9a9a94 },
  );
  // its rails, red with the race's colours, either side
  for (const s of [-1, 1]) decor.push({ type: 'box', pos: [BX + s * 1.47, 6.2, (ZS + ZN) / 2], half: [0.05, 0.55, (ZN - ZS) / 2 + 1.35], color: 0xd23b3b });
  for (let k = 0; k < 7; k++) {
    decor.push(person(BX + (k % 2 ? 0.6 : -0.6), ZS + 3.5 + k * 2, k % 2 ? Math.PI / 2 : -Math.PI / 2, SHIRTS[k % SHIRTS.length], (['wave', 'point', 'stand', 'phone'] as const)[k % 4], false, 5.65));
  }
}

// A farm on a hillside inside the lap: a fenced pasture with cows, a barn, a tractor, hay bales.
{
  // (the flattest spot well away from the road, from a few to choose from)
  const spots: [number, number][] = [[40, -60], [-40, 10], [90, -40], [-80, 30], [70, 30]];
  const slope = (x: number, z: number) => Math.abs(heightAt(TERRAIN, x + 15, z) - heightAt(TERRAIN, x - 15, z)) + Math.abs(heightAt(TERRAIN, x, z + 10) - heightAt(TERRAIN, x, z - 10));
  const ok = spots.filter(([x, z]) => distanceTo(ROAD.line, x, z) > 30);
  const [FX, FZ] = ok.sort((a, b) => slope(...a) - slope(...b))[0] ?? spots[0];
  const yard: Yard = { statics, decor, props: [] };
  // the fence, post and rail
  for (const [x0, z0, x1, z1] of [[-15, -10, 15, -10], [15, -10, 15, 10], [15, 10, -15, 10], [-15, 10, -15, -10]] as const) {
    const len = Math.hypot(x1 - x0, z1 - z0), yaw = Math.atan2(x1 - x0, z1 - z0);
    for (let d = 0; d < len; d += 3) {
      const t = d / len;
      decor.push({ type: 'box', pos: [FX + x0 + (x1 - x0) * t, 0.6, FZ + z0 + (z1 - z0) * t], half: [0.08, 0.6, 0.08], color: 0x6b4a2b });
      decor.push({ type: 'box', pos: [FX + x0 + (x1 - x0) * (t + 1.5 / len), 0.85, FZ + z0 + (z1 - z0) * (t + 1.5 / len)], half: [0.04, 0.05, 1.5], yaw, color: 0x8a6a4a });
    }
  }
  // the cows, black and white
  for (let k = 0; k < 7; k++) {
    const x = FX - 10 + (k % 4) * 6 + (k > 3 ? 3 : 0), z = FZ - 5 + (k > 3 ? 8 : 0) + (k % 2) * 1.5;
    const yaw = k * 1.3, c = Math.cos(yaw), s = Math.sin(yaw);
    const at = (lx: number, lz: number): [number, number] => [x + lx * c + lz * s, z - lx * s + lz * c];
    decor.push({ type: 'box', pos: [x, 0.95, z], half: [0.45, 0.4, 0.9], yaw, color: 0xf4f4f4 });
    const [bx, bz] = at(0, 0.2);
    decor.push({ type: 'box', pos: [bx, 1.0, bz], half: [0.46, 0.25, 0.3], yaw, color: 0x1d1d1f }); // a black patch
    const [hx, hz] = at(0, 1.1);
    decor.push({ type: 'box', pos: [hx, 1.2, hz], half: [0.22, 0.25, 0.3], yaw, color: 0x1d1d1f });
    for (const [lx, lz] of [[-0.3, -0.6], [0.3, -0.6], [-0.3, 0.6], [0.3, 0.6]]) {
      const [px, pz] = at(lx, lz);
      decor.push({ type: 'box', pos: [px, 0.28, pz], half: [0.1, 0.28, 0.1], yaw, color: 0xf4f4f4 });
    }
  }
  // the barn just outside the fence, the tractor at its door, hay bales stacked by it, the farmer
  decor.push(...house(FX + 24, FZ, -Math.PI / 2, 12, 9, 5, 2));
  tractor(yard, FX + 18, FZ + 6, Math.PI, 0x3d8a3d);
  for (const [dx, dz, dy] of [[22, -8, 0], [24, -8, 0], [23, -8, 1]] as const) decor.push({ type: 'box', pos: [FX + dx, 0.5 + dy, FZ + dz], half: [0.95, 0.5, 0.7], color: 0xe3c04a });
  decor.push(person(FX + 17, FZ - 3, -Math.PI / 2, 0x4f6a8a, 'point'));
  clearings.push([[FX - 16, FZ - 11], [FX + 31, FZ - 11], [FX + 31, FZ + 11], [FX - 16, FZ + 11]]);
}

// Wind turbines on the highest ground, well away from the road, turning slowly.
const movers: MoverDef[] = [];
{
  const candidates: [number, number, number][] = [];
  for (let x = -160; x <= 160; x += 20) for (let z = -90; z <= 100; z += 20) {
    if (distanceTo(ROAD.line, x, z) > 35) candidates.push([x, z, heightAt(TERRAIN, x, z)]);
  }
  const picked: [number, number, number][] = [];
  for (const c of candidates.sort((a, b) => b[2] - a[2])) {
    if (picked.length < 4 && picked.every(([x, z]) => Math.hypot(x - c[0], z - c[1]) > 70)) picked.push(c);
  }
  picked.forEach(([x, z, g], k) => {
    const yaw = 0.4 + k * 0.5;
    decor.push({ type: 'box', pos: [x, 15, z], half: [0.8, 15, 0.8], color: 0xf4f4f4 }, { type: 'box', pos: [x + Math.sin(yaw) * 0.6, 30.6, z + Math.cos(yaw) * 0.6], half: [1, 1, 2.4], yaw, color: 0xe8e8e8 });
    movers.push({ type: 'propeller', pos: [x + Math.sin(yaw) * 3.3, g + 30.6, z + Math.cos(yaw) * 3.3], yaw, half: [0.7, 9, 0.25], angle: 0, blades: 3, spin: 0.5 + k * 0.07, color: 0xf4f4f4 });
    clearings.push(clearing(x, z));
  });
}

// The highlight: a castle ruin on a hilltop of its own, broken walls round a yard, a tower
// still standing with a flag on it.
{
  const spots: [number, number, number][] = [];
  for (let x = -150; x <= 150; x += 15) for (let z = -80; z <= 95; z += 15) {
    const free = distanceTo(ROAD.line, x, z) > 30 && clearings.every((c) => Math.hypot(c[0][0] + 1 - x, c[0][1] + 1 - z) > 45);
    if (free) spots.push([x, z, heightAt(TERRAIN, x, z)]);
  }
  const [KX, KZ] = spots.sort((a, b) => b[2] - a[2])[0] ?? [-60, 60, 0];
  const STONE = 0x9a948a, DARK = 0x7d776c;
  // the walls, eight metres either side of the middle, with gaps where they have fallen
  for (const [dx, dz, along] of [[0, -8, true], [0, 8, true], [-8, 0, false], [8, 0, false]] as const) {
    for (let k = -3; k <= 3; k++) {
      if ((dx + dz + k * 7) % 5 === 0) continue;
      const h = 2.2 + ((k * k + dx) % 3) * 0.7;
      const [x, z] = along ? [KX + dx + k * 2.2, KZ + dz] : [KX + dx, KZ + dz + k * 2.2];
      decor.push({ type: 'box', pos: [x, h / 2, z], half: along ? [1.08, h / 2, 0.5] : [0.5, h / 2, 1.08], color: k % 2 ? STONE : DARK });
    }
  }
  // the tower in a corner, its battlements, and the flag
  decor.push({ type: 'box', pos: [KX + 8, 6, KZ + 8], half: [2.2, 6, 2.2], color: STONE });
  for (const [ox, oz] of [[-1.8, -1.8], [1.8, -1.8], [-1.8, 1.8], [1.8, 1.8], [0, -1.8], [0, 1.8], [-1.8, 0], [1.8, 0]] as const) {
    decor.push({ type: 'box', pos: [KX + 8 + ox, 12.4, KZ + 8 + oz], half: [0.38, 0.4, 0.38], color: DARK });
  }
  decor.push(
    { type: 'box', pos: [KX + 8, 15, KZ + 8], half: [0.06, 2.6, 0.06], color: 0xd8dde2 },
    { type: 'box', pos: [KX + 8.8, 16.9, KZ + 8], half: [0.75, 0.45, 0.02], color: 0xd23b3b },
    person(KX + 2, KZ - 2, 0.7, SHIRTS[4], 'point'),
    person(KX + 3, KZ - 2.6, 0.4, SHIRTS[1], 'phone'),
  );
  clearings.push(clearing(KX, KZ), clearing(KX + 8, KZ + 8));
}

// Woods over the hills, clear of the road, the village, the church, the farm and the turbines.
decor.push(...forest({ x: [-182, 182], z: [-120, 118], count: 170, seed: 9, avoid: [ROAD.line, ...clearings], clear: 10 }));

export const SCHLEIFE: TrackDef = {
  id: 'schleife',
  name: L('Große Schleife', 'Grand Loop'),
  blurb: L(`Lang, flüssig, bergauf und bergab, durch Wald und Dorf: ${Math.round(ROAD.length / 10) * 10} m pro Runde, ${Math.round(Math.max(...ROAD.heights))} m Höhenunterschied.`, `Long and flowing, uphill and down, through woods and a village: ${Math.round(ROAD.length / 10) * 10} m a lap, ${Math.round(Math.max(...ROAD.heights))} m of climb.`),
  unlockPrice: 275,
  lapPay: 80,
  spawn: ROAD.spawn,
  statics,
  props: [],
  gates: ROAD.gates,
  pickups: [],
  decor,
  movers,
  line: ROAD.line,
  roadHalf: WIDTH / 2,
  terrain: TERRAIN,
};
