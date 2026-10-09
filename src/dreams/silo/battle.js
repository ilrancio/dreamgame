import * as THREE from 'three';
import { PARTY, SKILLS, OVERDRIVES, ITEMS, ENEMIES, ENEMY_ACTS, ELEM, KEY_ITEMS, xpToNext, knownSkills, scaleEnemy, memberStats } from './data.js';
import { monsterModel } from './monsters.js';
import { Particles } from '../../core/particles.js';

// Il combattimento a turni nel silo, alla Final Fantasy X: niente tempo che
// scorre, solo l'ordine dei turni (a destra), che dipende dalla velocità di
// ognuno e da quanto "pesa" l'azione scelta. Scegliendo un comando si vede in
// anticipo dove finirà il tuo prossimo turno. Il gruppo è di tre: tu, il tuo
// amico e Scintilla, uscita dalla chiavetta.

const RANK = { 2: 0.68, 3: 1, 4: 1.35 };
const baseDelay = (agi) => 2400 / (agi + 8);
const rnd = (a, b) => a + Math.random() * (b - a);

let styled = false;
function injectStyle() {
  if (styled) return;
  styled = true;
  const s = document.createElement('style');
  s.textContent = `
  #battle { position: fixed; inset: 0; pointer-events: none; z-index: 40; font: 600 15px Inter, system-ui, sans-serif; color: #fff; text-shadow: 1px 1px 0 #000, 0 0 4px rgba(0,0,0,0.6); }
  #battle.hidden { display: none; }
  #battle .bx { position: absolute; background: linear-gradient(180deg, rgba(52,86,182,0.93), rgba(14,26,86,0.93)); border: 2px solid rgba(225,232,255,0.9); border-radius: 9px; box-shadow: 0 0 0 1px rgba(0,0,40,0.6), 0 6px 20px rgba(0,0,0,0.5); pointer-events: auto; }
  #battle .cmd { left: 24px; bottom: 22px; width: 250px; padding: 10px 8px; }
  #battle .cmd .ti { font-size: 12px; opacity: 0.8; padding: 0 10px 4px; letter-spacing: 0.08em; text-transform: uppercase; }
  #battle .cmd .it { padding: 4px 10px 4px 26px; border-radius: 4px; position: relative; display: flex; justify-content: space-between; cursor: pointer; }
  #battle .cmd .it.off { opacity: 0.42; }
  #battle .cmd .it.on { background: rgba(255,255,255,0.14); }
  #battle .cmd .it.on::before { content: '▶'; position: absolute; left: 8px; color: #ffe8a0; }
  #battle .cmd .it.od { color: #ffd060; }
  #battle .cmd .it small { opacity: 0.85; font-size: 12px; }
  #battle .party { right: 24px; bottom: 22px; width: min(520px, 46vw); padding: 8px 12px; }
  #battle .row { display: grid; grid-template-columns: 1.3fr 1.6fr 1fr; gap: 10px; align-items: center; padding: 4px 6px; border-radius: 4px; }
  #battle .row.act { background: rgba(255,255,255,0.14); }
  #battle .row.ko { color: #ff8a8a; }
  #battle .row .nm { white-space: nowrap; }
  #battle .row .hp { font-variant-numeric: tabular-nums; text-align: right; }
  #battle .row .hp.low { color: #ffd060; }
  #battle .row .mp { font-variant-numeric: tabular-nums; text-align: right; opacity: 0.9; font-size: 13px; }
  #battle .bar { height: 4px; background: rgba(0,0,0,0.5); border-radius: 2px; margin-top: 2px; overflow: hidden; }
  #battle .bar i { display: block; height: 100%; background: linear-gradient(90deg,#ff9a2a,#ffe060); }
  #battle .bar.full i { background: linear-gradient(90deg,#ff5a2a,#fff0a0); animation: odb 0.5s infinite alternate; }
  @keyframes odb { to { filter: brightness(1.6); } }
  #battle .ctb { right: 18px; top: 70px; width: 132px; padding: 6px; background: none; border: none; box-shadow: none; pointer-events: none; }
  #battle .ctb .tk { margin: 3px 0; padding: 3px 8px; border-radius: 4px; font-size: 12px; border: 1px solid rgba(255,255,255,0.7); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  #battle .ctb .tk.p { background: linear-gradient(90deg, rgba(40,80,200,0.95), rgba(20,40,120,0.85)); }
  #battle .ctb .tk.e { background: linear-gradient(90deg, rgba(170,40,50,0.95), rgba(90,20,30,0.85)); }
  #battle .ctb .tk.now { font-size: 15px; padding: 6px 10px; margin-bottom: 8px; }
  #battle .ctb .tk.pre { outline: 2px solid #ffe060; }
  #battle .ctb .lbl { font-size: 11px; letter-spacing: 0.1em; opacity: 0.8; text-align: right; }
  #battle .help { left: 50%; top: 18px; transform: translateX(-50%); min-width: 320px; max-width: 70vw; text-align: center; padding: 8px 18px; font-size: 16px; }
  #battle .help.hidden { display: none; }
  #battle .num { position: absolute; transform: translate(-50%, -50%); font: 800 26px Inter, sans-serif; pointer-events: none; transition: none; text-shadow: 2px 2px 0 #000, 0 0 6px #000; }
  #battle .num.heal { color: #8aff9a; }
  #battle .num.tag { font-size: 15px; color: #ffe060; }
  #battle .tag3d { position: absolute; transform: translate(-50%, -100%); font: 700 13px Inter, sans-serif; padding: 3px 8px; border-radius: 4px; background: rgba(120,20,40,0.85); border: 1px solid #fff; white-space: nowrap; }
  #battle .end { left: 50%; top: 40%; transform: translate(-50%, -50%); padding: 18px 30px; text-align: center; font-size: 18px; min-width: 300px; }
  #battle .end h3 { margin: 0 0 8px; font: 700 30px "Cormorant Garamond", serif; }
  #battle .end p { margin: 4px 0; }
  #battle .end .k { opacity: 0.75; font-size: 13px; margin-top: 10px; }
  #battle .keys { position: absolute; left: 24px; bottom: 4px; font-size: 11px; opacity: 0.7; }
  `;
  document.head.appendChild(s);
}

