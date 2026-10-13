import { BoxGeometry, ConeGeometry, CylinderGeometry, Group, Mesh, MeshStandardMaterial, type Object3D, Quaternion, Vector3 } from 'three';
import { PROP_SHAPES, TRAFFIC_SHAPES, type PickupType, type PropType, type TrafficDef } from '../sim/Track';
import { BRAND_COLORS, groundY, type VehicleSpec, type WheelSpec } from '../config/vehicles';

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
  /** Shoulder pivots that swing when pushing the rims. */
  arms: Group[];
  /** Where the battery sits. */
  battery: [number, number, number];
}

/** A built model plus the sprung part: everything but the wheels, swaying on the suspension. */
export interface VehicleRig extends Omit<VehicleModel, 'battery'> {
  body: Group;
  /** Battery position inside `body`. */
  battery: Vector3;
  /** Where the boost battery's terminals are, inside `body`; null if none is fitted. */
  terminals: Vector3 | null;
}

/** Small plate in the maker's colour; the only branding there is. */
function badge(root: Group, spec: VehicleSpec, x: number, y: number, z: number): void {
  box(root, 0.13, 0.075, 0.012, 0xf4f4f4, x, y, z);
  box(root, 0.11, 0.055, 0.016, BRAND_COLORS[spec.brand], x, y, z);
}

const SKIN = 0xe8b48c;
const TYRE = 0x1d1d1f;
const STEEL = 0x8d9299;

function wheel(w: WheelSpec, spec: VehicleSpec): WheelModel {
  const pivot = new Group();
  const spin = new Group();
  pivot.add(spin);
  const r = w.radius;
  const axle = (m: Mesh) => (m.rotation.z = Math.PI / 2);
  if (r >= 0.25) {
    // Big push-rim wheel: thin tyre, spoke guard, hub.
    axle(cyl(spin, r, 0.035, TYRE, 0, 0, 0, 14));
    axle(cyl(spin, r * 0.93, 0.02, 0xb8bcc2, 0, 0, 0, 14));
    axle(cyl(spin, r * 0.9, 0.012, STEEL, Math.sign(w.x) * 0.035, 0, 0, 14)); // push rim
    if (spec.addon === 'hubs' || spec.addon === 'joystick') {
      const big = spec.addon === 'hubs' ? 1 : 0.8;
      axle(cyl(spin, r * 0.5 * big, 0.07, spec.colors.accent, 0, 0, 0, 10));
      axle(cyl(spin, r * 0.42 * big, 0.1, spec.colors.hub, 0, 0, 0, 10));
    } else {
      axle(cyl(spin, r * 0.14, 0.09, spec.colors.hub, 0, 0, 0, 6));
    }
    box(spin, 0.04, r * 1.8, 0.03, STEEL);
    box(spin, 0.04, 0.03, r * 1.8, STEEL);
  } else {
    const width = w.caster ? 0.045 : r > 0.15 ? 0.1 : 0.08;
    axle(cyl(spin, r, width, TYRE, 0, 0, 0, 10));
    axle(cyl(spin, r * 0.55, width + 0.02, w.caster ? STEEL : spec.colors.hub, 0, 0, 0, 6));
    // a spoke, so the rolling is visible
    box(spin, width + 0.03, r * 1.5, r * 0.25, w.caster ? STEEL : spec.colors.hub);
  }
  return { pivot, spin };
}

function wheelsFor(root: Group, spec: VehicleSpec): WheelModel[] {
  return spec.wheels.map((w) => {
    const m = wheel(w, spec);
    m.pivot.position.set(w.x, w.y - spec.suspensionRest, w.z);
    root.add(m.pivot);
    return m;
  });
}

interface DriverStyle {
  shirt: number;
  trousers: number;
  hair: number;
  arms: 'rest' | 'forward' | 'rims';
  hat?: number;
  beard?: number;
  scarf?: number;
}

