import * as THREE from 'three';
import { WalkScene, FRIEND } from '../../core/walkscene.js';
import { unlockPlace } from '../../core/places.js';
import { createSky } from '../../core/sky.js';
import { Particles } from '../../core/particles.js';
import { clamp } from '../../core/noise.js';
import { Character } from '../hotel/character.js';
import { IslandTerrain, EXT, STRIP } from './terrain.js';
import { buildIsland, PLANE_PRICE, RACE, SHOP, PILOT_HOME } from './world.js';
import { Biplane } from './plane.js';
import { IronGull } from './boss.js';

// L'isola del collectathon. Arrivi in idrovolante e il Gabbiano di Ferro ti
// strappa di mano la patente di volo: le pagine finiscono sparse per l'isola.
// Raccogli le cinque pagine e cento monete, compra il Pellicano all'hangar
// degli aeroplani usati, e vai a battere il gabbiano in cielo.

const PILOT = 'Il vecchio pilota:';
const SELLER = 'La venditrice:';
const PAGE_NAMES = {
  vetta: 'in cima alla montagna',
  faro: 'sul ballatoio del faro',
  isolotto: 'sull\'isolotto della laguna',
  gara: 'premio della gara degli anelli',
  pilota: 'regalo del vecchio pilota',
};
const ALL_PAGES = Object.keys(PAGE_NAMES);

export class IslandDream extends WalkScene {
  constructor(ctx) {
    super(ctx, { background: '#bfe6f8', far: 3200, bounds: { minX: -EXT + 5, maxX: EXT - 5, minZ: -EXT + 5, maxZ: EXT - 5 }, speed: 5.5 });
    this.dreamId = 'isola';
    const S = this.scene;
    this.saved = Object.assign({ coins: [], pages: [], glasses: false, glassesGiven: false, plane: false, boss: false }, ctx.progress.isola || {});
    this.sky = createSky();
    const u = this.sky.uniforms;
    u.top.value.set('#1a78e0');
    u.horizon.value.set('#c8eefa');
    u.bottom.value.set('#1aa0c8');
    u.sunColor.value.set('#fff6dc');
    u.sunDir.value.set(-0.3, 0.8, 0.5).normalize();
    S.add(this.sky.mesh);
    S.fog = new THREE.Fog('#c8eefa', 300, 2600);
    S.add(new THREE.HemisphereLight('#e4f6ff', '#d8c898', 1.3));
    const sun = new THREE.DirectionalLight('#fff4dc', 2.2);
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

    this.terrain = new IslandTerrain();
    const T = this.terrain;
    this.world = buildIsland(S, T);
    const W = this.world;
    this.colliders = W.colliders;
    // un terminale in mezzo al villaggio, fra la casa del pilota e l'hangar
    this.addTerminal('isola', 45, 150, 0, { y: W.villageY, spread: 16 });
    for (const pd of W.pads) T.addPlatform({ x: pd.pad.x, z: pd.pad.z, r: 1.75, top: pd.pad.y + 1.55, kind: 'pad', pad: pd });
    this.taken = new Set(this.saved.coins);
    W.setTaken(this.taken);
    for (const p of W.pages) p.group.visible = !this.saved.pages.includes(p.id);
    W.glasses.visible = !this.saved.glasses;

    // le persone dell'isola
    const VY = W.villageY;
    this.pilot = new Character(S, { skin: '#d8a880', hair: '#f0f0f0', shirt: '#7a5232', pants: '#4a4238', model: 'shirt' });
    this.pilot.pos.set(PILOT_HOME.x + 1.5, VY, PILOT_HOME.z + 2);
    this.pilot.facing = 0.3;
    this.seller = new Character(S, { skin: '#c88a5a', hair: '#2a1a10', shirt: '#2a6ac8', pants: '#e8e0d0', model: 'shirt' });
    this.seller.pos.set(SHOP.x - 6, VY, SHOP.z + 9);
    this.seller.facing = 0.4;
    for (const c of [this.pilot, this.seller]) c.animate(0, 0);

    // il Pellicano, davanti all'hangar
    this.plane = new Biplane(S);
    this.parkPlane();
    this.boss = new IronGull(S);
    this.boss.angle = Math.PI / 2 - 0.35;
    this.boss.passive = true;
    if (this.saved.boss) this.boss.group.visible = false;
    this.sparks = new Particles(S, 900, { additive: true });
    this.smoke = new Particles(S, 900);
    this.mode = 'foot';
    this.dbl = false;
    this.lastSafe = new THREE.Vector3();
    this.safeT = 0;

    this.spawn = ctx.spawn || 'arrivo';
    ctx.spawn = null;
    if (this.spawn === 'shortcut') this.place(W.hut.x, W.hut.z + 1, 0);
    else this.place(W.pierEnd.x, W.pierEnd.z - 2, Math.PI);
    this.lastSafe.copy(this.player.pos);

    const { ui, audio } = ctx;
    ui.calm(true);
    ui.configureHud({
      unit: '',
      turboLabel: 'Fiato <kbd>Shift</kbd>',
      healthLabel: 'Calma',
      controls: 'Clicca per usare il mouse · <kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd> cammina · <kbd>E</kbd> interagisci · <kbd>Spazio</kbd> salta (due volte: doppio salto)',
    });
    audio.ambience('birds');
    audio.loop('onde', true, { freq: 420, q: 0.4, vol: 0.025, type: 'lowpass' });
    audio.pad('isola', [261.6, 329.6, 392, 493.9], { vol: 0.018, cutoff: 1400, tremolo: 0.2 });
    this.firstVisit = unlockPlace(ctx, 'isola');
    this.updateObjective();
    if (this.spawn === 'arrivo' && !this.saved.intro) this.intro();
    else if (this.spawn === 'arrivo') ui.subtitle(FRIEND, 'Di nuovo sull\'isola. Il gabbiano è sempre lassù.', 3);
  }

