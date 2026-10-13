import { STAGES, type TuningStage } from '../config/tuning';
import type { VehicleId } from '../config/vehicles';

/** The slice of the Web Storage API we need, so tests can pass a stub. */
export interface Store {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

const KEY = 'tempo6.save.v1';

/** Player progress: Pfand money, tuning stage, best lap. */
export class Progress {
  /** Money in cents. */
  money = 0;
  stageIndex = 0;
  bestLap: number | null = null;
  vehicle: VehicleId = 'wheelchair';

  constructor(private readonly store?: Store) {
    const raw = store?.getItem(KEY);
    if (!raw) return;
    try {
      const d = JSON.parse(raw);
      this.money = Math.max(0, d.money | 0);
      this.stageIndex = Math.min(STAGES.length - 1, Math.max(0, d.stageIndex | 0));
      this.bestLap = typeof d.bestLap === 'number' ? d.bestLap : null;
      if (d.vehicle === 'scooter' || d.vehicle === 'wheelchair') this.vehicle = d.vehicle;
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

  save(): void {
    this.store?.setItem(
      KEY,
      JSON.stringify({ money: this.money, stageIndex: this.stageIndex, bestLap: this.bestLap, vehicle: this.vehicle }),
    );
  }

  wipe(): void {
    this.money = 0;
    this.stageIndex = 0;
    this.bestLap = null;
    this.save();
  }
}
