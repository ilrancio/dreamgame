import { FISH, FISH_SPOTS } from './data.js';

// La pesca, con la lenza di Marta. Si lancia, si aspetta che il galleggiante
// vada giù, si ferra al momento giusto, poi si recupera: il pesce scappa su e
// giù nella barra, e tu tieni il riquadro verde sopra di lui (tenendo premuto
// Spazio sale, lasciando scende). Se resta dentro abbastanza, è tuo.

let styled = false;
function injectStyle() {
  if (styled) return;
  styled = true;
  const s = document.createElement('style');
  s.textContent = `
  .fish { position: fixed; z-index: 45; left: 50%; bottom: 36px; transform: translateX(-50%); width: min(520px, 92vw); padding: 12px 16px 14px;
    font: 600 15px Inter, system-ui, sans-serif; color: #fff; text-shadow: 1px 1px 0 #000;
    background: linear-gradient(180deg, rgba(52,86,182,0.94), rgba(14,26,86,0.94)); border: 2px solid rgba(225,232,255,0.9); border-radius: 9px; box-shadow: 0 8px 26px rgba(0,0,0,0.55); }
  .fish .top { display: flex; justify-content: space-between; color: #ffe8a0; font-size: 14px; margin-bottom: 6px; }
  .fish .row { display: flex; gap: 14px; align-items: stretch; }
  .fish canvas { background: linear-gradient(180deg, #0a2a40, #04101c); border-radius: 6px; border: 1px solid rgba(255,255,255,0.4); }
  .fish .msg { flex: 1; font-size: 17px; line-height: 1.4; display: flex; flex-direction: column; justify-content: center; }
  .fish .msg .big { font-size: 26px; color: #ffe060; font-family: "Cormorant Garamond", serif; }
  .fish .k { font-size: 12px; opacity: 0.75; margin-top: 8px; }
  .fish .prog { height: 8px; background: rgba(0,0,0,0.5); border-radius: 4px; overflow: hidden; margin-top: 8px; }
  .fish .prog i { display: block; height: 100%; background: linear-gradient(90deg, #4aff8a, #c8ffd0); }
  `;
  document.head.appendChild(s);
}

const rnd = (a, b) => a + Math.random() * (b - a);

export class Fishing {
  constructor(ctx) {
    injectStyle();
    this.ctx = ctx;
    this.open = false;
  }

  // spot: dove si pesca; good: la lenza d'argento di Nilo (più facile)
  start(spot, { good = false, onCatch, onClose } = {}) {
    this.spot = spot;
    this.good = good;
    this.onCatch = onCatch;
    this.onClose = onClose;
    this.open = true;
    this.ctx.input.unlock();
    this.el = document.createElement('div');
    this.el.className = 'fish';
    this.el.innerHTML = `<div class="top"><span>${FISH_SPOTS[spot].name}</span><span class="cnt"></span></div><div class="row"><canvas width="70" height="190"></canvas><div class="msg"></div></div><div class="prog"><i></i></div><div class="k"></div>`;
    document.body.appendChild(this.el);
    this.cv = this.el.querySelector('canvas');
    this.g = this.cv.getContext('2d');
    this.msgEl = this.el.querySelector('.msg');
    this.keysEl = this.el.querySelector('.k');
    this.progEl = this.el.querySelector('.prog i');
    this.caught = 0;
    this.cast();
  }

  cast() {
    this.phase = 'wait';
    this.t = 0;
    this.biteAt = rnd(1.8, 5.5);
    this.ctx.audio.whoosh(0.15);
    this.say('Lanci. Il galleggiante dondola sull\'acqua...', '<b>Spazio</b>/<b>E</b> quando abbocca · <b>Esc</b> smetti');
  }

  say(html, keys) {
    this.msgEl.innerHTML = html;
    if (keys !== undefined) this.keysEl.innerHTML = keys;
  }

  // quale pesce: secondo la rarità, fra quelli di questo posto
  pick() {
    const pool = Object.entries(FISH).filter(([, f]) => f.spot === this.spot);
    const tot = pool.reduce((s, [, f]) => s + f.w, 0);
    let r = Math.random() * tot;
    for (const [id, f] of pool) if ((r -= f.w) <= 0) return id;
    return pool[0][0];
  }

