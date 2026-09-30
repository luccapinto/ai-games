// Cartas desenhadas por código, em SVG: naipes próprios, índices, pips e as
// figuras (valete, dama e rei) em art déco geométrico. Um sprite com os 52
// símbolos e o verso entra no documento uma vez; cada carta na mesa é só um
// <use>. Texto dentro do SVG inline usa as fontes da página (Jost).

import { valorDe, naipeDe, INDICES } from '../nucleo/baralho.js';

const W = 250, H = 350;

export const NAIPE_PATH = [
  // espadas
  'M50 5C57 20 93 37 93 60C93 74 83 82 71 82C63 82 57 78 53.5 72C54.5 82 58.5 89 66 95H34C41.5 89 45.5 82 46.5 72C43 78 37 82 29 82C17 82 7 74 7 60C7 37 43 20 50 5Z',
  // copas
  'M50 90C21 68 6 50 6 32C6 18 17 8 30 8C39 8 46 13 50 21C54 13 61 8 70 8C83 8 94 18 94 32C94 50 79 68 50 90Z',
  // ouros
  'M50 3C58 21 72 37 91 50C72 63 58 79 50 97C42 79 28 63 9 50C28 37 42 21 50 3Z',
  // paus
  'M50 8a19 19 0 0 1 16.5 28.4A19 19 0 1 1 55 67C55 80 60 88 67 95H33C40 88 45 80 45 67A19 19 0 1 1 33.5 36.4 19 19 0 0 1 50 8Z',
];

const TINTA = ['#16161b', '#b3192e', '#b3192e', '#16161b'];

// Paleta das figuras por naipe: manto, sombra, detalhe.
const FIGURA = [
  { manto: '#1f3160', sombra: '#0d1428', detalhe: '#6f88c9' },
  { manto: '#b3192e', sombra: '#5a1422', detalhe: '#e86a7a' },
  { manto: '#c98a1a', sombra: '#7a3a12', detalhe: '#b3192e' },
  { manto: '#0e5a3f', sombra: '#0a2a21', detalhe: '#4fb88d' },
];

function pip(naipe, x, y, tam, girar = false) {
  const s = tam / 100;
  const t = `translate(${x - tam / 2} ${y - tam / 2}) scale(${s})`;
  const rot = girar ? ` rotate(180 ${x} ${y})` : '';
  return `<path d="${NAIPE_PATH[naipe]}" fill="${TINTA[naipe]}" transform="${rot}${t}"/>`;
}

// Posições dos pips de 2 a 10, no padrão tradicional. [x, y, girado]
const CX = [72, 125, 178];
const LINHAS4 = [74, 141, 209, 276];
const LAYOUT = {
  1: [[1, 175, 0]],
  2: [[1, 74, 0], [1, 276, 1]],
  3: [[1, 74, 0], [1, 175, 0], [1, 276, 1]],
  4: [[0, 74, 0], [2, 74, 0], [0, 276, 1], [2, 276, 1]],
  5: [[0, 74, 0], [2, 74, 0], [1, 175, 0], [0, 276, 1], [2, 276, 1]],
  6: [[0, 74, 0], [2, 74, 0], [0, 175, 0], [2, 175, 0], [0, 276, 1], [2, 276, 1]],
  7: [[0, 74, 0], [2, 74, 0], [1, 124, 0], [0, 175, 0], [2, 175, 0], [0, 276, 1], [2, 276, 1]],
  8: [[0, 74, 0], [2, 74, 0], [1, 124, 0], [0, 175, 0], [2, 175, 0], [1, 226, 1], [0, 276, 1], [2, 276, 1]],
  9: [[0, LINHAS4[0], 0], [2, LINHAS4[0], 0], [0, LINHAS4[1], 0], [2, LINHAS4[1], 0], [1, 175, 0], [0, LINHAS4[2], 1], [2, LINHAS4[2], 1], [0, LINHAS4[3], 1], [2, LINHAS4[3], 1]],
  10: [[0, LINHAS4[0], 0], [2, LINHAS4[0], 0], [1, 108, 0], [0, LINHAS4[1], 0], [2, LINHAS4[1], 0], [0, LINHAS4[2], 1], [2, LINHAS4[2], 1], [1, 242, 1], [0, LINHAS4[3], 1], [2, LINHAS4[3], 1]],
};

