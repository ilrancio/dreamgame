import { heroStats, formById } from './chiavetta.js';

// Il combattimento dentro il terminale: un po' picchiaduro, un po' shooter
// laterale. Si avanza verso destra in una copia digitale del luogo, le entità
// arrivano a ondate (lo schermo si blocca finché non le hai cancellate), e in
// fondo c'è il boss del terminale.
export const FW = 480;
export const FH = 270;
const GY = 232; // il pavimento (i piedi)
const G = 900;

const rnd = (a, b) => a + Math.random() * (b - a);
const overlap = (a, b) => a.x - a.w / 2 < b.x + b.w / 2 && a.x + a.w / 2 > b.x - b.w / 2 && a.y - a.h < b.y && a.y > b.y - b.h;

// Le entità normali
const ENEMY = {
  glitch: { w: 16, h: 18, hp: 26, xp: 8, color: '#ff3ad8' },
  drone: { w: 18, h: 14, hp: 18, xp: 10, color: '#3af0ff', fly: true },
  firewall: { w: 26, h: 40, hp: 70, xp: 22, color: '#ff8a2a', shield: true },
};

// I boss: uno per terminale, ognuno con le sue mosse
const BOSS = {
  bug: { name: 'BUG', w: 26, h: 24, hp: 170, color: '#6aff4a', moves: ['hop', 'dash', 'hop'], speed: 70 },
  spam: { name: 'SPAM', w: 30, h: 32, hp: 340, color: '#ffe42a', moves: ['arc', 'dash', 'spread'], speed: 55 },
  firewall: { name: 'FIREWALL', w: 40, h: 52, hp: 520, color: '#ff5a2a', moves: ['wave', 'dash', 'slam'], speed: 40, shield: true },
  kernel: { name: 'KERNEL PANIC', w: 22, h: 42, hp: 700, color: '#f4f4f4', moves: ['teleport', 'spread', 'rain', 'dash'], speed: 75 },
};

export class Fight {
  // def: { name, diff, boss, theme }; hero: dati della chiavetta; sfx(nome)
  constructor(def, hero, sfx, formId = 'scintilla') {
    this.def = def;
    this.sfx = sfx;
    this.diff = def.diff;
    this.form = formById(formId);
    this.st = heroStats(hero, this.form);
    this.killsBy = {};
    this.level = hero.level;
    this.len = 1300 + def.diff * 220;
    const st = this.st;
    this.p = { x: 60, y: GY, vx: 0, vy: 0, w: this.form.w, h: this.form.h, floaty: !!this.form.float, facing: 1, hp: st.hp, maxHp: st.hp, energy: 100, ground: true, state: 'idle', t: 0, combo: 0, comboT: 0, inv: 0, flash: 0, shotCd: 0, dashCd: 0, hitId: 0 };
    this.enemies = [];
    this.shots = [];
    this.parts = [];
    this.nums = [];
    this.camX = 0;
    this.lock = null;
    this.shake = 0;
    this.hitstop = 0;
    this.xp = 0;
    this.kills = 0;
    this.t = 0;
    this.banner = { text: `${def.name.toUpperCase()}`, sub: 'entità rilevate', t: 2.2 };
    this.waves = this.makeWaves();
    this.boss = null;
    this.bossStarted = false;
  }

  makeWaves() {
    const d = this.diff;
    const n = 3 + Math.min(2, d - 1);
    const waves = [];
    for (let i = 0; i < n; i++) {
      const at = 260 + i * ((this.len - 820) / Math.max(1, n - 1));
      const list = [];
      for (let k = 0; k < 2 + d + i; k++) list.push({ type: 'glitch', side: k % 3 === 2 ? -1 : 1, delay: k * rnd(0.5, 0.9) });
      if (i >= 1) for (let k = 0; k < 1 + Math.floor((d + i) / 3); k++) list.push({ type: 'drone', side: 1, delay: 1 + k * 1.4 });
      if (d >= 2 && i === n - 1) list.push({ type: 'firewall', side: 1, delay: 2 });
      waves.push({ at, list, started: false, done: false, pending: [] });
    }
    return waves;
  }

  spawn(type, side) {
    const e = ENEMY[type];
    const x = side > 0 ? this.camX + FW + 20 : this.camX - 20;
    const hp = e.hp * (0.8 + this.diff * 0.35);
    this.enemies.push({ type, x, y: e.fly ? rnd(120, 150) : GY, vx: 0, vy: 0, w: e.w, h: e.h, hp, maxHp: hp, facing: -side, state: 'walk', t: 0, cd: rnd(0.5, 1.5), flash: 0, shield: e.shield ? 3 : 0, xp: e.xp * this.diff, color: e.color, fly: !!e.fly, phase: Math.random() * 6, hitBy: -1 });
  }

  spawnBoss() {
    const b = BOSS[this.def.boss];
    const hp = b.hp * (1 + (this.level - 1) * 0.04);
    this.boss = { type: 'boss', kind: this.def.boss, def: b, x: this.camX + FW + 30, y: GY, vx: 0, vy: 0, w: b.w, h: b.h, hp, maxHp: hp, facing: -1, state: 'enter', t: 0, cd: 1.2, flash: 0, shield: b.shield ? 4 : 0, xp: 90 * this.diff + 30, color: b.color, move: null, mi: 0, hitDone: false, ground: true, hitBy: -1, alpha: 1 };
    this.enemies.push(this.boss);
    this.banner = { text: b.name, sub: 'boss del terminale', t: 2.4 };
    this.sfx('boss');
  }

