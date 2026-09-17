// Os numeros do GUARDRAIL: tipos de dano, modelos (as torres), infraestrutura,
// modos de servir e as pragas (os inimigos).
//
// A regra de ouro deste arquivo: nenhum atributo e inventado. Cada um sai de um
// dado real do mundo de IA, e a conversao esta escrita ao lado. Preco por milhao
// de tokens vira custo de compra; benchmark vira dano; tokens por segundo viram
// cadencia; janela de contexto vira alcance; latencia do primeiro token vira o
// tempo de mira; taxa de alucinacao vira chance de errar o tiro; postura de
// seguranca vira recusa; e o tamanho servido vira consumo de VRAM.
//
// Os nomes sao pseudonimos obvios de proposito: e mais engracado, e ninguem
// precisa de autorizacao de ninguem.

// -------------------------------------------------------------- tipos de dano

export const DANOS = {
  token: {
    nome: 'TOKEN',
    cor: '#6fc8ff',
    curto: 'TOK',
    desc: 'Dano direto num alvo so. Barato, confiavel e inutil contra armadura de volume.',
  },
  vetor: {
    nome: 'VETOR',
    cor: '#b98cff',
    curto: 'VET',
    desc: 'Dano em area. A unica coisa que fura armadura de volume, e a unica que resolve enxame.',
  },
  semantico: {
    nome: 'SEMANTICO',
    cor: '#ffce5c',
    curto: 'SEM',
    desc: 'Entende o contexto. A unica coisa que atravessa escudo semantico.',
  },
  filtro: {
    nome: 'FILTRO',
    cor: '#58e3a0',
    curto: 'FIL',
    desc: 'Pouco dano na hora, muito ao longo do tempo. Revela quem esta camuflado.',
  },
  ruido: {
    nome: 'RUIDO',
    cor: '#ff8f6b',
    curto: 'RUI',
    desc: 'Dano fraco, mas deixa o alvo lento e marcado: quem esta marcado recebe mais dano de todo mundo.',
  },
};

export const ORDEM_DANOS = ['token', 'vetor', 'semantico', 'filtro', 'ruido'];

// ------------------------------------------------------------ modos de servir
//
// O mesmo modelo, servido de jeito diferente, e outra torre. E o que faz o
// orcamento de compute ser uma decisao e nao uma parede.

export const MODOS = {
  padrao: {
    nome: 'PADRAO',
    desc: 'Pesos cheios, precisao cheia. O que o cartao de credito manda.',
    vram: 1, dano: 1, cadencia: 1, mira: 1,
  },
  quantizado: {
    nome: 'QUANTIZADO',
    desc: 'Int4. Cabe em quase metade da VRAM e perde 22% do dano. O truque mais usado do jogo.',
    vram: 0.55, dano: 0.78, cadencia: 1, mira: 1,
  },
  batch: {
    nome: 'BATCH',
    desc: 'Servir em lote: 35% mais cadencia, 45% mais VRAM e o primeiro tiro demora mais.',
    vram: 1.45, dano: 1, cadencia: 1.35, mira: 1.25,
  },
  offload: {
    nome: 'OFFLOAD',
    desc: 'Metade dos pesos na RAM do host: 65% menos VRAM, 38% menos cadencia e mira quase o dobro.',
    vram: 0.35, dano: 1, cadencia: 0.62, mira: 1.9,
  },
  moe: {
    nome: 'MOE',
    desc: 'So especialistas ativos na VRAM: metade do consumo, mas um tiro em cada dois roteia para o especialista errado e sai com 55% do dano.',
    vram: 0.5, dano: 1, cadencia: 1, mira: 1, alternado: 0.55,
  },
};

export const ORDEM_MODOS = ['padrao', 'quantizado', 'batch', 'offload', 'moe'];

export const TROCA_DE_MODO = 20;   // dolares para religar o servidor
export const AQUECIMENTO_MODO = 2.5; // segundos parada apos trocar

// ------------------------------------------------------------------- as torres

