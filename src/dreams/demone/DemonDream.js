import * as THREE from 'three';
import { createSky } from '../../core/sky.js';
import { Particles } from '../../core/particles.js';
import { clamp, lerp, smoothstep } from '../../core/noise.js';
import { Terrain, START, DEMON_POS, HOTEL } from './terrain.js';
import { Car } from './car.js';
import { Demon } from './demon.js';
import { BoulderSystem } from './boulders.js';
import { buildHotel } from './hotel.js';
import { buildScenery } from './scenery.js';

const FRIEND = 'Il tuo amico:';

const LINES = {
  hit: ['Ahia! Ci ha presi!', 'Occhio!!', 'La macchina non regge un altro colpo così!', 'Ma li vedi i cerchi rossi?!'],
  dodge: ['Per un pelo!', 'Vai così!', 'Ha mancato!', 'Sei un pazzo! Continua!', 'Quello era vicinissimo...', 'Ahahah, di nuovo mancato!'],
  jump: ['Stiamo volando!!', 'Wooo!', 'Tieniti forte!'],
  crash: ['Attento agli alberi!', 'Ahi! Guarda dove vai!'],
};

// Palette del cielo: tramonto infuocato nel campo -> notte stellata in montagna.
const SKY_FIELD = { top: '#2b0f2a', horizon: '#e0643a', bottom: '#3a1c18', fog: '#9a5040', sun: '#ffb070', light: '#ffc49a', hemiSky: '#ffb28a', hemiGround: '#4a3020' };
const SKY_NIGHT = { top: '#040817', horizon: '#26305a', bottom: '#0b0e1c', fog: '#1a2240', sun: '#b8c8ff', light: '#8fa6ff', hemiSky: '#5a6cb0', hemiGround: '#141828' };

export class DemonDream {
  constructor(ctx) {
    this.ctx = ctx;
    const { renderer } = ctx;
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(68, window.innerWidth / window.innerHeight, 0.5, 5000);

    this.terrain = new Terrain(7);
    this.scene.add(this.terrain.mesh, this.terrain.roadMesh);

    this.sky = createSky();
    this.scene.add(this.sky.mesh);
    this.scene.fog = new THREE.FogExp2(SKY_FIELD.fog, 0.00085);

    this.hemi = new THREE.HemisphereLight(SKY_FIELD.hemiSky, SKY_FIELD.hemiGround, 1.1);
    this.scene.add(this.hemi);
    this.sun = new THREE.DirectionalLight(SKY_FIELD.light, 2.4);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(2048, 2048);
    const sc = this.sun.shadow.camera;
    sc.left = sc.bottom = -80;
    sc.right = sc.top = 80;
    sc.near = 10;
    sc.far = 700;
    this.sun.shadow.bias = -0.0006;
    this.sun.shadow.normalBias = 0.6;
    this.sunDir = new THREE.Vector3(-0.35, 0.28, 1).normalize();
    this.scene.add(this.sun, this.sun.target);

    this.dust = new Particles(this.scene, 4000);
    this.embers = new Particles(this.scene, 2500, { additive: true });

    this.scenery = buildScenery(this.scene, this.terrain);
    const hotelY = this.terrain.heightAt(HOTEL.x, HOTEL.z);
    this.hotel = buildHotel(this.scene, HOTEL.x, hotelY, HOTEL.z);

    this.demon = new Demon(this.scene, DEMON_POS.x, DEMON_POS.z, this.terrain.heightAt(DEMON_POS.x, DEMON_POS.z));
    for (const sx of [-1, 1]) {
      // le gambe del demone sono ostacoli (si può passargli sotto!)
      const lx = DEMON_POS.x + sx * 16;
      this.scenery.colliders.add(lx, DEMON_POS.z, 13);
    }

    this.boulders = new BoulderSystem(this.scene, this.terrain, this.dust, this.embers);
    this.car = new Car(this.scene);

    this.demon.onRelease = (hand) => this.onDemonThrow(hand);
    this.boulders.onImpact = (b) => this.onBoulderImpact(b);
    this.car.onLand = (impact, air) => this.onCarLand(impact, air);

    this.camPos = new THREE.Vector3();
    this.camLook = new THREE.Vector3();
    this.tmpV = new THREE.Vector3();
    this.nearColliders = [];

    this.resetRun();
    this.dust.setScale(renderer, this.camera);
    this.embers.setScale(renderer, this.camera);
  }

