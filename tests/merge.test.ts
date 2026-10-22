import { describe, expect, it } from 'vitest';
import { BoxGeometry, Group, Mesh, MeshStandardMaterial, ShapeGeometry, Shape, Vector2, IcosahedronGeometry } from 'three';
import { box, cyl, mat } from '../src/render/models';
import { mergeFixed } from '../src/render/View';

describe('merging what never moves', () => {
  it('melts plain-coloured meshes down to one per colour, in place, and hands back the rest', () => {
    const fixed = new Group();
    const a = box(fixed, 1, 1, 1, 0x123456, 5, 0, 0);
    box(fixed, 2, 1, 1, 0x123456, -5, 0, 0);
    cyl(fixed, 1, 2, 0x654321, 0, 3, 0);
    const g = new Group();
    g.position.set(0, 10, 0);
    g.add(new Mesh(new ShapeGeometry(new Shape([new Vector2(0, 0), new Vector2(1, 0), new Vector2(0, 1)])), mat(0x654321)));
    g.add(new Mesh(new IcosahedronGeometry(1, 0), mat(0x123456)));
    fixed.add(g);
    const textured = new Mesh(new BoxGeometry(1, 1, 1), new MeshStandardMaterial());
    textured.position.set(0, 0, 7);
    fixed.add(textured);
    a.castShadow = false;
    const out = mergeFixed(fixed);
    // per colour and shadow setting: the boxes that cast shadows, the one that does not, the
    // ones in the group (plain meshes, no shadows) and the cylinder; and the loose one
    expect(out.length).toBe(6);
    const loose = out.find((o) => o === textured)!;
    expect(loose.position.z).toBe(7);
    const merged = out.filter((o): o is Mesh => o instanceof Mesh && o !== textured);
    merged.forEach((m) => m.geometry.computeBoundingBox());
    const top = Math.max(...merged.map((m) => m.geometry.boundingBox!.max.y));
    expect(top).toBeGreaterThan(10);
  });
});