function indices(v, naipe) {
  const txt = INDICES[v];
  const cor = TINTA[naipe];
  const largo = txt === '10';
  const canto = `<g>
    <text x="27" y="48" text-anchor="middle" font-family="Jost, sans-serif" font-weight="600" font-size="${largo ? 34 : 38}" ${largo ? 'letter-spacing="-3"' : ''} fill="${cor}">${txt}</text>
    ${pip(naipe, 27, 70, 24)}
  </g>`;
  return canto + `<g transform="rotate(180 125 175)">${canto}</g>`;
}

function fundo() {
  return `<rect width="${W}" height="${H}" rx="16" fill="url(#c-papel)"/>
    <rect x="6.5" y="6.5" width="${W - 13}" height="${H - 13}" rx="11" fill="none" stroke="#c9a45c" stroke-width="1.3" opacity=".75"/>`;
}

function faceNumerica(v, naipe) {
  const n = v + 1;
  let pips = '';
  const tam = n === 1 ? 0 : 50;
  for (const [col, y, g] of LAYOUT[n]) pips += pip(naipe, CX[col], y, tam, !!g);
  return fundo() + indices(v, naipe) + pips;
}

function faceAs(naipe) {
  let raios = '';
  for (let i = 0; i < 36; i++) {
    const a = (i / 36) * Math.PI * 2;
    const r1 = i % 2 ? 62 : 58, r2 = i % 2 ? 88 : 102;
    raios += `<line x1="${125 + Math.cos(a) * r1}" y1="${175 + Math.sin(a) * r1}" x2="${125 + Math.cos(a) * r2}" y2="${175 + Math.sin(a) * r2}"/>`;
  }
  const especial = naipe === 0;
  return fundo() + indices(0, naipe) + `
    <g stroke="#c9a45c" stroke-width="${especial ? 1.6 : 1.1}" opacity="${especial ? 0.9 : 0.6}">${raios}</g>
    <circle cx="125" cy="175" r="${especial ? 56 : 50}" fill="none" stroke="#c9a45c" stroke-width="1.4" opacity=".8"/>
    ${especial ? '<circle cx="125" cy="175" r="61" fill="none" stroke="#c9a45c" stroke-width=".8" opacity=".7"/>' : ''}
    ${pip(naipe, 125, 173, especial ? 84 : 70)}
    ${especial ? `<path d="${NAIPE_PATH[0]}" transform="translate(96 144) scale(.58)" fill="none" stroke="#e8cf8f" stroke-width="2.4"/>
      <text x="125" y="279" text-anchor="middle" font-family="Limelight, serif" font-size="19" letter-spacing="6" fill="#16161b">BANCA</text>
      <text x="125" y="296" text-anchor="middle" font-family="Jost, sans-serif" font-size="8.5" letter-spacing="3" fill="#7d6230">A CASA TE MOSTRA A CONTA</text>` : ''}`;
}

