import type { BoxDef, PropDef, TrackDef, TrafficDef } from '../sim/Track';
import { distanceTo, forest } from './scenery';
import { site } from './site';
import { at, car, door, gate, hall, lorry, pallets, panel, roadSpan, sidesOf, windows, type Side, type Yard } from './works';

// The old works at Porta Westfalica: several halls grown together at an angle, the lap all
// round. The footprint was read off an aerial picture; what is where was told side by side,
// numbered as on the sketch (1 to 12, clockwise from the west corner). Along side 1 runs the
// railway, the deliveries come in on that side too.
const OUTLINE: [number, number][] = [
  [75, 345], [215, 105], [245, 95], [340, 115], [385, 60], [625, 225],
  [580, 295], [685, 385], [625, 475], [525, 410], [410, 565], [255, 470],
];
const PICTURE: [number, number] = [743, 624];
const SCALE = 0.25;
const ROAD_WIDTH = 7;
const HEIGHT = 8;

// The railway: past side 1 at about 20° to it, closest at the end towards 2 and opening out
// towards 1, beyond the road. It is worked out on the footprint, before the site is built,
// because the boundary wall needs a gap where the line goes through.
const world = OUTLINE.map(([px, py]): [number, number] => [(px - PICTURE[0] / 2) * SCALE, (PICTURE[1] / 2 - py) * SCALE]);
const ONE = sidesOf(world)[0];
const RAIL_ANGLE = (20 * Math.PI) / 180;
/** Along the rails, the way the train runs (from 1 towards 2), and out away from the works. */
const ALONG: [number, number] = [ONE.u[0] * Math.cos(RAIL_ANGLE) - ONE.n[0] * Math.sin(RAIL_ANGLE), ONE.u[1] * Math.cos(RAIL_ANGLE) - ONE.n[1] * Math.sin(RAIL_ANGLE)];
const AWAY: [number, number] = [-ALONG[1], ALONG[0]];
if (AWAY[0] * ONE.n[0] + AWAY[1] * ONE.n[1] < 0) [AWAY[0], AWAY[1]] = [-AWAY[0], -AWAY[1]];
/** A point on the rails `s` metres along from where they pass the corner of 1 and 2. */
const RAIL_AT_B = 27;
const rail = (s: number): [number, number] => [ONE.b[0] + ONE.n[0] * RAIL_AT_B + ALONG[0] * s, ONE.b[1] + ONE.n[1] * RAIL_AT_B + ALONG[1] * s];
const RAIL_REACH = 420;

const SITE = site({
  outline: OUTLINE,
  picture: PICTURE,
  scale: SCALE,
  margin: 9,
  roadWidth: ROAD_WIDTH,
  wallColor: 0xb8a48c,
  roofColor: 0x4a4d52,
  height: HEIGHT,
  yard: 55,
  crossings: [[rail(-RAIL_REACH), rail(RAIL_REACH)]],
});

const y: Yard = { statics: [], decor: [], props: [] };
const S = sidesOf(SITE.outline);
const side = (k: number): Side => S[k - 1];
const road = (k: number, t: number) => roadSpan(SITE.line!, side(k), side(k).len * t, ROAD_WIDTH / 2);
const across = (k: number, t: number, beyond: number) => at(side(k), side(k).len * t, road(k, t)[1] + beyond);
const toBuilding = (k: number) => Math.atan2(-side(k).n[0], -side(k).n[1]);
const clear = ([x, z]: [number, number], room = 5.5) => distanceTo(SITE.line!, x, z) > room;
const COLOURS = [0x2f6db5, 0xd23b3b, 0xc8c8c8, 0x404850, 0x2e7d4f, 0xe3c04a, 0xf2f2f2, 0x8a2c5a];

