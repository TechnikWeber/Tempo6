import { L } from '../i18n';
import { looping, profile, ramp, type BoxDef, type DecorDef, type MoverDef, type PropDef, type SpinnerDef, type TrackDef, type TrafficDef } from '../sim/Track';
import { forest, house, stand, street } from './scenery';
import { bowl, cartonHill, easedSlope, halfpipe, hoop, seesaw, skiJump, skittles, type Toys } from './toys';
import { person, snackStand, type Yard } from './works';

const TARMAC = 0x45484d;
const CONCRETE = 0x9a9a94;
const RAMP = 0xc9a15a;
const STEEL = 0x8c949c;
const STRIPE = 0xe6c94a;
const RED = 0xd23b3b;

// A proving ground for the silly stuff. The old ground in the north-west (320 × 210 m): three
// lanes side by side, each with its own toys, monster ramps along the edges, turntables and
// loops. East of it the sling field, where catapults throw as hard as they dare, the
// strongest ten times as hard as the old one, into a wall. South of it seesaws from small to
// monstrous, burning hoops, a washing drum, a hammer, a double loop, a centrifuge, a
// half-pipe, a bowl and a ski jump.
const LOT_X = 160;
const LOT_Z = 105;
// the whole ground now reaches this far east and south
const FIELD_E = 330;
const FIELD_S = -305;
const EAST = Math.PI / 2;
const WEST = -Math.PI / 2;
const NORTH = 0;

const statics: BoxDef[] = [
  { pos: [(FIELD_E - LOT_X) / 2, -0.5, (LOT_Z + FIELD_S) / 2], half: [(FIELD_E + LOT_X) / 2, 0.5, (LOT_Z - FIELD_S) / 2], color: TARMAC },
  { pos: [(FIELD_E - LOT_X) / 2, 0.5, LOT_Z], half: [(FIELD_E + LOT_X) / 2, 0.5, 0.3], color: CONCRETE },
  { pos: [(FIELD_E - LOT_X) / 2, 0.5, FIELD_S], half: [(FIELD_E + LOT_X) / 2, 0.5, 0.3], color: CONCRETE },
  { pos: [FIELD_E, 0.5, (LOT_Z + FIELD_S) / 2], half: [0.3, 0.5, (LOT_Z - FIELD_S) / 2], color: CONCRETE },
  { pos: [-LOT_X, 0.5, (LOT_Z + FIELD_S) / 2], half: [0.3, 0.5, (LOT_Z - FIELD_S) / 2], color: CONCRETE },
];
const props: PropDef[] = [];
const decor: DecorDef[] = [];
const movers: MoverDef[] = [];
const toys: Toys = { statics, decor, movers, props };
const yard: Yard = { statics, decor, props };
/** A sign on two posts, read from the west (or along `yaw`). */
const board = (text: string, x: number, z: number, yaw = WEST) => decor.push({ type: 'board', pos: [x, 2.6, z], half: [4.5, 0.55, 0.06], yaw, text });
/** Yellow dashes on the ground along X, a run-up to aim along. */
const dashes = (z: number, x0: number, x1: number) => {
  for (let x = x0; x <= x1; x += 10) decor.push({ type: 'box', pos: [x, 0.005, z], half: [2.5, 0.005, 0.12], color: STRIPE });
};
const SHIRTS = [0x4a7ab5, 0xf2f2f2, RED, 0x3f8f5f, 0x7b2d8e, 0xe3c04a, 0x2a2a2e, 0xc8c8c8, 0xe8833a];

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

/** A few people standing about at a spot, facing `yaw`, in a loose bunch side by side. */
function crowd(x: number, z: number, yaw: number, count: number, seed: number): void {
  const poses = ['stand', 'wave', 'point', 'phone', 'stand', 'wave'] as const;
  for (let k = 0; k < count; k++) {
    const across = (k - (count - 1) / 2) * 1.1, back = (k % 2) * 0.9;
    const px = x + Math.cos(yaw) * across - Math.sin(yaw) * back, pz = z - Math.sin(yaw) * across - Math.cos(yaw) * back;
    decor.push(person(px, pz, yaw + (((k * 7 + seed) % 5) - 2) * 0.15, SHIRTS[(k + seed) % SHIRTS.length], poses[(k + seed) % poses.length]));
  }
}

// ---------------------------------------------------------------------------------------
// The old ground.

// Middle lane: three kickers, each bigger than the last.
board(L('SCHANZEN', 'JUMPS'), -112, 9);
statics.push(ramp([-90, 0], EAST, 6, 5, 0.16, RAMP), ramp([-50, 0], EAST, 10, 6, 0.25, RAMP), ramp([0, 0], EAST, 26, 8, 0.42, RAMP));
cartons(80, 0, 5, 11);

