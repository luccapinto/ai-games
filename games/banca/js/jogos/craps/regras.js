// Craps: a mesa inteira declarada, e a vantagem exata de cada aposta.
//
// O craps é o jogo de cassino com a maior distância entre a melhor e a pior
// aposta do mesmo pano: a linha do passe custa 1,41%, as odds atrás dela custam
// ZERO, e o "qualquer sete" bem no meio da mesa custa 16,67%. Todas essas
// contas saem daqui, dos 36 resultados de dois dados, e provas/craps.mjs
// recalcula cada uma.
//
// Nada neste arquivo vê saldo, aposta anterior ou histórico: `resolver` é uma
// função pura de (apostas, ponto, dados).

import { criarGerador } from '../../nucleo/justo.js';
import { fichaDaAposta } from '../../nucleo/estat.js';
import { pct } from '../../nucleo/formato.js';

export const FICHA = 100;

export const REGRAS = {
  ficha: FICHA,
  minimoLinha: 5 * FICHA,
  minimoProposta: 1 * FICHA,
  maximo: 1000 * FICHA,
  // Odds a favor: 3x no 4 e no 10, 4x no 5 e no 9, 5x no 6 e no 8 da aposta de
  // linha. Odds contra: até o ganho valer o mesmo múltiplo, o que dá 6x em
  // todos os números.
  multiploOdds: { 4: 3, 5: 4, 6: 5, 8: 5, 9: 4, 10: 3 },
  multiploLay: 6,
};

// Quantas das 36 saídas dão cada total.
export const COMBINACOES = { 2: 1, 3: 2, 4: 3, 5: 4, 6: 5, 7: 6, 8: 5, 9: 4, 10: 3, 11: 2, 12: 1 };
export const PONTOS = [4, 5, 6, 8, 9, 10];

export const REGRAS_TEXTO = [
  'Dois dados. O primeiro lance de uma série é a saída: 7 e 11 pagam a linha do passe, 2, 3 e 12 a derrubam, e qualquer outro total vira o ponto.',
  'Com o ponto de pé, a linha do passe ganha se o ponto sair de novo antes do 7, e perde se o 7 vier primeiro.',
  'O Não passe é o contrário, com uma diferença: na saída o 2 e o 3 pagam, o 12 devolve a aposta (barra o 12), e o 7 e o 11 derrubam.',
  'As apostas de linha só entram na saída e não podem ser retiradas depois que o ponto está de pé.',
  'Vem e Não vem só entram com o ponto de pé, e se resolvem como as de linha; qualquer outro total manda a aposta para o número que saiu.',
  'As odds atrás da linha e atrás dos números de Vem pagam o preço justo: 2 para 1 no 4 e no 10, 3 para 2 no 5 e no 9, 6 para 5 no 6 e no 8. A casa não ganha nada nelas.',
  'As odds contra pagam o inverso: 1 para 2 no 4 e no 10, 2 para 3 no 5 e no 9, 5 para 6 no 6 e no 8.',
  'O limite das odds a favor é 3 vezes a aposta no 4 e no 10, 4 vezes no 5 e no 9 e 5 vezes no 6 e no 8. O limite das odds contra é o que faz o ganho chegar a esse mesmo múltiplo, ou seja 6 vezes a aposta em qualquer número.',
  'Para o pagamento sair em centavo exato, a mesa arredonda a aposta para baixo até o múltiplo válido: odds contra no 5 e no 9 em múltiplos de 3 fichas, odds contra no 6 e no 8 em múltiplos de 6 fichas, colocação no 6 e no 8 em múltiplos de 6 fichas, colocação no 4, 5, 9 e 10 em múltiplos de 5 fichas. O resto vai de ficha em ficha.',
  'As odds dos números de Vem trabalham sempre, inclusive na saída, e podem ser retiradas a qualquer momento.',
  'Colocação no 4, 5, 6, 8, 9 e 10 paga 9 para 5, 7 para 5, 7 para 6, 7 para 6, 7 para 5 e 9 para 5. Ela dorme na saída, continua de pé depois de ganhar e pode ser retirada a qualquer momento.',
  'Campo é de um lance só: o 2 paga 2 para 1, o 12 paga 3 para 1, e o 3, 4, 9, 10 e 11 pagam 1 para 1. Qualquer outro total perde.',
  'Difíceis 4, 6, 8 e 10 são o par: o 4 e o 10 difíceis pagam 7 para 1 e o 6 e o 8 difíceis pagam 9 para 1. Perdem no 7 e no número fácil, e trabalham sempre.',
  'Propostas de um lance: qualquer 7 paga 4 para 1, qualquer craps paga 7 para 1, o 2 e o 12 pagam 30 para 1, o 3 e o 11 pagam 15 para 1.',
  'Mínimo de 5 fichas nas apostas de linha, de Vem e de colocação, e de 1 ficha nas propostas, no campo e nas difíceis. Máximo de 1000 fichas por aposta.',
  'Cada lance é uma rodada verificável: o compromisso é publicado antes e a semente é revelada depois, com os dois dados que saíram.',
];

