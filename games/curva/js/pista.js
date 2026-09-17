// As seis pistas, escritas como um projetista de kartodromo escreve: sequencia
// de retas e curvas, cada curva com raio e angulo em graus.
//
// O formato anterior era polar estrelado — raio por angulo em volta de um
// centro — e ele garantia de graca que a pista nunca cruza consigo mesma. Foi
// trocado por um motivo medido: a 32 m do centro, 12 graus de arco tem de girar
// 140 graus, o que da uma curva de 2,6 m de raio. Em polar, a curva mais fechada
// que cabe vale mais ou menos o proprio raio do ponto, e por isso as seis pistas
// antigas tinham curvatura maxima de 0,008 a 0,04: raio de 24 a 122 m. Isso e
// rodovia. Kartodromo tem grampo de 10 a 14 m, e sem grampo nao existe
// derrapagem, nem mini-turbo, nem jogo.
//
// O que se perdeu na troca (a garantia de nao cruzar) virou prova em
// provas.mjs, que mede a distancia entre trechos nao vizinhos da fita.
//
// DUAS REGRAS deste arquivo, e as duas sao verificaveis:
//
// 1. A soma dos angulos das curvas de cada pista e 360 exatos. E o que fecha o
//    RUMO: sem isso a pista termina apontando para outro lado.
// 2. O comprimento das retas fecha a POSICAO. Alongar uma reta translada
//    rigidamente tudo que vem depois dela, entao o erro de fechamento e linear
//    nos comprimentos de reta — e `fecharCircuito` resolve isso exatamente, em
//    um passo, com correcao de norma minima. Os numeros gravados aqui ja sao a
//    solucao; o solucionador roda em `carregar` so para absorver o arredondamento
//    de uma casa decimal.
//
// O relevo vem de uma segunda lista, `colinas`, em (fracao da volta, altura em
// metros). Ele nao e enfeite de render: a componente de gravidade ao longo da
// subida entra na fisica, entao ladeira freia e descida solta o kart.
//
// Nada aqui toca em DOM: `carregar` devolve a geometria amostrada de 2 em 2 m,
// com curvatura exata, largura, altura, sobrelevacao, setores, grid e as caixas
// de item — e e isso que a fisica, a linha de corrida, a IA e o render 3D leem.

const PASSO = 2;
const INCLINACAO_MAXIMA = 0.42;

