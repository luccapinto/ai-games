// Todo numero que o jogo usa para decidir algo mora aqui.
//
// Esta separado de `jogo.js` por um motivo pratico: `mapa.js` precisa dos mesmos
// numeros para provar que a municao e a pilha de uma fase fecham, e `jogo.js`
// precisa do mapa. Constante num terceiro arquivo desfaz o ciclo.

export const CONFIG = {
  vidaMax: 130,

  // Velocidade em celulas por segundo. Agachado e a metade de andar, e e a
  // unica maneira de se mover sem fazer ruido nenhum.
  velAndar: 2.6,
  velCorrer: 4.3,
  velAgachar: 1.3,
  aceleracao: 26,
  atrito: 14,
  raioJogador: 0.28,
  alturaOlho: 0.5,

  // Girar com teclado. O mouse entrega delta e nao passa por aqui.
  velGiro: 2.9,

  // Lanterna: ve longe, gasta pilha, e o inimigo que tem olho ve voce de longe
  // tambem. E a decisao central do jogo, entao os numeros sao apertados de
  // proposito — provas.mjs cobra a razao entre pilha disponivel e travessia.
  //
  // `alcanceEscuro` e o quanto se ve com a lanterna apagada. Ele comecou em
  // 2,6 e a captura de tela mostrou o estrago: com a pilha vazia a tela virava
  // um retangulo preto, e um jogo cego nao e um jogo tenso. Em 4,2 da para
  // andar no escuro e continua valendo a pena acender.
  bateriaMax: 100,
  bateriaEntrada: 100,
  gastoLanterna: 2.6,
  alcanceLanterna: 9.5,
  alcanceEscuro: 4.2,

  // Ruido. A unidade e celula: forca 12 e ouvida a 12 celulas de caminhada,
  // nao de linha reta, e porta fechada cobra pedagio (ver `custoPorta`).
  ruidoAndar: 6,
  ruidoCorrer: 13,
  ruidoAgachar: 0,
  ruidoAgua: 5,
  passoRuido: 1.1,
  custoPorta: 4,

  // Municao com que se entra numa fase. Vale como reserva na prova de economia:
  // a picareta e infinita, entao nunca ha travamento — o que se prova e tensao.
  municaoInicial: { pinos: 32, cartuchos: 0, gas: 0 },
  municaoMax: { pinos: 140, cartuchos: 32, gas: 120 },

  // Quanto tempo o corpo do bicho fica no chao antes de sumir (so visual).
  tempoCadaver: 22,

  // Dano que o jogador toma cai pela metade agachado atras de quina? Nao:
  // agachar e sobre ruido, nao sobre defesa. Nenhum modificador aqui.
  empurraoMorte: 0.6,

  // Piso de vida ao descer de fase. Ver o comentario de `herdar` em jogo.js:
  // saiu de uma fase com 20, entra na seguinte com este numero.
  pisoDeVidaAoDescer: 80,
};

// O que cada item da planta entrega ao ser pisado.
export const ITENS = {
  P: { tipo: 'pinos', qtd: 22, rotulo: 'PINOS' },
  T: { tipo: 'cartuchos', qtd: 4, rotulo: 'CARTUCHOS' },
  G: { tipo: 'gas', qtd: 40, rotulo: 'GAS' },
  V: { tipo: 'pilha', qtd: 45, rotulo: 'PILHA' },
  K: { tipo: 'kit', qtd: 45, rotulo: 'KIT' },
  A: { tipo: 'cracha', cracha: 'A', rotulo: 'CRACHA A' },
  B: { tipo: 'cracha', cracha: 'B', rotulo: 'CRACHA B' },
  C: { tipo: 'cracha', cracha: 'C', rotulo: 'CRACHA C' },
  S: { tipo: 'arma', arma: 'espingarda', rotulo: 'ESPINGARDA' },
  M: { tipo: 'arma', arma: 'macarico', rotulo: 'MACARICO' },
};

// Gerador congruente linear com semente. O jogo sorteia pouca coisa — o
// espalhamento da espingarda e o tremor do bicho — mas sorteio sem semente
// impede provar que duas partidas iguais dao no mesmo.
export function criarSorteio(semente = 1) {
  let estado = (semente | 0) || 1;
  return () => {
    estado = (estado * 1103515245 + 12345) & 0x7fffffff;
    return estado / 0x7fffffff;
  };
}
