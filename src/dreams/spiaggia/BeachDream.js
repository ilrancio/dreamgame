import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { WalkScene, FRIEND } from '../../core/walkscene.js';
import { unlockPlace } from '../../core/places.js';
import { textTexture, glowTexture } from '../../core/textures.js';
import { mulberry32 } from '../../core/noise.js';

// La Spiaggia d'Inverno: uno stabilimento balneare fuori stagione. Nebbia,
// ombrelloni chiusi in file perfette, il bar con la serranda abbassata, la
// torretta del bagnino vuota, una piscina vuota dove si può scendere.
// Si arriva in aereo, si riparte con la navetta per l'aeroporto.
// Coordinate: x da -60 a 60, z da -40 (la strada) a 34 (la riva); il mare oltre.
const SHORE = 30;
const POOL = { minX: 18, maxX: 36, minZ: -26, maxZ: -12, depth: 1.8, ramp: 4 };

const SIT_LINES = [
  [FRIEND, 'Il mare d\'inverno è più bello. Non deve fingere niente.'],
  [null, 'Le onde arrivano piano, sempre uguali. Il rumore copre tutto il resto.'],
  [FRIEND, 'Chissà dove sono finiti tutti. Forse è solo troppo presto. O troppo tardi.'],
  [null, 'Un gabbiano passa basso, e non dice niente.'],
  [FRIEND, 'Potremmo tornarci d\'estate. Ma non sarebbe la stessa spiaggia.'],
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
  return t;
}

export class BeachDream extends WalkScene {
  constructor(ctx) {
    const day = ctx.progress.hotel?.timeOfDay === 'day';
    const bg = day ? '#b8c0c4' : '#1a2028';
    super(ctx, { background: bg, far: 500, bounds: { minX: -60, maxX: 60, minZ: -40, maxZ: SHORE + 3 } });
    this.saved = ctx.progress.spiaggia || {};
    this.scene.fog = new THREE.Fog(bg, 18, day ? 150 : 110);
    this.scene.add(new THREE.HemisphereLight(day ? '#e4eaee' : '#8a98b8', '#8a7a60', day ? 1.4 : 1.1));
    const sun = new THREE.DirectionalLight(day ? '#f4f0e8' : '#a8b8d8', day ? 0.7 : 0.3);
    sun.position.set(-20, 30, 40);
    this.scene.add(sun);
    this.build(day);

    this.spawn = ctx.spawn || 'arrivo';
    ctx.spawn = null;
    if (this.spawn === 'shortcut') this.place(this.cabin13.x, this.cabin13.z + 1.6, 0);
    else this.place(0, -30, 0);
    this.firstVisit = unlockPlace(ctx, 'spiaggia');

    const { ui, audio } = ctx;
    audio.pad('spiaggia', [146.8, 174.6, 220, 293.7], { vol: 0.022, cutoff: 700 });
    audio.loop('onde', true, { freq: 500, q: 0.3, vol: 0.09, type: 'lowpass' });
    this.gullT = 4;
    this.waveT = 0;
    ui.objective(this.saved.sat ? 'La navetta per l\'aeroporto passa sempre. Quando vuoi.' : 'Una spiaggia d\'inverno. Nessuno in giro. Siediti a guardare il mare.');
    if (this.spawn === 'arrivo') {
      this.later(1.3, () => ui.subtitle(FRIEND, this.firstVisit ? 'Siamo atterrati... e siamo già alla fermata della navetta. Dov\'è finito l\'aereo?' : 'Di nuovo qui. Il mare non è cambiato di un millimetro.', 3.8));
      if (this.firstVisit) this.later(5.6, () => ui.subtitle(FRIEND, 'Una spiaggia d\'inverno. Gli ombrelloni sono tutti chiusi. Non c\'è nessuno.', 3.6));
    }
    if (this.firstVisit) {
      this.later(14, () => {
        ui.popup('Una nuova porta: Spiaggia d\'Inverno');
        audio.chime(784, 0.12);
        ui.subtitle(FRIEND, 'Una delle cabine ha il numero 1313. Ma dai.', 3);
      });
    }
  }

