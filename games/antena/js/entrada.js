// Entrada do jogador. Teclado e toque caem no mesmo conjunto de estados, entao
// o resto do jogo nunca pergunta de onde veio o comando.

const MAPA = {
  ArrowLeft: 'esquerda', KeyA: 'esquerda',
  ArrowRight: 'direita', KeyD: 'direita',
  ArrowDown: 'baixo', KeyS: 'baixo',
  ArrowUp: 'cima', KeyW: 'cima',
  Space: 'pular',
  KeyJ: 'investida', ShiftLeft: 'investida', ShiftRight: 'investida', KeyK: 'investida',
  KeyR: 'recomecar',
  KeyP: 'pausa', Escape: 'pausa',
};

export class Entrada {
  constructor(alvo = window) {
    this.estado = Object.create(null);
    // "pressionado" e o que acabou de descer neste quadro. Pulo e investida
    // precisam da borda, nao do estado continuo: segurar espaco nao pode
    // significar pular sem parar.
    this.borda = Object.create(null);
    this.consumido = Object.create(null);

    this._down = e => {
      const acao = MAPA[e.code];
      if (!acao) return;
      // Seta e espaco rolam a pagina. Num jogo isso e a tela pulando embaixo
      // do jogador no meio de um salto.
      if (e.code.startsWith('Arrow') || e.code === 'Space') e.preventDefault();
      if (!this.estado[acao]) this.borda[acao] = true;
      this.estado[acao] = true;
    };
    this._up = e => {
      const acao = MAPA[e.code];
      if (!acao) return;
      this.estado[acao] = false;
    };
    // Perder o foco com uma tecla apertada deixava a sonda correndo sozinha
    // para sempre; solta tudo ao sair.
    this._blur = () => { this.estado = Object.create(null); };

    alvo.addEventListener('keydown', this._down, { passive: false });
    alvo.addEventListener('keyup', this._up);
    alvo.addEventListener('blur', this._blur);
  }

  ligarToque(raiz) {
    const botoes = raiz.querySelectorAll('[data-tecla]');
    botoes.forEach(botao => {
      const acao = botao.dataset.tecla;
      const liga = e => {
        e.preventDefault();
        if (!this.estado[acao]) this.borda[acao] = true;
        this.estado[acao] = true;
      };
      const desliga = e => { e.preventDefault(); this.estado[acao] = false; };
      botao.addEventListener('pointerdown', liga);
      botao.addEventListener('pointerup', desliga);
      botao.addEventListener('pointercancel', desliga);
      botao.addEventListener('pointerleave', desliga);
    });
  }

  ativo(acao) { return !!this.estado[acao]; }

  // Consome a borda: quem perguntar primeiro leva, e ninguem leva duas vezes.
  apertou(acao) {
    if (this.borda[acao]) { this.borda[acao] = false; return true; }
    return false;
  }

  // Chamado no fim do quadro logico, para a borda nao vazar para o proximo.
  virarQuadro() { this.borda = Object.create(null); }
}
