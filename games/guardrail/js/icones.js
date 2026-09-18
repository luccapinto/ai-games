// Os onze icones das torres. Caminho puro de canvas: nenhum asset, nenhuma
// textura, nenhum arquivo de imagem.
//
// Por que isto e um modulo separado: o mapa (render.js) e a loja e a ficha
// (main.js) precisam do mesmo desenho em tamanhos diferentes. Desenhar a mesma
// silhueta em dois arquivos e o jeito conhecido de as duas versoes divergirem.
//
// As regras que o desenho tem que cumprir, conferidas em cinza e com desfoque
// antes de virar codigo:
//
//   1. a silhueta separa as onze sozinha — sem cor, sem ler a sigla;
//   2. as tres que nao atiram (A SEGURA, ORQUESTRADOR, COBRANCA) compartilham
//      a barra de base com pes e a cor de aco. Sao exatamente 3 dos 11, e e
//      isso que faz "esta torre nao atira" ser lido de longe;
//   3. as tres da mesma casa (HAIKU, SONNET, OPUS) se separam por contagem de
//      raios, massa e luminancia: 3 vazado, 6 medio, 12 solido com aro;
//   4. a sigla de 2 letras continua dentro, menor, como reforco. Ela se le na
//      loja e na ficha e some no mapa a 32 px — isso e esperado, porque la
//      quem tem que falar e a forma.
//
// Todo desenho vive numa caixa de 32 unidades (-16..16) centrada em 0,0, que e
// exatamente o tamanho da torre no mapa: CELULA = 40 e o corpo ocupa 32.

const TAU = Math.PI * 2;
const ESCURO = '#060910';

// A caixa de desenho tem 32 unidades, mas o traco escuro em volta sai mais 1,4
// para fora: o selo precisa de 40 para nao cortar ponta de estrela.
export const CAIXA = 40;

function mix(hex, f) {
  const n = parseInt(hex.slice(1), 16);
  return `rgb(${Math.round(((n >> 16) & 255) * f)},${Math.round(((n >> 8) & 255) * f)},${Math.round((n & 255) * f)})`;
}

// O unico ponto colorido de um icone: o aro dourado do OPUS, o mostrador verde
// da SEGURA, os pontos ciano do ORQUESTRADOR, a fenda dourada da COBRANCA. A cor
// vem de `detalhe` em dados.js, que e a mesma que a moldura do cartao da loja
// usa — as tres de infraestrutura dividem a cor de aco e e o detalhe que as
// separa, entao ele nao pode estar escrito em dois lugares.
//
// Num estado quebrado (corrompida, desligada) o detalhe morre junto: a torre
// inteira vira uma cor so, senao a torre morta continua parecendo viva.
function acento(t, cor) {
  return t.plano ? mix(t.cor, 0.55) : (cor || t.cor);
}

function pintar(g, cor, lw) {
  g.lineJoin = 'round';
  g.lineCap = 'round';
  g.strokeStyle = ESCURO;
  g.lineWidth = lw === undefined ? 2.8 : lw;
  g.stroke();
  g.fillStyle = cor;
  g.fill();
}

function disco(g, x, y, r) {
  g.beginPath();
  g.arc(x, y, r, 0, TAU);
}

function sigla(g, t, y, tamanho, cor) {
  g.fillStyle = cor || t.cor;
  g.font = `700 ${tamanho}px ui-monospace, Menlo, monospace`;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText(t.glifo, 0, y);
}

function estrela(g, n, ro, ri, rot, curvo) {
  g.beginPath();
  for (let i = 0; i < n; i++) {
    const a0 = rot + i * TAU / n;
    const am = a0 + TAU / (2 * n);
    const a1 = a0 + TAU / n;
    const x0 = Math.cos(a0) * ro, y0 = Math.sin(a0) * ro;
    const xm = Math.cos(am) * ri, ym = Math.sin(am) * ri;
    const x1 = Math.cos(a1) * ro, y1 = Math.sin(a1) * ro;
    if (i === 0) g.moveTo(x0, y0);
    if (curvo) g.quadraticCurveTo(xm, ym, x1, y1);
    else { g.lineTo(xm, ym); g.lineTo(x1, y1); }
  }
  g.closePath();
}