export const TORRES = [
  // ------------------------------------------------------------- modelos
  {
    id: 'chama',
    nome: 'CHAMA 8B',
    familia: 'Pesos abertos',
    classe: 'modelo',
    glifo: 'CH',
    cor: '#ff9b4a',
    custo: 55,
    vram: 1,
    dano: 6,
    cadencia: 3.2,
    alcance: 2.6,
    mira: 0.15,
    erro: 0.098,
    tipoDano: 'token',
    frase: 'Roda no seu proprio metal, erra uma em cada dez e nao cobra nada por isso.',
    real: {
      preco: 'US$ 0,06 / M tokens', bench: 'MMLU-Pro 48', tps: '310 tok/s',
      ctx: '128 mil tokens', ttft: '0,15 s', aluc: '9,8%', peso: '8B denso',
    },
    caminhos: [
      {
        nome: 'FINE-TUNE',
        desc: 'Treinar no seu proprio dominio: acerta muito mais e bate mais forte.',
        niveis: [
          { custo: 45, texto: 'LoRA de dominio: +4 de dano, erro cai de 9,8% para 6,4%', efeito: { dano: 4, erroMult: 0.65 } },
          { custo: 110, texto: 'Fine-tune completo: +9 de dano, erro cai para 2,9%', efeito: { dano: 9, erroMult: 0.45 } },
          { custo: 260, texto: 'Destilado do modelo grande: +22 de dano, erro 0,9%, dano vira SEMANTICO', efeito: { dano: 22, erroMult: 0.3, tipoDano: 'semantico' } },
        ],
      },
      {
        nome: 'ENXAME LOCAL',
        desc: 'Varias copias pequenas no mesmo card: cadencia absurda, dano por tiro ridiculo.',
        niveis: [
          { custo: 50, texto: 'Duas replicas: cadencia 3,2 para 4,6 tiros/s, +1 VRAM', efeito: { cadenciaMult: 1.45, vram: 1 } },
          { custo: 125, texto: 'Oito replicas: cadencia para 7,4 tiros/s, +2 VRAM', efeito: { cadenciaMult: 1.6, vram: 2 } },
          { custo: 290, texto: 'Cluster de borda: cadencia para 12,6 tiros/s, alcance +0,8, +3 VRAM', efeito: { cadenciaMult: 1.7, alcance: 0.8, vram: 3 } },
        ],
      },
    ],
  },
  {
    id: 'haicai',
    nome: 'HAICAI 4.5',
    familia: 'A casa dos constitucionais',
    classe: 'modelo',
    glifo: 'HA',
    cor: '#8fe3c8',
    custo: 85,
    vram: 2,
    dano: 9,
    cadencia: 2.4,
    alcance: 3.2,
    mira: 0.35,
    erro: 0.042,
    tipoDano: 'token',
    frase: 'Dezessete silabas por resposta e nenhum minuto perdido pensando.',
    real: {
      preco: 'US$ 1,00 / M tokens', bench: 'MMLU-Pro 63', tps: '180 tok/s',
      ctx: '200 mil tokens', ttft: '0,35 s', aluc: '4,2%', peso: 'nao divulgado',
    },
    caminhos: [
      {
        nome: 'CACHE DE PROMPT',
        desc: 'O prefixo ja esta quente: a mira quase some e a cadencia dispara.',
        niveis: [
          { custo: 60, texto: 'Cache de 5 min: mira de 0,35 s para 0,14 s, cadencia +18%', efeito: { miraMult: 0.4, cadenciaMult: 1.18 } },
          { custo: 140, texto: 'Cache de 1 h: cadencia +35%, sem tempo de mira nenhum', efeito: { cadenciaMult: 1.35, miraMult: 0.1 } },
          { custo: 320, texto: 'Cache compartilhado: cadencia +45% e o alcance passa a 4,4 celulas', efeito: { cadenciaMult: 1.45, alcance: 1.2 } },
        ],
      },
      {
        nome: 'SAIDA ESTRUTURADA',
        desc: 'Gramatica obrigatoria na saida: tiro mais pesado e que atravessa.',
        niveis: [
          { custo: 70, texto: 'JSON forcado: +7 de dano, o tiro atravessa 1 inimigo', efeito: { dano: 7, perfura: 1 } },
          { custo: 165, texto: 'Esquema tipado: +16 de dano, atravessa 2, alcance +0,5', efeito: { dano: 16, perfura: 1, alcance: 0.5 } },
          { custo: 380, texto: 'Chamada de ferramenta: +34 de dano, atravessa 4 e o dano vira VETOR com raio 0,9', efeito: { dano: 34, perfura: 2, tipoDano: 'vetor', area: 0.9, vram: 2 } },
        ],
      },
    ],
  },
  {
    id: 'geminado',
    nome: 'GEMINADO FLASH',
    familia: 'O buscador',
    classe: 'modelo',
    glifo: 'GE',
    cor: '#6fb6ff',
    custo: 130,
    vram: 3,
    dano: 11,
    cadencia: 2.8,
    alcance: 5.4,
    mira: 0.28,
    erro: 0.051,
    tipoDano: 'vetor',
    area: 0.9,
    moe: true,
    frase: 'Um milhao de tokens de contexto: ve o mapa quase inteiro de onde estiver.',
    real: {
      preco: 'US$ 0,30 / M tokens', bench: 'MMLU-Pro 71', tps: '250 tok/s',
      ctx: '1 milhao de tokens', ttft: '0,28 s', aluc: '5,1%', peso: 'MoE, ativos nao divulgados',
    },
    caminhos: [
      {
        nome: 'JANELA DE DOIS MILHOES',
        desc: 'Contexto e alcance sao a mesma coisa aqui. Esta e a torre que cobre o mapa.',
        niveis: [
          { custo: 95, texto: 'Alcance de 5,4 para 6,6 celulas', efeito: { alcance: 1.2 } },
          { custo: 210, texto: 'Alcance para 8,2 celulas, raio da area para 1,3', efeito: { alcance: 1.6, area: 0.4 } },
          { custo: 470, texto: 'Alcance para 11 celulas (meio mapa), area 1,8 e +12 de dano', efeito: { alcance: 2.8, area: 0.5, dano: 12, vram: 3 } },
        ],
      },
      {
        nome: 'MULTIMODAL',
        desc: 'Ve imagem, video e o que finge nao estar ali. Ganha deteccao e tiro antiaereo.',
        niveis: [
          { custo: 110, texto: 'Visao: passa a enxergar camuflado', efeito: { deteccao: true } },
          { custo: 230, texto: 'Video: acerta voador, +8 de dano', efeito: { antiaereo: true, dano: 8 } },
          { custo: 500, texto: 'Audio e video ao vivo: +24 de dano, cadencia +30% e revela camuflado num raio de 3 celulas para todas as torres', efeito: { dano: 24, cadenciaMult: 1.3, revela: 3, vram: 2 } },
        ],
      },
    ],
  },
  {
    id: 'quem',
    nome: 'QUEM-3 VL',
    familia: 'A loja do oriente',
    classe: 'modelo',
    glifo: 'QM',
    cor: '#c084f0',
    custo: 150,
    vram: 3,
    dano: 8,
    cadencia: 1.9,
    alcance: 3.6,
    mira: 0.5,
    erro: 0.064,
    tipoDano: 'filtro',
    dot: 9,
    deteccao: true,
    moe: true,
    frase: 'Le placa, print, meme e o que o usuario jurou que nao mandou. Ja vem com deteccao.',
    real: {
      preco: 'US$ 0,45 / M tokens', bench: 'MMLU-Pro 68', tps: '140 tok/s',
      ctx: '256 mil tokens', ttft: '0,50 s', aluc: '6,4%', peso: 'MoE 235B, 22B ativos',
    },
    caminhos: [
      {
        nome: 'CLASSIFICADOR',
        desc: 'Mais veneno por segundo e uma marca que faz todo mundo bater mais forte.',
        niveis: [
          { custo: 90, texto: 'Dano continuo de 9 para 17 por segundo', efeito: { dot: 8 } },
          { custo: 200, texto: 'Continuo para 30 por segundo, e o alvo fica 25% mais lento', efeito: { dot: 13, lentidao: 0.25 } },
          { custo: 430, texto: 'Continuo para 54 por segundo, lentidao 40% e o alvo marcado recebe +30% de dano de qualquer torre', efeito: { dot: 24, lentidao: 0.15, marca: 0.3 } },
        ],
      },
      {
        nome: 'OCR DE PLACA',
        desc: 'Ve tudo que passa, inclusive o que voa e o que esta em realidade aumentada.',
        niveis: [
          { custo: 100, texto: 'Acerta voador, alcance +0,7', efeito: { antiaereo: true, alcance: 0.7 } },
          { custo: 215, texto: 'Revela camuflado num raio de 3,5 celulas para todas as torres', efeito: { revela: 3.5 } },
          { custo: 460, texto: 'Revela num raio de 5,5, +18 de dano e ignora recusa (o alinhado ao lado volta a atirar)', efeito: { revela: 2, dano: 18, auraIgnoraRecusa: 3 } },
        ],
      },
    ],
  },
  {
    id: 'soneto',
    nome: 'SONETO 4.5',
    familia: 'A casa dos constitucionais',
    classe: 'modelo',
    glifo: 'SO',
    cor: '#f0a878',
    custo: 240,
    vram: 5,
    dano: 21,
    cadencia: 1.5,
    alcance: 3.4,
    mira: 0.6,
    erro: 0.021,
    tipoDano: 'semantico',
    recusa: true,
    frase: 'A menor taxa de alucinacao do mercado. Em troca, se recusa a atirar em quem ainda parece inocente.',
    real: {
      preco: 'US$ 3,00 / M tokens', bench: 'MMLU-Pro 82', tps: '95 tok/s',
      ctx: '200 mil tokens', ttft: '0,60 s', aluc: '2,1%', peso: 'nao divulgado',
    },
    caminhos: [
      {
        nome: 'CONSTITUICAO',
        desc: 'Publica os principios e as torres em volta passam a errar menos. Continua recusando.',
        niveis: [
          { custo: 130, texto: '+11 de dano, e as torres num raio de 2,8 erram 35% menos', efeito: { dano: 11, auraErro: 0.35, auraRaio: 2.8 } },
          { custo: 290, texto: '+26 de dano, aura de erro para 60% e +12% de dano nas vizinhas', efeito: { dano: 26, auraErro: 0.25, auraDano: 0.12 } },
          { custo: 620, texto: '+58 de dano, aura de +30% de dano, raio 4, e este modelo para de recusar', efeito: { dano: 58, auraDano: 0.18, auraRaio: 1.2, semRecusa: true } },
        ],
      },
      {
        nome: 'USO DE FERRAMENTA',
        desc: 'Chama uma segunda ferramenta a cada resposta: um tiro perseguidor de brinde.',
        niveis: [
          { custo: 140, texto: 'Dois alvos por salva, alcance +0,6', efeito: { alvos: 1, alcance: 0.6 } },
          { custo: 310, texto: 'Tres alvos por salva, +18 de dano', efeito: { alvos: 1, dano: 18 } },
          { custo: 680, texto: 'Cinco alvos por salva, +40 de dano e cadencia +25%', efeito: { alvos: 2, dano: 40, cadenciaMult: 1.25, vram: 3 } },
        ],
      },
    ],
  },
  {
    id: 'profundo',
    nome: 'PROFUNDO R1',
    familia: 'Pesos abertos',
    classe: 'modelo',
    glifo: 'PR',
    cor: '#7d9bff',
    custo: 200,
    vram: 7,
    dano: 46,
    cadencia: 0.55,
    alcance: 3.0,
    mira: 2.4,
    erro: 0.079,
    tipoDano: 'semantico',
    moe: true,
    frase: 'Pensa 2,4 segundos antes do primeiro tiro. Depois disso, o tiro resolve.',
    real: {
      preco: 'US$ 0,55 / M tokens', bench: 'MMLU-Pro 84', tps: '22 tok/s',
      ctx: '128 mil tokens', ttft: '2,40 s', aluc: '7,9%', peso: 'MoE 671B, 37B ativos',
    },
    caminhos: [
      {
        nome: 'CADEIA DE PENSAMENTO',
        desc: 'Mais tokens de raciocinio: o tiro vira um evento, e demora ainda mais para sair.',
        niveis: [
          { custo: 120, texto: '+38 de dano, mas a mira sobe de 2,4 s para 3,1 s', efeito: { dano: 38, miraMult: 1.3 } },
          { custo: 280, texto: '+92 de dano, mira 3,7 s, o tiro atravessa 3 inimigos', efeito: { dano: 92, miraMult: 1.2, perfura: 3 } },
          { custo: 640, texto: '+240 de dano, mira 4,4 s, atravessa 6 e vira VETOR com raio 1,6', efeito: { dano: 240, miraMult: 1.2, perfura: 3, tipoDano: 'vetor', area: 1.6, vram: 4 } },
        ],
      },
      {
        nome: 'DESTILACAO',
        desc: 'O raciocinio vira peso: quase toda a demora some, e boa parte da VRAM junto.',
        niveis: [
          { custo: 130, texto: 'Mira de 2,4 s para 1,1 s, cadencia +60%, -2 VRAM, -8 de dano', efeito: { miraMult: 0.45, cadenciaMult: 1.6, vram: -2, dano: -8 } },
          { custo: 300, texto: 'Mira 0,5 s, cadencia +55%, -2 VRAM, erro cai pela metade', efeito: { miraMult: 0.45, cadenciaMult: 1.55, vram: -2, erroMult: 0.5 } },
          { custo: 660, texto: 'Mira 0,2 s, cadencia +50%, +30 de dano e 2 alvos por salva', efeito: { miraMult: 0.4, cadenciaMult: 1.5, dano: 30, alvos: 1 } },
        ],
      },
    ],
  },
  {
    id: 'jota',
    nome: 'JOTA-5',
    familia: 'A porta aberta',
    classe: 'modelo',
    glifo: 'J5',
    cor: '#5fe0d0',
    custo: 360,
    vram: 8,
    dano: 30,
    cadencia: 1.7,
    alcance: 4.2,
    mira: 0.7,
    erro: 0.028,
    tipoDano: 'token',
    perfura: 2,
    moe: true,
    frase: 'O topo do quadro. Cobra por isso e atravessa dois inimigos por tiro.',
    real: {
      preco: 'US$ 1,25 / M tokens', bench: 'MMLU-Pro 87', tps: '110 tok/s',
      ctx: '400 mil tokens', ttft: '0,70 s', aluc: '2,8%', peso: 'MoE, tamanho nao divulgado',
    },
    caminhos: [
      {
        nome: 'ROTEADOR AUTOMATICO',
        desc: 'Escolhe o tipo de dano que o alvo menos resiste. Nao e o mais forte: e o que nunca esta errado.',
        niveis: [
          { custo: 170, texto: 'Alterna TOKEN e SEMANTICO conforme o alvo, +10 de dano', efeito: { dano: 10, roteador: ['token', 'semantico'] } },
          { custo: 380, texto: 'Entra VETOR na rotacao (raio 1,1), +26 de dano', efeito: { dano: 26, area: 1.1, roteador: ['token', 'semantico', 'vetor'] } },
          { custo: 820, texto: 'Os cinco tipos na rotacao, +70 de dano, deteccao e antiaereo', efeito: { dano: 70, roteador: ['token', 'semantico', 'vetor', 'filtro', 'ruido'], deteccao: true, antiaereo: true, dot: 22, vram: 3 } },
        ],
      },
      {
        nome: 'RACIOCINIO ALTO',
        desc: 'Sobe o esforco de raciocinio: dano de chefe, cadencia de tartaruga.',
        niveis: [
          { custo: 180, texto: '+52 de dano, cadencia de 1,7 para 1,2 tiros/s', efeito: { dano: 52, cadenciaMult: 0.72 } },
          { custo: 400, texto: '+130 de dano, cadencia 0,9, atravessa 4', efeito: { dano: 130, cadenciaMult: 0.75, perfura: 2 } },
          { custo: 880, texto: '+340 de dano, cadencia 0,7, atravessa 8 e ignora 50% de toda resistencia', efeito: { dano: 340, cadenciaMult: 0.78, perfura: 4, furaResist: 0.5, vram: 4 } },
        ],
      },
    ],
  },
  {
    id: 'opus',
    nome: 'OPUS 4.6',
    familia: 'A casa dos constitucionais',
    classe: 'modelo',
    glifo: 'OP',
    cor: '#ffd166',
    custo: 560,
    vram: 10,
    dano: 62,
    cadencia: 1.1,
    alcance: 4.8,
    mira: 1.1,
    erro: 0.014,
    tipoDano: 'semantico',
    area: 1.2,
    frase: 'Quinze dolares por milhao de tokens. Se voce chegou aqui, e porque nada mais resolveu.',
    real: {
      preco: 'US$ 15,00 / M tokens', bench: 'MMLU-Pro 89', tps: '68 tok/s',
      ctx: '500 mil tokens', ttft: '1,10 s', aluc: '1,4%', peso: 'nao divulgado',
    },
    caminhos: [
      {
        nome: 'AGENTE LONGO',
        desc: 'Quanto mais tempo no mesmo alvo, mais forte bate. Feito para chefe.',
        niveis: [
          { custo: 260, texto: 'Cada segundo no mesmo alvo soma +22% de dano, ate +100%', efeito: { crescimento: 0.22, crescimentoTeto: 1.0 } },
          { custo: 560, texto: 'Ate +220% de dano acumulado, +40 de dano base', efeito: { crescimentoTeto: 1.2, dano: 40 } },
          { custo: 1150, texto: 'Ate +450% acumulado, +120 de dano e o acumulo nao zera ao trocar de alvo', efeito: { crescimentoTeto: 2.3, dano: 120, crescimentoFixo: true, vram: 4 } },
        ],
      },
      {
        nome: 'SUBAGENTES',
        desc: 'Abre varios agentes de uma vez: para de ser uma torre e vira tres.',
        niveis: [
          { custo: 280, texto: '3 alvos por salva, raio da area de 1,2 para 1,5', efeito: { alvos: 2, area: 0.3 } },
          { custo: 600, texto: '5 alvos por salva, +45 de dano, cadencia +20%', efeito: { alvos: 2, dano: 45, cadenciaMult: 1.2 } },
          { custo: 1220, texto: '9 alvos por salva, +110 de dano, cadencia +30% e area 2,2', efeito: { alvos: 4, dano: 110, cadenciaMult: 1.3, area: 0.7, vram: 6 } },
        ],
      },
    ],
  },

  // ------------------------------------------------------- infraestrutura
  {
    id: 'segura',
    nome: 'A SEGURA',
    familia: 'Infraestrutura',
    classe: 'infra',
    glifo: 'SG',
    cor: '#9fd6a0',
    custo: 190,
    vram: 0,
    capacidade: 7,
    alcance: 3.0,
    naoAtira: true,
    frase: 'Nao atira em nada. Em compensacao, o cluster para de derreter: +7 de VRAM e quem esta no raio dela nao sofre estrangulamento.',
    real: {
      preco: 'contrato anual', bench: 'nao participa de benchmark', tps: '0 tok/s',
      ctx: 'a politica inteira', ttft: 'nunca responde', aluc: '0%', peso: 'uma sala com ar condicionado',
    },
    caminhos: [
      {
        nome: 'REFRIGERACAO LIQUIDA',
        desc: 'Mais teto de VRAM. A decisao mais chata e mais importante do jogo.',
        niveis: [
          { custo: 150, texto: 'Capacidade de +7 para +12 de VRAM', efeito: { capacidade: 5 } },
          { custo: 330, texto: 'Capacidade +20, raio de protecao 4,2', efeito: { capacidade: 8, alcance: 1.2 } },
          { custo: 720, texto: 'Capacidade +34 e o estrangulamento do cluster inteiro cai pela metade', efeito: { capacidade: 14, amorteceEstrangulamento: 0.5 } },
        ],
      },
      {
        nome: 'AUDITORIA',
        desc: 'Vira sala de log: as torres em volta enxergam camuflado e param de errar.',
        niveis: [
          { custo: 160, texto: 'Torres no raio ganham deteccao', efeito: { auraDeteccao: true, auraRaio: 0.5 } },
          { custo: 350, texto: 'Torres no raio erram 70% menos e batem 15% mais forte', efeito: { auraErro: 0.7, auraDano: 0.15 } },
          { custo: 760, texto: 'Raio 5,4, +28% de dano, e as torres no raio nao podem ser corrompidas por prompt injection', efeito: { alcance: 2.4, auraDano: 0.13, auraImune: true } },
        ],
      },
    ],
  },
  {
    id: 'orquestrador',
    nome: 'ORQUESTRADOR',
    familia: 'Infraestrutura',
    classe: 'infra',
    glifo: 'OR',
    cor: '#78b0c8',
    custo: 170,
    vram: 2,
    alcance: 2.6,
    naoAtira: true,
    auraCadencia: 0.3,
    frase: 'Um roteador na frente de tudo: +30% de cadencia em quem estiver no raio.',
    real: {
      preco: 'US$ 0,02 / M tokens de roteamento', bench: 'nao aplicavel', tps: 'repassa 100%',
      ctx: 'a fila inteira', ttft: '0,02 s', aluc: '0%', peso: 'um proxy',
    },
    caminhos: [
      {
        nome: 'PARALELISMO',
        desc: 'Mais fila em paralelo: a aura de cadencia cresce e o raio tambem.',
        niveis: [
          { custo: 130, texto: 'Aura de cadencia de +30% para +52%, raio 3,4', efeito: { auraCadencia: 0.22, alcance: 0.8 } },
          { custo: 290, texto: 'Aura +80%, raio 4,2', efeito: { auraCadencia: 0.28, alcance: 0.8 } },
          { custo: 640, texto: 'Aura +130%, raio 5,4 e as torres no raio ignoram o tempo de mira', efeito: { auraCadencia: 0.5, alcance: 1.2, auraSemMira: true, vram: 3 } },
        ],
      },
      {
        nome: 'ROTEAMENTO SEMANTICO',
        desc: 'Manda cada pedido para quem resolve: a aura troca cadencia por dano e alcance.',
        niveis: [
          { custo: 140, texto: 'Aura passa a dar +26% de dano alem da cadencia', efeito: { auraDano: 0.26 } },
          { custo: 310, texto: 'Aura de dano +50%, e as torres no raio ganham +0,8 de alcance', efeito: { auraDano: 0.24, auraAlcance: 0.8 } },
          { custo: 690, texto: 'Aura de dano +90%, alcance +1,6 e as torres no raio ignoram 30% de resistencia', efeito: { auraDano: 0.4, auraAlcance: 0.8, auraFuraResist: 0.3, vram: 3 } },
        ],
      },
    ],
  },
  {
    id: 'cobranca',
    nome: 'COBRANCA',
    familia: 'Infraestrutura',
    classe: 'infra',
    glifo: 'CB',
    cor: '#cfe06a',
    custo: 160,
    vram: 1,
    alcance: 2.8,
    naoAtira: true,
    rendaOnda: 26,
    frase: 'A unica torre que nao machuca ninguem: fatura US$ 26 no fim de cada onda. Toda moeda gasta nela e uma torre a menos na parede.',
    real: {
      preco: 'US$ 0,00 — ela cobra, nao paga', bench: 'nao aplicavel', tps: 'nao gera token',
      ctx: 'o cartao do cliente', ttft: 'a fatura chega dia 1', aluc: '0%', peso: 'uma planilha',
    },
    caminhos: [
      {
        nome: 'PLANO ANUAL',
        desc: 'Renda fixa e crescente por onda. Paga no longo prazo, e o longo prazo pode nao chegar.',
        niveis: [
          { custo: 120, texto: 'Renda por onda de US$ 26 para US$ 58', efeito: { rendaOnda: 32 } },
          { custo: 270, texto: 'Renda por onda para US$ 122', efeito: { rendaOnda: 64 } },
          { custo: 590, texto: 'Renda por onda para US$ 250 e +3 de capacidade de VRAM (credito de nuvem)', efeito: { rendaOnda: 128, capacidade: 3 } },
        ],
      },
      {
        nome: 'MICROTRANSACAO',
        desc: 'Cobra por inimigo morto no raio. Onda grande vira onda rica.',
        niveis: [
          { custo: 110, texto: 'US$ 2 por inimigo morto no raio', efeito: { rendaMorte: 2 } },
          { custo: 250, texto: 'US$ 5 por morte no raio, raio 3,8', efeito: { rendaMorte: 3, alcance: 1 } },
          { custo: 560, texto: 'US$ 11 por morte no raio, raio 5,2, e cada morte no raio devolve 0,4% da recarga das habilidades', efeito: { rendaMorte: 6, alcance: 1.4, recargaPorMorte: 0.004 } },
        ],
      },
    ],
  },
];

