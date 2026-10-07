import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

// I modelli 3D (.glb) del gioco: si caricano una volta sola all'avvio e poi si
// clonano dove servono. Le geometrie sono condivise tra tutte le copie; i
// materiali anche, tranne quando una copia viene ricolorata.
// Ogni modello è ricentrato: il perno è in basso, al centro dell'ingombro.
// Il davanti del modello guarda verso +z.
//
// Alcuni kit (auto, città) colorano tutto con una piccola immagine esterna,
// "colormap.png": la si passa a load() e la si attacca ai materiali che la usano.
// Niente fetch per i file incorporati nel gioco (data:): certe pagine lo vietano.

// Il Furniture Kit di Kenney è piccolo: un'unità è circa 2,1 m del sogno.
export const KENNEY = 2.1;

class ModelLibrary {
  constructor() {
    this.templates = new Map();
    this.recolored = new Map();
    this.baked = new Map();
    this.pending = [];
    this.ready = Promise.resolve(this);
  }

  // urls: { nome: url }; texture: l'url della colormap del kit (se serve).
  // La promessa non fallisce mai: un modello che non si carica resta
  // semplicemente assente (e si usa il ripiego disegnato a codice).
  load(urls, { texture = null } = {}) {
    const loader = new GLTFLoader();
    const tex = texture ? loadTexture(texture).catch(() => new Promise((r) => setTimeout(r, 600)).then(() => loadTexture(texture))).catch((e) => console.warn('colormap non caricata:', e?.message || e)) : Promise.resolve(null);
    const one = async (url) => {
      const raw = await readBuffer(url);
      const { buffer, textured } = stripImages(raw);
      const gltf = await loader.parseAsync(buffer, '');
      const map = await tex;
      if (map && textured.size) {
        gltf.scene.traverse((m) => {
          if (!m.isMesh) return;
          for (const mat of [m.material].flat()) if (textured.has(mat.name)) {
            mat.map = map;
            mat.needsUpdate = true;
          }
        });
      }
      return gltf;
    };
    const jobs = Object.entries(urls).map(([name, url]) =>
      one(url)
        // un secondo tentativo, se la rete ha avuto un singhiozzo
        .catch(() => new Promise((r) => setTimeout(r, 600)).then(() => one(url)))
        .then((gltf) => this.templates.set(name, prepare(gltf.scene)))
        .catch((e) => console.warn(`modello ${name} non caricato:`, e?.message || e)),
    );
    this.pending.push(...jobs);
    this.ready = Promise.all(this.pending).then(() => this);
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
        const swap = (mat) => this.recolor(mat, colors[mat.name]);
        m.material = Array.isArray(m.material) ? m.material.map(swap) : swap(m.material);
      });
    }
    return o;
  }

  recolor(mat, c) {
    if (!c) return mat;
    if (c.isMaterial) return c;
    const key = `${mat.uuid}|${c}`;
    if (!this.recolored.has(key)) {
      const n = mat.clone();
      n.color.set(c);
      this.recolored.set(key, n);
    }
    return this.recolored.get(key);
  }

  // l'ingombro del modello in unità originali [larghezza x, altezza, profondità z]
  size(name) {
    return this.templates.get(name)?.userData.size ?? null;
  }

  // Tante copie dello stesso modello con poche chiamate di disegno: una
  // InstancedMesh per pezzo. Restituisce { meshes, set(i, matrix), done() } o null.
  instanced(name, count, { colors = null, shadows = true } = {}) {
    const t = this.templates.get(name);
    if (!t || !count) return null;
    if (!this.baked.has(name)) {
      t.updateMatrixWorld(true);
      const parts = [];
      t.traverse((m) => {
        if (!m.isMesh) return;
        const g = m.geometry.clone();
        g.applyMatrix4(m.matrixWorld);
        parts.push({ geometry: g, material: m.material });
      });
      this.baked.set(name, parts);
    }
    const meshes = this.baked.get(name).map(({ geometry, material }) => {
      const mat = Array.isArray(material) ? material.map((x) => this.recolor(x, colors?.[x.name])) : this.recolor(material, colors?.[material.name]);
      const im = new THREE.InstancedMesh(geometry, mat, count);
      im.castShadow = shadows;
      im.receiveShadow = true;
      im.frustumCulled = false;
      return im;
    });
    return {
      meshes,
      set(i, m4) {
        for (const im of meshes) im.setMatrixAt(i, m4);
      },
      done() {
        for (const im of meshes) im.instanceMatrix.needsUpdate = true;
      },
    };
  }
}

