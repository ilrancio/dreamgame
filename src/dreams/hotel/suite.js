import * as THREE from 'three';
import { prizeModel } from './prizes.js';

// La suite 1313: una stanza da vivere, e un posto sicuro.
// Coordinate in metri dall'angolo sud-ovest della suite (x verso est, z verso
// nord). La suite è 18 × 24 m: porta principale a nord (sul corridoio), porta di
// servizio a ovest (dritta nella hall), bagno nell'angolo sud-est con la sua porta.
export function buildSuite(a, bathApi, rb) {
  const S = a.room;
  const P = (x, z) => [S.minX + x - a.cx, S.minZ + z - a.cz]; // coordinate per la suite
  const Q = (x, z) => [S.minX + x - bathApi.cx, S.minZ + z - bathApi.cz]; // per il bagno
  const W = (x, z, y = 0) => new THREE.Vector3(S.minX + x, y, S.minZ + z);
  const box = (w, h, d, m, x, y, z, o) => a.box(w, h, d, m, ...spread(P(x, z), y), o);
  const bbox = (w, h, d, m, x, y, z, o) => bathApi.box(w, h, d, m, ...spread(Q(x, z), y), o);
  const cyl = (rt, rbot, h, m, x, y, z, o) => a.cyl(rt, rbot, h, m, ...spread(P(x, z), y), o);
  const bcyl = (rt, rbot, h, m, x, y, z, o) => bathApi.cyl(rt, rbot, h, m, ...spread(Q(x, z), y), o);

  const wood = a.mat('#6a4028');
  const darkWood = a.mat('#3a2416');
  const sheet = a.mat('#f0ece0');
  const stone = a.mat('#7a7068');
  const porcelain = a.mat('#f4f2ee');
  const chrome = a.mat('#c8ccd0', { metal: true });
  const paper = a.texMat('stripes', ['#e8d8b8', '#dcc8a4'], [2, 1]);

  // ---------- Il lato-suite delle pareti del bagno (carta da parati) ----------
  box(0.25, 5.5, 7.75, paper, 9.875, 2.75, 4.125, { collide: false });
  box(2.5, 5.5, 0.25, paper, 11.25, 2.75, 8.125, { collide: false });
  box(3.25, 5.5, 0.25, paper, 16.125, 2.75, 8.125, { collide: false });
  box(2, 2.9, 0.25, paper, 13.5, 4.05, 8.125, { collide: false });

  // ---------- Angolo del tè, davanti alla grande finestra (parete sud) ----------
  const table = { x: 3.8, z: 2.4 };
  cyl(0.75, 0.75, 0.06, darkWood, table.x, 0.76, table.z);
  cyl(0.07, 0.1, 0.74, darkWood, table.x, 0.37, table.z, { collide: false });
  const chairs = [];
  for (const [dx, facing] of [[-1.3, Math.PI / 2], [1.3, -Math.PI / 2]]) {
    const cx = table.x + dx;
    box(0.6, 0.08, 0.6, a.mat('#8a2a2a'), cx, 0.46, table.z, { collide: false });
    for (const [lx, lz] of [[-0.25, -0.25], [0.25, -0.25], [-0.25, 0.25], [0.25, 0.25]]) box(0.05, 0.44, 0.05, darkWood, cx + lx, 0.22, table.z + lz, { collide: false });
    box(0.06, 0.7, 0.6, darkWood, cx + Math.sign(dx) * 0.28, 0.85, table.z, { collide: false });
    chairs.push({ pos: W(cx, table.z), facing });
  }
  a.sphere(0.13, porcelain, ...spread(P(table.x, table.z + 0.15), 0.9), { collide: false }).scale.set(1, 0.85, 1);
  for (const dx of [0.45, -0.45]) cyl(0.05, 0.04, 0.07, porcelain, table.x + dx, 0.83, table.z - 0.15, { collide: false });
  const guns = new THREE.Group();
  for (const dx of [0.25, -0.25]) {
    const g = new THREE.Mesh(a.track(new THREE.BoxGeometry(0.08, 0.05, 0.26)), a.mat('#2a2c30'));
    g.position.copy(W(table.x + dx, table.z - 0.3, 0.82));
    g.rotation.y = 0.4;
    guns.add(g);
  }
  guns.visible = false;
  rb.dynamic.add(guns);

  const views = { night: a.track(viewTexture(false)), day: a.track(viewTexture(true)) };
  const viewMat = a.track(new THREE.MeshBasicMaterial({ map: views.night }));
  const view = new THREE.Mesh(a.track(new THREE.PlaneGeometry(5, 2.9)), viewMat);
  view.position.copy(W(5, 0.27, 2.45));
  rb.dynamic.add(view);
  box(5.4, 0.15, 0.15, darkWood, 5, 0.95, 0.33, { collide: false });
  box(5.4, 0.15, 0.15, darkWood, 5, 3.95, 0.33, { collide: false });
  for (const x of [2.1, 7.9]) box(0.9, 3.6, 0.3, a.mat('#7a1a24'), x, 2.1, 0.45, { collide: false });

  // ---------- Camino, poltrona, mensola dei premi (parete ovest) ----------
  const fireZ = 9;
  box(0.9, 2.6, 2.8, stone, 0.7, 1.3, fireZ);
  box(0.95, 1.1, 1.5, a.mat('#120c08'), 0.75, 0.6, fireZ, { collide: false });
  box(1.1, 0.15, 3, darkWood, 0.8, 2.65, fireZ, { collide: false });
  const fireGlow = a.glowSprite('#ff8a3a', ...spread(P(1.35, fireZ), 0.55), 2.2, 0.9);
  const fireLight = new THREE.PointLight('#ff9a4a', 10, 10, 1.6);
  fireLight.position.copy(W(1.9, fireZ, 0.9));
  rb.dynamic.add(fireLight);
  a.anim((t) => {
    const f = 0.85 + Math.sin(t * 11) * 0.08 + Math.sin(t * 17.3) * 0.06;
    fireGlow.scale.setScalar(2.2 * f);
    fireLight.intensity = 10 * f;
  });
  box(1.1, 0.5, 1.1, a.mat('#5a2a1a'), 2.9, 0.25, fireZ);
  box(0.25, 0.9, 1.1, a.mat('#5a2a1a'), 3.4, 0.9, fireZ, { collide: false });
  const armchair = { pos: W(2.9, fireZ), facing: -Math.PI / 2 };

  const shelfZ = 12.6;
  box(0.08, 2.2, 1.5, darkWood, 0.29, 1.1, shelfZ);
  for (const dz of [-0.75, 0.75]) box(0.5, 2.2, 0.05, darkWood, 0.5, 1.1, shelfZ + dz, { collide: false });
  for (let r = 0; r < 4; r++) box(0.5, 0.05, 1.5, wood, 0.5, 0.43 + r * 0.6, shelfZ, { collide: false });
  a.collider(...P(0.5, shelfZ), 0.5, 1.5);
  const shelf = new THREE.Group();
  rb.dynamic.add(shelf);
  const shelfTrack = [];

  // ---------- Zona notte: due letti contro la parete est ----------
  const beds = [];
  for (const [z, cover] of [[12.5, '#2f4f8f'], [18.5, '#b8862a']]) {
    const x = 16.05;
    box(3.4, 0.5, 2.2, wood, x, 0.25, z);
    box(3.2, 0.3, 2.1, sheet, x, 0.62, z, { collide: false });
    box(2.1, 0.12, 2.15, a.mat(cover), x - 0.5, 0.8, z, { collide: false });
    box(0.6, 0.25, 1.2, sheet, x + 1.2, 0.85, z, { collide: false });
    box(0.15, 1.5, 2.2, darkWood, 17.67, 0.95, z, { collide: false });
    beds.push(W(13.6, z));
  }
  box(0.6, 0.7, 0.8, darkWood, 17.35, 0.35, 15.5);
  const lampShadeMat = new THREE.MeshStandardMaterial({ color: '#ffe2b0', emissive: '#ffb860', emissiveIntensity: 1.6 });
  a.track(lampShadeMat);
  cyl(0.18, 0.26, 0.3, lampShadeMat, 17.35, 1.05, 15.5, { collide: false, dynamic: true });
  const lampLight = new THREE.PointLight('#ffc27a', 14, 12, 1.6);
  lampLight.position.copy(W(17, 15.5, 1.4));
  rb.dynamic.add(lampLight);

  // salotto, armadio, valigie
  box(5, 0.03, 3.6, a.mat('#8a2a2a'), 8, 0.02, 15, { collide: false });
  box(3.2, 0.8, 1, a.mat('#4a5a7a'), 8, 0.4, 12.6);
  box(3.2, 0.7, 0.25, a.mat('#4a5a7a'), 8, 1, 12.1, { collide: false });
  box(1.2, 0.45, 0.7, darkWood, 8, 0.23, 15.5);
  box(2.4, 2.6, 0.7, wood, 10, 1.3, 23.3);
  box(0.8, 0.6, 0.35, a.mat('#2a4a3a'), 6.4, 0.3, 23.3);
  box(0.6, 0.5, 0.35, a.mat('#6a2a1a'), 7.3, 0.25, 23.3);
  a.glowSprite('#ffe2b0', ...spread(P(9, 16), 5.1), 6, 0.3);

  // ---------- Il bagno: una stanza a sé, con la sua porta ----------
  const tiles = bathApi.mat('#f2f4f4');
  // doccia nell'angolo nord-est
  bbox(1.85, 0.08, 1.85, bathApi.mat('#9aa4a8'), 16.85, 0.04, 6.85, { collide: false });
  bbox(0.06, 2.3, 1.85, bathApi.mat('#cfe8f0', { transparent: 0.3 }), 15.9, 1.15, 6.85);
  bcyl(0.03, 0.03, 0.4, chrome, 16.8, 2.45, 7.65, { collide: false });
  bcyl(0.18, 0.12, 0.06, chrome, 16.8, 2.2, 7.45, { collide: false });
  // vasca lungo la parete sud
  bbox(3.6, 0.6, 1.6, porcelain, 12.3, 0.3, 1.1);
  const waterMat = bathApi.track(new THREE.MeshStandardMaterial({ color: '#8ad0e8', transparent: true, opacity: 0.75, roughness: 0.1 }));
  bbox(3.3, 0.02, 1.3, waterMat, 12.3, 0.52, 1.1, { collide: false, dynamic: true });
  bcyl(0.03, 0.03, 0.35, chrome, 10.6, 0.8, 1.1, { collide: false });
  bbox(0.9, 0.02, 0.6, bathApi.mat('#6a9ab0'), 12.3, 0.012, 2.4, { collide: false });
  // water e bidet, parete est
  for (const [z, tank] of [[3.2, true], [4.6, false]]) {
    bcyl(0.2, 0.16, 0.4, porcelain, 17.35, 0.2, z);
    bbox(0.5, 0.08, 0.45, porcelain, 17.3, 0.42, z, { collide: false });
    if (tank) bbox(0.2, 0.45, 0.5, porcelain, 17.65, 0.7, z, { collide: false });
    else bcyl(0.015, 0.015, 0.12, chrome, 17.55, 0.5, z, { collide: false });
  }
  // lavandino e specchio, parete ovest
  bbox(0.6, 0.9, 1.2, bathApi.mat('#d8d0c4'), 10.55, 0.45, 5.2);
  bbox(0.45, 0.06, 0.6, porcelain, 10.6, 0.93, 5.2, { collide: false });
  bcyl(0.015, 0.015, 0.2, chrome, 10.35, 1.05, 5.2, { collide: false });
  bbox(0.04, 1, 1.1, bathApi.mat('#e0e8f8', { metal: true, emissive: 0.1 }), 10.28, 1.8, 5.2, { collide: false });
  // portasciugamani
  bbox(0.05, 0.05, 1, chrome, 10.3, 1.4, 3, { collide: false });
  bbox(0.1, 0.7, 0.45, bathApi.mat('#f0e8d8'), 10.33, 1.1, 2.75, { collide: false });
  bbox(0.1, 0.7, 0.4, bathApi.mat('#b8d8e0'), 10.33, 1.1, 3.25, { collide: false });
  // piastrelle anche sulle pareti che il bagno condivide con la suite
  const tileWall = bathApi.texMat('tiles', ['#e4ecee', '#c0ccd0'], [2, 1]);
  bbox(0.02, 5.5, 7.75, tileWall, 17.74, 2.75, 4.125, { collide: false });
  bbox(7.5, 5.5, 0.02, tileWall, 14, 2.75, 0.26, { collide: false });
  void tiles;
  bathApi.glowSprite('#f0f8ff', ...spread(Q(14, 4), 5.1), 5, 0.35);
  const bathLight = new THREE.PointLight('#f4f8ff', 10, 10, 1.5);
  bathLight.position.copy(W(14, 4, 4));
  rb.dynamic.add(bathLight);

  return {
    beds,
    chairs,
    armchair,
    table: W(table.x, table.z),
    teaSpout: W(table.x, table.z + 0.25, 1),
    teaCam: W(7.2, 5.8, 1.9),
    teaLook: W(3.8, 1.2, 0.95),
    cups: [W(table.x + 0.45, table.z - 0.15), W(table.x - 0.45, table.z - 0.15)],
    shower: W(16.8, 6.8),
    showerHead: W(16.8, 7.45, 2.15),
    showerCam: W(12.6, 3.2, 2.3),
    tub: W(12.3, 1.1),
    tubCam: W(15.6, 5.2, 2.2),
    sink: W(11.2, 5.2),
    sinkCam: W(12.6, 4.4, 1.95),
    sinkLook: W(10.3, 5.2, 1.7),
    windowSpot: W(6.6, 1.4),
    windowLook: W(6, 0, 2.3),
    lampSpot: W(14.9, 15.5),
    fireplace: W(1.4, fireZ),
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
        m.position.copy(W(0.53, shelfZ + ((i % 3) - 1) * 0.45, 0.46 + row * 0.6));
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

// [x, z] + y → argomenti (x, y, z) per le funzioni della stanza
function spread([x, z], y) {
  return [x, y, z];
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
