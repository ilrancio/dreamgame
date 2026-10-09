import * as THREE from 'three';
import { createNoise2D, fbm, ridged, smoothstep, lerp, mulberry32 } from '../../core/noise.js';
import { textTexture, glowTexture } from '../../core/textures.js';

// L'isola della tempesta: coste frastagliate, scogli a punta che escono dal
// mare, e fra gli scogli un silo di metallo gigantesco, con un molo lunghissimo
// che corre verso il mare aperto. Piove sempre. Coordinate: l'isola è intorno
// all'origine (raggio ~120 m), il silo sulla costa nord (z positivo), il molo
// va da lì verso z = 270, dove è ormeggiato l'idrovolante.

export const SILO = { x: 0, z: 84, r: 22, h: 84, base: 5 };
export const PIER = { x: 0, z0: SILO.z + SILO.r - 1, z1: 268, halfW: 3.6, y: 5.2 };
export const DOOR = new THREE.Vector3(0, SILO.base, SILO.z + SILO.r + 1.2);
export const BUNKER = { x: -15, z: SILO.z + SILO.r + 8 };

const N = createNoise2D(1313);
const N2 = createNoise2D(77);

// il raggio della costa in una direzione
function coastR(a) {
  const c = Math.cos(a);
  const s = Math.sin(a);
  let R = 118 + fbm(N, c * 1.1 + 10, s * 1.1 + 10, 4) * 36 + (ridged(N, c * 6 + 3, s * 6 + 3, 3) - 0.45) * 26;
  // a nord la costa arriva fin sotto il silo
  const north = Math.exp(-((a - Math.PI / 2) ** 2) / 0.12);
  R = lerp(R, 100, north);
  return R;
}

// ---------- I luoghi della campagna, calcolati dalla costa vera ----------
const at = (a, d) => {
  const R = coastR(a);
  return { x: Math.cos(a) * (R - d), z: Math.sin(a) * (R - d), a, R };
};
// Porto Grigio: il villaggio dei pescatori a sud-ovest, con il suo pontile
export const VILLAGE = { ...at(-2.3, 30), r: 30, y: 3.2 };
export const HARBOR = (() => {
  const a = VILLAGE.a;
  const s = at(a, 4);
  return { a, x0: s.x, z0: s.z, x1: s.x + Math.cos(a) * 46, z1: s.z + Math.sin(a) * 46, halfW: 2.4, y: 3.4 };
})();
export const PLANE_SPOT = new THREE.Vector3(HARBOR.x1 - Math.cos(HARBOR.a) * 5, HARBOR.y, HARBOR.z1 - Math.sin(HARBOR.a) * 5);
// il Faro Spento, sul capo a est
export const LIGHT = { ...at(0.08, 12), r: 10, y: 13 };
// le Grotte dei Cirripedi: la bocca sotto la scogliera a ovest
export const CAVE = { ...at(Math.PI - 0.2, 8), r: 9, y: 2.4 };
// la Spiaggia Nera, a sud-est
export const BEACH = { ...at(-0.72, 14), r: 30 };
// le pietre che cantano, al centro della brughiera
export const STONES = { x: 6, z: -10, r: 14 };

// i sentieri di terra battuta
const PATHS = [
  [VILLAGE, STONES],
  [STONES, { x: 0, z: SILO.z - SILO.r - 4 }],
  [STONES, LIGHT],
  [STONES, CAVE],
  [STONES, BEACH],
  [VILLAGE, BEACH],
];
function segDist(x, z, a, b) {
  const dx = b.x - a.x;
  const dz = b.z - a.z;
  const t = Math.max(0, Math.min(1, ((x - a.x) * dx + (z - a.z) * dz) / (dx * dx + dz * dz)));
  return Math.hypot(x - a.x - dx * t, z - a.z - dz * t);
}
export function pathDist(x, z) {
  let d = Infinity;
  for (const [a, b] of PATHS) d = Math.min(d, segDist(x, z, a, b));
  return d;
}
export function onHarbor(x, z) {
  const H = HARBOR;
  const dx = H.x1 - H.x0;
  const dz = H.z1 - H.z0;
  const L = Math.hypot(dx, dz);
  const u = ((x - H.x0) * dx + (z - H.z0) * dz) / L;
  const v = Math.abs(((x - H.x0) * -dz + (z - H.z0) * dx) / L);
  return u > -3 && u < L && v < H.halfW;
}

