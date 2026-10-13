import { STUNTS } from '../config/tuning';
import type { Tracked } from './Tracked';
import type { Vehicle } from './Vehicle';

export type StuntKind = 'drift' | 'twoWheels' | 'wheelie' | 'air' | 'looping' | 'nearMiss';

export interface Stunt {
  kind: StuntKind;
  /** Schrauben it earned, multiplier included. */
  points: number;
  multiplier: number;
}

const SUSTAINED = ['drift', 'twoWheels', 'wheelie', 'air'] as const;

/**
 * Watches the driving for stunts and keeps the score of the current lap. What it holds is
 * not the player's yet: the game banks it at the finish line, and a write-off loses it.
 */
export class Stunts {
  /** Schrauben earned since the last time they were banked. */
  pending = 0;
  /** Stunts in the current run; each one raises the multiplier. */
  chain = 0;
  private chainLeft = 0;
  /** How long each sustained stunt has been going on, 0 if it is not. */
  private readonly going: Record<(typeof SUSTAINED)[number], number> = { drift: 0, twoWheels: 0, wheelie: 0, air: 0 };
  private inverted = false;
  /** Per traffic car: whether it is being passed closely right now. */
  private close: boolean[] = [];

  get multiplier(): number {
    return Math.min(STUNTS.chainMax, 1 + this.chain * STUNTS.chainStep);
  }

  /** @returns the stunts completed in this step */
  update(v: Vehicle, traffic: Tracked[], dt: number): Stunt[] {
    const done: Stunt[] = [];
    const award = (kind: StuntKind, base: number) => {
      const multiplier = this.multiplier;
      const points = base * multiplier;
      this.pending += points;
      this.chain++;
      this.chainLeft = STUNTS.chainWindow;
      done.push({ kind, points, multiplier });
    };
    const speed = Math.abs(v.speed);
    const grounded = v.wheelsOnGround > 0;
    const upright = v.upY > 0.3;
    const tilted = Math.abs(v.roll) > 0.2 && v.wheelsOnGround < v.spec.wheels.length;
    const active = {
      twoWheels: grounded && upright && tilted && speed > 2,
      drift: grounded && upright && !tilted && speed > 3 && Math.abs(v.slip) > 0.2,
      wheelie: grounded && upright && !tilted && speed > 2 && v.nose > 0.17,
      air: !grounded && !v.wrecked,
    };
    let busy = false;
    for (const kind of SUSTAINED) {
      if (active[kind]) {
        this.going[kind] += dt;
        busy = true;
      } else if (this.going[kind] > 0) {
        // a flight only counts if it ends on the wheels
        if (this.going[kind] >= STUNTS[kind].min && (kind !== 'air' || upright)) award(kind, this.going[kind] * STUNTS[kind].perSecond);
        this.going[kind] = 0;
      }
    }
    // upside down with the wheels on something: that is the top of a looping
    if (grounded && v.upY < -0.7) {
      if (!this.inverted) award('looping', STUNTS.looping);
      this.inverted = true;
    } else if (v.upY > 0.5) {
      this.inverted = false;
    }
    const at = v.body.translation();
    traffic.forEach((car, i) => {
      const c = car.body.translation();
      const d = Math.hypot(c.x - at.x, c.z - at.z);
      if (d < 3.2 && speed > 4) this.close[i] = true;
      else if (d > 5 && this.close[i]) {
        this.close[i] = false;
        award('nearMiss', STUNTS.nearMiss);
      }
    });
    // the run lasts as long as something is going on, and a little longer
    if (busy) this.chainLeft = STUNTS.chainWindow;
    else if (this.chain > 0 && (this.chainLeft -= dt) <= 0) this.chain = 0;
    return done;
  }

  /** A knock ends the run, and whatever was in progress with it. */
  crash(): void {
    this.chain = 0;
    this.close.fill(false);
    for (const kind of SUSTAINED) this.going[kind] = 0;
  }

  /** Take what has been earned; the run goes on. */
  bank(): number {
    const sum = Math.round(this.pending);
    this.pending = 0;
    return sum;
  }

  reset(): void {
    this.crash();
    this.pending = 0;
    this.inverted = false;
  }
}