// --------------------------------------------------------------- pagamentos

// Pagamento como fração exata [numerador, denominador] sobre a aposta.
export const PAGA_ODDS = { 4: [2, 1], 10: [2, 1], 5: [3, 2], 9: [3, 2], 6: [6, 5], 8: [6, 5] };
export const PAGA_LAY = { 4: [1, 2], 10: [1, 2], 5: [2, 3], 9: [2, 3], 6: [5, 6], 8: [5, 6] };
export const PAGA_PLACE = { 4: [9, 5], 10: [9, 5], 5: [7, 5], 9: [7, 5], 6: [7, 6], 8: [7, 6] };
export const PAGA_HARD = { 4: 7, 10: 7, 6: 9, 8: 9 };
export const PAGA_PROPOSTA = { anyseven: 4, anycraps: 7, two: 30, three: 15, eleven: 15, twelve: 30 };
export const ALVO_PROPOSTA = { anyseven: [7], anycraps: [2, 3, 12], two: [2], three: [3], eleven: [11], twelve: [12] };
export const PAGA_CAMPO = { 2: 2, 12: 3, 3: 1, 4: 1, 9: 1, 10: 1, 11: 1 };

function texto(fr) {
  return `${fr[0]} para ${fr[1]}`;
}

// ------------------------------------------------------------------- zonas

const ZONA = [];

function add(z) {
  ZONA.push({ umLance: false, removivel: true, numero: null, ...z });
  return ZONA[ZONA.length - 1];
}

add({ id: 'pass', nome: 'Linha do passe', tipo: 'linha', paga: '1 para 1', removivel: 'saida' });
add({ id: 'dontpass', nome: 'Não passe', tipo: 'linha', paga: '1 para 1, o 12 devolve', removivel: 'saida' });
add({ id: 'passodds', nome: 'Odds do passe', tipo: 'odds', paga: 'preço justo do ponto' });
add({ id: 'dontpassodds', nome: 'Odds contra do passe', tipo: 'odds', paga: 'preço justo invertido' });
add({ id: 'come', nome: 'Vem', tipo: 'vem', paga: '1 para 1' });
add({ id: 'dontcome', nome: 'Não vem', tipo: 'vem', paga: '1 para 1, o 12 devolve' });
for (const n of PONTOS) {
  add({ id: `come${n}`, nome: `Vem no ${n}`, tipo: 'pontovem', numero: n, paga: '1 para 1', removivel: false });
  add({ id: `comeodds${n}`, nome: `Odds do Vem no ${n}`, tipo: 'odds', numero: n, paga: texto(PAGA_ODDS[n]) });
}
for (const n of PONTOS) {
  add({ id: `dontcome${n}`, nome: `Não vem no ${n}`, tipo: 'pontovem', numero: n, paga: '1 para 1', removivel: false });
  add({ id: `dontcomeodds${n}`, nome: `Odds contra no ${n}`, tipo: 'odds', numero: n, paga: texto(PAGA_LAY[n]) });
}
for (const n of PONTOS) {
  add({ id: `place${n}`, nome: `Colocação no ${n}`, tipo: 'place', numero: n, paga: texto(PAGA_PLACE[n]) });
}
add({ id: 'field', nome: 'Campo', tipo: 'campo', umLance: true, paga: '1 para 1, o 2 paga 2 e o 12 paga 3' });
for (const n of [4, 6, 8, 10]) {
  add({ id: `hard${n}`, nome: `${n} difícil`, tipo: 'hard', numero: n, paga: `${PAGA_HARD[n]} para 1` });
}
for (const [id, nome] of [['anyseven', 'Qualquer 7'], ['anycraps', 'Qualquer craps'], ['two', 'O 2'], ['three', 'O 3'], ['eleven', 'O 11'], ['twelve', 'O 12']]) {
  add({ id, nome, tipo: 'proposta', umLance: true, paga: `${PAGA_PROPOSTA[id]} para 1` });
}

