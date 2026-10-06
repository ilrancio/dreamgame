import * as THREE from 'three';
import { clamp } from '../../core/noise.js';
import { Character } from '../hotel/character.js';
import { GnomeFollowers } from '../hotel/companions.js';
import { ArcadeScreen, GAMES } from '../hotel/games.js';
import { ChoicePanel } from '../../core/choice.js';
import { unlockPlace } from '../../core/places.js';
import { DigitalLayer } from '../digitale/layer.js';
import { buildMural } from '../digitale/mural.js';
import { loadChiavetta, formById } from '../digitale/chiavetta.js';
import { buildMallInterior, floorHeight, rampAt, upperWalkable, underSlab, MALL_W, MALL_L, UPPER, DOOR_W } from './mall.js';

const FRIEND = 'Il tuo amico:';
const CLERK = 'Il commesso:';

// Il commesso del negozio di retrogiochi: parla piano, e ti mette tranquillità.
const CALM_LINES = [
  'Ciao. Non c\'è fretta. Qui dentro il tempo va un po\' più piano.',
  'Il pouf è lì apposta. Siediti, prova quello che vuoi. Non vendo niente, in realtà.',
  'Senti il ronzio del tubo catodico? A me calma. Come la pioggia sul tetto.',
  'Le cartucce si soffiano prima di metterle. Non serve a niente, ma si fa.',
  'Il centro è vuoto, ma non è un posto triste. È un posto che aspetta.',
  'Torna quando vuoi. Io sono sempre qui.',
];
const LIE_LINES = [
  'Ecco. Lascia andare le spalle.',
  'Respira con il ronzio. Dentro... e fuori.',
  'Fuori, da qualche parte, c\'è un demone. Qui no.',
  'Nessuno ti chiede niente. Puoi stare così quanto vuoi.',
  'Da piccolo mi addormentavo davanti allo schermo. Va bene anche questo.',
  'Il centro commerciale respira con te. Lo senti?',
];
const PA_LINES = [
  'Gentili clienti, il centro commerciale resterà aperto per sempre. Grazie per la pazienza.',
  'Si avvisa la gentile clientela che il primo piano è uguale al piano terra. Quasi.',
  'Il bambino che ha perso il palloncino rosso... non c\'è nessun bambino. Grazie.',
  'Ricordiamo che al piano terra il negozio di retrogiochi è aperto. Il commesso vi aspetta.',
  'Gentili clienti, le scale mobili salgono anche quando nessuno le prende.',
];
const CARTRIDGES = [
  { key: 'serpente', sub: 'la preferita del commesso' },
  { key: 'invaders', sub: 'gnomi a ondate' },
  { key: 'demone', sub: 'il campo, in piccolo' },
  { key: 'ping', sub: 'contro il tuo amico' },
];
const CLERK_LOOKS = [
  ['#e0b089', '#2a1a10', '#d84a5a'], ['#c99470', '#141414', '#4a8ad8'], ['#f0c8a8', '#c8a060', '#5ab87a'],
  ['#8a5a3a', '#1a1a1a', '#e8b83a'], ['#d8a888', '#8a8a8a', '#9a5ad8'], ['#b88a6a', '#3a2a1a', '#3ac8c8'],
];

