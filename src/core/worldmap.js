import { Terrain, HALF, RES, HOTEL, VILLAGE, MALL, AIRPORT, FIELD } from '../dreams/demone/terrain.js';
import { coastZ, coveAt, roadControl, BAY, STRIP as CSTRIP } from '../dreams/costa/terrain.js';
import { shoreR, M as ISLAND_M, TERRACES, LIGHT, ISLET, RUINS, PIER_X } from '../dreams/isola/terrain.js';
import { TERMINALS } from '../dreams/digitale/terminal.js';
import { gateOpen } from '../dreams/digitale/corruption.js';

// La mappa del sogno, con M. Il mondo intorno all'hotel disegnato dalle altezze
// vere del terreno (il campo, le montagne, la strada, il borgo, il centro
// commerciale, l'aeroporto) e, a lato, i posti dove si arriva in aereo.
// I posti non ancora visti restano un punto di domanda. Il nord è in alto.

const INK = '#2a2118';
const PAPER = '#efe3c6';
const ACCENT = '#c8402a';

let overworldImg = null; // disegnata una volta sola per sessione

function renderOverworld(terrain) {
  const T = terrain || new Terrain(7, { meshes: false });
  const n = RES + 1;
  const c = document.createElement('canvas');
  c.width = c.height = n;
  const g = c.getContext('2d');
  const img = g.createImageData(n, n);
  const cell = (HALF * 2) / RES;
  const ramp = [
    [0, [126, 156, 84]],
    [60, [150, 166, 92]],
    [160, [172, 160, 104]],
    [260, [160, 132, 98]],
    [380, [140, 126, 116]],
    [500, [196, 192, 186]],
    [650, [244, 242, 238]],
  ];
  const colorAt = (h) => {
    for (let k = 1; k < ramp.length; k++) {
      if (h <= ramp[k][0]) {
        const [h0, c0] = ramp[k - 1];
        const [h1, c1] = ramp[k];
        const t = Math.max(0, (h - h0) / (h1 - h0));
        return c0.map((v, i) => v + (c1[i] - v) * t);
      }
    }
    return ramp[ramp.length - 1][1];
  };
  for (let j = 0; j < n; j++) {
    for (let i = 0; i < n; i++) {
      const h = T.gridHeight(i, j);
      const hx = T.gridHeight(Math.min(n - 1, i + 1), j) - T.gridHeight(Math.max(0, i - 1), j);
      const hz = T.gridHeight(i, Math.min(n - 1, j + 1)) - T.gridHeight(i, Math.max(0, j - 1));
      // luce da nord-ovest (sulla mappa: in alto a sinistra)
      const shade = Math.max(0.55, Math.min(1.25, 1 + (hx * 0.6 + hz * 0.6) / (cell * 2)));
      const col = colorAt(h);
      // il nord (z alta) va in alto, l'est (x alta) a destra... sulla carta: x cresce verso sinistra
      const px = n - 1 - i;
      const py = n - 1 - j;
      const k = (py * n + px) * 4;
      img.data[k] = Math.min(255, col[0] * shade);
      img.data[k + 1] = Math.min(255, col[1] * shade);
      img.data[k + 2] = Math.min(255, col[2] * shade);
      img.data[k + 3] = 255;
    }
  }
  g.putImageData(img, 0, 0);
  // la strada
  const toPx = (x, z) => [((HALF - x) / (HALF * 2)) * (n - 1), ((HALF - z) / (HALF * 2)) * (n - 1)];
  const road = T.road;
  for (const [w, col] of [[4, 'rgba(60,40,20,0.7)'], [2, '#f4ead0']]) {
    g.strokeStyle = col;
    g.lineWidth = w;
    g.lineJoin = 'round';
    g.beginPath();
    let last = null;
    for (const p of road) {
      const [x, y] = toPx(p.x, p.z);
      if (last && (p.road !== last.road || Math.hypot(p.x - last.x, p.z - last.z) > 20)) g.moveTo(x, y);
      else if (!last) g.moveTo(x, y);
      else g.lineTo(x, y);
      last = p;
    }
    g.stroke();
  }
  return c;
}

