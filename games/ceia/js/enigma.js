// O gerador e o solucionador dos enigmas. Sem DOM.
//
// Um enigma de deducao so e justo se tiver UMA solucao e se toda pista for
// necessaria. As duas coisas nao dao para conferir no olho, entao o gerador nao
// entrega enigma nenhum sem antes:
//
//   1. resolver por forca bruta e exigir exatamente uma solucao;
//   2. tirar cada pista, uma por vez, e exigir que sem ela apareca mais de uma.
//
// A segunda e a que mantem o enigma limpo: pista que da para remover sem perder
// a unicidade e pista que o jogador le, gasta tempo e nao usa.

export const CONVIDADOS = ['ALMA', 'BENTO', 'CLARA', 'DIRCEU', 'ELISA'];
export const BEBIDAS = ['vinho', 'água', 'chá', 'licor', 'café'];
export const PRENDAS = ['livro', 'flores', 'relógio', 'caixa', 'carta'];
export const N = 5;

export const CATEGORIAS = [
  { chave: 'cadeira', rotulo: 'CADEIRA', valores: ['1', '2', '3', '4', '5'] },
  { chave: 'bebida', rotulo: 'BEBIDA', valores: BEBIDAS },
  { chave: 'prenda', rotulo: 'PRENDA', valores: PRENDAS },
];

