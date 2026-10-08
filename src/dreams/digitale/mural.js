import * as THREE from 'three';
import { glowTexture } from '../../core/textures.js';
import { drawForm, drawSilhouette } from './fight.js';
import { FORMS, formUnlocked, formData } from './chiavetta.js';

// Il murale gigantesco: tutte le entità dipinte a spray su una parete, e ai
// suoi piedi una fessura dove infilare la chiavetta. Quelle di cui non hai
// ancora abbastanza dati sono sagome scure; quella nella chiavetta brilla.
const CW = 1024;
const CH = 960;

function paint(c, data) {
  const g = c.getContext('2d');
  g.imageSmoothingEnabled = false;
  // il muro dipinto: un fondo notturno con nuvole di spray
  const bg = g.createLinearGradient(0, 0, 0, CH);
  bg.addColorStop(0, '#120828');
  bg.addColorStop(0.6, '#1a0a3a');
  bg.addColorStop(1, '#08141e');
  g.fillStyle = bg;
  g.fillRect(0, 0, CW, CH);
  const rand = (() => {
    let s = 7;
    return () => ((s = (s * 16807) % 2147483647) / 2147483647);
  })();
  for (let i = 0; i < 26; i++) {
    const x = rand() * CW;
    const y = rand() * CH;
    const r = 60 + rand() * 180;
    const col = ['255,58,216', '58,240,255', '160,90,255', '255,228,42'][i % 4];
    const sp = g.createRadialGradient(x, y, 0, x, y, r);
    sp.addColorStop(0, `rgba(${col},0.22)`);
    sp.addColorStop(1, `rgba(${col},0)`);
    g.fillStyle = sp;
    g.fillRect(x - r, y - r, r * 2, r * 2);
  }
  // colature di vernice
  for (let i = 0; i < 40; i++) {
    g.fillStyle = ['rgba(255,58,216,0.5)', 'rgba(58,240,255,0.45)', 'rgba(255,228,42,0.4)'][i % 3];
    const x = rand() * CW;
    g.fillRect(x, rand() * CH * 0.3, 3, 40 + rand() * 160);
  }
  // pixel sparsi, come stelle
  for (let i = 0; i < 300; i++) {
    g.fillStyle = `rgba(255,255,255,${0.1 + rand() * 0.4})`;
    g.fillRect(rand() * CW, rand() * CH, 4, 4);
  }
  // il titolo, a spray
  g.save();
  g.translate(CW / 2, 92);
  g.rotate(-0.03);
  g.font = '900 86px Inter, sans-serif';
  g.textAlign = 'center';
  g.lineWidth = 14;
  g.strokeStyle = '#0a0418';
  g.strokeText('LE ENTITÀ', 0, 0);
  g.fillStyle = '#ff3ad8';
  g.fillText('LE ENTITÀ', 0, 0);
  g.font = '700 30px Inter, sans-serif';
  g.fillStyle = '#7af8ff';
  g.fillText('infila la chiavetta · scegli chi ci abita', 0, 48);
  g.restore();

  // le entità: quattro in alto, poi file da tre
  const rows = [FORMS.slice(0, 4), FORMS.slice(4, 7), FORMS.slice(7, 10)].filter((r) => r.length);
  const rowH = rows.length > 2 ? 245 : 320;
  rows.forEach((row, r) => {
    const cell = 230;
    const x0 = (CW - cell * row.length) / 2;
    const base = (rows.length > 2 ? 345 : 470) + r * rowH;
    row.forEach((fm, i) => {
      const cx = x0 + i * cell + cell / 2;
      const open = formUnlocked(data, fm.id);
      const active = data.form === fm.id;
      if (active) {
        // l'entità nella chiavetta: cornice dorata che brilla
        const gl = g.createRadialGradient(cx, base - 110, 10, cx, base - 110, 150);
        gl.addColorStop(0, 'rgba(255,228,42,0.35)');
        gl.addColorStop(1, 'rgba(255,228,42,0)');
        g.fillStyle = gl;
        g.fillRect(cx - 150, base - rowH + 60, 300, rowH - 20);
        g.strokeStyle = '#ffe42a';
        g.lineWidth = 6;
        g.strokeRect(cx - 100, base - rowH + 80, 200, rowH - 58);
      }
      const sc = Math.min(6.5, (rowH - 120) / fm.h, 190 / fm.w);
      g.save();
      g.translate(cx, base);
      g.scale(sc, sc);
      if (open) drawForm(g, fm.id, 0, 0, i % 2 ? -1 : 1, 0.5 + i);
      else drawSilhouette(g, fm.id, 0, 0, 1, 0.5);
      g.restore();
      g.textAlign = 'center';
      g.font = '800 30px Inter, sans-serif';
      g.lineWidth = 8;
      g.strokeStyle = '#0a0418';
      const label = open ? fm.name : '???';
      g.strokeText(label, cx, base + 46);
      g.fillStyle = open ? (active ? '#ffe42a' : '#ffffff') : '#6a6a8a';
      g.fillText(label, cx, base + 46);
      g.font = '600 20px Inter, sans-serif';
      g.fillStyle = active ? '#ffe42a' : open ? '#7af8ff' : '#8a7aa8';
      g.fillText(active ? 'NELLA CHIAVETTA' : open ? '' : `dati ${Math.min(formData(data, fm.id), fm.need)}/${fm.need}`, cx, base + 70);
    });
  });
  // la freccia verso la fessura
  g.fillStyle = '#4aff8a';
  g.font = '800 26px Inter, sans-serif';
  g.textAlign = 'center';
  g.fillText('▼ INFILA QUI ▼', CW / 2, CH - 22);
}

