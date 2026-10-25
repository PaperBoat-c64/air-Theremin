import * as THREE from 'three';
import {
  createParticleCloud,
  ParticleBuffers,
  randomRange,
  setParticle,
  setParticleColor,
} from './common';

interface Nebula {
  mesh: THREE.Mesh;
  drift: number;
  phase: number;
}

/** Deep-space backdrop: layered stars with twinkle + drifting nebula glows. */
export class Starfield {
  private group = new THREE.Group();
  private stars: ParticleBuffers;
  private seeds: Float32Array;
  private baseAlphas: Float32Array;
  private nebulas: Nebula[] = [];

  constructor() {
    const N = 1500;
    this.stars = createParticleCloud(N);
    this.seeds = new Float32Array(N);
    this.baseAlphas = new Float32Array(N);
    for (let i = 0; i < N; i++) {
      this.seeds[i] = Math.random() * Math.PI * 2;
      const depth = randomRange(3, 14);
      const spread = depth * 2.2;
      setParticle(
        this.stars,
        i,
        randomRange(-spread, spread),
        randomRange(-spread, spread),
        -depth,
      );
      const blue = Math.random();
      const r = 0.7 + blue * 0.25;
      const g = 0.75 + blue * 0.22;
      const b = 0.95;
      setParticleColor(this.stars, i, r, g, b);
      this.stars.sizes[i] = randomRange(1.2, 3.2);
      this.stars.alphas[i] = randomRange(0.2, 0.9);
      this.baseAlphas[i] = this.stars.alphas[i];
    }
    this.stars.geometry.attributes.position.needsUpdate = true;
    this.stars.geometry.attributes.color.needsUpdate = true;
    this.stars.geometry.attributes.size.needsUpdate = true;
    this.stars.geometry.attributes.alpha.needsUpdate = true;
    this.group.add(this.stars.points);

    // nebulas
    const nebulaColors = [
      new THREE.Color(0.16, 0.2, 0.55),
      new THREE.Color(0.3, 0.16, 0.45),
      new THREE.Color(0.1, 0.28, 0.42),
    ];
    for (let i = 0; i < 3; i++) {
      const tex = makeNebulaTexture();
      const mat = new THREE.MeshBasicMaterial({
        map: tex,
        transparent: true,
        depthWrite: false,
        depthTest: false,
        blending: THREE.AdditiveBlending,
        opacity: 0.16,
      });
      const geo = new THREE.PlaneGeometry(18, 12);
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.set(randomRange(-8, 8), randomRange(-4, 4), -11);
      mesh.material.color = nebulaColors[i % nebulaColors.length];
      this.group.add(mesh);
      this.nebulas.push({
        mesh,
        drift: randomRange(0.02, 0.06),
        phase: randomRange(0, Math.PI * 2),
      });
    }
  }

  get object(): THREE.Group {
    return this.group;
  }

  update(time: number, dt: number, intensity: number): void {
    this.group.rotation.y = time * 0.006;
    this.group.rotation.x = Math.sin(time * 0.02) * 0.03;

    // twinkle
    const alphas = this.stars.alphas;
    for (let i = 0; i < this.stars.count; i++) {
      const tw = 0.65 + 0.35 * Math.sin(time * 1.4 + this.seeds[i] * 7.0);
      alphas[i] = this.baseAlphas[i] * tw;
    }
    this.stars.geometry.attributes.alpha.needsUpdate = true;

    for (const n of this.nebulas) {
      n.mesh.position.x += Math.sin(time * n.drift + n.phase) * dt * 0.4;
      n.mesh.position.y += Math.cos(time * n.drift * 0.7 + n.phase) * dt * 0.3;
      n.mesh.rotation.z += dt * n.drift * 0.2;
      const m = n.mesh.material as THREE.MeshBasicMaterial;
      m.opacity = 0.12 + intensity * 0.08 + Math.sin(time * 0.3 + n.phase) * 0.02;
    }
  }
}

function makeNebulaTexture(): THREE.Texture {
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const g = canvas.getContext('2d')!;
  const grad = g.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  grad.addColorStop(0, 'rgba(255,255,255,0.9)');
  grad.addColorStop(0.4, 'rgba(255,255,255,0.35)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, size, size);
  const tex = new THREE.CanvasTexture(canvas);
  tex.needsUpdate = true;
  return tex;
}
