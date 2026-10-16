import RAPIER from '@dimforge/rapier3d-compat';
import { Quaternion, Vector3 } from 'three';
import { BOOST, DAMAGE } from '../config/tuning';
import { HANDLING, type DriveProfile, type VehicleSpec } from '../config/vehicles';
import { Tracked } from './Tracked';

/** Seconds of wheelspin when the boost fires. */
const BOOST_KICK = 0.6;
/** Share of the top speed lost right off the road. */
const OFFROAD_SLOW = 0.6;

export interface DriveInput {
  /** -1 (reverse) … 1 (forward) */
  throttle: number;
  /** -1 (left) … 1 (right) */
  steer: number;
  handbrake: boolean;
  /** Dump the battery pack into the motors, for as long as it lasts. */
  boost?: boolean;
  /** Nobody at the controls: no motor, no brakes, the wheels just roll (the crashtest, after the knock). */
  limp?: boolean;
}

const DOWN = { x: 0, y: -1, z: 0 };
const AXLE = { x: -1, y: 0, z: 0 };
const ROUND = 0.07;
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/**
 * Raycast vehicle with an electric speed controller: every drive wheel chases a target
 * speed, so releasing the stick brakes on its own, like the real thing.
 */
export class Vehicle {
  readonly body: RAPIER.RigidBody;
  readonly tracked: Tracked;
  private readonly collider: RAPIER.Collider;
  /** Sideways acceleration actually felt, in m/s²; positive = pushed towards the driver's left. */
  latAccel = 0;
  private readonly lastVel = new Vector3();
  private readonly ctrl: RAPIER.DynamicRayCastVehicleController;

  /** Motor limits, set from the current tuning stage. */
  topSpeed = 6 / 3.6;
  accel = 2.5;

  /** Signed forward speed in m/s. */
  speed = 0;
  yawRate = 0;
  /** Y component of the chassis up vector: 1 upright, below 0 upside down. */
  upY = 1;
  /** How far the nose points up from the ground it stands on (sine of the angle); negative = nose down. */
  nose = 0;
  /** Lean to the side in rad, positive = leaning to the driver's right. */
  roll = 0;
  wheelsOnGround = 0;
  /** Swivel angle per wheel for casters, steering angle otherwise. */
  readonly wheelYaw: number[];

  private readonly q = new Quaternion();
  private readonly fwd = new Vector3();
  private readonly up = new Vector3();
  private readonly left = new Vector3();
  private readonly normal = new Vector3();
  /** Yaw torque the turning wheels were asked to produce in the last step. */
  private wantedYawTorque = 0;
  private readonly drives: number;
  private readonly turners: number;
  /** How far the differential axle sits ahead of the centre of mass (0 if it does not). */
  private readonly frontGripZ: number;
  private readonly handbraked: number;
  /** Share of the weight on wheels that hold sideways (casters do not). */
  private readonly gripShare: number;
  /** Height of the centre of mass above the ground. */
  private readonly comHeight: number;
  /** Phase of the push stroke for vehicles with `pushRhythm`, in rad. */
  pushPhase = 0;
  /** The driving character currently in use. */
  profile: DriveProfile;
  /** Per wheel, 0…1: how hard the tyre is scrubbing (burnout, braking, cornering). For marks, smoke and sound. */
  readonly skid: number[];
  /** 0…1 while the drive wheels spin up under full power. */
  burnout = 0;
  /**
   * Seconds left of the wheelspin a boost starts with: the drive wheels spin up for a moment
   * although it is already rolling. Only for the look and the marks; the grip is unchanged.
   */
  boostKick = 0;
  /** 0…1: how far off the road it is (grass, gravel), as the game reckons it. It takes speed away. */
  offroad = 0;
  /** Seconds since the last wheel left the ground; 0 while driving. */
  airTime = 0;
  /** Sink rate in m/s at the moment of touchdown; consumed by the game. */
  landing = 0;
  /**
   * The hardest knock since it was last read, in m/s, whatever it was and however the vehicle
   * lay: the crashtest scores these. Damage only follows the ones that count as crashes.
   */
  knock = 0;
  /** Angle between where it points and where it goes, in rad; positive = nose to the left of travel. */
  slip = 0;
  /** Whether a boost battery is fitted. */
  boostFitted = false;
  /** Whether the battery charges back up from driving, as it does in the open world and the freestyle. */
  boostRecharge = false;
  /** Charge of the battery pack, 0…1. */
  boostCharge = 1;
  /** How hard the boost is pushing right now, 0…1; eases in and out. */
  boost = 0;
  /** True while the battery pack is discharging. */
  boosting = false;
  private boostRamp = 0;
  /** Crash damage, 0 (as new) … 1 (a heap of parts that goes nowhere). */
  damage = 0;
  /** Hardest knock since it was last read, as a change of speed in m/s. Consumed by the game. */
  lastHit = 0;
  /** Index of the wheel it has lost, or -1. */
  lostWheel = -1;
  /** Which side got the worst of it: 1 left, -1 right. It pulls that way. */
  damagedSide = 1;
  private hitGrace = 0;
  /** Share of the steering lock in use (handlebar vehicles), see `update`. */
  private steerTrim = 1;
  /** Seconds still to wait at a standstill before reverse engages, after braking to a stop. */
  private reverseWait = 0;
  /** Seconds since reverse engaged; it eases in. */
  private reverseTime = 0;
  private readonly local = new Vector3();
  private readonly qOther = new Quaternion();
  private readonly carryV = new Vector3();
  /** Normal of the ground under the wheels in the last step; straight up while in the air. */
  private readonly ground = new Vector3(0, 1, 0);
  private readonly carryW = new Vector3();

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
    this.collider = world.createCollider(
      // Rounded and slippery, so it glances off walls and ramp edges instead of hooking on them.
      RAPIER.ColliderDesc.roundCuboid(hx - ROUND, hy - ROUND, hz - ROUND, ROUND)
        .setMassProperties(
          spec.mass,
          { x: spec.com[0], y: spec.com[1], z: spec.com[2] },
          { x: spec.inertia[0], y: spec.inertia[1], z: spec.inertia[2] },
          { x: 0, y: 0, z: 0, w: 1 },
        )
        .setFriction(0.04)
        .setFrictionCombineRule(RAPIER.CoefficientCombineRule.Min)
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
    this.skid = spec.wheels.map(() => 0);
    this.profile = spec.profiles[0];
    this.drives = spec.wheels.filter((w) => w.drive).length;
    this.turners = spec.wheels.filter((w) => w.turn).length;
    const turnZ = spec.wheels.find((w) => w.turn)?.z ?? spec.com[2];
    this.frontGripZ = Math.max(0, turnZ - spec.com[2]);
    this.handbraked = spec.wheels.filter((w) => w.handbrake ?? !!w.drive).length;
    this.gripShare = spec.wheels.reduce((sum, w) => sum + (w.caster ? 0 : w.load), 0);
    this.comHeight = hy + spec.clearance + spec.com[1];
    this.tracked = new Tracked(this.body);
  }

