import type { TrackDef } from '../sim/Track';
import { FLUGPLATZ } from './flugplatz';
import { KURVEN } from './kurven';
import { PARKPLATZ } from './parkplatz';

export const TRACKS: TrackDef[] = [PARKPLATZ, FLUGPLATZ, KURVEN];

export function trackById(id: string): TrackDef {
  return TRACKS.find((t) => t.id === id) ?? TRACKS[0];
}
