import * as THREE from 'three';
import { textTexture } from '../../core/textures.js';

export const MAX_FLOOR = 500;
export const ARCADE_FLOOR = 88;

// Piani con un nome: compaiono nel pannello dell'ascensore.
export const KNOWN_FLOORS = [
  { floor: 0, name: 'Piano terra', note: 'La hall, il labirinto di stanze, la suite 1313' },
  { floor: ARCADE_FLOOR, name: 'Sala giochi', note: 'Un piano intero. Forse più di uno.' },
];

// Porte d'ascensore in ottone, con l'indicatore del piano sopra.
// (x, z) locali alla stanza; `facing` è la direzione verso cui si esce.
export function buildElevatorDoors(a, x, z, facing, label) {
  const brass = a.mat('#c8a050', { metal: true });
  const dark = a.mat('#2a2218');
  const g = new THREE.Group();
  const along = Math.abs(Math.sin(facing)) > 0.5; // porte sulla parete est/ovest
  const place = (w, h, d, mat, ox, y, oz, opts = {}) => {
    if (along) return a.box(d, h, w, mat, x + oz * Math.sign(Math.sin(facing)), y, z + ox, opts);
    return a.box(w, h, d, mat, x + ox, y, z + oz * Math.sign(Math.cos(facing)), opts);
  };
  place(3.4, 0.3, 0.3, brass, 0, 3.35, 0.1, { collide: false });
  place(0.3, 3.5, 0.3, brass, -1.6, 1.75, 0.1, { collide: false });
  place(0.3, 3.5, 0.3, brass, 1.6, 1.75, 0.1, { collide: false });
  place(1.45, 3.2, 0.08, brass, -0.74, 1.6, 0.02, { collide: false });
  place(1.45, 3.2, 0.08, brass, 0.74, 1.6, 0.02, { collide: false });
  place(0.04, 3.2, 0.1, dark, 0, 1.6, 0.03, { collide: false });
  // indicatore luminoso con il numero del piano
  const tex = a.track(textTexture(label, { width: 256, height: 96, font: '700 64px Inter, sans-serif', color: '#ffb84a', glow: '#ff8a1a', bg: '#140c04' }));
  const m = a.track(new THREE.MeshBasicMaterial({ map: tex }));
  const plate = new THREE.Mesh(a.track(new THREE.PlaneGeometry(1.2, 0.45)), m);
  const wx = a.cx + x + (along ? 0.12 * Math.sign(Math.sin(facing)) : 0);
  const wz = a.cz + z + (along ? 0 : 0.12 * Math.sign(Math.cos(facing)));
  plate.position.set(wx, 3.85, wz);
  plate.rotation.y = facing;
  g.add(plate);
  a.dynamicAdd(g);
  // punto in cui stare per chiamare l'ascensore, e da cui si esce
  const out = 3;
  return {
    spot: new THREE.Vector3(a.cx + x + Math.sin(facing) * out, 0, a.cz + z + Math.cos(facing) * out),
    facing,
  };
}

// Il pannello dell'ascensore: piani con un nome, numero a scelta, un piano a caso.
export class ElevatorPanel {
  constructor() {
    this.el = document.getElementById('elevator');
    this.input = '';
    this.onChoose = null;
    this.open = false;
    this.el.addEventListener('click', (e) => {
      const b = e.target.closest('[data-floor]');
      if (b) this.choose(Number(b.dataset.floor));
      if (e.target.closest('[data-close]')) this.close();
      if (e.target.closest('[data-random]')) this.choose(randomFloor());
      if (e.target.closest('[data-go]') && this.input) this.choose(Number(this.input));
    });
  }

  show(current, onChoose) {
    this.open = true;
    this.input = '';
    this.onChoose = onChoose;
    const known = KNOWN_FLOORS.map(
      (k) => `<button class="floor-btn${k.floor === current ? ' here' : ''}" data-floor="${k.floor}">
        <b>${k.floor === 0 ? 'T' : k.floor}</b><span>${k.name}<small>${k.note}</small></span></button>`,
    ).join('');
    this.el.innerHTML = `<div class="elev-panel">
      <div class="elev-display"><span id="elev-now">${label(current)}</span></div>
      <p class="elev-title">Scegli un piano</p>
      <div class="floor-list">${known}</div>
      <div class="elev-row">
        <div class="elev-input">Piano <span id="elev-typed">_</span> <small>(1–${MAX_FLOOR}, digita il numero)</small></div>
        <button data-go>Vai</button>
      </div>
      <div class="elev-row">
        <button data-random class="ghost">Un piano a caso</button>
        <button data-close class="ghost">Resta qui</button>
      </div>
      <p class="elev-keys"><kbd>0</kbd>–<kbd>9</kbd> digita · <kbd>Invio</kbd> vai · <kbd>T</kbd> piano terra · <kbd>C</kbd> a caso · <kbd>Esc</kbd> resta</p>
    </div>`;
    this.el.classList.add('show');
  }

  // Tastiera: letta ogni frame dal gioco.
  handleKeys(input) {
    if (!this.open) return;
    for (let d = 0; d <= 9; d++) {
      if (input.wasPressed(`Digit${d}`, `Numpad${d}`) && this.input.length < 3) this.input += String(d);
    }
    if (input.wasPressed('Backspace')) this.input = this.input.slice(0, -1);
    const typed = document.getElementById('elev-typed');
    if (typed) typed.textContent = this.input || '_';
    if (input.wasPressed('Enter', 'NumpadEnter') && this.input) this.choose(Number(this.input));
    else if (input.wasPressed('KeyT')) this.choose(0);
    else if (input.wasPressed('KeyC')) this.choose(randomFloor());
    else if (input.wasPressed('Escape', 'KeyQ')) this.close();
  }

  choose(f) {
    const floor = Math.max(0, Math.min(MAX_FLOOR, Math.round(f) || 0));
    const cb = this.onChoose;
    this.close();
    cb?.(floor);
  }

  close() {
    this.open = false;
    this.el.classList.remove('show');
    this.onChoose = null;
  }
}

export function label(f) {
  return f === 0 ? 'T' : String(f);
}

function randomFloor() {
  return 1 + Math.floor(Math.random() * MAX_FLOOR);
}

// Durante la corsa il display impazzisce: numeri giusti, poi numeri impossibili.
export function rideSequence(from, to) {
  const seq = [];
  const steps = 14;
  for (let i = 1; i <= steps; i++) {
    const t = i / steps;
    let v = Math.round(from + (to - from) * t * t);
    if (i === 6 && Math.random() < 0.6) v = ['∞', '-7', '13½', '???', '0.5', '404'][Math.floor(Math.random() * 6)];
    seq.push(typeof v === 'number' ? label(v) : v);
  }
  seq.push(label(to));
  return seq;
}
