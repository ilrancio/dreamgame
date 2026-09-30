import { mulberry32 } from '../../core/noise.js';

// Pianta di un piano dell'hotel, come negli alberghi classici: una hall,
// corridoi, e stanze allineate lungo i corridoi, ognuna con la sua porta.
// Le stanze non sono collegate fra loro: si passa sempre dal corridoio.
//
// Il piano terra ha anche il portone d'ingresso e la suite 1313: la suite è
// proprio accanto alla hall (una porta di servizio dà direttamente sulla
// reception), ma dal corridoio la si raggiunge solo facendo il giro del piano.
export const CELL = 18; // griglia dei secchi di collisione
export const COLS = 6;
export const ROWS = 6;
export const X0 = -(COLS * CELL) / 2;
export const Z0 = 0;
export const NW = COLS * CELL; // griglia di navigazione: 1 m per cella
export const NH = ROWS * CELL;
export const DOOR_W = 2; // porte larghe: si passa in due
export const DOOR_H = 2.6;
export const ENTRANCE_W = 8;
export const WALL_T = 0.5; // spessore totale fra due ambienti (0.25 per lato)
export const CORRIDOR_H = 4.6;
const LAYER = WALL_T / 2;

// centro di una porta allineato al centro di una cella di navigazione
const snap = (v) => Math.floor(v) + 0.5;

