import * as THREE from 'three';
import { Particles } from '../../core/particles.js';
import { clamp, lerp, mulberry32 } from '../../core/noise.js';
import { buildLayout, roomAt, FlowField, CELL, COLS, ROWS, X0, Z0, NW, NH, ENTRANCE_W } from './layout.js';
import { RoomBuilder, STYLES, LOBBY_STYLE, SUITE_STYLE } from './rooms.js';
import { Character } from './character.js';
import { GnomeSwarm } from './gnomes.js';

const FRIEND = 'Il tuo amico:';

// Cosa dice l'amico entrando per la prima volta in certe stanze.
const ROOM_LINES = {
  giapponese: 'Tatami... dentro un hotel di montagna?',
  barocco: 'Sembra la reggia di qualcuno.',
  biblioteca: 'Quanti libri. Non finisce più, questa stanza.',
  disco: 'C\'è musica? Io non sento niente...',
  acquario: 'Un acquario. Dentro un hotel. Certo.',
  serra: 'Fa caldo qui. Umido.',
  ghiaccio: 'Brrr. Ma come fa a non sciogliersi?',
  egizio: 'Non toccare niente, eh.',
  spaziale: 'Guarda dalla finestra... sono stelle quelle?',
  gotico: 'Parla piano.',
  cameretta: 'Ci siamo rimpiccioliti noi, o è tutto gigante?',
  piscina: 'Una piscina vuota di gente. Mette i brividi.',
  rossa: 'Questa stanza non mi piace.',
  pastello: 'Carina. Sembra un sogno di qualcun altro.',
  industriale: 'Caldaie. Almeno qui è caldo.',
  specchi: 'Quale sei tu? Non ti trovo.',
};

const MILESTONES = [
  [100, 'Cento!'],
  [300, 'Non finiscono mai!'],
  [1000, 'Mille gnomi... mille!'],
  [2500, 'Ma quanti sono?!'],
  [5000, 'Cinquemila. Nessuno ci crederà.'],
];

export class HotelDream {
  constructor(ctx) {
    this.ctx = ctx;
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.05, 400);
    this.time = 0;
    this.tmp = new THREE.Vector3();

    this.layout = buildLayout(1313);
    this.rb = new RoomBuilder(this.scene, this.layout);
    this.assignRooms();
    this.buildRooms();

    this.bgNight = new THREE.Color('#0d0906');
    this.scene.background = this.bgNight.clone();
    this.scene.fog = new THREE.FogExp2('#1a120a', 0.022);
    this.hemi = new THREE.HemisphereLight('#ffd9a0', '#3a2a1c', 1.1);
    this.scene.add(this.hemi);
    this.scene.add(new THREE.AmbientLight('#ffffff', 0.25));
    this.lantern = new THREE.PointLight('#ffd6a0', 18, 16, 1.6);
    this.scene.add(this.lantern);

    this.fx = new Particles(this.scene, 2500);
    this.glints = new Particles(this.scene, 1500, { additive: true });
    this.fx.setScale(ctx.renderer, this.camera);
    this.glints.setScale(ctx.renderer, this.camera);

    this.player = new Character(this.scene, { skin: '#e0b089', hair: '#3b2a1e', shirt: '#2f4f8f' });
    this.friend = new Character(this.scene, { skin: '#c99470', hair: '#141414', shirt: '#d9a82e' });
    this.friend.radius = 0.4;

    this.swarm = new GnomeSwarm(this.scene, this.layout.blocked, 2600);
    this.flowP = new FlowField(this.layout.blocked);
    this.flowF = new FlowField(this.layout.blocked);
    this.flowGoal = new FlowField(this.layout.blocked);
    this.flowTimer = 0;

    this.camYaw = 0;
    this.camPitch = 0.25;
    this.camPos = new THREE.Vector3();

    this.onCanvasClick = () => ctx.input.lock();
    ctx.renderer.domElement.addEventListener('click', this.onCanvasClick);

