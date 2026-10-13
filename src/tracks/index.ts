import type { TrackDef } from '../sim/Track';
import { FLUGPLATZ } from './flugplatz';
import { KURVEN } from './kurven';
import { PARKPLATZ } from './parkplatz';
import { SCHLEIFE } from './schleife';
import { SPIELWIESE } from './spielwiese';
import { STADION } from './stadion';
import { TALSTADT } from './talstadt';
import { WESERTOR } from './wesertor';

export const TRACKS: TrackDef[] = [PARKPLATZ, FLUGPLATZ, TALSTADT, WESERTOR, STADION, SCHLEIFE, SPIELWIESE, KURVEN];

export function trackById(id: string): TrackDef {
  return TRACKS.find((t) => t.id === id) ?? TRACKS[0];
}
