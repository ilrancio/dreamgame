import * as THREE from 'three';
import { STYLES } from './rooms.js';

// L'hotel non è euclideo: da fuori ha tre piani, dentro ne ha centinaia.
// Ogni piano ha un'architettura; le sue stanze pescano dagli stili di quella
// architettura, con qualche stanza "intrusa" da un altro mondo, come nei sogni.

const byKey = (k) => STYLES.find((s) => s.key === k);

// ---------- Stili di stanza nuovi ----------
const NEW_STYLES = [
  {
    key: 'baita', name: 'Stube della Baita', height: 5.5,
    floor: ['planks', ['#6a4a30', '#5a3e28']], wall: ['planks', ['#7a5436', '#6a4830']], ceil: '#4a3020', light: '#ffc98a',
    props(a) {
      const stone = a.mat('#7a7068');
      a.box(2.6, 2.4, 0.9, stone, 0, 1.2, a.hw - 0.45);
      a.box(1.4, 1, 0.95, a.mat('#120c08'), 0, 0.55, a.hw - 0.42, { collide: false });
      a.lamp(0, 0.5, a.hw - 0.7, '#ff8a3a', 0.3, 'fire');
      a.box(3.4, 0.02, 2.4, a.texMat('plaid', ['#8a1a1a', '#1a2a1a']), 0, 0.02, a.hw - 3.2, { collide: false });
      for (const sx of [-1, 1]) a.box(1, 1, 1, a.mat('#5a2a1a'), sx * 2, 0.5, a.hw - 3.4);
      for (let k = 0; k < 3; k++) {
        const c = a.cone(0.1, 0.9, a.mat('#e8dcc0'), (k - 1) * 0.5, 3.6, a.hw - 0.2, { collide: false });
        c.rotation.x = -1;
      }
      a.box(3, 0.9, 1.4, a.mat('#4a3020'), 0, 0.45, -1.5);
    },
  },
  {
    key: 'fienile', name: 'Fienile Illuminato', height: 9,
    floor: ['planks', ['#8a6a40', '#7a5a34']], wall: ['planks', ['#6a3a22', '#5a3020']], ceil: '#3a2416', light: '#ffd98a',
    props(a) {
      const hay = a.mat('#d8b85a');
      for (let k = 0; k < 7; k++) {
        const p = a.place(1.2);
        if (p) {
          a.box(1.8, 1, 1.2, hay, p.x, 0.5, p.z, { rotY: Math.random() });
          if (Math.random() < 0.5) a.box(1.8, 1, 1.2, hay, p.x, 1.5, p.z, { rotY: Math.random(), collide: false });
        }
      }
      for (let k = 0; k < 5; k++) a.lamp((k - 2) * 3, 5, 0, '#ffcf6a', 0.25);
    },
  },
  {
    key: 'cemento', name: 'Sala di Cemento', height: 8,
    floor: ['concrete', ['#8a8884', '#6a6864']], wall: ['concrete', ['#9a9894', '#7a7874']], ceil: '#5a5854', light: '#dfe6ee',
    props(a) {
      const conc = a.mat('#8a8884');
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) a.box(2.2, a.h, 2.2, conc, sx * 4.5, a.h / 2, sz * 4.5);
      for (let k = -2; k <= 2; k++) a.box(0.3, 5, 0.06, a.glowMat('#f2f6ff', 1.6), k * 2.6, 3.5, a.hw - 0.03, { collide: false });
      a.box(4, 0.5, 1, conc, 0, 0.25, 0);
    },
  },
  {
    key: 'vuoto', name: 'Vuoto Monumentale', height: 18,
    floor: ['concrete', ['#7a7874', '#5a5854']], wall: ['concrete', ['#8a8884', '#6a6864']], ceil: '#3a3834', light: '#cfd8e0',
    props(a) {
      const conc = a.mat('#7a7874');
      // una scala che sale e si interrompe nel nulla
      for (let s = 0; s < 12; s++) a.box(2.4, 0.5, 1, conc, -a.hw + 2, 0.25 + s * 0.5, -5 + s * 1, { collide: s < 3 });
      a.box(0.8, 0.8, 0.8, conc, 2, 0.4, 2);
      // un unico fascio di luce dall'alto
      a.glowSprite('#ffffff', 2, 9, 2, 16, 0.25);
      a.box(0.7, a.h, 0.7, a.glowMat('#f4f8ff', 0.3), 2, a.h / 2, 2, { collide: false });
    },
  },
  {
    key: 'marmo', name: 'Galleria delle Statue', height: 10,
    floor: ['checker', ['#f0ece4', '#2a2622']], wall: ['stripes', ['#e8e0d0', '#dcd2c0']], ceil: '#d8d0c0', light: '#fff0d8',
    props(a) {
      const marble = a.mat('#f2eee6');
      for (const sx of [-1, 1]) for (const z of [-5, 0, 5]) a.cyl(0.55, 0.65, a.h, marble, sx * 6.5, a.h / 2, z);
      for (let k = 0; k < 4; k++) {
        const p = a.place(1);
        if (!p) continue;
        a.box(1, 1.1, 1, marble, p.x, 0.55, p.z);
        a.cyl(0.25, 0.35, 1.3, marble, p.x, 1.75, p.z, { collide: false });
        a.sphere(0.25, marble, p.x, 2.6, p.z, { collide: false });
      }
      a.chandelier(0, a.h - 2, 0, '#fff0d0', 1.1);
    },
  },
  {
    key: 'minimal', name: 'Salotto Minimale', height: 5,
    floor: ['plain', ['#e8e8e6']], wall: ['plain', ['#f6f6f4']], ceil: '#fafafa', light: '#ffffff',
    props(a) {
      a.box(4, 0.45, 1.3, a.mat('#b8b8b4'), 0, 0.23, -a.hw + 1.6);
      a.box(1.8, 0.05, 1, a.mat('#cfe6ee', { transparent: 0.4 }), 0, 0.45, -a.hw + 3.4);
      const cols = ['#ff5a3a', '#2a4aff', '#ffd23a', '#1a1a1a'];
      for (let k = 0; k < 3; k++) a.box(1.6, 1.6, 0.06, a.mat(cols[k], { emissive: 0.15 }), (k - 1) * 2.4, 2.3, a.hw - 0.03, { collide: false });
      a.cyl(0.02, 0.02, 1.6, a.mat('#1a1a1a'), 3.5, 0.8, -a.hw + 1.2, { collide: false });
      a.lamp(3.5, 1.7, -a.hw + 1.2, '#fff4e0', 0.25);
    },
  },
  {
    key: 'galleria', name: 'Galleria d\'Arte', height: 7,
    floor: ['plain', ['#d8d4cc']], wall: ['plain', ['#fbfaf8']], ceil: '#f4f4f2', light: '#fff8ee',
    props(a) {
      const cols = ['#e04a2a', '#2a6ae0', '#f0c030', '#40a060', '#a040c0', '#1a1a1a'];
      for (let k = 0; k < 10; k++) {
        const side = k % 4;
        const t = ((k >> 2) - 1) * 4.5;
        const w = 1.2 + Math.random() * 1.4;
        const h = 1 + Math.random() * 1.2;
        const m = a.mat(cols[k % cols.length], { emissive: 0.1 });
        if (side === 0) a.box(w, h, 0.05, m, t, 2.4, a.hw - 0.03, { collide: false });
        else if (side === 1) a.box(w, h, 0.05, m, t, 2.4, -a.hw + 0.03, { collide: false });
        else if (side === 2) a.box(0.05, h, w, m, a.hw - 0.03, 2.4, t, { collide: false });
        else a.box(0.05, h, w, m, -a.hw + 0.03, 2.4, t, { collide: false });
      }
      a.box(3, 0.45, 0.8, a.mat('#8a6a4a'), 0, 0.23, 0);
    },
  },
  {
    key: 'neon', name: 'Corridoio al Neon', height: 6,
    floor: ['grid', ['#0a0a14', '#ff2a9a']], wall: ['grid', ['#0c0c18', '#2af0ff']], ceil: '#06060c', light: '#b04aff',
    props(a) {
      const holo = new THREE.MeshBasicMaterial({ color: '#2af0ff', wireframe: true, transparent: true, opacity: 0.7 });
      a.track(holo);
      const s = a.sphere(1.3, holo, 0, 2.2, 0, { collide: false, dynamic: true });
      a.anim((t) => {
        s.rotation.y = t * 0.6;
        s.rotation.x = Math.sin(t * 0.4) * 0.4;
      });
      a.cyl(0.9, 1.1, 0.4, a.mat('#1a1a2a'), 0, 0.2, 0);
      for (const sx of [-1, 1]) a.box(0.06, 0.06, a.hw * 2, a.glowMat(sx < 0 ? '#ff2a9a' : '#2af0ff', 2.5), sx * (a.hw - 0.1), 0.15, 0, { collide: false });
    },
  },
  {
    key: 'capsule', name: 'Dormitorio a Capsule', height: 7,
    floor: ['grid', ['#e8ecf2', '#b8c4d4']], wall: ['plain', ['#e8eef4']], ceil: '#dfe6ee', light: '#bfefff',
    props(a) {
      const shell = a.mat('#f4f6fa');
      for (let r = 0; r < 2; r++)
        for (let k = -2; k <= 2; k++) {
          const y = 0.7 + r * 1.6;
          const c = a.cyl(0.7, 0.7, 2.4, shell, k * 2.3, y, a.hw - 1.25, { collide: r === 0 });
          c.rotation.x = Math.PI / 2;
          a.disc(0.55, a.glowMat('#6ae8ff', 0.8), k * 2.3, y, a.hw - 2.46, Math.PI);
        }
    },
  },
];

