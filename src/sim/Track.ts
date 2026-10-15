/** Static box with collision. `quat` is x, y, z, w. */
export interface BoxDef {
  pos: [number, number, number];
  half: [number, number, number];
  quat?: [number, number, number, number];
  color: number;
  /** Part of roadworks: it may stand on the road, as long as it leaves a lane open. */
  works?: boolean;
}

export type PropType = 'cone' | 'bigcone' | 'carton' | 'cart' | 'barrel' | 'chair' | 'tyre';

/** Loose physics object that can be shoved around. */
export interface PropDef {
  type: PropType;
  pos: [number, number, number];
  yaw?: number;
}

/** Checkpoint as an axis-aligned rectangle on the ground. */
export interface Gate {
  x: number;
  z: number;
  hx: number;
  hz: number;
  /** Counts only exactly as drawn, e.g. through an obstacle that could otherwise be driven round. */
  exact?: boolean;
}

export type PickupType = 'screw' | 'toolbox';

export interface PickupDef {
  type: PickupType;
  pos: [number, number, number];
}

export interface DecorDef {
  /**
   * `board` is an upright panel with `text` on both sides, `label` the same painted flat on
   * the ground, `ring` a painted circle (`half` is radius, 0, half line width), `path` a
   * painted closed band along `points` (`half[0]` is half its width), `slab` a flat lid
   * filling the outline `points` at the height of `pos`, `smoke` puffs rising from `pos`
   * (an engine running, say), `clock` a wall clock telling the real time (`half[0]` its
   * radius), `oval` a flat oval sign in `color` with a white rim (`half` its half width and
   * height), `balloon` a hot-air balloon bobbing in the air, `plane` a small aircraft and
   * `zeppelin` an airship, both flying back and forth at `pos` along `yaw`, `half[0]` metres
   * either way, `wreck` a vehicle model standing idle, `vehicle` saying which one (its id),
   * with nobody in the seat, `person` somebody standing about in `color` (`pose`, `worker`
   * in a hard hat and hi-vis vest); people are solid.
   */
  type: 'box' | 'tree' | 'lamp' | 'finish' | 'sign' | 'board' | 'label' | 'ring' | 'path' | 'slab' | 'smoke' | 'clock' | 'oval' | 'balloon' | 'plane' | 'zeppelin' | 'wreck' | 'person';
  /** `wreck`: which vehicle (a VehicleId, kept as a plain string so this file need not know the type). */
  vehicle?: string;
  pos: [number, number, number];
  half?: [number, number, number];
  color?: number;
  text?: string;
  /** Heading in rad, 0 = facing +Z. */
  yaw?: number;
  /** Corners of a `path` or `slab`, x and z. */
  points?: [number, number][];
  pose?: PersonPose;
  worker?: boolean;
}

/** How a person stands: `sit` is on whatever is under them, 0.45 m up. */
export type PersonPose = 'stand' | 'sit' | 'carry' | 'wave' | 'phone' | 'point' | 'walk';

/** A person's collider: half extents round the middle of the body, by pose. */
export function personHalf(pose: PersonPose = 'stand'): [number, number, number] {
  return pose === 'sit' ? [0.26, 0.6, 0.36] : [0.26, 0.85, 0.22];
}

export type TrafficType = 'car' | 'van' | 'train' | 'forklift' | 'walker';

/** A vehicle that drives round a closed loop on its own. */
export interface TrafficDef {
  type: TrafficType;
  color: number;
  /** Corners of the loop, x and z. It must keep clear of anything fixed: traffic goes through walls. */
  path: [number, number][];
  /** Cruising speed in m/s. */
  speed: number;
  /** Metres along the loop where it starts. */
  offset?: number;
  /** A walker in a hard hat and hi-vis vest. */
  worker?: boolean;
  /** A walker carrying a box along the first leg of its loop (workers do unless told not to). */
  carry?: boolean;
}

/** Hilly ground instead of a flat floor: a grid of heights over the whole lot, centred on the origin. */
export interface TerrainDef {
  /** Half extents in X and Z. */
  half: [number, number];
  /** Number of cells in X and Z. */
  cols: number;
  rows: number;
  /** Heights at the corners of the cells, row by row from -Z to +Z, each row from -X to +X. */
  heights: number[];
  color: number;
}

/** Height of the terrain at a point, between the grid corners. 0 without terrain or outside it. */
export function heightAt(t: TerrainDef | undefined, x: number, z: number): number {
  if (!t) return 0;
  const fx = Math.min(t.cols, Math.max(0, ((x + t.half[0]) / (2 * t.half[0])) * t.cols));
  const fz = Math.min(t.rows, Math.max(0, ((z + t.half[1]) / (2 * t.half[1])) * t.rows));
  const ix = Math.min(t.cols - 1, Math.floor(fx)), iz = Math.min(t.rows - 1, Math.floor(fz));
  const u = fx - ix, v = fz - iz;
  const at = (i: number, k: number) => t.heights[k * (t.cols + 1) + i];
  return (at(ix, iz) * (1 - u) + at(ix + 1, iz) * u) * (1 - v) + (at(ix, iz + 1) * (1 - u) + at(ix + 1, iz + 1) * u) * v;
}

