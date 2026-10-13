import { BOOST, STAGES, type TuningStage } from '../config/tuning';
import { UNLOCK_ALL, VEHICLES, type VehicleId } from '../config/vehicles';

/** The slice of the Web Storage API we need, so tests can pass a stub. */
export interface Store {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

const KEY = 'tempo6.save.v2';
/** Unlock id of the boost capacitor; it shares the list with vehicles and tracks. */
const BOOST_ID = 'kondensator';

/** Player progress: Pfand money, tuning stage, unlocks, best laps. */
export class Progress {
  /** Money in cents. */
  money = 0;
  stageIndex = 0;
  vehicle: VehicleId = 'trex';
  track = '';
  /** Best lap in seconds per track id. */
  readonly bestLaps: Record<string, number> = {};
  /** Chosen driving profile (index into the vehicle's list) per vehicle id. */
  readonly profiles: Record<string, number> = {};
  /** Ids of bought vehicles and tracks. */
  readonly unlocked = new Set<string>();

  constructor(private readonly store?: Store) {
    const raw = store?.getItem(KEY);
    if (!raw) return;
    try {
      const d = JSON.parse(raw);
      this.money = Math.max(0, d.money | 0);
      this.stageIndex = Math.min(STAGES.length - 1, Math.max(0, d.stageIndex | 0));
      if (d.vehicle in VEHICLES) this.vehicle = d.vehicle;
      if (typeof d.track === 'string') this.track = d.track;
      for (const [k, v] of Object.entries(d.bestLaps ?? {})) if (typeof v === 'number') this.bestLaps[k] = v;
      for (const [k, v] of Object.entries(d.profiles ?? {})) if (typeof v === 'number') this.profiles[k] = v;
      for (const id of d.unlocked ?? []) if (typeof id === 'string') this.unlocked.add(id);
    } catch {
      // A broken save just means starting over.
    }
  }

  get stage(): TuningStage {
    return STAGES[this.stageIndex];
  }

  get nextStage(): TuningStage | null {
    return STAGES[this.stageIndex + 1] ?? null;
  }

  get canTune(): boolean {
    const n = this.nextStage;
    return n !== null && this.money >= n.price;
  }

  earn(cents: number): void {
    this.money += cents;
    this.save();
  }

  buyNext(): boolean {
    const n = this.nextStage;
    if (!n || this.money < n.price) return false;
    this.money -= n.price;
    this.stageIndex++;
    this.save();
    return true;
  }

  /** Whether the boost capacitor has been bought. */
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
        stageIndex: this.stageIndex,
        vehicle: this.vehicle,
        track: this.track,
        bestLaps: this.bestLaps,
        profiles: this.profiles,
        unlocked: [...this.unlocked],
      }),
    );
  }

  wipe(): void {
    this.money = 0;
    this.stageIndex = 0;
    this.unlocked.clear();
    for (const k of Object.keys(this.bestLaps)) delete this.bestLaps[k];
    this.save();
  }
}
