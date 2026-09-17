// Teclado e toque virando os mesmos cinco comandos que a IA usa: volante,
// acelerador, freio, drift e item. O jogo nao sabe quem esta dirigindo.
//
// O volante do teclado tem rampa: tecla e liga-desliga, e volante de verdade
// nao pula de zero a tudo. Aqui a rampa importa mais do que num carro comum,
// porque o volante deste kart pede VELOCIDADE DE GIRO: pulo de zero a tudo
// viraria um pedido de giro impossivel em um quadro, e o teto de deriva
// responderia com um puxao.

// 7,5 e nao 5,2: a rampa e o tempo que a tecla leva para virar volante cheio, e
// 0,19 s de espera somados ao tempo de resposta do chassi era o que fazia o kart
// parecer pesado no teclado.
const RAMPA = 7.5;
const CENTRAGEM = 9;

export function criarEntrada(palco) {
  const teclas = new Set();
  let volante = 0;
  const pulsos = { pausa: false, reiniciar: false, linha: false, camera: false };
  const toque = {
    esquerda: false, direita: false, acelerar: false, frear: false,
    drift: false, item: false,
  };

  window.addEventListener('keydown', (ev) => {
    if (ev.repeat) return;
    teclas.add(ev.code);
    if (ev.code === 'KeyP' || ev.code === 'Escape') pulsos.pausa = true;
    if (ev.code === 'KeyR') pulsos.reiniciar = true;
    if (ev.code === 'KeyL') pulsos.linha = true;
    if (ev.code === 'KeyC' || ev.code === 'KeyN') pulsos.camera = true;
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
    // `volante` positivo pede giro anti-horario, que com a camera atras do kart
    // e a ESQUERDA da tela. A versao 2D deste jogo desenhava o mundo com y para
    // baixo, onde anti-horario aparecia como direita; quando o jogo virou 3D com
    // z para cima, a mao virou e o volante ficou invertido. E o defeito que o
    // dono do repo sentiu na primeira curva.
    let alvo = 0;
    if (tem('ArrowLeft', 'KeyA') || toque.esquerda) alvo += 1;
    if (tem('ArrowRight', 'KeyD') || toque.direita) alvo -= 1;

    if (alvo === 0) {
      const passo = CENTRAGEM * dt;
      volante = Math.abs(volante) <= passo ? 0 : volante - Math.sign(volante) * passo;
    } else {
      volante = Math.max(-1, Math.min(1, volante + alvo * RAMPA * dt));
    }

    const acelerador = (tem('ArrowUp', 'KeyW') || toque.acelerar) ? 1 : 0;
    const freio = (tem('ArrowDown', 'KeyS') || toque.frear) ? 1 : 0;
    // Drift em qualquer shift: quem dirige com a mao esquerda no A/D usa o
    // shift esquerdo, quem usa as setas alcanca o direito.
    const drift = tem('ShiftLeft', 'ShiftRight') || toque.drift;
    const item = tem('Space', 'KeyE') || toque.item;
    return { volante, acelerador, freio, drift, item };
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
