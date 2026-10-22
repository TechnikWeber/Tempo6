import { L } from '../i18n';
import type { BoxDef, DecorDef, Gate, MoverDef, PickupDef, SpinnerDef, TrackDef } from '../sim/Track';

// The sky path: planks, a wobbling bridge, a seesaw, a turntable, a turning drum, sliding
// planks and a jump, high up in the air.
// Start to finish against the clock; whoever falls off starts again at the start, and the
// clock runs on. The planks get narrower as it goes.
const Y = 60;
const T = 0.15;
const WOOD = 0xc9a15a;
const PLATFORM = 0xe8eef5;
const EDGE = 0xf2c230;
/** How far a plank's top sits under a platform's. */
const PLANK_DROP = 0.01;

const statics: BoxDef[] = [];
const decor: DecorDef[] = [];
const gates: Gate[] = [];
const line: [number, number][] = [];
const pickups: PickupDef[] = [];

/** A square platform with its top at the path's height, a yellow rim round its edge. */
function platform(x: number, z: number, half: number): void {
  statics.push({ pos: [x, Y - 0.4, z], half: [half, 0.4, half], color: PLATFORM });
  for (const s of [-1, 1]) {
    decor.push(
      { type: 'box', pos: [x + s * (half - 0.08), Y + 0.006, z], half: [0.08, 0.006, half], color: EDGE },
      { type: 'box', pos: [x, Y + 0.006, z + s * (half - 0.08)], half: [half - 0.16, 0.006, 0.08], color: EDGE },
    );
  }
}

/**
 * A plank from one point to another, its top a centimetre under the path's height: where its
 * ends reach onto a platform the platform's top covers them, instead of the two sharing a plane
 * and flickering. (A wheel does not notice a centimetre.)
 */
function plank(from: [number, number], to: [number, number], width: number): void {
  const dx = to[0] - from[0], dz = to[1] - from[1];
  const len = Math.hypot(dx, dz);
  const yaw = Math.atan2(dx, dz);
  statics.push({
    pos: [(from[0] + to[0]) / 2, Y - T - PLANK_DROP, (from[1] + to[1]) / 2],
    half: [width / 2, T, len / 2],
    quat: [0, Math.sin(yaw / 2), 0, Math.cos(yaw / 2)],
    color: WOOD,
  });
}

/** A checkpoint across the way at a point, its gate square around it. */
function checkpoint(x: number, z: number, half = 2.5): void {
  gates.push({ x, z, hx: half, hz: half, y: Y });
}

// Start: a big platform, then a wide plank to get the feel.
platform(0, -5, 4);
checkpoint(0, -1.5, 3.5);
line.push([0, -5], [0, 22]);
plank([0, -1], [0, 19.5], 2.0);
platform(0, 22.5, 3);
checkpoint(0, 22.5);

// A narrower plank off to the right.
plank([1.6, 25.2], [8.4, 38.6], 1.5);
platform(10, 41.5, 3);
checkpoint(10, 41.5);
line.push([10, 41.5]);

// The wobbling bridge: it rolls from side to side on its own.
const movers: MoverDef[] = [{ type: 'rocker', pos: [10, Y, 49.5], yaw: 0, half: [0.9, 0.08, 5], angle: 0.13, period: 3.2, color: 0x6aa0c8 }];
platform(10, 57.5, 3);
checkpoint(10, 57.5);
line.push([10, 57.5]);

// The seesaw: it lies tipped back to the way in, and goes over once the vehicle is past the middle.
const SAW = 4.5, TILT = 0.16;
movers.push({ type: 'seesaw', pos: [10, Y + SAW * Math.sin(TILT) + 0.02, 60.5 + SAW], yaw: 0, half: [1.0, 0.08, SAW], angle: TILT, color: 0xc86a4a });
platform(10, 72.5, 3);
checkpoint(10, 72.5);
line.push([10, 72.5]);

// A turntable to get across without being spun off.
const spinners: SpinnerDef[] = [{ pos: [10, Y, 78.7], radius: 3.2, speed: 0.7, color: 0x8c949c }];
platform(10, 85, 3);
checkpoint(10, 85);
line.push([10, 78.7], [10, 85], [8, 87.6], [-2, 97.6]);

