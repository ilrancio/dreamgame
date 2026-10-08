import * as THREE from 'three';
import { WalkScene, FRIEND } from '../../core/walkscene.js';
import { unlockPlace } from '../../core/places.js';
import { createSky } from '../../core/sky.js';
import { Particles } from '../../core/particles.js';
import { clamp } from '../../core/noise.js';
import { Character } from '../hotel/character.js';
import { CoastTerrain, X0, X1, Z0, Z1, BAY, coastZ, coveAt } from './terrain.js';
import { buildCoast } from './world.js';
import { buildCrowd } from './crowd.js';
import { Jeep } from './jeep.js';

// La Spiaggia Grande: si atterra su una pista sterrata in cima alla scogliera,
// si prende una jeep e si segue una strada bianca lungo la costa fino a una
// baia, dove la spiaggia è piena di gente. Piena. Tranne un ombrellone.
// Si torna all'aeroporto con lo stesso aereo, o dalla cabina 1313.

const RENTER = 'Il noleggiatore:';
const VENDOR = 'Il venditore:';
const GUARD = 'Il bagnino:';
const BARISTA = 'Il barista:';

const RENTER_LINES = [
  'Le chiavi sono nel quadro. Seguite la sterrata lungo il mare: la spiaggia è in fondo.',
  'Oggi c\'è un sacco di gente. C\'è sempre un sacco di gente.',
  'La jeep riportatela quando volete. Tanto torna da sola.',
  'Se vi perdete, tenete il mare sulla destra all\'andata e sulla sinistra al ritorno.',
];
const GUARD_LINES = [
  'Bandiera verde. Ma state dove vi vedo.',
  'Ne ho contati mille e trecentotredici. Poi ho smesso.',
  'Non oltre le boe, eh. Oltre le boe il mare è di un altro sogno.',
];
const LIE_LINES = [
  [FRIEND, 'Due lettini liberi. In mezzo a tutta questa gente. Proprio per noi.'],
  [null, 'Il brusio della spiaggia si allontana, come se qualcuno abbassasse il volume.'],
  [FRIEND, 'Senti? Le voci, le onde, la radiolina di qualcuno. Sembra di essere da bambini.'],
  [null, 'L\'ombrellone fa un cerchio d\'ombra perfetto. Il sole non si muove.'],
  [FRIEND, 'Non mi ricordo nemmeno come siamo arrivati. Ah, sì. La jeep.'],
];
// dove si può andare (il terreno continua oltre, per l'orizzonte)
const PLAY = { minX: X0 + 250, maxX: X1 - 200, minZ: Z0 + 200, maxZ: Z1 - 5 };

const VENDOR_CALLS = ['Cocco bello! Cocco fresco!', 'Cocco! Cocco bello!', 'Bomboloni! Cocco! Acqua fresca!'];

