import * as THREE from 'three';

// Le creature del silo, in 3D: si vedono girare intorno alla statua e poi si
// combattono. Ogni modello ha un gruppo, l'altezza (per i numeri dei danni) e
// tre cose che sa fare: respirare (update), lampeggiare quando è colpito,
// sparire quando è sconfitto.

function base(height) {
  const group = new THREE.Group();
  const flashMats = [];
  const disposables = [];
  const track = (o) => (disposables.push(o), o);
  const M = (color, o = {}) => {
    const m = track(new THREE.MeshStandardMaterial({ color, roughness: 0.6, ...o }));
    flashMats.push(m);
    return m;
  };
  const model = {
    group,
    height,
    t: Math.random() * 10,
    flashT: 0,
    dying: 0,
    M,
    track,
    hurt() {
      this.flashT = 0.3;
    },
    die() {
      this.dying = 0.0001;
    },
    revive() {
      this.dying = 0;
      group.scale.setScalar(1);
      group.visible = true;
    },
    step(dt) {
      this.t += dt;
      if (this.flashT > 0) this.flashT -= dt;
      const f = this.flashT > 0 && Math.floor(this.flashT * 30) % 2 === 0;
      for (const m of flashMats) {
        m.emissive ??= new THREE.Color();
        if (m.userData.e === undefined) {
          m.userData.e = m.emissive.clone();
          m.userData.ei = m.emissiveIntensity;
        }
        if (f) {
          m.emissive.set('#ff4040');
          m.emissiveIntensity = 1;
        } else {
          m.emissive.copy(m.userData.e);
          m.emissiveIntensity = m.userData.ei;
        }
      }
      if (this.dying > 0) {
        this.dying += dt;
        const k = Math.max(0, 1 - this.dying / 0.9);
        group.scale.setScalar(Math.max(0.001, k));
        group.position.y -= dt * 1.5;
        if (k <= 0) group.visible = false;
      }
    },
    dispose() {
      group.parent?.remove(group);
      disposables.forEach((d) => d.dispose?.());
    },
  };
  return model;
}

// Il granchio di ruggine: corazzato, lento, le chele grosse
function crab() {
  const m = base(1.6);
  const body = m.M('#a8582a', { metalness: 0.6, roughness: 0.45 });
  const dark = m.M('#5a2a14', { metalness: 0.5 });
  const shell = new THREE.Mesh(m.track(new THREE.SphereGeometry(1, 16, 10)), body);
  shell.scale.set(1.3, 0.55, 1);
  shell.position.y = 0.8;
  m.group.add(shell);
  const legs = [];
  for (const s of [-1, 1]) for (let k = 0; k < 3; k++) {
    const leg = new THREE.Mesh(m.track(new THREE.BoxGeometry(1.1, 0.12, 0.12)), dark);
    leg.geometry.translate(0.55, 0, 0);
    leg.position.set(s * 0.9, 0.7, -0.4 + k * 0.45);
    leg.rotation.set(0, s > 0 ? 0 : Math.PI, -0.7);
    m.group.add(leg);
    legs.push(leg);
  }
  const claws = [];
  for (const s of [-1, 1]) {
    const arm = new THREE.Group();
    arm.position.set(s * 0.9, 0.9, 0.7);
    const a1 = new THREE.Mesh(m.track(new THREE.BoxGeometry(0.25, 0.25, 0.9)), body);
    a1.position.z = 0.4;
    const pincer = new THREE.Mesh(m.track(new THREE.BoxGeometry(0.55, 0.4, 0.7)), body);
    pincer.position.set(0, 0.1, 1);
    const tip = new THREE.Mesh(m.track(new THREE.BoxGeometry(0.15, 0.12, 0.5)), dark);
    tip.position.set(s * -0.15, -0.15, 1.25);
    arm.add(a1, pincer, tip);
    m.group.add(arm);
    claws.push(arm);
  }
  for (const s of [-1, 1]) {
    const eye = new THREE.Mesh(m.track(new THREE.SphereGeometry(0.1, 6, 4)), m.M('#ffe42a', { emissive: '#ffe42a', emissiveIntensity: 0.8 }));
    eye.position.set(s * 0.3, 1.45, 0.7);
    m.group.add(eye);
  }
  m.update = function (dt) {
    this.step(dt);
    legs.forEach((l, i) => (l.rotation.z = -0.7 + Math.sin(this.t * 3 + i) * 0.12));
    claws.forEach((c, i) => (c.rotation.x = Math.sin(this.t * 2 + i * 2) * 0.15));
  };
  return m;
}

