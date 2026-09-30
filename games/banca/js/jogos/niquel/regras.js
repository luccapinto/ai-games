// MALECÓN 57: as regras do caça-níquel e a conta exata delas.
//
// Caça-níquel é o jogo em que o jogador tem menos como saber quanto a máquina
// devolve. Aqui o número não é declarado, é ENUMERADO: as cinco tiras estão em
// tiras.js, e o retorno sai de somar o prêmio de toda combinação possível,
// pesada pela frequência dos símbolos em cada tira.
//
// O argumento que torna a conta exata e rápida: numa linha fixa, o símbolo
// visível de cada rolo é o da parada sorteada somada à fila da linha, e a
// parada é uniforme na tira. Então o símbolo daquela posição tem exatamente a
// distribuição de frequência da tira, e os cinco rolos são independentes. O
// valor esperado de uma linha é o mesmo para as vinte e cinco, e se calcula
// enumerando combinações de símbolos com peso. provas/niquel.mjs confere isso
// com uma força bruta literal sobre TODAS as paradas.
//
// Os giros grátis entram como processo de ramificação: se um giro grátis vale
// v e dá em média t giros novos, N giros valem N*v/(1-t), com t < 1 provado.

import { criarGerador } from '../../nucleo/justo.js';
import { pct, chance as chanceTexto } from '../../nucleo/formato.js';
import {
  SIMBOLOS, IDS, INDICE, CURINGA, DISPERSO, ROLOS, FILAS,
  TIRAS, LINHAS, TABELA, TABELA_DISPERSO, GIROS_GRATIS, APOSTAS_LINHA,
} from './tiras.js';

export { SIMBOLOS, IDS, INDICE, CURINGA, DISPERSO, TIRAS, LINHAS, TABELA, TABELA_DISPERSO, GIROS_GRATIS, APOSTAS_LINHA, ROLOS, FILAS };

export const N_LINHAS = LINHAS.length;
export const N_SIMBOLOS = IDS.length;
const I_CURINGA = INDICE[CURINGA];
const I_DISPERSO = INDICE[DISPERSO];

export const REGRAS = {
  rolos: ROLOS,
  filas: FILAS,
  linhas: N_LINHAS,
  multiplicador: GIROS_GRATIS.multiplicador,
  minimoLinha: APOSTAS_LINHA[0],
  maximoLinha: APOSTAS_LINHA[APOSTAS_LINHA.length - 1],
};

export const REGRAS_TEXTO = [
  'Cinco rolos, três símbolos visíveis em cada um, vinte e cinco linhas fixas. A aposta é por linha e as vinte e cinco estão sempre valendo.',
  'As linhas pagam da esquerda para a direita a partir do primeiro rolo, com três, quatro ou cinco símbolos iguais seguidos.',
  'Cada linha paga só o seu maior prêmio, e as linhas somam entre si.',
  'A Casa é curinga: substitui qualquer símbolo menos a Lua de Havana, e paga o prêmio dela quando é ela que forma a linha.',
  'A Lua de Havana é o símbolo disperso: paga em qualquer posição das quinze, e o prêmio dela é múltiplo da aposta TOTAL, não da aposta de linha.',
  'Três, quatro ou cinco luas dão 8, 12 ou 20 giros grátis. Nos giros grátis todo prêmio, de linha e de lua, é multiplicado por 3.',
  'Os giros grátis não custam nada e são jogados com a mesma aposta do giro que os abriu. Luas novas durante os giros grátis somam mais giros.',
  'Cada giro, pago ou grátis, é uma rodada verificável: o compromisso sai antes, a semente é revelada depois e as cinco paradas podem ser recalculadas.',
  'As tiras não mudam com a aposta nem com o saldo: o retorno da máquina é o mesmo em qualquer ficha.',
];

// ------------------------------------------------------------------- janela

const TIRA_IDX = TIRAS.map(t => {
  const a = new Int8Array(t.length);
  for (let i = 0; i < t.length; i++) {
    const v = INDICE[t[i]];
    if (v === undefined) throw new Error(`símbolo desconhecido na tira: ${t[i]}`);
    a[i] = v;
  }
  return a;
});
export const COMPRIMENTOS = TIRAS.map(t => t.length);