// Narrow planks to the left, then a zigzag.
plank([8, 87.6], [-2, 97.6], 1.2);
platform(-4, 99.5, 2.5);
checkpoint(-4, 99.5, 2.2);
line.push([-4, 99.5]);
plank([-4, 101.8], [-4, 111.2], 1.2);
platform(-4, 113.5, 2.5);
plank([-1.7, 113.5], [7.7, 113.5], 1.1);
platform(10, 113.5, 2.5);
checkpoint(10, 113.5, 2.2);
line.push([-4, 113.5], [10, 113.5]);

// A metre wide now, to the big drum.
plank([10, 115.8], [10, 124], 1.0);
platform(10, 127, 3);
checkpoint(10, 127);
line.push([10, 127]);

// The big drum: a striped tube turning about its axle along the way. Its floor carries the
// vehicle up the side, so it is driven through slanting against the turn.
const DRUM = 3.5, DRUM_HALF = 8, DRUM_Z = 130.15 + DRUM_HALF;
movers.push({ type: 'drum', pos: [10, Y + DRUM, DRUM_Z], yaw: 0, half: [0, 0.1, DRUM_HALF], radius: DRUM, blades: 36, spin: 0.7, angle: 0, color: 0xd23b3b });
platform(10, 149.3, 3);
checkpoint(10, 149.3);
line.push([10, 149.3]);

// Two planks sliding from side to side across the gap, nearly but not quite together; the
// way off them is only straight ahead when the second one is back in the middle.
const SLIDE = { half: [1.7, 0.1, 1.6] as [number, number, number], travel: 1.8, period: 6, angle: 0, yaw: 0 };
movers.push(
  { type: 'slider', pos: [10, Y, 153.95], ...SLIDE, phase: 0, color: 0x4a9a6a },
  { type: 'slider', pos: [10, Y, 157.25], ...SLIDE, phase: -0.7, color: 0x3f8a8c },
);
platform(10, 161.95, 3);
checkpoint(10, 161.95);
line.push([10, 161.95]);

// Straight on, a ramp and a jump over the gap onto the finish.
plank([10, 165], [10, 171], 1.6);
const KICK = Math.atan2(0.3, 1.6);
statics.push({
  pos: [10, Y + 0.15 - T * Math.cos(KICK), 171.8 + T * Math.sin(KICK)],
  half: [0.8, T, 0.8 / Math.cos(KICK)],
  quat: [-Math.sin(KICK / 2), 0, 0, Math.cos(KICK / 2)],
  color: EDGE,
});
const LAND = 179;
statics.push({ pos: [10, Y - 0.4, LAND], half: [4.5, 0.4, 5.1], color: PLATFORM });
for (const s of [-1, 1]) {
  decor.push(
    { type: 'box', pos: [10 + s * 4.42, Y + 0.006, LAND], half: [0.08, 0.006, 5.1], color: EDGE },
    { type: 'box', pos: [10, Y + 0.006, LAND + s * 5.02], half: [4.34, 0.006, 0.08], color: EDGE },
  );
}
checkpoint(10, LAND + 1, 4);
line.push([10, LAND + 1]);

// screws along the way, for the brave
for (const [x, z] of [[0, 10], [5, 32], [10, 49.5], [10, 78.7], [3, 92.6], [-4, 106.5], [3, 113.5], [10, 120], [10, 134], [10, 142], [10, 155.6], [10, 173.2]] as const) {
  pickups.push({ type: 'screw', pos: [x, Y + 0.5, z] });
}

// Somebody waving them in at the finish, and a marshal with the clock.
decor.push(
  { type: 'person', pos: [13.6, Y, LAND + 3.5], yaw: -2.6, color: 0xd23b3b, pose: 'wave' },
  { type: 'person', pos: [6.4, Y, LAND + 3], yaw: 2.4, color: 0xf2f2f2, pose: 'point' },
  { type: 'person', pos: [3, Y, -7.2], yaw: 0.6, color: 0x4a7ab5, pose: 'wave' },
);

