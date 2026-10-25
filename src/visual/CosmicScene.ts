import * as THREE from 'three';
import { liveState, useInstrumentStore } from '../store/instrumentStore';
import { TIMBRE_COLORS, SceneTransform } from './common';
import { Starfield } from './Starfield';
import { ParticleField } from './ParticleField';
import { ResonanceField } from './ResonanceField';
import { Lightning } from './Lightning';
import { HandEnergy } from './HandEnergy';

const FOV = 55;
const CAM_Z = 3;

export class CosmicScene {
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera: THREE.PerspectiveCamera;

  private starfield: Starfield;
  private particles: ParticleField;
  private resonance: ResonanceField;
  private lightning: Lightning;
  private handL: HandEnergy;
  private handR: HandEnergy;

  private transform: SceneTransform;

  private videoPlane: THREE.Mesh | null = null;
  private videoTexture: THREE.VideoTexture | null = null;

  private boltTimer = 0;

  constructor() {
    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      powerPreference: 'high-performance',
      alpha: false,
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setClearColor(0x03040a, 1);

    this.camera = new THREE.PerspectiveCamera(
      FOV,
      window.innerWidth / window.innerHeight,
      0.1,
      100,
    );
    this.camera.position.z = CAM_Z;

    this.transform = this.computeTransform();

    this.starfield = new Starfield();
    this.particles = new ParticleField();
    this.resonance = new ResonanceField();
    this.lightning = new Lightning();
    this.handL = new HandEnergy();
    this.handR = new HandEnergy();

    this.scene.add(
      this.starfield.object,
      this.particles.object,
      this.resonance.object,
      this.lightning.object,
      this.handL.object,
      this.handR.object,
    );
  }

  mount(container: HTMLElement): void {
    container.appendChild(this.renderer.domElement);
  }

  private computeTransform(): SceneTransform {
    const aspect = window.innerWidth / window.innerHeight;
    const scale = CAM_Z * Math.tan((FOV * Math.PI) / 360);
    return { aspect, scale };
  }

  setVideo(video: HTMLVideoElement): void {
    if (this.videoTexture) {
      this.videoTexture.dispose();
      if (this.videoPlane) this.scene.remove(this.videoPlane);
    }
    const tex = new THREE.VideoTexture(video);
    tex.minFilter = THREE.LinearFilter;
    tex.magFilter = THREE.LinearFilter;
    tex.generateMipmaps = false;
    this.videoTexture = tex;

    const halfH = (CAM_Z + 8) * Math.tan((FOV * Math.PI) / 360);
    const aspect = window.innerWidth / window.innerHeight;
    const geo = new THREE.PlaneGeometry(halfH * 2, halfH * 2);

    const mat = new THREE.ShaderMaterial({
      depthWrite: false,
      depthTest: false,
      uniforms: {
        tVideo: { value: tex },
        uOpacity: { value: 0.34 },
      },
      vertexShader: /* glsl */ `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: /* glsl */ `
        varying vec2 vUv;
        uniform sampler2D tVideo;
        uniform float uOpacity;
        void main() {
          vec2 uv = vec2(1.0 - vUv.x, vUv.y); // mirror
          vec3 c = texture2D(tVideo, uv).rgb;
          float l = dot(c, vec3(0.299, 0.587, 0.114));
          vec3 col = mix(vec3(l), c, 0.3);
          col *= vec3(0.42, 0.52, 0.82);
          col *= uOpacity;
          vec2 q = vUv - 0.5;
          col *= 1.0 - 0.45 * dot(q, q);
          gl_FragColor = vec4(col, 1.0);
        }
      `,
    });

    this.videoPlane = new THREE.Mesh(geo, mat);
    this.videoPlane.position.z = -8;
    this.videoPlane.scale.set(aspect, 1, 1);
    this.videoPlane.renderOrder = -10;
    this.scene.add(this.videoPlane);
  }

  resize(): void {
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.transform = this.computeTransform();
    if (this.videoPlane) {
      const aspect = window.innerWidth / window.innerHeight;
      this.videoPlane.scale.x = aspect;
    }
  }

  update(dt: number, time: number): void {
    const cfg = useInstrumentStore.getState().config;
    const color = TIMBRE_COLORS[liveState.timbre];
    const t = this.transform;
    const volume = liveState.volume;
    const pitch = liveState.pitchNorm;
    const intensity = cfg.visualIntensity;
    const density = cfg.particleDensity;
    const lightningIntensity = cfg.lightningIntensity;

    const left = liveState.left;
    const right = liveState.right;

    this.starfield.update(time, dt, intensity);

    // midpoint between hands (world -> scene)
    let cx = 0;
    let cy = 0;
    if (left && right) {
      cx = ((left.world.x + right.world.x) / 2) * t.aspect * t.scale;
      cy = ((left.world.y + right.world.y) / 2) * t.scale;
    }

    this.particles.update({
      volume,
      pitch,
      timbreColor: color,
      center: new THREE.Vector3(cx, cy, 0),
      intensity,
      density,
      time,
      dt,
    });

    this.resonance.update(left, right, color, pitch, volume, t, time, dt);

    this.handL.update(
      left,
      liveState.trailLeft,
      color,
      t,
      dt,
      time,
      this.lightning,
      lightningIntensity,
      liveState.opennessLeft,
    );
    this.handR.update(
      right,
      liveState.trailRight,
      color,
      t,
      dt,
      time,
      this.lightning,
      lightningIntensity,
      liveState.opennessRight,
    );
    this.handL.updateBurst(dt);
    this.handR.updateBurst(dt);

    // arcs between hands when they draw near
    this.boltTimer -= dt;
    if (left && right && this.boltTimer <= 0) {
      const closeness = 1 - liveState.distanceNorm;
      if (closeness > 0.25) {
        const lx = left.world.x * t.aspect * t.scale;
        const ly = left.world.y * t.scale;
        const rx = right.world.x * t.aspect * t.scale;
        const ry = right.world.y * t.scale;
        const a = new THREE.Vector3(lx, ly, 0);
        const b = new THREE.Vector3(rx, ry, 0);
        const n = Math.floor(closeness * 3);
        for (let i = 0; i < n; i++) {
          this.lightning.spawn(
            a,
            b,
            color,
            closeness * 1.4 * lightningIntensity,
            80,
          );
        }
      }
      this.boltTimer = 0.12;
    }

    this.lightning.update(dt * 1000);
  }

  render(): void {
    this.renderer.render(this.scene, this.camera);
  }

  dispose(): void {
    this.renderer.dispose();
  }
}
