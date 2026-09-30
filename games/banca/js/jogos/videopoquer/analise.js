// O resolvedor exato do vídeo pôquer.
//
// A pergunta é simples e a força bruta é cara: para cada uma das 32 maneiras
// de segurar cartas, qual é o valor esperado da troca? Somar mão por mão
// daria até C(47,5) = 1.533.939 sorteios por decisão.
//
// O truque é somar uma vez só, antes de tudo. Para cada uma das 2.598.960 mãos
// de cinco cartas F do baralho, o pagamento pay(F) é somado em T(X) para todo
// subconjunto X de F, de tamanho 0 a 5. T(X) passa a ser "quanto pagam, no
// total, todas as mãos que contêm X". Os subconjuntos são numerados pelo
// sistema numérico combinatório (índice = soma de C(carta, posição)), então
// tudo mora em seis vetores tipados contíguos.
//
// Na hora da jogada, com a mão dada H uniao D (D = descarte), vale
//
//   soma das mãos que contêm H e evitam D = soma sobre S contido em D de (-1)^|S| T(H uniao S)
//
// que é inclusão e exclusão pura. Como H e S são sempre subconjuntos das cinco
// cartas dadas, os 32 valores saem de uma transformada de Möbius sobre os 32
// subconjuntos da mão: 80 somas. Dividindo por C(47, 5 - |H|) sai o VE por
// moeda de cada retenção, exato, em microssegundos.
//
// O royal não precisa de tabela: só existem quatro mãos royal no baralho, e
// quantas delas contêm um subconjunto dado se conta na hora. Como o prêmio do
// royal muda de 250 para 800 por moeda na quinta moeda, guardamos as tabelas
// com royal valendo 250 e corrigimos com a contagem. A mesma contagem corrige
// a tabela dos quadrados, que serve para a variância.
//
// Nada de DOM: roda em Node, nas provas e dentro do trabalhador do navegador.

import { valorDe, naipeDe } from '../../nucleo/baralho.js';
import { TABELA, CATEGORIAS, categoriaDeMascaras, ROYAL_POR_MOEDA, ROYAL_CINCO_MOEDAS, MAX_MOEDAS } from './regras.js';

export const TOTAL_MAOS = 2598960;
export const RESTANTES = 47;

// Binomiais até C(51,5).
const BIN = (() => {
  const b = [];
  for (let n = 0; n <= 52; n++) {
    b.push(new Float64Array(7));
    b[n][0] = 1;
    for (let k = 1; k <= 6; k++) b[n][k] = n === 0 ? 0 : b[n - 1][k - 1] + b[n - 1][k];
  }
  return b;
})();
export const binomio = (n, k) => (k < 0 || k > n ? 0 : BIN[n][k]);

const TAMANHOS = [1, 52, 1326, 22100, 270725, TOTAL_MAOS];
// C(47, 5 - tamanho da retenção): quantos sorteios existem para cada retenção.
const SORTEIOS = [binomio(47, 5), binomio(47, 4), binomio(47, 3), binomio(47, 2), binomio(47, 1), 1];

const POP = new Uint8Array(32);
for (let m = 0; m < 32; m++) { let c = 0, x = m; while (x) { x &= x - 1; c++; } POP[m] = c; }

// Pagamento por moeda de cada categoria, com o royal valendo 250. A correção
// para 800 entra pela contagem de royals.
const PAGA_CATEGORIA = (() => {
  const p = {};
  for (const c of CATEGORIAS) p[c] = TABELA[c].porMoeda;
  return p;
})();
export const EXTRA_ROYAL = ROYAL_CINCO_MOEDAS - ROYAL_POR_MOEDA;

const bit1 = new Int32Array(52);
const bit2 = new Int32Array(52);
const bit3 = new Int32Array(52);
const bit4 = new Int32Array(52);
const bit5 = new Int32Array(52);
const RANK_BIT = new Int32Array(52);
const NAIPE = new Int32Array(52);
const EH_ROYAL = new Uint8Array(52);
for (let c = 0; c < 52; c++) {
  bit1[c] = c;
  bit2[c] = binomio(c, 2);
  bit3[c] = binomio(c, 3);
  bit4[c] = binomio(c, 4);
  bit5[c] = binomio(c, 5);
  const v = valorDe(c);
  RANK_BIT[c] = 1 << v;
  NAIPE[c] = naipeDe(c);
  EH_ROYAL[c] = (v === 0 || v >= 9) ? 1 : 0;
}

// Pagamento por moeda das 2.598.960 mãos, com royal a 250.
function pagaDeMascaras(m1, m2, m3, m4, mesmoNaipe) {
  return PAGA_CATEGORIA[categoriaDeMascaras(m1, m2, m3, m4, mesmoNaipe)];
}

