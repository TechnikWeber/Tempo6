import { ramp, type BoxDef, type DecorDef, type PropDef, type TrackDef } from '../sim/Track';
import { frame, part, tyres, type Yard } from './works';

const FLOOR = 0x7d7f80;
const WALL = 0xb9b2a3;
const STEEL = 0x5c6670;
const WOOD = 0x9a6a3c;
const YELLOW = 0xe3c04a;
const PEGBOARD = 0xc9b896;

// The tuning garage: a room of 12 × 12 m, the vehicle in the middle on a scissor lift, the
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

// The lift: a platform sized to the vehicle plus a little margin (not a vast pad), on a
// scissor mechanism, up on a low hydraulic pump, a shallow ramp up from the roller door's
// side. The platform's top is a solid static — the vehicle actually stands on it, not through it.
const LIFT_HALF = 1.0;
const LIFT_H = 0.3;
const PLATE_T = 0.05;
statics.push({ pos: [0, LIFT_H - PLATE_T, 0], half: [LIFT_HALF, PLATE_T, LIFT_HALF], color: YELLOW });

const decor: DecorDef[] = [
  // the base plate on the floor, hazard stripes, an inset panel just proud of the platform's top
  { type: 'box', pos: [0, 0.03, 0], half: [LIFT_HALF + 0.15, 0.03, LIFT_HALF + 0.15], color: 0x3a3c3e },
  { type: 'box', pos: [0, LIFT_H + 0.002, 0], half: [LIFT_HALF - 0.12, 0.002, LIFT_HALF - 0.12], color: 0x2a2a2a },
  { type: 'label', pos: [0, LIFT_H + 0.003, -LIFT_HALF + 0.35], half: [0.3, 0, 0.6], yaw: Math.PI, text: 'TUNING' },
  { type: 'ring', pos: [0, LIFT_H + 0.004, 0], half: [LIFT_HALF + 0.22, 0, 0.07], color: YELLOW },
];
// the ramp up from the front (the roller door's side), its top landing flush on the platform
const RAMP_ANGLE = 0.15;
const RAMP_LEN = LIFT_H / Math.sin(RAMP_ANGLE);
const RAMP_PROJ = RAMP_LEN * Math.cos(RAMP_ANGLE);
statics.push(ramp([0, LIFT_HALF + RAMP_PROJ], Math.PI, RAMP_LEN, LIFT_HALF * 2, RAMP_ANGLE, YELLOW));
for (const s of [-1, 1]) decor.push({ type: 'box', pos: [s * LIFT_HALF, LIFT_H / 2, LIFT_HALF + RAMP_PROJ / 2], half: [0.03, LIFT_H / 2 + 0.02, RAMP_PROJ / 2], color: 0x2a2a2a });

