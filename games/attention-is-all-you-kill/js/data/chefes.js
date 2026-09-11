// chefes.js — o que o manual precisa saber sobre cada chefe.
//
// Separado das classes de propósito: aqui mora o TEXTO (regra, ataques, dica),
// não o comportamento. O manual lê daqui, e assim explicar um chefe novo é
// escrever uma entrada, sem tocar no arquivo de interface.
//
// A chave é o id do tema, o mesmo que o main.js usa para escolher a classe.

export const CHEFES = {
  6: {
    nome: 'A BOLHA',
    tema: 'A BOLHA',
    cor: 0xffc94d,
    chamada: 'Valuation de um trilhão. Receita de zero.',
    regra: 'As quatro promessas sustentam o valuation: enquanto elas estiverem de pé, o corpo está blindado e não toma dano. Derrube as quatro e a bolha esvazia: encolhe, fica lenta e exposta.',
    ataques: [
      'Rodada de captação: leque dourado de projéteis',
      'Estouro de valor: onda radial que empurra quem está perto',
      'Pitch para startups: invoca o enxame'
    ],
    dica: 'O tamanho dela é o indicador. Cheia, ela é grande e acerta mais longe. Esvaziada, encolhe e o núcleo fica exposto: é a hora de gastar pente.'
  },
  7: {
    nome: 'O CANDIDATO',
    tema: 'O PALANQUE',
    cor: 0x4d7fff,
    chamada: 'Promete o muro, o boom e a vitória. Nesta ordem.',
    regra: 'Enquanto as quatro caixas de som estiverem ligadas, o discurso sustenta o corpo e ele fica blindado. Desligue as quatro e o palco fica mudo.',
    ataques: [
      'Muro de contexto: uma parede atravessa a sala na sua direção',
      'Post: cai do céu em pontos marcados no chão',
      'Comício: invoca a plateia e recupera base'
    ],
    dica: 'O muro não bloqueia tiro, ele machuca quem ficar na faixa. A faixa aparece no chão antes: andar de lado resolve, correr para trás não.'
  },
  8: {
    nome: 'O JUIZ',
    tema: 'O TRIBUNAL',
    cor: 0x9aa6ff,
    chamada: 'Julgado por treinar com o que era público.',
    regra: 'Enquanto os autos do processo estiverem em cima da bancada, o julgamento corre e o corpo fica blindado. Derrube os volumes e o processo para.',
    ataques: [
      'Três marteladas: anéis que abrem em sequência',
      'Intimação: projétil lento que corrige a rota atrás de você',
      'Desacato: invoca advogados'
    ],
    dica: 'As marteladas saem em três anéis seguidos a partir de onde você estava. Sair do lugar uma vez não basta: escolha um lado e ande até o fim.'
  }
};

// O FINE-TUNER atende os temas 1 a 5, então ele não tem id de tema próprio.
export const CHEFE_PADRAO = {
  nome: 'THE FINE-TUNER',
  tema: 'A FAZENDA ao O ESCRITORIO (andares 1 a 5)',
  cor: 0x35f0d8,
  chamada: 'A mão que ajusta todo modelo ao formato dela.',
  regra: 'O corpo é blindado enquanto os quatro nós de ancoragem estiverem de pé. Destrua os nós para abrir a janela de dano, e repita até ele cair. Três fases.',
  ataques: [
    'Golpe de palma: círculo marcado no chão antes de bater',
    'Lote de treino: invoca o enxame',
    'Descarga em leque: cone marcado no chão'
  ],
  dica: 'O leque avisa 1,25 segundo antes com um cone, e os projéteis são lentos de propósito. Andar para o lado basta.'
};

export function chefesDoManual() {
  return [CHEFE_PADRAO, ...Object.keys(CHEFES).sort((a, b) => a - b).map(k => CHEFES[k])];
}
