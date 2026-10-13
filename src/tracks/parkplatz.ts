import { ramp, type DecorDef, type PickupDef, type PropDef, type BoxDef, type TrackDef } from '../sim/Track';

const ASPHALT = 0x3b3e44;
const CONCRETE = 0x9a9a94;
const GRASS = 0x4f8a3c;
const RAMP = 0xc9a15a;

// Lot: 140 × 90 m. The circuit runs around a planted island in the middle,
// the jump ramps stand in the open areas east and west of it.
const LOT_X = 70;
const LOT_Z = 45;
const ISLAND_X = 10;
const ISLAND_Z = 4;
const OUTER_X = 16;
const OUTER_Z = 10;

const statics: BoxDef[] = [
  { pos: [0, -0.5, 0], half: [LOT_X, 0.5, LOT_Z], color: ASPHALT },
  { pos: [0, 0.5, LOT_Z], half: [LOT_X, 0.5, 0.3], color: CONCRETE },
  { pos: [0, 0.5, -LOT_Z], half: [LOT_X, 0.5, 0.3], color: CONCRETE },
  { pos: [LOT_X, 0.5, 0], half: [0.3, 0.5, LOT_Z], color: CONCRETE },
  { pos: [-LOT_X, 0.5, 0], half: [0.3, 0.5, LOT_Z], color: CONCRETE },
  { pos: [0, 0.3, 0], half: [ISLAND_X, 0.3, ISLAND_Z], color: GRASS },
  // outer post of the start/finish arch
  { pos: [2, 1.3, -OUTER_Z - 0.6], half: [0.12, 1.3, 0.12], color: 0xd23b3b },
  // small kicker on the back straight (driven in -X direction)
  ramp([2, 8.6], -Math.PI / 2, 4, 2.4, 0.122, RAMP),
  // medium ramp in the west, big one in the east
  ramp([-40, -5], 0, 5, 4, 0.175, RAMP),
  ramp([40, -5], 0, 9, 5, 0.262, RAMP),
];

const props: PropDef[] = [];
// Cones mark the outside of the circuit.
for (let x = -OUTER_X; x <= OUTER_X + 0.01; x += 3.2) {
  props.push({ type: 'cone', pos: [x, 0.26, OUTER_Z] }, { type: 'cone', pos: [x, 0.26, -OUTER_Z] });
}
for (let z = -6.8; z <= 6.81; z += 3.4) {
  props.push({ type: 'cone', pos: [OUTER_X, 0.26, z] }, { type: 'cone', pos: [-OUTER_X, 0.26, z] });
}
// Wall of cartons behind the big ramp.
for (let row = 0; row < 3; row++) {
  for (let col = -2; col <= 2; col++) {
    props.push({ type: 'carton', pos: [40 + col * 0.52, 0.26 + row * 0.51, 26] });
  }
}
// A row of abandoned shopping carts and a slalom.
for (let i = 0; i < 6; i++) props.push({ type: 'cart', pos: [-32 + i * 0.9, 0.46, 22], yaw: 0.1 * i });
for (let i = 0; i < 6; i++) props.push({ type: 'cone', pos: [-30 + i * 4, 0.26, -22 + (i % 2) * 1.5] });

const pickups: PickupDef[] = [];
// Bottles along the racing line, every 5 m around the island.
const LINE_X = 13;
const LINE_Z = 7;
const corners: [number, number][] = [[-LINE_X, -LINE_Z], [LINE_X, -LINE_Z], [LINE_X, LINE_Z], [-LINE_X, LINE_Z]];
for (let side = 0; side < 4; side++) {
  const [ax, az] = corners[side];
  const [bx, bz] = corners[(side + 1) % 4];
  const len = Math.hypot(bx - ax, bz - az);
  for (let d = 2.5; d < len; d += 5) {
    pickups.push({ type: 'bottle', pos: [ax + ((bx - ax) * d) / len, 0.5, az + ((bz - az) * d) / len] });
  }
}
// Crates hang in the air behind the ramps: you need speed to reach them.
pickups.push({ type: 'crate', pos: [-4.5, 1.6, 8.6] });
pickups.push({ type: 'crate', pos: [-40, 2.2, 4] });
pickups.push({ type: 'crate', pos: [40, 4.3, 11] });
for (let z = -35; z <= -10; z += 5) {
  pickups.push({ type: 'bottle', pos: [40, 0.5, z] }, { type: 'bottle', pos: [-40, 0.5, z] });
}

const decor: DecorDef[] = [
  { type: 'finish', pos: [2, 0.01, -7], half: [0.6, 0, 3] },
  { type: 'box', pos: [2, 1.9, -ISLAND_Z + 0.3], half: [0.12, 1.3, 0.12], color: 0xd23b3b },
  { type: 'box', pos: [2, 2.9, -7.15], half: [0.1, 0.3, 3.5], color: 0xf2f2f2 },
  { type: 'tree', pos: [-6, 0.6, 0] },
  { type: 'tree', pos: [0, 0.6, 1] },
  { type: 'tree', pos: [6, 0.6, -0.5] },
  { type: 'lamp', pos: [-9, 0.6, 3] },
  { type: 'lamp', pos: [9, 0.6, -3] },
  { type: 'sign', pos: [0, 5, LOT_Z + 8], half: [38, 5, 6], color: 0xe8e2d0, text: 'PFANDLAND' },
];
// Parking bays north and south.
for (const z of [-33, 33]) {
  for (let x = -60; x <= 60; x += 2.7) {
    decor.push({ type: 'box', pos: [x, 0.005, z], half: [0.05, 0.005, 2.5], color: 0xdedede });
  }
}

export const PARKPLATZ: TrackDef = {
  id: 'parkplatz',
  name: 'Pfandland-Parkplatz',
  blurb: 'Enger Rundkurs um die Grüninsel. Hier fängt jeder an, mit 6 km/h.',
  unlockPrice: 0,
  spawn: { pos: [-3, 0.5, -LINE_Z], yaw: Math.PI / 2 },
  statics,
  props,
  gates: [
    { x: 2, z: -LINE_Z, hx: 1.5, hz: 3 },
    { x: LINE_X, z: 0, hx: 3, hz: 1.5 },
    { x: 0, z: LINE_Z, hx: 1.5, hz: 3 },
    { x: -LINE_X, z: 0, hx: 3, hz: 1.5 },
  ],
  pickups,
  decor,
};