// South lane: the looping. The run-up is the whole lane.
const LOOP_Z = -45;
board(L('LOOPING', 'LOOP'), -112, LOOP_Z + 9);
statics.push(...looping([0, LOOP_Z], 5, 4.7, 5, STEEL));
dashes(LOOP_Z, -100, -10);

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

// On along the south lane, in line behind the little loop: the giant one, 24 m tall, with a
// wall of cartons to stop in. Over the top only flat out, best with a boost.
const GIANT_X = 100, GIANT_Z = LOOP_Z - 5;
board(L('RIESENLOOPING', 'GIANT LOOP'), 60, GIANT_Z + 9);
statics.push(...looping([GIANT_X, GIANT_Z], 12, 6, 7, 0x2f6db5, 84));
dashes(GIANT_Z, 15, 85);
cartons(150, GIANT_Z - 7, 4, 11);

// Between the south lane and the old south edge: the big loop, with the whole width for a
// run-up. Only the quick ones make it over the top.
const XXL_Z = -68;
board(L('LOOPING XXL', 'LOOP XXL'), -112, XXL_Z + 9);
statics.push(...looping([-10, XXL_Z], 8, 5, 6, RED, 64));
dashes(XXL_Z, -140, -20);

// Between the north lane and the wall: a long, smooth wave track to rock along, then a loop a
// size up from the south lane's.
const NORTH_Z = 66;
board(L('WELLENBAHN', 'WAVE TRACK'), -112, NORTH_Z + 9);
statics.push(...waveTrack(-95, NORTH_Z, 6, 15, 1.4, 6, RAMP));
board(L('LOOPING XL', 'LOOP XL'), 20, NORTH_Z + 9);
statics.push(...looping([60, NORTH_Z], 6.5, 5, 6, STEEL, 56));
dashes(NORTH_Z, 0, 50);

// The monsters, one along each long side of the old ground.
board(L('MONSTER', 'MONSTER'), -70, 92);
statics.push(ramp([-50, 84], EAST, 45, 10, 0.5, RAMP), ramp([60, -84], WEST, 32, 10, 0.62, RAMP));
cartons(60, 84, 6, 15);
// A steep bank at the east end of the old ground to run up and turn round on.
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
  spinners.push({ pos: [x, 0.1, -24], radius, speed, color: Math.abs(speed) > 5 ? RED : Math.abs(speed) > 3 ? 0xe8833a : STEEL });
}
// Slalom between the lanes.
for (let i = 0; i < 10; i++) props.push({ type: 'cone', pos: [-100 + i * 9, 0.26, 22 + (i % 2 ? 2 : -2)] });

// Northwest pocket: the catapult. A board flat on the ground, hinged at its east end: drive on,
// stop, and a moment later its back end snaps up and throws you east over the open ground.
board(L('SCHLEUDER', 'CATAPULT'), -150, 73);
const FLING_X = -128, FLING_Z = 75;
// a frame round the board, so it reads as a machine and not a plank someone left there
for (const s of [-1, 1]) decor.push({ type: 'box', pos: [FLING_X - 2, 0.06, FLING_Z + s * 1.75], half: [2.2, 0.06, 0.15], color: 0x5a5f66 });
movers.push({ type: 'catapult', pos: [FLING_X, 0.04, FLING_Z], yaw: EAST, half: [1.5, 0.1, 2], angle: 1, spin: 7.5, color: 0xd9822b });

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
// the walls under the deck, a little in from its edges and up to its underside
for (const s of [-1, 1]) decor.push({ type: 'box', pos: [DECK_X + s * (DECK_HALF - 0.15), (DECK_H - 0.2) / 2, DECK_Z], half: [0.1, (DECK_H - 0.2) / 2, DECK_HALF - 0.15], color: 0x5a5f66 });
// a soft landing of cartons at the foot of the slide, and two up top enjoying the view
cartons(DECK_X, DECK_Z - DECK_HALF - DOWN_RUN - 3, 3, 7);
decor.push(person(DECK_X + 4.5, DECK_Z - 4.5, -2.4, 0x3f8f5f, 'point', false, DECK_H), person(DECK_X - 4.6, DECK_Z - 4, 2.6, 0xe3c04a, 'phone', false, DECK_H));

// Where the old ground used to end, south and east, a dashed line on the ground now.
for (let x = -LOT_X + 3; x < FIELD_E - 3; x += 8) decor.push({ type: 'box', pos: [x, 0.005, -LOT_Z], half: [2, 0.005, 0.15], color: 0xf2f2f2 });
// (none under the grandstand that stands on that line, see the sling field)
for (let z = -LOT_Z + 7; z < LOT_Z - 3; z += 8) if (Math.abs(z) > 24) decor.push({ type: 'box', pos: [LOT_X, 0.005, z], half: [0.15, 0.005, 2], color: 0xf2f2f2 });

