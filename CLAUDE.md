# CLAUDE.md

## Project

ELECTRO THEREMIN — a real-time, camera-driven electronic theremin for the web.
Hands are the instrument: distance between palms → pitch, left-hand openness →
volume, right-hand gesture → timbre. MediaPipe Hands + Web Audio + Three.js.

## Commands

```bash
npm run dev        # Vite dev server (default http://localhost:5173)
npm run build      # tsc -b && vite build
npm run typecheck  # tsc -b --noEmit
```

Requires network on first load (MediaPipe model + WASM load from CDN) and a
webcam. No test suite.

## Architecture

```
src/audio/      ThereminEngine (voice, portamento, crossfade, FX bus)
                TimbreManager (6 timbre specs + voice builder)
                Effects (reverb/delay/chorus/compressor)
src/vision/     HandTracker (MediaPipe HandLandmarker + camera)
                GestureDetector (finger extension, openness, gesture class)
                HandMapper (hands → distance/pitch/volume/timbre → liveState)
src/visual/     CosmicScene (scene + render loop)
                Starfield · ParticleField · Lightning · HandEnergy · ResonanceField
src/components/ Startup · CameraPrompt · PerformanceUI · DebugPanel · Calibration · Settings
src/store/      instrumentStore (Zustand + mutable liveState singleton)
src/utils/      mapping · smoothing
```

## Conventions & gotchas

- **Performance path is decoupled from React.** Hand landmarks and mapped
  params are written each detection frame into the mutable `liveState` singleton
  (`src/store/instrumentStore.ts`). The audio + visual loops read `liveState`
  directly every rAF. React re-renders only at ~20 Hz via `store.sync(...)`.
  Never put per-frame audio/visual state into the Zustand store.

- **MediaPipe is synchronous.** `HandLandmarker.detectForVideo()` returns a
  result synchronously (not a Promise) and is gated on
  `video.currentTime !== lastVideoTime` (official dedup pattern). Read
  `result.handedness` — the `handednesses` field is deprecated. `HandTracker`
  still exposes an async `detect()` wrapper so App can use `.then()`.

- **Coordinate mapping (mirror).** MediaPipe gives normalized `x,y` in `[0,1]`
  of the *unmirrored* camera. `HandMapper` converts to world space as
  `{x: 1-2x, y: 1-2y}` (mirror + flip Y). `Handedness` 'Left'/'Right' is the
  *anatomical* hand and drives role assignment (left = volume, right = timbre),
  NOT screen position. The scene maps world → world-units via `SceneTransform`
  `{aspect, scale}` (`toSceneX/Y/Z` in `visual/common.ts`).

- **Colors are `THREE.Color`**, not `Vector3`. `TIMBRE_COLORS` (in
  `visual/common.ts`) is `Record<TimbreId, THREE.Color>`. Particle colors use
  `.r/.g/.b`.

- **No per-frame allocations** in the render loop. All particle systems use
  pre-allocated `Float32Array` buffers and object pooling (`createParticleCloud`
  in `visual/common.ts`); Lightning bolts are a fixed pool.

- **StrictMode is intentionally disabled** (`src/main.tsx`) — a real-time
  instrument would double-mount effects and spawn duplicate AudioContext/render
  loops.

- **Strict TS** is on (`noUnusedLocals`, `noUnusedParameters`). Clean up unused
  symbols or the build fails.

- **Audio is Web Audio only** (no Tone.js). Pitch glide uses
  `osc.frequency.setTargetAtTime(…)`; volume/gesture smoothing uses one-pole
  smoothers in `utils/smoothing.ts` and `utils/mapping.ts`.

- **Gesture → timbre map** lives in `src/types.ts` (`GESTURE_TO_TIMBRE`), the
  single source of truth shared by HandMapper and UI labels.

## When editing

- Adding a timbre: extend `TimbreId` + `TIMBRE_SPECS` + `TIMBRE_LABELS/CODES`
  (types.ts) and `TIMBRE_COLORS` + `CHORUS_BY_TIMBRE` (visual/common.ts,
  audio/ThereminEngine.ts). Gesture → timbre stays in `GESTURE_TO_TIMBRE`.
- Tuning feel: defaults live in `DEFAULT_CONFIG` (types.ts); smooth/mapping
  curves in `utils/mapping.ts`, `vision/GestureDetector.ts`, `vision/HandMapper.ts`.
- Visual FX are additive-blended and `depthTest:false`; keep them that way so
  layering stays correct over the video backdrop.