/** A seated blocky person. Origin is the seat surface under the hips. */
function driver(st: DriverStyle): { group: Group; arms: Group[] } {
  const g = new Group();
  const arms: Group[] = [];
  box(g, 0.36, 0.44, 0.24, st.shirt, 0, 0.26, -0.02);
  box(g, 0.22, 0.22, 0.22, SKIN, 0, 0.62, 0);
  box(g, 0.24, 0.08, 0.24, st.hair, 0, 0.75, -0.01);
  box(g, 0.23, 0.05, 0.06, 0x111111, 0, 0.64, 0.1); // sunglasses
  box(g, 0.06, 0.04, 0.03, 0xb85c4a, 0, 0.55, 0.11); // grin
  if (st.hat !== undefined) {
    box(g, 0.25, 0.07, 0.25, st.hat, 0, 0.79, -0.01);
    box(g, 0.22, 0.02, 0.12, st.hat, 0, 0.765, 0.17);
  }
  if (st.beard !== undefined) box(g, 0.2, 0.1, 0.05, st.beard, 0, 0.53, 0.1);
  if (st.scarf !== undefined) {
    box(g, 0.26, 0.07, 0.26, st.scarf, 0, 0.49, 0);
    const tail = box(g, 0.08, 0.05, 0.34, st.scarf, 0.08, 0.5, -0.28);
    tail.rotation.x = 0.25;
  }
  for (const s of [1, -1]) {
    box(g, 0.14, 0.13, 0.42, st.trousers, s * 0.1, 0.06, 0.2);
    box(g, 0.12, 0.38, 0.12, st.trousers, s * 0.1, -0.16, 0.36);
    box(g, 0.13, 0.07, 0.24, 0x2a2a2a, s * 0.1, -0.36, 0.42);
    if (st.arms === 'forward') {
      // Straight from the shoulder to the hand on the bars.
      const sy = 0.43, sz = 0.02, hy = 0.36, hz = 0.44;
      const arm = box(g, 0.1, 0.1, Math.hypot(hy - sy, hz - sz), st.shirt, s * 0.22, (sy + hy) / 2, (sz + hz) / 2);
      arm.rotation.x = Math.atan2(sy - hy, hz - sz);
      box(g, 0.09, 0.09, 0.09, SKIN, s * 0.22, hy, hz);
    } else if (st.arms === 'rims') {
      // Shoulder pivot; the arm hangs down and out to the push rim.
      const shoulder = new Group();
      shoulder.position.set(s * 0.22, 0.44, -0.02);
      shoulder.rotation.z = s * 0.28;
      box(shoulder, 0.1, 0.36, 0.1, st.shirt, 0, -0.16, 0);
      box(shoulder, 0.09, 0.09, 0.09, SKIN, 0, -0.38, 0);
      g.add(shoulder);
      arms.push(shoulder);
    } else {
      // Upper arm down from the shoulder, forearm on the armrest.
      box(g, 0.1, 0.32, 0.1, st.shirt, s * 0.24, 0.32, -0.02);
      box(g, 0.1, 0.09, 0.3, SKIN, s * 0.24, 0.17, 0.12);
    }
  }
  return { group: g, arms };
}

const DRIVERS: Record<VehicleSpec['id'], DriverStyle> = {
  trex: { shirt: 0xe0563a, trousers: 0x3c5a8a, hair: 0xd8d8d8, arms: 'rest' },
  avanti: { shirt: 0x1c1c1f, trousers: 0x2b2b30, hair: 0x3a2a1a, arms: 'rest', hat: 0x1e88e5 },
  orkan: { shirt: 0x5b6b3a, trousers: 0x4a4034, hair: 0x6b4a2b, arms: 'rest', hat: 0xb71c1c, beard: 0x6b4a2b },
  eskalation: { shirt: 0xf2f2f2, trousers: 0x25252a, hair: 0x2a2018, arms: 'rims', hat: 0x7b2d8e },
  enix: { shirt: 0x4a7ab5, trousers: 0x55504a, hair: 0xcfcfcf, arms: 'rest', hat: 0x55504a },
  schubs: { shirt: 0xf0c020, trousers: 0x3c5a8a, hair: 0x8a5a2b, arms: 'rims', hat: 0x9ccc3c },
  ekaptn: { shirt: 0x5a3d2b, trousers: 0x2b2b30, hair: 0x4a3a2a, arms: 'forward', hat: 0x5a3d2b, scarf: 0xf2f2f2 },
  komet: { shirt: 0x3f8f5f, trousers: 0x8a6f4d, hair: 0xf0f0f0, arms: 'forward', hat: 0x8a8068 },
  avantifx: { shirt: 0xf2f2f2, trousers: 0x2b2b30, hair: 0xc9a227, arms: 'rest', hat: 0x29b6f6 },
  arrivo: { shirt: 0x2f2f35, trousers: 0xb9b2a0, hair: 0x1c1c1c, arms: 'rest', scarf: 0x7b2d8e },
  piepmatz: { shirt: 0xf7c8d8, trousers: 0x6a6f80, hair: 0xe9e9e9, arms: 'forward', hat: 0xffd23f },
  tiger: { shirt: 0x7a5a3a, trousers: 0x4a4a52, hair: 0xdadada, arms: 'forward', hat: 0x1a1a1a },
  wagen: { shirt: 0x24457a, trousers: 0x3a3a40, hair: 0xb0b0b0, arms: 'forward', hat: 0x1f3f7a, beard: 0xd0d0d0 },
};