export class Battle {
  // opts: { scene, camera, ctx, arena, partyModels: { tu, amico, scintilla }, foes: ['granchio',...], boss, state, onEnd, bossModel }
  constructor(opts) {
    injectStyle();
    this.o = opts;
    this.ctx = opts.ctx;
    this.scene = opts.scene;
    this.camera = opts.camera;
    this.state = opts.state;
    this.t = 0;
    this.steps = [];
    this.fx = new Particles(this.scene, 1200, { additive: true });
    this.disposables = [];
    this.nums = [];
    this.done = false;
    const st0 = this.state;
    this.tier = opts.tier || 1;
    // il gruppo: chi c'è in questo momento, con la vita e gli MP che aveva
    this.party = st0.members.map((id, i) => {
      const d = PARTY[id];
      const ms = memberStats(st0, id);
      const saved = st0.party?.[id] || {};
      const u = {
        side: 'party', id, name: d.name, short: d.short, color: d.color, data: d, ...ms,
        od: st0.od?.[id] || 0, st: {}, model: opts.partyModels[id], home: opts.arena.party[i].clone(), facing: Math.PI,
        weak: [], absorb: [], resist: [],
      };
      u.hp = Math.min(u.maxHp, saved.hp ?? u.maxHp);
      u.mp = Math.min(u.maxMp, saved.mp ?? u.maxMp);
      if (u.hp <= 0) {
        u.hp = 0;
        if (u.model.pos) u.model.lying = true;
      }
      return u;
    });
    // le creature (o il dio)
    this.enemies = [];
    opts.foes.forEach((fid) => this.addEnemy(fid, opts.foes.length));
    // nomi doppi: Granchio A, Granchio B
    const seen = {};
    for (const e of this.enemies) {
      const n = this.enemies.filter((q) => q.id === e.id).length;
      if (n > 1) {
        seen[e.id] = (seen[e.id] || 0) + 1;
        e.name += ` ${'ABC'[seen[e.id] - 1]}`;
        e.short += ` ${'ABC'[seen[e.id] - 1]}`;
      }
    }
    this.units = [...this.party, ...this.enemies];
    for (const u of this.units) u.ct = baseDelay(u.agi) * rnd(0.55, 1);
    this.whaleFight = this.enemies.some((e) => e.whale);
    for (const p of this.party) this.placeParty(p);
    // l'interfaccia
    this.el = document.createElement('div');
    this.el.id = 'battle';
    this.el.innerHTML = `
      <div class="bx help hidden"></div>
      <div class="ctb bx"><div class="lbl">TURNI</div><div class="list"></div></div>
      <div class="bx cmd" style="display:none"></div>
      <div class="bx party"></div>
      <div class="keys"><b>W</b>/<b>S</b> scegli · <b>A</b>/<b>D</b> bersaglio · <b>Invio</b> conferma · <b>Esc</b> indietro</div>`;
    document.body.appendChild(this.el);
    this.helpEl = this.el.querySelector('.help');
    this.ctbEl = this.el.querySelector('.ctb .list');
    this.cmdEl = this.el.querySelector('.cmd');
    this.partyEl = this.el.querySelector('.party');
    this.cursor = new THREE.Mesh(new THREE.ConeGeometry(0.3, 0.6, 4), new THREE.MeshBasicMaterial({ color: '#ffe060' }));
    this.cursor.rotation.x = Math.PI;
    this.cursor.visible = false;
    this.scene.add(this.cursor);
    this.camPos = this.camera.position.clone();
    this.camLook = new THREE.Vector3();
    this.camShot = 'wide';
    this.shake = 0;
    this.menu = null;
    this.ctx.input.unlock();
    this.ctx.audio.chime(523, 0.08);
    setTimeout(() => this.ctx.audio.chime(784, 0.08), 120);
    const b0 = this.enemies.find((e) => e.boss);
    this.help(this.whaleFight ? 'Il dio si sveglia.' : b0 ? `${b0.name}!` : 'Le creature vi sbarrano la strada!', 1.6);
    this.wait(1.4, () => this.nextTurn());
    this.renderParty();
    this.renderCtb();
  }