  save() {
    this.saved.coins = [...this.taken];
    this.ctx.progress.isola = this.saved;
    this.ctx.saveProgress(this.ctx.progress);
  }

  get coinCount() {
    return this.taken.size - (this.saved.plane ? PLANE_PRICE : 0);
  }

  get pageCount() {
    return this.saved.pages.length;
  }

  updateObjective() {
    if (this.race) return;
    const s = this.saved;
    this.ctx.ui.checklist([
      [`Pagine della patente: ${this.pageCount}/5`, this.pageCount >= 5],
      [s.plane ? 'Monete: il Pellicano è pagato' : `Monete: ${this.coinCount}/${PLANE_PRICE}`, s.plane || this.coinCount >= PLANE_PRICE],
      ['Compra il Pellicano all\'hangar', s.plane],
      ['Batti il Gabbiano di Ferro', s.boss],
    ]);
  }

  parkPlane() {
    const y = this.world.villageY + 1.2;
    this.plane.place(SHOP.x + 8, y, SHOP.z + 16, Math.PI / 2);
    this.plane.prop.rotation.z = 0.4;
  }

  // ---------- L'arrivo: il gabbiano ti strappa la patente ----------
  intro() {
    const { ui, audio } = this.ctx;
    const W = this.world;
    const P = this.player.pos;
    const flyers = [];
    const geo = new THREE.PlaneGeometry(0.7, 0.9);
    const mat = new THREE.MeshBasicMaterial({ color: '#fbf6e8', side: THREE.DoubleSide });
    const dests = [...W.pages.map((p) => new THREE.Vector3(p.x, p.y + 2, p.z)), new THREE.Vector3(RACE.cx, 10, RACE.cz), new THREE.Vector3(PILOT_HOME.x, 12, PILOT_HOME.z)];
    for (const d of dests) {
      const m = new THREE.Mesh(geo, mat);
      m.visible = false;
      this.scene.add(m);
      flyers.push({ m, to: d });
    }
    this.introRes = [geo, mat, flyers];
    // il gabbiano passa basso sopra il pontile
    this.boss.pos.set(P.x - 160, 45, P.z - 40);
    audio.roar(0.5);
    this.startCine({
      cam: new THREE.Vector3(P.x + 6, P.y + 3, P.z + 8),
      look: new THREE.Vector3(P.x - 40, P.y + 25, P.z - 20),
      dur: 9,
      update: (dt, c) => {
        const t = c.t;
        const b = this.boss;
        b.pos.set(P.x - 160 + t * 40, 45 + t * 4, P.z - 40 + Math.sin(t * 0.5) * 10);
        b.group.position.copy(b.pos);
        b.group.rotation.set(0, Math.PI / 2, 0.1);
        b.t += dt;
        for (const w of b.wings) w.shoulder.rotation.z = w.s * Math.sin(b.t * 2) * 0.3;
        c.look.lerp(b.pos, 1 - Math.exp(-3 * dt));
        if (t > 3.2 && !c.rip) {
          c.rip = true;
          audio.whoosh(0.5);
          ui.subtitle(FRIEND, 'La tua patente di volo! Te l\'ha strappata di mano!', 3);
          for (const f of flyers) {
            f.m.visible = true;
            f.from = b.pos.clone();
          }
        }
        if (c.rip) {
          const k = Math.min(1, (t - 3.2) / 4.5);
          for (const f of flyers) {
            f.m.position.lerpVectors(f.from, f.to, k);
            f.m.position.y += Math.sin(k * Math.PI) * 30;
            f.m.rotation.set(t * 3, t * 2.2, t);
          }
        }
      },
      onEnd: () => {
        for (const f of flyers) f.m.removeFromParent();
        geo.dispose();
        mat.dispose();
        this.introRes = null;
        this.boss.angle = Math.atan2(this.boss.pos.z, this.boss.pos.x);
        this.saved.intro = true;
        this.save();
        this.updateCamera(1, true);
        ui.subtitle(FRIEND, 'Le pagine sono volate per tutta l\'isola. Senza patente non si vola.', 3.6);
        this.later(4.2, () => ui.subtitle(FRIEND, 'E guarda: monete dappertutto. Raccogliamole, qualcosa ci compreremo.', 3.4));
        this.later(8.4, () => ui.subtitle(null, 'La luce azzurra in cielo segna dove sono finite le pagine. <kbd>Spazio</kbd> due volte: doppio salto.', 4.4));
        if (this.firstVisit) {
          this.later(13.5, () => {
            ui.popup('Una nuova porta: L\'Isola');
            audio.chime(784, 0.12);
            ui.subtitle(FRIEND, 'C\'è una capanna con il 1313 vicino al pontile. Ovviamente.', 3);
          });
        }
      },
    });
  }

