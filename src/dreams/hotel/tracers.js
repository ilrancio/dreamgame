import * as THREE from 'three';

// Scie luminose dei colpi: segmenti che si spengono in pochi centesimi di secondo.
export class Tracers {
  constructor(scene, max = 64) {
    this.max = max;
    this.items = [];
    this.geo = new THREE.BufferGeometry();
    this.pos = new Float32Array(max * 6);
    this.col = new Float32Array(max * 6);
    this.geo.setAttribute('position', new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage));
    this.geo.setAttribute('color', new THREE.BufferAttribute(this.col, 3).setUsage(THREE.DynamicDrawUsage));
    this.mat = new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false });
    this.lines = new THREE.LineSegments(this.geo, this.mat);
    this.lines.frustumCulled = false;
    scene.add(this.lines);
  }

  add(a, b, color = [1, 0.9, 0.6]) {
    if (this.items.length >= this.max) this.items.shift();
    this.items.push({ a: a.clone(), b: b.clone(), color, life: 0.09 });
  }

  update(dt) {
    this.items = this.items.filter((it) => (it.life -= dt) > 0);
    this.items.forEach((it, i) => {
      const k = it.life / 0.09;
      this.pos.set([it.a.x, it.a.y, it.a.z, it.b.x, it.b.y, it.b.z], i * 6);
      const [r, g, b] = it.color;
      this.col.set([r * k, g * k, b * k, r * k * 0.3, g * k * 0.3, b * k * 0.3], i * 6);
    });
    this.geo.setDrawRange(0, this.items.length * 2);
    this.geo.attributes.position.needsUpdate = true;
    this.geo.attributes.color.needsUpdate = true;
  }

  dispose() {
    this.geo.dispose();
    this.mat.dispose();
    this.lines.removeFromParent();
  }
}
