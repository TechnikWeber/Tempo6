import type { BoxDef, DecorDef, TrackDef } from '../sim/Track';
import { road, terrainFor } from './road';

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
  // grandstands along the start straight and behind the twisty bit
  { pos: [-10, 2, -84], half: [40, 2, 3], color: 0x8c949c },
  { pos: [-122, 2, -20], half: [3, 2, 30], color: 0x8c949c },
];

const decor: DecorDef[] = [...ROAD.decor];
for (const [x, z] of [[100, 0], [60, 10], [140, 30], [100, 55], [20, 50], [-30, 55], [150, 80], [0, 0], [-40, 0], [30, -30]]) {
  decor.push({ type: 'tree', pos: [x, 0, z] });
}

export const STADION: TrackDef = {
  id: 'stadion',
  name: 'Stadionkurs',
  blurb: `Schnelle Bögen durch den Wald, Haarnadel, enges Geschlängel vor der Tribüne: ${Math.round(ROAD.length / 10) * 10} m. Rohbau.`,
  unlockPrice: 600,
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
