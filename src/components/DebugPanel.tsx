import { useInstrumentStore } from '../store/instrumentStore';

/** Developer readout (toggle with `D`). */
export function DebugPanel() {
  const fps = useInstrumentStore((s) => s.fps);
  const handCount = useInstrumentStore((s) => s.handCount);
  const handConfidence = useInstrumentStore((s) => s.handConfidence);
  const noteName = useInstrumentStore((s) => s.noteName);
  const frequency = useInstrumentStore((s) => s.frequency);
  const volume = useInstrumentStore((s) => s.volume);
  const gesture = useInstrumentStore((s) => s.gesture);
  const timbre = useInstrumentStore((s) => s.timbre);
  const latencyMs = useInstrumentStore((s) => s.latencyMs);
  const distance = useInstrumentStore((s) => s.distanceRaw);

  const rows: Array<[string, string]> = [
    ['FPS', String(fps)],
    ['HANDS', String(handCount)],
    ['CONF', handConfidence.toFixed(2)],
    ['DIST', distance.toFixed(3)],
    ['PITCH', noteName],
    ['FREQ', `${frequency.toFixed(1)} Hz`],
    ['VOLUME', volume.toFixed(2)],
    ['GESTURE', gesture.toUpperCase()],
    ['TIMBRE', timbre.toUpperCase()],
    ['LATENCY', `${latencyMs} ms`],
  ];

  return (
    <div className="debug-panel">
      {rows.map(([k, v]) => (
        <div key={k}>
          <span className="k">{k.padEnd(9)}</span>
          <span className="v">{v}</span>
        </div>
      ))}
    </div>
  );
}
