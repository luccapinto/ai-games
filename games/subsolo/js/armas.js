// As armas da mina: o que elas fazem, quanto custam na parede e como a bala
// chega no zumbi.
//
// Nada aqui toca em DOM. `tracar` e o unico caminho pelo qual qualquer coisa
// fere qualquer coisa neste jogo — jogador, zumbi ou robo de prova usam a mesma
// funcao, e e por isso que "parede bloqueia tiro" vale para todos.
//
// Duas decisoes que valem ser ditas:
//
// 1. **Nenhuma arma e uma arma melhor.** Cada uma ganha em um eixo e perde em
//    outro: a espingarda mata tres de perto e nada de longe, a pineira sustenta
//    fluxo e nao vence blindagem, o macarico queima cerco e nao alcanca nada, a
//    carabina resolve cabeca a vinte metros e nao segura corredor. As provas
//    cobram essa tabela: se uma arma dominar em todos os eixos, a escolha morre.
//
// 2. **Cabeca paga.** O multiplicador de cabeca e alto (2,5x a 4x) porque e a
//    unica pericia mecanica que o jogo pede do jogador. Sem isso, a rodada 20 e
//    uma questao de quantos pontos voce tem, e nao de como voce atira.

import { CONFIG } from './regras.js';

export const MUNICAO = {
  pinos: 'PINOS',
  cartuchos: 'CARTUCHOS',
  gas: 'GAS',
  balas: 'BALAS',
};

export const ARMAS = {
  picareta: {
    nome: 'PICARETA',
    tipo: 'corpo',
    municao: null,
    dano: 220,
    cabeca: 1.6,
    // Corpo a corpo tem cadencia baixa e alcance curto, mas nao gasta nada: e a
    // arma das tres primeiras rodadas e o plano de emergencia de todas as
    // outras.
    cadencia: 1.25,
    alcance: 2.2,
    pente: Infinity,
    reserva: Infinity,
    custo: 0,
    recarga: 0,
    pelotas: 1,
    espalhamento: 0,
    penetracao: 0,
  },
  pistola: {
    nome: 'PISTOLA',
    tipo: 'tiro',
    municao: 'balas',
    dano: 115,
    cabeca: 3,
    cadencia: 4.2,
    alcance: 34,
    pente: 10,
    reserva: 120,
    custo: 0,
    recarga: 1.7,
    pelotas: 1,
    espalhamento: 0.006,
    penetracao: 0,
  },
  pineira: {
    nome: 'PINEIRA',
    tipo: 'tiro',
    municao: 'pinos',
    // Pino e projetil de pistola de pino: muito tiro, pouco dano por tiro, e
    // penetracao nenhuma. Sustenta corredor e nao vence blindagem.
    dano: 72,
    cabeca: 2.5,
    cadencia: 9.5,
    alcance: 26,
    pente: 32,
    reserva: 420,
    custo: 1300,
    recarga: 2.4,
    pelotas: 1,
    espalhamento: 0.022,
    penetracao: 0,
  },
  espingarda: {
    nome: 'ESPINGARDA',
    tipo: 'tiro',
    municao: 'cartuchos',
    // Oito pelotas de 62: 496 de dano a queima-roupa e quase nada a quinze
    // metros, porque o espalhamento faz a pelota passar ao lado.
    dano: 70,
    cabeca: 2.6,
    cadencia: 1.9,
    alcance: 13,
    pente: 6,
    reserva: 96,
    custo: 1500,
    recarga: 3.4,
    pelotas: 8,
    espalhamento: 0.085,
    // Pelota atravessa um zumbi e alcanca o de tras: e o que faz a espingarda
    // ser a arma de cerco.
    penetracao: 1,
  },
  macarico: {
    nome: 'MACARICO',
    tipo: 'tiro',
    municao: 'gas',
    // Dano por quadro, nao por tiro: cadencia altissima e alcance de cinco
    // metros. Limpa cerco e nao resolve nada longe.
    dano: 34,
    cabeca: 1.1,
    cadencia: 12,
    alcance: 5.2,
    pente: 90,
    reserva: 540,
    custo: 2200,
    recarga: 3.8,
    pelotas: 1,
    espalhamento: 0.16,
    // Quatro: a chama nao escolhe alvo. E o unico eixo em que ele ganha, e a
    // prova cobra que ele ganhe nele — com penetracao 3 e dano 26 a carabina
    // matava mais gente junta que o lanca-chamas, o que nao faz sentido nenhum.
    penetracao: 4,
  },
  carabina: {
    nome: 'CARABINA',
    tipo: 'tiro',
    municao: 'balas',
    // Cabeca a vinte metros, uma bala por vez. Contra corredor cheio, perde.
    dano: 320,
    cabeca: 4.2,
    cadencia: 2.2,
    alcance: 60,
    pente: 8,
    reserva: 120,
    custo: 2600,
    recarga: 2.9,
    pelotas: 1,
    espalhamento: 0.0015,
    // Um: bala de rifle sai pelas costas do primeiro e para no segundo. Com dois
    // ela virava arma de cerco, e cerco e da espingarda e do macarico.
    penetracao: 1,
  },
};

// A forja multiplica dano e pente e devolve uma arma com outro nome: o jogador
// precisa ver que a arma mudou, senao 5.000 pontos parecem sumir.
export function forjar(chave) {
  const base = ARMAS[chave];
  if (!base || base.tipo === 'corpo') return null;
  return {
    ...base,
    chave: `${chave}-forjada`,
    nome: `${base.nome} FORJADA`,
    dano: Math.round(base.dano * CONFIG.danoDaForja),
    pente: Math.round(base.pente * CONFIG.penteDaForja),
    reserva: Math.round(base.reserva * 1.5),
    forjada: true,
  };
}