export const PISTAS = [
  {
    nome: 'BAIXADA',
    cenario: 'arvore',
    tema: 'Kartodromo de fundo de vale: reta de 120 m, dois grampos e uma lomba',
    largura: 9.5,
    voltas: 5,
    paleta: {
      asfalto: '#43434c', zebra: '#c8483c', grama: '#4a6b3a',
      ceu: '#7fb4d8', ceuBaixo: '#d8e4ec', neblina: '#a8c4d8', linha: '#e8e8e0',
    },
    trechos: [
      { reta: 119.8 }, { curva: 90, raio: 20 }, { reta: 15.2 }, { curva: 85, raio: 26 },
      { reta: 12.3 }, { curva: -110, raio: 30 }, { reta: 82.1 }, { curva: 175, raio: 11 },
      { reta: 12 }, { curva: -120, raio: 24 }, { reta: 13.3 }, { curva: 80, raio: 22 },
      { reta: 12.2 }, { curva: 90, raio: 18 }, { reta: 116.7 }, { curva: -100, raio: 28 },
      { reta: 12.2 }, { curva: 170, raio: 12 },
    ],
    colinas: [[0, 0], [0.17, 5], [0.34, 1], [0.5, 8], [0.67, 2], [0.84, 6]],
  },
  {
    nome: 'CANAVIAL',
    cenario: 'cana',
    tema: 'Reta de 138 m entre canaviais, grampo no fim de cada ponta',
    largura: 10,
    voltas: 4,
    paleta: {
      asfalto: '#40404a', zebra: '#d8c83c', grama: '#6b7a2c',
      ceu: '#8cc0e0', ceuBaixo: '#e4ecd8', neblina: '#b4c8a0', linha: '#f0ecd8',
    },
    trechos: [
      { reta: 138.4 }, { curva: 90, raio: 20 }, { reta: 16.6 }, { curva: 85, raio: 26 },
      { reta: 19.6 }, { curva: -110, raio: 30 }, { reta: 92.8 }, { curva: 175, raio: 12 },
      { reta: 15.8 }, { curva: -120, raio: 24 }, { reta: 17.8 }, { curva: 80, raio: 22 },
      { reta: 19 }, { curva: 90, raio: 18 }, { reta: 127.2 }, { curva: -100, raio: 28 },
      { reta: 19.4 }, { curva: 170, raio: 12 },
    ],
    colinas: [[0, 0], [0.12, 2.5], [0.25, 10.5], [0.4, 5.5], [0.55, 0], [0.7, 6],
      [0.85, 11.5]],
  },
  {
    nome: 'SERRA',
    cenario: 'arvore',
    tema: 'Subida de serra: tres grampos, nada de reta e 20 m de desnivel',
    largura: 8.5,
    voltas: 6,
    paleta: {
      asfalto: '#3e3e46', zebra: '#e0e0d8', grama: '#3f5c34',
      ceu: '#6fa8cc', ceuBaixo: '#c8d8e0', neblina: '#94b0c0', linha: '#e8e8e0',
    },
    trechos: [
      { reta: 117.9 }, { curva: 175, raio: 10 }, { reta: 8.1 }, { curva: -100, raio: 20 },
      { reta: 68.9 }, { curva: 170, raio: 11 }, { reta: 8.1 }, { curva: -110, raio: 18 },
      { reta: 9.1 }, { curva: 85, raio: 16 }, { reta: 8.1 }, { curva: -105, raio: 22 },
      { reta: 8 }, { curva: 165, raio: 12 }, { reta: 103 }, { curva: 80, raio: 19 },
    ],
    colinas: [[0, 0], [0.14, 6], [0.28, 14], [0.42, 15.5], [0.56, 10], [0.7, 14],
      [0.84, 7]],
  },
  {
    nome: 'PORTO',
    cenario: 'armazem',
    tema: 'Rua entre armazens: oito noventas secos de 12 a 16 m e muro perto',
    largura: 9,
    voltas: 6,
    paleta: {
      asfalto: '#46464e', zebra: '#c0c0b8', grama: '#525a60',
      ceu: '#6f90b0', ceuBaixo: '#c0ccd4', neblina: '#8fa4b4', linha: '#f0f0e8',
    },
    trechos: [
      { reta: 97 }, { curva: 90, raio: 13 }, { reta: 55 }, { curva: 90, raio: 14 },
      { reta: 16 }, { curva: -90, raio: 12 }, { reta: 41 }, { curva: 90, raio: 15 },
      { reta: 12 }, { curva: 90, raio: 12 }, { reta: 41 }, { curva: -90, raio: 13 },
      { reta: 14 }, { curva: 90, raio: 16 }, { reta: 54 }, { curva: 90, raio: 14 },
    ],
    colinas: [[0, 0], [0.16, 2], [0.33, 8.5], [0.5, 10.5], [0.66, 3], [0.83, 7.5]],
  },
  {
    nome: 'CERRADO',
    cenario: 'cupinzeiro',
    tema: 'Pista rapida de curvas longas (30 a 45 m), um grampo e duas lombas',
    largura: 11,
    voltas: 4,
    paleta: {
      asfalto: '#44403a', zebra: '#d87c3c', grama: '#7a6636',
      ceu: '#9cbcd0', ceuBaixo: '#e8dcc0', neblina: '#c8b48c', linha: '#f4ecd8',
    },
    trechos: [
      { reta: 106 }, { curva: 80, raio: 40 }, { reta: 47.1 }, { curva: -70, raio: 45 },
      { reta: 16 }, { curva: 75, raio: 38 }, { reta: 64.1 }, { curva: 160, raio: 14 },
      { reta: 31.9 }, { curva: -65, raio: 42 }, { reta: 59 }, { curva: 85, raio: 32 },
      { reta: 19.9 }, { curva: -65, raio: 36 }, { reta: 58 }, { curva: 70, raio: 30 },
      { reta: 16.9 }, { curva: 90, raio: 26 },
    ],
    colinas: [[0, 0], [0.12, 7], [0.25, 12.5], [0.37, 3], [0.5, 8.5], [0.62, 14],
      [0.75, 4.5], [0.87, 10]],
  },
  {
    nome: 'VIADUTO',
    cenario: 'armazem',
    tema: 'Estreito e cego: duas chicanes, um grampo e muro dos dois lados',
    largura: 8,
    voltas: 6,
    paleta: {
      asfalto: '#3a3a42', zebra: '#e0483c', grama: '#42424c',
      ceu: '#4f6484', ceuBaixo: '#98a8bc', neblina: '#6f7f94', linha: '#e4e4ec',
    },
    trechos: [
      { reta: 11.2 }, { curva: 90, raio: 15 }, { reta: 21 }, { curva: -60, raio: 18 },
      { reta: 16.2 }, { curva: 60, raio: 18 }, { reta: 14 }, { curva: -95, raio: 20 },
      { reta: 13.2 }, { curva: 80, raio: 17 }, { reta: 48.1 }, { curva: 165, raio: 11 },
      { reta: 49.9 }, { curva: -60, raio: 16 }, { reta: 70.8 }, { curva: 60, raio: 16 },
      { reta: 55.9 }, { curva: 85, raio: 14 }, { reta: 12.1 }, { curva: -35, raio: 24 },
      { reta: 19 }, { curva: 70, raio: 20 },
    ],
    colinas: [[0, 0], [0.14, 2], [0.28, 7.5], [0.42, 8.5], [0.56, 3], [0.7, 6.5],
      [0.85, 8]],
  },
];