/** A thin diagonal beam at a fixed X, from (x, y0, z0) to (x, y1, z1): one arm of the scissor. */
function beam(x: number, y0: number, z0: number, y1: number, z1: number, color: number): BoxDef {
  const dz = z1 - z0, dy = y1 - y0;
  const len = Math.hypot(dz, dy) / 2;
  const a = Math.atan2(dy, dz);
  const sp = Math.sin(-a / 2), cp = Math.cos(-a / 2);
  return { pos: [x, (y0 + y1) / 2, (z0 + z1) / 2], half: [0.08, 0.06, len], quat: [sp, 0, 0, cp], color };
}
// (the beams need a pitch, which a decor box cannot do: they are solid statics instead,
// same as the ramp — nothing drives in here to mind the extra colliders)
const SCISSOR_X = LIFT_HALF - 0.15;
const SCISSOR_Z = LIFT_HALF - 0.1;
for (const x of [-SCISSOR_X, SCISSOR_X]) {
  statics.push(beam(x, 0.07, -SCISSOR_Z, LIFT_H - 0.07, SCISSOR_Z, STEEL), beam(x, 0.07, SCISSOR_Z, LIFT_H - 0.07, -SCISSOR_Z, STEEL));
  decor.push(
    { type: 'box', pos: [x, 0.07, 0], half: [0.1, 0.03, SCISSOR_Z + 0.05], color: 0x2a2a2a }, // bottom rail, on its runners
    { type: 'box', pos: [x, LIFT_H - 0.07, 0], half: [0.1, 0.03, SCISSOR_Z + 0.05], color: 0x2a2a2a }, // top rail, under the platform
    { type: 'box', pos: [x, LIFT_H / 2, 0], half: [0.1, 0.1, 0.1], color: 0x1d1d1f }, // the scissor's pivot pin
  );
}
// the single hydraulic ram between the two scissors, and the hand pump beside the lift
statics.push(beam(0, 0.09, -SCISSOR_Z * 0.4, LIFT_H - 0.07, SCISSOR_Z * 0.4, 0x2a2a2a));
decor.push(
  { type: 'box', pos: [-LIFT_HALF - 0.55, 0.3, LIFT_HALF - 0.2], half: [0.2, 0.3, 0.16], color: 0x2a2a2a },
  { type: 'box', pos: [-LIFT_HALF - 0.55, 0.64, LIFT_HALF - 0.2], half: [0.03, 0.2, 0.03], color: 0x8c949c },
  { type: 'box', pos: [-LIFT_HALF - 0.68, 0.8, LIFT_HALF - 0.2], half: [0.15, 0.02, 0.04], color: 0x8c949c }, // pump handle
);

// the roller door in the front wall, slats flush on its face
decor.push({ type: 'box', pos: [0, 1.2, IN - 0.03], half: [2.2, 1.2, 0.03], color: 0x8e969c });
for (let y = 0.15; y < 2.4; y += 0.3) decor.push({ type: 'box', pos: [0, y, IN - 0.08], half: [2.15, 0.03, 0.02], color: 0x737b82 });

// Workbench along the back wall, a proper pegboard panel above it with the tools on it.
const BENCH_X = -2;
decor.push(
  { type: 'box', pos: [BENCH_X, 0.9, -IN + 0.4], half: [1.6, 0.04, 0.4], color: WOOD },
  { type: 'box', pos: [BENCH_X, 1.7, -IN + 0.02], half: [1.4, 0.6, 0.02], color: 0xc8b48a },
  // the pegboard itself: one clearly visible panel, everything below hangs within its bounds
  { type: 'box', pos: [BENCH_X, 2.0, -IN + 0.03], half: [1.75, 0.95, 0.02], color: PEGBOARD },
);
for (const dx of [-1.5, 1.5]) for (const dz of [0.08, 0.72]) decor.push({ type: 'box', pos: [BENCH_X + dx, 0.43, -IN + dz], half: [0.04, 0.43, 0.04], color: STEEL });
// a toolbox and a battery on the bench (standing on its top, at 0.94)
decor.push(
  { type: 'box', pos: [BENCH_X - 0.8, 1.06, -IN + 0.4], half: [0.3, 0.12, 0.15], color: 0xd23b3b },
  { type: 'box', pos: [BENCH_X + 0.7, 1.04, -IN + 0.35], half: [0.15, 0.1, 0.1], color: 0x222222 },
);
/**
 * A spanner on the pegboard: a flat handle, a head plainly wider and thicker than it so it
 * reads as a tool and not a wire. Tilted in the wall's own plane (a roll, about Z), which a
 * decor box cannot do: it is a solid static instead, same as the scissor beams and the ramp.
 */
