import * as THREE from 'three';
import { mulberry32 } from '../../core/noise.js';

// La tempesta: pioggia obliqua intorno alla camera, fulmini sul mare (il lampo
// illumina tutto, il tuono arriva dopo), il vento. Si spegne al chiuso.
export class Storm {
  constructor(scene, { lights, sky, audio }) {
    this.scene = scene;
    this.lights = lights; // [{ light, base }]
    this.sky = sky;
    this.audio = audio;
    this.disposables = [];
    const track = (o) => (this.disposables.push(o), o);
    // la pioggia: segmenti che cadono in una scatola che segue la camera
    const n = 2600;
    this.n = n;
    this.box = { w: 60, h: 34 };
    const pos = new Float32Array(n * 6);
    const rand = mulberry32(3);
    this.drops = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      this.drops[i * 3] = (rand() - 0.5) * this.box.w;
      this.drops[i * 3 + 1] = rand() * this.box.h;
      this.drops[i * 3 + 2] = (rand() - 0.5) * this.box.w;
    }
    const geo = track(new THREE.BufferGeometry());
    this.rainAttr = new THREE.BufferAttribute(pos, 3);
    this.rainAttr.setUsage(THREE.DynamicDrawUsage);
    geo.setAttribute('position', this.rainAttr);
    this.rain = new THREE.LineSegments(geo, track(new THREE.LineBasicMaterial({ color: '#a8b8c4', transparent: true, opacity: 0.45, depthWrite: false })));
    this.rain.frustumCulled = false;
    scene.add(this.rain);
    // il fulmine: una linea spezzata
    const bgeo = track(new THREE.BufferGeometry());
    this.boltAttr = new THREE.BufferAttribute(new Float32Array(40 * 3), 3);
    bgeo.setAttribute('position', this.boltAttr);
    this.bolt = new THREE.Line(bgeo, track(new THREE.LineBasicMaterial({ color: '#f4f8ff' })));
    this.bolt.frustumCulled = false;
    this.bolt.visible = false;
    scene.add(this.bolt);
    this.nextBolt = 3 + Math.random() * 4;
    this.flash = 0;
    this.indoor = false;
    this.wind = new THREE.Vector2(-9, 4);
    audio.loop('pioggia', true, { freq: 2400, q: 0.3, vol: 0.07, type: 'highpass' });
    audio.loop('vento', true, { freq: 300, q: 1.2, vol: 0.05, type: 'bandpass' });
    audio.loop('mare', true, { freq: 260, q: 0.4, vol: 0.08, type: 'lowpass' });
  }

  setIndoor(on) {
    this.indoor = on;
    this.rain.visible = !on;
    this.audio.loopVolume?.('pioggia', on ? 0.02 : 0.07);
    this.audio.loopVolume?.('vento', on ? 0.03 : 0.05);
    this.audio.loopVolume?.('mare', on ? 0.02 : 0.08);
  }

  strike(camera) {
    // da qualche parte sul mare, davanti o di lato
    const a = Math.random() * Math.PI * 2;
    const r = 180 + Math.random() * 260;
    const x = camera.position.x + Math.cos(a) * r;
    const z = camera.position.z + Math.sin(a) * r;
    const p = this.boltAttr.array;
    let px = x;
    let pz = z;
    for (let i = 0; i < 40; i++) {
      const y = 220 - (i / 39) * 222;
      px += (Math.random() - 0.5) * 9;
      pz += (Math.random() - 0.5) * 9;
      p[i * 3] = px;
      p[i * 3 + 1] = y;
      p[i * 3 + 2] = pz;
    }
    this.boltAttr.needsUpdate = true;
    this.bolt.visible = true;
    this.flash = 1;
    const delay = 400 + r * 3;
    setTimeout(() => this.audio.boom(0.35 + Math.random() * 0.3), delay);
  }

  update(dt, camera, enabled = true) {
    // la pioggia
    if (!this.indoor) {
      const p = this.rainAttr.array;
      const d = this.drops;
      const { w, h } = this.box;
      const cx = camera.position.x;
      const cy = camera.position.y - h * 0.4;
      const cz = camera.position.z;
      const wx = this.wind.x * 0.06;
      const wz = this.wind.y * 0.06;
      for (let i = 0; i < this.n; i++) {
        d[i * 3 + 1] -= 34 * dt;
        d[i * 3] += this.wind.x * dt;
        d[i * 3 + 2] += this.wind.y * dt;
        if (d[i * 3 + 1] < 0) d[i * 3 + 1] += h;
        // la scatola segue la camera: si riavvolge sui lati
        let x = ((((d[i * 3] - cx) % w) + w * 1.5) % w) - w / 2;
        let z = ((((d[i * 3 + 2] - cz) % w) + w * 1.5) % w) - w / 2;
        x += cx;
        z += cz;
        const y = cy + d[i * 3 + 1];
        p[i * 6] = x;
        p[i * 6 + 1] = y;
        p[i * 6 + 2] = z;
        p[i * 6 + 3] = x + wx;
        p[i * 6 + 4] = y + 0.9;
        p[i * 6 + 5] = z + wz;
      }
      this.rainAttr.needsUpdate = true;
    }
    // i fulmini
    this.nextBolt -= dt;
    if (enabled && this.nextBolt <= 0) {
      this.nextBolt = 5 + Math.random() * 9;
      if (!this.indoor) this.strike(camera);
      else {
        // da dentro si sente solo il tuono, e la luce filtra dall'alto
        this.flash = 0.35;
        setTimeout(() => this.audio.boom(0.25), 900);
      }
    }
    if (this.flash > 0) {
      this.flash = Math.max(0, this.flash - dt * 3.2);
      const f = this.flash * (0.6 + Math.random() * 0.4);
      for (const L of this.lights) L.light.intensity = L.base + f * (this.indoor ? 1.2 : 3.2);
      if (this.sky) this.sky.uniforms.horizon.value.setRGB(0.23 + f * 0.6, 0.26 + f * 0.6, 0.3 + f * 0.65);
      this.bolt.visible = this.flash > 0.5 && Math.random() < 0.8;
    } else {
      this.bolt.visible = false;
      for (const L of this.lights) L.light.intensity = L.base;
      if (this.sky) this.sky.uniforms.horizon.value.set('#3a434c');
    }
  }

  dispose() {
    this.scene.remove(this.rain, this.bolt);
    this.disposables.forEach((d) => d.dispose?.());
    for (const n of ['pioggia', 'vento', 'mare']) this.audio.loop(n, false);
  }
}
