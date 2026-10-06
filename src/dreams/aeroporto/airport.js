import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { textTexture, glowTexture } from '../../core/textures.js';

// L'aeroporto, dentro: un atrio altissimo con i banchi del check-in vuoti e il
// tabellone delle partenze, poi un corridoio lunghissimo con la moquette, i
// tapis roulant che vanno da soli, i gate affacciati sulla nebbia.
// Coordinate: x da -30 a 30 nell'atrio (z da 0 a 40), il corridoio da x -10 a 10
// fino a z 240; i gate si aprono a est (x da 10 a 26).
export const HALL_Z = 40;
export const END_Z = 240;
export const GATES = [65, 100, 135, 170, 205]; // centro (z) di ogni gate
// i voli in imbarco: gate -> dove si atterra
export const FLIGHTS = {
  4: { dest: 'Spiaggia Grande', chapter: 'costa', sea: 'Sotto le nuvole c\'è il mare. Azzurro, pieno di puntini: barche, gente.' },
  2: { dest: 'Spiaggia d\'Inverno', chapter: 'spiaggia', sea: 'Sotto le nuvole c\'è il mare. Grigio, calmissimo.' },
};
export const ACTIVE_GATE = 4; // il gate dove aspetta l'addetta
export const BELTS = [
  { x0: -5, x1: -2, z0: 50, z1: 115, dir: 1 },
  { x0: 2, x1: 5, z0: 50, z1: 115, dir: -1 },
  { x0: -5, x1: -2, z0: 125, z1: 190, dir: 1 },
  { x0: 2, x1: 5, z0: 125, z1: 190, dir: -1 },
];

// Il tabellone: partenze verso posti che esistono, e posti che non ancora.
export const DEPARTURES = [
  { time: '13:13', dest: 'SPIAGGIA GRANDE', gate: '4', status: 'IMBARCO', open: true },
  { time: '07:13', dest: 'SPIAGGIA D\'INVERNO', gate: '2', status: 'IMBARCO', open: true },
  { time: '--:--', dest: 'ALTROVE', gate: '—', status: 'IN ATTESA DI UN SOGNO' },
  { time: '--:--', dest: 'CASA', gate: '—', status: 'RITARDO ∞' },
  { time: '00:00', dest: 'IERI', gate: '1', status: 'CANCELLATO' },
  { time: '--:--', dest: 'IL FONDO DEL MARE', gate: '—', status: 'IN ATTESA DI UN SOGNO' },
  { time: '03:33', dest: 'SANT\'ONIRIO', gate: '5', status: 'ATTERRATO' },
  { time: '--:--', dest: 'LA CITTÀ SENZA NOME', gate: '—', status: 'IN ATTESA DI UN SOGNO' },
];

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

// la moquette dei corridoi: quel motivo che hanno tutti gli aeroporti, e nessuno
const carpetTex = () =>
  canvasTex(128, 128, (g, w) => {
    g.fillStyle = '#2a3a5a';
    g.fillRect(0, 0, w, w);
    for (let y = 0; y < w; y += 32)
      for (let x = 0; x < w; x += 32) {
        g.fillStyle = (x + y) % 64 ? '#3a4a6a' : '#22304a';
        g.fillRect(x + 4, y + 4, 24, 24);
        g.fillStyle = '#c8a040';
        g.fillRect(x + 14, y + 14, 4, 4);
        g.fillStyle = '#7a3a4a';
        g.fillRect(x, y + 15, 32, 2);
      }
  }, [8, 80]);

const terrazzoTex = () =>
  canvasTex(256, 256, (g, w) => {
    g.fillStyle = '#d8d2c8';
    g.fillRect(0, 0, w, w);
    for (let i = 0; i < 900; i++) {
      g.fillStyle = ['#a89a8a', '#8a8a92', '#c8b8a0', '#6a6a72'][i % 4];
      g.fillRect(Math.random() * w, Math.random() * w, 2 + Math.random() * 3, 2 + Math.random() * 3);
    }
    g.strokeStyle = 'rgba(120,110,100,0.4)';
    g.strokeRect(0, 0, w, w);
  }, [12, 8]);

const beltTex = () =>
  canvasTex(32, 64, (g) => {
    g.fillStyle = '#2a2a2e';
    g.fillRect(0, 0, 32, 64);
    for (let y = 0; y < 64; y += 6) {
      g.fillStyle = '#4a4a50';
      g.fillRect(0, y, 32, 2);
    }
  }, [1, 20]);

