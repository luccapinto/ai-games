// Os mapas do GUARDRAIL.
//
// Um mapa e (1) rotas, escritas como cantos ortogonais, e (2) retangulos de
// laje construivel. Tudo que nao e laje nem rota e chao morto: nao da para
// construir ali. Escrever assim, e nao como desenho ASCII, tem um motivo
// pratico: retangulo nao tem como estar torto por um caractere, e a expansao
// das rotas e verificavel — provas.mjs confere que toda rota e ortogonal,
// continua, que ela nunca passa por cima de uma laje e que sobra laje
// bastante para montar defesa.
//
// O mapa inteiro cabe na tela: 24 x 15 celulas de 40px = 960 x 600. Nao ha
// rolagem em lugar nenhum do jogo, de proposito.

export const CELULA = 40;
export const LARGURA = 24;
export const ALTURA = 15;

// Expande uma lista de cantos em celulas, uma a uma. Exige segmentos
// ortogonais: se alguem escrever uma diagonal, isto estoura na carga e nao
// vira um caminho torto em silencio.
export function expandirRota(cantos) {
  const cels = [];
  for (let i = 0; i < cantos.length - 1; i++) {
    const [ax, ay] = cantos[i];
    const [bx, by] = cantos[i + 1];
    if (ax !== bx && ay !== by) {
      throw new Error(`rota diagonal entre (${ax},${ay}) e (${bx},${by})`);
    }
    const dx = Math.sign(bx - ax);
    const dy = Math.sign(by - ay);
    let x = ax;
    let y = ay;
    while (x !== bx || y !== by) {
      cels.push([x, y]);
      x += dx;
      y += dy;
    }
  }
  cels.push(cantos[cantos.length - 1].slice());
  return cels;
}

// Posicao continua ao longo da rota, em coordenadas de celula (centro da
// celula = inteiro + 0,5). `d` e a distancia andada, em celulas.
export function posicaoNaRota(cels, d) {
  const n = cels.length;
  if (d <= 0) {
    const [x, y] = cels[0];
    return { x: x + 0.5, y: y + 0.5 };
  }
  if (d >= n - 1) {
    const [x, y] = cels[n - 1];
    return { x: x + 0.5, y: y + 0.5 };
  }
  const i = Math.floor(d);
  const t = d - i;
  const [ax, ay] = cels[i];
  const [bx, by] = cels[i + 1];
  return { x: ax + 0.5 + (bx - ax) * t, y: ay + 0.5 + (by - ay) * t };
}

function laje(rects) {
  const set = new Set();
  for (const [x0, y0, x1, y1] of rects) {
    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        if (x >= 0 && x < LARGURA && y >= 0 && y < ALTURA) set.add(y * LARGURA + x);
      }
    }
  }
  return set;
}

