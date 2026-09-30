import * as THREE from 'three';
import { X0, Z0, NW, NH, COLS, ROWS } from './layout.js';
import { textTexture, glowTexture } from '../../core/textures.js';
import { buildElevatorDoors } from './elevator.js';
import { PRIZES, prizeModel } from './prizes.js';

export const ARCADE_STYLE = {
  key: 'salagiochi', name: 'Sala Giochi', height: 14, noDefaultLamp: true,
  floor: ['arcade', []], wall: ['plain', ['#10081e']], ceil: '#07040e', light: '#9a5aff',
};

const FAKE_TITLES = ['NEBULA 2000', 'DRAGO LASER', 'SOGNO TURBO', 'PIXEL NOTTE', 'CORRIDOIO X', 'MARE DI BIT', 'GALASSIA 13', 'HOTEL ∞'];
const PLAYABLE = [
  { key: 'invaders', title: 'GNOMI INVADERS', color: '#2a4aff' },
  { key: 'demone', title: 'FUGA DAL DEMONE', color: '#c42b2b' },
  { key: 'ping', title: 'PING DEL TÈ', color: '#2aa86a' },
];
const BODY_COLORS = ['#2a1a4a', '#4a1a2a', '#1a2a4a', '#1a3a2a', '#3a2a1a', '#2a2a2a'];

// Un piano "aperto": un'unica sala enorme, senza muri interni. È una tessera
// che si ripete: camminando oltre il bordo si rientra dal lato opposto.
export function arcadeLayout() {
  const room = { id: 0, cells: [], minX: X0, maxX: X0 + NW, minZ: Z0, maxZ: Z0 + NH, cx: X0 + NW / 2, cz: Z0 + NH / 2, arcade: true };
  const blocked = new Uint8Array(NW * NH);
  const markRect = (minX, maxX, minZ, maxZ, pad = 0.35) => {
    const i0 = Math.max(0, Math.floor(minX - pad - X0));
    const i1 = Math.min(NW - 1, Math.floor(maxX + pad - X0 - 1e-6));
    const j0 = Math.max(0, Math.floor(minZ - pad - Z0));
    const j1 = Math.min(NH - 1, Math.floor(maxZ + pad - Z0 - 1e-6));
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) blocked[j * NW + i] = 1;
  };
  return { rooms: [room], cellRoom: new Int32Array(ROWS * COLS).fill(0), edges: [], walls: [], doorways: [], blocked, markRect, playerRoom: -1, wrap: true };
}

// Schermi animati in "modalità dimostrativa": pochi canvas condivisi da tutti i cabinati.
function makeScreens(track) {
  const screens = [];
  for (let k = 0; k < 6; k++) {
    const c = document.createElement('canvas');
    c.width = 64;
    c.height = 48;
    const t = track(new THREE.CanvasTexture(c));
    t.colorSpace = THREE.SRGBColorSpace;
    t.magFilter = THREE.NearestFilter;
    const mat = track(new THREE.MeshBasicMaterial({ map: t }));
    screens.push({ c, g: c.getContext('2d'), t, mat, kind: k });
  }
  return {
    mats: screens.map((s) => s.mat),
    update(time) {
      for (const s of screens) {
        const g = s.g;
        g.fillStyle = '#020208';
        g.fillRect(0, 0, 64, 48);
        const f = time * (1 + s.kind * 0.3);
        if (s.kind % 3 === 0) {
          // mini-invaders
          for (let r = 0; r < 3; r++)
            for (let q = 0; q < 6; q++) {
              g.fillStyle = ['#ff3a3a', '#ffe42a', '#3af0ff'][r];
              g.fillRect(8 + q * 9 + Math.sin(f) * 5, 6 + r * 7, 5, 4);
            }
          g.fillStyle = '#fff';
          g.fillRect(28 + Math.sin(f * 1.7) * 20, 40, 7, 3);
        } else if (s.kind % 3 === 1) {
          // strada che scorre
          g.fillStyle = '#1a3a1a';
          g.fillRect(0, 0, 64, 48);
          g.fillStyle = '#333';
          g.fillRect(20, 0, 24, 48);
          g.fillStyle = '#ffe42a';
          for (let y = -8; y < 48; y += 10) g.fillRect(31, (y + f * 30) % 56 - 8, 2, 5);
          g.fillStyle = '#ff3a3a';
          g.fillRect(28 + Math.sin(f) * 8, 34, 8, 10);
        } else {
          // spirale di colori
          for (let i = 0; i < 12; i++) {
            const a = f + i * 0.5;
            g.fillStyle = `hsl(${(i * 30 + f * 80) % 360},90%,60%)`;
            g.fillRect(32 + Math.cos(a) * i * 2.2, 24 + Math.sin(a) * i * 1.6, 4, 4);
          }
        }
        if (Math.floor(time * 2 + s.kind) % 4 === 0) {
          g.fillStyle = '#fff';
          g.font = 'bold 8px monospace';
          g.fillText('INSERT COIN', 6, 46);
        }
        s.t.needsUpdate = true;
      }
    },
  };
}

