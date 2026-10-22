import { L } from '../i18n';
import { ramp, type BoxDef, type DecorDef, type MoverDef, type PickupDef, type PropDef, type TrackDef, type TrafficDef } from '../sim/Track';
import { forest, stand, street } from './scenery';
import { frame, hall, part, person, quat, smoke, snackStand, tyres, type Yard } from './works';

const TARMAC = 0x45484d;
const CONCRETE = 0x9a9a94;
const GRASS = 0x5c9447;
const RAMP = 0xc9a15a;

// A disused airfield: 440 × 170 m of tarmac, a long lap around the hangar strip
// and enough room to find out what 75 km/h feels like.
const LOT_X = 220;
const LOT_Z = 85;
const ISLAND_X = 100;
const ISLAND_Z = 14;
const WIDTH = 16;
const OUTER_X = ISLAND_X + WIDTH;
const OUTER_Z = ISLAND_Z + WIDTH;
const LINE_X = ISLAND_X + WIDTH / 2;
const LINE_Z = ISLAND_Z + WIDTH / 2;

const statics: BoxDef[] = [
  { pos: [0, -0.5, 0], half: [LOT_X, 0.5, LOT_Z], color: TARMAC },
  { pos: [0, 0.5, LOT_Z], half: [LOT_X, 0.5, 0.3], color: CONCRETE },
  { pos: [0, 0.5, -LOT_Z], half: [LOT_X, 0.5, 0.3], color: CONCRETE },
  { pos: [LOT_X, 0.5, 0], half: [0.3, 0.5, LOT_Z], color: CONCRETE },
  { pos: [-LOT_X, 0.5, 0], half: [0.3, 0.5, LOT_Z], color: CONCRETE },
  { pos: [0, 0.3, 0], half: [ISLAND_X, 0.3, ISLAND_Z], color: GRASS },
  // hangars on the island
  { pos: [-55, 4, 0], half: [22, 4, 9], color: 0x8c949c },
  { pos: [0, 5, 0], half: [20, 5, 10], color: 0x7d8790 },
  { pos: [55, 4, 0], half: [22, 4, 9], color: 0x8c949c },
  // outer post of the start/finish arch
  { pos: [-10, 1.6, -OUTER_Z - 0.6], half: [0.15, 1.6, 0.15], color: 0xd23b3b },
  // start straight (driven in +X): two kickers, one after the other
  ramp([30, -LINE_Z - 4], Math.PI / 2, 6, 5, 0.16, RAMP),
  ramp([70, -LINE_Z + 4], Math.PI / 2, 8, 5, 0.22, RAMP),
  // back straight (driven in -X): the big one
  ramp([20, LINE_Z], -Math.PI / 2, 14, 7, 0.28, RAMP),
  // free jump area on the apron in the south
  ramp([-150, -70], Math.PI / 2, 10, 6, 0.3, RAMP),
  ramp([-110, -70], Math.PI / 2, 16, 6, 0.36, RAMP),
  // the wide open east half of that same apron had nothing in it at all: three more jumps,
  // all different, to go find (well clear of the perimeter road's traffic along z = -50)
  ramp([90.5, -60], Math.PI / 2, 10, 6, 0.32, RAMP), // top lands 3.5 m short of the trainer's tail
  ramp([160, -65], Math.PI / 2, 9, 6, 0.26, RAMP),
  ramp([190, -74], Math.PI, 8, 5, 0.3, RAMP),
  ramp([65, -78], Math.PI / 2, 6, 5, 0.2, RAMP),
];

