import * as THREE from 'three';
import { clamp } from '../../core/noise.js';

// Personaggio a piedi: stessi colori di chi era in macchina nel campo.
export class Character {
  constructor(scene, { skin, hair, shirt, pants = '#2a2a34' }) {
    this.group = new THREE.Group();
    scene.add(this.group);
    this.pos = new THREE.Vector3();
    this.vel = new THREE.Vector3();
    this.facing = 0;
    this.radius = 0.42;
    this.grounded = true;
    this.walkPhase = 0;
    this.kickT = 1;
    this.disposables = [];

    const m = (c) => this.track(new THREE.MeshStandardMaterial({ color: c, roughness: 0.85 }));
    const skinM = m(skin);
    const shirtM = m(shirt);
    const hairM = m(hair);
    this.looks = { skin: skinM, shirt: shirtM, hair: hairM };
    const pantsM = m(pants);
    const shoeM = m('#1a1614');

    const body = new THREE.Group();
    this.body = body;
    this.group.add(body);
    const mesh = (geo, mat, parent, x, y, z) => {
      const o = new THREE.Mesh(this.track(geo), mat);
      o.position.set(x, y, z);
      o.castShadow = true;
      parent.add(o);
      return o;
    };
    mesh(new THREE.CylinderGeometry(0.24, 0.2, 0.62, 12), shirtM, body, 0, 1.2, 0);
    mesh(new THREE.CylinderGeometry(0.21, 0.21, 0.18, 12), pantsM, body, 0, 0.86, 0);
    this.head = new THREE.Group();
    this.head.position.set(0, 1.68, 0);
    body.add(this.head);
    mesh(new THREE.SphereGeometry(0.17, 16, 12), skinM, this.head, 0, 0, 0);
    const hairMesh = mesh(new THREE.SphereGeometry(0.18, 16, 12, 0, Math.PI * 2, 0, Math.PI * 0.55), hairM, this.head, 0, 0.03, -0.01);
    hairMesh.rotation.x = -0.3;

    const limb = (x, y, len, r, mat, endMat) => {
      const pivot = new THREE.Group();
      pivot.position.set(x, y, 0);
      body.add(pivot);
      mesh(new THREE.CylinderGeometry(r, r * 0.85, len, 8), mat, pivot, 0, -len / 2, 0);
      if (endMat) mesh(new THREE.BoxGeometry(0.16, 0.1, 0.28), endMat, pivot, 0, -len, 0.06);
      else mesh(new THREE.SphereGeometry(r * 1.05, 8, 6), skinM, pivot, 0, -len, 0);
      return pivot;
    };
    this.legL = limb(0.11, 0.8, 0.78, 0.09, pantsM, shoeM);
    this.legR = limb(-0.11, 0.8, 0.78, 0.09, pantsM, shoeM);
    this.armL = limb(0.3, 1.46, 0.6, 0.065, shirtM, null);
    this.armR = limb(-0.3, 1.46, 0.6, 0.065, shirtM, null);

    // pistola nella mano destra, nascosta finché non la prendi
    this.gun = new THREE.Group();
    const steel = m('#2a2c30');
    mesh(new THREE.BoxGeometry(0.06, 0.26, 0.1), steel, this.gun, 0, -0.1, 0.02);
    mesh(new THREE.BoxGeometry(0.05, 0.1, 0.14), m('#4a3020'), this.gun, 0, 0.02, -0.02);
    this.gun.position.set(0, -0.62, 0.04);
    this.gun.visible = false;
    this.armR.add(this.gun);
    this.muzzle = new THREE.Object3D();
    this.muzzle.position.set(0, -0.24, 0.02);
    this.gun.add(this.muzzle);

    this.armed = false;
    this.aimPitch = 0;
    this.sitting = false;
  }

  // cambia pelle, capelli e maglia (nel sogno condiviso chi entra veste da amico)
  setLook({ skin, hair, shirt }) {
    if (skin) this.looks.skin.color.set(skin);
    if (hair) this.looks.hair.color.set(hair);
    if (shirt) this.looks.shirt.color.set(shirt);
  }

