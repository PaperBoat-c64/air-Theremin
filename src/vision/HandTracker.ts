import { FilesetResolver, HandLandmarker } from '@mediapipe/tasks-vision';
import { Handedness, Landmark } from '../types';
import { RawHand } from './HandMapper';

const WASM_URL = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm';
const MODEL_URL =
  'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task';

export class HandTracker {
  private landmarker: HandLandmarker | null = null;
  private stream: MediaStream | null = null;

  readonly video: HTMLVideoElement;
  private initialized = false;
  private lastVideoTime = -1;
  private modelError: string | null = null;

  constructor() {
    this.video = document.createElement('video');
    this.video.playsInline = true;
    this.video.muted = true;
    this.video.setAttribute('playsinline', '');
    // Keep the element in the DOM (hidden) so every browser decodes frames even
    // when it is not painted by the scene backdrop.
    this.video.style.position = 'fixed';
    this.video.style.left = '-9999px';
    this.video.style.top = '0';
    this.video.style.width = '2px';
    this.video.style.height = '2px';
    this.video.style.opacity = '0';
    this.video.style.pointerEvents = 'none';
    document.body.appendChild(this.video);
  }

  get ready(): boolean {
    return this.initialized;
  }

  get error(): string | null {
    return this.modelError;
  }

  get cameraActive(): boolean {
    return this.stream !== null;
  }

  async init(): Promise<void> {
    if (this.initialized) return;
    this.modelError = null;
    try {
      const vision = await FilesetResolver.forVisionTasks(WASM_URL);
      const base = {
        modelAssetPath: MODEL_URL,
        runningMode: 'VIDEO' as const,
        numHands: 2,
        minHandDetectionConfidence: 0.4,
        minHandPresenceConfidence: 0.4,
        minTrackingConfidence: 0.4,
      };
      try {
        // GPU delegate is faster; fall back to CPU when WebGL2 is unavailable.
        this.landmarker = await HandLandmarker.createFromOptions(vision, {
          ...base,
          baseOptions: { modelAssetPath: MODEL_URL, delegate: 'GPU' },
        });
      } catch (gpuErr) {
        console.warn('GPU delegate unavailable, falling back to CPU.', gpuErr);
        this.landmarker = await HandLandmarker.createFromOptions(vision, {
          ...base,
          baseOptions: { modelAssetPath: MODEL_URL, delegate: 'CPU' },
        });
      }
      this.initialized = true;
    } catch (err) {
      this.modelError =
        'Could not load the hand-tracking model. Check your network connection — the model and WASM load from a CDN.';
      throw err;
    }
  }

  async startCamera(): Promise<void> {
    if (this.stream) return;
    const stream = await navigator.mediaDevices.getUserMedia({
      video: {
        width: { ideal: 1280 },
        height: { ideal: 720 },
        facingMode: 'user',
      },
      audio: false,
    });
    this.stream = stream;
    this.video.srcObject = stream;
    await this.video.play();
  }

  stopCamera(): void {
    this.stream?.getTracks().forEach((t) => t.stop());
    this.stream = null;
    this.video.srcObject = null;
    this.video.remove();
  }

  /** Runs one detection pass. Returns 0..2 raw hands. */
  async detect(): Promise<RawHand[]> {
    if (!this.landmarker || !this.cameraActive) return [];
    if (this.video.readyState < 2) return [];
    if (this.video.currentTime === this.lastVideoTime) return [];
    this.lastVideoTime = this.video.currentTime;

    let result;
    try {
      result = this.landmarker.detectForVideo(this.video, performance.now());
    } catch {
      return [];
    }

    const hands: RawHand[] = [];
    const landmarks = result.landmarks ?? [];
    const handednesses = result.handedness ?? [];
    for (let i = 0; i < landmarks.length; i++) {
      const category = handednesses[i]?.[0];
      const handedness: Handedness =
        category?.categoryName === 'Right' ? 'Right' : 'Left';
      hands.push({
        handedness,
        score: category?.score ?? 0,
        landmarks: landmarks[i].map((p) => ({
          x: p.x,
          y: p.y,
          z: p.z ?? 0,
        })) as Landmark[],
      });
    }
    return hands;
  }
}
