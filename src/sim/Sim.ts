import RAPIER from '@dimforge/rapier3d-compat';
import type { VehicleSpec } from '../config/vehicles';
import { heightAt, personHalf, PROP_SHAPES, type PropDef, type TrackDef } from './Track';
import { Mover } from './Movers';
import { Tracked } from './Tracked';
import { Traffic } from './Traffic';
import { Vehicle, type DriveInput } from './Vehicle';

/** Fixed physics step. Rendering interpolates between steps. */
export const STEP = 1 / 60;
/** Half the thickness of a spinner disc. */
export const SPINNER_HALF = 0.05;

export async function initPhysics(): Promise<void> {
  await RAPIER.init();
}

export interface Prop {
  def: PropDef;
  tracked: Tracked;
}

/** The physics world: track, loose props and the player's vehicle. No rendering in here. */
export class Sim {
  readonly world: RAPIER.World;
  readonly props: Prop[] = [];
  /** Turning discs, in the order of the track definition. */
  readonly spinners: Tracked[] = [];
  /** Seesaws and rocking planks, in the order of the track definition. */
  readonly movers: Mover[] = [];
  readonly traffic: Traffic;
  vehicle: Vehicle;
  /** Other vehicles on the track (opponents in a race), each with what it is told to do. */
  readonly others: { vehicle: Vehicle; input: DriveInput }[] = [];

  constructor(readonly track: TrackDef, spec: VehicleSpec) {
    this.world = new RAPIER.World({ x: 0, y: -9.81, z: 0 });
    this.world.timestep = STEP;

    for (const b of track.statics) {
      const desc = RAPIER.ColliderDesc.cuboid(...b.half).setTranslation(...b.pos).setFriction(0.8);
      if (b.quat) desc.setRotation({ x: b.quat[0], y: b.quat[1], z: b.quat[2], w: b.quat[3] });
      this.world.createCollider(desc);
    }
    // people standing about are in the way like posts
    for (const d of track.decor) {
      if (d.type !== 'person') continue;
      const half = personHalf(d.pose);
      const yaw = d.yaw ?? 0;
      // (sitting, the body reaches forward over the knees)
      const fwd = d.pose === 'sit' ? 0.1 : 0;
      this.world.createCollider(
        RAPIER.ColliderDesc.cuboid(...half)
          .setTranslation(d.pos[0] + Math.sin(yaw) * fwd, d.pos[1] + heightAt(track.terrain, d.pos[0], d.pos[2]) + half[1], d.pos[2] + Math.cos(yaw) * fwd)
          .setRotation({ x: 0, y: Math.sin(yaw / 2), z: 0, w: Math.cos(yaw / 2) })
          .setFriction(0.5),
      );
    }
    for (const def of track.props) this.props.push({ def, tracked: new Tracked(this.createProp(def)) });

    if (track.terrain) {
      const t = track.terrain;
      // the engine wants the grid column by column, a column running along Z
      const heights = new Float32Array((t.rows + 1) * (t.cols + 1));
      for (let ix = 0; ix <= t.cols; ix++) for (let iz = 0; iz <= t.rows; iz++) heights[iz + ix * (t.rows + 1)] = t.heights[iz * (t.cols + 1) + ix];
      this.world.createCollider(RAPIER.ColliderDesc.heightfield(t.rows, t.cols, heights, { x: t.half[0] * 2, y: 1, z: t.half[1] * 2 }).setFriction(0.8));
    }
    for (const s of track.spinners ?? []) {
      // (velocity based: it just keeps turning, and the vehicle can read its speed off it)
      const body = this.world.createRigidBody(RAPIER.RigidBodyDesc.kinematicVelocityBased().setTranslation(s.pos[0], s.pos[1] - SPINNER_HALF, s.pos[2]));
      this.world.createCollider(RAPIER.ColliderDesc.cylinder(SPINNER_HALF, s.radius).setFriction(0.8), body);
      body.setAngvel({ x: 0, y: s.speed, z: 0 }, true);
      this.spinners.push(new Tracked(body));
    }

    for (const m of track.movers ?? []) this.movers.push(new Mover(this.world, m));

    this.traffic = new Traffic(this.world, track.traffic ?? []);
    this.vehicle = this.spawnVehicle(spec);
  }

