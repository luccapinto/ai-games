// A mesa de blackjack, sem tela nenhuma.
//
// Todo o estado vive em casa.mesa('blackjack'), que é um objeto JSON simples:
// recarregar a página no meio de uma rodada reconstrói a mesa exata, porque o
// sapato não é gravado carta a carta e sim recalculado do registro verificável
// aberto, e o que se guarda dele é só a posição.
//
// Toda função que muda a mesa devolve { eventos } na ordem em que a interface
// deve animar. A lógica já está aplicada quando a função retorna.

import { valorDe } from '../../nucleo/baralho.js';
import {
  REGRAS, TOTAL_SAPATO, valorCarta, valorMao, bancaDeveComprar, bancaEspia, derivar, resumoDoSapato,
} from './regras.js';
import { acaoBasica } from './estrategia.js';
import { avaliar, melhorAcao, custoPorFicha as custoDasAcoes } from './ev.js';
import { VANTAGEM_BLACKJACK, VANTAGEM_SEGURO, VARIANCIA_SEGURO } from './vantagem.js';

export const JOGO = 'blackjack';
export const LIMITE_HISTORICO = 20;

const PALAVRA = {
  ganhou: 'ganhou',
  perdeu: 'perdeu',
  empatou: 'empatou',
  blackjack: 'blackjack, pagou 3 para 2',
  desistiu: 'desistiu',
  estourou: 'estourou',
};

function mesaInicial() {
  return {
    estado: 'aposta',
    aposta: REGRAS.minimo,
    pos: 0,
    maos: [],
    banca: { cartas: [], oculta: false },
    maoAtual: 0,
    seguro: 0,
    seguroPago: 0,
    apostado: 0,
    custoErro: 0,
    posInicio: 0,
    historico: [],
  };
}

function novaMao(aposta, cartas = []) {
  return { cartas, aposta, dobrada: false, dividida: false, deAses: false, desistiu: false, terminada: false, resultado: null, pago: 0 };
}

