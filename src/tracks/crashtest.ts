import { easedRamp, profile, type BoxDef, type DecorDef, type MoverDef, type PickupDef, type PropDef, type TrackDef } from '../sim/Track';

const GROUND = 0x8a8f86;
const CONCRETE = 0x9a9a94;
const STEEL = 0x8c949c;
const WOOD = 0xc9a15a;
const STRIPE = 0xf2c230;

// The crashtest ground. A ski jump drops from a tower down onto a field of person-sized
// cones, a wall of cartons and a row of shopping carts, with a concrete wall at the end for
// whoever gets that far. Off to the side a staircase, for the classic.
const NORTH = 0;
/** Height of the tower top, and of the table the jump takes off from. */
const TOP = 9;
const TABLE = 4;
const IN_FROM = -64;
const IN_TO = -44;
/** Half extents of the ground; a wall runs round it, so nothing slides off into nothing. */
const GROUND_X = 90;
const GROUND_Z = 145;

// In-run: a smooth drop from the tower to the table, then a kicker. Many short planks, so
// even flat out nothing is a kerb on the way down.
const inrun: [number, number][] = [];
for (let i = 0; i <= 12; i++) {
  const t = i / 12;
  inrun.push([IN_FROM + (IN_TO - IN_FROM) * t, TABLE + ((TOP - TABLE) * (1 + Math.cos(Math.PI * t))) / 2]);
}
inrun.push([-41, TABLE]);
// the kicker bends up a little at a time
let ky = TABLE, kz = -41;
for (const a of [0.08, 0.16, 0.24]) {
  kz += 1;
  ky += Math.tan(a);
  inrun.push([kz, ky]);
}
const LIP = kz;

// The propeller over the table, just before the kicker: four broad blades sweeping down across
// the way, so fast there is hardly ever a gap. Whoever it catches goes flying.
const PROP_Z = -42.5;
const BLADE = 2.0;
const HUB_Y = TABLE + BLADE + 0.15;
const movers: MoverDef[] = [{ type: 'propeller', pos: [0, HUB_Y, PROP_Z], yaw: 0, half: [0.45, BLADE / 2, 0.15], angle: 0, blades: 4, spin: 3.5, color: 0xd23b3b }];

const statics: BoxDef[] = [
  { pos: [0, -0.5, 60], half: [GROUND_X, 0.5, GROUND_Z], color: GROUND },
  // the tower top to start from
  { pos: [0, TOP - 0.5, -68], half: [3, 0.5, 4], color: CONCRETE },
  ...profile(0, inrun, 4, WOOD),
];
// the boundary wall
for (const s of [-1, 1]) {
  statics.push({ pos: [s * GROUND_X, 1, 60], half: [0.4, 1, GROUND_Z], color: CONCRETE });
  statics.push({ pos: [0, 1, 60 + s * GROUND_Z], half: [GROUND_X, 1, 0.4], color: CONCRETE });
}
// the gantry the propeller hangs from: posts beside the table, a beam just upstream of the blades
const BEAM_Z = PROP_Z - 0.7;
for (const s of [-1, 1]) statics.push({ pos: [s * 2.6, (HUB_Y + 0.15) / 2, BEAM_Z], half: [0.15, (HUB_Y + 0.15) / 2, 0.15], color: STEEL });
statics.push({ pos: [0, HUB_Y, BEAM_Z], half: [2.45, 0.15, 0.15], color: STEEL });
// legs under the tower, the in-run and the table, stopping short of the planks
statics.push({ pos: [0, (TOP - 1) / 2, -68], half: [2.6, (TOP - 1) / 2, 3.6], color: STEEL });
for (const [z, y] of inrun) {
  if (z > LIP - 0.5) continue;
  const top = y - 0.35;
  if (top > 0.2) for (const x of [-1.7, 1.7]) statics.push({ pos: [x, top / 2, z], half: [0.15, top / 2, 0.15], color: STEEL });
}

