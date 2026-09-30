// Efeitos de mesa: fichas que voam do banco até a aposta (e de volta), tela
// que respira no prêmio grande e a câmera que se aproxima na revelação.

import { svgFicha, fichasParaVoo } from './fichas.js';
import * as som from '../som.js';

let camada = null;

function camadaVoo() {
  return camada ??= document.getElementById('voo');
}

export function centro(alvo) {
  if (!alvo) return { x: innerWidth / 2, y: innerHeight / 2 };
  if (typeof alvo.x === 'number' && typeof alvo.y === 'number' && !(alvo instanceof Element)) return alvo;
  const r = alvo.getBoundingClientRect();
  return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
}

const espera = ms => new Promise(r => setTimeout(r, ms));

// Voo em arco com leve rotação; cada ficha sai um pouco depois da anterior e
// bate com som ao chegar. Resolve quando a última pousa.
export async function voarFichas({ de, para, valor, atraso = 0, duracao = 620, arco = 90, tamanho = 38, maximo = 7, somFinal = true }) {
  if (!(valor > 0)) return;
  const layer = camadaVoo();
  if (!layer) return;
  const a = centro(de), b = centro(para);
  const lista = fichasParaVoo(valor, maximo);
  if (atraso) await espera(atraso);
  const voos = lista.map((v, i) => {
    const el = document.createElement('div');
    el.className = 'ficha-voo';
    el.style.width = el.style.height = tamanho + 'px';
    el.style.margin = `${-tamanho / 2}px 0 0 ${-tamanho / 2}px`;
    el.innerHTML = svgFicha(v);
    layer.append(el);
    const dx = b.x - a.x, dy = b.y - a.y;
    const jit = (Math.random() - 0.5) * 10;
    const alto = Math.min(arco, 30 + Math.hypot(dx, dy) * 0.25);
    const giro = (Math.random() - 0.5) * 70;
    const quadros = [];
    for (let k = 0; k <= 10; k++) {
      const t = k / 10;
      const x = a.x + dx * t + jit * Math.sin(t * Math.PI);
      const y = a.y + dy * t - alto * Math.sin(t * Math.PI) - i * 3.2 * t;
      const s = 1 + 0.18 * Math.sin(t * Math.PI);
      quadros.push({ transform: `translate(${x}px, ${y}px) rotate(${giro * t}deg) scale(${s})`, opacity: k === 0 ? 0 : 1 });
    }
    const anim = el.animate(quadros, { duration: duracao, delay: i * 55, easing: 'cubic-bezier(.35,.1,.25,1)', fill: 'both' });
    return anim.finished.then(() => {
      if (somFinal) som.ficha(1, 0.7);
      el.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 160, fill: 'forwards' }).finished.then(() => el.remove());
    });
  });
  await Promise.all(voos);
}

// A tela respira: um pulso de brilho e escala no palco, proporcional ao prêmio.
export function respirar(el, nivel = 1) {
  if (!el) return;
  const s = 1 + Math.min(0.035, 0.008 * nivel);
  el.animate([
    { transform: 'scale(1)', filter: 'brightness(1)' },
    { transform: `scale(${s})`, filter: `brightness(${1 + 0.12 * Math.min(nivel, 4)})` },
    { transform: 'scale(1)', filter: 'brightness(1)' },
  ], { duration: 900 + nivel * 200, easing: 'cubic-bezier(.3,.7,.3,1)', iterations: nivel >= 4 ? 3 : 1 });
}

// Aproxima a câmera de um ponto do palco e volta: usado na revelação.
export function aproximar(palco, ponto, { escala = 1.08, duracao = 1400 } = {}) {
  if (!palco) return;
  const r = palco.getBoundingClientRect();
  const p = centro(ponto);
  const ox = ((p.x - r.left) / r.width) * 100, oy = ((p.y - r.top) / r.height) * 100;
  palco.style.transformOrigin = `${ox}% ${oy}%`;
  return palco.animate([
    { transform: 'scale(1)' },
    { transform: `scale(${escala})`, offset: 0.35 },
    { transform: `scale(${escala})`, offset: 0.7 },
    { transform: 'scale(1)' },
  ], { duration: duracao, easing: 'cubic-bezier(.4,0,.2,1)' }).finished.catch(() => {});
}

// Chuva de faíscas de latão num canvas temporário: prêmio grande.
export function faiscas(ponto, quantidade = 60) {
  const c = document.createElement('canvas');
  const dpr = Math.min(2, devicePixelRatio || 1);
  c.width = innerWidth * dpr; c.height = innerHeight * dpr;
  Object.assign(c.style, { position: 'fixed', inset: '0', width: '100%', height: '100%', pointerEvents: 'none', zIndex: 75 });
  document.body.append(c);
  const g = c.getContext('2d');
  g.scale(dpr, dpr);
  const o = centro(ponto);
  const ps = Array.from({ length: quantidade }, () => {
    const a = Math.random() * Math.PI * 2, v = 3 + Math.random() * 9;
    return { x: o.x, y: o.y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 5, vida: 1, cor: Math.random() < 0.7 ? '#f1dca0' : (Math.random() < 0.5 ? '#ff3d6e' : '#35f0d8'), r: 1.5 + Math.random() * 2.5 };
  });
  let ultimo = performance.now();
  function quadro(t) {
    const dt = Math.min(0.05, (t - ultimo) / 1000) * 60; ultimo = t;
    g.clearRect(0, 0, innerWidth, innerHeight);
    g.globalCompositeOperation = 'lighter';
    let vivos = 0;
    for (const p of ps) {
      if (p.vida <= 0) continue;
      vivos++;
      p.vy += 0.28 * dt; p.vx *= 0.99; p.x += p.vx * dt; p.y += p.vy * dt; p.vida -= 0.012 * dt;
      g.globalAlpha = Math.max(0, p.vida);
      g.fillStyle = p.cor;
      g.beginPath(); g.arc(p.x, p.y, p.r, 0, Math.PI * 2); g.fill();
    }
    if (vivos) requestAnimationFrame(quadro); else c.remove();
  }
  requestAnimationFrame(quadro);
}