// Contagem de cada símbolo em cada tira: é a distribuição de um símbolo visível.
export const CONTAGENS = TIRA_IDX.map(t => {
  const c = new Array(N_SIMBOLOS).fill(0);
  for (const v of t) c[v]++;
  return c;
});

export function simboloNa(rolo, parada, fila) {
  const t = TIRA_IDX[rolo];
  return IDS[t[(parada + fila) % t.length]];
}

// As quinze posições visíveis: janela[rolo][fila].
export function janela(paradas) {
  const j = [];
  for (let r = 0; r < ROLOS; r++) {
    const t = TIRA_IDX[r];
    const col = [];
    for (let f = 0; f < FILAS; f++) col.push(IDS[t[(paradas[r] + f) % t.length]]);
    j.push(col);
  }
  return j;
}

// ------------------------------------------------------------------ prêmios

// Prêmio de uma linha, em múltiplos da aposta de linha. Só o maior conta.
// `simbolos` são cinco índices.
function premioDaLinha(s0, s1, s2, s3, s4) {
  const s = [s0, s1, s2, s3, s4];
  let melhorPago = 0;
  let melhorSim = -1;
  let melhorQtd = 0;
  for (let X = 0; X < N_SIMBOLOS; X++) {
    if (X === I_DISPERSO) continue;
    let corrida = 0;
    for (let i = 0; i < ROLOS; i++) {
      const c = s[i];
      if (c === X || (X !== I_CURINGA && c === I_CURINGA)) corrida++;
      else break;
    }
    if (corrida < 3) continue;
    const pago = TABELA[IDS[X]][corrida - 3];
    if (pago > melhorPago) { melhorPago = pago; melhorSim = X; melhorQtd = corrida; }
  }
  return { pago: melhorPago, simbolo: melhorSim, quantidade: melhorQtd };
}

// O mesmo cálculo, recebendo os cinco símbolos pelo id: é o que a mesa de
// provas usa para montar uma linha à mão.
export function premioDeLinha(simbolos) {
  if (simbolos.length !== ROLOS) throw new Error(`a linha tem ${ROLOS} símbolos`);
  const i = simbolos.map(s => {
    const v = INDICE[s];
    if (v === undefined) throw new Error(`símbolo desconhecido: ${s}`);
    return v;
  });
  const r = premioDaLinha(i[0], i[1], i[2], i[3], i[4]);
  return { pago: r.pago, simbolo: r.simbolo < 0 ? null : IDS[r.simbolo], quantidade: r.quantidade };
}

// Tabela completa de 12^5: o prêmio de qualquer combinação de linha. É o mesmo
// avaliador de premioDaLinha, tabelado para os laços quentes.
let tabela5 = null;
let tabela5Simbolo = null;
export function tabelaDeLinha() {
  if (tabela5) return tabela5;
  tabela5 = new Int32Array(N_SIMBOLOS ** 5);
  tabela5Simbolo = new Int8Array(N_SIMBOLOS ** 5);
  for (let a = 0; a < N_SIMBOLOS; a++)
    for (let b = 0; b < N_SIMBOLOS; b++)
      for (let c = 0; c < N_SIMBOLOS; c++)
        for (let d = 0; d < N_SIMBOLOS; d++)
          for (let e = 0; e < N_SIMBOLOS; e++) {
            const r = premioDaLinha(a, b, c, d, e);
            const i = ((((a * 12 + b) * 12 + c) * 12 + d) * 12 + e);
            tabela5[i] = r.pago;
            tabela5Simbolo[i] = r.simbolo;
          }
  return tabela5;
}

// ----------------------------------------------------------------- avaliar

