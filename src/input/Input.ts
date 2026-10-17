import type { GameInput } from '../sim/GameCore';
import { detectProfile, PadMemo, PadPresses, padName, profileById, readPad, stickSteer, trigger, type Control, type PadPress, type PadProfile, type PadState, type ProfileId } from './pads';

type Action = 'upright' | 'respawn' | 'tune' | 'buyBoost' | 'menu' | 'mute' | 'debug' | 'ghost';

const KEY_ACTIONS: Record<string, Action> = {
  KeyR: 'upright',
  Backspace: 'respawn',
  Escape: 'menu',
  KeyM: 'mute',
  KeyG: 'ghost',
  F2: 'debug',
};
const HELD = ['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space', 'ShiftLeft', 'ShiftRight', 'KeyB'];

/** Where the chosen controller profile is kept: it belongs to the device, not to the save. */
const PAD_KEY = 'tempo6.pad';

function storedChoice(): ProfileId | null {
  try {
    const id = globalThis.localStorage?.getItem(PAD_KEY);
    return id && profileById(id as ProfileId).id === id ? (id as ProfileId) : null;
  } catch {
    return null;
  }
}

/** Where the kids' mode is kept (on unless turned off here). */
const KID_KEY = 'tempo6.kid';
/** Kids' mode: the stick steers at most this far, and gets there no faster than this (per second). */
const KID_MAX = 0.35;
const KID_RATE = 1.5;

function storedKid(): boolean {
  try {
    return globalThis.localStorage?.getItem(KID_KEY) !== '0';
  } catch {
    return true;
  }
}

/** A controller the browser has handed over, and how it is read. */
interface Pad {
  id: string;
  profile: PadProfile;
  memo: PadMemo;
  /** Whether anything was held at the last look. */
  busy: boolean;
}

/**
 * Merges keyboard, gamepad and touch into one driving intent. The game only ever sees
 * the result, so devices can be mixed and added freely.
 */
export class Input {
  private readonly held = new Set<string>();
  private readonly actions = new Set<Action>();
  private keySteer = 0;
  /** The stick's steering in kids' mode, eased toward where the stick is. */
  private kidSteer = 0;
  /** Kids' mode: the stick only steers a little and slowly, so wild wiggling does not throw the car about. */
  kidMode = storedKid();
  /** Set by the touch controls. */
  readonly touch = { steer: 0, throttle: 0, handbrake: false, boost: false };
  /** Called on every key press and tap, e.g. to let the audio start (a controller does not count for that). */
  onGesture: (() => void) | null = null;
  /** The controllers seen, by their number in the browser. */
  private readonly pads = new Map<number, Pad>();
  /** The one in use: the last that did anything. */
  private active = -1;
  private readonly presses = new PadPresses();
  /** What the controller pressed since the last look, for whichever screen is up to take. */
  readonly padPresses: PadPress[] = [];
  /** A profile picked in the settings, or null to go by the controller. */
  padChoice: ProfileId | null = storedChoice();
  /** A controller came into use; for a word on the screen. */
  onPad: ((name: string, profile: PadProfile) => void) | null = null;
  /** Whether the controller was used last rather than the keyboard or mouse; the screen names its buttons. */
  usingPad = false;
  /** The device changed, or the controller's profile did. */
  onDevice: (() => void) | null = null;

