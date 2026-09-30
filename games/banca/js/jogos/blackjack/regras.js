// Regras do blackjack da BANCA. Só matemática e cartas: nada de DOM, nada de
// saldo. A mesa inteira está declarada em REGRAS, e é essa declaração que a
// estratégia, o simulador e as provas usam. Mudar uma linha aqui muda a
// vantagem da casa, e a prova que confere a vantagem vai gritar.

import { baralhos, valorDe, curto } from '../../nucleo/baralho.js';
import { criarGerador } from '../../nucleo/justo.js';
import { sha256hex } from '../../nucleo/sha256.js';

export const REGRAS = {
  // 6 baralhos, 312 cartas. A carta de corte entra na posição 234: quando uma
  // rodada começa com pos >= 234, o sapato é revelado e trocado.
  baralhos: 6,
  corte: 234,
  // A banca para em todo 17, inclusive no 17 macio (S17).
  s17: true,
  pagaBlackjack: 1.5,
  // Dobrar depois de dividir é permitido.
  das: true,
  maxMaos: 4,
  // Ases divididos recebem exatamente uma carta e não jogam mais.
  asesUmaCarta: true,
  resplitAses: false,
  desistencia: 'tardia',
  seguro: true,
  peek: true,
  // Limites em centavos de ficha. Só fichas inteiras: 3 para 2 e meio seguro
  // caem sempre em centavo exato.
  minimo: 500,
  maximo: 100000,
};

export const TOTAL_SAPATO = REGRAS.baralhos * 52;

// Valor de jogo da carta: ás vale 11 (a mão rebaixa depois), figura vale 10.
export function valorCarta(c) {
  const v = valorDe(c);
  if (v === 0) return 11;
  return v >= 9 ? 10 : v + 1;
}

// Valor de divisão: duas cartas de mesmo valor podem ser divididas, então
// dez, valete, dama e rei são a mesma coisa para o split.
export const valorDivisao = valorCarta;

export function ehAs(c) {
  return valorDe(c) === 0;
}

// Total da mão. `macio` quer dizer que um ás ainda está contando 11.
// `blackjack` só existe em mão de duas cartas que não veio de divisão.
export function valorMao(cartas, dividida = false) {
  let total = 0;
  let ases = 0;
  for (let i = 0; i < cartas.length; i++) {
    const v = valorDe(cartas[i]);
    if (v === 0) { ases++; total += 11; } else { total += v >= 9 ? 10 : v + 1; }
  }
  while (total > 21 && ases > 0) { total -= 10; ases--; }
  return {
    total,
    macio: ases > 0,
    blackjack: !dividida && cartas.length === 2 && total === 21,
    estourou: total > 21,
  };
}

// Soma uma carta a um par (total, macio) sem montar lista. É a mesma conta do
// valorMao, escrita para os laços quentes do simulador e do cálculo de VE.
export function somarCarta(total, macio, valor) {
  const soma = (valor === 1 && total + 11 <= 21) ? 11 : valor;
  let t = total + soma;
  let m = macio || soma === 11;
  if (t > 21 && m) { t -= 10; m = false; }
  return { total: t, macio: m };
}

// A banca compra até 17. Com S17 ela para no 17 macio também.
export function bancaDeveComprar(cartas) {
  const { total, macio } = valorMao(cartas);
  if (total < 17) return true;
  return total === 17 && macio && !REGRAS.s17;
}

// Joga a mão da banca até ela parar, tirando cartas de `tirar()`. Devolve a
// lista final (a lista recebida é copiada, não mexemos na do chamador).
export function jogarBanca(cartas, tirar) {
  const mao = cartas.slice();
  while (bancaDeveComprar(mao)) mao.push(tirar());
  return mao;
}

// A banca espia o furo quando mostra ás ou carta de dez.
export function bancaEspia(up) {
  return REGRAS.peek && (ehAs(up) || valorCarta(up) === 10);
}

// A função pura que o painel Conferir também roda: dado o gerador verificável,
// devolve o sapato inteiro, carta a carta.
export function derivar(gerador) {
  return gerador.embaralhar(baralhos(REGRAS.baralhos));
}

// Quanto o jogador recebe de volta (aposta + prêmio) para cada desfecho.
export function pagamento(resultado, aposta) {
  switch (resultado) {
    case 'blackjack': return aposta + aposta * 3 / 2;
    case 'ganhou': return aposta * 2;
    case 'empatou': return aposta;
    case 'desistiu': return aposta / 2;
    default: return 0;
  }
}

export const ROTULO_RESULTADO = {
  ganhou: 'ganhou',
  perdeu: 'perdeu',
  empatou: 'empatou',
  blackjack: 'blackjack',
  desistiu: 'desistiu',
  estourou: 'estourou',
};

// O que a mesa imprime no feltro e no painel: as regras, uma por linha.
export const REGRAS_TEXTO = [
  'Seis baralhos. O sapato é trocado quando a carta de corte (posição 234 de 312) já saiu.',
  'A banca para em todo 17, inclusive no 17 macio.',
  'Blackjack paga 3 para 2. Seguro paga 2 para 1 e custa metade da aposta.',
  'Dobrar em quaisquer duas cartas, inclusive depois de dividir.',
  'Divide até quatro mãos. Ases divididos recebem uma carta cada e não se dividem de novo.',
  'Desistência tardia: na primeira decisão, devolve metade da aposta.',
  'A banca espia o furo com ás ou dez: se tiver blackjack, a rodada acaba ali.',
];

// Resumo do sapato para o arquivo de sementes: a sequência que saiu vira um
// hash, e as primeiras cartas vão por extenso para o jogador bater o olho.
export function resumoDoSapato(cartas, usadas) {
  const seq = cartas.slice(0, usadas).map(curto).join(' ');
  return {
    usadas,
    primeiras: cartas.slice(0, 12).map(curto).join(' '),
    hashSequencia: sha256hex(seq),
    texto: `sapato de ${cartas.length} cartas, ${usadas} usadas`,
  };
}

export function conferir(registro) {
  const cartas = derivar(criarGerador(registro.semente, registro.sementeJogador, registro.contador));
  const r = registro.resultado ?? {};
  const refeito = resumoDoSapato(cartas, r.usadas ?? 0);
  const confere = refeito.hashSequencia === r.hashSequencia && refeito.primeiras === r.primeiras;
  return { confere, descricao: `o sapato refeito começa com ${refeito.primeiras} e as ${refeito.usadas} cartas usadas batem com o registro${confere ? '' : ' (não batem)'}` };
}