  // ---------------- aggiornamento ----------------
  update(dt, k) {
    if (this.done) return;
    this.t += dt;
    if (this.banner) {
      this.banner.t -= dt;
      if (this.banner.t <= 0) this.banner = null;
    }
    if (this.hitstop > 0) {
      this.hitstop -= dt;
      return;
    }
    this.shake = Math.max(0, this.shake - dt * 8);
    this.updateHero(dt, k);
    this.updateWaves(dt);
    for (const e of this.enemies) (e.type === 'boss' ? this.updateBoss : this.updateEnemy).call(this, e, dt);
    this.updateShots(dt);
    // particelle e numeri
    for (const q of this.parts) {
      q.x += q.vx * dt;
      q.y += q.vy * dt;
      q.vy += 300 * dt;
      q.life -= dt;
    }
    this.parts = this.parts.filter((q) => q.life > 0);
    for (const n of this.nums) {
      n.y -= 30 * dt;
      n.life -= dt;
    }
    this.nums = this.nums.filter((n) => n.life > 0);
    // morti
    for (const e of this.enemies) {
      if (e.hp <= 0 && !e.dead) {
        e.dead = true;
        this.xp += e.xp;
        // i dati dell'entità finiscono nella chiavetta (per il murale)
        const key = e.type === 'boss' ? e.kind : e.type;
        this.killsBy[key] = (this.killsBy[key] || 0) + (e.type === 'boss' && e.kind === 'firewall' ? 5 : 1);
        this.kills++;
        this.burst(e.x, e.y - e.h / 2, e.color, e.type === 'boss' ? 60 : 18);
        this.sfx(e.type === 'boss' ? 'bossdown' : 'delete');
        this.nums.push({ x: e.x, y: e.y - e.h - 6, text: `+${e.xp} XP`, color: '#ffe42a', life: 1.2 });
        if (e.type === 'boss') {
          this.endT = 0;
          this.won = true;
          this.shake = 2;
        }
      }
    }
    this.enemies = this.enemies.filter((e) => !e.dead);
    // camera
    let target = this.p.x - 180;
    if (this.lock !== null) target = this.lock;
    this.camX += (Math.max(0, Math.min(this.len - FW, target)) - this.camX) * Math.min(1, dt * 6);
    if (this.p.hp <= 0 && this.endT === undefined) {
      this.endT = 0;
      this.won = false;
      this.sfx('lose');
    }
    if (this.endT !== undefined) {
      this.endT += dt;
      if (this.endT > 1.6) this.done = true;
    }
  }

  updateHero(dt, k) {
    const p = this.p;
    const st = this.st;
    p.t += dt;
    p.inv = Math.max(0, p.inv - dt);
    p.flash = Math.max(0, p.flash - dt);
    p.shotCd -= dt;
    p.dashCd -= dt;
    p.comboT -= dt;
    p.energy = Math.min(100, p.energy + st.regen * dt);
    if (this.endT !== undefined) {
      p.vx *= 0.9;
      p.state = this.won ? 'win' : 'hurt';
      this.integrate(p, dt);
      return;
    }
    const busy = p.state === 'punch' || p.state === 'kick' || p.state === 'hurt' || p.state === 'dash';
    // parata
    if (!busy && k.block && p.ground) {
      p.state = 'block';
      p.vx = 0;
    } else if (p.state === 'block') p.state = 'idle';
    if (!busy && p.state !== 'block') {
      const dir = (k.right ? 1 : 0) - (k.left ? 1 : 0);
      const F = this.form;
      p.vx = dir * 115 * F.speed;
      if (dir) p.facing = dir;
      p.state = !p.ground ? 'jump' : dir ? 'run' : 'idle';
      if (p.ground) p.jumps = 0;
      if (k.jump && (p.ground || (F.doubleJump && p.jumps < 2))) {
        p.vy = -390 * F.jump * (p.ground ? 1 : 0.85);
        p.jumps = (p.jumps || 0) + (p.ground ? 1 : 2);
        p.ground = false;
        this.sfx('jump');
      }
      if (k.punch) this.attack('punch');
      else if (k.kick) this.attack('kick');
      else if (k.dash && st.dash && p.dashCd <= 0) {
        p.state = 'dash';
        p.t = 0;
        p.vx = p.facing * 320;
        p.inv = st.dashTime + 0.05;
        p.dashCd = st.dashCd;
        this.sfx('dash');
        // KERNEL PANIC: lo scatto è un teletrasporto alle spalle del nemico più vicino
        const near = this.form.teleport && this.enemies.filter((e) => e.state !== 'enter' && Math.abs(e.x - p.x) < 260).sort((a, b) => Math.abs(a.x - p.x) - Math.abs(b.x - p.x))[0];
        if (near) {
          this.burst(p.x, p.y - p.h / 2, '#f4f4f4', 10);
          const side = near.facing || 1;
          p.x = near.x - side * (near.w / 2 + 14);
          p.facing = side;
          p.vx = 0;
          this.burst(p.x, p.y - p.h / 2, '#ff3a3a', 10);
          this.sfx('glitch');
        }
      }
    }
    // colpo di energia (anche mentre ti muovi)
    if (k.shoot && p.shotCd <= 0 && p.energy >= st.shotCost && p.state !== 'hurt' && p.state !== 'block') {
      p.shotCd = st.shotCd;
      p.energy -= st.shotCost;
      const y = p.y - Math.min(17, p.h * 0.6);
      const col = { glitch: '#ff3ad8', drone: '#3af0ff', firewall: '#ff8a2a', bug: '#6aff4a', spam: '#ffe42a', kernel: '#ff3a3a' }[this.form.id] || '#7af8ff';
      // il colpo si orienta da solo verso l'entità più vicina davanti a te (anche i droni in volo)
      let aim = 0;
      const ahead = this.enemies.filter((e) => e.state !== 'enter' && Math.sign(e.x - p.x) === p.facing && Math.abs(e.x - p.x) < 320).sort((q, r) => Math.abs(q.x - p.x) - Math.abs(r.x - p.x))[0];
      if (ahead) aim = Math.max(-0.7, Math.min(0.7, Math.atan2(ahead.y - ahead.h / 2 - y, Math.abs(ahead.x - p.x))));
      const angles = this.form.spread ? [-0.2, 0, 0.2] : [0];
      for (const a0 of angles) {
        const a = a0 + aim;
        this.shots.push({ x: p.x + p.facing * (p.w / 2 + 3), y, vx: Math.cos(a) * p.facing * 330, vy: Math.sin(a) * 330, from: 'hero', dmg: st.shot * (this.form.spread ? 0.75 : 1), r: this.form.id === 'drone' ? 4 : 3, life: 1.4, color: col, env: this.form.id === 'spam' });
      }
      if (st.doubleShot) this.shots.push({ x: p.x + p.facing * 4, y: y + 6, vx: p.facing * 310, vy: 0, from: 'hero', dmg: st.shot * 0.7, r: 2, life: 1.4, color: col });
      this.sfx('shot');
    }
    // stato degli attacchi
    if (p.state === 'punch' || p.state === 'kick') {
      const kick = p.state === 'kick';
      const startup = kick ? 0.11 : 0.05;
      const active = kick ? 0.12 : 0.08;
      const total = kick ? 0.38 : 0.22;
      if (p.t >= startup && p.t < startup + active) {
        const air = !p.ground && kick;
        const box = { x: p.x + p.facing * (p.w / 2 + (kick ? 10 : 6)), y: p.y - (air ? 2 : Math.min(10, p.h * 0.3)), w: kick ? 22 : 16, h: 14 };
        for (const e of this.enemies) {
          if (e.hitBy === p.hitId || e.state === 'enter' || e.alpha < 0.5) continue;
          if (overlap(box, e)) {
            e.hitBy = p.hitId;
            const dmg = kick ? st.kick : st.punch * (p.combo === 3 ? 1.6 : 1);
            this.damageEnemy(e, dmg, p.facing * (kick ? 160 : 60), kick ? -120 : 0, p.facing, kick);
          }
        }
      }
      if (p.t >= total) p.state = 'idle';
      if (p.ground) p.vx *= 0.8;
    }
    if (p.state === 'dash') {
      if (p.t > st.dashTime) {
        p.state = 'idle';
        p.vx = 0;
      }
      if (Math.random() < 0.8) this.parts.push({ x: p.x, y: p.y - 14, vx: 0, vy: 0, life: 0.18, color: 'rgba(122,248,255,0.5)', size: 10, ghost: true, facing: p.facing });
    }
    if (p.state === 'hurt' && p.t > 0.3) p.state = 'idle';
    this.integrate(p, dt);
    // non si esce dallo schermo
    const minX = this.camX + 10;
    const maxX = this.camX + FW - 10;
    p.x = Math.max(minX, Math.min(maxX, p.x));
  }

