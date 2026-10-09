import * as THREE from 'three';
import { glowTexture } from '../../core/textures.js';

// Le cose che si trovano in giro per la campagna: i forzieri e le lanterne
// blu dove si riposa (e si salva), come le sfere di FFX.

const shared = {};
function mats() {
  if (shared.wood) return shared;
  shared.wood = new THREE.MeshStandardMaterial({ color: '#6a3a1e', roughness: 0.8 });
  shared.gold = new THREE.MeshStandardMaterial({ color: '#e8c050', metalness: 0.8, roughness: 0.3 });
  shared.box = new THREE.BoxGeometry(1, 1, 1);
  shared.glow = glowTexture('rgba(255,255,255,1)');
  return shared;
}

// un forziere: si apre il coperchio e ne esce una luce
export function buildChest(parent, pos, rotY = 0) {
  const M = mats();
  const g = new THREE.Group();
  g.position.copy(pos);
  g.rotation.y = rotY;
  const body = new THREE.Mesh(M.box, M.wood);
  body.scale.set(1.1, 0.6, 0.7);
  body.position.y = 0.3;
  const lidPivot = new THREE.Group();
  lidPivot.position.set(0, 0.6, -0.35);
  const lid = new THREE.Mesh(M.box, M.wood);
  lid.scale.set(1.12, 0.25, 0.72);
  lid.position.set(0, 0.12, 0.35);
  lidPivot.add(lid);
  for (const x of [-0.45, 0.45]) {
    const band = new THREE.Mesh(M.box, M.gold);
    band.scale.set(0.08, 0.64, 0.74);
    band.position.set(x, 0.31, 0);
    g.add(band);
  }
  const lock = new THREE.Mesh(M.box, M.gold);
  lock.scale.set(0.14, 0.16, 0.06);
  lock.position.set(0, 0.55, 0.37);
  g.add(body, lidPivot, lock);
  const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: M.glow, color: '#ffe8a0', blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0.35 }));
  halo.scale.set(2.2, 2.2, 1);
  halo.position.y = 0.6;
  g.add(halo);
  parent.add(g);
  const c = {
    group: g,
    pos: pos.clone(),
    opened: false,
    t: 0,
    open(instant = false) {
      this.opened = true;
      this.t = instant ? 1 : 0;
      if (instant) {
        lidPivot.rotation.x = -1.9;
        halo.visible = false;
      }
    },
    update(dt) {
      if (this.opened && this.t < 1) {
        this.t = Math.min(1, this.t + dt * 1.5);
        lidPivot.rotation.x = -1.9 * this.t;
        halo.material.opacity = 0.35 + Math.sin(this.t * Math.PI) * 0.6;
        if (this.t >= 1) halo.visible = false;
      } else if (!this.opened) halo.material.opacity = 0.25 + Math.sin(performance.now() / 300) * 0.1;
    },
  };
  return c;
}

// una lanterna blu su un palo: qui si riposa e si salva
export function buildSaveLantern(parent, pos) {
  const M = mats();
  const g = new THREE.Group();
  g.position.copy(pos);
  const pole = new THREE.Mesh(M.box, new THREE.MeshStandardMaterial({ color: '#2a2a30', metalness: 0.5 }));
  pole.scale.set(0.12, 2.2, 0.12);
  pole.position.y = 1.1;
  const lamp = new THREE.Mesh(new THREE.OctahedronGeometry(0.32, 0), new THREE.MeshStandardMaterial({ color: '#9ad8ff', emissive: '#3a9aff', emissiveIntensity: 2.2 }));
  lamp.position.y = 2.5;
  const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: M.glow, color: '#5ab0ff', blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0.7 }));
  halo.scale.set(3.4, 3.4, 1);
  halo.position.y = 2.5;
  g.add(pole, lamp, halo);
  parent.add(g);
  return {
    group: g,
    pos: pos.clone(),
    update(t) {
      lamp.rotation.y = t * 1.2;
      lamp.position.y = 2.5 + Math.sin(t * 2) * 0.08;
      halo.material.opacity = 0.55 + Math.sin(t * 3) * 0.15;
    },
  };
}
