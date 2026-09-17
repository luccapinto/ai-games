// Todo numero que decide algo no jogo mora aqui.
//
// Esta separado de `jogo.js` por um motivo pratico: as provas precisam dos
// numeros para dizer se uma rodada fecha, se o jogador consegue pagar a porta
// que a rodada seguinte exige, e se a vida do zumbi da rodada 20 cabe no pente
// de alguma arma. Constante espalhada em tres arquivos desfaz esse ciclo.
//
// A escala do mundo: uma celula da planta tem 2,2 m e o teto tem 3 m. Nao e
// gosto — e o que faz um corredor de mina caber duas pessoas de ombro e uma
// galeria de tres celulas parecer galeria, e e a mesma escala que o render usa
// para nao mentir sobre distancia.

export const CELULA = 2.2;
export const ALTURA_DO_TETO = 3;

export const CONFIG = {
  // --- jogador ---------------------------------------------------------
  vidaMaxima: 100,
  // Vida volta sozinha depois de alguns segundos sem tomar dano. Sem
  // regeneracao, um arranhao na rodada 3 condena a rodada 12; com regeneracao
  // rapida demais, encostar em zumbi deixa de custar. Cinco segundos e o tempo
  // de sair de um cerco e respirar.
  esperaParaRegenerar: 5,
  regeneracaoPorSegundo: 22,
  velocidadeAndando: 3.4,
  velocidadeCorrendo: 5.6,
  // Correr tem limite: sem ele, a tatica unica do jogo e correr em circulo para
  // sempre, e o mapa deixa de importar.
  vigorMaximo: 4.2,
  vigorPorSegundo: 1.6,
  alturaDoOlho: 1.62,
  raioDoJogador: 0.42,

  // --- baixado e sangramento -------------------------------------------
  // Zumbis derrubam em vez de matar. Sangrando o jogador rasteja devagar e
  // atira com uma pistola de reserva — a chance de voltar existe, e e curta.
  tempoDeSangramento: 32,
  velocidadeSangrando: 1.1,
  // O perk de auto-revive gasta a carga e levanta com metade da vida.
  vidaAoLevantar: 50,

  // --- lanterna --------------------------------------------------------
  // A mina e escura de verdade: sem lanterna da para andar, nao para mirar.
  // Pilha nao acaba (nao e jogo de gerenciar pilha), mas a lanterna entrega
  // voce: zumbi na luz acelera.
  alcanceDaLanterna: 13,
  aberturaDaLanterna: 0.42,

  // --- economia --------------------------------------------------------
  pontosPorAcerto: 10,
  pontosPorMorte: 60,
  pontosPorCabeca: 100,
  pontosPorTabuaReposta: 10,
  // Recompra de municao na parede custa menos que a arma: e o que mantem uma
  // arma boa viva na rodada 15 sem o jogador precisar trocar de arma.
  fracaoDoCustoDaMunicao: 0.45,
  pontosIniciais: 500,

  // --- interacao -------------------------------------------------------
  alcanceDeUso: 2.6,
  tempoDeReporTabua: 0.55,

  // --- perks (os quatro, com o nome que a mina daria) ------------------
  perks: {
    caldo: { nome: 'CALDO', custo: 2500, descricao: 'dobra a vida' },
    graxa: { nome: 'GRAXA', custo: 3000, descricao: 'recarrega no dobro' },
    gatilho: { nome: 'GATILHO', custo: 2000, descricao: 'cadencia em dobro' },
    talisma: { nome: 'TALISMA', custo: 1500, descricao: 'levanta sozinho uma vez' },
  },
  multiplicadorDeVidaDoCaldo: 2,
  multiplicadorDeRecargaDaGraxa: 2,
  multiplicadorDeCadenciaDoGatilho: 1.85,

  // --- caixa e forja ---------------------------------------------------
  custoDaCaixa: 950,
  custoDaForja: 5000,
  // A forja multiplica dano e pente, e o multiplicador e alto de proposito: e
  // ele que decide se a rodada 25 e possivel.
  danoDaForja: 2.6,
  penteDaForja: 1.6,

  // --- zumbis ----------------------------------------------------------
  // Dano por mordida e o tempo entre mordidas. Tres zumbis em cima derrubam em
  // pouco mais de tres segundos, e e isso que faz cerco ser cerco.
  danoDoZumbi: 28,
  intervaloDaMordida: 1.1,
  alcanceDaMordida: 1.35,
  raioDoZumbi: 0.45,
  // Tabuas por janela. Zumbi arranca uma por vez, e o jogador repoe uma por vez.
  tabuasPorJanela: 6,
  tempoParaArrancarTabua: 1.9,
  // Quantos zumbis podem existir ao mesmo tempo. Nao e limite de desempenho: e
  // o que garante que a rodada 30 seja um fluxo constante e nao uma parede de
  // sessenta corpos que ninguem atravessa.
  zumbisSimultaneos: 24,
};

// Nomes proprios da mina, para o HUD e para as mensagens.
export const TEXTOS = {
  forcaDesligada: 'A FORCA ESTA DESLIGADA',
  forcaLigada: 'FORCA LIGADA',
  semPontos: 'PONTOS INSUFICIENTES',
  precisaDeForca: 'PRECISA DE FORCA',
  penteCheio: 'PENTE CHEIO',
  semArma: 'MAO VAZIA',
};