  attack(kind) {
    const p = this.p;
    p.hitId++;
    if (kind === 'punch') {
      p.combo = p.comboT > 0 ? (p.combo % this.st.combo) + 1 : 1;
      p.comboT = 0.4;
    }
    p.state = kind;
    p.t = 0;
    this.sfx(kind === 'kick' ? 'swing2' : 'swing');
  }

  integrate(o, dt) {
    if (!o.fly) {
      // il DRONE plana quando scende
      o.vy += (o.floaty && o.vy > 0 ? G * 0.3 : G) * dt;
      o.y += o.vy * dt;
      if (o.y >= GY) {
        if (!o.ground && o.vy > 200 && o.onLand) o.onLand();
        o.y = GY;
        o.vy = 0;
        o.ground = true;
      } else o.ground = false;
    }
    o.x += o.vx * dt;
  }

  updateWaves(dt) {
    const p = this.p;
    for (const w of this.waves) {
      if (!w.started && p.x >= w.at && !this.lock) {
        w.started = true;
        this.lock = Math.max(0, Math.min(this.len - FW, p.x - 200));
        w.pending = w.list.map((q) => ({ ...q }));
        this.sfx('alert');
      }
      if (w.started && !w.done) {
        for (const q of w.pending) {
          q.delay -= dt;
          if (q.delay <= 0 && !q.spawned) {
            q.spawned = true;
            this.spawn(q.type, q.side);
          }
        }
        if (w.pending.every((q) => q.spawned) && this.enemies.length === 0) {
          w.done = true;
          this.lock = null;
          this.goT = 1.5;
          this.sfx('clear');
        }
      }
    }
    if (this.goT > 0) this.goT -= dt;
    if (!this.bossStarted && this.waves.every((w) => w.done) && p.x > this.len - 320) {
      this.bossStarted = true;
      this.lock = this.len - FW;
      this.spawnBoss();
    }
  }

  damageEnemy(e, dmg, kbx, kby, dir, kick = false, shot = false) {
    // lo scudo del firewall: da davanti assorbe quasi tutto, i calci lo rompono
    const front = Math.sign(e.facing) === -Math.sign(dir) || dir === 0;
    if (e.shield > 0 && front) {
      if (kick) {
        e.shield--;
        this.sfx('shield');
        if (e.shield === 0) {
          this.nums.push({ x: e.x, y: e.y - e.h - 8, text: 'SCUDO ROTTO', color: '#ff8a2a', life: 1 });
          this.burst(e.x, e.y - e.h / 2, '#ff8a2a', 14);
        }
      }
      dmg *= shot ? 0.1 : 0.25;
    }
    e.hp -= dmg;
    e.flash = 0.12;
    if (e.type !== 'boss' || e.state !== 'move') {
      e.vx = kbx;
      if (kby && !e.fly && e.type !== 'boss') {
        e.vy = kby;
        e.ground = false;
      }
    }
    if (e.type !== 'boss') e.state = 'hit';
    e.t = 0;
    this.hitstop = kick ? 0.06 : 0.035;
    this.shake = Math.max(this.shake, kick ? 0.9 : 0.4);
    this.burst(e.x - dir * 4, e.y - e.h / 2, '#ffffff', kick ? 8 : 4);
    this.nums.push({ x: e.x + rnd(-6, 6), y: e.y - e.h - 2, text: Math.round(dmg), color: '#ffffff', life: 0.6 });
    this.sfx(kick ? 'hit2' : 'hit');
  }

  hurtHero(dmg, dir) {
    const p = this.p;
    dmg *= 0.75;
    if (p.inv > 0 || this.endT !== undefined) return;
    // il FIREWALL è corazzato davanti
    if (this.form.armor && Math.sign(dir) === -p.facing) dmg *= 1 - this.form.armor;
    if (p.state === 'block' && Math.sign(dir) === -p.facing) {
      dmg *= 1 - this.st.guard;
      this.sfx('block');
      this.burst(p.x + p.facing * 8, p.y - 16, '#7af8ff', 5);
      p.vx = dir * 60;
    } else {
      p.state = 'hurt';
      p.t = 0;
      p.vx = dir * 140;
      p.vy = -150;
      p.ground = false;
      p.inv = 0.6;
      this.sfx('hurt');
    }
    p.hp -= dmg;
    p.flash = 0.2;
    this.shake = Math.max(this.shake, 1);
    this.nums.push({ x: p.x, y: p.y - 32, text: `-${Math.round(dmg)}`, color: '#ff5a5a', life: 0.7 });
  }