export class MallDream {
  constructor(ctx) {
    this.ctx = ctx;
    const hs = ctx.progress.hotel || {};
    this.saved = ctx.progress.centro || {};
    this.day = hs.timeOfDay === 'day';
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(this.day ? '#e8eef4' : '#0a0c18');
    this.camera = new THREE.PerspectiveCamera(64, window.innerWidth / window.innerHeight, 0.1, 400);

    this.hemi = new THREE.HemisphereLight(this.day ? '#f4f8ff' : '#c8d0f0', '#a89f94', this.day ? 1.25 : 0.95);
    this.scene.add(this.hemi, new THREE.AmbientLight('#ffffff', 0.18));
    const sun = new THREE.DirectionalLight(this.day ? '#fff8ec' : '#b8c4ff', this.day ? 0.9 : 0.35);
    sun.position.set(6, 30, 40);
    this.scene.add(sun);

    this.mall = buildMallInterior(this.scene, { day: this.day });
    // anche qui dentro sono arrivate le entità: un terminale al centro della galleria
    const pts = [];
    for (let i = 0; i < 26; i++) pts.push([((i * 37) % 12) - 6, 3 + ((i * 13) % 9), 8 + i * 5.6]);
    this.digital = new DigitalLayer(this.scene, ctx, [{ id: 'galleria', x: 0, y: 0, z: 88, yaw: Math.PI }], pts);
    // il murale gigantesco sulla parete di fondo: tutte le entità, e la fessura per la chiavetta
    this.mural = buildMural(this.scene, { x: 0, z: MALL_L, w: 13.4, h: 12.6 });
    this.mural.refresh(loadChiavetta(ctx.progress));
    this.colliders = this.mall.colliders.concat(this.digital.colliders.map((c) => ({ ...c, lv: 0 })), [{ ...this.mural.collider, lv: 0 }]);

    this.player = new Character(this.scene, { skin: '#e0b089', hair: '#3b2a1e', shirt: '#2f4f8f' });
    this.friend = new Character(this.scene, { skin: '#c99470', hair: '#141414', shirt: '#d9a82e' });
    // i commessi: uno per negozio aperto, dietro al banco. Nient'altro.
    this.clerks = [];
    let li = 0;
    for (const shop of this.mall.shops) {
      if (!shop.clerk) continue;
      const k = shop.clerk;
      const look = k.calm ? ['#d8b090', '#6a4a30', '#7a9a7a'] : CLERK_LOOKS[li++ % CLERK_LOOKS.length];
      const c = new Character(this.scene, { skin: look[0], hair: look[1], shirt: look[2], pants: '#2a2a30' });
      c.pos.set(k.x, k.y, k.z);
      c.facing = k.facing;
      c.animate(0, 0);
      this.clerks.push({ c, shop, calm: !!k.calm, lines: k.calm ? CALM_LINES : k.lines, idx: 0, phase: Math.random() * 6 });
    }
    this.calmClerk = this.clerks.find((q) => q.calm);

    if (hs.activeEntity === 'gnomi' && hs.entities?.gnomi) {
      this.followers = new GnomeFollowers(this.scene, hs.entities.gnomi);
      this.followers.ground = (x, z) => floorHeight(x, z, this.player.pos.y);
    }
    this.arcadeScreen = new ArcadeScreen();
    this.choice = new ChoicePanel();

    this.camYaw = 0;
    this.camPitch = 0.2;
    this.camPos = new THREE.Vector3();
    this.camLook = new THREE.Vector3();
    this.tmpV = new THREE.Vector3();
    this.time = 0;
    this.lineTimer = 0;
    this.flags = {};
    this.activity = null;
    this.paT = 40 + Math.random() * 20;

    // si entra dalle porte di vetro, oppure dalla porta verde 1313
    this.spawn = ctx.spawn || 'entrance';
    ctx.spawn = null;
    const sp = this.spawn === 'shortcut' ? { x: this.mall.door13.spot.x, z: this.mall.door13.spot.z + 0.4 } : { x: 0, z: 2.6 };
    this.player.pos.set(sp.x, 0, sp.z);
    this.friend.pos.set(sp.x + 1.5, 0, sp.z - 0.4);
    this.firstVisit = unlockPlace(ctx, 'centro');

    this.onCanvasClick = () => {
      if (!this.choice.open && !this.arcadeScreen.open) ctx.input.lock();
    };
    ctx.renderer.domElement.addEventListener('click', this.onCanvasClick);

    const { ui, audio } = ctx;
    ui.showHud(true);
    ui.calm(true);
    ui.crosshair(false);
    ui.steam(false);
    ui.compass(null);
    audio.ambience(null);
    audio.stopAllPads(1);
    audio.stopLoops();
    audio.engineStop();
    this.music('mall');
    ui.configureHud({
      unit: 'piano',
      turboLabel: 'Fiato <kbd>Shift</kbd>',
      healthLabel: 'Calma',
      controls: 'Clicca per usare il mouse · <kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd> cammina · <kbd>E</kbd> interagisci · <kbd>Spazio</kbd> salta',
    });
    this.updateObjective();
    this.updateCamera(1, true);
    this.script = [];
    if (this.spawn === 'shortcut') this.later(1.2, () => ui.subtitle(FRIEND, 'Siamo sbucati da una porta di servizio. Del centro commerciale.', 3));
    else if (this.firstVisit) {
      this.later(1.4, () => ui.subtitle(FRIEND, 'È... gigantesco. E non c\'è nessuno.', 3));
      this.later(5, () => ui.subtitle(FRIEND, 'Solo i commessi, dietro ai banchi. Ci guardano e sorridono.', 3.4));
      this.later(14, () => {
        ui.popup('Una nuova porta: Centro Commerciale Orizzonte');
        audio.chime(784, 0.12);
        ui.subtitle(FRIEND, 'Guarda quella porta verde accanto all\'ingresso: 1313. Come la nostra suite.', 3.8);
      });
    } else this.later(1.4, () => ui.subtitle(FRIEND, 'Ancora qui. La musica è sempre la stessa.', 3));
  }