export const TORRE_POR_ID = Object.fromEntries(TORRES.map(t => [t.id, t]));

// Cada torre do mesmo tipo encarece a proxima em 25%. Sem isso a simulacao
// mostra o de sempre: oito CHAMA quantizadas ganham o jogo e as outras dez
// torres viram enfeite. Variar tem que ser mais barato que empilhar.
export const INFLACAO = 1.25;
export const RETORNO_VENDA = 0.6;

// ------------------------------------------------------------------ as pragas
//
// `resist` e multiplicador de dano recebido por tipo: 1 = normal, 0,2 = recebe
// 20%. O que nao esta listado e 1.

export const PRAGAS = {
  alucinacao: {
    nome: 'ALUCINACAO', forma: 'gota', cor: '#c9a0ff', hp: 26, vel: 1.35, premio: 7, dano: 1,
    falsaChance: 0.35,
    regra: 'Uma em cada tres e falsa: some no primeiro dano e nao paga nada. Voce gastou tiro numa coisa que nunca existiu.',
  },
  botfarm: {
    nome: 'BOT FARM', forma: 'quadrado', cor: '#8a97a8', hp: 9, vel: 1.6, premio: 2, dano: 1,
    cargaVram: 0.14,
    regra: 'Vem as dezenas e morre de qualquer jeito. O problema nao e matar: cada bot vivo come 0,14 de VRAM do seu cluster.',
  },
  golpe: {
    nome: 'GOLPE', forma: 'losango', cor: '#ff7a5c', hp: 48, vel: 1.5, premio: 12, dano: 1,
    roubo: 3,
    regra: 'Nos ultimos 25% da rota ele encosta no caixa e leva US$ 3 por segundo. Matar longe da base e matar de graca.',
  },
  injection: {
    nome: 'PROMPT INJECTION', forma: 'seta', cor: '#ff5ca8', hp: 62, vel: 1.1, premio: 14, dano: 1,
    corrompe: 4,
    regra: 'Ao passar a menos de 1,3 celula de uma torre, vira ela contra voce por 4 segundos: ela para de atirar e passa a curar 12 HP/s das pragas em volta.',
  },
  camuflado: {
    nome: 'MODO ANONIMO', forma: 'hexagono', cor: '#5b6b7c', hp: 92, vel: 1.25, premio: 19, dano: 1,
    camuflado: true,
    regra: 'Invisivel para quem nao tem deteccao. Dano de FILTRO revela por 4 segundos, e depois ele some de novo.',
  },
  fork: {
    nome: 'FORK', forma: 'triangulo', cor: '#63d2a4', hp: 140, vel: 1.0, premio: 16, dano: 1,
    divide: 2, geracoes: 2,
    regra: 'Ao morrer, divide em 2 copias com metade do HP. As copias tambem dividem, uma vez so. Matar um vira matar sete.',
  },
  blindado: {
    nome: 'ARMADURA DE VOLUME', forma: 'octogono', cor: '#7f8fa6', hp: 320, vel: 0.7, premio: 30, dano: 2,
    resist: { token: 0.25, semantico: 0.4, filtro: 0.5, ruido: 0.3, vetor: 1 },
    regra: 'Bate de frente e nao acontece nada: tiro de alvo unico entra a 25%. Dano em AREA entra inteiro. E o inimigo que ensina para que serve VETOR.',
  },
  pump: {
    nome: 'CRIPTO PUMP', forma: 'estrela', cor: '#ffd447', hp: 40, vel: 0.95, premio: 18, dano: 1,
    cresce: { hp: 0.09, vel: 0.035, teto: 4 },
    regra: 'A cada segundo vivo ganha 9% de HP maximo e 3,5% de velocidade, ate quadruplicar. Deixar para depois e o unico jeito de perder para ele.',
  },
  voador: {
    nome: 'INFERENCIA NA BORDA', forma: 'asa', cor: '#7ee2ff', hp: 130, vel: 1.15, premio: 26, dano: 1,
    voa: true,
    regra: 'Ignora a trilha e vai reto ate o cluster. So torre com antiaereo acerta — e sao poucas.',
  },
  escudo: {
    nome: 'ESCUDO SEMANTICO', forma: 'escudo', cor: '#a8b6ff', hp: 240, vel: 0.85, premio: 28, dano: 1,
    resist: { token: 0.1, vetor: 0.35, filtro: 0.4, ruido: 0.2, semantico: 1 },
    regra: 'Entende o que voce esta tentando fazer e desvia. So dano SEMANTICO entra inteiro; TOKEN entra a 10%.',
  },
  deepfake: {
    nome: 'DEEPFAKE', forma: 'mascara', cor: '#e0d6c0', hp: 115, vel: 1.0, premio: 22, dano: 2,
    disfarce: 0.5,
    regra: 'Entra parecendo usuario legitimo: modelo alinhado se recusa a atirar nele. Na metade da rota ele se revela e fica 80% mais rapido.',
  },
  rlhf: {
    nome: 'CURADOR RLHF', forma: 'cruz', cor: '#9ce89c', hp: 175, vel: 0.8, premio: 25, dano: 1,
    cura: { valor: 16, raio: 2.6 },
    regra: 'Cura 16 HP/s em todas as pragas num raio de 2,6 celulas. Matar o resto antes dele e trabalhar de graca.',
  },
  checkpoint: {
    nome: 'CHECKPOINT', forma: 'ampulheta', cor: '#d0a05c', hp: 205, vel: 1.0, premio: 22, dano: 1,
    volta: { segundos: 9, celulas: 6, cura: 0.4 },
    regra: 'Se ficar 9 segundos sem morrer, ele volta 6 celulas e recupera 40% do HP. Dano espalhado nao resolve: ou mata na janela, ou nao mata.',
  },
  vies: {
    nome: 'VIES', forma: 'balanca', cor: '#ff9ad5', hp: 155, vel: 0.9, premio: 20, dano: 1,
    viesado: true,
    regra: 'So recebe dano de UM tipo, sorteado na onda e escrito no corpo dele. Qualquer outro tipo passa reto. E o inimigo que obriga a ter cobertura dos cinco.',
  },
  overfit: {
    nome: 'OVERFITTING', forma: 'grade', cor: '#b0e07a', hp: 195, vel: 0.85, premio: 24, dano: 1,
    decora: 260,
    regra: 'Depois de levar 260 de dano de um mesmo tipo, fica imune aquele tipo para sempre. Se voce so tem uma torre boa, ele decora ela.',
  },

  // ------------------------------------------------------------- elites
  groque: {
    nome: 'GROQUE', forma: 'caveira', cor: '#ff5c5c', hp: 720, vel: 0.75, premio: 95, dano: 3, elite: true,
    atiraDeVolta: { intervalo: 2.6, raio: 4.5, segundos: 3 },
    regra: 'Atira de volta: a cada 2,6 segundos desliga uma torre no raio de 4,5 celulas por 3 segundos. E comenta no feed.',
  },
  foguete: {
    nome: 'O FOGUETEIRO', forma: 'foguete', cor: '#e8e8f0', hp: 950, vel: 0.6, premio: 130, dano: 3, elite: true,
    despeja: { intervalo: 5.5, hp: 130 },
    regra: 'A cada 5,5 segundos derruba um veiculo numa laje vazia. O destroco tem 130 de HP e ocupa a laje ate voce derrubar.',
  },
  metaverso: {
    nome: 'O METAVERSO', forma: 'oculos', cor: '#6c7bff', hp: 840, vel: 0.9, premio: 120, dano: 3, elite: true,
    piscaAR: { visivel: 4, oculto: 3 },
    regra: 'Passa 4 segundos visivel e 3 segundos em realidade aumentada. Em AR so quem tem deteccao enxerga. Nao morreu ninguem de tedio ainda.',
  },

  // -------------------------------------------------------------- chefes
  colapso: {
    nome: 'MODEL COLLAPSE', forma: 'espiral', cor: '#b46bff', hp: 2400, vel: 0.62, premio: 320, dano: 6, chefe: true,
    renasce: 2,
    regra: 'Ao morrer ele renasce, duas vezes. Cada renascimento tem 60% do HP anterior, 35% mais velocidade e fica imune a mais um tipo de dano — comecando pelo que mais o machucou.',
  },
  altohomem: {
    nome: 'SAM ALTO HOMEM', forma: 'oculos-ceo', cor: '#ffd98a', hp: 5400, vel: 0.5, premio: 520, dano: 8, chefe: true,
    pitch: { intervalo: 9, duracao: 4 },
    regra: 'A cada 9 segundos ele entra em PITCH por 4 segundos: fica invulneravel, promete AGI para daqui a seis meses e invoca 8 bots e 2 alucinacoes. Enquanto ele fala, voce nao machuca ele — so limpa a plateia.',
  },
  scroll: {
    nome: 'SCROLL INFINITO', forma: 'rolo', cor: '#53d6e0', hp: 9200, vel: 0.42, premio: 640, dano: 12, chefe: true,
    regen: 0.034,
    regra: 'Regenera 3,4% do HP maximo por segundo. Dano continuo nao vence essa conta: ou voce concentra tudo numa janela, ou ele nunca cai. Se chegar no cluster, leva 12 vidas.',
  },
  trombeta: {
    nome: 'O TROMBETA', forma: 'muro', cor: '#ff9d3c', hp: 16500, vel: 0.36, premio: 1200, dano: 15, chefe: true,
    muro: { intervalo: 11, hp: 700, altura: 6 },
    regra: 'A cada 11 segundos ele ergue um muro de 6 celulas com 700 de HP. O muro corta o mapa: todo tiro que tentar atravessar bate nele. As torres de tras viram enfeite ate voce derrubar o muro.',
  },
};

