// Provas do vídeo pôquer Jacks or Better 9/6.
//
// Três coisas precisam ser verdade ao mesmo tempo: o classificador tem de
// conhecer pôquer (inclusive que A-2-3-4-5 é sequência e K-A-2-3-4 não é), o
// resolvedor rápido tem de dar exatamente o mesmo número que a força bruta que
// enumera sorteio por sorteio, e o retorno ótimo das 2.598.960 mãos tem de
// fechar em 99,54% com cinco moedas. As constantes gravadas são recalculadas
// aqui: nenhuma delas é digitada à mão.

import { bloco, prova, ok, igual, perto, entre, lanca, relatar, geradorRapido, fonteDeterministica } from './base.mjs';
import { criarCasa, armazemMemoria } from '../js/nucleo/casa.js';
import { criarGerador } from '../js/nucleo/justo.js';
import { lerCurto } from '../js/nucleo/baralho.js';
import { TABELA, CATEGORIAS, classificar, pagamento, derivar, maoFinal, MAX_MOEDAS } from '../js/jogos/videopoquer/regras.js';
import { construirTabelas, analisar, rtpOtimo, evPorForcaBruta, binomio } from '../js/jogos/videopoquer/analise.js';
import { CONSTANTES_VIDEOPOQUER, RTP5, RTP1A4, VARIANCIA5, VARIANCIA1A4 } from '../js/jogos/videopoquer/constantes.js';
import { criarSessaoVideoPoquer } from '../js/jogos/videopoquer/sessao.js';

const cs = lista => lista.map(lerCurto);

bloco('vídeo pôquer: classificação');

prova('as trinta e duas mãos da bateria caem na categoria certa', () => {
  const bateria = [
    [['10E', 'JE', 'QE', 'KE', 'AE'], 'royal', 'royal de espadas'],
    [['AP', 'KP', 'QP', 'JP', '10P'], 'royal', 'royal de paus, fora de ordem'],
    [['10E', 'JE', 'QE', 'KE', 'AC'], 'sequencia', '10-J-Q-K-A com um naipe trocado'],
    [['10E', 'JC', 'QO', 'KP', 'AE'], 'sequencia', '10-J-Q-K-A de naipes variados'],
    [['AE', '2E', '3E', '4E', '5E'], 'sequencia_de_cor', 'A-2-3-4-5 do mesmo naipe'],
    [['AE', '2C', '3O', '4P', '5E'], 'sequencia', 'A-2-3-4-5 de naipes variados'],
    [['9E', '10E', 'JE', 'QE', 'KE'], 'sequencia_de_cor', '9 ao K do mesmo naipe'],
    [['8O', '9O', '10O', 'JO', 'QO'], 'sequencia_de_cor', '8 ao Q do mesmo naipe'],
    [['KE', 'AE', '2E', '3E', '4E'], 'flush', 'K-A-2-3-4 do mesmo naipe é só flush'],
    [['KE', 'AC', '2O', '3P', '4E'], 'nada', 'K-A-2-3-4 não é sequência'],
    [['QE', 'KC', 'AO', '2P', '3E'], 'nada', 'Q-K-A-2-3 não é sequência'],
    [['JE', 'QC', 'KO', 'AP', '2E'], 'nada', 'J-Q-K-A-2 não é sequência'],
    [['2E', '3C', '4O', '5P', '6E'], 'sequencia', '2 ao 6'],
    [['5E', '6E', '7E', '8E', '9E'], 'sequencia_de_cor', '5 ao 9 do mesmo naipe'],
    [['AE', 'AC', 'AO', 'AP', 'KE'], 'quadra', 'quatro ases'],
    [['2E', '2C', '2O', '2P', '3E'], 'quadra', 'quatro dois'],
    [['AE', 'AC', 'AO', 'KP', 'KE'], 'full_house', 'ases com reis'],
    [['7E', '7C', '7O', '8P', '8E'], 'full_house', 'setes com oitos'],
    [['AE', '3E', '5E', '7E', '9E'], 'flush', 'flush de espadas'],
    [['2C', '5C', '9C', 'JC', 'KC'], 'flush', 'flush de copas'],
    [['AE', 'AC', 'AO', 'KP', 'QE'], 'trinca', 'três ases'],
    [['4E', '4C', '4O', '9P', '2E'], 'trinca', 'três quatros'],
    [['AE', 'AC', 'KO', 'KP', 'QE'], 'dois_pares', 'ases e reis'],
    [['3E', '3C', '4O', '4P', '5E'], 'dois_pares', 'três e quatro'],
    [['JE', 'JC', '3O', '7P', '9E'], 'par_de_valete', 'par de valetes'],
    [['QE', 'QC', '3O', '7P', '9E'], 'par_de_valete', 'par de damas'],
    [['KE', 'KC', '3O', '7P', '9E'], 'par_de_valete', 'par de reis'],
    [['AE', 'AC', '3O', '7P', '9E'], 'par_de_valete', 'par de ases'],
    [['10E', '10C', '3O', '7P', '9E'], 'nada', 'par de dez não paga'],
    [['9E', '9C', '3O', '7P', 'JE'], 'nada', 'par de nove não paga'],
    [['2E', '5C', '8O', 'JP', 'KE'], 'nada', 'mão morta'],
    [['2E', '4C', '6O', '8P', '10E'], 'nada', 'outra mão morta'],
  ];
  igual(bateria.length, 32, 'a bateria tem trinta e duas mãos');
  for (const [mao, esperado, nome] of bateria) igual(classificar(cs(mao)), esperado, nome);
});

