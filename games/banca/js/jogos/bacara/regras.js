// Bacará punto banco: as regras da mesa e a conta exata delas.
//
// O bacará não tem decisão: as duas mãos são compradas por uma tabela fixa que
// existe há mais de um século. Por isso a vantagem da casa aqui não é estimada,
// é ENUMERADA: este arquivo percorre todo coup possível de um sapato cheio de
// oito baralhos, carta a carta e com remoção, e soma as probabilidades exatas.
// Sai 1,06% na Banca, 1,24% no Jogador e 14,36% no Empate que paga 8 para 1.
// Nenhum desses números está escrito à mão em lugar nenhum: provas/bacara.mjs
// recalcula todos.

import { baralhos, valorDe, INDICES } from '../../nucleo/baralho.js';
import { criarGerador } from '../../nucleo/justo.js';
import { fichaDaAposta } from '../../nucleo/estat.js';
import { pct } from '../../nucleo/formato.js';
import { sha256hex } from '../../nucleo/sha256.js';

export const REGRAS = {
  baralhos: 8,
  // O sapato tem 416 cartas e a carta de corte fica na 402: o coup que começa
  // com o sapato nessa posição ou depois dela é o último antes do embaralho.
  corte: 402,
  comissao: 0.05,
  empatePaga: 8,
  parPaga: 11,
  // Fichas inteiras: mínimo 5 fichas, máximo 2000 fichas por aposta.
  minimo: 500,
  maximo: 200000,
  ficha: 100,
};

export const TOTAL_SAPATO = REGRAS.baralhos * 52;

export const REGRAS_TEXTO = [
  'Oito baralhos num sapato de 416 cartas. A carta de corte está na 402: quando um coup começa depois dela, o sapato é embaralhado antes.',
  'O ás vale 1, do dois ao nove vale a figura do índice, e dez, valete, dama e rei valem 0. A mão é a soma das cartas módulo 10.',
  'Dão-se quatro cartas na ordem Jogador, Banca, Jogador, Banca.',
  'Oito ou nove nas duas primeiras cartas é natural: os dois lados param e o coup acaba.',
  'Sem natural, o Jogador compra a terceira carta com 0 a 5 e para com 6 ou 7.',
  'Se o Jogador parou, a Banca compra com 0 a 5 e para com 6 ou 7.',
  'Se o Jogador comprou uma terceira carta de valor t, a Banca compra assim: com 0, 1 ou 2 sempre; com 3 a menos que t seja 8; com 4 se t for de 2 a 7; com 5 se t for de 4 a 7; com 6 se t for 6 ou 7; com 7 ela para.',
  'Ganha a mão de total mais alto. O Jogador paga 1 para 1 e a Banca paga 1 para 1 menos 5% de comissão, isto é, 0,95 por ficha.',
  'No empate as apostas em Jogador e em Banca são devolvidas, e o Empate paga 8 para 1.',
  'Par do Jogador e Par da Banca pagam 11 para 1 quando as duas primeiras cartas daquele lado têm o mesmo índice, e valem só para essas duas cartas.',
  'As apostas são em fichas inteiras, de 5 a 2000 fichas cada. A comissão da Banca sai em centavo exato porque 5% de uma ficha é 5 centavos.',
];

// ----------------------------------------------------------------- as cartas

// Ás vale 1, dois a nove valem o índice, dez e figuras valem 0.
export function valorCarta(c) {
  const v = valorDe(c);
  return v <= 8 ? v + 1 : 0;
}

export function totalMao(cartas) {
  let s = 0;
  for (const c of cartas) s += valorCarta(c);
  return s % 10;
}

export function ehPar(cartas) {
  return cartas.length >= 2 && valorDe(cartas[0]) === valorDe(cartas[1]);
}

// --------------------------------------------------------- tabela de compra

export function jogadorCompra(total) {
  return total <= 5;
}

// terceiraDoJogador é o VALOR (0 a 9) da terceira carta do jogador, ou null se
// ele parou. Esta é a tabela inteira, sem caso especial escondido.
export function bancaCompra(totalBanca, terceiraDoJogador) {
  if (totalBanca >= 7) return false;
  if (terceiraDoJogador === null || terceiraDoJogador === undefined) return totalBanca <= 5;
  const t = terceiraDoJogador;
  if (totalBanca <= 2) return true;
  if (totalBanca === 3) return t !== 8;
  if (totalBanca === 4) return t >= 2 && t <= 7;
  if (totalBanca === 5) return t >= 4 && t <= 7;
  return t === 6 || t === 7; // totalBanca === 6
}

