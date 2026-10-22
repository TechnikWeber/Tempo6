import { describe, expect, it } from 'vitest';
import { TRACKS } from '../src/tracks';
import { trackFlicker } from './flicker';

describe.each(TRACKS.map((t) => [t.id, t] as const))('track %s', (_id, track) => {
  it('has no two faces of different colours in the same plane (they would flicker)', () => {
    expect(trackFlicker(track)).toEqual([]);
  });
});
