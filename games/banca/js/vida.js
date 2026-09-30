// A vida de uma mesa montada.
//
// O roteador (main.js) cria uma vida cada vez que monta uma mesa e a mata
// quando o jogador sai, inclusive no meio de uma rodada. Tudo o que a mesa
// agenda passa por aqui, e por isso nada da mesa velha roda depois da saída:
//
//   espera(ms), seguir(p)   morta a vida, não se cumprem nunca: o async que
//                           aguardava fica parado e vira lixo, sem finally e sem
//                           pintar numa tela que já saiu da página;
//   depois(ms, fn)          setTimeout que a morte cancela;
//   quadro(fn)              requestAnimationFrame que a morte cancela;
//   ouvir(alvo, tipo, fn)   ouvinte na janela ou no documento que a morte
//                           desliga (os do DOM da mesa morrem junto com ele);
//   redimensionar(el, fn)   ResizeObserver que a morte desconecta;
//   congelar()              segura o saldo do topo enquanto as fichas voam e
//                           devolve quem solta; a morte solta o que ficou preso;
//   aoMorrer(fn)            o resto: parar um som, guardar a fase da roda.
//
// Dinheiro não passa por aqui. Cada sessão liquida a rodada, saldo e Livro,
// no próprio sorteio, antes da primeira animação: sair no meio só corta a
// encenação. provas/sair.mjs confere as duas metades.

export function criarVida({ congelarSaldo = () => () => {} } = {}) {
  const controle = new AbortController();
  const timers = new Set();
  const quadros = new Set();
  const solturas = new Set();
  const finais = [];
  let viva = true;

  const vida = {
    get viva() { return viva; },
    sinal: controle.signal,

    espera(ms) {
      return new Promise(resolver => { vida.depois(ms, resolver); });
    },

    seguir(promessa) {
      return new Promise((resolver, rejeitar) => {
        Promise.resolve(promessa).then(v => { if (viva) resolver(v); }, e => { if (viva) rejeitar(e); });
      });
    },

    depois(ms, fn) {
      if (!viva) return 0;
      const id = setTimeout(() => { timers.delete(id); if (viva) fn(); }, ms);
      timers.add(id);
      return id;
    },

    cancelar(id) {
      clearTimeout(id);
      timers.delete(id);
    },

    quadro(fn) {
      if (!viva) return 0;
      const id = requestAnimationFrame(t => { quadros.delete(id); if (viva) fn(t); });
      quadros.add(id);
      return id;
    },

    ouvir(alvo, tipo, fn, opcoes = {}) {
      if (viva) alvo.addEventListener(tipo, fn, { ...opcoes, signal: controle.signal });
    },

    redimensionar(el, fn) {
      const ro = new ResizeObserver(() => { if (viva) fn(); });
      ro.observe(el);
      finais.push(() => ro.disconnect());
    },

    congelar() {
      if (!viva) return () => {};
      const liberar = congelarSaldo();
      const soltar = () => {
        if (!solturas.delete(soltar)) return;
        liberar();
      };
      solturas.add(soltar);
      return soltar;
    },

    aoMorrer(fn) {
      finais.push(fn);
    },

    matar() {
      if (!viva) return;
      viva = false;
      controle.abort();
      for (const id of timers) clearTimeout(id);
      timers.clear();
      for (const id of quadros) cancelAnimationFrame(id);
      quadros.clear();
      for (const soltar of [...solturas]) soltar();
      for (const fn of finais.splice(0)) {
        try { fn(); } catch (e) { console.error(e); }
      }
    },
  };
  return vida;
}