  music(kind) {
    const { audio } = this.ctx;
    if (this.musicKind === kind) return;
    this.musicKind = kind;
    if (kind === 'retro') {
      audio.stopPad('mall', 3);
      audio.pad('retro', [110, 138.6, 164.8, 207.7], { vol: 0.04, cutoff: 650 });
    } else {
      audio.stopPad('retro', 3);
      // la musichetta da centro commerciale: un accordo di settima, sempre lo stesso
      audio.pad('mall', [196, 246.9, 293.7, 370], { vol: 0.028, cutoff: 1300, tremolo: 0.3 });
    }
  }

  later(dt, fn) {
    this.script.push({ at: this.time + dt, fn });
    this.script.sort((a, b) => a.at - b.at);
  }

  save() {
    this.ctx.progress.centro = this.saved;
    this.ctx.saveProgress(this.ctx.progress);
  }

  updateObjective() {
    const s = this.saved;
    this.ctx.ui.checklist([
      ['Un giro sui due piani', !!s.upstairs],
      ['Il negozio di retrogiochi, al piano terra', !!s.retro],
      ['Una partita al tubo catodico', !!s.played],
      ['Sdraiarsi sul pouf', !!s.lay],
    ]);
  }

  get level() {
    return this.player.pos.y > UPPER / 2 ? 1 : 0;
  }

  // ---------- Ciclo ----------
  update(dt) {
    const { input, ui, audio } = this.ctx;
    // pannelli aperti: i tasti vanno a loro, e in questo fotogramma solo a loro
    const busy = this.arcadeScreen.open || this.choice.open || this.digital.open;
    this.digital.update(dt, this.time, input);
    if (!busy) this.digital.discover(this.player.pos, (d, f) => this.later(d, f));
    this.time += dt;
    this.lineTimer -= dt;
    if (input.wasPressed('KeyM')) audio.toggleMute();
    while (this.script.length && this.script[0].at <= this.time) this.script.shift().fn();
    if (this.arcadeScreen.open) this.arcadeScreen.update(dt, input);
    if (this.choice.open) this.choice.handleKeys(input);

    if (this.activity) this.updatePouf(dt, busy);
    else if (!busy) this.updateFoot(dt);
    else this.player.animate(dt, 0);
    this.updateFriend(dt);
    if (this.followers) {
      const lv = this.level;
      this.followers.update(dt, this.time, this.player, (x, z) => this.blockedAt(x, z, lv), 'follow', null);
    }
    for (const k of this.clerks) {
      k.c.animate(dt, 0);
      // respirano piano, e ogni tanto guardano verso di te
      const p = this.player.pos;
      const d = Math.hypot(p.x - k.c.pos.x, p.z - k.c.pos.z);
      const look = d < 9 && Math.abs(p.y - k.c.pos.y) < 2 ? clamp(Math.atan2(p.x - k.c.pos.x, p.z - k.c.pos.z) - k.c.facing, -0.8, 0.8) : Math.sin(this.time * 0.3 + k.phase) * 0.3;
      const wrapped = Math.atan2(Math.sin(look), Math.cos(look));
      k.c.head.rotation.y += (wrapped - k.c.head.rotation.y) * Math.min(1, dt * 2);
      k.c.body.position.y = Math.sin(this.time * (k.calm ? 0.9 : 1.4) + k.phase) * 0.012;
    }
    this.mall.update(this.time, dt);
    this.mural.update(this.time);

    // l'altoparlante, ogni tanto, a nessuno
    this.paT -= dt;
    if (this.paT <= 0 && !this.activity) {
      this.paT = 55 + Math.random() * 35;
      audio.ding(0.1);
      this.later(0.9, () => ui.subtitle('Altoparlante:', PA_LINES[(this.saved.pa = ((this.saved.pa || 0) + 1)) % PA_LINES.length], 4.5));
    }
    this.updatePlaces(dt);
    ui.updateHud({ speed: this.level, turbo: 1, health: 1, time: this.time, counter: '' });
  }

