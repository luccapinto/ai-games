// A casa: carteira, Livro, cartório de sementes, preferências e o estado de
// cada mesa, num objeto só que cabe no localStorage.
//
// Não há DOM aqui. O navegador e as provas usam exatamente este arquivo; a
// única diferença é o armazém (localStorage de um lado, memória do outro).

import { criarCarteira, estadoCarteiraInicial, CREDITO } from './carteira.js';
import { criarLivro, estadoLivroInicial } from './livro.js';
import { criarJusto, estadoJustoInicial, bytesAleatorios } from './justo.js';

export const CHAVE = 'banca:v1';
export const VERSAO_ESTADO = 1;

export function armazemMemoria() {
  const m = new Map();
  return {
    ler: k => (m.has(k) ? m.get(k) : null),
    gravar: (k, v) => { m.set(k, v); },
    apagar: k => { m.delete(k); },
  };
}

// Para provas de milhares de rodadas: não guarda nada e não serializa. A
// persistência em si é provada com o armazemMemoria.
export function armazemDescartavel() {
  return { ler: () => null, gravarObjeto: () => {}, gravar: () => {}, apagar: () => {} };
}

// localStorage pode não existir, estar cheio ou bloqueado (aba anônima de
// alguns navegadores). O jogo precisa abrir mesmo assim.
export function armazemNavegador() {
  const reserva = armazemMemoria();
  let ls = null;
  try {
    ls = globalThis.localStorage;
    const k = '__banca_teste__';
    ls.setItem(k, '1');
    ls.removeItem(k);
  } catch { ls = null; }
  if (!ls) return reserva;
  return {
    ler: k => { try { return ls.getItem(k); } catch { return reserva.ler(k); } },
    gravar: (k, v) => { try { ls.setItem(k, v); } catch { reserva.gravar(k, v); } },
    apagar: k => { try { ls.removeItem(k); } catch { reserva.apagar(k); } },
  };
}

export const PREFS_PADRAO = {
  som: true,
  volume: 0.8,
  ambiente: true,
  treinador: true,
  destacarBoas: false,
  velocidade: 1,
};

function estadoInicial(fonte) {
  return {
    versao: VERSAO_ESTADO,
    criado: Date.now(),
    carteira: estadoCarteiraInicial(),
    livro: estadoLivroInicial(),
    justo: estadoJustoInicial(fonte),
    prefs: { ...PREFS_PADRAO },
    mesas: {},
  };
}

function substituir(alvo, novo) {
  for (const k of Object.keys(alvo)) delete alvo[k];
  Object.assign(alvo, novo);
}

export function criarCasa({ armazem = armazemMemoria(), fonte = bytesAleatorios } = {}) {
  let estado = null;
  const bruto = armazem.ler(CHAVE);
  if (bruto) {
    try {
      const lido = JSON.parse(bruto);
      if (lido && lido.versao === VERSAO_ESTADO && lido.carteira && lido.livro && lido.justo) estado = lido;
    } catch { estado = null; }
  }
  if (!estado) estado = estadoInicial(fonte);
  estado.prefs = { ...PREFS_PADRAO, ...estado.prefs };
  estado.mesas ??= {};

  const carteira = criarCarteira(estado.carteira);
  const livro = criarLivro(estado.livro);
  const justo = criarJusto(estado.justo, fonte);
  const ouvintes = new Set();

  function avisar(tipo, dados) {
    for (const f of ouvintes) {
      try { f(tipo, dados); } catch (e) { console.error(e); }
    }
  }

  function salvar() {
    try {
      if (armazem.gravarObjeto) armazem.gravarObjeto(CHAVE, estado);
      else armazem.gravar(CHAVE, JSON.stringify(estado));
    } catch (e) { console.error(e); }
  }

  // Toda rodada de todo jogo termina aqui: entra no Livro, a dívida cobra o
  // juro da rodada e o estado é gravado.
  function fecharRodada(r) {
    const registro = livro.registrar(r);
    const juros = carteira.jurosDaRodada();
    if (juros > 0) registro.juros = juros;
    salvar();
    avisar('rodada', registro);
    return registro;
  }

  function pedirCredito() {
    const v = carteira.pedirCredito();
    livro.evento('credito', v, `Crédito da casa de ${v / 100} fichas`);
    salvar();
    avisar('saldo');
    return v;
  }

  function quitar(v) {
    const pago = carteira.quitar(v);
    if (pago > 0) livro.evento('quitacao', pago, `Pagamento de ${pago / 100} fichas à casa`);
    salvar();
    avisar('saldo');
    return pago;
  }

  function zerar() {
    const novo = estadoInicial(fonte);
    substituir(estado.carteira, novo.carteira);
    substituir(estado.livro, novo.livro);
    substituir(estado.justo, novo.justo);
    substituir(estado.prefs, novo.prefs);
    substituir(estado.mesas, {});
    estado.criado = novo.criado;
    armazem.apagar(CHAVE);
    salvar();
    avisar('zerar');
  }

  function mesa(jogo) {
    return (estado.mesas[jogo] ??= {});
  }

  return {
    estado, carteira, livro, justo,
    get prefs() { return estado.prefs; },
    mesa, fecharRodada, pedirCredito, quitar, zerar, salvar, avisar,
    ouvir(f) { ouvintes.add(f); return () => ouvintes.delete(f); },
    CREDITO,
  };
}