// ---------------------------------------------------------------------------------------
// The sling field, east of the old ground. Everything here throws north.

// The mega sling: ten times the old catapult, 150 m/s, aimed nearly flat. Whoever stands on
// it for half a second crosses the whole field in little more than a second and goes into the
// wall at the far end, ten metres up: nobody drives away from that.
const MEGA_X = 190, MEGA_Z = -80;
const WALL_Z = 100;
board(L('MEGA-SCHLEUDER 10×', 'MEGA SLING 10×'), MEGA_X - 9, MEGA_Z - 8, NORTH);
movers.push({ type: 'catapult', pos: [MEGA_X, 0.05, MEGA_Z], yaw: NORTH, half: [1.6, 0.12, 2.2], angle: 1, spin: 12, power: 150, aim: 1.47, color: RED });
for (const s of [-1, 1]) {
  // a heavy frame, black and yellow
  decor.push(
    { type: 'box', pos: [MEGA_X + s * 2.05, 0.15, MEGA_Z - 2.2], half: [0.25, 0.15, 2.6], color: 0x2a2a2e },
    { type: 'box', pos: [MEGA_X + s * 2.05, 0.31, MEGA_Z - 2.2], half: [0.26, 0.01, 2.61], color: 0xf2c230 },
  );
}
decor.push({ type: 'label', pos: [MEGA_X, 0.01, MEGA_Z - 7], half: [1.2, 0, 3], yaw: NORTH, text: L('ACHTUNG', 'DANGER') });
// the wall it throws into, a target painted on it, and a sign up top
statics.push({ pos: [MEGA_X, 15, WALL_Z + 2.5], half: [22, 15, 2.5], color: 0xb7b2a6 });
for (const [r, c, k] of [[11, RED, 0], [8, 0xf4f4f4, 1], [5, RED, 2], [2, 0xf2c230, 3]] as const) {
  decor.push({ type: 'oval', pos: [MEGA_X, 11.5, WALL_Z - k * 0.1], half: [r, r, 0], yaw: Math.PI, color: c });
}
decor.push({ type: 'board', pos: [MEGA_X, 32, WALL_Z + 2.5], half: [14, 1.6, 0.1], yaw: Math.PI, text: L('PRALLWAND', 'CRASH WALL') });
// a concrete bunker beside the launch for those who want to watch it go, and the operator
statics.push({ pos: [MEGA_X - 16, 1.4, MEGA_Z + 6], half: [3, 1.4, 5], color: 0x8c8c86 });
decor.push(
  { type: 'box', pos: [MEGA_X - 13.05, 1.9, MEGA_Z + 6], half: [0.06, 0.18, 3.6], color: 0x1d1d1f }, // the slit
  { type: 'box', pos: [MEGA_X - 16, 2.85, MEGA_Z + 6], half: [3.3, 0.05, 5.3], color: 0x6b6b66 }, // the lid
  person(MEGA_X - 20, MEGA_Z + 4, EAST, 0xf2f2f2, 'point'),
  person(MEGA_X - 20, MEGA_Z + 6.2, EAST + 0.3, 0x2a2a2e, 'phone'),
  person(MEGA_X - 20.6, MEGA_Z + 8.4, EAST - 0.4, 0xe3c04a, 'wave'),
  { type: 'box', pos: [MEGA_X - 7, 0.5, MEGA_Z - 4], half: [0.6, 0.5, 0.4], color: 0x5a5f66 }, // the desk with the big button
  { type: 'box', pos: [MEGA_X - 7, 1.06, MEGA_Z - 4], half: [0.12, 0.06, 0.12], color: RED },
  person(MEGA_X - 7.9, MEGA_Z - 4, EAST, 0x2b3a5a, 'point', true),
);
// paramedics waiting by the wall, the ambulance beside them
decor.push(
  { type: 'box', pos: [MEGA_X + 34, 1.3, WALL_Z - 12], half: [1.1, 1.2, 2.8], color: 0xf4f4f4 },
  { type: 'box', pos: [MEGA_X + 34, 1.3, WALL_Z - 12], half: [1.12, 0.18, 2.82], color: RED },
  { type: 'box', pos: [MEGA_X + 34, 2.58, WALL_Z - 13.5], half: [0.4, 0.08, 0.2], color: 0x2f6db5 },
  person(MEGA_X + 31.8, WALL_Z - 10.5, -2.6, RED, 'stand', true),
  person(MEGA_X + 32.2, WALL_Z - 14, -1.9, RED, 'phone', true),
);

