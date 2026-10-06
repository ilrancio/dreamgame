import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { mulberry32, createNoise2D, clamp } from '../../core/noise.js';
import { textTexture } from '../../core/textures.js';
import { X0, X1, Z0, Z1, BAY, STRIP, LOT, ROAD_HW, coastZ, coveAt } from './terrain.js';

// Tutto quello che si vede sulla costa, tranne la folla: il terreno, il mare,
// la strada sterrata, i pini, la pista con l'aereo, il parcheggio pieno,
// il Bagno 13 con le sue cabine, la torretta del bagnino, la passerella.

export function canvasTex(w, h, draw, repeat = [1, 1]) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(repeat[0], repeat[1]);
  t.anisotropy = 4;
  return t;
}

// geometrie statiche fuse per materiale: poche chiamate di disegno
export class Batch {
  constructor() {
    this.parts = new Map();
  }

  add(geo, mat, m) {
    const g = geo.index ? geo.clone() : geo.clone();
    g.applyMatrix4(m);
    if (!this.parts.has(mat)) this.parts.set(mat, []);
    this.parts.get(mat).push(g);
  }

  flush(parent, track, { shadows = true } = {}) {
    for (const [mat, geos] of this.parts) {
      const g = track(mergeGeometries(geos, false));
      geos.forEach((x) => x.dispose());
      const mesh = new THREE.Mesh(g, mat);
      mesh.castShadow = shadows;
      mesh.receiveShadow = true;
      parent.add(mesh);
    }
    this.parts.clear();
  }
}

const M4 = new THREE.Matrix4();
const Q = new THREE.Quaternion();
const E = new THREE.Euler();
const V = new THREE.Vector3();
const S = new THREE.Vector3();
export function mtx(x, y, z, ry = 0, sx = 1, sy = 1, sz = 1, rx = 0, rz = 0) {
  E.set(rx, ry, rz, 'YXZ');
  Q.setFromEuler(E);
  return M4.compose(V.set(x, y, z), Q, S.set(sx, sy, sz)).clone();
}

