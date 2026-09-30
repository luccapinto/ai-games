// A mesa de bacará, sem tela nenhuma.
//
// O coup é atômico: as apostas entram, `dar()` resolve o coup inteiro e a mesa
// volta para o estado de aposta. Não há decisão do jogador depois das cartas,
// então não existe rodada "no meio" para restaurar — o que precisa sobreviver
// a um recarregamento são as apostas já colocadas, a posição do sapato e a
// estrada (o histórico que a mesa de bacará mostra em coluna).
//
// O compromisso verificável cobre o SAPATO inteiro: abre ao embaralhar, revela
// quando o sapato é trocado. Cada coup grava as posições que usou.

import { curto } from '../../nucleo/baralho.js';
import {
  REGRAS, TOTAL_SAPATO, APOSTAS, NOME_APOSTA, derivar, jogarMao, retornoDe,
  contaDaMesa, totalApostado, textoDaMao, assinaturaDoSapato,
} from './regras.js';

export const JOGO = 'bacara';
export const LIMITE_ESTRADA = 72;
export const LIMITE_HISTORICO = 20;

function apostasVazias() {
  return { jogador: 0, banca: 0, empate: 0, parJogador: 0, parBanca: 0 };
}

function mesaInicial() {
  return {
    estado: 'aposta',
    apostas: apostasVazias(),
    ultimas: apostasVazias(),
    pos: 0,
    posInicio: 0,
    coups: 0,
    mao: null,
    estrada: [],
    historico: [],
  };
}