// The lever sling: a board 18 m long swinging up slowly about its hinge, throwing at 30 m/s
// whoever waits on it: 25 m up and nearly 100 m on.
const LEVER_X = 235, LEVER_Z = -40, LEVER_HALF = 9;
board(L('HEBELSCHLEUDER', 'LEVER SLING'), LEVER_X - 9, LEVER_Z - 2 * LEVER_HALF - 5, NORTH);
movers.push({ type: 'catapult', pos: [LEVER_X, 0.05, LEVER_Z], yaw: NORTH, half: [2, 0.15, LEVER_HALF], angle: 1.2, spin: 1.6, power: 30, aim: 0.75, color: 0x2f6db5 });
for (const s of [-1, 1]) {
  decor.push(
    { type: 'box', pos: [LEVER_X + s * 2.5, 0.8, LEVER_Z], half: [0.25, 0.8, 0.5], color: 0x3a3c40 }, // the bearing blocks
    { type: 'box', pos: [LEVER_X + s * 2.5, 0.06, LEVER_Z - LEVER_HALF], half: [0.2, 0.06, LEVER_HALF + 0.6], color: 0xf2c230 }, // a line either side
  );
}
decor.push(person(LEVER_X - 4.5, LEVER_Z + 1.5, 0.4, 0x2b3a5a, 'wave', true), person(LEVER_X + 4.4, LEVER_Z - 6, -1.2, 0x2b3a5a, 'stand', true));

// A battery of three, side by side: twice, three times and five times the old one, each one
// aimed steeper so they all come down inside the field. The five-fold goes 280 m up.
board(L('SCHLEUDER-BATTERIE', 'SLING BATTERY'), 295, -103, NORTH);
for (const [k, x, power, aim, color, text] of [[0, 280, 30, 0.6, 0xe8833a, '2×'], [1, 295, 45, 0.35, 0xd9822b, '3×'], [2, 310, 75, 0.16, RED, '5×']] as const) {
  movers.push({ type: 'catapult', pos: [x, 0.04, -88], yaw: NORTH, half: [1.5, 0.1, 2], angle: 1, spin: 7.5, power, aim, color });
  decor.push({ type: 'label', pos: [x, 0.01, -95], half: [1.1, 0, 1.6], yaw: NORTH, text });
  for (const s of [-1, 1]) decor.push({ type: 'box', pos: [x + s * 1.75, 0.06, -90], half: [0.15, 0.06, 2.2], color: 0x5a5f66 });
  if (k === 1) decor.push(person(x + 6.5, -84, -0.8, 0x2b3a5a, 'wave', true));
}
// rings on the ground where they come down, more or less
for (const [x, z, r] of [[280, -4, 8], [295, 43, 10], [310, 90, 12]] as const) decor.push({ type: 'ring', pos: [x, 0.012, z], half: [r, 0, 0.3], color: 0xf2f2f2 });

// Grandstands along both sides of the field, with a barrier in front of each.
decor.push(...stand(322, -10, WEST, 50, 5, 51), ...stand(162.5, 0, EAST, 40, 4, 52));
statics.push({ pos: [318.6, 0.6, -10], half: [0.2, 0.6, 25], color: 0xd8dde2 }, { pos: [166, 0.6, 0], half: [0.2, 0.6, 20], color: 0xd8dde2 });

// ---------------------------------------------------------------------------------------
// The south field.

// The seesaw street: six seesaws one after the other along X, from one a child would ride to
// one 80 m long that tips its far end 17 m into the air.
const SAW_Z = -130;
board(L('WIPPENSTRASSE', 'SEESAW STREET'), -150, SAW_Z + 8);
for (const [x, half, width, tilt, color, thick, text] of [
  [-132, 3, 2.6, 0.15, 0x4a9a6a, 0.08, L('KLEIN', 'SMALL')],
  [-108, 6, 3, 0.17, 0x3f8a8c, 0.1, L('MITTEL', 'MEDIUM')],
  [-76, 10, 3.6, 0.2, 0x2f6db5, 0.12, L('GROSS', 'BIG')],
  [-28, 16, 4.4, 0.22, 0x7b2d8e, 0.15, L('GANZ GROSS', 'HUGE')],
  [42, 25, 5.5, 0.24, 0xd9822b, 0.18, L('RIESIG', 'GIANT')],
  [140, 40, 7, 0.22, RED, 0.22, L('MONSTER', 'MONSTER')],
] as const) {
  seesaw(toys, x, SAW_Z, EAST, half, width, tilt, color, thick);
  decor.push({ type: 'label', pos: [x, 0.01, SAW_Z + width / 2 + 1.8], half: [0.8, 0, 3], yaw: NORTH, text });
}
// at the end of the street the skittles, and a wall of cartons behind them
skittles(toys, 196, SAW_Z, EAST);
cartons(222, SAW_Z, 4, 13);
crowd(-120, -117, Math.PI, 5, 1);
crowd(-50, -117, Math.PI, 6, 3);
crowd(60, -116, Math.PI, 7, 5);
crowd(150, -117, Math.PI, 5, 2);