prova('a ordem entre as categorias é a do pôquer', () => {
  const ordem = CATEGORIAS.map(c => TABELA[c].porMoeda);
  for (let i = 1; i < ordem.length; i++) ok(ordem[i] <= ordem[i - 1], `${CATEGORIAS[i]} não paga mais que ${CATEGORIAS[i - 1]}`);
  igual(TABELA.full_house.porMoeda, 9, 'full house 9');
  igual(TABELA.flush.porMoeda, 6, 'flush 6');
  igual(TABELA.royal.porMoeda, 250, 'royal 250 por moeda');
  igual(TABELA.royal.cincoMoedas, 800, 'royal 800 por moeda com cinco');
});

prova('a quinta moeda é a única que muda o royal', () => {
  igual(pagamento('royal', 1), 250, 'uma moeda');
  igual(pagamento('royal', 2), 500, 'duas moedas');
  igual(pagamento('royal', 4), 1000, 'quatro moedas');
  igual(pagamento('royal', 5), 4000, 'cinco moedas');
  igual(pagamento('sequencia_de_cor', 5), 250, 'straight flush não muda');
  igual(pagamento('quadra', 5), 125, 'quadra não muda');
  igual(pagamento('par_de_valete', 3), 3, 'par de valetes com três moedas');
  igual(pagamento('nada', 5), 0, 'nada paga nada');
  lanca(() => pagamento('inexistente', 1), 'categoria desconhecida lança');
});

prova('derivar entrega um baralho de 52 cartas sem repetição', () => {
  const casa = criarCasa({ armazem: armazemMemoria(), fonte: fonteDeterministica(3) });
  const { registro, gerador } = casa.justo.abrir('videopoquer');
  const baralho = derivar(gerador);
  igual(baralho.length, 52, '52 cartas');
  igual(new Set(baralho).size, 52, 'nenhuma repetida');
  const outro = derivar(criarGerador(registro.semente, registro.sementeJogador, registro.contador));
  igual(outro.join(','), baralho.join(','), 'a semente recalcula o mesmo baralho');
  // A troca tira as substitutas de 5 em diante, na ordem das posições.
  const final = maoFinal(baralho, [true, false, true, false, false]);
  igual(final[0], baralho[0], 'posição segurada fica');
  igual(final[1], baralho[5], 'primeira trocada recebe a carta 5');
  igual(final[2], baralho[2], 'posição segurada fica');
  igual(final[3], baralho[6], 'segunda trocada recebe a carta 6');
  igual(final[4], baralho[7], 'terceira trocada recebe a carta 7');
});

bloco('vídeo pôquer: resolvedor exato');

const tabelas = construirTabelas({ quadrados: true });

prova('as tabelas de subconjuntos ficam de pé em menos de 1,5 s', () => {
  ok(tabelas.ms < 1500, `construirTabelas levou ${tabelas.ms.toFixed(0)} ms`);
  igual(tabelas.paga[5].length, 2598960, 'a tabela de tamanho 5 tem uma entrada por mão');
  igual(tabelas.paga[0][0], tabelas.paga[1].reduce((a, b) => a + b, 0) / 5, 'somar por carta conta cada mão cinco vezes');
  relatar(`  vídeo pôquer  construirTabelas ${tabelas.ms.toFixed(0)} ms`);
});