export class WorldMap {
  constructor() {
    this.el = document.createElement('div');
    this.el.id = 'worldmap';
    this.canvas = document.createElement('canvas');
    this.el.appendChild(this.canvas);
    document.body.appendChild(this.el);
    this.open = false;
  }

  toggle(ctx, chapterId, scene) {
    if (this.open) return this.close();
    this.ctx = ctx;
    this.chapterId = chapterId;
    this.scene = scene;
    ctx.input.unlock?.();
    this.open = true;
    this.el.classList.add('show');
    this.t0 = performance.now();
    if (!overworldImg) {
      // la prima volta ci vuole un attimo: si disegna il terreno
      this.drawLoading();
      setTimeout(() => {
        const t = scene?.terrain instanceof Terrain ? scene.terrain : null;
        overworldImg = renderOverworld(t);
        if (this.open) this.draw();
      }, 30);
      return;
    }
    this.draw();
  }

  close() {
    this.open = false;
    this.el.classList.remove('show');
  }

  size() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = window.innerWidth;
    const h = window.innerHeight;
    if (this.canvas.width !== Math.round(w * dpr) || this.canvas.height !== Math.round(h * dpr)) {
      this.canvas.width = Math.round(w * dpr);
      this.canvas.height = Math.round(h * dpr);
    }
    const g = this.canvas.getContext('2d');
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    return { g, w, h };
  }

  drawLoading() {
    const { g, w, h } = this.size();
    g.clearRect(0, 0, w, h);
    g.fillStyle = PAPER;
    g.font = 'italic 600 28px "Cormorant Garamond", serif';
    g.textAlign = 'center';
    g.fillText('Disegno la mappa del sogno…', w / 2, h / 2);
  }

  // dove sei, e su quale foglio della mappa
  locate() {
    const s = this.scene;
    const id = this.chapterId;
    if (!s) return null;
    const pl = s.player;
    const foot = pl ? { x: pl.pos.x, z: pl.pos.z, yaw: pl.facing } : null;
    switch (id) {
      case 'campo':
        return { sheet: 'over', x: s.car.pos.x, z: s.car.pos.z, yaw: s.car.heading };
      case 'esterno':
        return s.mode === 'car' ? { sheet: 'over', x: s.car.pos.x, z: s.car.pos.z, yaw: s.car.heading } : { sheet: 'over', ...foot };
      case 'hotel':
        return { sheet: 'over', x: HOTEL.x, z: HOTEL.z, inside: 'nell\'hotel' };
      case 'centro':
        return { sheet: 'over', x: MALL.x, z: MALL.z, inside: 'nel centro commerciale' };
      case 'aeroporto':
        return { sheet: 'over', x: AIRPORT.x, z: AIRPORT.z, inside: 'nell\'aeroporto' };
      case 'costa':
        return s.mode === 'car' ? { sheet: 'costa', x: s.jeep.pos.x, z: s.jeep.pos.z, yaw: s.jeep.heading } : { sheet: 'costa', ...foot };
      case 'isola':
        return s.mode === 'plane' ? { sheet: 'isola', x: s.plane.pos.x, z: s.plane.pos.z, yaw: s.plane.yaw, plane: true } : { sheet: 'isola', ...foot };
      case 'spiaggia':
        return { sheet: 'spiaggia', ...foot };
      default:
        return null;
    }
  }

  draw() {
    if (!this.open) return;
    if (!overworldImg) return this.drawLoading();
    const { g, w, h } = this.size();
    const P = this.ctx.progress;
    const seen = P.places || {};
    const t = (performance.now() - this.t0) / 1000;
    const here = this.locate();
    g.clearRect(0, 0, w, h);

    // impaginazione: la carta grande e, accanto (o sotto), i tre voli
    const pad = 18;
    const wide = w >= h * 1.15;
    const top = 64;
    let S;
    let insets;
    if (wide) {
      S = Math.min(h - top - 58, (w - pad * 3) * 0.62);
      const ix = pad * 2 + S;
      const iw = Math.min(w - ix - pad, S * 0.62);
      const ih = (S - pad * 2) / 3;
      insets = [0, 1, 2].map((k) => ({ x: ix, y: top + k * (ih + pad), w: iw, h: ih }));
    } else {
      S = Math.min(w - pad * 2, (h - top - 58) * 0.62);
      const iy = top + S + pad;
      const ih = Math.min(h - iy - 50, S * 0.4);
      const iw = (S - pad * 2) / 3;
      insets = [0, 1, 2].map((k) => ({ x: pad + k * (iw + pad), y: iy, w: iw, h: ih }));
    }
    const ox = wide ? pad : (w - S) / 2;
    const oy = top;
    if (!wide) insets.forEach((r) => (r.x += ox - pad));

    // il titolo
    g.textAlign = 'left';
    g.fillStyle = PAPER;
    g.font = '700 30px "Cormorant Garamond", serif';
    g.fillText('Mappa del sogno', ox, 42);
    g.font = '600 12px Inter, sans-serif';
    g.globalAlpha = 0.7;
    g.textAlign = 'right';
    g.fillText('M o Esc per chiudere', ox + S + (wide ? pad + insets[0].w : 0), 42);
    g.globalAlpha = 1;

    // ---------- La carta del mondo ----------
    this.paperFrame(g, ox, oy, S, S);
    g.save();
    g.beginPath();
    g.rect(ox + 6, oy + 6, S - 12, S - 12);
    g.clip();
    g.globalAlpha = 0.92;
    g.drawImage(overworldImg, ox + 6, oy + 6, S - 12, S - 12);
    g.globalAlpha = 1;
    const ow = (x, z) => [ox + 6 + ((HALF - x) / (HALF * 2)) * (S - 12), oy + 6 + ((HALF - z) / (HALF * 2)) * (S - 12)];
    const k = (S - 12) / (HALF * 2);
    // la corruzione
    const gates = [
      { id: 'borgo', x: VILLAGE.x, z: VILLAGE.z, r: VILLAGE.r + 30 },
      { id: 'conca', x: MALL.x, z: MALL.z, r: MALL.r + 50 },
    ];
    for (const gt of gates) {
      if (gateOpen(P, gt.id)) continue;
      const [cx, cy] = ow(gt.x, gt.z);
      const r = gt.r * k;
      for (let a = 0; a < Math.PI * 2; a += 0.16) {
        const jit = Math.sin(a * 13 + Math.floor(t * 8)) * 2;
        g.fillStyle = ['#ff2ad8', '#2affe8', '#1a1a1a', '#f4f02a'][Math.floor(a * 7 + t * 6) % 4];
        g.fillRect(cx + Math.cos(a) * (r + jit) - 2.5, cy + Math.sin(a) * (r + jit) - 2.5, 5, 5);
      }
    }
    // i luoghi
    const known = (id) => !!seen[id];
    const villageKnown = known('borgo') || !!P.esterno?.villageSeen;
    const marks = [
      { x: FIELD.cx, z: FIELD.cz + 120, name: 'Il campo', sub: 'dove guidavi, col demone', on: true, kind: 'area' },
      { x: HOTEL.x, z: HOTEL.z, name: 'Hotel delle Mille Stanze', sub: 'la suite 1313', on: !!P.hotel?.reached || this.chapterId !== 'campo', kind: 'hotel' },
      { x: VILLAGE.x, z: VILLAGE.z, name: 'Sant\'Onirio', sub: 'il borgo in vetta', on: villageKnown, kind: 'place' },
      { x: MALL.x, z: MALL.z, name: 'Centro Orizzonte', sub: 'due piani, quasi nessuno', on: known('centro'), kind: 'place' },
      { x: AIRPORT.x, z: AIRPORT.z, name: 'Aeroporto', sub: 'le partenze verso i sogni', on: known('aeroporto'), kind: 'place' },
    ];
    for (const m of marks) {
      const [x, y] = ow(m.x, m.z);
      if (m.kind === 'area') {
        this.label(g, x, y, m.name, m.sub, { italic: true });
        continue;
      }
      this.pin(g, x, y, m.on ? (m.kind === 'hotel' ? '#e8a23a' : ACCENT) : '#7a7066');
      this.label(g, x, y - 14, m.on ? m.name : '?', null);
    }
    // i terminali, se l'invasione è cominciata
    if (P.digitale?.found) {
      const tpos = {
        piazzale: [HOTEL.x + 30, HOTEL.z - 58],
        borgo: [VILLAGE.x, VILLAGE.z],
        parcheggio: [MALL.x + 59, MALL.z + 16],
        galleria: [MALL.x - 20, MALL.z],
      };
      for (const id of Object.keys(TERMINALS).filter((q) => tpos[q])) {
        const [x, y] = ow(...tpos[id]);
        const done = P.digitale?.terminals?.[id]?.cleared;
        g.fillStyle = done ? '#2ad8a8' : '#ff2ad8';
        g.strokeStyle = INK;
        g.lineWidth = 1.5;
        g.fillRect(x + 9, y + 2, 9, 7);
        g.strokeRect(x + 9, y + 2, 9, 7);
      }
    }
    // le rotte dall'aeroporto
    const air = ow(AIRPORT.x, AIRPORT.z);
    g.restore();

    // ---------- I voli ----------
    const flights = [
      { id: 'costa', name: 'Spiaggia Grande', gate: 4, draw: (r, hh) => this.drawCoast(g, r, hh) },
      { id: 'isola', name: 'L\'Isola', gate: 3, draw: (r, hh) => this.drawIsland(g, r, hh) },
      { id: 'spiaggia', name: 'Spiaggia d\'Inverno', gate: 2, draw: (r, hh) => this.drawWinter(g, r, hh) },
    ];
    flights.forEach((f, i) => {
      const r = insets[i];
      // la rotta tratteggiata
      g.save();
      g.setLineDash([6, 6]);
      g.lineDashOffset = -t * 20;
      g.strokeStyle = known('aeroporto') ? 'rgba(255,240,210,0.65)' : 'rgba(255,240,210,0.2)';
      g.lineWidth = 2;
      g.beginPath();
      g.moveTo(air[0], air[1]);
      const tx = wide ? r.x : r.x + r.w / 2;
      const ty = wide ? r.y + r.h / 2 : r.y;
      g.bezierCurveTo((air[0] + tx) / 2, air[1] + (wide ? 0 : 40), (air[0] + tx) / 2, ty - (wide ? 0 : 30), tx, ty);
      g.stroke();
      g.restore();
      this.paperFrame(g, r.x, r.y, r.w, r.h);
      g.save();
      g.beginPath();
      g.rect(r.x + 5, r.y + 5, r.w - 10, r.h - 10);
      g.clip();
      const inner = { x: r.x + 5, y: r.y + 5, w: r.w - 10, h: r.h - 10 };
      f.draw(inner, here?.sheet === f.id ? here : null);
      if (!known(f.id)) {
        g.fillStyle = 'rgba(228,212,174,0.95)';
        g.fillRect(inner.x, inner.y, inner.w, inner.h);
        g.fillStyle = INK;
        g.textAlign = 'center';
        g.font = '700 34px "Cormorant Garamond", serif';
        g.fillText('?', inner.x + inner.w / 2, inner.y + inner.h / 2 + 6);
      }
      g.restore();
      g.textAlign = 'left';
      g.fillStyle = INK;
      g.font = '700 13px Inter, sans-serif';
      g.fillText(known(f.id) ? f.name : 'Un posto non ancora visto', r.x + 10, r.y + 20);
      g.font = '600 11px Inter, sans-serif';
      g.globalAlpha = 0.7;
      g.fillText(`volo dal gate ${f.gate}`, r.x + 10, r.y + 34);
      g.globalAlpha = 1;
    });

    // ---------- Sei qui ----------
    if (here) {
      let pos = null;
      if (here.sheet === 'over') pos = ow(here.x, here.z);
      const pulse = 1 + Math.sin(t * 5) * 0.25;
      if (pos) this.youAreHere(g, pos[0], pos[1], here.inside ? null : here.yaw, pulse, here.inside);
      else if (this.insetPos) this.youAreHere(g, this.insetPos[0], this.insetPos[1], here.yaw, pulse, null, here.plane);
    }
    this.insetPos = null;

    // ---------- In fondo: quanto hai visto ----------
    const places = ['borgo', 'centro', 'aeroporto', 'costa', 'isola', 'spiaggia'];
    const nSeen = places.filter((p) => (p === 'borgo' ? villageKnown : known(p))).length;
    const term = P.digitale?.found ? Object.keys(TERMINALS).filter((id) => P.digitale?.terminals?.[id]?.cleared).length : null;
    const isl = P.isola;
    const bits = [`Luoghi visti: ${nSeen}/${places.length}`];
    if (term !== null) bits.push(`Terminali liberati: ${term}/${Object.keys(TERMINALS).length}`);
    if (isl) bits.push(`Isola: pagine ${isl.pages?.length || 0}/5${isl.boss ? ' · gabbiano battuto' : ''}`);
    if (P.costa?.lain) bits.push('Spiaggia Grande: posto trovato');
    g.textAlign = 'left';
    g.fillStyle = PAPER;
    g.font = '600 13px Inter, sans-serif';
    g.globalAlpha = 0.85;
    g.fillText(bits.join('   ·   '), ox, Math.min(h - 18, oy + S + (wide ? 30 : insets[0].h + pad + 30)));
    g.globalAlpha = 1;
  }

  paperFrame(g, x, y, w, h) {
    g.save();
    g.shadowColor = 'rgba(0,0,0,0.5)';
    g.shadowBlur = 18;
    g.fillStyle = PAPER;
    g.fillRect(x, y, w, h);
    g.restore();
    g.strokeStyle = 'rgba(42,33,24,0.55)';
    g.lineWidth = 1.5;
    g.strokeRect(x + 3.5, y + 3.5, w - 7, h - 7);
  }

  pin(g, x, y, color) {
    g.fillStyle = color;
    g.strokeStyle = INK;
    g.lineWidth = 1.5;
    g.beginPath();
    g.arc(x, y - 8, 6, Math.PI, 0);
    g.lineTo(x, y);
    g.closePath();
    g.fill();
    g.stroke();
    g.fillStyle = PAPER;
    g.beginPath();
    g.arc(x, y - 8, 2.2, 0, Math.PI * 2);
    g.fill();
  }

  label(g, x, y, name, sub, { italic = false } = {}) {
    g.textAlign = 'center';
    g.font = italic ? 'italic 700 17px "Cormorant Garamond", serif' : '700 13px Inter, sans-serif';
    g.lineWidth = 3.5;
    g.strokeStyle = 'rgba(239,227,198,0.85)';
    g.strokeText(name, x, y - 6);
    g.fillStyle = INK;
    g.fillText(name, x, y - 6);
    if (sub) {
      g.font = 'italic 600 13px "Cormorant Garamond", serif';
      g.strokeText(sub, x, y + 8);
      g.fillText(sub, x, y + 8);
    }
  }

  youAreHere(g, x, y, yaw, pulse, inside, plane = false) {
    g.save();
    g.strokeStyle = 'rgba(200,64,42,0.8)';
    g.lineWidth = 2;
    g.beginPath();
    g.arc(x, y, 11 * pulse, 0, Math.PI * 2);
    g.stroke();
    g.translate(x, y);
    if (yaw !== null && yaw !== undefined) {
      // in avanti nel mondo è (sin, cos): sulla carta la x è rovesciata e la z va in alto
      g.rotate(Math.atan2(-Math.cos(yaw), -Math.sin(yaw)));
      g.fillStyle = ACCENT;
      g.strokeStyle = PAPER;
      g.lineWidth = 1.5;
      g.beginPath();
      if (plane) {
        g.moveTo(9, 0);
        g.lineTo(-6, -8);
        g.lineTo(-3, 0);
        g.lineTo(-6, 8);
      } else {
        g.moveTo(8, 0);
        g.lineTo(-5, -5.5);
        g.lineTo(-2, 0);
        g.lineTo(-5, 5.5);
      }
      g.closePath();
      g.fill();
      g.stroke();
    } else {
      g.fillStyle = ACCENT;
      g.beginPath();
      g.arc(0, 0, 5, 0, Math.PI * 2);
      g.fill();
    }
    g.restore();
    g.textAlign = 'center';
    g.font = '800 12px Inter, sans-serif';
    g.lineWidth = 3;
    g.strokeStyle = 'rgba(239,227,198,0.9)';
    const txt = inside ? `Sei qui, ${inside}` : 'Sei qui';
    g.strokeText(txt, x, y + 26);
    g.fillStyle = ACCENT;
    g.fillText(txt, x, y + 26);
  }

  // un foglio con il suo rettangolo di mondo; restituisce la funzione mondo → carta
  sheet(r, minX, maxX, minZ, maxZ) {
    const sx = r.w / (maxX - minX);
    const sz = r.h / (maxZ - minZ);
    const s = Math.min(sx, sz);
    const cx = r.x + r.w / 2;
    const cy = r.y + r.h / 2 + 8;
    const mx = (minX + maxX) / 2;
    const mz = (minZ + maxZ) / 2;
    return (x, z) => [cx - (x - mx) * s, cy - (z - mz) * s];
  }

  water(g, r) {
    g.fillStyle = '#9ccad0';
    g.fillRect(r.x, r.y, r.w, r.h);
  }

  drawCoast(g, r, here) {
    this.water(g, r);
    const m = this.sheet(r, -1000, 900, -280, 80);
    // la terra: sotto la linea della riva
    g.fillStyle = '#c8bc84';
    g.beginPath();
    let first = true;
    for (let x = -1050; x <= 950; x += 10) {
      const [px, py] = m(x, coastZ(x));
      if (first) g.moveTo(px, py);
      else g.lineTo(px, py);
      first = false;
    }
    const [ex, ey] = m(950, -1200);
    const [sx] = m(-1050, -1200);
    g.lineTo(ex, ey);
    g.lineTo(sx, ey);
    g.closePath();
    g.fill();
    // la spiaggia, piena di ombrelloni
    for (let x = BAY.x - 125; x <= BAY.x + 125; x += 6) {
      if (coveAt(x) < 0.5) continue;
      for (let d = 12; d < 48; d += 6) {
        const [px, py] = m(x, coastZ(x) - d);
        g.fillStyle = ['#2a6ac8', '#ff8a2a', '#2a9a5a', '#d83a3a', '#f0c020'][Math.floor((x + d) / 7) % 5];
        g.fillRect(px - 1, py - 1, 2, 2);
      }
    }
    // la sterrata
    g.setLineDash([4, 3]);
    g.strokeStyle = '#7a5a3a';
    g.lineWidth = 2;
    g.beginPath();
    roadControl().forEach(([x, z], i) => {
      const [px, py] = m(x, z);
      if (i) g.lineTo(px, py);
      else g.moveTo(px, py);
    });
    g.stroke();
    g.setLineDash([]);
    // la pista
    const [a0, b0] = m(CSTRIP.minX, CSTRIP.z);
    const [a1] = m(CSTRIP.maxX, CSTRIP.z);
    g.strokeStyle = '#8a7050';
    g.lineWidth = 4;
    g.beginPath();
    g.moveTo(a0, b0);
    g.lineTo(a1, b0);
    g.stroke();
    this.tiny(g, ...m(-800, -200), 'pista');
    this.tiny(g, ...m(BAY.x, coastZ(BAY.x) - 95), 'Bagno 13');
    if (here) this.insetPos = m(here.x, here.z);
  }

  drawIsland(g, r, here) {
    this.water(g, r);
    const m = this.sheet(r, -340, 340, -330, 330);
    g.fillStyle = '#f0e2b0';
    g.beginPath();
    for (let i = 0; i <= 120; i++) {
      const th = (i / 120) * Math.PI * 2;
      const R = shoreR(th);
      const [px, py] = m(Math.cos(th) * R, Math.sin(th) * R);
      if (i) g.lineTo(px, py);
      else g.moveTo(px, py);
    }
    g.fill();
    g.fillStyle = '#7ab85a';
    g.beginPath();
    for (let i = 0; i <= 120; i++) {
      const th = (i / 120) * Math.PI * 2;
      const R = shoreR(th) - 18;
      const [px, py] = m(Math.cos(th) * R, Math.sin(th) * R);
      if (i) g.lineTo(px, py);
      else g.moveTo(px, py);
    }
    g.fill();
    // l'isolotto
    const [ix, iy] = m(ISLET.x, ISLET.z);
    const s = m(1, 0)[0] - m(0, 0)[0];
    g.fillStyle = '#f0e2b0';
    g.beginPath();
    g.arc(ix, iy, Math.abs(ISLET.r * s), 0, Math.PI * 2);
    g.fill();
    // la montagna a gradoni
    TERRACES.forEach((tr, i) => {
      const [cx, cy] = m(ISLAND_M.x, ISLAND_M.z);
      g.fillStyle = ['#a88a5a', '#b89a62', '#c8aa72', '#d8c08a'][i];
      g.beginPath();
      g.arc(cx, cy, Math.abs(tr.r * s), 0, Math.PI * 2);
      g.fill();
    });
    // il faro, il villaggio, le rovine, il pontile
    const [lx, ly] = m(LIGHT.x, LIGHT.z);
    g.fillStyle = '#d83a3a';
    g.fillRect(lx - 2, ly - 2, 4, 4);
    const [vx, vy] = m(40, 150);
    g.fillStyle = '#e86a4a';
    for (let k = 0; k < 4; k++) g.fillRect(vx - 14 + k * 7, vy - 2, 4, 4);
    const [rx, ry] = m(RUINS.x, RUINS.z);
    g.fillStyle = '#9a9080';
    g.fillRect(rx - 3, ry - 3, 6, 6);
    const [p0x, p0y] = m(PIER_X, 205);
    const [, p1y] = m(PIER_X, 265);
    g.strokeStyle = '#7a5a3a';
    g.lineWidth = 2;
    g.beginPath();
    g.moveTo(p0x, p0y);
    g.lineTo(p0x, p1y);
    g.stroke();
    this.tiny(g, lx, ly - 6, 'faro');
    // le pagine ancora sparse
    const P = this.ctx.progress.isola;
    if (P?.intro) {
      const spots = { vetta: [ISLAND_M.x, ISLAND_M.z], faro: [LIGHT.x - 5, LIGHT.z], isolotto: [ISLET.x, ISLET.z] };
      for (const [id, [x, z]] of Object.entries(spots)) {
        if (P.pages?.includes(id)) continue;
        const [px, py] = m(x, z);
        g.fillStyle = '#ffffff';
        g.strokeStyle = '#2a8ac8';
        g.lineWidth = 1.5;
        g.fillRect(px - 3, py - 4, 6, 8);
        g.strokeRect(px - 3, py - 4, 6, 8);
      }
    }
    if (here) this.insetPos = m(here.x, here.z);
  }

  drawWinter(g, r, here) {
    const m = this.sheet(r, -62, 62, -46, 60);
    g.fillStyle = '#7a8a94';
    g.fillRect(r.x, r.y, r.w, r.h);
    // la sabbia (sotto la riva, z < 30)
    const [a, b] = m(62, 30);
    const [c, d] = m(-62, -46);
    g.fillStyle = '#d8d0bc';
    g.fillRect(a, b, c - a, d - b);
    // la piscina vuota
    const [p0, q0] = m(36, -12);
    const [p1, q1] = m(18, -26);
    g.fillStyle = '#a8c8d8';
    g.fillRect(p0, q0, p1 - p0, q1 - q0);
    // gli ombrelloni chiusi
    g.fillStyle = '#5a6670';
    for (let x = -50; x <= 50; x += 8) for (let z = -6; z <= 22; z += 7) {
      const [px, py] = m(x, z);
      g.fillRect(px - 1, py - 1, 2, 2);
    }
    // la strada e la fermata
    const [s0, t0] = m(62, -44);
    const [s1] = m(-62, -44);
    g.strokeStyle = '#4a4a4e';
    g.lineWidth = 3;
    g.beginPath();
    g.moveTo(s0, t0);
    g.lineTo(s1, t0);
    g.stroke();
    this.tiny(g, ...m(0, -37), 'navetta');
    if (here) this.insetPos = m(here.x, here.z);
  }

  tiny(g, x, y, text) {
    g.textAlign = 'center';
    g.font = 'italic 600 12px "Cormorant Garamond", serif';
    g.fillStyle = INK;
    g.fillText(text, x, y);
  }
}

