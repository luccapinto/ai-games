// Roleta europeia: um zero, 37 casas, nenhuma la partage.
//
// Toda aposta é um conjunto de números e um pagamento. O pagamento de uma
// aposta que cobre n números é 36/n - 1 para 1, e é isso que faz a vantagem
// da casa ser exatamente 1/37 = 2,70% em qualquer uma: a roda tem 37 casas e
// a mesa paga como se tivesse 36. As provas conferem casa por casa.

import { fichaDaAposta } from '../../nucleo/estat.js';
import { criarGerador } from '../../nucleo/justo.js';

export const ORDEM_RODA = [0, 32, 15, 19, 4, 21, 2, 25, 17, 34, 6, 27, 13, 36, 11, 30, 8, 23, 10, 5, 24, 16, 33, 1, 20, 14, 31, 9, 22, 18, 29, 7, 28, 12, 35, 3, 26];
export const VERMELHOS = new Set([1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36]);
export const POSICAO_NA_RODA = Object.fromEntries(ORDEM_RODA.map((n, i) => [n, i]));

export const corDe = n => (n === 0 ? 'verde' : VERMELHOS.has(n) ? 'vermelho' : 'preto');

export const LIMITES = {
  minimo: 100,          // 1 ficha por aposta
  maximoPleno: 50000,   // 500 fichas num número
  maximoRodada: 1000000, // 10 mil fichas na mesa
};

// Número na linha r (0 = de cima) e coluna c (0 a 11) do pano.
export const numeroNa = (r, c) => c * 3 + (3 - r);

const TIPOS = {
  pleno: 'Pleno', cavalo: 'Cavalo', transversal: 'Transversal', quadra: 'Quadra', linha: 'Linha',
  duzia: 'Dúzia', coluna: 'Coluna', simples: 'Chance simples',
};

function aposta(id, tipo, nome, numeros) {
  const n = numeros.length;
  const paga = 36 / n - 1;
  if (!Number.isInteger(paga)) throw new Error(`${id}: ${n} números não dão pagamento inteiro`);
  return { id, tipo, nome, numeros: [...numeros].sort((a, b) => a - b), paga };
}

// O catálogo inteiro, gerado das regras do pano: 37 plenos, 60 cavalos,
// 14 transversais, 23 quadras, 11 linhas, 3 dúzias, 3 colunas e 6 chances simples.
function catalogo() {
  const lista = [];
  for (let n = 0; n <= 36; n++) lista.push(aposta(`p${n}`, 'pleno', `Pleno ${n}`, [n]));
  // cavalos: vizinhos na mesma linha e na mesma coluna do pano, e os três com o zero
  for (let c = 0; c < 12; c++) for (let r = 0; r < 3; r++) {
    const n = numeroNa(r, c);
    if (c < 11) { const m = numeroNa(r, c + 1); lista.push(aposta(`c${n}-${m}`, 'cavalo', `Cavalo ${n} e ${m}`, [n, m])); }
    if (r < 2) { const m = numeroNa(r + 1, c); lista.push(aposta(`c${m}-${n}`, 'cavalo', `Cavalo ${m} e ${n}`, [m, n])); }
  }
  for (const n of [1, 2, 3]) lista.push(aposta(`c0-${n}`, 'cavalo', `Cavalo 0 e ${n}`, [0, n]));
  for (let c = 0; c < 12; c++) {
    const a = c * 3 + 1;
    lista.push(aposta(`t${a}`, 'transversal', `Transversal ${a} a ${a + 2}`, [a, a + 1, a + 2]));
  }
  lista.push(aposta('t0-1-2', 'transversal', 'Transversal 0, 1 e 2', [0, 1, 2]));
  lista.push(aposta('t0-2-3', 'transversal', 'Transversal 0, 2 e 3', [0, 2, 3]));
  for (let c = 0; c < 11; c++) for (let r = 0; r < 2; r++) {
    const ns = [numeroNa(r, c), numeroNa(r, c + 1), numeroNa(r + 1, c), numeroNa(r + 1, c + 1)];
    const menor = Math.min(...ns);
    lista.push(aposta(`q${menor}`, 'quadra', `Quadra ${ns.slice().sort((a, b) => a - b).join(', ')}`, ns));
  }
  lista.push(aposta('q0', 'quadra', 'Quadra 0, 1, 2 e 3', [0, 1, 2, 3]));
  for (let c = 0; c < 11; c++) {
    const a = c * 3 + 1;
    lista.push(aposta(`l${a}`, 'linha', `Linha ${a} a ${a + 5}`, [a, a + 1, a + 2, a + 3, a + 4, a + 5]));
  }
  for (let d = 0; d < 3; d++) {
    const ns = Array.from({ length: 12 }, (_, i) => d * 12 + 1 + i);
    lista.push(aposta(`d${d + 1}`, 'duzia', `${['Primeira', 'Segunda', 'Terceira'][d]} dúzia (${d * 12 + 1} a ${d * 12 + 12})`, ns));
  }
  for (let k = 1; k <= 3; k++) {
    const ns = Array.from({ length: 12 }, (_, i) => i * 3 + k);
    lista.push(aposta(`k${k}`, 'coluna', `${['Primeira', 'Segunda', 'Terceira'][k - 1]} coluna`, ns));
  }
  const todos = Array.from({ length: 36 }, (_, i) => i + 1);
  lista.push(aposta('vermelho', 'simples', 'Vermelho', todos.filter(n => VERMELHOS.has(n))));
  lista.push(aposta('preto', 'simples', 'Preto', todos.filter(n => !VERMELHOS.has(n))));
  lista.push(aposta('par', 'simples', 'Par', todos.filter(n => n % 2 === 0)));
  lista.push(aposta('impar', 'simples', 'Ímpar', todos.filter(n => n % 2 === 1)));
  lista.push(aposta('baixo', 'simples', 'Baixo (1 a 18)', todos.filter(n => n <= 18)));
  lista.push(aposta('alto', 'simples', 'Alto (19 a 36)', todos.filter(n => n >= 19)));
  return lista;
}

