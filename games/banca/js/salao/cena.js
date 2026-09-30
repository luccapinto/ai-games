// O salão da BANCA em isométrico: piso de mármore com incrustação de latão,
// duas paredes de vinho com pilastras, o letreiro de neon, o caixa, a fila
// de caça-níqueis, o bar do vídeo pôquer e as quatro mesas sob abajures.
//
// Tudo o que não se mexe é desenhado uma vez numa camada estática; o que se
// mexe (neon, cones de luz, fumaça, rolos, a roda da roleta) é desenhado por
// quadro por cima, em poucas chamadas.

import { iso, caminho, caixa, elipse, cilindro, gradLado, planoParede, RX, RY, LX, LY, LZ, envoltoria } from './iso.js';
import { aleatorioSemeado, tela } from '../visual/texturas.js';

export const MUNDO = { X: 18, Y: 11, H: 4.6 };
export const LIMITES = { x0: -MUNDO.Y * LX - 40, x1: MUNDO.X * LX + 40, y0: -MUNDO.H * LZ - 150, y1: (MUNDO.X + MUNDO.Y) * LY + 30 };

const LATAO = '#c9a45c', LATAO_CLARO = '#e8cf8f', LATAO_ESCURO = '#7d6230';
const VERMELHO = '#b3192e';
const ROLETA = [0, 32, 15, 19, 4, 21, 2, 25, 17, 34, 6, 27, 13, 36, 11, 30, 8, 23, 10, 5, 24, 16, 33, 1, 20, 14, 31, 9, 22, 18, 29, 7, 28, 12, 35, 3, 26];
const VERMELHOS = new Set([1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36]);

function planoH(g, z) {
  g.transform(LX, LY, -LX, LY, 0, -z * LZ);
}

// ------------------------------------------------------------------ piso

function piso(g) {
  const { X, Y } = MUNDO;
  const r = aleatorioSemeado(21);
  g.save();
  planoH(g, 0);
  for (let x = 0; x < X; x++) for (let y = 0; y < Y; y++) {
    const par = (x + y) % 2 === 0;
    g.fillStyle = par ? '#17131a' : '#211419';
    g.fillRect(x, y, 1, 1);
  }
  // veios do mármore
  g.lineWidth = 0.012;
  for (let i = 0; i < 90; i++) {
    const x = r() * X, y = r() * Y;
    g.strokeStyle = `rgba(210,190,200,${0.03 + r() * 0.05})`;
    g.beginPath(); g.moveTo(x, y);
    g.bezierCurveTo(x + r() * 1.5, y + r() - 0.5, x + r() * 2, y + r() * 1.4 - 0.7, x + 1 + r() * 2, y + r() * 2 - 1);
    g.stroke();
  }
  // juntas
  g.strokeStyle = 'rgba(0,0,0,.55)';
  g.lineWidth = 0.02;
  for (let x = 0; x <= X; x++) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, Y); g.stroke(); }
  for (let y = 0; y <= Y; y++) { g.beginPath(); g.moveTo(0, y); g.lineTo(X, y); g.stroke(); }
  // incrustação de latão: moldura dupla e o medalhão em sol no centro
  g.strokeStyle = 'rgba(201,164,92,.42)';
  g.lineWidth = 0.035;
  g.strokeRect(0.5, 0.5, X - 1, Y - 1);
  g.lineWidth = 0.018;
  g.strokeRect(0.62, 0.62, X - 1.24, Y - 1.24);
  const cx = 9.1, cy = 6.1;
  for (const rr of [1.2, 1.35, 2.1]) { g.beginPath(); g.arc(cx, cy, rr, 0, Math.PI * 2); g.lineWidth = rr === 2.1 ? 0.03 : 0.02; g.stroke(); }
  g.beginPath();
  for (let i = 0; i < 32; i++) {
    const a = (i / 32) * Math.PI * 2;
    const ra = i % 2 ? 1.35 : 2.1;
    g.moveTo(cx + Math.cos(a) * 1.2, cy + Math.sin(a) * 1.2);
    g.lineTo(cx + Math.cos(a) * ra, cy + Math.sin(a) * ra);
  }
  g.lineWidth = 0.016; g.stroke();
  g.fillStyle = 'rgba(201,164,92,.18)';
  g.beginPath();
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * Math.PI * 2 - Math.PI / 2;
    const ra = i % 2 ? 0.45 : 1.1;
    g.lineTo(cx + Math.cos(a) * ra, cy + Math.sin(a) * ra);
  }
  g.closePath(); g.fill();
  // chevrons de latão que levam da frente ao medalhão
  g.lineWidth = 0.02;
  g.strokeStyle = 'rgba(201,164,92,.3)';
  for (let k = 0; k < 4; k++) {
    const d = 2.8 + k * 0.9;
    g.beginPath(); g.moveTo(cx + d, cy + d - 1.1); g.lineTo(cx + d + 0.45, cy + d + 0.45); g.lineTo(cx + d - 1.1, cy + d); g.stroke();
  }
  g.restore();
}

// ------------------------------------------------------------------ paredes

function parede(g, qual) {
  const { X, Y, H } = MUNDO;
  const comp = qual === 'direita' ? X : Y;
  g.save();
  if (qual === 'direita') planoParede(g, 'direita', 0, 0, 0);
  else planoParede(g, 'esquerda', 0, Y, 0);
  const U = LX, V = LZ;
  const L = comp * U, A = H * V;
  // papel de parede vinho
  const gr = g.createLinearGradient(0, -A, 0, 0);
  gr.addColorStop(0, qual === 'direita' ? '#2c0a14' : '#240811');
  gr.addColorStop(0.6, qual === 'direita' ? '#3d0f1d' : '#330c18');
  gr.addColorStop(1, '#1a060c');
  g.fillStyle = gr;
  g.fillRect(0, -A, L, A);
  // escamas art déco no papel
  g.strokeStyle = 'rgba(201,164,92,.09)';
  g.lineWidth = 1;
  for (let fy = -A + 30; fy < -80; fy += 26) {
    for (let fx = ((fy / 26) % 2 ? 0 : 18); fx < L; fx += 36) {
      g.beginPath(); g.arc(fx, fy, 16, Math.PI, 0); g.stroke();
      g.beginPath(); g.arc(fx, fy, 9, Math.PI, 0); g.stroke();
    }
  }
  // lambri de madeira
  const lam = 1.15 * V;
  const gm = g.createLinearGradient(0, -lam, 0, 0);
  gm.addColorStop(0, '#2d1a10'); gm.addColorStop(1, '#140b07');
  g.fillStyle = gm;
  g.fillRect(0, -lam, L, lam);
  g.strokeStyle = 'rgba(201,164,92,.28)';
  for (let px = 18; px < L - 30; px += 96) g.strokeRect(px, -lam + 14, 78, lam - 26);
  g.fillStyle = LATAO;
  g.fillRect(0, -lam - 3, L, 3);
  g.fillStyle = 'rgba(0,0,0,.5)';
  g.fillRect(0, -lam, L, 2);
  // cornija em degraus
  const cor = ['#1a060c', LATAO_ESCURO, '#2a0b15', LATAO, '#14050a'];
  let yy = -A;
  for (let i = 0; i < cor.length; i++) {
    const h = [10, 3, 8, 2, 6][i];
    g.fillStyle = cor[i];
    g.fillRect(0, yy, L, h);
    yy += h;
  }
  // pilastras
  for (let px = 0; px <= L; px += 3 * U) {
    const w = 22;
    const x = Math.min(Math.max(px - w / 2, 0), L - w);
    const gp = g.createLinearGradient(x, 0, x + w, 0);
    gp.addColorStop(0, '#12040a'); gp.addColorStop(0.5, '#2a0c16'); gp.addColorStop(1, '#0d0307');
    g.fillStyle = gp;
    g.fillRect(x, -A + 29, w, A - 29);
    g.fillStyle = 'rgba(201,164,92,.55)';
    g.fillRect(x, -A + 29, 1.5, A - 29);
    g.fillRect(x + w - 1.5, -A + 29, 1.5, A - 29);
    // capitel em degraus
    g.fillStyle = LATAO;
    g.fillRect(x - 4, -A + 29, w + 8, 3);
    g.fillRect(x - 2, -A + 36, w + 4, 2);
  }
  // rodapé
  g.fillStyle = '#0a0506';
  g.fillRect(0, -8, L, 8);
  g.restore();
}

