import { easedRamp, ramp, type BoxDef, type DecorDef, type MoverDef, type PickupDef, type PropDef, type SpinnerDef, type TrackDef } from '../sim/Track';

const FLOOR = 0x5d8f4e;
const PAVING = 0xd2ccbc;
const CONCRETE = 0x9a9a94;
const WOOD = 0xc9a15a;
const RAIL = 0xf2c230;
const STEEL = 0x8c949c;

// The training course every vehicle has to get through once, at walking pace. Small, so
// nothing is a long crawl: a square of about 27 × 23 m driven clockwise, one toy after the
// other. South: slalom and bumps. East: the seesaw, then the rocking bridge. North: the
// turntable and a kerb. West: up onto the balance beam and down again.
const EAST = Math.PI / 2;
const WEST = -Math.PI / 2;
const NORTH = 0;
const SOUTH = Math.PI;
const S = -11;
const N = 12;
const E = 13;
const W = -14;
/** Half width of the planks and ramps, and of the lane between the rails. */
const PLANK = 0.85;
const LANE = 1.35;
/** Plank thickness, as the movers have it. */
const T = 0.06;

const statics: BoxDef[] = [
  { pos: [0, -0.5, 0], half: [19, 0.5, 16], color: FLOOR },
  { pos: [0, 0.3, 16], half: [19, 0.3, 0.3], color: CONCRETE },
  { pos: [0, 0.3, -16], half: [19, 0.3, 0.3], color: CONCRETE },
  { pos: [19, 0.3, 0], half: [0.3, 0.3, 16], color: CONCRETE },
  { pos: [-19, 0.3, 0], half: [0.3, 0.3, 16], color: CONCRETE },
];
const props: PropDef[] = [];
const pickups: PickupDef[] = [];
const decor: DecorDef[] = [
  // the way round, painted on the lawn
  { type: 'path', pos: [0, 0.006, 0], half: [1.8, 0, 0], color: PAVING, points: [[W, S], [E, S], [E, N], [W, N]] },
  { type: 'finish', pos: [-10, 0.012, S], half: [0.5, 0, 1.8] },
];
const sign = (text: string, x: number, z: number, yaw: number) => decor.push({ type: 'board', pos: [x, 1.5, z], half: [1.5, 0.35, 0.05], yaw, text });
const screws = (x0: number, z0: number, x1: number, z1: number, n: number, y = 0.5) => {
  for (let i = 0; i < n; i++) pickups.push({ type: 'screw', pos: [x0 + ((x1 - x0) * (i + 0.5)) / n, y, z0 + ((z1 - z0) * (i + 0.5)) / n] });
};
/** The stand a seesaw turns on: just under the plank's middle, a little wider than it. */
function trestle(x: number, z: number, top: number): void {
  const h = (top - 2 * T - 0.03) / 2;
  decor.push({ type: 'box', pos: [x, h, z], half: [PLANK + 0.08, h, 0.12], color: STEEL });
}
/** Yellow rails either side of a lane, so nobody goes round the toy instead of over it. */
function rails(x: number, z: number, alongX: boolean, halfLen: number, gap: number): void {
  for (const side of [-1, 1]) {
    const pos: [number, number, number] = alongX ? [x, 0.15, z + side * (gap + 0.06)] : [x + side * (gap + 0.06), 0.15, z];
    statics.push({ pos, half: alongX ? [halfLen, 0.15, 0.06] : [0.06, 0.15, halfLen], color: RAIL });
  }
}

// South, heading east: a slalom round cones, then two bumps.
sign('SLALOM', -7, S - 2.6, EAST);
// (on the centre line: round them left, right, left…)
const SLALOM = [-6, -3.4, -0.8, 1.8, 4.4];
for (const x of SLALOM) props.push({ type: 'cone', pos: [x, 0.26, S] });
for (const x of [6.6, 9.2]) {
  const up = 0.9, a = 0.06;
  statics.push(ramp([x, S], EAST, up, 2.6, a, WOOD), ramp([x + 2 * up * Math.cos(a), S], WEST, up, 2.6, a, WOOD));
}
screws(6, S, 11, S, 2);

// East, heading north: the seesaw. It lies tipped back towards the way in and goes over
// once the vehicle is past the middle.
const SAW_Z = -4;
const SAW_HALF = 3;
const SAW_TILT = 0.14;
const movers: MoverDef[] = [
  { type: 'seesaw', pos: [E, SAW_HALF * Math.sin(SAW_TILT) + 0.02, SAW_Z], yaw: NORTH, half: [PLANK, T, SAW_HALF], angle: SAW_TILT, color: WOOD },
];
// the trestle it turns on
trestle(E, SAW_Z, movers[0].pos[1]);
rails(E, SAW_Z, false, SAW_HALF + 0.5, LANE);
sign('WIPPE', E + 2.6, SAW_Z - SAW_HALF - 1.5, NORTH);
pickups.push({ type: 'screw', pos: [E, 1.0, SAW_Z] });