// Meia figura (metade de cima); a de baixo é a mesma girada 180 graus.
function meiaFigura(v, naipe) {
  const p = FIGURA[naipe];
  const pele = '#f3dcc0';
  const traco = '#2a1d12';
  const rei = v === 12, dama = v === 11, valete = v === 10;
  let s = '';

  // raios de sol atrás da cabeça
  let raios = '';
  for (let i = 0; i < 17; i++) {
    const a = Math.PI + (i / 16) * Math.PI;
    raios += `<line x1="125" y1="98" x2="${125 + Math.cos(a) * 140}" y2="${98 + Math.sin(a) * 140}"/>`;
  }
  s += `<g stroke="#c9a45c" stroke-width="1" opacity=".45">${raios}</g>`;

  // manto em trapézio com chevrons
  s += `<path d="M110 126 L140 126 L186 150 L196 176 L54 176 L64 150 Z" fill="${p.manto}"/>`;
  s += `<path d="M64 150 L125 176 L186 150" fill="none" stroke="#e8cf8f" stroke-width="2.2"/>`;
  s += `<path d="M58 164 L125 190 L192 164" fill="none" stroke="#e8cf8f" stroke-width="1.2" opacity=".8"/>`;
  s += `<path d="M110 126 L125 176 L140 126" fill="${p.sombra}"/>`;
  s += `<path d="M86 138 L98 176 M164 138 L152 176" stroke="${p.detalhe}" stroke-width="3" opacity=".9"/>`;
  // gola em zigue-zague
  let gola = 'M100 128';
  for (let i = 0; i <= 10; i++) gola += ` L${100 + i * 5} ${i % 2 ? 138 : 126}`;
  s += `<path d="${gola} L150 128 L150 124 L100 124 Z" fill="url(#c-latao)" stroke="${traco}" stroke-width=".8"/>`;

  // cabelo por trás
  if (dama) {
    s += `<path d="M101 104 C99 70 151 70 149 104 L151 126 L138 124 C142 110 140 90 125 88 C110 90 108 110 112 124 L99 126 Z" fill="#0d0d10"/>`;
    s += `<path d="M106 96 C108 80 120 76 130 77" fill="none" stroke="#5b6b8a" stroke-width="2" opacity=".8"/>`;
  } else {
    s += `<path d="M105 92 C104 76 146 76 145 92 L146 112 L104 112 Z" fill="${rei ? '#e8e2d2' : '#3a2616'}"/>`;
  }

  // rosto
  s += `<ellipse cx="125" cy="99" rx="16.5" ry="20.5" fill="${pele}" stroke="${traco}" stroke-width="1.1"/>`;
  s += `<path d="M113 96 Q118 92 123 96 Q118 98.5 113 96Z M127 96 Q132 92 137 96 Q132 98.5 127 96Z" fill="${traco}"/>`;
  s += `<path d="M112 90 L122 89 M128 89 L138 90" stroke="${traco}" stroke-width="1.3"/>`;
  s += `<path d="M125 98 L122.5 107 L126 108" fill="none" stroke="${traco}" stroke-width="1"/>`;
  s += `<path d="M119.5 112.5 Q125 115.5 130.5 112.5" fill="none" stroke="#9b2a40" stroke-width="2"/>`;

  if (rei) {
    // barba geométrica e coroa em zigurate
    s += `<path d="M109 104 C110 116 114 124 125 131 C136 124 140 116 141 104 C136 110 131 112 125 112 C119 112 114 110 109 104Z" fill="#e8e2d2" stroke="${traco}" stroke-width=".8"/>`;
    s += `<path d="M119.5 112.5 Q125 115.5 130.5 112.5" fill="none" stroke="#9b2a40" stroke-width="2"/>`;
    s += `<path d="M103 82 L103 70 L111 70 L111 61 L118 61 L118 52 L132 52 L132 61 L139 61 L139 70 L147 70 L147 82 Z" fill="url(#c-latao)" stroke="${traco}" stroke-width="1"/>`;
    s += `<path d="M103 76 H147" stroke="${traco}" stroke-width=".8"/>`;
    s += `<circle cx="125" cy="66" r="4" fill="${p.detalhe}" stroke="${traco}" stroke-width=".7"/>`;
    s += `<circle cx="110" cy="76" r="2.2" fill="${p.manto}"/><circle cx="140" cy="76" r="2.2" fill="${p.manto}"/>`;
    // espada
    s += `<path d="M178 34 L182 34 L182 160 L180 166 L178 160 Z" fill="#dfe3ea" stroke="${traco}" stroke-width=".8"/>`;
    s += `<rect x="168" y="146" width="24" height="5" rx="2" fill="url(#c-latao)" stroke="${traco}" stroke-width=".7"/>`;
  } else if (dama) {
    // tiara em leque
    let leque = '';
    for (let i = 0; i < 7; i++) {
      const a = Math.PI + 0.35 + (i / 6) * (Math.PI - 0.7);
      leque += `<path d="M125 82 L${125 + Math.cos(a - 0.12) * 22} ${82 + Math.sin(a - 0.12) * 22} A22 22 0 0 1 ${125 + Math.cos(a + 0.12) * 22} ${82 + Math.sin(a + 0.12) * 22} Z"/>`;
    }
    s += `<g fill="url(#c-latao)" stroke="${traco}" stroke-width=".7">${leque}</g>`;
    s += `<circle cx="125" cy="80" r="3.2" fill="${p.detalhe}" stroke="${traco}" stroke-width=".6"/>`;
    s += `<path d="M107 118 l-2.5 6 l2.5 4 l2.5 -4 Z M143 118 l-2.5 6 l2.5 4 l2.5 -4 Z" fill="url(#c-latao)" stroke="${traco}" stroke-width=".6"/>`;
    // flor
    s += `<path d="M76 168 C78 150 76 136 72 124" fill="none" stroke="#2f5a3a" stroke-width="2.2"/>`;
    s += `<path d="M72 124 C62 118 62 104 72 100 C74 108 76 110 72 124Z M72 124 C82 118 82 104 72 100" fill="${p.detalhe}" stroke="${traco}" stroke-width=".7"/>`;
  } else if (valete) {
    // boina inclinada e pena
    s += `<path d="M100 86 C100 70 150 66 152 82 C140 78 112 80 100 86Z" fill="${p.manto}" stroke="${traco}" stroke-width=".9"/>`;
    s += `<path d="M98 86 C112 80 140 78 154 82 L154 86 C140 83 112 85 98 90 Z" fill="url(#c-latao)" stroke="${traco}" stroke-width=".7"/>`;
    s += `<path d="M146 74 C160 60 170 44 186 36 C178 52 168 66 150 78 Z" fill="${p.detalhe}" stroke="${traco}" stroke-width=".8"/>`;
    s += `<path d="M148 76 C162 62 172 48 184 38" fill="none" stroke="${traco}" stroke-width=".6"/>`;
    // alabarda
    s += `<path d="M70 40 L73 40 L73 170 L70 170 Z" fill="#6a4a2a"/>`;
    s += `<path d="M71.5 30 L78 44 L71.5 50 L65 44 Z M73 52 C84 54 88 62 86 70 C82 64 78 62 73 62 Z" fill="#dfe3ea" stroke="${traco}" stroke-width=".7"/>`;
  }
  // A figura cresce 14% a partir da linha do meio; o pip do naipe fica fora
  // da escala, no canto da moldura.
  return `<g transform="translate(125 176) scale(1.14) translate(-125 -176)">${s}</g>` + pip(naipe, 62, 48, 22);
}

