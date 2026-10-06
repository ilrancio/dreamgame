import * as THREE from 'three';
import { textTexture, glowTexture } from '../../core/textures.js';
import { AIRPORT } from '../demone/terrain.js';

// L'aeroporto visto da fuori, giù nel campo: un terminal lungo e basso con la
// facciata di vetro, la torre di controllo con la luce che gira, la pista con le
// luci che lampeggiano e due aerei fermi. Nessuno in giro.
export function buildAirportExterior(scene, terrain) {
  const disposables = [];
  const track = (o) => (disposables.push(o), o);
  const g = new THREE.Group();
  scene.add(g);
  const Y = terrain.heightAt(AIRPORT.x, AIRPORT.z);
  const boxGeo = track(new THREE.BoxGeometry(1, 1, 1));
  const M = (color, o = {}) => track(new THREE.MeshStandardMaterial({ color, roughness: 0.7, ...o }));
  const box = (w, h, d, m, x, y, z) => {
    const o = new THREE.Mesh(boxGeo, m);
    o.scale.set(w, h, d);
    o.position.set(x, Y + y, z);
    o.castShadow = o.receiveShadow = true;
    g.add(o);
    return o;
  };
  const cx = AIRPORT.x;
  const front = AIRPORT.z + 20; // la facciata guarda a nord, verso l'hotel
  const T = { minX: cx - 60, maxX: cx + 60, minZ: front - 32, maxZ: front };
  // il terminal
  box(120, 9, 32, M('#d8d4cc'), cx, 4.5, front - 16);
  box(124, 0.8, 36, M('#8a8e94', { metalness: 0.4 }), cx, 9.4, front - 16);
  const glass = M('#5a7088', { roughness: 0.15, metalness: 0.4, emissive: '#ffe8c0', emissiveIntensity: 0 });
  box(110, 6, 0.3, glass, cx, 4, front + 0.1);
  const doorMat = track(new THREE.MeshBasicMaterial({ color: '#fff4dc' }));
  box(8, 4, 0.2, doorMat, cx, 2, front + 0.3);
  box(14, 0.5, 6, M('#8a8e94'), cx, 5, front + 3);
  const signTex = track(textTexture('AEROPORTO', { width: 1024, height: 160, font: '800 120px Inter, sans-serif', color: '#ffffff', bg: '#1a3a6a' }));
  const signMat = track(new THREE.MeshStandardMaterial({ map: signTex, emissive: '#ffffff', emissiveMap: signTex, emissiveIntensity: 0.4 }));
  const sign = new THREE.Mesh(track(new THREE.PlaneGeometry(26, 4)), signMat);
  sign.position.set(cx, Y + 12.4, front - 2);
  g.add(sign);
  box(26, 4.4, 0.4, M('#1a3a6a'), cx, 12.4, front - 2.3);
  // la torre di controllo
  const tw = { x: cx + 80, z: front - 20 };
  const tower = new THREE.Mesh(track(new THREE.CylinderGeometry(2.5, 3.2, 26, 16)), M('#e0dcd4'));
  tower.position.set(tw.x, Y + 13, tw.z);
  g.add(tower);
  const cab = new THREE.Mesh(track(new THREE.CylinderGeometry(5, 4, 4, 12)), glass);
  cab.position.set(tw.x, Y + 28, tw.z);
  g.add(cab);
  const roof = new THREE.Mesh(track(new THREE.CylinderGeometry(5.6, 5.6, 0.6, 12)), M('#6a6e74'));
  roof.position.set(tw.x, Y + 30.3, tw.z);
  g.add(roof);
  const glow = track(glowTexture('rgba(255,255,255,1)'));
  const beacon = new THREE.Sprite(track(new THREE.SpriteMaterial({ map: glow, color: '#9affb8', blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0.9 })));
  beacon.position.set(tw.x, Y + 31.4, tw.z);
  beacon.scale.set(8, 8, 1);
  g.add(beacon);
  // la pista, dietro il terminal, con le luci ai bordi
  const rz = AIRPORT.z - 70;
  const runway = new THREE.Mesh(track(new THREE.PlaneGeometry(420, 34)), M('#3a3a3e', { roughness: 1 }));
  runway.rotation.x = -Math.PI / 2;
  runway.position.set(cx, Y + 0.08, rz);
  g.add(runway);
  const lineMat = M('#e8e8e0');
  for (let x = -200; x < 200; x += 18) box(9, 0.02, 0.6, lineMat, cx + x, 0.1, rz);
  const lights = [];
  for (let x = -205; x <= 205; x += 15) {
    for (const s of [-1, 1]) {
      const l = new THREE.Sprite(track(new THREE.SpriteMaterial({ map: glow, color: s > 0 ? '#ffd890' : '#9ac8ff', blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0.6 })));
      l.position.set(cx + x, Y + 0.6, rz + s * 18);
      l.scale.set(2.2, 2.2, 1);
      l.userData.x = x;
      g.add(l);
      lights.push(l);
    }
  }
  // l'area di sosta con due aerei fermi
  const apron = new THREE.Mesh(track(new THREE.PlaneGeometry(160, 40)), M('#5a5a60', { roughness: 1 }));
  apron.rotation.x = -Math.PI / 2;
  apron.position.set(cx, Y + 0.06, front - 52);
  g.add(apron);
  const colliders = [{ minX: T.minX, maxX: T.maxX, minZ: T.minZ, maxZ: T.maxZ }, { minX: tw.x - 3.5, maxX: tw.x + 3.5, minZ: tw.z - 3.5, maxZ: tw.z + 3.5 }];
  const body = M('#eceef2');
  for (const [px, fin] of [[cx - 30, '#c83a3a'], [cx + 25, '#2a4a8a']]) {
    const pl = new THREE.Group();
    pl.position.set(px, Y, front - 52);
    const fus = new THREE.Mesh(track(new THREE.CylinderGeometry(2.2, 2.2, 30, 16)), body);
    fus.rotation.z = Math.PI / 2;
    fus.position.y = 4;
    const nose = new THREE.Mesh(track(new THREE.SphereGeometry(2.2, 16, 10)), body);
    nose.scale.set(1.6, 1, 1);
    nose.position.set(15, 4, 0);
    const wing = new THREE.Mesh(boxGeo, body);
    wing.scale.set(5, 0.4, 34);
    wing.position.set(-1, 3.2, 0);
    const tail = new THREE.Mesh(boxGeo, M(fin));
    tail.scale.set(4, 7, 0.4);
    tail.position.set(-13, 8, 0);
    pl.add(fus, nose, wing, tail);
    g.add(pl);
    colliders.push({ minX: px - 17, maxX: px + 19, minZ: front - 54.5, maxZ: front - 49.5 });
  }
  // la manica a vento
  const pole = new THREE.Mesh(track(new THREE.CylinderGeometry(0.1, 0.1, 6, 6)), M('#c8c8c8'));
  pole.position.set(cx - 90, Y + 3, front - 10);
  g.add(pole);
  const sock = new THREE.Mesh(track(new THREE.ConeGeometry(0.6, 3, 10, 1, true)), M('#ff6a2a', { side: THREE.DoubleSide }));
  sock.position.set(cx - 88.5, Y + 5.8, front - 10);
  sock.rotation.z = Math.PI / 2;
  g.add(sock);

  return {
    colliders,
    center: new THREE.Vector3(cx, Y, front),
    // le porte di vetro: ci si entra camminando verso sud
    entrance: { x: cx, z: front + 0.3, halfW: 4 },
    spawn: { x: cx, z: front + 4, yaw: 0 },
    setNight(k) {
      glass.emissiveIntensity = 0.1 + k * 0.8;
      signMat.emissiveIntensity = 0.4 + k * 1.4;
    },
    update(t) {
      // la luce della torre gira; le luci della pista si accendono in sequenza
      beacon.material.opacity = 0.3 + Math.max(0, Math.sin(t * 2.5)) * 0.7;
      const run = (t * 120) % 440 - 220;
      for (const l of lights) l.material.opacity = 0.35 + (Math.abs(l.userData.x - run) < 12 ? 0.65 : 0);
      sock.rotation.y = Math.sin(t * 0.7) * 0.3;
    },
    dispose() {
      disposables.forEach((d) => d.dispose());
      g.removeFromParent();
    },
  };
}
