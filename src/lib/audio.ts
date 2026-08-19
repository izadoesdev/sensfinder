/**
 * Synthesised range audio — no asset files, no network requests, no licensing.
 *
 * Feedback is not decoration here: a hit confirmation the player can hear rather
 * than look for keeps their eyes on the next target, which is exactly the loop the
 * task is trying to measure. It is kept short and dry so it never masks the timing
 * of the next spawn.
 */
class RangeAudio {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private noise: AudioBuffer | null = null;

  enabled = true;

  /** Must be called from a user gesture — browsers refuse to start audio otherwise. */
  resume(): void {
    if (!this.enabled) return;
    if (!this.ctx) {
      const Ctor =
        window.AudioContext ??
        (window as unknown as { webkitAudioContext?: typeof AudioContext })
          .webkitAudioContext;
      if (!Ctor) return;

      this.ctx = new Ctor();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.25;
      this.master.connect(this.ctx.destination);

      const len = Math.floor(this.ctx.sampleRate * 0.2);
      this.noise = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const data = this.noise.getChannelData(0);
      for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    }
    void this.ctx.resume();
  }

  private burst(opts: {
    freq: number;
    q: number;
    gain: number;
    decay: number;
    type?: BiquadFilterType;
  }): void {
    const ctx = this.ctx;
    if (!ctx || !this.noise || !this.master) return;

    const src = ctx.createBufferSource();
    src.buffer = this.noise;

    const filter = ctx.createBiquadFilter();
    filter.type = opts.type ?? "bandpass";
    filter.frequency.value = opts.freq;
    filter.Q.value = opts.q;

    const env = ctx.createGain();
    const t = ctx.currentTime;
    env.gain.setValueAtTime(opts.gain, t);
    env.gain.exponentialRampToValueAtTime(0.0001, t + opts.decay);

    src.connect(filter).connect(env).connect(this.master);
    src.start(t);
    src.stop(t + opts.decay + 0.02);
  }

  private tone(freq: number, gain: number, decay: number, delay = 0): void {
    const ctx = this.ctx;
    if (!ctx || !this.master) return;

    const osc = ctx.createOscillator();
    osc.type = "sine";
    const env = ctx.createGain();
    const t = ctx.currentTime + delay;

    osc.frequency.setValueAtTime(freq, t);
    env.gain.setValueAtTime(0, t);
    env.gain.linearRampToValueAtTime(gain, t + 0.004);
    env.gain.exponentialRampToValueAtTime(0.0001, t + decay);

    osc.connect(env).connect(this.master);
    osc.start(t);
    osc.stop(t + decay + 0.02);
  }

  shot(): void {
    if (!this.enabled || !this.ctx) return;
    this.burst({ freq: 1800, q: 0.7, gain: 0.5, decay: 0.06 });
    this.tone(90, 0.35, 0.09);
  }

  hit(): void {
    if (!this.enabled || !this.ctx) return;
    this.tone(1180, 0.22, 0.05);
    this.tone(1760, 0.16, 0.06, 0.028);
  }

  miss(): void {
    if (!this.enabled || !this.ctx) return;
    this.burst({ freq: 320, q: 1.2, gain: 0.14, decay: 0.05, type: "lowpass" });
  }

  finish(): void {
    if (!this.enabled || !this.ctx) return;
    [660, 880, 1320].forEach((f, i) => this.tone(f, 0.16, 0.22, i * 0.09));
  }
}

export const rangeAudio = new RangeAudio();