  // ---------- Camminare, saltare, rimbalzare ----------
  // il terreno, o la piattaforma su cui si sta (per la camera: quella sotto chi gioca)
  groundAt(x, z) {
    return this.terrain.support(x, z, (this.player?.pos.y ?? 0) + 1);
  }

  place(x, z, yaw) {
    super.place(x, z, yaw);
    for (const ch of [this.player, this.friend]) {
      ch.pos.y = this.terrain.support(ch.pos.x, ch.pos.z, 999);
      ch.vel.set(0, 0, 0);
    }
    this.updateCamera(1, true);
  }

  walk(ch, dt) {
    const T = this.terrain;
    const ox = ch.pos.x;
    const oz = ch.pos.z;
    ch.pos.x += ch.vel.x * dt;
    ch.pos.z += ch.vel.z * dt;
    // ostacoli: quelli bassi si scavalcano stando sopra
    const boxes = this.boxesNear(ch.pos, 2).filter((b) => b.top === undefined || ch.pos.y < b.top - 0.4);
    const list = T.grid.get(Math.floor(ch.pos.x / 8) * 4099 + Math.floor(ch.pos.z / 8));
    if (list) {
      for (const p of list) {
        if (!p.solid || ch.pos.y >= p.top - 0.45 || ch.pos.y < (p.bottom ?? -99) - 2) continue;
        if (p.minX !== undefined) boxes.push(p);
        else this.pushCircle(ch.pos, p.x, p.z, p.r + ch.radius);
      }
    }
    ch.collide(boxes);
    for (const c of T.cyls) {
      const d = Math.hypot(ch.pos.x - c.x, ch.pos.z - c.z);
      if (c.rail) {
        if (ch.pos.y > c.minY && ch.pos.y < c.top && d > c.r - 0.5 && d < c.r + 1.5) {
          ch.pos.x = c.x + ((ch.pos.x - c.x) / d) * (c.r - 0.5);
          ch.pos.z = c.z + ((ch.pos.z - c.z) / d) * (c.r - 0.5);
        }
      } else if (ch.pos.y < c.top) this.pushCircle(ch.pos, c.x, c.z, c.r + ch.radius);
    }
    const b = this.bounds;
    ch.pos.x = clamp(ch.pos.x, b.minX, b.maxX);
    ch.pos.z = clamp(ch.pos.z, b.minZ, b.maxZ);
    // gradini troppo alti e pareti troppo ripide non si salgono
    const g = T.support(ch.pos.x, ch.pos.z, ch.pos.y);
    const tg = T.heightAt(ch.pos.x, ch.pos.z);
    let revert = g - ch.pos.y > 0.6;
    if (!revert && g === tg && ch.grounded) {
      const rise = tg - T.heightAt(ox, oz);
      const run = Math.hypot(ch.pos.x - ox, ch.pos.z - oz) || 1e-3;
      if (rise > 0.03 && rise / run > 1.3) revert = true;
    }
    if (revert) {
      ch.pos.x = ox;
      ch.pos.z = oz;
    }
    const ground = T.support(ch.pos.x, ch.pos.z, ch.pos.y);
    ch.vel.y = (ch.vel.y || 0) - 22 * dt;
    ch.pos.y += ch.vel.y * dt;
    ch.onPad = null;
    if (ch.pos.y <= ground) {
      ch.pos.y = ground;
      ch.vel.y = 0;
      ch.grounded = true;
      const pf = T.platformAt(ch.pos.x, ch.pos.z);
      if (pf && pf.kind === 'pad' && Math.abs(pf.top - ground) < 0.05) ch.onPad = pf.pad;
    } else if (ch.pos.y - ground < 0.6 && ch.vel.y <= 0 && ch.grounded) {
      ch.pos.y = ground;
      ch.vel.y = 0;
    } else ch.grounded = false;
  }

  pushCircle(pos, x, z, r) {
    const dx = pos.x - x;
    const dz = pos.z - z;
    const d = Math.hypot(dx, dz);
    if (d >= r || d < 1e-5) return;
    pos.x = x + (dx / d) * r;
    pos.z = z + (dz / d) * r;
  }

  updateFoot(dt) {
    const { input, audio } = this.ctx;
    const p = this.player;
    const wasGrounded = p.grounded;
    super.updateFoot(dt);
    if (p.grounded) this.dbl = false;
    else if (input.wasPressed('Space') && !wasGrounded && !this.dbl) {
      this.dbl = true;
      p.vel.y = 7.8;
      audio.whoosh(0.15);
      this.sparks.burst?.(p.pos.x, p.pos.y + 0.3, p.pos.z, 10, 3, { color: [1, 1, 1], size: 0.5, life: 0.4 });
    }
    // i funghi ti lanciano in aria
    if (p.onPad) {
      const pd = p.onPad;
      p.vel.y = pd.pad.power;
      p.grounded = false;
      p.onPad = null;
      pd.squash = 1;
      this.dbl = false;
      audio.whoosh(0.4);
      audio.chime(523, 0.08);
      if (pd.pad.kind === 'summit' && !this.flags.padLine) {
        this.flags.padLine = true;
        this.later(0.6, () => this.ctx.ui.subtitle(FRIEND, 'Waaah! Dritti in vetta!', 2));
      }
    }
    if (this.friend.onPad) {
      this.friend.vel.y = this.friend.onPad.pad.power;
      this.friend.onPad = null;
    }
  }