/** Power chair: battery base, shroud in the model's colour, captain's seat. */
function buildPowerchair(spec: VehicleSpec): VehicleModel {
  const root = new Group();
  const { body, accent, seat } = spec.colors;
  const heavy = spec.look === 'heavy';
  const g = groundY(spec);
  const driveX = Math.max(...spec.wheels.filter((w) => w.drive).map((w) => Math.abs(w.x)));
  const baseW = (driveX - 0.07) * 2;
  const seatY = heavy ? 0.12 : 0.06;

  if (spec.look === 'mid') {
    box(root, baseW, 0.2, 0.6, body, 0, -0.1, 0);
    box(root, baseW - 0.04, 0.14, 0.04, accent, 0, -0.08, 0.31); // front panel
    box(root, baseW - 0.04, 0.14, 0.04, accent, 0, -0.08, -0.31);
    for (const s of [1, -1]) {
      box(root, 0.11, 0.05, 0.44, accent, s * driveX, g + 0.37, 0); // fender over the drive wheel
      for (const z of [0.34, -0.34]) box(root, 0.05, 0.05, 0.22, body, s * 0.22, g + 0.2, z); // caster arms
    }
  } else if (heavy) {
    box(root, baseW, 0.24, 0.8, body, 0, -0.1, -0.06);
    box(root, baseW - 0.06, 0.05, 0.5, 0x1a1b1e, 0, 0.045, -0.2); // battery lid, flush with the base
    box(root, baseW - 0.1, 0.04, 0.02, 0xff2a2a, 0, -0.02, -0.465); // tail light
    box(root, baseW + 0.2, 0.05, 0.05, STEEL, 0, -0.16, 0.38); // bumper
    for (const s of [1, -1]) {
      box(root, 0.13, 0.05, 0.5, accent, s * driveX, g + 0.43, -0.28); // fender over the drive wheel
      box(root, 0.02, 0.16, 0.44, accent, s * (baseW / 2 + 0.005), -0.06, 0.12); // side panel
      box(root, 0.07, 0.2, 0.07, STEEL, s * 0.27, g + 0.26, 0.42); // caster fork
      box(root, 0.07, 0.05, 0.05, 0xfff3b0, s * 0.18, -0.02, 0.35); // headlights
    }
  } else {
    // Same sleek base for both; front-wheel drive carries it at the other end.
    const d = spec.look === 'front' ? -1 : 1;
    const baseZ = -0.1 * d;
    box(root, baseW, 0.18, 0.64, body, 0, -0.1, baseZ);
    box(root, baseW - 0.1, 0.03, 0.02, 0xff2a2a, 0, -0.06, baseZ - 0.325); // tail light strip
    for (const s of [1, -1]) {
      box(root, 0.02, 0.035, 0.6, accent, s * (baseW / 2 + 0.005), -0.05, baseZ); // accent line
      box(root, 0.05, 0.05, 0.34, body, s * 0.24, g + 0.22, 0.26 * d); // caster arms
      box(root, 0.05, 0.03, 0.03, 0xdff3ff, s * 0.14, -0.07, baseZ + 0.325); // LED lights
      if (d < 0) box(root, 0.11, 0.05, 0.4, accent, s * driveX, g + 0.37, 0.25); // fender over the front drive wheel
    }
  }

  // Seat
  box(root, 0.46, 0.08, 0.46, seat, 0, seatY, -0.02);
  box(root, 0.46, 0.56, 0.08, seat, 0, seatY + 0.32, -0.27);
  box(root, 0.22, 0.14, 0.07, seat, 0, seatY + 0.7, -0.27); // headrest
  if (spec.look === 'rear' || spec.look === 'front') box(root, 0.3, 0.4, 0.02, accent, 0, seatY + 0.34, -0.315); // back panel
  for (const s of [1, -1]) {
    box(root, 0.06, 0.05, 0.38, seat, s * 0.27, seatY + 0.21, -0.04);
    box(root, 0.04, 0.2, 0.04, body, s * 0.27, seatY + 0.1, -0.18);
    box(root, 0.04, 0.3, 0.04, body, s * 0.21, seatY + 0.66, -0.31); // push handles
    box(root, 0.04, 0.04, 0.14, accent, s * 0.21, seatY + 0.8, -0.36);
    box(root, 0.16, 0.03, 0.2, body, s * 0.11, g + 0.07, 0.5); // footrests
    box(root, 0.03, seatY - g - 0.1, 0.03, body, s * 0.11, (seatY + g) / 2, 0.42);
  }
  // joystick on the right armrest (right is -X)
  box(root, 0.08, 0.05, 0.1, body, -0.27, seatY + 0.23, 0.19);
  cyl(root, 0.012, 0.09, STEEL, -0.27, seatY + 0.29, 0.19, 5);
  box(root, 0.04, 0.04, 0.04, accent, -0.27, seatY + 0.34, 0.19);

  badge(root, spec, 0, seatY + 0.7, -0.31);

  const d = driver(DRIVERS[spec.id]);
  d.group.position.set(0, seatY + 0.04, -0.14);
  root.add(d.group);
  const baseZ = spec.look === 'mid' ? 0 : heavy ? -0.06 : spec.look === 'front' ? 0.1 : -0.1;
  return {
    root, wheels: wheelsFor(root, spec), driver: d.group, arms: d.arms,
    battery: [0, -0.08, baseZ],
  };
}

