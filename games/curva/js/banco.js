// O banco de medidas. Tudo que o README afirma sobre o kart sai daqui, medido no
// mesmo modelo que o jogador dirige — nao de uma tabela escrita a mao.
//
// E o banco tambem e o que transforma "a IA vai bem" e "o drift compensa" em
// numero: uma volta lancada por pista, com a fracao de tempo no asfalto, e a
// mesma volta com o gatilho de drift desligado.

import {
  KART, criarCarro, passoCarro, comandosNulos, faixaDaCarga, DT,
} from './fisica.js';
import { PISTAS, carregar, superficie, maisProximo, paraMundo } from './pista.js';
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

// Skidpad: procura o maior g lateral que o kart SEGURA em regime, e nao o pico
// de um transiente. Tres versoes erraram aqui. Medir "volante todo" dava 0,08 g
// porque o kart rodopiava; medir o pico de cada angulo dava o mesmo numero em
// qualquer superficie, porque o pico e a entrada; e medir `vx * omega` dava
// 1,87 g num asfalto de 1,4 g, porque essa conta ignora o escorregamento.
//
// Esta versao varre angulo PEQUENO (a 22 m/s meia volta de volante ja pede 1,9
// g, e nenhum angulo da varredura antiga estava em regime), cobra deriva
// controlada e le a forca do pneu dividida pela massa.
function medirLateral(atrito, drift = false) {
  let maior = 0;
  for (let volante = 0.05; volante <= 1.0001; volante += 0.05) {
    const carro = criarCarro(0, 0, 0);
    carro.vx = 22;
    let estavel = true;
    let soma = 0;
    let amostras = 0;
    const passos = Math.round(5 / DT);
    const teto = (drift ? KART.derivaDoDrift : KART.derivaDeAderencia) * 1.3;
    for (let i = 0; i < passos; i++) {
      passoCarro(carro, { ...comandosNulos(), volante, acelerador: 0.45, drift },
        { atrito, vacuo: 0 }, DT);
      const deriva = Math.abs(Math.atan2(carro.vy, Math.max(3, Math.abs(carro.vx))));
      if (deriva > teto || Math.abs(carro.vx) < 8) {
        estavel = false;
        break;
      }
      if (i > passos * 0.6) {
        soma += Math.abs(carro.aceleracaoLateral) / 9.81;
        amostras++;
      }
    }
    if (estavel && amostras) maior = Math.max(maior, soma / amostras);
  }
  return maior;
}

export function medirCarro() {
  const cheio = { ...comandosNulos(), acelerador: 1 };

  const maxima = criarCarro(0, 0, 0);
  reta(maxima, cheio, { atrito: 1, vacuo: 0 }, 40);

  const vacuo = criarCarro(0, 0, 0);
  reta(vacuo, cheio, { atrito: 1, vacuo: 1 }, 40);

  const comTurbo = criarCarro(0, 0, 0);
  comTurbo.vx = maxima.vx;
  comTurbo.turbo = 999;
  reta(comTurbo, cheio, { atrito: 1, vacuo: 0 }, 6);

  const arrancada = criarCarro(0, 0, 0);
  let zeroCinquenta = 0;
  reta(arrancada, cheio, { atrito: 1, vacuo: 0 }, 15, (c, i) => {
    if (c.vx >= 50 / 3.6) { zeroCinquenta = i * DT; return false; }
    return true;
  });

  const freada = criarCarro(0, 0, 0);
  freada.vx = 80 / 3.6;
  let distancia = 0;
  reta(freada, { ...comandosNulos(), freio: 1 }, { atrito: 1, vacuo: 0 }, 8, (c) => {
    distancia += Math.abs(c.vx) * DT;
    return c.vx > 0.4;
  });

  // Rampa: a mesma aceleracao subindo 12% e descendo 12%.
  const subindo = criarCarro(0, 0, 0);
  reta(subindo, cheio, { atrito: 1, vacuo: 0, subida: 0.12 }, 12);
  const descendo = criarCarro(0, 0, 0);
  reta(descendo, cheio, { atrito: 1, vacuo: 0, subida: -0.12 }, 12);

  // Mini-turbo: quanto tempo de derrapagem cada faixa de carga custa, e quanto
  // de velocidade o empurrao devolve.
  const driftando = criarCarro(0, 0, 0);
  driftando.vx = 20;
  let tempoAteFaixa3 = 0;
  reta(driftando, { ...comandosNulos(), volante: 1, acelerador: 0.8, drift: true },
    { atrito: 1, vacuo: 0 }, 6, (c, i) => {
      if (faixaDaCarga(c.carga) >= 3) { tempoAteFaixa3 = i * DT; return false; }
      return true;
    });
  const cargaFinal = driftando.carga;
  // solta o gatilho: o turbo nasce aqui
  passoCarro(driftando, { ...comandosNulos(), acelerador: 1 }, { atrito: 1, vacuo: 0 }, DT);
  const turboGanho = driftando.turbo;

  return {
    velocidadeMaxima: maxima.vx,
    velocidadeVacuo: vacuo.vx,
    velocidadeComTurbo: comTurbo.vx,
    zeroCinquenta,
    frenagem80: distancia,
    gMaximo: medirLateral(1),
    gDeLado: medirLateral(1, true),
    gZebra: medirLateral(0.84),
    gGrama: medirLateral(0.46),
    velocidadeSubindo: subindo.vx,
    velocidadeDescendo: descendo.vx,
    tempoAteFaixa3,
    cargaFinal,
    turboGanho,
  };
}

