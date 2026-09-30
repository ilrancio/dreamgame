import * as THREE from 'three';
import { woodLogTexture, shingleTexture, textTexture, glowTexture } from '../../core/textures.js';

// L'hotel/baita di legno: volutamente enorme (110 m di facciata) come nei sogni.
// Il fronte guarda verso sud (-z), da dove arriva la strada.
export function buildHotel(scene, x, y, z) {
  const g = new THREE.Group();
  g.position.set(x, y, z);
  scene.add(g);
  const disposables = [];
  const track = (o) => (disposables.push(o), o);

  const logs = track(woodLogTexture());
  logs.repeat.set(9, 3);
  const logsSmall = track(woodLogTexture());
  logsSmall.repeat.set(3, 4);
  const shingles = track(shingleTexture());
  shingles.repeat.set(10, 6);
  const wood = track(new THREE.MeshStandardMaterial({ map: logs, roughness: 0.85 }));
  const woodTower = track(new THREE.MeshStandardMaterial({ map: logsSmall, roughness: 0.85 }));
  const roof = track(new THREE.MeshStandardMaterial({ map: shingles, roughness: 0.9, side: THREE.DoubleSide }));
  const stone = track(new THREE.MeshStandardMaterial({ color: '#6d6a66', roughness: 1 }));
  const beam = track(new THREE.MeshStandardMaterial({ color: '#3b2415', roughness: 0.9 }));
  const windowMat = track(new THREE.MeshStandardMaterial({ color: '#ffcc80', emissive: '#ffb45a', emissiveIntensity: 2.2 }));
  const windowDark = track(new THREE.MeshStandardMaterial({ color: '#1a1a24', emissive: '#10121c' }));

  const box = (w, h, d, mat, px, py, pz, parent = g) => {
    const m = new THREE.Mesh(track(new THREE.BoxGeometry(w, h, d)), mat);
    m.position.set(px, py, pz);
    m.castShadow = true;
    m.receiveShadow = true;
    parent.add(m);
    return m;
  };

  const W = 110;
  const H = 38;
  const D = 60;
  box(W + 4, 5, D + 4, stone, 0, 2.5, 0);
  box(W, H, D, wood, 0, 5 + H / 2, 0);

  // tetto a due falde
  const roofShape = new THREE.Shape();
  roofShape.moveTo(-D / 2 - 8, 0);
  roofShape.lineTo(0, 30);
  roofShape.lineTo(D / 2 + 8, 0);
  roofShape.lineTo(-D / 2 - 8, 0);
  const roofGeo = track(new THREE.ExtrudeGeometry(roofShape, { depth: W + 14, bevelEnabled: false }));
  roofGeo.translate(0, 0, -(W + 14) / 2);
  const roofMesh = new THREE.Mesh(roofGeo, roof);
  roofMesh.rotation.y = Math.PI / 2;
  roofMesh.position.y = 5 + H;
  roofMesh.castShadow = true;
  g.add(roofMesh);
  // timpani di legno
  const gableShape = new THREE.Shape();
  gableShape.moveTo(-D / 2, 0);
  gableShape.lineTo(0, 27);
  gableShape.lineTo(D / 2, 0);
  const gableGeo = track(new THREE.ShapeGeometry(gableShape));
  for (const sx of [-1, 1]) {
    const gm = new THREE.Mesh(gableGeo, wood);
    gm.rotation.y = sx * Math.PI / 2;
    gm.position.set(sx * (W / 2 + 0.05), 5 + H, 0);
    g.add(gm);
  }

  // torre centrale sporgente con il portone
  const tower = new THREE.Group();
  tower.position.set(0, 0, -D / 2 - 9);
  g.add(tower);
  box(36, 58, 20, woodTower, 0, 5 + 29, 0, tower);
  const tShape = new THREE.Shape();
  tShape.moveTo(-23, 0);
  tShape.lineTo(0, 22);
  tShape.lineTo(23, 0);
  const tRoofGeo = track(new THREE.ExtrudeGeometry(tShape, { depth: 26, bevelEnabled: false }));
  tRoofGeo.translate(0, 0, -13);
  const tRoof = new THREE.Mesh(tRoofGeo, roof);
  tRoof.position.y = 63;
  tRoof.castShadow = true;
  tower.add(tRoof);
  const tGable = new THREE.Mesh(track(new THREE.ShapeGeometry((() => {
    const s = new THREE.Shape();
    s.moveTo(-18, 0);
    s.lineTo(0, 17);
    s.lineTo(18, 0);
    return s;
  })())), woodTower);
  tGable.position.set(0, 63, -10.05);
  tGable.rotation.y = Math.PI;
  tower.add(tGable);

  // portone illuminato
  const doorMat = track(new THREE.MeshStandardMaterial({ color: '#ffd9a0', emissive: '#ffae50', emissiveIntensity: 2.8 }));
  box(10, 15, 0.6, doorMat, 0, 5 + 7.5, -10.2, tower);
  box(13, 1.5, 1.4, beam, 0, 5 + 15.5, -10.4, tower);
  box(1.5, 16, 1.4, beam, -6, 5 + 8, -10.4, tower);
  box(1.5, 16, 1.4, beam, 6, 5 + 8, -10.4, tower);
  // insegna
  const signTex = track(textTexture('HOTEL', { font: '700 170px Cormorant Garamond, serif', color: '#ffe2a8', glow: '#ff9a30', bg: '#2a170c' }));
  const signMat = track(new THREE.MeshStandardMaterial({ map: signTex, emissive: '#ffffff', emissiveMap: signTex, emissiveIntensity: 1.2 }));
  box(26, 6.5, 0.8, signMat, 0, 5 + 23, -10.6, tower);
  // finestre della torre
  for (const [wx, wy] of [[-10, 36], [10, 36], [-10, 48], [10, 48], [0, 48]]) {
    box(5, 7, 0.4, windowMat, wx, wy, -10.2, tower);
  }

  // finestre: tre piani, alcune spente (è notte fonda... o quasi)
  const winGeo = track(new THREE.BoxGeometry(4, 6, 0.4));
  const floors = [13, 24, 35];
  let lit = 0;
  for (const fy of floors) {
    for (let c = 0; c < 14; c++) {
      const wx = -W / 2 + 6 + c * ((W - 12) / 13);
      if (Math.abs(wx) < 20) continue;
      const on = Math.random() > 0.25;
      if (on) lit++;
      const m = new THREE.Mesh(winGeo, on ? windowMat : windowDark);
      m.position.set(wx, fy, -D / 2 - 0.2);
      g.add(m);
      const m2 = new THREE.Mesh(winGeo, Math.random() > 0.35 ? windowMat : windowDark);
      m2.position.set(wx, fy, D / 2 + 0.2);
      g.add(m2);
    }
    for (let c = 0; c < 6; c++) {
      const wz = -D / 2 + 7 + c * ((D - 14) / 5);
      for (const sx of [-1, 1]) {
        const m = new THREE.Mesh(winGeo, Math.random() > 0.3 ? windowMat : windowDark);
        m.rotation.y = Math.PI / 2;
        m.position.set(sx * (W / 2 + 0.2), fy, wz);
        g.add(m);
      }
    }
  }
  // balconi lungo la facciata
  for (const fy of [18.5, 29.5]) {
    box(W - 44, 0.8, 4, beam, -(W / 2 + 18) / 2 + 2, fy, -D / 2 - 2);
    box(W - 44, 0.8, 4, beam, (W / 2 + 18) / 2 - 2, fy, -D / 2 - 2);
    box(W - 44, 2.2, 0.4, beam, -(W / 2 + 18) / 2 + 2, fy + 1.5, -D / 2 - 3.9);
    box(W - 44, 2.2, 0.4, beam, (W / 2 + 18) / 2 - 2, fy + 1.5, -D / 2 - 3.9);
  }
  // comignoli
  const chimneys = [];
  for (const cx of [-35, 30]) {
    box(7, 26, 7, stone, cx, 5 + H + 20, 8);
    chimneys.push(new THREE.Vector3(x + cx, y + 5 + H + 34, z + 8));
  }

  // lanterne e luci calde davanti all'ingresso
  const glow = track(glowTexture('rgba(255,190,110,1)'));
  const lanterns = [];
  for (let k = 0; k < 8; k++) {
    const side = k % 2 ? 1 : -1;
    const lz = -D / 2 - 30 - Math.floor(k / 2) * 18;
    box(0.5, 5, 0.5, beam, side * 11, 2.5, lz);
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: glow, color: '#ffc27a', blending: THREE.AdditiveBlending, depthWrite: false }));
    track(s.material);
    s.scale.set(6, 6, 1);
    s.position.set(side * 11, 5.4, lz);
    g.add(s);
    lanterns.push(s);
  }
  const doorGlow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glow, color: '#ffb060', blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0.8 }));
  track(doorGlow.material);
  doorGlow.scale.set(60, 40, 1);
  doorGlow.position.set(0, 14, -D / 2 - 22);
  g.add(doorGlow);

  const lampA = new THREE.PointLight('#ffb366', 900, 140, 1.4);
  lampA.position.set(0, 14, -D / 2 - 30);
  g.add(lampA);

  // zona d'arrivo davanti al portone
  const arrival = new THREE.Vector3(x, y, z - D / 2 - 40);
  const ringMat = track(new THREE.MeshBasicMaterial({ color: '#ffd28a', transparent: true, opacity: 0.5, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
  const ring = new THREE.Mesh(track(new THREE.RingGeometry(12, 14, 64)), ringMat);
  ring.rotation.x = -Math.PI / 2;
  ring.position.set(0, 0.4, -D / 2 - 40);
  g.add(ring);

  return {
    group: g,
    arrival,
    arrivalRadius: 14,
    chimneys,
    // collisione: rettangolo dell'edificio (coordinate mondo)
    box: { minX: x - W / 2 - 2, maxX: x + W / 2 + 2, minZ: z - D / 2 - 19, maxZ: z + D / 2 + 2 },
    update(t) {
      ringMat.opacity = 0.35 + Math.sin(t * 2.5) * 0.2;
      doorGlow.material.opacity = 0.7 + Math.sin(t * 1.3) * 0.1;
      lanterns.forEach((l, i) => l.scale.setScalar(5.5 + Math.sin(t * 3 + i) * 0.5));
    },
    dispose() {
      disposables.forEach((d) => d.dispose());
      g.removeFromParent();
    },
  };
}
