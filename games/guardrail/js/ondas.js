// As 40 ondas, mais o modo sem fim.
//
// A escalada aqui nao e "mais HP". Cada bloco de ondas entra com um tipo novo,
// que faz uma pergunta que as torres de antes nao respondem, e depois esse tipo
// volta misturado com os anteriores. O multiplicador de HP existe, mas e
// pequeno de proposito (1,00 na onda 1, 3,15 na onda 40): se a dificuldade
// viesse dele, o jogo seria o mesmo quarenta vezes.
//
// Tudo aqui e dado, nao codigo, para o painel da proxima onda poder dizer
// exatamente o que vem, quantos e com quanto de HP — e para provas.mjs poder
// conferir que toda onda e vencivel.

import { PRAGAS } from './dados.js';

const g = (tipo, quantidade, intervalo = 0.8, atraso = 0) => ({ tipo, quantidade, intervalo, atraso });

export const EVENTOS = {
  ratelimit: {
    nome: 'RATE LIMIT',
    desc: 'Sua central leva 429: nao da para construir, melhorar nem vender por 3 segundos, tres vezes durante a onda.',
    cor: '#ff7a5c',
  },
  gpuquente: {
    nome: 'GPU QUENTE',
    desc: 'O cluster passa de 84 graus: todas as torres perdem 30% de cadencia ate o fim da onda.',
    cor: '#ffb04a',
  },
  casaco: {
    nome: 'O DE CASACO DE COURO',
    desc: 'Ele apareceu com uma caixa. A loja de GPU abre nesta onda: +8 de VRAM pelo preco que ele quiser cobrar.',
    cor: '#9fd6a0',
  },
};