  busy() {
    return this.mode !== 'foot';
  }

  // ---------- Le cose da fare ----------
  interaction(p) {
    const near = (v, r) => Math.hypot(v.x - p.x, v.z - p.z) < r && Math.abs((v.y ?? p.y) - p.y) < 3;
    const W = this.world;
    if (near(W.hut, 1.8)) return { label: 'apri la porta 1313', fn: () => this.leave(() => this.ctx.travel('suite')) };
    if (near(W.pierEnd, 3.5) && this.mode === 'foot') return { label: 'sali sull\'idrovolante: si torna all\'aeroporto', fn: () => this.leave(() => this.ctx.goto('aeroporto', 'arrivi')) };
    if (near(this.pilot.pos, 2.6)) return { label: 'parla con il vecchio pilota', fn: () => this.talkPilot() };
    if (near(this.seller.pos, 2.6)) return { label: this.saved.plane ? 'parla con la venditrice' : 'compra il Pellicano', fn: () => this.talkSeller() };
    if (this.saved.plane && near(this.plane.pos, 4.5)) return { label: this.saved.boss ? 'sali sul Pellicano e vola' : 'sali sul Pellicano: si va a caccia del gabbiano', fn: () => this.takeOff() };
    if (!this.race && RACE.start && near(RACE.start, 2.4)) return { label: this.saved.pages.includes('gara') ? 'rifai la gara degli anelli' : 'inizia la gara degli anelli', fn: () => this.startRace() };
    return null;
  }

  talkPilot() {
    const { ui, audio } = this.ctx;
    const s = this.saved;
    if (s.glasses && !s.glassesGiven) {
      s.glassesGiven = true;
      ui.subtitle(PILOT, 'I miei occhiali! Ora ci vedo. E questa... è una pagina della tua patente. Era incastrata nella grondaia.', 4.4);
      audio.chime(659, 0.1);
      this.later(1.2, () => this.givePage('pilota'));
      return;
    }
    if (!s.glasses) {
      ui.subtitle(PILOT, 'Ho perso gli occhiali, giù alle rovine. Sono finiti in cima alla colonna più alta. Le casse aiutano, ma ci vuole il doppio salto.', 5);
      return;
    }
    const lines = [
      'In volo: W per salire, S per scendere, A e D per virare. Shift per spingere. Spazio per sparare.',
      'Il gabbiano ha quattro turbine sotto le ali. Quando le spegni, si apre e si vede il cuore.',
      'Le piume d\'acciaio ti inseguono, ma virano male. Stringi la curva e le semini. O le abbatti.',
    ];
    ui.subtitle(PILOT, lines[(this.pilotIdx = ((this.pilotIdx ?? -1) + 1) % lines.length)], 4.6);
  }

  talkSeller() {
    const { ui, audio } = this.ctx;
    const s = this.saved;
    if (s.plane) {
      ui.subtitle(SELLER, s.boss ? 'Il Pellicano non è mai volato così bene. Tenetelo, è vostro.' : 'Il Pellicano è lì davanti. Andate a prendervi quel gabbiano.', 3.4);
      return;
    }
    if (this.pageCount < 5) {
      ui.subtitle(SELLER, `Senza patente non posso vendervi niente. Ne avete ${this.pageCount} pagine su cinque.`, 3.6);
      return;
    }
    if (this.coinCount < PLANE_PRICE) {
      ui.subtitle(SELLER, `Il Pellicano costa ${PLANE_PRICE} monete. Ne avete ${this.coinCount}. Cercate meglio: ce ne sono dappertutto.`, 3.8);
      return;
    }
    s.plane = true;
    this.save();
    this.updateObjective();
    audio.ding(0.2);
    ui.popup('Il Pellicano è vostro!');
    ui.subtitle(SELLER, 'Patente in regola, monete contate. Il Pellicano è vostro. Trattatelo bene.', 3.6);
    this.later(4, () => ui.subtitle(FRIEND, 'Abbiamo un aereo. Un aereo vero! Saliamo.', 2.8));
  }

  givePage(id) {
    const { ui, audio } = this.ctx;
    if (this.saved.pages.includes(id)) return;
    this.saved.pages.push(id);
    this.save();
    const n = this.pageCount;
    ui.popup(`Pagina della patente ${n}/5`);
    [523, 659, 784, 1047].forEach((f, i) => setTimeout(() => audio.chime(f, 0.12), i * 110));
    this.updateObjective();
    const p = this.world.pages.find((q) => q.id === id);
    if (p) p.group.visible = false;
    if (n === 5) this.later(1.6, () => ui.subtitle(FRIEND, 'La patente è completa! Adesso servono le monete per l\'aereo. All\'hangar vicino alla pista.', 3.8));
    else this.later(1.4, () => ui.subtitle(FRIEND, ['Una pagina! Ne mancano ancora.', 'Un\'altra pagina. Ci siamo quasi.', 'Questa era in un posto assurdo.'][n % 3], 2.4));
  }

