import RAPIER from '@dimforge/rapier3d-compat';
import { Quaternion, Vector3 } from 'three';
import { HANDLING, type VehicleSpec } from '../config/vehicles';
import { Tracked } from './Tracked';

export interface DriveInput {
  /** -1 (reverse) … 1 (forward) */
  throttle: number;
  /** -1 (left) … 1 (right) */
  steer: number;
  handbrake: boolean;
}

const DOWN = { x: 0, y: -1, z: 0 };
const AXLE = { x: -1, y: 0, z: 0 };
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/**
 * Raycast vehicle with an electric speed controller: every drive wheel chases a target
 * speed, so releasing the stick brakes on its own, like the real thing.
 */
export class Vehicle {
  readonly body: RAPIER.RigidBody;
  readonly tracked: Tracked;
  private readonly ctrl: RAPIER.DynamicRayCastVehicleController;

  /** Motor limits, set from the current tuning stage. */
  topSpeed = 6 / 3.6;
  accel = 2.5;

  /** Signed forward speed in m/s. */
  speed = 0;
  yawRate = 0;
  /** Y component of the chassis up vector: 1 upright, below 0 upside down. */
  upY = 1;
  /** Lean to the side in rad, positive = leaning to the driver's right. */
  roll = 0;
  wheelsOnGround = 0;
  /** Swivel angle per wheel for casters, steering angle otherwise. */
  readonly wheelYaw: number[];

  private readonly q = new Quaternion();
  private readonly fwd = new Vector3();
  private readonly up = new Vector3();
  private readonly left = new Vector3();
  /** Yaw torque the turning wheels were asked to produce in the last step. */
  private wantedYawTorque = 0;
  private readonly drives: number;
  private readonly turners: number;
  private readonly handbraked: number;
  /** Phase of the push stroke for vehicles with `pushRhythm`, in rad. */
  pushPhase = 0;
  private readonly local = new Vector3();

  constructor(private readonly world: RAPIER.World, readonly spec: VehicleSpec, x: number, y: number, z: number, yaw: number) {
    const [hx, hy, hz] = spec.half;
    this.body = world.createRigidBody(
      RAPIER.RigidBodyDesc.dynamic()
        .setTranslation(x, y, z)
        .setRotation({ x: 0, y: Math.sin(yaw / 2), z: 0, w: Math.cos(yaw / 2) })
        .setAngularDamping(0.4)
        .setCcdEnabled(true)
        .setCanSleep(false),
    );
    world.createCollider(
      RAPIER.ColliderDesc.cuboid(hx, hy, hz)
        .setMassProperties(
          spec.mass,
          { x: spec.com[0], y: spec.com[1], z: spec.com[2] },
          { x: spec.inertia[0], y: spec.inertia[1], z: spec.inertia[2] },
          { x: 0, y: 0, z: 0, w: 1 },
        )
        .setFriction(0.25)
        .setRestitution(0.15),
      this.body,
    );

    this.ctrl = world.createVehicleController(this.body);
    spec.wheels.forEach((w, i) => {
      this.ctrl.addWheel({ x: w.x, y: w.y, z: w.z }, DOWN, AXLE, spec.suspensionRest, w.radius);
      this.ctrl.setWheelSuspensionStiffness(i, w.stiffness);
      this.ctrl.setWheelMaxSuspensionTravel(i, 0.15);
    });
    this.wheelYaw = spec.wheels.map(() => 0);
    this.drives = spec.wheels.filter((w) => w.drive).length;
    this.turners = spec.wheels.filter((w) => w.turn).length;
    this.handbraked = spec.wheels.filter((w) => w.handbrake ?? !!w.drive).length;
    this.tracked = new Tracked(this.body);
  }

  setMotor(topSpeed: number, accel: number): void {
    this.topSpeed = topSpeed;
    this.accel = accel;
  }

