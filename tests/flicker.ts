import { Quaternion, Vector3 } from 'three';
import { heightAt, type TrackDef } from '../src/sim/Track';

/** One flat face of a box (or a flat painted decal), as it lies in the world. */
interface Face {
  owner: number;
  what: string;
  color: number;
  n: Vector3;
  d: number;
  corners: Vector3[];
}

const AXES = [new Vector3(1, 0, 0), new Vector3(0, 1, 0), new Vector3(0, 0, 1)];

function boxFaces(owner: number, what: string, pos: Vector3, half: number[], q: Quaternion, color: number, out: Face[]): void {
  const ax = AXES.map((a) => a.clone().applyQuaternion(q));
  for (let k = 0; k < 3; k++) {
    for (const s of [-1, 1]) {
      const n = ax[k].clone().multiplyScalar(s);
      const c = pos.clone().addScaledVector(ax[k], s * half[k]);
      const [i, j] = [0, 1, 2].filter((m) => m !== k);
      const u = ax[i].clone().multiplyScalar(half[i]), v = ax[j].clone().multiplyScalar(half[j]);
      const corners = [c.clone().add(u).add(v), c.clone().sub(u).add(v), c.clone().sub(u).sub(v), c.clone().add(u).sub(v)];
      out.push({ owner, what, color, n, d: n.dot(c), corners });
    }
  }
}

/** A flat decal facing up, `hx` by `hz` round `pos`, turned by `yaw`. */
function decalFace(owner: number, what: string, pos: Vector3, hx: number, hz: number, yaw: number, color: number, out: Face[]): void {
  const q = new Quaternion().setFromAxisAngle(AXES[1], yaw);
  const u = new Vector3(hx, 0, 0).applyQuaternion(q), v = new Vector3(0, 0, hz).applyQuaternion(q);
  const corners = [pos.clone().add(u).add(v), pos.clone().sub(u).add(v), pos.clone().sub(u).sub(v), pos.clone().add(u).sub(v)];
  out.push({ owner, what, color, n: AXES[1].clone(), d: pos.y, corners });
}

/** Whether every corner of `f` lies within the convex polygon `g` (in the same plane), give or take a millimetre. */
function within(f: Face, g: Face): boolean {
  const n = g.n;
  return f.corners.every((p) =>
    g.corners.every((a, i) => {
      const b = g.corners[(i + 1) % g.corners.length];
      // inside is to the left of every edge, seen along the normal (either winding)
      const side = b.clone().sub(a).cross(p.clone().sub(a)).dot(n);
      const side0 = b.clone().sub(a).cross(g.corners[(i + 2) % g.corners.length].clone().sub(a)).dot(n);
      return side * Math.sign(side0) > -1e-3 * b.distanceTo(a);
    }),
  );
}

/** How deep two convex polygons in a plane overlap (0 or less: apart or just touching). */
function overlap(a: Face, b: Face): number {
  // a basis in the plane
  const e1 = a.corners[1].clone().sub(a.corners[0]).normalize();
  const e2 = a.n.clone().cross(e1);
  const flat = (f: Face) => f.corners.map((p) => [p.dot(e1), p.dot(e2)] as const);
  const pa = flat(a), pb = flat(b);
  let depth = Infinity;
  for (const poly of [pa, pb]) {
    for (let i = 0; i < poly.length; i++) {
      const [x0, y0] = poly[i], [x1, y1] = poly[(i + 1) % poly.length];
      const len = Math.hypot(x1 - x0, y1 - y0);
      if (len < 1e-9) continue;
      const nx = -(y1 - y0) / len, ny = (x1 - x0) / len;
      const range = (p: readonly (readonly [number, number])[]) => {
        let lo = Infinity, hi = -Infinity;
        for (const [x, y] of p) {
          const t = x * nx + y * ny;
          lo = Math.min(lo, t);
          hi = Math.max(hi, t);
        }
        return [lo, hi];
      };
      const [alo, ahi] = range(pa), [blo, bhi] = range(pb);
      depth = Math.min(depth, Math.min(ahi, bhi) - Math.max(alo, blo));
      if (depth <= 0) return depth;
    }
  }
  return depth;
}

