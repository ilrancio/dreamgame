import * as THREE from 'three';
import { clamp } from '../../core/noise.js';
import { glowTexture } from '../../core/textures.js';

// Il Gabbiano di Ferro: un gabbiano meccanico grande come un traghetto, che
// gira intorno all'isola. È lui che ha sparpagliato la tua patente.
// Prima fase: quattro turbine sotto le ali (i punti deboli, arancioni).
// Seconda fase: si apre lo sportello sul petto e si vede il cuore rosso.
// Spara piume d'acciaio che ti inseguono (si possono abbattere).

const TURBINE_HP = 14;
const CORE_HP = 30;

export class IronGull {
  constructor(scene) {
    this.disposables = [];
    this.group = new THREE.Group();
    this.group.rotation.order = 'YXZ';
    scene.add(this.group);
    this.build();
    this.pos = new THREE.Vector3(0, 120, -300);
    this.vel = new THREE.Vector3();
    this.angle = Math.PI * 1.5;
    this.phase = 1;
    this.t = 0;
    this.fireT = 4;
    this.missiles = [];
    this.dead = false;
    this.dying = 0;
    this.flash = 0;
    const fg = this.track(new THREE.ConeGeometry(0.5, 3.2, 6).rotateX(Math.PI / 2));
    this.featherMesh = new THREE.InstancedMesh(fg, this.track(new THREE.MeshStandardMaterial({ color: '#c8ccd4', metalness: 0.8, roughness: 0.3, emissive: '#ff4a2a', emissiveIntensity: 0.4 })), 40);
    this.featherMesh.frustumCulled = false;
    this.featherMesh.count = 0;
    scene.add(this.featherMesh);
  }

  track(o) {
    this.disposables.push(o);
    return o;
  }

  build() {
    const steel = this.track(new THREE.MeshStandardMaterial({ color: '#b8bec8', metalness: 0.75, roughness: 0.35 }));
    const dark = this.track(new THREE.MeshStandardMaterial({ color: '#4a4e58', metalness: 0.7, roughness: 0.45 }));
    const yellow = this.track(new THREE.MeshStandardMaterial({ color: '#f4b81a', metalness: 0.4, roughness: 0.4 }));
    const add = (geo, m, x, y, z, parent = this.group) => {
      const o = new THREE.Mesh(this.track(geo), m);
      o.position.set(x, y, z);
      o.castShadow = true;
      parent.add(o);
      return o;
    };
    // corpo (il muso guarda +z)
    const body = add(new THREE.SphereGeometry(1, 24, 16), steel, 0, 0, 0);
    body.scale.set(5.5, 5, 14);
    const head = add(new THREE.SphereGeometry(3.8, 20, 14), steel, 0, 2.6, 12.5);
    void head;
    add(new THREE.ConeGeometry(1.4, 6, 12).rotateX(Math.PI / 2), yellow, 0, 2.0, 18.5);
    this.eyeMat = this.track(new THREE.MeshStandardMaterial({ color: '#ff2a1a', emissive: '#ff2a1a', emissiveIntensity: 2 }));
    for (const s of [-1, 1]) add(new THREE.SphereGeometry(0.7, 12, 10), this.eyeMat, s * 2.9, 3.6, 14.5);
    // rivetti e piastre sul dorso
    for (let i = -3; i <= 3; i++) add(new THREE.BoxGeometry(6, 0.3, 1.2), dark, 0, 4.6 - Math.abs(i) * 0.25, i * 3.2);
    // coda a ventaglio
    this.tail = new THREE.Group();
    this.tail.position.set(0, 0.5, -13);
    this.group.add(this.tail);
    for (let i = -3; i <= 3; i++) {
      const f = add(new THREE.BoxGeometry(1.6, 0.25, 8), i % 2 ? steel : dark, i * 1.4, 0, -4, this.tail);
      f.rotation.y = i * 0.12;
    }
    // le ali, in due pezzi per sbattere
    this.wings = [];
    this.turbines = [];
    const glow = this.track(glowTexture('rgba(255,255,255,1)'));
    for (const s of [-1, 1]) {
      const shoulder = new THREE.Group();
      shoulder.position.set(s * 4.5, 1.5, 1);
      this.group.add(shoulder);
      add(new THREE.BoxGeometry(18, 0.9, 9), steel, s * 9, 0, 0, shoulder);
      const elbow = new THREE.Group();
      elbow.position.set(s * 18, 0, 0);
      shoulder.add(elbow);
      const outer = add(new THREE.BoxGeometry(16, 0.7, 7), steel, s * 8, 0, -1, elbow);
      void outer;
      add(new THREE.BoxGeometry(5, 0.6, 5), dark, s * 17, 0, -2.5, elbow);
      for (let k = 0; k < 4; k++) add(new THREE.BoxGeometry(1.2, 0.5, 6), dark, s * (12 + k * 1.6), -0.1, -5 - k * 0.6, elbow);
      this.wings.push({ shoulder, elbow, s });
      // due turbine sotto ogni ala
      for (const [par, x] of [[shoulder, s * 10], [elbow, s * 7]]) {
        const tg = new THREE.Group();
        tg.position.set(x, -1.8, 1);
        par.add(tg);
        add(new THREE.CylinderGeometry(1.5, 1.8, 5, 14).rotateX(Math.PI / 2), dark, 0, 0, 0, tg);
        const coreMat = this.track(new THREE.MeshStandardMaterial({ color: '#ffb02a', emissive: '#ff7a1a', emissiveIntensity: 2.2 }));
        const disc = add(new THREE.CylinderGeometry(1.25, 1.25, 0.3, 14).rotateX(Math.PI / 2), coreMat, 0, 0, 2.55, tg);
        const halo = new THREE.Sprite(this.track(new THREE.SpriteMaterial({ map: glow, color: '#ffa04a', blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0.8 })));
        halo.scale.set(6, 6, 1);
        halo.position.z = 2.8;
        tg.add(halo);
        this.turbines.push({ group: tg, disc, coreMat, halo, hp: TURBINE_HP, alive: true, r: 3.2, smokeT: 0 });
      }
    }
    // lo sportello sul petto e il cuore
    this.hatch = new THREE.Group();
    this.hatch.position.set(0, -3.6, 5);
    this.group.add(this.hatch);
    add(new THREE.BoxGeometry(4.5, 0.4, 6), dark, 0, 0, -3, this.hatch);
    this.coreMat = this.track(new THREE.MeshStandardMaterial({ color: '#ff2a3a', emissive: '#ff1a2a', emissiveIntensity: 2.5 }));
    this.core = add(new THREE.SphereGeometry(2, 16, 12), this.coreMat, 0, -3.2, 2);
    this.core.visible = false;
    this.coreHalo = new THREE.Sprite(this.track(new THREE.SpriteMaterial({ map: glow, color: '#ff3a4a', blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0 })));
    this.coreHalo.scale.set(10, 10, 1);
    this.core.add(this.coreHalo);
    this.coreHp = CORE_HP;
    this.group.scale.setScalar(1.15);
  }

