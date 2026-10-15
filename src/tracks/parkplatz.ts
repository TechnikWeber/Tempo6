import { L } from '../i18n';
import { ramp, type DecorDef, type PickupDef, type PropDef, type BoxDef, type TrackDef } from '../sim/Track';
import { car, person, snackStand, tyres, type Yard } from './works';

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
    pickups.push({ type: 'screw', pos: [ax + ((bx - ax) * d) / len, 0.5, az + ((bz - az) * d) / len] });
  }
}
// Crates hang in the air behind the ramps: you need speed to reach them.
pickups.push({ type: 'toolbox', pos: [-4.5, 1.6, 8.6] });
pickups.push({ type: 'toolbox', pos: [-40, 2.2, 4] });
pickups.push({ type: 'toolbox', pos: [40, 4.3, 11] });
for (let z = -35; z <= -10; z += 5) {
  pickups.push({ type: 'screw', pos: [40, 0.5, z] }, { type: 'screw', pos: [-40, 0.5, z] });
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
  { type: 'sign', pos: [0, 5, LOT_Z + 8], half: [38, 5, 6], color: 0xe8e2d0, text: L('BAUMARKT', 'DIY STORE') },
];
// Parking bays north and south.
for (const z of [-33, 33]) {
  for (let x = -60; x <= 60; x += 2.7) {
    decor.push({ type: 'box', pos: [x, 0.005, z], half: [0.05, 0.005, 2.5], color: 0xdedede });
  }
}

// The main road along the south side of the lot, busy both ways, with a row of trees.
const ROAD_Z = -LOT_Z - 9;
decor.push(
  { type: 'box', pos: [0, 0.01, ROAD_Z], half: [260, 0.01, 4.5], color: 0x45484d },
  { type: 'box', pos: [0, 0.07, ROAD_Z + 6], half: [260, 0.06, 1.4], color: 0xb7b2a6 },
);
for (let x = -255; x < 260; x += 6) decor.push({ type: 'box', pos: [x, 0.025, ROAD_Z], half: [1.5, 0.005, 0.08], color: 0xf2f2f2 });
for (let x = -100; x <= 100; x += 20) decor.push({ type: 'tree', pos: [x + 10, 0, ROAD_Z - 8] }, { type: 'lamp', pos: [x, 0, ROAD_Z + 6.5], yaw: Math.PI / 2 });
// a bus stop opposite the entrance
decor.push(
  { type: 'box', pos: [-20, 1.2, ROAD_Z - 6.3], half: [2, 0.05, 0.8], color: 0x5c6670 },
  { type: 'box', pos: [-20, 0.6, ROAD_Z - 6.95], half: [1.9, 0.55, 0.03], color: 0x9fc4d8 },
  { type: 'board', pos: [-17.4, 2, ROAD_Z - 5.6], half: [0.3, 0.3, 0.03], text: 'H' },
);
// Cars in about half the bays, a sausage stand by the slalom, people about.
const yard: Yard = { statics, decor, props };
{
  const colours = [0x2f6db5, 0xd23b3b, 0xc8c8c8, 0x404850, 0x2e7d4f, 0xe3c04a, 0xf2f2f2, 0x8a2c5a, 0x1c1c1f];
  let k = 0;
  for (const z of [-33, 33]) {
    for (let x = -58.65; x < 58; x += 2.7) {
      k++;
      if ((k * 7) % 11 < 5) continue;
      decor.push(...car(x, z, (k % 3 ? 0 : Math.PI) + (z > 0 ? Math.PI : 0), colours[k % colours.length]));
    }
  }
}
const SHIRTS = [0x4a7ab5, 0xf2f2f2, 0xd23b3b, 0x3f8f5f, 0x7b2d8e, 0xe3c04a, 0x2a2a2e, 0xc8c8c8];
snackStand(yard, -6, 24.5, Math.PI, SHIRTS, 4);
// staff in their red shirts and vests: one gathering the carts, one waving people in
decor.push(person(-29.5, 24, Math.PI, 0xd23b3b, 'point', true), person(-46, 19, 0.6, 0xd23b3b, 'wave', true));
// people watching the jumps from beside the big ramp
for (const [x, z, k, pose] of [[46.5, -2, 0, 'wave'], [47.2, -0.6, 4, 'stand'], [46.8, 1, 6, 'phone'], [-34.5, 2, 2, 'point'], [-35, 3.3, 5, 'stand']] as const) {
  decor.push(person(x, z, x > 0 ? -Math.PI / 2 : Math.PI / 2, SHIRTS[k], pose));
}
// shoppers carrying their boxes along the front, between the store and their cars
const SHOPPERS: [number, number][] = [[-30, 43.2], [30, 43.2], [30, 42.8], [-30, 42.8]];
// a stack of tyres for sale, and a few rolled off it
tyres(yard, [[52, 18], [52.8, 18.6], [51.4, 19.2], [49, 15], [55, 13]], [4, 3, 2, 1, 1]);

