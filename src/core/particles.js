import * as THREE from 'three';

// Sistema di particelle su CPU: polvere, fumo, braci, scintille.
export class Particles {
  constructor(scene, max = 2000, { additive = false } = {}) {
    this.max = max;
    this.count = 0;
    this.p = new Float32Array(max * 3);
    this.v = new Float32Array(max * 3);
    this.c = new Float32Array(max * 3);
    this.life = new Float32Array(max);
    this.maxLife = new Float32Array(max);
    this.size0 = new Float32Array(max);
    this.size1 = new Float32Array(max);
    this.grav = new Float32Array(max);
    this.drag = new Float32Array(max);
    this.alpha0 = new Float32Array(max);

    const g = new THREE.BufferGeometry();
    this.posAttr = new THREE.BufferAttribute(new Float32Array(max * 3), 3);
    this.colAttr = new THREE.BufferAttribute(new Float32Array(max * 3), 3);
    this.sizeAttr = new THREE.BufferAttribute(new Float32Array(max), 1);
    this.alphaAttr = new THREE.BufferAttribute(new Float32Array(max), 1);
    [this.posAttr, this.colAttr, this.sizeAttr, this.alphaAttr].forEach((a) =>
      a.setUsage(THREE.DynamicDrawUsage),
    );
    g.setAttribute('position', this.posAttr);
    g.setAttribute('color', this.colAttr);
    g.setAttribute('size', this.sizeAttr);
    g.setAttribute('alpha', this.alphaAttr);
    g.setDrawRange(0, 0);

    this.material = new THREE.ShaderMaterial({
      uniforms: { scale: { value: 600 } },
      transparent: true,
      depthWrite: false,
      blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
      vertexShader: /* glsl */ `
        attribute float size;
        attribute float alpha;
        attribute vec3 color;
        uniform float scale;
        varying vec3 vColor;
        varying float vAlpha;
        void main() {
          vColor = color;
          vAlpha = alpha;
          vec4 mv = modelViewMatrix * vec4(position, 1.0);
          gl_PointSize = min(size * scale / -mv.z, 400.0);
          gl_Position = projectionMatrix * mv;
        }`,
      fragmentShader: /* glsl */ `
        varying vec3 vColor;
        varying float vAlpha;
        void main() {
          float d = length(gl_PointCoord - 0.5);
          if (d > 0.5) discard;
          float a = smoothstep(0.5, 0.0, d) * vAlpha;
          gl_FragColor = vec4(vColor, a);
          #include <colorspace_fragment>
        }`,
    });
    this.points = new THREE.Points(g, this.material);
    this.points.frustumCulled = false;
    scene.add(this.points);
  }

  setScale(renderer, camera) {
    const h = renderer.domElement.height;
    this.material.uniforms.scale.value = h / (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2));
  }

  emit(x, y, z, vx, vy, vz, { color = [1, 1, 1], size = 1, endSize = size, life = 1, gravity = 0, drag = 0, alpha = 1 } = {}) {
    if (this.count >= this.max) return;
    const i = this.count++;
    const i3 = i * 3;
    this.p[i3] = x;
    this.p[i3 + 1] = y;
    this.p[i3 + 2] = z;
    this.v[i3] = vx;
    this.v[i3 + 1] = vy;
    this.v[i3 + 2] = vz;
    this.c[i3] = color[0];
    this.c[i3 + 1] = color[1];
    this.c[i3 + 2] = color[2];
    this.life[i] = life;
    this.maxLife[i] = life;
    this.size0[i] = size;
    this.size1[i] = endSize;
    this.grav[i] = gravity;
    this.drag[i] = drag;
    this.alpha0[i] = alpha;
  }

  burst(x, y, z, n, speed, opts = {}, up = 0) {
    for (let k = 0; k < n; k++) {
      const a = Math.random() * Math.PI * 2;
      const e = Math.random() * 2 - 1;
      const r = Math.sqrt(1 - e * e);
      const s = speed * (0.4 + Math.random() * 0.6);
      this.emit(x, y, z, Math.cos(a) * r * s, Math.abs(e) * s + up, Math.sin(a) * r * s, {
        ...opts,
        life: (opts.life || 1) * (0.6 + Math.random() * 0.6),
      });
    }
  }

  update(dt) {
    let i = 0;
    while (i < this.count) {
      this.life[i] -= dt;
      if (this.life[i] <= 0) {
        this.swapRemove(i);
        continue;
      }
      const i3 = i * 3;
      const dr = Math.exp(-this.drag[i] * dt);
      this.v[i3] *= dr;
      this.v[i3 + 1] = this.v[i3 + 1] * dr - this.grav[i] * dt;
      this.v[i3 + 2] *= dr;
      this.p[i3] += this.v[i3] * dt;
      this.p[i3 + 1] += this.v[i3 + 1] * dt;
      this.p[i3 + 2] += this.v[i3 + 2] * dt;
      i++;
    }
    const pa = this.posAttr.array;
    const ca = this.colAttr.array;
    const sa = this.sizeAttr.array;
    const aa = this.alphaAttr.array;
    for (let k = 0; k < this.count; k++) {
      const k3 = k * 3;
      pa[k3] = this.p[k3];
      pa[k3 + 1] = this.p[k3 + 1];
      pa[k3 + 2] = this.p[k3 + 2];
      ca[k3] = this.c[k3];
      ca[k3 + 1] = this.c[k3 + 1];
      ca[k3 + 2] = this.c[k3 + 2];
      const t = 1 - this.life[k] / this.maxLife[k];
      sa[k] = this.size0[k] + (this.size1[k] - this.size0[k]) * t;
      aa[k] = this.alpha0[k] * Math.min(1, (1 - t) * 1.5) * Math.min(1, t * 12 + 0.2);
    }
    this.posAttr.needsUpdate = true;
    this.colAttr.needsUpdate = true;
    this.sizeAttr.needsUpdate = true;
    this.alphaAttr.needsUpdate = true;
    this.points.geometry.setDrawRange(0, this.count);
  }

  swapRemove(i) {
    const j = --this.count;
    if (i === j) return;
    const i3 = i * 3;
    const j3 = j * 3;
    for (let k = 0; k < 3; k++) {
      this.p[i3 + k] = this.p[j3 + k];
      this.v[i3 + k] = this.v[j3 + k];
      this.c[i3 + k] = this.c[j3 + k];
    }
    this.life[i] = this.life[j];
    this.maxLife[i] = this.maxLife[j];
    this.size0[i] = this.size0[j];
    this.size1[i] = this.size1[j];
    this.grav[i] = this.grav[j];
    this.drag[i] = this.drag[j];
    this.alpha0[i] = this.alpha0[j];
  }

  clear() {
    this.count = 0;
  }

  dispose() {
    this.points.geometry.dispose();
    this.material.dispose();
    this.points.removeFromParent();
  }
}