  update(dt) {
    if (!this.open) return;
    const { input, audio } = this.ctx;
    const hit = input.wasPressed('Space', 'KeyE', 'Enter');
    const hold = input.down('Space', 'KeyE', 'Enter');
    if (input.wasPressed('Escape', 'KeyQ')) return this.close();
    this.t += dt;
    if (this.phase === 'wait') {
      if (hit) {
        audio.thud(0.1);
        this.say('Troppo presto: il pesce se n\'è andato.');
        this.phase = 'pause';
        this.next = () => this.cast();
        this.t = 0;
      } else if (this.t > this.biteAt) {
        this.phase = 'bite';
        this.t = 0;
        this.window = this.good ? 1.15 : 0.85;
        audio.pop(0.2);
        this.say('<span class="big">Abbocca!</span>', '<b>Spazio</b>/<b>E</b> adesso!');
      }
    } else if (this.phase === 'bite') {
      if (hit) {
        this.fish = this.pick();
        const F = FISH[this.fish];
        this.phase = 'reel';
        this.t = 0;
        this.f = 0.5; // dov'è il pesce nella barra (0 in basso, 1 in alto)
        this.fv = 0;
        this.ft = 0.5;
        this.z = 0.3; // dov'è il riquadro verde
        this.zv = 0;
        this.zs = (this.good ? 0.36 : 0.28) / Math.sqrt(F.diff);
        this.p = 0.3;
        audio.chime(880, 0.06);
        this.say('Tira! Tieni il riquadro verde sopra al pesce.', '<b>Spazio</b>/<b>E</b> tenuto: il riquadro sale · lasciato: scende');
      } else if (this.t > this.window) {
        audio.thud(0.1);
        this.say('Troppo tardi: ha mangiato l\'esca ed è scappato.');
        this.phase = 'pause';
        this.next = () => this.cast();
        this.t = 0;
      }
    } else if (this.phase === 'reel') {
      const F = FISH[this.fish];
      // il pesce: ogni tanto cambia idea su dove andare
      if (Math.random() < dt * (0.8 + F.diff * 1.2)) this.ft = Math.random();
      this.fv += (this.ft - this.f) * dt * (6 + F.diff * 8);
      this.fv *= Math.exp(-dt * 3);
      this.f = Math.max(0.03, Math.min(0.97, this.f + this.fv * dt));
      // il riquadro: sale tenendo premuto, scende per conto suo
      this.zv += (hold ? 2.4 : -2.0) * dt;
      this.zv *= Math.exp(-dt * 1.6);
      this.z += this.zv * dt;
      if (this.z < this.zs / 2) {
        this.z = this.zs / 2;
        this.zv = Math.max(0, this.zv) * 0.3;
      }
      if (this.z > 1 - this.zs / 2) {
        this.z = 1 - this.zs / 2;
        this.zv = Math.min(0, this.zv) * 0.3;
      }
      const inside = Math.abs(this.f - this.z) < this.zs / 2;
      this.p += (inside ? 0.3 : -0.2 * (0.7 + F.diff * 0.3)) * dt;
      if (inside && Math.random() < dt * 6) audio.bleep?.(0.02);
      if (this.p >= 1) this.land();
      else if (this.p <= 0) {
        audio.thud(0.15);
        this.say(`La lenza si allenta... ${F.big ? 'Era grosso, però.' : 'È scappato.'}`);
        this.phase = 'pause';
        this.next = () => this.cast();
        this.t = 0;
      }
    } else if (this.phase === 'pause' || this.phase === 'landed') {
      if (this.t > (this.phase === 'landed' ? 0.6 : 1.4) && (this.phase === 'pause' || hit)) this.next();
    }
    this.draw();
  }

  land() {
    const F = FISH[this.fish];
    const size = Math.round(rnd(F.size[0], F.size[1]));
    const isNew = this.onCatch?.(this.fish, size);
    this.caught++;
    this.ctx.audio.chime(1318, 0.08);
    setTimeout(() => this.ctx.audio.chime(1760, 0.08), 150);
    this.say(`<span class="big">${F.name}</span>${size} cm${isNew ? ' · <span style="color:#8af8ff">nuovo nel taccuino!</span>' : ''}<br><span style="font-size:13px;opacity:.85">${F.desc}</span>`, '<b>Spazio</b>/<b>E</b> lancia di nuovo · <b>Esc</b> smetti');
    this.phase = 'landed';
    this.next = () => this.cast();
    this.t = 0;
  }

  draw() {
    const g = this.g;
    const W = this.cv.width;
    const H = this.cv.height;
    g.clearRect(0, 0, W, H);
    this.el.querySelector('.cnt').textContent = this.caught ? `pescati: ${this.caught}` : '';
    if (this.phase === 'reel') {
      const y = (v) => H - 6 - v * (H - 12);
      g.fillStyle = 'rgba(80,255,140,0.45)';
      g.strokeStyle = '#8affa8';
      const zh = this.zs * (H - 12);
      g.fillRect(8, y(this.z) - zh / 2, W - 16, zh);
      g.strokeRect(8, y(this.z) - zh / 2, W - 16, zh);
      // il pesce
      g.fillStyle = FISH[this.fish].rare ? '#ffd060' : '#c8e8ff';
      g.beginPath();
      g.ellipse(W / 2, y(this.f), 13, 7, 0, 0, Math.PI * 2);
      g.fill();
      g.beginPath();
      g.moveTo(W / 2 - 11, y(this.f));
      g.lineTo(W / 2 - 21, y(this.f) - 7);
      g.lineTo(W / 2 - 21, y(this.f) + 7);
      g.fill();
      this.progEl.style.width = `${Math.max(0, Math.min(1, this.p)) * 100}%`;
    } else {
      // il galleggiante sull'acqua
      const wy = H * 0.45;
      g.strokeStyle = 'rgba(160,200,255,0.5)';
      g.beginPath();
      for (let x = 0; x <= W; x += 4) g.lineTo(x, wy + Math.sin(x * 0.2 + this.t * 3) * 2);
      g.stroke();
      const dip = this.phase === 'bite' ? 14 + Math.sin(this.t * 40) * 3 : Math.sin(this.t * 2.2) * 2;
      g.fillStyle = '#ff4a3a';
      g.beginPath();
      g.arc(W / 2, wy - 4 + dip, 6, Math.PI, 0);
      g.fill();
      g.fillStyle = '#fff';
      g.beginPath();
      g.arc(W / 2, wy - 4 + dip, 6, 0, Math.PI);
      g.fill();
      g.strokeStyle = 'rgba(255,255,255,0.4)';
      g.beginPath();
      g.moveTo(W / 2, wy - 10 + dip);
      g.lineTo(W - 4, 4);
      g.stroke();
      this.progEl.style.width = '0%';
    }
  }

  close() {
    if (!this.open) return;
    this.open = false;
    this.el.remove();
    this.onClose?.(this.caught);
  }
}