  inRetro(p = this.player.pos) {
    const R = this.mall.retro.shop;
    return p.y < 3 && p.x * R.side > 12.1 && p.z > R.zA && p.z < R.zB;
  }

  // Il murale: si sceglie quale entità trasferire nella chiavetta
  openMural() {
    const { ui } = this.ctx;
    ui.hint(null);
    const d = loadChiavetta(this.ctx.progress);
    if (!d.found) {
      d.found = true;
      this.ctx.saveProgress(this.ctx.progress);
      ui.subtitle(null, 'Infili la mano in tasca: c\'è una chiavetta USB. Combacia con la fessura, come se fosse fatta apposta.', 4.5);
    }
    this.digital.screen.startMural(this.ctx, (sum) => {
      this.mural.refresh(d);
      if (sum.transferred) {
        const name = formById(sum.transferred).name;
        ui.popup(`Nella chiavetta: ${name}`);
        this.later(0.8, () => ui.subtitle(FRIEND, sum.transferred === 'scintilla' ? 'Bentornata, Scintilla. Ci eri mancata.' : `Adesso nella tua chiavetta c'è... ${name}? E ti ubbidisce?`, 3.6));
      }
    });
  }

  updatePlaces() {
    const { ui } = this.ctx;
    const inRetro = this.inRetro();
    this.music(inRetro ? 'retro' : 'mall');
    this.ctx.audio.loop('crt', inRetro, { freq: 120, q: 3, vol: 0.02 });
    if (inRetro && !this.flags.retroGreet) {
      this.flags.retroGreet = true;
      this.later(0.6, () => this.clerkSay(this.saved.retro ? 'Bentornati. Il pouf vi aspettava.' : 'Ciao. Entrate pure... prendetevela comoda.'));
      if (!this.saved.retro) {
        this.later(5.5, () => ui.subtitle(FRIEND, 'Hai sentito che voce? Mi sono già rilassato.', 3));
        this.saved.retro = true;
        this.save();
        this.updateObjective();
      }
    }
    if (!inRetro && this.flags.retroGreet && !this.activity) {
      const R = this.mall.retro.shop;
      if (Math.abs(this.player.pos.x) < 10 || this.player.pos.z < R.zA - 8 || this.player.pos.z > R.zB + 8) this.flags.retroGreet = false;
    }
    if (this.player.pos.z > 112 && !this.saved.mural) {
      this.saved.mural = true;
      this.save();
      ui.subtitle(FRIEND, 'Guarda in fondo. Un murale gigantesco... ci sono dipinte tutte quelle entità.', 4);
    }
    if (this.level === 1 && !this.saved.upstairs) {
      this.saved.upstairs = true;
      this.save();
      this.updateObjective();
      ui.subtitle(FRIEND, 'Da quassù sembra ancora più vuoto. E più grande.', 3);
    }
  }

  clerkSay(line, dur = 5) {
    this.ctx.ui.subtitle(CLERK, line, dur);
    this.ctx.audio.chime(330, 0.03);
  }

  // ---------- Movimento ----------
  boxesAt(lv, p, r = 6) {
    return this.colliders.filter((b) => (b.lv === 2 || b.lv === lv) && p.x > b.minX - r && p.x < b.maxX + r && p.z > b.minZ - r && p.z < b.maxZ + r);
  }