// ---------- Architetture dei piani ----------
export const ARCHITECTURES = [
  {
    key: 'cottage', name: 'Cottage',
    hall: { floor: ['planks', ['#7a5436', '#6a4830']], wall: ['planks', ['#8a6040', '#7a5436']], ceil: '#4a3020', light: '#ffc98a', height: 9 },
    rooms: ['baita', 'fienile', 'serra', 'biblioteca', 'pastello'],
    hallProps(a) {
      const wood = a.mat('#5a3a22');
      for (const sx of [-1, 1]) for (const z of [-8, 8]) a.box(0.8, a.h, 0.8, wood, sx * 10, a.h / 2, z);
      for (const z of [-8, 0, 8]) a.box(22, 0.5, 0.6, wood, 0, a.h - 0.8, z, { collide: false });
      a.box(3.4, 0.9, 1.3, a.mat('#8a2a1a'), -5, 0.45, 2);
      a.box(3.4, 0.9, 1.3, a.mat('#8a2a1a'), 5, 0.45, 2);
      a.lamp(0, a.h - 2, 0, '#ffc070', 0.5, 'paper');
    },
  },
  {
    key: 'brutalista', name: 'Brutalista',
    hall: { floor: ['concrete', ['#7a7874', '#5a5854']], wall: ['concrete', ['#8a8884', '#6a6864']], ceil: '#4a4844', light: '#d8e2ec', height: 16 },
    rooms: ['cemento', 'vuoto', 'industriale', 'specchi'],
    hallProps(a) {
      const conc = a.mat('#8a8884');
      for (const sx of [-1, 1]) for (const z of [-9, 0, 9]) a.box(2.4, a.h, 2.4, conc, sx * 11, a.h / 2, z);
      a.box(10, 0.6, 3, conc, 0, 0.3, 4);
      for (let k = -3; k <= 3; k++) a.box(0.25, 10, 0.06, a.glowMat('#eef4ff', 1.4), k * 3.2, 7, a.hw - 0.03, { collide: false });
    },
  },
  {
    key: 'classico', name: 'Classico',
    hall: { floor: ['checker', ['#efe8da', '#8a6a4a']], wall: ['damask', ['#d8c8a8', '#cab890']], ceil: '#e8dcc0', light: '#ffe6c0', height: 12 },
    rooms: ['marmo', 'barocco', 'biblioteca', 'gotico'],
    hallProps(a) {
      const marble = a.mat('#f2eee6');
      for (const sx of [-1, 1]) for (const z of [-9, 0, 9]) a.cyl(0.8, 0.95, a.h, marble, sx * 11, a.h / 2, z);
      a.chandelier(0, a.h - 3, 0, '#ffe0a8', 2);
      a.cyl(2.2, 2.4, 0.8, marble, 0, 0.4, 3);
      a.sphere(0.6, marble, 0, 1.5, 3, { collide: false });
    },
  },
  {
    key: 'moderno', name: 'Moderno',
    hall: { floor: ['plain', ['#dcdcd8']], wall: ['plain', ['#f4f4f2']], ceil: '#fafafa', light: '#ffffff', height: 8 },
    rooms: ['minimal', 'galleria', 'piscina', 'pastello'],
    hallProps(a) {
      a.box(6, 0.45, 1.4, a.mat('#3a3a3a'), 0, 0.23, 3);
      for (const sx of [-1, 1]) {
        a.cyl(0.5, 0.4, 0.8, a.mat('#e8e8e4'), sx * 8, 0.4, 6);
        a.sphere(0.9, a.mat('#3a7a3a'), sx * 8, 1.5, 6, { collide: false });
      }
      a.box(12, 0.06, 0.06, a.glowMat('#ffffff', 2), 0, a.h - 0.3, 0, { collide: false });
    },
  },
  {
    key: 'futuristico', name: 'Futuristico',
    hall: { floor: ['grid', ['#0c0c18', '#2af0ff']], wall: ['plain', ['#12121e']], ceil: '#06060c', light: '#8a6aff', height: 10 },
    rooms: ['neon', 'capsule', 'spaziale', 'disco', 'acquario'],
    hallProps(a) {
      const ring = a.glowMat('#2af0ff', 2);
      for (let k = 0; k < 3; k++) {
        const r = a.cyl(3 + k * 1.5, 3 + k * 1.5, 0.1, ring, 0, 2 + k * 2.5, 2, { collide: false });
        r.scale.set(1, 1, 1);
      }
      a.cyl(1.2, 1.4, 0.8, a.mat('#1a1a2a'), 0, 0.4, 2);
      a.glowSprite('#8a6aff', 0, 3, 2, 8, 0.4);
    },
  },
];

export const ALL_STYLES = [...STYLES, ...NEW_STYLES];
export const styleByKey = (k) => byKey(k) || NEW_STYLES.find((s) => s.key === k);

// Architettura di un piano: deterministica, ma senza un ordine prevedibile.
export function architectureFor(floor) {
  const h = Math.abs(Math.sin(floor * 12.9898) * 43758.5453) % 1;
  return ARCHITECTURES[Math.floor(h * ARCHITECTURES.length)];
}