// Arandela em leque presa numa pilastra (a luz dela é dinâmica).
function arandela(g, qual, u) {
  const { Y } = MUNDO;
  g.save();
  if (qual === 'direita') planoParede(g, 'direita', 0, 0, 0);
  else planoParede(g, 'esquerda', 0, Y, 0);
  const x = u * LX, y = -2.75 * LZ;
  g.fillStyle = LATAO;
  g.beginPath(); g.moveTo(x - 16, y); g.lineTo(x + 16, y); g.lineTo(x + 6, y + 22); g.lineTo(x - 6, y + 22); g.closePath(); g.fill();
  g.fillStyle = '#ffe6b0';
  g.beginPath(); g.moveTo(x - 13, y); g.quadraticCurveTo(x, y - 18, x + 13, y); g.closePath(); g.fill();
  g.strokeStyle = LATAO_ESCURO; g.lineWidth = 1;
  for (let i = -2; i <= 2; i++) { g.beginPath(); g.moveTo(x, y + 20); g.lineTo(x + i * 6, y); g.stroke(); }
  g.restore();
}

// ------------------------------------------------------------------ figuras

// Crupiê de colete: desenhado a partir do ponto dos pés, em px de tela.
function crupie(g, x, y, virar = 1, cor = '#15121a') {
  const [sx, sy] = iso(x, y, 0);
  g.save();
  g.translate(sx, sy);
  g.scale(virar, 1);
  g.fillStyle = 'rgba(0,0,0,.35)';
  g.beginPath(); g.ellipse(0, 0, 22, 9, 0, 0, Math.PI * 2); g.fill();
  g.fillStyle = '#0c0b0f';
  g.beginPath(); g.moveTo(-11, 0); g.lineTo(-9, -66); g.lineTo(9, -66); g.lineTo(11, 0); g.lineTo(3, 0); g.lineTo(0, -40); g.lineTo(-3, 0); g.closePath(); g.fill();
  // camisa e colete
  g.fillStyle = '#e9e1cf';
  g.beginPath(); g.moveTo(-15, -64); g.lineTo(-17, -104); g.quadraticCurveTo(0, -114, 17, -104); g.lineTo(15, -64); g.closePath(); g.fill();
  g.fillStyle = cor;
  g.beginPath(); g.moveTo(-15, -64); g.lineTo(-16, -102); g.lineTo(-5, -104); g.lineTo(0, -84); g.lineTo(5, -104); g.lineTo(16, -102); g.lineTo(15, -64); g.closePath(); g.fill();
  g.fillStyle = LATAO;
  for (const by of [-78, -71]) { g.beginPath(); g.arc(0, by, 1.4, 0, Math.PI * 2); g.fill(); }
  // braços
  g.fillStyle = '#e9e1cf';
  g.beginPath(); g.moveTo(-17, -102); g.lineTo(-23, -76); g.lineTo(-18, -74); g.lineTo(-13, -96); g.closePath(); g.fill();
  g.beginPath(); g.moveTo(17, -102); g.lineTo(23, -76); g.lineTo(18, -74); g.lineTo(13, -96); g.closePath(); g.fill();
  g.fillStyle = '#d8b48f';
  g.beginPath(); g.arc(-21, -74, 3.2, 0, Math.PI * 2); g.arc(21, -74, 3.2, 0, Math.PI * 2); g.fill();
  // gravata borboleta
  g.fillStyle = '#5a1422';
  g.beginPath(); g.moveTo(-6, -109); g.lineTo(0, -106.5); g.lineTo(6, -109); g.lineTo(6, -104); g.lineTo(0, -106.5); g.lineTo(-6, -104); g.closePath(); g.fill();
  // cabeça
  g.fillStyle = '#d8b48f';
  g.beginPath(); g.ellipse(0, -121, 8.5, 10, 0, 0, Math.PI * 2); g.fill();
  g.fillStyle = '#0f0b08';
  g.beginPath(); g.ellipse(0, -126, 9, 6.5, 0, Math.PI, 0); g.lineTo(9, -122); g.quadraticCurveTo(3, -127, -9, -122); g.closePath(); g.fill();
  // luz de recorte do abajur
  g.strokeStyle = 'rgba(255,220,160,.45)'; g.lineWidth = 1.2;
  g.beginPath(); g.arc(0, -121, 9, -2.4, -1.1); g.stroke();
  g.restore();
}

function banqueta(g, x, y, cor = '#6a1426') {
  cilindro(g, x, y, 0, 0.07, 0.62, { lado: '#1a1410', topo: '#2a2016' });
  cilindro(g, x, y, 0.62, 0.24, 0.1, { lado: (gg, a, b) => gradLado(gg, a, b, '#2a0a12', cor), topo: cor, aro: 'rgba(201,164,92,.6)', aroLargura: 1.2 });
}

function palmeira(g, x, y) {
  cilindro(g, x, y, 0, 0.32, 0.55, { lado: (gg, a, b) => gradLado(gg, a, b, '#3b2a10', '#b8954f'), topo: '#1a120a', aro: LATAO_CLARO, aroLargura: 1.2 });
  const [sx, sy] = iso(x, y, 0.55);
  g.save();
  g.translate(sx, sy);
  g.strokeStyle = '#3a2a18'; g.lineWidth = 5;
  g.beginPath(); g.moveTo(0, 0); g.quadraticCurveTo(6, -60, 2, -120); g.stroke();
  const r = aleatorioSemeado(Math.round(x * 13 + y * 7));
  for (let i = 0; i < 9; i++) {
    const a = -Math.PI / 2 + (i - 4) * 0.42 + (r() - 0.5) * 0.2;
    const l = 55 + r() * 30;
    const ex = 2 + Math.cos(a) * l, ey = -120 + Math.sin(a) * l * 0.55 + l * 0.35;
    g.strokeStyle = i % 2 ? '#133a26' : '#0e2c1d';
    g.lineWidth = 2.2;
    g.beginPath(); g.moveTo(2, -120); g.quadraticCurveTo(2 + Math.cos(a) * l * 0.6, -120 + Math.sin(a) * l * 0.6 - 10, ex, ey); g.stroke();
    for (let k = 1; k < 9; k++) {
      const t = k / 9;
      const px = 2 + (ex - 2) * t, py = -120 + (ey + 120) * t - Math.sin(t * Math.PI) * 14;
      g.lineWidth = 1.4;
      g.beginPath(); g.moveTo(px, py); g.lineTo(px + Math.cos(a + 1.3) * 12 * (1 - t * 0.5), py + 10 * (1 - t * 0.4)); g.stroke();
      g.beginPath(); g.moveTo(px, py); g.lineTo(px + Math.cos(a - 1.3) * 12 * (1 - t * 0.5), py + 10 * (1 - t * 0.4)); g.stroke();
    }
  }
  g.restore();
}

function poste(g, x, y) {
  cilindro(g, x, y, 0, 0.12, 0.05, { lado: LATAO_ESCURO, topo: LATAO });
  cilindro(g, x, y, 0.05, 0.03, 0.95, { lado: (gg, a, b) => gradLado(gg, a, b, LATAO_ESCURO, LATAO_CLARO), topo: LATAO });
  elipse(g, x, y, 1.02, 0.06, LATAO_CLARO);
}

function corda(g, a, b) {
  const [ax, ay] = iso(a[0], a[1], 0.92), [bx, by] = iso(b[0], b[1], 0.92);
  g.strokeStyle = '#7a1628'; g.lineWidth = 4; g.lineCap = 'round';
  g.beginPath(); g.moveTo(ax, ay); g.quadraticCurveTo((ax + bx) / 2, (ay + by) / 2 + 26, bx, by); g.stroke();
  g.strokeStyle = 'rgba(255,140,160,.35)'; g.lineWidth = 1.2;
  g.beginPath(); g.moveTo(ax, ay - 1); g.quadraticCurveTo((ax + bx) / 2, (ay + by) / 2 + 25, bx, by - 1); g.stroke();
}

