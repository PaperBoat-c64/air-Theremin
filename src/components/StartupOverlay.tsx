import { useEffect, useRef, useState } from 'react';

interface Props {
  onDone: () => void;
}

const STAGES = [
  'INITIALIZING CORE',
  'GESTURE ENGINE · ONLINE',
  'AUDIO ENGINE · ONLINE',
  'SYSTEM READY',
];

const TOTAL_MS = 2600;

/** Minimal sci-fi boot: runs a progress meter, then holds for "press any key". */
export function StartupOverlay({ onDone }: Props) {
  const [progress, setProgress] = useState(0);
  const [ready, setReady] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const leftRef = useRef(false);

  useEffect(() => {
    const start = performance.now();
    let raf = 0;
    const tick = () => {
      const t = Math.min(1, (performance.now() - start) / TOTAL_MS);
      setProgress(t);
      if (t < 1) raf = requestAnimationFrame(tick);
      else setReady(true);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  useEffect(() => {
    if (!ready) return;
    const advance = () => {
      if (leftRef.current) return;
      leftRef.current = true;
      setLeaving(true);
      window.setTimeout(onDone, 850);
    };
    const onKey = (e: KeyboardEvent) => {
      e.preventDefault();
      advance();
    };
    const onPointer = () => advance();
    window.addEventListener('keydown', onKey);
    window.addEventListener('pointerdown', onPointer);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('pointerdown', onPointer);
    };
  }, [ready, onDone]);

  const stageIndex = Math.min(STAGES.length - 1, Math.floor(progress * STAGES.length));

  return (
    <div className={`overlay boot ${leaving ? 'fade-out' : ''}`}>
      <div className="boot-corners" aria-hidden="true">
        <i /><i /><i /><i />
      </div>
      <div className="boot-glow" aria-hidden="true" />
      <div className="boot-scan" aria-hidden="true" />

      <div className="boot-core">
        <div className="boot-kicker">COSMIC GESTURE INSTRUMENT</div>

        {ready ? (
          <>
            <div className="boot-title">
              ELECTRO<span className="thin">THEREMIN</span>
            </div>
            <div className="boot-ready">SYS · READY</div>
            <div className="boot-press">PRESS ANY KEY TO CONTINUE</div>
          </>
        ) : (
          <>
            <div className="boot-stage">{STAGES[stageIndex]}</div>
            <div className="boot-bar">
              <div className="boot-bar-fill" style={{ width: `${progress * 100}%` }} />
            </div>
            <div className="boot-pct">{String(Math.round(progress * 100)).padStart(3, '0')}%</div>
          </>
        )}
      </div>
    </div>
  );
}
