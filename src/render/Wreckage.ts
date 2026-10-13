import { BoxGeometry, CylinderGeometry, Mesh, type Object3D, type Scene, Vector3 } from 'three';
import type { Vehicle } from '../sim/Vehicle';
import type { VehicleRig } from './models';

interface Piece {
  obj: Object3D;
  v: Vector3;
  /** Tumbling: axis times rate in rad/s. */
  spin: Vector3;
  /** How far its middle stays above the ground when it lies there. */
  rest: number;
  still: boolean;
}

const GRAVITY = 9.81;
/** How many of the biggest parts stay on the heap for the driver to sit on. */
const KEEP = 3;
const tmp = new Vector3();

/** Rough size of a part, for deciding what goes first and how it comes to lie. */
function size(m: Mesh): [number, number, number] {
  const g = m.geometry;
  if (g instanceof BoxGeometry) return [g.parameters.width, g.parameters.height, g.parameters.depth];
  if (g instanceof CylinderGeometry) return [g.parameters.radiusTop * 2, g.parameters.height, g.parameters.radiusTop * 2];
  return [0.1, 0.1, 0.1];
}

/**
 * Crash damage you can see: the more battered the vehicle, the more of it has come off and
 * lies about. Looks only; what the damage does to the driving is the sim's business.
 */
export class Wreckage {
  private readonly pieces: Piece[] = [];
  /** Body parts in the order they come off: the small and outlying bits first. */
  private readonly parts: Mesh[];
  /** What is left on the heap at the very end. */
  private readonly core: Mesh[];
  private shed = 0;
  private readonly looseWheels = new Set<number>();
  private wrecked = false;
  /** How far the heap has sunk onto the ground, 0…1. */
  sunk = 0;

  constructor(
    private readonly scene: Scene,
    private readonly rig: VehicleRig,
    private readonly ground: (x: number, z: number) => number,
  ) {
    const meshes = rig.body.children.filter((c): c is Mesh => c instanceof Mesh);
    const volume = (m: Mesh) => size(m).reduce((a, b) => a * b, 1);
    const byVolume = [...meshes].sort((a, b) => volume(b) - volume(a));
    this.core = byVolume.slice(0, KEEP);
    // far from the middle and small goes first
    const score = (m: Mesh) => m.position.length() - Math.cbrt(volume(m)) * 1.5;
    this.parts = byVolume.slice(KEEP).sort((a, b) => score(b) - score(a));
  }

  /** Whether wheel `i` has come off, so nobody moves it any more. */
  loose(i: number): boolean {
    return this.looseWheels.has(i);
  }

  private drop(obj: Object3D, from: Vector3, speed: Vector3, burst: number, rest: number): void {
    // keep it where it is in the world, but no longer part of the vehicle
    this.scene.attach(obj);
    const out = tmp.copy(obj.position).sub(from).setY(0);
    if (out.lengthSq() < 1e-4) out.set(Math.random() - 0.5, 0, Math.random() - 0.5);
    out.normalize();
    const v = speed.clone().multiplyScalar(0.7).addScaledVector(out, burst * (0.5 + Math.random()));
    v.y += burst * (0.6 + Math.random() * 0.8);
    this.pieces.push({
      obj, v, rest, still: false,
      spin: new Vector3(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).multiplyScalar(4 + burst * 3),
    });
  }

  update(v: Vehicle, dt: number): void {
    const at = this.rig.root.position;
    const lv = v.body.linvel();
    const speed = tmp.set(lv.x, lv.y, lv.z).clone();

    // parts come off one by one as the damage grows; at the end all the rest at once
    const want = v.wrecked ? this.parts.length : Math.floor(Math.min(v.damage, 0.99) * this.parts.length);
    while (this.shed < want) {
      const part = this.parts[this.shed++];
      const s = size(part);
      this.drop(part, at, speed, v.wrecked ? 4 : 1.8, Math.min(...s) / 2);
    }
    const wheels = this.rig.wheels;
    wheels.forEach((w, i) => {
      if (this.looseWheels.has(i) || !(v.wrecked || v.lostWheel === i)) return;
      this.looseWheels.add(i);
      this.drop(w.pivot, at, speed, v.wrecked ? 4 : 2.5, 0.05);
    });
    if (v.wrecked && !this.wrecked) {
      this.wrecked = true;
      // what is left settles as a heap, a bit askew
      this.core.forEach((m, i) => {
        m.rotation.z += (i % 2 ? 1 : -1) * 0.12;
        m.rotation.x += 0.06 * (i - 1);
      });
    }
    if (this.wrecked) this.sunk = Math.min(1, this.sunk + dt * 4);

    const h = Math.min(dt, 0.05);
    for (const p of this.pieces) {
      if (p.still) continue;
      p.v.y -= GRAVITY * h;
      p.obj.position.addScaledVector(p.v, h);
      p.obj.rotateOnWorldAxis(tmp.copy(p.spin).normalize(), p.spin.length() * h);
      const floor = this.ground(p.obj.position.x, p.obj.position.z) + p.rest;
      if (p.obj.position.y > floor) continue;
      p.obj.position.y = floor;
      // bounce, and lose most of it
      if (p.v.y < -1.2) p.v.y *= -0.3;
      else p.v.y = 0;
      p.v.x *= 0.6;
      p.v.z *= 0.6;
      p.spin.multiplyScalar(0.5);
      if (p.v.lengthSq() < 0.05) p.still = true;
    }
  }

  /** Clear the debris away. The vehicle model itself is rebuilt by whoever owns it. */
  dispose(): void {
    for (const p of this.pieces) {
      this.scene.remove(p.obj);
      p.obj.traverse((o) => {
        if (o instanceof Mesh) o.geometry.dispose();
      });
    }
    this.pieces.length = 0;
  }
}
