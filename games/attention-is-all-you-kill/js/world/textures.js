// textures.js — texturas procedurais geradas em canvas.
// Decisão de design: zero arquivo de imagem. O jogo não baixa nada.

import * as THREE from '../../vendor/three.module.js';
import { LOGOS, VIEWBOX } from './logos.js';

function makeCanvas(size) {
  const c = document.createElement('canvas');
  c.width = size;
  c.height = size;
  return c;
}

function finish(canvas, repeatX = 1, repeatY = 1) {
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(repeatX, repeatY);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

// Converte inteiro 0xRRGGBB em string css.
function hex(n) {
  return '#' + n.toString(16).padStart(6, '0');
}

function shade(n, amount) {
  const r = Math.min(255, Math.max(0, ((n >> 16) & 255) + amount));
  const g = Math.min(255, Math.max(0, ((n >> 8) & 255) + amount));
  const b = Math.min(255, Math.max(0, (n & 255) + amount));
  return `rgb(${r},${g},${b})`;
}

// ------------------------------------------------------------------
// Piso: placa metalica com grade e rebites.
// ------------------------------------------------------------------
export function floorTexture(theme, repeat = 24) {
  const S = 256;
  const c = makeCanvas(S);
  const g = c.getContext('2d');
  g.fillStyle = shade(theme.floorColor, 0);
  g.fillRect(0, 0, S, S);

  // textura granulada
  for (let i = 0; i < 2600; i++) {
    const a = Math.random() * 0.05;
    g.fillStyle = `rgba(255,255,255,${a})`;
    g.fillRect(Math.random() * S, Math.random() * S, 2, 2);
  }

  // grade
  g.strokeStyle = shade(theme.floorColor, 26);
  g.lineWidth = 3;
  for (let i = 0; i <= 2; i++) {
    const p = (i * S) / 2;
    g.beginPath(); g.moveTo(p, 0); g.lineTo(p, S); g.stroke();
    g.beginPath(); g.moveTo(0, p); g.lineTo(S, p); g.stroke();
  }

  // rebites nos cruzamentos
  g.fillStyle = shade(theme.floorColor, 42);
  for (let i = 0; i <= 2; i++) {
    for (let j = 0; j <= 2; j++) {
      g.beginPath();
      g.arc((i * S) / 2, (j * S) / 2, 3.4, 0, Math.PI * 2);
      g.fill();
    }
  }

  // ranhuras finas
  g.strokeStyle = 'rgba(0,0,0,0.35)';
  g.lineWidth = 1;
  for (let i = 0; i < 8; i++) {
    const y = (i / 8) * S + 6;
    g.beginPath(); g.moveTo(0, y); g.lineTo(S, y); g.stroke();
  }

  return finish(c, repeat, repeat);
}

// ------------------------------------------------------------------
// Parede: painel industrial com faixa de acento e brilho de LED.
// ------------------------------------------------------------------
export function wallTexture(theme, repeat = 8) {
  const S = 256;
  const c = makeCanvas(S);
  const g = c.getContext('2d');

  const grad = g.createLinearGradient(0, 0, 0, S);
  grad.addColorStop(0, shade(theme.wallColor, 14));
  grad.addColorStop(0.55, shade(theme.wallColor, -8));
  grad.addColorStop(1, shade(theme.wallColor, -26));
  g.fillStyle = grad;
  g.fillRect(0, 0, S, S);

  // manchas e sujeira
  for (let i = 0; i < 900; i++) {
    const a = Math.random() * 0.045;
    g.fillStyle = Math.random() > 0.5 ? `rgba(255,255,255,${a})` : `rgba(0,0,0,${a})`;
    g.fillRect(Math.random() * S, Math.random() * S, 3, 3);
  }

  // divisão de paineis
  g.strokeStyle = 'rgba(0,0,0,0.5)';
  g.lineWidth = 3;
  g.strokeRect(4, 4, S - 8, S - 8);
  g.beginPath(); g.moveTo(S / 2, 4); g.lineTo(S / 2, S - 4); g.stroke();
  g.beginPath(); g.moveTo(4, S * 0.34); g.lineTo(S - 4, S * 0.34); g.stroke();

  // faixa de acento neon no meio da parede
  g.fillStyle = hex(theme.wallAccent);
  g.globalAlpha = 0.20;
  g.fillRect(0, S * 0.62, S, 5);
  g.globalAlpha = 1;
  g.fillStyle = hex(theme.wallAccent);
  g.globalAlpha = 0.75;
  g.fillRect(0, S * 0.64, S, 2);
  g.globalAlpha = 1;

  // parafusos
  g.fillStyle = shade(theme.wallColor, 40);
  const bolts = [[14, 14], [S - 14, 14], [14, S - 14], [S - 14, S - 14]];
  for (const [x, y] of bolts) {
    g.beginPath(); g.arc(x, y, 3, 0, Math.PI * 2); g.fill();
  }

  return finish(c, repeat, repeat / 2);
}

// ------------------------------------------------------------------
// Teto: grade escura com viga.
// ------------------------------------------------------------------
export function ceilingTexture(theme, repeat = 20) {
  const S = 128;
  const c = makeCanvas(S);
  const g = c.getContext('2d');
  g.fillStyle = shade(theme.ceilingColor, 0);
  g.fillRect(0, 0, S, S);

  g.strokeStyle = shade(theme.ceilingColor, 20);
  g.lineWidth = 4;
  for (let i = 0; i <= 4; i++) {
    const p = (i * S) / 4;
    g.beginPath(); g.moveTo(p, 0); g.lineTo(p, S); g.stroke();
    g.beginPath(); g.moveTo(0, p); g.lineTo(S, p); g.stroke();
  }

  g.fillStyle = shade(theme.ceilingColor, 34);
  g.fillRect(0, S / 2 - 3, S, 6);

  return finish(c, repeat, repeat);
}

// ------------------------------------------------------------------
// Rack de servidor: caixa com fileiras de LEDs acesos.
// ------------------------------------------------------------------
export function rackTexture(theme, repeat = 1) {
  const S = 256;
  const c = makeCanvas(S);
  const g = c.getContext('2d');

  g.fillStyle = shade(theme.propColor, 0);
  g.fillRect(0, 0, S, S);

  // estrutura externa
  g.strokeStyle = shade(theme.propColor, 34);
  g.lineWidth = 6;
  g.strokeRect(3, 3, S - 6, S - 6);

  // 16 unidades de servidor
  const rows = 16;
  for (let i = 0; i < rows; i++) {
    const y = 8 + i * ((S - 16) / rows);
    const h = (S - 16) / rows - 3;

    // corpo da unidade
    g.fillStyle = shade(theme.propColor, 12);
    g.fillRect(10, y, S - 20, h);

    // LEDs
    const ledCount = 5;
    for (let k = 0; k < ledCount; k++) {
      const on = Math.random() > 0.28;
      const x = S - 22 - k * 12;
      g.fillStyle = on
        ? (Math.random() > 0.75 ? hex(theme.propEmissive) : '#8ef0ff')
        : 'rgba(40,60,70,0.9)';
      g.fillRect(x, y + 2, 6, Math.max(2, h - 4));
    }

    // grade de ventilacao
    g.fillStyle = 'rgba(0,0,0,0.45)';
    for (let v = 0; v < 6; v++) {
      g.fillRect(14 + v * 9, y + 2, 4, Math.max(2, h - 4));
    }
  }

  return finish(c, repeat, repeat);
}

// ------------------------------------------------------------------
// Sprite radial: usado para brilho de luz, glow de LED e mira de inimigo.
// ------------------------------------------------------------------
export function glowTexture(colorHex = 0xffffff) {
  const S = 128;
  const c = makeCanvas(S);
  const g = c.getContext('2d');
  const grad = g.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2);
  const col = hex(colorHex);
  grad.addColorStop(0, col);
  grad.addColorStop(0.35, col);
  grad.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, S, S);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

