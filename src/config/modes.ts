import { L } from '../i18n';
export type ModeId = 'time' | 'race' | 'freestyle' | 'crash';

export interface ModeDef {
  id: ModeId;
  name: string;
  blurb: string;
  /** Tracks this mode is played on, in the order the menu lists them. */
  tracks: string[];
  /** Still being tried out: listed apart in the menu, may go again. */
  experimental?: boolean;
}

/**
 * The ways to play. All but the first open once the tutorial is over; which tracks go with
 * which mode is decided here and nowhere else.
 */
export const MODES: ModeDef[] = [
  {
    id: 'time',
    name: L('Zeitrennen', 'Time Trial'),
    blurb: L('Allein gegen die Uhr und den eigenen Schatten. Jede Runde zahlt, Bestzeiten extra.', 'Alone against the clock and your own ghost. Every lap pays, best times extra.'),
    // (the playground has no lap to time: it is for the freestyle)
    tracks: ['reha', 'parkplatz', 'talstadt', 'wesertor', 'sky', 'flugplatz', 'stadion', 'schleife'],
  },
  {
    id: 'race',
    name: L('Rennen', 'Race'),
    blurb: L('Drei Runden gegen drei andere. Wer vorn ist, kassiert am meisten.', 'Three laps against three others. Whoever is in front cashes in most.'),
    tracks: ['parkplatz', 'talstadt', 'wesertor', 'stadion', 'schleife'],
  },
  {
    id: 'freestyle',
    name: 'Freestyle',
    blurb: L('Drei Minuten, keine Runden: Stunts aneinanderreihen. Jede Kette zahlt, sobald sie endet, am Ende wird abgerechnet.', 'Three minutes, no laps: string stunts together. Every chain pays as soon as it ends, and it all adds up at the end.'),
    tracks: ['spielwiese', 'flugplatz', 'parkplatz', 'crashtest', 'reha'],
  },
  {
    id: 'crash',
    name: L('Crashtest', 'Crash Test'),
    blurb: L('Volle Leistung, voller Boost, ein Versuch. Durch den Propeller auf die Schanze, oder eben nicht. Nach dem ersten Einschlag ist Schluss mit Lenken, und jeder Aufprall zählt, bis alles stillsteht.', 'Full power, full boost, one go. Through the propeller onto the jump, or not. After the first impact the steering is gone, and every knock counts until it all lies still.'),
    tracks: ['crashtest'],
    experimental: true,
  },
];

export function modeById(id: string): ModeDef {
  return MODES.find((m) => m.id === id) ?? MODES[0];
}

/** Race against the others. */
export const RACE = {
  laps: 3,
  /**
   * How fast each opponent goes, as a share of what its vehicle does at the player's stage.
   * They drive a perfect line, so even the quickest stays a little under the player's own top
   * speed, and they pick up speed more gently too; with the boost battery bought, they get one too.
   */
  skill: [0.76, 0.82, 0.92],
  /** Grid slots behind the start line: how far back and how far to the left (m). Who gets which is drawn. */
  grid: [[0.5, 1.2], [0.5, -1.2], [3.1, 1.2], [3.1, -1.2]] as [number, number][],
  /** Prize for the places, in lap money of the track. */
  placePay: [4, 2.5, 1.5, 0.5],
};

/** Crashtest: one go, and every knock until it all lies still is scored. */
export const CRASH = {
  /** Points per knock: this times the square of the change of speed (m/s). Landings count too. */
  perImpact: 2,
  /** Knocks below this (m/s) are just rolling about. */
  minKnock: 1.5,
  /** The first one has to be a proper knock, not a hop on the way down the in-run. */
  firstKnock: 5,
  /** A knock from the propeller counts this many times over: being swatted is the crash of the day. */
  propeller: 3,
  /** One knock is one knock: what follows within this many seconds belongs to it. */
  grace: 0.25,
  /** On top for a write-off. */
  wreck: 300,
  /** It is over once the vehicle has lain this still for this long (s)… */
  stillFor: 1.5,
  /** …or this long after the first knock, whatever. */
  maxFor: 15,
  /** Points per Schraube paid. */
  perScrew: 10,
};

/** Freestyle: a session against the clock, settled at the end. */
export const FREESTYLE = {
  seconds: 180,
};
