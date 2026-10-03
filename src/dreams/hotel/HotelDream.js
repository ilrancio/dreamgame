import * as THREE from 'three';
import { Particles } from '../../core/particles.js';
import { clamp, lerp, mulberry32 } from '../../core/noise.js';
import { buildLayout, roomAt, FlowField, CELL, COLS, ROWS, X0, Z0, NW, NH, ENTRANCE_W } from './layout.js';
import { RoomBuilder, STYLES, LOBBY_STYLE, SUITE_STYLE, CORRIDOR_STYLE, BATH_STYLE } from './rooms.js';
import { DoorSystem } from './doors.js';
import { Character } from './character.js';
import { GnomeSwarm } from './gnomes.js';
import { buildSuite } from './suite.js';
import { Tracers } from './tracers.js';
import { ALL_STYLES, architectureFor, styleByKey, corridorStyle } from './architectures.js';
import { buildElevatorDoors, ElevatorPanel, ARCADE_FLOOR, label as floorLabel, rideSequence } from './elevator.js';
import { arcadeLayout, buildArcade, ARCADE_STYLE } from './arcade.js';
import { ArcadeScreen, GAMES } from './games.js';
import { PRIZES, prizeById } from './prizes.js';
import { EventDirector } from './events.js';
import { ENTITIES, UNKNOWN_SLOTS, GnomeFollowers, entityLabel } from './companions.js';
import { glowTexture, textTexture } from '../../core/textures.js';
import { unlockedPlaces } from '../../core/places.js';
import { ChoicePanel } from '../../core/choice.js';
import { GestureScreen, recordGesture, gestureSfx } from '../../core/gestures.js';

const FRIEND = 'Il tuo amico:';
const CONCIERGE = 'Il concierge:';

// Il giro che fa il concierge per portarti alla suite 1313, che in realtà è
// proprio accanto alla hall. Ogni tappa può avere una battuta.
const CONCIERGE_ROUTE = [
  [0, 23.2, 'Buonasera. Suite 1313? La accompagno io. Mi segua, prego.'],
  [-10, 16],
  [-17, 16, 'La suite è un po\'... fuori mano.'],
  [-30, 16],
  [-38, 16],
  [-38, 40, 'Da questa parte. Sempre dritto.'],
  [-38, 66],
  [-24, 66, 'Di qua. No. Un attimo.'],
  [-38, 66, 'Di là. Sì. Decisamente di là.'],
  [-38, 98, 'Questo corridoio l\'hanno allungato l\'anno scorso.'],
  [0, 98],
  [38, 98, 'Quasi arrivati. Credo.'],
  [38, 70],
  [38, 42, 'Il 1313 è sempre l\'ultima porta. Sempre.'],
  [38, 38],
  [26, 38],
  [21.5, 38.4, 'Ecco a lei. Suite 1313. Buon riposo.'],
];

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
const COFFEE_TALK = [
  [FRIEND, 'Il caffè della moka ha un altro sapore. Sa di cucina, di domenica mattina.'],
  [FRIEND, 'Mia nonna diceva che la moka non si lava col sapone. Mai.'],
  [FRIEND, 'Quando lo bevo così piano mi sembra che il sogno rallenti.'],
  [FRIEND, 'Un caffè alle tre di notte, in un hotel infinito. Perfettamente normale.'],
];