  // ---------- La gara degli anelli ----------
  startRace() {
    this.race = { i: 0, t: RACE.time };
    this.ctx.audio.groove('gara', { notes: [392, 493.9, 587.3, 784, 659.3], tempo: 150, drums: 1.5, vol: 0.02, seed: 7 });
    this.ctx.audio.chime(880, 0.1);
    this.ctx.ui.subtitle(null, `Dieci anelli in ${RACE.time} secondi. <kbd>Shift</kbd> per correre, <kbd>Spazio</kbd> per quelli alti.`, 3.4);
    for (const r of this.world.rings) r.mesh.material.color.set('#ffd23a');
  }

  updateRace(dt) {
    const R = this.race;
    if (!R) return;
    const { ui, audio } = this.ctx;
    R.t -= dt;
    const rings = this.world.rings;
    const ring = rings[R.i];
    const p = this.player.pos;
    for (const [k, r] of rings.entries()) r.mesh.visible = k >= R.i;
    ring.mesh.scale.setScalar(1 + Math.sin(this.time * 8) * 0.06);
    if (Math.hypot(p.x - ring.x, p.y + 1 - ring.y, p.z - ring.z) < 2.1) {
      ring.mesh.scale.setScalar(1);
      R.i++;
      audio.chime(660 + R.i * 60, 0.09);
      if (R.i >= rings.length) {
        this.race = null;
      this.ctx.audio.stopGroove('gara', 1);
        this.ctx.audio.stopGroove('gara', 1);
        for (const r of rings) r.mesh.visible = true;
        ui.popup('Gara vinta!');
        if (!this.saved.pages.includes('gara')) {
          ui.subtitle(FRIEND, 'Fatto! E dall\'ultimo anello è caduta... una pagina!', 3);
          this.givePage('gara');
        } else this.updateObjective();
        return;
      }
    }
    ui.objective(`Gara degli anelli · anello ${R.i + 1}/${rings.length} · ${Math.ceil(R.t)} s`);
    if (R.t <= 0) {
      this.race = null;
      this.ctx.audio.stopGroove('gara', 1);
      for (const r of rings) r.mesh.visible = true;
      audio.thud(0.3);
      ui.popup('Tempo scaduto', true);
      ui.subtitle(FRIEND, 'Per poco! Riproviamo dal cartello.', 2.4);
      this.updateObjective();
    }
  }

  // ---------- In volo ----------
  takeOff() {
    const { ui, audio } = this.ctx;
    this.mode = 'plane';
    this.player.group.visible = false;
    this.friend.group.visible = false;
    if (this.followers) this.followers.mesh.visible = false;
    ui.hint(null);
    ui.calm(false);
    ui.crosshair(true);
    ui.configureHud({
      unit: 'km/h',
      turboLabel: 'Spinta <kbd>Shift</kbd>',
      healthLabel: 'Pellicano',
      controls: '<kbd>W</kbd><kbd>S</kbd> sali / scendi · <kbd>A</kbd><kbd>D</kbd> vira · <kbd>Shift</kbd> spinta · <kbd>Spazio</kbd> spara · <kbd>E</kbd> atterra',
    });
    const y = this.world.villageY;
    this.plane.place(STRIP.minX + 12, y + 3.5, STRIP.z, Math.PI / 2);
    this.plane.pitch = 0.25;
    this.plane.hp = 1;
    this.camPos.set(STRIP.minX - 4, y + 6, STRIP.z);
    audio.engineStart();
    audio.whoosh(0.4);
    this.fight = !this.saved.boss;
    this.boss.passive = !this.fight;
    // in volo la musica si mette a correre; contro il gabbiano, con la batteria
    audio.groove('volo', this.fight ? { notes: [261.6, 329.6, 392, 523.3, 440], tempo: 138, drums: 1.2, vol: 0.022, seed: 3 } : { notes: [261.6, 329.6, 392, 493.9], tempo: 96, vol: 0.016, seed: 5 });
    if (this.fight) {
      this.later(2.5, () => ui.subtitle(FRIEND, 'Si vola! Il gabbiano è lassù, gira intorno all\'isola. La bussola lo indica.', 3.4));
      this.later(7, () => ui.subtitle(PILOT, '(alla radio) Le turbine arancioni sotto le ali. Mira lì.', 3.2));
    } else this.later(1.5, () => ui.subtitle(FRIEND, 'Il cielo è tutto nostro. <kbd>E</kbd> per atterrare.', 3));
  }

  land() {
    const { ui, audio } = this.ctx;
    audio.engineStop();
    audio.stopGroove('volo');
    ui.crosshair(false);
    ui.calm(true);
    ui.fade(1, 500, '#ffffff').then(() => {
      this.mode = 'foot';
      this.parkPlane();
      this.player.group.visible = true;
      this.friend.group.visible = true;
      if (this.followers) this.followers.mesh.visible = true;
      this.boss.passive = true;
      ui.configureHud({
        unit: '',
        turboLabel: 'Fiato <kbd>Shift</kbd>',
        healthLabel: 'Calma',
        controls: 'Clicca per usare il mouse · <kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd> cammina · <kbd>E</kbd> interagisci · <kbd>Spazio</kbd> salta (due volte: doppio salto)',
      });
      this.place(SHOP.x + 2, SHOP.z + 20, Math.PI);
      this.updateObjective();
      ui.fade(0, 700, '#ffffff');
    });
    this.mode = 'landing';
  }

