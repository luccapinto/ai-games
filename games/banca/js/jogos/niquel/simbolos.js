// Os doze símbolos do MALECÓN 57, desenhados em canvas: Havana de 1957 à
// noite, em art déco e neon. A Casa (o curinga) é um prédio déco de degraus,
// a Lua de Havana (o disperso) nasce sobre o muro do Malecón, e os quatro
// naipes são medalhões de latão. Cada símbolo é rasterizado uma vez por
// tamanho; os rolos só copiam.

import { NAIPE_PATH } from '../../visual/cartas.js';
import { tela } from '../../visual/texturas.js';

const ROSA = '#ff3d6e', CIANO = '#35f0d8', LATAO = '#c9a45c', LATAO_CLARO = '#f1dca0';

function brilho(g, cor, blur) { g.shadowColor = cor; g.shadowBlur = blur; }
function semBrilho(g) { g.shadowBlur = 0; g.shadowColor = 'transparent'; }

function gradLatao(g, x0, y0, x1, y1) {
  const gr = g.createLinearGradient(x0, y0, x1, y1);
  gr.addColorStop(0, '#fff1c4'); gr.addColorStop(0.3, '#d9b46a'); gr.addColorStop(0.6, '#8f6a2c'); gr.addColorStop(1, '#e8cf8f');
  return gr;
}

function plaquinha(g, texto, cor = LATAO_CLARO) {
  g.font = '11px Limelight';
  g.textAlign = 'center';
  g.fillStyle = 'rgba(0,0,0,.55)';
  const w = g.measureText(texto).width + 12;
  g.fillRect(50 - w / 2, 84, w, 13);
  g.strokeStyle = LATAO; g.lineWidth = 0.8; g.strokeRect(50 - w / 2, 84, w, 13);
  g.fillStyle = cor;
  g.fillText(texto, 50, 94.5);
}

