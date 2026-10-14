import type { TrackDef } from '../sim/Track';
import { FLUGPLATZ } from './flugplatz';
import { KURVEN } from './kurven';
import { PARKPLATZ } from './parkplatz';
import { REHA } from './reha';
import { SCHLEIFE } from './schleife';
import { SPIELWIESE } from './spielwiese';
import { STADION } from './stadion';
import { TALSTADT } from './talstadt';
import { WESERTOR } from './wesertor';

// (in the order they cost: the tutorial, the free car park after it, then dearer and dearer)
export const TRACKS: TrackDef[] = [REHA, PARKPLATZ, KURVEN, TALSTADT, WESERTOR, FLUGPLATZ, SPIELWIESE, STADION, SCHLEIFE];

/** Where the tutorial sends you once it is over; it costs nothing. */
export const AFTER_TRAINING = PARKPLATZ.id;

export function trackById(id: string): TrackDef {
  return TRACKS.find((t) => t.id === id) ?? TRACKS[0];
}

/** The training course: every vehicle starts here, and only here, until it has got through once. */
export const TRAINING = REHA.id;