  blockedAt(x, z, lv) {
    if (Math.abs(x) > MALL_W - 0.3 || z < 0.4 || z > MALL_L - 0.3) return true;
    if (lv === 1 && !upperWalkable(x, z) && rampAt(x, z) === null) return true;
    for (const b of this.colliders) if ((b.lv === 2 || b.lv === lv) && x > b.minX && x < b.maxX && z > b.minZ && z < b.maxZ) return true;
    return false;
  }

  walk(ch, dt) {
    const lv = ch.pos.y > UPPER / 2 ? 1 : 0;
    const ox = ch.pos.x;
    const oz = ch.pos.z;
    ch.pos.x += ch.vel.x * dt;
    ch.pos.z += ch.vel.z * dt;
    ch.collide(this.boxesAt(lv, ch.pos, 2));
    ch.pos.x = clamp(ch.pos.x, -MALL_W + 0.45, MALL_W - 0.45);
    ch.pos.z = clamp(ch.pos.z, 0.6, MALL_L - 0.45);
    // un gradino troppo alto (il fianco di una rampa, il bordo di sopra): non si passa
    const support = floorHeight(ch.pos.x, ch.pos.z, ch.pos.y);
    if (support - ch.pos.y > 0.6) {
      ch.pos.x = ox;
      ch.pos.z = oz;
    }
    const ground = floorHeight(ch.pos.x, ch.pos.z, ch.pos.y);
    ch.vel.y = (ch.vel.y || 0) - 22 * dt;
    ch.pos.y += ch.vel.y * dt;
    if (ch.pos.y <= ground) {
      ch.pos.y = ground;
      ch.vel.y = 0;
      ch.grounded = true;
    } else if (ch.pos.y - ground < 0.6 && ch.vel.y <= 0 && ch.grounded) {
      ch.pos.y = ground;
      ch.vel.y = 0;
    } else ch.grounded = false;
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
    // nel negozio del commesso tranquillo si cammina più piano, senza volerlo
    const speed = this.inRetro() ? 3.2 : input.down('ShiftLeft', 'ShiftRight') ? 8.5 : 5;
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

    // le porte di vetro: si esce nel parcheggio
    if (p.pos.z < 1.0 && Math.abs(p.pos.x) < DOOR_W - 0.3 && mz < -0.5 && p.pos.y < 1) {
      this.leave(() => this.ctx.goOutside('centro'));
      return;
    }
    const it = this.findInteraction();
    ui.hint(it ? `<kbd>E</kbd> ${it.label}` : null);
    if (it && input.wasPressed('KeyE')) it.fn();
    this.updateCamera(dt);
  }

  leave(go) {
    if (this.leaving) return;
    this.leaving = true;
    this.ctx.ui.hint(null);
    this.ctx.audio.thud(0.15);
    this.save();
    go();
  }

  findInteraction() {
    const p = this.player.pos;
    const near = (x, z, r) => Math.hypot(p.x - x, p.z - z) < r;
    const M = this.mall;
    if (this.level === 0 && near(M.door13.spot.x, M.door13.spot.z, 1.6)) return { label: 'apri la porta 1313', fn: () => this.leave(() => this.ctx.travel('suite')) };
    if (this.level === 0 && p.z < 4 && Math.abs(p.x) < DOOR_W) return { label: 'esci: le porte si aprono da sole', fn: () => this.leave(() => this.ctx.goOutside('centro')) };
    if (this.level === 0 && near(this.mural.spot.x, this.mural.spot.z, 1.8)) return { label: 'infila la chiavetta nel murale', fn: () => this.openMural() };
    const term = this.level === 0 && this.digital.near(p);
    if (term) return { label: 'collega la chiavetta al terminale', fn: () => this.digital.connect(term) };
    const R = M.retro;
    if (this.inRetro()) {
      if (near(R.crt.x, R.crt.z, 1.9)) return { label: 'prova un gioco al tubo catodico', fn: () => this.startPouf(true) };
      if (near(R.pouf.x, R.pouf.z, 1.7)) return { label: 'siediti sul pouf', fn: () => this.startPouf(false) };
    }
    for (const k of this.clerks) {
      if (Math.abs(k.c.pos.y - p.y) < 2 && near(k.c.pos.x, k.c.pos.z, 2.9)) return { label: k.calm ? 'parla con il commesso' : `parla con chi lavora da ${k.shop.name}`, fn: () => this.talk(k) };
    }
    return null;
  }