  // ---------- Stato della corsa ----------
  resetRun() {
    this.state = 'play';
    this.paused = false;
    this.time = 0;
    this.fieldTime = 0;
    this.health = 1;
    this.dodges = 0;
    this.hits = 0;
    this.shake = 0;
    this.phase = 'field';
    this.maxRoadS = 0;
    this.night = 0;
    this.lostSightTimer = 0;
    this.saidLost = false;
    this.lineTimer = 0;
    this.flags = {};
    this.lastSafe = { x: START.x, z: START.z, h: START.heading };
    this.safeTimer = 0;
    this.demon.cooldown = 4;
    this.demon.state = 'idle';
    this.demon.heldRock.visible = false;

    this.boulders.clear();
    this.dust.clear();
    this.embers.clear();
    // qualche macigno già a terra: il demone lancia da un po'
    const rand = (a, b) => a + Math.random() * (b - a);
    for (let k = 0; k < 16; k++) {
      const x = rand(-600, 600);
      const z = rand(-700, 250);
      if (Math.hypot(x - START.x, z - START.z) < 150) continue;
      if (this.terrain.fieldEllipse(x, z) > 0.85) continue;
      this.boulders.placeResting(x, z, rand(4, 8));
    }

    this.car.reset(START.x, START.z, START.heading, this.terrain);
    this.car.turbo = 1;
    this.snapCamera();

    const { ui, audio } = this.ctx;
    ui.showHud(true);
    ui.configureHud({
      unit: 'km/h',
      turboLabel: 'Turbo <kbd>Shift</kbd>',
      healthLabel: 'Macchina',
      controls: '<kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd> guida · <kbd>Spazio</kbd> freno a mano · <kbd>R</kbd> rimetti in strada · <kbd>P</kbd> pausa',
    });
    ui.center(null);
    ui.objective('Sfuggi al demone. Raggiungi la strada tra le montagne.');
    audio.stopAllPads(1);
    audio.pad('tension', [55, 82.4, 110, 116.5], { vol: 0.07, type: 'sawtooth', cutoff: 420, tremolo: 3.2 });
    audio.engineStart();

    this.script = [
      { at: 0.6, fn: () => ui.subtitle(FRIEND, 'Ma ti rendi conto di quanto stiamo andando veloci?!', 3.2) },
      { at: 3.2, fn: () => { audio.roar(0.9); this.shake = Math.max(this.shake, 0.8); } },
      { at: 3.6, fn: () => ui.subtitle(FRIEND, '...cos\'è QUELLO?!', 2.6) },
      { at: 7.5, fn: () => ui.subtitle(FRIEND, 'Sta lanciando dei macigni! Guarda i cerchi rossi per terra!', 3.5) },
      { at: 15, fn: () => this.phase === 'field' && ui.subtitle(FRIEND, 'Laggiù, quella luce tra le montagne! C\'è una strada!', 3.5) },
      { at: 45, fn: () => this.phase === 'field' && ui.subtitle(FRIEND, 'La strada! Segui la luce, là non ci vede!', 3.2) },
    ];
  }

  snapCamera() {
    const c = this.car;
    this.camPos.set(c.pos.x - c.fwdX * 12, c.pos.y + 5, c.pos.z - c.fwdZ * 12);
    this.camLook.copy(c.pos);
    this.camera.position.copy(this.camPos);
    this.camera.lookAt(this.camLook);
  }

