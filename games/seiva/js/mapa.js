// O tronco: grade de 20x12, a trilha que as pragas percorrem e as ondas.
//
// A trilha e fixa e desenhada a mao, nao gerada. Defesa de torre vive de a
// pessoa conhecer o caminho: se ele muda, planejar deixa de fazer sentido.

export const LARGURA = 20;
export const ALTURA = 12;
export const TILE = 32;

// Trilha em cotovelos. Cada par e uma quina; o caminho e preenchido entre elas.
const QUINAS = [
  [-1, 2], [4, 2], [4, 6], [9, 6], [9, 1], [13, 1],
  [13, 9], [6, 9], [6, 11],
];

function trilhaCompleta() {
  const celulas = [];
  for (let i = 0; i < QUINAS.length - 1; i++) {
    const [x0, y0] = QUINAS[i];
    const [x1, y1] = QUINAS[i + 1];
    const dx = Math.sign(x1 - x0);
    const dy = Math.sign(y1 - y0);
    let x = x0, y = y0;
    while (x !== x1 || y !== y1) {
      celulas.push([x, y]);
      x += dx;
      y += dy;
    }
  }
  celulas.push(QUINAS[QUINAS.length - 1]);
  return celulas;
}

export const TRILHA = trilhaCompleta();

// O coracao fica na ultima celula: praga que chega ali cobra uma vida.
export const CORACAO = TRILHA[TRILHA.length - 1];

const NA_TRILHA = new Set(TRILHA.map(([x, y]) => `${x},${y}`));
export function naTrilha(x, y) { return NA_TRILHA.has(`${x},${y}`); }

// Casca onde nao da para plantar: deixa o mapa com forma em vez de um tabuleiro
// vazio, e obriga a escolher lugar em vez de cobrir tudo.
const CASCA = [
  [0, 0], [1, 0], [0, 1], [1, 1],
  [17, 3], [18, 3], [19, 3], [18, 4], [19, 4],
  [2, 7], [3, 7], [2, 8], [3, 8],
  [16, 10], [17, 10], [18, 10], [17, 11], [18, 11],
  [0, 10], [0, 11], [1, 11],
  [11, 3], [11, 4],
];
const NA_CASCA = new Set(CASCA.map(([x, y]) => `${x},${y}`));
export function naCasca(x, y) { return NA_CASCA.has(`${x},${y}`); }

// Terra boa e a que encosta na trilha. Sem esse limite o mapa tem ~176 celulas
// livres, e a estrategia vira "cobrir tudo" — que nao e escolha nenhuma.
const PERTO = (() => {
  const s = new Set();
  for (const [tx, ty] of TRILHA) {
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) s.add(`${tx + dx},${ty + dy}`);
    }
  }
  return s;
})();

export function podePlantar(x, y) {
  return x >= 0 && x < LARGURA && y >= 0 && y < ALTURA
    && !naTrilha(x, y) && !naCasca(x, y) && PERTO.has(`${x},${y}`);
}

// ---------------------------------------------------------------- torres
// Custo, alcance e dano sao os tres numeros que decidem o jogo. Estao juntos
// aqui de proposito: balancear e mexer numa tabela, nao cacar constante solta.
export const TORRES = {
  espinho: {
    nome: 'ESPINHO', custo: 20, cor: '#d9e86b',
    alcance: 2.6, dano: 9, recarga: 34, tipo: 'unico',
    descricao: 'Barato e direto. Um alvo por vez.',
    melhoria: { custo: 26, dano: 17, alcance: 3.1, recarga: 30 },
  },
  esporo: {
    nome: 'ESPORO', custo: 45, cor: '#8fd98a',
    alcance: 2.2, dano: 6, recarga: 52, tipo: 'area', raio: 1.25,
    descricao: 'Acerta todo mundo por perto. Fraco sozinho.',
    melhoria: { custo: 55, dano: 11, alcance: 2.6, recarga: 46, raio: 1.5 },
  },
  resina: {
    nome: 'RESINA', custo: 35, cor: '#f0a94b',
    alcance: 2.8, dano: 2, recarga: 40, tipo: 'lentidao', fator: 0.55, duracao: 110,
    descricao: 'Quase não machuca. Deixa tudo lento.',
    melhoria: { custo: 40, dano: 4, alcance: 3.3, recarga: 36, fator: 0.42, duracao: 150 },
  },
  ferrao: {
    nome: 'FERRÃO', custo: 80, cor: '#e8776b',
    alcance: 4.2, dano: 30, recarga: 92, tipo: 'unico', perfura: true,
    descricao: 'Caro, lento e longe. Ignora casca dura.',
    melhoria: { custo: 95, dano: 54, alcance: 4.8, recarga: 84 },
  },
};

// ---------------------------------------------------------------- pragas
export const PRAGAS = {
  broca: { nome: 'broca', vida: 40, velocidade: 0.034, premio: 6, casca: 0, cor: '#b08160' },
  besouro: { nome: 'besouro', vida: 150, velocidade: 0.022, premio: 12, casca: 5, cor: '#6c7fa0' },
  lagarta: { nome: 'lagarta', vida: 78, velocidade: 0.050, premio: 8, casca: 0, cor: '#c4d16a' },
  fungo: { nome: 'fungo', vida: 420, velocidade: 0.017, premio: 26, casca: 10, cor: '#9a72b8' },
};

// ---------------------------------------------------------------- ondas
// `atraso` e em quadros entre uma praga e a seguinte dentro do mesmo grupo.
export const ONDAS = [
  { grupos: [{ praga: 'broca', quantidade: 6, atraso: 46 }] },
  { grupos: [{ praga: 'broca', quantidade: 10, atraso: 36 }] },
  { grupos: [{ praga: 'broca', quantidade: 8, atraso: 34 }, { praga: 'lagarta', quantidade: 4, atraso: 52, espera: 130 }] },
  { grupos: [{ praga: 'lagarta', quantidade: 12, atraso: 30 }] },
  { grupos: [{ praga: 'besouro', quantidade: 6, atraso: 62 }, { praga: 'broca', quantidade: 10, atraso: 26, espera: 90 }] },
  { grupos: [{ praga: 'lagarta', quantidade: 14, atraso: 24 }, { praga: 'besouro', quantidade: 5, atraso: 70, espera: 160 }] },
  { grupos: [{ praga: 'besouro', quantidade: 12, atraso: 42 }] },
  { grupos: [{ praga: 'fungo', quantidade: 2, atraso: 150 }, { praga: 'lagarta', quantidade: 16, atraso: 22, espera: 60 }] },
  { grupos: [{ praga: 'besouro', quantidade: 14, atraso: 34 }, { praga: 'fungo', quantidade: 3, atraso: 130, espera: 200 }] },
  { grupos: [{ praga: 'fungo', quantidade: 6, atraso: 100 }, { praga: 'besouro', quantidade: 16, atraso: 28, espera: 120 }, { praga: 'lagarta', quantidade: 20, atraso: 18, espera: 320 }] },
];

export const SEIVA_INICIAL = 70;
export const VIDAS_INICIAIS = 12;