const DESENHOS = {
  casa(g) {
    // raios atrás do prédio
    g.save();
    g.strokeStyle = 'rgba(255,61,110,.35)'; g.lineWidth = 1;
    for (let i = 0; i < 15; i++) { const a = Math.PI + (i / 14) * Math.PI; g.beginPath(); g.moveTo(50, 70); g.lineTo(50 + Math.cos(a) * 60, 70 + Math.sin(a) * 60); g.stroke(); }
    g.restore();
    // prédio em degraus
    const degraus = [[22, 78, 56, 18], [28, 60, 44, 20], [34, 44, 32, 18], [40, 30, 20, 16], [45, 18, 10, 14]];
    for (const [x, y, w, h] of degraus) {
      g.fillStyle = gradLatao(g, x, y, x + w, y + h);
      g.fillRect(x, y, w, h);
      g.fillStyle = 'rgba(60,30,10,.55)'; g.fillRect(x, y + h - 2, w, 2);
    }
    // janelas acesas
    g.fillStyle = '#ffe9b0';
    for (const [x, y, w, h] of degraus.slice(0, 3)) for (let c = x + 4; c < x + w - 3; c += 6) for (let r = y + 4; r < y + h - 4; r += 6) g.fillRect(c, r, 3, 3.4);
    // agulha e contorno de neon
    g.fillStyle = LATAO_CLARO; g.fillRect(49, 6, 2, 12);
    brilho(g, ROSA, 8);
    g.strokeStyle = ROSA; g.lineWidth = 1.8;
    g.beginPath(); g.moveTo(20, 96); g.lineTo(20, 78); g.lineTo(28, 78); g.lineTo(28, 60); g.lineTo(34, 60); g.lineTo(34, 44); g.lineTo(40, 44); g.lineTo(40, 30); g.lineTo(45, 30); g.lineTo(45, 18); g.lineTo(55, 18); g.lineTo(55, 30); g.lineTo(60, 30); g.lineTo(60, 44); g.lineTo(66, 44); g.lineTo(66, 60); g.lineTo(72, 60); g.lineTo(72, 78); g.lineTo(80, 78); g.lineTo(80, 96); g.stroke();
    semBrilho(g);
    plaquinha(g, 'A CASA', '#ffd6e0');
  },
  lua(g) {
    // mar e o muro do Malecón
    const mar = g.createLinearGradient(0, 62, 0, 90);
    mar.addColorStop(0, '#12305a'); mar.addColorStop(1, '#06142c');
    g.fillStyle = mar; g.fillRect(6, 62, 88, 22);
    g.strokeStyle = 'rgba(53,240,216,.55)'; g.lineWidth = 1;
    for (let y = 66; y < 82; y += 5) { g.beginPath(); for (let x = 8; x <= 92; x += 4) g.lineTo(x, y + Math.sin(x * 0.4 + y) * 1.2); g.stroke(); }
    g.fillStyle = '#2a2230'; g.fillRect(6, 80, 88, 5);
    // estrelas
    g.fillStyle = '#fff';
    for (const [x, y, r] of [[18, 16, 1.2], [80, 12, 1], [72, 30, 0.8], [28, 34, 0.9], [88, 44, 1.1], [12, 48, 0.7]]) { g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill(); }
    // lua crescente com brilho ciano
    brilho(g, CIANO, 16);
    g.fillStyle = '#e9fffb';
    g.beginPath(); g.arc(50, 38, 22, 0, Math.PI * 2); g.fill();
    semBrilho(g);
    g.globalCompositeOperation = 'destination-out';
    g.beginPath(); g.arc(61, 31, 19, 0, Math.PI * 2); g.fill();
    g.globalCompositeOperation = 'source-over';
    // reflexo no mar
    g.fillStyle = 'rgba(233,255,251,.45)';
    for (let i = 0; i < 5; i++) g.fillRect(40 - i, 66 + i * 3.2, 10 + i * 2, 1.2);
    plaquinha(g, 'LUA', '#d8fff8');
  },
  flamingo(g) {
    brilho(g, ROSA, 10);
    g.strokeStyle = '#ff7aa0'; g.lineWidth = 3; g.lineCap = 'round'; g.lineJoin = 'round';
    // pernas
    g.beginPath(); g.moveTo(52, 62); g.lineTo(52, 92); g.stroke();
    g.beginPath(); g.moveTo(56, 62); g.lineTo(64, 76); g.lineTo(54, 80); g.stroke();
    // corpo
    g.fillStyle = '#ff5c8a';
    g.beginPath(); g.ellipse(54, 54, 20, 11, -0.25, 0, Math.PI * 2); g.fill();
    // asa
    g.fillStyle = '#ff9ab5';
    g.beginPath(); g.moveTo(40, 52); g.quadraticCurveTo(58, 40, 72, 50); g.quadraticCurveTo(58, 58, 40, 52); g.fill();
    // pescoço em S e cabeça
    g.lineWidth = 5;
    g.beginPath(); g.moveTo(38, 50); g.bezierCurveTo(26, 42, 44, 28, 36, 18); g.stroke();
    g.fillStyle = '#ff5c8a';
    g.beginPath(); g.arc(35, 15, 6, 0, Math.PI * 2); g.fill();
    semBrilho(g);
    g.fillStyle = '#1a0c10';
    g.beginPath(); g.moveTo(30, 14); g.quadraticCurveTo(22, 18, 26, 26); g.lineTo(29, 21); g.closePath(); g.fill();
    g.fillStyle = '#fff'; g.beginPath(); g.arc(36, 13, 1.4, 0, Math.PI * 2); g.fill();
  },
  trompete(g) {
    g.save();
    g.translate(50, 52); g.rotate(-0.35); g.translate(-50, -52);
    const lat = gradLatao(g, 10, 40, 90, 64);
    // tubo
    g.strokeStyle = lat; g.lineWidth = 5; g.lineCap = 'round';
    g.beginPath(); g.moveTo(14, 52); g.lineTo(62, 52); g.stroke();
    g.beginPath(); g.moveTo(30, 52); g.bezierCurveTo(30, 66, 56, 66, 56, 52); g.stroke();
    // campânula
    g.fillStyle = lat;
    g.beginPath(); g.moveTo(60, 48); g.quadraticCurveTo(76, 46, 88, 34); g.lineTo(88, 70); g.quadraticCurveTo(76, 58, 60, 56); g.closePath(); g.fill();
    g.fillStyle = '#7a5520'; g.beginPath(); g.ellipse(88, 52, 3.5, 18, 0, 0, Math.PI * 2); g.fill();
    g.fillStyle = 'rgba(255,245,210,.6)'; g.beginPath(); g.ellipse(87, 48, 1.5, 12, 0, 0, Math.PI * 2); g.fill();
    // pistões
    for (const x of [36, 43, 50]) {
      g.fillStyle = gradLatao(g, x - 3, 36, x + 3, 50);
      g.fillRect(x - 2.5, 38, 5, 14);
      g.fillStyle = '#fff5d8'; g.beginPath(); g.ellipse(x, 37, 3.6, 1.6, 0, 0, Math.PI * 2); g.fill();
    }
    // bocal
    g.fillStyle = LATAO_CLARO; g.beginPath(); g.ellipse(12, 52, 2.4, 4, 0, 0, Math.PI * 2); g.fill();
    g.restore();
    brilho(g, 'rgba(255,214,140,.9)', 14);
    g.fillStyle = 'rgba(255,230,170,.35)'; g.beginPath(); g.arc(80, 30, 2, 0, Math.PI * 2); g.fill();
    semBrilho(g);
  },
  conversivel(g) {
    // carroceria vista de frente
    const cor = g.createLinearGradient(0, 40, 0, 80);
    cor.addColorStop(0, '#6ff0dc'); cor.addColorStop(0.5, '#1fa594'); cor.addColorStop(1, '#0c5a52');
    g.fillStyle = cor;
    g.beginPath(); g.moveTo(10, 72); g.lineTo(12, 52); g.quadraticCurveTo(20, 44, 32, 44); g.lineTo(68, 44); g.quadraticCurveTo(80, 44, 88, 52); g.lineTo(90, 72); g.closePath(); g.fill();
    // para-brisa
    g.fillStyle = 'rgba(180,240,255,.55)';
    g.beginPath(); g.moveTo(28, 44); g.lineTo(34, 30); g.lineTo(66, 30); g.lineTo(72, 44); g.closePath(); g.fill();
    g.strokeStyle = '#e6eef2'; g.lineWidth = 1.5; g.stroke();
    // grade cromada
    g.fillStyle = '#1a2226'; g.fillRect(30, 58, 40, 12);
    g.strokeStyle = '#e6eef2'; g.lineWidth = 1.2;
    for (let y = 60; y <= 68; y += 3) { g.beginPath(); g.moveTo(31, y); g.lineTo(69, y); g.stroke(); }
    // faróis com brilho
    for (const x of [20, 80]) {
      brilho(g, '#fff7c0', 10);
      g.fillStyle = '#fffbe0'; g.beginPath(); g.arc(x, 60, 6, 0, Math.PI * 2); g.fill();
      semBrilho(g);
      g.strokeStyle = '#e6eef2'; g.lineWidth = 1.6; g.beginPath(); g.arc(x, 60, 7.2, 0, Math.PI * 2); g.stroke();
    }
    // para-choque
    g.fillStyle = gradLatao(g, 0, 72, 0, 80);
    g.fillStyle = '#dfe8ec'; g.fillRect(8, 72, 84, 6);
    g.fillStyle = 'rgba(255,255,255,.7)'; g.fillRect(8, 72, 84, 1.6);
    // pneus
    g.fillStyle = '#0a0a0c'; g.fillRect(14, 78, 12, 8); g.fillRect(74, 78, 12, 8);
    // placa
    g.fillStyle = '#f3ead7'; g.fillRect(42, 73, 16, 4.5);
    g.fillStyle = '#5a1422'; g.font = '4px Jost'; g.textAlign = 'center'; g.fillText('HAB 57', 50, 76.8);
  },
  coquetel(g) {
    // taça coupé
    g.strokeStyle = 'rgba(230,250,255,.85)'; g.lineWidth = 1.6;
    const liquido = g.createLinearGradient(0, 26, 0, 48);
    liquido.addColorStop(0, '#f6ffe8'); liquido.addColorStop(1, '#c9eeb0');
    g.fillStyle = liquido;
    g.beginPath(); g.moveTo(18, 28); g.quadraticCurveTo(50, 64, 82, 28); g.closePath(); g.fill();
    g.beginPath(); g.moveTo(16, 26); g.quadraticCurveTo(50, 66, 84, 26); g.stroke();
    g.beginPath(); g.moveTo(50, 45); g.lineTo(50, 80); g.stroke();
    g.beginPath(); g.ellipse(50, 82, 16, 3.5, 0, 0, Math.PI * 2); g.stroke();
    g.fillStyle = 'rgba(230,250,255,.18)'; g.fill();
    // rodela de limão na borda
    g.fillStyle = '#9fe05a';
    g.beginPath(); g.arc(76, 24, 10, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#e8ffc8';
    g.beginPath(); g.arc(76, 24, 7.5, 0, Math.PI * 2); g.fill();
    g.strokeStyle = '#9fe05a'; g.lineWidth = 1;
    for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4; g.beginPath(); g.moveTo(76, 24); g.lineTo(76 + Math.cos(a) * 7, 24 + Math.sin(a) * 7); g.stroke(); }
    // brilho no vidro
    g.strokeStyle = 'rgba(255,255,255,.7)'; g.lineWidth = 1.4;
    g.beginPath(); g.moveTo(26, 31); g.quadraticCurveTo(34, 40, 40, 42); g.stroke();
  },
  maraca(g) {
    const uma = (ang, c1, c2) => {
      g.save();
      g.translate(50, 56); g.rotate(ang);
      g.fillStyle = '#6a3a14'; g.fillRect(-3, 6, 6, 34);
      g.fillStyle = '#8a5020'; g.fillRect(-3, 6, 2, 34);
      const gr = g.createRadialGradient(-6, -22, 2, 0, -14, 22);
      gr.addColorStop(0, '#fff1c0'); gr.addColorStop(0.4, c1); gr.addColorStop(1, c2);
      g.fillStyle = gr;
      g.beginPath(); g.ellipse(0, -14, 14, 20, 0, 0, Math.PI * 2); g.fill();
      g.strokeStyle = 'rgba(20,10,5,.5)'; g.lineWidth = 1.6;
      for (const y of [-22, -12, -2]) { g.beginPath(); g.ellipse(0, y, 13 - Math.abs(y + 12) * 0.2, 2.5, 0, 0, Math.PI); g.stroke(); }
      g.restore();
    };
    uma(-0.5, '#ff5c6a', '#8a1224');
    uma(0.5, '#ffcf4a', '#b87a10');
  },
  palmeira(g) {
    // pôr do sol
    const sol = g.createLinearGradient(0, 30, 0, 80);
    sol.addColorStop(0, '#ffb14a'); sol.addColorStop(1, '#ff3d6e');
    g.fillStyle = sol; g.beginPath(); g.arc(60, 64, 22, Math.PI, 0); g.fill();
    g.fillStyle = 'rgba(11,11,13,.9)';
    for (let y = 50; y < 64; y += 4) g.fillRect(38, y, 44, 1.2);
    // tronco curvo
    g.strokeStyle = '#2a1a0c'; g.lineWidth = 5; g.lineCap = 'round';
    g.beginPath(); g.moveTo(38, 92); g.quadraticCurveTo(34, 60, 46, 26); g.stroke();
    g.strokeStyle = '#4a2c14'; g.lineWidth = 1;
    for (let t = 0.1; t < 1; t += 0.12) { const x = 38 + (46 - 38) * t - 6 * Math.sin(t * Math.PI), y = 92 - 66 * t; g.beginPath(); g.moveTo(x - 3, y); g.lineTo(x + 3, y + 1); g.stroke(); }
    // folhas
    g.fillStyle = '#0f3a24';
    for (const [a, l] of [[-2.7, 30], [-2.2, 34], [-1.6, 26], [-1.0, 34], [-0.45, 30], [0.2, 24]]) {
      g.save(); g.translate(46, 26); g.rotate(a);
      g.beginPath(); g.moveTo(0, 0); g.quadraticCurveTo(l * 0.5, -8, l, 4); g.quadraticCurveTo(l * 0.5, -1, 0, 3); g.closePath(); g.fill();
      g.restore();
    }
    g.fillStyle = '#6a3a14'; g.beginPath(); g.arc(46, 28, 3, 0, Math.PI * 2); g.fill();
  },
};

