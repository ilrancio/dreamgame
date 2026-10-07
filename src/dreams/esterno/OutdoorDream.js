import * as THREE from 'three';
import { createSky } from '../../core/sky.js';
import { Particles } from '../../core/particles.js';
import { clamp, lerp, smoothstep } from '../../core/noise.js';
import { Terrain, HOTEL, VILLAGE, DEMON_POS, MALL } from '../demone/terrain.js';
import { Car } from '../demone/car.js';
import { Demon } from '../demone/demon.js';
import { buildHotel } from '../demone/hotel.js';
import { buildScenery } from '../demone/scenery.js';
import { Character } from '../hotel/character.js';
import { GnomeFollowers } from '../hotel/companions.js';
import { buildVillage, VILLAGE_NAME, VILLAGE_ALT } from './village.js';
import { buildMallExterior } from '../centro/exterior.js';
import { buildAirportExterior } from '../aeroporto/exterior.js';
import { unlockPlace, placeById } from '../../core/places.js';
import { GestureScreen, recordGesture, gestureSfx } from '../../core/gestures.js';
import { DigitalLayer } from '../digitale/layer.js';
import { GATES, gateOpen, buildCorruptRing, buildCorruptPlane, glitchOverlay } from '../digitale/corruption.js';

const FRIEND = 'Il tuo amico:';

// Fuori dall'hotel. Di giorno un cielo alpino limpido, di notte le stelle:
// è la stessa ora che c'era dentro, il sogno non salta.
const SKY_DAY = { top: '#2f6cc0', horizon: '#cfe2f2', bottom: '#8a9cac', fog: '#b4c8dc', sun: '#fff4d8', light: '#fff0d8', hemiSky: '#d4e6ff', hemiGround: '#5a6a48' };
const SKY_NIGHT = { top: '#040817', horizon: '#26305a', bottom: '#0b0e1c', fog: '#1a2240', sun: '#b8c8ff', light: '#8fa6ff', hemiSky: '#5a6cb0', hemiGround: '#141828' };

// Il portone dell'hotel visto da fuori, e la scalinata che sale allo zoccolo di pietra.
const DOOR = { x: HOTEL.x, z: HOTEL.z - 30 - 19 };
const STEPS = { minX: HOTEL.x - 8, maxX: HOTEL.x + 8, minZ: DOOR.z - 10, maxZ: DOOR.z, rise: 5 };

const COFFEE_LINES = [
  ['Il caffè quassù sa di legna e di neve.', 'Potremmo restare. Tanto il sogno non finisce.'],
  ['Senti le campane? No? Io le sento sempre, anche quando tacciono.', 'Un altro? Il barista sorride e non porta il conto.'],
  ['Laggiù c\'è l\'hotel. Sembra un giocattolo, da qui.', 'E pensare che dentro ci sono centinaia di piani.'],
];

export class OutdoorDream {
  constructor(ctx) {
    this.ctx = ctx;
    const hs = ctx.progress.hotel || {};
    this.saved = ctx.progress.esterno || {};
    this.timeOfDay = hs.timeOfDay === 'day' ? 'day' : 'night';
    this.night = this.timeOfDay === 'night' ? 1 : 0;

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 0.1, 5000);

    this.terrain = new Terrain(7);
    this.scene.add(this.terrain.mesh, this.terrain.roadMesh);
    this.sky = createSky();
    this.scene.add(this.sky.mesh);
    this.scene.fog = new THREE.FogExp2(SKY_DAY.fog, 0.0007);
    this.hemi = new THREE.HemisphereLight(SKY_DAY.hemiSky, SKY_DAY.hemiGround, 1.2);
    this.scene.add(this.hemi);
    this.sun = new THREE.DirectionalLight(SKY_DAY.light, 2.6);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(2048, 2048);
    const sc = this.sun.shadow.camera;
    sc.left = sc.bottom = -60;
    sc.right = sc.top = 60;
    sc.near = 10;
    sc.far = 700;
    this.sun.shadow.bias = -0.0006;
    this.sun.shadow.normalBias = 0.5;
    this.scene.add(this.sun, this.sun.target);

    this.dust = new Particles(this.scene, 1500);
    this.dust.setScale(ctx.renderer, this.camera);

    this.scenery = buildScenery(this.scene, this.terrain);
    this.hotelY = this.terrain.heightAt(HOTEL.x, HOTEL.z);
    this.hotel = buildHotel(this.scene, HOTEL.x, this.hotelY, HOTEL.z);
    this.buildSteps();
    // il demone è ancora là, fermo nel campo. Ti segue con lo sguardo e basta.
    this.demon = new Demon(this.scene, DEMON_POS.x, DEMON_POS.z, this.terrain.heightAt(DEMON_POS.x, DEMON_POS.z));
    this.village = buildVillage(this.scene, this.terrain);
    this.mall = buildMallExterior(this.scene, this.terrain);
    // l'aeroporto, giù nel campo
    this.airport = buildAirportExterior(this.scene, this.terrain);
    // il mondo è stato invaso da entità digitali: terminali nei luoghi, pixel che galleggiano ovunque
    const vt = this.village.terminal;
    const tpos = [
      { id: 'piazzale', x: HOTEL.x + 30, z: DOOR.z - 9, yaw: Math.PI },
      { id: 'borgo', x: vt.x, z: vt.z, yaw: vt.yaw },
      { id: 'parcheggio', x: MALL.x + 45 + 14, z: MALL.z + 16, yaw: Math.PI / 2 },
    ].map((q) => ({ ...q, y: this.terrain.heightAt(q.x, q.z) }));
    const pts = [];
    this.terrain.road.forEach((r, i) => {
      if (i % 22) return;
      const side = (i / 22) % 2 ? 1 : -1;
      const off = 14 + ((i * 7) % 18);
      const x = r.x + r.tz * off * side;
      const z = r.z - r.tx * off * side;
      pts.push([x, this.terrain.heightAt(x, z) + 3 + ((i * 13) % 7), z]);
    });
    for (const c of [VILLAGE, MALL, { x: HOTEL.x, z: HOTEL.z - 70 }]) {
      for (let k = 0; k < 10; k++) {
        const a = k * 2.4;
        const r = 25 + ((k * 17) % 50);
        const x = c.x + Math.cos(a) * r;
        const z = c.z + Math.sin(a) * r;
        pts.push([x, this.terrain.heightAt(x, z) + 4 + (k % 4) * 2, z]);
      }
    }
    this.digital = new DigitalLayer(this.scene, ctx, tpos, pts);
    // la corruzione: recinti di pixel intorno ai posti che si sbloccano solo liberando i terminali
    this.gates = [
      { id: 'borgo', x: VILLAGE.x, z: VILLAGE.z, r: VILLAGE.r + 30 },
      { id: 'conca', x: MALL.x, z: MALL.z, r: MALL.r + 50 },
    ].map((g) => ({ ...g, wall: buildCorruptRing(this.scene, { x: g.x, z: g.z, r: g.r, terrain: this.terrain }) }));
    const me0 = this.mall.entrance;
    this.doorBarrier = buildCorruptPlane(this.scene, { x: me0.x + 0.3, y: this.terrain.heightAt(me0.x, me0.z), z: me0.z, w: 9.6, h: 4.8, yaw: Math.PI / 2 });
    this.refreshGates(true);
    this.boxes = this.village.colliders.concat([this.hotel.box, STEPS_SIDE_L, STEPS_SIDE_R], this.mall.colliders, this.digital.colliders, this.airport.colliders);
    this.village.setShortcutOpen(!!ctx.progress.places?.borgo || !!this.saved.villageSeen);

    // la macchina resta dove l'avevate lasciata (la prima volta, davanti all'hotel)
    this.car = new Car(this.scene);
    const pc = this.saved.car || { x: HOTEL.x + 16, z: DOOR.z - 18, h: Math.PI / 2 };
    this.car.reset(pc.x, pc.z, pc.h, this.terrain);
    this.car.turbo = 1;

