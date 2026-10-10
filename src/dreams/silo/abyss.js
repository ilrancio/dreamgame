import * as THREE from 'three';
import { mulberry32 } from '../../core/noise.js';
import { glowTexture } from '../../core/textures.js';
import { buildChest } from './props.js';
import { abyssChest, abyssBoss } from './data.js';

// L'Abisso: sotto la statua della balena, dopo che il dio se n'è andato, resta
// il suo sogno. Piani sempre diversi di sale circolari collegate da cunicoli,
// fra colonne di cristallo nero, costole di balena e bolle che salgono. In ogni
// piano si scende dal vortice; ogni cinque piani un guardiano lo custodisce.

const V = (x, y, z) => new THREE.Vector3(x, y, z);
export const ABISSO = { x: 0, z: 3000, h: 16 };
const CELL = 26;
const CW = 3.2; // metà larghezza dei cunicoli

function segD(x, z, a, b) {
  const dx = b.x - a.x;
  const dz = b.z - a.z;
  const t = Math.max(0, Math.min(1, ((x - a.x) * dx + (z - a.z) * dz) / (dx * dx + dz * dz)));
  return Math.hypot(x - a.x - dx * t, z - a.z - dz * t);
}

// una spirale disegnata, per il vortice
function spiralTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const g = c.getContext('2d');
  g.translate(128, 128);
  for (let arm = 0; arm < 4; arm++) {
    g.beginPath();
    for (let i = 0; i < 120; i++) {
      const t = i / 120;
      const a = arm * (Math.PI / 2) + t * Math.PI * 3;
      const r = t * 124;
      if (i) g.lineTo(Math.cos(a) * r, Math.sin(a) * r);
      else g.moveTo(0, 0);
    }
    g.strokeStyle = 'rgba(255,255,255,0.9)';
    g.lineWidth = 9;
    g.stroke();
  }
  const rg = g.createRadialGradient(0, 0, 0, 0, 0, 128);
  rg.addColorStop(0, 'rgba(255,255,255,1)');
  rg.addColorStop(0.2, 'rgba(255,255,255,0.2)');
  rg.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = rg;
  g.fillRect(-128, -128, 256, 256);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// la pianta di un piano: sale su una griglia, collegate come un labirinto
function layout(floor, seed) {
  const rand = mulberry32(seed);
  const cols = floor >= 10 ? 5 : 4;
  const rows = 4;
  const want = Math.min(cols * rows, 7 + Math.min(6, Math.floor(floor / 2)) + Math.floor(rand() * 2));
  const key = (i, j) => `${i},${j}`;
  const start = [Math.floor(rand() * cols), 0];
  const cells = new Map([[key(...start), { i: start[0], j: start[1] }]]);
  const links = [];
  const stack = [start];
  while (cells.size < want && stack.length) {
    const [i, j] = stack[stack.length - 1];
    const nb = [[i + 1, j], [i - 1, j], [i, j + 1], [i, j - 1]].filter(([a, b]) => a >= 0 && b >= 0 && a < cols && b < rows && !cells.has(key(a, b)));
    if (!nb.length) {
      stack.pop();
      continue;
    }
    const [a, b] = nb[Math.floor(rand() * nb.length)];
    cells.set(key(a, b), { i: a, j: b });
    links.push([key(i, j), key(a, b)]);
    stack.push([a, b]);
  }
  // qualche scorciatoia in più
  const all = [...cells.values()];
  for (let n = 0; n < 2; n++) {
    const c = all[Math.floor(rand() * all.length)];
    const o = cells.get(key(c.i + 1, c.j)) || cells.get(key(c.i, c.j + 1));
    if (o && !links.some(([p, q]) => (p === key(c.i, c.j) && q === key(o.i, o.j)) || (q === key(c.i, c.j) && p === key(o.i, o.j)))) links.push([key(c.i, c.j), key(o.i, o.j)]);
  }
  const rooms = all.map((c) => ({
    k: key(c.i, c.j),
    x: (c.i - (cols - 1) / 2) * CELL + (rand() - 0.5) * 6,
    z: (c.j - (rows - 1) / 2) * CELL + (rand() - 0.5) * 6,
    r: 7 + rand() * 2.5,
  }));
  const byK = Object.fromEntries(rooms.map((r) => [r.k, r]));
  const L = links.map(([a, b]) => [byK[a], byK[b]]);
  // la sala più lontana dall'ingresso è quella del vortice
  const dist = new Map([[rooms[0], 0]]);
  const q = [rooms[0]];
  while (q.length) {
    const r = q.shift();
    for (const [a, b] of L) {
      const o = a === r ? b : b === r ? a : null;
      if (o && !dist.has(o)) {
        dist.set(o, dist.get(r) + 1);
        q.push(o);
      }
    }
  }
  const end = rooms.reduce((m, r) => (dist.get(r) > dist.get(m) ? r : m), rooms[0]);
  if (abyssBoss(floor)) end.r = 11.5;
  return { rooms, links: L, start: rooms[0], end, rand };
}

