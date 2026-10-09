import * as THREE from 'three';
import { mulberry32 } from '../../core/noise.js';
import { glowTexture } from '../../core/textures.js';

// I due dungeon della campagna, lontani da tutto come l'interno del silo.

const V = (x, y, z) => new THREE.Vector3(x, y, z);

// ================= IL FARO SPENTO =================
// Tre stanze rotonde una sopra l'altra (qui: una accanto all'altra, si passa
// con le scale): l'ingresso, gli alloggi del guardiano, la sala della lanterna.
export const FARO = { x: -3000, z: 0, r: 8.5, h: 6 };

export function buildLighthouse(scene) {
  const disposables = [];
  const track = (o) => (disposables.push(o), o);
  const root = new THREE.Group();
  root.position.set(FARO.x, 0, FARO.z);
  scene.add(root);
  const mat = (color, o = {}) => track(new THREE.MeshStandardMaterial({ color, roughness: 0.85, ...o }));
  const boxGeo = track(new THREE.BoxGeometry(1, 1, 1));
  const box = (w, h, d, m, x, y, z, parent) => {
    const o = new THREE.Mesh(boxGeo, m);
    o.scale.set(w, h, d);
    o.position.set(x, y + h / 2, z);
    parent.add(o);
    return o;
  };
  const wallMat = mat('#8a8478', { side: THREE.BackSide });
  const floorMat = mat('#5a4030');
  const ROOMS = [
    { name: 'L\'ingresso del faro', z: 0 },
    { name: 'Gli alloggi del guardiano', z: 40 },
    { name: 'La sala della lanterna', z: 80 },
  ];
  const lights = [];
  const glow = track(glowTexture('rgba(255,255,255,1)'));
  ROOMS.forEach((R, i) => {
    const g = new THREE.Group();
    g.position.set(0, 0, R.z);
    root.add(g);
    const floor = new THREE.Mesh(track(new THREE.CircleGeometry(FARO.r, 32)), floorMat);
    floor.rotation.x = -Math.PI / 2;
    g.add(floor);
    // le assi del pavimento
    for (let k = -FARO.r; k < FARO.r; k += 1.2) box(0.04, 0.02, Math.sqrt(Math.max(0, FARO.r * FARO.r - k * k)) * 2, mat('#3a2a1e'), k, 0, 0, g);
    const wall = new THREE.Mesh(track(new THREE.CylinderGeometry(FARO.r, FARO.r, FARO.h, 32, 1, true)), wallMat);
    wall.position.y = FARO.h / 2;
    g.add(wall);
    const ceil = new THREE.Mesh(track(new THREE.CircleGeometry(FARO.r, 32)), mat('#2a2420', { side: THREE.DoubleSide }));
    ceil.rotation.x = Math.PI / 2;
    ceil.position.y = FARO.h;
    g.add(ceil);
    // la scala a chiocciola contro il muro, per finta
    for (let k = 0; k < 14; k++) {
      const a = 2.2 + k * 0.22;
      const step = box(1.6, 0.15, 0.6, mat('#6a5a4a'), Math.cos(a) * (FARO.r - 1), k * 0.42, Math.sin(a) * (FARO.r - 1), g);
      step.rotation.y = -a;
    }
    const light = new THREE.PointLight(i === 2 ? '#c8e0ff' : '#ffc070', 30, 22, 1.4);
    light.position.set(0, FARO.h - 1, 0);
    light.visible = false;
    g.add(light);
    lights.push({ light, base: 30 });
    if (i < 2) {
      const lamp = new THREE.Sprite(track(new THREE.SpriteMaterial({ map: glow, color: '#ffc070', blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0.6 })));
      lamp.position.set(-3, 3.5, -FARO.r + 0.6);
      lamp.scale.set(2, 2, 1);
      g.add(lamp);
    }
  });
  // l'arredo degli alloggi: un letto, un tavolo, il diario del guardiano
  const R1 = root.children[1];
  box(2, 0.5, 1, mat('#6a4a3a'), 5, 0, -2, R1);
  box(1.6, 0.8, 1.2, mat('#5a3a28'), -4, 0, 2, R1);
  box(0.5, 0.06, 0.4, mat('#e8e0c8'), -4, 0.8, 2, R1);
  // casse all'ingresso
  const R0 = root.children[0];
  for (const [x, z] of [[5, -3], [5.6, -1.8], [4.4, -4.2]]) box(1, 1, 1, mat('#6a5038'), x, 0, z, R0);
  // la lente gigante nella sala della lanterna
  const R2 = root.children[2];
  const lensMat = track(new THREE.MeshStandardMaterial({ color: '#c8e8ff', transparent: true, opacity: 0.55, roughness: 0.1, metalness: 0.1, emissive: '#ffe8a0', emissiveIntensity: 0 }));
  const lens = new THREE.Mesh(track(new THREE.IcosahedronGeometry(1.6, 1)), lensMat);
  lens.position.set(0, 2.4, -4);
  R2.add(lens);
  box(1.6, 0.8, 1.6, mat('#3a3a3e', { metalness: 0.6 }), 0, 0, -4, R2);

  const W = (room, x, z) => V(FARO.x + x, 0, FARO.z + ROOMS[room].z + z);
  return {
    rooms: ROOMS.map((R, i) => ({ ...R, center: W(i, 0, 0) })),
    lights,
    spots: {
      exit: W(0, 0, FARO.r - 1.5),
      save: W(0, -4, 4),
      up: [W(0, -5.5, -4.5), W(1, -5.5, -4.5)],
      down: [null, W(1, 5.5, 4.5), W(2, 5.5, 4.5)],
      diary: W(1, -4, 3.2),
      lens: W(2, 0, -2),
      boss: W(2, 0, -4),
      chests: [{ id: 'faro1', pos: W(0, 5, 3) }, { id: 'faro2', pos: W(1, 5, 1.5) }],
    },
    // in quale stanza sei
    roomAt(x, z) {
      for (let i = 0; i < ROOMS.length; i++) if (Math.hypot(x - FARO.x, z - FARO.z - ROOMS[i].z) < FARO.r + 2) return i;
      return -1;
    },
    blocked(x, z) {
      const i = this.roomAt(x, z);
      if (i < 0) return true;
      const d = Math.hypot(x - FARO.x, z - FARO.z - ROOMS[i].z);
      if (d > FARO.r - 0.8) return true;
      // la lente e il suo piedistallo
      if (i === 2 && Math.hypot(x - FARO.x, z - FARO.z - ROOMS[i].z + 4) < 1.6) return true;
      return false;
    },
    arenaAt(x, z) {
      const i = Math.max(0, this.roomAt(x, z));
      const c = W(i, 0, 0);
      return {
        party: [c.clone().add(V(-3.6, 0, 4.4)), c.clone().add(V(-1.2, 0, 5)), c.clone().add(V(1.2, 0, 5)), c.clone().add(V(3.6, 0, 4.4))],
        enemies: [c.clone().add(V(-3.6, 0, -1.6)), c.clone().add(V(0, 0, -2.6)), c.clone().add(V(3.6, 0, -1.6)), c.clone().add(V(0, 0, 0.4))],
        boss: c.clone().add(V(0, 0, -3)),
        scale: 0.62,
        clamp: (pos) => {
          const dx = pos.x - c.x;
          const dz = pos.z - c.z;
          const d = Math.hypot(dx, dz);
          const max = FARO.r - 0.6;
          if (d > max) {
            pos.x = c.x + (dx / d) * max;
            pos.z = c.z + (dz / d) * max;
          }
          pos.y = Math.min(pos.y, FARO.h - 0.5);
        },
      };
    },
    // la camera resta dentro la stanza
    camBlocked(x, z) {
      const i = this.roomAt(x, z);
      return i < 0 || Math.hypot(x - FARO.x, z - FARO.z - ROOMS[i].z) > FARO.r - 0.5;
    },
    setLit(on) {
      lights.forEach((L) => (L.light.visible = on));
    },
    setLensLit(on) {
      lensMat.emissiveIntensity = on ? 2.5 : 0;
    },
    update(t) {
      lens.rotation.y = t * 0.3;
    },
    dispose() {
      scene.remove(root);
      disposables.forEach((d) => d.dispose?.());
    },
  };
}

