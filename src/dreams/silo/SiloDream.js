import * as THREE from 'three';
import { WalkScene, FRIEND } from '../../core/walkscene.js';
import { createSky } from '../../core/sky.js';
import { unlockPlace } from '../../core/places.js';
import { buildIsland, heightAt, onPier, PIER, PLANE_SPOT } from './island.js';
import { buildInterior, INSIDE } from './interior.js';
import { Storm } from './storm.js';
import { Battle } from './battle.js';
import { monsterModel, sparkModel } from './monsters.js';
import { GROUPS } from './data.js';

// L'isola della tempesta. Coste frastagliate, scogli, pioggia che non smette,
// e fra gli scogli un silo di metallo gigantesco, con un molo che corre verso
// il mare. Dentro dorme un dio: una balena di pietra, e intorno le creature che
// la custodiscono. Si combatte a turni, come in Final Fantasy X. Si è venuti
// a cacciarlo.

export class SiloDream extends WalkScene {
  constructor(ctx) {
    const bg = '#3a434c';
    super(ctx, { background: bg, far: 1500, speed: 5 });
    this.saved = ctx.progress.silo || {};
    const sv = this.saved;
    sv.level ??= 1;
    sv.xp ??= 0;
    sv.items ??= { pozione: 6, etere: 3, fenice: 3 };
    sv.cleared ??= [];
    sv.od ??= {};
    sv.loot = [];
    const S = this.scene;
    this.calm = !!sv.god; // dopo la caccia la tempesta è passata
    S.fog = new THREE.Fog(bg, 30, this.calm ? 700 : 420);
    this.sky = createSky();
    const u = this.sky.uniforms;
    if (this.calm) this.calmSky();
    else {
      u.top.value.set('#0e1216');
      u.horizon.value.set('#3a434c');
      u.bottom.value.set('#14181c');
      u.sunColor.value.set('#000000');
    }
    S.add(this.sky.mesh);
    this.hemi = new THREE.HemisphereLight(this.calm ? '#ffe0c8' : '#a8b8c8', '#3a3a3c', this.calm ? 1.5 : 1.5);
    this.dir = new THREE.DirectionalLight(this.calm ? '#ffc890' : '#b8c8e0', this.calm ? 1.4 : 0.8);
    this.dir.position.set(-60, 80, 120);
    S.add(this.hemi, this.dir);
    this.island = buildIsland(S);
    this.inside = buildInterior(S);
    this.colliders = this.island.colliders;
    this.storm = new Storm(S, { lights: [{ light: this.hemi, base: this.hemi.intensity }], sky: this.calm ? null : this.sky, audio: ctx.audio });
    if (this.calm) {
      this.storm.rain.visible = false;
      ctx.audio.loopVolume('pioggia', 0);
      ctx.audio.loopVolume('vento', 0.02);
    }
    // Scintilla esce dalla chiavetta solo per combattere
    this.spark = sparkModel();
    this.spark.group.visible = false;
    S.add(this.spark.group);
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
    if (sv.god) this.inside.setAwake(0);

    this.spawn = ctx.spawn || 'arrivo';
    ctx.spawn = null;
    this.firstVisit = unlockPlace(ctx, 'silo');
    if (this.spawn === 'shortcut') this.place(this.island.door13.x, this.island.door13.z + 1.5, 0);
    else if (this.spawn === 'dentro') this.goInside(true);
    else this.place(PLANE_SPOT.x - 4.5, PLANE_SPOT.z - 3, Math.PI);

    const { ui, audio } = ctx;
    this.music();
    this.updateObjective();
    if (this.spawn === 'arrivo') {
      if (this.calm) this.later(1.2, () => ui.subtitle(FRIEND, 'Il mare è calmo. Non sembra nemmeno lo stesso posto.', 3.4));
      else if (this.firstVisit) {
        this.later(1.2, () => ui.subtitle(null, 'L\'idrovolante ha ammarato in mezzo alla tempesta, accanto a un molo che non finisce mai.', 4.4));
        this.later(6, () => ui.subtitle(FRIEND, 'Guarda là in fondo. Fra gli scogli. Un silo... grande come una montagna.', 3.8));
        this.later(10.5, () => ui.subtitle(null, 'Sai perché sei qui. Dentro il silo dorme un dio. Sei venuto a cacciarlo.', 4.4));
      } else this.later(1.2, () => ui.subtitle(FRIEND, 'Ancora questa pioggia. Il silo ci aspetta.', 3));
    }
    if (this.firstVisit) {
      this.later(16, () => {
        ui.popup('Una nuova porta: Il Silo');
        audio.chime(784, 0.12);
        ui.subtitle(FRIEND, 'C\'è un bunker con una porta verde. 1313. Anche qui.', 3.2);
      });
    }
  }

