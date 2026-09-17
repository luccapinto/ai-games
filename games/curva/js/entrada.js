// Teclado e toque virando os mesmos tres comandos que a IA usa: volante,
// acelerador, freio. O jogo nao sabe quem esta dirigindo.
//
// O volante do teclado tem rampa: tecla e liga-desliga, e volante de verdade
// nao pula de zero a tudo. Sem a rampa, dirigir no teclado e uma sucessao de
// rodopios — o carro deste jogo tem eixo traseiro de verdade.

const RAMPA = 4.2;
const CENTRAGEM = 6.5;

export function criarEntrada(palco) {
  const teclas = new Set();
  let volante = 0;
  const pulsos = { pausa: false, reiniciar: false, linha: false, camera: false };
  const toque = { esquerda: false, direita: false, acelerar: false, frear: false };

  window.addEventListener('keydown', (ev) => {
    if (ev.repeat) return;
    teclas.add(ev.code);
    if (ev.code === 'KeyP' || ev.code === 'Escape') pulsos.pausa = true;
    if (ev.code === 'KeyR') pulsos.reiniciar = true;
    if (ev.code === 'KeyL') pulsos.linha = true;
    if (ev.code === 'KeyN') pulsos.camera = true;
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(ev.code)) {
      ev.preventDefault();
    }
  });
  window.addEventListener('keyup', (ev) => teclas.delete(ev.code));
  window.addEventListener('blur', () => teclas.clear());

  for (const botao of palco.querySelectorAll('[data-controle]')) {
    const qual = botao.dataset.controle;
    const liga = (ev) => { ev.preventDefault(); toque[qual] = true; };
    const desliga = (ev) => { ev.preventDefault(); toque[qual] = false; };
    botao.addEventListener('touchstart', liga, { passive: false });
    botao.addEventListener('touchend', desliga, { passive: false });
    botao.addEventListener('touchcancel', desliga, { passive: false });
    botao.addEventListener('mousedown', liga);
    botao.addEventListener('mouseup', desliga);
    botao.addEventListener('mouseleave', desliga);
  }

  function ler(dt) {
    const tem = (...codigos) => codigos.some(c => teclas.has(c));
    let alvo = 0;
    if (tem('ArrowLeft', 'KeyA') || toque.esquerda) alvo -= 1;
    if (tem('ArrowRight', 'KeyD') || toque.direita) alvo += 1;

    if (alvo === 0) {
      const passo = CENTRAGEM * dt;
      volante = Math.abs(volante) <= passo ? 0 : volante - Math.sign(volante) * passo;
    } else {
      volante = Math.max(-1, Math.min(1, volante + alvo * RAMPA * dt));
    }

    const acelerador = (tem('ArrowUp', 'KeyW') || toque.acelerar) ? 1 : 0;
    const freio = (tem('ArrowDown', 'KeyS') || toque.frear) ? 1 : 0;
    const freioMao = tem('Space');
    return { volante, acelerador, freio, freioMao };
  }

  function consumir(nome) {
    const valor = pulsos[nome];
    pulsos[nome] = false;
    return valor;
  }

  return {
    ler,
    consumir,
    limpar: () => { teclas.clear(); volante = 0; },
  };
}