  say(key, prob = 1, cooldown = 3.5) {
    if (this.lineTimer > 0 || Math.random() > prob) return;
    const arr = LINES[key];
    this.ctx.ui.subtitle(FRIEND, arr[Math.floor(Math.random() * arr.length)], 2.4);
    this.lineTimer = cooldown;
  }

  // ---------- Eventi ----------
  onDemonThrow(hand) {
    const c = this.car;
    const rage = clamp(this.fieldTime / 70, 0, 1);
    const volley = this.fieldTime > 20 && Math.random() < 0.2 + rage * 0.35 ? (rage > 0.6 && Math.random() < 0.4 ? 3 : 2) : 1;
    for (let k = 0; k < volley; k++) {
      const dist = Math.hypot(c.pos.x - hand.x, c.pos.z - hand.z);
      const flight = Math.min(3.6, Math.max(2.1, dist / 190));
      // mira dove sarai. Con più macigni: uno anticipa, uno ti aspetta, uno ti chiude di lato
      let lead = 0.85 + Math.random() * 0.2;
      let side = 0;
      if (volley > 1) lead = [1.02, 0.55, 0.85][k];
      if (k === 2) side = (Math.random() < 0.5 ? -1 : 1) * 22;
      const spread = Math.random() * 7;
      const a = Math.random() * Math.PI * 2;
      const sx = c.vz / (c.speed || 1);
      const sz = -c.vx / (c.speed || 1);
      const tx = c.pos.x + c.vx * flight * lead + Math.cos(a) * spread + sx * side;
      const tz = c.pos.z + c.vz * flight * lead + Math.sin(a) * spread + sz * side;
      const target = new THREE.Vector3(tx, this.terrain.heightAt(tx, tz), tz);
      this.boulders.throwAt(hand, target, 4 + Math.random() * 4);
    }
    this.ctx.audio.whoosh(0.35);
    if (!this.flags.firstThrow) {
      this.flags.firstThrow = true;
    }
  }

  onBoulderImpact(b) {
    const c = this.car;
    const d = Math.hypot(c.pos.x - b.pos.x, c.pos.z - b.pos.z);
    const vol = clamp(1 - d / 700, 0.08, 1);
    this.ctx.audio.boom(vol);
    this.shake = Math.max(this.shake, clamp(1.6 - d / 120, 0, 1.6));
    if (this.state !== 'play') return;
    const heightOk = c.pos.y < b.pos.y + b.r;
    if (d < b.r + c.radius + 0.5 && heightOk) {
      this.damage(0.3, 'Colpito!');
      const nx = (c.pos.x - b.pos.x) / (d || 1);
      const nz = (c.pos.z - b.pos.z) / (d || 1);
      c.vx += nx * 14;
      c.vz += nz * 14;
      c.vy = 11;
      c.grounded = false;
      c.pos.x = b.pos.x + nx * (b.r + c.radius + 0.6);
      c.pos.z = b.pos.z + nz * (b.r + c.radius + 0.6);
    } else if (d < b.r + 18) {
      this.dodges++;
      this.ctx.ui.popup('Schivata!');
      this.ctx.audio.chime(880 + Math.min(this.dodges, 12) * 40, 0.12);
      this.say('dodge', 0.55);
    }
  }

  onCarLand(impact, air) {
    this.ctx.audio.thud(clamp(impact / 25, 0.15, 0.8));
    this.shake = Math.max(this.shake, clamp(impact / 40, 0, 0.6));
    if (air > 1.0) this.say('jump', 0.6);
    this.dust.burst(this.car.pos.x, this.car.pos.y + 0.3, this.car.pos.z, 14, 8, { color: [0.45, 0.4, 0.3], size: 2, endSize: 6, life: 1.2, drag: 2, alpha: 0.3 });
  }

