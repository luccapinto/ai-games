// As seis pistas, em coordenadas polares escritas a mao.
//
// Cada pista e uma lista de pares (angulo, raio) em volta de um centro. O
// formato nao e capricho: circuito descrito assim e sempre estrelado em relacao
// ao centro, e portanto nunca se cruza consigo mesmo — que e o defeito de pista
// mais chato de achar depois, porque ele nao aparece olhando, aparece quando o
// jogador descobre um atalho que a contagem de setor nao pega. provas.mjs ainda
// confere o cruzamento, mas com este formato a conferencia passa por
// construcao.
//
// Nada aqui toca em DOM: `carregar` devolve a geometria amostrada de 2 em 2 m,
// com curvatura, largura, setores, grid e box, e e isso que a fisica, a linha de
// corrida, a IA e o render consomem.

const PASSO = 2;

export const PISTAS = [
  {
    nome: 'BAIXADA',
    tema: 'Retao de fundo de vale, duas curvas longas e uma dobra seca no fim',
    largura: 16,
    voltas: 5,
    paleta: { asfalto: '#3a3a40', zebra: '#c8483c', grama: '#3f5a33', ceu: '#141820', linha: '#dcdcd4' },
    // angulo em graus, raio em metros
    pontos: [
      [0, 300], [22, 300], [45, 290], [68, 250], [90, 240], [112, 250],
      [135, 285], [158, 300], [180, 300], [202, 288], [225, 250], [248, 232],
      [270, 238], [292, 262], [315, 292], [338, 302],
    ],
  },
  {
    nome: 'CANAVIAL',
    tema: 'Duas retas compridas ligadas por curvas de raio crescente',
    largura: 15,
    voltas: 4,
    paleta: { asfalto: '#38383e', zebra: '#d8c83c', grama: '#5e6b2c', ceu: '#1a1c16', linha: '#e4e0cc' },
    pontos: [
      [0, 420], [18, 415], [36, 380], [54, 330], [72, 300], [90, 292],
      [108, 300], [126, 330], [144, 372], [162, 404], [180, 414], [198, 408],
      [216, 372], [234, 322], [252, 296], [270, 290], [288, 300], [306, 336],
      [324, 382], [342, 412],
    ],
  },
  {
    nome: 'SERRA',
    tema: 'Subida de serra: tres grampos e nenhuma reta para descansar',
    largura: 12,
    voltas: 6,
    paleta: { asfalto: '#34343a', zebra: '#e0e0d8', grama: '#33472c', ceu: '#101418', linha: '#dcdcd4' },
    pontos: [
      [0, 250], [15, 262], [30, 244], [45, 196], [60, 178], [75, 200],
      [90, 236], [105, 252], [120, 232], [135, 190], [150, 176], [165, 198],
      [180, 240], [195, 258], [210, 240], [225, 198], [240, 180], [255, 202],
      [270, 238], [285, 256], [300, 246], [315, 214], [330, 210], [345, 232],
    ],
  },
  {
    nome: 'PORTO',
    tema: 'Circuito de rua entre armazens: curvas secas e muro perto',
    largura: 14,
    voltas: 5,
    paleta: { asfalto: '#3c3c42', zebra: '#c0c0b8', grama: '#4a4a52', ceu: '#0e1014', linha: '#e8e8e0' },
    pontos: [
      [0, 340], [15, 350], [30, 353], [45, 352], [60, 338], [75, 308],
      [90, 294], [105, 308], [120, 336], [135, 350], [150, 352], [165, 346],
      [180, 340], [195, 348], [210, 352], [225, 350], [240, 336], [255, 306],
      [270, 292], [285, 306], [300, 334], [315, 350], [330, 350], [345, 344],
    ],
  },
  {
    nome: 'CERRADO',
    tema: 'Pista longa de curvas largas onde a asa vale mais que o motor',
    largura: 16,
    voltas: 3,
    paleta: { asfalto: '#3e3a36', zebra: '#d87c3c', grama: '#6b5a34', ceu: '#1c1a14', linha: '#ece4d0' },
    pontos: [
      [0, 540], [18, 530], [36, 500], [54, 470], [72, 452], [90, 448],
      [108, 456], [126, 484], [144, 516], [162, 536], [180, 542], [198, 528],
      [216, 492], [234, 458], [252, 440], [270, 436], [288, 448], [306, 480],
      [324, 514], [342, 534],
    ],
  },
  {
    nome: 'VIADUTO',
    tema: 'Estreito, com duas chicanes e muro dos dois lados',
    largura: 11,
    voltas: 6,
    paleta: { asfalto: '#33333a', zebra: '#e0483c', grama: '#3a3a44', ceu: '#0c0e12', linha: '#dcdce4' },
    pontos: [
      [0, 300], [13, 306], [26, 288], [39, 300], [52, 282], [64, 268],
      [77, 280], [90, 262], [103, 276], [116, 262], [129, 274], [142, 292],
      [155, 300], [168, 288], [180, 298], [193, 306], [206, 288], [219, 300],
      [232, 282], [244, 268], [257, 280], [270, 262], [283, 276], [296, 262],
      [309, 274], [322, 292], [335, 300], [348, 292],
    ],
  },
];