  talk(k) {
    const line = k.lines[k.idx++ % k.lines.length];
    if (k.calm) this.clerkSay(line);
    else {
      this.ctx.ui.subtitle(`${k.shop.name}:`, line, 4);
      this.ctx.audio.chime(520 + Math.random() * 200, 0.03);
    }
  }

  // ---------- Il pouf e il tubo catodico ----------
  startPouf(play) {
    const { ui } = this.ctx;
    const R = this.mall.retro;
    const p = this.player;
    ui.hint(null);
    this.activity = { mode: 'sit', t: 0, lieT: 0, lineT: 6, li: 0 };
    p.vel.set(0, 0, 0);
    p.pos.set(R.pouf.x, 0.12, R.pouf.z);
    p.facing = Math.atan2(R.crt.x - R.pouf.x, R.crt.z - R.pouf.z);
    p.sitting = true;
    const fr = this.friend;
    fr.pos.set(R.pouf2.x, 0.06, R.pouf2.z);
    fr.facing = Math.atan2(R.crt.x - R.pouf2.x, R.crt.z - R.pouf2.z);
    fr.sitting = true;
    this.ctx.audio.thud(0.12);
    if (!this.flags.poufLine) {
      this.flags.poufLine = true;
      this.later(1.5, () => ui.subtitle(FRIEND, 'Oh. È morbidissimo. Non mi alzo più.', 3));
    }
    if (play) this.chooseGame();
  }

  chooseGame() {
    if (this.activity?.mode === 'lie') this.setLie(false);
    this.ctx.input.unlock();
    this.choice.show({
      title: 'Cartucce',
      note: 'Il commesso le soffia una per una, prima di dartele.',
      theme: 'retro',
      items: CARTRIDGES.map((c) => ({ label: GAMES[c.key].title, sub: c.sub, value: c.key, action: 'gioca' })),
      onPick: (key) => this.playGame(key),
    });
  }

  playGame(key) {
    const { audio, ui } = this.ctx;
    if (this.activity?.mode === 'lie') this.setLie(false);
    const sfx = {
      blip: () => audio.bleep(0.04),
      pop: () => audio.pop(0.08),
      boom: () => audio.thud(0.25),
      win: () => audio.chime(988, 0.1),
      whoosh: () => audio.whoosh(0.08),
    };
    const api = { sfx: (k) => sfx[k]?.(), say: (line) => ui.subtitle(FRIEND, line, 2.2) };
    this.arcadeScreen.start(key, api, (res) => {
      const hs = this.ctx.progress.hotel;
      if (res.tickets && hs) {
        // i biglietti valgono anche al banco premi della sala giochi (piano 88)
        hs.tickets = (hs.tickets || 0) + res.tickets;
        ui.popup(`+${res.tickets} biglietti`);
      }
      this.saved.played = true;
      this.save();
      this.updateObjective();
      this.later(0.8, () => this.clerkSay(['Bella partita. Senza fretta, eh.', 'Il punteggio non conta. Conta che ti sei divertito.', 'Vuoi riprovare? Il pouf non scappa.'][Math.floor(Math.random() * 3)], 4));
    });
    if (key === 'ping') ui.subtitle(FRIEND, 'Io sto a destra. Dal pouf gioco meglio.', 2.4);
  }

  setLie(on) {
    const a = this.activity;
    const { ui } = this.ctx;
    a.mode = on ? 'lie' : 'sit';
    a.lineT = 3;
    // sdraiato: ci si lascia andare indietro, la schiena affonda nel pouf
    const R = this.mall.retro;
    const p = this.player;
    const back = on ? 0.55 : 0;
    p.pos.set(R.pouf.x + Math.sin(p.facing) * back, on ? 0.3 : 0.12, R.pouf.z + Math.cos(p.facing) * back);
    ui.center(on ? '<div class="breath"><div class="ring"></div><span class="in">inspira</span><span class="out">espira</span></div>' : null);
    if (on && !this.saved.lay) {
      this.saved.lay = true;
      this.save();
      this.updateObjective();
    }
  }