// ================= LE GROTTE DEI CIRRIPEDI =================
// Caverne collegate da cunicoli, sotto la scogliera. Cristalli che brillano,
// un lago sotterraneo, e in fondo la Madre delle Meduse.
export const GROTTE = { x: 0, z: -3000, h: 10 };
const CH = [
  { id: 'A', x: 0, z: 0, r: 11, name: 'L\'ingresso delle grotte' },
  { id: 'B', x: 34, z: 22, r: 13, name: 'La grotta dei cristalli' },
  { id: 'C', x: 66, z: -6, r: 13, name: 'Il lago sotterraneo', lake: 4.2, lx: 6, lz: -6 },
  { id: 'D', x: 24, z: -34, r: 10, name: 'Il santuario sommerso' },
  { id: 'E', x: 104, z: 20, r: 17, name: 'La culla della Madre' },
];
const LINKS = [
  ['A', 'B'],
  ['B', 'C'],
  ['C', 'E'],
  ['A', 'D'],
  ['D', 'C'],
];
const CW = 3.2; // metà larghezza dei cunicoli
const byId = Object.fromEntries(CH.map((c) => [c.id, c]));

function segD(x, z, a, b) {
  const dx = b.x - a.x;
  const dz = b.z - a.z;
  const t = Math.max(0, Math.min(1, ((x - a.x) * dx + (z - a.z) * dz) / (dx * dx + dz * dz)));
  return Math.hypot(x - a.x - dx * t, z - a.z - dz * t);
}
// quanto sei dentro la grotta (negativo = dentro), in coordinate locali
function caveSdf(x, z) {
  let d = Infinity;
  for (const c of CH) d = Math.min(d, Math.hypot(x - c.x, z - c.z) - c.r);
  for (const [a, b] of LINKS) d = Math.min(d, segD(x, z, byId[a], byId[b]) - CW);
  return d;
}