// ------------------------------------------------------------------ mesas

function feltroGrad(g, cx, cy, r, base = '#15533f', borda = '#0a2a21') {
  const gr = g.createRadialGradient(cx, cy - r * 0.2, r * 0.1, cx, cy, r);
  gr.addColorStop(0, base); gr.addColorStop(1, borda);
  return gr;
}

const MADEIRA = { topo: '#3b2414', esq: '#24150b', dir: '#352010' };

function pes(g, pontos, z = 0.9) {
  for (const [x, y] of pontos) caixa(g, x - 0.06, y - 0.06, 0, 0.12, 0.12, z, { topo: '#2a1a0e', esq: '#140b06', dir: '#22150b' });
}

function mesaRoleta(g, m) {
  const { x0, y0, x1, y1 } = m;
  const z = 0.92;
  crupie(g, x0 + 0.7, y0 - 0.55, 1);
  pes(g, [[x0 + 0.2, y0 + 0.2], [x1 - 0.2, y0 + 0.2], [x0 + 0.2, y1 - 0.2], [x1 - 0.2, y1 - 0.2]], z - 0.1);
  caixa(g, x0, y0, z - 0.14, x1 - x0, y1 - y0, 0.14, { ...MADEIRA, linha: 'rgba(0,0,0,.3)' });
  // feltro
  g.save(); planoH(g, z);
  g.fillStyle = '#0f4a37';
  g.fillRect(x0 + 0.08, y0 + 0.08, x1 - x0 - 0.16, y1 - y0 - 0.16);
  // tabuleiro: zero e 12 colunas por 3 linhas
  const gx0 = x0 + 1.55, gx1 = x1 - 0.2, gy0 = y0 + 0.28, gy1 = y1 - 0.5;
  const cw = (gx1 - gx0) / 12, ch = (gy1 - gy0) / 3;
  for (let c = 0; c < 12; c++) for (let r = 0; r < 3; r++) {
    const n = c * 3 + (3 - r);
    g.fillStyle = VERMELHOS.has(n) ? '#a11a2c' : '#141216';
    g.fillRect(gx0 + c * cw + 0.012, gy0 + r * ch + 0.012, cw - 0.024, ch - 0.024);
  }
  g.fillStyle = '#1f7a4c';
  g.fillRect(gx0 - cw * 0.9, gy0, cw * 0.86, gy1 - gy0);
  g.strokeStyle = 'rgba(243,234,215,.75)'; g.lineWidth = 0.014;
  g.strokeRect(gx0 - cw * 0.9, gy0, gx1 - gx0 + cw * 0.9, gy1 - gy0);
  // faixa das apostas de fora
  for (let k = 0; k < 6; k++) {
    g.strokeRect(gx0 + k * 2 * cw, gy1 + 0.04, 2 * cw, 0.22);
  }
  g.restore();
  // borda acolchoada
  g.save(); planoH(g, z + 0.02);
  g.strokeStyle = '#2a120a'; g.lineWidth = 0.1;
  g.strokeRect(x0 + 0.04, y0 + 0.04, x1 - x0 - 0.08, y1 - y0 - 0.08);
  g.strokeStyle = 'rgba(201,164,92,.7)'; g.lineWidth = 0.015;
  g.strokeRect(x0 + 0.1, y0 + 0.1, x1 - x0 - 0.2, y1 - y0 - 0.2);
  g.restore();
  // a roda: base de madeira e cuba (o rotor é dinâmico)
  const { rx: wx, ry: wy } = m.roda;
  cilindro(g, wx, wy, z, 0.64, 0.18, { lado: (gg, a, b) => gradLado(gg, a, b, '#1d1008', '#6a4020'), topo: '#2a170c', aro: LATAO, aroLargura: 2 });
  elipse(g, wx, wy, z + 0.18, 0.52, '#120a06');
  for (const [dx, dy] of [[0.9, 1.0], [1.8, 1.1], [0.7, -0.4]]) banqueta(g, x0 + 1.8 + dx, y1 + 0.55 + dy * 0.1);
}

function mesaMeiaLua(g, m, { feltro = '#15533f', borda = '#0a2a21', texto = 'BLACKJACK PAGA 3 PARA 2' } = {}) {
  const { cx, cy, r } = m;
  const z = 0.92;
  // o lado reto fica para o fundo (-x -y), a banca de pé atrás dele
  crupie(g, cx - 0.55, cy - 0.55, 1);
  const dir = [-Math.SQRT1_2, -Math.SQRT1_2];
  const pontos = [];
  for (let i = 0; i <= 24; i++) {
    const a = Math.PI / 4 + Math.PI * (i / 24) - Math.PI;
    pontos.push([cx + Math.cos(a + Math.PI) * r, cy + Math.sin(a + Math.PI) * r]);
  }
  // lateral
  const topo = pontos.map(([x, y]) => iso(x, y, z));
  const base = pontos.map(([x, y]) => iso(x, y, z - 0.16));
  g.beginPath();
  topo.forEach(([x, y], i) => i ? g.lineTo(x, y) : g.moveTo(x, y));
  for (let i = base.length - 1; i >= 0; i--) g.lineTo(base[i][0], base[i][1]);
  g.closePath();
  g.fillStyle = gradLado(g, Math.min(...base.map(p => p[0])), Math.max(...base.map(p => p[0])), '#1a0f07', '#4a2c16');
  g.fill();
  for (const [x, y] of [[cx + dir[0] * 0.1, cy + dir[1] * 0.1], [cx + 0.6, cy + 0.6]]) caixa(g, x - 0.1, y - 0.1, 0, 0.2, 0.2, z - 0.16, { topo: '#1a0f07', esq: '#0e0804', dir: '#160c06' });
  // tampo
  g.beginPath();
  topo.forEach(([x, y], i) => i ? g.lineTo(x, y) : g.moveTo(x, y));
  g.closePath();
  const [scx, scy] = iso(cx, cy, z);
  g.fillStyle = feltroGrad(g, scx, scy, r * RX, feltro, borda);
  g.fill();
  // borda de couro
  g.strokeStyle = '#2a140a'; g.lineWidth = 7;
  g.beginPath();
  topo.forEach(([x, y], i) => i ? g.lineTo(x, y) : g.moveTo(x, y));
  g.stroke();
  g.strokeStyle = 'rgba(201,164,92,.75)'; g.lineWidth = 1.2;
  g.beginPath();
  topo.forEach(([x, y], i) => i ? g.lineTo(x, y) : g.moveTo(x, y));
  g.stroke();
  // arco impresso e lugares
  g.save(); planoH(g, z);
  g.strokeStyle = 'rgba(232,207,143,.55)'; g.lineWidth = 0.02;
  g.beginPath(); g.arc(cx, cy, r * 0.62, Math.PI / 4 - 0.1, Math.PI * 1.25 + 0.1, false); g.stroke();
  for (let i = 0; i < 5; i++) {
    const a = Math.PI / 4 + (Math.PI * (i + 0.5)) / 5;
    g.beginPath(); g.arc(cx + Math.cos(a) * r * 0.78, cy + Math.sin(a) * r * 0.78, 0.13, 0, Math.PI * 2); g.stroke();
  }
  g.restore();
  // texto do arco
  g.save(); planoH(g, z);
  g.fillStyle = 'rgba(232,207,143,.6)';
  g.font = '0.13px Limelight';
  g.textAlign = 'center';
  const letras = [...texto];
  letras.forEach((ch, i) => {
    const a = Math.PI * 1.25 - (i + 0.5) / letras.length * Math.PI;
    g.save();
    g.translate(cx + Math.cos(a) * r * 0.5, cy + Math.sin(a) * r * 0.5);
    g.rotate(a - Math.PI / 2);
    g.fillText(ch, 0, 0);
    g.restore();
  });
  g.restore();
  // rack de fichas junto à banca
  const rx0 = cx - 0.45 + dir[0] * 0.2, ry0 = cy - 0.45 + dir[1] * 0.2;
  caixa(g, rx0 + 0.1, ry0 + 0.4, z, 0.6, 0.24, 0.05, { topo: '#101010', esq: '#060606', dir: '#0b0b0b' });
  const cores = ['#b3192e', '#177a4c', '#17171b', '#5b2a86', '#ece2cc', '#d9a133'];
  for (let i = 0; i < 6; i++) caixa(g, rx0 + 0.13 + i * 0.095, ry0 + 0.43, z + 0.05, 0.08, 0.18, 0.04, { topo: cores[i], esq: cores[i], dir: cores[i] });
  for (let i = 0; i < 5; i++) {
    const a = Math.PI / 4 + (Math.PI * (i + 0.5)) / 5;
    banqueta(g, cx + Math.cos(a) * (r + 0.42), cy + Math.sin(a) * (r + 0.42));
  }
}

