import { BOOST, STAGES, TUTORIAL_STAGE, type TuningStage } from '../config/tuning';
import { UNLOCK_ALL, VEHICLES, type VehicleId } from '../config/vehicles';

/** The slice of the Web Storage API we need, so tests can pass a stub. */
export interface Store {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

// (v3: the money is Schrauben now, not cents of Pfand; the tuning stage is kept per vehicle since)
const KEY = 'tempo6.save.v3';
/** Unlock id of the boost battery; it shares the list with vehicles and tracks. */
const BOOST_ID = 'boost';

/** One line of a leaderboard. */
export interface BoardEntry {
  /** Lap time in seconds. */
  time: number;
  name: string;
  vehicle: VehicleId;
  /** Tuning stage it was driven at. */
  stage: number;
  /** Milliseconds since 1970. */
  date: number;
}

/** A recorded lap to race against: where the vehicle was, ten times a second. */
export interface GhostLap {
  time: number;
  vehicle: VehicleId;
  /** x, y, z and the rotation as a quaternion, seven numbers per sample. */
  samples: number[];
}

/** Samples of a ghost lap per second. */
export const GHOST_RATE = 10;
/** Entries kept per track. */
const BOARD_SIZE = 10;
const GHOST_KEY = 'tempo6.ghost.';

/** Player progress: Schrauben, tuning stages, unlocks, best laps. */
export class Progress {
  /** Schrauben. */
  money = 0;
  /** Tuning stage per vehicle id; every vehicle starts at walking pace. */
  readonly stages: Record<string, number> = {};
  /**
   * Whether the tutorial in the Reha-Parcours is over: one vehicle got through and was tuned
   * to TUTORIAL_STAGE. From then on every vehicle has its throttle off, and the tracks open.
   */
  tutorialDone = false;
  vehicle: VehicleId = 'trex';
  track = '';
  /** Best lap in seconds per track id. */
  readonly bestLaps: Record<string, number> = {};
  /** Chosen driving profile (index into the vehicle's list) per vehicle id. */
  readonly profiles: Record<string, number> = {};
  /** Ids of bought vehicles and tracks. */
  readonly unlocked = new Set<string>();
  /** The name on the leaderboards. */
  name = 'Du';
  /** Whether the best lap drives along as a shadow. */
  showGhost = true;
  /**
   * Best laps per track id, fastest first. Kept on this device for now; the same entries
   * are what a shared board on a server would hold.
   */
  readonly boards: Record<string, BoardEntry[]> = {};

  constructor(private readonly store?: Store) {
    const raw = store?.getItem(KEY);
    if (!raw) return;
    try {
      const d = JSON.parse(raw);
      this.money = Math.max(0, d.money | 0);
      if (d.vehicle in VEHICLES) this.vehicle = d.vehicle;
      for (const [k, v] of Object.entries(d.stages ?? {})) if (typeof v === 'number') this.stages[k] = Math.min(STAGES.length - 1, Math.max(0, v | 0));
      // (an older save had one stage for all; it goes to the vehicle it was driven with)
      if (!d.stages && d.stageIndex > 0) this.stages[this.vehicle] = Math.min(STAGES.length - 1, d.stageIndex | 0);
      this.tutorialDone = d.tutorialDone === true || Object.values(this.stages).some((n) => n >= TUTORIAL_STAGE);
      if (typeof d.track === 'string') this.track = d.track;
      for (const [k, v] of Object.entries(d.bestLaps ?? {})) if (typeof v === 'number') this.bestLaps[k] = v;
      for (const [k, v] of Object.entries(d.profiles ?? {})) if (typeof v === 'number') this.profiles[k] = v;
      for (const id of d.unlocked ?? []) if (typeof id === 'string') this.unlocked.add(id);
      if (typeof d.name === 'string' && d.name.trim()) this.name = d.name.slice(0, 16);
      if (typeof d.showGhost === 'boolean') this.showGhost = d.showGhost;
      for (const [k, list] of Object.entries(d.boards ?? {})) {
        if (Array.isArray(list)) this.boards[k] = list.filter((e) => typeof e?.time === 'number' && e.vehicle in VEHICLES).slice(0, BOARD_SIZE);
      }
    } catch {
      // A broken save just means starting over.
    }
  }