// Um trecho declarado vira (curvatura, comprimento): reta e curvatura zero,
// curva e 1/raio com sinal do lado. Dai para frente a pista e analitica — nada
// de spline, e a curvatura de cada metro e exata, e nao uma diferenca finita.
function emSegmentos(trechos) {
  return trechos.map(t => (t.reta !== undefined
    ? { k: 0, L: t.reta }
    : {
      k: Math.sign(t.curva) / t.raio,
      L: (Math.abs(t.curva) * Math.PI / 180) * t.raio,
    }));
}

// Onde a fita termina, se ela fosse percorrida do zero: forma fechada do arco,
// para o erro de fechamento nao carregar erro de integracao numerica.
function pontaDe(segs) {
  let x = 0;
  let y = 0;
  let ang = 0;
  for (const s of segs) {
    if (s.k === 0) {
      x += Math.cos(ang) * s.L;
      y += Math.sin(ang) * s.L;
    } else {
      const a2 = ang + s.k * s.L;
      x += (Math.sin(a2) - Math.sin(ang)) / s.k;
      y -= (Math.cos(a2) - Math.cos(ang)) / s.k;
      ang = a2;
    }
  }
  return [x, y, ang];
}

// Fecha a POSICAO mexendo so nas retas. Alongar uma reta translada rigidamente
// tudo que vem depois dela, entao o erro de fechamento e exatamente linear nos
// comprimentos de reta: duas equacoes, N incognitas, correcao de norma minima
// resolvida em um passo. Raio e angulo de curva nunca mudam aqui — sao intencao
// de projeto, e mexer neles mentiria sobre a pista.
function fecharCircuito(segs, minimo = 6) {
  const L = segs.map(s => s.L);
  for (let volta = 0; volta < 6; volta++) {
    const atual = segs.map((s, i) => ({ k: s.k, L: L[i] }));
    const [gx, gy] = pontaDe(atual);
    if (Math.hypot(gx, gy) < 1e-9) break;
    const dir = [];
    let ang = 0;
    for (const s of atual) {
      if (s.k === 0) dir.push([Math.cos(ang), Math.sin(ang)]);
      else ang += s.k * s.L;
    }
    let a = 1e-9;
    let b = 0;
    let c = 1e-9;
    for (const d of dir) { a += d[0] * d[0]; b += d[0] * d[1]; c += d[1] * d[1]; }
    const det = a * c - b * b;
    if (Math.abs(det) < 1e-12) break;
    const lam = [(-gx * c + b * gy) / det, (-gy * a + b * gx) / det];
    let i = 0;
    for (const [j, s] of atual.entries()) {
      if (s.k !== 0) continue;
      L[j] = Math.max(minimo, L[j] + dir[i][0] * lam[0] + dir[i][1] * lam[1]);
      i++;
    }
  }
  return segs.map((s, i) => ({ k: s.k, L: L[i] }));
}