prova('o VE das 32 retenções bate com a força bruta em 40 mãos sorteadas', () => {
  const g = geradorRapido(2026);
  let pior = 0;
  let conferidos = 0;
  const t0 = performance.now();
  for (let k = 0; k < 40; k++) {
    const baralho = [...Array(52).keys()];
    g.embaralhar(baralho);
    const mao = baralho.slice(0, 5);
    const moedas = k % 2 === 0 ? 5 : 3;
    const { evs } = analisar(mao, tabelas, moedas);
    for (let m = 0; m < 32; m++) {
      const bruto = evPorForcaBruta(mao, m, moedas);
      pior = Math.max(pior, Math.abs(bruto - evs[m]));
      conferidos++;
    }
  }
  igual(conferidos, 1280, '40 mãos vezes 32 retenções');
  ok(pior <= 1e-9, `maior diferença ${pior}`);
  relatar(`  vídeo pôquer  resolvedor x força bruta: ${conferidos} VEs, maior diferença ${pior.toExponential(1)} (${((performance.now() - t0) / 1000).toFixed(1)} s)`);
});

prova('analisar responde em bem menos de 5 ms', () => {
  const g = geradorRapido(77);
  const maos = [];
  for (let k = 0; k < 300; k++) {
    const baralho = [...Array(52).keys()];
    g.embaralhar(baralho);
    maos.push(baralho.slice(0, 5));
  }
  const t0 = performance.now();
  for (const mao of maos) analisar(mao, tabelas, 5);
  const ms = (performance.now() - t0) / maos.length;
  ok(ms < 5, `analisar levou ${ms.toFixed(3)} ms por mão`);
  relatar(`  vídeo pôquer  analisar ${ms.toFixed(3)} ms por mão`);
});

prova('o resolvedor acerta as jogadas óbvias', () => {
  const royalServido = cs(['10E', 'JE', 'QE', 'KE', 'AE']);
  const r = analisar(royalServido, tabelas, 5);
  igual(r.melhor, 31, 'royal servido segura tudo');
  perto(r.evs[31], 800, 1e-9, 'e vale 800 por moeda');

  const quatroDoRoyal = cs(['10E', 'JE', 'QE', 'KE', '3C']);
  const q = analisar(quatroDoRoyal, tabelas, 5);
  igual(q.melhor, 0b01111, 'quatro do royal descarta a carta solta');

  const parDeValetes = cs(['JE', 'JC', '3O', '7P', '9E']);
  igual(analisar(parDeValetes, tabelas, 5).melhor, 0b00011, 'segura só o par de valetes');

  const lixo = cs(['2E', '5C', '8O', 'JP', 'KE']);
  const l = analisar(lixo, tabelas, 5);
  igual(l.melhor, 0b11000, 'mão morta segura as duas cartas altas');

  // Quadra servida: trocar a quinta carta dá exatamente o mesmo VE, porque em
  // Jacks or Better o kicker não paga nada. É empate, e a regra de desempate
  // declarada em analise.js manda segurar mais cartas.
  const quadra = cs(['9E', '9C', '9O', '9P', '2E']);
  const k = analisar(quadra, tabelas, 5);
  perto(k.evs[0b01111], k.evs[31], 1e-9, 'segurar quatro ou cinco dá o mesmo VE');
  perto(k.evs[31], 25, 1e-9, 'e vale 25 por moeda');
  igual(k.melhor, 31, 'no empate fica a retenção com mais cartas');
});

prova('com quatro moedas o royal vale menos e o conselho pode mudar', () => {
  const quatroDoRoyal = cs(['10E', 'JE', 'QE', 'KE', '3C']);
  const cinco = analisar(quatroDoRoyal, tabelas, 5);
  const uma = analisar(quatroDoRoyal, tabelas, 1);
  ok(cinco.evs[0b01111] > uma.evs[0b01111], 'a quinta moeda vale mais por moeda no royal');
  const parServido = cs(['AE', 'AC', 'AO', 'KP', 'KE']);
  perto(analisar(parServido, tabelas, 5).evs[31], 9, 1e-9, 'full house servido paga 9 por moeda');
});