export function buildAirport(scene) {
  const disposables = [];
  const track = (o) => (disposables.push(o), o);
  const staticGroup = new THREE.Group();
  const dyn = new THREE.Group();
  scene.add(dyn);
  const colliders = [];
  const matCache = new Map();
  const mat = (color, o = {}) => {
    const key = color + JSON.stringify(o);
    if (!matCache.has(key)) {
      const { emissive = 0, ...rest } = o;
      matCache.set(key, track(new THREE.MeshStandardMaterial({ color, roughness: 0.7, emissive: emissive ? color : '#000000', emissiveIntensity: emissive, ...rest })));
    }
    return matCache.get(key);
  };
  const boxGeo = track(new THREE.BoxGeometry(1, 1, 1));
  const box = (w, h, d, m, x, y, z, { col = false, low = false, parent = staticGroup } = {}) => {
    const o = new THREE.Mesh(boxGeo, m);
    o.scale.set(w, h, d);
    o.position.set(x, y, z);
    parent.add(o);
    if (col) colliders.push({ minX: x - w / 2, maxX: x + w / 2, minZ: z - d / 2, maxZ: z + d / 2, low });
    return o;
  };
  const plane = (w, h, m, x, y, z, ry, parent = dyn) => {
    const o = new THREE.Mesh(track(new THREE.PlaneGeometry(w, h)), m);
    o.position.set(x, y, z);
    o.rotation.y = ry;
    parent.add(o);
    return o;
  };
  const wall = mat('#e4dfd6');
  const wallDark = mat('#b8b2a8');
  const glass = track(new THREE.MeshStandardMaterial({ color: '#b8ccd8', transparent: true, opacity: 0.25, roughness: 0.05, depthWrite: false }));
  const steel = mat('#9aa0a8', { metalness: 0.6, roughness: 0.3 });
  const panelLight = mat('#fff8ec', { emissive: 1.2 });

  // ---------- Pavimenti e soffitti ----------
  const hallFloor = plane(60, HALL_Z, track(new THREE.MeshStandardMaterial({ map: track(terrazzoTex()), roughness: 0.4 })), 0, 0, HALL_Z / 2, 0, staticGroup);
  hallFloor.rotation.x = -Math.PI / 2;
  const carpet = plane(20, END_Z - HALL_Z, track(new THREE.MeshStandardMaterial({ map: track(carpetTex()), roughness: 1 })), 0, 0.01, (HALL_Z + END_Z) / 2, 0, staticGroup);
  carpet.rotation.x = -Math.PI / 2;
  box(60, 0.4, HALL_Z, wall, 0, 14.2, HALL_Z / 2);
  box(20, 0.3, END_Z - HALL_Z, wall, 0, 5.15, (HALL_Z + END_Z) / 2);
  for (let z = 6; z < HALL_Z; z += 8) for (const x of [-18, 0, 18]) box(10, 0.08, 3, panelLight, x, 13.95, z);
  for (let z = 46; z < END_Z; z += 6) box(3, 0.06, 1.2, panelLight, 0, 4.97, z);

  // ---------- Pareti ----------
  // la facciata con le porte (si esce a sud) e la porta 1313
  for (const s of [-1, 1]) box(26, 14, 0.4, wall, s * 17, 7, -0.2, { col: true });
  box(8, 9, 0.4, wall, 0, 9.5, -0.2);
  box(8, 5, 0.1, glass, 0, 2.5, -0.1);
  const outsideMat = track(new THREE.MeshBasicMaterial({ color: '#c8d0d8' }));
  plane(8.4, 5, outsideMat, 0, 2.5, -0.5, 0);
  for (const s of [-1, 1]) box(20, 14, 0.4, wall, s * 20, 7, HALL_Z, { col: true });
  box(20, 9, 0.4, wall, 0, 9.5, HALL_Z);
  for (const s of [-1, 1]) box(0.4, 14, HALL_Z, wall, s * 30.2, 7, HALL_Z / 2, { col: true });
  // il corridoio: a ovest i negozi chiusi, a est i gate
  box(0.4, 5, END_Z - HALL_Z, wall, -10.2, 2.5, (HALL_Z + END_Z) / 2, { col: true });
  let z = HALL_Z;
  for (const gz of GATES) {
    const a = gz - 12;
    box(0.4, 5, a - z, wall, 10.2, 2.5, (z + a) / 2, { col: true });
    z = gz + 12;
  }
  box(0.4, 5, END_Z - z, wall, 10.2, 2.5, (z + END_Z) / 2, { col: true });
  // il fondo: una vetrata sulla nebbia
  box(20, 5, 0.1, glass, 0, 2.5, END_Z, { col: true });
  plane(22, 6, outsideMat, 0, 2.6, END_Z + 1, Math.PI);

  // ---------- I gate: salotti con le sedie, il banco, la vetrata sugli aerei fermi ----------
  const seatMat = mat('#4a5a7a');
  const seatFrame = mat('#5a5a62', { metalness: 0.5 });
  const gateSigns = [];
  const gates = GATES.map((gz, i) => {
    const n = i + 1;
    for (const s of [-1, 1]) box(16, 5, 0.4, wall, 18, 2.5, gz + s * 12, { col: true });
    box(16, 0.3, 24, wall, 18, 5.15, gz);
    const lf = plane(16, 24, track(new THREE.MeshStandardMaterial({ map: track(carpetTex()), roughness: 1 })), 18, 0.012, gz, 0, staticGroup);
    lf.rotation.x = -Math.PI / 2;
    box(0.1, 5, 24, glass, 26, 2.5, gz, { col: true });
    for (let q = -10; q <= 10; q += 4) box(0.2, 5, 0.2, steel, 26, 2.5, gz + q);
    // file di sedie agganciate
    for (let r = 0; r < 3; r++) {
      const sx = 14 + r * 3;
      for (let k = -4; k <= 4; k++) {
        box(0.6, 0.08, 0.6, seatMat, sx, 0.46, gz - 6 + k * 0.7);
        box(0.08, 0.6, 0.6, seatMat, sx + 0.3, 0.76, gz - 6 + k * 0.7);
      }
      box(0.1, 0.42, 6.4, seatFrame, sx, 0.21, gz - 6);
      colliders.push({ minX: sx - 0.4, maxX: sx + 0.4, minZ: gz - 9.3, maxZ: gz - 2.7, low: true });
    }
    // il banco del gate e il cartello
    box(1, 1.1, 3, mat('#3a4a6a'), 22.5, 0.55, gz + 5, { col: true });
    const signTex = track(textTexture(`GATE ${n}`, { width: 256, height: 96, font: '800 64px Inter, sans-serif', color: '#ffe42a', bg: '#1a2238' }));
    const sm = track(new THREE.MeshStandardMaterial({ map: signTex, emissive: '#ffffff', emissiveMap: signTex, emissiveIntensity: 0.6 }));
    gateSigns.push(plane(2.4, 0.9, sm, 10.05, 4.2, gz, Math.PI / 2));
    plane(2.4, 0.9, sm, 9.95, 4.2, gz, -Math.PI / 2);
    // la porta del finger, chiusa (o aperta, al gate attivo)
    const active = !!FLIGHTS[n];
    box(0.2, 2.6, 2.2, active ? mat('#fff0c8', { emissive: 1 }) : mat('#5a6070'), 25.85, 1.3, gz + 8);
    // l'aereo fermo nella nebbia, oltre la vetrata
    const plane3 = new THREE.Group();
    plane3.position.set(42, 0, gz + 2);
    const body = mat('#e8eaee');
    const fus = new THREE.Mesh(track(new THREE.CylinderGeometry(2.2, 2.2, 30, 16)), body);
    fus.rotation.x = Math.PI / 2;
    fus.position.y = 4.5;
    const nose = new THREE.Mesh(track(new THREE.SphereGeometry(2.2, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2)), body);
    nose.rotation.x = -Math.PI / 2;
    nose.position.set(0, 4.5, -15);
    const wing = new THREE.Mesh(boxGeo, body);
    wing.scale.set(34, 0.4, 5);
    wing.position.set(0, 3.6, 1);
    const fin = new THREE.Mesh(boxGeo, mat(active ? '#c83a3a' : '#2a4a8a'));
    fin.scale.set(0.4, 7, 4);
    fin.position.set(0, 8.5, 13);
    plane3.add(fus, nose, wing, fin);
    dyn.add(plane3);
    return { n, z: gz, desk: new THREE.Vector3(21.3, 0, gz + 5), door: new THREE.Vector3(25, 0, gz + 8), seats: new THREE.Vector3(16.5, 0, gz - 6), active, flight: FLIGHTS[n] };
  });

  // ---------- Il lato ovest: negozi chiusi, pubblicità, il distributore ----------
  const shutter = track(new THREE.MeshStandardMaterial({ map: track(canvasTex(64, 64, (g) => {
    g.fillStyle = '#8a8e94';
    g.fillRect(0, 0, 64, 64);
    for (let y = 0; y < 64; y += 8) {
      g.fillStyle = '#6a6e74';
      g.fillRect(0, y + 6, 64, 2);
    }
  }, [4, 3])), roughness: 0.5, metalness: 0.5 }));
  const shops = ['DUTY FREE', 'PROFUMI', 'CAFFÈ DEL GATE', 'GIORNALI', 'VALIGIE'];
  shops.forEach((name, i) => {
    const sz = 60 + i * 34;
    plane(9, 3.4, shutter, -9.98, 1.7, sz, Math.PI / 2);
    const t = track(textTexture(name, { width: 512, height: 80, font: '700 48px Inter, sans-serif', color: '#e8e4dc', bg: '#3a3a42' }));
    plane(7, 1.1, track(new THREE.MeshStandardMaterial({ map: t, emissive: '#ffffff', emissiveMap: t, emissiveIntensity: 0.15 })), -9.97, 4.1, sz, Math.PI / 2);
  });
  const ads = ['VOLA DOVE NON SEI MAI STATO', 'IL TUO BAGAGLIO TI ASPETTA DA SEMPRE', 'AEROLINEE ONIRICHE · SEMPRE IN ORARIO, PRIMA O POI'];
  ads.forEach((txt, i) => {
    const t = track(textTexture(txt, { width: 1024, height: 128, font: '700 44px Inter, sans-serif', color: '#ffffff', bg: ['#2a5a8a', '#8a3a5a', '#3a7a5a'][i] }));
    plane(7.5, 0.95, track(new THREE.MeshBasicMaterial({ map: t })), -9.97, 2.4, 77 + i * 34, Math.PI / 2);
  });
  // il distributore automatico, l'unica cosa che fa luce da sola
  const vend = new THREE.Vector3(-9.3, 0, 230);
  box(1.2, 2, 0.9, mat('#c83a3a'), vend.x, 1, vend.z, { col: true });
  box(0.05, 1.3, 0.7, mat('#fff4d8', { emissive: 0.9 }), vend.x + 0.62, 1.2, vend.z);

  // ---------- L'atrio: il check-in vuoto e le panchine ----------
  for (const cx of [-18, 0, 18]) {
    box(8, 1.1, 1.2, mat('#5a6a8a'), cx, 0.55, 22, { col: true });
    box(8, 0.3, 1.4, steel, cx, 0.2, 23.4);
    const t = track(textTexture('AEROLINEE ONIRICHE', { width: 512, height: 64, font: '700 36px Inter, sans-serif', color: '#ffffff', bg: '#1a3a6a' }));
    plane(7, 0.9, track(new THREE.MeshStandardMaterial({ map: t, emissive: '#ffffff', emissiveMap: t, emissiveIntensity: 0.4 })), cx, 3.4, 25.5, Math.PI);
    box(8, 3, 0.3, wallDark, cx, 2, 25.8);
  }
  for (const cx of [-20, -8, 8, 20]) {
    for (let k = -3; k <= 3; k++) box(0.6, 0.08, 0.6, seatMat, cx + k * 0.7, 0.46, 10);
    box(4.8, 0.42, 0.12, seatFrame, cx, 0.21, 10);
    colliders.push({ minX: cx - 2.4, maxX: cx + 2.4, minZ: 9.6, maxZ: 10.4, low: true });
  }
  for (const s of [-1, 1]) for (const cz of [12, 30]) box(1, 14, 1, wall, s * 14, 7, cz, { col: true });

  // ---------- Il tabellone delle partenze, sopra l'imbocco del corridoio ----------
  const bc = document.createElement('canvas');
  bc.width = 1024;
  bc.height = 420;
  const boardTex = track(new THREE.CanvasTexture(bc));
  boardTex.colorSpace = THREE.SRGBColorSpace;
  plane(15, 6.15, track(new THREE.MeshBasicMaterial({ map: boardTex })), 0, 9.2, HALL_Z - 0.25, Math.PI);
  const bg = bc.getContext('2d');
  const flip = DEPARTURES.map(() => 0);
  const drawBoard = (t) => {
    bg.fillStyle = '#0a0a0e';
    bg.fillRect(0, 0, 1024, 420);
    bg.font = '800 34px monospace';
    bg.fillStyle = '#ffe42a';
    bg.fillText('PARTENZE · DEPARTURES', 30, 50);
    bg.font = '600 20px monospace';
    bg.fillStyle = '#8a8a92';
    bg.fillText('ORA      DESTINAZIONE               GATE   STATO', 30, 86);
    DEPARTURES.forEach((d, i) => {
      const y = 128 + i * 41;
      bg.fillStyle = i % 2 ? '#121218' : '#16161e';
      bg.fillRect(20, y - 30, 984, 38);
      const scr = flip[i] > 0;
      const rnd = (s) => (scr ? s.replace(/[^ ]/g, () => String.fromCharCode(65 + Math.floor(Math.random() * 26))) : s);
      bg.font = '700 26px monospace';
      bg.fillStyle = '#f4f4f0';
      bg.fillText(rnd(d.time), 30, y);
      bg.fillText(rnd(d.dest), 170, y);
      bg.fillText(rnd(d.gate), 610, y);
      bg.fillStyle = d.open ? (Math.floor(t * 2) % 2 ? '#4aff8a' : '#2a8a4a') : d.status.startsWith('IN ATTESA') ? '#7a7a8a' : '#ff8a5a';
      bg.fillText(rnd(d.status), 700, y);
    });
    boardTex.needsUpdate = true;
  };

  // ---------- I tapis roulant ----------
  const belts = track(beltTex());
  const beltMat = track(new THREE.MeshStandardMaterial({ map: belts, roughness: 0.6 }));
  for (const b of BELTS) {
    const w = b.x1 - b.x0;
    const L = b.z1 - b.z0;
    const cx = (b.x0 + b.x1) / 2;
    const m = box(w, 0.12, L, beltMat, cx, 0.06, (b.z0 + b.z1) / 2, { parent: dyn });
    m.userData.dir = b.dir;
    for (const sx of [b.x0, b.x1]) {
      box(0.15, 0.9, L, glass, sx, 0.55, (b.z0 + b.z1) / 2);
      box(0.18, 0.08, L, mat('#1a1a1e'), sx, 1.02, (b.z0 + b.z1) / 2);
      colliders.push({ minX: sx - 0.1, maxX: sx + 0.1, minZ: b.z0, maxZ: b.z1, low: true });
    }
  }

  // ---------- La porta 1313: una porta di servizio, a sinistra delle porte d'ingresso ----------
  box(1.9, 2.8, 0.2, mat('#3a2416'), -20, 1.4, 0.1);
  box(1.3, 2.45, 0.12, mat('#2f5a3a'), -20, 1.225, 0.22);
  const numTex = track(textTexture('1313', { width: 128, height: 48, font: '700 34px Cormorant Garamond, serif', color: '#2a1a0a', bg: '#d8b860' }));
  plane(0.4, 0.13, track(new THREE.MeshBasicMaterial({ map: numTex })), -20, 1.85, 0.29, 0);
  const glow = track(glowTexture('rgba(255,255,255,1)'));
  const door13Glow = new THREE.Sprite(track(new THREE.SpriteMaterial({ map: glow, color: '#ffd890', blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0.8 })));
  door13Glow.position.set(-20, 0.15, 0.6);
  door13Glow.scale.set(2.2, 0.8, 1);
  dyn.add(door13Glow);

  // ---------- Unione della geometria statica ----------
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
    merged.add(new THREE.Mesh(g, m));
  }
  scene.add(merged);

  let boardT = 0;
  let flipT = 2;
  return {
    colliders,
    gates,
    vending: vend,
    board: new THREE.Vector3(0, 0, HALL_Z - 6),
    door13: { spot: new THREE.Vector3(-20, 0, 1.5) },
    setDay(day) {
      outsideMat.color.set(day ? '#d4dae0' : '#1a2234');
    },
    update(t, dt) {
      belts.offset.y = (belts.offset.y - dt * 0.6) % 1;
      boardT -= dt;
      flipT -= dt;
      // ogni tanto una riga del tabellone si rimescola, come le palette che girano
      if (flipT <= 0) {
        flipT = 3 + Math.random() * 4;
        flip[Math.floor(Math.random() * flip.length)] = 0.6;
      }
      for (let i = 0; i < flip.length; i++) flip[i] = Math.max(0, flip[i] - dt);
      if (boardT <= 0) {
        boardT = 0.08;
        drawBoard(t);
      }
      door13Glow.material.opacity = 0.65 + Math.sin(t * 1.5) * 0.15;
    },
    dispose() {
      disposables.forEach((d) => d.dispose());
      merged.removeFromParent();
      dyn.removeFromParent();
    },
  };
}