// The lane of hoops and things that hit back: a kicker and a burning hoop, a bigger kicker and
// a higher hoop, the washing drum to drive through, the hammer swinging across, a double loop.
// A good run-up from the west wall to the first kicker.
const LANE_Z = -170;
board(L('FEUERREIFEN', 'HOOPS OF FIRE'), -150, LANE_Z + 9);
statics.push(ramp([-125, LANE_Z], EAST, 8, 4, 0.3, RAMP), ramp([-80, LANE_Z], EAST, 10, 4.5, 0.35, RAMP));
hoop(toys, -105, 4.2, LANE_Z, EAST, 3.8);
hoop(toys, -55, 5.2, LANE_Z, EAST, 3.8);
board(L('WASCHTROMMEL', 'WASHING DRUM'), -24, LANE_Z + 9);
movers.push({ type: 'drum', pos: [0, 3.08, LANE_Z], yaw: EAST, half: [0, 0.1, 10], radius: 3, blades: 28, spin: 0.8, angle: 0, color: 0x2f6db5 });
board(L('HAMMER', 'HAMMER'), 22, LANE_Z + 11);
movers.push({ type: 'propeller', pos: [35, 8, LANE_Z], yaw: EAST, half: [0.6, 3.6, 0.3], angle: 0, blades: 4, spin: 1.3, color: RED });
// its gantry: a post either side well out of the blades' reach, a beam across beside them
for (const s of [-1, 1]) decor.push({ type: 'box', pos: [36.3, 4.3, LANE_Z + s * 8.2], half: [0.3, 4.3, 0.3], color: 0x5a5f66 });
decor.push({ type: 'box', pos: [36.3, 8.75, LANE_Z], half: [0.3, 0.3, 8.5], color: 0x5a5f66 }, { type: 'box', pos: [35.8, 8, LANE_Z], half: [0.5, 0.15, 0.15], color: 0x3a3c40 });
board(L('DOPPELLOOPING', 'DOUBLE LOOP'), 62, LANE_Z + 9);
statics.push(...looping([92, LANE_Z + 2], 5, 5, 6, STEEL, 48), ...looping([125, LANE_Z - 4], 6, 5, 6, RED, 56));
dashes(LANE_Z + 2, 50, 80);
cartons(226, LANE_Z - 10, 4, 13);
crowd(-120, -158, Math.PI, 4, 4);
crowd(100, -152, Math.PI, 6, 6);

// The centrifuge: a turntable 28 m across that spins its rim at over 100 km/h. A ring of old
// tyres round it to land in.
board(L('ZENTRIFUGE', 'CENTRIFUGE'), -150, -205);
spinners.push({ pos: [-110, 0.1, -232], radius: 14, speed: 2.2, color: RED });
for (let k = 0; k < 18; k++) {
  const a = (k / 18) * 2 * Math.PI;
  for (let h = 0; h < 3; h++) props.push({ type: 'tyre', pos: [-110 + Math.sin(a) * 27, 0.115 + h * 0.23, -232 + Math.cos(a) * 27], yaw: h });
}
// The half-pipe, along Z, open at both ends, somebody sitting on either lip.
board(L('HALFPIPE', 'HALF-PIPE'), -40, -194, Math.PI);
halfpipe(toys, -40, -258, 56, 6, 8, RAMP);
decor.push(person(-29.6, -236, WEST, 0x3f8f5f, 'wave', false, 6), person(-50.4, -222, EAST, 0xe8833a, 'point', false, 6));
// The bowl: banked walls round a flat middle, steeper and steeper up to a wall standing straight
// up 16 m high, and on top a ring leaning in over it all, so whoever is quick enough can go
// round and round up there without flying out. The way in from the north.
board(L('STEILWANDKESSEL', 'THE BOWL'), 50, -206, Math.PI);
bowl(toys, 50, -232, 9, [[7, 0.55, 0x8c949c], [6, 1.05, 0x5c6670], [7, 1.5, 0x7d858c], [3.5, 2.1, 0xd23b3b]], NORTH);
// The turbo drum: the washing drum's big brother, turning ten times as fast.
board(L('TURBOTROMMEL', 'TURBO DRUM'), 158, -191, WEST);
movers.push({ type: 'drum', pos: [180, 3.08, -200], yaw: EAST, half: [0, 0.1, 8], radius: 3, blades: 28, spin: 8, angle: 0, color: 0xd23b3b });
// A heap of cartons and one of barrels, to plough through.
cartonHill(toys, 135, -232, 6);
for (let l = 0; l < 4; l++) for (let k = 0; k < 4 - l; k++) props.push({ type: 'barrel', pos: [175 + (k - (3 - l) / 2) * 0.62, 0.45 + l * 0.89, -232] });

