import type { Gate } from './Track';

/**
 * `missed`: over the finish line with a checkpoint left out, so the lap does not count.
 * `skipped`: through a later checkpoint with the one before left out (`skipped` says which).
 */
export type RaceEvent = 'start' | 'lap' | 'missed' | 'skipped' | null;

/** A checkpoint counts this far (m) beyond its posts on every side: nobody has to thread it. */
export const GATE_SLACK = 2;

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
  /** The checkpoint last told as left out, so it is told once; -1 for none. */
  skipped = -1;

  constructor(private readonly gates: Gate[], public best: number | null = null, readonly course = false) {}

  private inside(g: Gate, x: number, z: number): boolean {
    const slack = g.exact ? 0 : GATE_SLACK;
    return Math.abs(x - g.x) <= g.hx + slack && Math.abs(z - g.z) <= g.hz + slack;
  }

  /** Through a checkpoint further on than the next one: the next one was left out. Told once. */
  private skippedAhead(x: number, z: number): boolean {
    if (!this.running || this.skipped === this.next) return false;
    const n = this.gates.length;
    const prev = (this.next + n - 1) % n;
    const later = this.gates.some((g, i) => i !== this.next && i !== prev && (i !== 0 || this.course) && this.inside(g, x, z));
    if (later) this.skipped = this.next;
    return later;
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
    if (!this.inside(g, x, z)) return this.skippedAhead(x, z) ? 'skipped' : null;

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

  /** Back to before the first lap, e.g. after jumping back to the start or for a new race. */
  reset(): void {
    this.next = 0;
    this.laps = 0;
    this.skipped = -1;
    this.running = false;
    this.lapTime = 0;
    this.onFinish = false;
  }

  /** On a course, back at the start after a fall: the clock runs on, the checkpoints start over. */
  backToStart(): void {
    if (this.running) this.next = 1;
  }
}