  setMotor(topSpeed: number, accel: number): void {
    this.topSpeed = topSpeed;
    this.accel = accel;
  }

  /** Whether any of its wheels stands on the given body (a moving plank, say). */
  standsOn(body: RAPIER.RigidBody): boolean {
    return this.spec.wheels.some((_, i) => this.ctrl.wheelIsInContact(i) && this.ctrl.wheelGroundObject(i)?.parent()?.handle === body.handle);
  }

  get wrecked(): boolean {
    return this.damage >= 1;
  }

  /** How far the damage has got into the driving, 0 … 1. */
  get impaired(): number {
    return clamp((this.damage - DAMAGE.effectsFrom) / Math.max(0.01, 1 - DAMAGE.effectsFrom), 0, 1);
  }

  /**
   * Take a knock.
   * @param dx change of velocity in one step that the collision caused, in m/s
   */
  hit(dx: number, dy: number, dz: number): void {
    const impact = Math.hypot(dx, dy, dz);
    this.knock = Math.max(this.knock, impact);
    if (impact < DAMAGE.minImpact || this.wrecked || this.hitGrace > 0) return;
    // Scraping round a looping or up a steep bank is rough, but it is not a crash.
    if (this.ground.y < 0.85 || this.upY < 0.5) return;
    this.hitGrace = DAMAGE.grace;
    this.lastHit = Math.max(this.lastHit, impact);
    // pushed to the right means it was hit on the left
    const sideways = dx * this.left.x + dy * this.left.y + dz * this.left.z;
    if (Math.abs(sideways) > impact * 0.3) this.damagedSide = sideways < 0 ? 1 : -1;
    this.setDamage(impact >= DAMAGE.wreckImpact ? 1 : this.damage + (impact - DAMAGE.minImpact) * DAMAGE.perImpact);
  }

  /** Set the damage directly (workshop, repairs); wheels come off and go back on to match. */
  setDamage(damage: number): void {
    this.damage = clamp(damage, 0, 1);
    const off = this.damage >= DAMAGE.wheelOff;
    if (off && this.lostWheel < 0) {
      // A front wheel that does not drive, on the damaged side if there is one; without
      // its spring that corner drops onto the ground.
      const wheels = this.spec.wheels;
      const pick = (ok: (w: (typeof wheels)[number]) => boolean) => wheels.findIndex((w) => !w.drive && ok(w));
      let i = pick((w) => w.z > this.spec.com[2] && Math.sign(w.x) === this.damagedSide);
      if (i < 0) i = pick((w) => w.z > this.spec.com[2]);
      if (i < 0) i = pick((w) => Math.sign(w.x) === this.damagedSide);
      if (i < 0) i = pick(() => true);
      this.lostWheel = i;
      if (i >= 0) {
        this.damagedSide = Math.sign(wheels[i].x) || this.damagedSide;
        this.ctrl.setWheelSuspensionStiffness(i, 0);
      }
    } else if (!off && this.lostWheel >= 0) {
      this.ctrl.setWheelSuspensionStiffness(this.lostWheel, this.spec.wheels[this.lostWheel].stiffness);
      this.lostWheel = -1;
    }
  }

