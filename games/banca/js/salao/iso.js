// Projeção isométrica 2:1 e primitivas de desenho para o salão.
//
// Coordenadas do mundo em ladrilhos: x cresce para a direita-baixo da tela,
// y para a esquerda-baixo, z para cima. A câmera olha do canto (+x, +y) para
// o canto do fundo (0, 0), que fica no alto da tela.

export const LX = 64;   // meia largura do ladrilho em px
export const LY = 32;   // meia altura do ladrilho em px
export const LZ = 60;   // px por ladrilho de altura

export function iso(x, y, z = 0) {
  return [(x - y) * LX, (x + y) * LY - z * LZ];
}

export function caminho(g, pontos) {
  g.beginPath();
  for (let i = 0; i < pontos.length; i++) {
    const [x, y, z] = pontos[i];
    const [sx, sy] = iso(x, y, z);
    if (i === 0) g.moveTo(sx, sy); else g.lineTo(sx, sy);
  }
  g.closePath();
}

// Caixa alinhada aos eixos: base em (x, y, z), medidas w (em x), d (em y), h.
// Desenha as três faces visíveis: topo, a face y+d (esquerda) e a face x+w (direita).
export function caixa(g, x, y, z, w, d, h, cores) {
  const { topo, esq, dir, linha } = cores;
  caminho(g, [[x, y + d, z], [x + w, y + d, z], [x + w, y + d, z + h], [x, y + d, z + h]]);
  g.fillStyle = esq; g.fill();
  if (linha) { g.strokeStyle = linha; g.lineWidth = 1; g.stroke(); }
  caminho(g, [[x + w, y, z], [x + w, y + d, z], [x + w, y + d, z + h], [x + w, y, z + h]]);
  g.fillStyle = dir; g.fill();
  if (linha) g.stroke();
  caminho(g, [[x, y, z + h], [x + w, y, z + h], [x + w, y + d, z + h], [x, y + d, z + h]]);
  g.fillStyle = topo; g.fill();
  if (linha) g.stroke();
}

// Círculo no plano horizontal: elipse alinhada aos eixos da tela.
export const RX = Math.SQRT2 * LX;
export const RY = Math.SQRT2 * LY;

export function elipse(g, x, y, z, r, preencher = null, contorno = null, largura = 1) {
  const [sx, sy] = iso(x, y, z);
  g.beginPath();
  g.ellipse(sx, sy, r * RX, r * RY, 0, 0, Math.PI * 2);
  if (preencher) { g.fillStyle = preencher; g.fill(); }
  if (contorno) { g.strokeStyle = contorno; g.lineWidth = largura; g.stroke(); }
}

// Cilindro de pé: lateral (metade da frente) e tampa.
export function cilindro(g, x, y, z, r, h, cores) {
  const [sx, sy0] = iso(x, y, z);
  const sy1 = sy0 - h * LZ;
  const rx = r * RX, ry = r * RY;
  g.beginPath();
  g.moveTo(sx - rx, sy1);
  g.lineTo(sx - rx, sy0);
  g.ellipse(sx, sy0, rx, ry, 0, Math.PI, 0, true);
  g.lineTo(sx + rx, sy1);
  g.ellipse(sx, sy1, rx, ry, 0, 0, Math.PI, false);
  g.closePath();
  if (cores.lado instanceof Function) g.fillStyle = cores.lado(g, sx - rx, sx + rx);
  else g.fillStyle = cores.lado;
  g.fill();
  g.beginPath();
  g.ellipse(sx, sy1, rx, ry, 0, 0, Math.PI * 2);
  g.fillStyle = cores.topo; g.fill();
  if (cores.aro) { g.strokeStyle = cores.aro; g.lineWidth = cores.aroLargura ?? 2; g.stroke(); }
}

// Gradiente horizontal de lateral: claro na direita (luz vem do canto da frente).
export function gradLado(g, x0, x1, escuro, claro) {
  const gr = g.createLinearGradient(x0, 0, x1, 0);
  gr.addColorStop(0, escuro);
  gr.addColorStop(0.65, claro);
  gr.addColorStop(1, escuro);
  return gr;
}

// Transformação para escrever num plano de parede. Parede do fundo direito
// (plano y = 0): o texto corre ao longo de +x. Parede do fundo esquerdo
// (plano x = 0): corre ao longo de -y, para ser lido da esquerda para a direita.
export function planoParede(g, parede, x, y, z, escala = 1) {
  const [sx, sy] = iso(x, y, z);
  const m = g.getTransform();
  if (parede === 'direita') g.transform(escala, 0.5 * escala, 0, escala, sx, sy);
  else g.transform(escala, -0.5 * escala, 0, escala, sx, sy);
  return m;
}

// Plano do chão: desenhar em coordenadas de ladrilho (u = x, v = y) com
// tamanho real, para padrões e reflexos.
export function planoChao(g) {
  g.transform(LX, LY, -LX, LY, 0, 0);
}

export function pontoNoPoligono(px, py, pol) {
  let dentro = false;
  for (let i = 0, j = pol.length - 1; i < pol.length; j = i++) {
    const [xi, yi] = pol[i], [xj, yj] = pol[j];
    if (((yi > py) !== (yj > py)) && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi) dentro = !dentro;
  }
  return dentro;
}

// Envoltória convexa (monotone chain) para a área clicável de cada mesa.
export function envoltoria(pontos) {
  const p = pontos.map(q => [q[0], q[1]]).sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const cruz = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const baixo = [];
  for (const q of p) { while (baixo.length >= 2 && cruz(baixo.at(-2), baixo.at(-1), q) <= 0) baixo.pop(); baixo.push(q); }
  const cima = [];
  for (const q of p.slice().reverse()) { while (cima.length >= 2 && cruz(cima.at(-2), cima.at(-1), q) <= 0) cima.pop(); cima.push(q); }
  return baixo.slice(0, -1).concat(cima.slice(0, -1));
}
