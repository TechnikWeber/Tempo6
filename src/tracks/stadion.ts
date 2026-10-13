import type { BoxDef, DecorDef, TrackDef } from '../sim/Track';
import { road } from './road';

const GRASS = 0x5c9447;
const CONCRETE = 0x9a9a94;

// Rough layout only: fast arcs out through the woods, a hairpin at the far end, and a tight,
// twisty section in front of the grandstands. The shape is our own, not a copy of a real one.
const LOT_X = 165;
const LOT_Z = 110;
const WIDTH = 7;

const ROAD = road([
  [-40, -72], [20, -72], [56, -62], [72, -36],
  [86, 0], [114, 36], [130, 62],
  [122, 82], [100, 80],
  [80, 52], [40, 32], [-10, 26], [-60, 36],
  [-96, 26], [-106, 0], [-90, -20],
  [-70, -26], [-60, -46], [-76, -60], [-70, -72],
], WIDTH, 10);

const statics: BoxDef[] = [
  { pos: [0, -0.5, 0], half: [LOT_X, 0.5, LOT_Z], color: GRASS },
  { pos: [0, 0.5, LOT_Z], half: [LOT_X, 0.5, 0.3], color: CONCRETE },
  { pos: [0, 0.5, -LOT_Z], half: [LOT_X, 0.5, 0.3], color: CONCRETE },
  { pos: [LOT_X, 0.5, 0], half: [0.3, 0.5, LOT_Z], color: CONCRETE },
  { pos: [-LOT_X, 0.5, 0], half: [0.3, 0.5, LOT_Z], color: CONCRETE },
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
  unlockPrice: 0,
  spawn: ROAD.spawn,
  statics,
  props: [],
  gates: ROAD.gates,
  pickups: [],
  decor,
  line: ROAD.line,
};