  get health() {
    const t = this.turbines.reduce((a, b) => a + Math.max(0, b.hp), 0) / (TURBINE_HP * 4);
    return this.phase === 1 ? 0.5 + t * 0.5 : Math.max(0, this.coreHp / CORE_HP) * 0.5;
  }

  targets() {
    const out = [];
    const v = new THREE.Vector3();
    if (this.phase === 1) for (const t of this.turbines) if (t.alive) out.push({ obj: t, pos: t.group.getWorldPosition(v.clone()), r: t.r * 1.15 });
    if (this.phase === 2) out.push({ obj: 'core', pos: this.core.getWorldPosition(v.clone()), r: 4.2 });
    return out;
  }

  // il proiettile b colpisce qualcosa? restituisce 'turbine', 'core', 'armor' o null
  hit(b) {
    if (this.dead) return null;
    for (const t of this.targets()) {
      if (t.pos.distanceTo(b.p) < t.r) {
        if (t.obj === 'core') {
          this.coreHp -= 1;
          this.flash = 0.08;
          if (this.coreHp <= 0) this.die();
          return 'core';
        }
        t.obj.hp -= 1;
        t.obj.flash = 0.08;
        if (t.obj.hp <= 0 && t.obj.alive) {
          t.obj.alive = false;
          t.obj.coreMat.emissiveIntensity = 0;
          t.obj.coreMat.color.set('#2a2a2a');
          t.obj.halo.visible = false;
          this.justBroke = true;
          if (this.turbines.every((q) => !q.alive)) this.startPhase2();
        }
        return 'turbine';
      }
    }
    // l'armatura: il proiettile rimbalza
    const local = this.group.worldToLocal(b.p.clone());
    const s = this.group.scale.x;
    if ((local.x / 5.5) ** 2 + (local.y / 5) ** 2 + (local.z / 14) ** 2 < 1 || (Math.abs(local.x) < 40 && Math.abs(local.y) < 1.2 * s && Math.abs(local.z) < 5)) return 'armor';
    return null;
  }

  startPhase2() {
    this.phase = 2;
    this.phaseT = 0;
    this.core.visible = true;
  }

  die() {
    this.dead = true;
    this.dying = 0;
  }