  setArmed(v) {
    this.armed = v;
    this.gun.visible = v;
  }

  track(o) {
    this.disposables.push(o);
    return o;
  }

  kick() {
    this.kickT = 0;
  }

  // speed: velocità orizzontale attuale; per le animazioni
  animate(dt, speed, burdened = 0) {
    const s = clamp(speed / 6, 0, 1.6);
    this.walkPhase += dt * (4 + speed * 1.6);
    const sw = Math.sin(this.walkPhase) * 0.75 * s;
    this.legL.rotation.x = sw;
    this.legR.rotation.x = -sw;
    this.armL.rotation.x = -sw * 0.8;
    this.armR.rotation.x = sw * 0.8;
    this.body.position.y = Math.abs(Math.sin(this.walkPhase)) * 0.06 * s;
    // agitarsi quando si è pieni di gnomi
    if (burdened > 0) {
      const w = Math.sin(this.walkPhase * 3) * 0.6 * Math.min(1, burdened / 20);
      this.armL.rotation.z = 0.4 + w;
      this.armR.rotation.z = -0.4 - w;
    } else {
      this.armL.rotation.z *= 0.9;
      this.armR.rotation.z *= 0.9;
    }
    if (this.kickT < 1) {
      this.kickT = Math.min(1, this.kickT + dt * 3.2);
      const k = Math.sin(this.kickT * Math.PI);
      this.legR.rotation.x = -1.6 * k;
      this.body.rotation.x = 0.15 * k;
    } else this.body.rotation.x = 0;
    if (!this.grounded) {
      this.legL.rotation.x = -0.5;
      this.legR.rotation.x = 0.3;
      this.armL.rotation.z = 1.2;
      this.armR.rotation.z = -1.2;
    }
    if (this.armed && !this.sitting) {
      // mira a due mani nella direzione in cui guardi
      this.armR.rotation.x = -1.5 - this.aimPitch;
      this.armR.rotation.z = 0.12;
      this.armL.rotation.x = -1.35 - this.aimPitch;
      this.armL.rotation.z = -0.45;
    }
    if (this.sitting) {
      this.legL.rotation.x = -1.45;
      this.legR.rotation.x = -1.45;
      this.armL.rotation.x = -0.7;
      this.armR.rotation.x = -0.7;
      this.armL.rotation.z = 0;
      this.armR.rotation.z = 0;
      this.body.position.y = -0.36;
      this.body.rotation.x = 0;
    }
    this.group.position.copy(this.pos);
    this.group.rotation.y = this.facing;
  }

  muzzleWorld(out = new THREE.Vector3()) {
    return this.muzzle.getWorldPosition(out);
  }

  // Collisione cerchio-rettangoli (muri e arredi).
  collide(boxes) {
    const r = this.radius;
    for (const b of boxes) {
      const cx = clamp(this.pos.x, b.minX, b.maxX);
      const cz = clamp(this.pos.z, b.minZ, b.maxZ);
      const dx = this.pos.x - cx;
      const dz = this.pos.z - cz;
      const d2 = dx * dx + dz * dz;
      if (d2 >= r * r) continue;
      if (d2 < 1e-8) {
        // dentro il rettangolo: esce dal lato più vicino
        const opts = [
          [b.minX - r - this.pos.x, 0],
          [b.maxX + r - this.pos.x, 0],
          [0, b.minZ - r - this.pos.z],
          [0, b.maxZ + r - this.pos.z],
        ].sort((p, q) => Math.hypot(...p) - Math.hypot(...q));
        this.pos.x += opts[0][0];
        this.pos.z += opts[0][1];
        continue;
      }
      const d = Math.sqrt(d2);
      this.pos.x = cx + (dx / d) * r;
      this.pos.z = cz + (dz / d) * r;
      const vn = (this.vel.x * dx + this.vel.z * dz) / d;
      if (vn < 0) {
        this.vel.x -= (vn * dx) / d;
        this.vel.z -= (vn * dz) / d;
      }
    }
  }

  dispose() {
    this.disposables.forEach((d) => d.dispose());
    this.group.removeFromParent();
  }
}
