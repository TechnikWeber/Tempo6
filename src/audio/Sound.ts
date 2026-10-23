import { Music } from './Music';

/** How loud the start screen's tune is against everything else, with its slider all the way up. */
const MUSIC_MAX = 0.44;
/** How loud all of it is at full volume (the master slider at 100 %). */
const MASTER_MAX = 0.5;
/** How loud the sounds are with their slider all the way up; at half they are as loud as they used to be. */
const FX_MAX = 2;

/** Synthesised sounds, no audio files: an electric motor whine and a few blips. */
export class Sound {
  private ctx: AudioContext | null = null;
  private motor: OscillatorNode | null = null;
  private whine: OscillatorNode | null = null;
  private motorGain: GainNode | null = null;
  private master: GainNode | null = null;
  /** Everything but the music (motors, knocks, blips) goes through here, for its own slider. */
  private fx: GainNode | null = null;
  private squealGain: GainNode | null = null;
  private boostGain: GainNode | null = null;
  private boostTone: OscillatorNode | null = null;
  private boostToneGain: GainNode | null = null;
  /** A passing train: a low rumble through the same noise. */
  private rumbleGain: GainNode | null = null;
  /** A propeller's blades going by. */
  private whooshGain: GainNode | null = null;
  private noiseBuffer: AudioBuffer | null = null;
  /** The start screen's chiptune. */
  private music: Music | null = null;
  private musicGain: GainNode | null = null;
  /** The slider's setting, 0…1. */
  private musicVolume = 0.25;
  /** The master slider's setting, 0…1. */
  private masterVolume = 1;
  /** The sounds slider's setting, 0…1. */
  private fxVolume = 0.15;
  muted = false;

  /**
   * Browsers only allow audio after a user gesture. A controller does not count as one, so a
   * start from the controller leaves it waiting: the next key or click wakes it up.
   */
  unlock(): void {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') void this.ctx.resume().catch(() => {});
      return;
    }
    const ctx = new AudioContext();
    this.ctx = ctx;
    this.master = ctx.createGain();
    this.master.gain.value = this.masterLevel;
    this.master.connect(ctx.destination);
    this.fx = ctx.createGain();
    this.fx.gain.value = this.fxVolume * FX_MAX;
    this.fx.connect(this.master);

    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 1800;
    this.motorGain = ctx.createGain();
    this.motorGain.gain.value = 0;
    filter.connect(this.motorGain).connect(this.fx);
    this.motor = ctx.createOscillator();
    this.motor.type = 'sawtooth';
    this.whine = ctx.createOscillator();
    this.whine.type = 'square';
    this.motor.connect(filter);
    this.whine.connect(filter);
    this.motor.start();
    this.whine.start();

