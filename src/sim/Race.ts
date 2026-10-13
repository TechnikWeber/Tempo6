import type { Gate } from './Track';

export type RaceEvent = 'start' | 'lap' | null;

/** Lap timing over ordered checkpoints. Pure logic, no physics. */
export class Race {
  /** Index of the gate that has to be passed next. */
  next = 0;
  running = false;
  lapTime = 0;
  lastLap: number | null = null;
  laps = 0;

  constructor(private readonly gates: Gate[], public best: number | null = null) {}

  update(x: number, z: number, dt: number): RaceEvent {
    if (this.running) this.lapTime += dt;
    const g = this.gates[this.next];
    if (Math.abs(x - g.x) > g.hx || Math.abs(z - g.z) > g.hz) return null;

    const wasFinish = this.next === 0;
    this.next = (this.next + 1) % this.gates.length;
    if (!wasFinish) return null;

    if (!this.running) {
      this.running = true;
      this.lapTime = 0;
      return 'start';
    }
    this.lastLap = this.lapTime;
    this.laps++;
    if (this.best === null || this.lapTime < this.best) this.best = this.lapTime;
    this.lapTime = 0;
    return 'lap';
  }

  /** Abort the current lap, e.g. after jumping back to the start. */
  reset(): void {
    this.next = 0;
    this.running = false;
    this.lapTime = 0;
  }
}
