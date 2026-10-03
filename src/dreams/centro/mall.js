import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { mulberry32 } from '../../core/noise.js';
import { textTexture, glowTexture } from '../../core/textures.js';

// Il Centro Commerciale Orizzonte, dentro: una galleria lunga 160 m su due
// piani. Al centro il vuoto a tutta altezza con i parapetti di vetro, tre
// passerelle che lo attraversano, due scale mobili, il lucernario. Ai lati,
// 48 negozi: pochi aperti, con il commesso dietro al banco. Nessun cliente.
//
// Coordinate: x da -20 a 20, z da 0 (ingresso) a 160. Piano terra a y = 0,
// primo piano a y = 6, tetto a 14.
export const MALL_W = 20;
export const MALL_L = 160;
export const UPPER = 6;
export const ROOF = 14;
const SHOP_X = 12; // vetrine dei negozi
const VOID_X = 7; // bordo del vuoto centrale
const SHOP_L = 12.5;
const SHOP_Z0 = 6;
export const BRIDGES = [40, 80, 120]; // passerelle: z da b a b + 4
export const RAMPS = [
  { z0: 24, z1: 40 },
  { z0: 104, z1: 120 },
]; // scale mobili, x da -3 a 3, salgono verso la passerella
const END_SLAB = 152; // il fondo del primo piano, da parete a parete
export const DOOR_W = 4.5; // metà larghezza delle porte d'ingresso
export const RETRO = { side: 1, floor: 0, k: 3 };

const SHOP_NAMES = [
  'Libreria Notturna', 'Scarpe Leggere', 'Profumeria Nuvola', 'Ottica Lontano', 'Gelateria Polare', 'Orologi Fermi',
  'Cappelli & Ombrelli', 'Tè e Tazze', 'Dischi Lunari', 'Giocattoli Giganti', 'Fiori di Carta', 'Elettronica 1999',
  'Valigie per Sempre', 'Lampade Sognanti', 'Pigiami', 'Calzini Spaiati', 'Mappe Sbagliate', 'Specchi',
  'Cuscini', 'Biglietti di Auguri', 'Tende da Sole', 'Bottoni', 'Cartoleria', 'Vasi', 'Candele', 'Pane & Nuvole',
  'Ferramenta', 'Palloncini', 'Telescopi', 'Orsetti', 'Piante Grasse', 'Sciarpe', 'Puzzle', 'Ombre Cinesi',
];

// Chi lavora nei negozi aperti, e cosa ti dice.
const CLERK_LINES = {
  'Libreria Notturna': ['I libri qui finiscono tutti a metà. Come i sogni.', 'Si legge meglio quando non c\'è nessuno, no?'],
  'Gelateria Polare': ['Gusti di oggi: nuvola, tè freddo, e "quello che ti ricordi da bambino".', 'Il gelato è gratis. Non è mai venuto nessuno a pagarlo.'],
  'Orologi Fermi': ['Segnano tutti un\'ora diversa. Sono tutti giusti.', 'Non ho fretta di vendere. Non ne ho mai avuta.'],
  'Dischi Lunari': ['Questo vinile suona solo se nessuno ascolta.', 'Il centro commerciale ha la sua musica. La senti? È sempre la stessa.'],
  'Giocattoli Giganti': ['Il peluche più grande è al primo piano. Non entra nella vetrina.', 'Un tempo qui c\'era la fila. Credo.'],
  'Fiori di Carta': ['Non appassiscono. Non profumano, però.', 'Prendine uno per la suite. Ah, non hai soldi? Nemmeno io.'],
  'Elettronica 1999': ['Tutto funziona, ma nulla è collegato a niente.', 'Il futuro era bellissimo, nel 1999.'],
  'Pane & Nuvole': ['Il pane è appena sfornato. Lo è sempre.', 'Siete i primi clienti da... non mi ricordo.'],
  'Telescopi': ['Da qui dentro non si vedono le stelle. Però si può sperare.', 'Il lucernario fa da cielo. Mi accontento.'],
  'Puzzle': ['Manca sempre un pezzo. È lì il bello.', 'Siamo aperti. Lo siamo sempre.'],
};
const GENERIC_LINES = [
  ['Siamo aperti. Lo siamo sempre.', 'Guardate pure. Non c\'è nessuno da servire, a parte voi.'],
  ['Buongiorno! O buonasera. Qui dentro non si capisce mai.', 'Il centro è grande, vero? Io non l\'ho mai girato tutto.'],
  ['Siete i primi clienti da... non mi ricordo.', 'Se cercate qualcosa, ce l\'abbiamo. Credo.'],
  ['Ogni tanto passa la musica dell\'altoparlante. È l\'unica che parla più di me.', 'Tornate quando volete. Il negozio sarà uguale.'],
];
const MAX_CLERKS = 16;
const PALETTES = ['#d84a5a', '#4a8ad8', '#e8b83a', '#5ab87a', '#9a5ad8', '#e87a3a', '#3ac8c8', '#c84a9a'];

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

