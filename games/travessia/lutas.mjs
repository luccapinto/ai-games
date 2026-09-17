#!/usr/bin/env node
// As tres lutas que o balanceamento tem de responder. Rode com: node lutas.mjs
//
// Nao entram em provas.mjs de proposito: provas.mjs cobra o mundo e a travessia
// em trinta sementes, e isto aqui e a mesa de teste do combate. As tres lutas
// sao sempre a mesma: onca contra jogador de faca, colados, em chao aberto
// longe de vila. O que muda e o que o jogador faz.
//
//   colado             — bate e nao recua.          tem de vencer com folga
//   recuando andando   — so anda para tras.         tem de perder
//   correndo e voltando— corre, espera, volta.      tem de vencer

import { andavel } from './js/mundo.js';
import {
  criarJogo, passo, entradaNula, CONFIG, DT, ARMAS, BICHOS,
} from './js/jogo.js';

const DIRECOES = [
  [1, 0], [-1, 0], [0, 1], [0, -1],
  [0.7071, 0.7071], [-0.7071, 0.7071], [0.7071, -0.7071], [-0.7071, -0.7071],
];

// Chao limpo: andavel em volta, longe de qualquer vila (senao o bicho desiste
// na hora, que e regra nova) e com pelo menos oitenta celulas livres numa
// direcao, para caber a fuga.
function acharArena(mundo) {
  for (let y = 24; y < mundo.altura - 24; y += 2) {
    for (let x = 24; x < mundo.largura - 24; x += 2) {
      if (!livreEmVolta(mundo, x, y, 2)) continue;
      if (!mundo.vilas.every(v => Math.hypot(v.x - x, v.y - y) > 34)) continue;
      for (const [dx, dy] of DIRECOES) {
        let limpo = true;
        for (let t = 1; t <= 80 && limpo; t++) {
          limpo = livreEmVolta(mundo, Math.round(x + dx * t), Math.round(y + dy * t), 1);
        }
        if (limpo) return { x: x + 0.5, y: y + 0.5, dx, dy };
      }
    }
  }
  return null;
}

function livreEmVolta(mundo, x, y, raio) {
  for (let dy = -raio; dy <= raio; dy++) {
    for (let dx = -raio; dx <= raio; dx++) {
      if (!andavel(mundo, x + dx, y + dy)) return false;
    }
  }
  return true;
}

function montar(semente) {
  const jogo = criarJogo(semente, { hora: 6.5 });
  const arena = acharArena(jogo.mundo);
  if (!arena) throw new Error(`semente ${semente}: nao achei chao aberto para lutar`);
  const j = jogo.jogador;
  j.x = arena.x;
  j.y = arena.y;
  j.arma = 'faca';
  // colado: a onca nasce a um passo, atras do lado para onde o jogador foge
  const onca = jogo.soltarInimigo('onca', arena.x - arena.dx, arena.y - arena.dy);
  onca.irritado = true;
  return { jogo, onca, arena };
}

function resumo(nome, jogo, onca, segundos) {
  const j = jogo.jogador;
  return {
    nome,
    venceu: onca.vida <= 0 && j.vida > 0,
    morreu: j.vida <= 0,
    vida: Math.max(0, j.vida),
    vidaPorCento: Math.max(0, j.vida) / CONFIG.vidaMaxima * 100,
    vidaDaOnca: Math.max(0, onca.vida),
    sede: Math.max(0, j.sede),
    segundos,
  };
}

// 1. colado: bate sem recuar
function colado(semente) {
  const { jogo, onca } = montar(semente);
  let t = 0;
  while (t < 90 && jogo.jogador.vida > 0 && onca.vida > 0) {
    passo(jogo, { ...entradaNula(), atacar: true }, DT);
    t += DT;
  }
  return resumo('colado, batendo', jogo, onca, t);
}