  updateEnemy(e, dt) {
    const p = this.p;
    e.t += dt;
    e.flash = Math.max(0, e.flash - dt);
    e.cd -= dt;
    const dx = p.x - e.x;
    const dir = Math.sign(dx) || 1;
    if (e.state === 'hit') {
      e.vx *= 0.88;
      if (e.t > 0.25) e.state = 'walk';
    } else if (e.type === 'glitch') {
      e.facing = dir;
      if (e.state === 'walk') {
        e.vx = Math.abs(dx) > 18 ? dir * (42 + this.diff * 8) : 0;
        if (Math.abs(dx) < 26 && e.cd <= 0 && Math.abs(p.y - e.y) < 30) {
          e.state = 'windup';
          e.t = 0;
          e.vx = 0;
        }
      } else if (e.state === 'windup' && e.t > 0.38) {
        e.state = 'lunge';
        e.t = 0;
        e.vx = dir * 170;
        e.hitDone = false;
      } else if (e.state === 'lunge') {
        if (!e.hitDone && overlap(e, p)) {
          e.hitDone = true;
          this.hurtHero(6 + this.diff * 2, dir);
        }
        if (e.t > 0.22) {
          e.state = 'walk';
          e.cd = rnd(0.9, 1.5);
        }
      }
    } else if (e.type === 'drone') {
      e.phase += dt;
      e.facing = dir;
      // si tiene a distanza, ma sempre dentro lo schermo
      let want = p.x - dir * 130;
      if (want > this.camX + FW - 24 || want < this.camX + 24) want = p.x + dir * 130;
      want = Math.max(this.camX + 24, Math.min(this.camX + FW - 24, want));
      e.vx += (Math.sign(want - e.x) * 60 - e.vx) * dt * 2;
      e.y = 132 + Math.sin(e.phase * 1.7) * 14;
      if (e.cd <= 0) {
        e.cd = Math.max(1.1, 2.4 - this.diff * 0.25) + rnd(0, 0.6);
        const ax = p.x - e.x;
        const ay = p.y - 16 - e.y;
        const l = Math.hypot(ax, ay) || 1;
        this.shots.push({ x: e.x, y: e.y, vx: (ax / l) * 140, vy: (ay / l) * 140, from: 'enemy', dmg: 5 + this.diff * 1.5, r: 3, life: 3, color: '#ff5ad8' });
        this.sfx('eshot');
      }
    } else if (e.type === 'firewall') {
      e.facing = dir;
      if (e.state === 'walk') {
        e.vx = Math.abs(dx) > 30 ? dir * 26 : 0;
        if (Math.abs(dx) < 36 && e.cd <= 0) {
          e.state = 'windup';
          e.t = 0;
          e.vx = 0;
        }
      } else if (e.state === 'windup' && e.t > 0.6) {
        e.state = 'slam';
        e.t = 0;
        e.hitDone = false;
        this.shake = Math.max(this.shake, 0.6);
      } else if (e.state === 'slam') {
        const box = { x: e.x + e.facing * 22, y: GY, w: 30, h: 30 };
        if (!e.hitDone && overlap(box, p)) {
          e.hitDone = true;
          this.hurtHero(12 + this.diff * 3, dir);
        }
        if (e.t > 0.3) {
          e.state = 'walk';
          e.cd = 1.6;
        }
      }
    }
    if (!e.fly) this.integrate(e, dt);
    else e.x += e.vx * dt;
    // una volta entrate nello schermo, le entità non ne escono più
    const lo = this.camX + 10;
    const hi = this.camX + FW - 10;
    if (e.inside) e.x = Math.max(lo, Math.min(hi, e.x));
    else if (e.x > lo && e.x < hi) e.inside = true;
  }

  updateBoss(b, dt) {
    const p = this.p;
    b.t += dt;
    b.flash = Math.max(0, b.flash - dt);
    const dx = p.x - b.x;
    const dir = Math.sign(dx) || 1;
    const rage = b.hp < b.maxHp * 0.5 ? 0.65 : 1;
    if (b.state === 'enter') {
      b.vx = -80;
      if (b.x < this.camX + FW - 70) {
        b.state = 'idle';
        b.vx = 0;
      }
      b.x += b.vx * dt;
      return;
    }
    if (b.state === 'idle') {
      b.facing = dir;
      b.vx = Math.abs(dx) > 60 ? dir * b.def.speed : 0;
      b.cd -= dt;
      if (b.cd <= 0) {
        b.move = b.def.moves[b.mi++ % b.def.moves.length];
        b.state = 'windup';
        b.t = 0;
        b.vx = 0;
        b.hitDone = false;
      }
    } else if (b.state === 'windup') {
      if (b.t > 0.45 * rage + 0.1) {
        b.state = 'move';
        b.t = 0;
        this.startMove(b, dir);
      }
    } else if (b.state === 'move') {
      this.runMove(b, dt, dir);
    } else if (b.state === 'recover') {
      b.vx *= 0.85;
      if (b.t > 0.5 * rage) {
        b.state = 'idle';
        b.cd = rnd(0.6, 1.2) * rage;
      }
    }
    if (b.state !== 'move' || b.move !== 'teleport') this.integrate(b, dt);
    // contatto durante le mosse d'attacco
    if (b.state === 'move' && ['dash', 'hop', 'slam'].includes(b.move) && !b.hitDone && overlap(b, p)) {
      b.hitDone = true;
      this.hurtHero(10 + this.diff * 3.5, Math.sign(b.vx) || dir);
    }
    b.x = Math.max(this.camX + 20, Math.min(this.camX + FW - 20, b.x));
  }