  standUp() {
    const { ui } = this.ctx;
    const R = this.mall.retro;
    const p = this.player;
    if (this.activity.mode === 'lie') this.setLie(false);
    this.activity = null;
    p.sitting = false;
    this.friend.sitting = false;
    p.body.rotation.x = 0;
    this.friend.body.rotation.x = 0;
    p.pos.set(R.pouf.x - R.shop.side * 1.2, 0, R.pouf.z - 0.6);
    this.friend.pos.set(R.pouf2.x - R.shop.side * 0.8, 0, R.pouf2.z - 0.9);
    this.camYaw = p.facing + Math.PI;
    ui.center(null);
    ui.hint(null);
    this.updateCamera(1, true);
  }

  updatePouf(dt, busy) {
    const { input, ui } = this.ctx;
    const a = this.activity;
    const R = this.mall.retro;
    const p = this.player;
    a.t += dt;
    p.animate(dt, 0);
    if (a.mode === 'lie') {
      a.lieT += dt;
      p.body.rotation.x = -1.15;
      // il commesso parla piano, con lunghe pause
      a.lineT -= dt;
      if (a.lineT <= 0) {
        a.lineT = 9 + Math.random() * 3;
        this.clerkSay(LIE_LINES[a.li++ % LIE_LINES.length], 6);
      }
      if (a.lieT > 30 && !this.flags.forever) {
        this.flags.forever = true;
        this.later(0.5, () => ui.subtitle(FRIEND, '(sottovoce) Potrei restare qui per sempre.', 3.5));
      }
    } else p.body.rotation.x = 0;
    const playing = this.arcadeScreen.open || this.choice.open;
    if (!busy && !playing) {
      ui.hint(`<kbd>E</kbd> gioca · <kbd>Spazio</kbd> ${a.mode === 'lie' ? 'tirati su' : 'sdraiati'} · <kbd>Q</kbd> alzati`);
      if (input.wasPressed('KeyE')) this.chooseGame();
      else if (input.wasPressed('Space')) this.setLie(a.mode !== 'lie');
      else if (input.wasPressed('KeyQ', 'Escape', 'KeyW', 'KeyS') && a.t > 0.5) {
        this.standUp();
        return;
      }
    } else ui.hint(null);
    // la camera: dietro al pouf verso lo schermo, oppure dall'alto quando sei sdraiato
    const cam = a.mode === 'lie'
      ? this.tmpV.set(R.pouf.x - R.shop.side * 1.1, 3.1, R.pouf.z + 1.2)
      : this.tmpV.set(R.pouf.x - R.shop.side * 0.7, 1.75, R.pouf.z - 2.4);
    const look = a.mode === 'lie' ? new THREE.Vector3(R.pouf.x, 0.6, R.pouf.z) : new THREE.Vector3(R.crt.x, 1.0, R.crt.z);
    const k = 1 - Math.exp(-2.5 * dt);
    this.camPos.lerp(cam, k);
    this.camLook.lerp(look, k);
    this.camera.position.copy(this.camPos);
    this.camera.lookAt(this.camLook);
    this.camera.fov += (52 - this.camera.fov) * k;
    this.camera.updateProjectionMatrix();
  }

