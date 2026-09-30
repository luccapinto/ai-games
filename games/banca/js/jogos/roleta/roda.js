// Desenho da roda em canvas, vista inclinada: cuba de madeira, trilho,
// cone com oito defletores de latão, rotor com os números e os bolsos, e a
// torre no meio. O rotor é rasterizado uma vez de cima e girado por quadro;
// a cuba é estática. A bola é posicionada pela trajetória da física.

import { ORDEM_RODA, VERMELHOS } from './regras.js';
import { PASSO, RAIO, DEFLETORES } from './fisica.js';
import { tela, aleatorioSemeado } from '../../visual/texturas.js';

export const INCLINACAO = 0.5;               // elipse: altura / largura
const COS = Math.sqrt(1 - INCLINACAO * INCLINACAO);
export const VIS = { borda: 1.0, trilho: 0.955, cone: 0.905, rotor: 0.80, numerosIn: 0.665, bolsoIn: 0.52, torre: 0.2 };

// Raio da física para raio de desenho: o defletor fica no meio do cone e o
// bolso no meio do anel de bolsos.
export function raioVisual(r) {
  if (r >= RAIO.defletor) return VIS.trilho + (r - RAIO.trilho) / (RAIO.defletor - RAIO.trilho) * (0.86 - VIS.trilho);
  return 0.86 + (r - RAIO.defletor) / (RAIO.bolso - RAIO.defletor) * (0.592 - 0.86);
}

// Profundidade da cuba em cada raio (fração do raio): o trilho é a borda,
// o cone desce, o rotor fica mais fundo.
export function profundidade(rv) {
  if (rv >= VIS.cone) return 0;
  if (rv >= VIS.rotor) return (VIS.cone - rv) / (VIS.cone - VIS.rotor) * 0.06;
  if (rv >= VIS.numerosIn) return 0.06 + (VIS.rotor - rv) / (VIS.rotor - VIS.numerosIn) * 0.015;
  return 0.09;
}

function corNumero(n) {
  return n === 0 ? '#16804f' : VERMELHOS.has(n) ? '#a8182b' : '#121115';
}