/** A flat disc that turns on the spot and takes along whatever stands on it. */
export interface SpinnerDef {
  /** Centre of its top surface. */
  pos: [number, number, number];
  radius: number;
  /** Turning rate in rad/s; positive is anticlockwise seen from above. */
  speed: number;
  color: number;
}

/**
 * Something that moves. A `seesaw` tips about its middle towards whichever end the vehicle
 * is on; a `rocker` rolls slowly from side to side by itself, for balancing across; a
 * `propeller` spins its blades across the way, about an axle pointing along it. A `drum` is a
 * big tube turning about its axle along the way, to be driven through on its inside; a
 * `slider` is a plank sliding from side to side across the way by itself.
 */
export interface MoverDef {
  type: 'seesaw' | 'rocker' | 'propeller' | 'drum' | 'slider';
  /** Centre of its top surface when level; a propeller's or a drum's hub. */
  pos: [number, number, number];
  /** Heading of its length, 0 = along Z; a propeller's axle. */
  yaw: number;
  /** Half width, half thickness and half length; a propeller blade's half width, half length and half thickness. */
  half: [number, number, number];
  /** Propeller and drum: how many blades or slats, and how fast it turns (rad/s). */
  blades?: number;
  spin?: number;
  /** A propeller dressed up as a big wheel: a gondola basket at the tip of every blade. */
  gondolas?: boolean;
  /** Drum: inner radius; its half length is `half[2]`, a slat's half thickness `half[1]`. */
  radius?: number;
  /** Slider: how far it goes out either side of its middle, and where in its swing it starts (rad). */
  travel?: number;
  phase?: number;
  /** Greatest tilt either way, in rad. A seesaw starts tipped back, towards -Z of its heading. */
  angle: number;
  /** Seconds for a rocker to roll over and back, or a slider to go across and back. */
  period?: number;
  color: number;
}

export interface TrackDef {
  id: string;
  name: string;
  blurb: string;
  /** Schrauben to unlock; 0 = available from the start. */
  unlockPrice: number;
  /** Schrauben paid for every lap. */
  lapPay: number;
  spawn: { pos: [number, number, number]; yaw: number };
  statics: BoxDef[];
  props: PropDef[];
  /** Gate 0 is the start/finish line; the rest must be passed in order. */
  gates: Gate[];
  pickups: PickupDef[];
  /** Visual only, no collision. */
  decor: DecorDef[];
  /** Centre line of the lap as x and z, where the track has one. For laying things out along it. */
  line?: [number, number][];
  traffic?: TrafficDef[];
  spinners?: SpinnerDef[];
  movers?: MoverDef[];
  /**
   * Point to point instead of a lap: the first gate is the start, the last the finish. (A run
   * ends there; the next one starts back at the start.)
   */
  course?: boolean;
  /** Falling below this height puts the vehicle back at the start, the clock running on. */
  fallY?: number;
  /** Up in the sky: no lawn far below, only the drop. */
  sky?: boolean;
  /**
   * Half the width of the road, on circuits laid out as a road: beyond it (and a little
   * margin) the ground is slow, so cutting across is no use.
   */
  roadHalf?: number;
  /** With terrain the track brings no floor of its own in `statics`. */
  terrain?: TerrainDef;
  /**
   * Snow falling, or a rain storm with lightning and its own low fog; neither, left out. The
   * time of day is still random on top of this -- a storm just keeps it overcast throughout.
   */
  weather?: 'snow' | 'storm';
}

/** Collider dimensions per prop type, shared by physics and visuals. */
export const PROP_SHAPES = {
  cone: { halfHeight: 0.25, radius: 0.15, mass: 1.5 },
  /** A traffic cone the size of a person, for the crashtest. */
  bigcone: { halfHeight: 1.0, radius: 0.6, mass: 30 },
  carton: { half: [0.25, 0.25, 0.25] as [number, number, number], mass: 2 },
  cart: { half: [0.3, 0.45, 0.5] as [number, number, number], mass: 18 },
  /** An empty plastic drum: light, it goes flying. */
  barrel: { half: [0.29, 0.44, 0.29] as [number, number, number], mass: 9 },
  /** An old car tyre lying flat; stacked, they topple. */
  tyre: { halfHeight: 0.11, radius: 0.33, mass: 8 },
  /** An empty manual wheelchair, rolls like a cart. */
  chair: { half: [0.3, 0.45, 0.4] as [number, number, number], mass: 14 },
};

/** Collider half extents per kind of traffic, shared by physics and visuals. */
export const TRAFFIC_SHAPES = {
  car: { half: [0.85, 0.7, 2.0] as [number, number, number] },
  van: { half: [0.95, 1.05, 2.5] as [number, number, number] },
  /** One carriage; a train is several following each other on one path. */
  train: { half: [1.5, 1.9, 9.5] as [number, number, number] },
  forklift: { half: [0.6, 1.1, 1.25] as [number, number, number] },
  /** Somebody walking to and fro, carrying things. */
  walker: { half: [0.28, 0.88, 0.28] as [number, number, number] },
};