  update(input: DriveInput, dt: number): void {
    const { spec, ctrl, body } = this;
    this.hitGrace = Math.max(0, this.hitGrace - dt);
    if (this.wrecked) {
      // a heap of parts: nothing works, it just slides to a stop
      input = { throttle: 0, steer: 0, handbrake: true };
    } else if (this.impaired > 0) {
      // Bent: it pulls to the damaged side (steering right is positive, so left is minus),
      // the more the faster it goes, and standing still not at all.
      const pull = -this.damagedSide * DAMAGE.pull * this.impaired * clamp(Math.abs(this.speed) / 2, 0, 1);
      input = { ...input, steer: clamp(input.steer + pull, -1, 1) };
    }
    const r = body.rotation();
    this.q.set(r.x, r.y, r.z, r.w);
    this.fwd.set(0, 0, 1).applyQuaternion(this.q);
    this.up.set(0, 1, 0).applyQuaternion(this.q);
    // Standing on something that moves (a turning disc): the wheel model knows only still
    // ground, so everything below happens in the frame of that ground, and its motion is
    // put back on at the end.
    const carried = this.carrier();
    if (carried) {
      const l = body.linvel(), a = body.angvel();
      body.setLinvel({ x: l.x - this.carryV.x, y: l.y - this.carryV.y, z: l.z - this.carryV.z }, true);
      body.setAngvel({ x: a.x - this.carryW.x, y: a.y - this.carryW.y, z: a.z - this.carryW.z }, true);
    }
    const lv = body.linvel();
    const av = body.angvel();
    const v = lv.x * this.fwd.x + lv.y * this.fwd.y + lv.z * this.fwd.z;
    const yawRate = av.x * this.up.x + av.y * this.up.y + av.z * this.up.z;
    this.speed = v;
    this.yawRate = yawRate;
    this.upY = this.up.y;
    // The chassis X axis points left; when it rises, the vehicle leans right.
    this.left.set(1, 0, 0).applyQuaternion(this.q);
    // (Measured against the ground it stands on, as of the last step: across a slope it is
    // not leaning, and nothing below should treat it as tipping over.)
    this.roll = Math.asin(clamp(this.left.dot(this.ground), -1, 1));

    const p = this.profile;
    // Tyres bite harder the faster it goes, or the tight lines at speed would be a slide.
    const grip = HANDLING.grip * spec.gripFactor * p.grip * (1 + HANDLING.gripAtSpeed * Math.abs(v));
    this.updateBoost(input, dt);
    const topSpeed = (this.topSpeed * (1 + BOOST.speed * this.boost) + BOOST.extraSpeed * this.boost) * (1 - DAMAGE.slow * this.impaired) * (1 - OFFROAD_SLOW * this.offroad);
    const accel = this.accel * (1 + BOOST.accel * this.boost);
    const throttle = this.boosting ? 1 : input.throttle;
    // Measured, not derived from the yaw rate: in a slide the two are far apart.
    const latNow = ((lv.x - this.lastVel.x) * this.left.x + (lv.y - this.lastVel.y) * this.left.y + (lv.z - this.lastVel.z) * this.left.z) / dt;
    this.latAccel += (clamp(latNow, -40, 40) - this.latAccel) * Math.min(1, dt * 12);
    this.lastVel.set(lv.x, lv.y, lv.z);
    // Nose up in a wheelie: ease off the motor so it hovers instead of flipping backwards.
    // How far the nose points away from the ground it stands on (not from the horizon,
    // or every ramp would count as a wheelie).
    this.normal.set(0, 0, 0);
    spec.wheels.forEach((_, i) => {
      const n = ctrl.wheelIsInContact(i) ? ctrl.wheelContactNormal(i) : null;
      if (n) this.normal.x += n.x, this.normal.y += n.y, this.normal.z += n.z;
    });
    const nose = this.normal.lengthSq() > 0 ? this.fwd.dot(this.normal.normalize()) : this.fwd.y;
    this.nose = nose;
    if (this.normal.lengthSq() > 0) this.ground.copy(this.normal);
    else this.ground.set(0, 1, 0);
    const rearUp = p.wheelie ?? 1;
    const wheelie = clamp(1 - (nose - 0.1 * rearUp) / 0.25, 0, 1);
    // Same on the brakes: nose down in a stoppie, let go a little.
    const stoppie = clamp(1 - (-nose - 0.22) / 0.2, 0, 1);
    let targetV = throttle >= 0 ? throttle * topSpeed : throttle * topSpeed * 0.5;
    // Pulling back is the brake first and reverse second: once it has stopped it waits a
    // moment with the nose still down, and then pulls away backwards gently, instead of
    // throwing the full motor the other way while it is standing on its front wheels.
    if (throttle >= 0) {
      this.reverseWait = 0;
      this.reverseTime = 0;
    } else if (v > 0.3) {
      this.reverseWait = HANDLING.reverseDelay;
      this.reverseTime = 0;
    } else if (this.reverseWait > 0) {
      this.reverseWait -= dt;
      targetV = 0;
    } else {
      this.reverseTime += dt;
    }
    const launch = throttle < 0 ? clamp(this.reverseTime / Math.max(HANDLING.reverseEase, 0.01), 0.1, 1) : 1;
    // Which way it is trying to go: by the stick if it is pushed, else by the motion.
    const heading = Math.abs(targetV) > 0.3 ? Math.sign(targetV) : Math.abs(v) > 1 ? Math.sign(v) : 0;
    const wallTurn = heading !== 0 ? this.wallTurn(heading) : 0;
    // Leaning out of the corner takes steering away, so full lock ends up balancing on two wheels.
    // Steering towards the lean stays untouched: that is how you catch it again.
    // Looking a little ahead (roll rate) keeps it from overshooting the balance point.
    const rollRate = av.x * this.fwd.x + av.y * this.fwd.y + av.z * this.fwd.z;
    // The first bit of lean is just the springs and costs nothing.
    const leaningOut = Math.max(0, -Math.sign(input.steer * v) * (this.roll + HANDLING.tipLookahead * rollRate) - HANDLING.tipFree);
    // Full lock asks for a fixed sideways pull at low speed and for a fixed rate of turn
    // above that, so the corners do not open up into motorway bends as it gets faster.
    // (Up to a point: beyond `cornerMax` even this game admits that it is going too fast.)
    const fullLock = Math.max(HANDLING.lateralAccel, Math.min(HANDLING.cornerYaw * Math.abs(v), HANDLING.cornerMax));
    // Past the limit it even steers the other way a little, to catch the fall.
    // …but never for more than the tyres can hold, or slippery set-ups would just spin.
    const aLatFull = Math.min(fullLock * p.sharp, grip * 9.81 * this.gripShare * HANDLING.gripUse * (p.slide ?? 1));
    const aLat = aLatFull * Math.max(HANDLING.tipAssist > 0 ? -0.4 : 0, 1 - (HANDLING.tipAssist * p.assist * leaningOut) / Math.max(0.05, HANDLING.tipAngle - HANDLING.tipFree));
    // Positive yaw turns left, so steering right asks for a negative yaw rate / wheel angle.
    const v2 = Math.max(v * v, 0.01);
    let yawTarget = 0;
    let steerAngle = 0;
    if (this.turners > 0) {
      // A profile that slides: once the tail is out far enough the turn eases off (and past
      // that steers back a little), so it holds the drift instead of spinning to a stop.
      const out = -Math.sign(input.steer) * this.slip;
      const hold = p.slide !== undefined ? clamp(1 - (out - HANDLING.driftHold) / 0.25, -0.3, 1) : 1;
      yawTarget = -input.steer * hold * Math.min(spec.maxYawRate * p.turn, aLat / Math.max(Math.abs(v), 0.5)) + wallTurn;
    } else {
      if (wallTurn !== 0) {
        const t = wallTurn * spec.inertia[1] * 6 * dt;
        body.applyTorqueImpulse({ x: 0, y: t, z: 0 }, true);
      }
      steerAngle = -input.steer * Math.min(Math.min(0.95, spec.maxSteer * p.turn), Math.atan((spec.wheelbase * aLat) / v2));
      // At speed the tail helps the turn along and it comes round quicker than the front
      // wheel alone would have it. Take lock off until the rate of turn is the one asked for.
      const asked = (Math.abs(v) * Math.tan(Math.abs(steerAngle))) / spec.wheelbase;
      const tooQuick = Math.abs(v) > 5 && Math.abs(yawRate) > asked * 1.05 && yawRate * steerAngle * v > 0;
      this.steerTrim = clamp(this.steerTrim + (tooQuick ? -1.5 : 0.8) * dt, 0.4, 1);
      steerAngle *= this.steerTrim;
      // Nothing watches the rate of turn with handlebars, so a tyre that suddenly bites can
      // spin it round. Whatever turns far faster than the front wheel says is reined in.
      if (this.wheelsOnGround > 0 && !input.handbrake && wallTurn === 0 && HANDLING.spinGuard > 0) {
        const want = (Math.sign(v * steerAngle) * asked);
        // allowed on top: a share, plus what makes about 3 m/s² of extra sideways pull
        const slack = 0.15 * Math.abs(want) + 3 / Math.max(Math.abs(v), 3);
        const excess = yawRate - want;
        if (Math.abs(excess) > slack) {
          const t = -spec.inertia[1] * HANDLING.spinGuard * (excess - Math.sign(excess) * slack) * dt;
          body.applyTorqueImpulse({ x: this.up.x * t, y: this.up.y * t, z: this.up.z * t }, true);
        }
      }
    }

    // Cornering scrubs speed off: the harder it pulls sideways, the lower the speed the
    // motors will hold, and it eases down to that rather than braking for it.
    // How much of full lock is in use: by the sideways pull at speed, and by the rate of turn
    // at walking pace, where full lock pulls next to nothing sideways and would cost nothing.
    const yawFull = this.turners > 0
      ? Math.min(spec.maxYawRate * p.turn, aLatFull / Math.max(Math.abs(v), 0.5))
      : (Math.abs(v) * Math.tan(Math.min(0.95, spec.maxSteer * p.turn, Math.atan((spec.wheelbase * aLatFull) / v2)))) / spec.wheelbase;
    const lockUsed = Math.max(Math.abs(this.latAccel) / fullLock, Math.abs(yawRate) / Math.max(yawFull, 0.2));
    const cornerLoad = clamp(lockUsed, 0, 1) * clamp(HANDLING.cornerSlowLow + ((1 - HANDLING.cornerSlowLow) * (Math.abs(v) - 3)) / 4, HANDLING.cornerSlowLow, 1);
    const cornerV = targetV * (1 - HANDLING.cornerSlow * cornerLoad);
    // Stick pulled against the direction of travel: that is braking, not reversing yet.
    const braking = Math.abs(v) > 0.3 && throttle * v < 0;
    const slowing = Math.abs(targetV) < Math.abs(v) || targetV * v < 0;
    const perDrive = spec.mass / this.drives;
    const footBrake = HANDLING.footBrake * p.brake;
    const autoBrake = HANDLING.brakeDecel * p.brake;
    const brakeShare = (stoppie * spec.mass * footBrake * 0.5) / Math.max(1, spec.wheels.length - this.drives);

    // Power-assist wheels follow the strokes on the push rims.
    let surge = 1;
    if (spec.pushRhythm) {
      if (throttle !== 0) this.pushPhase += dt * 2 * Math.PI * (1.1 + Math.abs(v) * 0.12);
      surge = 1 + (Math.max(0, Math.sin(this.pushPhase)) - 0.5) * (p.surge ?? 1);
    }

    // Velocity in chassis space, used for the caster swivel.
    this.local.set(lv.x, lv.y, lv.z).applyQuaternion(this.q.invert());
    this.slip = this.local.z > 1 ? Math.atan2(-this.local.x, this.local.z) : 0;

    if (this.wheelsOnGround === 0) {
      this.airTime += dt;
      if (this.airTime > 0.06) {
        const k = spec.inertia[0] * dt;
        // Like a kart in a certain racing game: in the air it levels out and stops spinning,
        // so a jump ends on the wheels.
        // axis and size of the rotation that would bring the chassis upright
        const ax = -this.up.z, az = this.up.x;
        const level = HANDLING.airControl * k;
        body.applyTorqueImpulse({ x: (ax * 45 - av.x * 9) * level, y: -av.y * 5 * level, z: (az * 45 - av.z * 9) * level }, true);
        // …and it listens to the stick a little. Steering turns it and nudges it sideways,
        // throttle tips the nose down and stretches the jump, pulling back does the opposite.
        // (All of it gentle: this is for correcting a flight, not for flying.)
        const stick = Math.max(HANDLING.airControl, 0.3) * k;
        // Positive yaw is to the left, so steering right asks for a negative rate. The
        // levelling above already damps the spin; this only moves what it damps towards.
        const turn = (-input.steer * HANDLING.airYaw * stick - av.y * (stick - level) * Math.abs(input.steer)) * 5;
        // The levelling wants the nose at zero; this holds it at the angle asked for instead.
        const tip = input.throttle * HANDLING.airPitch * 45 * stick;
        body.applyTorqueImpulse({ x: this.left.x * tip, y: this.left.y * tip + turn, z: this.left.z * tip }, true);
        // sideways and along, level with the ground whichever way the chassis hangs
        const lf = Math.hypot(this.left.x, this.left.z) || 1, ff = Math.hypot(this.fwd.x, this.fwd.z) || 1;
        const side = (-input.steer * spec.mass * HANDLING.airDrift * dt) / lf;
        const along = (input.throttle * spec.mass * HANDLING.airThrust * dt) / ff;
        body.applyImpulse({ x: this.left.x * side + this.fwd.x * along, y: 0, z: this.left.z * side + this.fwd.z * along }, true);
      }
    }

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
    // Front-wheel drive is the other way round: grip ahead of the centre of mass tightens
    // every turn until the chair swaps ends. The real ones tame that with gyros; here the
    // extra yaw torque is simply taken out again.
    if (this.frontGripZ > 0 && this.wheelsOnGround > 0) {
      // The share left in is what makes the tail lively; it must not grow with the speed.
      const loose = (1 - HANDLING.fwdStability * (p.fwdStability ?? 1)) * (HANDLING.lateralAccel / fullLock);
      const cancel = -this.frontGripZ * spec.mass * v * yawRate * (1 - loose) * dt;
      body.applyTorqueImpulse({ x: this.up.x * cancel, y: this.up.y * cancel, z: this.up.z * cancel }, true);
    }

    let onGround = 0;
    let burnout = 0;
    spec.wheels.forEach((w, i) => {
      ctrl.setWheelSuspensionCompression(i, HANDLING.suspensionCompression);
      ctrl.setWheelSuspensionRelaxation(i, HANDLING.suspensionRelaxation);
      ctrl.setWheelFrictionSlip(i, grip);
      let side = w.caster ? 0 : 1;
      let force = 0;
      let brake = 0;
      let assist = 0;

      // Steering by pushing one side harder than the other.
      let turn = 0;
      if (w.turn && !input.handbrake) {
        turn = -(spec.mass / this.turners) * HANDLING.yawGain * (yawTarget - yawRate) * w.x;
        // An axle behind the centre of mass pulls the nose straight again through its
        // cornering grip. Feed forward the wheel force that cancels this, else it understeers.
        if (w.z < spec.com[2]) turn += ((w.z - spec.com[2]) * spec.mass * v * yawTarget) / (this.turners * w.x);
      }

      if (input.handbrake && (w.handbrake ?? !!w.drive)) {
        brake = (spec.mass * 7 * dt) / this.handbraked;
        side = HANDLING.handbrakeSlide;
      } else if (w.drive && !input.handbrake) {
        // Slowing down may use the brake; speeding up is limited by the motor.
        const decel = braking ? footBrake : autoBrake;
        const cap = perDrive * (slowing ? Math.max(accel, decel) * stoppie : accel * wheelie * surge * launch);
        // Slowing down is the brake's job and no stronger than the brake, however much
        // motor the tuning has added. (Steering below may still use all of `cap`.)
        let hold = slowing ? perDrive * decel * stoppie : cap;
        // A driven wheel on the fork: turned in, its cornering force already holds the
        // vehicle back, and the motor brake on top of that digs it in. While coasting the
        // brake gives way by that much and eases off with the lock, so it rolls round the bend.
        if (w.steer && slowing && !braking) {
          const plough = (Math.abs(ctrl.wheelSideImpulse(i) ?? 0) / dt) * Math.sin(Math.abs(steerAngle));
          const lock = Math.min(1, Math.abs(steerAngle) / spec.maxSteer);
          hold = Math.max(0, hold * (1 - HANDLING.steerCoast * lock) - plough);
        }
        // Steering gets its share of the motor first; otherwise both wheels would sit at
        // the limit under full throttle and there would be nothing left to turn with.
        const asked = turn;
        turn = clamp(turn, -cap * 0.8, cap * 0.8);
        // What the motors cannot spare for turning is made up on the chassis (see the fill above).
        assist = (asked - turn) * HANDLING.steerAssist;
        const room = Math.max(hold - Math.abs(turn), 0.2 * hold);
        let thrust = clamp(perDrive * HANDLING.motorGain * (cornerV - v), -room, room);
        // (too fast only for the corner: a drag, not the brake)
        if (!slowing && thrust * v < 0) thrust = 0;
        force = turn + thrust;
        // With one drive wheel in the air the other one's steering force would act as
        // extra thrust, so fade out anything that pushes beyond the top speed.
        const over = Math.abs(v) - topSpeed;
        if (over > 0 && force * v > 0) force *= Math.max(0, 1 - over / (0.1 * topSpeed + 0.2));
      } else if (w.turn) {
        // Hands on the push rims: only so much force, whatever the motor can do.
        // (More of it at speed, in step with what full lock asks for there.)
        const hand = ((spec.mass / this.turners) * (p.handSteer ?? spec.handSteer ?? 4) * fullLock) / HANDLING.lateralAccel;
        force = clamp(turn, -hand, hand);
        assist = (turn - force) * HANDLING.steerAssist * HANDLING.handAssist;
        // The hands also do most of the braking; the little pusher wheel has no weight on it.
        if (Math.abs(v) > 0.2 && slowing) {
          force -= Math.sign(v) * (spec.mass / this.turners) * stoppie * (braking ? footBrake : autoBrake);
        }
      } else if (braking) {
        // The other wheels help: the drive wheels alone go light under hard braking.
        brake = brakeShare * dt;
      }
      if (input.limp) {
        force = 0;
        assist = 0;
        // (just the rolling resistance, so it does not roll on for ever)
        brake = (spec.mass * HANDLING.limpDrag * dt) / spec.wheels.length;
      }
      if (w.turn) this.wantedYawTorque -= w.x * (force + assist);
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
      // Where the rubber suffers: spinning up, locking up or scrubbing sideways.
      let scrub = 0;
      if (ctrl.wheelIsInContact(i)) {
        onGround++;
        if (w.drive && !slowing && !input.handbrake) {
          // Wheelspin is a low-speed thing; once it is rolling the tyres hook up.
          const spin = clamp((Math.abs(force) / perDrive - 4.2) / 2.5, 0, 1) * clamp(1.7 - Math.abs(v) / 7, 0, 1);
          scrub = spin;
          burnout = Math.max(burnout, spin);
        }
        // the boost firing: a short burnout on the drive wheels
        if (w.drive && this.boostKick > 0) {
          const kick = Math.min(1, this.boostKick / (BOOST_KICK * 0.5));
          scrub = Math.max(scrub, kick);
          burnout = Math.max(burnout, kick);
        }
        if (brake > 0 && Math.abs(v) > 1.5) scrub = 1;
        if (braking && Math.abs(v) > 2 && !w.caster) scrub = Math.max(scrub, 0.8);
        // Near full lock the tyres howl, whatever that means in m/s² at this speed.
        if (!w.caster) scrub = Math.max(scrub, clamp((Math.abs(this.latAccel) / fullLock - 0.5) / 0.3, 0, 1), clamp((Math.abs(this.slip) - 0.1) / 0.1, 0, 1));
      }
      this.skid[i] = scrub;
    });
    if (onGround > 0 && this.wheelsOnGround === 0 && this.airTime > 0.35) this.landing = Math.max(0, -lv.y);
    if (onGround > 0) this.airTime = 0;
    this.wheelsOnGround = onGround;
    this.burnout = burnout;

    // The cornering drag itself, on the chassis so that every kind of drive feels it alike.
    const tooFast = Math.abs(v) - Math.abs(cornerV);
    if (onGround > 0 && !slowing && tooFast > 0 && !input.handbrake) {
      // (Measured against the speed it is going at: a rear-driven chair is flung forward by
      // its own turning, about 1 m/s² at full lock, and at walking pace half a metre per
      // second too fast is already a lot.)
      // Against the way it is going rather than the way it points, or a tail that is already
      // out would be pushed out further.
      const going = Math.hypot(lv.x, lv.z);
      const drag = (-spec.mass * HANDLING.cornerDrag * cornerLoad * Math.min(1, tooFast / (0.1 * Math.abs(cornerV) + 0.2)) * dt) / Math.max(going, 0.1);
      body.applyImpulse({ x: lv.x * drag, y: 0, z: lv.z * drag }, true);
    }

    // Anti-tippers: past a good wheelie (or stoppie) angle something pushes the nose back,
    // so nobody ends up parked on the backrest or on their face.
    const tipStop = nose > 0 ? Math.min(0.45, 0.3 * rearUp) : 0.3;
    // Well before that the bump stops come in: a lightly loaded caster can carry no more
    // than twice its share on its spring, so without them a short chair drops its nose
    // (or sits on its tail) at the first touch of brake or motor, and the easing above
    // leaves it with next to none of either.
    const bump = nose > 0 ? HANDLING.wheelieFree * rearUp : HANDLING.diveFree;
    if (onGround > 0 && Math.abs(nose) > bump) {
      const pitchRate = av.x * this.left.x + av.y * this.left.y + av.z * this.left.z;
      // (Not while it is up on two wheels or leaning on a wall: there the chassis axes are
      // no longer the ground's, and pushing on the pitch would turn it into the lean.)
      const level = clamp(1 - (Math.abs(this.roll) - 0.15) / 0.2, 0, 1);
      let down = spec.mass * 9.81 * HANDLING.pitchStop * level * (nose - bump * Math.sign(nose));
      if (Math.abs(nose) > tipStop) down += spec.mass * 9.81 * 2 * (nose - tipStop * Math.sign(nose)) - spec.mass * 0.4 * pitchRate;
      down *= dt;
      body.applyTorqueImpulse({ x: this.left.x * down, y: this.left.y * down, z: this.left.z * down }, true);
    }

    // Cornering force pushes the top of the vehicle outwards (see HANDLING.tipHeight).
    if (onGround > 0) {
      // Scaled to what full lock asks for at this speed: a fast corner leans it as far as a slow one.
      // The engine's own tyre forces lean it a little too, and those do grow with the speed;
      // that share is taken out again.
      const scale = HANDLING.lateralAccel / fullLock;
      // (the jolt of hitting a wall is not cornering and must not throw it over)
      const felt = wallTurn !== 0 ? 0 : clamp(this.latAccel, -grip * 9.81, grip * 9.81);
      const lateral = felt * scale;
      const inherent = spec.mass * felt * HANDLING.tipInherent * this.comHeight * (1 - scale);
      // The second term is the roll damper.
      // A trike balances happily on two of its three wheels and would ride on like that
      // for ever, so it gets a shove back towards level. The others only a hint of one.
      // Leaning on a wall it would stay wedged there on its tilted springs, so against a
      // wall the shove is a firm one.
      const righting = spec.mass * 9.81 * Math.max(spec.wheels.length === 3 ? 0.16 : HANDLING.righting, wallTurn !== 0 ? 0.8 : 0) * this.roll;
      const push = (spec.mass * lateral * HANDLING.tipHeight * spec.tipFactor * p.tip - inherent - HANDLING.rollDamping * rollRate - righting) * dt;
      body.applyTorqueImpulse({ x: this.fwd.x * push, y: this.fwd.y * push, z: this.fwd.z * push }, true);
    }

    // Wheels ride on the world only; loose props are handled by the chassis collider.
    ctrl.updateVehicle(dt, RAPIER.QueryFilterFlags.EXCLUDE_DYNAMIC);
    if (carried) {
      const l = body.linvel(), a = body.angvel();
      body.setLinvel({ x: l.x + this.carryV.x, y: l.y + this.carryV.y, z: l.z + this.carryV.z }, true);
      body.setAngvel({ x: a.x + this.carryW.x, y: a.y + this.carryW.y, z: a.z + this.carryW.z }, true);
    }
  }

