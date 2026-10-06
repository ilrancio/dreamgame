import * as THREE from 'three';

// La corruzione: dove l'invasione è più forte, la realtà si sfalda in pixel.
// Muri di texture corrotte chiudono alcuni posti finché non liberi il
// terminale giusto. Da vicino lo schermo si sporca di rumore digitale.

// Che cosa sblocca ogni terminale
export const GATES = {
  borgo: { by: 'piazzale', name: 'Sant\'Onirio', hint: 'Libera il terminale del piazzale dell\'hotel.' },
  conca: { by: 'borgo', name: 'la conca del centro commerciale', hint: 'Libera il terminale della piazza di Sant\'Onirio.' },
  ingresso: { by: 'parcheggio', name: 'le porte del centro commerciale', hint: 'Libera il terminale del parcheggio.' },
  primopiano: { by: 'galleria', name: 'il primo piano', hint: 'Libera il terminale in mezzo alla galleria.' },
};

export function gateOpen(progress, id) {
  return !!progress.digitale?.terminals?.[GATES[id].by]?.cleared;
}

const vert = `varying vec2 vUv; varying vec3 vPos;
void main(){ vUv = uv; vPos = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`;

// blocchi di pixel di grandezze diverse che cambiano a scatti, righe che si
// strappano, "texture mancanti" a scacchi viola e neri, colonne di dati che cadono
const frag = `uniform float time; uniform float opacity; uniform vec2 rep; varying vec2 vUv;
float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
void main(){
  vec2 uv = vUv * rep;
  float stp = floor(time * 9.0);
  float row = floor(uv.y * 6.0);
  float tear = step(0.8, hash(vec2(row, floor(time * 3.0)))) * (hash(vec2(row, stp)) - 0.5) * 3.0;
  uv.x += tear;
  vec2 big = floor(uv * 2.0);
  float hb = hash(big + floor(time * 1.5) * 0.13);
  float sc = hb < 0.3 ? 3.0 : hb < 0.75 ? 10.0 : 28.0;
  vec2 cell = floor(uv * sc);
  float n = hash(cell + stp * 0.37 + sc);
  vec3 col;
  float a;
  if (hb > 0.9) {
    float ch = mod(floor(uv.x * 6.0) + floor(uv.y * 6.0), 2.0);
    col = ch > 0.5 ? vec3(1.0, 0.0, 0.85) : vec3(0.0);
    a = 0.85;
  } else if (n < 0.45) { col = vec3(0.04, 0.0, 0.08); a = 0.35; }
  else if (n < 0.66) { col = vec3(1.0, 0.23, 0.85); a = 0.75; }
  else if (n < 0.87) { col = vec3(0.23, 0.94, 1.0); a = 0.7; }
  else if (n < 0.94) { col = vec3(1.0, 0.9, 0.2); a = 0.7; }
  else { col = vec3(1.0); a = 0.85; }
  float colx = floor(uv.x * 20.0);
  float fall = fract(vUv.y * rep.y * 0.5 + time * (0.3 + hash(vec2(colx, 1.0))));
  if (hash(vec2(colx, 7.0)) > 0.85 && fall < 0.15) { col = vec3(0.3, 1.0, 0.6); a = 0.9; }
  float scan = 0.7 + 0.3 * sin(vUv.y * 900.0 + time * 20.0);
  a *= scan;
  a *= 1.0 - smoothstep(0.7, 1.0, vUv.y);
  gl_FragColor = vec4(col, a * opacity);
}`;

export function corruptMaterial(rep = [40, 8]) {
  return new THREE.ShaderMaterial({
    uniforms: { time: { value: 0 }, opacity: { value: 1 }, rep: { value: new THREE.Vector2(rep[0], rep[1]) } },
    vertexShader: vert,
    fragmentShader: frag,
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
}

// Un recinto di corruzione: un cilindro aperto che circonda una zona.
// terrain serve a farlo partire sotto il suolo e salire abbastanza in alto.
export function buildCorruptRing(scene, { x, z, r, terrain = null, height = 70 }) {
  let lo = Infinity;
  let hi = -Infinity;
  for (let k = 0; k < 64; k++) {
    const a = (k / 64) * Math.PI * 2;
    const h = terrain ? terrain.heightAt(x + Math.cos(a) * r, z + Math.sin(a) * r) : 0;
    lo = Math.min(lo, h);
    hi = Math.max(hi, h);
  }
  const H = hi - lo + height;
  const mat = corruptMaterial([Math.round((r * 2 * Math.PI) / 6), Math.round(H / 6)]);
  const geo = new THREE.CylinderGeometry(r, r, H, 96, 1, true);
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.set(x, lo - 5 + H / 2, z);
  mesh.renderOrder = 5;
  scene.add(mesh);
  return makeBarrier(mesh, mat, geo);
}

// Una lastra di corruzione: davanti a una porta, in fondo a una scala.
export function buildCorruptPlane(scene, { x, y, z, w, h, yaw = 0 }) {
  const mat = corruptMaterial([Math.max(2, Math.round(w)), Math.max(2, Math.round(h))]);
  const geo = new THREE.PlaneGeometry(w, h);
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.set(x, y + h / 2, z);
  mesh.rotation.y = yaw;
  mesh.renderOrder = 5;
  scene.add(mesh);
  return makeBarrier(mesh, mat, geo);
}

function makeBarrier(mesh, mat, geo) {
  let target = 1;
  return {
    mesh,
    get active() {
      return target > 0;
    },
    // instant: senza animazione (all'apertura della scena)
    setActive(on, instant = false) {
      target = on ? 1 : 0;
      if (instant) {
        mat.uniforms.opacity.value = target;
        mesh.visible = on;
      } else if (on) mesh.visible = true;
    },
    update(t, dt) {
      mat.uniforms.time.value = t;
      const o = mat.uniforms.opacity;
      // quando liberi il terminale, la corruzione si dissolve piano
      o.value += (target - o.value) * Math.min(1, dt * 0.9);
      if (target === 0 && o.value < 0.01) mesh.visible = false;
    },
    dispose() {
      geo.dispose();
      mat.dispose();
      mesh.removeFromParent();
    },
  };
}

// Il rumore sullo schermo quando sei vicino alla corruzione.
let noiseURL = null;
export function glitchOverlay(k) {
  const el = document.getElementById('glitch');
  if (!el) return;
  if (!noiseURL) {
    const c = document.createElement('canvas');
    c.width = c.height = 96;
    const g = c.getContext('2d');
    for (let y = 0; y < 96; y += 4) {
      for (let x = 0; x < 96; x += 4) {
        const r = Math.random();
        if (r < 0.55) continue;
        g.fillStyle = r < 0.7 ? '#ff3ad8' : r < 0.85 ? '#3af0ff' : r < 0.95 ? '#000' : '#fff';
        g.fillRect(x, y, Math.random() < 0.2 ? 12 : 4, 4);
      }
    }
    noiseURL = c.toDataURL();
    el.style.backgroundImage = `url(${noiseURL})`;
  }
  el.style.opacity = String(Math.max(0, Math.min(1, k)) * 0.3);
  el.classList.toggle('on', k > 0.02);
}