// A barra de base com pes: o marcador do grupo que nao atira. Equipamento
// montado em rack, nao arma.
function plinto(g, t) {
  g.beginPath();
  g.roundRect(-13, 10.4, 26, 4.8, 1.7);
  pintar(g, mix(t.cor, 0.62), 2.6);
  g.fillStyle = ESCURO;
  g.fillRect(-6.2, 10.4, 3.1, 4.8);
  g.fillRect(3.1, 10.4, 3.1, 4.8);
}

// ----------------------------------------------------------- os onze desenhos

export const DESENHO = {
  // Llama 8B — a cabeca de lhama: duas orelhas e o focinho arredondado. E a
  // unica silhueta organica das onze e a unica com entalhe no topo.
  //
  // O vale entre as orelhas e um V que desce ate o meio da cabeca, e nao o
  // entalhe raso do esboco. Medido: com o vale raso, a 20 px e com desfoque as
  // duas orelhas colam e sobra a mesma bolha redonda do OPUS. Com o V fundo o
  // entalhe sobrevive ao desfoque, que e o que faz a forma se separar sem
  // depender da cor.
  llama(g, t) {
    g.beginPath();
    g.moveTo(-8.0, -4.0);
    g.lineTo(-7.4, -16.2); g.lineTo(0, -4.2); g.lineTo(7.4, -16.2);
    g.lineTo(8.0, -4.0);
    g.bezierCurveTo(11.8, -0.6, 10.4, 7.8, 3.6, 12.4);
    g.quadraticCurveTo(0, 15.2, -3.6, 12.4);
    g.bezierCurveTo(-10.4, 7.8, -11.8, -0.6, -8.0, -4.0);
    g.closePath();
    pintar(g, t.cor);
    g.beginPath();
    g.roundRect(-7.6, -1.0, 15.2, 9.0, 3.0);
    g.fillStyle = mix(t.cor, 0.20);
    g.fill();
    sigla(g, t, 3.5, 7.2);
  },

  // Claude Haiku 4.5 — asterisco de 3 raios: a marca da casa, o degrau de baixo.
  haiku(g, t) {
    estrela(g, 3, 15.8, 4.4, -Math.PI / 2, true);
    pintar(g, t.cor);
    disco(g, 0, 0, 6.0);
    g.fillStyle = mix(t.cor, 0.20);
    g.fill();
    sigla(g, t, 0.3, 6.4);
  },

  // Gemini Flash — o brilho de 4 pontas de lado concavo, alongado na vertical.
  gemini(g, t) {
    g.beginPath();
    g.moveTo(0, -16);
    g.quadraticCurveTo(3.3, -3.3, 12.2, 0);
    g.quadraticCurveTo(3.3, 3.3, 0, 13.8);
    g.quadraticCurveTo(-3.3, 3.3, -12.2, 0);
    g.quadraticCurveTo(-3.3, -3.3, 0, -16);
    g.closePath();
    pintar(g, t.cor);
    g.beginPath();
    g.moveTo(0, -5.6); g.lineTo(5.4, 0); g.lineTo(0, 5.6); g.lineTo(-5.4, 0);
    g.closePath();
    g.fillStyle = mix(t.cor, 0.22);
    g.fill();
    sigla(g, t, 0.3, 6.2);
  },

  // Qwen 3 VL — o olho. A unica forma larga e apontada nas duas pontas: VL e
  // visao, e e a torre que enxerga camuflado.
  qwen(g, t) {
    g.beginPath();
    g.moveTo(-15.6, 0);
    g.bezierCurveTo(-8, -11.6, 8, -11.6, 15.6, 0);
    g.bezierCurveTo(8, 11.6, -8, 11.6, -15.6, 0);
    g.closePath();
    pintar(g, t.cor);
    disco(g, 0, 0, 7.2);
    g.fillStyle = mix(t.cor, 0.20);
    g.fill();
    disco(g, 0, 0, 7.2);
    g.strokeStyle = mix(t.cor, 0.62);
    g.lineWidth = 1.6;
    g.stroke();
    sigla(g, t, 0.3, 6.2);
    disco(g, -3.2, -3.4, 1.4);
    g.fillStyle = acento(t, '#ffffff');
    g.globalAlpha = 0.7;
    g.fill();
    g.globalAlpha = 1;
  },

  // Claude Sonnet 4.5 — asterisco de 6 raios finos: a mesma casa, o dobro de
  // raios do HAIKU e metade dos do OPUS.
  sonnet(g, t) {
    estrela(g, 6, 15.8, 5.0, -Math.PI / 2, true);
    pintar(g, t.cor);
    disco(g, 0, 0, 6.4);
    g.fillStyle = mix(t.cor, 0.24);
    g.fill();
    sigla(g, t, 0.3, 6.6);
  },

  // DeepSeek R1 — o funil com o galao descendo: deep + seek. E a unica das onze
  // que aponta para baixo, e por isso e a unica reconhecivel de cabeca para
  // baixo tambem.
  deepseek(g, t) {
    g.beginPath();
    g.moveTo(-14.6, -11);
    g.lineTo(14.6, -11);
    g.lineTo(3.2, 11.4);
    g.quadraticCurveTo(0, 15.4, -3.2, 11.4);
    g.closePath();
    pintar(g, t.cor);
    g.beginPath();
    g.roundRect(-10.6, -8.6, 21.2, 9.4, 2.2);
    g.fillStyle = mix(t.cor, 0.20);
    g.fill();
    sigla(g, t, -3.8, 7.4);
    g.beginPath();
    g.moveTo(-4.8, 3.4); g.lineTo(0, 7.8); g.lineTo(4.8, 3.4);
    g.strokeStyle = mix(t.cor, 0.20);
    g.lineWidth = 2.6;
    g.lineCap = 'round';
    g.lineJoin = 'round';
    g.stroke();
  },

  // GPT-5 — o portal. E a unica das onze com um vao vazado grande no meio, e e
  // isso que a segura no teste do desfoque: as outras dez viram mancha cheia,
  // esta vira arco.
  gpt(g, t) {
    g.beginPath();
    g.moveTo(-12.6, 14);
    g.lineTo(-12.6, -3);
    g.arc(0, -3, 12.6, Math.PI, 0, false);
    g.lineTo(12.6, 14);
    g.closePath();
    pintar(g, t.cor);
    g.beginPath();
    g.moveTo(-6.6, 14.6);
    g.lineTo(-6.6, -2.4);
    g.arc(0, -2.4, 6.6, Math.PI, 0, false);
    g.lineTo(6.6, 14.6);
    g.closePath();
    g.fillStyle = mix(t.cor, 0.12);
    g.fill();
    sigla(g, t, 7.4, 7.2);
  },

  // Claude Opus 4.6 — o sol de 12 raios com disco denso e aro dourado: o
  // asterisco da casa no maximo. E a forma mais massiva e mais clara das onze.
  opus(g, t) {
    estrela(g, 12, 15.6, 11.2, -Math.PI / 2, false);
    pintar(g, t.cor);
    disco(g, 0, 0, 11.4);
    pintar(g, t.cor, 2.2);
    disco(g, 0, 0, 9.4);
    g.strokeStyle = acento(t, t.detalhe);
    g.lineWidth = 2.0;
    g.stroke();
    disco(g, 0, 0, 7.4);
    g.fillStyle = mix(t.cor, 0.22);
    g.fill();
    sigla(g, t, 0.3, 7.4, acento(t, t.detalhe));
  },

  // A SEGURA — o cofre: caixa alta e estreita, canto chanfrado e segredo. E a
  // unica das onze mais alta que larga.
  segura(g, t) {
    plinto(g, t);
    g.beginPath();
    g.moveTo(-8.4, -15);
    g.lineTo(5.6, -15);
    g.lineTo(11.4, -9.2);
    g.lineTo(11.4, 8.4);
    g.quadraticCurveTo(11.4, 11, 8.8, 11);
    g.lineTo(-8.8, 11);
    g.quadraticCurveTo(-11.4, 11, -11.4, 8.4);
    g.lineTo(-11.4, -12.4);
    g.quadraticCurveTo(-11.4, -15, -8.4, -15);
    g.closePath();
    pintar(g, t.cor);
    g.beginPath();
    g.roundRect(-8.2, -12, 16.4, 19.6, 2.4);
    g.fillStyle = mix(t.cor, 0.20);
    g.fill();
    sigla(g, t, -7.0, 7.0);
    disco(g, 0, 1.4, 4.4);
    g.strokeStyle = acento(t, t.detalhe);
    g.lineWidth = 2.0;
    g.stroke();
    g.beginPath();
    g.moveTo(0, 1.4); g.lineTo(3.4, -0.9);
    g.strokeStyle = acento(t, t.detalhe);
    g.lineWidth = 1.6;
    g.stroke();
  },

  // ORQUESTRADOR — a cruz com hub no meio e um ponto em cada ponta: ele
  // distribui para as vizinhas, e a forma diz para onde.
  orquestrador(g, t) {
    plinto(g, t);
    const k = 4.7;
    g.beginPath();
    g.moveTo(-k, -15.2); g.lineTo(k, -15.2);
    g.lineTo(k, -k); g.lineTo(14.6, -k); g.lineTo(14.6, k);
    g.lineTo(k, k); g.lineTo(k, 11); g.lineTo(-k, 11);
    g.lineTo(-k, k); g.lineTo(-14.6, k); g.lineTo(-14.6, -k);
    g.lineTo(-k, -k);
    g.closePath();
    pintar(g, t.cor);
    disco(g, 0, 0, 8.4);
    pintar(g, t.cor, 2.4);
    disco(g, 0, 0, 6.6);
    g.fillStyle = mix(t.cor, 0.20);
    g.fill();
    sigla(g, t, 0.3, 6.8);
    g.fillStyle = acento(t, t.detalhe);
    for (const [x, y] of [[0, -12.4], [-11.9, 0], [11.9, 0]]) {
      disco(g, x, y, 1.8);
      g.fill();
    }
  },

  // COBRANCA — a pilha de tres moedas com a fenda dourada em cima: larga,
  // baixa e ranhurada. E a unica feita de faixas horizontais empilhadas.
  cobranca(g, t) {
    plinto(g, t);
    for (const cy of [3.0, -2.2, -7.4]) {
      g.beginPath();
      g.ellipse(0, cy, 12.6, 5.0, 0, 0, TAU);
      pintar(g, t.cor, 2.6);
    }
    g.beginPath();
    g.roundRect(-5.4, -8.5, 10.8, 2.4, 1.2);
    g.fillStyle = acento(t, t.detalhe);
    g.fill();
    g.beginPath();
    g.roundRect(-10.2, -4.8, 20.4, 6.2, 2.0);
    g.fillStyle = mix(t.cor, 0.20);
    g.fill();
    sigla(g, t, -1.5, 6.8);
  },
};

