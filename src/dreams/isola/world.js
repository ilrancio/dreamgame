import * as THREE from 'three';
import { mulberry32, createNoise2D, clamp } from '../../core/noise.js';
import { textTexture, glowTexture } from '../../core/textures.js';
import { Batch, mtx, canvasTex, scatterKit } from '../costa/world.js';
import { models } from '../../core/models.js';
import { EXT, M, TERRACES, STRIP, RUINS, LIGHT, ISLET, PIER_X, shoreR, shoreDist } from './terrain.js';

// L'isola come si vede: sabbia, prato, palme, la montagna a gradoni, il faro
// a strisce, le rovine, il villaggio con l'hangar degli aeroplani usati, il
// pontile con l'idrovolante. E le cose da raccogliere: monete, pagine, anelli.

export const PLANE_PRICE = 100;
export const RACE = { cx: 150, cz: 58, r: 36, time: 38 };
export const SHOP = { x: 110, z: 140 };
export const PILOT_HOME = { x: -20, z: 132 };

export function buildIsland(scene, T) {
  const disposables = [];
  const track = (o) => (disposables.push(o), o);
  const root = new THREE.Group();
  scene.add(root);
  const rand = mulberry32(88);
  const noise = createNoise2D(12);
  const matCache = new Map();
  const mat = (color, o = {}) => {
    const key = color + JSON.stringify(o);
    if (!matCache.has(key)) matCache.set(key, track(new THREE.MeshStandardMaterial({ color, roughness: 0.85, ...o })));
    return matCache.get(key);
  };
  const boxGeo = track(new THREE.BoxGeometry(1, 1, 1));
  const cylGeo = track(new THREE.CylinderGeometry(0.5, 0.5, 1, 14));
  const batch = new Batch();
  const colliders = [];
  const ground = (x, z) => T.heightAt(x, z);
  const box = (w, h, d, m, x, y, z, ry = 0, { col = false, top } = {}) => {
    batch.add(boxGeo, m, mtx(x, y + h / 2, z, ry, w, h, d));
    if (col) {
      const c = Math.abs(Math.cos(ry));
      const s = Math.abs(Math.sin(ry));
      const hw = (w * c + d * s) / 2;
      const hd = (w * s + d * c) / 2;
      colliders.push({ minX: x - hw, maxX: x + hw, minZ: z - hd, maxZ: z + hd, top: top ?? y + h });
    }
  };
  const cyl = (r, h, m, x, y, z, segTop = r) => {
    const g = segTop === r ? cylGeo : track(new THREE.CylinderGeometry(segTop, r, 1, 14));
    batch.add(g, m, mtx(x, y + h / 2, z, 0, segTop === r ? r * 2 : 1, h, segTop === r ? r * 2 : 1));
  };
  const label = (text, w, h, x, y, z, ry, { bg = '#ffffff', color = '#1a1a1a', font = '800 70px Inter, sans-serif' } = {}) => {
    const tex = track(textTexture(text, { width: 1024, height: Math.round((1024 * h) / w), font, color, bg }));
    const m = new THREE.Mesh(track(new THREE.PlaneGeometry(w, h)), track(new THREE.MeshBasicMaterial({ map: tex, side: THREE.DoubleSide })));
    m.position.set(x, y, z);
    m.rotation.y = ry;
    root.add(m);
    return m;
  };

  // ---------- Il terreno ----------
  const C = 3;
  const n = Math.round((EXT * 2) / C) + 1;
  const pos = new Float32Array(n * n * 3);
  const col = new Float32Array(n * n * 3);
  const cSand = new THREE.Color('#f2e2b4');
  const cWet = new THREE.Color('#d8c48e');
  const cDeep = new THREE.Color('#3aa8a0');
  const cGrass = new THREE.Color('#5aa83a');
  const cGrass2 = new THREE.Color('#86b84a');
  const cRock = new THREE.Color('#a8705a');
  const cRock2 = new THREE.Color('#8a5a48');
  const cPath = new THREE.Color('#c8a878');
  const tc = new THREE.Color();
  const nrm = new THREE.Vector3();
  for (let j = 0; j < n; j++) {
    for (let i = 0; i < n; i++) {
      const x = -EXT + i * C;
      const z = -EXT + j * C;
      const h = ground(x, z);
      const k = (j * n + i) * 3;
      pos[k] = x;
      pos[k + 1] = h;
      pos[k + 2] = z;
      const s = shoreDist(x, z);
      T.normalAt(x, z, nrm, 1.5);
      const nn = noise(x * 0.04, z * 0.04);
      if (h < -0.3) tc.copy(cWet).lerp(cDeep, clamp(-h / 5, 0, 1));
      else if (h < 2.3 && (s < 20 || Math.hypot(x - ISLET.x, z - ISLET.z) < ISLET.r + 2)) tc.copy(s < 2 ? cWet : cSand);
      else if (nrm.y < 0.6) tc.copy(cRock).lerp(cRock2, clamp(0.5 + nn, 0, 1));
      else if (T.rampAt(x, z) >= h - 0.05) tc.copy(cPath);
      else tc.copy(cGrass).lerp(cGrass2, clamp(0.5 + nn * 1.3, 0, 1));
      col[k] = tc.r;
      col[k + 1] = tc.g;
      col[k + 2] = tc.b;
    }
  }
  const idx = [];
  for (let j = 0; j < n - 1; j++) {
    for (let i = 0; i < n - 1; i++) {
      const a = j * n + i;
      idx.push(a, a + n, a + 1, a + 1, a + n, a + n + 1);
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
  const seaGeo = track(new THREE.PlaneGeometry(5000, 5000, 120, 120));
  seaGeo.rotateX(-Math.PI / 2);
  const seaBase = seaGeo.attributes.position.array.slice();
  const sea = new THREE.Mesh(seaGeo, track(new THREE.MeshStandardMaterial({ color: '#1aa0c8', roughness: 0.15, metalness: 0.1, transparent: true, opacity: 0.72 })));
  sea.receiveShadow = true;
  root.add(sea);
  const foamMat = track(new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.5, depthWrite: false }));
  const foam = (() => {
    const p = [];
    const ix = [];
    const steps = 360;
    for (let i = 0; i <= steps; i++) {
      const th = (i / steps) * Math.PI * 2;
      const r = shoreR(th);
      for (const d of [-1.2, 1.6]) p.push(Math.cos(th) * (r + d), 0.05, Math.sin(th) * (r + d));
      if (i) ix.push(i * 2 - 2, i * 2, i * 2 - 1, i * 2 - 1, i * 2, i * 2 + 1);
    }
    const g = track(new THREE.BufferGeometry());
    g.setAttribute('position', new THREE.Float32BufferAttribute(p, 3));
    g.setIndex(ix);
    return new THREE.Mesh(g, foamMat);
  })();
  root.add(foam);

  // ---------- Palme, cespugli, fiori ----------
  const avoid = (x, z) => {
    if (x > -90 && x < 170 && z > 110 && z < 198) return true; // villaggio e pista
    if (Math.hypot(x - M.x, z - M.z) < 132) return true;
    if (Math.hypot(x - RACE.cx, z - RACE.cz) < RACE.r + 6 && Math.hypot(x - RACE.cx, z - RACE.cz) > RACE.r - 6) return true;
    if (Math.hypot(x - LIGHT.x, z - LIGHT.z) < 12) return true;
    if (Math.hypot(x - RUINS.x, z - RUINS.z) < 14) return true;
    if (Math.abs(x - PIER_X) < 8 && z > 150) return true;
    return false;
  };
  const palms = [];
  for (let t = 0; t < 6000 && palms.length < 260; t++) {
    const th = rand() * Math.PI * 2;
    const r = shoreR(th) - 4 - rand() ** 1.5 * 90;
    const x = Math.cos(th) * r;
    const z = Math.sin(th) * r;
    if (ground(x, z) < 0.4 || avoid(x, z)) continue;
    palms.push({ x, z, y: ground(x, z), h: 6 + rand() * 4, lean: 0.1 + rand() * 0.3, ry: rand() * 6.28 });
  }
  palms.push({ x: ISLET.x + 2, z: ISLET.z - 3, y: 1.6, h: 7, lean: 0.3, ry: 1 });
  for (const p of palms) colliders.push({ minX: p.x - 0.3, maxX: p.x + 0.3, minZ: p.z - 0.3, maxZ: p.z + 0.3 });
  // le palme del Nature Kit, se ci sono
  if (!scatterKit(root, track, palms, ['tree_palmTall', 'tree_palmBend', 'tree_palmShort'], (p) => mtx(p.x, p.y - 0.2, p.z, p.ry, p.h / 1.25, p.h / 1.3, p.h / 1.25))) {
  const trunkGeo = track(new THREE.CylinderGeometry(0.16, 0.28, 1, 7).translate(0, 0.5, 0));
  const leafParts = [];
  for (let i = 0; i < 7; i++) {
    const g = new THREE.PlaneGeometry(0.9, 3.4, 1, 3);
    const pa = g.attributes.position;
    for (let k = 0; k < pa.count; k++) {
      const yy = pa.getY(k) + 1.7;
      pa.setY(k, yy);
      pa.setZ(k, -0.12 * yy * yy);
    }
    g.rotateX(-Math.PI / 2 + 0.5);
    g.rotateY((i / 7) * Math.PI * 2);
    leafParts.push(g);
  }
  const crownGeo = track(mergeLeaf(leafParts));
  const trunks = new THREE.InstancedMesh(trunkGeo, mat('#8a6a4a'), palms.length);
  const crowns = new THREE.InstancedMesh(crownGeo, mat('#3a8a2a', { side: THREE.DoubleSide }), palms.length);
  palms.forEach((p, i) => {
    trunks.setMatrixAt(i, mtx(p.x, p.y - 0.2, p.z, p.ry, 1, p.h, 1, p.lean, 0));
    const tx = p.x + Math.sin(p.ry) * Math.sin(p.lean) * p.h;
    const tz = p.z + Math.cos(p.ry) * Math.sin(p.lean) * p.h;
    crowns.setMatrixAt(i, mtx(tx, p.y - 0.2 + Math.cos(p.lean) * p.h, tz, rand() * 6, 1, 1, 1));
  });
  for (const m of [trunks, crowns]) {
    m.castShadow = true;
    m.frustumCulled = false;
    root.add(m);
  }
  }
  const bushes = [];
  for (let t = 0; t < 5000 && bushes.length < 700; t++) {
    const x = (rand() - 0.5) * 2 * 300;
    const z = (rand() - 0.5) * 2 * 300;
    const s = shoreDist(x, z);
    if (s < 14 || avoid(x, z)) continue;
    T.normalAt(x, z, nrm);
    if (nrm.y < 0.8) continue;
    bushes.push({ x, z, s: 0.5 + rand() * 1.1, flower: rand() < 0.3 });
  }
  // cespugli e fiori del Nature Kit, se ci sono
  const flowers = bushes.filter((b) => b.flower);
  const greens = bushes.filter((b) => !b.flower);
  const kitBushes =
    scatterKit(root, track, greens, ['plant_bushLarge', 'plant_bush', 'plant_bushDetailed'], (b) => mtx(b.x, ground(b.x, b.z) - 0.1, b.z, b.x * 5.1, b.s * 5, b.s * 4.5, b.s * 5)) &&
    scatterKit(root, track, flowers, ['flower_redA', 'flower_yellowA', 'flower_purpleA'], (b) => mtx(b.x, ground(b.x, b.z) - 0.05, b.z, b.z * 3.7, 3 + b.s * 2, 3 + b.s * 2, 3 + b.s * 2));
  if (!kitBushes) {
  const bushGeo = track(new THREE.IcosahedronGeometry(1, 0));
  const bm = new THREE.InstancedMesh(bushGeo, mat('#ffffff', { flatShading: true }), bushes.length);
  const cc = new THREE.Color();
  bushes.forEach((b, i) => {
    bm.setMatrixAt(i, mtx(b.x, ground(b.x, b.z) + b.s * 0.3, b.z, rand() * 6, b.s * 1.2, b.s * 0.8, b.s));
    bm.setColorAt(i, cc.set(b.flower ? ['#ff5a8a', '#ffd23a', '#ff8a3a', '#e85ae8'][Math.floor(rand() * 4)] : ['#3a7a2a', '#4a8a30', '#2f6a28'][Math.floor(rand() * 3)]));
  });
  bm.castShadow = true;
  bm.frustumCulled = false;
  root.add(bm);
  }

  // ---------- La montagna: colonne di roccia e funghi ----------
  for (const p of T.pillars) {
    const x = (p.minX + p.maxX) / 2;
    const z = (p.minZ + p.maxZ) / 2;
    const y0 = ground(x, z) - 1;
    box(1.9, p.top - y0, 1.9, mat('#9a6a52', { flatShading: true }), x, y0, z);
    box(2.0, 0.25, 2.0, mat('#6ab84a'), x, p.top - 0.2, z);
  }
  const pads = T.pads.map((pd) => {
    const g = new THREE.Group();
    g.position.set(pd.x, pd.y, pd.z);
    const stem = new THREE.Mesh(track(new THREE.CylinderGeometry(0.5, 0.7, 1.1, 10)), mat('#f4ead8'));
    stem.position.y = 0.55;
    const cap = new THREE.Mesh(track(new THREE.SphereGeometry(1.7, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2)), mat('#e83a3a', { roughness: 0.5 }));
    cap.position.y = 1.0;
    cap.scale.y = 0.55;
    g.add(stem, cap);
    for (let i = 0; i < 7; i++) {
      const a = (i / 7) * Math.PI * 2;
      const dot = new THREE.Mesh(track(new THREE.SphereGeometry(0.22, 8, 6)), mat('#ffffff'));
      dot.position.set(Math.cos(a) * 1.05, 1.55, Math.sin(a) * 1.05);
      g.add(dot);
    }
    g.traverse((o) => (o.castShadow = true));
    root.add(g);
    pd.top = pd.y + 1.9;
    return { pad: pd, group: g, squash: 0 };
  });
  // cartello in vetta
  label('VETTA · 50 m', 3, 0.6, M.x + 6, 51.6, M.z, -Math.PI / 2, { bg: '#f4ead8', color: '#5a3a1a' });
  box(0.15, 1.6, 0.15, mat('#7a5a3a'), M.x + 6, 50, M.z);

  // ---------- Il faro ----------
  {
    const L = LIGHT;
    const bands = 8;
    for (let i = 0; i < bands; i++) {
      const h0 = (24 / bands) * i;
      const r0 = L.r * (1 - (h0 / 24) * 0.18);
      const r1 = L.r * (1 - ((h0 + 3) / 24) * 0.18);
      cyl(r0, 24 / bands, mat(i % 2 ? '#d83a3a' : '#f4f4f0'), L.x, L.y + h0, L.z, r1);
    }
    cyl(2.6, 3, mat('#bfe8ff', { transparent: true, opacity: 0.45, roughness: 0.1 }), L.x, L.top, L.z);
    cyl(3.2, 0.5, mat('#2a2a2a'), L.x, L.top + 3, L.z, 1.2);
    const steps = T.lightSteps;
    for (const s of steps) box(2.3, 0.25, 1.9, mat('#c8c0b0'), s.x, s.top - 0.25, s.z, -s.a + Math.PI / 2);
    // il ballatoio e la ringhiera
    const ring = new THREE.Mesh(track(new THREE.RingGeometry(L.r - 0.2, 6.6, 32)), mat('#8a8a8a', { side: THREE.DoubleSide }));
    ring.rotation.x = -Math.PI / 2;
    ring.position.set(L.x, L.top, L.z);
    root.add(ring);
    const rail = new THREE.Mesh(track(new THREE.TorusGeometry(6.6, 0.06, 6, 48)), mat('#3a3a3a'));
    rail.rotation.x = Math.PI / 2;
    rail.position.set(L.x, L.top + 1.1, L.z);
    root.add(rail);
    for (let i = 0; i < 24; i++) {
      const a = (i / 24) * Math.PI * 2;
      box(0.06, 1.1, 0.06, mat('#3a3a3a'), L.x + Math.cos(a) * 6.6, L.top, L.z + Math.sin(a) * 6.6);
    }
  }
  const glow = track(glowTexture('rgba(255,255,255,1)'));
  const lamp = new THREE.Sprite(track(new THREE.SpriteMaterial({ map: glow, color: '#fff4b0', blending: THREE.AdditiveBlending, depthWrite: false, transparent: true })));
  lamp.position.set(LIGHT.x, LIGHT.top + 1.6, LIGHT.z);
  lamp.scale.set(9, 9, 1);
  root.add(lamp);

  // ---------- La laguna: i sassi ----------
  for (const s of T.stones) cyl(1.15, s.top + 4, mat('#9a948a', { flatShading: true }), s.x, -4, s.z, 1.05);

  // ---------- Le rovine ----------
  {
    const R = RUINS;
    const ry = T.ruinsY;
    const stone = mat('#d8ccb0');
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      const h = 1 + rand() * 4;
      const x = R.x + Math.cos(a) * 8;
      const z = R.z + Math.sin(a) * 8;
      cyl(0.6, h, stone, x, ground(x, z) - 0.2, z);
      colliders.push({ minX: x - 0.6, maxX: x + 0.6, minZ: z - 0.6, maxZ: z + 0.6, top: ground(x, z) + h });
    }
    box(9, 0.25, 9, mat('#c8bca0'), R.x, ry - 0.15, R.z);
    box(1.2, 4, 1.2, stone, R.x - 6, ry, R.z + 5, 0, { col: true });
    box(1.2, 4, 1.2, stone, R.x - 2, ry, R.z + 7, 0, { col: true });
    box(5.2, 1, 1.4, stone, R.x - 4, ry + 4, R.z + 6, 0.46);
    const crateTex = track(canvasTex(64, 64, (g, w, h) => {
      g.fillStyle = '#b07a3a';
      g.fillRect(0, 0, w, h);
      g.strokeStyle = '#6a4220';
      g.lineWidth = 6;
      g.strokeRect(3, 3, w - 6, h - 6);
      g.beginPath();
      g.moveTo(3, 3);
      g.lineTo(w - 3, h - 3);
      g.stroke();
    }));
    const crateMat = track(new THREE.MeshStandardMaterial({ map: crateTex, roughness: 0.9 }));
    // le casse sono pile: una, due, tre
    for (const c of T.crates) {
      const k = Math.round((c.top - ry) / 1.2);
      for (let i = 0; i < k; i++) box(1.5, 1.2, 1.5, crateMat, (c.minX + c.maxX) / 2, ry + i * 1.2, (c.minZ + c.maxZ) / 2, i * 0.2);
      c.bottom = ry;
    }
    const cl = T.column;
    cyl(0.9, cl.top - ry, stone, cl.x, ry, cl.z);
  }
  const glasses = new THREE.Group();
  {
    const g = mat('#1a1a1a', { metalness: 0.6, roughness: 0.3 });
    for (const s of [-1, 1]) {
      const l = new THREE.Mesh(track(new THREE.TorusGeometry(0.16, 0.03, 6, 16)), g);
      l.position.x = s * 0.2;
      glasses.add(l);
      const lens = new THREE.Mesh(track(new THREE.CircleGeometry(0.15, 16)), mat('#9adcff', { transparent: true, opacity: 0.5, side: THREE.DoubleSide }));
      lens.position.x = s * 0.2;
      glasses.add(lens);
    }
    const bridge = new THREE.Mesh(boxGeo, g);
    bridge.scale.set(0.1, 0.03, 0.03);
    glasses.add(bridge);
    glasses.position.set(T.column.x, T.column.top + 0.6, T.column.z);
    root.add(glasses);
  }

  // ---------- Il villaggio ----------
  const VY = T.flatH;
  const houseCols = ['#f4d23a', '#5ac8e8', '#f48aa8', '#8ae86a', '#f4a03a'];
  const houses = [[-70, 128], [-45, 126], [-20, 128], [10, 126], [38, 128]];
  const houseKit = ['building-type-a', 'building-type-c', 'building-type-e'].filter((n) => models.has(n));
  houses.forEach(([x, z], i) => {
    // le casette del City Kit Suburban, se ci sono (con il loro tetto e la loro porta)
    const kit = houseKit.length ? models.make(houseKit[i % houseKit.length]) : null;
    if (kit) {
      kit.scale.setScalar(7);
      kit.position.set(x, VY, z);
      kit.traverse((o) => o.isMesh && (o.castShadow = o.receiveShadow = true));
      root.add(kit);
      colliders.push({ minX: x - 4.5, maxX: x + 4.5, minZ: z - 3.6, maxZ: z + 3.6, top: VY + 6 });
      return;
    }
    box(9, 4.5, 8, mat(houseCols[i]), x, VY, z, 0, { col: true });
    batch.add(track(new THREE.ConeGeometry(7.2, 3, 4)), mat('#c8583a'), mtx(x, VY + 6, z, Math.PI / 4, 1, 1, 0.82));
    box(1.4, 2.4, 0.1, mat('#6a4a2a'), x, VY, z + 4.02);
    box(1.4, 1.1, 0.08, mat('#bfe8ff', { roughness: 0.2 }), x + 2.5, VY + 2, z + 4.02);
  });
  label('IL VECCHIO PILOTA', 3.4, 0.5, PILOT_HOME.x, VY + 3.4, PILOT_HOME.z - 1.85 + 4.2, 0, { bg: '#f4ead8', color: '#5a3a1a', font: '700 60px Inter, sans-serif' });
  // l'hangar degli aeroplani usati
  {
    const S = SHOP;
    box(28, 9, 18, mat('#c8ccd2', { metalness: 0.3 }), S.x, VY, S.z - 6, 0, { col: true });
    const roof = new THREE.Mesh(track(new THREE.CylinderGeometry(14, 14, 18, 24, 1, false, 0, Math.PI)), mat('#9aa0a8', { metalness: 0.4, side: THREE.DoubleSide }));
    roof.rotation.set(Math.PI / 2, 0, Math.PI / 2);
    roof.scale.set(1, 1, 0.3);
    roof.position.set(S.x, VY + 9, S.z - 6);
    root.add(roof);
    box(16, 7, 0.2, mat('#3a3a40'), S.x, VY, S.z + 3.05);
    label('AEROPLANI D\'OCCASIONE', 14, 1.4, S.x, VY + 10.2, S.z + 3.3, 0, { bg: '#e83a3a', color: '#ffffff', font: '900 92px Inter, sans-serif' });
    label(`IL PELLICANO · ${PLANE_PRICE} MONETE`, 4.4, 0.7, S.x - 9, VY + 1.6, S.z + 10, 0, { bg: '#ffffff', color: '#c83a3a', font: '800 66px Inter, sans-serif' });
    box(0.12, 1.4, 0.12, mat('#6a4a2a'), S.x - 9, VY, S.z + 9.9);
  }
  // la pista d'erba
  {
    const len = STRIP.maxX - STRIP.minX;
    const strip = new THREE.Mesh(track(new THREE.PlaneGeometry(len, STRIP.halfW * 2)), mat('#8ac85a', { polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }));
    strip.rotation.x = -Math.PI / 2;
    strip.position.set((STRIP.minX + STRIP.maxX) / 2, VY + 0.03, STRIP.z);
    strip.receiveShadow = true;
    root.add(strip);
    for (let x = STRIP.minX; x < STRIP.maxX; x += 12) box(5, 0.04, 0.5, mat('#f4f4f0'), x + 3, VY + 0.02, STRIP.z);
  }
  // la gara degli anelli: il cartello e gli anelli
  const rings = [];
  {
    const R = RACE;
    const nR = 10;
    const ringGeo = track(new THREE.TorusGeometry(1.9, 0.16, 8, 32));
    for (let i = 0; i < nR; i++) {
      const a = (i / nR) * Math.PI * 2;
      const x = R.cx + Math.cos(a) * R.r;
      const z = R.cz + Math.sin(a) * R.r;
      const high = i === 3 || i === 7;
      const y = ground(x, z) + (high ? 3.2 : 1.7);
      const m = new THREE.Mesh(ringGeo, track(new THREE.MeshStandardMaterial({ color: '#ffd23a', emissive: '#ff9a1a', emissiveIntensity: 0.5, metalness: 0.4, roughness: 0.3 })));
      m.position.set(x, y, z);
      m.rotation.y = -a; // il piano dell'anello è perpendicolare al giro
      root.add(m);
      rings.push({ x, y, z, a, mesh: m });
    }
    const sx = R.cx + R.r + 5;
    const sz = R.cz - 6;
    box(0.15, 2, 0.15, mat('#6a4a2a'), sx, ground(sx, sz), sz);
    label('GARA DEGLI ANELLI', 3, 0.7, sx, ground(sx, sz) + 2.3, sz, -Math.PI / 2, { bg: '#2a6ac8', color: '#ffffff', font: '800 74px Inter, sans-serif' });
    RACE.start = new THREE.Vector3(sx - 1.5, ground(sx, sz), sz);
  }

  // ---------- Il pontile, l'idrovolante, la capanna 1313 ----------
  const P = T.pier;
  for (let z = P.minZ; z < P.maxZ; z += 0.9) box(6, 0.18, 0.8, mat(Math.round(z / 0.9) % 2 ? '#a8845a' : '#8a6a44'), PIER_X, P.top - 0.18, z + 0.45);
  for (let z = P.minZ + 2; z < P.maxZ; z += 6) for (const s of [-1, 1]) cyl(0.18, P.top + 5, mat('#6a4a2a'), PIER_X + s * 2.9, -5, z);
  const seaplane = new THREE.Group();
  {
    const w = mat('#f4f4f0', { roughness: 0.4 });
    const y = mat('#f4c23a', { roughness: 0.5 });
    const add = (geo, m, x, yy, z, sx = 1, sy = 1, sz = 1, rz = 0) => {
      const o = new THREE.Mesh(geo, m);
      o.position.set(x, yy, z);
      o.scale.set(sx, sy, sz);
      o.rotation.z = rz;
      o.castShadow = true;
      seaplane.add(o);
    };
    add(cylGeo, w, 0, 2.2, 0, 1.6, 8, 1.6, Math.PI / 2);
    add(boxGeo, y, 0.6, 3.2, 0, 1.8, 0.15, 12);
    add(boxGeo, w, -3.8, 3.1, 0, 1.2, 1.8, 0.12);
    for (const s of [-1, 1]) {
      add(boxGeo, y, 0.3, 0.45, s * 1.6, 6, 0.5, 0.6);
      add(boxGeo, mat('#6a6a6a'), 0.3, 1.1, s * 1.1, 0.1, 1.3, 0.1);
    }
    add(boxGeo, mat('#2a2a2a'), 4.1, 2.2, 0, 0.1, 2, 0.15);
    seaplane.position.set(PIER_X + 9, 0, P.maxZ - 6);
    seaplane.rotation.y = Math.PI / 2;
    root.add(seaplane);
  }
  const hut = { x: PIER_X + 12, z: P.minZ - 6 };
  hut.y = ground(hut.x, hut.z);
  box(3, 2.8, 3, mat('#e8d8b0'), hut.x, hut.y - 0.2, hut.z, 0, { col: true });
  batch.add(track(new THREE.ConeGeometry(2.6, 1.6, 4)), mat('#c8a050'), mtx(hut.x, hut.y + 3.4, hut.z, Math.PI / 4));
  box(1, 2, 0.08, mat('#1f6a3a'), hut.x, hut.y, hut.z + 1.52);
  label('1313', 0.45, 0.18, hut.x, hut.y + 1.75, hut.z + 1.58, 0, { bg: '#e8d48a', color: '#3a2a10', font: '700 120px Inter, sans-serif' });
  label('IDROVOLANTE · AEROPORTO', 3.6, 0.5, PIER_X, P.top + 2.2, P.maxZ - 1, Math.PI, { bg: '#1a3a6a', color: '#ffffff', font: '800 64px Inter, sans-serif' });
  box(0.12, 2.2, 0.12, mat('#6a4a2a'), PIER_X, P.top, P.maxZ - 0.9);

  // ---------- Monete ----------
  const coins = [];
  const coin = (x, z, y) => coins.push({ id: coins.length, x, z, y: (y ?? T.support(x, z, 999)) + 1.1 });
  for (let i = 0; i < 6; i++) coin(M.x, M.z + 150 - i * 5);
  T.ramps[1].pts.forEach((q, i) => i % 2 === 0 && coin(q.x, q.z, q.y));
  for (const p of T.pillars) coin((p.minX + p.maxX) / 2, (p.minZ + p.maxZ) / 2, p.top);
  for (let i = 0; i < 8; i++) coin(M.x + Math.cos((i / 8) * 6.28) * 12, M.z + Math.sin((i / 8) * 6.28) * 12, 50);
  T.lightSteps.forEach((s, i) => i % 4 === 2 && coin(s.x, s.z, s.top));
  for (const s of T.stones) coin(s.x, s.z, s.top);
  for (let i = 0; i < 20; i++) {
    const th = 1.15 + (i / 19) * 1.05;
    const r = shoreR(th) - 9;
    coin(Math.cos(th) * r, Math.sin(th) * r);
  }
  for (const [cx, cz] of [[-35, 150], [60, 110], [-60, 100]]) for (let i = 0; i < 6; i++) coin(cx + Math.cos((i / 6) * 6.28) * 3.5, cz + Math.sin((i / 6) * 6.28) * 3.5);
  for (const c of T.crates) coin((c.minX + c.maxX) / 2, (c.minZ + c.maxZ) / 2, c.top);
  for (let i = 0; i < 8; i++) coin(RUINS.x + Math.cos((i / 8) * 6.28) * 5, RUINS.z + Math.sin((i / 8) * 6.28) * 5);
  {
    const pd = T.pads.find((q) => q.kind === 'meadow');
    for (let i = 1; i <= 6; i++) coin(pd.x + i * 2.4, pd.z, pd.y + 1.9 + Math.sin((i / 7) * Math.PI) * 8);
  }
  for (let i = 0; i < 8; i++) coin(PIER_X, P.minZ + 6 + i * 6, P.top);
  for (let i = 0; i < 12; i++) coin(-150 + i * 7, -60 - Math.sin(i * 0.6) * 6);
  const coinGeo = track(new THREE.CylinderGeometry(0.42, 0.42, 0.09, 18).rotateX(Math.PI / 2));
  const coinMesh = new THREE.InstancedMesh(coinGeo, track(new THREE.MeshStandardMaterial({ color: '#ffd23a', emissive: '#ffae1a', emissiveIntensity: 0.45, metalness: 0.8, roughness: 0.25 })), coins.length);
  coinMesh.frustumCulled = false;
  coinMesh.castShadow = true;
  root.add(coinMesh);

  // ---------- Le pagine della patente ----------
  const pageTex = track(canvasTex(128, 160, (g, w, h) => {
    g.fillStyle = '#fbf6e8';
    g.fillRect(0, 0, w, h);
    g.fillStyle = '#2a4a8a';
    g.fillRect(0, 0, w, 28);
    g.fillStyle = '#ffffff';
    g.font = '700 14px Inter, sans-serif';
    g.fillText('PATENTE DI VOLO', 8, 19);
    g.fillStyle = '#9a9a9a';
    for (let i = 0; i < 6; i++) g.fillRect(10, 46 + i * 16, w - 20 - (i % 2) * 30, 4);
    g.strokeStyle = '#c83a3a';
    g.lineWidth = 3;
    g.beginPath();
    g.arc(w - 34, h - 34, 18, 0, Math.PI * 2);
    g.stroke();
  }));
  const pageMat = track(new THREE.MeshStandardMaterial({ map: pageTex, emissive: '#ffffff', emissiveMap: pageTex, emissiveIntensity: 0.35, side: THREE.DoubleSide }));
  const beamMat = track(new THREE.MeshBasicMaterial({ color: '#9ae8ff', transparent: true, opacity: 0.22, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
  const pageSpots = [
    { id: 'vetta', x: M.x, z: M.z, y: 50 },
    { id: 'faro', x: LIGHT.x - 5, z: LIGHT.z, y: LIGHT.top },
    { id: 'isolotto', x: ISLET.x, z: ISLET.z + 2, y: 1.8 },
  ];
  const pages = pageSpots.map((p) => {
    const g = new THREE.Group();
    g.position.set(p.x, p.y + 1.4, p.z);
    const sheet = new THREE.Mesh(track(new THREE.PlaneGeometry(0.8, 1)), pageMat);
    g.add(sheet);
    const halo = new THREE.Sprite(track(new THREE.SpriteMaterial({ map: glow, color: '#bff0ff', blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0.7 })));
    halo.scale.set(3, 3, 1);
    g.add(halo);
    const beam = new THREE.Mesh(track(new THREE.CylinderGeometry(0.6, 0.6, 80, 10, 1, true)), beamMat);
    beam.position.y = 40;
    g.add(beam);
    root.add(g);
    return { ...p, group: g, sheet };
  });

  batch.flush(root, track);

  const tmpM = new THREE.Matrix4();
  const tmpQ = new THREE.Quaternion();
  const up = new THREE.Vector3(0, 1, 0);
  const one = new THREE.Vector3(1, 1, 1);
  const zero = new THREE.Vector3(0, 0, 0);
  const cp = new THREE.Vector3();
  let taken = new Set();

  return {
    colliders,
    coins,
    pages,
    rings,
    pads,
    glasses,
    seaplane,
    pierEnd: new THREE.Vector3(PIER_X, P.top, P.maxZ - 4),
    hut: new THREE.Vector3(hut.x, hut.y, hut.z + 2.4),
    villageY: VY,
    setTaken(set) {
      taken = set;
    },
    update(t) {
      const pa = seaGeo.attributes.position;
      const a = pa.array;
      for (let i = 0; i < pa.count; i++) a[i * 3 + 1] = Math.sin(seaBase[i * 3] * 0.04 + t * 0.8) * 0.12 + Math.sin(seaBase[i * 3 + 2] * 0.07 - t * 1.1) * 0.1;
      pa.needsUpdate = true;
      foamMat.opacity = 0.35 + Math.sin(t * 0.9) * 0.2;
      foam.scale.setScalar(1 + Math.sin(t * 0.9) * 0.004);
      tmpQ.setFromAxisAngle(up, t * 2.4);
      for (const c of coins) {
        cp.set(c.x, c.y + Math.sin(t * 2 + c.id) * 0.12, c.z);
        coinMesh.setMatrixAt(c.id, tmpM.compose(cp, tmpQ, taken.has(c.id) ? zero : one));
      }
      coinMesh.instanceMatrix.needsUpdate = true;
      for (const p of pages) {
        p.sheet.rotation.y = t * 1.6;
        p.group.position.y = p.y + 1.4 + Math.sin(t * 1.5) * 0.2;
      }
      for (const r of rings) r.mesh.material.emissiveIntensity = 0.4 + Math.sin(t * 4 + r.a * 3) * 0.25;
      glasses.rotation.y = t * 1.2;
      lamp.material.opacity = 0.6 + Math.max(0, Math.sin(t * 2)) * 0.4;
      for (const pd of pads) {
        pd.squash *= Math.exp(-6 * (1 / 60));
        pd.group.scale.set(1 + pd.squash * 0.3, 1 - pd.squash * 0.4, 1 + pd.squash * 0.3);
      }
    },
    dispose() {
      disposables.forEach((d) => d.dispose());
      root.removeFromParent();
    },
  };
}

function mergeLeaf(parts) {
  const pos = [];
  const nor = [];
  const uv = [];
  const ix = [];
  let off = 0;
  for (const g of parts) {
    const ng = g.index ? g : g;
    ng.computeVertexNormals();
    pos.push(...ng.attributes.position.array);
    nor.push(...ng.attributes.normal.array);
    uv.push(...ng.attributes.uv.array);
    for (const i of ng.index.array) ix.push(i + off);
    off += ng.attributes.position.count;
    g.dispose();
  }
  const m = new THREE.BufferGeometry();
  m.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  m.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  m.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  m.setIndex(ix);
  return m;
}
