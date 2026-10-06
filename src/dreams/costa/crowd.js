import * as THREE from 'three';
import { mulberry32 } from '../../core/noise.js';
import { BAY, coastZ, coveAt } from './terrain.js';

// La folla della spiaggia: centinaia di ombrelloni in file, lettini e
// asciugamani, gente sdraiata, seduta, in piedi a chiacchierare, bambini,
// chi passeggia sulla battigia, chi nuota, una partita di pallavolo.
// Tutti fatti di pezzi "istanziati": poche chiamate di disegno per mille persone.
// Un solo ombrellone, in mezzo a tutti, è libero.

const SKIN = ['#f1c7a5', '#e0b089', '#c99470', '#a8754f', '#8a5a3a', '#f4d2b8', '#6a4430'];
const HAIR = ['#141414', '#3b2a1e', '#6a4a2a', '#c8a050', '#e8d8a8', '#8a3a1a', '#9a9a9a'];
const SWIM = ['#d83a3a', '#2a5ac8', '#f0c020', '#2aa86a', '#e85ab0', '#1a1a1a', '#f4f4f4', '#ff7a2a', '#7a3ac8', '#2ab8c8'];
const LIDO = [null, '#2a6ac8', '#ff8a2a', '#2a9a5a', null];

const legGeo = new THREE.CylinderGeometry(0.085, 0.07, 0.78, 6).translate(0, -0.39, 0);
const armGeo = new THREE.CylinderGeometry(0.062, 0.052, 0.6, 6).translate(0, -0.3, 0);
const hipGeo = new THREE.CylinderGeometry(0.2, 0.19, 0.2, 8);
const torsoGeo = new THREE.CylinderGeometry(0.23, 0.2, 0.62, 8);
const headGeo = new THREE.SphereGeometry(0.16, 10, 8);
const hairGeo = new THREE.SphereGeometry(0.17, 10, 6, 0, Math.PI * 2, 0, Math.PI * 0.55);
const PARTS = [legGeo, legGeo, hipGeo, torsoGeo, headGeo, hairGeo, armGeo, armGeo];

const _m = new THREE.Matrix4();
const _p = new THREE.Matrix4();
const _b = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _e = new THREE.Euler();
const _v = new THREE.Vector3();
const _s = new THREE.Vector3();
const _c = new THREE.Color();
const HALF = Math.PI / 2;

function T(x, y, z, rx = 0, rz = 0) {
  _e.set(rx, 0, rz);
  _q.setFromEuler(_e);
  return new THREE.Matrix4().compose(_v.set(x, y, z), _q, _s.set(1, 1, 1));
}

