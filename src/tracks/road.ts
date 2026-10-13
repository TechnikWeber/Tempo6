import type { DecorDef, Gate, TrackDef } from '../sim/Track';

const ROAD = 0x3f4248;
const PAINT = 0xe8e8e8;

export interface Road {
  /** The centre line, a point every `STEP` metres, closed. */
  line: [number, number][];
  length: number;
  /** Tightest radius of the centre line in metres. */
  minRadius: number;
  decor: DecorDef[];
  gates: Gate[];
  spawn: TrackDef['spawn'];
}

const STEP = 1.5;

/** Closed Catmull-Rom spline through the points, resampled at even distances. */
function smooth(points: [number, number][]): [number, number][] {
  const n = points.length;
  const dense: [number, number][] = [];
  for (let i = 0; i < n; i++) {
    const [p0, p1, p2, p3] = [points[(i + n - 1) % n], points[i], points[(i + 1) % n], points[(i + 2) % n]];
    for (let k = 0; k < 40; k++) {
      const t = k / 40, t2 = t * t, t3 = t2 * t;
      const at = (a: number, b: number, c: number, d: number) =>
        0.5 * (2 * b + (c - a) * t + (2 * a - 5 * b + 4 * c - d) * t2 + (3 * b - a - 3 * c + d) * t3);
      dense.push([at(p0[0], p1[0], p2[0], p3[0]), at(p0[1], p1[1], p2[1], p3[1])]);
    }
  }
  let total = 0;
  for (let i = 0; i < dense.length; i++) {
    const b = dense[(i + 1) % dense.length];
    total += Math.hypot(b[0] - dense[i][0], b[1] - dense[i][1]);
  }
  const count = Math.round(total / STEP);
  const out: [number, number][] = [];
  let walked = 0;
  let next = 0;
  for (let i = 0; i < dense.length && out.length < count; i++) {
    const a = dense[i], b = dense[(i + 1) % dense.length];
    const d = Math.hypot(b[0] - a[0], b[1] - a[1]);
    while (next <= walked + d && out.length < count) {
      const f = (next - walked) / d;
      out.push([a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f]);
      next += total / count;
    }
    walked += d;
  }
  return out;
}

/**
 * A closed road on flat ground, painted on: surface, edge lines, finish line, checkpoints
 * and the starting grid. Driven in the order of the points; the lap starts at the first one.
 */
export function road(points: [number, number][], width: number, gateCount = 8): Road {
  const line = smooth(points);
  const n = line.length;
  const heading = (i: number) => {
    const a = line[(i + n - 1) % n], b = line[(i + 1) % n];
    return Math.atan2(b[0] - a[0], b[1] - a[1]);
  };
  let minRadius = Infinity;
  for (let i = 0; i < n; i++) {
    let turn = heading((i + 1) % n) - heading(i);
    turn = Math.atan2(Math.sin(turn), Math.cos(turn));
    if (Math.abs(turn) > 1e-6) minRadius = Math.min(minRadius, STEP / Math.abs(turn));
  }
  const edge = (side: number): [number, number][] =>
    line.map(([x, z], i) => {
      const h = heading(i);
      // the left of the direction of travel is +X when heading +Z
      return [x + side * Math.cos(h) * (width / 2), z - side * Math.sin(h) * (width / 2)];
    });
  const decor: DecorDef[] = [
    { type: 'path', pos: [0, 0.004, 0], half: [width / 2 + 0.3, 0, 0], points: line, color: ROAD },
    { type: 'path', pos: [0, 0.008, 0], half: [0.12, 0, 0], points: edge(1), color: PAINT },
    { type: 'path', pos: [0, 0.008, 0], half: [0.12, 0, 0], points: edge(-1), color: PAINT },
    { type: 'finish', pos: [line[0][0], 0.012, line[0][1]], half: [0.6, 0, width / 2], yaw: heading(0) - Math.PI / 2 },
  ];
  const gates: Gate[] = [];
  for (let k = 0; k < gateCount; k++) {
    const [x, z] = line[Math.round((k * n) / gateCount) % n];
    gates.push({ x, z, hx: width / 2 + 1, hz: width / 2 + 1 });
  }
  const back = Math.round(8 / STEP);
  const [sx, sz] = line[(n - back) % n];
  return { line, length: n * STEP, minRadius, decor, gates, spawn: { pos: [sx, 0.6, sz], yaw: heading((n - back) % n) } };
}