// Relevo: interpolacao suave entre as colinas declaradas, respeitando a fracao
// de volta de cada uma. A curva de suavizacao tem derivada zero em cada colina
// declarada, e isso nao e detalhe: garante que a rampa nao tenha degrau na
// junta, e o degrau de rampa aparece na fisica como um empurrao de gravidade
// que ninguem pediu.
function alturaEm(colinas, fracao) {
  const n = colinas.length;
  const f = ((fracao % 1) + 1) % 1;
  let i = n - 1;
  for (let k = 0; k < n; k++) if (colinas[k][0] <= f) i = k;
  const [f0, h0] = colinas[i];
  const [f1bruto, h1] = colinas[(i + 1) % n];
  const inicio = f0 <= f ? f0 : f0 - 1;
  const fim = f1bruto > inicio ? f1bruto : f1bruto + 1;
  const t = fim - inicio < 1e-9 ? 0 : (f - inicio) / (fim - inicio);
  const suave = t * t * (3 - 2 * t);
  return h0 + (h1 - h0) * suave;
}

// Onde por a linha de largada: dentro da reta mais comprida, com pelo menos
// `RECUO_DO_GRID` metros de reta ATRAS dela (o grid ocupa 48 m) e uma sobra na
// frente. Devolve o indice da amostragem que vira o zero.
const RECUO_DO_GRID = 52;

function escolherLargada(centro, passo) {
  const n = centro.length;
  const reto = (i) => Math.abs(centro[((i % n) + n) % n].curvatura) < 1e-9;
  let melhor = { comeco: 0, tamanho: 0 };
  let i = 0;
  // Comeca a varredura numa curva, para nao cortar uma reta em duas na volta
  while (i < n && reto(i)) i++;
  const partida = i % n;
  for (let k = 0; k < n; k++) {
    const indice = (partida + k) % n;
    if (!reto(indice)) continue;
    let tamanho = 0;
    while (tamanho < n && reto(indice + tamanho)) tamanho++;
    if (tamanho > melhor.tamanho) melhor = { comeco: indice, tamanho };
    k += tamanho;
  }
  if (!melhor.tamanho) return 0;
  const metros = melhor.tamanho * passo;
  const recuo = Math.min(RECUO_DO_GRID, metros * 0.62);
  return (melhor.comeco + Math.round(recuo / passo)) % n;
}

