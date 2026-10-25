# ELECTRO THEREMIN — Cosmic Gesture Instrument

A real-time, camera-driven electronic theremin for the web. Your hands are the
instrument: the space between them sets pitch, your left hand shapes loudness,
and your right hand switches timbre — while a procedurally generated cosmic
field (stars, nebulas, plasma arcs, audio-reactive particles) responds to every
gesture.

Built with **MediaPipe Hands**, **Web Audio API** and **Three.js**.

---

## Run it

```bash
npm install
npm run dev
```

Open the printed URL (default http://localhost:5173). Allow camera access, do
the 2-step range calibration, and play.

> Requires a modern browser (Chrome/Edge/Safari) with a webcam. Hand tracking
> model and WASM load from Google's CDN, so an internet connection is needed on
> first load.

## How to play

| Control | Gesture | Result |
|---|---|---|
| **Both hands' distance** | pull apart / draw together | pitch falls as distance grows (continuous glide, C3–A6 default) |
| **Left hand openness** | fist → open palm | volume from silence → forte (exponential response) |
| **Right hand gesture** | ✊ / ☝️ / ✌️ / 3 / 4 / ✋ | switches between the 6 timbres |

### Timbre → gesture map

| ✊ Fist | ☝️ Index | ✌️ Peace | Three fingers | Four fingers | ✋ Open |
|---|---|---|---|---|---|
| Classic Theremin | Pure Digital | Crystal | Metallic FM | Alien Voice | Cosmic Choir |

## Controls

| Key | Action |
|---|---|
| `D` | toggle debug readout (landmarks, fps, pitch, latency…) |
| `P` | toggle Performance Mode (hides all UI) |
| `F` | fullscreen |
| `⚙` (top-right) | settings panel (pitch range, portamento, vibrato, FX, visual intensity…) |

## Architecture

```
src/
  audio/    ThereminEngine.ts   — synth voice, portamento, crossfade, FX bus
            TimbreManager.ts    — 6 timbres (osc layers, FM, ring-mod, drive)
            Effects.ts          — reverb / delay / chorus / glue compressor
  vision/   HandTracker.ts      — MediaPipe HandLandmarker + camera
            GestureDetector.ts  — finger extension, openness, gesture class
            HandMapper.ts       — hands → distance/pitch/volume/timbre → liveState
  visual/   CosmicScene.ts      — Three.js scene + render loop orchestration
            Starfield.ts        — layered stars + drifting nebulas
            ParticleField.ts    — audio-reactive cosmic dust
            Lightning.ts        — pooled procedural plasma arcs
            HandEnergy.ts       — glowing landmarks, electric trail, bursts
            ResonanceField.ts   — concentric-ring field between the hands
  components/  Startup / CameraPrompt / PerformanceUI / DebugPanel / Calibration / Settings
  store/       instrumentStore.ts — Zustand UI state + mutable liveState singleton
  utils/       mapping.ts · smoothing.ts
```

The performance path is deliberately decoupled from React: hand landmarks are
written into a mutable `liveState` singleton, consumed every frame by the audio
and visual loops. React only re-renders at a throttled rate for the HUD.

## Design notes

- **Continuous pitch** — no discrete keys; distance drives a smoothed frequency
  with exponential (musical) mapping and glide/portamento.
- **Gesture stability** — a new right-hand gesture must persist several frames
  before the timbre crossfades (no clicks, no false switches).
- **Calibration** — a two-step spread/close routine normalizes the distance
  range per performer, so different arm spans play the same.
- **Ghost body** — the camera feed is mirrored, desaturated and dimmed into the
  backdrop; the hands alone glow.
