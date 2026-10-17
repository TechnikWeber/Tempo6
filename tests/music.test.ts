import { describe, expect, it } from 'vitest';
import { midi, parseBar, SONG } from '../src/audio/Music';

describe('the start screen tune', () => {
  it('reads note names', () => {
    expect(midi('A4')).toBe(69);
    expect(midi('C6')).toBe(84);
    expect(midi('F#5')).toBe(78);
    expect(midi('H5')).toBeNull();
  });

  it('holds notes with dashes and rests on dots', () => {
    expect(parseBar('E5 - G5 - C6 - - - . . C6 - E6 - - -')).toEqual([
      { step: 0, midi: 76, steps: 2 },
      { step: 2, midi: 79, steps: 2 },
      { step: 4, midi: 84, steps: 4 },
      { step: 10, midi: 84, steps: 2 },
      { step: 12, midi: 88, steps: 4 },
    ]);
  });

  it('will not take a bar that is not sixteen steps', () => {
    expect(() => parseBar('C5 - - -')).toThrow();
  });

  it('has a chord for every bar and a tune within the pulse voice range', () => {
    for (const bar of [...SONG.intro, ...SONG.loop]) {
      expect(bar.chord).toBeDefined();
      for (const n of bar.tune) {
        expect(n.midi).toBeGreaterThanOrEqual(72);
        expect(n.midi).toBeLessThanOrEqual(91);
        expect(n.step + n.steps).toBeLessThanOrEqual(16);
      }
    }
    expect(SONG.loop.filter((b) => b.tune.length > 0)).toHaveLength(SONG.loop.length);
  });
});
