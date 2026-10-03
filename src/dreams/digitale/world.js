import * as THREE from 'three';
import { glowTexture } from '../../core/textures.js';

// Le entità digitali nel mondo 3D: forme che tremolano, si sfaldano e
// ricompaiono un po' più in là. E i terminali, dove si collega la chiavetta.
const ENTITY_COLORS = ['#ff3ad8', '#3af0ff', '#a05aff', '#ffe42a'];

// Un terminale: chiosco scuro, schermo che scorre, porta USB che pulsa.
// Intorno, finché non lo liberi, le sue entità.
export function buildTerminal(scene, { x, y, z, yaw = 0 }) {
  const disposables = [];
  const track = (o) => (disposables.push(o), o);
  const g = new THREE.Group();
  g.position.set(x, y, z);
  g.rotation.y = yaw;
  scene.add(g);
  const M = (color, o = {}) => track(new THREE.MeshStandardMaterial({ color, roughness: 0.5, ...o }));
  const box = (w, h, d, m, px, py, pz, parent = g) => {
    const o = new THREE.Mesh(track(new THREE.BoxGeometry(w, h, d)), m);
    o.position.set(px, py, pz);
    o.castShadow = true;
    parent.add(o);
    return o;
  };
  const body = M('#1a1a26', { metalness: 0.5 });
  box(1.1, 0.15, 0.8, body, 0, 0.08, 0);
  box(0.82, 1.9, 0.5, body, 0, 1.05, 0);
  box(0.9, 0.12, 0.6, body, 0, 2.05, 0);
  const lightMat = track(new THREE.MeshBasicMaterial({ color: '#ff3ad8' }));
  box(0.86, 0.05, 0.05, lightMat, 0, 2.0, 0.3);
  // lo schermo
  const c = document.createElement('canvas');
  c.width = 128;
  c.height = 96;
  const sg = c.getContext('2d');
  const tex = track(new THREE.CanvasTexture(c));
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.magFilter = THREE.NearestFilter;
  const screen = new THREE.Mesh(track(new THREE.PlaneGeometry(0.66, 0.5)), track(new THREE.MeshBasicMaterial({ map: tex })));
  screen.position.set(0, 1.5, 0.26);
  screen.rotation.x = -0.12;
  g.add(screen);
  // la porta USB
  const usbMat = track(new THREE.MeshBasicMaterial({ color: '#7af8ff' }));
  box(0.12, 0.05, 0.03, usbMat, 0, 1.08, 0.26);
  const glow = track(glowTexture('rgba(255,255,255,1)'));
  const halo = new THREE.Sprite(track(new THREE.SpriteMaterial({ map: glow, color: '#7af8ff', blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0.55 })));
  halo.position.set(0, 1.5, 0.5);
  halo.scale.set(2.2, 1.8, 1);
  g.add(halo);

  // le entità che gli girano intorno
  const ents = [];
  const geos = [track(new THREE.OctahedronGeometry(0.35)), track(new THREE.BoxGeometry(0.45, 0.45, 0.45)), track(new THREE.TetrahedronGeometry(0.4))];
  for (let i = 0; i < 9; i++) {
    const col = ENTITY_COLORS[i % ENTITY_COLORS.length];
    const m = new THREE.Mesh(geos[i % 3], track(new THREE.MeshBasicMaterial({ color: col, wireframe: i % 2 === 0, transparent: true, opacity: 0.9 })));
    const s = new THREE.Sprite(track(new THREE.SpriteMaterial({ map: glow, color: col, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0.5 })));
    s.scale.setScalar(1.4);
    m.add(s);
    g.add(m);
    ents.push({ m, a: (i / 9) * Math.PI * 2, r: 2.4 + Math.random() * 2.6, h: 1 + Math.random() * 3, sp: 0.3 + Math.random() * 0.5, jx: 0, jz: 0 });
  }

  let cleared = false;
  let screenT = 0;
  const drawScreen = (t) => {
    sg.fillStyle = '#05030f';
    sg.fillRect(0, 0, 128, 96);
    sg.font = 'bold 9px monospace';
    for (let i = 0; i < 8; i++) {
      sg.fillStyle = cleared ? 'rgba(74,255,138,0.7)' : i % 3 ? 'rgba(122,248,255,0.6)' : 'rgba(255,58,216,0.7)';
      const w = 20 + ((i * 37 + Math.floor(t * 4) * 13) % 80);
      sg.fillRect(8, 8 + i * 10, w, 3);
    }
    sg.fillStyle = cleared ? '#4aff8a' : '#ff3a3a';
    sg.font = 'bold 14px monospace';
    sg.fillText(cleared ? 'LIBERO' : Math.floor(t * 2) % 2 ? 'INVASO' : '', 30, 88);
    tex.needsUpdate = true;
  };

  return {
    group: g,
    // dove ci si mette per collegare la chiavetta (davanti allo schermo)
    spot: new THREE.Vector3(x + Math.sin(yaw) * 1.3, y, z + Math.cos(yaw) * 1.3),
    collider: { minX: x - 0.6, maxX: x + 0.6, minZ: z - 0.6, maxZ: z + 0.6 },
    setCleared(v) {
      cleared = v;
      for (const e of ents) e.m.visible = !v;
      lightMat.color.set(v ? '#4aff8a' : '#ff3ad8');
      halo.material.color.set(v ? '#4aff8a' : '#7af8ff');
    },
    update(t, dt) {
      screenT -= dt;
      if (screenT <= 0) {
        screenT = 0.15;
        drawScreen(t);
      }
      usbMat.color.setScalar(0.5 + Math.sin(t * 5) * 0.5).lerp(new THREE.Color('#7af8ff'), 0.6);
      if (cleared) return;
      for (const e of ents) {
        e.a += e.sp * dt;
        // ogni tanto un salto glitch: sparisce e ricompare un po' più in là
        if (Math.random() < dt * 0.8) {
          e.jx = (Math.random() - 0.5) * 1.5;
          e.jz = (Math.random() - 0.5) * 1.5;
        }
        e.jx *= 0.96;
        e.jz *= 0.96;
        e.m.position.set(Math.cos(e.a) * e.r + e.jx, e.h + Math.sin(t * 2 + e.a) * 0.3, Math.sin(e.a) * e.r + e.jz);
        e.m.rotation.set(t * 1.3 + e.a, t * 0.9, 0);
        e.m.scale.setScalar(Math.random() < 0.03 ? 1.6 : 1);
      }
    },
    dispose() {
      disposables.forEach((d) => d.dispose());
      g.removeFromParent();
    },
  };
}

