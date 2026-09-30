#!/usr/bin/env node
// Simulador de blackjack: mede a vantagem da casa da mesa declarada em
// js/jogos/blackjack/regras.js jogando estratégia básica de verdade, com o
// sapato de 6 baralhos, carta de corte, divisão até 4 mãos, DAS, ás dividido
// com uma carta só, desistência tardia e peek. Sem seguro: a estratégia básica
// nunca aceita.
//
// O resultado é medido, nunca ajustado. Se a vantagem sair diferente do que
// dizem as tabelas de referência, o erro está numa regra aqui, não no número.
//
// Uso:
//   node ferramentas/simular_blackjack.mjs                 (padrão, 1 núcleo)
//   node ferramentas/simular_blackjack.mjs --maos 2e9 --trabalhadores 4 --gravar
//
// Com --gravar, escreve js/jogos/blackjack/vantagem.js.

import { Worker, isMainThread, parentPort, workerData } from 'node:worker_threads';
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { availableParallelism } from 'node:os';
import { geradorRapido } from '../provas/base.mjs';
import { REGRAS, TOTAL_SAPATO } from '../js/jogos/blackjack/regras.js';
import { DURO, MACIO, PARES } from '../js/jogos/blackjack/estrategia.js';

// Códigos inteiros das ações, para o laço quente não mexer com string.
const A_COMPRAR = 0, A_PARAR = 1, A_DOBRAR = 2, A_DOBRAR_OU_PARAR = 3, A_DIVIDIR = 4, A_DESISTIR = 5;
const CODIGO = { C: A_COMPRAR, P: A_PARAR, D: A_DOBRAR, Ds: A_DOBRAR_OU_PARAR, V: A_DIVIDIR, R: A_DESISTIR };

// As tabelas da estratégia viram Int8Array. São as MESMAS tabelas de
// estrategia.js: o simulador não tem estratégia própria.
function tabela(fonte, minimo, maximo) {
  const t = new Int8Array((maximo + 1) * 10).fill(A_PARAR);
  for (let total = minimo; total <= maximo; total++) {
    const linha = fonte[total];
    if (!linha) continue;
    for (let c = 0; c < 10; c++) t[total * 10 + c] = CODIGO[linha[c]];
  }
  return t;
}
const T_DURO = tabela(DURO, 4, 21);
const T_MACIO = tabela(MACIO, 12, 21);
const T_PARES = tabela(PARES, 2, 11);

const MAX_MAOS = REGRAS.maxMaos;

// Estado das mãos do jogador, reaproveitado entre rodadas.
const hTotal = new Int32Array(MAX_MAOS);
const hMacio = new Uint8Array(MAX_MAOS);
const hCartas = new Int32Array(MAX_MAOS);
const hA = new Int32Array(MAX_MAOS);
const hB = new Int32Array(MAX_MAOS);
const hAposta = new Float64Array(MAX_MAOS);
const hPronta = new Uint8Array(MAX_MAOS);
const hDesistiu = new Uint8Array(MAX_MAOS);
const hDeAses = new Uint8Array(MAX_MAOS);

