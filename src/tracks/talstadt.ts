import { L } from '../i18n';
import { BRAND_COLORS } from '../config/vehicles';
import type { TrackDef } from '../sim/Track';
import { distanceTo, forest } from './scenery';
import { site } from './site';
import {
  armyTruck, at, baler, barrels, bikeShed, canopy, car, container, door, gate, glassFront, hall, lorry, panel, roadSpan,
  shelter, sidesOf, smoke, tractor, unimog, windows, wingDoors, type Yard,
} from './works';

// The works in Talstadt: one big two-storey building (high halls, about 6 m a floor) with a
// saw-tooth north side and the office corner in the west, the lap all round it. The footprint
// was read off an aerial picture; what is where was told side by side, numbered as on the
// sketch (1 to 14, clockwise from the west corner).
const ROAD_WIDTH = 7;
const SITE = site({
  outline: [
    [105, 300], [290, 115], [345, 150], [400, 95], [455, 120], [500, 125], [625, 240],
    [545, 345], [500, 335], [445, 445], [360, 395], [275, 470], [190, 495], [55, 365],
  ],
  picture: [670, 595],
  scale: 0.25,
  margin: 9,
  roadWidth: ROAD_WIDTH,
  wallColor: 0xb9bcc2,
  roofColor: 0x5a6068,
  height: 12,
  yard: 55,
});

const FLOOR = 6;
const y: Yard = { statics: [], decor: [], props: [] };
const S = sidesOf(SITE.outline);
/** Side by the sketch's number. */
const side = (k: number) => S[k - 1];
/** How far out the road's near and far edges are, at a share of a side's length. */
const road = (k: number, t: number) => roadSpan(SITE.line!, side(k), side(k).len * t, ROAD_WIDTH / 2);
const across = (k: number, t: number, beyond: number) => at(side(k), side(k).len * t, road(k, t)[1] + beyond);
/** Headings: facing the building, and facing away from it, from in front of a side. */
const toBuilding = (k: number) => Math.atan2(-side(k).n[0], -side(k).n[1]);
const outward = (k: number) => Math.atan2(side(k).n[0], side(k).n[1]);
/** Whether a spot is well clear of the road (for whatever is parked). */
const clear = ([x, z]: [number, number], room = 5.5) => distanceTo(SITE.line!, x, z) > room;

// Between the floors a band all the way round.
for (const s of S) y.decor.push(panel(s, 0, s.len, FLOOR - 0.12, FLOOR + 0.12, 0x8c939a, 0.02));

