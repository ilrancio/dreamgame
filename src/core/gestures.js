// I gesti: piccoli minigiochi per le cose di tutti i giorni (la moka, la
// doccia, il tè, la campana del borgo...). Sono gentili: non si perde mai,
// si può sempre saltare con Esc, e alla fine c'è solo un giudizio affettuoso.
// Disegnati su un canvas 640×400, in una scheda di carta sopra la scena 3D.

const W = 640;
const H = 400;
const INK = '#3a2a1a';
const PAPER = '#f6efe2';

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

function txt(g, s, x, y, { size = 15, color = INK, align = 'left', weight = 600, serif = false } = {}) {
  g.font = `${weight} ${size}px ${serif ? '"Cormorant Garamond", serif' : 'Inter, sans-serif'}`;
  g.textAlign = align;
  g.fillStyle = color;
  g.fillText(s, x, y);
}

// testo che va a capo entro una larghezza
function wrap(g, s, x, y, w, opts = {}) {
  const size = opts.size || 15;
  g.font = `${opts.weight || 600} ${size}px ${opts.serif ? '"Cormorant Garamond", serif' : 'Inter, sans-serif'}`;
  let line = '';
  let yy = y;
  for (const word of s.split(' ')) {
    const test = line ? `${line} ${word}` : word;
    if (g.measureText(test).width > w && line) {
      txt(g, line, x, yy, opts);
      line = word;
      yy += size * 1.25;
    } else line = test;
  }
  if (line) txt(g, line, x, yy, opts);
}

function rr(g, x, y, w, h, r) {
  g.beginPath();
  g.roundRect(x, y, w, h, r);
}

function poly(g, pts) {
  g.beginPath();
  pts.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y)));
  g.closePath();
}

// barra di avanzamento con etichetta
function bar(g, x, y, w, v, color, label) {
  rr(g, x, y, w, 10, 5);
  g.fillStyle = 'rgba(58,42,26,0.12)';
  g.fill();
  rr(g, x, y, Math.max(10, w * clamp(v, 0, 1)), 10, 5);
  g.fillStyle = color;
  g.fill();
  if (label) txt(g, label, x, y - 6, { size: 12, color: 'rgba(58,42,26,0.7)' });
}

function button(g, b, label, hot) {
  rr(g, b.x, b.y, b.w, b.h, 18);
  g.fillStyle = hot ? '#e8b860' : '#f0dcb0';
  g.fill();
  g.strokeStyle = 'rgba(58,42,26,0.35)';
  g.lineWidth = 1.5;
  g.stroke();
  txt(g, label, b.x + b.w / 2, b.y + b.h / 2 + 5, { size: 14, align: 'center' });
}

const inBox = (io, b) => io.mx >= b.x && io.mx <= b.x + b.w && io.my >= b.y && io.my <= b.y + b.h;

export function gradeOf(score) {
  if (score >= 0.85) return { grade: 3, label: 'Perfetto' };
  if (score >= 0.6) return { grade: 2, label: 'Buono' };
  if (score >= 0.35) return { grade: 1, label: 'Così così' };
  return { grade: 0, label: 'Un disastro (ma va bene lo stesso)' };
}

// ======================= LA MOKA =======================
// Acqua fino alla valvola, caffè a montagnetta senza pressare,
// fuoco basso, e via dal fornello appena comincia a gorgogliare.
class Moka {
  constructor(api) {
    this.api = api;
    this.title = 'La moka';
    this.stage = 'acqua';
    this.w = 0;
    this.poured = false;
    this.fill = 0;
    this.spoonT = 1;
    this.c = 0;
    this.flame = 0.6;
    this.flameAcc = 0;
    this.heatT = 0;
    this.stageT = 0;
    this.scores = [];
    this.notes = [];
    this.msg = '';
    this.doneBtn = { x: 440, y: 300, w: 150, h: 38 };
    this.offBtn = { x: 440, y: 320, w: 170, h: 40 };
  }

  get help() {
    return {
      acqua: 'Tieni premuto (clic o Spazio) per versare l\'acqua. Fermati alla valvola.',
      caffe: 'Clic o Spazio: un cucchiaino. A montagnetta, senza pressare. Poi "Basta così".',
      fuoco: 'W/S o trascina la manopola: la fiamma. Clic o Spazio per togliere dal fuoco.',
      fine: '',
    }[this.stage];
  }