  // dopo la caccia: un tramonto pulito, il mare che respira piano
  calmSky() {
    const u = this.sky.uniforms;
    u.top.value.set('#3a5a8a');
    u.horizon.value.set('#e8a070');
    u.bottom.value.set('#2a3a48');
    u.sunColor.value.set('#ffd0a0');
    u.sunDir.value.set(-0.5, 0.12, 0.8).normalize();
    if (!this.isInside) {
      this.scene.fog.color.set('#8a8a90');
      this.scene.background.set('#8a8a90');
    }
    if (this.storm) {
      this.storm.sky = null;
      this.ctx.audio.loopVolume('pioggia', 0);
      this.ctx.audio.loopVolume('vento', 0.02);
    }
  }

  leaderOf(g) {
    return { granchio: 'crab', medusa: 'jelly', anguilla: 'eel', fedele: 'devotee' }[g.foes[Math.floor(g.foes.length / 2)]];
  }

  save() {
    const { loot, ...rest } = this.saved;
    void loot;
    this.ctx.progress.silo = rest;
    this.ctx.saveProgress(this.ctx.progress);
  }

  music() {
    const { audio } = this.ctx;
    audio.stopAllPads(1.2);
    if (this.battle) {
      if (this.battle.enemies.some((e) => e.boss)) audio.pad('dio', [65.4, 98, 123.5, 155.6], { vol: 0.05, type: 'sawtooth', cutoff: 700, tremolo: 0.4 });
      else audio.pad('lotta', [110, 130.8, 164.8, 220], { vol: 0.035, type: 'triangle', cutoff: 1400, tremolo: 0.25 });
    } else if (this.isInside) audio.pad('silo', [55, 82.4, 103.8, 164.8], { vol: 0.035, cutoff: 500, tremolo: 0.1 });
    else audio.pad('tempesta', [73.4, 110, 146.8, 174.6], { vol: this.calm ? 0.02 : 0.03, cutoff: 600 });
  }

  updateObjective() {
    const { ui } = this.ctx;
    const left = this.roamers.length;
    if (this.saved.god) ui.objective('Il dio è stato cacciato. La tempesta è passata.');
    else if (!this.isInside) ui.objective('Entra nel silo, in fondo al molo. Dentro dorme un dio.');
    else if (left) ui.objective(`Le creature che custodiscono la statua: ancora ${left} grupp${left === 1 ? 'o' : 'i'}. Toccale per combattere.`);
    else ui.objective('Non c\'è più nessuno a custodirlo. Avvicinati alla statua e sveglia il dio.');
  }

  get isInside() {
    return this.player.pos.x > INSIDE.x - 200;
  }

  groundAt(x, z) {
    if (x > INSIDE.x - 200) return 0;
    if (onPier(x, z)) return PIER.y;
    return Math.max(heightAt(x, z), -0.9);
  }

  ceilingAt(x) {
    return x > INSIDE.x - 200 ? INSIDE.h - 1 : Infinity;
  }

  // dove non si può andare: il mare aperto, il bordo del silo, la vasca
  blocked(x, z) {
    if (x > INSIDE.x - 200) {
      const d = Math.hypot(x - INSIDE.x, z - INSIDE.z);
      return d > INSIDE.r - 2 || d < INSIDE.pool + 1;
    }
    if (onPier(x, z)) return false;
    return heightAt(x, z) < -0.8 || Math.hypot(x, z) > 300;
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
    return !!this.battle || !!this.transit;
  }

  updateFriend(dt) {
    if (this.battle) return;
    super.updateFriend(dt);
  }