  /**
   * How the ground under the wheels moves, as the velocity at the vehicle's position
   * (`carryV`) and the turning rate (`carryW`), weighted by how many wheels stand on it.
   */
  private carrier(): boolean {
    this.carryV.set(0, 0, 0);
    this.carryW.set(0, 0, 0);
    let touching = 0;
    const at = this.body.translation();
    this.spec.wheels.forEach((_, i) => {
      if (!this.ctrl.wheelIsInContact(i)) return;
      touching++;
      const ground = this.ctrl.wheelGroundObject(i)?.parent();
      if (!ground?.isKinematic()) return;
      const c = ground.translation(), gv = ground.linvel(), gw = ground.angvel();
      // v + ω × r
      const rx = at.x - c.x, ry = at.y - c.y, rz = at.z - c.z;
      this.carryV.x += gv.x + gw.y * rz - gw.z * ry;
      this.carryV.y += gv.y + gw.z * rx - gw.x * rz;
      this.carryV.z += gv.z + gw.x * ry - gw.y * rx;
      this.carryW.x += gw.x, this.carryW.y += gw.y, this.carryW.z += gw.z;
    });
    if (touching === 0 || this.carryW.lengthSq() + this.carryV.lengthSq() === 0) return false;
    this.carryV.multiplyScalar(1 / touching);
    this.carryW.multiplyScalar(1 / touching);
    return true;
  }