const props: PropDef[] = [];
for (let x = -OUTER_X; x <= OUTER_X + 0.01; x += 9.667) {
  props.push({ type: 'cone', pos: [x, 0.26, OUTER_Z] }, { type: 'cone', pos: [x, 0.26, -OUTER_Z] });
}
for (let z = -OUTER_Z + 7.5; z < OUTER_Z; z += 7.5) {
  props.push({ type: 'cone', pos: [OUTER_X, 0.26, z] }, { type: 'cone', pos: [-OUTER_X, 0.26, z] });
}
// Carton walls: one behind the big ramp, one across half of the back straight.
for (let row = 0; row < 4; row++) {
  for (let col = -4; col <= 4; col++) {
    props.push({ type: 'carton', pos: [-25, 0.26 + row * 0.51, LINE_Z + col * 0.52] });
    props.push({ type: 'carton', pos: [-60, 0.26 + row * 0.51, -70 + col * 0.52] });
  }
}
// Luggage carts, well, shopping carts, left on the east turn.
for (let i = 0; i < 8; i++) props.push({ type: 'cart', pos: [LINE_X + 4, 0.46, -12 + i * 3.2], yaw: 0.4 * i });
// Slalom on the start straight.
for (let i = 0; i < 6; i++) props.push({ type: 'cone', pos: [-90 + i * 12, 0.26, -LINE_Z + (i % 2 ? 3 : -3)] });

const pickups: PickupDef[] = [];
const corners: [number, number][] = [[-LINE_X, -LINE_Z], [LINE_X, -LINE_Z], [LINE_X, LINE_Z], [-LINE_X, LINE_Z]];
for (let side = 0; side < 4; side++) {
  const [ax, az] = corners[side];
  const [bx, bz] = corners[(side + 1) % 4];
  const len = Math.hypot(bx - ax, bz - az);
  for (let d = 6; d < len; d += 12) {
    pickups.push({ type: 'screw', pos: [ax + ((bx - ax) * d) / len, 0.5, az + ((bz - az) * d) / len] });
  }
}
pickups.push({ type: 'toolbox', pos: [42, 2.2, -LINE_Z - 4] });
pickups.push({ type: 'toolbox', pos: [88, 3.4, -LINE_Z + 4] });
pickups.push({ type: 'toolbox', pos: [-6, 6.5, LINE_Z] });
pickups.push({ type: 'toolbox', pos: [-130, 5, -70] });
pickups.push({ type: 'toolbox', pos: [-80, 8.5, -70] });
for (let x = -200; x <= -160; x += 8) pickups.push({ type: 'screw', pos: [x, 0.5, -70] });

const decor: DecorDef[] = [
  { type: 'finish', pos: [-10, 0.01, -LINE_Z], half: [0.8, 0, WIDTH / 2] },
  { type: 'box', pos: [-10, 2.2, -ISLAND_Z + 0.3], half: [0.15, 1.6, 0.15], color: 0xd23b3b },
  // (the banner reaching a little past both posts, so its ends are not flush with theirs)
  { type: 'box', pos: [-10, 3.5, -LINE_Z - 0.15], half: [0.12, 0.4, WIDTH / 2 + 0.62], color: 0xf2f2f2 },
  { type: 'sign', pos: [0, 6, LOT_Z + 10], half: [60, 6, 8], color: 0xd8d4c8, text: L('FLUGPLATZ', 'AIRFIELD') },
  { type: 'lamp', pos: [-95, 0.6, 12] },
  { type: 'lamp', pos: [95, 0.6, -12] },
];
// Runway centre line on both straights.
for (const z of [-LINE_Z, LINE_Z]) {
  for (let x = -90; x <= 90; x += 12) {
    decor.push({ type: 'box', pos: [x, 0.005, z], half: [3, 0.005, 0.12], color: 0xe8e8e8 });
  }
}
for (let x = -210; x <= 210; x += 15) {
  decor.push({ type: 'box', pos: [x, 0.005, -70], half: [4, 0.005, 0.15], color: 0xe6c94a });
}