// ------------------------------------------------------------------
// Sombra falsa: mancha radial escura no chão. Substitute barato de shadow map.
// ------------------------------------------------------------------
export function blobShadowTexture() {
  const S = 64;
  const c = makeCanvas(S);
  const g = c.getContext('2d');
  const grad = g.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2);
  grad.addColorStop(0, 'rgba(0,0,0,0.55)');
  grad.addColorStop(0.6, 'rgba(0,0,0,0.22)');
  grad.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, S, S);
  const tex = new THREE.CanvasTexture(c);
  return tex;
}

// ------------------------------------------------------------------
// Painel de sinal: placa de sala, aviso, cartaz corporativo.
// ------------------------------------------------------------------
export function signTexture(text, accentHex = 0x35f0d8) {
  const W = 512;
  const H = 256;
  const c = document.createElement('canvas');
  c.width = W; c.height = H;
  const g = c.getContext('2d');

  g.fillStyle = '#0b0f14';
  g.fillRect(0, 0, W, H);
  g.strokeStyle = hex(accentHex);
  g.lineWidth = 6;
  g.strokeRect(8, 8, W - 16, H - 16);

  g.fillStyle = hex(accentHex);
  g.font = 'bold 44px ui-monospace, monospace';
  g.textAlign = 'center';
  g.textBaseline = 'middle';

  const lines = String(text).split('\n');
  const startY = H / 2 - (lines.length - 1) * 28;
  lines.forEach((line, i) => {
    g.fillText(line.toUpperCase(), W / 2, startY + i * 56);
  });

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

// ------------------------------------------------------------------
// Decalque de marca: patch circular escuro com a logo da facção, usado no
// peito do inimigo. Sem o fundo escuro a logo clara se perde na cor do corpo,
// que já e a cor da própria facção.
// ------------------------------------------------------------------
const DECAL_CACHE = new Map();

export function logoDecalTexture(faction, accentHex, tamanho = 128) {
  const key = `${faction}|${accentHex}`;
  if (DECAL_CACHE.has(key)) return DECAL_CACHE.get(key);

  const paths = LOGOS[faction];
  const c = makeCanvas(tamanho);
  const g = c.getContext('2d');
  const accent = hex(accentHex);
  const meio = tamanho / 2;

  g.fillStyle = 'rgba(6, 10, 16, 0.88)';
  g.beginPath();
  g.arc(meio, meio, meio - 4, 0, Math.PI * 2);
  g.fill();
  g.strokeStyle = accent;
  g.lineWidth = 5;
  g.stroke();

  if (paths) {
    const tam = tamanho * 0.56;
    g.fillStyle = accent;
    g.save();
    g.translate(meio - tam / 2, meio - tam / 2);
    g.scale(tam / VIEWBOX, tam / VIEWBOX);
    for (const d of paths) g.fill(new Path2D(d));
    g.restore();
  }

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  DECAL_CACHE.set(key, tex);
  return tex;
}

// ------------------------------------------------------------------
// Textura solida: usada nas barras de vida dos inimigos.
// ------------------------------------------------------------------
export function solidTexture() {
  const c = makeCanvas(8);
  const g = c.getContext('2d');
  g.fillStyle = '#ffffff';
  g.fillRect(0, 0, 8, 8);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

// ------------------------------------------------------------------
// Placa de identificacao do inimigo: emblema da facção + nome do modelo.
// Sem isso o jogador não sabe contra quem esta lutando, e num jogo em que a
// identidade do modelo define o comportamento isso é informação de combate.
// ------------------------------------------------------------------
const PLATE_CACHE = new Map();
const PLATE_FONTE = 'bold 40px ui-monospace, monospace';

// Canvas reaproveitado só para medir texto: a largura da placa depende do nome.
let _medidor = null;
function medirTexto(texto) {
  if (!_medidor) _medidor = document.createElement('canvas').getContext('2d');
  _medidor.font = PLATE_FONTE;
  return _medidor.measureText(texto).width;
}

export function nameplateTexture(name, faction, accentHex) {
  const key = `${name}|${faction}`;
  if (PLATE_CACHE.has(key)) return PLATE_CACHE.get(key);

  const H = 96;
  const PAD = 18;
  const TAM_EMBLEMA = 54;
  const GAP = 16;

  // A largura do painel e medida a partir do nome. Antes era sempre 512, com o
  // texto ocupando só a metade esquerda, e como o sprite e centralizado no
  // inimigo a placa aparecia deslocada para o lado do corpo.
  const label = String(name).toUpperCase();
  const texto = label.length > 20 ? label.slice(0, 19) + '.' : label;
  const W = Math.round(PAD + TAM_EMBLEMA + GAP + medirTexto(texto) + PAD);

  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const g = c.getContext('2d');
  const accent = hex(accentHex);

  // fundo do painel
  g.fillStyle = 'rgba(5, 9, 14, 0.78)';
  g.fillRect(0, 0, W, H);
  g.strokeStyle = accent;
  g.lineWidth = 4;
  g.strokeRect(3, 3, W - 6, H - 6);

  // Emblema: a logo real da marca, reduzida a path data. Cada facção carrega o
  // simbolo de quem ela representa, que é a informação mais rápida que o
  // jogador tem para saber contra o que esta lutando.
  const cx = PAD + TAM_EMBLEMA / 2;
  const cy = H / 2;
  const paths = LOGOS[faction];
  g.fillStyle = accent;

  if (paths) {
    g.save();
    g.translate(cx - TAM_EMBLEMA / 2, cy - TAM_EMBLEMA / 2);
    g.scale(TAM_EMBLEMA / VIEWBOX, TAM_EMBLEMA / VIEWBOX);
    for (const d of paths) g.fill(new Path2D(d));
    g.restore();
  } else {
    // Facção sem marca registrada (os Sentinelas de Sistema): simbolo próprio.
    const r = 24;
    g.lineWidth = 6;
    g.strokeStyle = accent;
    g.beginPath();
    g.rect(cx - r * 0.8, cy - r * 0.8, r * 1.6, r * 1.6);
    g.stroke();
    g.font = 'bold 30px ui-monospace, monospace';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText('!', cx, cy + 1);
  }

  // nome do modelo
  g.textAlign = 'left';
  g.textBaseline = 'middle';
  g.fillStyle = '#e8f4f2';
  g.font = PLATE_FONTE;
  g.fillText(texto, PAD + TAM_EMBLEMA + GAP, cy + 1);

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;

  // o cache não pode crescer sem limite: nomes de fine-tune são infinitos
  if (PLATE_CACHE.size > 48) {
    const first = PLATE_CACHE.keys().next().value;
    const old = PLATE_CACHE.get(first);
    if (old && old.dispose) old.dispose();
    PLATE_CACHE.delete(first);
  }
  PLATE_CACHE.set(key, tex);
  return tex;
}

export { hex as hexString };