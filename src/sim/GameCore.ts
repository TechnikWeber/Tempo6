import { BOOST, PICKUP_VALUE, type TuningStage } from '../config/tuning';
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
  /** Buy the boost battery. */
  buyBoost?: boolean;
}

export type GameEvent =
  | { type: 'pickup'; kind: PickupDef['type']; value: number }
  | { type: 'lapStart' }
  | { type: 'lap'; time: number; best: boolean }
  | { type: 'tuned'; stage: TuningStage }
  | { type: 'broke'; missing: number }
  | { type: 'boostBought' }
  | { type: 'boost' }
  | { type: 'land'; speed: number };

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
    this.race = new Race(track.gates, progress.bestLaps[track.id] ?? null);
    this.pickupTimers = track.pickups.map(() => 0);
    this.applyStage();
  }

  applyStage(): void {
    const s = this.progress.stage;
    const v = this.sim.vehicle;
    const spec = v.spec;
    v.profile = spec.profiles[this.profileIndex] ?? spec.profiles[0];
    v.boostFitted = this.progress.hasBoost;
    v.setMotor((s.topSpeedKmh * spec.speedFactor * v.profile.speed) / 3.6, s.accel * spec.accelFactor * v.profile.accel);
  }

  /** Index of the driving profile in use for the current vehicle. */
  get profileIndex(): number {
    const spec = this.sim.vehicle.spec;
    const i = this.progress.profiles[spec.id] ?? 0;
    return i < spec.profiles.length ? i : 0;
  }

  setProfile(index: number): void {
    this.progress.profiles[this.sim.vehicle.spec.id] = index;
    this.progress.save();
    this.applyStage();
  }

  /** Top speed of the current vehicle at the current tuning stage, in km/h. */
  get topSpeedKmh(): number {
    return this.sim.vehicle.topSpeed * 3.6;
  }

  setVehicle(id: VehicleId): void {
    this.progress.vehicle = id;
    this.progress.save();
    this.sim.setVehicle(VEHICLES[id]);
    this.applyStage();
    this.race.reset();
  }

  dispose(): void {
    this.sim.world.free();
  }

  /** Level back to its initial state: vehicle at the start, props and pickups restored. Progress stays. */
  restart(): void {
    this.sim.respawn();
    this.sim.resetProps();
    this.race.reset();
    this.pickupTimers.fill(0);
    this.flippedFor = 0;
  }

  step(input: GameInput): void {
    const { sim, progress, race } = this;

    if (input.respawn) {
      this.restart();
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

    if (input.buyBoost && !progress.hasBoost) {
      if (progress.buyBoost()) {
        this.applyStage();
        this.events.push({ type: 'boostBought' });
      } else {
        this.events.push({ type: 'broke', missing: BOOST.price - progress.money });
      }
    }

    const wasBoosting = sim.vehicle.boosting;
    sim.step(input);

    const v = sim.vehicle;
    if (v.boosting && !wasBoosting) this.events.push({ type: 'boost' });
    const p = v.body.translation();
    if (v.landing > 0) {
      this.events.push({ type: 'land', speed: v.landing });
      v.landing = 0;
    }
    this.flippedFor = v.upY < 0.35 ? this.flippedFor + STEP : 0;

    const ev = race.update(p.x, p.z, STEP);
    if (ev === 'start') this.events.push({ type: 'lapStart' });
    if (ev === 'lap') {
      const best = race.best === race.lastLap;
      if (best) {
        progress.bestLaps[this.track.id] = race.best!;
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
