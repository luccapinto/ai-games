// O mundo e uma grade de 32x18 tiles de 16px. Fase de tela unica, sem camera:
// a sala inteira cabe na tela, e a dificuldade vem do desenho dela, nao de
// esconder o que vem adiante.

export const TILE = 16;
export const LARGURA = 32;
export const ALTURA = 18;

export const VAZIO = 0;
export const SOLIDO = 1;
export const ESPINHO_CIMA = 2;
export const ESPINHO_BAIXO = 3;
export const ESPINHO_ESQ = 4;
export const ESPINHO_DIR = 5;
export const QUEBRADICA = 6;
export const VENTO = 7;

const SIMBOLOS = {
  '#': SOLIDO,
  '^': ESPINHO_CIMA,
  'v': ESPINHO_BAIXO,
  '<': ESPINHO_ESQ,
  '>': ESPINHO_DIR,
  '-': QUEBRADICA,
  '~': VENTO,
};

const ESPINHOS = new Set([ESPINHO_CIMA, ESPINHO_BAIXO, ESPINHO_ESQ, ESPINHO_DIR]);

export class Mundo {
  constructor(fase) {
    this.nome = fase.nome;
    this.dica = fase.dica || '';
    this.dicaToque = fase.dicaToque || '';
    this.grade = new Uint8Array(LARGURA * ALTURA);
    this.fagulhas = [];
    this.saida = null;
    this.nascimento = { x: TILE, y: TILE };
    // Plataforma quebradica tem vida propria: some ao ser pisada e volta quando
    // a sala reinicia. Guardada fora da grade para o reinicio ser barato.
    this.quebradas = new Map();

    fase.mapa.forEach((linha, y) => {
      if (linha.length !== LARGURA) {
        throw new Error(`fase "${fase.nome}": linha ${y} tem ${linha.length} colunas, esperado ${LARGURA}`);
      }
      for (let x = 0; x < LARGURA; x++) {
        const s = linha[x];
        if (s === 'P') {
          this.nascimento = { x: x * TILE, y: y * TILE };
        } else if (s === 'A') {
          this.saida = { x: x * TILE, y: y * TILE };
        } else if (s === 'o') {
          this.fagulhas.push({ x: x * TILE + TILE / 2, y: y * TILE + TILE / 2, pego: false });
        } else if (SIMBOLOS[s] !== undefined) {
          this.grade[y * LARGURA + x] = SIMBOLOS[s];
        }
      }
    });

    if (!this.saida) throw new Error(`fase "${fase.nome}": sem antena (A)`);
    this.totalFagulhas = this.fagulhas.length;
  }

  emGrade(cx, cy) { return cx >= 0 && cx < LARGURA && cy >= 0 && cy < ALTURA; }

  tile(cx, cy) {
    if (!this.emGrade(cx, cy)) return VAZIO;
    const chave = cy * LARGURA + cx;
    if (this.quebradas.get(chave) === 0) return VAZIO;
    return this.grade[chave];
  }

  solido(cx, cy) {
    const t = this.tile(cx, cy);
    return t === SOLIDO || t === QUEBRADICA;
  }

  espinho(cx, cy) { return ESPINHOS.has(this.tile(cx, cy)); }

  vento(cx, cy) { return this.tile(cx, cy) === VENTO; }

  // Um retangulo encosta em algum solido?
  colide(x, y, w, h) {
    const x0 = Math.floor(x / TILE), x1 = Math.floor((x + w - 1) / TILE);
    const y0 = Math.floor(y / TILE), y1 = Math.floor((y + h - 1) / TILE);
    for (let cy = y0; cy <= y1; cy++) {
      for (let cx = x0; cx <= x1; cx++) {
        if (this.solido(cx, cy)) return true;
      }
    }
    return false;
  }

  // Espinho so machuca pela face exposta. Encostar na lateral de um espinho de
  // chao e injusto, e o jogador nunca entende por que morreu.
  machuca(x, y, w, h) {
    const x0 = Math.floor(x / TILE), x1 = Math.floor((x + w - 1) / TILE);
    const y0 = Math.floor(y / TILE), y1 = Math.floor((y + h - 1) / TILE);
    for (let cy = y0; cy <= y1; cy++) {
      for (let cx = x0; cx <= x1; cx++) {
        const t = this.tile(cx, cy);
        if (!ESPINHOS.has(t)) continue;
        const bx = cx * TILE, by = cy * TILE;
        if (t === ESPINHO_CIMA && y + h > by + 6 && y + h <= by + TILE && x + w > bx + 2 && x < bx + TILE - 2) return true;
        if (t === ESPINHO_BAIXO && y < by + TILE - 6 && y + h > by && x + w > bx + 2 && x < bx + TILE - 2) return true;
        if (t === ESPINHO_ESQ && x < bx + TILE - 6 && x + w > bx && y + h > by + 2 && y < by + TILE - 2) return true;
        if (t === ESPINHO_DIR && x + w > bx + 6 && x <= bx + TILE && y + h > by + 2 && y < by + TILE - 2) return true;
      }
    }
    return false;
  }

  noVento(x, y, w, h) {
    const x0 = Math.floor(x / TILE), x1 = Math.floor((x + w - 1) / TILE);
    const y0 = Math.floor(y / TILE), y1 = Math.floor((y + h - 1) / TILE);
    for (let cy = y0; cy <= y1; cy++) {
      for (let cx = x0; cx <= x1; cx++) if (this.vento(cx, cy)) return true;
    }
    return false;
  }

  // Pisar numa quebradica marca o tempo dela. Ela some depois, nao na hora:
  // sumir instantaneamente tira do jogador a chance de reagir.
  pisar(x, y, w) {
    const cy = Math.floor((y + 1) / TILE);
    const x0 = Math.floor(x / TILE), x1 = Math.floor((x + w - 1) / TILE);
    for (let cx = x0; cx <= x1; cx++) {
      const chave = cy * LARGURA + cx;
      if (this.grade[chave] === QUEBRADICA && !this.quebradas.has(chave)) {
        this.quebradas.set(chave, 26);
      }
    }
  }

  passo() {
    for (const [chave, restante] of this.quebradas) {
      if (restante > 0) this.quebradas.set(chave, restante - 1);
    }
  }

  reiniciar() {
    this.quebradas.clear();
    this.fagulhas.forEach(f => { f.pego = false; });
  }

  get pegas() { return this.fagulhas.filter(f => f.pego).length; }
}