  /** Charge, discharge and the soft ramp of the boost battery. */
  private updateBoost(input: DriveInput, dt: number): void {
    const want = !!input.boost && this.boostFitted && input.throttle >= 0 && !input.handbrake;
    const was = this.boosting;
    // A battery, not a capacitor: once run below minCharge it will not fire again until
    // topped back up, which only happens by starting the course over -- see place() below.
    // Where nothing is timed (open world, freestyle) it charges from the driving instead,
    // faster while slowing down.
    if (this.boosting) this.boosting = want && this.boostCharge > 0;
    else this.boosting = want && this.boostCharge >= BOOST.minCharge;
    this.boostKick = this.boosting && !was ? BOOST_KICK : Math.max(0, this.boostKick - dt);
    if (this.boosting) {
      this.boostCharge = Math.max(0, this.boostCharge - dt / BOOST.duration);
    } else if (this.boostRecharge && !input.boost) {
      const slowing = Math.abs(this.speed) > 1 && input.throttle * this.speed <= 0;
      this.boostCharge = Math.min(1, this.boostCharge + (dt / BOOST.recharge) * (slowing ? BOOST.recuperation : 1));
    }
    const step = dt / (this.boosting ? BOOST.rampUp : BOOST.rampDown);
    this.boostRamp = clamp(this.boostRamp + (this.boosting ? step : -step), 0, 1);
    // Smoothstep: no kick at either end.
    this.boost = this.boostRamp * this.boostRamp * (3 - 2 * this.boostRamp);
  }

