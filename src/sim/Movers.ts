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
/** Catapult: seconds something has to stand on it before it lets go, it stays up, and the rate it comes back down at (rad/s). */
const CATAPULT = { load: 0.5, hold: 1.2, back: 0.8 };

/**
 * A moving plank. It is a kinematic body driven by velocity, like the turning disc, so the
 * vehicle standing on it reads off how it moves and is carried along.
 */
export class Mover {
  readonly tracked: Tracked;
  /** Tilt in rad: a seesaw's +Z end down, a rocker's left side up; how far a drum has turned. */
  angle = 0;
  /** How far a slider is out to its right (+X of its heading) from its middle. */
  offset = 0;
  private rate = 0;
  private time = 0;
  /** Where a catapult is in its throw. */
  private stage: 'armed' | 'snap' | 'hold' | 'back' = 'armed';
  /**
   * The velocity a catapult gives whatever stands on it, in the step it lets go; null in every
   * other step. (Its springs would swallow most of the blow if the board had to deliver it.)
   */
  fling: { x: number; y: number; z: number } | null = null;
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
    } else if (def.type === 'drum') {
      // slats all the way round, their inner faces at the radius, the first one at the bottom
      const n = def.blades ?? 32, r = def.radius ?? 3, t = def.half[1];
      for (const [a, x, y, half] of drumSlats(r, t, n)) {
        world.createCollider(
          RAPIER.ColliderDesc.cuboid(half, t, def.half[2])
            .setTranslation(x, y, 0)
            .setRotation({ x: 0, y: 0, z: Math.sin(a / 2), w: Math.cos(a / 2) })
            .setFriction(0.9),
          body,
        );
      }
    } else {
      // (a catapult's body sits on its hinge, the board reaching back from there)
      const back = def.type === 'catapult' ? -def.half[2] : 0;
      world.createCollider(RAPIER.ColliderDesc.cuboid(...def.half).setTranslation(0, -def.half[1], back).setFriction(0.9), body);
    }
    this.tracked = new Tracked(body);
    const s = Math.sin(def.yaw), c = Math.cos(def.yaw);
    // a seesaw and a catapult pitch about their own X axis, a rocker and a propeller turn about their own Z axis
    this.axis = this.pitches ? { x: c, y: 0, z: -s } : { x: s, y: 0, z: c };
    this.reset();
  }

  /** Whether it tips about its own X axis (along its length) rather than rolling about Z. */
  private get pitches(): boolean {
    return this.def.type === 'seesaw' || this.def.type === 'catapult';
  }

  reset(): void {
    this.angle = this.def.type === 'seesaw' ? -this.def.angle : 0;
    this.rate = 0;
    this.time = 0;
    this.stage = 'armed';
    this.fling = null;
    this.offset = this.slide(0);
    const b = this.tracked.body;
    const [x, y, z] = this.at(this.offset);
    b.setTranslation({ x, y, z }, true);
    b.setRotation(this.rotation(this.angle), true);
    b.setAngvel({ x: 0, y: 0, z: 0 }, true);
    b.setLinvel({ x: 0, y: 0, z: 0 }, true);
    this.tracked.teleport();
  }

  /** @param at where the vehicle is, and whether it stands on this plank */
  update(dt: number, at: { x: number; y: number; z: number }, onIt: boolean): void {
    const d = this.def;
    if (d.type === 'slider') {
      // Steer it onto where it should be next from where it actually is, so nothing drifts.
      this.time += dt;
      this.offset = this.slide(this.time);
      const [x, y, z] = this.at(this.offset);
      const p = this.tracked.body.translation();
      this.tracked.body.setLinvel({ x: (x - p.x) / dt, y: (y - p.y) / dt, z: (z - p.z) / dt }, true);
      return;
    }
    if (d.type === 'propeller' || d.type === 'drum') {
      // just round and round, whatever is in the way
      const w = d.spin ?? 3;
      this.angle += w * dt;
      this.tracked.body.setAngvel({ x: this.axis.x * w, y: 0, z: this.axis.z * w }, true);
      return;
    }
    let next: number;
    if (d.type === 'catapult') {
      // Loaded: it waits for a moment with something standing on it, then lets go all at once,
      // stays up a moment and comes back down for the next one.
      next = this.angle;
      if (this.stage === 'armed') {
        this.time = onIt ? this.time + dt : 0;
        if (this.time >= CATAPULT.load) {
          [this.stage, this.time] = ['snap', 0];
          // the board's speed at its middle, out along the board as it comes up: the same throw
          // wherever on it one stands (from the very end it would go into orbit)
          const speed = (d.spin ?? 6) * d.half[2];
          const a = d.angle * 0.8;
          this.fling = { x: Math.sin(d.yaw) * Math.sin(a) * speed, y: Math.cos(a) * speed, z: Math.cos(d.yaw) * Math.sin(a) * speed };
        }
      } else if (this.stage === 'snap') {
        next = Math.min(d.angle, this.angle + (d.spin ?? 6) * dt);
        if (next >= d.angle) this.stage = 'hold';
      } else if (this.stage === 'hold') {
        if ((this.time += dt) >= CATAPULT.hold) this.stage = 'back';
      } else {
        next = Math.max(0, this.angle - CATAPULT.back * dt);
        if (next <= 0) [this.stage, this.time] = ['armed', 0];
      }
    } else if (d.type === 'seesaw') {
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
    const c = this.tracked.body.translation();
    const dx = at.x - c.x, dz = at.z - c.z;
    const s = dx * Math.sin(d.yaw) + dz * Math.cos(d.yaw);
    const l = dx * Math.cos(d.yaw) - dz * Math.sin(d.yaw);
    // (a catapult's board reaches back from its hinge, the others' either way from the middle)
    if ((d.type === 'catapult' ? s > 0.2 || s < -2 * d.half[2] : Math.abs(s) > d.half[2]) || Math.abs(l) > d.half[0] + 0.2) return false;
    const top = this.pitches ? d.pos[1] - s * Math.sin(this.angle) : d.pos[1] + l * Math.sin(this.angle);
    return at.y > top - 0.2 && at.y < top + reach;
  }

  /** A slider's offset at a time. */
  private slide(time: number): number {
    const d = this.def;
    return d.type === 'slider' ? (d.travel ?? 2) * Math.sin((2 * Math.PI * time) / (d.period ?? 4) + (d.phase ?? 0)) : 0;
  }

  /** Where the body stands with a slider's offset. */
  private at(offset: number): [number, number, number] {
    const [x, y, z] = this.def.pos;
    return [x + offset * Math.cos(this.def.yaw), y, z - offset * Math.sin(this.def.yaw)];
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
    return 2 * Math.atan2(this.pitches ? x : z, w);
  }

  private rotation(angle: number): { x: number; y: number; z: number; w: number } {
    const sy = Math.sin(this.def.yaw / 2), cy = Math.cos(this.def.yaw / 2);
    const sa = Math.sin(angle / 2), ca = Math.cos(angle / 2);
    // heading about Y, then the tilt about the local X (seesaw, catapult) or Z (rocker) axis
    return this.pitches ? { x: cy * sa, y: sy * ca, z: -sy * sa, w: cy * ca } : { x: sy * sa, y: sy * ca, z: cy * sa, w: cy * ca };
  }
}

/**
 * A drum's slats, as the angle round from the bottom and the middle of each in the drum's
 * own frame, with each one's half width: just wide enough to close the gaps on the inside.
 */
export function drumSlats(radius: number, halfThickness: number, n: number): [number, number, number, number][] {
  const out: [number, number, number, number][] = [];
  const half = radius * Math.tan(Math.PI / n) + 0.02;
  for (let k = 0; k < n; k++) {
    const a = (2 * Math.PI * k) / n;
    out.push([a, Math.sin(a) * (radius + halfThickness), -Math.cos(a) * (radius + halfThickness), half]);
  }
  return out;
}
