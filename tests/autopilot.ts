import type { GameCore, GameInput } from '../src/sim/GameCore';
import { Autopilot as Pilot } from '../src/sim/Autopilot';

/** The game's autopilot, driving the player's vehicle of a GameCore. */
export class Autopilot extends Pilot {
  input(core: GameCore, throttle = 1): GameInput {
    return { ...this.drive(core.sim.vehicle, throttle), upright: false, respawn: false, tune: false };
  }
}
