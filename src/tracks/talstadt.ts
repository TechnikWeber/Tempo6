import { L } from '../i18n';
import { BRAND_COLORS } from '../config/vehicles';
import type { TrackDef, TrafficDef } from '../sim/Track';
import { distanceTo, forest } from './scenery';
import { site } from './site';
import {
  armyTruck, at, baler, barrels, bikeShed, breakTable, canopy, car, container, door, frame, gate, glassFront, hall, lorry, pallets, panel, person,
  roadSpan, roadworks, roofTop, shelter, sidesOf, smoke, snackStand, tractor, tyres, unimog, windows, wingDoors, type Yard,
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
const forklift: TrafficDef[] = [];
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
    y.decor.push(panel(s, m - 1.75, m + 1.75, 3.7, 4.5, 0x2a2a2e, 0.25)); // dock shelter, a little wider than the gate's frame
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
// A forklift going up and down beyond the lorries at the dock.
{
  const s = side(8);
  const loop: [number, number][] = [at(s, 1, 21), at(s, s.len - 1, 21), at(s, s.len - 1, 25), at(s, 1, 25)];
  forklift.push({ type: 'forklift', color: 0xf2b705, speed: 2.5, path: loop });
}
// A clock over the main entrance, telling the real time.
{
  const s = side(14);
  // (in front of the windows behind it)
  const [x, z] = at(s, 12.5, 0.55);
  y.decor.push({ type: 'clock', pos: [x, FLOOR + 3, z], half: [1.1, 0, 0], yaw: Math.atan2(s.n[0], s.n[1]) });
}

// People about the place. Shirts for the office, the canteen and the shop floor.
const SHIRTS = [0x4a7ab5, 0xf2f2f2, 0xd23b3b, 0x3f8f5f, 0x7b2d8e, 0xe3c04a, 0x2a2a2e, 0xc8c8c8];
const walkers: TrafficDef[] = [];
/** A spot `out` metres beyond the far edge of the road (negative: towards the wall), facing the building. */
const beside = (k: number, t: number, out: number) => across(k, t, out);
// at the smokers' shelter by 6: two standing, one on the bench
{
  const [x, z] = across(6, 0.85, 3);
  const f = frame(x, z, toBuilding(6));
  const yaw = toBuilding(6);
  y.decor.push(
    person(...f(-0.6, -0.45), yaw, SHIRTS[3], 'sit', false, 0.05),
    person(...f(0.6, 0.35), yaw - 0.6, SHIRTS[2], 'phone'),
    person(...f(2.3, 0.6), yaw + 2.2, SHIRTS[0]),
  );
}
// the canteen at 11: tables across the road for the break, people on the way over
{
  const yaw = side(11).yaw;
  for (const [t, n] of [[0.3, 3], [0.62, 4]] as const) breakTable(y, ...beside(11, t, 4.5), yaw, SHIRTS.slice(n), n);
  y.decor.push(person(...beside(11, 0.46, 3), outward(11), SHIRTS[5], 'wave'), person(...beside(11, 0.48, 4), outward(11) + 2.6, SHIRTS[1]));
  // going over for lunch and back, across the road
  const s = side(11);
  walkers.push({ type: 'walker', color: SHIRTS[6], speed: 1.2, path: [at(s, s.len * 0.5, 3), across(11, 0.5, 1.5), across(11, 0.52, 1.5), at(s, s.len * 0.52, 3)] });
}
// by the main entrance at 14: visitors waiting under the canopy, beyond the road
{
  y.decor.push(
    person(...beside(14, 0.36, 1.6), toBuilding(14), SHIRTS[7]),
    person(...beside(14, 0.4, 1.8), toBuilding(14) + 0.8, SHIRTS[4], 'point'),
    person(...beside(14, 0.66, 2), toBuilding(14) - 0.4, SHIRTS[0], 'phone'),
  );
}
// at the truck workshop: the mechanics, and old tyres lying about and stacked
{
  y.decor.push(person(...across(14, 0.15, 3.3), side(14).yaw + 1.2, 0x2b3a5a, 'point', true), person(...across(14, 0.9, 7.6), outward(14), 0x2b3a5a, 'stand', true));
  const spots: [number, number][] = [];
  for (const [t, d] of [[0.25, 3], [0.28, 4.2], [0.31, 3.4], [0.72, 2.5], [0.75, 3.6], [0.4, 0.6], [0.6, 0.2]] as const) spots.push(across(14, t, d));
  tyres(y, spots, [3, 2, 1, 2, 4, 1, 1]);
}
// the yard at 2 and 3: a few tyres among the drums, and the crew round the baler
{
  const spots: [number, number][] = [];
  for (const [k, t, off] of [[2, 0.5, 0.15], [3, 0.35, 0.6], [3, 0.7, 0.1]] as const) {
    const [n, fr] = road(k, t);
    spots.push(at(side(k), side(k).len * t, n + (fr - n) * off));
  }
  tyres(y, spots, [1, 2, 1]);
  y.decor.push(person(...at(side(3), 13, 2.2), side(3).yaw + Math.PI, 0x3a3a40, 'carry', true), person(...at(side(2), 4.5, 3.3), outward(2) + 0.3, 0x2b3a5a, 'stand', true));
}
// the dock at 8: somebody up on the dock seeing the lorries in, workers carrying boxes from
// the lorries to the pallets and back
{
  const s = side(8);
  y.decor.push(person(...at(s, 5.8, 1.4), outward(8), 0x3a3a40, 'point', true, 1.2), person(...at(s, 10.5, 2.4), outward(8) + 1.2, 0x2b3a5a, 'carry', true, 1.2));
  // (over the road to the pallets beyond it)
  const [, far] = roadSpan(SITE.line!, s, 0, ROAD_WIDTH / 2);
  for (const o of [0, 11]) {
    walkers.push({ type: 'walker', color: 0x2b3a5a, speed: 1.1, worker: true, offset: o, path: [at(s, -0.4, 7), at(s, -0.4, far + 1.5), at(s, 0.1, far + 1.5), at(s, 0.1, 7)] });
  }
  pallets(y, ...at(s, -1.6, far + 2.6), s.yaw + Math.PI / 2, 3);
}
// Roadworks: the inner lane shut along 13, the outer one along 7 (the way through swaps over).
{
  const lane = (k: number, inner: boolean) => (along: number): [number, number] => {
    const [n, f] = roadSpan(SITE.line!, side(k), along, ROAD_WIDTH / 2);
    return inner ? [n + 0.1, n + 2.6] : [f - 0.1, f - 2.6];
  };
  roadworks(y, side(13), 8, 30, lane(13, true), L('BAUSTELLE', 'ROADWORKS'));
  roadworks(y, side(7), 6, 24, lane(7, false), L('BAUSTELLE', 'ROADWORKS'));
}

// On the roof: air handling, vent stacks breathing out, skylights, solar panels.
roofTop(y, SITE.outline, 12, 71, 30);
// Workers walking along the walls of 4, 5 and 12, between the windows and the road.
for (const [k, o] of [[4, 0], [5, 6], [12, 12]] as const) {
  const s = side(k);
  walkers.push({ type: 'walker', color: k === 12 ? SHIRTS[0] : 0x2b3a5a, speed: 1.1, worker: k !== 12, offset: o, path: [at(s, 2, 3), at(s, s.len - 2, 3), at(s, s.len - 2, 3.6), at(s, 2, 3.6)] });
}
// A sausage stand across from the canteen, for those who would rather eat outside: its back
// to the road, so the queue stands out in the yard and not on the tarmac.
snackStand(y, ...across(11, 0.88, 3), outward(11), SHIRTS, 3);
// Flags by the main entrance, in the maker's colours.
for (const [along, c] of [[1, BRAND_COLORS.purple], [3, 0xf4f4f4], [5, BRAND_COLORS.purple]] as const) {
  const s = side(14);
  const [fx, fz] = across(14, along / s.len, 1.5);
  // (each flag flying off its pole along the wall, clear of the next pole)
  y.decor.push({ type: 'box', pos: [fx, 4.5, fz], half: [0.06, 4.5, 0.06], color: 0xd8dde2 }, { type: 'box', pos: [fx + s.u[0] * 0.66, 8.3, fz + s.u[1] * 0.66], half: [0.02, 0.5, 0.6], yaw: s.yaw, color: c });
}

// The yard's own four corners, inside the wall but well clear of the building and the road
// loop (which hugs the footprint closely): small sheds, so the lot does not feel so empty.
// A couple of bigger halls further out again, past the wall, read as neighbours in the
// background rather than part of the works itself.
const [LX, LZ] = SITE.lot;
for (const [cx, cz, yaw] of [[LX - 20, LZ - 15, 0.2], [-LX + 20, LZ - 15, -0.15], [LX - 18, -LZ + 17, 0.4], [-LX + 22, -LZ + 15, -0.3]] as const) {
  hall(y, cx, cz, yaw, 16, 12, 6, 0xb9bcc2, 0x5a6068, 4);
}
hall(y, LX + 70, 30, -0.25, 40, 22, 10, 0xaab0b6, 0x474c52, 9);
hall(y, -LX - 75, -40, 0.3, 36, 20, 9, 0xaab0b6, 0x474c52, 8);

y.decor.push(
  ...forest({ x: [-LX - 40, LX + 40], z: [LZ + 8, LZ + 40], count: 40, seed: 31 }),
  ...forest({ x: [-LX - 40, LX + 40], z: [-LZ - 40, -LZ - 8], count: 40, seed: 32 }),
  ...forest({ x: [LX + 8, LX + 40], z: [-LZ, LZ], count: 24, seed: 33 }),
  ...forest({ x: [-LX - 40, -LX - 8], z: [-LZ, LZ], count: 24, seed: 34 }),
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
  roadHalf: ROAD_WIDTH / 2,
  traffic: [...forklift, ...walkers],
};
