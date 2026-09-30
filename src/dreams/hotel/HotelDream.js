import * as THREE from 'three';
import { Particles } from '../../core/particles.js';
import { clamp, lerp, mulberry32 } from '../../core/noise.js';
import { buildLayout, roomAt, FlowField, CELL, COLS, ROWS, X0, Z0, NW, NH, ENTRANCE_W } from './layout.js';
import { RoomBuilder, STYLES, LOBBY_STYLE, SUITE_STYLE } from './rooms.js';
import { Character } from './character.js';
import { GnomeSwarm } from './gnomes.js';
import { buildSuite } from './suite.js';
import { Tracers } from './tracers.js';

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

// Chiacchiere davanti al tè: se ne pescano alcune ogni volta.
const TEA_TALK = [
  [FRIEND, 'Secondo me le stanze cambiano quando non le guardiamo.'],
  [FRIEND, 'Questo tè sa di... pioggia. In senso buono.'],
  [FRIEND, 'Chissà chi l\'ha costruito, questo posto.'],
  [FRIEND, 'Il demone nel campo... ci pensi ancora?'],
  [FRIEND, 'Si sta bene qui. Restiamo ancora un po\'.'],
  [FRIEND, 'Senti come scricchiola il legno? Sembra una nave.'],
  [FRIEND, 'Domani potremmo esplorare l\'ala che non abbiamo visto.'],
  [FRIEND, 'Hai notato che la reception non ha nessuno dietro?'],
  [FRIEND, 'Mi piace questa finestra. Non so perché.'],
  [null, 'Il vapore sale lento. Per un attimo non pensi a niente.'],
  [null, 'Il tè è caldo, la tazza pesa il giusto.'],
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

    this.scene.background = new THREE.Color('#0d0906');
    this.scene.fog = new THREE.FogExp2('#1a120a', 0.022);
    this.hemi = new THREE.HemisphereLight('#ffd9a0', '#3a2a1c', 1.1);
    this.scene.add(this.hemi);
    this.scene.add(new THREE.AmbientLight('#ffffff', 0.25));
    this.lantern = new THREE.PointLight('#ffd6a0', 18, 16, 1.6);
    this.scene.add(this.lantern);

    this.fx = new Particles(this.scene, 2500);
    this.glints = new Particles(this.scene, 2500, { additive: true });
    this.fx.setScale(ctx.renderer, this.camera);
    this.glints.setScale(ctx.renderer, this.camera);
    this.tracers = new Tracers(this.scene);
    this.flash = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.rb.glowTex, color: '#ffd080', blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0 }));
    this.flash.scale.set(0.9, 0.9, 1);
    this.scene.add(this.flash);

    this.player = new Character(this.scene, { skin: '#e0b089', hair: '#3b2a1e', shirt: '#2f4f8f' });
    this.friend = new Character(this.scene, { skin: '#c99470', hair: '#141414', shirt: '#d9a82e' });
    this.friend.radius = 0.4;

    this.swarm = new GnomeSwarm(this.scene, this.layout.blocked, 2600);
    this.flowP = new FlowField(this.layout.blocked);
    this.flowF = new FlowField(this.layout.blocked);
    this.flowGoal = new FlowField(this.layout.blocked);
    this.goal = null;
    this.flowTimer = 0;

    this.camYaw = 0;
    this.camPitch = 0.25;
    this.camPos = new THREE.Vector3();
    this.camLookAt = new THREE.Vector3();

    this.onCanvasClick = () => ctx.input.lock();
    ctx.renderer.domElement.addEventListener('click', this.onCanvasClick);

    this.load();
    if (ctx.resumeHotel && this.saved?.reached) this.resume();
    else this.arrive();
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
      if (room.suite) {
        this.suiteKit = buildSuite(api, rb);
        this.suite = room;
      }
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

  // ---------- Memoria del sogno (salvataggio locale) ----------
  load() {
    const s = this.ctx.progress.hotel || {};
    this.saved = s;
    this.dayNum = s.dayNum || 0;
    this.gnomesTotal = s.gnomesTotal || 0;
    this.visited = new Set(s.visited || [0]);
    this.hasKey = !!s.hasKey;
  }

  save() {
    const p = this.ctx.progress;
    p.hotel = {
      reached: true,
      dayNum: this.dayNum,
      timeOfDay: this.timeOfDay,
      hallCleared: this.hallCleared,
      hasKey: this.hasKey,
      gnomesTotal: this.gnomesTotal,
      visited: [...this.visited],
    };
    this.ctx.saveProgress(p);
  }

  // ---------- Inizio ----------
  // Arrivo dal campo: è notte, l'atrio è enorme, bisogna prendere una stanza.
  arrive() {
    const { ui } = this.ctx;
    this.timeOfDay = 'night';
    this.hallCleared = true;
    this.hasKey = false;
    this.resetCommon();
    this.player.pos.set(0, 0, 4);
    this.friend.pos.set(1.6, 0, 3.4);
    this.camYaw = 0;
    this.setGoal('bell');
    this.applyTime();
    this.snapCamera();
    ui.objective('Suona il campanello della reception.');
    this.ctx.audio.pad('hotel', [98, 146.8, 196, 246.9], { vol: 0.04, cutoff: 1100 });
    this.script = [
      { at: 1.2, fn: () => ui.subtitle(FRIEND, 'È... più grande dentro che fuori.', 3) },
      { at: 5, fn: () => ui.subtitle(FRIEND, 'Chiediamo una stanza. C\'è un campanello, laggiù.', 3.2) },
    ];
    this.save();
  }

  // Si riprende il sogno da dove lo si era lasciato: sempre nella suite.
  resume() {
    const s = this.saved;
    this.hasKey = true;
    this.resetCommon();
    if (s.timeOfDay === 'day' && !s.hallCleared) {
      this.startMorning(false);
      return;
    }
    this.timeOfDay = s.timeOfDay || 'night';
    this.hallCleared = s.hallCleared ?? true;
    const b = this.suiteKit.beds[0];
    this.player.pos.set(b.x, 0, b.z);
    this.player.facing = Math.PI;
    this.friend.pos.copy(this.suiteKit.armchair.pos);
    this.camYaw = Math.PI;
    this.applyTime();
    this.snapCamera();
    this.enterSuiteMood();
    this.script = [{ at: 1.5, fn: () => this.ctx.ui.subtitle(FRIEND, this.timeOfDay === 'night' ? 'Eccoti. Il tè è ancora caldo.' : 'Bentornato. La hall è tranquilla, oggi.', 3) }];
  }

  resetCommon() {
    const { ui, audio } = this.ctx;
    this.phase = 'explore';
    this.activity = null;
    this.health = 1;
    this.stamina = 1;
    this.flags = {};
    this.ritual = { tea: false, shower: false };
    this.lineTimer = 0;
    this.shotCd = 0;
    this.ammo = 30;
    this.reloadT = 0;
    this.wave = null;
    this.swarm.clear();
    this.player.setArmed(false);
    this.friend.setArmed(false);
    this.player.sitting = this.friend.sitting = false;
    this.suiteKit.guns.visible = false;
    ui.showHud(true);
    ui.calm(true);
    ui.crosshair(false);
    ui.steam(false);
    audio.stopAllPads(1);
    audio.stopLoops();
    this.configureHud();
  }

  configureHud() {
    const fight = this.phase === 'fight';
    this.ctx.ui.configureHud({
      unit: fight ? 'colpi' : 'stanze scoperte',
      turboLabel: 'Fiato <kbd>Shift</kbd>',
      healthLabel: 'Energia',
      controls: fight
        ? 'Clic o <kbd>F</kbd> spara · <kbd>R</kbd> ricarica · <kbd>Spazio</kbd> salta e scrolla via gli gnomi · <kbd>Shift</kbd> corri'
        : 'Clicca per usare il mouse · <kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd> cammina · <kbd>E</kbd> interagisci · <kbd>Spazio</kbd> salta · <kbd>P</kbd> pausa',
    });
  }

  setGoal(kind) {
    this.goal = kind;
    if (kind === 'bell') this.flowGoal.compute(this.bellPos.x, this.bellPos.z);
    else if (kind === 'suite') this.flowGoal.compute(this.suite.cx, this.suite.cz);
    else if (kind === 'hall') this.flowGoal.compute(0, 14);
  }

  // Luci, finestre e musica in base all'ora del sogno.
  applyTime() {
    const day = this.timeOfDay === 'day';
    this.hemi.intensity = day ? 1.6 : 1.1;
    this.outsideMat.color.set(day ? '#fff6e0' : '#141c38');
    this.exitGlow.material.opacity = day ? 0.9 : 0.15;
    this.suiteKit.setDay(day);
    this.suiteKit.setLamp(!day);
    this.lampOn = !day;
    this.lantern.intensity = day ? 8 : 18;
  }

  enterSuiteMood() {
    const { audio, ui } = this.ctx;
    audio.stopAllPads(2);
    audio.pad('suite', this.timeOfDay === 'night' ? [130.8, 196, 246.9, 329.6] : [146.8, 220, 277.2, 370], { vol: 0.035, cutoff: 1400 });
    audio.loop('fire', true, { freq: 500, q: 0.4, vol: 0.025, type: 'lowpass', crackle: true });
    this.updateObjectiveInSuite();
    ui.calm(true);
  }

  leaveSuiteMood() {
    const { audio } = this.ctx;
    audio.loop('fire', false);
    audio.stopPad('suite', 2);
    if (this.timeOfDay === 'night') audio.pad('hotel', [98, 146.8, 196, 246.9], { vol: 0.04, cutoff: 1100 });
  }

  updateObjectiveInSuite() {
    const { ui } = this.ctx;
    if (this.timeOfDay === 'night') {
      ui.checklist([
        ['Un tè con il tuo amico, al tavolino', this.ritual.tea],
        ['Una doccia calda', this.ritual.shower],
        ['A letto', false],
      ]);
    } else if (this.suiteKit.guns.visible) ui.objective('Sul tavolino ci sono due pistole.');
    else if (!this.hallCleared) ui.objective('Scendi nella hall.');
    else ui.checklist([['L\'hotel è vostro: esplora, oppure', true], ['riposa a letto fino a sera', false]]);
  }

  // ---------- La sera, il sonno, il mattino ----------
  ringBell() {
    const { ui, audio } = this.ctx;
    this.hasKey = true;
    audio.chime(1320, 0.25);
    setTimeout(() => audio.chime(1760, 0.15), 250);
    ui.subtitle('Una voce lontana:', 'Suite 1313. Buonanotte.', 3);
    ui.popup('Chiave 1313');
    ui.objective('Trova la suite 1313.');
    this.setGoal('suite');
    this.script.push({ at: this.time + 3.4, fn: () => ui.subtitle(FRIEND, '1313... dev\'essere in fondo. Di qua, credo.', 3) });
    this.bellGlow.material.opacity = 0;
    this.save();
  }

  async sleep() {
    const { ui, audio } = this.ctx;
    const fromDay = this.timeOfDay === 'day';
    this.phase = 'sleeping';
    ui.hint(null);
    ui.objective('');
    audio.stopAllPads(3);
    audio.stopLoops();
    await ui.fade(1, 2200, '#05040a');
    if (this.disposed) return;
    if (fromDay) {
      // riposo pomeridiano: ci si risveglia che è sera
      ui.subtitle(null, 'Chiudi gli occhi un momento. Quando li riapri, fuori è sera.', 4);
      await new Promise((r) => setTimeout(r, 3800));
      if (this.disposed) return;
      this.startEvening();
      await ui.fade(0, 2000, '#05040a');
      return;
    }
    ui.subtitle(null, 'La notte passa. Il legno scricchiola. Giù, lontano, qualcosa ridacchia.', 4);
    await new Promise((r) => setTimeout(r, 4200));
    if (this.disposed) return;
    ui.center('<div class="dream-title"><h2>Il mattino dopo</h2></div>');
    await new Promise((r) => setTimeout(r, 2000));
    if (this.disposed) return;
    ui.center(null);
    this.startMorning();
    await ui.fade(0, 1800, '#fff4e0');
  }

  startEvening() {
    this.phase = 'explore';
    this.timeOfDay = 'night';
    this.ritual = { tea: false, shower: false };
    this.player.setArmed(false);
    this.friend.setArmed(false);
    const b = this.suiteKit.beds[0];
    this.player.pos.set(b.x, 0, b.z);
    this.friend.pos.copy(this.suiteKit.armchair.pos);
    this.applyTime();
    this.enterSuiteMood();
    this.ctx.ui.subtitle(FRIEND, 'Ben svegliato. Ho acceso il camino.', 3);
    this.save();
  }

  startMorning(advance = true) {
    const { ui } = this.ctx;
    this.phase = 'explore';
    this.timeOfDay = 'day';
    if (advance || !this.dayNum) this.dayNum += 1;
    this.hallCleared = false;
    this.health = 1;
    const b = this.suiteKit.beds[0];
    this.player.pos.set(b.x, 0, b.z);
    this.player.vel.set(0, 0, 0);
    this.player.facing = Math.PI;
    this.camYaw = Math.PI;
    this.friend.pos.copy(this.suiteKit.chairs[1].pos);
    this.suiteKit.guns.visible = true;
    this.applyTime();
    this.snapCamera();
    this.enterSuiteMood();
    this.setGoal(null);
    const t0 = this.time;
    this.script = [
      { at: t0 + 1.5, fn: () => ui.subtitle(FRIEND, 'Buongiorno. Sul tavolino c\'erano già... due pistole. Non chiedermi perché.', 3.6) },
    ];
    this.save();
  }

  takeGuns() {
    const { ui, audio } = this.ctx;
    this.suiteKit.guns.visible = false;
    this.player.setArmed(true);
    this.friend.setArmed(true);
    audio.chime(520, 0.15);
    ui.popup('Due pistole');
    this.setGoal('hall');
    this.updateObjectiveInSuite();
    this.script.push(
      { at: this.time + 1.5, fn: () => ui.subtitle(FRIEND, 'Senti? Quelle vocine... vengono dalla hall.', 3) },
    );
  }

  // ---------- Attività nella suite ----------
  startActivity(kind) {
    const { ui, audio } = this.ctx;
    const k = this.suiteKit;
    this.activity = { kind, t: 0 };
    ui.hint(null);
    const p = this.player;
    p.vel.set(0, 0, 0);
    if (kind === 'tea') {
      p.pos.copy(k.chairs[0].pos);
      p.facing = k.chairs[0].facing;
      p.sitting = true;
      this.friend.pos.copy(k.chairs[1].pos);
      this.friend.facing = k.chairs[1].facing;
      this.friend.sitting = true;
      const pool = [...TEA_TALK].sort(() => Math.random() - 0.5).slice(0, 3);
      this.activity.lines = pool;
      this.activity.cam = k.table.clone().add(new THREE.Vector3(2.8, 1.7, 0.3));
      this.activity.look = k.table.clone().add(new THREE.Vector3(-0.6, 0.85, 0));
      this.activity.duration = 16;
    } else if (kind === 'shower') {
      p.pos.copy(k.shower);
      p.facing = Math.PI;
      this.activity.cam = k.shower.clone().add(new THREE.Vector3(3.4, 2.1, -3.2));
      this.activity.look = k.shower.clone().add(new THREE.Vector3(0, 1.3, 0));
      this.activity.duration = 11;
      audio.loop('water', true, { freq: 2600, q: 0.5, vol: 0.09 });
      ui.subtitle(null, 'L\'acqua è calda. I pensieri scivolano via.', 4);
    } else if (kind === 'window') {
      p.pos.copy(k.windowSpot);
      p.facing = -Math.PI / 2;
      // in prima persona: guardi fuori con i tuoi occhi
      this.activity.cam = k.windowSpot.clone().add(new THREE.Vector3(0.2, 1.7, 0));
      p.group.visible = false;
      this.activity.look = k.windowLook.clone();
      this.activity.duration = 999;
      ui.subtitle(null, this.timeOfDay === 'night'
        ? 'Montagne nere, un cielo pieno di stelle. Laggiù, lontanissimo, un bagliore rosso che non si muove.'
        : 'Il sole sulle montagne. Il campo, laggiù, sembra piccolissimo.', 5);
    } else if (kind === 'fire') {
      // l'amico ti lascia la poltrona e si siede al tavolino
      this.friend.pos.copy(k.chairs[1].pos);
      this.friend.facing = k.chairs[1].facing;
      this.friend.sitting = true;
      p.pos.copy(k.armchair.pos);
      p.facing = k.armchair.facing;
      p.sitting = true;
      this.activity.cam = k.armchair.pos.clone().add(new THREE.Vector3(2.4, 1.9, 1.6));
      this.activity.look = k.fireplace.clone().add(new THREE.Vector3(0, 0.8, 0));
      this.activity.duration = 999;
      audio.loop('fire', false);
      audio.loop('fireClose', true, { freq: 420, q: 0.5, vol: 0.05, type: 'lowpass', crackle: true });
      ui.subtitle(null, 'Il fuoco scoppietta. Nessuno dice niente, ed è perfetto così.', 4.5);
    }
    this.baseHint = '<kbd>E</kbd> alzati';
  }

  updateActivity(dt) {
    const { ui, audio, input } = this.ctx;
    const a = this.activity;
    a.t += dt;
    const k = this.suiteKit;
    if (a.kind === 'tea') {
      if (a.t > 0.8 && !a.poured) {
        a.poured = true;
        audio.pour();
      }
      if (a.t > 0.8 && a.t < 2.8 && Math.random() < 0.8) {
        this.glints.emit(k.teaSpout.x + 0.12, k.teaSpout.y - 0.05, k.teaSpout.z, 0, -1.5, 0, { color: [0.7, 0.45, 0.2], size: 0.03, life: 0.15 });
      }
      if (Math.random() < 0.25) {
        for (const dz of [0.45, -0.45]) this.fx.emit(k.table.x - 0.15, 0.9, k.table.z + dz, (Math.random() - 0.5) * 0.05, 0.25, 0, { color: [0.95, 0.95, 0.95], size: 0.08, endSize: 0.3, life: 2.2, alpha: 0.25 });
      }
      a.lines.forEach(([who, text], i) => {
        const at = 2.5 + i * 4.3;
        if (a.t > at && !a[`l${i}`]) {
          a[`l${i}`] = true;
          ui.subtitle(who, text, 3.8);
        }
      });
      if (a.t > 1) this.ritual.tea = true;
    } else if (a.kind === 'shower') {
      for (let i = 0; i < 6; i++) {
        const r = Math.random() * 0.25;
        const an = Math.random() * 6.28;
        this.glints.emit(k.showerHead.x + Math.cos(an) * r, k.showerHead.y, k.showerHead.z + Math.sin(an) * r, 0, -5, 0.2, { color: [0.6, 0.8, 1], size: 0.03, life: 0.45, alpha: 0.7 });
      }
      if (Math.random() < 0.3) this.fx.emit(k.shower.x + (Math.random() - 0.5), 1 + Math.random(), k.shower.z + (Math.random() - 0.5), 0, 0.3, 0, { color: [0.95, 0.96, 1], size: 0.6, endSize: 2.2, life: 4, alpha: 0.18 });
      if (a.t > 1.5) ui.steam(true);
      if (a.t > 1) this.ritual.shower = true;
    }
    // la camera va dolcemente in posizione
    this.camPos.lerp(a.cam, 1 - Math.exp(-2.5 * dt));
    this.camLookAt.lerp(a.look, 1 - Math.exp(-3 * dt));
    this.camera.position.copy(this.camPos);
    this.camera.lookAt(this.camLookAt);

    const wantsOut = a.t > 1.2 && (input.wasPressed('KeyE', 'Space') || input.down('KeyW', 'KeyS', 'KeyA', 'KeyD'));
    if (wantsOut || a.t > a.duration) this.endActivity();
  }

  endActivity() {
    const { ui, audio } = this.ctx;
    const a = this.activity;
    if (!a) return;
    this.activity = null;
    this.baseHint = null;
    this.player.sitting = false;
    this.friend.sitting = false;
    this.player.group.visible = true;
    if (a.kind === 'shower') {
      audio.loop('water', false);
      setTimeout(() => ui.steam(false), 1200);
      // si esce dalla doccia verso il bagno
      this.player.pos.set(this.suiteKit.shower.x + 1.8, 0, this.suiteKit.shower.z - 1.6);
    }
    if (a.kind === 'fire') {
      audio.loop('fireClose', false);
      audio.loop('fire', true, { freq: 500, q: 0.4, vol: 0.025, type: 'lowpass', crackle: true });
      this.player.pos.x += 1.2;
    }
    if (a.kind === 'tea') this.player.pos.x += 1;
    this.camYaw = this.player.facing;
    this.snapCamera();
    this.updateObjectiveInSuite();
  }

  // ---------- La hall invasa dagli gnomi ----------
  startFight() {
    const { ui, audio } = this.ctx;
    this.phase = 'fight';
    const m = 1 + (this.dayNum - 1) * 0.35;
    this.wave = {
      index: 0,
      list: [Math.round(160 * m), Math.round(450 * m), Math.round(1100 * m)],
      toSpawn: 0,
      pause: 1.5,
      acc: 0,
    };
    this.wave.toSpawn = this.wave.list[0];
    this.killsToday = 0;
    ui.calm(false);
    ui.crosshair(true);
    this.configureHud();
    audio.stopAllPads(1);
    audio.pad('swarm', [110, 116.5, 164.8, 174.6], { vol: 0.045, type: 'sawtooth', cutoff: 700, tremolo: 6 });
    ui.subtitle(FRIEND, 'Sono migliaia! Spara!', 2.5);
    ui.objective('Libera la hall dagli gnomi.');
    this.baseHint = 'Clic o <kbd>F</kbd>: spara · <kbd>Spazio</kbd>: salta e scrolla via chi ti si arrampica';
    setTimeout(() => (this.baseHint = null), 8000);
    // i primi sono già lì, sparsi sul pavimento della hall
    for (let i = 0; i < 60; i++) this.spawnGnome(false);
    this.wave.toSpawn -= 60;
  }

  updateFight(dt) {
    const { ui, audio } = this.ctx;
    const w = this.wave;
    if (w.pause > 0) {
      w.pause -= dt;
    } else if (w.toSpawn > 0) {
      const rate = 30 + w.index * 25;
      w.acc += rate * dt;
      while (w.acc >= 1 && w.toSpawn > 0) {
        w.acc -= 1;
        if (this.swarm.active > 1400) {
          w.acc = 0;
          break;
        }
        this.spawnGnome(Math.random() < 0.45);
        w.toSpawn--;
      }
    } else if (this.swarm.active - this.swarm.clinging[0] - this.swarm.clinging[1] <= 0 && this.swarm.active > 0) {
      // rimasti soli, gli ultimi aggrappati saltano giù e scappano
      this.swarm.shakeOff(0, 1);
      this.swarm.shakeOff(1, 1);
    } else if (this.swarm.active === 0) {
      w.index++;
      if (w.index >= w.list.length) {
        this.endFight();
        return;
      }
      w.toSpawn = w.list[w.index];
      w.pause = 3.5;
      ui.popup(`Ondata ${w.index + 1}`);
      ui.subtitle(FRIEND, w.index === 1 ? 'Ne arrivano altri! Dalle balconate!' : 'L\'ultima... sono tantissimi!', 2.6);
      audio.squeak(0.2);
    }
  }

  endFight() {
    const { ui, audio } = this.ctx;
    this.phase = 'explore';
    this.hallCleared = true;
    this.wave = null;
    ui.crosshair(false);
    ui.calm(true);
    this.configureHud();
    audio.stopAllPads(2);
    audio.chime(660, 0.2);
    setTimeout(() => audio.chime(880, 0.15), 300);
    ui.subtitle(FRIEND, 'È finita. Senti che silenzio.', 3.2);
    this.script.push({ at: this.time + 4, fn: () => ui.subtitle(FRIEND, 'Torniamo su? Un tè ce lo siamo meritato.', 3) });
    ui.objective('La hall è tranquilla. L\'hotel è vostro: esplora, o torna nella suite.');
    this.setGoal(null);
    this.save();
  }

  spawnGnome(fromBalcony) {
    const L = this.layout.rooms[0];
    const p = this.player;
    if (fromBalcony) {
      const side = Math.floor(Math.random() * 3);
      const ys = [9.4, 15.9, 22.4, 28.9];
      const y = ys[Math.floor(Math.random() * ys.length)];
      let x;
      let z;
      let vx = 0;
      let vz = 0;
      if (side === 0) {
        x = L.minX + 2;
        z = L.minZ + 4 + Math.random() * (L.maxZ - L.minZ - 8);
        vx = 2 + Math.random() * 3;
      } else if (side === 1) {
        x = L.maxX - 2;
        z = L.minZ + 4 + Math.random() * (L.maxZ - L.minZ - 8);
        vx = -2 - Math.random() * 3;
      } else {
        x = L.minX + 4 + Math.random() * (L.maxX - L.minX - 8);
        z = L.maxZ - 2;
        vz = -2 - Math.random() * 3;
      }
      this.swarm.spawnFalling(x, y, z, vx, vz);
      return;
    }
    for (let tries = 0; tries < 10; tries++) {
      const x = L.minX + 2 + Math.random() * (L.maxX - L.minX - 4);
      const z = L.minZ + 3 + Math.random() * (L.maxZ - L.minZ - 5);
      if (Math.hypot(x - p.pos.x, z - p.pos.z) < 9) continue;
      if (this.swarm.isBlocked(x, z)) continue;
      this.swarm.spawn(x, z, Math.random() < 0.2);
      return;
    }
  }

  // Sparo: raggio dal centro dello schermo, fermato dai muri e dal pavimento.
  fire() {
    const { audio, ui } = this.ctx;
    if (this.reloadT > 0) return;
    if (this.ammo <= 0) {
      this.reload();
      return;
    }
    this.ammo--;
    this.shotCd = 0.12;
    const o = this.camera.position;
    const d = this.camera.getWorldDirection(this.tmp).clone();
    let maxT = 60;
    const room = roomAt(this.layout, o.x, o.z);
    const ceil = room >= 0 ? this.layout.rooms[room].height : 40;
    for (let t = 0.5; t < 60; t += 0.25) {
      const x = o.x + d.x * t;
      const y = o.y + d.y * t;
      const z = o.z + d.z * t;
      if (y <= 0 || y > ceil || (this.swarm.isBlocked(x, z) && this.isWallAt(x, z))) {
        maxT = t;
        break;
      }
    }
    const hits = this.swarm.shoot(o.x, o.y, o.z, d.x, d.y, d.z, maxT, 0.34, 6, 0.9);
    const muzzle = this.player.muzzleWorld(new THREE.Vector3());
    const end = new THREE.Vector3(o.x + d.x * maxT, o.y + d.y * maxT, o.z + d.z * maxT);
    this.tracers.add(muzzle, end, [1, 0.85, 0.5]);
    this.flash.position.copy(muzzle);
    this.flash.material.opacity = 1;
    audio.shot(0.28);
    ui.crosshair(true, true);
    setTimeout(() => this.phase === 'fight' && ui.crosshair(true, false), 60);
    if (end.y < 0.3) this.fx.burst(end.x, 0.05, end.z, 5, 2, { color: [0.6, 0.55, 0.45], size: 0.2, endSize: 0.6, life: 0.5, drag: 3, alpha: 0.5 }, 0.5);
    this.poof(hits);
  }

  // Gli gnomi colpiti scoppiano in coriandoli: rosso, bianco, blu.
  poof(hits) {
    if (!hits.length) return;
    const cols = [[1, 0.2, 0.2], [1, 1, 1], [0.3, 0.45, 1], [1, 0.8, 0.6]];
    for (const h of hits.slice(0, 12)) {
      for (let k = 0; k < 6; k++) {
        const c = cols[k % cols.length];
        this.glints.emit(h.x, h.y, h.z, (Math.random() - 0.5) * 4, 2 + Math.random() * 3, (Math.random() - 0.5) * 4, { color: c, size: 0.07, endSize: 0.03, life: 0.7, gravity: 9 });
      }
    }
    this.ctx.audio.pop(Math.min(0.25, 0.08 + hits.length * 0.03));
    this.addKills(hits.length);
  }

  addKills(n) {
    const before = this.gnomesTotal;
    this.gnomesTotal += n;
    this.killsToday = (this.killsToday || 0) + n;
    for (const m of [100, 500, 1000, 2500, 5000, 10000]) {
      if (before < m && this.gnomesTotal >= m) this.ctx.ui.popup(`${m.toLocaleString('it-IT')} gnomi!`);
    }
  }

  reload() {
    if (this.reloadT > 0 || this.ammo === 30) return;
    this.reloadT = 1.1;
    this.ctx.audio.thud(0.15);
  }

  async overwhelmed() {
    const { ui, audio } = this.ctx;
    this.phase = 'down';
    audio.boom(0.3);
    ui.subtitle(null, 'Sono troppi. Ti sommergono, ridacchiando...', 2.5);
    await ui.fade(1, 900, '#fff');
    if (this.disposed) return;
    // nel sogno non si muore: ci si rialza dove si era entrati
    this.swarm.shakeOff(0, 1);
    this.swarm.shakeOff(1, 1);
    this.swarm.shockwave(0, 6, 14, 16);
    this.player.pos.set(0, 0, 4);
    this.friend.pos.set(1.5, 0, 3.5);
    this.health = 1;
    this.phase = 'fight';
    ui.subtitle(null, '...e ti ritrovi in piedi, sulla soglia. Il sogno non finisce.', 3);
    await ui.fade(0, 900, '#fff');
  }

  // ---------- Ciclo ----------
  update(dt) {
    const { input, ui, audio } = this.ctx;
    if (input.wasPressed('KeyP', 'Escape') && this.phase !== 'sleeping') {
      this.paused = !this.paused;
      ui.center(this.paused ? '<div class="panel pause"><h2>Pausa</h2><p><kbd>P</kbd> riprendi</p><p><kbd>M</kbd> audio on/off</p><p>Il sogno si salva da solo.</p></div>' : null);
    }
    if (input.wasPressed('KeyM')) audio.toggleMute();
    if (this.paused) return;

    this.time += dt;
    this.lineTimer -= dt;
    while (this.script.length && this.script[0].at <= this.time) this.script.shift().fn();

    const room = roomAt(this.layout, this.player.pos.x, this.player.pos.z);
    const inSuite = room === this.suite.id;
    if (inSuite !== this.wasInSuite && this.phase === 'explore') {
      if (inSuite) this.enterSuiteMood();
      else if (this.wasInSuite !== undefined) {
        this.leaveSuiteMood();
        if (this.phase === 'explore') this.ctx.ui.objective(this.goalText());
      }
      this.wasInSuite = inSuite;
    }

    if (this.activity) {
      this.updateActivity(dt);
      this.player.animate(dt, 0, 0);
    } else {
      const active = this.phase === 'explore' || this.phase === 'fight';
      this.updatePlayer(dt, active);
      this.updateCamera(dt);
    }
    this.updateFriend(dt);
    if (this.phase === 'fight' || this.phase === 'down' || this.swarm.active > 0) this.updateSwarm(dt);
    if (this.phase === 'fight') this.updateFight(dt);
    this.updateRoomAtmosphere(dt);
    this.rb.update(this.time, dt);
    this.updateAmbientParticles(dt);
    this.fx.update(dt);
    this.glints.update(dt);
    this.tracers.update(dt);
    this.flash.material.opacity *= Math.exp(-30 * dt);
    this.lantern.position.set(this.player.pos.x, 3, this.player.pos.z);
    if (this.bellGlow && !this.hasKey) this.bellGlow.material.opacity = 0.5 + Math.sin(this.time * 4) * 0.3;

    // la hall: al mattino, entrarci scatena gli gnomi
    if (this.phase === 'explore' && this.timeOfDay === 'day' && !this.hallCleared && room === 0 && this.player.armed) this.startFight();

    // interazioni
    let hint = null;
    if (this.phase === 'explore' && !this.activity) hint = this.interactions(room, inSuite);
    if (this.phase !== 'sleeping') ui.hint(hint || this.baseHint);

    if (this.phase === 'fight' || this.phase === 'down') {
      const w = this.wave;
      ui.updateHud({
        speed: this.reloadT > 0 ? 0 : this.ammo,
        turbo: this.stamina,
        health: this.health,
        time: this.time,
        counter: `Ondata ${w ? w.index + 1 : 3}/3 · Gnomi ${this.gnomesTotal.toLocaleString('it-IT')}`,
      });
    } else {
      ui.updateHud({ speed: this.visited.size, turbo: this.stamina, health: this.health, time: this.time, counter: '' });
    }
    this.updateCompass(room);
  }

  goalText() {
    if (this.goal === 'bell') return 'Suona il campanello della reception.';
    if (this.goal === 'suite') return 'Trova la suite 1313.';
    if (this.goal === 'hall') return 'Scendi nella hall.';
    if (this.timeOfDay === 'night') return 'Torna nella suite, quando vuoi.';
    return 'L\'hotel è vostro. Esplora, o torna nella suite.';
  }

  interactions(room, inSuite) {
    const { input, ui } = this.ctx;
    const p = this.player.pos;
    const k = this.suiteKit;
    const near = (v, r) => Math.hypot(v.x - p.x, v.z - p.z) < r;
    const E = input.wasPressed('KeyE');
    if (!this.hasKey && near(this.bellPos, 2.6)) {
      if (E) this.ringBell();
      return '<kbd>E</kbd> suona il campanello';
    }
    if (this.hasKey && room === this.suite.id && !this.flags.suiteFound) {
      this.flags.suiteFound = true;
      if (this.goal === 'suite') {
        ui.subtitle(FRIEND, 'Eccola, la 1313. È... una suite. Guarda che camino!', 3.4);
        this.setGoal(null);
        this.save();
      }
    }
    if (!inSuite) return null;
    if (k.guns.visible && near(k.table, 1.9)) {
      if (E) this.takeGuns();
      return '<kbd>E</kbd> prendi le pistole';
    }
    if (near(k.table, 1.9)) {
      if (E) this.startActivity('tea');
      return '<kbd>E</kbd> siediti a prendere un tè';
    }
    if (near(k.shower, 1.3)) {
      if (E) this.startActivity('shower');
      return '<kbd>E</kbd> fatti una doccia';
    }
    if (near(k.windowSpot, 1.2)) {
      if (E) this.startActivity('window');
      return '<kbd>E</kbd> guarda fuori';
    }
    if (near(k.armchair.pos, 1.4)) {
      if (E) this.startActivity('fire');
      return '<kbd>E</kbd> siediti davanti al fuoco';
    }
    if (near(k.lampSpot, 1.3)) {
      if (E) {
        this.lampOn = !this.lampOn;
        k.setLamp(this.lampOn);
        this.ctx.audio.thud(0.08);
      }
      return `<kbd>E</kbd> ${this.lampOn ? 'spegni' : 'accendi'} la lampada`;
    }
    if (k.beds.some((b) => near(b, 1.8))) {
      if (this.timeOfDay === 'night') {
        if (E) this.sleep();
        return this.ritual.tea && this.ritual.shower ? '<kbd>E</kbd> vai a letto' : '<kbd>E</kbd> vai a letto (anche senza tè o doccia)';
      }
      if (!this.hallCleared) return 'Non ora. Qualcosa sta succedendo giù nella hall.';
      if (E) this.sleep();
      return '<kbd>E</kbd> riposa fino a sera';
    }
    return null;
  }

  updatePlayer(dt, active) {
    const { input, audio } = this.ctx;
    const p = this.player;
    if (input.locked) {
      this.camYaw -= input.mouseDX * 0.0025;
      this.camPitch = clamp(this.camPitch + input.mouseDY * 0.002, -0.35, 1.1);
    }
    if (input.down('ArrowLeft')) this.camYaw += dt * 2.2;
    if (input.down('ArrowRight')) this.camYaw -= dt * 2.2;
    if (input.down('ArrowUp') && this.phase === 'fight') this.camPitch = clamp(this.camPitch - dt, -0.35, 1.1);
    if (input.down('ArrowDown') && this.phase === 'fight') this.camPitch = clamp(this.camPitch + dt, -0.35, 1.1);

    let mx = 0;
    let mz = 0;
    if (active) {
      const f = (input.down('KeyW') || (input.down('ArrowUp') && this.phase !== 'fight') ? 1 : 0) - (input.down('KeyS') || (input.down('ArrowDown') && this.phase !== 'fight') ? 1 : 0);
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
    const inSuite = roomAt(this.layout, p.pos.x, p.pos.z) === this.suite.id;
    const speed = (sprint ? 9 : inSuite && this.phase !== 'fight' ? 3.6 : 5.5) * burden;
    const k = 1 - Math.exp(-12 * dt);
    p.vel.x += (mx * speed - p.vel.x) * k;
    p.vel.z += (mz * speed - p.vel.z) * k;
    const aiming = p.armed && this.phase === 'fight';
    if (aiming) {
      // con la pistola guardi dove miri
      let d = this.camYaw - p.facing;
      d = Math.atan2(Math.sin(d), Math.cos(d));
      p.facing += d * (1 - Math.exp(-20 * dt));
      p.aimPitch = clamp(-(this.camPitch - 0.25) * 0.8, -0.5, 0.7);
    } else if (mx || mz) {
      const want = Math.atan2(mx, mz);
      let d = want - p.facing;
      d = Math.atan2(Math.sin(d), Math.cos(d));
      p.facing += d * (1 - Math.exp(-14 * dt));
    }

    // salto: ricadendo scrolli via chi ti si è arrampicato addosso
    if (active && input.wasPressed('Space') && p.grounded) {
      p.vel.y = 7.2 * Math.max(0.45, 1 - cling / 140);
      p.grounded = false;
      audio.whoosh(0.12);
    }
    p.vel.y = (p.vel.y || 0) - 22 * dt;
    p.pos.y += p.vel.y * dt;
    if (p.pos.y <= 0) {
      if (!p.grounded && (this.phase === 'fight' || this.swarm.active > 0)) this.stomp();
      p.pos.y = 0;
      p.vel.y = 0;
      p.grounded = true;
    }

    p.pos.x += p.vel.x * dt;
    p.pos.z += p.vel.z * dt;
    p.collide(this.boxesNear(p.pos));
    // dal portone non si esce: il sogno continua qui dentro
    p.pos.x = clamp(p.pos.x, X0 + 0.6, X0 + NW - 0.6);
    p.pos.z = clamp(p.pos.z, 0.9, Z0 + NH - 0.6);

    // pistola
    this.shotCd -= dt;
    if (this.reloadT > 0) {
      this.reloadT -= dt;
      if (this.reloadT <= 0) this.ammo = 30;
    }
    if (aiming && active) {
      if (input.wasPressed('KeyR')) this.reload();
      if ((input.mouseHeld || input.down('KeyF')) && this.shotCd <= 0) this.fire();
    }

    const hs = Math.hypot(p.vel.x, p.vel.z);
    p.animate(dt, hs, cling);

    if (this.phase === 'fight') {
      if (cling > 0) this.health = Math.max(0, this.health - cling * 0.0016 * dt);
      else this.health = Math.min(1, this.health + 0.05 * dt);
      if (this.health <= 0) this.overwhelmed();
    }

    // stanze scoperte
    const room = roomAt(this.layout, p.pos.x, p.pos.z);
    if (room >= 0 && !this.visited.has(room)) {
      this.visited.add(room);
      const r = this.layout.rooms[room];
      this.ctx.ui.popup(r.styleDef.name);
      audio.chime(740 + this.visited.size * 12, 0.08);
      const line = ROOM_LINES[r.styleDef.key];
      if (line && this.lineTimer <= 0 && this.phase === 'explore' && Math.random() < 0.7) {
        this.ctx.ui.subtitle(FRIEND, line, 2.8);
        this.lineTimer = 6;
      }
      this.save();
    }
  }

  stomp() {
    const p = this.player;
    let n = this.swarm.shockwave(p.pos.x, p.pos.z, 4, 12);
    n += this.swarm.shakeOff(0, 0.85);
    if (Math.hypot(this.friend.pos.x - p.pos.x, this.friend.pos.z - p.pos.z) < 3) n += this.swarm.shakeOff(1, 0.8);
    this.addKills(Math.round(n * 0.3));
    this.ctx.audio.thud(0.5);
    this.fx.burst(p.pos.x, 0.1, p.pos.z, 24, 5, { color: [0.7, 0.62, 0.5], size: 0.5, endSize: 1.6, life: 0.8, drag: 3, alpha: 0.45 }, 0.5);
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
    this.flowTimer -= dt;
    const pRoom = roomAt(this.layout, p.pos.x, p.pos.z);
    const fRoom = roomAt(this.layout, f.pos.x, f.pos.z);
    const suiteCalm = pRoom === this.suite.id && fRoom === this.suite.id && this.phase === 'explore';
    if (f.sitting) {
      // resta seduto finché siete tranquilli nella suite
      if (this.activity || suiteCalm || this.phase === 'sleeping') {
        f.vel.set(0, 0, 0);
        f.animate(dt, 0, 0);
        return;
      }
      f.sitting = false;
    }
    const d = Math.hypot(p.pos.x - f.pos.x, p.pos.z - f.pos.z);
    let tx = 0;
    let tz = 0;
    let speed = 0;
    const clung = this.swarm.clinging[1];
    if (this.phase === 'fight' || this.phase === 'down') {
      if (d > 3) {
        this.refreshFlowP();
        [tx, tz] = this.flowDir(this.flowP, f.pos);
        speed = Math.min(8, 3 + d * 0.6) * Math.max(0.3, 1 - clung * 0.02);
      }
      // l'amico spara da solo, al più vicino
      this.friendShotCd = (this.friendShotCd || 0) - dt;
      if (this.friendShotCd <= 0) {
        const i = this.swarm.nearest(f.pos.x, f.pos.z, 16);
        if (i >= 0) {
          this.friendShotCd = 0.32;
          const gx = this.swarm.x[i];
          const gz = this.swarm.z[i];
          f.facing = Math.atan2(gx - f.pos.x, gz - f.pos.z);
          const muzzle = f.muzzleWorld(new THREE.Vector3());
          this.tracers.add(muzzle, new THREE.Vector3(gx, 0.15, gz), [1, 0.9, 0.6]);
          this.poof([{ x: gx, y: 0.15, z: gz }]);
          this.swarm.eliminate(i);
          this.ctx.audio.shot(0.1);
        }
      }
      if (clung > 25 && !this.flags.friendStuck) {
        this.flags.friendStuck = true;
        this.ctx.ui.subtitle(FRIEND, 'Mi sono addosso! Vieni qui e salta!', 2.4);
      } else if (clung < 5) this.flags.friendStuck = false;
    } else if (suiteCalm) {
      // nella suite l'amico si mette comodo in poltrona
      const a = this.suiteKit.armchair;
      const dd = Math.hypot(a.pos.x - f.pos.x, a.pos.z - f.pos.z);
      if (dd > 0.4) {
        tx = (a.pos.x - f.pos.x) / dd;
        tz = (a.pos.z - f.pos.z) / dd;
        speed = 2.6;
      } else if (!this.activity) {
        f.pos.copy(a.pos);
        f.facing = a.facing;
        f.sitting = true;
        this.friendSatAt = this.time;
      }
    } else if (d > 6 || !this.goal) {
      if (d > 3) {
        this.refreshFlowP();
        [tx, tz] = this.flowDir(this.flowP, f.pos);
        speed = Math.min(8, 3.5 + d * 0.4);
      }
    } else {
      // ti fa strada verso l'obiettivo, ma ti aspetta
      const gd = this.flowGoal.distAt(f.pos.x, f.pos.z);
      const pd = this.flowGoal.distAt(p.pos.x, p.pos.z);
      if (gd > 3 && gd > pd - 5) {
        [tx, tz] = this.flowDir(this.flowGoal, f.pos);
        speed = 4.6;
      }
    }
    // se l'amico è seduto in poltrona e ti allontani, si alza
    const k = 1 - Math.exp(-8 * dt);
    f.vel.x += (tx * speed - f.vel.x) * k;
    f.vel.z += (tz * speed - f.vel.z) * k;
    f.pos.x += f.vel.x * dt;
    f.pos.z += f.vel.z * dt;
    f.collide(this.boxesNear(f.pos));
    f.pos.z = Math.max(f.pos.z, 0.9);
    const hs = Math.hypot(f.vel.x, f.vel.z);
    if (hs > 0.3 && this.phase !== 'fight') {
      const want = Math.atan2(f.vel.x, f.vel.z);
      let dd = want - f.facing;
      dd = Math.atan2(Math.sin(dd), Math.cos(dd));
      f.facing += dd * (1 - Math.exp(-10 * dt));
    }
    if (d > 30 && this.phase !== 'sleeping') {
      f.pos.set(p.pos.x - Math.sin(p.facing) * 1.5, 0, p.pos.z - Math.cos(p.facing) * 1.5);
      this.swarm.shakeOff(1, 1);
    }
    f.animate(dt, hs, clung);
  }

  refreshFlowP() {
    if (this.flowTimer > 0) return;
    this.flowTimer = 0.3;
    this.flowP.compute(this.player.pos.x, this.player.pos.z);
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
    const p = this.player;
    this.swarmFlowT = (this.swarmFlowT || 0) - dt;
    if (this.swarmFlowT <= 0) {
      this.swarmFlowT = 0.3;
      this.flowP.compute(p.pos.x, p.pos.z);
      this.flowF.compute(this.friend.pos.x, this.friend.pos.z);
      this.flowTimer = 0.3;
    }
    this.swarm.update(dt, this.time, [this.player, this.friend], [this.flowP, this.flowF]);
    const near = this.swarm.countNear(p.pos.x, p.pos.z, 8) + this.swarm.clinging[0] * 2;
    if (Math.random() < Math.min(0.9, near / 60)) audio.squeak(0.03 + Math.min(0.06, near / 1500));
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
    const cling = this.swarm.clinging[0];
    const aiming = p.armed && this.phase === 'fight';
    const room = roomAt(this.layout, p.pos.x, p.pos.z);
    const ceil = room >= 0 ? this.layout.rooms[room].height - 0.4 : 30;
    const inSuite = room === this.suite.id;
    let target;
    let look;
    if (aiming) {
      // sopra la spalla: il mirino al centro dello schermo è dove vanno i colpi
      const pitch = this.camPitch - 0.25;
      const lx = Math.sin(this.camYaw) * Math.cos(pitch);
      const ly = -Math.sin(pitch);
      const lz = Math.cos(this.camYaw) * Math.cos(pitch);
      const rx = -Math.cos(this.camYaw);
      const rz = Math.sin(this.camYaw);
      const dist = 3 + Math.min(2, cling * 0.03);
      target = new THREE.Vector3(head.x + rx * 0.75 - lx * dist, head.y + 0.35 - ly * dist, head.z + rz * 0.75 - lz * dist);
      target.y = clamp(target.y, 0.4, ceil);
      look = new THREE.Vector3(target.x + lx * 20, target.y + ly * 20, target.z + lz * 20);
    } else {
      const dist = (inSuite ? 3.6 : 4.6) + Math.min(2.5, cling * 0.035);
      const pitch = Math.min(1.2, this.camPitch + cling * 0.006);
      const dx = -Math.sin(this.camYaw) * Math.cos(pitch);
      const dz = -Math.cos(this.camYaw) * Math.cos(pitch);
      const dy = Math.sin(pitch);
      let reach = dist;
      for (let s = 0.3; s <= dist; s += 0.2) {
        const x = head.x + dx * s;
        const z = head.z + dz * s;
        if (this.swarm.isBlocked(x, z) && this.isWallAt(x, z)) {
          reach = Math.max(0.6, s - 0.35);
          break;
        }
      }
      target = new THREE.Vector3(head.x + dx * reach, Math.min(ceil, head.y + dy * reach + 0.2), head.z + dz * reach);
      look = new THREE.Vector3(head.x, head.y - 0.1, head.z);
    }
    if (snap) {
      this.camPos.copy(target);
      this.camLookAt.copy(look);
    } else {
      this.camPos.lerp(target, 1 - Math.exp(-(aiming ? 20 : 12) * dt));
      this.camLookAt.lerp(look, 1 - Math.exp(-(aiming ? 30 : 16) * dt));
    }
    this.camera.position.copy(this.camPos);
    this.camera.lookAt(this.camLookAt);
  }

  isWallAt(x, z) {
    for (const b of this.boxesNear({ x, z })) {
      if (b.dir && x > b.minX - 0.15 && x < b.maxX + 0.15 && z > b.minZ - 0.15 && z < b.maxZ + 0.15) return true;
    }
    return false;
  }

  updateCompass(room) {
    const { ui } = this.ctx;
    const show = this.goal && !(this.goal === 'suite' && room === this.suite.id) && !(this.goal === 'hall' && room === 0) && this.phase === 'explore';
    if (!show) {
      ui.compass(null);
      return;
    }
    const [fx, fz] = this.flowDir(this.flowGoal, this.player.pos);
    if (!fx && !fz) {
      ui.compass(null);
      return;
    }
    ui.compass(-(Math.atan2(fx, fz) - this.camYaw));
  }

  onResize() {
    this.fx.setScale(this.ctx.renderer, this.camera);
    this.glints.setScale(this.ctx.renderer, this.camera);
  }

  dispose() {
    this.disposed = true;
    const { ui, audio, renderer, input } = this.ctx;
    if (this.phase !== 'fight') this.save();
    renderer.domElement.removeEventListener('click', this.onCanvasClick);
    input.unlock();
    audio.stopAllPads(1);
    audio.stopLoops();
    ui.hint(null);
    ui.center(null);
    ui.clearSubtitle();
    ui.objective('');
    ui.compass(null);
    ui.crosshair(false);
    ui.steam(false);
    ui.calm(false);
    this.rb.dispose();
    this.player.dispose();
    this.friend.dispose();
    this.swarm.dispose();
    this.fx.dispose();
    this.glints.dispose();
    this.tracers.dispose();
    this.flash.material.dispose();
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


