import * as THREE from 'three';
import { clamp, createParticleCloud, ParticleBuffers, setParticle, setParticleColor } from './common';

const MAX_POINTS = 18;
const LEVELS = 3;

interface Bolt {
  active: boolean;
  life: number;
  maxLife: number;
  intensity: number;
  core: THREE.Line;
  halo: THREE.Line;
  corePos: Float32Array;
  haloPos: Float32Array;
  coreCol: Float32Array;
  haloCol: Float32Array;
  coreAlpha: Float32Array;
  haloAlpha: Float32Array;
  coreCount: number;
  haloCount: number;
}

/**
 * Pooled procedural plasma arcs. Each bolt is a bright white core line wrapped
 * in a softer colored halo line, with branching and endpoint spark particles —
 * a Tesla-coil / lightning look rather than a flat stroked path.
 */
export class Lightning {
  private group = new THREE.Group();
  private pool: Bolt[] = [];
  private cursor = 0;
  private mat: THREE.ShaderMaterial;
  private sparks: ParticleBuffers;
  private sparkLife: Float32Array;

  constructor(maxBolts = 24) {
    this.mat = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      depthTest: false,
      blending: THREE.AdditiveBlending,
      vertexShader: /* glsl */ `
        attribute vec3 color;
        attribute float alpha;
        varying vec3 vColor;
        varying float vAlpha;
        void main() {
          vColor = color;
          vAlpha = alpha;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: /* glsl */ `
        varying vec3 vColor;
        varying float vAlpha;
        void main() {
          gl_FragColor = vec4(vColor, vAlpha);
        }
      `,
    });

    for (let i = 0; i < maxBolts; i++) {
      const core = this.makeLine();
      const halo = this.makeLine();
      this.group.add(core.line, halo.line);
      this.pool.push({
        active: false,
        life: 0,
        maxLife: 1,
        intensity: 0,
        core: core.line,
        halo: halo.line,
        corePos: core.pos,
        haloPos: halo.pos,
        coreCol: core.col,
        haloCol: halo.col,
        coreAlpha: core.alpha,
        haloAlpha: halo.alpha,
        coreCount: 0,
        haloCount: 0,
      });
    }

    this.sparks = createParticleCloud(96);
    this.sparkLife = new Float32Array(96);
    this.group.add(this.sparks.points);
  }

  get object(): THREE.Group {
    return this.group;
  }

  private makeLine(): { line: THREE.Line; pos: Float32Array; col: Float32Array; alpha: Float32Array } {
    const geo = new THREE.BufferGeometry();
    const pos = new Float32Array(MAX_POINTS * 3);
    const col = new Float32Array(MAX_POINTS * 3);
    const alpha = new Float32Array(MAX_POINTS);
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    geo.setAttribute('alpha', new THREE.BufferAttribute(alpha, 1));
    const line = new THREE.Line(geo, this.mat);
    line.frustumCulled = false;
    line.visible = false;
    return { line, pos, col, alpha };
  }

  /** Public entry: emits a bolt and (when intense enough) branching side-arcs + sparks. */
  spawn(from: THREE.Vector3, to: THREE.Vector3, color: THREE.Color, intensity: number, lifeMs = 95): void {
    this.emit(from, to, color, intensity, lifeMs);
    this.emitSparks(from, color, intensity);
    this.emitSparks(to, color, intensity);

    if (intensity > 0.5) {
      const dir = to.clone().sub(from);
      const perp = new THREE.Vector3(-dir.y, dir.x, 0).normalize();
      const mid = from.clone().lerp(to, 0.5 + (Math.random() - 0.5) * 0.3);
      const target = mid
        .clone()
        .addScaledVector(perp, (Math.random() - 0.5) * dir.length() * 0.9)
        .addScaledVector(dir, (Math.random() - 0.5) * 0.25);
      this.emit(mid, target, color, intensity * 0.45, lifeMs * 0.55);

      if (intensity > 0.95 && Math.random() < 0.6) {
        const mid2 = from.clone().lerp(to, 0.75);
        const target2 = mid2.clone().addScaledVector(perp, (Math.random() - 0.5) * dir.length() * 0.7);
        this.emit(mid2, target2, color, intensity * 0.32, lifeMs * 0.45);
      }
    }
  }

  private emit(from: THREE.Vector3, to: THREE.Vector3, color: THREE.Color, intensity: number, lifeMs: number): void {
    const bolt = this.pool[this.cursor];
    this.cursor = (this.cursor + 1) % this.pool.length;

    const corePts = generateBolt(from, to, 0.24, LEVELS);
    const haloPts = generateBolt(from, to, 0.4, LEVELS);
    bolt.coreCount = corePts.length;
    bolt.haloCount = haloPts.length;

    this.writeLine(bolt.corePos, bolt.coreCol, bolt.coreAlpha, corePts, 1, 1, 1);
    this.writeLine(bolt.haloPos, bolt.haloCol, bolt.haloAlpha, haloPts, color.r, color.g, color.b);

    bolt.core.geometry.setDrawRange(0, corePts.length);
    bolt.halo.geometry.setDrawRange(0, haloPts.length);
    bolt.core.geometry.attributes.position.needsUpdate = true;
    bolt.core.geometry.attributes.color.needsUpdate = true;
    bolt.core.geometry.attributes.alpha.needsUpdate = true;
    bolt.halo.geometry.attributes.position.needsUpdate = true;
    bolt.halo.geometry.attributes.color.needsUpdate = true;
    bolt.halo.geometry.attributes.alpha.needsUpdate = true;

    bolt.core.visible = true;
    bolt.halo.visible = true;
    bolt.active = true;
    bolt.life = lifeMs;
    bolt.maxLife = lifeMs;
    bolt.intensity = clamp(intensity, 0.05, 2.5);
  }

  private writeLine(
    pos: Float32Array,
    col: Float32Array,
    alpha: Float32Array,
    pts: THREE.Vector3[],
    r: number,
    g: number,
    b: number,
  ): void {
    for (let i = 0; i < MAX_POINTS; i++) {
      const p = pts[Math.min(i, pts.length - 1)];
      pos[i * 3] = p.x;
      pos[i * 3 + 1] = p.y;
      pos[i * 3 + 2] = p.z;
      col[i * 3] = r;
      col[i * 3 + 1] = g;
      col[i * 3 + 2] = b;
      alpha[i] = 0;
    }
  }

  private emitSparks(at: THREE.Vector3, color: THREE.Color, intensity: number): void {
    const n = Math.floor(2 + intensity * 2);
    for (let k = 0; k < n; k++) {
      for (let i = 0; i < this.sparks.count; i++) {
        if (this.sparkLife[i] > 0) continue;
        setParticle(this.sparks, i, at.x, at.y, at.z);
        const a = Math.random() * Math.PI * 2;
        const sp = 0.5 + Math.random() * 2.2;
        this.sparks.velocities[i * 3] = Math.cos(a) * sp;
        this.sparks.velocities[i * 3 + 1] = Math.sin(a) * sp;
        this.sparks.velocities[i * 3 + 2] = (Math.random() - 0.5) * 1.2;
        this.sparkLife[i] = 0.18 + Math.random() * 0.22;
        this.sparks.sizes[i] = 1.5 + Math.random() * 2.5;
        setParticleColor(this.sparks, i, color.r * 1.2, color.g * 1.2, color.b * 1.2);
        this.sparks.alphas[i] = 0.8 * intensity;
        break;
      }
    }
  }

  update(dtMs: number): void {
    for (const b of this.pool) {
      if (!b.active) continue;
      b.life -= dtMs;
      if (b.life <= 0) {
        b.active = false;
        b.core.visible = false;
        b.halo.visible = false;
        continue;
      }
      const t = clamp(b.life / b.maxLife, 0, 1);
      const flicker = 0.55 + 0.45 * Math.sin(performance.now() * 0.07 + b.maxLife * 7);
      const coreA = t * b.intensity * (0.85 + flicker * 0.35);
      const haloA = t * b.intensity * 0.4 * flicker;
      for (let i = 0; i < b.coreCount; i++) b.coreAlpha[i] = coreA;
      for (let i = 0; i < b.haloCount; i++) b.haloAlpha[i] = haloA;
      b.core.geometry.attributes.alpha.needsUpdate = true;
      b.halo.geometry.attributes.alpha.needsUpdate = true;
    }

    // sparks
    for (let i = 0; i < this.sparks.count; i++) {
      if (this.sparkLife[i] <= 0) {
        this.sparks.alphas[i] = 0;
        continue;
      }
      this.sparkLife[i] -= dtMs / 1000;
      const i3 = i * 3;
      this.sparks.positions[i3] += this.sparks.velocities[i3] * dtMs * 0.001;
      this.sparks.positions[i3 + 1] += this.sparks.velocities[i3 + 1] * dtMs * 0.001;
      this.sparks.positions[i3 + 2] += this.sparks.velocities[i3 + 2] * dtMs * 0.001;
      this.sparks.velocities[i3] *= Math.pow(0.9, dtMs * 0.06);
      this.sparks.velocities[i3 + 1] *= Math.pow(0.9, dtMs * 0.06);
      const lifeT = clamp(this.sparkLife[i] / 0.4, 0, 1);
      this.sparks.alphas[i] = lifeT * 0.7;
    }
    this.sparks.geometry.attributes.position.needsUpdate = true;
    this.sparks.geometry.attributes.alpha.needsUpdate = true;
    this.sparks.geometry.attributes.size.needsUpdate = true;
    this.sparks.geometry.attributes.color.needsUpdate = true;
  }

  clear(): void {
    for (const b of this.pool) {
      b.active = false;
      b.core.visible = false;
      b.halo.visible = false;
    }
    this.sparkLife.fill(0);
    this.sparks.alphas.fill(0);
  }
}

function generateBolt(
  a: THREE.Vector3,
  b: THREE.Vector3,
  roughness: number,
  levels: number,
): THREE.Vector3[] {
  const dir = new THREE.Vector3().subVectors(b, a);
  const len = dir.length() || 1;
  const perp = new THREE.Vector3(-dir.y, dir.x, 0).normalize();

  let pts: THREE.Vector3[] = [a.clone(), b.clone()];
  for (let level = 0; level < levels; level++) {
    const next: THREE.Vector3[] = [];
    const amp = roughness * (1 - level / levels);
    for (let i = 0; i < pts.length - 1; i++) {
      const p0 = pts[i];
      const p1 = pts[i + 1];
      next.push(p0);
      const mid = new THREE.Vector3().addVectors(p0, p1).multiplyScalar(0.5);
      mid.addScaledVector(perp, (Math.random() - 0.5) * len * amp);
      mid.z += (Math.random() - 0.5) * 0.14;
      next.push(mid);
    }
    next.push(pts[pts.length - 1]);
    pts = next;
  }
  return pts;
}