export const ZONAS = ZONA;
export const ZONA_POR_ID = Object.fromEntries(ZONAS.map(z => [z.id, z]));

// Múltiplo obrigatório da aposta, em centavos, para o pagamento sair inteiro.
// Declarado zona a zona; provas/craps.mjs confere que todo múltiplo válido paga
// centavo inteiro e que os múltiplos menores não pagariam.
export const MULTIPLO = (() => {
  const m = {};
  for (const z of ZONAS) m[z.id] = FICHA;
  for (const n of PONTOS) {
    m[`place${n}`] = (n === 6 || n === 8) ? 6 * FICHA : 5 * FICHA;
    m[`dontcomeodds${n}`] = (n === 5 || n === 9) ? 3 * FICHA : (n === 6 || n === 8) ? 6 * FICHA : FICHA;
  }
  return m;
})();

// A aposta contra do passe segue o múltiplo do ponto em jogo, então depende do
// estado; esta função é a resposta final.
export function multiploDe(zona, ponto) {
  if (zona === 'dontpassodds') {
    if (!ponto) return FICHA;
    return (ponto === 5 || ponto === 9) ? 3 * FICHA : (ponto === 6 || ponto === 8) ? 6 * FICHA : FICHA;
  }
  return MULTIPLO[zona] ?? FICHA;
}

export function minimoDe(zona, ponto) {
  const z = ZONA_POR_ID[zona];
  if (!z) throw new Error(`Zona desconhecida: ${zona}.`);
  const base = (z.tipo === 'linha' || z.tipo === 'vem' || z.tipo === 'place') ? REGRAS.minimoLinha : REGRAS.minimoProposta;
  const mult = multiploDe(zona, ponto);
  return Math.max(base, mult);
}

// A aposta de linha que sustenta as odds de cada zona de odds.
export const LINHA_DAS_ODDS = (() => {
  const m = { passodds: 'pass', dontpassodds: 'dontpass' };
  for (const n of PONTOS) {
    m[`comeodds${n}`] = `come${n}`;
    m[`dontcomeodds${n}`] = `dontcome${n}`;
  }
  return m;
})();

// Teto da aposta: 1000 fichas em qualquer zona, e nas odds o limite 3-4-5x
// sobre a aposta de linha que as sustenta (6x nas odds contra, que é o mesmo
// limite escrito pelo lado do ganho).
export function tetoDe(zona, apostas, ponto) {
  const z = ZONA_POR_ID[zona];
  if (!z) throw new Error(`Zona desconhecida: ${zona}.`);
  if (z.tipo !== 'odds') return REGRAS.maximo;
  const linha = LINHA_DAS_ODDS[zona];
  const flat = apostas[linha] ?? 0;
  const numero = z.numero ?? ponto;
  if (!flat || !numero) return 0;
  const contra = zona === 'dontpassodds' || zona.startsWith('dontcomeodds');
  const teto = flat * (contra ? REGRAS.multiploLay : REGRAS.multiploOdds[numero]);
  return Math.min(REGRAS.maximo, teto);
}

// Pode apostar nesta zona agora? A UI usa o motivo direto, em português.
export function podeApostar(zona, apostas, ponto) {
  const z = ZONA_POR_ID[zona];
  if (!z) return { ok: false, motivo: `Zona desconhecida: ${zona}.` };
  if (z.tipo === 'linha' && ponto !== null) return { ok: false, motivo: 'As apostas de linha só entram na saída.' };
  if (z.tipo === 'vem' && ponto === null) return { ok: false, motivo: 'Vem e Não vem só entram com o ponto de pé.' };
  if (z.tipo === 'pontovem') return { ok: false, motivo: 'Esta aposta só chega aqui viajando da caixa do Vem.' };
  if (z.tipo === 'odds') {
    const linha = LINHA_DAS_ODDS[zona];
    if (!(apostas[linha] > 0)) return { ok: false, motivo: `As odds só entram atrás de uma aposta em ${ZONA_POR_ID[linha].nome}.` };
    if ((z.numero ?? ponto) === null) return { ok: false, motivo: 'As odds da linha só entram com o ponto de pé.' };
    const teto = tetoDe(zona, apostas, ponto);
    if ((apostas[zona] ?? 0) >= teto) return { ok: false, motivo: `As odds já estão no limite de ${teto / FICHA} fichas.` };
  }
  if ((apostas[zona] ?? 0) >= REGRAS.maximo) return { ok: false, motivo: `O máximo por aposta é ${REGRAS.maximo / FICHA} fichas.` };
  return { ok: true, motivo: '' };
}