  startMove(b, dir) {
    const d = this.diff;
    const m = b.move;
    b.facing = dir;
    if (m === 'dash') {
      b.vx = dir * (260 + d * 20);
      this.sfx('dash');
    } else if (m === 'hop' || m === 'slam') {
      b.vy = m === 'slam' ? -420 : -320;
      b.vx = dir * (m === 'slam' ? 120 : 150);
      b.ground = false;
      b.onLand = () => {
        this.shake = Math.max(this.shake, 1.2);
        this.sfx('slam');
        if (m === 'slam' || d >= 2) for (const s of [-1, 1]) this.shots.push({ x: b.x, y: GY - 5, vx: s * 190, vy: 0, from: 'enemy', dmg: 8 + d * 2, r: 5, life: 1.4, color: b.color, ground: true });
        b.onLand = null;
      };
    } else if (m === 'spread') {
      for (const a of d >= 4 ? [-0.35, -0.15, 0, 0.15, 0.35] : [-0.25, 0, 0.25]) {
        this.shots.push({ x: b.x + dir * 12, y: b.y - b.h * 0.6, vx: Math.cos(a) * 180 * dir, vy: Math.sin(a) * 180, from: 'enemy', dmg: 6 + d * 2, r: 4, life: 2.5, color: b.color });
      }
      this.sfx('eshot');
    } else if (m === 'arc') {
      for (let i = 0; i < 3; i++) this.shots.push({ x: b.x, y: b.y - b.h, vx: dir * (90 + i * 55), vy: -260 + i * 30, from: 'enemy', dmg: 7 + d * 2, r: 5, life: 3, color: b.color, grav: true, env: true });
      this.sfx('eshot');
    } else if (m === 'wave') {
      this.shots.push({ x: b.x + dir * 20, y: GY - 6, vx: dir * 210, vy: 0, from: 'enemy', dmg: 10 + d * 2, r: 7, life: 2.5, color: b.color, ground: true });
      this.sfx('slam');
    } else if (m === 'teleport') {
      b.alpha = 0.1;
      this.sfx('glitch');
    } else if (m === 'rain') {
      for (let i = 0; i < 6; i++) this.shots.push({ x: this.p.x + rnd(-110, 110), y: -20 - i * 30, vx: 0, vy: 170, from: 'enemy', dmg: 6 + d * 2, r: 5, life: 3, color: '#ff3a3a', err: true });
      this.sfx('alert');
    }
  }

  runMove(b, dt, dir) {
    const m = b.move;
    const end = () => {
      b.state = 'recover';
      b.t = 0;
    };
    if (m === 'dash') {
      if (b.t > 0.35) end();
    } else if (m === 'hop' || m === 'slam') {
      if (b.ground && b.t > 0.15) end();
    } else if (m === 'teleport') {
      // sparisce e ricompare alle tue spalle, poi colpisce
      if (b.t > 0.35 && b.alpha < 0.5) {
        b.x = this.p.x - this.p.facing * 34;
        b.alpha = 1;
        b.facing = Math.sign(this.p.x - b.x) || 1;
        this.sfx('glitch');
      }
      if (b.t > 0.6 && !b.struck) {
        b.struck = true;
        b.vx = b.facing * 220;
        b.move = 'dash';
        b.t = 0.15;
        b.hitDone = false;
      }
      if (b.t > 1) end();
    } else if (b.t > 0.4) end();
    if (b.state === 'recover') b.struck = false;
    void dir;
  }

  updateShots(dt) {
    const p = this.p;
    for (const s of this.shots) {
      s.life -= dt;
      if (s.grav) s.vy += 500 * dt;
      s.x += s.vx * dt;
      s.y += s.vy * dt;
      if (s.y > GY - 2 && !s.ground) s.life = 0;
      if (s.x < this.camX - 40 || s.x > this.camX + FW + 40) s.life = 0;
      const box = { x: s.x, y: s.y + s.r, w: s.r * 2, h: s.r * 2 };
      if (s.from === 'hero') {
        for (const e of this.enemies) {
          if (s.life > 0 && e.state !== 'enter' && (e.alpha ?? 1) > 0.5 && overlap(box, e)) {
            s.life = 0;
            this.damageEnemy(e, s.dmg, Math.sign(s.vx) * 40, 0, Math.sign(s.vx), false, true);
          }
        }
      } else if (s.life > 0 && overlap(box, p)) {
        s.life = 0;
        this.hurtHero(s.dmg, Math.sign(s.vx) || (p.x > s.x ? 1 : -1));
      }
    }
    this.shots = this.shots.filter((s) => s.life > 0);
  }

  burst(x, y, color, n) {
    for (let i = 0; i < n; i++) this.parts.push({ x, y, vx: rnd(-140, 140), vy: rnd(-200, 40), life: rnd(0.3, 0.7), color, size: Math.random() < 0.3 ? 3 : 2 });
  }

  // ---------------- disegno ----------------
  draw(g, t) {
    const sx = this.shake ? rnd(-this.shake, this.shake) * 2 : 0;
    const sy = this.shake ? rnd(-this.shake, this.shake) * 2 : 0;
    g.save();
    g.translate(Math.round(sx), Math.round(sy));
    this.drawBackground(g, t);
    g.save();
    g.translate(-Math.round(this.camX), 0);
    for (const s of this.shots) this.drawShot(g, s, t);
    for (const e of this.enemies) e.type === 'boss' ? this.drawBoss(g, e, t) : this.drawEnemy(g, e, t);
    this.drawHero(g, t);
    for (const q of this.parts) {
      if (q.ghost) {
        g.fillStyle = q.color;
        g.fillRect(q.x - 6, q.y - 13, 12, 26);
        continue;
      }
      g.fillStyle = q.color;
      g.fillRect(Math.round(q.x), Math.round(q.y), q.size, q.size);
    }
    g.font = 'bold 9px monospace';
    g.textAlign = 'center';
    for (const n of this.nums) {
      g.fillStyle = '#000';
      g.fillText(n.text, n.x + 1, n.y + 1);
      g.fillStyle = n.color;
      g.fillText(n.text, n.x, n.y);
    }
    g.restore();
    g.restore();
    this.drawHud(g, t);
  }