// ---------- lettura dei file senza fetch per quelli incorporati ----------
function decodeDataUrl(url) {
  const bin = atob(url.slice(url.indexOf(',') + 1));
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out.buffer;
}

async function readBuffer(url) {
  if (url.startsWith('data:')) return decodeDataUrl(url);
  const r = await fetch(url);
  if (!r.ok) throw new Error(`${r.status} ${url}`);
  return r.arrayBuffer();
}

async function loadTexture(url) {
  const blob = new Blob([await readBuffer(url)], { type: 'image/png' });
  const bitmap = await createImageBitmap(blob);
  const t = new THREE.Texture(bitmap);
  t.flipY = false; // come vuole glTF
  t.colorSpace = THREE.SRGBColorSpace;
  t.magFilter = THREE.NearestFilter; // la colormap è una tavolozza: niente sbavature
  t.needsUpdate = true;
  t.userData.glowMap = windowMask(bitmap);
  return t;
}

// I vetri delle finestre, nei kit città di Kenney, sono una sfumatura
// azzurra della tavolozza (da 126,166,226 a 157,192,237 circa; il telaio
// intorno è grigio-blu): una maschera bianca solo lì, per accenderli di notte.
const isGlass = (r, g, b) => b >= 200 && b - r >= 60 && g - r >= 20 && g - r <= 50;
function windowMask(bitmap) {
  const c = document.createElement('canvas');
  c.width = bitmap.width;
  c.height = bitmap.height;
  const g = c.getContext('2d');
  g.drawImage(bitmap, 0, 0);
  const img = g.getImageData(0, 0, c.width, c.height);
  const d = img.data;
  let n = 0;
  for (let i = 0; i < d.length; i += 4) {
    const hit = isGlass(d[i], d[i + 1], d[i + 2]);
    d[i] = d[i + 1] = d[i + 2] = hit ? 255 : 0;
    d[i + 3] = 255;
    if (hit) n++;
  }
  if (!n) return null;
  g.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(c);
  t.flipY = false;
  t.magFilter = THREE.NearestFilter;
  return t;
}

// Toglie dal .glb le immagini esterne (che non potremmo caricare) e ricorda
// quali materiali le usavano: la colormap gliela attacchiamo noi.
function stripImages(buf) {
  const dv = new DataView(buf);
  if (dv.getUint32(0, true) !== 0x46546c67) return { buffer: buf, textured: new Set() };
  const jsonLen = dv.getUint32(12, true);
  const json = JSON.parse(new TextDecoder().decode(new Uint8Array(buf, 20, jsonLen)));
  const textured = new Set();
  if (!json.images?.length) return { buffer: buf, textured };
  for (const m of json.materials || []) {
    if (m.pbrMetallicRoughness?.baseColorTexture) {
      textured.add(m.name);
      delete m.pbrMetallicRoughness.baseColorTexture;
    }
  }
  delete json.images;
  delete json.textures;
  delete json.samplers;
  const enc = new TextEncoder().encode(JSON.stringify(json));
  const pad = (4 - (enc.length % 4)) % 4;
  const jsonChunk = new Uint8Array(enc.length + pad).fill(0x20);
  jsonChunk.set(enc);
  const rest = new Uint8Array(buf, 20 + jsonLen);
  const out = new Uint8Array(20 + jsonChunk.length + rest.length);
  const o = new DataView(out.buffer);
  o.setUint32(0, 0x46546c67, true);
  o.setUint32(4, 2, true);
  o.setUint32(8, out.length, true);
  o.setUint32(12, jsonChunk.length, true);
  o.setUint32(16, 0x4e4f534a, true);
  out.set(jsonChunk, 20);
  out.set(rest, 20 + jsonChunk.length);
  return { buffer: out.buffer, textured };
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