// Catmull-Rom fechada: passa por todos os pontos de controle e tem tangente
// continua, que e o que impede uma quina na geometria virar uma quina na
// curvatura e, dai, um pico de velocidade impossivel no perfil da linha.
function catmull(p0, p1, p2, p3, t) {
  const t2 = t * t;
  const t3 = t2 * t;
  return {
    x: 0.5 * ((2 * p1.x) + (-p0.x + p2.x) * t
      + (2 * p0.x - 5 * p1.x + 4 * p2.x - p3.x) * t2
      + (-p0.x + 3 * p1.x - 3 * p2.x + p3.x) * t3),
    y: 0.5 * ((2 * p1.y) + (-p0.y + p2.y) * t
      + (2 * p0.y - 5 * p1.y + 4 * p2.y - p3.y) * t2
      + (-p0.y + 3 * p1.y - 3 * p2.y + p3.y) * t3),
  };
}

export function carregar(pista) {
  const controle = pista.pontos.map(([graus, raio]) => {
    const a = (graus * Math.PI) / 180;
    return { x: Math.cos(a) * raio, y: Math.sin(a) * raio };
  });

  // 1. amostragem densa do spline, so para medir comprimento
  const denso = [];
  const n = controle.length;
  for (let i = 0; i < n; i++) {
    const p0 = controle[(i - 1 + n) % n];
    const p1 = controle[i];
    const p2 = controle[(i + 1) % n];
    const p3 = controle[(i + 2) % n];
    for (let k = 0; k < 40; k++) denso.push(catmull(p0, p1, p2, p3, k / 40));
  }
  denso.push(denso[0]);

  let comprimento = 0;
  for (let i = 1; i < denso.length; i++) {
    comprimento += Math.hypot(denso[i].x - denso[i - 1].x, denso[i].y - denso[i - 1].y);
  }

  // 2. reamostragem por comprimento de arco: passo constante e o que deixa
  // curvatura, perfil de velocidade e desgaste comparaveis entre pistas.
  const quantidade = Math.max(64, Math.round(comprimento / PASSO));
  const passo = comprimento / quantidade;
  const centro = [];
  let percorrido = 0;
  let alvo = 0;
  let j = 1;
  while (centro.length < quantidade && j < denso.length) {
    const a = denso[j - 1];
    const b = denso[j];
    const d = Math.hypot(b.x - a.x, b.y - a.y);
    if (percorrido + d >= alvo) {
      const t = d < 1e-9 ? 0 : (alvo - percorrido) / d;
      centro.push({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });
      alvo += passo;
    } else {
      percorrido += d;
      j++;
    }
  }

  // 3. angulo, curvatura, largura e distancia acumulada
  let curvaturaTotal = 0;
  for (const [i, c] of centro.entries()) {
    const ant = centro[(i - 1 + centro.length) % centro.length];
    const prox = centro[(i + 1) % centro.length];
    c.ang = Math.atan2(prox.y - ant.y, prox.x - ant.x);
    c.s = i * passo;
    c.largura = larguraEm(pista, i / centro.length);
  }
  for (const [i, c] of centro.entries()) {
    const ant = centro[(i - 1 + centro.length) % centro.length];
    const prox = centro[(i + 1) % centro.length];
    let dang = prox.ang - ant.ang;
    while (dang > Math.PI) dang -= Math.PI * 2;
    while (dang < -Math.PI) dang += Math.PI * 2;
    c.curvatura = dang / (passo * 2);
    curvaturaTotal += Math.abs(c.curvatura);
  }

  const p = {
    nome: pista.nome,
    tema: pista.tema,
    paleta: pista.paleta,
    voltas: pista.voltas,
    centro,
    passo,
    comprimento,
    curvaturaMedia: curvaturaTotal / centro.length,
    setores: [0, Math.floor(centro.length / 3), Math.floor((centro.length * 2) / 3)],
  };
  p.busca = indexar(p);
  p.grade = montarGrade(p);
  p.box = montarBox(p);
  return p;
}