  interaction(p) {
    const near = (v, r) => Math.hypot(v.x - p.x, v.z - p.z) < r;
    const I = this.island;
    if (this.isInside) {
      const A = this.inside;
      if (near(A.entrance, 3.2)) return { label: 'esci nella tempesta', fn: () => this.goOutside() };
      const dc = Math.hypot(p.x - A.center.x, p.z - A.center.z);
      if (dc < INSIDE.pool + 7 && p.z > A.center.z) {
        if (this.saved.god) return { label: 'la statua', fn: () => this.ctx.ui.subtitle(null, 'La pietra è fredda, e vuota. Quello che ci dormiva dentro se n\'è andato.', 3.6) };
        if (this.roamers.length) return { label: 'la statua della balena', fn: () => this.ctx.ui.subtitle(FRIEND, 'Respira. Lo sento. Ma finché le sue creature ci girano intorno non si sveglierà.', 3.8) };
        return { label: 'sveglia il dio sopito', fn: () => this.wakeGod() };
      }
      return null;
    }
    if (near(I.door, 4.5)) return { label: 'entra nel silo', fn: () => this.goInside() };
    if (near(I.door13, 1.8)) return { label: 'apri la porta 1313', fn: () => this.leave(() => this.ctx.travel('suite')) };
    if (near(I.planeSpot, 4.5)) return { label: 'risali sull\'idrovolante: si torna all\'aeroporto', fn: () => this.flyBack() };
    return null;
  }

  async goInside(instant = false) {
    const { ui } = this.ctx;
    if (!instant) {
      this.transit = true;
      ui.hint(null);
      this.ctx.audio.thud(0.3);
      await ui.fade(1, 600, '#000');
      if (this.disposed) return;
    }
    const e = this.inside.entrance;
    this.place(e.x, e.z, Math.PI);
    this.storm.setIndoor(true);
    this.inside.setLit(true);
    this.hemi.intensity = 0.7;
    this.storm.lights[0].base = 0.7;
    this.dir.intensity = 0.1;
    this.scene.fog.near = 20;
    this.scene.fog.far = 160;
    this.scene.fog.color.set('#0a0e10');
    this.scene.background.set('#0a0e10');
    this.music();
    this.updateObjective();
    if (!instant) {
      this.transit = false;
      ui.fade(0, 900, '#000');
      if (!this.saved.insideSeen) {
        this.saved.insideSeen = true;
        this.save();
        this.later(1, () => ui.subtitle(FRIEND, 'È più grande dentro che fuori. Come l\'hotel.', 3));
        this.later(4.6, () => ui.subtitle(null, 'Al centro, dall\'acqua nera, emerge una balena di pietra. Enorme. Dorme.', 4));
        this.later(9.2, () => ui.subtitle(FRIEND, 'E quelle cose che le girano intorno... ci hanno visti.', 3.4));
      }
    }
  }

  async goOutside() {
    const { ui } = this.ctx;
    this.transit = true;
    ui.hint(null);
    await ui.fade(1, 600, '#000');
    if (this.disposed) return;
    const d = this.island.door;
    this.place(d.x, d.z + 4, 0);
    this.storm.setIndoor(false);
    if (this.calm) this.storm.rain.visible = false;
    this.inside.setLit(false);
    this.hemi.intensity = 1.5;
    this.storm.lights[0].base = this.hemi.intensity;
    this.dir.intensity = this.calm ? 1.4 : 0.8;
    this.scene.fog.near = 30;
    this.scene.fog.far = this.calm ? 700 : 420;
    this.scene.fog.color.set(this.calm ? '#8a8a90' : '#3a434c');
    this.scene.background.set(this.calm ? '#8a8a90' : '#3a434c');
    this.transit = false;
    this.music();
    this.updateObjective();
    ui.fade(0, 900, '#000');
  }

  flyBack() {
    const { ui } = this.ctx;
    ui.subtitle(FRIEND, this.saved.god ? 'Andiamo. Adesso si vola tranquilli.' : 'Torniamo all\'aeroporto. Il silo resta qui.', 2.6);
    this.later(1.6, () => this.leave(() => this.ctx.goto('aeroporto', 'arrivi')));
  }