  update(dt, io) {
    this.stageT += dt;
    if (this.stage === 'acqua') {
      if (io.act && !this.poured) {
        this.w = Math.min(1.08, this.w + dt * 0.32);
        this.pouring = true;
        if (Math.random() < dt * 8) this.api.sfx('drip');
      } else if (this.pouring) {
        this.pouring = false;
        this.poured = true;
        this.stageT = 0;
        const d = this.w - 0.78;
        let s;
        if (d > 0.07) {
          s = 0.2;
          this.msg = 'Sopra la valvola! Verrà acquoso.';
        } else if (Math.abs(d) < 0.035) {
          s = 1;
          this.msg = 'Giusto sotto la valvola. Brava mano.';
        } else if (Math.abs(d) < 0.1) {
          s = 0.65;
          this.msg = d > 0 ? 'Un filo troppa.' : 'Un filo poca.';
        } else {
          s = 0.35;
          this.msg = 'Poca acqua: verrà un caffè ristretto.';
        }
        this.scores.push(s);
      }
      if (this.poured && this.stageT > 1.6) this.next('caffe');
    } else if (this.stage === 'caffe') {
      this.spoonT += dt;
      const finish = (io.clicked && inBox(io, this.doneBtn)) || io.enter;
      if (!finish && io.actPressed && this.fill < 1.7) {
        this.fill += 0.27 + Math.random() * 0.05;
        this.spoonT = 0;
        this.api.sfx('spoon');
      }
      if (finish || this.fill >= 1.7) {
        const f = this.fill;
        let s;
        if (f >= 1.7) {
          s = 0.15;
          this.msg = 'Il caffè trabocca dal filtro...';
        } else if (f >= 0.95 && f <= 1.3) {
          s = 1;
          this.msg = 'Una montagnetta perfetta.';
        } else if (f >= 0.75 && f <= 1.5) {
          s = 0.65;
          this.msg = f < 1 ? 'Un po\' scarso.' : 'Un po\' abbondante.';
        } else {
          s = 0.3;
          this.msg = f < 0.75 ? 'Così viene acqua sporca.' : 'Troppo carico.';
        }
        this.scores.push(s);
        this.next('fuoco');
      }
    } else if (this.stage === 'fuoco') {
      if (io.up) this.flame = Math.min(1, this.flame + dt * 0.8);
      if (io.down2) this.flame = Math.max(0.15, this.flame - dt * 0.8);
      const knob = { x: 470, y: 120, w: 130, h: 170 };
      if (io.down && inBox(io, knob)) this.flame = clamp(1 - (io.my - 130) / 150, 0.15, 1);
      this.c += dt * (0.025 + this.flame * 0.11);
      this.flameAcc += this.flame * dt;
      this.heatT += dt;
      if (this.c > 0.92 && Math.random() < dt * (6 + this.flame * 10)) this.api.sfx('bubble');
      const remove = io.actPressed && !(io.down && inBox(io, knob)) && this.c > 0.2;
      if (remove || this.c > 1.65) {
        const avg = this.flameAcc / Math.max(0.1, this.heatT);
        let s;
        if (this.c > 1.65) {
          s = 0.1;
          this.msg = 'Bruciato. L\'odore si sente fino alla hall.';
        } else if (this.c < 0.92) {
          s = 0.25 + this.c * 0.2;
          this.msg = 'Troppo presto: mezza tazzina.';
        } else if (this.c <= 1.22) {
          s = 1;
          this.msg = 'Appena gorgoglia, via dal fuoco. Così.';
        } else {
          s = 0.5;
          this.msg = 'Un po\' bruciacchiato.';
        }
        if (avg < 0.45 && s > 0.3) {
          s = Math.min(1, s + 0.1);
          this.notes.push('a fuoco basso, come si deve');
        }
        this.scores.push(s);
        this.api.sfx('ding');
        this.next('fine');
      }
    } else if (this.stage === 'fine' && this.stageT > 1.4) this.done = true;
  }

  next(stage) {
    this.stage = stage;
    this.stageT = 0;
  }

  get score() {
    return this.scores.reduce((a, b) => a + b, 0) / Math.max(1, this.scores.length);
  }

  resultNote() {
    const n = this.notes.length ? ` (${this.notes.join(', ')})` : '';
    return gradeOf(this.score).grade >= 2 ? `Profumo in tutta la suite${n}.` : `Si beve lo stesso${n}.`;
  }

