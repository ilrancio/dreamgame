import * as THREE from 'three';
import { createNoise2D, fbm, ridged, smoothstep, clamp } from '../../core/noise.js';
import { asphaltTexture } from '../../core/textures.js';

// Mappa del sogno (metri). Il campo è un'ellisse circondata da montagne;
// la strada parte dal bordo nord del campo e sale fino all'hotel.
export const SIZE = 3200;
export const HALF = SIZE / 2;
export const RES = 512;
const CELL = SIZE / RES;
const N = RES + 1;

export const FIELD = { cx: 0, cz: -250, rx: 820, rz: 720 };
export const START = { x: 120, z: -850, heading: 0.12 };
export const DEMON_POS = { x: -430, z: -80 };
export const HOTEL = { x: -80, z: 1330, plateau: 215 };
// Il borgo in vetta: la strada, oltre l'hotel, continua a salire fin quassù.
export const VILLAGE = { x: 380, z: 1180, plateau: 420, r: 130 };
// Il centro commerciale: una conca piatta a ovest dell'hotel, in fondo a una strada.
export const MALL = { x: -600, z: 1215, plateau: 200, r: 150 };
// L'aeroporto: una spianata giù nel campo, verso est, con la pista.
export const AIRPORT = { x: 520, z: -420, rx: 240, rz: 150 };
export const ROAD_HALF = 7;
const ROAD_FLAT = 19;
const ROAD_BLEND = 48;

const ROAD_POINTS = [
  [250, 300],
  [262, 470],
  [300, 600],
  [420, 690],
  [560, 740],
  [620, 840],
  [560, 940],
  [420, 930],
  [300, 860],
  [170, 880],
  [110, 990],
  [170, 1090],
  [60, 1150],
  [-90, 1090],
  [-200, 1130],
  [-130, 1180],
  [-85, 1228],
];

// Il tratto che dal parcheggio dell'hotel sale al borgo, a tornanti.
const UPPER_POINTS = [
  [-20, 1255],
  [70, 1215],
  [160, 1250],
  [150, 1340],
  [240, 1400],
  [350, 1440],
  [460, 1400],
  [520, 1300],
  [500, 1210],
  [455, 1180],
];

// Dal piazzale dell'hotel, verso ovest, giù fino al parcheggio del centro commerciale.
const MALL_POINTS = [
  [-115, 1255],
  [-190, 1262],
  [-270, 1245],
  [-350, 1222],
  [-420, 1215],
  [-470, 1215],
];

export class Terrain {
  constructor(seed = 7) {
    this.noise = createNoise2D(seed);
    this.noise2 = createNoise2D(seed + 101);
    this.heights = new Float32Array(N * N);
    this.roadDist = new Float32Array(N * N).fill(1e9);
    this.roadIdx = new Int32Array(N * N).fill(-1);
    this.roadH = new Float32Array(N * N);
    this.airH = null;
    this.airH = this.natural(AIRPORT.x, AIRPORT.z);

    this.buildRoadCurve();
    this.buildHeights();
    this.mesh = this.buildMesh();
    this.roadMesh = this.buildRoadMesh();
  }

  // ---------- Altezze ----------
  fieldEllipse(x, z) {
    const dx = (x - FIELD.cx) / FIELD.rx;
    const dz = (z - FIELD.cz) / FIELD.rz;
    return Math.sqrt(dx * dx + dz * dz);
  }