  /**
   * Glancing off walls: when the chassis touches something upright while driving into it,
   * returns the yaw rate (rad/s) that swings the nose parallel to the wall.
   */
  private wallTurn(dir: number): number {
    let turn = 0;
    this.world.contactPairsWith(this.collider, (other) => {
      const parent = other.parent();
      if (parent && !parent.isFixed()) return;
      // Whatever it is on top of is a bump to ride over, not a wall to turn away from: a kerb,
      // or the next piece of a looping when the springs are flat out and the belly scrapes.
      // Hilly ground is never a wall, however steep a facet of it may be.
      if (other.shapeType() === RAPIER.ShapeType.HeightField) return;
      const half = other.halfExtents();
      if (half) {
        const at = this.body.translation(), to = other.translation(), r = other.rotation();
        this.local.set(at.x - to.x, at.y - to.y, at.z - to.z).applyQuaternion(this.qOther.set(r.x, r.y, r.z, r.w).invert());
        if (this.local.y > half.y) return;
      }
      this.world.contactPair(this.collider, other, (manifold) => {
        const n = manifold.normal();
        // What the wheels stand on is ground, whichever way it faces: half-way up a looping
        // the road is as upright as any wall.
        // (With all wheels off it for a moment, the chassis' own floor stands in.)
        const floor = this.normal.lengthSq() > 0 ? this.normal : this.up;
        const ground = Math.abs(n.x * floor.x + n.y * floor.y + n.z * floor.z);
        if (ground > 0.5) return;
        // The way it wants to go, and the normal turned to face against that.
        const gx = this.fwd.x * dir, gz = this.fwd.z * dir;
        const s = n.x * gx + n.z * gz > 0 ? -1 : 1;
        const nx = n.x * s, nz = n.z * s;
        const into = -(gx * nx + gz * nz);
        if (into <= 0.05) return;
        // (go × n).y tells which way round is the short way to parallel.
        const side = gz * nx - gx * nz;
        turn = clamp(9 * Math.sign(side) * into, -3.5, 3.5);
      });
    });
    return turn;
  }

  /** Wheel centre height offset below its mount, and spin angle, for the visuals. */
  wheelSuspension(i: number): number {
    return this.ctrl.wheelSuspensionLength(i) ?? this.spec.suspensionRest;
  }

  wheelSpin(i: number): number {
    return this.ctrl.wheelRotation(i) ?? 0;
  }

  /** World position where wheel `i` touches the ground, or null in the air. */
  wheelContact(i: number): { x: number; y: number; z: number } | null {
    return this.ctrl.wheelIsInContact(i) ? this.ctrl.wheelContactPoint(i) : null;
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
    this.lastVel.set(0, 0, 0);
    this.latAccel = 0;
    this.boostCharge = 1;
    this.boostRamp = this.boost = 0;
    this.steerTrim = 1;
    this.reverseWait = this.reverseTime = 0;
    this.boosting = false;
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
