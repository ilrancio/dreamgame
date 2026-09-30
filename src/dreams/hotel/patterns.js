import * as THREE from 'three';

// Motivi dipinti su canvas per pavimenti e pareti delle stanze.
// Ogni funzione riceve il contesto 2D e la dimensione del canvas quadrato.

function tex(draw, size = 256, repeat = [1, 1]) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  draw(c.getContext('2d'), size);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(repeat[0], repeat[1]);
  t.anisotropy = 4;
  return t;
}

const noiseDots = (g, s, n, col, size = 2) => {
  g.fillStyle = col;
  for (let i = 0; i < n; i++) g.fillRect(Math.random() * s, Math.random() * s, size, size);
};

export const PATTERNS = {
  planks: ([a, b]) =>
    tex((g, s) => {
      const rows = 8;
      for (let r = 0; r < rows; r++) {
        const off = (r % 2) * 90;
        for (let x = -off; x < s; x += 180) {
          g.fillStyle = Math.random() > 0.5 ? a : b;
          g.fillRect(x, (r * s) / rows, 178, s / rows - 2);
        }
      }
      noiseDots(g, s, 600, 'rgba(0,0,0,0.12)', 1);
    }, 256, [4, 4]),

  checker: ([a, b]) =>
    tex((g, s) => {
      const n = 4;
      for (let i = 0; i < n; i++)
        for (let j = 0; j < n; j++) {
          g.fillStyle = (i + j) % 2 ? a : b;
          g.fillRect((i * s) / n, (j * s) / n, s / n, s / n);
        }
      noiseDots(g, s, 300, 'rgba(255,255,255,0.08)', 2);
    }, 256, [4, 4]),

  tatami: ([a, b]) =>
    tex((g, s) => {
      g.fillStyle = a;
      g.fillRect(0, 0, s, s);
      g.strokeStyle = 'rgba(80,70,30,0.25)';
      for (let y = 0; y < s; y += 4) {
        g.beginPath();
        g.moveTo(0, y);
        g.lineTo(s, y);
        g.stroke();
      }
      g.fillStyle = b;
      g.fillRect(0, 0, s, 10);
      g.fillRect(0, s / 2, s, 10);
      g.fillRect(s / 2 - 5, 0, 10, s / 2);
    }, 256, [3, 3]),

  shoji: ([a, b]) =>
    tex((g, s) => {
      g.fillStyle = a;
      g.fillRect(0, 0, s, s);
      g.fillStyle = b;
      for (let x = 0; x <= s; x += s / 4) g.fillRect(x - 3, 0, 6, s);
      for (let y = 0; y <= s; y += s / 6) g.fillRect(0, y - 3, s, 6);
    }, 256, [3, 1]),

  damask: ([a, b]) =>
    tex((g, s) => {
      g.fillStyle = a;
      g.fillRect(0, 0, s, s);
      g.fillStyle = b;
      for (let i = 0; i < 2; i++)
        for (let j = 0; j < 2; j++) {
          const cx = (i + 0.5) * (s / 2) + (j % 2) * 0;
          const cy = (j + 0.5) * (s / 2);
          g.beginPath();
          g.ellipse(cx, cy, 22, 40, 0, 0, Math.PI * 2);
          g.fill();
          g.beginPath();
          g.ellipse(cx, cy, 40, 12, 0, 0, Math.PI * 2);
          g.fill();
        }
    }, 256, [4, 2]),

  stripes: ([a, b]) =>
    tex((g, s) => {
      for (let x = 0; x < s; x += 32) {
        g.fillStyle = (x / 32) % 2 ? a : b;
        g.fillRect(x, 0, 32, s);
      }
    }, 256, [6, 1]),

  books: () =>
    tex((g, s) => {
      g.fillStyle = '#2a1a10';
      g.fillRect(0, 0, s, s);
      const shelves = 5;
      const sh = s / shelves;
      const cols = ['#7a2a22', '#2a4a6a', '#3a5a2a', '#8a6a2a', '#5a2a5a', '#a08060', '#1a3a3a'];
      for (let r = 0; r < shelves; r++) {
        let x = 2;
        while (x < s - 4) {
          const w = 5 + Math.random() * 9;
          const h = sh * (0.65 + Math.random() * 0.25);
          g.fillStyle = cols[Math.floor(Math.random() * cols.length)];
          g.fillRect(x, r * sh + sh - 6 - h, w - 1, h);
          x += w;
        }
        g.fillStyle = '#4a3020';
        g.fillRect(0, r * sh + sh - 6, s, 6);
      }
    }, 256, [4, 2]),

  stone: ([a, b]) =>
    tex((g, s) => {
      g.fillStyle = b;
      g.fillRect(0, 0, s, s);
      const rows = 6;
      const rh = s / rows;
      for (let r = 0; r < rows; r++) {
        const off = (r % 2) * 32;
        for (let x = -off; x < s; x += 64) {
          const v = Math.random() * 20 - 10;
          g.fillStyle = shade(a, v);
          g.fillRect(x + 2, r * rh + 2, 60, rh - 4);
        }
      }
      noiseDots(g, s, 500, 'rgba(0,0,0,0.15)', 2);
    }, 256, [4, 2]),

  hieroglyph: ([a, b]) =>
    tex((g, s) => {
      g.fillStyle = a;
      g.fillRect(0, 0, s, s);
      g.fillStyle = b;
      g.strokeStyle = b;
      g.lineWidth = 3;
      // pittogrammi semplici: occhi, ankh, onde, triangoli
      for (let y = 20; y < s; y += 42)
        for (let x = 14; x < s; x += 36) {
          const k = Math.floor(Math.random() * 4);
          g.beginPath();
          if (k === 0) {
            g.ellipse(x, y, 10, 5, 0, 0, Math.PI * 2);
            g.moveTo(x + 3, y);
            g.arc(x, y, 3, 0, Math.PI * 2);
          } else if (k === 1) {
            g.ellipse(x, y - 8, 5, 7, 0, 0, Math.PI * 2);
            g.moveTo(x, y - 1);
            g.lineTo(x, y + 16);
            g.moveTo(x - 8, y + 3);
            g.lineTo(x + 8, y + 3);
          } else if (k === 2) {
            g.moveTo(x - 10, y);
            for (let t = 0; t <= 20; t += 5) g.lineTo(x - 10 + t, y + (t % 10 ? -4 : 4));
          } else {
            g.moveTo(x - 9, y + 9);
            g.lineTo(x, y - 9);
            g.lineTo(x + 9, y + 9);
            g.closePath();
          }
          g.stroke();
        }
      g.fillRect(0, 0, s, 4);
    }, 256, [4, 2]),

  grid: ([a, b]) =>
    tex((g, s) => {
      g.fillStyle = a;
      g.fillRect(0, 0, s, s);
      g.strokeStyle = b;
      g.lineWidth = 2;
      for (let x = 0; x <= s; x += s / 8) {
        g.beginPath();
        g.moveTo(x, 0);
        g.lineTo(x, s);
        g.stroke();
        g.beginPath();
        g.moveTo(0, x);
        g.lineTo(s, x);
        g.stroke();
      }
    }, 256, [4, 4]),

  tiles: ([a, b]) =>
    tex((g, s) => {
      g.fillStyle = b;
      g.fillRect(0, 0, s, s);
      const n = 8;
      for (let i = 0; i < n; i++)
        for (let j = 0; j < n; j++) {
          g.fillStyle = shade(a, Math.random() * 8 - 4);
          g.fillRect((i * s) / n + 1.5, (j * s) / n + 1.5, s / n - 3, s / n - 3);
        }
    }, 256, [6, 6]),

  chevron: ([a, b]) =>
    tex((g, s) => {
      g.fillStyle = a;
      g.fillRect(0, 0, s, s);
      g.fillStyle = b;
      const h = s / 8;
      for (let r = 0; r < 8; r += 2) {
        g.beginPath();
        for (let x = 0; x <= s; x += s / 4) {
          const y = r * h + ((x / (s / 4)) % 2 ? h : 0);
          if (x === 0) g.moveTo(x, y);
          else g.lineTo(x, y);
        }
        for (let x = s; x >= 0; x -= s / 4) {
          const y = r * h + h + ((x / (s / 4)) % 2 ? h : 0);
          g.lineTo(x, y);
        }
        g.fill();
      }
    }, 256, [4, 4]),

  stars: ([a, b]) =>
    tex((g, s) => {
      g.fillStyle = a;
      g.fillRect(0, 0, s, s);
      g.fillStyle = b;
      for (let i = 0; i < 14; i++) {
        const x = Math.random() * s;
        const y = Math.random() * s;
        const r = 6 + Math.random() * 8;
        g.beginPath();
        for (let k = 0; k < 10; k++) {
          const ang = (k * Math.PI) / 5 - Math.PI / 2;
          const rr = k % 2 ? r * 0.45 : r;
          g.lineTo(x + Math.cos(ang) * rr, y + Math.sin(ang) * rr);
        }
        g.fill();
      }
    }, 256, [4, 2]),

  curtains: ([a, b]) =>
    tex((g, s) => {
      const grd = g.createLinearGradient(0, 0, s, 0);
      for (let i = 0; i <= 8; i++) grd.addColorStop(i / 8, i % 2 ? a : b);
      g.fillStyle = grd;
      g.fillRect(0, 0, s, s);
    }, 256, [6, 1]),

  ice: ([a, b]) =>
    tex((g, s) => {
      g.fillStyle = a;
      g.fillRect(0, 0, s, s);
      g.strokeStyle = b;
      for (let i = 0; i < 30; i++) {
        g.lineWidth = 0.5 + Math.random() * 1.5;
        g.beginPath();
        let x = Math.random() * s;
        let y = Math.random() * s;
        g.moveTo(x, y);
        for (let k = 0; k < 5; k++) {
          x += (Math.random() - 0.5) * 60;
          y += (Math.random() - 0.5) * 60;
          g.lineTo(x, y);
        }
        g.stroke();
      }
    }, 256, [3, 3]),

  sand: ([a, b]) =>
    tex((g, s) => {
      g.fillStyle = a;
      g.fillRect(0, 0, s, s);
      noiseDots(g, s, 4000, b, 1.5);
    }, 256, [5, 5]),

  concrete: ([a, b]) =>
    tex((g, s) => {
      g.fillStyle = a;
      g.fillRect(0, 0, s, s);
      noiseDots(g, s, 2500, 'rgba(0,0,0,0.06)', 2);
      noiseDots(g, s, 800, 'rgba(255,255,255,0.05)', 2);
      // giunti delle casseforme e fori dei tiranti
      g.strokeStyle = b;
      g.lineWidth = 2;
      g.strokeRect(1, 1, s - 2, s / 2 - 2);
      g.strokeRect(1, s / 2 + 1, s - 2, s / 2 - 2);
      g.fillStyle = b;
      for (const [x, y] of [[s * 0.2, s * 0.25], [s * 0.8, s * 0.25], [s * 0.2, s * 0.75], [s * 0.8, s * 0.75]]) {
        g.beginPath();
        g.arc(x, y, 3, 0, Math.PI * 2);
        g.fill();
      }
    }, 256, [4, 2]),

  plaid: ([a, b]) =>
    tex((g, s) => {
      g.fillStyle = a;
      g.fillRect(0, 0, s, s);
      g.fillStyle = b;
      g.globalAlpha = 0.45;
      for (let x = 0; x < s; x += 64) g.fillRect(x, 0, 24, s);
      for (let y = 0; y < s; y += 64) g.fillRect(0, y, s, 24);
      g.globalAlpha = 0.25;
      g.fillStyle = '#fff';
      for (let x = 30; x < s; x += 64) g.fillRect(x, 0, 3, s);
      g.globalAlpha = 1;
    }, 256, [3, 3]),

  arcade: () =>
    tex((g, s) => {
      // la classica moquette delle sale giochi: forme fluo sul blu notte
      g.fillStyle = '#10081e';
      g.fillRect(0, 0, s, s);
      const cols = ['#ff2a9a', '#2af0ff', '#ffe42a', '#8a4aff', '#3aff7a'];
      for (let i = 0; i < 40; i++) {
        g.fillStyle = cols[i % cols.length];
        g.strokeStyle = cols[(i + 2) % cols.length];
        g.lineWidth = 3;
        const x = Math.random() * s;
        const y = Math.random() * s;
        const k = i % 4;
        g.beginPath();
        if (k === 0) g.arc(x, y, 6, 0, Math.PI * 2);
        else if (k === 1) {
          g.moveTo(x - 8, y + 6);
          g.lineTo(x, y - 8);
          g.lineTo(x + 8, y + 6);
          g.closePath();
        } else if (k === 2) {
          g.moveTo(x - 10, y);
          g.bezierCurveTo(x - 4, y - 10, x + 4, y + 10, x + 10, y);
          g.stroke();
          continue;
        } else g.rect(x - 4, y - 4, 8, 8);
        g.fill();
      }
    }, 256, [1, 1]),

  plain: ([a]) =>
    tex((g, s) => {
      g.fillStyle = a;
      g.fillRect(0, 0, s, s);
      noiseDots(g, s, 800, 'rgba(0,0,0,0.05)', 2);
    }, 64, [1, 1]),
};

function shade(hex, amt) {
  const c = new THREE.Color(hex);
  const hsl = {};
  c.getHSL(hsl);
  c.setHSL(hsl.h, hsl.s, Math.min(1, Math.max(0, hsl.l + amt / 100)));
  return `#${c.getHexString()}`;
}