/**
 * Faces of a track's boxes (solid or decor) and flat decals that lie in the same plane, face
 * the same way and overlap: they flicker (z-fighting), the renderer cannot tell which is in
 * front. Faces of the same colour look the same whichever wins, so only differently coloured
 * pairs count.
 */
export function trackFlicker(track: TrackDef): string[] {
  const faces: Face[] = [];
  let owner = 0;
  const ground = (x: number, z: number) => heightAt(track.terrain, x, z);
  for (const b of track.statics) {
    const q = b.quat ? new Quaternion(...b.quat) : new Quaternion();
    boxFaces(owner++, `static at ${b.pos.map((v) => v.toFixed(2)).join(', ')}`, new Vector3(...b.pos), b.half, q, b.color, faces);
  }
  for (const d of track.decor) {
    const pos = new Vector3(d.pos[0], d.pos[1] + ground(d.pos[0], d.pos[2]), d.pos[2]);
    const what = `${d.type} at ${d.pos.map((v) => v.toFixed(2)).join(", ")} half ${(d.half ?? []).join("/")} #${(d.color ?? 0).toString(16)}`;
    if (d.type === 'box') {
      boxFaces(owner++, what, pos, d.half ?? [0.5, 0.5, 0.5], new Quaternion().setFromAxisAngle(AXES[1], d.yaw ?? 0), d.color ?? 0xffffff, faces);
    } else if (d.type === 'label') {
      const [hx, , hz] = d.half ?? [0.5, 0.5, 0.5];
      // (the text runs along the decal's X, `hz` long, `hx` across)
      decalFace(owner++, what, pos, hz, hx, d.yaw ?? 0, -1, faces);
    } else if (d.type === 'finish') {
      const [hx, , hz] = d.half ?? [0.5, 0.5, 0.5];
      decalFace(owner++, what, pos, hx, hz, d.yaw ?? 0, -2, faces);
    }
  }
  // the same way round, in the same plane
  const keyOf = (x: number, y: number, z: number) => [x, y, z].map((c) => (Math.round(c * 1000) / 1000 || 0).toFixed(3)).join();
  const all = new Map<string, Face[]>();
  for (const f of faces) {
    const key = keyOf(f.n.x, f.n.y, f.n.z);
    let g = all.get(key);
    if (!g) all.set(key, (g = []));
    g.push(f);
  }
  const groups = new Map<string, Face[]>();
  for (const [key, list] of all) {
    groups.set(
      key,
      list.filter((f) => {
        // (underneath, near the ground, where no camera ever looks)
        if (f.n.y < -0.99 && -f.d < 0.5 + ground(f.corners[0].x, f.corners[0].z)) return false;
        // (pressed flat against another box's face: only its back is to be seen, and backs are not drawn)
        const against = all.get(keyOf(-f.n.x, -f.n.y, -f.n.z)) ?? [];
        return !against.some((g) => g.owner !== f.owner && Math.abs(g.d + f.d) < 1e-4 && within(f, g));
      }),
    );
  }
  const found: string[] = [];
  for (const g of groups.values()) {
    g.sort((a, b) => a.d - b.d);
    for (let i = 0; i < g.length; i++) {
      for (let j = i + 1; j < g.length && g[j].d - g[i].d < 1e-4; j++) {
        const a = g[i], b = g[j];
        if (a.owner === b.owner || a.color === b.color) continue;
        if (overlap(a, b) > 1e-3) found.push(`${a.what} and ${b.what}, facing ${[a.n.x, a.n.y, a.n.z].map((c) => c.toFixed(2)).join(', ')}`);
      }
    }
  }
  return found;
}
