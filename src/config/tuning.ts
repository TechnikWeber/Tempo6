import { L } from '../i18n';
/** One step on the tuning ladder. Prices are in Schrauben (screws), the game's money. */
export interface TuningStage {
  name: string;
  blurb: string;
  topSpeedKmh: number;
  /** Motor acceleration in m/sÂ². */
  accel: number;
  price: number;
}

// The first vehicle starts out in the Tutorial (12 km/h, whatever the brochure says);
// getting through once is the tutorial, and from then on every vehicle has the throttle off.
// The ladder is short and quick: up to stage 5 in no time, all the way in about five minutes.
// Vehicles, tracks and the boost cost more.
export const STAGES: TuningStage[] = [
  { name: L('Werkszustand', 'Factory Setting'), blurb: L('Zugelassen bis 6 km/h. Steht so im Prospekt.', 'Approved for 6 km/h. Says so in the brochure.'), topSpeedKmh: 12, accel: 3.7, price: 0 },
  { name: L('Drossel raus', 'Limiter Out'), blurb: L('Der kleine Stecker unterm Sitz war eh locker.', 'The little plug under the seat was loose anyway.'), topSpeedKmh: 18, accel: 4.7, price: 0 },
  { name: L('Reifen aufgepumpt', 'Tyres Pumped Up'), blurb: L('Zum ersten Mal seit 2009.', 'For the first time since 2009.'), topSpeedKmh: 24, accel: 5.5, price: 20 },
  { name: L('Zweitakku vom Nachbarn', 'Neighbourâ€™s Spare Battery'), blurb: L('Er merkt es frÃ¼hestens Dienstag.', 'He wonâ€™t notice before Tuesday.'), topSpeedKmh: 30, accel: 6.2, price: 20 },
  { name: L('Akkuschrauber-Motor', 'Cordless Drill Motor'), blurb: L('18 Volt pure Gewalt.', '18 volts of pure violence.'), topSpeedKmh: 37, accel: 6.9, price: 20 },
  { name: L('Waschmaschinenmotor', 'Washing Machine Motor'), blurb: L('Schleudergang: 1400 Umdrehungen.', 'Spin cycle: 1400 rpm.'), topSpeedKmh: 45, accel: 7.6, price: 25 },
  { name: L('Starkstrom', 'Three-Phase Power'), blurb: L('Die rote Dose im Keller.', 'The red socket in the basement.'), topSpeedKmh: 54, accel: 8.4, price: 40 },
  { name: L('Sahnekapsel-Lachgas', 'Whipped-Cream Nitrous'), blurb: L('Vierzig Kapseln, ein Traum.', 'Forty cartridges, a dream.'), topSpeedKmh: 64, accel: 9.6, price: 55 },
  { name: L('LaubblÃ¤ser-Triebwerk', 'Leaf Blower Jet'), blurb: L('Die Krankenkasse darf das nie erfahren.', 'The health insurer must never find out.'), topSpeedKmh: 75, accel: 11.0, price: 70 },
];


/**
 * Top speed of a stage in km/h for a vehicle whose own factors (vehicle times driving profile)
 * come to `factor`. A quicker vehicle gets more than the stage says, a slower one never less:
 * the 12 km/h at the start are 12 for everyone.
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
  const n = Math.round(screws);
  return `${n} ${n === 1 ? L('Schraube', 'screw') : L('Schrauben', 'screws')}`;
}

