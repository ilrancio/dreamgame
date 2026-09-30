import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { X0, Z0, NW, NH } from './layout.js';

const INACTIVE = 0;
const RUN = 1;
const CLING = 2;
const FLY = 3;
const WAIT = 4; // appena comparsi: esitano un attimo
const FALL = 5; // si lanciano dalle balconate della hall

function colored(geo, color) {
  const g = geo.index ? geo.toNonIndexed() : geo;
  const c = new THREE.Color(color);
  const arr = new Float32Array(g.attributes.position.count * 3);
  for (let i = 0; i < arr.length; i += 3) {
    arr[i] = c.r;
    arr[i + 1] = c.g;
    arr[i + 2] = c.b;
  }
  g.setAttribute('color', new THREE.BufferAttribute(arr, 3));
  for (const n of Object.keys(g.attributes)) if (!['position', 'normal', 'color'].includes(n)) g.deleteAttribute(n);
  return g;
}

// Uno gnomo alto ~32 cm: cappello rosso, barba bianca, giacca colorata.
function gnomeGeometry() {
  const parts = [];
  const add = (geo, color, x, y, z) => {
    geo.translate(x, y, z);
    parts.push(colored(geo, color));
  };
  add(new THREE.CylinderGeometry(0.07, 0.09, 0.13, 7), '#3a5ac8', 0, 0.085, 0); // giacca
  add(new THREE.SphereGeometry(0.055, 8, 6), '#f0c0a0', 0, 0.19, 0); // faccia
  add(new THREE.ConeGeometry(0.05, 0.08, 7), '#f4f4f0', 0, 0.15, 0.03); // barba
  add(new THREE.ConeGeometry(0.065, 0.14, 7), '#d82a2a', 0, 0.28, 0); // cappello
  add(new THREE.SphereGeometry(0.012, 5, 4), '#111', 0.02, 0.2, 0.05);
  add(new THREE.SphereGeometry(0.012, 5, 4), '#111', -0.02, 0.2, 0.05);
  add(new THREE.SphereGeometry(0.018, 6, 4), '#ff9a8a', 0, 0.185, 0.055); // naso
  add(new THREE.BoxGeometry(0.04, 0.03, 0.06), '#3a2a1a', 0.035, 0.015, 0.01);
  add(new THREE.BoxGeometry(0.04, 0.03, 0.06), '#3a2a1a', -0.035, 0.015, 0.01);
  const g = mergeGeometries(parts);
  parts.forEach((p) => p.dispose());
  return g;
}

