import * as THREE from 'three';
import { Car } from '../dreams/demone/car.js';
import { Jeep } from '../dreams/costa/jeep.js';
import { Biplane } from '../dreams/isola/plane.js';

// Il sogno condiviso: due persone nello stesso sogno, ognuna dal suo computer.
// Chi crea il sogno è il protagonista (maglia blu); chi entra con il codice è
// il tuo amico (maglia gialla). Ognuno gioca il suo mondo, ma quando l'altro è
// nello stesso posto compare lui al posto dell'amico guidato dal gioco: a
// piedi, in macchina, in jeep o in aereo. Se l'altro esce da una porta mentre
// siete insieme, lo segui. Il pannello si apre con O.
//
// Il collegamento è il canale "room" della pagina pubblicata su claude.ai (in
// una stanza con il nome del codice); fuori di lì, per provarlo, due schede
// dello stesso browser si parlano con un BroadcastChannel.

const LOOK_HERO = { skin: '#e0b089', hair: '#3b2a1e', shirt: '#2f4f8f' };
const LOOK_FRIEND = { skin: '#c99470', hair: '#141414', shirt: '#d9a82e' };
export const PLACE_NAMES = {
  campo: 'il campo',
  hotel: 'l\'hotel',
  esterno: 'fuori, intorno all\'hotel',
  centro: 'il centro commerciale',
  aeroporto: 'l\'aeroporto',
  spiaggia: 'la Spiaggia d\'Inverno',
  costa: 'la Spiaggia Grande',
  isola: 'l\'Isola',
};

// ---------- I due modi di parlarsi ----------
class RoomLink {
  static async open(name, onState) {
    const room = await window.claude?.use?.('room');
    if (!room) return null;
    const named = await room.join(name);
    const link = new RoomLink();
    link.named = named;
    link.kind = 'room';
    named.onPeers((ch) => {
      const other = ch.peers.find((p) => !p.isMe && p.kind === 'viewer' && p.presence?.dg);
      onState(other ? other.presence.dg : null);
    });
    return link;
  }

  send(state) {
    this.named.presence({ dg: state }).catch(() => {});
  }

  close() {
    this.named.leave().catch(() => {});
  }
}

class LocalLink {
  static open(name, onState) {
    if (typeof BroadcastChannel === 'undefined') return null;
    const link = new LocalLink();
    link.kind = 'local';
    link.id = Math.random().toString(36).slice(2);
    link.bc = new BroadcastChannel(`dreamgame-${name}`);
    link.last = 0;
    link.bc.onmessage = (e) => {
      if (e.data?.id === link.id) return;
      link.last = performance.now();
      onState(e.data.state);
    };
    link.timer = setInterval(() => {
      if (link.last && performance.now() - link.last > 6000) {
        link.last = 0;
        onState(null);
      }
    }, 1000);
    return link;
  }

  send(state) {
    this.bc.postMessage({ id: this.id, state });
  }

  close() {
    clearInterval(this.timer);
    this.bc.close();
  }
}

// ---------- Il sogno condiviso ----------
export class Coop {
  constructor(ctx, { chapterId, goToChapterById }) {
    this.ctx = ctx;
    this.chapterId = chapterId; // () => id del capitolo attuale
    this.goTo = goToChapterById; // (id, spawn) => void
    this.link = null;
    this.role = null; // 'hero' | 'friend'
    this.code = null;
    this.partner = null; // l'ultimo stato ricevuto
    this.partnerPrevCh = null;
    this.sendT = 0;
    this.scene = null;
    this.remoteVeh = null;
    this.pendingSnap = 0;
    this.shown = new THREE.Vector3();
    this.buildUi();
  }

  get active() {
    return !!this.link;
  }