  draw(g, t) {
    const cx = 230;
    // il fornello
    rr(g, cx - 110, 345, 220, 14, 4);
    g.fillStyle = '#2a2a2e';
    g.fill();
    if (this.stage === 'fuoco' || this.stage === 'fine') {
      const on = this.stage === 'fuoco';
      for (let k = -3; k <= 3; k++) {
        const fh = on ? (10 + this.flame * 26) * (0.85 + Math.sin(t * 20 + k * 2) * 0.15) : 0;
        if (!fh) continue;
        g.fillStyle = `rgba(80,140,255,${0.5 + this.flame * 0.4})`;
        poly(g, [[cx + k * 14 - 6, 345], [cx + k * 14, 345 - fh], [cx + k * 14 + 6, 345]]);
        g.fill();
      }
    }
    // caldaia (sezione: si vede l'acqua dentro)
    const base = 335;
    const top = 255;
    poly(g, [[cx - 62, base], [cx + 62, base], [cx + 54, top], [cx - 54, top]]);
    g.fillStyle = '#c4c8d0';
    g.fill();
    g.save();
    poly(g, [[cx - 56, base - 4], [cx + 56, base - 4], [cx + 49, top + 3], [cx - 49, top + 3]]);
    g.clip();
    const wl = base - 4 - this.w * (base - top - 7);
    g.fillStyle = '#7ab8e0';
    g.fillRect(cx - 70, wl, 140, base - wl);
    if (this.stage === 'fuoco' || this.stage === 'fine') {
      g.fillStyle = 'rgba(255,255,255,0.5)';
      for (let i = 0; i < 6; i++) g.fillRect(cx - 40 + ((i * 17 + t * 30) % 80), wl + 6 + ((i * 13 + t * 50) % 30), 3, 3);
    }
    g.restore();
    // la valvola
    const vy = base - 4 - 0.78 * (base - top - 7);
    g.beginPath();
    g.arc(cx + 60, vy, 7, 0, Math.PI * 2);
    g.fillStyle = '#d8b040';
    g.fill();
    if (this.stage === 'acqua') {
      g.setLineDash([5, 4]);
      g.strokeStyle = 'rgba(200,60,40,0.7)';
      g.beginPath();
      g.moveTo(cx - 52, vy);
      g.lineTo(cx + 52, vy);
      g.stroke();
      g.setLineDash([]);
      txt(g, 'valvola', cx + 72, vy + 5, { size: 12, color: '#a04030' });
    }
    // il filtro con il caffè
    const fTop = 228;
    poly(g, [[cx - 50, top], [cx + 50, top], [cx + 44, fTop], [cx - 44, fTop]]);
    g.fillStyle = '#b0b4bc';
    g.fill();
    const fh = Math.min(1, this.fill) * (top - fTop - 4);
    g.fillStyle = '#4a2a14';
    g.fillRect(cx - 44, top - 2 - fh, 88, fh);
    if (this.fill > 1) {
      g.beginPath();
      g.ellipse(cx, top - 2 - fh, 44, Math.min(22, (this.fill - 1) * 40), 0, Math.PI, 0);
      g.fill();
    }
    // il raccoglitore (sopra), con la colonnina
    const rTop = 140;
    const showTop = this.stage === 'fuoco' || this.stage === 'fine';
    if (showTop) {
      poly(g, [[cx - 54, fTop], [cx + 54, fTop], [cx + 46, rTop], [cx - 46, rTop]]);
      g.fillStyle = '#c4c8d0';
      g.fill();
      g.save();
      poly(g, [[cx - 48, fTop - 3], [cx + 48, fTop - 3], [cx + 41, rTop + 4], [cx - 41, rTop + 4]]);
      g.clip();
      const cl = fTop - 3 - Math.min(1, this.c) * (fTop - rTop - 30);
      g.fillStyle = this.c > 1.4 ? '#1a0a04' : '#5a3218';
      g.fillRect(cx - 60, cl, 120, fTop - cl);
      g.restore();
      g.fillStyle = '#9a9ea6';
      g.fillRect(cx - 5, rTop + 22, 10, fTop - rTop - 22);
      if (this.c > 0.15 && this.c < 1.65) {
        // il caffè che esce dalla colonnina
        const fl = 0.5 + Math.sin(t * 18) * 0.5;
        g.fillStyle = this.c > 0.92 ? `rgba(120,70,30,${0.6 + fl * 0.4})` : '#6a3a18';
        g.beginPath();
        g.arc(cx, rTop + 22, this.c > 0.92 ? 7 + fl * 5 : 4, 0, Math.PI * 2);
        g.fill();
      }
      // coperchio e manico
      g.fillStyle = '#b0b4bc';
      poly(g, [[cx - 48, rTop], [cx + 48, rTop], [cx + 30, rTop - 16], [cx - 30, rTop - 16]]);
      g.fill();
      g.fillStyle = '#1e1e22';
      rr(g, cx + 50, rTop + 18, 30, 60, 10);
      g.fill();
      if (this.c > 0.92 && this.stage === 'fuoco') {
        txt(g, 'blub... blub...', cx - 100, rTop - 26, { size: 18, serif: true, color: '#6a3a18', weight: 700 });
      }
      // vapore
      if (this.stage === 'fine' || this.c > 0.6) {
        g.strokeStyle = 'rgba(160,150,140,0.5)';
        g.lineWidth = 3;
        for (let k = 0; k < 3; k++) {
          g.beginPath();
          for (let y = 0; y < 40; y += 4) g.lineTo(cx - 14 + k * 14 + Math.sin(t * 3 + y * 0.2 + k) * 5, rTop - 20 - y - ((t * 20) % 8));
          g.stroke();
        }
      }
    }
    if (this.stage === 'acqua') {
      // la brocca che versa
      g.save();
      g.translate(cx - 120, 150);
      g.rotate(this.pouring ? -0.7 : -0.15);
      rr(g, -26, -40, 52, 70, 8);
      g.fillStyle = 'rgba(180,220,240,0.6)';
      g.fill();
      g.strokeStyle = 'rgba(58,42,26,0.4)';
      g.stroke();
      g.restore();
      if (this.pouring) {
        g.strokeStyle = '#7ab8e0';
        g.lineWidth = 6;
        g.beginPath();
        g.moveTo(cx - 92, 128);
        g.quadraticCurveTo(cx - 20, 120, cx, Math.max(wl, top));
        g.stroke();
      }
    }
    if (this.stage === 'caffe') {
      // il cucchiaino che scende
      const sy = 170 + Math.max(0, 1 - this.spoonT * 4) * 40;
      g.fillStyle = '#a0a4ac';
      rr(g, cx + 10, sy - 70, 6, 70, 3);
      g.fill();
      g.beginPath();
      g.ellipse(cx + 13, sy, 16, 9, 0, 0, Math.PI * 2);
      g.fill();
      bar(g, 440, 150, 160, this.fill / 1.6, '#6a3a18', 'Caffè nel filtro');
      g.fillStyle = 'rgba(40,140,60,0.35)';
      g.fillRect(440 + 160 * (0.95 / 1.6), 150, 160 * (0.35 / 1.6), 10);
      button(g, this.doneBtn, 'Basta così', false);
    }
    if (this.stage === 'fuoco') {
      // la manopola del gas
      txt(g, 'Fiamma', 470, 120, { size: 13, color: 'rgba(58,42,26,0.7)' });
      rr(g, 520, 130, 30, 150, 15);
      g.fillStyle = 'rgba(58,42,26,0.12)';
      g.fill();
      const ky = 130 + (1 - this.flame) * 150;
      g.beginPath();
      g.arc(535, ky, 18, 0, Math.PI * 2);
      g.fillStyle = '#3a3a40';
      g.fill();
      txt(g, 'alta', 560, 140, { size: 11, color: 'rgba(58,42,26,0.6)' });
      txt(g, 'bassa', 560, 280, { size: 11, color: 'rgba(58,42,26,0.6)' });
      button(g, this.offBtn, 'Togli dal fuoco', this.c > 0.92);
    }
    if (this.msg) wrap(g, this.msg, 440, 80, 180, { size: 16, serif: true, weight: 700, color: '#6a3a18' });
  }
}

