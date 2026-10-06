import * as THREE from 'three';
import { clamp } from '../../core/noise.js';

const G = 28;
const MAX_SPEED = 56; // ~200 km/h
const TURBO_SPEED = 80; // ~290 km/h

// Decappottabile: così il tuo amico è sempre visibile accanto a te.
export class Car {
  constructor(scene, { maxSpeed = MAX_SPEED, turboSpeed = TURBO_SPEED } = {}) {
    this.radius = 2.4;
    this.maxSpeed = maxSpeed;
    this.turboSpeed = turboSpeed;
    this.group = new THREE.Group();
    this.body = new THREE.Group();
    this.group.add(this.body);
    this.build();
    scene.add(this.group);

    this.pos = new THREE.Vector3();
    this.vx = 0;
    this.vz = 0;
    this.vy = 0;
    this.heading = 0;
    this.grounded = true;
    this.airTime = 0;
    this.lastGround = 0;
    this.up = new THREE.Vector3(0, 1, 0);
    this.turbo = 1;
    this.steerVis = 0;
    this.wheelSpin = 0;
    this.speed = 0;
    this.forwardSpeed = 0;
    this.onLand = null;
  }

  build() {
    const paint = new THREE.MeshStandardMaterial({ color: '#c42b2b', metalness: 0.35, roughness: 0.35 });
    const dark = new THREE.MeshStandardMaterial({ color: '#1c1d22', roughness: 0.8 });
    const chrome = new THREE.MeshStandardMaterial({ color: '#d8dde4', metalness: 0.9, roughness: 0.2 });
    const glass = new THREE.MeshStandardMaterial({ color: '#9fc6ff', transparent: true, opacity: 0.35, roughness: 0.05 });
    const seat = new THREE.MeshStandardMaterial({ color: '#5a3322', roughness: 0.9 });

    const add = (geo, mat, x, y, z, parent = this.body) => {
      const m = new THREE.Mesh(geo, mat);
      m.position.set(x, y, z);
      m.castShadow = true;
      parent.add(m);
      return m;
    };

    // carrozzeria
    add(new THREE.BoxGeometry(2.1, 0.55, 4.6), paint, 0, 0.72, 0);
    add(new THREE.BoxGeometry(2.0, 0.25, 1.6), paint, 0, 1.08, 1.4); // cofano
    add(new THREE.BoxGeometry(2.0, 0.3, 1.1), paint, 0, 1.1, -1.75); // baule
    add(new THREE.BoxGeometry(0.2, 0.3, 1.9), paint, 1.0, 1.1, -0.1);
    add(new THREE.BoxGeometry(0.2, 0.3, 1.9), paint, -1.0, 1.1, -0.1);
    add(new THREE.BoxGeometry(2.2, 0.25, 0.25), chrome, 0, 0.55, 2.35);
    add(new THREE.BoxGeometry(2.2, 0.25, 0.25), chrome, 0, 0.55, -2.35);
    // parabrezza
    const ws = add(new THREE.BoxGeometry(1.9, 0.6, 0.06), glass, 0, 1.45, 0.62);
    ws.rotation.x = -0.35;
    ws.castShadow = false;
    // sedili
    add(new THREE.BoxGeometry(0.7, 0.25, 0.7), seat, 0.45, 0.95, -0.35);
    add(new THREE.BoxGeometry(0.7, 0.25, 0.7), seat, -0.45, 0.95, -0.35);
    add(new THREE.BoxGeometry(0.7, 0.7, 0.18), seat, 0.45, 1.3, -0.72);
    add(new THREE.BoxGeometry(0.7, 0.7, 0.18), seat, -0.45, 1.3, -0.72);
    // volante
    const wheel = add(new THREE.TorusGeometry(0.2, 0.035, 8, 20), dark, 0.45, 1.35, 0.25);
    wheel.rotation.x = -0.9;

    // fari
    const headMat = new THREE.MeshStandardMaterial({ color: '#fff', emissive: '#fff4d0', emissiveIntensity: 2 });
    add(new THREE.BoxGeometry(0.45, 0.18, 0.08), headMat, 0.7, 0.85, 2.31);
    add(new THREE.BoxGeometry(0.45, 0.18, 0.08), headMat, -0.7, 0.85, 2.31);
    this.tailMat = new THREE.MeshStandardMaterial({ color: '#400', emissive: '#ff2020', emissiveIntensity: 0.6 });
    add(new THREE.BoxGeometry(0.4, 0.15, 0.08), this.tailMat, 0.7, 0.9, -2.31);
    add(new THREE.BoxGeometry(0.4, 0.15, 0.08), this.tailMat, -0.7, 0.9, -2.31);

    // tu (a sinistra, alla guida) e il tuo amico
    this.driver = this.person('#e0b089', '#3b2a1e', '#2f4f8f', 0.45);
    this.friend = this.person('#c99470', '#141414', '#d9a82e', -0.45);

    // ruote
    const tire = new THREE.CylinderGeometry(0.44, 0.44, 0.34, 18);
    tire.rotateZ(Math.PI / 2);
    const hub = new THREE.CylinderGeometry(0.22, 0.22, 0.36, 10);
    hub.rotateZ(Math.PI / 2);
    this.wheels = [];
    for (const [x, z, front] of [[1.05, 1.45, true], [-1.05, 1.45, true], [1.05, -1.45, false], [-1.05, -1.45, false]]) {
      const pivot = new THREE.Group();
      pivot.position.set(x, 0.44, z);
      this.body.add(pivot);
      const spin = new THREE.Group();
      pivot.add(spin);
      add(tire, dark, 0, 0, 0, spin);
      add(hub, chrome, 0, 0, 0, spin);
      this.wheels.push({ pivot, spin, front });
    }

    // luce dei fari (conta di notte)
    this.headlight = new THREE.SpotLight('#ffe8c0', 0, 160, 0.45, 0.5, 1);
    this.headlight.position.set(0, 1, 2.2);
    this.headlight.target.position.set(0, -2, 30);
    this.body.add(this.headlight, this.headlight.target);
  }

