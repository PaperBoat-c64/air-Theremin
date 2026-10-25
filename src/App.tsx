import { useEffect, useRef } from 'react';
import { useInstrumentStore, liveState } from './store/instrumentStore';
import { HandTracker } from './vision/HandTracker';
import { HandMapper } from './vision/HandMapper';
import { ThereminEngine } from './audio/ThereminEngine';
import { CosmicScene } from './visual/CosmicScene';
import { TimbreId } from './types';
import { StartupOverlay } from './components/StartupOverlay';
import { CameraPrompt } from './components/CameraPrompt';
import { Calibration, DEFAULT_MAX, DEFAULT_MIN } from './components/Calibration';
import { Arming } from './components/Arming';
import { PerformanceUI } from './components/PerformanceUI';
import { DebugPanel } from './components/DebugPanel';
import { Settings } from './components/Settings';

export default function App() {
  const containerRef = useRef<HTMLDivElement>(null);
  const trackerRef = useRef<HandTracker | null>(null);
  const mapperRef = useRef<HandMapper | null>(null);
  const engineRef = useRef<ThereminEngine | null>(null);
  const sceneRef = useRef<CosmicScene | null>(null);

  const phase = useInstrumentStore((s) => s.phase);
  const performanceMode = useInstrumentStore((s) => s.performanceMode);
  const debugMode = useInstrumentStore((s) => s.debugMode);
  const settingsOpen = useInstrumentStore((s) => s.settingsOpen);

  useEffect(() => {
    const container = containerRef.current!;
    const tracker = new HandTracker();
    const mapper = new HandMapper();
    const engine = new ThereminEngine();
    const scene = new CosmicScene();

    trackerRef.current = tracker;
    mapperRef.current = mapper;
    engineRef.current = engine;
    sceneRef.current = scene;

    engine.cfgRef = () => useInstrumentStore.getState().config;
    scene.mount(container);

    // warm up the hand model in the background during boot
    tracker.init().catch(() => {
      /* surfaced later if camera fails */
    });

    // --- main loop ---
    let raf = 0;
    let last = performance.now();
    let detectBusy = false;
    let lastTimbre: TimbreId = 'classic';
    let uiTimer = 0;
    let fpsFrames = 0;
    let fpsTime = 0;
    let fps = 0;
    let armTime = 0;
    let armProgress = 0;
    const ARM_RADIUS = 0.42;
    const ARM_HOLD = 0.7;

    const applyAudio = () => {
      const st = liveState;
      if (!engine.ready) return;
      const performing = useInstrumentStore.getState().phase === 'performing';
      const sounding = performing && st.bothHands;
      if (sounding) {
        engine.setFrequency(st.frequency);
        engine.setVolume(st.volume);
      } else {
        engine.setVolume(0);
      }
      engine.setPresence(sounding);
      const cfg = useInstrumentStore.getState().config;
      engine.setVibrato(cfg.vibratoSpeed, cfg.vibratoDepth);
      if (st.timbre !== lastTimbre) {
        engine.switchTimbre(st.timbre);
        engine.playSystemSound('timbre');
        lastTimbre = st.timbre;
      }
    };

    const syncUI = () => {
      const st = liveState;
      useInstrumentStore.getState().sync({
        noteName: st.noteName,
        frequency: st.frequency,
        volume: st.volume,
        gesture: st.gesture,
        timbre: st.timbre,
        hasLeft: st.hasLeft,
        hasRight: st.hasRight,
        bothHands: st.bothHands,
        fps,
        handConfidence: Math.max(st.left?.score ?? 0, st.right?.score ?? 0),
        latencyMs: engine.latencyMs,
        handCount: (st.hasLeft ? 1 : 0) + (st.hasRight ? 1 : 0),
        distanceRaw: st.distanceRaw,
        armProgress,
      });
    };

    const loop = () => {
      const now = performance.now();
      let dt = (now - last) / 1000;
      if (dt > 0.1) dt = 0.1;
      last = now;
      const time = now / 1000;

      if (tracker.cameraActive && !detectBusy) {
        detectBusy = true;
        const t0 = now;
        tracker
          .detect()
          .then((raw) => {
            const cfg = useInstrumentStore.getState().config;
            const detectDt = Math.min((performance.now() - t0) / 1000, 0.1);
            mapper.update(raw, cfg, detectDt);
          })
          .catch(() => undefined)
          .finally(() => {
            detectBusy = false;
          });
      }

      applyAudio();

      // --- arming gate: both hands must meet at screen center ---
      if (useInstrumentStore.getState().phase === 'arming') {
        const l = liveState.left;
        const r = liveState.right;
        const lc = l ? Math.hypot(l.world.x, l.world.y) : Infinity;
        const rc = r ? Math.hypot(r.world.x, r.world.y) : Infinity;
        const bothCentered = l !== null && r !== null && lc < ARM_RADIUS && rc < ARM_RADIUS;
        armTime = bothCentered ? armTime + dt : 0;
        armProgress = Math.min(1, armTime / ARM_HOLD);
        if (armTime >= ARM_HOLD) {
          armProgress = 0;
          engine.playSystemSound('performance');
          useInstrumentStore.getState().setPhase('performing');
        }
      } else {
        armTime = 0;
        armProgress = 0;
      }

      scene.update(dt, time);
      scene.render();

      fpsFrames += 1;
      fpsTime += dt;
      if (fpsTime >= 0.5) {
        fps = Math.round(fpsFrames / fpsTime);
        fpsFrames = 0;
        fpsTime = 0;
      }

      uiTimer += dt;
      if (uiTimer >= 0.05) {
        uiTimer = 0;
        syncUI();
      }

      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);

    const onResize = () => scene.resize();
    window.addEventListener('resize', onResize);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', onResize);
      tracker.stopCamera();
      scene.dispose();
      sceneRef.current = null;
    };
  }, []);

  // keyboard shortcuts
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const s = useInstrumentStore.getState();
      if (e.key === 'd' || e.key === 'D') s.toggleDebug();
      if (e.key === 'p' || e.key === 'P') s.togglePerformance();
      if (e.key === 'f' || e.key === 'F') {
        if (document.fullscreenElement) document.exitFullscreen();
        else document.documentElement.requestFullscreen().catch(() => undefined);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // performance mode body class
  useEffect(() => {
    document.body.classList.toggle('perf', performanceMode);
  }, [performanceMode]);

  const enableCamera = async () => {
    const engine = engineRef.current!;
    const tracker = trackerRef.current!;
    const scene = sceneRef.current!;
    await engine.ensureRunning();
    await tracker.init(); // ensure the hand model is loaded before we proceed
    await tracker.startCamera();
    scene.setVideo(tracker.video);
    engine.playSystemSound('boot');
    useInstrumentStore.getState().sync({ cameraActive: true, audioReady: true, engineOnline: true });
    useInstrumentStore.getState().setPhase('calibrating');
  };

  const finishCalibration = (min: number, max: number) => {
    // add headroom so the extremes never clip into silence
    mapperRef.current!.setCalibration(min * 0.85, max * 1.1);
    useInstrumentStore.getState().setCalibration(min, max, true);
    useInstrumentStore.getState().setPhase('arming');
  };

  const skipCalibration = () => finishCalibration(DEFAULT_MIN, DEFAULT_MAX);

  const skipArming = () => {
    engineRef.current!.playSystemSound('performance');
    useInstrumentStore.getState().setPhase('performing');
  };

  return (
    <>
      <div ref={containerRef} style={{ position: 'absolute', inset: 0 }} />

      {phase === 'boot' && (
        <StartupOverlay onDone={() => useInstrumentStore.getState().setPhase('camera')} />
      )}

      {phase === 'camera' && <CameraPrompt onAllow={enableCamera} />}

      {phase === 'calibrating' && (
        <Calibration onComplete={finishCalibration} onSkip={skipCalibration} />
      )}

      {phase === 'arming' && <Arming onSkip={skipArming} />}

      {phase === 'performing' && (
        <>
          <PerformanceUI />
          {!performanceMode && (
            <button
              className="gear-btn"
              onClick={() => useInstrumentStore.getState().toggleSettings()}
              aria-label="Settings"
            >
              ⚙
            </button>
          )}
          {settingsOpen && (
            <Settings
              onClose={() => useInstrumentStore.getState().setSettingsOpen(false)}
              onRecalibrate={() => useInstrumentStore.getState().setPhase('calibrating')}
            />
          )}
          {debugMode && <DebugPanel />}
        </>
      )}
    </>
  );
}