export function buildCaves(scene) {
  const disposables = [];
  const track = (o) => (disposables.push(o), o);
  const root = new THREE.Group();
  root.position.set(GROTTE.x, 0, GROTTE.z);
  scene.add(root);
  const mat = (color, o = {}) => track(new THREE.MeshStandardMaterial({ color, roughness: 0.8, ...o }));
  const rand = mulberry32(99);
  // il pavimento: una lastra di roccia bagnata sotto tutto
  const floor = new THREE.Mesh(track(new THREE.PlaneGeometry(200, 120, 1, 1)), mat('#24282a', { roughness: 0.4, metalness: 0.15 }));
  floor.rotation.x = -Math.PI / 2;
  floor.position.set(52, 0, -6);
  root.add(floor);
  const ceil = new THREE.Mesh(track(new THREE.PlaneGeometry(200, 120)), mat('#0e1012', { side: THREE.DoubleSide }));
  ceil.rotation.x = Math.PI / 2;
  ceil.position.set(52, GROTTE.h, -6);
  root.add(ceil);
  // le pareti: massi lungo il bordo delle caverne e dei cunicoli
  const rockGeo = track(new THREE.DodecahedronGeometry(1, 0));
  const pts = [];
  for (let x = -20; x < 130; x += 2.2) {
    for (let z = -50; z < 44; z += 2.2) {
      const d = caveSdf(x, z);
      if (d > 0.9 && d < 3.2) pts.push([x + (rand() - 0.5) * 0.6, z + (rand() - 0.5) * 0.6]);
    }
  }
  const walls = new THREE.InstancedMesh(rockGeo, mat('#3a3e42', { flatShading: true, roughness: 0.7 }), pts.length * 2);
  const m4 = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const e = new THREE.Euler();
  let n = 0;
  for (const [x, z] of pts) {
    for (let k = 0; k < 2; k++) {
      const s = 1.1 + rand() * 1.3;
      e.set(rand() * 3, rand() * 3, rand() * 3);
      q.setFromEuler(e);
      m4.compose(V(x, k ? GROTTE.h - 2 - rand() * 2 : s * 0.6 + rand() * 2.5, z), q, V(s, s * (1 + rand() * 1.4), s));
      walls.setMatrixAt(n++, m4);
    }
  }
  walls.count = n;
  root.add(walls);
  // le stalattiti
  const stal = track(new THREE.ConeGeometry(0.4, 2.6, 6));
  const stalMat = mat('#4a4e50');
  for (let i = 0; i < 140; i++) {
    const x = -10 + rand() * 135;
    const z = -45 + rand() * 85;
    if (caveSdf(x, z) > -1.5) continue;
    const c = new THREE.Mesh(stal, stalMat);
    c.position.set(x, GROTTE.h - 1.2, z);
    c.rotation.x = Math.PI;
    c.scale.setScalar(0.6 + rand() * 1.2);
    root.add(c);
  }
  // i cristalli che brillano, e una luce per caverna
  const crystalGeo = track(new THREE.OctahedronGeometry(0.5, 0));
  const lights = [];
  const colors = ['#5ad8ff', '#a86aff', '#5affc8'];
  CH.forEach((c, i) => {
    const col = colors[i % 3];
    const cm = mat(col, { emissive: col, emissiveIntensity: 1.6, roughness: 0.2 });
    for (let k = 0; k < 10; k++) {
      const a = rand() * Math.PI * 2;
      const r = c.r - 1.5 - rand() * 1.5;
      const cr = new THREE.Mesh(crystalGeo, cm);
      cr.position.set(c.x + Math.cos(a) * r, 0.3 + rand() * 0.6, c.z + Math.sin(a) * r);
      cr.scale.set(0.6 + rand(), 1.2 + rand() * 2, 0.6 + rand());
      cr.rotation.set(rand() * 0.6, rand() * 3, rand() * 0.6);
      root.add(cr);
    }
    const L = new THREE.PointLight(col, 70, c.r * 3, 1.3);
    L.position.set(c.x, GROTTE.h - 2.5, c.z);
    L.visible = false;
    root.add(L);
    lights.push({ light: L, base: 70 });
    if (c.lake) {
      const w = new THREE.Mesh(track(new THREE.CircleGeometry(c.lake, 32)), mat('#0a2a30', { emissive: '#0a5a5a', emissiveIntensity: 0.7, roughness: 0.1 }));
      w.rotation.x = -Math.PI / 2;
      w.position.set(c.x + c.lx, 0.05, c.z + c.lz);
      root.add(w);
    }
  });
  // nella culla della Madre: il bozzolo dove è rimasto intrappolato Nilo
  const E = byId.E;
  const cocoonMat = track(new THREE.MeshStandardMaterial({ color: '#9af0ff', transparent: true, opacity: 0.45, emissive: '#3ab8ff', emissiveIntensity: 0.8 }));
  const cocoon = new THREE.Mesh(track(new THREE.SphereGeometry(1.4, 16, 12)), cocoonMat);
  cocoon.scale.set(1, 1.5, 1);
  cocoon.position.set(E.x + 10, 1.8, E.z + 6);
  root.add(cocoon);

  const W = (x, z) => V(GROTTE.x + x, 0, GROTTE.z + z);
  return {
    chambers: CH.map((c) => ({ ...c, center: W(c.x, c.z) })),
    lights,
    cocoon,
    spots: {
      exit: W(-7, 4),
      save: W(4, 6),
      marta: W(3, -3),
      boss: W(E.x - 2, E.z),
      nilo: W(E.x + 8.5, E.z + 5),
      seal: W(E.x + 4, E.z - 8),
      chests: [{ id: 'grotte1', pos: W(byId.B.x + 7, byId.B.z + 6) }, { id: 'grotte2', pos: W(byId.D.x - 4, byId.D.z - 4) }, { id: 'grotte3', pos: W(byId.C.x - 7, byId.C.z + 6) }],
    },
    camBlocked(x, z) {
      return caveSdf(x - GROTTE.x, z - GROTTE.z) > -1;
    },
    chamberAt(x, z) {
      const lx = x - GROTTE.x;
      const lz = z - GROTTE.z;
      let best = null;
      let bd = Infinity;
      for (const c of CH) {
        const d = Math.hypot(lx - c.x, lz - c.z) - c.r;
        if (d < bd) {
          bd = d;
          best = c;
        }
      }
      return best;
    },
    blocked(x, z) {
      const lx = x - GROTTE.x;
      const lz = z - GROTTE.z;
      if (caveSdf(lx, lz) > -1.4) return true;
      const C = byId.C;
      if (Math.hypot(lx - C.x - C.lx, lz - C.z - C.lz) < C.lake + 0.4) return true;
      return false;
    },
    // si combatte al centro della caverna più vicina
    arenaAt(x, z) {
      const c = this.chamberAt(x, z);
      const o = W(c.x, c.z);
      const k = Math.min(1, c.r / 13);
      return {
        party: [o.clone().add(V(-4 * k, 0, 5 * k)), o.clone().add(V(-1.4 * k, 0, 5.8 * k)), o.clone().add(V(1.4 * k, 0, 5.8 * k)), o.clone().add(V(4 * k, 0, 5 * k))],
        enemies: [o.clone().add(V(-4.5 * k, 0, -3 * k)), o.clone().add(V(0, 0, -4 * k)), o.clone().add(V(4.5 * k, 0, -3 * k)), o.clone().add(V(0, 0, -0.6 * k))],
        boss: o.clone().add(V(0, 0, -5 * k)),
        scale: 0.75,
        // la camera non entra nella roccia: si avvicina al centro finché serve
        clamp: (pos) => {
          for (let i = 0; i < 30 && caveSdf(pos.x - GROTTE.x, pos.z - GROTTE.z) > -1.6; i++) pos.lerp(V(o.x, pos.y, o.z + 4 * k), 0.12);
          pos.y = Math.min(pos.y, GROTTE.h - 1.5);
        },
      };
    },
    setLit(on) {
      lights.forEach((L) => (L.light.visible = on));
    },
    update(t) {
      cocoon.rotation.y = t * 0.2;
      cocoonMat.emissiveIntensity = 0.7 + Math.sin(t * 2) * 0.2;
    },
    dispose() {
      scene.remove(root);
      disposables.forEach((d) => d.dispose?.());
    },
  };
}