  drawBackground(g, t) {
    const th = this.def.theme;
    const sky = g.createLinearGradient(0, 0, 0, GY);
    sky.addColorStop(0, '#05030f');
    sky.addColorStop(1, th === 'borgo' ? '#1a1240' : th === 'galleria' ? '#0a1a2a' : '#120a2a');
    g.fillStyle = sky;
    g.fillRect(0, 0, FW, FH);
    // pixel che piovono: il mondo è stato digitalizzato
    for (let i = 0; i < 40; i++) {
      const x = (i * 97 - this.camX * 0.1) % FW;
      const y = (i * 53 + t * (20 + (i % 5) * 10)) % GY;
      g.fillStyle = i % 3 ? 'rgba(58,240,255,0.25)' : 'rgba(255,58,216,0.25)';
      g.fillRect((x + FW) % FW, y, 2, 2);
    }
    // la sagoma del luogo vero, in fil di ferro
    const off = -this.camX * 0.25;
    g.strokeStyle = 'rgba(58,240,255,0.35)';
    g.fillStyle = 'rgba(58,240,255,0.06)';
    g.lineWidth = 1;
    for (let rep = -1; rep < 4; rep++) {
      const bx = Math.round(off + rep * 420);
      if (th === 'hotel') {
        g.beginPath();
        g.rect(bx + 40, 120, 260, 112);
        g.moveTo(bx + 20, 120);
        g.lineTo(bx + 170, 60);
        g.lineTo(bx + 320, 120);
        g.fill();
        g.stroke();
        for (let wx = 0; wx < 8; wx++) for (let wy = 0; wy < 3; wy++) {
          g.fillStyle = (wx + wy + rep) % 3 ? 'rgba(255,200,90,0.25)' : 'rgba(58,240,255,0.1)';
          g.fillRect(bx + 60 + wx * 30, 135 + wy * 30, 12, 14);
        }
        g.fillStyle = 'rgba(58,240,255,0.06)';
      } else if (th === 'borgo') {
        for (let h = 0; h < 4; h++) {
          const hx = bx + h * 95;
          const hh = 60 + ((h * 37) % 40);
          g.beginPath();
          g.rect(hx, GY - hh, 70, hh);
          g.moveTo(hx - 6, GY - hh);
          g.lineTo(hx + 35, GY - hh - 30);
          g.lineTo(hx + 76, GY - hh);
          g.fill();
          g.stroke();
        }
        g.strokeRect(bx + 360, 70, 26, 162);
        g.beginPath();
        g.moveTo(bx + 356, 70);
        g.lineTo(bx + 373, 40);
        g.lineTo(bx + 390, 70);
        g.stroke();
      } else if (th === 'parcheggio') {
        g.beginPath();
        g.rect(bx + 10, 130, 380, 102);
        g.fill();
        g.stroke();
        g.strokeRect(bx + 150, 100, 110, 22);
        for (let l = 0; l < 4; l++) g.strokeRect(bx + 30 + l * 100, 150, 2, 82);
      } else {
        for (let c = 0; c < 5; c++) g.strokeRect(bx + c * 90, 40, 8, 192);
        g.strokeRect(bx - 10, 130, 440, 10);
        for (let c = 0; c < 9; c++) g.strokeRect(bx + c * 48, 140, 40, 3);
      }
    }
    // il pavimento a griglia
    g.fillStyle = '#0a0618';
    g.fillRect(0, GY, FW, FH - GY);
    g.strokeStyle = 'rgba(255,58,216,0.45)';
    g.beginPath();
    g.moveTo(0, GY + 0.5);
    g.lineTo(FW, GY + 0.5);
    g.stroke();
    g.strokeStyle = 'rgba(255,58,216,0.18)';
    for (let x = -((this.camX * 1) % 32); x < FW; x += 32) {
      g.beginPath();
      g.moveTo(x, GY);
      g.lineTo(x - 30, FH);
      g.stroke();
    }
    for (const y of [GY + 12, GY + 26]) {
      g.beginPath();
      g.moveTo(0, y);
      g.lineTo(FW, y);
      g.stroke();
    }
  }

  drawHero(g, t) {
    const p = this.p;
    if (p.inv > 0 && p.state !== 'dash' && Math.floor(t * 20) % 2) return;
    if (this.form && this.form.id !== 'scintilla') {
      // sei tu: alone ciano ai piedi e un segno sopra la testa (le entità hanno la tua stessa forma)
      g.fillStyle = 'rgba(122,248,255,0.35)';
      g.beginPath();
      g.ellipse(p.x, p.y + 1, p.w / 2 + 5, 3, 0, 0, Math.PI * 2);
      g.fill();
      const top = p.y - p.h - (this.form.id === 'spam' ? 12 : 6) + Math.round(Math.sin(t * 5));
      g.fillStyle = '#7af8ff';
      g.beginPath();
      g.moveTo(p.x - 4, top - 6);
      g.lineTo(p.x + 4, top - 6);
      g.lineTo(p.x, top);
      g.closePath();
      g.fill();
      drawForm(g, this.form.id, p.x, p.y, p.facing, t, { flash: p.flash > 0, state: p.state });
      // l'attacco: uno sbaffo bianco davanti
      const kick = p.state === 'kick';
      if ((p.state === 'punch' || kick) && p.t > (kick ? 0.1 : 0.04) && p.t < (kick ? 0.26 : 0.15)) {
        g.strokeStyle = kick ? '#ffe42a' : '#ffffff';
        g.lineWidth = 2;
        g.beginPath();
        g.arc(p.x + p.facing * (p.w / 2), p.y - Math.min(12, p.h * 0.4), kick ? 16 : 11, p.facing > 0 ? -1.1 : Math.PI - 0.6, p.facing > 0 ? 0.6 : Math.PI + 1.1);
        g.stroke();
      }
      if (p.state === 'block') {
        g.fillStyle = 'rgba(122,248,255,0.6)';
        g.fillRect(p.x + p.facing * (p.w / 2 + 2) - 1, p.y - p.h - 2, 3, p.h + 2);
      }
      return;
    }
    const f = p.facing;
    const x = Math.round(p.x);
    const y = Math.round(p.y);
    const R = (dx, dy, w, h, c) => {
      g.fillStyle = p.flash > 0 ? '#ffffff' : c;
      g.fillRect(f > 0 ? x + dx : x - dx - w, y + dy, w, h);
    };
    const run = p.state === 'run' ? Math.sin(t * 18) : 0;
    const crouch = p.state === 'block' ? 3 : 0;
    // la sciarpa arancione che svolazza
    R(-9 - Math.round(Math.sin(t * 10) * 2), -26 + crouch, 6, 3, '#ff8a2a');
    R(-13 - Math.round(Math.sin(t * 10 + 1) * 2), -25 + crouch, 4, 2, '#ff8a2a');
    // gambe
    if (p.state === 'kick' && p.t > 0.08) {
      R(-3, -10, 4, 10, '#e8f0f4');
      R(2, -12, 14, 4, '#e8f0f4');
      R(15, -13, 3, 5, '#2a3a5a');
    } else if (!p.ground) {
      R(-4, -10, 4, 7, '#e8f0f4');
      R(1, -9, 4, 6, '#e8f0f4');
    } else {
      R(-4 + Math.round(run * 3), -10, 4, 10, '#e8f0f4');
      R(1 - Math.round(run * 3), -10, 4, 10, '#e8f0f4');
      R(-4 + Math.round(run * 3), -2, 5, 2, '#2a3a5a');
      R(1 - Math.round(run * 3), -2, 5, 2, '#2a3a5a');
    }
    // busto
    R(-5, -21 + crouch, 11, 12 - crouch, '#2ab8c8');
    R(-5, -12, 11, 2, '#1a5a7a');
    // braccia
    if (p.state === 'punch' && p.t > 0.03) R(4, -19, 12 + (p.combo === 3 ? 4 : 0), 4, '#e8f0f4');
    else if (p.state === 'block') {
      R(3, -22, 4, 10, '#e8f0f4');
      R(5, -20, 3, 8, '#7af8ff');
    } else {
      R(4, -19 + Math.round(run * 2), 3, 8, '#e8f0f4');
      R(-7, -19 - Math.round(run * 2), 3, 8, '#e8f0f4');
    }
    // testa con il visore
    R(-4, -28 + crouch, 9, 8, '#e8f0f4');
    R(0, -26 + crouch, 6, 3, '#7af8ff');
    if (p.state === 'win') R(-1, -34, 3, 5, '#ffe42a');
  }

