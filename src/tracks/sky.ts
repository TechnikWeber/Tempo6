import { L } from '../i18n';
import type { BoxDef, DecorDef, Gate, MoverDef, PickupDef, SpinnerDef, TrackDef } from '../sim/Track';

// The sky path: planks, a wobbling bridge, a seesaw and a turntable, high up in the air.
// Start to finish against the clock; whoever falls off starts again at the start, and the
// clock runs on. The planks get narrower as it goes.
const Y = 60;
const T = 0.15;
const WOOD = 0xc9a15a;
const PLATFORM = 0xe8eef5;
const EDGE = 0xf2c230;

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

/** A plank from one point to another, top at the path's height. */
function plank(from: [number, number], to: [number, number], width: number): void {
  const dx = to[0] - from[0], dz = to[1] - from[1];
  const len = Math.hypot(dx, dz);
  const yaw = Math.atan2(dx, dz);
  statics.push({
    pos: [(from[0] + to[0]) / 2, Y - T, (from[1] + to[1]) / 2],
    half: [width / 2, T, len / 2],
    quat: [0, Math.sin(yaw / 2), 0, Math.cos(yaw / 2)],
    color: WOOD,
  });
}

/** A checkpoint across the way at a point, its gate square around it. */
function checkpoint(x: number, z: number, half = 2.5): void {
  gates.push({ x, z, hx: half, hz: half });
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

// The last stretch, a metre wide, to the finish.
plank([10, 115.8], [10, 131], 1.0);
platform(10, 135, 4);
checkpoint(10, 135, 3.5);
line.push([10, 135]);

// screws along the way, for the brave
for (const [x, z] of [[0, 10], [5, 32], [10, 49.5], [10, 78.7], [3, 92.6], [-4, 106.5], [3, 113.5], [10, 123]] as const) {
  pickups.push({ type: 'screw', pos: [x, Y + 0.5, z] });
}

// The finish arch, and a sign at the start.
decor.push(
  { type: 'box', pos: [6.5, Y + 1.6, 135], half: [0.15, 1.6, 0.15], color: 0xd23b3b },
  { type: 'box', pos: [13.5, Y + 1.6, 135], half: [0.15, 1.6, 0.15], color: 0xd23b3b },
  { type: 'box', pos: [10, Y + 3.35, 135], half: [3.65, 0.15, 0.2], color: 0xf2f2f2 },
  { type: 'finish', pos: [10, Y + 0.012, 135], half: [0.6, 0, 3.4], yaw: Math.PI / 2 },
  { type: 'label', pos: [0, Y + 0.014, -7.5], half: [0.6, 0, 2.6], yaw: Math.PI, text: L('HIMMELSPFAD', 'SKY PATH') },
);

export const SKY: TrackDef = {
  id: 'sky',
  name: L('Himmelspfad', 'Sky Path'),
  blurb: L(
    'Planken, Wackelbrücke, Wippe und Drehscheibe hoch über den Wolken. Wer runterfällt, fängt vorne wieder an, die Uhr läuft weiter.',
    'Planks, a wobble bridge, a seesaw and a turntable high above the clouds. Fall off and you start again at the start, the clock running on.',
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
