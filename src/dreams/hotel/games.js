import { PRIZES } from './prizes.js';

// Minigiochi dei cabinati: disegnati su un canvas 320×240, con uno schermo
// a tubo catodico sopra al gioco 3D. Ogni gioco restituisce biglietti (e premi).

const W = 320;
const H = 240;

function text(g, s, x, y, { size = 10, color = '#fff', align = 'left' } = {}) {
  g.font = `bold ${size}px monospace`;
  g.textAlign = align;
  g.fillStyle = color;
  g.fillText(s, x, y);
}

function drawGnome(g, x, y, s = 1, frame = 0) {
  g.fillStyle = '#3a5ac8';
  g.fillRect(x - 5 * s, y, 10 * s, 7 * s);
  g.fillStyle = '#f0c0a0';
  g.fillRect(x - 4 * s, y - 5 * s, 8 * s, 5 * s);
  g.fillStyle = '#f4f4f0';
  g.fillRect(x - 3 * s, y - 1 * s, 6 * s, 4 * s);
  g.fillStyle = '#d82a2a';
  g.beginPath();
  g.moveTo(x - 5 * s, y - 5 * s);
  g.lineTo(x + (frame ? 1 : -1) * s, y - 13 * s);
  g.lineTo(x + 5 * s, y - 5 * s);
  g.fill();
  g.fillStyle = '#111';
  g.fillRect(x - 2 * s, y - 3 * s, 1 * s, 1 * s);
  g.fillRect(x + 1 * s, y - 3 * s, 1 * s, 1 * s);
}

// ---------------- GNOMI INVADERS ----------------
class GnomiInvaders {
  constructor(api) {
    this.api = api;
    this.x = W / 2;
    this.lives = 3;
    this.score = 0;
    this.wave = 0;
    this.shots = [];
    this.bombs = [];
    this.cd = 0;
    this.hitT = 0;
    this.newWave();
  }

  newWave() {
    this.wave++;
    this.gnomes = [];
    for (let r = 0; r < 4; r++) for (let c = 0; c < 8; c++) this.gnomes.push({ x: 50 + c * 28, y: 34 + r * 22, alive: true });
    this.dir = 1;
    this.speed = 16 + this.wave * 8;
    this.bombT = 1;
  }

  update(dt, k) {
    if (this.done) return;
    this.x = Math.max(12, Math.min(W - 12, this.x + ((k.right ? 1 : 0) - (k.left ? 1 : 0)) * 140 * dt));
    this.cd -= dt;
    if (k.fireHeld && this.cd <= 0 && this.shots.length < 3) {
      this.shots.push({ x: this.x, y: 212 });
      this.cd = 0.28;
      this.api.sfx('blip');
    }
    this.shots.forEach((s) => (s.y -= 230 * dt));
    this.shots = this.shots.filter((s) => s.y > 0);
    const alive = this.gnomes.filter((q) => q.alive);
    const speed = this.speed * (1 + (1 - alive.length / 32) * 2);
    let edge = false;
    for (const q of alive) {
      q.x += this.dir * speed * dt;
      if (q.x < 10 || q.x > W - 10) edge = true;
    }
    if (edge) {
      this.dir *= -1;
      alive.forEach((q) => (q.y += 8));
    }
    for (const s of this.shots)
      for (const q of alive)
        if (q.alive && Math.abs(s.x - q.x) < 7 && s.y > q.y - 12 && s.y < q.y + 7) {
          q.alive = false;
          s.y = -99;
          this.score += 10;
          this.api.sfx('pop');
        }
    this.bombT -= dt;
    if (this.bombT <= 0 && alive.length) {
      const q = alive[Math.floor(Math.random() * alive.length)];
      this.bombs.push({ x: q.x, y: q.y + 8 });
      this.bombT = Math.max(0.35, 1.1 - this.wave * 0.12);
    }
    this.bombs.forEach((b) => (b.y += 95 * dt));
    this.bombs = this.bombs.filter((b) => {
      if (b.y > 206 && b.y < 222 && Math.abs(b.x - this.x) < 11 && this.hitT <= 0) {
        this.lives--;
        this.hitT = 1;
        this.api.sfx('boom');
        return false;
      }
      return b.y < H;
    });
    this.hitT -= dt;
    if (!alive.length) {
      this.score += 50;
      this.api.sfx('win');
      this.newWave();
    }
    if (this.lives <= 0 || alive.some((q) => q.y > 196)) this.done = true;
  }