// Avalia um giro. `apostaLinha` em centavos (1 dá o resultado em unidades de
// aposta de linha) e `multiplicador` é o dos giros grátis.
//
// Prêmio de linha: múltiplo da aposta de linha. Prêmio da lua: múltiplo da
// aposta TOTAL, que são as 25 linhas.
export function avaliar(paradas, apostaLinha = 1, multiplicador = 1) {
  const j = janela(paradas);
  const idx = j.map(col => col.map(id => INDICE[id]));
  const linhas = [];
  let total = 0;

  for (let l = 0; l < N_LINHAS; l++) {
    const f = LINHAS[l];
    const r = premioDaLinha(idx[0][f[0]], idx[1][f[1]], idx[2][f[2]], idx[3][f[3]], idx[4][f[4]]);
    if (r.pago > 0) {
      const pago = r.pago * apostaLinha * multiplicador;
      linhas.push({ linha: l, simbolo: IDS[r.simbolo], quantidade: r.quantidade, pago });
      total += pago;
    }
  }

  const posicoes = [];
  for (let r = 0; r < ROLOS; r++) for (let f = 0; f < FILAS; f++) if (idx[r][f] === I_DISPERSO) posicoes.push([r, f]);
  const quantidade = posicoes.length;
  const multiploDisperso = TABELA_DISPERSO[quantidade] ?? 0;
  const pagoDisperso = multiploDisperso * N_LINHAS * apostaLinha * multiplicador;
  total += pagoDisperso;

  return {
    paradas: paradas.slice(),
    janela: j,
    linhas,
    disperso: { quantidade, pago: pagoDisperso, posicoes },
    scatter: { quantidade, pago: pagoDisperso, posicoes },
    giros: GIROS_GRATIS[quantidade] ?? 0,
    total,
  };
}

// As cinco paradas saem do gerador verificável, e só dele.
export function derivar(gerador) {
  const p = [];
  for (let r = 0; r < ROLOS; r++) p.push(gerador.inteiro(COMPRIMENTOS[r]));
  return p;
}

// ------------------------------------------------------------ conta exata

// Valor esperado de UMA linha, em múltiplos da aposta de linha, com a chance de
// ela pagar e a contribuição de cada combinação.
//
// O laço percorre os três primeiros rolos e só desce quando ainda existe algum
// candidato com corrida de três: sem isso seriam 248.832 combinações, com isso
// são algumas milhares.
function contaDaLinha() {
  let totalPeso = 1;
  for (const l of COMPRIMENTOS) totalPeso *= l;
  const combinacoes = new Map();
  let esperado = 0;
  let acertos = 0;

  for (let a = 0; a < N_SIMBOLOS; a++) {
    const wa = CONTAGENS[0][a];
    if (!wa) continue;
    for (let b = 0; b < N_SIMBOLOS; b++) {
      const wb = CONTAGENS[1][b];
      if (!wb) continue;
      for (let c = 0; c < N_SIMBOLOS; c++) {
        const wc = CONTAGENS[2][c];
        if (!wc) continue;
        const candidatos = [];
        for (let X = 0; X < N_SIMBOLOS; X++) {
          if (X === I_DISPERSO) continue;
          const casa = I_CURINGA;
          if ((a === X || (X !== casa && a === casa))
            && (b === X || (X !== casa && b === casa))
            && (c === X || (X !== casa && c === casa))) candidatos.push(X);
        }
        if (!candidatos.length) continue;
        const w3 = wa * wb * wc;
        for (let d = 0; d < N_SIMBOLOS; d++) {
          const wd = CONTAGENS[3][d];
          if (!wd) continue;
          for (let e = 0; e < N_SIMBOLOS; e++) {
            const we = CONTAGENS[4][e];
            if (!we) continue;
            const r = premioDaLinha(a, b, c, d, e);
            if (!r.pago) continue;
            const peso = w3 * wd * we;
            const p = peso / totalPeso;
            esperado += p * r.pago;
            acertos += p;
            const chave = `${IDS[r.simbolo]}:${r.quantidade}`;
            const atual = combinacoes.get(chave) ?? { simbolo: IDS[r.simbolo], quantidade: r.quantidade, p: 0, pago: r.pago, contribuicao: 0 };
            atual.p += p;
            atual.contribuicao += p * r.pago;
            combinacoes.set(chave, atual);
          }
        }
      }
    }
  }
  return { esperado, chance: acertos, combinacoes: [...combinacoes.values()].sort((x, y) => y.contribuicao - x.contribuicao) };
}