  // ---------- Pannello (O) e targhetta ----------
  buildUi() {
    const badge = document.createElement('div');
    badge.id = 'coop-badge';
    document.body.appendChild(badge);
    this.badge = badge;
    const panel = document.createElement('div');
    panel.id = 'coop-panel';
    panel.innerHTML = `<div class="coop-card">
      <h3>Sogno condiviso</h3>
      <p class="coop-note">Due persone nello stesso sogno. Chi crea il sogno è il protagonista; chi entra con il codice diventa il tuo amico, e lo guida lui.</p>
      <div class="coop-off">
        <button data-act="create">Crea un sogno condiviso</button>
        <div class="coop-join"><input inputmode="numeric" maxlength="4" placeholder="codice" aria-label="Codice del sogno"><button data-act="join">Entra</button></div>
      </div>
      <div class="coop-on">
        <div class="coop-code"></div>
        <div class="coop-status"></div>
        <button data-act="reach">Raggiungi l'altro</button>
        <button data-act="leave" class="ghost">Esci dal sogno condiviso</button>
      </div>
      <p class="coop-msg" aria-live="polite"></p>
      <p class="coop-keys"><kbd>O</kbd> o <kbd>Esc</kbd> chiude</p>
    </div>`;
    document.body.appendChild(panel);
    this.panel = panel;
    this.input = panel.querySelector('input');
    // mentre scrivi il codice, i tasti non arrivano al gioco
    this.input.addEventListener('keydown', (e) => {
      e.stopPropagation();
      if (e.key === 'Enter') this.join(this.input.value);
      if (e.key === 'Escape') this.close();
    });
    panel.addEventListener('click', (e) => {
      const act = e.target.closest('button')?.dataset.act;
      if (act === 'create') this.create();
      if (act === 'join') this.join(this.input.value);
      if (act === 'reach') this.reach();
      if (act === 'leave') this.leave();
    });
    this.refreshUi();
  }

  get open() {
    return this.panel.classList.contains('show');
  }

  toggle() {
    if (this.open) return this.close();
    this.ctx.input.unlock?.();
    this.panel.classList.add('show');
    this.refreshUi();
    if (!this.active) setTimeout(() => this.input.focus(), 50);
  }

  close() {
    this.panel.classList.remove('show');
    this.input.blur();
  }

  say(msg) {
    this.panel.querySelector('.coop-msg').textContent = msg || '';
  }

  refreshUi() {
    const on = this.active;
    this.panel.querySelector('.coop-off').style.display = on ? 'none' : '';
    this.panel.querySelector('.coop-on').style.display = on ? '' : 'none';
    if (on) {
      this.panel.querySelector('.coop-code').innerHTML = `Codice <b>${this.code}</b> · tu sei ${this.role === 'hero' ? 'il protagonista' : 'l\'amico'}`;
      this.panel.querySelector('.coop-status').textContent = this.statusText();
    }
    const where = this.partner && this.partner.ch !== this.chapterId() ? ` · è ${PLACE_NAMES[this.partner.ch] || 'altrove'}` : '';
    this.badge.textContent = on ? `In due · ${this.code}${this.partner ? where || ' · insieme' : ' · in attesa'}` : '';
    this.badge.classList.toggle('show', on);
  }

  statusText() {
    if (!this.partner) return this.role === 'hero' ? 'Aspetta che l\'altro entri con il codice. Mandaglielo!' : 'Cerco il protagonista…';
    if (this.partner.ch === this.chapterId()) return 'Siete nello stesso posto.';
    return `L'altro è ${PLACE_NAMES[this.partner.ch] || 'altrove'}.`;
  }

  // ---------- Entrare e uscire ----------
  async connect(code, role) {
    this.say('Collegamento…');
    const onState = (st) => this.onPartner(st);
    let link = null;
    try {
      link = await RoomLink.open(`dreamgame-${code}`, onState);
    } catch (e) {
      link = null;
    }
    if (!link) link = LocalLink.open(code, onState);
    if (!link) {
      this.say('Il sogno condiviso funziona solo nella versione pubblicata su claude.ai.');
      return false;
    }
    this.link = link;
    this.code = code;
    this.role = role;
    this.say(link.kind === 'local' ? 'Collegato (prova locale: due schede di questo browser).' : '');
    this.applyLooks(this.scene);
    this.refreshUi();
    // anche mentre il gioco carica un posto nuovo (e non disegna), l'altro
    // deve sapere dove stai andando: un battito ogni mezzo secondo
    clearInterval(this.beat);
    this.beat = setInterval(() => this.heartbeat(), 500);
    return true;
  }

  heartbeat() {
    if (!this.active || !this.lastSent) return;
    if (performance.now() - this.lastSentAt < 400) return;
    const ch = this.chapterId();
    if (ch === this.lastSent.ch) this.link.send(this.lastSent);
    else this.link.send({ r: this.role, ch, sp: this.ctx.spawn ?? this.ctx.lastSpawn ?? null, tr: 1 });
  }

  async create() {
    const code = String(1000 + Math.floor(Math.random() * 9000));
    await this.connect(code, 'hero');
  }

  async join(raw) {
    const code = String(raw || '').replace(/\D/g, '').slice(0, 4);
    if (code.length !== 4) {
      this.say('Il codice è di quattro cifre.');
      return;
    }
    if (await this.connect(code, 'friend')) this.joinedAt = performance.now();
  }

  leave() {
    this.link?.close();
    this.link = null;
    clearInterval(this.beat);
    this.lastSent = null;
    this.together = false;
    this.partner = null;
    this.removeRemoteVehicle();
    const old = this.role;
    this.role = null;
    if (old === 'friend') this.applyLooks(this.scene, true);
    this.say('');
    this.refreshUi();
  }