// The old brick halls: a row of windows high up on every side, a few doors.
for (const s of S) {
  // (high enough to clear the gates below)
  if (s.len > 12) y.decor.push(...windows(s, 1, s.len - 1, 5.4, 1.5, 4.2, 2.8));
  y.decor.push(panel(s, 0, s.len, HEIGHT - 0.6, HEIGHT - 0.3, 0x8a6a52, 0.02));
}
y.decor.push(...door(side(3), 6), ...door(side(5), 20), ...door(side(5), 50), ...door(side(11), 12), ...door(side(12), 30));

// 1: the deliveries. Gates along the side, a lorry unloading beside the wall, pallets.
{
  const s = side(1);
  for (const m of [12, 30, 48, 62]) y.decor.push(...gate(s, m, 4.5, 4.8));
  const [lx, lz] = at(s, 38, 2.2);
  lorry(y, lx, lz, s.yaw + Math.PI, 0x2f6db5, 0xe8e4d8);
  for (const m of [20, 54]) {
    const [px, pz] = at(s, m, 1.5);
    pallets(y, px, pz, s.yaw + Math.PI / 2, 3);
  }
}

// The railway beyond the road: a ballast bed, two rails, sleepers; and a train coming as the
// lap starts, running from 1 towards 2.
{
  const yaw = Math.atan2(ALONG[0], ALONG[1]);
  const [mx, mz] = rail(0);
  y.decor.push({ type: 'box', pos: [mx, 0.12, mz], half: [2.2, 0.12, 300], yaw, color: 0x7d776c });
  for (const e of [-0.75, 0.75]) y.decor.push({ type: 'box', pos: [mx + AWAY[0] * e, 0.3, mz + AWAY[1] * e], half: [0.05, 0.06, 300], yaw, color: 0x8d9299 });
  for (let s = -150; s <= 150; s += 2.5) {
    const [x, z] = rail(s);
    y.decor.push({ type: 'box', pos: [x, 0.26, z], half: [1.3, 0.02, 0.15], yaw, color: 0x5a4636 });
  }
  // overhead line masts on the far side
  for (let s = -150; s <= 150; s += 40) {
    const [x, z] = rail(s);
    y.decor.push(
      { type: 'box', pos: [x + AWAY[0] * 3, 3.5, z + AWAY[1] * 3], half: [0.15, 3.5, 0.15], color: 0x6b7078 },
      { type: 'box', pos: [x + AWAY[0] * 1.6, 6.9, z + AWAY[1] * 1.6], half: [1.5, 0.08, 0.08], yaw: yaw + Math.PI / 2, color: 0x6b7078 },
    );
  }
}
// (the train goes on round a loop far out of sight, and is back next time)
const far = 700;
const trainPath: [number, number][] = [rail(-RAIL_REACH), rail(RAIL_REACH)].flatMap((p) => [p]);
trainPath.push([trainPath[1][0] + AWAY[0] * far, trainPath[1][1] + AWAY[1] * far], [trainPath[0][0] + AWAY[0] * far, trainPath[0][1] + AWAY[1] * far]);
const train: TrafficDef[] = [0, 1, 2, 3].map((k) => ({ type: 'train', color: 0xc22a2a, speed: 16, offset: RAIL_REACH - 190 - k * 19.7, path: trainPath }));