  update(input: DriveInput, dt: number): void {
    const { spec, ctrl, body } = this;
    const r = body.rotation();
    this.q.set(r.x, r.y, r.z, r.w);
    this.fwd.set(0, 0, 1).applyQuaternion(this.q);
    this.up.set(0, 1, 0).applyQuaternion(this.q);
    const lv = body.linvel();
    const av = body.angvel();
    const v = lv.x * this.fwd.x + lv.y * this.fwd.y + lv.z * this.fwd.z;
    const yawRate = av.x * this.up.x + av.y * this.up.y + av.z * this.up.z;
    this.speed = v;
    this.yawRate = yawRate;
    this.upY = this.up.y;
    // The chassis X axis points left; when it rises, the vehicle leans right.
    this.left.set(1, 0, 0).applyQuaternion(this.q);
    this.roll = Math.asin(clamp(this.left.y, -1, 1));

    const grip = HANDLING.grip * spec.gripFactor;
    // Nose up in a wheelie: ease off the motor so it hovers instead of flipping backwards.
    const wheelie = clamp(1 - (this.fwd.y - 0.1) / 0.25, 0, 1);
    // Same on the brakes: nose down in a stoppie, let go a little.
    const stoppie = clamp(1 - (-this.fwd.y - 0.22) / 0.2, 0, 1);
    const targetV = input.throttle >= 0 ? input.throttle * this.topSpeed : input.throttle * this.topSpeed * 0.5;
    // Leaning out of the corner takes steering away, so full lock ends up balancing on two wheels.
    // Steering towards the lean stays untouched: that is how you catch it again.
    // Looking a little ahead (roll rate) keeps it from overshooting the balance point.
    const rollRate = av.x * this.fwd.x + av.y * this.fwd.y + av.z * this.fwd.z;
    const leaningOut = Math.max(0, -Math.sign(input.steer * v) * (this.roll + HANDLING.tipLookahead * rollRate));
    const aLat = HANDLING.lateralAccel * Math.max(0, 1 - (HANDLING.tipAssist * leaningOut) / HANDLING.tipAngle);
    // Positive yaw turns left, so steering right asks for a negative yaw rate / wheel angle.
    const v2 = Math.max(v * v, 0.01);
    let yawTarget = 0;
    let steerAngle = 0;
    if (this.turners > 0) {
      yawTarget = -input.steer * Math.min(spec.maxYawRate, aLat / Math.max(Math.abs(v), 0.5));
    } else {
      steerAngle = -input.steer * Math.min(spec.maxSteer, Math.atan((spec.wheelbase * aLat) / v2));
    }

    // Stick pulled against the direction of travel: that is braking, not reversing yet.
    const braking = Math.abs(v) > 0.3 && input.throttle * v < 0;
    const slowing = Math.abs(targetV) < Math.abs(v) || targetV * v < 0;
    const perDrive = spec.mass / this.drives;
    const brakeShare = (stoppie * spec.mass * HANDLING.footBrake * 0.5) / Math.max(1, spec.wheels.length - this.drives);

    // Power-assist wheels follow the strokes on the push rims.
    let surge = 1;
    if (spec.pushRhythm) {
      if (input.throttle !== 0) this.pushPhase += dt * 2 * Math.PI * (1.1 + Math.abs(v) * 0.12);
      surge = 0.5 + Math.max(0, Math.sin(this.pushPhase));
    }

    // Velocity in chassis space, used for the caster swivel.
    this.local.set(lv.x, lv.y, lv.z).applyQuaternion(this.q.invert());

    // A wheel that has lifted off cannot push. For differential steering that would mean
    // no steering on two wheels, so whatever turning force the tyres failed to deliver in
    // the last step is applied to the chassis directly.
    if (this.turners > 0 && this.wheelsOnGround > 0 && !input.handbrake) {
      let delivered = 0;
      spec.wheels.forEach((w, i) => {
        if (w.turn) delivered -= (w.x * (ctrl.wheelForwardImpulse(i) ?? 0)) / dt;
      });
      const fill = (this.wantedYawTorque - delivered) * dt;
      body.applyTorqueImpulse({ x: this.up.x * fill, y: this.up.y * fill, z: this.up.z * fill }, true);
    }
    this.wantedYawTorque = 0;

    let onGround = 0;
    spec.wheels.forEach((w, i) => {
      ctrl.setWheelSuspensionCompression(i, HANDLING.suspensionCompression);
      ctrl.setWheelSuspensionRelaxation(i, HANDLING.suspensionRelaxation);
      ctrl.setWheelFrictionSlip(i, grip);
      let side = w.caster ? 0 : 1;
      let force = 0;
      let brake = 0;

      // Steering by pushing one side harder than the other.
      let turn = 0;
      if (w.turn && !input.handbrake) {
        turn = -(spec.mass / this.turners) * HANDLING.yawGain * (yawTarget - yawRate) * w.x;
        // An axle behind the centre of mass pulls the nose straight again through its
        // cornering grip. Feed forward the wheel force that cancels this, else it understeers.
        turn += ((w.z - spec.com[2]) * spec.mass * v * yawTarget) / (this.turners * w.x);
      }

      if (input.handbrake && (w.handbrake ?? !!w.drive)) {
        brake = (spec.mass * 7 * dt) / this.handbraked;
        side = HANDLING.handbrakeSlide;
      } else if (w.drive && !input.handbrake) {
        // Slowing down may use the brake; speeding up is limited by the motor.
        const decel = braking ? HANDLING.footBrake : HANDLING.brakeDecel;
        const cap = perDrive * (slowing ? Math.max(this.accel, decel) * stoppie : this.accel * wheelie * surge);
        // Steering gets its share of the motor first; otherwise both wheels would sit at
        // the limit under full throttle and there would be nothing left to turn with.
        turn = clamp(turn, -cap * 0.8, cap * 0.8);
        const room = cap - Math.abs(turn);
        force = turn + clamp(perDrive * HANDLING.motorGain * (targetV - v), -room, room);
        // With one drive wheel in the air the other one's steering force would act as
        // extra thrust, so fade out anything that pushes beyond the top speed.
        const over = Math.abs(v) - this.topSpeed;
        if (over > 0 && force * v > 0) force *= Math.max(0, 1 - over / (0.1 * this.topSpeed + 0.2));
      } else if (w.turn) {
        // Hands on the push rims: only so much force, whatever the motor can do.
        const hand = (spec.mass / this.turners) * (spec.handSteer ?? 4);
        force = clamp(turn, -hand, hand);
        // The hands also do most of the braking; the little pusher wheel has no weight on it.
        if (Math.abs(v) > 0.2 && slowing) {
          force -= Math.sign(v) * (spec.mass / this.turners) * stoppie * (braking ? HANDLING.footBrake : HANDLING.brakeDecel);
        }
      } else if (braking) {
        // The other wheels help: the drive wheels alone go light under hard braking.
        brake = brakeShare * dt;
      }
      if (w.turn) this.wantedYawTorque -= w.x * force;
      ctrl.setWheelEngineForce(i, force);
      ctrl.setWheelBrake(i, brake);
      ctrl.setWheelSideFrictionStiffness(i, side);

      if (w.steer) {
        ctrl.setWheelSteering(i, steerAngle);
        this.wheelYaw[i] = steerAngle;
      } else if (w.caster) {
        const vx = this.local.x + yawRate * w.z;
        const vz = this.local.z - yawRate * w.x;
        if (vx * vx + vz * vz > 0.01) this.wheelYaw[i] = Math.atan2(vx, vz);
      }
      if (ctrl.wheelIsInContact(i)) onGround++;
    });
    this.wheelsOnGround = onGround;

    // Anti-tippers: past a good wheelie (or stoppie) angle something pushes the nose back,
    // so nobody ends up parked on the backrest or on their face.
    if (onGround > 0 && Math.abs(this.fwd.y) > 0.3) {
      const pitchRate = av.x * this.left.x + av.y * this.left.y + av.z * this.left.z;
      const past = this.fwd.y - 0.3 * Math.sign(this.fwd.y);
      // (0.3 is about 17°)
      const down = (spec.mass * 9.81 * 2 * past - spec.mass * 0.4 * pitchRate) * dt;
      body.applyTorqueImpulse({ x: this.left.x * down, y: this.left.y * down, z: this.left.z * down }, true);
    }

    // Cornering force pushes the top of the vehicle outwards (see HANDLING.tipHeight).
    if (onGround > 0) {
      const lateral = clamp(yawRate * v, -grip * 9.81, grip * 9.81);
      // The second term is the roll damper.
      const push = (spec.mass * lateral * HANDLING.tipHeight * spec.tipFactor - HANDLING.rollDamping * rollRate) * dt;
      body.applyTorqueImpulse({ x: this.fwd.x * push, y: this.fwd.y * push, z: this.fwd.z * push }, true);
    }

    // Wheels ride on the world only; loose props are handled by the chassis collider.
    ctrl.updateVehicle(dt, RAPIER.QueryFilterFlags.EXCLUDE_DYNAMIC);
  }

