// Fichas em SVG: base, oito insertos na borda, anel pontilhado e o miolo de
// marfim com o valor. As pilhas decompõem o valor nas fichas da casa, da
// maior para a menor, e crescem para cima.

import { fichas } from '../nucleo/formato.js';

export const DENOMINACOES = [
  { valor: 100, nome: '1', base: '#ece2cc', borda: '#1f4f9a', tinta: '#1f4f9a', luz: '#ffffff' },
  { valor: 500, nome: '5', base: '#b3192e', borda: '#f3ead7', tinta: '#8f1224', luz: '#ff6a78' },
  { valor: 2500, nome: '25', base: '#177a4c', borda: '#f3ead7', tinta: '#0f5a37', luz: '#4fd69a' },
  { valor: 10000, nome: '100', base: '#17171b', borda: '#e8cf8f', tinta: '#17171b', luz: '#55555f' },
  { valor: 50000, nome: '500', base: '#5b2a86', borda: '#e8cf8f', tinta: '#4a1f70', luz: '#a26ad6' },
  { valor: 100000, nome: '1K', base: '#d9a133', borda: '#5a1422', tinta: '#7a4a10', luz: '#ffe39a' },
];

function setor(r1, r2, a1, a2) {
  const p = (r, a) => `${(50 + Math.cos(a) * r).toFixed(2)} ${(50 + Math.sin(a) * r).toFixed(2)}`;
  return `M${p(r2, a1)} A${r2} ${r2} 0 0 1 ${p(r2, a2)} L${p(r1, a2)} A${r1} ${r1} 0 0 0 ${p(r1, a1)} Z`;
}

function desenhoFicha(d) {
  let insertos = '';
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2 - Math.PI / 2;
    insertos += `<path d="${setor(36.5, 48, a - 0.16, a + 0.16)}"/>`;
  }
  let ranhuras = '';
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2 - Math.PI / 2 + Math.PI / 8;
    ranhuras += `<path d="${setor(40, 45, a - 0.05, a + 0.05)}"/>`;
  }
  const escuro = d.valor === 10000;
  const tam = d.nome.length >= 3 ? 19 : d.nome.length === 2 ? 23 : 26;
  return `
    <circle cx="50" cy="50" r="48" fill="url(#f-grad-${d.valor})"/>
    <g fill="${d.borda}">${insertos}</g>
    <g fill="${d.base}" opacity=".55">${ranhuras}</g>
    <circle cx="50" cy="50" r="47.3" fill="none" stroke="rgba(0,0,0,.35)" stroke-width="1.4"/>
    <circle cx="50" cy="50" r="34.5" fill="none" stroke="${d.borda}" stroke-width="1.3" stroke-dasharray="2.2 2.6" opacity=".9"/>
    <circle cx="50" cy="50" r="29" fill="${escuro ? '#f0e4c4' : '#f6efe0'}" stroke="${escuro ? '#c9a45c' : 'rgba(0,0,0,.25)'}" stroke-width="1.2"/>
    <circle cx="50" cy="50" r="26" fill="none" stroke="#c9a45c" stroke-width=".8" opacity=".85"/>
    <text x="50" y="${50 + tam * 0.36}" text-anchor="middle" font-family="Jost, sans-serif" font-weight="700" font-size="${tam}" fill="${d.tinta}" letter-spacing="-.5">${d.nome}</text>
    <text x="50" y="35" text-anchor="middle" font-family="Jost, sans-serif" font-weight="600" font-size="5.6" letter-spacing="1.6" fill="#7d6230">BANCA</text>
    <ellipse cx="42" cy="30" rx="30" ry="18" fill="url(#f-luz)" opacity=".55"/>`;
}