export function buildLayout(seed = 1313, { entrance = true, suite = true } = {}) {
  const rand = mulberry32(seed);
  const rooms = [];
  const openings = [];
  const add = (kind, minX, maxX, minZ, maxZ, extra = {}) => {
    const r = { id: rooms.length, kind, minX, maxX, minZ, maxZ, cx: (minX + maxX) / 2, cz: (minZ + maxZ) / 2, ...extra };
    rooms.push(r);
    return r;
  };

  // Apertura sul confine condiviso fra due ambienti. `at` è la posizione
  // lungo il confine (null = centro del tratto in comune).
  const connect = (a, b, kind = 'door', at = null, width = null) => {
    let axis;
    let coord;
    let from;
    let to;
    if (a.maxX === b.minX || a.minX === b.maxX) {
      axis = 'x';
      coord = a.maxX === b.minX ? a.maxX : a.minX;
      from = Math.max(a.minZ, b.minZ);
      to = Math.min(a.maxZ, b.maxZ);
    } else {
      axis = 'z';
      coord = a.maxZ === b.minZ ? a.maxZ : a.minZ;
      from = Math.max(a.minX, b.minX);
      to = Math.min(a.maxX, b.maxX);
    }
    const w = width ?? (kind === 'arch' ? to - from : DOOR_W);
    const c = at ?? (kind === 'arch' ? (from + to) / 2 : snap((from + to) / 2));
    openings.push({ a: a.id, b: b.id, axis, coord, from: c - w / 2, to: c + w / 2, center: c, kind });
  };

  // ---------- Hall ----------
  const hall = add('hall', -18, 18, 0, 36, { lobby: true });
  if (entrance) openings.push({ a: hall.id, b: -1, axis: 'z', coord: 0, from: -ENTRANCE_W / 2, to: ENTRANCE_W / 2, center: 0, kind: 'entrance' });

  // ---------- Corridoi (larghi 4 m) ----------
  const C = (minX, maxX, minZ, maxZ) => add('corridor', minX, maxX, minZ, maxZ, { corridor: true, height: CORRIDOR_H });
  const L = C(-36, -18, 14, 18); // dalla hall verso ovest
  const W = C(-40, -36, 6, 96); // lungo corridoio ovest
  const N = C(-40, 40, 96, 100); // corridoio nord
  const E = C(36, 40, 40, 96); // corridoio est
  const S = C(-36, 40, 36, 40); // corridoio dietro la hall
  const M = C(-36, 36, 64, 68); // corridoio di mezzo
  connect(hall, L, 'arch');
  connect(L, W, 'arch');
  connect(W, N, 'arch');
  connect(N, E, 'arch');
  connect(E, S, 'arch');
  connect(S, W, 'arch');
  connect(M, W, 'arch');
  connect(M, E, 'arch');

  // ---------- Stanze lungo i corridoi ----------
  const row = (axis, lo, hi, a0, a1, corridor, min = 9, max = 13) => {
    // divide la fascia [lo, hi] lungo `axis` in stanze larghe fra min e max
    let t = lo;
    while (hi - t >= min) {
      let w = min + Math.floor(rand() * (max - min + 1));
      if (hi - (t + w) < min) w = hi - t;
      const r = axis === 'x' ? add('room', t, t + w, a0, a1) : add('room', a0, a1, t, t + w);
      connect(r, corridor, 'door');
      t += w;
    }
  };
  row('z', 6, 96, -52, -40, W, 9, 12); // a ovest del corridoio ovest
  row('x', -36, 36, 40, 52, S); // fra S e M, lato sud
  row('x', -36, 36, 52, 64, M); // fra S e M, lato nord
  row('x', -36, 36, 68, 82, M); // fra M e N, lato sud
  row('x', -36, 36, 82, 96, N); // fra M e N, lato nord
  row('x', -40, 40, 100, 108, N, 9, 11); // oltre il corridoio nord
  row('z', 40, 96, 40, 52, E, 10, 13); // a est del corridoio est
  connect(add('room', -36, -18, 4, 14), L, 'door'); // fra la hall e il corridoio ovest
  connect(add('room', -36, -18, 18, 36), L, 'door');

  // ---------- La suite: accanto alla hall, ma la porta è sul retro ----------
  let suiteRoom = null;
  let bath = null;
  if (suite) {
    suiteRoom = add('suite', 18, 36, 12, 36, { suite: true });
    connect(suiteRoom, S, 'suite', 21.5); // porta principale, sul corridoio S
    connect(suiteRoom, hall, 'service', 28.5); // porta di servizio: dritta nella hall
    bath = add('bath', 28, 36, 12, 20, { bath: true, parent: suiteRoom.id });
    openings.push({ a: bath.id, b: suiteRoom.id, axis: 'z', coord: 20, from: 30.5, to: 32.5, center: 31.5, kind: 'bath' });
  } else {
    connect(add('room', 18, 36, 12, 36), S, 'door');
  }

  // ---------- Muri: ogni ambiente ha il suo strato, con le aperture ----------
  const walls = [];
  const doorways = [];
  const heightOf = (r) => (r ? r.height ?? 99 : 99);
  for (const r of rooms) {
    const parent = r.parent !== undefined ? rooms[r.parent] : null;
    const sides = [
      { dir: 'W', axis: 'x', coord: r.minX, from: r.minZ, to: r.maxZ, inward: 1 },
      { dir: 'E', axis: 'x', coord: r.maxX, from: r.minZ, to: r.maxZ, inward: -1 },
      { dir: 'S', axis: 'z', coord: r.minZ, from: r.minX, to: r.maxX, inward: 1 },
      { dir: 'N', axis: 'z', coord: r.maxZ, from: r.minX, to: r.maxX, inward: -1 },
    ];
    for (const s of sides) {
      // il bagno non ripete i muri che già appartengono alla suite
      if (parent) {
        const onParent = s.axis === 'x' ? s.coord === parent.minX || s.coord === parent.maxX : s.coord === parent.minZ || s.coord === parent.maxZ;
        if (onParent) continue;
      }
      const gaps = openings
        .filter((o) => (o.a === r.id || o.b === r.id) && o.axis === s.axis && o.coord === s.coord)
        .sort((p, q) => p.from - q.from);
      const pushWall = (a, b, y0 = 0, lintel = false) => {
        if (b - a < 0.05) return;
        const w0 = s.coord;
        const w1 = s.coord + s.inward * LAYER;
        const box = s.axis === 'x'
          ? { minX: Math.min(w0, w1), maxX: Math.max(w0, w1), minZ: a, maxZ: b }
          : { minX: a, maxX: b, minZ: Math.min(w0, w1), maxZ: Math.max(w0, w1) };
        walls.push({ ...box, room: r.id, y0, lintel, dir: s.dir });
      };
      let t = s.from;
      for (const o of gaps) {
        pushWall(t, o.from);
        const other = o.a === r.id ? o.b : o.a;
        const y0 = o.kind === 'entrance' ? 12 : o.kind === 'arch' ? Math.min(heightOf(r), heightOf(rooms[other])) : DOOR_H;
        pushWall(o.from, o.to, y0, true);
        t = o.to;
        const mid = o.center;
        doorways.push({
          room: r.id,
          x: s.axis === 'x' ? s.coord + s.inward * LAYER : mid,
          z: s.axis === 'z' ? s.coord + s.inward * LAYER : mid,
          dir: s.dir,
          axis: s.axis,
          other,
          kind: o.kind,
          entrance: o.kind === 'entrance',
        });
      }
      pushWall(t, s.to);
    }
  }

  // porte vere e proprie (non gli archi fra corridoi)
  const doors = openings
    .filter((o) => ['door', 'suite', 'service', 'bath'].includes(o.kind))
    .map((o, i) => ({ id: i, ...o, x: o.axis === 'x' ? o.coord : o.center, z: o.axis === 'z' ? o.coord : o.center, width: o.to - o.from }));

  // ---------- Griglia degli ambienti e griglia di navigazione ----------
  const roomGrid = new Int16Array(NW * NH).fill(-1);
  const blocked = new Uint8Array(NW * NH).fill(1);
  const fill = (r) => {
    for (let j = Math.max(0, r.minZ - Z0); j < Math.min(NH, r.maxZ - Z0); j++)
      for (let i = Math.max(0, r.minX - X0); i < Math.min(NW, r.maxX - X0); i++) {
        roomGrid[j * NW + i] = r.id;
        blocked[j * NW + i] = 0;
      }
  };
  rooms.filter((r) => !r.parent && r.parent !== 0).forEach(fill);
  rooms.filter((r) => r.parent !== undefined).forEach(fill);
  const markRect = (minX, maxX, minZ, maxZ, pad = 0.35) => {
    const i0 = Math.max(0, Math.floor(minX - pad - X0));
    const i1 = Math.min(NW - 1, Math.floor(maxX + pad - X0 - 1e-6));
    const j0 = Math.max(0, Math.floor(minZ - pad - Z0));
    const j1 = Math.min(NH - 1, Math.floor(maxZ + pad - Z0 - 1e-6));
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) blocked[j * NW + i] = 1;
  };
  for (const w of walls) if (!w.lintel) markRect(w.minX, w.maxX, w.minZ, w.maxZ);

  return {
    rooms,
    openings,
    doors,
    walls,
    doorways,
    blocked,
    roomGrid,
    markRect,
    hall,
    corridors: { L, W, N, E, S, M },
    suiteRoom,
    bath,
    playerRoom: suiteRoom ? suiteRoom.id : -1,
    rand,
  };
}