// Estado de uma arma na mao: o que a planta vende e uma chave; o que o jogador
// carrega e isto.
export function equipar(chave) {
  const base = ARMAS[chave];
  if (!base) throw new Error(`arma desconhecida: ${chave}`);
  return {
    chave,
    ...base,
    noPente: base.pente,
    naReserva: base.reserva,
    recarregando: 0,
    esfriando: 0,
    forjada: false,
  };
}

export function equiparForjada(chave) {
  const forjada = forjar(chave);
  if (!forjada) return null;
  return {
    ...forjada,
    noPente: forjada.pente,
    naReserva: forjada.reserva,
    recarregando: 0,
    esfriando: 0,
  };
}

// Dano de uma unidade de projetil na distancia dada. Queda linear a partir de
// 60% do alcance, e zero depois do alcance: e essa queda que separa espingarda
// de carabina sem precisar de duas mecanicas diferentes.
export function danoNaDistancia(arma, distancia) {
  if (distancia > arma.alcance) return 0;
  const inicioDaQueda = arma.alcance * 0.6;
  if (distancia <= inicioDaQueda) return arma.dano;
  const sobra = 1 - (distancia - inicioDaQueda) / (arma.alcance - inicioDaQueda);
  return arma.dano * Math.max(0.25, sobra);
}

// Dano por segundo em regime, contando recarga. E a medida que a prova usa para
// cobrar que nenhuma arma domine todos os eixos.
export function danoPorSegundo(arma, distancia = 2) {
  const porTiro = danoNaDistancia(arma, distancia) * arma.pelotas;
  if (!Number.isFinite(arma.pente)) return porTiro * arma.cadencia;
  const tempoDoPente = arma.pente / arma.cadencia;
  return (porTiro * arma.pente) / (tempoDoPente + arma.recarga);
}

// Dano por segundo mirando na cabeca. E o eixo em que a carabina existe: no
// peito ela perde para a pineira, e comparar so o dano de corpo dizia que a
// pineira dominava tudo — o que fez a prova reprovar a tabela inteira, com
// razao.
export function danoPorSegundoNaCabeca(arma, distancia = 2) {
  return danoPorSegundo(arma, distancia) * arma.cabeca;
}

// Municao que a parede vende de volta, e o preco dela.
export function custoDaMunicao(arma) {
  return Math.round(arma.custo * CONFIG.fracaoDoCustoDaMunicao);
}

// ------------------------------------------------------- balistica

// Parede na linha, com precisao de sub-celula. `solidoEm(x, y)` vem do mapa —
// nao importamos `mapa.js` aqui para este arquivo continuar sendo so numero e
// geometria, e para a prova poder passar uma parede de mentira.
export function paredeNaLinha(solidoEm, de, para) {
  const dx = para.x - de.x;
  const dy = para.y - de.y;
  const distancia = Math.hypot(dx, dy);
  if (distancia < 1e-6) return false;
  const passos = Math.ceil(distancia / 0.12);
  for (let i = 1; i <= passos; i++) {
    const t = i / passos;
    if (solidoEm(de.x + dx * t, de.y + dy * t)) return true;
  }
  return false;
}

// Tracado de um projetil: devolve os alvos atingidos, em ordem de distancia,
// respeitando penetracao. `alvos` e uma lista de { x, y, raio, altura, ... }.
//
// A cabeca nao e um segundo corpo: e uma faixa de altura. Isso faz o rastejante
// ser dificil de acertar na cabeca sem nenhuma regra especial — ele e baixo.
export function tracar(solidoEm, origem, direcao, arma, alvos, aleatorio = Math.random) {
  const acertos = [];
  const espalhamento = arma.espalhamento;
  for (let pelota = 0; pelota < arma.pelotas; pelota++) {
    const desvio = espalhamento > 0 ? (aleatorio() - 0.5) * 2 * espalhamento : 0;
    const desvioVertical = espalhamento > 0 ? (aleatorio() - 0.5) * 2 * espalhamento : 0;
    const ang = Math.atan2(direcao.y, direcao.x) + desvio;
    const passo = { x: Math.cos(ang), y: Math.sin(ang) };
    const inclinacao = (direcao.z || 0) + desvioVertical;

    const candidatos = [];
    for (const alvo of alvos) {
      const dx = alvo.x - origem.x;
      const dy = alvo.y - origem.y;
      const aoLongo = dx * passo.x + dy * passo.y;
      if (aoLongo <= 0 || aoLongo > arma.alcance) continue;
      const lateral = Math.abs(dx * passo.y - dy * passo.x);
      if (lateral > alvo.raio) continue;
      const alturaNoAlvo = (origem.z ?? CONFIG.alturaDoOlho) + inclinacao * aoLongo;
      if (alturaNoAlvo < 0 || alturaNoAlvo > alvo.altura) continue;
      if (paredeNaLinha(solidoEm, origem, {
        x: origem.x + passo.x * aoLongo,
        y: origem.y + passo.y * aoLongo,
      })) continue;
      const naCabeca = alturaNoAlvo > alvo.altura * 0.78;
      candidatos.push({ alvo, distancia: aoLongo, naCabeca });
    }
    candidatos.sort((a, b) => a.distancia - b.distancia);
    const quantos = 1 + arma.penetracao;
    for (const c of candidatos.slice(0, quantos)) {
      const base = danoNaDistancia(arma, c.distancia);
      const dano = base * (c.naCabeca ? arma.cabeca : 1);
      acertos.push({ ...c, dano });
    }
  }
  return acertos;
}
