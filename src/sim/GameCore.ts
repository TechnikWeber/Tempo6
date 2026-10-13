import { PICKUP_VALUE, type TuningStage } from '../config/tuning';
import { VEHICLES, type VehicleId } from '../config/vehicles';
import type { Progress } from './Progress';
import { Race } from './Race';
import { Sim, STEP } from './Sim';
import type { PickupDef, TrackDef } from './Track';
import type { DriveInput } from './Vehicle';

export interface GameInput extends DriveInput {
  /** One-shot actions, true only on the step they were triggered. */
  upright: boolean;
  respawn: boolean;
  tune: boolean;
  selectVehicle: VehicleId | null;
}

export type GameEvent =
  | { type: 'pickup'; kind: PickupDef['type']; value: number }
  | { type: 'lapStart' }
  | { type: 'lap'; time: number; best: boolean }
  | { type: 'tuned'; stage: TuningStage }
  | { type: 'broke'; missing: number }
  | { type: 'vehicle'; id: VehicleId };

const PICKUP_RADIUS = 1.0;
const PICKUP_RESPAWN = 15;

/** Everything that makes up a running game except rendering, input devices and audio. */
export class GameCore {
  readonly sim: Sim;
  readonly race: Race;
  /** Seconds until each pickup is back; 0 means it can be collected. */
  readonly pickupTimers: number[];
  /** Events since the last drain, for HUD and sound. */
  readonly events: GameEvent[] = [];
  /** How long the vehicle has been lying on its side or roof. */
  flippedFor = 0;

  constructor(readonly track: TrackDef, readonly progress: Progress) {
    this.sim = new Sim(track, VEHICLES[progress.vehicle]);
    this.race = new Race(track.gates, progress.bestLap);
    this.pickupTimers = track.pickups.map(() => 0);
    this.applyStage();
  }

  applyStage(): void {
    const s = this.progress.stage;
    this.sim.vehicle.setMotor(s.topSpeedKmh / 3.6, s.accel);
  }

  step(input: GameInput): void {
    const { sim, progress, race } = this;

    if (input.selectVehicle && input.selectVehicle !== sim.vehicle.spec.id) {
      progress.vehicle = input.selectVehicle;
      progress.save();
      sim.setVehicle(VEHICLES[input.selectVehicle]);
      race.reset();
      this.events.push({ type: 'vehicle', id: input.selectVehicle });
    }
    if (input.respawn) {
      sim.respawn();
      race.reset();
    } else if (input.upright) {
      sim.vehicle.upright();
    }
    if (input.tune) {
      const next = progress.nextStage;
      if (progress.buyNext()) {
        this.applyStage();
        this.events.push({ type: 'tuned', stage: progress.stage });
      } else if (next) {
        this.events.push({ type: 'broke', missing: next.price - progress.money });
      }
    }

    sim.step(input);

    const v = sim.vehicle;
    const p = v.body.translation();
    this.flippedFor = v.upY < 0.35 ? this.flippedFor + STEP : 0;

    const ev = race.update(p.x, p.z, STEP);
    if (ev === 'start') this.events.push({ type: 'lapStart' });
    if (ev === 'lap') {
      const best = race.best === race.lastLap;
      if (best) {
        progress.bestLap = race.best;
        progress.save();
      }
      this.events.push({ type: 'lap', time: race.lastLap!, best });
    }

    this.track.pickups.forEach((pk, i) => {
      if (this.pickupTimers[i] > 0) {
        this.pickupTimers[i] = Math.max(0, this.pickupTimers[i] - STEP);
        return;
      }
      const dx = pk.pos[0] - p.x, dy = pk.pos[1] - p.y, dz = pk.pos[2] - p.z;
      if (dx * dx + dy * dy + dz * dz > PICKUP_RADIUS * PICKUP_RADIUS) return;
      this.pickupTimers[i] = PICKUP_RESPAWN;
      const value = PICKUP_VALUE[pk.type];
      progress.earn(value);
      this.events.push({ type: 'pickup', kind: pk.type, value });
    });
  }
}