  // ---------- Lo stato dell'altro ----------
  onPartner(st) {
    const prev = this.partner;
    this.partner = st && typeof st === 'object' ? st : null;
    if (!prev && this.partner) this.ctx.ui.popup(this.role === 'hero' ? 'Il tuo amico è entrato nel sogno' : 'Sei nel sogno del protagonista');
    if (prev && !this.partner) this.ctx.ui.popup('L\'altro si è svegliato', true);
    // l'altro è uscito da una porta mentre eravate insieme: lo segui
    // (anche se nel frattempo il segnale ha avuto un buco)
    const mine = this.chapterId();
    // segue solo chi è rimasto dove eravate insieme: chi apre la porta va avanti
    if (this.partner && this.partner.ch === mine) this.together = mine;
    if (this.partner && this.together && this.together === mine && this.partner.ch !== mine && !this.following) {
      this.together = false;
      this.following = true;
      this.ctx.ui.subtitle(null, 'L\'altro ha aperto una porta. Lo segui.', 2.4);
      setTimeout(() => {
        this.following = false;
        if (this.partner && this.partner.ch !== this.chapterId()) this.reach();
      }, 900);
    }
    // appena entrato: raggiungi subito il protagonista
    if (this.joinedAt && this.partner) {
      this.joinedAt = 0;
      this.reach();
    }
    if (this.open) this.refreshUi();
  }

  // vai dov'è l'altro: stesso posto, poi accanto a lui
  reach() {
    const p = this.partner;
    if (!p) {
      this.say('L\'altro non c\'è ancora.');
      return;
    }
    this.close();
    this.pendingSnap = performance.now();
    if (p.ch !== this.chapterId()) this.goTo(p.ch, p.sp);
    else this.snapToPartner();
  }

  snapToPartner() {
    const s = this.scene;
    const p = this.partner;
    if (!s?.player || !p?.pos || p.tr || p.ch !== this.chapterId()) return false;
    if (p.fl !== undefined && s.floorNum !== undefined && p.fl !== s.floorNum) return false;
    const [x, y, z] = p.pos;
    const yaw = p.f || 0;
    const ox = x - Math.sin(yaw) * 1.6 + Math.cos(yaw) * 1.2;
    const oz = z - Math.cos(yaw) * 1.6 - Math.sin(yaw) * 1.2;
    s.player.pos.set(ox, y, oz);
    s.player.vel?.set(0, 0, 0);
    s.updateCamera?.(1, true);
    return true;
  }

  // ---------- Ogni scena nuova ----------
  attach(scene) {
    this.removeRemoteVehicle();
    this.scene = scene;
    this.applyLooks(scene);
  }

  // chi entra come amico si veste da amico, e vede il protagonista vestito da protagonista
  applyLooks(scene, reset = false) {
    if (!scene?.player?.setLook || !scene.friend?.setLook) return;
    const swap = this.role === 'friend' && !reset;
    scene.player.setLook(swap ? LOOK_FRIEND : LOOK_HERO);
    scene.friend.setLook(swap ? LOOK_HERO : LOOK_FRIEND);
  }

  // ---------- Ogni fotogramma ----------
  // prima dell'aggiornamento della scena: il passo dell'amico non lo decide il gioco
  beforeUpdate() {
    this.savedPhase = this.scene?.friend?.walkPhase;
  }

  // dopo l'aggiornamento della scena: manda chi sei, mostra l'altro
  frame(dt) {
    const s = this.scene;
    if (!this.active || !s) return;
    this.sendT -= dt;
    if (this.sendT <= 0) {
      this.sendT = this.link.kind === 'local' ? 1 / 20 : 1 / 30;
      this.lastSent = this.localState();
      this.lastSentAt = performance.now();
      this.link.send(this.lastSent);
    }
    if (this.pendingSnap && this.partner?.ch === this.chapterId()) {
      if (this.snapToPartner() || performance.now() - this.pendingSnap > 8000) this.pendingSnap = 0;
    }
    this.showPartner(dt);
    this.uiT = (this.uiT || 0) - dt;
    if (this.uiT <= 0) {
      this.uiT = 0.5;
      this.refreshUi();
    }
  }

  localVehicle(s) {
    if (s.mode === 'plane' && s.plane) return { k: 'plane', o: s.plane };
    if (s.mode === 'car' && s.jeep) return { k: 'jeep', o: s.jeep };
    if (s.car && (s.mode === 'car' || (s.mode === undefined && !s.player))) return { k: 'car', o: s.car };
    return null;
  }