export function buildCoast(scene, terrain) {
  const disposables = [];
  const track = (o) => (disposables.push(o), o);
  const root = new THREE.Group();
  scene.add(root);
  const T = terrain;
  const rand = mulberry32(1313);
  const noise = createNoise2D(5);
  const matCache = new Map();
  const mat = (color, o = {}) => {
    const key = color + JSON.stringify(o);
    if (!matCache.has(key)) matCache.set(key, track(new THREE.MeshStandardMaterial({ color, roughness: 0.85, ...o })));
    return matCache.get(key);
  };
  const boxGeo = track(new THREE.BoxGeometry(1, 1, 1));
  const cylGeo = track(new THREE.CylinderGeometry(0.5, 0.5, 1, 10));
  const batch = new Batch();
  const colliders = []; // per camminare: rettangoli
  const circles = []; // per la jeep: cerchi
  const box = (w, h, d, m, x, y, z, ry = 0, { col = false, low = false } = {}) => {
    batch.add(boxGeo, m, mtx(x, y + h / 2, z, ry, w, h, d));
    if (col) {
      const c = Math.abs(Math.cos(ry));
      const s = Math.abs(Math.sin(ry));
      const hw = (w * c + d * s) / 2;
      const hd = (w * s + d * c) / 2;
      colliders.push({ minX: x - hw, maxX: x + hw, minZ: z - hd, maxZ: z + hd, low });
    }
  };
  const ground = (x, z) => T.heightAt(x, z);
  const bayPoint = (x, d) => ({ x, z: coastZ(x) - d });

  // ---------- Il terreno ----------
  const C = 5;
  const nx = (X1 - X0) / C + 1;
  const nz = (Z1 - Z0) / C + 1;
  const pos = new Float32Array(nx * nz * 3);
  const col = new Float32Array(nx * nz * 3);
  const cSand = new THREE.Color('#eadbb0');
  const cWet = new THREE.Color('#c9b58a');
  const cDeep = new THREE.Color('#5f8e8c');
  const cRock = new THREE.Color('#c4b49a');
  const cRock2 = new THREE.Color('#9a8a72');
  const cMac = new THREE.Color('#6f7d3e');
  const cDry = new THREE.Color('#b9ad74');
  const cDirt = new THREE.Color('#bba27a');
  const tmpC = new THREE.Color();
  const nrm = new THREE.Vector3();
  for (let j = 0; j < nz; j++) {
    for (let i = 0; i < nx; i++) {
      const x = X0 + i * C;
      const z = Z0 + j * C;
      const h = ground(x, z);
      const k = (j * nx + i) * 3;
      pos[k] = x;
      pos[k + 1] = h;
      pos[k + 2] = z;
      const d = coastZ(x) - z;
      T.normalAt(x, z, nrm, 2.5);
      const n = noise(x * 0.03, z * 0.03);
      if (h < -0.15) tmpC.copy(cWet).lerp(cDeep, clamp(-h / 6, 0, 1));
      else if (coveAt(x) > 0.3 && d < 57 && h < 3.4) tmpC.copy(d < 2.5 ? cWet : cSand).offsetHSL(0, 0, n * 0.02);
      else if (nrm.y < 0.72) tmpC.copy(cRock).lerp(cRock2, clamp(0.5 + n, 0, 1));
      else if (T.surfaceAt(x, z) === 'dirt') tmpC.copy(cDirt);
      else tmpC.copy(cMac).lerp(cDry, clamp(0.5 + n * 1.2, 0, 1));
      col[k] = tmpC.r;
      col[k + 1] = tmpC.g;
      col[k + 2] = tmpC.b;
    }
  }
  const idx = [];
  for (let j = 0; j < nz - 1; j++) {
    for (let i = 0; i < nx - 1; i++) {
      const a = j * nx + i;
      idx.push(a, a + nx, a + 1, a + 1, a + nx, a + nx + 1);
    }
  }
  const tg = track(new THREE.BufferGeometry());
  tg.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  tg.setAttribute('color', new THREE.BufferAttribute(col, 3));
  tg.setIndex(idx);
  tg.computeVertexNormals();
  const land = new THREE.Mesh(tg, track(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95 })));
  land.receiveShadow = true;
  root.add(land);

  // ---------- Il mare ----------
  const seaGeo = track(new THREE.PlaneGeometry(3400, 1900, 170, 70));
  seaGeo.rotateX(-Math.PI / 2);
  seaGeo.translate(0, 0, 780);
  const seaBase = seaGeo.attributes.position.array.slice();
  const sea = new THREE.Mesh(seaGeo, track(new THREE.MeshStandardMaterial({ color: '#2a8ab0', roughness: 0.18, metalness: 0.15, transparent: true, opacity: 0.74 })));
  sea.receiveShadow = true;
  root.add(sea);
  // la schiuma lungo la riva
  const foamGeo = (() => {
    const p = [];
    const ix = [];
    let n = 0;
    for (let x = X0; x <= X1; x += 4) {
      const z = coastZ(x);
      const bay = coveAt(x) > 0.3;
      const w = bay ? 1.6 : 2.6;
      const off = bay ? 0 : 2;
      p.push(x, 0.06, z + off - w, x, 0.06, z + off + w);
      if (n) ix.push(n * 2 - 2, n * 2, n * 2 - 1, n * 2 - 1, n * 2, n * 2 + 1);
      n++;
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(p, 3));
    g.setIndex(ix);
    return track(g);
  })();
  const foamMat = track(new THREE.MeshBasicMaterial({ color: '#f4fbfc', transparent: true, opacity: 0.5, depthWrite: false }));
  const foam = new THREE.Mesh(foamGeo, foamMat);
  root.add(foam);

  // ---------- La strada sterrata ----------
  const dirtTex = track(canvasTex(128, 256, (g, w, h) => {
    g.fillStyle = '#c7ad80';
    g.fillRect(0, 0, w, h);
    for (let i = 0; i < 900; i++) {
      g.fillStyle = `rgba(${90 + Math.random() * 80},${70 + Math.random() * 50},${40 + Math.random() * 40},${0.15 + Math.random() * 0.3})`;
      g.fillRect(Math.random() * w, Math.random() * h, 1 + Math.random() * 3, 1 + Math.random() * 3);
    }
    // i solchi delle ruote
    for (const x of [0.25, 0.75]) {
      g.fillStyle = 'rgba(120,95,60,0.35)';
      g.fillRect(x * w - 10, 0, 20, h);
    }
    // l'erba in mezzo e ai bordi
    g.fillStyle = 'rgba(110,125,60,0.35)';
    g.fillRect(w * 0.47, 0, w * 0.06, h);
    g.fillRect(0, 0, 6, h);
    g.fillRect(w - 6, 0, 6, h);
  }));
  {
    const P = T.road;
    const p = [];
    const uv = [];
    const ix = [];
    P.forEach((r, i) => {
      const nxr = -r.tz;
      const nzr = r.tx;
      for (const s of [-1, 1]) {
        const x = r.x + nxr * ROAD_HW * s;
        const z = r.z + nzr * ROAD_HW * s;
        p.push(x, ground(x, z) + 0.07, z);
        uv.push(s < 0 ? 0 : 1, r.s / 9);
      }
      if (i) ix.push(i * 2 - 2, i * 2, i * 2 - 1, i * 2 - 1, i * 2, i * 2 + 1);
    });
    const g = track(new THREE.BufferGeometry());
    g.setAttribute('position', new THREE.Float32BufferAttribute(p, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    g.setIndex(ix);
    g.computeVertexNormals();
    const road = new THREE.Mesh(g, track(new THREE.MeshStandardMaterial({ map: dirtTex, roughness: 1, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2, side: THREE.DoubleSide })));
    road.receiveShadow = true;
    root.add(road);
    // paletti bianchi e rossi sul lato del mare, ogni tanto
    for (let i = 10; i < P.length - 40; i += 9) {
      const r = P[i];
      const ax = r.x - r.tz * (ROAD_HW + 1.2);
      const az = r.z + r.tx * (ROAD_HW + 1.2);
      const bx = r.x + r.tz * (ROAD_HW + 1.2);
      const bz = r.z - r.tx * (ROAD_HW + 1.2);
      const aSea = coastZ(ax) - az < coastZ(bx) - bz;
      const px = aSea ? ax : bx;
      const pz = aSea ? az : bz;
      const y = ground(px, pz);
      box(0.14, 0.9, 0.14, mat('#f2f2ee'), px, y, pz);
      box(0.15, 0.16, 0.15, mat('#c83030'), px, y + 0.7, pz);
    }
  }

  // ---------- I pini e la macchia ----------
  {
    const okVeg = (x, z, clear = 9) => {
      if (T.roadInfo(x, z).dist < clear) return false;
      if (T.lotWeight(x, z) > 0.02) return false;
      if (x > STRIP.minX - 40 && x < STRIP.maxX + 50 && z > STRIP.z - 60 && z < STRIP.z + 30) return false;
      const d = coastZ(x) - z;
      if (coveAt(x) > 0.3 && d < 64) return false;
      if (d < 12) return false;
      if (T.normalAt(x, z, nrm, 2).y < 0.8) return false;
      return true;
    };
    const pines = [];
    for (let t = 0; t < 6000 && pines.length < 650; t++) {
      const x = X0 + 20 + rand() * (X1 - X0 - 40);
      const d = 12 + rand() ** 1.6 * 300;
      const z = coastZ(x) - d;
      if (z < Z0 + 10) continue;
      if (noise(x * 0.006, z * 0.006) < -0.15) continue; // a gruppi
      if (!okVeg(x, z)) continue;
      pines.push({ x, z, y: ground(x, z), h: 6 + rand() * 4, lean: (rand() - 0.5) * 0.25, ry: rand() * 6.28 });
    }
    const trunkGeo = track(new THREE.CylinderGeometry(0.18, 0.3, 1, 7));
    trunkGeo.translate(0, 0.5, 0);
    const crownGeo = track(new THREE.SphereGeometry(1, 10, 6));
    const trunks = new THREE.InstancedMesh(trunkGeo, mat('#6a4a32'), pines.length);
    const crowns = new THREE.InstancedMesh(crownGeo, mat('#3d5a2c', { flatShading: true }), pines.length);
    pines.forEach((p, i) => {
      trunks.setMatrixAt(i, mtx(p.x, p.y - 0.2, p.z, p.ry, 1, p.h, 1, p.lean, 0));
      const tx = p.x + Math.sin(p.ry) * Math.sin(p.lean) * p.h;
      const tz = p.z + Math.cos(p.ry) * Math.sin(p.lean) * p.h;
      const r = 3.2 + rand() * 1.6;
      crowns.setMatrixAt(i, mtx(tx, p.y + p.h, tz, p.ry, r, 1.1 + rand() * 0.4, r * (0.85 + rand() * 0.3)));
      circles.push({ x: p.x, z: p.z, r: 0.5 });
      colliders.push({ minX: p.x - 0.35, maxX: p.x + 0.35, minZ: p.z - 0.35, maxZ: p.z + 0.35 });
    });
    trunks.castShadow = crowns.castShadow = true;
    trunks.frustumCulled = crowns.frustumCulled = false;
    root.add(trunks, crowns);
    // cespugli della macchia
    const bushes = [];
    for (let t = 0; t < 9000 && bushes.length < 1400; t++) {
      const x = X0 + 10 + rand() * (X1 - X0 - 20);
      const d = 8 + rand() ** 1.3 * 360;
      const z = coastZ(x) - d;
      if (z < Z0 + 6) continue;
      if (!okVeg(x, z, 6)) continue;
      bushes.push({ x, z, y: ground(x, z), s: 0.6 + rand() * 1.3 });
    }
    const bushGeo = track(new THREE.IcosahedronGeometry(1, 0));
    const bm = new THREE.InstancedMesh(bushGeo, mat('#5b6e34', { flatShading: true }), bushes.length);
    const shade = new THREE.Color();
    bushes.forEach((b, i) => {
      bm.setMatrixAt(i, mtx(b.x, b.y + b.s * 0.3, b.z, rand() * 6, b.s * 1.3, b.s * 0.75, b.s));
      bm.setColorAt(i, shade.set(['#5b6e34', '#6e7a3a', '#4e6230', '#8a8a4a'][Math.floor(rand() * 4)]));
    });
    bm.castShadow = true;
    bm.frustumCulled = false;
    root.add(bm);
    // massi in fondo alla scogliera
    const rocks = [];
    for (let x = X0 + 10; x < X1 - 10; x += 7 + rand() * 9) {
      if (coveAt(x) > 0.25) continue;
      const z = coastZ(x) + 1 + rand() * 7;
      rocks.push({ x, z, s: 1 + rand() * 2.5 });
    }
    const rockGeo = track(new THREE.DodecahedronGeometry(1, 0));
    const rm = new THREE.InstancedMesh(rockGeo, mat('#a89a84', { flatShading: true }), rocks.length);
    rocks.forEach((r, i) => rm.setMatrixAt(i, mtx(r.x, ground(r.x, r.z) + r.s * 0.3, r.z, rand() * 6, r.s, r.s * 0.7, r.s * 1.2)));
    rm.frustumCulled = false;
    root.add(rm);
  }

  // ---------- La pista e l'aereo ----------
  const SY = T.stripH;
  {
    const len = STRIP.maxX - STRIP.minX;
    const sTex = track(canvasTex(256, 64, (g, w, h) => {
      g.fillStyle = '#c9b48c';
      g.fillRect(0, 0, w, h);
      for (let i = 0; i < 500; i++) {
        g.fillStyle = `rgba(110,90,60,${Math.random() * 0.25})`;
        g.fillRect(Math.random() * w, Math.random() * h, 2, 2);
      }
      g.fillStyle = 'rgba(120,96,64,0.3)';
      g.fillRect(0, h * 0.4, w, h * 0.2);
    }, [len / 40, 1]));
    const strip = new THREE.Mesh(track(new THREE.PlaneGeometry(len, STRIP.halfW * 2)), track(new THREE.MeshStandardMaterial({ map: sTex, roughness: 1, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 })));
    strip.rotation.x = -Math.PI / 2;
    strip.position.set((STRIP.minX + STRIP.maxX) / 2, SY + 0.05, STRIP.z);
    strip.receiveShadow = true;
    root.add(strip);
    // i copertoni bianchi ai bordi
    const tyreGeo = track(new THREE.TorusGeometry(0.4, 0.16, 6, 12));
    tyreGeo.rotateX(Math.PI / 2);
    for (let x = STRIP.minX; x <= STRIP.maxX; x += 25) {
      for (const s of [-1, 1]) batch.add(tyreGeo, mat('#f4f4f0'), mtx(x, SY + 0.12, STRIP.z + s * (STRIP.halfW + 0.5)));
    }
  }
  // la casetta: "AVIOSUPERFICIE"
  const shack = { x: -712, z: -192 };
  box(10, 3.4, 6, mat('#f2eee4'), shack.x, SY, shack.z, 0, { col: true });
  box(10.8, 0.25, 7, mat('#b0583a'), shack.x, SY + 3.4, shack.z);
  box(1.2, 2.2, 0.1, mat('#3a6a8a'), shack.x + 2, SY, shack.z + 3.02);
  for (const dx of [-3, -1]) box(1.2, 1, 0.08, mat('#8ab4d0', { roughness: 0.2 }), shack.x + dx, SY + 1.3, shack.z + 3.02);
  const aviTex = track(textTexture('AVIOSUPERFICIE', { width: 1024, height: 128, font: '800 92px Inter, sans-serif', color: '#2a4a7a', bg: '#f8f6ee' }));
  const avi = new THREE.Mesh(track(new THREE.PlaneGeometry(8, 1)), track(new THREE.MeshBasicMaterial({ map: aviTex })));
  avi.position.set(shack.x, SY + 4.2, shack.z + 3.05);
  root.add(avi);
  box(8.2, 1.2, 0.12, mat('#f8f6ee'), shack.x, SY + 3.6, shack.z + 2.95);
  // la manica a vento
  const sockPos = { x: -905, z: -192 };
  box(0.12, 6, 0.12, mat('#d8d8d8'), sockPos.x, SY, sockPos.z);
  const sock = new THREE.Mesh(track(new THREE.ConeGeometry(0.5, 2.6, 10, 1, true)), mat('#ff6a2a', { side: THREE.DoubleSide }));
  sock.geometry.rotateZ(Math.PI / 2);
  sock.geometry.translate(1.3, 0, 0);
  sock.position.set(sockPos.x, SY + 5.7, sockPos.z);
  root.add(sock);
  // il noleggio jeep: un ombrellone, una sedia di plastica, un cartello
  const renter = { x: -684, z: -127 };
  box(0.08, 2.4, 0.08, mat('#e8e8e8'), renter.x, SY, renter.z);
  const parasol = new THREE.Mesh(track(new THREE.ConeGeometry(1.6, 0.6, 12)), mat('#e85a3a'));
  parasol.position.set(renter.x, SY + 2.5, renter.z);
  root.add(parasol);
  box(0.5, 0.45, 0.5, mat('#f0f0ea'), renter.x + 0.4, SY, renter.z + 0.2);
  const rentTex = track(textTexture('NOLEGGIO JEEP', { width: 512, height: 96, font: '800 60px Inter, sans-serif', color: '#ffffff', bg: '#2a7a4a' }));
  box(0.1, 1.6, 0.1, mat('#6a5a4a'), renter.x - 2.4, SY, renter.z);
  const rent = new THREE.Mesh(track(new THREE.PlaneGeometry(2.2, 0.42)), track(new THREE.MeshBasicMaterial({ map: rentTex, side: THREE.DoubleSide })));
  rent.position.set(renter.x - 2.4, SY + 1.8, renter.z);
  root.add(rent);

  // l'aereo: un bimotore ad ala alta, bianco con la riga blu
  const plane = new THREE.Group();
  {
    const white = mat('#f2f2f0', { roughness: 0.4 });
    const blue = mat('#2a4a8a', { roughness: 0.5 });
    const dark = mat('#2a2c30');
    const add = (geo, m, x, y, z, rx = 0, ry = 0, rz = 0) => {
      const o = new THREE.Mesh(geo, m);
      o.position.set(x, y, z);
      o.rotation.set(rx, ry, rz);
      o.castShadow = true;
      plane.add(o);
      return o;
    };
    const fus = track(new THREE.CylinderGeometry(0.95, 0.75, 11, 14));
    add(fus, white, 0, 1.9, 0, 0, 0, Math.PI / 2);
    add(track(new THREE.SphereGeometry(0.95, 14, 10)), white, 5.5, 1.9, 0).scale.set(1.3, 1, 1);
    add(track(new THREE.ConeGeometry(0.75, 3, 14)), white, -7, 2.05, 0, 0, 0, Math.PI / 2);
    add(boxGeo, blue, 0, 1.75, 0).scale.set(11.5, 0.22, 1.95);
    add(boxGeo, white, 0.6, 2.95, 0).scale.set(1.7, 0.18, 16);
    for (const s of [-1, 1]) {
      add(track(new THREE.CylinderGeometry(0.42, 0.36, 2.6, 10)), white, 1.4, 2.6, s * 3, 0, 0, Math.PI / 2);
      const prop = add(boxGeo, dark, 2.75, 2.6, s * 3);
      prop.scale.set(0.06, 2.2, 0.16);
      prop.userData.prop = true;
      add(boxGeo, dark, 1.5, 0.6, s * 1.6).scale.set(0.12, 1.2, 0.12);
      add(track(new THREE.CylinderGeometry(0.32, 0.32, 0.2, 12)), dark, 1.5, 0.32, s * 1.6, Math.PI / 2);
    }
    add(boxGeo, white, -7.6, 3.3, 0).scale.set(1.6, 2.4, 0.15);
    add(boxGeo, blue, -7.7, 4.2, 0).scale.set(1.4, 0.6, 0.17);
    add(boxGeo, white, -7.8, 2.2, 0).scale.set(1.2, 0.12, 5);
    add(boxGeo, dark, 4.6, 0.6, 0).scale.set(0.1, 1.2, 0.1);
    add(track(new THREE.CylinderGeometry(0.28, 0.28, 0.18, 12)), dark, 4.6, 0.28, 0, Math.PI / 2);
    // i finestrini e la porta sul fianco nord (-z)
    for (let i = 0; i < 5; i++) add(boxGeo, mat('#3a4a5a', { roughness: 0.2 }), 2.8 - i * 1.3, 2.15, -0.9).scale.set(0.5, 0.4, 0.06);
    add(boxGeo, mat('#c8c8c4'), -3.8, 1.8, -0.93).scale.set(0.9, 1.5, 0.05);
    for (let i = 0; i < 5; i++) add(boxGeo, mat('#3a4a5a', { roughness: 0.2 }), 2.8 - i * 1.3, 2.15, 0.9).scale.set(0.5, 0.4, 0.06);
    plane.userData.props = plane.children.filter((o) => o.userData.prop);
  }
  const planePark = { x: -780, z: STRIP.z, y: SY };
  plane.position.set(planePark.x, SY, planePark.z);
  root.add(plane);

  // ---------- Il parcheggio pieno e le macchine lungo la strada ----------
  const parked = [];
  const lotSpot = []; // dove si può lasciare la jeep: il corridoio centrale
  {
    const rowD = [LOT.d0 + 4, LOT.d1 - 4];
    for (const [ri, d] of rowD.entries()) {
      for (let x = BAY.x - LOT.hw + 4; x <= BAY.x + LOT.hw - 4; x += 3.1) {
        if (ri === 0 && Math.abs(x - BAY.x) < 4) continue; // la passerella
        if (rand() < 0.04) continue;
        const z = coastZ(x) - d;
        parked.push({ x, z, ry: ri === 0 ? 0 : Math.PI, along: false });
      }
    }
    // in fila sul ciglio della strada, prima della baia: il parcheggio è pieno
    const P = T.road;
    for (let i = P.length - 30; i > P.length - 130; i -= 2) {
      const r = P[i];
      // sul lato verso monte
      const o = ROAD_HW + 1.4;
      const s = coastZ(r.x + r.tz * o) - (r.z - r.tx * o) > coastZ(r.x - r.tz * o) - (r.z + r.tx * o) ? 1 : -1;
      const x = r.x + r.tz * o * s;
      const z = r.z - r.tx * o * s;
      parked.push({ x, z, ry: Math.atan2(r.tx, r.tz) + (rand() - 0.5) * 0.08, along: true });
    }
    const n = parked.length;
    const body = new THREE.InstancedMesh(boxGeo, mat('#ffffff', { roughness: 0.4, metalness: 0.2 }), n);
    const cab = new THREE.InstancedMesh(boxGeo, mat('#ffffff', { roughness: 0.3, metalness: 0.2 }), n);
    const wheels = new THREE.InstancedMesh(boxGeo, mat('#1e1e1e'), n * 2);
    const palette = ['#c83a3a', '#e8e8e4', '#2a4a8a', '#3a3a3e', '#d8b84a', '#5a8a5a', '#9ab0c8', '#a85a2a', '#f0f0f0', '#6a2a4a'];
    const cc = new THREE.Color();
    parked.forEach((p, i) => {
      p.y = ground(p.x, p.z);
      const big = rand() < 0.25;
      const L = big ? 4.6 : 3.9;
      const H = big ? 1.0 : 0.75;
      body.setMatrixAt(i, mtx(p.x, p.y + 0.35 + H / 2, p.z, p.ry, 1.75, H, L));
      const fx = Math.sin(p.ry);
      const fz = Math.cos(p.ry);
      cab.setMatrixAt(i, mtx(p.x - fx * 0.3, p.y + 0.35 + H + 0.3, p.z - fz * 0.3, p.ry, 1.6, 0.62, big ? 2.6 : 2));
      for (const s of [-1, 1]) wheels.setMatrixAt(i * 2 + (s > 0 ? 1 : 0), mtx(p.x + fx * s * L * 0.32, p.y + 0.34, p.z + fz * s * L * 0.32, p.ry, 1.85, 0.66, 0.66));
      const c = palette[Math.floor(rand() * palette.length)];
      body.setColorAt(i, cc.set(c));
      cab.setColorAt(i, cc.set(c).multiplyScalar(0.55));
      circles.push({ x: p.x + fx * L * 0.25, z: p.z + fz * L * 0.25, r: 0.95 }, { x: p.x - fx * L * 0.25, z: p.z - fz * L * 0.25, r: 0.95 });
      const hw = (Math.abs(Math.cos(p.ry)) * 1.75 + Math.abs(Math.sin(p.ry)) * L) / 2;
      const hd = (Math.abs(Math.sin(p.ry)) * 1.75 + Math.abs(Math.cos(p.ry)) * L) / 2;
      colliders.push({ minX: p.x - hw, maxX: p.x + hw, minZ: p.z - hd, maxZ: p.z + hd, low: true });
    });
    for (const m of [body, cab, wheels]) {
      m.castShadow = true;
      m.frustumCulled = false;
      root.add(m);
    }
    lotSpot.push(bayPoint(BAY.x + 12, (LOT.d0 + LOT.d1) / 2));
  }

  // ---------- La spiaggia: passerella, Bagno 13, cabine, torretta ----------
  const wood = mat('#a8845a');
  const woodDark = mat('#7a5a3a');
  // la passerella dal parcheggio alla riva
  for (let d = LOT.d0 + 1; d > 3; d -= 0.9) {
    const p = bayPoint(BAY.x, d);
    batch.add(boxGeo, d % 1.8 < 0.9 ? wood : woodDark, mtx(p.x, ground(p.x, p.z) + 0.06, p.z, 0, 2, 0.1, 0.8));
  }
  // il Bagno 13: il bar dello stabilimento
  const bar = bayPoint(BAY.x - 48, 52);
  bar.y = ground(bar.x, bar.z);
  box(14, 0.3, 9, wood, bar.x, bar.y - 0.1, bar.z + 1); // pedana
  box(12, 3.2, 5, mat('#f4f2ec'), bar.x, bar.y + 0.2, bar.z - 1.5, 0, { col: true });
  for (let i = -5; i <= 5; i += 2) box(1, 3.2, 0.06, mat('#3a7ac8'), bar.x + i, bar.y + 0.2, bar.z + 1.03);
  box(13, 0.3, 7.5, mat('#3a7ac8'), bar.x, bar.y + 3.4, bar.z);
  box(8, 1.1, 0.8, mat('#f4f2ec'), bar.x, bar.y + 0.2, bar.z + 2.4, 0, { col: true }); // il bancone
  const b13Tex = track(textTexture('BAGNO 13', { width: 1024, height: 192, font: '900 150px Inter, sans-serif', color: '#ffffff', bg: '#3a7ac8' }));
  const b13 = new THREE.Mesh(track(new THREE.PlaneGeometry(7, 1.3)), track(new THREE.MeshBasicMaterial({ map: b13Tex })));
  b13.position.set(bar.x, bar.y + 4.4, bar.z + 3.6);
  root.add(b13);
  box(7.4, 1.5, 0.15, mat('#3a7ac8'), bar.x, bar.y + 3.65, bar.z + 3.5);
  // tavolini e sedie davanti al bar
  for (let i = 0; i < 6; i++) {
    const tx = bar.x - 5 + i * 2;
    const tz = bar.z + 4.2 + (i % 2) * 0.8;
    batch.add(cylGeo, mat('#f0f0ea'), mtx(tx, bar.y + 0.4, tz, 0, 0.7, 0.05, 0.7));
    batch.add(cylGeo, mat('#c8c8c8'), mtx(tx, bar.y + 0.2, tz, 0, 0.06, 0.4, 0.06));
  }
  // le cabine, una con il 1313
  const cabins = [];
  const cabColors = ['#3a7ac8', '#f4f2ec', '#3a7ac8', '#f4f2ec', '#3a7ac8', '#f4f2ec', '#3a7ac8', '#f4f2ec'];
  for (let i = 0; i < 8; i++) {
    const p = bayPoint(BAY.x - 80 + i * 1.9, 53);
    p.y = ground(p.x, p.z);
    box(1.8, 2.3, 1.8, mat(cabColors[i]), p.x, p.y, p.z, 0, { col: true });
    box(1.9, 0.15, 1.9, mat('#e8e4d8'), p.x, p.y + 2.3, p.z);
    box(0.9, 1.9, 0.06, mat(i === 5 ? '#1f6a3a' : '#e8e4d8'), p.x, p.y + 0.1, p.z + 0.92);
    cabins.push(p);
  }
  const c13 = cabins[5];
  const numTex = track(textTexture('1313', { width: 256, height: 96, font: '700 70px Inter, sans-serif', color: '#3a2a10', bg: '#e8d48a' }));
  const num = new THREE.Mesh(track(new THREE.PlaneGeometry(0.42, 0.16)), track(new THREE.MeshBasicMaterial({ map: numTex })));
  num.position.set(c13.x, c13.y + 1.75, c13.z + 0.96);
  root.add(num);
  // la torretta del bagnino
  const tower = bayPoint(BAY.x - 22, 7);
  tower.y = ground(tower.x, tower.z);
  for (const [dx, dz] of [[-0.8, -0.8], [0.8, -0.8], [-0.8, 0.8], [0.8, 0.8]]) box(0.14, 2.6, 0.14, mat('#f4f4f0'), tower.x + dx, tower.y, tower.z + dz);
  box(1.9, 0.12, 1.9, mat('#f4f4f0'), tower.x, tower.y + 2.6, tower.z);
  box(1.9, 0.5, 0.08, mat('#d83030'), tower.x, tower.y + 2.72, tower.z + 0.95);
  const salvTex = track(textTexture('SALVATAGGIO', { width: 512, height: 80, font: '800 52px Inter, sans-serif', color: '#ffffff', bg: '#d83030' }));
  const salv = new THREE.Mesh(track(new THREE.PlaneGeometry(1.8, 0.28)), track(new THREE.MeshBasicMaterial({ map: salvTex })));
  salv.position.set(tower.x, tower.y + 2.97, tower.z + 1.0);
  root.add(salv);
  colliders.push({ minX: tower.x - 1, maxX: tower.x + 1, minZ: tower.z - 1, maxZ: tower.z + 1, low: true });
  // la bandiera
  box(0.06, 5, 0.06, mat('#e0e0e0'), tower.x + 1.2, tower.y, tower.z);
  const flag = new THREE.Mesh(track(new THREE.PlaneGeometry(0.9, 0.55, 6, 1)), mat('#2aa84a', { side: THREE.DoubleSide }));
  flag.geometry.translate(0.45, 0, 0);
  flag.position.set(tower.x + 1.23, tower.y + 4.7, tower.z);
  root.add(flag);
  const flagBase = flag.geometry.attributes.position.array.slice();
  // la rete da pallavolo
  const net = bayPoint(BAY.x + 112, 22);
  net.y = ground(net.x, net.z);
  for (const dz of [-4.5, 4.5]) box(0.1, 2.5, 0.1, mat('#d8d8d8'), net.x, net.y, net.z + dz);
  const netMesh = new THREE.Mesh(track(new THREE.PlaneGeometry(9, 0.9)), mat('#f4f4f4', { transparent: true, opacity: 0.55, side: THREE.DoubleSide }));
  netMesh.rotation.y = Math.PI / 2;
  netMesh.position.set(net.x, net.y + 2.05, net.z);
  root.add(netMesh);

  batch.flush(root, track);

  return {
    colliders,
    circles,
    plane,
    planePark,
    stripY: SY,
    shack,
    renter: new THREE.Vector3(renter.x, SY, renter.z),
    rentSign: new THREE.Vector3(renter.x - 2.4, SY, renter.z),
    lotSpot: lotSpot[0],
    bar: new THREE.Vector3(bar.x, bar.y, bar.z + 3.2),
    cabin13: new THREE.Vector3(c13.x, c13.y, c13.z + 1.5),
    tower: new THREE.Vector3(tower.x, tower.y, tower.z),
    net,
    update(t) {
      const pa = seaGeo.attributes.position;
      const a = pa.array;
      for (let i = 0; i < pa.count; i++) {
        const x = seaBase[i * 3];
        const z = seaBase[i * 3 + 2];
        a[i * 3 + 1] = Math.sin(x * 0.05 + t * 0.9) * 0.08 + Math.sin(z * 0.09 - t * 1.3) * 0.1;
      }
      pa.needsUpdate = true;
      foam.position.z = Math.sin(t * 0.8) * 1.2;
      foamMat.opacity = 0.35 + Math.sin(t * 0.8 + 1) * 0.2;
      sock.rotation.y = 1.2 + Math.sin(t * 0.6) * 0.25;
      const fp = flag.geometry.attributes.position;
      for (let i = 0; i < fp.count; i++) fp.array[i * 3 + 2] = Math.sin(flagBase[i * 3] * 6 + t * 7) * 0.06 * flagBase[i * 3];
      fp.needsUpdate = true;
    },
    dispose() {
      disposables.forEach((d) => d.dispose());
      root.removeFromParent();
    },
  };
}
