// As cartas, os servidores e a ordem das salas.
//
// Tudo o que equilibra o jogo mora neste arquivo. Balancear e mexer numa tabela
// e rodar a simulacao de novo, nao cacar constante espalhada pelo codigo.

// ---------------------------------------------------------------- cartas
// custo  em tempo (a energia do turno)
// dano   tira paciencia do servidor
// guarda soma na sua guarda, que absorve o golpe do turno
export const CARTAS = {
  recurso: {
    nome: 'RECURSO', custo: 1, tipo: 'ataque', dano: 6,
    texto: 'Dá 6 de dano.',
  },
  protocolo: {
    nome: 'PROTOCOLO', custo: 1, tipo: 'guarda', guarda: 6,
    texto: 'Ganha 6 de guarda.',
  },
  peticao: {
    nome: 'PETIÇÃO', custo: 2, tipo: 'ataque', dano: 13,
    texto: 'Dá 13 de dano.',
  },
  despacho: {
    nome: 'DESPACHO', custo: 1, tipo: 'ataque', dano: 4, guarda: 4,
    texto: 'Dá 4 de dano e ganha 4 de guarda.',
  },
  certidao: {
    nome: 'CERTIDÃO', custo: 0, tipo: 'compra', compra: 2,
    texto: 'Compra 2 cartas. Não custa tempo.',
  },
  carimbo: {
    nome: 'CARIMBO', custo: 2, tipo: 'ataque', dano: 5, vezes: 3,
    texto: 'Dá 5 de dano, três vezes.',
  },
  // Custava 3, o turno inteiro de tempo. A medicao mostrou que isso a deixava
  // 20 pontos de vitoria abaixo da alternativa: atordoar nao paga um turno.
  liminar: {
    nome: 'LIMINAR', custo: 2, tipo: 'ataque', dano: 9, atordoa: true,
    texto: 'Dá 9 e o servidor perde o próximo turno.',
  },
  arquivamento: {
    nome: 'ARQUIVAMENTO', custo: 2, tipo: 'guarda', guarda: 18,
    texto: 'Ganha 18 de guarda.',
  },
  paciencia: {
    nome: 'PACIÊNCIA', custo: 1, tipo: 'cura', cura: 9,
    texto: 'Recupera 9 de paciência.',
  },
  intimacao: {
    nome: 'INTIMAÇÃO', custo: 1, tipo: 'ataque', dano: 3, fragiliza: 2,
    texto: 'Dá 3 e o servidor recebe +50% de dano por 2 turnos.',
  },
  // Era 3 por carta, o que dava ~12 de dano por 1 de tempo com a mao cheia —
  // contra 13 por 2 da peticao. A medicao mostrou que forcar esta carta subia a
  // vitoria de 40% para 70%: dominante a ponto de apagar as outras escolhas.
  praxe: {
    nome: 'PRAXE', custo: 1, tipo: 'ataque', danoPorCarta: 2,
    texto: 'Dá 2 por carta que ainda estiver na sua mão.',
  },
};

// O baralho inicial: nove cartas, sem nada esperto. A graca de um jogo de
// construir baralho e que a primeira mao seja sem graca.
export const BARALHO_INICIAL = [
  'recurso', 'recurso', 'recurso', 'recurso',
  'protocolo', 'protocolo', 'protocolo',
  'despacho', 'certidao',
];

// Cartas que aparecem como recompensa entre salas.
// Sem 'recurso' e 'protocolo': carta inicial fraca como recompensa e escolha
// morta, porque quem le a carta nunca pega. Pular a recompensa ja e a opcao de
// "nao quero diluir meu baralho".
// 'hora_extra' foi retirada do jogo: a medicao de valor por carta a colocou 23
// pontos de vitoria abaixo da alternativa, em todas as rodadas. Carta que nunca
// compensa pegar nao e escolha dificil, e slot de recompensa desperdicado.
export const RECOMPENSAS = [
  'peticao', 'carimbo', 'liminar', 'arquivamento',
  'paciencia', 'intimacao', 'praxe', 'despacho', 'certidao',
];

// ---------------------------------------------------------------- servidores
// `padrao` e a sequencia de intencoes, em ciclo. O jogo mostra a proxima antes
// de voce jogar: um jogo de carta sem telegrafo vira sorteio.
export const SERVIDORES = {
  atendente: {
    nome: 'ATENDENTE', paciencia: 39,
    fala: 'Isso aqui não é comigo.',
    padrao: [
      { tipo: 'ataque', valor: 7 },
      { tipo: 'ataque', valor: 9 },
      { tipo: 'guarda', valor: 8 },
    ],
  },
  fiscal: {
    nome: 'FISCAL', paciencia: 53,
    fala: 'Falta uma assinatura.',
    padrao: [
      { tipo: 'ataque', valor: 11 },
      { tipo: 'guarda', valor: 10 },
      { tipo: 'ataque', valor: 6, vezes: 2 },
    ],
  },
  gerente: {
    nome: 'GERENTE', paciencia: 71,
    fala: 'Vou precisar escalar isso.',
    padrao: [
      { tipo: 'ataque', valor: 13 },
      { tipo: 'forca', valor: 2 },
      { tipo: 'ataque', valor: 9 },
      { tipo: 'guarda', valor: 14 },
    ],
  },
  // Menos paciencia que o gerente de proposito: o auditor incomoda pelo
  // padrao (golpe duplo e forca), nao pelo tamanho.
  auditor: {
    nome: 'AUDITOR', paciencia: 68,
    fala: 'Encontrei uma inconsistência.',
    padrao: [
      { tipo: 'ataque', valor: 8, vezes: 2 },
      { tipo: 'forca', valor: 3 },
      { tipo: 'ataque', valor: 16 },
    ],
  },
  setor: {
    nome: 'O SETOR RESPONSÁVEL', paciencia: 85, chefe: true,
    fala: 'O sistema está fora do ar.',
    padrao: [
      { tipo: 'ataque', valor: 14 },
      { tipo: 'forca', valor: 3 },
      { tipo: 'ataque', valor: 9, vezes: 2 },
      { tipo: 'guarda', valor: 20 },
      { tipo: 'ataque', valor: 22 },
    ],
  },
};

// A ordem das salas. Sobe de forma previsivel de proposito: quem perde precisa
// entender onde perdeu, e sala sorteada tira isso.
export const SALAS = ['atendente', 'fiscal', 'gerente', 'auditor', 'setor'];

export const PACIENCIA_INICIAL = 72;

// Teto de forca: acima disso o golpe anunciado cresce alem do que qualquer
// baralho de cinco salas consegue segurar.
export const FORCA_MAXIMA = 6;
export const TEMPO_POR_TURNO = 3;
export const CARTAS_POR_TURNO = 5;
