// O salão: câmera, camada estática em cache, luz e fumaça por quadro, e o
// clique nas mesas. Arrastar move a câmera; passar o mouse acende a mesa e
// mostra a placa com os números dela; clicar senta.

import { iso, LX, LY, LZ, RX, RY, pontoNoPoligono } from './iso.js';
import {
  criarCena, desenharEstatico, criarNeons, brilhoNeon, criarLuzes, desenharAbajur,
  desenharRotor, desenharTelaNiquel, desenharTelaPoquer, LIMITES, MUNDO,
} from './cena.js';
import { tela } from '../visual/texturas.js';

const ENQ = { x0: LIMITES.x0 + 60, x1: LIMITES.x1 - 40, y0: LIMITES.y0 + 70, y1: LIMITES.y1 - 50 };

export function criarSalao({ canvas, placa, aoEscolher, aoFocar, numeros, alturaTopo = () => 56, alturaBase = () => 90 }) {
  const g = canvas.getContext('2d', { alpha: false });
  const cena = criarCena();
  let dpr = 1, escala = 0.7, escalaMin = 0.4, escalaMax = 1.6;
  let cam = { x: 0, y: 0 };
  let estatico = null, neons = [], luzes = null, cones = [], pocas = [];
  let ativo = false, raf = 0, t0 = performance.now();
  let hover = null, foco = null, entrando = null;
  let intro = 0;
  const medidas = { desenho: [], quadros: 0 };

  const fumacas = Array.from({ length: 18 }, (_, i) => ({
    x: ENQ.x0 + Math.random() * (ENQ.x1 - ENQ.x0), y: ENQ.y0 + 200 + Math.random() * 500,
    vx: 4 + Math.random() * 6, s: 0.8 + Math.random() * 1.6, fase: i,
  }));
  const poeira = Array.from({ length: 70 }, () => ({ l: Math.floor(Math.random() * 4), u: Math.random(), v: Math.random(), f: Math.random() * 6 }));

  function dimensionar() {
    dpr = Math.min(2, devicePixelRatio || 1);
    const w = innerWidth, h = innerHeight;
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    const altUtil = h - alturaTopo() - alturaBase() * 0.4;
    const ajusteAltura = altUtil / (ENQ.y1 - ENQ.y0);
    const ajusteLargura = w / (ENQ.x1 - ENQ.x0);
    escalaMin = Math.min(ajusteAltura, ajusteLargura) * 0.95;
    // No retrato o salão inteiro fica pequeno demais: aproxima e deixa arrastar.
    escala = w < h ? Math.max(ajusteAltura * 1.12, 0.62) : Math.max(ajusteAltura, Math.min(ajusteLargura, 0.95));
    escalaMax = Math.max(escala * 1.8, 1.2);
    renderizarCache();
    centrarEm(w < h ? iso(6.2, 4.8, 0.2) : iso(8.2, 5.2, 0.8));
  }

  function renderizarCache() {
    const k = escala * dpr;
    const W = ENQ.x1 - ENQ.x0 + 120, H = ENQ.y1 - ENQ.y0 + 120;
    estatico = tela(Math.ceil(W * k), Math.ceil(H * k));
    const e = estatico.getContext('2d');
    e.fillStyle = '#050405';
    e.fillRect(0, 0, estatico.width, estatico.height);
    e.setTransform(k, 0, 0, k, (-ENQ.x0 + 60) * k, (-ENQ.y0 + 60) * k);
    const tIni = performance.now();
    desenharEstatico(e, cena);
    medidas.estatico = performance.now() - tIni;
    neons = criarNeons(k);
    luzes = criarLuzes(k);
    cones = cena.lampadas.map(l => luzes.cone(l.r));
    pocas = cena.lampadas.map(l => luzes.poca(l.r * RX * 1.25, l.r * RY * 1.25));
  }

  function limitarCamera() {
    const w = innerWidth / escala, h = innerHeight / escala;
    const topo = alturaTopo() / escala;
    const minX = ENQ.x0 - 40, maxX = ENQ.x1 + 40 - w;
    const minY = ENQ.y0 - topo - 10, maxY = ENQ.y1 + 60 - h;
    cam.x = maxX < minX ? (ENQ.x0 + ENQ.x1) / 2 - w / 2 : Math.max(minX, Math.min(maxX, cam.x));
    cam.y = maxY < minY ? (ENQ.y0 + ENQ.y1) / 2 - h / 2 - topo / 2 : Math.max(minY, Math.min(maxY, cam.y));
  }

  function centrarEm([wx, wy]) {
    cam.x = wx - innerWidth / escala / 2;
    cam.y = wy - innerHeight / escala / 2;
    limitarCamera();
  }

  const paraMundo = (px, py) => [px / escala + cam.x, py / escala + cam.y];
  const paraTela = (wx, wy) => [(wx - cam.x) * escala, (wy - cam.y) * escala];

  function mesaEm(px, py) {
    const [wx, wy] = paraMundo(px, py);
    // do mais da frente para o mais do fundo: a frente cobre
    const ids = Object.values(cena.clicaveis).reverse();
    for (const c of ids) for (const pol of c.poligonos) if (pontoNoPoligono(wx, wy, pol)) return c.id;
    return null;
  }

  // ---------------------------------------------------------------- quadro

  function quadro(agora) {
    if (!ativo) return;
    raf = requestAnimationFrame(quadro);
    const t = (agora - t0) / 1000;
    const inicio = performance.now();
    desenhar(t);
    const ms = performance.now() - inicio;
    medidas.quadros++;
    medidas.desenho.push(ms);
    if (medidas.desenho.length > 240) medidas.desenho.shift();
  }

  function desenhar(t) {
    let esc = escala, cx = cam.x, cy = cam.y;
    if (entrando) {
      const p = Math.min(1, (performance.now() - entrando.inicio) / entrando.duracao);
      const e = p * p * (3 - 2 * p);
      esc = escala * (1 + e * 1.4);
      // o ponto da mesa desliza da posição dele até o centro da tela enquanto a câmera aproxima
      const [ax, ay] = entrando.alvo;
      const p0x = (ax - cam.x) * escala, p0y = (ay - cam.y) * escala;
      const px = p0x + (innerWidth / 2 - p0x) * e, py = p0y + (innerHeight / 2 - p0y) * e;
      cx = ax - px / esc;
      cy = ay - py / esc;
    }
    const k = esc * dpr;
    const kc = escala * dpr;
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.fillStyle = '#050405';
    g.fillRect(0, 0, canvas.width, canvas.height);
    // camada estática: recorta a parte visível do cache
    const razao = esc / escala;
    const sx = (cx - ENQ.x0 + 60) * kc, sy = (cy - ENQ.y0 + 60) * kc;
    g.imageSmoothingEnabled = true;
    g.drawImage(estatico, sx, sy, canvas.width / razao, canvas.height / razao, 0, 0, canvas.width, canvas.height);

    g.setTransform(k, 0, 0, k, -cx * k, -cy * k);
    // rotor da roleta e telas das máquinas
    desenharRotor(g, cena.roleta.roda, 0.92 + 0.18, t * 0.5);
    for (const mq of cena.maquinas) desenharTelaNiquel(g, mq, t, hover === 'niquel' || foco === 'niquel' || (mq.i === Math.floor(t / 3) % 5));
    cena.bar.maquinas.forEach((mx, i) => desenharTelaPoquer(g, mx, t, i));

    // luz
    g.globalCompositeOperation = 'lighter';
    const ligar = Math.min(1, intro);
    cena.lampadas.forEach((l, i) => {
      const aceso = ligar * (hover === l.mesa || foco === l.mesa ? 1.35 : 1) * (0.96 + 0.04 * Math.sin(t * 1.3 + i));
      const p = pocas[i];
      const [px, py] = iso(l.x, l.y, l.alvo);
      g.globalAlpha = 0.85 * aceso;
      g.drawImage(p.c, px - p.rx, py - p.ry, p.rx * 2, p.ry * 2);
      const [fx, fy] = iso(l.x, l.y, 0);
      g.globalAlpha = 0.4 * aceso;
      g.drawImage(p.c, fx - p.rx * 1.3, fy - p.ry * 1.3, p.rx * 2.6, p.ry * 2.6);
      const c = cones[i];
      const [lx, ly] = iso(l.x, l.y, l.z);
      g.globalAlpha = 0.9 * aceso;
      g.drawImage(c.c, lx - c.w / 2, ly, c.w, (l.z - l.alvo) * LZ);
    });
    // poeira dentro dos cones
    g.fillStyle = '#ffe9c0';
    for (const p of poeira) {
      const l = cena.lampadas[p.l];
      const v = (p.v + t * 0.015) % 1;
      const [lx, ly] = iso(l.x, l.y, l.z);
      const larg = 22 + v * (l.r * RX - 10);
      const x = lx + (p.u - 0.5) * 2 * larg + Math.sin(t * 0.4 + p.f) * 6;
      const y = ly + v * (l.z - l.alvo) * LZ;
      g.globalAlpha = ligar * 0.35 * (0.5 + 0.5 * Math.sin(t * 2 + p.f)) * (1 - v * 0.6);
      g.fillRect(x, y, 1.6, 1.6);
    }
    // arandelas
    for (const a of cena.arandelas) {
      const pos = a.parede === 'direita' ? iso(a.u, 0, 2.75) : iso(0, MUNDO.Y - a.u, 2.75);
      const b = luzes.brilhoQuente;
      g.globalAlpha = ligar * 0.9;
      g.drawImage(b.c, pos[0] - b.r, pos[1] - b.r * 0.9, b.r * 2, b.r * 2);
      if (a.parede === 'direita' && a.u <= 6) {
        const [bx, by] = iso(a.u, 0.05, 0);
        g.globalAlpha = ligar * 0.22;
        g.drawImage(b.c, bx - 18, by, 36, 150);
      }
    }
    // neon aceso e o reflexo dele no mármore
    for (const n of neons) {
      const br = brilhoNeon(n, t) * Math.min(1, Math.max(0, intro * 1.6 - 0.4 - n.fase * 0.03));
      g.globalAlpha = br;
      g.drawImage(n.c, n.sx, n.sy, n.w, n.h);
    }
    const [rx0, ry0] = iso(1.3, 0.25, 0);
    const wash = luzes.brilhoRosa;
    g.globalAlpha = 0.55 * brilhoNeon(neons[0], t) * ligar;
    g.drawImage(wash.c, rx0 - 20, ry0 - 30, 330, 190);
    const [cx2, cy2] = iso(0.25, 3.3, 0);
    g.globalAlpha = 0.4 * ligar;
    g.drawImage(luzes.brilhoCiano.c, cx2 - 200, cy2 - 40, 330, 190);
    // luz colorida das telas no chão
    for (const mq of cena.maquinas) {
      const [mx, my] = iso(mq.x + 1.3, mq.y + 0.45, 0);
      g.globalAlpha = 0.35 * ligar;
      g.drawImage(mq.i % 2 ? luzes.brilhoRosa.c : luzes.brilhoCiano.c, mx - 60, my - 28, 120, 56);
    }
    // fumaça
    for (const f of fumacas) {
      f.x += f.vx * (1 / 60);
      if (f.x > ENQ.x1 + 200) f.x = ENQ.x0 - 200;
      const r = luzes.fumaca.r * f.s;
      let perto = 0;
      for (const l of cena.lampadas) {
        const [lx, ly] = iso(l.x, l.y, (l.z + l.alvo) / 2);
        perto = Math.max(perto, 1 - Math.min(1, Math.hypot(f.x - lx, f.y - ly) / 260));
      }
      g.globalAlpha = (0.35 + perto * 1.4) * ligar;
      g.drawImage(luzes.fumaca.c, f.x - r, f.y + Math.sin(t * 0.2 + f.fase) * 18 - r, r * 2, r * 2);
    }
    g.globalAlpha = 1;
    g.globalCompositeOperation = 'source-over';
    for (const l of cena.lampadas) desenharAbajur(g, l);

    // contorno da mesa sob o cursor
    const alvo = hover ?? foco;
    if (alvo && !entrando) {
      const c = cena.clicaveis[alvo];
      g.save();
      g.strokeStyle = 'rgba(232,207,143,.85)';
      g.lineWidth = 1.6 / esc;
      g.shadowColor = 'rgba(255,214,140,.9)';
      g.shadowBlur = 14 * dpr;
      g.setLineDash([6 / esc, 5 / esc]);
      g.lineDashOffset = -t * 20;
      for (const pol of c.poligonos) {
        g.beginPath();
        pol.forEach(([x, y], i) => i ? g.lineTo(x, y) : g.moveTo(x, y));
        g.closePath();
        g.stroke();
      }
      g.restore();
    }
    if (intro < 1) {
      g.setTransform(1, 0, 0, 1, 0, 0);
      g.fillStyle = `rgba(0,0,0,${Math.max(0, 1 - intro * 1.3)})`;
      g.fillRect(0, 0, canvas.width, canvas.height);
      intro += 1 / 90;
    }
    atualizarPlaca();
  }

  // ---------------------------------------------------------------- placa

  let placaDe = null;
  async function mostrarPlaca(id) {
    if (placaDe === id) return;
    placaDe = id;
    if (!id) { placa.classList.remove('visivel'); return; }
    const conteudo = await numeros(id);
    if (placaDe !== id) return;
    placa.innerHTML = conteudo;
    placa.classList.add('visivel');
    atualizarPlaca();
  }

  function atualizarPlaca() {
    if (!placaDe) return;
    const c = cena.clicaveis[placaDe];
    const [px, py] = paraTela(...c.ancora);
    placa.style.left = Math.max(130, Math.min(innerWidth - 130, px)) + 'px';
    placa.style.top = Math.max(alturaTopo() + placa.offsetHeight + 24, py) + 'px';
  }

  // ---------------------------------------------------------------- entrada

  let arrasto = null;
  const toques = new Map();
  let pinca = null;

  canvas.addEventListener('pointerdown', e => {
    canvas.setPointerCapture(e.pointerId);
    toques.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (toques.size === 2) {
      const [a, b] = [...toques.values()];
      pinca = { d: Math.hypot(a.x - b.x, a.y - b.y), escala, cx: (a.x + b.x) / 2, cy: (a.y + b.y) / 2 };
      arrasto = null;
      return;
    }
    arrasto = { x: e.clientX, y: e.clientY, cx: cam.x, cy: cam.y, moveu: false, tipo: e.pointerType };
  });

  canvas.addEventListener('pointermove', e => {
    if (toques.has(e.pointerId)) toques.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pinca && toques.size === 2) {
      const [a, b] = [...toques.values()];
      const d = Math.hypot(a.x - b.x, a.y - b.y);
      zoom(pinca.escala * d / pinca.d, pinca.cx, pinca.cy);
      return;
    }
    if (arrasto) {
      const dx = e.clientX - arrasto.x, dy = e.clientY - arrasto.y;
      if (Math.hypot(dx, dy) > 6) arrasto.moveu = true;
      if (arrasto.moveu) {
        canvas.classList.add('arrastando');
        cam.x = arrasto.cx - dx / escala;
        cam.y = arrasto.cy - dy / escala;
        limitarCamera();
      }
      return;
    }
    if (e.pointerType === 'mouse') {
      const id = mesaEm(e.clientX, e.clientY);
      if (id !== hover) {
        hover = id;
        canvas.classList.toggle('sobre', !!id);
        mostrarPlaca(id ?? foco);
      }
    }
  });

  function soltar(e) {
    toques.delete(e.pointerId);
    if (toques.size < 2) pinca = null;
    canvas.classList.remove('arrastando');
    if (!arrasto) return;
    const a = arrasto;
    arrasto = null;
    if (a.moveu || entrando) return;
    const id = mesaEm(e.clientX, e.clientY);
    if (!id) { focar(null); return; }
    // No toque, o primeiro toque acende a mesa e mostra a placa; o segundo senta.
    if (a.tipo !== 'mouse' && foco !== id) { focar(id, true); return; }
    sentar(id);
  }
  canvas.addEventListener('pointerup', soltar);
  canvas.addEventListener('pointercancel', e => { toques.delete(e.pointerId); arrasto = null; pinca = null; });
  canvas.addEventListener('pointerleave', e => { if (e.pointerType === 'mouse') { hover = null; mostrarPlaca(foco); canvas.classList.remove('sobre'); } });
  canvas.addEventListener('wheel', e => {
    e.preventDefault();
    if (e.ctrlKey) { zoom(escala * Math.exp(-e.deltaY * 0.01), e.clientX, e.clientY); return; }
    cam.x += e.deltaX / escala;
    cam.y += e.deltaY / escala;
    limitarCamera();
  }, { passive: false });

  function zoom(nova, px, py) {
    nova = Math.max(escalaMin, Math.min(escalaMax, nova));
    if (Math.abs(nova - escala) < 1e-3) return;
    const [wx, wy] = paraMundo(px, py);
    escala = nova;
    cam.x = wx - px / escala;
    cam.y = wy - py / escala;
    limitarCamera();
    clearTimeout(zoom.t);
    zoom.t = setTimeout(renderizarCache, 160);
  }

  function focar(id, deslizar = false) {
    foco = id;
    mostrarPlaca(id);
    aoFocar?.(id);
    if (id && deslizar) deslizarPara(cena.clicaveis[id].ancora);
  }

  function deslizarPara([wx, wy]) {
    const de = { ...cam };
    const alvo = { x: wx - innerWidth / escala / 2, y: wy - innerHeight / escala / 2 + 40 / escala };
    const ini = performance.now();
    function passo() {
      const p = Math.min(1, (performance.now() - ini) / 450);
      const e = 1 - Math.pow(1 - p, 3);
      cam.x = de.x + (alvo.x - de.x) * e;
      cam.y = de.y + (alvo.y - de.y) * e;
      limitarCamera();
      if (p < 1 && ativo) requestAnimationFrame(passo);
    }
    requestAnimationFrame(passo);
  }

  function sentar(id) {
    if (entrando) return;
    const c = cena.clicaveis[id];
    placa.classList.remove('visivel');
    placaDe = null;
    entrando = { id, alvo: c.ancora, inicio: performance.now(), duracao: 650 };
    const [px, py] = paraTela(...c.ancora);
    setTimeout(() => {
      entrando = null;
      aoEscolher(id, { x: px, y: py });
    }, 620);
  }

  // teclado: setas movem, Enter senta na mesa focada
  const ordem = ['roleta', 'blackjack', 'niquel', 'videopoquer', 'bacara', 'craps', 'caixa'];
  function tecla(e) {
    if (!ativo || document.querySelector('.cortina')) return;
    const passo = 60 / escala;
    if (e.key === 'ArrowLeft') cam.x -= passo;
    else if (e.key === 'ArrowRight') cam.x += passo;
    else if (e.key === 'ArrowUp') cam.y -= passo;
    else if (e.key === 'ArrowDown') cam.y += passo;
    else if (e.key === 'Tab') {
      e.preventDefault();
      const i = (ordem.indexOf(foco) + (e.shiftKey ? ordem.length - 1 : 1)) % ordem.length;
      focar(ordem[i], true);
      return;
    } else if (e.key === 'Enter' && foco) { sentar(foco); return; } else return;
    limitarCamera();
  }
  addEventListener('keydown', tecla);
  addEventListener('resize', () => { if (ativo) dimensionar(); else precisaDimensionar = true; });
  let precisaDimensionar = true;

  return {
    cena,
    medidas,
    ligar() {
      if (ativo) return;
      ativo = true;
      if (precisaDimensionar || !estatico) { dimensionar(); precisaDimensionar = false; }
      canvas.hidden = false;
      t0 = performance.now() - 20000;
      raf = requestAnimationFrame(quadro);
    },
    desligar() {
      ativo = false;
      cancelAnimationFrame(raf);
      canvas.hidden = true;
      placa.classList.remove('visivel');
      placaDe = null; hover = null;
    },
    focar,
    sentar,
    reiniciarIntro() { intro = 0; },
    pularIntro() { intro = 1; },
    get foco() { return foco; },
    telaDe(id) { return paraTela(...cena.clicaveis[id].ancora); },
  };
}