// Old planes parked on the north apron, to drive round (or under the wings of): the fuselage
// is solid, the wings sit high enough to duck under.
function plane(x: number, z: number, body: number, trim: number): void {
  statics.push({ pos: [x, 1.1, z], half: [6.5, 0.9, 0.9], color: body });
  decor.push(
    { type: 'box', pos: [x - 0.5, 2.15, z], half: [1.4, 0.12, 7], color: body },
    { type: 'box', pos: [x + 6.6, 1.2, z], half: [0.12, 0.5, 0.5], color: 0x3a3c40 }, // nose
    { type: 'box', pos: [x - 5.8, 3.0, z], half: [0.6, 1.0, 0.1], color: trim }, // fin
    { type: 'box', pos: [x - 5.8, 2.1, z], half: [0.5, 0.08, 2.4], color: body }, // tailplane
    { type: 'box', pos: [x + 3.5, 2.05, z], half: [1.2, 0.15, 0.95], color: 0x9fc4d8 }, // canopy
  );
  for (const dz of [-1.6, 1.6]) decor.push({ type: 'box', pos: [x + 1, 0.3, z + dz], half: [0.3, 0.3, 0.12], color: 0x1d1d1f });
}
plane(-150, 68, 0xe8e2d0, 0xd23b3b);
plane(-110, 72, 0xb7c9d6, 0x2f6db5);
plane(-70, 66, 0xd9c37a, 0x4f8a3c);
// An old trainer sat right in the line of the first of the three new jumps: launch before
// its tail, clear the whole fuselage and the fin, land flat beyond the nose.
plane(110, -60, 0xc9a15a, 0x7b2d8e);
decor.push({ type: 'label', pos: [82, 0.01, -60], half: [1.0, 0, 3.5], yaw: Math.PI / 2, text: L('DRÜBER!', 'OVER IT!') });
props.push({ type: 'cone', pos: [85, 0.26, -64] }, { type: 'cone', pos: [85, 0.26, -56] });

// A cargo plane you can actually drive into: a hollow fuselage, floor and roof and two side
// walls, with a ramp down from the open tail. Solid all round, so nothing short-cuts through
// its skin; the ramp lands flush with the cargo floor.
function cargoPlane(x: number, z: number, yaw: number): void {
  const f = frame(x, z, yaw);
  const q = quat(yaw);
  const CL = 11, CW = 2.6, CH = 2.6, FLOOR_Y = 0.55;
  const box = (lx: number, y: number, lz: number, hx: number, hy: number, hz: number, color: number): void => {
    const [bx, bz] = f(lx, lz);
    statics.push({ pos: [bx, y, bz], half: [hx, hy, hz], quat: q, color });
  };
  box(0, FLOOR_Y / 2, 2.5, CW / 2 + 0.3, FLOOR_Y / 2, CL / 2, 0x8c949c); // floor, cargo bay
  box(0, FLOOR_Y + CH + 0.1, 2.5, CW / 2 + 0.3, 0.1, CL / 2, 0xb7bfc6); // roof
  for (const s of [-1, 1]) box(s * (CW / 2 + 0.1), FLOOR_Y + CH / 2, 2.5, 0.1, CH / 2, CL / 2, 0xc8ccd1); // side walls
  box(0, FLOOR_Y + CH / 2, -4.5, 1.8, CH / 2, 0.1, 0xc8ccd1); // forward bulkhead, the cockpit is not modelled
  // cockpit nose and the tail fin, up top, so it still reads as a plane from outside
  box(0, FLOOR_Y + CH * 0.4, -6.2, 1.6, 0.9, 1.2, 0xd9c37a);
  // (standing in the roof, not level with its underside)
  box(0, FLOOR_Y + CH + 1.3, 7.8, 1.1, 1.15, 0.15, 0x4a7ab5);
  // the ramp down from the open tail, flush with the cargo floor (yaw then pitch, as in ramp())
  const run = 4.6, angle = Math.atan(FLOOR_Y / run);
  const cy = Math.cos(yaw / 2), sy = Math.sin(yaw / 2), sp = Math.sin(-angle / 2), cp = Math.cos(-angle / 2);
  const [rx, rz] = f(0, 7.9 + run / 2);
  statics.push({ pos: [rx, FLOOR_Y / 2, rz], half: [CW / 2, 0.06, run / 2], quat: [cy * sp, sy * cp, -sy * sp, cy * cp], color: 0x6b7078 });
  // a wing, high enough that nothing catches on it
  const [wx, wz] = f(0, 0.5);
  statics.push({ pos: [wx, FLOOR_Y + CH + 0.6, wz], half: [9, 0.15, 1.1], quat: q, color: 0xd9c37a });
}
cargoPlane(25, 64, Math.PI);
decor.push(
  { type: 'label', pos: [25, 0.57, 60], half: [1.0, 0, 3.5], yaw: Math.PI, text: 'CARGO' },
  person(21, 58.5, 0.6, 0x2b3a5a, 'point', true),
  person(29, 76, Math.PI, 0x2b3a5a, 'carry', true),
);

