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
  /** Steering is limited so cornering stays below this lateral acceleration (m/s²). */
  lateralAccel: 6.5,
  /** Proportional gain of the wheel speed controller (1/s). */
  motorGain: 6,
  /** Gain on the yaw rate error of differential drive (1/s). */
  yawGain: 20,
  /** Deceleration when letting go of the stick: the magnetic brake bites (m/s²). */
  brakeDecel: 5,
  /** Rear side grip multiplier while the handbrake is held. */
  handbrakeSlide: 0.35,
  suspensionCompression: 3.5,
  suspensionRelaxation: 4.5,
};
