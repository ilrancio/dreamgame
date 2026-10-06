import * as THREE from 'three';
import { clamp } from '../../core/noise.js';

// Il Pellicano: un biplano rosso a due posti (tu davanti, il tuo amico dietro).
// Volo da sala giochi: W sale, S scende, A e D virano, Shift spinge,
// Spazio spara con le due mitragliatrici.
export const MIN_SPEED = 24;
export const CRUISE = 38;
export const BOOST = 60;

export class Biplane {
  constructor(scene) {
    this.group = new THREE.Group();
    this.body = new THREE.Group();
    this.group.add(this.body);
    scene.add(this.group);
    this.disposables = [];
    this.build();
    this.pos = new THREE.Vector3();
    this.yaw = 0;
    this.pitch = 0;
    this.roll = 0;
    this.speed = CRUISE;
    this.boost = 1;
    this.hp = 1;
    this.fireT = 0;
    this.gunSide = 1;
    this.fwd = new THREE.Vector3(0, 0, 1);
    this.hurtT = 0;
    // i proiettili
    this.bullets = [];
    const bg = this.track(new THREE.BoxGeometry(0.12, 0.12, 2.4));
    this.bulletMesh = new THREE.InstancedMesh(bg, this.track(new THREE.MeshBasicMaterial({ color: '#fff2a0' })), 80);
    this.bulletMesh.frustumCulled = false;
    this.bulletMesh.count = 0;
    scene.add(this.bulletMesh);
  }

  track(o) {
    this.disposables.push(o);
    return o;
  }

  build() {
    const red = this.track(new THREE.MeshStandardMaterial({ color: '#d8302a', roughness: 0.5 }));
    const cream = this.track(new THREE.MeshStandardMaterial({ color: '#f4ead0', roughness: 0.6 }));
    const dark = this.track(new THREE.MeshStandardMaterial({ color: '#2a2a2a', roughness: 0.6 }));
    const wood = this.track(new THREE.MeshStandardMaterial({ color: '#8a5a32', roughness: 0.7 }));
    const add = (geo, m, x, y, z, sx = 1, sy = 1, sz = 1) => {
      const o = new THREE.Mesh(this.track(geo), m);
      o.position.set(x, y, z);
      o.scale.set(sx, sy, sz);
      o.castShadow = true;
      this.body.add(o);
      return o;
    };
    // fusoliera lungo +z (il muso)
    add(new THREE.CylinderGeometry(0.62, 0.32, 6.2, 12).rotateX(Math.PI / 2), red, 0, 1.2, -0.2);
    add(new THREE.CylinderGeometry(0.7, 0.66, 0.6, 14).rotateX(Math.PI / 2), dark, 0, 1.2, 3.1);
    // ali: due piani
    add(new THREE.BoxGeometry(9.6, 0.12, 1.5), cream, 0, 0.75, 1.2);
    add(new THREE.BoxGeometry(10.4, 0.12, 1.5), cream, 0, 2.55, 1.4);
    for (const x of [-3.8, 3.8, -1.2, 1.2]) add(new THREE.BoxGeometry(0.08, 1.8, 0.08), wood, x, 1.65, 1.3);
    // coda
    add(new THREE.BoxGeometry(3.4, 0.08, 1.0), cream, 0, 1.35, -3.1);
    add(new THREE.BoxGeometry(0.08, 1.3, 1.0), red, 0, 1.9, -3.2);
    // abitacoli
    add(new THREE.BoxGeometry(0.7, 0.18, 0.8), dark, 0, 1.78, 0.3);
    add(new THREE.BoxGeometry(0.7, 0.18, 0.8), dark, 0, 1.78, -1.0);
    // carrello
    for (const s of [-1, 1]) {
      add(new THREE.BoxGeometry(0.06, 0.9, 0.06), dark, s * 0.8, 0.45, 1.6);
      add(new THREE.CylinderGeometry(0.34, 0.34, 0.16, 12).rotateZ(Math.PI / 2), dark, s * 0.85, 0.34, 1.6);
    }
    // l'elica
    this.prop = new THREE.Group();
    this.prop.position.set(0, 1.2, 3.45);
    const blade = new THREE.Mesh(this.track(new THREE.BoxGeometry(0.16, 2.6, 0.06)), wood);
    this.prop.add(blade);
    this.body.add(this.prop);
    // due teste: tu e il tuo amico
    const head = (skin, hair, z) => {
      const h = new THREE.Mesh(this.track(new THREE.SphereGeometry(0.2, 12, 10)), this.track(new THREE.MeshStandardMaterial({ color: skin })));
      h.position.set(0, 2.05, z);
      const c = new THREE.Mesh(this.track(new THREE.SphereGeometry(0.22, 12, 8, 0, Math.PI * 2, 0, Math.PI * 0.55)), this.track(new THREE.MeshStandardMaterial({ color: '#5a3a22' })));
      c.position.set(0, 2.1, z);
      this.body.add(h, c);
      void hair;
    };
    head('#e0b089', '#3b2a1e', 0.3);
    head('#c99470', '#141414', -1.0);
  }

