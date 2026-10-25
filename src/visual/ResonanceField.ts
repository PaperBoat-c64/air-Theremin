import * as THREE from 'three';
import { SceneTransform, toSceneX, toSceneY } from './common';
import { HandFrame } from '../types';

/** Concentric-ring "sound field" that lives in the space between the hands. */
export class ResonanceField {
  private mesh: THREE.Mesh;
  private mat: THREE.ShaderMaterial;
  private active = false;

  constructor() {
    this.mat = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      depthTest: false,
      blending: THREE.AdditiveBlending,
      uniforms: {
        uColor: { value: new THREE.Color(0.6, 0.75, 1.0) },
        uIntensity: { value: 0 },
        uRingFreq: { value: 40 },
        uTime: { value: 0 },
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
        uniform vec3 uColor;
        uniform float uIntensity;
        uniform float uRingFreq;
        uniform float uTime;
        void main() {
          vec2 p = vUv - 0.5;
          float d = length(p) * 2.0;
          float rings = sin(d * uRingFreq - uTime * 2.5) * 0.5 + 0.5;
          rings *= exp(-d * 3.4);
          float glow = exp(-d * 5.0);
          float edge = smoothstep(1.0, 0.7, d);
          float a = (rings * 0.7 + glow * 0.9) * edge * uIntensity;
          vec3 col = uColor * (0.75 + rings * 0.5 + glow * 0.5);
          gl_FragColor = vec4(col, a);
        }
      `,
    });
    this.mesh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), this.mat);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 2;
  }

  get object(): THREE.Mesh {
    return this.mesh;
  }

  update(
    left: HandFrame | null,
    right: HandFrame | null,
    color: THREE.Color,
    pitch: number,
    volume: number,
    t: SceneTransform,
    time: number,
    dt: number,
  ): void {
    const both = !!left && !!right;
    const target = both ? 1 : 0;

    // fade intensity
    const cur = this.mat.uniforms.uIntensity.value as number;
    this.mat.uniforms.uIntensity.value +=
      (target * (0.35 + volume * 0.9) - cur) * Math.min(1, dt * 6);

    this.mat.uniforms.uTime.value = time;
    this.mat.uniforms.uRingFreq.value = 28 + pitch * 70;
    (this.mat.uniforms.uColor.value as THREE.Color).copy(color);

    if (both) {
      const mx = (left!.world.x + right!.world.x) / 2;
      const my = (left!.world.y + right!.world.y) / 2;
      const distWorld = Math.hypot(left!.world.x - right!.world.x, left!.world.y - right!.world.y);
      const radius = Math.max(0.12, distWorld * t.aspect * t.scale * 0.95);
      this.mesh.position.set(toSceneX(mx, t), toSceneY(my, t), 0);
      this.mesh.scale.set(radius * 2, radius * 2, 1);
      this.active = true;
    } else {
      this.active = false;
      if (this.mat.uniforms.uIntensity.value < 0.02) this.mesh.visible = false;
    }

    this.mesh.visible = this.active || (this.mat.uniforms.uIntensity.value as number) > 0.02;
  }
}