/** Folding manual chair with one of the add-on drives. */
function buildManual(spec: VehicleSpec): VehicleModel {
  const root = new Group();
  const { body, accent, seat } = spec.colors;
  const g = groundY(spec);
  const big = spec.wheels.find((w) => w.radius >= 0.25)!;
  const axleZ = big.z;
  const axleY = g + big.radius;
  const seatY = 0.08;
  const seatZ = axleZ + 0.14;

  box(root, 0.42, 0.04, 0.42, seat, 0, seatY, seatZ);
  // (behind the driver's back, not in it: coinciding faces flicker)
  box(root, 0.42, 0.4, 0.04, seat, 0, seatY + 0.24, seatZ - 0.27);
  box(root, 0.56, 0.035, 0.035, STEEL, 0, axleY, axleZ); // axle tube
  for (const s of [1, -1]) {
    box(root, 0.03, 0.03, 0.46, accent, s * 0.2, seatY - 0.03, seatZ); // seat rail
    box(root, 0.03, seatY - axleY, 0.03, body, s * 0.2, (seatY + axleY) / 2, axleZ);
    const down = box(root, 0.03, 0.46, 0.03, accent, s * 0.17, seatY - 0.22, seatZ + 0.3); // front tube
    down.rotation.x = 0.35;
    box(root, 0.03, 0.5, 0.03, body, s * 0.2, seatY + 0.3, seatZ - 0.27); // back tube
    box(root, 0.03, 0.03, 0.12, 0x111111, s * 0.2, seatY + 0.54, seatZ - 0.28); // push handle
    box(root, 0.02, 0.16, 0.26, 0x1b1b1f, s * 0.225, seatY + 0.1, seatZ - 0.02); // side guard
  }
  box(root, 0.32, 0.02, 0.14, body, 0, g + 0.09, seatZ + 0.42); // footplate

  if (spec.addon === 'joystick') {
    box(root, 0.3, 0.1, 0.22, 0x1a1a1d, 0, seatY - 0.09, seatZ); // battery pack under the seat
    box(root, 0.305, 0.02, 0.225, accent, 0, seatY - 0.05, seatZ);
    for (const s of [1, -1]) box(root, 0.05, 0.03, 0.3, seat, s * 0.24, seatY + 0.2, seatZ); // armrest pads
    // joystick on the right armrest (right is -X)
    box(root, 0.07, 0.04, 0.09, 0x1a1a1d, -0.24, seatY + 0.22, seatZ + 0.19);
    cyl(root, 0.011, 0.08, STEEL, -0.24, seatY + 0.28, seatZ + 0.19, 5);
    box(root, 0.035, 0.035, 0.035, accent, -0.24, seatY + 0.33, seatZ + 0.19);
    // attendant control on the left push handle
    box(root, 0.06, 0.05, 0.08, 0x1a1a1d, 0.2, seatY + 0.58, seatZ - 0.32);
    box(root, 0.03, 0.03, 0.03, accent, 0.2, seatY + 0.62, seatZ - 0.32);
  }
  if (spec.addon === 'pusher') {
    // Drive unit hanging under the axle, with the little wheel trailing behind.
    const unit = spec.wheels.find((w) => w.drive)!;
    box(root, 0.11, 0.13, 0.24, 0x1a1a1d, 0, g + 0.2, unit.z + 0.06);
    box(root, 0.115, 0.03, 0.1, accent, 0, g + 0.25, unit.z + 0.06);
    const link = box(root, 0.04, 0.04, 0.3, STEEL, 0, (axleY + g + 0.2) / 2, (axleZ + unit.z) / 2 + 0.03);
    link.rotation.x = -0.5;
    box(root, 0.05, 0.04, 0.06, accent, -0.23, seatY + 0.2, seatZ + 0.16); // control dial
  }
  if (spec.addon === 'tractor') {
    const front = spec.wheels.find((w) => w.steer)!;
    // The driver's hands: the bars have to end exactly there.
    const handY = seatY + 0.38;
    const handZ = seatZ + 0.34;
    const topY = handY + 0.02;
    const topZ = front.z - 0.34;
    const hubY = g + front.radius;
    // fork and steering column, raked back towards the rider
    const col = box(root, 0.06, 0.95, 0.06, 0x1a1a1d, 0, (topY + hubY) / 2, (topZ + front.z) / 2);
    col.rotation.x = -Math.atan2(front.z - topZ, topY - hubY);
    for (const s of [1, -1]) box(root, 0.025, front.radius * 1.3, 0.04, STEEL, s * 0.06, hubY + front.radius * 0.5, front.z - 0.03);
    box(root, 0.48, 0.04, 0.04, 0x1a1a1d, 0, topY, topZ); // handlebar, swept back to the rider
    for (const s of [1, -1]) {
      box(root, 0.04, 0.04, topZ - handZ + 0.04, 0x1a1a1d, s * 0.22, (topY + handY) / 2, (topZ + handZ) / 2);
      box(root, 0.055, 0.055, 0.12, 0x111111, s * 0.22, handY, handZ); // grips
    }
    box(root, 0.14, 0.09, 0.03, 0x111111, 0, topY + 0.06, topZ + 0.02); // display
    box(root, 0.1, 0.02, 0.01, accent, 0, topY + 0.06, topZ + 0.005);
    box(root, 0.12, 0.3, 0.1, 0x25252a, 0, hubY + 0.42, front.z - 0.14); // battery
    box(root, 0.125, 0.04, 0.105, accent, 0, hubY + 0.5, front.z - 0.14);
    box(root, 0.08, 0.06, 0.04, 0xfff3b0, 0, hubY + 0.3, front.z + 0.06); // headlight
    box(root, 0.2, 0.03, 0.26, 0x1a1a1d, 0, hubY + front.radius + 0.04, front.z); // mudguard
    // clamp bars to the chair frame; the chair's own casters hang in the air
    for (const s of [1, -1]) {
      const bar = box(root, 0.03, 0.03, 0.5, STEEL, s * 0.1, g + 0.3, seatZ + 0.42);
      bar.rotation.y = s * -0.2;
      const c = cyl(root, 0.06, 0.04, TYRE, s * 0.2, g + 0.13, seatZ + 0.36, 8);
      c.rotation.z = Math.PI / 2;
      box(root, 0.03, 0.12, 0.03, STEEL, s * 0.2, g + 0.2, seatZ + 0.36);
    }
  } else {
    for (const w of spec.wheels) if (w.caster) box(root, 0.03, 0.14, 0.03, STEEL, w.x, g + w.radius + 0.1, w.z); // caster forks
  }

  badge(root, spec, 0, seatY + 0.32, seatZ - 0.295);

  const d = driver(DRIVERS[spec.id]);
  d.group.position.set(0, seatY + 0.02, seatZ - 0.1);
  root.add(d.group);
  const drive = spec.wheels.find((w) => w.drive)!;
  const battery: [number, number, number] =
    spec.addon === 'tractor' ? [0, g + drive.radius + 0.42, drive.z - 0.14]
    : spec.addon === 'pusher' ? [0, g + 0.2, drive.z + 0.06]
    : [0, seatY - 0.09, seatZ];
  return {
    root, wheels: wheelsFor(root, spec), driver: d.group, arms: d.arms,
    battery,
  };
}

