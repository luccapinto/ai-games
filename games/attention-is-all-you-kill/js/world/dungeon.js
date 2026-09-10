// dungeon.js — geração do andar.
// Modelo: grid de tiles solidos/vazios. Salas retangulares conectadas por
// corredores em L. Colisão, linha de visão e caminho de IA usam esse grid,
// o que mantem tudo coerente e barato.

export const TILE = 3.0;          // tamanho do tile em unidades de mundo
export const WALL_H = 4.2;        // altura da parede

export class Dungeon {
  constructor({ floor = 1, cols = 46, rows = 46, roomCount = 8, seed = 1 } = {}) {
    this.floor = floor;
    this.cols = cols;
    this.rows = rows;
    this.roomCount = roomCount;
    this.seed = seed;
    this.grid = new Uint8Array(cols * rows).fill(1);   // 1 = solido, 0 = livre
    this.rooms = [];
    this.spawns = [];
    this.generate();
  }

  // ---- aleatoriedade com semente (runs reproduziveis se quisermos) ----
  _rand() {
    this.seed = (this.seed * 1664525 + 1013904223) % 4294967296;
    return this.seed / 4294967296;
  }

  _irand(min, max) { return min + Math.floor(this._rand() * (max - min + 1)); }

  idx(tx, tz) { return tz * this.cols + tx; }

  isSolid(tx, tz) {
    if (tx < 0 || tz < 0 || tx >= this.cols || tz >= this.rows) return true;
    return this.grid[this.idx(tx, tz)] === 1;
  }

  setSolid(tx, tz, solid) {
    if (tx < 0 || tz < 0 || tx >= this.cols || tz >= this.rows) return;
    this.grid[this.idx(tx, tz)] = solid ? 1 : 0;
  }

  worldToTile(x, z) {
    return { tx: Math.floor(x / TILE), tz: Math.floor(z / TILE) };
  }

  tileCenter(tx, tz) {
    return { x: (tx + 0.5) * TILE, z: (tz + 0.5) * TILE };
  }

  // ------------------------------------------------------------------
  // Geração
  // ------------------------------------------------------------------
  generate() {
    const placed = [];
    let guard = 0;

    // 1) salas retangulares sem sobreposicao, com folga de 2 tiles
    while (placed.length < this.roomCount && guard < 900) {
      guard++;
      const w = this._irand(5, 9);
      const h = this._irand(5, 9);
      const x = this._irand(2, this.cols - w - 3);
      const z = this._irand(2, this.rows - h - 3);
      const pad = 3;

      const overlaps = placed.some(r =>
        x < r.x2 + pad && x + w > r.x1 - pad &&
        z < r.z2 + pad && z + h > r.z1 - pad
      );
      if (overlaps) continue;

      const room = { x1: x, z1: z, x2: x + w, z2: z + h, cx: x + (w >> 1), cz: z + (h >> 1) };
      placed.push(room);

      for (let tz = z; tz < z + h; tz++) {
        for (let tx = x; tx < x + w; tx++) this.setSolid(tx, tz, false);
      }
    }

    // 2) ordena por distância da origem e conecta em cadeia, mais alguns atalhos
    placed.sort((a, b) => (a.cx + a.cz) - (b.cx + b.cz));
    for (let i = 1; i < placed.length; i++) {
      this._carveCorridor(placed[i - 1], placed[i]);
    }
    // atalho extra para dar loop e evitar beco sem saída único
    for (let i = 0; i + 2 < placed.length; i += 3) {
      this._carveCorridor(placed[i], placed[i + 2]);
    }

    // 3) marca tipos de sala
    placed.forEach((r, i) => {
      r.index = i;
      if (i === 0) r.type = 'entry';
      else if (i === placed.length - 1) r.type = 'boss';
      else if (i % 4 === 0) r.type = 'elite';
      else r.type = 'combat';
    });

    this.rooms = placed;
    this.entryRoom = placed[0];
    this.bossRoom = placed[placed.length - 1];

    // 4) pontos de spawn por sala, aproveitando tiles livres com folga de parede
    for (const room of this.rooms) {
      room.spawns = [];
      for (let tz = room.z1 + 1; tz < room.z2 - 1; tz++) {
        for (let tx = room.x1 + 1; tx < room.x2 - 1; tx++) {
          if (this.isSolid(tx, tz)) continue;
          // precisa ter espaço livre em volta: não spawnar em gargalo
          let openNeighbors = 0;
          if (!this.isSolid(tx + 1, tz)) openNeighbors++;
          if (!this.isSolid(tx - 1, tz)) openNeighbors++;
          if (!this.isSolid(tx, tz + 1)) openNeighbors++;
          if (!this.isSolid(tx, tz - 1)) openNeighbors++;
          if (openNeighbors >= 3) {
            const c = this.tileCenter(tx, tz);
            room.spawns.push({ x: c.x, z: c.z, tx, tz });
          }
        }
      }
    }
  }

