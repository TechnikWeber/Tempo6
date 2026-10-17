// Background music for the start screen, made like a NES would: two pulse voices (the tune and a
// fast chord arpeggio), a stepped triangle for the bass and noise for the drums. No audio files,
// the notes are below and played on the spot.

/** Beats per minute; a step is a sixteenth. */
const BPM = 144;
const STEP = 60 / BPM / 4;
const STEPS_PER_BAR = 16;
/** How far ahead notes are put on the audio clock, so a slow frame (a track loading) leaves no gap. */
const AHEAD = 0.6;

/** A chord: the bass note and the intervals the arpeggio runs through. */
const CHORDS: Record<string, { root: number; tones: number[] }> = {
  C: { root: 48, tones: [0, 4, 7] },
  Dm: { root: 50, tones: [0, 3, 7] },
  F: { root: 53, tones: [0, 4, 7] },
  G: { root: 43, tones: [0, 4, 7] },
  G7: { root: 43, tones: [0, 4, 7, 10] },
  Am: { root: 45, tones: [0, 3, 7] },
};

// The song, one bar per line: the chord and the tune in sixteenths. A note starts with its name,
// '-' holds it, '.' is a rest. Two bars of drums and bass to start, then A and B over and over.
const INTRO: [string, string][] = [
  ['C', ''],
  ['C', ''],
];
const LOOP: [string, string][] = [
  ['C', 'E5 - G5 - C6 - - - G5 - C6 - E6 - - -'],
  ['G', 'D6 - - - B5 - G5 - - - D6 - B5 - G5 -'],
  ['Am', 'A5 - C6 - E6 - - - D6 - C6 - A5 - - -'],
  ['F', 'F5 - A5 - C6 - - - A5 - C6 - D6 - E6 -'],
  ['C', 'E6 - - - D6 - C6 - - - G5 - C6 - E6 -'],
  ['G', 'D6 - - - - - B5 - G5 - - - A5 - B5 -'],
  ['F', 'C6 - A5 - F5 - A5 - C6 - F6 - E6 - D6 -'],
  ['G', 'D6 - - - B5 - - - G5 - - - . . . .'],

  ['Am', 'A5 - . A5 C6 - . C6 E6 - D6 - C6 - B5 -'],
  ['F', 'C6 - - - A5 - - - F5 - G5 - A5 - C6 -'],
  ['C', 'G5 - . G5 C6 - . C6 E6 - G6 - E6 - C6 -'],
  ['G', 'D6 - - - - - - - B5 - - - G5 - - -'],
  ['Am', 'A5 - . A5 C6 - . C6 E6 - D6 - C6 - B5 -'],
  ['F', 'A5 - - - C6 - - - F6 - E6 - D6 - C6 -'],
  ['Dm', 'D6 - - - F6 - - - E6 - D6 - C6 - B5 -'],
  ['G7', 'G5 - B5 - D6 - G5 - B5 - D6 - F6 - D6 -'],
];

/** A note of the tune: where in the bar it starts, which (MIDI number), and for how many steps. */
export interface Note {
  step: number;
  midi: number;
  steps: number;
}

