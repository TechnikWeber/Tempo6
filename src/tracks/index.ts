import type { Progress } from '../sim/Progress';
import type { TrackDef } from '../sim/Track';
import { CRASHTEST } from './crashtest';
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
export const TRACKS: TrackDef[] = [REHA, PARKPLATZ, CRASHTEST, KURVEN, TALSTADT, WESERTOR, FLUGPLATZ, SPIELWIESE, STADION, SCHLEIFE];

/**
 * Whether a track can be driven: the Reha-Parcours always, the rest once the tutorial is
 * over and they are bought (or free).
 */
export function trackOpen(progress: Progress, id: string): boolean {
  if (id === TRAINING) return true;
  const t = TRACKS.find((x) => x.id === id);
  return !!t && progress.tutorialDone && progress.isUnlocked(id, t.unlockPrice);
}

export function trackById(id: string): TrackDef {
  return TRACKS.find((t) => t.id === id) ?? TRACKS[0];
}

/** The training course: every vehicle starts here, and only here, until it has got through once. */
export const TRAINING = REHA.id;