  _carveCorridor(a, b) {
    // Caminho em L: horizontal depois vertical (ou o inverso).
    const width = 2;
    const horizontalFirst = this._rand() > 0.5;
    const ax = a.cx, az = a.cz, bx = b.cx, bz = b.cz;

    const carveH = (x0, x1, z) => {
      const from = Math.min(x0, x1), to = Math.max(x0, x1);
      for (let tx = from; tx <= to; tx++) {
        for (let w = 0; w < width; w++) this.setSolid(tx, z + w, false);
      }
    };
    const carveV = (z0, z1, x) => {
      const from = Math.min(z0, z1), to = Math.max(z0, z1);
      for (let tz = from; tz <= to; tz++) {
        for (let w = 0; w < width; w++) this.setSolid(x + w, tz, false);
      }
    };

    if (horizontalFirst) {
      carveH(ax, bx, az);
      carveV(az, bz, bx);
    } else {
      carveV(az, bz, ax);
      carveH(ax, bx, bz);
    }
  }

  // ------------------------------------------------------------------
  // Consultas usadas por IA, tiro e minimapa
  // ------------------------------------------------------------------

  // Linha de visão livre entre dois pontos do mundo (algoritmo de Bresenham no grid).
  hasLineOfSight(x0, z0, x1, z1) {
    let { tx: x, tz: z } = this.worldToTile(x0, z0);
    const t = this.worldToTile(x1, z1);
    const dx = Math.abs(t.tx - x);
    const dz = Math.abs(t.tz - z);
    const sx = x < t.tx ? 1 : -1;
    const sz = z < t.tz ? 1 : -1;
    let err = dx - dz;
    let guard = 0;

    while (guard++ < 400) {
      if (this.isSolid(x, z)) return false;
      if (x === t.tx && z === t.tz) return true;
      const e2 = 2 * err;
      if (e2 > -dz) { err -= dz; x += sx; }
      if (e2 < dx) { err += dx; z += sz; }
    }
    return false;
  }

  // Raycast no grid: retorna a distância até a primeira parede (ou maxDist).
  raycastWall(x0, z0, dx, dz, maxDist) {
    let { tx, tz } = this.worldToTile(x0, z0);
    const stepX = dx > 0 ? 1 : -1;
    const stepZ = dz > 0 ? 1 : -1;
    const invX = dx === 0 ? Infinity : Math.abs(TILE / dx);
    const invZ = dz === 0 ? Infinity : Math.abs(TILE / dz);

    const nextBoundX = (tx + (stepX > 0 ? 1 : 0)) * TILE;
    const nextBoundZ = (tz + (stepZ > 0 ? 1 : 0)) * TILE;

    let tMaxX = dx === 0 ? Infinity : Math.abs((nextBoundX - x0) / dx);
    let tMaxZ = dz === 0 ? Infinity : Math.abs((nextBoundZ - z0) / dz);
    let dist = 0;
    let guard = 0;

    while (dist < maxDist && guard++ < 300) {
      if (tMaxX < tMaxZ) {
        dist = tMaxX;
        tMaxX += invX;
        tx += stepX;
      } else {
        dist = tMaxZ;
        tMaxZ += invZ;
        tz += stepZ;
      }
      if (dist > maxDist) break;
      if (this.isSolid(tx, tz)) return { hit: true, dist, tx, tz };
    }
    return { hit: false, dist: maxDist, tx, tz };
  }

  // Qual sala contem o ponto (ou null se estiver num corredor).
  roomAt(x, z) {
    const { tx, tz } = this.worldToTile(x, z);
    for (const room of this.rooms) {
      if (tx >= room.x1 && tx < room.x2 && tz >= room.z1 && tz < room.z2) return room;
    }
    return null;
  }

  // Ponto livre aleatório de uma sala, usado por spawner e drops.
  randomPointIn(room, avoid = null, minDist = 0) {
    if (!room.spawns || room.spawns.length === 0) return null;
    for (let i = 0; i < 12; i++) {
      const s = room.spawns[Math.floor(this._rand() * room.spawns.length)];
      if (!avoid) return s;
      const d = Math.hypot(s.x - avoid.x, s.z - avoid.z);
      if (d >= minDist) return s;
    }
    return room.spawns[Math.floor(this._rand() * room.spawns.length)];
  }

  bounds() {
    return {
      minX: 0, minZ: 0,
      maxX: this.cols * TILE,
      maxZ: this.rows * TILE
    };
  }
}