// The ski jump along Z at the east end of the south field: up 15 m, down the in-run and off
// the table onto a landing hill, out into the sling field.
board(L('SKISPRUNG', 'SKI JUMP'), 262, -296, NORTH);
skiJump(toys, 250, -296, { climb: 83, top: 15, level: 8, inrun: 32, table: 5, hill: 58, low: 7, width: 6, color: 0x8a7a5a });
// the judges in their tower, and people along the landing hill
statics.push({ pos: [262, 4, -150], half: [2, 4, 2], color: 0xd8d4c8 });
decor.push({ type: 'box', pos: [262, 8.9, -150], half: [2.3, 0.9, 2.3], color: 0x6d8fa8 }, { type: 'box', pos: [262, 9.95, -150], half: [2.6, 0.15, 2.6], color: 0x5a5f66 });
crowd(242, -140, EAST, 5, 7);
crowd(242, -122, EAST, 4, 8);

// ---------------------------------------------------------------------------------------
// The lift by the start, up 40 m to the crazy path: a sky path of its own, only everything
// on it twice to ten times as fast, a catapult across a gap, and a slide back down to earth.
{
  const X = -148, H = 40, WOOD = 0xc9a15a, DECK = 0xe8eef5, EDGE = 0xf2c230;
  /** A deck with its top at the path's height, yellow along its sides. */
  const deck = (z: number, hz: number, hx = 3) => {
    statics.push({ pos: [X, H - 0.4, z], half: [hx, 0.4, hz], color: DECK });
    for (const s of [-1, 1]) decor.push({ type: 'box', pos: [X + s * (hx - 0.08), H + 0.006, z], half: [0.08, 0.006, hz], color: EDGE });
  };
  /** A plank from one deck to the next, its top a centimetre under theirs. */
  const walk = (z0: number, z1: number, width: number) => statics.push({ pos: [X, H - 0.16, (z0 + z1) / 2], half: [width / 2, 0.15, Math.abs(z1 - z0) / 2], color: WOOD });

  // the lift and its shaft, and a sign at its foot
  const LIFT_Z = 16;
  movers.push({ type: 'lift', pos: [X, 0.05, LIFT_Z], yaw: 0, half: [3, 0.15, 3], angle: 0, travel: H - 0.05, period: 9, color: 0x5c6670 });
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) decor.push({ type: 'box', pos: [X + sx * 3.5, (H + 3) / 2, LIFT_Z + sz * 3.5], half: [0.2, (H + 3) / 2, 0.2], color: 0xd23b3b });
  for (let y = 8; y < H; y += 8) for (const sx of [-1, 1]) decor.push({ type: 'box', pos: [X + sx * 3.5, y, LIFT_Z], half: [0.12, 0.12, 3.3], color: 0x8c949c });
  decor.push({ type: 'box', pos: [X, H + 3.1, LIFT_Z], half: [3.75, 0.2, 3.75], color: 0x3a3c40 }, { type: 'smoke', pos: [X + 2.5, H + 3.4, LIFT_Z + 2.5] });
  board(L('WAHNSINNSPFAD ↑', 'CRAZY PATH ↑'), X, LIFT_Z + 9, NORTH);

  deck(9, 4, 2.8);
  walk(5, -9, 1.2);
  deck(-12, 3);
  // the wobble bridge, rolling twice as fast as on the sky path, and further
  movers.push({ type: 'rocker', pos: [X, H, -21], yaw: 0, half: [0.9, 0.08, 6], angle: 0.22, period: 1.6, color: 0x6aa0c8 });
  deck(-30, 3);
  // two sliding planks, quicker and further
  for (const [z, phase, color] of [[-34.65, 0, 0x4a9a6a], [-37.95, -0.7, 0x3f8a8c]] as const) {
    movers.push({ type: 'slider', pos: [X, H, z], yaw: 0, half: [1.7, 0.1, 1.6], travel: 2.2, period: 2.6, phase, angle: 0, color });
  }
  deck(-42.65, 3);
  // the turbo drum: the sky path's big turning drum, ten times as fast
  movers.push({ type: 'drum', pos: [X, H + 3.5, -53.8], yaw: 0, half: [0, 0.1, 8], radius: 3.5, blades: 36, spin: 7, angle: 0, color: 0xd23b3b });
  deck(-64.95, 3);
  // a seesaw, tipped back towards the way in
  movers.push({ type: 'seesaw', pos: [X, H + 6 * Math.sin(0.22) + 0.02, -73.95], yaw: Math.PI, half: [1.0, 0.08, 6], angle: 0.22, color: 0xc86a4a });
  deck(-82.95, 3);
  // a plank with a hammer swinging across it, hung from a beam between two pylons
  walk(-85.95, -101.95, 1.6);
  movers.push({ type: 'propeller', pos: [X, H + 4.4, -94], yaw: 0, half: [0.5, 2.1, 0.2], angle: 0, blades: 2, spin: 3, color: 0xd23b3b });
  decor.push({ type: 'box', pos: [X, H + 4.4, -93.4], half: [3.6, 0.15, 0.15], color: 0x3a3c40 });
  for (const s of [-1, 1]) decor.push({ type: 'box', pos: [X + s * 3.6, H - 1, -93.4], half: [0.2, 5.5, 0.2], color: 0x5a5f66 });
  deck(-104.95, 3);
  // a turntable spinning four times as fast as the sky path's
  spinners.push({ pos: [X, H, -111.15], radius: 3.2, speed: 3, color: 0xe8833a });
  deck(-117.45, 3);
  // a kicker and a jump over four metres of nothing
  walk(-120.45, -126.45, 1.6);
  const KICK = Math.atan2(0.3, 1.6);
  statics.push({ pos: [X, H + 0.15 - 0.15 * Math.cos(KICK), -127.25 - 0.15 * Math.sin(KICK)], half: [0.8, 0.15, 0.8 / Math.cos(KICK)], quat: [Math.sin(KICK / 2), 0, 0, Math.cos(KICK / 2)], color: EDGE });
  deck(-139.05, 7, 4.5);
  // a catapult at the far end of that deck: stop on it, and it throws you over 13 m of nothing
  // onto the last deck
  movers.push({ type: 'catapult', pos: [X, H + 0.04, -144.5], yaw: Math.PI, half: [1.5, 0.1, 2], angle: 1, spin: 7.5, power: 14.5, aim: 0.8, color: 0xd9822b });
  deck(-165, 6, 4.5);
  // and the slide back down: 40 m in 115, steepest in the middle
  const slide = easedSlope(-286, -171, 0.03, H - 0.01);
  statics.push(...profile(X, slide, 4, 0xd23b3b));
  for (const [z, y] of slide) if (y > 1.5) decor.push({ type: 'box', pos: [X, (y - 0.4) / 2, z], half: [0.25, (y - 0.4) / 2, 0.25], color: 0x5a5f66 });
  // cartons to stop in at the bottom, before the wall
  for (let r = 0; r < 4; r++) for (let c = 0; c < 11; c++) props.push({ type: 'carton', pos: [X + (c - 5) * 0.52, 0.26 + r * 0.51, -297] });
}

