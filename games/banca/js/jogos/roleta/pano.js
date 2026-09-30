// O pano da roleta e a pista francesa, gerados em SVG a partir das regras.
//
// Cada área clicável tem geometria em unidades do pano deitado (o zero à
// esquerda, doze colunas, a coluna do 2 para 1 à direita). No celular em pé
// o mesmo pano é girado: x' = 3 - y, y' = x, e o zero fica no alto.

import { APOSTA_POR_ID, numeroNa, VERMELHOS, ORDEM_RODA, ANUNCIADAS } from './regras.js';

const H = { x0: -0.08, y0: -0.08, x1: 14.08, y1: 5.2 };

// Geometria no pano deitado: { id, x, y, w, h, tipo }. Quadras, cavalos e
// transversais são áreas finas sobre as linhas; ficam por cima das casas.
export function zonas() {
  const z = [];
  const add = (id, x, y, w, h, extra = {}) => { if (!APOSTA_POR_ID[id]) throw new Error(`zona sem aposta: ${id}`); z.push({ id, x, y, w, h, ...extra }); };
  // casas
  add('p0', 0, 0, 1, 3, { casa: true });
  for (let c = 0; c < 12; c++) for (let r = 0; r < 3; r++) add(`p${numeroNa(r, c)}`, 1 + c, r, 1, 1, { casa: true });
  // colunas 2 para 1
  for (let r = 0; r < 3; r++) add(`k${3 - r}`, 13, r, 1, 1, { fora: true, texto: '2 : 1' });
  // dúzias e chances simples
  for (let d = 0; d < 3; d++) add(`d${d + 1}`, 1 + d * 4, 3.1, 4, 0.95, { fora: true, texto: ['1ª dúzia', '2ª dúzia', '3ª dúzia'][d] });
  const simples = [['baixo', '1 a 18'], ['par', 'PAR'], ['vermelho', ''], ['preto', ''], ['impar', 'ÍMPAR'], ['alto', '19 a 36']];
  simples.forEach(([id, t], i) => add(id, 1 + i * 2, 4.05, 2, 0.95, { fora: true, texto: t, losango: id === 'vermelho' || id === 'preto' }));
  // linhas finas: cavalos, transversais, quadras, linhas
  const f = 0.3;
  for (let c = 0; c < 12; c++) for (let r = 0; r < 3; r++) {
    const n = numeroNa(r, c);
    if (c < 11) add(`c${n}-${numeroNa(r, c + 1)}`, 2 + c - f / 2, r + 0.18, f, 0.64, { fina: true });
    if (r < 2) add(`c${numeroNa(r + 1, c)}-${n}`, 1 + c + 0.18, r + 1 - f / 2, 0.64, f, { fina: true });
  }
  for (let r = 0; r < 3; r++) add(`c0-${3 - r}`, 1 - f / 2, r + 0.18, f, 0.64, { fina: true });
  for (let c = 0; c < 12; c++) add(`t${c * 3 + 1}`, 1 + c + 0.18, 3 - f / 2, 0.64, f, { fina: true });
  for (let c = 0; c < 11; c++) {
    add(`l${c * 3 + 1}`, 2 + c - f / 2, 3 - f / 2, f, f, { fina: true, ponto: true });
    for (let r = 0; r < 2; r++) {
      const menor = Math.min(numeroNa(r, c), numeroNa(r, c + 1), numeroNa(r + 1, c), numeroNa(r + 1, c + 1));
      add(`q${menor}`, 2 + c - f / 2, r + 1 - f / 2, f, f, { fina: true, ponto: true });
    }
  }
  add('t0-2-3', 1 - f / 2, 1 - f / 2, f, f, { fina: true, ponto: true });
  add('t0-1-2', 1 - f / 2, 2 - f / 2, f, f, { fina: true, ponto: true });
  add('q0', 1 - f / 2, 3 - f / 2, f, f, { fina: true, ponto: true });
  return z;
}

export const ZONAS = zonas();