export function carregar(pista) {
  const segs = fecharCircuito(emSegmentos(pista.trechos));
  const comprimento = segs.reduce((s, x) => s + x.L, 0);
  const quantidade = Math.max(64, Math.round(comprimento / PASSO));
  const passo = comprimento / quantidade;

  // Amostragem analitica: cada ponto sai da forma fechada do seu proprio trecho,
  // entao rumo e curvatura sao exatos em vez de estimados por vizinho.
  const centro = [];
  let x = 0;
  let y = 0;
  let ang = 0;
  let sobra = 0;
  for (const s of segs) {
    let t = sobra;
    while (t < s.L - 1e-9 && centro.length < quantidade) {
      if (s.k === 0) {
        centro.push({
          x: x + Math.cos(ang) * t, y: y + Math.sin(ang) * t, ang, curvatura: 0,
        });
      } else {
        const a2 = ang + s.k * t;
        centro.push({
          x: x + (Math.sin(a2) - Math.sin(ang)) / s.k,
          y: y - (Math.cos(a2) - Math.cos(ang)) / s.k,
          ang: a2,
          curvatura: s.k,
        });
      }
      t += passo;
    }
    sobra = t - s.L;
    if (s.k === 0) {
      x += Math.cos(ang) * s.L;
      y += Math.sin(ang) * s.L;
    } else {
      const a2 = ang + s.k * s.L;
      x += (Math.sin(a2) - Math.sin(ang)) / s.k;
      y -= (Math.cos(a2) - Math.cos(ang)) / s.k;
      ang = a2;
    }
  }

  // A linha de largada vai para a reta mais comprida, e o grid nasce atras
  // dela. Sem isto, o indice 0 caia onde a lista de trechos comecou — na
  // BAIXADA, dentro do grampo de 12 m — e dez karts largavam em curva: quem
  // acelerava reto ia para a grama antes do primeiro comando. E a amostragem
  // toda que gira, entao setor, grid, linha de corrida e a faixa branca do
  // asfalto continuam concordando entre si.
  const largada = escolherLargada(centro, passo);
  if (largada > 0) centro.push(...centro.splice(0, largada));

  let curvaturaTotal = 0;
  for (const [i, c] of centro.entries()) {
    c.s = i * passo;
    c.largura = larguraEm(pista, i / centro.length);
    c.z = alturaEm(pista.colinas, i / centro.length);
    curvaturaTotal += Math.abs(c.curvatura);
    // Sobrelevacao: a pista se inclina para dentro da curva, proporcional a
    // curvatura, com teto. E o que faz a curva rapida parecer rapida.
    c.inclinacao = Math.max(-INCLINACAO_MAXIMA,
      Math.min(INCLINACAO_MAXIMA, c.curvatura * 5.2));
  }
  for (const [i, c] of centro.entries()) {
    const ant = centro[(i - 1 + centro.length) % centro.length];
    const prox = centro[(i + 1) % centro.length];
    // Rampa: quanto a pista sobe por metro andado. Entra na fisica como
    // componente de gravidade, e no render como altura do vertice.
    c.subida = (prox.z - ant.z) / (passo * 2);
  }

  let comprimento3d = 0;
  for (const [i, c] of centro.entries()) {
    const prox = centro[(i + 1) % centro.length];
    comprimento3d += Math.hypot(prox.x - c.x, prox.y - c.y, prox.z - c.z);
  }

  const p = {
    nome: pista.nome,
    tema: pista.tema,
    cenario: pista.cenario,
    paleta: pista.paleta,
    voltas: pista.voltas,
    centro,
    passo,
    comprimento,
    comprimento3d,
    curvaturaMedia: curvaturaTotal / centro.length,
    setores: [0, Math.floor(centro.length / 3), Math.floor((centro.length * 2) / 3)],
  };
  p.busca = indexar(p);
  p.grade = montarGrade(p);
  p.caixas = montarCaixas(p);
  return p;
}

function larguraEm(pista, fracao) {
  const onda = Math.sin(fracao * Math.PI * 4);
  return pista.largura * (1 + onda * 0.08);
}

// Grade espacial: varrer as 700 amostras por quadro, para dez karts, custaria
// mais que a fisica inteira.
function indexar(p) {
  const celula = 24;
  const mapa = new Map();
  for (const [i, c] of p.centro.entries()) {
    const cx = Math.floor(c.x / celula);
    const cy = Math.floor(c.y / celula);
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        const chave = `${cx + dx},${cy + dy}`;
        if (!mapa.has(chave)) mapa.set(chave, []);
        mapa.get(chave).push(i);
      }
    }
  }
  return { celula, mapa };
}

export function maisProximo(p, x, y) {
  const { celula, mapa } = p.busca;
  const chave = `${Math.floor(x / celula)},${Math.floor(y / celula)}`;
  const candidatos = mapa.get(chave);
  let melhor = -1;
  let melhorD = Infinity;
  if (candidatos) {
    for (const i of candidatos) {
      const c = p.centro[i];
      const d = (c.x - x) ** 2 + (c.y - y) ** 2;
      if (d < melhorD) { melhorD = d; melhor = i; }
    }
  } else {
    for (const [i, c] of p.centro.entries()) {
      const d = (c.x - x) ** 2 + (c.y - y) ** 2;
      if (d < melhorD) { melhorD = d; melhor = i; }
    }
  }
  const c = p.centro[melhor];
  const nx = -Math.sin(c.ang);
  const ny = Math.cos(c.ang);
  const lateral = (x - c.x) * nx + (y - c.y) * ny;
  return {
    i: melhor, s: c.s, lateral, ang: c.ang,
    largura: c.largura, z: c.z, subida: c.subida, inclinacao: c.inclinacao,
  };
}

