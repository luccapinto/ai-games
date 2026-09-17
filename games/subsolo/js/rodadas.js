// A escada de dificuldade: quantos zumbis, com quanta vida, em que velocidade,
// nascendo a cada quanto tempo.
//
// Tudo aqui e funcao da rodada, e isso e de proposito: rodada e o unico relogio
// do jogo, e o jogador precisa poder aprender o que vem. Nada e sorteado — o que
// varia entre partidas e por onde eles entram, nao quantos sao.
//
// As tres curvas foram escolhidas contra medidas, nao contra gosto:
//
//   quantidade  cresce rapido no comeco e satura, porque a graca esta no fluxo
//               constante e nao numa parede de corpos que ninguem atravessa
//   vida        soma fixa ate a rodada 9 e vira juros compostos depois, que e o
//               que faz arma de parede virar insuficiente e a forja virar
//               necessaria em algum ponto
//   velocidade  degraus, e o degrau que importa e o da rodada 15: dali para
//               frente o zumbi anda mais rapido do que o jogador ANDANDO, e
//               correr deixa de ser opcional
//
// `provas.mjs` cobra que as tres sejam monotonas e que a rodada 25 seja
// matavel com a melhor arma forjada — senao o jogo tem um teto invisivel.

export const RODADA_DO_CHEFE = 7;
export const RODADA_DOS_RASTEJANTES = 5;

export function quantidadeDaRodada(rodada) {
  // Satura em 34: mais que isso, com 24 vivos ao mesmo tempo, so alonga a
  // rodada sem mudar o que o jogador faz.
  return Math.min(34, Math.round(5 + 2.4 * ((rodada - 1) ** 1.15)));
}

export function vidaDaRodada(rodada) {
  // Ate a nona, soma 100 por rodada: previsivel, da para contar tiro. Depois,
  // 11% por rodada: e a curva que obriga a trocar de arma e a forjar.
  if (rodada <= 9) return 150 + (rodada - 1) * 100;
  const base = 150 + 8 * 100;
  return Math.round(base * (1.11 ** (rodada - 9)));
}

export function velocidadeDaRodada(rodada) {
  if (rodada <= 3) return 1.25;
  if (rodada <= 6) return 1.8;
  if (rodada <= 9) return 2.4;
  if (rodada <= 14) return 3;
  if (rodada <= 19) return 3.6;
  return 4.1;
}

export function intervaloDeNascimento(rodada) {
  // De 3,4 s na primeira a 0,55 s na vigesima: e a diferenca entre "um zumbi
  // por vez" e "fila na janela".
  return Math.max(0.55, 3.4 * (0.87 ** (rodada - 1)));
}

// Composicao da rodada: quantos de cada tipo. A soma e sempre
// `quantidadeDaRodada`, e a prova cobra isso — rodada que nasce com menos do que
// promete nunca fecha, e o jogador fica esperando um zumbi que nao existe.
export function composicaoDaRodada(rodada) {
  const total = quantidadeDaRodada(rodada);
  const chefe = rodada % RODADA_DO_CHEFE === 0 ? 1 + Math.floor(rodada / 21) : 0;
  // Rodada de chefe vem com menos zumbi comum: o chefe sozinho ja e o cerco.
  const comuns = Math.max(4, total - chefe * 6);
  const rastejantes = rodada % RODADA_DOS_RASTEJANTES === 0
    ? Math.round(comuns * 0.35)
    : 0;
  return {
    total: comuns + chefe,
    comum: comuns - rastejantes,
    rastejante: rastejantes,
    chefe,
  };
}

// Vida e velocidade de cada tipo saem da rodada por multiplicador, e nao de uma
// tabela por tipo: assim uma rodada nova nunca tem um tipo que ficou para tras.
export const TIPOS = {
  comum: { vida: 1, velocidade: 1, dano: 1, cabeca: 1 },
  // Rastejante perdeu as pernas: pouca vida, vem rapido e rasteja baixo, entao
  // e dificil de acertar na cabeca.
  rastejante: { vida: 0.45, velocidade: 1.35, dano: 0.8, cabeca: 0.45 },
  // O capataz da mina: blindado, lento, e bate forte. Nao e um zumbi com mais
  // vida — a blindagem corta dano de corpo, entao arma de rajada nao resolve.
  chefe: { vida: 9, velocidade: 0.72, dano: 2.1, cabeca: 1.4, blindagem: 0.45 },
};

export function vidaDoTipo(tipo, rodada) {
  return Math.round(vidaDaRodada(rodada) * TIPOS[tipo].vida);
}

export function velocidadeDoTipo(tipo, rodada) {
  return velocidadeDaRodada(rodada) * TIPOS[tipo].velocidade;
}