// Pode tirar da mesa? Linha e números de Vem são contrato: depois que o ponto
// está de pé eles ficam.
export function podeRetirar(zona, apostas, ponto) {
  const z = ZONA_POR_ID[zona];
  if (!z) return false;
  if (!(apostas[zona] > 0)) return false;
  if (z.removivel === false) return false;
  if (z.removivel === 'saida') return ponto === null;
  return true;
}

// Arredonda a aposta para baixo até o múltiplo que paga centavo inteiro, e
// para dentro do teto. Devolve o valor final e o motivo do ajuste, se houve.
export function ajustarValor(zona, valor, apostas, ponto) {
  if (!Number.isInteger(valor) || valor <= 0) throw new Error('A aposta precisa ser um número inteiro de centavos maior que zero.');
  const mult = multiploDe(zona, ponto);
  const jaNaMesa = apostas[zona] ?? 0;
  const teto = tetoDe(zona, apostas, ponto);
  const minimo = minimoDe(zona, ponto);
  const espaco = teto - jaNaMesa;
  if (espaco <= 0) throw new Error(`A aposta em ${ZONA_POR_ID[zona].nome} já está no limite de ${teto / FICHA} fichas.`);
  const final = Math.floor(Math.min(valor, espaco) / mult) * mult;
  if (final === 0) throw new Error(`${ZONA_POR_ID[zona].nome} vai de ${mult / FICHA} em ${mult / FICHA} fichas: ${valor / FICHA} não chega a uma aposta.`);
  if (jaNaMesa + final < minimo) {
    // Ainda dá para chegar ao mínimo? Só se o teto deixar.
    const preciso = Math.ceil((minimo - jaNaMesa) / mult) * mult;
    if (preciso > espaco) throw new Error(`${ZONA_POR_ID[zona].nome} pede no mínimo ${minimo / FICHA} fichas e o limite não deixa chegar lá.`);
    throw new Error(`${ZONA_POR_ID[zona].nome} pede no mínimo ${minimo / FICHA} fichas, em múltiplos de ${mult / FICHA}.`);
  }
  const motivo = final === valor ? '' : `A mesa ajustou de ${valor / FICHA} para ${final / FICHA} fichas: ${ZONA_POR_ID[zona].nome} vai de ${mult / FICHA} em ${mult / FICHA} fichas, com teto de ${teto / FICHA}.`;
  return { valor: final, motivo, multiplo: mult, minimo, teto };
}

// --------------------------------------------------------------- pagamentos

function fracao(zona, v, fr) {
  const bruto = v * fr[0];
  if (bruto % fr[1] !== 0) throw new Error(`A aposta em ${zona} precisa ser múltipla de ${multiploDe(zona) / FICHA} fichas para o pagamento sair em centavo inteiro.`);
  return bruto / fr[1];
}

// Prêmio líquido (sem a aposta) de uma zona que ganhou, em centavos inteiros.
export function premio(zona, valor, dados, ponto) {
  const z = ZONA_POR_ID[zona];
  if (!z) throw new Error(`Zona desconhecida: ${zona}.`);
  const soma = dados[0] + dados[1];
  switch (z.tipo) {
    case 'linha':
    case 'vem':
    case 'pontovem':
      return valor;
    case 'place':
      return fracao(zona, valor, PAGA_PLACE[z.numero]);
    case 'hard':
      return valor * PAGA_HARD[z.numero];
    case 'proposta':
      return valor * PAGA_PROPOSTA[zona];
    case 'campo':
      return valor * (PAGA_CAMPO[soma] ?? 0);
    case 'odds': {
      const n = z.numero ?? ponto;
      const contra = zona === 'dontpassodds' || zona.startsWith('dontcomeodds');
      return fracao(zona, valor, contra ? PAGA_LAY[n] : PAGA_ODDS[n]);
    }
    default:
      throw new Error(`Zona sem pagamento: ${zona}.`);
  }
}

// -------------------------------------------------------------------- dados

