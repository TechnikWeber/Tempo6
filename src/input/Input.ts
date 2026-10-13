import type { VehicleId } from '../config/vehicles';
import type { GameInput } from '../sim/GameCore';

type Action = 'upright' | 'respawn' | 'tune' | 'wheelchair' | 'scooter' | 'mute' | 'debug';

const KEY_ACTIONS: Record<string, Action> = {
  KeyR: 'upright',
  Backspace: 'respawn',
  KeyT: 'tune',
  KeyE: 'tune',
  Digit1: 'wheelchair',
  Digit2: 'scooter',
  KeyM: 'mute',
  F2: 'debug',
};
const HELD = ['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'];

// Standard gamepad mapping: A = handbrake, X = tune, Y = upright, Back = respawn, triggers = gas/reverse.
const PAD_ACTIONS: [number, Action][] = [[2, 'tune'], [3, 'upright'], [8, 'respawn']];

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
  readonly touch = { steer: 0, throttle: 0, handbrake: false };
  /** Called on the first user gesture, e.g. to unlock audio. */
  onFirstGesture: (() => void) | null = null;

  constructor() {
    window.addEventListener('keydown', (e) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
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

    let selectVehicle: VehicleId | null = null;
    if (this.take('wheelchair')) selectVehicle = 'wheelchair';
    if (this.take('scooter')) selectVehicle = 'scooter';
    return {
      throttle: Math.max(-1, Math.min(1, throttle)),
      steer: Math.max(-1, Math.min(1, steer)),
      handbrake,
      upright: this.take('upright'),
      respawn: this.take('respawn'),
      tune: this.take('tune'),
      selectVehicle,
    };
  }
}