// Constrói as seis tabelas de subconjuntos. Síncrona e pura.
export function construirTabelas({ quadrados = true } = {}) {
  const t0 = (typeof performance !== 'undefined' ? performance.now() : Date.now());
  const paga = TAMANHOS.map(n => new Float64Array(n));
  const quad = quadrados ? TAMANHOS.map(n => new Float64Array(n)) : null;

  const ii = new Int32Array(32);
  let totalP = 0, totalQ = 0;

  for (let a = 0; a < 48; a++) {
    const m1a = RANK_BIT[a], na = NAIPE[a];
    ii[1] = a;
    let sPa = 0, sQa = 0;
    for (let b = a + 1; b < 49; b++) {
      const rb = RANK_BIT[b];
      const m2b = m1a & rb, m1b = m1a | rb;
      const fb = NAIPE[b] === na;
      ii[2] = b;
      ii[3] = a + bit2[b];
      let sPb = 0, sQb = 0;
      for (let c = b + 1; c < 50; c++) {
        const rc = RANK_BIT[c];
        const m3c = m2b & rc, m2c = m2b | (m1b & rc), m1c = m1b | rc;
        const fc = fb && NAIPE[c] === na;
        ii[4] = c;
        ii[5] = a + bit2[c];
        ii[6] = b + bit2[c];
        ii[7] = ii[3] + bit3[c];
        let sPc = 0, sQc = 0;
        for (let d = c + 1; d < 51; d++) {
          const rd = RANK_BIT[d];
          const m4d = m3c & rd, m3d = m3c | (m2c & rd), m2d = m2c | (m1c & rd), m1d = m1c | rd;
          const fd = fc && NAIPE[d] === na;
          ii[8] = d;
          ii[9] = a + bit2[d];
          ii[10] = b + bit2[d];
          ii[11] = ii[3] + bit3[d];
          ii[12] = c + bit2[d];
          ii[13] = ii[5] + bit3[d];
          ii[14] = ii[6] + bit3[d];
          ii[15] = ii[7] + bit4[d];
          let sPd = 0, sQd = 0;
          for (let e = d + 1; e < 52; e++) {
            const re = RANK_BIT[e];
            const m4 = m4d | (m3d & re), m3 = m3d | (m2d & re), m2 = m2d | (m1d & re), m1 = m1d | re;
            const flush = fd && NAIPE[e] === na;
            const p = pagaDeMascaras(m1, m2, m3, m4, flush);
            ii[16] = e;
            ii[17] = a + bit2[e];
            ii[18] = b + bit2[e];
            ii[19] = ii[3] + bit3[e];
            ii[20] = c + bit2[e];
            ii[21] = ii[5] + bit3[e];
            ii[22] = ii[6] + bit3[e];
            ii[23] = ii[7] + bit4[e];
            ii[24] = d + bit2[e];
            ii[25] = ii[9] + bit3[e];
            ii[26] = ii[10] + bit3[e];
            ii[27] = ii[11] + bit4[e];
            ii[28] = ii[12] + bit3[e];
            ii[29] = ii[13] + bit4[e];
            ii[30] = ii[14] + bit4[e];
            ii[31] = ii[15] + bit5[e];
            if (p !== 0) {
              for (let m = 16; m < 32; m++) paga[POP[m]][ii[m]] += p;
              sPd += p;
            }
            if (quad) {
              const q = p * p;
              if (q !== 0) {
                for (let m = 16; m < 32; m++) quad[POP[m]][ii[m]] += q;
                sQd += q;
              }
            }
          }
          if (sPd !== 0) { for (let m = 8; m < 16; m++) paga[POP[m]][ii[m]] += sPd; sPc += sPd; }
          if (quad && sQd !== 0) { for (let m = 8; m < 16; m++) quad[POP[m]][ii[m]] += sQd; sQc += sQd; }
        }
        if (sPc !== 0) { for (let m = 4; m < 8; m++) paga[POP[m]][ii[m]] += sPc; sPb += sPc; }
        if (quad && sQc !== 0) { for (let m = 4; m < 8; m++) quad[POP[m]][ii[m]] += sQc; sQb += sQc; }
      }
      if (sPb !== 0) { paga[1][ii[2]] += sPb; paga[2][ii[3]] += sPb; sPa += sPb; }
      if (quad && sQb !== 0) { quad[1][ii[2]] += sQb; quad[2][ii[3]] += sQb; sQa += sQb; }
    }
    if (sPa !== 0) { paga[1][ii[1]] += sPa; totalP += sPa; }
    if (quad && sQa !== 0) { quad[1][ii[1]] += sQa; totalQ += sQa; }
  }
  paga[0][0] = totalP;
  if (quad) quad[0][0] = totalQ;

  return {
    paga,
    quad,
    tamanhos: TAMANHOS.slice(),
    ms: (typeof performance !== 'undefined' ? performance.now() : Date.now()) - t0,
  };
}