// gli scogli isolati in mare: pinnacoli di roccia nera
const STACKS = (() => {
  const rand = mulberry32(5);
  const list = [];
  for (let i = 0; i < 70; i++) {
    const a = rand() * Math.PI * 2;
    const r = coastR(a) + 6 + rand() * 70;
    const x = Math.cos(a) * r;
    const z = Math.sin(a) * r;
    // non sul molo, non davanti al porto né sulla spiaggia
    if (Math.abs(x) < 16 && z > 90) continue;
    if (segDist(x, z, { x: HARBOR.x0, z: HARBOR.z0 }, { x: HARBOR.x1 + Math.cos(HARBOR.a) * 30, z: HARBOR.z1 + Math.sin(HARBOR.a) * 30 }) < 24) continue;
    if (Math.hypot(x - BEACH.x, z - BEACH.z) < 50) continue;
    list.push({ x, z, rad: 3 + rand() * 7, h: 5 + rand() * 18 });
  }
  return list;
})();

// il terreno com'è in natura
function natural(x, z, jagK = 1) {
  const r = Math.hypot(x, z);
  const a = Math.atan2(z, x);
  const R = coastR(a);
  const t = (R - r) / 24;
  const inland = 6 + fbm(N, x * 0.011, z * 0.011, 4) * 5 + ridged(N2, x * 0.018 + 7, z * 0.018, 4) * 8;
  let h = t > 0 ? lerp(0.6, inland, smoothstep(0, 1, t)) : -1.5 + t * 16;
  // gli scogli frastagliati lungo la riva: punte e lame di roccia
  const jag = Math.max(0, ridged(N2, x * 0.07, z * 0.07, 3) - 0.5) * 34 * Math.exp(-((t - 0.08) ** 2) / 0.05);
  h += jag * jagK;
  return { h, t };
}
const STONES_Y = natural(STONES.x, STONES.z, 0).h;

export function heightAt(x, z) {
  // sui sentieri e nei posti abitati le punte di roccia si smussano
  const dv = Math.hypot(x - VILLAGE.x, z - VILLAGE.z);
  const dl = Math.hypot(x - LIGHT.x, z - LIGHT.z);
  const dc = Math.hypot(x - CAVE.x, z - CAVE.z);
  const db = Math.hypot(x - BEACH.x, z - BEACH.z);
  const dst = Math.hypot(x - STONES.x, z - STONES.z);
  const pd = pathDist(x, z);
  const calm = Math.min(smoothstep(3, 7, pd), smoothstep(VILLAGE.r, VILLAGE.r + 14, dv), smoothstep(LIGHT.r, LIGHT.r + 8, dl), smoothstep(CAVE.r, CAVE.r + 8, dc), smoothstep(BEACH.r * 0.8, BEACH.r + 10, db));
  let { h, t } = natural(x, z, calm);
  for (const s of STACKS) {
    const d = Math.hypot(x - s.x, z - s.z);
    if (d < s.rad) {
      const k = 1 - (d / s.rad) ** 2;
      h = Math.max(h, s.h * Math.pow(k, 0.6) + N(x * 0.3, z * 0.3) * 1.5);
    }
  }
  // la Spiaggia Nera: sabbia scura che scende piano verso il mare
  const wb = 1 - smoothstep(BEACH.r * 0.7, BEACH.r + 12, db);
  if (wb > 0) h = lerp(h, Math.max(-2.5, Math.min(4, -0.8 + t * 24 * 0.16)), wb);
  // gli spiazzi: il villaggio, il faro, la bocca delle grotte, le pietre
  const coastFade = smoothstep(-0.12, 0.12, t);
  h = lerp(h, VILLAGE.y, (1 - smoothstep(VILLAGE.r, VILLAGE.r + 16, dv)) * coastFade);
  h = lerp(h, LIGHT.y, 1 - smoothstep(LIGHT.r, LIGHT.r + 14, dl));
  h = lerp(h, CAVE.y, (1 - smoothstep(CAVE.r, CAVE.r + 10, dc)) * coastFade);
  h = lerp(h, STONES_Y, 1 - smoothstep(STONES.r, STONES.r + 10, dst));
  // lo spiazzo di cemento intorno al silo, e la rampa verso il molo
  const ds = Math.hypot(x - SILO.x, z - SILO.z);
  const fl = 1 - smoothstep(SILO.r + 8, SILO.r + 26, ds);
  h = lerp(h, SILO.base, fl);
  return h;
}

export function onPier(x, z) {
  return (Math.abs(x - PIER.x) < PIER.halfW && z > PIER.z0 - 2 && z < PIER.z1) || onHarbor(x, z);
}

export function pierY(x, z) {
  return onHarbor(x, z) ? HARBOR.y : PIER.y;
}

// la zona in cui sei (per gli incontri casuali): null dove si è al sicuro
export function zoneAt(x, z) {
  if (Math.hypot(x - VILLAGE.x, z - VILLAGE.z) < VILLAGE.r + 12) return null;
  if (Math.hypot(x - SILO.x, z - SILO.z) < SILO.r + 22 || onPier(x, z)) return null;
  if (Math.hypot(x - BEACH.x, z - BEACH.z) < BEACH.r + 10) return 'spiaggia';
  if (Math.hypot(x - LIGHT.x, z - LIGHT.z) < LIGHT.r + 4) return null;
  if (Math.hypot(x - CAVE.x, z - CAVE.z) < CAVE.r + 2) return null;
  return 'brughiera';
}

