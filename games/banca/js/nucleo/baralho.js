// Cartas e sapato, comuns a blackjack, bacará, vídeo pôquer e hold'em.
//
// Uma carta é um inteiro de 0 a 51: valor = c % 13 (0 = ás, 1 = dois, ...,
// 9 = dez, 10 = valete, 11 = dama, 12 = rei) e naipe = floor(c / 13)
// (0 espadas, 1 copas, 2 ouros, 3 paus). Num sapato de vários baralhos a
// carta continua sendo 0 a 51: dois reis de copas são o mesmo número.

export const NAIPES = ['espadas', 'copas', 'ouros', 'paus'];
export const NAIPE_COR = ['preto', 'vermelho', 'vermelho', 'preto'];
export const INDICES = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
export const NOMES_VALOR = ['ás', 'dois', 'três', 'quatro', 'cinco', 'seis', 'sete', 'oito', 'nove', 'dez', 'valete', 'dama', 'rei'];

export const valorDe = c => c % 13;
export const naipeDe = c => Math.floor(c / 13) % 4;
export const vermelha = c => naipeDe(c) === 1 || naipeDe(c) === 2;
export const carta = (valor, naipe) => naipe * 13 + valor;

export function indice(c) {
  return INDICES[valorDe(c)];
}

export function nomeCarta(c) {
  return `${NOMES_VALOR[valorDe(c)]} de ${NAIPES[naipeDe(c)]}`;
}

// Texto curto e ASCII para registro: "KC", "10E", "AO".
const LETRA_NAIPE = ['E', 'C', 'O', 'P'];
export function curto(c) {
  return INDICES[valorDe(c)] + LETRA_NAIPE[naipeDe(c)];
}

export function lerCurto(t) {
  const m = /^(A|[2-9]|10|J|Q|K)([ECOP])$/.exec(String(t).trim().toUpperCase());
  if (!m) throw new Error(`carta ilegível: ${t}`);
  return carta(INDICES.indexOf(m[1]), LETRA_NAIPE.indexOf(m[2]));
}

export function baralhos(n) {
  const lista = new Array(52 * n);
  for (let i = 0; i < lista.length; i++) lista[i] = i % 52;
  return lista;
}

// Sapato embaralhado pelo gerador verificável. A ordem inteira sai do
// gerador, então quem tem as três entradas reconstrói o sapato carta a carta.
// A carta de corte fica numa posição fixa declarada na mesa.
export function criarSapato(nBaralhos, gerador, corte) {
  const cartas = gerador.embaralhar(baralhos(nBaralhos));
  return sapatoDe(cartas, corte, 0);
}

export function sapatoDe(cartas, corte, pos = 0) {
  if (!(corte > 0 && corte <= cartas.length)) throw new Error(`corte ${corte} fora do sapato`);
  const s = {
    cartas,
    corte,
    pos,
    get restantes() { return cartas.length - s.pos; },
    get passouCorte() { return s.pos >= corte; },
    tirar() {
      if (s.pos >= cartas.length) throw new Error('sapato vazio');
      return cartas[s.pos++];
    },
  };
  return s;
}