// 1: gates and windows below, plain hall wall above.
{
  const s = side(1);
  for (const m of [10, 31, 52]) y.decor.push(...gate(s, m, 4.5, 4.6));
  y.decor.push(...windows(s, 14, 27, 1.6, 2.2), ...windows(s, 35, 48, 1.6, 2.2), ...windows(s, 56, 64, 1.6, 2.2));
}
// 2 and 3: gates and doors, the battery and waste containers, the cardboard baler, and light
// drums out on the road to swerve round (they go flying when hit).
{
  y.decor.push(...gate(side(2), 6, 4.2, 4.6), ...door(side(2), 12.5));
  y.decor.push(...door(side(3), 3), ...gate(side(3), 10, 4.5, 4.6), ...door(side(3), 16.5));
  const [bx, bz] = at(side(2), 8, 5);
  container(y, bx, bz, side(2).yaw, 2.4, 6, 2.6, 0x2f6db5); // batteries for disposal
  const [wx, wz] = at(side(3), 5, 6);
  container(y, wx, wz, side(3).yaw, 2.3, 5.5, 1.8, 0x3d7a3d); // waste skip
  const [px, pz] = at(side(3), 15, 3);
  baler(y, px, pz, side(3).yaw + Math.PI / 2);
  const drums: [number, number][] = [];
  for (const [k, t, off] of [[2, 0.3, 0.3], [2, 0.7, 0.65], [3, 0.2, 0.45], [3, 0.5, 0.2], [3, 0.55, 0.75], [3, 0.85, 0.4]] as const) {
    const [n, f] = road(k, t);
    drums.push(at(side(k), side(k).len * t, n + (f - n) * off));
  }
  barrels(y, drums);
}
// 4, 5: windows below.
y.decor.push(...windows(side(4), 1, 14, 1.6, 2.2), ...windows(side(5), 1, 10, 1.6, 2.2));
// 6: windows, and a gate at the end towards 7; across the road the smokers' shelter.
{
  const s = side(6);
  y.decor.push(...windows(s, 1, 34, 1.6, 2.2), ...gate(s, 38.5, 4.2, 4.6));
  const [x, z] = across(6, 0.85, 3);
  shelter(y, x, z, toBuilding(6));
}
// 7 to 9: windows below, no gates; across the road the big staff car park, the cars
// side-on to the building. Deliveries at 8, between 7 and 9: a loading dock and lorries.
y.decor.push(...windows(side(7), 1, 32, 1.6, 2.2), ...windows(side(9), 1, 29.5, 1.6, 2.2));
{
  const colours = [0x2f6db5, 0xd23b3b, 0xc8c8c8, 0x404850, 0x2e7d4f, 0xe3c04a, 0xf2f2f2, 0x8a2c5a, 0x1c1c1f];
  let c = 0;
  for (const k of [7, 9]) {
    const s = side(k);
    for (let row = 0; row < 3; row++) {
      for (let t = 0.08; t < 0.95; t += 4.8 / s.len) {
        if ((c++ * 7) % 5 === 0) continue; // a few spaces free
        const [x, z] = across(k, t, 4 + row * 6);
        if (!clear([x, z])) continue;
        y.decor.push(...car(x, z, s.yaw + (row % 2 ? Math.PI : 0), colours[c % colours.length]));
      }
    }
  }
  const s = side(8);
  // the dock: a raised platform along the wall with two dock doors and bumpers
  const [dx, dz] = at(s, s.len / 2, 0.4 + 1.5);
  y.statics.push({ pos: [dx, 0.6, dz], half: [1.5, 0.6, s.len / 2 - 0.5], quat: [0, Math.sin(s.yaw / 2), 0, Math.cos(s.yaw / 2)], color: 0x8c949c });
  for (const m of [3.2, 8.3]) {
    y.decor.push(...gate(s, m, 3, 3.6, 0x7d8a96));
    y.decor.push(panel(s, m - 1.7, m + 1.7, 3.7, 4.5, 0x2a2a2e, 0.25)); // dock shelter
    // backed up to the dock, cab out
    const [lx, lz] = at(s, m, 3.5 + 8.2);
    lorry(y, lx, lz, outward(8), m < 5 ? 0xd23b3b : 0xf2f2f2, 0xd8dde2);
  }
}
// 10: two big hinged doors below.
y.decor.push(...wingDoors(side(10), 7, 4, 4.8), ...wingDoors(side(10), 17.5, 4, 4.8));
// 11: the canteen entrance, a canopy on slim pillars; windows on both floors from here on.
{
  const s = side(11);
  canopy(y, s, 14, 8, 3.6, () => [3.6]);
  y.decor.push(...glassFront(s, 11.5, 16.5, 0, 3), ...windows(s, 1, 10, 1.6, 2.2), ...windows(s, 18, 27, 1.6, 2.2));
  y.decor.push(...windows(s, 1, 27, FLOOR + 1.6, 2.4));
}
// 12: windows on both floors, and up on the corner to 11 the big purple square.
{
  const s = side(12);
  y.decor.push(...windows(s, 1, 21, 1.6, 2.2), ...windows(s, 10, 21, FLOOR + 1.6, 2.4));
  y.decor.push(panel(s, 2, 8, FLOOR + 0.6, FLOOR + 5.4, 0xf4f4f4, 0.03), panel(s, 2.4, 7.6, FLOOR + 1.0, FLOOR + 5.0, BRAND_COLORS.purple, 0.06));
}
// 13: windows on both floors; towards 14 the meeting rooms behind big glass fronts, round the corner.
{
  const s = side(13);
  y.decor.push(...windows(s, 1, 36, 1.6, 2.2), ...windows(s, 1, 36, FLOOR + 1.6, 2.4), ...glassFront(s, 38, s.len - 0.3, 0.3, 11.4));
  y.decor.push(...glassFront(side(14), 0.3, 5, 0.3, 11.4));
}
// 14: the main entrance under a canopy reaching out over the road, the lap running between
// its pillars; windows upstairs, and across the road the place that mends trucks.
{
  const s = side(14);
  const mid = 12.5;
  // one row of pillars between the wall and the road, one beyond it, wherever the road runs
  canopy(y, s, mid, 9, 4.6, (along) => {
    const [near, far] = roadSpan(SITE.line!, s, along, ROAD_WIDTH / 2);
    return [near - 1.6, far + 1.2];
  });
  y.decor.push(...glassFront(s, mid - 2.5, mid + 2.5, 0, 3.2), ...windows(s, 6, 19, FLOOR + 1.6, 2.4));
  y.decor.push(...windows(s, 16, 20, 1.6, 2.2));
  // the utility vehicle workshop: a big hall facing the road, its customers parked in front
  const [hx, hz] = across(14, 0.5, 22);
  hall(y, hx, hz, toBuilding(14), 34, 18, 9, 0xc9c5ba, 0x4a4d52, 8);
  const [ux, uz] = across(14, 0.15, 6);
  unimog(y, ux, uz, s.yaw, 0xd9822b);
  const [ax, az] = across(14, 0.55, 7);
  armyTruck(y, ax, az, s.yaw + Math.PI);
  const [tx, tz] = across(14, 0.9, 5);
  tractor(y, tx, tz, s.yaw - 0.4, 0x3d8a3d);
  // its engine is running
  const [sx, sz] = across(14, 0.9, 5.3);
  y.decor.push(smoke(sx, 2.7, sz));
}
// Across from 14 and 1: visitors' parking, cars nose out and tails to the building; across the
// middle of 1 the bicycle shed and another shelter.
{
  const s = side(1);
  for (let t = 0.04; t < 0.32; t += 2.8 / s.len) {
    const [x, z] = across(1, t, 5.5);
    if (!clear([x, z])) continue;
    y.decor.push(...car(x, z, outward(1), [0xc8c8c8, 0x2f6db5, 0x404850, 0xd23b3b][Math.round(t * 50) % 4]));
  }
  const [bx, bz] = across(1, 0.5, 4);
  bikeShed(y, bx, bz, s.yaw, 9);
  const [hx, hz] = across(1, 0.62, 3.5);
  shelter(y, hx, hz, toBuilding(1));
}
// Trees beyond the yard.
const [LX, LZ] = SITE.lot;
y.decor.push(
  ...forest({ x: [-LX - 40, LX + 40], z: [LZ + 8, LZ + 40], count: 40, seed: 31 }),
  ...forest({ x: [-LX - 40, LX + 40], z: [-LZ - 40, -LZ - 8], count: 40, seed: 32 }),
);

export const TALSTADT: TrackDef = {
  id: 'talstadt',
  name: L('Werk Talstadt', 'Talstadt Works'),
  blurb: L(`Einmal ums Werk: ${Math.round(SITE.length / 10) * 10} m um die große Halle, durch das Vordach am Haupteingang, vorbei an Laderampe, Parkplatz und Lkw-Werkstatt.`, `Once round the works: ${Math.round(SITE.length / 10) * 10} m round the big hall, through the canopy at the main entrance, past the loading dock, the car park and the truck workshop.`),
  unlockPrice: 100,
  lapPay: 35,
  spawn: SITE.spawn,
  statics: [...SITE.statics, ...y.statics],
  props: y.props,
  gates: SITE.gates,
  pickups: [],
  decor: [...SITE.decor, ...y.decor],
  line: SITE.line,
};
