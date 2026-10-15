import type { BoxDef, DecorDef, PropDef, TrackDef } from '../sim/Track';
import { frame, part, tyres, type Yard } from './works';

const FLOOR = 0x7d7f80;
const WALL = 0xb9b2a3;
const STEEL = 0x5c6670;
const WOOD = 0x9a6a3c;
const YELLOW = 0xe3c04a;

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

// The lift: a flat platform on a scissor mechanism, up on its little hydraulic pump, a
// ramp from the front (the roller door's side) up onto it. Small, so it is barely more
// than the pump needs to lift the vehicle clear of the floor.
const LIFT_HALF = 1.5;
const LIFT_H = 0.3;
const RAMP_RUN = 2.3;
const decor: DecorDef[] = [
  // base plate on the floor, platform up top, hazard stripes round the base
  { type: 'box', pos: [0, 0.03, 0], half: [LIFT_HALF + 0.15, 0.03, LIFT_HALF + 0.15], color: 0x3a3c3e },
  { type: 'box', pos: [0, LIFT_H - 0.05, 0], half: [LIFT_HALF, 0.05, LIFT_HALF], color: YELLOW },
  { type: 'box', pos: [0, LIFT_H - 0.055, 0], half: [LIFT_HALF - 0.12, 0.002, LIFT_HALF - 0.12], color: 0x2a2a2a },
  { type: 'label', pos: [0, LIFT_H - 0.001, -LIFT_HALF + 0.55], half: [0.3, 0, 1.0], yaw: Math.PI, text: 'TUNING' },
  { type: 'ring', pos: [0, 0.062, 0], half: [LIFT_HALF + 0.3, 0, 0.08], color: YELLOW },
];
// the ramp up from the front wall's side, landing flush on the platform's near edge
statics.push({
  pos: [0, (LIFT_H / 2) - 0.02, LIFT_HALF + RAMP_RUN / 2],
  half: [LIFT_HALF, 0.02, RAMP_RUN / 2],
  quat: [Math.sin(-Math.atan(LIFT_H / RAMP_RUN) / 2), 0, 0, Math.cos(-Math.atan(LIFT_H / RAMP_RUN) / 2)],
  color: YELLOW,
});
for (const s of [-1, 1]) decor.push({ type: 'box', pos: [s * LIFT_HALF, LIFT_H / 2, LIFT_HALF + RAMP_RUN / 2], half: [0.03, LIFT_H / 2 + 0.02, RAMP_RUN / 2], color: 0x2a2a2a });

/** A thin diagonal beam at a fixed X, from (x, y0, z0) to (x, y1, z1): one arm of the scissor. */
function beam(x: number, y0: number, z0: number, y1: number, z1: number, color: number): BoxDef {
  const dz = z1 - z0, dy = y1 - y0;
  const len = Math.hypot(dz, dy) / 2;
  const a = Math.atan2(dy, dz);
  const sp = Math.sin(-a / 2), cp = Math.cos(-a / 2);
  return { pos: [x, (y0 + y1) / 2, (z0 + z1) / 2], half: [0.05, 0.045, len], quat: [sp, 0, 0, cp], color };
}
// (the beams need a pitch, which a decor box cannot do: they are solid statics instead,
// same as the ramp — nothing drives in here to mind the extra colliders)
for (const x of [-1.15, 1.15]) {
  statics.push(beam(x, 0.08, -1.0, LIFT_H - 0.08, 1.0, STEEL), beam(x, 0.08, 1.0, LIFT_H - 0.08, -1.0, STEEL));
  decor.push(
    { type: 'box', pos: [x, 0.08, 0], half: [0.07, 0.025, 1.05], color: 0x2a2a2a }, // bottom rail, on its runners
    { type: 'box', pos: [x, LIFT_H - 0.08, 0], half: [0.07, 0.025, 1.05], color: 0x2a2a2a }, // top rail, under the platform
    { type: 'box', pos: [x, LIFT_H / 2, 0], half: [0.09, 0.09, 0.09], color: 0x1d1d1f }, // the scissor's pivot pin
  );
}
// the single hydraulic ram between the two scissors, and the hand pump beside it
statics.push(beam(0, 0.1, -0.32, LIFT_H - 0.08, 0.32, 0x2a2a2a));
decor.push(
  { type: 'box', pos: [-LIFT_HALF - 0.6, 0.35, 1.0], half: [0.22, 0.35, 0.18], color: 0x2a2a2a },
  { type: 'box', pos: [-LIFT_HALF - 0.6, 0.74, 1.0], half: [0.03, 0.22, 0.03], color: 0x8c949c },
  { type: 'box', pos: [-LIFT_HALF - 0.75, 0.92, 1.0], half: [0.17, 0.02, 0.04], color: 0x8c949c }, // pump handle
);

