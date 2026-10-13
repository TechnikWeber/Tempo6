export type VehicleId =
  | 'trex' | 'avanti' | 'avantifx' | 'orkan'
  | 'arrivo'
  | 'eskalation' | 'enix' | 'schubs'
  | 'ekaptn'
  | 'piepmatz' | 'tiger' | 'komet' | 'wagen';

export type CategoryId = 'power' | 'folder' | 'push' | 'tractor' | 'scooter';

/** For testing: everything selectable without paying. */
export const UNLOCK_ALL = true;

/** A wheel in chassis space. Forward is +Z, up is +Y, +X is the driver's left. */
export interface WheelSpec {
  x: number;
  z: number;
  radius: number;
  /** Share of the vehicle weight resting on this wheel; all shares add up to 1. */
  load: number;
  /** Gets motor thrust. */
  drive?: boolean;
  /** Steers by pushing harder or softer than the wheel on the other side. */
  turn?: boolean;
  /** Steered by angle, like a bicycle fork. */
  steer?: boolean;
  /** Free-swivelling wheel without lateral grip. */
  caster?: boolean;
  /** Locked by the handbrake. Defaults to the drive wheels. */
  handbrake?: boolean;
  /** Mount height, derived from radius and ground clearance. */
  y: number;
  /** Spring rate, derived from the load. */
  stiffness: number;
}

export type Brand = 'blue' | 'purple';
export const BRAND_COLORS: Record<Brand, number> = { blue: 0x1565c0, purple: 0x7b2d8e };

/**
 * A driving character: multipliers on top of the vehicle's base numbers.
 * 1 everywhere is the vehicle as specified.
 */
export interface DriveProfile {
  name: string;
  blurb: string;
  /** Top speed. */
  speed: number;
  /** Motor acceleration. */
  accel: number;
  /** How tight it can turn (yaw rate / steering angle). */
  turn: number;
  /** How hard full lock pulls at speed. */
  sharp: number;
  /** How readily it leans and tips. */
  tip: number;
  /** How much the tip assist helps. */
  assist: number;
  /** Tyre grip. */
  grip: number;
  /** Braking, both automatic and on purpose. */
  brake: number;
  /** Strength of the push-stroke pulsing (vehicles with `pushRhythm`). */
  surge?: number;
  /** How far it may rear up before the motor eases off. */
  wheelie?: number;
  /** Hand steering force in m/s² (replaces the vehicle's value). */
  handSteer?: number;
  /** Front-wheel drive: multiplier on the tail stability. */
  fwdStability?: number;
}

const BASE: DriveProfile = { name: 'Serie', blurb: 'So, wie es aus dem Karton kommt.', speed: 1, accel: 1, turn: 1, sharp: 1, tip: 1, assist: 1, grip: 1, brake: 1 };
function prof(name: string, blurb: string, o: Partial<DriveProfile>): DriveProfile {
  return { ...BASE, ...o, name, blurb };
}

export type Look = 'mid' | 'rear' | 'front' | 'heavy' | 'folder' | 'manual' | 'scooter';

export interface VehicleSpec {
  id: VehicleId;
  /** Model name, loosely based on a real product but never its real name. */
  label: string;
  /** Shown only as a colour: on the menu card and as a small badge on the vehicle. */
  brand: Brand;
  /** Candidate driving characters to choose from in the workshop; the first is the default. */
  profiles: DriveProfile[];
  category: CategoryId;
  kind: string;
  blurb: string;
  /** Menu ratings, 1…5. */
  stats: { tempo: number; antritt: number; wendig: number; standfest: number };
  /** Pfand in cents to unlock; 0 = available from the start. */
  unlockPrice: number;