export function buildIsland(scene) {
  const disposables = [];
  const track = (o) => (disposables.push(o), o);
  const root = new THREE.Group();
  scene.add(root);
  const colliders = [];
  const mats = new Map();
  const mat = (color, o = {}) => {
    const k = color + JSON.stringify(o);
    if (!mats.has(k)) mats.set(k, track(new THREE.MeshStandardMaterial({ color, roughness: 0.85, ...o })));
    return mats.get(k);
  };
  const boxGeo = track(new THREE.BoxGeometry(1, 1, 1));
  const box = (w, h, d, m, x, y, z, { col = false, ry = 0, parent = root } = {}) => {
    const o = new THREE.Mesh(boxGeo, m);
    o.scale.set(w, h, d);
    o.position.set(x, y + h / 2, z);
    o.rotation.y = ry;
    o.castShadow = true;
    o.receiveShadow = true;
    parent.add(o);
    if (col) colliders.push({ minX: x - w / 2, maxX: x + w / 2, minZ: z - d / 2, maxZ: z + d / 2 });
    return o;
  };

  // ---------- Il terreno ----------
  {
    const size = 560;
    const seg = 224;
    const geo = new THREE.PlaneGeometry(size, size, seg, seg);
    geo.rotateX(-Math.PI / 2);
    const pos = geo.attributes.position;
    const col = new Float32Array(pos.count * 3);
    const c = new THREE.Color();
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const z = pos.getZ(i);
      const h = heightAt(x, z);
      pos.setY(i, h);
      const sl = Math.abs(heightAt(x + 1.5, z) - h) + Math.abs(heightAt(x, z + 1.5) - h);
      const v = N(x * 0.2, z * 0.2) * 0.04;
      const pd = pathDist(x, z);
      if (Math.hypot(x - BEACH.x, z - BEACH.z) < BEACH.r + 4 && h < 4.5) c.set('#3a3836');
      else if (pd < 2.6 && h > 0.8) c.set('#6a5a46');
      else if (Math.hypot(x - VILLAGE.x, z - VILLAGE.z) < VILLAGE.r && h > 1) c.set('#5a5a50');
      else if (h < 1.2) c.set('#2a3036');
      else if (sl > 1.6) c.set('#545a62');
      else if (Math.hypot(x - SILO.x, z - SILO.z) < SILO.r + 12) c.set('#6a6c6e');
      else c.set(sl > 0.8 ? '#62645e' : '#4a6040');
      c.offsetHSL(0, 0, v);
      col[i * 3] = c.r;
      col[i * 3 + 1] = c.g;
      col[i * 3 + 2] = c.b;
    }
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    geo.computeVertexNormals();
    const ground = new THREE.Mesh(track(geo), track(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95, flatShading: true })));
    ground.receiveShadow = true;
    root.add(ground);
  }

  // ---------- Il mare in tempesta: onde nel vertex shader, creste bianche ----------
  const seaUniforms = { uTime: { value: 0 } };
  {
    const geo = new THREE.PlaneGeometry(1800, 1800, 220, 220);
    geo.rotateX(-Math.PI / 2);
    const m = track(new THREE.MeshStandardMaterial({ color: '#34505a', roughness: 0.35, metalness: 0.1, flatShading: true }));
    m.onBeforeCompile = (sh) => {
      sh.uniforms.uTime = seaUniforms.uTime;
      sh.vertexShader = sh.vertexShader
        .replace('#include <common>', '#include <common>\nuniform float uTime;\nvarying float vCrest;')
        .replace(
          '#include <begin_vertex>',
          `#include <begin_vertex>
          vec3 wp = (modelMatrix * vec4(transformed, 1.0)).xyz;
          float w = sin(wp.x * 0.045 + uTime * 1.1) * 1.4 + sin(wp.z * 0.06 - uTime * 1.5) * 1.1 + sin((wp.x + wp.z) * 0.11 + uTime * 2.3) * 0.5 + sin((wp.x - wp.z) * 0.21 - uTime * 3.1) * 0.25;
          transformed.y += w;
          vCrest = w;`,
        );
      sh.fragmentShader = sh.fragmentShader
        .replace('#include <common>', '#include <common>\nvarying float vCrest;')
        .replace('#include <color_fragment>', '#include <color_fragment>\ndiffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.62, 0.68, 0.7), smoothstep(2.2, 3.1, vCrest));');
    };
    const sea = new THREE.Mesh(track(geo), m);
    sea.position.y = -0.4;
    root.add(sea);
  }

  // ---------- Il silo ----------
  const siloTex = (() => {
    const c = document.createElement('canvas');
    c.width = c.height = 256;
    const g = c.getContext('2d');
    g.fillStyle = '#7a8086';
    g.fillRect(0, 0, 256, 256);
    const rand = mulberry32(9);
    // pannelli
    for (let x = 0; x < 256; x += 64) {
      g.fillStyle = `rgba(0,0,0,${0.08 + rand() * 0.1})`;
      g.fillRect(x, 0, 64, 256);
      g.fillStyle = 'rgba(20,24,28,0.6)';
      g.fillRect(x, 0, 2, 256);
    }
    for (let y = 0; y < 256; y += 128) {
      g.fillStyle = 'rgba(20,24,28,0.6)';
      g.fillRect(0, y, 256, 3);
    }
    // i rivetti
    g.fillStyle = 'rgba(30,30,32,0.7)';
    for (let x = 6; x < 256; x += 64) for (let y = 8; y < 256; y += 12) {
      g.fillRect(x, y, 2, 2);
      g.fillRect(x + 54, y, 2, 2);
    }
    // ruggine che cola
    for (let i = 0; i < 30; i++) {
      const x = rand() * 256;
      const y = rand() * 200;
      const gr = g.createLinearGradient(0, y, 0, y + 40 + rand() * 80);
      gr.addColorStop(0, 'rgba(140,70,30,0.6)');
      gr.addColorStop(1, 'rgba(140,70,30,0)');
      g.fillStyle = gr;
      g.fillRect(x, y, 2 + rand() * 4, 120);
    }
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(10, 5);
    t.anisotropy = 4;
    return track(t);
  })();
  const steel = track(new THREE.MeshStandardMaterial({ map: siloTex, metalness: 0.55, roughness: 0.55 }));
  const S = SILO;
  {
    const wall = new THREE.Mesh(track(new THREE.CylinderGeometry(S.r, S.r, S.h, 64, 1, true)), steel);
    wall.position.set(S.x, S.base + S.h / 2, S.z);
    wall.castShadow = true;
    root.add(wall);
    const dome = new THREE.Mesh(track(new THREE.SphereGeometry(S.r, 48, 16, 0, Math.PI * 2, 0, Math.PI / 2)), steel);
    dome.scale.y = 0.32;
    dome.position.set(S.x, S.base + S.h, S.z);
    root.add(dome);
    // gli anelli di rinforzo
    const ringMat = mat('#4a5056', { metalness: 0.6, roughness: 0.5 });
    for (let y = 8; y < S.h; y += 12) {
      const ring = new THREE.Mesh(track(new THREE.TorusGeometry(S.r + 0.25, 0.4, 6, 64)), ringMat);
      ring.rotation.x = Math.PI / 2;
      ring.position.set(S.x, S.base + y, S.z);
      root.add(ring);
    }
    // la scala a pioli che sale fino in cima
    for (const a of [Math.PI * 0.75, Math.PI * 1.6]) {
      const x = S.x + Math.cos(a) * (S.r + 0.6);
      const z = S.z + Math.sin(a) * (S.r + 0.6);
      box(0.12, S.h, 0.12, ringMat, x - Math.sin(a) * 0.4, S.base, z + Math.cos(a) * 0.4);
      box(0.12, S.h, 0.12, ringMat, x + Math.sin(a) * 0.4, S.base, z - Math.cos(a) * 0.4);
    }
    // la base di cemento
    const plinth = new THREE.Mesh(track(new THREE.CylinderGeometry(S.r + 1.5, S.r + 2.5, 3, 64)), mat('#5a5c5e'));
    plinth.position.set(S.x, S.base - 1.4, S.z);
    root.add(plinth);
    // la scritta
    const tx = track(textTexture('SILO 13', { width: 1024, height: 256, font: '900 200px Inter, sans-serif', color: '#e8e0d0' }));
    const label = new THREE.Mesh(track(new THREE.CylinderGeometry(S.r + 0.05, S.r + 0.05, 9, 48, 1, true, -0.45, 0.9)), track(new THREE.MeshStandardMaterial({ map: tx, transparent: true, roughness: 0.8 })));
    label.position.set(S.x, S.base + 46, S.z);
    root.add(label);
    // il portone verso il molo: una saracinesca enorme, con la fessura di luce
    const dz = S.z + S.r;
    box(12, 16, 1.2, mat('#2a2e32', { metalness: 0.6, roughness: 0.5 }), S.x, S.base, dz + 0.2);
    box(10, 14, 0.4, mat('#14171a', { metalness: 0.5 }), S.x, S.base, dz + 0.9);
    const slit = new THREE.Mesh(boxGeo, track(new THREE.MeshBasicMaterial({ color: '#7af0d8' })));
    slit.scale.set(0.3, 13.6, 0.1);
    slit.position.set(S.x, S.base + 6.8, dz + 1.15);
    root.add(slit);
    for (let k = 0; k < 6; k++) box(10, 0.2, 0.1, mat('#3a3e42'), S.x, S.base + 1.5 + k * 2.2, dz + 1.12);
    // il collider: una corona di scatole intorno al cilindro
    for (let i = 0; i < 28; i++) {
      const a = (i / 28) * Math.PI * 2;
      const x = S.x + Math.cos(a) * (S.r - 1.5);
      const z = S.z + Math.sin(a) * (S.r - 1.5);
      colliders.push({ minX: x - 3.4, maxX: x + 3.4, minZ: z - 3.4, maxZ: z + 3.4 });
    }
    colliders.push({ minX: S.x - S.r + 3, maxX: S.x + S.r - 3, minZ: S.z - S.r + 3, maxZ: S.z + S.r - 3 });
  }
  // le luci rosse in cima, che lampeggiano, e il faro che gira sul mare
  const beacons = [];
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    const b = new THREE.Mesh(track(new THREE.SphereGeometry(0.5, 8, 6)), track(new THREE.MeshBasicMaterial({ color: '#ff2a1a' })));
    b.position.set(S.x + Math.cos(a) * (S.r - 0.5), S.base + S.h + 0.6, S.z + Math.sin(a) * (S.r - 0.5));
    root.add(b);
    beacons.push(b);
  }
  const beam = new THREE.Mesh(
    track(new THREE.ConeGeometry(14, 160, 24, 1, true)),
    track(new THREE.MeshBasicMaterial({ color: '#fff4c8', transparent: true, opacity: 0.07, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide })),
  );
  beam.geometry.translate(0, -80, 0);
  beam.geometry.rotateZ(Math.PI / 2);
  const beamPivot = new THREE.Group();
  beamPivot.position.set(S.x, S.base + S.h + 7, S.z);
  beamPivot.add(beam);
  beam.rotation.z = -0.12;
  const lamp = new THREE.Mesh(track(new THREE.CylinderGeometry(2.4, 2.4, 4, 16)), mat('#2a2e32', { metalness: 0.6 }));
  lamp.position.set(S.x, S.base + S.h + 5, S.z);
  root.add(lamp, beamPivot);

  // ---------- Il molo ----------
  const P = PIER;
  const wood = mat('#3a3028', { roughness: 0.9 });
  const rust = mat('#5a3a2a', { metalness: 0.4, roughness: 0.7 });
  {
    const len = P.z1 - P.z0;
    box(P.halfW * 2, 0.5, len, wood, P.x, P.y - 0.5, P.z0 + len / 2);
    for (let z = P.z0 + 4; z < P.z1; z += 8) {
      for (const sx of [-1, 1]) {
        const pile = new THREE.Mesh(track(new THREE.CylinderGeometry(0.35, 0.4, 14, 8)), rust);
        pile.position.set(P.x + sx * (P.halfW - 0.4), P.y - 7.4, z);
        root.add(pile);
      }
      // le ringhiere
      for (const sx of [-1, 1]) box(0.08, 1.1, 0.08, rust, P.x + sx * (P.halfW - 0.1), P.y - 0.05, z);
    }
    for (const sx of [-1, 1]) box(0.08, 0.08, len, rust, P.x + sx * (P.halfW - 0.1), P.y + 1.05, P.z0 + len / 2);
    // le bitte
    for (let z = P.z0 + 20; z < P.z1; z += 30) box(0.5, 0.6, 0.5, mat('#1a1a1c', { metalness: 0.6 }), P.x + P.halfW - 0.8, P.y - 0.05, z);
  }
  // i lampioni che dondolano nel vento
  const lamps = [];
  const bulbMat = track(new THREE.MeshBasicMaterial({ color: '#ffe0a0' }));
  const glow = track(glowTexture('rgba(255,224,160,1)'));
  for (let z = P.z0 + 12; z < P.z1; z += 24) {
    box(0.15, 5, 0.15, rust, P.x - P.halfW + 0.4, P.y - 0.05, z);
    box(1.2, 0.1, 0.1, rust, P.x - P.halfW + 0.9, P.y + 4.9, z);
    const head = new THREE.Group();
    head.position.set(P.x - P.halfW + 1.4, P.y + 4.85, z);
    const bulb = new THREE.Mesh(track(new THREE.SphereGeometry(0.22, 8, 6)), bulbMat);
    bulb.position.y = -0.6;
    const wire = new THREE.Mesh(boxGeo, rust);
    wire.scale.set(0.03, 0.6, 0.03);
    wire.position.y = -0.3;
    const halo = new THREE.Sprite(track(new THREE.SpriteMaterial({ map: glow, color: '#ffd890', blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0.6 })));
    halo.scale.set(3.2, 3.2, 1);
    halo.position.y = -0.6;
    head.add(bulb, wire, halo);
    root.add(head);
    lamps.push(head);
  }
  // una gru arrugginita a metà molo
  {
    const cz = P.z0 + 70;
    const cx = P.x + P.halfW - 1.2;
    box(1.2, 14, 1.2, mat('#8a5a2a', { metalness: 0.4 }), cx, P.y - 0.05, cz);
    const arm = box(16, 0.8, 0.8, mat('#8a5a2a', { metalness: 0.4 }), cx + 6, P.y + 13, cz);
    arm.rotation.y = 0.4;
    box(0.06, 8, 0.06, mat('#222'), cx + 13, P.y + 5.6, cz - 5);
  }

  // ---------- L'idrovolante ormeggiato in fondo al molo ----------
  const plane = new THREE.Group();
  {
    const white = mat('#e8e8e4', { roughness: 0.5 });
    const red = mat('#b83a2a');
    const fus = new THREE.Mesh(track(new THREE.CylinderGeometry(0.9, 0.6, 9, 12)), white);
    fus.rotation.x = Math.PI / 2;
    fus.position.y = 2.6;
    const wing = new THREE.Mesh(boxGeo, white);
    wing.scale.set(13, 0.18, 1.8);
    wing.position.set(0, 3.6, 0.6);
    const tail = new THREE.Mesh(boxGeo, red);
    tail.scale.set(0.15, 1.8, 1.4);
    tail.position.set(0, 3.4, -4.2);
    const stab = new THREE.Mesh(boxGeo, white);
    stab.scale.set(3.6, 0.12, 0.9);
    stab.position.set(0, 2.8, -4.2);
    const prop = new THREE.Mesh(boxGeo, mat('#222'));
    prop.scale.set(2.2, 0.15, 0.06);
    prop.position.set(0, 2.6, 4.6);
    plane.add(fus, wing, tail, stab, prop);
    for (const sx of [-1.4, 1.4]) {
      const fl = new THREE.Mesh(track(new THREE.CapsuleGeometry(0.35, 5, 4, 8)), red);
      fl.rotation.x = Math.PI / 2;
      fl.position.set(sx, 0.6, 0.4);
      const st = new THREE.Mesh(boxGeo, mat('#888'));
      st.scale.set(0.08, 1.6, 0.08);
      st.position.set(sx, 1.5, 0.4);
      plane.add(fl, st);
    }
    // accanto alla punta del pontile del porto, il muso verso il mare
    const pa = HARBOR.a + Math.PI / 2;
    plane.position.set(PLANE_SPOT.x + Math.cos(pa) * 6.5, 0, PLANE_SPOT.z + Math.sin(pa) * 6.5);
    plane.rotation.y = Math.atan2(Math.cos(HARBOR.a), Math.sin(HARBOR.a));
    root.add(plane);
  }

  // ---------- Il bunker con la porta 1313 ----------
  {
    const B = BUNKER;
    box(6, 3.4, 4.5, mat('#5a5c5a', { roughness: 1 }), B.x, SILO.base - 0.2, B.z, { col: true });
    box(6.6, 0.4, 5.1, mat('#4a4c4a'), B.x, SILO.base + 3.2, B.z);
    const dtex = track(textTexture('1313', { width: 256, height: 128, font: '800 80px Inter, sans-serif', color: '#ffe8a0' }));
    const door = new THREE.Mesh(boxGeo, mat('#2a6a4a'));
    door.scale.set(1.3, 2.3, 0.1);
    door.position.set(B.x, SILO.base + 1.15, B.z + 2.3);
    const num = new THREE.Mesh(track(new THREE.PlaneGeometry(1, 0.5)), track(new THREE.MeshBasicMaterial({ map: dtex, transparent: true })));
    num.position.set(B.x, SILO.base + 2.7, B.z + 2.27);
    root.add(door, num);
  }

  // ---------- Il pontile del porto di Porto Grigio ----------
  {
    const H = HARBOR;
    const dx = H.x1 - H.x0;
    const dz = H.z1 - H.z0;
    const L = Math.hypot(dx, dz);
    const ry = Math.atan2(dx, dz);
    const deck = new THREE.Mesh(boxGeo, wood);
    deck.scale.set(H.halfW * 2, 0.4, L + 3);
    deck.position.set((H.x0 + H.x1) / 2 - (dx / L) * 1.5, H.y - 0.35, (H.z0 + H.z1) / 2 - (dz / L) * 1.5);
    deck.rotation.y = ry;
    root.add(deck);
    for (let u = 2; u < L; u += 6) {
      for (const sv of [-1, 1]) {
        const px = H.x0 + (dx / L) * u + (dz / L) * sv * (H.halfW - 0.3);
        const pz = H.z0 + (dz / L) * u - (dx / L) * sv * (H.halfW - 0.3);
        const pile = new THREE.Mesh(track(new THREE.CylinderGeometry(0.25, 0.3, 8, 6)), wood);
        pile.position.set(px, H.y - 4, pz);
        root.add(pile);
      }
    }
  }

  // ---------- Il Faro Spento ----------
  const lightTex = (() => {
    const c = document.createElement('canvas');
    c.width = 64;
    c.height = 256;
    const g = c.getContext('2d');
    for (let i = 0; i < 8; i++) {
      g.fillStyle = i % 2 ? '#e8e4dc' : '#b83a2a';
      g.fillRect(0, i * 32, 64, 32);
    }
    g.fillStyle = 'rgba(40,30,20,0.25)';
    for (let i = 0; i < 40; i++) g.fillRect(Math.random() * 64, Math.random() * 256, 2, 10 + Math.random() * 30);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    return track(t);
  })();
  const LT = LIGHT;
  const toCenter = Math.atan2(-LT.x, -LT.z); // la porta guarda verso l'interno dell'isola
  const lightGroup = new THREE.Group();
  lightGroup.position.set(LT.x, LT.y, LT.z);
  root.add(lightGroup);
  {
    const tower = new THREE.Mesh(track(new THREE.CylinderGeometry(3, 4.2, 26, 24)), track(new THREE.MeshStandardMaterial({ map: lightTex, roughness: 0.8 })));
    tower.position.y = 13;
    const gallery = new THREE.Mesh(track(new THREE.CylinderGeometry(4.2, 4.2, 0.4, 24)), mat('#2a2a2e', { metalness: 0.6 }));
    gallery.position.y = 26.2;
    const roof = new THREE.Mesh(track(new THREE.ConeGeometry(3.2, 3, 16)), mat('#8a2a1e'));
    roof.position.y = 31;
    const base = new THREE.Mesh(track(new THREE.CylinderGeometry(5.5, 6, 1.2, 24)), mat('#5a5a58'));
    base.position.y = 0.2;
    lightGroup.add(tower, gallery, roof, base);
    const door = new THREE.Mesh(boxGeo, mat('#3a2a1e'));
    door.scale.set(1.5, 2.6, 0.3);
    door.position.set(Math.sin(toCenter) * 4.05, 1.9, Math.cos(toCenter) * 4.05);
    door.rotation.y = toCenter;
    lightGroup.add(door);
    colliders.push({ minX: LT.x - 4.4, maxX: LT.x + 4.4, minZ: LT.z - 4.4, maxZ: LT.z + 4.4 });
  }
  const lampMat = track(new THREE.MeshStandardMaterial({ color: '#4a4a48', emissive: '#ffe8a0', emissiveIntensity: 0, transparent: true, opacity: 0.8 }));
  const lampRoom = new THREE.Mesh(track(new THREE.CylinderGeometry(2.6, 2.6, 3, 16)), lampMat);
  lampRoom.position.y = 28;
  lightGroup.add(lampRoom);
  const lBeam = new THREE.Mesh(
    track(new THREE.ConeGeometry(10, 130, 20, 1, true)),
    track(new THREE.MeshBasicMaterial({ color: '#fff4c8', transparent: true, opacity: 0.09, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide })),
  );
  lBeam.geometry.translate(0, -65, 0);
  lBeam.geometry.rotateZ(Math.PI / 2);
  const lBeamPivot = new THREE.Group();
  lBeamPivot.position.y = 28;
  lBeamPivot.add(lBeam);
  lBeamPivot.visible = false;
  lightGroup.add(lBeamPivot);
  const lightDoor = new THREE.Vector3(LT.x + Math.sin(toCenter) * 6, LT.y, LT.z + Math.cos(toCenter) * 6);

  // ---------- La bocca delle grotte, sotto la scogliera ----------
  const CV = CAVE;
  const caveIn = Math.atan2(-CV.x, -CV.z);
  {
    const rockMat = mat('#2a2c30', { roughness: 0.75, flatShading: true });
    const g = new THREE.Group();
    g.position.set(CV.x, CV.y, CV.z);
    g.rotation.y = caveIn;
    root.add(g);
    const rk = track(new THREE.DodecahedronGeometry(1, 0));
    for (const [x, y, z, sc] of [[-5, 2, -2, 4.5], [5, 2, -2, 4.6], [0, 7, -3, 5.5], [-3, 6, -4, 4], [3.5, 6.5, -4, 4.2], [0, 3, -7, 6]]) {
      const r = new THREE.Mesh(rk, rockMat);
      r.position.set(x, y, z);
      r.scale.setScalar(sc);
      r.rotation.set(x, y, z);
      g.add(r);
    }
    const mouth = new THREE.Mesh(track(new THREE.CircleGeometry(2.8, 16)), track(new THREE.MeshBasicMaterial({ color: '#020304' })));
    mouth.scale.set(1, 1.3, 1);
    mouth.position.set(0, 2.6, 0.5);
    g.add(mouth);
  }
  const caveMouth = new THREE.Vector3(CV.x + Math.sin(caveIn) * 3.5, CV.y, CV.z + Math.cos(caveIn) * 3.5);

  // ---------- Le pietre che cantano ----------
  const stoneSpots = [];
  {
    const ST = STONES;
    const sm = mat('#5a5e60', { roughness: 0.9, flatShading: true });
    const rune = track(new THREE.MeshStandardMaterial({ color: '#2a3a40', emissive: '#5ad8ff', emissiveIntensity: 0.6 }));
    for (let i = 0; i < 7; i++) {
      const a = (i / 7) * Math.PI * 2 + 0.3;
      const x = ST.x + Math.cos(a) * 9;
      const z = ST.z + Math.sin(a) * 9;
      const y = heightAt(x, z);
      const st = new THREE.Mesh(boxGeo, sm);
      const h = 3.6 + (i % 3) * 0.8;
      st.scale.set(1.3, h, 0.8);
      st.position.set(x, y + h / 2 - 0.3, z);
      st.rotation.set(0.05 * Math.sin(i), -a, 0.06 * Math.cos(i * 2));
      root.add(st);
      const r = new THREE.Mesh(boxGeo, rune);
      r.scale.set(0.14, h * 0.6, 0.05);
      r.position.set(0, 0, 0.53);
      r.scale.divide(st.scale);
      st.add(r);
      colliders.push({ minX: x - 0.7, maxX: x + 0.7, minZ: z - 0.7, maxZ: z + 0.7 });
      stoneSpots.push(new THREE.Vector3(x - Math.cos(a) * 1.4, y, z - Math.sin(a) * 1.4));
    }
    const altar = new THREE.Mesh(boxGeo, sm);
    altar.scale.set(2.4, 1, 1.4);
    altar.position.set(ST.x, heightAt(ST.x, ST.z) + 0.4, ST.z);
    root.add(altar);
  }

  // ---------- Rocce sparse sulla riva ----------
  {
    const rand = mulberry32(21);
    const geo = track(new THREE.DodecahedronGeometry(1, 0));
    const inst = new THREE.InstancedMesh(geo, mat('#2a2c30', { roughness: 0.7, flatShading: true }), 260);
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const e = new THREE.Euler();
    let n = 0;
    for (let i = 0; i < 2000 && n < 260; i++) {
      const a = rand() * Math.PI * 2;
      const r = coastR(a) + (rand() - 0.6) * 18;
      const x = Math.cos(a) * r;
      const z = Math.sin(a) * r;
      if (Math.abs(x) < 10 && z > 80) continue;
      if (Math.hypot(x - VILLAGE.x, z - VILLAGE.z) < VILLAGE.r + 8 || pathDist(x, z) < 4 || Math.hypot(x - BEACH.x, z - BEACH.z) < BEACH.r || Math.hypot(x - CAVE.x, z - CAVE.z) < 12) continue;
      const h = heightAt(x, z);
      if (h < -2 || h > 9) continue;
      const s = 0.8 + rand() * 3.5;
      e.set(rand() * 3, rand() * 3, rand() * 3);
      q.setFromEuler(e);
      m.compose(new THREE.Vector3(x, h - s * 0.3, z), q, new THREE.Vector3(s, s * (0.6 + rand() * 1.4), s));
      inst.setMatrixAt(n++, m);
    }
    inst.count = n;
    inst.castShadow = true;
    root.add(inst);
  }

  return {
    colliders,
    seaUniforms,
    door: DOOR,
    planeSpot: PLANE_SPOT,
    door13: new THREE.Vector3(BUNKER.x, SILO.base, BUNKER.z + 3),
    lightDoor,
    caveMouth,
    stoneSpots,
    root,
    setLighthouseLit(on) {
      lampMat.emissiveIntensity = on ? 2.5 : 0;
      lBeamPivot.visible = on;
    },
    plane,
    update(t) {
      seaUniforms.uTime.value = t;
      beamPivot.rotation.y = t * 0.35;
      lBeamPivot.rotation.y = -t * 0.5;
      const on = Math.floor(t * 1.2) % 2 === 0;
      for (const b of beacons) b.visible = on;
      lamps.forEach((l, i) => {
        l.rotation.z = Math.sin(t * 1.7 + i) * 0.18;
        l.rotation.x = Math.sin(t * 1.3 + i * 2) * 0.1;
      });
      plane.position.y = Math.sin(t * 1.1) * 0.5 - 0.2;
      plane.rotation.z = Math.sin(t * 0.9) * 0.06;
    },
    dispose() {
      scene.remove(root);
      disposables.forEach((d) => d.dispose?.());
    },
  };
}
