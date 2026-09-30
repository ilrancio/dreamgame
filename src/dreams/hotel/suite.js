import * as THREE from 'three';
import { prizeModel } from './prizes.js';

// La suite 1313: una stanza da vivere, non da attraversare.
// Coordinate locali: x verso est, z verso nord. Le pareti ovest e nord sono
// muri esterni dell'hotel (lì stanno finestra, camino, bagno e letti); le porte
// possono aprirsi solo sui lati est e sud.
export function buildSuite(a, rb) {
  const W = (x, z) => new THREE.Vector3(a.cx + x, 0, a.cz + z);
  const wood = a.mat('#6a4028');
  const darkWood = a.mat('#3a2416');
  const sheet = a.mat('#f0ece0');
  const stone = a.mat('#7a7068');
  const E = 8.5; // faccia interna dei muri

  // ---------- Bagno (angolo nord-ovest) ----------
  const tiles = a.texMat('tiles', ['#e8eef0', '#b8c4c8'], [3, 3]);
  a.box(5.3, 0.03, 5.9, tiles, -E + 2.65, 0.015, E - 2.95, { collide: false });
  const partition = a.mat('#d8ccb0');
  a.box(0.2, 3, 3.7, partition, -3.2, 1.5, E - 1.85); // lato est, con passaggio verso sud
  a.box(5.3, 3, 0.2, partition, -E + 2.65, 1.5, 2.6); // lato sud
  // doccia: vetro, piatto e soffione
  const glass = a.mat('#cfe8f0', { transparent: 0.3 });
  a.box(0.06, 2.3, 1.9, glass, -6.6, 1.15, E - 0.95);
  a.box(1.9, 0.08, 1.9, a.mat('#9aa4a8'), -E + 0.95, 0.04, E - 0.95, { collide: false });
  a.cyl(0.03, 0.03, 0.5, a.mat('#c8ccd0', { metal: true }), -7.5, 2.45, E - 0.25, { collide: false });
  a.cyl(0.18, 0.12, 0.06, a.mat('#c8ccd0', { metal: true }), -7.5, 2.2, E - 0.5, { collide: false });
  // lavandino e specchio
  a.box(0.6, 0.9, 1.1, a.mat('#f4f4f0'), -E + 0.3, 0.45, 4.2);
  a.box(0.05, 1.1, 1, a.mat('#e0e8f8', { metal: true, emissive: 0.08 }), -E + 0.03, 1.75, 4.2, { collide: false });

  // ---------- Letti (parete nord) ----------
  const beds = [];
  const lampMeshes = [];
  for (const [x, cover] of [[0.5, '#2f4f8f'], [4.5, '#b8862a']]) {
    const z = E - 1.75;
    a.box(2.2, 0.5, 3.4, wood, x, 0.25, z);
    a.box(2.1, 0.3, 3.2, sheet, x, 0.62, z, { collide: false });
    a.box(2.15, 0.12, 2.1, a.mat(cover), x, 0.8, z - 0.5, { collide: false });
    a.box(1.2, 0.25, 0.6, sheet, x, 0.85, z + 1.2, { collide: false });
    a.box(2.2, 1.5, 0.15, darkWood, x, 0.95, E - 0.08, { collide: false });
    beds.push(W(x, z - 2.2));
  }
  a.box(0.8, 0.7, 0.6, darkWood, 2.5, 0.35, E - 0.4);
  const lampShadeMat = new THREE.MeshStandardMaterial({ color: '#ffe2b0', emissive: '#ffb860', emissiveIntensity: 1.6 });
  a.track(lampShadeMat);
  const shade = a.cyl(0.18, 0.26, 0.3, lampShadeMat, 2.5, 1.05, E - 0.4, { collide: false, dynamic: true });
  lampMeshes.push(shade);
  const lampLight = new THREE.PointLight('#ffc27a', 14, 12, 1.6);
  lampLight.position.set(a.cx + 2.5, 1.4, a.cz + E - 0.7);
  rb.dynamic.add(lampLight);

  // ---------- Angolo del tè, davanti alla finestra (parete ovest) ----------
  const tableP = { x: -6.1, z: -2.4 };
  const winZ = 0.7; // la finestra è accanto al tavolino, verso nord
  a.cyl(0.75, 0.75, 0.06, darkWood, tableP.x, 0.76, tableP.z);
  a.cyl(0.07, 0.1, 0.74, darkWood, tableP.x, 0.37, tableP.z, { collide: false });
  const chairs = [];
  for (const [dz, facing] of [[1.25, Math.PI], [-1.25, 0]]) {
    const cz = tableP.z + dz;
    a.box(0.6, 0.08, 0.6, a.mat('#8a2a2a'), tableP.x, 0.46, cz, { collide: false });
    for (const [lx, lz] of [[-0.25, -0.25], [0.25, -0.25], [-0.25, 0.25], [0.25, 0.25]]) a.box(0.05, 0.44, 0.05, darkWood, tableP.x + lx, 0.22, cz + lz, { collide: false });
    a.box(0.6, 0.7, 0.06, darkWood, tableP.x, 0.85, cz + Math.sign(dz) * 0.28, { collide: false });
    chairs.push({ pos: W(tableP.x, cz), facing });
  }
  // teiera e tazze
  const porcelain = a.mat('#f2eee6');
  a.sphere(0.13, porcelain, tableP.x + 0.15, 0.9, tableP.z, { collide: false }).scale.set(1, 0.85, 1);
  a.cyl(0.02, 0.03, 0.14, porcelain, tableP.x + 0.3, 0.93, tableP.z, { collide: false }).rotation.z = -1;
  for (const dz of [0.45, -0.45]) a.cyl(0.05, 0.04, 0.07, porcelain, tableP.x - 0.15, 0.83, tableP.z + dz, { collide: false });
  // due pistole compaiono sul tavolo al mattino
  const guns = new THREE.Group();
  for (const dz of [0.25, -0.25]) {
    const g = new THREE.Mesh(a.track(new THREE.BoxGeometry(0.26, 0.05, 0.08)), a.mat('#2a2c30'));
    g.position.set(a.cx + tableP.x - 0.3, 0.82, a.cz + tableP.z + dz);
    g.rotation.y = 0.4;
    guns.add(g);
  }
  guns.visible = false;
  rb.dynamic.add(guns);

  // finestra con il panorama dipinto (notte / alba)
  const views = { night: a.track(viewTexture(false)), day: a.track(viewTexture(true)) };
  const viewMat = a.track(new THREE.MeshBasicMaterial({ map: views.night }));
  const view = new THREE.Mesh(a.track(new THREE.PlaneGeometry(3.6, 2.6)), viewMat);
  view.position.set(a.cx - E + 0.03, 2.3, a.cz + winZ);
  view.rotation.y = Math.PI / 2;
  rb.dynamic.add(view);
  a.box(0.15, 0.15, 3.9, darkWood, -E + 0.08, 0.95, winZ, { collide: false });
  a.box(0.15, 0.15, 3.9, darkWood, -E + 0.08, 3.65, winZ, { collide: false });
  a.box(0.15, 0.1, 3.6, darkWood, -E + 0.1, 2.3, winZ, { collide: false });
  for (const dz of [-1.95, 1.95]) a.box(0.4, 3.2, 0.9, a.mat('#7a1a24'), -E + 0.25, 1.95, winZ + dz * 1.0, { collide: false });

  // ---------- Camino e poltrona ----------
  const fireZ = -6.6;
  a.box(0.9, 2.6, 2.8, stone, -E + 0.45, 1.3, fireZ);
  a.box(0.95, 1.1, 1.5, a.mat('#120c08'), -E + 0.5, 0.6, fireZ, { collide: false });
  a.box(1.1, 0.15, 3, darkWood, -E + 0.55, 2.65, fireZ, { collide: false });
  const fireGlow = a.glowSprite('#ff8a3a', -E + 1.1, 0.55, fireZ, 2.2, 0.9);
  const fireLight = new THREE.PointLight('#ff9a4a', 10, 10, 1.6);
  fireLight.position.set(a.cx - E + 1.6, 0.9, a.cz + fireZ);
  rb.dynamic.add(fireLight);
  a.anim((t) => {
    const f = 0.85 + Math.sin(t * 11) * 0.08 + Math.sin(t * 17.3) * 0.06;
    fireGlow.scale.setScalar(2.2 * f);
    fireLight.intensity = 10 * f;
  });
  a.box(1.1, 0.5, 1.1, a.mat('#5a2a1a'), -5.2, 0.25, fireZ);
  a.box(1.1, 0.9, 0.25, a.mat('#5a2a1a'), -4.75, 0.9, fireZ, { collide: false, rotY: Math.PI / 2 });
  const armchair = { pos: W(-5.2, fireZ), facing: -Math.PI / 2 };

  // mensola dei premi della sala giochi (parete ovest, tra tavolino e camino)
  const shelfZ = -4.35;
  a.box(0.08, 2.2, 1.5, darkWood, -E + 0.04, 1.1, shelfZ);
  for (const dz of [-0.75, 0.75]) a.box(0.5, 2.2, 0.05, darkWood, -E + 0.25, 1.1, shelfZ + dz, { collide: false });
  for (let r = 0; r < 4; r++) a.box(0.5, 0.05, 1.5, wood, -E + 0.25, 0.43 + r * 0.6, shelfZ, { collide: false });
  a.collider(-E + 0.25, shelfZ, 0.5, 1.5);
  const shelf = new THREE.Group();
  rb.dynamic.add(shelf);
  const shelfTrack = [];

  // divano e tappeto
  a.box(4.4, 0.03, 3.2, a.mat('#8a2a2a'), -1, 0.02, -2.5, { collide: false });
  a.box(1, 0.8, 3, a.mat('#4a5a7a'), 1.8, 0.4, -2.5);

  return {
    beds,
    chairs,
    armchair,
    table: W(tableP.x, tableP.z),
    teaSpout: new THREE.Vector3(a.cx + tableP.x + 0.1, 1, a.cz + tableP.z),
    shower: W(-7.5, E - 1),
    showerHead: new THREE.Vector3(a.cx - 7.5, 2.15, a.cz + E - 0.5),
    windowSpot: W(-E + 1.4, winZ),
    windowLook: new THREE.Vector3(a.cx - E, 2.3, a.cz + winZ),
    lampSpot: W(2.5, E - 1.6),
    fireplace: W(-E + 1.4, fireZ),
    guns,
    setLamp(on) {
      lampLight.visible = on;
      lampShadeMat.emissiveIntensity = on ? 1.6 : 0.05;
    },
    // i premi vinti: tre per ripiano, dal basso verso l'alto
    setPrizes(ids = []) {
      shelf.clear();
      shelfTrack.forEach((d) => d.dispose());
      shelfTrack.length = 0;
      const tr = (o) => (shelfTrack.push(o), o);
      ids.slice(0, 9).forEach((id, i) => {
        const m = prizeModel(id, tr);
        const row = Math.floor(i / 3);
        m.position.set(a.cx - E + 0.28, 0.46 + row * 0.6, a.cz + shelfZ + ((i % 3) - 1) * 0.45);
        m.rotation.y = Math.PI / 2;
        shelf.add(m);
      });
    },
    setDay(day) {
      viewMat.map = day ? views.day : views.night;
      viewMat.needsUpdate = true;
    },
  };
}

