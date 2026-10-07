import * as THREE from 'three';
import { mulberry32 } from '../../core/noise.js';
import { glowTexture, textTexture } from '../../core/textures.js';
import { models } from '../../core/models.js';
import { FIELD, HOTEL, START, DEMON_POS, ROAD_HALF, VILLAGE, MALL } from './terrain.js';

// Griglia spaziale per gli ostacoli fissi (alberi, gambe del demone).
export class ColliderGrid {
  constructor(cell = 25) {
    this.cell = cell;
    this.map = new Map();
  }

  add(x, z, r) {
    const key = `${Math.floor(x / this.cell)},${Math.floor(z / this.cell)}`;
    if (!this.map.has(key)) this.map.set(key, []);
    this.map.get(key).push({ x, z, r });
  }

  near(x, z, out = []) {
    out.length = 0;
    const cx = Math.floor(x / this.cell);
    const cz = Math.floor(z / this.cell);
    for (let dz = -1; dz <= 1; dz++) {
      for (let dx = -1; dx <= 1; dx++) {
        const arr = this.map.get(`${cx + dx},${cz + dz}`);
        if (arr) out.push(...arr);
      }
    }
    return out;
  }
}

export function buildScenery(scene, terrain) {
  const rand = mulberry32(99);
  const disposables = [];
  const track = (o) => (disposables.push(o), o);
  const colliders = new ColliderGrid();
  const group = new THREE.Group();
  scene.add(group);
  const m4 = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const s = new THREE.Vector3();
  const p = new THREE.Vector3();
  const up = new THREE.Vector3(0, 1, 0);

  // Alberi del Nature Kit di Kenney, se ci sono: le varianti a turno, tante
  // copie per variante. list: [x, y, z, scala]; k: metri per unità del kit.
  const kitTrees = (list, variants, k, yDrop = 0.3) => {
    const avail = variants.filter((v) => models.has(v));
    if (!avail.length) return false;
    const buckets = avail.map(() => []);
    list.forEach((t, i) => buckets[i % avail.length].push(t));
    avail.forEach((name, b) => {
      const inst = models.instanced(name, buckets[b].length);
      if (!inst) return;
      buckets[b].forEach(([x, h, z, sc], i) => {
        q.setFromAxisAngle(up, rand() * 6.28);
        const v = k * sc;
        m4.compose(p.set(x, h - yDrop, z), q, s.set(v, v * (0.9 + rand() * 0.25), v));
        inst.set(i, m4);
      });
      inst.done();
      inst.meshes.forEach((m) => track(group.add(m) && m));
    });
    return true;
  };

  // ---------- Pini in montagna ----------
  const pines = [];
  for (let tries = 0; tries < 60000 && pines.length < 3200; tries++) {
    const x = (rand() - 0.5) * 3000;
    const z = (rand() - 0.5) * 3000;
    const e = terrain.fieldEllipse(x, z);
    if (e < 1.0) continue;
    const h = terrain.heightAt(x, z);
    if (h > 400) continue;
    const n = terrain.normalAt(x, z, new THREE.Vector3(), 4);
    if (n.y < 0.78) continue;
    const rd = terrain.roadInfo(x, z).dist;
    if (rd < ROAD_HALF + 12) continue;
    if (Math.hypot(x - HOTEL.x, z - (HOTEL.z - 20)) < 95) continue;
    if (Math.hypot(x - VILLAGE.x, z - VILLAGE.z) < VILLAGE.r + 25) continue;
    if (Math.hypot(x - MALL.x, z - MALL.z) < MALL.r + 20) continue;
    pines.push([x, h, z, 0.8 + rand() * 0.9]);
  }
  // un anello di pini attorno all'hotel
  for (let k = 0; k < 70; k++) {
    const a = rand() * Math.PI * 2;
    const r = 105 + rand() * 90;
    const x = HOTEL.x + Math.cos(a) * r;
    const z = HOTEL.z + Math.sin(a) * r;
    if (z < HOTEL.z - 60 && Math.abs(x - HOTEL.x) < 40) continue;
    if (terrain.roadInfo(x, z).dist < ROAD_HALF + 10) continue;
    pines.push([x, terrain.heightAt(x, z), z, 1 + rand() * 0.6]);
  }
  const kitPines = kitTrees(pines, ['tree_pineTallA', 'tree_pineTallB', 'tree_pineDefaultA', 'tree_pineDefaultB'], 15);
  for (const [x, , z, sc] of pines) colliders.add(x, z, 1.2 * sc);
  if (!kitPines) {
  const crownGeo = track(new THREE.ConeGeometry(4.5, 16, 7));
  crownGeo.translate(0, 13, 0);
  const crown2Geo = track(new THREE.ConeGeometry(3.4, 11, 7));
  crown2Geo.translate(0, 19, 0);
  const trunkGeo = track(new THREE.CylinderGeometry(0.6, 0.9, 7, 6));
  trunkGeo.translate(0, 3.5, 0);
  const pineMat = track(new THREE.MeshLambertMaterial({ color: '#23422c' }));
  const pineMat2 = track(new THREE.MeshLambertMaterial({ color: '#2d5236' }));
  const trunkMat = track(new THREE.MeshLambertMaterial({ color: '#4a3222' }));
  const crowns = new THREE.InstancedMesh(crownGeo, pineMat, pines.length);
  const crowns2 = new THREE.InstancedMesh(crown2Geo, pineMat2, pines.length);
  const trunks = new THREE.InstancedMesh(trunkGeo, trunkMat, pines.length);
  pines.forEach(([x, h, z, sc], i) => {
    q.setFromAxisAngle(up, rand() * 6.28);
    m4.compose(p.set(x, h - 0.5, z), q, s.set(sc, sc * (0.9 + rand() * 0.3), sc));
    crowns.setMatrixAt(i, m4);
    crowns2.setMatrixAt(i, m4);
    trunks.setMatrixAt(i, m4);
  });
  [crowns, crowns2, trunks].forEach((m) => {
    m.castShadow = true;
    m.receiveShadow = true;
    group.add(m);
  });
  }

  // ---------- Alberi sparsi nel campo (ostacoli) ----------
  const oaks = [];
  for (let tries = 0; tries < 4000 && oaks.length < 110; tries++) {
    const x = FIELD.cx + (rand() - 0.5) * FIELD.rx * 2;
    const z = FIELD.cz + (rand() - 0.5) * FIELD.rz * 2;
    if (terrain.fieldEllipse(x, z) > 0.9) continue;
    if (Math.hypot(x - START.x, z - START.z) < 120) continue;
    if (Math.hypot(x - DEMON_POS.x, z - DEMON_POS.z) < 80) continue;
    if (terrain.roadInfo(x, z).dist < 30) continue;
    oaks.push([x, terrain.heightAt(x, z), z, 0.8 + rand() * 0.7]);
  }
  for (const [x, , z, sc] of oaks) colliders.add(x, z, 1.4 * sc);
  if (!kitTrees(oaks, ['tree_oak', 'tree_default', 'tree_fat'], 11)) {
  const oakCrownGeo = track(new THREE.IcosahedronGeometry(6, 1));
  oakCrownGeo.translate(0, 10, 0);
  const oakTrunkGeo = track(new THREE.CylinderGeometry(0.8, 1.2, 8, 7));
  oakTrunkGeo.translate(0, 4, 0);
  const oakMat = track(new THREE.MeshLambertMaterial({ color: '#3f6a2a', flatShading: true }));
  const oakCrowns = new THREE.InstancedMesh(oakCrownGeo, oakMat, oaks.length);
  const oakTrunks = new THREE.InstancedMesh(oakTrunkGeo, trunkMat, oaks.length);
  oaks.forEach(([x, h, z, sc], i) => {
    q.setFromAxisAngle(up, rand() * 6.28);
    m4.compose(p.set(x, h - 0.4, z), q, s.set(sc, sc * (0.8 + rand() * 0.4), sc));
    oakCrowns.setMatrixAt(i, m4);
    oakTrunks.setMatrixAt(i, m4);
  });
  [oakCrowns, oakTrunks].forEach((m) => {
    m.castShadow = true;
    m.receiveShadow = true;
    group.add(m);
  });
  }

  // ---------- Lampioni lungo la strada (accesi di notte) ----------
  const glowTex = track(glowTexture('rgba(255,210,150,1)'));
  const poleGeo = track(new THREE.CylinderGeometry(0.15, 0.2, 7, 6));
  poleGeo.translate(0, 3.5, 0);
  const poleMat = track(new THREE.MeshLambertMaterial({ color: '#2a2622' }));
  const lampSprites = [];
  const road = terrain.road;
  const lampSpacing = 55;
  let nextLamp = 200;
  let side = 1;
  const lampPos = [];
  for (const r of road) {
    if (r.s < nextLamp) continue;
    nextLamp += lampSpacing;
    side = -side;
    const x = r.x + r.tz * (ROAD_HALF + 3) * side;
    const z = r.z - r.tx * (ROAD_HALF + 3) * side;
    // il braccio del lampione guarda la strada
    lampPos.push([x, terrain.heightAt(x, z), z, r.s, Math.atan2(-(r.x - x), -(r.z - z))]);
  }
  // il lampione curvo del Roads Kit di Kenney, se c'è; se no un palo semplice
  const kitLamps = models.instanced('light-curved', lampPos.length);
  const poles = kitLamps ? null : new THREE.InstancedMesh(poleGeo, poleMat, lampPos.length);
  lampPos.forEach(([x, h, z, rs, yaw], i) => {
    let lx = x;
    let lz = z;
    let ly = h + 7.2;
    if (kitLamps) {
      q.setFromAxisAngle(up, yaw);
      m4.compose(p.set(x, h, z), q, s.setScalar(10.5));
      kitLamps.set(i, m4);
      lx = x - Math.sin(yaw) * 2;
      lz = z - Math.cos(yaw) * 2;
      ly = h + 6.6;
    } else {
      m4.compose(p.set(x, h, z), q.identity(), s.set(1, 1, 1));
      poles.setMatrixAt(i, m4);
    }
    colliders.add(x, z, 0.5);
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: '#ffcf8a', blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0 }));
    track(sp.material);
    sp.position.set(lx, ly, lz);
    sp.scale.set(7, 7, 1);
    sp.userData.s = rs;
    group.add(sp);
    lampSprites.push(sp);
  });
  if (kitLamps) {
    kitLamps.done();
    kitLamps.meshes.forEach((m) => track(group.add(m) && m));
  } else group.add(poles);

  // ---------- Cartello e faro di luce all'imbocco della strada ----------
  const entrance = road.find((r) => r.s > 150) || road[0];
  const signTex = track(textTexture('HOTEL  ↑', { width: 512, height: 160, font: '700 90px Inter, sans-serif', color: '#f6e7c8', bg: '#3b2415' }));
  const signMat = track(new THREE.MeshLambertMaterial({ map: signTex, side: THREE.DoubleSide }));
  const sign = new THREE.Group();
  const sx = entrance.x + entrance.tz * (ROAD_HALF + 4);
  const sz = entrance.z - entrance.tx * (ROAD_HALF + 4);
  sign.position.set(sx, terrain.heightAt(sx, sz), sz);
  sign.rotation.y = Math.atan2(entrance.tx, entrance.tz) + Math.PI;
  const board = new THREE.Mesh(track(new THREE.PlaneGeometry(6, 1.9)), signMat);
  board.position.y = 4;
  const post = new THREE.Mesh(poleGeo, poleMat);
  sign.add(board, post);
  group.add(sign);

  const beamMat = track(new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
    uniforms: { opacity: { value: 1 }, time: { value: 0 } },
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
    fragmentShader: `uniform float opacity; uniform float time; varying vec2 vUv;
      void main(){
        float edge = sin(vUv.x * 3.14159);
        float a = pow(1.0 - vUv.y, 1.6) * edge * 0.45 * opacity * (0.85 + 0.15 * sin(time * 2.0 + vUv.y * 20.0));
        gl_FragColor = vec4(vec3(1.0, 0.85, 0.6) * a, a);
      }`,
  }));
  const beacon = new THREE.Mesh(track(new THREE.CylinderGeometry(7, 7, 420, 24, 1, true)), beamMat);
  const b0 = road.find((r) => r.s > 90) || road[0];
  beacon.position.set(b0.x, terrain.heightAt(b0.x, b0.z) + 210, b0.z);
  group.add(beacon);

  return {
    group,
    colliders,
    entrance: new THREE.Vector3(b0.x, terrain.heightAt(b0.x, b0.z), b0.z),
    update(t, night, carS) {
      beamMat.uniforms.time.value = t;
      beamMat.uniforms.opacity.value = Math.max(0, 1 - Math.max(0, carS - 60) / 120);
      for (const sp of lampSprites) sp.material.opacity = night;
    },
    dispose() {
      disposables.forEach((d) => d.dispose());
      group.removeFromParent();
    },
  };
}