  localState() {
    const s = this.scene;
    const st = { r: this.role, ch: this.chapterId(), sp: this.ctx.lastSpawn ?? null };
    if (s.floorNum !== undefined) st.fl = s.floorNum;
    const v = this.localVehicle(s);
    const r2 = (n) => Math.round(n * 100) / 100;
    if (v) {
      const o = v.o;
      st.veh = { k: v.k, p: [r2(o.pos.x), r2(o.pos.y), r2(o.pos.z)], h: r2(o.heading ?? o.yaw ?? 0) };
      if (v.k === 'plane') Object.assign(st.veh, { pi: r2(o.pitch), ro: r2(o.roll) });
      else if (o.up) st.veh.u = [r2(o.up.x), r2(o.up.y), r2(o.up.z)];
      st.pos = st.veh.p;
    } else if (s.player) {
      const p = s.player;
      st.pos = [r2(p.pos.x), r2(p.pos.y), r2(p.pos.z)];
      st.f = r2(p.facing);
      st.v = r2(Math.hypot(p.vel?.x || 0, p.vel?.z || 0));
      if (p.sitting) st.sit = 1;
      if (p.feminine) st.fm = 1;
      if (p.group && !p.group.visible) st.hid = 1;
    }
    return st;
  }

  showPartner(dt) {
    const s = this.scene;
    const p = this.partner;
    const here = p && !p.tr && p.ch === this.chapterId() && p.pos && (p.fl === undefined || s.floorNum === undefined || p.fl === s.floorNum);
    // l'amico guidato dal gioco lascia il posto all'altro
    const fr = s.friend;
    if (!here) {
      this.removeRemoteVehicle();
      fr?.setFeminine?.(false); // l'amico del gioco resta com'è
      return;
    }
    // chi siede accanto a te in macchina non è più l'amico del gioco
    for (const veh of [s.car, s.jeep]) if (veh?.friend?.group) veh.friend.group.visible = false;
    if (p.veh) {
      if (fr) fr.group.visible = false;
      this.showRemoteVehicle(p.veh, dt);
      return;
    }
    this.removeRemoteVehicle();
    if (!fr) return;
    const [x, y, z] = p.pos;
    const target = new THREE.Vector3(x, y, z);
    if (fr.pos.distanceTo(target) > 6) fr.pos.copy(target);
    else fr.pos.lerp(target, 1 - Math.exp(-14 * dt));
    let d = (p.f || 0) - fr.facing;
    d = Math.atan2(Math.sin(d), Math.cos(d));
    fr.facing += d * (1 - Math.exp(-14 * dt));
    fr.sitting = !!p.sit;
    fr.setFeminine?.(!!p.fm);
    fr.vel?.set(0, 0, 0);
    fr.group.visible = !p.hid;
    if (this.savedPhase !== undefined) fr.walkPhase = this.savedPhase; // le gambe le muove solo l'altro
    fr.animate(dt, p.v || 0);
  }

  showRemoteVehicle(veh, dt) {
    const s = this.scene;
    if (!this.remoteVeh || this.remoteVeh.k !== veh.k) {
      this.removeRemoteVehicle();
      const Cls = { car: Car, jeep: Jeep, plane: Biplane }[veh.k];
      if (!Cls) return;
      const o = new Cls(s.scene);
      if (o.driver) {
        // al volante c'è l'altro; il posto accanto resta vuoto
        o.driver.group.visible = true;
        o.friend.group.visible = false;
      }
      this.remoteVeh = { k: veh.k, o, last: null };
    }
    const o = this.remoteVeh.o;
    const [x, y, z] = veh.p;
    const target = new THREE.Vector3(x, y, z);
    if (o.pos.distanceTo(target) > 30) o.pos.copy(target);
    else o.pos.lerp(target, 1 - Math.exp(-12 * dt));
    const last = this.remoteVeh.last || target.clone();
    const sp = target.distanceTo(last) / Math.max(dt, 1e-3);
    this.remoteVeh.last = target.clone();
    if (veh.k === 'plane') {
      o.yaw = veh.h;
      o.pitch = veh.pi || 0;
      o.roll = veh.ro || 0;
      o.prop.rotation.z += dt * 40;
      o.sync();
    } else {
      o.heading = veh.h;
      if (veh.u) o.up.set(...veh.u).normalize();
      o.speed = Math.min(sp, 80);
      o.wheelSpin += (o.speed * dt) / 0.44;
      o.syncMesh(dt);
    }
  }

  removeRemoteVehicle() {
    if (!this.remoteVeh) return;
    this.remoteVeh.o.dispose();
    this.remoteVeh = null;
  }
}