  damage(amount, label) {
    if (this.state !== 'play') return;
    this.health = Math.max(0, this.health - amount);
    this.hits++;
    this.ctx.ui.popup(label, true);
    this.shake = Math.max(this.shake, 1.2);
    this.ctx.audio.thud(0.9);
    if (this.health <= 0) this.die();
    else if (this.health < 0.35 && !this.flags.lowHp) {
      this.flags.lowHp = true;
      this.ctx.ui.subtitle(FRIEND, 'Stiamo cadendo a pezzi!!', 2.5);
      this.lineTimer = 3;
    } else this.say('hit', 0.8);
  }

  async die() {
    this.state = 'dead';
    const { ui, audio } = this.ctx;
    audio.boom(1);
    audio.engineStop();
    ui.subtitle(null, 'La macchina va in pezzi… il sogno si incrina.', 3);
    await ui.fade(1, 1200, '#fff');
    await new Promise((r) => setTimeout(r, 800));
    if (this.disposed) return;
    this.resetRun();
    ui.subtitle(null, 'Sei di nuovo nel campo. Come se non fosse successo niente.', 3.5);
    await ui.fade(0, 1400, '#fff');
  }

  resetCarToSafety() {
    const c = this.car;
    const info = this.terrain.roadInfo(c.pos.x, c.pos.z);
    if (info.idx >= 0 && info.dist < 250 && this.phase !== 'field') {
      const r = this.terrain.road[info.idx];
      c.reset(r.x, r.z, Math.atan2(r.tx, r.tz), this.terrain);
    } else {
      c.reset(this.lastSafe.x, this.lastSafe.z, this.lastSafe.h, this.terrain);
    }
    this.ctx.audio.whoosh(0.3);
  }