  /** Wheel centre height offset below its mount, and spin angle, for the visuals. */
  wheelSuspension(i: number): number {
    return this.ctrl.wheelSuspensionLength(i) ?? this.spec.suspensionRest;
  }

  wheelSpin(i: number): number {
    return this.ctrl.wheelRotation(i) ?? 0;
  }

  get yaw(): number {
    const r = this.body.rotation();
    this.fwd.set(0, 0, 1).applyQuaternion(this.q.set(r.x, r.y, r.z, r.w));
    return Math.atan2(this.fwd.x, this.fwd.z);
  }

  place(x: number, y: number, z: number, yaw: number): void {
    this.body.setTranslation({ x, y, z }, true);
    this.body.setRotation({ x: 0, y: Math.sin(yaw / 2), z: 0, w: Math.cos(yaw / 2) }, true);
    this.body.setLinvel({ x: 0, y: 0, z: 0 }, true);
    this.body.setAngvel({ x: 0, y: 0, z: 0 }, true);
    this.tracked.teleport();
  }

  /** Put the vehicle back on its wheels where it is. */
  upright(): void {
    const t = this.body.translation();
    this.place(t.x, t.y + 0.5, t.z, this.yaw);
  }

  dispose(): void {
    this.world.removeVehicleController(this.ctrl);
    this.world.removeRigidBody(this.body);
  }
}
