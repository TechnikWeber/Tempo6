/** One step on the tuning ladder. Prices are in cents (Pfand money). */
export interface TuningStage {
  name: string;
  blurb: string;
  topSpeedKmh: number;
  /** Motor acceleration in m/s². */
  accel: number;
  price: number;
}

// Fast early steps (6 → 12 km/h within about two laps), then a longer climb.
export const STAGES: TuningStage[] = [
  { name: 'Werkszustand', blurb: 'Zugelassen bis 6 km/h. Leider.', topSpeedKmh: 6, accel: 2.5, price: 0 },
  { name: 'Drossel raus', blurb: 'Der kleine Stecker unterm Sitz war eh locker.', topSpeedKmh: 8, accel: 2.9, price: 100 },
  { name: 'Reifen aufgepumpt', blurb: 'Zum ersten Mal seit 2009.', topSpeedKmh: 10, accel: 3.3, price: 200 },
  { name: 'WD-40 überall', blurb: 'Wirklich überall.', topSpeedKmh: 12, accel: 3.7, price: 300 },
  { name: 'Zweitakku vom Nachbarn', blurb: 'Er merkt es frühestens Dienstag.', topSpeedKmh: 15, accel: 4.2, price: 600 },
  { name: 'Rallyestreifen', blurb: 'Bringt nachweislich 3 km/h.', topSpeedKmh: 18, accel: 4.7, price: 900 },
  { name: 'Akkuschrauber-Motor', blurb: '18 Volt pure Gewalt.', topSpeedKmh: 22, accel: 5.3, price: 1300 },
  { name: 'Autobatterie', blurb: 'Passt nicht rein. Fährt trotzdem mit.', topSpeedKmh: 27, accel: 5.9, price: 1800 },
  { name: 'Waschmaschinenmotor', blurb: 'Schleudergang: 1400 Umdrehungen.', topSpeedKmh: 33, accel: 6.6, price: 2500 },
  { name: 'Chiptuning aus dem Internet', blurb: 'Das Forum sagt, das hält.', topSpeedKmh: 40, accel: 7.4, price: 3500 },
  { name: 'Starkstrom', blurb: 'Die rote Dose im Keller.', topSpeedKmh: 50, accel: 8.3, price: 5000 },
  { name: 'Sahnekapsel-Lachgas', blurb: 'Vierzig Kapseln, ein Traum.', topSpeedKmh: 60, accel: 9.5, price: 7000 },
  { name: 'Laubbläser-Triebwerk', blurb: 'Die Krankenkasse darf das nie erfahren.', topSpeedKmh: 75, accel: 11.0, price: 10000 },
];

/** The boost battery: a short shove that fades in and out instead of kicking. */
export const BOOST = {
  /** Pfand in cents. */
  price: 1500,
  /** Seconds a full charge lasts. */
  duration: 2.4,
  /** Seconds from empty to full while just driving along. */
  recharge: 10,
  /** Charging is this much faster while slowing down. */
  recuperation: 2.5,
  /** Charge needed before it fires again after running dry. */
  minCharge: 0.25,
  /** Extra top speed at full boost: a share of the current top speed plus a fixed bit (m/s). */
  speed: 0.35,
  extraSpeed: 1,
  /** Extra motor acceleration at full boost, as a share. */
  accel: 0.7,
  /** Seconds to fade in and out. */
  rampUp: 0.7,
  rampDown: 1.1,
};

/** Pfand values in cents: single-use bottle and a full crate of beer. */
export const PICKUP_VALUE = { bottle: 25, crate: 310 } as const;

export function formatMoney(cents: number): string {
  return `${(cents / 100).toFixed(2).replace('.', ',')} €`;
}