const SUPERFICIES = {
  asfalto: { tipo: 'asfalto', atrito: 1 },
  zebra: { tipo: 'zebra', atrito: 0.84 },
  grama: { tipo: 'grama', atrito: 0.46 },
  muro: { tipo: 'muro', atrito: 0.4 },
};

export const LIMITE_ZEBRA = 1.4;
export const LIMITE_GRAMA = 7;

export function superficie(p, x, y) {
  const perto = maisProximo(p, x, y);
  const borda = perto.largura / 2;
  const fora = Math.abs(perto.lateral);
  let tipo = 'asfalto';
  if (fora > borda + LIMITE_GRAMA) tipo = 'muro';
  else if (fora > borda + LIMITE_ZEBRA) tipo = 'grama';
  else if (fora > borda) tipo = 'zebra';
  return { ...SUPERFICIES[tipo], ...perto };
}

// Altura do chao num ponto qualquer, contando a sobrelevacao lateral. E o que o
// kart usa para ficar colado na pista e o que o render usa para o vertice.
export function alturaDoChao(p, x, y) {
  const perto = maisProximo(p, x, y);
  return perto.z + perto.lateral * perto.inclinacao * 0.5;
}

function montarGrade(p) {
  const grade = [];
  for (let n = 0; n < 10; n++) {
    // 10 m de recuo e 7 m entre fileiras: dez karts em 38 m. Com 9 m entre
    // fileiras o grid da VIADUTO (reta de 71 m) alcancava a curva anterior, e a
    // ultima fila largava apontada para o muro.
    const recuo = 10 + Math.floor(n / 2) * 7;
    const i = (p.centro.length - Math.round(recuo / p.passo)) % p.centro.length;
    const c = p.centro[(i + p.centro.length) % p.centro.length];
    const nx = -Math.sin(c.ang);
    const ny = Math.cos(c.ang);
    const lado = n % 2 ? 1 : -1;
    const desvio = lado * Math.min(2.6, c.largura / 2 - 1.6);
    grade.push({ x: c.x + nx * desvio, y: c.y + ny * desvio, z: c.z, ang: c.ang });
  }
  return grade;
}

// Caixas de item: tres fileiras por volta, atravessadas na pista. Ficam em
// trecho reto de proposito — pegar item nao pode competir com fazer a curva.
function montarCaixas(p) {
  const caixas = [];
  const n = p.centro.length;
  for (const fracao of [0.18, 0.5, 0.78]) {
    let melhor = null;
    const base = Math.floor(n * fracao);
    for (let d = 0; d < Math.floor(n * 0.1); d++) {
      for (const i of [base + d, base - d]) {
        const c = p.centro[((i % n) + n) % n];
        const reto = Math.abs(c.curvatura);
        if (!melhor || reto < melhor.reto) melhor = { i: ((i % n) + n) % n, reto, c };
      }
      if (melhor && melhor.reto < 0.002) break;
    }
    const c = melhor.c;
    const nx = -Math.sin(c.ang);
    const ny = Math.cos(c.ang);
    for (let k = -2; k <= 2; k++) {
      // Espacamento de largura/5, nao largura/6: com 1,6 m entre caixas e 1,7 m
      // de alcance, passar numa caixa pegava a vizinha no quadro seguinte.
      const desvio = (k * c.largura) / 5;
      caixas.push({
        x: c.x + nx * desvio, y: c.y + ny * desvio, z: c.z,
        indice: melhor.i, cheia: true, relogio: 0,
      });
    }
  }
  return caixas;
}

export function paraMundo(p, i, lateral) {
  const c = p.centro[((i % p.centro.length) + p.centro.length) % p.centro.length];
  const nx = -Math.sin(c.ang);
  const ny = Math.cos(c.ang);
  return {
    x: c.x + nx * lateral,
    y: c.y + ny * lateral,
    z: c.z + lateral * c.inclinacao * 0.5,
    ang: c.ang,
  };
}

export { PASSO, INCLINACAO_MAXIMA };
