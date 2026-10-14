/** Static box with collision. `quat` is x, y, z, w. */
export interface BoxDef {
  pos: [number, number, number];
  half: [number, number, number];
  quat?: [number, number, number, number];
  color: number;
}

export type PropType = 'cone' | 'carton' | 'cart';

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
   * filling the outline `points` at the height of `pos`.
   */
  type: 'box' | 'tree' | 'lamp' | 'finish' | 'sign' | 'board' | 'label' | 'ring' | 'path' | 'slab';
  pos: [number, number, number];
  half?: [number, number, number];
  color?: number;
  text?: string;
  /** Heading in rad, 0 = facing +Z. */
  yaw?: number;
  /** Corners of a `path` or `slab`, x and z. */
  points?: [number, number][];
}

export type TrafficType = 'car' | 'van';

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
 * A plank that moves. A `seesaw` tips about its middle towards whichever end the vehicle is
 * on; a `rocker` rolls slowly from side to side by itself, for balancing across.
 */
export interface MoverDef {
  type: 'seesaw' | 'rocker';
  /** Centre of its top surface when level. */
  pos: [number, number, number];
  /** Heading of its length, 0 = along Z. */
  yaw: number;
  /** Half width, half thickness and half length. */
  half: [number, number, number];
  /** Greatest tilt either way, in rad. A seesaw starts tipped back, towards -Z of its heading. */
  angle: number;
  /** Seconds for a rocker to roll over and back. */
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
  /** With terrain the track brings no floor of its own in `statics`. */
  terrain?: TerrainDef;
}

/** Collider dimensions per prop type, shared by physics and visuals. */
export const PROP_SHAPES = {
  cone: { halfHeight: 0.25, radius: 0.15, mass: 1.5 },
  carton: { half: [0.25, 0.25, 0.25] as [number, number, number], mass: 2 },
  cart: { half: [0.3, 0.45, 0.5] as [number, number, number], mass: 18 },
};

/** Collider half extents per kind of traffic, shared by physics and visuals. */
export const TRAFFIC_SHAPES = {
  car: { half: [0.85, 0.7, 2.0] as [number, number, number] },
  van: { half: [0.95, 1.05, 2.5] as [number, number, number] },
};

/**
 * A ramp that starts at ground level at `start` and rises along heading `yaw`
 * (0 = +Z, π/2 = +X).
 */
export function ramp(start: [number, number], yaw: number, length: number, width: number, angle: number, color: number): BoxDef {
  const t = 0.1;
  const run = (length / 2) * Math.cos(angle);
  const sy = Math.sin(yaw / 2), cy = Math.cos(yaw / 2);
  const sp = Math.sin(-angle / 2), cp = Math.cos(-angle / 2);
  return {
    pos: [start[0] + Math.sin(yaw) * run, (length / 2) * Math.sin(angle) - t * Math.cos(angle), start[1] + Math.cos(yaw) * run],
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