// Distribuição do número de luas na janela.
//
// As luas estão a pelo menos três paradas umas das outras em toda tira, então
// uma janela de três paradas nunca mostra duas do mesmo rolo: a lua de cada
// rolo é um sim-ou-não independente, com probabilidade 3*k/L.
function contaDoDisperso() {
  const p = TIRA_IDX.map((t, r) => {
    let k = 0;
    for (const v of t) if (v === I_DISPERSO) k++;
    return 3 * k / COMPRIMENTOS[r];
  });
  let dist = [1];
  for (const pi of p) {
    const nova = new Array(dist.length + 1).fill(0);
    for (let k = 0; k < dist.length; k++) {
      nova[k] += dist[k] * (1 - pi);
      nova[k + 1] += dist[k] * pi;
    }
    dist = nova;
  }
  let esperado = 0;
  let giros = 0;
  let chance = 0;
  for (let k = 3; k <= ROLOS; k++) {
    esperado += dist[k] * (TABELA_DISPERSO[k] ?? 0);
    giros += dist[k] * (GIROS_GRATIS[k] ?? 0);
    chance += dist[k];
  }
  return { p, dist, esperado, giros, chance };
}

let cacheRtp = null;

// O retorno exato da máquina, em fração da aposta total.
export function rtpExato() {
  if (cacheRtp) return cacheRtp;
  const t0 = Date.now();
  const linha = contaDaLinha();
  const disperso = contaDoDisperso();
  const m = GIROS_GRATIS.multiplicador;

  // Em unidades de APOSTA TOTAL: as 25 linhas valem 25 x esperado da linha, e a
  // aposta total é 25 x aposta de linha, então o retorno das linhas é o próprio
  // valor esperado de uma linha.
  const base = linha.esperado + disperso.esperado;
  const t = disperso.giros;          // giros novos esperados por giro grátis
  const v = m * base;                // valor de um giro grátis, em aposta total
  if (!(t < 1)) throw new Error(`os giros grátis não convergem: t = ${t}`);
  const bonus = disperso.giros * v / (1 - t);

  cacheRtp = {
    rtp: base + bonus,
    linha: linha.esperado,
    disperso: disperso.esperado,
    base,
    bonus,
    v,
    t,
    multiplicador: m,
    fator: 1 + m * t / (1 - t),
    chanceLinha: linha.chance,
    chanceBonus: disperso.chance,
    distDisperso: disperso.dist,
    pDisperso: disperso.p,
    combinacoes: linha.combinacoes,
    ms: Date.now() - t0,
  };
  return cacheRtp;
}

export const RTP_EXATO = { get valor() { return rtpExato().rtp; } };
export function vantagemDaCasa() {
  return 1 - rtpExato().rtp;
}

// Variância do resultado de um giro pago, em (aposta total)^2, incluindo os
// giros grátis que ele abre. Não dá para enumerar: as vinte e cinco linhas
// compartilham os mesmos quinze símbolos, então o segundo momento precisa da
// distribuição conjunta da janela inteira. É MEDIDA, com semente fixa, e é o
// número que o Livro usa para dizer quantos desvios-padrão você está.
const GIROS_DA_MEDIDA = 100000;
const SEMENTE_DA_MEDIDA = 57;
let cacheVariancia = null;
export function varianciaPorGiro() {
  if (cacheVariancia === null) {
    const m = simular(GIROS_DA_MEDIDA, geradorSimples(SEMENTE_DA_MEDIDA));
    cacheVariancia = m.desvio * m.desvio;
  }
  return cacheVariancia;
}

// ------------------------------------------------------------ força bruta

