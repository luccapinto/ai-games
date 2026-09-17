// Teclado, mouse e toque virando o mesmo objeto de entrada que o robo de
// provas.mjs monta a mao. Oito direcoes, correr, atacar, conversar, beber.
//
// A mira e separada do andar de proposito: `ler` devolve a entrada do jogo,
// que e a mesma que o robo usa e nao sabe o que e camera; `lerVisao` devolve
// o quanto a camera girou desde o quadro anterior. E main.js que gira a
// direcao de andar pelo angulo da camera antes de entregar para o jogo.

import { entradaNula } from './jogo.js';

export function criarEntrada(palco, tela) {
  const teclas = new Set();
  const pulsos = { pausa: false, mapa: false, diario: false, loja: false };
  const toque = { x: 0, y: 0, atacar: false, interagir: false, beber: false, correr: false };
  const visao = { dx: 0, dy: 0, zoom: 0 };
  let arrastando = false;

  window.addEventListener('keydown', (ev) => {
    if (ev.repeat) return;
    teclas.add(ev.code);
    if (ev.code === 'KeyP' || ev.code === 'Escape') pulsos.pausa = true;
    if (ev.code === 'KeyM') pulsos.mapa = true;
    if (ev.code === 'KeyJ') pulsos.diario = true;
    if (ev.code === 'KeyL') pulsos.loja = true;
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(ev.code)) {
      ev.preventDefault();
    }
  });
  window.addEventListener('keyup', (ev) => teclas.delete(ev.code));
  window.addEventListener('blur', () => teclas.clear());

  // Manche de toque: o polegar esquerdo anda, os botoes da direita agem.
  const area = palco.querySelector('#manche');
  if (area) {
    let centro = null;
    const comecar = (ev) => {
      const t = ev.changedTouches ? ev.changedTouches[0] : ev;
      centro = { x: t.clientX, y: t.clientY };
      ev.preventDefault();
    };
    const mover = (ev) => {
      if (!centro) return;
      const t = ev.changedTouches ? ev.changedTouches[0] : ev;
      const dx = (t.clientX - centro.x) / 46;
      const dy = (t.clientY - centro.y) / 46;
      const n = Math.hypot(dx, dy);
      toque.x = n > 1 ? dx / n : dx;
      toque.y = n > 1 ? dy / n : dy;
      toque.correr = n > 0.9;
      ev.preventDefault();
    };
    const soltar = (ev) => {
      centro = null;
      toque.x = 0;
      toque.y = 0;
      toque.correr = false;
      ev.preventDefault();
    };
    area.addEventListener('touchstart', comecar, { passive: false });
    area.addEventListener('touchmove', mover, { passive: false });
    area.addEventListener('touchend', soltar, { passive: false });
    area.addEventListener('touchcancel', soltar, { passive: false });
  }

  // Mira: no computador e o mouse (com trava de ponteiro quando o navegador
  // deixa, e arrasto quando nao deixa); no celular e o polegar direito.
  if (tela) {
    tela.addEventListener('mousedown', (ev) => {
      if (ev.button !== 0) return;
      arrastando = true;
      if (!document.pointerLockElement && tela.requestPointerLock) {
        try { tela.requestPointerLock(); } catch { /* sem trava de ponteiro */ }
      }
    });
    window.addEventListener('mouseup', () => { arrastando = false; });
    window.addEventListener('mousemove', (ev) => {
      if (!arrastando && document.pointerLockElement !== tela) return;
      visao.dx += ev.movementX || 0;
      visao.dy += ev.movementY || 0;
    });
    tela.addEventListener('wheel', (ev) => {
      visao.zoom += ev.deltaY;
      ev.preventDefault();
    }, { passive: false });
    tela.addEventListener('contextmenu', ev => ev.preventDefault());
  }

  const areaDeMira = palco.querySelector('#olhar');
  if (areaDeMira) {
    let ultimo = null;
    const comecar = (ev) => {
      const t = ev.changedTouches[0];
      ultimo = { x: t.clientX, y: t.clientY };
      ev.preventDefault();
    };
    const mover = (ev) => {
      if (!ultimo) return;
      const t = ev.changedTouches[0];
      visao.dx += t.clientX - ultimo.x;
      visao.dy += t.clientY - ultimo.y;
      ultimo = { x: t.clientX, y: t.clientY };
      ev.preventDefault();
    };
    const soltar = (ev) => { ultimo = null; ev.preventDefault(); };
    areaDeMira.addEventListener('touchstart', comecar, { passive: false });
    areaDeMira.addEventListener('touchmove', mover, { passive: false });
    areaDeMira.addEventListener('touchend', soltar, { passive: false });
    areaDeMira.addEventListener('touchcancel', soltar, { passive: false });
  }

  for (const botao of palco.querySelectorAll('[data-acao]')) {
    const acao = botao.dataset.acao;
    const apertar = (ev) => {
      ev.preventDefault();
      if (acao in toque) toque[acao] = true;
      else if (acao in pulsos) pulsos[acao] = true;
    };
    botao.addEventListener('touchstart', apertar, { passive: false });
    botao.addEventListener('mousedown', apertar);
  }

  function ler() {
    const e = entradaNula();
    const tem = (...codigos) => codigos.some(c => teclas.has(c));
    if (tem('KeyW', 'ArrowUp')) e.y -= 1;
    if (tem('KeyS', 'ArrowDown')) e.y += 1;
    if (tem('KeyA', 'ArrowLeft')) e.x -= 1;
    if (tem('KeyD', 'ArrowRight')) e.x += 1;
    e.x += toque.x;
    e.y += toque.y;
    e.correr = tem('ShiftLeft', 'ShiftRight') || toque.correr;
    e.atacar = tem('Space') || toque.atacar;
    e.interagir = tem('KeyE') || toque.interagir;
    e.beber = tem('KeyQ') || toque.beber;

    toque.atacar = false;
    toque.interagir = false;
    toque.beber = false;
    return e;
  }

  function consumir(nome) {
    const valor = pulsos[nome];
    pulsos[nome] = false;
    return valor;
  }

  // Consome a mira acumulada desde o quadro anterior.
  function lerVisao() {
    const saida = { dx: visao.dx, dy: visao.dy, zoom: visao.zoom };
    visao.dx = 0;
    visao.dy = 0;
    visao.zoom = 0;
    return saida;
  }

  return {
    ler,
    lerVisao,
    consumir,
    limpar: () => { teclas.clear(); arrastando = false; },
  };
}