function buildScooter(spec: VehicleSpec): VehicleModel {
  const root = new Group();
  const BODY = spec.colors.body;
  const DARK = spec.colors.seat;
  // All four scooters share one shape, stretched to the chassis size.
  const sx = spec.half[0] / 0.28;
  const L = spec.half[2];
  const w = 0.5 * sx;
  box(root, w, 0.07, L * 1.92, DARK, 0, -0.14, 0); // deck
  box(root, w + 0.02, 0.22, L * 0.7, BODY, 0, -0.02, -L * 0.63); // rear cover
  box(root, w * 0.8, 0.2, 0.22, BODY, 0, -0.04, L - 0.1); // front fairing
  box(root, 0.12, 0.06, 0.02, 0xfff3b0, 0, 0, L + 0.015); // headlight
  // Tiller raked back so the handlebar ends up in the driver's hands.
  const footZ = L - 0.18;
  const barZ = footZ - 0.3;
  const barY = 0.7;
  const tiller = box(root, 0.06, 0.82, 0.06, 0x888888, 0, 0.33, (footZ + barZ) / 2);
  tiller.rotation.x = -0.38;
  box(root, 0.5, 0.05, 0.05, DARK, 0, barY, barZ);
  box(root, 0.16, 0.1, 0.08, BODY, 0, barY + 0.03, barZ + 0.02);
  // shopping basket
  box(root, 0.36 * sx, 0.2, 0.24, 0x9aa0a8, 0, 0.17, L - 0.1); // sits on the front fairing
  box(root, 0.3 * sx, 0.02, 0.18, 0x3a3d42, 0, 0.275, L - 0.1);
  // seat under the driver
  const seatZ = barZ - 0.4;
  cyl(root, 0.035, 0.22, 0x888888, 0, 0.18, seatZ, 6);
  box(root, 0.44, 0.08, 0.42, DARK, 0, 0.32, seatZ);
  box(root, 0.44, 0.44, 0.08, DARK, 0, 0.56, seatZ - 0.2);
  badge(root, spec, 0, 0, -L * 0.98 - 0.006);

  const d = driver(DRIVERS[spec.id]);
  d.group.position.set(0, 0.36, seatZ - 0.06);
  root.add(d.group);
  return {
    root, wheels: wheelsFor(root, spec), driver: d.group, arms: d.arms,
    battery: [0, -0.02, -L * 0.63],
  };
}