/**
 * A ramp that starts at ground level at `start` and rises along heading `yaw`
 * (0 = +Z, π/2 = +X). `thick` is its half-thickness, 0.1 if not given.
 */
export function ramp(start: [number, number], yaw: number, length: number, width: number, angle: number, color: number, base = 0, thick = 0.1): BoxDef {
  const t = thick;
  const run = (length / 2) * Math.cos(angle);
  const sy = Math.sin(yaw / 2), cy = Math.cos(yaw / 2);
  const sp = Math.sin(-angle / 2), cp = Math.cos(-angle / 2);
  return {
    pos: [start[0] + Math.sin(yaw) * run, base + (length / 2) * Math.sin(angle) - t * Math.cos(angle), start[1] + Math.cos(yaw) * run],
    half: [width / 2, t, length / 2],
    // yaw about Y, then pitch about the local X axis
    quat: [cy * sp, sy * cp, -sy * sp, cy * cp],
    color,
  };
}

/**
 * A ramp from the ground up to `height` over `run` metres of ground, starting at `start` and
 * rising along heading `yaw`. It eases in and out: three pieces, the middle one twice as
 * steep as the two ends, so no wheel meets a sharp edge at the foot or at the top.
 */
export function easedRamp(start: [number, number], yaw: number, run: number, width: number, height: number, color: number): BoxDef[] {
  const t = 0.1;
  const m = height / (1.5 * run);
  const sy = Math.sin(yaw / 2), cy = Math.cos(yaw / 2);
  const out: BoxDef[] = [];
  let s = 0, y = 0;
  for (const [share, slope] of [[0.25, m], [0.5, 2 * m], [0.25, m]]) {
    const a = Math.atan(slope);
    const len = (run * share) / Math.cos(a);
    // the top surface starts at (s, y); the box centre sits half a thickness below its middle
    const c = s + (len / 2) * Math.cos(a) + t * Math.sin(a);
    const sp = Math.sin(-a / 2), cp = Math.cos(-a / 2);
    out.push({
      pos: [start[0] + Math.sin(yaw) * c, y + (len / 2) * Math.sin(a) - t * Math.cos(a), start[1] + Math.cos(yaw) * c],
      half: [width / 2, t, len / 2],
      quat: [cy * sp, sy * cp, -sy * sp, cy * cp],
      color,
    });
    s += run * share;
    y += run * share * slope;
  }
  return out;
}

/**
 * A strip of road running along +Z at `x` that follows a height profile: one plank per pair
 * of points (z, y), each laid from the one point to the next. Small steps between the planks
 * make a smooth curve, so nothing is a kerb to run into, however fast.
 */
export function profile(x: number, points: [number, number][], width: number, color: number): BoxDef[] {
  const t = 0.1;
  const out: BoxDef[] = [];
  for (let i = 0; i + 1 < points.length; i++) {
    const [z0, y0] = points[i], [z1, y1] = points[i + 1];
    const len = Math.hypot(z1 - z0, y1 - y0);
    const a = Math.atan2(y1 - y0, z1 - z0);
    // middle of the top surface, then half a thickness down along its normal
    out.push({
      pos: [x, (y0 + y1) / 2 - t * Math.cos(a), (z0 + z1) / 2 + t * Math.sin(a)],
      half: [width / 2, t, len / 2],
      quat: [Math.sin(-a / 2), 0, 0, Math.cos(-a / 2)],
      color,
    });
  }
  return out;
}

/**
 * A looping entered at ground level at `start`, driving along +X. It is a helix: one turn
 * carries the vehicle `shift` metres to its left (towards -Z), so it comes out beside the way in.
 * Just drive straight; it takes about √(5·g·radius) to get round.
 */
export function looping(start: [number, number], radius: number, lane: number, shift: number, color: number, pieces = 48): BoxDef[] {
  const t = 0.1;
  const alpha = Math.atan2(shift, 2 * Math.PI * radius);
  const yaw = Math.PI / 2 - alpha;
  const fx = Math.sin(yaw), fz = Math.cos(yaw);
  const lx = Math.cos(yaw), lz = -Math.sin(yaw);
  const sy = Math.sin(yaw / 2), cy = Math.cos(yaw / 2);
  const out: BoxDef[] = [];
  for (let i = 0; i < pieces; i++) {
    const a = ((i + 0.5) / pieces) * 2 * Math.PI;
    // along the loop's plane, up, and sideways
    const u = radius * Math.sin(a) + t * Math.sin(a);
    const y = radius - radius * Math.cos(a) - t * Math.cos(a);
    const v = (shift * a) / (2 * Math.PI);
    const sp = Math.sin(-a / 2), cp = Math.cos(-a / 2);
    out.push({
      pos: [start[0] + fx * u + lx * v, y, start[1] + fz * u + lz * v],
      // (just long enough to meet its neighbours: any more and the ends stick up as lips)
      half: [lane / 2, t, radius * Math.tan(Math.PI / pieces) + 0.005],
      quat: [cy * sp, sy * cp, -sy * sp, cy * cp],
      color,
    });
  }
  return out;
}