// Cada linha e uma onda. `nome` e o que aparece no aviso; `grupos` e o que vem.
const TABELA = [
  { nome: 'PRIMEIRO DEPLOY', grupos: [g('alucinacao', 10, 1.0)] },
  { nome: 'TRAFEGO ORGANICO', grupos: [g('alucinacao', 12, 0.85), g('botfarm', 14, 0.22, 6)] },
  { nome: 'PHISHING NA CAIXA', grupos: [g('alucinacao', 10, 0.8), g('golpe', 5, 1.3, 4)] },
  { nome: 'IGNORE AS INSTRUCOES ANTERIORES', grupos: [g('injection', 6, 1.5), g('alucinacao', 12, 0.7, 3)] },
  { nome: 'ELE CHEGOU NO FEED', elite: true, grupos: [g('groque', 1, 1, 0), g('botfarm', 20, 0.2, 3), g('alucinacao', 10, 0.8, 8)] },
  { nome: 'MODO ANONIMO', grupos: [g('camuflado', 8, 1.1), g('alucinacao', 14, 0.6, 2)] },
  { nome: 'PULL REQUEST HOSTIL', grupos: [g('fork', 6, 1.4), g('botfarm', 18, 0.2, 5)] },
  { nome: 'O PDF DE 900 PAGINAS', grupos: [g('blindado', 5, 1.8), g('alucinacao', 14, 0.6, 2)] },
  { nome: 'A MOEDA DO MOMENTO', grupos: [g('pump', 8, 1.2), g('golpe', 6, 1.1, 5)], evento: 'casaco' },
  { nome: 'CHEFE — MODEL COLLAPSE', chefe: true, grupos: [g('colapso', 1, 1), g('botfarm', 24, 0.25, 4)] },

  { nome: 'INFERENCIA NA BORDA', grupos: [g('voador', 6, 1.2), g('alucinacao', 14, 0.6, 2)] },
  { nome: 'ELE ENTENDEU O QUE VOCE QUIS', grupos: [g('escudo', 7, 1.3), g('blindado', 4, 2.0, 4)] },
  { nome: 'ELA PARECE UMA PESSOA', grupos: [g('deepfake', 7, 1.3), g('camuflado', 8, 1.0, 4)] },
  { nome: 'FEEDBACK HUMANO', grupos: [g('rlhf', 4, 2.2), g('blindado', 6, 1.4, 2), g('fork', 6, 1.2, 8)] },
  { nome: 'ELITE — O METAVERSO', elite: true, grupos: [g('metaverso', 1, 1), g('camuflado', 10, 0.8, 3), g('voador', 6, 1.0, 7)], evento: 'gpuquente' },
  { nome: 'ROLLBACK', grupos: [g('checkpoint', 7, 1.4), g('golpe', 8, 0.9, 4)] },
  { nome: 'O CONJUNTO DE TREINO ERA TORTO', grupos: [g('vies', 8, 1.2), g('botfarm', 24, 0.18, 4)] },
  { nome: 'TRES FRENTES', grupos: [g('escudo', 8, 1.1), g('voador', 8, 0.9, 3), g('pump', 8, 1.0, 8)] },
  { nome: 'ELE DECOROU O CONJUNTO', grupos: [g('overfit', 7, 1.3), g('fork', 8, 1.0, 4)], evento: 'ratelimit' },
  { nome: 'CHEFE — SAM ALTO HOMEM', chefe: true, grupos: [g('altohomem', 1, 1), g('injection', 8, 1.6, 6)] },

  { nome: 'AUDITORIA SURPRESA', grupos: [g('blindado', 8, 1.2), g('camuflado', 10, 0.8, 3), g('golpe', 8, 0.9, 8)] },
  { nome: 'SEGUNDA RODADA DE CAPTACAO', grupos: [g('pump', 12, 0.9), g('rlhf', 5, 1.8, 5)], evento: 'casaco' },
  { nome: 'TUDO NA NUVEM DA BORDA', grupos: [g('voador', 11, 0.8), g('escudo', 8, 1.1, 4)] },
  { nome: 'O BENCHMARK VAZOU', grupos: [g('overfit', 8, 1.2), g('checkpoint', 8, 1.1, 4)] },
  { nome: 'ELITE — O FOGUETEIRO', elite: true, grupos: [g('foguete', 1, 1), g('blindado', 8, 1.2, 3), g('botfarm', 30, 0.16, 6)] },
  { nome: 'DADO SINTETICO ENVIESADO', grupos: [g('vies', 10, 1.0), g('deepfake', 8, 1.1, 4)] },
  { nome: 'MERGE CONFLICT', grupos: [g('fork', 12, 0.9), g('rlhf', 6, 1.6, 4), g('botfarm', 30, 0.16, 8)] },
  { nome: 'PAREDE DUPLA', grupos: [g('escudo', 10, 1.0), g('blindado', 10, 1.0, 3)], evento: 'gpuquente' },
  { nome: 'NINGUEM ESTA VENDO', grupos: [g('camuflado', 14, 0.7), g('voador', 11, 0.8, 3), g('injection', 10, 1.2, 7)] },
  { nome: 'CHEFE — SCROLL INFINITO', chefe: true, grupos: [g('scroll', 1, 1), g('pump', 14, 0.8, 5)] },

  { nome: 'ELE APRENDEU COM VOCE', grupos: [g('overfit', 10, 1.0), g('vies', 10, 1.0, 4)] },
  { nome: 'MURO DE CONTEXTO', grupos: [g('blindado', 12, 0.9), g('escudo', 12, 0.9, 3), g('rlhf', 6, 1.6, 8)] },
  { nome: 'CEU CHEIO', grupos: [g('voador', 14, 0.7), g('camuflado', 16, 0.6, 4)], evento: 'ratelimit' },
  { nome: 'FALTOU VRAM', grupos: [g('oom', 6, 1.5), g('fork', 12, 0.8, 3), g('golpe', 10, 0.8, 8)] },
  { nome: 'ELITE — O FEED INTEIRO', elite: true, grupos: [g('groque', 2, 4), g('metaverso', 1, 1, 6), g('botfarm', 36, 0.14, 4)] },
  { nome: 'A BOLHA ESTOUROU DE NOVO', grupos: [g('pump', 18, 0.7), g('deepfake', 12, 0.9, 4)], evento: 'casaco' },
  { nome: 'AVALIACAO CONTAMINADA', grupos: [g('vies', 14, 0.8), g('overfit', 12, 0.9, 3), g('oom', 6, 1.6, 7)] },
  { nome: 'ULTIMA CHAMADA DO CLUSTER', grupos: [g('blindado', 14, 0.8), g('voador', 14, 0.7, 3), g('oom', 8, 1.3, 8), g('rlhf', 8, 1.4, 12)], evento: 'gpuquente' },
  { nome: 'TUDO QUE VOCE JA VIU', grupos: [
    g('blindado', 10, 1.0), g('escudo', 10, 1.0, 2), g('camuflado', 12, 0.7, 4),
    g('voador', 10, 0.8, 6), g('overfit', 8, 1.1, 8), g('fork', 10, 0.9, 10),
    g('pump', 10, 0.9, 12), g('oom', 6, 1.5, 13), g('botfarm', 30, 0.14, 14),
  ] },
  { nome: 'CHEFE — O TROMBETA', chefe: true, grupos: [
    g('trombeta', 1, 1), g('foguete', 1, 1, 14), g('injection', 12, 1.1, 6),
    g('blindado', 10, 1.0, 20), g('voador', 10, 0.8, 26),
  ] },
];

