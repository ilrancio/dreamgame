import * as THREE from 'three';

// Premi del banco della sala giochi. Quelli vinti finiscono sulla mensola della suite.
export const PRIZES = [
  { id: 'paperella', name: 'Paperella di gomma', cost: 30 },
  { id: 'cartolina', name: 'Cartolina del campo', cost: 40 },
  { id: 'dado', name: 'Dado di peluche', cost: 50 },
  { id: 'gnomo', name: 'Gnomo di ceramica', cost: 60 },
  { id: 'specchi', name: 'Mini palla a specchi', cost: 90 },
  { id: 'razzo', name: 'Razzo di latta', cost: 100 },
  { id: 'demone', name: 'Demone di peluche', cost: 120 },
  { id: 'lava', name: 'Lampada lava', cost: 150 },
  { id: 'teiera', name: 'Teiera d\'oro', cost: 200 },
];

export const prizeById = (id) => PRIZES.find((p) => p.id === id);

// Piccolo modello 3D di un premio, alto circa 30 cm, appoggiato su y = 0.
export function prizeModel(id, track) {
  const g = new THREE.Group();
  const m = (color, opts = {}) => track(new THREE.MeshStandardMaterial({ color, roughness: 0.7, ...opts }));
  const add = (geo, mat, x, y, z) => {
    const o = new THREE.Mesh(track(geo), mat);
    o.position.set(x, y, z);
    g.add(o);
    return o;
  };
  switch (id) {
    case 'paperella':
      add(new THREE.SphereGeometry(0.1, 12, 8), m('#ffd21a'), 0, 0.09, 0).scale.set(1.2, 0.9, 1);
      add(new THREE.SphereGeometry(0.065, 12, 8), m('#ffd21a'), 0.08, 0.2, 0);
      add(new THREE.ConeGeometry(0.03, 0.06, 8), m('#ff7a1a'), 0.15, 0.2, 0).rotation.z = -Math.PI / 2;
      break;
    case 'cartolina': {
      const c = document.createElement('canvas');
      c.width = 128;
      c.height = 90;
      const x = c.getContext('2d');
      const grd = x.createLinearGradient(0, 0, 0, 90);
      grd.addColorStop(0, '#e0643a');
      grd.addColorStop(1, '#4f7a2a');
      x.fillStyle = grd;
      x.fillRect(0, 0, 128, 90);
      x.fillStyle = '#1a0a0a';
      x.fillRect(84, 22, 14, 44);
      x.fillStyle = '#ffe070';
      x.fillRect(87, 28, 3, 3);
      x.fillRect(93, 28, 3, 3);
      const t = track(new THREE.CanvasTexture(c));
      t.colorSpace = THREE.SRGBColorSpace;
      const card = add(new THREE.PlaneGeometry(0.26, 0.18), track(new THREE.MeshBasicMaterial({ map: t, side: THREE.DoubleSide })), 0, 0.1, 0);
      card.rotation.x = -0.2;
      break;
    }
    case 'dado':
      add(new THREE.BoxGeometry(0.2, 0.2, 0.2), m('#f4f0e8'), 0, 0.1, 0).rotation.y = 0.5;
      break;
    case 'gnomo':
      add(new THREE.CylinderGeometry(0.06, 0.08, 0.14, 10), m('#3a5ac8'), 0, 0.07, 0);
      add(new THREE.SphereGeometry(0.05, 10, 8), m('#f0c0a0'), 0, 0.18, 0);
      add(new THREE.ConeGeometry(0.045, 0.08, 10), m('#f4f4f0'), 0, 0.15, 0.03);
      add(new THREE.ConeGeometry(0.06, 0.14, 10), m('#d82a2a'), 0, 0.28, 0);
      break;
    case 'specchi':
      add(new THREE.CylinderGeometry(0.005, 0.005, 0.12, 4), m('#888'), 0, 0.26, 0);
      add(new THREE.IcosahedronGeometry(0.1, 1), m('#dde', { metalness: 1, roughness: 0.15, flatShading: true }), 0, 0.12, 0);
      break;
    case 'razzo':
      add(new THREE.CylinderGeometry(0.05, 0.05, 0.2, 12), m('#d8d8e0', { metalness: 0.6, roughness: 0.3 }), 0, 0.14, 0);
      add(new THREE.ConeGeometry(0.05, 0.1, 12), m('#e03a3a'), 0, 0.29, 0);
      for (let k = 0; k < 3; k++) {
        const f = add(new THREE.BoxGeometry(0.01, 0.07, 0.06), m('#e03a3a'), Math.cos(k * 2.1) * 0.05, 0.06, Math.sin(k * 2.1) * 0.05);
        f.rotation.y = -k * 2.1;
      }
      break;
    case 'demone':
      add(new THREE.SphereGeometry(0.1, 12, 10), m('#2a1216'), 0, 0.1, 0).scale.set(1, 1.1, 0.9);
      add(new THREE.SphereGeometry(0.07, 12, 10), m('#2a1216'), 0, 0.24, 0);
      for (const sx of [-1, 1]) {
        add(new THREE.SphereGeometry(0.014, 6, 4), track(new THREE.MeshBasicMaterial({ color: '#ffe070' })), sx * 0.025, 0.25, 0.06);
        add(new THREE.ConeGeometry(0.015, 0.07, 6), m('#e8dcc0'), sx * 0.05, 0.32, 0).rotation.z = -sx * 0.4;
      }
      break;
    case 'lava': {
      add(new THREE.CylinderGeometry(0.05, 0.07, 0.06, 12), m('#b8b8c0', { metalness: 0.7 }), 0, 0.03, 0);
      add(new THREE.CylinderGeometry(0.04, 0.06, 0.2, 12), track(new THREE.MeshStandardMaterial({ color: '#ff4a8a', emissive: '#ff2a6a', emissiveIntensity: 1.2, transparent: true, opacity: 0.85 })), 0, 0.16, 0);
      add(new THREE.CylinderGeometry(0.02, 0.04, 0.05, 12), m('#b8b8c0', { metalness: 0.7 }), 0, 0.285, 0);
      break;
    }
    case 'teiera':
      add(new THREE.SphereGeometry(0.1, 14, 10), m('#e8c040', { metalness: 0.9, roughness: 0.2 }), 0, 0.1, 0).scale.set(1, 0.85, 1);
      add(new THREE.CylinderGeometry(0.012, 0.022, 0.12, 8), m('#e8c040', { metalness: 0.9, roughness: 0.2 }), 0.12, 0.13, 0).rotation.z = -1;
      add(new THREE.TorusGeometry(0.05, 0.012, 6, 12), m('#e8c040', { metalness: 0.9, roughness: 0.2 }), -0.11, 0.12, 0);
      break;
    default:
      add(new THREE.BoxGeometry(0.15, 0.15, 0.15), m('#fff'), 0, 0.08, 0);
  }
  return g;
}