// L'invasione sparsa per il mondo: cubi e forme che galleggiano sopra strade,
// prati e piazze. Si ritira man mano che liberi i terminali.
export function buildInvasion(scene, points) {
  const geo = new THREE.BoxGeometry(1, 1, 1);
  const mat = new THREE.MeshBasicMaterial({ color: '#ffffff', wireframe: false, transparent: true, opacity: 0.85 });
  const n = points.length;
  const mesh = new THREE.InstancedMesh(geo, mat, n);
  mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  mesh.frustumCulled = false;
  const color = new THREE.Color();
  const data = points.map(([x, y, z], i) => {
    mesh.setColorAt(i, color.set(ENTITY_COLORS[i % ENTITY_COLORS.length]));
    return { x, y, z, s: 0.5 + Math.random() * 1.4, ph: Math.random() * 10, jx: 0, jz: 0 };
  });
  mesh.instanceColor.needsUpdate = true;
  scene.add(mesh);
  const m4 = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const e = new THREE.Euler();
  const v = new THREE.Vector3();
  const sc = new THREE.Vector3();
  return {
    mesh,
    // quota: 0..1, quante entità restano
    setAmount(k) {
      mesh.count = Math.round(n * Math.max(0, Math.min(1, k)));
    },
    update(t, dt) {
      for (let i = 0; i < mesh.count; i++) {
        const d = data[i];
        if (Math.random() < dt * 0.5) {
          d.jx = (Math.random() - 0.5) * 6;
          d.jz = (Math.random() - 0.5) * 6;
        }
        d.jx *= 0.97;
        d.jz *= 0.97;
        const flick = Math.random() < 0.02 ? 0.3 : 1;
        e.set(t * 0.7 + d.ph, t * 0.5 + d.ph, 0);
        q.setFromEuler(e);
        m4.compose(v.set(d.x + d.jx, d.y + Math.sin(t * 1.3 + d.ph) * 0.8, d.z + d.jz), q, sc.setScalar(d.s * flick));
        mesh.setMatrixAt(i, m4);
      }
      mesh.instanceMatrix.needsUpdate = true;
    },
    dispose() {
      geo.dispose();
      mat.dispose();
      mesh.dispose();
      mesh.removeFromParent();
    },
  };
}