export function derivar(gerador) {
  return [gerador.inteiro(6) + 1, gerador.inteiro(6) + 1];
}

export function textoDoLance(dados, soma, pontoAntes, pontoDepois) {
  const par = dados[0] === dados[1] ? ' na dupla' : '';
  if (pontoAntes === null) {
    if (pontoDepois !== null) return `${dados[0]} e ${dados[1]}: ponto no ${soma}`;
    if (soma === 7 || soma === 11) return `${dados[0]} e ${dados[1]}: ${soma}, o passe ganha`;
    return `${dados[0]} e ${dados[1]}: craps de ${soma}`;
  }
  if (soma === pontoAntes) return `${dados[0]} e ${dados[1]}: ponto de ${soma} feito${par}`;
  if (soma === 7) return `${dados[0]} e ${dados[1]}: sete fora, o ponto era ${pontoAntes}`;
  return `${dados[0]} e ${dados[1]}: ${soma}${par}, o ponto segue no ${pontoAntes}`;
}

// ----------------------------------------------------------------- resolver

// Pura: não toca em saldo, não muda o objeto recebido. Devolve as apostas
// depois do lance, o ponto novo e a lista de eventos na ordem em que a mesa
// paga (propostas e campo primeiro, linha por último).
export function resolver(apostas, ponto, dados) {
  const soma = dados[0] + dados[1];
  const dupla = dados[0] === dados[1];
  const saida = { ...apostas };
  const eventos = [];
  let novoPonto = ponto;

  const valor = z => saida[z] ?? 0;

  function fechar(zona, resultado, pago, permanece = false, extra = {}) {
    const aposta = valor(zona);
    if (aposta <= 0) return;
    eventos.push({ zona, resultado, aposta, pago, permanece, ...extra });
    if (!permanece) saida[zona] = 0;
  }

  const ganhar = (zona, ponto2) => fechar(zona, 'ganhou', valor(zona) + premio(zona, valor(zona), dados, ponto2));
  const perder = zona => fechar(zona, 'perdeu', 0);
  const devolver = zona => fechar(zona, 'devolveu', valor(zona));

  // 1. Propostas de um lance.
  for (const id of Object.keys(PAGA_PROPOSTA)) {
    if (valor(id) <= 0) continue;
    if (ALVO_PROPOSTA[id].includes(soma)) ganhar(id);
    else perder(id);
  }

  // 2. Campo.
  if (valor('field') > 0) {
    if (PAGA_CAMPO[soma]) ganhar('field');
    else perder('field');
  }

  // 3. Difíceis: trabalham sempre, ficam de pé quando não são decididas.
  for (const n of [4, 6, 8, 10]) {
    const id = `hard${n}`;
    if (valor(id) <= 0) continue;
    if (soma === 7) perder(id);
    else if (soma === n) {
      if (dupla) fechar(id, 'ganhou', premio(id, valor(id), dados), true);
      else perder(id);
    }
  }

  // 4. Colocação: dorme na saída.
  if (ponto !== null) {
    for (const n of PONTOS) {
      const id = `place${n}`;
      if (valor(id) <= 0) continue;
      if (soma === n) fechar(id, 'ganhou', premio(id, valor(id), dados), true);
      else if (soma === 7) perder(id);
    }
  }

  // 5. Números de Vem e Não vem, com as odds deles. Trabalham sempre.
  for (const n of PONTOS) {
    const flat = `come${n}`;
    const odds = `comeodds${n}`;
    if (soma === n) {
      ganhar(flat);
      ganhar(odds, n);
    } else if (soma === 7) {
      perder(flat);
      perder(odds);
    }
    const contra = `dontcome${n}`;
    const contraOdds = `dontcomeodds${n}`;
    if (soma === 7) {
      ganhar(contra);
      ganhar(contraOdds, n);
    } else if (soma === n) {
      perder(contra);
      perder(contraOdds);
    }
  }

  // 6. Linha.
  if (ponto === null) {
    if (soma === 7 || soma === 11) { ganhar('pass'); perder('dontpass'); }
    else if (soma === 2 || soma === 3) { perder('pass'); ganhar('dontpass'); }
    else if (soma === 12) { perder('pass'); devolver('dontpass'); }
    else novoPonto = soma;
  } else if (soma === ponto) {
    ganhar('pass');
    ganhar('passodds', ponto);
    perder('dontpass');
    perder('dontpassodds');
    novoPonto = null;
  } else if (soma === 7) {
    perder('pass');
    perder('passodds');
    ganhar('dontpass');
    ganhar('dontpassodds', ponto);
    novoPonto = null;
  }

  // 7. A caixa do Vem, depois dos números: uma aposta que viaja neste lance não
  // é decidida por ele.
  if (soma === 7 || soma === 11) { ganhar('come'); perder('dontcome'); }
  else if (soma === 2 || soma === 3) { perder('come'); ganhar('dontcome'); }
  else if (soma === 12) { perder('come'); devolver('dontcome'); }
  else {
    for (const [caixa, destino] of [['come', `come${soma}`], ['dontcome', `dontcome${soma}`]]) {
      const v = valor(caixa);
      if (v <= 0) continue;
      eventos.push({ zona: caixa, resultado: 'moveu', para: destino, aposta: v, pago: 0, permanece: false });
      saida[caixa] = 0;
      saida[destino] = (saida[destino] ?? 0) + v;
    }
  }

  return { eventos, ponto: novoPonto, apostas: saida, soma, dupla };
}

