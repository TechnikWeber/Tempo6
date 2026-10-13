import { BoxGeometry, ConeGeometry, CylinderGeometry, Group, Mesh, MeshStandardMaterial, type Object3D } from 'three';
import { PROP_SHAPES, type PickupType, type PropType } from '../sim/Track';
import type { VehicleSpec } from '../config/vehicles';

const materials = new Map<number, MeshStandardMaterial>();

/** Shared flat-shaded material per colour: the blocky look is the art style. */
export function mat(color: number): MeshStandardMaterial {
  let m = materials.get(color);
  if (!m) {
    m = new MeshStandardMaterial({ color, flatShading: true, roughness: 0.85, metalness: 0.05 });
    materials.set(color, m);
  }
  return m;
}

export function box(parent: Object3D, w: number, h: number, d: number, color: number, x = 0, y = 0, z = 0): Mesh {
  const m = new Mesh(new BoxGeometry(w, h, d), mat(color));
  m.position.set(x, y, z);
  m.castShadow = true;
  m.receiveShadow = true;
  parent.add(m);
  return m;
}

function cyl(parent: Object3D, r: number, h: number, color: number, x = 0, y = 0, z = 0, segments = 8): Mesh {
  const m = new Mesh(new CylinderGeometry(r, r, h, segments), mat(color));
  m.position.set(x, y, z);
  m.castShadow = true;
  parent.add(m);
  return m;
}

export interface WheelModel {
  /** Sits at the wheel centre and carries the steering / swivel angle. */
  pivot: Group;
  /** Rolls around the axle. */
  spin: Group;
}

export interface VehicleModel {
  root: Group;
  wheels: WheelModel[];
  /** Leans in corners. */
  driver: Group;
}

const SKIN = 0xe8b48c;
const TYRE = 0x1d1d1f;

function wheel(radius: number, width: number, hub: number): WheelModel {
  const pivot = new Group();
  const spin = new Group();
  pivot.add(spin);
  const tyre = cyl(spin, radius, width, TYRE, 0, 0, 0, 10);
  tyre.rotation.z = Math.PI / 2;
  const cap = cyl(spin, radius * 0.55, width + 0.02, hub, 0, 0, 0, 6);
  cap.rotation.z = Math.PI / 2;
  // a spoke, so the rolling is visible
  box(spin, width + 0.03, radius * 1.5, radius * 0.25, hub);
  return { pivot, spin };
}

function wheelsFor(root: Group, spec: VehicleSpec, hub: number): WheelModel[] {
  return spec.wheels.map((w) => {
    const m = wheel(w.radius, w.caster ? 0.05 : 0.09, hub);
    m.pivot.position.set(w.x, w.y - spec.suspensionRest, w.z);
    root.add(m.pivot);
    return m;
  });
}

/** A seated blocky person. Origin is the seat surface under the hips. */
function driver(shirt: number, trousers: number, hair: number, armsForward: boolean): Group {
  const g = new Group();
  box(g, 0.36, 0.44, 0.24, shirt, 0, 0.26, -0.02);
  box(g, 0.22, 0.22, 0.22, SKIN, 0, 0.62, 0);
  box(g, 0.24, 0.08, 0.24, hair, 0, 0.75, -0.01);
  box(g, 0.23, 0.05, 0.06, 0x111111, 0, 0.64, 0.1); // sunglasses
  box(g, 0.06, 0.04, 0.03, 0xb85c4a, 0, 0.55, 0.11); // grin
  for (const s of [1, -1]) {
    box(g, 0.14, 0.13, 0.42, trousers, s * 0.1, 0.06, 0.2);
    box(g, 0.12, 0.38, 0.12, trousers, s * 0.1, -0.16, 0.36);
    box(g, 0.13, 0.07, 0.24, 0x2a2a2a, s * 0.1, -0.36, 0.42);
    if (armsForward) {
      const arm = box(g, 0.1, 0.1, 0.46, shirt, s * 0.22, 0.3, 0.2);
      arm.rotation.x = -0.25;
      box(g, 0.09, 0.09, 0.09, SKIN, s * 0.22, 0.36, 0.44);
    } else {
      box(g, 0.1, 0.3, 0.1, shirt, s * 0.24, 0.28, -0.02);
      box(g, 0.1, 0.09, 0.3, SKIN, s * 0.24, 0.14, 0.14);
    }
  }
  return g;
}

function buildWheelchair(spec: VehicleSpec): VehicleModel {
  const root = new Group();
  const FRAME = 0x2b2f36;
  const SEAT = 0x15161a;
  const ACCENT = 0xd23b3b;
  box(root, 0.5, 0.2, 0.62, FRAME, 0, -0.1, -0.08); // battery box
  box(root, 0.3, 0.06, 0.3, ACCENT, 0, -0.1, 0.3); // front beam to the casters
  box(root, 0.46, 0.08, 0.46, SEAT, 0, 0.06, -0.02);
  box(root, 0.46, 0.56, 0.08, SEAT, 0, 0.38, -0.27);
  box(root, 0.22, 0.14, 0.07, SEAT, 0, 0.76, -0.27); // headrest
  for (const s of [1, -1]) {
    box(root, 0.06, 0.05, 0.38, SEAT, s * 0.27, 0.27, -0.04);
    box(root, 0.04, 0.2, 0.04, FRAME, s * 0.27, 0.16, -0.18);
    box(root, 0.04, 0.3, 0.04, FRAME, s * 0.21, 0.72, -0.31); // push handles
    box(root, 0.04, 0.04, 0.14, ACCENT, s * 0.21, 0.86, -0.36);
    box(root, 0.16, 0.03, 0.2, FRAME, s * 0.11, -0.3, 0.48); // footrests
    box(root, 0.03, 0.26, 0.03, FRAME, s * 0.11, -0.18, 0.42);
  }
  // joystick on the right armrest (right is -X)
  box(root, 0.08, 0.05, 0.1, FRAME, -0.27, 0.29, 0.19);
  cyl(root, 0.012, 0.09, 0x888888, -0.27, 0.35, 0.19, 5);
  box(root, 0.04, 0.04, 0.04, ACCENT, -0.27, 0.4, 0.19);
  const d = driver(0xe0563a, 0x3c5a8a, 0xd8d8d8, false);
  d.position.set(0, 0.1, -0.14);
  root.add(d);
  return { root, wheels: wheelsFor(root, spec, 0xb9bcc2), driver: d };
}

