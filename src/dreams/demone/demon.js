import * as THREE from 'three';
import { lavaCrackTexture, glowTexture } from '../../core/textures.js';

// Il demone: alto ~170 m, piantato in un punto del campo. Ruota per seguirti
// e lancia macigni incandescenti con il braccio destro.
export class Demon {
  constructor(scene, x, z, groundY) {
    this.group = new THREE.Group();
    this.group.position.set(x, groundY - 4, z);
    scene.add(this.group);
    this.state = 'idle';
    this.t = 0;
    this.cooldown = 3.5;
    this.yaw = 0;
    this.armAngle = 0;
    this.breath = 0;
    this.onRelease = null;
    this.build();
  }

  build() {
    const cracks = lavaCrackTexture();
    cracks.repeat.set(2, 3);
    const skin = new THREE.MeshStandardMaterial({
      color: '#1b1012',
      roughness: 0.85,
      emissive: '#ff4a14',
      emissiveMap: cracks,
      emissiveIntensity: 1.6,
      fog: false,
    });
    this.skin = skin;
    const horn = new THREE.MeshStandardMaterial({ color: '#2a2320', roughness: 0.6, fog: false });
    const eyeMat = new THREE.MeshBasicMaterial({ color: '#ffe070', fog: false });
    this.eyeMat = eyeMat;

    const mesh = (geo, mat, parent, x = 0, y = 0, z = 0) => {
      const m = new THREE.Mesh(geo, mat);
      m.position.set(x, y, z);
      parent.add(m);
      return m;
    };

    // gambe
    for (const sx of [-1, 1]) {
      mesh(new THREE.CylinderGeometry(9, 14, 64, 12), skin, this.group, sx * 16, 32, 0);
      mesh(new THREE.SphereGeometry(16, 12, 8), skin, this.group, sx * 16, 2, 6).scale.set(1, 0.5, 1.6);
    }
    // bacino e busto
    this.torso = new THREE.Group();
    this.torso.position.y = 64;
    this.group.add(this.torso);
    mesh(new THREE.SphereGeometry(24, 16, 12), skin, this.torso, 0, 4, 0).scale.set(1.2, 0.7, 0.9);
    mesh(new THREE.CylinderGeometry(34, 20, 58, 14), skin, this.torso, 0, 34, 0).scale.set(1, 1, 0.65);
    mesh(new THREE.SphereGeometry(30, 16, 12), skin, this.torso, 0, 62, 0).scale.set(1.35, 0.6, 0.75);

    // testa
    this.head = new THREE.Group();
    this.head.position.set(0, 80, 4);
    this.torso.add(this.head);
    mesh(new THREE.SphereGeometry(16, 16, 12), skin, this.head, 0, 0, 0).scale.set(1, 1.1, 1);
    mesh(new THREE.BoxGeometry(22, 10, 16), skin, this.head, 0, -9, 5); // mascella
    for (const sx of [-1, 1]) {
      mesh(new THREE.SphereGeometry(2.8, 10, 8), eyeMat, this.head, sx * 6.5, 3, 14);
      // corna curve fatte a segmenti
      let parent = this.head;
      let px = sx * 11;
      let py = 10;
      for (let k = 0; k < 5; k++) {
        const r0 = 5 - k * 0.9;
        const seg = mesh(new THREE.CylinderGeometry(Math.max(0.3, r0 - 0.9), r0, 10, 8), horn, parent, px, py, 0);
        seg.rotation.z = -sx * (0.45 - k * 0.2);
        seg.rotation.x = -0.2;
        parent = seg;
        px = 0;
        py = 9;
      }
    }
    const mouth = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture('rgba(255,120,30,1)'), color: '#ff6a20', blending: THREE.AdditiveBlending, depthWrite: false, fog: false }));
    mouth.scale.set(22, 10, 1);
    mouth.position.set(0, -9, 14);
    this.head.add(mouth);

    // braccia: spalla -> braccio -> gomito -> avambraccio -> mano
    this.arms = [];
    for (const sx of [-1, 1]) {
      const shoulder = new THREE.Group();
      shoulder.position.set(sx * 44, 60, 0);
      this.torso.add(shoulder);
      mesh(new THREE.SphereGeometry(13, 12, 10), skin, shoulder);
      mesh(new THREE.CylinderGeometry(8, 10, 40, 10), skin, shoulder, 0, -20, 0);
      const elbow = new THREE.Group();
      elbow.position.y = -40;
      shoulder.add(elbow);
      mesh(new THREE.CylinderGeometry(9, 7, 38, 10), skin, elbow, 0, -19, 0);
      const hand = new THREE.Group();
      hand.position.y = -41;
      elbow.add(hand);
      mesh(new THREE.SphereGeometry(10, 12, 10), skin, hand).scale.set(1, 1.2, 0.8);
      for (let f = 0; f < 4; f++) {
        const claw = mesh(new THREE.ConeGeometry(1.6, 9, 6), horn, hand, (f - 1.5) * 4, -12, 3);
        claw.rotation.x = Math.PI + 0.3;
      }
      shoulder.rotation.z = sx * 0.12;
      this.arms.push({ shoulder, elbow, hand, side: sx });
    }
    this.throwArm = this.arms[0];

    // macigno che cresce nella mano durante la carica
    this.heldRock = new THREE.Mesh(
      new THREE.IcosahedronGeometry(1, 1),
      new THREE.MeshStandardMaterial({ color: '#2a2020', emissive: '#ff5a10', emissiveIntensity: 1.5, roughness: 0.9, fog: false }),
    );
    this.heldRock.position.set(0, -14, 6);
    this.heldRock.visible = false;
    this.throwArm.hand.add(this.heldRock);

    // alone rosso
    const aura = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture('rgba(255,60,20,0.7)'), color: '#ff3010', blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0.35, fog: false }));
    aura.scale.set(320, 320, 1);
    aura.position.y = 110;
    this.group.add(aura);
    this.aura = aura;

    this.light = new THREE.PointLight('#ff4a1a', 4, 600, 1);
    this.light.position.set(0, 120, 60);
    this.group.add(this.light);

    this.group.traverse((o) => {
      if (o.isMesh) o.castShadow = false;
    });
  }

  get eyePos() {
    return this.head.getWorldPosition(new THREE.Vector3());
  }

  handWorldPos(out = new THREE.Vector3()) {
    return this.heldRock.getWorldPosition(out);
  }

  // canSee: il demone ti vede; rage 0..1 aumenta la frequenza dei lanci
  update(dt, target, canSee, rage) {
    this.breath += dt;
    // si gira lentamente verso di te
    const dx = target.x - this.group.position.x;
    const dz = target.z - this.group.position.z;
    const want = Math.atan2(dx, dz);
    let d = want - this.yaw;
    d = Math.atan2(Math.sin(d), Math.cos(d));
    this.yaw += d * (1 - Math.exp(-(canSee ? 1.6 : 0.4) * dt));
    this.group.rotation.y = this.yaw;

    const b = Math.sin(this.breath * 1.3);
    this.torso.scale.set(1 + b * 0.012, 1 + b * 0.008, 1 + b * 0.012);
    this.head.rotation.x = Math.sin(this.breath * 0.7) * 0.05 + (canSee ? 0.12 : -0.05);
    this.skin.emissiveIntensity = 1.4 + Math.sin(this.breath * 3) * 0.3 + (this.state === 'windup' ? 1 : 0);
    this.arms[1].shoulder.rotation.x = Math.sin(this.breath * 0.8) * 0.1 - 0.15;

    this.t += dt;
    const arm = this.throwArm;
    switch (this.state) {
      case 'idle':
        this.cooldown -= dt;
        this.armAngle += (0 - this.armAngle) * (1 - Math.exp(-3 * dt));
        arm.elbow.rotation.x = -0.2;
        if (canSee && this.cooldown <= 0) {
          this.state = 'windup';
          this.t = 0;
          this.heldRock.visible = true;
        }
        break;
      case 'windup': {
        const k = Math.min(1, this.t / 0.95);
        const e = k * k * (3 - 2 * k);
        this.armAngle = e * 2.5;
        arm.elbow.rotation.x = -0.2 - e * 1.1;
        this.heldRock.scale.setScalar(2 + e * 7);
        if (k >= 1) {
          this.state = 'throw';
          this.t = 0;
          this.released = false;
        }
        break;
      }
      case 'throw': {
        const k = Math.min(1, this.t / 0.38);
        this.armAngle = 2.5 + k * k * 2.8;
        arm.elbow.rotation.x = -1.3 + k * 1.3;
        if (!this.released && this.armAngle > 3.75) {
          this.released = true;
          const p = this.handWorldPos();
          this.heldRock.visible = false;
          this.onRelease?.(p);
        }
        if (k >= 1) {
          this.state = 'recover';
          this.t = 0;
          this.armAngle -= Math.PI * 2;
        }
        break;
      }
      case 'recover':
        this.armAngle += (0 - this.armAngle) * (1 - Math.exp(-4 * dt));
        arm.elbow.rotation.x += (-0.2 - arm.elbow.rotation.x) * (1 - Math.exp(-4 * dt));
        if (this.t > 0.45) {
          this.state = 'idle';
          const base = 1.9 - rage * 0.9;
          this.cooldown = base * (0.75 + Math.random() * 0.5);
        }
        break;
    }
    arm.shoulder.rotation.x = this.armAngle;
  }

  dispose() {
    this.group.traverse((o) => {
      if (o.geometry) o.geometry.dispose();
      if (o.material) {
        o.material.map?.dispose();
        o.material.emissiveMap?.dispose();
        o.material.dispose();
      }
    });
    this.group.removeFromParent();
  }
}
