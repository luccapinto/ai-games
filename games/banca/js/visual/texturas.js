// Texturas procedurais geradas em canvas na abertura: feltro, grão de filme,
// latão escovado e mármore. Nenhum arquivo de imagem.

export function aleatorioSemeado(semente = 1) {
  let a = semente >>> 0;
  return function () {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function tela(w, h) {
  const c = typeof OffscreenCanvas !== 'undefined' && !globalThis.document
    ? new OffscreenCanvas(w, h)
    : Object.assign(document.createElement('canvas'), { width: w, height: h });
  return c;
}

// Feltro: fibras curtas claras e escuras sobre ruído fino, emendável.
export function feltro(tam = 256, semente = 7) {
  const c = tela(tam, tam);
  const g = c.getContext('2d');
  const r = aleatorioSemeado(semente);
  const img = g.createImageData(tam, tam);
  for (let i = 0; i < img.data.length; i += 4) {
    const v = r();
    const claro = v > 0.5;
    img.data[i] = claro ? 255 : 0;
    img.data[i + 1] = claro ? 255 : 0;
    img.data[i + 2] = claro ? 240 : 0;
    img.data[i + 3] = Math.floor(Math.abs(v - 0.5) * 2 * 34);
  }
  g.putImageData(img, 0, 0);
  g.lineCap = 'round';
  for (let i = 0; i < 1400; i++) {
    const x = r() * tam, y = r() * tam;
    const a = r() * Math.PI * 2, l = 2 + r() * 7;
    const claro = r() > 0.45;
    g.strokeStyle = claro ? `rgba(255,250,225,${0.05 + r() * 0.07})` : `rgba(0,0,0,${0.08 + r() * 0.1})`;
    g.lineWidth = 0.5 + r() * 0.6;
    for (const dx of [-tam, 0, tam]) for (const dy of [-tam, 0, tam]) {
      g.beginPath();
      g.moveTo(x + dx, y + dy);
      g.quadraticCurveTo(x + dx + Math.cos(a + 0.6) * l * 0.5, y + dy + Math.sin(a + 0.6) * l * 0.5, x + dx + Math.cos(a) * l, y + dy + Math.sin(a) * l);
      g.stroke();
    }
  }
  return c;
}

export function grao(tam = 180, semente = 3) {
  const c = tela(tam, tam);
  const g = c.getContext('2d');
  const r = aleatorioSemeado(semente);
  const img = g.createImageData(tam, tam);
  for (let i = 0; i < img.data.length; i += 4) {
    const v = Math.floor(r() * 255);
    img.data[i] = img.data[i + 1] = img.data[i + 2] = v;
    img.data[i + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  return c;
}

// Latão escovado: listras horizontais de brilho variável.
export function lataoEscovado(w = 512, h = 64, semente = 5) {
  const c = tela(w, h);
  const g = c.getContext('2d');
  const r = aleatorioSemeado(semente);
  const base = g.createLinearGradient(0, 0, 0, h);
  base.addColorStop(0, '#f1dca0');
  base.addColorStop(0.25, '#c9a45c');
  base.addColorStop(0.55, '#8f6f35');
  base.addColorStop(0.8, '#d4b06a');
  base.addColorStop(1, '#6f5427');
  g.fillStyle = base;
  g.fillRect(0, 0, w, h);
  for (let i = 0; i < 900; i++) {
    const y = r() * h;
    const x = r() * w;
    const l = 20 + r() * 160;
    g.strokeStyle = r() > 0.5 ? `rgba(255,245,210,${r() * 0.18})` : `rgba(60,40,10,${r() * 0.16})`;
    g.lineWidth = 0.6;
    g.beginPath(); g.moveTo(x, y); g.lineTo(x + l, y); g.stroke();
  }
  return c;
}

export function paraUrl(c) {
  return c.toDataURL('image/png');
}

// Aplica as texturas como variáveis de CSS: o feltro de todas as mesas e o
// grão que passa por cima de tudo.
export function instalarTexturasCss(raiz = document.documentElement) {
  raiz.style.setProperty('--tex-feltro', `url(${paraUrl(feltro())})`);
  raiz.style.setProperty('--tex-grao', `url(${paraUrl(grao())})`);
  raiz.style.setProperty('--tex-latao', `url(${paraUrl(lataoEscovado())})`);
}
