import { L } from '../i18n';
import { looping, ramp, type BoxDef, type DecorDef, type MoverDef, type PropDef, type SpinnerDef, type TrackDef } from '../sim/Track';
import { forest, house, street } from './scenery';
import { person } from './works';

const TARMAC = 0x45484d;
const CONCRETE = 0x9a9a94;
const RAMP = 0xc9a15a;
const STEEL = 0x8c949c;

// Rough layout only: a proving ground for the silly stuff. Three lanes side by side, each
// with its own toys, two monster ramps along the edges and a pair of turntables.
const LOT_X = 160;
const LOT_Z = 105;
const EAST = Math.PI / 2;
const WEST = -Math.PI / 2;

const statics: BoxDef[] = [
  { pos: [0, -0.5, 0], half: [LOT_X, 0.5, LOT_Z], color: TARMAC },
  { pos: [0, 0.5, LOT_Z], half: [LOT_X, 0.5, 0.3], color: CONCRETE },
  { pos: [0, 0.5, -LOT_Z], half: [LOT_X, 0.5, 0.3], color: CONCRETE },
  { pos: [LOT_X, 0.5, 0], half: [0.3, 0.5, LOT_Z], color: CONCRETE },
  { pos: [-LOT_X, 0.5, 0], half: [0.3, 0.5, LOT_Z], color: CONCRETE },
];
const props: PropDef[] = [];
const decor: DecorDef[] = [];
const board = (text: string, x: number, z: number) => decor.push({ type: 'board', pos: [x, 2.6, z], half: [4.5, 0.55, 0.06], yaw: WEST, text });

/**
 * Smooth humps along +X, a wave for every `length` metres: each wave cut into short tilted
 * slabs whose tops follow the curve, filled down below the ground so no gap shows underneath.
 */
function waveTrack(x0: number, z: number, waves: number, length: number, height: number, width: number, color: number): BoxDef[] {
  const out: BoxDef[] = [];
  const steps = 8;
  const y = (x: number) => (height / 2) * (1 - Math.cos((2 * Math.PI * x) / length));
  for (let i = 0; i < waves * steps; i++) {
    const a = (i * length) / steps, b = ((i + 1) * length) / steps;
    const ya = y(a), yb = y(b);
    // (a hair longer than the chord, so neighbours overlap instead of leaving a seam)
    out.push(ramp([x0 + a, z], EAST, Math.hypot(b - a, yb - ya) + 0.02, width, Math.atan2(yb - ya, b - a), color, ya, (ya + yb) / 4 + 0.3));
  }
  return out;
}

/** A wall of cartons across the lane. */
function cartons(x: number, z: number, rows: number, cols: number): void {
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) props.push({ type: 'carton', pos: [x, 0.26 + r * 0.51, z + (c - (cols - 1) / 2) * 0.52] });
}

// Middle lane: three kickers, each bigger than the last.
board(L('SCHANZEN', 'JUMPS'), -112, 9);
statics.push(ramp([-90, 0], EAST, 6, 5, 0.16, RAMP), ramp([-50, 0], EAST, 10, 6, 0.25, RAMP), ramp([0, 0], EAST, 26, 8, 0.42, RAMP));
cartons(80, 0, 5, 11);

// South lane: the looping. The run-up is the whole lane.
const LOOP_Z = -45;
board(L('LOOPING', 'LOOP'), -112, LOOP_Z + 9);
statics.push(...looping([0, LOOP_Z], 5, 4.7, 5, STEEL));
for (let x = -100; x <= -10; x += 10) decor.push({ type: 'box', pos: [x, 0.005, LOOP_Z], half: [2.5, 0.005, 0.12], color: 0xe6c94a });

// North lane: washboard, then a table-top.
const BUMP_Z = 45;
board(L('WELLEN', 'WAVES'), -112, BUMP_Z + 9);
for (let i = 0; i < 8; i++) {
  const x = -90 + i * 11;
  const up = ramp([x, BUMP_Z], EAST, 4, 6, 0.2, RAMP);
  statics.push(up, ramp([x + 8 * Math.cos(0.2), BUMP_Z], WEST, 4, 6, 0.2, RAMP));
}
const TABLE_X = 30;
const run = 10 * Math.cos(0.3), top = 10 * Math.sin(0.3);
statics.push(
  ramp([TABLE_X, BUMP_Z], EAST, 10, 7, 0.3, RAMP),
  { pos: [TABLE_X + run + 6, top - 0.1, BUMP_Z], half: [6, 0.1, 3.5], color: RAMP },
  ramp([TABLE_X + 2 * run + 12, BUMP_Z], WEST, 10, 7, 0.3, RAMP),
);