  drawEnemy(g, e, t) {
    const x = Math.round(e.x);
    const y = Math.round(e.y);
    const flash = e.flash > 0;
    const jit = Math.random() < 0.1 ? Math.round(rnd(-2, 2)) : 0;
    const col = flash ? '#ffffff' : e.color;
    if (e.type === 'glitch') {
      const wind = e.state === 'windup' && Math.floor(t * 20) % 2;
      g.fillStyle = wind ? '#ffffff' : col;
      g.fillRect(x - 8 + jit, y - 14, 16, 14);
      g.fillRect(x - 6, y - 18, 4, 4);
      g.fillRect(x + 2, y - 17, 5, 3);
      g.fillStyle = '#05030f';
      g.fillRect(x + e.facing * 3 - 2, y - 11, 3, 3);
      g.fillStyle = 'rgba(58,240,255,0.7)';
      g.fillRect(x - 8 + Math.round(rnd(0, 12)), y - Math.round(rnd(2, 14)), 4, 1);
    } else if (e.type === 'drone') {
      g.fillStyle = col;
      g.beginPath();
      g.moveTo(x, y - 9);
      g.lineTo(x + 9, y);
      g.lineTo(x, y + 9);
      g.lineTo(x - 9, y);
      g.closePath();
      g.fill();
      g.fillStyle = '#05030f';
      g.fillRect(x - 3, y - 2, 6, 4);
      g.fillStyle = '#ff3a3a';
      g.fillRect(x + e.facing * 1 - 1, y - 1, 2, 2);
    } else if (e.type === 'firewall') {
      const wind = e.state === 'windup' && Math.floor(t * 16) % 2;
      g.fillStyle = wind ? '#ffffff' : col;
      g.fillRect(x - 13, y - 40, 26, 40);
      g.fillStyle = '#7a2a0a';
      for (let r = 0; r < 5; r++) for (let c = 0; c < 2; c++) g.fillRect(x - 13 + ((r % 2) * 6) + c * 13, y - 40 + r * 8, 1, 8);
      for (let r = 1; r < 5; r++) g.fillRect(x - 13, y - 40 + r * 8, 26, 1);
      g.fillStyle = '#ffe42a';
      g.fillRect(x + e.facing * 4 - 2, y - 30, 4, 3);
      if (e.shield > 0) {
        g.fillStyle = 'rgba(122,248,255,0.6)';
        g.fillRect(x + e.facing * 15 - 1, y - 42, 3, 44);
      }
    }
    // barra della vita
    if (e.hp < e.maxHp) {
      g.fillStyle = '#2a0a1a';
      g.fillRect(x - 10, y - e.h - 8, 20, 2);
      g.fillStyle = '#ff3ad8';
      g.fillRect(x - 10, y - e.h - 8, Math.round((20 * Math.max(0, e.hp)) / e.maxHp), 2);
    }
  }

  drawBoss(g, b, t) {
    const x = Math.round(b.x);
    const y = Math.round(b.y);
    const wind = b.state === 'windup' && Math.floor(t * 18) % 2;
    const col = b.flash > 0 || wind ? '#ffffff' : b.color;
    g.globalAlpha = b.alpha ?? 1;
    const f = b.facing;
    if (b.kind === 'bug') {
      g.fillStyle = col;
      g.fillRect(x - 13, y - 20, 26, 16);
      g.fillStyle = '#2a8a1a';
      g.fillRect(x - 1, y - 20, 2, 16);
      for (let l = 0; l < 3; l++) {
        const k = Math.sin(t * 20 + l) * 2;
        g.fillStyle = col;
        g.fillRect(x - 15, y - 8 + l * 2 + k, 4, 2);
        g.fillRect(x + 11, y - 8 + l * 2 - k, 4, 2);
      }
      g.fillRect(x + f * 13 - 3, y - 24, 6, 4);
      g.fillStyle = '#ff3a3a';
      g.fillRect(x + f * 14 - 1, y - 23, 2, 2);
    } else if (b.kind === 'spam') {
      g.fillStyle = col;
      g.fillRect(x - 15, y - 32, 30, 22);
      g.fillStyle = '#c8a020';
      g.beginPath();
      g.moveTo(x - 15, y - 32);
      g.lineTo(x, y - 20);
      g.lineTo(x + 15, y - 32);
      g.stroke();
      g.fillStyle = col;
      g.fillRect(x - 8, y - 10, 4, 10);
      g.fillRect(x + 4, y - 10, 4, 10);
      g.fillStyle = '#ff3a3a';
      g.font = 'bold 8px monospace';
      g.textAlign = 'center';
      g.fillText('!!!', x, y - 34);
    } else if (b.kind === 'firewall') {
      g.fillStyle = col;
      g.fillRect(x - 20, y - 52, 40, 52);
      g.fillStyle = '#6a1a0a';
      for (let r = 1; r < 7; r++) g.fillRect(x - 20, y - 52 + r * 8, 40, 1);
      for (let r = 0; r < 7; r++) for (let c = 0; c < 3; c++) g.fillRect(x - 20 + (r % 2) * 7 + c * 14, y - 52 + r * 8, 1, 8);
      g.fillStyle = '#ffe42a';
      g.fillRect(x + f * 6 - 3, y - 42, 6, 4);
      g.fillRect(x + f * 6 - 3 - f * 12, y - 42, 6, 4);
      if (b.shield > 0) {
        g.fillStyle = 'rgba(122,248,255,0.6)';
        g.fillRect(x + f * 22 - 1, y - 56, 3, 58);
      }
    } else {
      // KERNEL PANIC: una figura bianca che si sfalda in errori
      g.fillStyle = col;
      g.fillRect(x - 6, y - 42, 12, 12);
      g.fillRect(x - 8, y - 30, 16, 18);
      g.fillRect(x - 7, y - 12, 5, 12);
      g.fillRect(x + 2, y - 12, 5, 12);
      g.fillStyle = '#05030f';
      g.fillRect(x + f * 2 - 3, y - 38, 6, 2);
      for (let i = 0; i < 4; i++) {
        g.fillStyle = i % 2 ? '#ff3a3a' : '#3af0ff';
        g.fillRect(x - 10 + Math.round(rnd(0, 20)), y - Math.round(rnd(0, 42)), Math.round(rnd(3, 10)), 2);
      }
      g.fillStyle = '#ff3a3a';
      g.font = 'bold 7px monospace';
      g.textAlign = 'center';
      g.fillText('PANIC', x, y - 46);
    }
    g.globalAlpha = 1;
  }

