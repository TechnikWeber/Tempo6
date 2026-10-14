import type { BoxDef, DecorDef, TrackDef } from '../sim/Track';
import { road, terrainFor } from './road';

const GRASS = 0x55903f;
const CONCRETE = 0x9a9a94;

// Rough layout only: a long, flowing lap in the spirit of the old mountain circuits, bend
// after bend and one long straight to finish. The shape is our own, not a copy of a real one.
const LOT_X = 190;
const LOT_Z = 125;
const WIDTH = 7;

// x, z and height: flat along the start, up over two ridges and down again
const ROAD = road([
  [-60, -100, 0], [40, -100, 0], [120, -98, 0.5],
  [160, -78, 2], [158, -45, 5],
  [128, -28, 8], [124, 2, 9], [152, 22, 7],
  [166, 52, 4], [142, 84, 3],
  [100, 98, 5], [62, 82, 9], [48, 52, 12],
  [20, 36, 11], [-8, 56, 7], [-18, 86, 4],
  [-50, 104, 3], [-90, 94, 5], [-106, 62, 8],
  [-132, 42, 10], [-162, 46, 9], [-172, 12, 6],
  [-150, -20, 4], [-120, -30, 3], [-126, -62, 1.5], [-108, -92, 0.3],
], WIDTH, 12);
const TERRAIN = terrainFor(ROAD, [LOT_X, LOT_Z], GRASS);

// (no floor: the terrain is the ground; the fence is tall enough for the highest ridge)
const statics: BoxDef[] = [
  { pos: [0, 6, LOT_Z], half: [LOT_X, 8, 0.3], color: CONCRETE },
  { pos: [0, 6, -LOT_Z], half: [LOT_X, 8, 0.3], color: CONCRETE },
  { pos: [LOT_X, 6, 0], half: [0.3, 8, LOT_Z], color: CONCRETE },
  { pos: [-LOT_X, 6, 0], half: [0.3, 8, LOT_Z], color: CONCRETE },
];

const decor: DecorDef[] = [...ROAD.decor];
// a few trees inside the bends, so there is something to steer by
for (const [x, z] of [[140, -60], [140, 0], [150, 55], [70, 60], [10, 62], [-70, 78], [-140, 20], [-140, -45], [-20, -40], [60, -30], [0, 0], [-60, -10]]) {
  decor.push({ type: 'tree', pos: [x, 0, z] });
}

export const SCHLEIFE: TrackDef = {
  id: 'schleife',
  name: 'Große Schleife',
  blurb: `Lang, flüssig, bergauf und bergab: ${Math.round(ROAD.length / 10) * 10} m pro Runde, ${Math.round(Math.max(...ROAD.heights))} m Höhenunterschied. Rohbau.`,
  unlockPrice: 275,
  lapPay: 80,
  spawn: ROAD.spawn,
  statics,
  props: [],
  gates: ROAD.gates,
  pickups: [],
  decor,
  line: ROAD.line,
  terrain: TERRAIN,
};
