import { describe, expect, it } from 'vitest';
import { detectProfile, PadMemo, PadPresses, padName, profileById, readPad, stickSteer, trigger, type PadLike, type PadState } from '../src/input/pads';

/** A controller as the browser hands it over: these buttons held, these axes. */
function pad(id: string, mapping: string, held: number[], axes: number[], buttons = 17): PadLike {
  return {
    id,
    mapping,
    axes,
    buttons: Array.from({ length: buttons }, (_, i) => ({ pressed: held.includes(i), value: held.includes(i) ? 1 : 0 })),
  };
}

// As Chrome on Linux has the 8BitDo Ultimate 2C over Bluetooth: no mapping, 16 buttons, 8 axes,
// the right trigger's axis stuck at 0 and the left one resting at -1.
const EIGHTBITDO = '8BitDo Ultimate 2C Wireless (Vendor: 2dc8 Product: 301b)';
const rest = [0, 0, 0, 0, 0, -1, 0, 0];
const eightbitdo = (held: number[], axes = rest) => pad(EIGHTBITDO, '', held, axes, 16);

describe('controller profiles', () => {
  it('knows the makes by their numbers or their names', () => {
    expect(detectProfile(EIGHTBITDO)).toBe('8bitdo');
    expect(detectProfile('2dc8-301b-8BitDo Ultimate 2C Wireless')).toBe('8bitdo');
    expect(detectProfile('Xbox 360 Controller (XInput STANDARD GAMEPAD)')).toBe('xbox');
    expect(detectProfile('45e-b13-Xbox Wireless Controller')).toBe('xbox');
    expect(detectProfile('DualSense Wireless Controller (STANDARD GAMEPAD Vendor: 054c Product: 0ce6)')).toBe('playstation');
    expect(detectProfile('Sony Interactive Entertainment Wireless Controller (STANDARD GAMEPAD Vendor: 054c Product: 09cc)')).toBe('playstation');
    expect(detectProfile('Pro Controller (STANDARD GAMEPAD Vendor: 057e Product: 2009)')).toBe('switch');
  });

  it('takes anything it does not know for the 8BitDo', () => {
    expect(detectProfile('USB Gamepad (Vendor: 0079 Product: 0011)')).toBe('8bitdo');
    expect(detectProfile('Some Pad')).toBe('8bitdo');
  });

  it('names a controller without the numbers the browser adds', () => {
    expect(padName(EIGHTBITDO)).toBe('8BitDo Ultimate 2C Wireless');
    expect(padName('2dc8-301b-8BitDo Ultimate 2C Wireless')).toBe('8BitDo Ultimate 2C Wireless');
    expect(padName('Xbox 360 Controller (XInput STANDARD GAMEPAD)')).toBe('Xbox 360 Controller');
    expect(padName('DualSense Wireless Controller (STANDARD GAMEPAD Vendor: 054c Product: 0ce6)')).toBe('DualSense Wireless Controller');
  });
});

describe('reading the 8BitDo as it comes', () => {
  const profile = profileById('8bitdo');
  const read = (p: PadLike, memo = new PadMemo()) => readPad(p, profile, memo);

  it('has its face buttons where the Switch has them: A right, B below, X on top, Y left', () => {
    expect([...read(eightbitdo([0])).held]).toEqual(['east']);
    expect([...read(eightbitdo([1])).held]).toEqual(['south']);
    expect([...read(eightbitdo([3])).held]).toEqual(['north']);
    expect([...read(eightbitdo([4])).held]).toEqual(['west']);
    expect([...read(eightbitdo([6, 7])).held].sort()).toEqual(['l1', 'r1']);
    expect([...read(eightbitdo([10])).held]).toEqual(['select']);
    expect([...read(eightbitdo([11])).held]).toEqual(['start']);
  });

  it('reads the d-pad off the hat axes', () => {
    expect([...read(eightbitdo([], [0, 0, 0, 0, 0, -1, -1, 0])).held]).toEqual(['left']);
    expect([...read(eightbitdo([], [0, 0, 0, 0, 0, -1, 1, 1])).held].sort()).toEqual(['down', 'right']);
  });

  it('reads a trigger axis once it has shown it rests at -1', () => {
    const memo = new PadMemo();
    expect(read(eightbitdo([]), memo).l2).toBe(0);
    expect(read(eightbitdo([], [0, 0, 0, 0, 0, 0, 0, 0]), memo).l2).toBeCloseTo(0.5);
    expect(read(eightbitdo([8], [0, 0, 0, 0, 0, 1, 0, 0]), memo).l2).toBe(1);
  });

  it('falls back on the trigger button where the axis never moves', () => {
    const memo = new PadMemo();
    // the axis at 0 the whole time is no half-pressed throttle
    expect(read(eightbitdo([]), memo).r2).toBe(0);
    expect(read(eightbitdo([9]), memo).r2).toBe(1);
    expect(read(eightbitdo([]), memo).r2).toBe(0);
  });

  it('steers with the left stick', () => {
    const s = read(eightbitdo([], [-1, 0.2, 0, 0, 0, -1, 0, 0]));
    expect(s.x).toBe(-1);
    expect(s.y).toBe(0.2);
  });
});

