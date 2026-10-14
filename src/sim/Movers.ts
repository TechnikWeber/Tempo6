import RAPIER from '@dimforge/rapier3d-compat';
import type { MoverDef } from './Track';
import { Tracked } from './Tracked';

/** How hard a seesaw tips towards the end the vehicle stands on, in rad/s² at the very end. */
const TIP = 9;
/** And how much it is held back, per second. */
const TIP_DAMPING = 5;
/**
 * A counterweight under the way in, in rad/s²: empty, it tips back for the next lap, and
 * loaded it only goes over once the vehicle is a little past the middle.
 */
const COUNTERWEIGHT = 0.6;

/**
 * A moving plank. It is a kinematic body driven by velocity, like the turning disc, so the
 * vehicle standing on it reads off how it moves and is carried along.
 */
export class Mover {
  readonly tracked: Tracked;
  /** Tilt in rad: a seesaw's +Z end down, a rocker's left side up. */
  angle = 0;
  private rate = 0;
  private time = 0;
  /** The axis it turns about, in the world. */
  private readonly axis: { x: number; y: number; z: number };

  constructor(world: RAPIER.World, readonly def: MoverDef) {
    const body = world.createRigidBody(RAPIER.RigidBodyDesc.kinematicVelocityBased());
    if (def.type === 'propeller') {
      // blades round the hub, each reaching out from it
      const n = def.blades ?? 2;
      for (let k = 0; k < n; k++) {
        const a = (2 * Math.PI * k) / n;
        world.createCollider(
          RAPIER.ColliderDesc.cuboid(...def.half)
            .setTranslation(Math.sin(a) * def.half[1], -Math.cos(a) * def.half[1], 0)
            .setRotation({ x: 0, y: 0, z: Math.sin(a / 2), w: Math.cos(a / 2) })
            .setFriction(0.5),
          body,
        );
      }
    } else {
      world.createCollider(RAPIER.ColliderDesc.cuboid(...def.half).setTranslation(0, -def.half[1], 0).setFriction(0.9), body);
    }
    this.tracked = new Tracked(body);
    const s = Math.sin(def.yaw), c = Math.cos(def.yaw);
    // a seesaw pitches about its own X axis, a rocker and a propeller turn about their own Z axis
    this.axis = def.type === 'seesaw' ? { x: c, y: 0, z: -s } : { x: s, y: 0, z: c };
    this.reset();
  }

  reset(): void {
    this.angle = this.def.type === 'seesaw' ? -this.def.angle : 0;
    this.rate = 0;
    this.time = 0;
    const b = this.tracked.body;
    b.setTranslation({ x: this.def.pos[0], y: this.def.pos[1], z: this.def.pos[2] }, true);
    b.setRotation(this.rotation(this.angle), true);
    b.setAngvel({ x: 0, y: 0, z: 0 }, true);
    this.tracked.teleport();
  }

  /** @param at where the vehicle is, and whether it stands on this plank */
  update(dt: number, at: { x: number; y: number; z: number }, onIt: boolean): void {
    const d = this.def;
    if (d.type === 'propeller') {
      // just round and round, whatever is in the way
      const w = d.spin ?? 3;
      this.angle += w * dt;
      this.tracked.body.setAngvel({ x: this.axis.x * w, y: 0, z: this.axis.z * w }, true);
      return;
    }
    let next: number;
    if (d.type === 'seesaw') {
      // Weight past the middle tips it; the further out, the harder.
      const s = (at.x - d.pos[0]) * Math.sin(d.yaw) + (at.z - d.pos[2]) * Math.cos(d.yaw);
      const push = (onIt ? (TIP * s) / d.half[2] : 0) - COUNTERWEIGHT;
      this.rate += (push - this.rate * TIP_DAMPING) * dt;
      next = this.angle + this.rate * dt;
      if (Math.abs(next) >= d.angle) {
        next = Math.sign(next) * d.angle;
        this.rate = 0;
      }
    } else {
      this.time += dt;
      next = d.angle * Math.sin((2 * Math.PI * this.time) / (d.period ?? 4));
    }
    // Steer the body onto the new angle from where it actually is, so nothing drifts.
    const w = (next - this.measured()) / dt;
    this.angle = next;
    this.tracked.body.setAngvel({ x: this.axis.x * w, y: 0, z: this.axis.z * w }, true);
  }

  /** Whether a point is above the plank (in plan view) and close to its top. */
  holds(at: { x: number; y: number; z: number }, reach: number): boolean {
    const d = this.def;
    const dx = at.x - d.pos[0], dz = at.z - d.pos[2];
    const s = dx * Math.sin(d.yaw) + dz * Math.cos(d.yaw);
    const l = dx * Math.cos(d.yaw) - dz * Math.sin(d.yaw);
    if (Math.abs(s) > d.half[2] || Math.abs(l) > d.half[0] + 0.2) return false;
    const top = d.type === 'seesaw' ? d.pos[1] - s * Math.sin(this.angle) : d.pos[1] + l * Math.sin(this.angle);
    return at.y > top - 0.2 && at.y < top + reach;
  }

  /** Tilt of the body as it stands, read back from its rotation. */
  private measured(): number {
    const r = this.tracked.body.rotation();
    // undo the heading, then read pitch or roll off what is left
    const sy = Math.sin(this.def.yaw / 2), cy = Math.cos(this.def.yaw / 2);
    // q_local = q_yaw⁻¹ · r
    const x = cy * r.x - sy * r.z;
    const z = cy * r.z + sy * r.x;
    const w = cy * r.w + sy * r.y;
    return 2 * Math.atan2(this.def.type === 'seesaw' ? x : z, w);
  }

  private rotation(angle: number): { x: number; y: number; z: number; w: number } {
    const sy = Math.sin(this.def.yaw / 2), cy = Math.cos(this.def.yaw / 2);
    const sa = Math.sin(angle / 2), ca = Math.cos(angle / 2);
    // heading about Y, then the tilt about the local X (seesaw) or Z (rocker) axis
    return this.def.type === 'seesaw' ? { x: cy * sa, y: sy * ca, z: -sy * sa, w: cy * ca } : { x: sy * sa, y: sy * ca, z: cy * sa, w: cy * ca };
  }
}
