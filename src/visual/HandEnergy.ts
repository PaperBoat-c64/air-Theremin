import * as THREE from 'three';
import { HandFrame, Vec2 } from '../types';
import {
  clamp,
  createParticleCloud,
  lerp,
  ParticleBuffers,
  SceneTransform,
  setParticle,
  setParticleColor,
  toSceneX,
  toSceneY,
  toSceneZ,
} from './common';
import { Lightning } from './Lightning';

const TIPS = [4, 8, 12, 16, 20];
const PALM = [0, 1, 5, 9, 13, 17];

const BURST_CAP = 64;

/** Turns a hand into a glowing energy object: landmark sparks, electric trail, bursts. */
export class HandEnergy {
  private group = new THREE.Group();
  private landmarks: ParticleBuffers;
  private trail: ParticleBuffers;
  private burst: ParticleBuffers;
  private burstLife: Float32Array;

  private landmarkSize = new Float32Array(21);
  private landmarkAlpha = new Float32Array(21);

  private prevPalm: THREE.Vector3 | null = null;
  private speed = 0;
  private arcTick = 0;
  private tmpColor = new THREE.Color();

  constructor(trailCap = 90) {
    this.landmarks = createParticleCloud(21);
    this.trail = createParticleCloud(trailCap);
    this.burst = createParticleCloud(BURST_CAP);
    this.burstLife = new Float32Array(BURST_CAP);

    for (let i = 0; i < 21; i++) {
      const isTip = TIPS.includes(i);
      const isPalm = PALM.includes(i);
      this.landmarkSize[i] = isTip ? 5.0 : isPalm ? 3.5 : 1.6;
      this.landmarkAlpha[i] = isTip ? 0.55 : isPalm ? 0.35 : 0.18;
    }

    this.group.add(this.landmarks.points);
    this.group.add(this.trail.points);
    this.group.add(this.burst.points);

    for (let i = 0; i < BURST_CAP; i++) {
      this.burst.alphas[i] = 0;
    }
    this.burst.geometry.attributes.alpha.needsUpdate = true;
  }

  get object(): THREE.Group {
    return this.group;
  }