export function criarSessaoBacara(casa) {
  const m = casa.mesa(JOGO);
  const padrao = mesaInicial();
  for (const chave of Object.keys(padrao)) if (m[chave] === undefined) m[chave] = padrao[chave];
  for (const id of APOSTAS) {
    if (!Number.isInteger(m.apostas[id])) m.apostas[id] = 0;
    if (!Number.isInteger(m.ultimas[id])) m.ultimas[id] = 0;
  }

  let reg = casa.justo.aberto(JOGO);
  let cartas = reg ? derivar(casa.justo.geradorDe(reg)) : null;

  function novoSapato() {
    const aberto = casa.justo.abrir(JOGO);
    reg = aberto.registro;
    cartas = derivar(aberto.gerador);
    m.pos = 0;
    m.coups = 0;
  }

  function fecharSapato() {
    if (!reg) return;
    casa.justo.revelar(JOGO, {
      assinatura: assinaturaDoSapato(cartas),
      cartasUsadas: m.pos,
      coups: m.coups,
      texto: `sapato de ${TOTAL_SAPATO} cartas, ${m.coups} coups, ${m.pos} cartas usadas`,
    });
    reg = null;
  }

  function tirar() {
    if (m.pos >= TOTAL_SAPATO) throw new Error('O sapato acabou no meio do coup.');
    return cartas[m.pos++];
  }

  // --- apostas -------------------------------------------------------------

  function validar(id, v) {
    if (!APOSTAS.includes(id)) throw new Error(`Aposta desconhecida: ${id}.`);
    if (!Number.isInteger(v)) throw new Error('A aposta precisa ser um número inteiro de centavos.');
    if (v % REGRAS.ficha !== 0) throw new Error('A aposta é em fichas inteiras: use múltiplos de 100 centavos.');
    if (v <= 0) throw new Error('A aposta precisa ser de pelo menos uma ficha.');
  }

  function apostar(id, v) {
    if (m.estado !== 'aposta') throw new Error('O coup já foi dado: espere a próxima mão.');
    validar(id, v);
    const novo = m.apostas[id] + v;
    if (novo < REGRAS.minimo) throw new Error(`${NOME_APOSTA[id]} aceita no mínimo ${REGRAS.minimo / 100} fichas.`);
    if (novo > REGRAS.maximo) throw new Error(`${NOME_APOSTA[id]} aceita no máximo ${REGRAS.maximo / 100} fichas.`);
    if (!casa.carteira.pode(v)) throw new Error('Saldo insuficiente para essa aposta.');
    casa.carteira.debitar(v);
    m.apostas[id] = novo;
    casa.salvar();
    return { eventos: [{ tipo: 'aposta', zona: id, valor: novo }] };
  }

  function retirar(id) {
    if (m.estado !== 'aposta') throw new Error('O coup já foi dado: não dá para retirar a aposta.');
    if (!APOSTAS.includes(id)) throw new Error(`Aposta desconhecida: ${id}.`);
    const v = m.apostas[id];
    if (v <= 0) return { eventos: [] };
    m.apostas[id] = 0;
    casa.carteira.creditar(v);
    casa.salvar();
    return { eventos: [{ tipo: 'aposta', zona: id, valor: 0, devolvido: v }] };
  }

  function limpar() {
    if (m.estado !== 'aposta') throw new Error('O coup já foi dado: não dá para retirar as apostas.');
    const eventos = [];
    for (const id of APOSTAS) {
      const v = m.apostas[id];
      if (v > 0) {
        m.apostas[id] = 0;
        casa.carteira.creditar(v);
        eventos.push({ tipo: 'aposta', zona: id, valor: 0, devolvido: v });
      }
    }
    casa.salvar();
    return { eventos };
  }

  // Repete o que foi apostado no coup anterior, se o saldo cobrir.
  function repetir() {
    if (m.estado !== 'aposta') throw new Error('O coup já foi dado: espere a próxima mão.');
    const alvo = m.ultimas;
    const falta = totalApostado(alvo) - totalApostado(m.apostas);
    if (falta <= 0 && totalApostado(alvo) === 0) throw new Error('Não há aposta anterior para repetir.');
    const eventos = [];
    for (const id of APOSTAS) {
      const quero = alvo[id];
      const tenho = m.apostas[id];
      if (quero > tenho) {
        const delta = quero - tenho;
        if (!casa.carteira.pode(delta)) throw new Error('Saldo insuficiente para repetir a aposta.');
        casa.carteira.debitar(delta);
        m.apostas[id] = quero;
        eventos.push({ tipo: 'aposta', zona: id, valor: quero });
      }
    }
    casa.salvar();
    return { eventos };
  }

  function total() {
    return totalApostado(m.apostas);
  }

  // --- o coup --------------------------------------------------------------

  function dar() {
    if (m.estado !== 'aposta') throw new Error('Comece um coup novo antes de pedir cartas.');
    const apostado = total();
    if (apostado <= 0) throw new Error('Coloque ao menos uma aposta antes de dar as cartas.');

    const eventos = [];
    // A carta de corte é conferida no INÍCIO do coup: um coup nunca é cortado
    // no meio.
    if (!reg || m.pos >= REGRAS.corte) {
      fecharSapato();
      novoSapato();
      eventos.push({ tipo: 'embaralhar' });
    }

    m.posInicio = m.pos;
    const ordem = [];
    const mao = jogarMao(() => {
      const c = tirar();
      ordem.push(c);
      return c;
    });
    m.coups++;

    // Os eventos saem na ordem real da mesa: J, B, J, B e depois as terceiras.
    for (let i = 0; i < ordem.length; i++) {
      const alvo = i < 4 ? (i % 2 === 0 ? 'jogador' : 'banca') : (mao.jogador.length === 3 && i === 4 ? 'jogador' : 'banca');
      eventos.push({ tipo: 'carta', alvo, mao: 0, carta: ordem[i], oculta: false, deitada: false });
    }

    let retorno = 0;
    for (const id of APOSTAS) {
      const v = m.apostas[id];
      if (v <= 0) continue;
      const pago = retornoDe(id, v, mao);
      retorno += pago;
      const resultado = pago > v ? 'ganhou' : pago === v ? 'empatou' : 'perdeu';
      eventos.push({ tipo: 'resultado', zona: id, resultado, aposta: v, pago });
    }
    if (retorno > 0) casa.carteira.creditar(retorno);

    const conta = contaDaMesa(m.apostas);
    const rotulo = textoDaMao(mao);
    const registro = casa.fecharRodada({
      jogo: JOGO,
      apostado,
      retorno,
      perdaEsperada: conta.perdaEsperada,
      variancia: conta.variancia,
      rotulo,
      contador: reg ? reg.contador : null,
    });

    m.mao = { ...mao, texto: rotulo };
    m.estado = 'fim';
    m.ultimas = { ...m.apostas };
    m.estrada.unshift({
      vencedor: mao.vencedor,
      totalJogador: mao.totalJogador,
      totalBanca: mao.totalBanca,
      natural: mao.natural,
      parJogador: mao.parJogador,
      parBanca: mao.parBanca,
    });
    if (m.estrada.length > LIMITE_ESTRADA) m.estrada.length = LIMITE_ESTRADA;
    m.historico.unshift({
      i: registro.i,
      apostado,
      retorno,
      rotulo,
      contador: reg ? reg.contador : null,
      hash: reg ? reg.hash : null,
      posInicio: m.posInicio,
      posFim: m.pos,
      cartas: ordem.map(curto),
    });
    if (m.historico.length > LIMITE_HISTORICO) m.historico.length = LIMITE_HISTORICO;

    eventos.push({ tipo: 'fim', rodada: registro });
    casa.salvar();
    return { eventos };
  }

  function novaRodada() {
    if (m.estado !== 'fim') throw new Error('O coup ainda não terminou.');
    m.estado = 'aposta';
    m.apostas = apostasVazias();
    m.mao = null;
    casa.salvar();
    return { eventos: [] };
  }

  const compromisso = () => casa.justo.compromisso(JOGO);

  return {
    JOGO,
    mesa: m,
    REGRAS,
    get estado() { return m.estado; },
    get apostas() { return m.apostas; },
    get ultimas() { return m.ultimas; },
    get mao() { return m.mao; },
    get estrada() { return m.estrada; },
    get historico() { return m.historico; },
    get cartasDoSapato() { return cartas; },
    get sapato() {
      const c = compromisso();
      return {
        restantes: TOTAL_SAPATO - m.pos,
        total: TOTAL_SAPATO,
        corte: REGRAS.corte,
        pos: m.pos,
        coups: m.coups,
        contador: reg ? reg.contador : c.contador,
        hash: reg ? reg.hash : c.hash,
      };
    },
    apostar, retirar, limpar, repetir, total, dar, novaRodada, compromisso,
  };
}
