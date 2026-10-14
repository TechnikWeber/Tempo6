/** One step on the tuning ladder. Prices are in Schrauben (screws), the game's money. */
export interface TuningStage {
  name: string;
  blurb: string;
  topSpeedKmh: number;
  /** Motor acceleration in m/s². */
  accel: number;
  price: number;
}

// Each vehicle starts at walking pace and gets the first step for free by getting through the
// Reha-Parcours. From there stage 10 is meant to take five to ten minutes of driving; the last
// two are the long goal. Vehicles, tracks and the boost cost more.
export const STAGES: TuningStage[] = [
  { name: 'Werkszustand', blurb: 'Zugelassen bis 6 km/h. Leider.', topSpeedKmh: 6, accel: 2.5, price: 0 },
  { name: 'Drossel raus', blurb: 'Der kleine Stecker unterm Sitz war eh locker.', topSpeedKmh: 12, accel: 3.7, price: 0 },
  { name: 'Reifen aufgepumpt', blurb: 'Zum ersten Mal seit 2009.', topSpeedKmh: 15, accel: 4.2, price: 15 },
  { name: 'WD-40 überall', blurb: 'Wirklich überall.', topSpeedKmh: 18, accel: 4.7, price: 20 },
  { name: 'Zweitakku vom Nachbarn', blurb: 'Er merkt es frühestens Dienstag.', topSpeedKmh: 21, accel: 5.15, price: 25 },
  { name: 'Rallyestreifen', blurb: 'Bringt nachweislich 3 km/h.', topSpeedKmh: 24, accel: 5.5, price: 32 },
  { name: 'Akkuschrauber-Motor', blurb: '18 Volt pure Gewalt.', topSpeedKmh: 29, accel: 6.1, price: 40 },
  { name: 'Rasenmäher-Akku', blurb: 'Der Rasen kann warten.', topSpeedKmh: 34, accel: 6.7, price: 50 },
  { name: 'Waschmaschinenmotor', blurb: 'Schleudergang: 1400 Umdrehungen.', topSpeedKmh: 39, accel: 7.3, price: 60 },
  { name: 'Chiptuning aus dem Internet', blurb: 'Das Forum sagt, das hält.', topSpeedKmh: 44, accel: 7.8, price: 75 },
  { name: 'Starkstrom', blurb: 'Die rote Dose im Keller.', topSpeedKmh: 50, accel: 8.3, price: 95 },
  { name: 'Sahnekapsel-Lachgas', blurb: 'Vierzig Kapseln, ein Traum.', topSpeedKmh: 60, accel: 9.5, price: 250 },
  { name: 'Laubbläser-Triebwerk', blurb: 'Die Krankenkasse darf das nie erfahren.', topSpeedKmh: 75, accel: 11.0, price: 400 },
];

/**
 * Top speed of a stage in km/h for a vehicle whose own factors (vehicle times driving profile)
 * come to `factor`. A quicker vehicle gets more than the stage says, a slower one never less:
 * the 6 km/h at the start are 6 for everyone.
 */
export function stageSpeedKmh(stage: TuningStage, factor: number): number {
  return stage.topSpeedKmh * Math.max(1, factor);
}

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