// Planes patrolling over the field, back and forth, high above the lap, and a zeppelin
// further up still, slower, sweeping the whole length of it.
decor.push(
  { type: 'plane', pos: [-20, 55, -40], half: [180, 0, 0], yaw: Math.PI / 2, color: 0xe8e2d0 },
  { type: 'plane', pos: [40, 70, 100], half: [140, 0, 0], yaw: 0, color: 0xb7c9d6 },
  { type: 'zeppelin', pos: [0, 100, -20], half: [230, 0, 0], yaw: Math.PI / 2, color: 0xd8d4c8 },
);

// The tower, the windsock and the fuel truck in the north-east corner.
statics.push({ pos: [165, 6, 68], half: [3, 6, 3], color: 0xd8d4c8 });
decor.push(
  { type: 'box', pos: [165, 13.5, 68], half: [3.6, 1.5, 3.6], color: 0x6d8fa8 }, // glass cab
  { type: 'box', pos: [165, 15.2, 68], half: [4, 0.2, 4], color: 0x5a5f66 }, // roof
  { type: 'box', pos: [190, 4, 70], half: [0.1, 4, 0.1], color: 0xd8dde2 }, // windsock pole
  { type: 'box', pos: [191.2, 7.6, 70], half: [1.1, 0.35, 0.35], color: 0xe8833a },
  { type: 'box', pos: [140, 1.4, 72], half: [3.5, 1.2, 1.2], color: 0xe3c04a }, // fuel truck tank
  { type: 'box', pos: [144.2, 1.3, 72], half: [0.7, 1.1, 1.1], color: 0xd23b3b }, // its cab
);
// People: mechanics at the planes, a pilot, the fuel man, the tower crew at its door, and
// visitors watching from the south side of the lap.
decor.push(
  person(-148, 66.4, 0.3, 0x2b3a5a, 'point', true),
  person(-145.5, 66.6, -0.4, 0x2b3a5a, 'stand', true),
  person(-104, 70.2, Math.PI / 2, 0x6b4a2b, 'wave'),
  person(-66, 64.3, 2.6, 0x2b3a5a, 'carry', true),
  person(140, 74, Math.PI, 0xd23b3b, 'stand', true),
  person(161.5, 66, -1.2, 0xf4f4f4, 'phone'),
);
for (const [x, k, pose] of [[-60, 0, 'wave'], [-58.6, 1, 'stand'], [-57.4, 2, 'point'], [20, 3, 'stand'], [21.2, 4, 'phone'], [70, 5, 'wave'], [71.4, 6, 'stand']] as const) {
  decor.push(person(x, -OUTER_Z - 6, (k % 3) * 0.2, [0x4a7ab5, 0xf2f2f2, 0xd23b3b, 0x3f8f5f, 0x7b2d8e, 0xe3c04a, 0x2a2a2e][k], pose));
}
// A balloon or two over the field.
decor.push({ type: 'balloon', pos: [-120, 38, 120], color: 0xe3c04a }, { type: 'balloon', pos: [150, 30, -130], color: 0x7b2d8e });
// Edge lights along both straights of the lap.
for (const z of [-OUTER_Z - 1, OUTER_Z + 1]) for (let x = -OUTER_X; x <= OUTER_X; x += 16) decor.push({ type: 'box', pos: [x, 0.15, z], half: [0.15, 0.15, 0.15], color: 0x6fc3ff });
// ---------------------------------------------------------------------------------------
// Flying day: the hangars open, a grandstand on the north apron, a four-engined old freighter
// running its engines, a helicopter on its pad by the fire station, a boneyard of old
// airframes east of the lap, and an aerobatic team overhead.
const yard: Yard = { statics, decor, props };
const movers: MoverDef[] = [];
const walkers: TrafficDef[] = [];
const SHIRTS = [0x4a7ab5, 0xf2f2f2, 0xd23b3b, 0x3f8f5f, 0x7b2d8e, 0xe3c04a, 0x2a2a2e, 0xc8c8c8, 0xe8833a];
const MECHANIC = 0x2b3a5a;

