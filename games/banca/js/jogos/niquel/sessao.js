// A máquina MALECÓN 57, sem tela nenhuma.
//
// Cada giro é uma rodada verificável fechada em si: abre o compromisso, sorteia
// as cinco paradas, revela a semente com as paradas arquivadas. Um giro grátis
// é uma rodada igual às outras, com a diferença de não custar nada.
//
// Contabilidade no Livro: o giro PAGO entra com apostado = aposta total,
// retorno = o que aquele giro pagou, perda esperada = aposta total x (1 - RTP)
// e a variância medida por giro. Os giros grátis que ele abre entram como
// rodadas de apostado 0, retorno = prêmio, perda esperada 0 e variância 0:
// eles já estão dentro da expectativa do giro que os comprou, e cobrar de novo
// contaria a mesma perda duas vezes. Somando tudo, o Livro continua exato:
// o retorno menos o apostado é o dinheiro de verdade, e a perda esperada é a
// da aposta que foi feita.

import {
  REGRAS, APOSTAS_LINHA, N_LINHAS, GIROS_GRATIS, derivar, avaliar, rtpExato,
  varianciaPorGiro, textoDoGiro,
} from './regras.js';

export const JOGO = 'niquel';
export const LIMITE_HISTORICO = 20;

function mesaInicial() {
  return {
    apostaLinha: APOSTAS_LINHA[2],
    girosRestantes: 0,
    ganhoDoBonus: 0,
    girosDoBonus: 0,
    apostaDoBonus: 0,
    ultimo: null,
    historico: [],
  };
}

export function criarSessaoNiquel(casa) {
  const m = casa.mesa(JOGO);
  const padrao = mesaInicial();
  for (const chave of Object.keys(padrao)) if (m[chave] === undefined) m[chave] = padrao[chave];
  if (!APOSTAS_LINHA.includes(m.apostaLinha)) m.apostaLinha = padrao.apostaLinha;

  const emGirosGratis = () => m.girosRestantes > 0;
  const totalAposta = () => m.apostaLinha * N_LINHAS;

  function definirApostaLinha(centavos) {
    if (emGirosGratis()) throw new Error('A aposta não muda no meio dos giros grátis.');
    if (!APOSTAS_LINHA.includes(centavos)) {
      throw new Error(`A aposta por linha tem de ser uma destas: ${APOSTAS_LINHA.join(', ')} centavos.`);
    }
    m.apostaLinha = centavos;
    casa.salvar();
    return { eventos: [] };
  }

  function girar() {
    const gratis = emGirosGratis();
    const apostaLinha = gratis ? m.apostaDoBonus : m.apostaLinha;
    const apostado = gratis ? 0 : apostaLinha * N_LINHAS;
    const multiplicador = gratis ? GIROS_GRATIS.multiplicador : 1;

    if (!gratis) {
      if (!casa.carteira.pode(apostado)) throw new Error('Saldo insuficiente para esse giro.');
      casa.carteira.debitar(apostado);
    }

    const { registro, gerador } = casa.justo.abrir(JOGO);
    const paradas = derivar(gerador);
    const av = avaliar(paradas, apostaLinha, multiplicador);

    const eventos = [{ tipo: 'giro', paradas, janela: av.janela, gratis }];
    for (const l of av.linhas) eventos.push({ tipo: 'linha', linha: l.linha, simbolo: l.simbolo, quantidade: l.quantidade, pago: l.pago });
    if (av.disperso.quantidade >= 3) {
      eventos.push({ tipo: 'disperso', quantidade: av.disperso.quantidade, pago: av.disperso.pago, posicoes: av.disperso.posicoes });
    }

    if (av.total > 0) casa.carteira.creditar(av.total);

    if (gratis) {
      m.girosRestantes--;
      m.ganhoDoBonus += av.total;
    }
    if (av.giros > 0) {
      if (!gratis) {
        m.apostaDoBonus = apostaLinha;
        m.ganhoDoBonus = av.total;
        m.girosDoBonus = 0;
      }
      m.girosRestantes += av.giros;
      m.girosDoBonus += av.giros;
      eventos.push({ tipo: 'gratis', giros: av.giros, restantes: m.girosRestantes, retomada: gratis });
    }

    const texto = textoDoGiro(av, gratis);
    casa.justo.revelar(JOGO, { paradas, total: av.total, texto });

    const rodada = casa.fecharRodada({
      jogo: JOGO,
      apostado,
      retorno: av.total,
      perdaEsperada: gratis ? 0 : apostado * (1 - rtpExato().rtp),
      variancia: gratis ? 0 : apostado * apostado * varianciaPorGiro(),
      rotulo: texto,
      contador: registro.contador,
    });

    const fimDoBonus = gratis && m.girosRestantes === 0;
    if (fimDoBonus) eventos.push({ tipo: 'bonusFim', giros: m.girosDoBonus, ganho: m.ganhoDoBonus });
    eventos.push({ tipo: 'fim', rodada });

    m.ultimo = { paradas, total: av.total, gratis, texto, contador: registro.contador };
    m.historico.unshift({
      i: rodada.i,
      paradas,
      apostado,
      retorno: av.total,
      gratis,
      texto,
      contador: registro.contador,
      hash: registro.hash,
    });
    if (m.historico.length > LIMITE_HISTORICO) m.historico.length = LIMITE_HISTORICO;

    casa.salvar();
    return {
      paradas,
      avaliacao: av,
      eventos,
      gratis,
      girosRestantes: m.girosRestantes,
      ganhoDoBonus: m.ganhoDoBonus,
      rodada,
    };
  }

  const compromisso = () => casa.justo.compromisso(JOGO);

  return {
    JOGO,
    mesa: m,
    REGRAS,
    APOSTAS_LINHA,
    get estado() { return emGirosGratis() ? 'gratis' : 'pronto'; },
    get apostaLinha() { return m.apostaLinha; },
    get emGirosGratis() { return emGirosGratis(); },
    get girosRestantes() { return m.girosRestantes; },
    get girosDoBonus() { return m.girosDoBonus; },
    get ganhoDoBonus() { return m.ganhoDoBonus; },
    get ultimo() { return m.ultimo; },
    get historico() { return m.historico; },
    definirApostaLinha, totalAposta, girar, compromisso,
  };
}