  natural(x, z) {
    const n = this.noise;
    // colline morbide del campo
    let h = 24 * fbm(n, x / 420, z / 420, 3) + 7 * n(x / 95, z / 95) + 1.5 * n(x / 22, z / 22);
    // montagne tutt'intorno
    const e = this.fieldEllipse(x, z);
    const m = smoothstep(0.93, 1.32, e);
    if (m > 0) {
      const r = ridged(this.noise2, x / 600, z / 600, 4);
      h += m * (220 + 360 * r + 40 * n(x / 180, z / 180));
    }
    // la montagna del borgo: un cono che sale fino all'altopiano della vetta
    const dv = Math.hypot(x - VILLAGE.x, z - VILLAGE.z);
    if (dv < 480) {
      const peak = VILLAGE.plateau - smoothstep(VILLAGE.r, 470, dv) * (VILLAGE.plateau - 120) + 6 * n(x / 40, z / 40) * smoothstep(VILLAGE.r, VILLAGE.r + 60, dv);
      h = Math.max(h, peak);
      const flat = 1 - smoothstep(VILLAGE.r - 15, VILLAGE.r + 25, dv);
      if (flat > 0) h += (VILLAGE.plateau - h) * flat;
    }
    // la conca del centro commerciale, scavata tra le montagne
    const dm = Math.hypot(x - MALL.x, z - MALL.z);
    if (dm < MALL.r + 120) {
      const flat = 1 - smoothstep(MALL.r, MALL.r + 110, dm);
      h += (MALL.plateau - h) * flat;
    }
    // la spianata dell'aeroporto
    if (this.airH !== null) {
      const ea = ((x - AIRPORT.x) / AIRPORT.rx) ** 2 + ((z - AIRPORT.z) / AIRPORT.rz) ** 2;
      if (ea < 1.8) h += (this.airH - h) * (1 - smoothstep(0.9, 1.8, ea));
    }
    // altopiano dell'hotel
    const dh = Math.hypot(x - HOTEL.x, z - HOTEL.z);
    const p = 1 - smoothstep(120, 230, dh);
    if (p > 0) h = h + (HOTEL.plateau - h) * p;
    return h;
  }

  // Due tratti di strada: dal campo all'hotel (quello del prologo) e dall'hotel
  // al borgo in vetta. I campioni stanno in un unico elenco: prima il primo
  // tratto, poi il secondo; `s` continua a crescere lungo tutto il percorso.
  buildRoadCurve() {
    const sample = (points, s0, h0, h1, easeFrom, roadId) => {
      const curve = new THREE.CatmullRomCurve3(points.map(([x, z]) => new THREE.Vector3(x, 0, z)), false, 'centripetal');
      const len = curve.getLength();
      const count = Math.floor(len / 2);
      const pts = curve.getSpacedPoints(count);
      const startH = h0 ?? this.natural(pts[0].x, pts[0].z);
      const out = pts.map((p, i) => {
        const ls = (i / count) * len;
        const t = clamp((ls - easeFrom) / (len - easeFrom - 70), 0, 1);
        // salita con leggero "ease" all'inizio e alla fine
        const e = t * t * (3 - 2 * t) * 0.35 + t * 0.65;
        return { x: p.x, z: p.z, s: s0 + ls, h: startH + (h1 - startH) * e, tx: 0, tz: 1, road: roadId };
      });
      for (let i = 0; i < out.length; i++) {
        const a = out[Math.max(0, i - 1)];
        const b = out[Math.min(out.length - 1, i + 1)];
        const l = Math.hypot(b.x - a.x, b.z - a.z) || 1;
        out[i].tx = (b.x - a.x) / l;
        out[i].tz = (b.z - a.z) / l;
      }
      return { out, len };
    };
    const main = sample(ROAD_POINTS, 0, null, HOTEL.plateau, 150, 0);
    this.roadLength = main.len; // il prologo misura solo il primo tratto
    const upper = sample(UPPER_POINTS, main.len + 40, HOTEL.plateau, VILLAGE.plateau, 30, 1);
    this.upperLength = upper.len;
    this.upperStart = main.out.length;
    const mall = sample(MALL_POINTS, main.len + 40 + upper.len + 40, HOTEL.plateau, MALL.plateau, 20, 2);
    this.mallStart = main.out.length + upper.out.length;
    this.road = main.out.concat(upper.out, mall.out);
  }