export function criarSessaoBlackjack(casa) {
  const m = casa.mesa(JOGO);
  const padrao = mesaInicial();
  for (const chave of Object.keys(padrao)) if (m[chave] === undefined) m[chave] = padrao[chave];

  let reg = casa.justo.aberto(JOGO);
  let cartas = reg ? derivar(casa.justo.geradorDe(reg)) : null;

  function novoSapato() {
    const aberto = casa.justo.abrir(JOGO);
    reg = aberto.registro;
    cartas = derivar(aberto.gerador);
    m.pos = 0;
  }

  function tirar() {
    if (m.pos >= TOTAL_SAPATO) throw new Error('O sapato acabou no meio da rodada.');
    return cartas[m.pos++];
  }

  function cartaEvento(alvo, carta, mao = 0, extra = {}) {
    return { tipo: 'carta', alvo, mao, carta, oculta: false, deitada: false, ...extra };
  }

  function validarAposta(v) {
    if (!Number.isInteger(v)) throw new Error('A aposta precisa ser um número inteiro de centavos.');
    if (v % 100 !== 0) throw new Error('A aposta é em fichas inteiras: use múltiplos de 100 centavos.');
    if (v < REGRAS.minimo || v > REGRAS.maximo) {
      throw new Error(`A aposta tem de ficar entre ${REGRAS.minimo / 100} e ${REGRAS.maximo / 100} fichas.`);
    }
  }

  function definirAposta(centavos) {
    if (m.estado !== 'aposta' && m.estado !== 'fim') throw new Error('A rodada já começou: não dá para mudar a aposta.');
    validarAposta(centavos);
    m.aposta = centavos;
    casa.salvar();
    return { eventos: [] };
  }

  // --- estado derivado da mão em jogo -------------------------------------

  function maoEmJogo() {
    if (m.estado !== 'jogando') return null;
    const h = m.maos[m.maoAtual];
    return h && !h.terminada ? h : null;
  }

  function opcoesDaMao(h) {
    if (!h) return { podeDobrar: false, podeDividir: false, podeDesistir: false };
    const duas = h.cartas.length === 2;
    const par = duas && valorCarta(h.cartas[0]) === valorCarta(h.cartas[1]);
    return {
      podeDobrar: duas && !h.deAses && casa.carteira.pode(h.aposta),
      podeDividir: par && !h.deAses && m.maos.length < REGRAS.maxMaos && casa.carteira.pode(h.aposta),
      podeDesistir: REGRAS.desistencia === 'tardia' && duas && !h.dividida && m.maos.length === 1 && !h.dobrada,
    };
  }

  function acoes() {
    const h = maoEmJogo();
    if (!h) return [];
    const o = opcoesDaMao(h);
    const lista = ['pedir', 'parar'];
    if (o.podeDobrar) lista.push('dobrar');
    if (o.podeDividir) lista.push('dividir');
    if (o.podeDesistir) lista.push('desistir');
    return lista;
  }

  // --- rodada --------------------------------------------------------------

  function dar() {
    if (m.estado !== 'aposta') throw new Error('Termine a rodada antes de pedir cartas novas.');
    validarAposta(m.aposta);
    if (!casa.carteira.pode(m.aposta)) throw new Error('Saldo insuficiente para essa aposta.');

    const eventos = [];
    if (!reg || m.pos >= REGRAS.corte) {
      if (reg) {
        casa.justo.revelar(JOGO, resumoDoSapato(cartas, m.pos));
        reg = null;
      }
      novoSapato();
      eventos.push({ tipo: 'embaralhar' });
    }

    casa.carteira.debitar(m.aposta);
    m.apostado = m.aposta;
    m.seguro = 0;
    m.seguroPago = 0;
    m.custoErro = 0;
    m.posInicio = m.pos;
    m.maoAtual = 0;
    m.maos = [novaMao(m.aposta)];
    m.banca = { cartas: [], oculta: true };

    const c1 = tirar(); m.maos[0].cartas.push(c1); eventos.push(cartaEvento('jogador', c1, 0));
    const up = tirar(); m.banca.cartas.push(up); eventos.push(cartaEvento('banca', up));
    const c2 = tirar(); m.maos[0].cartas.push(c2); eventos.push(cartaEvento('jogador', c2, 0));
    const furo = tirar(); m.banca.cartas.push(furo); eventos.push(cartaEvento('banca', furo, 0, { oculta: true }));

    if (REGRAS.seguro && valorDe(up) === 0) {
      m.estado = 'seguro';
      eventos.push({ tipo: 'seguro', oferecido: true });
      casa.salvar();
      return { eventos };
    }

    eventos.push(...depoisDoPeek());
    casa.salvar();
    return { eventos };
  }

  function seguro(aceita) {
    if (m.estado !== 'seguro') throw new Error('Não há seguro em aberto.');
    const eventos = [];
    if (aceita) {
      const v = m.aposta / 2;
      if (!casa.carteira.pode(v)) throw new Error('Saldo insuficiente para o seguro.');
      casa.carteira.debitar(v);
      m.seguro = v;
      m.apostado += v;
      // O seguro é sempre um desvio: a aposta tem valor esperado negativo.
      m.custoErro += v * VANTAGEM_SEGURO;
    }
    eventos.push(...depoisDoPeek());
    casa.salvar();
    return { eventos };
  }

  function depoisDoPeek() {
    const eventos = [];
    const up = m.banca.cartas[0];
    const bancaBJ = valorMao(m.banca.cartas).blackjack;

    if (bancaEspia(up) && bancaBJ) {
      if (m.seguro > 0) {
        const pago = m.seguro * 3;
        casa.carteira.creditar(pago);
        m.seguroPago = pago;
        eventos.push({ tipo: 'seguro', pago });
      }
      m.estado = 'jogando';
      eventos.push(...resolver());
      return eventos;
    }

    if (m.seguro > 0) eventos.push({ tipo: 'seguro', pago: 0 });
    m.estado = 'jogando';

    if (valorMao(m.maos[0].cartas).blackjack) {
      eventos.push(...resolver());
      return eventos;
    }
    return eventos;
  }

  // Passa para a próxima mão que ainda tem o que fazer; completa as mãos que
  // nasceram de uma divisão e só têm uma carta.
  function avancar(eventos) {
    while (m.maoAtual < m.maos.length) {
      const h = m.maos[m.maoAtual];
      if (h.terminada) { m.maoAtual++; continue; }
      if (h.cartas.length === 1) {
        const c = tirar();
        h.cartas.push(c);
        eventos.push(cartaEvento('jogador', c, m.maoAtual));
        if (h.deAses || valorMao(h.cartas, true).total === 21) { h.terminada = true; m.maoAtual++; continue; }
      }
      return;
    }
    eventos.push(...resolver());
  }

  function agir(acao) {
    const h = maoEmJogo();
    if (!h) throw new Error('Não há mão em jogo.');
    const permitidas = acoes();
    if (!permitidas.includes(acao)) throw new Error(`Ação não permitida agora: ${acao}.`);

    const o = opcoesDaMao(h);
    const evs = avaliar(h.cartas, m.banca.cartas[0], o);
    // O erro é medido contra a jogada que o treinador recomenda (a estratégia
    // básica da mesa). Nas duas mãos em que a básica de seis baralhos e o VE de
    // baralho infinito discordam por milésimos, seguir o quadro custa zero.
    const basica = acaoBasica(h.cartas, m.banca.cartas[0], o);
    const referencia = evs[basica] ?? melhorAcao(evs).ev;
    if (evs[acao] !== undefined && acao !== basica) m.custoErro += Math.max(0, referencia - evs[acao]) * h.aposta;

    const eventos = [];
    const i = m.maoAtual;

    if (acao === 'pedir') {
      const c = tirar();
      h.cartas.push(c);
      eventos.push(cartaEvento('jogador', c, i));
      const t = valorMao(h.cartas, h.dividida);
      if (t.estourou || t.total === 21) { h.terminada = true; m.maoAtual++; }
    } else if (acao === 'parar') {
      h.terminada = true;
      m.maoAtual++;
    } else if (acao === 'dobrar') {
      casa.carteira.debitar(h.aposta);
      m.apostado += h.aposta;
      h.aposta *= 2;
      h.dobrada = true;
      const c = tirar();
      h.cartas.push(c);
      eventos.push(cartaEvento('jogador', c, i, { deitada: true }));
      h.terminada = true;
      m.maoAtual++;
    } else if (acao === 'dividir') {
      casa.carteira.debitar(h.aposta);
      m.apostado += h.aposta;
      const segunda = h.cartas.pop();
      const deAses = valorDe(segunda) === 0;
      h.dividida = true;
      h.deAses = deAses;
      const nova = novaMao(h.aposta, [segunda]);
      nova.dividida = true;
      nova.deAses = deAses;
      m.maos.splice(i + 1, 0, nova);
      eventos.push({ tipo: 'dividir', mao: i, nova: i + 1 });
    } else if (acao === 'desistir') {
      h.desistiu = true;
      h.terminada = true;
      m.maoAtual++;
    }

    avancar(eventos);
    casa.salvar();
    return { eventos };
  }

  // --- resolução -----------------------------------------------------------

  function resolver() {
    const eventos = [];
    if (m.banca.oculta) {
      m.banca.oculta = false;
      eventos.push({ tipo: 'revelar', alvo: 'banca', indice: 1, carta: m.banca.cartas[1] });
    }
    const bancaBJ = valorMao(m.banca.cartas).blackjack;
    const precisaJogar = !bancaBJ && m.maos.some(h => {
      const t = valorMao(h.cartas, h.dividida);
      return !h.desistiu && !t.estourou && !t.blackjack;
    });
    if (precisaJogar) {
      while (bancaDeveComprar(m.banca.cartas)) {
        const c = tirar();
        m.banca.cartas.push(c);
        eventos.push(cartaEvento('banca', c));
      }
    }

    const tb = valorMao(m.banca.cartas);
    let retornoMaos = 0;
    for (let i = 0; i < m.maos.length; i++) {
      const h = m.maos[i];
      const t = valorMao(h.cartas, h.dividida);
      let resultado;
      let pago = 0;
      if (h.desistiu) { resultado = 'desistiu'; pago = h.aposta / 2; }
      else if (t.estourou) { resultado = 'estourou'; }
      else if (t.blackjack && !bancaBJ) { resultado = 'blackjack'; pago = h.aposta + h.aposta * 3 / 2; }
      else if (bancaBJ) {
        resultado = t.blackjack ? 'empatou' : 'perdeu';
        pago = t.blackjack ? h.aposta : 0;
      } else if (tb.estourou || t.total > tb.total) { resultado = 'ganhou'; pago = h.aposta * 2; }
      else if (t.total === tb.total) { resultado = 'empatou'; pago = h.aposta; }
      else { resultado = 'perdeu'; }
      h.resultado = resultado;
      h.pago = pago;
      h.terminada = true;
      retornoMaos += pago;
      eventos.push({ tipo: 'resultado', mao: i, resultado, pago });
    }
    if (retornoMaos > 0) casa.carteira.creditar(retornoMaos);

    const retorno = retornoMaos + m.seguroPago;
    const perdaEsperada = m.aposta * VANTAGEM_BLACKJACK.vantagem + m.seguro * VANTAGEM_SEGURO;
    const variancia = m.aposta * m.aposta * VANTAGEM_BLACKJACK.variancia + m.seguro * m.seguro * VARIANCIA_SEGURO;
    const registro = casa.fecharRodada({
      jogo: JOGO,
      apostado: m.apostado,
      retorno,
      perdaEsperada,
      variancia,
      custoErro: m.custoErro,
      rotulo: rotuloDaRodada(tb),
      contador: reg ? reg.contador : null,
    });

    m.estado = 'fim';
    m.historico.unshift({
      i: registro.i,
      aposta: m.aposta,
      apostado: m.apostado,
      retorno,
      rotulo: registro.rotulo,
      contador: reg ? reg.contador : null,
      hash: reg ? reg.hash : null,
      posInicio: m.posInicio,
      posFim: m.pos,
      maos: m.maos.map(h => ({ cartas: h.cartas.slice(), resultado: h.resultado, pago: h.pago })),
      banca: m.banca.cartas.slice(),
    });
    if (m.historico.length > LIMITE_HISTORICO) m.historico.length = LIMITE_HISTORICO;

    eventos.push({ tipo: 'fim', rodada: registro });
    return eventos;
  }

  function rotuloDaRodada(tb) {
    const alvo = tb.estourou ? 'estouro' : String(tb.total);
    if (m.maos.length === 1) {
      const h = m.maos[0];
      const t = valorMao(h.cartas, h.dividida);
      const meu = h.desistiu ? 'desistência' : String(t.total);
      return `${meu} contra ${alvo}, ${PALAVRA[h.resultado] ?? h.resultado}`;
    }
    const partes = m.maos.map(h => `${valorMao(h.cartas, h.dividida).total} ${PALAVRA[h.resultado] ?? h.resultado}`);
    return `${m.maos.length} mãos contra ${alvo}: ${partes.join(', ')}`;
  }

  function novaRodada() {
    if (m.estado !== 'fim') throw new Error('A rodada ainda não terminou.');
    m.estado = 'aposta';
    m.maos = [];
    m.banca = { cartas: [], oculta: false };
    m.maoAtual = 0;
    m.seguro = 0;
    m.seguroPago = 0;
    m.apostado = 0;
    m.custoErro = 0;
    casa.salvar();
    return { eventos: [] };
  }

  // --- treinador -----------------------------------------------------------

  function conselho() {
    if (m.estado === 'seguro') {
      const evs = { aceitar: -VANTAGEM_SEGURO, recusar: 0 };
      return { acao: 'recusar', evs, custoPorFicha: { aceitar: VANTAGEM_SEGURO, recusar: 0 } };
    }
    const h = maoEmJogo();
    if (!h) return null;
    const o = opcoesDaMao(h);
    const evs = avaliar(h.cartas, m.banca.cartas[0], o);
    return { acao: acaoBasica(h.cartas, m.banca.cartas[0], o), evs, custoPorFicha: custoDasAcoes(evs) };
  }

  const compromisso = () => casa.justo.compromisso(JOGO);

  return {
    JOGO,
    mesa: m,
    get estado() { return m.estado; },
    get maos() { return m.maos; },
    get banca() { return m.banca; },
    get maoAtual() { return m.maoAtual; },
    get aposta() { return m.aposta; },
    get seguroOferecido() { return m.estado === 'seguro'; },
    get historico() { return m.historico; },
    get sapato() {
      const c = compromisso();
      return {
        restantes: cartas ? TOTAL_SAPATO - m.pos : TOTAL_SAPATO,
        total: TOTAL_SAPATO,
        corte: REGRAS.corte,
        pos: m.pos,
        contador: reg ? reg.contador : c.contador,
        hash: reg ? reg.hash : c.hash,
      };
    },
    get cartasDoSapato() { return cartas; },
    REGRAS,
    definirAposta, dar, seguro, acoes, agir, conselho, novaRodada,
    totalMao: valorMao,
    compromisso,
  };
}