  updatePlane(dt) {
    const { input, ui, audio } = this.ctx;
    const pl = this.plane;
    const B = this.boss;
    const ctl = {
      up: input.down('KeyW', 'ArrowUp'),
      down: input.down('KeyS', 'ArrowDown'),
      left: input.down('KeyA', 'ArrowLeft'),
      right: input.down('KeyD', 'ArrowRight'),
      boost: input.down('ShiftLeft', 'ShiftRight'),
      fire: input.down('Space'),
    };
    // l'aiuto alla mira: il bersaglio più vicino al mirino
    let assist = null;
    if (this.fight) {
      const f = pl.forward.clone();
      let best = 0.975;
      for (const t of B.targets()) {
        // mira un po' avanti, dove il bersaglio sarà quando arrivano i colpi
        const lead = t.pos.clone().addScaledVector(B.vel, t.pos.distanceTo(pl.pos) / 210);
        const d = lead.clone().sub(pl.pos).normalize().dot(f);
        if (d > best) {
          best = d;
          assist = lead;
        }
      }
    }
    pl.update(dt, ctl, (x, z) => this.terrain.heightAt(x, z), assist);
    if (pl.shot && Math.random() < 0.5) audio.pop(0.03);
    if (pl.scraped && pl.hurtT <= 0) {
      pl.hurtT = 1;
      pl.hp -= 0.08;
      audio.thud(0.4);
      this.shake = 0.6;
      ui.subtitle(FRIEND, 'Troppo basso! Su, su!', 1.6);
    }
    if (pl.outside && !this.flags.outLine) {
      this.flags.outLine = true;
      this.later(6, () => (this.flags.outLine = false));
      ui.subtitle(FRIEND, 'Troppo lontano. Torniamo verso l\'isola.', 2);
    }
    audio.engineUpdate(clamp(pl.speed / 70, 0.2, 1), ctl.boost ? 1 : 0.6, ctl.boost);

    // il combattimento
    if (this.fight) {
      const ev = B.update(dt, pl.pos);
      for (const b of pl.bullets) {
        const m = B.shootMissile(b);
        if (m) {
          b.dead = true;
          this.sparks.burst?.(m.x, m.y, m.z, 14, 8, { color: [1, 0.8, 0.4], size: 1.2, life: 0.5 });
          audio.pop(0.08);
          continue;
        }
        const h = B.hit(b);
        if (h) {
          b.dead = true;
          const c = h === 'armor' ? [0.8, 0.85, 1] : [1, 0.6, 0.2];
          this.sparks.burst?.(b.p.x, b.p.y, b.p.z, h === 'armor' ? 3 : 8, 6, { color: c, size: 0.9, life: 0.35 });
        }
      }
      if (B.justBroke) {
        B.justBroke = false;
        audio.boom(0.4);
        const left = B.turbines.filter((t) => t.alive).length;
        ui.popup(left ? `Turbina spenta · ne restano ${left}` : 'Il gabbiano si apre!');
        if (!left) {
          audio.roar(0.6);
          this.later(1, () => ui.subtitle(FRIEND, 'Si è aperto lo sportello sul petto! Il cuore rosso: mira lì!', 3.2));
        }
      }
      for (const t of B.turbines) {
        if (t.alive) continue;
        t.smokeT -= dt;
        if (t.smokeT <= 0) {
          t.smokeT = 0.08;
          const w = t.group.getWorldPosition(new THREE.Vector3());
          this.smoke.emit(w.x, w.y, w.z, (Math.random() - 0.5) * 2, 1, (Math.random() - 0.5) * 2, { color: [0.2, 0.2, 0.22], size: 4, endSize: 14, life: 3, alpha: 0.6, drag: 0.4 });
        }
      }
      for (const h of ev.hits) {
        pl.hp -= 0.14;
        this.shake = 0.9;
        audio.boom(0.35);
        this.sparks.burst?.(h.x, h.y, h.z, 20, 10, { color: [1, 0.5, 0.2], size: 1.4, life: 0.6 });
      }
      if (ev.fired && !this.flags.featherLine) {
        this.flags.featherLine = true;
        ui.subtitle(FRIEND, 'Piume d\'acciaio! Ci inseguono: vira stretto, o abbattile!', 3);
      }
      if (B.dead && !this.flags.won) {
        this.flags.won = true;
        this.victory();
      }
      if (ev.splash) {
        audio.boom(0.8);
        for (let i = 0; i < 60; i++) this.smoke.emit(B.pos.x + (Math.random() - 0.5) * 30, 0.5, B.pos.z + (Math.random() - 0.5) * 30, (Math.random() - 0.5) * 6, 8 + Math.random() * 12, (Math.random() - 0.5) * 6, { color: [0.95, 0.98, 1], size: 5, endSize: 16, life: 3, alpha: 0.8, gravity: 9, drag: 0.3 });
        this.later(2.5, () => (B.group.visible = false));
      }
      if (pl.hp <= 0 && !this.crashing) this.crash();
      const bossAngle = Math.atan2(B.pos.x - pl.pos.x, B.pos.z - pl.pos.z);
      const camYaw = Math.atan2(this.camLook.x - this.camera.position.x, this.camLook.z - this.camera.position.z);
      ui.compass(B.dead ? null : -(bossAngle - camYaw));
    } else {
      B.update(dt, pl.pos);
      ui.compass(null);
    }
    if (input.wasPressed('KeyE') && !this.crashing && (!this.fight || B.dead)) this.land();
    else if (input.wasPressed('KeyE') && this.fight && !B.dead && !this.flags.landLine) {
      this.flags.landLine = true;
      this.later(5, () => (this.flags.landLine = false));
      ui.subtitle(FRIEND, 'Atterrare adesso? Con il gabbiano in giro? Prima battiamolo!', 2.6);
    }
    this.updatePlaneCamera(dt);
    const bossPct = Math.round(B.health * 100);
    ui.updateHud({ speed: pl.speed * 3.6, turbo: pl.boost, health: pl.hp, time: this.time, counter: this.fight && !B.dead ? `Gabbiano di Ferro ${bossPct}%` : 'L\'Isola' });
  }

