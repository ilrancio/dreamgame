import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { PATTERNS } from './patterns.js';
import { glowTexture, textTexture } from '../../core/textures.js';
import { DOOR_H, DOOR_W, WALL_T } from './layout.js';

// Catalogo degli stili: ogni stanza dell'hotel è un piccolo mondo a sé.
export const STYLES = [
  {
    key: 'giapponese', name: 'Sala Giapponese', height: 6,
    floor: ['tatami', ['#c9b77a', '#3a4a2a']], wall: ['shoji', ['#f2e8cf', '#5a3a22']], ceil: '#3a2a1c', light: '#ffd9a0',
    props(a) {
      const wood = a.mat('#5a3a22');
      a.box(5, 0.5, 3, wood, 0, 0.25, 0);
      for (const [x, z] of [[-3.2, 0], [3.2, 0], [0, -2.4], [0, 2.4]]) a.box(1.1, 0.2, 1.1, a.mat('#8a2a2a'), x, 0.1, z, { collide: false });
      for (let i = 0; i < 4; i++) {
        const p = a.place(1);
        if (p) a.lamp(p.x, 2.6, p.z, '#ffb070', 0.5, 'paper');
      }
      const p = a.place(1.5);
      if (p) {
        a.box(1.2, 0.8, 1.2, a.mat('#3a2a1c'), p.x, 0.4, p.z);
        a.sphere(0.9, a.mat('#2f5a2a'), p.x, 1.6, p.z, { collide: false }).scale.set(1.4, 0.7, 1.4);
      }
    },
  },
  {
    key: 'barocco', name: 'Salone Barocco', height: 9,
    floor: ['checker', ['#e8e2d6', '#3a2e2a']], wall: ['damask', ['#6a1420', '#8a2430']], ceil: '#d9b36a', light: '#ffcf8a',
    props(a) {
      const gold = a.mat('#c9a040', { metal: true });
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) a.cyl(0.6, 0.7, a.h, gold, sx * 5.5, a.h / 2, sz * 5.5);
      a.chandelier(0, a.h - 2.2, 0, '#ffd89a', 1.4);
      a.box(4, 0.9, 1.4, a.mat('#8a1a2a'), 0, 0.45, -a.hw + 2.2);
      for (const sx of [-1, 1]) a.box(2.2, 3.2, 0.2, gold, sx * 4, 3.4, a.hw - 0.2, { collide: false });
    },
  },
  {
    key: 'biblioteca', name: 'Biblioteca Infinita', height: 12,
    floor: ['planks', ['#5a3a22', '#4a2e1a']], wall: ['books', []], ceil: '#2a1a10', light: '#ffd9a0',
    props(a) {
      const shelf = a.mat('#3a2616');
      const booksMat = a.texMat('books', []);
      for (const x of [-4, 0, 4]) {
        a.box(1, 7, 7, booksMat, x, 3.5, 0);
        a.box(1.1, 0.3, 7.2, shelf, x, 7.1, 0, { collide: false });
      }
      for (let i = 0; i < 3; i++) {
        const p = a.place(1);
        if (p) {
          a.box(1.4, 0.9, 0.8, shelf, p.x, 0.45, p.z);
          a.lamp(p.x, 1.25, p.z, '#6aff9a', 0.35);
        }
      }
      a.sphere(0.7, a.mat('#3a6a8a'), a.hw - 2, 1.6, -a.hw + 2);
    },
  },
  {
    key: 'disco', name: 'Discoteca Anni Settanta', height: 7,
    floor: ['plain', ['#111']], wall: ['stripes', ['#1a0a2a', '#2a0a3a']], ceil: '#0a0510', light: '#ff5ad9',
    props(a) {
      // pavimento luminoso che cambia colore
      const tiles = [];
      const cols = ['#ff3a8a', '#3ae0ff', '#ffe03a', '#8a3aff', '#3aff8a'];
      for (let i = -3; i <= 3; i++)
        for (let j = -3; j <= 3; j++) {
          const m = new THREE.MeshBasicMaterial({ color: cols[(i + j + 10) % cols.length] });
          a.track(m);
          a.box(2.2, 0.05, 2.2, m, i * 2.3, 0.03, j * 2.3, { collide: false, dynamic: true });
          tiles.push({ m, i, j });
        }
      const n = cols.length;
      a.anim((t) =>
        tiles.forEach((q) => {
          const idx = (((q.i * 3 + q.j * 5 + Math.floor(t * 3)) % n) + n) % n;
          q.m.color.set(cols[idx]).multiplyScalar(0.4 + 0.6 * ((Math.sin(t * 6 + q.i + q.j) + 1) / 2));
        }),
      );
      const ball = a.sphere(0.9, a.mat('#dde', { metal: true }), 0, a.h - 1.5, 0, { collide: false, dynamic: true });
      a.anim((t) => (ball.rotation.y = t));
      for (const sx of [-1, 1]) a.box(1.4, 2.4, 1.2, a.mat('#1a1a1a'), sx * (a.hw - 1.2), 1.2, a.hw - 1.2);
    },
  },
  {
    key: 'acquario', name: 'Stanza Acquario', height: 8,
    floor: ['sand', ['#c8b890', '#a89870']], wall: ['plain', ['#0a3a5a']], ceil: '#06243a', light: '#5ad0ff',
    props(a) {
      for (let k = 0; k < 6; k++) {
        const side = k % 4;
        const s = (k / 6 - 0.5) * 12;
        const [x, z, ry] = [[s, -a.hw + 0.05, 0], [s, a.hw - 0.05, Math.PI], [-a.hw + 0.05, s, Math.PI / 2], [a.hw - 0.05, s, -Math.PI / 2]][side];
        a.disc(1.3, a.glowMat('#4af0ff', 1.4), x, 3.5, z, ry);
      }
      for (let k = 0; k < 7; k++) {
        const p = a.place(0.8);
        if (p) a.cone(0.5, 1.5 + Math.random() * 2, a.mat(['#ff6a5a', '#ffa05a', '#d05aff'][k % 3]), p.x, 0.8, p.z);
      }
      // pesci che nuotano in cerchio
      const fish = [];
      for (let k = 0; k < 10; k++) {
        const f = a.cone(0.25, 0.8, a.mat(['#ffb020', '#ff5020', '#20d0ff'][k % 3], { emissive: 0.3 }), 0, 0, 0, { collide: false, dynamic: true });
        f.rotation.z = Math.PI / 2;
        fish.push({ f, r: 2 + Math.random() * 5, y: 2 + Math.random() * 4, s: 0.3 + Math.random() * 0.5, o: Math.random() * 6 });
      }
      a.anim((t) =>
        fish.forEach((q) => {
          const ang = t * q.s + q.o;
          const [fx, fz] = a.toWorld(Math.cos(ang) * q.r, Math.sin(ang) * q.r);
          q.f.position.set(fx, q.y + Math.sin(t + q.o) * 0.3, fz);
          q.f.rotation.y = -ang;
        }),
      );
      a.bubbles();
    },
  },
  {
    key: 'serra', name: 'Serra Tropicale', height: 11,
    floor: ['tiles', ['#6a8a5a', '#3a4a2a']], wall: ['grid', ['#bfe0c0', '#e8f4e8']], ceil: '#d8f0d8', light: '#b8ffb0',
    props(a) {
      for (let k = 0; k < 16; k++) {
        const p = a.place(0.9);
        if (!p) continue;
        const h = 2 + Math.random() * 5;
        a.cyl(0.15, 0.25, h, a.mat('#6a4a2a'), p.x, h / 2, p.z);
        for (let l = 0; l < 4; l++) {
          const leaf = a.cone(0.5, 2.8, a.mat('#3a8a3a'), p.x, h, p.z, { collide: false });
          leaf.rotation.set(1.1, (l * Math.PI) / 2 + Math.random(), 0);
        }
      }
      for (let k = 0; k < 10; k++) {
        const p = a.place(0.5);
        if (p) a.sphere(0.6 + Math.random() * 0.6, a.mat('#2a6a2a'), p.x, 0.5, p.z, { collide: false });
      }
    },
  },
  {
    key: 'ghiaccio', name: 'Camera di Ghiaccio', height: 8,
    floor: ['ice', ['#dff0ff', '#9ac8e8']], wall: ['ice', ['#b8dcf4', '#e8f6ff']], ceil: '#cfe8ff', light: '#aee0ff',
    props(a) {
      const ice = a.mat('#bfe6ff', { emissive: 0.15, transparent: 0.75 });
      for (let k = 0; k < 30; k++) {
        const x = (Math.random() - 0.5) * a.hw * 2;
        const z = (Math.random() - 0.5) * a.hw * 2;
        const c = a.cone(0.25, 1 + Math.random() * 2.5, ice, x, a.h - 1, z, { collide: false });
        c.rotation.x = Math.PI;
      }
      for (let k = 0; k < 4; k++) {
        const p = a.place(1.4);
        if (p) a.ico(1 + Math.random() * 0.8, ice, p.x, 1.4, p.z);
      }
      a.box(2.4, 0.8, 4.4, ice, 0, 0.4, a.hw - 3);
      a.snow();
    },
  },
  {
    key: 'egizio', name: 'Tempio Egizio', height: 10,
    floor: ['sand', ['#d8c090', '#b8a070']], wall: ['hieroglyph', ['#c8a86a', '#5a3a1a']], ceil: '#2a3a6a', light: '#ffc070',
    props(a) {
      const sand = a.mat('#c8a86a');
      for (const sx of [-1, 1]) for (const sz of [-1, 0, 1]) a.cyl(0.9, 1, a.h, sand, sx * 4.5, a.h / 2, sz * 5);
      a.box(1.4, 1, 3.4, a.mat('#d4a030', { metal: true }), 0, 0.5, 0);
      for (const sx of [-1, 1]) a.lamp(sx * 6.5, 3, a.hw - 0.8, '#ff9a3a', 0.45, 'fire');
    },
  },
  {
    key: 'spaziale', name: 'Suite Spaziale', height: 6,
    floor: ['grid', ['#e8ecf2', '#b8c4d4']], wall: ['plain', ['#f2f4f8']], ceil: '#e0e6f0', light: '#bfe8ff',
    props(a) {
      for (let k = 0; k < 4; k++) {
        const [x, z, ry] = [[-4, -a.hw + 0.05, 0], [4, -a.hw + 0.05, 0], [-a.hw + 0.05, 3, Math.PI / 2], [a.hw - 0.05, -3, -Math.PI / 2]][k];
        a.disc(1.6, a.starMat(), x, 3, z, ry);
      }
      for (let k = 0; k < 4; k++) {
        const p = a.place(1.2);
        if (p) a.sphere(0.9, a.mat(['#ff7a3a', '#f2f4f8', '#3a9aff'][k % 3]), p.x, 0.9, p.z).scale.set(1, 0.8, 1);
      }
      a.box(a.hw * 2, 0.08, 0.1, a.glowMat('#3af0ff', 2), 0, a.h - 0.3, -a.hw + 0.3, { collide: false });
      a.box(a.hw * 2, 0.08, 0.1, a.glowMat('#3af0ff', 2), 0, a.h - 0.3, a.hw - 0.3, { collide: false });
    },
  },
  {
    key: 'gotico', name: 'Cappella Gotica', height: 14,
    floor: ['stone', ['#6a6660', '#3a3834']], wall: ['stone', ['#7a746a', '#4a4640']], ceil: '#2a2830', light: '#c8b0ff',
    props(a) {
      const glassCols = ['#ff3a3a', '#3a6aff', '#ffd03a', '#3aff9a', '#c03aff'];
      for (let k = 0; k < 3; k++) {
        a.box(1.8, 6, 0.1, a.glowMat(glassCols[k], 1.2), (k - 1) * 5, 7, a.hw - 0.05, { collide: false });
        a.box(1.8, 6, 0.1, a.glowMat(glassCols[k + 2], 1.2), (k - 1) * 5, 7, -a.hw + 0.05, { collide: false });
      }
      for (let r = 0; r < 4; r++) for (const sx of [-1, 1]) a.box(4, 1, 0.8, a.mat('#3a2616'), sx * 3.4, 0.5, -4 + r * 2.4);
      for (let k = 0; k < 8; k++) a.lamp((k % 4 - 1.5) * 1.2, 1.1, a.hw - 2, '#ffcf6a', 0.18, 'fire');
    },
  },
  {
    key: 'cameretta', name: 'Cameretta dei Giganti', height: 12,
    floor: ['plain', ['#4a6ab0']], wall: ['stars', ['#f0e0a0', '#e0a040']], ceil: '#f8f0d0', light: '#fff0c0',
    props(a) {
      // giocattoli enormi: tu sei piccolissimo
      const cols = ['#e04040', '#40a0e0', '#f0c030', '#40c060'];
      for (let k = 0; k < 5; k++) {
        const p = a.place(2.2);
        if (p) a.box(3, 3, 3, a.mat(cols[k % 4]), p.x, 1.5, p.z, { rotY: Math.random() });
      }
      const p = a.place(3);
      if (p) a.sphere(2.4, a.mat('#e05a8a'), p.x, 2.4, p.z);
      // sedia gigante
      const wood = a.mat('#8a5a3a');
      for (const [x, z] of [[-3, -3], [3, -3], [-3, 3], [3, 3]]) a.box(0.6, 6, 0.6, wood, x - 2, 3, z + 1);
      a.box(7, 0.6, 7, wood, -2, 6.3, 1, { collide: false });
      a.box(7, 6, 0.6, wood, -2, 9.6, 4.3, { collide: false });
    },
  },
  {
    key: 'piscina', name: 'Piscina Deserta', height: 7,
    floor: ['tiles', ['#e8f0f0', '#b8c8c8']], wall: ['tiles', ['#dce8e8', '#a8b8b8']], ceil: '#e8f0f0', light: '#e0ffff',
    props(a) {
      const water = new THREE.MeshStandardMaterial({ color: '#3ab8d8', transparent: true, opacity: 0.7, roughness: 0.05, emissive: '#0a4a5a' });
      a.track(water);
      const w = a.box(9, 0.1, 9, water, 0, 0.06, 0, { collide: false, dynamic: true });
      a.anim((t) => (water.emissiveIntensity = 0.8 + Math.sin(t * 1.5) * 0.3));
      a.collider(0, 0, 9, 9);
      for (const sx of [-1, 1]) a.cyl(0.05, 0.05, 1.4, a.mat('#ccc', { metal: true }), sx * 4.3, 0.7, 4.6, { collide: false });
      void w;
    },
  },
  {
    key: 'rossa', name: 'Stanza Rossa', height: 6,
    floor: ['chevron', ['#e8e2d6', '#2a2622']], wall: ['curtains', ['#8a0a14', '#4a0008']], ceil: '#1a0004', light: '#ff4a5a',
    props(a) {
      for (const sx of [-1, 1]) a.box(1.4, 0.9, 1.4, a.mat('#5a1a1a'), sx * 3, 0.45, 0);
      a.cone(0.4, 1.4, a.mat('#e8e2d6'), 0, 0.7, 2.5);
      a.lamp(0, 1.8, 2.5, '#ffe0a0', 0.3);
    },
  },
  {
    key: 'pastello', name: 'Salotto Pastello', height: 5,
    floor: ['checker', ['#f2c8d8', '#c8f0e0']], wall: ['stripes', ['#fbe0ea', '#e0f6ee']], ceil: '#fff4f8', light: '#ffe0f0',
    props(a) {
      a.box(5, 1, 1.6, a.mat('#8ad8c0'), 0, 0.5, -a.hw + 1.4);
      a.box(2, 1.4, 1, a.mat('#e0a0b8'), 0, 0.7, a.hw - 1.4);
      a.box(1.6, 1, 0.1, a.glowMat('#c8fff0', 0.8), 0, 1.9, a.hw - 1.35, { collide: false });
      for (const sx of [-1, 1]) a.lamp(sx * 4, 1.8, -a.hw + 1.5, '#fff0c0', 0.35);
    },
  },
  {
    key: 'industriale', name: 'Sala delle Caldaie', height: 9,
    floor: ['grid', ['#3a3a3a', '#222']], wall: ['stone', ['#7a3a2a', '#3a2a22']], ceil: '#1a1a1a', light: '#ffae6a',
    props(a) {
      const pipe = a.mat('#8a6a4a', { metal: true });
      for (let k = 0; k < 5; k++) {
        const c = a.cyl(0.3, 0.3, a.hw * 2, pipe, 0, 5 + k * 0.8, -4 + k * 2, { collide: false });
        c.rotation.z = Math.PI / 2;
      }
      for (let k = 0; k < 2; k++) {
        const p = a.place(2);
        if (p) {
          a.cyl(1.6, 1.6, 4, a.mat('#4a4a4a', { metal: true }), p.x, 2, p.z);
          a.lamp(p.x, 1.5, p.z + 1.62, '#ff5a1a', 0.3, 'fire');
        }
      }
    },
  },
  {
    key: 'specchi', name: 'Sala degli Specchi', height: 7,
    floor: ['checker', ['#1a1a24', '#eaeaf0']], wall: ['plain', ['#c8d0e0']], ceil: '#101018', light: '#e0e8ff',
    props(a) {
      const mirror = a.mat('#e0e8f8', { metal: true, emissive: 0.1 });
      for (let k = 0; k < 7; k++) {
        const p = a.place(1.4);
        if (p) a.box(0.15, 4, 2.2, mirror, p.x, 2, p.z, { rotY: Math.random() * Math.PI });
      }
      a.chandelier(0, a.h - 1.6, 0, '#e8f0ff', 0.9);
    },
  },
];