function mesaCraps(g, m) {
  const { x0, y0, x1, y1 } = m;
  const z = 0.96;
  crupie(g, (x0 + x1) / 2, y0 - 0.5, -1);
  crupie(g, (x0 + x1) / 2 + 1.1, y0 - 0.45, 1, '#1a2430');
  const r = (y1 - y0) / 2;
  const pts = [];
  for (let i = 0; i <= 16; i++) { const a = -Math.PI / 2 + Math.PI * (i / 16); pts.push([x1 - r + Math.cos(a) * r, y0 + r + Math.sin(a) * r]); }
  for (let i = 0; i <= 16; i++) { const a = Math.PI / 2 + Math.PI * (i / 16); pts.push([x0 + r + Math.cos(a) * r, y0 + r + Math.sin(a) * r]); }
  const topo = pts.map(([x, y]) => iso(x, y, z));
  const base = pts.map(([x, y]) => iso(x, y, 0.1));
  // lateral (só a metade da frente aparece, mas desenhar tudo por baixo resolve)
  g.beginPath();
  base.forEach(([x, y], i) => i ? g.lineTo(x, y) : g.moveTo(x, y));
  g.closePath();
  g.fillStyle = '#120a05'; g.fill();
  const frente = pts.map((p, i) => i).filter(i => pts[i][0] + pts[i][1] >= (x0 + x1) / 2 + (y0 + y1) / 2 - 0.6);
  g.beginPath();
  frente.forEach((i, k) => { const [x, y] = topo[i]; k ? g.lineTo(x, y) : g.moveTo(x, y); });
  for (let k = frente.length - 1; k >= 0; k--) { const [x, y] = base[frente[k]]; g.lineTo(x, y); }
  g.closePath();
  g.fillStyle = gradLado(g, iso(x0, y1)[0], iso(x1, y0)[0], '#1a0f07', '#50301a'); g.fill();
  // trilho de madeira e feltro rebaixado
  g.beginPath(); topo.forEach(([x, y], i) => i ? g.lineTo(x, y) : g.moveTo(x, y)); g.closePath();
  g.fillStyle = '#3a2210'; g.fill();
  const dentro = pts.map(([x, y]) => {
    const mx = (x0 + x1) / 2, my = (y0 + y1) / 2;
    return iso(mx + (x - mx) * 0.9, my + (y - my) * 0.82, z - 0.12);
  });
  g.beginPath(); dentro.forEach(([x, y], i) => i ? g.lineTo(x, y) : g.moveTo(x, y)); g.closePath();
  const [scx, scy] = iso((x0 + x1) / 2, (y0 + y1) / 2, z);
  g.fillStyle = feltroGrad(g, scx, scy, (x1 - x0) * RX * 0.5, '#15533f', '#082219'); g.fill();
  g.strokeStyle = 'rgba(201,164,92,.8)'; g.lineWidth = 1.4; g.stroke();
  // marcas do tabuleiro
  g.save(); planoH(g, z - 0.12);
  g.strokeStyle = 'rgba(243,234,215,.55)'; g.lineWidth = 0.018;
  const mx0 = x0 + 0.45, mx1 = x1 - 0.45;
  g.strokeRect(mx0, y0 + 0.3, (mx1 - mx0) * 0.38, y1 - y0 - 0.6);
  g.strokeRect(mx1 - (mx1 - mx0) * 0.38, y0 + 0.3, (mx1 - mx0) * 0.38, y1 - y0 - 0.6);
  g.fillStyle = 'rgba(179,25,46,.55)';
  g.fillRect((x0 + x1) / 2 - 0.3, y0 + 0.45, 0.6, y1 - y0 - 0.9);
  for (let k = 0; k < 6; k++) g.strokeRect(mx0 + k * 0.2, y0 + 0.36, 0.18, 0.3);
  g.restore();
  // dados
  for (const [dx, dy] of [[0.35, 0.55], [0.62, 0.72]]) caixa(g, x1 - 1.4 + dx, y0 + dy, z - 0.12, 0.12, 0.12, 0.12, { topo: '#f6efe0', esq: '#c9bfa8', dir: '#e0d6c0' });
  for (let i = 0; i < 4; i++) banqueta(g, x0 + 0.6 + i * 1.0, y1 + 0.6);
}

function mesaOval(g, m) {
  const { cx, cy, r } = m;
  const z = 0.92;
  crupie(g, cx - 0.9, cy - 0.9, 1, '#2a0a12');
  cilindro(g, cx, cy, 0, 0.35, z - 0.2, { lado: '#140b06', topo: '#140b06' });
  const [sx, sy] = iso(cx, cy, z);
  const rx = r * RX * 1.12, ry = r * RY;
  // lateral e tampo como elipse alongada
  g.beginPath();
  g.ellipse(sx, sy + 9, rx, ry, 0, 0, Math.PI); g.lineTo(sx - rx, sy); g.ellipse(sx, sy, rx, ry, 0, Math.PI, 0, true); g.closePath();
  g.fillStyle = gradLado(g, sx - rx, sx + rx, '#1a0f07', '#4a2c16'); g.fill();
  g.beginPath(); g.ellipse(sx, sy, rx, ry, 0, 0, Math.PI * 2);
  g.fillStyle = '#2a140a'; g.fill();
  g.beginPath(); g.ellipse(sx, sy, rx - 9, ry - 5, 0, 0, Math.PI * 2);
  g.fillStyle = feltroGrad(g, sx, sy, rx, '#6a1a2c', '#300a13'); g.fill();
  g.strokeStyle = 'rgba(201,164,92,.8)'; g.lineWidth = 1.2; g.stroke();
  // áreas BANCA / JOGADOR
  g.strokeStyle = 'rgba(232,207,143,.6)'; g.lineWidth = 1;
  g.beginPath(); g.ellipse(sx, sy + 6, rx * 0.62, ry * 0.5, 0, 0, Math.PI); g.stroke();
  g.beginPath(); g.ellipse(sx, sy + 6, rx * 0.4, ry * 0.3, 0, 0, Math.PI); g.stroke();
  g.fillStyle = 'rgba(232,207,143,.7)';
  g.font = '12px Limelight'; g.textAlign = 'center';
  g.fillText('BACARÁ', sx, sy - ry * 0.25);
  for (let i = 0; i < 4; i++) {
    const a = 0.35 + i * 0.8;
    const bx = cx + Math.cos(a) * (r + 0.55) * 1.1, by = cy + Math.sin(a) * (r + 0.55);
    banqueta(g, bx, by, '#5a1a2a');
  }
}