  private createProp(def: PropDef): RAPIER.RigidBody {
    const yaw = def.yaw ?? 0;
    const body = this.world.createRigidBody(
      RAPIER.RigidBodyDesc.dynamic()
        .setTranslation(...def.pos)
        .setRotation({ x: 0, y: Math.sin(yaw / 2), z: 0, w: Math.cos(yaw / 2) })
        .setLinearDamping(0.2)
        .setAngularDamping(0.6),
    );
    let desc: RAPIER.ColliderDesc;
    if (def.type === 'tyre') {
      const s = PROP_SHAPES.tyre;
      desc = RAPIER.ColliderDesc.cylinder(s.halfHeight, s.radius).setMass(s.mass).setFriction(0.8);
    } else if (def.type === 'cone' || def.type === 'bigcone') {
      const s = PROP_SHAPES[def.type];
      desc = RAPIER.ColliderDesc.cone(s.halfHeight, s.radius).setMass(s.mass).setFriction(0.7);
    } else {
      const s = PROP_SHAPES[def.type];
      // Carts and chairs roll, so they get next to no friction.
      desc = RAPIER.ColliderDesc.cuboid(...s.half).setMass(s.mass).setFriction(def.type === 'cart' || def.type === 'chair' ? 0.05 : def.type === 'barrel' ? 0.4 : 0.6);
    }
    this.world.createCollider(desc.setRestitution(0.2), body);
    return body;
  }

  private spawnVehicle(spec: VehicleSpec): Vehicle {
    const { pos, yaw } = this.track.spawn;
    return new Vehicle(this.world, spec, pos[0], pos[1], pos[2], yaw);
  }

  /** Another vehicle on the track; it drives by whatever is put into its `input`. */
  addOther(spec: VehicleSpec, x: number, y: number, z: number, yaw: number): Vehicle {
    const vehicle = new Vehicle(this.world, spec, x, y, z, yaw);
    this.others.push({ vehicle, input: { throttle: 0, steer: 0, handbrake: true } });
    return vehicle;
  }

  /** Swap the vehicle type; the new one starts at the spawn point. */
  setVehicle(spec: VehicleSpec): void {
    const { topSpeed, accel } = this.vehicle;
    this.vehicle.dispose();
    this.vehicle = this.spawnVehicle(spec);
    this.vehicle.setMotor(topSpeed, accel);
  }

  /** Back to the start, and as good as new. */
  respawn(): void {
    const { pos, yaw } = this.track.spawn;
    this.vehicle.place(pos[0], pos[1], pos[2], yaw);
    this.vehicle.setDamage(0);
  }

  /** Seesaws back to where they started. */
  resetMovers(): void {
    for (const m of this.movers) m.reset();
  }

  /** Put every loose prop back where the track definition has it. */
  resetProps(): void {
    for (const { def, tracked } of this.props) {
      const yaw = def.yaw ?? 0;
      const b = tracked.body;
      b.setTranslation({ x: def.pos[0], y: def.pos[1], z: def.pos[2] }, true);
      b.setRotation({ x: 0, y: Math.sin(yaw / 2), z: 0, w: Math.cos(yaw / 2) }, true);
      b.setLinvel({ x: 0, y: 0, z: 0 }, true);
      b.setAngvel({ x: 0, y: 0, z: 0 }, true);
      tracked.teleport();
    }
  }

  step(input: DriveInput): void {
    this.vehicle.update(input, STEP);
    for (const o of this.others) o.vehicle.update(o.input, STEP);
    const at = this.vehicle.body.translation();
    this.traffic.update(STEP, at.x, at.z);
    for (const m of this.movers) m.update(STEP, at, this.vehicle.wheelsOnGround > 0 && m.holds(at, 1));
    // What the step does to the speed beyond gravity is something it ran into (or landed on):
    // tyres, springs and motors have all had their say in `update` already.
    const before = this.vehicle.body.linvel();
    const bx = before.x, by = before.y, bz = before.z;
    this.world.step();
    const after = this.vehicle.body.linvel();
    this.vehicle.hit(after.x - bx, after.y - by + 9.81 * STEP, after.z - bz);
    this.vehicle.tracked.snap();
    for (const o of this.others) o.vehicle.tracked.snap();
    for (const c of this.traffic.cars) c.tracked.snap();
    for (const p of this.props) p.tracked.snap();
    for (const s of this.spinners) s.snap();
    for (const m of this.movers) m.tracked.snap();
  }
}
