import { CRASH, FREESTYLE, RACE, type ModeId } from '../config/modes';
import { BONUS, BOOST, PICKUP_VALUE, stageSpeedKmh, STAGES, type TuningStage } from '../config/tuning';
import { VEHICLE_ORDER, VEHICLES, type VehicleId } from '../config/vehicles';
import { Autopilot } from './Autopilot';
import { GHOST_RATE, type GhostLap, type Progress } from './Progress';
import { Race } from './Race';
import { Sim, STEP } from './Sim';
import { Stunts, type StuntKind } from './Stunts';
import type { PickupDef, TrackDef } from './Track';
import { TRAINING } from '../tracks';
import type { DriveInput, Vehicle } from './Vehicle';

/** An opponent in a race: its vehicle, who drives it, and how far it has got. */
export interface Rival {
  vehicle: Vehicle;
  pilot: Autopilot;
  race: Race;
  /** Where it started on the grid. */
  grid: { x: number; z: number; yaw: number };
  /** Its own top speed (m/s), before keeping up with the player. */
  pace: number;
}

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
  /** Tuning asked for before the vehicle has been through the tutorial. */
  | { type: 'untrained' }
  /** Through the tutorial for the first time with this vehicle: the throttle comes off. */
  | { type: 'graduated'; stage: TuningStage }
  | { type: 'boostBought' }
  | { type: 'boost' }
  | { type: 'honk' }
  | { type: 'land'; speed: number }
  /** A knock that did damage; `impact` is the change of speed in m/s. */
  | { type: 'crash'; impact: number; damage: number }
  | { type: 'wreck' }
  | { type: 'stunt'; kind: StuntKind; points: number; multiplier: number }
  /** The start lights: 3, 2, 1, and 0 for go. */
  | { type: 'count'; n: number }
  /** A lap made the board of the track; `place` 1 is the fastest. */
  | { type: 'ranked'; place: number }
  /** Schrauben paid out at the finish line, and what for. */
  | { type: 'payout'; total: number; lap: number; best: number; clean: number; stunts: number }
  /** Race: over the line after the last lap, in this place out of `of`, and the prize. */
  | { type: 'raceOver'; place: number; of: number; pay: number }
  /** Freestyle: a run of stunts ended and was paid; `record` if it is the best on this track. */
  | { type: 'chain'; total: number }
  /** Freestyle: a knock ended the run, and what it had earned is gone. */
  | { type: 'chainLost'; lost: number }
  /** Over the finish line with a checkpoint left out: the lap does not count. */
  | { type: 'missed' }
  | { type: 'skipped'; gate: number }
  /** Fallen off a course in the sky: back at the start, the clock running on. */
  | { type: 'fell' }
  /** Freestyle: time is up; what the session earned, and whether it is the best here. */
  | { type: 'freestyleOver'; total: number; record: boolean }
  /** Crashtest: a knock (or the write-off) scored. */
  | { type: 'crashScore'; points: number; total: number; propeller: boolean }
  /** Crashtest: it all lies still; the score, what it paid, and whether it is the best here. */
  | { type: 'crashOver'; score: number; pay: number; record: boolean };

