import { ramp, type BoxDef, type DecorDef, type PickupDef, type PropDef, type TrackDef } from '../sim/Track';

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
  { type: 'box', pos: [-10, 3.5, -LINE_Z - 0.15], half: [0.12, 0.4, WIDTH / 2 + 0.6], color: 0xf2f2f2 },
  { type: 'sign', pos: [0, 6, LOT_Z + 10], half: [60, 6, 8], color: 0xd8d4c8, text: 'FLUGPLATZ' },
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

export const FLUGPLATZ: TrackDef = {
  id: 'flugplatz',
  name: 'Alter Flugplatz',
  blurb: 'Über 500 m pro Runde, breite Bahn, große Schanzen. Erst mit Tuning ein Vergnügen.',
  unlockPrice: 180,
  lapPay: 40,
  spawn: { pos: [-20, 0.6, -LINE_Z], yaw: Math.PI / 2 },
  statics,
  props,
  gates: [
    { x: -10, z: -LINE_Z, hx: 2, hz: WIDTH / 2 },
    { x: LINE_X, z: 0, hx: WIDTH / 2, hz: 2 },
    { x: 0, z: LINE_Z, hx: 2, hz: WIDTH / 2 },
    { x: -LINE_X, z: 0, hx: WIDTH / 2, hz: 2 },
  ],
  pickups,
  decor,
  traffic: [
    // follow-me car on the perimeter road, and a van that got lost on the apron
    { type: 'car', color: 0xf2c230, speed: 11, path: [[-200, -50], [200, -50], [200, 50], [-200, 50]] },
    { type: 'car', color: 0x4a8f5a, speed: 9, offset: 500, path: [[-200, -50], [200, -50], [200, 50], [-200, 50]] },
    { type: 'van', color: 0xd9dde2, speed: 6, path: [[-190, -60], [-190, -80], [-30, -80], [-30, -60]] },
  ],
};
