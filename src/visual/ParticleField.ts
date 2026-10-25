import * as THREE from 'three';
import {
  clamp,
  createParticleCloud,
  ParticleBuffers,
  randomRange,
  setParticle,
  setParticleColor,
} from './common';

export interface ReactiveParams {
  volume: number;
  pitch: number;
  timbreColor: THREE.Color;
  center: THREE.Vector3;
  intensity: number;
  density: number;
  time: number;
  dt: number;
}

/** Audio-reactive cosmic dust that swirls around the resonance field. */
export class ParticleField {
  private cloud: ParticleBuffers;
  private baseAlphas: Float32Array;
  private baseSizes: Float32Array;
  private seeds: Float32Array;

  constructor(count = 900) {
    this.cloud = createParticleCloud(count);
    this.baseAlphas = new Float32Array(count);
    this.baseSizes = new Float32Array(count);
    this.seeds = new Float32Array(count);

    for (let i = 0; i < count; i++) {
      const r = randomRange(0.3, 4.2);
      const a = randomRange(0, Math.PI * 2);
      const x = Math.cos(a) * r;
      const y = Math.sin(a) * r * 0.8;
      const z = randomRange(-2.5, 0.6);
      setParticle(this.cloud, i, x, y, z);
      this.cloud.velocities[i * 3] = randomRange(-0.2, 0.2);
      this.cloud.velocities[i * 3 + 1] = randomRange(-0.2, 0.2);
      this.cloud.velocities[i * 3 + 2] = randomRange(-0.1, 0.1);
      this.baseAlphas[i] = randomRange(0.12, 0.5);
      this.baseSizes[i] = randomRange(1.4, 3.4);
      this.seeds[i] = Math.random() * 100;
    }
    this.cloud.geometry.attributes.position.needsUpdate = true;
  }

  get object(): THREE.Points {
    return this.cloud.points;
  }

  update(p: ReactiveParams): void {
    const { positions, velocities, alphas, sizes, count } = this.cloud;
    const { volume, pitch, timbreColor, center, intensity, density, time, dt } = p;

    const speed = 0.4 + pitch * 1.6 + volume * 0.5;
    const swirl = (0.2 + pitch * 1.1) * intensity;
    const pull = 0.5 + volume * 0.8;
    const visible = clamp(volume * 1.25, 0, 1) * clamp(density, 0, 1.6);

    for (let i = 0; i < count; i++) {
      const i3 = i * 3;
      const px = positions[i3];
      const py = positions[i3 + 1];

      // flow toward center with swirl
      const dx = center.x - px;
      const dy = center.y - py;
      const dist = Math.sqrt(dx * dx + dy * dy) + 1e-3;
      const nx = dx / dist;
      const ny = dy / dist;
      const tx = -ny;
      const ty = nx;

      const wob = Math.sin(time * 0.7 + this.seeds[i]) * 0.4;
      velocities[i3] += (nx * pull + tx * swirl + wob) * dt;
      velocities[i3 + 1] += (ny * pull + ty * swirl + wob * 0.7) * dt;

      // damping
      const damp = Math.pow(0.86, dt * 60);
      velocities[i3] *= damp;
      velocities[i3 + 1] *= damp;

      positions[i3] += velocities[i3] * speed * dt;
      positions[i3 + 1] += velocities[i3 + 1] * speed * dt;

      // gentle z breathing
      positions[i3 + 2] += Math.sin(time * 0.5 + this.seeds[i]) * dt * 0.2;

      // keep particles within a soft volume
      if (Math.abs(positions[i3]) > 8) velocities[i3] -= positions[i3] * 0.02 * dt;
      if (Math.abs(positions[i3 + 1]) > 6) velocities[i3 + 1] -= positions[i3 + 1] * 0.02 * dt;

      const a = this.baseAlphas[i] * (0.15 + 0.85 * visible);
      alphas[i] = a;
      const s = this.baseSizes[i] * (0.4 + pitch * 0.9) * (0.5 + volume * 0.7);
      sizes[i] = s * clamp(intensity, 0.5, 1.6);

      const bright = 0.5 + pitch * 0.8;
      setParticleColor(
        this.cloud,
        i,
        (0.5 + timbreColor.r) * 0.5 * bright,
        (0.55 + timbreColor.g) * 0.5 * bright,
        (0.7 + timbreColor.b) * 0.5 * bright,
      );
    }

    this.cloud.geometry.attributes.position.needsUpdate = true;
    this.cloud.geometry.attributes.alpha.needsUpdate = true;
    this.cloud.geometry.attributes.size.needsUpdate = true;
    this.cloud.geometry.attributes.color.needsUpdate = true;
  }

  dispose(): void {
    this.cloud.geometry.dispose();
    (this.cloud.points.material as THREE.Material).dispose();
  }
}