// A car and trailer in the open band north of the island: boards going on, two at it, one
// directing. The open bands either side of the island were bare asphalt; this, the fast-food
// sign and the extra trees and lamps below fill them in.
const TRAILER_X = -48, TRAILER_Z = 20;
decor.push(...car(TRAILER_X, TRAILER_Z + 3.3, 0, 0x3a6ea5));
decor.push(
  // the flat bed, on two wheels, a drawbar up to the car's tow hitch
  { type: 'box', pos: [TRAILER_X, 0.42, TRAILER_Z - 0.2], half: [0.95, 0.06, 1.8], color: 0x5a5f66 },
  { type: 'box', pos: [TRAILER_X, 0.3, TRAILER_Z + 2.0], half: [0.04, 0.04, 0.9], color: 0x2a2a2a },
  { type: 'box', pos: [TRAILER_X, 0.14, TRAILER_Z + 1.35], half: [0.05, 0.1, 0.05], color: 0x2a2a2a },
);
for (const s of [-1, 1]) decor.push({ type: 'box', pos: [TRAILER_X + s * 0.95, 0.22, TRAILER_Z - 0.2], half: [0.09, 0.22, 0.22], color: 0x1d1d1f });
// a stack of boards on the bed, and a loose one being carried across
for (let k = 0; k < 6; k++) decor.push({ type: 'box', pos: [TRAILER_X, 0.5 + k * 0.08, TRAILER_Z - 0.2], half: [0.88, 0.035, 1.7], color: k % 2 ? 0xb9875a : 0xc9a15a });
decor.push(
  person(TRAILER_X - 1.9, TRAILER_Z - 0.6, Math.PI / 2, 0xe3c04a, 'carry', true),
  person(TRAILER_X - 1.6, TRAILER_Z + 0.3, Math.PI / 2 + 0.3, 0xe3c04a, 'carry', true),
  person(TRAILER_X + 1.6, TRAILER_Z + 1.2, -Math.PI / 2.4, 0x2a2a2e, 'point', true),
);
// trees and lamps breaking up the rest of that open band
for (const [x, z] of [[-65, 20], [-20, 20], [-20, -20], [15, -20], [25, 20], [60, 20], [60, -20], [-65, -20]] as const) {
  decor.push({ type: 'tree', pos: [x, 0, z] }, { type: 'lamp', pos: [x + 4, 0, z] });
}

// The fast-food stop by the east wall, visible from well back: a big pole sign with the
// chain's own letter, same shape as the famous one, but it is a W here, not an M (trademarks
// and all). Clear of the outer loop's traffic along x = 64.
// (no person stood right by the wall here: that is exactly where a wheelchair hugging the
// wall slides past, person colliders included — see "slides along a wall" in the tests)
decor.push(
  { type: 'board', pos: [67.5, 11, 10], half: [2.0, 2.0, 0.18], yaw: Math.PI / 2, text: 'W', color: 0xffffff },
  { type: 'box', pos: [67.5, 0.1, 10], half: [1.3, 0.1, 1.3], color: 0xe8e4d8 },
);
// (well clear of the southeast corner, where a vehicle sliding along the east wall sweeps through)
decor.push(...car(45, 20, Math.PI, 0xc8c8c8), person(44, 18.7, Math.PI, 0xd23b3b, 'stand'));

// (keeping right: eastwards on the near side, back westwards on the far one)
const MAIN_ROAD: [number, number][] = [[-250, ROAD_Z + 2.2], [250, ROAD_Z + 2.2], [250, ROAD_Z - 2.2], [-250, ROAD_Z - 2.2]];

export const PARKPLATZ: TrackDef = {
  id: 'parkplatz',
  name: L('Baumarkt-Parkplatz', 'DIY Store Car Park'),
  blurb: L('Enger Rundkurs um die Grüninsel, Schanzen daneben. Hier wird zu Ende getunt.', 'A tight lap round the green island, jumps beside it. This is where the tuning gets finished.'),
  unlockPrice: 0,
  lapPay: 10,
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
  // round the island, corners cut a little, the way the bottles lie
  line: [[-9, -LINE_Z], [9, -LINE_Z], [LINE_X, -3], [LINE_X, 3], [9, LINE_Z], [-9, LINE_Z], [-LINE_X, 3], [-LINE_X, -3]],
  traffic: [
    // someone looking for a space, round the outside behind the parking bays
    { type: 'car', color: 0xb23a3a, speed: 6, path: [[-64, -40], [64, -40], [64, 40], [-64, 40]] },
    { type: 'car', color: 0x3a6ea5, speed: 5, offset: 200, path: [[-64, -40], [64, -40], [64, 40], [-64, 40]] },
    // the delivery van takes the aisles, the other way round
    { type: 'van', color: 0xe8e4d8, speed: 4.5, offset: 40, path: [[-58, 27.5], [-58, -27.5], [58, -27.5], [58, 27.5]] },
    { type: 'walker', color: 0x3f8f5f, speed: 1.2, carry: true, path: SHOPPERS },
    { type: 'walker', color: 0xe3c04a, speed: 1.1, offset: 60, path: SHOPPERS },
    // and the main road outside
    { type: 'car', color: 0x2e7d4f, speed: 13, path: MAIN_ROAD },
    { type: 'van', color: 0xd9a23a, speed: 11, offset: 300, path: MAIN_ROAD },
    { type: 'car', color: 0x404850, speed: 14, offset: 520, path: MAIN_ROAD },
    { type: 'car', color: 0xc8c8c8, speed: 12, offset: 760, path: MAIN_ROAD },
    { type: 'car', color: 0x8a2c5a, speed: 13, offset: 900, path: MAIN_ROAD },
  ],
};