export function buildAbyss(scene) {
  const disposables = [];
  const track = (o) => (disposables.push(o), o);
  const root = new THREE.Group();
  root.position.set(ABISSO.x, 0, ABISSO.z);
  scene.add(root);
  const glow = track(glowTexture('rgba(255,255,255,1)'));
  const spiral = track(spiralTexture());
  const W = (x, z) => V(ABISSO.x + x, 0, ABISSO.z + z);
  // le luci: poche, quelle che contano
  const lights = [];
  const mkLight = (col, power, dist) => {
    const L = new THREE.PointLight(col, power, dist, 1.3);
    L.visible = false;
    root.add(L);
    lights.push({ light: L, base: power });
    return L;
  };
  const startLight = mkLight('#9ad8ff', 28, 26);
  const endLight = mkLight('#b06aff', 70, 34);
  const midLight = mkLight('#5affd8', 40, 34);
  let lit = false;
  let floorGroup = null;
  let floorDisp = [];
  let L = null;
  const api = {
    floor: 0,
    lights,
    rooms: [],
    chests: [],
    spots: {},
    // costruisce un piano nuovo (quello di prima sparisce)
    build(floor, seed) {
      if (floorGroup) {
        root.remove(floorGroup);
        floorDisp.forEach((d) => d.dispose?.());
      }
      floorDisp = [];
      const tr = (o) => (floorDisp.push(o), o);
      floorGroup = new THREE.Group();
      root.add(floorGroup);
      L = layout(floor, seed);
      const { rooms, links, start, end, rand } = L;
      api.floor = floor;
      api.rooms = rooms;
      const sdf = (x, z) => {
        let d = Infinity;
        for (const c of rooms) d = Math.min(d, Math.hypot(x - c.x, z - c.z) - c.r);
        for (const [a, b] of links) d = Math.min(d, segD(x, z, a, b) - CW);
        return d;
      };
      api.sdf = sdf;
      // i colori cambiano con la profondità
      const hue = (0.66 + floor * 0.037) % 1;
      const col = (s, l) => new THREE.Color().setHSL(hue, s, l);
      const hue2 = (hue + 0.12) % 1;
      const mat = (o) => tr(new THREE.MeshStandardMaterial({ roughness: 0.5, ...o }));
      // il pavimento: acqua nera e ferma, che riflette un po'
      const xs = rooms.map((r) => r.x);
      const zs = rooms.map((r) => r.z);
      const minX = Math.min(...xs) - 20;
      const maxX = Math.max(...xs) + 20;
      const minZ = Math.min(...zs) - 20;
      const maxZ = Math.max(...zs) + 20;
      const fl = new THREE.Mesh(tr(new THREE.PlaneGeometry(maxX - minX, maxZ - minZ)), mat({ color: col(0.4, 0.06), emissive: col(0.6, 0.03), roughness: 0.15, metalness: 0.4 }));
      fl.rotation.x = -Math.PI / 2;
      fl.position.set((minX + maxX) / 2, 0, (minZ + maxZ) / 2);
      floorGroup.add(fl);
      // un cerchio di luce sul pavimento di ogni sala
      const ringMat = tr(new THREE.MeshBasicMaterial({ color: col(0.8, 0.5), transparent: true, opacity: 0.35, blending: THREE.AdditiveBlending, depthWrite: false }));
      for (const r of rooms) {
        const ring = new THREE.Mesh(tr(new THREE.RingGeometry(r.r - 1.6, r.r - 1.3, 48)), ringMat);
        ring.rotation.x = -Math.PI / 2;
        ring.position.set(r.x, 0.03, r.z);
        floorGroup.add(ring);
      }
      // le pareti: colonne di cristallo nero lungo il bordo
      const pts = [];
      for (let x = minX; x < maxX; x += 2.1) {
        for (let z = minZ; z < maxZ; z += 2.1) {
          const d = sdf(x, z);
          if (d > 0.7 && d < 3.4) pts.push([x + (rand() - 0.5) * 0.7, z + (rand() - 0.5) * 0.7, d]);
        }
      }
      const colGeo = tr(new THREE.CylinderGeometry(0.75, 1.05, 1, 6));
      colGeo.translate(0, 0.5, 0);
      const colMat = mat({ color: '#ffffff', roughness: 0.45, metalness: 0.3, flatShading: true });
      const cols = new THREE.InstancedMesh(colGeo, colMat, pts.length);
      const m4 = new THREE.Matrix4();
      const q = new THREE.Quaternion();
      const e = new THREE.Euler();
      pts.forEach(([x, z, d], i) => {
        const h = 3 + rand() * 7 + (d - 0.7) * 3;
        const s = 0.8 + rand() * 0.7;
        e.set((rand() - 0.5) * 0.25, rand() * 3, (rand() - 0.5) * 0.25);
        q.setFromEuler(e);
        m4.compose(V(x, 0, z), q, V(s, h, s));
        cols.setMatrixAt(i, m4);
        cols.setColorAt(i, rand() < 0.12 ? new THREE.Color().setHSL(hue2, 0.9, 0.55) : col(0.35, 0.08 + rand() * 0.07));
      });
      floorGroup.add(cols);
      tr(cols);
      // le punte che brillano in cima ad alcune colonne
      const tipMat = mat({ color: col(0.9, 0.7), emissive: col(0.9, 0.55), emissiveIntensity: 1.6 });
      const tipGeo = tr(new THREE.OctahedronGeometry(0.45, 0));
      for (let i = 0; i < pts.length; i += 9) {
        const [x, z] = pts[i];
        const t = new THREE.Mesh(tipGeo, tipMat);
        t.position.set(x, 1 + rand() * 4, z);
        t.scale.set(0.8, 2 + rand() * 2, 0.8);
        floorGroup.add(t);
      }
      // le costole di balena, arcate sopra alcune sale
      const boneMat = mat({ color: '#d8d0c0', roughness: 0.8, emissive: col(0.4, 0.1) });
      for (const r of rooms) {
        if (r === start || r === end || rand() < 0.5) continue;
        const a = rand() * Math.PI;
        for (let k = -1; k <= 1; k++) {
          const rib = new THREE.Mesh(tr(new THREE.TorusGeometry(r.r * 0.8, 0.28, 6, 18, Math.PI)), boneMat);
          rib.position.set(r.x + Math.cos(a) * k * 2.6, 0, r.z + Math.sin(a) * k * 2.6);
          rib.rotation.y = a + Math.PI / 2;
          rib.scale.y = 1.2;
          floorGroup.add(rib);
        }
      }
      // le luci che galleggiano
      const orbs = [];
      for (const r of rooms) {
        const n = 2 + Math.floor(rand() * 3);
        for (let k = 0; k < n; k++) {
          const s = new THREE.Sprite(tr(new THREE.SpriteMaterial({ map: glow, color: rand() < 0.5 ? col(0.9, 0.65) : new THREE.Color().setHSL(hue2, 0.9, 0.65), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0.8 })));
          const a = rand() * Math.PI * 2;
          const d = rand() * (r.r - 2);
          s.position.set(r.x + Math.cos(a) * d, 2 + rand() * 6, r.z + Math.sin(a) * d);
          s.scale.setScalar(0.5 + rand() * 0.8);
          s.userData = { y: s.position.y, p: rand() * 6 };
          floorGroup.add(s);
          orbs.push(s);
        }
      }
      api.orbs = orbs;
      // le bolle che salgono, dappertutto
      const nb = 500;
      const bp = new Float32Array(nb * 3);
      for (let i = 0; i < nb; i++) {
        const r = rooms[Math.floor(rand() * rooms.length)];
        const a = rand() * Math.PI * 2;
        const d = rand() * r.r;
        bp[i * 3] = r.x + Math.cos(a) * d;
        bp[i * 3 + 1] = rand() * ABISSO.h;
        bp[i * 3 + 2] = r.z + Math.sin(a) * d;
      }
      const bg = tr(new THREE.BufferGeometry());
      bg.setAttribute('position', new THREE.BufferAttribute(bp, 3));
      api.bubbles = new THREE.Points(bg, tr(new THREE.PointsMaterial({ map: glow, color: col(0.6, 0.8), size: 0.18, transparent: true, opacity: 0.7, depthWrite: false, blending: THREE.AdditiveBlending })));
      floorGroup.add(api.bubbles);
      // la colonna di luce dell'ingresso: di lassù si torna al silo
      const beam = new THREE.Mesh(tr(new THREE.CylinderGeometry(1.4, 1.8, ABISSO.h * 2, 20, 1, true)), tr(new THREE.MeshBasicMaterial({ color: '#bfe8ff', transparent: true, opacity: 0.1, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide })));
      beam.position.set(start.x, ABISSO.h, start.z);
      floorGroup.add(beam);
      startLight.position.set(start.x, 9, start.z - 4);
      // il vortice
      const vortex = new THREE.Mesh(tr(new THREE.CircleGeometry(2.6, 40)), tr(new THREE.MeshBasicMaterial({ map: spiral, color: new THREE.Color().setHSL(hue2, 0.9, 0.7), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false })));
      vortex.rotation.x = -Math.PI / 2;
      vortex.position.set(end.x, 0.06, end.z + (abyssBoss(floor) ? 3 : 0));
      floorGroup.add(vortex);
      api.vortex = vortex;
      endLight.position.set(end.x, 5, end.z);
      endLight.color.setHSL(hue2, 0.8, 0.6);
      const mid = rooms[Math.floor(rooms.length / 2)];
      midLight.position.set(mid.x, 7, mid.z);
      midLight.color.setHSL(hue, 0.7, 0.6);
      // i forzieri, in sale a caso
      api.chests = [];
      const others = rooms.filter((r) => r !== start && r !== end);
      const nChest = Math.min(others.length, 1 + Math.floor(rand() * 3));
      for (let k = 0; k < nChest; k++) {
        const r = others.splice(Math.floor(rand() * others.length), 1)[0];
        const a = rand() * Math.PI * 2;
        const c = buildChest(floorGroup, V(r.x + Math.cos(a) * (r.r - 2.5), 0, r.z + Math.sin(a) * (r.r - 2.5)), a + Math.PI);
        c.pos.add(V(ABISSO.x, 0, ABISSO.z));
        c.content = abyssChest(floor, rand);
        api.chests.push(c);
      }
      // dopo i guardiani, una pozza di luce che rimette in forze
      api.spring = (floor - 1) % 5 === 0 ? W(start.x + 4, start.z + 2) : null;
      if (api.spring) {
        const s = new THREE.Sprite(tr(new THREE.SpriteMaterial({ map: glow, color: '#7ad8ff', blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0.9 })));
        s.scale.set(2.6, 2.6, 1);
        s.position.set(start.x + 4, 0.9, start.z + 2);
        floorGroup.add(s);
        const pool = new THREE.Mesh(tr(new THREE.CircleGeometry(1.3, 24)), tr(new THREE.MeshBasicMaterial({ color: '#7ad8ff', transparent: true, opacity: 0.6, blending: THREE.AdditiveBlending, depthWrite: false })));
        pool.rotation.x = -Math.PI / 2;
        pool.position.set(start.x + 4, 0.05, start.z + 2);
        floorGroup.add(pool);
      }
      api.spots = {
        start: W(start.x, start.z + 2.5),
        exit: W(start.x, start.z),
        vortex: W(vortex.position.x, vortex.position.z),
        boss: W(end.x, end.z - 5),
        endRoom: W(end.x, end.z),
      };
      api.setLit(lit);
    },
    roomAt(x, z) {
      const lx = x - ABISSO.x;
      const lz = z - ABISSO.z;
      let best = null;
      let bd = Infinity;
      for (const c of api.rooms) {
        const d = Math.hypot(lx - c.x, lz - c.z) - c.r;
        if (d < bd) {
          bd = d;
          best = c;
        }
      }
      return best;
    },
    isStart(x, z) {
      return api.roomAt(x, z) === L?.start;
    },
    blocked(x, z) {
      if (!L) return true;
      return api.sdf(x - ABISSO.x, z - ABISSO.z) > -1.2;
    },
    camBlocked(x, z) {
      return !L || api.sdf(x - ABISSO.x, z - ABISSO.z) > -0.6;
    },
    arenaAt(x, z) {
      const c = api.roomAt(x, z);
      const o = W(c.x, c.z);
      const k = Math.min(1.2, c.r / 9);
      const big = c === L.end && abyssBoss(api.floor);
      return {
        party: [o.clone().add(V(-4 * k, 0, 5 * k)), o.clone().add(V(-1.4 * k, 0, 5.8 * k)), o.clone().add(V(1.4 * k, 0, 5.8 * k)), o.clone().add(V(4 * k, 0, 5 * k))],
        enemies: [o.clone().add(V(-4.5 * k, 0, -3 * k)), o.clone().add(V(0, 0, -4 * k)), o.clone().add(V(4.5 * k, 0, -3 * k)), o.clone().add(V(0, 0, -0.6 * k))],
        boss: o.clone().add(V(0, 0, big ? -6 : -5 * k)),
        scale: big ? 1.15 : 0.85,
        clamp: (pos) => {
          for (let i = 0; i < 30 && api.sdf(pos.x - ABISSO.x, pos.z - ABISSO.z) > -1.4; i++) pos.lerp(V(o.x, pos.y, o.z + 4 * k), 0.12);
          pos.y = Math.min(pos.y, ABISSO.h - 1);
        },
      };
    },
    setLit(on) {
      lit = on;
      lights.forEach((l) => (l.light.visible = on));
      if (floorGroup) floorGroup.visible = on;
    },
    update(t, dt) {
      if (!lit || !floorGroup) return;
      api.vortex.rotation.z = -t * 1.6;
      for (const s of api.orbs) s.position.y = s.userData.y + Math.sin(t * 0.8 + s.userData.p) * 0.5;
      const p = api.bubbles.geometry.attributes.position;
      for (let i = 0; i < p.count; i++) {
        let y = p.getY(i) + dt * (0.6 + (i % 7) * 0.12);
        if (y > ABISSO.h) y = 0;
        p.setY(i, y);
      }
      p.needsUpdate = true;
    },
    dispose() {
      scene.remove(root);
      floorDisp.forEach((d) => d.dispose?.());
      disposables.forEach((d) => d.dispose?.());
    },
  };
  return api;
}
