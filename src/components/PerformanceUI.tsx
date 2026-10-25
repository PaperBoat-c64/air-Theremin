import { useEffect, useRef, useState } from 'react';
import { useInstrumentStore } from '../store/instrumentStore';
import { TIMBRE_CODES, TIMBRE_LABELS } from '../types';

function useStore<T>(selector: (s: ReturnType<typeof useInstrumentStore.getState>) => T): T {
  return useInstrumentStore(selector);
}

/** Minimal on-stage HUD: pitch readout, transient timbre card, corner status. */
export function PerformanceUI() {
  const noteName = useStore((s) => s.noteName);
  const frequency = useStore((s) => s.frequency);
  const timbre = useStore((s) => s.timbre);
  const hasLeft = useStore((s) => s.hasLeft);
  const hasRight = useStore((s) => s.hasRight);
  const bothHands = useStore((s) => s.bothHands);
  const performanceMode = useStore((s) => s.performanceMode);

  // transient timbre HUD
  const [showTimbre, setShowTimbre] = useState(false);
  const [timbreKey, setTimbreKey] = useState(0);
  const lastTimbre = useRef(timbre);
  useEffect(() => {
    if (timbre !== lastTimbre.current) {
      lastTimbre.current = timbre;
      setTimbreKey((k) => k + 1);
      setShowTimbre(true);
      const t = setTimeout(() => setShowTimbre(false), 1300);
      return () => clearTimeout(t);
    }
  }, [timbre]);

  const message = !bothHands
    ? hasLeft || hasRight
      ? 'TWO HANDS REQUIRED'
      : 'WAITING FOR PERFORMER'
    : null;

  return (
    <>
      {showTimbre && (
        <div className="timbre-hud" key={timbreKey}>
          <div className="hud-label">{TIMBRE_CODES[timbre]}</div>
          <div className="hud-name">{TIMBRE_LABELS[timbre].toUpperCase()}</div>
          <div className="hud-rule" />
        </div>
      )}

      <div className="pitch-readout">
        <div className="pitch-note">{noteName}</div>
        <div className="pitch-hz">{bothHands ? `${frequency.toFixed(1)} Hz` : '· · ·'}</div>
        <div className="pitch-brand">COSMIC THEREMIN</div>
      </div>

      {message && <div className="state-message">{message}</div>}

      {!performanceMode && (
        <>
          <div className="hud-corner bl">
            <div className="label">THEREMIN ENGINE</div>
            <div className="value">ONLINE</div>
          </div>
          <div className="hud-corner br">
            <div className="label">
              <span className="dot" />
              CAMERA
            </div>
            <div className="value">ACTIVE</div>
          </div>
        </>
      )}
    </>
  );
}
