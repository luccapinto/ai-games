// Cartas numa mesa: sair do sapato, deslizar até o lugar, virar com
// perspectiva, mudar de lugar quando a mão se divide e ir para o descarte.
// Usado pelo blackjack, pelo bacará e pelo vídeo pôquer.

import { elementoCarta, definirFace } from './cartas.js';
import * as som from '../som.js';

const espera = ms => new Promise(r => setTimeout(r, ms));

export function criarPalcoCartas(container, { largura = () => 100 } = {}) {
  const cartas = new Set();

  function posicionar(el, { x, y, rot = 0, z = 1 }) {
    el.style.transform = `translate(${x}px, ${y}px) rotate(${rot}deg)`;
    el.style.zIndex = z;
    el._pos = { x, y, rot, z };
  }

  // Dá uma carta: nasce virada no ponto de origem, voa e vira no destino.
  // `oculta`: chega de costas e fica assim (a face nem entra no DOM).
  async function dar(c, { de, para, oculta = false, instantaneo = false, deitada = false, atrasoVirar = 60 }) {
    const l = largura();
    const el = elementoCarta(oculta ? 0 : c, { virada: true, largura: l });
    if (oculta) el.dataset.carta = '';
    el.classList.add('na-mesa');
    container.append(el);
    cartas.add(el);
    const alvo = { ...para, rot: (para.rot ?? 0) + (deitada ? 90 : 0) };
    if (instantaneo) {
      posicionar(el, alvo);
      if (!oculta) el.classList.remove('virada');
      return el;
    }
    posicionar(el, { x: de.x, y: de.y, rot: -24, z: 999 });
    void el.offsetWidth;
    som.carta();
    const anim = el.animate([
      { transform: `translate(${de.x}px, ${de.y}px) rotate(-24deg) scale(.92)` },
      { transform: `translate(${(de.x + alvo.x) / 2}px, ${(de.y + alvo.y) / 2 - 18}px) rotate(${alvo.rot - 8}deg) scale(1.03)`, offset: 0.6 },
      { transform: `translate(${alvo.x}px, ${alvo.y}px) rotate(${alvo.rot}deg) scale(1)` },
    ], { duration: 360, easing: 'cubic-bezier(.3,.6,.2,1)' });
    await anim.finished.catch(() => {});
    posicionar(el, alvo);
    if (!oculta) {
      await espera(atrasoVirar);
      el.classList.remove('virada');
      el.classList.add('reluz');
      som.virar();
      await espera(260);
    }
    return el;
  }

  async function revelar(el, c) {
    definirFace(el, c);
    void el.offsetWidth;
    el.classList.remove('virada');
    el.classList.add('reluz');
    som.virar();
    await espera(520);
  }

  async function mover(el, para, dur = 320) {
    const de = el._pos;
    const alvo = { ...de, ...para };
    const anim = el.animate([
      { transform: `translate(${de.x}px, ${de.y}px) rotate(${de.rot}deg)` },
      { transform: `translate(${alvo.x}px, ${alvo.y}px) rotate(${alvo.rot}deg)` },
    ], { duration: dur, easing: 'cubic-bezier(.3,.6,.2,1)' });
    posicionar(el, alvo);
    await anim.finished.catch(() => {});
  }

  // Recolhe tudo para o descarte, virando de costas no caminho.
  async function recolher(para, { atraso = 30 } = {}) {
    const lista = [...cartas];
    lista.forEach((el, i) => {
      setTimeout(() => {
        el.classList.add('virada');
        const de = el._pos;
        el.animate([
          { transform: `translate(${de.x}px, ${de.y}px) rotate(${de.rot}deg)` },
          { transform: `translate(${para.x}px, ${para.y}px) rotate(${-12 + Math.random() * 24}deg) scale(.86)`, opacity: 0.9 },
        ], { duration: 420, easing: 'cubic-bezier(.5,0,.3,1)', fill: 'forwards' }).finished.then(() => { el.remove(); cartas.delete(el); });
      }, i * atraso);
    });
    if (lista.length) som.carta(0.6);
    await espera(lista.length * atraso + 440);
  }

  function limpar() {
    for (const el of cartas) el.remove();
    cartas.clear();
  }

  return { dar, revelar, mover, recolher, limpar, posicionar, get cartas() { return cartas; } };
}
