// Contas de valor esperado a partir da distribuição do resultado.
//
// Toda aposta de todo jogo é descrita do mesmo jeito: uma lista de
// { p, x }, em que p é a probabilidade e x o resultado líquido por ficha
// apostada (+35 no pleno que acerta, -1 no que erra, 0 no empate que devolve).
// A vantagem da casa exibida na mesa sai daqui, não de uma tabela copiada.

export function somaProb(dist) {
  let s = 0;
  for (const o of dist) s += o.p;
  return s;
}

export function valorEsperado(dist) {
  let s = 0;
  for (const o of dist) s += o.p * o.x;
  return s;
}

export function segundoMomento(dist) {
  let s = 0;
  for (const o of dist) s += o.p * o.x * o.x;
  return s;
}

export function variancia(dist) {
  const m = valorEsperado(dist);
  return segundoMomento(dist) - m * m;
}

export function vantagem(dist) {
  return -valorEsperado(dist);
}

// Probabilidade de a aposta dar lucro.
export function chanceDeGanhar(dist) {
  let s = 0;
  for (const o of dist) if (o.x > 0) s += o.p;
  return s;
}

// Junta resultados iguais e confere que a distribuição fecha em 1.
export function normalizar(dist, tolerancia = 1e-9) {
  const m = new Map();
  for (const o of dist) m.set(o.x, (m.get(o.x) ?? 0) + o.p);
  const saida = [...m].map(([x, p]) => ({ p, x })).filter(o => o.p > 0);
  const s = somaProb(saida);
  if (Math.abs(s - 1) > tolerancia) throw new Error(`distribuição soma ${s}, não 1`);
  return saida;
}

// Resumo de uma aposta para o painel e para a dica: o que a interface mostra.
export function fichaDaAposta(nome, dist, paga) {
  const d = normalizar(dist);
  return {
    nome,
    paga,
    chance: chanceDeGanhar(d),
    vantagem: vantagem(d),
    variancia: variancia(d),
    dist: d,
  };
}