// Between the south lane and the wall: the big loop, with the whole width for a run-up. Only
// the quick ones make it over the top.
const XXL_Z = -68;
board(L('LOOPING XXL', 'LOOP XXL'), -112, XXL_Z + 9);
statics.push(...looping([-10, XXL_Z], 8, 5, 6, 0xd23b3b, 64));
for (let x = -140; x <= -20; x += 10) decor.push({ type: 'box', pos: [x, 0.005, XXL_Z], half: [2.5, 0.005, 0.12], color: 0xe6c94a });

// Between the north lane and the wall: a long, smooth wave track to rock along, then a loop a
// size up from the south lane's.
const NORTH_Z = 66;
board(L('WELLENBAHN', 'WAVE TRACK'), -112, NORTH_Z + 9);
statics.push(...waveTrack(-95, NORTH_Z, 6, 15, 1.4, 6, RAMP));
board(L('LOOPING XL', 'LOOP XL'), 20, NORTH_Z + 9);
statics.push(...looping([60, NORTH_Z], 6.5, 5, 6, STEEL, 56));
for (let x = 0; x <= 50; x += 10) decor.push({ type: 'box', pos: [x, 0.005, NORTH_Z], half: [2.5, 0.005, 0.12], color: 0xe6c94a });

// The monsters, one along each long wall.
board(L('MONSTER', 'MONSTER'), -70, 92);
statics.push(ramp([-50, 84], EAST, 45, 10, 0.5, RAMP), ramp([60, -84], WEST, 32, 10, 0.62, RAMP));
cartons(60, 84, 6, 15);
// A steep bank at the east end to run up and turn round on.
statics.push(ramp([130, 0], EAST, 14, 60, 0.9, STEEL));
// Turntables between the lanes: a big lazy one and a small one that throws you off.
board(L('KREISEL', 'SPINNERS'), 44, -12);
const spinners: SpinnerDef[] = [
  { pos: [62, 0.1, -24], radius: 7, speed: 0.9, color: STEEL },
  { pos: [96, 0.1, -24], radius: 4.5, speed: -2.2, color: RAMP },
];
// …and a row of them further west, each its own speed: the red ones are not for the faint of heart.
board(L('DREHTELLER', 'TURNTABLES'), -100, -15);
for (const [x, radius, speed] of [[-84, 4, 1.5], [-70, 3, -4], [-56, 4.5, 2.5], [-42, 3, 8], [-28, 3.5, -6]] as const) {
  spinners.push({ pos: [x, 0.1, -24], radius, speed, color: Math.abs(speed) > 5 ? 0xd23b3b : Math.abs(speed) > 3 ? 0xe8833a : STEEL });
}
// Slalom between the lanes.
for (let i = 0; i < 10; i++) props.push({ type: 'cone', pos: [-100 + i * 9, 0.26, 22 + (i % 2 ? 2 : -2)] });

// Northwest pocket: a catapult. A short run-up onto a steep tipper that slams over and flings
// whatever is on it, same trick as the Tutorial's "Kippe" but bigger and meaner.
board(L('SCHLEUDER', 'CATAPULT'), -150, 73);
const FLING_X = -138, FLING_Z = 75, FLING_HALF = 3;
// the trestle it turns on, same as the Tutorial's Kippe
decor.push({ type: 'box', pos: [FLING_X, (FLING_HALF * Math.sin(0.5)) / 2, FLING_Z], half: [2.3, (FLING_HALF * Math.sin(0.5)) / 2, 0.15], color: STEEL });

// Southeast pocket: a lookout platform, ramped up from the track side, a steeper slide down
// the far side. Both ramps' ground ends are worked out so their tops land flush on the deck.
board(L('AUSSICHT', 'LOOKOUT'), 100, -65);
const DECK_X = 112, DECK_Z = -85, DECK_HALF = 6, DECK_H = 2.74;
const UP_LEN = 8, UP_ANGLE = 0.35, UP_RUN = UP_LEN * Math.cos(UP_ANGLE);
const DOWN_LEN = DECK_H / Math.sin(0.5), DOWN_ANGLE = 0.5, DOWN_RUN = DOWN_LEN * Math.cos(DOWN_ANGLE);
statics.push(
  ramp([DECK_X, DECK_Z + DECK_HALF + UP_RUN], Math.PI, UP_LEN, 7, UP_ANGLE, RAMP), // up, from the track side (near edge)
  { pos: [DECK_X, DECK_H - 0.1, DECK_Z], half: [DECK_HALF, 0.1, DECK_HALF], color: RAMP }, // the deck
  ramp([DECK_X, DECK_Z - DECK_HALF - DOWN_RUN], 0, DOWN_LEN, 6, DOWN_ANGLE, RAMP), // down, steeper, the far side
);
for (const s of [-1, 1]) decor.push({ type: 'box', pos: [DECK_X + s * (DECK_HALF - 0.1), DECK_H / 2, DECK_Z], half: [0.1, DECK_H / 2, DECK_HALF - 0.1], color: 0x5a5f66 });
// a soft landing of cartons at the foot of the slide
cartons(DECK_X, DECK_Z - DECK_HALF - DOWN_RUN - 3, 3, 7);

