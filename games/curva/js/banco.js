// O banco de medidas. Tudo que o README afirma sobre o carro sai daqui, medido
// no mesmo modelo que o jogador dirige — nao de uma tabela escrita a mao.
//
// E o banco tambem e o que transforma "a IA vai bem" em numero: uma volta
// lancada por pista, com a fracao de tempo que ela passou no asfalto.

import { CARRO, criarCarro, passoCarro, comandosNulos, DT } from './fisica.js';
import { PISTAS, carregar, superficie } from './pista.js';
import { linhaIdeal } from './linha.js';
import { criarCorrida, passoCorrida } from './corrida.js';

function reta(carro, comandos, ctx, segundos, aoPasso = null) {
  const passos = Math.round(segundos / DT);
  for (let i = 0; i < passos; i++) {
    passoCarro(carro, comandos, ctx, DT);
    if (aoPasso && aoPasso(carro, i) === false) return i * DT;
  }
  return segundos;
}

// Skidpad: procura o maior g lateral que o carro SEGURA em regime, e nao o pico
// de um rodopio. Duas versoes anteriores erraram aqui: medir "volante todo a 38
// m/s" dava 0,08 g, porque o carro girava e a velocidade longitudinal virava
// lateral; medir o pico de cada angulo dava 1,51 g em qualquer superficie e com
// qualquer pneu, porque o pico e sempre o transiente da entrada. O que vale e a
// media do ultimo quarto de cada tentativa estavel.
function medirLateral(atrito, desgaste = 0) {
  let maior = 0;
  for (let volante = 0.15; volante <= 1.0001; volante += 0.05) {
    const carro = criarCarro(0, 0, 0);
    carro.pneus.desgaste = desgaste;
    carro.pneus.temp = 1;
    carro.vx = 34;
    let estavel = true;
    let soma = 0;
    let amostras = 0;
    const passos = Math.round(6 / DT);
    for (let i = 0; i < passos; i++) {
      passoCarro(carro, { volante, acelerador: 0.4, freio: 0, freioMao: false },
        { atrito, vacuo: 0 }, DT);
      const deriva = Math.abs(Math.atan2(carro.vy, Math.max(4, Math.abs(carro.vx))));
      if (deriva > 0.3 || Math.abs(carro.vx) < 8) { estavel = false; break; }
      if (i > passos * 0.75) {
        soma += Math.abs(carro.vx * carro.omega) / 9.81;
        amostras++;
      }
    }
    if (estavel && amostras) maior = Math.max(maior, soma / amostras);
  }
  return maior;
}

export function medirCarro() {
  const cheio = { volante: 0, acelerador: 1, freio: 0, freioMao: false };

  const maxima = criarCarro(0, 0, 0);
  reta(maxima, cheio, { atrito: 1, vacuo: 0 }, 70);

  const vacuo = criarCarro(0, 0, 0);
  reta(vacuo, cheio, { atrito: 1, vacuo: 1 }, 70);

  const arrancada = criarCarro(0, 0, 0);
  let zeroCem = 0;
  reta(arrancada, cheio, { atrito: 1, vacuo: 0 }, 20, (c, i) => {
    if (c.vx >= 100 / 3.6) { zeroCem = i * DT; return false; }
    return true;
  });

  const freada = criarCarro(0, 0, 0);
  freada.vx = 200 / 3.6;
  freada.pneus.temp = 1;
  let distancia = 0;
  reta(freada, { volante: 0, acelerador: 0, freio: 1, freioMao: false },
    { atrito: 1, vacuo: 0 }, 12, (c) => {
      distancia += Math.abs(c.vx) * DT;
      return c.vx > 0.4;
    });

  // Desgaste: a mesma quantidade de tempo, andando reto e derrapando.
  const liso = criarCarro(0, 0, 0);
  liso.vx = 45;
  reta(liso, { volante: 0, acelerador: 0.5, freio: 0, freioMao: false }, { atrito: 1, vacuo: 0 }, 6);
  const derrapando = criarCarro(0, 0, 0);
  derrapando.vx = 45;
  reta(derrapando, { volante: 1, acelerador: 1, freio: 0, freioMao: true }, { atrito: 1, vacuo: 0 }, 6);

  return {
    velocidadeMaxima: maxima.vx,
    velocidadeVacuo: vacuo.vx,
    zeroCem,
    frenagem200: distancia,
    gMaximo: medirLateral(1),
    gZebra: medirLateral(0.82),
    gGrama: medirLateral(0.42),
    gPneuGasto: medirLateral(1, 1),
    desgasteLiso: liso.pneus.desgaste,
    desgasteDerrapando: derrapando.pneus.desgaste,
  };
}

// Uma volta lancada de IA na pista pedida. Roda uma corrida de duas voltas com
// um carro so: a primeira sai da largada parada, a segunda e a que vale.
export function voltaDeReferencia(indicePista, perfil = 'ouro', opcoes = {}) {
  const corrida = criarCorrida(indicePista, {
    voltas: 2, ia: 1, jogador: false, perfil, semente: opcoes.semente || 42,
  });
  const carro = corrida.carros[0];
  const linha = linhaIdeal(corrida.pista);
  const limite = Math.round((opcoes.limite || 400) / DT);
  let passos = 0;
  let noAsfalto = 0;
  while (passos < limite && corrida.estado !== 'terminada') {
    passoCorrida(corrida, comandosNulos(), DT);
    const sup = superficie(corrida.pista, carro.x, carro.y);
    if (sup.tipo === 'asfalto' || sup.tipo === 'zebra') noAsfalto++;
    passos++;
  }
  return {
    pista: corrida.pista.nome,
    completou: !!carro.melhorVolta,
    motivo: carro.melhorVolta ? 'ok' : `parou em ${carro.voltas} voltas`,
    tempo: carro.melhorVolta || Infinity,
    estimado: linha.tempoEstimado,
    fracaoNaPista: passos ? noAsfalto / passos : 0,
    voltas: carro.voltas,
  };
}

export function corridaCompleta(indicePista, opcoes = {}) {
  const corrida = criarCorrida(indicePista, { jogador: false, ...opcoes });
  const limite = Math.round((opcoes.limite || 900) / DT);
  let passos = 0;
  while (passos < limite && corrida.estado !== 'terminada') {
    passoCorrida(corrida, comandosNulos(), DT);
    passos++;
  }
  if (corrida.estado !== 'terminada') {
    // Sem bandeirada, classifica pelo que andou: o relatorio tem de dizer algo
    // util mesmo quando a corrida nao fecha.
    corrida.classificacao = corrida.ordem.map((carro, i) => ({
      posicao: i + 1, nome: carro.nome, tipo: carro.tipo, voltas: carro.voltas,
      progresso: carro.progresso, melhorVolta: carro.melhorVolta || 0,
      paradas: carro.paradas, toques: carro.toques,
    }));
  }
  return {
    terminou: corrida.estado === 'terminada',
    segundos: corrida.tempo,
    classificacao: corrida.classificacao,
    melhorVoltaDaCorrida: corrida.melhorVolta ? corrida.melhorVolta.tempo : 0,
    toques: corrida.toques,
    menorDistanciaEntreCarros: corrida.menorDistancia,
  };
}

export { PISTAS, carregar };