export const APOSTAS = catalogo();
export const APOSTA_POR_ID = Object.fromEntries(APOSTAS.map(a => [a.id, a]));
export const NOME_TIPO = TIPOS;

// Cavalo pelo par de números, na ordem que for.
export function idCavalo(a, b) {
  const x = Math.min(a, b), y = Math.max(a, b);
  if (APOSTA_POR_ID[`c${x}-${y}`]) return `c${x}-${y}`;
  throw new Error(`${a} e ${b} não formam cavalo`);
}

// A conta de uma aposta: distribuição exata sobre as 37 casas.
export function fichaDe(id) {
  const a = APOSTA_POR_ID[id];
  const n = a.numeros.length;
  return fichaDaAposta(a.nome, [{ p: n / 37, x: a.paga }, { p: (37 - n) / 37, x: -1 }], `${a.paga} para 1`);
}

// Quanto uma aposta devolve (aposta + prêmio) quando sai o número.
export function retornoDe(id, valor, numero) {
  const a = APOSTA_POR_ID[id];
  return a.numeros.includes(numero) ? valor * (a.paga + 1) : 0;
}

// ---------------------------------------------------------------- pista francesa

// As apostas anunciadas, em unidades de ficha, com as apostas do pano que
// elas colocam. Vizinhos do zero: 9 fichas em 17 números; terço: 6 em 12;
// órfãos: 5 em 8; jogo zero: 4 em 7.
export const ANUNCIADAS = {
  vizinhos: {
    nome: 'Vizinhos do zero',
    apostas: [['t0-2-3', 2], ['c4-7', 1], ['c12-15', 1], ['c18-21', 1], ['c19-22', 1], ['c32-35', 1], ['q25', 2]],
  },
  terco: {
    nome: 'Terço',
    apostas: [['c5-8', 1], ['c10-11', 1], ['c13-16', 1], ['c23-24', 1], ['c27-30', 1], ['c33-36', 1]],
  },
  orfaos: {
    nome: 'Órfãos',
    apostas: [['p1', 1], ['c6-9', 1], ['c14-17', 1], ['c17-20', 1], ['c31-34', 1]],
  },
  jogozero: {
    nome: 'Jogo zero',
    apostas: [['c0-3', 1], ['c12-15', 1], ['p26', 1], ['c32-35', 1]],
  },
};

// Vizinhos de um número: ele e os dois de cada lado na roda, em pleno.
export function vizinhosDe(n, lado = 2) {
  const i = POSICAO_NA_RODA[n];
  const saida = [];
  for (let d = -lado; d <= lado; d++) saida.push(ORDEM_RODA[(i + d + 37) % 37]);
  return saida;
}

export function apostasAnunciada(nome, numero) {
  if (nome === 'vizinhosde') return vizinhosDe(numero).map(n => [`p${n}`, 1]);
  const a = ANUNCIADAS[nome];
  if (!a) throw new Error(`aposta anunciada desconhecida: ${nome}`);
  return a.apostas;
}

export function numerosAnunciada(nome, numero) {
  const s = new Set();
  for (const [id] of apostasAnunciada(nome, numero)) for (const n of APOSTA_POR_ID[id].numeros) s.add(n);
  return [...s];
}

// ---------------------------------------------------------------- rodada

// O resultado da rodada sai daqui, e só daqui: o primeiro inteiro de 0 a 36
// do gerador verificável.
export function derivar(gerador) {
  return gerador.inteiro(37);
}

// Conta exata da mesa inteira: para cada uma das 37 casas, quanto voltaria.
// Dá a perda esperada, a variância do resultado da rodada e a chance de
// alguma aposta pagar.
export function contaDaMesa(apostas) {
  let total = 0;
  for (const v of Object.values(apostas)) total += v;
  let m1 = 0, m2 = 0, algum = 0;
  for (let n = 0; n <= 36; n++) {
    let ret = 0;
    for (const [id, v] of Object.entries(apostas)) ret += retornoDe(id, v, n);
    const x = ret - total;
    m1 += x / 37; m2 += x * x / 37;
    if (ret > 0) algum++;
  }
  return { total, perdaEsperada: -m1, variancia: m2 - m1 * m1, chanceDeRetorno: algum / 37, vantagem: total ? -m1 / total : 1 / 37 };
}

export function resolver(apostas, numero) {
  const ganhos = [];
  let retorno = 0, total = 0;
  for (const [id, v] of Object.entries(apostas)) {
    total += v;
    const r = retornoDe(id, v, numero);
    if (r > 0) ganhos.push({ id, aposta: v, retorno: r });
    retorno += r;
  }
  return { retorno, total, ganhos };
}

export function nomeNumero(n) {
  if (n === 0) return 'zero';
  return `${n} ${corDe(n)}`;
}

// Painel Conferir: refaz o número com as três entradas publicadas.
export function conferir(registro) {
  const g = criarGerador(registro.semente, registro.sementeJogador, registro.contador);
  const n = derivar(g);
  const esperado = registro.resultado?.numero;
  return { confere: n === esperado, descricao: `o gerador dá ${nomeNumero(n)}; a mesa registrou ${esperado === undefined ? 'nada' : nomeNumero(esperado)}` };
}

export const VANTAGEM = 1 / 37;
