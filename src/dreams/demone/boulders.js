import * as THREE from 'three';

const G = 30;
const MAX_BOULDERS = 50;

function rockGeometry(seed) {
  const geo = new THREE.IcosahedronGeometry(1, 2);
  const pos = geo.attributes.position;
  const v = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i);
    const n =
      Math.sin(v.x * 3.1 + seed) * Math.cos(v.y * 2.7 + seed * 1.7) * 0.14 +
      Math.sin(v.z * 5.3 + seed * 0.3) * 0.07;
    v.multiplyScalar(1 + n);
    pos.setXYZ(i, v.x, v.y * 0.85, v.z);
  }
  // spigoli netti: ogni faccia con la sua normale
  geo.computeVertexNormals();
  return geo;
}

// Macigni: volano con traiettoria balistica verso un bersaglio (mostrato a terra
// con un cerchio rosso), poi rotolano e restano nel campo come ostacoli.
export class BoulderSystem {
  constructor(scene, terrain, dust, embers) {
    this.scene = scene;
    this.terrain = terrain;
    this.dust = dust;
    this.embers = embers;
    this.list = [];
    this.geos = [0, 1, 2, 3].map((s) => rockGeometry(s * 13.7 + 1));
    this.markerGeo = new THREE.RingGeometry(0.62, 1, 48);
    this.markerGeo.rotateX(-Math.PI / 2);
    this.onImpact = null;
    this.tmp = new THREE.Vector3();
  }

  throwAt(from, target, radius) {
    const dx = target.x - from.x;
    const dz = target.z - from.z;
    const dist = Math.hypot(dx, dz);
    const t = Math.min(3.6, Math.max(2.1, dist / 190));
    const vel = new THREE.Vector3(dx / t, (target.y - from.y + 0.5 * G * t * t) / t, dz / t);

    const mat = new THREE.MeshStandardMaterial({
      color: '#3a3030',
      roughness: 0.95,
      flatShading: true,
      emissive: '#ff5010',
      emissiveIntensity: 1.8,
    });
    const mesh = new THREE.Mesh(this.geos[Math.floor(Math.random() * 4)], mat);
    mesh.scale.setScalar(radius);
    mesh.position.copy(from);
    mesh.castShadow = true;
    this.scene.add(mesh);

    const markerMat = new THREE.MeshBasicMaterial({
      color: '#ff3a20',
      transparent: true,
      opacity: 0.8,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
    });
    const marker = new THREE.Mesh(this.markerGeo, markerMat);
    marker.position.set(target.x, target.y + 0.6, target.z);
    this.scene.add(marker);

    const b = {
      mesh,
      mat,
      marker,
      r: radius,
      pos: from.clone(),
      vel,
      state: 'fly',
      heat: 1,
      flightTime: t,
      t: 0,
      target: target.clone(),
      spinAxis: new THREE.Vector3(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).normalize(),
    };
    this.list.push(b);
    this.trim();
    return b;
  }

  // Macigni già a terra all'inizio: il demone lancia da un po'.
  placeResting(x, z, radius) {
    const mat = new THREE.MeshStandardMaterial({ color: '#403636', roughness: 0.95, flatShading: true, emissive: '#000' });
    const mesh = new THREE.Mesh(this.geos[Math.floor(Math.random() * 4)], mat);
    mesh.scale.setScalar(radius);
    const y = this.terrain.heightAt(x, z) + radius * 0.55;
    mesh.position.set(x, y, z);
    mesh.rotation.set(Math.random() * 6, Math.random() * 6, 0);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    this.scene.add(mesh);
    this.list.push({ mesh, mat, marker: null, r: radius, pos: mesh.position.clone(), vel: new THREE.Vector3(), state: 'rest', heat: 0, t: 0 });
  }

  trim() {
    while (this.list.length > MAX_BOULDERS) {
      const idx = this.list.findIndex((b) => b.state === 'rest');
      if (idx < 0) break;
      const [b] = this.list.splice(idx, 1);
      this.removeBoulder(b);
    }
  }

  removeBoulder(b) {
    b.mesh.removeFromParent();
    b.mat.dispose();
    if (b.marker) {
      b.marker.removeFromParent();
      b.marker.material.dispose();
    }
  }