  draw(g, t) {
    g.fillStyle = '#05050f';
    g.fillRect(0, 0, W, H);
    for (let i = 0; i < 40; i++) {
      g.fillStyle = 'rgba(255,255,255,0.4)';
      g.fillRect((i * 73) % W, (i * 37 + t * 10) % H, 1, 1);
    }
    const frame = Math.floor(t * 3) % 2;
    this.gnomes.forEach((q) => q.alive && drawGnome(g, q.x, q.y, 1, frame));
    g.fillStyle = '#fff';
    this.shots.forEach((s) => g.fillRect(s.x - 1, s.y, 2, 6));
    g.fillStyle = '#c8a050';
    this.bombs.forEach((b) => g.fillRect(b.x - 2, b.y, 4, 5));
    // la teiera-cannone
    if (this.hitT <= 0 || Math.floor(t * 12) % 2) {
      g.fillStyle = '#f2eee6';
      g.beginPath();
      g.ellipse(this.x, 218, 10, 7, 0, 0, Math.PI * 2);
      g.fill();
      g.fillRect(this.x - 1, 206, 2, 6);
      g.fillRect(this.x + 8, 214, 6, 2);
    }
    text(g, `PUNTI ${this.score}`, 6, 12);
    text(g, `ONDATA ${this.wave}`, W / 2, 12, { align: 'center' });
    text(g, '♥'.repeat(Math.max(0, this.lives)), W - 6, 12, { align: 'right', color: '#ff4a6a' });
  }

  tickets() {
    return Math.floor(this.score / 40);
  }
}

// ---------------- FUGA DAL DEMONE ----------------
class FugaDemone {
  constructor(api) {
    this.api = api;
    this.x = W / 2;
    this.y = 200;
    this.lives = 3;
    this.score = 0;
    this.t = 0;
    this.spawnT = 1.5;
    this.targets = [];
    this.rocks = [];
    this.hitT = 0;
  }

  update(dt, k) {
    if (this.done) return;
    this.t += dt;
    this.score += dt * 10;
    this.x = Math.max(12, Math.min(W - 12, this.x + ((k.right ? 1 : 0) - (k.left ? 1 : 0)) * 160 * dt));
    this.y = Math.max(110, Math.min(226, this.y + ((k.down ? 1 : 0) - (k.up ? 1 : 0)) * 120 * dt));
    this.spawnT -= dt;
    if (this.spawnT <= 0) {
      const n = this.t > 30 ? 2 : 1;
      for (let i = 0; i < n; i++) {
        this.targets.push({ x: Math.max(15, Math.min(W - 15, this.x + (Math.random() - 0.5) * 120)), y: 115 + Math.random() * 110, t: 1.15 });
      }
      this.spawnT = Math.max(0.55, 1.4 - this.t * 0.02);
      this.api.sfx('whoosh');
    }
    this.hitT -= dt;
    this.targets = this.targets.filter((q) => {
      q.t -= dt;
      if (q.t > 0) return true;
      const d = Math.hypot(q.x - this.x, q.y - this.y);
      this.rocks.push({ x: q.x, y: q.y, life: 3 });
      this.api.sfx('boom');
      if (d < 16 && this.hitT <= 0) {
        this.lives--;
        this.hitT = 1.2;
      } else if (d < 36) {
        this.score += 25;
        this.api.sfx('blip');
      }
      return false;
    });
    this.rocks.forEach((r) => (r.life -= dt));
    this.rocks = this.rocks.filter((r) => r.life > 0);
    if (this.lives <= 0) this.done = true;
  }