  // ---------- Ciclo ----------
  update(dt) {
    const { input, ui, audio } = this.ctx;

    if (input.wasPressed('Escape', 'KeyP') && (this.state === 'play' || this.paused)) {
      this.paused = !this.paused;
      ui.center(this.paused ? `<div class="panel pause"><h2>Pausa</h2>
        <p><kbd>Esc</kbd> riprendi</p><p><kbd>R</kbd> ricomincia il sogno</p><p><kbd>N</kbd> audio on/off · <kbd>M</kbd> mappa</p></div>` : null);
      if (this.paused) audio.engineUpdate(0, 0, false);
    }
    if (input.wasPressed('KeyN')) audio.toggleMute();
    if (this.paused) {
      if (input.wasPressed('KeyR')) this.resetRun();
      this.sky.update(this.camera, 0);
      return;
    }

    if (this.state === 'ending') {
      this.updateEnding(dt);
      return;
    }

    const playing = this.state === 'play';
    if (playing) this.time += dt;
    this.lineTimer -= dt;

    // script di dialoghi a tempo
    while (this.script.length && this.script[0].at <= this.time) this.script.shift().fn();

    // --- guida ---
    const ctl = playing
      ? {
          throttle: input.down('KeyW', 'ArrowUp') ? 1 : 0,
          brake: input.down('KeyS', 'ArrowDown') ? 1 : 0,
          steer: (input.down('KeyA', 'ArrowLeft') ? 1 : 0) - (input.down('KeyD', 'ArrowRight') ? 1 : 0),
          turbo: input.down('ShiftLeft', 'ShiftRight'),
          handbrake: input.down('Space'),
        }
      : { throttle: 0, brake: 1, steer: 0, turbo: false, handbrake: false };
    if (playing && input.wasPressed('KeyR')) this.resetCarToSafety();

    const c = this.car;
    const road = this.terrain.roadInfo(c.pos.x, c.pos.z);
    const surface = this.terrain.surfaceAt(c.pos.x, c.pos.z, road.dist);
    c.update(dt, ctl, this.terrain, surface);

    // collisioni con ostacoli fissi
    for (const o of this.scenery.colliders.near(c.pos.x, c.pos.z, this.nearColliders)) {
      if (c.pos.y > this.terrain.heightAt(o.x, o.z) + 9) continue;
      const imp = c.collideCircle(o.x, o.z, o.r);
      if (imp > 8) {
        audio.thud(clamp(imp / 30, 0.2, 0.9));
        this.shake = Math.max(this.shake, clamp(imp / 40, 0.2, 0.8));
        if (imp > 22) this.damage(0.1, 'Bum!');
        else this.say('crash', 0.5);
      }
    }
    c.collideBox(this.hotel.box.minX, this.hotel.box.maxX, this.hotel.box.minZ, this.hotel.box.maxZ);

    // collisioni con i macigni a terra
    for (const b of this.boulders.list) {
      if (b.state === 'fly') {
        // colpo in pieno durante il volo
        if (playing && b.pos.distanceTo(c.pos) < b.r + 1.8) {
          this.boulders.land(b, this.terrain.heightAt(b.pos.x, b.pos.z));
        }
        continue;
      }
      if (c.pos.y > b.pos.y + b.r * 0.7) continue; // saltato sopra!
      const relSpeed = c.speed;
      const imp = c.collideCircle(b.pos.x, b.pos.z, b.r * 0.9, 0.45);
      if (imp > 0) {
        if (b.state !== 'rest') {
          b.vel.x -= c.vx * 0.1;
          b.vel.z -= c.vz * 0.1;
        }
        if (imp > 10) {
          audio.thud(clamp(imp / 30, 0.3, 1));
          this.shake = Math.max(this.shake, 0.7);
          if (playing) this.damage(clamp((imp - 8) * 0.012, 0.04, 0.22), 'Crash!');
        } else if (relSpeed > 4) audio.thud(0.2);
      }
    }
    this.boulders.resolveMutual();

    // posizione "sicura" per il tasto R
    this.safeTimer -= dt;
    if (this.safeTimer <= 0 && c.grounded && (surface === 'grass' || surface === 'road' || surface === 'dirt')) {
      this.safeTimer = 1.5;
      this.lastSafe = { x: c.pos.x, z: c.pos.z, h: c.heading };
    }

    // --- avanzamento sulla strada ---
    if (road.dist < 30) this.maxRoadS = Math.max(this.maxRoadS, road.s);
    const L = this.terrain.roadLength;
    if (playing && this.phase === 'field' && road.dist < 20 && road.s > 200) {
      this.phase = 'road';
      ui.objective('Segui la strada di montagna.');
      ui.subtitle(FRIEND, 'Prendi la strada di montagna, lassù non può vederci!', 3.2);
      this.lineTimer = 4;
    }

    // --- demone: ti vede? ---
    const eye = this.demon.eyePos;
    const canSee =
      playing &&
      this.terrain.lineOfSight(eye.x, eye.y, eye.z, c.pos.x, c.pos.y + 2, c.pos.z, 70) &&
      Math.hypot(c.pos.x - eye.x, c.pos.z - eye.z) < 1500;
    if (canSee && this.phase === 'field') this.fieldTime += dt;
    this.demon.update(dt, c.pos, canSee, clamp(this.fieldTime / 70, 0, 1));
    this.demon.aura.material.opacity = 0.3 * (1 - this.night * 0.6);

    if (this.phase !== 'field') {
      this.lostSightTimer = canSee ? 0 : this.lostSightTimer + dt;
      if (!this.saidLost && this.lostSightTimer > 3) {
        this.saidLost = true;
        ui.subtitle(FRIEND, '...è sparito. Non lo vedo più.', 3);
        this.lineTimer = 6;
        audio.stopPad('tension', 4);
        audio.pad('calm', [174.6, 220, 261.6, 329.6], { vol: 0.045, cutoff: 1600 });
        this.flags.calmAt = this.time;
      }
      if (this.flags.calmAt && !this.flags.wonder && this.time - this.flags.calmAt > 9) {
        this.flags.wonder = true;
        ui.subtitle(FRIEND, 'Chissà dove porta questa strada...', 3);
      }
      if (!this.flags.dark && this.maxRoadS > L * 0.55) {
        this.flags.dark = true;
        ui.subtitle(FRIEND, 'Si sta facendo buio. Dovremmo trovare un posto per dormire.', 3.5);
      }
      if (!this.flags.hotelSeen && Math.hypot(c.pos.x - HOTEL.x, c.pos.z - HOTEL.z) < 380) {
        this.flags.hotelSeen = true;
        ui.objective('Raggiungi l\'hotel e fermati davanti all\'ingresso.');
        ui.subtitle(FRIEND, 'Guarda là! Un hotel... enorme. Tutto di legno.', 3.5);
      }
    }

    // --- arrivo ---
    const ad = Math.hypot(c.pos.x - this.hotel.arrival.x, c.pos.z - this.hotel.arrival.z);
    if (playing && ad < this.hotel.arrivalRadius) {
      if (c.speed < 7) this.startEnding();
      else if (!this.flags.slowHint) {
        this.flags.slowHint = true;
        ui.subtitle(FRIEND, 'Frena, frena! Siamo arrivati!', 2);
      }
    }

    // --- mondo che cambia: dal tramonto rosso alla notte ---
    const targetNight = smoothstep(120, L * 0.8, this.maxRoadS);
    this.night += (targetNight - this.night) * (1 - Math.exp(-0.8 * dt));
    this.applyAtmosphere(this.night);

    this.boulders.update(dt);
    this.dust.update(dt);
    this.embers.update(dt);
    this.scenery.update(this.time, this.night, this.maxRoadS);
    this.hotel.update(this.time);

    // fumo dai comignoli
    if (Math.random() < 0.4) {
      for (const ch of this.hotel.chimneys) {
        this.dust.emit(ch.x, ch.y, ch.z, 1 + Math.random(), 3, Math.random() - 0.5, { color: [0.35, 0.36, 0.42], size: 6, endSize: 22, life: 6, alpha: 0.35, drag: 0.2 });
      }
    }

    // amico: guarda il demone nel campo, poi te
    const fh = c.friend.head;
    const toDemon = Math.atan2(DEMON_POS.x - c.pos.x, DEMON_POS.z - c.pos.z) - c.heading;
    const look = this.phase === 'field' ? clamp(Math.atan2(Math.sin(toDemon), Math.cos(toDemon)), -1.4, 1.4) : 0.5 * Math.sin(this.time * 0.3);
    fh.rotation.y += (look - fh.rotation.y) * (1 - Math.exp(-3 * dt));

    this.updateCamera(dt);
    this.sky.update(this.camera, dt);

    // --- audio e HUD ---
    audio.engineUpdate(clamp(Math.abs(c.forwardSpeed) / 80, 0, 1), ctl.throttle, c.turboActive);
    if (c.turboActive && Math.random() < 0.6) {
      const bx = c.pos.x - c.fwdX * 2.6;
      const bz = c.pos.z - c.fwdZ * 2.6;
      this.embers.emit(bx, c.pos.y + 0.6, bz, -c.fwdX * 8, 1, -c.fwdZ * 8, { color: [0.4, 0.7, 1], size: 0.9, endSize: 0.1, life: 0.35 });
    }
    if ((c.drifting || (c.speed > 25 && surface !== 'road')) && c.grounded && Math.random() < 0.5) {
      this.dust.emit(c.pos.x - c.fwdX * 2, c.pos.y + 0.4, c.pos.z - c.fwdZ * 2, (Math.random() - 0.5) * 3, 2, (Math.random() - 0.5) * 3, { color: [0.5, 0.45, 0.35], size: 2, endSize: 7, life: 1.2, alpha: c.drifting ? 0.5 : 0.25, drag: 1 });
    }

    ui.updateHud({ speed: c.speed * 3.6, turbo: c.turbo, health: this.health, time: this.time, counter: `Schivate ${this.dodges}` });
    this.updateCompass(road);
  }

