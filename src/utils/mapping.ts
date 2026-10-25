export function clamp(v: number, a: number, b: number): number {
  return v < a ? a : v > b ? b : v;
}

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

export function smoothstep(a: number, b: number, x: number): number {
  const t = clamp((x - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
}

/** Musical frequency -> MIDI note number. */
export function freqToMidi(freq: number): number {
  return 69 + 12 * Math.log2(Math.max(freq, 1) / 440);
}

/** MIDI note number -> frequency in Hz. */
export function midiToFreq(midi: number): number {
  return 440 * Math.pow(2, (midi - 69) / 12);
}

const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

export function midiToNoteName(midi: number): string {
  const n = Math.round(midi);
  const name = NOTE_NAMES[((n % 12) + 12) % 12];
  const octave = Math.floor(n / 12) - 1;
  return `${name}${octave}`;
}

export function freqToNoteName(freq: number): string {
  return midiToNoteName(freqToMidi(freq));
}

/**
 * Map a normalized distance (0 = nearest, 1 = farthest) to a frequency.
 * Larger distance -> lower pitch, so we invert: pitch = 1 - dist.
 * Exponential mapping keeps the response musical (equal octaves per screen distance).
 */
export function distanceToFrequency(
  distNorm: number,
  loHz: number,
  hiHz: number,
  curve: number,
): number {
  const t = clamp(1 - distNorm, 0, 1); // 0 near -> 1, 1 far -> 0
  const shaped = Math.pow(t, curve);
  return loHz * Math.pow(hiHz / loHz, shaped);
}

/** Convert 0..1 openness to 0..1 volume via an exponential response curve. */
export function opennessToVolume(openness: number, curve: number): number {
  const t = clamp(openness, 0, 1);
  const v = Math.pow(t, curve);
  // keep a whisper of presence when the hand is not fully closed
  return v;
}

export function distance2d(ax: number, ay: number, bx: number, by: number): number {
  const dx = ax - bx;
  const dy = ay - by;
  return Math.sqrt(dx * dx + dy * dy);
}