  // player: la posizione dell'aereo. Restituisce gli eventi del fotogramma.
  update(dt, player) {
    const ev = { fired: 0, hits: [] };
    this.t += dt;
    if (this.dead) {
      // cade nel mare, sbilanciato, perdendo pezzi
      this.dying += dt;
      this.vel.y -= 14 * dt;
      this.pos.addScaledVector(this.vel, dt);
      this.group.rotation.z += dt * 0.8;
      this.group.rotation.x += dt * 0.3;
      this.group.position.copy(this.pos);
      for (const w of this.wings) w.shoulder.rotation.z = w.s * Math.sin(this.t * 9) * 0.5;
      if (this.pos.y < -10 && !this.splashed) {
        this.splashed = true;
        ev.splash = true;
      }
      this.updateMissiles(dt, player, ev);
      return ev;
    }
    // il giro intorno all'isola: alto e largo nella prima fase, basso e cattivo nella seconda
    const p2 = this.phase === 2;
    const R = p2 ? 190 : 250;
    const w = p2 ? 0.11 : 0.075;
    this.angle += w * dt;
    const h = p2 ? 70 + Math.sin(this.t * 0.7) * 35 : 115 + Math.sin(this.t * 0.4) * 20;
    const target = new THREE.Vector3(Math.cos(this.angle) * R, h, Math.sin(this.angle) * R);
    // ogni tanto taglia verso di te
    if (p2 && Math.sin(this.t * 0.25) > 0.6) target.lerp(player, 0.35);
    const before = this.pos.clone();
    this.pos.lerp(target, 1 - Math.exp(-0.9 * dt));
    this.vel.subVectors(this.pos, before).divideScalar(Math.max(dt, 1e-3));
    const yaw = Math.atan2(this.vel.x, this.vel.z);
    let d = yaw - this.group.rotation.y;
    d = Math.atan2(Math.sin(d), Math.cos(d));
    this.group.rotation.y += d * (1 - Math.exp(-2 * dt));
    this.group.rotation.z = clamp(-d * 2, -0.5, 0.5);
    this.group.rotation.x = clamp(-this.vel.y * 0.01, -0.3, 0.3);
    this.group.position.copy(this.pos);
    // le ali sbattono piano
    const flap = Math.sin(this.t * (p2 ? 2.4 : 1.6));
    for (const wg of this.wings) {
      wg.shoulder.rotation.z = wg.s * flap * 0.28;
      wg.elbow.rotation.z = wg.s * flap * 0.22;
    }
    this.tail.rotation.x = Math.sin(this.t * 1.3) * 0.08;
    // lo sportello si apre nella seconda fase
    if (p2) {
      this.phaseT += dt;
      this.hatch.rotation.x = Math.min(1.3, this.phaseT * 0.8);
      this.coreHalo.material.opacity = 0.5 + Math.sin(this.t * 6) * 0.3;
      this.coreMat.emissiveIntensity = this.flash > 0 ? 6 : 2.5;
    }
    this.flash = Math.max(0, this.flash - dt);
    for (const t of this.turbines) {
      if (t.alive) {
        t.flash = Math.max(0, (t.flash || 0) - dt);
        t.coreMat.emissiveIntensity = t.flash > 0 ? 6 : 2.2;
        t.disc.rotation.z += dt * 12;
      }
    }
    this.eyeMat.emissiveIntensity = 1.5 + Math.sin(this.t * 3) * 0.8;
    // le piume d'acciaio
    this.fireT -= dt;
    const dist = this.pos.distanceTo(player);
    if (this.fireT <= 0 && dist < 420 && !this.passive) {
      this.fireT = p2 ? 2.6 : 4;
      const n = p2 ? 4 : 3;
      for (let i = 0; i < n; i++) {
        const o = this.pos.clone().add(new THREE.Vector3((i - (n - 1) / 2) * 6, -2, 0).applyEuler(this.group.rotation));
        const dir = player.clone().sub(o).normalize();
        dir.x += (Math.random() - 0.5) * 0.3;
        dir.y += 0.15 + Math.random() * 0.2;
        this.missiles.push({ p: o, v: dir.normalize().multiplyScalar(30), life: 8, dead: false });
      }
      ev.fired = n;
    }
    this.updateMissiles(dt, player, ev);
    return ev;
  }

  updateMissiles(dt, player, ev) {
    const M4 = new THREE.Matrix4();
    const Q = new THREE.Quaternion();
    const S = new THREE.Vector3(1, 1, 1);
    const z = new THREE.Vector3(0, 0, 1);
    let k = 0;
    for (let i = this.missiles.length - 1; i >= 0; i--) {
      const m = this.missiles[i];
      m.life -= dt;
      // inseguono, ma girano piano: si seminano con una virata stretta
      const want = player.clone().sub(m.p).normalize().multiplyScalar(m.v.length());
      m.v.lerp(want, 1 - Math.exp(-0.9 * dt));
      m.v.setLength(Math.min(48, m.v.length() + dt * 6));
      m.p.addScaledVector(m.v, dt);
      if (m.p.distanceTo(player) < 3.4) {
        m.dead = true;
        ev.hits.push(m.p.clone());
      }
      if (m.life <= 0 || m.dead || m.p.y < 0) {
        this.missiles.splice(i, 1);
        continue;
      }
      Q.setFromUnitVectors(z, m.v.clone().normalize());
      if (k < 40) this.featherMesh.setMatrixAt(k++, M4.compose(m.p, Q, S));
    }
    this.featherMesh.count = k;
    this.featherMesh.instanceMatrix.needsUpdate = true;
  }

  // un proiettile può abbattere una piuma
  shootMissile(b) {
    for (const m of this.missiles) {
      if (!m.dead && m.p.distanceTo(b.p) < 2.4) {
        m.dead = true;
        return m.p.clone();
      }
    }
    return null;
  }

  dispose() {
    this.disposables.forEach((d) => d.dispose());
    this.group.removeFromParent();
    this.featherMesh.removeFromParent();
  }
}