// Rotor visto de cima, em um canvas quadrado de lado 2R.
function rasterizarRotor(R) {
  const c = tela(Math.ceil(R * 2), Math.ceil(R * 2));
  const g = c.getContext('2d');
  g.translate(R, R);
  // anel dos números
  for (let i = 0; i < 37; i++) {
    const a0 = i * PASSO, a1 = (i + 1) * PASSO;
    g.beginPath();
    g.arc(0, 0, R * VIS.rotor, a0, a1);
    g.arc(0, 0, R * VIS.numerosIn, a1, a0, true);
    g.closePath();
    g.fillStyle = corNumero(ORDEM_RODA[i]);
    g.fill();
  }
  // brilho do verniz sobre o anel
  const verniz = g.createRadialGradient(-R * 0.25, -R * 0.35, R * 0.1, 0, 0, R * VIS.rotor);
  verniz.addColorStop(0, 'rgba(255,255,255,.16)'); verniz.addColorStop(0.7, 'rgba(255,255,255,.03)'); verniz.addColorStop(1, 'rgba(0,0,0,.25)');
  g.beginPath(); g.arc(0, 0, R * VIS.rotor, 0, Math.PI * 2); g.arc(0, 0, R * VIS.numerosIn, 0, Math.PI * 2, true);
  g.fillStyle = verniz; g.fill('evenodd');
  // números em marfim, de pé para fora
  g.fillStyle = '#f6eedc';
  g.font = `600 ${Math.round(R * 0.078)}px Jost, sans-serif`;
  g.textAlign = 'center'; g.textBaseline = 'middle';
  for (let i = 0; i < 37; i++) {
    const a = (i + 0.5) * PASSO;
    g.save();
    g.rotate(a);
    g.translate(R * (VIS.rotor + VIS.numerosIn) / 2, 0);
    g.rotate(Math.PI / 2);
    g.fillText(String(ORDEM_RODA[i]), 0, 0);
    g.restore();
  }
  // bolsos: fundo escuro com a cor do número, trastes de latão
  for (let i = 0; i < 37; i++) {
    const a0 = i * PASSO, a1 = (i + 1) * PASSO;
    g.beginPath();
    g.arc(0, 0, R * VIS.numerosIn, a0, a1);
    g.arc(0, 0, R * VIS.bolsoIn, a1, a0, true);
    g.closePath();
    const gr = g.createRadialGradient(0, 0, R * VIS.bolsoIn, 0, 0, R * VIS.numerosIn);
    const base = corNumero(ORDEM_RODA[i]);
    gr.addColorStop(0, '#08070a'); gr.addColorStop(0.55, base); gr.addColorStop(1, '#0a0809');
    g.fillStyle = gr;
    g.fill();
  }
  g.strokeStyle = '#e8cf8f';
  for (let i = 0; i < 37; i++) {
    const a = i * PASSO;
    g.lineWidth = Math.max(1.2, R * 0.009);
    g.beginPath();
    g.moveTo(Math.cos(a) * R * VIS.bolsoIn, Math.sin(a) * R * VIS.bolsoIn);
    g.lineTo(Math.cos(a) * R * VIS.rotor, Math.sin(a) * R * VIS.rotor);
    g.stroke();
  }
  g.lineWidth = Math.max(1.5, R * 0.012);
  for (const r of [VIS.rotor, VIS.numerosIn, VIS.bolsoIn]) { g.beginPath(); g.arc(0, 0, R * r, 0, Math.PI * 2); g.stroke(); }
  // cone interno de madeira com raios de latão
  const cone = g.createRadialGradient(-R * 0.1, -R * 0.12, R * 0.05, 0, 0, R * VIS.bolsoIn);
  cone.addColorStop(0, '#8a5a2e'); cone.addColorStop(0.6, '#4a2c14'); cone.addColorStop(1, '#2a170a');
  g.beginPath(); g.arc(0, 0, R * VIS.bolsoIn - 1, 0, Math.PI * 2); g.fillStyle = cone; g.fill();
  const rr = aleatorioSemeado(9);
  g.strokeStyle = 'rgba(40,20,8,.35)'; g.lineWidth = 1;
  for (let i = 0; i < 60; i++) { const a = rr() * Math.PI * 2; g.beginPath(); g.arc(0, 0, R * (0.2 + rr() * 0.3), a, a + 0.4 + rr()); g.stroke(); }
  g.strokeStyle = 'rgba(232,207,143,.75)'; g.lineWidth = Math.max(1, R * 0.006);
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * Math.PI * 2;
    g.beginPath(); g.moveTo(Math.cos(a) * R * 0.22, Math.sin(a) * R * 0.22); g.lineTo(Math.cos(a) * R * (VIS.bolsoIn - 0.02), Math.sin(a) * R * (VIS.bolsoIn - 0.02)); g.stroke();
  }
  return c;
}