function caixaDoCassino(g, m) {
  const { x0, y0, x1, y1 } = m;
  const h = 2.4;
  caixa(g, x0, y0, 0, x1 - x0, y1 - y0, 1.05, { topo: '#2a170c', esq: '#1c1008', dir: '#26160b' });
  // grade de latão na frente (face x1)
  g.save();
  g.strokeStyle = LATAO; g.lineWidth = 1.6;
  for (let t = 0.05; t < 0.97; t += 0.07) {
    const y = y0 + (y1 - y0) * t;
    const [ax, ay] = iso(x1, y, 1.05), [bx, by] = iso(x1, y, h - 0.3);
    g.beginPath(); g.moveTo(ax, ay); g.lineTo(bx, by); g.stroke();
  }
  g.restore();
  caixa(g, x0, y0, h - 0.3, x1 - x0, y1 - y0, 0.3, { topo: '#1a0a0e', esq: '#12060a', dir: LATAO_ESCURO });
  // janela iluminada e o livro no balcão
  caminho(g, [[x1, y0 + 0.5, 1.2], [x1, y1 - 0.5, 1.2], [x1, y1 - 0.5, 1.8], [x1, y0 + 0.5, 1.8]]);
  g.fillStyle = 'rgba(255,214,150,.22)'; g.fill();
  caixa(g, x1 - 0.1, y0 + 0.8, 1.05, 0.35, 0.55, 0.06, { topo: '#e8dcc0', esq: '#5a1422', dir: '#7a2a34' });
  const [lx, ly] = iso(x1 + 0.08, (y0 + y1) / 2 + 0.05, 1.12);
  g.strokeStyle = 'rgba(90,20,34,.8)'; g.lineWidth = 1;
  g.beginPath(); g.moveTo(lx - 6, ly - 2); g.lineTo(lx + 8, ly + 5); g.stroke();
}

function caçaNiquel(g, m, i) {
  const { x, y } = m;
  const w = 0.82, d = 0.9;
  caixa(g, x, y, 0, w, d, 0.95, { topo: '#1b0a10', esq: '#12060b', dir: '#2a0d17', linha: 'rgba(201,164,92,.25)' });
  caixa(g, x, y, 0.95, w * 0.85, d, 1.25, { topo: '#1b0a10', esq: '#170810', dir: '#2e0e19', linha: 'rgba(201,164,92,.3)' });
  // bandeja e botões
  caixa(g, x + w * 0.85, y + 0.08, 0.92, 0.22, d - 0.16, 0.06, { topo: '#2a1a12', esq: '#1a0e08', dir: LATAO_ESCURO });
  // arco déco no topo
  const [ax, ay] = iso(x + w * 0.85, y + d / 2, 2.2);
  g.fillStyle = '#240b14';
  g.beginPath(); g.ellipse(ax + 6, ay - 2, 40, 30, -0.46, Math.PI * 1.02, Math.PI * 1.98); g.closePath(); g.fill();
  g.strokeStyle = i % 2 ? '#ff3d6e' : '#35f0d8'; g.lineWidth = 1.6; g.globalAlpha = 0.5;
  g.beginPath(); g.ellipse(ax + 6, ay - 2, 36, 26, -0.46, Math.PI * 1.05, Math.PI * 1.95); g.stroke();
  g.globalAlpha = 1;
  // moldura da tela (a tela em si é dinâmica)
  caminho(g, [[x + w * 0.85, y + 0.1, 1.2], [x + w * 0.85, y + d - 0.1, 1.2], [x + w * 0.85, y + d - 0.1, 1.95], [x + w * 0.85, y + 0.1, 1.95]]);
  g.fillStyle = '#050304'; g.fill();
  g.strokeStyle = LATAO; g.lineWidth = 1.4; g.stroke();
  banqueta(g, x + w + 0.55, y + d / 2, '#6a1426');
}

function bar(g, m) {
  const { x0, x1 } = m;
  // prateleiras na parede com garrafas
  g.save();
  planoParede(g, 'direita', 0, 0, 0);
  const u0 = x0 * LX, u1 = x1 * LX;
  // espelho fumê atrás do bar, com a luz quente de baixo
  const gr = g.createLinearGradient(0, -3.9 * LZ, 0, -1.3 * LZ);
  gr.addColorStop(0, 'rgba(255,200,130,.0)'); gr.addColorStop(1, 'rgba(255,190,120,.16)');
  g.fillStyle = '#0b0608';
  g.fillRect(u0, -3.9 * LZ, u1 - u0, 2.6 * LZ);
  g.fillStyle = gr;
  g.fillRect(u0, -3.9 * LZ, u1 - u0, 2.6 * LZ);
  g.strokeStyle = 'rgba(255,240,220,.05)'; g.lineWidth = 14;
  for (let u = u0 + 40; u < u1; u += 150) { g.beginPath(); g.moveTo(u, -1.3 * LZ); g.lineTo(u + 60, -3.9 * LZ); g.stroke(); }
  // três seções separadas por colunas de latão
  const secoes = 4;
  const larg = (u1 - u0) / secoes;
  const r = aleatorioSemeado(77);
  const CORES = [['#7a4a14', '#c98a3a'], ['#1f4a2a', '#4f9a5a'], ['#6a1420', '#c04050'], ['#2a2a3a', '#8a8aa8'], ['#9a7a2a', '#e8cf8f']];
  // as garrafas ficam dentro do espelho: o letreiro logo acima não pode ser coberto
  g.save();
  g.beginPath(); g.rect(u0, -3.9 * LZ, u1 - u0, 2.6 * LZ); g.clip();
  for (const prat of [-1.65, -2.45, -3.2]) {
    g.fillStyle = LATAO; g.fillRect(u0 + 6, prat * LZ, u1 - u0 - 12, 2.5);
    g.fillStyle = 'rgba(255,214,150,.10)'; g.fillRect(u0 + 6, prat * LZ + 2.5, u1 - u0 - 12, 10);
    for (let s = 0; s < secoes; s++) {
      let u = u0 + s * larg + 18 + r() * 10;
      const fim = u0 + (s + 1) * larg - 16;
      while (u < fim) {
        const alto = 18 + r() * 10, w = 8 + r() * 3, pescoco = 7 + r() * 4;
        const [escura, clara] = CORES[Math.floor(r() * CORES.length)];
        const base = prat * LZ;
        const gb = g.createLinearGradient(u, 0, u + w, 0);
        gb.addColorStop(0, escura); gb.addColorStop(0.35, clara); gb.addColorStop(1, escura);
        g.fillStyle = gb;
        g.globalAlpha = 0.9;
        g.beginPath();
        g.moveTo(u, base); g.lineTo(u, base - alto); g.quadraticCurveTo(u, base - alto - 5, u + w * 0.35, base - alto - 6);
        g.lineTo(u + w * 0.35, base - alto - pescoco); g.lineTo(u + w * 0.65, base - alto - pescoco); g.lineTo(u + w * 0.65, base - alto - 6);
        g.quadraticCurveTo(u + w, base - alto - 5, u + w, base - alto); g.lineTo(u + w, base); g.closePath(); g.fill();
        g.globalAlpha = 0.55; g.fillStyle = '#f3ead7';
        g.fillRect(u + 1.5, base - alto * 0.62, w - 3, alto * 0.28);
        g.globalAlpha = 0.35; g.fillStyle = '#fff5e0';
        g.fillRect(u + w * 0.22, base - alto + 2, 1.2, alto - 4);
        g.globalAlpha = 1;
        u += w + 3 + r() * 6;
      }
    }
  }
  g.restore();
  for (let s = 0; s <= secoes; s++) {
    const u = u0 + s * larg;
    g.fillStyle = '#1a0a0e'; g.fillRect(u - 5, -3.9 * LZ, 10, 2.6 * LZ);
    g.fillStyle = LATAO; g.fillRect(u - 5, -3.9 * LZ, 1.2, 2.6 * LZ); g.fillRect(u + 3.8, -3.9 * LZ, 1.2, 2.6 * LZ);
  }
  g.strokeStyle = LATAO; g.lineWidth = 2;
  g.strokeRect(u0, -3.9 * LZ, u1 - u0, 2.6 * LZ);
  // letreiro pequeno do bar, numa placa escura com friso de latão, acima do espelho
  g.font = '22px Limelight'; g.textAlign = 'center';
  const texto = 'BAR DO VÍDEO PÔQUER', cx = (u0 + u1) / 2;
  const lp = g.measureText(texto).width + 36, topoPlaca = -4.72 * LZ, altPlaca = 0.62 * LZ;
  g.fillStyle = '#0d0709'; g.fillRect(cx - lp / 2, topoPlaca, lp, altPlaca);
  g.strokeStyle = LATAO; g.lineWidth = 1.5; g.strokeRect(cx - lp / 2 + 3, topoPlaca + 3, lp - 6, altPlaca - 6);
  g.fillStyle = 'rgba(232,207,143,.92)';
  g.fillText(texto, cx, topoPlaca + altPlaca / 2 + 8);
  g.restore();
  // balcão
  caixa(g, x0, 0.15, 0, x1 - x0, 0.75, 1.05, { topo: '#1a0e08', esq: '#2e1a0e', dir: '#24140a', linha: 'rgba(0,0,0,.4)' });
  caminho(g, [[x0, 0.9, 0.12], [x1, 0.9, 0.12], [x1, 0.9, 0.18], [x0, 0.9, 0.18]]);
  g.fillStyle = LATAO; g.fill();
  caixa(g, x0 - 0.05, 0.1, 1.05, x1 - x0 + 0.1, 0.9, 0.07, { topo: '#3b2414', esq: LATAO_ESCURO, dir: '#4a2c16' });
  // painéis na frente do balcão
  for (let x = x0 + 0.3; x < x1 - 0.4; x += 1.2) {
    caminho(g, [[x, 0.9, 0.3], [x + 0.9, 0.9, 0.3], [x + 0.9, 0.9, 0.9], [x, 0.9, 0.9]]);
    g.strokeStyle = 'rgba(201,164,92,.35)'; g.lineWidth = 1; g.stroke();
  }
  // máquinas de vídeo pôquer em cima do balcão
  for (const mx of m.maquinas) {
    caixa(g, mx - 0.28, 0.25, 1.12, 0.56, 0.5, 0.42, { topo: '#141018', esq: '#1e1824', dir: '#0e0a12', linha: 'rgba(201,164,92,.35)' });
  }
  for (const mx of m.maquinas) banqueta(g, mx, 1.75, '#1f3a5a');
}

