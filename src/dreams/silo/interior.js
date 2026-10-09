import * as THREE from 'three';
import { mulberry32 } from '../../core/noise.js';
import { glowTexture } from '../../core/textures.js';

// Dentro il silo: più grande che fuori. Una sala cilindrica altissima, con le
// passerelle che girano sulle pareti, catene che pendono dal buio, e al centro
// una vasca d'acqua nera da cui emerge la statua gigantesca di una balena:
// il dio che dorme. Intorno, lanterne votive. Sta lontano da tutto (x = 3000).

export const INSIDE = { x: 3000, z: 0, r: 46, h: 70, pool: 13 };

function stoneTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const g = c.getContext('2d');
  g.fillStyle = '#5a6662';
  g.fillRect(0, 0, 256, 256);
  const rand = mulberry32(31);
  for (let i = 0; i < 1400; i++) {
    const v = 70 + rand() * 50;
    g.fillStyle = `rgba(${v},${v + 12},${v + 8},${0.25 + rand() * 0.3})`;
    g.fillRect(rand() * 256, rand() * 256, 2 + rand() * 6, 2 + rand() * 6);
  }
  // crepe e licheni
  g.strokeStyle = 'rgba(20,26,24,0.6)';
  for (let i = 0; i < 26; i++) {
    g.beginPath();
    let x = rand() * 256;
    let y = rand() * 256;
    g.moveTo(x, y);
    for (let k = 0; k < 6; k++) g.lineTo((x += (rand() - 0.5) * 30), (y += (rand() - 0.5) * 30));
    g.stroke();
  }
  for (let i = 0; i < 60; i++) {
    g.fillStyle = `rgba(150,170,110,${0.15 + rand() * 0.2})`;
    g.beginPath();
    g.arc(rand() * 256, rand() * 256, 2 + rand() * 7, 0, Math.PI * 2);
    g.fill();
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(3, 3);
  return t;
}