    this.player = new Character(this.scene, { skin: '#e0b089', hair: '#3b2a1e', shirt: '#2f4f8f' });
    this.friend = new Character(this.scene, { skin: '#c99470', hair: '#141414', shirt: '#d9a82e', model: 'longsleeve' });
    this.npcs = this.village.npcs.map((n) => {
      const [skin, hair, shirt] = n.look;
      const c = new Character(this.scene, { skin, hair, shirt, pants: '#3a3430' });
      c.pos.set(n.at[0], this.village.center.y + (n.sit ? 0.12 : 0), n.at[1]);
      c.facing = n.facing;
      c.sitting = !!n.sit;
      c.animate(0, 0);
      return { ...n, c, idx: 0 };
    });

    if (hs.activeEntity === 'gnomi' && hs.entities?.gnomi) {
      this.followers = new GnomeFollowers(this.scene, hs.entities.gnomi);
      this.followers.ground = (x, z) => this.groundAt(x, z);
    }

    this.camYaw = Math.PI;
    this.camPitch = 0.22;
    this.camPos = new THREE.Vector3();
    this.camLook = new THREE.Vector3();
    this.tmpV = new THREE.Vector3();
    this.near = [];
    this.time = 0;
    this.shake = 0;
    this.lineTimer = 0;
    this.flags = {};
    this.activity = null;
    this.mode = 'foot';

    // dove si compare: dal portone (in cima alla scalinata), dalla porta 1313
    // del borgo, oppure uscendo dal centro commerciale
    this.spawn = ctx.spawn || 'hotel';
    ctx.spawn = null;
    let sp = { x: DOOR.x, z: DOOR.z - 1.5, yaw: Math.PI };
    if (this.spawn === 'borgo') {
      const d = this.village.shortcut;
      sp = { x: d.spot.x, z: d.spot.z, yaw: d.yaw };
    } else if (this.spawn === 'centro') sp = this.mall.spawn;
    else if (this.spawn === 'aeroporto') sp = this.airport.spawn;
    const side = { x: Math.cos(sp.yaw) * 1.6, z: -Math.sin(sp.yaw) * 1.6 };
    this.player.pos.set(sp.x, this.groundAt(sp.x, sp.z), sp.z);
    this.player.facing = sp.yaw;
    this.friend.pos.set(sp.x + side.x, this.groundAt(sp.x + side.x, sp.z + side.z), sp.z + side.z);
    this.friend.facing = sp.yaw;
    this.camYaw = sp.yaw;
    this.setMode('foot', true);

    this.gesture = new GestureScreen();
    this.onCanvasClick = () => !this.gesture.open && ctx.input.lock();
    ctx.renderer.domElement.addEventListener('click', this.onCanvasClick);

