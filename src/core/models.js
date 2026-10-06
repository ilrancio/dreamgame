import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

// I modelli 3D (.glb) del gioco: si caricano una volta sola all'avvio e poi si
// clonano dove servono. Le geometrie sono condivise tra tutte le copie; i
// materiali anche, tranne quando una copia viene ricolorata.
// Ogni modello è ricentrato: il perno è in basso, al centro dell'ingombro.
// Il davanti del modello guarda verso +z.

// Il Furniture Kit di Kenney è piccolo: un'unità è circa 2,1 m del sogno.
export const KENNEY = 2.1;

class ModelLibrary {
  constructor() {
    this.templates = new Map();
    this.recolored = new Map();
    this.ready = Promise.resolve();
  }

  // urls: { nome: url }. Restituisce una promessa che non fallisce mai: un
  // modello che non si carica resta semplicemente assente (si usa il ripiego).
  load(urls) {
    const loader = new GLTFLoader();
    // i modelli incorporati (data:) si decodificano qui: alcune pagine vietano
    // di "scaricarli" con fetch, anche se sono già dentro il gioco
    const get = (url) => (url.startsWith('data:') ? loader.parseAsync(decodeDataUrl(url), '') : loader.loadAsync(url));
    const jobs = Object.entries(urls).map(([name, url]) =>
      get(url)
        // un secondo tentativo, se la rete ha avuto un singhiozzo
        .catch(() => new Promise((r) => setTimeout(r, 600)).then(() => get(url)))
        .then((gltf) => this.templates.set(name, prepare(gltf.scene)))
        .catch((e) => console.warn(`modello ${name} non caricato:`, e?.message || e)),
    );
    this.ready = Promise.all(jobs).then(() => this);
    return this.ready;
  }

  has(name) {
    return this.templates.has(name);
  }

  // Una copia del modello. colors: { nomeMateriale: '#colore' | Material }.
  make(name, { colors = null } = {}) {
    const t = this.templates.get(name);
    if (!t) return null;
    const o = t.clone(true);
    if (colors) {
      o.traverse((m) => {
        if (!m.isMesh) return;
        const swap = (mat) => {
          const c = colors[mat.name];
          if (!c) return mat;
          if (c.isMaterial) return c;
          const key = `${mat.uuid}|${c}`;
          if (!this.recolored.has(key)) {
            const n = mat.clone();
            n.color.set(c);
            this.recolored.set(key, n);
          }
          return this.recolored.get(key);
        };
        m.material = Array.isArray(m.material) ? m.material.map(swap) : swap(m.material);
      });
    }
    return o;
  }

  // l'ingombro del modello in unità originali [larghezza x, altezza, profondità z]
  size(name) {
    return this.templates.get(name)?.userData.size ?? null;
  }
}

function decodeDataUrl(url) {
  const bin = atob(url.slice(url.indexOf(',') + 1));
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out.buffer;
}

function prepare(scene) {
  const box = new THREE.Box3().setFromObject(scene);
  const size = box.getSize(new THREE.Vector3());
  const center = box.getCenter(new THREE.Vector3());
  scene.position.sub(new THREE.Vector3(center.x, box.min.y, center.z));
  scene.traverse((m) => {
    if (!m.isMesh) return;
    const fix = (mat) => {
      mat.metalness = Math.min(mat.metalness ?? 0, 0.3);
      mat.roughness = Math.max(mat.roughness ?? 1, 0.55);
      return mat;
    };
    m.material = Array.isArray(m.material) ? m.material.map(fix) : fix(m.material);
  });
  const root = new THREE.Group();
  root.add(scene);
  root.userData.size = size.toArray();
  return root;
}

export const models = new ModelLibrary();