// ------------------------------------------------------------------ montagem

export function criarCena() {
  const roleta = { id: 'roleta', x0: 3.0, y0: 3.8, x1: 7.2, y1: 5.5, roda: { rx: 3.72, ry: 4.62 } };
  const blackjack = { id: 'blackjack', cx: 11.2, cy: 3.9, r: 1.55 };
  const bacara = { id: 'bacara', cx: 5.2, cy: 8.7, r: 1.2 };
  const craps = { id: 'craps', x0: 11.0, y0: 6.9, x1: 15.6, y1: 8.6 };
  const caixaM = { id: 'caixa', x0: 0.15, y0: 0.35, x1: 1.2, y1: 2.7 };
  const maquinas = [3.6, 4.75, 5.9, 7.05, 8.2].map((y, i) => ({ x: 0.12, y, i }));
  const barM = { id: 'videopoquer', x0: 9.4, x1: 16.8, maquinas: [10.1, 11.3, 12.5, 13.7, 14.9, 16.1] };

  const objetos = [];
  const add = (o) => { objetos.push(o); return o; };

  add({ id: 'caixa', prof: 1.5, desenhar: g => caixaDoCassino(g, caixaM),
    pontos: [[caixaM.x0, caixaM.y0, 0], [caixaM.x1, caixaM.y1, 0], [caixaM.x1, caixaM.y0, 0], [caixaM.x0, caixaM.y1, 0], [caixaM.x1, caixaM.y0, 2.4], [caixaM.x1, caixaM.y1, 2.4], [caixaM.x0, caixaM.y0, 2.4]],
    ancora: [caixaM.x1, (caixaM.y0 + caixaM.y1) / 2, 2.5] });
  for (const mq of maquinas) add({ id: 'niquel', prof: mq.x + mq.y + 0.5, desenhar: g => caçaNiquel(g, mq, mq.i),
    pontos: [[mq.x, mq.y, 0], [mq.x + 1.05, mq.y, 0], [mq.x + 1.05, mq.y + 0.9, 0], [mq.x, mq.y + 0.9, 0], [mq.x, mq.y, 2.5], [mq.x + 0.8, mq.y + 0.9, 2.5], [mq.x + 0.8, mq.y, 2.5]],
    ancora: [0.6, 5.9, 2.7], grupo: true });
  add({ id: 'videopoquer', prof: 9, desenhar: g => bar(g, barM),
    pontos: [[barM.x0, 0.1, 0], [barM.x1, 0.1, 0], [barM.x1, 0.95, 0], [barM.x0, 0.95, 0], [barM.x0, 0.1, 1.6], [barM.x1, 0.1, 1.6], [barM.x1, 0.95, 1.6], [barM.x0, 0.95, 1.6]],
    ancora: [13.1, 0.55, 1.9] });
  add({ id: 'roleta', prof: (roleta.x0 + roleta.x1 + roleta.y0 + roleta.y1) / 2, desenhar: g => mesaRoleta(g, roleta),
    pontos: [[roleta.x0, roleta.y0, 0], [roleta.x1, roleta.y0, 0], [roleta.x1, roleta.y1, 0], [roleta.x0, roleta.y1, 0], [roleta.x0, roleta.y0, 1.1], [roleta.x1, roleta.y0, 1.1], [roleta.x1, roleta.y1, 1.1], [roleta.x0, roleta.y1, 1.1]],
    ancora: [5.1, 4.65, 1.3] });
  add({ id: 'blackjack', prof: blackjack.cx + blackjack.cy, desenhar: g => mesaMeiaLua(g, blackjack),
    pontos: circuloPontos(blackjack.cx, blackjack.cy, blackjack.r + 0.2, 1.1), ancora: [blackjack.cx, blackjack.cy, 1.3] });
  add({ id: 'bacara', prof: bacara.cx + bacara.cy, desenhar: g => mesaOval(g, bacara),
    pontos: circuloPontos(bacara.cx, bacara.cy, bacara.r * 1.25 + 0.2, 1.1), ancora: [bacara.cx, bacara.cy, 1.3] });
  add({ id: 'craps', prof: (craps.x0 + craps.x1 + craps.y0 + craps.y1) / 2, desenhar: g => mesaCraps(g, craps),
    pontos: [[craps.x0, craps.y0, 0], [craps.x1, craps.y0, 0], [craps.x1, craps.y1, 0], [craps.x0, craps.y1, 0], [craps.x0, craps.y0, 1.1], [craps.x1, craps.y0, 1.1], [craps.x1, craps.y1, 1.1], [craps.x0, craps.y1, 1.1]],
    ancora: [(craps.x0 + craps.x1) / 2, (craps.y0 + craps.y1) / 2, 1.3] });
  // decoração, sem clique
  for (const [x, y] of [[8.6, 1.2], [17.2, 1.4], [1.2, 10.2], [17.1, 10.1], [8.9, 10.3]]) add({ prof: x + y, desenhar: g => palmeira(g, x, y) });
  const postes = [[7.8, 10.6], [9.2, 10.6], [10.6, 10.6]];
  add({ prof: 21.2, desenhar: g => { for (let i = 0; i < postes.length - 1; i++) corda(g, postes[i], postes[i + 1]); for (const [x, y] of postes) poste(g, x, y); } });

  objetos.sort((a, b) => a.prof - b.prof);

  // cascos clicáveis em coordenadas de tela do mundo
  const clicaveis = {};
  for (const o of objetos) {
    if (!o.id) continue;
    const pts = o.pontos.map(([x, y, z]) => iso(x, y, z));
    (clicaveis[o.id] ??= { id: o.id, poligonos: [], ancora: iso(...o.ancora) }).poligonos.push(envoltoria(pts));
  }

  const lampadas = [
    { x: 5.1, y: 4.65, z: 3.4, alvo: 0.92, r: 1.8, mesa: 'roleta' },
    { x: blackjack.cx, y: blackjack.cy, z: 3.4, alvo: 0.92, r: 1.6, mesa: 'blackjack' },
    { x: bacara.cx, y: bacara.cy, z: 3.4, alvo: 0.92, r: 1.5, mesa: 'bacara' },
    { x: 13.3, y: 7.75, z: 3.4, alvo: 0.9, r: 1.9, mesa: 'craps' },
  ];
  const arandelas = [];
  for (let u = 3; u <= MUNDO.X; u += 3) arandelas.push({ parede: 'direita', u });
  for (let u = 3; u <= MUNDO.Y; u += 3) arandelas.push({ parede: 'esquerda', u });

  return { objetos, clicaveis, lampadas, arandelas, roleta, blackjack, bacara, craps, maquinas, bar: barM, caixa: caixaM };
}