function spanner(x: number, y: number, roll: number, len: number, color: number): void {
  const [c, s] = [Math.cos(roll), Math.sin(roll)];
  statics.push(
    { pos: [BENCH_X + x, y, -IN + 0.1], half: [0.035, len / 2, 0.018], quat: [0, 0, s, c], color },
    { pos: [BENCH_X + x + s * (len + 0.1), y + c * (len + 0.1), -IN + 0.1], half: [0.11, 0.04, 0.02], quat: [0, 0, s, c], color },
  );
}
spanner(-1.3, 2.5, 0.1, 0.4, 0xb9bcc2);
spanner(-0.75, 2.5, -0.15, 0.32, 0x8c949c);
spanner(-0.2, 2.5, 0.2, 0.36, 0xb9bcc2);
spanner(0.4, 2.5, -0.08, 0.28, 0x9aa1a8);
// a hammer and a pair of pliers, hung flat, chunky enough to read from a distance
decor.push(
  { type: 'box', pos: [BENCH_X + 1.0, 2.35, -IN + 0.1], half: [0.025, 0.32, 0.02], color: 0xc8a060 }, // hammer handle
  { type: 'box', pos: [BENCH_X + 1.0, 2.68, -IN + 0.1], half: [0.17, 0.07, 0.07], color: 0x2a2a2a }, // hammer head
  { type: 'box', pos: [BENCH_X + 1.35, 2.3, -IN + 0.1], half: [0.02, 0.26, 0.02], color: 0xd23b3b, yaw: 0.2 }, // pliers handle
  { type: 'box', pos: [BENCH_X + 1.37, 2.55, -IN + 0.1], half: [0.045, 0.1, 0.03], color: 0x8c949c, yaw: 0.2 }, // pliers jaw
);
// a rack of small spanners by size along the bottom of the board
for (let k = 0; k < 6; k++) decor.push({ type: 'box', pos: [BENCH_X - 1.6 + k * 0.1, 1.25, -IN + 0.08], half: [0.013, 0.14 + k * 0.025, 0.012], color: 0x9aa1a8 });

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

const props: PropDef[] = [
  { type: 'carton', pos: [IN - 0.5, 0.26, 2.5] },
  { type: 'carton', pos: [IN - 0.5, 0.26, 3.05] },
  { type: 'carton', pos: [IN - 0.5, 0.77, 2.75] },
  { type: 'cone', pos: [3, 0.26, 3.5] },
  // real, empty wheelchairs standing about: the actual background prop, not a drawn stand-in
  { type: 'chair', pos: [IN - 0.5, 0.45, 1.5], yaw: 1.9 },
  { type: 'chair', pos: [IN - 0.5, 0.45, -1.0], yaw: -0.6 },
];
const yard: Yard = { statics, decor, props };

// A stack of old tyres in the far corner, a few rolled a little way off it.
tyres(yard, [[IN - 0.65, -IN + 0.7], [IN - 1.3, -IN + 0.55], [IN - 0.9, -IN + 1.35]], [4, 1, 1]);

// A stripped mobility scooter against the right wall: a real vehicle model, standing idle
// with nobody in the seat — the same model driven on the tracks, not a drawn stand-in.
decor.push({ type: 'wreck', vehicle: 'komet', pos: [IN - 1.6, 0, 3.6], yaw: 2.4 });

// A welding set in the corner by the shelves: the machine, a gas bottle, the torch on its hook.
function weldingSet(x: number, z: number, yaw: number): void {
  const f = frame(x, z, yaw);
  decor.push(
    part(f, yaw, 0, 0.45, 0, 0.35, 0.45, 0.3, 0x2a2a2a),
    part(f, yaw, 0, 0.92, 0, 0.3, 0.02, 0.26, YELLOW), // carry handle rail
    part(f, yaw, -0.45, 0.4, 0, 0.09, 0.4, 0.09, 0x8c949c), // gas bottle
    part(f, yaw, -0.45, 0.84, 0, 0.1, 0.05, 0.1, 0x6b7078), // bottle valve
    part(f, yaw, 0.1, 1.05, 0.15, 0.1, 0.03, 0.03, 0x1d1d1f), // the torch, hung on the side
  );
}
weldingSet(-IN + 0.65, 3.4, Math.PI / 2);

export const GARAGE: TrackDef = {
  id: 'garage',
  name: 'Garage',
  blurb: '',
  unlockPrice: 0,
  lapPay: 0,
  spawn: { pos: [0, LIFT_H + 0.5, 0], yaw: 0.6 },
  statics,
  props,
  // (out of reach: nothing is timed in here)
  gates: [{ x: 100, z: 100, hx: 0.1, hz: 0.1 }],
  pickups: [],
  decor,
};