function faceFigura(v, naipe) {
  const meia = meiaFigura(v, naipe);
  return fundo() + indices(v, naipe) + `
    <clipPath id="c-mold-${v}-${naipe}"><rect x="44" y="28" width="162" height="294" rx="4"/></clipPath>
    <rect x="44" y="28" width="162" height="294" rx="4" fill="#f8f1e2"/>
    <g clip-path="url(#c-mold-${v}-${naipe})">
      <g>${meia}</g>
      <g transform="rotate(180 125 175)">${meia}</g>
    </g>
    <path d="M44 205 L206 145" stroke="#c9a45c" stroke-width="1.4"/>
    <rect x="44" y="28" width="162" height="294" rx="4" fill="none" stroke="#2a1d12" stroke-width="1.6"/>
    <rect x="48" y="32" width="154" height="286" rx="2" fill="none" stroke="#c9a45c" stroke-width="1"/>`;
}

function verso() {
  let leque = '';
  for (let i = 0; i < 24; i++) {
    const a = (i / 24) * Math.PI * 2;
    leque += `<line x1="${125 + Math.cos(a) * 30}" y1="${175 + Math.sin(a) * 30}" x2="${125 + Math.cos(a) * 60}" y2="${175 + Math.sin(a) * 60}"/>`;
  }
  return `<rect width="${W}" height="${H}" rx="16" fill="#f3ead7"/>
    <rect x="9" y="9" width="${W - 18}" height="${H - 18}" rx="9" fill="url(#c-verso-fundo)"/>
    <rect x="9" y="9" width="${W - 18}" height="${H - 18}" rx="9" fill="url(#c-verso-trama)"/>
    <rect x="17" y="17" width="${W - 34}" height="${H - 34}" rx="5" fill="none" stroke="#e8cf8f" stroke-width="1.4" opacity=".85"/>
    <rect x="22" y="22" width="${W - 44}" height="${H - 44}" rx="3" fill="none" stroke="#c9a45c" stroke-width=".7" opacity=".7"/>
    <path d="M125 90 L180 175 L125 260 L70 175 Z" fill="#5a1422" stroke="#e8cf8f" stroke-width="1.6"/>
    <g stroke="#c9a45c" stroke-width="1.2" opacity=".85">${leque}</g>
    <circle cx="125" cy="175" r="28" fill="#3f0e18" stroke="#e8cf8f" stroke-width="1.4"/>
    <text x="125" y="188" text-anchor="middle" font-family="Limelight, serif" font-size="36" fill="url(#c-latao)">B</text>
    <path d="M22 60 L60 22 M190 22 L228 60 M22 290 L60 328 M190 328 L228 290" stroke="#e8cf8f" stroke-width="1.2" opacity=".7"/>`;
}

