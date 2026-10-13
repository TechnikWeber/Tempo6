export type VehicleId = 'wheelchair' | 'scooter';

/** A wheel in chassis space. Forward is +Z, up is +Y, +X is the driver's left. */
export interface WheelSpec {
  x: number;
  y: number;
  z: number;
  radius: number;
  stiffness: number;
  drive?: boolean;
  steer?: boolean;
  /** Free-swivelling wheel without lateral grip. */
  caster?: boolean;
}

export interface VehicleSpec {
  id: VehicleId;
  label: string;
  mass: number;
  /** Half extents of the chassis collider. */
  half: [number, number, number];
  /** Centre of mass relative to the collider centre. */
  com: [number, number, number];
  inertia: [number, number, number];
  suspensionRest: number;
  wheels: WheelSpec[];
  /** Differential drive steers by wheel speed difference and can turn on the spot. */
  differential: boolean;
  /** Maximum yaw rate in rad/s (differential drive). */
  maxYawRate: number;
  /** Maximum steering angle in rad (steered wheels). */
  maxSteer: number;
  wheelbase: number;
}

export const WHEELCHAIR: VehicleSpec = {
  id: 'wheelchair',
  label: 'Elektrorollstuhl',
  mass: 150,
  half: [0.3, 0.22, 0.45],
  com: [0, -0.12, 0],
  inertia: [22, 20, 14],
  suspensionRest: 0.2,
  wheels: [
    { x: 0.3, y: -0.05, z: -0.15, radius: 0.17, stiffness: 60, drive: true },
    { x: -0.3, y: -0.05, z: -0.15, radius: 0.17, stiffness: 60, drive: true },
    { x: 0.24, y: -0.13, z: 0.38, radius: 0.09, stiffness: 25, caster: true },
    { x: -0.24, y: -0.13, z: 0.38, radius: 0.09, stiffness: 25, caster: true },
  ],
  differential: true,
  maxYawRate: 2.6,
  maxSteer: 0,
  wheelbase: 0.53,
};

export const SCOOTER: VehicleSpec = {
  id: 'scooter',
  label: 'Seniorenmobil',
  mass: 170,
  half: [0.28, 0.2, 0.6],
  com: [0, -0.12, -0.08],
  inertia: [30, 28, 14],
  suspensionRest: 0.2,
  wheels: [
    { x: 0.27, y: -0.08, z: -0.42, radius: 0.13, stiffness: 45, drive: true },
    { x: -0.27, y: -0.08, z: -0.42, radius: 0.13, stiffness: 45, drive: true },
    { x: 0.22, y: -0.08, z: 0.45, radius: 0.13, stiffness: 35, steer: true },
    { x: -0.22, y: -0.08, z: 0.45, radius: 0.13, stiffness: 35, steer: true },
  ],
  differential: false,
  maxYawRate: 0,
  maxSteer: 0.6,
  wheelbase: 0.87,
};

export const VEHICLES: Record<VehicleId, VehicleSpec> = { wheelchair: WHEELCHAIR, scooter: SCOOTER };

/** Global handling knobs, live-editable from the debug panel. */
export const HANDLING = {
  /** Tyre grip (friction coefficient of the raycast wheels). */
  grip: 2.0,
  /** Full lock asks for this much lateral acceleration (m/s²). Above about g·0.3/tipHeight the inner wheels lift. */
  lateralAccel: 10,
  /**
   * Height (m) at which cornering force pushes the chassis over. The physics engine
   * applies tyre forces almost at the centre of mass, so the roll is added by hand.
   * 0 = never leans, higher = tips earlier.
   */
  tipHeight: 0.36,
  /**
   * Eases off the steering as the vehicle leans, which is what lets it balance on two
   * wheels instead of going straight over. 0 = no help, 1 = steering fully gone at tipAngle.
   */
  tipAssist: 1,
  /** Lean angle (rad) at which the assist has taken away all steering. */
  tipAngle: 0.45,
  /** How far ahead (s) the assist extrapolates the lean. */
  tipLookahead: 0.25,
  /** Damps the rocking from side to side (N·m·s/rad). */
  rollDamping: 60,
  /** Proportional gain of the wheel speed controller (1/s). */
  motorGain: 6,
  /** Gain on the yaw rate error of differential drive (1/s). */
  yawGain: 20,
  /** Deceleration when letting go of the stick: the magnetic brake bites (m/s²). */
  brakeDecel: 5,
  /** Deceleration when actively braking against the direction of travel, on all wheels (m/s²). */
  footBrake: 10,
  /** Rear side grip multiplier while the handbrake is held. */
  handbrakeSlide: 0.35,
  suspensionCompression: 3.5,
  suspensionRelaxation: 4.5,
};

export const HANDLING_DEFAULTS: Readonly<typeof HANDLING> = { ...HANDLING };
