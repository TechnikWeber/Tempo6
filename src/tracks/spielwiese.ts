import { looping, ramp, type BoxDef, type DecorDef, type PropDef, type TrackDef } from '../sim/Track';

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

/** A wall of cartons across the lane. */
function cartons(x: number, z: number, rows: number, cols: number): void {
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) props.push({ type: 'carton', pos: [x, 0.26 + r * 0.51, z + (c - (cols - 1) / 2) * 0.52] });
}

// Middle lane: three kickers, each bigger than the last.
board('SCHANZEN', -112, 9);
statics.push(ramp([-90, 0], EAST, 6, 5, 0.16, RAMP), ramp([-50, 0], EAST, 10, 6, 0.25, RAMP), ramp([0, 0], EAST, 26, 8, 0.42, RAMP));
cartons(80, 0, 5, 11);

// South lane: the looping. The run-up is the whole lane.
const LOOP_Z = -45;
board('LOOPING', -112, LOOP_Z + 9);
statics.push(...looping([0, LOOP_Z], 5, 4.7, 5, STEEL));
for (let x = -100; x <= -10; x += 10) decor.push({ type: 'box', pos: [x, 0.005, LOOP_Z], half: [2.5, 0.005, 0.12], color: 0xe6c94a });

// North lane: washboard, then a table-top.
const BUMP_Z = 45;
board('WELLEN', -112, BUMP_Z + 9);
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

// The monsters, one along each long wall.
board('MONSTER', -70, 92);
statics.push(ramp([-50, 84], EAST, 45, 10, 0.5, RAMP), ramp([60, -84], WEST, 32, 10, 0.62, RAMP));
cartons(60, 84, 6, 15);
// A steep bank at the east end to run up and turn round on.
statics.push(ramp([130, 0], EAST, 14, 60, 0.9, STEEL));
// Turntables between the lanes: a big lazy one and a small one that throws you off.
board('KREISEL', 44, -12);
const spinners = [
  { pos: [62, 0.1, -24] as [number, number, number], radius: 7, speed: 0.9, color: STEEL },
  { pos: [96, 0.1, -24] as [number, number, number], radius: 4.5, speed: -2.2, color: RAMP },
];
// Slalom between the lanes.
for (let i = 0; i < 10; i++) props.push({ type: 'cone', pos: [-100 + i * 9, 0.26, 22 + (i % 2 ? 2 : -2)] });

export const SPIELWIESE: TrackDef = {
  id: 'spielwiese',
  name: 'Spielwiese',
  blurb: 'Looping, Wellenbahn, Riesenschanzen: alles, was Unsinn ist. Rohbau.',
  unlockPrice: 0,
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
};
