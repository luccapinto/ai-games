// Valor esperado do blackjack em baralho infinito.
//
// Para que serve: o treinador precisa dizer, em números, quanto cada ação vale
// na mão que está na mesa. Enumerar o sapato de 312 cartas a cada decisão é
// caro; com baralho infinito (cada índice sai com 1/13, dez com 4/13) a conta
// é exata, fecha em milissegundos e erra por menos de 0,1% de aposta nas
// decisões que importam.
//
// Duas escolhas que mudam os números e estão declaradas de propósito:
//
// 1. A distribuição da banca é CONDICIONADA a ela não ter blackjack. A mesa
//    espia o furo com ás ou dez aberto, então quando o jogador decide já se
//    sabe que a banca não tem 21 natural. Sem esse condicionamento o VE de
//    parar contra ás sairia muito pior do que é.
// 2. O VE de dividir é uma APROXIMAÇÃO documentada: cada mão nascida da
//    divisão é tratada como uma mão nova de duas cartas (a carta do par mais
//    uma carta do baralho infinito), jogada com dobra liberada (DAS) e sem
//    nova divisão. Isso ignora o resplit até 4 mãos, o que subestima um pouco
//    o valor de dividir, e ignora a remoção de cartas. Ases divididos recebem
//    uma carta e param, como manda a mesa.
//
// Sem DOM, sem estado: dá para rodar em Node e nas provas.

import { REGRAS, valorCarta, valorMao, somarCarta } from './regras.js';

// Probabilidade de cada valor de carta no baralho infinito. Índice 1 = ás.
export const P_CARTA = (() => {
  const p = new Float64Array(11);
  for (let r = 1; r <= 9; r++) p[r] = 1 / 13;
  p[10] = 4 / 13;
  return p;
})();

// Índices do resultado final da banca: 0..4 são 17 a 21, 5 é estouro.
const ESTOURO = 5;

function bancaPara(total, macio) {
  if (total > 21) return true;
  if (total > 17) return true;
  if (total < 17) return false;
  return REGRAS.s17 || !macio;
}

// Distribuição do total final da banca a partir de (total, macio), sem
// condicionamento: a conta pura de quem compra até parar.
function apartirDe(total, macio, memo) {
  const chave = total * 2 + (macio ? 1 : 0);
  const pronto = memo.get(chave);
  if (pronto) return pronto;
  const saida = new Float64Array(6);
  memo.set(chave, saida);
  if (bancaPara(total, macio)) {
    if (total > 21) saida[ESTOURO] = 1;
    else saida[total - 17] = 1;
    return saida;
  }
  for (let r = 1; r <= 10; r++) {
    const p = P_CARTA[r];
    if (p === 0) continue;
    const s = somarCarta(total, macio, r);
    const d = apartirDe(s.total, s.macio, memo);
    for (let i = 0; i < 6; i++) saida[i] += p * d[i];
  }
  return saida;
}

const memoBanca = new Map();
const cacheDist = new Map();

// Distribuição do total final da banca dada a carta aberta, CONDICIONADA a ela
// não ter blackjack (a mesa já espiou). `up` é o valor de jogo: 2 a 10, ou 11
// para o ás.
export function distribuicaoBanca(up) {
  const pronto = cacheDist.get(up);
  if (pronto) return pronto;
  const asAberto = up === 11;
  const t0 = asAberto ? 11 : up;
  const m0 = asAberto;
  const saida = new Float64Array(6);
  let peso = 0;
  for (let r = 1; r <= 10; r++) {
    // A carta que faria blackjack está descartada pelo peek.
    if (asAberto && r === 10) continue;
    if (up === 10 && r === 1) continue;
    const p = P_CARTA[r];
    peso += p;
    const s = somarCarta(t0, m0, r);
    const d = apartirDe(s.total, s.macio, memoBanca);
    for (let i = 0; i < 6; i++) saida[i] += p * d[i];
  }
  for (let i = 0; i < 6; i++) saida[i] /= peso;
  cacheDist.set(up, saida);
  return saida;
}

// Probabilidade de a banca ter blackjack antes do peek, dada a carta aberta.
export function chanceBlackjackBanca(up) {
  if (up === 11) return P_CARTA[10];
  if (up === 10) return P_CARTA[1];
  return 0;
}

// VE de parar com `total` contra a distribuição da banca.
export function evParar(total, dist) {
  if (total > 21) return -1;
  let ev = dist[ESTOURO];
  for (let t = 17; t <= 21; t++) {
    const p = dist[t - 17];
    if (p === 0) continue;
    if (total > t) ev += p;
    else if (total < t) ev -= p;
  }
  return ev;
}

