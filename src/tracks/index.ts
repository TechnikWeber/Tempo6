import type { Progress } from '../sim/Progress';
import type { TrackDef } from '../sim/Track';
import { CRASHTEST } from './crashtest';
import { FLUGPLATZ } from './flugplatz';
import { PARKPLATZ } from './parkplatz';
import { REHA } from './reha';
import { SCHLEIFE } from './schleife';
import { SKY } from './sky';
import { SPIELWIESE } from './spielwiese';
import { STADION } from './stadion';
import { TALSTADT } from './talstadt';
import { WESERTOR } from './wesertor';

// (in the order they cost: the tutorial, the free car park after it, then dearer and dearer)
export const TRACKS: TrackDef[] = [REHA, PARKPLATZ, CRASHTEST, TALSTADT, WESERTOR, SKY, FLUGPLATZ, SPIELWIESE, STADION, SCHLEIFE];

/**
 * Whether a track can be driven: the tutorial only until it is done (then it is gone for
 * good), the rest once the tutorial is over and they are bought (or free).
 */
export function trackOpen(progress: Progress, id: string): boolean {
  if (id === TRAINING) return !progress.tutorialDone;
  const t = TRACKS.find((x) => x.id === id);
  return !!t && progress.tutorialDone && progress.isUnlocked(id, t.unlockPrice);
}

export function trackById(id: string): TrackDef {
  return TRACKS.find((t) => t.id === id) ?? TRACKS[0];
}

/** The tutorial: every vehicle starts here, and only here, until it has got through once. */
export const TRAINING = REHA.id;

/** Where the game lands once the tutorial is behind it: the free car park right after it. */
export const DEFAULT_TRACK = PARKPLATZ.id;