export function buildMural(scene, { x, z, w, h, y0 = 0.4 }) {
  const disposables = [];
  const track = (o) => (disposables.push(o), o);
  const g = new THREE.Group();
  scene.add(g);
  const c = document.createElement('canvas');
  c.width = CW;
  c.height = CH;
  const tex = track(new THREE.CanvasTexture(c));
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  const wall = new THREE.Mesh(track(new THREE.PlaneGeometry(w, h)), track(new THREE.MeshBasicMaterial({ map: tex })));
  wall.position.set(x, y0 + h / 2, z - 0.06);
  wall.rotation.y = Math.PI;
  g.add(wall);
  const glow = track(glowTexture('rgba(255,255,255,1)'));
  for (const dx of [-w / 3, 0, w / 3]) {
    const s = new THREE.Sprite(track(new THREE.SpriteMaterial({ map: glow, color: '#ff9ae8', blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0.25 })));
    s.position.set(x + dx, y0 + h + 0.2, z - 0.8);
    s.scale.set(7, 3, 1);
    g.add(s);
  }
  // il piedistallo con la fessura per la chiavetta
  const M = (color, o = {}) => track(new THREE.MeshStandardMaterial({ color, roughness: 0.4, ...o }));
  const ped = new THREE.Mesh(track(new THREE.BoxGeometry(1.4, 1.1, 0.9)), M('#1a1a26', { metalness: 0.5 }));
  ped.position.set(x, 0.55, z - 2.2);
  g.add(ped);
  const slotMat = track(new THREE.MeshBasicMaterial({ color: '#4aff8a' }));
  const slot = new THREE.Mesh(track(new THREE.BoxGeometry(0.34, 0.1, 0.06)), slotMat);
  slot.position.set(x, 0.95, z - 2.66);
  g.add(slot);
  const halo = new THREE.Sprite(track(new THREE.SpriteMaterial({ map: glow, color: '#4aff8a', blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0.6 })));
  halo.position.set(x, 1.0, z - 2.9);
  halo.scale.set(1.8, 1.2, 1);
  g.add(halo);
  return {
    spot: new THREE.Vector3(x, 0, z - 3.8),
    collider: { minX: x - 0.8, maxX: x + 0.8, minZ: z - 2.7, maxZ: z - 1.7 },
    refresh(data) {
      paint(c, data);
      tex.needsUpdate = true;
    },
    update(t) {
      halo.material.opacity = 0.45 + Math.sin(t * 4) * 0.2;
      slotMat.color.setHSL(0.36, 1, 0.5 + Math.sin(t * 4) * 0.15);
    },
    dispose() {
      disposables.forEach((d) => d.dispose());
      g.removeFromParent();
    },
  };
}