export function buildInterior(scene) {
  const disposables = [];
  const track = (o) => (disposables.push(o), o);
  const root = new THREE.Group();
  const I = INSIDE;
  root.position.set(I.x, 0, I.z);
  scene.add(root);
  const mat = (color, o = {}) => track(new THREE.MeshStandardMaterial({ color, roughness: 0.8, ...o }));
  const boxGeo = track(new THREE.BoxGeometry(1, 1, 1));
  const box = (w, h, d, m, x, y, z, parent = root) => {
    const o = new THREE.Mesh(boxGeo, m);
    o.scale.set(w, h, d);
    o.position.set(x, y, z);
    parent.add(o);
    return o;
  };

  // il pavimento: cemento, con un anello di grata intorno alla vasca
  const floor = new THREE.Mesh(track(new THREE.RingGeometry(I.pool, I.r, 64)), mat('#3a3c3e', { roughness: 0.95 }));
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  root.add(floor);
  const grate = new THREE.Mesh(track(new THREE.RingGeometry(I.pool, I.pool + 5, 64)), mat('#2a2c2e', { metalness: 0.6, roughness: 0.5 }));
  grate.rotation.x = -Math.PI / 2;
  grate.position.y = 0.02;
  root.add(grate);
  // il bordo della vasca
  const rim = new THREE.Mesh(track(new THREE.TorusGeometry(I.pool, 0.5, 8, 64)), mat('#4a4e50'));
  rim.rotation.x = Math.PI / 2;
  rim.position.y = 0.3;
  root.add(rim);
  // l'acqua nera, che brilla di verde dal fondo
  const waterMat = track(new THREE.MeshStandardMaterial({ color: '#0a1a1c', emissive: '#0a4a44', emissiveIntensity: 0.6, roughness: 0.15, metalness: 0.2 }));
  const water = new THREE.Mesh(track(new THREE.CircleGeometry(I.pool, 48)), waterMat);
  water.rotation.x = -Math.PI / 2;
  water.position.y = -0.3;
  root.add(water);

  // le pareti, viste da dentro
  const wallMat = mat('#2e3236', { metalness: 0.5, roughness: 0.6, side: THREE.BackSide });
  const wall = new THREE.Mesh(track(new THREE.CylinderGeometry(I.r, I.r, I.h, 64, 1, true)), wallMat);
  wall.position.y = I.h / 2;
  root.add(wall);
  // il soffitto, con un oblò al centro da cui entrano i lampi
  const ceil = new THREE.Mesh(track(new THREE.RingGeometry(7, I.r, 64)), mat('#1a1c1e', { side: THREE.DoubleSide }));
  ceil.rotation.x = Math.PI / 2;
  ceil.position.y = I.h;
  root.add(ceil);
  const skylightMat = track(new THREE.MeshBasicMaterial({ color: '#2a3440' }));
  const skylight = new THREE.Mesh(track(new THREE.CircleGeometry(7, 32)), skylightMat);
  skylight.rotation.x = Math.PI / 2;
  skylight.position.y = I.h + 0.1;
  root.add(skylight);
  // le costolature e gli anelli
  const ribMat = mat('#3a3e42', { metalness: 0.6, roughness: 0.5 });
  for (let i = 0; i < 24; i++) {
    const a = (i / 24) * Math.PI * 2;
    box(0.8, I.h, 0.8, ribMat, Math.cos(a) * (I.r - 0.4), I.h / 2, Math.sin(a) * (I.r - 0.4));
  }
  // le passerelle circolari, a tre altezze, con la ringhiera
  for (const y of [16, 32, 48]) {
    const deck = new THREE.Mesh(track(new THREE.RingGeometry(I.r - 4, I.r, 64)), mat('#2a2c2e', { metalness: 0.6, side: THREE.DoubleSide }));
    deck.rotation.x = -Math.PI / 2;
    deck.position.y = y;
    root.add(deck);
    const rail = new THREE.Mesh(track(new THREE.TorusGeometry(I.r - 4, 0.08, 4, 96)), ribMat);
    rail.rotation.x = Math.PI / 2;
    rail.position.y = y + 1.1;
    root.add(rail);
  }
  // catene che pendono dal buio
  const chainMat = mat('#1a1a1c', { metalness: 0.7 });
  const rand = mulberry32(13);
  for (let i = 0; i < 18; i++) {
    const a = rand() * Math.PI * 2;
    const r = 16 + rand() * 24;
    const len = 12 + rand() * 30;
    box(0.15, len, 0.15, chainMat, Math.cos(a) * r, I.h - len / 2, Math.sin(a) * r);
    // un gancio in fondo
    box(0.5, 0.5, 0.15, chainMat, Math.cos(a) * r, I.h - len, Math.sin(a) * r);
  }
  // i tubi verticali
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2 + 0.15;
    const p = new THREE.Mesh(track(new THREE.CylinderGeometry(0.6, 0.6, I.h, 10)), mat('#4a3a2e', { metalness: 0.5 }));
    p.position.set(Math.cos(a) * (I.r - 2), I.h / 2, Math.sin(a) * (I.r - 2));
    root.add(p);
  }

  // ---------- La balena ----------
  const stone = track(new THREE.MeshStandardMaterial({ map: track(stoneTexture()), color: '#d8e4e0', roughness: 0.85, emissive: '#0a3a4a', emissiveIntensity: 0.25 }));
  const whale = new THREE.Group();
  {
    // il corpo: un profilo da balena fatto ruotare (testa tonda, coda sottile)
    const L = 28;
    const prof = [];
    for (let i = 0; i <= 24; i++) {
      const u = i / 24;
      // raggio lungo il corpo: 0 in punta, grosso a un terzo, sottile alla coda
      const r = u < 0.12 ? Math.sin((u / 0.12) * Math.PI / 2) * 4.2 : 4.2 * Math.pow(1 - (u - 0.12) / 0.88, 0.75) + 0.5 * (1 - u);
      prof.push(new THREE.Vector2(Math.max(0.05, r), u * L));
    }
    const body = new THREE.Mesh(track(new THREE.LatheGeometry(prof, 28)), stone);
    body.scale.set(1, 1, 0.85);
    body.rotation.x = Math.PI / 2; // la testa verso +z
    body.position.z = L / 2;
    body.rotation.z = 0;
    body.castShadow = true;
    const bodyPivot = new THREE.Group();
    bodyPivot.add(body);
    body.position.set(0, 0, 0);
    body.rotation.set(-Math.PI / 2, 0, 0);
    whale.add(bodyPivot);
    // la coda: due pinne piatte
    for (const s of [-1, 1]) {
      const fl = new THREE.Mesh(track(new THREE.SphereGeometry(1, 14, 8)), stone);
      fl.scale.set(4.2, 0.35, 1.8);
      fl.position.set(s * 3.2, 0, -L + 0.8);
      fl.rotation.y = s * 0.45;
      whale.add(fl);
    }
    // le pinne pettorali
    for (const s of [-1, 1]) {
      const fin = new THREE.Mesh(track(new THREE.SphereGeometry(1, 12, 8)), stone);
      fin.scale.set(4.6, 0.35, 1.3);
      fin.position.set(s * 4.6, -1.8, -6);
      fin.rotation.set(0.2, s * -0.5, s * -0.5);
      whale.add(fin);
    }
    // la bocca: una linea scura lungo la mascella, ai due lati
    for (const sx of [-1, 1]) {
      const lip = new THREE.Mesh(boxGeo, mat('#1a2220'));
      lip.scale.set(0.18, 0.18, 6.5);
      lip.position.set(sx * 3.55, -1.6, -3.6);
      lip.rotation.y = sx * -0.28;
      whale.add(lip);
    }
    // le scanalature sotto la gola
    for (let k = -3; k <= 3; k++) box(0.12, 0.12, 7, mat('#4a5652'), k * 0.9, -3.6, -4, whale);
    // i cirripedi: piccoli coni incrostati
    const barn = track(new THREE.ConeGeometry(0.3, 0.5, 6));
    const barnMat = mat('#c8c4b4');
    for (let i = 0; i < 70; i++) {
      // sulla pelle: alla distanza giusta dall'asse, lungo il corpo
      const u = 0.1 + rand() * 0.6;
      const z = -u * L;
      const rr = (u < 0.12 ? Math.sin((u / 0.12) * Math.PI / 2) * 4.2 : 4.2 * Math.pow(1 - (u - 0.12) / 0.88, 0.75) + 0.5 * (1 - u)) * 0.97;
      const a = rand() * Math.PI * 2;
      const b = new THREE.Mesh(barn, barnMat);
      b.position.set(Math.cos(a) * rr, Math.sin(a) * rr * 0.85, z);
      b.lookAt(b.position.x * 2, b.position.y * 2, z);
      b.rotateX(Math.PI / 2);
      whale.add(b);
    }
  }
  // gli occhi: si accendono quando il dio si sveglia
  const eyeMat = track(new THREE.MeshStandardMaterial({ color: '#1a2a2a', emissive: '#7af8ff', emissiveIntensity: 0 }));
  for (const s of [-1, 1]) {
    const eye = new THREE.Mesh(track(new THREE.SphereGeometry(0.55, 12, 8)), eyeMat);
    eye.position.set(s * 3.3, -0.4, -4.6);
    whale.add(eye);
  }
  // in posa: emerge dall'acqua con la testa in su, verso l'ingresso (+z)
  const whalePivot = new THREE.Group();
  whale.position.set(0, 0, 0);
  whale.rotation.x = -0.7;
  whale.position.set(0, 14, 8);
  whalePivot.add(whale);
  root.add(whalePivot);
  // il piedistallo di roccia
  const rock = new THREE.Mesh(track(new THREE.DodecahedronGeometry(7, 1)), mat('#2a302e', { roughness: 1, flatShading: true }));
  rock.scale.set(1.3, 0.55, 1.4);
  rock.position.set(0, -0.6, -3);
  root.add(rock);

  // ---------- Le lanterne votive intorno alla vasca ----------
  const glow = track(glowTexture('rgba(255,200,120,1)'));
  const lanterns = [];
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * Math.PI * 2;
    const r = I.pool + 3;
    const x = Math.cos(a) * r;
    const z = Math.sin(a) * r;
    box(0.1, 1.2, 0.1, mat('#2a2420'), x, 0.6, z);
    const l = new THREE.Mesh(track(new THREE.BoxGeometry(0.35, 0.45, 0.35)), track(new THREE.MeshBasicMaterial({ color: '#ffc878' })));
    l.position.set(x, 1.35, z);
    const h = new THREE.Sprite(track(new THREE.SpriteMaterial({ map: glow, color: '#ffb060', blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0.55 })));
    h.position.set(x, 1.35, z);
    h.scale.set(2, 2, 1);
    root.add(l, h);
    lanterns.push(h);
  }

  // le luci di dentro
  const lights = [];
  const poolLight = new THREE.PointLight('#3af0d0', 60, 60, 1.6);
  poolLight.position.set(0, 2, 0);
  const top = new THREE.SpotLight('#c8d8ff', 2200, 120, 0.5, 0.6, 1.4);
  top.position.set(0, I.h - 2, 8);
  top.target.position.set(0, 8, 6);
  const warm = new THREE.PointLight('#ffb060', 40, 50, 1.6);
  warm.position.set(0, 5, 26);
  root.add(poolLight, top, top.target, warm);
  const fill = new THREE.PointLight('#8aa8c8', 70, 90, 1.2);
  fill.position.set(0, 24, 30);
  root.add(fill);
  lights.push({ light: poolLight, base: 60 }, { light: top, base: 2200 }, { light: warm, base: 40 }, { light: fill, base: 70 });
  lights.forEach((L) => (L.light.visible = false));

  const c = (x, z, y = 0) => new THREE.Vector3(I.x + x, y, I.z + z);
  return {
    root,
    lights,
    stone,
    eyeMat,
    whale,
    whalePivot,
    skylightMat,
    entrance: c(0, I.r - 4),
    center: c(0, 0),
    // dove si combatte: il gruppo davanti, le creature verso la statua
    arena: {
      party: [c(-4, 32), c(0, 33.2), c(4, 32)],
      enemies: [c(-6, 22), c(0, 20.5), c(6, 22)],
      boss: c(0, 4, 0),
    },
    setLit(on) {
      lights.forEach((L) => (L.light.visible = on));
    },
    // il risveglio: occhi accesi, venature azzurre nella pietra
    setAwake(k) {
      eyeMat.emissiveIntensity = k * 3;
      stone.emissiveIntensity = 0.25 + k * 0.8;
      waterMat.emissiveIntensity = 0.6 + k * 1.2;
    },
    update(t) {
      lanterns.forEach((h, i) => (h.material.opacity = 0.45 + Math.sin(t * 6 + i * 1.7) * 0.08 + Math.random() * 0.05));
      waterMat.emissiveIntensity += (Math.sin(t * 0.8) * 0.05);
      whalePivot.position.y = Math.sin(t * 0.25) * 0.08;
    },
    dispose() {
      scene.remove(root);
      disposables.forEach((d) => d.dispose?.());
    },
  };
}
