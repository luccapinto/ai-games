// Os mapas do SUBSOLO, em planta ASCII — um caractere por celula de 2,2 m.
//
// A planta e o dado canonico: geometria, janela, maquina, lampada e porta moram
// todos aqui, e nada e sorteado em tempo de jogo. O que varia entre partidas e
// por qual janela a horda entra e o que a caixa cospe, nao onde as coisas ficam.
//
// A legenda inteira:
//
//   parede    # rocha    = concreto    % chapa
//   janela    J          (nasce zumbi; tem tabua; e parede para o corpo e vao
//                         para a bala)
//   porta     1 2 3 4    (comprada com pontos; o preco esta em `portas`)
//   piso      . seco     ~ poca     o lampada acesa
//   inicio    @
//   arma      S espingarda   N pineira   C carabina   G macarico
//   maquina   X caixa    F forja    L interruptor de forca
//   perk      V caldo (vida)   R graxa (recarga)   T gatilho (cadencia)
//             A talisma (levanta sozinho)
//
// **O anel e requisito de projeto, nao enfeite.** As quatro zonas de cada mapa
// formam um ciclo: galpao -> corredor norte -> topo -> corredor sul -> galpao.
// Num jogo de horda, mapa sem volta e mapa onde a rodada 12 mata todo mundo no
// mesmo canto, sempre — e `provas.mjs` mede o tamanho da volta e quantas zonas
// ela cruza, porque "tem volta" precisa ser numero e nao opiniao.
//
// As plantas foram compostas com uma ferramenta descartavel (salas e corredores
// posicionados a mao, caractere gerado) e conferidas pelas provas, celula por
// celula: zona, janela sem caminho, maquina inalcancavel e tamanho da volta.

export const PLANTAS = [
  {
    nome: 'BOCA DA MINA',
    dica: 'Quatro zonas em anel. A forca fica na subestacao, e sem forca nao ha perk.',
    paleta: {
      rocha: '#6b5a46', concreto: '#84796b', chapa: '#8b7a5e',
      piso: '#453b32', teto: '#241e19', fundo: '#0b0908',
    },
    portas: { 1: 750, 2: 1000, 3: 1250, 4: 1000 },
    planta: [
      '##############################################',
      '##############################################',
      '##=======J======###############=====J=======##',
      '##=............=###############=.C......L..=##',
      '##=.S..........2...........................=##',
      '##J............2...........................J##',
      '##=.....o......2...........................=##',
      '##=............=###############=...........=##',
      '##=.......~....=###############=.....o.....=##',
      '##=..........V.J###############=...........=##',
      '##=............=###############=.~.........=##',
      '##===...========###############J.........X.=##',
      '#####...#######################=...........=##',
      '#####...#######################=====333=====##',
      '#####.~.############################...#######',
      '#####...############################...#######',
      '#####.o.############################...#######',
      '#####...############################.o.#######',
      '#####...############################...#######',
      '#####...############################...#######',
      '#####...############################...#######',
      '##===111=======#######==============...=====##',
      '##=........N..=#######=.G.........T......F.=##',
      '##=...........=#######=....................=##',
      '##J...........4............................=##',
      '##=....@......4............o...............J##',
      '##=....~......4...........~............o...=##',
      '##J.........o.=#######=............~.......=##',
      '##=.o.........=#######=.A.....R............=##',
      '##======J======#######======J=========J=====##',
      '##############################################',
      '##############################################',
    ],
  },
  {
    nome: 'POCO FUNDO',
    dica: 'Mais apertado e mais fundo. A oficina tem forja, e o poco tem caixa.',
    paleta: {
      rocha: '#4f4a52', concreto: '#6f6a70', chapa: '#7b7466',
      piso: '#3a3640', teto: '#1c1a21', fundo: '#08070a',
    },
    portas: { 1: 500, 2: 1250, 3: 1500, 4: 1750 },
    planta: [
      '########################################',
      '########################################',
      '########################################',
      '##=======J====############======J=====##',
      '##=..........=############=.C.....L..=##',
      '##=.S........=############=..........J##',
      '##J......~...2.......................=##',
      '##=..........2.......................=##',
      '##=.....o....2...................o...=##',
      '##=..........=############=..........=##',
      '##=........V.J############=..~.......=##',
      '##=..........=############J........X.=##',
      '##===...======############=..........=##',
      '#####...##################====333=====##',
      '#####.~.######################...#######',
      '#####...######################...#######',
      '#####...######################.o.#######',
      '##===111======################...#######',
      '##=..........=########========...=====##',
      '##=.......N..=########=.G..........F.=##',
      '##J..........=########=..............=##',
      '##=...@......4.......................=##',
      '##=....~.....4.....................o.J##',
      '##=..........4..............~........=##',
      '##J.o........=########=...........T..=##',
      '##======J=====########=..A....R......=##',
      '######################=====J=======J==##',
      '########################################',
    ],
  },
];