// ======================= LA DOCCIA =======================
// Le tubature dell'hotel sono capricciose: tieni l'acqua alla temperatura
// giusta. Poi insaponati per bene, e risciacquo.
class Doccia {
  constructor(api) {
    this.api = api;
    this.title = 'La doccia';
    this.stage = 'temp';
    this.T = 22;
    this.mix = 0.3;
    this.drift = 0;
    this.comfort = 0;
    this.tT = 0;
    this.jolt = 4 + Math.random() * 2;
    this.msg = '';
    this.msgT = 0;
    this.scores = [];
    // la sagoma da insaponare: una griglia di celle dentro la figura
    this.cells = [];
    const inside = (x, y) => {
      const e = (px, py, rx, ry) => ((x - px) / rx) ** 2 + ((y - py) / ry) ** 2 <= 1;
      return e(320, 115, 26, 30) || (x > 285 && x < 355 && y > 145 && y < 250) || (x > 255 && x < 285 && y > 150 && y < 245) || (x > 355 && x < 385 && y > 150 && y < 245) || (x > 290 && x < 318 && y > 250 && y < 350) || (x > 322 && x < 350 && y > 250 && y < 350);
    };
    for (let y = 85; y < 350; y += 11) for (let x = 250; x < 390; x += 11) if (inside(x + 5, y + 5)) this.cells.push({ x: x + 5, y: y + 5, foam: false, r: 5 + Math.random() * 5 });
    this.inside = inside;
    this.rinse = 0;
  }

  get help() {
    return {
      temp: 'Muovi il mouse (o A/D) sul miscelatore: tieni l\'acqua tra 36 e 40 gradi.',
      sapone: 'Tieni premuto e strofina la spugna su tutto il corpo (o WASD + Spazio).',
      risciacquo: '',
    }[this.stage];
  }

  update(dt, io) {
    this.msgT -= dt;
    if (this.stage === 'temp') {
      this.tT += dt;
      if (io.hover) this.mix = clamp((io.mx - 120) / 400, 0, 1);
      if (io.left) this.mix = clamp(this.mix - dt * 0.4, 0, 1);
      if (io.right) this.mix = clamp(this.mix + dt * 0.4, 0, 1);
      this.drift += (Math.random() - 0.5) * dt * 10;
      this.drift = clamp(this.drift, -6, 6);
      this.jolt -= dt;
      if (this.jolt <= 0) {
        this.jolt = 4 + Math.random() * 3;
        this.drift += Math.random() < 0.5 ? -9 : 9;
        this.msg = Math.random() < 0.5 ? 'Qualcuno, da qualche parte nell\'hotel, ha tirato lo sciacquone.' : 'Le tubature borbottano. L\'hotel è grande.';
        this.msgT = 2.5;
        this.api.sfx('pipe');
      }
      const target = 14 + this.mix * 38 + this.drift;
      this.T += (target - this.T) * dt * 1.6;
      if (this.T >= 36 && this.T <= 40.5) this.comfort += dt;
      else if (this.msgT <= 0 && Math.random() < dt * 0.6) {
        this.msg = this.T > 40.5 ? 'Scotta!' : 'Brrr!';
        this.msgT = 1;
      }
      if (this.comfort >= 6) {
        this.scores.push(clamp((6 / this.tT) * 1.35, 0, 1));
        this.stage = 'sapone';
        this.msg = '';
        this.api.sfx('ding');
      }
    } else if (this.stage === 'sapone') {
      if (!io.hover || io.keyMove) {
        this.sx = clamp((this.sx ?? 320) + ((io.right ? 1 : 0) - (io.left ? 1 : 0)) * dt * 220, 240, 400);
        this.sy = clamp((this.sy ?? 200) + ((io.down2 ? 1 : 0) - (io.up ? 1 : 0)) * dt * 220, 80, 360);
      } else {
        this.sx = io.mx;
        this.sy = io.my;
      }
      if (io.act) {
        let n = 0;
        for (const c of this.cells) {
          if (!c.foam && Math.hypot(c.x - this.sx, c.y - this.sy) < 24) {
            c.foam = true;
            n++;
          }
        }
        if (n && Math.random() < 0.4) this.api.sfx('foam');
      }
      const cov = this.coverage;
      if (cov >= 0.92 || io.enter) {
        this.scores.push(clamp(cov / 0.92, 0, 1));
        this.stage = 'risciacquo';
        this.api.sfx('water');
      }
    } else if (this.stage === 'risciacquo') {
      this.rinse += dt / 1.8;
      if (this.rinse >= 1) this.done = true;
    }
  }

  get coverage() {
    return this.cells.filter((c) => c.foam).length / this.cells.length;
  }