  /** Tuning stage of the current vehicle. */
  get stageIndex(): number {
    return this.stageOf(this.vehicle);
  }

  set stageIndex(i: number) {
    this.stages[this.vehicle] = i;
  }

  /**
   * Whether a vehicle has been through the Reha-Parcours. Until then it is held at walking
   * pace and that is the only track it may take.
   */
  trained(id: VehicleId = this.vehicle): boolean {
    return this.stageOf(id) > 0;
  }

  /** Tuning stage of any vehicle; after the tutorial none is below the first. */
  stageOf(id: string): number {
    return Math.max(this.stages[id] ?? 0, this.tutorialDone ? 1 : 0);
  }

  /** The Reha-Parcours is done: the first stage comes free. */
  graduate(): void {
    if (this.stageIndex === 0) this.stageIndex = 1;
    this.save();
  }

  get stage(): TuningStage {
    return STAGES[this.stageIndex];
  }

  get nextStage(): TuningStage | null {
    return STAGES[this.stageIndex + 1] ?? null;
  }

  get canTune(): boolean {
    const n = this.nextStage;
    return n !== null && this.trained() && this.money >= n.price;
  }

  earn(screws: number): void {
    this.money += screws;
    this.save();
  }

  buyNext(): boolean {
    const n = this.nextStage;
    if (!n || !this.trained() || this.money < n.price) return false;
    this.money -= n.price;
    this.stageIndex++;
    if (this.stageIndex >= TUTORIAL_STAGE) this.tutorialDone = true;
    this.save();
    return true;
  }

  /**
   * Enter a lap on the board of a track.
   * @returns its place, 1 for the fastest, or 0 if it did not make the board
   */
  addTime(track: string, entry: BoardEntry): number {
    const list = (this.boards[track] ??= []);
    list.push(entry);
    list.sort((a, b) => a.time - b.time);
    list.length = Math.min(list.length, BOARD_SIZE);
    this.save();
    return list.indexOf(entry) + 1;
  }

  /** The recorded best lap of a track, if there is one. */
  loadGhost(track: string): GhostLap | null {
    try {
      const g = JSON.parse(this.store?.getItem(GHOST_KEY + track) ?? 'null');
      return g && typeof g.time === 'number' && g.vehicle in VEHICLES && Array.isArray(g.samples) ? g : null;
    } catch {
      return null;
    }
  }

  saveGhost(track: string, ghost: GhostLap): void {
    try {
      this.store?.setItem(GHOST_KEY + track, JSON.stringify(ghost));
    } catch {
      // No room left in the storage: then there is no shadow, the game goes on.
    }
  }

  /** Whether the boost battery has been bought. */
  get hasBoost(): boolean {
    return this.isUnlocked(BOOST_ID, BOOST.price);
  }

  buyBoost(): boolean {
    return this.unlock(BOOST_ID, BOOST.price);
  }

  /** Vehicles and tracks share one unlock list; free items are always open. */
  isUnlocked(id: string, price: number): boolean {
    return UNLOCK_ALL || price === 0 || this.unlocked.has(id);
  }

  unlock(id: string, price: number): boolean {
    if (this.isUnlocked(id, price)) return true;
    if (this.money < price) return false;
    this.money -= price;
    this.unlocked.add(id);
    this.save();
    return true;
  }

  save(): void {
    this.store?.setItem(
      KEY,
      JSON.stringify({
        money: this.money,
        stages: this.stages,
        tutorialDone: this.tutorialDone,
        vehicle: this.vehicle,
        track: this.track,
        bestLaps: this.bestLaps,
        profiles: this.profiles,
        unlocked: [...this.unlocked],
        name: this.name,
        showGhost: this.showGhost,
        boards: this.boards,
      }),
    );
  }

  wipe(): void {
    this.money = 0;
    for (const k of Object.keys(this.stages)) delete this.stages[k];
    this.tutorialDone = false;
    this.unlocked.clear();
    for (const k of Object.keys(this.bestLaps)) delete this.bestLaps[k];
    for (const k of Object.keys(this.boards)) delete this.boards[k];
    this.save();
  }
}