  save() {
    this.ctx.progress.spiaggia = this.saved;
    this.ctx.saveProgress(this.ctx.progress);
  }

  // la sabbia scende verso la riva; la piscina vuota è un buco nel cemento
  groundAt(x, z) {
    const P = POOL;
    if (x > P.minX && x < P.maxX && z > P.minZ && z < P.maxZ) {
      // la rampa del lato basso, per scendere e risalire
      if (x < P.minX + P.ramp) return -P.depth * ((x - P.minX) / P.ramp);
      return -P.depth;
    }
    if (z > SHORE - 6) return -Math.min(1.6, (z - (SHORE - 6)) * 0.07);
    return 0;
  }

  build(day) {
    const disposables = [];
    const track = (o) => (disposables.push(o), o);
    this.disposables = disposables;
    const S = this.scene;
    const staticGroup = new THREE.Group();
    const dyn = new THREE.Group();
    S.add(dyn);
    this.dyn = dyn;
    const rand = mulberry32(47);
    const matCache = new Map();
    const mat = (color, o = {}) => {
      const key = color + JSON.stringify(o);
      if (!matCache.has(key)) matCache.set(key, track(new THREE.MeshStandardMaterial({ color, roughness: 0.9, ...o })));
      return matCache.get(key);
    };
    const boxGeo = track(new THREE.BoxGeometry(1, 1, 1));
    const box = (w, h, d, m, x, y, z, { col = false, low = false, ry = 0, parent = staticGroup } = {}) => {
      const o = new THREE.Mesh(boxGeo, m);
      o.scale.set(w, h, d);
      o.position.set(x, y, z);
      o.rotation.y = ry;
      parent.add(o);
      if (col) this.colliders.push({ minX: x - w / 2, maxX: x + w / 2, minZ: z - d / 2, maxZ: z + d / 2, low });
      return o;
    };
    const mesh = (geo, m, x, y, z, parent = staticGroup) => {
      const o = new THREE.Mesh(track(geo), m);
      o.position.set(x, y, z);
      parent.add(o);
      return o;
    };

    // ---------- La sabbia (con la discesa verso la riva) e il mare ----------
    let sandGeo = new THREE.PlaneGeometry(180, 110, 90, 55);
    sandGeo.rotateX(-Math.PI / 2);
    const pos = sandGeo.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const z = pos.getZ(i) - 5;
      pos.setZ(i, z);
      const inPool = x > POOL.minX && x < POOL.maxX && z > POOL.minZ && z < POOL.maxZ;
      pos.setY(i, inPool ? 0 : z > SHORE - 6 ? -Math.min(1.6, (z - (SHORE - 6)) * 0.07) : Math.sin(x * 0.3) * 0.05 + Math.sin(z * 0.5) * 0.04);
    }
    // il buco della piscina: via i triangoli della sabbia che ci cadono dentro
    {
      const ng = sandGeo.toNonIndexed();
      const a = ng.attributes.position.array;
      const ua = ng.attributes.uv.array;
      const keepP = [];
      const keepU = [];
      for (let t = 0; t < a.length / 9; t++) {
        const cx = (a[t * 9] + a[t * 9 + 3] + a[t * 9 + 6]) / 3;
        const cz = (a[t * 9 + 2] + a[t * 9 + 5] + a[t * 9 + 8]) / 3;
        if (cx > POOL.minX && cx < POOL.maxX && cz > POOL.minZ && cz < POOL.maxZ) continue;
        for (let k = 0; k < 9; k++) keepP.push(a[t * 9 + k]);
        for (let k = 0; k < 6; k++) keepU.push(ua[t * 6 + k]);
      }
      sandGeo.dispose();
      sandGeo = new THREE.BufferGeometry();
      sandGeo.setAttribute('position', new THREE.Float32BufferAttribute(keepP, 3));
      sandGeo.setAttribute('uv', new THREE.Float32BufferAttribute(keepU, 2));
      ng.dispose();
      track(sandGeo);
    }
    sandGeo.computeVertexNormals();
    const sand = new THREE.Mesh(sandGeo, track(new THREE.MeshStandardMaterial({ map: track(canvasTex(128, 128, (g, w) => {
      g.fillStyle = '#c8b898';
      g.fillRect(0, 0, w, w);
      for (let i = 0; i < 1400; i++) {
        g.fillStyle = `rgba(${90 + Math.random() * 60},${80 + Math.random() * 50},60,${Math.random() * 0.25})`;
        g.fillRect(Math.random() * w, Math.random() * w, 2, 2);
      }
    }, [30, 18])), roughness: 1 })));
    S.add(sand);
    this.sand = sand;
    // il mare: onde lente, grigio-verde
    const seaGeo = track(new THREE.PlaneGeometry(600, 400, 120, 60));
    seaGeo.rotateX(-Math.PI / 2);
    this.seaGeo = seaGeo;
    this.seaBase = Float32Array.from(seaGeo.attributes.position.array);
    const sea = new THREE.Mesh(seaGeo, track(new THREE.MeshStandardMaterial({ color: day ? '#6a8a8a' : '#2a3a48', roughness: 0.35, metalness: 0.2, transparent: true, opacity: 0.95 })));
    sea.position.set(0, -0.55, SHORE + 200);
    S.add(sea);
    this.foam = mesh(new THREE.PlaneGeometry(180, 1.6), track(new THREE.MeshBasicMaterial({ color: '#e8ecee', transparent: true, opacity: 0.55, depthWrite: false })), 0, -0.4, SHORE + 0.5, dyn);
    this.foam.rotation.x = -Math.PI / 2;

