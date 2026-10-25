import { create } from 'zustand';
import {
  DEFAULT_CONFIG,
  EngineConfig,
  GestureId,
  LiveState,
  Phase,
  TimbreId,
} from '../types';

/** Mutable fast-path state, written by the vision loop, read by audio + visuals every frame. */
export const liveState: LiveState = {
  left: null,
  right: null,
  hasLeft: false,
  hasRight: false,
  bothHands: false,

  distanceRaw: 0,
  distanceNorm: 1,
  opennessLeft: 0,
  opennessRight: 0,
  gesture: 'fist',
  timbre: 'classic',

  pitchNorm: 0,
  frequency: 0,
  noteName: '—',
  volume: 0,

  trailLeft: [],
  trailRight: [],
};

export interface UiSnapshot {
  phase: Phase;
  engineOnline: boolean;
  audioReady: boolean;
  cameraActive: boolean;

  noteName: string;
  frequency: number;
  volume: number;
  gesture: GestureId;
  timbre: TimbreId;

  hasLeft: boolean;
  hasRight: boolean;
  bothHands: boolean;

  performanceMode: boolean;
  debugMode: boolean;
  settingsOpen: boolean;

  fps: number;
  handConfidence: number;
  latencyMs: number;
  handCount: number;
  distanceRaw: number;
  armProgress: number;

  calibrationMin: number;
  calibrationMax: number;
  calibrated: boolean;

  config: EngineConfig;
}

interface InstrumentStore extends UiSnapshot {
  setPhase: (p: Phase) => void;
  setConfig: (patch: Partial<EngineConfig>) => void;
  togglePerformance: () => void;
  toggleDebug: () => void;
  toggleSettings: () => void;
  setSettingsOpen: (open: boolean) => void;
  setCalibration: (min: number, max: number, calibrated: boolean) => void;
  sync: (patch: Partial<UiSnapshot>) => void;
}

export const useInstrumentStore = create<InstrumentStore>((set) => ({
  phase: 'boot',
  engineOnline: false,
  audioReady: false,
  cameraActive: false,

  noteName: '—',
  frequency: 0,
  volume: 0,
  gesture: 'fist',
  timbre: 'classic',

  hasLeft: false,
  hasRight: false,
  bothHands: false,

  performanceMode: false,
  debugMode: false,
  settingsOpen: false,

  fps: 0,
  handConfidence: 0,
  latencyMs: 0,
  handCount: 0,
  distanceRaw: 0,
  armProgress: 0,

  calibrationMin: 0,
  calibrationMax: 0,
  calibrated: false,

  config: { ...DEFAULT_CONFIG },

  setPhase: (phase) => set({ phase }),
  setConfig: (patch) => set((s) => ({ config: { ...s.config, ...patch } })),
  togglePerformance: () => set((s) => ({ performanceMode: !s.performanceMode })),
  toggleDebug: () => set((s) => ({ debugMode: !s.debugMode })),
  toggleSettings: () => set((s) => ({ settingsOpen: !s.settingsOpen })),
  setSettingsOpen: (open) => set({ settingsOpen: open }),
  setCalibration: (min, max, calibrated) =>
    set({ calibrationMin: min, calibrationMax: max, calibrated }),
  sync: (patch) => set(patch),
}));