const DEFINICOES = [
  {
    id: 'datacenter',
    nome: 'DATACENTER',
    apelido: 'A serpente de corredor frio',
    dica: 'Rota unica e longa: da para empilhar alcance perto das curvas. O cluster e generoso aqui — e por isso que este mapa ensina a gastar VRAM sem medo.',
    vram: 26,
    dinheiro: 340,
    vidas: 20,
    piso: '#171c24',
    rotas: [
      { entrada: 'oeste', cantos: [[-1, 2], [19, 2], [19, 7], [4, 7], [4, 12], [22, 12]] },
    ],
    lajes: [
      [0, 0, 23, 1], [0, 3, 23, 3], [0, 4, 2, 6], [5, 4, 8, 6], [11, 4, 15, 6],
      [18, 4, 23, 6], [0, 8, 23, 8], [0, 9, 4, 11], [7, 9, 11, 11], [14, 9, 17, 11],
      [20, 9, 23, 11], [0, 13, 23, 14],
    ],
  },
  {
    id: 'cruzamento',
    nome: 'CRUZAMENTO',
    apelido: 'Dois pipelines, um cluster',
    dica: 'Duas entradas, dois pipelines, um cluster so — e eles se cruzam tres vezes. As celulas das cruzes valem por duas torres, e o cluster aqui e apertado: quantizar deixa de ser opcional.',
    vram: 22,
    dinheiro: 440,
    vidas: 20,
    piso: '#191823',
    rotas: [
      { entrada: 'oeste', cantos: [[-1, 2], [20, 2], [20, 6], [4, 6], [4, 9], [16, 9], [16, 12], [12, 12]] },
      { entrada: 'leste', cantos: [[24, 4], [8, 4], [8, 7], [18, 7], [18, 10], [2, 10], [2, 12], [12, 12]] },
    ],
    lajes: [
      [0, 0, 23, 1], [0, 3, 23, 3], [0, 5, 23, 5], [0, 8, 23, 8],
      // O canto sudeste fica a mais de 5,4 celulas de qualquer trilha: laje
      // que nao alcanca nada e armadilha, nao decisao. Ela para em x=21.
      [0, 11, 23, 11], [0, 13, 21, 14],
    ],
  },
  {
    id: 'ilha',
    nome: 'ILHA CENTRAL',
    apelido: 'Espiral em volta do lago de dados',
    dica: 'Quase tudo aqui e lago: so as duas ilhas do meio aceitam torre. Em compensacao a espiral passa tres vezes por perto delas. Alcance vale mais que cadencia.',
    vram: 14,
    dinheiro: 420,
    vidas: 16,
    piso: '#101a22',
    rotas: [
      {
        entrada: 'oeste',
        cantos: [[-1, 1], [22, 1], [22, 13], [2, 13], [2, 4], [19, 4], [19, 10], [6, 10], [6, 7], [16, 7]],
      },
    ],
    lajes: [
      [3, 5, 18, 6],
      [7, 8, 18, 9],
      [17, 11, 21, 12],
      [3, 11, 5, 12],
    ],
  },
];

function montar(def) {
  const rotas = def.rotas.map(r => ({ entrada: r.entrada, cels: expandirRota(r.cantos), cantos: r.cantos }));
  const naRota = new Set();
  for (const r of rotas) {
    for (const [x, y] of r.cels) {
      if (x >= 0 && x < LARGURA && y >= 0 && y < ALTURA) naRota.add(y * LARGURA + x);
    }
  }
  const construivel = laje(def.lajes);
  for (const k of naRota) construivel.delete(k);

  const fim = rotas[0].cels[rotas[0].cels.length - 1];
  const base = { x: fim[0], y: fim[1] };

  // O corredor de voo: quem voa ignora a trilha e corta reto da entrada ate o
  // cluster. Isso precisa estar no mapa, e nao so na cabeca de quem programou:
  // sem desenhar a linha, a onda 11 pune quem construiu exatamente onde o jogo
  // mandou construir. O robo tambem pontua laje por cobertura deste corredor.
  const linhasVoo = rotas.map(r => {
    const [ax, ay] = r.cels[0];
    const de = { x: ax + 0.5, y: ay + 0.5 };
    const para = { x: base.x + 0.5, y: base.y + 0.5 };
    const n = Math.max(2, Math.round(Math.hypot(para.x - de.x, para.y - de.y)));
    const pontos = [];
    for (let i = 0; i <= n; i++) {
      pontos.push({ x: de.x + (para.x - de.x) * (i / n), y: de.y + (para.y - de.y) * (i / n) });
    }
    return { de, para, pontos };
  });

  return {
    ...def,
    rotas,
    naRota,
    construivel,
    base,
    linhasVoo,
    comprimento: rotas.map(r => r.cels.length - 1),
  };
}

export const MAPAS = DEFINICOES.map(montar);
export const MAPA_POR_ID = Object.fromEntries(MAPAS.map(m => [m.id, m]));

export function podeConstruir(mapa, x, y) {
  if (x < 0 || y < 0 || x >= LARGURA || y >= ALTURA) return false;
  return mapa.construivel.has(y * LARGURA + x);
}