    // ---------- La passerella di legno, dalla fermata alla riva ----------
    const plank = mat('#8a6a4a');
    for (let z = -32; z < SHORE - 4; z += 1.2) box(2.4, 0.1, 1, plank, 0, 0.05, z);

    // ---------- Gli ombrelloni, chiusi, in file perfette ----------
    const stripes = [mat('#c84a4a'), mat('#3a6aa8'), mat('#e8c840'), mat('#3a8a6a')];
    const pole = mat('#e8e4dc');
    for (let r = 0; r < 4; r++) {
      for (let c = -6; c <= 6; c++) {
        if (c === 0) continue;
        const x = c * 6;
        const z = r * 6;
        mesh(new THREE.CylinderGeometry(0.05, 0.05, 2.6, 6), pole, x, 1.3, z);
        mesh(new THREE.ConeGeometry(0.35, 1.8, 8), stripes[(r + Math.abs(c)) % 4], x, 2.1, z).rotation.x = Math.PI;
        this.colliders.push({ minX: x - 0.15, maxX: x + 0.15, minZ: z - 0.15, maxZ: z + 0.15, low: true });
        // qualche lettino rimasto fuori, gli altri impilati
        if (rand() < 0.2) {
          box(0.7, 0.12, 1.9, mat('#f0ece4'), x + 1.1, 0.35, z + 0.3, { col: true, low: true });
          box(0.7, 0.5, 0.1, mat('#f0ece4'), x + 1.1, 0.55, z - 0.6);
        }
      }
    }
    // pile di lettini accanto al bar
    for (let k = 0; k < 3; k++) for (let h = 0; h < 6; h++) box(0.7, 0.1, 1.9, mat('#f0ece4'), -30 + k * 1.1, 0.1 + h * 0.13, -6, { col: h === 0, low: true });
    // un lettino libero davanti al mare, per sedersi
    this.lounger = new THREE.Vector3(6, 0, 25);
    box(0.7, 0.12, 1.9, mat('#e8d8c0'), this.lounger.x, 0.32, this.lounger.z, { col: true, low: true });
    box(0.7, 0.6, 0.1, mat('#e8d8c0'), this.lounger.x, 0.6, this.lounger.z - 0.95);
    box(0.75, 0.1, 1.9, mat('#e8d8c0'), this.lounger.x + 1.1, 0.32, this.lounger.z, { col: true, low: true });