  crash() {
    const { ui, audio } = this.ctx;
    this.crashing = true;
    audio.boom(0.7);
    ui.subtitle(FRIEND, 'Ci ha preso! Tieniti forte...', 2);
    ui.fade(1, 700, '#ffffff').then(() => {
      const pl = this.plane;
      pl.place(0, 160, 330, Math.PI);
      pl.hp = 1;
      this.camPos.set(0, 166, 345);
      this.crashing = false;
      this.boss.missiles.length = 0;
      ui.subtitle(FRIEND, 'Siamo ancora in aria. Il Pellicano è più duro di quanto sembra. Riproviamo!', 3.2);
      ui.fade(0, 900, '#ffffff');
    });
  }

  victory() {
    const { ui, audio } = this.ctx;
    this.saved.boss = true;
    this.save();
    audio.boom(1);
    audio.roar(0.7);
    const B = this.boss;
    B.vel.set(B.vel.x * 0.4, 4, B.vel.z * 0.4);
    for (let i = 0; i < 80; i++) this.sparks.emit(B.pos.x, B.pos.y, B.pos.z, (Math.random() - 0.5) * 40, (Math.random() - 0.5) * 40, (Math.random() - 0.5) * 40, { color: [1, 0.6, 0.2], size: 3, endSize: 0.5, life: 1.4, drag: 1 });
    this.later(1.2, () => ui.subtitle(FRIEND, 'Il Gabbiano di Ferro cade! Ce l\'abbiamo fatta!', 3));
    this.later(5, () => {
      ui.center('<div class="dream-title"><div class="num">L\'Isola</div><h2>Asso dei cieli</h2><p>La patente, l\'aereo, il gabbiano. Tutto quello che c\'era da fare.</p></div>');
      audio.chime(523, 0.15);
      setTimeout(() => audio.chime(784, 0.15), 200);
      setTimeout(() => audio.chime(1047, 0.15), 400);
    });
    this.later(10, () => {
      ui.center(null);
      this.updateObjective();
      ui.subtitle(FRIEND, 'Adesso il cielo è nostro. Voliamo quanto vuoi, poi <kbd>E</kbd> per atterrare.', 3.6);
    });
  }

  updatePlaneCamera(dt) {
    const pl = this.plane;
    const f = pl.forward;
    const tx = pl.pos.x - f.x * 15;
    const ty = pl.pos.y - f.y * 15 + 4.5;
    const tz = pl.pos.z - f.z * 15;
    const k = 1 - Math.exp(-4 * dt);
    this.camPos.x += (tx - this.camPos.x) * k;
    this.camPos.y += (ty - this.camPos.y) * k;
    this.camPos.z += (tz - this.camPos.z) * k;
    this.camPos.y = Math.max(this.camPos.y, Math.max(this.terrain.heightAt(this.camPos.x, this.camPos.z), 0) + 1.5);
    const look = this.tmpV.copy(pl.pos).addScaledVector(f, 25);
    this.camLook.lerp(look, 1 - Math.exp(-8 * dt));
    this.shake = (this.shake || 0) * Math.exp(-3 * dt);
    const s = this.shake;
    this.camera.position.set(this.camPos.x + (Math.random() - 0.5) * s, this.camPos.y + (Math.random() - 0.5) * s, this.camPos.z + (Math.random() - 0.5) * s);
    this.camera.lookAt(this.camLook);
    const fov = 66 + clamp((pl.speed - 38) / 30, 0, 1) * 14;
    this.camera.fov += (fov - this.camera.fov) * (1 - Math.exp(-3 * dt));
    this.camera.updateProjectionMatrix();
  }

  // ---------- Ogni fotogramma ----------
  // quello che l'amico dice, camminando, in questo sogno
  chatter() {
    const s = this.saved;
    return [
      'Quest\'isola sembra fatta apposta per noi. Monete dappertutto, come in un videogioco.',
      'Senti il profumo del mare? Qui è tutto più colorato che a casa.',
      ...(s.plane ? ['Il Pellicano ci aspetta all\'hangar. Facciamo un altro giro?'] : ['Con un aereo vedremmo l\'isola da sopra. Pensa che bello.']),
      ...(s.pages.length < 5 ? ['Le pagine della patente... una era in cima alla montagna, ne sono sicuro.'] : []),
    ];
  }