function naipe(g, n) {
  // medalhão de latão com o naipe em relevo
  const gr = g.createRadialGradient(40, 36, 4, 50, 50, 42);
  gr.addColorStop(0, '#3a2a18'); gr.addColorStop(1, '#130c06');
  g.fillStyle = gr;
  g.beginPath(); g.arc(50, 50, 38, 0, Math.PI * 2); g.fill();
  g.strokeStyle = gradLatao(g, 12, 12, 88, 88); g.lineWidth = 3.5; g.stroke();
  g.lineWidth = 1; g.strokeStyle = 'rgba(232,207,143,.5)'; g.beginPath(); g.arc(50, 50, 32, 0, Math.PI * 2); g.stroke();
  const p = new Path2D(NAIPE_PATH[n]);
  g.save();
  g.translate(24, 24); g.scale(0.52, 0.52);
  const vermelho = n === 1 || n === 2;
  g.translate(2, 3);
  g.fillStyle = 'rgba(0,0,0,.6)'; g.fill(p);
  g.translate(-2, -3);
  const cor = g.createLinearGradient(0, 0, 100, 100);
  if (vermelho) { cor.addColorStop(0, '#ff9aa6'); cor.addColorStop(0.5, '#c8182e'); cor.addColorStop(1, '#6a0c18'); }
  else { cor.addColorStop(0, '#fff1c4'); cor.addColorStop(0.45, '#c9a45c'); cor.addColorStop(1, '#6a4a1c'); }
  g.fillStyle = cor; g.fill(p);
  g.strokeStyle = vermelho ? 'rgba(255,220,220,.5)' : 'rgba(255,250,220,.6)'; g.lineWidth = 2; g.stroke(p);
  g.restore();
}

const NAIPES = { espadas: 0, copas: 1, ouros: 2, paus: 3 };

export function desenharSimbolo(g, id) {
  if (id in NAIPES) naipe(g, NAIPES[id]);
  else DESENHOS[id](g);
}

// Cache de rasterização: um canvas por símbolo e tamanho.
const cache = new Map();
export function imagemDoSimbolo(id, tam) {
  const k = `${id}@${tam}`;
  if (cache.has(k)) return cache.get(k);
  const c = tela(tam, tam);
  const g = c.getContext('2d');
  g.scale(tam / 100, tam / 100);
  desenharSimbolo(g, id);
  cache.set(k, c);
  return c;
}

export function limparCache() { cache.clear(); }