// La medusa temporalesca: galleggia, tentacoli, scintille
function jelly() {
  const m = base(3.2);
  const domeMat = m.M('#7af0ff', { transparent: true, opacity: 0.55, emissive: '#3ad8ff', emissiveIntensity: 0.6, roughness: 0.2 });
  const core = m.M('#ffffff', { emissive: '#9af8ff', emissiveIntensity: 1.2 });
  const holder = new THREE.Group();
  holder.position.y = 2.2;
  m.group.add(holder);
  const dome = new THREE.Mesh(m.track(new THREE.SphereGeometry(0.9, 18, 10, 0, Math.PI * 2, 0, Math.PI / 2)), domeMat);
  dome.scale.y = 0.8;
  const c = new THREE.Mesh(m.track(new THREE.SphereGeometry(0.3, 10, 8)), core);
  c.position.y = 0.25;
  holder.add(dome, c);
  const tents = [];
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    const t = new THREE.Mesh(m.track(new THREE.CylinderGeometry(0.04, 0.015, 1.8, 4)), domeMat);
    t.geometry.translate(0, -0.9, 0);
    t.position.set(Math.cos(a) * 0.6, 0, Math.sin(a) * 0.6);
    holder.add(t);
    tents.push(t);
  }
  m.update = function (dt) {
    this.step(dt);
    if (this.dying <= 0) holder.position.y = 2.2 + Math.sin(this.t * 1.6) * 0.25;
    dome.scale.y = 0.8 + Math.sin(this.t * 3) * 0.08;
    tents.forEach((t, i) => {
      t.rotation.x = Math.sin(this.t * 2.4 + i) * 0.25;
      t.rotation.z = Math.cos(this.t * 2 + i * 1.3) * 0.25;
    });
  };
  return m;
}

// L'anguilla abissale: un serpente che si alza dal pavimento e ondeggia
function eel() {
  const m = base(3.4);
  const skin = m.M('#1e4a3a', { roughness: 0.4, metalness: 0.2 });
  const belly = m.M('#8ab890', { roughness: 0.5 });
  const segs = [];
  for (let i = 0; i < 10; i++) {
    const r = 0.42 - i * 0.025;
    const s = new THREE.Mesh(m.track(new THREE.SphereGeometry(r, 10, 8)), i % 3 === 0 ? belly : skin);
    m.group.add(s);
    segs.push(s);
  }
  const head = segs[segs.length - 1];
  const eyeMat = m.M('#ffe42a', { emissive: '#ffe42a', emissiveIntensity: 1.2 });
  for (const s of [-1, 1]) {
    const e = new THREE.Mesh(m.track(new THREE.SphereGeometry(0.07, 6, 4)), eyeMat);
    e.position.set(s * 0.14, 0.08, 0.14);
    head.add(e);
  }
  const jaw = new THREE.Mesh(m.track(new THREE.BoxGeometry(0.3, 0.08, 0.35)), m.M('#0a1a14'));
  jaw.position.set(0, -0.12, 0.15);
  head.add(jaw);
  m.update = function (dt) {
    this.step(dt);
    segs.forEach((s, i) => {
      const k = i / (segs.length - 1);
      s.position.set(Math.sin(this.t * 2.2 - i * 0.6) * 0.5 * (1 - k * 0.5), 0.3 + k * 3, Math.sin(this.t * 1.4 - i * 0.4) * 0.3 + k * k * 0.6);
    });
  };
  return m;
}

