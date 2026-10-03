import * as THREE from 'three';
import { textTexture, glowTexture } from '../../core/textures.js';
import { MALL } from '../demone/terrain.js';

// Il centro commerciale visto da fuori: un parallelepipedo bianco enorme in
// fondo alla conca, un ingresso di vetro a tutta altezza e un parcheggio vuoto.
export const MALL_NAME = 'ORIZZONTE';

export function buildMallExterior(scene, terrain) {
  const disposables = [];
  const track = (o) => (disposables.push(o), o);
  const g = new THREE.Group();
  scene.add(g);
  const Y = terrain.heightAt(MALL.x, MALL.z);
  const boxGeo = track(new THREE.BoxGeometry(1, 1, 1));
  const box = (w, h, d, m, x, y, z) => {
    const o = new THREE.Mesh(boxGeo, m);
    o.scale.set(w, h, d);
    o.position.set(x, Y + y, z);
    o.castShadow = o.receiveShadow = true;
    g.add(o);
    return o;
  };
  const M = (color, o = {}) => track(new THREE.MeshStandardMaterial({ color, roughness: 0.85, ...o }));

  // il corpo: 130 × 110 m, alto 24 m
  const B = { minX: MALL.x - 85, maxX: MALL.x + 45, minZ: MALL.z - 55, maxZ: MALL.z + 55 };
  const cx = (B.minX + B.maxX) / 2;
  const front = B.maxX; // la facciata guarda a est, verso la strada
  const white = M('#e9e5dc');
  const band = M('#c8c2b6');
  const glass = M('#5a7a98', { roughness: 0.15, metalness: 0.4, emissive: '#ffe6b8', emissiveIntensity: 0 });
  box(B.maxX - B.minX, 24, B.maxZ - B.minZ, white, cx, 12, MALL.z);
  for (const y of [8, 16, 23.5]) box(B.maxX - B.minX + 0.6, 0.8, B.maxZ - B.minZ + 0.6, band, cx, y, MALL.z);
  // finestre a nastro sulla facciata e sui fianchi
  box(0.4, 3, B.maxZ - B.minZ - 20, glass, front + 0.1, 12, MALL.z);
  for (const s of [-1, 1]) box(B.maxX - B.minX - 20, 3, 0.4, glass, cx, 12, MALL.z + s * (55 + 0.1));
  // l'atrio d'ingresso: un volume di vetro a tutta altezza, con la pensilina
  const atrium = { w: 30, d: 8 };
  box(atrium.d, 18, atrium.w, glass, front + atrium.d / 2, 9, MALL.z);
  box(atrium.d + 6, 0.8, atrium.w + 8, band, front + (atrium.d + 6) / 2, 18.4, MALL.z);
  box(12, 0.5, 14, white, front + atrium.d + 6, 5.5, MALL.z);
  for (const s of [-1, 1]) box(0.5, 5.5, 0.5, band, front + atrium.d + 11.5, 2.75, MALL.z + s * 6.5);
  const doorGlowMat = track(new THREE.MeshBasicMaterial({ color: '#fff3d8' }));
  const doors = new THREE.Mesh(boxGeo, doorGlowMat);
  doors.scale.set(0.2, 4.2, 9);
  doors.position.set(front + atrium.d + 0.15, Y + 2.1, MALL.z);
  g.add(doors);

  // l'insegna
  const signTex = track(textTexture(MALL_NAME, { width: 1024, height: 160, font: '800 120px Inter, sans-serif', color: '#ffffff', bg: '#1a3a6a' }));
  const signMat = track(new THREE.MeshStandardMaterial({ map: signTex, emissive: '#ffffff', emissiveMap: signTex, emissiveIntensity: 0.4 }));
  const sign = new THREE.Mesh(track(new THREE.PlaneGeometry(26, 4)), signMat);
  sign.position.set(front + atrium.d + 0.3, Y + 21.5, MALL.z);
  sign.rotation.y = Math.PI / 2;
  g.add(sign);
  const sub = track(textTexture('centro commerciale · aperto', { width: 512, height: 64, font: '600 34px Inter, sans-serif', color: '#1a3a6a', bg: '#f4f2ee' }));
  const subM = new THREE.Mesh(track(new THREE.PlaneGeometry(10, 1.25)), track(new THREE.MeshStandardMaterial({ map: sub })));
  subM.position.set(front + atrium.d + 6.3, Y + 6.3, MALL.z);
  subM.rotation.y = Math.PI / 2;
  g.add(subM);

  // il parcheggio: righe bianche, lampioni, nessuna macchina
  const lot = { minX: front + 20, maxX: front + 75, minZ: MALL.z - 50, maxZ: MALL.z + 50 };
  const asphalt = new THREE.Mesh(track(new THREE.PlaneGeometry(lot.maxX - lot.minX, lot.maxZ - lot.minZ)), M('#3a3a3e', { roughness: 1 }));
  asphalt.rotation.x = -Math.PI / 2;
  asphalt.position.set((lot.minX + lot.maxX) / 2, Y + 0.08, MALL.z);
  asphalt.receiveShadow = true;
  g.add(asphalt);
  const lineMat = M('#e8e8e0');
  const lines = [];
  for (const x of [lot.minX + 10, lot.minX + 32]) for (let z = lot.minZ + 4; z < lot.maxZ - 3; z += 3) lines.push([x, z]);
  const lineMesh = new THREE.InstancedMesh(boxGeo, lineMat, lines.length * 2);
  const m4 = new THREE.Matrix4();
  lines.forEach(([x, z], i) => {
    for (const s of [-1, 1]) {
      m4.compose(new THREE.Vector3(x + s * 2.6, Y + 0.1, z), new THREE.Quaternion(), new THREE.Vector3(5, 0.02, 0.12));
      lineMesh.setMatrixAt(i * 2 + (s > 0 ? 1 : 0), m4);
    }
  });
  g.add(lineMesh);
  const glowTex = track(glowTexture('rgba(255,255,255,1)'));
  const lamps = [];
  for (const x of [lot.minX + 21, lot.minX + 43]) {
    for (let z = lot.minZ + 10; z < lot.maxZ; z += 26) {
      box(0.25, 9, 0.25, M('#3a3a3a'), x, 4.5, z);
      box(1.6, 0.25, 0.5, M('#2a2a2a'), x, 9, z);
      const s = new THREE.Sprite(track(new THREE.SpriteMaterial({ map: glowTex, color: '#fff0d0', blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0 })));
      s.position.set(x, Y + 8.8, z);
      s.scale.set(6, 6, 1);
      g.add(s);
      lamps.push(s);
    }
  }
  // un paio di carrelli abbandonati, l'unica traccia di qualcuno
  const cart = M('#b8bcc4', { metalness: 0.7, roughness: 0.3 });
  for (const [x, z, r] of [[lot.minX + 15, MALL.z + 12, 0.4], [lot.minX + 40, MALL.z - 23, 1.9]]) {
    const c = box(1, 0.8, 0.6, cart, x, 0.7, z);
    c.rotation.y = r;
  }

  const colliders = [
    { minX: B.minX, maxX: B.maxX + atrium.d, minZ: B.minZ, maxZ: B.maxZ },
    { minX: front + atrium.d + 11.2, maxX: front + atrium.d + 11.8, minZ: MALL.z - 6.8, maxZ: MALL.z - 6.2 },
    { minX: front + atrium.d + 11.2, maxX: front + atrium.d + 11.8, minZ: MALL.z + 6.2, maxZ: MALL.z + 6.8 },
  ];
  // il punto davanti alle porte (si entra camminandoci dentro, verso ovest)
  const entrance = { x: front + atrium.d + 0.4, z: MALL.z, halfW: 4.5 };

  return {
    group: g,
    colliders,
    entrance,
    // dove si compare uscendo, e dove resta parcheggiata la macchina
    spawn: { x: front + atrium.d + 3, z: MALL.z, yaw: Math.PI / 2 },
    parking: { x: lot.minX + 10, z: MALL.z - 8, heading: Math.PI },
    setNight(k) {
      glass.emissiveIntensity = 0.15 + 0.9 * k;
      signMat.emissiveIntensity = 0.4 + 1.4 * k;
      for (const l of lamps) l.material.opacity = 0.9 * k;
    },
    dispose() {
      disposables.forEach((d) => d.dispose());
      lineMesh.dispose();
      g.removeFromParent();
    },
  };
}