// The finish arch, and a sign at the start.
decor.push(
  { type: 'box', pos: [5.5, Y + 1.6, LAND + 1], half: [0.15, 1.6, 0.15], color: 0xd23b3b },
  { type: 'box', pos: [14.5, Y + 1.6, LAND + 1], half: [0.15, 1.6, 0.15], color: 0xd23b3b },
  { type: 'box', pos: [10, Y + 3.35, LAND + 1], half: [4.65, 0.15, 0.2], color: 0xf2f2f2 },
  { type: 'finish', pos: [10, Y + 0.012, LAND + 1], half: [0.6, 0, 4.3], yaw: Math.PI / 2 },
  { type: 'label', pos: [0, Y + 0.014, -7.5], half: [0.6, 0, 2.6], yaw: Math.PI, text: L('HIMMELSPFAD', 'SKY PATH') },
);

// Pennants on the corners of the start and the finish, blowing in the wind up here.
for (const [x, z, half] of [[0, -5, 4], [10, LAND, 4.5]] as const) {
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    const px = x + sx * (half - 0.25), pz = z + sz * (half - 0.25);
    decor.push({ type: 'box', pos: [px, Y + 1.5, pz], half: [0.05, 1.5, 0.05], color: 0xd8dde2 }, { type: 'box', pos: [px + sx * 0.5, Y + 2.7, pz], half: [0.45, 0.3, 0.02], color: sz > 0 ? 0xd23b3b : 0xf2c230 });
  }
}

// Islands floating about the path: grass on top, earth and rock tapering away underneath,
// trees, a few sheep, on one a hut and a waterfall pouring off its edge into nothing.
function island(x: number, y: number, z: number, r: number, seed: number, extras: { hut?: boolean; fall?: boolean; sheep?: number } = {}): void {
  const yaw = seed * 0.7;
  decor.push({ type: 'box', pos: [x, y - 0.4, z], half: [r, 0.4, r * 0.8], yaw, color: 0x5c9447 });
  for (let k = 1; k <= 4; k++) {
    const s = 1 - k * 0.2;
    decor.push({ type: 'box', pos: [x, y - 0.8 - (k - 0.5) * 1.3, z], half: [r * s, 0.65, r * 0.8 * s], yaw: yaw + k * 0.35, color: k % 2 ? 0x7a5a3a : 0x6b6258 });
  }
  const c = Math.cos(yaw), s = Math.sin(yaw);
  /** A spot on top, in the island's own frame. */
  const on = (lx: number, lz: number): [number, number] => [x + lx * c + lz * s, z - lx * s + lz * c];
  for (const [lx, lz] of [[-0.5, -0.4], [0.45, 0.3], [-0.1, 0.5], [0.55, -0.45]].slice(0, Math.max(1, Math.round(r / 4)))) {
    const [tx, tz] = on(lx * r, lz * r * 0.8);
    decor.push({ type: 'tree', pos: [tx, y, tz] });
  }
  for (let k = 0; k < (extras.sheep ?? 0); k++) {
    const [sx, sz] = on((k - 1) * 1.6, -0.15 * r);
    decor.push(
      { type: 'box', pos: [sx, y + 0.55, sz], half: [0.35, 0.28, 0.5], yaw: yaw + k, color: 0xf4f4f4 },
      { type: 'box', pos: [sx + Math.sin(yaw + k) * 0.6, y + 0.7, sz + Math.cos(yaw + k) * 0.6], half: [0.15, 0.17, 0.15], yaw: yaw + k, color: 0x1d1d1f },
    );
  }
  if (extras.hut) {
    const [hx, hz] = on(0.15 * r, 0.1 * r);
    decor.push(
      { type: 'box', pos: [hx, y + 1.2, hz], half: [1.6, 1.2, 1.3], yaw, color: 0xd9c7a8 },
      { type: 'box', pos: [hx, y + 2.65, hz], half: [1.9, 0.25, 1.6], yaw, color: 0x8a3b2e },
    );
  }
  if (extras.fall) {
    const [fx, fz] = on(r - 0.3, 0);
    // (its top just under the grass, not level with it)
    decor.push({ type: 'box', pos: [fx, y - 14.05, fz], half: [0.1, 14, 0.9], yaw, color: 0x8fc7e8 });
  }
}
island(-35, Y - 8, 20, 9, 1, { sheep: 3 });
island(45, Y + 6, 60, 12, 2, { hut: true, fall: true });
island(-40, Y + 12, 110, 10, 3, { sheep: 2 });
island(50, Y - 14, 140, 8, 4);
island(-28, Y - 20, 172, 14, 5, { hut: true, sheep: 4 });
island(35, Y + 18, 5, 7, 6);
island(62, Y - 5, 205, 10, 7, { fall: true });
island(-50, Y + 2, 235, 9, 8, { sheep: 2 });