// Um coup inteiro, puro: recebe a função que tira a próxima carta do sapato.
export function jogarMao(tirar) {
  const jogador = [tirar()];
  const banca = [tirar()];
  jogador.push(tirar());
  banca.push(tirar());

  const parJogador = ehPar(jogador);
  const parBanca = ehPar(banca);
  let tj = totalMao(jogador);
  let tb = totalMao(banca);
  const natural = tj >= 8 || tb >= 8;

  if (!natural) {
    let terceira = null;
    if (jogadorCompra(tj)) {
      const c = tirar();
      jogador.push(c);
      terceira = valorCarta(c);
      tj = totalMao(jogador);
    }
    if (bancaCompra(tb, terceira)) {
      banca.push(tirar());
      tb = totalMao(banca);
    }
  }

  const vencedor = tj > tb ? 'jogador' : tb > tj ? 'banca' : 'empate';
  return { jogador, banca, totalJogador: tj, totalBanca: tb, vencedor, natural, parJogador, parBanca };
}

// O sapato inteiro sai do gerador verificável, e só dele.
export function derivar(gerador) {
  return gerador.embaralhar(baralhos(REGRAS.baralhos));
}

// -------------------------------------------------------------- enumeração

// O sapato cheio por ÍNDICE (13 índices de 32 cartas cada), não por valor: o
// par depende do índice, e dez, valete, dama e rei valem todos 0 mas não são
// par entre si. Os valores 0 a 9 saem dos índices, com o grupo do 0 juntando
// os quatro índices de figura (128 cartas).
const INDICES_N = 13;
const POR_INDICE = 32;
const VALOR_DO_INDICE = new Int8Array(INDICES_N);
for (let r = 0; r < INDICES_N; r++) VALOR_DO_INDICE[r] = r <= 8 ? r + 1 : 0;

const VENCEDORES = ['jogador', 'banca', 'empate'];

function calcularEnumeracao() {
  const t0 = Date.now();
  const total = INDICES_N * POR_INDICE;
  // junta[v][pj][pb]: probabilidade exata do coup terminar com aquele vencedor
  // (0 jogador, 1 banca, 2 empate), com par do jogador e com par da banca.
  const junta = [
    [[0, 0], [0, 0]],
    [[0, 0], [0, 0]],
    [[0, 0], [0, 0]],
  ];
  let naturais = 0;
  let sequencias = 0;
  let cartasMedias = 0;

  const ind = new Int32Array(INDICES_N).fill(POR_INDICE);
  const val = new Float64Array(10);

  // Um acumulador por desfecho, para não repetir a conta do índice do array.
  function somar(tj, tb, pj, pb, p, cartas) {
    const v = tj > tb ? 0 : tb > tj ? 1 : 2;
    junta[v][pj ? 1 : 0][pb ? 1 : 0] += p;
    cartasMedias += p * cartas;
    sequencias++;
  }

  for (let r0 = 0; r0 < INDICES_N; r0++) {
    const p0 = ind[r0] / total; ind[r0]--;
    for (let r1 = 0; r1 < INDICES_N; r1++) {
      const p1 = p0 * (ind[r1] / (total - 1)); ind[r1]--;
      for (let r2 = 0; r2 < INDICES_N; r2++) {
        const p2 = p1 * (ind[r2] / (total - 2)); ind[r2]--;
        for (let r3 = 0; r3 < INDICES_N; r3++) {
          const p3 = p2 * (ind[r3] / (total - 3));
          if (p3 === 0) continue;
          ind[r3]--;

          // Sobrou o sapato por valor, para as terceiras cartas.
          val.fill(0);
          for (let r = 0; r < INDICES_N; r++) val[VALOR_DO_INDICE[r]] += ind[r];

          const pj = r0 === r2;
          const pb = r1 === r3;
          const tj0 = (VALOR_DO_INDICE[r0] + VALOR_DO_INDICE[r2]) % 10;
          const tb0 = (VALOR_DO_INDICE[r1] + VALOR_DO_INDICE[r3]) % 10;

          if (tj0 >= 8 || tb0 >= 8) {
            naturais += p3;
            somar(tj0, tb0, pj, pb, p3, 4);
          } else if (jogadorCompra(tj0)) {
            const resto = total - 4;
            for (let t = 0; t < 10; t++) {
              const ct = val[t];
              if (ct === 0) continue;
              const pt = p3 * (ct / resto);
              const tj = (tj0 + t) % 10;
              if (bancaCompra(tb0, t)) {
                val[t]--;
                for (let u = 0; u < 10; u++) {
                  const cu = val[u];
                  if (cu === 0) continue;
                  somar(tj, (tb0 + u) % 10, pj, pb, pt * (cu / (resto - 1)), 6);
                }
                val[t]++;
              } else {
                somar(tj, tb0, pj, pb, pt, 5);
              }
            }
          } else if (bancaCompra(tb0, null)) {
            const resto = total - 4;
            for (let u = 0; u < 10; u++) {
              const cu = val[u];
              if (cu === 0) continue;
              somar(tj0, (tb0 + u) % 10, pj, pb, p3 * (cu / resto), 5);
            }
          } else {
            somar(tj0, tb0, pj, pb, p3, 4);
          }

          ind[r3]++;
        }
        ind[r2]++;
      }
      ind[r1]++;
    }
    ind[r0]++;
  }

  let soma = 0;
  const p = { jogador: 0, banca: 0, empate: 0 };
  let parJogador = 0;
  let parBanca = 0;
  let parAmbos = 0;
  const celulas = [];
  for (let v = 0; v < 3; v++) {
    for (let a = 0; a < 2; a++) {
      for (let b = 0; b < 2; b++) {
        const q = junta[v][a][b];
        soma += q;
        p[VENCEDORES[v]] += q;
        if (a) parJogador += q;
        if (b) parBanca += q;
        if (a && b) parAmbos += q;
        celulas.push({ vencedor: VENCEDORES[v], parJogador: a === 1, parBanca: b === 1, p: q });
      }
    }
  }

  return {
    soma,
    p,
    par: { jogador: parJogador, banca: parBanca, ambos: parAmbos },
    naturais,
    cartasMedias,
    sequencias,
    celulas,
    junta,
    ms: Date.now() - t0,
  };
}