  updateCompass(road) {
    const c = this.car;
    let target = null;
    if (this.phase === 'field') target = this.scenery.entrance;
    else if (road.dist > 45) {
      target = road.idx >= 0 ? this.terrain.road[road.idx] : this.scenery.entrance;
    } else if (this.flags.hotelSeen && this.car.pos.distanceTo(this.hotel.arrival) > 40) {
      target = this.hotel.arrival;
    }
    if (!target) {
      this.ctx.ui.compass(null);
      return;
    }
    // direzione relativa alla camera (a schermo)
    const camYaw = Math.atan2(this.camLook.x - this.camera.position.x, this.camLook.z - this.camera.position.z);
    const toT = Math.atan2(target.x - c.pos.x, target.z - c.pos.z);
    this.ctx.ui.compass(-(toT - camYaw));
  }

  applyAtmosphere(k) {
    const u = this.sky.uniforms;
    const mix = (a, b) => new THREE.Color(a).lerp(new THREE.Color(b), k);
    u.top.value.copy(mix(SKY_FIELD.top, SKY_NIGHT.top));
    u.horizon.value.copy(mix(SKY_FIELD.horizon, SKY_NIGHT.horizon));
    u.bottom.value.copy(mix(SKY_FIELD.bottom, SKY_NIGHT.bottom));
    u.sunColor.value.copy(mix(SKY_FIELD.sun, SKY_NIGHT.sun)).multiplyScalar(1 - k * 0.6);
    u.stars.value = smoothstep(0.35, 1, k);
    this.scene.fog.color.copy(mix(SKY_FIELD.fog, SKY_NIGHT.fog));
    this.scene.fog.density = lerp(0.00085, 0.0011, k);
    this.hemi.color.copy(mix(SKY_FIELD.hemiSky, SKY_NIGHT.hemiSky));
    this.hemi.groundColor.copy(mix(SKY_FIELD.hemiGround, SKY_NIGHT.hemiGround));
    this.hemi.intensity = lerp(1.1, 0.55, k);
    this.sun.color.copy(mix(SKY_FIELD.light, SKY_NIGHT.light));
    this.sun.intensity = lerp(2.4, 0.5, k);
    // il sole tramonta e sorge la luna dall'altra parte
    const d = this.tmpV.copy(this.sunDir);
    d.x = lerp(this.sunDir.x, 0.5, k);
    d.y = lerp(this.sunDir.y, 0.45, k);
    d.normalize();
    u.sunDir.value.copy(d);
    this.car.headlight.intensity = smoothstep(0.25, 0.8, k) * 900;
    const c = this.car.pos;
    this.sun.position.set(c.x + d.x * 300, c.y + d.y * 300, c.z + d.z * 300);
    this.sun.target.position.copy(c);
  }

