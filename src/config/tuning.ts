/** One step on the tuning ladder. Prices are in Schrauben (screws), the game's money. */
export interface TuningStage {
  name: string;
  blurb: string;
  topSpeedKmh: number;
  /** Motor acceleration in m/s². */
  accel: number;
  price: number;
}

// The first steps cost next to nothing, so stage 10 comes after a few laps of the car park:
// speed is the fun. The last two are the long goal. Vehicles, tracks and the boost cost more.
export const STAGES: TuningStage[] = [
  { name: 'Werkszustand', blurb: 'Zugelassen bis 6 km/h. Leider.', topSpeedKmh: 6, accel: 2.5, price: 0 },
  { name: 'Drossel raus', blurb: 'Der kleine Stecker unterm Sitz war eh locker.', topSpeedKmh: 8, accel: 2.9, price: 2 },
  { name: 'Reifen aufgepumpt', blurb: 'Zum ersten Mal seit 2009.', topSpeedKmh: 10, accel: 3.3, price: 3 },
  { name: 'WD-40 überall', blurb: 'Wirklich überall.', topSpeedKmh: 12, accel: 3.7, price: 4 },
  { name: 'Zweitakku vom Nachbarn', blurb: 'Er merkt es frühestens Dienstag.', topSpeedKmh: 15, accel: 4.2, price: 5 },
  { name: 'Rallyestreifen', blurb: 'Bringt nachweislich 3 km/h.', topSpeedKmh: 18, accel: 4.7, price: 6 },
  { name: 'Akkuschrauber-Motor', blurb: '18 Volt pure Gewalt.', topSpeedKmh: 22, accel: 5.3, price: 7 },
  { name: 'Rasenmäher-Akku', blurb: 'Der Rasen kann warten.', topSpeedKmh: 27, accel: 5.9, price: 8 },
  { name: 'Waschmaschinenmotor', blurb: 'Schleudergang: 1400 Umdrehungen.', topSpeedKmh: 33, accel: 6.6, price: 10 },
  { name: 'Chiptuning aus dem Internet', blurb: 'Das Forum sagt, das hält.', topSpeedKmh: 40, accel: 7.4, price: 12 },
  { name: 'Starkstrom', blurb: 'Die rote Dose im Keller.', topSpeedKmh: 50, accel: 8.3, price: 14 },
  { name: 'Sahnekapsel-Lachgas', blurb: 'Vierzig Kapseln, ein Traum.', topSpeedKmh: 60, accel: 9.5, price: 80 },
  { name: 'Laubbläser-Triebwerk', blurb: 'Die Krankenkasse darf das nie erfahren.', topSpeedKmh: 75, accel: 11.0, price: 120 },
];

/** The boost battery: a short shove with a bit of a kick, though it still fades in rather than snapping on. */
export const BOOST = {
  /** In Schrauben. */
  price: 250,
  /** Seconds a full charge lasts. */
  duration: 2.4,
  /** Seconds from empty to full while just driving along. */
  recharge: 10,
  /** Charging is this much faster while slowing down. */
  recuperation: 2.5,
  /** Charge needed before it fires again after running dry. */
  minCharge: 0.25,
  /** Extra top speed at full boost: a share of the current top speed plus a fixed bit (m/s). */
  speed: 0.45,
  extraSpeed: 1.5,
  /** Extra motor acceleration at full boost, as a share. */
  accel: 1.3,
  /** Seconds to fade in and out. */
  rampUp: 0.45,
  rampDown: 1.1,
};

/** Crash damage: every knock adds up, and one that is hard enough wrecks it on the spot. */
export const DAMAGE = {
  /** Change of speed in one instant (m/s) below which a knock does nothing. Shopping carts and gentle landings stay below it. */
  minImpact: 3,
  /** Damage per m/s of impact above that, as a share of a whole vehicle. */
  perImpact: 0.03,
  /** A single impact this hard (m/s) is a write-off. */
  wreckImpact: 13,
  /** Up to this much damage it only looks battered; beyond it the driving suffers too. */
  effectsFrom: 0.5,
  /** At this much damage it loses a wheel. */
  wheelOff: 0.75,
  /** Steering it pulls to the damaged side with, at the very end (share of full lock). */
  pull: 0.35,
  /** Share of the top speed it has lost at the very end. */
  slow: 0.35,
  /** Seconds after a knock during which further knocks do not count. One crash is one crash. */
  grace: 0.4,
};

/** What lies about is worth this many Schrauben: a single screw, and a toolbox full of them. */
export const PICKUP_VALUE = { screw: 1, toolbox: 12 } as const;

/** Pay beyond the lap money of the track, as shares of it. */
export const BONUS = {
  /** For a new best lap. */
  best: 0.5,
  /** For a lap without a scratch. */
  clean: 0.5,
};

/** Stunts: what they pay in Schrauben, and how a run of them multiplies. */
export const STUNTS = {
  /** Paid per second it lasts; shorter than `min` seconds does not count. */
  drift: { perSecond: 2, min: 0.6 },
  twoWheels: { perSecond: 3, min: 0.5 },
  wheelie: { perSecond: 2, min: 0.6 },
  air: { perSecond: 5, min: 0.5 },
  /** Paid once. */
  looping: 15,
  nearMiss: 4,
  /** Every stunt within this many seconds of the last raises the multiplier by `chainStep`, up to `chainMax`. */
  chainWindow: 5,
  chainStep: 0.5,
  chainMax: 4,
};

export function formatMoney(screws: number): string {
  return `${Math.round(screws)} ${Math.round(screws) === 1 ? 'Schraube' : 'Schrauben'}`;
}
