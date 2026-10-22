import { L } from '../i18n';
import { heightAt, type BoxDef, type DecorDef, type PropDef, type TrackDef } from '../sim/Track';
import { rimHills, road, terrainFor } from './road';
import { distanceTo, floodlight, forest, stand } from './scenery';
import { person } from './works';

const GRASS = 0x5c9447;

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
// No boundary wall: the lot's outer rim rises into hills instead, tall enough that nothing
// is seen over or past them. Eased in over the last 10 m, so the stands and car park (both
// well inside that) stand on the flat ground the road itself was given.
const TERRAIN = rimHills(terrainFor(ROAD, [LOT_X, LOT_Z], GRASS), 10, 15);

/** Where the fans camp, in a clearing in the woods. */
const CAMP: [number, number] = [-146, 62];

// (no floor: the terrain is the ground)
const statics: BoxDef[] = [
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
  // (leaving a clearing for the fans' campsite, see below)
  ...forest({ x: [-158, -130], z: [14, 102], count: 18, seed: 8, avoid: [ROAD.line, [[CAMP[0] - 1, CAMP[1] - 1], [CAMP[0] + 1, CAMP[1] - 1], [CAMP[0] + 1, CAMP[1] + 1], [CAMP[0] - 1, CAMP[1] + 1]]], clear: 10 }),
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

// Marshals in orange at a few bends, well off the road, and a photographer.
{
  const line = ROAD.line, n = line.length;
  const cx = line.reduce((t, p) => t + p[0], 0) / n, cz = line.reduce((t, p) => t + p[1], 0) / n;
  [0.12, 0.3, 0.47, 0.63, 0.8, 0.92].forEach((share, k) => {
    const i = Math.floor(share * n);
    const [x, z] = line[i], [nx, nz] = line[(i + 1) % n];
    const len = Math.hypot(nx - x, nz - z) || 1;
    let ox = (nz - z) / len, oz = -(nx - x) / len;
    if ((x - cx) * ox + (z - cz) * oz < 0) [ox, oz] = [-ox, -oz];
    const px = x + ox * 7, pz = z + oz * 7;
    if (distanceTo(line, px, pz) < 6) return;
    decor.push(person(px, pz, Math.atan2(x - px, z - pz), 0xff7a1a, k % 3 === 1 ? 'wave' : 'stand', true));
    if (k === 2) decor.push(person(px + ox * 1.5 + oz, pz + oz * 1.5 - ox, Math.atan2(x - px, z - pz) + 0.5, 0x2a2a2e, 'point'));
  });
}

// ---------------------------------------------------------------------------------------
// Race day: the pits along the start straight with the rides lined up in front of their
// garages, a gantry with the start lights, the grid, a podium, sponsors' boards along the
// barrier, kerbs on the inside of the tight bends, a big screen behind the stand and the
// fans camping in the woods.
const line = ROAD.line, n = line.length;
const heading = (i: number) => {
  const a = line[(i + n - 1) % n], b = line[(i + 1) % n];
  return Math.atan2(b[0] - a[0], b[1] - a[1]);
};
const props: PropDef[] = [];
const SHIRTS = [0x4a7ab5, 0xf2f2f2, 0xd23b3b, 0x3f8f5f, 0x7b2d8e, 0xe3c04a, 0x2a2a2e, 0xe8833a];

// The pit building north of the start straight, its garages open, a pit wall before the road.
{
  const PZ = -56;
  statics.push({ pos: [-10, 2.5, PZ], half: [25, 2.5, 4], color: 0xd8dde2 }, { pos: [-10, 0.5, -66.4], half: [25, 0.5, 0.2], color: 0xd8dde2 });
  decor.push({ type: 'box', pos: [-10, 5.15, PZ - 0.6], half: [25.6, 0.15, 5], color: 0x3a3c40 }); // the roof, reaching out over the apron
  ['trex', 'avanti', 'orkan', 'arrivo', 'eskalation', 'enix', 'sprite', 'komet'].forEach((id, k) => {
    const x = -31 + k * 6;
    decor.push(
      { type: 'box', pos: [x, 1.8, PZ - 4.03], half: [2.3, 1.8, 0.03], color: 0x2a2c30 }, // the open garage, dark inside
      { type: 'box', pos: [x, 3.9, PZ - 4.05], half: [2.3, 0.25, 0.05], color: SHIRTS[k % SHIRTS.length] }, // the team's colour over it
      { type: 'wreck', vehicle: id, pos: [x, 0, PZ - 6.5], yaw: Math.PI },
      person(x + 1.6, PZ - 6, Math.PI + 0.6, SHIRTS[k % SHIRTS.length], k % 2 ? 'point' : 'stand', true),
    );
  });
  // the pit wall's red and white stripes
  for (let k = 0; k < 13; k++) decor.push({ type: 'box', pos: [-34 + k * 4, 0.5, -66.62], half: [1, 0.3, 0.02], color: k % 2 ? 0xd23b3b : 0xf2f2f2 });
}
// The gantry over the start line, five red lights facing the field, and the grid behind it.
{
  const [sx, sz] = line[0];
  statics.push({ pos: [sx, 3.2, sz - 5.6], half: [0.3, 3.2, 0.3], color: 0x5a5f66 }, { pos: [sx, 3.2, sz + 5.6], half: [0.3, 3.2, 0.3], color: 0x5a5f66 });
  decor.push({ type: 'box', pos: [sx, 6.8, sz], half: [0.4, 0.4, 5.9], color: 0x3a3c40 });
  for (let k = -2; k <= 2; k++) decor.push({ type: 'box', pos: [sx - 0.45, 6.8, sz + k * 1.1], half: [0.05, 0.3, 0.3], color: 0xd23b3b });
  for (let k = 0; k < 6; k++) {
    const i = (n - 3 - k * 3) % n;
    const h = heading(i), side = k % 2 ? -1 : 1;
    const [x, z] = line[i];
    decor.push({ type: 'box', pos: [x + side * Math.cos(h) * 1.6, 0.075, z - side * Math.sin(h) * 1.6], half: [1.1, 0.005, 0.1], yaw: h, color: 0xf2f2f2 });
  }
}
// The podium and the timing tower beside the pits.
{
  [[0, 1.2, 0xe3c04a], [-2.2, 0.8, 0xc8c8c8], [2.2, 0.5, 0xb5653a]].forEach(([dx, h, c], k) => {
    statics.push({ pos: [24 + dx, h / 2, -55], half: [1.1, h / 2, 1.1], color: c });
    decor.push(person(24 + dx, -55, Math.PI, SHIRTS[k + 1], 'wave', false, h));
  });
  statics.push({ pos: [34, 6, -55], half: [1.2, 6, 1.2], color: 0x3a3c40 });
  decor.push({ type: 'board', pos: [34, 13.4, -55], half: [3.4, 1.2, 0.15], text: 'TEMPO 6' });
}
// Sponsors' boards along the barrier in front of the stand, the big screen behind it.
['SCHRAUBEN', 'TEMPO 6', L('AKKU', 'BATTERY'), L('LAUBBLÄSER', 'LEAF BLOWER'), L('BAUMARKT', 'DIY STORE'), 'REHA'].forEach((text, k) => {
  decor.push({ type: 'board', pos: [-42 + k * 13, 0.8, -78.9], half: [2.4, 0.4, 0.04], text });
});
decor.push({ type: 'board', pos: [-10, 13, -93], half: [9, 3, 0.25], text: 'TEMPO 6' });
// Kerbs, red and white, on the inside of every tight bend.
for (let i = 0; i < n; i++) {
  let turn = heading((i + 1) % n) - heading((i + n - 1) % n);
  turn = Math.atan2(Math.sin(turn), Math.cos(turn));
  if (Math.abs(turn) < 0.07) continue;
  const h = heading(i), side = -Math.sign(turn), off = WIDTH / 2 + 0.55;
  const [x, z] = line[i];
  decor.push({ type: 'box', pos: [x + side * Math.cos(h) * off, 0.04, z - side * Math.sin(h) * off], half: [0.4, 0.04, 0.74], yaw: h, color: i % 2 ? 0xd23b3b : 0xf2f2f2 });
}
// Tyre walls on the outside of the hairpin, standing on the hillside.
for (let k = 0; k < 9; k++) {
  const a = -0.2 + k * 0.28;
  const x = 112 + Math.cos(a) * 21, z = 76 + Math.sin(a) * 15;
  if (distanceTo(line, x, z) < WIDTH / 2 + 3) continue;
  const g = heightAt(TERRAIN, x, z);
  for (let h = 0; h < 3; h++) props.push({ type: 'tyre', pos: [x, g + 0.115 + h * 0.23, z], yaw: h });
}
// The fans' campsite in its clearing in the north-west woods: tents round a fire, people
// sitting on logs by it.
for (let k = 0; k < 7; k++) {
  const a = (k / 7) * 2 * Math.PI;
  const x = CAMP[0] + Math.cos(a) * 6.5, z = CAMP[1] + Math.sin(a) * 6.5;
  const c = [0xe8833a, 0x2f6db5, 0x3f8f5f, 0xd23b3b, 0xe3c04a][k % 5];
  decor.push({ type: 'box', pos: [x, 0.6, z], half: [1.1, 0.6, 1.4], yaw: a, color: c }, { type: 'box', pos: [x, 1.35, z], half: [0.6, 0.15, 1.42], yaw: a, color: c });
}
decor.push({ type: 'smoke', pos: [CAMP[0], 0.3, CAMP[1]] }, { type: 'box', pos: [CAMP[0], 0.1, CAMP[1]], half: [0.5, 0.1, 0.5], color: 0x5a4636 });
for (let k = 0; k < 5; k++) {
  const a = (k / 5) * 2 * Math.PI + 0.3;
  const x = CAMP[0] + Math.cos(a) * 2.8, z = CAMP[1] + Math.sin(a) * 2.8;
  const facing = Math.atan2(-Math.cos(a), -Math.sin(a));
  decor.push({ type: 'box', pos: [x, 0.21, z], half: [0.5, 0.21, 0.22], yaw: facing + Math.PI / 2, color: 0x6b4a2b });
  decor.push(person(x, z, facing, SHIRTS[k], k === 2 ? 'wave' : 'sit', false, -0.03));
}
// Fans by the start straight east of the stand, and up on the hill at the hairpin.
for (const [x, z, yaw] of [[36, -80, 0], [126, 95, Math.PI + 0.6]] as const) {
  for (let k = 0; k < 5; k++) {
    const px = x + Math.cos(yaw) * k * 1.2, pz = z - Math.sin(yaw) * k * 1.2;
    decor.push(person(px, pz, yaw, SHIRTS[(k + 2) % SHIRTS.length], k % 2 ? 'wave' : 'point'));
  }
}

export const STADION: TrackDef = {
  id: 'stadion',
  name: L('Stadionkurs', 'Stadium Circuit'),
  blurb: L(`Schnelle Bögen durch den Wald, Haarnadel, enges Geschlängel vor der Tribüne: ${Math.round(ROAD.length / 10) * 10} m.`, `Fast arcs through the woods, a hairpin, a tight wiggle in front of the stands: ${Math.round(ROAD.length / 10) * 10} m.`),
  unlockPrice: 225,
  lapPay: 50,
  spawn: ROAD.spawn,
  statics,
  props,
  gates: ROAD.gates,
  pickups: [],
  decor,
  line: ROAD.line,
  roadHalf: WIDTH / 2,
  terrain: TERRAIN,
};