// A prova literal: percorre TODAS as combinações de paradas dos cinco rolos e
// soma o prêmio da linha `l`, e de quebra levanta a distribuição das luas.
// São dezenas de milhões de combinações; roda em segundos com vetores tipados.
export function forcaBruta(l = 0) {
  const tab = tabelaDeLinha();
  const fila = LINHAS[l];
  const t0 = Date.now();

  // Símbolo visível na fila da linha, e se a janela daquele rolo tem lua.
  const col = [];
  const luas = [];
  for (let r = 0; r < ROLOS; r++) {
    const t = TIRA_IDX[r];
    const n = t.length;
    const c = new Int32Array(n);
    const s = new Int32Array(n);
    for (let i = 0; i < n; i++) {
      c[i] = t[(i + fila[r]) % n];
      s[i] = (t[i] === I_DISPERSO || t[(i + 1) % n] === I_DISPERSO || t[(i + 2) % n] === I_DISPERSO) ? 1 : 0;
    }
    col.push(c);
    luas.push(s);
  }

  let soma = 0;
  let acertos = 0;
  let total = 0;
  const contaLuas = new Float64Array(ROLOS + 1);
  const n0 = col[0].length, n1 = col[1].length, n2 = col[2].length, n3 = col[3].length, n4 = col[4].length;
  const c0 = col[0], c1 = col[1], c2 = col[2], c3 = col[3], c4 = col[4];
  const l0 = luas[0], l1 = luas[1], l2 = luas[2], l3 = luas[3], l4 = luas[4];

  for (let i0 = 0; i0 < n0; i0++) {
    const a0 = c0[i0] * 20736, s0 = l0[i0];
    for (let i1 = 0; i1 < n1; i1++) {
      const a1 = a0 + c1[i1] * 1728, s1 = s0 + l1[i1];
      for (let i2 = 0; i2 < n2; i2++) {
        const a2 = a1 + c2[i2] * 144, s2 = s1 + l2[i2];
        for (let i3 = 0; i3 < n3; i3++) {
          const a3 = a2 + c3[i3] * 12, s3 = s2 + l3[i3];
          for (let i4 = 0; i4 < n4; i4++) {
            const pago = tab[a3 + c4[i4]];
            soma += pago;
            if (pago) acertos++;
            contaLuas[s3 + l4[i4]]++;
            total++;
          }
        }
      }
    }
  }
  const dist = [];
  for (let k = 0; k <= ROLOS; k++) dist.push(contaLuas[k] / total);
  return { linha: l, combinacoes: total, esperado: soma / total, chance: acertos / total, distDisperso: dist, ms: Date.now() - t0 };
}

// --------------------------------------------------------------- simulação

// Simulador rápido: vetores tipados, deslocamentos de linha pré-calculados.
// `u32` é uma função que devolve um inteiro de 32 bits sem sinal; as provas
// passam o gerador rápido delas. Isto NÃO é o gerador verificável.
export function simular(n, u32) {
  const tab = tabelaDeLinha();
  const ext = TIRA_IDX.map(t => {
    const a = new Int32Array(t.length + 2);
    for (let i = 0; i < t.length; i++) a[i] = t[i];
    a[t.length] = t[0];
    a[t.length + 1] = t[1];
    return a;
  });
  const lens = COMPRIMENTOS;
  const desloc = new Int32Array(N_LINHAS * ROLOS);
  for (let l = 0; l < N_LINHAS; l++) for (let r = 0; r < ROLOS; r++) desloc[l * ROLOS + r] = r * FILAS + LINHAS[l][r];
  const pesos = [20736, 1728, 144, 12, 1];
  const disperso = new Float64Array(ROLOS + 1);
  for (let k = 0; k <= ROLOS; k++) disperso[k] = TABELA_DISPERSO[k] ?? 0;
  const girosPor = new Int32Array(ROLOS + 1);
  for (let k = 0; k <= ROLOS; k++) girosPor[k] = GIROS_GRATIS[k] ?? 0;
  const m = GIROS_GRATIS.multiplicador;

  const w = new Int32Array(ROLOS * FILAS);
  let ganhoLinhas = 0;
  let luas = 0;

  function girar() {
    luas = 0;
    for (let r = 0; r < ROLOS; r++) {
      const s = (u32() / 4294967296 * lens[r]) | 0;
      const e = ext[r];
      const a = e[s], b = e[s + 1], c = e[s + 2];
      const base = r * FILAS;
      w[base] = a; w[base + 1] = b; w[base + 2] = c;
      if (a === I_DISPERSO || b === I_DISPERSO || c === I_DISPERSO) luas++;
    }
    let soma = 0;
    for (let l = 0; l < N_LINHAS; l++) {
      const o = l * ROLOS;
      soma += tab[w[desloc[o]] * 20736 + w[desloc[o + 1]] * 1728 + w[desloc[o + 2]] * 144 + w[desloc[o + 3]] * 12 + w[desloc[o + 4]]];
    }
    ganhoLinhas = soma;
  }

  let soma = 0;
  let soma2 = 0;
  let acertos = 0;
  let bonus = 0;
  let girosGratis = 0;
  let maior = 0;
  const t0 = Date.now();
  for (let k = 0; k < n; k++) {
    girar();
    // Tudo em unidades de APOSTA TOTAL: as linhas somam em aposta de linha, e a
    // aposta total são 25 linhas.
    let ganho = ganhoLinhas / N_LINHAS + disperso[luas];
    let restantes = girosPor[luas];
    if (restantes) bonus++;
    while (restantes > 0) {
      restantes--;
      girosGratis++;
      girar();
      ganho += m * (ganhoLinhas / N_LINHAS + disperso[luas]);
      restantes += girosPor[luas];
    }
    soma += ganho;
    soma2 += ganho * ganho;
    if (ganho > 0) acertos++;
    if (ganho > maior) maior = ganho;
  }
  const media = soma / n;
  return {
    giros: n,
    rtp: media,
    desvio: Math.sqrt(soma2 / n - media * media),
    acerto: acertos / n,
    bonus: bonus / n,
    girosGratis,
    maior,
    ms: Date.now() - t0,
  };
}

