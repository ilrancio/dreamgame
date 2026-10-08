import * as THREE from 'three';
import { clamp } from '../../core/noise.js';
import { buildFigure, hasFigure, FIGURE_HIP } from '../../core/figure.js';
import { FEMININE } from '../../models/characters/index.js';

// Personaggio a piedi: stessi colori di chi era in macchina nel campo.
export class Character {
  constructor(scene, { skin, hair, shirt, pants = '#2a2a34', model = 'casual', feminine = false }) {
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
    this.pantsM = pantsM;
    this.shoeM = shoeM;

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
    this.gunParts = new Set();
    this.gun.traverse((o) => this.gunParts.add(o));
    this.muzzle = new THREE.Object3D();
    this.muzzle.position.set(0, -0.24, 0.02);
    this.gun.add(this.muzzle);

    this.armed = false;
    this.aimPitch = 0;
    this.sitting = false;

    // il corpo vero (Quaternius), se c'è: le membra disegnate restano come
    // "manopole" invisibili dell'animazione, che le ossa copiano
    this.mats = { skin: skinM, hair: hairM, shirt: shirtM, pants: pantsM, shoe: shoeM, dark: m('#1a1418') };
    this.baseModel = model;
    this.feminine = false;
    this.useFigure(feminine && FEMININE[model] ? FEMININE[model] : model);
    this.feminine = !!(feminine && this.figure && FEMININE[model]);
  }

  useFigure(model) {
    if (!model || !hasFigure(model)) return;
    const fig = buildFigure(model, this.mats);
    if (!fig) return;
    if (this.figure) this.body.remove(this.figure.root);
    this.figure = fig;
    this.body.add(fig.root);
    this.gun.position.y = -0.76; // il braccio vero è un po' più lungo
    this.body.traverse((o) => {
      if (o.isMesh && o !== fig.mesh && !this.gunParts.has(o)) o.visible = false;
    });
    // il riquadro della censura stava sul vecchio scheletro
    if (this.censor) {
      this.censor.parent?.remove(this.censor);
      this.censor = null;
      if (this.dressed) this.makeCensor();
    }
  }

  // uomo o donna (il sogno della doccia): stesso vestito, l'altro corpo
  setFeminine(on) {
    on = !!on;
    if (on === this.feminine || !FEMININE[this.baseModel]) return;
    this.useFigure(on ? FEMININE[this.baseModel] : this.baseModel);
    this.feminine = on;
  }

  // cambia pelle, capelli e maglia (nel sogno condiviso chi entra veste da amico)
  setLook({ skin, hair, shirt }) {
    if (skin) this.looks.skin.color.set(skin);
    if (hair) this.looks.hair.color.set(hair);
    if (shirt) this.looks.shirt.color.set(shirt);
  }

  // In doccia e in vasca: niente vestiti (maglia, pantaloni e scarpe color pelle)
  // e un riquadro a pixel dal collo alle ginocchia, come in TV.
  setUndressed(on) {
    const L = this.looks;
    if (on && !this.dressed) {
      this.dressed = { shirt: L.shirt.color.clone(), pants: this.pantsM.color.clone(), shoe: this.shoeM.color.clone() };
      for (const m of [L.shirt, this.pantsM, this.shoeM]) m.color.copy(L.skin.color);
    } else if (!on && this.dressed) {
      L.shirt.color.copy(this.dressed.shirt);
      this.pantsM.color.copy(this.dressed.pants);
      this.shoeM.color.copy(this.dressed.shoe);
      this.dressed = null;
    }
    if (on && !this.censor && this.figure) this.makeCensor();
    if (this.censor) this.censor.visible = on;
  }

  makeCensor() {
    if (!this.censorMat) {
      const tex = this.track(censorTexture(this.looks.skin.color));
      this.censorMat = this.track(new THREE.MeshBasicMaterial({ map: tex, toneMapped: false }));
      this.censorGeo = this.track(new THREE.BoxGeometry(1.7, 2.9, 1.05));
    }
    // in unità del modello, attaccato all'osso del busto (che sta alle anche)
    const box = new THREE.Mesh(this.censorGeo, this.censorMat);
    box.position.set(0, 0.45, 0.08);
    this.figure.bones.spine.add(box);
    this.censor = box;
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
      // il corpo vero si siede all'altezza del sedile (se chi lo fa sedere la conosce)
      this.body.position.y = this.figure ? (this.seatHeight ?? 0.42) + 0.04 - FIGURE_HIP : -0.36;
      this.body.rotation.x = 0;
    }
    if (this.lying) {
      // sdraiato sulla schiena (la vasca): gambe distese, braccia lungo i fianchi, testa un po' su
      this.legL.rotation.set(0, 0, 0.04);
      this.legR.rotation.set(0, 0, -0.04);
      this.armL.rotation.set(0.15, 0, 0.12);
      this.armR.rotation.set(0.15, 0, -0.12);
      this.body.rotation.x = -Math.PI / 2 + 0.22;
      this.body.position.y = 0;
    }
    if (this.censor) {
      this.censorT = (this.censorT || 0) + dt;
      if (this.censorT > 0.12) {
        this.censorT = 0;
        this.censor.material.map.offset.set(Math.floor(Math.random() * 8) / 8, Math.floor(Math.random() * 8) / 8);
      }
    }
    if (!this.sitting) this.seatHeight = null;
    if (this.figure) this.poseFigure();
    this.group.position.copy(this.pos);
    this.group.rotation.y = this.facing;
  }

  // le ossa del corpo vero seguono le membra; ginocchia e gomiti si piegano da soli
  poseFigure() {
    const b = this.figure.bones;
    for (const [bone, limb] of [[b.legL, this.legL], [b.legR, this.legR]]) bone.rotation.set(limb.rotation.x, 0, limb.rotation.z);
    // le braccia un filo staccate dai fianchi, così le mani non sfiorano il corpo
    b.armL.rotation.set(this.armL.rotation.x, 0, this.armL.rotation.z + 0.09);
    b.armR.rotation.set(this.armR.rotation.x, 0, this.armR.rotation.z - 0.09);
    if (this.armed && !this.sitting) {
      // a due mani, quasi parallele: con le braccia vere quelle disegnate si incrocerebbero
      b.armR.rotation.z = 0.06;
      b.armL.rotation.z = -0.22;
    }
    // il ginocchio si piega quando la gamba va indietro, e da seduti
    for (const [shin, leg] of [[b.shinL, this.legL], [b.shinR, this.legR]]) {
      shin.rotation.x = this.sitting ? 1.5 : Math.max(0, leg.rotation.x) * 1.1 + (this.grounded ? 0 : 0.6);
    }
    for (const [fore, arm] of [[b.foreL, this.armL], [b.foreR, this.armR]]) fore.rotation.x = this.armed && !this.sitting ? 0 : Math.min(0, arm.rotation.x) * 0.6 - 0.15;
    b.head.rotation.copy(this.head.rotation);
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

// i quadratoni della censura: toni di pelle mescolati, a scatti
function censorTexture(skin) {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d');
  const base = skin.clone();
  const tmp = new THREE.Color();
  for (let y = 0; y < 8; y++) {
    for (let x = 0; x < 8; x++) {
      tmp.copy(base).offsetHSL((Math.random() - 0.5) * 0.04, (Math.random() - 0.5) * 0.15, (Math.random() - 0.5) * 0.22);
      g.fillStyle = `#${tmp.getHexString()}`;
      g.fillRect(x * 8, y * 8, 8, 8);
    }
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.magFilter = THREE.NearestFilter;
  t.minFilter = THREE.NearestFilter;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(0.5, 0.75);
  return t;
}
