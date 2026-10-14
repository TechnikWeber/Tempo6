import type { BoxDef, DecorDef, TrackDef } from '../sim/Track';

const TARMAC = 0x3f4248;
const CONCRETE = 0x9a9a94;
const KERB = 0xd23b3b;
const PAINT = 0xe8e8e8;

// A test ground, not a level: one circuit whose four corners get tighter and tighter, and
// a skid pad with rings of known radius. For finding out how tight a bend may be.
const LOT_X = 130;
const LOT_Z = 55;
/** Lane width between the painted edge lines. */
const WIDTH = 5;
/** Centre of the circuit and half extents of its centre line. */
const CX = -62;
const A = 38;
const B = 24;
/** Centre of the skid pad. */
const PX = 68;
const RINGS = [5, 7.5, 10, 12.5, 15, 20, 25, 30];

/** The corners in driving order, with the radius of the inside line. */
export const CORNERS = [
  { sx: 1, sz: -1, r: 12, name: 'WEIT' },
  { sx: 1, sz: 1, r: 7, name: 'ENG' },
  { sx: -1, sz: 1, r: 4, name: 'ENGER' },
  { sx: -1, sz: -1, r: 2, name: 'AM ENGSTEN' },
].map((c) => ({ ...c, x: CX + c.sx * (A - c.r - WIDTH / 2), z: c.sz * (B - c.r - WIDTH / 2) }));

/** Half the width of an edge line. */
const LINE = 0.15;

/** An edge line painted on the ground: nothing to bump into, you just see when you cross it. */
function line(x0: number, z0: number, x1: number, z1: number, color: number): DecorDef {
  return {
    type: 'box',
    pos: [(x0 + x1) / 2, 0.005, (z0 + z1) / 2],
    half: [LINE, 0.005, Math.hypot(x1 - x0, z1 - z0) / 2 + 0.02],
    yaw: Math.atan2(x1 - x0, z1 - z0),
    color,
  };
}

/** A quarter circle of edge line, in pieces of about a metre. */
function arc(cx: number, cz: number, radius: number, from: number, to: number, color: number): DecorDef[] {
  const n = Math.max(6, Math.ceil((Math.abs(to - from) * radius) / 1.0));
  const at = (i: number): [number, number] => {
    const a = from + ((to - from) * i) / n;
    return [cx + radius * Math.cos(a), cz + radius * Math.sin(a)];
  };
  return Array.from({ length: n }, (_, i) => line(...at(i), ...at(i + 1), color));
}

const statics: BoxDef[] = [
  { pos: [0, -0.5, 0], half: [LOT_X, 0.5, LOT_Z], color: TARMAC },
  { pos: [0, 0.5, LOT_Z], half: [LOT_X, 0.5, 0.3], color: CONCRETE },
  { pos: [0, 0.5, -LOT_Z], half: [LOT_X, 0.5, 0.3], color: CONCRETE },
  { pos: [LOT_X, 0.5, 0], half: [0.3, 0.5, LOT_Z], color: CONCRETE },
  { pos: [-LOT_X, 0.5, 0], half: [0.3, 0.5, LOT_Z], color: CONCRETE },
];
const decor: DecorDef[] = [];

for (const c of CORNERS) {
  // from the side that runs along X round to the side that runs along Z
  const from = c.sx > 0 ? 0 : Math.PI;
  const to = c.sz > 0 ? Math.PI / 2 : c.sx > 0 ? -Math.PI / 2 : (3 * Math.PI) / 2;
  decor.push(...arc(c.x, c.z, c.r, from, to, KERB), ...arc(c.x, c.z, c.r + WIDTH, from, to, PAINT));
  // the name and the inside radius, on a board outside the bend
  const d = c.r + WIDTH + 3;
  decor.push({
    type: 'board',
    pos: [c.x + c.sx * d * Math.SQRT1_2, 2.2, c.z + c.sz * d * Math.SQRT1_2],
    half: [4, 0.5, 0.06],
    yaw: Math.atan2(-c.sx, -c.sz),
    text: `${c.name} · ${c.r} m`,
  });
}
// The straights between them, inside and outside line.
const [se, ne, nw, sw] = CORNERS;
// The middle of the lane, a point every metre or so, from the finish line round.
const middle: [number, number][] = [];
const run = (x0: number, z0: number, x1: number, z1: number) => {
  const n = Math.max(1, Math.round(Math.hypot(x1 - x0, z1 - z0)));
  for (let i = 0; i < n; i++) middle.push([x0 + ((x1 - x0) * i) / n, z0 + ((z1 - z0) * i) / n]);
};
const bend = (c: (typeof CORNERS)[number], from: number, to: number) => {
  const r = c.r + WIDTH / 2;
  const n = Math.max(6, Math.round(Math.abs(to - from) * r));
  for (let i = 0; i < n; i++) {
    const a = from + ((to - from) * i) / n;
    middle.push([c.x + r * Math.cos(a), c.z + r * Math.sin(a)]);
  }
};
run(CX, -B, se.x, -B);
bend(se, -Math.PI / 2, 0);
run(CX + A, se.z, CX + A, ne.z);
bend(ne, 0, Math.PI / 2);
run(ne.x, B, nw.x, B);
bend(nw, Math.PI / 2, Math.PI);
run(CX - A, nw.z, CX - A, sw.z);
bend(sw, Math.PI, (3 * Math.PI) / 2);
run(sw.x, -B, CX, -B);
for (const o of [-WIDTH / 2, WIDTH / 2]) {
  decor.push(
    line(sw.x, -B + o, se.x, -B + o, PAINT),
    line(CX + A + o, se.z, CX + A + o, ne.z, PAINT),
    line(nw.x, B + o, ne.x, B + o, PAINT),
    line(CX - A + o, sw.z, CX - A + o, nw.z, PAINT),
  );
}
decor.push({ type: 'finish', pos: [CX, 0.01, -B], half: [0.6, 0, WIDTH / 2 - LINE] });

// Skid pad: go round flat out at full lock and read off which ring it holds.
RINGS.forEach((r, i) => {
  decor.push({ type: 'ring', pos: [PX, 0.006, 0], half: [r, 0, 0.12], color: i % 2 ? 0xe6c94a : 0xe8e8e8 });
  for (const s of [1, -1]) {
    decor.push({ type: 'label', pos: [PX + s * (r + 0.75), 0.008, 0], half: [0.45, 0, 3.6], yaw: (s * Math.PI) / 2, text: `${String(r).replace('.', ',')} m` });
  }
});

export const KURVEN: TrackDef = {
  id: 'kurven',
  name: 'Kurven-Teststrecke',
  blurb: 'Vier Kurven von weit bis am engsten, daneben Ringe von 5 bis 30 m. Zum Ausprobieren.',
  unlockPrice: 150,
  lapPay: 15,
  spawn: { pos: [CX - 8, 0.6, -B], yaw: Math.PI / 2 },
  statics,
  props: [],
  gates: [
    { x: CX, z: -B, hx: 1.5, hz: WIDTH / 2 },
    { x: CX + A, z: 0, hx: WIDTH / 2, hz: 1.5 },
    { x: CX, z: B, hx: 1.5, hz: WIDTH / 2 },
    { x: CX - A, z: 0, hx: WIDTH / 2, hz: 1.5 },
  ],
  pickups: [],
  decor,
  line: middle,
};