// The hangars: a sliding door on either long side, its panels' seams standing proud, a darker
// roof on top and a sign up there with its number.
for (const [k, x, hx, h, hz] of [[1, -55, 22, 8, 9], [2, 0, 20, 10, 10], [3, 55, 22, 8, 9]] as const) {
  const doorTop = h - 1.4, doorHalf = hx - 4;
  for (const s of [-1, 1]) {
    decor.push({ type: 'box', pos: [x, (0.6 + doorTop) / 2, s * (hz + 0.04)], half: [doorHalf, (doorTop - 0.6) / 2, 0.04], color: 0x6b7a86 });
    for (let dx = -doorHalf + 4; dx < doorHalf - 0.5; dx += 4) decor.push({ type: 'box', pos: [x + dx, (0.6 + doorTop) / 2, s * (hz + 0.11)], half: [0.06, (doorTop - 0.6) / 2 - 0.05, 0.03], color: 0x4a5560 });
  }
  decor.push(
    { type: 'box', pos: [x, h + 0.15, 0], half: [hx + 0.4, 0.15, hz + 0.4], color: 0x5a5f66 },
    { type: 'board', pos: [x, h + 1.9, 0], half: [5, 1, 0.1], text: `HANGAR ${k}` },
  );
}

// Runway paint: piano keys at both ends of both straights, and the numbers, 09 one way, 27 the other.
for (const [z, sign] of [[-LINE_Z, 1], [LINE_Z, -1]] as const) {
  for (const end of [-1, 1]) {
    for (let k = 1; k <= 5; k++) for (const s of [-1, 1]) decor.push({ type: 'box', pos: [end * 96, 0.005, z + s * k * 1.25], half: [2, 0.005, 0.42], color: 0xe8e8e8 });
    // (the number a straight starts with as it is driven, at its near end, the other at its far one)
    const text = end * sign < 0 ? '09' : '27';
    decor.push({ type: 'label', pos: [end * 102, 0.01, z], half: [1.6, 0, 3], yaw: end < 0 ? Math.PI / 2 : -Math.PI / 2, text });
  }
}

// The grandstand on the north apron, a barrier in front, a sausage stand and a row of
// portable loos beside it, and visitors walking up and down in front of it all.
decor.push(...stand(-20, 79, Math.PI, 32, 5, 61));
statics.push({ pos: [-20, 0.6, 76.8], half: [16.5, 0.6, 0.2], color: 0xd8dde2 });
snackStand(yard, 8, 80, Math.PI, SHIRTS, 4);
for (let k = 0; k < 4; k++) {
  const x = 42 + k * 1.4;
  statics.push({ pos: [x, 1.1, 82], half: [0.6, 1.1, 0.6], color: 0x2f6db5 });
  decor.push({ type: 'box', pos: [x, 2.26, 82], half: [0.65, 0.06, 0.65], color: 0xf2f2f2 }, { type: 'box', pos: [x, 1.0, 81.37], half: [0.4, 0.9, 0.03], color: 0x24548c });
}
for (let k = 0; k < 4; k++) {
  walkers.push({ type: 'walker', color: SHIRTS[(k * 2 + 1) % SHIRTS.length], speed: 1 + k * 0.12, offset: k * 22, carry: k === 2, path: [[-40, 74.2], [4, 74.2], [4, 74.8], [-40, 74.8]] });
}