  draw(g, t) {
    g.fillStyle = '#3a6a2a';
    g.fillRect(0, 0, W, H);
    for (let y = 0; y < H; y += 16) {
      g.fillStyle = (Math.floor((y + t * 60) / 16) % 2) ? '#44762e' : '#3a6a2a';
      g.fillRect(0, (y + t * 60) % H, W, 8);
    }
    const sky = g.createLinearGradient(0, 0, 0, 90);
    sky.addColorStop(0, '#2b0f2a');
    sky.addColorStop(1, '#e0643a');
    g.fillStyle = sky;
    g.fillRect(0, 0, W, 90);
    // il demone, fermo, che guarda
    g.fillStyle = '#140808';
    g.fillRect(W / 2 - 22, 22, 44, 60);
    g.fillRect(W / 2 - 34, 30, 12, 40);
    g.fillRect(W / 2 + 22, 30, 12, 40);
    g.fillRect(W / 2 - 14, 8, 28, 18);
    g.fillStyle = '#ffe070';
    g.fillRect(W / 2 - 8, 14, 4, 3);
    g.fillRect(W / 2 + 4, 14, 4, 3);
    this.targets.forEach((q) => {
      g.strokeStyle = '#ff3a20';
      g.lineWidth = 2;
      g.beginPath();
      g.arc(q.x, q.y, 6 + q.t * 14, 0, Math.PI * 2);
      g.stroke();
    });
    this.rocks.forEach((r) => {
      g.fillStyle = r.life > 2.6 ? '#ff7a2a' : '#4a4040';
      g.beginPath();
      g.arc(r.x, r.y, 10, 0, Math.PI * 2);
      g.fill();
    });
    if (this.hitT <= 0 || Math.floor(t * 12) % 2) {
      g.fillStyle = '#c42b2b';
      g.fillRect(this.x - 7, this.y - 11, 14, 22);
      g.fillStyle = '#e0b089';
      g.fillRect(this.x - 4, this.y - 3, 3, 3);
      g.fillStyle = '#d9a82e';
      g.fillRect(this.x + 1, this.y - 3, 3, 3);
    }
    text(g, `PUNTI ${Math.floor(this.score)}`, 6, 104, { color: '#fff' });
    text(g, '♥'.repeat(Math.max(0, this.lives)), W - 6, 104, { align: 'right', color: '#ff4a6a' });
  }

  tickets() {
    return Math.floor(this.score / 30);
  }
}

// ---------------- PING DEL TÈ (contro l'amico) ----------------
class PingTe {
  constructor(api) {
    this.api = api;
    this.py = H / 2;
    this.fy = H / 2;
    this.me = 0;
    this.him = 0;
    this.serve(1);
  }

  serve(dir) {
    this.bx = W / 2;
    this.by = H / 2;
    this.vx = 110 * dir;
    this.vy = (Math.random() - 0.5) * 120;
    this.wait = 0.8;
  }

  update(dt, k) {
    if (this.done) return;
    this.py = Math.max(24, Math.min(H - 24, this.py + ((k.down ? 1 : 0) - (k.up ? 1 : 0)) * 170 * dt));
    // l'amico segue la palla, ma non è perfetto
    const target = this.vx > 0 ? this.by + Math.sin(this.bx * 0.05) * 14 : H / 2;
    this.fy += Math.max(-125 * dt, Math.min(125 * dt, target - this.fy));
    if (this.wait > 0) {
      this.wait -= dt;
      return;
    }
    this.bx += this.vx * dt;
    this.by += this.vy * dt;
    if (this.by < 6 || this.by > H - 6) {
      this.vy *= -1;
      this.by = Math.max(6, Math.min(H - 6, this.by));
    }
    const hit = (py, side) => {
      const off = (this.by - py) / 20;
      this.vx = -this.vx * 1.06;
      this.vy += off * 110;
      this.bx = side;
      this.api.sfx('blip');
    };
    if (this.vx < 0 && this.bx < 18 && this.bx > 8 && Math.abs(this.by - this.py) < 22) hit(this.py, 18);
    if (this.vx > 0 && this.bx > W - 18 && this.bx < W - 8 && Math.abs(this.by - this.fy) < 22) hit(this.fy, W - 18);
    if (this.bx < -10) {
      this.him++;
      this.api.say(['Ahah! Punto mio.', 'Troppo lento!', 'Il tè ti rallenta.'][this.him % 3]);
      this.serve(1);
    } else if (this.bx > W + 10) {
      this.me++;
      this.api.sfx('win');
      this.api.say(['Ehi! Fortuna.', 'Va bene, va bene...', 'Non vale, mi hai distratto.'][this.me % 3]);
      this.serve(-1);
    }
    if (this.me >= 5 || this.him >= 5) {
      this.done = true;
      this.api.say(this.me > this.him ? 'Rivincita. Subito.' : 'Te l\'avevo detto che ero forte.');
    }
  }