// pavimento di marmo bianco con i bollini grigi, come nella foto del sogno
const floorTex = () =>
  canvasTex(256, 256, (g, w) => {
    g.fillStyle = '#ece8e2';
    g.fillRect(0, 0, w, w);
    for (let i = 0; i < 500; i++) {
      g.fillStyle = `rgba(150,140,130,${Math.random() * 0.05})`;
      g.fillRect(Math.random() * w, Math.random() * w, 6, 2);
    }
    g.strokeStyle = 'rgba(160,150,140,0.35)';
    g.lineWidth = 2;
    g.strokeRect(0, 0, w, w);
    g.fillStyle = '#9a948c';
    for (const [x, y] of [[64, 64], [192, 192]]) {
      g.beginPath();
      g.arc(x, y, 9, 0, Math.PI * 2);
      g.fill();
    }
  }, [10, 40]);

const shutterTex = () =>
  canvasTex(64, 64, (g, w) => {
    g.fillStyle = '#8a8e94';
    g.fillRect(0, 0, w, w);
    for (let y = 0; y < w; y += 8) {
      g.fillStyle = '#6a6e74';
      g.fillRect(0, y + 6, w, 2);
      g.fillStyle = '#a8acb2';
      g.fillRect(0, y, w, 1);
    }
  }, [3, 4]);

const stepsTex = () =>
  canvasTex(64, 64, (g, w) => {
    g.fillStyle = '#3a3c40';
    g.fillRect(0, 0, w, w);
    for (let y = 0; y < w; y += 8) {
      g.fillStyle = '#5a5c62';
      g.fillRect(0, y, w, 3);
    }
    g.fillStyle = '#e8c83a';
    g.fillRect(0, 0, 3, w);
    g.fillRect(w - 3, 0, 3, w);
  }, [1, 10]);

const posterTex = (seed) =>
  canvasTex(64, 96, (g) => {
    const r = mulberry32(seed);
    g.fillStyle = ['#1a0a3a', '#0a2a1a', '#3a0a1a'][seed % 3];
    g.fillRect(0, 0, 64, 96);
    for (let i = 0; i < 40; i++) {
      g.fillStyle = PALETTES[Math.floor(r() * PALETTES.length)];
      g.fillRect(Math.floor(r() * 16) * 4, 20 + Math.floor(r() * 14) * 4, 4, 4);
    }
    g.fillStyle = '#ffe42a';
    g.font = 'bold 10px monospace';
    g.fillText(['SUPER GNOMO', 'TÈ FIGHTER', 'HOTEL 1313', 'PIXEL LUNA'][seed % 4], 4, 12);
  });