// Cuba: tudo o que não gira, já na perspectiva.
function rasterizarCuba(W, H, cx, cy, R) {
  const c = tela(W, H);
  const g = c.getContext('2d');
  const k = INCLINACAO;
  const el = (r, dy = 0) => { g.beginPath(); g.ellipse(cx, cy + dy, R * r, R * r * k, 0, 0, Math.PI * 2); };
  // sombra na mesa
  g.save();
  g.filter = `blur(${Math.round(R * 0.06)}px)`;
  g.fillStyle = 'rgba(0,0,0,.6)';
  g.beginPath(); g.ellipse(cx, cy + R * 0.2, R * 1.12, R * 1.12 * k, 0, 0, Math.PI * 2); g.fill();
  g.restore();
  // costado de madeira (a espessura da cuba aparece embaixo)
  const esp = R * 0.16;
  const lado = g.createLinearGradient(cx - R * 1.06, 0, cx + R * 1.06, 0);
  lado.addColorStop(0, '#1d0f06'); lado.addColorStop(0.35, '#5a3418'); lado.addColorStop(0.6, '#7a4a22'); lado.addColorStop(1, '#1d0f06');
  g.beginPath();
  g.ellipse(cx, cy + esp, R * 1.06, R * 1.06 * k, 0, 0, Math.PI);
  g.lineTo(cx - R * 1.06, cy);
  g.ellipse(cx, cy, R * 1.06, R * 1.06 * k, 0, Math.PI, 0, true);
  g.closePath();
  g.fillStyle = lado; g.fill();
  g.strokeStyle = 'rgba(232,207,143,.6)'; g.lineWidth = 1.5;
  g.beginPath(); g.ellipse(cx, cy + esp * 0.55, R * 1.06, R * 1.06 * k, 0, 0.1, Math.PI - 0.1); g.stroke();
  // borda de madeira polida
  el(1.06);
  const borda = g.createLinearGradient(0, cy - R * k, 0, cy + R * k);
  borda.addColorStop(0, '#3a200e'); borda.addColorStop(0.5, '#6a3f1c'); borda.addColorStop(1, '#2a160a');
  g.fillStyle = borda; g.fill();
  el(1.06); g.strokeStyle = '#c9a45c'; g.lineWidth = 2; g.stroke();
  // trilho da bola: madeira clara, inclinado
  el(VIS.borda);
  const trilho = g.createRadialGradient(cx, cy - R * 0.3, R * 0.2, cx, cy, R);
  trilho.addColorStop(0, '#a87a44'); trilho.addColorStop(0.85, '#8a5e30'); trilho.addColorStop(1, '#5a3a1a');
  g.fillStyle = trilho; g.fill();
  el(VIS.borda); g.strokeStyle = '#e8cf8f'; g.lineWidth = 1.2; g.stroke();
  // cone: desce do trilho até o rotor
  const dCone = profundidade(VIS.rotor) * R * COS;
  g.beginPath();
  g.ellipse(cx, cy, R * VIS.cone, R * VIS.cone * k, 0, 0, Math.PI * 2);
  g.fillStyle = '#3a220e'; g.fill();
  g.beginPath(); g.ellipse(cx, cy, R * VIS.cone, R * VIS.cone * k, 0, 0, Math.PI * 2);
  const conoG = g.createLinearGradient(0, cy - R * k, 0, cy + R * k);
  conoG.addColorStop(0, 'rgba(0,0,0,.45)'); conoG.addColorStop(0.5, 'rgba(0,0,0,.1)'); conoG.addColorStop(1, 'rgba(255,220,160,.08)');
  g.fillStyle = conoG; g.fill();
  g.strokeStyle = 'rgba(232,207,143,.5)'; g.lineWidth = 1; g.stroke();
  // defletores: losangos de latão no cone
  for (const d of DEFLETORES) {
    const rv = 0.86;
    const x = cx + Math.cos(d) * R * rv, y = cy + Math.sin(d) * R * rv * k + profundidade(rv) * R * COS;
    const tan = [-Math.sin(d), Math.cos(d) * k], rad = [Math.cos(d), Math.sin(d) * k];
    const l = R * 0.05, w = R * 0.018;
    g.beginPath();
    g.moveTo(x + tan[0] * l, y + tan[1] * l);
    g.lineTo(x + rad[0] * w, y + rad[1] * w - R * 0.012);
    g.lineTo(x - tan[0] * l, y - tan[1] * l);
    g.lineTo(x - rad[0] * w, y - rad[1] * w);
    g.closePath();
    const lg = g.createLinearGradient(x - l, y - l, x + l, y + l);
    lg.addColorStop(0, '#f1dca0'); lg.addColorStop(0.5, '#a88542'); lg.addColorStop(1, '#e8cf8f');
    g.fillStyle = lg; g.fill();
    g.strokeStyle = 'rgba(40,24,8,.8)'; g.lineWidth = 0.8; g.stroke();
  }
  // o vão onde o rotor gira
  g.beginPath(); g.ellipse(cx, cy + dCone, R * (VIS.rotor + 0.012), R * (VIS.rotor + 0.012) * k, 0, 0, Math.PI * 2);
  g.fillStyle = '#0a0604'; g.fill();
  return c;
}

