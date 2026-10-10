import * as THREE from 'three';
import { mulberry32 } from '../../core/noise.js';

// La bassa marea: quando la tempesta si ferma un momento (o per sempre, dopo il
// dio) il mare si ritira e dalla riva compare una fila di scogli piatti che
// porta a un isolotto, con un forziere. Quando la pioggia riprende, l'acqua
// torna su e gli scogli spariscono.

const PATHS = [
  { a: 2.2, id: 'scoglio1' },
  { a: -2.75, id: 'scoglio2' },
];

export function buildTide(scene, heightAt) {
  const disposables = [];
  const track = (o) => (disposables.push(o), o);
  const root = new THREE.Group();
  scene.add(root);
  const rock = track(new THREE.MeshStandardMaterial({ color: '#2c3234', roughness: 0.55, metalness: 0.1, flatShading: true }));
  const weed = track(new THREE.MeshStandardMaterial({ color: '#2a4a2a', roughness: 0.8 }));
  const shell = track(new THREE.MeshStandardMaterial({ color: '#d8d0bc', roughness: 0.8 }));
  const rand = mulberry32(17);
  const pads = [];
  const paths = PATHS.map((P) => {
    // la riva: il primo punto in mare andando verso fuori
    let r0 = 40;
    while (r0 < 250 && heightAt(Math.cos(P.a) * r0, Math.sin(P.a) * r0) > -0.8) r0 += 0.5;
    const dir = { x: Math.cos(P.a), z: Math.sin(P.a) };
    const side = { x: -dir.z, z: dir.x };
    const list = [];
    for (let d = -1; d < 22; d += 2.5) {
      const off = (rand() - 0.5) * 1.4;
      list.push({ x: dir.x * (r0 + d) + side.x * off, z: dir.z * (r0 + d) + side.z * off, r: 1.25 + rand() * 0.25 });
    }
    const islet = { x: dir.x * (r0 + 26), z: dir.z * (r0 + 26), r: 3.4, islet: true };
    list.push(islet);
    for (const p of list) {
      const geo = track(new THREE.CylinderGeometry(p.r, p.r * 1.25, 3, p.islet ? 11 : 7));
      const m = new THREE.Mesh(geo, rock);
      m.position.set(p.x, -1.5, p.z);
      m.rotation.y = rand() * 3;
      root.add(m);
      p.mesh = m;
      // alghe e cirripedi sopra
      for (let k = 0; k < (p.islet ? 9 : 2); k++) {
        const a = rand() * Math.PI * 2;
        const rr = rand() * p.r * 0.8;
        const w = new THREE.Mesh(track(new THREE.ConeGeometry(0.12, 0.5 + rand() * 0.6, 4)), rand() < 0.5 ? weed : shell);
        w.position.set(Math.cos(a) * rr, 1.6, Math.sin(a) * rr);
        m.add(w);
      }
      pads.push(p);
    }
    return { ...P, r0, dir, islet, shore: { x: dir.x * (r0 - 3), z: dir.z * (r0 - 3) } };
  });
  let top = -1.75;
  return {
    paths,
    // l'altezza del piano degli scogli, o null se non sei sopra uno scoglio
    groundAt(x, z) {
      for (const p of pads) if (Math.hypot(x - p.x, z - p.z) < p.r) return top;
      return null;
    },
    on(x, z) {
      return pads.some((p) => Math.hypot(x - p.x, z - p.z) < p.r + 0.3);
    },
    // la riva più vicina, per chi resta sugli scogli quando l'acqua sale
    shoreNear(x, z) {
      let best = paths[0];
      for (const P of paths) if (Math.hypot(x - P.islet.x, z - P.islet.z) < Math.hypot(x - best.islet.x, z - best.islet.z)) best = P;
      return best.shore;
    },
    get top() {
      return top;
    },
    // tide: 0 = alta marea (scogli sotto), 1 = bassa marea (scogli fuori)
    update(tide) {
      top = THREE.MathUtils.lerp(-1.75, 0.15, tide);
      for (const p of pads) p.mesh.position.y = top - 1.5;
    },
    dispose() {
      scene.remove(root);
      disposables.forEach((d) => d.dispose?.());
    },
  };
}