// Grandstands along the south wall, a sausage stand between them.
decor.push(...stand(-60, -292, NORTH, 40, 5, 53), ...stand(110, -292, NORTH, 40, 5, 54));
statics.push({ pos: [-60, 0.6, -289.2], half: [20, 0.6, 0.2], color: 0xd8dde2 }, { pos: [110, 0.6, -289.2], half: [20, 0.6, 0.2], color: 0xd8dde2 });
snackStand(yard, 25, -296, NORTH, SHIRTS, 4);

// ---------------------------------------------------------------------------------------
// Outside the north wall a fair: a big wheel with gondolas that keeps turning, a booster
// swinging its two gondolas over the top, a row of booths.
const WHEEL_Z = LOT_Z + 26;
const WHEEL_R = 18;
movers.push(
  { type: 'propeller', pos: [0, WHEEL_R + 3, WHEEL_Z], yaw: 0, half: [0.3, WHEEL_R / 2, 0.3], angle: 0, blades: 12, spin: 0.25, color: 0xe8e2d0, gondolas: true },
  { type: 'propeller', pos: [120, 21, WHEEL_Z + 4], yaw: 0, half: [0.5, 8, 0.5], angle: 0, blades: 2, spin: 1.1, color: 0x7b2d8e, gondolas: true },
);
for (const z of [-1.2, 1.2]) decor.push({ type: 'box', pos: [0, (WHEEL_R + 3) / 2, WHEEL_Z + z], half: [0.4, (WHEEL_R + 3) / 2, 0.3], color: 0x5a5f66 });
for (const z of [-1.4, 1.4]) decor.push({ type: 'box', pos: [120, 10.5, WHEEL_Z + 4 + z], half: [0.5, 10.5, 0.4], color: 0x3a3c40 });
let booth = 0;
for (let x = -90; x <= 90; x += 15) {
  if (Math.abs(x) < 26) continue;
  decor.push(...house(x, LOT_Z + 12, Math.PI, 7, 5, 2.6, booth++));
}
for (let x = 150; x <= 300; x += 15) decor.push(...house(x, LOT_Z + 12, Math.PI, 7, 5, 2.6, booth++));
// People at the fair, a queue for the big wheel and one for the booster.
{
  let k = 0;
  for (const x of [-80, -66, -50, -38, 34, 47, 61, 78, 160, 190, 222, 250, 284]) {
    for (const dx of [-1, 0.4]) decor.push(person(x + dx, LOT_Z + 7.5 + (k % 2), Math.PI + (k++ % 3) * 0.4, SHIRTS[k % SHIRTS.length], (['stand', 'phone', 'wave', 'point'] as const)[k % 4]));
  }
  for (let q = 0; q < 6; q++) decor.push(person(-4 - q * 0.8, WHEEL_Z - 4 + (q % 2) * 0.3, Math.PI / 2, SHIRTS[(q + 3) % SHIRTS.length], q === 5 ? 'phone' : 'stand'));
  decor.push(person(3, WHEEL_Z - 3.2, -Math.PI / 2, RED, 'point', true));
  for (let q = 0; q < 5; q++) decor.push(person(112 - q * 0.8, WHEEL_Z - 3 + (q % 2) * 0.3, Math.PI / 2, SHIRTS[(q + 5) % SHIRTS.length], q === 0 ? 'wave' : 'stand'));
}
// Folk strolling along the fair, between its booths and the wall.
const fair: TrafficDef[] = [0, 1, 2, 3, 4, 5].map((k) => ({
  type: 'walker',
  color: SHIRTS[(k * 3) % SHIRTS.length],
  speed: 1 + (k % 3) * 0.15,
  offset: k * 135,
  carry: k % 3 === 0,
  path: [[-100, LOT_Z + 6.2], [300, LOT_Z + 6.2], [300, LOT_Z + 6.8], [-100, LOT_Z + 6.8]],
}));
// Hot-air balloons over the fair and the fields, a zeppelin and a small plane over it all.
decor.push(
  { type: 'balloon', pos: [-60, 34, LOT_Z + 40], color: RED },
  { type: 'balloon', pos: [70, 42, LOT_Z + 60], color: 0x2f6db5 },
  { type: 'balloon', pos: [240, 50, LOT_Z + 30], color: 0xe3c04a },
  { type: 'balloon', pos: [60, 38, -340], color: 0x3f8f5f },
  { type: 'zeppelin', pos: [80, 95, -100], half: [220, 0, 0], yaw: EAST, color: 0xd8d4c8 },
  { type: 'plane', pos: [80, 60, -60], half: [200, 0, 0], yaw: EAST, color: 0xe3c04a },
);
// Woods either side, and the road along the south with its traffic.
const SOUTH_ROAD = street({ z: FIELD_S - 14, x0: -320, x1: 480, near: 1, cars: 9, seed: 12 });
decor.push(
  ...SOUTH_ROAD.decor,
  ...forest({ x: [FIELD_E + 8, FIELD_E + 55], z: [FIELD_S - 5, LOT_Z + 40], count: 70, seed: 13 }),
  ...forest({ x: [-LOT_X - 55, -LOT_X - 8], z: [FIELD_S - 5, LOT_Z + 40], count: 70, seed: 14 }),
  ...forest({ x: [-LOT_X, FIELD_E], z: [FIELD_S - 70, FIELD_S - 26], count: 80, seed: 15 }),
);

export const SPIELWIESE: TrackDef = {
  id: 'spielwiese',
  name: L('Spielwiese', 'Playground'),
  blurb: L(
    'Sieben Loopings, sieben Schleudern (die stärkste zehnmal so stark wie die alte), Wippen bis 80 m, ein Aufzug zum Wahnsinnspfad in 40 m Höhe, Feuerreifen, Turbotrommeln, Zentrifuge, Halfpipe, ein geschlossener Steilwandkessel, Skisprung: alles, was Unsinn ist.',
    'Seven loops, seven catapults (the strongest ten times the old one), seesaws up to 80 m, a lift up to the crazy path 40 m high, hoops of fire, turbo drums, a centrifuge, a half-pipe, a closed wall of death, a ski jump: everything that is nonsense.',
  ),
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
  traffic: [...SOUTH_ROAD.traffic, ...fair],
  // (whatever is thrown off the end of the world comes back to the start)
  fallY: -30,
};