    // Tyre squeal: looping noise through a narrow band.
    const len = ctx.sampleRate;
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    const noise = ctx.createBufferSource();
    noise.buffer = buf;
    noise.loop = true;
    const band = ctx.createBiquadFilter();
    band.type = 'bandpass';
    band.frequency.value = 1500;
    band.Q.value = 6;
    this.squealGain = ctx.createGain();
    this.squealGain.gain.value = 0;
    noise.connect(band).connect(this.squealGain).connect(this.fx);
    // Boost: the same noise as a bright hiss, plus a rising whistle.
    const hiss = ctx.createBiquadFilter();
    hiss.type = 'highpass';
    hiss.frequency.value = 3200;
    this.boostGain = ctx.createGain();
    this.boostGain.gain.value = 0;
    noise.connect(hiss).connect(this.boostGain).connect(this.fx);
    this.boostTone = ctx.createOscillator();
    this.boostTone.type = 'triangle';
    this.boostToneGain = ctx.createGain();
    this.boostToneGain.gain.value = 0;
    this.boostTone.connect(this.boostToneGain).connect(this.fx);
    this.boostTone.start();
    const rumble = ctx.createBiquadFilter();
    rumble.type = 'lowpass';
    rumble.frequency.value = 180;
    this.rumbleGain = ctx.createGain();
    this.rumbleGain.gain.value = 0;
    noise.connect(rumble).connect(this.rumbleGain).connect(this.fx);
    const whoosh = ctx.createBiquadFilter();
    whoosh.type = 'bandpass';
    whoosh.frequency.value = 520;
    whoosh.Q.value = 1.2;
    this.whooshGain = ctx.createGain();
    this.whooshGain.gain.value = 0;
    noise.connect(whoosh).connect(this.whooshGain).connect(this.fx);
    this.noiseBuffer = buf;
    noise.start();
    const music = ctx.createGain();
    music.gain.value = this.musicVolume * MUSIC_MAX;
    music.connect(this.master);
    this.musicGain = music;
    this.music = new Music(ctx, music, buf);
  }

  /** The start screen's tune: plays while `on` at `volume` (0…1, 0 is off), fades out otherwise. Call every frame. */
  setMusic(on: boolean, volume: number): void {
    if (volume !== this.musicVolume) {
      this.musicVolume = volume;
      if (this.ctx && this.musicGain) this.musicGain.gain.setTargetAtTime(volume * MUSIC_MAX, this.ctx.currentTime, 0.05);
    }
    this.music?.update(on && volume > 0);
  }

  /** @param level 0…1 how close the train is */
  setTrain(level: number): void {
    if (!this.ctx || !this.rumbleGain) return;
    this.rumbleGain.gain.setTargetAtTime(level * level * 0.9, this.ctx.currentTime, 0.15);
  }

  /** @param level 0…1 how loud the propeller is right now, blade by blade */
  setWhoosh(level: number): void {
    if (!this.ctx || !this.whooshGain) return;
    this.whooshGain.gain.setTargetAtTime(level * 0.35, this.ctx.currentTime, 0.015);
  }

  /** The train's two-tone horn. */
  trainHorn(): void {
    if (!this.ctx || !this.fx) return;
    const t = this.ctx.currentTime;
    for (const [f, start, len] of [[311, 0, 0.7], [370, 0, 0.7], [311, 0.85, 1.1], [370, 0.85, 1.1]]) {
      const o = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      o.type = 'sawtooth';
      o.frequency.value = f;
      g.gain.setValueAtTime(0, t + start);
      g.gain.linearRampToValueAtTime(0.07, t + start + 0.05);
      g.gain.setValueAtTime(0.07, t + start + len - 0.1);
      g.gain.linearRampToValueAtTime(0, t + start + len);
      o.connect(g).connect(this.fx);
      o.start(t + start);
      o.stop(t + start + len + 0.05);
    }
  }

  /** A crowd cheering: noise in a voice band, swelling and dying away, with a few whistles. */
  cheer(): void {
    if (!this.ctx || !this.fx || !this.noiseBuffer) return;
    const t = this.ctx.currentTime;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    src.loop = true;
    const band = this.ctx.createBiquadFilter();
    band.type = 'bandpass';
    band.frequency.value = 900;
    band.Q.value = 0.8;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(0.32, t + 0.25);
    g.gain.exponentialRampToValueAtTime(0.001, t + 2.4);
    src.connect(band).connect(g).connect(this.fx);
    src.start(t);
    src.stop(t + 2.5);
    this.blip([1900, 2300, 1900, 2500], 0.11, 'sine', 0.06);
  }

  toggleMute(): void {
    this.muted = !this.muted;
    if (this.master) this.master.gain.value = this.masterLevel;
  }

  private get masterLevel(): number {
    return this.muted ? 0 : this.masterVolume * MASTER_MAX;
  }

  /** The sliders in the settings, each 0…1: everything, and the sounds without the music. Call every frame. */
  setVolumes(master: number, fx: number): void {
    if (master === this.masterVolume && fx === this.fxVolume) return;
    this.masterVolume = master;
    this.fxVolume = fx;
    if (!this.ctx || !this.master || !this.fx) return;
    const t = this.ctx.currentTime;
    this.master.gain.setTargetAtTime(this.masterLevel, t, 0.05);
    this.fx.gain.setTargetAtTime(fx * FX_MAX, t, 0.05);
  }

  /** Still silent because the browser has not let it start yet. */
  get waiting(): boolean {
    return this.ctx?.state !== 'running';
  }

  /** @param speed m/s, @param load 0…1 how hard the motor is working */
  setMotor(speed: number, load: number): void {
    if (!this.ctx || !this.motor || !this.whine || !this.motorGain) return;
    const t = this.ctx.currentTime;
    const s = Math.abs(speed);
    this.motor.frequency.setTargetAtTime(55 + s * 38, t, 0.05);
    this.whine.frequency.setTargetAtTime(220 + s * 150, t, 0.05);
    const vol = s < 0.05 && load < 0.05 ? 0 : 0.035 + 0.05 * load + Math.min(0.04, s * 0.004);
    this.motorGain.gain.setTargetAtTime(vol, t, 0.08);
  }

  /** @param amount 0…1 how hard the tyres are scrubbing */
  setSqueal(amount: number): void {
    if (!this.ctx || !this.squealGain) return;
    this.squealGain.gain.setTargetAtTime(0.22 * amount, this.ctx.currentTime, 0.06);
  }

  /** @param level 0…1 how hard the boost is pushing */
  setBoost(level: number): void {
    if (!this.ctx || !this.boostGain || !this.boostTone || !this.boostToneGain) return;
    const t = this.ctx.currentTime;
    // crackle: the hiss stutters like arcing
    this.boostGain.gain.setTargetAtTime(level * (0.05 + Math.random() * 0.09), t, 0.02);
    this.boostTone.frequency.setTargetAtTime(500 + level * 1300, t, 0.08);
    this.boostToneGain.gain.setTargetAtTime(level * 0.035, t, 0.08);
  }

  /** A car that had to brake for a wheelchair. */
  honk(): void {
    this.blip([392, 392], 0.22, 'square', 0.12);
    this.blip([494, 494], 0.22, 'square', 0.1);
  }

  /** A beep per start light, and a higher, longer one for go. */
  count(go: boolean): void {
    this.blip(go ? [1320, 1320, 1320] : [660], go ? 0.14 : 0.12, 'square', 0.14);
  }

  /** The battery pack lets go. */
  zap(): void {
    this.blip([2400, 1500, 900, 1900], 0.035, 'sawtooth', 0.1);
  }

  private blip(freqs: number[], step: number, type: OscillatorType = 'triangle', vol = 0.25): void {
    if (!this.ctx || !this.fx) return;
    const t0 = this.ctx.currentTime;
    freqs.forEach((f, i) => {
      const o = this.ctx!.createOscillator();
      const g = this.ctx!.createGain();
      o.type = type;
      o.frequency.value = f;
      const t = t0 + i * step;
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(vol, t + 0.01);
      g.gain.exponentialRampToValueAtTime(0.001, t + step * 1.8);
      o.connect(g).connect(this.fx!);
      o.start(t);
      o.stop(t + step * 2);
    });
  }

  bottle(): void {
    this.blip([1320, 1760], 0.06);
  }

  crate(): void {
    this.blip([880, 1320, 1760, 2640], 0.07);
  }

  tuned(): void {
    this.blip([392, 523, 659, 784, 1047], 0.09, 'square', 0.18);
  }

  lap(): void {
    this.blip([659, 784, 1047], 0.12);
  }

  /** Landing: a short low thump, louder the harder it comes down. */
  thud(sinkRate: number): void {
    if (!this.ctx || !this.fx) return;
    const t = this.ctx.currentTime;
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = 'sine';
    o.frequency.setValueAtTime(110, t);
    o.frequency.exponentialRampToValueAtTime(38, t + 0.18);
    g.gain.setValueAtTime(Math.min(0.6, 0.15 + sinkRate * 0.05), t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.25);
    o.connect(g).connect(this.fx);
    o.start(t);
    o.stop(t + 0.3);
  }

  nope(): void {
    this.blip([180, 140], 0.12, 'sawtooth', 0.18);
  }
}