  // una creatura in campo (anche quelle evocate a metà)
  addEnemy(fid, count = 3) {
    const d = scaleEnemy(fid, this.tier);
    const A = this.o.arena;
    const used = new Set(this.enemies.filter((e) => e.hp > 0 && !e.boss).map((e) => e.slot));
    const hasBoss = this.enemies.some((e) => e.boss) || d.boss;
    let slot = -1;
    let home;
    if (d.boss) home = A.boss.clone();
    else {
      const order = hasBoss ? [0, 2, 3] : count === 1 ? [1] : count === 2 ? [0, 2] : [0, 1, 2, 3];
      slot = order.find((k) => !used.has(k) && A.enemies[k]) ?? -1;
      if (slot < 0) return null;
      home = A.enemies[slot].clone();
    }
    const whale = d.model === 'whale';
    let model;
    if (whale) model = this.o.bossModel;
    else {
      model = monsterModel(d.model);
      model.group.position.copy(home);
      this.scene.add(model.group);
      this.disposables.push(model);
    }
    const art = /^(Il |La |L')/;
    const u = {
      side: 'enemy', id: fid, name: d.name, short: d.boss ? d.name.replace(art, '').split(' ')[0] : d.name.split(' ')[0], data: d, slot,
      maxHp: d.hp, str: d.str, mag: d.mag, def: d.def, mdef: d.mdef, agi: d.agi,
      weak: d.weak || [], absorb: d.absorb || [], resist: d.resist || [], st: {}, model, home, facing: 0, boss: !!d.boss, whale,
    };
    u.hp = u.maxHp;
    if (d.countdown) {
      u.count = 4;
      u.countMax = 4;
    }
    this.enemies.push(u);
    return u;
  }

  // ---------- utilità ----------
  placeParty(p) {
    const m = p.model;
    if (m.pos) {
      m.pos.copy(p.home);
      m.facing = p.facing;
      m.vel?.set(0, 0, 0);
      m.lying = false;
      m.sitting = false;
    } else {
      m.group.position.copy(p.home);
      m.group.rotation.y = p.facing;
    }
  }

  posOf(u) {
    const m = u.model;
    return m.pos ? m.pos : m.group.position;
  }

  topOf(u, out = new THREE.Vector3()) {
    return out.copy(this.posOf(u)).add(new THREE.Vector3(0, u.whale ? 16 : (u.model.height || 1.9) + 0.4, u.whale ? 6 : 0));
  }

  help(text, dur = 0) {
    if (!text) {
      this.helpEl.classList.add('hidden');
      return;
    }
    this.helpEl.textContent = text;
    this.helpEl.classList.remove('hidden');
    clearTimeout(this.helpTimer);
    if (dur) this.helpTimer = setTimeout(() => this.helpEl.classList.add('hidden'), dur * 1000);
  }

  wait(dur, fn) {
    this.steps.push({ dur, fn });
  }

  alive(side) {
    return (side === 'party' ? this.party : this.enemies).filter((u) => u.hp > 0);
  }

  delayOf(u, rank = 3) {
    let d = baseDelay(u.agi) * RANK[rank];
    if (u.st.haste > 0) d *= 0.5;
    if (u.st.slow > 0) d *= 2;
    return d;
  }

  // l'ordine dei prossimi turni; se c'è un'azione scelta, il turno dopo di chi agisce segue il suo peso
  order(n = 12, actor = null, rank = 3) {
    const sim = this.units.filter((u) => u.hp > 0).map((u) => ({ u, ct: u.ct }));
    const out = [];
    if (actor) {
      out.push({ u: actor });
      const a = sim.find((s) => s.u === actor);
      if (a) a.ct = this.delayOf(actor, rank);
    }
    while (out.length < n && sim.length) {
      sim.sort((a, b) => a.ct - b.ct);
      const s = sim[0];
      const dt = s.ct;
      for (const q of sim) q.ct -= dt;
      out.push({ u: s.u, pre: actor && s.u === actor });
      s.ct = this.delayOf(s.u, 3);
    }
    return out;
  }

  renderCtb(actor = null, rank = 3) {
    const list = this.order(12, actor, rank);
    let marked = false;
    this.ctbEl.innerHTML = list
      .map((q, i) => {
        const pre = q.pre && !marked;
        if (pre) marked = true;
        return `<div class="tk ${q.u.side === 'party' ? 'p' : 'e'} ${i === 0 ? 'now' : ''} ${pre ? 'pre' : ''}">${q.u.short}</div>`;
      })
      .join('');
  }

  renderParty() {
    this.partyEl.innerHTML = this.party
      .map((p) => {
        const od = Math.min(100, p.od);
        return `<div class="row ${p === this.actor ? 'act' : ''} ${p.hp <= 0 ? 'ko' : ''}">
          <div class="nm">${p.name}</div>
          <div><div class="hp ${p.hp < p.maxHp * 0.3 ? 'low' : ''}">${Math.max(0, Math.round(p.hp))} / ${p.maxHp}</div><div class="bar ${od >= 100 ? 'full' : ''}"><i style="width:${od}%"></i></div></div>
          <div class="mp">MP ${Math.round(p.mp)}</div>
        </div>`;
      })
      .join('');
  }

  // ---------- i turni ----------
  nextTurn() {
    if (this.checkEnd()) return;
    const alive = this.units.filter((u) => u.hp > 0);
    alive.sort((a, b) => a.ct - b.ct);
    const u = alive[0];
    const dt = u.ct;
    for (const q of alive) q.ct -= dt;
    this.actor = u;
    u.st.defend = false;
    if (u.st.shell) u.st.shell = false;
    // gli effetti a tempo si consumano a ogni turno di chi li ha
    for (const k of ['haste', 'slow', 'shield', 'might']) if (u.st[k] > 0) u.st[k]--;
    this.renderParty();
    this.renderCtb();
    if (u.side === 'party') this.openMenu(u);
    else this.enemyTurn(u);
  }

  endTurn(u, rank) {
    u.ct = this.delayOf(u, rank);
    this.actor = null;
    this.renderParty();
    this.renderCtb();
    this.wait(0.35, () => this.nextTurn());
  }

  // ---------- il menu dei comandi ----------
  openMenu(u) {
    this.camShot = { kind: 'over', u };
    const items = [{ label: 'Attacca', key: 'attack', rank: 3, desc: 'Un colpo semplice a un nemico.' }];
    if (u.od >= 100) items.unshift({ label: 'Overdrive', key: 'od', rank: 3, od: true, desc: OVERDRIVES[u.data.od].desc });
    items.push({ label: u.data.menu, key: 'skills', rank: 3, desc: knownSkills(u.id, this.state.level).map((s) => SKILLS[s].name).join(' · ') });
    items.push({ label: 'Difendi', key: 'defend', rank: 2, desc: 'Ti ripari: dimezzi i danni fino al tuo prossimo turno.' });
    const nItems = Object.values(this.state.items).reduce((a, b) => a + b, 0);
    items.push({ label: 'Oggetti', key: 'items', rank: 2, off: !nItems, desc: nItems ? 'Pozioni, eteri, code di fenice.' : 'Non è rimasto niente.' });
    if (!this.enemies.some((e) => e.boss) && !this.o.noFlee) items.push({ label: 'Fuggi', key: 'flee', rank: 2, desc: 'Scappare. Non sempre riesce.' });
    this.menu = { u, title: u.name, items, sel: 0, stack: [] };
    this.cmdEl.style.display = '';
    this.renderMenu();
  }

  renderMenu() {
    const m = this.menu;
    if (!m) {
      this.cmdEl.style.display = 'none';
      return;
    }
    if (m.target) {
      this.cmdEl.style.display = 'none';
      return;
    }
    this.cmdEl.style.display = '';
    this.cmdEl.innerHTML = `<div class="ti">${m.title}</div>` + m.items.map((it, i) => `<div class="it ${i === m.sel ? 'on' : ''} ${it.off ? 'off' : ''} ${it.od ? 'od' : ''}" data-i="${i}"><span>${it.label}</span>${it.right ? `<small>${it.right}</small>` : ''}</div>`).join('');
    this.cmdEl.querySelectorAll('.it').forEach((el) => {
      el.onmouseenter = () => {
        m.sel = +el.dataset.i;
        this.renderMenu();
      };
      el.onclick = () => {
        m.sel = +el.dataset.i;
        this.confirm();
      };
    });
    const it = m.items[m.sel];
    if (it) {
      this.help(it.desc);
      this.renderCtb(m.u, it.rank || 3);
    }
  }

  submenu(title, items) {
    const m = this.menu;
    m.stack.push({ title: m.title, items: m.items, sel: m.sel });
    m.title = title;
    m.items = items;
    m.sel = 0;
    this.renderMenu();
  }

  back() {
    const m = this.menu;
    if (!m) return;
    if (m.target) {
      m.target = null;
      this.cursor.visible = false;
      this.renderMenu();
      return;
    }
    const prev = m.stack.pop();
    if (!prev) return;
    Object.assign(m, prev);
    this.renderMenu();
  }

  confirm() {
    const m = this.menu;
    if (!m) return;
    if (m.target) return this.confirmTarget();
    const it = m.items[m.sel];
    if (!it || it.off) {
      this.ctx.audio.thud(0.1);
      return;
    }
    this.ctx.audio.chime(1320, 0.04);
    const u = m.u;
    if (it.key === 'skills') {
      this.submenu(u.data.menu, knownSkills(u.id, this.state.level).map((sid) => {
        const s = SKILLS[sid];
        return { label: s.name, right: s.mp ? `${s.mp} MP` : '', key: 'skill', skill: sid, rank: s.rank, off: u.mp < s.mp, desc: s.desc };
      }));
    } else if (it.key === 'items') {
      this.submenu('Oggetti', Object.entries(ITEMS).map(([iid, d]) => ({ label: d.name, right: `×${this.state.items[iid] || 0}`, key: 'item', item: iid, rank: 2, off: !this.state.items[iid] || (iid === 'fenice' && !this.party.some((p) => p.hp <= 0)), desc: d.desc })));
    } else if (it.key === 'defend') {
      this.menu = null;
      this.renderMenu();
      this.perform(u, { type: 'defend' }, [u], 2);
    } else if (it.key === 'flee') {
      this.menu = null;
      this.renderMenu();
      this.perform(u, { type: 'flee' }, [], 2);
    } else {
      // serve un bersaglio
      let kind = 'enemy';
      if (it.key === 'skill') kind = SKILLS[it.skill].target;
      if (it.key === 'item') kind = ITEMS[it.item].target;
      if (it.key === 'od') kind = OVERDRIVES[u.data.od].target;
      if (kind === 'allEnemies' || kind === 'randomEnemies' || kind === 'allAllies') {
        this.startTarget(it, kind === 'allAllies' ? 'allAllies' : 'allEnemies');
        return;
      }
      this.startTarget(it, kind);
    }
  }

  startTarget(it, kind) {
    const m = this.menu;
    let list;
    if (kind === 'enemy' || kind === 'allEnemies') list = this.alive('enemy');
    else if (kind === 'koAlly') list = this.party.filter((p) => p.hp <= 0);
    else if (kind === 'allAllies') list = this.alive('party');
    else list = this.alive('party');
    if (!list.length) return;
    m.target = { it, kind, list, i: kind === 'ally' ? list.indexOf(m.u) : 0 };
    if (m.target.i < 0) m.target.i = 0;
    this.renderMenu();
    this.showTarget();
  }

  showTarget() {
    const T = this.menu.target;
    const all = T.kind === 'allEnemies' || T.kind === 'allAllies';
    const tg = T.list[T.i];
    this.cursor.visible = true;
    this.topOf(tg, this.cursor.position);
    this.cursorAll = all ? T.list : null;
    let txt = all ? (T.kind === 'allAllies' ? 'Tutto il gruppo' : 'Tutti i nemici') : tg.name;
    if (tg.side === 'enemy' && tg.st.scanned && !all) txt += `  ·  ${Math.round(tg.hp)}/${tg.maxHp}${tg.weak.length ? `  ·  debole: ${tg.weak.map((w) => ELEM[w]).join(', ')}` : ''}${tg.absorb.length ? `  ·  assorbe: ${tg.absorb.map((w) => ELEM[w]).join(', ')}` : ''}`;
    if (tg.side === 'party' && !all) txt += `  ·  ${Math.round(tg.hp)}/${tg.maxHp}`;
    this.help(txt);
  }

  confirmTarget() {
    const m = this.menu;
    const T = m.target;
    const u = m.u;
    const it = T.it;
    const targets = T.kind === 'allEnemies' || T.kind === 'allAllies' ? T.list : [T.list[T.i]];
    this.cursor.visible = false;
    this.menu = null;
    this.renderMenu();
    this.ctx.audio.chime(1568, 0.05);
    if (it.key === 'attack') this.perform(u, { type: 'attack' }, targets, 3);
    else if (it.key === 'skill') this.perform(u, { type: 'skill', id: it.skill }, targets, SKILLS[it.skill].rank);
    else if (it.key === 'item') this.perform(u, { type: 'item', id: it.item }, targets, 2);
    else if (it.key === 'od') this.perform(u, { type: 'od', id: u.data.od }, targets, 3);
  }

  // ---------- i nemici ----------
  enemyTurn(e) {
    this.camShot = { kind: 'enemy', u: e };
    let act;
    if (e.countMax) {
      e.count--;
      if (e.count <= 0) {
        act = 'canto';
        e.count = e.countMax;
      } else act = e.phase2 && Math.random() < 0.35 ? 'marea' : this.pickAct(e);
    } else act = this.pickAct(e);
    const A = ENEMY_ACTS[act];
    let targets;
    const party = this.alive('party');
    if (A.target === 'one') {
      const prov = e.st.provokedBy && e.st.provokedBy.hp > 0 ? e.st.provokedBy : null;
      if (prov) targets = [prov];
      else {
        const low = party.slice().sort((a, b) => a.hp - b.hp)[0];
        targets = [Math.random() < 0.35 ? low : party[Math.floor(Math.random() * party.length)]];
      }
    } else if (A.target === 'all') targets = party;
    else if (A.target === 'self') targets = [e];
    else if (A.target === 'ally') targets = [this.alive('enemy').sort((a, b) => a.hp / a.maxHp - b.hp / b.maxHp)[0]];
    else targets = this.alive('enemy');
    this.wait(0.5, () => this.perform(e, { type: 'enemy', id: act }, targets, 3));
  }

  pickAct(e) {
    const acts = e.data.acts;
    // chi cura lo fa solo se serve
    const hurt = this.alive('enemy').some((q) => q.hp < q.maxHp * 0.6);
    const pool = acts.filter(([a]) => (ENEMY_ACTS[a].kind === 'healAlly' || ENEMY_ACTS[a].kind === 'healAll' ? hurt : true));
    const tot = pool.reduce((s, [, w]) => s + w, 0);
    let r = Math.random() * tot;
    for (const [a, w] of pool) if ((r -= w) <= 0) return a;
    return pool[0][0];
  }

  // ---------- le azioni ----------
  perform(u, action, targets, rank) {
    const { audio } = this.ctx;
    let name = null;
    let def = null;
    if (action.type === 'skill') def = SKILLS[action.id];
    if (action.type === 'od') def = OVERDRIVES[action.id];
    if (action.type === 'enemy') def = ENEMY_ACTS[action.id];
    if (action.type === 'item') name = ITEMS[action.id].name;
    if (def && action.type !== 'attack') name = def.name;
    if (action.type === 'defend') name = 'Difendi';
    if (name) this.help(name, 1.6);
    else this.help(null);
    if (u.side === 'party') {
      if (action.type === 'skill') u.mp -= def.mp;
      if (action.type === 'item') this.state.items[action.id]--;
      if (action.type === 'od') u.od = 0;
    }
    this.renderParty();
    const physical = action.type === 'attack' || (def && def.kind === 'phys');
    const melee = physical && (u.side === 'party' || !u.whale) && targets[0] && targets[0] !== u && def?.target !== 'all';
    const hits = def?.hits || 1;
    if (action.type === 'od') {
      this.camShot = { kind: 'spin', u };
      audio.chime(880, 0.1);
      setTimeout(() => audio.chime(1320, 0.1), 140);
      this.fx.burst?.(this.posOf(u).x, this.posOf(u).y + 1, this.posOf(u).z, 30, 4, { color: [1, 0.8, 0.3], size: 0.5, life: 0.7 });
    } else if (u.side === 'party') this.camShot = { kind: 'act', u, t: targets[0] };
    else this.camShot = { kind: 'enemy', u, t: targets[0] };
    const start = this.posOf(u).clone();
    // si va verso il bersaglio (corpo a corpo) o si alza le mani (magia)
    if (melee) {
      const tgt = this.posOf(targets[0]);
      const to = tgt.clone().lerp(start, targets[0].whale ? 0.6 : targets[0].boss ? 0.45 : 0.28);
      to.y = start.y;
      this.lunge = { u, from: start, to, t: 0, dur: 0.32 };
      this.wait(0.36, () => {});
    } else if (action.type !== 'defend' && action.type !== 'flee') {
      this.cast = { u, t: 0 };
      if (def?.elem || def?.kind === 'mag' || def?.kind === 'heal') audio.whoosh(0.15);
      this.wait(0.55, () => {});
    }
    // l'effetto, colpo per colpo
    for (let h = 0; h < hits; h++) {
      this.wait(h === 0 ? 0.05 : 0.26, () => {
        let tg = targets;
        if (def?.target === 'randomEnemies') {
          const al = this.alive('enemy');
          if (!al.length) return;
          tg = [al[Math.floor(Math.random() * al.length)]];
        }
        this.apply(u, action, def, tg.filter((t) => t.hp > 0 || action.id === 'fenice'));
      });
    }
    this.wait(0.75, () => {
      if (this.lunge) this.lunge = { u, from: this.lunge.to, to: start, t: 0, dur: 0.3 };
      this.cast = null;
    });
    this.wait(0.35, () => {
      this.lunge = null;
      if (u.side === 'party') this.placeParty(u);
      else if (!u.whale) u.model.group.position.copy(u.home);
      if (this.fled) return this.finish('fled');
      this.endTurn(u, rank);
    });
  }

  apply(u, action, def, targets) {
    const { audio } = this.ctx;
    const lvl = this.state.level;
    if (action.type === 'defend') {
      u.st.defend = true;
      this.pop(u, 'Difesa', 'tag');
      audio.chime(660, 0.05);
      return;
    }
    if (action.type === 'flee') {
      if (Math.random() < 0.7) {
        this.fled = true;
        this.help('Siete scappati!', 1.2);
        audio.whoosh(0.3);
      } else {
        this.help('Non riuscite a scappare!', 1.4);
        audio.thud(0.2);
      }
      return;
    }
    if (action.type === 'item') {
      const t = targets[0];
      if (action.id === 'pozione') this.heal(t, 250);
      if (action.id === 'etere') {
        t.mp = Math.min(t.maxMp, t.mp + 40);
        this.pop(t, '+40 MP', 'heal');
      }
      if (action.id === 'fenice') {
        t.hp = Math.round(t.maxHp * 0.3);
        t.model.lying = false;
        t.model.revive?.();
        this.pop(t, `${t.hp}`, 'heal');
        this.sparkle(t, [1, 0.8, 0.4]);
      }
      audio.chime(1175, 0.08);
      this.renderParty();
      return;
    }
    for (const t of targets) {
      if (action.type === 'attack' || (def && (def.kind === 'phys' || def.kind === 'mag'))) {
        const kind = action.type === 'attack' ? 'phys' : def.kind;
        const power = action.type === 'attack' ? 1 : def.power;
        const dealt = this.damage(u, t, kind, power, def?.elem, lvl, def?.pierce);
        if (def?.drain && dealt) this.heal(u, dealt * 0.6);
        if (def?.status && t.hp > 0) {
          if (def.status === 'armorBreak') {
            t.st.armorBreak = true;
            this.pop(t, 'Corazza rotta', 'tag');
          } else if (def.status === 'slow' && (!def.chance || Math.random() < def.chance)) {
            t.st.slow = 3;
            t.ct *= 1.6;
            this.pop(t, 'Lentezza', 'tag');
          } else if (def.status === 'delay') {
            t.ct += baseDelay(t.agi) * 0.7;
            this.pop(t, 'Ritardo', 'tag');
          }
        }
      } else if (def.kind === 'heal') {
        this.heal(t, (u.mag * 12 + 80) * (def.power || 1));
      } else if (def.kind === 'status') {
        if (def.status === 'provoked') {
          t.st.provokedBy = u;
          this.pop(t, 'Provocato', 'tag');
        } else if (def.status === 'slow') {
          if (t.boss && Math.random() < 0.4) this.pop(t, 'Immune', 'tag');
          else {
            t.st.slow = 3;
            t.ct *= 1.6;
            this.pop(t, 'Lentezza', 'tag');
          }
        } else if (def.status === 'haste') {
          t.st.haste = 4;
          t.ct *= 0.6;
          this.pop(t, 'Rapidità', 'tag');
        } else if (def.status === 'shield') {
          t.st.shield = 4;
          this.pop(t, 'Barriera', 'tag');
        } else if (def.status === 'might') {
          t.st.might = 4;
          this.pop(t, 'Forza', 'tag');
        }
        this.sparkle(t, def.status === 'haste' || def.status === 'might' ? [1, 0.9, 0.4] : def.status === 'shield' ? [0.4, 0.9, 1] : [0.8, 0.5, 1]);
        audio.chime(990, 0.06);
      } else if (def.kind === 'scan') {
        t.st.scanned = true;
        this.pop(t, 'Scansionato', 'tag');
        this.help(`${t.name}: ${Math.round(t.hp)}/${t.maxHp}. ${t.data.info}`, 4);
        this.sparkle(t, [0.4, 0.9, 1]);
        audio.bleep(0.05);
      } else if (def.kind === 'self') {
        t.st.shell = true;
        this.pop(t, def.heal ? 'Incrostazione' : 'Guscio', 'tag');
        if (def.heal) this.heal(t, t.maxHp * def.heal);
        audio.thud(0.15);
      } else if (def.kind === 'summon') {
        const n = this.alive('enemy').filter((q) => !q.boss).length;
        const k = Math.min(2, 3 - n);
        if (k <= 0) this.pop(t, 'Nessuno risponde', 'tag');
        for (let i = 0; i < k; i++) {
          const ne = this.addEnemy(def.summon);
          if (!ne) break;
          ne.ct = baseDelay(ne.agi) * rnd(0.6, 1);
          this.units.push(ne);
          this.sparkle(ne, [0.5, 0.9, 1]);
          this.pop(ne, 'Arriva!', 'tag');
        }
        audio.chime(330, 0.08);
      } else if (def.kind === 'healAlly') {
        this.heal(t, def.power);
      } else if (def.kind === 'healAll') {
        this.heal(t, def.power);
      }
    }
    this.renderParty();
  }

  damage(u, t, kind, power, elem, lvl, pierce = false) {
    const { audio } = this.ctx;
    let dmg;
    const ul = u.side === 'party' ? lvl : 1;
    if (kind === 'phys') {
      const def = t.st.armorBreak || pierce ? 0 : t.def * (t.st.shell ? 1.8 : 1);
      dmg = (u.str * 4 + ul * 3) * power * (1 - def / (def + 60));
      if (u.st.might > 0) dmg *= 1.35;
    } else {
      dmg = (u.mag * 5 + ul * 3) * power * (1 - t.mdef / (t.mdef + 80));
      if (t.st.shield > 0) dmg *= 0.55;
    }
    dmg *= rnd(0.9, 1.1);
    let tag = null;
    if (elem) {
      if (t.absorb.includes(elem)) {
        this.heal(t, dmg);
        this.pop(t, 'Assorbe', 'tag', 0.5);
        this.element(t, elem);
        return 0;
      }
      if (t.weak.includes(elem)) {
        dmg *= 2;
        tag = 'Debole!';
      } else if (t.resist.includes(elem)) {
        dmg *= 0.5;
        tag = 'Resiste';
      }
      this.element(t, elem);
    } else if (kind === 'mag') this.sparkle(t, u.side === 'party' ? [0.6, 0.9, 1] : [0.5, 0.3, 1]);
    if (kind === 'phys' && Math.random() < 0.06) {
      dmg *= 1.5;
      tag = 'Critico!';
    }
    if (t.st.defend) dmg *= 0.5;
    dmg = Math.max(1, Math.round(dmg));
    t.hp -= dmg;
    this.pop(t, `${dmg}`);
    if (tag) this.pop(t, tag, 'tag', 0.45);
    t.model.hurt?.();
    this.shake = Math.max(this.shake, t.whale ? 0.15 : kind === 'phys' ? 0.25 : 0.15);
    audio[kind === 'phys' ? 'thud' : 'pop'](kind === 'phys' ? 0.25 : 0.18);
    // la barra dell'Overdrive: si riempie prendendo colpi
    if (t.side === 'party') t.od = Math.min(100, t.od + (dmg / t.maxHp) * 130);
    else if (u.side === 'party') u.od = Math.min(100, u.od + 3);
    if (t.hp <= 0) this.ko(t);
    // il dio si sveglia del tutto a metà vita
    if (t.whale && !t.phase2 && t.hp < t.maxHp * 0.5 && t.hp > 0) {
      t.phase2 = true;
      t.agi += 3;
      t.countMax = 3;
      t.count = Math.min(t.count, 3);
      this.wait(0.2, () => this.help('Il dio apre gli occhi del tutto. Il silo trema.', 2.6));
      this.o.onPhase2?.();
    }
    return dmg;
  }

  heal(t, amount) {
    if (t.hp <= 0) return;
    const a = Math.round(Math.min(amount, t.maxHp - t.hp));
    t.hp += a;
    this.pop(t, `${a}`, 'heal');
    this.sparkle(t, [0.4, 1, 0.5]);
  }

  ko(t) {
    t.hp = 0;
    this.ctx.audio.boom(0.15);
    if (t.side === 'party') {
      t.od = 0;
      // a terra: i personaggi sdraiati, Scintilla di lato
      if (t.model.pos) t.model.lying = true;
      this.pop(t, 'K.O.', 'tag', 0.5);
    } else if (!t.whale) t.model.die();
    // chi era provocato da lui torna libero
    for (const e of this.enemies) if (e.st.provokedBy === t) e.st.provokedBy = null;
  }

  // ---------- effetti ----------
  pop(u, text, cls = '', delay = 0) {
    const el = document.createElement('div');
    el.className = `num ${cls}`;
    el.textContent = text;
    this.el.appendChild(el);
    const p = this.topOf(u).add(new THREE.Vector3(rnd(-0.3, 0.3), -0.3, 0));
    this.nums.push({ el, p, t: -delay });
  }

  sparkle(u, color) {
    const p = this.posOf(u);
    const h = u.whale ? 10 : u.boss ? 2 : 1;
    for (let i = 0; i < 24; i++) this.fx.emit(p.x + rnd(-0.7, 0.7) * (u.whale ? 6 : u.boss ? 2 : 1), p.y + rnd(0, 2) * h, p.z + rnd(-0.7, 0.7) + (u.whale ? 6 : 0), rnd(-0.3, 0.3), rnd(0.8, 2), rnd(-0.3, 0.3), { color, size: 0.25, endSize: 0.05, life: rnd(0.6, 1.1), alpha: 0.9 });
  }

  element(u, elem) {
    const p = this.posOf(u).clone();
    if (u.whale) p.add(new THREE.Vector3(0, 10, 6));
    const audio = this.ctx.audio;
    if (elem === 'fulmine') {
      this.bolt(p);
      audio.boom(0.25);
    } else if (elem === 'fuoco') {
      for (let i = 0; i < 50; i++) this.fx.emit(p.x + rnd(-0.6, 0.6), p.y + rnd(0, 1.6), p.z + rnd(-0.6, 0.6), rnd(-1, 1), rnd(1.5, 4), rnd(-1, 1), { color: [1, rnd(0.3, 0.7), 0.1], size: 0.6, endSize: 0.1, life: rnd(0.4, 0.8), alpha: 0.9 });
      audio.whoosh(0.3);
    } else {
      for (let i = 0; i < 40; i++) this.fx.emit(p.x, p.y + 1, p.z, rnd(-4, 4), rnd(-1, 4), rnd(-4, 4), { color: [0.6, 0.9, 1], size: 0.3, endSize: 0.05, life: rnd(0.4, 0.8), alpha: 0.95, gravity: 6 });
      audio.chime(2200, 0.06);
    }
  }

  bolt(p) {
    const pts = [];
    let x = p.x;
    let z = p.z;
    for (let i = 0; i <= 14; i++) {
      pts.push(new THREE.Vector3(x, p.y + 14 - i, z));
      x += rnd(-0.5, 0.5);
      z += rnd(-0.5, 0.5);
    }
    const g = new THREE.BufferGeometry().setFromPoints(pts);
    const l = new THREE.Line(g, new THREE.LineBasicMaterial({ color: '#f0f8ff' }));
    this.scene.add(l);
    for (let i = 0; i < 30; i++) this.fx.emit(p.x, p.y + 0.8, p.z, rnd(-3, 3), rnd(0, 4), rnd(-3, 3), { color: [0.8, 0.9, 1], size: 0.25, endSize: 0.02, life: 0.4 });
    setTimeout(() => {
      this.scene.remove(l);
      g.dispose();
      l.material.dispose();
    }, 220);
  }

  // ---------- fine ----------
  checkEnd() {
    if (this.done) return true;
    if (!this.alive('enemy').length) {
      this.finish('won');
      return true;
    }
    if (!this.alive('party').length) {
      this.finish('lost');
      return true;
    }
    return false;
  }

  finish(result) {
    this.done = true;
    this.result = result;
    this.menu = null;
    this.renderMenu();
    this.cursor.visible = false;
    const st = this.state;
    // l'Overdrive accumulato resta per la prossima volta
    st.od = Object.fromEntries(this.party.map((p) => [p.id, p.hp > 0 ? p.od : 0]));
    const box = document.createElement('div');
    box.className = 'bx end';
    // la vita e gli MP restano com'erano (chi è a terra si rialza a fatica)
    st.party ??= {};
    for (const p of this.party) st.party[p.id] = { hp: result === 'lost' ? p.hp : Math.max(1, Math.round(p.hp)), mp: Math.round(p.mp) };
    if (result === 'won') {
      const xp = this.enemies.reduce((s, e) => s + e.data.xp, 0);
      const money = this.enemies.reduce((s, e) => s + (e.data.money || 0), 0);
      st.xp += xp;
      st.money = (st.money || 0) + money;
      const before = Object.fromEntries(st.members.map((id) => [id, knownSkills(id, st.level)]));
      let ups = 0;
      while (st.xp >= xpToNext(st.level)) {
        st.xp -= xpToNext(st.level);
        st.level++;
        ups++;
      }
      // il bottino: quello che lasciano le creature
      const loot = [];
      for (const e of this.enemies) {
        if (e.data.drop && Math.random() < 0.65) loot.push(e.data.drop);
        if (e.boss) loot.push('superpozione', 'etere');
        else if (Math.random() < 0.22) loot.push(Math.random() < 0.25 ? 'etere' : 'pozione');
      }
      const names = {};
      for (const it of loot) {
        if (KEY_ITEMS[it]) {
          st.keyItems[it] = (st.keyItems[it] || 0) + 1;
          names[KEY_ITEMS[it].name] = (names[KEY_ITEMS[it].name] || 0) + 1;
        } else {
          st.items[it] = (st.items[it] || 0) + 1;
          names[ITEMS[it].name] = (names[ITEMS[it].name] || 0) + 1;
        }
      }
      // chi ha imparato qualcosa
      const learned = [];
      for (const id of st.members) {
        const now = knownSkills(id, st.level).filter((q) => !before[id].includes(q));
        for (const q of now) learned.push(`${PARTY[id].short}: ${SKILLS[q].name}`);
      }
      if (ups) for (const p of this.party) st.party[p.id] = { hp: memberStats(st, p.id).maxHp, mp: memberStats(st, p.id).maxMp };
      box.innerHTML = `<h3>Vittoria!</h3><p>+${xp} esperienza · +${money} conchiglie</p>${ups ? `<p style="color:#ffe060">Livello ${st.level}! Tutti in forze.</p>` : ''}${learned.length ? `<p style="color:#8af8ff">Nuove abilità: ${learned.join(', ')}</p>` : ''}${loot.length ? `<p>Trovato: ${Object.entries(names).map(([n, k]) => `${n} ×${k}`).join(', ')}</p>` : ''}<div class="k">Invio per continuare</div>`;
      this.ctx.audio.ding(0.15);
      setTimeout(() => this.ctx.audio.chime(1046, 0.1), 200);
      setTimeout(() => this.ctx.audio.chime(1568, 0.1), 420);
    } else if (result === 'lost') {
      box.innerHTML = '<h3>Il gruppo è sconfitto</h3><p>Tutto si fa buio. Il dio, da qualche parte, continua a dormire.</p><div class="k">Invio per continuare</div>';
      this.ctx.audio.boom(0.3);
    } else {
      box.innerHTML = '<h3>Fuga</h3><p>Siete scappati. Le creature restano dove sono.</p><div class="k">Invio per continuare</div>';
    }
    this.el.appendChild(box);
    this.endBox = box;
    this.endT = 0;
    this.help(null);
  }

  // ---------- ogni fotogramma ----------
  update(dt) {
    const { input } = this.ctx;
    this.t += dt;
    // la sequenza delle azioni
    if (this.steps.length) {
      const s = this.steps[0];
      s.dur -= dt;
      if (s.dur <= 0) {
        this.steps.shift();
        s.fn?.();
      }
    }
    // i comandi
    const m = this.menu;
    if (m && !this.steps.length) {
      if (m.target) {
        const T = m.target;
        if (T.kind !== 'allEnemies' && T.kind !== 'allAllies') {
          if (input.wasPressed('KeyA', 'ArrowLeft', 'KeyW', 'ArrowUp')) {
            T.i = (T.i + T.list.length - 1) % T.list.length;
            this.showTarget();
            this.ctx.audio.bleep(0.02);
          }
          if (input.wasPressed('KeyD', 'ArrowRight', 'KeyS', 'ArrowDown')) {
            T.i = (T.i + 1) % T.list.length;
            this.showTarget();
            this.ctx.audio.bleep(0.02);
          }
        }
      } else {
        if (input.wasPressed('KeyW', 'ArrowUp')) {
          m.sel = (m.sel + m.items.length - 1) % m.items.length;
          this.renderMenu();
          this.ctx.audio.bleep(0.02);
        }
        if (input.wasPressed('KeyS', 'ArrowDown')) {
          m.sel = (m.sel + 1) % m.items.length;
          this.renderMenu();
          this.ctx.audio.bleep(0.02);
        }
      }
      if (input.wasPressed('Enter', 'Space', 'KeyE')) this.confirm();
      else if (input.wasPressed('Escape', 'KeyQ', 'Backspace')) this.back();
    }
    if (this.done && this.endBox) {
      this.endT += dt;
      if (this.endT > 0.8 && input.wasPressed('Enter', 'Space', 'KeyE', 'Escape')) {
        this.dispose();
        this.o.onEnd?.(this.result);
        return;
      }
    }
    // i corpi
    for (const p of this.party) {
      const mdl = p.model;
      let speed = 0;
      if (this.lunge && this.lunge.u === p) {
        const L = this.lunge;
        L.t += dt;
        const k = Math.min(1, L.t / L.dur);
        mdl.pos ? mdl.pos.lerpVectors(L.from, L.to, k) : mdl.group.position.lerpVectors(L.from, L.to, k);
        speed = 6;
        if (mdl.pos) mdl.facing = Math.atan2(L.to.x - L.from.x, L.to.z - L.from.z);
      } else if (mdl.pos && p.hp > 0) mdl.facing = Math.PI;
      if (mdl.pos) {
        mdl.animate(dt, speed);
        // le braccia: in alto per la magia, avanti per difendersi
        if (this.cast?.u === p) {
          mdl.armL.rotation.set(-2.6, 0, 0.3);
          mdl.armR.rotation.set(-2.6, 0, -0.3);
          mdl.poseFigure?.();
        } else if (p.st.defend && p.hp > 0) {
          mdl.armL.rotation.set(-1.4, 0, -0.5);
          mdl.armR.rotation.set(-1.4, 0, 0.5);
          mdl.poseFigure?.();
        }
      } else {
        mdl.group.rotation.y = this.lunge?.u === p ? 0 : Math.PI;
        mdl.update(dt, speed);
        if (p.hp <= 0) mdl.group.rotation.z = Math.PI / 2;
        else mdl.group.rotation.z = 0;
        if (this.cast?.u === p) mdl.group.position.y = p.home.y + Math.abs(Math.sin(this.t * 10)) * 0.2;
      }
    }
    for (const e of this.enemies) {
      if (e.whale) continue;
      if (this.lunge && this.lunge.u === e) {
        const L = this.lunge;
        L.t += dt;
        e.model.group.position.lerpVectors(L.from, L.to, Math.min(1, L.t / L.dur));
      }
      e.model.update(dt);
    }
    this.fx.update(dt);
    // il cursore che gira sopra il bersaglio
    if (this.cursor.visible) {
      this.cursor.rotation.y += dt * 4;
      if (this.cursorAll) {
        const k = Math.floor(this.t * 6) % this.cursorAll.length;
        this.topOf(this.cursorAll[k], this.cursor.position);
      }
      this.cursor.position.y += Math.sin(this.t * 6) * 0.004;
    }
    this.updateCamera(dt);
    // i numeri che salgono
    const w = window.innerWidth;
    const h = window.innerHeight;
    const v = new THREE.Vector3();
    for (const n of this.nums) {
      n.t += dt;
      if (n.t < 0) {
        n.el.style.opacity = 0;
        continue;
      }
      v.copy(n.p).add(new THREE.Vector3(0, n.t * 0.8, 0)).project(this.camera);
      n.el.style.left = `${(v.x * 0.5 + 0.5) * w}px`;
      n.el.style.top = `${(-v.y * 0.5 + 0.5) * h}px`;
      n.el.style.opacity = n.t < 0.9 ? 1 : Math.max(0, 1 - (n.t - 0.9) * 3);
    }
    this.nums = this.nums.filter((n) => {
      if (n.t > 1.3) {
        n.el.remove();
        return false;
      }
      return true;
    });
    // il conto alla rovescia del dio
    const boss = this.enemies.find((e) => e.countMax && e.hp > 0);
    if (boss) {
      if (!this.countEl) {
        this.countEl = document.createElement('div');
        this.countEl.className = 'tag3d';
        this.el.appendChild(this.countEl);
      }
      v.copy(this.posOf(boss)).add(new THREE.Vector3(0, 24, 4)).project(this.camera);
      this.countEl.style.left = `${(v.x * 0.5 + 0.5) * w}px`;
      this.countEl.style.top = `${Math.max(60, (-v.y * 0.5 + 0.5) * h)}px`;
      this.countEl.textContent = `Canto degli Abissi · ${boss.count}`;
      this.countEl.style.background = boss.count <= 1 ? 'rgba(200,40,40,0.95)' : 'rgba(80,20,60,0.85)';
    } else if (this.countEl) this.countEl.style.display = 'none';
  }

  updateCamera(dt) {
    const c = this.camShot;
    const A = this.o.arena;
    const boss = this.whaleFight;
    const mid = A.party[1].clone().lerp(boss ? A.boss : A.enemies[1], 0.5);
    const S = A.scale || 1; // nelle stanze strette la camera sta più vicina
    const gy = A.party[1].y;
    const foe = this.enemies.find((e) => e.boss && !e.whale);
    const foeY = foe ? (foe.model.height || 2) * 0.5 : 1.2;
    let pos;
    let look;
    if (c === 'wide' || !c || this.done) {
      const s = Math.sin(this.t * 0.2) * 3;
      pos = boss ? new THREE.Vector3(A.party[1].x + 18 + s, 9, A.party[1].z + 12) : new THREE.Vector3(mid.x + (13 + s) * S, gy + 6.5 * S, mid.z + 10 * S);
      look = boss ? new THREE.Vector3(A.boss.x, 9, A.boss.z + 10) : mid.clone().setY(gy + foeY);
    } else if (c.kind === 'over') {
      // da dietro le spalle di chi deve scegliere
      const p = this.posOf(c.u);
      pos = new THREE.Vector3(p.x + 3.2 * S, p.y + 2.6 * S, p.z + 5.5 * S);
      look = boss ? new THREE.Vector3(A.boss.x, 10, A.boss.z + 8) : (foe ? A.boss : A.enemies[1]).clone().setY(gy + foeY);
    } else if (c.kind === 'act') {
      const p = this.posOf(c.u);
      const t = c.t ? this.posOf(c.t) : A.enemies[1];
      pos = new THREE.Vector3(p.x + 7 * S, p.y + 3.5 * S, (p.z + t.z) / 2 + 4 * S);
      look = boss ? new THREE.Vector3(A.boss.x, 7, A.boss.z + 10) : p.clone().lerp(t, 0.5).setY(gy + 1.2);
    } else if (c.kind === 'enemy') {
      if (boss) {
        pos = new THREE.Vector3(A.boss.x - 16, 12, A.boss.z + 30);
        look = new THREE.Vector3(A.boss.x, 8, A.boss.z + 14);
      } else {
        const p = this.posOf(c.u);
        const big = c.u.boss ? 1.8 : 1;
        pos = new THREE.Vector3(p.x - 6 * S * big, p.y + 3 * S * big, p.z - 4 * S * big);
        look = A.party[1].clone().setY(gy + 1.2);
      }
    } else if (c.kind === 'spin') {
      const p = this.posOf(c.u);
      const a = this.t * 1.6;
      pos = new THREE.Vector3(p.x + Math.cos(a) * 4, p.y + 1.8, p.z + Math.sin(a) * 4);
      look = p.clone().setY(p.y + 1);
    }
    A.clamp?.(pos);
    const k = 1 - Math.exp(-3 * dt);
    this.camPos.lerp(pos, k);
    this.camLook.lerp(look, k);
    this.camera.position.copy(this.camPos);
    if (this.shake > 0) {
      this.shake = Math.max(0, this.shake - dt);
      this.camera.position.x += rnd(-1, 1) * this.shake;
      this.camera.position.y += rnd(-1, 1) * this.shake;
    }
    this.camera.lookAt(this.camLook);
  }

  dispose() {
    this.el.remove();
    this.scene.remove(this.cursor);
    this.cursor.geometry.dispose();
    this.cursor.material.dispose();
    this.fx.dispose?.();
    if (this.fx.points) this.scene.remove(this.fx.points);
    this.disposables.forEach((d) => d.dispose?.());
    clearTimeout(this.helpTimer);
  }
}