const props: PropDef[] = [];
// The cone field below the jump, staggered so nothing gets through untouched.
for (let row = 0; row < 6; row++) {
  for (let col = -3; col <= 3; col++) {
    props.push({ type: 'bigcone', pos: [col * 3.2 + (row % 2) * 1.6, 1.02, LIP + 6 + row * 3.4] });
  }
}
// A wall of cartons, then the carts.
const WALL_Z = LIP + 30;
for (let r = 0; r < 5; r++) for (let c = -10; c <= 10; c++) props.push({ type: 'carton', pos: [c * 0.52, 0.26 + r * 0.51, WALL_Z] });
for (let i = -6; i <= 6; i++) props.push({ type: 'cart', pos: [i * 1.4, 0.46, WALL_Z + 8], yaw: 0.2 * i });
// The concrete wall at the end, striped, with a stack of tyres in front.
const END_Z = WALL_Z + 22;
statics.push({ pos: [0, 1.5, END_Z], half: [14, 1.5, 0.5], color: CONCRETE });
const decor: DecorDef[] = [];
for (let x = -13; x <= 13; x += 2) decor.push({ type: 'box', pos: [x, 2.6, END_Z - 0.52], half: [0.5, 0.2, 0.02], color: STRIPE });

// Off to the west: a ramp up to a landing, and the stairs back down.
const STAIRS_X = -30;
const STEP_H = 0.3;
const STEPS = 10;
const LANDING_Z = -20;
statics.push(
  ...easedRamp([STAIRS_X, LANDING_Z - 12], NORTH, 12, 5, STEP_H * STEPS, CONCRETE),
  { pos: [STAIRS_X, (STEP_H * STEPS) / 2, LANDING_Z + 3], half: [2.5, (STEP_H * STEPS) / 2, 3], color: CONCRETE },
);
for (let i = 0; i < STEPS; i++) {
  const top = STEP_H * (STEPS - 1 - i);
  if (top <= 0) continue;
  statics.push({ pos: [STAIRS_X, top / 2, LANDING_Z + 6 + 0.6 * i + 0.3], half: [2.5, top / 2, 0.3], color: CONCRETE });
}
// …and a launch ramp in the east, for a run at the wall.
statics.push(...easedRamp([28, -10], NORTH, 10, 5, 2.2, WOOD));

const pickups: PickupDef[] = [];
// screws in the air over the cones, for the freestyle
for (let i = 0; i < 5; i++) pickups.push({ type: 'screw', pos: [0, TABLE + 1.5 - i * 0.6, LIP + 3 + i * 2.5] });
for (let i = 0; i < STEPS; i += 2) pickups.push({ type: 'screw', pos: [STAIRS_X, STEP_H * (STEPS - i) + 0.4, LANDING_Z + 6 + 0.6 * i] });
pickups.push({ type: 'toolbox', pos: [28, 4.5, 6] });

decor.push(
  { type: 'sign', pos: [0, 5, END_Z + 30], half: [20, 5, 6], color: 0xe8e2d0, text: 'CRASHTEST' },
  { type: 'board', pos: [5, TABLE + 1.5, IN_TO], half: [2, 0.45, 0.05], text: 'VIEL GLÜCK' },
  { type: 'board', pos: [STAIRS_X + 4, 2, LANDING_Z + 6], half: [1.4, 0.4, 0.05], yaw: Math.PI / 2, text: 'TREPPE' },
);
// stands either side of the field, people as coloured blocks
for (const side of [-1, 1]) {
  const x = side * 22;
  for (let r = 0; r < 4; r++) decor.push({ type: 'box', pos: [x + side * r * 1.2, 0.3 + r * 0.6, LIP + 15], half: [0.6, 0.3 + r * 0.6, 14], color: 0x6b7078 });
  for (let k = 0; k < 18; k++) {
    const r = k % 4;
    decor.push({ type: 'box', pos: [x + side * r * 1.2, 1.2 * r + 0.95, LIP + 2.5 + k * 1.5], half: [0.2, 0.35, 0.2], color: [0xd23b3b, 0x2f6db5, 0xe3c04a, 0x4f8a3c][k % 4] });
  }
}
for (const x of [-12, 12]) decor.push({ type: 'lamp', pos: [x, 0, LIP + 4] });

export const CRASHTEST: TrackDef = {
  id: 'crashtest',
  name: 'Crashtest-Gelände',
  blurb: 'Skischanze vom Turm, Pylonenwald, Kartonwand, Einkaufswagen, Betonmauer. Und eine Treppe.',
  unlockPrice: 0,
  lapPay: 0,
  // (near the edge: a long run on the flat top would only make it hop over the brow)
  spawn: { pos: [0, TOP + 0.5, -66.5], yaw: NORTH },
  statics,
  props,
  // (nothing is timed here)
  gates: [{ x: 500, z: 500, hx: 0.1, hz: 0.1 }],
  pickups,
  decor,
  movers,
};