describe('the standard layout', () => {
  it('is read by place, whatever the profile', () => {
    const memo = new PadMemo();
    const s = readPad(pad('Pro Controller (STANDARD GAMEPAD Vendor: 057e Product: 2009)', 'standard', [1, 12], [0, 0, 0, 0]), profileById('switch'), memo);
    expect([...s.held].sort()).toEqual(['east', 'up']);
  });

  it('takes the triggers as they are pressed', () => {
    const p = pad('Xbox 360 Controller (XInput STANDARD GAMEPAD)', 'standard', [], [0, 0, 0, 0]);
    (p.buttons as { pressed: boolean; value: number }[])[7] = { pressed: true, value: 0.3 };
    expect(readPad(p, profileById('xbox'), new PadMemo()).r2).toBeCloseTo(0.3);
  });
});

describe('presses', () => {
  const state = (held: string[], x = 0, y = 0): PadState => ({ held: new Set(held) as PadState['held'], x, y, l2: 0, r2: 0 });

  it('says yes with A, wherever the maker put it', () => {
    expect(new PadPresses().update(state(['east']), 'nintendo', 1 / 60)).toEqual(['ok']);
    expect(new PadPresses().update(state(['south']), 'nintendo', 1 / 60)).toEqual(['back']);
    expect(new PadPresses().update(state(['south']), 'xbox', 1 / 60)).toEqual(['ok']);
    expect(new PadPresses().update(state(['east']), 'playstation', 1 / 60)).toEqual(['back']);
  });

  it('presses once on the way down', () => {
    const p = new PadPresses();
    expect(p.update(state(['start']), 'nintendo', 1 / 64)).toEqual(['start']);
    for (let i = 0; i < 100; i++) expect(p.update(state(['start']), 'nintendo', 1 / 64)).toEqual([]);
    expect(p.update(state([]), 'nintendo', 1 / 64)).toEqual([]);
    expect(p.update(state(['start']), 'nintendo', 1 / 64)).toEqual(['start']);
  });

  it('repeats a direction held down', () => {
    const p = new PadPresses();
    let n = 0;
    for (let i = 0; i < 64; i++) n += p.update(state(['right']), 'nintendo', 1 / 64).length;
    // once at once, then after 0.45 s every 0.15 s
    expect(n).toBe(5);
  });

  it('takes the stick for the d-pad, with some give at the edge', () => {
    const p = new PadPresses();
    expect(p.update(state([], 0.7), 'xbox', 1 / 60)).toEqual(['right']);
    expect(p.update(state([], 0.5), 'xbox', 1 / 60)).toEqual([]);
    expect(p.update(state([], 0.2), 'xbox', 1 / 60)).toEqual([]);
    expect(p.update(state([], 0.7), 'xbox', 1 / 60)).toEqual(['right']);
    expect(p.update(state([], 0, -0.9), 'xbox', 1 / 60)).toEqual(['up']);
  });
});

describe('stick and triggers', () => {
  it('steer nothing in the dead zone, all the way at the end, and gently in between', () => {
    expect(stickSteer(0.1)).toBe(0);
    expect(stickSteer(-0.1)).toBe(-0);
    expect(stickSteer(1)).toBe(1);
    expect(stickSteer(-1)).toBe(-1);
    expect(stickSteer(0.5)).toBeGreaterThan(0);
    expect(stickSteer(0.5)).toBeLessThan(0.5);
  });

  it('count a trigger only past its dead zone', () => {
    expect(trigger(0.03)).toBe(0);
    expect(trigger(1)).toBe(1);
    expect(trigger(0.5)).toBeGreaterThan(0.45);
  });
});