  // ---------- L'amico ----------
  updateFriend(dt) {
    const fr = this.friend;
    if (fr.sitting) {
      fr.animate(dt, 0);
      if (this.activity?.mode === 'lie') fr.body.rotation.x = -0.6;
      return;
    }
    const p = this.player;
    const fx = Math.sin(p.facing);
    const fz = Math.cos(p.facing);
    const tx = p.pos.x - fx * 1.2 + fz * 1.4;
    const tz = p.pos.z - fz * 1.2 - fx * 1.4;
    const dx = tx - fr.pos.x;
    const dz = tz - fr.pos.z;
    const d = Math.hypot(dx, dz);
    // su un altro piano, o rimasto indietro: il sogno lo rimette accanto a te
    this.apartT = Math.abs(fr.pos.y - p.pos.y) > 2.5 || d > 16 ? (this.apartT || 0) + dt : 0;
    if (this.apartT > 2) {
      this.apartT = 0;
      fr.pos.set(p.pos.x - fx * 1.2, p.pos.y, p.pos.z - fz * 1.2);
      fr.vel.set(0, 0, 0);
    }
    const want = d > 0.7 ? Math.min(8.5, d * 2.2) : 0;
    const k = 1 - Math.exp(-8 * dt);
    fr.vel.x += ((d > 0.01 ? dx / d : 0) * want - fr.vel.x) * k;
    fr.vel.z += ((d > 0.01 ? dz / d : 0) * want - fr.vel.z) * k;
    this.walk(fr, dt);
    const hs = Math.hypot(fr.vel.x, fr.vel.z);
    if (hs > 0.4) {
      let a = Math.atan2(fr.vel.x, fr.vel.z) - fr.facing;
      a = Math.atan2(Math.sin(a), Math.cos(a));
      fr.facing += a * (1 - Math.exp(-10 * dt));
    }
    fr.animate(dt, hs);
  }

  // ---------- Camera ----------
  updateCamera(dt, snap = false) {
    const p = this.player;
    const lv = this.level;
    const head = new THREE.Vector3(p.pos.x, p.pos.y + 1.6, p.pos.z);
    const dist = this.inRetro() ? 3.6 : 4.8;
    const dx = -Math.sin(this.camYaw) * Math.cos(this.camPitch);
    const dz = -Math.cos(this.camYaw) * Math.cos(this.camPitch);
    const dy = Math.sin(this.camPitch);
    const boxes = this.boxesAt(lv, head, dist + 1);
    let reach = dist;
    for (let s = 0.3; s <= dist; s += 0.2) {
      const x = head.x + dx * s;
      const z = head.z + dz * s;
      const hit = Math.abs(x) > MALL_W - 0.3 || z < 0.3 || z > MALL_L - 0.3 || boxes.some((b) => x > b.minX - 0.2 && x < b.maxX + 0.2 && z > b.minZ - 0.2 && z < b.maxZ + 0.2);
      if (hit) {
        reach = Math.max(0.35, s - 0.25);
        break;
      }
    }
    const tx = head.x + dx * reach;
    const tz = head.z + dz * reach;
    let ty = head.y + dy * reach;
    // soffitti: sotto i ballatoi è basso, nei negozi di sopra pure
    const top = lv === 0 && underSlab(tx, tz) ? UPPER - 0.6 : Math.abs(tx) > 12 ? 11.2 : 13.4;
    ty = clamp(ty, p.pos.y + 0.4, top);
    const k = snap || reach < dist - 0.1 ? 1 : 1 - Math.exp(-10 * dt);
    this.camPos.x += (tx - this.camPos.x) * k;
    this.camPos.y += (ty - this.camPos.y) * k;
    this.camPos.z += (tz - this.camPos.z) * k;
    this.camLook.copy(head);
    this.camera.position.copy(this.camPos);
    this.camera.lookAt(this.camLook);
    this.camera.fov += (64 - this.camera.fov) * (snap ? 1 : 1 - Math.exp(-4 * dt));
    this.camera.updateProjectionMatrix();
  }

  onResize() {}

  dispose() {
    const { ui, audio, input } = this.ctx;
    this.ctx.renderer.domElement.removeEventListener('click', this.onCanvasClick);
    if (this.arcadeScreen.open) this.arcadeScreen.finish();
    this.choice.dispose();
    this.digital.dispose();
    this.mural.dispose();
    input.unlock();
    audio.stopLoops();
    audio.stopAllPads(1);
    ui.hint(null);
    ui.center(null);
    ui.clearSubtitle();
    ui.objective('');
    this.mall.dispose();
    this.player.dispose();
    this.friend.dispose();
    this.clerks.forEach((k) => k.c.dispose());
    this.followers?.dispose();
  }
}