// La cabina dell'aereo, per il volo: costruita lontano, fuori dall'aeroporto.
export function buildCabin(scene, origin) {
  const disposables = [];
  const track = (o) => (disposables.push(o), o);
  const g = new THREE.Group();
  g.position.copy(origin);
  scene.add(g);
  const tube = new THREE.Mesh(track(new THREE.CylinderGeometry(2.1, 2.1, 20, 24, 1, true)), track(new THREE.MeshStandardMaterial({ color: '#e8e4dc', side: THREE.BackSide, roughness: 0.8 })));
  tube.rotation.x = Math.PI / 2;
  tube.position.y = 1.4;
  g.add(tube);
  const floor = new THREE.Mesh(track(new THREE.PlaneGeometry(3.6, 20)), track(new THREE.MeshStandardMaterial({ color: '#3a4a6a' })));
  floor.rotation.x = -Math.PI / 2;
  g.add(floor);
  const seat = track(new THREE.MeshStandardMaterial({ color: '#2a3a6a' }));
  const bg = track(new THREE.BoxGeometry(1, 1, 1));
  for (let r = -4; r <= 4; r++)
    for (const x of [-1.2, -0.6, 0.6, 1.2]) {
      const s = new THREE.Mesh(bg, seat);
      s.scale.set(0.5, 0.5, 0.5);
      s.position.set(x, 0.45, r * 1.6);
      const b = new THREE.Mesh(bg, seat);
      b.scale.set(0.5, 0.8, 0.12);
      b.position.set(x, 0.95, r * 1.6 + 0.28);
      g.add(s, b);
    }
  // gli oblò: il cielo che scorre, nuvole dall'alto
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 128;
  const cg = c.getContext('2d');
  const sky = cg.createLinearGradient(0, 0, 0, 128);
  sky.addColorStop(0, '#5a7ab8');
  sky.addColorStop(1, '#e8d8c8');
  cg.fillStyle = sky;
  cg.fillRect(0, 0, 256, 128);
  for (let i = 0; i < 40; i++) {
    cg.fillStyle = `rgba(255,255,255,${0.4 + Math.random() * 0.5})`;
    cg.beginPath();
    cg.ellipse(Math.random() * 256, 70 + Math.random() * 58, 10 + Math.random() * 30, 4 + Math.random() * 8, 0, 0, Math.PI * 2);
    cg.fill();
  }
  const cloud = track(new THREE.CanvasTexture(c));
  cloud.colorSpace = THREE.SRGBColorSpace;
  cloud.wrapS = THREE.RepeatWrapping;
  const winMat = track(new THREE.MeshBasicMaterial({ map: cloud }));
  for (let r = -4; r <= 4; r++) {
    const w = new THREE.Mesh(track(new THREE.CircleGeometry(0.22, 16)), winMat);
    w.scale.set(1, 1.4, 1);
    w.position.set(-1.9, 1.35, r * 1.6);
    w.rotation.y = Math.PI / 2;
    g.add(w);
  }
  const light = new THREE.PointLight('#fff4e0', 6, 14, 1.5);
  light.position.set(0, 2.6, 0);
  g.add(light);
  return {
    seat: new THREE.Vector3(origin.x - 1.2, origin.y, origin.z),
    seat2: new THREE.Vector3(origin.x - 0.6, origin.y, origin.z),
    cam: new THREE.Vector3(origin.x + 0.4, origin.y + 1.5, origin.z + 2.2),
    look: new THREE.Vector3(origin.x - 1.9, origin.y + 1.3, origin.z - 0.4),
    update(t, dt) {
      cloud.offset.x = (cloud.offset.x + dt * 0.25) % 1;
      g.rotation.z = Math.sin(t * 1.7) * 0.012 + (Math.random() < 0.01 ? 0.02 : 0);
    },
    dispose() {
      disposables.forEach((d) => d.dispose());
      g.removeFromParent();
    },
  };
}