export const LOBBY_STYLE = {
  key: 'atrio', name: 'Atrio', height: 34,
  floor: ['checker', ['#c8b89a', '#5a3a2a']], wall: ['planks', ['#6a4028', '#5a3420']], ceil: '#1a120c', light: '#ffc98a',
};

// Corridoi da albergo classico: moquette, carta da parati, applique.
export function corridorProps(a, lampColor = '#ffd08a', runner = '#6a1420') {
  const r = a.room;
  const w = r.maxX - r.minX;
  const d = r.maxZ - r.minZ;
  const alongX = w > d;
  const len = alongX ? w : d;
  const half = (alongX ? d : w) / 2 - 0.3;
  a.box(alongX ? len - 0.6 : 1.8, 0.02, alongX ? 1.8 : len - 0.6, a.mat(runner), 0, 0.012, 0, { collide: false });
  for (let t = -len / 2 + 3.5; t < len / 2 - 2; t += 7) {
    for (const side of [-1, 1]) {
      const x = alongX ? t : side * half;
      const z = alongX ? side * half : t;
      a.lamp(x, 3.1, z, lampColor, 0.1);
    }
  }
}

export const CORRIDOR_STYLE = {
  key: 'corridoio', name: 'Corridoio', height: 4.6, noDefaultLamp: true, noPopup: true,
  floor: ['damask', ['#4a1018', '#5a1a22']], wall: ['stripes', ['#e6d6b4', '#d8c49c']], ceil: '#efe4cc', light: '#ffd9a0',
  props: (a) => corridorProps(a),
};