    // ---------- La torretta del bagnino, vuota, con la bandiera rossa ----------
    const tw = { x: 26, z: 18 };
    for (const [dx, dz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) box(0.15, 3.2, 0.15, mat('#e8e4dc'), tw.x + dx * 0.9, 1.6, tw.z + dz * 0.9);
    box(2.2, 0.15, 2.2, mat('#c84a3a'), tw.x, 3.2, tw.z);
    box(2.2, 0.8, 0.08, mat('#c84a3a'), tw.x, 3.7, tw.z + 1.1);
    box(1, 0.6, 0.08, mat('#f0ece4'), tw.x, 3.6, tw.z + 1.16);
    this.colliders.push({ minX: tw.x - 1.1, maxX: tw.x + 1.1, minZ: tw.z - 1.1, maxZ: tw.z + 1.1 });
    mesh(new THREE.CylinderGeometry(0.04, 0.04, 3, 6), mat('#a8a8a8'), tw.x + 1.2, 4.7, tw.z);
    this.flag = mesh(new THREE.PlaneGeometry(1.1, 0.7, 8, 1), track(new THREE.MeshStandardMaterial({ color: '#d82a2a', side: THREE.DoubleSide })), tw.x + 1.75, 5.8, tw.z, dyn);
    this.flagBase = Float32Array.from(this.flag.geometry.attributes.position.array);

    // ---------- Il bar, chiuso: serranda, sedie impilate, l'insegna spenta ----------
    const bar = { x: -22, z: -14 };
    box(12, 3.4, 6, mat('#e8dcc4'), bar.x, 1.7, bar.z, { col: true });
    box(13, 0.3, 7.5, mat('#4a8aa8'), bar.x, 3.55, bar.z + 0.6);
    box(8, 2.4, 0.1, track(new THREE.MeshStandardMaterial({ map: track(canvasTex(64, 64, (g) => {
      g.fillStyle = '#8a8e94';
      g.fillRect(0, 0, 64, 64);
      for (let y = 0; y < 64; y += 8) {
        g.fillStyle = '#6a6e74';
        g.fillRect(0, y + 6, 64, 2);
      }
    }, [3, 2])), metalness: 0.5, roughness: 0.5 })), bar.x, 1.3, bar.z + 3.06);
    const signTex = track(textTexture('BAR SOLE', { width: 512, height: 96, font: '800 64px Inter, sans-serif', color: '#f4e4a0', bg: '#2a6a8a' }));
    this.barSignMat = track(new THREE.MeshStandardMaterial({ map: signTex, emissive: '#ffffff', emissiveMap: signTex, emissiveIntensity: 0.05 }));
    mesh(new THREE.PlaneGeometry(5, 0.95), this.barSignMat, bar.x, 3.05, bar.z + 3.12, dyn);
    const closed = track(textTexture('CHIUSO PER STAGIONE', { width: 512, height: 64, font: '700 30px Inter, sans-serif', color: '#3a3a3a', bg: '#f0ece0' }));
    mesh(new THREE.PlaneGeometry(1.8, 0.24), track(new THREE.MeshBasicMaterial({ map: closed })), bar.x + 2.2, 1.6, bar.z + 3.13, dyn);
    for (let k = 0; k < 4; k++) for (let h = 0; h < 4; h++) box(0.5, 0.45, 0.5, mat('#e8e8e8'), bar.x - 4 + k * 0.8, 0.23 + h * 0.18, bar.z + 4.2, { col: h === 0, low: true });
    this.bar = new THREE.Vector3(bar.x, 0, bar.z + 4.6);

    // ---------- La piscina vuota ----------
    const P = POOL;
    const tile = track(new THREE.MeshStandardMaterial({ map: track(canvasTex(64, 64, (g) => {
      g.fillStyle = '#a8d4e0';
      g.fillRect(0, 0, 64, 64);
      g.strokeStyle = '#e8f4f8';
      g.lineWidth = 2;
      for (let i = 0; i <= 64; i += 16) {
        g.beginPath();
        g.moveTo(i, 0);
        g.lineTo(i, 64);
        g.moveTo(0, i);
        g.lineTo(64, i);
        g.stroke();
      }
    }, [8, 3])), roughness: 0.6 }));
    const pw = P.maxX - P.minX;
    const pd = P.maxZ - P.minZ;
    const pcx = (P.minX + P.maxX) / 2;
    const pcz = (P.minZ + P.maxZ) / 2;
    const deep = mesh(new THREE.PlaneGeometry(pw - P.ramp, pd), tile, pcx + P.ramp / 2, -P.depth + 0.01, pcz);
    deep.rotation.x = -Math.PI / 2;
    // la rampa del lato basso: inclinata direttamente nella geometria
    const rampGeo = new THREE.PlaneGeometry(Math.hypot(P.ramp, P.depth), pd);
    rampGeo.rotateX(-Math.PI / 2);
    rampGeo.rotateZ(-Math.atan2(P.depth, P.ramp));
    mesh(rampGeo, tile, P.minX + P.ramp / 2, -P.depth / 2 + 0.01, pcz);
    for (const [w, x, z, ry] of [[pw, pcx, P.minZ, 0], [pw, pcx, P.maxZ, Math.PI], [pd, P.maxX, pcz, -Math.PI / 2]]) {
      const wallM = mesh(new THREE.PlaneGeometry(w, P.depth), tile, x, -P.depth / 2, z);
      wallM.rotation.y = ry;
    }
    // il bordo di cemento intorno, la scaletta, la scritta sul fondo
    const rim = mat('#e0dcd4');
    box(pw + 2, 0.12, 1, rim, pcx, 0.06, P.minZ - 0.5);
    box(pw + 2, 0.12, 1, rim, pcx, 0.06, P.maxZ + 0.5);
    box(1, 0.12, pd, rim, P.maxX + 0.5, 0.06, pcz);
    for (const dz of [-0.35, 0.35]) mesh(new THREE.TorusGeometry(0.35, 0.03, 6, 12, Math.PI), mat('#c8ccd2', { metalness: 0.8, roughness: 0.3 }), P.maxX - 0.35, 0.3, P.maxZ - 3 + dz).rotation.y = Math.PI / 2;
    const depthTex = track(textTexture('PROFONDITÀ 1,80', { width: 256, height: 48, font: '700 30px Inter, sans-serif', color: '#2a4a8a', bg: 'rgba(0,0,0,0)' }));
    const dt = mesh(new THREE.PlaneGeometry(3, 0.56), track(new THREE.MeshBasicMaterial({ map: depthTex, transparent: true })), P.maxX - 3, -P.depth + 0.03, pcz, dyn);
    dt.rotation.set(-Math.PI / 2, 0, -Math.PI / 2);
    for (let i = 0; i < 14; i++) {
      const leafM = mesh(new THREE.CircleGeometry(0.12, 5), mat('#8a6a2a'), pcx + (rand() - 0.3) * pw * 0.7, -P.depth + 0.02, pcz + (rand() - 0.5) * pd * 0.8);
      leafM.rotation.x = -Math.PI / 2;
    }
    this.poolCenter = new THREE.Vector3(pcx + 3, -P.depth, pcz);

    // ---------- Le cabine colorate; una ha il numero 1313 ----------
    const cabCols = ['#e84a4a', '#4a8ae8', '#e8c84a', '#4ab88a', '#e88a4a', '#8a6ae8'];
    for (let k = 0; k < 6; k++) {
      const x = -50 + k * 3.2;
      const z = -24;
      box(2.8, 2.6, 2.4, mat('#f0ece4'), x, 1.3, z, { col: true });
      box(1.2, 2.1, 0.08, mat(cabCols[k]), x, 1.05, z + 1.22);
      box(3, 0.15, 2.8, mat(cabCols[k]), x, 2.7, z);
    }
    this.cabin13 = { x: -50 + 4 * 3.2, z: -24 + 1.3 };
    const numTex = track(textTexture('1313', { width: 128, height: 48, font: '700 34px Cormorant Garamond, serif', color: '#2a1a0a', bg: '#d8b860' }));
    mesh(new THREE.PlaneGeometry(0.4, 0.13), track(new THREE.MeshBasicMaterial({ map: numTex })), this.cabin13.x, 1.85, this.cabin13.z - 0.04, dyn);
    const glow = track(glowTexture('rgba(255,255,255,1)'));
    const g13 = new THREE.Sprite(track(new THREE.SpriteMaterial({ map: glow, color: '#ffd890', blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0.8 })));
    g13.position.set(this.cabin13.x, 0.15, this.cabin13.z + 0.3);
    g13.scale.set(2, 0.7, 1);
    dyn.add(g13);
    this.cabin13Spot = new THREE.Vector3(this.cabin13.x, 0, this.cabin13.z + 1.2);

    // ---------- La fermata della navetta ----------
    const st = { x: 0, z: -37 };
    box(4, 0.1, 1.8, mat('#3a3a42'), st.x, 2.6, st.z - 0.4);
    for (const dx of [-1.9, 1.9]) box(0.1, 2.6, 0.1, mat('#3a3a42'), st.x + dx, 1.3, st.z - 1.2);
    box(4, 2.4, 0.06, track(new THREE.MeshStandardMaterial({ color: '#c8d4dc', transparent: true, opacity: 0.35 })), st.x, 1.3, st.z - 1.25);
    box(3, 0.1, 0.5, mat('#8a6a4a'), st.x, 0.5, st.z - 0.9, { col: true, low: true });
    const busTex = track(textTexture('NAVETTA · AEROPORTO', { width: 512, height: 64, font: '800 34px Inter, sans-serif', color: '#ffffff', bg: '#2a5a8a' }));
    const bs = mesh(new THREE.PlaneGeometry(3, 0.38), track(new THREE.MeshBasicMaterial({ map: busTex })), st.x, 2.95, st.z + 0.5, dyn);
    void bs;
    const nextTex = track(textTexture('prossima corsa: adesso', { width: 256, height: 40, font: '600 20px Inter, sans-serif', color: '#2a2a2a', bg: '#f4e88a' }));
    mesh(new THREE.PlaneGeometry(1.2, 0.19), track(new THREE.MeshBasicMaterial({ map: nextTex })), st.x + 1.4, 1.6, st.z - 1.2, dyn);
    this.stop = new THREE.Vector3(st.x, 0, st.z);
    // la strada dietro la fermata, che sparisce nella nebbia
    const road = mesh(new THREE.PlaneGeometry(300, 6), mat('#3a3a3e'), 0, 0.02, -44);
    road.rotation.x = -Math.PI / 2;
    this.busLight = new THREE.Sprite(track(new THREE.SpriteMaterial({ map: glow, color: '#fff0c0', blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0 })));
    this.busLight.scale.set(5, 3, 1);
    dyn.add(this.busLight);

    // ---------- I gabbiani ----------
    this.gulls = [];
    const gullMat = mat('#f4f4f4');
    for (let i = 0; i < 5; i++) {
      const gl = new THREE.Group();
      for (const s of [-1, 1]) {
        const w = new THREE.Mesh(boxGeo, gullMat);
        w.scale.set(0.9, 0.04, 0.25);
        w.position.x = s * 0.45;
        w.rotation.z = s * 0.3;
        gl.add(w);
      }
      dyn.add(gl);
      this.gulls.push({ g: gl, a: rand() * 6, r: 15 + rand() * 25, h: 8 + rand() * 6, sp: 0.15 + rand() * 0.1, cx: (rand() - 0.5) * 40, cz: 20 + rand() * 30 });
    }

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
    this.merged = new THREE.Group();
    for (const [m, geos] of byMat) {
      const g = mergeGeometries(geos, false);
      geos.forEach((q) => q.dispose());
      if (!g) continue;
      track(g);
      this.merged.add(new THREE.Mesh(g, m));
    }
    S.add(this.merged);
  }