// Cosa si dice dopo un gesto, dal disastro (0) al perfetto (3).
const GESTURE_REACT = {
  te: [
    [FRIEND, 'Uhm... lo bevo lo stesso. È il pensiero che conta.'],
    [FRIEND, 'Va bene così, davvero.'],
    [FRIEND, 'Buono. Grazie.'],
    [FRIEND, 'Perfetto. Proprio come piace a me.'],
  ],
  moka: [
    [FRIEND, '...è caffè, tecnicamente. Apro la finestra?'],
    [FRIEND, 'Si beve. Su, andiamo al tavolino.'],
    [FRIEND, 'Ah, che profumo. Porta le tazzine.'],
    [FRIEND, 'Questo è un caffè vero. Come a casa.'],
  ],
  doccia: [
    [null, 'Più bagnato che pulito. Ma l\'acqua calda alla fine arriva.'],
    [null, 'Un brivido, poi il tepore. I pensieri scivolano via.'],
    [null, 'L\'acqua è calda. I pensieri scivolano via.'],
    [null, 'Acqua perfetta, vapore ovunque. Potresti restare qui per sempre.'],
  ],
};

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

    this.floorNum = 0;
    this.timers = [];
    this.dim = 0;
    this.stretch = 0;
    this.snow = 0;
    this.load();

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
    this.flashTex = glowTexture('rgba(255,255,255,1)');
    this.flash = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.flashTex, color: '#ffd080', blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0 }));
    this.flash.scale.set(0.9, 0.9, 1);
    this.scene.add(this.flash);

    this.player = new Character(this.scene, { skin: '#e0b089', hair: '#3b2a1e', shirt: '#2f4f8f' });
    this.friend = new Character(this.scene, { skin: '#c99470', hair: '#141414', shirt: '#d9a82e' });
    this.friend.radius = 0.4;

    const noBlock = new Uint8Array(NW * NH);
    this.swarm = new GnomeSwarm(this.scene, noBlock, 2600);
    this.flowP = new FlowField(noBlock);
    this.flowF = new FlowField(noBlock);
    this.flowGoal = new FlowField(noBlock);
    this.elevatorPanel = new ElevatorPanel();
    this.arcadeScreen = new ArcadeScreen();
    this.choice = new ChoicePanel();
    this.gesture = new GestureScreen();
    this.events = new EventDirector(this);
    // il concierge: divisa bordeaux, berretto, sempre dietro la reception
    this.concierge = new Character(this.scene, { skin: '#d8a888', hair: '#9a9a9a', shirt: '#6a1020', pants: '#1a1a22' });
    const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.19, 0.12, 14), new THREE.MeshStandardMaterial({ color: '#4a0a14' }));
    cap.position.y = 0.16;
    this.concierge.head.add(cap);
    this.concierge.track(cap.geometry);
    this.concierge.track(cap.material);
    this.conciergeState = 'desk';
    this.loadFloor(0);
    this.goal = null;
    this.flowTimer = 0;

    this.camYaw = 0;
    this.camPitch = 0.25;
    this.camPos = new THREE.Vector3();
    this.camLookAt = new THREE.Vector3();

    this.onCanvasClick = () => ctx.input.lock();
    ctx.renderer.domElement.addEventListener('click', this.onCanvasClick);

    if (ctx.resumeHotel && this.saved?.reached && ctx.hotelEntry === 'door') this.enterFromDoor();
    else if (ctx.resumeHotel && this.saved?.reached && ctx.hotelEntry === 'shortcut') this.enterFromShortcut();
    else if (ctx.resumeHotel && this.saved?.reached) this.resume();
    else this.arrive();
    ctx.hotelEntry = null;
    this.followers = null;
    this.idleT = 0;
    if (this.activeEntity) this.setCompanion(this.activeEntity, true);
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
      else if (room.bath) room.styleDef = BATH_STYLE;
      else if (room.corridor) room.styleDef = CORRIDOR_STYLE;
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
      else if (room.kind === 'room') {
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
    let suiteApi = null;
    let bathApi = null;
    for (const room of L.rooms) {
      const api = rb.build(room, room.styleDef);
      if (room.lobby) this.buildLobby(api);
      if (room.suite) suiteApi = api;
      if (room.bath) bathApi = api;
    }
    if (suiteApi) {
      this.suiteKit = buildSuite(suiteApi, bathApi, rb);
      this.suite = suiteApi.room;
      this.bathRoom = bathApi.room;
    }
    rb.numberPlates(this.numbers);
    rb.mergeStatic();
    this.suiteKit?.setPrizes(this.prizes);
    this.suiteKit?.setEntities(this.entities, this.activeEntity);
    this.suiteKit?.setShortcuts(unlockedPlaces(this.ctx.progress));
    this.makeBuckets();
  }

  // secchi di collisione per cella: il giocatore controlla solo quelli vicini
  makeBuckets() {
    this.buckets = new Map();
    for (const b of this.rb.colliders) {
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
    for (let s = 0; s < 14; s++) a.box(4, 0.6, 1.1, wood, -a.hw + 3, 0.3 + s * 0.65, 2 + s * 1.1, { collide: s < 2 });
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

    // ascensori ai lati del portone: da fuori tre piani, dentro centinaia
    const south = -a.room.cz + 0.5;
    this.elevators = [-11, 11].map((x) => buildElevatorDoors(a, x, south, 0, 'T'));
    const dirTex = a.track(textTexture('ASCENSORI\nPiano 88 · Sala giochi', { width: 512, height: 200, font: '600 44px Cormorant Garamond, serif', color: '#f4e2b8', bg: '#2a1a10' }));
    const dir = new THREE.Mesh(a.track(new THREE.PlaneGeometry(2.6, 1)), a.track(new THREE.MeshStandardMaterial({ map: dirTex, emissive: '#ffffff', emissiveMap: dirTex, emissiveIntensity: 0.4 })));
    dir.position.set(a.cx - 15.5, 2.4, south + 0.3);
    this.rb.dynamic.add(dir);
  }

  // ---------- Piani ----------
  // Costruisce il piano richiesto e smonta quello precedente.
  loadFloor(n) {
    if (this.rb) {
      this.rb.dispose();
      this.floorExtra?.dispose();
    }
    this.floorExtra = null;
    this.floorNum = n;
    this.suite = null;
    this.suiteKit = null;
    this.bellPos = null;
    this.bellGlow = null;
    this.outsideMat = null;
    this.exitGlow = null;
    this.arcade = null;
    this.arch = null;
    this.bathRoom = null;
    this.elevators = [];
    if (n === 0) {
      this.layout = buildLayout(1313);
      this.rb = new RoomBuilder(this.scene, this.layout);
      this.assignRooms();
      this.buildRooms();
    } else if (n === ARCADE_FLOOR) {
      this.layout = arcadeLayout();
      this.layout.rooms[0].styleDef = ARCADE_STYLE;
      this.rb = new RoomBuilder(this.scene, this.layout);
      this.arcade = buildArcade(this.rb, this.layout, this.scene);
      this.floorExtra = this.arcade;
      this.elevators = [this.arcade.elevator];
      this.makeBuckets();
    } else this.buildGenericFloor(n);
    this.doors = new DoorSystem(this.rb, this.layout);
    const service = this.doors.list.find((d) => d.kind === 'service');
    if (service && this.serviceOpen) this.doors.setLocked(Object.assign(service, { auto: true }), false);
    this.concierge.group.visible = n === 0;
    this.swarm.blocked = this.layout.blocked;
    for (const f of [this.flowP, this.flowF, this.flowGoal]) f.blocked = this.layout.blocked;
    this.flowTimer = 0;
    this.recomputeGoal();
    if (this.timeOfDay) this.applyTime();
  }

  buildGenericFloor(n) {
    const arch = architectureFor(n);
    this.arch = arch;
    this.layout = buildLayout(5000 + n, { entrance: false, suite: false });
    this.rb = new RoomBuilder(this.scene, this.layout);
    const rand = mulberry32(n * 31 + 7);
    const numbers = {};
    for (const room of this.layout.rooms) {
      if (room.lobby) {
        room.styleDef = { key: `atrio-${arch.key}`, name: `Atrio · ${arch.name}`, noDefaultLamp: true, ...arch.hall };
        continue;
      }
      if (room.corridor) {
        room.styleDef = corridorStyle(arch);
        continue;
      }
      // quasi sempre lo stile del piano; ogni tanto una stanza intrusa da un altro mondo
      const key = rand() < 0.85 ? arch.rooms[Math.floor(rand() * arch.rooms.length)] : ALL_STYLES[Math.floor(rand() * ALL_STYLES.length)].key;
      room.styleDef = styleByKey(key);
      numbers[room.id] = `${n}${String(10 + room.id).padStart(2, '0')}`;
    }
    for (const room of this.layout.rooms) {
      const api = this.rb.build(room, room.styleDef);
      if (!room.lobby) continue;
      arch.hallProps(api);
      const south = -room.cz + 0.5;
      this.elevators = [-11, 11].map((x) => buildElevatorDoors(api, x, south, 0, floorLabel(n)));
      const tex = api.track(textTexture(`PIANO ${n}`, { width: 512, height: 128, font: '700 84px Inter, sans-serif', color: '#f4efe6', bg: 'rgba(0,0,0,0)' }));
      const sign = new THREE.Mesh(api.track(new THREE.PlaneGeometry(6, 1.5)), api.track(new THREE.MeshBasicMaterial({ map: tex, transparent: true })));
      sign.position.set(room.cx, Math.min(6, room.styleDef.height - 1.5), room.maxZ - 0.55);
      sign.rotation.y = Math.PI;
      this.rb.dynamic.add(sign);
    }
    this.rb.numberPlates(numbers);
    this.rb.mergeStatic();
    this.makeBuckets();
  }

  get suiteId() {
    return this.suite ? this.suite.id : -99;
  }

  // La suite comprende il suo bagno.
  isSuiteRoom(room) {
    return room >= 0 && (room === this.suiteId || (this.bathRoom && room === this.bathRoom.id));
  }

  // Siamo nella hall del piano terra?
  inHall(room) {
    return this.floorNum === 0 && room === 0;
  }

  // ---------- Memoria del sogno (salvataggio locale) ----------
  load() {
    const s = this.ctx.progress.hotel || {};
    this.saved = s;
    this.dayNum = s.dayNum || 0;
    this.gnomesTotal = s.gnomesTotal || 0;
    this.visited = new Set(s.visited || [0]);
    this.hasKey = !!s.hasKey;
    this.tickets = s.tickets || 0;
    this.serviceOpen = !!s.serviceOpen;
    this.entities = s.entities || {};
    this.activeEntity = s.activeEntity || null;
    this.prizes = s.prizes || [];
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
      tickets: this.tickets,
      serviceOpen: this.serviceOpen,
      entities: this.entities,
      activeEntity: this.activeEntity,
      prizes: this.prizes,
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

  // Si torna da un luogo del sogno attraverso una porta 1313: si esce dalla
  // porta verde della suite, come se fosse sempre stata lì.
  enterFromShortcut() {
    const s = this.saved;
    const { ui } = this.ctx;
    this.resume();
    const k = this.suiteKit;
    const p = this.player;
    p.pos.set(k.shortcutSpot.x - 0.4, 0, k.shortcutSpot.z);
    p.vel.set(0, 0, 0);
    p.facing = -Math.PI / 2;
    this.camYaw = -Math.PI / 2;
    this.friend.pos.set(k.shortcutSpot.x - 1.6, 0, k.shortcutSpot.z - 1.2);
    this.friend.sitting = false;
    this.snapCamera();
    this.ctx.audio.thud(0.15);
    const day = s.timeOfDay === 'day';
    this.script = [{ at: this.time + 1.2, fn: () => ui.subtitle(FRIEND, day && !s.hallCleared ? 'Casa. ...Le pistole sono ancora sul tavolino.' : 'Casa. Non mi abituerò mai a questa porta.', 3) }];
  }

  // Si rientra dal portone dopo una passeggiata fuori: si è nella hall.
  enterFromDoor() {
    const s = this.saved;
    const { ui, audio } = this.ctx;
    this.resetCommon();
    if (s.timeOfDay === 'day' && !s.hallCleared) {
      // il mattino degli gnomi non è passato: le pistole aspettano nella suite
      this.startMorning(false);
      audio.stopAllPads(1);
      audio.loop('fire', false);
    } else {
      this.timeOfDay = s.timeOfDay || 'night';
      this.hallCleared = s.hallCleared ?? true;
    }
    this.hasKey = !!s.hasKey;
    this.player.pos.set(0, 0, 2.4);
    this.player.vel.set(0, 0, 0);
    this.player.facing = 0;
    this.friend.pos.set(1.6, 0, 2);
    this.camYaw = 0;
    this.camPitch = 0.25;
    this.applyTime();
    this.snapCamera();
    if (this.timeOfDay === 'night') audio.pad('hotel', [98, 146.8, 196, 246.9], { vol: 0.04, cutoff: 1100 });
    if (!this.hasKey) {
      this.setGoal('bell');
      ui.objective('Suona il campanello della reception.');
    } else if (this.timeOfDay === 'day' && !this.hallCleared) {
      this.setGoal('suite');
      ui.objective('Le pistole sono rimaste sul tavolino della suite.');
    } else {
      this.setGoal(null);
      ui.objective(this.timeOfDay === 'night' ? 'Torna nella suite, quando vuoi.' : 'L\'hotel è vostro. Fuori, il borgo in vetta.');
    }
    this.script = [{ at: this.time + 1.4, fn: () => ui.subtitle(FRIEND, this.timeOfDay === 'night' ? 'Ah, il caldo del legno. Si sta bene, dentro.' : 'Rieccoci. L\'atrio sembra ancora più grande, dopo l\'aria di fuori.', 3.2) }];
    this.save();
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
    if (this.suiteKit) this.suiteKit.guns.visible = false;
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
    this.recomputeGoal();
  }

  recomputeGoal() {
    const kind = this.goal;
    if (!kind) return;
    if (this.floorNum !== 0) {
      // gli obiettivi sono al piano terra: la strada passa dall'ascensore
      const e = this.elevators[0];
      if (e) this.flowGoal.compute(e.spot.x, e.spot.z);
      return;
    }
    if (kind === 'bell') this.flowGoal.compute(this.bellPos.x, this.bellPos.z);
    else if (kind === 'suite') this.flowGoal.compute(this.suite.cx, this.suite.cz);
    else if (kind === 'hall') this.flowGoal.compute(0, 14);
  }

  // Luci, finestre e musica in base all'ora del sogno.
  applyTime() {
    const day = this.timeOfDay === 'day';
    this.hemi.intensity = day ? 1.6 : 1.1;
    this.hemiBase = this.hemi.intensity;
    this.outsideMat?.color.set(day ? '#fff6e0' : '#141c38');
    if (this.exitGlow) this.exitGlow.material.opacity = day ? 0.9 : 0.15;
    this.suiteKit?.setDay(day);
    this.suiteKit?.setLamp(!day);
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
        ['Un tè (o un caffè) con il tuo amico, al tavolino', this.ritual.tea],
        ['Una doccia calda, o un bagno in vasca', this.ritual.shower],
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
    ui.popup('Chiave 1313');
    ui.objective('Segui il concierge fino alla suite 1313.');
    this.setGoal('suite');
    this.bellGlow.material.opacity = 0;
    this.startConcierge();
    this.save();
  }

  // ---------- Il concierge ----------
  startConcierge() {
    this.conciergeState = 'lead';
    this.cIdx = 0;
    this.cLineT = 0;
    this.concierge.pos.set(0, 0, 25.4);
    this.concierge.group.visible = this.floorNum === 0;
  }

  updateConcierge(dt) {
    const c = this.concierge;
    if (this.floorNum !== 0) return;
    const { ui } = this.ctx;
    const p = this.player.pos;
    let speed = 0;
    this.cLineT = (this.cLineT || 0) - dt;
    const st = this.conciergeState;
    if (st === 'desk') {
      c.pos.set(0, 0, 28.3);
      c.facing = Math.PI;
    } else if (st === 'lead') {
      // se entri nella suite da solo, il concierge ti raggiunge alla porta
      if (this.isSuiteRoom(roomAt(this.layout, p.x, p.z))) this.cIdx = CONCIERGE_ROUTE.length - 1;
      const [tx, tz, line] = CONCIERGE_ROUTE[this.cIdx];
      const dp = Math.hypot(p.x - c.pos.x, p.z - c.pos.z);
      if (dp > 9 && this.cIdx > 0) {
        // ti aspetta, e si gira verso di te
        c.facing = Math.atan2(p.x - c.pos.x, p.z - c.pos.z);
        if (this.cLineT <= 0) {
          ui.subtitle(CONCIERGE, ['Prego, da questa parte.', 'Mi segua, non si perda.', 'Di qua, di qua.'][Math.floor(Math.random() * 3)], 2.4);
          this.cLineT = 7;
        }
      } else {
        const dx = tx - c.pos.x;
        const dz = tz - c.pos.z;
        const d = Math.hypot(dx, dz);
        if (d < 0.35) {
          if (line) {
            ui.subtitle(CONCIERGE, line, 3.2);
            this.cLineT = 4;
          }
          if (this.cIdx === 10) this.later(3.5, () => ui.subtitle(FRIEND, 'Ma la 1313... non era proprio dietro la reception?', 3));
          this.cIdx++;
          if (this.cIdx >= CONCIERGE_ROUTE.length) {
            this.conciergeState = 'bow';
            this.cT = 0;
          }
        } else {
          speed = 3.3;
          c.pos.x += (dx / d) * speed * dt;
          c.pos.z += (dz / d) * speed * dt;
          const want = Math.atan2(dx, dz);
          let dd = want - c.facing;
          dd = Math.atan2(Math.sin(dd), Math.cos(dd));
          c.facing += dd * (1 - Math.exp(-10 * dt));
        }
      }
    } else if (st === 'bow') {
      this.cT += dt;
      c.facing = Math.atan2(p.x - c.pos.x, p.z - c.pos.z);
      c.body.rotation.x = this.cT < 1.2 ? Math.sin((this.cT / 1.2) * Math.PI) * 0.45 : 0;
      if (this.cT > 4.5 && !this.flags.cBye) {
        this.flags.cBye = true;
        ui.subtitle(CONCIERGE, 'Se ha bisogno, la reception è sempre aperta. È più vicina di quanto sembri.', 3.6);
      }
      if (this.cT > 8) {
        this.conciergeState = 'leave';
        this.cT = 0;
      }
    } else if (st === 'leave') {
      // se ne va lungo il corridoio... e ricompare dietro la reception
      this.cT += dt;
      speed = 3;
      c.facing = Math.PI / 2;
      c.pos.x += speed * dt;
      if (this.cT > 4) this.conciergeState = 'desk';
    }
    if (st !== 'bow') c.body.rotation.x = 0;
    c.animate(dt, speed, 0);
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
      this.startGesture('te');
      this.activity.cam = k.teaCam.clone();
      this.activity.look = k.teaLook.clone();
      this.activity.duration = 16;
    } else if (kind === 'shower') {
      p.pos.copy(k.shower);
      p.facing = -Math.PI / 2;
      this.activity.cam = k.showerCam.clone();
      this.activity.look = k.shower.clone().add(new THREE.Vector3(0, 1.3, 0));
      this.activity.duration = 7;
      audio.loop('water', true, { freq: 2600, q: 0.5, vol: 0.09 });
      this.startGesture('doccia');
    } else if (kind === 'moka') {
      p.pos.copy(k.mokaSpot);
      p.facing = k.mokaFacing;
      this.activity.cam = k.mokaCam.clone();
      this.activity.look = k.mokaLook.clone();
      this.activity.duration = 4.5;
      this.startGesture('moka');
    } else if (kind === 'coffee') {
      // la moka è pronta: si beve al tavolino, insieme
      p.pos.copy(k.chairs[0].pos);
      p.facing = k.chairs[0].facing;
      p.sitting = true;
      this.friend.pos.copy(k.chairs[1].pos);
      this.friend.facing = k.chairs[1].facing;
      this.friend.sitting = true;
      this.activity.lines = [...COFFEE_TALK].sort(() => Math.random() - 0.5).slice(0, 2);
      this.activity.cam = k.teaCam.clone();
      this.activity.look = k.teaLook.clone();
      this.activity.duration = 11;
    } else if (kind === 'bath') {
      p.pos.copy(k.tub);
      p.pos.y = 0.18;
      p.facing = Math.PI / 2;
      p.sitting = true;
      this.activity.cam = k.tubCam.clone();
      this.activity.look = k.tub.clone().add(new THREE.Vector3(0, 0.7, 0));
      this.activity.duration = 999;
      audio.loop('water', true, { freq: 900, q: 0.4, vol: 0.03, type: 'lowpass' });
      ui.subtitle(null, 'L\'acqua calda fino al mento. Fuori, da qualche parte, l\'hotel continua a crescere.', 5);
    } else if (kind === 'sink') {
      p.pos.copy(k.sink);
      p.facing = -Math.PI / 2;
      this.activity.cam = k.sinkCam.clone();
      this.activity.look = k.sinkLook.clone();
      this.activity.duration = 6;
      audio.loop('water', true, { freq: 1800, q: 0.6, vol: 0.05 });
      ui.subtitle(null, 'Acqua fredda sul viso. Nello specchio, per un attimo, dietro di te c\'è un corridoio che non esiste.', 5);
    } else if (kind === 'window') {
      p.pos.copy(k.windowSpot);
      p.facing = Math.PI;
      // in prima persona: guardi fuori con i tuoi occhi
      this.activity.cam = k.windowSpot.clone().add(new THREE.Vector3(0, 1.7, 0.2));
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

  // Un gesto (minigioco) all'inizio di un'attività: la scena resta dietro,
  // il tempo dell'attività riparte quando il gesto è finito.
  startGesture(key) {
    const { input, audio } = this.ctx;
    input.unlock();
    const prev = this.ctx.progress.gesti?.[key] ?? null;
    this.gesture.start(key, { sfx: gestureSfx(audio) }, (res) => {
      recordGesture(this.ctx, res);
      if (this.activity) this.activity.result = res;
      this.reactToGesture(res);
    }, prev);
  }

  reactToGesture(res) {
    const { ui } = this.ctx;
    if (res.skipped) return;
    const lines = GESTURE_REACT[res.key];
    if (!lines) return;
    const [who, text] = lines[res.grade];
    this.later(0.6, () => ui.subtitle(who, text, 3.6));
  }

  updateActivity(dt) {
    const { ui, audio, input } = this.ctx;
    const a = this.activity;
    if (this.gesture.open) {
      this.gesture.update(dt, input);
      this.camPos.lerp(a.cam, 1 - Math.exp(-2.5 * dt));
      this.camLookAt.lerp(a.look, 1 - Math.exp(-3 * dt));
      this.camera.position.copy(this.camPos);
      this.camera.lookAt(this.camLookAt);
      this.player.animate(dt, 0);
      return;
    }
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
        for (const c of k.cups) this.fx.emit(c.x, 0.9, c.z, (Math.random() - 0.5) * 0.05, 0.25, 0, { color: [0.95, 0.95, 0.95], size: 0.08, endSize: 0.3, life: 2.2, alpha: 0.25 });
      }
      a.lines.forEach(([who, text], i) => {
        const at = 4 + i * 4.3;
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
    } else if (a.kind === 'bath') {
      if (Math.random() < 0.5) this.glints.emit(k.tub.x + (Math.random() - 0.5) * 3, 0.56, k.tub.z + (Math.random() - 0.5) * 1.1, 0, 0.12, 0, { color: [0.95, 0.97, 1], size: 0.1 + Math.random() * 0.1, life: 3, alpha: 0.6 });
      if (Math.random() < 0.2) this.fx.emit(k.tub.x + (Math.random() - 0.5) * 3, 0.7, k.tub.z, 0, 0.3, 0, { color: [0.95, 0.96, 1], size: 0.5, endSize: 1.8, life: 4, alpha: 0.15 });
      if (a.t > 3) ui.steam(true);
      if (a.t > 1) this.ritual.shower = true;
    } else if (a.kind === 'moka') {
      if (Math.random() < 0.35) this.fx.emit(k.mokaPot.x, k.mokaPot.y, k.mokaPot.z, (Math.random() - 0.5) * 0.05, 0.3, 0, { color: [0.95, 0.95, 0.95], size: 0.06, endSize: 0.3, life: 2, alpha: 0.3 });
    } else if (a.kind === 'coffee') {
      if (Math.random() < 0.25) for (const c of k.cups) this.fx.emit(c.x, 0.9, c.z, (Math.random() - 0.5) * 0.05, 0.25, 0, { color: [0.95, 0.95, 0.95], size: 0.07, endSize: 0.25, life: 2, alpha: 0.25 });
      a.lines.forEach(([who, text], i) => {
        const at = 1.5 + i * 4.3;
        if (a.t > at && !a[`l${i}`]) {
          a[`l${i}`] = true;
          ui.subtitle(who, text, 3.8);
        }
      });
      if (a.t > 1) this.ritual.tea = true;
    } else if (a.kind === 'sink') {
      if (a.t < 3 && Math.random() < 0.7) this.glints.emit(k.sink.x - 0.85, 1.02, k.sink.z, 0, -1.2, 0, { color: [0.6, 0.8, 1], size: 0.03, life: 0.2, alpha: 0.7 });
    }
    // la camera va dolcemente in posizione
    this.camPos.lerp(a.cam, 1 - Math.exp(-2.5 * dt));
    this.camLookAt.lerp(a.look, 1 - Math.exp(-3 * dt));
    this.camera.position.copy(this.camPos);
    this.camera.lookAt(this.camLookAt);

    const wantsOut = a.t > 1.2 && (input.wasPressed('KeyE', 'Space') || input.down('KeyW', 'KeyS', 'KeyA', 'KeyD'));
    if (a.kind === 'moka' && a.t > a.duration) {
      // dalla credenza al tavolino, con le tazzine
      this.endActivity();
      this.startActivity('coffee');
      return;
    }
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
      // si esce dalla doccia verso il centro del bagno
      this.player.pos.set(this.suiteKit.shower.x - 2.4, 0, this.suiteKit.shower.z - 1.6);
    }
    if (a.kind === 'bath' || a.kind === 'sink') {
      audio.loop('water', false);
      if (a.kind === 'bath') {
        setTimeout(() => ui.steam(false), 1500);
        this.player.pos.set(this.suiteKit.tub.x, 0, this.suiteKit.tub.z + 1.8);
      } else this.player.pos.x += 0.6;
    }
    if (a.kind === 'fire') {
      audio.loop('fireClose', false);
      audio.loop('fire', true, { freq: 500, q: 0.4, vol: 0.025, type: 'lowpass', crackle: true });
      this.player.pos.x += 1.2;
    }
    if (a.kind === 'tea' || a.kind === 'coffee') this.player.pos.z += 1.3;
    if (a.kind === 'moka') this.player.pos.x += 0.8;
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
    this.collectEntity('gnomi');
    this.save();
  }

  // ---------- Creature collezionate ----------
  // Battere un'entità la aggiunge alla vetrina; ribatterla la fa crescere.
  collectEntity(id) {
    const { ui } = this.ctx;
    const e = ENTITIES.find((q) => q.id === id);
    const cur = this.entities[id] || 0;
    const next = e.tiers.find((t) => t > cur);
    if (!next) return;
    this.entities[id] = next;
    this.suiteKit?.setEntities(this.entities, this.activeEntity);
    if (this.activeEntity === id) this.followers?.setCount(next);
    this.later(7.5, () => {
      ui.popup(cur ? `${entityLabel(id, next)}!` : `Nuova creatura: ${entityLabel(id, next)}`);
      ui.subtitle(null, cur
        ? `Gli gnomi che restano non scappano più. Adesso sono ${next}, e aspettano nella vetrina della suite.`
        : 'Dieci gnomi non scappano. Si mettono in fila e ti guardano. Ti aspettano nella vetrina della suite.', 4.5);
    });
  }

  setCompanion(id, silent = false) {
    const { ui } = this.ctx;
    this.followers?.dispose();
    this.followers = null;
    this.activeEntity = id;
    if (id === 'gnomi' && this.entities.gnomi) {
      this.followers = new GnomeFollowers(this.scene, this.entities.gnomi);
      if (!silent) {
        ui.popup(`${entityLabel(id, this.entities.gnomi)} con te`);
        if (!this.flags.firstCompanion) {
          this.flags.firstCompanion = true;
          this.later(1.2, () => ui.subtitle(FRIEND, 'Degli gnomi che ci seguono. Va bene. Nessuno ci farà caso.', 3));
        }
      }
    } else this.activeEntity = null;
    this.suiteKit?.setEntities(this.entities, this.activeEntity);
    this.save();
  }

  openBestiary() {
    this.ctx.input.unlock();
    this.bestiaryOpen = true;
    this.renderBestiary();
    document.getElementById('bestiary').classList.add('show');
  }

  renderBestiary() {
    const el = document.getElementById('bestiary');
    const rows = ENTITIES.map((e, i) => {
      const lvl = this.entities[e.id] || 0;
      if (!lvl) return `<div class="prize-row locked"><kbd>${i + 1}</kbd><span>???<small> · ${e.hint}</small></span></div>`;
      const on = this.activeEntity === e.id;
      return `<button class="prize-row${on ? ' active' : ''}" data-entity="${e.id}"><kbd>${i + 1}</kbd><span>${entityLabel(e.id, lvl)}<small> · ${e.origin}</small></span><b>${on ? 'con te' : 'prendi'}</b></button>`;
    });
    for (let k = 0; k < UNKNOWN_SLOTS; k++) rows.push('<div class="prize-row locked"><span>???<small> · una creatura di un sogno non ancora sognato</small></span></div>');
    el.innerHTML = `<div class="prize-panel bestiary">
      <h3>Vetrina delle creature</h3>
      <p class="prize-note">Le entità che hai battuto. Scegline una: ti seguirà ovunque.</p>
      <div class="prize-list">${rows.join('')}</div>
      <div class="elev-row">
        <button class="ghost" data-entity-none>Lascia tutti nella vetrina <kbd>0</kbd></button>
        <button class="ghost" data-close-bestiary>Chiudi <kbd>Esc</kbd></button>
      </div>
    </div>`;
    if (!this.bestiaryClick) {
      this.bestiaryClick = (ev) => {
        const b = ev.target.closest('[data-entity]');
        if (b) this.pickEntity(b.dataset.entity);
        if (ev.target.closest('[data-entity-none]')) this.pickEntity(null);
        if (ev.target.closest('[data-close-bestiary]')) this.closeBestiary();
      };
      el.addEventListener('click', this.bestiaryClick);
    }
  }

  pickEntity(id) {
    if (id && !this.entities[id]) return;
    if (id === this.activeEntity) id = null;
    this.setCompanion(id);
    if (!id) this.ctx.ui.popup('Tutti nella vetrina');
    this.renderBestiary();
  }

  bestiaryKeys(input) {
    ENTITIES.forEach((e, i) => {
      if (input.wasPressed(`Digit${i + 1}`, `Numpad${i + 1}`)) this.pickEntity(e.id);
    });
    if (input.wasPressed('Digit0', 'Numpad0')) this.pickEntity(null);
    if (input.wasPressed('Escape', 'KeyQ', 'KeyE')) this.closeBestiary();
  }

  // La porta verde della suite: porta dritta nei luoghi del sogno già visitati.
  openShortcuts(places) {
    this.ctx.input.unlock();
    this.choice.show({
      title: 'La porta dei luoghi',
      note: 'Ogni luogo del sogno che visitate aggiunge una targhetta. Dall\'altra parte, una porta con il numero 1313 vi riporta qui.',
      theme: 'doors',
      items: places.map((pl) => ({ label: pl.name, sub: pl.sub, value: pl.id, action: 'apri' })),
      onPick: (id) => this.travelTo(id),
    });
  }

  travelTo(id) {
    if (this.leaving) return;
    this.leaving = true;
    this.ctx.audio.whoosh(0.25);
    this.ctx.ui.hint(null);
    this.save();
    this.ctx.travel(id);
  }

  closeBestiary() {
    this.bestiaryOpen = false;
    document.getElementById('bestiary').classList.remove('show');
  }

  updateFollowers(dt, inSuite) {
    if (!this.followers) return;
    const p = this.player;
    const moving = Math.hypot(p.vel.x, p.vel.z) > 0.3;
    this.idleT = moving ? 0 : this.idleT + dt;
    // nella suite, quando ti fermi, vanno a sedersi davanti al camino
    let mode = 'follow';
    let spot = null;
    if (inSuite && this.suiteKit && (this.idleT > 2.5 || this.activity) && this.phase !== 'fight') {
      mode = 'gather';
      spot = { x: this.suiteKit.fireplace.x, z: this.suiteKit.fireplace.z, facing: 0 };
    }
    this.followers.update(dt, this.time, p, this.layout.blocked, mode, spot);
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
    const menus = this.elevatorPanel.open || this.arcadeScreen.open || this.prizeOpen || this.bestiaryOpen || this.choice.open || this.gesture.open;
    if (!menus && input.wasPressed('KeyP', 'Escape') && this.phase !== 'sleeping' && this.phase !== 'riding') {
      this.paused = !this.paused;
      ui.center(this.paused ? '<div class="panel pause"><h2>Pausa</h2><p><kbd>P</kbd> riprendi</p><p><kbd>M</kbd> audio on/off</p><p>Il sogno si salva da solo.</p></div>' : null);
    }
    if (input.wasPressed('KeyM')) audio.toggleMute();
    if (this.paused) return;

    this.time += dt;
    this.lineTimer -= dt;
    while (this.script.length && this.script[0].at <= this.time) this.script.shift().fn();
    this.timers = this.timers.filter((t) => {
      if (this.time < t.at) return true;
      t.fn();
      return false;
    });
    this.events.update(dt);
    if (this.elevatorPanel.open) this.elevatorPanel.handleKeys(input);
    if (this.arcadeScreen.open) this.arcadeScreen.update(dt, input);
    if (this.prizeOpen) this.prizeKeys(input);
    if (this.bestiaryOpen) this.bestiaryKeys(input);
    if (this.choice.open) this.choice.handleKeys(input);

    const room = roomAt(this.layout, this.player.pos.x, this.player.pos.z);
    const inSuite = this.isSuiteRoom(room);
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
      const active = (this.phase === 'explore' || this.phase === 'fight') && !menus;
      this.updatePlayer(dt, active);
      this.updateCamera(dt);
    }
    this.updateFriend(dt);
    this.updateConcierge(dt);
    this.updateFollowers(dt, inSuite);
    const actors = [this.player.pos, this.friend.pos];
    if (this.floorNum === 0 && this.conciergeState !== 'desk') actors.push(this.concierge.pos);
    this.doors.update(dt, actors);
    if (this.floorNum === 0 && inSuite && !this.serviceOpen && !this.flags.askService) {
      const sd = this.doors.list.find((d) => d.kind === 'service');
      if (sd && Math.hypot(sd.x - this.player.pos.x, sd.z - this.player.pos.z) < 5) {
        this.flags.askService = true;
        ui.subtitle(FRIEND, 'E quella porta laggiù? Dove porterà?', 3);
      }
    }
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
    this.updateDreamEffects(dt);
    if (this.arcade) {
      this.screenT = (this.screenT || 0) - dt;
      if (this.screenT <= 0) {
        this.screenT = 0.1;
        this.arcade.update(this.time);
      }
      if (Math.random() < dt * 3) audio.bleep(0.012);
    }
    if (this.bellGlow && !this.hasKey) this.bellGlow.material.opacity = 0.5 + Math.sin(this.time * 4) * 0.3;

    // la hall: al mattino, entrarci scatena gli gnomi
    if (this.phase === 'explore' && this.timeOfDay === 'day' && !this.hallCleared && this.inHall(room) && this.player.armed) this.startFight();

    // interazioni
    let hint = null;
    if (this.phase === 'explore' && !this.activity && !menus) hint = this.interactions(room, inSuite);
    if (this.phase !== 'sleeping') ui.hint(menus ? null : hint || this.baseHint);

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

  // ---------- Porte della suite ----------
  doorInteraction(d, room, E) {
    const { ui, audio } = this.ctx;
    const inside = this.isSuiteRoom(room);
    if (d.kind === 'service' && !this.serviceOpen) {
      if (!inside) return 'Porta di servizio. Non si apre da questo lato.';
      if (!E) return '<kbd>E</kbd> apri la porta di servizio';
      this.discoverShortcut(d);
      return null;
    }
    if (!inside) {
      if (d.locked) return 'Chiusa a chiave. Dall\'interno.';
      return null;
    }
    if (E) {
      this.doors.setLocked(d, !d.locked);
      audio.thud(0.18);
      if (d.locked) {
        ui.subtitle(null, this.flags.lockedOnce ? 'Click.' : 'Click. La serratura scatta. Qui dentro non entra niente.', 3);
        this.flags.lockedOnce = true;
      }
    }
    return `<kbd>E</kbd> ${d.locked ? 'apri la porta' : 'chiudi a chiave'}`;
  }

  // La porta di servizio della suite: dà dritta sulla hall.
  discoverShortcut(d) {
    const { ui, audio } = this.ctx;
    this.serviceOpen = true;
    d.auto = true;
    this.doors.setLocked(d, false);
    d.target = 1;
    audio.thud(0.2);
    this.save();
    this.later(1.2, () => ui.subtitle(FRIEND, '...È la hall. La reception è lì, a dieci metri.', 3.2));
    this.later(4.8, () => ui.subtitle(FRIEND, 'Abbiamo fatto il giro di tutto l\'albergo. Per niente.', 3));
    this.later(8.4, () => {
      if (this.conciergeState === 'desk') ui.subtitle('Il concierge, dalla reception:', 'Buonanotte! Via di servizio, molto comoda.', 3.2);
    });
  }

  // ---------- Effetti del sogno (usati dagli eventi) ----------
  later(sec, fn) {
    this.timers.push({ at: this.time + sec, fn });
  }

  updateDreamEffects(dt) {
    const k = 1 - Math.exp(-2 * dt);
    this.dimS = (this.dimS || 0) + (this.dim - (this.dimS || 0)) * k;
    this.stretchS = (this.stretchS || 0) + (this.stretch - (this.stretchS || 0)) * k;
    this.hemi.intensity = (this.hemiBase || 1.1) * (1 - 0.85 * this.dimS);
    this.lantern.intensity = (this.timeOfDay === 'day' ? 8 : 18) * (1 - 0.5 * this.dimS);
    const fov = 70 + 30 * this.stretchS;
    if (Math.abs(this.camera.fov - fov) > 0.05) {
      this.camera.fov = fov;
      this.camera.updateProjectionMatrix();
    }
    if (this.snow > 0) {
      this.snow -= dt;
      const p = this.player.pos;
      for (let i = 0; i < 3; i++) {
        this.glints.emit(p.x + (Math.random() - 0.5) * 16, 6, p.z + (Math.random() - 0.5) * 16, (Math.random() - 0.5) * 0.3, -0.8, (Math.random() - 0.5) * 0.3, { color: [0.95, 0.97, 1], size: 0.09, life: 8, alpha: 0.9 });
      }
    }
  }

  // ---------- Ascensore ----------
  openElevator() {
    this.ctx.input.unlock();
    this.elevatorPanel.show(this.floorNum, (f) => this.rideTo(f));
  }

  async rideTo(f) {
    const { ui, audio } = this.ctx;
    if (f === this.floorNum) {
      ui.subtitle(null, 'Le porte si aprono sullo stesso piano. Sei già qui.', 2.5);
      return;
    }
    this.phase = 'riding';
    ui.hint(null);
    audio.ding(0.15);
    audio.loop('lift', true, { freq: 110, q: 0.9, vol: 0.06, type: 'lowpass' });
    await ui.fade(1, 700, '#140c04');
    if (this.disposed) return;
    for (const v of rideSequence(this.floorNum, f)) {
      ui.center(`<div class="elev-ride"><small>Ascensore</small><b>${v}</b></div>`);
      await new Promise((r) => setTimeout(r, 120));
      if (this.disposed) return;
    }
    const wasArcade = this.floorNum === ARCADE_FLOOR;
    this.loadFloor(f);
    if (wasArcade) audio.chiptune(false);
    const e = this.elevators[Math.floor(Math.random() * this.elevators.length)];
    this.player.pos.copy(e.spot);
    this.player.vel.set(0, 0, 0);
    this.player.facing = e.facing;
    this.friend.sitting = false;
    this.friend.pos.set(e.spot.x + Math.cos(e.facing) * 1.3, 0, e.spot.z - Math.sin(e.facing) * 1.3);
    this.camYaw = e.facing;
    this.wasInSuite = undefined;
    this.snapCamera();
    audio.loop('lift', false);
    ui.center(null);
    audio.ding(0.2);
    this.enterFloor();
    await ui.fade(0, 900, '#140c04');
    if (this.phase === 'riding') this.phase = 'explore';
  }

  enterFloor() {
    const { ui, audio } = this.ctx;
    const n = this.floorNum;
    audio.stopAllPads(1.5);
    if (n === ARCADE_FLOOR) {
      audio.chiptune(true, 0.03);
      ui.popup('Piano 88 · Sala giochi');
      this.arcadeObjective();
      if (!this.flags.arcadeSeen) {
        this.flags.arcadeSeen = true;
        this.later(1.2, () => ui.subtitle(FRIEND, 'Una sala giochi... Ma dove finisce?', 3));
        this.later(5, () => ui.subtitle(FRIEND, 'Guarda, danno biglietti. E c\'è un banco premi vicino all\'ascensore.', 3.4));
      }
    } else if (n === 0) {
      ui.popup('Piano terra');
      if (this.timeOfDay === 'night') audio.pad('hotel', [98, 146.8, 196, 246.9], { vol: 0.04, cutoff: 1100 });
      ui.objective(this.goalText());
    } else {
      ui.popup(`Piano ${n} · ${this.arch.name}`);
      audio.pad('floor', [110 + (n % 7) * 8, 164.8, 220, 261.6], { vol: 0.03, cutoff: 900 });
      ui.objective(this.goal ? this.goalText() : `Piano ${n}. Esplora, oppure riprendi l'ascensore.`);
      const lines = [
        'Da fuori sembrava di tre piani. Tre.',
        `Piano ${n}... e l'ascensore saliva ancora.`,
        'Questo piano ha un odore diverso.',
        'Chissà chi dorme in queste stanze.',
        'Ogni piano è un altro albergo.',
      ];
      if (Math.random() < 0.6) this.later(1.5, () => ui.subtitle(FRIEND, lines[Math.floor(Math.random() * lines.length)], 3));
    }
  }

  // ---------- Sala giochi ----------
  arcadeObjective() {
    this.ctx.ui.objective(`Sala giochi · ${this.tickets} biglietti`);
  }

  arcadeInteractions(near, E) {
    const A = this.arcade;
    const p = this.player.pos;
    if (near(A.counterSpot, 2.4)) {
      if (E) this.openPrizes();
      return `<kbd>E</kbd> banco premi · ${this.tickets} biglietti`;
    }
    for (const c of A.claws) {
      if (near(c.spot, 1.1)) {
        if (E) this.playGame('artiglio');
        return '<kbd>E</kbd> prova l\'Artiglio';
      }
    }
    let best = null;
    let bd = 1.15;
    for (const c of A.cabinets) {
      const d = Math.hypot(c.spot.x - p.x, c.spot.z - p.z);
      if (d < bd) {
        bd = d;
        best = c;
      }
    }
    if (!best) return null;
    if (best.game) {
      if (E) this.playGame(best.game);
      return `<kbd>E</kbd> gioca a ${best.title}`;
    }
    return `${best.title}: lo schermo ripete INSERT COIN, ma non c'è dove metterla.`;
  }

  playGame(key) {
    const { audio, ui, input } = this.ctx;
    input.unlock();
    const sfx = {
      blip: () => audio.bleep(0.05),
      pop: () => audio.pop(0.1),
      boom: () => audio.thud(0.3),
      win: () => audio.chime(988, 0.12),
      whoosh: () => audio.whoosh(0.1),
    };
    const api = { sfx: (k) => sfx[k]?.(), say: (line) => ui.subtitle(FRIEND, line, 2.2) };
    this.arcadeScreen.start(key, api, (res) => {
      this.tickets += res.tickets;
      if (res.tickets) ui.popup(`+${res.tickets} biglietti`);
      for (const id of res.prizes) {
        this.prizes.push(id);
        ui.popup(prizeById(id).name);
      }
      if (res.prizes.length) this.later(1, () => ui.subtitle(FRIEND, 'Lo mettiamo sulla mensola della suite.', 2.5));
      this.arcadeObjective();
      this.save();
    });
    ui.subtitle(FRIEND, key === 'ping' ? 'Io sto a destra. Preparati a perdere.' : GAMES[key].title + '! Fammi vedere.', 2.2);
  }

  openPrizes() {
    this.ctx.input.unlock();
    this.prizeOpen = true;
    this.renderPrizes();
    document.getElementById('prizes').classList.add('show');
  }

  renderPrizes() {
    const el = document.getElementById('prizes');
    const owned = (id) => this.prizes.filter((q) => q === id).length;
    el.innerHTML = `<div class="prize-panel">
      <h3>Banco premi</h3>
      <p class="prize-tickets">${this.tickets} biglietti</p>
      <div class="prize-list">${PRIZES.map((p, i) => `
        <button class="prize-row" data-buy="${p.id}" ${this.tickets < p.cost ? 'disabled' : ''}>
          <kbd>${i + 1}</kbd><span>${p.name}${owned(p.id) ? ` <small>· ne hai ${owned(p.id)}</small>` : ''}</span><b>${p.cost}</b>
        </button>`).join('')}</div>
      <p class="prize-note">I premi finiscono sulla mensola della suite 1313.</p>
      <button class="ghost" data-close-prizes>Chiudi <kbd>Esc</kbd></button>
    </div>`;
    if (!this.prizeClick) {
      this.prizeClick = (e) => {
        const b = e.target.closest('[data-buy]');
        if (b && !b.disabled) this.buyPrize(b.dataset.buy);
        if (e.target.closest('[data-close-prizes]')) this.closePrizes();
      };
      el.addEventListener('click', this.prizeClick);
    }
  }

  prizeKeys(input) {
    for (let d = 1; d <= PRIZES.length; d++) if (input.wasPressed(`Digit${d}`, `Numpad${d}`)) this.buyPrize(PRIZES[d - 1].id);
    if (input.wasPressed('Escape', 'KeyQ', 'KeyE')) this.closePrizes();
  }

  buyPrize(id) {
    const p = prizeById(id);
    if (!p || this.tickets < p.cost) return;
    this.tickets -= p.cost;
    this.prizes.push(id);
    this.ctx.audio.chime(880, 0.15);
    this.ctx.ui.popup(p.name);
    this.save();
    this.renderPrizes();
    this.arcadeObjective();
  }

  closePrizes() {
    this.prizeOpen = false;
    document.getElementById('prizes').classList.remove('show');
  }

  // La sala giochi è una tessera che si ripete: chi esce da un lato rientra dall'altro.
  wrapTile(pos) {
    let sx = 0;
    let sz = 0;
    if (pos.x < X0) sx = NW;
    else if (pos.x >= X0 + NW) sx = -NW;
    if (pos.z < Z0) sz = NH;
    else if (pos.z >= Z0 + NH) sz = -NH;
    return [sx, sz];
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
    if (!this.hasKey && this.bellPos && near(this.bellPos, 2.6)) {
      if (E) this.ringBell();
      return '<kbd>E</kbd> suona il campanello';
    }
    if (this.hasKey && this.isSuiteRoom(room) && !this.flags.suiteFound) {
      this.flags.suiteFound = true;
      if (this.goal === 'suite') {
        ui.subtitle(FRIEND, 'Eccola, la 1313. È... una suite. Guarda che camino!', 3.4);
        this.setGoal(null);
        this.save();
      }
    }
    // ascensori: su ogni piano
    for (const e of this.elevators) {
      if (near(e.spot, 1.8)) {
        if (E) this.openElevator();
        return '<kbd>E</kbd> chiama l\'ascensore';
      }
    }
    if (this.arcade) return this.arcadeInteractions(near, E);

    // porte della suite: la si può chiudere a chiave, e diventa un posto sicuro
    const door = this.doors.nearest(p.x, p.z, 1.8);
    if (door && (door.kind === 'suite' || door.kind === 'service')) {
      const hint = this.doorInteraction(door, room, E);
      if (hint) return hint;
    }
    if (!inSuite) return null;
    if (k.guns.visible && near(k.table, 1.9)) {
      if (E) this.takeGuns();
      return '<kbd>E</kbd> prendi le pistole';
    }
    if (near(k.mokaSpot, 1.1)) {
      if (E) this.startActivity('moka');
      return '<kbd>E</kbd> prepara il caffè con la moka';
    }
    if (near(k.table, 1.9)) {
      if (E) this.startActivity('tea');
      return '<kbd>E</kbd> siediti a prendere un tè';
    }
    if (near(k.shower, 1.3)) {
      if (E) this.startActivity('shower');
      return '<kbd>E</kbd> fatti una doccia';
    }
    if (near(k.tub, 1.9)) {
      if (E) this.startActivity('bath');
      return '<kbd>E</kbd> fai un bagno caldo';
    }
    if (near(k.sink, 1.1)) {
      if (E) this.startActivity('sink');
      return '<kbd>E</kbd> lavati il viso';
    }
    if (near(k.windowSpot, 1.2)) {
      if (E) this.startActivity('window');
      return '<kbd>E</kbd> guarda fuori';
    }
    if (near(k.armchair.pos, 1.4)) {
      if (E) this.startActivity('fire');
      return '<kbd>E</kbd> siediti davanti al fuoco';
    }
    if (near(k.shortcutSpot, 1.4)) {
      const places = unlockedPlaces(this.ctx.progress);
      if (!places.length) {
        if (E) ui.subtitle(FRIEND, 'Questa porta prima non c\'era. È chiusa... forse si aprirà quando avremo visto qualcosa, là fuori.', 3.8);
        return '<kbd>E</kbd> una porta verde che prima non c\'era';
      }
      if (E) this.openShortcuts(places);
      return '<kbd>E</kbd> apri la porta dei luoghi del sogno';
    }
    if (near(k.vitrineSpot, 1.5)) {
      if (E) this.openBestiary();
      return '<kbd>E</kbd> apri la vetrina delle creature';
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

  goOutside() {
    if (this.leaving) return;
    this.leaving = true;
    this.ctx.ui.hint(null);
    this.save();
    this.ctx.goOutside();
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
    const inSuite = this.isSuiteRoom(roomAt(this.layout, p.pos.x, p.pos.z));
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
    p.collide(this.boxesNear(p.pos).concat(this.doors.lockedBoxes()));
    if (this.layout.wrap) {
      const [sx, sz] = this.wrapTile(p.pos);
      if (sx || sz) {
        for (const v of [p.pos, this.camPos, this.camLookAt, this.friend.pos]) {
          v.x += sx;
          v.z += sz;
        }
      }
    } else {
      // dal portone si esce all'aperto (la strada sale fino al borgo in vetta)
      p.pos.x = clamp(p.pos.x, X0 + 0.6, X0 + NW - 0.6);
      if (active && this.floorNum === 0 && this.phase === 'explore' && !this.activity && p.pos.z < 1.1 && mz < -0.5 && Math.abs(p.pos.x) < ENTRANCE_W / 2 - 0.4) this.goOutside();
      p.pos.z = clamp(p.pos.z, 0.9, Z0 + NH - 0.6);
    }

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
    const vkey = this.floorNum === 0 ? room : `${this.floorNum}:${room}`;
    if (room >= 0 && !this.visited.has(vkey) && this.phase !== 'riding') {
      this.visited.add(vkey);
      const r = this.layout.rooms[room];
      if (!r.styleDef.noPopup) this.ctx.ui.popup(r.styleDef.name);
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
    const suiteCalm = this.isSuiteRoom(pRoom) && this.isSuiteRoom(fRoom) && this.phase === 'explore';
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
    } else if (d > 6 || !this.goal || this.conciergeState === 'lead') {
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
    f.collide(this.boxesNear(f.pos).concat(this.doors.lockedBoxes()));
    if (this.layout.wrap) {
      const [sx, sz] = this.wrapTile(f.pos);
      f.pos.x += sx;
      f.pos.z += sz;
    } else f.pos.z = Math.max(f.pos.z, 0.9);
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
        this.glints.emit(r.cx + (Math.random() - 0.5) * (r.maxX - r.minX - 2), 0.2, r.cz + (Math.random() - 0.5) * (r.maxZ - r.minZ - 2), 0, 0.8 + Math.random(), 0, { color: [0.5, 0.85, 1], size: 0.12 + Math.random() * 0.15, life: 7, alpha: 0.7 });
      }
      if (pr.kind === 'snow' && Math.random() < 0.7) {
        this.glints.emit(r.cx + (Math.random() - 0.5) * (r.maxX - r.minX - 2), r.style.height - 0.5, r.cz + (Math.random() - 0.5) * (r.maxZ - r.minZ - 2), (Math.random() - 0.5) * 0.3, -0.7, (Math.random() - 0.5) * 0.3, { color: [0.9, 0.95, 1], size: 0.08, life: 10, alpha: 0.8 });
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
    const inSuite = this.isSuiteRoom(room);
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
      if ((b.dir || (b.maxX - b.minX > 2.5 && b.maxZ - b.minZ > 2.5)) && x > b.minX - 0.15 && x < b.maxX + 0.15 && z > b.minZ - 0.15 && z < b.maxZ + 0.15) return true;
    }
    return false;
  }

  updateCompass(room) {
    const { ui } = this.ctx;
    const show = this.goal && !(this.goal === 'suite' && this.isSuiteRoom(room)) && !(this.goal === 'hall' && this.inHall(room)) && this.phase === 'explore';
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
    audio.chiptune(false);
    this.elevatorPanel.close();
    if (this.arcadeScreen.open) this.arcadeScreen.finish();
    this.closePrizes();
    this.closeBestiary();
    this.choice.dispose();
    this.gesture.dispose();
    this.followers?.dispose();
    this.rb.dispose();
    this.floorExtra?.dispose();
    this.flashTex.dispose();
    this.player.dispose();
    this.friend.dispose();
    this.concierge.dispose();
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