// Il fedele annegato: incappucciato, gocciolante, con una lanterna
function devotee() {
  const m = base(2.3);
  const robe = m.M('#2a3440', { roughness: 0.9 });
  const body = new THREE.Mesh(m.track(new THREE.ConeGeometry(0.6, 1.9, 10)), robe);
  body.position.y = 0.95;
  const hood = new THREE.Mesh(m.track(new THREE.SphereGeometry(0.33, 10, 8)), robe);
  hood.position.y = 1.95;
  hood.scale.set(1, 1.1, 1);
  const face = new THREE.Mesh(m.track(new THREE.CircleGeometry(0.2, 10)), m.M('#05080a'));
  face.position.set(0, 1.92, 0.3);
  m.group.add(body, hood, face);
  for (const s of [-1, 1]) {
    const e = new THREE.Mesh(m.track(new THREE.SphereGeometry(0.035, 6, 4)), m.M('#c8f0ff', { emissive: '#c8f0ff', emissiveIntensity: 1.5 }));
    e.position.set(s * 0.07, 1.95, 0.33);
    m.group.add(e);
  }
  const arm = new THREE.Group();
  arm.position.set(0.45, 1.4, 0.15);
  const lantern = new THREE.Mesh(m.track(new THREE.BoxGeometry(0.2, 0.28, 0.2)), m.M('#ffd890', { emissive: '#ffb050', emissiveIntensity: 2 }));
  lantern.position.set(0.1, -0.45, 0.25);
  arm.add(lantern);
  m.group.add(arm);
  m.update = function (dt) {
    this.step(dt);
    m.group.rotation.z = Math.sin(this.t * 0.9) * 0.04;
    arm.rotation.z = Math.sin(this.t * 1.3) * 0.15;
  };
  return m;
}

// Scintilla, uscita dalla chiavetta: piccola, a cubetti, la sciarpa arancione
export function sparkModel() {
  const m = base(1.4);
  const white = m.M('#e8f0f4');
  const teal = m.M('#2ab8c8');
  const visor = m.M('#7af8ff', { emissive: '#7af8ff', emissiveIntensity: 1 });
  const orange = m.M('#ff8a2a');
  const b = (w, h, d, mat, x, y, z) => {
    const o = new THREE.Mesh(m.track(new THREE.BoxGeometry(w, h, d)), mat);
    o.position.set(x, y, z);
    m.group.add(o);
    return o;
  };
  const legs = [b(0.15, 0.4, 0.15, white, -0.1, 0.2, 0), b(0.15, 0.4, 0.15, white, 0.1, 0.2, 0)];
  b(0.42, 0.45, 0.28, teal, 0, 0.62, 0);
  b(0.36, 0.32, 0.32, white, 0, 1.03, 0);
  b(0.3, 0.1, 0.05, visor, 0, 1.06, 0.17);
  const scarf = b(0.12, 0.08, 0.5, orange, 0.12, 0.86, -0.3);
  const arms = [b(0.1, 0.36, 0.1, white, -0.27, 0.62, 0), b(0.1, 0.36, 0.1, white, 0.27, 0.62, 0)];
  m.update = function (dt, speed = 0) {
    this.step(dt);
    const sw = Math.sin(this.t * 10) * 0.5 * Math.min(1, speed);
    legs[0].rotation.x = sw;
    legs[1].rotation.x = -sw;
    arms[0].rotation.x = -sw;
    arms[1].rotation.x = sw;
    scarf.rotation.y = Math.sin(this.t * 6) * 0.3;
    scarf.position.y = 0.86 + Math.sin(this.t * 8) * 0.02;
  };
  return m;
}

const BUILDERS = { crab, jelly, eel, devotee };

export function monsterModel(kind) {
  return BUILDERS[kind]();
}