  constructor() {
    // (first, before the menu and the garage take their keys for themselves)
    window.addEventListener('keydown', () => {
      this.gesture();
      this.setUsingPad(false);
    }, true);
    window.addEventListener('keydown', (e) => {
      // (typing into a text field, e.g. a cheat code, is not driving)
      if (e.ctrlKey || e.metaKey || e.altKey || e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (HELD.includes(e.code)) {
        this.held.add(e.code);
        e.preventDefault();
      }
      const a = KEY_ACTIONS[e.code];
      if (a && !e.repeat) {
        this.actions.add(a);
        e.preventDefault();
      }
    });
    window.addEventListener('keyup', (e) => this.held.delete(e.code));
    window.addEventListener('blur', () => this.held.clear());
    window.addEventListener('pointerdown', (e) => {
      this.gesture();
      if (e.pointerType === 'mouse') this.setUsingPad(false);
    });
    window.addEventListener('gamepaddisconnected', (e) => {
      this.pads.delete(e.gamepad.index);
      if (e.gamepad.index === this.active) {
        this.active = -1;
        this.presses.reset();
      }
    });
  }

  private gesture(): void {
    this.onGesture?.();
  }

  private setUsingPad(on: boolean): void {
    if (on === this.usingPad) return;
    this.usingPad = on;
    this.onDevice?.();
  }

  trigger(a: Action): void {
    this.actions.add(a);
  }

  /** One-shot actions the shell handles itself. */
  take(a: Action): boolean {
    return this.actions.delete(a);
  }

  /** The profile of the controller in use, or the one it would get. */
  get padProfile(): PadProfile {
    return this.pads.get(this.active)?.profile ?? profileById(this.padChoice ?? '8bitdo');
  }

  /** The name of the controller in use, if there is one. */
  get padName(): string | null {
    const pad = this.pads.get(this.active);
    return pad ? padName(pad.id) : null;
  }

  /** Pick a profile by hand, or null to go by the controller again; kept on this device. */
  choosePad(id: ProfileId | null): void {
    this.padChoice = id;
    try {
      if (id) globalThis.localStorage?.setItem(PAD_KEY, id);
      else globalThis.localStorage?.removeItem(PAD_KEY);
    } catch {
      // no storage: it holds until the page is left
    }
    for (const pad of this.pads.values()) {
      pad.profile = profileById(id ?? detectProfile(pad.id));
      pad.memo = new PadMemo();
    }
    this.onDevice?.();
  }

  /** Kids' mode on or off; kept on this device. */
  setKidMode(on: boolean): void {
    this.kidMode = on;
    this.kidSteer = 0;
    try {
      globalThis.localStorage?.setItem(KID_KEY, on ? '1' : '0');
    } catch {
      // no storage: it holds until the page is left
    }
  }

  /** A short buzz on a controller that can (the strength 0 … 1). */
  rumble(strength: number, ms: number): void {
    if (!this.usingPad || strength <= 0) return;
    const gp = navigator.getGamepads?.()[this.active];
    const s = Math.min(1, strength);
    gp?.vibrationActuator?.playEffect?.('dual-rumble', { duration: ms, strongMagnitude: s, weakMagnitude: s * 0.6 })?.catch(() => {});
  }

  /**
   * Look at every controller; the one that does something becomes the one in use, and its
   * presses are queued. Returns what it holds, or null if none is in use.
   */
  private readPads(dt: number): PadState | null {
    let state: PadState | null = null;
    for (const gp of navigator.getGamepads?.() ?? []) {
      if (!gp?.connected) continue;
      let pad = this.pads.get(gp.index);
      if (!pad || pad.id !== gp.id) {
        pad = { id: gp.id, profile: profileById(this.padChoice ?? detectProfile(gp.id)), memo: new PadMemo(), busy: false };
        this.pads.set(gp.index, pad);
      }
      const s = readPad(gp, pad.profile, pad.memo);
      const busy = s.held.size > 0 || Math.abs(s.x) > 0.5 || Math.abs(s.y) > 0.5 || s.l2 > 0.5 || s.r2 > 0.5;
      // another one takes over when something on it goes down (not for being held all along: some
      // devices that are no controller at all show up as one with a button stuck)
      if (busy && gp.index !== this.active && (!pad.busy || this.active < 0)) {
        this.active = gp.index;
        this.presses.reset();
        this.onPad?.(padName(gp.id), pad.profile);
      }
      pad.busy = busy;
      if (busy && gp.index === this.active) this.setUsingPad(true);
      if (gp.index === this.active) state = s;
    }
    if (state) this.padPresses.push(...this.presses.update(state, this.padProfile.family, dt));
    return state;
  }

  /** Read all devices. Call once per frame; one-shot actions are consumed. */
  poll(dt: number): GameInput {
    const k = (...codes: string[]) => codes.some((c) => this.held.has(c));
    const pad = this.readPads(dt);
    const p = (c: Control) => !!pad?.held.has(c);
    let throttle = (k('KeyW', 'ArrowUp') ? 1 : 0) - (k('KeyS', 'ArrowDown') ? 1 : 0);
    let handbrake = k('Space');
    let boost = k('ShiftLeft', 'ShiftRight', 'KeyB');

    // Keys and the d-pad are on/off, so ease the steering in; centring is quicker than turning.
    const want = (k('KeyD', 'ArrowRight') || p('right') ? 1 : 0) - (k('KeyA', 'ArrowLeft') || p('left') ? 1 : 0);
    const rate = (want === 0 || want * this.keySteer < 0 ? 7 : 4) * dt;
    this.keySteer += Math.max(-rate, Math.min(rate, want - this.keySteer));
    let steer = this.keySteer;

    if (pad) {
      let s = stickSteer(pad.x);
      if (this.kidMode) {
        const r = KID_RATE * dt;
        this.kidSteer += Math.max(-r, Math.min(r, s * KID_MAX - this.kidSteer));
        s = Math.abs(this.kidSteer) < 1e-3 ? 0 : this.kidSteer;
      }
      if (s !== 0) steer = s;
      // the triggers are the pedals; the d-pad up and down will do as well
      const gas = trigger(pad.r2) - trigger(pad.l2);
      if (gas !== 0) throttle = gas;
      else if (p('up') || p('down')) throttle = (p('up') ? 1 : 0) - (p('down') ? 1 : 0);
      handbrake ||= p('south');
      boost ||= p('east') || p('r1');
    }

    if (this.touch.steer !== 0) steer = this.touch.steer;
    if (this.touch.throttle !== 0) throttle = this.touch.throttle;
    handbrake ||= this.touch.handbrake;
    boost ||= this.touch.boost;

    return {
      throttle: Math.max(-1, Math.min(1, throttle)),
      steer: Math.max(-1, Math.min(1, steer)),
      handbrake,
      boost,
      upright: this.take('upright'),
      respawn: this.take('respawn'),
      tune: this.take('tune'),
      buyBoost: this.take('buyBoost'),
    };
  }
}
