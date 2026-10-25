import * as THREE from 'three';
import { TimbreId } from '../types';

/** Per-timbre accent color (RGB 0..1). Kept cold / cosmic. */
export const TIMBRE_COLORS: Record<TimbreId, THREE.Color> = {
  classic: new THREE.Color(0.55, 0.7, 1.0),
  digital: new THREE.Color(0.3, 0.8, 1.0),
  crystal: new THREE.Color(0.82, 0.9, 1.0),
  metal: new THREE.Color(0.58, 0.68, 0.92),
  alien: new THREE.Color(0.7, 0.5, 1.0),
  choir: new THREE.Color(0.9, 0.8, 1.0),
  strings: new THREE.Color(0.95, 0.62, 0.5),
};

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

export function clamp(v: number, a: number, b: number): number {
  return v < a ? a : v > b ? b : v;
}

/** Soft round additive point material (per-vertex size + color). */
export function createParticleMaterial(blend: THREE.Blending = THREE.AdditiveBlending): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    depthTest: false,
    blending: blend,
    vertexShader: /* glsl */ `
      attribute float size;
      attribute vec3 color;
      attribute float alpha;
      varying vec3 vColor;
      varying float vAlpha;
      void main() {
        vColor = color;
        vAlpha = alpha;
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        gl_PointSize = size * (260.0 / max(1.0, -mv.z));
        gl_Position = projectionMatrix * mv;
      }
    `,
    fragmentShader: /* glsl */ `
      varying vec3 vColor;
      varying float vAlpha;
      void main() {
        vec2 c = gl_PointCoord - 0.5;
        float d = length(c) * 2.0;
        float a = smoothstep(1.0, 0.0, d);
        a = pow(a, 2.2) * vAlpha;
        if (a < 0.003) discard;
        gl_FragColor = vec4(vColor, a);
      }
    `,
  });
}

export interface ParticleBuffers {
  geometry: THREE.BufferGeometry;
  points: THREE.Points;
  positions: Float32Array;
  colors: Float32Array;
  sizes: Float32Array;
  alphas: Float32Array;
  velocities: Float32Array;
  count: number;
}

/** Build a pooled particle cloud with per-particle buffers. */
export function createParticleCloud(
  count: number,
  material?: THREE.ShaderMaterial,
): ParticleBuffers {
  const positions = new Float32Array(count * 3);
  const colors = new Float32Array(count * 3);
  const sizes = new Float32Array(count);
  const alphas = new Float32Array(count);
  const velocities = new Float32Array(count * 3);

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geometry.setAttribute('size', new THREE.BufferAttribute(sizes, 1));
  geometry.setAttribute('alpha', new THREE.BufferAttribute(alphas, 1));

  const mat = material ?? createParticleMaterial();
  const points = new THREE.Points(geometry, mat);
  points.frustumCulled = false;

  return { geometry, points, positions, colors, sizes, alphas, velocities, count };
}

export function setParticle(p: ParticleBuffers, i: number, x: number, y: number, z: number): void {
  p.positions[i * 3] = x;
  p.positions[i * 3 + 1] = y;
  p.positions[i * 3 + 2] = z;
}

export function setParticleColor(
  p: ParticleBuffers,
  i: number,
  r: number,
  g: number,
  b: number,
): void {
  p.colors[i * 3] = r;
  p.colors[i * 3 + 1] = g;
  p.colors[i * 3 + 2] = b;
}

export function randomRange(a: number, b: number): number {
  return a + Math.random() * (b - a);
}

export interface SceneTransform {
  aspect: number;
  scale: number;
}

export function toSceneX(x: number, t: SceneTransform): number {
  return x * t.aspect * t.scale;
}

export function toSceneY(y: number, t: SceneTransform): number {
  return y * t.scale;
}

export function toSceneZ(z: number, t: SceneTransform): number {
  return z * t.scale * 0.5;
}