function defs() {
  return `<defs>
    <linearGradient id="c-papel" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#fbf6ea"/><stop offset=".6" stop-color="#f3ead7"/><stop offset="1" stop-color="#e7dcc3"/>
    </linearGradient>
    <linearGradient id="c-latao" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#f1dca0"/><stop offset=".35" stop-color="#c9a45c"/><stop offset=".7" stop-color="#8f6f35"/><stop offset="1" stop-color="#d4b06a"/>
    </linearGradient>
    <radialGradient id="c-verso-fundo" cx=".5" cy=".5" r=".7">
      <stop offset="0" stop-color="#7a1c2e"/><stop offset=".7" stop-color="#5a1422"/><stop offset="1" stop-color="#3a0c16"/>
    </radialGradient>
    <pattern id="c-verso-trama" width="16" height="16" patternUnits="userSpaceOnUse">
      <path d="M8 0 L16 8 L8 16 L0 8 Z" fill="none" stroke="#c9a45c" stroke-width=".7" opacity=".45"/>
      <circle cx="8" cy="8" r="1.1" fill="#e8cf8f" opacity=".5"/>
    </pattern>
  </defs>`;
}

export function desenhoFace(c) {
  const v = valorDe(c), n = naipeDe(c);
  if (v === 0) return faceAs(n);
  if (v >= 10) return faceFigura(v, n);
  return faceNumerica(v, n);
}

export function spriteCartas() {
  let s = `<svg xmlns="http://www.w3.org/2000/svg" id="sprite-cartas" width="0" height="0" style="position:absolute;width:0;height:0;overflow:hidden" aria-hidden="true">${defs()}`;
  for (let c = 0; c < 52; c++) s += `<symbol id="carta-${c}" viewBox="0 0 ${W} ${H}">${desenhoFace(c)}</symbol>`;
  s += `<symbol id="carta-verso" viewBox="0 0 ${W} ${H}">${verso()}</symbol>`;
  for (let n = 0; n < 4; n++) s += `<symbol id="naipe-${n}" viewBox="0 0 100 100"><path d="${NAIPE_PATH[n]}" fill="currentColor"/></symbol>`;
  s += '</svg>';
  return s;
}

let instalado = false;
export function instalarCartas() {
  if (instalado) return;
  instalado = true;
  document.body.insertAdjacentHTML('afterbegin', spriteCartas());
}

// Uma carta na mesa: .carta > .giro > (.face + .costas). "virada" mostra o verso.
export function elementoCarta(c, { virada = false, largura = null } = {}) {
  const el = document.createElement('div');
  el.className = 'carta' + (virada ? ' virada' : '');
  if (largura) el.style.setProperty('--l', largura + 'px');
  el.innerHTML = `<div class="giro">
    <div class="face"><svg viewBox="0 0 ${W} ${H}"><use href="#carta-${c ?? 0}"/></svg><div class="brilho"></div></div>
    <div class="costas"><svg viewBox="0 0 ${W} ${H}"><use href="#carta-verso"/></svg></div>
  </div>`;
  el.dataset.carta = c ?? '';
  return el;
}

// Troca a face de uma carta que estava de costas (a carta oculta da banca só
// passa a existir no DOM quando é revelada: nada de espiar pelo inspetor).
export function definirFace(el, c) {
  el.querySelector('.face use').setAttribute('href', `#carta-${c}`);
  el.dataset.carta = c;
}

export function iconeNaipe(n, tam = 14) {
  return `<svg viewBox="0 0 100 100" width="${tam}" height="${tam}" style="color:${TINTA[n] === '#16161b' ? 'currentColor' : '#e0485c'}"><use href="#naipe-${n}"/></svg>`;
}

export const PROPORCAO = H / W;
