import type { BoxDef, DecorDef, PropDef, TrackDef } from '../sim/Track';

const FLOOR = 0x7d7f80;
const WALL = 0xb9b2a3;
const STEEL = 0x5c6670;
const WOOD = 0x9a6a3c;

// The tuning garage: a room of 12 × 12 m, the vehicle in the middle on a painted bay, the
// camera circling inside. Nothing is driven here. Parts that touch butt up flush against
// each other or are a little thinner, so no two faces share a plane.
const R = 6;
const WALL_T = 0.2;
const H = 2.8;
/** The inner faces of the walls. */
const IN = R - WALL_T;

const statics: BoxDef[] = [
  { pos: [0, -0.5, 0], half: [R + WALL_T, 0.5, R + WALL_T], color: FLOOR },
  { pos: [0, H / 2, -R], half: [R + WALL_T, H / 2, WALL_T], color: WALL },
  { pos: [0, H / 2, R], half: [R + WALL_T, H / 2, WALL_T], color: WALL },
  { pos: [-R, H / 2, 0], half: [WALL_T, H / 2, R - WALL_T], color: WALL },
  { pos: [R, H / 2, 0], half: [WALL_T, H / 2, R - WALL_T], color: WALL },
];

const decor: DecorDef[] = [
  // the bay the vehicle stands on, and an old oil stain
  { type: 'ring', pos: [0, 0.004, 0], half: [1.6, 0, 0.06], color: 0xf2c230 },
  { type: 'label', pos: [0, 0.004, 2.3], half: [0.35, 0, 1.2], text: 'TUNING' },
  { type: 'slab', pos: [0, 0.003, 0], color: 0x3a3c3e, points: [[2.4, -1.6], [3.1, -1.9], [3.4, -1.2], [2.8, -0.9]] },
  // the roller door in the front wall, slats flush on its face
  { type: 'box', pos: [0, 1.2, IN - 0.03], half: [2.2, 1.2, 0.03], color: 0x8e969c },
];
for (let y = 0.15; y < 2.4; y += 0.3) decor.push({ type: 'box', pos: [0, y, IN - 0.08], half: [2.15, 0.03, 0.02], color: 0x737b82 });

// Workbench along the back wall, the pegboard with the tools above it.
const BENCH_X = -2;
decor.push(
  { type: 'box', pos: [BENCH_X, 0.9, -IN + 0.4], half: [1.6, 0.04, 0.4], color: WOOD },
  { type: 'box', pos: [BENCH_X, 1.7, -IN + 0.02], half: [1.4, 0.6, 0.02], color: 0xc8b48a },
);
for (const dx of [-1.5, 1.5]) for (const dz of [0.08, 0.72]) decor.push({ type: 'box', pos: [BENCH_X + dx, 0.43, -IN + dz], half: [0.04, 0.43, 0.04], color: STEEL });
for (const [dx, y, w, h, c] of [[-1, 1.8, 0.04, 0.2, 0xd23b3b], [-0.6, 1.75, 0.15, 0.03, 0x444444], [-0.2, 1.85, 0.03, 0.25, 0x2f6db5], [0.3, 1.7, 0.12, 0.12, 0x444444], [0.8, 1.8, 0.03, 0.3, 0xe3c04a]] as const) {
  decor.push({ type: 'box', pos: [BENCH_X + dx, y, -IN + 0.06], half: [w, h, 0.02], color: c });
}
// a toolbox and a battery on the bench (standing on its top, at 0.94)
decor.push(
  { type: 'box', pos: [BENCH_X - 0.8, 1.06, -IN + 0.4], half: [0.3, 0.12, 0.15], color: 0xd23b3b },
  { type: 'box', pos: [BENCH_X + 0.7, 1.04, -IN + 0.35], half: [0.15, 0.1, 0.1], color: 0x222222 },
);

// Shelves along the left wall with boxes of bits.
const SHELF_X = -IN + 0.3;
for (const z of [-3, -1, 1]) decor.push({ type: 'box', pos: [SHELF_X, 1.1, z], half: [0.3, 1.1, 0.03], color: STEEL });
for (const y of [0.3, 1.0, 1.7]) {
  decor.push({ type: 'box', pos: [SHELF_X, y, -1], half: [0.29, 0.02, 1.97], color: WOOD });
  // (clear of the middle upright, and inside the planks however far along they sit)
  for (const [z, c] of [[-2.4, 0x4f8fb8], [-1.75, 0xe8833a], [-0.2, 0x6aa04a], [0.45, 0xc9a15a]] as const) {
    decor.push({ type: 'box', pos: [SHELF_X, y + 0.17, z + (y - 1) * 0.3], half: [0.22, 0.15, 0.3], color: c });
  }
}

// A stack of old tyres and a few cartons in the right-hand corner.
for (let i = 0; i < 4; i++) decor.push({ type: 'box', pos: [IN - 0.6, 0.11 + i * 0.22, -IN + 0.6], half: [0.35, 0.1, 0.35], color: 0x2a2a2a });
const props: PropDef[] = [
  { type: 'carton', pos: [IN - 0.5, 0.26, 2.5] },
  { type: 'carton', pos: [IN - 0.5, 0.26, 3.05] },
  { type: 'carton', pos: [IN - 0.5, 0.77, 2.75] },
  { type: 'cone', pos: [3, 0.26, 3.5] },
];

export const GARAGE: TrackDef = {
  id: 'garage',
  name: 'Garage',
  blurb: '',
  unlockPrice: 0,
  lapPay: 0,
  spawn: { pos: [0, 0.5, 0], yaw: 0.6 },
  statics,
  props,
  // (out of reach: nothing is timed in here)
  gates: [{ x: 100, z: 100, hx: 0.1, hz: 0.1 }],
  pickups: [],
  decor,
};