// Across from 12 (and 11): a few small buildings.
for (const [k, t] of [[12, 0.25], [12, 0.65], [11, 0.4]] as const) {
  const [x, z] = across(k, t, 10);
  hall(y, x, z, toBuilding(k), 12, 9, 4.5, 0xd9c7a8, 0x7a4a2a, 3.5);
}
// Across from 5: a long hall alongside.
{
  const [x, z] = across(5, 0.5, 13);
  hall(y, x, z, toBuilding(5), 60, 14, 7, 0xc9c5ba, 0x4a4d52, 5);
}
// Across from 6 to 10: another long hall, end-on to the works.
{
  const [x, z] = across(8, 0.5, 26);
  hall(y, x, z, toBuilding(8), 16, 40, 7, 0xc9c5ba, 0x5a5f66, 6);
}
// Between 9 and 10: parking along the wall, on the near side of the road.
{
  let c = 0;
  for (const [k, from, to] of [[9, 2, 26], [10, 2, 20]] as const) {
    const s = side(k);
    for (let m = from; m < to; m += 2.7) {
      const spot = at(s, m, 3.2);
      if (!clear(spot)) continue;
      y.decor.push(...car(spot[0], spot[1], toBuilding(k), COLOURS[c++ % COLOURS.length]));
    }
  }
}
// In the corner of 6 and 7 the little house of the competition (manual chairs, no motors):
// the lap runs straight through it, past their empty chairs.
const chairs: PropDef[] = [];
{
  const corner = side(7).a;
  let best = 0, bestD = Infinity;
  SITE.line!.forEach(([x, z], i) => {
    const d = Math.hypot(x - corner[0], z - corner[1]);
    if (d < bestD) [best, bestD] = [i, d];
  });
  const line = SITE.line!;
  const [hx, hz] = line[best];
  const [ax, az] = line[(best + line.length - 3) % line.length], [bx, bz] = line[(best + 3) % line.length];
  const yaw = Math.atan2(bx - ax, bz - az);
  const lx = Math.cos(yaw), lz = -Math.sin(yaw);
  const q: [number, number, number, number] = [0, Math.sin(yaw / 2), 0, Math.cos(yaw / 2)];
  // two side walls clear of the road, a roof across, a sign over the way in
  for (const e of [-1, 1]) {
    const w = ROAD_WIDTH / 2 + 1.3;
    y.statics.push({ pos: [hx + lx * w * e, 1.7, hz + lz * w * e], half: [0.25, 1.7, 5], quat: q, color: 0xe6d2c4 } as BoxDef);
    y.decor.push({ type: 'box', pos: [hx + lx * (w + 0.27) * e, 1.6, hz + lz * (w + 0.27) * e], half: [0.02, 0.5, 1.2], yaw, color: 0x9fc4d8 });
  }
  y.decor.push({ type: 'box', pos: [hx, 3.65, hz], half: [ROAD_WIDTH / 2 + 2.1, 0.25, 5.6], yaw, color: 0x8a3b2e });
  // empty chairs on the floor, and a few more outside
  for (const [side_, ahead] of [[-1.5, -2], [1.2, 0.5], [-0.3, 2.8], [1.8, -3.5]]) {
    chairs.push({ type: 'chair', pos: [hx + lx * side_ + Math.sin(yaw) * ahead, 0.46, hz + lz * side_ + Math.cos(yaw) * ahead], yaw: yaw + ahead });
  }
  // and their staff parking, across the road from the house
  let c = 3;
  for (let k = -3; k <= 3; k++) {
    const d = ROAD_WIDTH / 2 + 7;
    const spot: [number, number] = [hx - lx * d + Math.sin(yaw) * k * 2.8, hz - lz * d + Math.cos(yaw) * k * 2.8];
    if (!clear(spot)) continue;
    y.decor.push(...car(spot[0], spot[1], yaw + Math.PI / 2, COLOURS[c++ % COLOURS.length]));
  }
}

// Trees beyond the yard.
const [LX, LZ] = SITE.lot;
y.decor.push(
  ...forest({ x: [-LX - 40, LX + 40], z: [-LZ - 40, -LZ - 8], count: 40, seed: 41 }),
  ...forest({ x: [LX + 8, LX + 40], z: [-LZ, LZ], count: 20, seed: 42 }),
);

export const WESERTOR: TrackDef = {
  id: 'wesertor',
  name: 'Altwerk Porta Westfalica',
  blurb: `Einmal ums alte Werk: ${Math.round(SITE.length / 10) * 10} m um verwinkelte Hallen, an der Bahnlinie entlang und mitten durchs Häuschen der Konkurrenz.`,
  unlockPrice: 150,
  lapPay: 40,
  spawn: SITE.spawn,
  statics: [...SITE.statics, ...y.statics],
  props: [...y.props, ...chairs],
  gates: SITE.gates,
  pickups: [],
  decor: [...SITE.decor, ...y.decor],
  line: SITE.line,
  traffic: train,
};