// Gerador determinístico simples só para as estatísticas medidas. Não tem nada
// a ver com o gerador verificável das rodadas.
export function geradorSimples(semente = 57) {
  let a = 0x9e3779b9 ^ semente, b = 0x243f6a88, c = 0xb7e15162 ^ (semente * 7919), d = 1;
  function u32() {
    a >>>= 0; b >>>= 0; c >>>= 0; d >>>= 0;
    const t = (a + b | 0) + d | 0;
    d = d + 1 | 0;
    a = b ^ (b >>> 9);
    b = c + (c << 3) | 0;
    c = (c << 21) | (c >>> 11);
    c = c + t | 0;
    return t >>> 0;
  }
  for (let i = 0; i < 20; i++) u32();
  return u32;
}

let cacheEstat = null;

// O painel da máquina: o que é exato sai da enumeração, e a frequência de
// acerto e o desvio padrão por giro saem de uma medição com semente fixa.
export function estatisticas({ giros = 200000, semente = 57 } = {}) {
  if (cacheEstat && cacheEstat.medido.giros === giros && cacheEstat.semente === semente) return cacheEstat;
  const exato = rtpExato();
  const medido = simular(giros, geradorSimples(semente));
  const contribuicoes = exato.combinacoes.map(c => ({
    ...c,
    fracaoDoRetorno: c.contribuicao / exato.rtp,
  }));
  cacheEstat = {
    semente,
    rtp: exato.rtp,
    vantagem: 1 - exato.rtp,
    linha: exato.linha,
    disperso: exato.disperso,
    bonus: exato.bonus,
    fator: exato.fator,
    t: exato.t,
    v: exato.v,
    chanceBonus: exato.chanceBonus,
    distDisperso: exato.distDisperso,
    combinacoes: contribuicoes,
    medido,
  };
  return cacheEstat;
}

// --------------------------------------------------------------- vitrine

export function placa() {
  const e = rtpExato();
  return [
    { rotulo: 'Retorno', valor: pct(e.rtp, 2) },
    { rotulo: 'Banca', valor: pct(1 - e.rtp, 2) },
    { rotulo: 'Giros grátis', valor: chanceTexto(e.chanceBonus) },
  ];
}

export function textoDoGiro(av, gratis = false) {
  const partes = [];
  if (av.linhas.length) {
    const maior = av.linhas.reduce((a, b) => (b.pago > a.pago ? b : a));
    const nome = SIMBOLOS.find(s => s.id === maior.simbolo).nome;
    partes.push(`${maior.quantidade} ${nome}`);
    if (av.linhas.length > 1) partes.push(`${av.linhas.length} linhas`);
  }
  if (av.disperso.quantidade >= 3) partes.push(`${av.disperso.quantidade} luas`);
  if (av.giros) partes.push(`${av.giros} giros grátis`);
  if (!partes.length) return gratis ? 'giro grátis sem prêmio' : 'sem prêmio';
  return (gratis ? 'giro grátis: ' : '') + partes.join(', ');
}

// Painel Conferir: as cinco paradas saem das três entradas publicadas.
export function conferir(registro) {
  const g = criarGerador(registro.semente, registro.sementeJogador, registro.contador);
  const paradas = derivar(g);
  const esperadas = registro.resultado?.paradas;
  const confere = Array.isArray(esperadas) && esperadas.length === ROLOS && paradas.every((p, i) => p === esperadas[i]);
  return {
    confere,
    descricao: confere
      ? `o gerador dá as paradas ${paradas.join(', ')}, iguais às que a máquina registrou`
      : `o gerador dá as paradas ${paradas.join(', ')}; a máquina registrou ${Array.isArray(esperadas) ? esperadas.join(', ') : 'nada'}`,
  };
}