// un gruppo di persone che condividono le stesse mesh istanziate
class People {
  constructor(root, list, track) {
    this.list = list;
    const n = Math.max(1, list.length);
    this.meshes = PARTS.map((g) => {
      const m = new THREE.InstancedMesh(g, track(new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.8 })), n);
      m.castShadow = true;
      m.frustumCulled = false;
      m.count = list.length;
      root.add(m);
      return m;
    });
    list.forEach((p, i) => {
      const cols = [p.skin, p.skin, p.swim, p.top, p.skin, p.hair, p.skin, p.skin];
      this.meshes.forEach((m, k) => m.setColorAt(i, _c.set(cols[k])));
      this.pose(i);
    });
    this.meshes.forEach((m) => {
      m.instanceMatrix.needsUpdate = true;
      if (m.instanceColor) m.instanceColor.needsUpdate = true;
    });
  }

  // la posa di una persona: base (posizione, direzione, scala) · posa · pezzo
  pose(i) {
    const p = this.list[i];
    _e.set(0, p.yaw, 0);
    _q.setFromEuler(_e);
    _b.compose(_v.set(p.x, p.y, p.z), _q, _s.set(p.scale, p.scale, p.scale));
    const a = p.anim || {};
    let legA = a.leg || 0;
    let armA = a.arm || 0;
    let armZ = a.armZ || 0;
    switch (p.pose) {
      case 'lie':
        _p.makeTranslation(0, (p.bed || 0) + 0.21, 0.9).multiply(_m.makeRotationX(-HALF));
        armZ = 0.12;
        break;
      case 'prone':
        _p.makeTranslation(0, (p.bed || 0) + 0.21, -0.9).multiply(_m.makeRotationX(HALF));
        armA = -2.6;
        break;
      case 'sit':
        _p.makeTranslation(0, (p.seat || 0) - 0.66, 0);
        legA = -1.45;
        armA = a.arm ?? -0.4;
        break;
      case 'swim':
        _p.makeTranslation(0, a.y || 0, 0);
        break;
      default:
        _p.makeTranslation(0, a.y || 0, 0);
    }
    _p.premultiply(_b);
    const locals = [
      T(0.1, 0.8, 0, legA),
      T(-0.1, 0.8, 0, p.pose === 'sit' ? legA : -legA),
      T(0, 0.86, 0),
      T(0, 1.2, 0),
      T(0, 1.67, 0),
      T(0, 1.71, -0.01, -0.3),
      T(0.3, 1.46, 0, p.pose === 'walk' ? -legA * 0.8 : armA, armZ),
      T(-0.3, 1.46, 0, p.pose === 'walk' ? legA * 0.8 : (a.armR ?? armA), -armZ),
    ];
    for (let k = 0; k < 8; k++) this.meshes[k].setMatrixAt(i, _m.multiplyMatrices(_p, locals[k]));
  }

  commit() {
    for (const m of this.meshes) m.instanceMatrix.needsUpdate = true;
  }
}

