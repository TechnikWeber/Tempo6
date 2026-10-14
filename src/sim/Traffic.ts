import RAPIER from '@dimforge/rapier3d-compat';
import { TRAFFIC_SHAPES, type TrafficDef } from './Track';
import { Tracked } from './Tracked';

export interface TrafficCar {
  def: TrafficDef;
  tracked: Tracked;
  /** Metres driven along the loop. */
  dist: number;
  /** Current speed in m/s. */
  speed: number;
  /** Whether it is being held up right now. */
  blocked: boolean;
}

/** Length of each leg of a closed loop, and the total. */
function measure(path: [number, number][]): { legs: number[]; total: number } {
  const legs = path.map(([x, z], i) => {
    const [nx, nz] = path[(i + 1) % path.length];
    return Math.hypot(nx - x, nz - z);
  });
  return { legs, total: legs.reduce((a, b) => a + b, 0) };
}

/**
 * Other road users: cars that drive round a fixed loop, whatever gets in the way.
 * They are kinematic, so they shove things aside but cannot be shoved. They do brake
 * and sound the horn for a wheelchair straight ahead.
 */
export class Traffic {
  readonly cars: TrafficCar[] = [];
  /** Set when a car had to brake for the player; consumed by the game. */
  honk = false;
  private readonly loops: { legs: number[]; total: number }[] = [];

  constructor(world: RAPIER.World, defs: TrafficDef[]) {
    for (const def of defs) {
      const half = TRAFFIC_SHAPES[def.type].half;
      const body = world.createRigidBody(RAPIER.RigidBodyDesc.kinematicPositionBased());
      world.createCollider(RAPIER.ColliderDesc.cuboid(...half).setFriction(0.3).setRestitution(0.3), body);
      const car: TrafficCar = { def, tracked: new Tracked(body), dist: 0, speed: 0, blocked: false };
      this.cars.push(car);
      this.loops.push(measure(def.path));
    }
    this.reset();
  }

  /** Point on the loop of car `i` after `dist` metres. */
  private at(i: number, dist: number): [number, number] {
    const { legs, total } = this.loops[i];
    const path = this.cars[i].def.path;
    let d = ((dist % total) + total) % total;
    for (let k = 0; k < legs.length; k++) {
      if (d <= legs[k]) {
        const [x, z] = path[k];
        const [nx, nz] = path[(k + 1) % path.length];
        const t = legs[k] > 0 ? d / legs[k] : 0;
        return [x + (nx - x) * t, z + (nz - z) * t];
      }
      d -= legs[k];
    }
    return path[0];
  }

  /** Where car `i` is and where it points, taken from a bit behind and ahead so corners come out round. */
  private pose(i: number): { x: number; z: number; yaw: number } {
    const car = this.cars[i];
    const reach = TRAFFIC_SHAPES[car.def.type].half[2];
    const [bx, bz] = this.at(i, car.dist - reach);
    const [fx, fz] = this.at(i, car.dist + reach);
    return { x: (bx + fx) / 2, z: (bz + fz) / 2, yaw: Math.atan2(fx - bx, fz - bz) };
  }

  private put(i: number, teleport: boolean): void {
    const car = this.cars[i];
    const { x, z, yaw } = this.pose(i);
    const y = TRAFFIC_SHAPES[car.def.type].half[1] + 0.02;
    const rot = { x: 0, y: Math.sin(yaw / 2), z: 0, w: Math.cos(yaw / 2) };
    const body = car.tracked.body;
    if (teleport) {
      body.setTranslation({ x, y, z }, true);
      body.setRotation(rot, true);
      car.tracked.teleport();
    } else {
      body.setNextKinematicTranslation({ x, y, z });
      body.setNextKinematicRotation(rot);
    }
  }

  /** Which leg of its loop car `i` is on. */
  leg(i: number): number {
    const { legs, total } = this.loops[i];
    let d = ((this.cars[i].dist % total) + total) % total;
    for (let k = 0; k < legs.length; k++) {
      if (d <= legs[k]) return k;
      d -= legs[k];
    }
    return 0;
  }

  /** Everybody back to where they start. */
  reset(): void {
    this.cars.forEach((car, i) => {
      car.dist = car.def.offset ?? 0;
      car.speed = car.def.speed;
      car.blocked = false;
      this.put(i, true);
    });
    this.honk = false;
  }

  /** @param px,pz where the player is */
  update(dt: number, px: number, pz: number): void {
    this.cars.forEach((car, i) => {
      const t = car.tracked.body.translation();
      const r = car.tracked.body.rotation();
      // heading from the yaw-only rotation
      const sin = 2 * r.w * r.y, cos = 1 - 2 * r.y * r.y;
      const dx = px - t.x, dz = pz - t.z;
      const ahead = dx * sin + dz * cos;
      const aside = dx * cos - dz * sin;
      const half = TRAFFIC_SHAPES[car.def.type].half;
      const blocked = ahead > half[2] - 0.5 && ahead < half[2] + 1.5 + car.def.speed * 0.6 && Math.abs(aside) < half[0] + 0.7;
      // (somebody on foot just stops and waits)
      if (blocked && !car.blocked && car.def.type !== 'walker') this.honk = true;
      car.blocked = blocked;
      const want = blocked ? 0 : car.def.speed;
      car.speed += Math.max(-9 * dt, Math.min(2.5 * dt, want - car.speed));
      car.dist += car.speed * dt;
      this.put(i, false);
    });
  }
}
