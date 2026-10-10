import * as THREE from 'three';
import { prizeModel } from './prizes.js';
import { ENTITIES, UNKNOWN_SLOTS, entityLabel } from './companions.js';
import { textTexture } from '../../core/textures.js';
import { models, KENNEY } from '../../core/models.js';

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

  // I mobili del Furniture Kit (Kenney, CC0), ricolorati con i colori della suite.
  // put() restituisce null se il modello manca: allora resta il mobile disegnato.
  // rot: dove guarda il davanti del mobile (0 = nord, π/2 = est...).
  // fit: [larghezza, altezza, profondità] in metri al posto della scala del kit.
  // col: [larghezza x, profondità z] dell'ostacolo; bath: true se sta nel bagno.
  const put = (name, x, z, { y = 0, rot = 0, scale = KENNEY, fit = null, colors = null, col = null, bath = false } = {}) => {
    const o = models.make(name, { colors });
    if (!o) return null;
    if (fit) {
      const [sw, sh, sd] = models.size(name);
      o.scale.set(fit[0] / sw, fit[1] / sh, fit[2] / sd);
    } else o.scale.setScalar(scale);
    o.position.copy(W(x, z, y));
    o.rotation.y = rot;
    rb.dynamic.add(o);
    if (col) (bath ? bathApi : a).collider(...(bath ? Q(x, z) : P(x, z)), col[0], col[1]);
    return o;
  };
  const DARK = { wood: '#5a3420', woodDark: '#3a2416' };

  // ---------- Il lato-suite delle pareti del bagno (carta da parati) ----------
  box(0.25, 5.5, 7.75, paper, 9.875, 2.75, 4.125, { collide: false });
  box(2.5, 5.5, 0.25, paper, 11.25, 2.75, 8.125, { collide: false });
  box(3.25, 5.5, 0.25, paper, 16.125, 2.75, 8.125, { collide: false });
  box(2, 2.9, 0.25, paper, 13.5, 4.05, 8.125, { collide: false });

  // ---------- Angolo del tè, davanti alla grande finestra (parete sud) ----------
  const table = { x: 3.8, z: 2.4 };
  if (!put('tableRound', table.x, table.z, { fit: [1.5, 0.79, 1.5], colors: DARK, col: [1.5, 1.5] })) {
    cyl(0.75, 0.75, 0.06, darkWood, table.x, 0.76, table.z);
    cyl(0.07, 0.1, 0.74, darkWood, table.x, 0.37, table.z, { collide: false });
  }
  const chairs = [];
  for (const [dx, facing] of [[-1.3, Math.PI / 2], [1.3, -Math.PI / 2]]) {
    const cx = table.x + dx;
    if (!put('chairCushion', cx, table.z, { rot: facing, colors: { ...DARK, carpet: '#8a2a2a' } })) {
      box(0.6, 0.08, 0.6, a.mat('#8a2a2a'), cx, 0.46, table.z, { collide: false });
      for (const [lx, lz] of [[-0.25, -0.25], [0.25, -0.25], [-0.25, 0.25], [0.25, 0.25]]) box(0.05, 0.44, 0.05, darkWood, cx + lx, 0.22, table.z + lz, { collide: false });
      box(0.06, 0.7, 0.6, darkWood, cx + Math.sign(dx) * 0.28, 0.85, table.z, { collide: false });
    }
    chairs.push({ pos: W(cx, table.z), facing, seat: 0.5 }); // il cuscino della sedia è a 50 cm
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

  // ---------- L'angolo della moka: una credenza con il fornellino ----------
  const mz = 4.6;
  const credenza = [-0.45, 0.45].map((dz) => put('kitchenCabinetDrawer', 0.48, mz + dz, { rot: Math.PI / 2, fit: [0.9, 0.9, 0.9], colors: DARK }));
  if (credenza.every(Boolean)) a.collider(...P(0.48, mz), 0.9, 1.8);
  else box(0.7, 0.9, 1.6, darkWood, 0.45, 0.45, mz);
  box(0.94, 0.04, 1.84, wood, 0.48, 0.92, mz, { collide: false });
  box(0.42, 0.07, 0.42, a.mat('#2a2a2e'), 0.45, 0.97, mz - 0.3, { collide: false });
  cyl(0.12, 0.12, 0.015, a.mat('#4a4a50'), 0.45, 1.01, mz - 0.3, { collide: false });
  cyl(0.065, 0.085, 0.13, chrome, 0.45, 1.08, mz - 0.3, { collide: false });
  cyl(0.075, 0.06, 0.12, chrome, 0.45, 1.2, mz - 0.3, { collide: false });
  box(0.03, 0.09, 0.08, a.mat('#1e1e22'), 0.45, 1.19, mz - 0.18, { collide: false });
  cyl(0.06, 0.06, 0.13, a.mat('#a8402a'), 0.45, 1.0, mz + 0.25, { collide: false });
  cyl(0.065, 0.065, 0.03, a.mat('#d8b040', { metal: true }), 0.45, 1.08, mz + 0.25, { collide: false });
  for (const dz of [0.5, 0.62]) cyl(0.035, 0.03, 0.06, porcelain, 0.45, 0.97, mz + dz, { collide: false });

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
  if (put('loungeChair', 2.9, fireZ, { rot: -Math.PI / 2, colors: { carpet: '#7a2a1a', wood: '#3a2416' }, col: [1, 1.1] })) {
    put('lampSquareFloor', 2.9, fireZ + 1.25, { colors: { metal: '#3a2a1a', lamp: '#ffe2b0' } });
  } else {
    box(1.1, 0.5, 1.1, a.mat('#5a2a1a'), 2.9, 0.25, fireZ);
    box(0.25, 0.9, 1.1, a.mat('#5a2a1a'), 3.4, 0.9, fireZ, { collide: false });
  }
  // il bacino un po' avanti rispetto al centro della poltrona: le ginocchia escono dal cuscino
  const armchair = { pos: W(2.78, fireZ), facing: -Math.PI / 2, seat: 0.48 };
  // sopra il camino, appeso al muro: un trofeo con la testa d'orso (di legno e pelliccia finta)
  put('bear', 0.42, fireZ, { y: 3.05, rot: Math.PI / 2, scale: 2.4, colors: { wood: '#3a2416' } });

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
    // il letto del kit, allungato fino alla misura di questi letti (3,4 × 2,2 m)
    if (put('bedDouble', x, z, { rot: -Math.PI / 2, fit: [2.2, 0.95, 3.4], colors: { carpet: cover, wood: '#6a4028' }, col: [3.4, 2.2] })) {
      box(0.15, 1.5, 2.2, darkWood, 17.67, 0.95, z, { collide: false });
    } else {
      box(3.4, 0.5, 2.2, wood, x, 0.25, z);
      box(3.2, 0.3, 2.1, sheet, x, 0.62, z, { collide: false });
      box(2.1, 0.12, 2.15, a.mat(cover), x - 0.5, 0.8, z, { collide: false });
      box(0.6, 0.25, 1.2, sheet, x + 1.2, 0.85, z, { collide: false });
      box(0.15, 1.5, 2.2, darkWood, 17.67, 0.95, z, { collide: false });
    }
    beds.push(W(13.6, z));
  }
  const lampShadeMat = new THREE.MeshStandardMaterial({ color: '#ffe2b0', emissive: '#ffb860', emissiveIntensity: 1.6 });
  a.track(lampShadeMat);
  // il comodino tra i letti, con la lampada (il paralume si accende e si spegne)
  if (put('cabinetBedDrawerTable', 17.2, 15.5, { rot: -Math.PI / 2, fit: [0.9, 0.7, 0.75], colors: DARK, col: [0.8, 0.9] })) {
    put('lampRoundTable', 17.25, 15.5, { y: 0.7, rot: -Math.PI / 2, scale: 2.2, colors: { lamp: lampShadeMat, metal: '#c9a040' } });
    put('books', 17.25, 15.85, { y: 0.7, rot: -Math.PI / 2, scale: 1.8 });
  } else {
    box(0.6, 0.7, 0.8, darkWood, 17.35, 0.35, 15.5);
    cyl(0.18, 0.26, 0.3, lampShadeMat, 17.35, 1.05, 15.5, { collide: false, dynamic: true });
  }
  const lampLight = new THREE.PointLight('#ffc27a', 14, 12, 1.6);
  lampLight.position.copy(W(17, 15.5, 1.4));
  rb.dynamic.add(lampLight);

  // salotto, armadio, valigie
  if (!put('rugRectangle', 8, 15, { fit: [5, 0.03, 3.6], colors: { carpet: '#8a2a2a', carpetDarker: '#6a1a1e' } })) box(5, 0.03, 3.6, a.mat('#8a2a2a'), 8, 0.02, 15, { collide: false });
  if (!put('loungeSofa', 8, 12.55, { fit: [3.2, 1.05, 1.1], colors: { carpet: '#4a5a7a', wood: '#3a2416' }, col: [3.2, 1.1] })) {
    box(3.2, 0.8, 1, a.mat('#4a5a7a'), 8, 0.4, 12.6);
    box(3.2, 0.7, 0.25, a.mat('#4a5a7a'), 8, 1, 12.1, { collide: false });
  }
  if (!put('tableCoffee', 8, 15.5, { fit: [1.3, 0.45, 0.8], colors: DARK, col: [1.3, 0.8] })) box(1.2, 0.45, 0.7, darkWood, 8, 0.23, 15.5);
  put('radio', 8.4, 15.4, { y: 0.45, rot: 0.2, scale: 1.6, colors: { wood: '#7a4a2a' } });
  put('books', 7.8, 15.5, { y: 0.455, rot: 0.3, scale: 2 });
  // l'armadio: due ante alte di legno
  const wardrobe = [-0.6, 0.6].map((dx) => put('bookcaseClosedDoors', 10 + dx, 23.3, { rot: Math.PI, fit: [1.2, 2.6, 0.7], colors: { wood: '#6a4028', metal: '#c9a040' } }));
  if (wardrobe.every(Boolean)) a.collider(...P(10, 23.3), 2.4, 0.7);
  else box(2.4, 2.6, 0.7, wood, 10, 1.3, 23.3);
  // il ventilatore sul soffitto del salotto, che gira piano
  const fan = put('ceilingFan', 8, 15, { y: 5.5 - 0.13 * 3.2, scale: 3.2, colors: { wood: '#5a3420', metalLight: '#c9a040' } });
  if (fan) a.anim((t) => (fan.rotation.y = t * 1.6));
  put('coatRackStanding', 1.2, 22.8, { colors: { wood: '#3a2416' }, col: [0.6, 0.6] });
  // il leggio con il diario dei sogni
  const lx = 3.6;
  const lz = 23.1;
  box(0.12, 1.05, 0.12, darkWood, lx, 0.52, lz);
  box(0.5, 0.06, 0.4, darkWood, lx, 0.03, lz, { collide: false });
  const lectern = box(0.7, 0.05, 0.5, darkWood, lx, 1.08, lz - 0.05, { collide: false });
  void lectern;
  box(0.62, 0.06, 0.42, a.mat('#7a2a1a'), lx, 1.13, lz - 0.05, { collide: false });
  box(0.56, 0.02, 0.38, a.mat('#f0e6cc'), lx, 1.17, lz - 0.05, { collide: false });
  a.collider(...P(lx, lz), 0.6, 0.5);
  a.glowSprite('#ffe8b0', ...spread(P(lx, lz - 0.05), 1.35), 0.9, 0.35);
  box(0.8, 0.6, 0.35, a.mat('#2a4a3a'), 6.4, 0.3, 23.3);
  box(0.6, 0.5, 0.35, a.mat('#6a2a1a'), 7.3, 0.25, 23.3);
  a.glowSprite('#ffe2b0', ...spread(P(9, 16), 5.1), 6, 0.3);

  // ---------- Vetrina delle creature (parete nord, accanto all'armadio) ----------
  const vx = 13.6;
  const vz = 23.4;
  box(2.4, 0.15, 0.62, darkWood, vx, 0.08, vz);
  box(2.4, 0.12, 0.62, darkWood, vx, 2.3, vz, { collide: false });
  for (const dx of [-1.17, 1.17]) box(0.06, 2.2, 0.62, darkWood, vx + dx, 1.2, vz, { collide: false });
  box(2.3, 2.1, 0.03, a.mat('#d8ecf4', { transparent: 0.2 }), vx, 1.2, vz - 0.3, { collide: false });
  for (let r = 0; r < 2; r++) box(2.3, 0.04, 0.55, a.mat('#e8e0d0'), vx, 0.8 + r * 0.75, vz, { collide: false });
  a.collider(...P(vx, vz), 2.4, 0.62);
  const vLight = a.glowSprite('#fff4dc', ...spread(P(vx, vz - 0.1), 2.1), 2.4, 0.35);
  void vLight;
  const vitrineGroup = new THREE.Group();
  rb.dynamic.add(vitrineGroup);
  const vitrineTrack = [];
  // posti nella vetrina: due ripiani, due posti per ripiano
  const slots = [[-0.55, 0.84], [0.55, 0.84], [-0.55, 1.59], [0.55, 1.59]];

  // ---------- La porta dei macroluoghi (parete est, dopo i letti) ----------
  // Non c'era, quando siete arrivati. Ogni luogo del sogno che visitate le
  // aggiunge una targhetta: aprendola si esce direttamente là.
  const sdz = 21.8;
  const doorGreen = a.mat('#2f5a3a');
  const brass = a.mat('#c9a040', { metal: true });
  box(0.12, 2.7, 1.7, darkWood, 17.78, 1.35, sdz, { collide: false });
  box(0.08, 2.45, 1.3, doorGreen, 17.7, 1.225, sdz, { collide: false });
  for (const dz of [-0.33, 0.33]) for (const y of [0.7, 1.75]) box(0.03, 0.75, 0.42, a.mat('#28503a'), 17.65, y, sdz + dz, { collide: false });
  a.sphere(0.05, brass, ...spread(P(17.62, sdz - 0.48), 1.15), { collide: false });
  const doorGlowMat = a.track(new THREE.MeshBasicMaterial({ color: '#fff0c8', transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false }));
  box(0.02, 0.05, 1.25, doorGlowMat, 17.62, 0.03, sdz, { collide: false, dynamic: true });
  const plaques = new THREE.Group();
  rb.dynamic.add(plaques);
  const plaqueTrack = [];

  // ---------- Il bagno: una stanza a sé, con la sua porta ----------

  // (il bagno: una stanza a sé, con la sua porta)
  const tiles = bathApi.mat('#f2f4f4');
  // doccia nell'angolo nord-est
  if (!put('shower', 16.85, 6.85, { rot: -Math.PI / 2, fit: [1.9, 2.4, 1.9] })) {
    bbox(1.85, 0.08, 1.85, bathApi.mat('#9aa4a8'), 16.85, 0.04, 6.85, { collide: false });
    bbox(0.06, 2.3, 1.85, bathApi.mat('#cfe8f0', { transparent: 0.3 }), 15.9, 1.15, 6.85);
  }
  bcyl(0.03, 0.03, 0.4, chrome, 16.8, 2.45, 7.65, { collide: false });
  bcyl(0.18, 0.12, 0.06, chrome, 16.8, 2.2, 7.45, { collide: false });
  // vasca lungo la parete sud
  if (!put('bathtub', 12.3, 1.1, { rot: Math.PI, fit: [3.6, 0.62, 1.6], col: [3.6, 1.6], bath: true })) bbox(3.6, 0.6, 1.6, porcelain, 12.3, 0.3, 1.1);
  const waterMat = bathApi.track(new THREE.MeshStandardMaterial({ color: '#8ad0e8', transparent: true, opacity: 0.75, roughness: 0.1 }));
  bbox(3.3, 0.02, 1.3, waterMat, 12.3, 0.52, 1.1, { collide: false, dynamic: true });
  bcyl(0.03, 0.03, 0.35, chrome, 10.6, 0.8, 1.1, { collide: false });
  bbox(0.9, 0.02, 0.6, bathApi.mat('#6a9ab0'), 12.3, 0.012, 2.4, { collide: false });
  // water e bidet, parete est
  const wc = put('toilet', 17.25, 3.2, { rot: -Math.PI / 2, scale: 2.1, col: [0.9, 0.7], bath: true });
  for (const [z, tank] of [[3.2, true], [4.6, false]]) {
    if (tank && wc) continue;
    bcyl(0.2, 0.16, 0.4, porcelain, 17.35, 0.2, z);
    bbox(0.5, 0.08, 0.45, porcelain, 17.3, 0.42, z, { collide: false });
    if (tank) bbox(0.2, 0.45, 0.5, porcelain, 17.65, 0.7, z, { collide: false });
    else bcyl(0.015, 0.015, 0.12, chrome, 17.55, 0.5, z, { collide: false });
  }
  // lavandino e specchio, parete ovest
  if (put('bathroomSink', 10.62, 5.2, { rot: Math.PI / 2, scale: 2.1, col: [0.7, 0.9], bath: true })) {
    const mirrorGlass = bathApi.track(new THREE.MeshStandardMaterial({ color: '#d4e6f2', metalness: 0.7, roughness: 0.08 }));
    put('bathroomMirror', 10.55, 5.2, { y: 1.35, rot: Math.PI / 2, scale: 3.2, colors: { wood: '#5a3420', glass: mirrorGlass, metal: '#c9a040' } });
    put('trashcan', 10.55, 6.6, { rot: Math.PI / 2, scale: 1.4 });
  } else {
    bbox(0.6, 0.9, 1.2, bathApi.mat('#d8d0c4'), 10.55, 0.45, 5.2);
    bbox(0.45, 0.06, 0.6, porcelain, 10.6, 0.93, 5.2, { collide: false });
    bcyl(0.015, 0.015, 0.2, chrome, 10.35, 1.05, 5.2, { collide: false });
    bbox(0.04, 1, 1.1, bathApi.mat('#e0e8f8', { metal: true, emissive: 0.1 }), 10.28, 1.8, 5.2, { collide: false });
  }
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
    diarySpot: W(3.6, 22.2),
    fireplace: W(1.4, fireZ),
    mokaSpot: W(1.45, mz - 0.2),
    mokaFacing: -Math.PI / 2,
    mokaPot: W(0.45, mz - 0.3, 1.25),
    mokaCam: W(2.9, mz + 1.6, 1.9),
    mokaLook: W(0.45, mz - 0.2, 1.05),
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
    vitrineSpot: W(vx, vz - 1.4),
    shortcutSpot: W(16.6, sdz),
    shortcutFacing: Math.PI / 2,
    // le targhette dei luoghi raggiungibili da questa porta
    setShortcuts(places = []) {
      plaques.clear();
      plaqueTrack.forEach((d) => d.dispose());
      plaqueTrack.length = 0;
      const tr = (o) => (plaqueTrack.push(o), o);
      doorGlowMat.opacity = places.length ? 0.9 : 0;
      places.slice(0, 6).forEach((pl, i) => {
        const t = tr(textTexture(pl.name, { width: 256, height: 48, font: '600 24px Cormorant Garamond, serif', color: '#2a1a0a', bg: '#d8b860' }));
        const m = new THREE.Mesh(tr(new THREE.PlaneGeometry(0.62, 0.12)), tr(new THREE.MeshBasicMaterial({ map: t })));
        m.position.copy(W(17.64, sdz, 2.1 - i * 0.16));
        m.rotation.y = -Math.PI / 2;
        plaques.add(m);
      });
    },
    // statuette delle creature: quelle sbloccate, e sagome scure per le altre
    setEntities(levels = {}, active = null) {
      vitrineGroup.clear();
      vitrineTrack.forEach((d) => d.dispose());
      vitrineTrack.length = 0;
      const tr = (o) => (vitrineTrack.push(o), o);
      const items = [...ENTITIES.map((e) => ({ e, level: levels[e.id] || 0 })), ...Array.from({ length: UNKNOWN_SLOTS }, () => ({ e: null, level: 0 }))];
      items.slice(0, slots.length).forEach(({ e, level }, k) => {
        const [sx, sy] = slots[k];
        const base = W(vx + sx, vz, sy);
        const g = new THREE.Group();
        g.position.copy(base);
        vitrineGroup.add(g);
        if (e && level) {
          // tanti gnomini di ceramica quanti ne hai (fino a dieci, per stare nel ripiano)
          const shown = Math.min(10, level);
          for (let q = 0; q < shown; q++) {
            const m = prizeModel('gnomo', tr);
            m.scale.setScalar(0.55);
            m.position.set(((q % 5) - 2) * 0.1, 0, Math.floor(q / 5) * 0.12 - 0.06);
            m.rotation.y = Math.PI + (Math.random() - 0.5) * 0.4;
            g.add(m);
          }
          const label = entityLabel(e.id, level) + (active === e.id ? ' · con te' : '');
          const t = tr(textTexture(label, { width: 256, height: 64, font: '600 30px Cormorant Garamond, serif', color: '#3a2416', bg: '#f0e6cc' }));
          const plate = new THREE.Mesh(tr(new THREE.PlaneGeometry(0.42, 0.1)), tr(new THREE.MeshBasicMaterial({ map: t })));
          plate.position.set(0, 0.03, -0.27);
          plate.rotation.y = Math.PI;
          g.add(plate);
        } else {
          // sagoma scura: una creatura di un sogno non ancora sognato
          const dark = tr(new THREE.MeshStandardMaterial({ color: '#141018', roughness: 1 }));
          const body = new THREE.Mesh(tr(new THREE.CylinderGeometry(0.06, 0.1, 0.22, 10)), dark);
          body.position.y = 0.11;
          const head = new THREE.Mesh(tr(new THREE.SphereGeometry(0.08, 10, 8)), dark);
          head.position.y = 0.3;
          g.add(body, head);
          const t = tr(textTexture('???', { width: 256, height: 64, font: '600 34px Cormorant Garamond, serif', color: '#8a8070', bg: '#2a2420' }));
          const plate = new THREE.Mesh(tr(new THREE.PlaneGeometry(0.42, 0.1)), tr(new THREE.MeshBasicMaterial({ map: t })));
          plate.position.set(0, 0.03, -0.27);
          plate.rotation.y = Math.PI;
          g.add(plate);
        }
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