  get score() {
    return this.scores.reduce((a, b) => a + b, 0) / Math.max(1, this.scores.length);
  }

  resultNote() {
    return gradeOf(this.score).grade >= 2 ? 'Pulito, caldo, leggero. Come nuovo.' : 'Qualche brivido, ma ne è valsa la pena.';
  }

  draw(g, t) {
    // il soffione e le gocce, colorate dalla temperatura
    const hot = clamp((this.T - 15) / 35, 0, 1);
    const col = `rgb(${Math.round(90 + hot * 160)},${Math.round(160 - hot * 60)},${Math.round(240 - hot * 170)})`;
    g.fillStyle = '#9aa0a8';
    rr(g, 290, 40, 60, 12, 6);
    g.fill();
    if (this.stage !== 'risciacquo' || this.rinse < 1) {
      g.fillStyle = col;
      for (let i = 0; i < 40; i++) {
        const x = 296 + ((i * 37) % 50) + Math.sin(i) * 20;
        const y = 56 + ((t * 300 + i * 53) % 300);
        g.fillRect(x, y, 2, 7);
      }
    }
    if (this.stage === 'temp') {
      // il termometro
      txt(g, `${Math.round(this.T)}°`, 520, 120, { size: 40, weight: 800, color: this.T > 40.5 ? '#c84a2a' : this.T < 36 ? '#3a6ac8' : '#3a8a4a' });
      bar(g, 470, 160, 140, this.comfort / 6, '#3a8a4a', 'Al calduccio');
      // il miscelatore
      rr(g, 120, 360, 400, 12, 6);
      const grad = g.createLinearGradient(120, 0, 520, 0);
      grad.addColorStop(0, '#5a8ae8');
      grad.addColorStop(1, '#e85a3a');
      g.fillStyle = grad;
      g.fill();
      const zx0 = 120 + ((36 - 14 - this.drift) / 38) * 400;
      const zx1 = 120 + ((40.5 - 14 - this.drift) / 38) * 400;
      g.strokeStyle = 'rgba(58,138,74,0.8)';
      g.lineWidth = 3;
      g.strokeRect(zx0, 356, Math.max(4, zx1 - zx0), 20);
      g.beginPath();
      g.arc(120 + this.mix * 400, 366, 13, 0, Math.PI * 2);
      g.fillStyle = '#f4f4f4';
      g.fill();
      g.strokeStyle = INK;
      g.lineWidth = 2;
      g.stroke();
      // vapore se scotta
      if (this.T > 40) {
        g.fillStyle = `rgba(255,255,255,${clamp((this.T - 40) / 10, 0, 0.6)})`;
        g.fillRect(0, 0, W, H);
      }
    }
    // la sagoma: testa, busto, braccia, gambe
    g.fillStyle = '#e0b089';
    g.beginPath();
    g.ellipse(320, 115, 26, 30, 0, 0, Math.PI * 2);
    g.fill();
    rr(g, 285, 145, 70, 108, 18);
    g.fill();
    for (const x of [255, 357]) {
      rr(g, x, 150, 28, 96, 13);
      g.fill();
    }
    for (const x of [290, 322]) {
      rr(g, x, 245, 28, 106, 12);
      g.fill();
    }
    g.fillStyle = '#3b2a1e';
    g.beginPath();
    g.ellipse(320, 100, 27, 18, 0, Math.PI, 0);
    g.fill();
    if (this.stage !== 'temp') {
      for (const c of this.cells) {
        if (!c.foam) continue;
        const fall = this.stage === 'risciacquo' ? clamp(this.rinse * 1.6 - (c.y - 80) / 400, 0, 1) : 0;
        if (fall >= 1) continue;
        g.globalAlpha = 1 - fall;
        g.beginPath();
        g.arc(c.x, c.y + fall * 60, c.r, 0, Math.PI * 2);
        g.fillStyle = '#ffffff';
        g.fill();
        g.globalAlpha = 1;
      }
      if (this.stage === 'sapone') {
        // la spugna
        rr(g, (this.sx ?? 320) - 16, (this.sy ?? 200) - 11, 32, 22, 7);
        g.fillStyle = '#f0d040';
        g.fill();
        bar(g, 470, 160, 140, this.coverage / 0.92, '#7ab8e0', 'Insaponato');
        txt(g, 'Invio: basta così', 470, 200, { size: 12, color: 'rgba(58,42,26,0.6)' });
      }
    }
    if (this.msg && this.msgT > 0) txt(g, this.msg, 320, 390, { size: 16, align: 'center', serif: true, weight: 700, color: '#6a3a18' });
  }
}

// ======================= IL TÈ =======================
// Il colore giusto (ambra), poi due tazze riempite fino alla riga.
class Te {
  constructor(api) {
    this.api = api;
    this.title = 'Il tè';
    this.stage = 'infusione';
    this.t = 0;
    this.c = 0;
    this.cups = [0, 0];
    this.cup = 0;
    this.scores = [];
    this.msg = '';
    this.stageT = 0;
  }

  get help() {
    return {
      infusione: 'Aspetta che diventi color ambra, poi clic o Spazio per togliere la bustina.',
      versare: 'Tieni premuto per versare. Fermati alla riga, una tazza alla volta.',
      fine: '',
    }[this.stage];
  }