// 2. recuando andando: o instinto errado. So anda para tras, nao bate.
function recuandoAndando(semente) {
  const { jogo, onca, arena } = montar(semente);
  let t = 0;
  while (t < 120 && jogo.jogador.vida > 0 && onca.vida > 0) {
    passo(jogo, { ...entradaNula(), x: arena.dx, y: arena.dy }, DT);
    t += DT;
  }
  return resumo('recuando andando', jogo, onca, t);
}

// 3. correndo e voltando: corre ate a onca desistir, respira, volta e briga.
function correndoEVoltando(semente) {
  const { jogo, onca, arena } = montar(semente);
  const j = jogo.jogador;
  let t = 0;
  let fase = 'fuga';
  let descanso = 0;

  while (t < 240 && j.vida > 0 && onca.vida > 0) {
    const e = entradaNula();
    const dx = onca.x - j.x;
    const dy = onca.y - j.y;
    const d = Math.hypot(dx, dy) || 1;

    if (fase === 'fuga') {
      e.x = arena.dx;
      e.y = arena.dy;
      e.correr = true;
      if (!onca.irritado) fase = 'respira';
    } else if (fase === 'respira') {
      descanso += DT;
      // para de andar, deixa a vida voltar (0,9/s enquanto o cantil passa de 45%)
      if (j.vida >= CONFIG.vidaMaxima * 0.95 || descanso > 60) fase = 'volta';
    } else {
      if (d > ARMAS.faca.alcance) {
        e.x = dx / d;
        e.y = dy / d;
      }
      e.atacar = true;
    }
    passo(jogo, e, DT);
    t += DT;
  }
  return resumo('correndo e voltando', jogo, onca, t);
}

// --------------------------------------------------------------- saida

const semente = Number(process.argv[2] || 1000);
const faca = ARMAS.faca;
const onca = BICHOS.onca;

console.log(`\nfaca      ${faca.dano} de dano a cada ${faca.cadencia}s = `
  + `${(faca.dano / faca.cadencia).toFixed(1)} por segundo, `
  + `${(onca.vida / (faca.dano / faca.cadencia)).toFixed(1)}s para derrubar a onca`);
console.log(`onca      ${onca.dano} de dano a cada ${onca.cadencia}s = `
  + `${(onca.dano / onca.cadencia).toFixed(1)} por segundo, `
  + `${(CONFIG.vidaMaxima / (onca.dano / onca.cadencia)).toFixed(1)}s para derrubar o jogador`);
console.log(`velocidade  andando ${CONFIG.velocidade}  correndo ${CONFIG.velocidadeCorrendo}  `
  + `onca ${onca.velocidade}   (correr e a unica fuga)`);
console.log(`carencia    ${CONFIG.invulneravel}s depois de apanhar   `
  + `desistencia ${CONFIG.desistencia} passos   abrigo ${CONFIG.raioDeVila} de vila\n`);

const esperado = {
  'colado, batendo': r => r.venceu && r.vidaPorCento >= 30,
  'recuando andando': r => r.morreu,
  'correndo e voltando': r => r.venceu,
};

let falhou = 0;
console.log(`semente ${semente}`);
console.log('luta                   fim         vida    onca    cantil   tempo');
for (const luta of [colado(semente), recuandoAndando(semente), correndoEVoltando(semente)]) {
  const passou = esperado[luta.nome](luta);
  if (!passou) falhou++;
  const fim = luta.venceu ? 'VENCEU' : luta.morreu ? 'MORREU' : 'empatou';
  console.log(
    `${luta.nome.padEnd(23)}${fim.padEnd(12)}`
    + `${`${luta.vidaPorCento.toFixed(0)}%`.padStart(5)}`
    + `${luta.vidaDaOnca.toFixed(0).padStart(8)}`
    + `${luta.sede.toFixed(0).padStart(10)}`
    + `${`${luta.segundos.toFixed(1)}s`.padStart(8)}`
    + `   ${passou ? 'ok' : 'FORA DO ESPERADO'}`);
}
console.log('');
if (falhou) process.exit(1);