  // ---------- il combattimento ----------
  startBattle(foes, { group = null, boss = false } = {}) {
    const { ui } = this.ctx;
    ui.hint(null);
    ui.showHud(false);
    this.battleGroup = group;
    this.preBattle = this.player.pos.clone();
    this.spark.group.visible = true;
    this.spark.revive();
    if (group) group.m.group.visible = false;
    this.ctx.audio.whoosh(0.4);
    this.battle = new Battle({
      scene: this.scene,
      camera: this.camera,
      ctx: this.ctx,
      arena: this.inside.arena,
      partyModels: { tu: this.player, amico: this.friend, scintilla: this.spark },
      foes,
      state: this.saved,
      bossModel: this.bossProxy,
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
    const boss = this.battle.enemies.some((e) => e.boss);
    this.battle = null;
    ui.showHud(true);
    this.spark.group.visible = false;
    this.player.lying = false;
    this.friend.lying = false;
    const g = this.battleGroup;
    if (result === 'won') {
      if (g) {
        this.saved.cleared.push(g.g.id);
        g.m.dispose();
        this.roamers = this.roamers.filter((q) => q !== g);
      }
      this.save();
      if (boss) {
        this.godFalls();
        return;
      }
      if (!this.roamers.length) this.later(1, () => ui.subtitle(FRIEND, 'Erano gli ultimi. Senti? La statua... respira più forte.', 3.6));
      this.place(this.preBattle.x, this.preBattle.z, this.player.facing);
    } else if (result === 'lost') {
      this.save();
      if (g) g.m.group.visible = true;
      if (boss) this.inside.setAwake(0);
      ui.fade(1, 10, '#000');
      const e = this.inside.entrance;
      this.place(e.x, e.z, Math.PI);
      this.later(0.4, () => ui.fade(0, 1400, '#000'));
      this.later(1.2, () => ui.subtitle(FRIEND, 'Ehi... ci siamo svegliati qui, all\'ingresso. Riproviamo. Con calma.', 3.4));
    } else {
      // fuga: ci si allontana un po'
      this.save();
      if (g) {
        g.m.group.visible = true;
        g.cool = 4;
      }
      const c = this.inside.center;
      const p = this.preBattle;
      const dx = p.x - c.x;
      const dz = p.z - c.z;
      const l = Math.hypot(dx, dz) || 1;
      this.place(c.x + (dx / l) * 38, c.z + (dz / l) * 38, Math.atan2(-dx, -dz));
    }
    this.music();
    this.updateObjective();
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
      this.startBattle(['dio'], { boss: true });
    });
  }

  // la balena di luce sale attraverso il soffitto: la tempesta finisce
  godFalls() {
    const { ui, audio } = this.ctx;
    this.saved.god = true;
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
          ui.subtitle(FRIEND, 'Non l\'abbiamo uccisa. L\'abbiamo... liberata?', 3.4);
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
        this.later(1, () => ui.subtitle(null, 'Fuori, il rumore della pioggia si è fermato.', 3.4));
        this.updateObjective();
        this.music();
      },
    });
  }

  // ---------- ogni fotogramma ----------
  tick(dt) {
    const t = this.time;
    this.island.update(t * (this.calm ? 0.45 : 1));
    this.inside.update(t);
    this.sky.update(this.camera, dt);
    this.storm.update(dt, this.camera, !this.calm);
    if (this.bossFlash > 0) {
      this.bossFlash -= dt;
      this.inside.stone.emissive.set(Math.floor(this.bossFlash * 30) % 2 ? '#ff3030' : '#0a3a4a');
    } else this.inside.stone.emissive.set('#0a3a4a');
    if (this.battle) {
      this.battle.update(dt);
      return;
    }
    // le creature girano intorno alla statua; se le tocchi, si combatte
    const c = this.inside.center;
    const p = this.player.pos;
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
      else if (this.isInside && !this.cine && !this.transit && Math.hypot(p.x - x, p.z - z) < 2.4) {
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
    this.storm.dispose();
    this.island.dispose();
    this.inside.dispose();
    this.spark.dispose();
    for (const R of this.roamers) R.m.dispose();
    if (this.spirit) this.scene.remove(this.spirit);
  }
}