export class CoastDream extends WalkScene {
  constructor(ctx) {
    super(ctx, { background: '#cfe4f0', far: 2600, bounds: PLAY, speed: 5 });
    this.saved = ctx.progress.costa || {};
    const S = this.scene;
    // sempre estate, sempre mezzogiorno passato da poco
    this.sky = createSky();
    const u = this.sky.uniforms;
    u.top.value.set('#2f7fd8');
    u.horizon.value.set('#cfe4f0');
    u.bottom.value.set('#3a8ab0');
    u.sunColor.value.set('#fff4d8');
    u.sunDir.value.set(0.3, 0.75, 0.6).normalize();
    S.add(this.sky.mesh);
    S.fog = new THREE.Fog('#cfe4f0', 260, 1700);
    S.add(new THREE.HemisphereLight('#dceeff', '#c8b890', 1.25));
    const sun = new THREE.DirectionalLight('#fff2dc', 2.1);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    const sc = sun.shadow.camera;
    sc.left = sc.bottom = -45;
    sc.right = sc.top = 45;
    sc.near = 1;
    sc.far = 400;
    sun.shadow.bias = -0.0006;
    S.add(sun, sun.target);
    this.sun = sun;

    this.terrain = new CoastTerrain();
    this.world = buildCoast(S, this.terrain);
    this.crowd = buildCrowd(S, this.terrain, this.world);
    this.colliders = this.world.colliders;
    // un terminale sulla passerella, accanto al bar del Bagno 13: le entità sopra gli ombrelloni
    this.addTerminal('costa', this.world.bar.x + 6, this.world.bar.z + 1.5, 0, { spread: 18 });
    this.jeep = new Jeep(S);
    this.dust = new Particles(S, 600);
    this.mode = 'foot';

    const W = this.world;
    // il noleggiatore, seduto all'ombra
    this.renter = new Character(S, { skin: '#b07a52', hair: '#e8e8e8', shirt: '#e86a4a', pants: '#e8dcc0' });
    this.renter.pos.set(W.renter.x + 0.4, W.stripY, W.renter.z + 0.2);
    this.renter.facing = Math.PI * 0.8;
    this.renter.sitting = true;
    this.renter.animate(0, 0);
    this.renterIdx = 0;
    // il venditore di cocco, che va su e giù per la battigia
    this.vendor = new Character(S, { skin: '#8a5a3a', hair: '#141414', shirt: '#f4f4f0', pants: '#f4f4f0' });
    this.vendorX = BAY.x - 60;
    this.vendorDir = 1;
    this.vendorT = 6;
    const bucket = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.18, 0.35, 10), new THREE.MeshStandardMaterial({ color: '#d8d8d8', metalness: 0.5, roughness: 0.4 }));
    bucket.position.set(0.32, 0.95, 0.15);
    this.vendor.body.add(bucket);
    this.vendor.track(bucket.geometry);
    this.vendor.track(bucket.material);
    // le boe
    this.buoys = new THREE.Group();
    const buoyGeo = new THREE.SphereGeometry(0.35, 10, 8);
    const buoyMat = new THREE.MeshStandardMaterial({ color: '#ff5a2a', roughness: 0.5 });
    for (let x = BAY.x - 140; x <= BAY.x + 140; x += 14) {
      if (coveAt(x) < 0.4) continue;
      const b = new THREE.Mesh(buoyGeo, buoyMat);
      b.position.set(x, 0.1, coastZ(x) + 42);
      this.buoys.add(b);
    }
    this.buoyRes = [buoyGeo, buoyMat];
    S.add(this.buoys);

    // dove si compare
    this.spawn = ctx.spawn || 'arrivo';
    ctx.spawn = null;
    const R = this.terrain.road;
    if (this.spawn === 'shortcut') {
      this.place(W.cabin13.x, W.cabin13.z + 2.4, 0);
      this.parkJeep(W.lotSpot.x, W.lotSpot.z, Math.PI / 2);
    } else {
      const r = R[5];
      this.parkJeep(r.x, r.z, Math.atan2(r.tx, r.tz));
      this.placeAtPlane();
    }
    this.jeep.driver.group.visible = false;
    this.jeep.friend.group.visible = false;

    const { ui, audio } = ctx;
    audio.loop('onde', true, { freq: 380, q: 0.4, vol: 0.02, type: 'lowpass' });
    audio.loop('folla', true, { freq: 750, q: 0.5, vol: 0.0001, type: 'bandpass' });
    audio.loop('vento', true, { freq: 900, q: 0.3, vol: 0.012, type: 'bandpass' });
    this.updateObjective();
    if (this.spawn === 'arrivo') this.landing();
    else {
      ui.subtitle(FRIEND, 'Siamo usciti da una cabina. In mezzo a tutta questa gente nessuno ci ha fatto caso.', 3.6);
    }
  }

  save() {
    this.ctx.progress.costa = this.saved;
    this.ctx.saveProgress(this.ctx.progress);
  }

  updateObjective() {
    const s = this.saved;
    let t = 'Prendi la jeep e segui la sterrata lungo la costa, fino alla spiaggia.';
    if (s.beach && !s.lain) t = 'La spiaggia è piena. Trova un posto libero sotto gli ombrelloni.';
    else if (s.lain) t = 'Un posto per voi c\'era. L\'aereo vi aspetta sulla pista, quando volete.';
    this.ctx.ui.objective(t);
  }

  parkJeep(x, z, heading) {
    this.jeep.reset(x, z, heading, this.terrain);
    this.jeep.syncMesh(1);
  }

  placeAtPlane() {
    const P = this.world.planePark;
    this.place(P.x - 3.8, P.z - 9.5, Math.PI / 2);
  }

  groundAt(x, z) {
    return this.terrain.heightAt(x, z);
  }

  inWater(p = this.player.pos) {
    return this.terrain.heightAt(p.x, p.z) < -0.25;
  }

  // in acqua si va fino a dove si tocca; tra la gente ci si fa largo
  walk(ch, dt) {
    const ox = ch.pos.x;
    const oz = ch.pos.z;
    super.walk(ch, dt);
    if (this.terrain.heightAt(ch.pos.x, ch.pos.z) < -1.15) {
      ch.pos.x = ox;
      ch.pos.z = oz;
    }
    if (Math.abs(ch.pos.x - BAY.x) < 160) this.crowd.pushOut(ch.pos, 0.32);
    // nell'acqua si cammina piano
    if (this.inWater(ch.pos)) {
      ch.vel.x *= 0.92;
      ch.vel.z *= 0.92;
    }
  }

  updateFriend(dt) {
    if (this.lying) {
      this.friend.animate(dt, 0);
      return;
    }
    super.updateFriend(dt);
  }

  busy() {
    return this.mode === 'car' || !!this.lying || !!this.floating;
  }

  // ---------- L'arrivo: l'aereo che atterra sulla pista sterrata ----------
  landing() {
    const { ui, audio } = this.ctx;
    const W = this.world;
    const P = W.planePark;
    const plane = W.plane;
    this.player.group.visible = false;
    this.friend.group.visible = false;
    audio.engineStart();
    this.startCine({
      cam: new THREE.Vector3(P.x - 110, P.y + 5, P.z + 32),
      look: new THREE.Vector3(P.x - 200, P.y + 10, P.z),
      dur: 7.5,
      update: (dt, c) => {
        // dall'alto sul mare, poi giù sulla terra battuta, poi frena
        const t = c.t;
        let x;
        let y;
        if (t < 3) {
          const k = t / 3;
          x = -1250 + k * 320;
          y = P.y + 40 * (1 - k) ** 1.4;
        } else {
          const k = Math.min(1, (t - 3) / 4);
          x = -930 + (P.x + 930) * (1 - (1 - k) ** 2);
          y = P.y;
          if (k < 0.6 && Math.random() < 0.8) this.dust.emit(x - 2, P.y + 0.4, P.z + (Math.random() - 0.5) * 3, -6, 1.5, 0, { color: [0.8, 0.72, 0.58], size: 3, endSize: 9, life: 2.2, alpha: 0.5, drag: 1.2 });
        }
        plane.position.set(x, y, P.z);
        plane.rotation.z = t < 3 ? 0.08 : 0;
        for (const pr of plane.userData.props) pr.rotation.x += dt * 40;
        audio.engineUpdate(t < 5 ? 0.35 : 0.1, 0.4, false);
        c.look.set(x, y + 2, P.z);
        if (t > 3 && !c.thud) {
          c.thud = true;
          audio.thud(0.3);
        }
      },
      onEnd: () => {
        audio.engineStop();
        plane.position.set(P.x, P.y, P.z);
        plane.rotation.z = 0;
        this.player.group.visible = true;
        this.friend.group.visible = true;
        this.placeAtPlane();
        this.later(0.8, () => ui.subtitle(FRIEND, 'Una pista di terra in cima alla scogliera. E laggiù, una jeep.', 3.4));
        this.later(5, () => ui.subtitle(FRIEND, 'C\'è uno sotto l\'ombrellone. Sarà del noleggio.', 3));
      },
    });
    ui.subtitle('Altoparlante:', 'Benvenuti. La temperatura esterna è quella di un pomeriggio d\'agosto.', 3.6);
  }

  // ---------- Il ritorno: l'aereo che decolla verso l'aeroporto ----------
  takeOff() {
    const { ui, audio } = this.ctx;
    const W = this.world;
    const P = W.planePark;
    const plane = W.plane;
    this.player.group.visible = false;
    this.friend.group.visible = false;
    ui.subtitle(FRIEND, 'Si torna. La spiaggia resta lì, piena, anche senza di noi.', 3.2);
    audio.engineStart();
    this.startCine({
      cam: new THREE.Vector3(P.x + 40, P.y + 5, P.z + 40),
      look: new THREE.Vector3(P.x, P.y + 2, P.z),
      dur: 7,
      update: (dt, c) => {
        const t = c.t;
        const k = Math.max(0, t - 1);
        const x = P.x + 4 * k * k;
        const lift = Math.max(0, x - (P.x + 90));
        plane.position.set(x, P.y + lift * 0.25, P.z);
        plane.rotation.z = lift > 0 ? 0.12 : 0;
        for (const pr of plane.userData.props) pr.rotation.x += dt * 50;
        audio.engineUpdate(Math.min(1, 0.2 + t * 0.15), 1, false);
        c.look.set(x, plane.position.y + 2, P.z);
        if (Math.random() < 0.7 && lift === 0) this.dust.emit(x - 4, P.y + 0.4, P.z, -5, 1.2, 0, { color: [0.8, 0.72, 0.58], size: 3, endSize: 10, life: 2, alpha: 0.5, drag: 1.2 });
      },
      onEnd: () => {
        audio.engineStop();
        this.leave(() => this.ctx.goto('aeroporto', 'arrivi'));
      },
    });
  }

  // ---------- La jeep ----------
  setMode(mode) {
    this.mode = mode;
    const inCar = mode === 'car';
    this.player.group.visible = !inCar;
    this.friend.group.visible = !inCar;
    this.jeep.driver.group.visible = inCar;
    this.jeep.friend.group.visible = inCar;
    if (this.followers) this.followers.mesh.visible = !inCar;
    const { ui, audio } = this.ctx;
    ui.configureHud({
      unit: inCar ? 'km/h' : '',
      turboLabel: inCar ? 'Marcia ridotta <kbd>Shift</kbd>' : 'Fiato <kbd>Shift</kbd>',
      healthLabel: inCar ? 'Jeep' : 'Calma',
      controls: inCar
        ? '<kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd> guida · <kbd>Spazio</kbd> freno a mano · <kbd>E</kbd> scendi (da fermo) · <kbd>R</kbd> rimetti in strada'
        : 'Clicca per usare il mouse · <kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd> cammina · <kbd>E</kbd> interagisci · <kbd>C</kbd> chiama la jeep · <kbd>Spazio</kbd> salta',
    });
    ui.hint(null);
    if (inCar) {
      audio.engineStart();
      audio.thud(0.3);
      this.camPos.copy(this.camera.position);
    } else {
      audio.engineStop();
      audio.thud(0.25);
    }
  }

  getIn() {
    this.setMode('car');
    if (!this.flags.firstDrive) {
      this.flags.firstDrive = true;
      this.later(1, () => this.ctx.ui.subtitle(FRIEND, 'Sterrato. Vai piano, che qui sotto c\'è il mare.', 2.8));
      this.later(9, () => this.ctx.ui.subtitle(FRIEND, 'Guarda che colore, l\'acqua. Sembra finta.', 2.8));
    }
  }

  getOut() {
    const c = this.jeep;
    const rx = Math.cos(c.heading);
    const rz = -Math.sin(c.heading);
    this.player.pos.set(c.pos.x + rx * 2.2, 0, c.pos.z + rz * 2.2);
    this.friend.pos.set(c.pos.x - rx * 2.2, 0, c.pos.z - rz * 2.2);
    for (const ch of [this.player, this.friend]) {
      ch.pos.y = this.groundAt(ch.pos.x, ch.pos.z);
      ch.vel.set(0, 0, 0);
    }
    this.player.facing = c.heading;
    this.camYaw = c.heading;
    this.setMode('foot');
    this.updateCamera(1, true);
  }

  summonJeep() {
    const p = this.player;
    const fx = Math.sin(this.camYaw);
    const fz = Math.cos(this.camYaw);
    const x = p.pos.x - fx * 4 + fz * 3;
    const z = p.pos.z - fz * 4 - fx * 3;
    if (this.onBeach(x, z, 2) || this.terrain.heightAt(x, z) < 0.3) {
      this.ctx.ui.subtitle(FRIEND, 'Qui la jeep non ci arriva. Torniamo verso la strada.', 2.6);
      return;
    }
    this.parkJeep(x, z, this.camYaw);
    this.ctx.audio.whoosh(0.25);
    this.ctx.ui.subtitle(FRIEND, 'Eccola. Ci segue come un cane.', 2.2);
  }

  onBeach(x, z, margin = 0) {
    return coveAt(x) > 0.4 && coastZ(x) - z < 60 + margin && coastZ(x) - z > -60;
  }

  updateCar(dt) {
    const { input, ui, audio } = this.ctx;
    const ctl = {
      throttle: input.down('KeyW', 'ArrowUp') ? 1 : 0,
      brake: input.down('KeyS', 'ArrowDown') ? 1 : 0,
      steer: (input.down('KeyA', 'ArrowLeft') ? 1 : 0) - (input.down('KeyD', 'ArrowRight') ? 1 : 0),
      turbo: input.down('ShiftLeft', 'ShiftRight'),
      handbrake: input.down('Space'),
    };
    const c = this.jeep;
    const ox = c.pos.x;
    const oz = c.pos.z;
    const surface = this.terrain.surfaceAt(c.pos.x, c.pos.z);
    c.update(dt, ctl, this.terrain, surface);
    // tra gli ombrelloni non si entra in macchina
    if (this.onBeach(c.pos.x, c.pos.z)) {
      c.pos.x = ox;
      c.pos.z = oz;
      c.vx *= -0.2;
      c.vz *= -0.2;
      if (!this.flags.beachCar) {
        this.flags.beachCar = true;
        ui.subtitle(FRIEND, 'Fermo! Non si va in jeep in mezzo agli ombrelloni.', 2.6);
      }
    }
    c.pos.x = clamp(c.pos.x, PLAY.minX, PLAY.maxX);
    c.pos.z = clamp(c.pos.z, PLAY.minZ, PLAY.maxZ);
    for (const o of this.world.circles) {
      if (Math.abs(o.x - c.pos.x) > 5 || Math.abs(o.z - c.pos.z) > 5) continue;
      const imp = c.collideCircle(o.x, o.z, o.r);
      if (imp > 6) {
        audio.thud(clamp(imp / 25, 0.15, 0.7));
        this.shake = Math.max(this.shake || 0, 0.35);
      }
    }
    for (const b of this.boxesNear(c.pos, 4)) if (!b.low) c.collideBox(b.minX, b.maxX, b.minZ, b.maxZ);
    // in mare: si ricomincia dalla strada
    if (c.pos.y < -0.7 && !this.sinking) {
      this.sinking = true;
      audio.whoosh(0.5);
      ui.subtitle(FRIEND, 'Glu.', 1.6);
      ui.fade(1, 600, '#cfe4f0').then(() => {
        this.resetJeep();
        this.sinking = false;
        ui.fade(0, 900, '#cfe4f0');
      });
    }
    if (input.wasPressed('KeyR')) {
      this.resetJeep();
      audio.whoosh(0.3);
    }
    audio.engineUpdate(clamp(Math.abs(c.forwardSpeed) / 45, 0, 1), ctl.throttle, c.turboActive);
    // la polvere bianca dello sterrato
    if (c.speed > 6 && c.grounded && surface === 'dirt' && Math.random() < 0.7) {
      const bx = c.pos.x - c.fwdX * 2.4;
      const bz = c.pos.z - c.fwdZ * 2.4;
      this.dust.emit(bx, c.pos.y + 0.4, bz, (Math.random() - 0.5) * 2, 1 + Math.random(), (Math.random() - 0.5) * 2, { color: [0.86, 0.8, 0.68], size: 2.5, endSize: 8 + c.speed * 0.15, life: 2.4, alpha: 0.45, drag: 1.4 });
    }
    const slow = c.speed < 3;
    ui.hint(slow ? '<kbd>E</kbd> scendi dalla jeep' : null);
    if (slow && input.wasPressed('KeyE')) {
      ui.hint(null);
      this.getOut();
      return;
    }
    this.player.pos.copy(c.pos);
    this.updateCarCamera(dt);
  }

  resetJeep() {
    const c = this.jeep;
    const info = this.terrain.roadInfo(c.pos.x, c.pos.z);
    let r = info.idx >= 0 ? this.terrain.road[info.idx] : null;
    if (!r) {
      // la strada più vicina, cercata a mano
      let best = Infinity;
      for (const q of this.terrain.road) {
        const d = Math.hypot(q.x - c.pos.x, q.z - c.pos.z);
        if (d < best) {
          best = d;
          r = q;
        }
      }
    }
    this.parkJeep(r.x, r.z, Math.atan2(r.tx, r.tz));
    this.camPos.set(r.x - r.tx * 10, r.y + 5, r.z - r.tz * 10);
  }

  updateCarCamera(dt) {
    const c = this.jeep;
    const T = this.terrain;
    const sp = c.speed;
    const back = 9 + sp * 0.06;
    const tx = c.pos.x - c.fwdX * back;
    const tz = c.pos.z - c.fwdZ * back;
    const ty = Math.max(c.pos.y + 3.6 + sp * 0.02, T.heightAt(tx, tz) + 2);
    const k = 1 - Math.exp(-5 * dt);
    this.camPos.x += (tx - this.camPos.x) * k;
    this.camPos.z += (tz - this.camPos.z) * k;
    this.camPos.y += (ty - this.camPos.y) * (1 - Math.exp(-3.5 * dt));
    this.camPos.y = Math.max(this.camPos.y, T.heightAt(this.camPos.x, this.camPos.z) + 1.5, 0.8);
    const look = this.tmpV.set(c.pos.x + c.fwdX * 6, c.pos.y + 1.8, c.pos.z + c.fwdZ * 6);
    this.camLook.lerp(look, 1 - Math.exp(-10 * dt));
    this.shake = (this.shake || 0) * Math.exp(-3.2 * dt);
    const s = this.shake + (c.grounded && T.surfaceAt(c.pos.x, c.pos.z) === 'dirt' ? Math.min(0.06, sp * 0.002) : 0);
    this.camera.position.set(this.camPos.x + (Math.random() - 0.5) * s, this.camPos.y + (Math.random() - 0.5) * s, this.camPos.z + (Math.random() - 0.5) * s);
    this.camera.lookAt(this.camLook);
    const fov = 64 + clamp(sp / 40, 0, 1) * 12;
    this.camera.fov += (fov - this.camera.fov) * (1 - Math.exp(-3 * dt));
    this.camera.updateProjectionMatrix();
  }

  updateCamera(dt, snap = false) {
    super.updateCamera(dt, snap);
    if (this.camPos.y < 0.5) {
      this.camPos.y = 0.5;
      this.camera.position.copy(this.camPos);
      this.camera.lookAt(this.camLook);
    }
  }

  // ---------- Cose da fare a piedi ----------
  interaction(p) {
    const near = (v, r) => Math.hypot(v.x - p.x, v.z - p.z) < r;
    const W = this.world;
    const P = W.planePark;
    if (near(this.jeep.pos, 3.4)) return { label: 'sali sulla jeep', fn: () => this.getIn() };
    if (near({ x: P.x - 3.8, z: P.z - 1.6 }, 3.6)) return { label: 'risali sull\'aereo: si torna all\'aeroporto', fn: () => this.takeOff() };
    if (near(this.renter.pos, 2.6)) return { label: 'parla con il noleggiatore', fn: () => this.ctx.ui.subtitle(RENTER, RENTER_LINES[this.renterIdx++ % RENTER_LINES.length], 3.8) };
    if (near(W.cabin13, 1.6)) return { label: 'apri la cabina 1313', fn: () => this.leave(() => this.ctx.travel('suite')) };
    const F = this.crowd.freeSpot;
    if (F.beds.some((b) => near(b, 1.6))) return { label: 'sdraiati sul lettino libero', fn: () => this.lieDown() };
    if (near(this.vendor.pos, 2.4)) return { label: 'compra un cocco', fn: () => this.buyCoconut() };
    if (near(W.bar, 2.6)) return { label: 'ordina qualcosa al bar del Bagno 13', fn: () => this.order() };
    if (near(W.tower, 3.2)) return { label: 'parla con il bagnino', fn: () => this.ctx.ui.subtitle(GUARD, GUARD_LINES[(this.guardIdx = (this.guardIdx || 0) + 1) % GUARD_LINES.length], 3.6) };
    if (this.terrain.heightAt(p.x, p.z) < -0.8) return { label: 'fai il morto a galla', fn: () => this.floatOn() };
    return null;
  }

  buyCoconut() {
    const { ui, audio } = this.ctx;
    audio.pop(0.15);
    ui.popup('Una fetta di cocco fresco');
    ui.subtitle(VENDOR, 'Cocco bello! Per te è gratis, oggi. Oggi è sempre gratis.', 3.2);
    this.later(3.4, () => ui.subtitle(FRIEND, 'Sa di estate di quando avevamo dieci anni.', 2.8));
  }

  order() {
    const { ui, audio } = this.ctx;
    audio.ding(0.12);
    const drinks = ['Un ghiacciolo alla menta', 'Una granita al limone', 'Un caffè shakerato', 'Un cornetto al cioccolato'];
    ui.popup(drinks[Math.floor(Math.random() * drinks.length)]);
    ui.subtitle(BARISTA, 'Ecco. Siete fortunati: è l\'ultimo. È sempre l\'ultimo.', 3.2);
  }

  lieDown() {
    const F = this.crowd.freeSpot;
    this.lying = { t: 0, li: 0, lineT: 2.5 };
    for (const [ch, b] of [[this.player, F.beds[0]], [this.friend, F.beds[1]]]) {
      ch.vel.set(0, 0, 0);
      ch.pos.set(b.x, b.y + 0.38, b.z + 0.9);
      ch.facing = 0;
      ch.sitting = false;
    }
    if (!this.saved.lain) {
      this.saved.lain = true;
      this.save();
      this.updateObjective();
    }
    this.ctx.audio.loopVolume('folla', 0.008);
    this.ctx.ui.hint('<kbd>E</kbd> alzati');
  }

  standUp() {
    const F = this.crowd.freeSpot;
    this.lying = null;
    for (const ch of [this.player, this.friend]) {
      ch.body.rotation.x = 0;
      ch.body.position.set(0, 0, 0);
    }
    this.player.pos.set(F.x - 0.6, this.groundAt(F.x - 0.6, F.z + 2.2), F.z + 2.2);
    this.friend.pos.set(F.x + 0.8, this.groundAt(F.x + 0.8, F.z + 2.2), F.z + 2.2);
    this.ctx.ui.hint(null);
    this.updateCamera(1, true);
  }

  floatOn() {
    this.floating = { t: 0 };
    this.player.vel.set(0, 0, 0);
    this.ctx.ui.subtitle(null, 'Ti lasci andare. Il mare ti tiene su, e le voci della spiaggia arrivano attutite.', 3.6);
    this.ctx.audio.loopVolume('folla', 0.006);
    this.ctx.ui.hint('<kbd>E</kbd> rimettiti in piedi');
  }

  floatOff() {
    this.floating = null;
    this.player.body.rotation.x = 0;
    this.player.body.position.set(0, 0, 0);
    this.player.pos.y = this.groundAt(this.player.pos.x, this.player.pos.z);
    this.ctx.ui.hint(null);
    this.updateCamera(1, true);
  }

  // ---------- Ogni fotogramma ----------
  tick(dt) {
    const { input, ui, audio } = this.ctx;
    const t = this.time;
    this.world.update(t);
    this.crowd.update(dt, t);
    this.sky.update(this.camera, dt);
    this.dust.update(dt);
    if (input.wasPressed('KeyC') && this.mode === 'foot' && !this.busy() && !this.cine) this.summonJeep();
    if (this.mode === 'car' && !this.cine) this.updateCar(dt);
    else this.jeep.syncMesh(dt);

    // sdraiati sul lettino: la camera dall'alto, la folla intorno
    if (this.lying) {
      const L = this.lying;
      const F = this.crowd.freeSpot;
      L.t += dt;
      L.lineT -= dt;
      for (const ch of [this.player, this.friend]) {
        ch.body.rotation.x = -Math.PI / 2;
        ch.body.position.set(0, 0.21, 0);
      }
      if (L.lineT <= 0 && L.li < LIE_LINES.length) {
        const [who, line] = LIE_LINES[L.li++];
        ui.subtitle(who, line, 4.4);
        L.lineT = 6;
      }
      // la camera sale piano: voi due, poi la spiaggia intera, piena
      const up = Math.min(1, L.t / 30);
      this.camera.position.set(F.x + 3 + up * 6, F.y + 3.2 + up * 22, F.z + 5.5 + up * 14);
      this.camera.lookAt(F.x, F.y + 0.4, F.z + 0.6);
      if (input.wasPressed('KeyE') && L.t > 0.5) this.standUp();
    }
    if (this.floating) {
      const f = this.floating;
      f.t += dt;
      const p = this.player;
      p.body.rotation.x = -Math.PI / 2;
      p.body.position.set(0, 0.1, 0);
      p.pos.y = -0.15 + Math.sin(t * 1.3) * 0.05;
      this.camera.position.set(p.pos.x, 7 + Math.min(4, f.t * 0.3), p.pos.z + 0.6);
      this.camera.lookAt(p.pos.x, 0, p.pos.z - 0.6);
      if (input.wasPressed('KeyE') && f.t > 0.5) this.floatOff();
    }

    // il noleggiatore e il venditore di cocco
    this.renter.animate(dt, 0);
    const vx0 = this.vendorX;
    this.vendorX += this.vendorDir * 1.1 * dt;
    if (Math.abs(this.vendorX - BAY.x) > 115) this.vendorDir *= -1;
    const vz = coastZ(this.vendorX) - 4;
    const v = this.vendor;
    v.pos.set(this.vendorX, this.groundAt(this.vendorX, vz), vz);
    v.facing = this.vendorDir > 0 ? Math.PI / 2 : -Math.PI / 2;
    v.animate(dt, Math.abs(this.vendorX - vx0) / dt);
    const pp = this.mode === 'car' ? this.jeep.pos : this.player.pos;
    const dv = Math.hypot(v.pos.x - pp.x, v.pos.z - pp.z);
    this.vendorT -= dt;
    if (this.vendorT <= 0 && dv < 30) {
      this.vendorT = 14 + Math.random() * 8;
      ui.subtitle(VENDOR, VENDOR_CALLS[Math.floor(Math.random() * VENDOR_CALLS.length)], 2.4);
    }

    // l'arrivo alla spiaggia
    const dShore = coastZ(pp.x) - pp.z;
    const nearBay = Math.abs(pp.x - BAY.x) < 160 && dShore < 115;
    if (nearBay && !this.saved.beach) {
      this.saved.beach = true;
      this.save();
      this.updateObjective();
      ui.subtitle(FRIEND, this.mode === 'car' ? 'Pieno anche il parcheggio. Lasciamola dove capita.' : 'Guarda quanta gente. Non c\'è un buco libero.', 3.2);
      this.later(4, () => ui.subtitle(FRIEND, 'Non me la ricordavo così piena. Ma me la ricordavo.', 3));
    }
    if (nearBay && unlockPlace(this.ctx, 'costa')) {
      this.later(8, () => {
        ui.popup('Una nuova porta: Spiaggia Grande');
        audio.chime(784, 0.12);
        ui.subtitle(FRIEND, 'Hai visto le cabine dietro il bar? Una ha il numero 1313.', 3.2);
      });
    }
    // il posto libero, visto da vicino
    const F = this.crowd.freeSpot;
    if (!this.flags.freeSeen && this.saved.beach && !this.saved.lain && Math.hypot(pp.x - F.x, pp.z - F.z) < 14) {
      this.flags.freeSeen = true;
      ui.subtitle(FRIEND, 'Là! Sotto quell\'ombrellone blu. Due lettini, e nessuno sopra.', 3.2);
    }
    // il bagnino fischia a chi va troppo al largo
    if (this.mode === 'foot' && dShore < -36 && Math.abs(pp.x - BAY.x) < 150 && t - (this.whistleT || -99) > 8) {
      this.whistleT = t;
      audio.whistle(0.05);
      ui.subtitle(GUARD, 'Ehi! Non oltre le boe!', 2.2);
    }

    // i suoni: la folla, le onde, il vento in cima alla scogliera
    const dens = this.crowd.density(pp);
    if (!this.lying && !this.floating) audio.loopVolume('folla', 0.0001 + dens * 0.05);
    audio.loopVolume('onde', 0.008 + clamp(1 - Math.abs(dShore) / 90, 0, 1) * 0.04);
    audio.loopVolume('vento', 0.004 + clamp(this.groundAt(pp.x, pp.z) / 30, 0, 1) * 0.02);
    const quiet = this.lying || this.floating ? 0.25 : 1;
    if (Math.random() < dens * dt * 9 * quiet) audio.babble((0.006 + Math.random() * 0.012) * quiet, Math.random() < 0.25);
    if (Math.random() < dt * 0.12) audio.gull(0.02);

    // il sole segue chi gioca, per le ombre
    this.sun.position.set(pp.x + 60, pp.y + 120, pp.z + 90);
    this.sun.target.position.set(pp.x, pp.y, pp.z);

    // la bussola: verso la spiaggia, finché non ci sei arrivato
    if (!this.saved.beach && !this.cine) {
      const R = this.terrain.road;
      const info = this.terrain.roadInfo(pp.x, pp.z);
      const target = info.idx >= 0 ? R[Math.min(R.length - 1, info.idx + 25)] : R[5];
      const camYaw = Math.atan2(this.camLook.x - this.camera.position.x, this.camLook.z - this.camera.position.z);
      ui.compass(-(Math.atan2(target.x - pp.x, target.z - pp.z) - camYaw));
    } else ui.compass(null);

    const sp = this.mode === 'car' ? this.jeep.speed * 3.6 : 0;
    ui.updateHud({ speed: sp, turbo: this.mode === 'car' ? this.jeep.turbo : 1, health: 1, time: t, counter: nearBay ? 'Spiaggia Grande' : '' });
  }

  dispose() {
    super.dispose();
    const { audio, ui } = this.ctx;
    audio.engineStop();
    ui.compass(null);
    this.world.dispose();
    this.crowd.dispose();
    this.jeep.dispose();
    this.renter.dispose();
    this.vendor.dispose();
    this.buoyRes.forEach((r) => r.dispose());
    this.dust.dispose?.();
    this.sky.mesh.geometry.dispose();
    this.sky.mesh.material.dispose();
  }
}
