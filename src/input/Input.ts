import type { GameInput } from '../sim/GameCore';

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

// Standard gamepad mapping: A = handbrake, B / RB = boost, Y = upright, Back = respawn, triggers = gas/reverse.
const PAD_ACTIONS: [number, Action][] = [[3, 'upright'], [8, 'respawn'], [9, 'menu']];

/**
 * Merges keyboard, gamepad and touch into one driving intent. The game only ever sees
 * the result, so devices can be mixed and added freely.
 */
export class Input {
  private readonly held = new Set<string>();
  private readonly actions = new Set<Action>();
  private readonly padHeld = new Set<number>();
  private keySteer = 0;
  /** Set by the touch controls. */
  readonly touch = { steer: 0, throttle: 0, handbrake: false, boost: false };
  /** Called on the first user gesture, e.g. to unlock audio. */
  onFirstGesture: (() => void) | null = null;

  constructor() {
    window.addEventListener('keydown', (e) => {
      // (typing into a text field, e.g. a cheat code, is not driving)
      if (e.ctrlKey || e.metaKey || e.altKey || e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      this.gesture();
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
    window.addEventListener('pointerdown', () => this.gesture(), { once: true });
  }

  private gesture(): void {
    this.onFirstGesture?.();
    this.onFirstGesture = null;
  }

  trigger(a: Action): void {
    this.actions.add(a);
  }

  /** One-shot actions the shell handles itself. */
  take(a: Action): boolean {
    return this.actions.delete(a);
  }

  /** Read all devices. Call once per frame; one-shot actions are consumed. */
  poll(dt: number): GameInput {
    const k = (...codes: string[]) => codes.some((c) => this.held.has(c));
    let throttle = (k('KeyW', 'ArrowUp') ? 1 : 0) - (k('KeyS', 'ArrowDown') ? 1 : 0);
    let handbrake = k('Space');
    let boost = k('ShiftLeft', 'ShiftRight', 'KeyB');

    // Keys are on/off, so ease the steering in; centring is quicker than turning.
    const want = (k('KeyD', 'ArrowRight') ? 1 : 0) - (k('KeyA', 'ArrowLeft') ? 1 : 0);
    const rate = (want === 0 || want * this.keySteer < 0 ? 7 : 4) * dt;
    this.keySteer += Math.max(-rate, Math.min(rate, want - this.keySteer));
    let steer = this.keySteer;

    const pad = navigator.getGamepads?.().find((p) => p?.connected);
    if (pad) {
      const x = pad.axes[0] ?? 0;
      if (Math.abs(x) > 0.12) steer = x;
      const gas = (pad.buttons[7]?.value ?? 0) - (pad.buttons[6]?.value ?? 0);
      if (Math.abs(gas) > 0.05) throttle = gas;
      handbrake ||= !!pad.buttons[0]?.pressed;
      boost ||= !!pad.buttons[1]?.pressed || !!pad.buttons[5]?.pressed;
      for (const [i, a] of PAD_ACTIONS) {
        const down = !!pad.buttons[i]?.pressed;
        if (down && !this.padHeld.has(i)) this.actions.add(a);
        if (down) this.padHeld.add(i);
        else this.padHeld.delete(i);
      }
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