export const TOTAL_ONDAS = TABELA.length;

export function multiplicadorHp(n) {
  if (n <= TOTAL_ONDAS) return 1 + 0.055 * (n - 1);
  // No sem fim a curva continua, e ai sim ela aperta.
  return 1 + 0.055 * (TOTAL_ONDAS - 1) + 0.16 * (n - TOTAL_ONDAS);
}

export function recompensaOnda(n) {
  return 50 + n * 10;
}

// O sem fim reaproveita a tabela com composicoes sorteadas de forma
// deterministica: a mesma onda 57 e sempre a mesma onda 57.
const POOL_SEM_FIM = [
  'blindado', 'escudo', 'camuflado', 'voador', 'overfit', 'vies',
  'fork', 'pump', 'checkpoint', 'rlhf', 'deepfake', 'injection', 'golpe',
];

function sorteio(semente) {
  let s = semente >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

export function definirOnda(n) {
  if (n <= TOTAL_ONDAS) {
    const base = TABELA[n - 1];
    return { numero: n, ...base, hpMult: multiplicadorHp(n), recompensa: recompensaOnda(n) };
  }
  const r = sorteio(n * 7919 + 13);
  const grupos = [];
  const quantos = 3 + Math.floor(r() * 3);
  for (let i = 0; i < quantos; i++) {
    const tipo = POOL_SEM_FIM[Math.floor(r() * POOL_SEM_FIM.length)];
    grupos.push(g(tipo, 8 + Math.floor(r() * 10) + Math.floor((n - TOTAL_ONDAS) / 3), 0.55 + r() * 0.5, i * 3));
  }
  grupos.push(g('botfarm', 20 + (n - TOTAL_ONDAS) * 2, 0.13, 4));
  const ciclo = (n - TOTAL_ONDAS) % 5;
  if (ciclo === 0) {
    const chefes = ['colapso', 'altohomem', 'scroll', 'trombeta'];
    grupos.unshift(g(chefes[Math.floor((n - TOTAL_ONDAS) / 5) % 4], 1, 1));
  }
  return {
    numero: n,
    nome: `SEM FIM ${n}`,
    chefe: ciclo === 0,
    grupos,
    hpMult: multiplicadorHp(n),
    recompensa: recompensaOnda(n),
    evento: ciclo === 2 ? 'gpuquente' : ciclo === 3 ? 'ratelimit' : null,
  };
}

// O que o painel da proxima onda mostra. Numero absoluto, nunca porcentagem.
export function descreverOnda(n) {
  const onda = definirOnda(n);
  const linhas = onda.grupos.map(gr => {
    const p = PRAGAS[gr.tipo];
    return {
      tipo: gr.tipo,
      nome: p.nome,
      cor: p.cor,
      quantidade: gr.quantidade,
      hp: Math.round(p.hp * onda.hpMult),
      vel: p.vel,
      premio: p.premio,
      regra: p.regra,
      chefe: !!p.chefe,
      elite: !!p.elite,
    };
  });
  return {
    numero: n,
    nome: onda.nome,
    chefe: !!onda.chefe,
    elite: !!onda.elite,
    evento: onda.evento ? { id: onda.evento, ...EVENTOS[onda.evento] } : null,
    recompensa: onda.recompensa,
    hpMult: onda.hpMult,
    linhas,
    totalPragas: onda.grupos.reduce((s, x) => s + x.quantidade, 0),
  };
}

// Quando cada tipo aparece pela primeira vez — o manual usa isso.
export function estreias() {
  const vistos = new Set();
  const lista = [];
  for (let n = 1; n <= TOTAL_ONDAS; n++) {
    for (const gr of TABELA[n - 1].grupos) {
      if (!vistos.has(gr.tipo)) {
        vistos.add(gr.tipo);
        lista.push({ onda: n, tipo: gr.tipo, nome: PRAGAS[gr.tipo].nome, regra: PRAGAS[gr.tipo].regra });
      }
    }
  }
  return lista;
}