export const BATH_STYLE = {
  key: 'bagno', name: 'Bagno della suite', height: 5.5, noDefaultLamp: true, noPopup: true,
  floor: ['tiles', ['#f0f2f2', '#b8c4c8']], wall: ['tiles', ['#e4ecee', '#c0ccd0']], ceil: '#f4f6f6', light: '#f0f8ff',
};

export const SUITE_STYLE = {
  key: 'suite', name: 'Suite 1313', height: 5.5, noDefaultLamp: true,
  floor: ['planks', ['#8a5a3a', '#7a4e32']], wall: ['stripes', ['#e8d8b8', '#dcc8a4']], ceil: '#f0e6d0', light: '#ffd9a0',
};

// Costruisce una stanza con pavimento, soffitto, muri e arredi.
export class RoomBuilder {
  constructor(scene, layout) {
    this.scene = scene;
    this.layout = layout;
    this.group = new THREE.Group();
    scene.add(this.group);
    this.dynamic = new THREE.Group();
    scene.add(this.dynamic);
    this.disposables = [];
    this.anims = [];
    this.matCache = new Map();
    this.texCache = new Map();
    this.colliders = []; // { minX, maxX, minZ, maxZ }
    this.particles = []; // emettitori di bolle/neve
    this.glowTex = this.track(glowTexture('rgba(255,255,255,1)'));
    this.boxGeo = this.track(new THREE.BoxGeometry(1, 1, 1));
  }