function semente(n) {
  let s = n >>> 0;
  return () => {
    s = (s + 0x6D2B79F5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function permutacoes(lista) {
  if (lista.length <= 1) return [lista];
  const saida = [];
  for (let i = 0; i < lista.length; i++) {
    const resto = [...lista.slice(0, i), ...lista.slice(i + 1)];
    for (const p of permutacoes(resto)) saida.push([lista[i], ...p]);
  }
  return saida;
}

const PERMS = permutacoes([0, 1, 2, 3, 4]);

// ---------------------------------------------------------------- pistas
// Cada pista sabe se e verdadeira num arranjo e como se le em portugues.
// `usa` diz de quais categorias ela depende, e e o que permite podar cedo.
const TIPOS = {
  // A bebe X
  bebe: {
    usa: ['bebida'],
    vale: (p, a) => a.bebida[p.quem] === p.valor,
    texto: p => `${CONVIDADOS[p.quem]} bebeu ${BEBIDAS[p.valor]}.`,
  },
  naoBebe: {
    usa: ['bebida'],
    vale: (p, a) => a.bebida[p.quem] !== p.valor,
    texto: p => `${CONVIDADOS[p.quem]} não bebeu ${BEBIDAS[p.valor]}.`,
  },
  trouxe: {
    usa: ['prenda'],
    vale: (p, a) => a.prenda[p.quem] === p.valor,
    texto: p => `${CONVIDADOS[p.quem]} trouxe ${PRENDAS[p.valor]}.`,
  },
  naoTrouxe: {
    usa: ['prenda'],
    vale: (p, a) => a.prenda[p.quem] !== p.valor,
    texto: p => `${CONVIDADOS[p.quem]} não trouxe ${PRENDAS[p.valor]}.`,
  },
  cadeiraDe: {
    usa: ['cadeira'],
    vale: (p, a) => a.cadeira[p.quem] === p.valor,
    texto: p => `${CONVIDADOS[p.quem]} sentou na cadeira ${p.valor + 1}.`,
  },
  naoCadeira: {
    usa: ['cadeira'],
    vale: (p, a) => a.cadeira[p.quem] !== p.valor,
    texto: p => `${CONVIDADOS[p.quem]} não sentou na cadeira ${p.valor + 1}.`,
  },
  aEsquerdaDe: {
    usa: ['cadeira'],
    vale: (p, a) => a.cadeira[p.quem] === a.cadeira[p.outro] - 1,
    texto: p => `${CONVIDADOS[p.quem]} sentou logo à esquerda de ${CONVIDADOS[p.outro]}.`,
  },
  aoLadoDe: {
    usa: ['cadeira'],
    vale: (p, a) => Math.abs(a.cadeira[p.quem] - a.cadeira[p.outro]) === 1,
    texto: p => `${CONVIDADOS[p.quem]} sentou ao lado de ${CONVIDADOS[p.outro]}.`,
  },
  antesDe: {
    usa: ['cadeira'],
    vale: (p, a) => a.cadeira[p.quem] < a.cadeira[p.outro],
    texto: p => `${CONVIDADOS[p.quem]} sentou em alguma cadeira antes de ${CONVIDADOS[p.outro]}.`,
  },
  // quem bebeu X trouxe Y
  bebidaPrenda: {
    usa: ['bebida', 'prenda'],
    vale: (p, a) => {
      const i = a.bebida.indexOf(p.valor);
      return a.prenda[i] === p.outroValor;
    },
    texto: p => `Quem bebeu ${BEBIDAS[p.valor]} trouxe ${PRENDAS[p.outroValor]}.`,
  },
  bebidaNaoPrenda: {
    usa: ['bebida', 'prenda'],
    vale: (p, a) => {
      const i = a.bebida.indexOf(p.valor);
      return a.prenda[i] !== p.outroValor;
    },
    texto: p => `Quem bebeu ${BEBIDAS[p.valor]} não trouxe ${PRENDAS[p.outroValor]}.`,
  },
  // quem bebeu X sentou ao lado de quem trouxe Y
  bebidaAoLadoPrenda: {
    usa: ['cadeira', 'bebida', 'prenda'],
    vale: (p, a) => {
      const i = a.bebida.indexOf(p.valor);
      const j = a.prenda.indexOf(p.outroValor);
      return i !== j && Math.abs(a.cadeira[i] - a.cadeira[j]) === 1;
    },
    texto: p => `Quem bebeu ${BEBIDAS[p.valor]} sentou ao lado de quem trouxe ${PRENDAS[p.outroValor]}.`,
  },
  bebidaNaCadeira: {
    usa: ['cadeira', 'bebida'],
    vale: (p, a) => a.cadeira[a.bebida.indexOf(p.valor)] === p.outroValor,
    texto: p => `Quem bebeu ${BEBIDAS[p.valor]} sentou na cadeira ${p.outroValor + 1}.`,
  },
  prendaNaCadeira: {
    usa: ['cadeira', 'prenda'],
    vale: (p, a) => a.cadeira[a.prenda.indexOf(p.valor)] === p.outroValor,
    texto: p => `Quem trouxe ${PRENDAS[p.valor]} sentou na cadeira ${p.outroValor + 1}.`,
  },
};

export function textoDaPista(p) { return TIPOS[p.tipo].texto(p); }
function valePista(p, arranjo) { return TIPOS[p.tipo].vale(p, arranjo); }
function usaDaPista(p) { return TIPOS[p.tipo].usa; }

// ---------------------------------------------------------------- solucionador
// Forca bruta com poda por categoria. As pistas que so olham cadeira filtram as
// 120 permutacoes de cadeira antes de a bebida entrar, e assim por diante: sem
// isso seriam 1,7 milhao de combinacoes por enigma, e a checagem de minimalidade
// roda o solucionador uma vez por pista.
export function resolver(pistas, limite = 2) {
  const so = cat => pistas.filter(p => {
    const u = usaDaPista(p);
    return u.length === 1 && u[0] === cat;
  });
  const cadeiraPistas = so('cadeira');
  const bebidaPistas = so('bebida');
  const prendaPistas = so('prenda');
  const cruzadas = pistas.filter(p => usaDaPista(p).length > 1);
  const cadeiraBebida = cruzadas.filter(p => !usaDaPista(p).includes('prenda'));
  const restantes = cruzadas.filter(p => usaDaPista(p).includes('prenda'));

  const cadeiras = PERMS.filter(c => cadeiraPistas.every(p => valePista(p, { cadeira: c })));
  const bebidas = PERMS.filter(b => bebidaPistas.every(p => valePista(p, { bebida: b })));
  const prendas = PERMS.filter(r => prendaPistas.every(p => valePista(p, { prenda: r })));

  const achadas = [];
  for (const cadeira of cadeiras) {
    for (const bebida of bebidas) {
      const parcial = { cadeira, bebida };
      if (!cadeiraBebida.every(p => valePista(p, parcial))) continue;
      for (const prenda of prendas) {
        const arranjo = { cadeira, bebida, prenda };
        if (!restantes.every(p => valePista(p, arranjo))) continue;
        achadas.push(arranjo);
        if (achadas.length >= limite) return achadas;
      }
    }
  }
  return achadas;
}

// ---------------------------------------------------------------- gerador
function sortear(rand, lista) { return lista[Math.floor(rand() * lista.length)]; }

function pistasPossiveis(arranjo, rand) {
  const pool = [];
  const push = p => { if (valePista(p, arranjo)) pool.push(p); };

  for (let quem = 0; quem < N; quem++) {
    for (let v = 0; v < N; v++) {
      push({ tipo: 'bebe', quem, valor: v });
      push({ tipo: 'naoBebe', quem, valor: v });
      push({ tipo: 'trouxe', quem, valor: v });
      push({ tipo: 'naoTrouxe', quem, valor: v });
      push({ tipo: 'cadeiraDe', quem, valor: v });
      push({ tipo: 'naoCadeira', quem, valor: v });
    }
    for (let outro = 0; outro < N; outro++) {
      if (outro === quem) continue;
      push({ tipo: 'aEsquerdaDe', quem, outro });
      push({ tipo: 'aoLadoDe', quem, outro });
      push({ tipo: 'antesDe', quem, outro });
    }
  }
  for (let v = 0; v < N; v++) {
    for (let w = 0; w < N; w++) {
      push({ tipo: 'bebidaPrenda', valor: v, outroValor: w });
      push({ tipo: 'bebidaNaoPrenda', valor: v, outroValor: w });
      push({ tipo: 'bebidaAoLadoPrenda', valor: v, outroValor: w });
      push({ tipo: 'bebidaNaCadeira', valor: v, outroValor: w });
      push({ tipo: 'prendaNaCadeira', valor: v, outroValor: w });
    }
  }
  // embaralha
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return pool;
}

export function gerar(sem) {
  const rand = semente(sem);
  const arranjo = {
    cadeira: sortear(rand, PERMS),
    bebida: sortear(rand, PERMS),
    prenda: sortear(rand, PERMS),
  };
  const pool = pistasPossiveis(arranjo, rand);

  // Junta pistas ate a solucao ficar unica.
  const escolhidas = [];
  for (const p of pool) {
    escolhidas.push(p);
    if (escolhidas.length >= 4 && resolver(escolhidas).length === 1) break;
  }
  if (resolver(escolhidas).length !== 1) return null;

  // Tira o que sobra: pista removivel sem perder a unicidade e pista que o
  // jogador le e nao usa.
  for (let i = escolhidas.length - 1; i >= 0; i--) {
    const sem_ela = escolhidas.filter((_, k) => k !== i);
    if (sem_ela.length >= 3 && resolver(sem_ela).length === 1) escolhidas.splice(i, 1);
  }

  // O veneno estava no calice de quem bebeu a bebida sorteada: resolver a grade
  // aponta o culpado, entao a acusacao e consequencia da deducao, nao um chute
  // separado.
  const bebidaDoVeneno = Math.floor(rand() * N);
  const culpado = arranjo.bebida.indexOf(bebidaDoVeneno);

  return {
    semente: sem,
    arranjo,
    pistas: escolhidas,
    bebidaDoVeneno,
    culpado,
  };
}

// Confere um palpite do jogador contra a solucao. Devolve o que esta errado por
// categoria, nunca celula a celula: apontar a celula exata entregaria o enigma.
export function conferir(enigma, palpite) {
  const erros = {};
  for (const { chave } of CATEGORIAS) {
    erros[chave] = 0;
    for (let i = 0; i < N; i++) {
      if (palpite[chave][i] !== enigma.arranjo[chave][i]) erros[chave]++;
    }
  }
  const total = Object.values(erros).reduce((a, b) => a + b, 0);
  return { erros, total, certo: total === 0 };
}