  update(dt, io) {
    this.stageT += dt;
    if (this.stage === 'infusione') {
      this.t += dt;
      this.c = 1 - Math.exp(-this.t / 4.5);
      if ((io.actPressed && this.t > 0.6) || this.c > 0.97) {
        const d = Math.abs(this.c - 0.62);
        this.scores.push(clamp(1 - d / 0.28, 0, 1));
        this.msg = d < 0.06 ? 'Ambra perfetta.' : this.c < 0.62 ? 'Un po\' chiaro. Delicato.' : 'Forte. Ti terrà sveglio.';
        this.api.sfx('ding');
        this.stage = 'versare';
        this.stageT = 0;
      }
    } else if (this.stage === 'versare') {
      if (this.cup > 1) {
        if (this.stageT > 1.3) this.done = true;
        return;
      }
      if (io.act && this.stageT > 0.4) {
        this.cups[this.cup] = Math.min(1.15, this.cups[this.cup] + dt * 0.45);
        this.pouring = true;
        if (Math.random() < dt * 6) this.api.sfx('drip');
        if (this.cups[this.cup] >= 1.15) this.lockCup();
      } else if (this.pouring) this.lockCup();
    }
  }

  lockCup() {
    this.pouring = false;
    const l = this.cups[this.cup];
    const s = l > 1 ? 0 : clamp(1 - Math.abs(l - 0.8) / 0.3, 0, 1);
    this.scores.push(s);
    this.msg = l > 1 ? 'Trabocca sul piattino!' : Math.abs(l - 0.8) < 0.06 ? 'Fino alla riga.' : l < 0.8 ? 'Mezza tazza.' : 'Un po\' piena.';
    this.cup++;
    this.stageT = 0;
  }

  get score() {
    return this.scores.reduce((a, b) => a + b, 0) / Math.max(1, this.scores.length);
  }

  resultNote() {
    return gradeOf(this.score).grade >= 2 ? 'Il tuo amico soffia sulla tazza e sorride.' : 'Il tuo amico lo beve lo stesso, educato.';
  }

  draw(g, t) {
    const tea = (k) => `rgb(${Math.round(250 - k * 140)},${Math.round(240 - k * 160)},${Math.round(210 - k * 190)})`;
    if (this.stage === 'infusione') {
      // la teiera di vetro con la bustina
      g.beginPath();
      g.ellipse(250, 240, 110, 95, 0, 0, Math.PI * 2);
      g.fillStyle = 'rgba(200,230,240,0.5)';
      g.fill();
      g.save();
      g.beginPath();
      g.ellipse(250, 240, 104, 89, 0, 0, Math.PI * 2);
      g.clip();
      g.fillStyle = tea(this.c);
      g.fillRect(140, 175, 220, 160);
      g.restore();
      g.strokeStyle = 'rgba(58,42,26,0.5)';
      g.lineWidth = 2;
      g.beginPath();
      g.moveTo(250, 90);
      g.lineTo(250 + Math.sin(t * 1.5) * 6, 200);
      g.stroke();
      rr(g, 236 + Math.sin(t * 1.5) * 6, 200, 28, 34, 4);
      g.fillStyle = '#d8c8a0';
      g.fill();
      // il campione di colore
      txt(g, 'ambra', 470, 140, { size: 14, color: 'rgba(58,42,26,0.7)' });
      rr(g, 470, 150, 60, 40, 8);
      g.fillStyle = tea(0.62);
      g.fill();
      txt(g, 'adesso', 470, 220, { size: 14, color: 'rgba(58,42,26,0.7)' });
      rr(g, 470, 230, 60, 40, 8);
      g.fillStyle = tea(this.c);
      g.fill();
    } else {
      for (let i = 0; i < 2; i++) {
        const x = 170 + i * 180;
        const y = 300;
        // la tazza
        g.beginPath();
        g.moveTo(x - 50, y - 90);
        g.lineTo(x + 50, y - 90);
        g.lineTo(x + 40, y);
        g.lineTo(x - 40, y);
        g.closePath();
        g.fillStyle = '#f8f6f0';
        g.fill();
        g.lineWidth = 2;
        g.strokeStyle = 'rgba(58,42,26,0.4)';
        g.stroke();
        const l = Math.min(1, this.cups[i]);
        const ly = y - l * 90;
        g.save();
        g.clip();
        g.fillStyle = tea(this.c);
        g.fillRect(x - 60, ly, 120, y - ly);
        g.restore();
        g.setLineDash([5, 4]);
        g.lineWidth = 2;
        g.strokeStyle = 'rgba(200,60,40,0.7)';
        g.beginPath();
        g.moveTo(x - 46, y - 72);
        g.lineTo(x + 46, y - 72);
        g.stroke();
        g.setLineDash([]);
        g.beginPath();
        g.ellipse(x, y + 8, 70, 12, 0, 0, Math.PI * 2);
        g.fillStyle = '#e8e4dc';
        g.fill();
        if (this.cups[i] > 1) {
          g.fillStyle = tea(this.c);
          g.beginPath();
          g.ellipse(x + 30, y + 8, 30, 6, 0, 0, Math.PI * 2);
          g.fill();
        }
        if (i === this.cup && this.pouring) {
          g.strokeStyle = tea(this.c);
          g.lineWidth = 6;
          g.beginPath();
          g.moveTo(x - 70, y - 160);
          g.quadraticCurveTo(x - 10, y - 160, x, ly);
          g.stroke();
        }
        if (i === this.cup && this.cup < 2) txt(g, '↓', x, y - 110, { size: 24, align: 'center', color: '#6a3a18' });
      }
    }
    if (this.msg) wrap(g, this.msg, 440, 80, 180, { size: 16, serif: true, weight: 700, color: '#6a3a18' });
  }
}