export class GnomeSwarm {
  constructor(scene, blocked, max = 2600) {
    this.max = max;
    this.blocked = blocked;
    this.x = new Float32Array(max);
    this.y = new Float32Array(max);
    this.z = new Float32Array(max);
    this.vx = new Float32Array(max);
    this.vy = new Float32Array(max);
    this.vz = new Float32Array(max);
    this.yaw = new Float32Array(max);
    this.spin = new Float32Array(max);
    this.speed = new Float32Array(max);
    this.phase = new Float32Array(max);
    this.timer = new Float32Array(max);
    this.lane = new Float32Array(max);
    this.state = new Uint8Array(max);
    this.target = new Uint8Array(max); // 0 = tu, 1 = amico
    this.clingA = new Float32Array(max);
    this.clingH = new Float32Array(max);
    this.scale = new Float32Array(max);
    this.free = [];
    for (let i = max - 1; i >= 0; i--) this.free.push(i);
    this.active = 0;
    this.clinging = [0, 0];

    this.geo = gnomeGeometry();
    this.material = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.8 });
    this.mesh = new THREE.InstancedMesh(this.geo, this.material, max);
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.mesh.frustumCulled = false;
    const tint = new THREE.Color();
    const coats = ['#ffffff', '#b8ffb8', '#ffe0a0', '#ffc0ff', '#c0e0ff', '#ffffff'];
    for (let i = 0; i < max; i++) {
      tint.set(coats[i % coats.length]).multiplyScalar(0.85 + Math.random() * 0.3);
      this.mesh.setColorAt(i, tint);
    }
    this.mesh.instanceColor.needsUpdate = true;
    const zero = new THREE.Matrix4().makeScale(0, 0, 0);
    for (let i = 0; i < max; i++) this.mesh.setMatrixAt(i, zero);
    scene.add(this.mesh);
    this.dummy = new THREE.Object3D();
  }

  isBlocked(x, z) {
    const i = Math.floor(x - X0);
    const j = Math.floor(z - Z0);
    if (i < 0 || i >= NW || j < 0 || j >= NH) return true;
    return this.blocked[j * NW + i] === 1;
  }

  spawn(x, z, targetFriend = false) {
    if (!this.free.length) return -1;
    const i = this.free.pop();
    this.x[i] = x;
    this.z[i] = z;
    this.y[i] = 0;
    this.vx[i] = this.vz[i] = this.vy[i] = 0;
    this.state[i] = WAIT;
    this.timer[i] = Math.random() * 0.8;
    this.speed[i] = 2.6 + Math.random() * 2.2;
    this.phase[i] = Math.random() * 10;
    this.lane[i] = (Math.random() - 0.5) * 1.6;
    this.target[i] = targetFriend ? 1 : 0;
    this.scale[i] = 0.8 + Math.random() * 0.5;
    this.active++;
    return i;
  }

  // Uno gnomo che salta giù da una balconata: atterra e comincia a correre.
  spawnFalling(x, y, z, vx, vz) {
    const i = this.spawn(x, z);
    if (i < 0) return -1;
    this.state[i] = FALL;
    this.y[i] = y;
    this.vx[i] = vx;
    this.vz[i] = vz;
    this.vy[i] = 1 + Math.random() * 2;
    return i;
  }

  eliminate(i) {
    if (this.state[i] === CLING) this.clinging[this.target[i]]--;
    this.state[i] = INACTIVE;
    this.free.push(i);
    this.active--;
    // l'aggiornamento salta gli inattivi: azzera subito la matrice
    const m = this.mesh.instanceMatrix.array;
    for (let k = 0; k < 16; k++) m[i * 16 + k] = 0;
    this.mesh.instanceMatrix.needsUpdate = true;
  }

  // Colpo di pistola: raggio dalla canna. Trapassa fino a `pierce` gnomi e,
  // dove il colpo tocca terra, fa un piccolo scoppio. Ritorna le posizioni colpite.
  shoot(ox, oy, oz, dx, dy, dz, maxT, radius = 0.32, pierce = 5, splash = 0.9) {
    const hits = [];
    for (let i = 0; i < this.max; i++) {
      const s = this.state[i];
      if (s !== RUN && s !== WAIT && s !== FALL) continue;
      const px = this.x[i] - ox;
      const py = this.y[i] + 0.15 - oy;
      const pz = this.z[i] - oz;
      const t = px * dx + py * dy + pz * dz;
      if (t < 0 || t > maxT) continue;
      const cx = px - dx * t;
      const cy = py - dy * t;
      const cz = pz - dz * t;
      // tolleranza che cresce con la distanza: i bersagli sono minuscoli
      const r = radius * this.scale[i] * 1.25 + t * 0.022;
      if (cx * cx + cy * cy + cz * cz < r * r) hits.push({ i, t });
    }
    hits.sort((a, b) => a.t - b.t);
    const out = [];
    for (const h of hits.slice(0, pierce)) {
      out.push({ x: this.x[h.i], y: this.y[h.i] + 0.15, z: this.z[h.i] });
      this.eliminate(h.i);
    }
    // scoppio dove il colpo si ferma a terra
    if (splash > 0 && out.length < pierce) {
      const ex = ox + dx * maxT;
      const ez = oz + dz * maxT;
      const ey = oy + dy * maxT;
      if (ey < 0.4) {
        for (let i = 0; i < this.max; i++) {
          const s = this.state[i];
          if (s !== RUN && s !== WAIT) continue;
          const qx = this.x[i] - ex;
          const qz = this.z[i] - ez;
          if (qx * qx + qz * qz < splash * splash) {
            out.push({ x: this.x[i], y: 0.15, z: this.z[i] });
            this.eliminate(i);
          }
        }
      }
    }
    return out;
  }

  // Gnomo più vicino a un punto (per la mira dell'amico).
  nearest(x, z, maxR) {
    let best = -1;
    let bd = maxR * maxR;
    for (let i = 0; i < this.max; i++) {
      const s = this.state[i];
      if (s !== RUN && s !== WAIT) continue;
      const dx = this.x[i] - x;
      const dz = this.z[i] - z;
      const d = dx * dx + dz * dz;
      if (d < bd) {
        bd = d;
        best = i;
      }
    }
    return best;
  }

  launch(i, vx, vy, vz) {
    if (this.state[i] === CLING) this.clinging[this.target[i]]--;
    this.state[i] = FLY;
    this.vx[i] = vx;
    this.vy[i] = vy;
    this.vz[i] = vz;
    this.spin[i] = (Math.random() - 0.5) * 30;
    this.timer[i] = 0;
  }

  // Calcio: cono davanti a chi calcia. Ritorna quanti gnomi sono volati via.
  kick(ox, oz, dirX, dirZ, radius = 2.4, cosHalf = 0.35, power = 11) {
    let n = 0;
    for (let i = 0; i < this.max; i++) {
      const s = this.state[i];
      if (s !== RUN && s !== WAIT) continue;
      const dx = this.x[i] - ox;
      const dz = this.z[i] - oz;
      const d = Math.hypot(dx, dz);
      if (d > radius) continue;
      if (d > 0.3 && (dx * dirX + dz * dirZ) / d < cosHalf) continue;
      const nx = d > 0.01 ? dx / d : dirX;
      const nz = d > 0.01 ? dz / d : dirZ;
      const p = power * (0.7 + Math.random() * 0.6);
      this.launch(i, nx * p * 0.6 + dirX * p * 0.5, 5 + Math.random() * 5, nz * p * 0.6 + dirZ * p * 0.5);
      n++;
    }
    return n;
  }

  // Onda d'urto (atterraggio da un salto): spazza via tutto intorno.
  shockwave(ox, oz, radius = 4.5, power = 12) {
    let n = 0;
    for (let i = 0; i < this.max; i++) {
      const s = this.state[i];
      if (s !== RUN && s !== WAIT) continue;
      const dx = this.x[i] - ox;
      const dz = this.z[i] - oz;
      const d = Math.hypot(dx, dz);
      if (d > radius) continue;
      const f = (1 - d / radius) * power + 3;
      this.launch(i, (dx / (d || 1)) * f, 4 + f * 0.6, (dz / (d || 1)) * f);
      n++;
    }
    return n;
  }

  // Scrolla via gli gnomi aggrappati a un bersaglio (0 tu, 1 amico).
  shakeOff(who, fraction = 1, ox = 0, oz = 0) {
    let n = 0;
    for (let i = 0; i < this.max; i++) {
      if (this.state[i] !== CLING || this.target[i] !== who) continue;
      if (Math.random() > fraction) continue;
      const a = this.clingA[i];
      this.launch(i, Math.cos(a) * 7, 5 + Math.random() * 4, Math.sin(a) * 7);
      n++;
    }
    void ox;
    void oz;
    return n;
  }

  // flows: [campo verso di te, campo verso l'amico]
  update(dt, t, targets, flows, clingMax = 90) {
    const M = this.dummy;
    const mat = this.mesh.instanceMatrix.array;
    let landed = 0;
    for (let i = 0; i < this.max; i++) {
      const s = this.state[i];
      if (s === INACTIVE) continue;
      const tg = targets[this.target[i]];
      if (s === WAIT) {
        this.timer[i] -= dt;
        if (this.timer[i] <= 0) this.state[i] = RUN;
      } else if (s === RUN) {
        const dx = tg.pos.x - this.x[i];
        const dz = tg.pos.z - this.z[i];
        const d = Math.hypot(dx, dz);
        let mx;
        let mz;
        if (d < 6) {
          mx = dx / d;
          mz = dz / d;
        } else {
          const f = flows[this.target[i]];
          const k = Math.floor(this.z[i] - Z0) * NW + Math.floor(this.x[i] - X0);
          mx = f.dirX[k] || 0;
          mz = f.dirZ[k] || 0;
          if (!mx && !mz) {
            mx = dx / d;
            mz = dz / d;
          }
        }
        // ognuno ha la sua "corsia": lo sciame si allarga invece di fare la fila
        const lx = -mz * this.lane[i];
        const lz = mx * this.lane[i];
        const sp = this.speed[i];
        let nx = this.x[i] + (mx + lx * 0.35) * sp * dt;
        let nz = this.z[i] + (mz + lz * 0.35) * sp * dt;
        if (this.isBlocked(nx, nz)) {
          if (!this.isBlocked(nx, this.z[i])) nz = this.z[i];
          else if (!this.isBlocked(this.x[i], nz)) nx = this.x[i];
          else {
            nx = this.x[i];
            nz = this.z[i];
          }
        }
        this.x[i] = nx;
        this.z[i] = nz;
        this.yaw[i] = Math.atan2(mx, mz);
        this.phase[i] += dt * sp * 6;
        this.y[i] = Math.abs(Math.sin(this.phase[i])) * 0.06;
        if (d < tg.radius + 0.25 && this.clinging[this.target[i]] < clingMax && tg.pos.y < 0.8) {
          this.state[i] = CLING;
          this.clinging[this.target[i]]++;
          this.clingA[i] = Math.random() * Math.PI * 2;
          this.clingH[i] = 0.1 + Math.random() * 1.45;
        }
      } else if (s === CLING) {
        const a = this.clingA[i] + Math.sin(t * 5 + i) * 0.1;
        this.x[i] = tg.pos.x + Math.cos(a) * 0.3;
        this.z[i] = tg.pos.z + Math.sin(a) * 0.3;
        this.y[i] = tg.pos.y + this.clingH[i] + Math.sin(t * 9 + i) * 0.03;
        this.yaw[i] = Math.atan2(-Math.cos(a), -Math.sin(a));
      } else if (s === FALL) {
        this.vy[i] -= 22 * dt;
        this.x[i] += this.vx[i] * dt;
        this.y[i] += this.vy[i] * dt;
        this.z[i] += this.vz[i] * dt;
        this.yaw[i] += dt * 6;
        if (this.y[i] <= 0) {
          this.y[i] = 0;
          if (this.isBlocked(this.x[i], this.z[i])) {
            this.x[i] -= this.vx[i] * dt * 3;
            this.z[i] -= this.vz[i] * dt * 3;
          }
          this.state[i] = RUN;
        }
      } else if (s === FLY) {
        this.vy[i] -= 22 * dt;
        this.x[i] += this.vx[i] * dt;
        this.y[i] += this.vy[i] * dt;
        this.z[i] += this.vz[i] * dt;
        if (this.isBlocked(this.x[i], this.z[i])) {
          this.vx[i] *= -0.4;
          this.vz[i] *= -0.4;
          this.x[i] += this.vx[i] * dt * 2;
          this.z[i] += this.vz[i] * dt * 2;
        }
        this.timer[i] += dt;
        if (this.y[i] < 0) {
          this.y[i] = 0;
          if (this.timer[i] > 0.2) {
            // a terra, stordito: sparisce e tornerà da un'altra parte
            this.state[i] = INACTIVE;
            this.free.push(i);
            this.active--;
            landed++;
          } else this.vy[i] *= -0.3;
        }
      }

      // matrice dell'istanza
      const sc = this.state[i] === INACTIVE ? 0 : this.scale[i];
      if (this.state[i] === FLY) {
        M.position.set(this.x[i], this.y[i], this.z[i]);
        M.rotation.set(this.timer[i] * this.spin[i], this.yaw[i], this.timer[i] * this.spin[i] * 0.7);
        M.scale.setScalar(sc);
        M.updateMatrix();
        M.matrix.toArray(mat, i * 16);
      } else {
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
        mat[o + 13] = this.y[i];
        mat[o + 14] = this.z[i];
        mat[o + 15] = 1;
      }
    }
    this.mesh.instanceMatrix.needsUpdate = true;
    return landed;
  }

  // Quanti gnomi corrono entro un raggio (per il suono e per l'amico).
  countNear(x, z, r) {
    let n = 0;
    const r2 = r * r;
    for (let i = 0; i < this.max; i++) {
      if (this.state[i] !== RUN) continue;
      const dx = this.x[i] - x;
      const dz = this.z[i] - z;
      if (dx * dx + dz * dz < r2) n++;
    }
    return n;
  }

  clear() {
    this.free.length = 0;
    for (let i = this.max - 1; i >= 0; i--) {
      this.state[i] = INACTIVE;
      this.free.push(i);
    }
    this.active = 0;
    this.clinging = [0, 0];
    const zero = new THREE.Matrix4().makeScale(0, 0, 0);
    for (let i = 0; i < this.max; i++) this.mesh.setMatrixAt(i, zero);
    this.mesh.instanceMatrix.needsUpdate = true;
  }

  dispose() {
    this.geo.dispose();
    this.material.dispose();
    this.mesh.dispose();
    this.mesh.removeFromParent();
  }
}