// VE de comprar jogando o resto da mão do melhor jeito possível (comprar ou
// parar; depois da primeira compra a mesa não deixa mais dobrar).
function evComprarMemo(total, macio, dist, memo) {
  const chave = total * 2 + (macio ? 1 : 0);
  const pronto = memo.get(chave);
  if (pronto !== undefined) return pronto;
  let ev = 0;
  for (let r = 1; r <= 10; r++) {
    const p = P_CARTA[r];
    if (p === 0) continue;
    const s = somarCarta(total, macio, r);
    if (s.total > 21) { ev -= p; continue; }
    const parar = evParar(s.total, dist);
    const comprar = evComprarMemo(s.total, s.macio, dist, memo);
    ev += p * Math.max(parar, comprar);
  }
  memo.set(chave, ev);
  return ev;
}

const memosComprar = new Map();
function memoDe(up) {
  let m = memosComprar.get(up);
  if (!m) { m = new Map(); memosComprar.set(up, m); }
  return m;
}

export function evComprar(total, macio, up) {
  return evComprarMemo(total, macio, distribuicaoBanca(up), memoDe(up));
}

// VE de dobrar: exatamente uma carta e para, com o dobro em jogo.
export function evDobrar(total, macio, up) {
  const dist = distribuicaoBanca(up);
  let ev = 0;
  for (let r = 1; r <= 10; r++) {
    const p = P_CARTA[r];
    if (p === 0) continue;
    const s = somarCarta(total, macio, r);
    ev += p * 2 * (s.total > 21 ? -1 : evParar(s.total, dist));
  }
  return ev;
}

// VE de dividir um par, por unidade da aposta original da mão (as duas mãos
// somadas). Aproximação documentada no cabeçalho.
export function evDividir(valorPar, up) {
  const dist = distribuicaoBanca(up);
  const memo = memoDe(up);
  let ev = 0;
  if (valorPar === 11) {
    // Ás dividido: uma carta e para. Vinte e um aqui não é blackjack.
    for (let r = 1; r <= 10; r++) {
      const p = P_CARTA[r];
      if (p === 0) continue;
      const s = somarCarta(11, true, r);
      ev += p * evParar(s.total, dist);
    }
    return 2 * ev;
  }
  for (let r = 1; r <= 10; r++) {
    const p = P_CARTA[r];
    if (p === 0) continue;
    const s = somarCarta(valorPar, false, r);
    const parar = evParar(s.total, dist);
    const comprar = s.total > 21 ? -1 : evComprarMemo(s.total, s.macio, dist, memo);
    const dobrar = REGRAS.das ? evDobrar(s.total, s.macio, up) : -Infinity;
    ev += p * Math.max(parar, comprar, dobrar);
  }
  return 2 * ev;
}

export const EV_DESISTIR = -0.5;

// A conta que o treinador mostra: VE de cada ação disponível, por unidade da
// aposta que está naquela mão.
export function avaliar(cartasDaMao, cartaDaBanca, opcoes = {}) {
  const up = valorCarta(cartaDaBanca);
  const { total, macio } = valorMao(cartasDaMao);
  const dist = distribuicaoBanca(up);
  const evs = {
    pedir: total > 21 ? -1 : evComprar(total, macio, up),
    parar: evParar(total, dist),
  };
  if (opcoes.podeDobrar) evs.dobrar = evDobrar(total, macio, up);
  if (opcoes.podeDividir && cartasDaMao.length === 2) {
    evs.dividir = evDividir(valorCarta(cartasDaMao[0]), up);
  }
  if (opcoes.podeDesistir) evs.desistir = EV_DESISTIR;
  return evs;
}

// A ação de maior VE entre as disponíveis. Serve para medir o custo do erro.
export function melhorAcao(evs) {
  let melhor = null;
  let valor = -Infinity;
  for (const k of ['pedir', 'parar', 'dobrar', 'dividir', 'desistir']) {
    if (evs[k] === undefined) continue;
    if (evs[k] > valor + 1e-12) { valor = evs[k]; melhor = k; }
  }
  return { acao: melhor, ev: valor };
}

// Quanto cada ação perde em relação à melhor, por unidade de aposta.
export function custoPorFicha(evs) {
  const { ev } = melhorAcao(evs);
  const custo = {};
  for (const k of Object.keys(evs)) custo[k] = Math.max(0, ev - evs[k]);
  return custo;
}