// The old freighter: four engines, their propellers turning (solid: keep clear of them),
// exhaust smoke behind each, the crew about it.
{
  const X = 85, Z = 66;
  statics.push({ pos: [X, 1.7, Z], half: [11, 1.3, 1.3], color: 0xc8ccd1 });
  decor.push(
    { type: 'box', pos: [X + 11.6, 1.6, Z], half: [0.6, 0.9, 0.9], color: 0xb7bfc6 }, // nose
    { type: 'box', pos: [X + 9.6, 2.95, Z], half: [1.2, 0.2, 1.05], color: 0x9fc4d8 }, // cockpit glazing
    { type: 'box', pos: [X + 1, 2.5, Z], half: [2, 0.18, 17], color: 0xb7bfc6 }, // wing
    { type: 'box', pos: [X - 10.4, 4.4, Z], half: [1.3, 1.6, 0.14], color: 0xd23b3b }, // fin
    { type: 'box', pos: [X - 10.4, 3.0, Z], half: [0.9, 0.1, 4.2], color: 0xb7bfc6 }, // tailplane
    { type: 'box', pos: [X - 4, 2.1, Z], half: [5, 0.08, 1.32], color: 0xd23b3b }, // a stripe down the side
  );
  for (const dz of [-10, -5, 5, 10]) {
    decor.push({ type: 'box', pos: [X + 2.6, 2.25, Z + dz], half: [1.7, 0.5, 0.5], color: 0x8c949c }, smoke(X - 0.6, 2.6, Z + dz));
    movers.push({ type: 'propeller', pos: [X + 4.42, 2.25, Z + dz], yaw: Math.PI / 2, half: [0.18, 0.9, 0.05], angle: 0, blades: 3, spin: 14, color: 0x2a2a2e });
  }
  // the undercarriage under the inner engines, and a tail wheel
  for (const dz of [-5, 5]) decor.push({ type: 'box', pos: [X + 2.6, 0.55, Z + dz], half: [0.35, 0.55, 0.25], color: 0x1d1d1f });
  decor.push({ type: 'box', pos: [X - 10, 0.25, Z], half: [0.25, 0.25, 0.12], color: 0x1d1d1f });
  decor.push(
    person(X + 13.5, Z - 2, -1.2, MECHANIC, 'point', true),
    person(X + 13.4, Z + 2.4, -2.2, 0xf2f2f2, 'wave'), // the pilot
    person(X - 2, Z - 3.2, 0.3, MECHANIC, 'carry', true),
    person(X - 6, Z + 3.4, Math.PI, MECHANIC, 'stand', true),
  );
  // a ladder up to the door
  decor.push({ type: 'box', pos: [X - 6, 1.1, Z - 1.75], half: [0.35, 1.1, 0.12], color: 0xe3c04a });
}

// The helicopter pad west of the lap, and the fire station beside it with its engine out.
{
  const HX = -160, HZ = 0;
  decor.push({ type: 'ring', pos: [HX, 0.012, HZ], half: [7, 0, 0.35], color: 0xf2f2f2 }, { type: 'label', pos: [HX, 0.01, HZ - 0.5], half: [3, 0, 3], yaw: Math.PI / 2, text: 'H' });
  statics.push({ pos: [HX, 1.25, HZ + 1.2], half: [1.2, 0.95, 2.2], color: 0xd23b3b });
  decor.push(
    { type: 'box', pos: [HX, 1.75, HZ + 3.0], half: [1.0, 0.6, 0.5], color: 0x9fc4d8 }, // the bubble
    { type: 'box', pos: [HX, 1.7, HZ - 3.6], half: [0.25, 0.25, 2.6], color: 0xd23b3b }, // tail boom
    { type: 'box', pos: [HX + 0.3, 2.1, HZ - 6.0], half: [0.06, 0.7, 0.12], color: 0x2a2a2e }, // tail rotor
    { type: 'box', pos: [HX, 2.35, HZ + 1.2], half: [0.2, 0.15, 0.2], color: 0x2a2a2e }, // rotor head
    { type: 'box', pos: [HX, 2.55, HZ + 1.2], half: [0.12, 0.03, 5.5], yaw: 0.6, color: 0x3a3c40 },
    { type: 'box', pos: [HX, 2.55, HZ + 1.2], half: [0.12, 0.03, 5.5], yaw: 0.6 + Math.PI / 2, color: 0x3a3c40 },
  );
  for (const s of [-1, 1]) decor.push({ type: 'box', pos: [HX + s * 1.1, 0.12, HZ + 1.2], half: [0.07, 0.07, 2.4], color: 0x2a2a2e });
  decor.push(person(HX + 2.4, HZ + 2.6, -1.6, 0xf2f2f2, 'stand'), person(HX + 3.2, HZ - 0.4, -1.2, 0x4a7ab5, 'phone'));
  // the fire station facing the pad, its engine out on the apron, the crew by it
  hall(yard, HX, 36, Math.PI, 16, 10, 6, 0xc94a3a, 0x5a5f66, 10);
  const yaw = Math.PI / 2;
  const f = frame(HX + 4, 24, yaw);
  const [bx, bz] = f(0, -0.6);
  statics.push({ pos: [bx, 1.5, bz], half: [1.25, 1.1, 3.4], quat: quat(yaw), color: 0xd23b3b }); // the body
  decor.push(
    part(f, yaw, 0, 1.5, 3.6, 1.25, 1.1, 0.8, 0xd23b3b), // cab
    part(f, yaw, 0, 2.0, 4.42, 1.05, 0.45, 0.02, 0x26323d), // windscreen
    part(f, yaw, 0, 2.75, -0.6, 0.35, 0.15, 3.8, 0xc8ccd1), // the ladder on the roof
    part(f, yaw, 0, 2.66, 3.6, 0.6, 0.06, 0.15, 0x2f6db5), // blue lights
    part(f, yaw, 0, 1.1, -0.6, 1.27, 0.08, 3.42, 0xf2f2f2), // a white band round it
  );
  for (const lz of [3.4, -1.8, -3.2]) for (const s of [-1, 1]) decor.push(part(f, yaw, s * 1.15, 0.5, lz, 0.18, 0.5, 0.5, 0x1d1d1f));
  decor.push(person(HX + 1.5, 21.5, -0.8, 0x3a3a40, 'stand', true), person(HX + 6.6, 21.2, 0.4, 0x3a3a40, 'point', true), person(HX + 9.3, 25.6, -2.4, 0x3a3a40, 'phone', true));
}