  person(skin, hair, shirt, x) {
    const g = new THREE.Group();
    g.position.set(x, 1.05, -0.35);
    const torso = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.26, 0.6, 10), new THREE.MeshStandardMaterial({ color: shirt, roughness: 0.9 }));
    torso.position.y = 0.35;
    const head = new THREE.Group();
    head.position.y = 0.85;
    const face = new THREE.Mesh(new THREE.SphereGeometry(0.19, 16, 12), new THREE.MeshStandardMaterial({ color: skin, roughness: 0.8 }));
    const hairM = new THREE.Mesh(new THREE.SphereGeometry(0.2, 16, 12, 0, Math.PI * 2, 0, Math.PI * 0.55), new THREE.MeshStandardMaterial({ color: hair, roughness: 1 }));
    hairM.position.y = 0.03;
    hairM.rotation.x = -0.25;
    head.add(face, hairM);
    [torso, face, hairM].forEach((m) => (m.castShadow = true));
    g.add(torso, head);
    this.body.add(g);
    return { group: g, head };
  }

  reset(x, z, heading, terrain) {
    this.pos.set(x, terrain.heightAt(x, z) + 0.5, z);
    this.heading = heading;
    this.vx = this.vz = this.vy = 0;
    this.grounded = false;
    this.lastGround = terrain.heightAt(x, z);
    terrain.normalAt(x, z, this.up, 2.5);
    this.syncMesh(1);
  }

  get fwdX() {
    return Math.sin(this.heading);
  }

  get fwdZ() {
    return Math.cos(this.heading);
  }

  update(dt, ctl, terrain, surface) {
    const fx = Math.sin(this.heading);
    const fz = Math.cos(this.heading);
    const sx = fz;
    const sz = -fx;
    let vf = this.vx * fx + this.vz * fz;
    let vs = this.vx * sx + this.vz * sz;

    const touching = this.grounded || this.pos.y - terrain.heightAt(this.pos.x, this.pos.z) < 0.35;
    const turboOn = ctl.turbo && this.turbo > 0.02 && ctl.throttle > 0 && touching;
    this.turboActive = turboOn;
    if (turboOn) this.turbo = Math.max(0, this.turbo - dt * 0.28);
    else this.turbo = Math.min(1, this.turbo + dt * 0.09);

    if (touching) {
      const maxF = turboOn ? this.turboSpeed : this.maxSpeed;
      const acc = turboOn ? 34 : 21;
      if (ctl.throttle > 0 && vf < maxF) vf += acc * dt * (1 - (Math.max(0, vf) / maxF) * 0.55);
      if (ctl.brake > 0) {
        if (vf > 0.5) vf -= 48 * dt;
        else if (vf > -18) vf -= 16 * dt;
      }
      if (vf > maxF) vf -= (vf - maxF) * 1.2 * dt;

      const drag = { road: 0.05, dirt: 0.12, grass: 0.1, rough: 0.9 }[surface] ?? 0.1;
      vf -= vf * drag * dt;
      if (ctl.throttle === 0 && ctl.brake === 0) vf -= Math.sign(vf) * Math.min(Math.abs(vf), 4 * dt);

      // la pendenza rallenta in salita e spinge in discesa
      const hA = terrain.heightAt(this.pos.x + fx * 2.5, this.pos.z + fz * 2.5);
      const hB = terrain.heightAt(this.pos.x - fx * 2.5, this.pos.z - fz * 2.5);
      const slope = (hA - hB) / 5;
      vf -= G * 0.8 * slope * dt;
      // fuoristrada in montagna: i pendii ripidi sono muri
      if (surface === 'rough') {
        const n = terrain.normalAt(this.pos.x, this.pos.z);
        const steep = clamp((0.85 - n.y) * 4, 0, 1);
        this.vx += n.x * steep * 40 * dt;
        this.vz += n.z * steep * 40 * dt;
      }

      const sp = Math.abs(vf);
      let steerRate = (2.3 * Math.min(1, sp / 5)) / (1 + sp / 50);
      let grip = surface === 'road' ? 9 : 6.5;
      if (ctl.handbrake) {
        steerRate *= 1.6;
        grip = 1.4;
        vf *= Math.exp(-0.5 * dt);
      }
      this.heading += ctl.steer * steerRate * dt * (vf < -0.5 ? -1 : 1);
      vs *= Math.exp(-grip * dt);
      this.drifting = Math.abs(vs) > 6;
    } else {
      this.drifting = false;
      this.heading += ctl.steer * 0.6 * dt;
    }

    // la velocità resta negli assi vecchi: la differenza con la nuova direzione è la derapata
    this.vx = fx * vf + sx * vs;
    this.vz = fz * vf + sz * vs;
    this.forwardSpeed = vf;
    this.speed = Math.hypot(this.vx, this.vz);

    this.pos.x += this.vx * dt;
    this.pos.z += this.vz * dt;
    this.pos.x = clamp(this.pos.x, -1480, 1480);
    this.pos.z = clamp(this.pos.z, -1480, 1480);

    // verticale: segue il terreno, ma sulle creste decolla
    const gh = terrain.heightAt(this.pos.x, this.pos.z);
    const groundVel = clamp((gh - this.lastGround) / dt, -60, 60);
    this.lastGround = gh;
    this.vy -= G * dt;
    this.pos.y += this.vy * dt;
    if (this.pos.y <= gh) {
      if (!this.grounded && this.airTime > 0.35 && this.onLand) this.onLand(-this.vy + groundVel, this.airTime);
      this.pos.y = gh;
      this.vy = Math.max(this.vy, groundVel * 0.9);
      this.grounded = true;
      this.airTime = 0;
    } else {
      this.grounded = this.pos.y - gh < 0.15;
      if (!this.grounded) this.airTime += dt;
    }

    // orientamento: segue la normale del terreno (in aria resta com'è)
    if (this.grounded) {
      const n = terrain.normalAt(this.pos.x, this.pos.z, new THREE.Vector3(), 2.5);
      this.up.lerp(n, 1 - Math.exp(-12 * dt)).normalize();
    }

    this.steerVis += (ctl.steer - this.steerVis) * (1 - Math.exp(-10 * dt));
    this.wheelSpin += vf * dt / 0.44;
    this.tailMat.emissiveIntensity = ctl.brake > 0 ? 3 : 0.6;
    this.syncMesh(dt);
  }

  syncMesh(dt) {
    const fwd = new THREE.Vector3(Math.sin(this.heading), 0, Math.cos(this.heading));
    const up = this.up;
    const right = new THREE.Vector3().crossVectors(up, fwd).normalize();
    const f2 = new THREE.Vector3().crossVectors(right, up).normalize();
    const m = new THREE.Matrix4().makeBasis(right, up, f2);
    const q = new THREE.Quaternion().setFromRotationMatrix(m);
    this.group.quaternion.slerp(q, dt >= 1 ? 1 : 1 - Math.exp(-18 * dt));
    this.group.position.copy(this.pos);
    // piccolo rollio in curva
    this.body.rotation.z = -this.steerVis * Math.min(1, this.speed / 40) * 0.06;
    this.body.rotation.x = this.turboActive ? -0.03 : 0;
    for (const w of this.wheels) {
      w.spin.rotation.x = this.wheelSpin;
      if (w.front) w.pivot.rotation.y = this.steerVis * 0.45;
    }
  }

  // Urto contro un cerchio (macigno, albero, gamba del demone). Ritorna la velocità d'impatto.
  collideCircle(cx, cz, r, bounce = 0.35) {
    const dx = this.pos.x - cx;
    const dz = this.pos.z - cz;
    const d = Math.hypot(dx, dz);
    const minD = r + this.radius;
    if (d >= minD || d < 1e-4) return 0;
    const nx = dx / d;
    const nz = dz / d;
    this.pos.x = cx + nx * minD;
    this.pos.z = cz + nz * minD;
    const vn = this.vx * nx + this.vz * nz;
    if (vn >= 0) return 0;
    this.vx -= (1 + bounce) * vn * nx;
    this.vz -= (1 + bounce) * vn * nz;
    return -vn;
  }

  collideBox(minX, maxX, minZ, maxZ) {
    const cx = clamp(this.pos.x, minX, maxX);
    const cz = clamp(this.pos.z, minZ, maxZ);
    const dx = this.pos.x - cx;
    const dz = this.pos.z - cz;
    const d = Math.hypot(dx, dz);
    if (d >= this.radius) return 0;
    if (d < 1e-4) {
      this.pos.z = minZ - this.radius;
      this.vz = -Math.abs(this.vz) * 0.3;
      return 10;
    }
    return this.collideCircle(cx, cz, 0.001, 0.3);
  }

  dispose() {
    this.group.traverse((o) => {
      if (o.geometry) o.geometry.dispose();
      if (o.material) o.material.dispose();
    });
    this.group.removeFromParent();
  }
}