  busy() {
    return !!this.sit;
  }

  interaction(p) {
    const near = (v, r) => Math.hypot(v.x - p.x, v.z - p.z) < r;
    if (near(this.cabin13Spot, 1.5)) return { label: 'apri la cabina 1313', fn: () => this.leave(() => this.ctx.travel('suite')) };
    if (near(this.stop, 2.6)) return { label: 'aspetta la navetta per l\'aeroporto', fn: () => this.waitBus() };
    if (near(this.lounger, 1.8)) return { label: 'sdraiati a guardare il mare', fn: () => this.sitDown() };
    if (near(this.bar, 3)) return { label: 'bussa alla serranda del bar', fn: () => this.knock() };
    if (p.z > SHORE - 2) return { label: 'bagnati i piedi', fn: () => this.wetFeet() };
    if (p.y < -1.2) return { label: 'urla nella piscina vuota', fn: () => this.shout() };
    return null;
  }

  knock() {
    const { ui, audio } = this.ctx;
    audio.thud(0.3);
    setTimeout(() => audio.thud(0.3), 260);
    setTimeout(() => audio.thud(0.3), 520);
    this.barSignMat.emissiveIntensity = 0.9;
    setTimeout(() => this.barSignMat && (this.barSignMat.emissiveIntensity = 0.05), 900);
    ui.subtitle(null, 'Per un attimo l\'insegna si accende. Poi niente. Da dentro, una radio che suona una canzone dell\'estate.', 4.5);
  }