export function transformar(orientacao) {
  if (orientacao === 'h') return { vb: [H.x0, H.y0, H.x1 - H.x0, H.y1 - H.y0], p: (x, y) => [x, y], r: (x, y, w, h) => ({ x, y, w, h }) };
  // em pé: x' = 3 - y, y' = x
  return {
    vb: [3 - H.y1, H.x0, H.y1 - H.y0, H.x1 - H.x0],
    p: (x, y) => [3 - y, x],
    r: (x, y, w, h) => ({ x: 3 - y - h, y: x, w: h, h: w }),
  };
}

function texto(x, y, t, tam, extra = '') {
  return `<text x="${x}" y="${y}" font-size="${tam}" text-anchor="middle" dominant-baseline="central" ${extra}>${t}</text>`;
}

// SVG do pano. As casas são desenhadas por baixo; as áreas clicáveis (todas,
// inclusive as das casas) por cima, transparentes, com data-id.
export function svgPano(orientacao) {
  const T = transformar(orientacao);
  const [vx, vy, vw, vh] = T.vb;
  let desenho = '', areas = '';
  for (const z of ZONAS) {
    const q = T.r(z.x, z.y, z.w, z.h);
    const cx = q.x + q.w / 2, cy = q.y + q.h / 2;
    if (z.casa) {
      const n = Number(z.id.slice(1));
      const cor = n === 0 ? 'zero' : VERMELHOS.has(n) ? 'verm' : 'preto';
      desenho += `<rect class="casa ${cor}" data-n="${n}" x="${q.x + 0.05}" y="${q.y + 0.05}" width="${q.w - 0.1}" height="${q.h - 0.1}" rx="0.07"/>`;
      desenho += texto(cx, cy, n, 0.4, `class="num" data-n="${n}"`);
    } else if (z.fora) {
      desenho += `<rect class="fora" data-fora="${z.id}" x="${q.x + 0.04}" y="${q.y + 0.04}" width="${q.w - 0.08}" height="${q.h - 0.08}" rx="0.06"/>`;
      if (z.losango) {
        const s = Math.min(q.w, q.h) * 0.36, l = Math.max(q.w, q.h) * 0.3;
        const horizontal = q.w >= q.h;
        const [a, b] = horizontal ? [l, s] : [s, l];
        desenho += `<path class="losango ${z.id}" d="M${cx - a} ${cy} L${cx} ${cy - b} L${cx + a} ${cy} L${cx} ${cy + b} Z"/>`;
      } else {
        const girar = orientacao === 'v' && q.h > q.w * 1.4;
        desenho += texto(cx, cy, z.texto, z.id.startsWith('k') ? 0.3 : 0.32, `class="rotulo"${girar ? ` transform="rotate(-90 ${cx} ${cy})"` : ''}`);
      }
    }
    areas += `<rect class="zona${z.fina ? ' fina' : ''}" data-id="${z.id}" x="${q.x}" y="${q.y}" width="${q.w}" height="${q.h}"/>`;
  }
  // moldura e linhas do pano
  const [ax, ay] = T.p(0, 0);
  const moldura = T.r(0, 0, 14, 5);
  return `<svg class="pano-svg" viewBox="${vx} ${vy} ${vw} ${vh}" preserveAspectRatio="xMidYMid meet">
    <rect class="moldura" x="${moldura.x - 0.02}" y="${moldura.y - 0.02}" width="${moldura.w + 0.04}" height="${moldura.h + 0.04}" rx="0.1"/>
    ${desenho}
    <g class="areas">${areas}</g>
  </svg>`;
}

// ---------------------------------------------------------------- pista francesa