  buildHeights() {
    // 1) altezza naturale
    for (let j = 0; j < N; j++) {
      const z = -HALF + j * CELL;
      for (let i = 0; i < N; i++) {
        this.heights[j * N + i] = this.natural(-HALF + i * CELL, z);
      }
    }
    // 2) "timbro" della strada: per ogni cella vicina, il campione più vicino
    const R = ROAD_FLAT + ROAD_BLEND + 2;
    const rc = Math.ceil(R / CELL);
    this.road.forEach((p, idx) => {
      const ci = Math.round((p.x + HALF) / CELL);
      const cj = Math.round((p.z + HALF) / CELL);
      for (let dj = -rc; dj <= rc; dj++) {
        const j = cj + dj;
        if (j < 0 || j >= N) continue;
        for (let di = -rc; di <= rc; di++) {
          const i = ci + di;
          if (i < 0 || i >= N) continue;
          const k = j * N + i;
          const d = Math.hypot(-HALF + i * CELL - p.x, -HALF + j * CELL - p.z);
          if (d < this.roadDist[k]) {
            this.roadDist[k] = d;
            this.roadIdx[k] = idx;
            this.roadH[k] = p.h;
          }
        }
      }
    });
    // 3) fusione: piatto vicino alla strada, raccordo più in là
    for (let k = 0; k < N * N; k++) {
      const d = this.roadDist[k];
      if (d > ROAD_FLAT + ROAD_BLEND) continue;
      const w = 1 - smoothstep(ROAD_FLAT, ROAD_FLAT + ROAD_BLEND, d);
      this.heights[k] += (this.roadH[k] - this.heights[k]) * w;
    }
  }

  heightAt(x, z) {
    const fx = clamp((x + HALF) / CELL, 0, RES - 1e-4);
    const fz = clamp((z + HALF) / CELL, 0, RES - 1e-4);
    const i = Math.floor(fx);
    const j = Math.floor(fz);
    const tx = fx - i;
    const tz = fz - j;
    const H = this.heights;
    const k = j * N + i;
    const a = H[k] + (H[k + 1] - H[k]) * tx;
    const b = H[k + N] + (H[k + N + 1] - H[k + N]) * tx;
    return a + (b - a) * tz;
  }

  normalAt(x, z, out = new THREE.Vector3(), e = 2) {
    const hx = this.heightAt(x + e, z) - this.heightAt(x - e, z);
    const hz = this.heightAt(x, z + e) - this.heightAt(x, z - e);
    return out.set(-hx, 2 * e, -hz).normalize();
  }

  // Punto di strada più vicino: { dist, idx, s }
  roadInfo(x, z) {
    const i = clamp(Math.round((x + HALF) / CELL), 0, RES);
    const j = clamp(Math.round((z + HALF) / CELL), 0, RES);
    const k = j * N + i;
    const guess = this.roadIdx[k];
    if (guess < 0) return { dist: Infinity, idx: -1, s: 0 };
    let best = guess;
    let bestD = Infinity;
    for (let q = Math.max(0, guess - 6); q <= Math.min(this.road.length - 1, guess + 6); q++) {
      const p = this.road[q];
      const d = Math.hypot(x - p.x, z - p.z);
      if (d < bestD) {
        bestD = d;
        best = q;
      }
    }
    return { dist: bestD, idx: best, s: this.road[best].s };
  }

  surfaceAt(x, z, roadDist) {
    if (roadDist < ROAD_HALF + 1.5) return 'road';
    if (roadDist < ROAD_FLAT) return 'dirt';
    if (this.fieldEllipse(x, z) < 1.0) return 'grass';
    return 'rough';
  }

