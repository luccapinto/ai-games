// Um DOM de mentira, do tamanho exato que a casca do jogo precisa para RODAR.
//
// Isto existe por um defeito real, e o defeito diz para que serve o arquivo: o
// jogo tem uma regra boa - nenhum modulo de decisao toca em DOM, e por isso
// `provas.mjs` mede fisica, pista, IA e corrida inteira sem navegador. O preco
// escondido dessa regra e que `js/main.js`, o unico arquivo que fala com a tela,
// era o unico que NENHUMA prova carregava.
//
// Uma edicao minha apagou duas funcoes de `main.js` do jogo vizinho. As 41
// provas continuaram verdes, o `node --check` passou (sintaxe estava certa) e o
// jogo nao abria: o corpo do modulo jogava `carregarRecordes is not defined`
// antes de registrar o clique do menu. Quem descobriu foi o dono do repo,
// jogando.
//
// O que este arquivo permite provar: que o modulo da casca roda inteiro - todo
// identificador existe, todo import resolve, todo `getElementById` do corpo do
// modulo acontece. O que ele NAO prova: que a tela mostra a coisa certa. Para
// isso nao ha atalho, tem de abrir no navegador.
//
// Nao e mock de logica: nenhuma decisao do jogo passa por aqui. E uma tela de
// mentira para o modulo poder ser executado.

function elemento(id = '') {
  const el = {
    id,
    className: '',
    innerHTML: '',
    textContent: '',
    value: '',
    width: 1280,
    height: 800,
    style: new Proxy({}, { get: () => '', set: () => true }),
    classList: { add() {}, remove() {}, toggle() {}, contains: () => false },
    dataset: {},
    children: [],
    rows: [],
    appendChild(filho) { el.children.push(filho); return filho; },
    removeChild() {},
    addEventListener() {},
    removeEventListener() {},
    getBoundingClientRect: () => ({ x: 0, y: 0, left: 0, top: 0, width: 1280, height: 800 }),
    querySelectorAll: () => [],
    querySelector: () => null,
    requestPointerLock() {},
    focus() {},
    click() {},
    // WebGL de mentira: responde qualquer chamada e devolve 1 para as
    // constantes. Nenhum pixel sai daqui, e nao e disso que se trata.
    getContext: () => new Proxy({}, {
      get: (_, nome) => {
        if (nome === 'canvas') return el;
        if (typeof nome === 'string' && nome === nome.toUpperCase()) return 1;
        return () => new Proxy({}, { get: () => () => 1 });
      },
    }),
  };
  return el;
}

export function montarTelaDeMentira() {
  const documento = {
    getElementById: (id) => elemento(id),
    createElement: (tag) => elemento(tag),
    querySelectorAll: () => [],
    querySelector: () => null,
    addEventListener() {},
    removeEventListener() {},
    body: elemento('body'),
    documentElement: elemento('html'),
    pointerLockElement: null,
    exitPointerLock() {},
    hidden: false,
  };
  const armazenamento = { getItem: () => null, setItem() {}, removeItem() {} };
  const audio = class {
    constructor() {
      return new Proxy({}, {
        get: () => () => new Proxy({}, { get: () => () => 1 }),
      });
    }
  };
  const janela = {
    addEventListener() {},
    removeEventListener() {},
    devicePixelRatio: 1,
    innerWidth: 1280,
    innerHeight: 800,
    location: { search: '', href: 'http://mentira/' },
    matchMedia: () => ({ matches: false, addEventListener() {} }),
    requestAnimationFrame: () => 0,
    cancelAnimationFrame() {},
    localStorage: armazenamento,
    AudioContext: audio,
  };
  globalThis.document = documento;
  globalThis.window = janela;
  globalThis.localStorage = armazenamento;
  globalThis.requestAnimationFrame = () => 0;
  globalThis.cancelAnimationFrame = () => {};
  globalThis.AudioContext = audio;
  globalThis.matchMedia = janela.matchMedia;
  globalThis.location = janela.location;
  Object.defineProperty(globalThis, 'navigator', {
    value: { userAgent: 'node', maxTouchPoints: 0 },
    configurable: true,
  });
}
