import { describe, expect, it } from 'vitest';
import { Box3, BoxGeometry, Mesh, type MeshStandardMaterial, type Object3D, Vector3 } from 'three';
import { STAIR, VEHICLE_ORDER, VEHICLES } from '../src/config/vehicles';
import { buildPerson, buildVehicle } from '../src/render/models';

interface Face {
  mesh: number;
  color: string;
  axis: number;
  dir: number;
  at: number;
  lo: number[];
  hi: number[];
}

/**
 * Faces of two boxes that lie in the same plane, facing the same way and overlapping, flicker
 * (z-fighting): the renderer cannot tell which is in front. Same-coloured ones look the same
 * whichever wins, so only differently coloured pairs count. Boxes turned off the axes are
 * not looked at.
 */
function flickering(root: Object3D): string[] {
  root.updateMatrixWorld(true);
  const faces: Face[] = [];
  let n = 0;
  root.traverse((o) => {
    if (!(o instanceof Mesh) || !(o.geometry instanceof BoxGeometry)) return;
    n++;
    const e = o.matrixWorld.elements;
    const axes = [new Vector3(e[0], e[1], e[2]), new Vector3(e[4], e[5], e[6]), new Vector3(e[8], e[9], e[10])].map((a) => a.normalize());
    if (!axes.every((a) => [a.x, a.y, a.z].some((c) => Math.abs(Math.abs(c) - 1) < 1e-6))) return;
    o.geometry.computeBoundingBox();
    const b = new Box3().copy(o.geometry.boundingBox!).applyMatrix4(o.matrixWorld);
    const lo = b.min.toArray(), hi = b.max.toArray();
    const color = (o.material as MeshStandardMaterial).color.getHexString();
    for (let axis = 0; axis < 3; axis++) for (const dir of [-1, 1]) faces.push({ mesh: n, color, axis, dir, at: dir < 0 ? lo[axis] : hi[axis], lo, hi });
  });
  const found: string[] = [];
  for (let i = 0; i < faces.length; i++) {
    for (let j = i + 1; j < faces.length; j++) {
      const a = faces[i], b = faces[j];
      if (a.mesh === b.mesh || a.color === b.color || a.axis !== b.axis || a.dir !== b.dir || Math.abs(a.at - b.at) > 1e-4) continue;
      let area = 1;
      for (let k = 0; k < 3; k++) if (k !== a.axis) area *= Math.max(0, Math.min(a.hi[k], b.hi[k]) - Math.max(a.lo[k], b.lo[k]));
      if (area > 1e-6) found.push(`#${a.color} and #${b.color} on axis ${a.axis} at ${a.at.toFixed(3)}`);
    }
  }
  return found;
}

describe('vehicle models', () => {
  it.each(VEHICLE_ORDER)('%s has no two faces in the same plane (they would flicker)', (id) => {
    expect(flickering(buildVehicle(VEHICLES[id], true).root)).toEqual([]);
  });

  // (tipped forward its parts are off the axes, where the check above does not look)
  it('the stair climber has none either when it stands upright', () => {
    const lean = STAIR.lean;
    STAIR.lean = 0;
    try {
      expect(flickering(buildVehicle(VEHICLES.scala, true).root)).toEqual([]);
    } finally {
      STAIR.lean = lean;
    }
  });
});

describe('people', () => {
  const poses = ['stand', 'sit', 'carry', 'wave', 'phone', 'point', 'walk'] as const;
  it.each(poses.flatMap((pose) => [[pose, false], [pose, true]] as const))('%s (worker: %s) has no two faces in the same plane', (pose, worker) => {
    for (let seed = 0; seed < 6; seed++) expect(flickering(buildPerson({ pose, worker, seed }).root)).toEqual([]);
  });
});
