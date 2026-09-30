// A mesa de craps, sem tela nenhuma.
//
// Cada lance é uma rodada verificável fechada em si: o compromisso é publicado
// antes, os dois dados saem do gerador e a semente é revelada com o resultado.
// O estado que sobrevive a um recarregamento (ponto, apostas na mesa, últimos
// lances) mora em casa.mesa('craps').

import {
  REGRAS, ZONAS, ZONA_POR_ID, derivar, resolver, textoDoLance,
  podeApostar as regraPodeApostar, podeRetirar as regraPodeRetirar,
  ajustarValor, tetoDe, contaDoLance, fichaDe,
} from './regras.js';

export const JOGO = 'craps';
export const LIMITE_HISTORICO = 20;

function apostasVazias() {
  const a = {};
  for (const z of ZONAS) a[z.id] = 0;
  return a;
}

function mesaInicial() {
  return {
    ponto: null,
    apostas: apostasVazias(),
    historico: [],
    lances: 0,
  };
}

export function criarSessaoCraps(casa) {
  const m = casa.mesa(JOGO);
  const padrao = mesaInicial();
  for (const chave of Object.keys(padrao)) if (m[chave] === undefined) m[chave] = padrao[chave];
  for (const z of ZONAS) if (!Number.isInteger(m.apostas[z.id])) m.apostas[z.id] = 0;

  function total() {
    let s = 0;
    for (const z of ZONAS) s += m.apostas[z.id];
    return s;
  }

  function podeApostar(zona) {
    return regraPodeApostar(zona, m.apostas, m.ponto);
  }

  function podeRetirar(zona) {
    return regraPodeRetirar(zona, m.apostas, m.ponto);
  }

  function apostar(zona, v) {
    const pode = podeApostar(zona);
    if (!pode.ok) throw new Error(pode.motivo);
    const ajuste = ajustarValor(zona, v, m.apostas, m.ponto);
    if (!casa.carteira.pode(ajuste.valor)) throw new Error('Saldo insuficiente para essa aposta.');
    casa.carteira.debitar(ajuste.valor);
    m.apostas[zona] += ajuste.valor;
    casa.salvar();
    return {
      valor: ajuste.valor,
      motivo: ajuste.motivo,
      eventos: [{ zona, resultado: 'colocou', aposta: m.apostas[zona], pago: 0 }],
    };
  }

  function retirar(zona) {
    if (!ZONA_POR_ID[zona]) throw new Error(`Zona desconhecida: ${zona}.`);
    if (!podeRetirar(zona)) {
      const z = ZONA_POR_ID[zona];
      if (!(m.apostas[zona] > 0)) throw new Error(`Não há aposta em ${z.nome} para retirar.`);
      throw new Error(`${z.nome} é aposta de contrato: não sai da mesa com o ponto de pé.`);
    }
    const v = m.apostas[zona];
    m.apostas[zona] = 0;
    casa.carteira.creditar(v);
    casa.salvar();
    return { eventos: [{ zona, resultado: 'retirou', aposta: 0, pago: v }] };
  }

  // --- o lance -------------------------------------------------------------

  function lancar() {
    if (total() <= 0) throw new Error('Coloque ao menos uma aposta antes de lançar os dados.');

    const { registro, gerador } = casa.justo.abrir(JOGO);
    const dados = derivar(gerador);
    const soma = dados[0] + dados[1];
    const pontoAntes = m.ponto;
    const r = resolver(m.apostas, pontoAntes, dados);

    let pago = 0;
    for (const e of r.eventos) pago += e.pago;
    if (pago > 0) casa.carteira.creditar(pago);

    m.apostas = r.apostas;
    m.ponto = r.ponto;
    m.lances++;

    const texto = textoDoLance(dados, soma, pontoAntes, r.ponto);
    casa.justo.revelar(JOGO, { dados, total: soma, texto });

    // Uma rodada do Livro por lance que DECIDIU alguma aposta. Um lance que só
    // estabelece o ponto, ou que só manda o Vem viajar, não arrisca nada.
    const decididos = r.eventos.filter(e => e.resultado !== 'moveu');
    let rodada = null;
    if (decididos.length) {
      const conta = contaDoLance(r.eventos, pontoAntes);
      rodada = casa.fecharRodada({
        jogo: JOGO,
        apostado: conta.apostado,
        retorno: conta.retorno,
        perdaEsperada: conta.perdaEsperada,
        variancia: conta.variancia,
        rotulo: texto,
        contador: registro.contador,
      });
    }

    m.historico.unshift({
      i: rodada ? rodada.i : null,
      dados,
      soma,
      ponto: r.ponto,
      texto,
      contador: registro.contador,
      hash: registro.hash,
      decididas: decididos.length,
    });
    if (m.historico.length > LIMITE_HISTORICO) m.historico.length = LIMITE_HISTORICO;

    casa.salvar();
    return { dados, total: soma, eventos: r.eventos, ponto: r.ponto, rodada };
  }

  const compromisso = () => casa.justo.compromisso(JOGO);

  return {
    JOGO,
    mesa: m,
    REGRAS,
    ZONAS,
    get ponto() { return m.ponto; },
    get apostas() { return m.apostas; },
    get historico() { return m.historico; },
    get lances() { return m.lances; },
    teto: zona => tetoDe(zona, m.apostas, m.ponto),
    ficha: zona => fichaDe(zona, m.ponto),
    apostar, retirar, podeApostar, podeRetirar, total, lancar, compromisso,
  };
}
