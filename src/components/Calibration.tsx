import { useEffect, useRef, useState } from 'react';
import { liveState } from '../store/instrumentStore';

interface Props {
  onComplete: (min: number, max: number) => void;
  onSkip: () => void;
}

const DEFAULT_MIN = 0.045;
const DEFAULT_MAX = 0.82;
const SAMPLE_MS = 2600;

type Step = 'spread' | 'close';

/** Two-step range calibration: spread hands, then bring them close. */
export function Calibration({ onComplete, onSkip }: Props) {
  const [step, setStep] = useState<Step>('spread');
  const [pct, setPct] = useState(0);
  const spreadMax = useRef(0);
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;

    let min = Infinity;
    let max = 0;
    const t0 = performance.now();

    const id = window.setInterval(() => {
      if (liveState.bothHands) {
        const d = liveState.distanceRaw;
        if (d > max) max = d;
        if (d < min) min = d;
      }
      const elapsed = performance.now() - t0;
      setPct(Math.min(1, elapsed / SAMPLE_MS));
      if (elapsed >= SAMPLE_MS) {
        window.clearInterval(id);
        if (step === 'spread') {
          spreadMax.current = max;
          setStep('close');
          started.current = false;
        } else {
          onComplete(Math.max(min, 0.01), Math.max(spreadMax.current, min + 0.05));
        }
      }
    }, 60);

    return () => window.clearInterval(id);
  }, [step, onComplete]);

  const title = step === 'spread' ? 'Move your hands apart' : 'Bring your hands closer';
  const hint = step === 'spread' ? 'stretch wide — this sets your lowest pitch' : 'pull in tight — this sets your highest pitch';

  return (
    <div className="calibration-wrap">
      <div className="calibration-card">
        <div className="kicker">CALIBRATION</div>
        <div className="step-title">{title}</div>
        <div className="step-hint">{hint}</div>
        <div className="progress">
          {Array.from({ length: 24 }).map((_, i) => (
            <span
              key={i}
              style={{
                display: 'inline-block',
                width: 6,
                height: 6,
                margin: 2,
                borderRadius: 2,
                background: i / 24 < pct ? 'var(--accent)' : 'var(--line)',
              }}
            />
          ))}
        </div>
        <div style={{ marginTop: 10 }}>
          <button onClick={onSkip} style={{ background: 'transparent', border: '1px solid var(--line)', color: 'var(--ink-dim)' }}>
            Skip calibration
          </button>
        </div>
      </div>
    </div>
  );
}

export { DEFAULT_MIN, DEFAULT_MAX };
