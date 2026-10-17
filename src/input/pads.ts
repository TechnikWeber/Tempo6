// Game controllers. A browser hands a controller over in one of two ways: in the "standard"
// layout, for the ones it knows (Xbox, PlayStation, the Switch Pro and others), or as it comes,
// buttons and axes numbered in whatever order the maker chose ('' mapping). A profile says how
// to read the second kind, and what is printed on the buttons, so the game can name them right.
// Nothing in here touches the page, so the tests can run it.

/** A control by where it sits, the same on every make: south is the bottom face button. */
export type Control =
  | 'south' | 'east' | 'west' | 'north'
  | 'l1' | 'r1' | 'l2' | 'r2'
  | 'select' | 'start' | 'home' | 'l3' | 'r3'
  | 'up' | 'down' | 'left' | 'right';

/** Whose buttons these are: what they are called, and which one says yes. */
export type Family = 'nintendo' | 'xbox' | 'playstation';

/** How to read a controller that comes as it is: which button and axis numbers are what. */
export interface RawLayout {
  buttons: Partial<Record<Control, number>>;
  /** The left stick, x and y. */
  stick: [number, number];
  /** Analog triggers on axes that rest at -1; the L2/R2 buttons stand in until one is seen working. */
  triggers?: { l2: number; r2: number };
  /** The d-pad as a hat on two axes, x and y, each -1, 0 or 1. */
  hat?: [number, number];
}

export type ProfileId = '8bitdo' | 'switch' | 'xbox' | 'playstation';

export interface PadProfile {
  id: ProfileId;
  /** What the settings call it. */
  name: string;
  family: Family;
  raw: RawLayout;
}

// 8BitDo in its own (D-input) mode: the buttons go by what is printed on them, A first, so on the
// Switch-style ones A is the right face button. Read off an Ultimate 2C over Bluetooth in Chrome on
// Linux, 2026-10-17; the triggers come twice, as an axis and as a button.
const EIGHTBITDO: RawLayout = {
  buttons: { east: 0, south: 1, north: 3, west: 4, l1: 6, r1: 7, l2: 8, r2: 9, select: 10, start: 11, home: 12, l3: 13, r3: 14 },
  stick: [0, 1],
  triggers: { l2: 5, r2: 4 },
  hat: [6, 7],
};
// The others as the Linux drivers number them, for a browser that does not map them itself.
// (The Switch Pro has no analog triggers, ZL and ZR are buttons.)
const SWITCH: RawLayout = {
  buttons: { south: 0, east: 1, north: 2, west: 3, l1: 4, r1: 5, l2: 6, r2: 7, select: 8, start: 9, home: 10, l3: 11, r3: 12 },
  stick: [0, 1],
  hat: [4, 5],
};
const XBOX: RawLayout = {
  buttons: { south: 0, east: 1, west: 2, north: 3, l1: 4, r1: 5, select: 6, start: 7, home: 8, l3: 9, r3: 10 },
  stick: [0, 1],
  triggers: { l2: 2, r2: 5 },
  hat: [6, 7],
};
const PLAYSTATION: RawLayout = {
  buttons: { south: 0, east: 1, north: 2, west: 3, l1: 4, r1: 5, l2: 6, r2: 7, select: 8, start: 9, home: 10, l3: 11, r3: 12 },
  stick: [0, 1],
  triggers: { l2: 2, r2: 5 },
  hat: [6, 7],
};

/** The default first: whatever is not recognised is taken for one of these. */
export const PROFILES: readonly PadProfile[] = [
  { id: '8bitdo', name: '8BitDo', family: 'nintendo', raw: EIGHTBITDO },
  { id: 'switch', name: 'Switch Pro', family: 'nintendo', raw: SWITCH },
  { id: 'xbox', name: 'Xbox', family: 'xbox', raw: XBOX },
  { id: 'playstation', name: 'PlayStation', family: 'playstation', raw: PLAYSTATION },
];

export function profileById(id: ProfileId): PadProfile {
  return PROFILES.find((p) => p.id === id) ?? PROFILES[0];
}

