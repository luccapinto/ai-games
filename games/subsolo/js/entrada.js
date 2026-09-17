// Teclado, mouse e toque convergindo para o mesmo objeto `entrada` que
// `jogo.passo` recebe. O jogo nao sabe se quem o dirige e uma pessoa, um dedo
// ou o robo de provas.mjs — e e isso que deixa o robo valer como prova.

import { entradaNula } from './jogo.js';
import { CONFIG } from './regras.js';

const TECLA_ARMA = { Digit1: 1, Digit2: 2, Digit3: 3, Digit4: 4 };

export function criarEntrada(canvas, palco) {
  const teclas = new Set();
  let giroMouse = 0;
  let travado = false;
  const pulsos = { lanterna: false, usar: false, trocar: null, pausa: false, reiniciar: false };
  const toque = { frente: 0, lado: 0, giro: 0, atirar: false, correndo: false, agachado: false };

  const sensibilidade = 0.0022;

  function baixo(ev) {
    if (ev.repeat) return;
    teclas.add(ev.code);
    if (ev.code === 'KeyF') pulsos.lanterna = true;
    if (ev.code === 'KeyE' || ev.code === 'Space') pulsos.usar = true;
    if (ev.code === 'KeyP' || ev.code === 'Escape') pulsos.pausa = true;
    if (ev.code === 'KeyR') pulsos.reiniciar = true;
    if (TECLA_ARMA[ev.code]) pulsos.trocar = TECLA_ARMA[ev.code];
    if (ev.code === 'KeyQ') pulsos.trocar = 'anterior';
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(ev.code)) {
      ev.preventDefault();
    }
  }

  function alto(ev) {
    teclas.delete(ev.code);
  }

  window.addEventListener('keydown', baixo);
  window.addEventListener('keyup', alto);
  window.addEventListener('blur', () => teclas.clear());

  document.addEventListener('pointerlockchange', () => {
    travado = document.pointerLockElement === canvas;
  });
  canvas.addEventListener('mousemove', (ev) => {
    if (travado) giroMouse += ev.movementX * sensibilidade;
  });
  canvas.addEventListener('mousedown', (ev) => {
    if (ev.button === 0) teclas.add('Mouse0');
    if (ev.button === 2) pulsos.usar = true;
  });
  window.addEventListener('mouseup', (ev) => {
    if (ev.button === 0) teclas.delete('Mouse0');
  });
  canvas.addEventListener('contextmenu', (ev) => ev.preventDefault());
  canvas.addEventListener('wheel', (ev) => {
    pulsos.trocar = ev.deltaY > 0 ? 'proxima' : 'anterior';
    ev.preventDefault();
  }, { passive: false });

  // ------------------------------------------------------------------ toque
  // Dois polegares: o da esquerda anda, o da direita olha e atira. Arrastar
  // na metade direita gira; tocar sem arrastar atira.
  const dedos = new Map();
  function posicaoRelativa(ev) {
    const r = canvas.getBoundingClientRect();
    return { x: (ev.clientX - r.left) / r.width, y: (ev.clientY - r.top) / r.height };
  }
  canvas.addEventListener('touchstart', (ev) => {
    for (const t of ev.changedTouches) {
      const p = posicaoRelativa(t);
      dedos.set(t.identifier, { inicio: p, atual: p, direita: p.x > 0.5, andou: 0 });
    }
    ev.preventDefault();
  }, { passive: false });
  canvas.addEventListener('touchmove', (ev) => {
    for (const t of ev.changedTouches) {
      const d = dedos.get(t.identifier);
      if (!d) continue;
      const p = posicaoRelativa(t);
      if (d.direita) giroMouse += (p.x - d.atual.x) * 3.2;
      d.andou += Math.hypot(p.x - d.atual.x, p.y - d.atual.y);
      d.atual = p;
      if (!d.direita) {
        toque.lado = Math.max(-1, Math.min(1, (p.x - d.inicio.x) * 8));
        toque.frente = Math.max(-1, Math.min(1, (d.inicio.y - p.y) * 8));
        toque.correndo = toque.frente > 0.75;
      }
    }
    ev.preventDefault();
  }, { passive: false });
  function soltar(ev) {
    for (const t of ev.changedTouches) {
      const d = dedos.get(t.identifier);
      if (d && d.direita && d.andou < 0.04) toque.atirar = true;
      if (d && !d.direita) { toque.frente = 0; toque.lado = 0; toque.correndo = false; }
      dedos.delete(t.identifier);
    }
    ev.preventDefault();
  }
  canvas.addEventListener('touchend', soltar, { passive: false });
  canvas.addEventListener('touchcancel', soltar, { passive: false });

  for (const botao of palco.querySelectorAll('[data-acao]')) {
    const acao = botao.dataset.acao;
    const apertar = (ev) => {
      ev.preventDefault();
      if (acao === 'lanterna') pulsos.lanterna = true;
      else if (acao === 'usar') pulsos.usar = true;
      else if (acao === 'trocar') pulsos.trocar = 'proxima';
      else if (acao === 'agachar') toque.agachado = !toque.agachado;
      else if (acao === 'atirar') toque.atirar = true;
    };
    botao.addEventListener('touchstart', apertar, { passive: false });
    botao.addEventListener('mousedown', apertar);
  }

  function ler(dt) {
    const e = entradaNula();
    const tem = (...codigos) => codigos.some(c => teclas.has(c));

    if (tem('KeyW', 'ArrowUp')) e.frente += 1;
    if (tem('KeyS', 'ArrowDown')) e.frente -= 1;
    if (tem('KeyA')) e.lado -= 1;
    if (tem('KeyD')) e.lado += 1;
    if (tem('ArrowLeft')) e.girar -= CONFIG.velGiro * dt;
    if (tem('ArrowRight')) e.girar += CONFIG.velGiro * dt;
    e.frente += toque.frente;
    e.lado += toque.lado;
    e.frente = Math.max(-1, Math.min(1, e.frente));
    e.lado = Math.max(-1, Math.min(1, e.lado));

    e.girar += giroMouse;
    giroMouse = 0;

    e.correndo = tem('ShiftLeft', 'ShiftRight') || toque.correndo;
    e.agachado = tem('ControlLeft', 'ControlRight', 'KeyC') || toque.agachado;
    e.atirar = tem('Mouse0') || toque.atirar;
    e.lanterna = pulsos.lanterna;
    e.usar = pulsos.usar;
    e.trocar = pulsos.trocar;

    toque.atirar = false;
    pulsos.lanterna = false;
    pulsos.usar = false;
    pulsos.trocar = null;
    return e;
  }

  function consumir(nome) {
    const valor = pulsos[nome];
    pulsos[nome] = false;
    return valor;
  }

  return {
    ler,
    consumir,
    travar: () => canvas.requestPointerLock && canvas.requestPointerLock(),
    destravar: () => document.exitPointerLock && document.exitPointerLock(),
    get travado() { return travado; },
    limpar: () => { teclas.clear(); giroMouse = 0; },
  };
}