// Pista em forma de estádio com as 37 casas na ordem da roda e as quatro
// anunciadas no meio. O zero fica na ponta direita.
export function svgPista(orientacao = 'h') {
  const W = 20, Hh = 6.4, r = Hh / 2;
  // em pé, a pista é transposta: x e y trocam de lugar e o texto continua de pé
  const v = orientacao === 'v';
  const P = (x, y) => (v ? [y, x] : [x, y]);
  const Q = (x, y, w, h) => (v ? { x: y, y: x, w: h, h: w } : { x, y, w, h });
  // linha do meio da faixa das casas: um estádio um pouco para dentro da borda
  const ins = 0.12, cw = W - 2 * ins, ch = Hh - 2 * ins, cr = ch / 2;
  const reta = cw - 2 * cr;
  const perim = 2 * reta + 2 * Math.PI * cr;
  const passo = perim / 37;
  // s = 0 na ponta direita; corre para baixo, pela reta de baixo, pela ponta
  // esquerda e volta pela reta de cima: vizinhos na pista são vizinhos na roda.
  const pontoEm = s => {
    s = ((s % perim) + perim) % perim;
    const dx = ins + cw - cr, ex = ins + cr, cy = ins + cr;
    const quarto = Math.PI * cr / 2;
    if (s < quarto) { const a = s / cr; return [dx + Math.cos(a) * cr, cy + Math.sin(a) * cr]; }
    s -= quarto;
    if (s < reta) return [dx - s, ins + ch];
    s -= reta;
    if (s < Math.PI * cr) { const a = Math.PI / 2 + s / cr; return [ex + Math.cos(a) * cr, cy + Math.sin(a) * cr]; }
    s -= Math.PI * cr;
    if (s < reta) return [ex + s, ins];
    s -= reta;
    const a = Math.PI * 1.5 + s / cr;
    return [dx + Math.cos(a) * cr, cy + Math.sin(a) * cr];
  };
  let casas = '';
  const larg = 1.22;
  for (let i = 0; i < 37; i++) {
    const n = ORDEM_RODA[i];
    const [px, py] = P(...pontoEm(i * passo));
    const cor = n === 0 ? 'zero' : VERMELHOS.has(n) ? 'verm' : 'preto';
    casas += `<g class="pista-casa" data-viz="${n}"><circle class="casa ${cor}" data-n="${n}" cx="${px.toFixed(3)}" cy="${py.toFixed(3)}" r="${larg / 2}"/>${texto(px.toFixed(3), py.toFixed(3), n, 0.52, `class="num" data-n="${n}"`)}</g>`;
  }
  const setores = [
    ['terco', 'Terço', 1.3, 5.2],
    ['orfaos', 'Órfãos', 5.2, 9.0],
    ['vizinhos', 'Vizinhos do zero', 9.0, 15.0],
    ['jogozero', 'Jogo zero', 15.0, 18.4],
  ];
  let meio = '';
  for (const [id, nome, x0, x1] of setores) {
    const q = Q(x0, 1.25, x1 - x0, Hh - 2.5);
    const [tx, ty] = P((x0 + x1) / 2, Hh / 2 - 0.2), [sx, sy] = P((x0 + x1) / 2, Hh / 2 + 0.5);
    meio += `<g class="setor" data-anunciada="${id}"><rect x="${q.x}" y="${q.y}" width="${q.w}" height="${q.h}" rx="0.25"/>${texto(tx, v ? ty - 0.1 : ty, nome, v ? 0.4 : 0.56, 'class="rotulo"')}${texto(sx, v ? sy + 0.1 : sy, `${ANUNCIADAS[id].apostas.reduce((s, [, k]) => s + k, 0)} fichas`, 0.36, 'class="sub"')}</g>`;
  }
  const fundo = Q(-0.75, -0.75, W + 1.5, Hh + 1.5), miolo = Q(1.0, 1.0, W - 2, Hh - 2);
  const vb = Q(-0.9, -0.9, W + 1.8, Hh + 1.8);
  return `<svg class="pista-svg" viewBox="${vb.x} ${vb.y} ${vb.w} ${vb.h}" preserveAspectRatio="xMidYMid meet">
    <rect class="pista-fundo" x="${fundo.x}" y="${fundo.y}" width="${fundo.w}" height="${fundo.h}" rx="${r + 0.75}"/>
    <rect class="pista-miolo" x="${miolo.x}" y="${miolo.y}" width="${miolo.w}" height="${miolo.h}" rx="${r - 1}"/>
    ${meio}${casas}
  </svg>`;
}

export function centroDaZona(id, orientacao) {
  const z = ZONAS.find(q => q.id === id);
  if (!z) return null;
  const T = transformar(orientacao);
  const q = T.r(z.x, z.y, z.w, z.h);
  return [q.x + q.w / 2, q.y + q.h / 2];
}

export function viewBox(orientacao) {
  return transformar(orientacao).vb;
}
