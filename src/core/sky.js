import * as THREE from 'three';

// Cielo a gradiente con sole/luna e stelle procedurali. Segue sempre la camera.
export function createSky() {
  const uniforms = {
    top: { value: new THREE.Color('#1a1030') },
    horizon: { value: new THREE.Color('#d0603a') },
    bottom: { value: new THREE.Color('#2a1a1a') },
    sunDir: { value: new THREE.Vector3(0.3, 0.1, 1).normalize() },
    sunColor: { value: new THREE.Color('#ffb070') },
    stars: { value: 0 },
    time: { value: 0 },
  };
  const material = new THREE.ShaderMaterial({
    uniforms,
    side: THREE.BackSide,
    depthWrite: false,
    vertexShader: /* glsl */ `
      varying vec3 vDir;
      void main() {
        vDir = position;
        vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        gl_Position = p.xyww;
      }`,
    fragmentShader: /* glsl */ `
      uniform vec3 top, horizon, bottom, sunDir, sunColor;
      uniform float stars, time;
      varying vec3 vDir;
      float hash(vec3 p) {
        p = fract(p * 0.3183099 + 0.1);
        p *= 17.0;
        return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
      }
      void main() {
        vec3 d = normalize(vDir);
        float h = d.y;
        vec3 col = h > 0.0 ? mix(horizon, top, pow(h, 0.45)) : mix(horizon, bottom, pow(-h, 0.35));
        float s = max(dot(d, normalize(sunDir)), 0.0);
        col += sunColor * (pow(s, 900.0) * 3.0 + pow(s, 12.0) * 0.35 + pow(s, 3.0) * 0.08);
        vec3 q = d * 260.0;
        vec3 id = floor(q);
        float r = hash(id);
        float st = step(0.9965, r) * smoothstep(0.02, 0.25, h);
        vec3 f = fract(q) - 0.5;
        st *= smoothstep(0.5, 0.0, length(f));
        float tw = 0.55 + 0.45 * sin(time * 2.0 + r * 200.0);
        col += vec3(0.9, 0.95, 1.0) * st * tw * stars * 1.6;
        gl_FragColor = vec4(col, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  });
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(1000, 48, 24), material);
  mesh.frustumCulled = false;
  mesh.renderOrder = -1;
  return {
    mesh,
    uniforms,
    update(camera, dt) {
      mesh.position.copy(camera.position);
      uniforms.time.value += dt;
    },
  };
}
