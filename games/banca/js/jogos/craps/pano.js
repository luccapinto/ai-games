// O pano do craps em SVG: a metade de mesa de verdade (caixas dos números,
// Vem, Campo, Não passe, Linha do passe com as odds atrás, e o centro das
// proposições), mais três abas empilhadas para o celular em pé.
//
// Cada zona tem retângulo clicável e âncora da pilha de fichas. As apostas que
// não se clicam (o Vem que viajou para o 6, por exemplo) só têm âncora.

import { PONTOS } from './regras.js';

const NOME_NUMERO = { 4: '4', 5: '5', 6: 'SEIS', 8: '8', 9: 'NOVE', 10: '10' };

function dadoMini(x, y, n, s = 20) {
  const pos = { 1: [[0, 0]], 2: [[-1, -1], [1, 1]], 3: [[-1, -1], [0, 0], [1, 1]], 4: [[-1, -1], [1, -1], [-1, 1], [1, 1]], 5: [[-1, -1], [1, -1], [0, 0], [-1, 1], [1, 1]], 6: [[-1, -1], [1, -1], [-1, 0], [1, 0], [-1, 1], [1, 1]] }[n];
  return `<g transform="translate(${x} ${y})"><rect x="${-s / 2}" y="${-s / 2}" width="${s}" height="${s}" rx="${s * 0.18}" class="dmini"/>${pos.map(([a, b]) => `<circle cx="${a * s * 0.26}" cy="${b * s * 0.26}" r="${s * 0.09}" class="dpip"/>`).join('')}</g>`;
}

// Caixa de número: faixa de cima (Não vem e odds contra), meio (colocação),
// faixa de baixo (Vem que viajou e as odds dele).
function caixaNumero(z, n, x, y, w, h) {
  const topo = h * 0.2, baixo = h * 0.26;
  z.push({ id: `dontcomeodds${n}`, x, y, w, h: topo, ancora: [x + w * 0.72, y + topo * 0.7], sub: true });
  z.push({ id: `dontcome${n}`, ancora: [x + w * 0.28, y + topo * 0.7], so: true });
  z.push({ id: `place${n}`, x, y: y + topo, w, h: h - topo - baixo, ancora: [x + w * 0.5, y + h * 0.62] });
  z.push({ id: `comeodds${n}`, x, y: y + h - baixo, w, h: baixo, ancora: [x + w * 0.72, y + h - baixo * 0.25], sub: true });
  z.push({ id: `come${n}`, ancora: [x + w * 0.28, y + h - baixo * 0.25], so: true });
  return `<g class="caixa-numero" data-n="${n}">
    <rect class="borda" x="${x}" y="${y}" width="${w}" height="${h}" rx="6"/>
    <line x1="${x}" y1="${y + topo}" x2="${x + w}" y2="${y + topo}" class="fio"/>
    <line x1="${x}" y1="${y + h - baixo}" x2="${x + w}" y2="${y + h - baixo}" class="fio"/>
    <text class="pequeno" x="${x + w / 2}" y="${y + topo * 0.62}" text-anchor="middle">não vem</text>
    <text class="numero-grande" x="${x + w / 2}" y="${y + topo + (h - topo - baixo) * 0.62}" text-anchor="middle">${NOME_NUMERO[n]}</text>
    <text class="pequeno" x="${x + w / 2}" y="${y + h - baixo * 0.35}" text-anchor="middle">vem</text>
  </g>`;
}

function retangulo(z, id, x, y, w, h, texto, sub = '', extra = {}) {
  z.push({ id, x, y, w, h, ancora: extra.ancora ?? [x + w / 2, y + h * 0.6], ...extra });
  return `<g><rect class="borda" x="${x}" y="${y}" width="${w}" height="${h}" rx="8"/>
    <text class="rotulo${extra.menor ? ' menor' : ''}" x="${x + w / 2}" y="${y + h * (sub ? 0.42 : 0.6)}" text-anchor="middle">${texto}</text>
    ${sub ? `<text class="sub" x="${x + w / 2}" y="${y + h * 0.72}" text-anchor="middle">${sub}</text>` : ''}</g>`;
}

function campo(z, x, y, w, h) {
  z.push({ id: 'field', x, y, w, h, ancora: [x + w * 0.5, y + h * 0.78] });
  const nums = [2, 3, 4, 9, 10, 11, 12];
  const passo = w / (nums.length + 1);
  return `<g><rect class="borda" x="${x}" y="${y}" width="${w}" height="${h}" rx="8"/>
    <text class="rotulo campo-t" x="${x + 16}" y="${y + 28}">CAMPO</text>
    ${nums.map((n, i) => {
      const cx = x + passo * (i + 1), cy = y + h * 0.5;
      const especial = n === 2 || n === 12;
      return `${especial ? `<circle cx="${cx}" cy="${cy}" r="21" class="aro"/>` : ''}<text class="numero-campo" x="${cx}" y="${cy + 9}" text-anchor="middle">${n}</text>${especial ? `<text class="sub" x="${cx}" y="${cy + 36}" text-anchor="middle">paga ${n === 2 ? '2' : '3'}</text>` : ''}`;
    }).join('')}</g>`;
}

