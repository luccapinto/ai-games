// A mesa de vídeo pôquer, sem tela nenhuma.
//
// Rodada única: o compromisso verificável abre em dar() e é revelado ao
// resolver. O baralho não é gravado: sai de novo do gerador do registro aberto,
// então recarregar a página no meio do descarte devolve exatamente as mesmas
// cinco cartas e as mesmas substitutas.
//
// A análise entra por injeção: em Node as provas passam uma função apoiada em
// construirTabelas(); no navegador a interface passa o resultado que o
// trabalhador já calculou. A sessão não sabe a diferença.

import {
  TABELA, MOEDAS_VALIDAS, MAX_MOEDAS, classificar, pagamento, derivar, maoFinal,
} from './regras.js';
import { RTP5, RTP1A4, VARIANCIA5, VARIANCIA1A4 } from './constantes.js';

export const JOGO = 'videopoquer';
export const LIMITE_HISTORICO = 20;

function mesaInicial() {
  return {
    estado: 'aposta',
    moeda: 100,
    moedas: 5,
    mao: [],
    segurar: [false, false, false, false, false],
    aposta: 0,
    categoria: null,
    pago: 0,
    historico: [],
  };
}

export function criarSessaoVideoPoquer(casa, { analisar } = {}) {
  if (typeof analisar !== 'function') throw new Error('A mesa de vídeo pôquer precisa de uma função de análise.');

  const m = casa.mesa(JOGO);
  const padrao = mesaInicial();
  for (const chave of Object.keys(padrao)) if (m[chave] === undefined) m[chave] = padrao[chave];

  let reg = casa.justo.aberto(JOGO);
  let baralho = reg ? derivar(casa.justo.geradorDe(reg)) : null;

  const apostaAtual = () => m.moeda * m.moedas;
  const rtpDaAposta = () => (m.moedas === MAX_MOEDAS ? RTP5 : RTP1A4);
  const varianciaDaAposta = () => (m.moedas === MAX_MOEDAS ? VARIANCIA5 : VARIANCIA1A4);

  function exigirAposta() {
    if (m.estado !== 'aposta' && m.estado !== 'fim') throw new Error('A rodada já começou: termine antes de mexer na aposta.');
  }

  function definirMoeda(centavos) {
    exigirAposta();
    if (!MOEDAS_VALIDAS.includes(centavos)) {
      throw new Error(`A moeda é de ${MOEDAS_VALIDAS.map(v => v / 100).join(', ')} fichas.`);
    }
    m.moeda = centavos;
    casa.salvar();
    return { eventos: [] };
  }

  function definirMoedas(n) {
    exigirAposta();
    if (!Number.isInteger(n) || n < 1 || n > MAX_MOEDAS) throw new Error('São de 1 a 5 moedas por rodada.');
    m.moedas = n;
    casa.salvar();
    return { eventos: [] };
  }

  function dar() {
    if (m.estado === 'descarte') throw new Error('Troque as cartas antes de pedir uma mão nova.');
    if (m.estado === 'fim') novaRodada();
    const aposta = apostaAtual();
    if (!casa.carteira.pode(aposta)) throw new Error('Saldo insuficiente para essa aposta.');

    if (reg) casa.justo.revelar(JOGO, { abandonada: true });
    const aberto = casa.justo.abrir(JOGO);
    reg = aberto.registro;
    baralho = derivar(aberto.gerador);

    casa.carteira.debitar(aposta);
    m.aposta = aposta;
    m.mao = baralho.slice(0, 5);
    m.segurar = [false, false, false, false, false];
    m.categoria = null;
    m.pago = 0;
    m.estado = 'descarte';
    casa.salvar();

    return { eventos: m.mao.map((carta, posicao) => ({ tipo: 'carta', posicao, carta })) };
  }

  function alternar(i) {
    if (m.estado !== 'descarte') throw new Error('Não há cartas para segurar agora.');
    if (!Number.isInteger(i) || i < 0 || i > 4) throw new Error('Carta inexistente.');
    m.segurar[i] = !m.segurar[i];
    casa.salvar();
    return { eventos: [] };
  }

  function analiseAtual() {
    return analisar(m.mao, m.moedas);
  }

  function mascaraEscolhida() {
    let mask = 0;
    for (let i = 0; i < 5; i++) if (m.segurar[i]) mask |= 1 << i;
    return mask;
  }

  function conselho() {
    if (m.estado !== 'descarte') return null;
    const { evs, melhor } = analiseAtual();
    const escolha = mascaraEscolhida();
    const evEscolha = evs[escolha];
    return {
      melhor,
      evs,
      evEscolha,
      evMelhor: evs[melhor],
      custo: Math.max(0, evs[melhor] - evEscolha) * m.moedas * m.moeda,
    };
  }

  function trocar() {
    if (m.estado !== 'descarte') throw new Error('Não há troca em aberto.');
    const { evs, melhor } = analiseAtual();
    const escolha = mascaraEscolhida();
    const custoErro = Math.max(0, evs[melhor] - evs[escolha]) * m.moedas * m.moeda;

    const eventos = [];
    let proxima = 5;
    const final = m.mao.slice();
    for (let i = 0; i < 5; i++) {
      if (m.segurar[i]) continue;
      const carta = baralho[proxima++];
      final[i] = carta;
      eventos.push({ tipo: 'trocar', posicao: i, carta });
    }

    const categoria = classificar(final);
    const premio = pagamento(categoria, m.moedas) * m.moeda;
    if (premio > 0) casa.carteira.creditar(premio);

    m.mao = final;
    m.categoria = categoria;
    m.pago = premio;
    eventos.push({ tipo: 'resultado', categoria, pago: premio });

    casa.justo.revelar(JOGO, {
      mao: baralho.slice(0, 5),
      segurou: m.segurar.slice(),
      final,
      categoria,
      pago: premio,
      texto: TABELA[categoria].nome,
    });
    const contador = reg.contador;
    const hash = reg.hash;
    reg = null;
    baralho = null;

    const rotulo = premio > 0
      ? `${TABELA[categoria].nome}, pagou ${premio / 100} fichas`
      : `${TABELA[categoria].nome}, não pagou`;

    const registro = casa.fecharRodada({
      jogo: JOGO,
      apostado: m.aposta,
      retorno: premio,
      perdaEsperada: m.aposta * (1 - rtpDaAposta()),
      variancia: m.aposta * m.aposta * varianciaDaAposta(),
      custoErro,
      rotulo,
      contador,
    });

    m.estado = 'fim';
    m.historico.unshift({
      i: registro.i,
      aposta: m.aposta,
      retorno: premio,
      categoria,
      rotulo,
      contador,
      hash,
      mao: final.slice(),
      segurou: m.segurar.slice(),
      custoErro,
    });
    if (m.historico.length > LIMITE_HISTORICO) m.historico.length = LIMITE_HISTORICO;

    eventos.push({ tipo: 'fim', rodada: registro });
    casa.salvar();
    return { eventos };
  }

  function novaRodada() {
    if (m.estado === 'descarte') throw new Error('Termine a troca antes.');
    m.estado = 'aposta';
    m.mao = [];
    m.segurar = [false, false, false, false, false];
    m.categoria = null;
    m.pago = 0;
    m.aposta = 0;
    casa.salvar();
    return { eventos: [] };
  }

  return {
    JOGO,
    mesa: m,
    TABELA,
    get estado() { return m.estado; },
    get mao() { return m.mao; },
    get segurar() { return m.segurar; },
    get moeda() { return m.moeda; },
    get moedas() { return m.moedas; },
    get aposta() { return apostaAtual(); },
    get categoria() { return m.categoria; },
    get pago() { return m.pago; },
    get historico() { return m.historico; },
    get baralho() { return baralho; },
    definirMoeda, definirMoedas, dar, alternar, trocar, conselho, novaRodada,
    classificar,
    maoFinal,
    compromisso: () => casa.justo.compromisso(JOGO),
  };
}