export function spriteFichas() {
  let defs = `<radialGradient id="f-luz" cx=".5" cy=".4" r=".6"><stop offset="0" stop-color="#fff" stop-opacity=".55"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></radialGradient>`;
  let simbolos = '';
  for (const d of DENOMINACOES) {
    defs += `<radialGradient id="f-grad-${d.valor}" cx=".38" cy=".32" r=".8"><stop offset="0" stop-color="${d.luz}"/><stop offset=".45" stop-color="${d.base}"/><stop offset="1" stop-color="${d.base}"/></radialGradient>`;
    simbolos += `<symbol id="ficha-${d.valor}" viewBox="0 0 100 100">${desenhoFicha(d)}</symbol>`;
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" id="sprite-fichas" width="0" height="0" style="position:absolute;width:0;height:0;overflow:hidden" aria-hidden="true"><defs>${defs}</defs>${simbolos}</svg>`;
}

let instalado = false;
export function instalarFichas() {
  if (instalado) return;
  instalado = true;
  document.body.insertAdjacentHTML('afterbegin', spriteFichas());
}

export function svgFicha(valor) {
  return `<svg viewBox="0 0 100 100"><use href="#ficha-${valor}"/></svg>`;
}

// Decompõe um valor em fichas, da maior para a menor. Centavos que não formam
// ficha inteira (meia ficha do 3 para 2) aparecem só no rótulo.
export function decompor(valor) {
  const saida = [];
  let resto = valor;
  for (let i = DENOMINACOES.length - 1; i >= 0; i--) {
    const d = DENOMINACOES[i].valor;
    while (resto >= d) { saida.push(d); resto -= d; }
  }
  return saida;
}

// A ficha de maior valor que cabe (para o voo: poucas fichas bonitas em vez
// de trinta brancas).
export function fichasParaVoo(valor, maximo = 8) {
  const f = decompor(valor);
  if (f.length <= maximo) return f;
  return f.slice(0, maximo);
}

export const MAX_PILHA = 16;
const ACHATA = 0.62;       // elipse do topo: a mesa é vista a uns 38 graus
const ESPESSURA = 7;       // lado visível de cada ficha, em unidades de 100

function escurecer(hex, f) {
  const n = parseInt(hex.slice(1), 16);
  const r = Math.round(((n >> 16) & 255) * f), g = Math.round(((n >> 8) & 255) * f), b = Math.round((n & 255) * f);
  return `rgb(${r},${g},${b})`;
}

const POR_VALOR = Object.fromEntries(DENOMINACOES.map(d => [d.valor, d]));

// Lado de uma ficha: faixa escura com os insertos da borda projetados na
// metade da frente do cilindro.
function lado(d, y, giro) {
  const cy = y + 50 * ACHATA, ry = 48 * ACHATA;
  let s = `<path d="M2 ${cy} V${cy + ESPESSURA} A48 ${ry} 0 0 0 98 ${cy + ESPESSURA} V${cy} A48 ${ry} 0 0 1 2 ${cy} Z" fill="${escurecer(d.base, 0.72)}"/>`;
  for (let k = 0; k < 8; k++) {
    const a = giro + (k / 8) * Math.PI * 2;
    const sn = Math.sin(a);
    if (sn <= 0.08) continue;
    const x = 50 + 48 * Math.cos(a);
    const w = 15 * sn;
    const yb = cy + ry * sn;
    s += `<rect x="${(x - w / 2).toFixed(2)}" y="${yb.toFixed(2)}" width="${w.toFixed(2)}" height="${ESPESSURA}" fill="${d.borda}" opacity=".92"/>`;
  }
  s += `<path d="M2 ${cy + ESPESSURA} A48 ${ry} 0 0 0 98 ${cy + ESPESSURA}" fill="none" stroke="rgba(0,0,0,.45)" stroke-width="1.2"/>`;
  return s;
}

// Uma pilha como um SVG só: de baixo para cima, maior valor embaixo.
export function svgPilha(valor) {
  const f = decompor(valor).slice(0, MAX_PILHA);
  const n = f.length;
  const alturaTopo = 100 * ACHATA;
  const altura = alturaTopo + n * ESPESSURA;
  let s = '';
  for (let i = 0; i < n; i++) {
    const d = POR_VALOR[f[i]];
    const y = (n - 1 - i) * ESPESSURA;
    const giro = (i * 1.37) % (Math.PI * 2);
    s += lado(d, y, giro);
    s += `<use href="#ficha-${d.valor}" width="100" height="100" transform="translate(0 ${y}) scale(1 ${ACHATA})"/>`;
  }
  return { svg: `<svg viewBox="0 0 100 ${altura.toFixed(1)}" preserveAspectRatio="xMidYMax meet" style="overflow:visible">${s}</svg>`, altura, n };
}

// HTML de uma pilha para posicionar no feltro: a base da pilha fica no ponto
// da aposta e ela cresce para cima.
export function htmlPilha(valor, { rotulo = true } = {}) {
  if (valor <= 0) return '';
  const p = svgPilha(valor);
  const razao = p.altura / 100;
  return `<div class="corpo" style="height:calc(var(--d, 40px) * ${razao.toFixed(3)})">${p.svg}</div>` +
    (rotulo ? `<div class="valor">${fichas(valor)}</div>` : '');
}