export function simularBlackjack({ maos = 1_000_000, semente = 1 } = {}) {
  const g = geradorRapido(semente);
  const base = new Int8Array(TOTAL_SAPATO);
  {
    let k = 0;
    for (let d = 0; d < REGRAS.baralhos; d++) {
      for (let n = 0; n < 4; n++) {
        for (let r = 1; r <= 13; r++) base[k++] = r > 10 ? 10 : r;
      }
    }
  }
  const sapato = new Int8Array(TOTAL_SAPATO);
  let pos = TOTAL_SAPATO;
  let embaralhadas = 0;

  function embaralhar() {
    sapato.set(base);
    for (let i = TOTAL_SAPATO - 1; i > 0; i--) {
      const j = g.inteiro(i + 1);
      const t = sapato[i]; sapato[i] = sapato[j]; sapato[j] = t;
    }
    pos = 0;
    embaralhadas++;
  }

  function tirar() {
    if (pos >= TOTAL_SAPATO) embaralhar();
    return sapato[pos++];
  }

  function somar(i, v) {
    const n = hCartas[i];
    if (n === 0) hA[i] = v; else if (n === 1) hB[i] = v;
    hCartas[i] = n + 1;
    const add = (v === 1 && hTotal[i] + 11 <= 21) ? 11 : v;
    let t = hTotal[i] + add;
    let m = hMacio[i] || add === 11;
    if (t > 21 && m) { t -= 10; m = 0; }
    hTotal[i] = t;
    hMacio[i] = m ? 1 : 0;
  }

  function limpar(i, aposta) {
    hTotal[i] = 0; hMacio[i] = 0; hCartas[i] = 0; hA[i] = 0; hB[i] = 0;
    hAposta[i] = aposta; hPronta[i] = 0; hDesistiu[i] = 0; hDeAses[i] = 0;
  }

  let soma = 0;
  let soma2 = 0;

  for (let rodada = 0; rodada < maos; rodada++) {
    if (pos >= REGRAS.corte) embaralhar();
    const p1 = tirar(), du = tirar(), p2 = tirar(), dh = tirar();
    const col = du === 1 ? 9 : du - 2;
    const jogadorBJ = (p1 + p2 === 11) && (p1 === 1 || p2 === 1);
    const bancaBJ = (du === 1 && dh === 10) || (du === 10 && dh === 1);

    let resultado = 0;
    if ((du === 1 || du === 10) && bancaBJ) {
      resultado = jogadorBJ ? 0 : -1;
    } else if (jogadorBJ) {
      resultado = REGRAS.pagaBlackjack;
    } else {
      limpar(0, 1);
      somar(0, p1); somar(0, p2);
      let nMaos = 1;
      let dividiu = 0;
      let i = 0;
      while (i < nMaos) {
        if (hPronta[i]) { i++; continue; }
        if (hCartas[i] === 1) {
          somar(i, tirar());
          if (hDeAses[i] || hTotal[i] === 21) { hPronta[i] = 1; i++; continue; }
        }
        const duas = hCartas[i] === 2;
        const par = duas && hA[i] === hB[i];
        const podeDividir = par && nMaos < MAX_MAOS && !hDeAses[i];
        const podeDobrar = duas && !hDeAses[i];
        const podeDesistir = !dividiu && duas && nMaos === 1;
        let acao = -1;
        if (podeDividir) {
          // A tabela de pares indexa o ás por 11, o valor de jogo dele.
          const c = T_PARES[(hA[i] === 1 ? 11 : hA[i]) * 10 + col];
          if (c === A_DIVIDIR) acao = A_DIVIDIR;
        }
        if (acao < 0) {
          const t = hTotal[i];
          acao = hMacio[i] ? T_MACIO[t * 10 + col] : T_DURO[(t < 4 ? 4 : t) * 10 + col];
          if (acao === A_DOBRAR && !podeDobrar) acao = A_COMPRAR;
          else if (acao === A_DOBRAR_OU_PARAR) acao = podeDobrar ? A_DOBRAR : A_PARAR;
          else if (acao === A_DESISTIR) acao = podeDesistir ? A_DESISTIR : A_COMPRAR;
        }
        if (acao === A_DIVIDIR) {
          const v = hA[i];
          const j = nMaos++;
          limpar(j, hAposta[i]);
          limpar(i, hAposta[i]);
          if (v === 1) { hDeAses[i] = 1; hDeAses[j] = 1; }
          somar(i, v);
          somar(j, v);
          dividiu = 1;
          continue;
        }
        if (acao === A_COMPRAR) {
          somar(i, tirar());
          if (hTotal[i] > 21) { hPronta[i] = 1; i++; }
          continue;
        }
        if (acao === A_DOBRAR) {
          hAposta[i] *= 2;
          somar(i, tirar());
          hPronta[i] = 1; i++;
          continue;
        }
        if (acao === A_DESISTIR) {
          hDesistiu[i] = 1; hPronta[i] = 1; i++;
          continue;
        }
        hPronta[i] = 1; i++;
      }

      let vivas = false;
      for (let q = 0; q < nMaos; q++) if (!hDesistiu[q] && hTotal[q] <= 21) vivas = true;

      let dt = 0, dm = 0;
      const somarBanca = v => {
        const add = (v === 1 && dt + 11 <= 21) ? 11 : v;
        dt += add;
        if (add === 11) dm = 1;
        if (dt > 21 && dm) { dt -= 10; dm = 0; }
      };
      somarBanca(du); somarBanca(dh);
      if (vivas) {
        while (dt < 17 || (dt === 17 && dm && !REGRAS.s17)) somarBanca(tirar());
      }

      for (let q = 0; q < nMaos; q++) {
        const a = hAposta[q];
        if (hDesistiu[q]) { resultado -= a / 2; continue; }
        const t = hTotal[q];
        if (t > 21) { resultado -= a; continue; }
        if (dt > 21 || t > dt) resultado += a;
        else if (t < dt) resultado -= a;
      }
    }
    soma += resultado;
    soma2 += resultado * resultado;
  }

  return { maos, soma, soma2, embaralhadas, semente };
}

