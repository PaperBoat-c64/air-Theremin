import { liveState } from '../store/instrumentStore';
import {
  EngineConfig,
  GESTURE_TO_TIMBRE,
  GestureId,
  HandFrame,
  Handedness,
  Landmark,
  Vec2,
} from '../types';
import {
  analyzeHand,
  palmCenter,
} from './GestureDetector';
import {
  distance2d,
  distanceToFrequency,
  freqToNoteName,
  opennessToVolume,
  clamp,
} from '../utils/mapping';
import { Smoother, StabilityBuffer } from '../utils/smoothing';

export interface RawHand {
  handedness: Handedness;
  score: number;
  landmarks: Landmark[];
}

const DEFAULT_MIN = 0.045;
const DEFAULT_MAX = 0.82;

function toWorld(lm: Landmark): Landmark {
  // mirror horizontally, flip Y so "up" is positive, keep z with a mild gain
  return { x: 1 - 2 * lm.x, y: 1 - 2 * lm.y, z: lm.z * 2 };
}

/**
 * Converts raw MediaPipe hands into musical parameters and writes them into
 * `liveState` for the audio + visual loops to consume.
 */
export class HandMapper {
  private freqSmooth = new Smoother();
  private volSmooth = new Smoother();
  private pitchSmooth = new Smoother();
  private gestureStability: StabilityBuffer<GestureId>;
  private pendingGesture: GestureId = 'fist';

  private minDist = DEFAULT_MIN;
  private maxDist = DEFAULT_MAX;

  constructor(gestureStability = 6) {
    this.gestureStability = new StabilityBuffer<GestureId>(gestureStability);
    this.freqSmooth.reset(220);
    this.volSmooth.reset(0);
    this.pitchSmooth.reset(0);
  }

  setCalibration(min: number, max: number): void {
    if (max - min < 0.01) return;
    this.minDist = min;
    this.maxDist = max;
  }

  setGestureStability(frames: number): void {
    this.gestureStability = new StabilityBuffer<GestureId>(Math.max(1, frames));
  }

  update(rawHands: RawHand[], config: EngineConfig, dt: number): void {
    let left: HandFrame | null = null;
    let right: HandFrame | null = null;

    for (const raw of rawHands) {
      const analysis = analyzeHand(raw.landmarks, config);
      const center = palmCenter(raw.landmarks);
      const frame: HandFrame = {
        handedness: raw.handedness,
        score: raw.score,
        landmarks: raw.landmarks,
        palmCenter: center,
        openness: analysis.openness,
        fingers: analysis.fingers.extended,
        extendedCount: analysis.fingers.count,
        gesture: analysis.gesture,
        world: toWorldPalm(center),
        worldLandmarks: raw.landmarks.map(toWorld),
      };
      if (raw.handedness === 'Left') left = frame;
      else right = frame;
    }

    const hasLeft = !!left;
    const hasRight = !!right;
    const bothHands = hasLeft && hasRight;

    // --- distance ---
    let distanceRaw = 0;
    if (bothHands) {
      distanceRaw = distance2d(
        left!.palmCenter.x,
        left!.palmCenter.y,
        right!.palmCenter.x,
        right!.palmCenter.y,
      );
    }
    const distNorm = clamp(
      (distanceRaw - this.minDist) / (this.maxDist - this.minDist),
      0,
      1,
    );

    // --- pitch ---
    const freqTarget = distanceToFrequency(
      distNorm,
      config.pitchRangeLo,
      config.pitchRangeHi,
      config.pitchCurve,
    );
    const pitchTarget = 1 - distNorm;

    const freq =
      bothHands && hasLeft
        ? this.freqSmooth.update(freqTarget, smoothTau(config.pitchSmoothing), dt)
        : this.freqSmooth.current;
    const pitchNorm = this.pitchSmooth.update(
      pitchTarget,
      smoothTau(config.pitchSmoothing),
      dt,
    );

    // --- volume (left hand openness) ---
    const opennessLeft = left ? left.openness : 0;
    const volTarget = left
      ? opennessToVolume(opennessLeft, config.volumeCurve)
      : 0;
    const volume = this.volSmooth.update(volTarget, smoothTau(config.volumeSmoothing), dt);

    // --- gesture -> timbre (right hand, stabilized) ---
    const gesture = right ? right.gesture : 'fist';
    const settled = this.gestureStability.push(gesture);
    const currentGesture: GestureId = settled ?? this.pendingGesture;
    if (settled) this.pendingGesture = settled;
    const timbre = GESTURE_TO_TIMBRE[currentGesture];

    // --- trails ---
    const trailCap = 90; // ~1.5s at 60fps
    pushTrail(liveState.trailLeft, left ? left.world : null, trailCap);
    pushTrail(liveState.trailRight, right ? right.world : null, trailCap);

    // --- write ---
    liveState.left = left;
    liveState.right = right;
    liveState.hasLeft = hasLeft;
    liveState.hasRight = hasRight;
    liveState.bothHands = bothHands;
    liveState.distanceRaw = distanceRaw;
    liveState.distanceNorm = distNorm;
    liveState.opennessLeft = opennessLeft;
    liveState.opennessRight = right ? right.openness : 0;
    liveState.gesture = currentGesture;
    liveState.timbre = timbre;
    liveState.pitchNorm = pitchNorm;
    liveState.frequency = bothHands ? freq : 0;
    liveState.noteName = bothHands ? freqToNoteName(freq) : '—';
    liveState.volume = volume;
  }
}

function toWorldPalm(center: Vec2): Vec2 {
  return { x: 1 - 2 * center.x, y: 1 - 2 * center.y };
}

function smoothTau(c: number): number {
  // c in [0..1]; map to a time constant between ~4ms and ~120ms
  return 0.004 + c * 0.12;
}

function pushTrail(arr: Vec2[], p: Vec2 | null, cap: number): void {
  if (p) {
    arr.push({ x: p.x, y: p.y });
    if (arr.length > cap) arr.splice(0, arr.length - cap);
  } else if (arr.length > 0) {
    arr.shift();
  }
}
