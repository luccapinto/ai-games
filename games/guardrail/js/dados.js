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
// Os nomes sao os reais: Llama, Claude, Gemini, Qwen, DeepSeek, GPT. A `familia`
// e o laboratorio que treinou o modelo, e nao um apelido — com o numero real ao
// lado em `real`, o nome real e o que faz a conversao ser conferivel. So as tres
// de infraestrutura tem nome inventado, porque nao sao modelos.
//
// O `glifo` de duas letras aparece dentro do icone da torre (js/icones.js) e a
// `cor` e a da familia; `detalhe` e a cor do unico ponto de destaque do icone, e
// existe porque as tres de infraestrutura dividem a mesma cor de aco.

// -------------------------------------------------------------- tipos de dano

export const DANOS = {
  token: {
    nome: 'TOKEN',
    cor: '#6fc8ff',
    curto: 'TOK',
    desc: 'Dano direto num alvo só. Barato, confiável e inútil contra armadura de volume.',
  },
  vetor: {
    nome: 'VETOR',
    cor: '#b98cff',
    curto: 'VET',
    desc: 'Dano em área. A única coisa que fura armadura de volume, e a única que resolve enxame.',
  },
  semantico: {
    nome: 'SEMÂNTICO',
    cor: '#ffce5c',
    curto: 'SEM',
    desc: 'Entende o contexto. A única coisa que atravessa escudo semântico.',
  },
  filtro: {
    nome: 'FILTRO',
    cor: '#58e3a0',
    curto: 'FIL',
    desc: 'Pouco dano na hora, muito ao longo do tempo. Revela quem está camuflado.',
  },
  ruido: {
    nome: 'RUÍDO',
    cor: '#ff8f6b',
    curto: 'RUI',
    desc: 'Dano fraco, mas deixa o alvo lento e marcado: quem está marcado recebe mais dano de todo mundo.',
  },
};

export const ORDEM_DANOS = ['token', 'vetor', 'semantico', 'filtro', 'ruido'];

// ------------------------------------------------------------ modos de servir
//
// O mesmo modelo, servido de jeito diferente, e outra torre. E o que faz o
// orcamento de compute ser uma decisao e nao uma parede.