// A largura varia ao longo da volta: um pouco mais larga na reta, mais estreita
// no miolo tecnico. `fracao` e a posicao na volta, de 0 a 1.
function larguraEm(pista, fracao) {
  const onda = Math.sin(fracao * Math.PI * 4);
  return pista.largura * (1 + onda * 0.08);
}

// Grade espacial: achar a celula mais proxima varrendo as 1.500 amostras por
// quadro, para dez carros, custaria mais que a fisica inteira.
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
  return { i: melhor, s: c.s, lateral, ang: c.ang, largura: c.largura };
}

const SUPERFICIES = {
  asfalto: { tipo: 'asfalto', atrito: 1 },
  zebra: { tipo: 'zebra', atrito: 0.82 },
  grama: { tipo: 'grama', atrito: 0.42 },
  muro: { tipo: 'muro', atrito: 0.35 },
};

export const LIMITE_ZEBRA = 1.6;
export const LIMITE_GRAMA = 9;

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

// Grid de dez lugares, em duas filas, atras da linha de chegada.
function montarGrade(p) {
  const grade = [];
  for (let n = 0; n < 10; n++) {
    const recuo = 14 + Math.floor(n / 2) * 13;
    const i = (p.centro.length - Math.round(recuo / p.passo)) % p.centro.length;
    const c = p.centro[(i + p.centro.length) % p.centro.length];
    const nx = -Math.sin(c.ang);
    const ny = Math.cos(c.ang);
    const lado = n % 2 ? 1 : -1;
    const desvio = lado * Math.min(3.4, c.largura / 2 - 2);
    grade.push({ x: c.x + nx * desvio, y: c.y + ny * desvio, ang: c.ang });
  }
  return grade;
}

// O box fica encostado na borda interna da reta principal. Nao ha pit lane
// desenhada: o jogo cobra a mesma coisa que uma pit lane cobra, que e chegar
// devagar naquele pedaco de asfalto.
function montarBox(p) {
  const i = Math.round(60 / p.passo) % p.centro.length;
  const c = p.centro[i];
  const nx = -Math.sin(c.ang);
  const ny = Math.cos(c.ang);
  const desvio = -(c.largura / 2 - 2.4);
  return { x: c.x + nx * desvio, y: c.y + ny * desvio, ang: c.ang, i, raio: 11 };
}

// Ponto a (s, lateral) em coordenadas do mundo. Usado pela linha de corrida,
// pela IA e pelo render da fita.
export function paraMundo(p, i, lateral) {
  const c = p.centro[((i % p.centro.length) + p.centro.length) % p.centro.length];
  const nx = -Math.sin(c.ang);
  const ny = Math.cos(c.ang);
  return { x: c.x + nx * lateral, y: c.y + ny * lateral, ang: c.ang };
}

export { PASSO };
