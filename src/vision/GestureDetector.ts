import { EngineConfig, GestureId, Landmark } from '../types';

/** MediaPipe hand landmark indices. */
export const LM = {
  WRIST: 0,
  THUMB_CMC: 1,
  THUMB_MCP: 2,
  THUMB_IP: 3,
  THUMB_TIP: 4,
  INDEX_MCP: 5,
  INDEX_PIP: 6,
  INDEX_DIP: 7,
  INDEX_TIP: 8,
  MIDDLE_MCP: 9,
  MIDDLE_PIP: 10,
  MIDDLE_DIP: 11,
  MIDDLE_TIP: 12,
  RING_MCP: 13,
  RING_PIP: 14,
  RING_DIP: 15,
  RING_TIP: 16,
  PINKY_MCP: 17,
  PINKY_PIP: 18,
  PINKY_DIP: 19,
  PINKY_TIP: 20,
} as const;

function d(a: Landmark, b: Landmark): number {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return Math.sqrt(dx * dx + dy * dy);
}

export interface FingerInfo {
  extended: [boolean, boolean, boolean, boolean, boolean];
  ratios: [number, number, number, number, number];
  count: number; // non-thumb fingers extended
  thumbIndexDist: number; // normalized distance thumb-tip -> index-tip
}

/**
 * Finger extension: tip-to-wrist distance relative to the finger's knuckle
 * (PIP for digits, IP for thumb). An extended finger stretches past its knuckle.
 */
export function analyzeFingers(lm: Landmark[], threshold: number): FingerInfo {
  const wrist = lm[LM.WRIST];

  const ratios: FingerInfo['ratios'] = [
    d(lm[LM.THUMB_TIP], wrist) / Math.max(d(lm[LM.THUMB_IP], wrist), 1e-4),
    d(lm[LM.INDEX_TIP], wrist) / Math.max(d(lm[LM.INDEX_PIP], wrist), 1e-4),
    d(lm[LM.MIDDLE_TIP], wrist) / Math.max(d(lm[LM.MIDDLE_PIP], wrist), 1e-4),
    d(lm[LM.RING_TIP], wrist) / Math.max(d(lm[LM.RING_PIP], wrist), 1e-4),
    d(lm[LM.PINKY_TIP], wrist) / Math.max(d(lm[LM.PINKY_PIP], wrist), 1e-4),
  ];

  const extended = ratios.map((r) => r > threshold) as FingerInfo['extended'];
  const count = [extended[1], extended[2], extended[3], extended[4]].filter(Boolean).length;
  const thumbIndexDist = d(lm[LM.THUMB_TIP], lm[LM.INDEX_TIP]);

  return { extended, ratios, count, thumbIndexDist };
}

/** 0..1 palm openness from the average extension ratio of all five digits. */
export function computeOpenness(ratios: FingerInfo['ratios']): number {
  const avg =
    (ratios[0] + ratios[1] + ratios[2] + ratios[3] + ratios[4]) / 5;
  // ~1.0 = neutral/curled, ~1.6+ = fully spread
  const t = (avg - 1.0) / 0.6;
  return t < 0 ? 0 : t > 1 ? 1 : t;
}

const OK_DIST = 0.07;

export function classifyGesture(fingers: FingerInfo): GestureId {
  const { extended, count, thumbIndexDist } = fingers;
  const thumb = extended[0];

  // 👌 OK sign: thumb tip touches index tip, the other three digits stay up.
  if (thumbIndexDist < OK_DIST && extended[2] && extended[3] && extended[4]) {
    return 'ok';
  }
  if (count === 4 && thumb) return 'open';
  if (count === 4) return 'four';
  if (count === 3) return 'three';
  if (count === 2) return 'peace';
  if (count === 1) return 'one';
  return 'fist';
}

/** Palm center: mean of wrist + the five MCP knuckles. */
export function palmCenter(lm: Landmark[]): { x: number; y: number } {
  const pts = [
    lm[LM.WRIST],
    lm[LM.THUMB_MCP],
    lm[LM.INDEX_MCP],
    lm[LM.MIDDLE_MCP],
    lm[LM.RING_MCP],
    lm[LM.PINKY_MCP],
  ];
  let x = 0;
  let y = 0;
  for (const p of pts) {
    x += p.x;
    y += p.y;
  }
  return { x: x / pts.length, y: y / pts.length };
}

export function analyzeHand(
  lm: Landmark[],
  config: EngineConfig,
): { fingers: FingerInfo; openness: number; gesture: GestureId } {
  const fingers = analyzeFingers(lm, config.gestureThreshold);
  const openness = computeOpenness(fingers.ratios);
  const gesture = classifyGesture(fingers);
  return { fingers, openness, gesture };
}