function buildScooter(spec: VehicleSpec): VehicleModel {
  const root = new Group();
  const BODY = 0xb3202a;
  const DARK = 0x24262b;
  box(root, 0.5, 0.07, 1.15, DARK, 0, -0.14, 0); // deck
  box(root, 0.52, 0.22, 0.42, BODY, 0, -0.02, -0.38); // rear cover
  box(root, 0.4, 0.2, 0.22, BODY, 0, -0.04, 0.5); // front fairing
  box(root, 0.12, 0.06, 0.02, 0xfff3b0, 0, 0, 0.615); // headlight
  cyl(root, 0.035, 0.22, 0x888888, 0, 0.18, -0.3, 6); // seat post
  box(root, 0.44, 0.08, 0.42, DARK, 0, 0.32, -0.3);
  box(root, 0.44, 0.44, 0.08, DARK, 0, 0.56, -0.5);
  // tiller, leaning back towards the driver
  const tiller = box(root, 0.06, 0.72, 0.06, 0x888888, 0, 0.36, 0.4);
  tiller.rotation.x = -0.3;
  box(root, 0.5, 0.05, 0.05, DARK, 0, 0.7, 0.3);
  box(root, 0.16, 0.1, 0.08, BODY, 0, 0.72, 0.31);
  // shopping basket
  box(root, 0.36, 0.2, 0.24, 0x9aa0a8, 0, 0.42, 0.62);
  box(root, 0.3, 0.02, 0.18, 0x3a3d42, 0, 0.525, 0.62);
  // safety flag
  cyl(root, 0.01, 1.3, 0xdddddd, -0.22, 0.75, -0.56, 4);
  box(root, 0.01, 0.16, 0.24, 0xff7a00, -0.22, 1.32, -0.68);
  const d = driver(0x3f8f5f, 0x8a6f4d, 0xf0f0f0, true);
  d.position.set(0, 0.36, -0.36);
  root.add(d);
  return { root, wheels: wheelsFor(root, spec, 0xd9d9d9), driver: d };
}

export function buildVehicle(spec: VehicleSpec): VehicleModel {
  return spec.id === 'wheelchair' ? buildWheelchair(spec) : buildScooter(spec);
}

export function buildProp(type: PropType): Group {
  const g = new Group();
  if (type === 'cone') {
    const s = PROP_SHAPES.cone;
    const c = new Mesh(new ConeGeometry(s.radius, s.halfHeight * 2, 8), mat(0xff6a13));
    c.castShadow = true;
    g.add(c);
    box(g, 0.36, 0.03, 0.36, 0xff6a13, 0, -s.halfHeight + 0.015, 0);
    cyl(g, 0.085, 0.07, 0xf5f5f5, 0, 0.02, 0, 8);
  } else if (type === 'carton') {
    const [x, y, z] = PROP_SHAPES.carton.half;
    box(g, x * 2, y * 2, z * 2, 0xc19a6b);
    box(g, 0.08, y * 2 + 0.005, z * 2 + 0.005, 0xa67c4e);
  } else {
    const SILVER = 0xaeb4bb;
    box(g, 0.56, 0.06, 0.9, SILVER, 0, -0.05, 0);
    for (const s of [1, -1]) {
      box(g, 0.03, 0.4, 0.9, SILVER, s * 0.265, 0.15, 0);
      box(g, 0.5, 0.4, 0.03, SILVER, 0, 0.15, s * 0.435);
      box(g, 0.03, 0.34, 0.03, SILVER, s * 0.22, -0.25, 0.3);
      box(g, 0.03, 0.34, 0.03, SILVER, s * 0.22, -0.25, -0.3);
      box(g, 0.05, 0.08, 0.08, TYRE, s * 0.22, -0.41, 0.3);
      box(g, 0.05, 0.08, 0.08, TYRE, s * 0.22, -0.41, -0.3);
    }
    box(g, 0.56, 0.04, 0.04, 0xd23b3b, 0, 0.4, -0.5);
  }
  return g;
}

export function buildPickup(type: PickupType): Group {
  const g = new Group();
  if (type === 'bottle') {
    cyl(g, 0.09, 0.3, 0x3aa05a, 0, 0, 0, 7);
    cyl(g, 0.035, 0.14, 0x3aa05a, 0, 0.21, 0, 6);
    cyl(g, 0.04, 0.03, 0xe8e8e8, 0, 0.29, 0, 6);
    cyl(g, 0.092, 0.12, 0xf2e9c9, 0, -0.02, 0, 7); // label
  } else {
    box(g, 0.6, 0.36, 0.45, 0xf2c417);
    box(g, 0.62, 0.1, 0.47, 0xc22a2a, 0, 0.02, 0);
    for (let i = -2; i <= 2; i++) for (const z of [-0.12, 0.12]) cyl(g, 0.04, 0.12, 0x6b3f1d, i * 0.11, 0.22, z, 5);
  }
  return g;
}