bloco('vídeo pôquer: retorno e constantes');

const otimo5 = rtpOtimo(tabelas, 5);
const otimo1 = rtpOtimo(tabelas, 1);

prova('o retorno ótimo com cinco moedas é 99,54%', () => {
  igual(otimo5.maos, 2598960, 'enumerou todas as mãos iniciais');
  entre(otimo5.rtp, 0.994, 0.997, 'retorno ótimo');
  igual((otimo5.rtp * 100).toFixed(2), '99.54', 'duas casas');
  ok(otimo5.rtp < 1, 'o jogo favorece a casa mesmo jogado sem um erro');
  relatar(`  vídeo pôquer  retorno ótimo ${(otimo5.rtp * 100).toFixed(4)} % com 5 moedas (${(otimo5.ms / 1000).toFixed(1)} s)`);
  relatar(`                retorno ótimo ${(otimo1.rtp * 100).toFixed(4)} % com 1 a 4 moedas`);
  relatar(`                variância por moeda ${otimo5.variancia.toFixed(3)} (5 moedas), ${otimo1.variancia.toFixed(3)} (1 a 4)`);
});

prova('as constantes gravadas são exatamente as recalculadas agora', () => {
  igual(RTP5, otimo5.rtp, 'RTP5');
  igual(RTP1A4, otimo1.rtp, 'RTP1A4');
  igual(VARIANCIA5, otimo5.variancia, 'VARIANCIA5');
  igual(VARIANCIA1A4, otimo1.variancia, 'VARIANCIA1A4');
  perto(CONSTANTES_VIDEOPOQUER.VANTAGEM5, 1 - otimo5.rtp, 1e-15, 'vantagem com cinco moedas');
  perto(CONSTANTES_VIDEOPOQUER.VANTAGEM1A4, 1 - otimo1.rtp, 1e-15, 'vantagem com uma a quatro moedas');
  igual(CONSTANTES_VIDEOPOQUER.maos, 2598960, 'mãos enumeradas');
  ok(CONSTANTES_VIDEOPOQUER.VANTAGEM5 > 0, 'a casa ganha até do jogador perfeito');
  ok(CONSTANTES_VIDEOPOQUER.VANTAGEM1A4 > CONSTANTES_VIDEOPOQUER.VANTAGEM5, 'jogar com menos de cinco moedas custa caro');
});

prova('a variância do vídeo pôquer é a de um jogo de prêmio raro', () => {
  ok(otimo5.variancia > 15 && otimo5.variancia < 25, `variância ${otimo5.variancia.toFixed(3)} por moeda`);
  ok(otimo1.variancia < otimo5.variancia, 'sem o royal de 800 a variância cai');
  // Desvio padrão de uma rodada perto de 4,4 moedas: o royal é quase toda ela.
  perto(Math.sqrt(otimo5.variancia), 4.42, 0.1, 'desvio padrão por moeda');
});

prova('a aritmética dos sorteios fecha', () => {
  igual(binomio(52, 5), 2598960, 'C(52,5)');
  igual(binomio(47, 5), 1533939, 'C(47,5)');
  igual(binomio(47, 0), 1, 'C(47,0)');
});

bloco('vídeo pôquer: mesa');

function montarMesa(opcoes = {}) {
  const armazem = opcoes.armazem ?? armazemMemoria();
  const casa = criarCasa({ armazem, fonte: fonteDeterministica(opcoes.semente ?? 11) });
  if (opcoes.saldo !== undefined) casa.carteira.estado.saldo = opcoes.saldo;
  const s = criarSessaoVideoPoquer(casa, { analisar: (mao, moedas) => analisar(mao, tabelas, moedas) });
  s.definirMoeda(opcoes.moeda ?? 100);
  s.definirMoedas(opcoes.moedas ?? 5);
  return { casa, s, armazem };
}

prova('dar debita a aposta e põe cinco cartas na mesa', () => {
  const { casa, s } = montarMesa();
  const saldo = casa.carteira.saldo;
  igual(s.aposta, 500, 'cinco moedas de uma ficha');
  const { eventos } = s.dar();
  igual(s.estado, 'descarte', 'estado de descarte');
  igual(eventos.length, 5, 'cinco eventos de carta');
  igual(eventos.map(e => e.posicao).join(','), '0,1,2,3,4', 'nas cinco posições');
  igual(casa.carteira.saldo, saldo - 500, 'debitou a aposta');
  igual(s.mao.join(','), s.baralho.slice(0, 5).join(','), 'a mão é o topo do baralho');
  igual(s.segurar.filter(Boolean).length, 0, 'nada segurado');
});

