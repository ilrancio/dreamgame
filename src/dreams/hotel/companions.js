import * as THREE from 'three';
import { gnomeGeometry } from './gnomes.js';
import { X0, Z0, NW, NH } from './layout.js';

// Le creature dei sogni: le entità che hai battuto diventano statuette nella
// vetrina della suite. Ne scegli una e ti segue ovunque. Pura compagnia.
export const ENTITIES = [
  {
    id: 'gnomi',
    tiers: [10, 25, 50, 100], // ogni mattina che liberi la hall, il gruppo cresce
    name: (n) => `${n} gnomi`,
    origin: 'Gli gnomi della hall',
    hint: 'Liberali dalla hall, al mattino',
  },
];

// Sagome ancora scure nella vetrina: creature di sogni non ancora sognati.
export const UNKNOWN_SLOTS = 3;

export function entityLabel(id, level) {
  const e = ENTITIES.find((q) => q.id === id);
  return e ? e.name(level) : id;
}

// Un gruppo di gnomi amici che ti trotterella dietro in fila.
// Quando sei nella suite e ti fermi, vanno a sedersi in semicerchio davanti al camino.
export class GnomeFollowers {
  constructor(scene, count) {
    this.max = 100;
    this.count = Math.min(count, this.max);
    this.geo = gnomeGeometry('#2a7ad8', '#e8b83a');
    this.material = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.8 });
    this.mesh = new THREE.InstancedMesh(this.geo, this.material, this.max);
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.mesh.frustumCulled = false;
    this.mesh.count = this.count;
    scene.add(this.mesh);
    const n = this.max;
    this.x = new Float32Array(n);
    this.z = new Float32Array(n);
    this.y = new Float32Array(n);
    this.vy = new Float32Array(n);
    this.yaw = new Float32Array(n);
    this.phase = new Float32Array(n);
    this.scale = new Float32Array(n);
    this.jx = new Float32Array(n);
    this.jz = new Float32Array(n);
    this.idleT = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      this.phase[i] = Math.random() * 10;
      this.scale[i] = 0.85 + Math.random() * 0.35;
      this.jx[i] = (Math.random() - 0.5) * 0.25;
      this.jz[i] = (Math.random() - 0.5) * 0.25;
      this.idleT[i] = Math.random() * 4;
    }
    this.placed = false;
    this.ground = null; // all'aperto: altezza del terreno sotto ogni gnomo
  }

  setCount(n) {
    this.count = Math.min(n, this.max);
    this.mesh.count = this.count;
  }

  // dove dovrebbe stare lo gnomo i
  slot(i, leader, mode, spot) {
    if (mode === 'gather') {
      // semicerchio davanti al punto (il camino), a più file se sono tanti
      const perRow = 9;
      const row = Math.floor(i / perRow);
      const k = i % perRow;
      const a = (k / (perRow - 1) - 0.5) * Math.PI * 0.9;
      const r = 1.1 + row * 0.45;
      return [spot.x + Math.cos(spot.facing + a) * r + this.jx[i], spot.z + Math.sin(spot.facing + a) * r + this.jz[i]];
    }
    // in fila dietro di te, cinque per riga
    const perRow = 5;
    const row = Math.floor(i / perRow);
    const col = (i % perRow) - (perRow - 1) / 2;
    const fx = Math.sin(leader.facing);
    const fz = Math.cos(leader.facing);
    const back = 1.5 + row * 0.42;
    return [leader.pos.x - fx * back + fz * col * 0.36 + this.jx[i], leader.pos.z - fz * back - fx * col * 0.36 + this.jz[i]];
  }

  // blocked: la griglia di un piano dell'hotel, oppure (all'aperto) una funzione
  blockedAt(blocked, x, z) {
    if (typeof blocked === 'function') return blocked(x, z);
    const i = Math.floor(x - X0);
    const j = Math.floor(z - Z0);
    if (i < 0 || i >= NW || j < 0 || j >= NH) return true;
    return blocked[j * NW + i] === 1;
  }

  update(dt, t, leader, blocked, mode = 'follow', spot = null) {
    const mat = this.mesh.instanceMatrix.array;
    for (let i = 0; i < this.count; i++) {
      const [tx, tz] = this.slot(i, leader, mode, spot);
      let dx = tx - this.x[i];
      let dz = tz - this.z[i];
      let d = Math.hypot(dx, dz);
      // troppo lontano (un altro piano, un'altra stanza): il sogno lo riporta qui
      if (!this.placed || d > 14) {
        this.x[i] = tx + (Math.random() - 0.5) * 0.5;
        this.z[i] = tz + (Math.random() - 0.5) * 0.5;
        dx = dz = 0;
        d = 0;
      }
      const moving = d > 0.12;
      if (moving) {
        const sp = Math.min(7.5, 1.6 + d * 2.6);
        let nx = this.x[i] + (dx / d) * sp * dt;
        let nz = this.z[i] + (dz / d) * sp * dt;
        if (this.blockedAt(blocked, nx, nz)) {
          if (!this.blockedAt(blocked, nx, this.z[i])) nz = this.z[i];
          else if (!this.blockedAt(blocked, this.x[i], nz)) nx = this.x[i];
        }
        this.x[i] = nx;
        this.z[i] = nz;
        this.yaw[i] = Math.atan2(dx, dz);
        this.phase[i] += dt * sp * 6;
        this.y[i] = Math.abs(Math.sin(this.phase[i])) * 0.07;
      } else {
        // fermi: si guardano intorno, ogni tanto un saltello di gioia
        const look = mode === 'gather' && spot ? Math.atan2(spot.x - this.x[i], spot.z - this.z[i]) : Math.atan2(leader.pos.x - this.x[i], leader.pos.z - this.z[i]);
        this.yaw[i] += (look + Math.sin(t * 0.7 + i) * 0.4 - this.yaw[i]) * Math.min(1, dt * 3);
        this.idleT[i] -= dt;
        if (this.idleT[i] <= 0 && this.y[i] <= 0) {
          this.vy[i] = 2.2 + Math.random();
          this.idleT[i] = 3 + Math.random() * 6;
        }
        this.vy[i] -= 14 * dt;
        this.y[i] = Math.max(0, this.y[i] + this.vy[i] * dt);
        if (this.y[i] === 0) this.vy[i] = 0;
      }
      const sc = this.scale[i];
      const c = Math.cos(this.yaw[i]) * sc;
      const sn = Math.sin(this.yaw[i]) * sc;
      const o = i * 16;
      mat[o] = c;
      mat[o + 1] = 0;
      mat[o + 2] = -sn;
      mat[o + 3] = 0;
      mat[o + 4] = 0;
      mat[o + 5] = sc;
      mat[o + 6] = 0;
      mat[o + 7] = 0;
      mat[o + 8] = sn;
      mat[o + 9] = 0;
      mat[o + 10] = c;
      mat[o + 11] = 0;
      mat[o + 12] = this.x[i];
      mat[o + 13] = this.y[i] + (this.ground ? this.ground(this.x[i], this.z[i]) : 0);
      mat[o + 14] = this.z[i];
      mat[o + 15] = 1;
    }
    this.placed = true;
    this.mesh.instanceMatrix.needsUpdate = true;
  }

  dispose() {
    this.geo.dispose();
    this.material.dispose();
    this.mesh.dispose();
    this.mesh.removeFromParent();
  }
}