  mass: number;
  /** Half extents of the chassis collider. */
  half: [number, number, number];
  /** Gap between the chassis collider and the ground. */
  clearance: number;
  /** Centre of mass relative to the collider centre. */
  com: [number, number, number];
  inertia: [number, number, number];
  suspensionRest: number;
  wheels: WheelSpec[];
  /** Maximum yaw rate in rad/s (vehicles with `turn` wheels). */
  maxYawRate: number;
  /** Maximum steering angle in rad (vehicles with `steer` wheels). */
  maxSteer: number;
  wheelbase: number;
  /** Multipliers on the tuning stage's top speed and acceleration. */
  speedFactor: number;
  accelFactor: number;
  /** Multipliers on the global tip height and tyre grip. */
  tipFactor: number;
  gripFactor: number;
  /** Turning by hand on the push rims: steering force limit in m/s², independent of the motor. */
  handSteer?: number;
  /** Thrust comes in strokes, like pushing the rims. */
  pushRhythm?: boolean;

  look: Look;
  colors: { body: number; accent: number; seat: number; hub: number };
  /** Add-on drive shown on a manual chair. */
  addon?: 'hubs' | 'joystick' | 'pusher' | 'tractor';
}

/** How far the springs sit compressed at rest. */
const SAG = 0.075;
type WheelInput = Omit<WheelSpec, 'y' | 'stiffness'>;
type SpecInput = Omit<VehicleSpec, 'wheels' | 'suspensionRest' | 'brand'> & { wheels: WheelInput[] };

function define(s: SpecInput): VehicleSpec {
  const suspensionRest = 0.2;
  return {
    ...s,
    // Add-on drives and the folder come from one maker, everything else from the other.
    brand: s.category === 'push' || s.category === 'tractor' || s.category === 'folder' ? 'purple' : 'blue',
    suspensionRest,
    wheels: s.wheels.map((w) => ({
      ...w,
      y: -s.half[1] - s.clearance + w.radius + suspensionRest - SAG,
      // Suspension force is per unit of chassis mass, so the load share sets the spring.
      stiffness: (w.load * 9.81) / SAG,
    })),
  };
}

/** Left/right pair of wheels. */
function pair(x: number, w: Omit<WheelInput, 'x'>): WheelInput[] {
  return [{ ...w, x }, { ...w, x: -x }];
}

const BLUE = 0x1565c0;
const PURPLE = 0x7b2d8e;

