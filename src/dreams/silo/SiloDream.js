import * as THREE from 'three';
import { WalkScene, FRIEND } from '../../core/walkscene.js';
import { createSky } from '../../core/sky.js';
import { unlockPlace } from '../../core/places.js';
import { Character } from '../hotel/character.js';
import { buildIsland, heightAt, onPier, pierY, zoneAt, PLANE_SPOT, STONES, BEACH, LIGHT, CAVE, HARBOR, PIER, VILLAGE } from './island.js';
import { buildInterior, INSIDE } from './interior.js';
import { buildVillage } from './village.js';
import { buildLighthouse, buildCaves, FARO, GROTTE } from './dungeons.js';
import { buildChest, buildSaveLantern } from './props.js';
import { buildAbyss, ABISSO } from './abyss.js';
import { Fishing } from './fishing.js';
import { buildTide } from './tide.js';
import { glowTexture } from '../../core/textures.js';
import { Storm } from './storm.js';
import { Battle } from './battle.js';
import { monsterModel } from './monsters.js';
import { GROUPS, ZONES, CHESTS, ITEMS, GEAR, KEY_ITEMS, MAIN, SIDE, PARTY, initCampaign, memberStats, spFree, abyssTier, abyssBoss, knownOverdrives, OVERDRIVES, FISH, FISH_SPOTS } from './data.js';
import { Dialog, Shop, PartyMenu } from './rpgui.js';
import { NPCS, talk } from './campaign.js';

// L'Isola della Tempesta, una piccola campagna da gioco di ruolo. Si arriva in
// idrovolante a Porto Grigio, un villaggio di pescatori. Per aprire il silo dove
// dorme il dio servono due sigilli: uno in cima al Faro Spento, l'altro nelle
// Grotte dei Cirripedi. In mezzo: la brughiera, la Spiaggia Nera, missioni,
// forzieri, un negozio, una locanda, Marta con il suo arpione. Si combatte a
// turni, come in Final Fantasy X.

const SAVES = {
  villaggio: { region: 'isola', name: 'Porto Grigio' },
  faro: { region: 'faro', name: 'Il Faro Spento' },
  grotte: { region: 'grotte', name: 'Le Grotte dei Cirripedi' },
  silo: { region: 'silo', name: 'Il Silo' },
};