const PICKUP_RADIUS = 1.0;
/** Seconds each of the three start lights stays on. */
const LIGHT = 0.75;
const START_LIGHTS = 3 * LIGHT;
const PICKUP_RESPAWN = 15;
/** Metres beyond the edge of the road before the ground starts to slow. */
const OFFROAD_GRACE = 1.5;

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
  /** Stunt score of the lap in progress; banked at the finish line. */
  readonly stunts = new Stunts();
  /** Whether the lap in progress has cost any damage yet. */
  private scratched = false;
  /** Whether the write-off has been announced; however it came about, it is announced once. */
  private wreckSeen = false;
  /** Seconds until the start lights go out; while they are on, nothing moves. */
  countdown = 0;
  /** The best lap of this track, to drive against. */
  ghost: GhostLap | null;
  /** The lap in progress, recorded like a ghost. */
  private recording: number[] = [];
  private steps = 0;
  /** Where on the road's line the vehicle was at the last look. */
  private roadIndex = 0;
  private roadTick = 0;
  /** Seconds until a finished course run puts the vehicle back at the start. */
  private courseRestart = 0;
  private lastLight = 0;
  /** Race: the others on the grid. */
  readonly rivals: Rival[] = [];
  /** Dice for the grid; a test may load them. */
  random: () => number = Math.random;
  /** Race: the place the player finished in, 0 while still racing. */
  finished = 0;
  /** The run is over (the tutorial done): the vehicle stops and nothing more is paid. */
  halted = false;
  /** Freestyle: seconds left of the session, and what it has earned so far. */
  timeLeft: number = FREESTYLE.seconds;
  sessionTotal = 0;
  /** Crashtest: the run so far. */
  readonly crash = { started: false, score: 0, since: 0, still: 0, over: false, grace: 0 };

  constructor(readonly track: TrackDef, readonly progress: Progress, readonly mode: ModeId = 'time') {
    this.sim = new Sim(track, VEHICLES[progress.vehicle]);
    this.race = new Race(track.gates, mode === 'time' ? (progress.bestLaps[track.id] ?? null) : null, !!track.course);
    this.pickupTimers = track.pickups.map(() => 0);
    this.ghost = mode === 'time' ? progress.loadGhost(track.id) : null;
    if (mode === 'race' && track.line) this.lineUp(track.line);
    this.applyStage();
  }

  /** Whether laps are timed and paid here; freestyle and crashtest have none. */
  get laps(): boolean {
    return this.mode === 'time' || this.mode === 'race';
  }

  /** Where a grid slot is on this track. */
  private slot(k: number): { x: number; z: number; yaw: number } {
    const { pos, yaw } = this.track.spawn;
    const [back, side] = RACE.grid[k];
    return { x: pos[0] - Math.sin(yaw) * back + Math.cos(yaw) * side, z: pos[2] - Math.cos(yaw) * back - Math.sin(yaw) * side, yaw };
  }

  /** Three others on the grid with the player, in vehicles other than the player's. */
  private lineUp(line: [number, number][]): void {
    const { pos, yaw } = this.track.spawn;
    const others = VEHICLE_ORDER.filter((id) => id !== this.progress.vehicle);
    // (a different field on each track)
    const first = [...this.track.id].reduce((n, c) => n + c.charCodeAt(0), 0);
    RACE.skill.forEach((_, k) => {
      const spec = VEHICLES[others[(first + k * 4) % others.length]];
      const grid = this.slot(k + 1);
      const vehicle = this.sim.addOther(spec, grid.x, pos[1], grid.z, yaw);
      this.rivals.push({ vehicle, pilot: new Autopilot(line, 2.5).from(grid.x, grid.z), race: new Race(this.track.gates), grid, pace: vehicle.topSpeed });
    });
  }

  /** A race starts from a grid drawn afresh each time: anyone may start on the front row. */
  private drawGrid(): void {
    const order = RACE.grid.map((_, k) => k);
    for (let i = order.length - 1; i > 0; i--) {
      const j = Math.floor(this.random() * (i + 1));
      [order[i], order[j]] = [order[j], order[i]];
    }
    const mine = this.slot(order[0]);
    this.sim.vehicle.place(mine.x, this.track.spawn.pos[1], mine.z, mine.yaw);
    this.rivals.forEach((r, k) => (r.grid = this.slot(order[k + 1])));
  }

  /**
   * The others go as fast as the player does, give or take their skill. Measured against the
   * player's own top speed, not their vehicles': those differ by half, which spread the field
   * from crawling to out of reach.
   */
  private tuneRivals(): void {
    const s = this.progress.stage;
    const top = this.sim.vehicle.topSpeed;
    this.rivals.forEach((r, k) => {
      r.pace = top * RACE.skill[k];
      r.vehicle.setMotor(r.pace, s.accel * r.vehicle.spec.accelFactor);
      r.vehicle.boostFitted = this.progress.hasBoost;
    });
  }

  /** Ahead of the player, an opponent eases off a little; behind, it pushes on. */
  private keepUp(r: Rival): void {
    const me = this.sim.vehicle;
    const p = me.body.translation(), q = r.vehicle.body.translation();
    const mine = this.standing(this.race, p.x, p.z), theirs = this.standing(r.race, q.x, q.z);
    let f = 1;
    if (mine >= 0 && theirs >= 0 && !this.finished) {
      const pull = Math.min(1, Math.hypot(q.x - p.x, q.z - p.z) / RACE.catchUpRange) * RACE.catchUp;
      f = theirs > mine ? 1 - pull : 1 + pull;
    }
    r.vehicle.setMotor(Math.min(r.pace * f, Math.max(r.pace, me.topSpeed)), r.vehicle.accel);
  }

  /** How an opponent drives this step: the line, and the boost on the straights. */
  private rivalInput(r: Rival): DriveInput {
    this.keepUp(r);
    const input = r.pilot.drive(r.vehicle);
    const v = r.vehicle;
    // on a straight, at speed, once the battery is full, and then until the straight ends. They
    // do not answer the player's boost: that is the moment to get past them.
    const straight = Math.abs(input.steer) < 0.25 && input.throttle > 0 && v.speed > v.topSpeed * 0.6;
    input.boost = v.boostFitted && straight && (v.boosting || v.boostCharge > 0.95);
    return input;
  }

  /** How far along the race someone is: laps, then gates, then how close to the next one. */
  private standing(race: Race, x: number, z: number): number {
    if (!race.running) return -1;
    const g = this.track.gates;
    const next = g[race.next];
    return race.laps * g.length + ((race.next + g.length - 1) % g.length) - Math.hypot(next.x - x, next.z - z) / 1e4;
  }

  /** Race: the player's place right now (or the one finished in), 1 is first. */
  get place(): number {
    if (this.finished) return this.finished;
    const p = this.sim.vehicle.body.translation();
    const mine = this.standing(this.race, p.x, p.z);
    return 1 + this.rivals.filter((r) => {
      const q = r.vehicle.body.translation();
      return this.standing(r.race, q.x, q.z) > mine;
    }).length;
  }

  applyStage(): void {
    const s = this.progress.stage;
    const v = this.sim.vehicle;
    const spec = v.spec;
    v.profile = spec.profiles[this.profileIndex] ?? spec.profiles[0];
    v.boostFitted = this.progress.hasBoost;
    v.setMotor(stageSpeedKmh(s, spec.speedFactor * v.profile.speed) / 3.6, s.accel * spec.accelFactor * v.profile.accel);
    // the crashtest is driven flat out, the boost battery on the lap, whatever has been bought
    if (this.mode === 'crash') {
      const max = STAGES[STAGES.length - 1];
      v.setMotor(stageSpeedKmh(max, spec.speedFactor * v.profile.speed) / 3.6, max.accel * spec.accelFactor * v.profile.accel);
      v.boostFitted = true;
    }
    this.tuneRivals();
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

  /**
   * Level back to its initial state: vehicle at the start, props and pickups restored. Progress stays.
   * @param lights hold the vehicle on the grid for the start lights
   */
  restart(lights = false): void {
    this.countdown = lights ? START_LIGHTS : 0;
    this.lastLight = 0;
    this.recording = [];
    this.sim.respawn();
    if (this.rivals.length) this.drawGrid();
    this.sim.resetProps();
    this.sim.resetMovers();
    this.sim.traffic.reset();
    this.race.reset();
    this.pickupTimers.fill(0);
    for (const r of this.rivals) {
      r.vehicle.place(r.grid.x, this.track.spawn.pos[1], r.grid.z, r.grid.yaw);
      r.vehicle.setDamage(0);
      r.race.reset();
      r.pilot.from(r.grid.x, r.grid.z);
    }
    this.finished = 0;
    this.halted = false;
    this.timeLeft = FREESTYLE.seconds;
    this.sessionTotal = 0;
    this.courseRestart = 0;
    Object.assign(this.crash, { started: false, score: 0, since: 0, still: 0, over: false, grace: 0 });
    this.sim.vehicle.knock = 0;
    this.flippedFor = 0;
    this.stunts.reset();
    this.scratched = false;
  }

  /**
   * Whether Schrauben are out to be had. Not on the first run through the tutorial: that
   * one is for learning to drive, and getting through is its own reward.
   */
  get paying(): boolean {
    return this.track.id !== TRAINING || this.progress.trained();
  }

  /** Buy the next tuning stage, on the track or in the garage; the events say how it went. */
  tune(): void {
    const { progress } = this;
    const next = progress.nextStage;
    if (progress.buyNext()) {
      this.applyStage();
      this.events.push({ type: 'tuned', stage: progress.stage });
    } else if (next && !progress.trained()) {
      this.events.push({ type: 'untrained' });
    } else if (next) {
      this.events.push({ type: 'broke', missing: next.price - progress.money });
    }
  }

  buyBoost(): void {
    const { progress } = this;
    if (progress.hasBoost) return;
    if (progress.boostOwned) {
      // already owned, just switched off: turning it back on costs nothing
      progress.setBoostActive(true);
      this.applyStage();
      return;
    }
    if (progress.buyBoost()) {
      this.applyStage();
      this.events.push({ type: 'boostBought' });
    } else {
      this.events.push({ type: 'broke', missing: BOOST.price - progress.money });
    }
  }

  /** Switch the boost battery off without losing it; buyBoost() fits it again for free. */
  dropBoost(): void {
    this.progress.setBoostActive(false);
    this.applyStage();
  }

  /** Switch to a tuning stage already owned (lower or higher), without paying again. */
  setStage(i: number): void {
    this.progress.setStage(i);
    this.applyStage();
  }

  step(input: GameInput): void {
    const { sim, progress, race } = this;
    const paying = this.paying && !this.halted;

    if (input.respawn) {
      this.restart(true);
    } else if (input.upright) {
      sim.vehicle.upright();
    }
    if (input.tune) this.tune();
    if (input.buyBoost) this.buyBoost();

    const wasBoosting = sim.vehicle.boosting;
    if (this.countdown > 0) {
      // three lights, then go
      const light = Math.max(1, Math.ceil(this.countdown / LIGHT - 1e-9));
      if (light !== this.lastLight) this.events.push({ type: 'count', n: light });
      this.lastLight = light;
      this.countdown = Math.max(0, this.countdown - STEP);
      if (this.countdown === 0) {
        this.events.push({ type: 'count', n: 0 });
        this.lastLight = 0;
      }
      input = { ...input, throttle: 0, steer: 0, handbrake: true, boost: false };
    }
    if (this.halted) input = { ...input, throttle: 0, steer: 0, handbrake: true, boost: false };
    // Crashtest: after the first knock nobody is driving any more.
    if (this.crash.started) input = { ...input, throttle: 0, steer: 0, handbrake: false, boost: false, limp: true };
    for (const [k, r] of this.rivals.entries()) {
      sim.others[k].input = this.countdown > 0 ? { throttle: 0, steer: 0, handbrake: true } : this.rivalInput(r);
    }
    sim.step(input);
    for (const r of this.rivals) {
      const q = r.vehicle.body.translation();
      r.race.update(q.x, q.z, STEP);
    }

    const v = sim.vehicle;
    if (v.boosting && !wasBoosting) this.events.push({ type: 'boost' });
    if (v.lastHit > 0) {
      this.events.push({ type: 'crash', impact: v.lastHit, damage: v.damage });
      if (this.mode === 'freestyle' && this.stunts.pending > 0) {
        // a knock tears the run, and what it had earned goes with it
        this.events.push({ type: 'chainLost', lost: Math.round(this.stunts.pending) });
        this.stunts.reset();
      }
      v.lastHit = 0;
      this.stunts.crash();
      this.scratched = true;
    }
    if (v.wrecked && !this.wreckSeen) {
      this.events.push({ type: 'wreck' });
      if (this.mode === 'crash' && !this.crash.over) this.scoreCrash(CRASH.wreck);
      // what was not banked is gone with the vehicle
      this.stunts.reset();
    }
    this.wreckSeen = v.wrecked;
    // (a crashtest is about the knocks, not the tricks)
    const tricks = paying && this.mode !== 'crash';
    for (const s of this.stunts.update(v, sim.traffic.cars.filter((c) => c.def.type !== 'walker').map((c) => c.tracked), STEP)) if (tricks) this.events.push({ type: 'stunt', ...s });
    // Open World banks each chain of stunts as it ends, same as freestyle, but never ends itself.
    if ((this.mode === 'freestyle' || this.mode === 'open') && !this.halted) {
      if (this.stunts.chain === 0 && this.stunts.pending > 0) this.bankChain();
      if (this.mode === 'freestyle' && this.countdown === 0 && (this.timeLeft = Math.max(0, this.timeLeft - STEP)) === 0) this.finishFreestyle();
    }
    if (this.mode === 'crash') this.watchCrash();
    if (sim.traffic.honk) {
      sim.traffic.honk = false;
      this.events.push({ type: 'honk' });
    }
    const p = v.body.translation();
    if (v.landing > 0) {
      this.events.push({ type: 'land', speed: v.landing });
      v.landing = 0;
    }
    this.flippedFor = v.upY < 0.35 ? this.flippedFor + STEP : 0;

    // Ten times a second, where it is: the lap as a ghost for later.
    if (this.mode === 'time' && race.running && this.steps++ % Math.round(1 / STEP / GHOST_RATE) === 0) {
      const r = v.body.rotation();
      this.recording.push(...[p.x, p.y, p.z].map((n) => Math.round(n * 100) / 100), ...[r.x, r.y, r.z, r.w].map((n) => Math.round(n * 1000) / 1000));
    }
    // (and after the finish of a race, the laps no longer count)
    const raw = this.laps && !this.finished ? race.update(p.x, p.z, STEP) : null;
    if (raw === 'missed') this.events.push({ type: 'missed' });
    if (raw === 'skipped') this.events.push({ type: 'skipped', gate: race.skipped });
    const ev = raw === 'missed' || raw === 'skipped' ? null : raw;
    this.watchRoad(p.x, p.z);
    this.watchFall(p.y);
    if (ev === 'start') this.events.push({ type: 'lapStart' });
    if (ev === 'lap') {
      // the tutorial keeps no lap times of its own: it is driven once, then it is gone
      const best = this.mode === 'time' && this.track.id !== TRAINING && race.best === race.lastLap;
      if (best) {
        progress.bestLaps[this.track.id] = race.best!;
        progress.save();
      }
      this.events.push({ type: 'lap', time: race.lastLap!, best });
      if (this.track.id === TRAINING && !progress.trained()) {
        progress.graduate();
        this.applyStage();
        this.halted = true;
        this.events.push({ type: 'graduated', stage: progress.stage });
      }
      // the tutorial keeps no lap times of its own: it is driven once, then it is gone
      if (this.mode === 'time' && this.track.id !== TRAINING) {
        const place = progress.addTime(this.track.id, { time: race.lastLap!, name: progress.name, vehicle: v.spec.id, stage: progress.stageIndex, date: Date.now() });
        if (place > 0) this.events.push({ type: 'ranked', place });
      }
      // Zeitrennen: every lap is its own fresh attempt, so the boost battery is full again at
      // the line, same as a full restart would have it, whatever the last lap left. A race is
      // one continuous run over every lap of it: there it just goes on charging from the driving.
      // (a course track resets it anyway, in full, when it sends the vehicle back to the start)
      if (this.mode === 'time' && !this.track.course) v.boostCharge = 1;
      if (best) {
        this.ghost = { time: race.lastLap!, vehicle: v.spec.id, samples: this.recording };
        progress.saveGhost(this.track.id, this.ghost);
      }
    }
    if (ev) {
      this.recording = [];
      this.steps = 0;
    }
    // The finish line is the till: lap money and bonuses, and the stunts of the lap are safe.
    if (ev && !paying) {
      // (the stunts of the run are dropped, not saved up for later)
      this.stunts.bank();
      this.scratched = false;
    } else if (ev) {
      const lap = ev === 'lap' ? this.track.lapPay : 0;
      const forBest = ev === 'lap' && this.mode === 'time' && race.best === race.lastLap ? Math.round(lap * BONUS.best) : 0;
      const clean = ev === 'lap' && !this.scratched ? Math.round(lap * BONUS.clean) : 0;
      const stunts = this.stunts.bank();
      const total = lap + forBest + clean + stunts;
      if (total > 0) {
        progress.earn(total);
        this.events.push({ type: 'payout', total, lap, best: forBest, clean, stunts });
      }
      this.scratched = false;
    }
    if (ev === 'lap' && this.mode === 'race' && race.laps >= RACE.laps) this.finishRace();
    // a course run is over at the finish: a moment to look, then back to the start for the next
    if (ev === 'lap' && this.track.course) this.courseRestart = 2;
    if (this.courseRestart > 0 && (this.courseRestart -= STEP) <= 0) {
      this.courseRestart = 0;
      this.sim.respawn();
      this.race.reset();
    }

    if (paying && this.mode !== 'crash') this.track.pickups.forEach((pk, i) => {
      if (this.pickupTimers[i] > 0) {
        this.pickupTimers[i] = Math.max(0, this.pickupTimers[i] - STEP);
        return;
      }
      const dx = pk.pos[0] - p.x, dy = pk.pos[1] - p.y, dz = pk.pos[2] - p.z;
      if (dx * dx + dy * dy + dz * dz > PICKUP_RADIUS * PICKUP_RADIUS) return;
      this.pickupTimers[i] = PICKUP_RESPAWN;
      const value = PICKUP_VALUE[pk.type];
      progress.earn(value);
      this.sessionTotal += value;
      this.events.push({ type: 'pickup', kind: pk.type, value });
    });
  }

  /** Race: over the line for the last time. Whoever finished before is ahead. */
  private finishRace(): void {
    const ahead = this.rivals.filter((r) => r.race.laps >= RACE.laps).length;
    this.finished = ahead + 1;
    const pay = Math.round(this.track.lapPay * (RACE.placePay[ahead] ?? 0));
    if (pay > 0) this.progress.earn(pay);
    const key = `race:${this.track.id}`;
    const best = this.progress.records[key];
    if (!best || this.finished < best) this.progress.records[key] = this.finished;
    this.progress.save();
    this.events.push({ type: 'raceOver', place: this.finished, of: this.rivals.length + 1, pay });
  }

  /** Freestyle: the run of stunts is over, so it is paid. */
  private bankChain(): void {
    const total = this.stunts.bank();
    if (total <= 0) return;
    this.progress.earn(total);
    this.sessionTotal += total;
    this.events.push({ type: 'chain', total });
  }

  /** Freestyle: time is up. The run in progress is paid, and the session is settled. */
  private finishFreestyle(): void {
    this.bankChain();
    this.halted = true;
    const key = `freestyle:${this.track.id}`;
    const record = this.sessionTotal > (this.progress.records[key] ?? 0);
    if (record) this.progress.records[key] = this.sessionTotal;
    this.progress.save();
    this.events.push({ type: 'freestyleOver', total: this.sessionTotal, record });
  }

  private scoreCrash(points: number, propeller = false): void {
    this.crash.started = true;
    this.crash.score += points;
    this.events.push({ type: 'crashScore', points, total: this.crash.score, propeller });
  }

  /** Whether the vehicle is within reach of a propeller's blades, so a knock now came from it. */
  private nearPropeller(): boolean {
    const p = this.sim.vehicle.body.translation();
    return this.sim.movers.some((m) => {
      if (m.def.type !== 'propeller') return false;
      const [x, y, z] = m.def.pos;
      return Math.hypot(p.x - x, p.y - y, p.z - z) < m.def.half[1] * 2 + 1.2;
    });
  }

  /**
   * Crashtest: every knock and hard landing scores, the first one ends the driving. Once it
   * is lying still, or has had long enough, the run is over and paid.
   */
  private watchCrash(): void {
    const c = this.crash;
    const v = this.sim.vehicle;
    const knock = Math.max(v.knock, v.landing);
    v.knock = 0;
    if (c.over) return;
    c.grace = Math.max(0, c.grace - STEP);
    if (knock >= (c.started ? CRASH.minKnock : CRASH.firstKnock) && c.grace === 0 && this.countdown === 0) {
      c.grace = CRASH.grace;
      const swatted = this.nearPropeller();
      this.scoreCrash(Math.round(CRASH.perImpact * knock * knock * (swatted ? CRASH.propeller : 1)), swatted);
    }
    if (!c.started) return;
    const a = v.body.angvel();
    c.since += STEP;
    c.still = Math.abs(v.speed) < 0.4 && Math.hypot(a.x, a.y, a.z) < 0.5 ? c.still + STEP : 0;
    if (c.still < CRASH.stillFor && c.since < CRASH.maxFor) return;
    c.over = true;
    const pay = Math.round(c.score / CRASH.perScrew);
    if (pay > 0) this.progress.earn(pay);
    const key = `crash:${this.track.id}`;
    const record = c.score > (this.progress.records[key] ?? 0);
    if (record) this.progress.records[key] = c.score;
    this.progress.save();
    this.events.push({ type: 'crashOver', score: c.score, pay, record });
  }

  /** Off the road on a road circuit (in the modes that time laps): the ground is slow there. */
  private watchRoad(x: number, z: number): void {
    const half = this.track.roadHalf;
    const v = this.sim.vehicle;
    if (!half || !this.laps || !this.track.line) {
      v.offroad = 0;
      return;
    }
    // (looking near where it was last time is enough; once a second, the whole line)
    const line = this.track.line;
    const n = line.length;
    const full = this.roadTick++ % 60 === 0;
    let best = Infinity;
    const from = full ? 0 : this.roadIndex - 12, to = full ? n : this.roadIndex + 12;
    for (let k = from; k < to; k++) {
      const i = ((k % n) + n) % n;
      const [ax, az] = line[i], [bx, bz] = line[(i + 1) % n];
      const dx = bx - ax, dz = bz - az;
      const t = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / (dx * dx + dz * dz || 1)));
      const d = Math.hypot(ax + dx * t - x, az + dz * t - z);
      if (d < best) [best, this.roadIndex] = [d, i];
    }
    // a metre and a half of grace beyond the edge, then over two metres down to slow
    v.offroad = Math.max(0, Math.min(1, (best - half - OFFROAD_GRACE) / 2));
  }

  /** On a course in the sky: fallen off, so back to the start, the clock running on. */
  private watchFall(y: number): void {
    const fallY = this.track.fallY;
    if (fallY === undefined || y > fallY) return;
    this.sim.respawn();
    this.race.backToStart();
    this.stunts.reset();
    this.events.push({ type: 'fell' });
  }
}

