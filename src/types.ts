export interface Vec2 {
  x: number;
  y: number;
}

export interface Landmark {
  x: number;
  y: number;
  z: number;
}

export type Handedness = 'Left' | 'Right';

export interface HandFrame {
  handedness: Handedness;
  score: number;
  landmarks: Landmark[];
  palmCenter: Vec2;
  /** 0..1, palm openness (fingers spread / curled) */
  openness: number;
  /** extended-finger boolean vector [thumb, index, middle, ring, pinky] */
  fingers: [boolean, boolean, boolean, boolean, boolean];
  /** count of extended fingers excluding thumb */
  extendedCount: number;
  /** classified gesture for this hand */
  gesture: GestureId;
  /** screen-space position mapped to 3D world (mirrored) */
  world: Vec2;
  /** all 21 landmarks mapped to world space (mirrored), for visuals */
  worldLandmarks: Landmark[];
}

export type GestureId = 'fist' | 'one' | 'peace' | 'three' | 'four' | 'open' | 'ok';

export type TimbreId = 'classic' | 'digital' | 'crystal' | 'metal' | 'alien' | 'choir' | 'strings';

export const TIMBRES: TimbreId[] = [
  'classic',
  'digital',
  'crystal',
  'metal',
  'alien',
  'choir',
  'strings',
];

export const TIMBRE_LABELS: Record<TimbreId, string> = {
  classic: 'Classic Theremin',
  digital: 'Pure Digital',
  crystal: 'Crystal',
  metal: 'Metallic FM',
  alien: 'Alien Voice',
  choir: 'Cosmic Choir',
  strings: 'Warm Strings',
};

export const TIMBRE_CODES: Record<TimbreId, string> = {
  classic: 'TIMBRE 01',
  digital: 'TIMBRE 02',
  crystal: 'TIMBRE 03',
  metal: 'TIMBRE 04',
  alien: 'TIMBRE 05',
  choir: 'TIMBRE 06',
  strings: 'TIMBRE 07',
};

export const GESTURE_LABELS: Record<GestureId, string> = {
  fist: 'FIST',
  one: 'ONE',
  peace: 'PEACE',
  three: 'THREE',
  four: 'FOUR',
  open: 'OPEN',
  ok: 'OK',
};

/** Gesture -> timbre mapping (right hand controls timbre) */
export const GESTURE_TO_TIMBRE: Record<GestureId, TimbreId> = {
  fist: 'classic',
  one: 'digital',
  peace: 'crystal',
  three: 'metal',
  four: 'alien',
  open: 'choir',
  ok: 'strings',
};

export type Phase = 'boot' | 'camera' | 'calibrating' | 'arming' | 'performing';

export interface Calibration {
  minDist: number;
  maxDist: number;
  calibrated: boolean;
}

/** Fast-path mutable state read every frame by audio + visuals. */
export interface LiveState {
  left: HandFrame | null;
  right: HandFrame | null;
  hasLeft: boolean;
  hasRight: boolean;
  bothHands: boolean;

  distanceRaw: number; // normalized image-space euclidean distance
  distanceNorm: number; // 0..1 after calibration (0 = nearest, 1 = farthest)
  opennessLeft: number; // 0..1
  opennessRight: number; // 0..1
  gesture: GestureId;
  timbre: TimbreId;

  pitchNorm: number; // 0..1 (0 = low, 1 = high)
  frequency: number; // Hz
  noteName: string;
  volume: number; // 0..1

  // hand trajectories (world space) for trails
  trailLeft: Vec2[];
  trailRight: Vec2[];
}

export interface EngineConfig {
  // pitch
  pitchRangeLo: number; // Hz
  pitchRangeHi: number; // Hz
  pitchCurve: number; // exponential curve exponent
  pitchSmoothing: number; // 0..1 one-pole coefficient toward target
  portamento: number; // seconds time-constant of glide
  // volume
  volumeCurve: number; // exponent applied to openness
  volumeSmoothing: number;
  // vibrato
  vibratoDepth: number; // Hz (semitones*... simplified)
  vibratoSpeed: number; // Hz
  // gesture
  gestureThreshold: number; // finger-extension threshold
  gestureStability: number; // frames required to confirm
  // audio fx
  reverb: number; // 0..1
  delay: number; // 0..1
  // visual
  visualIntensity: number; // 0..2
  particleDensity: number; // 0..2
  lightningIntensity: number; // 0..2
}

export const DEFAULT_CONFIG: EngineConfig = {
  pitchRangeLo: 110, // A2
  pitchRangeHi: 1760, // A6
  pitchCurve: 1.0,
  pitchSmoothing: 0.25,
  portamento: 0.045,
  volumeCurve: 1.7,
  volumeSmoothing: 0.18,
  vibratoDepth: 5,
  vibratoSpeed: 5.2,
  gestureThreshold: 1.08,
  gestureStability: 6,
  reverb: 0.42,
  delay: 0.24,
  visualIntensity: 1.0,
  particleDensity: 1.0,
  lightningIntensity: 1.0,
};
