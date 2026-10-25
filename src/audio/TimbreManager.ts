import { TimbreId } from '../types';

interface LayerSpec {
  type: OscillatorType;
  ratio: number;
  gain: number;
  detune?: number; // cents
}

interface TimbreSpec {
  id: TimbreId;
  layers: LayerSpec[];
  fm?: { carrier: number; ratio: number; index: number };
  ring?: { a: number; b: number; level: number };
  filter?: { type: BiquadFilterType; freq: number; q: number };
  distortion?: number; // 0..1 drive
  vibrato?: { rate: number; depth: number }; // depth in cents
  crossfade: number; // seconds
}

export const TIMBRE_SPECS: Record<TimbreId, TimbreSpec> = {
  classic: {
    id: 'classic',
    layers: [
      { type: 'sine', ratio: 1.0, gain: 0.55 },
      { type: 'triangle', ratio: 1.0, gain: 0.22, detune: 5 },
      { type: 'sine', ratio: 0.5, gain: 0.14 },
      { type: 'sine', ratio: 2.0, gain: 0.05 },
    ],
    filter: { type: 'lowpass', freq: 3400, q: 0.6 },
    vibrato: { rate: 5.2, depth: 6 },
    crossfade: 0.18,
  },
  digital: {
    id: 'digital',
    layers: [
      { type: 'sine', ratio: 1.0, gain: 0.6 },
      { type: 'sine', ratio: 0.5, gain: 0.26 },
      { type: 'sine', ratio: 2.0, gain: 0.05 },
    ],
    filter: { type: 'lowpass', freq: 6200, q: 0.5 },
    distortion: 0.12,
    vibrato: { rate: 4.4, depth: 2 },
    crossfade: 0.12,
  },
  crystal: {
    id: 'crystal',
    layers: [
      { type: 'sine', ratio: 1.0, gain: 0.4 },
      { type: 'sine', ratio: 1.0, gain: 0.12, detune: 8 },
    ],
    fm: { carrier: 0, ratio: 3.4, index: 2.1 },
    filter: { type: 'highpass', freq: 900, q: 0.6 },
    vibrato: { rate: 6.4, depth: 4 },
    crossfade: 0.16,
  },
  metal: {
    id: 'metal',
    layers: [
      { type: 'triangle', ratio: 1.0, gain: 0.3 },
      { type: 'sawtooth', ratio: 1.0, gain: 0.1, detune: -3 },
    ],
    fm: { carrier: 0, ratio: 1.99, index: 2.6 },
    ring: { a: 0, b: 1, level: 0.28 },
    filter: { type: 'bandpass', freq: 1900, q: 2.6 },
    distortion: 0.5,
    vibrato: { rate: 5.0, depth: 3 },
    crossfade: 0.1,
  },
  alien: {
    id: 'alien',
    layers: [
      { type: 'sawtooth', ratio: 1.0, gain: 0.26 },
      { type: 'sine', ratio: 0.5, gain: 0.16 },
    ],
    fm: { carrier: 0, ratio: 0.52, index: 1.5 },
    filter: { type: 'bandpass', freq: 1100, q: 1.6 },
    distortion: 0.34,
    vibrato: { rate: 7.2, depth: 7 },
    crossfade: 0.14,
  },
  choir: {
    id: 'choir',
    layers: [
      { type: 'sine', ratio: 1.0, gain: 0.3 },
      { type: 'sine', ratio: 1.0, gain: 0.16, detune: -7 },
      { type: 'sine', ratio: 1.25, gain: 0.18 },
      { type: 'sine', ratio: 1.5, gain: 0.16 },
      { type: 'sine', ratio: 2.0, gain: 0.1 },
    ],
    filter: { type: 'lowpass', freq: 2600, q: 0.5 },
    vibrato: { rate: 0.9, depth: 9 },
    crossfade: 0.5,
  },
  strings: {
    id: 'strings',
    layers: [
      { type: 'sawtooth', ratio: 1.0, gain: 0.26 },
      { type: 'sawtooth', ratio: 1.0, gain: 0.18, detune: 7 },
      { type: 'triangle', ratio: 0.5, gain: 0.15 },
      { type: 'sine', ratio: 1.0, gain: 0.12, detune: -6 },
    ],
    filter: { type: 'lowpass', freq: 1500, q: 1.1 },
    vibrato: { rate: 5.6, depth: 9 },
    crossfade: 0.32,
  },
};