export const MODOS = {
  padrao: {
    nome: 'PADRÃO',
    desc: 'Pesos cheios, precisão cheia. O que o cartão de crédito manda.',
    vram: 1, dano: 1, cadencia: 1, mira: 1,
  },
  quantizado: {
    nome: 'QUANTIZADO',
    desc: 'Int4. Cabe em quase metade da VRAM e perde 22% do dano. O truque mais usado do jogo.',
    vram: 0.55, dano: 0.78, cadencia: 1, mira: 1,
  },
  batch: {
    nome: 'BATCH',
    desc: 'Servir em lote: 35% mais cadência, 45% mais VRAM e o primeiro tiro demora mais.',
    vram: 1.45, dano: 1, cadencia: 1.35, mira: 1.25,
  },
  offload: {
    nome: 'OFFLOAD',
    desc: 'Metade dos pesos na RAM do host: 65% menos VRAM, 38% menos cadência e mira quase o dobro.',
    vram: 0.35, dano: 1, cadencia: 0.62, mira: 1.9,
  },
  moe: {
    nome: 'MOE',
    desc: 'Só especialistas ativos na VRAM: metade do consumo, mas um tiro em cada dois roteia para o especialista errado e sai com 55% do dano.',
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
    id: 'llama',
    nome: 'Llama 8B',
    familia: 'Meta',
    classe: 'modelo',
    glifo: 'LL',
    cor: '#8bd97a',
    custo: 55,
    vram: 1,
    dano: 6,
    cadencia: 3.2,
    alcance: 2.6,
    mira: 0.15,
    erro: 0.098,
    tipoDano: 'token',
    frase: 'Roda no seu próprio metal, erra uma em cada dez e não cobra nada por isso.',
    real: {
      preco: 'US$ 0,06 / M tokens', bench: 'MMLU-Pro 48', tps: '310 tok/s',
      ctx: '128 mil tokens', ttft: '0,15 s', aluc: '9,8%', peso: '8B denso',
    },
    caminhos: [
      {
        nome: 'FINE-TUNE',
        desc: 'Treinar no seu próprio domínio: acerta muito mais e bate mais forte.',
        niveis: [
          { custo: 45, texto: 'LoRA de domínio: +4 de dano, erro cai de 9,8% para 6,4%', efeito: { dano: 4, erroMult: 0.65 } },
          { custo: 110, texto: 'Fine-tune completo: +9 de dano, erro cai para 2,9%', efeito: { dano: 9, erroMult: 0.45 } },
          { custo: 260, texto: 'Destilado do modelo grande: +22 de dano, erro 0,9%, dano vira SEMÂNTICO', efeito: { dano: 22, erroMult: 0.3, tipoDano: 'semantico' } },
        ],
      },
      {
        nome: 'ENXAME LOCAL',
        desc: 'Várias cópias pequenas no mesmo card: cadência absurda, dano por tiro ridículo.',
        niveis: [
          { custo: 50, texto: 'Duas réplicas: cadência 3,2 para 4,6 tiros/s, +1 VRAM', efeito: { cadenciaMult: 1.45, vram: 1 } },
          { custo: 125, texto: 'Oito réplicas: cadência para 7,4 tiros/s, +2 VRAM', efeito: { cadenciaMult: 1.6, vram: 2 } },
          { custo: 290, texto: 'Cluster de borda: cadência para 12,6 tiros/s, alcance +0,8, +3 VRAM, e o dano vira RUÍDO — deixa lento e marca o alvo', efeito: { cadenciaMult: 1.7, alcance: 0.8, vram: 3, tipoDano: 'ruido', lentidao: 0.2, marca: 0.18 } },
        ],
      },
    ],
  },
  {
    id: 'haiku',
    nome: 'Claude Haiku 4.5',
    familia: 'Anthropic',
    classe: 'modelo',
    glifo: 'HK',
    cor: '#efa97e',
    custo: 85,
    vram: 2,
    dano: 9,
    cadencia: 2.4,
    alcance: 3.2,
    mira: 0.35,
    erro: 0.042,
    tipoDano: 'token',
    frase: 'Dezessete sílabas por resposta e nenhum minuto perdido pensando.',
    real: {
      preco: 'US$ 1,00 / M tokens', bench: 'MMLU-Pro 63', tps: '180 tok/s',
      ctx: '200 mil tokens', ttft: '0,35 s', aluc: '4,2%', peso: 'não divulgado',
    },
    caminhos: [
      {
        nome: 'CACHE DE PROMPT',
        desc: 'O prefixo já está quente: a mira quase some e a cadência dispara.',
        niveis: [
          { custo: 60, texto: 'Cache de 5 min: mira de 0,35 s para 0,14 s, cadência +18%', efeito: { miraMult: 0.4, cadenciaMult: 1.18 } },
          { custo: 140, texto: 'Cache de 1 h: cadência +35%, sem tempo de mira nenhum', efeito: { cadenciaMult: 1.35, miraMult: 0.1 } },
          { custo: 320, texto: 'Cache compartilhado: cadência +45% e o alcance passa a 4,4 células', efeito: { cadenciaMult: 1.45, alcance: 1.2 } },
        ],
      },
      {
        nome: 'SAÍDA ESTRUTURADA',
        desc: 'Gramática obrigatória na saída: tiro mais pesado e que atravessa.',
        niveis: [
          { custo: 70, texto: 'JSON forçado: +7 de dano, o tiro atravessa 1 inimigo', efeito: { dano: 7, perfura: 1 } },
          { custo: 165, texto: 'Esquema tipado: +16 de dano, atravessa 2, alcance +0,5', efeito: { dano: 16, perfura: 1, alcance: 0.5 } },
          { custo: 380, texto: 'Chamada de ferramenta: +34 de dano, atravessa 4 e o dano vira VETOR com raio 0,9', efeito: { dano: 34, perfura: 2, tipoDano: 'vetor', area: 0.9, vram: 2 } },
        ],
      },
    ],
  },
  {
    id: 'gemini',
    nome: 'Gemini Flash',
    familia: 'Google',
    classe: 'modelo',
    glifo: 'GE',
    cor: '#4c8df6',
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
    frase: 'Um milhão de tokens de contexto: vê o mapa quase inteiro de onde estiver.',
    real: {
      preco: 'US$ 0,30 / M tokens', bench: 'MMLU-Pro 71', tps: '250 tok/s',
      ctx: '1 milhão de tokens', ttft: '0,28 s', aluc: '5,1%', peso: 'MoE, ativos não divulgados',
    },
    caminhos: [
      {
        nome: 'JANELA DE DOIS MILHÕES',
        desc: 'Contexto e alcance são a mesma coisa aqui. Esta é a torre que cobre o mapa.',
        niveis: [
          { custo: 95, texto: 'Alcance de 5,4 para 6,6 células', efeito: { alcance: 1.2 } },
          { custo: 210, texto: 'Alcance para 8,2 células, raio da área para 1,3', efeito: { alcance: 1.6, area: 0.4 } },
          { custo: 470, texto: 'Alcance para 11 células (meio mapa), área 1,8 e +12 de dano', efeito: { alcance: 2.8, area: 0.5, dano: 12, vram: 3 } },
        ],
      },
      {
        nome: 'MULTIMODAL',
        desc: 'Vê imagem, vídeo e o que finge não estar ali. Ganha detecção e tiro antiaéreo.',
        niveis: [
          { custo: 110, texto: 'Visão: passa a enxergar camuflado E a acertar voador', efeito: { deteccao: true, antiaereo: true } },
          { custo: 230, texto: 'Vídeo: +16 de dano e alcance +0,6', efeito: { dano: 16, alcance: 0.6 } },
          { custo: 500, texto: 'Áudio e vídeo ao vivo: +24 de dano, cadência +30% e revela camuflado num raio de 3 células para todas as torres', efeito: { dano: 24, cadenciaMult: 1.3, revela: 3, vram: 2 } },
        ],
      },
    ],
  },
  {
    id: 'qwen',
    nome: 'Qwen 3 VL',
    familia: 'Alibaba',
    classe: 'modelo',
    glifo: 'QW',
    cor: '#a855f7',
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
    antiaereo: true,
    moe: true,
    frase: 'Lê placa, print, meme, o que o usuário jurou que não mandou e o que passa voando. Já vem com detecção e antiaéreo.',
    real: {
      preco: 'US$ 0,45 / M tokens', bench: 'MMLU-Pro 68', tps: '140 tok/s',
      ctx: '256 mil tokens', ttft: '0,50 s', aluc: '6,4%', peso: 'MoE 235B, 22B ativos',
    },
    caminhos: [
      {
        nome: 'CLASSIFICADOR',
        desc: 'Mais veneno por segundo e uma marca que faz todo mundo bater mais forte.',
        niveis: [
          { custo: 90, texto: 'Dano contínuo de 9 para 17 por segundo', efeito: { dot: 8 } },
          { custo: 200, texto: 'Contínuo para 30 por segundo, e o alvo fica 25% mais lento', efeito: { dot: 13, lentidao: 0.25 } },
          { custo: 430, texto: 'Contínuo para 54 por segundo, lentidão 40% e o alvo marcado recebe +30% de dano de qualquer torre', efeito: { dot: 24, lentidao: 0.15, marca: 0.3 } },
        ],
      },
      {
        nome: 'OCR DE PLACA',
        desc: 'Vê tudo que passa, inclusive o que voa e o que está em realidade aumentada.',
        niveis: [
          { custo: 100, texto: '+7 de dano e alcance de 3,6 para 4,3 células', efeito: { dano: 7, alcance: 0.7 } },
          { custo: 215, texto: 'Revela camuflado num raio de 3,5 células para todas as torres', efeito: { revela: 3.5 } },
          { custo: 460, texto: 'Revela num raio de 5,5, +18 de dano e ignora recusa (o alinhado ao lado volta a atirar)', efeito: { revela: 2, dano: 18, auraIgnoraRecusa: 3 } },
        ],
      },
    ],
  },
  {
    id: 'sonnet',
    nome: 'Claude Sonnet 4.5',
    familia: 'Anthropic',
    classe: 'modelo',
    glifo: 'SN',
    cor: '#d9662b',
    custo: 240,
    vram: 5,
    dano: 21,
    cadencia: 1.5,
    alcance: 3.4,
    mira: 0.6,
    erro: 0.021,
    tipoDano: 'semantico',
    recusa: true,
    frase: 'A menor taxa de alucinação do mercado. Em troca, se recusa a atirar em quem ainda parece inocente.',
    real: {
      preco: 'US$ 3,00 / M tokens', bench: 'MMLU-Pro 82', tps: '95 tok/s',
      ctx: '200 mil tokens', ttft: '0,60 s', aluc: '2,1%', peso: 'não divulgado',
    },
    caminhos: [
      {
        nome: 'CONSTITUIÇÃO',
        desc: 'Publica os princípios e as torres em volta passam a errar menos. Continua recusando.',
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
          { custo: 310, texto: 'Três alvos por salva, +18 de dano', efeito: { alvos: 1, dano: 18 } },
          { custo: 680, texto: 'Cinco alvos por salva, +40 de dano e cadência +25%', efeito: { alvos: 2, dano: 40, cadenciaMult: 1.25, vram: 3 } },
        ],
      },
    ],
  },
  {
    id: 'deepseek',
    nome: 'DeepSeek R1',
    familia: 'DeepSeek',
    classe: 'modelo',
    glifo: 'DS',
    cor: '#12a17c',
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
        desc: 'Mais tokens de raciocínio: o tiro vira um evento, e demora ainda mais para sair.',
        niveis: [
          { custo: 120, texto: '+38 de dano, mas a mira sobe de 2,4 s para 3,1 s', efeito: { dano: 38, miraMult: 1.3 } },
          { custo: 280, texto: '+92 de dano, mira 3,7 s, o tiro atravessa 3 inimigos', efeito: { dano: 92, miraMult: 1.2, perfura: 3 } },
          { custo: 640, texto: '+240 de dano, mira 4,4 s, atravessa 6 e vira VETOR com raio 1,6', efeito: { dano: 240, miraMult: 1.2, perfura: 3, tipoDano: 'vetor', area: 1.6, vram: 4 } },
        ],
      },
      {
        nome: 'DESTILAÇÃO',
        desc: 'O raciocínio vira peso: quase toda a demora some, e boa parte da VRAM junto.',
        niveis: [
          { custo: 130, texto: 'Mira de 2,4 s para 1,1 s, cadência +60%, -2 VRAM, -8 de dano', efeito: { miraMult: 0.45, cadenciaMult: 1.6, vram: -2, dano: -8 } },
          { custo: 300, texto: 'Mira 0,5 s, cadência +55%, -2 VRAM, erro cai pela metade', efeito: { miraMult: 0.45, cadenciaMult: 1.55, vram: -2, erroMult: 0.5 } },
          { custo: 660, texto: 'Mira 0,2 s, cadência +50%, +30 de dano e 2 alvos por salva', efeito: { miraMult: 0.4, cadenciaMult: 1.5, dano: 30, alvos: 1 } },
        ],
      },
    ],
  },
  {
    id: 'gpt',
    nome: 'GPT-5',
    familia: 'OpenAI',
    classe: 'modelo',
    glifo: 'G5',
    cor: '#cfe7f2',
    custo: 360,
    vram: 8,
    dano: 30,
    cadencia: 1.7,
    alcance: 4.2,
    mira: 0.7,
    erro: 0.028,
    tipoDano: 'token',
    perfura: 2,
    antiaereo: true,
    moe: true,
    frase: 'O topo do quadro. Cobra por isso é atravessa dois inimigos por tiro.',
    real: {
      preco: 'US$ 1,25 / M tokens', bench: 'MMLU-Pro 87', tps: '110 tok/s',
      ctx: '400 mil tokens', ttft: '0,70 s', aluc: '2,8%', peso: 'MoE, tamanho não divulgado',
    },
    caminhos: [
      {
        nome: 'ROTEADOR AUTOMÁTICO',
        desc: 'Escolhe o tipo de dano que o alvo menos resiste. Não é o mais forte: é o que nunca está errado.',
        niveis: [
          { custo: 170, texto: 'Alterna TOKEN e SEMÂNTICO conforme o alvo, +10 de dano', efeito: { dano: 10, roteador: ['token', 'semantico'] } },
          { custo: 380, texto: 'Entra VETOR na rotação (raio 1,1), +26 de dano', efeito: { dano: 26, area: 1.1, roteador: ['token', 'semantico', 'vetor'] } },
          { custo: 820, texto: 'Os cinco tipos na rotação, +70 de dano, detecção e antiaéreo', efeito: { dano: 70, roteador: ['token', 'semantico', 'vetor', 'filtro', 'ruido'], deteccao: true, antiaereo: true, dot: 22, vram: 3 } },
        ],
      },
      {
        nome: 'RACIOCÍNIO ALTO',
        desc: 'Sobe o esforço de raciocínio: dano de chefe, cadência de tartaruga.',
        niveis: [
          { custo: 180, texto: '+52 de dano, cadência de 1,7 para 1,2 tiros/s', efeito: { dano: 52, cadenciaMult: 0.72 } },
          { custo: 400, texto: '+130 de dano, cadência 0,9, atravessa 4', efeito: { dano: 130, cadenciaMult: 0.75, perfura: 2 } },
          { custo: 880, texto: '+340 de dano, cadência 0,7, atravessa 8 e ignora 50% de toda resistência', efeito: { dano: 340, cadenciaMult: 0.78, perfura: 4, furaResist: 0.5, vram: 4 } },
        ],
      },
    ],
  },
  {
    id: 'opus',
    nome: 'Claude Opus 4.6',
    familia: 'Anthropic',
    classe: 'modelo',
    glifo: 'OP',
    cor: '#c9531f',
    detalhe: '#f7c948',
    custo: 560,
    vram: 10,
    dano: 62,
    cadencia: 1.1,
    alcance: 4.8,
    mira: 1.1,
    erro: 0.014,
    tipoDano: 'semantico',
    area: 1.2,
    antiaereo: true,
    frase: 'Quinze dólares por milhão de tokens. Se você chegou aqui, é porque nada mais resolveu.',
    real: {
      preco: 'US$ 15,00 / M tokens', bench: 'MMLU-Pro 89', tps: '68 tok/s',
      ctx: '500 mil tokens', ttft: '1,10 s', aluc: '1,4%', peso: 'não divulgado',
    },
    caminhos: [
      {
        nome: 'AGENTE LONGO',
        desc: 'Quanto mais tempo no mesmo alvo, mais forte bate. Feito para chefe.',
        niveis: [
          { custo: 260, texto: 'Cada segundo no mesmo alvo soma +22% de dano, até +100%', efeito: { crescimento: 0.22, crescimentoTeto: 1.0 } },
          { custo: 560, texto: 'Até +220% de dano acumulado, +40 de dano base', efeito: { crescimentoTeto: 1.2, dano: 40 } },
          { custo: 1150, texto: 'Até +450% acumulado, +120 de dano e o acúmulo não zera ao trocar de alvo', efeito: { crescimentoTeto: 2.3, dano: 120, crescimentoFixo: true, vram: 4 } },
        ],
      },
      {
        nome: 'SUBAGENTES',
        desc: 'Abre vários agentes de uma vez: para de ser uma torre e vira três.',
        niveis: [
          { custo: 280, texto: '3 alvos por salva, raio da área de 1,2 para 1,5', efeito: { alvos: 2, area: 0.3 } },
          { custo: 600, texto: '5 alvos por salva, +45 de dano, cadência +20%', efeito: { alvos: 2, dano: 45, cadenciaMult: 1.2 } },
          { custo: 1220, texto: '9 alvos por salva, +110 de dano, cadência +30% e área 2,2', efeito: { alvos: 4, dano: 110, cadenciaMult: 1.3, area: 0.7, vram: 6 } },
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
    cor: '#9aaec4',
    detalhe: '#7fe0a8',
    custo: 190,
    vram: 0,
    capacidade: 7,
    alcance: 3.0,
    naoAtira: true,
    frase: 'Não atira em nada. Em compensação, o cluster para de derreter: +7 de VRAM e quem está no raio dela não sofre estrangulamento.',
    real: {
      preco: 'contrato anual', bench: 'não participa de benchmark', tps: '0 tok/s',
      ctx: 'a política inteira', ttft: 'nunca responde', aluc: '0%', peso: 'uma sala com ar condicionado',
    },
    caminhos: [
      {
        nome: 'REFRIGERAÇÃO LÍQUIDA',
        desc: 'Mais teto de VRAM. A decisão mais chata e mais importante do jogo.',
        niveis: [
          { custo: 150, texto: 'Capacidade de +7 para +12 de VRAM', efeito: { capacidade: 5 } },
          { custo: 330, texto: 'Capacidade +20, raio de proteção 4,2', efeito: { capacidade: 8, alcance: 1.2 } },
          { custo: 720, texto: 'Capacidade +34 e o estrangulamento do cluster inteiro cai pela metade', efeito: { capacidade: 14, amorteceEstrangulamento: 0.5 } },
        ],
      },
      {
        nome: 'AUDITORIA',
        desc: 'Vira sala de log: as torres em volta enxergam camuflado e param de errar.',
        niveis: [
          { custo: 160, texto: 'Sala de log: as torres no raio passam a enxergar camuflado E a acertar voador', efeito: { auraDeteccao: true, auraAntiaereo: true, auraRaio: 0.5 } },
          { custo: 350, texto: 'Torres no raio erram 70% menos e batem 15% mais forte', efeito: { auraErro: 0.7, auraDano: 0.15 } },
          { custo: 760, texto: 'Raio 5,4, +28% de dano, e as torres no raio não podem ser corrompidas por prompt injection', efeito: { alcance: 2.4, auraDano: 0.13, auraImune: true } },
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
    cor: '#9aaec4',
    detalhe: '#7ed8f0',
    custo: 170,
    vram: 2,
    alcance: 2.6,
    naoAtira: true,
    auraCadencia: 0.3,
    frase: 'Um roteador na frente de tudo: +30% de cadência em quem estiver no raio.',
    real: {
      preco: 'US$ 0,02 / M tokens de roteamento', bench: 'não aplicável', tps: 'repassa 100%',
      ctx: 'a fila inteira', ttft: '0,02 s', aluc: '0%', peso: 'um proxy',
    },
    caminhos: [
      {
        nome: 'PARALELISMO',
        desc: 'Mais fila em paralelo: a aura de cadência cresce e o raio também.',
        niveis: [
          { custo: 130, texto: 'Aura de cadência de +30% para +52%, raio 3,4', efeito: { auraCadencia: 0.22, alcance: 0.8 } },
          { custo: 290, texto: 'Aura +80%, raio 4,2', efeito: { auraCadencia: 0.28, alcance: 0.8 } },
          { custo: 640, texto: 'Aura +130%, raio 5,4 e as torres no raio ignoram o tempo de mira', efeito: { auraCadencia: 0.5, alcance: 1.2, auraSemMira: true, vram: 3 } },
        ],
      },
      {
        nome: 'ROTEAMENTO SEMÂNTICO',
        desc: 'Manda cada pedido para quem resolve: a aura troca cadência por dano e alcance.',
        niveis: [
          { custo: 140, texto: 'Aura passa a dar +26% de dano além da cadência', efeito: { auraDano: 0.26 } },
          { custo: 310, texto: 'Aura de dano +50%, e as torres no raio ganham +0,8 de alcance', efeito: { auraDano: 0.24, auraAlcance: 0.8 } },
          { custo: 690, texto: 'Aura de dano +90%, alcance +1,6 e as torres no raio ignoram 30% de resistência', efeito: { auraDano: 0.4, auraAlcance: 0.8, auraFuraResist: 0.3, vram: 3 } },
        ],
      },
    ],
  },
  {
    id: 'cobranca',
    nome: 'COBRANÇA',
    familia: 'Infraestrutura',
    classe: 'infra',
    glifo: 'CB',
    cor: '#9aaec4',
    detalhe: '#e3d26a',
    custo: 160,
    vram: 1,
    alcance: 2.8,
    naoAtira: true,
    rendaOnda: 26,
    frase: 'A única torre que não machuca ninguém: fatura US$ 26 no fim de cada onda. Toda moeda gasta nela é uma torre a menos na parede.',
    real: {
      preco: 'US$ 0,00 — ela cobra, não paga', bench: 'não aplicável', tps: 'não gera token',
      ctx: 'o cartão do cliente', ttft: 'a fatura chega dia 1', aluc: '0%', peso: 'uma planilha',
    },
    caminhos: [
      {
        nome: 'PLANO ANUAL',
        desc: 'Renda fixa e crescente por onda. Paga no longo prazo, e o longo prazo pode não chegar.',
        niveis: [
          { custo: 120, texto: 'Renda por onda de US$ 26 para US$ 58', efeito: { rendaOnda: 32 } },
          { custo: 270, texto: 'Renda por onda para US$ 122', efeito: { rendaOnda: 64 } },
          { custo: 590, texto: 'Renda por onda para US$ 250 e +3 de capacidade de VRAM (crédito de nuvem)', efeito: { rendaOnda: 128, capacidade: 3 } },
        ],
      },
      {
        nome: 'MICROTRANSAÇÃO',
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
// mostra o de sempre: oito Llama quantizadas ganham o jogo e as outras dez
// torres viram enfeite. Variar tem que ser mais barato que empilhar.
export const INFLACAO = 1.25;
export const RETORNO_VENDA = 0.6;

// ------------------------------------------------------------------ as pragas
//
// `resist` e multiplicador de dano recebido por tipo: 1 = normal, 0,2 = recebe
// 20%. O que nao esta listado e 1.

export const PRAGAS = {
  alucinacao: {
    nome: 'ALUCINAÇÃO', forma: 'gota', cor: '#c9a0ff', hp: 26, vel: 1.35, premio: 7, dano: 1,
    falsaChance: 0.35,
    regra: 'Uma em cada três é falsa: some no primeiro dano e não paga nada. Você gastou tiro numa coisa que nunca existiu.',
  },
  botfarm: {
    nome: 'BOT FARM', forma: 'quadrado', cor: '#8a97a8', hp: 9, vel: 1.6, premio: 2, dano: 1,
    cargaVram: 0.14,
    regra: 'Vem às dezenas e morre de qualquer jeito. O problema não é matar: cada bot vivo come 0,14 de VRAM do seu cluster.',
  },
  golpe: {
    nome: 'GOLPE', forma: 'losango', cor: '#ff7a5c', hp: 52, vel: 1.5, premio: 12, dano: 1,
    roubo: 3,
    resist: { token: 1, semantico: 0.45, vetor: 0.55, filtro: 0.45, ruido: 0.6 },
    regra: 'Nos últimos 25% da rota ele encosta no caixa e leva US$ 3 por segundo. É burro demais para o modelo sofisticado levar a sério: o classificador grande passa batido e só o TOKEN cru entra inteiro. Matar longe da base e matar de graça.',
  },
  injection: {
    nome: 'PROMPT INJECTION', forma: 'seta', cor: '#ff5ca8', hp: 62, vel: 1.1, premio: 14, dano: 1,
    corrompe: 4,
    regra: 'Ao passar a menos de 1,3 célula de uma torre, vira ela contra você por 4 segundos: ela para de atirar e passa a curar 12 HP/s das pragas em volta.',
  },
  camuflado: {
    nome: 'MODO ANÔNIMO', forma: 'hexagono', cor: '#5b6b7c', hp: 92, vel: 1.25, premio: 19, dano: 1,
    camuflado: true,
    regra: 'Invisível para quem não tem detecção. Dano de FILTRO revela por 4 segundos, e depois ele some de novo.',
  },
  fork: {
    nome: 'FORK', forma: 'triangulo', cor: '#63d2a4', hp: 140, vel: 1.0, premio: 16, dano: 1,
    divide: 2, geracoes: 2,
    regra: 'Ao morrer, divide em 2 cópias com metade do HP. As cópias também dividem, uma vez só. Matar um vira matar sete.',
  },
  blindado: {
    nome: 'ARMADURA DE VOLUME', forma: 'octogono', cor: '#7f8fa6', hp: 320, vel: 0.7, premio: 30, dano: 2,
    resist: { token: 0.25, semantico: 0.4, filtro: 0.5, ruido: 0.3, vetor: 1 },
    regra: 'Bate de frente e não acontece nada: tiro de alvo único entra a 25%. Dano em ÁREA entra inteiro. É o inimigo que ensina para que serve VETOR.',
  },
  pump: {
    nome: 'CRIPTO PUMP', forma: 'estrela', cor: '#ffd447', hp: 40, vel: 0.95, premio: 18, dano: 1,
    cresce: { hp: 0.09, vel: 0.035, teto: 4 },
    regra: 'A cada segundo vivo ganha 9% de HP máximo e 3,5% de velocidade, até quadruplicar. Deixar para depois é o único jeito de perder para ele.',
  },
  voador: {
    nome: 'INFERÊNCIA NA BORDA', forma: 'asa', cor: '#7ee2ff', hp: 155, vel: 0.85, premio: 30, dano: 1,
    voa: true,
    regra: 'Ignora a trilha e corta o mapa reto até o cluster. Só torre com antiaéreo acerta: Qwen 3 VL, GPT-5 e Claude Opus 4.6 já vem com ele, Gemini Flash compra no MULTIMODAL.',
  },
  escudo: {
    nome: 'ESCUDO SEMÂNTICO', forma: 'escudo', cor: '#a8b6ff', hp: 240, vel: 0.85, premio: 28, dano: 1,
    resist: { token: 0.1, vetor: 0.35, filtro: 0.4, ruido: 0.2, semantico: 1 },
    regra: 'Entende o que você está tentando fazer e desvia. Só dano SEMÂNTICO entra inteiro; TOKEN entra a 10%.',
  },
  deepfake: {
    nome: 'DEEPFAKE', forma: 'mascara', cor: '#e0d6c0', hp: 118, vel: 1.0, premio: 22, dano: 2,
    disfarce: 0.5,
    resist: { ruido: 1, token: 0.5, semantico: 0.6, vetor: 0.5, filtro: 0.7 },
    regra: 'Entra parecendo usuário legítimo: modelo alinhado se recusa a atirar nele. Na metade da rota ele se revela e fica 80% mais rápido. Analisar o conteúdo não adianta, porque o conteúdo e perfeito: o que quebra o gerador e RUÍDO adversarial na entrada.',
  },
  oom: {
    nome: 'OOM KILLER', forma: 'chip', cor: '#ff6fd8', hp: 260, vel: 0.8, premio: 34, dano: 2,
    capturaVram: 2.2,
    regra: 'Enquanto está vivo ele ocupa 2,2 do teto do seu cluster — não do consumo, do teto. Seis deles na tela derrubam 13 de capacidade e estrangulam tudo que você construiu. Ou você quantiza no meio da onda, ou mata rápido.',
  },
  rlhf: {
    nome: 'CURADOR RLHF', forma: 'cruz', cor: '#9ce89c', hp: 175, vel: 0.8, premio: 25, dano: 1,
    cura: { valor: 16, raio: 2.6 },
    regra: 'Cura 16 HP/s em todas as pragas num raio de 2,6 células. Matar o resto antes dele é trabalhar de graça.',
  },
  checkpoint: {
    nome: 'CHECKPOINT', forma: 'ampulheta', cor: '#d0a05c', hp: 205, vel: 1.0, premio: 22, dano: 1,
    volta: { segundos: 9, celulas: 6, cura: 0.4 },
    regra: 'Se ficar 9 segundos sem morrer, ele volta 6 células e recupera 40% do HP. Dano espalhado não resolve: ou mata na janela, ou não mata.',
  },
  vies: {
    nome: 'VIÉS', forma: 'balanca', cor: '#ff9ad5', hp: 155, vel: 0.9, premio: 20, dano: 1,
    viesado: true,
    regra: 'Só recebe dano de UM tipo, sorteado na onda e escrito no corpo dele. Qualquer outro tipo passa reto. É o inimigo que obriga a ter cobertura dos cinco.',
  },
  overfit: {
    nome: 'OVERFITTING', forma: 'grade', cor: '#b0e07a', hp: 195, vel: 0.85, premio: 24, dano: 1,
    decora: 260,
    regra: 'Depois de levar 260 de dano de um mesmo tipo, fica imune àquele tipo para sempre. Se você só tem uma torre boa, ele decora ela.',
  },

  // ------------------------------------------------------------- elites
  groque: {
    nome: 'GROQUE', forma: 'caveira', cor: '#ff5c5c', hp: 720, vel: 0.75, premio: 95, dano: 3, elite: true,
    atiraDeVolta: { intervalo: 2.6, raio: 4.5, segundos: 3 },
    regra: 'Atira de volta: a cada 2,6 segundos desliga uma torre no raio de 4,5 células por 3 segundos. E comenta no feed.',
  },
  foguete: {
    nome: 'O FOGUETEIRO', forma: 'foguete', cor: '#e8e8f0', hp: 950, vel: 0.6, premio: 130, dano: 3, elite: true,
    despeja: { intervalo: 5.5, hp: 130 },
    regra: 'A cada 5,5 segundos derruba um veículo numa laje vazia. O destroço tem 130 de HP e ocupa a laje até você derrubar.',
  },
  reptiliano: {
    nome: 'O REPTILIANO', forma: 'oculos', cor: '#6c7bff', hp: 840, vel: 0.9, premio: 120, dano: 3, elite: true,
    pisca: { visivel: 4, oculto: 3 },
    regra: 'Passa 4 segundos visível e 3 segundos fora do espectro. Enquanto está camuflado só quem tem detecção enxerga. Ele nega ser réptil e nega com os óculos escuros.',
  },

  // -------------------------------------------------------------- chefes
  colapso: {
    nome: 'MODEL COLLAPSE', forma: 'espiral', cor: '#b46bff', hp: 2400, vel: 0.62, premio: 320, dano: 6, chefe: true,
    renasce: 2,
    regra: 'Ao morrer ele renasce, duas vezes. Cada renascimento tem 60% do HP anterior, 35% mais velocidade e fica imune a mais um tipo de dano — começando pelo que mais o machucou.',
  },
  altohomem: {
    nome: 'SAM ALTO HOMEM', forma: 'oculos-ceo', cor: '#ffd98a', hp: 5400, vel: 0.5, premio: 520, dano: 8, chefe: true,
    pitch: { intervalo: 9, duracao: 4 },
    regra: 'A cada 9 segundos ele entra em PITCH por 4 segundos: fica invulnerável, promete AGI para daqui a seis meses e invoca 8 bots e 2 alucinações. Enquanto ele fala, você não machuca ele — só limpa a plateia.',
  },
  scroll: {
    nome: 'SCROLL INFINITO', forma: 'rolo', cor: '#53d6e0', hp: 9200, vel: 0.42, premio: 640, dano: 12, chefe: true,
    regen: 0.034,
    regra: 'Regenera 3,4% do HP máximo por segundo. Dano contínuo não vence essa conta: ou você concentra tudo numa janela, ou ele nunca cai. Se chegar no cluster, leva 12 vidas.',
  },
  laranja: {
    nome: 'O LARANJA', forma: 'muro', cor: '#ff9d3c', hp: 16500, vel: 0.36, premio: 1200, dano: 15, chefe: true,
    muro: { intervalo: 11, hp: 700, altura: 6 },
    regra: 'A cada 11 segundos ele ergue um muro de 6 células com 700 de HP. O muro corta o mapa: todo tiro que tentar atravessar bate nele. As torres de trás viram enfeite até você derrubar o muro.',
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
    desc: 'Devolve 429 para o mundo inteiro: toda praga na tela congela por 3 segundos. Chefe em PITCH também congela.',
  },
  {
    id: 'release',
    nome: 'RELEASE DE EMERGÊNCIA',
    tecla: '2',
    recarga: 95,
    dano: 420,
    cor: '#ff7a5c',
    desc: 'Sobe o hotfix sem revisão: 420 de dano SEMÂNTICO em tudo que estiver na tela, ignorando resistência. Depois disso o cluster fica 20% mais lento por 5 segundos.',
  },
  {
    id: 'overclock',
    nome: 'OVERCLOCK',
    tecla: '3',
    recarga: 72,
    duracao: 6,
    ressaca: 7,
    cor: '#ffd166',
    desc: 'Ignora o teto de VRAM e dá +55% de cadência a todas as torres por 6 segundos. Depois a GPU esquenta: -32% de cadência por 7 segundos.',
  },
];

export const HABILIDADE_POR_ID = Object.fromEntries(HABILIDADES.map(h => [h.id, h]));

// ------------------------------------------------------------ loja do casaco

export const GPU_BASE = 430;
export const GPU_INFLACAO = 1.62;
export const GPU_VRAM = 8;