// The boneyard east of the lap: old airframes left to rot. A fuselage to jump over from a
// ramp, one propped nose-up as a ramp of its own, wings stacked, engines on their stands.
{
  decor.push({ type: 'board', pos: [150, 2.6, 42], half: [4.5, 0.55, 0.06], text: L('FLUGZEUGFRIEDHOF', 'BONEYARD') });
  // the fuselage lying across the way, its tail fin still on, and the ramp to clear it
  statics.push({ pos: [146, 1.1, -20], half: [1.2, 1.1, 7], color: 0xa9b1b8 });
  decor.push({ type: 'box', pos: [146, 1.1, -27.15], half: [1.0, 0.9, 0.15], color: 0x5a5f66 }, { type: 'box', pos: [146, 2.9, -25.5], half: [0.12, 0.8, 1.1], color: 0x7b2d8e });
  statics.push(ramp([126, -20], Math.PI / 2, 9, 5, 0.3, RAMP));
  decor.push({ type: 'label', pos: [122, 0.01, -20], half: [1.0, 0, 3.5], yaw: Math.PI / 2, text: L('DRÜBER!', 'OVER IT!') });
  pickups.push({ type: 'toolbox', pos: [146, 5.2, -20] });
  // the one propped nose-up on a trestle: drive up its back from the east and off its nose
  const tilt = 0.32, len = 13;
  statics.push(ramp([155, 14], -Math.PI / 2, len, 2.4, tilt, 0xb7bfc6, 0, 0.5));
  decor.push({ type: 'box', pos: [143.4, 1.4, 14], half: [0.4, 1.4, 1.4], color: 0x5a5f66 });
  // wings stacked crosswise, engines on their stands, a tail fin standing on its own
  for (let k = 0; k < 3; k++) statics.push({ pos: [175, 0.15 + k * 0.3, 28 - k * 0.4], half: [1.6, 0.15, 7 - k], quat: quat(0.2 * k - 0.2), color: [0xb7bfc6, 0xd9c37a, 0xa9b1b8][k] });
  for (const x of [170, 176, 182]) {
    statics.push({ pos: [x, 0.9, -32], half: [0.8, 0.5, 1.2], color: 0x6b7078 });
    decor.push({ type: 'box', pos: [x, 0.2, -32], half: [0.6, 0.2, 0.9], color: 0xe3c04a });
  }
  statics.push({ pos: [185, 2.2, 2], half: [1.4, 2.2, 0.15], quat: quat(0.4), color: 0xd23b3b });
  for (const [x, z] of [[160, -8], [161, -6.8], [167, 4], [130, 30], [131.2, 31], [180, -20]] as const) props.push({ type: 'barrel', pos: [x, 0.46, z] });
  for (let z = -36; z <= 36; z += 6) props.push({ type: 'cone', pos: [124, 0.26, z] });
  for (let z = 8; z <= 32; z += 6) pickups.push({ type: 'screw', pos: [138, 0.5, z] });
  decor.push(person(178, 36, -2.6, MECHANIC, 'point', true), person(172, -26, 0.4, 0x6b4a2b, 'phone'), person(134, -36, 0.8, 0xe3c04a, 'wave'));
}