  // ---------- Mesh ----------
  buildMesh() {
    const geo = new THREE.PlaneGeometry(SIZE, SIZE, RES, RES);
    geo.rotateX(-Math.PI / 2);
    const pos = geo.attributes.position;
    for (let k = 0; k < pos.count; k++) pos.setY(k, this.heights[k]);
    geo.computeVertexNormals();

    const colors = new Float32Array(pos.count * 3);
    const nrm = geo.attributes.normal;
    const c = new THREE.Color();
    const grassA = new THREE.Color('#4f7a2a');
    const grassB = new THREE.Color('#8a9a38');
    const grassC = new THREE.Color('#2f5a2a');
    const rock = new THREE.Color('#5a524e');
    const rockDark = new THREE.Color('#3a3436');
    const snow = new THREE.Color('#e8ecf4');
    const dirt = new THREE.Color('#7a6446');
    const flower = new THREE.Color('#b0567a');
    for (let k = 0; k < pos.count; k++) {
      const x = pos.getX(k);
      const z = pos.getZ(k);
      const y = pos.getY(k);
      const slope = 1 - nrm.getY(k);
      const n1 = this.noise(x / 60, z / 60) * 0.5 + 0.5;
      const n2 = this.noise2(x / 13, z / 13) * 0.5 + 0.5;
      c.copy(grassA).lerp(grassB, n1 * 0.8).lerp(grassC, n2 * 0.35);
      if (n2 > 0.86 && this.fieldEllipse(x, z) < 1) c.lerp(flower, 0.5);
      const rockT = smoothstep(0.22, 0.42, slope);
      c.lerp(n2 > 0.5 ? rock : rockDark, rockT);
      const snowT = smoothstep(390, 450, y + n1 * 40) * (1 - smoothstep(0.35, 0.6, slope));
      c.lerp(snow, snowT);
      const rd = this.roadDist[k];
      if (rd < ROAD_FLAT + 4) c.lerp(dirt, 0.8 * (1 - smoothstep(ROAD_FLAT - 6, ROAD_FLAT + 4, rd)));
      colors[k * 3] = c.r;
      colors[k * 3 + 1] = c.g;
      colors[k * 3 + 2] = c.b;
    }
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    const mat = new THREE.MeshLambertMaterial({ vertexColors: true });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.receiveShadow = true;
    return mesh;
  }

  buildRoadMesh() {
    const n = this.road.length;
    const positions = new Float32Array(n * 2 * 3);
    const uvs = new Float32Array(n * 2 * 2);
    const idx = [];
    this.road.forEach((p, i) => {
      const sx = p.tz;
      const sz = -p.tx;
      const y = this.heightAt(p.x, p.z) + 0.2;
      positions.set([p.x + sx * ROAD_HALF, y, p.z + sz * ROAD_HALF], i * 6);
      positions.set([p.x - sx * ROAD_HALF, y, p.z - sz * ROAD_HALF], i * 6 + 3);
      uvs.set([0, p.s / 14, 1, p.s / 14], i * 4);
      // non si collega la fine del primo tratto con l'inizio del secondo
      if (i < n - 1 && this.road[i + 1].road === p.road) {
        const a = i * 2;
        idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
      }
    });
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geo.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
    geo.setIndex(idx);
    geo.computeVertexNormals();
    const mat = new THREE.MeshLambertMaterial({
      map: asphaltTexture(),
      polygonOffset: true,
      polygonOffsetFactor: -2,
      polygonOffsetUnits: -2,
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.receiveShadow = true;
    return mesh;
  }

  // Linea di vista su heightmap (per il demone).
  lineOfSight(ax, ay, az, bx, by, bz, steps = 60) {
    for (let s = 1; s < steps; s++) {
      const t = s / steps;
      const x = ax + (bx - ax) * t;
      const y = ay + (by - ay) * t;
      const z = az + (bz - az) * t;
      if (this.heightAt(x, z) > y) return false;
    }
    return true;
  }

  dispose() {
    this.mesh.geometry.dispose();
    this.mesh.material.dispose();
    this.roadMesh.geometry.dispose();
    this.roadMesh.material.map.dispose();
    this.roadMesh.material.dispose();
  }
}
