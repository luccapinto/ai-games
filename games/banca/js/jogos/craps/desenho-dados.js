// Desenho dos dados em canvas: projeção oblíqua (vista de cima e um pouco do
// lado do jogador), faces sombreadas pela luz do abajur e pips desenhados no
// plano de cada face, então eles saem em perspectiva certa em qualquer giro.

import { FACES, qrot, MESA } from './dados.js';

const PIPS = {
  1: [[0, 0]], 2: [[-0.5, -0.5], [0.5, 0.5]], 3: [[-0.5, -0.5], [0, 0], [0.5, 0.5]],
  4: [[-0.5, -0.5], [0.5, -0.5], [-0.5, 0.5], [0.5, 0.5]],
  5: [[-0.5, -0.5], [0.5, -0.5], [0, 0], [-0.5, 0.5], [0.5, 0.5]],
  6: [[-0.5, -0.5], [-0.5, 0], [-0.5, 0.5], [0.5, -0.5], [0.5, 0], [0.5, 0.5]],
};
const VISTA = (() => { const v = [0, 0.5, 0.866]; return v; })();
const LUZ = (() => { const v = [-0.35, -0.45, 0.82]; const l = Math.hypot(...v); return v.map(x => x / l); })();
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];

function tangentes(eixo) {
  if (eixo[2]) return [[1, 0, 0], [0, 1, 0]];
  if (eixo[0]) return [[0, 1, 0], [0, 0, 1]];
  return [[1, 0, 0], [0, 0, 1]];
}

export function criarDesenhoDados(canvas) {
  const g = canvas.getContext('2d');
  let dpr = 1, W = 0, H = 0;
  let area = { x0: 0, x1: 100, y0: 0, y1: 100 };

  function dimensionar(novaArea) {
    dpr = Math.min(2, devicePixelRatio || 1);
    const r = canvas.getBoundingClientRect();
    W = r.width; H = r.height;
    canvas.width = Math.max(1, Math.round(W * dpr));
    canvas.height = Math.max(1, Math.round(H * dpr));
    if (novaArea) area = novaArea;
  }

  const unidade = () => (area.x1 - area.x0) / (MESA.x1 - MESA.x0);
  function projetar([x, y, z]) {
    const u = unidade();
    return [area.x0 + x * u, area.y0 + (y / (MESA.y1 - MESA.y0)) * (area.y1 - area.y0) - z * u * 0.86];
  }

  function desenharDado({ p, q }) {
    const u = unidade();
    // sombra no feltro
    const [sx, sy] = projetar([p[0] + p[2] * 0.25, p[1] + p[2] * 0.2, 0]);
    const alfa = 0.42 * (1 - Math.min(1, (p[2] - 0.5) / 5));
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    const gr = g.createRadialGradient(sx, sy, 0, sx, sy, u * 0.95);
    gr.addColorStop(0, `rgba(0,0,0,${alfa})`); gr.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = gr;
    g.beginPath(); g.ellipse(sx, sy, u * 0.95, u * 0.7, 0, 0, Math.PI * 2); g.fill();
    // faces visíveis
    const faces = [];
    for (const f of FACES) {
      const n = qrot(q, f.eixo);
      if (dot(n, VISTA) <= 0.02) continue;
      const [t1, t2] = tangentes(f.eixo);
      const c = qrot(q, f.eixo.map(x => x * 0.5));
      const e1 = qrot(q, t1.map(x => x * 0.5)), e2 = qrot(q, t2.map(x => x * 0.5));
      const centro = [p[0] + c[0], p[1] + c[1], p[2] + c[2]];
      const pc = projetar(centro);
      const p1 = projetar([centro[0] + e1[0], centro[1] + e1[1], centro[2] + e1[2]]);
      const p2 = projetar([centro[0] + e2[0], centro[1] + e2[1], centro[2] + e2[2]]);
      faces.push({ f, n, pc, a: [p1[0] - pc[0], p1[1] - pc[1]], b: [p2[0] - pc[0], p2[1] - pc[1]], luz: 0.5 + 0.5 * Math.max(0, dot(n, LUZ)) });
    }
    faces.sort((x, y) => dot(x.n, VISTA) - dot(y.n, VISTA));
    for (const fc of faces) {
      g.setTransform(dpr * fc.a[0], dpr * fc.a[1], dpr * fc.b[0], dpr * fc.b[1], dpr * fc.pc[0], dpr * fc.pc[1]);
      const l = fc.luz;
      g.fillStyle = `rgba(${Math.round(205 * l)},${Math.round(24 * l)},${Math.round(44 * l)},.95)`;
      g.beginPath();
      if (g.roundRect) g.roundRect(-1, -1, 2, 2, 0.22); else g.rect(-1, -1, 2, 2);
      g.fill();
      g.fillStyle = `rgba(255,${Math.round(120 + 80 * l)},${Math.round(130 + 60 * l)},${0.16 * l})`;
      g.beginPath(); g.rect(-0.9, -0.9, 1.8, 0.5); g.fill();
      g.fillStyle = `rgba(${Math.round(245 * (0.75 + 0.25 * l))},${Math.round(240 * (0.75 + 0.25 * l))},${Math.round(232 * (0.75 + 0.25 * l))},1)`;
      for (const [x, y] of PIPS[fc.f.n]) { g.beginPath(); g.arc(x, y, 0.17, 0, Math.PI * 2); g.fill(); }
    }
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function desenhar(estado) {
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.clearRect(0, 0, canvas.width, canvas.height);
    if (!estado) return;
    const ordem = estado.dados.slice().sort((a, b) => (a.p[1] + a.p[2] * 0.4) - (b.p[1] + b.p[2] * 0.4));
    for (const d of ordem) desenharDado(d);
  }

  function pontoDe(p) {
    const [x, y] = projetar(p);
    const r = canvas.getBoundingClientRect();
    return { x: r.left + x, y: r.top + y };
  }

  return { dimensionar, desenhar, pontoDe };
}