// Junta blocos vindos de núcleos diferentes.
export function consolidar(blocos) {
  let maos = 0, soma = 0, soma2 = 0, embaralhadas = 0;
  for (const b of blocos) { maos += b.maos; soma += b.soma; soma2 += b.soma2; embaralhadas += b.embaralhadas; }
  const media = soma / maos;
  const variancia = soma2 / maos - media * media;
  const erroPadrao = Math.sqrt(variancia / maos);
  return { maos, vantagem: -media, erroPadrao, variancia, embaralhadas };
}

const ESTE = fileURLToPath(import.meta.url);

if (!isMainThread && workerData && workerData.simular) {
  parentPort.postMessage(simularBlackjack(workerData.simular));
}

function argumento(nome, padrao) {
  const i = process.argv.indexOf(`--${nome}`);
  if (i < 0 || i + 1 >= process.argv.length) return padrao;
  return Number(process.argv[i + 1]);
}

function gravarVantagem(r, destino) {
  const texto = `// GERADO por ferramentas/simular_blackjack.mjs. Não edite à mão.
//
// A vantagem da casa desta mesa saiu de ${r.maos.toLocaleString('pt-BR')} mãos de estratégia
// básica com o sapato, a carta de corte e todas as regras de regras.js.
// A prova provas/blackjack.mjs roda uma simulação independente e confere que
// o número dela cai a menos de 4 erros padrão deste.

export const VANTAGEM_BLACKJACK = {
  vantagem: ${r.vantagem},
  erroPadrao: ${r.erroPadrao},
  variancia: ${r.variancia},
  maos: ${r.maos},
  semente: ${JSON.stringify(r.semente)},
  gerado: ${JSON.stringify(r.gerado)},
};

// O seguro é uma aposta à parte: custa metade da aposta e paga 2 para 1 se a
// carta furada da banca valer dez. Com 6 baralhos, tirada a carta aberta da
// banca, sobram 311 cartas e 96 delas valem dez, então a casa fica com
// 1 - 3 x 96/311 de tudo que entra no seguro. Não depende de simulação: é
// aritmética, e a função abaixo refaz a conta para qualquer número de baralhos.
export function vantagemSeguro(nBaralhos = ${REGRAS.baralhos}) {
  const restantes = 52 * nBaralhos - 1;
  const dezes = 16 * nBaralhos;
  return 1 - 3 * (dezes / restantes);
}

export function varianciaSeguro(nBaralhos = ${REGRAS.baralhos}) {
  const p = (16 * nBaralhos) / (52 * nBaralhos - 1);
  const media = 3 * p - 1;
  return (4 * p + (1 - p)) - media * media;
}

export const VANTAGEM_SEGURO = vantagemSeguro();
export const VARIANCIA_SEGURO = varianciaSeguro();
`;
  writeFileSync(destino, texto);
}

async function principal() {
  const maos = argumento('maos', 5_000_000);
  const trabalhadores = Math.max(1, Math.min(argumento('trabalhadores', 1), availableParallelism()));
  const semente = argumento('semente', 20260930);
  const gravar = process.argv.includes('--gravar');

  const t0 = performance.now();
  let blocos;
  if (trabalhadores === 1) {
    blocos = [simularBlackjack({ maos, semente })];
  } else {
    const porNucleo = Math.ceil(maos / trabalhadores);
    blocos = await Promise.all(Array.from({ length: trabalhadores }, (_, k) => new Promise((res, rej) => {
      const w = new Worker(ESTE, { workerData: { simular: { maos: porNucleo, semente: semente + k * 7919 } } });
      w.on('message', m => { res(m); w.terminate(); });
      w.on('error', rej);
    })));
  }
  const s = (performance.now() - t0) / 1000;
  const r = consolidar(blocos);
  r.semente = semente;
  r.gerado = new Date().toISOString();

  console.log(`maos          ${r.maos.toLocaleString('pt-BR')}`);
  console.log(`vantagem      ${(r.vantagem * 100).toFixed(4)} %`);
  console.log(`erro padrao   ${(r.erroPadrao * 100).toFixed(4)} %`);
  console.log(`variancia     ${r.variancia.toFixed(6)} por aposta inicial ao quadrado`);
  console.log(`embaralhadas  ${r.embaralhadas.toLocaleString('pt-BR')}`);
  console.log(`tempo         ${s.toFixed(1)} s  (${Math.round(r.maos / s).toLocaleString('pt-BR')} maos/s)`);

  if (gravar) {
    const destino = fileURLToPath(new URL('../js/jogos/blackjack/vantagem.js', import.meta.url));
    gravarVantagem(r, destino);
    console.log(`gravado       ${destino}`);
  }
}

if (isMainThread && process.argv[1] && process.argv[1].endsWith('simular_blackjack.mjs')) {
  await principal();
}