    this.startNight();
  }

  // ---------- Costruzione ----------
  assignRooms() {
    const L = this.layout;
    const rand = mulberry32(77);
    const pool = [];
    let bag = [];
    const numbers = {};
    const used = new Set(['1313']);
    for (const room of L.rooms) {
      if (room.lobby) room.styleDef = LOBBY_STYLE;
      else if (room.suite) room.styleDef = SUITE_STYLE;
      else {
        if (!bag.length) {
          bag = [...STYLES];
          for (let i = bag.length - 1; i > 0; i--) {
            const j = Math.floor(rand() * (i + 1));
            [bag[i], bag[j]] = [bag[j], bag[i]];
          }
        }
        room.styleDef = bag.pop();
      }
      if (room.suite) numbers[room.id] = '1313';
      else if (!room.lobby) {
        let n;
        do n = String(100 + Math.floor(rand() * 2800));
        while (used.has(n));
        used.add(n);
        numbers[room.id] = n;
      }
      pool.push(room);
    }
    this.numbers = numbers;
  }

  buildRooms() {
    const L = this.layout;
    const rb = this.rb;
    for (const room of L.rooms) {
      const api = rb.build(room, room.styleDef);
      if (room.lobby) this.buildLobby(api);
      if (room.suite) this.buildSuite(api);
    }
    rb.numberPlates(this.numbers);
    rb.mergeStatic();

    // secchi di collisione per cella: il giocatore controlla solo quelli vicini
    this.buckets = new Map();
    for (const b of rb.colliders) {
      const c0 = Math.floor((b.minX - X0) / CELL);
      const c1 = Math.floor((b.maxX - X0 - 1e-6) / CELL);
      const r0 = Math.floor((b.minZ - Z0) / CELL);
      const r1 = Math.floor((b.maxZ - Z0 - 1e-6) / CELL);
      for (let r = r0; r <= r1; r++)
        for (let c = c0; c <= c1; c++) {
          const k = r * COLS + c;
          if (!this.buckets.has(k)) this.buckets.set(k, []);
          this.buckets.get(k).push(b);
        }
    }
    this.nearBoxes = [];
  }

  buildLobby(a) {
    const wood = a.mat('#5a3420');
    const gold = a.mat('#c9a040', { metal: true });
    // tappeto rosso dal portone alla reception
    a.box(5, 0.04, 22, a.mat('#8a1a22'), 0, 0.02, -a.room.cz + 12, { collide: false });
    // colonne
    for (const sx of [-1, 1]) for (const z of [-10, 0, 10]) a.cyl(0.9, 1.1, a.h, a.mat('#6a4a36'), sx * 11, a.h / 2, z);
    // reception gigante con il campanello
    const deskZ = 8;
    a.box(14, 1.3, 2.2, wood, 0, 0.65, deskZ);
    a.box(14.4, 0.12, 2.6, a.mat('#2a1a10'), 0, 1.36, deskZ, { collide: false });
    this.bell = new THREE.Group();
    const bellMesh = new THREE.Mesh(new THREE.SphereGeometry(0.16, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2), gold);
    const bellBase = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.03, 16), gold);
    this.bell.add(bellMesh, bellBase);
    this.bell.position.set(a.cx, 1.43, a.cz + deskZ - 0.9);
    a.track(bellMesh.geometry);
    a.track(bellBase.geometry);
    this.rb.dynamic.add(this.bell);
    this.bellGlow = a.glowSprite('#ffe28a', 0, 1.6, deskZ - 0.9, 1.4, 0.8);
    this.bellPos = new THREE.Vector3(a.cx, 0, a.cz + deskZ - 2);
    // parete delle chiavi: centinaia di chiavi dorate
    const keysTex = a.track(keyWallTexture());
    const keysMat = a.track(new THREE.MeshStandardMaterial({ map: keysTex, emissive: '#ffffff', emissiveMap: keysTex, emissiveIntensity: 0.6 }));
    a.box(18, 14, 0.4, keysMat, 0, 8, a.hw - 0.1, { collide: false });
    // gallerie: piani e piani di porte illuminate, fino al buio
    const doorMat = a.glowMat('#ffc070', 0.9);
    const doorDark = a.mat('#2a1a12');
    const rail = a.mat('#3a2616');
    for (const y of [9, 15.5, 22, 28.5]) {
      for (const side of ['W', 'E', 'N']) {
        const along = side === 'N' ? 'x' : 'z';
        const fixed = side === 'W' ? -a.hw : side === 'E' ? a.hw : a.hw;
        const len = a.hw * 2;
        // balconata
        if (along === 'z') {
          a.box(2.4, 0.4, len, rail, fixed + (side === 'W' ? 1.2 : -1.2), y, 0, { collide: false });
          a.box(0.12, 1, len, rail, fixed + (side === 'W' ? 2.35 : -2.35), y + 0.7, 0, { collide: false });
        } else {
          a.box(len, 0.4, 2.4, rail, 0, y, fixed - 1.2, { collide: false });
          a.box(len, 1, 0.12, rail, 0, y + 0.7, fixed - 2.35, { collide: false });
        }
        for (let k = -5; k <= 5; k++) {
          const t = k * 3;
          if (side === 'N' && Math.abs(t) < 10 && y < 16) continue; // dietro la parete delle chiavi
          const m = Math.random() < 0.7 ? doorMat : doorDark;
          if (along === 'z') a.box(0.1, 2.6, 1.5, m, fixed + (side === 'W' ? 0.05 : -0.05), y + 1.5, t, { collide: false });
          else a.box(1.5, 2.6, 0.1, m, t, y + 1.5, fixed - 0.05, { collide: false });
        }
      }
    }
    // lampadari enormi
    for (const z of [-8, 6]) a.chandelier(0, 20, z, '#ffd89a', 3);
    // scala impossibile: sale e finisce nel muro
    for (let s = 0; s < 14; s++) a.box(4, 0.6, 1.2, wood, -a.hw + 3, 0.3 + s * 0.65, -6 + s * 1.2, { collide: s < 2 });
    // divani e piante
    for (const sx of [-1, 1]) {
      a.box(4, 0.9, 1.4, a.mat('#6a1a2a'), sx * 6, 0.45, -8);
      a.cyl(0.5, 0.4, 0.9, a.mat('#6a4a36'), sx * 15, 0.45, -15);
      a.sphere(1.1, a.mat('#2f5a2a'), sx * 15, 1.7, -15, { collide: false });
    }
    // portone: battenti aperti e la luce di fuori
    const doorLeaf = a.mat('#4a2c18');
    for (const sx of [-1, 1]) a.box(0.4, 11.5, 4, doorLeaf, sx * (ENTRANCE_W / 2 + 0.3), 5.75, -a.room.cz + 2.2, { collide: false, rotY: 0 });
    this.outsideMat = a.track(new THREE.MeshBasicMaterial({ color: '#141c38' }));
    const outside = new THREE.Mesh(a.track(new THREE.PlaneGeometry(ENTRANCE_W + 2, 13)), this.outsideMat);
    outside.position.set(0, 6, -0.4);
    this.rb.dynamic.add(outside);
    this.exitGlow = a.glowSprite('#fff2d0', 0, 5, -a.room.cz + 0.5, 16, 0);
  }

  buildSuite(a) {
    const wood = a.mat('#6a4028');
    const sheet = a.mat('#f0ece0');
    this.beds = [];
    for (const sx of [-1, 1]) {
      const x = sx * 3.2;
      const z = a.hw - 2.2;
      a.box(2.2, 0.5, 3.4, wood, x, 0.25, z);
      a.box(2.1, 0.3, 3.2, sheet, x, 0.62, z, { collide: false });
      a.box(2.15, 0.12, 2.1, a.mat(sx < 0 ? '#2f4f8f' : '#b8862a'), x, 0.8, z - 0.5, { collide: false });
      a.box(1.2, 0.25, 0.6, sheet, x, 0.85, z + 1.2, { collide: false });
      a.box(2.2, 1.4, 0.15, wood, x, 0.9, z + 1.7, { collide: false });
      this.beds.push(new THREE.Vector3(a.cx + x, 0, a.cz + z - 2.3));
    }
    a.box(0.8, 0.8, 0.8, wood, 0, 0.4, a.hw - 0.8);
    a.lamp(0, 1.15, a.hw - 0.8, '#ffd08a', 0.22);
    a.box(4.5, 0.03, 3, a.mat('#8a2a2a'), 0, 0.02, 0, { collide: false });
    a.box(2, 3.2, 0.9, wood, -a.hw + 0.8, 1.6, -3);
    // finestra: di notte blu scuro, al mattino luce piena
    this.windowMat = a.track(new THREE.MeshBasicMaterial({ color: '#16204a' }));
    const win = new THREE.Mesh(a.track(new THREE.PlaneGeometry(3, 2)), this.windowMat);
    win.position.set(a.cx + 6.8, 2.4, a.cz + a.hw + 0.02);
    win.rotation.y = Math.PI;
    this.rb.dynamic.add(win);
    this.suite = a.room;
  }

  // ---------- Fasi ----------
  startNight() {
    const { ui, audio } = this.ctx;
    this.phase = 'night';
    this.hasKey = false;
    this.visited = new Set([0]);
    this.gnomesOut = 0;
    this.health = 1;
    this.stamina = 1;
    this.flags = {};
    this.lineTimer = 0;
    this.kickCd = 0;
    this.player.pos.set(0, 0, 4);
    this.player.facing = 0;
    this.friend.pos.set(1.6, 0, 3.4);
    this.camYaw = 0;
    this.flowGoal.compute(this.bellPos.x, this.bellPos.z);
    this.snapCamera();
    this.setDay(0);

    ui.showHud(true);
    ui.configureHud({
      unit: 'stanze scoperte',
      turboLabel: 'Fiato <kbd>Shift</kbd>',
      healthLabel: 'Energia',
      controls: 'Clicca per usare il mouse · <kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd> cammina · <kbd>Spazio</kbd> salta · <kbd>E</kbd> interagisci · <kbd>P</kbd> pausa',
    });
    ui.objective('Suona il campanello della reception.');
    audio.stopAllPads(1);
    audio.pad('hotel', [98, 146.8, 196, 246.9], { vol: 0.045, cutoff: 1100 });
    this.script = [
      { at: 1.2, fn: () => ui.subtitle(FRIEND, 'È... più grande dentro che fuori.', 3) },
      { at: 5, fn: () => ui.subtitle(FRIEND, 'Chiediamo una stanza. C\'è un campanello, laggiù.', 3.2) },
    ];
  }

  ringBell() {
    const { ui, audio } = this.ctx;
    this.hasKey = true;
    audio.chime(1320, 0.25);
    setTimeout(() => audio.chime(1760, 0.15), 250);
    ui.subtitle('Una voce lontana:', 'Stanza 1313. Buonanotte.', 3);
    ui.popup('Chiave 1313');
    ui.objective('Trova la stanza 1313.');
    this.flowGoal.compute(this.suite.cx, this.suite.cz);
    this.script.push({ at: this.time + 3.4, fn: () => ui.subtitle(FRIEND, '1313... dev\'essere in fondo. Di qua, credo.', 3) });
    this.bellGlow.material.opacity = 0;
  }

  async sleep() {
    const { ui, audio } = this.ctx;
    this.phase = 'sleeping';
    ui.hint(null);
    ui.objective('');
    audio.stopAllPads(3);
    await ui.fade(1, 2200, '#05040a');
    if (this.disposed) return;
    ui.subtitle(null, 'La notte passa. Il legno scricchiola. Qualcosa, da qualche parte, ridacchia.', 4);
    await new Promise((r) => setTimeout(r, 4200));
    if (this.disposed) return;
    ui.center('<div class="dream-title"><h2>Il mattino dopo</h2></div>');
    await new Promise((r) => setTimeout(r, 2000));
    if (this.disposed) return;
    ui.center(null);
    this.startDay();
    await ui.fade(0, 1800, '#fff4e0');
  }

  startDay() {
    const { ui, audio } = this.ctx;
    this.phase = 'day';
    this.dayT = 0;
    this.health = 1;
    this.spawnAcc = 0;
    this.flags.friendStuck = false;
    this.swarm.clear();
    const bed = this.beds[0];
    this.player.pos.set(bed.x, 0, bed.z);
    this.player.vel.set(0, 0, 0);
    this.player.facing = Math.PI;
    this.friend.pos.set(this.beds[1].x, 0, this.beds[1].z);
    this.camYaw = Math.PI;
    this.snapCamera();
    this.setDay(1);
    this.flowGoal.compute(0, 1.5);
    ui.configureHud({
      unit: 'gnomi addosso',
      turboLabel: 'Fiato <kbd>Shift</kbd>',
      healthLabel: 'Energia',
      controls: '<kbd>F</kbd> / clic calcio · <kbd>Spazio</kbd> salta e schiaccia · <kbd>Shift</kbd> corri · <kbd>P</kbd> pausa',
    });
    ui.objective('');
    audio.pad('morning', [130.8, 164.8, 196, 246.9], { vol: 0.035, cutoff: 1500 });
    const t0 = this.time;
    this.script = [
      { at: t0 + 1.5, fn: () => ui.subtitle(FRIEND, 'Hai dormito? Io ho sentito dei rumori tutta la notte...', 3.2) },
      { at: t0 + 5.5, fn: () => this.firstGnomes() },
      { at: t0 + 7.5, fn: () => ui.subtitle(FRIEND, '...cosa sono quelli?', 2.2) },
      { at: t0 + 10, fn: () => ui.subtitle(FRIEND, 'GNOMI?! Sono migliaia! Scappiamo, torniamo al portone!', 3.2) },
      {
        at: t0 + 10.5,
        fn: () => {
          this.flags.swarmOn = true;
          ui.objective('Scappa dall\'hotel: torna al portone d\'ingresso.');
          audio.stopPad('morning', 2);
          audio.pad('swarm', [110, 116.5, 164.8, 174.6], { vol: 0.05, type: 'sawtooth', cutoff: 700, tremolo: 6 });
          this.baseHint = '<kbd>F</kbd> o clic: calcio · <kbd>Spazio</kbd>: salta e ricadi per spazzarli via';
          setTimeout(() => (this.baseHint = null), 8000);
        },
      },
    ];
  }

  firstGnomes() {
    // i primi escono da sotto i letti
    for (let k = 0; k < 14; k++) {
      const b = this.beds[k % 2];
      this.swarm.spawn(b.x + (Math.random() - 0.5) * 2, b.z + 1.5 + Math.random());
    }
    this.ctx.audio.squeak(0.15);
  }

  async overwhelmed() {
    const { ui, audio } = this.ctx;
    this.phase = 'down';
    audio.boom(0.4);
    ui.subtitle(null, 'Sono troppi. Ti sommergono, ridacchiando.', 3);
    await ui.fade(1, 1400, '#fff');
    if (this.disposed) return;
    ui.subtitle(null, 'Ti risvegli nel letto. Di nuovo il mattino.', 3);
    this.startDay();
    // si riparte subito con lo sciame
    this.script = [{ at: this.time + 1, fn: () => this.firstGnomes() }];
    this.flags.swarmOn = true;
    ui.objective('Scappa dall\'hotel: torna al portone d\'ingresso.');
    audio.stopAllPads(1);
    audio.pad('swarm', [110, 116.5, 164.8, 174.6], { vol: 0.05, type: 'sawtooth', cutoff: 700, tremolo: 6 });
    await ui.fade(0, 1400, '#fff');
  }

  finish() {
    const { ui, audio } = this.ctx;
    this.phase = 'done';
    ui.subtitle(FRIEND, 'Fuori! Siamo fuori!', 2.5);
    ui.objective('');
    ui.compass(null);
    audio.stopAllPads(2);
    audio.chime(660, 0.2);
    setTimeout(() => {
      if (!this.disposed) this.ctx.endNight({ hotel: { time: this.time, rooms: this.visited.size, gnomes: this.gnomesOut } });
    }, 1800);
  }

  setDay(k) {
    this.day = k;
    const night = new THREE.Color('#ffd9a0');
    const day = new THREE.Color('#fff6e8');
    this.hemi.color.copy(night).lerp(day, k);
    this.hemi.intensity = lerp(1.1, 1.7, k);
    this.outsideMat.color.set(k ? '#fff6e0' : '#141c38');
    this.exitGlow.material.opacity = k ? 0.9 : 0.15;
    this.windowMat.color.set(k ? '#fff2c8' : '#16204a');
    this.lantern.intensity = k ? 8 : 18;
  }

  // ---------- Ciclo ----------
  update(dt) {
    const { input, ui, audio } = this.ctx;
    if (input.wasPressed('KeyP', 'Escape') && this.phase !== 'sleeping') {
      this.paused = !this.paused;
      ui.center(this.paused ? '<div class="panel pause"><h2>Pausa</h2><p><kbd>P</kbd> riprendi</p><p><kbd>M</kbd> audio on/off</p></div>' : null);
    }
    if (input.wasPressed('KeyM')) audio.toggleMute();
    if (this.paused) return;

    this.time += dt;
    this.lineTimer -= dt;
    while (this.script.length && this.script[0].at <= this.time) this.script.shift().fn();

    const active = this.phase === 'night' || this.phase === 'day';
    this.updatePlayer(dt, active);
    this.updateFriend(dt);
    if (this.phase === 'day' || this.phase === 'down') this.updateSwarm(dt);
    this.updateRoomAtmosphere(dt);
    this.updateCamera(dt);
    this.rb.update(this.time, dt);
    this.updateAmbientParticles(dt);
    this.fx.update(dt);
    this.glints.update(dt);
    this.lantern.position.set(this.player.pos.x, 3, this.player.pos.z);
    if (this.bellGlow && !this.hasKey) this.bellGlow.material.opacity = 0.5 + Math.sin(this.time * 4) * 0.3;

    // interazioni
    let hint = null;
    if (this.phase === 'night') {
      if (!this.hasKey && this.player.pos.distanceTo(this.bellPos) < 2.6) {
        hint = '<kbd>E</kbd> suona il campanello';
        if (input.wasPressed('KeyE')) this.ringBell();
      }
      if (this.hasKey && this.beds.some((b) => this.player.pos.distanceTo(b) < 2.2)) {
        hint = '<kbd>E</kbd> dormi';
        if (input.wasPressed('KeyE')) this.sleep();
      }
      const room = roomAt(this.layout, this.player.pos.x, this.player.pos.z);
      if (this.hasKey && room === this.suite.id && !this.flags.suiteFound) {
        this.flags.suiteFound = true;
        ui.subtitle(FRIEND, 'Eccola, la 1313! Finalmente un letto.', 3);
        ui.objective('Vai a dormire.');
      }
    }
    if (this.phase === 'night' || this.phase === 'day') ui.hint(hint || this.baseHint);

    if (this.phase === 'day' && this.player.pos.z < 1.5 && Math.abs(this.player.pos.x) < ENTRANCE_W / 2) this.finish();
    if (this.phase === 'day' && !this.flags.exitNear && this.player.pos.z < 30 && Math.abs(this.player.pos.x) < 18) {
      this.flags.exitNear = true;
      ui.subtitle(FRIEND, 'Il portone! Corri!', 2.2);
    }

    ui.updateHud({
      speed: this.phase === 'night' ? this.visited.size : this.swarm.clinging[0],
      turbo: this.stamina,
      health: this.health,
      time: this.time,
      counter: this.phase === 'night' ? (this.hasKey ? 'Chiave 1313' : '') : `Gnomi respinti ${this.gnomesOut.toLocaleString('it-IT')}`,
    });
    this.updateCompass();
  }

  updatePlayer(dt, active) {
    const { input, audio } = this.ctx;
    const p = this.player;
    if (input.locked) {
      this.camYaw -= input.mouseDX * 0.0025;
      this.camPitch = clamp(this.camPitch + input.mouseDY * 0.002, -0.2, 1.1);
    }
    if (input.down('ArrowLeft')) this.camYaw += dt * 2.2;
    if (input.down('ArrowRight')) this.camYaw -= dt * 2.2;

    let mx = 0;
    let mz = 0;
    if (active) {
      const f = (input.down('KeyW', 'ArrowUp') ? 1 : 0) - (input.down('KeyS', 'ArrowDown') ? 1 : 0);
      const s = (input.down('KeyA') ? 1 : 0) - (input.down('KeyD') ? 1 : 0);
      const fx = Math.sin(this.camYaw);
      const fz = Math.cos(this.camYaw);
      mx = fx * f + fz * s;
      mz = fz * f - fx * s;
      const l = Math.hypot(mx, mz);
      if (l > 0) {
        mx /= l;
        mz /= l;
      }
    }
    const cling = this.swarm.clinging[0];
    const burden = Math.max(0.25, 1 - cling * 0.011);
    const sprint = active && input.down('ShiftLeft', 'ShiftRight') && this.stamina > 0.05 && (mx || mz);
    if (sprint) this.stamina = Math.max(0, this.stamina - dt * 0.3);
    else this.stamina = Math.min(1, this.stamina + dt * 0.18);
    const speed = (sprint ? 9 : 5.5) * burden;
    const k = 1 - Math.exp(-12 * dt);
    p.vel.x += (mx * speed - p.vel.x) * k;
    p.vel.z += (mz * speed - p.vel.z) * k;
    if (mx || mz) {
      const want = Math.atan2(mx, mz);
      let d = want - p.facing;
      d = Math.atan2(Math.sin(d), Math.cos(d));
      p.facing += d * (1 - Math.exp(-14 * dt));
    }

    // salto: ricadendo si spazzano via gli gnomi intorno
    if (active && input.wasPressed('Space') && p.grounded) {
      p.vel.y = 7.2 * Math.max(0.45, 1 - cling / 140);
      p.grounded = false;
      audio.whoosh(0.15);
    }
    p.vel.y = (p.vel.y || 0) - 22 * dt;
    p.pos.y += p.vel.y * dt;
    if (p.pos.y <= 0) {
      if (!p.grounded && this.phase === 'day') this.stomp();
      p.pos.y = 0;
      p.vel.y = 0;
      p.grounded = true;
    }

    p.pos.x += p.vel.x * dt;
    p.pos.z += p.vel.z * dt;
    p.collide(this.boxesNear(p.pos));
    // non si esce dall'hotel se non dal portone
    p.pos.x = clamp(p.pos.x, X0 + 0.6, X0 + NW - 0.6);
    p.pos.z = clamp(p.pos.z, this.phase === 'day' ? 0.2 : 0.9, Z0 + NH - 0.6);

    // calcio
    this.kickCd -= dt;
    if (active && this.phase === 'day' && (input.wasPressed('KeyF', 'Mouse0')) && this.kickCd <= 0) {
      this.kickCd = 0.28;
      p.kick();
      const fx = Math.sin(p.facing);
      const fz = Math.cos(p.facing);
      let n = this.swarm.kick(p.pos.x + fx * 0.3, p.pos.z + fz * 0.3, fx, fz, 2.6, 0.3, 11);
      n += this.swarm.shakeOff(0, 0.3);
      const fd = Math.hypot(this.friend.pos.x - p.pos.x, this.friend.pos.z - p.pos.z);
      if (fd < 2.8) {
        const freed = this.swarm.shakeOff(1, 1);
        n += freed;
        if (freed > 10 && this.flags.friendStuck) {
          this.flags.friendStuck = false;
          this.ctx.ui.subtitle(FRIEND, 'Grazie! Andiamo!', 1.8);
        }
      }
      this.repelled(n);
      audio.pop(n ? 0.25 : 0.1);
      if (n) this.glints.burst(p.pos.x + fx, 0.4, p.pos.z + fz, Math.min(20, n + 4), 4, { color: [1, 0.9, 0.5], size: 0.15, endSize: 0.02, life: 0.5, gravity: 5 }, 1);
    }

    const hs = Math.hypot(p.vel.x, p.vel.z);
    p.animate(dt, hs, cling);

    if (this.phase === 'day' && this.flags.swarmOn) {
      if (cling > 0) this.health = Math.max(0, this.health - cling * 0.0016 * dt);
      else this.health = Math.min(1, this.health + 0.04 * dt);
      if (this.health <= 0) this.overwhelmed();
    }

    // stanze scoperte
    const room = roomAt(this.layout, p.pos.x, p.pos.z);
    if (room >= 0 && !this.visited.has(room)) {
      this.visited.add(room);
      const r = this.layout.rooms[room];
      this.ctx.ui.popup(r.styleDef.name);
      if (this.phase === 'night') audio.chime(740 + this.visited.size * 12, 0.08);
      const line = ROOM_LINES[r.styleDef.key];
      if (line && this.lineTimer <= 0 && this.phase === 'night' && Math.random() < 0.7) {
        this.ctx.ui.subtitle(FRIEND, line, 2.8);
        this.lineTimer = 6;
      }
    }
  }

  stomp() {
    const p = this.player;
    let n = this.swarm.shockwave(p.pos.x, p.pos.z, 4, 12);
    n += this.swarm.shakeOff(0, 0.85);
    if (Math.hypot(this.friend.pos.x - p.pos.x, this.friend.pos.z - p.pos.z) < 3) n += this.swarm.shakeOff(1, 0.8);
    this.repelled(n);
    this.ctx.audio.thud(0.5);
    this.fx.burst(p.pos.x, 0.1, p.pos.z, 24, 5, { color: [0.7, 0.62, 0.5], size: 0.5, endSize: 1.6, life: 0.8, drag: 3, alpha: 0.45 }, 0.5);
  }

  repelled(n) {
    if (!n) return;
    const before = this.gnomesOut;
    this.gnomesOut += n;
    for (const [m, line] of MILESTONES) {
      if (before < m && this.gnomesOut >= m) {
        this.ctx.ui.popup(`${m.toLocaleString('it-IT')} gnomi!`);
        if (this.lineTimer <= 0) {
          this.ctx.ui.subtitle(FRIEND, line, 2);
          this.lineTimer = 3;
        }
      }
    }
  }

  boxesNear(pos) {
    const c = Math.floor((pos.x - X0) / CELL);
    const r = Math.floor((pos.z - Z0) / CELL);
    const out = this.nearBoxes;
    out.length = 0;
    for (let dr = -1; dr <= 1; dr++)
      for (let dc = -1; dc <= 1; dc++) {
        const rr = r + dr;
        const cc = c + dc;
        if (rr < 0 || rr >= ROWS || cc < 0 || cc >= COLS) continue;
        const b = this.buckets.get(rr * COLS + cc);
        if (b) for (const q of b) out.push(q);
      }
    return out;
  }

  updateFriend(dt) {
    const f = this.friend;
    const p = this.player;
    const d = Math.hypot(p.pos.x - f.pos.x, p.pos.z - f.pos.z);
    let tx = 0;
    let tz = 0;
    let speed = 0;
    const clung = this.swarm.clinging[1];
    if (this.phase === 'night') {
      // ti fa strada, ma ti aspetta se resti indietro
      if (d > 7) {
        if (this.flowTimer <= 0) {
          this.flowTimer = 0.5;
          this.flowP.compute(p.pos.x, p.pos.z);
        }
        const dir = this.flowDir(this.flowP, f.pos);
        tx = dir[0];
        tz = dir[1];
        speed = 5.2;
      } else {
        const gd = this.flowGoal.distAt(f.pos.x, f.pos.z);
        const pd = this.flowGoal.distAt(p.pos.x, p.pos.z);
        if (gd > 3 && gd > pd - 5) {
          const dir = this.flowDir(this.flowGoal, f.pos);
          tx = dir[0];
          tz = dir[1];
          speed = 4.6;
        }
      }
    } else if (this.phase === 'day' || this.phase === 'down') {
      if (clung > 25) {
        if (!this.flags.friendStuck) {
          this.flags.friendStuck = true;
          this.ctx.ui.subtitle(FRIEND, 'Aiutami! Mi sono addosso! Vieni a calciarli via!', 2.6);
          this.lineTimer = 3;
        }
      } else if (d > 2.2) {
        const dir = this.flowDir(this.flowP, f.pos);
        tx = dir[0];
        tz = dir[1];
        speed = Math.min(8.5, 4 + d * 0.7) * Math.max(0.3, 1 - clung * 0.02);
      }
      // l'amico si difende da solo, ma meno bene di te
      this.friendKickCd = (this.friendKickCd || 0) - dt;
      if (this.friendKickCd <= 0 && this.swarm.countNear(f.pos.x, f.pos.z, 1.8) > 4) {
        this.friendKickCd = 0.9;
        f.kick();
        this.repelled(this.swarm.shockwave(f.pos.x, f.pos.z, 1.8, 8));
        this.ctx.audio.pop(0.08);
      }
    }
    if (speed > 0 && d < 1.2 && this.phase !== 'night') speed = 0;
    const k = 1 - Math.exp(-8 * dt);
    f.vel.x += (tx * speed - f.vel.x) * k;
    f.vel.z += (tz * speed - f.vel.z) * k;
    f.pos.x += f.vel.x * dt;
    f.pos.z += f.vel.z * dt;
    f.collide(this.boxesNear(f.pos));
    f.pos.z = Math.max(f.pos.z, 0.9);
    const hs = Math.hypot(f.vel.x, f.vel.z);
    if (hs > 0.3) {
      const want = Math.atan2(f.vel.x, f.vel.z);
      let dd = want - f.facing;
      dd = Math.atan2(Math.sin(dd), Math.cos(dd));
      f.facing += dd * (1 - Math.exp(-10 * dt));
    } else {
      const want = Math.atan2(p.pos.x - f.pos.x, p.pos.z - f.pos.z);
      let dd = want - f.facing;
      dd = Math.atan2(Math.sin(dd), Math.cos(dd));
      f.facing += dd * (1 - Math.exp(-3 * dt));
    }
    // se resta troppo indietro (incastrato), il sogno lo riporta vicino a te
    if (d > 30 && this.phase !== 'sleeping') {
      f.pos.set(p.pos.x - Math.sin(p.facing) * 1.5, 0, p.pos.z - Math.cos(p.facing) * 1.5);
      this.swarm.shakeOff(1, 1);
    }
    f.animate(dt, hs, clung);
    this.flowTimer -= dt;
  }

  flowDir(field, pos) {
    const i = Math.floor(pos.x - X0);
    const j = Math.floor(pos.z - Z0);
    if (i < 0 || i >= NW || j < 0 || j >= NH) return [0, 0];
    const k = j * NW + i;
    return [field.dirX[k], field.dirZ[k]];
  }

  updateSwarm(dt) {
    const { audio } = this.ctx;
    this.dayT += dt;
    const p = this.player;
    this.swarmFlowT = (this.swarmFlowT || 0) - dt;
    if (this.swarmFlowT <= 0) {
      this.swarmFlowT = 0.3;
      this.flowP.compute(p.pos.x, p.pos.z);
      this.flowF.compute(this.friend.pos.x, this.friend.pos.z);
    }
    if (this.flags.swarmOn && this.phase === 'day') {
      // lo sciame cresce: da pochi a migliaia
      const t = this.dayT - 10;
      const rate = Math.min(90, 8 + t * 2.4);
      const cap = Math.min(this.swarm.max - 50, 150 + t * 30);
      this.spawnAcc += rate * dt;
      while (this.spawnAcc >= 1) {
        this.spawnAcc -= 1;
        if (this.swarm.active >= cap) {
          this.spawnAcc = 0;
          break;
        }
        this.spawnGnome();
      }
    }
    const landed = this.swarm.update(dt, this.time, [this.player, this.friend], [this.flowP, this.flowF]);
    void landed;
    // vocine: più sono vicini, più si sentono
    const near = this.swarm.countNear(p.pos.x, p.pos.z, 8) + this.swarm.clinging[0] * 2;
    if (Math.random() < Math.min(0.9, near / 60)) audio.squeak(0.03 + Math.min(0.06, near / 1500));
  }

  spawnGnome() {
    const p = this.player;
    const rooms = this.layout.rooms;
    for (let tries = 0; tries < 8; tries++) {
      const r = rooms[Math.floor(Math.random() * rooms.length)];
      const d = Math.hypot(r.cx - p.pos.x, r.cz - p.pos.z);
      if (d < 20 || d > 80) continue;
      const x = r.minX + 2 + Math.random() * (r.maxX - r.minX - 4);
      const z = r.minZ + 2 + Math.random() * (r.maxZ - r.minZ - 4);
      if (this.swarm.isBlocked(x, z)) continue;
      this.swarm.spawn(x, z, Math.random() < 0.18);
      return;
    }
  }

  updateRoomAtmosphere(dt) {
    const room = roomAt(this.layout, this.player.pos.x, this.player.pos.z);
    if (room < 0) return;
    const st = this.layout.rooms[room].styleDef;
    const target = new THREE.Color(st.light);
    if (this.day) target.lerp(new THREE.Color('#ffffff'), 0.45);
    const k = 1 - Math.exp(-2.5 * dt);
    this.hemi.color.lerp(target, k);
    const fogTarget = new THREE.Color(st.light).multiplyScalar(this.day ? 0.35 : 0.12);
    this.scene.fog.color.lerp(fogTarget, k);
    this.scene.background.copy(this.scene.fog.color);
    this.lantern.color.lerp(target, k);
  }

  updateAmbientParticles() {
    for (const pr of this.rb.particles) {
      const r = pr.room;
      if (Math.hypot(r.cx - this.player.pos.x, r.cz - this.player.pos.z) > 30) continue;
      if (pr.kind === 'bubbles' && Math.random() < 0.5) {
        this.glints.emit(r.cx + (Math.random() - 0.5) * 14, 0.2, r.cz + (Math.random() - 0.5) * 14, 0, 0.8 + Math.random(), 0, { color: [0.5, 0.85, 1], size: 0.12 + Math.random() * 0.15, life: 7, alpha: 0.7 });
      }
      if (pr.kind === 'snow' && Math.random() < 0.7) {
        this.glints.emit(r.cx + (Math.random() - 0.5) * 16, r.style.height - 0.5, r.cz + (Math.random() - 0.5) * 16, (Math.random() - 0.5) * 0.3, -0.7, (Math.random() - 0.5) * 0.3, { color: [0.9, 0.95, 1], size: 0.08, life: 10, alpha: 0.8 });
      }
    }
  }

  snapCamera() {
    this.updateCamera(1, true);
  }

  updateCamera(dt, snap = false) {
    const p = this.player;
    const head = new THREE.Vector3(p.pos.x, p.pos.y + 1.6, p.pos.z);
    // con tanti gnomi addosso la camera si allontana e sale, per non restare sepolta
    const cling = this.swarm.clinging[0];
    const dist = 4.6 + Math.min(2.5, cling * 0.035);
    const pitch = Math.min(1.2, this.camPitch + cling * 0.006);
    const dx = -Math.sin(this.camYaw) * Math.cos(pitch);
    const dz = -Math.cos(this.camYaw) * Math.cos(pitch);
    const dy = Math.sin(pitch);
    // accorcia la distanza se c'è un muro in mezzo
    let reach = dist;
    for (let s = 0.3; s <= dist; s += 0.2) {
      const x = head.x + dx * s;
      const z = head.z + dz * s;
      if (this.swarm.isBlocked(x, z) && this.isWallAt(x, z)) {
        reach = Math.max(0.6, s - 0.35);
        break;
      }
    }
    const room = roomAt(this.layout, p.pos.x, p.pos.z);
    const ceil = room >= 0 ? this.layout.rooms[room].height - 0.4 : 30;
    const target = new THREE.Vector3(head.x + dx * reach, Math.min(ceil, head.y + dy * reach + 0.2), head.z + dz * reach);
    if (snap) this.camPos.copy(target);
    else this.camPos.lerp(target, 1 - Math.exp(-14 * dt));
    this.camera.position.copy(this.camPos);
    this.camera.lookAt(head.x, head.y - 0.1, head.z);
  }

  isWallAt(x, z) {
    for (const b of this.boxesNear({ x, z })) {
      if (b.dir && x > b.minX - 0.15 && x < b.maxX + 0.15 && z > b.minZ - 0.15 && z < b.maxZ + 0.15) return true;
    }
    return false;
  }

  updateCompass() {
    const { ui } = this.ctx;
    const show = (this.phase === 'night' && (this.hasKey || this.time > 8)) || (this.phase === 'day' && this.flags.swarmOn);
    if (!show) {
      ui.compass(null);
      return;
    }
    const [fx, fz] = this.flowDir(this.flowGoal, this.player.pos);
    if (!fx && !fz) {
      ui.compass(null);
      return;
    }
    const toT = Math.atan2(fx, fz);
    ui.compass(-(toT - this.camYaw));
  }

  onResize() {
    this.fx.setScale(this.ctx.renderer, this.camera);
    this.glints.setScale(this.ctx.renderer, this.camera);
  }

  dispose() {
    this.disposed = true;
    const { ui, audio, renderer, input } = this.ctx;
    renderer.domElement.removeEventListener('click', this.onCanvasClick);
    input.unlock();
    audio.stopAllPads(1);
    ui.hint(null);
    ui.center(null);
    ui.clearSubtitle();
    ui.objective('');
    ui.compass(null);
    this.rb.dispose();
    this.player.dispose();
    this.friend.dispose();
    this.swarm.dispose();
    this.fx.dispose();
    this.glints.dispose();
  }
}

function keyWallTexture() {
  const c = document.createElement('canvas');
  c.width = 512;
  c.height = 400;
  const g = c.getContext('2d');
  g.fillStyle = '#2a1a10';
  g.fillRect(0, 0, 512, 400);
  for (let y = 0; y < 16; y++)
    for (let x = 0; x < 24; x++) {
      const px = 10 + x * 21;
      const py = 12 + y * 24;
      g.fillStyle = '#4a3020';
      g.fillRect(px, py, 16, 20);
      if (Math.random() < 0.85) {
        g.fillStyle = '#e8c060';
        g.beginPath();
        g.arc(px + 8, py + 6, 3, 0, Math.PI * 2);
        g.fill();
        g.fillRect(px + 7, py + 8, 2, 9);
      }
    }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