/** Slim folding power chair: carbon side frames instead of a battery base. */
function buildFolder(spec: VehicleSpec): VehicleModel {
  const root = new Group();
  const { body, accent, seat } = spec.colors;
  const g = groundY(spec);
  const drive = spec.wheels.find((w) => w.drive)!;
  const axleY = g + drive.radius;
  const seatY = 0.06;
  box(root, 0.42, 0.04, 0.42, seat, 0, seatY, 0);
  box(root, 0.42, 0.46, 0.035, seat, 0, seatY + 0.27, -0.27);
  box(root, 0.3, 0.08, 0.2, 0x25252a, 0, seatY - 0.08, -0.04); // battery under the seat
  box(root, 0.305, 0.02, 0.205, accent, 0, seatY - 0.045, -0.04);
  for (const s of [1, -1]) {
    // one swooping side frame from the rear hub to the front caster
    const rear = box(root, 0.035, 0.05, 0.4, body, s * 0.22, (seatY + axleY) / 2 - 0.02, -0.12);
    rear.rotation.x = -0.75;
    const front = box(root, 0.035, 0.05, 0.5, body, s * 0.22, (seatY + g) / 2 + 0.06, 0.2);
    front.rotation.x = 0.7;
    box(root, 0.035, 0.035, 0.44, body, s * 0.22, seatY - 0.02, 0); // seat rail
    box(root, 0.012, 0.02, 0.44, accent, s * 0.24, seatY - 0.02, 0); // pinstripe
    box(root, 0.035, 0.52, 0.035, body, s * 0.22, seatY + 0.28, -0.27); // back tube
    box(root, 0.035, 0.035, 0.12, 0x111111, s * 0.22, seatY + 0.54, -0.29); // push handle
    box(root, 0.05, 0.035, 0.32, seat, s * 0.25, seatY + 0.2, 0); // armrest
    box(root, 0.03, 0.2, 0.03, body, s * 0.25, seatY + 0.1, -0.14);
  }
  box(root, 0.34, 0.02, 0.16, body, 0, g + 0.08, 0.44); // one-piece footplate
  for (const w of spec.wheels) if (w.caster) box(root, 0.03, 0.12, 0.03, STEEL, w.x, g + w.radius + 0.09, w.z);
  // joystick on the right armrest (right is -X)
  box(root, 0.07, 0.04, 0.09, body, -0.25, seatY + 0.22, 0.2);
  cyl(root, 0.011, 0.08, STEEL, -0.25, seatY + 0.28, 0.2, 5);
  box(root, 0.035, 0.035, 0.035, accent, -0.25, seatY + 0.33, 0.2);

  badge(root, spec, 0, seatY + 0.32, -0.293);

  const d = driver(DRIVERS[spec.id]);
  d.group.position.set(0, seatY + 0.02, -0.1);
  root.add(d.group);
  return {
    root, wheels: wheelsFor(root, spec), driver: d.group, arms: d.arms,
    battery: [0, seatY - 0.08, -0.04],
  };
}

