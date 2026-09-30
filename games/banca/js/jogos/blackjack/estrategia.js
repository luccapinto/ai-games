// Estratégia básica exata para a mesa declarada em regras.js:
// 6 baralhos, banca para no 17 macio (S17), dobra depois de dividir (DAS),
// desistência tardia (LS), ases divididos recebem uma carta só e não podem
// ser divididos de novo (sem RSA).
//
// As tabelas são dados: a interface desenha a mesma matriz que o código usa.
// Códigos: C comprar, P parar, D dobrar (senão comprar), Ds dobrar (senão
// parar), V dividir, R desistir (senão comprar).

import { valorCarta, valorMao, ehAs } from './regras.js';

// Colunas: carta da banca, do dois ao ás.
export const COLUNAS = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'A'];

export const CODIGOS = {
  C: 'comprar',
  P: 'parar',
  D: 'dobrar',
  Ds: 'dobrar ou parar',
  V: 'dividir',
  R: 'desistir',
};

const C = 'C', P = 'P', D = 'D', Ds = 'Ds', V = 'V', R = 'R';

// Totais duros, de 4 a 21. Índice do objeto = total da mão.
export const DURO = {
  4:  [C, C, C, C, C, C, C, C, C, C],
  5:  [C, C, C, C, C, C, C, C, C, C],
  6:  [C, C, C, C, C, C, C, C, C, C],
  7:  [C, C, C, C, C, C, C, C, C, C],
  8:  [C, C, C, C, C, C, C, C, C, C],
  9:  [C, D, D, D, D, C, C, C, C, C],
  10: [D, D, D, D, D, D, D, D, C, C],
  11: [D, D, D, D, D, D, D, D, D, C],
  12: [C, C, P, P, P, C, C, C, C, C],
  13: [P, P, P, P, P, C, C, C, C, C],
  14: [P, P, P, P, P, C, C, C, C, C],
  15: [P, P, P, P, P, C, C, C, R, C],
  16: [P, P, P, P, P, C, C, R, R, R],
  17: [P, P, P, P, P, P, P, P, P, P],
  18: [P, P, P, P, P, P, P, P, P, P],
  19: [P, P, P, P, P, P, P, P, P, P],
  20: [P, P, P, P, P, P, P, P, P, P],
  21: [P, P, P, P, P, P, P, P, P, P],
};

// Totais macios, de 12 (A,A sem divisão) a 21.
export const MACIO = {
  12: [C, C, C, C, C, C, C, C, C, C],
  13: [C, C, C, D, D, C, C, C, C, C],
  14: [C, C, C, D, D, C, C, C, C, C],
  15: [C, C, D, D, D, C, C, C, C, C],
  16: [C, C, D, D, D, C, C, C, C, C],
  17: [C, D, D, D, D, C, C, C, C, C],
  18: [P, Ds, Ds, Ds, Ds, P, P, C, C, C],
  19: [P, P, P, P, P, P, P, P, P, P],
  20: [P, P, P, P, P, P, P, P, P, P],
  21: [P, P, P, P, P, P, P, P, P, P],
};

// Pares, pelo valor da carta: 11 é o par de ases, 10 é qualquer par de dez,
export const PARES = {
  11: [V, V, V, V, V, V, V, V, V, V],
  10: [P, P, P, P, P, P, P, P, P, P],
  9:  [V, V, V, V, V, P, V, V, P, P],
  8:  [V, V, V, V, V, V, V, V, V, V],
  7:  [V, V, V, V, V, V, C, C, C, C],
  6:  [V, V, V, V, V, C, C, C, C, C],
  5:  [D, D, D, D, D, D, D, D, C, C],
  4:  [C, C, C, V, V, C, C, C, C, C],
  3:  [V, V, V, V, V, V, C, C, C, C],
  2:  [V, V, V, V, V, V, C, C, C, C],
};

export const LEGENDA = [
  ['C', 'Comprar'],
  ['P', 'Parar'],
  ['D', 'Dobrar, ou comprar se não puder'],
  ['Ds', 'Dobrar, ou parar se não puder'],
  ['V', 'Dividir'],
  ['R', 'Desistir, ou comprar se não puder'],
];

export const QUADRO = { colunas: COLUNAS, duro: DURO, macio: MACIO, pares: PARES, legenda: LEGENDA };

// Coluna da carta da banca: 2 a 10 viram 0 a 8, ás vira 9.
export function colunaBanca(cartaDaBanca) {
  const v = valorCarta(cartaDaBanca);
  return v === 11 ? 9 : v - 2;
}

// Resolve o código da tabela para uma ação concreta, respeitando o que a mesa
// permite agora. Um 11 de três cartas não pode dobrar: compra. Um 18 macio que
// não pode dobrar: para.
function resolver(codigo, { podeDobrar, podeDesistir }) {
  switch (codigo) {
    case 'C': return 'pedir';
    case 'P': return 'parar';
    case 'V': return 'dividir';
    case 'D': return podeDobrar ? 'dobrar' : 'pedir';
    case 'Ds': return podeDobrar ? 'dobrar' : 'parar';
    case 'R': return podeDesistir ? 'desistir' : 'pedir';
    default: return 'parar';
  }
}

// A ação da estratégia básica. `cartasDaMao` são as cartas da mão em jogo,
// `cartaDaBanca` é a carta aberta dela.
export function acaoBasica(cartasDaMao, cartaDaBanca, opcoes = {}) {
  const podeDobrar = !!opcoes.podeDobrar;
  const podeDividir = !!opcoes.podeDividir;
  const podeDesistir = !!opcoes.podeDesistir;
  const col = colunaBanca(cartaDaBanca);

  // Divisão primeiro: 8,8 contra dez se divide, não se desiste.
  if (podeDividir && cartasDaMao.length === 2) {
    const a = valorCarta(cartasDaMao[0]);
    const b = valorCarta(cartasDaMao[1]);
    if (a === b && PARES[a] && PARES[a][col] === 'V') return 'dividir';
  }

  const { total, macio } = valorMao(cartasDaMao);
  if (total > 21) return 'parar';
  const linha = macio ? (MACIO[total] ?? MACIO[21]) : (DURO[total] ?? DURO[21]);
  return resolver(linha[col], { podeDobrar, podeDesistir });
}

// A mesma decisão, mas devolvendo o código cru da tabela: a interface usa para
// pintar a célula do quadro que está valendo agora.
export function codigoBasico(cartasDaMao, cartaDaBanca, opcoes = {}) {
  const col = colunaBanca(cartaDaBanca);
  if (opcoes.podeDividir && cartasDaMao.length === 2) {
    const a = valorCarta(cartasDaMao[0]);
    const b = valorCarta(cartasDaMao[1]);
    if (a === b && PARES[a] && PARES[a][col] === 'V') return 'V';
  }
  const { total, macio } = valorMao(cartasDaMao);
  if (total > 21) return 'P';
  const linha = macio ? (MACIO[total] ?? MACIO[21]) : (DURO[total] ?? DURO[21]);
  return linha[col];
}

// O seguro nunca entra na estratégia básica: a prova mostra que ele tem valor
// esperado negativo em toda composição de sapato sem contagem.
export function aceitarSeguro() {
  return false;
}

export { ehAs };
