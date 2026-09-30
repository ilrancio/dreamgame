import * as THREE from 'three';
import { createSky } from '../core/sky.js';
import { Particles } from '../core/particles.js';
import { textTexture } from '../core/textures.js';
import { formatTime } from '../core/ui.js';
import { DREAMS, EMPTY_DOORS } from '../dreams/index.js';

const PORTAL_VERT = 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }';
const PORTAL_FRAG = /* glsl */ `
  uniform float time, isOpen, hover;
  uniform vec3 c1, c2;
  varying vec2 vUv;
  void main() {
    vec2 p = (vUv - 0.5) * vec2(1.0, 1.7);
    float r = length(p);
    float a = atan(p.y, p.x);
    float sw = sin(a * 3.0 + r * 14.0 - time * 1.6) * 0.5 + 0.5;
    float sw2 = sin(a * -5.0 + r * 9.0 + time * 1.1) * 0.5 + 0.5;
    vec3 col = mix(c2, c1, sw * 0.7 + sw2 * 0.3);
    col += vec3(1.0, 0.9, 0.8) * pow(max(0.0, 1.0 - r * 2.2), 3.0) * (0.8 + hover);
    vec3 off = vec3(0.04, 0.045, 0.07) + vec3(0.03) * sin(time * 0.7 + r * 8.0);
    col = mix(off, col, isOpen);
    gl_FragColor = vec4(col, 1.0);
    #include <colorspace_fragment>
  }`;

// La Stanza dei Sogni: un'isola sospesa nel vuoto stellato, con un letto
// al centro e una porta per ogni sogno raccontato.
export class Hub {
  constructor(ctx) {
    this.ctx = ctx;
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.1, 3000);
    this.disposables = [];
    this.time = 0;
    this.yaw = 0;
    this.pitch = -0.05;
    this.pos = new THREE.Vector3(0, 1.7, 5);
    this.entering = false;

    this.scene.fog = new THREE.FogExp2('#0b0a1e', 0.012);
    this.sky = createSky();
    const u = this.sky.uniforms;
    u.top.value.set('#05030f');
    u.horizon.value.set('#2a1850');
    u.bottom.value.set('#0a0618');
    u.stars.value = 1;
    u.sunDir.value.set(0.4, 0.35, -1).normalize();
    u.sunColor.value.set('#9a8cff');
    this.scene.add(this.sky.mesh);

    this.scene.add(new THREE.HemisphereLight('#8a7cff', '#1a1030', 0.9));
    const moon = new THREE.DirectionalLight('#c8c0ff', 1.2);
    moon.position.set(10, 20, -10);
    this.scene.add(moon);

    this.buildIsland();
    this.buildDoors();

    this.motes = new Particles(this.scene, 800, { additive: true });
    this.motes.setScale(ctx.renderer, this.camera);
    for (let i = 0; i < 400; i++) this.spawnMote(true);

    ctx.ui.hint('Clicca per guardarti intorno · <kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd> muoviti · attraversa una porta per sognare');
    ctx.audio.stopAllPads(1);
    ctx.audio.pad('hub', [110, 164.8, 220, 277.2, 329.6], { vol: 0.045, cutoff: 900, tremolo: 0.15 });