// ------------------------------------------------------- distribuições exatas

const p36 = n => COMBINACOES[n] / 36;

// Linha do passe: ganha na saída com 7 e 11, e depois com o ponto antes do 7.
function distPasse() {
  let ganha = p36(7) + p36(11);
  let perde = p36(2) + p36(3) + p36(12);
  for (const n of PONTOS) {
    const c = COMBINACOES[n];
    ganha += p36(n) * (c / (c + 6));
    perde += p36(n) * (6 / (c + 6));
  }
  return [{ p: ganha, x: 1 }, { p: perde, x: -1 }];
}

function distNaoPasse() {
  let ganha = p36(2) + p36(3);
  let perde = p36(7) + p36(11);
  for (const n of PONTOS) {
    const c = COMBINACOES[n];
    ganha += p36(n) * (6 / (c + 6));
    perde += p36(n) * (c / (c + 6));
  }
  return [{ p: ganha, x: 1 }, { p: perde, x: -1 }, { p: p36(12), x: 0 }];
}

export function distOdds(numero, contra = false) {
  const c = COMBINACOES[numero];
  const fr = contra ? PAGA_LAY[numero] : PAGA_ODDS[numero];
  const pGanha = contra ? 6 / (c + 6) : c / (c + 6);
  return [{ p: pGanha, x: fr[0] / fr[1] }, { p: 1 - pGanha, x: -1 }];
}

// As odds "em geral": a mistura sobre os pontos, pesada pela chance de cada
// ponto se estabelecer. Serve para a vitrine; a conta do Livro usa o ponto real.
function distOddsMistura(contra) {
  const totalPontos = PONTOS.reduce((s, n) => s + COMBINACOES[n], 0);
  const dist = [];
  for (const n of PONTOS) {
    const peso = COMBINACOES[n] / totalPontos;
    for (const o of distOdds(n, contra)) dist.push({ p: o.p * peso, x: o.x });
  }
  return dist;
}

function distPlace(n) {
  const c = COMBINACOES[n];
  const fr = PAGA_PLACE[n];
  return [{ p: c / (c + 6), x: fr[0] / fr[1] }, { p: 6 / (c + 6), x: -1 }];
}

function distCampo() {
  const dist = [];
  let perde = 0;
  for (let s = 2; s <= 12; s++) {
    const paga = PAGA_CAMPO[s];
    if (paga) dist.push({ p: p36(s), x: paga });
    else perde += p36(s);
  }
  dist.push({ p: perde, x: -1 });
  return dist;
}

// Difícil: só o 7 e o número fácil decidem. Condicionando nos lances que
// decidem, o número difícil sai em 1 de (1 + fáceis + 6).
function distHard(n) {
  const faceis = COMBINACOES[n] - 1;
  const total = 1 + faceis + 6;
  return [{ p: 1 / total, x: PAGA_HARD[n] }, { p: (faceis + 6) / total, x: -1 }];
}

function distProposta(id) {
  const alvos = ALVO_PROPOSTA[id];
  const pGanha = alvos.reduce((s, n) => s + p36(n), 0);
  return [{ p: pGanha, x: PAGA_PROPOSTA[id] }, { p: 1 - pGanha, x: -1 }];
}

