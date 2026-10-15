import { L } from '../i18n';
export type VehicleId =
  | 'trex' | 'avanti' | 'avantifx' | 'orkan' | 'sprite'
  | 'arrivo'
  | 'eskalation' | 'enix' | 'schubs'
  | 'ekaptn'
  | 'piepmatz' | 'tiger' | 'komet' | 'wagen';

export type CategoryId = 'power' | 'folder' | 'push' | 'tractor' | 'scooter';

/** For testing: everything selectable without paying. */
export const UNLOCK_ALL = false;

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
  /** Multiplier on how much of the tyres' grip full lock asks for (`HANDLING.gripUse`). Above about 1.2 it drifts. */
  slide?: number;
}

const BASE: DriveProfile = { name: L('Serie', 'Stock'), blurb: L('So, wie es aus dem Karton kommt.', 'Just as it comes out of the box.'), speed: 1, accel: 1, turn: 1, sharp: 1, tip: 1, assist: 1, grip: 1, brake: 1 };
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
  /** Schrauben to unlock; 0 = available from the start. */
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
    label: 'TDFiX',
    profiles: [
      BASE,
      prof(L('Kreisel', 'Spinner'), L('Dreht sich schneller, als der Magen mitkommt. Kippelig.', 'Turns faster than your stomach can follow. Tippy.'), { turn: 1.5, sharp: 1.3, accel: 1.2, tip: 1.05, assist: 0.8 }),
      prof(L('Sänfte', 'Sedan Chair'), L('Weich, gutmütig, etwas schneller geradeaus.', 'Soft, forgiving, a little quicker in a straight line.'), { turn: 0.7, sharp: 0.75, tip: 0.6, accel: 0.8, speed: 1.1, brake: 0.8 }),
    ],
    category: 'power',
    kind: L('Elektrorollstuhl · Mittelradantrieb', 'Power wheelchair · mid-wheel drive'),
    blurb: L('Sechs Räder, dreht auf dem Bierdeckel. Der Allrounder für enge Gänge.', 'Six wheels, turns on a beer mat. The all-rounder for narrow corridors.'),
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
      prof(L('Autobahn', 'Autobahn'), L('Viel Endgeschwindigkeit, stur in der Spur.', 'Lots of top speed, dead set on its lane.'), { speed: 1.25, accel: 0.9, turn: 0.7, sharp: 0.8, tip: 0.7 }),
      prof(L('Driftkönig', 'Drift King'), L('Wenig Grip, viel Lenkung: rutscht, statt zu kippen.', 'Little grip, lots of steering: it slides instead of tipping.'), { grip: 0.65, slide: 1.6, turn: 1.3, sharp: 1.4, accel: 1.3, tip: 0.6 }),
    ],
    category: 'power',
    kind: L('Elektrorollstuhl · Heckantrieb', 'Power wheelchair · rear-wheel drive'),
    blurb: L('Schlank, schwarz, schnell. Läuft stur geradeaus und mag weite Bögen.', 'Slim, black, fast. Runs dead straight and likes wide arcs.'),
    stats: { tempo: 4, antritt: 3, wendig: 3, standfest: 4 },
    unlockPrice: 75,
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
      prof(L('Heckschleuder', 'Tail Slinger'), L('Das Heck macht, was es will.', 'The tail does what it likes.'), { fwdStability: 0.95, turn: 1.15, sharp: 1.2, tip: 0.85 }),
      prof(L('Zugpferd', 'Workhorse'), L('Zieht wie ein Trecker, läuft ruhig.', 'Pulls like a tractor, runs calm.'), { accel: 1.4, speed: 0.9, fwdStability: 1.2, turn: 0.85, tip: 0.8 }),
    ],
    category: 'power',
    kind: L('Elektrorollstuhl · Frontantrieb', 'Power wheelchair · front-wheel drive'),
    blurb: L('Zieht sich um jede Ecke, klettert über alles. Dafür wedelt bei Tempo das Heck.', 'Pulls itself round any corner, climbs over anything. At speed the tail wags.'),
    stats: { tempo: 3, antritt: 4, wendig: 4, standfest: 3 },
    unlockPrice: 75,
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
    tipFactor: 0.8,
    gripFactor: 1,
    look: 'front',
    colors: { body: 0x17181c, accent: 0x29b6f6, seat: 0x101114, hub: 0x29b6f6 },
  }),

  // The same frame as the Arrivo, not a copy of its numbers: the battery sits up front
  // under the seat instead of in the folding hinge, so there is nothing left to fold, and
  // the extra weight over the casters makes it a little steadier, a little less eager.
  sprite: define({
    id: 'sprite',
    label: 'Sprite',
    profiles: [
      BASE,
      prof(L('Federgewicht', 'Featherweight'), L('Springt los, dreht sofort, fällt gern um.', 'Leaps off, turns at once, likes falling over.'), { accel: 1.4, turn: 1.3, sharp: 1.15, tip: 1.0, assist: 0.8, brake: 1.2 }),
      prof(L('Carbon-Renner', 'Carbon Racer'), L('Steif, schnell, klebt in der Kurve.', 'Stiff, fast, glued to the corner.'), { speed: 1.2, sharp: 1.2, grip: 1.2, tip: 0.8, turn: 0.9 }),
    ],
    category: 'folder',
    kind: L('Elektrorollstuhl · Heckantrieb, Batterie vorn unterm Sitz', 'Power wheelchair · rear-wheel drive, battery under the seat, up front'),
    blurb: L('Der gleiche Rahmen wie beim Arrivo Karton, aber kein Nachbau: die Batterie sitzt vorn unterm Sitz statt im Klappgelenk, darum ist hier nichts mehr zum Zusammenklappen. Das Mehrgewicht vorn macht ihn etwas ruhiger, dafür etwas behäbiger.', 'The same frame as the Arrivo Cardboard, but not a copy: the battery sits up front, under the seat, instead of in the folding hinge, so there is nothing left here to fold. The extra weight up front makes it a little calmer, if a little less eager.'),
    stats: { tempo: 3, antritt: 3, wendig: 4, standfest: 3 },
    unlockPrice: 110,
    mass: 108,
    half: [0.28, 0.2, 0.42],
    clearance: 0.14,
    com: [0, -0.08, 0.03],
    inertia: [14, 12, 9],
    wheels: [
      ...pair(0.29, { z: -0.22, radius: 0.15, load: 0.28, drive: true, turn: true }),
      ...pair(0.22, { z: 0.34, radius: 0.09, load: 0.22, caster: true }),
    ],
    maxYawRate: 2.8,
    maxSteer: 0,
    wheelbase: 0.56,
    speedFactor: 1,
    accelFactor: 1.08,
    tipFactor: 1.0,
    gripFactor: 1,
    look: 'folder',
    colors: { body: 0x1c1f24, accent: PURPLE, seat: 0x15161a, hub: 0xc9ccd1 },
  }),

  arrivo: define({
    id: 'arrivo',
    label: L('Arrivo Karton', 'Arrivo Cardboard'),
    profiles: [
      BASE,
      prof(L('Federgewicht', 'Featherweight'), L('Springt los, dreht sofort, fällt gern um.', 'Leaps off, turns at once, likes falling over.'), { accel: 1.4, turn: 1.3, sharp: 1.15, tip: 1.0, assist: 0.8, brake: 1.2 }),
      prof(L('Carbon-Renner', 'Carbon Racer'), L('Steif, schnell, klebt in der Kurve.', 'Stiff, fast, glued to the corner.'), { speed: 1.2, sharp: 1.2, grip: 1.2, tip: 0.8, turn: 0.9 }),
    ],
    category: 'folder',
    kind: L('Faltbarer Elektrorollstuhl · Heckantrieb', 'Folding power wheelchair · rear-wheel drive'),
    blurb: L('Klappt am Stück zusammen und wiegt fast nichts. Flink, aber der Wind hat Mitspracherecht.', 'Folds up in one piece and weighs next to nothing. Nimble, but the wind has a say.'),
    stats: { tempo: 3, antritt: 4, wendig: 4, standfest: 2 },
    unlockPrice: 110,
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
    label: L('Strom4', 'Volt4'),
    profiles: [
      BASE,
      prof(L('Panzer', 'Tank'), L('Noch träger, unkippbar, bremst wie ein Anker.', 'Even slower to get going, untippable, brakes like an anchor.'), { speed: 0.9, accel: 0.7, turn: 0.7, tip: 0.4, grip: 1.3, brake: 1.3 }),
      prof(L('Dampfhammer', 'Steam Hammer'), L('Schwer und trotzdem schnell. Bremsen ist Verhandlungssache.', 'Heavy and still fast. Braking is up for negotiation.'), { speed: 1.2, accel: 1.3, turn: 0.9, tip: 0.9, brake: 0.7 }),
    ],
    category: 'power',
    kind: L('Elektrorollstuhl · Heckantrieb, schwer', 'Power wheelchair · rear-wheel drive, heavy'),
    blurb: L('Der Panzer. Kommt langsam in Fahrt und räumt dann alles ab.', 'The tank. Slow to get going, then it clears everything away.'),
    stats: { tempo: 3, antritt: 2, wendig: 2, standfest: 5 },
    unlockPrice: 125,
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
    label: L('e-skalation', 'e-scalation'),
    profiles: [
      BASE,
      prof(L('Wheelie-Maschine', 'Wheelie Machine'), L('Jeder Schubs ein Tritt. Das Vorderrad ist Deko.', 'Every push a kick. The front wheels are decoration.'), { accel: 1.5, surge: 1.7, wheelie: 1.15, tip: 1.2, turn: 1.2 }),
      prof(L('Gleiter', 'Glider'), L('Gleichmäßiger Schub, mehr Tempo, ruhiger.', 'Even thrust, more speed, calmer.'), { surge: 0.25, accel: 0.9, speed: 1.15, tip: 0.8, turn: 0.85 }),
    ],
    category: 'push',
    kind: L('Faltrollstuhl · Radnabenmotoren im Rad', 'Folding wheelchair · hub motors in the wheels'),
    blurb: L('Motoren in den Rädern verstärken jeden Schubs. Leicht, zappelig, liebt das Hinterrad.', 'Motors in the wheels boost every push. Light, twitchy, loves a wheelie.'),
    stats: { tempo: 2, antritt: 5, wendig: 5, standfest: 1 },
    unlockPrice: 50,
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
    label: 'e-six(7)',
    profiles: [
      BASE,
      prof(L('Begleitperson', 'Attendant'), L('Jemand anderes lenkt von hinten. Vorsichtig. Sehr vorsichtig.', 'Someone else steers from behind. Carefully. Very carefully.'), { accel: 0.7, turn: 0.7, speed: 0.85, tip: 0.7, brake: 1.2 }),
      prof(L('Joystick-Junkie', 'Joystick Junkie'), L('Daumen am Anschlag, immer.', 'Thumb against the stop, always.'), { accel: 1.4, turn: 1.4, sharp: 1.3, tip: 1.0 }),
    ],
    category: 'push',
    kind: L('Faltrollstuhl · Radnabenmotoren mit Joystick', 'Folding wheelchair · hub motors with joystick'),
    blurb: L('Macht aus dem Faltrollstuhl einen Elektrorollstuhl. Fährt per Joystick, auf Wunsch lenkt die Begleitung von hinten.', 'Turns the folding chair into a power chair. Driven by joystick, or steered by an attendant from behind.'),
    stats: { tempo: 2, antritt: 3, wendig: 4, standfest: 3 },
    unlockPrice: 75,
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
    label: L('Arschtritt 3000', 'Kick-Ass 3000'),
    profiles: [
      BASE,
      prof(L('Bärenkräfte', 'Bear Arms'), L('Arme wie ein Türsteher: lenkt und bremst richtig.', 'Arms like a bouncer: steers and brakes properly.'), { handSteer: 9, brake: 1.7, turn: 1.3 }),
      prof(L('Rakete', 'Rocket'), L('Schiebt gewaltig. Lenken und Bremsen eher theoretisch.', 'Pushes like mad. Steering and braking are more of a theory.'), { speed: 1.3, accel: 1.4, handSteer: 3, brake: 0.7, tip: 1.1 }),
    ],
    category: 'push',
    kind: L('Faltrollstuhl · Schiebehilfe am Heck', 'Folding wheelchair · push aid at the back'),
    blurb: L('Ein kleines Rad schiebt von hinten. Geradeaus top, Kurven sind Handarbeit.', 'A small wheel pushes from behind. Great in a straight line, corners are handiwork.'),
    stats: { tempo: 3, antritt: 2, wendig: 2, standfest: 2 },
    unlockPrice: 100,
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
    label: L('e-kapitän', 'e-captain'),
    profiles: [
      BASE,
      prof(L('Chopper', 'Chopper'), L('Lang, stabil, cruist. Enge Kurven sind nicht sein Ding.', 'Long, steady, cruising. Tight corners are not its thing.'), { speed: 1.15, turn: 0.7, sharp: 0.8, tip: 0.6, accel: 0.9 }),
      prof(L('Dreirad des Todes', 'Trike of Doom'), L('Schneller, giftiger, kippt beim Hinschauen.', 'Faster, nastier, tips over if you look at it.'), { speed: 1.25, accel: 1.4, turn: 1.2, sharp: 1.2, tip: 1.15, assist: 0.9 }),
    ],
    category: 'tractor',
    kind: L('Faltrollstuhl · Zuggerät vorn', 'Folding wheelchair · tractor unit in front'),
    blurb: L('Die Legende. Ein Motorrad zum Anklemmen: drei Räder, Lenker, viel zu schnell.', 'The legend. A clip-on motorbike: three wheels, handlebars, far too fast.'),
    stats: { tempo: 5, antritt: 3, wendig: 3, standfest: 1 },
    unlockPrice: 175,
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
    label: L('Kohlibri', 'Hummingbird'),
    profiles: [
      BASE,
      prof(L('Spatz auf Koffein', 'Sparrow on Caffeine'), L('Zappelt los und schlägt Haken.', 'Darts off and zigzags.'), { accel: 1.5, turn: 1.2, sharp: 1.25, tip: 1.05, assist: 0.8 }),
      prof(L('Brav', 'Well-Behaved'), L('Kippt kaum noch, dafür gemütlicher.', 'Hardly tips any more, but more leisurely.'), { tip: 0.6, turn: 0.85, accel: 0.8, speed: 1.1 }),
    ],
    category: 'scooter',
    kind: L('Seniorenmobil · zerlegbar, winzig', 'Mobility scooter · takes apart, tiny'),
    blurb: L('Passt in jeden Kofferraum und durch jede Lücke. Kippt, wenn man es böse anschaut.', 'Fits in any boot and through any gap. Tips over if you give it a dirty look.'),
    stats: { tempo: 2, antritt: 4, wendig: 5, standfest: 1 },
    unlockPrice: 25,
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
    tipFactor: 0.7,
    gripFactor: 1,
    look: 'scooter',
    colors: { body: 0x19b5a5, accent: 0xffd23f, seat: 0x24262b, hub: 0xd9d9d9 },
  }),

  tiger: define({
    id: 'tiger',
    label: 'Lion',
    profiles: [
      BASE,
      prof(L('Raubkatze', 'Big Cat'), L('Bissiger Antritt, scharfe Lenkung, guter Grip.', 'Snappy pull-away, sharp steering, good grip.'), { accel: 1.4, sharp: 1.3, turn: 1.15, grip: 1.2, tip: 1.1 }),
      prof(L('Schmusekater', 'Cuddle Cat'), L('Sanft in allem. Für die Fahrt zum Bäcker.', 'Gentle in everything. For the trip to the bakery.'), { accel: 0.75, tip: 0.6, turn: 0.9, brake: 0.8, speed: 1.05 }),
    ],
    category: 'scooter',
    kind: L('Seniorenmobil · kompakt', 'Mobility scooter · compact'),
    blurb: L('Der kleine Bruder vom Löwen. Wendig genug für den Wochenmarkt, brav genug für Oma.', 'The lion’s little brother. Nimble enough for the market, tame enough for Grandma.'),
    stats: { tempo: 3, antritt: 3, wendig: 4, standfest: 3 },
    unlockPrice: 50,
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
    label: 'Covid Pro',
    profiles: [
      BASE,
      prof(L('Sonntagsfahrer', 'Sunday Driver'), L('Gemächlich und standfest.', 'Leisurely and steady.'), { accel: 0.7, speed: 0.9, tip: 0.5, turn: 0.9, sharp: 0.8 }),
      prof(L('Einkaufsrowdy', 'Shopping Hooligan'), L('Flott, rutschig, eng ums Regal.', 'Quick, slippery, tight round the shelves.'), { accel: 1.3, turn: 1.2, sharp: 1.3, grip: 0.75, tip: 0.9 }),
    ],
    category: 'scooter',
    kind: L('Seniorenmobil · vier Räder', 'Mobility scooter · four wheels'),
    blurb: L('Der Klassiker mit Einkaufskorb und Wimpel. Lenkt wie ein Auto, wendet wie ein Tanker.', 'The classic with a shopping basket and a pennant. Steers like a car, turns like a tanker.'),
    stats: { tempo: 3, antritt: 3, wendig: 2, standfest: 3 },
    unlockPrice: 25,
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
    label: 'Olivion',
    profiles: [
      BASE,
      prof(L('Reisebus', 'Coach'), L('Noch schneller, noch träger, kippt nie.', 'Even faster, even slower to turn, never tips.'), { speed: 1.2, accel: 0.75, turn: 0.75, tip: 0.5 }),
      prof(L('Sportcoupé', 'Sports Coupé'), L('Der Lange kann auch zackig.', 'The long one can be snappy too.'), { accel: 1.3, turn: 1.3, sharp: 1.2, grip: 1.2 }),
    ],
    category: 'scooter',
    kind: L('Seniorenmobil · Langstrecke', 'Mobility scooter · long range'),
    blurb: L('Das Sternbild unter den Seniorenmobilen. Lang, schwer, schnell, mit dem Wendekreis einer Fähre.', 'The constellation among mobility scooters. Long, heavy, fast, with the turning circle of a ferry.'),
    stats: { tempo: 4, antritt: 2, wendig: 1, standfest: 5 },
    unlockPrice: 150,
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
  { id: 'power', title: L('Bordstein-Brecher', 'Kerb Crushers'), vehicles: ['trex', 'avanti', 'avantifx', 'orkan'] },
  { id: 'folder', title: L('Falt(en)wunder', 'Fold Wonders'), vehicles: ['arrivo', 'sprite'] },
  { id: 'push', title: 'Power Addons', vehicles: ['eskalation', 'enix', 'schubs'] },
  { id: 'tractor', title: L('Vorderlader', 'Front Loaders'), vehicles: ['ekaptn'] },
  { id: 'scooter', title: L('Seniorenraketen', 'Silver Rockets'), vehicles: ['piepmatz', 'tiger', 'komet', 'wagen'] },
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
  /** Rolling resistance with nobody at the controls (m/s²), as after the knock in the crashtest. */
  limpDrag: 1.2,
  /** Full lock asks for this much lateral acceleration (m/s²). Above about g·0.3/tipHeight the inner wheels lift. */
  lateralAccel: 12,
  /**
   * Full lock also asks for at least this rate of turn (rad/s), whatever the speed. This is
   * what keeps the corners tight when it gets fast; 0 = radius grows with the square of the speed.
   */
  cornerYaw: 1.3,
  /** …but for no more sideways pull than this (m/s²). Reached at about 80 km/h; faster than that the corners widen again. */
  cornerMax: 28,
  /** Extra tyre grip per m/s of speed, as a share. Has to keep up with `cornerYaw`. */
  gripAtSpeed: 0.07,
  /** Full lock uses at most this share of what the tyres can hold sideways. Above 1 it slides. */
  gripUse: 0.85,
  /** Full lock at speed costs this share of the top speed… */
  cornerSlow: 0.45,
  /** Share of that cost that already applies at walking pace; it grows to all of it by about 25 km/h. */
  cornerSlowLow: 0.4,
  /** …and it is shed at up to this rate (m/s²). */
  cornerDrag: 6,
  /** Differential steering: share of the turning force the motors cannot spare that is made up on the chassis. */
  steerAssist: 1,
  /** The same for steering by hand on the push rims, where being weak is part of the character. */
  handAssist: 0.5,
  /** Sliding profiles (`slide`): slip angle (rad) at which the turn starts to ease off, to hold the drift. */
  driftHold: 0.4,
  /** How far (rad) the model swings its tail out under full cornering load. Looks only. */
  driftAngle: 0.32,
  /** In the air the chassis rights itself so it lands on its wheels. 0 = tumble freely. */
  airControl: 1,
  /** In the air, full steering turns it at this rate (rad/s). 0 = no say in the matter. */
  airYaw: 0.8,
  /** In the air, full throttle tips the nose down by this much (rad), pulling back lifts it. */
  airPitch: 0.3,
  /** In the air, full steering pushes it sideways this hard (m/s²). */
  airDrift: 2,
  /** In the air, throttle and brake stretch or shorten the jump this hard (m/s²). */
  airThrust: 1,
  /**
   * Height (m) at which cornering force pushes the chassis over. The physics engine
   * applies tyre forces almost at the centre of mass, so the roll is added by hand.
   * 0 = never leans, higher = tips earlier.
   */
  tipHeight: 0.1,
  /**
   * The physics engine leans the chassis a little by itself, with a lever of this share of
   * the centre-of-mass height. Cancelled for the part of the cornering force that only
   * comes from going fast.
   */
  tipInherent: 0.3,
  /**
   * Eases off the steering as the vehicle leans, which is what lets it balance on two
   * wheels instead of going straight over. 0 = no help, 1 = steering fully gone at tipAngle.
   */
  tipAssist: 1,
  /** Lean (rad) the assist ignores: this much is the suspension doing its job. */
  tipFree: 0.12,
  /** Lean angle (rad) at which the assist has taken away all steering. */
  tipAngle: 0.55,
  /** How far ahead (s) the assist extrapolates the lean. */
  tipLookahead: 0.25,
  /** Pull back towards level, as a share of the weight per rad of lean. Trikes get more of their own. */
  righting: 0.08,
  /** Damps the rocking from side to side (N·m·s/rad). Higher = leans over more slowly. */
  rollDamping: 110,
  /**
   * Bump stops fore and aft: push back against nose-diving and rearing up, as a share of
   * the weight per rad beyond the free angle. This is what lets short chairs brake and
   * pull away at all; 0 = they hang on the nose or the tail instead.
   */
  pitchStop: 1.5,
  /** Nose-down angle (rad) the bump stop leaves alone. */
  diveFree: 0.1,
  /** The same nose-up, times the profile's `wheelie`. */
  wheelieFree: 0.1,
  /** Proportional gain of the wheel speed controller (1/s). */
  motorGain: 6,
  /** Gain on the yaw rate error of differential drive (1/s). */
  yawGain: 20,
  /** Handlebar steering: how hard a spin is reined in (1/s). 0 = let it spin. */
  spinGuard: 40,
  /** Front-wheel drive: share of the tail-happy yaw torque that gets cancelled. Below 1 the rear steps out. */
  fwdStability: 0.9,
  /** Deceleration when letting go of the stick: the magnetic brake bites (m/s²). */
  brakeDecel: 5,
  /** Driven front fork: share of the magnetic brake that lets go at full lock, so it rolls round the bend instead of digging in. */
  steerCoast: 0.1,
  /** After braking to a stop with the stick held back, it stands this long (s) before reverse engages. */
  reverseDelay: 0.2,
  /** Reverse then comes in over this long (s) instead of all at once. */
  reverseEase: 0.5,
  /** Deceleration when actively braking against the direction of travel, on all wheels (m/s²). */
  footBrake: 16,
  /** Rear side grip multiplier while the handbrake is held. */
  handbrakeSlide: 0.35,
  suspensionCompression: 3.0,
  suspensionRelaxation: 3.8,
  /** How much the body visibly sways on its springs, on top of the physics. */
  bodySway: 1,
};

export const HANDLING_DEFAULTS: Readonly<typeof HANDLING> = { ...HANDLING };