function buildModel(spec: VehicleSpec): VehicleModel {
  if (spec.look === 'scooter') return buildScooter(spec);
  if (spec.look === 'folder') return buildFolder(spec);
  if (spec.look === 'manual') return buildManual(spec);
  return buildPowerchair(spec);
}

const ROD_AXIS = new Vector3(0, 0, 1);

/** A thin bar from `a` to `b`. */
function rod(parent: Object3D, a: Vector3, b: Vector3, thick: number, color: number): void {
  const m = box(parent, thick, thick, a.distanceTo(b), color);
  m.position.copy(a).add(b).multiplyScalar(0.5);
  m.quaternion.copy(new Quaternion().setFromUnitVectors(ROD_AXIS, b.clone().sub(a).normalize()));
}

/**
 * The boost battery: a car battery on the driver's lap, jump leads down to the chair.
 * It is part of the driver, so it leans along in corners.
 * @param to where the chair's own battery is, in the driver's space
 * @returns where the terminals are, in the driver's space
 */
function lapBattery(driver: Group, to: Vector3): Vector3 {
  const y = 0.225, z = 0.21;
  box(driver, 0.3, 0.2, 0.19, 0x1b1d22, 0, y, z);
  box(driver, 0.31, 0.03, 0.2, 0x2c3038, 0, y + 0.085, z); // lid
  box(driver, 0.24, 0.07, 0.006, 0xf2c230, 0, y - 0.01, z + 0.096); // label
  box(driver, 0.1, 0.02, 0.008, 0x1b1d22, 0, y - 0.01, z + 0.097);
  for (let i = -2; i <= 2; i++) box(driver, 0.025, 0.012, 0.025, 0xd9a400, i * 0.045, y + 0.104, z - 0.04); // filler caps
  const top = y + 0.1;
  for (const [x, color] of [[0.1, 0xc62828], [-0.1, 0x111111]] as const) {
    cyl(driver, 0.018, 0.04, 0xb9bec6, x, top + 0.02, z + 0.04, 6); // terminal post
    box(driver, 0.05, 0.03, 0.06, color, x, top + 0.035, z + 0.05); // clamp
    // lead: out to the side, then down past the knee to the chair
    const a = new Vector3(x, top + 0.035, z + 0.05);
    const b = new Vector3(x * 2.4, y - 0.05, z - 0.02);
    const c = new Vector3(to.x + Math.sign(x) * 0.12, to.y + 0.03, to.z);
    rod(driver, a, b, 0.02, color);
    rod(driver, b, c, 0.02, color);
  }
  return new Vector3(0, top + 0.04, z + 0.04);
}