    this.onClick = () => {
      ctx.audio.init();
      ctx.input.lock();
    };
    ctx.renderer.domElement.addEventListener('click', this.onClick);
  }

  track(o) {
    this.disposables.push(o);
    return o;
  }

  buildIsland() {
    const stoneMat = this.track(new THREE.MeshStandardMaterial({ color: '#2a2440', roughness: 0.9, flatShading: true }));
    const topMat = this.track(new THREE.MeshStandardMaterial({ color: '#3a3358', roughness: 0.8 }));
    const top = new THREE.Mesh(this.track(new THREE.CylinderGeometry(22, 22, 1, 64)), topMat);
    top.position.y = -0.5;
    this.scene.add(top);
    const under = new THREE.Mesh(this.track(new THREE.ConeGeometry(22, 26, 12, 3)), stoneMat);
    under.rotation.x = Math.PI;
    under.position.y = -14;
    this.scene.add(under);
    const rim = new THREE.Mesh(
      this.track(new THREE.TorusGeometry(22, 0.12, 8, 128)),
      this.track(new THREE.MeshBasicMaterial({ color: '#b9a6ff' })),
    );
    rim.rotation.x = Math.PI / 2;
    this.scene.add(rim);
    // cerchi incisi a terra
    for (const r of [5, 9.5]) {
      const ring = new THREE.Mesh(
        this.track(new THREE.RingGeometry(r, r + 0.06, 96)),
        this.track(new THREE.MeshBasicMaterial({ color: '#6e5ccf', transparent: true, opacity: 0.5 })),
      );
      ring.rotation.x = -Math.PI / 2;
      ring.position.y = 0.01;
      this.scene.add(ring);
    }

    // il letto dove sogni
    const bed = new THREE.Group();
    const wood = this.track(new THREE.MeshStandardMaterial({ color: '#4a3326', roughness: 0.8 }));
    const sheet = this.track(new THREE.MeshStandardMaterial({ color: '#dcd6f0', roughness: 1 }));
    const blanket = this.track(new THREE.MeshStandardMaterial({ color: '#4b3f8f', roughness: 1 }));
    const add = (geo, mat, x, y, z) => {
      const m = new THREE.Mesh(this.track(geo), mat);
      m.position.set(x, y, z);
      bed.add(m);
      return m;
    };
    add(new THREE.BoxGeometry(2.2, 0.4, 3.2), wood, 0, 0.4, 0);
    add(new THREE.BoxGeometry(2.1, 0.3, 3.1), sheet, 0, 0.75, 0);
    add(new THREE.BoxGeometry(2.15, 0.12, 2.0), blanket, 0, 0.93, 0.5);
    add(new THREE.BoxGeometry(1.2, 0.25, 0.6), sheet, 0, 1.0, -1.1);
    add(new THREE.BoxGeometry(2.2, 1.4, 0.15), wood, 0, 0.9, -1.6);
    bed.position.set(0, 0, 9);
    bed.rotation.y = Math.PI;
    this.scene.add(bed);
    const lamp = new THREE.PointLight('#ffc98a', 25, 18, 1.5);
    lamp.position.set(1.8, 2.5, 9.5);
    this.scene.add(lamp);
    const center = new THREE.PointLight('#9d8cff', 30, 30, 1.2);
    center.position.set(0, 6, 0);
    this.scene.add(center);
    this.bed = bed;

    // rocce fluttuanti in lontananza
    const rockGeo = this.track(new THREE.DodecahedronGeometry(1, 0));
    this.floaters = [];
    const floatMat = this.track(new THREE.MeshStandardMaterial({ color: '#5a4c8a', roughness: 0.9, flatShading: true, emissive: '#1a1238' }));
    for (let i = 0; i < 28; i++) {
      const m = new THREE.Mesh(rockGeo, floatMat);
      const a = Math.random() * Math.PI * 2;
      const r = 80 + Math.random() * 160;
      m.position.set(Math.cos(a) * r, -40 + Math.random() * 50, Math.sin(a) * r);
      m.scale.setScalar(2 + Math.random() * 7);
      m.rotation.set(Math.random() * 6, Math.random() * 6, 0);
      m.userData.phase = Math.random() * 6;
      this.scene.add(m);
      this.floaters.push(m);
    }
  }

  buildDoors() {
    const progress = this.ctx.progress;
    const total = DREAMS.length + EMPTY_DOORS;
    const frameMat = this.track(new THREE.MeshStandardMaterial({ color: '#d8c9a8', roughness: 0.5, metalness: 0.4 }));
    const frameGeoV = this.track(new THREE.BoxGeometry(0.3, 4.4, 0.4));
    const frameGeoH = this.track(new THREE.BoxGeometry(2.9, 0.3, 0.4));
    const portalGeo = this.track(new THREE.PlaneGeometry(2.3, 4.0));
    this.doors = [];
    const R = 15;
    for (let i = 0; i < total; i++) {
      const dream = DREAMS[i];
      // la prima porta è al centro, le altre si alternano a destra e sinistra
      const slot = i === 0 ? 0 : Math.ceil(i / 2) * (i % 2 ? 1 : -1);
      const a = slot * 0.36;
      const x = Math.sin(a) * R;
      const z = -Math.cos(a) * R;
      const door = new THREE.Group();
      door.position.set(x, 0, z);
      door.rotation.y = -a;
      this.scene.add(door);

      const l = new THREE.Mesh(frameGeoV, frameMat);
      l.position.set(-1.3, 2.2, 0);
      const r = new THREE.Mesh(frameGeoV, frameMat);
      r.position.set(1.3, 2.2, 0);
      const t = new THREE.Mesh(frameGeoH, frameMat);
      t.position.set(0, 4.4, 0);
      door.add(l, r, t);

      const mat = this.track(new THREE.ShaderMaterial({
        uniforms: {
          time: { value: Math.random() * 10 },
          isOpen: { value: dream ? 1 : 0 },
          hover: { value: 0 },
          c1: { value: new THREE.Color(dream ? dream.colors[0] : '#222') },
          c2: { value: new THREE.Color(dream ? dream.colors[1] : '#111') },
        },
        vertexShader: PORTAL_VERT,
        fragmentShader: PORTAL_FRAG,
        side: THREE.DoubleSide,
      }));
      const portal = new THREE.Mesh(portalGeo, mat);
      portal.position.y = 2.1;
      door.add(portal);

      const p = dream ? progress[dream.id] : null;
      const label = dream
        ? `${dream.number} · ${dream.title}${p?.completed ? `\n★ ${formatTime(p.bestTime)} · voto ${p.bestRank}` : ''}`
        : '?\nsogno non ancora raccontato';
      const tex = this.track(textTexture(label, {
        width: 1024,
        height: 256,
        font: dream ? '700 84px Cormorant Garamond, serif' : 'italic 500 60px Cormorant Garamond, serif',
        color: dream ? '#fff2dc' : '#8a86a8',
        glow: dream ? dream.colors[0] : null,
      }));
      const labelMesh = new THREE.Mesh(
        this.track(new THREE.PlaneGeometry(6, 1.5)),
        this.track(new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false })),
      );
      labelMesh.position.set(0, 5.6, 0.1);
      door.add(labelMesh);

      if (dream) {
        const light = new THREE.PointLight(dream.colors[0], 6, 12, 1.5);
        light.position.set(0, 2, 1.5);
        door.add(light);
      }
      // la porta guarda verso il centro: il portale è sul lato +z locale
      this.doors.push({ dream, group: door, mat, world: new THREE.Vector3(x, 0, z) });
    }
  }

  spawnMote(anywhere = false) {
    const a = Math.random() * Math.PI * 2;
    const r = Math.random() * 60;
    this.motes.emit(
      Math.cos(a) * r,
      anywhere ? -10 + Math.random() * 30 : -12,
      Math.sin(a) * r,
      (Math.random() - 0.5) * 0.3,
      0.3 + Math.random() * 0.5,
      (Math.random() - 0.5) * 0.3,
      { color: Math.random() < 0.5 ? [0.7, 0.6, 1] : [1, 0.8, 0.6], size: 0.15 + Math.random() * 0.2, life: 20 + Math.random() * 20 },
    );
  }

  update(dt) {
    const { input, ui } = this.ctx;
    this.time += dt;

    if (input.locked) {
      this.yaw -= input.mouseDX * 0.0022;
      this.pitch -= input.mouseDY * 0.0022;
      this.pitch = Math.max(-1.3, Math.min(1.3, this.pitch));
    }
    // anche le frecce ruotano la visuale (per chi non usa il mouse)
    if (input.down('ArrowLeft')) this.yaw += dt * 1.8;
    if (input.down('ArrowRight')) this.yaw -= dt * 1.8;
    if (input.wasPressed('KeyM')) this.ctx.audio.toggleMute();

    if (!this.entering) {
      const f = (input.down('KeyW', 'ArrowUp') ? 1 : 0) - (input.down('KeyS', 'ArrowDown') ? 1 : 0);
      const s = (input.down('KeyD') ? 1 : 0) - (input.down('KeyA') ? 1 : 0);
      const speed = 5.5;
      const fx = -Math.sin(this.yaw);
      const fz = -Math.cos(this.yaw);
      this.pos.x += (fx * f + -fz * s) * speed * dt;
      this.pos.z += (fz * f + fx * s) * speed * dt;
      const r = Math.hypot(this.pos.x, this.pos.z);
      if (r > 20.5) {
        this.pos.x *= 20.5 / r;
        this.pos.z *= 20.5 / r;
      }
      // il letto è solido
      const bz = this.pos.z - 9;
      if (Math.abs(this.pos.x) < 1.6 && Math.abs(bz) < 2.1) {
        const px = 1.6 - Math.abs(this.pos.x);
        const pz = 2.1 - Math.abs(bz);
        if (px < pz) this.pos.x = Math.sign(this.pos.x || 1) * 1.6;
        else this.pos.z = 9 + Math.sign(bz || 1) * 2.1;
      }
    }
    const bob = Math.sin(this.time * 1.2) * 0.03;
    this.camera.position.set(this.pos.x, this.pos.y + bob, this.pos.z);
    this.camera.rotation.set(this.pitch, this.yaw, 0, 'YXZ');

    let near = null;
    for (const d of this.doors) {
      d.mat.uniforms.time.value += dt;
      const dist = Math.hypot(this.pos.x - d.world.x, this.pos.z - d.world.z);
      d.mat.uniforms.hover.value += ((dist < 5 ? 1 : 0) - d.mat.uniforms.hover.value) * (1 - Math.exp(-4 * dt));
      if (dist < 5) near = d;
      if (d.dream && dist < 1.4 && !this.entering) {
        this.entering = true;
        this.ctx.audio.whoosh(0.6);
        this.ctx.startDream(d.dream.id);
      }
      // non si attraversano le porte chiuse
      if (!d.dream && dist < 1.4) {
        const k = 1.4 / dist;
        this.pos.x = d.world.x + (this.pos.x - d.world.x) * k;
        this.pos.z = d.world.z + (this.pos.z - d.world.z) * k;
      }
    }
    if (near && !this.entering) {
      ui.hint(near.dream ? `<b>${near.dream.title}</b><br/>${near.dream.subtitle}` : 'Questa porta aspetta un sogno che non mi hai ancora raccontato.');
    } else if (!this.entering) {
      ui.hint(input.locked ? '<kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd> muoviti · attraversa una porta per sognare' : 'Clicca per guardarti intorno · <kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd> muoviti · attraversa una porta per sognare');
    }

    for (const m of this.floaters) {
      m.position.y += Math.sin(this.time * 0.5 + m.userData.phase) * 0.01;
      m.rotation.y += dt * 0.05;
    }
    if (Math.random() < 0.3) this.spawnMote();
    this.motes.update(dt);
    this.sky.update(this.camera, dt);
  }

  onResize() {
    this.motes.setScale(this.ctx.renderer, this.camera);
  }

  dispose() {
    this.ctx.renderer.domElement.removeEventListener('click', this.onClick);
    this.ctx.input.unlock();
    this.ctx.ui.hint(null);
    this.disposables.forEach((d) => d.dispose());
    this.motes.dispose();
    this.sky.mesh.geometry.dispose();
    this.sky.mesh.material.dispose();
  }
}
