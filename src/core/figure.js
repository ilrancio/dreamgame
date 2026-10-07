import * as THREE from 'three';
import { OBJLoader } from 'three/addons/loaders/OBJLoader.js';

// I personaggi di Quaternius (OBJ, un pezzo solo, senza scheletro): lo
// scheletro lo diamo noi. Ogni vertice va a un osso secondo dove sta nel
// corpo (gambe, ginocchia, braccia, gomiti, testa, il resto al busto), con un
// po' di sfumatura vicino alle giunture. Le ossa poi copiano le rotazioni
// delle "membra" del Character: la stessa animazione di prima, su un corpo vero.
//
// Il modello originale è alto 4,82 unità, guarda verso +z, braccia lungo i
// fianchi; la sinistra del personaggio è +x.

const H = 4.82;
export const FIGURE_SCALE = 1.8 / H;

const smooth = (a, b, x) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

// le giunture, in unità del modello
const J = {
  hip: { y: 2.05, x: 0.24 },
  knee: { y: 1.05 },
  shoulder: { y: 3.68, x: 0.52 },
  elbow: { y: 2.68 },
  neck: { y: 3.92 },
};
const BONES = ['spine', 'head', 'legL', 'shinL', 'legR', 'shinR', 'armL', 'foreL', 'armR', 'foreR'];
const B = Object.fromEntries(BONES.map((n, i) => [n, i]));

const geometries = new Map(); // nome → geometria con i pesi (condivisa)

function weigh(x, y) {
  const w = new Map();
  const add = (b, v) => v > 1e-3 && w.set(b, (w.get(b) || 0) + v);
  const side = x >= 0 ? 'L' : 'R';
  const ax = Math.abs(x);
  // le braccia: fuori dal busto, sotto la spalla (le mani scendono fin quasi al ginocchio)
  const arm = y > 1.5 ? smooth(0.37, 0.39, ax) * (1 - smooth(3.5, 3.8, y)) : 0;
  // le gambe: sotto le anche
  const leg = (1 - arm) * (1 - smooth(1.85, 2.2, y));
  const head = (1 - arm) * smooth(3.86, 4.02, y);
  const spine = Math.max(0, 1 - arm - leg - head);
  if (arm) {
    const fore = 1 - smooth(2.55, 2.8, y);
    add(B[`arm${side}`], arm * (1 - fore));
    add(B[`fore${side}`], arm * fore);
  }
  if (leg) {
    const shin = 1 - smooth(0.95, 1.15, y);
    add(B[`leg${side}`], leg * (1 - shin));
    add(B[`shin${side}`], leg * shin);
  }
  add(B.head, head);
  add(B.spine, spine);
  const list = [...w.entries()].sort((a, b) => b[1] - a[1]).slice(0, 4);
  const sum = list.reduce((s, e) => s + e[1], 0) || 1;
  return list.map(([b, v]) => [b, v / sum]);
}

// legge un OBJ (testo) e lo prepara una volta sola
export function registerFigure(name, objText) {
  const group = new OBJLoader().parse(objText);
  const parts = [];
  group.traverse((o) => o.isMesh && parts.push(o));
  const mesh = parts[0];
  if (!mesh) return;
  const g = mesh.geometry;
  const names = [mesh.material].flat().map((m) => m.name);
  const pos = g.attributes.position;
  const si = new Uint16Array(pos.count * 4);
  const sw = new Float32Array(pos.count * 4);
  for (let i = 0; i < pos.count; i++) {
    const ws = weigh(pos.getX(i), pos.getY(i));
    ws.forEach(([b, v], k) => {
      si[i * 4 + k] = b;
      sw[i * 4 + k] = v;
    });
  }
  g.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(si, 4));
  g.setAttribute('skinWeight', new THREE.Float32BufferAttribute(sw, 4));
  if (!g.groups.length) g.addGroup(0, pos.count, 0);
  geometries.set(name, { geometry: g, names });
}

export function hasFigure(name) {
  return geometries.has(name);
}

// mats: { skin, hair, shirt, pants, shoe, dark } — i materiali del Character
export function buildFigure(name, mats) {
  const def = geometries.get(name);
  if (!def) return null;
  const pick = (n) => {
    const k = n.toLowerCase();
    if (k.startsWith('skin')) return mats.skin;
    if (k.startsWith('hair')) return mats.hair;
    if (k.startsWith('shirt') || k.startsWith('details')) return mats.shirt;
    if (k.startsWith('pants')) return mats.pants;
    if (k.startsWith('shoe') || k.startsWith('sock')) return mats.shoe;
    return mats.dark; // occhi, cravatta
  };
  const materials = def.names.map(pick);
  // le ossa: tutte con l'orientamento del mondo, così le rotazioni delle membra valgono uguali
  const bone = (x, y, z, parent) => {
    const b = new THREE.Bone();
    b.position.set(x, y, z);
    parent?.add(b);
    return b;
  };
  const spine = bone(0, J.hip.y, 0);
  const bones = { spine };
  bones.head = bone(0, J.neck.y - J.hip.y, 0, spine);
  for (const [s, sx] of [['L', 1], ['R', -1]]) {
    bones[`leg${s}`] = bone(sx * J.hip.x, 0, 0, spine);
    bones[`shin${s}`] = bone(0, J.knee.y - J.hip.y, 0, bones[`leg${s}`]);
    bones[`arm${s}`] = bone(sx * J.shoulder.x, J.shoulder.y - J.hip.y, 0, spine);
    bones[`fore${s}`] = bone(0, J.elbow.y - J.shoulder.y, 0, bones[`arm${s}`]);
  }
  const list = BONES.map((n) => bones[n]);
  const mesh = new THREE.SkinnedMesh(def.geometry, materials);
  mesh.add(spine);
  mesh.bind(new THREE.Skeleton(list));
  mesh.castShadow = true;
  mesh.frustumCulled = false;
  const root = new THREE.Group();
  root.scale.setScalar(FIGURE_SCALE);
  root.add(mesh);
  return { root, mesh, bones };
}