export class SiloDream extends WalkScene {
  constructor(ctx) {
    const bg = '#3a434c';
    super(ctx, { background: bg, far: 1500, speed: 5.5 });
    this.saved = initCampaign(ctx.progress.silo || {});
    const sv = this.saved;
    const S = this.scene;
    this.calm = !!sv.god; // dopo la caccia la tempesta è passata
    S.fog = new THREE.Fog(bg, 30, this.calm ? 700 : 420);
    this.sky = createSky();
    const u = this.sky.uniforms;
    u.top.value.set('#0e1216');
    u.horizon.value.set('#3a434c');
    u.bottom.value.set('#14181c');
    u.sunColor.value.set('#000000');
    S.add(this.sky.mesh);
    this.hemi = new THREE.HemisphereLight('#a8b8c8', '#3a3a3c', 1.5);
    this.dir = new THREE.DirectionalLight(this.calm ? '#ffc890' : '#b8c8e0', this.calm ? 1.4 : 0.8);
    this.dir.position.set(-60, 80, 120);
    S.add(this.hemi, this.dir);
    // i luoghi
    this.island = buildIsland(S);
    this.village = buildVillage(S);
    this.inside = buildInterior(S);
    this.faro = buildLighthouse(S);
    this.grotte = buildCaves(S);
    this.abyss = buildAbyss(S);
    this.tide = buildTide(S, heightAt);
    this.colliders = this.island.colliders.concat(this.village.colliders);
    this.storm = new Storm(S, { lights: [{ light: this.hemi, base: this.hemi.intensity }], sky: this.calm ? null : this.sky, audio: ctx.audio });
    if (this.calm) {
      this.calmSky();
      this.storm.rain.visible = false;
    }
    if (sv.faroLit) {
      this.island.setLighthouseLit(true);
      this.faro.setLensLit(true);
    }
    // le finestre
    this.dialog = new Dialog(ctx);
    this.shop = new Shop(ctx);
    this.menu = new PartyMenu(ctx);
    this.fishing = new Fishing(ctx);
    // il gruppo in combattimento: Marta, con il suo arpione, compare negli scontri
    this.marta = new Character(S, { ...NPCS.marta.look });
    this.marta.group.visible = false;
    // gli abitanti
    this.npcs = {};
    for (const [id, d] of Object.entries(NPCS)) {
      const c = id === 'marta' ? new Character(S, { ...d.look }) : new Character(S, { ...d.look });
      if (d.kid) c.group.scale.setScalar(0.68);
      this.npcs[id] = { id, c, d, home: this.npcSpot(id) };
    }
    this.placeNpcs();
    // forzieri e lanterne
    this.chests = [];
    const chestSpots = [
      { id: 'isola1', pos: this.groundV(STONES.x + 14, STONES.z + 11) },
      { id: 'isola2', pos: this.groundV(BEACH.x - Math.cos(BEACH.a) * 4, BEACH.z - Math.sin(BEACH.a) * 4) },
      { id: 'isola3', pos: this.groundV(LIGHT.x + Math.cos(LIGHT.a) * 7, LIGHT.z + Math.sin(LIGHT.a) * 7) },
      { id: 'isola4', pos: this.groundV(CAVE.x - Math.cos(CAVE.a) * 9 + 4, CAVE.z - Math.sin(CAVE.a) * 9) },
      ...this.faro.spots.chests,
      ...this.grotte.spots.chests,
      { id: 'silo1', pos: this.inside.center.clone().add(new THREE.Vector3(-26, 0, 22)) },
      ...this.tide.paths.map((P) => ({ id: P.id, pos: new THREE.Vector3(P.islet.x, -1.75, P.islet.z) })),
    ];
    for (const c of chestSpots) {
      const ch = buildChest(S, c.pos, Math.random() * 6);
      ch.id = c.id;
      if (sv.chests[c.id]) ch.open(true);
      this.chests.push(ch);
    }
    this.lanterns = [
      { id: 'villaggio', l: buildSaveLantern(S, this.village.spots.save) },
      { id: 'faro', l: buildSaveLantern(S, this.faro.spots.save) },
      { id: 'grotte', l: buildSaveLantern(S, this.grotte.spots.save) },
      { id: 'silo', l: buildSaveLantern(S, this.inside.entrance.clone().add(new THREE.Vector3(5, 0, -2))) },
    ];
    // la lanterna di Ada, fra le pietre
    this.adaLantern = new THREE.Sprite(new THREE.SpriteMaterial({ color: '#ffd890', blending: THREE.AdditiveBlending, transparent: true, opacity: 0.9, depthWrite: false }));
    this.adaLantern.scale.set(1.4, 1.4, 1);
    this.adaLantern.position.copy(this.island.stoneSpots[2]).add(new THREE.Vector3(0, 0.6, 0));
    S.add(this.adaLantern);
    // i boss visibili: il Granchio Re in cima al faro, la Madre nelle grotte, l'Anguillone sulla spiaggia
    this.bosses = {};
    const bossAt = (id, model, pos, rotY = 0) => {
      const m = monsterModel(model);
      m.group.position.copy(pos);
      m.group.rotation.y = rotY;
      S.add(m.group);
      this.bosses[id] = m;
    };
    bossAt('granchiore', 'crabking', this.faro.spots.boss);
    bossAt('madre', 'jellymother', this.grotte.spots.boss);
    bossAt('anguillone', 'eelking', this.groundV(BEACH.x, BEACH.z), 0);
    // dove si pesca: l'acqua fa le bolle
    const glow = glowTexture('rgba(255,255,255,1)');
    this.glowTex = glow;
    const H = HARBOR;
    const hl = Math.hypot(H.x1 - H.x0, H.z1 - H.z0);
    const hd = { x: (H.x1 - H.x0) / hl, z: (H.z1 - H.z0) / hl };
    const C = this.grotte.chambers.find((c) => c.lake);
    this.fishSpots = [
      { id: 'porto', pos: new THREE.Vector3(H.x0 + hd.x * hl * 0.55 - hd.z * (H.halfW - 0.7), H.y, H.z0 + hd.z * hl * 0.55 + hd.x * (H.halfW - 0.7)), water: new THREE.Vector3(-hd.z * 4, 0, hd.x * 4) },
      { id: 'molo', pos: new THREE.Vector3(PIER.x + PIER.halfW - 0.8, PIER.y, PIER.z1 - 8), water: new THREE.Vector3(4, 0, 0) },
      { id: 'spiaggia', pos: this.groundV(BEACH.x + Math.cos(BEACH.a) * 11, BEACH.z + Math.sin(BEACH.a) * 11), water: new THREE.Vector3(Math.cos(BEACH.a) * 5, 0, Math.sin(BEACH.a) * 5) },
      { id: 'lago', pos: new THREE.Vector3(C.center.x + C.lx - C.lake - 1.3, 0, C.center.z + C.lz), water: new THREE.Vector3(2.5, 0, 0) },
    ];
    this.marks = [];
    const mark = (pos, color, size) => {
      const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: glow, color, blending: THREE.AdditiveBlending, transparent: true, opacity: 0.8, depthWrite: false }));
      sp.position.copy(pos);
      sp.scale.set(size, size, 1);
      S.add(sp);
      this.marks.push(sp);
      return sp;
    };
    for (const f of this.fishSpots) {
      const w = f.pos.clone().add(f.water);
      w.y = f.id === 'lago' ? 0.15 : 0.1;
      f.mark = mark(w, '#9ae8ff', 1.6);
    }
    // le conchiglie di Tobia, sparse per l'isola
    this.shellSpots = [
      [60.5, 4.1], [BEACH.x + Math.cos(BEACH.a) * 6, BEACH.z + Math.sin(BEACH.a) * 6], [CAVE.x - Math.cos(CAVE.a) * 16, CAVE.z - Math.sin(CAVE.a) * 16 + 6], [-40, 60], [VILLAGE.x + 34, VILLAGE.z + 22],
    ].map(([x, z], i) => ({ id: `c${i}`, pos: this.groundV(x, z), mark: mark(this.groundV(x, z).add(new THREE.Vector3(0, 0.35, 0)), '#ffb8e0', 1.1) }));
    // il giorno e la notte, e le pause della tempesta (con la bassa marea)
    this.clock = sv.clock ?? 0.35;
    this.lullIn = 45 + Math.random() * 30;
    this.lullOn = false;
    this.lullK = 0;
    this.tideK = this.calm ? 1 : 0;
    this.dayK = 1;
    this.skyCol = { top: new THREE.Color(), hor: new THREE.Color(), fog: new THREE.Color(), a: new THREE.Color(), b: new THREE.Color() };
    // le creature che girano intorno alla statua
    this.roamers = [];
    for (const g of GROUPS) {
      if (sv.cleared.includes(g.id)) continue;
      const m = monsterModel(this.leaderOf(g));
      S.add(m.group);
      this.roamers.push({ g, m, a: g.angle, r: 27, phase: Math.random() * 6 });
    }
    // il dio, per il combattimento: un punto davanti alla statua
    this.bossProxy = { group: new THREE.Object3D(), height: 16, hurt: () => (this.bossFlash = 0.3), update() {} };
    this.bossProxy.group.position.copy(this.inside.arena.boss);
    S.add(this.bossProxy.group);
    const ap = this.inside.arena.party;
    this.inside.arena.party = [ap[0].clone().add(new THREE.Vector3(-2, 0, 0)), ap[1].clone().add(new THREE.Vector3(-2, 0, 0)), ap[1].clone().add(new THREE.Vector3(2, 0, 0)), ap[2].clone().add(new THREE.Vector3(2, 0, 0))];
    this.inside.arena.enemies.push(this.inside.arena.enemies[1].clone().add(new THREE.Vector3(0, 0, 3)));
    // il piccolo riquadro con la vita del gruppo
    this.hud = document.createElement('div');
    this.hud.style.cssText = 'position:fixed;right:18px;top:64px;z-index:30;font:600 12px Inter,sans-serif;color:#fff;text-shadow:1px 1px 0 #000;background:rgba(14,26,86,0.6);border:1px solid rgba(225,232,255,0.6);border-radius:6px;padding:6px 10px;min-width:150px;pointer-events:none';
    document.body.appendChild(this.hud);
    this.hudT = 0;
    this.encounterIn = 30 + Math.random() * 40;

    ctx.ui.configureHud({
      unit: '',
      turboLabel: 'Fiato <kbd>Shift</kbd>',
      healthLabel: 'Calma',
      controls: 'Clicca per usare il mouse · <kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd> cammina · <kbd>E</kbd> parla, apri, usa · <kbd>G</kbd> gruppo e missioni · <kbd>Spazio</kbd> salta',
    });
    this.spawn = ctx.spawn || 'arrivo';
    ctx.spawn = null;
    this.firstVisit = unlockPlace(ctx, 'silo');
    this.region = 'isola';
    if (this.spawn === 'shortcut') this.place(this.island.door13.x, this.island.door13.z + 1.5, 0);
    else this.place(PLANE_SPOT.x - Math.cos(this.harborA()) * 3, PLANE_SPOT.z - Math.sin(this.harborA()) * 3, this.harborA() + Math.PI);
    this.setRegion('isola');

    const { ui, audio } = ctx;
    if (this.spawn === 'arrivo') {
      if (this.calm) this.later(1.2, () => ui.subtitle(FRIEND, 'Il mare è calmo. Porto Grigio sembra un altro posto.', 3.4));
      else if (sv.quests.main === 0) {
        this.later(1.2, () => ui.subtitle(null, 'L\'idrovolante ha ammarato nel porto di un villaggio di pescatori. Porto Grigio. Piove di traverso.', 4.6));
        this.later(6.2, () => ui.subtitle(FRIEND, 'Guarda là, a nord, oltre la brughiera: il silo. Grande come una montagna.', 3.6));
        this.later(10.4, () => ui.subtitle(null, 'Sai perché sei qui: dentro il silo dorme un dio. Ma prima, chiedi in paese. <kbd>G</kbd> apre il menu del gruppo.', 4.8));
      } else this.later(1.2, () => ui.subtitle(FRIEND, 'Di nuovo a Porto Grigio. Ancora questa pioggia.', 3));
    }
    if (this.firstVisit) {
      this.later(16, () => {
        ui.popup('Una nuova porta: L\'Isola della Tempesta');
        audio.chime(784, 0.12);
        ui.subtitle(FRIEND, 'Vicino al silo c\'è un bunker con una porta verde. 1313. Anche qui.', 3.2);
      });
    }
    this.updateObjective();
  }

  // ---------- utilità ----------
  harborA() {
    return Math.atan2(PLANE_SPOT.z - this.village.spots.square.z, PLANE_SPOT.x - this.village.spots.square.x);
  }

  groundV(x, z) {
    return new THREE.Vector3(x, heightAt(x, z), z);
  }

  npcSpot(id) {
    const sp = this.village.spots;
    const k = NPCS[id].spot;
    if (k === 'homes0') return sp.homes[0];
    return sp[k].clone();
  }

  leaderOf(g) {
    return { granchio: 'crab', medusa: 'jelly', anguilla: 'eel', fedele: 'devotee' }[g.foes[Math.floor(g.foes.length / 2)]];
  }

  calmSky() {
    const u = this.sky.uniforms;
    u.top.value.set('#3a5a8a');
    u.horizon.value.set('#e8a070');
    u.bottom.value.set('#2a3a48');
    u.sunColor.value.set('#ffd0a0');
    u.sunDir.value.set(-0.5, 0.12, 0.8).normalize();
    if (this.storm) {
      this.storm.sky = null;
      this.ctx.audio.loopVolume('pioggia', 0);
      this.ctx.audio.loopVolume('vento', 0.02);
    }
    if (this.region === 'isola') {
      this.scene.fog.color.set('#8a8a90');
      this.scene.background.set('#8a8a90');
    }
  }

  // ---------- il giorno, la notte, la tempesta che a volte si ferma ----------
  skyTick(dt) {
    const c = this.clock;
    const sunH = Math.sin((c - 0.25) * Math.PI * 2);
    const smooth = (a, b, x) => {
      const t = Math.max(0, Math.min(1, (x - a) / (b - a)));
      return t * t * (3 - 2 * t);
    };
    const day = smooth(-0.25, 0.3, sunH);
    const dusk = Math.max(0, 1 - Math.abs(sunH) / 0.3);
    this.dayK = day;
    const L = this.lullK;
    const C = this.skyCol;
    const mix = (out, n, d, dl, k) => out.set(n).lerp(C.a.set(d).lerp(C.b.set(dl), k), day);
    let hemi;
    let dir;
    if (this.calm) {
      mix(C.top, '#060a18', '#3a5a8a', '#3a5a8a', 0);
      mix(C.hor, '#182030', '#a8c0d8', '#a8c0d8', 0);
      mix(C.fog, '#101828', '#8a96a0', '#8a96a0', 0);
      C.hor.lerp(C.a.set('#e8906a'), dusk * 0.6);
      C.fog.lerp(C.a.set('#b88a78'), dusk * 0.3);
      hemi = 0.45 + day * 1.15;
      dir = 0.08 + day * 1.3;
      this.sky.uniforms.sunDir.value.set(-0.5, Math.max(0.05, sunH), 0.8).normalize();
    } else {
      mix(C.top, '#020306', '#0e1216', '#2a3a52', L);
      mix(C.hor, '#0c1014', '#3a434c', '#6a7480', L);
      mix(C.fog, '#0a0d10', '#3a434c', '#5a646e', L);
      C.hor.lerp(C.a.set('#8a5a4a'), dusk * 0.25);
      hemi = 0.35 + day * (1.15 + L * 0.3);
      dir = 0.05 + day * (0.75 + L * 0.4);
    }
    const u = this.sky.uniforms;
    u.top.value.copy(C.top);
    if (this.storm.sky) this.storm.horizon.copy(C.hor);
    else u.horizon.value.copy(C.hor);
    this.dir.color.set(this.calm ? '#ffc890' : '#b8c8e0').lerp(C.a.set('#ff9a6a'), dusk * 0.5);
    if (this.region === 'isola') {
      this.scene.fog.color.copy(C.fog);
      this.scene.background.copy(C.fog);
      this.scene.fog.far = (this.calm ? 700 : 420 + L * 200) * (0.6 + day * 0.4);
      this.hemi.intensity = hemi;
      this.storm.lights[0].base = hemi;
      this.dir.intensity = dir;
    }
  }

  // la tempesta ogni tanto si ferma: il mare si ritira e compaiono gli scogli
  lullTick(dt) {
    const { ui, audio } = this.ctx;
    const out = this.region === 'isola';
    if (!this.calm && out && !this.battle) {
      if (!this.lullOn) {
        this.lullIn -= dt;
        if (this.lullIn <= 0) {
          this.lullOn = true;
          this.lullT = 80;
          this.lullWarned = false;
          ui.subtitle(null, 'La pioggia si ferma, di colpo. Il vento cade. Il mare si ritira, e lascia scoperti gli scogli.', 4);
          if (!this.saved.lullSeen) {
            this.saved.lullSeen = true;
            this.later(4.5, () => ui.subtitle(FRIEND, 'Guarda la costa: sono comparse delle file di scogli piatti, verso il largo. Durerà poco: sbrighiamoci!', 4));
          }
        }
      } else {
        this.lullT -= dt;
        if (this.lullT < 14 && !this.lullWarned) {
          this.lullWarned = true;
          ui.subtitle(FRIEND, 'Il vento riprende. Il mare sta risalendo: torniamo a riva!', 3);
          audio.whoosh(0.3);
        }
        if (this.lullT <= 0) {
          this.lullOn = false;
          this.lullIn = 150 + Math.random() * 100;
        }
      }
    }
    const k = 1 - Math.exp(-dt / 5);
    this.lullK += ((this.lullOn ? 1 : 0) - this.lullK) * k;
    this.tideK += ((this.calm ? 1 : this.lullOn && this.lullT > 6 ? 1 : 0) - this.tideK) * (1 - Math.exp(-dt / 6));
    this.tide.update(this.tideK);
    this.island.sea.position.y = -0.4 - this.tideK * 0.55;
    for (const c of this.chests) {
      if (!c.id.startsWith('scoglio')) continue;
      c.group.position.y = this.tide.top;
      c.pos.y = this.tide.top;
    }
    if (!this.calm) {
      this.storm.rain.material.opacity = 0.45 * (1 - this.lullK);
      this.rainT = (this.rainT || 0) - dt;
      if (out && this.rainT <= 0) {
        this.rainT = 0.3;
        audio.loopVolume?.('pioggia', 0.07 * (1 - this.lullK));
        audio.loopVolume?.('vento', 0.05 * (1 - this.lullK * 0.7));
      }
    }
    // chi resta sugli scogli quando l'acqua sale: un'onda lo riporta a riva
    const p = this.player.pos;
    if (out && !this.busy() && this.tideK < 0.55 && this.tide.on(p.x, p.z) && heightAt(p.x, p.z) < -0.8) {
      const sh = this.tide.shoreNear(p.x, p.z);
      ui.subtitle(null, 'Un\'onda vi prende in pieno e vi riporta a riva, fradici.', 3);
      audio.boom(0.2);
      this.teleport('isola', new THREE.Vector3(sh.x, 0, sh.z), Math.atan2(-sh.x, -sh.z));
    }
  }

  get night() {
    return this.dayK < 0.35;
  }

  clockLabel() {
    const h = Math.floor(this.clock * 24);
    const m = Math.floor((this.clock * 24 - h) * 60);
    return `${this.night ? '☾' : '☀'} ${String(h).padStart(2, '0')}:${String(Math.floor(m / 10) * 10).padStart(2, '0')}`;
  }

  save() {
    this.saved.clock = this.clock;
    // un Overdrive nuovo? si annuncia una volta sola
    const sv = this.saved;
    for (const id of sv.members) {
      for (const o of knownOverdrives(id, sv)) {
        if (sv.odSeen.includes(o)) continue;
        sv.odSeen.push(o);
        this.later(1.5, () => {
          this.ctx.ui.popup(`${PARTY[id].short} impara un Overdrive: ${OVERDRIVES[o].name}`);
          this.ctx.audio.chime(1760, 0.1);
        });
      }
    }
    this.ctx.progress.silo = this.saved;
    this.ctx.saveProgress(this.ctx.progress);
  }

  // dove stanno gli abitanti in questo momento della storia
  placeNpcs() {
    const q = this.saved.quests;
    for (const n of Object.values(this.npcs)) {
      let show = true;
      let pos = n.home;
      if (n.id === 'marta') {
        if (this.saved.members.includes('marta')) show = false;
        else if (q.main >= 3) pos = this.grotte.spots.marta;
      }
      if (n.id === 'nilo') show = !!this.saved.niloSaved;
      n.c.group.visible = show;
      n.c.pos.copy(pos);
      n.c.pos.y = this.groundAt(pos.x, pos.z);
      n.show = show;
      n.c.facing = Math.atan2(this.village.spots.square.x - pos.x, this.village.spots.square.z - pos.z);
      n.c.animate(0, 0);
    }
  }

  giveMoney(n) {
    this.saved.money += n;
    this.ctx.ui.popup(`+${n} conchiglie`);
    this.ctx.audio.chime(1568, 0.06);
    this.save();
  }

  giveItem(id, n = 1) {
    this.saved.items[id] = (this.saved.items[id] || 0) + n;
    this.ctx.ui.popup(`${ITEMS[id].name} ×${n}`);
    this.save();
  }

  giveGear(id) {
    this.saved.gear[id] = (this.saved.gear[id] || 0) + 1;
    this.ctx.ui.popup(`${GEAR[id].name}! Equipaggiala dal menu (G)`);
    this.ctx.audio.chime(1318, 0.08);
    this.save();
  }

  setMain(k) {
    const q = this.saved.quests;
    if (k <= q.main) return;
    q.main = k;
    this.save();
    this.ctx.ui.popup(`Missione: ${MAIN[k].title}`);
    this.ctx.audio.chime(988, 0.08);
    this.placeNpcs();
    this.updateObjective();
  }

  setSide(id, st) {
    this.saved.quests.side[id] = st;
    this.save();
    if (st === 'active') this.ctx.ui.popup(`Nuova missione: ${SIDE[id].title}`);
    if (st === 'done') this.ctx.ui.popup(`Missione compiuta: ${SIDE[id].title}`);
    this.ctx.audio.chime(st === 'done' ? 1318 : 988, 0.08);
  }

  rest(price) {
    const sv = this.saved;
    if (sv.money < price) {
      this.dialog.show([{ who: 'Gino', text: 'Mi spiace, niente soldi niente letto. Ma la zuppa ve la offro.' }]);
      return;
    }
    sv.money -= price;
    this.healAll();
    this.clock = 0.29;
    this.ctx.ui.fade(1, 500, '#000').then(() => {
      this.later(0.6, () => this.ctx.ui.fade(0, 1200, '#000'));
    });
    this.later(1.4, () => this.ctx.ui.subtitle(null, 'Una notte di sonno. Fuori la tempesta continua, ma il letto è asciutto. Il gruppo è in forze.', 4));
    this.ctx.audio.chime(523, 0.1);
    this.save();
  }

  healAll() {
    const sv = this.saved;
    for (const id of sv.members) {
      const ms = memberStats(sv, id);
      sv.party[id] = { hp: ms.maxHp, mp: ms.maxMp };
    }
  }

  openShop() {
    this.shop.show(this.saved, () => this.save());
  }

  recruitMarta() {
    const sv = this.saved;
    if (!sv.members.includes('marta')) sv.members.push('marta');
    sv.gear.arpione = 1;
    const ms = memberStats(sv, 'marta');
    sv.party.marta = { hp: ms.maxHp, mp: ms.maxMp };
    this.placeNpcs();
    this.ctx.audio.chime(784, 0.1);
    this.save();
  }

  // ---------- le zone: l'isola, il faro, le grotte, il silo ----------
  regionOf(x, z) {
    if (x > INSIDE.x - 200) return 'silo';
    if (x < FARO.x + 200) return 'faro';
    if (z < GROTTE.z + 200) return 'grotte';
    if (z > ABISSO.z - 400) return 'abisso';
    return 'isola';
  }

  get isInside() {
    return this.region === 'silo';
  }

  setRegion(r) {
    this.region = r;
    const out = r === 'isola';
    this.storm.setIndoor(!out);
    if (out && this.calm) this.storm.rain.visible = false;
    this.inside.setLit(r === 'silo');
    this.faro.setLit(r === 'faro');
    this.grotte.setLit(r === 'grotte');
    this.abyss.setLit(r === 'abisso');
    this.hemi.intensity = out ? 1.5 : r === 'silo' ? 0.7 : r === 'faro' ? 0.55 : r === 'abisso' ? 0.5 : 0.35;
    this.storm.lights[0].base = this.hemi.intensity;
    this.dir.intensity = out ? (this.calm ? 1.4 : 0.8) : 0.05;
    const fog = out ? (this.calm ? '#8a8a90' : '#3a434c') : r === 'grotte' ? '#04080a' : r === 'abisso' ? '#05040e' : '#0a0e10';
    this.scene.fog.near = out ? 30 : r === 'faro' ? 10 : r === 'abisso' ? 12 : 18;
    this.scene.fog.far = out ? (this.calm ? 700 : 420) : r === 'faro' ? 60 : r === 'abisso' ? 62 : 90;
    this.scene.fog.color.set(fog);
    this.scene.background.set(fog);
    this.sky.mesh.visible = out;
    if (out && this.skyCol) this.skyTick(0);
    this.music();
    this.updateObjective();
  }

  async teleport(region, pos, yaw, sound = true) {
    const { ui } = this.ctx;
    this.transit = true;
    ui.hint(null);
    if (sound) this.ctx.audio.thud(0.3);
    await ui.fade(1, 450, '#000');
    if (this.disposed) return;
    // la destinazione si può calcolare solo adesso (un piano dell'Abisso nuovo)
    if (typeof pos === 'function') pos = pos();
    this.place(pos.x, pos.z, yaw);
    this.setRegion(region);
    this.transit = false;
    this.encounterIn = 25 + Math.random() * 30;
    ui.fade(0, 700, '#000');
  }

  groundAt(x, z) {
    if (x > INSIDE.x - 200 || x < FARO.x + 200 || z < GROTTE.z + 200 || z > ABISSO.z - 400) return 0;
    if (onPier(x, z)) return pierY(x, z);
    const tg = this.tideK > 0.6 ? this.tide.groundAt(x, z) : null;
    if (tg !== null) return Math.max(tg, heightAt(x, z));
    return Math.max(heightAt(x, z), -0.9);
  }

  ceilingAt(x, z) {
    const r = this.regionOf(x, z);
    if (r === 'silo') return INSIDE.h - 1;
    if (r === 'faro') return FARO.h - 0.5;
    if (r === 'grotte') return GROTTE.h - 1;
    if (r === 'abisso') return ABISSO.h - 1;
    return Infinity;
  }

  // dove non si può andare: il mare aperto, i muri, la vasca, le pareti delle grotte
  blocked(x, z) {
    const r = this.regionOf(x, z);
    if (r === 'silo') {
      const d = Math.hypot(x - INSIDE.x, z - INSIDE.z);
      return d > INSIDE.r - 2 || d < INSIDE.pool + 1;
    }
    if (r === 'faro') return this.faro.blocked(x, z);
    if (r === 'grotte') return this.grotte.blocked(x, z);
    if (r === 'abisso') return this.abyss.blocked(x, z);
    if (onPier(x, z)) return false;
    if (this.tideK > 0.6 && this.tide.groundAt(x, z) !== null) return false;
    return heightAt(x, z) < -0.8 || Math.hypot(x, z) > 300;
  }

  // la camera in terza persona non passa attraverso i muri dei posti chiusi
  camBlocked(x, z) {
    const r = this.regionOf(x, z);
    if (r === 'faro') return this.faro.camBlocked(x, z);
    if (r === 'grotte') return this.grotte.camBlocked(x, z);
    if (r === 'abisso') return this.abyss.camBlocked(x, z);
    if (r === 'silo') return Math.hypot(x - INSIDE.x, z - INSIDE.z) > INSIDE.r - 1.5;
    return false;
  }

  walk(ch, dt) {
    const ox = ch.pos.x;
    const oz = ch.pos.z;
    super.walk(ch, dt);
    if (this.blocked(ch.pos.x, ch.pos.z)) {
      ch.pos.x = ox;
      ch.pos.z = oz;
      ch.pos.y = this.groundAt(ox, oz);
    }
  }

  busy() {
    return !!this.battle || !!this.transit || this.dialog.open || this.shop.open || this.menu.open || this.fishing.open;
  }

  updateFriend(dt) {
    if (this.battle) return;
    super.updateFriend(dt);
  }

  music() {
    const { audio } = this.ctx;
    audio.stopAllPads(1.2);
    const r = this.region;
    if (this.battle) {
      if (this.battle.whaleFight) audio.pad('dio', [65.4, 98, 123.5, 155.6], { vol: 0.05, type: 'sawtooth', cutoff: 700, tremolo: 0.4 });
      else if (this.battle.enemies.some((e) => e.boss)) audio.pad('boss', [82.4, 123.5, 155.6, 196], { vol: 0.045, type: 'sawtooth', cutoff: 900, tremolo: 0.3 });
      else audio.pad('lotta', [110, 130.8, 164.8, 220], { vol: 0.035, type: 'triangle', cutoff: 1400, tremolo: 0.25 });
    } else if (r === 'silo') audio.pad('silo', [55, 82.4, 103.8, 164.8], { vol: 0.035, cutoff: 500, tremolo: 0.1 });
    else if (r === 'faro') audio.pad('faro', [98, 146.8, 196, 233], { vol: 0.03, cutoff: 700, tremolo: 0.12 });
    else if (r === 'grotte') audio.pad('grotte', [61.7, 92.5, 123.5, 185], { vol: 0.035, cutoff: 450, tremolo: 0.2 });
    else if (r === 'abisso') audio.pad('abisso', [49, 73.4, 92.5, 138.6], { vol: 0.04, type: 'triangle', cutoff: 420, tremolo: 0.35 });
    else audio.pad('tempesta', [73.4, 110, 146.8, 174.6], { vol: this.calm ? 0.02 : 0.03, cutoff: 600 });
  }

  updateObjective() {
    const { ui } = this.ctx;
    const q = this.saved.quests;
    if (this.region === 'abisso') {
      const f = this.abyss.floor;
      const b = this.abyssBossM ? ' Un guardiano custodisce il vortice.' : '';
      ui.objective(`L'Abisso, piano ${f} (il più profondo: ${this.saved.abyss.best}). Trova il vortice e scendi.${b} La colonna di luce riporta al silo.`);
      return;
    }
    if (this.region === 'silo' && q.main === 6) {
      const left = this.roamers.length;
      ui.objective(left ? `Le creature che custodiscono la statua: ancora ${left} grupp${left === 1 ? 'o' : 'i'}. Toccale per combattere.` : 'Non c\'è più nessuno a custodirlo. Avvicinati alla statua e sveglia il dio.');
      return;
    }
    ui.objective(`${MAIN[q.main].title}: ${MAIN[q.main].text}`);
  }

  // ---------- le interazioni ----------
  interaction(p) {
    const near = (v, r) => v && Math.hypot(v.x - p.x, v.z - p.z) < r && Math.abs((v.y ?? p.y) - p.y) < 3;
    const sv = this.saved;
    const q = sv.quests;
    const r = this.region;
    // i forzieri e le lanterne, ovunque
    for (const c of this.chests) if (!c.opened && near(c.pos, 1.8)) return { label: 'apri il forziere', fn: () => this.openChest(c) };
    if (r === 'abisso') {
      const A = this.abyss;
      for (const c of A.chests) if (!c.opened && near(c.pos, 1.8)) return { label: 'apri il forziere', fn: () => this.openChest(c) };
      if (near(A.spots.exit, 2.2)) return { label: 'entra nella colonna di luce: si risale al silo', fn: () => this.leaveAbyss() };
      if (A.spring && near(A.spring, 2)) return { label: 'bevi dalla pozza di luce (vita e MP al massimo)', fn: () => this.abyssSpring() };
      if (this.abyssBossM && near(A.spots.endRoom, 9)) return { label: 'affronta il guardiano del vortice', fn: () => this.abyssBossFight() };
      if (near(A.spots.vortex, 2.8)) return { label: `tuffati nel vortice: piano ${A.floor + 1}`, fn: () => this.enterAbyss(A.floor + 1) };
      return null;
    }
    for (const L of this.lanterns) if (near(L.l.pos, 2)) return { label: 'riposa alla lanterna blu (vita e MP al massimo, si salva)', fn: () => this.useLantern(L.id) };
    if (r === 'isola') {
      for (const n of Object.values(this.npcs)) if (n.show && near(n.c.pos, 2.4)) return { label: `parla con ${n.d.name}`, fn: () => this.talkTo(n) };
      const I = this.island;
      if (near(I.door, 4.5)) return { label: 'il portone del silo', fn: () => this.siloDoor() };
      if (near(I.door13, 1.8)) return { label: 'apri la porta 1313', fn: () => this.leave(() => this.ctx.travel('suite')) };
      if (near(I.planeSpot, 4)) return { label: 'risali sull\'idrovolante: si torna all\'aeroporto', fn: () => this.flyBack() };
      if (near(I.lightDoor, 3)) return { label: 'entra nel Faro Spento', fn: () => this.teleport('faro', this.faro.spots.exit, Math.PI) };
      if (near(I.caveMouth, 3.5)) return { label: 'scendi nelle grotte', fn: () => this.enterCaves() };
      for (const sh of this.shellSpots) if (q.side.conchiglie === 'active' && !sv.shells.includes(sh.id) && near(sh.pos, 1.8)) return { label: 'raccogli la conchiglia che canta', fn: () => this.pickShell(sh) };
      for (const f of this.fishSpots) if (f.id !== 'lago' && near(f.pos, 2.4)) return { label: 'pesca', fn: () => this.fish(f) };
      if (q.side.lanterna === 'active' && !sv.keyItems.lanterna && near(this.adaLantern.position, 2.4)) return { label: 'raccogli la lanterna', fn: () => this.pickLantern() };
      if (q.side.mostro === 'active' && near(this.bosses.anguillone.group.position, 6)) return { label: 'affronta l\'Anguillone', fn: () => this.bossFight('anguillone') };
      return null;
    }
    if (r === 'faro') {
      const F = this.faro.spots;
      if (near(F.exit, 2)) return { label: 'esci dal faro', fn: () => this.teleport('isola', this.island.lightDoor, Math.atan2(-LIGHT.x, -LIGHT.z)) };
      for (let i = 0; i < 2; i++) if (near(F.up[i], 1.8)) return { label: 'sali al piano di sopra', fn: () => this.teleport('faro', F.down[i + 1], Math.PI) };
      for (let i = 1; i < 3; i++) if (near(F.down[i], 1.8)) return { label: 'scendi al piano di sotto', fn: () => this.teleport('faro', F.up[i - 1], 0) };
      if (near(F.diary, 1.8)) return { label: 'leggi il diario del guardiano', fn: () => this.dialog.show([
        { who: 'Diario del guardiano', text: '«Terzo giorno di tempesta. Qualcosa sale dalle scale, la notte. Sento le chele sui gradini.»' },
        { who: 'Diario del guardiano', text: '«Ho spento la lanterna perché non mi trovi. Il sigillo l\'ho nascosto nella lente: è l\'unico posto dove la luce lo protegge.»' },
        { who: 'Diario del guardiano', text: '«Domani prendo la barca. Chiunque legga: il Granchio Re ha la corazza dura come il ferro. Spaccategliela, prima di tutto.»' },
      ]) };
      if (!sv.keyItems.sigillo1 && near(F.boss, 5)) return { label: 'affronta il Granchio Re', fn: () => this.bossFight('granchiore') };
      return null;
    }
    if (r === 'grotte') {
      const G = this.grotte.spots;
      if (near(G.exit, 2.5)) return { label: 'risali in superficie', fn: () => this.teleport('isola', this.island.caveMouth, Math.atan2(-CAVE.x, -CAVE.z)) };
      const m = this.npcs.marta;
      if (m.show && near(m.c.pos, 2.4)) return { label: 'parla con Marta', fn: () => this.talkTo(m) };
      if (near(this.fishSpots[3].pos, 2.4)) return { label: 'pesca nel lago', fn: () => this.fish(this.fishSpots[3]) };
      if (!sv.keyItems.sigillo2 && near(G.boss, 7)) {
        if (!sv.members.includes('marta')) return { label: 'la Madre delle Meduse', fn: () => this.ctx.ui.subtitle(FRIEND, 'È enorme. Da soli no: torniamo all\'ingresso, Marta ci aspettava lì.', 3.4) };
        return { label: 'affronta la Madre delle Meduse', fn: () => this.bossFight('madre') };
      }
      return null;
    }
    // il silo
    const A = this.inside;
    if (near(A.entrance, 3.2)) return { label: 'esci nella tempesta', fn: () => this.teleport('isola', this.island.door.clone().add(new THREE.Vector3(0, 0, 4)), 0) };
    const dc = Math.hypot(p.x - A.center.x, p.z - A.center.z);
    if (dc < INSIDE.pool + 7 && p.z > A.center.z) {
      if (sv.god) return { label: 'scendi nell\'acqua nera, sotto la statua', fn: () => this.abyssGate() };
      if (this.roamers.length) return { label: 'la statua della balena', fn: () => this.ctx.ui.subtitle(FRIEND, 'Respira. Lo sento. Ma finché le sue creature ci girano intorno non si sveglierà.', 3.8) };
      return { label: 'sveglia il dio sopito', fn: () => this.wakeGod() };
    }
    return null;
  }

  talkTo(n) {
    const p = this.player.pos;
    n.c.facing = Math.atan2(p.x - n.c.pos.x, p.z - n.c.pos.z);
    n.c.animate(0, 0);
    talk(this, n.id);
  }

  openChest(c) {
    const sv = this.saved;
    c.open();
    if (c.id) sv.chests[c.id] = true;
    const C = c.content || CHESTS[c.id] || {};
    const got = [];
    if (C.money) {
      sv.money += C.money;
      got.push(`${C.money} conchiglie`);
    }
    for (const [id, n] of Object.entries(C.items || {})) {
      sv.items[id] = (sv.items[id] || 0) + n;
      got.push(`${ITEMS[id].name} ×${n}`);
    }
    if (C.gear) {
      sv.gear[C.gear] = (sv.gear[C.gear] || 0) + 1;
      got.push(GEAR[C.gear].name);
    }
    this.ctx.audio.chime(1318, 0.08);
    setTimeout(() => this.ctx.audio.chime(1760, 0.08), 160);
    this.dialog.show([{ who: null, text: `Nel forziere: ${got.join(', ')}.${C.gear ? ' (equipaggiala dal menu del gruppo, <b>G</b>)' : ''}` }]);
    this.save();
  }

  useLantern(id) {
    const sv = this.saved;
    this.healAll();
    sv.lastSave = id;
    this.save();
    this.ctx.audio.chime(659, 0.1);
    setTimeout(() => this.ctx.audio.chime(988, 0.1), 200);
    this.dialog.show([{ who: null, text: `La luce blu vi passa attraverso. Vita e MP al massimo. Il sogno ricorda questo posto: ${SAVES[id].name}.` }]);
  }

  pickLantern() {
    this.ctx.ui.subtitle(null, 'Le pietre cominciano a cantare. Dal buio della brughiera arriva qualcosa.', 3.2);
    this.later(1.4, () =>
      this.startBattle(['gabbiano', 'riccio', 'gabbiano'], {
        tier: 1.2,
        onWin: () => {
          this.saved.keyItems.lanterna = 1;
          this.save();
          this.ctx.ui.popup(KEY_ITEMS.lanterna.name);
          this.later(0.8, () => this.ctx.ui.subtitle(FRIEND, 'Eccola, la lanterna di Ada. È ancora tiepida. Riportiamogliela.', 3));
        },
      }),
    );
  }

  enterCaves() {
    const q = this.saved.quests;
    if (q.main < 3) {
      this.ctx.ui.subtitle(FRIEND, 'Da laggiù sale un canto. Mi fa venire i brividi. Prima il faro, come ha detto Orsola.', 3.6);
      return;
    }
    this.teleport('grotte', this.grotte.spots.exit.clone().add(new THREE.Vector3(3, 0, 0)), Math.PI / 2);
    if (!this.saved.cavesSeen) {
      this.saved.cavesSeen = true;
      this.later(1.4, () => this.ctx.ui.subtitle(FRIEND, 'Cristalli che brillano da soli. E il rumore del mare, da qualche parte sotto i piedi.', 3.6));
      this.later(5.4, () => this.ctx.ui.subtitle('Marta', 'Lo sentite? Qualcuno canta. Nilo è laggiù, in fondo.', 3.4));
    }
    if (q.main === 3) this.later(1, () => this.setMain(4));
  }

  siloDoor() {
    const sv = this.saved;
    if (sv.quests.main < 5 && !sv.god) {
      const n = (sv.keyItems.sigillo1 ? 1 : 0) + (sv.keyItems.sigillo2 ? 1 : 0);
      this.dialog.show([{ who: null, text: `Il portone è sigillato. Ci sono due incavi rotondi, all\'altezza del petto${n ? ': in uno hai messo il Sigillo della Luce, l\'altro è vuoto' : ', tutti e due vuoti'}.` }]);
      return;
    }
    if (sv.quests.main === 5) {
      this.dialog.show(
        [
          { who: null, text: 'Appoggi i due sigilli negli incavi. Il vetro caldo e la madreperla nera si accendono insieme.' },
          { who: null, text: 'Un rumore di catene, dentro. Il portone del silo si alza, lentissimo.' },
        ],
        () => {
          this.setMain(6);
          this.enterSilo();
        },
      );
      return;
    }
    this.enterSilo();
  }

  enterSilo() {
    const e = this.inside.entrance;
    this.teleport('silo', e, Math.PI);
    if (!this.saved.insideSeen) {
      this.saved.insideSeen = true;
      this.save();
      this.later(1.2, () => this.ctx.ui.subtitle(FRIEND, 'È più grande dentro che fuori. Come l\'hotel.', 3));
      this.later(4.8, () => this.ctx.ui.subtitle(null, 'Al centro, dall\'acqua nera, emerge una balena di pietra. Enorme. Dorme.', 4));
      this.later(9.4, () => this.ctx.ui.subtitle(FRIEND, 'E quelle cose che le girano intorno... ci hanno visti.', 3.4));
    }
  }

  flyBack() {
    const { ui } = this.ctx;
    ui.subtitle(FRIEND, this.saved.god ? 'Andiamo. Adesso si vola tranquilli.' : 'Torniamo all\'aeroporto. L\'isola resta qui ad aspettarci.', 2.6);
    this.later(1.6, () => this.leave(() => this.ctx.goto('aeroporto', 'arrivi')));
  }

  // ---------- la pesca e le conchiglie ----------
  fish(f) {
    const sv = this.saved;
    const { ui } = this.ctx;
    if (!sv.members.includes('marta')) {
      ui.subtitle(FRIEND, 'Senza una lenza non si pesca. Marta ne avrà di sicuro una.', 3);
      return;
    }
    if (!sv.fishTaught) {
      sv.fishTaught = true;
      this.dialog.show(
        [
          { who: 'Marta', text: 'Vuoi pescare? Tieni, la mia lenza di riserva. Si pesca dove l\'acqua fa le bolle.' },
          { who: 'Marta', text: 'Quando il galleggiante va giù, tira subito. Poi tieni il pesce: se scappa in alto, tira di più; se va giù, lascia andare un po\'.' },
          { who: 'Marta', text: 'Quello che peschi lo compra Gino, alla locanda. E segnati tutto: ogni pesce nuovo va nel taccuino.' },
        ],
        () => this.fish(f),
      );
      return;
    }
    ui.hint(null);
    const yaw = Math.atan2(f.water.x, f.water.z);
    this.player.facing = yaw;
    this.player.animate(0, 0);
    this.fishing.start(f.id, {
      good: !!sv.keyItems.lenza,
      onCatch: (id, size) => {
        sv.fish[id] = (sv.fish[id] || 0) + 1;
        const isNew = !sv.fishLog[id];
        sv.fishLog[id] = Math.max(sv.fishLog[id] || 0, size);
        if (id === 'cristallo' && sv.quests.side.cristallo === 'active') this.later(0.6, () => ui.popup('Il pesce cristallo! Portalo a Nilo'));
        this.save();
        return isNew;
      },
      onClose: () => this.save(),
    });
  }

  pickShell(sh) {
    const sv = this.saved;
    sv.shells.push(sh.id);
    sv.keyItems.conchiglia = (sv.keyItems.conchiglia || 0) + 1;
    this.ctx.audio.chime(1568, 0.08);
    setTimeout(() => this.ctx.audio.chime(1976, 0.06), 140);
    const n = sv.shells.length;
    this.ctx.ui.popup(`Conchiglia che canta (${n}/5)`);
    if (n === 1) this.later(0.8, () => this.ctx.ui.subtitle(FRIEND, 'Avvicinala all\'orecchio. Non è il mare... è una canzone.', 3));
    if (n === 5) this.later(0.8, () => this.ctx.ui.subtitle(FRIEND, 'Cinque. Le abbiamo tutte: riportiamole a Tobia, in piazza.', 3));
    this.save();
  }

  // ---------- l'Abisso, sotto la statua ----------
  abyssGate() {
    const A = this.saved.abyss;
    // si riparte dal primo piano, o subito dopo un guardiano già battuto
    const starts = [1, ...A.won.filter((f) => f % 5 === 0).map((f) => f + 1)].filter((v, i, a) => a.indexOf(v) === i).slice(-4);
    const first = !A.best;
    this.dialog.show([
      ...(first
        ? [
            { who: null, text: 'Ti sporgi sull\'acqua nera. Non riflette niente: né te, né la statua, né la luce dell\'oblò.' },
            { who: 'Il tuo amico', text: 'Il dio se n\'è andato, ma ha lasciato il suo sogno qui sotto. Lo senti? Respira ancora.' },
            { who: 'Marta', text: 'Mio nonno diceva che sotto il silo il mare non finisce mai. Vediamo se aveva ragione.' },
          ]
        : []),
      {
        who: null,
        text: first ? 'Scendere nell\'Abisso?' : `L'Abisso. Il piano più profondo che avete raggiunto: ${A.best}. Da dove scendere?`,
        choices: [...starts.map((f) => ({ label: f === 1 ? 'Dal primo piano' : `Dal piano ${f}`, fn: () => this.enterAbyss(f) })), { label: 'Non ancora', fn: () => {} }],
      },
    ]);
  }

  enterAbyss(floor) {
    const sv = this.saved;
    const A = sv.abyss;
    A.runs = (A.runs || 0) + 1;
    const deeper = floor > A.best;
    A.best = Math.max(A.best, floor);
    this.save();
    this.ctx.audio.whoosh(0.4);
    this.teleport(
      'abisso',
      () => {
        this.abyss.build(floor, floor * 7919 + A.runs * 104729);
        // il guardiano del vortice, se c'è
        this.abyssBossM?.dispose();
        this.abyssBossM = null;
        const bid = abyssBoss(floor);
        if (bid) {
          const m = monsterModel({ colosso: 'barnaclelord', sognodio: 'dreamwhale' }[bid]);
          m.group.position.copy(this.abyss.spots.boss);
          this.scene.add(m.group);
          this.abyssBossM = m;
          this.abyssBossId = bid;
        }
        return this.abyss.spots.start;
      },
      0,
      false,
    );
    this.later(1.2, () => {
      this.ctx.ui.popup(`L'Abisso — piano ${floor}`);
      if (abyssBoss(floor)) this.ctx.ui.subtitle(FRIEND, 'Questo piano è diverso. Qualcosa di grosso aspetta vicino al vortice.', 3.4);
      else if (floor === 1 && deeper) this.ctx.ui.subtitle(FRIEND, 'Colonne nere, costole di balena, bolle che salgono... Siamo dentro il suo sogno. Cerchiamo un modo per scendere.', 4.2);
      this.updateObjective();
    });
  }

  leaveAbyss() {
    const c = this.inside.center;
    this.abyssBossM?.dispose();
    this.abyssBossM = null;
    this.teleport('silo', c.clone().add(new THREE.Vector3(0, 0, INSIDE.pool + 6)), 0);
    this.later(1.2, () => this.ctx.ui.subtitle(null, `Riemergete dall'acqua nera, asciutti. Il piano più profondo raggiunto: ${this.saved.abyss.best}.`, 3.4));
  }

  abyssSpring() {
    this.healAll();
    this.save();
    this.ctx.audio.chime(659, 0.1);
    setTimeout(() => this.ctx.audio.chime(988, 0.1), 200);
    this.dialog.show([{ who: null, text: 'L\'acqua è tiepida e sa di pioggia. Vita e MP al massimo.' }]);
  }

  abyssBossFight() {
    const id = this.abyssBossId;
    const intro = {
      colosso: 'Dal fondo della sala si alza un mucchio di conchiglie nere, grande come una casa. Il Cirripede Colosso.',
      sognodio: 'Qualcosa nuota nel buio sopra di voi. Una balena nera, piena di stelle. Il sogno del dio non vuole svegliarsi.',
    }[id];
    this.ctx.ui.subtitle(null, intro, 3.2);
    this.ctx.audio.roar(0.45);
    this.later(1.3, () => this.startBattle([id], { boss: 'abyss', noFlee: true, tier: abyssTier(this.abyss.floor) }));
  }

  abyssWon() {
    const sv = this.saved;
    const f = this.abyss.floor;
    this.abyssBossM?.dispose();
    this.abyssBossM = null;
    const first = !sv.abyss.won.includes(f);
    if (first) sv.abyss.won.push(f);
    const lines = [{ who: null, text: 'Il guardiano si scioglie in bolle nere. Il vortice gira più forte: la strada verso il basso è libera.' }];
    if (first && this.abyssBossId === 'colosso' && !sv.gear.scaglie) {
      sv.gear.scaglie = (sv.gear.scaglie || 0) + 1;
      lines.push({ who: null, text: 'Fra le conchiglie rotte trovi un mantello fatto di scaglie di balena: il Manto di scaglie di balena. (equipaggialo dal menu, <b>G</b>)' });
    }
    if (first && this.abyssBossId === 'sognodio' && !sv.gear.remosogno) {
      for (const g of ['remosogno', 'ombrellosogno', 'arpionesogno']) sv.gear[g] = (sv.gear[g] || 0) + 1;
      lines.push(
        { who: 'Il tuo amico', text: 'Era il suo sogno più grande. E adesso... ci ha lasciato qualcosa.' },
        { who: null, text: 'Dove nuotava la balena nera restano tre cose che brillano: il Remo del Sogno, l\'Ombrello stellato, l\'Arpione di stelle.' },
        { who: 'Marta', text: 'L\'Abisso però continua. Lo sento ancora respirare, più giù.' },
      );
    }
    if (first) lines.push({ who: null, text: `Da adesso potete scendere direttamente dal piano ${f + 1}.` });
    this.dialog.show(lines, () => this.updateObjective());
    this.save();
  }

  // ---------- il combattimento ----------
  // dove si combatte: nella stanza o nella caverna, oppure lì dove sei sull'isola
  arenaHere() {
    const p = this.player.pos;
    if (this.region === 'faro') return this.faro.arenaAt(p.x, p.z);
    if (this.region === 'grotte') return this.grotte.arenaAt(p.x, p.z);
    if (this.region === 'abisso') return this.abyss.arenaAt(p.x, p.z);
    if (this.region === 'silo') return this.inside.arena;
    const c = new THREE.Vector3(p.x, 0, p.z);
    const at = (dx, dz) => this.groundV(c.x + dx, c.z + dz);
    return {
      party: [at(-4, 3), at(-1.4, 3.6), at(1.4, 3.6), at(4, 3)],
      enemies: [at(-4.5, -5), at(0, -6), at(4.5, -5), at(0, -2.6)],
      boss: at(0, -6.5),
    };
  }

  bossFight(id) {
    const intro = {
      granchiore: 'Il Granchio Re si alza dalla lente spenta. Le chele sbattono come porte.',
      madre: 'L\'acqua del lago si gonfia. La Madre delle Meduse si accende di mille luci.',
      anguillone: 'La sabbia nera si apre. L\'Anguillone esce dal mare con la bocca spalancata.',
    }[id];
    this.ctx.ui.subtitle(null, intro, 3);
    this.ctx.audio.roar(0.4);
    this.later(1.2, () => this.startBattle([id], { boss: id, noFlee: true }));
  }

  startBattle(foes, { group = null, tier = 1, boss = null, onWin = null, noFlee = false } = {}) {
    const { ui } = this.ctx;
    ui.hint(null);
    ui.showHud(false);
    this.hud.style.display = 'none';
    this.battleInfo = { group, boss, onWin, pre: this.player.pos.clone(), preFriend: this.friend.pos.clone(), facing: this.player.facing };
    if (this.saved.members.includes('marta')) this.marta.group.visible = true;
    if (group) group.m.group.visible = false;
    if (boss && this.bosses[boss]) this.bosses[boss].group.visible = false;
    if (boss === 'abyss' && this.abyssBossM) this.abyssBossM.group.visible = false;
    // il lampo bianco dell'incontro
    this.ctx.audio.whoosh(0.4);
    ui.fade(1, 80, '#fff').then(() => ui.fade(0, 350, '#fff'));
    const arena = this.arenaHere();
    this.battle = new Battle({
      scene: this.scene,
      camera: this.camera,
      ctx: this.ctx,
      arena,
      tier: this.region === 'silo' ? ZONES.silo.tier : tier,
      partyModels: { tu: this.player, amico: this.friend, marta: this.marta },
      foes,
      state: this.saved,
      bossModel: this.bossProxy,
      noFlee,
      onPhase2: () => {
        this.inside.setAwake(1);
        this.ctx.audio.roar(0.4);
      },
      onEnd: (r) => this.endBattle(r),
    });
    this.music();
  }

  endBattle(result) {
    const { ui } = this.ctx;
    const B = this.battleInfo;
    const whale = this.battle.whaleFight;
    this.battle = null;
    ui.showHud(true);
    this.hud.style.display = '';
    this.marta.group.visible = false;
    this.marta.lying = false;
    this.player.lying = false;
    this.friend.lying = false;
    this.encounterIn = 35 + Math.random() * 45;
    const sv = this.saved;
    const g = B.group;
    if (result === 'won') {
      if (g) {
        sv.cleared.push(g.g.id);
        g.m.dispose();
        this.roamers = this.roamers.filter((q) => q !== g);
      }
      this.save();
      if (whale) {
        this.godFalls();
        return;
      }
      this.place(B.pre.x, B.pre.z, B.facing);
      this.friend.pos.copy(B.preFriend);
      if (B.boss) this.afterBoss(B.boss);
      B.onWin?.();
      if (this.region === 'silo' && !this.roamers.length) this.later(1, () => ui.subtitle(FRIEND, 'Erano gli ultimi. Senti? La statua... respira più forte.', 3.6));
    } else if (result === 'lost') {
      // ci si risveglia all'ultima lanterna, in forze
      this.healAll();
      this.save();
      if (g) g.m.group.visible = true;
      if (B.boss && this.bosses[B.boss]) this.bosses[B.boss].group.visible = true;
      if (B.boss === 'abyss' && this.abyssBossM) this.abyssBossM.group.visible = true;
      if (whale) this.inside.setAwake(0);
      const L = this.lanterns.find((q) => q.id === sv.lastSave) || this.lanterns[0];
      const reg = SAVES[L.id].region;
      ui.fade(1, 10, '#000');
      this.place(L.l.pos.x + 1.5, L.l.pos.z + 1.5, 0);
      this.setRegion(reg);
      this.later(0.4, () => ui.fade(0, 1400, '#000'));
      this.later(1.2, () => ui.subtitle(FRIEND, `Ehi... ci siamo risvegliati qui. ${SAVES[L.id].name}. Riproviamo, con calma. E con qualche pozione in più.`, 3.8));
    } else {
      this.save();
      if (g) {
        g.m.group.visible = true;
        g.cool = 4;
      }
      if (B.boss && this.bosses[B.boss]) this.bosses[B.boss].group.visible = true;
      if (B.boss === 'abyss' && this.abyssBossM) this.abyssBossM.group.visible = true;
      this.place(B.pre.x, B.pre.z, B.facing + Math.PI);
    }
    this.music();
    this.updateObjective();
  }

  afterBoss(id) {
    const sv = this.saved;
    const { ui } = this.ctx;
    if (id === 'granchiore') {
      sv.keyItems.sigillo1 = 1;
      sv.faroLit = true;
      this.faro.setLensLit(true);
      this.island.setLighthouseLit(true);
      this.dialog.show(
        [
          { who: null, text: 'Dentro la lente, al centro, c\'è un disco di vetro caldo. Il Sigillo della Luce.' },
          { who: null, text: 'Appena lo togli, la lente si accende da sola. Sopra di voi il faro torna a girare sul mare.' },
          { who: 'Il tuo amico', text: 'Da Porto Grigio lo vedranno. Torniamo da Orsola.' },
        ],
        () => this.setMain(2),
      );
    } else if (id === 'madre') {
      sv.keyItems.sigillo2 = 1;
      sv.niloSaved = true;
      this.grotte.cocoon.visible = false;
      this.dialog.show(
        [
          { who: null, text: 'Il bozzolo luminoso si scioglie. Dentro c\'è un ragazzo che tossisce acqua salata: Nilo.' },
          { who: 'Marta', text: 'Nilo! Stupido, stupido... Stai bene? Andiamo a casa.' },
          { who: 'Nilo', text: 'La Madre... cantava la canzone del silo. E teneva questo.' },
          { who: null, text: 'Nilo ti dà un disco di madreperla nera. Il Sigillo dell\'Abisso.' },
          { who: 'Marta', text: 'Lui torna a Porto Grigio. Io resto con voi fino alla fine.' },
        ],
        () => {
          this.setMain(5);
          this.placeNpcs();
        },
      );
    } else if (id === 'abyss') {
      this.abyssWon();
    } else if (id === 'anguillone') {
      this.setSide('mostro', 'killed');
      ui.popup('L\'Anguillone è stato cacciato: torna da Gino');
    }
    this.save();
  }

  wakeGod() {
    const { ui, audio } = this.ctx;
    this.transit = true;
    ui.hint(null);
    audio.roar(0.5);
    this.inside.setAwake(0.5);
    ui.subtitle(null, 'Appoggi la mano sulla pietra. Sotto, qualcosa di enorme apre un occhio.', 3.4);
    this.later(2.2, () => {
      this.transit = false;
      this.startBattle(['dio'], { noFlee: true });
    });
  }

  // la balena di luce sale attraverso il soffitto: la tempesta finisce
  godFalls() {
    const { ui, audio } = this.ctx;
    this.saved.god = true;
    this.saved.quests.main = 7;
    this.save();
    this.transit = true;
    this.inside.setAwake(2);
    const spirit = this.inside.whale.clone(true);
    spirit.traverse((o) => {
      if (o.isMesh) o.material = new THREE.MeshBasicMaterial({ color: '#9af8ff', transparent: true, opacity: 0.35, blending: THREE.AdditiveBlending, depthWrite: false });
    });
    const wp = new THREE.Vector3();
    this.inside.whale.getWorldPosition(wp);
    spirit.position.copy(wp);
    spirit.quaternion.copy(this.inside.whale.getWorldQuaternion(new THREE.Quaternion()));
    this.scene.add(spirit);
    this.spirit = spirit;
    audio.chime(392, 0.15);
    setTimeout(() => audio.chime(587, 0.15), 600);
    setTimeout(() => audio.chime(784, 0.15), 1200);
    const c = this.inside.center;
    this.startCine({
      cam: new THREE.Vector3(c.x + 16, 6, c.z + 36),
      look: new THREE.Vector3(c.x, 26, c.z),
      dur: 9,
      update: (dt, k) => {
        spirit.position.y += dt * (2 + k.t * 1.5);
        spirit.rotation.y += dt * 0.15;
        spirit.traverse((o) => o.material && (o.material.opacity = Math.max(0, 0.35 - k.t * 0.025)));
        if (k.t > 1 && !k.l1) {
          k.l1 = true;
          ui.subtitle(null, 'La balena si stacca dalla pietra. È fatta di luce. Sale, lentissima, verso l\'oblò.', 4.4);
        }
        if (k.t > 5.5 && !k.l2) {
          k.l2 = true;
          ui.subtitle('Marta', 'Non l\'abbiamo uccisa. L\'abbiamo... liberata.', 3.4);
          this.inside.skylightMat.color.set('#c8e8ff');
        }
      },
      onEnd: () => {
        this.scene.remove(spirit);
        this.transit = false;
        this.calm = true;
        this.calmSky();
        this.inside.setAwake(0);
        ui.popup('Il dio sopito è stato cacciato');
        this.later(1, () => ui.subtitle(null, 'Fuori, il rumore della pioggia si è fermato. A Porto Grigio stanno già festeggiando.', 4));
        this.later(6, () => ui.subtitle(FRIEND, 'Però l\'acqua sotto la statua è ancora nera. E sembra... profonda. Molto più profonda di prima.', 4));
        this.updateObjective();
        this.music();
      },
    });
  }

  // ---------- ogni fotogramma ----------
  tick(dt) {
    const t = this.time;
    const { input } = this.ctx;
    const wasBusy = this.busy() || !!this.cine;
    if (wasBusy) this.ctx.ui.hint(null);
    this.island.update(t * (this.calm ? 0.45 : 1));
    this.village.update(t);
    this.inside.update(t);
    this.faro.update(t);
    this.grotte.update(t);
    this.abyss.update(t, dt);
    for (const c of this.abyss.chests) c.update(dt);
    this.abyssBossM?.update(dt);
    this.sky.update(this.camera, dt);
    if (!this.battle) this.clock = (this.clock + dt / 600) % 1;
    this.lullTick(dt);
    if (this.region === 'isola') this.skyTick(dt);
    this.storm.update(dt, this.camera, !this.calm && this.region === 'isola' && this.lullK < 0.2);
    for (const c of this.chests) c.update(dt);
    for (const L of this.lanterns) L.l.update(t);
    for (const [id, m] of Object.entries(this.bosses)) {
      m.update(dt);
      const sv = this.saved;
      const alive = id === 'granchiore' ? !sv.keyItems.sigillo1 : id === 'madre' ? !sv.keyItems.sigillo2 : sv.quests.side.mostro === 'active';
      if (!this.battle) m.group.visible = alive;
    }
    this.adaLantern.visible = this.saved.quests.side.lanterna === 'active' && !this.saved.keyItems.lanterna;
    this.adaLantern.material.opacity = 0.7 + Math.sin(t * 4) * 0.2;
    if (this.bossFlash > 0) {
      this.bossFlash -= dt;
      this.inside.stone.emissive.set(Math.floor(this.bossFlash * 30) % 2 ? '#ff3030' : '#0a3a4a');
    } else this.inside.stone.emissive.set('#0a3a4a');
    this.dialog.update(dt);
    this.shop.update(dt);
    this.menu.update(dt);
    this.fishing.update(dt);
    // le bolle dove si pesca, e le conchiglie che brillano
    for (const f of this.fishSpots) f.mark.material.opacity = 0.45 + Math.sin(t * 3 + f.pos.x) * 0.25;
    for (const sh of this.shellSpots) {
      sh.mark.visible = this.saved.quests.side.conchiglie === 'active' && !this.saved.shells.includes(sh.id);
      sh.mark.material.opacity = 0.6 + Math.sin(t * 2.5 + sh.pos.z) * 0.3;
    }
    if (this.battle) {
      this.battle.update(dt);
      return;
    }
    // gli abitanti respirano; Tobia gira per la piazza
    for (const n of Object.values(this.npcs)) {
      if (!n.show) continue;
      if (n.id === 'tobia' && !this.dialog.open) {
        const sq = this.village.spots.square;
        const a = t * 0.35;
        const x = sq.x + Math.cos(a) * 4.5;
        const z = sq.z + Math.sin(a) * 4.5;
        n.c.facing = Math.atan2(x - n.c.pos.x, z - n.c.pos.z);
        n.c.pos.set(x, this.groundAt(x, z), z);
        n.c.animate(dt, 2.2);
      } else n.c.animate(dt, 0);
    }
    // il menu del gruppo
    if (!wasBusy && input.wasPressed('KeyG')) {
      this.ctx.ui.hint(null);
      this.menu.show(this.saved, () => this.save());
    }
    // il riquadro della vita
    this.hudT -= dt;
    if (this.hudT <= 0) {
      this.hudT = 0.4;
      const sv = this.saved;
      this.hud.innerHTML = `<div style="opacity:.8;margin-bottom:3px">Liv. ${sv.level} · ${sv.money} conchiglie · ${this.clockLabel()}</div>${sv.members
        .map((id) => {
          const ms = memberStats(sv, id);
          const hp = Math.max(0, Math.round(sv.party[id]?.hp ?? ms.maxHp));
          return `<div style="display:flex;justify-content:space-between;gap:10px"><span>${PARTY[id].short}</span><span style="color:${hp <= 0 ? '#ff8a8a' : hp < ms.maxHp * 0.3 ? '#ffd060' : '#fff'}">${hp}/${ms.maxHp}</span></div>`;
        })
        .join('')}${sv.members.some((id) => spFree(sv, id) > 0) ? '<div style="color:#8af8ff;margin-top:3px">Punti abilità da spendere!</div>' : ''}<div style="opacity:.6;margin-top:3px">G: gruppo, albero, missioni</div>`;
    }
    // gli incontri casuali, camminando fuori dai posti sicuri
    const p = this.player;
    if (!this.busy() && !this.cine) {
      let zone = null;
      if (this.region === 'isola') zone = zoneAt(p.pos.x, p.pos.z);
      else if (this.region === 'faro') zone = this.faro.roomAt(p.pos.x, p.pos.z) < 2 ? 'faro' : null;
      else if (this.region === 'grotte') zone = this.grotte.chamberAt(p.pos.x, p.pos.z).id !== 'A' ? 'grotte' : null;
      else if (this.region === 'abisso') zone = this.abyss.isStart(p.pos.x, p.pos.z) || (this.abyssBossM && this.abyss.roomAt(p.pos.x, p.pos.z) === this.abyss.roomAt(this.abyss.spots.endRoom.x, this.abyss.spots.endRoom.z)) ? null : 'abisso';
      const sp = Math.hypot(p.vel.x, p.vel.z);
      if (zone && sp > 0.5) {
        this.encounterIn -= sp * dt;
        if (this.encounterIn <= 0) {
          const Z = ZONES[zone];
          const G = this.night && Z.night && this.region === 'isola' ? Z.night : Z.groups;
          const foes = G[Math.floor(Math.random() * G.length)];
          this.startBattle(foes, { tier: zone === 'abisso' ? abyssTier(this.abyss.floor) : Z.tier });
          return;
        }
      }
    }
    // le creature girano intorno alla statua; se le tocchi, si combatte
    const c = this.inside.center;
    for (const R of this.roamers) {
      R.phase += dt;
      const a = R.a + Math.sin(R.phase * 0.25) * 0.35;
      const r = R.r + Math.sin(R.phase * 0.4) * 4;
      const x = c.x + Math.cos(a) * r;
      const z = c.z + Math.sin(a) * r;
      const g = R.m.group;
      const dx = x - g.position.x;
      const dz = z - g.position.z;
      if (Math.hypot(dx, dz) > 0.001) g.rotation.y = Math.atan2(dx, dz);
      g.position.set(x, 0, z);
      R.m.update(dt);
      if (R.cool > 0) R.cool -= dt;
      else if (this.region === 'silo' && !this.cine && !this.busy() && Math.hypot(p.pos.x - x, p.pos.z - z) < 2.4) {
        this.startBattle(R.g.foes, { group: R });
        break;
      }
    }
  }

  updateCamera(dt, snap) {
    if (this.battle) return;
    super.updateCamera(dt, snap);
  }

  dispose() {
    this.disposed = true;
    this.battle?.dispose();
    super.dispose();
    this.hud.remove();
    this.dialog.dispose();
    this.fishing.close();
    for (const m of this.marks) {
      this.scene.remove(m);
      m.material.dispose();
    }
    this.glowTex.dispose();
    if (this.shop.open) this.shop.close();
    if (this.menu.open) this.menu.close();
    this.storm.dispose();
    this.island.dispose();
    this.village.dispose();
    this.inside.dispose();
    this.faro.dispose();
    this.grotte.dispose();
    this.abyss.dispose();
    this.tide.dispose();
    this.abyssBossM?.dispose();
    this.marta.dispose();
    for (const n of Object.values(this.npcs)) n.c.dispose();
    for (const m of Object.values(this.bosses)) m.dispose();
    for (const R of this.roamers) R.m.dispose();
    if (this.spirit) this.scene.remove(this.spirit);
  }
}