export function buildMallInterior(scene, { day }) {
  const rand = mulberry32(2024);
  const disposables = [];
  const track = (o) => (disposables.push(o), o);
  const staticGroup = new THREE.Group();
  const dyn = new THREE.Group();
  scene.add(dyn);
  const colliders = []; // { minX, maxX, minZ, maxZ, lv } lv: 0 terra, 1 sopra, 2 entrambi
  const matCache = new Map();
  const mat = (color, o = {}) => {
    const key = color + JSON.stringify(o);
    if (!matCache.has(key)) {
      const { emissive = 0, ...rest } = o;
      matCache.set(key, track(new THREE.MeshStandardMaterial({ color, roughness: 0.6, emissive: emissive ? color : '#000000', emissiveIntensity: emissive, ...rest })));
    }
    return matCache.get(key);
  };
  const boxGeo = track(new THREE.BoxGeometry(1, 1, 1));
  const box = (w, h, d, m, x, y, z, { lv = null, rotX = 0, rotY = 0, parent = staticGroup } = {}) => {
    const o = new THREE.Mesh(boxGeo, m);
    o.scale.set(w, h, d);
    o.position.set(x, y, z);
    o.rotation.set(rotX, rotY, 0);
    parent.add(o);
    if (lv !== null) colliders.push({ minX: x - w / 2, maxX: x + w / 2, minZ: z - d / 2, maxZ: z + d / 2, lv });
    return o;
  };
  const mesh = (geo, m, x, y, z, parent = staticGroup) => {
    const o = new THREE.Mesh(track(geo), m);
    o.position.set(x, y, z);
    parent.add(o);
    return o;
  };
  const collider = (minX, maxX, minZ, maxZ, lv) => colliders.push({ minX, maxX, minZ, maxZ, lv });

  const white = mat('#f2f0ec');
  const fascia = mat('#e4e0d8');
  const chrome = mat('#c8ccd2', { metalness: 0.8, roughness: 0.25 });
  const glass = track(new THREE.MeshStandardMaterial({ color: '#cfe6ee', transparent: true, opacity: 0.22, roughness: 0.05, metalness: 0.2, depthWrite: false }));
  const dark = mat('#2a2a2e');

  // ---------- Pavimento, tetto, lucernario ----------
  const floor = mesh(new THREE.PlaneGeometry(MALL_W * 2, MALL_L), track(new THREE.MeshStandardMaterial({ map: track(floorTex()), roughness: 0.35 })), 0, 0, MALL_L / 2);
  floor.rotation.x = -Math.PI / 2;
  box(MALL_W * 2, 0.4, MALL_L, white, 0, ROOF + 0.2, MALL_L / 2);
  const skyMat = track(new THREE.MeshBasicMaterial({ color: day ? '#e8f4ff' : '#101a3a' }));
  box(VOID_X * 2 - 1, 0.1, MALL_L - 4, skyMat, 0, ROOF - 0.02, MALL_L / 2, { parent: dyn });
  for (let z = 2; z < MALL_L; z += 4) box(VOID_X * 2, 0.3, 0.25, white, 0, ROOF - 0.2, z);
  box(0.3, 0.3, MALL_L, white, 0, ROOF - 0.2, MALL_L / 2);

  // ---------- Pareti esterne ----------
  for (const s of [-1, 1]) box(0.4, ROOF, MALL_L, white, s * (MALL_W + 0.2), ROOF / 2, MALL_L / 2, { lv: 2 });
  box(MALL_W * 2, ROOF, 0.4, white, 0, ROOF / 2, MALL_L + 0.2, { lv: 2 });
  // la facciata d'ingresso: vetro a tutta altezza al centro, porte che danno sul fuori
  for (const s of [-1, 1]) box(MALL_W - 9, ROOF, 0.4, white, s * (9 + (MALL_W - 9) / 2), ROOF / 2, -0.2, { lv: 2 });
  box(18, 2, 0.4, white, 0, ROOF - 1, -0.2);
  for (const s of [-1, 1]) box(9 - DOOR_W, 12, 0.1, glass, s * (DOOR_W + (9 - DOOR_W) / 2), 6, -0.05, { lv: 2 });
  box(DOOR_W * 2, 7.6, 0.1, glass, 0, 8.2, -0.05);
  const outsideMat = track(new THREE.MeshBasicMaterial({ color: day ? '#f4f8ff' : '#141c38' }));
  box(DOOR_W * 2 + 0.2, 4.4, 0.05, outsideMat, 0, 2.2, -0.35, { parent: dyn });
  for (const s of [-1, 1]) box(0.15, 4.4, 0.2, chrome, s * DOOR_W, 2.2, -0.1);
  // fuori dalle porte la luce del giorno (o della notte)
  const glow = track(glowTexture('rgba(255,255,255,1)'));
  const doorGlow = new THREE.Sprite(track(new THREE.SpriteMaterial({ map: glow, color: day ? '#fff6e0' : '#6a7ab0', blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0.5 })));
  doorGlow.position.set(0, 2.5, 0.6);
  doorGlow.scale.set(12, 7, 1);
  dyn.add(doorGlow);

  // ---------- Il primo piano: ballatoi, passerelle, il fondo ----------
  for (const s of [-1, 1]) {
    box(MALL_W - VOID_X, 0.4, MALL_L, white, s * (VOID_X + (MALL_W - VOID_X) / 2), UPPER - 0.2, MALL_L / 2);
    box(0.3, 1.1, MALL_L, fascia, s * (VOID_X + 0.15), UPPER - 0.55, MALL_L / 2);
  }
  for (const b of BRIDGES) {
    box(VOID_X * 2, 0.4, 4, white, 0, UPPER - 0.2, b + 2);
    for (const e of [b, b + 4]) box(VOID_X * 2, 1.1, 0.3, fascia, 0, UPPER - 0.55, e);
  }
  box(VOID_X * 2, 0.4, MALL_L - END_SLAB, white, 0, UPPER - 0.2, (END_SLAB + MALL_L) / 2);
  box(VOID_X * 2, 1.1, 0.3, fascia, 0, UPPER - 0.55, END_SLAB);

  // parapetti di vetro (e corrimano): lungo il vuoto, i bordi delle passerelle, il fondo
  const rail = (x0, x1, z0, z1) => {
    const len = Math.hypot(x1 - x0, z1 - z0);
    if (len < 0.2) return;
    const along = Math.abs(z1 - z0) > Math.abs(x1 - x0);
    const cx = (x0 + x1) / 2;
    const cz = (z0 + z1) / 2;
    box(along ? 0.05 : len, 1.05, along ? len : 0.05, glass, cx, UPPER + 0.53, cz);
    box(along ? 0.09 : len, 0.07, along ? len : 0.09, chrome, cx, UPPER + 1.08, cz);
    collider(Math.min(x0, x1) - 0.12, Math.max(x0, x1) + 0.12, Math.min(z0, z1) - 0.12, Math.max(z0, z1) + 0.12, 1);
  };
  const cuts = [...BRIDGES.map((b) => [b, b + 4]), [END_SLAB, MALL_L]];
  for (const s of [-1, 1]) {
    let z = 0;
    for (const [a, b] of cuts) {
      rail(s * VOID_X, s * VOID_X, z, a);
      z = b;
    }
  }
  for (const b of BRIDGES) {
    const ramp = RAMPS.find((r) => r.z1 === b);
    // il lato sud della passerella è aperto dove arriva la scala mobile
    if (ramp) {
      rail(-VOID_X, -3.1, b, b);
      rail(3.1, VOID_X, b, b);
    } else rail(-VOID_X, VOID_X, b, b);
    rail(-VOID_X, VOID_X, b + 4, b + 4);
  }
  rail(-VOID_X, VOID_X, END_SLAB, END_SLAB);

  // colonne bianche dal pavimento al tetto
  for (const s of [-1, 1]) {
    for (let z = 10; z < MALL_L; z += 20) {
      mesh(new THREE.CylinderGeometry(0.42, 0.42, ROOF, 16), white, s * (VOID_X + 0.55), ROOF / 2, z);
      collider(s * (VOID_X + 0.55) - 0.45, s * (VOID_X + 0.55) + 0.45, z - 0.45, z + 0.45, 2);
    }
  }

  // ---------- Le scale mobili ----------
  const steps = track(stepsTex());
  const stepMat = track(new THREE.MeshStandardMaterial({ map: steps, roughness: 0.5, metalness: 0.4 }));
  for (const r of RAMPS) {
    const L = r.z1 - r.z0;
    const ang = Math.atan2(UPPER, L);
    const len = Math.hypot(UPPER, L);
    const cz = (r.z0 + r.z1) / 2;
    box(6, 0.3, len, stepMat, 0, UPPER / 2 - 0.15, cz, { rotX: -ang, parent: dyn });
    for (const s of [-1, 1]) {
      box(0.12, 1.1, len, glass, s * 3.1, UPPER / 2 + 0.5, cz, { rotX: -ang });
      box(0.12, 0.1, len, dark, s * 3.1, UPPER / 2 + 1.05, cz, { rotX: -ang });
      box(0.3, 0.9, len, mat('#b8bcc2', { metalness: 0.6 }), s * 3.1, UPPER / 2 - 0.4, cz, { rotX: -ang });
      collider(s * 3.1 - 0.15, s * 3.1 + 0.15, r.z0 - 0.4, r.z1, 2);
    }
    box(0.12, 0.9, len, mat('#b8bcc2', { metalness: 0.6 }), 0, UPPER / 2 - 0.4, cz, { rotX: -ang });
  }

  // ---------- I negozi ----------
  const shops = [];
  const shutter = track(new THREE.MeshStandardMaterial({ map: track(shutterTex()), roughness: 0.5, metalness: 0.5 }));
  const signs = [];
  let nameIdx = 0;
  for (const floorN of [0, 1]) {
    const y0 = floorN * UPPER;
    for (const s of [-1, 1]) {
      for (let k = 0; k < 12; k++) {
        const zA = SHOP_Z0 + k * SHOP_L;
        const zB = zA + SHOP_L;
        const zm = (zA + zB) / 2;
        const retro = s === RETRO.side && floorN === RETRO.floor && k === RETRO.k;
        const name = retro ? 'Retrogiochi' : SHOP_NAMES[nameIdx++ % SHOP_NAMES.length];
        // quasi tutti aperti e illuminati, ma senza clienti: solo chi ci lavora
        const isOpen = retro || rand() < 0.68;
        const lv = floorN;
        const fx = s * SHOP_X;
        const backX = s * MALL_W;
        const color = PALETTES[(k * 3 + floorN * 5 + (s > 0 ? 1 : 0)) % PALETTES.length];
        // pareti divisorie
        box(MALL_W - SHOP_X, 5.6, 0.3, white, s * (SHOP_X + (MALL_W - SHOP_X) / 2), y0 + 2.8, zA, { lv });
        if (k === 11) box(MALL_W - SHOP_X, 5.6, 0.3, white, s * (SHOP_X + (MALL_W - SHOP_X) / 2), y0 + 2.8, zB, { lv });
        // la fascia sopra la vetrina con l'insegna
        box(0.3, 1.2, SHOP_L, white, fx, y0 + 5, zm);
        const shop = { name, side: s, floor: floorN, k, zA, zB, zm, open: isOpen, retro, front: fx, color };
        shops.push(shop);
        const signTex = track(textTexture(name, { width: 512, height: 72, font: `600 ${name.length > 16 ? 38 : 46}px Inter, sans-serif`, color: isOpen ? '#ffffff' : '#d8d4cc', bg: isOpen ? (retro ? '#2a0a3a' : color) : '#6a6866' }));
        const sm = track(new THREE.MeshStandardMaterial({ map: signTex, emissive: '#ffffff', emissiveMap: signTex, emissiveIntensity: isOpen ? 0.55 : 0.05 }));
        const sign = mesh(new THREE.PlaneGeometry(6, 0.85), sm, fx - s * 0.17, y0 + 5, zm, dyn);
        sign.rotation.y = -s * Math.PI / 2;
        signs.push(sign);
        if (!isOpen) {
          // serranda abbassata
          box(0.12, 4.4, SHOP_L - 0.3, shutter, fx, y0 + 2.2, zm, { lv });
          continue;
        }
        // vetrina con la porta aperta al centro
        for (const [a, b] of [[zA + 0.15, zm - 2], [zm + 2, zB - 0.15]]) {
          box(0.08, 4.4, b - a, glass, fx, y0 + 2.2, (a + b) / 2, { lv });
          box(0.14, 4.4, 0.12, chrome, fx, y0 + 2.2, b);
        }
        // dentro: pareta di fondo colorata, soffitto luminoso, scaffali, banco
        if (!retro) box(0.1, 5.4, SHOP_L - 0.3, mat(color, { emissive: 0.12 }), backX - s * 0.25, y0 + 2.7, zm);
        box(MALL_W - SHOP_X - 0.6, 0.06, SHOP_L - 1, mat('#fff8e8', { emissive: 1.1 }), s * (SHOP_X + (MALL_W - SHOP_X) / 2), y0 + 5.5, zm);
        if (retro) continue;
        box(MALL_W - SHOP_X - 0.4, 0.02, SHOP_L - 0.4, mat(floorN ? '#d8d0c4' : '#cfc6b8'), s * (SHOP_X + (MALL_W - SHOP_X) / 2), y0 + 0.02, zm);
        for (const dz of [-3.6, 3.6]) {
          const sx = s * (SHOP_X + 3.6);
          box(2.8, 1.6, 0.6, mat('#e8e4dc'), sx, y0 + 0.8, zm + dz, { lv });
          for (let q = 0; q < 6; q++) box(0.35, 0.3 + rand() * 0.3, 0.35, mat(PALETTES[Math.floor(rand() * PALETTES.length)]), sx - 1.1 + q * 0.44, y0 + 1.75, zm + dz);
        }
        for (let q = 0; q < 3; q++) box(0.5, 0.06, SHOP_L - 2, mat('#e8e4dc'), backX - s * 0.6, y0 + 1 + q * 0.9, zm);
        for (let q = 0; q < 14; q++) box(0.3, 0.32, 0.4, mat(PALETTES[Math.floor(rand() * PALETTES.length)]), backX - s * 0.6, y0 + 1.2 + Math.floor(q / 5) * 0.9, zA + 1.5 + (q % 5) * 2.2);
        box(1, 1.05, 3, mat('#3a3a40'), backX - s * 2.4, y0 + 0.53, zm, { lv });
        if (shops.filter((q) => q.clerk).length < MAX_CLERKS && (CLERK_LINES[name] || rand() < 0.45)) {
          shop.clerk = { x: backX - s * 1.4, y: y0, z: zm, facing: -s * Math.PI / 2, lines: CLERK_LINES[name] || GENERIC_LINES[Math.floor(rand() * GENERIC_LINES.length)] };
        }
      }
    }
  }
  // le fasce bianche sopra i negozi del primo piano, fino al tetto
  for (const s of [-1, 1]) box(0.3, ROOF - 11.6, MALL_L, white, s * SHOP_X, (11.6 + ROOF) / 2, MALL_L / 2);
  // soffitto dei negozi di sopra
  for (const s of [-1, 1]) box(MALL_W - SHOP_X, 0.4, MALL_L, white, s * (SHOP_X + (MALL_W - SHOP_X) / 2), 11.8, MALL_L / 2);
  // luci a incasso sotto i ballatoi
  const spotMat = mat('#fffaf0', { emissive: 1.4 });
  for (const s of [-1, 1]) for (let z = 4; z < MALL_L; z += 6) mesh(new THREE.CircleGeometry(0.25, 12), spotMat, s * 9.5, UPPER - 0.41, z).rotation.x = Math.PI / 2;

  // ---------- Piante, fioriere, il chiosco, le panchine ----------
  const leaves = mat('#3a7a3a');
  const trunk = mat('#6a4a2a');
  for (const z of [62, 100]) {
    mesh(new THREE.CylinderGeometry(3, 3.2, 0.7, 24), white, 0, 0.35, z);
    mesh(new THREE.CylinderGeometry(2.8, 2.8, 0.05, 24), mat('#4a3a2a'), 0, 0.71, z);
    collider(-3, 3, z - 3, z + 3, 0);
    for (const [dx, dz, h] of [[-1, -0.6, 4.5], [1.1, 0.5, 5.5], [0, 1.2, 3.8]]) {
      mesh(new THREE.CylinderGeometry(0.12, 0.18, h, 8), trunk, dx, h / 2 + 0.7, z + dz);
      mesh(new THREE.IcosahedronGeometry(1.3, 1), leaves, dx, h + 0.9, z + dz);
    }
  }
  // il chiosco (chiuso, con il telo)
  box(2.4, 1, 1.4, mat('#e8dcc8'), 4.2, 0.5, 72, { lv: 0 });
  box(2.8, 0.1, 1.8, mat('#c84a5a'), 4.2, 2.3, 72);
  for (const dx of [-1.2, 1.2]) box(0.06, 1.3, 0.06, chrome, 4.2 + dx, 1.65, 72);
  box(2.2, 0.6, 1.2, mat('#7a9ab8'), 4.2, 1.3, 72);
  // panchine lungo il vuoto
  for (const z of [16, 50, 90, 136]) for (const s of [-1, 1]) box(2.2, 0.45, 0.6, mat('#8a6a4a'), s * 4.5, 0.23, z, { lv: 0 });
  // il fondo della galleria: un grande oblò sul cielo, con il nome del centro
  const moonMat = track(new THREE.MeshBasicMaterial({ color: day ? '#bfe0ff' : '#1c2a5a' }));
  const moon = mesh(new THREE.CircleGeometry(6, 48), moonMat, 0, 8.5, MALL_L - 0.05, dyn);
  moon.rotation.y = Math.PI;
  const logoTex = track(textTexture('ORIZZONTE', { width: 512, height: 96, font: '800 72px Inter, sans-serif', color: '#1a3a6a', bg: '#f2f0ec' }));
  const logo = mesh(new THREE.PlaneGeometry(9, 1.7), track(new THREE.MeshBasicMaterial({ map: logoTex })), 0, 2.4, MALL_L - 0.06, dyn);
  logo.rotation.y = Math.PI;

  // ---------- La porta 1313: una porta di servizio verde accanto all'ingresso ----------
  const door13 = { x: -15, z: 0.1 };
  box(1.9, 2.8, 0.2, mat('#3a2416'), door13.x, 1.4, 0.1);
  box(1.3, 2.45, 0.12, mat('#2f5a3a'), door13.x, 1.225, 0.2);
  const numTex = track(textTexture('1313', { width: 128, height: 48, font: '700 34px Cormorant Garamond, serif', color: '#2a1a0a', bg: '#d8b860' }));
  mesh(new THREE.PlaneGeometry(0.4, 0.13), track(new THREE.MeshBasicMaterial({ map: numTex })), door13.x, 1.85, 0.27, dyn);
  const door13Glow = new THREE.Sprite(track(new THREE.SpriteMaterial({ map: glow, color: '#ffd890', blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0.8 })));
  door13Glow.position.set(door13.x, 0.15, 0.5);
  door13Glow.scale.set(2.2, 0.8, 1);
  dyn.add(door13Glow);

  // ---------- Il negozio di retrogiochi ----------
  const R = shops.find((q) => q.retro);
  const rx = (v) => R.side * v; // distanza dal centro della galleria
  const purple = mat('#2a1040', { emissive: 0.25 });
  box(MALL_W - SHOP_X - 0.4, 0.02, SHOP_L - 0.4, mat('#3a2a4a'), rx(16), 0.02, R.zm);
  box(5.6, 0.03, 4.2, mat('#6a2a5a'), rx(16), 0.04, R.zB - 3.4); // tappeto
  box(0.1, 5.4, SHOP_L - 0.3, purple, rx(MALL_W - 0.25), 2.7, R.zm);
  // scaffali pieni di cartucce e scatole di giochi, lungo la parete di fondo
  for (let q = 0; q < 4; q++) box(0.5, 0.05, 6.8, mat('#2a2a30'), rx(MALL_W - 0.6), 0.6 + q * 0.75, R.zA + 7.1);
  for (let q = 0; q < 4; q++)
    for (let c = 0; c < 18; c++) box(0.25, 0.32, 0.3, mat(PALETTES[Math.floor(rand() * PALETTES.length)], { emissive: 0.15 }), rx(MALL_W - 0.6), 0.8 + q * 0.75, R.zA + 4 + c * 0.36);
  collider(Math.min(rx(MALL_W - 0.9), rx(MALL_W)), Math.max(rx(MALL_W - 0.9), rx(MALL_W)), R.zA + 3.6, R.zA + 10.6, 0);
  // poster pixelati sulla parete sud
  for (let q = 0; q < 3; q++) {
    const pm = track(new THREE.MeshBasicMaterial({ map: track(posterTex(q)) }));
    const p = mesh(new THREE.PlaneGeometry(0.9, 1.35), pm, rx(13.5 + q * 1.6), 2.6, R.zA + 0.17, dyn);
    void p;
  }
  // il banco e il commesso
  box(1, 1.05, 2.6, mat('#1a1a22'), rx(18.4), 0.53, R.zA + 2.1, { lv: 0 });
  box(0.5, 0.35, 0.5, mat('#c8c8d0'), rx(18.4), 1.22, R.zA + 1.6);
  R.clerk = { x: rx(19.3), y: 0, z: R.zA + 2.2, facing: -R.side * Math.PI / 2, calm: true };
  // il tubo catodico, su un mobiletto, davanti al pouf
  const crt = { x: rx(16), z: R.zB - 1.1 };
  box(1.8, 0.6, 0.8, mat('#4a3a2a'), crt.x, 0.3, crt.z, { lv: 0 });
  box(1.1, 0.85, 0.85, mat('#2a2a2e'), crt.x, 1.03, crt.z);
  box(0.9, 0.7, 0.4, mat('#1e1e22'), crt.x, 1.03, crt.z + 0.55);
  const screenCanvas = document.createElement('canvas');
  screenCanvas.width = 64;
  screenCanvas.height = 48;
  const screenTex = track(new THREE.CanvasTexture(screenCanvas));
  screenTex.colorSpace = THREE.SRGBColorSpace;
  screenTex.magFilter = THREE.NearestFilter;
  const screen = mesh(new THREE.PlaneGeometry(0.82, 0.62), track(new THREE.MeshBasicMaterial({ map: screenTex })), crt.x, 1.05, crt.z - 0.43, dyn);
  screen.rotation.y = Math.PI;
  const screenGlow = new THREE.Sprite(track(new THREE.SpriteMaterial({ map: glow, color: '#7ab0ff', blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0.45 })));
  screenGlow.position.set(crt.x, 1.05, crt.z - 0.7);
  screenGlow.scale.set(2.4, 2, 1);
  dyn.add(screenGlow);
  // console e joypad sul mobiletto
  box(0.5, 0.12, 0.35, mat('#8a8a90'), crt.x - 0.5, 0.66, crt.z - 0.1);
  box(0.25, 0.05, 0.12, mat('#3a3a40'), crt.x + 0.4, 0.63, crt.z - 0.25);
  // il pouf grande (per te) e uno più piccolo (per l'amico)
  const poufMat = mat('#c84a7a');
  const pouf = { x: rx(16), z: R.zB - 4 };
  const pm1 = mesh(new THREE.SphereGeometry(0.75, 20, 14), poufMat, pouf.x, 0.32, pouf.z);
  pm1.scale.set(1.15, 0.5, 1.15);
  const pouf2 = { x: rx(14.4), z: R.zB - 3.6 };
  const pm2 = mesh(new THREE.SphereGeometry(0.55, 18, 12), mat('#4a7ac8'), pouf2.x, 0.26, pouf2.z);
  pm2.scale.set(1.1, 0.5, 1.1);
  // l'insegna al neon dentro il negozio
  const neonTex = track(textTexture('RETRO', { width: 256, height: 72, font: '800 56px Inter, sans-serif', color: '#ff7ad8', bg: 'rgba(0,0,0,0)' }));
  const neon = mesh(new THREE.PlaneGeometry(2.4, 0.68), track(new THREE.MeshBasicMaterial({ map: neonTex, transparent: true })), rx(MALL_W - 0.32), 4.2, R.zm + 1, dyn);
  neon.rotation.y = -R.side * Math.PI / 2;
  const neonGlow = new THREE.Sprite(track(new THREE.SpriteMaterial({ map: glow, color: '#ff4ad8', blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0.5 })));
  neonGlow.position.set(rx(MALL_W - 0.8), 4.2, R.zm + 1);
  neonGlow.scale.set(5, 2.5, 1);
  dyn.add(neonGlow);
  const retroLight = new THREE.PointLight('#ff9ad8', 12, 14, 1.5);
  retroLight.position.set(rx(16), 4, R.zm);
  dyn.add(retroLight);

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
    const o = new THREE.Mesh(g, m);
    o.receiveShadow = true;
    merged.add(o);
  }
  scene.add(merged);

  // lo schermo del tubo catodico in modalità dimostrativa
  const sg = screenCanvas.getContext('2d');
  let screenT = 0;
  const drawScreen = (t) => {
    sg.fillStyle = '#04040c';
    sg.fillRect(0, 0, 64, 48);
    const f = Math.floor(t * 8);
    for (let i = 0; i < 9; i++) {
      sg.fillStyle = i === 0 ? '#c8ffb0' : '#3ae04a';
      const x = (f - i + 64) % 32;
      sg.fillRect(4 + x * 1.75, 22 + Math.round(Math.sin((f - i) * 0.3) * 8), 2, 2);
    }
    sg.fillStyle = '#ff3a3a';
    sg.fillRect(48, 12, 3, 3);
    if (Math.floor(t * 1.5) % 2) {
      sg.fillStyle = '#ffe42a';
      sg.font = 'bold 7px monospace';
      sg.fillText('PREMI START', 11, 44);
    }
    for (let y = 0; y < 48; y += 2) {
      sg.fillStyle = 'rgba(0,0,0,0.25)';
      sg.fillRect(0, y, 64, 1);
    }
    screenTex.needsUpdate = true;
  };

  return {
    colliders,
    shops,
    retro: { shop: R, crt, pouf, pouf2, screenGlow },
    door13: { x: door13.x, z: door13.z, spot: { x: door13.x, z: 1.4 } },
    setDay(d) {
      skyMat.color.set(d ? '#e8f4ff' : '#101a3a');
      outsideMat.color.set(d ? '#f4f8ff' : '#141c38');
      moonMat.color.set(d ? '#bfe0ff' : '#1c2a5a');
    },
    update(t, dt) {
      steps.offset.y = (steps.offset.y + dt * 0.35) % 1;
      screenT -= dt;
      if (screenT <= 0) {
        screenT = 0.12;
        drawScreen(t);
      }
      screenGlow.material.opacity = 0.4 + Math.sin(t * 7) * 0.04;
      door13Glow.material.opacity = 0.65 + Math.sin(t * 1.5) * 0.15;
      neonGlow.material.opacity = 0.45 + (Math.random() < 0.01 ? -0.3 : 0);
    },
    dispose() {
      disposables.forEach((d) => d.dispose());
      merged.removeFromParent();
      dyn.removeFromParent();
    },
  };
}

// Quanto è alto il pavimento in (x, z) per chi sta all'altezza y: rampe delle
// scale mobili, primo piano (ballatoi, passerelle, negozi di sopra), o terra.
export function upperWalkable(x, z) {
  if (Math.abs(x) >= VOID_X - 0.05) return true;
  if (z >= END_SLAB) return true;
  return BRIDGES.some((b) => z >= b && z <= b + 4);
}

export function rampAt(x, z) {
  if (Math.abs(x) > 3) return null;
  for (const r of RAMPS) if (z >= r.z0 && z <= r.z1) return ((z - r.z0) / (r.z1 - r.z0)) * UPPER;
  return null;
}

export function floorHeight(x, z, y) {
  const r = rampAt(x, z);
  if (r !== null) return r;
  if (y > UPPER / 2 && upperWalkable(x, z)) return UPPER;
  return 0;
}

// sotto un ballatoio o una passerella il soffitto è basso
export function underSlab(x, z) {
  return upperWalkable(x, z);
}