/** @param boost put the boost battery on the driver's lap */
export function buildVehicle(spec: VehicleSpec, boost = false): VehicleRig {
  const m = buildModel(spec);
  const seat = m.driver.position.clone();
  // (the driver sits unrotated in the model, so its space is just shifted)
  const terminals = boost ? lapBattery(m.driver, new Vector3(...m.battery).sub(seat)).add(seat) : null;
  // Everything except the wheels goes into one group that pivots near axle height.
  const body = new Group();
  const pivotY = groundY(spec) + 0.15;
  body.position.y = pivotY;
  const wheelPivots = new Set<unknown>(m.wheels.map((w) => w.pivot));
  for (const child of [...m.root.children]) {
    if (wheelPivots.has(child)) continue;
    child.position.y -= pivotY;
    body.add(child);
  }
  m.root.add(body);
  terminals?.setY(terminals.y - pivotY);
  const battery = new Vector3(m.battery[0], m.battery[1] - pivotY, m.battery[2]);
  return { root: m.root, wheels: m.wheels, driver: m.driver, arms: m.arms, body, battery, terminals };
}

/** A blocky car or van. The origin is the centre of its collider. */
export function buildTraffic(def: TrafficDef): Group {
  const g = new Group();
  const [hx, hy, hz] = TRAFFIC_SHAPES[def.type].half;
  const floor = -hy;
  const GLASS = 0x26323d;
  const r = 0.32;
  if (def.type === 'van') {
    box(g, hx * 2, hy * 2 - 0.45, hz * 2 - 1.0, def.color, 0, 0.2, -0.5); // load space
    box(g, hx * 2, 0.75, 1.0, def.color, 0, floor + 0.3 + 0.375, hz - 0.5); // bonnet
    box(g, hx * 2 - 0.1, 0.7, 0.9, GLASS, 0, floor + 1.35, hz - 0.95); // cab glass
    box(g, hx * 2, 0.08, 0.95, def.color, 0, floor + 1.74, hz - 0.95);
    box(g, hx * 2 + 0.01, 0.5, 1.6, 0xc22a2a, 0, 0.3, -0.6); // a stripe, not a logo
  } else {
    box(g, hx * 2, 0.6, hz * 2, def.color, 0, floor + 0.55, 0);
    box(g, hx * 2 - 0.16, 0.5, hz * 1.05, GLASS, 0, floor + 1.1, -0.2); // windows
    box(g, hx * 2 - 0.14, 0.06, hz * 1.0, def.color, 0, floor + 1.37, -0.2); // roof
  }
  for (const s of [1, -1]) {
    for (const z of [hz - 0.75, -hz + 0.75]) {
      const w = cyl(g, r, 0.22, TYRE, s * (hx - 0.08), floor + r - 0.02, z, 10);
      w.rotation.z = Math.PI / 2;
      const hub = cyl(g, r * 0.5, 0.24, 0xb8bcc2, s * (hx - 0.08), floor + r - 0.02, z, 6);
      hub.rotation.z = Math.PI / 2;
    }
    box(g, 0.3, 0.14, 0.05, 0xfff3b0, s * (hx - 0.3), floor + 0.65, hz + 0.01); // headlights
    box(g, 0.3, 0.12, 0.05, 0xff2a2a, s * (hx - 0.3), floor + 0.7, -hz - 0.01); // tail lights
  }
  box(g, hx * 2 + 0.06, 0.14, 0.12, 0x2a2a2e, 0, floor + 0.32, hz + 0.02); // bumpers
  box(g, hx * 2 + 0.06, 0.14, 0.12, 0x2a2a2e, 0, floor + 0.32, -hz - 0.02);
  return g;
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
