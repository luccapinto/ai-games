// Teclado, mouse e toque virando os comandos que o jogo entende.
//
// Este arquivo existe por um defeito: o mapeamento de entrada morava em
// `main.js`, que e o unico arquivo que `provas.mjs` nao importa. Resultado: o
// mouse e as setas ficaram **invertidos** e nenhuma das 36 provas podia ver,
// porque o sinal do eixo estava fora da fronteira de teste. Agora a conversao e
// um modulo sem DOM, e ha prova em cima dela.
//
// A convencao, escrita aqui porque e ela que se inverteu:
//
//   `ang` cresce no sentido anti-horario, e frente e (cos ang, sin ang).
//   A DIREITA da tela e, portanto, (sin ang, -cos ang) — produto vetorial de
//   frente com o "para cima" do mundo (0,0,1).
//
//   Logo: mouse para a direita tem de DIMINUIR `ang`, e a tecla de andar para a
//   direita tem de empurrar o corpo no sentido (sin, -cos).

export const SENSIBILIDADE = 0.0022;

// Quanto o olhar gira quando o mouse anda `movimentoX` pixels. O sinal negativo
// e o conserto: com `+`, arrastar o mouse para a direita virava a camera para a
// esquerda.
export function giroDoMouse(movimentoX, sensibilidade = SENSIBILIDADE) {
  return -movimentoX * sensibilidade;
}

// Mouse para cima (movimentoY negativo) levanta a mira. Sem inversao: quem quer
// invertido inverte no sistema, e a maioria nao quer.
export function inclinacaoDoMouse(movimentoY, sensibilidade = SENSIBILIDADE) {
  return -movimentoY * sensibilidade * 0.8;
}

// Conversao pura de teclas para comandos: e isto que a prova exercita.
export function comandosDeTeclas(teclas, toque = {}) {
  const tem = (...codigos) => codigos.some(c => teclas.has(c));
  return {
    frente: tem('KeyW', 'ArrowUp') || !!toque.frente,
    tras: tem('KeyS', 'ArrowDown') || !!toque.tras,
    esq: tem('KeyA', 'ArrowLeft') || !!toque.esq,
    dir: tem('KeyD', 'ArrowRight') || !!toque.dir,
    correr: tem('ShiftLeft', 'ShiftRight') || !!toque.correr,
    atirar: tem('Space') || !!toque.atirar,
  };
}

export function criarEntrada(palco, tela) {
  const teclas = new Set();
  const toque = {};
  const pulsos = {
    usar: false, recarregar: false, trocar: false, lanterna: false, pausa: false,
  };
  let mouseApertado = false;
  let giro = 0;
  let inclinacao = 0;
  let dedoDeOlhar = null;

  window.addEventListener('keydown', (ev) => {
    if (ev.repeat) return;
    teclas.add(ev.code);
    if (ev.code === 'KeyE') pulsos.usar = true;
    if (ev.code === 'KeyR') pulsos.recarregar = true;
    if (ev.code === 'KeyQ' || ev.code === 'Digit1' || ev.code === 'Digit2') pulsos.trocar = true;
    if (ev.code === 'KeyF') pulsos.lanterna = true;
    if (ev.code === 'Escape') pulsos.pausa = true;
    if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(ev.code)) {
      ev.preventDefault();
    }
  });
  window.addEventListener('keyup', ev => teclas.delete(ev.code));
  window.addEventListener('blur', () => { teclas.clear(); mouseApertado = false; });

  tela.addEventListener('mousedown', (ev) => {
    if (document.pointerLockElement !== tela) {
      tela.requestPointerLock?.();
      return;
    }
    if (ev.button === 0) mouseApertado = true;
  });
  window.addEventListener('mouseup', () => { mouseApertado = false; });
  window.addEventListener('mousemove', (ev) => {
    if (document.pointerLockElement !== tela) return;
    giro += giroDoMouse(ev.movementX || 0);
    inclinacao += inclinacaoDoMouse(ev.movementY || 0);
  });

  for (const botao of palco.querySelectorAll('[data-controle]')) {
    const qual = botao.dataset.controle;
    const liga = (ev) => {
      ev.preventDefault();
      toque[qual] = true;
      if (qual === 'usar') pulsos.usar = true;
      if (qual === 'recarregar') pulsos.recarregar = true;
    };
    const desliga = (ev) => { ev.preventDefault(); toque[qual] = false; };
    botao.addEventListener('touchstart', liga, { passive: false });
    botao.addEventListener('touchend', desliga, { passive: false });
    botao.addEventListener('touchcancel', desliga, { passive: false });
    botao.addEventListener('mousedown', liga);
    botao.addEventListener('mouseup', desliga);
    botao.addEventListener('mouseleave', desliga);
  }

  // No celular, arrastar na tela olha em volta: unico jeito de mirar sem mouse.
  tela.addEventListener('touchstart', (ev) => {
    const dedo = ev.changedTouches[0];
    dedoDeOlhar = { id: dedo.identifier, x: dedo.clientX, y: dedo.clientY };
  }, { passive: true });
  tela.addEventListener('touchmove', (ev) => {
    if (!dedoDeOlhar) return;
    for (const dedo of ev.changedTouches) {
      if (dedo.identifier !== dedoDeOlhar.id) continue;
      giro += giroDoMouse(dedo.clientX - dedoDeOlhar.x, SENSIBILIDADE * 2.2);
      inclinacao += inclinacaoDoMouse(dedo.clientY - dedoDeOlhar.y, SENSIBILIDADE * 2);
      dedoDeOlhar.x = dedo.clientX;
      dedoDeOlhar.y = dedo.clientY;
    }
  }, { passive: true });
  tela.addEventListener('touchend', () => { dedoDeOlhar = null; }, { passive: true });

  return {
    ler() {
      const comandos = comandosDeTeclas(teclas, toque);
      comandos.atirar = comandos.atirar || mouseApertado;
      comandos.recarregar = pulsos.recarregar;
      comandos.usar = pulsos.usar;
      comandos.trocar = pulsos.trocar;
      comandos.girar = giro;
      comandos.inclinar = inclinacao;
      pulsos.recarregar = false;
      pulsos.usar = false;
      pulsos.trocar = false;
      giro = 0;
      inclinacao = 0;
      return comandos;
    },
    consumir(nome) {
      const valor = pulsos[nome];
      pulsos[nome] = false;
      return valor;
    },
    limpar() { teclas.clear(); mouseApertado = false; giro = 0; inclinacao = 0; },
  };
}