let cache = null;
export function enumerar() {
  if (!cache) cache = calcularEnumeracao();
  return cache;
}

// Só para as provas: força o recálculo e mede o tempo.
export function recalcularEnumeracao() {
  cache = null;
  return enumerar();
}

export const ENUMERACAO = {
  get p() { return enumerar().p; },
  get par() { return enumerar().par; },
  get celulas() { return enumerar().celulas; },
  get soma() { return enumerar().soma; },
  get naturais() { return enumerar().naturais; },
  get cartasMedias() { return enumerar().cartasMedias; },
  get sequencias() { return enumerar().sequencias; },
  get ms() { return enumerar().ms; },
};

// ------------------------------------------------------------------ apostas

export const APOSTAS = ['jogador', 'banca', 'empate', 'parJogador', 'parBanca'];

export const NOME_APOSTA = {
  jogador: 'Jogador',
  banca: 'Banca',
  empate: 'Empate',
  parJogador: 'Par do Jogador',
  parBanca: 'Par da Banca',
};

export const PAGA_TEXTO = {
  jogador: '1 para 1',
  banca: '1 para 1 menos 5% de comissão',
  empate: '8 para 1',
  parJogador: '11 para 1',
  parBanca: '11 para 1',
};

// Resultado líquido por ficha apostada, dado o desfecho do coup.
export function liquidoPorFicha(id, celula) {
  if (id === 'jogador') return celula.vencedor === 'jogador' ? 1 : celula.vencedor === 'banca' ? -1 : 0;
  if (id === 'banca') return celula.vencedor === 'banca' ? 1 - REGRAS.comissao : celula.vencedor === 'jogador' ? -1 : 0;
  if (id === 'empate') return celula.vencedor === 'empate' ? REGRAS.empatePaga : -1;
  if (id === 'parJogador') return celula.parJogador ? REGRAS.parPaga : -1;
  if (id === 'parBanca') return celula.parBanca ? REGRAS.parPaga : -1;
  throw new Error(`aposta desconhecida: ${id}`);
}

function montarFichas() {
  const { celulas } = enumerar();
  const saida = {};
  for (const id of APOSTAS) {
    const dist = celulas.map(c => ({ p: c.p, x: liquidoPorFicha(id, c) }));
    saida[id] = fichaDaAposta(NOME_APOSTA[id], dist, PAGA_TEXTO[id]);
  }
  return saida;
}

let cacheFichas = null;
export function fichas() {
  if (!cacheFichas) cacheFichas = montarFichas();
  return cacheFichas;
}

export const FICHAS = {
  get jogador() { return fichas().jogador; },
  get banca() { return fichas().banca; },
  get empate() { return fichas().empate; },
  get parJogador() { return fichas().parJogador; },
  get parBanca() { return fichas().parBanca; },
};

