// As salas da cripta. Grade de 20x12 tiles.
//
// Legenda:  #  pedra    .  vazio    P  arqueóloga
//           C  caixa    o  placa    S  saida
//
// Duas regras moldam todo o desenho daqui:
//
// 1. A caixa so e empurrada, nunca puxada. Caixa empurrada demais para a
//    esquerda e caixa perdida — e e por isso que desfazer existe.
// 2. O degrau precisa estar na MESMA linha em que a jogadora anda. Bloco acima
//    da cabeca nao e degrau, e passar por baixo dele. Foi o erro que derrubou
//    o primeiro desenho inteiro destas salas.
//
// Todas terminam no mesmo bloco de saida, nas colunas 16 a 18: escada de tres
// degraus ate a antena. Repetir o final de proposito faz a jogadora reconhecer
// "cheguei" de longe, e deixa a sala falar so sobre o miolo dela.

export const LARGURA = 20;
export const ALTURA = 12;

export const SALAS = [
  {
    nome: 'DEGRAU',
    dica: 'Setas para andar. Você sobe um degrau sozinha.',
    mapa: [
      '####################',
      '####################',
      '####################',
      '####################',
      '....................',
      '....................',
      '....................',
      '..................S.',
      '..................#.',
      '.......#.........#..',
      '..P..##........####.',
      '####################',
    ],
  },
  {
    nome: 'CAIXA',
    dica: 'Empurre a caixa. Quando ela não tem para onde ir, você sobe nela.',
    mapa: [
      '####################',
      '####################',
      '####################',
      '####################',
      '....................',
      '....................',
      '....................',
      '..................S.',
      '..................#.',
      '.............#...#..',
      '..P...C......#..##..',
      '####################',
    ],
  },
  {
    nome: 'ESCADA',
    dica: 'Duas paredes, duas caixas. Uma para cada.',
    mapa: [
      '####################',
      '####################',
      '####################',
      '####################',
      '....................',
      '....................',
      '....................',
      '..................S.',
      '..................#.',
      '........#....#...#..',
      '..P..C..#..C.#..##..',
      '####################',
    ],
  },
  {
    nome: 'PLACA',
    dica: 'A saída só abre com a placa ocupada. Segure ↑ para subir na caixa.',
    mapa: [
      '####################',
      '####################',
      '####################',
      '####################',
      '....................',
      '....................',
      '....................',
      '..................S.',
      '..................#.',
      '.................#..',
      '..P...C......o..##..',
      '####################',
    ],
  },
  {
    nome: 'DUPLA',
    dica: 'Duas placas. Pare a caixa no lugar certo: não dá para puxar de volta.',
    mapa: [
      '####################',
      '####################',
      '####################',
      '####################',
      '....................',
      '....................',
      '....................',
      '..................S.',
      '..................#.',
      '.................#..',
      '..PC....o...C.o.##..',
      '####################',
    ],
  },
  {
    nome: 'BEIRA',
    dica: 'A caixa precisa ir para a esquerda. Dê a volta por cima dela.',
    mapa: [
      '####################',
      '####################',
      '####################',
      '####################',
      '....................',
      '....................',
      '....................',
      '..................S.',
      '..................#.',
      '.................#..',
      '.o..P..C........##..',
      '####################',
    ],
  },
  {
    nome: 'TORRE',
    dica: 'Uma caixa para cada parede, e a placa no meio do caminho.',
    mapa: [
      '####################',
      '####################',
      '####################',
      '####################',
      '....................',
      '....................',
      '....................',
      '..................S.',
      '..................#.',
      '.......#.....#...#..',
      '..P.C.o#..C..#..##..',
      '####################',
    ],
  },
  {
    nome: 'FUNDO',
    dica: 'Tudo que a cripta ensinou.',
    mapa: [
      '####################',
      '####################',
      '####################',
      '####################',
      '....................',
      '....................',
      '....................',
      '..................S.',
      '..................#.',
      '.............#...#..',
      '.oPC.#..C..oC#..##..',
      '####################',
    ],
  },
];