  updateCamera(dt) {
    const c = this.car;
    const sp = c.speed;
    const back = 10.5 + sp * 0.05;
    const height = 3.8 + sp * 0.012;
    const tx = c.pos.x - c.fwdX * back;
    const tz = c.pos.z - c.fwdZ * back;
    let ty = c.pos.y + height;
    ty = Math.max(ty, this.terrain.heightAt(tx, tz) + 2);
    const k = 1 - Math.exp(-5 * dt);
    this.camPos.x += (tx - this.camPos.x) * k;
    this.camPos.z += (tz - this.camPos.z) * k;
    this.camPos.y += (ty - this.camPos.y) * (1 - Math.exp(-3.5 * dt));
    this.camPos.y = Math.max(this.camPos.y, this.terrain.heightAt(this.camPos.x, this.camPos.z) + 1.5);
    const lx = c.pos.x + c.fwdX * 6;
    const lz = c.pos.z + c.fwdZ * 6;
    this.camLook.x += (lx - this.camLook.x) * (1 - Math.exp(-10 * dt));
    this.camLook.z += (lz - this.camLook.z) * (1 - Math.exp(-10 * dt));
    this.camLook.y += (c.pos.y + 1.8 - this.camLook.y) * (1 - Math.exp(-8 * dt));

    this.shake *= Math.exp(-3.2 * dt);
    const s = this.shake;
    this.camera.position.set(
      this.camPos.x + (Math.random() - 0.5) * s,
      this.camPos.y + (Math.random() - 0.5) * s,
      this.camPos.z + (Math.random() - 0.5) * s,
    );
    this.camera.lookAt(this.camLook);
    const targetFov = 66 + clamp(sp / 80, 0, 1) * 22 + (c.turboActive ? 6 : 0);
    this.camera.fov += (targetFov - this.camera.fov) * (1 - Math.exp(-3 * dt));
    this.camera.updateProjectionMatrix();
  }

