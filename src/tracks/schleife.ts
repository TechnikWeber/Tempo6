import { L } from '../i18n';
import type { BoxDef, DecorDef, TrackDef } from '../sim/Track';
import { rimHills, road, terrainFor } from './road';
import { distanceTo, forest, house, stand } from './scenery';
import { person } from './works';

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
const TERRAIN = rimHills(terrainFor(ROAD, [LOT_X, LOT_Z], GRASS), 10, 35);

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
// Woods over the hills, clear of the road and of the village.
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
  line: ROAD.line,
  roadHalf: WIDTH / 2,
  terrain: TERRAIN,
};