// Tyre walls round the outside of the lap's four corners.
for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
  tyres(yard, [0, 1, 2, 3].map((k): [number, number] => [sx * (OUTER_X + 3 + k * 0.7), sz * (OUTER_Z + 3 - k * 0.7)]), [3, 2, 3, 2]);
}

// A baggage tug pottering along the north apron, and mechanics walking between the old planes.
const tug: TrafficDef = { type: 'forklift', color: 0xe3c04a, speed: 3, path: [[-40, 40], [10, 40], [10, 44], [-40, 44]] };
walkers.push(
  { type: 'walker', color: MECHANIC, speed: 1.1, worker: true, path: [[-160, 76], [-60, 76], [-60, 76.6], [-160, 76.6]] },
  { type: 'walker', color: MECHANIC, speed: 0.9, worker: true, offset: 120, path: [[-160, 76], [-60, 76], [-60, 76.6], [-160, 76.6]] },
);
// The aerobatic team: three in a vee, in step, low over the lap.
for (const [dx, dz] of [[0, 0], [-7, -6], [-7, 6]] as const) {
  decor.push({ type: 'plane', pos: [dx, 32, dz], half: [170, 2.5, 0], yaw: Math.PI / 2, color: 0xd23b3b });
}

// Woods round the field, and the road past the gate with traffic.
const SOUTH_ROAD = street({ z: -LOT_Z - 14, x0: -320, x1: 320, near: 1, cars: 7, seed: 11 });
decor.push(
  ...SOUTH_ROAD.decor,
  ...forest({ x: [-300, 300], z: [LOT_Z + 22, LOT_Z + 70], count: 70, seed: 3 }),
  ...forest({ x: [-300, 300], z: [-LOT_Z - 70, -LOT_Z - 26], count: 60, seed: 4 }),
  ...forest({ x: [LOT_X + 8, LOT_X + 50], z: [-LOT_Z, LOT_Z], count: 25, seed: 5 }),
  ...forest({ x: [-LOT_X - 50, -LOT_X - 8], z: [-LOT_Z, LOT_Z], count: 25, seed: 6 }),
);

export const FLUGPLATZ: TrackDef = {
  id: 'flugplatz',
  name: L('Alter Flugplatz', 'Old Airfield'),
  blurb: L('Über 500 m pro Runde, breite Bahn, große Schanzen, alte Flugzeuge. Erst mit Tuning ein Vergnügen.', 'Over 500 m a lap, a wide runway, big jumps, old planes. Fun only once tuned.'),
  unlockPrice: 180,
  lapPay: 40,
  spawn: { pos: [-20, 0.6, -LINE_Z], yaw: Math.PI / 2 },
  statics,
  props,
  gates: [
    { x: -10, z: -LINE_Z, hx: 3, hz: WIDTH / 2 + 2 },
    { x: LINE_X, z: 0, hx: WIDTH / 2 + 2, hz: 3 },
    { x: 0, z: LINE_Z, hx: 3, hz: WIDTH / 2 + 2 },
    { x: -LINE_X, z: 0, hx: WIDTH / 2 + 2, hz: 3 },
  ],
  pickups,
  decor,
  movers,
  traffic: [
    tug,
    ...walkers,
    // follow-me car on the perimeter road, and a van that got lost on the apron
    { type: 'car', color: 0xf2c230, speed: 11, path: [[-200, -50], [200, -50], [200, 50], [-200, 50]] },
    { type: 'car', color: 0x4a8f5a, speed: 9, offset: 500, path: [[-200, -50], [200, -50], [200, 50], [-200, 50]] },
    { type: 'van', color: 0xd9dde2, speed: 6, path: [[-190, -60], [-190, -80], [-30, -80], [-30, -60]] },
    ...SOUTH_ROAD.traffic,
  ],
};