export const PRAGA_IDS = Object.keys(PRAGAS);

// --------------------------------------------------------------- habilidades

export const HABILIDADES = [
  {
    id: 'ratelimit',
    nome: 'RATE LIMIT',
    tecla: '1',
    recarga: 42,
    duracao: 3,
    cor: '#6fc8ff',
    desc: 'Devolve 429 para o mundo inteiro: toda praga na tela congela por 3 segundos. Chefe em PITCH tambem congela.',
  },
  {
    id: 'release',
    nome: 'RELEASE DE EMERGENCIA',
    tecla: '2',
    recarga: 95,
    dano: 420,
    cor: '#ff7a5c',
    desc: 'Sobe o hotfix sem revisao: 420 de dano SEMANTICO em tudo que estiver na tela, ignorando resistencia. Depois disso o cluster fica 20% mais lento por 5 segundos.',
  },
  {
    id: 'overclock',
    nome: 'OVERCLOCK',
    tecla: '3',
    recarga: 72,
    duracao: 6,
    ressaca: 7,
    cor: '#ffd166',
    desc: 'Ignora o teto de VRAM e da +55% de cadencia a todas as torres por 6 segundos. Depois a GPU esquenta: -32% de cadencia por 7 segundos.',
  },
];

export const HABILIDADE_POR_ID = Object.fromEntries(HABILIDADES.map(h => [h.id, h]));

// ------------------------------------------------------------ loja do casaco

export const GPU_BASE = 430;
export const GPU_INFLACAO = 1.62;
export const GPU_VRAM = 8;
