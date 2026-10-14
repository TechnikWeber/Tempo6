import type { BoxDef, DecorDef, TrackDef } from '../sim/Track';
import { road, terrainFor } from './road';
import { floodlight, forest, stand } from './scenery';

const GRASS = 0x5c9447;
const CONCRETE = 0x9a9a94;

// Rough layout only: fast arcs out through the woods, a hairpin at the far end, and a tight,
// twisty section in front of the grandstands. The shape is our own, not a copy of a real one.
const LOT_X = 165;
const LOT_Z = 110;
const WIDTH = 7;

// x, z and height: the stadium is level, the woods rise gently to the hairpin
const ROAD = road([
  [-40, -72, 0], [20, -72, 0], [56, -62, 0], [72, -36, 0.5],
  [86, 0, 1.5], [114, 36, 3], [130, 62, 4],
  [122, 82, 4], [100, 80, 3.5],
  [80, 52, 2.5], [40, 32, 1.5], [-10, 26, 1], [-60, 36, 1.5],
  [-96, 26, 1], [-106, 0, 0.5], [-90, -20, 0],
  [-70, -26, 0], [-60, -46, 0], [-76, -60, 0], [-70, -72, 0],
], WIDTH, 10);
const TERRAIN = terrainFor(ROAD, [LOT_X, LOT_Z], GRASS);

// (no floor: the terrain is the ground)
const statics: BoxDef[] = [
  { pos: [0, 2, LOT_Z], half: [LOT_X, 4, 0.3], color: CONCRETE },
  { pos: [0, 2, -LOT_Z], half: [LOT_X, 4, 0.3], color: CONCRETE },
  { pos: [LOT_X, 2, 0], half: [0.3, 4, LOT_Z], color: CONCRETE },
  { pos: [-LOT_X, 2, 0], half: [0.3, 4, LOT_Z], color: CONCRETE },
  // barriers in front of the grandstands along the start straight and behind the twisty bit
  { pos: [-10, 0.6, -79.4], half: [40, 0.6, 0.2], color: 0xd8dde2 },
  { pos: [-115.6, 0.6, -20], half: [0.2, 0.6, 30], color: 0xd8dde2 },
];

const decor: DecorDef[] = [
  ...ROAD.decor,
  // the stands, people and all, behind the barriers
  ...stand(-10, -81, 0, 78, 7, 21),
  ...stand(-118, -20, Math.PI / 2, 58, 6, 22),
  ...floodlight(-55, -90, 0),
  ...floodlight(35, -90, 0),
  ...floodlight(-128, -55, Math.PI / 2),
  ...floodlight(-128, 15, Math.PI / 2),
  // the woods the fast arcs run through, kept clear of the road
  ...forest({ x: [-108, 155], z: [-50, 102], count: 140, seed: 7, avoid: [ROAD.line], clear: 9 }),
  ...forest({ x: [-158, -130], z: [14, 102], count: 18, seed: 8, avoid: [ROAD.line], clear: 9 }),
];
// The car park east of the stands, half full.
for (let row = 0; row < 3; row++) {
  for (let k = 0; k < 9; k++) {
    if ((row * 9 + k) % 3 === 1) continue;
    const x = 64 + k * 3, z = -98 + row * 7;
    decor.push(
      { type: 'box', pos: [x, 0.55, z], half: [0.9, 0.45, 2.1], color: [0x2f6db5, 0xd23b3b, 0xc8c8c8, 0x404850, 0x2e7d4f][(row + k) % 5] },
      { type: 'box', pos: [x, 1.25, z - 0.2], half: [0.8, 0.25, 1.1], color: 0x9fc4d8 },
    );
  }
}

export const STADION: TrackDef = {
  id: 'stadion',
  name: 'Stadionkurs',
  blurb: `Schnelle Bögen durch den Wald, Haarnadel, enges Geschlängel vor der Tribüne: ${Math.round(ROAD.length / 10) * 10} m. Rohbau.`,
  unlockPrice: 225,
  lapPay: 50,
  spawn: ROAD.spawn,
  statics,
  props: [],
  gates: ROAD.gates,
  pickups: [],
  decor,
  line: ROAD.line,
  terrain: TERRAIN,
};
