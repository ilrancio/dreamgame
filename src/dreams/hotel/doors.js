import * as THREE from 'three';
import { X0, Z0, NW, NH, DOOR_H } from './layout.js';

// Porte con il battente. Si aprono da sole quando qualcuno si avvicina
// (come in un albergo dove il personale le tiene aperte per te) e si
// richiudono alle spalle. Le porte della suite si possono chiudere a chiave:
// chiuse a chiave non si aprono per nessuno, e bloccano anche gli gnomi.
const STYLE = {
  door: { color: '#5a3420', knob: '#c8a050' },
  suite: { color: '#3a1a10', knob: '#e8c060' },
  service: { color: '#4a4034', knob: '#a8a8a8' },
  bath: { color: '#e8e0d0', knob: '#c8c8c8' },
};

export class DoorSystem {
  constructor(rb, layout) {
    this.layout = layout;
    this.list = [];
    const plank = rb.track(new THREE.BoxGeometry(1, 1, 1));
    const knobGeo = rb.track(new THREE.SphereGeometry(0.05, 8, 6));
    for (const d of layout.doors ?? []) {
      const st = STYLE[d.kind] || STYLE.door;
      const mat = rb.mat(st.color);
      const knobMat = rb.mat(st.knob, { metal: true });
      const w = d.width - 0.08;
      const h = DOOR_H - 0.06;
      // il battente ruota attorno al cardine, a un'estremità dell'apertura
      const pivot = new THREE.Group();
      const hingeAlong = d.from + 0.04;
      if (d.axis === 'x') pivot.position.set(d.coord, 0, hingeAlong);
      else pivot.position.set(hingeAlong, 0, d.coord);
      const leaf = new THREE.Mesh(plank, mat);
      if (d.axis === 'x') {
        leaf.scale.set(0.08, h, w);
        leaf.position.set(0, h / 2, w / 2);
      } else {
        leaf.scale.set(w, h, 0.08);
        leaf.position.set(w / 2, h / 2, 0);
      }
      pivot.add(leaf);
      for (const side of [-1, 1]) {
        const k = new THREE.Mesh(knobGeo, knobMat);
        if (d.axis === 'x') k.position.set(side * 0.08, 1.05, w - 0.15);
        else k.position.set(w - 0.15, 1.05, side * 0.08);
        pivot.add(k);
      }
      rb.dynamic.add(pivot);
      // verso di apertura: verso l'interno della stanza (l'ambiente `a`)
      const rb2 = layout.rooms[d.a];
      let sign = 1;
      if (rb2) {
        const toward = d.axis === 'x' ? Math.sign(rb2.cx - d.coord) : Math.sign(rb2.cz - d.coord);
        sign = d.axis === 'x' ? toward : -toward;
      }
      this.list.push({
        ...d,
        pivot,
        sign,
        open: 0,
        target: 0,
        locked: d.kind === 'service', // la porta di servizio è chiusa... dall'altra parte
        auto: d.kind !== 'service',
        cells: this.cellsOf(d),
      });
    }
    this.applyNav();
  }

  cellsOf(d) {
    const cells = [];
    for (let t = d.from; t < d.to; t += 0.5) {
      const x = d.axis === 'x' ? d.coord : t;
      const z = d.axis === 'z' ? d.coord : t;
      for (const o of [-0.3, 0.3]) {
        const i = Math.floor((d.axis === 'x' ? x + o : x) - X0);
        const j = Math.floor((d.axis === 'z' ? z + o : z) - Z0);
        if (i >= 0 && i < NW && j >= 0 && j < NH) cells.push(j * NW + i);
      }
    }
    return [...new Set(cells)];
  }

  // Le porte chiuse a chiave sono muri anche per la navigazione.
  applyNav() {
    const B = this.layout.blocked;
    for (const d of this.list) {
      if (!d.baseSaved) {
        d.base = d.cells.map((k) => B[k]);
        d.baseSaved = true;
      }
      d.cells.forEach((k, n) => (B[k] = d.locked ? 1 : d.base[n]));
    }
  }

  setLocked(d, v) {
    d.locked = v;
    if (v) d.target = 0;
    this.applyNav();
  }

  // actors: posizioni di chi può far aprire le porte
  update(dt, actors) {
    for (const d of this.list) {
      if (d.locked) d.target = 0;
      else if (d.auto) {
        let near = Infinity;
        for (const p of actors) near = Math.min(near, Math.hypot(p.x - d.x, p.z - d.z));
        if (near < 2.4) d.target = 1;
        else if (near > 3.4) d.target = 0;
      }
      const prev = d.open;
      d.open += Math.sign(d.target - d.open) * Math.min(Math.abs(d.target - d.open), dt * 2.2);
      if (prev !== d.open) {
        const e = d.open * d.open * (3 - 2 * d.open);
        d.pivot.rotation.y = d.sign * e * (Math.PI / 2) * 0.95;
      }
    }
  }

  // Porta più vicina entro un raggio.
  nearest(x, z, r = 2) {
    let best = null;
    let bd = r;
    for (const d of this.list) {
      const dd = Math.hypot(x - d.x, z - d.z);
      if (dd < bd) {
        bd = dd;
        best = d;
      }
    }
    return best;
  }

  // Rettangoli di collisione delle porte chiuse a chiave.
  lockedBoxes() {
    const out = [];
    for (const d of this.list) {
      if (!d.locked || d.open > 0.2) continue;
      if (d.axis === 'x') out.push({ minX: d.coord - 0.1, maxX: d.coord + 0.1, minZ: d.from, maxZ: d.to });
      else out.push({ minX: d.from, maxX: d.to, minZ: d.coord - 0.1, maxZ: d.coord + 0.1 });
    }
    return out;
  }
}