// Outside the north wall a fair: a big wheel with gondolas that keeps turning, and a row of booths.
const WHEEL_Z = LOT_Z + 26;
const WHEEL_R = 18;
const movers: MoverDef[] = [
  { type: 'propeller', pos: [0, WHEEL_R + 3, WHEEL_Z], yaw: 0, half: [0.3, WHEEL_R / 2, 0.3], angle: 0, blades: 12, spin: 0.25, color: 0xe8e2d0, gondolas: true },
  // the catapult in the northwest pocket, declared up there, wired in here
  { type: 'seesaw', pos: [FLING_X, FLING_HALF * Math.sin(0.5) + 0.03, FLING_Z], yaw: EAST, half: [2.2, 0.08, FLING_HALF], angle: 0.5, color: 0xd9822b },
];
for (const z of [-1.2, 1.2]) decor.push({ type: 'box', pos: [0, (WHEEL_R + 3) / 2, WHEEL_Z + z], half: [0.4, (WHEEL_R + 3) / 2, 0.3], color: 0x5a5f66 });
let booth = 0;
for (let x = -90; x <= 90; x += 15) {
  if (Math.abs(x) < 26) continue;
  decor.push(...house(x, LOT_Z + 12, Math.PI, 7, 5, 2.6, booth++));
}
// People at the fair, a queue for the big wheel, and some watching over the wall.
{
  const shirts = [0x4a7ab5, 0xf2f2f2, 0xd23b3b, 0x3f8f5f, 0x7b2d8e, 0xe3c04a, 0x2a2a2e, 0xc8c8c8];
  let k = 0;
  for (const x of [-80, -66, -50, -38, 34, 47, 61, 78]) {
    for (const dx of [-1, 0.4]) decor.push(person(x + dx, LOT_Z + 7.5 + (k % 2), Math.PI + (k++ % 3) * 0.4, shirts[k % shirts.length], (['stand', 'phone', 'wave', 'point'] as const)[k % 4]));
  }
  for (let q = 0; q < 6; q++) decor.push(person(-4 - q * 0.8, WHEEL_Z - 4 + (q % 2) * 0.3, Math.PI / 2, shirts[(q + 3) % shirts.length], q === 5 ? 'phone' : 'stand'));
  decor.push(person(3, WHEEL_Z - 3.2, -Math.PI / 2, 0xd23b3b, 'point', true));
}
// Hot-air balloons hanging over the fair.
decor.push({ type: 'balloon', pos: [-60, 34, LOT_Z + 40], color: 0xd23b3b }, { type: 'balloon', pos: [70, 42, LOT_Z + 60], color: 0x2f6db5 });
// Woods either side, and the road along the south with its traffic.
const SOUTH_ROAD = street({ z: -LOT_Z - 14, x0: -300, x1: 300, near: 1, cars: 7, seed: 12 });
decor.push(
  ...SOUTH_ROAD.decor,
  ...forest({ x: [LOT_X + 8, LOT_X + 55], z: [-LOT_Z - 5, LOT_Z + 40], count: 40, seed: 13 }),
  ...forest({ x: [-LOT_X - 55, -LOT_X - 8], z: [-LOT_Z - 5, LOT_Z + 40], count: 40, seed: 14 }),
  ...forest({ x: [-LOT_X, LOT_X], z: [-LOT_Z - 60, -LOT_Z - 26], count: 50, seed: 15 }),
);

export const SPIELWIESE: TrackDef = {
  id: 'spielwiese',
  name: L('Spielwiese', 'Playground'),
  blurb: L('Drei Loopings, Wellenbahnen, Drehteller, Riesenschanzen, Riesenrad: alles, was Unsinn ist.', 'Three loops, wave tracks, turntables, giant jumps, a big wheel: everything that is nonsense.'),
  unlockPrice: 200,
  lapPay: 20,
  spawn: { pos: [-135, 0.6, 0], yaw: EAST },
  statics,
  props,
  gates: [
    { x: -122, z: 0, hx: 1.5, hz: 6 },
    { x: 120, z: 0, hx: 6, hz: LOT_Z },
    { x: -140, z: -55, hx: 6, hz: 40 },
  ],
  pickups: [],
  decor,
  spinners,
  movers,
  traffic: SOUTH_ROAD.traffic,
};