prova('alternar liga e desliga a carta', () => {
  const { s } = montarMesa();
  s.dar();
  s.alternar(2);
  ok(s.segurar[2], 'ligou');
  s.alternar(2);
  ok(!s.segurar[2], 'desligou');
  lanca(() => s.alternar(9), 'posição inexistente');
});

prova('trocar paga exatamente o que a tabela diz', () => {
  for (const [mao, categoria] of [
    [['AE', 'AC', 'AO', 'KP', 'KE'], 'full_house'],
    [['10E', 'JE', 'QE', 'KE', 'AE'], 'royal'],
    [['9E', '9C', '9O', '9P', '2E'], 'quadra'],
    [['JE', 'JC', '3O', '7P', '9E'], 'par_de_valete'],
    [['2E', '5C', '8O', 'JP', 'KE'], 'nada'],
  ]) {
    const { casa, s } = montarMesa({ moeda: 100, moedas: 5 });
    const saldo = casa.carteira.saldo;
    s.dar();
    s.mesa.mao = cs(mao);
    for (let i = 0; i < 5; i++) s.mesa.segurar[i] = true;
    const { eventos } = s.trocar();
    const res = eventos.find(e => e.tipo === 'resultado');
    igual(res.categoria, categoria, `categoria de ${mao.join(' ')}`);
    igual(res.pago, pagamento(categoria, 5) * 100, `pagamento de ${categoria}`);
    igual(casa.carteira.saldo, saldo - 500 + res.pago, 'saldo bate');
    igual(s.estado, 'fim', 'rodada encerrada');
  }
});

prova('a troca tira as substitutas do baralho revelado, na ordem', () => {
  const { casa, s } = montarMesa();
  s.dar();
  const baralho = s.baralho.slice();
  const maoInicial = s.mao.slice();
  s.alternar(0);
  s.alternar(3);
  const segurou = s.segurar.slice();
  const { eventos } = s.trocar();
  const trocadas = eventos.filter(e => e.tipo === 'trocar');
  igual(trocadas.length, 3, 'três cartas trocadas');
  igual(trocadas.map(e => e.carta).join(','), [baralho[5], baralho[6], baralho[7]].join(','), 'as substitutas saem em ordem');
  igual(s.mao.join(','), maoFinal(baralho, segurou).join(','), 'a mão final é a mão dada com as substitutas nos lugares trocados');
  igual(s.mao[0], maoInicial[0], 'a carta segurada não se mexeu');
  igual(s.mao[3], maoInicial[3], 'a outra segurada também não');

  const revelado = casa.justo.revelados.at(-1);
  const recomputado = derivar(criarGerador(revelado.semente, revelado.sementeJogador, revelado.contador));
  igual(recomputado.slice(0, 10).join(','), baralho.slice(0, 10).join(','), 'a semente revelada devolve as mesmas dez cartas');
  igual(revelado.resultado.mao.join(','), maoInicial.join(','), 'o resumo guarda a mão dada');
  igual(maoFinal(recomputado, segurou).join(','), s.mao.join(','), 'e a mão final se recalcula do zero');
});

prova('seguir o melhor descarte custa zero e errar custa mais que zero', () => {
  const { casa, s } = montarMesa({ semente: 31 });
  s.dar();
  const bom = s.conselho();
  for (let i = 0; i < 5; i++) if ((bom.melhor >> i) & 1) s.alternar(i);
  igual(s.conselho().evEscolha, bom.evMelhor, 'a escolha virou a melhor');
  igual(s.conselho().custo, 0, 'custo zero');
  s.trocar();
  igual(casa.livro.estado.rodadas.at(-1).custoErro, 0, 'o Livro registra erro zero');

  const { casa: casa2, s: s2 } = montarMesa({ semente: 31 });
  s2.dar();
  const { evs, melhor } = analisar(s2.mao, tabelas, s2.moedas);
  let pior = 0;
  for (let m = 1; m < 32; m++) if (evs[m] < evs[pior]) pior = m;
  ok(evs[pior] < evs[melhor], 'existe descarte pior que o ótimo');
  for (let i = 0; i < 5; i++) if ((pior >> i) & 1) s2.alternar(i);
  const cons = s2.conselho();
  ok(cons.custo > 0, 'o conselho cobra o erro');
  s2.trocar();
  const r = casa2.livro.estado.rodadas.at(-1);
  ok(r.custoErro > 0, 'o Livro registra o erro');
  perto(r.custoErro, (evs[melhor] - evs[pior]) * 5 * 100, 1e-9, 'custo em centavos');
});