// Panorama dipinto su canvas: montagne, cielo, e in lontananza il campo del primo sogno.
function viewTexture(day) {
  const c = document.createElement('canvas');
  c.width = 512;
  c.height = 370;
  const g = c.getContext('2d');
  const sky = g.createLinearGradient(0, 0, 0, 370);
  if (day) {
    sky.addColorStop(0, '#8ec2f0');
    sky.addColorStop(0.6, '#f8d8b0');
    sky.addColorStop(1, '#ffe8c8');
  } else {
    sky.addColorStop(0, '#050a1e');
    sky.addColorStop(0.7, '#1c2a5a');
    sky.addColorStop(1, '#2a3a6a');
  }
  g.fillStyle = sky;
  g.fillRect(0, 0, 512, 370);
  if (!day) {
    for (let i = 0; i < 160; i++) {
      g.fillStyle = `rgba(255,255,255,${0.3 + Math.random() * 0.7})`;
      g.fillRect(Math.random() * 512, Math.random() * 220, 1.5, 1.5);
    }
    g.fillStyle = '#f4f0e0';
    g.beginPath();
    g.arc(390, 80, 26, 0, Math.PI * 2);
    g.fill();
  } else {
    const sun = g.createRadialGradient(120, 250, 0, 120, 250, 90);
    sun.addColorStop(0, 'rgba(255,250,220,1)');
    sun.addColorStop(1, 'rgba(255,230,180,0)');
    g.fillStyle = sun;
    g.fillRect(0, 150, 260, 200);
  }
  const ridge = (y0, amp, col, seed) => {
    g.fillStyle = col;
    g.beginPath();
    g.moveTo(0, 370);
    for (let x = 0; x <= 512; x += 8) {
      const y = y0 - Math.abs(Math.sin(x * 0.013 + seed) * amp) - Math.abs(Math.sin(x * 0.041 + seed * 2)) * amp * 0.35;
      g.lineTo(x, y);
    }
    g.lineTo(512, 370);
    g.fill();
  };
  ridge(260, 90, day ? '#8a9ab8' : '#141c3a', 1);
  ridge(300, 60, day ? '#5a6e8a' : '#0c1228', 3);
  // il campo laggiù, e un bagliore rosso lontano
  g.fillStyle = day ? '#6a8a4a' : '#0a1410';
  g.fillRect(0, 330, 512, 40);
  const glow = g.createRadialGradient(300, 332, 0, 300, 332, 30);
  glow.addColorStop(0, day ? 'rgba(255,120,60,0.35)' : 'rgba(255,70,30,0.8)');
  glow.addColorStop(1, 'rgba(255,60,20,0)');
  g.fillStyle = glow;
  g.fillRect(260, 300, 80, 60);
  // cornice della finestra a croce
  g.fillStyle = '#3a2416';
  g.fillRect(250, 0, 12, 370);
  g.fillRect(0, 180, 512, 10);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
