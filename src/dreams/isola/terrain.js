import * as THREE from 'three';
import { createNoise2D, clamp } from '../../core/noise.js';

// L'isola: una montagna a terrazze (con una rampa, poi colonne di roccia da
// saltare, poi un fungo che fa rimbalzare fino in cima), un capo con il faro,
// una laguna con i sassi per arrivare all'isolotto, le rovine, il villaggio
// con la pista e l'hangar, un pontile. Il mare intorno, ovunque.
export const EXT = 360; // la griglia copre [-EXT, EXT]
const CELL = 1.5;
const N = Math.round((EXT * 2) / CELL) + 1;

export const M = { x: 20, z: -50 }; // la montagna
export const TERRACES = [
  { r: 125, h: 14 },
  { r: 92, h: 26 },
  { r: 60, h: 38 },
  { r: 30, h: 50 },
];
export const VILLAGE = { minX: -80, maxX: 160, minZ: 120, maxZ: 188 };
export const STRIP = { minX: -40, maxX: 150, z: 172, halfW: 9 };
export const RUINS = { x: -120, z: -160 };
export const PIER_X = -118;

const smooth = (a, b, x) => {
  const t = clamp((x - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};
const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));

export function shoreR(th) {
  return 235 + 22 * Math.sin(3 * th + 0.7) + 14 * Math.sin(5 * th + 2) + 45 * Math.exp(-((wrap(th - 0.15) / 0.16) ** 2)) - 80 * Math.exp(-((wrap(th - Math.PI) / 0.3) ** 2));
}
export function shoreDist(x, z) {
  return shoreR(Math.atan2(z, x)) - Math.hypot(x, z);
}

// il faro, sul capo a est; l'isolotto, nella laguna a ovest
export const LIGHT = (() => {
  const r = shoreR(0.15) - 22;
  return { x: Math.cos(0.15) * r, z: Math.sin(0.15) * r, r: 3.6, top: 0 };
})();
export const ISLET = (() => {
  const r = shoreR(Math.PI) + 42;
  return { x: -r, z: 0, r: 11 };
})();

export class IslandTerrain {
  constructor(seed = 31) {
    this.noise = createNoise2D(seed);
    this.ramps = [];
    this.h = new Float32Array(N * N);
    this.flatH = 0;
    this.layoutRamps();
    this.flatH = this.base(30, 150);
    this.bake();
    this.platforms = [];
    this.cyls = []; // ostacoli cilindrici (la torre del faro)
    this.pads = [];
    this.grid = new Map();
    this.layoutPlatforms();
  }

  base(x, z) {
    const n = this.noise;
    const s = shoreDist(x, z);
    let h;
    if (s < 0) h = Math.max(-14, s * 0.2) - 0.5;
    else if (s < 18) h = s * 0.11 - 0.5 * (1 - smooth(0, 4, s));
    else h = 1.98 + smooth(18, 70, s) * 6 + n(x * 0.015, z * 0.015) * 1.6 * smooth(18, 60, s);
    // l'isolotto della laguna
    const di = Math.hypot(x - ISLET.x, z - ISLET.z);
    if (di < ISLET.r + 8) h = Math.max(h, 1.8 * (1 - smooth(ISLET.r - 5, ISLET.r + 6, di)) - 0.6 * smooth(ISLET.r, ISLET.r + 8, di));
    return h;
  }

  layoutRamps() {
    // A: dal prato al primo gradone, sul lato sud
    const a0 = { x: M.x, z: M.z + 158 };
    this.ramps.push({ pts: [{ ...a0, y: null }, { x: M.x, z: M.z + 121, y: 14.2 }], w: 5 });
    // B: lungo la parete, dal primo al secondo gradone, sul lato est
    const pts = [];
    const n = 18;
    for (let i = 0; i <= n; i++) {
      const a = -0.35 + (i / n) * 0.75;
      pts.push({ x: M.x + Math.cos(a) * 99, z: M.z + Math.sin(a) * 99, y: 14 + (i / n) * 12.2 });
    }
    const last = pts[pts.length - 1];
    const al = -0.35 + 0.75;
    pts.push({ x: M.x + Math.cos(al) * 86, z: M.z + Math.sin(al) * 86, y: 26.2 });
    void last;
    this.ramps.push({ pts, w: 4.2 });
  }