  draw(g) {
    g.fillStyle = '#0a1a14';
    g.fillRect(0, 0, W, H);
    g.fillStyle = 'rgba(255,255,255,0.2)';
    for (let y = 0; y < H; y += 12) g.fillRect(W / 2 - 1, y, 2, 6);
    g.fillStyle = '#6aa8ff';
    g.fillRect(10, this.py - 20, 6, 40);
    g.fillStyle = '#ffc84a';
    g.fillRect(W - 16, this.fy - 20, 6, 40);
    // la "palla" è una zolletta di zucchero
    g.fillStyle = '#fff';
    g.fillRect(this.bx - 4, this.by - 4, 8, 8);
    text(g, String(this.me), W / 2 - 30, 26, { size: 20, align: 'center', color: '#6aa8ff' });
    text(g, String(this.him), W / 2 + 30, 26, { size: 20, align: 'center', color: '#ffc84a' });
    text(g, 'TU', 20, H - 8, { color: '#6aa8ff' });
    text(g, 'IL TUO AMICO', W - 20, H - 8, { align: 'right', color: '#ffc84a' });
  }

  tickets() {
    return this.me > this.him ? 25 : 5 + this.me * 2;
  }
}

// ---------------- ARTIGLIO (la gru dei peluche) ----------------
class Artiglio {
  constructor(api) {
    this.api = api;
    this.cx = W / 2;
    this.cy = 40;
    this.state = 'move';
    this.tries = 3;
    this.won = [];
    const pool = PRIZES.slice(0, 8);
    this.items = [];
    for (let i = 0; i < 9; i++) {
      const p = pool[Math.floor(Math.random() * Math.random() * pool.length)];
      this.items.push({ p, x: 70 + i * 26 + (Math.random() - 0.5) * 8, y: 196 - (i % 2) * 10, taken: false });
    }
    this.colors = { paperella: '#ffd21a', cartolina: '#e0643a', dado: '#f4f0e8', gnomo: '#d82a2a', specchi: '#c8d0ff', razzo: '#e03a3a', demone: '#2a1216', lava: '#ff4a8a' };
  }

  update(dt, k) {
    if (this.done) return;
    if (this.state === 'move') {
      this.cx = Math.max(60, Math.min(W - 20, this.cx + ((k.right ? 1 : 0) - (k.left ? 1 : 0)) * 90 * dt));
      if (k.fire) {
        this.state = 'down';
        this.api.sfx('whoosh');
      }
    } else if (this.state === 'down') {
      this.cy += 90 * dt;
      if (this.cy >= 180) {
        const target = this.items.filter((q) => !q.taken).sort((a, b) => Math.abs(a.x - this.cx) - Math.abs(b.x - this.cx))[0];
        const chance = target ? (target.p.cost < 80 ? 0.6 : 0.35) : 0;
        if (target && Math.abs(target.x - this.cx) < 11 && Math.random() < chance) {
          this.holding = target;
          target.taken = true;
        }
        this.state = 'up';
      }
    } else if (this.state === 'up') {
      this.cy -= 80 * dt;
      if (this.holding && Math.random() < dt * 0.25) {
        // la presa si allenta... come sempre
        this.holding.taken = false;
        this.holding = null;
        this.api.say('Nooo, l\'ha mollato!');
      }
      if (this.cy <= 40) {
        this.cy = 40;
        this.state = this.holding ? 'carry' : 'reset';
      }
    } else if (this.state === 'carry') {
      this.cx -= 90 * dt;
      if (this.cx <= 30) {
        this.won.push(this.holding.p.id);
        this.api.sfx('win');
        this.api.say(`Hai vinto: ${this.holding.p.name}!`);
        this.holding = null;
        this.state = 'reset';
      }
    } else if (this.state === 'reset') {
      this.tries--;
      if (this.tries <= 0) this.done = true;
      else this.state = 'move';
    }
  }