function montarFichas() {
  const f = {};
  const passe = distPasse();
  const naoPasse = distNaoPasse();
  for (const z of ZONAS) {
    let dist;
    if (z.id === 'pass' || z.id === 'come' || z.id.startsWith('come') && z.tipo === 'pontovem') dist = passe;
    else if (z.id === 'dontpass' || z.id === 'dontcome' || z.tipo === 'pontovem') dist = naoPasse;
    else if (z.tipo === 'odds') {
      const contra = z.id === 'dontpassodds' || z.id.startsWith('dontcomeodds');
      dist = z.numero ? distOdds(z.numero, contra) : distOddsMistura(contra);
    } else if (z.tipo === 'place') dist = distPlace(z.numero);
    else if (z.tipo === 'campo') dist = distCampo();
    else if (z.tipo === 'hard') dist = distHard(z.numero);
    else dist = distProposta(z.id);
    f[z.id] = fichaDaAposta(z.nome, dist, z.paga);
    f[z.id].classe = classe(f[z.id].vantagem);
  }
  return f;
}

export function classe(vantagem) {
  if (vantagem < 0.02) return 'boa';
  if (vantagem <= 0.05) return 'media';
  return 'ruim';
}

let cacheFichas = null;
export function fichas() {
  if (!cacheFichas) cacheFichas = montarFichas();
  return cacheFichas;
}

export const FICHAS = new Proxy({}, {
  get: (_, k) => (typeof k === 'string' ? fichas()[k] : undefined),
  has: (_, k) => typeof k === 'string' && k in fichas(),
  ownKeys: () => Reflect.ownKeys(fichas()),
  getOwnPropertyDescriptor: (_, k) => ({ value: fichas()[k], enumerable: true, configurable: true }),
});

// A ficha que vale para uma decisão concreta: as odds da linha dependem do
// ponto que estava de pé.
export function fichaDe(zona, ponto = null) {
  const f = fichas();
  if ((zona === 'passodds' || zona === 'dontpassodds') && ponto) {
    const contra = zona === 'dontpassodds';
    const d = distOdds(ponto, contra);
    return fichaDaAposta(ZONA_POR_ID[zona].nome, d, ZONA_POR_ID[zona].paga);
  }
  return f[zona];
}

// A conta de um lance: a perda esperada é a soma de valor x vantagem de cada
// aposta DECIDIDA, e a variância é a soma das variâncias dessas apostas.
//
// A covariância entre apostas simultâneas é ignorada de propósito: no craps
// duas apostas podem se decidir no mesmo lance (o 7 derruba a linha e paga o
// Não vem), e somar as variâncias é uma aproximação. A perda esperada, essa,
// é exata: valor esperado é linear e cada aposta feita é cobrada uma vez só,
// no lance em que ela se decide.
export function contaDoLance(eventos, ponto) {
  let apostado = 0;
  let retorno = 0;
  let perdaEsperada = 0;
  let variancia = 0;
  for (const e of eventos) {
    if (e.resultado === 'moveu') continue;
    const f = fichaDe(e.zona, ponto);
    apostado += e.aposta;
    retorno += e.pago + (e.permanece ? e.aposta : 0);
    perdaEsperada += e.aposta * f.vantagem;
    variancia += e.aposta * e.aposta * f.variancia;
  }
  return { apostado, retorno, perdaEsperada, variancia };
}

// --------------------------------------------------------------- vitrine

export function placa() {
  const f = fichas();
  return [
    { rotulo: 'Odds', valor: pct(f.passodds.vantagem, 2) },
    { rotulo: 'Não passe', valor: pct(f.dontpass.vantagem, 2) },
    { rotulo: 'Qualquer 7', valor: pct(f.anyseven.vantagem, 2) },
  ];
}

// Painel Conferir: os dois dados saem das três entradas publicadas.
export function conferir(registro) {
  const g = criarGerador(registro.semente, registro.sementeJogador, registro.contador);
  const dados = derivar(g);
  const esperado = registro.resultado?.dados;
  const confere = Array.isArray(esperado) && dados[0] === esperado[0] && dados[1] === esperado[1];
  return {
    confere,
    descricao: confere
      ? `o gerador dá ${dados[0]} e ${dados[1]}, total ${dados[0] + dados[1]}, igual ao que a mesa registrou`
      : `o gerador dá ${dados[0]} e ${dados[1]}; a mesa registrou ${Array.isArray(esperado) ? esperado.join(' e ') : 'nada'}`,
  };
}
