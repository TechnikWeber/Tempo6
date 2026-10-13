/** Synthesised sounds, no audio files: an electric motor whine and a few blips. */
export class Sound {
  private ctx: AudioContext | null = null;
  private motor: OscillatorNode | null = null;
  private whine: OscillatorNode | null = null;
  private motorGain: GainNode | null = null;
  private master: GainNode | null = null;
  private squealGain: GainNode | null = null;
  private boostGain: GainNode | null = null;
  private boostTone: OscillatorNode | null = null;
  private boostToneGain: GainNode | null = null;
  muted = false;

  /** Browsers only allow audio after a user gesture. */
  unlock(): void {
    if (this.ctx) return;
    const ctx = new AudioContext();
    this.ctx = ctx;
    this.master = ctx.createGain();
    this.master.gain.value = this.muted ? 0 : 0.5;
    this.master.connect(ctx.destination);

    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 1800;
    this.motorGain = ctx.createGain();
    this.motorGain.gain.value = 0;
    filter.connect(this.motorGain).connect(this.master);
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
    noise.connect(band).connect(this.squealGain).connect(this.master);
    // Boost: the same noise as a bright hiss, plus a rising whistle.
    const hiss = ctx.createBiquadFilter();
    hiss.type = 'highpass';
    hiss.frequency.value = 3200;
    this.boostGain = ctx.createGain();
    this.boostGain.gain.value = 0;
    noise.connect(hiss).connect(this.boostGain).connect(this.master);
    this.boostTone = ctx.createOscillator();
    this.boostTone.type = 'triangle';
    this.boostToneGain = ctx.createGain();
    this.boostToneGain.gain.value = 0;
    this.boostTone.connect(this.boostToneGain).connect(this.master);
    this.boostTone.start();
    noise.start();
  }

  toggleMute(): void {
    this.muted = !this.muted;
    if (this.master) this.master.gain.value = this.muted ? 0 : 0.5;
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

  /** The capacitor lets go. */
  zap(): void {
    this.blip([2400, 1500, 900, 1900], 0.035, 'sawtooth', 0.1);
  }

  private blip(freqs: number[], step: number, type: OscillatorType = 'triangle', vol = 0.25): void {
    if (!this.ctx || !this.master) return;
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
      o.connect(g).connect(this.master!);
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
    if (!this.ctx || !this.master) return;
    const t = this.ctx.currentTime;
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = 'sine';
    o.frequency.setValueAtTime(110, t);
    o.frequency.exponentialRampToValueAtTime(38, t + 0.18);
    g.gain.setValueAtTime(Math.min(0.6, 0.15 + sinkRate * 0.05), t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.25);
    o.connect(g).connect(this.master);
    o.start(t);
    o.stop(t + 0.3);
  }

  nope(): void {
    this.blip([180, 140], 0.12, 'sawtooth', 0.18);
  }
}