// A rainbow of blocks arching over the far side of the finish. (Every band a hair deeper
// than the one inside it, so where their blocks overlap no two faces share a plane.)
{
  const RX = 10, RY = Y - 22, RZ = 245;
  [0xe23b3b, 0xf08a2a, 0xf2d43a, 0x4caf50, 0x2f8fd8, 0x3f51b5, 0x8e44ad].forEach((color, i) => {
    const r = 42 - i * 1.5, b = 0.75 + i * 0.012;
    const steps = Math.ceil((Math.PI * r) / 1.4);
    for (let k = 0; k <= steps; k++) {
      const a = (k / steps) * Math.PI;
      decor.push({ type: 'box', pos: [RX + Math.cos(a) * r, RY + i * 0.031 + Math.sin(a) * r, RZ], half: [b, b, b + i * 0.02], color });
    }
  });
}

// Balloons drifting at the path's own height, and an airship going by.
decor.push(
  { type: 'balloon', pos: [-22, Y - 6, 45], color: 0xd23b3b },
  { type: 'balloon', pos: [34, Y - 2, 95], color: 0x2f6db5 },
  { type: 'balloon', pos: [-20, Y + 4, 150], color: 0x3f8f5f },
  { type: 'balloon', pos: [30, Y - 10, 180], color: 0xe3c04a },
  { type: 'zeppelin', pos: [-120, Y + 8, 90], half: [120, 0, 0], yaw: 0, color: 0xd8d4c8 },
);

// The highlight: a whale of blocks swimming through the sky beside the path, blowing.
{
  const WX = -65, WY = Y + 6, WZ = 62, BODY = 0x4a6a8a;
  decor.push(
    { type: 'box', pos: [WX, WY, WZ], half: [4, 3.5, 8], color: BODY },
    { type: 'box', pos: [WX, WY - 0.2, WZ + 10.3], half: [3.6, 3.0, 2.5], color: BODY }, // head
    { type: 'box', pos: [WX, WY - 2.8, WZ + 1], half: [3.2, 1, 9.5], color: 0xe8eef5 }, // belly
    { type: 'box', pos: [WX, WY + 0.3, WZ - 10.4], half: [3, 2.5, 2.6], color: BODY },
    { type: 'box', pos: [WX, WY + 0.6, WZ - 14.8], half: [2, 1.8, 2.0], color: BODY },
    { type: 'box', pos: [WX, WY + 0.8, WZ - 18.0], half: [5, 0.4, 1.4], color: BODY }, // the flukes
    { type: 'box', pos: [WX, WY + 6.8, WZ + 4], half: [0.3, 3.3, 0.3], color: 0x8fc7e8 }, // the spout
    { type: 'smoke', pos: [WX, WY + 10, WZ + 4] },
  );
  for (const s of [-1, 1]) {
    decor.push(
      { type: 'box', pos: [WX + s * 5.4, WY - 1.5, WZ + 3], half: [1.5, 0.3, 1.4], color: BODY }, // fins
      { type: 'box', pos: [WX + s * 3.62, WY + 0.6, WZ + 11.2], half: [0.05, 0.35, 0.35], color: 0x1d1d1f }, // eyes
    );
  }
}

export const SKY: TrackDef = {
  id: 'sky',
  name: L('Himmelspfad', 'Sky Path'),
  blurb: L(
    'Planken, Wackelbrücke, Wippe, Drehscheibe, eine große drehende Rolle, Schiebeplanken und ein Sprung ins Ziel, hoch über den Wolken. Wer runterfällt, fängt vorne wieder an, die Uhr läuft weiter.',
    'Planks, a wobble bridge, a seesaw, a turntable, a big turning drum, sliding planks and a jump to the finish, high above the clouds. Fall off and you start again at the start, the clock running on.',
  ),
  unlockPrice: 150,
  lapPay: 60,
  spawn: { pos: [0, Y + 0.6, -6], yaw: 0 },
  statics,
  props: [],
  gates,
  pickups,
  decor,
  spinners,
  movers,
  line,
  course: true,
  fallY: Y - 12,
  sky: true,
};
