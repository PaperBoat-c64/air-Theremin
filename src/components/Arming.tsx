import { useInstrumentStore } from '../store/instrumentStore';

interface Props {
  onSkip: () => void;
}

/** Pre-performance gate: bring both hands to the center to begin playing. */
export function Arming({ onSkip }: Props) {
  const armProgress = useInstrumentStore((s) => s.armProgress);
  const hasLeft = useInstrumentStore((s) => s.hasLeft);
  const hasRight = useInstrumentStore((s) => s.hasRight);

  const locked = armProgress >= 1;

  return (
    <div className="overlay arming interactive">
      <div className="arm-title">READY</div>
      <div className="arm-sub">BRING BOTH HANDS TO THE CENTER · BEGIN</div>

      <div className={`arm-reticle ${locked ? 'locked' : ''}`}>
        <div
          className="arm-ring-fill"
          style={{ transform: `scale(${armProgress})`, opacity: armProgress > 0 ? 1 : 0 }}
        />
        <div className="arm-cross arm-cross-x" />
        <div className="arm-cross arm-cross-y" />
      </div>

      <div className="arm-hints">
        <span className={hasLeft ? 'ok' : ''}>L</span>
        <span className={hasRight ? 'ok' : ''}>R</span>
      </div>

      <button className="arm-skip" onClick={onSkip}>
        SKIP
      </button>
    </div>
  );
}