// ======================= LA CAMPANA =======================
// Tirare la corda al momento giusto: quando la campana è in cima allo slancio.
class Campana {
  constructor(api) {
    this.api = api;
    this.title = 'La campana';
    this.tries = 5;
    this.hits = 0;
    this.phase = 0;
    this.speed = 2.2;
    this.amp = 0.25;
    this.pull = 0;
    this.msg = '';
  }

  get help() {
    return 'Clic o Spazio quando la campana arriva in cima allo slancio (la zona dorata). Tre rintocchi.';
  }

  update(dt, io) {
    this.phase += dt * this.speed;
    this.pull = Math.max(0, this.pull - dt * 3);
    this.amp = Math.max(0.2, this.amp - dt * 0.04);
    if (this.endT !== undefined) {
      this.endT += dt;
      if (this.endT > 1.8) this.done = true;
      return;
    }
    if (io.actPressed) {
      this.tries--;
      this.pull = 1;
      const s = Math.sin(this.phase);
      if (s > 0.86) {
        this.hits++;
        this.amp = Math.min(0.55, this.amp + 0.12);
        this.speed += 0.15;
        this.msg = ['DONG', 'DONG!', 'DOOONG'][Math.min(2, this.hits - 1)];
        this.api.sfx('bell');
      } else {
        this.msg = 'La corda scivola...';
        this.api.sfx('rope');
      }
      if (this.hits >= 3 || this.tries <= 0) this.endT = 0;
    }
  }

  get score() {
    if (this.hits >= 3) return this.tries >= 1 ? 1 : 0.8;
    return (this.hits / 3) * 0.7;
  }

  resultNote() {
    return this.hits >= 3 ? 'I rintocchi rimbalzano tra le montagne, fino all\'hotel.' : `${this.hits} rintocch${this.hits === 1 ? 'o' : 'i'}. In piazza qualcuno alza la testa.`;
  }

  draw(g) {
    const a = Math.sin(this.phase) * this.amp;
    // la trave e la campana che oscilla
    g.fillStyle = '#5a3a22';
    g.fillRect(170, 70, 300, 14);
    g.save();
    g.translate(320, 84);
    g.rotate(a);
    g.fillStyle = '#c9a040';
    g.beginPath();
    g.moveTo(-20, 10);
    g.quadraticCurveTo(-26, 70, -60, 120);
    g.lineTo(60, 120);
    g.quadraticCurveTo(26, 70, 20, 10);
    g.closePath();
    g.fill();
    g.beginPath();
    g.arc(0, 128, 10, 0, Math.PI * 2);
    g.fillStyle = '#7a5a20';
    g.fill();
    g.restore();
    // l'indicatore dello slancio
    const cx = 320;
    const cy = 330;
    g.strokeStyle = 'rgba(58,42,26,0.25)';
    g.lineWidth = 10;
    g.beginPath();
    g.arc(cx, cy, 90, Math.PI * 1.15, Math.PI * 1.85);
    g.stroke();
    g.strokeStyle = '#e8b840';
    g.beginPath();
    g.arc(cx, cy, 90, Math.PI * 1.72, Math.PI * 1.85);
    g.stroke();
    const ang = Math.PI * 1.5 + Math.sin(this.phase) * Math.PI * 0.35;
    g.beginPath();
    g.arc(cx + Math.cos(ang) * 90, cy + Math.sin(ang) * 90, 9, 0, Math.PI * 2);
    g.fillStyle = INK;
    g.fill();
    // la corda
    g.strokeStyle = '#c8b890';
    g.lineWidth = 5;
    g.beginPath();
    g.moveTo(500, 90);
    g.lineTo(500, 250 + this.pull * 40);
    g.stroke();
    txt(g, `Rintocchi ${this.hits}/3`, 470, 300, { size: 15 });
    txt(g, `Tentativi ${Math.max(0, this.tries)}`, 470, 322, { size: 13, color: 'rgba(58,42,26,0.6)' });
    if (this.msg) wrap(g, this.msg, 40, 200, 140, { size: 24, serif: true, weight: 700, color: '#8a6a20' });
  }
}

export const GESTURES = {
  moka: { make: (api) => new Moka(api) },
  doccia: { make: (api) => new Doccia(api) },
  te: { make: (api) => new Te(api) },
  campana: { make: (api) => new Campana(api) },
};

// La scheda dei gesti: canvas, mouse e tastiera, giudizio finale.
export class GestureScreen {
  constructor() {
    this.el = document.getElementById('gesture');
    this.canvas = document.getElementById('gesture-canvas');
    this.footer = document.getElementById('gesture-footer');
    this.canvas.width = W;
    this.canvas.height = H;
    this.g = this.canvas.getContext('2d');
    this.open = false;
    this.io = { mx: 320, my: 200, down: false, clicked: false, hover: false };
    const pos = (e) => {
      const r = this.canvas.getBoundingClientRect();
      this.io.mx = ((e.clientX - r.left) / r.width) * W;
      this.io.my = ((e.clientY - r.top) / r.height) * H;
    };
    this.onMove = (e) => {
      pos(e);
      this.io.hover = true;
    };
    this.onDown = (e) => {
      pos(e);
      this.io.down = true;
      this.io.clicked = true;
      e.preventDefault();
    };
    this.onUp = () => (this.io.down = false);
    this.onLeave = () => {
      this.io.hover = false;
      this.io.down = false;
    };
    this.canvas.addEventListener('mousemove', this.onMove);
    this.canvas.addEventListener('mousedown', this.onDown);
    window.addEventListener('mouseup', this.onUp);
    this.canvas.addEventListener('mouseleave', this.onLeave);
  }