  wetFeet() {
    const { ui, audio } = this.ctx;
    audio.pour();
    ui.popup('Gelida!');
    this.saved.feet = true;
    this.save();
    this.later(0.8, () => ui.subtitle(FRIEND, 'Ahah, sei matto. È inverno!', 2.6));
  }

  shout() {
    const { ui, audio } = this.ctx;
    // l'eco nella piscina vuota
    for (let i = 0; i < 4; i++) setTimeout(() => audio.chime(220 - i * 10, 0.08 / (i + 1)), i * 280);
    ui.subtitle(null, 'Oooh... oooh... ooh... L\'eco gira tra le piastrelle e non vuole uscire.', 4);
  }

  sitDown() {
    const p = this.player;
    this.sit = { t: 0, li: 0, lineT: 3 };
    p.vel.set(0, 0, 0);
    p.pos.set(this.lounger.x, 0.2, this.lounger.z);
    p.facing = 0;
    p.sitting = true;
    this.friend.pos.set(this.lounger.x + 1.1, 0.2, this.lounger.z);
    this.friend.facing = 0;
    this.friend.sitting = true;
    this.saved.sat = true;
    this.save();
    this.ctx.ui.hint('<kbd>E</kbd> alzati');
  }

  standUp() {
    this.sit = null;
    this.player.sitting = false;
    this.friend.sitting = false;
    this.player.pos.x -= 1.2;
    this.player.body.rotation.x = 0;
    this.ctx.ui.hint(null);
    this.ctx.ui.objective('La navetta per l\'aeroporto passa sempre. Quando vuoi.');
    this.updateCamera(1, true);
  }