export const VEHICLES: Record<VehicleId, VehicleSpec> = {
  trex: define({
    id: 'trex',
    label: 'T-Rex Mitteldreher',
    profiles: [
      BASE,
      prof('Kreisel', 'Dreht sich schneller, als der Magen mitkommt. Kippelig.', { turn: 1.5, sharp: 1.3, accel: 1.2, tip: 1.3, assist: 0.8 }),
      prof('Sänfte', 'Weich, gutmütig, etwas schneller geradeaus.', { turn: 0.7, sharp: 0.75, tip: 0.6, accel: 0.8, speed: 1.1, brake: 0.8 }),
    ],
    category: 'power',
    kind: 'Elektrorollstuhl · Mittelradantrieb',
    blurb: 'Sechs Räder, dreht auf dem Bierdeckel. Der Allrounder für enge Gänge.',
    stats: { tempo: 3, antritt: 3, wendig: 5, standfest: 4 },
    unlockPrice: 0,
    mass: 160,
    half: [0.31, 0.22, 0.48],
    clearance: 0.12,
    com: [0, -0.12, 0],
    inertia: [24, 20, 15],
    wheels: [
      ...pair(0.3, { z: 0, radius: 0.17, load: 0.36, drive: true, turn: true }),
      ...pair(0.22, { z: 0.42, radius: 0.08, load: 0.07, caster: true }),
      ...pair(0.22, { z: -0.42, radius: 0.08, load: 0.07, caster: true }),
    ],
    maxYawRate: 3.0,
    maxSteer: 0,
    wheelbase: 0.84,
    speedFactor: 1,
    accelFactor: 1,
    tipFactor: 1,
    gripFactor: 1,
    look: 'mid',
    colors: { body: 0x2b2f36, accent: BLUE, seat: 0x15161a, hub: 0xb9bcc2 },
  }),

  avanti: define({
    id: 'avanti',
    label: 'Avanti RX',
    profiles: [
      BASE,
      prof('Autobahn', 'Viel Endgeschwindigkeit, stur in der Spur.', { speed: 1.25, accel: 0.9, turn: 0.7, sharp: 0.8, tip: 0.7 }),
      prof('Driftkönig', 'Wenig Grip, viel Lenkung: rutscht, statt zu kippen.', { grip: 0.55, turn: 1.3, sharp: 1.4, accel: 1.3, tip: 0.6 }),
    ],
    category: 'power',
    kind: 'Elektrorollstuhl · Heckantrieb',
    blurb: 'Schlank, schwarz, schnell. Läuft stur geradeaus und mag weite Bögen.',
    stats: { tempo: 4, antritt: 3, wendig: 3, standfest: 4 },
    unlockPrice: 1500,
    mass: 150,
    half: [0.3, 0.22, 0.5],
    clearance: 0.14,
    com: [0, -0.12, 0.02],
    inertia: [22, 20, 14],
    wheels: [
      ...pair(0.3, { z: -0.25, radius: 0.17, load: 0.285, drive: true, turn: true }),
      ...pair(0.24, { z: 0.38, radius: 0.1, load: 0.215, caster: true }),
    ],
    maxYawRate: 2.2,
    maxSteer: 0,
    wheelbase: 0.63,
    speedFactor: 1.12,
    accelFactor: 1,
    tipFactor: 0.9,
    gripFactor: 1,
    look: 'rear',
    colors: { body: 0x17181c, accent: 0x1e88e5, seat: 0x101114, hub: 0x1e88e5 },
  }),

  avantifx: define({
    id: 'avantifx',
    label: 'Avanti FX',
    profiles: [
      BASE,
      prof('Heckschleuder', 'Das Heck macht, was es will.', { fwdStability: 0.55, turn: 1.3, sharp: 1.3, grip: 0.85 }),
      prof('Zugpferd', 'Zieht wie ein Trecker, läuft ruhig.', { accel: 1.4, speed: 0.9, fwdStability: 1.2, turn: 0.85, tip: 0.8 }),
    ],
    category: 'power',
    kind: 'Elektrorollstuhl · Frontantrieb',
    blurb: 'Zieht sich um jede Ecke, klettert über alles. Dafür wedelt bei Tempo das Heck.',
    stats: { tempo: 3, antritt: 4, wendig: 4, standfest: 3 },
    unlockPrice: 1500,
    mass: 150,
    half: [0.3, 0.22, 0.5],
    clearance: 0.14,
    com: [0, -0.12, -0.02],
    inertia: [22, 20, 14],
    wheels: [
      ...pair(0.3, { z: 0.25, radius: 0.17, load: 0.285, drive: true, turn: true }),
      ...pair(0.24, { z: -0.38, radius: 0.1, load: 0.215, caster: true }),
    ],
    maxYawRate: 2.6,
    maxSteer: 0,
    wheelbase: 0.63,
    speedFactor: 1,
    accelFactor: 1.05,
    tipFactor: 1,
    gripFactor: 1,
    look: 'front',
    colors: { body: 0x17181c, accent: 0x29b6f6, seat: 0x101114, hub: 0x29b6f6 },
  }),

  arrivo: define({
    id: 'arrivo',
    label: 'Arrivo Karton',
    profiles: [
      BASE,
      prof('Federgewicht', 'Springt los, dreht sofort, fällt gern um.', { accel: 1.4, turn: 1.3, tip: 1.4, assist: 0.8, brake: 1.2 }),
      prof('Carbon-Renner', 'Steif, schnell, klebt in der Kurve.', { speed: 1.2, sharp: 1.2, grip: 1.2, tip: 0.8, turn: 0.9 }),
    ],
    category: 'folder',
    kind: 'Faltbarer Elektrorollstuhl · Heckantrieb',
    blurb: 'Klappt am Stück zusammen und wiegt fast nichts. Flink, aber der Wind hat Mitspracherecht.',
    stats: { tempo: 3, antritt: 4, wendig: 4, standfest: 2 },
    unlockPrice: 2500,
    mass: 100,
    half: [0.28, 0.2, 0.42],
    clearance: 0.14,
    com: [0, -0.08, 0],
    inertia: [13, 11, 8],
    wheels: [
      ...pair(0.29, { z: -0.22, radius: 0.15, load: 0.305, drive: true, turn: true }),
      ...pair(0.22, { z: 0.34, radius: 0.09, load: 0.195, caster: true }),
    ],
    maxYawRate: 2.8,
    maxSteer: 0,
    wheelbase: 0.56,
    speedFactor: 1,
    accelFactor: 1.15,
    tipFactor: 1.15,
    gripFactor: 1,
    look: 'folder',
    colors: { body: 0x141416, accent: PURPLE, seat: 0x1b1b1f, hub: 0x2a2a2e },
  }),

  orkan: define({
    id: 'orkan',
    label: 'Orkan 4',
    profiles: [
      BASE,
      prof('Panzer', 'Noch träger, unkippbar, bremst wie ein Anker.', { speed: 0.9, accel: 0.7, turn: 0.7, tip: 0.4, grip: 1.3, brake: 1.3 }),
      prof('Dampfhammer', 'Schwer und trotzdem schnell. Bremsen ist Verhandlungssache.', { speed: 1.2, accel: 1.3, turn: 0.9, tip: 0.9, brake: 0.7 }),
    ],
    category: 'power',
    kind: 'Elektrorollstuhl · Heckantrieb, schwer',
    blurb: 'Der Panzer. Kommt langsam in Fahrt und räumt dann alles ab.',
    stats: { tempo: 3, antritt: 2, wendig: 2, standfest: 5 },
    unlockPrice: 3000,
    mass: 200,
    half: [0.33, 0.25, 0.56],
    clearance: 0.14,
    com: [0, -0.14, 0],
    inertia: [36, 32, 20],
    wheels: [
      ...pair(0.33, { z: -0.28, radius: 0.2, load: 0.3, drive: true, turn: true }),
      ...pair(0.27, { z: 0.42, radius: 0.12, load: 0.2, caster: true }),
    ],
    maxYawRate: 1.9,
    maxSteer: 0,
    wheelbase: 0.7,
    speedFactor: 1.05,
    accelFactor: 0.85,
    tipFactor: 0.75,
    gripFactor: 1.1,
    look: 'heavy',
    colors: { body: 0x26282d, accent: 0xc3c7cc, seat: 0x15161a, hub: 0xc9ccd1 },
  }),

  eskalation: define({
    id: 'eskalation',
    label: 'e-skalation',
    profiles: [
      BASE,
      prof('Wheelie-Maschine', 'Jeder Schubs ein Tritt. Das Vorderrad ist Deko.', { accel: 1.5, surge: 1.7, wheelie: 1.15, tip: 1.2, turn: 1.2 }),
      prof('Gleiter', 'Gleichmäßiger Schub, mehr Tempo, ruhiger.', { surge: 0.25, accel: 0.9, speed: 1.15, tip: 0.8, turn: 0.85 }),
    ],
    category: 'push',
    kind: 'Faltrollstuhl · Radnabenmotoren im Rad',
    blurb: 'Motoren in den Rädern verstärken jeden Schubs. Leicht, zappelig, liebt das Hinterrad.',
    stats: { tempo: 2, antritt: 5, wendig: 5, standfest: 1 },
    unlockPrice: 1000,
    mass: 95,
    half: [0.28, 0.2, 0.4],
    clearance: 0.2,
    com: [0, -0.05, -0.03],
    inertia: [12, 10, 8],
    wheels: [
      ...pair(0.31, { z: -0.15, radius: 0.3, load: 0.37, drive: true, turn: true }),
      ...pair(0.2, { z: 0.32, radius: 0.06, load: 0.13, caster: true }),
    ],
    maxYawRate: 3.0,
    maxSteer: 0,
    wheelbase: 0.47,
    speedFactor: 0.9,
    accelFactor: 1.25,
    tipFactor: 0.95,
    gripFactor: 1,
    pushRhythm: true,
    look: 'manual',
    addon: 'hubs',
    colors: { body: 0x2a2a2e, accent: PURPLE, seat: 0x1b1b1f, hub: 0xf2f2f2 },
  }),

  enix: define({
    id: 'enix',
    label: 'e-nix',
    profiles: [
      BASE,
      prof('Begleitperson', 'Jemand anderes lenkt von hinten. Vorsichtig. Sehr vorsichtig.', { accel: 0.7, turn: 0.7, speed: 0.85, tip: 0.7, brake: 1.2 }),
      prof('Joystick-Junkie', 'Daumen am Anschlag, immer.', { accel: 1.4, turn: 1.4, sharp: 1.3, tip: 1.2 }),
    ],
    category: 'push',
    kind: 'Faltrollstuhl · Radnabenmotoren mit Joystick',
    blurb: 'Macht aus dem Faltrollstuhl einen Elektrorollstuhl. Fährt per Joystick, auf Wunsch lenkt die Begleitung von hinten.',
    stats: { tempo: 2, antritt: 3, wendig: 4, standfest: 3 },
    unlockPrice: 1500,
    mass: 110,
    half: [0.28, 0.2, 0.4],
    clearance: 0.2,
    com: [0, -0.08, 0],
    inertia: [13, 11, 8],
    wheels: [
      ...pair(0.31, { z: -0.15, radius: 0.3, load: 0.34, drive: true, turn: true }),
      ...pair(0.2, { z: 0.32, radius: 0.06, load: 0.16, caster: true }),
    ],
    maxYawRate: 2.6,
    maxSteer: 0,
    wheelbase: 0.47,
    speedFactor: 0.95,
    accelFactor: 1,
    tipFactor: 1.1,
    gripFactor: 1,
    look: 'manual',
    addon: 'joystick',
    colors: { body: 0x2a2a2e, accent: PURPLE, seat: 0x1b1b1f, hub: 0x2a2a2e },
  }),

  schubs: define({
    id: 'schubs',
    label: 'schubs one',
    profiles: [
      BASE,
      prof('Bärenkräfte', 'Arme wie ein Türsteher: lenkt und bremst richtig.', { handSteer: 9, brake: 1.7, turn: 1.3 }),
      prof('Rakete', 'Schiebt gewaltig. Lenken und Bremsen eher theoretisch.', { speed: 1.3, accel: 1.4, handSteer: 3, brake: 0.7, tip: 1.1 }),
    ],
    category: 'push',
    kind: 'Faltrollstuhl · Schiebehilfe am Heck',
    blurb: 'Ein kleines Rad schiebt von hinten. Geradeaus top, Kurven sind Handarbeit.',
    stats: { tempo: 3, antritt: 2, wendig: 2, standfest: 2 },
    unlockPrice: 2000,
    mass: 100,
    half: [0.28, 0.2, 0.4],
    clearance: 0.2,
    com: [0, -0.05, -0.08],
    inertia: [12, 10, 8],
    wheels: [
      ...pair(0.31, { z: -0.15, radius: 0.3, load: 0.34, turn: true, handbrake: true }),
      ...pair(0.2, { z: 0.32, radius: 0.06, load: 0.08, caster: true }),
      { x: 0, z: -0.42, radius: 0.1, load: 0.16, drive: true, handbrake: false },
    ],
    maxYawRate: 2.2,
    maxSteer: 0,
    wheelbase: 0.47,
    speedFactor: 1,
    accelFactor: 1,
    tipFactor: 0.95,
    gripFactor: 1,
    handSteer: 4,
    look: 'manual',
    addon: 'pusher',
    colors: { body: 0x2a2a2e, accent: 0x9ccc3c, seat: 0x1b1b1f, hub: 0x8d9299 },
  }),

  ekaptn: define({
    id: 'ekaptn',
    label: "e-käpt'n",
    profiles: [
      BASE,
      prof('Chopper', 'Lang, stabil, cruist. Enge Kurven sind nicht sein Ding.', { speed: 1.15, turn: 0.7, sharp: 0.8, tip: 0.6, accel: 0.9 }),
      prof('Dreirad des Todes', 'Schneller, giftiger, kippt beim Hinschauen.', { speed: 1.25, accel: 1.4, turn: 1.2, sharp: 1.2, tip: 1.15, assist: 0.9 }),
    ],
    category: 'tractor',
    kind: 'Faltrollstuhl · Zuggerät vorn',
    blurb: 'Die Legende. Ein Motorrad zum Anklemmen: drei Räder, Lenker, viel zu schnell.',
    stats: { tempo: 5, antritt: 3, wendig: 3, standfest: 1 },
    unlockPrice: 5000,
    mass: 110,
    half: [0.28, 0.2, 0.62],
    clearance: 0.2,
    com: [0, -0.05, -0.1],
    inertia: [14, 16, 9],
    wheels: [
      ...pair(0.31, { z: -0.35, radius: 0.3, load: 0.37, handbrake: true }),
      { x: 0, z: 0.6, radius: 0.2, load: 0.26, drive: true, steer: true, handbrake: false },
    ],
    maxYawRate: 0,
    maxSteer: 0.7,
    wheelbase: 0.95,
    speedFactor: 1.3,
    accelFactor: 1,
    tipFactor: 0.3,
    gripFactor: 1,
    look: 'manual',
    addon: 'tractor',
    colors: { body: 0x2a2a2e, accent: PURPLE, seat: 0x1b1b1f, hub: 0x8d9299 },
  }),

  piepmatz: define({
    id: 'piepmatz',
    label: 'Piepmatz',
    profiles: [
      BASE,
      prof('Spatz auf Koffein', 'Zappelt los und schlägt Haken.', { accel: 1.5, turn: 1.2, sharp: 1.4, tip: 1.4, assist: 0.8 }),
      prof('Brav', 'Kippt kaum noch, dafür gemütlicher.', { tip: 0.6, turn: 0.85, accel: 0.8, speed: 1.1 }),
    ],
    category: 'scooter',
    kind: 'Seniorenmobil · zerlegbar, winzig',
    blurb: 'Passt in jeden Kofferraum und durch jede Lücke. Kippt, wenn man es böse anschaut.',
    stats: { tempo: 2, antritt: 4, wendig: 5, standfest: 1 },
    unlockPrice: 500,
    mass: 115,
    half: [0.23, 0.18, 0.45],
    clearance: 0.12,
    com: [0, -0.1, -0.06],
    inertia: [15, 14, 8],
    wheels: [
      ...pair(0.22, { z: -0.32, radius: 0.1, load: 0.3, drive: true }),
      ...pair(0.18, { z: 0.33, radius: 0.1, load: 0.2, steer: true }),
    ],
    maxYawRate: 0,
    maxSteer: 0.8,
    wheelbase: 0.65,
    speedFactor: 0.85,
    accelFactor: 1.15,
    tipFactor: 0.85,
    gripFactor: 1,
    look: 'scooter',
    colors: { body: 0x19b5a5, accent: 0xffd23f, seat: 0x24262b, hub: 0xd9d9d9 },
  }),

  tiger: define({
    id: 'tiger',
    label: 'Stubentiger',
    profiles: [
      BASE,
      prof('Raubkatze', 'Bissiger Antritt, scharfe Lenkung, guter Grip.', { accel: 1.4, sharp: 1.3, turn: 1.15, grip: 1.2, tip: 1.1 }),
      prof('Schmusekater', 'Sanft in allem. Für die Fahrt zum Bäcker.', { accel: 0.75, tip: 0.6, turn: 0.9, brake: 0.8, speed: 1.05 }),
    ],
    category: 'scooter',
    kind: 'Seniorenmobil · kompakt',
    blurb: 'Der kleine Bruder vom Löwen. Wendig genug für den Wochenmarkt, brav genug für Oma.',
    stats: { tempo: 3, antritt: 3, wendig: 4, standfest: 3 },
    unlockPrice: 1000,
    mass: 150,
    half: [0.27, 0.2, 0.55],
    clearance: 0.14,
    com: [0, -0.12, -0.07],
    inertia: [24, 22, 12],
    wheels: [
      ...pair(0.26, { z: -0.38, radius: 0.12, load: 0.3, drive: true }),
      ...pair(0.21, { z: 0.4, radius: 0.12, load: 0.2, steer: true }),
    ],
    maxYawRate: 0,
    maxSteer: 0.7,
    wheelbase: 0.78,
    speedFactor: 0.95,
    accelFactor: 1.05,
    tipFactor: 0.8,
    gripFactor: 1,
    look: 'scooter',
    colors: { body: 0xd97a1e, accent: 0x1a1a1a, seat: 0x24262b, hub: 0xd9d9d9 },
  }),

  komet: define({
    id: 'komet',
    label: 'Sternschnuppe 4',
    profiles: [
      BASE,
      prof('Sonntagsfahrer', 'Gemächlich und standfest.', { accel: 0.7, speed: 0.9, tip: 0.5, turn: 0.9, sharp: 0.8 }),
      prof('Einkaufsrowdy', 'Flott, rutschig, eng ums Regal.', { accel: 1.3, turn: 1.2, sharp: 1.3, grip: 0.75, tip: 0.9 }),
    ],
    category: 'scooter',
    kind: 'Seniorenmobil · vier Räder',
    blurb: 'Der Klassiker mit Einkaufskorb und Wimpel. Lenkt wie ein Auto, wendet wie ein Tanker.',
    stats: { tempo: 3, antritt: 3, wendig: 2, standfest: 3 },
    unlockPrice: 500,
    mass: 170,
    half: [0.28, 0.2, 0.6],
    clearance: 0.15,
    com: [0, -0.12, -0.08],
    inertia: [30, 28, 14],
    wheels: [
      ...pair(0.27, { z: -0.42, radius: 0.13, load: 0.305, drive: true }),
      ...pair(0.22, { z: 0.45, radius: 0.13, load: 0.195, steer: true }),
    ],
    maxYawRate: 0,
    maxSteer: 0.6,
    wheelbase: 0.87,
    speedFactor: 1,
    accelFactor: 1,
    tipFactor: 0.8,
    gripFactor: 1,
    look: 'scooter',
    colors: { body: 0xb3202a, accent: 0xff7a00, seat: 0x24262b, hub: 0xd9d9d9 },
  }),

  wagen: define({
    id: 'wagen',
    label: 'Großer Wagen',
    profiles: [
      BASE,
      prof('Reisebus', 'Noch schneller, noch träger, kippt nie.', { speed: 1.2, accel: 0.75, turn: 0.75, tip: 0.5 }),
      prof('Sportcoupé', 'Der Lange kann auch zackig.', { accel: 1.3, turn: 1.3, sharp: 1.2, grip: 1.2 }),
    ],
    category: 'scooter',
    kind: 'Seniorenmobil · Langstrecke',
    blurb: 'Das Sternbild unter den Seniorenmobilen. Lang, schwer, schnell, mit dem Wendekreis einer Fähre.',
    stats: { tempo: 4, antritt: 2, wendig: 1, standfest: 5 },
    unlockPrice: 4000,
    mass: 200,
    half: [0.31, 0.2, 0.7],
    clearance: 0.17,
    com: [0, -0.12, -0.1],
    inertia: [38, 36, 18],
    wheels: [
      ...pair(0.3, { z: -0.5, radius: 0.15, load: 0.305, drive: true }),
      ...pair(0.25, { z: 0.52, radius: 0.15, load: 0.195, steer: true }),
    ],
    maxYawRate: 0,
    maxSteer: 0.5,
    wheelbase: 1.02,
    speedFactor: 1.15,
    accelFactor: 0.9,
    tipFactor: 0.8,
    gripFactor: 1,
    look: 'scooter',
    colors: { body: 0x1f3f7a, accent: 0xff7a00, seat: 0x24262b, hub: 0xd9d9d9 },
  }),
};