  rampAt(x, z) {
    let best = -Infinity;
    for (const r of this.ramps) {
      for (let i = 0; i < r.pts.length - 1; i++) {
        const a = r.pts[i];
        const b = r.pts[i + 1];
        const ex = b.x - a.x;
        const ez = b.z - a.z;
        const l2 = ex * ex + ez * ez;
        const t = clamp(((x - a.x) * ex + (z - a.z) * ez) / l2, 0, 1);
        const d = Math.hypot(x - (a.x + ex * t), z - (a.z + ez * t));
        if (d > r.w + 1.5) continue;
        const ay = a.y ?? this.base(a.x, a.z);
        const y = ay + (b.y - ay) * t;
        const k = 1 - smooth(r.w, r.w + 1.5, d);
        best = Math.max(best, y - (1 - k) * 3);
      }
    }
    return best;
  }

  natural(x, z) {
    let h = this.base(x, z);
    const rr = Math.hypot(x - M.x, z - M.z);
    for (const t of TERRACES) {
      if (rr < t.r + 2) h = Math.max(h, t.h * (1 - smooth(t.r - 2.5, t.r + 1.2, rr)) + (rr < t.r - 3 ? this.noise(x * 0.05, z * 0.05) * 0.25 : 0));
    }
    h = Math.max(h, this.rampAt(x, z));
    // il villaggio e la pista: spianati
    const V = VILLAGE;
    const ox = Math.max(V.minX - x, 0, x - V.maxX);
    const oz = Math.max(V.minZ - z, 0, z - V.maxZ);
    const w = 1 - smooth(0, 22, Math.hypot(ox, oz));
    if (w > 0) h += (this.flatH - h) * w;
    return h;
  }

  bake() {
    for (let j = 0; j < N; j++) {
      const z = -EXT + j * CELL;
      for (let i = 0; i < N; i++) {
        const x = -EXT + i * CELL;
        this.h[j * N + i] = this.natural(x, z);
      }
    }
  }

  heightAt(x, z) {
    const fx = (x + EXT) / CELL;
    const fz = (z + EXT) / CELL;
    if (fx < 0 || fz < 0 || fx >= N - 1 || fz >= N - 1) return -14.5;
    const i = Math.floor(fx);
    const j = Math.floor(fz);
    const u = fx - i;
    const v = fz - j;
    const k = j * N + i;
    const H = this.h;
    return (H[k] * (1 - u) + H[k + 1] * u) * (1 - v) + (H[k + N] * (1 - u) + H[k + N + 1] * u) * v;
  }

  normalAt(x, z, out = new THREE.Vector3(), e = 1.5) {
    const hx = this.heightAt(x + e, z) - this.heightAt(x - e, z);
    const hz = this.heightAt(x, z + e) - this.heightAt(x, z - e);
    return out.set(-hx, 2 * e, -hz).normalize();
  }

  // ---------- Le piattaforme ----------
  addPlatform(p) {
    this.platforms.push(p);
    const r = p.r1 ?? p.r ?? 0;
    const minX = p.minX ?? p.x - r;
    const maxX = p.maxX ?? p.x + r;
    const minZ = p.minZ ?? p.z - r;
    const maxZ = p.maxZ ?? p.z + r;
    for (let gx = Math.floor(minX / 8); gx <= Math.floor(maxX / 8); gx++) {
      for (let gz = Math.floor(minZ / 8); gz <= Math.floor(maxZ / 8); gz++) {
        const k = gx * 4099 + gz;
        if (!this.grid.has(k)) this.grid.set(k, []);
        this.grid.get(k).push(p);
      }
    }
    return p;
  }

  inside(p, x, z) {
    if (p.minX !== undefined) return x > p.minX && x < p.maxX && z > p.minZ && z < p.maxZ;
    const d = Math.hypot(x - p.x, z - p.z);
    if (p.r1 !== undefined) return d > p.r0 && d < p.r1;
    return d < p.r;
  }

  // il pavimento sotto i piedi: il terreno, o una piattaforma se ci sei sopra
  support(x, z, y = Infinity) {
    let g = this.heightAt(x, z);
    const list = this.grid.get(Math.floor(x / 8) * 4099 + Math.floor(z / 8));
    if (list) for (const p of list) if (p.top > g && p.top <= y + 0.65 && this.inside(p, x, z)) g = p.top;
    return g;
  }