export function buildCrowd(scene, terrain, world) {
  const disposables = [];
  const track = (o) => (disposables.push(o), o);
  const root = new THREE.Group();
  scene.add(root);
  const rand = mulberry32(2026);
  const pick = (arr) => arr[Math.floor(rand() * arr.length)];
  const ground = (x, z) => terrain.heightAt(x, z);
  const statics = [];
  const dynamics = [];
  const blockers = new Map(); // griglia di cerchi che spingono via chi cammina
  const CELL = 4;
  const block = (x, z, r) => {
    const k = Math.floor(x / CELL) * 7919 + Math.floor(z / CELL);
    if (!blockers.has(k)) blockers.set(k, []);
    blockers.get(k).push({ x, z, r });
  };
  const person = (x, z, yaw, pose, o = {}) => {
    const kid = o.kid ?? rand() < 0.12;
    const woman = rand() < 0.5;
    const skin = pick(SKIN);
    const swim = pick(SWIM);
    const p = {
      x,
      z,
      y: o.y ?? ground(x, z),
      yaw,
      pose,
      scale: kid ? 0.58 + rand() * 0.12 : 0.92 + rand() * 0.14,
      skin,
      swim,
      top: woman ? (rand() < 0.5 ? swim : pick(SWIM)) : rand() < 0.15 ? pick(['#f4f4f4', '#9ac8e8', '#e8d8a8']) : skin,
      hair: rand() < 0.08 ? skin : pick(HAIR),
      bed: o.bed,
      seat: o.seat,
      anim: o.anim || {},
      ...o.extra,
    };
    (o.dynamic ? dynamics : statics).push(p);
    return p;
  };

  // ---------- Ombrelloni, lettini, asciugamani ----------
  const umbrellas = [];
  const beds = [];
  const towels = [];
  const net = world.net;
  const tower = world.tower;
  let free = null;
  const X0 = BAY.x - 128;
  for (let r = 0; r < 8; r++) {
    const d = 12 + r * 4.4;
    for (let x = X0 + (r % 2) * 1.8; x < BAY.x + 128; x += 3.6) {
      const ux = x + (rand() - 0.5) * 0.4;
      if (Math.abs(ux - BAY.x) < 2.6) continue;
      if (Math.abs(ux - net.x) < 12 && d < 34) continue;
      if (Math.abs(ux - tower.x) < 3 && d < 14) continue;
      if (coveAt(ux) < 0.5) continue;
      const uz = coastZ(ux) - d - (rand() - 0.5) * 0.3;
      const h = ground(ux, uz);
      if (h > 2.4) continue;
      const zone = Math.floor((ux - X0) / 62);
      const lido = LIDO[Math.min(zone, LIDO.length - 1)];
      umbrellas.push({ x: ux, z: uz, y: h, color: lido || pick(SWIM), open: true, lido: !!lido });
    }
  }
  // l'unico posto libero: fila 5, nel Bagno 13, vicino alla passerella
  {
    let best = null;
    for (const u of umbrellas) {
      const d = coastZ(u.x) - u.z;
      if (!u.lido || Math.abs(d - (12 + 4 * 4.4)) > 1) continue;
      const score = Math.abs(u.x - (BAY.x - 14));
      if (!best || score < best.s) best = { u, s: score };
    }
    free = best.u;
    free.free = true;
  }
  for (const u of umbrellas) {
    block(u.x, u.z, 0.18);
    const slots = [-0.85, 0.85];
    for (const sx of slots) {
      const bx = u.x + sx;
      const bz = u.z + 0.5;
      if (u.lido) beds.push({ x: bx, z: bz, y: ground(bx, bz) });
      else towels.push({ x: bx, z: bz + 0.2, y: ground(bx, bz + 0.2), color: pick(SWIM) });
      block(bx, bz - 0.45, 0.5);
      block(bx, bz + 0.45, 0.5);
      if (u.free) continue;
      const bed = u.lido ? 0.36 : 0.03;
      const roll = rand();
      if (roll < 0.62) person(bx, bz, (rand() - 0.5) * 0.1, 'lie', { bed, y: ground(bx, bz), kid: false });
      else if (roll < 0.8) person(bx, bz, Math.PI + (rand() - 0.5) * 0.1, 'prone', { bed, y: ground(bx, bz), kid: false });
      else if (roll < 0.95) person(bx, bz, (rand() - 0.5) * 0.6, 'sit', { seat: bed + 0.05, anim: { arm: -0.3 - rand() * 0.6 } });
    }
    if (u.free) continue;
    // qualcuno in piedi, qualche bambino che scava
    if (rand() < 0.3) {
      const px = u.x + (rand() - 0.5) * 3;
      const pz = u.z + 1.6 + rand();
      person(px, pz, rand() * 6.28, 'stand', { anim: { arm: (rand() - 0.5) * 0.4 } });
      block(px, pz, 0.3);
    }
    if (rand() < 0.12) {
      const px = u.x + (rand() - 0.5) * 2;
      const pz = u.z + 1.8;
      person(px, pz, rand() * 6.28, 'sit', { kid: true, seat: 0.05, anim: { arm: -1.1 } });
      block(px, pz, 0.3);
    }
  }
  // ---------- La battigia: gruppi in piedi, bambini, castelli di sabbia ----------
  for (let i = 0; i < 110; i++) {
    const x = BAY.x - 125 + rand() * 250;
    if (coveAt(x) < 0.5) continue;
    const d = 0.5 + rand() * 8;
    const z = coastZ(x) - d;
    const n = 1 + Math.floor(rand() * 3);
    for (let k = 0; k < n; k++) {
      const a = (k / n) * Math.PI * 2;
      const px = x + Math.cos(a) * 0.7;
      const pz = z + Math.sin(a) * 0.7;
      person(px, pz, Math.atan2(x - px, z - pz) + (n === 1 ? Math.PI : 0), 'stand', { anim: { arm: (rand() - 0.5) * 0.5, armR: rand() < 0.3 ? -1.4 : undefined } });
      block(px, pz, 0.3);
    }
  }
  const castles = [];
  for (let i = 0; i < 26; i++) {
    const x = BAY.x - 120 + rand() * 240;
    if (coveAt(x) < 0.5) continue;
    const z = coastZ(x) - 2 - rand() * 4;
    castles.push({ x, z, y: ground(x, z), s: 0.3 + rand() * 0.4 });
    person(x + 0.6, z, -HALF, 'sit', { kid: true, seat: 0.05, anim: { arm: -1.2 } });
  }
  // ---------- Al bar del Bagno 13 ----------
  const bar = world.bar;
  for (let i = 0; i < 7; i++) {
    const px = bar.x - 3.5 + i * 1.1 + (rand() - 0.5) * 0.3;
    const pz = bar.z - 0.4;
    person(px, pz, Math.PI + (rand() - 0.5) * 0.4, 'stand', { kid: false, anim: { armR: rand() < 0.5 ? -1.3 : undefined } });
  }
  // il bagnino, seduto sulla torretta
  person(tower.x, tower.z, 0, 'sit', { kid: false, seat: 0, y: tower.y + 2.72 + 0.05, extra: { swim: '#d83030', top: '#d83030' } });

  // ---------- In acqua ----------
  const swimmers = [];
  for (let i = 0; i < 240; i++) {
    const x = BAY.x - 125 + rand() * 250;
    if (coveAt(x) < 0.5) continue;
    const d = -(1.5 + rand() ** 1.7 * 40);
    const z = coastZ(x) - d;
    const h = ground(x, z);
    const deep = -h > 1.25;
    const p = person(x, z, Math.PI + (rand() - 0.5) * 2, deep ? 'swim' : 'stand', {
      dynamic: true,
      y: deep ? -1.36 : h,
      anim: { arm: deep ? -0.5 : (rand() - 0.5) * 1.5, armZ: deep ? 0.6 : 0.4 },
      extra: { bob: rand() * 6.28, deep, base: deep ? -1.36 : h },
    });
    swimmers.push(p);
    block(x, z, 0.35);
  }
  // ---------- Chi passeggia sulla battigia ----------
  const walkers = [];
  for (let i = 0; i < 70; i++) {
    const dir = rand() < 0.5 ? 1 : -1;
    const p = person(BAY.x - 125 + rand() * 250, 0, dir > 0 ? HALF : -HALF, 'walk', { dynamic: true, extra: { dir, d: 1 + rand() * 7, v: 0.9 + rand() * 0.7, ph: rand() * 6 } });
    p.z = coastZ(p.x) - p.d;
    walkers.push(p);
  }
  // bambini che si rincorrono
  const runners = [];
  for (let i = 0; i < 18; i++) {
    const cx = BAY.x - 110 + rand() * 220;
    const p = person(cx, 0, 0, 'walk', { kid: true, dynamic: true, extra: { cx, cd: 2 + rand() * 4, R: 2 + rand() * 3, w: (rand() < 0.5 ? -1 : 1) * (0.8 + rand() * 0.6), ph: rand() * 6 } });
    runners.push(p);
  }
  // la pallavolo
  const players = [];
  for (const [sx, sz] of [[-4, -2], [-4, 2], [4, -2], [4, 2]]) {
    const p = person(net.x + sx, net.z + sz, sx < 0 ? HALF : -HALF, 'stand', { kid: false, dynamic: true, extra: { ph: rand() * 6, hx: net.x + sx, hz: net.z + sz } });
    players.push(p);
    block(p.x, p.z, 0.35);
  }

  const S = new People(root, statics, track);
  const D = new People(root, dynamics, track);

  // ---------- Le cose: ombrelloni, lettini, asciugamani, castelli, ciambelle ----------
  const poleGeo = track(new THREE.CylinderGeometry(0.035, 0.035, 2.4, 5).translate(0, 1.2, 0));
  const canopyGeo = track(new THREE.ConeGeometry(1.25, 0.5, 10, 1, true).translate(0, 2.45, 0));
  const poles = new THREE.InstancedMesh(poleGeo, track(new THREE.MeshStandardMaterial({ color: '#e8e8e4' })), umbrellas.length);
  const canopies = new THREE.InstancedMesh(canopyGeo, track(new THREE.MeshStandardMaterial({ color: '#ffffff', side: THREE.DoubleSide, roughness: 0.8 })), umbrellas.length);
  umbrellas.forEach((u, i) => {
    const tilt = (rand() - 0.5) * 0.12;
    _e.set(tilt, rand() * 6, tilt * 0.5);
    _q.setFromEuler(_e);
    _m.compose(_v.set(u.x, u.y - 0.2, u.z), _q, _s.set(1, 1, 1));
    poles.setMatrixAt(i, _m);
    canopies.setMatrixAt(i, _m);
    canopies.setColorAt(i, _c.set(u.color));
  });
  const bedGeo = track(new THREE.BoxGeometry(0.66, 0.08, 1.9).translate(0, 0.33, 0));
  const bedLegGeo = track(new THREE.BoxGeometry(0.6, 0.3, 1.7).translate(0, 0.15, 0));
  const bedTop = new THREE.InstancedMesh(bedGeo, track(new THREE.MeshStandardMaterial({ color: '#f4f4f0', roughness: 0.6 })), beds.length);
  const bedLegs = new THREE.InstancedMesh(bedLegGeo, track(new THREE.MeshStandardMaterial({ color: '#c8c8c4', transparent: true, opacity: 0.35 })), beds.length);
  beds.forEach((b, i) => {
    _m.makeTranslation(b.x, b.y, b.z);
    bedTop.setMatrixAt(i, _m);
    bedLegs.setMatrixAt(i, _m);
  });
  const towelGeo = track(new THREE.BoxGeometry(0.8, 0.02, 1.8).translate(0, 0.02, 0));
  const towelM = new THREE.InstancedMesh(towelGeo, track(new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 1 })), Math.max(1, towels.length));
  towels.forEach((t, i) => {
    _e.set(0, (rand() - 0.5) * 0.3, 0);
    _q.setFromEuler(_e);
    towelM.setMatrixAt(i, _m.compose(_v.set(t.x, t.y, t.z), _q, _s.set(1, 1, 1)));
    towelM.setColorAt(i, _c.set(t.color));
  });
  const castleGeo = track(new THREE.ConeGeometry(0.5, 0.7, 6).translate(0, 0.3, 0));
  const castleM = new THREE.InstancedMesh(castleGeo, track(new THREE.MeshStandardMaterial({ color: '#d8c494', flatShading: true })), castles.length);
  castles.forEach((c, i) => castleM.setMatrixAt(i, _m.compose(_v.set(c.x, c.y - 0.05, c.z), _q.identity(), _s.set(c.s * 2, c.s * 1.5, c.s * 2))));
  const ringGeo = track(new THREE.TorusGeometry(0.42, 0.16, 6, 12).rotateX(HALF));
  const deepOnes = swimmers.filter((s) => s.deep);
  const rings = new THREE.InstancedMesh(ringGeo, track(new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.5 })), Math.max(1, Math.min(30, deepOnes.length)));
  rings.count = Math.min(30, deepOnes.length);
  for (let i = 0; i < rings.count; i++) rings.setColorAt(i, _c.set(SWIM[i % SWIM.length]));
  const ballGeo = track(new THREE.SphereGeometry(0.13, 10, 8));
  const ball = new THREE.Mesh(ballGeo, track(new THREE.MeshStandardMaterial({ color: '#f4e04a', roughness: 0.6 })));
  root.add(ball);
  for (const m of [poles, canopies, bedTop, bedLegs, towelM, castleM, rings]) {
    m.castShadow = true;
    m.receiveShadow = true;
    m.frustumCulled = false;
    m.instanceMatrix.needsUpdate = true;
    if (m.instanceColor) m.instanceColor.needsUpdate = true;
    root.add(m);
  }

  // il posto libero: due lettini vuoti sotto l'ombrellone
  const freeSpot = {
    x: free.x,
    z: free.z,
    y: free.y,
    beds: [new THREE.Vector3(free.x - 0.85, ground(free.x - 0.85, free.z + 0.5), free.z + 0.5), new THREE.Vector3(free.x + 0.85, ground(free.x + 0.85, free.z + 0.5), free.z + 0.5)],
  };

  return {
    freeSpot,
    count: statics.length + dynamics.length,
    umbrellas: umbrellas.length,
    // spinge fuori dalla folla chi cammina (raggio r)
    pushOut(pos, r = 0.4) {
      const cx = Math.floor(pos.x / CELL);
      const cz = Math.floor(pos.z / CELL);
      for (let i = -1; i <= 1; i++) {
        for (let j = -1; j <= 1; j++) {
          const list = blockers.get((cx + i) * 7919 + cz + j);
          if (!list) continue;
          for (const b of list) pushCircle(pos, b.x, b.z, b.r + r);
        }
      }
      for (const w of walkers) pushCircle(pos, w.x, w.z, 0.3 + r);
    },
    // quanta gente c'è intorno (per il brusio)
    density(pos) {
      const d = coastZ(pos.x) - pos.z;
      const along = Math.max(0, Math.abs(pos.x - BAY.x) - 120);
      return Math.max(0, 1 - Math.max(0, d - 55) / 60 - along / 80 - Math.max(0, -d - 40) / 40);
    },
    update(dt, t) {
      for (const w of walkers) {
        w.x += w.dir * w.v * dt;
        if (w.x > BAY.x + 128) w.x = BAY.x - 128;
        if (w.x < BAY.x - 128) w.x = BAY.x + 128;
        w.z = coastZ(w.x) - w.d;
        w.y = ground(w.x, w.z);
        w.anim.leg = Math.sin(t * w.v * 4.2 + w.ph) * 0.55;
      }
      for (const k of runners) {
        const a = t * k.w + k.ph;
        k.x = k.cx + Math.cos(a) * k.R;
        k.z = coastZ(k.cx) - k.cd + Math.sin(a) * k.R * 0.5;
        k.y = ground(k.x, k.z);
        k.yaw = Math.atan2(-Math.sin(a) * k.w, Math.cos(a) * k.w * 0.5);
        k.anim.leg = Math.sin(t * 11 + k.ph) * 0.8;
      }
      for (const s of swimmers) {
        s.anim.y = Math.sin(t * 1.4 + s.bob) * (s.deep ? 0.08 : 0.03);
        if (s.deep) s.anim.arm = -0.5 + Math.sin(t * 2 + s.bob) * 0.3;
      }
      // la palla va avanti e indietro sopra la rete
      const cyc = 2.4;
      const ph = (t % (cyc * 2)) / cyc;
      const side = ph < 1 ? 1 : -1;
      const u = ph < 1 ? ph : ph - 1;
      const bx = net.x + side * (-4 + 8 * u);
      const lane = Math.sin(t * 0.37) * 1.6;
      ball.position.set(bx, net.y + 1.9 + Math.sin(u * Math.PI) * 3.2, net.z + lane);
      players.forEach((p, i) => {
        const hit = (side > 0 ? p.hx < net.x : p.hx > net.x) && u < 0.12;
        p.anim.y = hit ? Math.sin((u / 0.12) * Math.PI) * 0.6 : 0;
        p.anim.arm = hit ? -2.8 : -0.4;
        p.anim.armR = hit ? -2.8 : -0.4;
        p.z = p.hz + Math.sin(t * 0.37 + i) * 0.6;
        void i;
      });
      for (let i = 0; i < D.list.length; i++) D.pose(i);
      D.commit();
      // le ciambelle seguono chi ci nuota dentro
      for (let i = 0; i < rings.count; i++) {
        const s = deepOnes[i];
        rings.setMatrixAt(i, _m.makeTranslation(s.x, 0.02 + s.anim.y * 0.5, s.z));
      }
      rings.instanceMatrix.needsUpdate = true;
    },
    dispose() {
      disposables.forEach((d) => d.dispose());
      root.removeFromParent();
    },
  };
}

function pushCircle(pos, x, z, r) {
  const dx = pos.x - x;
  const dz = pos.z - z;
  const d2 = dx * dx + dz * dz;
  if (d2 >= r * r || d2 < 1e-8) return;
  const d = Math.sqrt(d2);
  pos.x = x + (dx / d) * r;
  pos.z = z + (dz / d) * r;
}