  update(dt) {
    const T = this.terrain;
    for (const b of this.list) {
      b.t += dt;
      if (b.state === 'fly') {
        b.vel.y -= G * dt;
        b.pos.addScaledVector(b.vel, dt);
        b.mesh.rotateOnAxis(b.spinAxis, dt * 2.5);
        // scia di fumo e braci
        if (Math.random() < 0.8) {
          this.dust.emit(b.pos.x, b.pos.y, b.pos.z, 0, 2, 0, { color: [0.18, 0.14, 0.13], size: b.r * 2.2, endSize: b.r * 5, life: 1.6, alpha: 0.55 });
        }
        this.embers.emit(b.pos.x + (Math.random() - 0.5) * b.r, b.pos.y, b.pos.z + (Math.random() - 0.5) * b.r, (Math.random() - 0.5) * 6, Math.random() * 4, (Math.random() - 0.5) * 6, { color: [1, 0.45, 0.1], size: 1.4, endSize: 0.3, life: 0.8, gravity: 4 });

        // il cerchio a terra si stringe man mano che il macigno arriva
        const k = Math.min(1, b.t / b.flightTime);
        const s = b.r * (4.2 - 2.4 * k);
        b.marker.scale.set(s, 1, s);
        b.marker.material.opacity = 0.35 + 0.6 * k + Math.sin(b.t * 20) * 0.15 * k;

        const gh = T.heightAt(b.pos.x, b.pos.z);
        if (b.pos.y - b.r * 0.6 <= gh) this.land(b, gh);
      } else if (b.state === 'roll') {
        const n = T.normalAt(b.pos.x, b.pos.z, this.tmp, 3);
        b.vel.x += n.x * 22 * dt;
        b.vel.z += n.z * 22 * dt;
        const damp = Math.exp(-0.9 * dt);
        b.vel.x *= damp;
        b.vel.z *= damp;
        const sp = Math.hypot(b.vel.x, b.vel.z);
        b.pos.x += b.vel.x * dt;
        b.pos.z += b.vel.z * dt;
        b.pos.y = T.heightAt(b.pos.x, b.pos.z) + b.r * 0.6;
        if (sp > 0.05) {
          const axis = new THREE.Vector3(b.vel.z, 0, -b.vel.x).normalize();
          b.mesh.rotateOnWorldAxis(axis, (sp * dt) / b.r);
        }
        if (sp > 4 && Math.random() < 0.3) {
          this.dust.emit(b.pos.x, b.pos.y - b.r * 0.5, b.pos.z, 0, 1.5, 0, { color: [0.45, 0.38, 0.28], size: 3, endSize: 8, life: 1.2, alpha: 0.4 });
        }
        if (sp < 0.4 && b.t > 1.5) {
          b.state = 'rest';
          b.vel.set(0, 0, 0);
        }
      }
      if (b.heat > 0 && b.state !== 'fly') {
        b.heat = Math.max(0, b.heat - dt * 0.18);
        b.mat.emissiveIntensity = b.heat * 1.6;
      }
      b.mesh.position.copy(b.pos);
    }
  }

  land(b, gh) {
    b.pos.y = gh + b.r * 0.6;
    b.state = 'roll';
    b.t = 0;
    b.vel.set(b.vel.x * 0.35, 0, b.vel.z * 0.35);
    if (b.marker) {
      b.marker.removeFromParent();
      b.marker.material.dispose();
      b.marker = null;
    }
    const { x, y, z } = b.pos;
    this.dust.burst(x, gh + 1, z, 45, 26, { color: [0.42, 0.34, 0.25], size: b.r * 1.6, endSize: b.r * 4.5, life: 2.4, drag: 1.6, gravity: -1, alpha: 0.75 }, 4);
    this.embers.burst(x, y, z, 35, 34, { color: [1, 0.5, 0.12], size: 1.6, endSize: 0.2, life: 1.3, gravity: 25, drag: 0.4 }, 12);
    this.onImpact?.(b);
  }

  // Collisioni tra macigni (spinte semplici): quelli che rotolano si spostano a vicenda.
  resolveMutual() {
    const L = this.list;
    for (let i = 0; i < L.length; i++) {
      const a = L[i];
      if (a.state === 'fly') continue;
      for (let j = i + 1; j < L.length; j++) {
        const b = L[j];
        if (b.state === 'fly') continue;
        const dx = b.pos.x - a.pos.x;
        const dz = b.pos.z - a.pos.z;
        const d = Math.hypot(dx, dz);
        const min = (a.r + b.r) * 0.85;
        if (d >= min || d < 1e-3) continue;
        const push = (min - d) / 2;
        const nx = dx / d;
        const nz = dz / d;
        if (a.state !== 'rest') {
          a.pos.x -= nx * push;
          a.pos.z -= nz * push;
        }
        if (b.state !== 'rest') {
          b.pos.x += nx * push;
          b.pos.z += nz * push;
        }
        if (a.state === 'roll' && b.state === 'rest') {
          a.vel.multiplyScalar(0.5);
        }
      }
    }
  }

  clear() {
    this.list.forEach((b) => this.removeBoulder(b));
    this.list = [];
  }

  dispose() {
    this.clear();
    this.geos.forEach((g) => g.dispose());
    this.markerGeo.dispose();
  }
}