  // la piattaforma più alta sotto un punto (anche se sei sotto): per le ombre e la camera
  platformAt(x, z) {
    const list = this.grid.get(Math.floor(x / 8) * 4099 + Math.floor(z / 8));
    let best = null;
    if (list) for (const p of list) if (this.inside(p, x, z) && (!best || p.top > best.top)) best = p;
    return best;
  }

  layoutPlatforms() {
    // le colonne di roccia dal secondo al terzo gradone, a spirale
    this.pillars = [];
    for (let i = 1; i <= 14; i++) {
      const a = 2.15 + i * 0.042;
      const rr = 75 - i * 1.22;
      const x = M.x + Math.cos(a) * rr;
      const z = M.z + Math.sin(a) * rr;
      const top = 26 + i * 0.88;
      this.pillars.push(this.addPlatform({ minX: x - 0.95, maxX: x + 0.95, minZ: z - 0.95, maxZ: z + 0.95, top, bottom: 25, kind: 'pillar', solid: true }));
    }
    // il fungo che ti lancia in cima
    const pa = -0.7;
    this.pads.push({ x: M.x + Math.cos(pa) * 41, z: M.z + Math.sin(pa) * 41, y: 38, r: 1.6, power: 24, kind: 'summit' });
    // un fungo nel prato, per una scia di monete in aria
    this.pads.push({ x: -40, z: 60, y: this.heightAt(-40, 60), r: 1.6, power: 16, kind: 'meadow' });

    // il faro: la torre e la scala a chiocciola intorno
    const L = LIGHT;
    const gy = this.heightAt(L.x, L.z);
    L.y = gy;
    L.top = gy + 24;
    this.cyls.push({ x: L.x, z: L.z, r: L.r, top: L.top + 4 });
    this.lightSteps = [];
    const steps = Math.ceil(24 / 0.5);
    for (let i = 1; i <= steps; i++) {
      const a = Math.PI + i * 0.42;
      const x = L.x + Math.cos(a) * 5.3;
      const z = L.z + Math.sin(a) * 5.3;
      this.lightSteps.push(this.addPlatform({ x, z, r: 1.15, top: gy + i * 0.5, kind: 'step', a }));
    }
    this.balcony = this.addPlatform({ x: L.x, z: L.z, r0: L.r - 0.2, r1: 6.6, top: L.top + 0.01, kind: 'balcony' });
    this.cyls.push({ x: L.x, z: L.z, r: 6.9, top: L.top + 1.3, rail: true, minY: L.top - 0.5 });

    // i sassi della laguna
    this.stones = [];
    const ax = -(shoreR(Math.PI) - 7);
    const n = 14;
    for (let i = 0; i < n; i++) {
      const t = (i + 1) / (n + 1);
      const x = ax + (ISLET.x + ISLET.r - 2 - ax) * t;
      const z = Math.sin(i * 1.3) * 1.4;
      const top = 0.55 + (i % 3) * 0.35;
      this.stones.push(this.addPlatform({ x, z, r: 1.15, top, kind: 'stone' }));
    }

    // le rovine: casse una sopra l'altra, e una colonna con gli occhiali
    const R = RUINS;
    const ry = this.heightAt(R.x, R.z);
    this.crates = [];
    const crateAt = (x, z, top) => this.crates.push(this.addPlatform({ minX: x - 0.75, maxX: x + 0.75, minZ: z - 0.75, maxZ: z + 0.75, top, bottom: top - 1.2, kind: 'crate', solid: true }));
    crateAt(R.x + 4, R.z + 3, ry + 1.2);
    crateAt(R.x + 2.2, R.z + 1.2, ry + 2.4);
    crateAt(R.x + 0.4, R.z - 0.6, ry + 3.6);
    this.column = this.addPlatform({ x: R.x - 1.6, z: R.z - 2.6, r: 0.9, top: ry + 4.9, bottom: ry, kind: 'column', solid: true });
    this.ruinsY = ry;

    // il pontile
    let pz = 150;
    while (this.heightAt(PIER_X, pz) > 1.1 && pz < 260) pz += 0.5;
    this.pier = this.addPlatform({ minX: PIER_X - 3, maxX: PIER_X + 3, minZ: pz, maxZ: pz + 60, top: 1.35, kind: 'pier' });
  }
}