// Uma volta lancada de IA na pista pedida. Roda uma corrida de duas voltas com
// um kart so: a primeira sai da largada parada, a segunda e a que vale.
export function voltaDeReferencia(indicePista, perfil = 'ouro', opcoes = {}) {
  const corrida = criarCorrida(indicePista, {
    voltas: 2, ia: 1, jogador: false, perfil, semente: opcoes.semente || 42,
    semDrift: !!opcoes.semDrift,
  });
  const carro = corrida.carros[0];
  if (opcoes.semDrift) {
    carro.piloto.perfil = { ...carro.piloto.perfil, drift: 0 };
  }
  const linha = linhaIdeal(corrida.pista, { semDrift: !!opcoes.semDrift });
  const limite = Math.round((opcoes.limite || 400) / DT);
  let passos = 0;
  let noAsfalto = 0;
  let turbos = 0;
  while (passos < limite && corrida.estado !== 'terminada') {
    for (const evento of passoCorrida(corrida, comandosNulos(), DT)) {
      if (evento.tipo === 'turbo') turbos++;
    }
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
    turbos,
  };
}

// A troca do grampo, medida sozinha. Volta inteira e medida ruidosa para decidir
// se derrapar paga: um incidente em qualquer outra curva move o tempo mais do
// que a tecnica move. Aqui o kart entra no grampo mais fechado da pista com a
// mesma velocidade e o mesmo controlador nas duas passagens, e o cronometro
// fecha 50 m depois da saida — o intervalo em que o mini-turbo ou paga, ou nao.
export function medirGrampo(indicePista, opcoes = {}) {
  const pista = carregar(PISTAS[indicePista]);
  const linha = linhaIdeal(pista);
  const n = pista.centro.length;

  let apice = 0;
  for (let i = 0; i < n; i++) {
    if (Math.abs(pista.centro[i].curvatura) > Math.abs(pista.centro[apice].curvatura)) apice = i;
  }
  const antes = Math.round((opcoes.entrada || 45) / pista.passo);
  const depois = Math.round((opcoes.saida || 50) / pista.passo);
  const largada = ((apice - antes) % n + n) % n;
  const chegada = (apice + depois) % n;

  const correr = (deixarDriftar) => {
    const corrida = criarCorrida(indicePista, {
      voltas: 2, ia: 1, jogador: false, perfil: 'ouro', semente: 7,
      semDrift: !deixarDriftar,
    });
    const carro = corrida.carros[0];
    if (!deixarDriftar) carro.piloto.perfil = { ...carro.piloto.perfil, drift: 0 };

    // Cada modo entra na SUA linha, na velocidade que aquela linha pede ali:
    // comparar a tecnica usando a linha do outro modo mede a linha, nao a
    // tecnica.
    const suaLinha = linhaIdeal(pista, { semDrift: !deixarDriftar });
    const posto = paraMundo(pista, largada, suaLinha.deslocamentos[largada]);
    corrida.estado = 'correndo';
    corrida.contagem = 0;
    carro.x = posto.x;
    carro.y = posto.y;
    carro.ang = posto.ang;
    carro.vx = suaLinha.velocidades[largada];
    carro.vy = 0;
    carro.omega = 0;
    carro.turbo = 0;
    carro.carga = 0;

    let tempo = 0;
    let faixaMaxima = 0;
    let passouApice = false;
    for (let passo = 0; passo < Math.round(30 / DT); passo++) {
      passoCorrida(corrida, comandosNulos(), DT);
      tempo += DT;
      faixaMaxima = Math.max(faixaMaxima, carro.faixaDeCarga);
      const i = maisProximo(pista, carro.x, carro.y).i;
      const distanciaAoApice = Math.min(Math.abs(i - apice), n - Math.abs(i - apice));
      if (distanciaAoApice < 4) passouApice = true;
      const distanciaAChegada = Math.min(Math.abs(i - chegada), n - Math.abs(i - chegada));
      if (passouApice && distanciaAChegada < 3) {
        return { tempo, faixaMaxima, velocidadeFinal: carro.vx, chegou: true };
      }
    }
    return { tempo, faixaMaxima, velocidadeFinal: carro.vx, chegou: false };
  };

  const com = correr(true);
  const sem = correr(false);
  return {
    pista: pista.nome,
    raio: 1 / Math.abs(pista.centro[apice].curvatura),
    com,
    sem,
    ganho: sem.tempo - com.tempo,
  };
}

export function corridaCompleta(indicePista, opcoes = {}) {
  const corrida = criarCorrida(indicePista, { jogador: false, ...opcoes });
  const limite = Math.round((opcoes.limite || 900) / DT);
  let passos = 0;
  const itens = { pegos: 0, usados: 0, acertos: 0 };
  while (passos < limite && corrida.estado !== 'terminada') {
    for (const evento of passoCorrida(corrida, comandosNulos(), DT)) {
      if (evento.tipo === 'item-pego') itens.pegos++;
      if (evento.tipo === 'item-usado') itens.usados++;
      if (evento.tipo === 'acertou') itens.acertos++;
    }
    passos++;
  }
  if (corrida.estado !== 'terminada') {
    corrida.classificacao = corrida.ordem.map((carro, i) => ({
      posicao: i + 1, nome: carro.nome, tipo: carro.tipo, voltas: carro.voltas,
      progresso: carro.progresso, melhorVolta: carro.melhorVolta || 0,
      turbos: carro.turbosUsados, toques: carro.toques,
    }));
  }
  return {
    terminou: corrida.estado === 'terminada',
    segundos: corrida.tempo,
    classificacao: corrida.classificacao,
    melhorVoltaDaCorrida: corrida.melhorVolta ? corrida.melhorVolta.tempo : 0,
    toques: corrida.toques,
    menorDistanciaEntreCarros: corrida.menorDistancia,
    itens,
  };
}

export { PISTAS, carregar };
