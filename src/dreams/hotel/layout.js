import { mulberry32 } from '../../core/noise.js';

// Pianta dell'hotel: una griglia di stanze da 18 m collegate da porte.
// L'atrio occupa 2×2 celle al centro del lato sud, dove c'è il portone.
export const CELL = 18;
export const COLS = 6;
export const ROWS = 6;
export const X0 = -(COLS * CELL) / 2;
export const Z0 = 0;
export const NW = COLS * CELL; // griglia di navigazione: 1 m per cella
export const NH = ROWS * CELL;
export const DOOR_W = 4;
export const DOOR_H = 4.4;
export const ENTRANCE_W = 8;
export const WALL_T = 0.5;

const isLobbyCell = (r, c) => r <= 1 && (c === 2 || c === 3);

// Opzioni: il piano terra ha il portone d'ingresso e la suite 1313;
// gli altri piani hanno solo l'atrio con gli ascensori.
export function buildLayout(seed = 1313, { entrance = true, suite = true } = {}) {
  const rand = mulberry32(seed);
  const rooms = [];
  const cellRoom = new Int32Array(ROWS * COLS).fill(-1);

  const lobby = { id: 0, cells: [], lobby: true };
  rooms.push(lobby);
  for (let r = 0; r < ROWS; r++)
    for (let c = 0; c < COLS; c++) {
      const cid = r * COLS + c;
      if (isLobbyCell(r, c)) {
        lobby.cells.push(cid);
        cellRoom[cid] = 0;
      } else {
        cellRoom[cid] = rooms.length;
        rooms.push({ id: rooms.length, cells: [cid] });
      }
    }
  for (const room of rooms) {
    let minX = Infinity;
    let maxX = -Infinity;
    let minZ = Infinity;
    let maxZ = -Infinity;
    for (const cid of room.cells) {
      const r = Math.floor(cid / COLS);
      const c = cid % COLS;
      minX = Math.min(minX, X0 + c * CELL);
      maxX = Math.max(maxX, X0 + (c + 1) * CELL);
      minZ = Math.min(minZ, Z0 + r * CELL);
      maxZ = Math.max(maxZ, Z0 + (r + 1) * CELL);
    }
    Object.assign(room, { minX, maxX, minZ, maxZ, cx: (minX + maxX) / 2, cz: (minZ + maxZ) / 2 });
  }

  // Bordi tra celle di stanze diverse: sono i possibili punti-porta.
  const edges = [];
  for (let r = 0; r < ROWS; r++)
    for (let c = 0; c < COLS; c++) {
      const a = r * COLS + c;
      if (c + 1 < COLS) {
        const b = a + 1;
        if (cellRoom[a] !== cellRoom[b]) edges.push({ a, b, axis: 'x', coord: X0 + (c + 1) * CELL, from: Z0 + r * CELL, to: Z0 + (r + 1) * CELL });
      }
      if (r + 1 < ROWS) {
        const b = a + COLS;
        if (cellRoom[a] !== cellRoom[b]) edges.push({ a, b, axis: 'z', coord: Z0 + (r + 1) * CELL, from: X0 + c * CELL, to: X0 + (c + 1) * CELL });
      }
    }
  edges.forEach((e) => {
    e.ra = cellRoom[e.a];
    e.rb = cellRoom[e.b];
    e.door = false;
    e.center = (e.from + e.to) / 2 + (rand() - 0.5) * 7;
  });

  // Labirinto: albero ricoprente casuale a partire dall'atrio, poi qualche anello.
  const visited = new Set([0]);
  const stack = [0];
  while (stack.length) {
    const cur = stack[stack.length - 1];
    const options = edges.filter((e) => (e.ra === cur && !visited.has(e.rb)) || (e.rb === cur && !visited.has(e.ra)));
    if (!options.length) {
      stack.pop();
      continue;
    }
    const e = options[Math.floor(rand() * options.length)];
    e.door = true;
    const next = e.ra === cur ? e.rb : e.ra;
    visited.add(next);
    stack.push(next);
  }
  edges.forEach((e) => {
    if (!e.door && rand() < 0.3) e.door = true;
  });
  // l'atrio deve avere almeno tre uscite
  const lobbyEdges = edges.filter((e) => e.ra === 0 || e.rb === 0);
  let open = lobbyEdges.filter((e) => e.door).length;
  for (const e of lobbyEdges) {
    if (open >= 3) break;
    if (!e.door) {
      e.door = true;
      open++;
    }
  }

  const playerRoom = cellRoom[(ROWS - 1) * COLS + 0];
  if (suite) rooms[playerRoom].suite = true;

  // ---------- Muri (per stanza, spessore verso l'interno) ----------
  const walls = []; // { minX, maxX, minZ, maxZ, room, lintel }
  const doorways = []; // centri delle porte, per numeri e navigazione
  for (const room of rooms) {
    room.sides = [];
    for (const cid of room.cells) {
      const r = Math.floor(cid / COLS);
      const c = cid % COLS;
      const x0 = X0 + c * CELL;
      const z0 = Z0 + r * CELL;
      const sides = [
        { dir: 'W', axis: 'x', coord: x0, from: z0, to: z0 + CELL, n: c > 0 ? cid - 1 : -1 },
        { dir: 'E', axis: 'x', coord: x0 + CELL, from: z0, to: z0 + CELL, n: c < COLS - 1 ? cid + 1 : -1 },
        { dir: 'S', axis: 'z', coord: z0, from: x0, to: x0 + CELL, n: r > 0 ? cid - COLS : -1 },
        { dir: 'N', axis: 'z', coord: z0 + CELL, from: x0, to: x0 + CELL, n: r < ROWS - 1 ? cid + COLS : -1 },
      ];
      for (const s of sides) {
        if (s.n >= 0 && cellRoom[s.n] === room.id) continue; // interno della stessa stanza
        const gaps = [];
        if (s.n >= 0) {
          const e = edges.find((q) => (q.a === cid && q.b === s.n) || (q.b === cid && q.a === s.n));
          if (e?.door) gaps.push([e.center - DOOR_W / 2, e.center + DOOR_W / 2, e]);
        }
        if (entrance && room.lobby && s.dir === 'S') {
          // portone d'ingresso, centrato su x = 0
          gaps.push([-ENTRANCE_W / 2, ENTRANCE_W / 2, null]);
        }
        room.sides.push({ ...s, gaps });
        // tratti pieni = lato meno le aperture
        let t = s.from;
        const sorted = gaps
          .map(([a, b, e]) => [Math.max(a, s.from), Math.min(b, s.to), e])
          .filter(([a, b]) => b > a)
          .sort((p, q) => p[0] - q[0]);
        const inward = s.dir === 'W' || s.dir === 'S' ? 1 : -1;
        const pushWall = (a, b, y0 = 0, lintel = false) => {
          if (b - a < 0.05) return;
          const w0 = s.coord;
          const w1 = s.coord + inward * WALL_T;
          const box =
            s.axis === 'x'
              ? { minX: Math.min(w0, w1), maxX: Math.max(w0, w1), minZ: a, maxZ: b }
              : { minX: a, maxX: b, minZ: Math.min(w0, w1), maxZ: Math.max(w0, w1) };
          walls.push({ ...box, room: room.id, y0, lintel, dir: s.dir });
        };
        for (const [a, b, e] of sorted) {
          pushWall(t, a);
          pushWall(a, b, e ? DOOR_H : 12, true);
          t = b;
          const mid = (a + b) / 2;
          doorways.push({
            room: room.id,
            x: s.axis === 'x' ? s.coord + inward * WALL_T : mid,
            z: s.axis === 'z' ? s.coord + inward * WALL_T : mid,
            dir: s.dir,
            axis: s.axis,
            other: s.n >= 0 ? cellRoom[s.n] : -1,
            entrance: !e,
          });
        }
        pushWall(t, s.to);
      }
    }
  }

  // ---------- Griglia di navigazione (1 m) ----------
  const blocked = new Uint8Array(NW * NH);
  const markRect = (minX, maxX, minZ, maxZ, pad = 0.35) => {
    const i0 = Math.max(0, Math.floor(minX - pad - X0));
    const i1 = Math.min(NW - 1, Math.floor(maxX + pad - X0 - 1e-6));
    const j0 = Math.max(0, Math.floor(minZ - pad - Z0));
    const j1 = Math.min(NH - 1, Math.floor(maxZ + pad - Z0 - 1e-6));
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) blocked[j * NW + i] = 1;
  };
  for (const w of walls) if (!w.lintel) markRect(w.minX, w.maxX, w.minZ, w.maxZ);

  return { rooms, cellRoom, edges, walls, doorways, blocked, markRect, playerRoom: suite ? playerRoom : -1, rand };
}

export function roomAt(layout, x, z) {
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