    const { ui, audio } = ctx;
    ui.showHud(true);
    ui.calm(true);
    ui.crosshair(false);
    ui.steam(false);
    audio.stopAllPads(1);
    audio.stopLoops();
    if (this.night) audio.pad('fuori', [110, 164.8, 220, 277.2], { vol: 0.035, cutoff: 900 });
    else audio.pad('fuori', [146.8, 220, 293.7, 370], { vol: 0.03, cutoff: 1500 });
    audio.ambience(this.night ? 'crickets' : 'birds');
    this.applyAtmosphere();
    this.updateObjective();
    this.snapCamera();
    this.script = [
      { at: 1.4, fn: () => ui.subtitle(FRIEND, this.night ? 'Che aria fresca. Guarda quante stelle.' : 'Che luce, stamattina. Si vede tutta la valle.', 3) },
      { at: 5, fn: () => this.spawn === 'hotel' && !this.saved.villageSeen && ui.subtitle(FRIEND, 'La strada non finisce all\'hotel. Continua a salire... vediamo dove porta?', 3.6) },
      { at: 9, fn: () => this.spawn === 'hotel' && !this.ctx.progress.places?.aeroporto && !this.flags.airLine && (this.flags.airLine = true) && ui.subtitle(FRIEND, 'Hai visto giù nel campo? Una pista, delle luci che lampeggiano... un aeroporto. Prima non c\'era.', 4) },
      { at: 5, fn: () => this.spawn === 'hotel' && this.saved.villageSeen && !this.mallSeen && ui.subtitle(FRIEND, 'E quella strada che scende a ovest? Laggiù c\'è un edificio bianco, enorme.', 3.6) },
    ];
  }

  // ---------- Costruzione ----------
  buildSteps() {
    const m = new THREE.MeshStandardMaterial({ color: '#6d6a66', roughness: 1 });
    const geo = new THREE.BoxGeometry(1, 1, 1);
    this.stepParts = [m, geo];
    const n = STEPS.rise;
    const depth = (STEPS.maxZ - STEPS.minZ) / n;
    for (let k = 0; k < n; k++) {
      const h = k + 1;
      const o = new THREE.Mesh(geo, m);
      const z0 = STEPS.minZ + k * depth;
      o.scale.set(STEPS.maxX - STEPS.minX, h, STEPS.maxZ - z0);
      o.position.set(HOTEL.x, this.hotelY + h / 2 - 0.02, (z0 + STEPS.maxZ) / 2);
      o.castShadow = o.receiveShadow = true;
      this.scene.add(o);
      this.stepParts.push(o);
    }
    // lo zoccolo di pietra sotto la torre del portone
    const plinth = new THREE.Mesh(geo, m);
    plinth.scale.set(36, 5, 17.2);
    plinth.position.set(HOTEL.x, this.hotelY + 2.5 - 0.02, STEPS.maxZ + 8.6);
    plinth.receiveShadow = true;
    this.scene.add(plinth);
    this.stepParts.push(plinth);
  }

  // altezza del suolo, scalinata compresa
  groundAt(x, z) {
    const h = this.terrain.heightAt(x, z);
    if (x > STEPS.minX && x < STEPS.maxX && z > STEPS.minZ && z <= STEPS.maxZ + 0.6) {
      const k = Math.min(STEPS.rise, Math.ceil(((z - STEPS.minZ) / (STEPS.maxZ - STEPS.minZ)) * STEPS.rise));
      return Math.max(h, this.hotelY + k);
    }
    return h;
  }

  setMode(mode, silent = false) {
    this.mode = mode;
    const inCar = mode === 'car';
    this.player.group.visible = !inCar;
    this.friend.group.visible = !inCar;
    this.car.driver.group.visible = inCar;
    this.car.friend.group.visible = inCar;
    if (this.followers) this.followers.mesh.visible = !inCar;
    const { ui, audio } = this.ctx;
    ui.configureHud({
      unit: inCar ? 'km/h' : 'm s.l.m.',
      turboLabel: inCar ? 'Turbo <kbd>Shift</kbd>' : 'Fiato <kbd>Shift</kbd>',
      healthLabel: inCar ? 'Macchina' : 'Energia',
      controls: inCar
        ? '<kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd> guida · <kbd>Spazio</kbd> freno a mano · <kbd>E</kbd> scendi (da fermo) · <kbd>R</kbd> rimetti in strada'
        : 'Clicca per usare il mouse · <kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd> cammina · <kbd>E</kbd> interagisci · <kbd>C</kbd> chiama la macchina · <kbd>Spazio</kbd> salta',
    });
    if (silent) return;
    if (inCar) {
      audio.engineStart();
      audio.thud(0.3);
    } else {
      audio.engineStop();
      audio.thud(0.25);
    }
  }

  getIn() {
    this.setMode('car');
    this.camPos.copy(this.camera.position);
    if (!this.flags.firstDrive) {
      this.flags.firstDrive = true;
      this.later(0.8, () => this.ctx.ui.subtitle(FRIEND, 'Di nuovo in macchina. Stavolta piano, eh?', 2.6));
    }
  }

  getOut() {
    const c = this.car;
    const rx = Math.cos(c.heading);
    const rz = -Math.sin(c.heading);
    this.player.pos.set(c.pos.x + rx * 2.3, 0, c.pos.z + rz * 2.3);
    this.friend.pos.set(c.pos.x - rx * 2.3, 0, c.pos.z - rz * 2.3);
    for (const ch of [this.player, this.friend]) {
      ch.pos.y = this.groundAt(ch.pos.x, ch.pos.z);
      ch.vel.set(0, 0, 0);
      ch.facing = c.heading;
    }
    this.camYaw = c.heading;
    c.vx = c.vz = 0;
    this.setMode('foot');
    if (this.followers) this.followers.placed = false;
  }

  later(dt, fn) {
    this.script.push({ at: this.time + dt, fn });
    this.script.sort((a, b) => a.at - b.at);
  }

  save() {
    this.ctx.progress.esterno = this.saved;
    this.ctx.saveProgress(this.ctx.progress);
  }

  get mallSeen() {
    return !!this.ctx.progress.places?.centro;
  }

  // ---------- La corruzione ----------
  refreshGates(instant = false) {
    const p = this.ctx.progress;
    for (const g of this.gates) {
      g.open = gateOpen(p, g.id);
      g.wall.setActive(!g.open, instant);
    }
    this.doorOpen = gateOpen(p, 'ingresso');
    this.doorBarrier.setActive(!this.doorOpen, instant);
  }

  // dopo un combattimento: se un terminale ha liberato un posto, la corruzione si dissolve
  onTerminalDone() {
    const { ui, audio } = this.ctx;
    const before = this.gates.map((g) => g.open).concat(this.doorOpen);
    this.refreshGates();
    const after = this.gates.map((g) => g.open).concat(this.doorOpen);
    const ids = this.gates.map((g) => g.id).concat('ingresso');
    ids.forEach((id, i) => {
      if (before[i] || !after[i]) return;
      this.later(1.2, () => {
        ui.popup(`Sbloccato: ${GATES[id].name}`);
        audio.chime(523, 0.12);
        setTimeout(() => audio.chime(784, 0.12), 180);
        ui.subtitle(FRIEND, `Guarda laggiù: la corruzione intorno a ${GATES[id].name} si sta sciogliendo.`, 3.8);
      });
    });
    this.updateObjective();
  }

  gateMessage(id, force = false) {
    if (!force && (this.flags.gateMsgT || 0) > this.time) return;
    this.flags.gateMsgT = this.time + 4;
    this.ctx.audio.thud(0.2);
    this.ctx.ui.subtitle(null, `La realtà qui è corrotta: pixel che non stanno fermi, un ronzio che entra nei denti. Non si passa. ${GATES[id].hint}`, 4.5);
  }

  updateGates(dt, prevP, prevC) {
    for (const g of this.gates) g.wall.update(this.time, dt);
    this.doorBarrier.update(this.time, dt);
    let k = 0;
    const blockers = [
      [this.player.pos, prevP, null],
      [this.car.pos, prevC, this.car],
    ];
    for (const g of this.gates) {
      if (g.open) continue;
      for (const [pos, prev, car] of blockers) {
        const d0 = Math.hypot(prev.x - g.x, prev.z - g.z);
        const d1 = Math.hypot(pos.x - g.x, pos.z - g.z);
        // non si entra, né a piedi né in macchina (ma se sei già dentro puoi uscire)
        if (d0 >= g.r && d1 < g.r) {
          pos.x = prev.x;
          pos.z = prev.z;
          if (car) {
            car.vx *= -0.2;
            car.vz *= -0.2;
            this.shake = Math.max(this.shake, 0.6);
          }
          this.gateMessage(g.id);
        }
      }
      const me = this.mode === 'car' ? this.car.pos : this.player.pos;
      const d = Math.hypot(me.x - g.x, me.z - g.z) - g.r;
      k = Math.max(k, d >= 0 ? 1 - d / 45 : 0.25);
    }
    if (!this.doorOpen) {
      const me = this.mall.entrance;
      const pp = this.player.pos;
      k = Math.max(k, 1 - Math.hypot(pp.x - me.x, pp.z - me.z) / 14);
    }
    k = Math.max(0, Math.min(1, k));
    glitchOverlay(this.digital.open ? 0 : k);
    this.objT = (this.objT ?? 2) - dt;
    if (this.objT <= 0 && !this.activity) {
      this.objT = 2;
      this.updateObjective();
    }
    this.ctx.audio.loop('glitch', k > 0.15 && !this.digital.open, { freq: 3200, q: 6, vol: 0.035 });
  }

  updateObjective() {
    const { ui } = this.ctx;
    const s = this.saved;
    const P = this.ctx.progress;
    if (!this.inVillage && !gateOpen(P, 'borgo')) ui.objective('La strada per il borgo è corrotta. Libera il terminale del piazzale, accanto all\'hotel.');
    else if (!this.inVillage && s.villageSeen && !gateOpen(P, 'conca')) ui.objective('A ovest, la conca del centro commerciale è corrotta. Libera il terminale della piazza del borgo.');
    else if (!this.inVillage && s.villageSeen && !gateOpen(P, 'ingresso') && Math.hypot(this.player.pos.x - MALL.x, this.player.pos.z - MALL.z) < 260) ui.objective('Le porte del centro commerciale sono corrotte. Libera il terminale del parcheggio.');
    else if (!s.villageSeen) ui.objective('La strada continua oltre l\'hotel: sale fino in vetta.');
    else if (!this.inVillage && !this.mallSeen) ui.objective('Un\'altra strada scende a ovest, verso un edificio bianco enorme.');
    else if (!this.inVillage) ui.objective('');
    else
      ui.checklist([
        [`Un caffè al Bar Alpino`, !!s.coffee],
        ['Il cannocchiale del belvedere', !!s.scope],
        ['La campana del campanile', !!s.bell],
        ['La porta 1313: dritti nella suite', false],
      ]);
  }

  // ---------- Ciclo ----------
  update(dt) {
    const { input, ui, audio } = this.ctx;
    this.time += dt;
    this.lineTimer -= dt;
    if (input.wasPressed('KeyN')) audio.toggleMute();
    while (this.script.length && this.script[0].at <= this.time) this.script.shift().fn();

    this.digital.update(dt, this.time, input);
    const prevP = { x: this.player.pos.x, z: this.player.pos.z };
    const prevC = { x: this.car.pos.x, z: this.car.pos.z };
    if (this.digital.open) this.player.animate(dt, 0);
    else if (this.activity) this.updateActivity(dt);
    else if (this.mode === 'car') this.updateCar(dt);
    else this.updateFoot(dt);
    this.digital.discover(this.mode === 'car' ? this.car.pos : this.player.pos, (d, f) => this.later(d, f));
    this.updateGates(dt, prevP, prevC);

    if (this.mode === 'foot' || this.activity) this.updateFriend(dt);
    if (this.followers && this.mode === 'foot') {
      const moving = Math.hypot(this.player.vel.x, this.player.vel.z) > 0.3;
      this.idleT = moving ? 0 : (this.idleT || 0) + dt;
      this.followers.update(dt, this.time, this.player, (x, z) => this.blockedAt(x, z), 'follow', null);
    }

    // il borgo: la prima volta che ci arrivi
    const pos = this.mode === 'car' ? this.car.pos : this.player.pos;
    const dv = Math.hypot(pos.x - VILLAGE.x, pos.z - VILLAGE.z);
    this.inVillage = dv < VILLAGE.r - 10;
    if (this.inVillage && !this.flags.arrived) {
      this.flags.arrived = true;
      ui.popup(`${VILLAGE_NAME} · ${VILLAGE_ALT}`);
      audio.bell(0.12, 220);
      if (!this.saved.villageSeen) {
        this.saved.villageSeen = true;
        this.save();
        this.later(1.2, () => ui.subtitle(FRIEND, 'Un paesino! Lassù in cima, sopra le nuvole. Fermiamoci un po\'.', 3.6));
        this.later(5.5, () => ui.subtitle(FRIEND, this.mode === 'car' ? 'Lasciamo la macchina e facciamo due passi in piazza.' : 'Senti che silenzio. Solo la fontana.', 3.2));
      } else this.later(1, () => ui.subtitle(FRIEND, 'Di nuovo quassù. Mi piace questo posto.', 3));
      this.discoverPlace('borgo');
      this.updateObjective();
    }
    if (!this.inVillage && dv > VILLAGE.r + 40 && this.flags.arrived) {
      this.flags.arrived = false;
      this.updateObjective();
    }
    audio.loop('fontana', this.mode === 'foot' && Math.hypot(pos.x - VILLAGE.x, pos.z - VILLAGE.z) < 22, { freq: 2200, q: 0.5, vol: 0.05 });

    this.applyAtmosphere();
    this.scenery.update(this.time, this.night, 9999);
    this.hotel.update(this.time);
    this.village.update(this.time);
    this.airport.update(this.time);
    this.demon.update(dt, pos, false, 0);
    this.dust.update(dt);
    this.sky.update(this.camera, dt);
    if (Math.random() < 0.3) {
      for (const ch of this.hotel.chimneys) {
        this.dust.emit(ch.x, ch.y, ch.z, 1 + Math.random(), 3, Math.random() - 0.5, { color: [0.4, 0.42, 0.48], size: 6, endSize: 22, life: 6, alpha: 0.3, drag: 0.2 });
      }
    }
    // la campana oscilla dopo i rintocchi
    const b = this.village.bell;
    this.bellSwing = (this.bellSwing || 0) * Math.exp(-0.9 * dt);
    b.rotation.z = Math.sin(this.time * 3.4) * this.bellSwing;

    const sp = this.mode === 'car' ? this.car.speed * 3.6 : pos.y * 4.55; // altitudine "di sogno" in metri
    ui.updateHud({ speed: sp, turbo: this.mode === 'car' ? this.car.turbo : 1, health: 1, time: this.time, counter: this.inVillage ? VILLAGE_NAME : '' });
    this.updateCompass(pos);
  }

  // Un macroluogo visitato per la prima volta: nella suite compare la sua porta.
  discoverPlace(id) {
    if (id === 'borgo') this.village.setShortcutOpen(true);
    if (!unlockPlace(this.ctx, id)) return;
    const { ui, audio } = this.ctx;
    this.later(9, () => {
      ui.popup(`Una nuova porta: ${placeById(id).name}`);
      audio.chime(784, 0.12);
      ui.subtitle(FRIEND, 'Hai visto quella porta, lì da sola? C\'è scritto 1313. Il numero della nostra suite.', 4);
    });
  }

  // terreno troppo ripido o ostacoli: dove gli gnomi non vanno
  blockedAt(x, z) {
    for (const b of this.boxes) if (x > b.minX && x < b.maxX && z > b.minZ && z < b.maxZ) return true;
    return false;
  }

  nearBoxes(p, r = 30) {
    return this.boxes.filter((b) => p.x > b.minX - r && p.x < b.maxX + r && p.z > b.minZ - r && p.z < b.maxZ + r);
  }

  collideTrees(ch) {
    for (const o of this.scenery.colliders.near(ch.pos.x, ch.pos.z, this.near)) {
      const dx = ch.pos.x - o.x;
      const dz = ch.pos.z - o.z;
      const d = Math.hypot(dx, dz);
      const min = o.r * 0.6 + ch.radius;
      if (d < min && d > 1e-4) {
        ch.pos.x = o.x + (dx / d) * min;
        ch.pos.z = o.z + (dz / d) * min;
      }
    }
  }

  // Muove un personaggio rispettando pendenze e ostacoli.
  walk(ch, dt) {
    const ox = ch.pos.x;
    const oz = ch.pos.z;
    const g0 = this.groundAt(ox, oz);
    ch.pos.x += ch.vel.x * dt;
    ch.pos.z += ch.vel.z * dt;
    ch.collide(this.nearBoxes(ch.pos, 4));
    this.collideTrees(ch);
    // non si scala la montagna a mani nude: oltre una certa pendenza ci si ferma
    const step = Math.hypot(ch.pos.x - ox, ch.pos.z - oz);
    const g1 = this.groundAt(ch.pos.x, ch.pos.z);
    if (step > 1e-4 && (g1 - g0) / step > 1.15 && g1 - g0 > 0.05 && !this.onSteps(ch.pos)) {
      ch.pos.x = ox;
      ch.pos.z = oz;
    }
    // la macchina è un ostacolo
    if (this.mode === 'foot') {
      const c = this.car;
      const dx = ch.pos.x - c.pos.x;
      const dz = ch.pos.z - c.pos.z;
      const d = Math.hypot(dx, dz);
      const min = 1.9;
      if (d < min && d > 1e-4) {
        ch.pos.x = c.pos.x + (dx / d) * min;
        ch.pos.z = c.pos.z + (dz / d) * min;
      }
    }
    ch.pos.x = clamp(ch.pos.x, -1500, 1500);
    ch.pos.z = clamp(ch.pos.z, -1500, 1500);
    const ground = this.groundAt(ch.pos.x, ch.pos.z);
    ch.vel.y = (ch.vel.y || 0) - 22 * dt;
    ch.pos.y += ch.vel.y * dt;
    if (ch.pos.y <= ground) {
      ch.pos.y = ground;
      ch.vel.y = 0;
      ch.grounded = true;
    } else if (ch.pos.y - ground < 0.6 && ch.vel.y <= 0 && ch.grounded) {
      // scendendo (scale, discese) si resta attaccati al suolo
      ch.pos.y = ground;
      ch.vel.y = 0;
    } else ch.grounded = false;
  }

  onSteps(p) {
    return p.x > STEPS.minX && p.x < STEPS.maxX && p.z > STEPS.minZ - 0.5 && p.z <= STEPS.maxZ + 0.6;
  }

  updateFoot(dt) {
    const { input, ui, audio } = this.ctx;
    const p = this.player;
    if (input.locked) {
      this.camYaw -= input.mouseDX * 0.0025;
      this.camPitch = clamp(this.camPitch + input.mouseDY * 0.002, -0.3, 1.1);
    }
    if (input.down('ArrowLeft')) this.camYaw += dt * 2.2;
    if (input.down('ArrowRight')) this.camYaw -= dt * 2.2;
    const f = (input.down('KeyW', 'ArrowUp') ? 1 : 0) - (input.down('KeyS', 'ArrowDown') ? 1 : 0);
    const s = (input.down('KeyA') ? 1 : 0) - (input.down('KeyD') ? 1 : 0);
    const fx = Math.sin(this.camYaw);
    const fz = Math.cos(this.camYaw);
    let mx = fx * f + fz * s;
    let mz = fz * f - fx * s;
    const l = Math.hypot(mx, mz);
    if (l > 0) {
      mx /= l;
      mz /= l;
    }
    const speed = input.down('ShiftLeft', 'ShiftRight') ? 9 : 5;
    const k = 1 - Math.exp(-12 * dt);
    p.vel.x += (mx * speed - p.vel.x) * k;
    p.vel.z += (mz * speed - p.vel.z) * k;
    if (mx || mz) {
      let d = Math.atan2(mx, mz) - p.facing;
      d = Math.atan2(Math.sin(d), Math.cos(d));
      p.facing += d * (1 - Math.exp(-14 * dt));
    }
    if (input.wasPressed('Space') && p.grounded) {
      p.vel.y = 7;
      p.grounded = false;
      audio.whoosh(0.1);
    }
    this.walk(p, dt);
    p.animate(dt, Math.hypot(p.vel.x, p.vel.z));

    // tornare dentro: il portone è sempre aperto
    if (Math.hypot(p.pos.x - DOOR.x, p.pos.z - DOOR.z) < 2.2 && mz > 0.5 && !this.leaving) {
      this.goInside();
      return;
    }
    // le porte dell'aeroporto: sempre aperte
    const ae = this.airport.entrance;
    if (Math.abs(p.pos.x - ae.x) < ae.halfW && p.pos.z < ae.z + 1.4 && p.pos.z > ae.z - 1 && mz < -0.5 && !this.leaving) {
      this.leave(() => this.ctx.goto('aeroporto', 'entrata'));
      return;
    }
    // e le porte di vetro del centro commerciale si aprono da sole (se non sono corrotte)
    const me = this.mall.entrance;
    if (Math.abs(p.pos.x - me.x) < 1.3 && Math.abs(p.pos.z - me.z) < me.halfW && mx < -0.5 && !this.leaving) {
      if (this.doorOpen) {
        this.leave(() => this.ctx.enterMall('entrance'));
        return;
      }
      p.pos.x = me.x + 1.4;
      this.gateMessage('ingresso');
    }

    if (input.wasPressed('KeyC')) this.summonCar();
    const it = this.findInteraction();
    ui.hint(it ? `<kbd>E</kbd> ${it.label}` : null);
    if (it && input.wasPressed('KeyE')) it.fn();
    this.updateCamera(dt);
  }

  // Tasto C: la macchina ti raggiunge, come succede nei sogni. Compare accanto
  // a te in un punto libero e abbastanza piano, già girata dove guardi.
  summonCar() {
    const { ui, audio } = this.ctx;
    const p = this.player;
    const c = this.car;
    if (Math.hypot(c.pos.x - p.pos.x, c.pos.z - p.pos.z) < 6) {
      ui.subtitle(FRIEND, 'È proprio qui, la macchina.', 1.8);
      return;
    }
    const fx = Math.sin(p.facing);
    const fz = Math.cos(p.facing);
    const free = (x, z) => {
      if (this.boxes.some((b) => x > b.minX - 2.8 && x < b.maxX + 2.8 && z > b.minZ - 2.8 && z < b.maxZ + 2.8)) return false;
      if (this.scenery.colliders.near(x, z, this.near).some((o) => Math.hypot(o.x - x, o.z - z) < o.r + 2.8)) return false;
      if (this.npcs.some((n) => Math.hypot(n.c.pos.x - x, n.c.pos.z - z) < 3)) return false;
      const n = this.terrain.normalAt(x, z, this.tmpV, 2.5);
      return n.y > 0.85 && Math.abs(this.groundAt(x, z) - p.pos.y) < 3;
    };
    // prima di lato, poi davanti, poi dietro, allargandosi un po'
    for (const r of [4, 6, 9]) {
      for (const [sx, sz] of [[fz, -fx], [-fz, fx], [fx, fz], [-fx, -fz]]) {
        const x = p.pos.x + sx * r;
        const z = p.pos.z + sz * r;
        if (!free(x, z)) continue;
        c.reset(x, z, p.facing, this.terrain);
        c.vx = c.vz = 0;
        audio.whoosh(0.3);
        audio.chime(660, 0.08);
        this.dust.burst(x, c.pos.y + 0.5, z, 24, 5, { color: [0.85, 0.85, 0.9], size: 1.6, endSize: 5, life: 1.1, drag: 2, alpha: 0.35 });
        if (!this.flags.summoned) {
          this.flags.summoned = true;
          this.later(0.6, () => ui.subtitle(FRIEND, 'Ma... era parcheggiata dall\'altra parte della valle. Va bene, non facciamo domande.', 3.6));
        }
        return;
      }
    }
    ui.subtitle(FRIEND, 'Qui non c\'è spazio per la macchina. Spostiamoci un po\'.', 2.4);
  }

  goInside() {
    this.leave(() => this.ctx.enterHotel());
  }

  leave(go) {
    if (this.leaving) return;
    this.leaving = true;
    this.ctx.ui.hint(null);
    this.ctx.audio.thud(0.2);
    this.saved.car = { x: this.car.pos.x, z: this.car.pos.z, h: this.car.heading };
    this.save();
    go();
  }

  findInteraction() {
    const p = this.player.pos;
    const V = this.village;
    const near = (x, z, r) => Math.hypot(p.x - x, p.z - z) < r;
    if (near(DOOR.x, DOOR.z, 4.5)) return { label: 'rientra nell\'hotel', fn: () => this.goInside() };
    const term = this.digital.near(p);
    if (term) return { label: 'collega la chiavetta al terminale', fn: () => this.digital.connect(term, () => this.onTerminalDone()) };
    if (near(this.car.pos.x, this.car.pos.z, 3.6)) return { label: 'sali in macchina', fn: () => this.getIn() };
    const me = this.mall.entrance;
    const ae = this.airport.entrance;
    if (near(ae.x, ae.z + 2, 5)) return { label: 'entra nell\'aeroporto', fn: () => this.leave(() => this.ctx.goto('aeroporto', 'entrata')) };
    if (near(me.x + 1.5, me.z, 5.5)) {
      if (!this.doorOpen) return { label: 'le porte sono corrotte', fn: () => this.gateMessage('ingresso', true) };
      return { label: 'entra nel centro commerciale', fn: () => this.leave(() => this.ctx.enterMall('entrance')) };
    }
    if (!this.inVillage) return null;
    const sd = V.shortcut;
    if (near(sd.spot.x, sd.spot.z, 1.8)) return { label: 'apri la porta 1313', fn: () => this.leave(() => this.ctx.travel('suite')) };
    for (const n of this.npcs) {
      if (n.lines && near(n.c.pos.x, n.c.pos.z, 2.4)) return { label: 'parla', fn: () => this.talk(n) };
    }
    for (const t of V.tables) if (near(t.x, t.z, 1.9)) return { label: 'siediti e prendi un caffè', fn: () => this.startActivity('coffee', { table: t }) };
    if (near(V.scope.x, V.scope.z, 2.2)) return { label: 'guarda nel cannocchiale', fn: () => this.startActivity('scope') };
    if (near(V.bellRope.x, V.bellRope.z, 2.4)) return { label: 'tira la corda della campana', fn: () => this.startActivity('bell') };
    const df = Math.hypot(p.x - V.fountain.x, p.z - V.fountain.z);
    if (df > 2.3 && df < 3.8) return { label: 'bevi alla fontana', fn: () => this.startActivity('drink') };
    return null;
  }

  talk(n) {
    const { ui, audio } = this.ctx;
    ui.subtitle(n.who, n.lines[n.idx % n.lines.length], 4);
    n.idx++;
    audio.squeak(0.02);
    const p = this.player.pos;
    if (!n.sit) n.c.facing = Math.atan2(p.x - n.c.pos.x, p.z - n.c.pos.z);
  }

  // ---------- Le cose da fare in paese ----------
  startActivity(kind, data = {}) {
    const { ui, audio } = this.ctx;
    ui.hint(null);
    const p = this.player;
    p.vel.set(0, 0, 0);
    this.activity = { kind, t: 0, ...data };
    const V = this.village;
    const Y = V.center.y;
    if (kind === 'coffee') {
      const t = data.table;
      p.pos.set(t.x - 0.85, Y + 0.12, t.z);
      p.facing = Math.PI / 2;
      p.sitting = true;
      this.friend.pos.set(t.x + 0.85, Y + 0.12, t.z);
      this.friend.facing = -Math.PI / 2;
      this.friend.sitting = true;
      this.activity.lines = COFFEE_LINES[(this.saved.coffeeCount || 0) % COFFEE_LINES.length];
      this.activity.cam = new THREE.Vector3(t.x + 0.4, Y + 2.1, t.z + 3.4);
      this.activity.look = new THREE.Vector3(t.x, Y + 0.9, t.z);
      ui.subtitle('Il barista:', 'Due caffè, arrivano!', 2.4);
      this.later(2.2, () => audio.pour());
    } else if (kind === 'scope') {
      p.pos.set(V.scope.x - Math.sin(V.belYaw) * 0.7, Y, V.scope.z - Math.cos(V.belYaw) * 0.7);
      p.facing = V.belYaw;
      // la lente "vola" oltre il bordo dell'altopiano finché la vista sulla valle è
      // libera (con margine: la mesh del terreno è più grossolana dell'altezza esatta)
      const eye = new THREE.Vector3(V.scope.x, Y + 1.5, V.scope.z);
      const T = V.scopeLook;
      const hx = Math.sin(V.belYaw);
      const hz = Math.cos(V.belYaw);
      for (let k = 0; k < 30 && !this.terrain.lineOfSight(eye.x, eye.y - 9, eye.z, T.x, T.y - 9, T.z, 160); k++) {
        eye.x += hx * 4;
        eye.z += hz * 4;
        eye.y = Math.max(eye.y, this.terrain.heightAt(eye.x, eye.z) + 1.5);
      }
      this.activity.eye = eye;
      const d = new THREE.Vector3().subVectors(T, eye);
      this.activity.yaw0 = Math.atan2(d.x, d.z);
      this.activity.pitch0 = Math.atan2(d.y, Math.hypot(d.x, d.z));
      this.activity.yaw = 0;
      this.activity.pitch = 0;
      ui.center('<div class="scope-mask"></div>');
      audio.chime(660, 0.08);
      this.later(1.2, () => ui.subtitle(null, this.night
        ? 'Laggiù l\'hotel, minuscolo, con le finestre accese. Dietro, il campo... e un bagliore rosso, fermo.'
        : 'Laggiù l\'hotel, minuscolo. Dietro, il campo... e lui, ancora fermo.', 5));
      this.later(6.5, () => this.activity?.kind === 'scope' && ui.subtitle(FRIEND, 'Non ci vede. Da quassù nessuno ci vede.', 3));
    } else if (kind === 'bell') {
      p.pos.set(V.bellRope.x - 0.8, Y, V.bellRope.z + 0.6);
      p.facing = 0;
      this.activity.rings = 0;
      // il gesto: tirare la corda al momento giusto. Ogni rintocco suona davvero, lassù.
      this.ctx.input.unlock();
      const sfx = gestureSfx(audio);
      const prev = this.ctx.progress.gesti?.campana ?? null;
      this.gesture.start('campana', {
        sfx: (name) => {
          sfx(name);
          if (name === 'bell') {
            this.bellSwing = 0.6;
            this.shake = 0.25;
            p.armL.rotation.x = p.armR.rotation.x = -2.6;
          }
        },
      }, (res) => {
        recordGesture(this.ctx, res);
        const a = this.activity;
        if (!a || res.skipped) return;
        // i rintocchi li hai già suonati tu: resta solo l'eco
        a.rings = 3;
        a.t = 3.5;
        a.result = res;
      }, prev);
    } else if (kind === 'drink') {
      const dx = p.pos.x - V.fountain.x;
      const dz = p.pos.z - V.fountain.z;
      p.facing = Math.atan2(-dx, -dz);
      audio.pour();
    }
  }

  endActivity() {
    const { ui } = this.ctx;
    const a = this.activity;
    this.activity = null;
    const p = this.player;
    if (a.kind === 'coffee') {
      p.sitting = false;
      this.friend.sitting = false;
      p.pos.z += 1.2;
      this.friend.pos.z += 1.2;
      this.saved.coffee = true;
      this.saved.coffeeCount = (this.saved.coffeeCount || 0) + 1;
      ui.popup('Un caffè a Sant\'Onirio');
    } else if (a.kind === 'scope') {
      ui.center(null);
      this.saved.scope = true;
    } else if (a.kind === 'bell') {
      this.saved.bell = true;
      const good = a.result && a.result.grade >= 2;
      this.later(1, () => ui.subtitle('Due anziani sulla panchina:', good ? 'Però. Tre rintocchi puliti. Nemmeno il parroco.' : 'Eccolo, quello dell\'hotel. Suona sempre all\'ora sbagliata.', 3.5));
    } else if (a.kind === 'drink') {
      ui.popup('Acqua di montagna, gelida');
    }
    this.save();
    this.updateObjective();
    this.camYaw = p.facing;
    this.updateCamera(1, true);
  }

  updateActivity(dt) {
    const { input, ui, audio } = this.ctx;
    const a = this.activity;
    const p = this.player;
    const V = this.village;
    if (this.gesture.open) {
      this.gesture.update(dt, input);
      p.animate(dt, 0);
      if (a.kind === 'bell') {
        const tower = new THREE.Vector3(V.bell.position.x, V.bell.position.y, V.bell.position.z);
        this.cinematic(dt, new THREE.Vector3(V.bellRope.x + 3, V.center.y + 1.6, V.bellRope.z - 10), tower.lerp(p.pos, 0.55));
      }
      return;
    }
    a.t += dt;
    const exit = input.wasPressed('KeyE', 'Escape') && a.t > 0.6;
    p.animate(dt, 0);
    if (a.kind === 'coffee') {
      if (a.t > 3 && !a.said1) {
        a.said1 = true;
        ui.subtitle(FRIEND, a.lines[0], 3.6);
      }
      if (a.t > 7.5 && !a.said2) {
        a.said2 = true;
        ui.subtitle(FRIEND, a.lines[1], 3.6);
      }
      if (a.t > 2.6 && Math.random() < 0.25) {
        const t = a.table;
        this.dust.emit(t.x + (Math.random() - 0.5) * 0.6, V.center.y + 0.85, t.z, 0, 0.4, 0, { color: [0.95, 0.95, 0.95], size: 0.12, endSize: 0.4, life: 1.6, alpha: 0.35, drag: 0.5 });
      }
      this.cinematic(dt, a.cam, a.look);
      if (exit || a.t > 12) this.endActivity();
    } else if (a.kind === 'scope') {
      if (input.locked) {
        a.yaw = clamp(a.yaw - input.mouseDX * 0.0012, -1.8, 1.8);
        a.pitch = clamp(a.pitch - input.mouseDY * 0.0012, -0.3, 0.3);
      }
      if (input.down('ArrowLeft', 'KeyA')) a.yaw = clamp(a.yaw + dt * 0.4, -1.8, 1.8);
      if (input.down('ArrowRight', 'KeyD')) a.yaw = clamp(a.yaw - dt * 0.4, -1.8, 1.8);
      if (input.down('ArrowUp', 'KeyW')) a.pitch = clamp(a.pitch + dt * 0.3, -0.3, 0.3);
      if (input.down('ArrowDown', 'KeyS')) a.pitch = clamp(a.pitch - dt * 0.3, -0.3, 0.3);
      const yaw = a.yaw0 + a.yaw;
      const pitch = a.pitch0 + a.pitch;
      const eye = a.eye;
      this.camera.position.copy(eye);
      this.camera.lookAt(eye.x + Math.sin(yaw) * Math.cos(pitch), eye.y + Math.sin(pitch), eye.z + Math.cos(yaw) * Math.cos(pitch));
      this.camera.fov += (24 - this.camera.fov) * (1 - Math.exp(-3 * dt));
      this.camera.updateProjectionMatrix();
      ui.hint('Muovi il mouse per guardare intorno · <kbd>E</kbd> smetti');
      if (exit) {
        ui.hint(null);
        this.endActivity();
      }
    } else if (a.kind === 'bell') {
      // tre rintocchi: la corda scende, la campana risponde dall'alto
      const ringAt = [0.4, 1.9, 3.4];
      if (a.rings < ringAt.length && a.t > ringAt[a.rings]) {
        a.rings++;
        audio.bell(0.35, 196);
        this.bellSwing = 0.6;
        this.shake = 0.25;
        p.armL.rotation.x = p.armR.rotation.x = -2.6;
      }
      const tower = new THREE.Vector3(V.bell.position.x, V.bell.position.y, V.bell.position.z);
      const cam = new THREE.Vector3(V.bellRope.x + 3, V.center.y + 1.6, V.bellRope.z - 10);
      this.cinematic(dt, cam, tower.lerp(p.pos, 0.55));
      if (a.t > 6 || (exit && a.rings >= 3)) this.endActivity();
    } else if (a.kind === 'drink') {
      p.body.rotation.x = 0.5 * Math.sin(Math.min(1, a.t / 2.4) * Math.PI);
      this.updateCamera(dt);
      if (a.t > 2.6) {
        p.body.rotation.x = 0;
        this.endActivity();
        if (!this.flags.drank) {
          this.flags.drank = true;
          ui.subtitle(FRIEND, 'Dicono che chi beve qui torna sempre. Noi non ce ne siamo mai andati.', 3.6);
        }
      }
    }
  }

  cinematic(dt, pos, look) {
    const k = 1 - Math.exp(-2.5 * dt);
    this.camPos.lerp(pos, k);
    this.camLook.lerp(look, k);
    this.shake *= Math.exp(-3 * dt);
    this.camera.position.set(this.camPos.x + (Math.random() - 0.5) * this.shake, this.camPos.y + (Math.random() - 0.5) * this.shake, this.camPos.z);
    this.camera.lookAt(this.camLook);
    this.camera.fov += (55 - this.camera.fov) * k;
    this.camera.updateProjectionMatrix();
  }

  updateFriend(dt) {
    const fr = this.friend;
    if (fr.sitting) {
      fr.animate(dt, 0);
      return;
    }
    const p = this.player;
    // ti cammina accanto, un po' indietro e di lato
    const fx = Math.sin(p.facing);
    const fz = Math.cos(p.facing);
    const tx = p.pos.x - fx * 1.2 + fz * 1.4;
    const tz = p.pos.z - fz * 1.2 - fx * 1.4;
    const dx = tx - fr.pos.x;
    const dz = tz - fr.pos.z;
    const d = Math.hypot(dx, dz);
    if (d > 30) {
      fr.pos.set(tx, this.groundAt(tx, tz), tz);
      fr.vel.set(0, 0, 0);
    }
    const want = d > 0.6 ? Math.min(9.5, d * 2.2) : 0;
    const k = 1 - Math.exp(-8 * dt);
    fr.vel.x += ((d > 0.01 ? dx / d : 0) * want - fr.vel.x) * k;
    fr.vel.z += ((d > 0.01 ? dz / d : 0) * want - fr.vel.z) * k;
    this.walk(fr, dt);
    const hs = Math.hypot(fr.vel.x, fr.vel.z);
    if (hs > 0.4) {
      let a = Math.atan2(fr.vel.x, fr.vel.z) - fr.facing;
      a = Math.atan2(Math.sin(a), Math.cos(a));
      fr.facing += a * (1 - Math.exp(-10 * dt));
    } else {
      // fermo: guarda il panorama, o te
      const look = this.inVillage ? Math.atan2(p.pos.x - fr.pos.x, p.pos.z - fr.pos.z) : fr.facing;
      let a = look - fr.facing;
      a = Math.atan2(Math.sin(a), Math.cos(a));
      fr.facing += a * (1 - Math.exp(-2 * dt));
    }
    fr.animate(dt, hs);
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
    const c = this.car;
    const road = this.terrain.roadInfo(c.pos.x, c.pos.z);
    const surface = this.terrain.surfaceAt(c.pos.x, c.pos.z, road.dist);
    c.update(dt, ctl, this.terrain, surface);
    for (const o of this.scenery.colliders.near(c.pos.x, c.pos.z, this.near)) {
      const imp = c.collideCircle(o.x, o.z, o.r);
      if (imp > 8) {
        audio.thud(clamp(imp / 30, 0.2, 0.8));
        this.shake = Math.max(this.shake, 0.4);
      }
    }
    for (const b of this.nearBoxes(c.pos, 8)) c.collideBox(b.minX, b.maxX, b.minZ, b.maxZ);
    c.collideBox(STEPS.minX, STEPS.maxX, STEPS.minZ, STEPS.maxZ);
    if (input.wasPressed('KeyR') && road.idx >= 0) {
      const r = this.terrain.road[road.idx];
      c.reset(r.x, r.z, Math.atan2(r.tx, r.tz), this.terrain);
      audio.whoosh(0.3);
    }
    audio.engineUpdate(clamp(Math.abs(c.forwardSpeed) / 80, 0, 1), ctl.throttle, c.turboActive);
    // il passeggero commenta il paesaggio
    if (c.speed > 45 && this.lineTimer <= 0 && !this.flags.slow) {
      this.flags.slow = true;
      this.lineTimer = 8;
      ui.subtitle(FRIEND, 'Ehi, non c\'è nessun demone stavolta. Possiamo goderci il panorama.', 3.2);
    }
    const slow = c.speed < 3;
    ui.hint(slow ? '<kbd>E</kbd> scendi dalla macchina' : null);
    if (slow && input.wasPressed('KeyE')) {
      ui.hint(null);
      this.getOut();
      return;
    }
    const me = this.mall.entrance;
    if (Math.hypot(c.pos.x - me.x, c.pos.z - me.z) < 70 && !this.mallSeen && !this.flags.mallHint) {
      this.flags.mallHint = true;
      ui.subtitle(FRIEND, 'Un centro commerciale... quassù? E il parcheggio è vuoto.', 3.2);
    }
    if (Math.hypot(c.pos.x - DOOR.x, c.pos.z - DOOR.z) < 22 && slow && !this.flags.parkHint) {
      this.flags.parkHint = true;
      ui.subtitle(FRIEND, 'Parcheggiamo qui e entriamo a piedi.', 2.6);
    }
    this.updateCarCamera(dt);
  }

  updateCarCamera(dt) {
    const c = this.car;
    const sp = c.speed;
    const back = 10 + sp * 0.05;
    const tx = c.pos.x - c.fwdX * back;
    const tz = c.pos.z - c.fwdZ * back;
    const ty = Math.max(c.pos.y + 3.8 + sp * 0.012, this.terrain.heightAt(tx, tz) + 2);
    const k = 1 - Math.exp(-5 * dt);
    this.camPos.x += (tx - this.camPos.x) * k;
    this.camPos.z += (tz - this.camPos.z) * k;
    this.camPos.y += (ty - this.camPos.y) * (1 - Math.exp(-3.5 * dt));
    this.camPos.y = Math.max(this.camPos.y, this.terrain.heightAt(this.camPos.x, this.camPos.z) + 1.5);
    const look = this.tmpV.set(c.pos.x + c.fwdX * 6, c.pos.y + 1.8, c.pos.z + c.fwdZ * 6);
    this.camLook.lerp(look, 1 - Math.exp(-10 * dt));
    this.shake *= Math.exp(-3.2 * dt);
    const s = this.shake;
    this.camera.position.set(this.camPos.x + (Math.random() - 0.5) * s, this.camPos.y + (Math.random() - 0.5) * s, this.camPos.z + (Math.random() - 0.5) * s);
    this.camera.lookAt(this.camLook);
    const fov = 64 + clamp(sp / 80, 0, 1) * 20;
    this.camera.fov += (fov - this.camera.fov) * (1 - Math.exp(-3 * dt));
    this.camera.updateProjectionMatrix();
  }

  snapCamera() {
    this.updateCamera(1, true);
  }

  updateCamera(dt, snap = false) {
    const p = this.player;
    const head = this.tmpV.set(p.pos.x, p.pos.y + 1.6, p.pos.z);
    const dist = this.inVillage ? 4.6 : 5.4;
    const pitch = this.camPitch;
    const dx = -Math.sin(this.camYaw) * Math.cos(pitch);
    const dz = -Math.cos(this.camYaw) * Math.cos(pitch);
    const dy = Math.sin(pitch);
    // la camera non entra nei muri: si avvicina finché la vista è libera
    let reach = dist;
    const boxes = this.nearBoxes(head, dist + 1).concat(STEPS_BLOCK);
    for (let s = 0.3; s <= dist; s += 0.2) {
      const x = head.x + dx * s;
      const z = head.z + dz * s;
      const y = head.y + dy * s;
      const hit = boxes.some((b) => x > b.minX - 0.25 && x < b.maxX + 0.25 && z > b.minZ - 0.25 && z < b.maxZ + 0.25 && y < (b.top ?? Infinity));
      if (hit) {
        reach = Math.max(0.35, s - 0.25);
        break;
      }
    }
    const tx = head.x + dx * reach;
    const tz = head.z + dz * reach;
    let ty = head.y + dy * reach;
    ty = Math.max(ty, this.groundAt(tx, tz) + 0.5);
    const k = snap || reach < dist - 0.1 ? 1 : 1 - Math.exp(-10 * dt);
    this.camPos.x += (tx - this.camPos.x) * k;
    this.camPos.y += (ty - this.camPos.y) * k;
    this.camPos.z += (tz - this.camPos.z) * k;
    this.camLook.set(head.x, head.y, head.z);
    this.shake *= Math.exp(-3 * dt);
    this.camera.position.copy(this.camPos);
    this.camera.lookAt(this.camLook);
    const fov = 62;
    this.camera.fov += (fov - this.camera.fov) * (snap ? 1 : 1 - Math.exp(-4 * dt));
    this.camera.updateProjectionMatrix();
  }

  updateCompass(pos) {
    const { ui } = this.ctx;
    let target = null;
    const P = this.ctx.progress;
    const piaz = this.digital.terms.find((t) => t.id === 'piazzale');
    if (!gateOpen(P, 'borgo') && !this.inVillage) {
      // prima di tutto, il terminale accanto all'hotel
      if (Math.hypot(pos.x - piaz.x, pos.z - piaz.z) > 12) target = piaz;
    } else if (!this.saved.villageSeen && !this.inVillage) {
      const T = this.terrain;
      const info = T.roadInfo(pos.x, pos.z);
      if (Math.hypot(pos.x - VILLAGE.x, pos.z - VILLAGE.z) < 260) target = VILLAGE;
      else if (info.idx >= T.upperStart && info.idx < T.mallStart) target = T.road[Math.min(T.mallStart - 1, info.idx + 25)];
      else target = T.road[T.upperStart + 10];
    } else if (this.saved.villageSeen && !this.mallSeen && !this.inVillage) {
      const T = this.terrain;
      const info = T.roadInfo(pos.x, pos.z);
      if (Math.hypot(pos.x - MALL.x, pos.z - MALL.z) < 300) target = this.mall.entrance;
      else if (info.idx >= T.mallStart) target = T.road[Math.min(T.road.length - 1, info.idx + 25)];
      else target = T.road[T.mallStart + 10];
    }
    // se non c'è altro da fare, la bussola indica l'aeroporto non ancora visitato
    if (!target && !this.ctx.progress.places?.aeroporto && !this.inVillage && Math.hypot(pos.x - this.airport.center.x, pos.z - this.airport.center.z) > 30) target = this.airport.center;
    if (!target || this.activity) {
      ui.compass(null);
      return;
    }
    const camYaw = Math.atan2(this.camLook.x - this.camera.position.x, this.camLook.z - this.camera.position.z);
    const toT = Math.atan2(target.x - pos.x, target.z - pos.z);
    ui.compass(-(toT - camYaw));
  }

  applyAtmosphere() {
    const k = this.night;
    const u = this.sky.uniforms;
    const mix = (a, b) => new THREE.Color(a).lerp(new THREE.Color(b), k);
    u.top.value.copy(mix(SKY_DAY.top, SKY_NIGHT.top));
    u.horizon.value.copy(mix(SKY_DAY.horizon, SKY_NIGHT.horizon));
    u.bottom.value.copy(mix(SKY_DAY.bottom, SKY_NIGHT.bottom));
    u.sunColor.value.copy(mix(SKY_DAY.sun, SKY_NIGHT.sun)).multiplyScalar(1 - k * 0.6);
    u.stars.value = smoothstep(0.35, 1, k);
    this.scene.fog.color.copy(mix(SKY_DAY.fog, SKY_NIGHT.fog));
    this.scene.fog.density = lerp(0.0006, 0.0011, k);
    this.hemi.color.copy(mix(SKY_DAY.hemiSky, SKY_NIGHT.hemiSky));
    this.hemi.groundColor.copy(mix(SKY_DAY.hemiGround, SKY_NIGHT.hemiGround));
    this.hemi.intensity = lerp(1.2, 0.6, k);
    this.sun.color.copy(mix(SKY_DAY.light, SKY_NIGHT.light));
    this.sun.intensity = lerp(2.6, 0.55, k);
    const d = this.tmpV.set(lerp(0.4, 0.5, k), lerp(0.75, 0.45, k), lerp(0.3, 1, k)).normalize();
    u.sunDir.value.copy(d);
    const c = this.mode === 'car' ? this.car.pos : this.player.pos;
    this.sun.position.set(c.x + d.x * 300, c.y + d.y * 300, c.z + d.z * 300);
    this.sun.target.position.copy(c);
    this.car.headlight.intensity = k * 900;
    this.village.setNight(k);
    this.mall.setNight(k);
    this.airport.setNight(k);
  }

  onResize() {
    this.dust.setScale(this.ctx.renderer, this.camera);
  }

  dispose() {
    const { ui, audio } = this.ctx;
    this.gesture.dispose();
    this.digital.dispose();
    this.gates.forEach((g) => g.wall.dispose());
    this.doorBarrier.dispose();
    glitchOverlay(0);
    this.ctx.renderer.domElement.removeEventListener('click', this.onCanvasClick);
    audio.engineStop();
    audio.ambience(null);
    audio.stopLoops();
    audio.stopAllPads(1);
    ui.hint(null);
    ui.center(null);
    ui.compass(null);
    ui.clearSubtitle();
    ui.objective('');
    this.car.dispose();
    this.demon.dispose();
    this.hotel.dispose();
    this.village.dispose();
    this.mall.dispose();
    this.airport.dispose();
    this.scenery.dispose();
    this.terrain.dispose();
    this.dust.dispose();
    this.player.dispose();
    this.friend.dispose();
    this.npcs.forEach((n) => n.c.dispose());
    this.followers?.dispose();
    const [m, geo, ...meshes] = this.stepParts;
    meshes.forEach((o) => o.removeFromParent());
    m.dispose();
    geo.dispose();
    this.sky.mesh.geometry.dispose();
    this.sky.mesh.material.dispose();
  }
}

// lo zoccolo sotto la torre: la camera non ci passa attraverso
const STEPS_BLOCK = [{ minX: HOTEL.x - 18, maxX: HOTEL.x + 18, minZ: HOTEL.z - 30 - 19, maxZ: HOTEL.z, top: Infinity }];
// i fianchi della scalinata: si sale solo di fronte
const STEPS_SIDE_L = { minX: STEPS.minX - 0.6, maxX: STEPS.minX, minZ: STEPS.minZ + 2, maxZ: STEPS.maxZ };
const STEPS_SIDE_R = { minX: STEPS.maxX, maxX: STEPS.maxX + 0.6, minZ: STEPS.minZ + 2, maxZ: STEPS.maxZ };