// the roller door in the front wall, slats flush on its face
decor.push({ type: 'box', pos: [0, 1.2, IN - 0.03], half: [2.2, 1.2, 0.03], color: 0x8e969c });
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
/**
 * A spanner hung on the pegboard: a flat handle, a wider open jaw at one end. Tilted in the
 * wall's own plane (a roll, about Z), which a decor box cannot do: it is a solid static instead.
 */
function spanner(x: number, y: number, roll: number, len: number, color: number): void {
  const [c, s] = [Math.cos(roll), Math.sin(roll)];
  statics.push(
    { pos: [BENCH_X + x, y, -IN + 0.1], half: [0.025, len / 2, 0.012], quat: [0, 0, s, c], color },
    { pos: [BENCH_X + x + s * (len + 0.07), y + c * (len + 0.07), -IN + 0.1], half: [0.08, 0.025, 0.012], quat: [0, 0, s, c], color },
  );
}
spanner(-1.35, 2.25, 0.08, 0.26, 0xb9bcc2);
spanner(-1.1, 2.3, -0.12, 0.2, 0x8c949c);
spanner(1.55, 2.28, 0.18, 0.22, 0xb9bcc2);
// a hammer and a pair of pliers, hung flat
decor.push(
  { type: 'box', pos: [BENCH_X + 0.1, 2.15, -IN + 0.1], half: [0.02, 0.3, 0.015], color: 0xc8a060 }, // hammer handle
  { type: 'box', pos: [BENCH_X + 0.1, 2.44, -IN + 0.1], half: [0.14, 0.05, 0.03], color: 0x2a2a2a }, // hammer head
  { type: 'box', pos: [BENCH_X + 0.5, 2.1, -IN + 0.1], half: [0.015, 0.22, 0.012], color: 0xd23b3b, yaw: 0.2 }, // pliers
);
// a wrench rack: a row of spanners by size, below the pegboard
for (let k = 0; k < 5; k++) decor.push({ type: 'box', pos: [BENCH_X - 1.55 + k * 0.1, 1.35, -IN + 0.08], half: [0.012, 0.16 + k * 0.02, 0.01], color: 0x9aa1a8 });

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
];
const yard: Yard = { statics, decor, props };

// A stack of old tyres in the right-hand corner, a few rolled a little way off it.
tyres(yard, [[IN - 0.65, -IN + 0.7], [IN - 1.3, -IN + 0.55], [IN - 0.9, -IN + 1.35]], [4, 1, 1]);

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

/** A stripped wheelchair hulk: the seat frame on its casters, missing its drive wheels. */
function chairHulk(x: number, z: number, yaw: number, color: number): void {
  const f = frame(x, z, yaw);
  decor.push(
    part(f, yaw, 0, 0.3, 0.05, 0.28, 0.03, 0.4, color), // seat base, bare
    part(f, yaw, 0, 0.5, -0.33, 0.26, 0.22, 0.03, color), // backrest, no cushion
    part(f, yaw, -0.26, 0.08, 0.35, 0.03, 0.08, 0.03, 0x1d1d1f), // one caster, the other gone
    part(f, yaw, 0.24, 0.3, -0.3, 0.02, 0.3, 0.02, 0x6b7078), // a bare axle stub, the wheel pulled off
  );
}
/** A gutted mobility scooter hulk: the deck and tiller, the seat and battery pulled. */
function scooterHulk(x: number, z: number, yaw: number, color: number): void {
  const f = frame(x, z, yaw);
  decor.push(
    part(f, yaw, 0, 0.18, 0, 0.22, 0.05, 0.75, color), // the deck
    part(f, yaw, 0, 0.5, 0.55, 0.04, 0.35, 0.04, 0x2a2a2a), // the tiller post, bare
    part(f, yaw, -0.2, 0.12, -0.55, 0.1, 0.12, 0.1, 0x1d1d1f),
    part(f, yaw, 0.2, 0.12, -0.55, 0.1, 0.12, 0.1, 0x1d1d1f), // rear wheels, still on
  );
}
chairHulk(IN - 0.6, IN - 0.7, Math.PI + 0.3, 0x5a5f66);
chairHulk(IN - 1.5, IN - 0.5, Math.PI - 0.5, 0x3a4048);
scooterHulk(IN - 0.7, IN - 2.1, Math.PI / 2 + 0.2, 0x7a1e1e);

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