/** Menu groups. The titles stay close to what the trade calls these things. */
export const CATEGORIES: { id: CategoryId; title: string; vehicles: VehicleId[] }[] = [
  { id: 'power', title: 'Vollpower Wheelchairs', vehicles: ['trex', 'avanti', 'avantifx', 'orkan'] },
  { id: 'folder', title: 'One-Piece-Falter', vehicles: ['arrivo'] },
  { id: 'push', title: 'Schubshilfen', vehicles: ['eskalation', 'enix', 'schubs'] },
  { id: 'tractor', title: 'Zugmaschinen', vehicles: ['ekaptn'] },
  { id: 'scooter', title: 'Rentnerblitze', vehicles: ['piepmatz', 'tiger', 'komet', 'wagen'] },
];

export const VEHICLE_ORDER: VehicleId[] = CATEGORIES.flatMap((c) => c.vehicles);

/** Height of the ground below the chassis origin when standing on level ground. */
export function groundY(spec: VehicleSpec): number {
  return -spec.half[1] - spec.clearance;
}

/** Global handling knobs, live-editable from the debug panel. */
export const HANDLING = {
  /** Tyre grip (friction coefficient of the raycast wheels). */
  grip: 2.0,
  /** Full lock asks for this much lateral acceleration (m/s²). Above about g·0.3/tipHeight the inner wheels lift. */
  lateralAccel: 12,
  /** How far (rad) the model swings its tail out under full cornering load. Looks only. */
  driftAngle: 0.2,
  /** In the air the chassis rights itself so it lands on its wheels. 0 = tumble freely. */
  airControl: 1,
  /**
   * Height (m) at which cornering force pushes the chassis over. The physics engine
   * applies tyre forces almost at the centre of mass, so the roll is added by hand.
   * 0 = never leans, higher = tips earlier.
   */
  tipHeight: 0.22,
  /**
   * Eases off the steering as the vehicle leans, which is what lets it balance on two
   * wheels instead of going straight over. 0 = no help, 1 = steering fully gone at tipAngle.
   */
  tipAssist: 1,
  /** Lean angle (rad) at which the assist has taken away all steering. */
  tipAngle: 0.55,
  /** How far ahead (s) the assist extrapolates the lean. */
  tipLookahead: 0.25,
  /** Damps the rocking from side to side (N·m·s/rad). Higher = leans over more slowly. */
  rollDamping: 110,
  /** Proportional gain of the wheel speed controller (1/s). */
  motorGain: 6,
  /** Gain on the yaw rate error of differential drive (1/s). */
  yawGain: 20,
  /** Front-wheel drive: share of the tail-happy yaw torque that gets cancelled. Below 1 the rear steps out. */
  fwdStability: 0.9,
  /** Deceleration when letting go of the stick: the magnetic brake bites (m/s²). */
  brakeDecel: 5,
  /** Deceleration when actively braking against the direction of travel, on all wheels (m/s²). */
  footBrake: 10,
  /** Rear side grip multiplier while the handbrake is held. */
  handbrakeSlide: 0.35,
  suspensionCompression: 3.0,
  suspensionRelaxation: 3.8,
  /** How much the body visibly sways on its springs, on top of the physics. */
  bodySway: 1,
};

export const HANDLING_DEFAULTS: Readonly<typeof HANDLING> = { ...HANDLING };