/** "C6" → 84; null for anything that is no note. */
export function midi(name: string): number | null {
  const m = /^([A-G])(#?)(\d)$/.exec(name);
  if (!m) return null;
  return { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 }[m[1]]! + (m[2] ? 1 : 0) + (Number(m[3]) + 1) * 12;
}

/** One bar of the tune as notes; throws on a bar that is not sixteen steps or a note it cannot read. */
export function parseBar(line: string): Note[] {
  if (!line) return [];
  const tokens = line.split(/\s+/);
  if (tokens.length !== STEPS_PER_BAR) throw new Error(`a bar has ${STEPS_PER_BAR} steps, not ${tokens.length}: ${line}`);
  const notes: Note[] = [];
  tokens.forEach((t, step) => {
    if (t === '-') {
      if (notes.length && notes[notes.length - 1].step + notes[notes.length - 1].steps === step) notes[notes.length - 1].steps++;
    } else if (t !== '.') {
      const n = midi(t);
      if (n === null) throw new Error(`no note: ${t}`);
      notes.push({ step, midi: n, steps: 1 });
    }
  });
  return notes;
}

interface Bar {
  chord: { root: number; tones: number[] };
  tune: Note[];
  intro: boolean;
  /** The last bar of a part: the drums roll into the next one. */
  fill: boolean;
}

function bars(list: [string, string][], intro: boolean): Bar[] {
  return list.map(([chord, tune], i) => ({ chord: CHORDS[chord], tune: parseBar(tune), intro, fill: i % 8 === 7 || (intro && i === list.length - 1) }));
}
/** The whole song, checked once when the game loads. */
export const SONG = { intro: bars(INTRO, true), loop: bars(LOOP, false) };

const hz = (m: number) => 440 * 2 ** ((m - 69) / 12);

/** A pulse wave with this much of the period high: 1/8 and 1/4 are the NES's thin and hollow sounds. */
function pulse(ctx: BaseAudioContext, duty: number): PeriodicWave {
  const real = new Float32Array(64), imag = new Float32Array(64);
  for (let k = 1; k < 64; k++) real[k] = (2 / (k * Math.PI)) * Math.sin(k * Math.PI * duty);
  return ctx.createPeriodicWave(real, imag);
}

/** The NES triangle: sixteen steps up and down, which gives the bass its buzz. */
function steppedTriangle(ctx: BaseAudioContext): PeriodicWave {
  const n = 2048, harmonics = 64;
  const real = new Float32Array(harmonics), imag = new Float32Array(harmonics);
  const wave = (i: number) => {
    const level = Math.floor((i / n) * 32);
    return ((level < 16 ? 15 - level : level - 16) / 15) * 2 - 1;
  };
  for (let k = 1; k < harmonics; k++) {
    let re = 0, im = 0;
    for (let i = 0; i < n; i++) {
      const a = (2 * Math.PI * k * i) / n;
      re += wave(i) * Math.cos(a);
      im += wave(i) * Math.sin(a);
    }
    real[k] = (2 * re) / n;
    imag[k] = (2 * im) / n;
  }
  return ctx.createPeriodicWave(real, imag);
}

/** Plays the song while asked to: fades in from the top, fades out when it should stop. */
export class Music {
  private readonly lead: PeriodicWave;
  private readonly thin: PeriodicWave;
  private readonly bass: PeriodicWave;
  /** The gain one run of the song goes through, so a run fading out never mixes into the next. */
  private run: GainNode | null = null;
  /** The next sixteenth to put on the clock, counted from the top, and when it sounds. */
  private step = 0;
  private at = 0;
  /** Which tone of the arpeggio is next; it runs on across notes. */
  private arp = 0;

  constructor(private readonly ctx: BaseAudioContext, private readonly out: AudioNode, private readonly noise: AudioBuffer) {
    this.lead = pulse(ctx, 0.25);
    this.thin = pulse(ctx, 0.125);
    this.bass = steppedTriangle(ctx);
  }

  get playing(): boolean {
    return this.run !== null;
  }

  /** Call often (every frame): starts or stops the song, and keeps the next notes on the clock. */
  update(on: boolean): void {
    const t = this.ctx.currentTime;
    if (on && !this.run) {
      this.run = this.gain(0);
      this.run.gain.setValueAtTime(0, t);
      this.run.gain.setTargetAtTime(1, t, 0.25);
      this.run.connect(this.out);
      this.step = 0;
      this.arp = 0;
      this.at = t + 0.05;
    } else if (!on && this.run) {
      const run = this.run;
      run.gain.cancelScheduledValues(t);
      run.gain.setTargetAtTime(0, t, 0.12);
      setTimeout(() => run.disconnect(), (AHEAD + 1) * 1000);
      this.run = null;
    }
    if (!this.run) return;
    // after a stall (a hidden tab does not get frames) it picks up from now, not from back then
    if (this.at < t) this.at = t + 0.02;
    while (this.at < t + AHEAD) {
      this.play(this.step, this.at, this.run);
      this.step++;
      this.at += STEP;
    }
  }

  /**
   * A gain already at its starting level: left at the default 1 until its envelope begins, a
   * source started between two samples lets one full-strength sample through, a click.
   */
  private gain(level: number): GainNode {
    const g = this.ctx.createGain();
    g.gain.value = level;
    return g;
  }

  /** Put everything that starts on this sixteenth on the clock. */
  private play(n: number, t: number, out: AudioNode): void {
    const intro = SONG.intro.length * STEPS_PER_BAR;
    const bar = n < intro ? SONG.intro[Math.floor(n / STEPS_PER_BAR)] : SONG.loop[Math.floor((n - intro) / STEPS_PER_BAR) % SONG.loop.length];
    const s = n % STEPS_PER_BAR;
    const { root, tones } = bar.chord;

    for (const note of bar.tune) if (note.step === s) this.tone(this.lead, hz(note.midi), t, note.steps * STEP, 0.2, out, note.steps >= 4);

    // the bass bounces between the root and its octave in eighths, the fifth for a turn near the end
    if (s % 2 === 0) {
      const eighth = s / 2;
      const m = bar.intro ? (eighth % 2 ? root + 12 : root) : eighth === 6 ? root + 7 : eighth % 2 ? root + 12 : root;
      this.tone(this.bass, hz(m), t, 2 * STEP, 0.2, out, false, 0.85);
    }
    // the chord as a fast arpeggio, an eighth at a time, all within one octave above middle C
    if (!bar.intro && s % 2 === 0) this.arpeggio(tones.map((i) => 60 + ((root + i) % 12)), t, 2 * STEP, out);

    // drums: kick on one and three, snare on two and four, hats on the eighths; a roll to end a part
    if (bar.intro ? s % 4 === 0 : s === 0 || s === 8 || (s === 10 && !bar.fill)) this.kick(t, out);
    if (!bar.intro && (s === 4 || s === 12)) this.snare(t, out, 1);
    if (bar.fill && s >= 13) this.snare(t, out, 0.6);
    if (s % 2 === 0 && !(bar.fill && s >= 12)) this.hat(t, out, s % 4 === 2 ? 1 : 0.6);
  }

  /** One note of a voice: quick attack, a little decay, cut short of its length to stay crisp. */
  private tone(wave: PeriodicWave, f: number, t: number, len: number, vol: number, out: AudioNode, vibrato = false, gate = 0.9): void {
    const o = this.ctx.createOscillator();
    o.setPeriodicWave(wave);
    o.frequency.value = f;
    const g = this.gain(0);
    const end = t + len * gate;
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(vol, t + 0.004);
    g.gain.setTargetAtTime(vol * 0.7, t + 0.004, 0.08);
    g.gain.setTargetAtTime(0, end, 0.012);
    o.connect(g).connect(out);
    if (vibrato) {
      // long notes wobble a little once they have sounded a moment
      const lfo = this.ctx.createOscillator();
      const depth = this.gain(0);
      lfo.frequency.value = 5.5;
      depth.gain.setValueAtTime(0, t);
      depth.gain.linearRampToValueAtTime(18, t + Math.min(len * 0.6, 0.35));
      lfo.connect(depth).connect(o.detune);
      lfo.start(t);
      lfo.stop(end + 0.1);
    }
    o.start(t);
    o.stop(end + 0.1);
  }

  private arpeggio(notes: number[], t: number, len: number, out: AudioNode): void {
    const o = this.ctx.createOscillator();
    o.setPeriodicWave(this.thin);
    for (let at = 0; at < len; at += 0.04) o.frequency.setValueAtTime(hz(notes[this.arp++ % notes.length]), t + at);
    const g = this.gain(0);
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(0.09, t + 0.003);
    g.gain.setTargetAtTime(0.035, t + 0.003, 0.06);
    g.gain.setTargetAtTime(0, t + len * 0.92, 0.01);
    o.connect(g).connect(out);
    o.start(t);
    o.stop(t + len + 0.05);
  }

  /** Noise through a filter, dying away: the snare and the hats. */
  private hiss(t: number, len: number, vol: number, type: BiquadFilterType, freq: number, out: AudioNode): void {
    const src = this.ctx.createBufferSource();
    src.buffer = this.noise;
    const f = this.ctx.createBiquadFilter();
    f.type = type;
    f.frequency.value = freq;
    const g = this.gain(vol);
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + len);
    src.connect(f).connect(g).connect(out);
    src.start(t, Math.random() * (this.noise.duration - 0.3));
    src.stop(t + len + 0.02);
  }

  private kick(t: number, out: AudioNode): void {
    const o = this.ctx.createOscillator();
    o.type = 'triangle';
    o.frequency.setValueAtTime(170, t);
    o.frequency.exponentialRampToValueAtTime(45, t + 0.09);
    const g = this.gain(0.55);
    g.gain.setValueAtTime(0.55, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.14);
    o.connect(g).connect(out);
    o.start(t);
    o.stop(t + 0.16);
  }

  private snare(t: number, out: AudioNode, vol: number): void {
    this.hiss(t, 0.13, 0.22 * vol, 'highpass', 1400, out);
    const o = this.ctx.createOscillator();
    o.type = 'triangle';
    o.frequency.setValueAtTime(240, t);
    o.frequency.exponentialRampToValueAtTime(120, t + 0.06);
    const g = this.gain(0.14 * vol);
    g.gain.setValueAtTime(0.14 * vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.07);
    o.connect(g).connect(out);
    o.start(t);
    o.stop(t + 0.08);
  }

  private hat(t: number, out: AudioNode, vol: number): void {
    this.hiss(t, 0.035, 0.07 * vol, 'highpass', 7000, out);
  }
}