  draw(g) {
    g.fillStyle = '#1a0a2a';
    g.fillRect(0, 0, W, H);
    g.strokeStyle = '#ff2a9a';
    g.lineWidth = 3;
    g.strokeRect(50, 20, W - 60, 200);
    g.fillStyle = '#2a1a3a';
    g.fillRect(12, 150, 36, 70);
    text(g, 'PREMI', 30, 145, { align: 'center', size: 8, color: '#ff2a9a' });
    for (const q of this.items) {
      if (q.taken && q !== this.holding) continue;
      const x = q === this.holding ? this.cx : q.x;
      const y = q === this.holding ? this.cy + 22 : q.y;
      g.fillStyle = this.colors[q.p.id] || '#fff';
      g.beginPath();
      g.arc(x, y, 10, 0, Math.PI * 2);
      g.fill();
      g.strokeStyle = 'rgba(255,255,255,0.4)';
      g.lineWidth = 1;
      g.stroke();
    }
    g.strokeStyle = '#ddd';
    g.lineWidth = 2;
    g.beginPath();
    g.moveTo(this.cx, 20);
    g.lineTo(this.cx, this.cy);
    g.stroke();
    const open = this.state === 'down' ? 8 : 4;
    g.beginPath();
    g.moveTo(this.cx - open, this.cy + 12);
    g.lineTo(this.cx, this.cy);
    g.lineTo(this.cx + open, this.cy + 12);
    g.stroke();
    text(g, `TENTATIVI ${this.tries}`, 60, 14);
    text(g, `VINTI ${this.won.length}`, W - 10, 14, { align: 'right' });
  }

  tickets() {
    return 3 + this.won.length * 2;
  }
}

// ---------------- SERPENTE ----------------
// Il gioco del negozio di retrogiochi: verde fosforo, un serpente che mangia
// cappelli da gnomo. Lento all'inizio, come piace al commesso.
class Serpente {
  constructor(api) {
    this.api = api;
    this.cols = 20;
    this.rows = 13;
    this.cell = 16;
    this.body = [[10, 6], [9, 6], [8, 6]];
    this.dir = [1, 0];
    this.next = [1, 0];
    this.step = 0;
    this.speed = 5;
    this.eaten = 0;
    this.placeFood();
  }

  placeFood() {
    for (let k = 0; k < 200; k++) {
      const f = [Math.floor(Math.random() * this.cols), Math.floor(Math.random() * this.rows)];
      if (!this.body.some(([x, y]) => x === f[0] && y === f[1])) {
        this.food = f;
        return;
      }
    }
  }

  update(dt, k) {
    if (this.done) return;
    const [dx, dy] = this.dir;
    if (k.left && dx === 0) this.next = [-1, 0];
    else if (k.right && dx === 0) this.next = [1, 0];
    else if (k.up && dy === 0) this.next = [0, -1];
    else if (k.down && dy === 0) this.next = [0, 1];
    this.step += dt * this.speed;
    if (this.step < 1) return;
    this.step = 0;
    this.dir = this.next;
    const h = this.body[0];
    const nh = [(h[0] + this.dir[0] + this.cols) % this.cols, (h[1] + this.dir[1] + this.rows) % this.rows];
    if (this.body.some(([x, y]) => x === nh[0] && y === nh[1])) {
      this.done = true;
      this.api.sfx('boom');
      return;
    }
    this.body.unshift(nh);
    if (nh[0] === this.food[0] && nh[1] === this.food[1]) {
      this.eaten++;
      this.speed = Math.min(12, 5 + this.eaten * 0.35);
      this.api.sfx('blip');
      this.placeFood();
    } else this.body.pop();
  }

  draw(g, t) {
    const c = this.cell;
    const ox = (W - this.cols * c) / 2;
    const oy = 28;
    g.fillStyle = '#041a08';
    g.fillRect(0, 0, W, H);
    g.strokeStyle = '#1a6a2a';
    g.strokeRect(ox - 1, oy - 1, this.cols * c + 2, this.rows * c + 2);
    // il cappello da gnomo da mangiare
    const [fx, fy] = this.food;
    g.fillStyle = '#ff3a3a';
    g.beginPath();
    g.moveTo(ox + fx * c + 2, oy + fy * c + c - 2);
    g.lineTo(ox + fx * c + c / 2, oy + fy * c + 1 + Math.sin(t * 6) * 1.5);
    g.lineTo(ox + fx * c + c - 2, oy + fy * c + c - 2);
    g.fill();
    this.body.forEach(([x, y], i) => {
      g.fillStyle = i === 0 ? '#c8ffb0' : i % 2 ? '#5aff6a' : '#3ae04a';
      g.fillRect(ox + x * c + 1, oy + y * c + 1, c - 2, c - 2);
    });
    text(g, `CAPPELLI ${this.eaten}`, 10, 16, { color: '#8aff9a' });
    text(g, 'SERPENTE', W - 10, 16, { align: 'right', color: '#8aff9a' });
  }

