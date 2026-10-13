import type { BoxDef, DecorDef, TrackDef } from '../sim/Track';
import { road } from './road';

const GRASS = 0x55903f;
const CONCRETE = 0x9a9a94;

// Rough layout only: a long, flowing lap in the spirit of the old mountain circuits, bend
// after bend and one long straight to finish. The shape is our own, not a copy of a real one.
const LOT_X = 190;
const LOT_Z = 125;
const WIDTH = 7;

const ROAD = road([
  [-60, -100], [40, -100], [120, -98],
  [160, -78], [158, -45],
  [128, -28], [124, 2], [152, 22],
  [166, 52], [142, 84],
  [100, 98], [62, 82], [48, 52],
  [20, 36], [-8, 56], [-18, 86],
  [-50, 104], [-90, 94], [-106, 62],
  [-132, 42], [-162, 46], [-172, 12],
  [-150, -20], [-120, -30], [-126, -62], [-108, -92],
], WIDTH, 12);

const statics: BoxDef[] = [
  { pos: [0, -0.5, 0], half: [LOT_X, 0.5, LOT_Z], color: GRASS },
  { pos: [0, 0.5, LOT_Z], half: [LOT_X, 0.5, 0.3], color: CONCRETE },
  { pos: [0, 0.5, -LOT_Z], half: [LOT_X, 0.5, 0.3], color: CONCRETE },
  { pos: [LOT_X, 0.5, 0], half: [0.3, 0.5, LOT_Z], color: CONCRETE },
  { pos: [-LOT_X, 0.5, 0], half: [0.3, 0.5, LOT_Z], color: CONCRETE },
];

const decor: DecorDef[] = [...ROAD.decor];
// a few trees inside the bends, so there is something to steer by
for (const [x, z] of [[140, -60], [140, 0], [150, 55], [70, 60], [10, 62], [-70, 78], [-140, 20], [-140, -45], [-20, -40], [60, -30], [0, 0], [-60, -10]]) {
  decor.push({ type: 'tree', pos: [x, 0, z] });
}

export const SCHLEIFE: TrackDef = {
  id: 'schleife',
  name: 'Große Schleife',
  blurb: `Lang, flüssig, Kurve an Kurve: ${Math.round(ROAD.length / 10) * 10} m pro Runde. Rohbau.`,
  unlockPrice: 0,
  spawn: ROAD.spawn,
  statics,
  props: [],
  gates: ROAD.gates,
  pickups: [],
  decor,
  line: ROAD.line,
};