function circuloPontos(cx, cy, r, h) {
  const p = [];
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * Math.PI * 2;
    p.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r, 0], [cx + Math.cos(a) * r, cy + Math.sin(a) * r, h]);
  }
  return p;
}

// ------------------------------------------------------------------ estático

export function desenharEstatico(g, cena) {
  piso(g);
  parede(g, 'direita');
  parede(g, 'esquerda');
  // quina das paredes
  const [qx, qy] = iso(0, 0, 0), [, qt] = iso(0, 0, MUNDO.H);
  g.fillStyle = LATAO; g.fillRect(qx - 1, qt + 29, 2, qy - qt - 29);
  for (const a of cena.arandelas) arandela(g, a.parede, a.u);
  letreiroApagado(g);
  relogioSemPonteiros(g);
  for (const o of cena.objetos) o.desenhar(g);
  // penumbra das bordas do mundo: o salão acaba no escuro
  const { x0, y0, x1, y1 } = LIMITES;
  const [fx, fy] = iso(MUNDO.X, MUNDO.Y, 0);
  const v = g.createRadialGradient(iso(9, 5.5)[0], iso(9, 5.5)[1] - 120, 200, iso(9, 5.5)[0], iso(9, 5.5)[1], (x1 - x0) * 0.62);
  v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(0.7, 'rgba(0,0,0,.35)'); v.addColorStop(1, 'rgba(0,0,0,.85)');
  g.fillStyle = v; g.fillRect(x0, y0, x1 - x0, y1 - y0);
  void fx; void fy;
}

// ------------------------------------------------------------------ neon

function letreiroApagado(g) {
  g.save();
  planoParede(g, 'direita', 0, 0, 0);
  g.font = '92px Limelight';
  g.textBaseline = 'alphabetic';
  g.strokeStyle = 'rgba(255,61,110,.18)';
  g.lineWidth = 3;
  g.strokeText('BANCA', 1.3 * LX, -2.55 * LZ);
  g.font = '300 25px Jost';
  g.strokeStyle = 'rgba(53,240,216,.15)';
  g.lineWidth = 1.5;
  g.strokeText('a casa sempre ganha', 1.42 * LX, -1.75 * LZ);
  g.restore();
  g.save();
  planoParede(g, 'esquerda', 0, MUNDO.Y, 0);
  g.font = '40px Limelight';
  g.strokeStyle = 'rgba(232,207,143,.2)'; g.lineWidth = 1.5;
  g.strokeText('CAIXA', (MUNDO.Y - 2.35) * LX, -2.72 * LZ);
  g.font = '34px Limelight';
  g.strokeText('MALECÓN 57', (MUNDO.Y - 8.7) * LX, -2.85 * LZ);
  g.restore();
}

function relogioSemPonteiros(g) {
  g.save();
  planoParede(g, 'direita', 0, 0, 0);
  const x = 8.1 * LX, y = -3.1 * LZ;
  g.fillStyle = '#12060a';
  g.beginPath(); g.arc(x, y, 26, 0, Math.PI * 2); g.fill();
  g.strokeStyle = LATAO; g.lineWidth = 2.5; g.stroke();
  g.lineWidth = 1.4;
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    g.beginPath(); g.moveTo(x + Math.cos(a) * 18, y + Math.sin(a) * 18); g.lineTo(x + Math.cos(a) * 23, y + Math.sin(a) * 23); g.stroke();
  }
  g.fillStyle = LATAO; g.beginPath(); g.arc(x, y, 2, 0, Math.PI * 2); g.fill();
  g.font = '500 8px Jost'; g.textAlign = 'center'; g.fillStyle = 'rgba(232,207,143,.7)';
  g.fillText('SEM PONTEIROS, COMO', x, y + 40);
  g.fillText('EM TODO CASSINO', x, y + 50);
  g.restore();
}

// Letreiro aceso num canvas próprio, com brilho, desenhado uma vez; por
// quadro ele só é copiado com a intensidade do tremor.
export function criarNeons(escala) {
  const itens = [];
  function neon(parede, x, y, z, texto, fonte, cor, largura, tremor) {
    const [sx, sy] = parede === 'direita' ? iso(x, y, z) : iso(x, y, z);
    const pad = 60;
    const medir = tela(8, 8).getContext('2d');
    medir.font = fonte;
    const w = medir.measureText(texto).width + pad * 2;
    const alto = parseInt(fonte.match(/(\d+)px/)[1], 10);
    const h = alto * 1.6 + pad * 2 + w * 0.5;
    const c = tela(Math.ceil(w * escala), Math.ceil(h * escala));
    const g = c.getContext('2d');
    g.scale(escala, escala);
    const ox = pad, oy = pad + (parede === 'direita' ? alto * 1.1 : alto * 1.1 + w * 0.5 - pad);
    if (parede === 'direita') g.transform(1, 0.5, 0, 1, ox, oy);
    else g.transform(1, -0.5, 0, 1, ox, oy);
    g.font = fonte;
    g.lineJoin = 'round';
    for (const [lw, blur, alpha, c2] of [[largura * 5, 26, 0.35, cor], [largura * 2.4, 12, 0.7, cor], [largura, 3, 1, '#fff5f8']]) {
      g.shadowColor = cor; g.shadowBlur = blur * escala;
      g.strokeStyle = c2; g.globalAlpha = alpha; g.lineWidth = lw;
      g.strokeText(texto, 0, 0);
    }
    itens.push({ c, sx: sx - ox, sy: sy - oy, w, h, tremor, fase: Math.random() * 10 });
  }
  neon('direita', 1.3, 0, 2.55, 'BANCA', '92px Limelight', '#ff3d6e', 2.6, 0.5);
  neon('direita', 1.42, 0, 1.75, 'a casa sempre ganha', '300 25px Jost', '#35f0d8', 1.4, 1.4);
  neon('esquerda', 0, 2.35, 2.72, 'CAIXA', '40px Limelight', '#e8cf8f', 1.3, 0);
  neon('esquerda', 0, 8.7, 2.85, 'MALECÓN 57', '34px Limelight', '#35f0d8', 1.3, 0.9);
  return itens;
}

// Tremor de neon: quase sempre aceso, às vezes pisca uma letra de gás cansado.
export function brilhoNeon(n, t) {
  if (!n.tremor) return 0.92 + 0.05 * Math.sin(t * 2.1 + n.fase);
  const f = Math.sin(t * 13 + n.fase) * Math.sin(t * 3.7 + n.fase * 2);
  const falha = (Math.sin(t * 0.7 + n.fase) > 0.985 - 0.01 * n.tremor) ? (Math.random() < 0.5 ? 0.25 : 0.8) : 1;
  return (0.88 + 0.08 * f) * falha;
}

// ------------------------------------------------------------------ dinâmico

