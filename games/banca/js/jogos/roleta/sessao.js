// A sessão da roleta, sem DOM: apostas na mesa, girar, pagar e registrar.
// A interface e o robô chamam exatamente estas funções.
//
// A ficha sai do saldo quando pousa no pano (como na mesa de verdade) e volta
// se for retirada antes do giro. O número sai do gerador verificável no
// instante do giro; a física da bola é só a encenação dele.

import {
  APOSTA_POR_ID, LIMITES, contaDaMesa, resolver, derivar, apostasAnunciada, nomeNumero, corDe, ORDEM_RODA,
} from './regras.js';

export const JOGO = 'roleta';

function estadoInicial() {
  return { apostas: {}, pilha: [], anteriores: null, historico: [], contagem: new Array(37).fill(0), giros: 0 };
}

export function criarSessaoRoleta(casa) {
  const m = casa.mesa(JOGO);
  if (!m.apostas) Object.assign(m, estadoInicial());

  function total() {
    let s = 0;
    for (const v of Object.values(m.apostas)) s += v;
    return s;
  }

  function validar(id, valor) {
    const a = APOSTA_POR_ID[id];
    if (!a) throw new Error(`Aposta desconhecida: ${id}.`);
    if (!Number.isInteger(valor) || valor <= 0 || valor % 100 !== 0) throw new Error('Na roleta a aposta é em fichas inteiras.');
    const atual = m.apostas[id] ?? 0;
    // Teto proporcional aos números cobertos: 500 no pleno, 1.000 no cavalo...
    const teto = LIMITES.maximoPleno * a.numeros.length;
    if (atual + valor > teto) throw new Error(`O limite desta aposta é ${teto / 100} fichas.`);
    if (total() + valor > LIMITES.maximoRodada) throw new Error(`O limite da mesa é ${LIMITES.maximoRodada / 100} fichas por giro.`);
    if (!casa.carteira.pode(valor)) throw new Error('Saldo insuficiente para esta ficha.');
  }

  // Uma ou várias apostas de uma vez (a pista francesa põe até 7 de uma só).
  function colocar(itens, rotulo) {
    let soma = 0;
    for (const [id, v] of itens) { if (!APOSTA_POR_ID[id]) throw new Error(`Aposta desconhecida: ${id}.`); soma += v; }
    if (!casa.carteira.pode(soma)) throw new Error('Saldo insuficiente para esta aposta.');
    if (total() + soma > LIMITES.maximoRodada) throw new Error(`O limite da mesa é ${LIMITES.maximoRodada / 100} fichas por giro.`);
    for (const [id, v] of itens) validar(id, v);
    casa.carteira.debitar(soma);
    for (const [id, v] of itens) m.apostas[id] = (m.apostas[id] ?? 0) + v;
    m.pilha.push({ itens, rotulo });
    casa.salvar();
    casa.avisar('saldo');
    return itens;
  }

  function apostar(id, valor) {
    validar(id, valor);
    return colocar([[id, valor]], APOSTA_POR_ID[id].nome);
  }

  function apostarAnunciada(nome, unidade, numero) {
    const itens = apostasAnunciada(nome, numero).map(([id, k]) => [id, k * unidade]);
    return colocar(itens, nome);
  }

  function devolver(id, v) {
    m.apostas[id] -= v;
    if (m.apostas[id] <= 0) delete m.apostas[id];
    casa.carteira.creditar(v);
  }

  function desfazer() {
    const u = m.pilha.pop();
    if (!u) return null;
    for (const [id, v] of u.itens) devolver(id, Math.min(v, m.apostas[id] ?? 0));
    casa.salvar();
    casa.avisar('saldo');
    return u;
  }

  function retirar(id) {
    const v = m.apostas[id];
    if (!v) return 0;
    devolver(id, v);
    m.pilha = m.pilha.map(p => ({ ...p, itens: p.itens.filter(([i]) => i !== id) })).filter(p => p.itens.length);
    casa.salvar();
    casa.avisar('saldo');
    return v;
  }

  function limpar() {
    const v = total();
    for (const id of Object.keys(m.apostas)) devolver(id, m.apostas[id]);
    m.pilha = [];
    casa.salvar();
    casa.avisar('saldo');
    return v;
  }

  function repetir() {
    if (!m.anteriores || total() > 0) return null;
    return colocar(Object.entries(m.anteriores), 'repetir');
  }

  function dobrar() {
    const itens = Object.entries(m.apostas);
    if (!itens.length) return null;
    return colocar(itens, 'dobrar');
  }

  // O giro. Tudo o que muda o saldo acontece aqui, de uma vez; a mesa depois
  // encena a bola chegando ao número que já está decidido.
  function girar() {
    const apostado = total();
    if (apostado <= 0) throw new Error('Ponha ao menos uma ficha no pano antes de girar.');
    const conta = contaDaMesa(m.apostas);
    const { registro, gerador } = casa.justo.abrir(JOGO);
    const numero = derivar(gerador);
    const res = resolver(m.apostas, numero);
    if (res.retorno > 0) casa.carteira.creditar(res.retorno);
    const texto = nomeNumero(numero);
    casa.justo.revelar(JOGO, { numero, texto });
    const rodada = casa.fecharRodada({
      jogo: JOGO,
      apostado,
      retorno: res.retorno,
      perdaEsperada: conta.perdaEsperada,
      variancia: conta.variancia,
      rotulo: `${texto}: ${res.ganhos.length ? `${res.ganhos.length} aposta${res.ganhos.length > 1 ? 's' : ''} paga${res.ganhos.length > 1 ? 's' : ''}` : 'nada pago'}`,
      contador: registro.contador,
    });
    m.anteriores = { ...m.apostas };
    const apostas = m.apostas;
    m.apostas = {};
    m.pilha = [];
    m.historico.unshift(numero);
    if (m.historico.length > 200) m.historico.length = 200;
    m.contagem[numero]++;
    m.giros++;
    casa.salvar();
    return { numero, cor: corDe(numero), apostas, apostado, retorno: res.retorno, ganhos: res.ganhos, conta, rodada, contador: registro.contador };
  }

  // Quentes e frios das últimas N rodadas: a roda não lembra de nada, mas o
  // jogador quer ver, então a mesa mostra e diz isso.
  function quentesEFrios(n = 100) {
    const janela = m.historico.slice(0, n);
    const c = new Array(37).fill(0);
    for (const x of janela) c[x]++;
    const ordem = ORDEM_RODA.slice().sort((a, b) => c[b] - c[a] || a - b);
    return { janela: janela.length, quentes: ordem.slice(0, 5).map(x => [x, c[x]]), frios: ordem.slice(-5).reverse().map(x => [x, c[x]]), esperado: janela.length / 37 };
  }

  return {
    JOGO,
    mesa: m,
    get apostas() { return m.apostas; },
    get historico() { return m.historico; },
    get anteriores() { return m.anteriores; },
    total, conta: () => contaDaMesa(m.apostas),
    apostar, apostarAnunciada, retirar, desfazer, limpar, repetir, dobrar, girar, quentesEFrios,
    compromisso: () => casa.justo.compromisso(JOGO),
  };
}