  // la navetta: i fari che arrivano nella nebbia, poi l'aeroporto
  waitBus() {
    const { ui, audio } = this.ctx;
    if (this.cine) return;
    ui.subtitle(null, 'Vi sedete sotto la pensilina. Dalla nebbia, due fari.', 3.4);
    const st = this.stop;
    this.player.pos.set(st.x - 0.6, 0.12, st.z - 0.9);
    this.player.facing = 0;
    this.player.sitting = true;
    this.friend.pos.set(st.x + 0.6, 0.12, st.z - 0.9);
    this.friend.facing = 0;
    this.friend.sitting = true;
    audio.engineStart();
    this.startCine({
      cam: new THREE.Vector3(st.x + 6, 2.2, st.z + 6),
      look: new THREE.Vector3(st.x - 6, 1.4, st.z - 6),
      dur: 6,
      update: (dt, c) => {
        // i fari arrivano da sinistra, lungo la strada
        const k = Math.min(1, c.t / 5.5);
        this.busLight.position.set(-90 + k * 88, 1.4, -43);
        this.busLight.material.opacity = Math.min(0.9, c.t * 0.4);
        audio.engineUpdate(0.25 * (1 - k * 0.7), 0.3, false);
        this.friend.animate(dt, 0);
      },
      onEnd: () => {
        audio.engineStop();
        this.leave(() => this.ctx.goto('aeroporto', 'arrivi'));
      },
    });
  }