// Quanto volta ao jogador (aposta devolvida + prêmio) numa aposta de `valor`
// centavos. Tudo em centavo inteiro: a aposta é múltipla de 100, então os 5%
// da comissão são 5 centavos por ficha, exatos.
export function retornoDe(id, valor, mao) {
  if (valor <= 0) return 0;
  const celula = { vencedor: mao.vencedor, parJogador: mao.parJogador, parBanca: mao.parBanca };
  if (id === 'jogador') return celula.vencedor === 'jogador' ? valor * 2 : celula.vencedor === 'empate' ? valor : 0;
  if (id === 'banca') {
    if (celula.vencedor === 'banca') return valor + (valor / 100) * (100 - REGRAS.comissao * 100);
    return celula.vencedor === 'empate' ? valor : 0;
  }
  if (id === 'empate') return celula.vencedor === 'empate' ? valor * (REGRAS.empatePaga + 1) : 0;
  if (id === 'parJogador') return celula.parJogador ? valor * (REGRAS.parPaga + 1) : 0;
  if (id === 'parBanca') return celula.parBanca ? valor * (REGRAS.parPaga + 1) : 0;
  throw new Error(`aposta desconhecida: ${id}`);
}

// A conta exata da mesa inteira: a distribuição conjunta dá a perda esperada e
// a VARIÂNCIA verdadeira de todas as apostas juntas, com a covariância entre
// elas incluída (apostar em Jogador e em Empate ao mesmo tempo não é a soma
// das duas variâncias: uma só paga quando a outra devolve).
export function contaDaMesa(apostas) {
  const { celulas } = enumerar();
  let media = 0;
  let segundo = 0;
  let chance = 0;
  for (const c of celulas) {
    let liquido = 0;
    for (const id of APOSTAS) {
      const v = apostas[id] ?? 0;
      if (v > 0) liquido += v * liquidoPorFicha(id, c);
    }
    media += c.p * liquido;
    segundo += c.p * liquido * liquido;
    if (liquido > 0) chance += c.p;
  }
  return { perdaEsperada: -media, variancia: segundo - media * media, chance };
}

export function totalApostado(apostas) {
  let s = 0;
  for (const id of APOSTAS) s += apostas[id] ?? 0;
  return s;
}

// --------------------------------------------------------------- vitrine

export function textoDaMao(mao) {
  const quem = mao.vencedor === 'empate' ? 'empate' : mao.vencedor === 'banca' ? 'Banca' : 'Jogador';
  const pares = [mao.parJogador ? 'par do Jogador' : null, mao.parBanca ? 'par da Banca' : null].filter(Boolean);
  const extra = (mao.natural ? ', natural' : '') + (pares.length ? `, ${pares.join(' e ')}` : '');
  const desfecho = mao.vencedor === 'empate' ? `empate em ${mao.totalJogador}` : `${quem} ganha`;
  return `${mao.totalJogador} contra ${mao.totalBanca}, ${desfecho}${extra}`;
}

export function indiceDa(c) {
  return INDICES[valorDe(c)];
}

// A placa do saguão: os três números que importam, calculados.
export function placa() {
  const f = fichas();
  return [
    { rotulo: 'Banca', valor: pct(f.banca.vantagem, 2) },
    { rotulo: 'Jogador', valor: pct(f.jogador.vantagem, 2) },
    { rotulo: 'Empate', valor: pct(f.empate.vantagem, 2) },
  ];
}

// Assinatura curta do sapato inteiro: é o que a sessão arquiva ao revelar a
// semente, e é o que o painel Conferir recalcula.
export function assinaturaDoSapato(cartas) {
  return sha256hex(cartas.join(','));
}

// Painel Conferir: com as três entradas publicadas, o sapato inteiro tem de
// sair igual, carta a carta.
export function conferir(registro) {
  const g = criarGerador(registro.semente, registro.sementeJogador, registro.contador);
  const cartas = derivar(g);
  const assinatura = assinaturaDoSapato(cartas);
  const esperada = registro.resultado?.assinatura;
  const confere = assinatura === esperada;
  const coups = registro.resultado?.coups ?? 0;
  return {
    confere,
    descricao: confere
      ? `o sapato de ${cartas.length} cartas sai idêntico da semente revelada; ${coups} coups saíram dele`
      : `o sapato recalculado assina ${assinatura.slice(0, 16)} e a mesa registrou ${String(esperada ?? 'nada').slice(0, 16)}`,
  };
}