prova('o Livro recebe a perda esperada e a variância do vídeo pôquer', () => {
  const { casa, s } = montarMesa({ moeda: 500, moedas: 5 });
  s.dar();
  s.trocar();
  const r = casa.livro.estado.rodadas.at(-1);
  igual(r.jogo, 'videopoquer', 'jogo');
  igual(r.apostado, 2500, 'cinco moedas de cinco fichas');
  perto(r.perdaEsperada, 2500 * (1 - RTP5), 1e-12, 'perda esperada');
  perto(r.variancia, 2500 ** 2 * VARIANCIA5, 1e-6, 'variância');
  ok(r.rotulo.length > 0, 'rótulo em português');

  const { casa: c2, s: s2 } = montarMesa({ moeda: 100, moedas: 3 });
  s2.dar();
  s2.trocar();
  const r2 = c2.livro.estado.rodadas.at(-1);
  perto(r2.perdaEsperada, 300 * (1 - RTP1A4), 1e-12, 'com três moedas a perda esperada é maior por ficha');
  perto(r2.variancia, 300 ** 2 * VARIANCIA1A4, 1e-6, 'variância com três moedas');
});

prova('o saldo nunca fica negativo', () => {
  const { casa, s } = montarMesa({ saldo: 400, moeda: 100, moedas: 5 });
  lanca(() => s.dar(), 'saldo insuficiente para cinco moedas');
  igual(casa.carteira.saldo, 400, 'nada debitado');
  s.definirMoedas(4);
  s.dar();
  igual(casa.carteira.saldo, 0, 'gastou tudo');
  s.trocar();
  ok(casa.carteira.saldo >= 0, 'nunca negativo');
});

prova('a mesa recusa moeda e número de moedas fora da tabela', () => {
  const { s } = montarMesa();
  lanca(() => s.definirMoeda(250), 'moeda inválida');
  lanca(() => s.definirMoedas(0), 'zero moedas');
  lanca(() => s.definirMoedas(6), 'seis moedas');
  s.dar();
  lanca(() => s.definirMoedas(1), 'não se muda a aposta no meio da rodada');
  lanca(() => s.dar(), 'não se pede mão nova antes de trocar');
});

prova('recarregar no meio do descarte devolve a mesma mão', () => {
  const armazem = armazemMemoria();
  const { s } = montarMesa({ armazem });
  s.dar();
  s.alternar(1);
  const maoAntes = s.mao.slice();
  const baralhoAntes = s.baralho.slice();

  const casa2 = criarCasa({ armazem, fonte: fonteDeterministica(999) });
  const s2 = criarSessaoVideoPoquer(casa2, { analisar: (mao, moedas) => analisar(mao, tabelas, moedas) });
  igual(s2.estado, 'descarte', 'continua no descarte');
  igual(s2.mao.join(','), maoAntes.join(','), 'a mesma mão');
  igual(s2.segurar.join(','), s.segurar.join(','), 'as mesmas cartas seguradas');
  igual(s2.baralho.join(','), baralhoAntes.join(','), 'o baralho foi recalculado do registro aberto');
  s2.trocar();
  igual(s2.estado, 'fim', 'dá para terminar a rodada');
});

prova('o histórico guarda as últimas rodadas em português', () => {
  const { s } = montarMesa();
  for (let k = 0; k < 3; k++) { s.dar(); s.trocar(); }
  igual(s.historico.length, 3, 'três rodadas');
  ok(s.historico.every(h => typeof h.rotulo === 'string' && h.rotulo.length > 0), 'todas com rótulo');
  ok(/Sequência|Quadra|Flush|Nada|Valetes|Full house|Trinca|Dois pares|Straight|Royal/.test(s.historico[0].rotulo), 'nome da categoria em português');
  ok(!/[\u2660-\u2667]/.test(JSON.stringify(s.historico)), 'sem naipes Unicode');
});