export function criarLuzes(escala) {
  // cone de luz do abajur: trapézio com gradiente vertical, pré-rasterizado
  function cone(r) {
    const w = r * RX * 2 + 40, h = 3.4 * LZ;
    const c = tela(Math.ceil(w * escala), Math.ceil(h * escala));
    const g = c.getContext('2d');
    g.scale(escala, escala);
    const gr = g.createLinearGradient(0, 0, 0, h);
    gr.addColorStop(0, 'rgba(255,214,150,.30)');
    gr.addColorStop(0.6, 'rgba(255,200,130,.10)');
    gr.addColorStop(1, 'rgba(255,190,120,.03)');
    g.fillStyle = gr;
    g.beginPath(); g.moveTo(w / 2 - 22, 0); g.lineTo(w / 2 + 22, 0); g.lineTo(w - 10, h); g.lineTo(10, h); g.closePath(); g.fill();
    return { c, w, h };
  }
  function poca(rx, ry) {
    const c = tela(Math.ceil(rx * 2 * escala), Math.ceil(ry * 2 * escala));
    const g = c.getContext('2d');
    g.scale(escala, escala);
    g.translate(rx, ry); g.scale(1, ry / rx);
    const gr = g.createRadialGradient(0, 0, 0, 0, 0, rx);
    gr.addColorStop(0, 'rgba(255,220,160,.55)'); gr.addColorStop(0.5, 'rgba(255,200,130,.18)'); gr.addColorStop(1, 'rgba(255,190,120,0)');
    g.fillStyle = gr; g.beginPath(); g.arc(0, 0, rx, 0, Math.PI * 2); g.fill();
    return { c, rx, ry };
  }
  function fumaca() {
    const r = 120;
    const c = tela(Math.ceil(r * 2 * escala), Math.ceil(r * 2 * escala));
    const g = c.getContext('2d');
    g.scale(escala, escala);
    const gr = g.createRadialGradient(r, r, 0, r, r, r);
    gr.addColorStop(0, 'rgba(220,200,180,.10)'); gr.addColorStop(0.6, 'rgba(200,180,160,.04)'); gr.addColorStop(1, 'rgba(200,180,160,0)');
    g.fillStyle = gr; g.fillRect(0, 0, r * 2, r * 2);
    return { c, r };
  }
  function brilho(r, cor) {
    const c = tela(Math.ceil(r * 2 * escala), Math.ceil(r * 2 * escala));
    const g = c.getContext('2d');
    g.scale(escala, escala);
    const gr = g.createRadialGradient(r, r, 0, r, r, r);
    gr.addColorStop(0, cor); gr.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = gr; g.fillRect(0, 0, r * 2, r * 2);
    return { c, r };
  }
  return { cone, poca, fumaca: fumaca(), brilhoQuente: brilho(80, 'rgba(255,200,130,.35)'), brilhoRosa: brilho(70, 'rgba(255,61,110,.35)'), brilhoCiano: brilho(70, 'rgba(53,240,216,.3)') };
}

export function desenharAbajur(g, l) {
  const [sx, sy] = iso(l.x, l.y, l.z);
  g.strokeStyle = 'rgba(201,164,92,.55)'; g.lineWidth = 1.2;
  g.beginPath(); g.moveTo(sx, sy - 18); g.lineTo(sx, LIMITES.y0 - 10); g.stroke();
  // cúpula de latão em degraus
  g.fillStyle = '#6e5226';
  g.beginPath(); g.moveTo(sx - 26, sy); g.lineTo(sx - 14, sy - 16); g.lineTo(sx + 14, sy - 16); g.lineTo(sx + 26, sy); g.closePath(); g.fill();
  const gr = g.createLinearGradient(sx - 26, 0, sx + 26, 0);
  gr.addColorStop(0, '#5a4220'); gr.addColorStop(0.55, '#e8cf8f'); gr.addColorStop(1, '#6e5226');
  g.fillStyle = gr;
  g.beginPath(); g.moveTo(sx - 26, sy); g.lineTo(sx - 18, sy - 11); g.lineTo(sx + 18, sy - 11); g.lineTo(sx + 26, sy); g.closePath(); g.fill();
  g.fillStyle = '#fff1d0';
  g.beginPath(); g.ellipse(sx, sy, 24, 5, 0, 0, Math.PI * 2); g.fill();
  g.fillStyle = LATAO; g.fillRect(sx - 4, sy - 22, 8, 7);
}

// Rotor da roleta do salão, girando devagar: 37 casas numa elipse.
export function desenharRotor(g, roda, z, angulo) {
  const [sx, sy] = iso(roda.rx, roda.ry, z);
  const rx = 0.46 * RX, ry = 0.46 * RY;
  for (let i = 0; i < 37; i++) {
    const a0 = angulo + (i / 37) * Math.PI * 2, a1 = angulo + ((i + 1) / 37) * Math.PI * 2;
    const n = ROLETA[i];
    g.fillStyle = n === 0 ? '#1f7a4c' : VERMELHOS.has(n) ? '#a11a2c' : '#0f0d10';
    g.beginPath();
    g.moveTo(sx + Math.cos(a0) * rx * 0.55, sy + Math.sin(a0) * ry * 0.55);
    g.lineTo(sx + Math.cos(a0) * rx, sy + Math.sin(a0) * ry);
    g.lineTo(sx + Math.cos(a1) * rx, sy + Math.sin(a1) * ry);
    g.lineTo(sx + Math.cos(a1) * rx * 0.55, sy + Math.sin(a1) * ry * 0.55);
    g.closePath(); g.fill();
  }
  g.fillStyle = '#3b2414';
  g.beginPath(); g.ellipse(sx, sy, rx * 0.55, ry * 0.55, 0, 0, Math.PI * 2); g.fill();
  g.strokeStyle = LATAO; g.lineWidth = 1.5;
  for (let k = 0; k < 4; k++) {
    const a = angulo * 1 + (k / 4) * Math.PI * 2;
    g.beginPath(); g.moveTo(sx, sy - 5); g.lineTo(sx + Math.cos(a) * rx * 0.4, sy + Math.sin(a) * ry * 0.4 - 3); g.stroke();
  }
  g.fillStyle = LATAO_CLARO;
  g.beginPath(); g.ellipse(sx, sy - 5, 4, 3, 0, 0, Math.PI * 2); g.fill();
}

// Tela de um caça-níquel do salão: três faixas de símbolos correndo.
export function desenharTelaNiquel(g, mq, t, ativa) {
  const x = mq.x + 0.82 * 0.85, y0 = mq.y + 0.1, y1 = mq.y + 0.9 - 0.1;
  g.save();
  caminho(g, [[x, y0, 1.2], [x, y1, 1.2], [x, y1, 1.95], [x, y0, 1.95]]);
  g.clip();
  const [ax, ay] = iso(x, y1, 1.95);
  const cores = ['#ff3d6e', '#35f0d8', '#e8cf8f', '#c98a1a', '#8a2236'];
  const gr = g.createLinearGradient(ax, ay, ax, ay + 60);
  gr.addColorStop(0, '#1a0f24'); gr.addColorStop(1, '#0a0610');
  g.fillStyle = gr; g.fillRect(ax - 5, ay - 40, 80, 120);
  for (let col = 0; col < 3; col++) {
    const yy = y1 - 0.08 - col * 0.23;
    for (let k = -1; k < 4; k++) {
      const desl = ativa ? ((t * (2.2 + col * 0.4)) % 1) : 0;
      const z = 1.28 + (k + desl) * 0.2;
      const [px, py] = iso(x, yy, z);
      const i = (k + col * 3 + mq.i * 2 + Math.floor(ativa ? t * (2.2 + col * 0.4) : 0)) % cores.length;
      g.fillStyle = cores[(i + cores.length) % cores.length];
      g.globalAlpha = 0.85;
      g.beginPath(); g.ellipse(px, py, 5, 4, -0.46, 0, Math.PI * 2); g.fill();
    }
  }
  g.globalAlpha = 1;
  g.restore();
}

export function desenharTelaPoquer(g, mx, t, i) {
  const [sx, sy] = iso(mx - 0.22, 0.75, 1.5);
  g.save();
  g.transform(1, -0.5, 0, 1, sx, sy);
  const gr = g.createLinearGradient(0, 0, 0, 20);
  gr.addColorStop(0, '#0f2a6a'); gr.addColorStop(1, '#081640');
  g.fillStyle = gr;
  g.fillRect(0, 0, 30, 18);
  for (let k = 0; k < 5; k++) {
    g.fillStyle = (Math.floor(t * 0.6 + i + k * 0.3) % 7 === k) ? '#fff5d8' : '#e8e2d2';
    g.fillRect(2 + k * 5.4, 4, 4.4, 7);
  }
  g.fillStyle = '#e8cf8f';
  g.fillRect(2, 13.5, 26, 1.4);
  g.restore();
}