  // ---------- Finale ----------
  startEnding() {
    this.state = 'ending';
    this.endT = 0;
    const { ui, audio } = this.ctx;
    ui.subtitle(FRIEND, 'Dai... passiamo qui la notte.', 3.5);
    ui.objective('');
    ui.compass(null);
    audio.engineStop();
    audio.stopAllPads(3);
    audio.pad('home', [130.8, 196, 261.6, 329.6, 392], { vol: 0.05, cutoff: 2000 });
    this.endStart = this.camera.position.clone();
  }

  updateEnding(dt) {
    const { ui } = this.ctx;
    this.endT += dt;
    const c = this.car;
    // la macchina si ferma dolcemente
    c.update(dt, { throttle: 0, brake: 1, steer: 0, turbo: false, handbrake: false }, this.terrain, 'road');
    // la camera sale lentamente e guarda l'hotel
    const k = smoothstep(0, 8, this.endT);
    const hx = HOTEL.x;
    const hz = HOTEL.z;
    const hy = this.hotel.group.position.y;
    const a = this.hotel.arrival;
    const target = new THREE.Vector3(a.x + 30 + Math.sin(this.endT * 0.1) * 6, hy + 16 + k * 8, a.z - 42);
    this.camera.position.lerpVectors(this.endStart, target, k);
    const look = new THREE.Vector3(hx, hy + 28, hz - 30);
    this.camLook.lerp(look, 1 - Math.exp(-1.5 * dt));
    this.camera.lookAt(this.camLook);
    this.sky.update(this.camera, dt);
    this.hotel.update(this.time + this.endT);
    this.dust.update(dt);
    this.embers.update(dt);
    if (Math.random() < 0.4) {
      for (const ch of this.hotel.chimneys) {
        this.dust.emit(ch.x, ch.y, ch.z, 1 + Math.random(), 3, Math.random() - 0.5, { color: [0.35, 0.36, 0.42], size: 6, endSize: 22, life: 6, alpha: 0.35, drag: 0.2 });
      }
    }

    if (this.endT > 3.5 && !this.flags.endText1) {
      this.flags.endText1 = true;
      ui.subtitle(null, 'Il portone è aperto. Dentro, una luce calda. Il legno scricchiola.', 4);
    }
    // si entra nell'hotel: il sogno continua, senza interruzioni
    if (this.endT > 7.5 && !this.flags.nextChapter) {
      this.flags.nextChapter = true;
      this.ctx.nextChapter({ campo: { time: this.time, dodges: this.dodges, hits: this.hits } });
    }
  }

  onResize() {
    this.dust.setScale(this.ctx.renderer, this.camera);
    this.embers.setScale(this.ctx.renderer, this.camera);
  }

  dispose() {
    this.disposed = true;
    const { ui, audio } = this.ctx;
    audio.engineStop();
    audio.stopAllPads(1);
    ui.showHud(false);
    ui.center(null);
    ui.clearSubtitle();
    ui.objective('');
    this.boulders.dispose();
    this.car.dispose();
    this.demon.dispose();
    this.hotel.dispose();
    this.scenery.dispose();
    this.terrain.dispose();
    this.dust.dispose();
    this.embers.dispose();
    this.sky.mesh.geometry.dispose();
    this.sky.mesh.material.dispose();
  }
}
