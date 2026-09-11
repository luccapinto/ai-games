// dungeon.js — geração do andar.
// Modelo: grid de tiles solidos/vazios. Salas retangulares conectadas por
// corredores em L. Colisão, linha de visão e caminho de IA usam esse grid,
// o que mantem tudo coerente e barato.

export const TILE = 3.0;          // tamanho do tile em unidades de mundo
export const WALL_H = 4.2;        // altura da parede

export class Dungeon {
  constructor({ floor = 1, cols = 46, rows = 46, roomCount = 8, seed = 1, layout = 'grid' } = {}) {
    this.floor = floor;
    this.cols = cols;
    this.rows = rows;
    this.roomCount = roomCount;
    this.seed = seed;
    // O layout muda a forma do andar, não as regras. Um corredor de metrô, uma
    // arena em anel e um arquivo apertado usam o mesmo grid, então colisão,
    // linha de visão e caminho de IA continuam valendo sem caso especial.
    this.layout = layout;
    if (layout === 'labirinto') this.roomCount = Math.max(roomCount, 12);
    if (layout === 'circulo') this.roomCount = Math.max(roomCount, 9);
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
    if (this.layout === 'espinha') return this._gerarEspinha();
    if (this.layout === 'circulo') return this._gerarCirculo();
    if (this.layout === 'labirinto') return this._gerarLabirinto();
    return this._gerarGrade();
  }

  // ------------------------------------------------------------------
  // Montagem comum: o que vem depois de decidir onde ficam as salas
  // ------------------------------------------------------------------
  _finalizar(placed, larguraCorredor = 2, atalhos = true, minVizinhos = 3) {
    // ordena por distância da origem e conecta em cadeia
    placed.sort((a, b) => (a.cx + a.cz) - (b.cx + b.cz));
    for (let i = 1; i < placed.length; i++) {
      this._carveCorridor(placed[i - 1], placed[i], larguraCorredor);
    }
    // atalho extra para dar loop e evitar beco sem saída único
    if (atalhos) {
      for (let i = 0; i + 2 < placed.length; i += 3) {
        this._carveCorridor(placed[i], placed[i + 2], larguraCorredor);
      }
    }

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

    for (const room of this.rooms) {
      room.spawns = [];
      for (let tz = room.z1 + 1; tz < room.z2 - 1; tz++) {
        for (let tx = room.x1 + 1; tx < room.x2 - 1; tx++) {
          if (this.isSolid(tx, tz)) continue;
          // Salas pequenas têm menos tiles com folga. Exigir 3 vizinhos livres
          // no labirinto deixava sala sem nenhum ponto de spawn, e sala vazia
          // quebra o ritmo: o jogador entra, não tem nada, e sai.
          let abertos = 0;
          if (!this.isSolid(tx + 1, tz)) abertos++;
          if (!this.isSolid(tx - 1, tz)) abertos++;
          if (!this.isSolid(tx, tz + 1)) abertos++;
          if (!this.isSolid(tx, tz - 1)) abertos++;
          if (abertos >= minVizinhos) {
            const c = this.tileCenter(tx, tz);
            room.spawns.push({ x: c.x, z: c.z, tx, tz });
          }
        }
      }
    }
  }

  _cavarSala(room) {
    for (let tz = room.z1; tz < room.z2; tz++) {
      for (let tx = room.x1; tx < room.x2; tx++) this.setSolid(tx, tz, false);
    }
  }

  // ------------------------------------------------------------------
  // grid — o padrão: salas soltas ligadas em cadeia
  // ------------------------------------------------------------------
  _gerarGrade() {
    const placed = [];
    let guard = 0;

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
      this._cavarSala(room);
    }

