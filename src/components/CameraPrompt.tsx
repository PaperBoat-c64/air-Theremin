import { useState } from 'react';

interface Props {
  onAllow: () => Promise<void>;
}

export function CameraPrompt({ onAllow }: Props) {
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const allow = async () => {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      await onAllow();
    } catch (e) {
      setError(
        e instanceof Error && e.message
          ? e.message
          : 'Camera access was denied or unavailable. This instrument requires a webcam to track your hands.',
      );
      setBusy(false);
    }
  };

  return (
    <div className="camera-prompt">
      <div className="title">ALLOW CAMERA</div>
      <div className="body">to become the instrument</div>
      <button onClick={allow}>{busy ? 'INITIALIZING…' : 'ENABLE CAMERA'}</button>
      {error && <div className="error">{error}</div>}
    </div>
  );
}
