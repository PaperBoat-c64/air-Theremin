import { useInstrumentStore } from '../store/instrumentStore';
import { DEFAULT_CONFIG, EngineConfig } from '../types';

interface SliderSpec {
  key: keyof EngineConfig;
  label: string;
  min: number;
  max: number;
  step: number;
  fmt: (v: number) => string;
}

const AUDIO: SliderSpec[] = [
  { key: 'pitchRangeLo', label: 'Pitch Range (Low)', min: 30, max: 440, step: 1, fmt: (v) => `${v.toFixed(0)} Hz` },
  { key: 'pitchRangeHi', label: 'Pitch Range (High)', min: 440, max: 4000, step: 1, fmt: (v) => `${v.toFixed(0)} Hz` },
  { key: 'pitchCurve', label: 'Pitch Curve', min: 0.2, max: 3, step: 0.05, fmt: (v) => v.toFixed(2) },
  { key: 'pitchSmoothing', label: 'Pitch Smoothing', min: 0, max: 1, step: 0.01, fmt: (v) => v.toFixed(2) },
  { key: 'portamento', label: 'Portamento', min: 0.01, max: 0.3, step: 0.005, fmt: (v) => `${(v * 1000).toFixed(0)} ms` },
  { key: 'volumeCurve', label: 'Volume Curve', min: 0.5, max: 4, step: 0.05, fmt: (v) => v.toFixed(2) },
  { key: 'volumeSmoothing', label: 'Volume Smoothing', min: 0, max: 1, step: 0.01, fmt: (v) => v.toFixed(2) },
  { key: 'vibratoDepth', label: 'Vibrato Depth', min: 0, max: 30, step: 0.5, fmt: (v) => `${v.toFixed(1)} ct` },
  { key: 'vibratoSpeed', label: 'Vibrato Speed', min: 0, max: 12, step: 0.1, fmt: (v) => `${v.toFixed(1)} Hz` },
  { key: 'reverb', label: 'Reverb', min: 0, max: 1, step: 0.01, fmt: (v) => v.toFixed(2) },
  { key: 'delay', label: 'Delay', min: 0, max: 1, step: 0.01, fmt: (v) => v.toFixed(2) },
];

const GESTURE: SliderSpec[] = [
  { key: 'gestureThreshold', label: 'Gesture Threshold', min: 0.8, max: 1.5, step: 0.01, fmt: (v) => v.toFixed(2) },
  { key: 'gestureStability', label: 'Gesture Stability', min: 1, max: 20, step: 1, fmt: (v) => `${v.toFixed(0)} fr` },
];

const VISUAL: SliderSpec[] = [
  { key: 'visualIntensity', label: 'Visual Intensity', min: 0, max: 2, step: 0.05, fmt: (v) => v.toFixed(2) },
  { key: 'particleDensity', label: 'Particle Density', min: 0, max: 2, step: 0.05, fmt: (v) => v.toFixed(2) },
  { key: 'lightningIntensity', label: 'Lightning Intensity', min: 0, max: 2, step: 0.05, fmt: (v) => v.toFixed(2) },
];

interface Props {
  onClose: () => void;
  onRecalibrate: () => void;
}

export function Settings({ onClose, onRecalibrate }: Props) {
  const config = useInstrumentStore((s) => s.config);
  const setConfig = useInstrumentStore((s) => s.setConfig);
  const performanceMode = useInstrumentStore((s) => s.performanceMode);
  const togglePerformance = useInstrumentStore((s) => s.togglePerformance);

  const render = (specs: SliderSpec[], label: string) => (
    <div>
      <div className="section-label">{label}</div>
      {specs.map((s) => (
        <div className="row" key={s.key}>
          <span className="name">{s.label}</span>
          <span className="val">{s.fmt(config[s.key] as number)}</span>
          <input
            type="range"
            min={s.min}
            max={s.max}
            step={s.step}
            value={config[s.key] as number}
            onChange={(e) => setConfig({ [s.key]: Number(e.target.value) } as Partial<EngineConfig>)}
            style={{ flex: 1 }}
          />
        </div>
      ))}
    </div>
  );

  return (
    <div className="glass-panel">
      <h3>Instrument</h3>
      {render(AUDIO, 'Audio')}
      {render(GESTURE, 'Gesture')}
      {render(VISUAL, 'Visual')}

      <div className="section-label">Mode</div>
      <div className="row" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <button className={performanceMode ? 'active' : ''} onClick={togglePerformance}>
          {performanceMode ? 'Performance Mode — ON' : 'Enter Performance Mode'}
        </button>
        <button onClick={onRecalibrate}>Recalibrate Range</button>
        <button onClick={() => setConfig({ ...DEFAULT_CONFIG })}>Reset to Defaults</button>
        <button onClick={onClose}>Close</button>
      </div>
    </div>
  );
}
