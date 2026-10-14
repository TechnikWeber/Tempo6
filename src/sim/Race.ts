import type { Gate } from './Track';

/**
 * `missed`: over the finish line with a checkpoint left out, so the lap does not count.
 */
export type RaceEvent = 'start' | 'lap' | 'missed' | null;

/**
 * Lap timing over ordered checkpoints. Pure logic, no physics.
 *
 * On a lap the first gate is start and finish. On a course (point to point) the first gate
 * is the start and the last one the finish: reaching it ends the run.
 */
export class Race {
  /** Index of the gate that has to be passed next. */
  next = 0;
  running = false;
  lapTime = 0;
  lastLap: number | null = null;
  laps = 0;
  /** Whether the vehicle was on the finish line at the last look, so a missed lap is told once. */
  private onFinish = false;

  constructor(private readonly gates: Gate[], public best: number | null = null, readonly course = false) {}

  private inside(g: Gate, x: number, z: number): boolean {
    return Math.abs(x - g.x) <= g.hx && Math.abs(z - g.z) <= g.hz;
  }

  update(x: number, z: number, dt: number): RaceEvent {
    if (this.running) this.lapTime += dt;
    // round the lap again and over the line with a checkpoint left out: it does not count
    if (!this.course) {
      const onFinish = this.inside(this.gates[0], x, z);
      const missed = onFinish && !this.onFinish && this.running && this.next !== 0 && this.next !== 1;
      this.onFinish = onFinish;
      if (missed) return 'missed';
    }
    const g = this.gates[this.next];
    if (!this.inside(g, x, z)) return null;

    if (this.course) {
      if (!this.running) {
        if (this.next !== 0) return null;
        this.running = true;
        this.lapTime = 0;
        this.next = 1;
        return 'start';
      }
      if (this.next < this.gates.length - 1) {
        this.next++;
        return null;
      }
      // over the finish: the run is done, the next one starts at the start again
      this.finish();
      this.running = false;
      this.next = 0;
      return 'lap';
    }

    const wasFinish = this.next === 0;
    this.next = (this.next + 1) % this.gates.length;
    if (!wasFinish) return null;

    if (!this.running) {
      this.running = true;
      this.lapTime = 0;
      return 'start';
    }
    this.finish();
    return 'lap';
  }

  private finish(): void {
    this.lastLap = this.lapTime;
    this.laps++;
    if (this.best === null || this.lapTime < this.best) this.best = this.lapTime;
    this.lapTime = 0;
  }

  /** Abort the current lap, e.g. after jumping back to the start. */
  reset(): void {
    this.next = 0;
    this.running = false;
    this.lapTime = 0;
    this.onFinish = false;
  }

  /** On a course, back at the start after a fall: the clock runs on, the checkpoints start over. */
  backToStart(): void {
    if (this.running) this.next = 1;
  }
}