/** The W3C standard layout, by button number. */
const STANDARD: Record<Control, number> = {
  south: 0, east: 1, west: 2, north: 3, l1: 4, r1: 5, l2: 6, r2: 7,
  select: 8, start: 9, l3: 10, r3: 11, up: 12, down: 13, left: 14, right: 15, home: 16,
};

/**
 * Maker and model from the browser's name for a controller: Chrome puts them at the end
 * ("… (Vendor: 2dc8 Product: 301b)"), Firefox and Safari in front ("2dc8-301b-…").
 */
export function padIds(id: string): { vendor: number; product: number } | null {
  const m = /Vendor: ([0-9a-f]{1,4}) Product: ([0-9a-f]{1,4})/i.exec(id) ?? /^([0-9a-f]{1,4})-([0-9a-f]{1,4})-/i.exec(id);
  return m ? { vendor: parseInt(m[1], 16), product: parseInt(m[2], 16) } : null;
}

/** The controller's name without the numbers the browser adds to it. */
export function padName(id: string): string {
  return id.replace(/^[0-9a-f]{1,4}-[0-9a-f]{1,4}-/i, '').replace(/\s*\((?:[^()]*\b(?:Vendor|STANDARD GAMEPAD|XInput)\b[^()]*)\)\s*$/i, '').trim() || id;
}

/** Which profile fits a controller, by its maker or else its name. */
export function detectProfile(id: string): ProfileId {
  const vendor = padIds(id)?.vendor;
  const name = id.toLowerCase();
  if (vendor === 0x054c || /playstation|dualshock|dualsense/.test(name)) return 'playstation';
  if (vendor === 0x045e || /xbox|x-box|xinput/.test(name)) return 'xbox';
  if (vendor === 0x057e || /nintendo|pro controller|joy-con/.test(name)) return 'switch';
  return '8bitdo';
}

/** The parts of a browser Gamepad that are read here (so a test can hand in its own). */
export interface PadLike {
  id: string;
  mapping: string;
  axes: readonly number[];
  buttons: readonly { pressed: boolean; value: number }[];
}

/** One look at a controller. */
export interface PadState {
  held: Set<Control>;
  /** The left stick as it is, -1 … 1, y pointing down as the browser has it. */
  x: number;
  y: number;
  /** The triggers, 0 … 1. */
  l2: number;
  r2: number;
}

/**
 * What a controller showed so far that a single look cannot tell: which trigger axes are real
 * (an axis that never moved reads 0, which would be a half-pressed trigger otherwise).
 */
export class PadMemo {
  readonly triggers = new Set<number>();
}

export function readPad(pad: PadLike, profile: PadProfile, memo: PadMemo): PadState {
  const held = new Set<Control>();
  const pressed = (i: number | undefined) => i !== undefined && !!pad.buttons[i]?.pressed;
  const axis = (i: number) => pad.axes[i] ?? 0;
  if (pad.mapping === 'standard') {
    for (const [c, i] of Object.entries(STANDARD) as [Control, number][]) if (pressed(i)) held.add(c);
    return { held, x: axis(0), y: axis(1), l2: pad.buttons[6]?.value ?? 0, r2: pad.buttons[7]?.value ?? 0 };
  }
  const raw = profile.raw;
  for (const [c, i] of Object.entries(raw.buttons) as [Control, number][]) if (pressed(i)) held.add(c);
  const trigger = (i: number | undefined, c: Control) => {
    let v = 0;
    if (i !== undefined && i < pad.axes.length) {
      // resting at -1 shows it is a trigger and it works (one browser leaves an axis at 0 for good)
      if (axis(i) < -0.9) memo.triggers.add(i);
      if (memo.triggers.has(i)) v = (axis(i) + 1) / 2;
    }
    return Math.max(v, held.has(c) ? 1 : 0);
  };
  const l2 = trigger(raw.triggers?.l2, 'l2');
  const r2 = trigger(raw.triggers?.r2, 'r2');
  if (raw.hat && raw.hat[1] < pad.axes.length) {
    const hx = axis(raw.hat[0]), hy = axis(raw.hat[1]);
    if (hx < -0.5) held.add('left');
    if (hx > 0.5) held.add('right');
    if (hy < -0.5) held.add('up');
    if (hy > 0.5) held.add('down');
  }
  return { held, x: axis(raw.stick[0]), y: axis(raw.stick[1]), l2, r2 };
}