  drawShot(g, s, t) {
    g.fillStyle = s.color;
    if (s.env) {
      g.fillRect(Math.round(s.x) - 5, Math.round(s.y) - 4, 10, 8);
      g.fillStyle = '#c8a020';
      g.fillRect(Math.round(s.x) - 5, Math.round(s.y) - 4, 10, 1);
    } else if (s.err) {
      g.fillRect(Math.round(s.x) - 6, Math.round(s.y) - 4, 12, 8);
      g.fillStyle = '#fff';
      g.fillRect(Math.round(s.x) - 1, Math.round(s.y) - 3, 2, 4);
    } else if (s.ground) {
      g.fillRect(Math.round(s.x) - s.r, GY - 10 - Math.round(Math.abs(Math.sin(t * 30)) * 4), s.r * 2, 10);
    } else {
      g.fillRect(Math.round(s.x) - s.r, Math.round(s.y) - s.r, s.r * 2, s.r * 2);
      if (s.from === 'hero') {
        g.fillStyle = 'rgba(122,248,255,0.35)';
        g.fillRect(Math.round(s.x - Math.sign(s.vx) * 10) - 4, Math.round(s.y) - 1, 8, 2);
      }
    }
  }

  drawHud(g, t) {
    const p = this.p;
    g.font = 'bold 9px monospace';
    g.textAlign = 'left';
    g.fillStyle = '#7af8ff';
    g.fillText(`${this.form.name}  LV ${this.level}`, 10, 14);
    g.fillStyle = '#1a2a3a';
    g.fillRect(10, 18, 110, 6);
    g.fillStyle = p.hp / p.maxHp > 0.3 ? '#4aff8a' : '#ff5a5a';
    g.fillRect(10, 18, Math.round((110 * Math.max(0, p.hp)) / p.maxHp), 6);
    g.fillStyle = '#1a2a3a';
    g.fillRect(10, 26, 80, 3);
    g.fillStyle = '#3af0ff';
    g.fillRect(10, 26, Math.round(0.8 * p.energy), 3);
    g.textAlign = 'right';
    g.fillStyle = '#ffe42a';
    g.fillText(`XP ${this.xp}`, FW - 10, 14);
    if (this.boss && !this.boss.dead) {
      const b = this.boss;
      g.textAlign = 'center';
      g.fillStyle = b.color;
      g.fillText(b.def.name, FW / 2, 248);
      g.fillStyle = '#2a0a1a';
      g.fillRect(FW / 2 - 100, 252, 200, 5);
      g.fillStyle = b.color;
      g.fillRect(FW / 2 - 100, 252, Math.round((200 * Math.max(0, b.hp)) / b.maxHp), 5);
    }
    if (this.goT > 0 && Math.floor(t * 4) % 2) {
      g.textAlign = 'right';
      g.fillStyle = '#ffe42a';
      g.font = 'bold 14px monospace';
      g.fillText('AVANTI ▶', FW - 14, 120);
    }
    if (this.banner) {
      g.fillStyle = 'rgba(5,3,15,0.7)';
      g.fillRect(0, 96, FW, 52);
      g.textAlign = 'center';
      g.fillStyle = '#ff3ad8';
      g.font = 'bold 20px monospace';
      g.fillText(this.banner.text, FW / 2, 124);
      g.fillStyle = '#7af8ff';
      g.font = 'bold 9px monospace';
      g.fillText(this.banner.sub.toUpperCase(), FW / 2, 140);
    }
  }
}

// Disegna una forma (Scintilla o un'entità) con i piedi in (x, y): per il
// personaggio in combattimento, per il murale e per lo schermo del terminale.
export function drawForm(g, id, x, y, facing, t, { flash = false, state = 'idle' } = {}) {
  const proto = Fight.prototype;
  if (id === 'scintilla') {
    proto.drawHero.call({ form: null, p: { x, y, facing, state, inv: 0, flash: flash ? 1 : 0, t: 0.2, combo: 1, ground: true } }, g, t);
  } else if (ENEMY[id]) {
    const e = ENEMY[id];
    proto.drawEnemy.call({}, g, { type: id, x, y: id === 'drone' ? y - 9 : y, facing, flash: flash ? 1 : 0, state: state === 'punch' || state === 'kick' ? 'windup' : 'walk', hp: 1, maxHp: 1, h: e.h, color: e.color, shield: id === 'firewall' ? 1 : 0 }, t);
  } else {
    const b = BOSS[id];
    proto.drawBoss.call({}, g, { kind: id, x, y, facing, flash: flash ? 1 : 0, state: 'idle', color: b.color, def: b, alpha: 1, shield: b.shield ? 1 : 0 }, t);
  }
}

// La stessa forma, ma come sagoma scura: un'entità di cui non hai ancora abbastanza dati.
let off = null;
export function drawSilhouette(g, id, x, y, facing, t) {
  if (!off) {
    off = document.createElement('canvas');
    off.width = 100;
    off.height = 100;
  }
  const o = off.getContext('2d');
  o.setTransform(1, 0, 0, 1, 0, 0);
  o.globalCompositeOperation = 'source-over';
  o.clearRect(0, 0, 100, 100);
  drawForm(o, id, 50, 88, facing, t);
  o.globalCompositeOperation = 'source-atop';
  o.fillStyle = '#1a1428';
  o.fillRect(0, 0, 100, 100);
  g.drawImage(off, x - 50, y - 88);
}
