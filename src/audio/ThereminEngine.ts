import { EngineConfig, TimbreId } from '../types';
import { Effects } from './Effects';
import { buildVoice, TIMBRE_SPECS, Voice } from './TimbreManager';

const CHORUS_BY_TIMBRE: Record<TimbreId, number> = {
  classic: 0.22,
  digital: 0.15,
  crystal: 0.7,
  metal: 0.25,
  alien: 0.45,
  choir: 0.85,
  strings: 0.32,
};

/**
 * The audio heart of the instrument. Owns the AudioContext, a shared effect
 * bus, and a single "live" synth voice that crossfades between timbres.
 */
export class ThereminEngine {
  private ctx: AudioContext | null = null;
  private effects: Effects | null = null;

  private voiceBus: GainNode | null = null;
  private master: GainNode | null = null;

  private current: Voice | null = null;
  private currentTimbre: TimbreId = 'classic';

  private frequency = 220;

  /** Estimate of output latency in ms. */
  get latencyMs(): number {
    if (!this.ctx) return 0;
    return Math.round(
      ((this.ctx.baseLatency ?? 0) + (this.ctx.outputLatency ?? 0)) * 1000,
    );
  }

  get ready(): boolean {
    return this.ctx !== null && this.ctx.state === 'running';
  }

  /** Create / resume the context. Must be triggered by a user gesture. */
  async ensureRunning(): Promise<void> {
    if (!this.ctx) {
      const Ctor =
        window.AudioContext ??
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.ctx = new Ctor();
      this.effects = new Effects(this.ctx);
      this.voiceBus = this.ctx.createGain();
      this.voiceBus.gain.value = 0;
      this.effects.connectSource(this.voiceBus);
      this.master = this.ctx.createGain();
      this.master.gain.value = 1;
      this.effects.connect(this.master);
      this.master.connect(this.ctx.destination);
      this.applyFx(this.currentConfig());
      this.switchTimbre('classic', 0);
    }
    if (this.ctx.state !== 'running') {
      await this.ctx.resume();
    }
  }

  private currentConfig(): EngineConfig {
    // read live config from the store without a circular import
    return this.cfgRef();
  }

  /** Injected by App to avoid an import cycle; returns the current EngineConfig. */
  cfgRef: () => EngineConfig = () => ({
    reverb: 0.4,
    delay: 0.2,
    pitchRangeLo: 110,
    pitchRangeHi: 1760,
    pitchCurve: 1,
    pitchSmoothing: 0.25,
    portamento: 0.045,
    volumeCurve: 1.7,
    volumeSmoothing: 0.18,
    vibratoDepth: 5,
    vibratoSpeed: 5.2,
    gestureThreshold: 1.08,
    gestureStability: 6,
    visualIntensity: 1,
    particleDensity: 1,
    lightningIntensity: 1,
  });

  /** Target frequency in Hz. Uses a fast glide (portamento) + smoothing. */
  setFrequency(freq: number): void {
    if (!this.ctx) return;
    this.frequency = freq;
    const cfg = this.currentConfig();
    if (this.current) {
      this.current.setFrequency(freq, cfg.portamento);
    }
  }

  /** Target loudness 0..1 (left hand). */
  setVolume(v: number): void {
    if (!this.ctx || !this.voiceBus) return;
    this.voiceBus.gain.setTargetAtTime(v, this.ctx.currentTime, 0.03);
  }

  /** Crossfade to a timbre. */
  switchTimbre(id: TimbreId, crossfade?: number): void {
    if (!this.ctx || !this.effects) return;
    if (id === this.currentTimbre && this.current) return;
    const spec = TIMBRE_SPECS[id];
    const xf = crossfade ?? spec.crossfade;
    const now = this.ctx.currentTime;

    const next = buildVoice(this.ctx, spec);
    next.setFrequency(this.frequency, 0.01);
    next.setVibrato(
      this.currentConfig().vibratoSpeed,
      this.currentConfig().vibratoDepth,
    );
    next.output.connect(this.voiceBus!);
    next.output.gain.setValueAtTime(0.0001, now);
    next.output.gain.linearRampToValueAtTime(1, now + xf);

    const prev = this.current;
    if (prev) {
      prev.output.gain.cancelScheduledValues(now);
      prev.output.gain.setValueAtTime(prev.output.gain.value, now);
      prev.output.gain.linearRampToValueAtTime(0.0001, now + xf);
      setTimeout(() => prev.dispose(), xf * 1000 + 60);
    }

    this.current = next;
    this.currentTimbre = id;
    if (this.effects) {
      this.effects.setChorus(CHORUS_BY_TIMBRE[id]);
    }
  }

  setVibrato(rate: number, depthCents: number): void {
    this.current?.setVibrato(rate, depthCents);
  }

  applyFx(cfg: EngineConfig): void {
    if (!this.effects) return;
    this.effects.setReverb(cfg.reverb);
    this.effects.setDelay(cfg.delay);
  }

  /** Fade master in/out when hands appear/disappear (avoids clicks + silence). */
  setPresence(on: boolean): void {
    if (!this.ctx || !this.master) return;
    const t = on ? 1 : 0.0001;
    this.master.gain.setTargetAtTime(t, this.ctx.currentTime, 0.06);
  }

  /** Small non-intrusive system sounds (boot pulse, timbre click, swell). */
  playSystemSound(kind: 'boot' | 'timbre' | 'performance'): void {
    if (!this.ctx || !this.effects) return;
    const ctx = this.ctx;
    const t = ctx.currentTime;
    const out = this.master ?? ctx.destination;

    if (kind === 'boot') {
      const o = ctx.createOscillator();
      o.type = 'sine';
      o.frequency.setValueAtTime(220, t);
      o.frequency.exponentialRampToValueAtTime(880, t + 0.18);
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.12, t + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.5);
      o.connect(g).connect(out);
      o.start(t);
      o.stop(t + 0.55);
    } else if (kind === 'timbre') {
      const o = ctx.createOscillator();
      o.type = 'sine';
      o.frequency.setValueAtTime(1400, t);
      o.frequency.exponentialRampToValueAtTime(400, t + 0.09);
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.07, t + 0.005);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.16);
      o.connect(g).connect(out);
      o.start(t);
      o.stop(t + 0.2);
    } else {
      // low space swell
      const o = ctx.createOscillator();
      o.type = 'sine';
      o.frequency.setValueAtTime(55, t);
      o.frequency.exponentialRampToValueAtTime(40, t + 1.2);
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.16, t + 0.5);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 1.4);
      o.connect(g).connect(out);
      o.start(t);
      o.stop(t + 1.5);
    }
  }
}
