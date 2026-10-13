import RAPIER from '@dimforge/rapier3d-compat';
import type { VehicleSpec } from '../config/vehicles';
import { PROP_SHAPES, type PropDef, type TrackDef } from './Track';
import { Tracked } from './Tracked';
import { Traffic } from './Traffic';
import { Vehicle, type DriveInput } from './Vehicle';

/** Fixed physics step. Rendering interpolates between steps. */
export const STEP = 1 / 60;

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
  readonly traffic: Traffic;
  vehicle: Vehicle;

  constructor(readonly track: TrackDef, spec: VehicleSpec) {
    this.world = new RAPIER.World({ x: 0, y: -9.81, z: 0 });
    this.world.timestep = STEP;

    for (const b of track.statics) {
      const desc = RAPIER.ColliderDesc.cuboid(...b.half).setTranslation(...b.pos).setFriction(0.8);
      if (b.quat) desc.setRotation({ x: b.quat[0], y: b.quat[1], z: b.quat[2], w: b.quat[3] });
      this.world.createCollider(desc);
    }
    for (const def of track.props) this.props.push({ def, tracked: new Tracked(this.createProp(def)) });

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
    if (def.type === 'cone') {
      const s = PROP_SHAPES.cone;
      desc = RAPIER.ColliderDesc.cone(s.halfHeight, s.radius).setMass(s.mass).setFriction(0.7);
    } else {
      const s = PROP_SHAPES[def.type];
      // Carts roll, so they get next to no friction.
      desc = RAPIER.ColliderDesc.cuboid(...s.half).setMass(s.mass).setFriction(def.type === 'cart' ? 0.05 : 0.6);
    }
    this.world.createCollider(desc.setRestitution(0.2), body);
    return body;
  }

  private spawnVehicle(spec: VehicleSpec): Vehicle {
    const { pos, yaw } = this.track.spawn;
    return new Vehicle(this.world, spec, pos[0], pos[1], pos[2], yaw);
  }

  /** Swap the vehicle type; the new one starts at the spawn point. */
  setVehicle(spec: VehicleSpec): void {
    const { topSpeed, accel } = this.vehicle;
    this.vehicle.dispose();
    this.vehicle = this.spawnVehicle(spec);
    this.vehicle.setMotor(topSpeed, accel);
  }

  respawn(): void {
    const { pos, yaw } = this.track.spawn;
    this.vehicle.place(pos[0], pos[1], pos[2], yaw);
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
    const at = this.vehicle.body.translation();
    this.traffic.update(STEP, at.x, at.z);
    this.world.step();
    this.vehicle.tracked.snap();
    for (const c of this.traffic.cars) c.tracked.snap();
    for (const p of this.props) p.tracked.snap();
  }
}