/** How the stick and triggers feel; the workshop (F2) has sliders for them. */
export const PAD = {
  /** How far the stick moves before it steers at all. */
  deadzone: 0.15,
  /** 1 steers in step with the stick; more is gentler round the middle and still full at the end. */
  steerCurve: 1.4,
  /** How far a trigger goes before it counts. */
  triggerDeadzone: 0.05,
};
export const PAD_DEFAULTS = { ...PAD };

/** The stick's sideways push as a steering amount: nothing in the dead zone, then the curve. */
export function stickSteer(x: number): number {
  const over = Math.max(0, Math.abs(x) - PAD.deadzone) / (1 - PAD.deadzone);
  return Math.sign(x) * Math.min(1, over) ** PAD.steerCurve;
}

/** A trigger past its dead zone, 0 … 1. */
export function trigger(v: number): number {
  return v > PAD.triggerDeadzone ? (v - PAD.triggerDeadzone) / (1 - PAD.triggerDeadzone) : 0;
}

/**
 * A press for whatever screen is up. The d-pad and the stick step; ok and back are yes and no
 * (A and B wherever the maker put them: Nintendo has A on the right, the others at the bottom);
 * north and west are the top and left face buttons.
 */
export type PadPress = 'up' | 'down' | 'left' | 'right' | 'ok' | 'back' | 'north' | 'west' | 'l1' | 'r1' | 'start' | 'select';

/** Seconds a direction is held before it repeats, and then between repeats. */
const REPEAT_DELAY = 0.45;
const REPEAT_EVERY = 0.15;
/** Stick past this counts as a step; back under the lower one lets go again. */
const STICK_ON = 0.6;
const STICK_OFF = 0.35;

/** Turns what is held from look to look into presses: once on the way down, directions repeating. */
export class PadPresses {
  private readonly down = new Map<string, number>();
  private stick = new Set<Control>();

  update(state: PadState, family: Family, dt: number): PadPress[] {
    // the stick as a d-pad, with a little give so it does not flicker at the edge
    const stick = new Set<Control>();
    const was = (c: Control) => this.stick.has(c);
    if (state.x < -(was('left') ? STICK_OFF : STICK_ON)) stick.add('left');
    if (state.x > (was('right') ? STICK_OFF : STICK_ON)) stick.add('right');
    if (state.y < -(was('up') ? STICK_OFF : STICK_ON)) stick.add('up');
    if (state.y > (was('down') ? STICK_OFF : STICK_ON)) stick.add('down');
    this.stick = stick;

    const ok: Control = family === 'nintendo' ? 'east' : 'south';
    const back: Control = family === 'nintendo' ? 'south' : 'east';
    const want: [PadPress, boolean][] = [
      ['up', state.held.has('up') || stick.has('up')],
      ['down', state.held.has('down') || stick.has('down')],
      ['left', state.held.has('left') || stick.has('left')],
      ['right', state.held.has('right') || stick.has('right')],
      ['ok', state.held.has(ok)],
      ['back', state.held.has(back)],
      ['north', state.held.has('north')],
      ['west', state.held.has('west')],
      ['l1', state.held.has('l1')],
      ['r1', state.held.has('r1')],
      ['start', state.held.has('start')],
      ['select', state.held.has('select')],
    ];
    const out: PadPress[] = [];
    for (const [p, on] of want) {
      const t = this.down.get(p);
      if (!on) {
        this.down.delete(p);
        continue;
      }
      if (t === undefined) {
        out.push(p);
        this.down.set(p, 0);
        continue;
      }
      const now = t + dt;
      this.down.set(p, now);
      const steps = p === 'up' || p === 'down' || p === 'left' || p === 'right';
      if (steps && now >= REPEAT_DELAY && Math.floor((now - REPEAT_DELAY) / REPEAT_EVERY) > Math.floor((t - REPEAT_DELAY) / REPEAT_EVERY)) out.push(p);
    }
    return out;
  }

  /** Forget what was held, e.g. when another controller takes over. */
  reset(): void {
    this.down.clear();
    this.stick.clear();
  }
}
