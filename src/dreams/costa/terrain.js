import * as THREE from 'three';
import { createNoise2D, clamp } from '../../core/noise.js';

// La costa: una lunga scogliera sul mare, una pista sterrata in cima
// all'altopiano (dove atterra l'aereo) e, in fondo, una baia con la spiaggia.
// Il mare è a sud (z positiva); x va da ovest a est.
export const X0 = -1400;
export const X1 = 1300;
export const Z0 = -700;
export const Z1 = 350;
const CELL = 2;
const NX = (X1 - X0) / CELL + 1;
const NZ = (Z1 - Z0) / CELL + 1;

// la baia della spiaggia
export const BAY = { x: 620, w: 150, depth: 70 };
// la pista d'atterraggio, sull'altopiano
export const STRIP = { minX: -950, maxX: -650, z: -160, halfW: 14 };
const STRIP_FLAT = { minX: -985, maxX: -620, minZ: -200, maxZ: -118 };
// il parcheggio dietro la spiaggia (in coordinate "d" = distanza dalla riva)
export const LOT = { d0: 66, d1: 104, hw: 75 };
export const ROAD_HW = 4.2;

const smooth = (a, b, x) => {
  const t = clamp((x - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};

export function coveAt(x) {
  return Math.exp(-(((x - BAY.x) / BAY.w) ** 2));
}

// la riva: z della linea dell'acqua
export function coastZ(x) {
  return 20 * Math.sin(x * 0.0045) + 12 * Math.sin(x * 0.013 + 1.3) - BAY.depth * coveAt(x);
}

// i punti di controllo della sterrata (anche per la mappa)
export function roadControl() {
  const ctrl = [
    [-660, -150], [-640, -128], [-622, -98], [-604, -70],
  ];
  for (let x = -580; x <= 440; x += 30) ctrl.push([x, coastZ(x) - 34 - 9 * Math.sin(x * 0.017)]);
  ctrl.push([478, -64], [510, -86], [545, -108], [580, -126], [620, coastZ(620) - LOT.d0 - 14]);
  return ctrl;
}

export class CoastTerrain {
  constructor(seed = 77) {
    this.noise = createNoise2D(seed);
    this.noise2 = createNoise2D(seed + 9);
    this.h = new Float32Array(NX * NZ);
    this.buildRoad();
    this.bake();
  }

  // il profilo "naturale", prima che la strada e la pista lo scavino
  natural(x, z) {
    const n = this.noise;
    const d = coastZ(x) - z;
    const bay = 1 - smooth(140, 265, Math.abs(x - BAY.x));
    const top = 26 + 8 * n(x * 0.004, 3.7);
    const hills = Math.max(0, d - 70) * 0.1 * (0.7 + 0.3 * n(x * 0.008, z * 0.008)) + n(x * 0.02, z * 0.02) * 1.4 * smooth(12, 40, d);
    const cliff = d < 0 ? Math.max(-26, -5 + d * 0.05) : top * smooth(0, 9, d) + hills + (d < 9 ? n(x * 0.15, z * 0.15) * 1.2 : 0);
    let beach;
    if (d < 0) beach = Math.max(-26, d * 0.05);
    else if (d < 56) beach = d * 0.045;
    else beach = 2.52 + smooth(56, 170, d) * (top - 2.52) + hills * smooth(80, 170, d);
    let h = cliff + (beach - cliff) * bay;
    // la pista dell'aereo, spianata
    const f = STRIP_FLAT;
    const ox = Math.max(f.minX - x, 0, x - f.maxX);
    const oz = Math.max(f.minZ - z, 0, z - f.maxZ);
    const w = 1 - smooth(0, 30, Math.hypot(ox, oz));
    if (w > 0) h += (this.stripH - h) * w;
    return h;
  }

  // la strada sterrata: dalla pista lungo la scogliera, poi giù nella baia
  buildRoad() {
    this.stripH = 0;
    // l'altezza della pista: quella naturale al suo centro
    const n = this.noise;
    const cx = (STRIP.minX + STRIP.maxX) / 2;
    const d = coastZ(cx) - STRIP.z;
    this.stripH = (26 + 8 * n(cx * 0.004, 3.7)) + Math.max(0, d - 70) * 0.1 * 0.7;
    const ctrl = roadControl();
    this.lotEnd = ctrl.length - 1;
    // Catmull-Rom, un punto ogni 3 m
    const pts = [];
    for (let i = 0; i < ctrl.length - 1; i++) {
      const p0 = ctrl[Math.max(0, i - 1)];
      const p1 = ctrl[i];
      const p2 = ctrl[i + 1];
      const p3 = ctrl[Math.min(ctrl.length - 1, i + 2)];
      const len = Math.hypot(p2[0] - p1[0], p2[1] - p1[1]);
      const steps = Math.max(2, Math.round(len / 3));
      for (let s = 0; s < steps; s++) {
        const t = s / steps;
        const t2 = t * t;
        const t3 = t2 * t;
        const cr = (a, b, c, e) => 0.5 * (2 * b + (-a + c) * t + (2 * a - 5 * b + 4 * c - e) * t2 + (-a + 3 * b - 3 * c + e) * t3);
        pts.push({ x: cr(p0[0], p1[0], p2[0], p3[0]), z: cr(p0[1], p1[1], p2[1], p3[1]) });
      }
    }
    pts.push({ x: ctrl[ctrl.length - 1][0], z: ctrl[ctrl.length - 1][1] });
    // altezze: quelle naturali, lisciate lungo la strada
    const raw = pts.map((p) => this.natural(p.x, p.z));
    let s = 0;
    pts.forEach((p, i) => {
      const a = pts[Math.max(0, i - 1)];
      const b = pts[Math.min(pts.length - 1, i + 1)];
      const l = Math.hypot(b.x - a.x, b.z - a.z) || 1;
      p.tx = (b.x - a.x) / l;
      p.tz = (b.z - a.z) / l;
      if (i) s += Math.hypot(p.x - pts[i - 1].x, p.z - pts[i - 1].z);
      p.s = s;
      let sum = 0;
      let cnt = 0;
      for (let k = -22; k <= 22; k++) {
        const j = clamp(i + k, 0, pts.length - 1);
        sum += raw[j];
        cnt++;
      }
      p.y = sum / cnt;
    });
    this.road = pts;
    this.roadLength = s;
    // indice spaziale dei segmenti
    this.bucket = new Map();
    const B = 32;
    this.B = B;
    for (let i = 0; i < pts.length - 1; i++) {
      const a = pts[i];
      const b = pts[i + 1];
      const r = ROAD_HW + 16;
      for (let bx = Math.floor((Math.min(a.x, b.x) - r) / B); bx <= Math.floor((Math.max(a.x, b.x) + r) / B); bx++) {
        for (let bz = Math.floor((Math.min(a.z, b.z) - r) / B); bz <= Math.floor((Math.max(a.z, b.z) + r) / B); bz++) {
          const k = bx * 10007 + bz;
          if (!this.bucket.has(k)) this.bucket.set(k, []);
          this.bucket.get(k).push(i);
        }
      }
    }
  }

  // il punto di strada più vicino: { dist, idx, y }
  roadInfo(x, z) {
    const list = this.bucket.get(Math.floor(x / this.B) * 10007 + Math.floor(z / this.B));
    let best = { dist: Infinity, idx: -1, y: 0 };
    if (!list) return best;
    const P = this.road;
    for (const i of list) {
      const a = P[i];
      const b = P[i + 1];
      const ex = b.x - a.x;
      const ez = b.z - a.z;
      const l2 = ex * ex + ez * ez || 1;
      const t = clamp(((x - a.x) * ex + (z - a.z) * ez) / l2, 0, 1);
      const px = a.x + ex * t;
      const pz = a.z + ez * t;
      const dd = Math.hypot(x - px, z - pz);
      if (dd < best.dist) best = { dist: dd, idx: t < 0.5 ? i : i + 1, y: a.y + (b.y - a.y) * t };
    }
    return best;
  }

  // il parcheggio dietro la spiaggia: un piano di terra battuta
  lotWeight(x, z) {
    const d = coastZ(x) - z;
    const ox = Math.max(Math.abs(x - BAY.x) - LOT.hw, 0);
    const od = Math.max(LOT.d0 - d, 0, d - LOT.d1);
    return 1 - smooth(0, 14, Math.hypot(ox, od));
  }

  bake() {
    const n2 = this.noise2;
    this.lotH = this.natural(BAY.x, coastZ(BAY.x) - (LOT.d0 + LOT.d1) / 2);
    this.lotH = Math.max(this.lotH, 3.4);
    for (let j = 0; j < NZ; j++) {
      const z = Z0 + j * CELL;
      for (let i = 0; i < NX; i++) {
        const x = X0 + i * CELL;
        let h = this.natural(x, z);
        const lw = this.lotWeight(x, z);
        if (lw > 0) h += (this.lotH - h) * lw;
        const r = this.roadInfo(x, z);
        if (r.dist < ROAD_HW + 14) {
          const w = 1 - smooth(ROAD_HW, ROAD_HW + 14, r.dist);
          // lo sterrato: buche e ondulazioni
          const bumps = r.dist < ROAD_HW + 1 ? n2(x * 0.22, z * 0.22) * 0.13 + Math.max(0, n2(x * 0.6 + 40, z * 0.6) - 0.55) * -0.5 : 0;
          h += (r.y + bumps - h) * w;
        }
        this.h[j * NX + i] = h;
      }
    }
  }

  heightAt(x, z) {
    const fx = clamp((x - X0) / CELL, 0, NX - 1.001);
    const fz = clamp((z - Z0) / CELL, 0, NZ - 1.001);
    const i = Math.floor(fx);
    const j = Math.floor(fz);
    const u = fx - i;
    const v = fz - j;
    const k = j * NX + i;
    const H = this.h;
    return (H[k] * (1 - u) + H[k + 1] * u) * (1 - v) + (H[k + NX] * (1 - u) + H[k + NX + 1] * u) * v;
  }

  normalAt(x, z, out = new THREE.Vector3(), e = 2) {
    const hx = this.heightAt(x + e, z) - this.heightAt(x - e, z);
    const hz = this.heightAt(x, z + e) - this.heightAt(x, z - e);
    return out.set(-hx, 2 * e, -hz).normalize();
  }

  surfaceAt(x, z) {
    if (this.roadInfo(x, z).dist < ROAD_HW + 0.5) return 'dirt';
    if (this.lotWeight(x, z) > 0.5) return 'dirt';
    if (x > STRIP.minX && x < STRIP.maxX && Math.abs(z - STRIP.z) < STRIP.halfW) return 'dirt';
    return 'grass';
  }
}