function centro(z, x, y, w) {
  let s = '';
  s += retangulo(z, 'anyseven', x, y, w, 60, 'QUALQUER 7', '4 para 1', { vermelho: true });
  const hw = (w - 10) / 2, hh = 96;
  const hard = [[6, 0, 0], [10, 1, 0], [8, 0, 1], [4, 1, 1]];
  for (const [n, c, r] of hard) {
    const bx = x + c * (hw + 10), by = y + 70 + r * (hh + 8);
    z.push({ id: `hard${n}`, x: bx, y: by, w: hw, h: hh, ancora: [bx + hw / 2, by + hh * 0.66] });
    s += `<g><rect class="borda" x="${bx}" y="${by}" width="${hw}" height="${hh}" rx="8"/>${dadoMini(bx + hw / 2 - 14, by + 30, n / 2)}${dadoMini(bx + hw / 2 + 14, by + 30, n / 2)}
      <text class="sub" x="${bx + hw / 2}" y="${by + 64}" text-anchor="middle">${n} difícil · ${n === 6 || n === 8 ? 9 : 7} para 1</text></g>`;
  }
  const py = y + 70 + 2 * (hh + 8);
  const um = [['two', [1, 1], '30'], ['three', [1, 2], '15'], ['eleven', [5, 6], '15'], ['twelve', [6, 6], '30']];
  const uw = (w - 18) / 4;
  um.forEach(([id, [a, b], p], i) => {
    const bx = x + i * (uw + 6);
    z.push({ id, x: bx, y: py, w: uw, h: 86, ancora: [bx + uw / 2, py + 64] });
    s += `<g><rect class="borda" x="${bx}" y="${py}" width="${uw}" height="86" rx="8"/>${dadoMini(bx + uw / 2 - 11, py + 24, a, 17)}${dadoMini(bx + uw / 2 + 11, py + 24, b, 17)}<text class="sub" x="${bx + uw / 2}" y="${py + 52}" text-anchor="middle">${p} p/ 1</text></g>`;
  });
  s += retangulo(z, 'anycraps', x, py + 96, w, 60, 'QUALQUER CRAPS', '7 para 1', { vermelho: true });
  return s;
}

// Mesa larga: tudo numa vista só.
export function panoLargo() {
  const z = [];
  let s = '';
  s += retangulo(z, 'dontcome', 30, 20, 150, 150, 'NÃO VEM', 'barra o 12');
  PONTOS.forEach((n, i) => { s += caixaNumero(z, n, 190 + i * 111, 20, 105, 150); });
  s += retangulo(z, 'come', 190, 180, 660, 110, 'VEM', '1 para 1');
  s += campo(z, 190, 300, 660, 100);
  s += retangulo(z, 'dontpass', 190, 410, 660, 50, 'NÃO PASSE · BARRA O 12', '', { ancora: [700, 440] });
  // a Linha do passe dá a volta em L
  z.push({ id: 'pass', x: 30, y: 470, w: 820, h: 70, ancora: [440, 512] });
  z.push({ id: 'pass', x: 30, y: 180, w: 150, h: 290, ancora: [440, 512], extra: true });
  s += `<g><path class="borda" d="M30 180 H180 V470 H850 V540 H30 Z"/><text class="rotulo linha" x="440" y="516" text-anchor="middle">LINHA DO PASSE</text>
    <text class="rotulo linha" transform="translate(112 330) rotate(-90)" text-anchor="middle">LINHA DO PASSE</text></g>`;
  s += retangulo(z, 'passodds', 190, 548, 330, 44, 'ODDS DO PASSE', '', { ancora: [355, 578] });
  s += retangulo(z, 'dontpassodds', 530, 548, 320, 44, 'ODDS CONTRA', '', { ancora: [690, 578] });
  s += centro(z, 870, 20, 300);
  return { vb: [0, 0, 1200, 600], svg: s, zonas: z, dados: { x0: 40, x1: 850, y0: 180, y1: 540 } };
}

// Celular em pé: três abas.
export function panoAba(aba) {
  const z = [];
  let s = '';
  if (aba === 'linha') {
    s += retangulo(z, 'come', 10, 10, 380, 90, 'VEM', '1 para 1');
    s += campo(z, 10, 110, 380, 96);
    s += retangulo(z, 'dontpass', 10, 216, 380, 56, 'NÃO PASSE', 'barra o 12');
    s += retangulo(z, 'pass', 10, 282, 380, 70, 'LINHA DO PASSE', '1 para 1');
    s += retangulo(z, 'passodds', 10, 362, 186, 56, 'ODDS DO PASSE', 'preço justo', { menor: true });
    s += retangulo(z, 'dontpassodds', 204, 362, 186, 56, 'ODDS CONTRA', 'preço justo', { menor: true });
    s += retangulo(z, 'dontcome', 10, 428, 380, 56, 'NÃO VEM', 'barra o 12');
    return { vb: [0, 0, 400, 494], svg: s, zonas: z };
  }
  if (aba === 'numeros') {
    PONTOS.forEach((n, i) => { s += caixaNumero(z, n, 10 + (i % 2) * 195, 10 + Math.floor(i / 2) * 160, 185, 150); });
    return { vb: [0, 0, 400, 490], svg: s, zonas: z };
  }
  s += centro(z, 10, 10, 380);
  return { vb: [0, 0, 400, 480], svg: s, zonas: z };
}

export function svgDoPano(p) {
  const areas = p.zonas.filter(q => q.w).map(q => `<rect class="zona${q.sub ? ' sub' : ''}" data-id="${q.id}" x="${q.x}" y="${q.y}" width="${q.w}" height="${q.h}" rx="6"/>`).join('');
  return `<svg class="craps-svg" viewBox="${p.vb.join(' ')}" preserveAspectRatio="xMidYMid meet">${p.svg}<g class="areas">${areas}</g><g class="puck-camada"></g></svg>`;
}

// Âncora de cada aposta (a primeira declarada vence: a Linha em L tem duas áreas).
export function ancoras(p) {
  const m = {};
  for (const q of p.zonas) if (!m[q.id]) m[q.id] = q.ancora;
  return m;
}