  place(x, y, z, yaw) {
    this.pos.set(x, y, z);
    this.yaw = yaw;
    this.pitch = 0;
    this.roll = 0;
    this.speed = CRUISE;
    this.sync();
  }

  get forward() {
    const cp = Math.cos(this.pitch);
    return this.fwd.set(Math.sin(this.yaw) * cp, Math.sin(this.pitch), Math.cos(this.yaw) * cp);
  }

  // ctl: { up, down, left, right, boost, fire }; ground(x,z) → altezza
  update(dt, ctl, ground, assist = null) {
    const turn = (ctl.left ? 1 : 0) - (ctl.right ? 1 : 0);
    const climb = (ctl.up ? 1 : 0) - (ctl.down ? 1 : 0);
    this.yaw += turn * 1.25 * dt;
    this.pitch = clamp(this.pitch + climb * 1.1 * dt, -0.9, 0.9);
    if (!climb) this.pitch *= Math.exp(-0.9 * dt);
    this.roll += (-turn * 0.75 - this.roll) * (1 - Math.exp(-5 * dt));
    const boosting = ctl.boost && this.boost > 0.02;
    this.boost = boosting ? Math.max(0, this.boost - dt * 0.22) : Math.min(1, this.boost + dt * 0.1);
    const target = boosting ? BOOST : CRUISE;
    this.speed += (target - this.speed) * (1 - Math.exp(-1.2 * dt)) - Math.sin(this.pitch) * 9 * dt;
    this.speed = clamp(this.speed, MIN_SPEED, BOOST + 8);
    const f = this.forward;
    this.pos.addScaledVector(f, this.speed * dt);
    // il suolo e il mare: si rimbalza, e fa male
    const g = Math.max(ground(this.pos.x, this.pos.z), 0) + 2.2;
    this.scraped = false;
    if (this.pos.y < g) {
      this.pos.y = g;
      this.pitch = Math.max(this.pitch, 0.35);
      this.scraped = true;
    }
    if (this.pos.y > 420) {
      this.pos.y = 420;
      this.pitch = Math.min(this.pitch, 0);
    }
    // troppo lontano: l'aereo torna da solo verso l'isola
    this.outside = Math.hypot(this.pos.x, this.pos.z) > 950;
    if (this.outside) {
      const want = Math.atan2(-this.pos.x, -this.pos.z);
      let d = want - this.yaw;
      d = Math.atan2(Math.sin(d), Math.cos(d));
      this.yaw += clamp(d, -1, 1) * 1.2 * dt;
    }
    // le mitragliatrici
    this.fireT -= dt;
    if (ctl.fire && this.fireT <= 0) {
      this.fireT = 1 / 12;
      this.gunSide *= -1;
      const right = new THREE.Vector3(Math.cos(this.yaw), 0, -Math.sin(this.yaw));
      const dir = f.clone();
      // un piccolo aiuto: i colpi piegano verso il bersaglio più vicino al mirino
      if (assist) {
        const to = assist.clone().sub(this.pos).normalize();
        if (to.dot(dir) > 0.975) dir.lerp(to, 0.8).normalize();
      }
      const o = this.pos.clone().addScaledVector(right, this.gunSide * 0.7).addScaledVector(f, 3.5);
      o.y += 1.6;
      this.bullets.push({ p: o, v: dir.multiplyScalar(170 + this.speed), life: 1.3 });
      this.shot = true;
    } else this.shot = false;
    const M4 = new THREE.Matrix4();
    const Q = new THREE.Quaternion();
    const S = new THREE.Vector3(1, 1, 1);
    let k = 0;
    for (let i = this.bullets.length - 1; i >= 0; i--) {
      const b = this.bullets[i];
      b.life -= dt;
      b.p.addScaledVector(b.v, dt);
      if (b.life <= 0 || b.dead) {
        this.bullets.splice(i, 1);
        continue;
      }
      Q.setFromUnitVectors(new THREE.Vector3(0, 0, 1), b.v.clone().normalize());
      if (k < 80) this.bulletMesh.setMatrixAt(k++, M4.compose(b.p, Q, S));
    }
    this.bulletMesh.count = k;
    this.bulletMesh.instanceMatrix.needsUpdate = true;
    this.hurtT = Math.max(0, this.hurtT - dt);
    this.prop.rotation.z += dt * (20 + this.speed);
    this.sync();
  }

  sync() {
    this.group.position.copy(this.pos);
    this.group.rotation.set(0, 0, 0);
    this.group.rotation.order = 'YXZ';
    this.group.rotation.set(-this.pitch, this.yaw, this.roll);
    this.group.position.y -= 1.2;
  }

  dispose() {
    this.disposables.forEach((d) => d.dispose());
    this.group.removeFromParent();
    this.bulletMesh.removeFromParent();
  }
}