// …then the rocking bridge: up a short ramp onto a plank that rolls from side to side.
const ROCK_Y = 0.3;
const ROCK_Z = 5;
const ROCK_HALF = 2.5;
/** Ground the ramps up onto the planks take. */
const RAMP_RUN = 2.4;
statics.push(
  ...easedRamp([E, ROCK_Z - ROCK_HALF - RAMP_RUN], NORTH, RAMP_RUN, 2 * PLANK, ROCK_Y, WOOD),
  ...easedRamp([E, ROCK_Z + ROCK_HALF + RAMP_RUN], SOUTH, RAMP_RUN, 2 * PLANK, ROCK_Y, WOOD),
);
movers.push({ type: 'rocker', pos: [E, ROCK_Y, ROCK_Z], yaw: NORTH, half: [PLANK, T, ROCK_HALF], angle: 0.1, period: 3.5, color: 0x6aa0c8 });
// (its top stays clear of the plank's underside, so the two never fight over the same pixels)
const ROCK_FOOT = (ROCK_Y - 2 * T - 0.03) / 2;
decor.push({ type: 'box', pos: [E, ROCK_FOOT, ROCK_Z], half: [0.1, ROCK_FOOT, ROCK_HALF - 0.2], color: STEEL });
rails(E, ROCK_Z, false, ROCK_HALF + RAMP_RUN, LANE);
sign('WACKELBRÜCKE', E + 2.6, ROCK_Z - ROCK_HALF - 2, NORTH);
pickups.push({ type: 'screw', pos: [E, ROCK_Y + 0.5, ROCK_Z] });

// North, heading west: across the turntable, then up and down a kerb.
// (flush with the lawn: the little scooters' wheels would not get up a step)
const spinners: SpinnerDef[] = [{ pos: [5, 0.015, N], radius: 2.2, speed: 0.8, color: STEEL }];
sign('DREHSCHEIBE', 5, N + 3, EAST);
const KERB = 0.05;
statics.push({ pos: [-3, KERB / 2, N], half: [2.5, KERB / 2, 1.6], color: CONCRETE });
sign('BORDSTEIN', -3, N + 3, EAST);
screws(1.5, N, -8, N, 3);

// West, heading south: first a short, steep seesaw that slams over…
const KIPPE_Z = 7.5;
const KIPPE_HALF = 2;
const KIPPE_TILT = 0.2;
movers.push({ type: 'seesaw', pos: [W, KIPPE_HALF * Math.sin(KIPPE_TILT) + 0.02, KIPPE_Z], yaw: SOUTH, half: [PLANK, T, KIPPE_HALF], angle: KIPPE_TILT, color: 0xc86a4a });
trestle(W, KIPPE_Z, movers[2].pos[1]);
rails(W, KIPPE_Z, false, KIPPE_HALF + 0.5, LANE);
sign('KIPPE', W - 2.6, KIPPE_Z + KIPPE_HALF + 1.5, NORTH);

// …then the balance beam. Narrow, a little way up, no rails on it.
const BEAM_Y = 0.35;
/** Narrower than the other planks: this is the one for balancing. */
const BEAM = 0.7;
const BEAM_Z = -1;
const BEAM_HALF = 3;
statics.push(
  ...easedRamp([W, BEAM_Z + BEAM_HALF + RAMP_RUN], SOUTH, RAMP_RUN, 2 * BEAM, BEAM_Y, WOOD),
  { pos: [W, BEAM_Y - 0.1, BEAM_Z], half: [BEAM, 0.1, BEAM_HALF], color: WOOD },
  ...easedRamp([W, BEAM_Z - BEAM_HALF - RAMP_RUN], NORTH, RAMP_RUN, 2 * BEAM, BEAM_Y, WOOD),
);
rails(W, BEAM_Z, false, BEAM_HALF + RAMP_RUN, LANE);
sign('SCHWEBEBALKEN', W - 2.6, BEAM_Z + BEAM_HALF + 2, NORTH);
pickups.push({ type: 'screw', pos: [W, BEAM_Y + 0.5, BEAM_Z] });

decor.push(
  { type: 'tree', pos: [-4, 0, 0] },
  { type: 'tree', pos: [4, 0, -2] },
  { type: 'lamp', pos: [0, 0, 4] },
  { type: 'sign', pos: [0, 4, 24], half: [14, 3.5, 4], color: 0xe8e2d0, text: 'REHA-ZENTRUM' },
);

export const REHA: TrackDef = {
  id: 'reha',
  name: 'Reha-Parcours',
  blurb: 'Wippe, Wackelbrücke, Drehscheibe, Schwebebalken. Jedes Gefährt muss einmal durch, mit 6 km/h.',
  unlockPrice: 0,
  lapPay: 8,
  spawn: { pos: [-12, 0.5, S], yaw: EAST },
  statics,
  props,
  gates: [
    { x: -10, z: S, hx: 1, hz: 2.5 },
    { x: E, z: SAW_Z, hx: 1.3, hz: 1 },
    { x: E, z: ROCK_Z, hx: 1.3, hz: 1 },
    { x: 0, z: N, hx: 1, hz: 2.5 },
    { x: W, z: KIPPE_Z, hx: 1.3, hz: 1 },
    { x: W, z: BEAM_Z, hx: 1.3, hz: 1 },
  ],
  pickups,
  decor,
  spinners,
  movers,
  // the way to drive it, weaving through the slalom
  line: [
    [-9, S], ...SLALOM.map((x, i): [number, number] => [x, S + (i % 2 ? -1 : 1)]), [6.5, S],
    [E - 1.5, S], [E, S + 1.5], [E, N - 1.5], [E - 1.5, N], [W + 1.5, N], [W, N - 1.5], [W, S + 1.5], [W + 1.5, S],
  ],
};