  tick(dt) {
    const { input, ui, audio } = this.ctx;
    const t = this.time;
    // le onde
    const pa = this.seaGeo.attributes.position;
    const base = this.seaBase;
    for (let i = 0; i < pa.count; i++) {
      const x = base[i * 3];
      const z = base[i * 3 + 2];
      pa.array[i * 3 + 1] = Math.sin(x * 0.08 + t * 0.7) * 0.18 + Math.sin(z * 0.12 - t * 1.1) * 0.22;
    }
    pa.needsUpdate = true;
    this.foam.position.z = SHORE + 0.5 + Math.sin(t * 0.6) * 1.2;
    this.foam.material.opacity = 0.35 + Math.sin(t * 0.6) * 0.2;
    // la bandiera rossa
    const fp = this.flag.geometry.attributes.position;
    for (let i = 0; i < fp.count; i++) {
      const x = this.flagBase[i * 3];
      fp.array[i * 3 + 2] = Math.sin(x * 5 + t * 6) * 0.08 * (x + 0.55);
    }
    fp.needsUpdate = true;
    // i gabbiani girano in tondo, lenti
    for (const g of this.gulls) {
      g.a += g.sp * dt;
      g.g.position.set(g.cx + Math.cos(g.a) * g.r, g.h, g.cz + Math.sin(g.a) * g.r);
      g.g.rotation.y = -g.a;
      g.g.children.forEach((w, i) => (w.rotation.z = (i ? -1 : 1) * (0.2 + Math.sin(t * 5 + g.a) * 0.25)));
    }
    this.gullT -= dt;
    if (this.gullT <= 0) {
      this.gullT = 6 + Math.random() * 9;
      audio.gull?.();
    }
    // sdraiati sul lettino, a guardare il mare
    if (this.sit) {
      const s = this.sit;
      s.t += dt;
      this.player.animate(dt, 0);
      this.player.body.rotation.x = -0.9;
      this.friend.body.rotation.x = -0.9;
      const cam = new THREE.Vector3(this.lounger.x + 0.5, 1.6, this.lounger.z - 3.2);
      const look = new THREE.Vector3(this.lounger.x, 1.2, this.lounger.z + 30);
      this.camPos.lerp(cam, 1 - Math.exp(-2 * dt));
      this.camLook.lerp(look, 1 - Math.exp(-2 * dt));
      this.camera.position.copy(this.camPos);
      this.camera.lookAt(this.camLook);
      s.lineT -= dt;
      if (s.lineT <= 0) {
        s.lineT = 9 + Math.random() * 4;
        const [who, line] = SIT_LINES[s.li++ % SIT_LINES.length];
        ui.subtitle(who, line, 5);
      }
      if (s.t > 0.5 && input.wasPressed('KeyE', 'Escape', 'KeyW', 'KeyS')) {
        this.friend.body.rotation.x = 0;
        this.standUp();
      }
    }
  }

  dispose() {
    super.dispose();
    this.disposables.forEach((d) => d.dispose());
    this.merged.removeFromParent();
    this.dyn.removeFromParent();
  }
}
