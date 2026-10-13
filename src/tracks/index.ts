import type { TrackDef } from '../sim/Track';
import { FLUGPLATZ } from './flugplatz';
import { KURVEN } from './kurven';
import { PARKPLATZ } from './parkplatz';
import { SCHLEIFE } from './schleife';
import { SPIELWIESE } from './spielwiese';
import { STADION } from './stadion';

export const TRACKS: TrackDef[] = [PARKPLATZ, FLUGPLATZ, STADION, SCHLEIFE, SPIELWIESE, KURVEN];

export function trackById(id: string): TrackDef {
  return TRACKS.find((t) => t.id === id) ?? TRACKS[0];
}
