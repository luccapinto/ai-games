// Vídeo pôquer Jacks or Better 9/6: regras puras, sem tela.
//
// 9/6 quer dizer full house paga 9 e flush paga 6 por moeda. É a tabela mais
// generosa que ainda existe em casa nenhuma, e é a que faz o retorno ótimo
// chegar perto de 99,54%. A quinta moeda é o pulo do gato: o royal sobe de 250
// para 800 por moeda, e sem ela o jogo perde quase 1,4 ponto de retorno.
//
// Um baralho de 52 cartas por mão: as cinco primeiras são a mão dada, e as
// cinco seguintes são as substitutas, na ordem das posições trocadas.

import { baralhos, valorDe, naipeDe, nomeCarta } from '../../nucleo/baralho.js';
import { criarGerador } from '../../nucleo/justo.js';

export const CATEGORIAS = [
  'royal', 'sequencia_de_cor', 'quadra', 'full_house', 'flush',
  'sequencia', 'trinca', 'dois_pares', 'par_de_valete', 'nada',
];

// Pagamento por moeda. O royal é o único que muda com o número de moedas.
export const TABELA = {
  royal: { nome: 'Royal flush', porMoeda: 250, cincoMoedas: 800 },
  sequencia_de_cor: { nome: 'Straight flush', porMoeda: 50, cincoMoedas: 50 },
  quadra: { nome: 'Quadra', porMoeda: 25, cincoMoedas: 25 },
  full_house: { nome: 'Full house', porMoeda: 9, cincoMoedas: 9 },
  flush: { nome: 'Flush', porMoeda: 6, cincoMoedas: 6 },
  sequencia: { nome: 'Sequência', porMoeda: 4, cincoMoedas: 4 },
  trinca: { nome: 'Trinca', porMoeda: 3, cincoMoedas: 3 },
  dois_pares: { nome: 'Dois pares', porMoeda: 2, cincoMoedas: 2 },
  par_de_valete: { nome: 'Valetes ou melhor', porMoeda: 1, cincoMoedas: 1 },
  nada: { nome: 'Nada', porMoeda: 0, cincoMoedas: 0 },
};

export const MOEDAS_VALIDAS = [25, 100, 500];
export const MAX_MOEDAS = 5;
export const ROYAL_POR_MOEDA = TABELA.royal.porMoeda;
export const ROYAL_CINCO_MOEDAS = TABELA.royal.cincoMoedas;

// Índice do valor: 0 é ás, 12 é rei. Máscara de bits de 13 posições.
const ALTAS = (1 << 0) | (1 << 10) | (1 << 11) | (1 << 12);
export const MASCARA_ROYAL = (1 << 0) | (1 << 9) | (1 << 10) | (1 << 11) | (1 << 12);

// Sequências possíveis: A-2-3-4-5 até 9-10-J-Q-K (0b11111 deslocado) mais
// 10-J-Q-K-A. K-A-2-3-4 não está na lista e nunca vai estar.
export const SEQUENCIAS = (() => {
  const t = new Uint8Array(1 << 13);
  for (let s = 0; s <= 8; s++) t[0b11111 << s] = 1;
  t[MASCARA_ROYAL] = 1;
  return t;
})();

export function contarBits(n) {
  let c = 0;
  while (n) { n &= n - 1; c++; }
  return c;
}

// Classificação a partir das máscaras de repetição, que é como os laços
// quentes de analise.js carregam a mão.
export function categoriaDeMascaras(m1, m2, m3, m4, mesmoNaipe) {
  if (m4) return 'quadra';
  if (m3) return contarBits(m2) === 2 ? 'full_house' : 'trinca';
  if (mesmoNaipe) {
    if (m1 === MASCARA_ROYAL) return 'royal';
    return SEQUENCIAS[m1] ? 'sequencia_de_cor' : 'flush';
  }
  if (SEQUENCIAS[m1]) return 'sequencia';
  const pares = contarBits(m2);
  if (pares === 2) return 'dois_pares';
  if (pares === 1) return (m2 & ALTAS) ? 'par_de_valete' : 'nada';
  return 'nada';
}

export function classificar(cincoCartas) {
  if (!cincoCartas || cincoCartas.length !== 5) throw new Error('A mão de vídeo pôquer tem cinco cartas.');
  let m1 = 0, m2 = 0, m3 = 0, m4 = 0;
  const naipe = naipeDe(cincoCartas[0]);
  let mesmoNaipe = true;
  for (let i = 0; i < 5; i++) {
    const c = cincoCartas[i];
    const b = 1 << valorDe(c);
    m4 |= m3 & b;
    m3 |= m2 & b;
    m2 |= m1 & b;
    m1 |= b;
    if (naipeDe(c) !== naipe) mesmoNaipe = false;
  }
  return categoriaDeMascaras(m1, m2, m3, m4, mesmoNaipe);
}

// Pagamento total em moedas.
export function pagamento(categoria, moedas = 1) {
  const linha = TABELA[categoria];
  if (!linha) throw new Error(`categoria desconhecida: ${categoria}`);
  const porMoeda = moedas === MAX_MOEDAS ? linha.cincoMoedas : linha.porMoeda;
  return porMoeda * moedas;
}

// Pagamento por moeda, que é a unidade em que analise.js trabalha.
export function porMoeda(categoria, moedas = 1) {
  const linha = TABELA[categoria];
  if (!linha) throw new Error(`categoria desconhecida: ${categoria}`);
  return moedas === MAX_MOEDAS ? linha.cincoMoedas : linha.porMoeda;
}

// A função pura que o painel Conferir roda: o baralho inteiro, na ordem.
// Cartas 0 a 4 são a mão; 5 em diante são as substitutas.
export function derivar(gerador) {
  return gerador.embaralhar(baralhos(1));
}

// Quais cartas do baralho derivado ficam na mesa depois da troca.
export function maoFinal(baralho, segurar) {
  const mao = baralho.slice(0, 5);
  let proxima = 5;
  for (let i = 0; i < 5; i++) if (!segurar[i]) mao[i] = baralho[proxima++];
  return mao;
}

export const REGRAS_TEXTO = [
  'Um baralho de 52 cartas por mão, embaralhado pelo gerador verificável.',
  'As cinco primeiras cartas são a mão; as trocas saem das seguintes, na ordem das posições.',
  'Paga a partir de um par de valetes. Tabela 9/6: full house 9, flush 6 por moeda.',
  'O royal flush paga 250 por moeda, ou 800 por moeda com as cinco moedas.',
];

// Conferir: refaz o baralho e as cinco cartas finais a partir do registro.
export function conferir(registro) {
  const baralho = derivar(criarGerador(registro.semente, registro.sementeJogador, registro.contador));
  const r = registro.resultado ?? {};
  if (r.abandonada) return { confere: true, descricao: 'mão abandonada antes da troca: nada foi pago' };
  const mao = baralho.slice(0, 5);
  const final = maoFinal(baralho, r.segurou ?? [false, false, false, false, false]);
  const confere = mao.join() === (r.mao ?? []).join() && final.join() === (r.final ?? []).join() && classificar(final) === r.categoria;
  const nomes = cs => cs.map(nomeCarta).join(', ');
  return { confere, descricao: `a mão dada foi ${nomes(mao)}; a final, ${nomes(final)} (${TABELA[classificar(final)].nome})` };
}
