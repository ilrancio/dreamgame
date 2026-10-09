import * as THREE from 'three';
import { textTexture, glowTexture } from '../../core/textures.js';
import { mulberry32 } from '../../core/noise.js';
import { VILLAGE, HARBOR, heightAt } from './island.js';

// Porto Grigio: un villaggio di pescatori sulla costa a sud-ovest. Una
// piazzetta con la lanterna blu, la Locanda del Gabbiano, l'Emporio, la casa
// della capovillaggio con la lanterna verde, le case basse dei pescatori, le
// barche tirate in secca, le reti stese ad asciugare (che non asciugano mai).

export function buildVillage(scene) {
  const disposables = [];
  const track = (o) => (disposables.push(o), o);
  const root = new THREE.Group();
  scene.add(root);
  const colliders = [];
  const cache = new Map();
  const mat = (color, o = {}) => {
    const k = color + JSON.stringify(o);
    if (!cache.has(k)) cache.set(k, track(new THREE.MeshStandardMaterial({ color, roughness: 0.85, ...o })));
    return cache.get(k);
  };
  const boxGeo = track(new THREE.BoxGeometry(1, 1, 1));
  const rand = mulberry32(17);
  // il sistema di riferimento: u verso il mare, v di lato
  const a = HARBOR.a;
  const fx = Math.cos(a);
  const fz = Math.sin(a);
  const rx = -fz;
  const rz = fx;
  const W = (u, v) => {
    const x = VILLAGE.x + fx * u + rx * v;
    const z = VILLAGE.z + fz * u + rz * v;
    return new THREE.Vector3(x, heightAt(x, z), z);
  };
  const glow = track(glowTexture('rgba(255,255,255,1)'));
  const windows = [];

  // una casa: muri, tetto a capanna, porta verso la piazza, finestre accese
  function house(u, v, { w = 6, d = 5, h = 3.4, wall = '#c8c0b0', roof = '#5a3a2e', sign = null, lantern = null } = {}) {
    const p = W(u, v);
    const g = new THREE.Group();
    g.position.copy(p);
    // la porta guarda verso il centro della piazza
    const c = W(0, 0);
    g.rotation.y = Math.atan2(c.x - p.x, c.z - p.z);
    root.add(g);
    const walls = new THREE.Mesh(boxGeo, mat(wall));
    walls.scale.set(w, h, d);
    walls.position.y = h / 2 - 0.4;
    const base = new THREE.Mesh(boxGeo, mat('#5a5652'));
    base.scale.set(w + 0.3, 0.8, d + 0.3);
    base.position.y = -0.2;
    g.add(walls, base);
    // il tetto: un prisma a tre facce
    const rg = track(new THREE.CylinderGeometry(d * 0.62, d * 0.62, w + 0.6, 3, 1));
    rg.rotateZ(Math.PI / 2);
    rg.rotateX(-Math.PI / 2);
    const rf = new THREE.Mesh(rg, mat(roof));
    rf.scale.set(1, 0.7, 1);
    rf.position.y = h - 0.4 + d * 0.31 * 0.7;
    g.add(rf);
    const door = new THREE.Mesh(boxGeo, mat('#3a2a1e'));
    door.scale.set(1.1, 2.1, 0.1);
    door.position.set(0, 0.65, d / 2 + 0.02);
    g.add(door);
    const winMat = mat('#ffd890', { emissive: '#ffb050', emissiveIntensity: 1.4 });
    for (const sx of [-1, 1]) {
      const win = new THREE.Mesh(boxGeo, winMat);
      win.scale.set(0.8, 0.7, 0.06);
      win.position.set(sx * (w / 2 - 1.2), 1.4, d / 2 + 0.03);
      g.add(win);
      windows.push(win);
    }
    if (sign) {
      const tx = track(textTexture(sign, { width: 1024, height: 192, font: '800 96px Cormorant Garamond, serif', color: '#f4e8c8', bg: '#3a2a1e' }));
      const sg = new THREE.Mesh(track(new THREE.PlaneGeometry(w * 0.8, w * 0.15)), track(new THREE.MeshBasicMaterial({ map: tx })));
      sg.position.set(0, h - 0.1, d / 2 + 0.08);
      g.add(sg);
    }
    if (lantern) {
      const l = new THREE.Mesh(track(new THREE.BoxGeometry(0.3, 0.4, 0.3)), track(new THREE.MeshBasicMaterial({ color: lantern })));
      l.position.set(1, 2.4, d / 2 + 0.4);
      const halo = new THREE.Sprite(track(new THREE.SpriteMaterial({ map: glow, color: lantern, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0.7 })));
      halo.scale.set(2.4, 2.4, 1);
      halo.position.copy(l.position);
      g.add(l, halo);
    }
    // il collider (una scatola allineata al mondo che contiene la casa)
    const R = Math.max(w, d) / 2 + 0.2;
    const cs = Math.abs(Math.cos(g.rotation.y));
    const sn = Math.abs(Math.sin(g.rotation.y));
    const ex = (w / 2) * cs + (d / 2) * sn;
    const ez = (w / 2) * sn + (d / 2) * cs;
    colliders.push({ minX: p.x - Math.min(R, ex + 0.2), maxX: p.x + Math.min(R, ex + 0.2), minZ: p.z - Math.min(R, ez + 0.2), maxZ: p.z + Math.min(R, ez + 0.2) });
    // dove ci si ferma per parlare, davanti alla porta
    const front = new THREE.Vector3(Math.sin(g.rotation.y), 0, Math.cos(g.rotation.y)).multiplyScalar(d / 2 + 1.6).add(p);
    front.y = heightAt(front.x, front.z);
    return { pos: p, front, rot: g.rotation.y };
  }

  const inn = house(-9, -11, { w: 9, d: 6, h: 4.2, wall: '#d8cfb8', roof: '#7a3a2a', sign: 'LOCANDA DEL GABBIANO', lantern: '#ffc070' });
  const shop = house(-9, 11, { w: 7, d: 5, wall: '#b8c8c8', roof: '#3a4a5a', sign: 'EMPORIO', lantern: '#ffc070' });
  const orsola = house(-18, 0, { w: 7, d: 6, h: 3.8, wall: '#c8b8a0', roof: '#4a5a3a', lantern: '#6aff8a' });
  const homes = [house(-2, -21, { wall: '#a8a8a0' }), house(-2, 21, { wall: '#c0b0a0', roof: '#3a3a40' }), house(-21, -16, { w: 5, wall: '#b8b0a0' }), house(-21, 16, { w: 5, wall: '#a8b0b0', roof: '#6a3a2a' }), house(8, -24, { w: 5, d: 4, wall: '#9a9a90' })];

  // la piazzetta: un pozzo, due panchine
  {
    const c = W(0, 0);
    const well = new THREE.Mesh(track(new THREE.CylinderGeometry(1.1, 1.2, 1, 14)), mat('#6a6662'));
    well.position.set(c.x, c.y + 0.5, c.z);
    root.add(well);
    colliders.push({ minX: c.x - 1.2, maxX: c.x + 1.2, minZ: c.z - 1.2, maxZ: c.z + 1.2 });
    for (const sv of [-6, 6]) {
      const b = W(-3, sv);
      const bench = new THREE.Mesh(boxGeo, mat('#5a4030'));
      bench.scale.set(2, 0.45, 0.6);
      bench.position.set(b.x, b.y + 0.22, b.z);
      bench.rotation.y = a;
      root.add(bench);
    }
  }
  // le barche tirate in secca vicino al pontile
  const boatMat = [mat('#3a6a8a'), mat('#b84a2a'), mat('#e8e0c8')];
  for (let i = 0; i < 4; i++) {
    const p = W(18 + rand() * 4, (i - 1.5) * 6 + (i > 1 ? 4 : -4));
    const hull = new THREE.Mesh(track(new THREE.CylinderGeometry(0.9, 0.5, 4.2, 8, 1, false, 0, Math.PI)), boatMat[i % 3]);
    hull.rotation.set(Math.PI / 2, 0, Math.PI);
    hull.position.set(p.x, p.y + 0.5, p.z);
    hull.rotation.y = a + 0.4 * (rand() - 0.5);
    hull.rotateZ(0.25);
    root.add(hull);
  }
  // le reti stese su due pali, i barili, le casse
  for (const [u, v] of [[10, -9], [10, 9]]) {
    const p1 = W(u, v - 2);
    const p2 = W(u, v + 2);
    for (const p of [p1, p2]) {
      const pole = new THREE.Mesh(boxGeo, mat('#4a3a2a'));
      pole.scale.set(0.12, 2.4, 0.12);
      pole.position.set(p.x, p.y + 1.2, p.z);
      root.add(pole);
    }
    const net = new THREE.Mesh(track(new THREE.PlaneGeometry(4, 1.6, 8, 4)), mat('#5a6a5a', { wireframe: true }));
    net.position.set((p1.x + p2.x) / 2, p1.y + 1.4, (p1.z + p2.z) / 2);
    net.rotation.y = a + Math.PI / 2;
    root.add(net);
  }
  for (let i = 0; i < 9; i++) {
    const p = W(4 + rand() * 10, (rand() - 0.5) * 34);
    const bar = new THREE.Mesh(track(new THREE.CylinderGeometry(0.4, 0.4, 0.9, 10)), mat(rand() < 0.5 ? '#6a4a2a' : '#4a3a28'));
    bar.position.set(p.x, p.y + 0.45, p.z);
    root.add(bar);
  }
  // i lampioni della piazza
  const lamps = [];
  for (const [u, v] of [[4, -5], [4, 5], [-6, 0]]) {
    const p = W(u, v);
    const pole = new THREE.Mesh(boxGeo, mat('#2a2a2e'));
    pole.scale.set(0.12, 3.4, 0.12);
    pole.position.set(p.x, p.y + 1.7, p.z);
    const halo = new THREE.Sprite(track(new THREE.SpriteMaterial({ map: glow, color: '#ffd890', blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0.6 })));
    halo.scale.set(3, 3, 1);
    halo.position.set(p.x, p.y + 3.4, p.z);
    root.add(pole, halo);
    lamps.push(halo);
  }
  const warm = new THREE.PointLight('#ffc070', 60, 40, 1.6);
  const sq = W(0, 0);
  warm.position.set(sq.x, sq.y + 5, sq.z);
  root.add(warm);

  return {
    colliders,
    W,
    spots: {
      square: W(0, 0),
      save: W(3, -2.5),
      inn: inn.front,
      shop: shop.front,
      orsola: orsola.front,
      homes: homes.map((h) => h.front),
      harbor: W(22, 0),
      bench: W(-3, 6),
      boats: W(16, -6),
      // da dove si arriva in paese dalla brughiera
      gate: W(-26, 0),
    },
    update(t) {
      lamps.forEach((l, i) => (l.material.opacity = 0.5 + Math.sin(t * 5 + i) * 0.05 + Math.random() * 0.05));
    },
    dispose() {
      scene.remove(root);
      disposables.forEach((d) => d.dispose?.());
    },
  };
}