    this._finalizar(placed);
  }

  // ------------------------------------------------------------------
  // espinha — um corredor longo corta o andar e as salas pendem dele
  //
  // É o formato de estação e de corredor de negociação: você sempre sabe onde
  // está, porque existe uma linha mestra. Também deixa o trem do metrô ter um
  // trajeto reto e legível.
  // ------------------------------------------------------------------
  _gerarEspinha() {
    const placed = [];
    const horizontal = this._rand() > 0.5;

    // a via: um corredor largo no meio, de ponta a ponta
    const larguraVia = 3;
    const meio = Math.floor((horizontal ? this.rows : this.cols) / 2);

    if (horizontal) {
      for (let tx = 1; tx < this.cols - 1; tx++) {
        for (let w = -1; w <= larguraVia - 2; w++) this.setSolid(tx, meio + w, false);
      }
    } else {
      for (let tz = 1; tz < this.rows - 1; tz++) {
        for (let w = -1; w <= larguraVia - 2; w++) this.setSolid(meio + w, tz, false);
      }
    }

    // salas penduradas dos dois lados, cada uma com uma porta curta até a via
    const porLado = Math.ceil(this.roomCount / 2);
    for (let lado = 0; lado < 2; lado++) {
      for (let i = 0; i < porLado; i++) {
        if (placed.length >= this.roomCount) break;
        const w = this._irand(5, 8);
        const h = this._irand(4, 7);
        const folga = 4;
        let room = null;

        for (let tentativa = 0; tentativa < 40 && !room; tentativa++) {
          const aoLongo = this._irand(folga, (horizontal ? this.cols : this.rows) - folga - (horizontal ? w : h));
          let x, z;
          if (horizontal) {
            x = aoLongo;
            z = lado === 0 ? meio - larguraVia - h - this._irand(1, 2) : meio + larguraVia + this._irand(1, 2);
          } else {
            z = aoLongo;
            x = lado === 0 ? meio - larguraVia - w - this._irand(1, 2) : meio + larguraVia + this._irand(1, 2);
          }
          if (x < 1 || z < 1 || x + w >= this.cols - 1 || z + h >= this.rows - 1) continue;

          const colide = placed.some(r =>
            x < r.x2 + 2 && x + w > r.x1 - 2 && z < r.z2 + 2 && z + h > r.z1 - 2);
          if (colide) continue;

          room = { x1: x, z1: z, x2: x + w, z2: z + h, cx: x + (w >> 1), cz: z + (h >> 1) };
        }

        if (!room) continue;
        placed.push(room);
        this._cavarSala(room);

        // porta: liga a sala à via pela face mais próxima
        if (horizontal) {
          const px = room.cx;
          const de = lado === 0 ? room.z2 - 1 : room.z1;
          const ate = lado === 0 ? meio - 1 : meio + larguraVia;
          for (let tz = Math.min(de, ate); tz <= Math.max(de, ate); tz++) {
            this.setSolid(px, tz, false);
            this.setSolid(px + 1, tz, false);
          }
        } else {
          const pz = room.cz;
          const de = lado === 0 ? room.x2 - 1 : room.x1;
          const ate = lado === 0 ? meio - 1 : meio + larguraVia;
          for (let tx = Math.min(de, ate); tx <= Math.max(de, ate); tx++) {
            this.setSolid(tx, pz, false);
            this.setSolid(tx, pz + 1, false);
          }
        }
      }
    }

    this._finalizar(placed, 2, false);
  }

  // ------------------------------------------------------------------
  // circulo — as salas formam um anel em volta de uma praça central
  //
  // A praça é o palco: no comício, é onde o chefe discursa, e o anel dá voltas
  // em volta dele. Combate aqui é sempre em movimento.
  // ------------------------------------------------------------------
  _gerarCirculo() {
    const placed = [];
    const meioX = Math.floor(this.cols / 2);
    const meioZ = Math.floor(this.rows / 2);

    // praça central: a maior sala, e sempre a última a ser marcada como chefe
    const w0 = this._irand(9, 12);
    const h0 = this._irand(9, 12);
    const centro = {
      x1: meioX - (w0 >> 1), z1: meioZ - (h0 >> 1),
      x2: meioX - (w0 >> 1) + w0, z2: meioZ - (h0 >> 1) + h0,
      cx: meioX, cz: meioZ
    };
    placed.push(centro);
    this._cavarSala(centro);

    const noAnel = this.roomCount - 1;
    const raio = Math.min(this.cols, this.rows) * 0.36;

    for (let i = 0; i < noAnel; i++) {
      const ang = (i / noAnel) * Math.PI * 2;
      const w = this._irand(5, 8);
      const h = this._irand(5, 8);
      let room = null;

      for (let tentativa = 0; tentativa < 30 && !room; tentativa++) {
        const r = raio * (1 - tentativa * 0.02);
        const cx = Math.round(meioX + Math.cos(ang) * r);
        const cz = Math.round(meioZ + Math.sin(ang) * r);
        const x = cx - (w >> 1);
        const z = cz - (h >> 1);
        if (x < 1 || z < 1 || x + w >= this.cols - 1 || z + h >= this.rows - 1) continue;

        const colide = placed.some(k =>
          x < k.x2 + 2 && x + w > k.x1 - 2 && z < k.z2 + 2 && z + h > k.z1 - 2);
        if (colide) continue;

        room = { x1: x, z1: z, x2: x + w, z2: z + h, cx: x + (w >> 1), cz: z + (h >> 1) };
      }

      if (!room) continue;
      placed.push(room);
      this._cavarSala(room);

      // raio: liga cada sala do anel à praça
      this._carveCorridor(room, centro, 2);
    }

    // A praça vira o chefe e a entrada vira a sala mais distante dela, para o
    // jogador atravessar o anel antes de chegar na luta.
    this._finalizar(placed, 2, true);

    const dist = (r) => Math.hypot(r.cx - centro.cx, r.cz - centro.cz);
    const maisLonge = this.rooms.reduce((a, b) => (dist(a) > dist(b) ? a : b));
    const chefe = this.rooms.find(r => r.cx === centro.cx && r.cz === centro.cz) || this.rooms[0];

    for (const r of this.rooms) r.type = 'combat';
    if (maisLonge) maisLonge.type = 'entry';
    if (chefe) chefe.type = 'boss';
    for (let i = 1; i < this.rooms.length; i += 3) {
      const r = this.rooms[i];
      if (r !== maisLonge && r !== chefe) r.type = 'elite';
    }

    this.entryRoom = maisLonge || this.rooms[0];
    this.bossRoom = chefe || this.rooms[this.rooms.length - 1];
  }

  // ------------------------------------------------------------------
  // labirinto — muitas salas pequenas e corredores estreitos
  //
  // O arquivo do tribunal: você ouve o tiro antes de ver quem atirou, e a
  // linha de visão quase nunca passa de uma sala. Aqui a cobertura vale mais
  // que a velocidade.
  // ------------------------------------------------------------------
  _gerarLabirinto() {
    const placed = [];
    let guard = 0;

    while (placed.length < this.roomCount && guard < 2000) {
      guard++;
      // A primeira sala é a entrada e a última é o chefe. As duas precisam
      // caber o que vai dentro: sala de 3x3 não acomoda nem o jogador nem o
      // chefe com as âncoras dele.
      const ehChefe = placed.length === this.roomCount - 1;
      const minimo = ehChefe ? 6 : 4;
      const w = this._irand(minimo, minimo + 3);
      const h = this._irand(minimo, minimo + 3);
      const x = this._irand(2, this.cols - w - 3);
      const z = this._irand(2, this.rows - h - 3);
      const pad = 2;

      const colide = placed.some(r =>
        x < r.x2 + pad && x + w > r.x1 - pad && z < r.z2 + pad && z + h > r.z1 - pad);
      if (colide) continue;

      const room = { x1: x, z1: z, x2: x + w, z2: z + h, cx: x + (w >> 1), cz: z + (h >> 1) };
      placed.push(room);
      this._cavarSala(room);
    }

    // Corredor de largura 1 é o que dá a sensação de arquivo apertado, e o
    // critério de spawn desce para 2 vizinhos livres.
    this._finalizar(placed, 1, true, 2);
  }

  _carveCorridor(a, b, width = 2) {
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