  update(
    hand: HandFrame | null,
    trailPoints: Vec2[],
    color: THREE.Color,
    t: SceneTransform,
    dt: number,
    time: number,
    lightning: Lightning | null,
    lightningIntensity: number,
    openness: number,
  ): void {
    // ---- landmark sparks ----
    if (hand) {
      for (let i = 0; i < 21; i++) {
        const lm = hand.worldLandmarks[i];
        setParticle(
          this.landmarks,
          i,
          toSceneX(lm.x, t),
          toSceneY(lm.y, t),
          toSceneZ(lm.z, t),
        );
        const isTip = TIPS.includes(i);
        const pulse = isTip ? 0.85 + 0.15 * Math.sin(time * 6 + i) : 1;
        const a = this.landmarkAlpha[i] * pulse * (0.6 + openness * 0.5);
        this.landmarks.alphas[i] = a;
        this.landmarks.sizes[i] =
          this.landmarkSize[i] * (0.75 + openness * 0.5);
        this.tmpColor.set(1, 1, 1).lerp(color, 0.35);
        setParticleColor(this.landmarks, i, this.tmpColor.r, this.tmpColor.g, this.tmpColor.b);
      }
    } else {
      for (let i = 0; i < 21; i++) this.landmarks.alphas[i] = 0;
    }
    this.landmarks.geometry.attributes.position.needsUpdate = true;
    this.landmarks.geometry.attributes.alpha.needsUpdate = true;
    this.landmarks.geometry.attributes.size.needsUpdate = true;
    this.landmarks.geometry.attributes.color.needsUpdate = true;

    // ---- palm / speed ----
    const palm = hand
      ? new THREE.Vector3(toSceneX(hand.world.x, t), toSceneY(hand.world.y, t), 0)
      : null;
    if (palm && this.prevPalm) {
      const d = palm.distanceTo(this.prevPalm) / Math.max(dt, 1e-3);
      this.speed = lerp(this.speed, d, 0.25);
    } else {
      this.speed = lerp(this.speed, 0, 0.1);
    }
    this.prevPalm = palm ? palm.clone() : null;

    // ---- electric trail ----
    const n = trailPoints.length;
    for (let i = 0; i < this.trail.count; i++) {
      if (i < n) {
        const p = trailPoints[n - 1 - i]; // newest first
        setParticle(this.trail, i, toSceneX(p.x, t), toSceneY(p.y, t), 0);
        const ageT = i / n;
        this.trail.alphas[i] = (1 - ageT) * (1 - ageT) * 0.32 * (0.5 + this.speed * 0.05);
        this.trail.sizes[i] = (1 - ageT) * 3.4 + 0.5;
        setParticleColor(this.trail, i, color.r, color.g, color.b);
      } else {
        this.trail.alphas[i] = 0;
      }
    }
    this.trail.geometry.attributes.position.needsUpdate = true;
    this.trail.geometry.attributes.alpha.needsUpdate = true;
    this.trail.geometry.attributes.size.needsUpdate = true;
    this.trail.geometry.attributes.color.needsUpdate = true;

    // ---- bursts on fast movement ----
    if (palm && this.speed > 6.0) {
      this.triggerBurst(palm, color);
    }

    // ---- palm -> fingertip arcs ----
    this.arcTick++;
    if (hand && lightning && lightningIntensity > 0.02 && this.arcTick % 2 === 0) {
      const palmV = new THREE.Vector3(toSceneX(hand.world.x, t), toSceneY(hand.world.y, t), 0);
      const tipIdx = TIPS[Math.floor(Math.random() * TIPS.length)];
      const lm = hand.worldLandmarks[tipIdx];
      const tipV = new THREE.Vector3(toSceneX(lm.x, t), toSceneY(lm.y, t), toSceneZ(lm.z, t));
      const intensity = (0.4 + openness * 0.8) * lightningIntensity;
      if (Math.random() < 0.75) {
        lightning.spawn(palmV, tipV, this.tmpColor.copy(color), intensity, 70);
      }
    }
  }

  private triggerBurst(center: THREE.Vector3, color: THREE.Color): void {
    for (let i = 0; i < BURST_CAP; i++) {
      if (this.burstLife[i] > 0) continue;
      const a = Math.random() * Math.PI * 2;
      const sp = 1 + Math.random() * 2.5;
      this.burst.velocities[i * 3] = Math.cos(a) * sp;
      this.burst.velocities[i * 3 + 1] = Math.sin(a) * sp;
      this.burst.velocities[i * 3 + 2] = (Math.random() - 0.5) * 1.5;
      setParticle(this.burst, i, center.x, center.y, center.z);
      this.burstLife[i] = 0.5 + Math.random() * 0.4;
      this.burst.sizes[i] = 2 + Math.random() * 3;
      setParticleColor(this.burst, i, color.r, color.g, color.b);
      this.burst.alphas[i] = 0.55;
    }
  }

  updateBurst(dt: number): void {
    for (let i = 0; i < BURST_CAP; i++) {
      if (this.burstLife[i] <= 0) {
        this.burst.alphas[i] = 0;
        continue;
      }
      this.burstLife[i] -= dt;
      const i3 = i * 3;
      this.burst.positions[i3] += this.burst.velocities[i3] * dt;
      this.burst.positions[i3 + 1] += this.burst.velocities[i3 + 1] * dt;
      this.burst.positions[i3 + 2] += this.burst.velocities[i3 + 2] * dt;
      this.burst.velocities[i3] *= Math.pow(0.9, dt * 60);
      this.burst.velocities[i3 + 1] *= Math.pow(0.9, dt * 60);
      const lifeT = clamp(this.burstLife[i] / 0.9, 0, 1);
      this.burst.alphas[i] = lifeT * 0.5;
      this.burst.sizes[i] *= Math.pow(0.95, dt * 60);
    }
    this.burst.geometry.attributes.position.needsUpdate = true;
    this.burst.geometry.attributes.alpha.needsUpdate = true;
    this.burst.geometry.attributes.size.needsUpdate = true;
  }
}
