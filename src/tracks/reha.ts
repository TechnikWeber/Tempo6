import { L } from '../i18n';
import { easedRamp, ramp, type BoxDef, type DecorDef, type MoverDef, type PickupDef, type PropDef, type SpinnerDef, type TrackDef } from '../sim/Track';

const FLOOR = 0x5d8f4e;
const PAVING = 0xd2ccbc;
const CONCRETE = 0x9a9a94;
const WOOD = 0xc9a15a;
const RAIL = 0xf2c230;
const STEEL = 0x8c949c;

// The training course every vehicle has to get through once, at stage 0. Small, so
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
const PLANK = 1.05;
const LANE = 1.7;
/** Half width of the painted way round. */
const WAY = 2.3;
/** Lot half extents. */
const LOT_X = 21;
const LOT_Z = 18;
/** Plank thickness, as the movers have it. */
const T = 0.06;

const statics: BoxDef[] = [
  { pos: [0, -0.5, 0], half: [LOT_X, 0.5, LOT_Z], color: FLOOR },
  { pos: [0, 0.3, LOT_Z], half: [LOT_X, 0.3, 0.3], color: CONCRETE },
  { pos: [0, 0.3, -LOT_Z], half: [LOT_X, 0.3, 0.3], color: CONCRETE },
  { pos: [LOT_X, 0.3, 0], half: [0.3, 0.3, LOT_Z], color: CONCRETE },
  { pos: [-LOT_X, 0.3, 0], half: [0.3, 0.3, LOT_Z], color: CONCRETE },
];
const props: PropDef[] = [];
const pickups: PickupDef[] = [];
const decor: DecorDef[] = [
  // the way round, painted on the lawn
  { type: 'path', pos: [0, 0.006, 0], half: [WAY, 0, 0], color: PAVING, points: [[W, S], [E, S], [E, N], [W, N]] },
  { type: 'finish', pos: [-10, 0.012, S], half: [0.5, 0, WAY] },
];
/** Signs stand beside the way, clear of it, facing whoever comes along. */
const SIGN_HALF = 1.2;
const SIGN_OUT = WAY + SIGN_HALF + 0.5;
const sign = (text: string, x: number, z: number, yaw: number) => decor.push({ type: 'board', pos: [x, 1.5, z], half: [SIGN_HALF, 0.35, 0.05], yaw, text });
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
sign(L('SLALOM', 'SLALOM'), -7.5, S - SIGN_OUT, EAST);
// (on the centre line: round them left, right, left…)
const SLALOM = [-6, -3.4, -0.8, 1.8, 4.4];
for (const x of SLALOM) props.push({ type: 'cone', pos: [x, 0.26, S] });
for (const x of [6.6, 9.2]) {
  const up = 0.9, a = 0.06;
  statics.push(ramp([x, S], EAST, up, 2 * WAY - 1, a, WOOD), ramp([x + 2 * up * Math.cos(a), S], WEST, up, 2 * WAY - 1, a, WOOD));
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
sign(L('WIPPE', 'SEESAW'), E + SIGN_OUT, SAW_Z - SAW_HALF - 1.5, NORTH);
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
sign(L('WACKELBRÜCKE', 'WOBBLE BRIDGE'), E + SIGN_OUT, ROCK_Z - ROCK_HALF - 2, NORTH);
pickups.push({ type: 'screw', pos: [E, ROCK_Y + 0.5, ROCK_Z] });

// North, heading west: across the turntable, then up and down a kerb.
// (flush with the lawn: the little scooters' wheels would not get up a step)
const spinners: SpinnerDef[] = [{ pos: [5, 0.015, N], radius: 2.6, speed: 0.95, color: STEEL }];
sign(L('DREHSCHEIBE', 'TURNTABLE'), 9, N + SIGN_OUT, EAST);
const KERB = 0.05;
statics.push({ pos: [-3, KERB / 2, N], half: [2.5, KERB / 2, WAY], color: CONCRETE });
sign(L('BORDSTEIN', 'KERB'), 0.5, N + SIGN_OUT, EAST);
screws(1.5, N, -8, N, 3);

// West, heading south: first a short, steep seesaw that slams over…
const KIPPE_Z = 7.5;
const KIPPE_HALF = 2;
const KIPPE_TILT = 0.2;
movers.push({ type: 'seesaw', pos: [W, KIPPE_HALF * Math.sin(KIPPE_TILT) + 0.02, KIPPE_Z], yaw: SOUTH, half: [PLANK, T, KIPPE_HALF], angle: KIPPE_TILT, color: 0xc86a4a });
trestle(W, KIPPE_Z, movers[2].pos[1]);
rails(W, KIPPE_Z, false, KIPPE_HALF + 0.5, LANE);
sign(L('KIPPE', 'TIPPER'), W - SIGN_OUT, KIPPE_Z + KIPPE_HALF + 1.5, NORTH);

// …then the balance beam. Narrow, well up, no rails on it.
const BEAM_Y = 0.55;
/** Narrower than the other planks: this is the one for balancing. */
const BEAM = 0.85;
const BEAM_Z = -1.6;
const BEAM_HALF = 3;
/** (longer ramps for the higher beam, or the weak stage-0 motor would not get up them) */
const BEAM_RUN = 3.4;
statics.push(
  ...easedRamp([W, BEAM_Z + BEAM_HALF + BEAM_RUN], SOUTH, BEAM_RUN, 2 * BEAM, BEAM_Y, WOOD),
  { pos: [W, BEAM_Y - 0.1, BEAM_Z], half: [BEAM, 0.1, BEAM_HALF], color: WOOD },
  ...easedRamp([W, BEAM_Z - BEAM_HALF - BEAM_RUN], NORTH, BEAM_RUN, 2 * BEAM, BEAM_Y, WOOD),
);
// trestles under the beam (its underside is at BEAM_Y - 0.2; they stop short of it)
for (const dz of [-2, 0, 2]) decor.push({ type: 'box', pos: [W, (BEAM_Y - 0.23) / 2, BEAM_Z + dz], half: [BEAM - 0.1, (BEAM_Y - 0.23) / 2, 0.08], color: STEEL });
rails(W, BEAM_Z, false, BEAM_HALF + BEAM_RUN, LANE);
sign(L('SCHWEBEBALKEN', 'BALANCE BEAM'), W - SIGN_OUT, BEAM_Z + BEAM_HALF + 2, NORTH);
pickups.push({ type: 'screw', pos: [W, BEAM_Y + 0.5, BEAM_Z] });

// Inside the square: a little garden with a pond, benches and the odd tree.
decor.push(
  { type: 'slab', pos: [0, 0.008, 0], color: 0x4f8fb8, points: [[-3, -2], [1, -3.2], [3.5, -1], [2.5, 2], [-1, 2.6], [-3.6, 0.8]] },
  { type: 'tree', pos: [-6, 0, 4] },
  { type: 'tree', pos: [6, 0, -4] },
  { type: 'tree', pos: [-5.5, 0, -5] },
  { type: 'tree', pos: [7, 0, 5] },
  { type: 'lamp', pos: [0, 0, 5] },
  { type: 'lamp', pos: [-1, 0, -5.5] },
);
/** A park bench along X: seat and backrest butting up against each other, legs thinner. */
function bench(x: number, z: number, back: 1 | -1): void {
  decor.push(
    { type: 'box', pos: [x, 0.43, z], half: [0.8, 0.03, 0.2], color: 0x8a5a32 },
    { type: 'box', pos: [x, 0.7, z + back * 0.23], half: [0.8, 0.24, 0.03], color: 0x8a5a32 },
  );
  for (const s of [-0.65, 0.65]) decor.push({ type: 'box', pos: [x + s, 0.2, z], half: [0.04, 0.2, 0.15], color: 0x3a3c40 });
}
bench(-1, 4.2, 1);
bench(2, -4.6, -1);
// flower beds along the inside of the way
for (const [x, z, c] of [[-8, -6.5, 0xd2463c], [8, 6.5, 0xe8c23a], [-8, 6.5, 0xb04fb0], [8, -6.5, 0xe8833a]] as const) {
  decor.push({ type: 'box', pos: [x, 0.1, z], half: [1.6, 0.1, 0.8], color: 0x6b4a2b }, { type: 'box', pos: [x, 0.25, z], half: [1.4, 0.05, 0.6], color: c });
}
// Hedges along the wall, and the clinic beyond it.
for (const z of [-LOT_Z + 1, LOT_Z - 1]) decor.push({ type: 'box', pos: [0, 0.5, z], half: [LOT_X - 1.5, 0.5, 0.45], color: 0x3c6e34 });
decor.push({ type: 'sign', pos: [0, 4, LOT_Z + 9], half: [16, 4, 5], color: 0xe8e2d0, text: L('REHA-ZENTRUM', 'REHAB CENTRE') });
// and a clock on its front, telling the real time
decor.push({ type: 'clock', pos: [11, 5.2, LOT_Z + 4 - 0.01], half: [1.1, 0, 0], yaw: Math.PI });
// a parked ambulance by the entrance
const AMBULANCE_Z = LOT_Z + 2.5;
decor.push(
  { type: 'box', pos: [-14, 1.15, AMBULANCE_Z], half: [2.6, 1.05, 1.1], color: 0xf2f2f2 },
  // (the stripe sits flush on the side facing the course)
  { type: 'box', pos: [-14, 1.4, AMBULANCE_Z - 1.14], half: [2.4, 0.18, 0.04], color: 0xd23b3b },
);
for (const dx of [-1.6, 1.6]) for (const dz of [-1.04, 1.04]) decor.push({ type: 'box', pos: [-14 + dx, 0.3, AMBULANCE_Z + dz], half: [0.3, 0.3, 0.12], color: 0x222222 });

// The street along the south side, with traffic going by both ways.
const ROAD_Z = -LOT_Z - 7;
decor.push(
  { type: 'box', pos: [0, 0.01, ROAD_Z], half: [200, 0.01, 4], color: 0x45484d },
  { type: 'box', pos: [0, 0.07, ROAD_Z + 5], half: [200, 0.06, 1], color: 0xb7b2a6 },
);
for (let x = -195; x < 200; x += 6) decor.push({ type: 'box', pos: [x, 0.025, ROAD_Z], half: [1.5, 0.005, 0.08], color: 0xf2f2f2 });
for (let x = -60; x <= 60; x += 15) decor.push({ type: 'tree', pos: [x + 7, 0, ROAD_Z - 7] }, { type: 'lamp', pos: [x, 0, ROAD_Z + 5.5], yaw: Math.PI / 2 });
// (keeping right: eastwards on the near side, back westwards on the far one)
const STREET: [number, number][] = [[-190, ROAD_Z + 2], [190, ROAD_Z + 2], [190, ROAD_Z - 2], [-190, ROAD_Z - 2]];

export const REHA: TrackDef = {
  id: 'reha',
  name: L('Reha-Parcours', 'Rehab Course'),
  blurb: L('Wippe, Wackelbrücke, Drehscheibe, Schwebebalken. Hier lernst du fahren, mit 12 km/h.', 'Seesaw, wobble bridge, turntable, balance beam. This is where you learn to drive, at 12 km/h.'),
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
  traffic: [
    { type: 'car', color: 0x2f6db5, speed: 11, path: STREET },
    { type: 'van', color: 0xf2f2f2, speed: 9, offset: 260, path: STREET },
    { type: 'car', color: 0xc23a2e, speed: 12, offset: 520, path: STREET },
    { type: 'car', color: 0xe3c04a, speed: 10, offset: 130, path: STREET },
  ],
  // the way to drive it, weaving through the slalom
  line: [
    [-9, S], ...SLALOM.map((x, i): [number, number] => [x, S + (i % 2 ? -1 : 1)]), [6.5, S],
    [E - 1.5, S], [E, S + 1.5], [E, N - 1.5], [E - 1.5, N], [W + 1.5, N], [W, N - 1.5], [W, S + 1.5], [W + 1.5, S],
  ],
};