export function criarRoda(canvas) {
  const g = canvas.getContext('2d');
  let W = 0, H = 0, R = 0, cx = 0, cy = 0, dpr = 1;
  let rotor = null, cuba = null;

  function dimensionar() {
    dpr = Math.min(2, devicePixelRatio || 1);
    const r = canvas.getBoundingClientRect();
    W = Math.max(10, Math.round(r.width * dpr)); H = Math.max(10, Math.round(r.height * dpr));
    canvas.width = W; canvas.height = H;
    R = Math.min(W * 0.42, (H * 0.8) / (2 * INCLINACAO * 1.06 + 0.4));
    cx = W / 2; cy = H * 0.47;
    rotor = rasterizarRotor(R);
    cuba = rasterizarCuba(W, H, cx, cy, R);
  }

  // Posição de tela de um ponto da roda (ângulo, raio visual, altura).
  function ponto(ang, rv, h = 0) {
    return [cx + Math.cos(ang) * R * rv, cy + Math.sin(ang) * R * rv * INCLINACAO + profundidade(rv) * R * COS - h * R * 0.16 * COS];
  }

  function desenhar(estado) {
    if (!cuba) dimensionar();
    const { rotorAng, bola } = estado;
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.clearRect(0, 0, W, H);
    g.drawImage(cuba, 0, 0);
    // rotor girando, achatado pela inclinação
    const dRotor = profundidade(VIS.rotor) * R * COS;
    g.setTransform(1, 0, 0, INCLINACAO, cx, cy + dRotor);
    g.rotate(rotorAng);
    g.drawImage(rotor, -R, -R, R * 2, R * 2);
    g.setTransform(1, 0, 0, 1, 0, 0);
    // torre de latão
    torre(rotorAng, dRotor);
    // brilho do abajur
    const luz = g.createRadialGradient(cx - R * 0.2, cy - R * 0.5, R * 0.05, cx, cy, R * 1.1);
    luz.addColorStop(0, 'rgba(255,230,180,.16)'); luz.addColorStop(1, 'rgba(255,230,180,0)');
    g.fillStyle = luz; g.beginPath(); g.ellipse(cx, cy, R * 1.06, R * 1.06 * INCLINACAO, 0, 0, Math.PI * 2); g.fill();
    if (bola) desenharBola(bola);
  }

  function torre(ang, d) {
    const k = INCLINACAO;
    const base = cy + d;
    const rb = R * 0.16;
    const gr = g.createLinearGradient(cx - rb, 0, cx + rb, 0);
    gr.addColorStop(0, '#6a5024'); gr.addColorStop(0.45, '#f1dca0'); gr.addColorStop(1, '#6a5024');
    g.fillStyle = gr;
    g.beginPath(); g.ellipse(cx, base, rb, rb * k, 0, 0, Math.PI * 2); g.fill();
    // cone da torre
    g.beginPath(); g.moveTo(cx - rb * 0.7, base); g.lineTo(cx - rb * 0.18, base - R * 0.2); g.lineTo(cx + rb * 0.18, base - R * 0.2); g.lineTo(cx + rb * 0.7, base); g.closePath(); g.fill();
    // braços em cruz com esferas
    for (let i = 0; i < 4; i++) {
      const a = ang + i * Math.PI / 2;
      const px = cx + Math.cos(a) * R * 0.2, py = base - R * 0.13 + Math.sin(a) * R * 0.2 * k;
      g.strokeStyle = '#d9bb77'; g.lineWidth = Math.max(2, R * 0.022); g.lineCap = 'round';
      g.beginPath(); g.moveTo(cx, base - R * 0.13); g.lineTo(px, py); g.stroke();
      const eg = g.createRadialGradient(px - 2, py - 2, 0.5, px, py, R * 0.03);
      eg.addColorStop(0, '#fff6d8'); eg.addColorStop(1, '#8a6a2e');
      g.fillStyle = eg; g.beginPath(); g.arc(px, py, R * 0.028, 0, Math.PI * 2); g.fill();
    }
    const topo = g.createRadialGradient(cx - 2, base - R * 0.22, 1, cx, base - R * 0.2, R * 0.045);
    topo.addColorStop(0, '#fffbe8'); topo.addColorStop(1, '#a88542');
    g.fillStyle = topo; g.beginPath(); g.arc(cx, base - R * 0.21, R * 0.04, 0, Math.PI * 2); g.fill();
  }

  function desenharBola({ phi, rho, h, alfa = 1 }) {
    const rv = raioVisual(rho);
    const [sx, sy] = ponto(phi, rv, 0);
    const [bx, by] = ponto(phi, rv, h);
    const rb = R * 0.03;
    g.globalAlpha = alfa;
    g.fillStyle = 'rgba(0,0,0,.45)';
    g.beginPath(); g.ellipse(sx + rb * 0.25, sy + rb * 0.35, rb * (1.1 - Math.min(0.4, h)), rb * 0.55, 0, 0, Math.PI * 2); g.fill();
    const bg = g.createRadialGradient(bx - rb * 0.35, by - rb * 0.4, rb * 0.1, bx, by, rb);
    bg.addColorStop(0, '#ffffff'); bg.addColorStop(0.55, '#e8e4dc'); bg.addColorStop(1, '#8a8478');
    g.fillStyle = bg; g.beginPath(); g.arc(bx, by, rb, 0, Math.PI * 2); g.fill();
    g.globalAlpha = 1;
  }

  // Onde está a casa de um número agora (para a câmera se aproximar dela).
  function pontoDaCasa(numero, rotorAng) {
    const i = ORDEM_RODA.indexOf(numero);
    const a = rotorAng + (i + 0.5) * PASSO;
    const [x, y] = ponto(a, 0.6, 0);
    return { x: x / dpr, y: y / dpr };
  }

  return { dimensionar, desenhar, pontoDaCasa, get R() { return R; } };
}