export interface Voice {
  readonly output: GainNode;
  setFrequency(freq: number, tc: number): void;
  setVibrato(rate: number, depthCents: number): void;
  dispose(): void;
}

export function buildVoice(ctx: AudioContext, spec: TimbreSpec): Voice {
  const output = ctx.createGain();
  output.gain.value = 0;

  const sum = ctx.createGain();
  sum.gain.value = 1;

  const layers = spec.layers.map((l) => {
    const osc = ctx.createOscillator();
    osc.type = l.type;
    osc.frequency.value = 110 * l.ratio;
    if (l.detune) osc.detune.value = l.detune;
    const g = ctx.createGain();
    g.gain.value = l.gain;
    osc.connect(g).connect(sum);
    osc.start();
    return { osc, gain: g, ratio: l.ratio };
  });

  // FM modulator
  let fmMod: OscillatorNode | null = null;
  let fmGain: GainNode | null = null;
  if (spec.fm) {
    fmMod = ctx.createOscillator();
    fmMod.type = 'sine';
    fmMod.frequency.value = 110 * spec.fm.ratio;
    fmGain = ctx.createGain();
    fmGain.gain.value = spec.fm.index * 110 * spec.fm.ratio;
    fmMod.connect(fmGain).connect(layers[spec.fm.carrier].osc.frequency);
    fmMod.start();
  }

  // Ring modulator
  if (spec.ring) {
    const ring = ctx.createGain();
    const ringLevel = ctx.createGain();
    ringLevel.gain.value = spec.ring.level;
    layers[spec.ring.b].osc.connect(ring.gain);
    layers[spec.ring.a].osc.connect(ring);
    ring.connect(ringLevel).connect(sum);
  }

  // Vibrato LFO applied to every layer's detune (cents)
  const vibLfo = ctx.createOscillator();
  vibLfo.type = 'sine';
  vibLfo.frequency.value = spec.vibrato?.rate ?? 5;
  const vibGain = ctx.createGain();
  vibGain.gain.value = spec.vibrato?.depth ?? 0;
  layers.forEach((l) => vibLfo.connect(vibGain).connect(l.osc.detune));
  vibLfo.start();

  // Filter + distortion chain
  let tail: AudioNode = sum;
  if (spec.filter) {
    const f = ctx.createBiquadFilter();
    f.type = spec.filter.type;
    f.frequency.value = spec.filter.freq;
    f.Q.value = spec.filter.q;
    tail.connect(f);
    tail = f;
  }
  if (spec.distortion && spec.distortion > 0) {
    const shaper = ctx.createWaveShaper();
    shaper.curve = makeDriveCurve(spec.distortion);
    shaper.oversample = '2x';
    tail.connect(shaper);
    tail = shaper;
  }
  tail.connect(output);

  const allOsc = [...layers.map((l) => l.osc), vibLfo, ...(fmMod ? [fmMod] : [])];

  return {
    output,
    setFrequency(freq: number, tc: number) {
      const t = ctx.currentTime;
      for (const l of layers) {
        l.osc.frequency.setTargetAtTime(freq * l.ratio, t, tc);
      }
      if (fmMod && fmGain && spec.fm) {
        fmMod.frequency.setTargetAtTime(freq * spec.fm.ratio, t, tc);
        fmGain.gain.setTargetAtTime(spec.fm.index * freq * spec.fm.ratio, t, tc);
      }
    },
    setVibrato(rate: number, depthCents: number) {
      const t = ctx.currentTime;
      vibLfo.frequency.setTargetAtTime(rate, t, 0.1);
      vibGain.gain.setTargetAtTime(depthCents, t, 0.1);
    },
    dispose() {
      const t = ctx.currentTime;
      for (const osc of allOsc) {
        try {
          osc.stop(t + 0.08);
        } catch {
          /* already stopped */
        }
      }
      // disconnect shortly after to let the release tail ring out
      setTimeout(() => {
        try {
          output.disconnect();
          sum.disconnect();
        } catch {
          /* noop */
        }
      }, 120);
    },
  };
}

function makeDriveCurve(drive: number): Float32Array<ArrayBuffer> {
  const n = 512;
  const curve = new Float32Array(n) as Float32Array<ArrayBuffer>;
  const k = drive * 8 + 0.5;
  for (let i = 0; i < n; i++) {
    const x = (i / (n - 1)) * 2 - 1;
    curve[i] = Math.tanh(k * x) / Math.tanh(k);
  }
  return curve;
}
