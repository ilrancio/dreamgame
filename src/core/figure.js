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

// armSide: 'L'/'R' se il vertice sta su un braccio (deciso dai collegamenti
// del modello, vedi armParts), null se no
function weigh(x, y, armSide) {
  const w = new Map();
  const add = (bn, v) => v > 1e-3 && w.set(bn, (w.get(bn) || 0) + v);
  const side = x >= 0 ? 'L' : 'R';
  const ax = Math.abs(x);
  // le braccia: sotto la spalla sono pezzi a sé; sopra, la spalla sfuma nel busto
  let arm = 0;
  if (y < ARM_CUT) arm = armSide ? 1 : 0;
  else arm = smooth(0.38, 0.46, ax) * (1 - smooth(3.5, 3.8, y));
  const aSide = armSide || side;
  // le gambe: sotto le anche
  const leg = (1 - arm) * (1 - smooth(1.85, 2.2, y));
  const head = (1 - arm) * smooth(3.86, 4.02, y);
  const spine = Math.max(0, 1 - arm - leg - head);
  if (arm) {
    const fore = 1 - smooth(2.55, 2.8, y);
    add(B[`arm${aSide}`], arm * (1 - fore));
    add(B[`fore${aSide}`], arm * fore);
  }
  if (leg) {
    const shin = 1 - smooth(0.95, 1.15, y);
    add(B[`leg${side}`], leg * (1 - shin));
    add(B[`shin${side}`], leg * shin);
  }
  add(B.head, head);
  add(B.spine, spine);
  const list = [...w.entries()].sort((p, q) => q[1] - p[1]).slice(0, 4);
  const sum = list.reduce((t, e) => t + e[1], 0) || 1;
  return list.map(([bn, v]) => [bn, v / sum]);
}

// Sotto la spalla le braccia non toccano il busto: tagliando il modello a
// quell'altezza restano tre pezzi (busto con le gambe, braccio sinistro,
// braccio destro). Così una mano vicina al fianco non si confonde col fianco.
const ARM_CUT = 3.45;
function armParts(pos) {
  const n = pos.count;
  const key = new Map();
  const rep = new Int32Array(n);
  for (let i = 0; i < n; i++) {
    const k = `${pos.getX(i).toFixed(4)},${pos.getY(i).toFixed(4)},${pos.getZ(i).toFixed(4)}`;
    if (!key.has(k)) key.set(k, i);
    rep[i] = key.get(k);
  }
  const par = Int32Array.from({ length: n }, (_, i) => i);
  const find = (a) => {
    while (par[a] !== a) a = par[a] = par[par[a]];
    return a;
  };
  for (let t = 0; t + 2 < n; t += 3) {
    const vs = [rep[t], rep[t + 1], rep[t + 2]].filter((v) => pos.getY(v) < ARM_CUT);
    for (let k = 1; k < vs.length; k++) par[find(vs[k])] = find(vs[0]);
  }
  const comps = new Map();
  for (let i = 0; i < n; i++) {
    if (pos.getY(rep[i]) >= ARM_CUT) continue;
    const r = find(rep[i]);
    if (!comps.has(r)) comps.set(r, { n: 0, sx: 0 });
    const c = comps.get(r);
    c.n++;
    c.sx += pos.getX(i);
  }
  // il pezzo più grande è il busto; gli altri, a destra o sinistra, sono braccia
  const sorted = [...comps.entries()].sort((p, q) => q[1].n - p[1].n);
  const torso = sorted[0]?.[0];
  const side = new Array(n).fill(null);
  for (let i = 0; i < n; i++) {
    if (pos.getY(rep[i]) >= ARM_CUT) continue;
    const r = find(rep[i]);
    if (r === torso) continue;
    const c = comps.get(r);
    side[i] = c.sx / c.n >= 0 ? 'L' : 'R';
  }
  return side;
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
  const arms = armParts(pos);
  for (let i = 0; i < pos.count; i++) {
    const ws = weigh(pos.getX(i), pos.getY(i), arms[i]);
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