  tick(dt) {
    const { ui, audio } = this.ctx;
    const t = this.time;
    const W = this.world;
    W.update(t);
    this.sky.update(this.camera, dt);
    this.sparks.update(dt);
    this.smoke.update(dt);
    this.pilot.animate(dt, 0);
    this.seller.animate(dt, 0);
    this.pilot.facing = Math.atan2(this.player.pos.x - this.pilot.pos.x, this.player.pos.z - this.pilot.pos.z);
    this.seller.facing = Math.atan2(this.player.pos.x - this.seller.pos.x, this.player.pos.z - this.seller.pos.z);

    if (this.mode === 'plane') {
      this.updatePlane(dt);
    } else {
      if (!this.cine && !this.saved.boss) this.boss.update(dt, this.player.pos);
      const p = this.player.pos;
      // le monete
      let got = 0;
      for (const c of W.coins) {
        if (this.taken.has(c.id)) continue;
        if (Math.abs(c.x - p.x) < 1.2 && Math.abs(c.z - p.z) < 1.2 && Math.abs(c.y - (p.y + 1)) < 1.5) {
          this.taken.add(c.id);
          got++;
        }
      }
      if (got) {
        audio.chime(1568, 0.06);
        setTimeout(() => audio.chime(2093, 0.05), 70);
        this.save();
        this.updateObjective();
        if (this.coinCount === PLANE_PRICE && !this.saved.plane) {
          ui.popup(`${PLANE_PRICE} monete!`);
          ui.subtitle(FRIEND, 'Cento monete! Abbastanza per un aereo usato.', 2.8);
        }
      }
      // le pagine
      for (const pg of W.pages) {
        if (this.saved.pages.includes(pg.id)) continue;
        if (Math.hypot(pg.x - p.x, pg.z - p.z) < 1.8 && Math.abs(pg.y - p.y) < 2.5) this.givePage(pg.id);
      }
      // gli occhiali del pilota
      if (!this.saved.glasses && Math.hypot(W.glasses.position.x - p.x, W.glasses.position.z - p.z) < 1.5 && Math.abs(W.glasses.position.y - 0.6 - p.y) < 1.6) {
        this.saved.glasses = true;
        W.glasses.visible = false;
        this.save();
        audio.chime(880, 0.1);
        ui.popup('Gli occhiali del vecchio pilota');
        ui.subtitle(FRIEND, 'Gli occhiali! Riportiamoli al vecchio pilota, al villaggio.', 3);
      }
      this.updateRace(dt);
      // il mare: chi ci cade ricompare a riva
      const gp = this.terrain.support(p.x, p.z, p.y);
      if (this.player.grounded && gp > 0.1) {
        this.safeT -= dt;
        if (this.safeT <= 0) {
          this.safeT = 0.4;
          this.lastSafe.copy(p);
        }
      }
      if (this.mode === 'foot' && !this.cine && p.y < -0.45 && gp < -0.4) {
        audio.whoosh(0.4);
        this.smoke.burst?.(p.x, 0.2, p.z, 20, 4, { color: [1, 1, 1], size: 1.2, life: 0.8 });
        ui.subtitle(FRIEND, 'Splash! Qui non si tocca. Torniamo a riva.', 2);
        this.player.pos.copy(this.lastSafe);
        this.player.vel.set(0, 0, 0);
        this.friend.pos.copy(this.lastSafe);
        this.updateCamera(1, true);
      }
      // la bussola: verso la prossima cosa da fare
      if (!this.cine && this.mode === 'foot') {
        const target = this.nextTarget();
        if (target) {
          const camYaw = Math.atan2(this.camLook.x - this.camera.position.x, this.camLook.z - this.camera.position.z);
          ui.compass(-(Math.atan2(target.x - p.x, target.z - p.z) - camYaw));
        } else ui.compass(null);
      }
      if (Math.random() < dt * 0.15) audio.gull(0.02);
    }
    const sp = this.mode === 'plane' ? this.plane.pos : this.player.pos;
    this.sun.position.set(sp.x - 40, sp.y + 120, sp.z + 75);
    this.sun.target.position.copy(sp);
  }

  // la pagina più vicina, poi gli occhiali, poi l'hangar
  nextTarget() {
    const s = this.saved;
    const p = this.player.pos;
    if (s.glasses && !s.glassesGiven) return this.pilot.pos;
    let best = null;
    let bd = Infinity;
    for (const pg of this.world.pages) {
      if (s.pages.includes(pg.id)) continue;
      const d = Math.hypot(pg.x - p.x, pg.z - p.z);
      if (d < bd && d > 4) {
        bd = d;
        best = pg;
      }
    }
    if (best) return best;
    if (!s.pages.includes('gara') && !this.race) return RACE.start;
    if (!s.glasses) return { x: this.terrain.column.x, z: this.terrain.column.z };
    if (this.pageCount >= 5 && !s.plane && this.coinCount >= PLANE_PRICE) return this.seller.pos;
    if (s.plane && !s.boss) return this.plane.pos;
    return null;
  }

  dispose() {
    super.dispose();
    const { audio, ui } = this.ctx;
    audio.engineStop();
    audio.ambience(null);
    ui.compass(null);
    ui.crosshair(false);
    ui.calm(true);
    this.world.dispose();
    this.plane.dispose();
    this.boss.dispose();
    this.pilot.dispose();
    this.seller.dispose();
    this.sparks.dispose();
    this.smoke.dispose();
    this.sky.mesh.geometry.dispose();
    this.sky.mesh.material.dispose();
  }
}

