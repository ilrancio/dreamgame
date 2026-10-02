import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { mulberry32 } from '../../core/noise.js';
import { textTexture, glowTexture } from '../../core/textures.js';
import { VILLAGE, HOTEL } from '../demone/terrain.js';

// Sant'Onirio, il borgo in vetta: case di pietra e intonaco, balconi di legno
// con i gerani, la piazza con la fontana, la chiesa con il campanile, il bar.
// Tutto è in coordinate del mondo; il borgo sta sull'altopiano piatto.
export const VILLAGE_NAME = 'Sant\'Onirio';
export const VILLAGE_ALT = '1913 m';

function canvasTex(w, h, draw, repeat = [1, 1]) {
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

const cobbleTex = (rep) =>
  canvasTex(256, 256, (g, w) => {
    g.fillStyle = '#5a554e';
    g.fillRect(0, 0, w, w);
    for (let y = 0; y < w; y += 16) {
      for (let x = (y / 16) % 2 ? -8 : 0; x < w; x += 16) {
        const v = 110 + Math.random() * 50;
        g.fillStyle = `rgb(${v},${v * 0.95},${v * 0.88})`;
        g.beginPath();
        g.ellipse(x + 8, y + 8, 7, 6.5, Math.random(), 0, Math.PI * 2);
        g.fill();
      }
    }
  }, rep);

const stoneWallTex = () =>
  canvasTex(256, 256, (g, w) => {
    g.fillStyle = '#6a645c';
    g.fillRect(0, 0, w, w);
    for (let y = 0; y < w; y += 20) {
      let x = -Math.random() * 30;
      while (x < w) {
        const bw = 22 + Math.random() * 26;
        const v = 120 + Math.random() * 50;
        g.fillStyle = `rgb(${v},${v * 0.96},${v * 0.9})`;
        g.fillRect(x + 1.5, y + 1.5, bw - 3, 17);
        x += bw;
      }
    }
  }, [2, 2]);

const plasterTex = (col) =>
  canvasTex(128, 128, (g, w) => {
    g.fillStyle = col;
    g.fillRect(0, 0, w, w);
    for (let i = 0; i < 900; i++) {
      g.fillStyle = `rgba(0,0,0,${Math.random() * 0.06})`;
      g.fillRect(Math.random() * w, Math.random() * w, 2, 2);
    }
  }, [2, 2]);

const stripesTex = () =>
  canvasTex(64, 64, (g, w) => {
    for (let x = 0; x < w; x += 16) {
      g.fillStyle = (x / 16) % 2 ? '#f2ece0' : '#2a7a4a';
      g.fillRect(x, 0, 16, w);
    }
  }, [3, 1]);

export function buildVillage(scene, terrain) {
  const rand = mulberry32(1913);
  const C = new THREE.Vector3(VILLAGE.x, terrain.heightAt(VILLAGE.x, VILLAGE.z), VILLAGE.z);
  const Y = C.y;
  const disposables = [];
  const track = (o) => (disposables.push(o), o);
  const staticGroup = new THREE.Group();
  const dyn = new THREE.Group();
  scene.add(staticGroup, dyn);
  const colliders = []; // rettangoli { minX, maxX, minZ, maxZ }
  const matCache = new Map();
  const mat = (color, opts = {}) => {
    const key = color + JSON.stringify(opts);
    if (!matCache.has(key)) matCache.set(key, track(new THREE.MeshStandardMaterial({ color, roughness: 0.9, ...opts })));
    return matCache.get(key);
  };
  const boxGeo = track(new THREE.BoxGeometry(1, 1, 1));
  const box = (w, h, d, m, x, y, z, { rotY = 0, collide = false, parent = staticGroup } = {}) => {
    const o = new THREE.Mesh(boxGeo, m);
    o.scale.set(w, h, d);
    o.position.set(x, y, z);
    o.rotation.y = rotY;
    parent.add(o);
    if (collide) {
      const c = Math.abs(Math.cos(rotY));
      const s = Math.abs(Math.sin(rotY));
      const ex = (w * c + d * s) / 2;
      const ez = (w * s + d * c) / 2;
      colliders.push({ minX: x - ex, maxX: x + ex, minZ: z - ez, maxZ: z + ez });
    }
    return o;
  };
  const mesh = (geo, m, x, y, z, parent = staticGroup) => {
    const o = new THREE.Mesh(track(geo), m);
    o.position.set(x, y, z);
    parent.add(o);
    return o;
  };
  const glow = track(glowTexture('rgba(255,255,255,1)'));
  const lamps = [];
  const sprite = (color, x, y, z, size, opacity = 0.7) => {
    const s = new THREE.Sprite(track(new THREE.SpriteMaterial({ map: glow, color, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity })));
    s.position.set(x, y, z);
    s.scale.set(size, size, 1);
    dyn.add(s);
    return s;
  };

  // ---------- Il selciato del paese ----------
  const paving = mesh(new THREE.CircleGeometry(VILLAGE.r - 6, 64), track(new THREE.MeshStandardMaterial({ map: track(cobbleTex([28, 28])), roughness: 1 })), C.x, Y + 0.04, C.z);
  paving.rotation.x = -Math.PI / 2;
  const piazza = mesh(new THREE.CircleGeometry(17, 48), track(new THREE.MeshStandardMaterial({ map: track(cobbleTex([6, 6])), color: '#d8cfc0', roughness: 1 })), C.x, Y + 0.06, C.z);
  piazza.rotation.x = -Math.PI / 2;

  // ---------- Materiali delle case ----------
  const stone = track(new THREE.MeshStandardMaterial({ map: track(stoneWallTex()), roughness: 1 }));
  const plasters = ['#e6d2a8', '#efe6d4', '#e2b49a', '#d8a070', '#f0dcc0'].map((c) => track(new THREE.MeshStandardMaterial({ map: track(plasterTex(c)), roughness: 1 })));
  const roofCols = [mat('#4a4a52'), mat('#a8502a'), mat('#5a5048')];
  const wood = mat('#5a3a22');
  const darkWood = mat('#3a2416');
  const shutter = mat('#2f6a3a');
  const windowMat = track(new THREE.MeshStandardMaterial({ color: '#2a3040', emissive: '#ffb860', emissiveIntensity: 0 }));
  const geranium = mat('#d82a2a');
  const leaf = mat('#3a6a2a');

  const roofGeo = (w, d, h) => {
    const s = new THREE.Shape();
    s.moveTo(-w / 2 - 0.5, 0);
    s.lineTo(0, h);
    s.lineTo(w / 2 + 0.5, 0);
    s.lineTo(-w / 2 - 0.5, 0);
    const g = new THREE.ExtrudeGeometry(s, { depth: d + 1, bevelEnabled: false });
    g.translate(0, 0, -(d + 1) / 2);
    return g;
  };

  // Una casa di montagna: base di pietra, uno o due piani, tetto a falde,
  // persiane verdi, a volte un balcone di legno con i gerani.
  const house = (x, z, rotY, w, d, floors, kind) => {
    const g = new THREE.Group();
    g.position.set(x, Y, z);
    g.rotation.y = rotY;
    staticGroup.add(g);
    const H = floors * 3;
    const wallMat = kind === 'stone' ? stone : plasters[Math.floor(rand() * plasters.length)];
    box(w + 0.3, 0.9, d + 0.3, stone, 0, 0.45, 0, { parent: g });
    box(w, H, d, wallMat, 0, H / 2, 0, { parent: g });
    const roof = new THREE.Mesh(track(roofGeo(w, d, Math.min(3.2, w * 0.38))), roofCols[Math.floor(rand() * roofCols.length)]);
    roof.position.y = H;
    roof.rotation.y = Math.PI / 2;
    g.add(roof);
    if (rand() < 0.8) box(0.8, 2.2, 0.8, stone, w * 0.25, H + 1.6, d * 0.2, { parent: g });
    // facciata verso +z (verso la piazza o il vicolo)
    const front = d / 2 + 0.03;
    box(1.1, 2.1, 0.12, darkWood, 0, 1.05, front, { parent: g });
    for (let f = 0; f < floors; f++) {
      const wy = 1.6 + f * 3;
      const cols = Math.max(2, Math.floor(w / 3));
      for (let k = 0; k < cols; k++) {
        const wx = -w / 2 + (k + 0.5) * (w / cols);
        if (f === 0 && Math.abs(wx) < 1.2) continue;
        box(0.8, 1.1, 0.08, windowMat, wx, wy, front, { parent: g });
        box(0.42, 1.2, 0.06, shutter, wx - 0.62, wy, front + 0.03, { parent: g });
        box(0.42, 1.2, 0.06, shutter, wx + 0.62, wy, front + 0.03, { parent: g });
        if (rand() < 0.45) {
          box(0.9, 0.18, 0.25, mat('#8a4a2a'), wx, wy - 0.68, front + 0.13, { parent: g });
          for (let q = -1; q <= 1; q++) box(0.18, 0.16, 0.16, rand() < 0.7 ? geranium : mat('#f0e8f0'), wx + q * 0.28, wy - 0.5, front + 0.13, { parent: g });
        }
      }
    }
    if (floors >= 2 && rand() < 0.55) {
      // balcone di legno al primo piano
      box(w * 0.75, 0.15, 1.1, wood, 0, 3.05, front + 0.55, { parent: g });
      box(w * 0.75, 0.9, 0.06, wood, 0, 3.55, front + 1.08, { parent: g });
      for (let q = 0; q < Math.floor(w * 0.75 / 0.5); q++) box(0.22, 0.2, 0.22, geranium, -w * 0.36 + q * 0.5 + 0.2, 4.1, front + 1.0, { parent: g });
    }
    if (rand() < 0.35) {
      // catasta di legna sul fianco
      for (let r = 0; r < 3; r++)
        for (let q = 0; q < 4; q++) {
          const log = new THREE.Mesh(track(new THREE.CylinderGeometry(0.13, 0.13, 1, 7)), mat('#7a5232'));
          log.rotation.x = Math.PI / 2;
          log.position.set(w / 2 + 0.25, 0.15 + r * 0.26, -d / 4 + q * 0.27 - 0.4);
          g.add(log);
        }
    }
    // rettangolo di collisione (ruotato al più di 90° multipli: calcolato sugli angoli)
    const c = Math.abs(Math.cos(rotY));
    const s = Math.abs(Math.sin(rotY));
    const ex = ((w + 0.4) * c + (d + 0.4) * s) / 2;
    const ez = ((w + 0.4) * s + (d + 0.4) * c) / 2;
    colliders.push({ minX: x - ex, maxX: x + ex, minZ: z - ez, maxZ: z + ez });
    return { g, H, w, d };
  };

  // ---------- La chiesa con il campanile (lato nord della piazza) ----------
  const church = { x: C.x, z: C.z + 32 };
  const white = plasters[1];
  box(12.4, 1, 22.4, stone, church.x, Y + 0.5, church.z, { collide: true });
  box(12, 10, 22, white, church.x, Y + 5, church.z);
  const cRoof = new THREE.Mesh(track(roofGeo(12, 22, 4.5)), roofCols[1]);
  cRoof.position.set(church.x, Y + 10, church.z);
  staticGroup.add(cRoof);
  const gable = new THREE.Shape();
  gable.moveTo(-6, 0);
  gable.lineTo(0, 4.5);
  gable.lineTo(6, 0);
  const gm = mesh(new THREE.ShapeGeometry(gable), white, church.x, Y + 10, church.z - 11.52);
  gm.rotation.y = Math.PI;
  box(2.4, 4, 0.3, darkWood, church.x, Y + 2, church.z - 11.1);
  const roseMat = track(new THREE.MeshStandardMaterial({ color: '#c84a6a', emissive: '#ff8ab0', emissiveIntensity: 0.3 }));
  const rose = mesh(new THREE.CircleGeometry(1.4, 24), roseMat, church.x, Y + 7.2, church.z - 11.12);
  rose.rotation.y = Math.PI;
  box(1.2, 0.8, 0.12, mat('#c9a040', { metalness: 0.6, roughness: 0.3 }), church.x, Y + 4.6, church.z - 11.1);
  // campanile
  const tower = { x: church.x + 8.2, z: church.z + 7 };
  box(4.2, 24, 4.2, stone, tower.x, Y + 12, tower.z, { collide: true });
  for (const [dx, dz, ry] of [[0, -2.12, 0], [0, 2.12, 0], [-2.12, 0, Math.PI / 2], [2.12, 0, Math.PI / 2]]) box(1.4, 2.6, 0.1, mat('#1a1410'), tower.x + dx, Y + 20.5, tower.z + dz, { rotY: ry });
  const spire = mesh(new THREE.ConeGeometry(3.3, 5, 4), roofCols[1], tower.x, Y + 26.5, tower.z);
  spire.rotation.y = Math.PI / 4;
  const bell = mesh(new THREE.CylinderGeometry(0.4, 0.75, 1.1, 14, 1, true), mat('#c9a040', { metalness: 0.7, roughness: 0.3, side: THREE.DoubleSide }), tower.x, Y + 20.6, tower.z, dyn);
  const bellRope = { x: tower.x, z: tower.z - 3 };
  box(0.05, 2.2, 0.05, mat('#c8b890'), tower.x - 0.8, Y + 1.4, tower.z - 2.15);

  // ---------- La fontana al centro della piazza ----------
  mesh(new THREE.CylinderGeometry(2.4, 2.6, 0.8, 8), stone, C.x, Y + 0.4, C.z);
  const water = mesh(new THREE.CylinderGeometry(2.15, 2.15, 0.05, 8), track(new THREE.MeshStandardMaterial({ color: '#6ab0c8', roughness: 0.1, transparent: true, opacity: 0.85 })), C.x, Y + 0.7, C.z, dyn);
  void water;
  mesh(new THREE.CylinderGeometry(0.3, 0.4, 2.2, 10), stone, C.x, Y + 1.5, C.z);
  mesh(new THREE.CylinderGeometry(0.8, 0.5, 0.3, 10), stone, C.x, Y + 2.6, C.z);
  colliders.push({ minX: C.x - 2.4, maxX: C.x + 2.4, minZ: C.z - 2.4, maxZ: C.z + 2.4 });

  // ---------- Il Bar Alpino (lato sud della piazza) ----------
  const bar = { x: C.x, z: C.z - 27 };
  const barHouse = house(bar.x, bar.z, 0, 12, 8, 2, 'plaster');
  void barHouse;
  const awn = box(11, 0.12, 2.6, track(new THREE.MeshStandardMaterial({ map: track(stripesTex()), roughness: 1 })), bar.x, Y + 3, bar.z + 5.2);
  awn.rotation.x = -0.25;
  const signTex = track(textTexture('BAR ALPINO', { width: 512, height: 96, font: '700 60px Cormorant Garamond, serif', color: '#f4e6c0', bg: '#2a4a2a' }));
  const sign = mesh(new THREE.PlaneGeometry(5, 0.95), track(new THREE.MeshStandardMaterial({ map: signTex, emissive: '#ffffff', emissiveMap: signTex, emissiveIntensity: 0.3 })), bar.x, Y + 3.9, bar.z + 4.08);
  void sign;
  const tables = [];
  for (const dx of [-3.5, 0, 3.5]) {
    const tz = bar.z + 7.4;
    mesh(new THREE.CylinderGeometry(0.5, 0.5, 0.05, 16), mat('#e8e4dc'), bar.x + dx, Y + 0.76, tz);
    mesh(new THREE.CylinderGeometry(0.05, 0.08, 0.74, 8), mat('#3a3a3a'), bar.x + dx, Y + 0.37, tz);
    for (const sx of [-1, 1]) {
      box(0.45, 0.06, 0.45, mat('#c8c0b0'), bar.x + dx + sx * 0.85, Y + 0.46, tz);
      box(0.06, 0.6, 0.45, mat('#c8c0b0'), bar.x + dx + sx * 1.08, Y + 0.76, tz);
    }
    tables.push({ x: bar.x + dx, z: tz });
  }
  // ombrellone sul tavolo centrale
  mesh(new THREE.CylinderGeometry(0.03, 0.03, 2.4, 6), mat('#3a3a3a'), bar.x, Y + 1.2, bar.z + 7.4);
  mesh(new THREE.ConeGeometry(1.8, 0.6, 8, 1, true), mat('#c83a2a', { side: THREE.DoubleSide }), bar.x, Y + 2.5, bar.z + 7.4);

  // ---------- Il belvedere con il cannocchiale, verso l'hotel ----------
  const toHotel = new THREE.Vector2(HOTEL.x - C.x, HOTEL.z - C.z).normalize();
  const bel = { x: C.x + toHotel.x * (VILLAGE.r - 18), z: C.z + toHotel.y * (VILLAGE.r - 18) };
  const belYaw = Math.atan2(toHotel.x, toHotel.y);
  for (let k = -4; k <= 4; k++) {
    const a = belYaw + k * 0.09;
    const r = VILLAGE.r - 13.5;
    const px = C.x + Math.sin(a) * r;
    const pz = C.z + Math.cos(a) * r;
    box(0.12, 1.1, 0.12, mat('#2a2a2a'), px, Y + 0.55, pz);
    if (k < 4) {
      const a2 = belYaw + (k + 1) * 0.09;
      const qx = C.x + Math.sin(a2) * r;
      const qz = C.z + Math.cos(a2) * r;
      box(Math.hypot(qx - px, qz - pz), 0.06, 0.06, mat('#2a2a2a'), (px + qx) / 2, Y + 1.08, (pz + qz) / 2, { rotY: Math.atan2(-(qz - pz), qx - px) });
    }
  }
  const scopePos = new THREE.Vector3(bel.x + toHotel.x * 2, Y, bel.z + toHotel.y * 2);
  mesh(new THREE.CylinderGeometry(0.05, 0.12, 1.2, 6), mat('#3a3a3a'), scopePos.x, Y + 0.6, scopePos.z);
  const scope = mesh(new THREE.CylinderGeometry(0.1, 0.16, 0.9, 12), mat('#8a7a5a', { metalness: 0.6, roughness: 0.3 }), scopePos.x, Y + 1.35, scopePos.z);
  scope.rotation.set(Math.PI / 2 - 0.1, 0, 0);
  scope.rotation.order = 'YXZ';
  scope.rotation.y = belYaw;
  box(2.4, 0.45, 0.6, wood, bel.x - toHotel.y * 3, Y + 0.23, bel.z + toHotel.x * 3, { rotY: belYaw + Math.PI / 2 });

  // ---------- Cartello d'ingresso ed edicola votiva ----------
  const entry = { x: C.x + 88, z: C.z + 12 };
  const welcome = track(textTexture(`${VILLAGE_NAME}\n${VILLAGE_ALT} s.l.m.`, { width: 512, height: 220, font: '600 64px Cormorant Garamond, serif', color: '#f4f0e6', bg: '#7a3a2a' }));
  const wsign = mesh(new THREE.PlaneGeometry(3.2, 1.4), track(new THREE.MeshStandardMaterial({ map: welcome, side: THREE.DoubleSide })), entry.x, Y + 2.4, entry.z);
  wsign.rotation.y = Math.atan2(1, 0.6);
  box(0.12, 2, 0.12, mat('#3a3a3a'), entry.x, Y + 1, entry.z);
  box(1.2, 2, 0.8, stone, entry.x - 6, Y + 1, entry.z + 4);
  box(0.8, 0.9, 0.1, mat('#3a5ab0'), entry.x - 6, Y + 1.3, entry.z + 3.58);
  const candle = sprite('#ffb050', entry.x - 6, Y + 0.95, entry.z + 3.5, 0.9, 0.9);
  lamps.push({ s: candle, size: 0.9, always: true });

  // ---------- Le case, lungo i vicoli intorno alla piazza ----------
  const roadSegs = [];
  for (let i = terrain.upperStart; i < terrain.road.length; i++) roadSegs.push(terrain.road[i]);
  const nearRoad = (x, z, r) => roadSegs.some((p) => Math.hypot(p.x - x, p.z - z) < r);
  const placed = [];
  for (let tries = 0; tries < 900 && placed.length < 30; tries++) {
    const a = rand() * Math.PI * 2;
    const r = 26 + rand() * (VILLAGE.r - 40);
    const x = C.x + Math.sin(a) * r;
    const z = C.z + Math.cos(a) * r;
    const w = 7 + Math.floor(rand() * 4);
    const d = 6 + Math.floor(rand() * 3);
    const rad = Math.max(w, d) * 0.62;
    if (Math.hypot(x - C.x, z - C.z) + rad > VILLAGE.r - 14) continue;
    if (placed.some((p) => Math.hypot(p.x - x, p.z - z) < p.rad + rad + 3.5)) continue;
    if (Math.hypot(x - church.x, z - church.z) < 16 + rad || Math.hypot(x - tower.x, z - tower.z) < 6 + rad) continue;
    if (Math.hypot(x - bar.x, z - (bar.z + 3)) < 12 + rad) continue;
    if (Math.hypot(x - bel.x, z - bel.z) < 16 + rad) continue;
    if (Math.hypot(x - entry.x, z - entry.z) < 12 + rad) continue;
    if (nearRoad(x, z, 14 + rad)) continue;
    // la facciata guarda verso la piazza: angolo arrotondato a 90° per allineare i vicoli
    const face = Math.round(Math.atan2(C.x - x, C.z - z) / (Math.PI / 2)) * (Math.PI / 2);
    house(x, z, face, w, d, rand() < 0.65 ? 2 : 3, rand() < 0.45 ? 'stone' : 'plaster');
    placed.push({ x, z, rad });
  }

  // ---------- Lampioni e panchine intorno alla piazza ----------
  for (let k = 0; k < 8; k++) {
    const a = (k / 8) * Math.PI * 2 + 0.2;
    const x = C.x + Math.sin(a) * 15;
    const z = C.z + Math.cos(a) * 15;
    box(0.12, 3.4, 0.12, mat('#1a1a1a'), x, Y + 1.7, z);
    box(0.35, 0.4, 0.35, mat('#2a2a2a'), x, Y + 3.5, z);
    lamps.push({ s: sprite('#ffcf7a', x, Y + 3.4, z, 3, 0), size: 3 });
    if (k % 2 === 0) box(1.8, 0.45, 0.5, wood, C.x + Math.sin(a + 0.25) * 12, Y + 0.23, C.z + Math.cos(a + 0.25) * 12, { rotY: a });
  }
  // fili del bucato fra alcune case vicine
  let lines = 0;
  for (let i = 0; i < placed.length && lines < 5; i++)
    for (let j = i + 1; j < placed.length && lines < 5; j++) {
      const p = placed[i];
      const q = placed[j];
      const dd = Math.hypot(p.x - q.x, p.z - q.z);
      if (dd > 9 && dd < 16) {
        lines++;
        const mx = (p.x + q.x) / 2;
        const mz = (p.z + q.z) / 2;
        const yaw = Math.atan2(-(q.z - p.z), q.x - p.x);
        box(dd - 4, 0.02, 0.02, mat('#d8d8d8'), mx, Y + 4.5, mz, { rotY: yaw });
        for (let k = -2; k <= 2; k++) {
          const cols = ['#e8e8f0', '#c83a3a', '#3a6ac8', '#f0d040', '#f0f0e8'];
          box(0.6, 0.8, 0.03, mat(cols[(k + 2 + i) % 5]), mx + Math.cos(yaw) * k * 1.1, Y + 4.05, mz - Math.sin(yaw) * k * 1.1, { rotY: yaw });
        }
      }
    }

  // ---------- Gli abitanti ----------
  const npcs = [
    { at: [C.x - 5.5, C.z + 9.5], facing: Math.PI, who: 'Due anziani sulla panchina:', lines: ['Scopa! ...No, aspetta, quella era una briscola.', 'Su all\'hotel ci siamo stati anche noi. Una volta. Ci siamo ancora, credo.', 'Il campanile suona quando vuole lui, non quando dovrebbe.'], sit: true, look: ['#c89a7a', '#d8d8d8', '#4a3a6a'] },
    { at: [C.x - 6.3, C.z + 9.5], facing: Math.PI, who: null, lines: null, sit: true, look: ['#b88a6a', '#888', '#6a2a1a'] },
    { at: [bar.x + 1.5, bar.z + 4.6], facing: 0, who: 'Il barista:', lines: ['Un caffè? Accomodatevi pure ai tavolini.', 'Quassù il caffè bolle prima. Sarà l\'altitudine. O il sogno.', 'L\'hotel? Di qui si vede col cannocchiale, dal belvedere.'], look: ['#e0b089', '#2a1a10', '#f4f4f4'] },
    { at: [bel.x - toHotel.y * 6, bel.z + toHotel.x * 6], facing: belYaw, who: 'Una signora con lo scialle:', lines: ['Di notte, laggiù nel campo, si vede un bagliore rosso. Non si muove mai.', 'I gnomi? Vengono su a giugno. Sono innocui. Quasi sempre.', 'Bella vista, vero? Non stancatevi di guardarla.'], look: ['#d8a888', '#b8b8c0', '#6a2a4a'] },
  ];

  // ---------- Unione della geometria statica: molte meno chiamate di disegno ----------
  staticGroup.updateMatrixWorld(true);
  const byMat = new Map();
  staticGroup.traverse((o) => {
    if (!o.isMesh) return;
    let g = o.geometry.clone();
    g.applyMatrix4(o.matrixWorld);
    if (g.index) g = g.toNonIndexed();
    for (const n of Object.keys(g.attributes)) if (!['position', 'normal', 'uv'].includes(n)) g.deleteAttribute(n);
    if (!g.attributes.uv) g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2));
    if (!byMat.has(o.material)) byMat.set(o.material, []);
    byMat.get(o.material).push(g);
  });
  const merged = new THREE.Group();
  for (const [m, geos] of byMat) {
    const g = mergeGeometries(geos, false);
    geos.forEach((q) => q.dispose());
    if (!g) continue;
    track(g);
    const o = new THREE.Mesh(g, m);
    o.castShadow = true;
    o.receiveShadow = true;
    merged.add(o);
  }
  staticGroup.removeFromParent();
  scene.add(merged);

  return {
    center: C,
    colliders,
    npcs,
    tables,
    bar,
    bellRope,
    bell,
    fountain: new THREE.Vector3(C.x, Y, C.z),
    scope: scopePos,
    scopeLook: new THREE.Vector3(HOTEL.x, terrain.heightAt(HOTEL.x, HOTEL.z) + 20, HOTEL.z),
    belYaw,
    entry,
    setNight(k) {
      windowMat.emissiveIntensity = 1.6 * k;
      roseMat.emissiveIntensity = 0.3 + 1.5 * k;
      for (const l of lamps) if (!l.always) l.s.material.opacity = 0.85 * k;
    },
    update(t) {
      candle.scale.setScalar(0.9 + Math.sin(t * 9) * 0.08);
    },
    dispose() {
      disposables.forEach((d) => d.dispose());
      merged.removeFromParent();
      dyn.removeFromParent();
    },
  };
}
