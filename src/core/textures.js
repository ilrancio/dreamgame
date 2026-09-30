import * as THREE from 'three';

// Texture generate al volo su canvas: niente asset esterni.

function canvasTexture(w, h, draw, { repeat = false, srgb = true } = {}) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 4;
  return t;
}

export function glowTexture(inner = 'rgba(255,255,255,1)', outer = 'rgba(255,255,255,0)') {
  return canvasTexture(128, 128, (g, w, h) => {
    const grd = g.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
    grd.addColorStop(0, inner);
    grd.addColorStop(0.25, inner.replace(/[\d.]+\)$/, '0.5)'));
    grd.addColorStop(1, outer);
    g.fillStyle = grd;
    g.fillRect(0, 0, w, h);
  });
}

export function textTexture(text, { width = 1024, height = 256, font = '700 120px Cormorant Garamond, serif', color = '#fff', glow = null, bg = null } = {}) {
  return canvasTexture(width, height, (g, w, h) => {
    if (bg) {
      g.fillStyle = bg;
      g.fillRect(0, 0, w, h);
    }
    g.font = font;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    if (glow) {
      g.shadowColor = glow;
      g.shadowBlur = 30;
    }
    g.fillStyle = color;
    const lines = String(text).split('\n');
    const lh = h / (lines.length + 0.3);
    lines.forEach((ln, i) => g.fillText(ln, w / 2, h / 2 + (i - (lines.length - 1) / 2) * lh));
  });
}

export function woodLogTexture() {
  return canvasTexture(512, 512, (g, w, h) => {
    const bands = 12;
    const bh = h / bands;
    for (let b = 0; b < bands; b++) {
      const y = b * bh;
      const base = 95 + Math.random() * 25;
      const grd = g.createLinearGradient(0, y, 0, y + bh);
      grd.addColorStop(0, `rgb(${base * 0.55},${base * 0.33},${base * 0.18})`);
      grd.addColorStop(0.35, `rgb(${base * 1.25},${base * 0.8},${base * 0.45})`);
      grd.addColorStop(0.8, `rgb(${base * 0.95},${base * 0.58},${base * 0.3})`);
      grd.addColorStop(1, `rgb(${base * 0.35},${base * 0.2},${base * 0.1})`);
      g.fillStyle = grd;
      g.fillRect(0, y, w, bh);
      g.strokeStyle = 'rgba(40,20,8,0.25)';
      for (let k = 0; k < 6; k++) {
        g.beginPath();
        const yy = y + 4 + Math.random() * (bh - 8);
        g.moveTo(0, yy);
        for (let x = 0; x <= w; x += 32) g.lineTo(x, yy + Math.sin(x * 0.02 + k) * 2);
        g.stroke();
      }
      // nodi del legno
      for (let k = 0; k < 2; k++) {
        g.fillStyle = 'rgba(50,25,10,0.5)';
        g.beginPath();
        g.ellipse(Math.random() * w, y + bh / 2, 6 + Math.random() * 6, 3, 0, 0, Math.PI * 2);
        g.fill();
      }
    }
  }, { repeat: true });
}

export function shingleTexture() {
  return canvasTexture(256, 256, (g, w, h) => {
    g.fillStyle = '#2b1a14';
    g.fillRect(0, 0, w, h);
    const rows = 8;
    const rh = h / rows;
    for (let r = 0; r < rows; r++) {
      const off = (r % 2) * 16;
      for (let x = -32; x < w; x += 32) {
        const v = 40 + Math.random() * 25;
        g.fillStyle = `rgb(${v},${v * 0.6},${v * 0.45})`;
        g.fillRect(x + off + 1, r * rh + 1, 30, rh - 2);
      }
    }
  }, { repeat: true });
}

export function asphaltTexture() {
  return canvasTexture(128, 512, (g, w, h) => {
    g.fillStyle = '#34343a';
    g.fillRect(0, 0, w, h);
    for (let i = 0; i < 3000; i++) {
      const v = 40 + Math.random() * 40;
      g.fillStyle = `rgb(${v},${v},${v + 4})`;
      g.fillRect(Math.random() * w, Math.random() * h, 1.5, 1.5);
    }
    g.fillStyle = '#d8d2c0';
    g.fillRect(4, 0, 3, h);
    g.fillRect(w - 7, 0, 3, h);
    g.fillStyle = '#e8c24a';
    g.fillRect(w / 2 - 2, 0, 4, h * 0.55);
  }, { repeat: true });
}

export function lavaCrackTexture() {
  return canvasTexture(512, 512, (g, w, h) => {
    g.fillStyle = '#000';
    g.fillRect(0, 0, w, h);
    g.lineCap = 'round';
    for (let k = 0; k < 40; k++) {
      let x = Math.random() * w;
      let y = Math.random() * h;
      g.strokeStyle = `rgba(255,${80 + Math.random() * 90},20,${0.6 + Math.random() * 0.4})`;
      g.lineWidth = 1 + Math.random() * 3;
      g.beginPath();
      g.moveTo(x, y);
      let a = Math.random() * Math.PI * 2;
      for (let s = 0; s < 12; s++) {
        a += (Math.random() - 0.5) * 1.3;
        x += Math.cos(a) * 18;
        y += Math.sin(a) * 18;
        g.lineTo(x, y);
      }
      g.stroke();
    }
  }, { repeat: true });
}