  tickets() {
    return 1 + Math.floor(this.eaten / 2);
  }
}

export const GAMES = {
  invaders: { title: 'GNOMI INVADERS', make: (api) => new GnomiInvaders(api), help: 'A/D muovi · Spazio spara' },
  demone: { title: 'FUGA DAL DEMONE', make: (api) => new FugaDemone(api), help: 'WASD guida · schiva i cerchi rossi' },
  ping: { title: 'PING DEL TÈ', make: (api) => new PingTe(api), help: 'W/S muovi · primo a 5 contro il tuo amico' },
  artiglio: { title: 'ARTIGLIO', make: (api) => new Artiglio(api), help: 'A/D muovi · Spazio cala la gru · 3 tentativi' },
  serpente: { title: 'SERPENTE', make: (api) => new Serpente(api), help: 'WASD gira · mangia i cappelli, non morderti la coda' },
};

// Lo schermo sovrapposto: gestisce inizio, partita, fine e biglietti.
export class ArcadeScreen {
  constructor() {
    this.el = document.getElementById('arcade');
    this.canvas = document.getElementById('arcade-canvas');
    this.canvas.width = W;
    this.canvas.height = H;
    this.g = this.canvas.getContext('2d');
    this.footer = document.getElementById('arcade-footer');
    this.open = false;
  }

  start(key, api, onExit) {
    this.key = key;
    this.def = GAMES[key];
    this.api = api;
    this.game = this.def.make(api);
    this.onExit = onExit;
    this.t = 0;
    this.phase = 'title';
    this.open = true;
    this.el.classList.add('show');
    this.footer.innerHTML = `${this.def.help} · <kbd>Esc</kbd> esci`;
  }

  update(dt, input) {
    if (!this.open) return;
    this.t += dt;
    const k = {
      left: input.down('KeyA', 'ArrowLeft'),
      right: input.down('KeyD', 'ArrowRight'),
      up: input.down('KeyW', 'ArrowUp'),
      down: input.down('KeyS', 'ArrowDown'),
      fire: input.wasPressed('Space', 'Enter'),
      fireHeld: input.down('Space'),
    };
    const g = this.g;
    if (input.wasPressed('Escape', 'KeyQ')) {
      this.finish();
      return;
    }
    if (this.phase === 'title') {
      g.fillStyle = '#000';
      g.fillRect(0, 0, W, H);
      text(g, this.def.title, W / 2, 90, { size: 20, align: 'center', color: '#ffe42a' });
      text(g, this.def.help, W / 2, 130, { size: 9, align: 'center', color: '#9ae' });
      if (Math.floor(this.t * 2) % 2) text(g, 'PREMI SPAZIO', W / 2, 170, { size: 12, align: 'center' });
      if (k.fire) this.phase = 'play';
      return;
    }
    if (this.phase === 'play') {
      this.game.update(Math.min(dt, 1 / 30), k);
      this.game.draw(g, this.t);
      if (this.game.done) {
        this.phase = 'over';
        this.overT = 0;
      }
      return;
    }
    // fine partita
    this.overT += dt;
    this.game.draw(g, this.t);
    g.fillStyle = 'rgba(0,0,0,0.7)';
    g.fillRect(40, 70, W - 80, 100);
    text(g, 'FINE PARTITA', W / 2, 100, { size: 16, align: 'center', color: '#ff4a8a' });
    text(g, `+${this.game.tickets()} BIGLIETTI`, W / 2, 128, { size: 12, align: 'center', color: '#ffe42a' });
    if (Math.floor(this.t * 2) % 2) text(g, 'SPAZIO PER CHIUDERE', W / 2, 154, { size: 9, align: 'center' });
    if (this.overT > 0.6 && k.fire) this.finish();
  }

  finish() {
    const result = { tickets: this.game.done ? this.game.tickets() : Math.floor(this.game.tickets() / 2), prizes: this.game.won || [] };
    this.open = false;
    this.el.classList.remove('show');
    const cb = this.onExit;
    this.onExit = null;
    cb?.(result);
  }
}