// ------------------------------------------------------------------- o cache
//
// O desenho de uma torre nao muda: mesma forma, mesma cor, mesmo tamanho. Com
// 26 torres na tela, tracar onze caminhos por quadro custaria mais que o resto
// do desenho somado — `stroke` num rasterizador de software e caro. Cada
// combinacao de torre, tamanho e estado vira um canvas desenhado uma vez.

const CORES_ESTADO = { corrompida: '#ff5ca8', desligada: '#6b6b7a' };

const selos = new Map();

export function seloTorre(def, lado = CAIXA, estado = '') {
  const chave = `${def.id}|${lado}|${estado}`;
  const pronto = selos.get(chave);
  if (pronto) return pronto;

  const c = document.createElement('canvas');
  c.width = lado;
  c.height = lado;
  const g = c.getContext('2d');
  g.translate(lado / 2, lado / 2);
  g.scale(lado / CAIXA, lado / CAIXA);
  DESENHO[def.id](g, {
    cor: CORES_ESTADO[estado] || def.cor,
    detalhe: def.detalhe,
    glifo: def.glifo,
    plano: !!estado,
  });

  selos.set(chave, c);
  return c;
}

// Para o DOM (cartao da loja, topo da ficha). A ficha e remontada varias vezes
// por segundo: devolver a mesma string de data URL deixa o navegador reusar a
// imagem ja decodificada em vez de rasterizar de novo.
const urls = new Map();

export function urlIcone(def, lado = 88) {
  const chave = `${def.id}|${lado}`;
  const pronto = urls.get(chave);
  if (pronto) return pronto;
  const url = seloTorre(def, lado).toDataURL();
  urls.set(chave, url);
  return url;
}