export function buildArcade(rb, layout, scene) {
  const room = layout.rooms[0];
  const api = rb.build(room, ARCADE_STYLE);
  const a = api;
  const track = (o) => a.track(o);
  const screens = makeScreens(track);
  const cabinets = [];
  const claws = [];

  const marqueeMats = new Map();
  const marquee = (title, color) => {
    if (!marqueeMats.has(title)) {
      const t = track(textTexture(title, { width: 256, height: 64, font: 'bold 34px monospace', color: '#fff', glow: color, bg: color }));
      marqueeMats.set(title, track(new THREE.MeshBasicMaterial({ map: t })));
    }
    return marqueeMats.get(title);
  };

  // ---------- Cabinati ----------
  let n = 0;
  const cabinet = (x, z, facing) => {
    n++;
    const s = facing === 0 ? 1 : -1;
    const playable = n % 3 === 0 ? PLAYABLE[(n / 3) % PLAYABLE.length | 0] : null;
    const title = playable ? playable.title : FAKE_TITLES[n % FAKE_TITLES.length];
    const color = playable ? playable.color : ['#ff2a9a', '#2af0ff', '#ffe42a', '#8a4aff', '#3aff7a'][n % 5];
    const body = a.mat(BODY_COLORS[n % BODY_COLORS.length]);
    a.box(1.1, 1.9, 0.9, body, x, 0.95, z);
    a.box(1.12, 0.32, 0.25, marquee(title, color), x, 2.05, z + s * 0.35, { collide: false });
    a.box(0.82, 0.62, 0.06, screens.mats[n % 6], x, 1.42, z + s * 0.46, { collide: false });
    a.box(1.05, 0.1, 0.4, a.mat('#111'), x, 0.98, z + s * 0.6, { collide: false });
    a.cyl(0.02, 0.02, 0.12, a.mat('#222'), x - 0.25, 1.08, z + s * 0.62, { collide: false });
    a.sphere(0.045, a.glowMat('#ff2a2a', 1.5), x - 0.25, 1.15, z + s * 0.62, { collide: false });
    for (let b = 0; b < 3; b++) a.cyl(0.035, 0.035, 0.03, a.glowMat(['#ffe42a', '#2af0ff', '#3aff7a'][b], 1.6), x + 0.05 + b * 0.13, 1.04, z + s * 0.62, { collide: false });
    cabinets.push({ x: room.cx + x, z: room.cz + z, facing, title, game: playable?.key || null, spot: new THREE.Vector3(room.cx + x, 0, room.cz + z + s * 1.3) });
  };

  for (const rz of [-44, -32, -20, 20, 32, 44]) {
    for (let seg = 0; seg < 7; seg++) {
      const x0 = -46 + seg * 13.4;
      for (let k = 0; k < 7; k++) {
        const x = x0 + k * 1.3;
        cabinet(x, rz - 0.5, Math.PI);
        cabinet(x, rz + 0.5, 0);
      }
    }
  }

  // ---------- Il nucleo degli ascensori al centro ----------
  const core = a.mat('#1a1026');
  a.box(6, ARCADE_STYLE.height, 6, core, 0, ARCADE_STYLE.height / 2, 0);
  const elevator = buildElevatorDoors(a, 0, -3.05, Math.PI, '88');
  const signTex = track(textTexture('SALA GIOCHI · 88', { width: 1024, height: 128, font: 'bold 80px monospace', color: '#fff', glow: '#ff2a9a' }));
  const signMat = track(new THREE.MeshBasicMaterial({ map: signTex, transparent: true }));
  for (const [rx, x, z] of [[0, 0, -3.02], [Math.PI, 0, 3.02], [Math.PI / 2, 3.02, 0], [-Math.PI / 2, -3.02, 0]]) {
    const p = new THREE.Mesh(track(new THREE.PlaneGeometry(5.6, 0.7)), signMat);
    p.position.set(room.cx + x, 6, room.cz + z);
    p.rotation.y = rx === 0 ? Math.PI : rx === Math.PI ? 0 : rx;
    rb.dynamic.add(p);
  }

  // ---------- Banco premi: guarda l'ascensore, è la prima cosa che vedi ----------
  a.box(14, 1.1, 1.2, a.mat('#3a1a4a'), 0, 0.55, -12);
  a.box(14.2, 0.08, 1.4, a.glowMat('#ff2a9a', 1.2), 0, 1.12, -12, { collide: false });
  a.box(14, 2.6, 0.4, a.mat('#2a1236'), 0, 1.3, -14.6);
  for (let r = 0; r < 3; r++) a.box(13.6, 0.06, 0.6, a.mat('#4a2a5a'), 0, 0.6 + r * 0.8, -14.2, { collide: false });
  PRIZES.forEach((p, i) => {
    const mdl = prizeModel(p.id, track);
    mdl.scale.setScalar(1.6);
    mdl.position.set(room.cx - 6 + (i % 5) * 3, 0.64 + Math.floor(i / 5) * 0.8, room.cz - 14.2);
    rb.dynamic.add(mdl);
  });
  const counterTex = track(textTexture('PREMI', { width: 512, height: 128, font: 'bold 90px monospace', color: '#ffe42a', glow: '#ff8a1a' }));
  const counterSign = new THREE.Mesh(track(new THREE.PlaneGeometry(4, 1)), track(new THREE.MeshBasicMaterial({ map: counterTex, transparent: true })));
  counterSign.position.set(room.cx, 3.3, room.cz - 14.35);
  rb.dynamic.add(counterSign);
  const counterSpot = new THREE.Vector3(room.cx, 0, room.cz - 10.2);

  // ---------- Gru dei peluche ----------
  const glass = a.mat('#cfe8ff', { transparent: 0.25 });
  for (const sx of [-1, 1]) {
    for (let k = 0; k < 3; k++) {
      const x = sx * (10 + k * 1.8);
      const z = -5;
      a.box(1.5, 1, 1.5, a.mat(sx < 0 ? '#ff2a9a' : '#2af0ff'), x, 0.5, z);
      a.box(1.5, 1.5, 1.5, glass, x, 1.75, z, { collide: false });
      a.box(1.5, 0.35, 1.5, a.glowMat(sx < 0 ? '#ff2a9a' : '#2af0ff', 1.3), x, 2.68, z, { collide: false });
      for (let q = 0; q < 6; q++) a.sphere(0.14, a.mat(['#ffd21a', '#d82a2a', '#3a5ac8', '#2a1216', '#ff4a8a', '#f4f0e8'][q]), x + ((q % 3) - 1) * 0.35, 1.15 + Math.floor(q / 3) * 0.2, z + ((q * 7) % 3 - 1) * 0.3, { collide: false });
      claws.push({ spot: new THREE.Vector3(room.cx + x, 0, room.cz + z - 1.5) });
    }
  }
  const clawTex = track(textTexture('ARTIGLIO', { width: 512, height: 128, font: 'bold 80px monospace', color: '#fff', glow: '#ff2a9a' }));
  for (const sx of [-1, 1]) {
    const cs = new THREE.Mesh(track(new THREE.PlaneGeometry(4.4, 1.1)), track(new THREE.MeshBasicMaterial({ map: clawTex, transparent: true })));
    cs.position.set(room.cx + sx * 11.8, 3.6, room.cz - 5.8);
    cs.rotation.y = Math.PI;
    rb.dynamic.add(cs);
  }

  // ---------- Air hockey, flipper, pista da ballo ----------
  for (const sx of [-1, 1]) {
    for (const x of [30, 40]) {
      a.box(2.4, 0.85, 1.4, a.mat('#e8e8f0'), sx * x, 0.43, 0);
      a.box(2.5, 0.08, 1.5, a.glowMat('#2af0ff', 1.2), sx * x, 0.88, 0, { collide: false });
      a.cyl(0.07, 0.07, 0.02, a.mat('#d82a2a'), sx * x + 0.3, 0.9, 0.1, { collide: false });
    }
    // pedana da ballo con frecce che si accendono
    const pad = [];
    for (let q = 0; q < 4; q++) {
      const m = track(new THREE.MeshBasicMaterial({ color: ['#ff2a9a', '#2af0ff', '#ffe42a', '#3aff7a'][q] }));
      const [dx, dz] = [[-0.6, 0], [0.6, 0], [0, -0.6], [0, 0.6]][q];
      a.box(0.5, 0.05, 0.5, m, sx * 22 + dx, 0.15, 8 + dz, { collide: false, dynamic: true });
      pad.push(m);
    }
    a.box(2, 0.12, 2, a.mat('#222'), sx * 22, 0.06, 8, { collide: false });
    a.box(2, 2.6, 0.4, a.mat('#1a1a2a'), sx * 22, 1.3, 9.4);
    a.anim((t) => pad.forEach((m, q) => (m.visible = Math.floor(t * 4 + q * 1.7 + sx) % 3 !== 0)));
  }
  for (let k = 0; k < 10; k++) {
    const x = -13.5 + k * 3;
    a.box(0.75, 1, 1.5, a.mat(BODY_COLORS[k % 6]), x, 0.5, 12);
    a.box(0.8, 1, 0.12, screens.mats[(k + 2) % 6], x, 1.6, 12.75, { collide: false });
  }

  // ---------- Neon sul soffitto e insegne sospese ----------
  const neon = [a.glowMat('#ff2a9a', 2.2), a.glowMat('#2af0ff', 2.2)];
  for (let k = -4; k <= 4; k++) {
    a.box(NW, 0.12, 0.12, neon[(k + 4) % 2], 0, ARCADE_STYLE.height - 0.3, k * 12, { collide: false });
    a.box(0.12, 0.12, NH, neon[(k + 5) % 2], k * 12, ARCADE_STYLE.height - 0.3, 0, { collide: false });
  }
  const glow = track(glowTexture('rgba(255,255,255,1)'));
  const words = ['GIOCA!', 'BIGLIETTI', 'HIGH SCORE', 'SALA GIOCHI', 'VINCI!', 'NON FINISCE MAI'];
  words.forEach((w, i) => {
    const tex = track(textTexture(w, { width: 512, height: 128, font: 'bold 72px monospace', color: '#fff', glow: ['#ff2a9a', '#2af0ff', '#ffe42a'][i % 3] }));
    const sp = new THREE.Sprite(track(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false })));
    sp.scale.set(6, 1.5, 1);
    sp.position.set(room.cx + Math.cos(i * 1.1) * 30, 9, room.cz + Math.sin(i * 1.1) * 30);
    rb.dynamic.add(sp);
    const h = new THREE.Sprite(track(new THREE.SpriteMaterial({ map: glow, color: ['#ff2a9a', '#2af0ff', '#ffe42a'][i % 3], blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0.35 })));
    h.scale.set(10, 4, 1);
    h.position.copy(sp.position);
    rb.dynamic.add(h);
  });

  rb.mergeStatic();

  // ---------- Copie tutt'intorno: la sala continua in ogni direzione ----------
  const copies = new THREE.Group();
  for (let dx = -1; dx <= 1; dx++)
    for (let dz = -1; dz <= 1; dz++) {
      if (!dx && !dz) continue;
      const c1 = rb.group.clone();
      const c2 = rb.dynamic.clone();
      c1.position.set(dx * NW, 0, dz * NH);
      c2.position.set(dx * NW, 0, dz * NH);
      copies.add(c1, c2);
    }
  scene.add(copies);

  return {
    cabinets,
    claws,
    counterSpot,
    elevator,
    update(t) {
      screens.update(t);
    },
    dispose() {
      copies.removeFromParent();
    },
  };
}