  track(o) {
    this.disposables.push(o);
    return o;
  }

  mat(color, { metal = false, emissive = 0, transparent = 0 } = {}) {
    const key = `${color}|${metal}|${emissive}|${transparent}`;
    if (!this.matCache.has(key)) {
      const m = new THREE.MeshStandardMaterial({
        color,
        roughness: metal ? 0.25 : 0.85,
        metalness: metal ? 0.8 : 0,
        emissive: emissive ? color : '#000',
        emissiveIntensity: emissive,
        transparent: !!transparent,
        opacity: transparent || 1,
      });
      this.matCache.set(key, this.track(m));
    }
    return this.matCache.get(key);
  }

  glowMat(color, intensity = 1) {
    const key = `glow|${color}|${intensity}`;
    if (!this.matCache.has(key)) {
      this.matCache.set(key, this.track(new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: intensity })));
    }
    return this.matCache.get(key);
  }

  texture(kind, colors) {
    const key = `${kind}|${colors.join(',')}`;
    if (!this.texCache.has(key)) this.texCache.set(key, this.track(PATTERNS[kind](colors)));
    return this.texCache.get(key);
  }

  texMat(kind, colors, repeat = null) {
    const key = `tex|${kind}|${colors.join(',')}|${repeat}`;
    if (!this.matCache.has(key)) {
      let map = this.texture(kind, colors);
      if (repeat) {
        map = this.track(map.clone());
        map.repeat.set(repeat[0], repeat[1]);
        map.needsUpdate = true;
      }
      this.matCache.set(key, this.track(new THREE.MeshStandardMaterial({ map, roughness: 0.85 })));
    }
    return this.matCache.get(key);
  }

  addCollider(minX, maxX, minZ, maxZ) {
    this.colliders.push({ minX, maxX, minZ, maxZ });
    this.layout.markRect(minX, maxX, minZ, maxZ, 0.3);
  }

  mesh(geo, material, x, y, z, parent = this.group) {
    const m = new THREE.Mesh(geo, material);
    m.position.set(x, y, z);
    parent.add(m);
    return m;
  }

  // ---------- Costruzione di una stanza ----------
  build(room, style) {
    room.style = style;
    room.height = style.height;
    const w = room.maxX - room.minX;
    const d = room.maxZ - room.minZ;
    const cx = room.cx;
    const cz = room.cz;

    const floorMat = this.texMat(style.floor[0], style.floor[1], [w / 4.5, d / 4.5]);
    // un ambiente dentro un altro (il bagno nella suite) ha il pavimento appena più alto
    const floor = this.mesh(this.track(new THREE.PlaneGeometry(w, d)), floorMat, cx, room.parent !== undefined ? 0.015 : 0, cz);
    floor.rotation.x = -Math.PI / 2;
    const ceil = this.mesh(this.track(new THREE.PlaneGeometry(w, d)), this.mat(style.ceil), cx, style.height, cz);
    ceil.rotation.x = Math.PI / 2;

    // muri: un box per tratto, con la texture ripetuta in base alla lunghezza
    const wallTexKey = style.wall;
    for (const wall of this.layout.walls.filter((q) => q.room === room.id)) {
      const len = Math.max(wall.maxX - wall.minX, wall.maxZ - wall.minZ);
      const y0 = wall.lintel ? wall.y0 : 0;
      const h = style.height - y0;
      if (h <= 0.01) continue;
      const mat = this.texMat(wallTexKey[0], wallTexKey[1], [Math.max(1, Math.round(len / 4)), Math.max(1, Math.round(h / 5))]);
      const m = this.mesh(this.boxGeo, mat, (wall.minX + wall.maxX) / 2, y0 + h / 2, (wall.minZ + wall.maxZ) / 2);
      m.scale.set(wall.maxX - wall.minX, h, wall.maxZ - wall.minZ);
      if (!wall.lintel) this.colliders.push(wall);
      // stipiti delle porte
      if (wall.lintel && wall.y0 < 6) {
        const frame = this.mat('#3a2616');
        const alongX = wall.maxX - wall.minX > wall.maxZ - wall.minZ;
        const fb = this.mesh(this.boxGeo, frame, (wall.minX + wall.maxX) / 2, y0 - 0.15, (wall.minZ + wall.maxZ) / 2);
        fb.scale.set(alongX ? len : 0.7, 0.3, alongX ? 0.7 : len);
      }
    }

    const api = this.api(room, style);
    if (style.props) style.props(api);
    if (!style.noDefaultLamp && style.props) {
      // un lampadario a sfera per dare luce a ogni stanza
      api.glowSprite(style.light, 0, style.height - 0.8, 0, 6, 0.35);
    }
    return api;
  }

  // Sistema di riferimento della stanza. Le stanze normali sono "disegnate"
  // in uno spazio virtuale quadrato (±8.2 m) con la porta sempre a sud (-z):
  // qui lo si adatta alla stanza vera, di qualunque misura e orientamento,
  // così gli arredi non finiscono mai davanti alla porta.
  frameFor(room) {
    const w = room.maxX - room.minX;
    const d = room.maxZ - room.minZ;
    if (room.kind !== 'room') {
      return { theta: 0, sx: 1, sz: 1, hw: Math.min(w, d) / 2 - WALL_T - 0.3 };
    }
    const door = this.layout.doorways.find((q) => q.room === room.id && q.kind === 'door');
    const theta = { S: 0, N: Math.PI, W: Math.PI / 2, E: -Math.PI / 2 }[door?.dir ?? 'S'];
    const turned = Math.abs(Math.sin(theta)) > 0.5;
    const hx = (turned ? d : w) / 2;
    const hz = (turned ? w : d) / 2;
    return { theta, sx: Math.max(0.3, (hx - 0.8) / 8.2), sz: Math.max(0.3, (hz - 0.8) / 8.2), hw: 8.2 };
  }

  api(room, style) {
    const B = this;
    const placed = [];
    const doorways = this.layout.doorways.filter((d) => d.room === room.id);
    const { theta, sx, sz, hw } = this.frameFor(room);
    const cos = Math.cos(theta);
    const sin = Math.sin(theta);
    const turned = Math.abs(sin) > 0.5;
    // da coordinate della stanza a coordinate del mondo
    const W = (x, z) => {
      const lx = x * sx;
      const lz = z * sz;
      return [room.cx + lx * cos + lz * sin, room.cz - lx * sin + lz * cos];
    };
    const boxCollider = (x, z, w, d) => {
      const [wx, wz] = W(x, z);
      const ex = (turned ? d : w) / 2;
      const ez = (turned ? w : d) / 2;
      B.addCollider(wx - ex, wx + ex, wz - ez, wz + ez);
    };
    const a = {
      room,
      cx: room.cx,
      cz: room.cz,
      h: style.height,
      hw,
      theta,
      toWorld: (x, z) => W(x, z),
      track: (o) => B.track(o),
      mat: (...args) => B.mat(...args),
      glowMat: (...args) => B.glowMat(...args),
      texMat: (...args) => B.texMat(...args),
      anim: (fn) => B.anims.push(fn),
      dynamicAdd: (o) => B.dynamic.add(o),
      collider: (x, z, w, d) => boxCollider(x, z, w, d),
      // posizione libera lontana dalle porte e dagli altri arredi
      place(r, tries = 40) {
        for (let i = 0; i < tries; i++) {
          const x = (Math.random() * 2 - 1) * (hw - r);
          const z = (Math.random() * 2 - 1) * (hw - r);
          const [wx, wz] = W(x, z);
          if (doorways.some((q) => Math.hypot(q.x - wx, q.z - wz) < r + 2.5)) continue;
          if (placed.some((p) => Math.hypot(p.x - x, p.z - z) < p.r + r + 0.6)) continue;
          placed.push({ x, z, r });
          return { x, z };
        }
        return null;
      },
      box(w, h, d, material, x, y, z, { collide = true, rotY = 0, dynamic = false } = {}) {
        const [wx, wz] = W(x, z);
        const m = B.mesh(B.boxGeo, material, wx, y, wz, dynamic ? B.dynamic : B.group);
        m.scale.set(w, h, d);
        m.rotation.y = rotY + theta;
        if (collide && y - h / 2 < 1.5) {
          if (rotY) {
            const ext = (Math.max(w, d) / 2) * 0.8;
            B.addCollider(wx - ext, wx + ext, wz - ext, wz + ext);
          } else boxCollider(x, z, w, d);
          placed.push({ x, z, r: Math.max(w, d) / 2 });
        }
        return m;
      },
      cyl(rt, rb, h, material, x, y, z, { collide = true, dynamic = false } = {}) {
        const [wx, wz] = W(x, z);
        const m = B.mesh(B.track(new THREE.CylinderGeometry(rt, rb, h, 14)), material, wx, y, wz, dynamic ? B.dynamic : B.group);
        m.rotation.y = theta;
        if (collide && y - h / 2 < 1.5) {
          const r = Math.max(rt, rb);
          B.addCollider(wx - r, wx + r, wz - r, wz + r);
          placed.push({ x, z, r });
        }
        return m;
      },
      sphere(r, material, x, y, z, { collide = true, dynamic = false } = {}) {
        const [wx, wz] = W(x, z);
        const m = B.mesh(B.track(new THREE.SphereGeometry(r, 18, 12)), material, wx, y, wz, dynamic ? B.dynamic : B.group);
        if (collide && y - r < 1.5) {
          B.addCollider(wx - r * 0.8, wx + r * 0.8, wz - r * 0.8, wz + r * 0.8);
          placed.push({ x, z, r });
        }
        return m;
      },
      ico(r, material, x, y, z) {
        const [wx, wz] = W(x, z);
        const m = B.mesh(B.track(new THREE.IcosahedronGeometry(r, 0)), material, wx, y, wz);
        B.addCollider(wx - r * 0.7, wx + r * 0.7, wz - r * 0.7, wz + r * 0.7);
        return m;
      },
      cone(r, h, material, x, y, z, { collide = true, dynamic = false } = {}) {
        const [wx, wz] = W(x, z);
        const m = B.mesh(B.track(new THREE.ConeGeometry(r, h, 10)), material, wx, y, wz, dynamic ? B.dynamic : B.group);
        if (collide && y - h / 2 < 1.5 && !dynamic) {
          B.addCollider(wx - r, wx + r, wz - r, wz + r);
          placed.push({ x, z, r });
        }
        return m;
      },
      disc(r, material, x, y, z, rotY) {
        const [wx, wz] = W(x, z);
        const m = B.mesh(B.track(new THREE.CircleGeometry(r, 32)), material, wx, y, wz);
        m.rotation.y = rotY + theta;
        return m;
      },
      starMat() {
        return B.starMaterial();
      },
      glowSprite(color, x, y, z, size = 3, opacity = 0.8) {
        const [wx, wz] = W(x, z);
        const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: B.glowTex, color, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity }));
        B.track(s.material);
        s.position.set(wx, y, wz);
        s.scale.set(size, size, 1);
        B.dynamic.add(s);
        return s;
      },
      lamp(x, y, z, color, r = 0.3, kind = 'bulb') {
        const m = a.sphere(r, B.glowMat(color, kind === 'fire' ? 3 : 2), x, y, z, { collide: false });
        if (kind === 'paper') m.scale.set(1, 1.3, 1);
        const s = a.glowSprite(color, x, y, z, r * 9, 0.55);
        if (kind === 'fire') a.anim((t) => s.scale.setScalar(r * (8 + Math.sin(t * 13 + x) * 1.2)));
        return m;
      },
      chandelier(x, y, z, color, size = 1) {
        const [wx, wz] = W(x, z);
        const gold = B.mat('#c9a040', { metal: true });
        const ring = B.mesh(B.track(new THREE.TorusGeometry(1.6 * size, 0.08 * size, 8, 32)), gold, wx, y, wz);
        ring.rotation.x = Math.PI / 2;
        const rod = B.mesh(B.track(new THREE.CylinderGeometry(0.04, 0.04, style.height - y, 6)), gold, wx, (style.height + y) / 2, wz);
        void rod;
        const bulb = B.glowMat(color, 2);
        for (let k = 0; k < 8; k++) {
          const ang = (k / 8) * Math.PI * 2;
          B.mesh(B.track(new THREE.SphereGeometry(0.14 * size, 10, 8)), bulb, wx + Math.cos(ang) * 1.6 * size, y + 0.15, wz + Math.sin(ang) * 1.6 * size);
        }
        a.glowSprite(color, x, y, z, 7 * size, 0.5);
      },
      bubbles() {
        B.particles.push({ kind: 'bubbles', room });
      },
      snow() {
        B.particles.push({ kind: 'snow', room });
      },
    };
    return a;
  }

  starMaterial() {
    if (!this.starMat) {
      const c = document.createElement('canvas');
      c.width = c.height = 128;
      const g = c.getContext('2d');
      g.fillStyle = '#050818';
      g.fillRect(0, 0, 128, 128);
      for (let i = 0; i < 80; i++) {
        g.fillStyle = `rgba(255,255,255,${0.3 + Math.random() * 0.7})`;
        g.fillRect(Math.random() * 128, Math.random() * 128, 1.5, 1.5);
      }
      g.fillStyle = '#c86a3a';
      g.beginPath();
      g.arc(90, 40, 14, 0, Math.PI * 2);
      g.fill();
      const t = this.track(new THREE.CanvasTexture(c));
      t.colorSpace = THREE.SRGBColorSpace;
      this.starMat = this.track(new THREE.MeshBasicMaterial({ map: t }));
    }
    return this.starMat;
  }

  // Targhe con i numeri sopra le porte (verso l'interno della stanza).
  numberPlates(numbers) {
    const plateGeo = this.track(new THREE.PlaneGeometry(1.6, 0.55));
    const matFor = new Map();
    for (const d of this.layout.doorways) {
      if (d.entrance || d.other < 0) continue;
      const num = numbers[d.other];
      if (!num) continue;
      if (!matFor.has(num)) {
        const special = num === '1313';
        const t = this.track(textTexture(num, { width: 256, height: 88, font: '700 64px Cormorant Garamond, serif', color: special ? '#ffe7a0' : '#f4ead8', bg: special ? '#5a3a10' : '#2a1a10' }));
        matFor.set(num, this.track(new THREE.MeshStandardMaterial({ map: t, emissive: '#ffffff', emissiveMap: t, emissiveIntensity: special ? 1.2 : 0.35 })));
      }
      const m = new THREE.Mesh(plateGeo, matFor.get(num));
      const off = 0.02;
      const rot = { W: Math.PI / 2, E: -Math.PI / 2, S: 0, N: Math.PI }[d.dir];
      const nx = { W: off, E: -off, S: 0, N: 0 }[d.dir];
      const nz = { W: 0, E: 0, S: off, N: -off }[d.dir];
      m.position.set(d.x + nx, DOOR_H + 0.55, d.z + nz);
      m.rotation.y = rot;
      this.dynamic.add(m);
    }
  }

  // Unisce la geometria statica per materiale: molte meno chiamate di disegno.
  mergeStatic() {
    this.group.updateMatrixWorld(true);
    const byMat = new Map();
    this.group.traverse((o) => {
      if (!o.isMesh) return;
      if (!byMat.has(o.material)) byMat.set(o.material, []);
      let g = o.geometry.clone();
      g.applyMatrix4(o.matrixWorld);
      if (g.index) g = g.toNonIndexed();
      for (const name of Object.keys(g.attributes)) if (!['position', 'normal', 'uv'].includes(name)) g.deleteAttribute(name);
      byMat.get(o.material).push(g);
    });
    const merged = new THREE.Group();
    for (const [material, geos] of byMat) {
      const g = mergeGeometries(geos, false);
      geos.forEach((q) => q.dispose());
      if (!g) continue;
      this.track(g);
      merged.add(new THREE.Mesh(g, material));
    }
    this.group.removeFromParent();
    this.group = merged;
    this.scene.add(merged);
  }

  update(t, dt) {
    for (const fn of this.anims) fn(t, dt);
  }

  dispose() {
    this.disposables.forEach((d) => d.dispose());
    this.group.removeFromParent();
    this.dynamic.removeFromParent();
  }
}

export { DOOR_W };