  // api: { sfx(nome) }. onDone riceve { score, grade, label, skipped, key }
  start(key, api, onDone, best = null) {
    this.key = key;
    this.game = GESTURES[key].make(api);
    this.onDone = onDone;
    this.best = best;
    this.t = 0;
    this.phase = 'play';
    this.open = true;
    this.io.down = false;
    this.io.clicked = false;
    this.el.classList.add('show');
  }

  update(dt, input) {
    if (!this.open) return;
    this.t += dt;
    const io = this.io;
    io.space = input.down('Space');
    io.act = io.down || io.space;
    io.actPressed = io.clicked || input.wasPressed('Space');
    io.enter = input.wasPressed('Enter', 'NumpadEnter');
    io.left = input.down('KeyA', 'ArrowLeft');
    io.right = input.down('KeyD', 'ArrowRight');
    io.up = input.down('KeyW', 'ArrowUp');
    io.down2 = input.down('KeyS', 'ArrowDown');
    io.keyMove = io.left || io.right || io.up || io.down2;
    if (input.wasPressed('Escape')) {
      this.finish(true);
      return;
    }
    const g = this.g;
    // la scheda di carta
    g.fillStyle = PAPER;
    g.fillRect(0, 0, W, H);
    g.strokeStyle = 'rgba(58,42,26,0.15)';
    g.lineWidth = 2;
    g.strokeRect(8, 8, W - 16, H - 16);
    txt(g, this.game.title, 28, 46, { size: 30, serif: true, weight: 700 });
    if (this.phase === 'play') {
      this.game.update(Math.min(dt, 1 / 20), io);
      this.game.draw(g, this.t);
      this.footer.innerHTML = `${this.game.help || ''} · <kbd>Esc</kbd> salta`;
      if (this.game.done) {
        this.phase = 'result';
        this.resT = 0;
        this.result = { ...gradeOf(this.game.score), score: this.game.score, key: this.key, note: this.game.resultNote() };
        this.game.api.sfx('result');
      }
    } else {
      this.resT += dt;
      this.game.draw(g, this.t);
      g.fillStyle = 'rgba(246,239,226,0.9)';
      g.fillRect(0, 0, W, H);
      txt(g, this.game.title, 320, 120, { size: 26, serif: true, align: 'center', color: 'rgba(58,42,26,0.6)' });
      const stars = '★★★'.slice(0, this.result.grade) + '☆☆☆'.slice(0, 3 - this.result.grade);
      txt(g, stars, 320, 180, { size: 40, align: 'center', color: '#d8a030' });
      txt(g, this.result.label, 320, 228, { size: 30, serif: true, weight: 700, align: 'center' });
      wrap(g, this.result.note, 320, 266, 520, { size: 17, serif: true, align: 'center', color: '#6a3a18' });
      if (this.best !== null) txt(g, `il tuo migliore: ${'★'.repeat(Math.max(this.best, this.result.grade))}`, 320, 300, { size: 13, align: 'center', color: 'rgba(58,42,26,0.6)' });
      if (Math.floor(this.t * 2) % 2) txt(g, 'clic o Spazio per continuare', 320, 350, { size: 13, align: 'center', color: 'rgba(58,42,26,0.6)' });
      this.footer.innerHTML = '';
      if (this.resT > 0.7 && io.actPressed) this.finish(false);
    }
    io.clicked = false;
  }

  finish(skipped) {
    this.open = false;
    this.el.classList.remove('show');
    const res = skipped ? { score: 0, grade: -1, label: '', skipped: true, key: this.key } : { ...this.result, skipped: false };
    const cb = this.onDone;
    this.onDone = null;
    cb?.(res);
  }

  dispose() {
    if (this.open) this.finish(true);
    this.canvas.removeEventListener('mousemove', this.onMove);
    this.canvas.removeEventListener('mousedown', this.onDown);
    window.removeEventListener('mouseup', this.onUp);
    this.canvas.removeEventListener('mouseleave', this.onLeave);
  }
}

// Ricorda il miglior giudizio di ogni gesto, e restituisce il precedente.
export function recordGesture(ctx, res) {
  const p = ctx.progress;
  p.gesti ??= {};
  const prev = p.gesti[res.key] ?? null;
  if (!res.skipped) {
    p.gesti[res.key] = Math.max(prev ?? -1, res.grade);
    ctx.saveProgress(p);
  }
  return prev;
}

// I suoni dei gesti, presi dal motore audio del gioco.
export function gestureSfx(audio) {
  return (name) => {
    const s = {
      drip: () => audio.pop(0.03),
      spoon: () => audio.thud(0.06),
      bubble: () => audio.pop(0.05 + Math.random() * 0.04),
      ding: () => audio.chime(784, 0.07),
      pipe: () => audio.thud(0.25),
      foam: () => audio.squeak(0.012),
      water: () => audio.pour(),
      bell: () => audio.bell(0.35, 196),
      rope: () => audio.thud(0.1),
      result: () => audio.chime(988, 0.09),
    }[name];
    s?.();
  };
}