// As quatro mãos royal do baralho, uma por naipe: quantas contêm cada
// subconjunto das cinco cartas dadas.
function contarRoyals(cartas, royal) {
  royal.fill(0);
  for (let s = 0; s < 4; s++) {
    let r = 0;
    for (let p = 0; p < 5; p++) {
      const c = cartas[p];
      if (EH_ROYAL[c] && NAIPE[c] === s) r |= 1 << p;
    }
    let sub = r;
    for (;;) { royal[sub]++; if (sub === 0) break; sub = (sub - 1) & r; }
  }
}

// Transformada de Möbius sobre supersets: u[H] = soma_{H contido em A} (-1)^{|A|-|H|} t[A].
function mobius(u) {
  for (let i = 0; i < 5; i++) {
    const b = 1 << i;
    for (let m = 0; m < 32; m++) if ((m & b) === 0) u[m] -= u[m | b];
  }
}

// Índices das 32 submáscaras de uma mão JÁ ORDENADA de forma crescente.
function indices(ordenada, ii) {
  const a = ordenada[0], b = ordenada[1], c = ordenada[2], d = ordenada[3], e = ordenada[4];
  ii[0] = 0;
  ii[1] = a;
  ii[2] = b;
  ii[3] = a + bit2[b];
  ii[4] = c;
  ii[5] = a + bit2[c];
  ii[6] = b + bit2[c];
  ii[7] = ii[3] + bit3[c];
  ii[8] = d;
  ii[9] = a + bit2[d];
  ii[10] = b + bit2[d];
  ii[11] = ii[3] + bit3[d];
  ii[12] = c + bit2[d];
  ii[13] = ii[5] + bit3[d];
  ii[14] = ii[6] + bit3[d];
  ii[15] = ii[7] + bit4[d];
  ii[16] = e;
  ii[17] = a + bit2[e];
  ii[18] = b + bit2[e];
  ii[19] = ii[3] + bit3[e];
  ii[20] = c + bit2[e];
  ii[21] = ii[5] + bit3[e];
  ii[22] = ii[6] + bit3[e];
  ii[23] = ii[7] + bit4[e];
  ii[24] = d + bit2[e];
  ii[25] = ii[9] + bit3[e];
  ii[26] = ii[10] + bit3[e];
  ii[27] = ii[11] + bit4[e];
  ii[28] = ii[12] + bit3[e];
  ii[29] = ii[13] + bit4[e];
  ii[30] = ii[14] + bit4[e];
  ii[31] = ii[15] + bit5[e];
}

// Desempate declarado: entre retenções de mesmo VE (até 1e-9), fica a que
// segura MAIS cartas; persistindo o empate, a de menor máscara. Segurar mais
// cartas é o conselho menos surpreendente para quem está aprendendo, e a regra
// é determinística, então a prova e a interface nunca discordam.
function escolherMelhor(evs) {
  let melhor = 0;
  for (let m = 1; m < 32; m++) {
    const d = evs[m] - evs[melhor];
    if (d > 1e-9) melhor = m;
    else if (d > -1e-9 && POP[m] > POP[melhor]) melhor = m;
  }
  return melhor;
}

const _ii = new Int32Array(32);
const _t = new Float64Array(32);
const _royal = new Int32Array(32);
const _ord = new Int32Array(5);

// VE por moeda das 32 retenções. `mao5` está na ordem em que as cartas foram
// dadas, e o bit i da máscara é a carta i dessa ordem.
export function analisar(mao5, tabelas, moedas = MAX_MOEDAS) {
  const ordem = [0, 1, 2, 3, 4].sort((x, y) => mao5[x] - mao5[y]);
  for (let i = 0; i < 5; i++) _ord[i] = mao5[ordem[i]];
  for (let i = 1; i < 5; i++) if (_ord[i] === _ord[i - 1]) throw new Error('A mão tem cartas repetidas.');

  indices(_ord, _ii);
  contarRoyals(_ord, _royal);
  const extra = moedas === MAX_MOEDAS ? EXTRA_ROYAL : 0;
  const paga = tabelas.paga;
  for (let m = 0; m < 32; m++) _t[m] = paga[POP[m]][_ii[m]] + extra * _royal[m];
  mobius(_t);

  // De volta para a ordem em que as cartas estão na mesa.
  const evsOrd = new Float64Array(32);
  for (let m = 0; m < 32; m++) evsOrd[m] = _t[m] / SORTEIOS[POP[m]];
  const evs = new Float64Array(32);
  for (let mask = 0; mask < 32; mask++) {
    let alvo = 0;
    for (let i = 0; i < 5; i++) if (mask & (1 << ordem[i])) alvo |= 1 << i;
    evs[mask] = evsOrd[alvo];
  }
  return { evs, melhor: escolherMelhor(evs) };
}