export function roomAt(layout, x, z) {
  if (layout.roomGrid) {
    const i = Math.floor(x - X0);
    const j = Math.floor(z - Z0);
    if (i < 0 || i >= NW || j < 0 || j >= NH) return -1;
    return layout.roomGrid[j * NW + i];
  }
  const c = Math.floor((x - X0) / CELL);
  const r = Math.floor((z - Z0) / CELL);
  if (c < 0 || c >= COLS || r < 0 || r >= ROWS) return -1;
  return layout.cellRoom[r * COLS + c];
}

// Campo di flusso: distanza BFS (8 direzioni) verso un bersaglio sulla griglia di navigazione.
export class FlowField {
  constructor(blocked) {
    this.blocked = blocked;
    this.dist = new Float32Array(NW * NH);
    this.queue = new Int32Array(NW * NH);
    this.dirX = new Float32Array(NW * NH);
    this.dirZ = new Float32Array(NW * NH);
  }

  compute(tx, tz) {
    const B = this.blocked;
    const D = this.dist;
    D.fill(1e9);
    let ti = Math.floor(tx - X0);
    let tj = Math.floor(tz - Z0);
    ti = Math.max(0, Math.min(NW - 1, ti));
    tj = Math.max(0, Math.min(NH - 1, tj));
    let head = 0;
    let tail = 0;
    const start = tj * NW + ti;
    D[start] = 0;
    this.queue[tail++] = start;
    while (head < tail) {
      const k = this.queue[head++];
      const i = k % NW;
      const j = (k - i) / NW;
      const d = D[k];
      for (let dj = -1; dj <= 1; dj++) {
        const nj = j + dj;
        if (nj < 0 || nj >= NH) continue;
        for (let di = -1; di <= 1; di++) {
          if (!di && !dj) continue;
          const ni = i + di;
          if (ni < 0 || ni >= NW) continue;
          const nk = nj * NW + ni;
          if (B[nk]) continue;
          // niente tagli d'angolo attraverso i muri
          if (di && dj && (B[j * NW + ni] || B[nj * NW + i])) continue;
          const nd = d + (di && dj ? 1.414 : 1);
          if (nd < D[nk]) {
            D[nk] = nd;
            this.queue[tail++] = nk;
            if (tail >= this.queue.length) tail = this.queue.length - 1;
          }
        }
      }
    }
    // direzione verso il vicino più vicino al bersaglio
    for (let j = 0; j < NH; j++)
      for (let i = 0; i < NW; i++) {
        const k = j * NW + i;
        let best = D[k];
        let bx = 0;
        let bz = 0;
        for (let dj = -1; dj <= 1; dj++) {
          const nj = j + dj;
          if (nj < 0 || nj >= NH) continue;
          for (let di = -1; di <= 1; di++) {
            const ni = i + di;
            if (ni < 0 || ni >= NW || (!di && !dj)) continue;
            const nk = nj * NW + ni;
            if (D[nk] < best) {
              best = D[nk];
              bx = di;
              bz = dj;
            }
          }
        }
        const l = Math.hypot(bx, bz) || 1;
        this.dirX[k] = bx / l;
        this.dirZ[k] = bz / l;
      }
  }

  distAt(x, z) {
    const i = Math.floor(x - X0);
    const j = Math.floor(z - Z0);
    if (i < 0 || i >= NW || j < 0 || j >= NH) return 1e9;
    return this.dist[j * NW + i];
  }
}