// Percorre as 2.598.960 mãos iniciais e devolve o retorno ótimo por moeda e a
// variância do resultado por moeda sob estratégia ótima.
export function rtpOtimo(tabelas, moedas = MAX_MOEDAS) {
  const t0 = (typeof performance !== 'undefined' ? performance.now() : Date.now());
  const paga = tabelas.paga;
  const quad = tabelas.quad;
  const extra = moedas === MAX_MOEDAS ? EXTRA_ROYAL : 0;
  const extraQ = moedas === MAX_MOEDAS ? ROYAL_CINCO_MOEDAS * ROYAL_CINCO_MOEDAS - ROYAL_POR_MOEDA * ROYAL_POR_MOEDA : 0;
  const ii = new Int32Array(32);
  const t = new Float64Array(32);
  const royal = new Int32Array(32);
  const cartas = new Int32Array(5);
  let soma = 0, soma2 = 0, n = 0;

  for (let a = 0; a < 48; a++) {
    cartas[0] = a;
    for (let b = a + 1; b < 49; b++) {
      cartas[1] = b;
      for (let c = b + 1; c < 50; c++) {
        cartas[2] = c;
        for (let d = c + 1; d < 51; d++) {
          cartas[3] = d;
          for (let e = d + 1; e < 52; e++) {
            cartas[4] = e;
            indices(cartas, ii);
            contarRoyals(cartas, royal);
            for (let m = 0; m < 32; m++) t[m] = paga[POP[m]][ii[m]] + extra * royal[m];
            mobius(t);
            let melhor = 0, melhorEv = t[0] / SORTEIOS[0];
            for (let m = 1; m < 32; m++) {
              const ev = t[m] / SORTEIOS[POP[m]];
              if (ev > melhorEv + 1e-9 || (ev > melhorEv - 1e-9 && POP[m] > POP[melhor])) { melhorEv = ev; melhor = m; }
            }
            soma += melhorEv;
            n++;
            if (quad) {
              // Só os supersets da retenção escolhida entram no quadrado.
              let s = 0;
              const livres = 31 & ~melhor;
              let sub = livres;
              for (;;) {
                const A = melhor | sub;
                const v = quad[POP[A]][ii[A]] + extraQ * royal[A];
                s += (POP[sub] & 1) ? -v : v;
                if (sub === 0) break;
                sub = (sub - 1) & livres;
              }
              soma2 += s / SORTEIOS[POP[melhor]];
            }
          }
        }
      }
    }
  }
  const rtp = soma / n;
  const variancia = quad ? soma2 / n - rtp * rtp : null;
  return { rtp, variancia, maos: n, moedas, ms: (typeof performance !== 'undefined' ? performance.now() : Date.now()) - t0 };
}

// Força bruta honesta: enumera os C(47, 5-k) sorteios de verdade. Serve para a
// prova conferir o resolvedor rápido, não para jogar.
export function evPorForcaBruta(mao5, mascara, moedas = MAX_MOEDAS) {
  const dadas = new Set(mao5);
  const resto = [];
  for (let c = 0; c < 52; c++) if (!dadas.has(c)) resto.push(c);
  const mantidas = [];
  for (let i = 0; i < 5; i++) if (mascara & (1 << i)) mantidas.push(mao5[i]);
  const faltam = 5 - mantidas.length;
  const mao = mantidas.slice();
  let soma = 0, n = 0;
  const combinar = (inicio, k) => {
    if (k === 0) {
      let m1 = 0, m2 = 0, m3 = 0, m4 = 0;
      const naipe = NAIPE[mao[0]];
      let flush = true;
      for (let i = 0; i < 5; i++) {
        const b = RANK_BIT[mao[i]];
        m4 |= m3 & b; m3 |= m2 & b; m2 |= m1 & b; m1 |= b;
        if (NAIPE[mao[i]] !== naipe) flush = false;
      }
      const cat = categoriaDeMascaras(m1, m2, m3, m4, flush);
      soma += moedas === MAX_MOEDAS ? TABELA[cat].cincoMoedas : TABELA[cat].porMoeda;
      n++;
      return;
    }
    for (let i = inicio; i <= resto.length - k; i++) { mao.push(resto[i]); combinar(i + 1, k - 1); mao.pop(); }
  };
  combinar(0, faltam);
  return soma / n;
}
