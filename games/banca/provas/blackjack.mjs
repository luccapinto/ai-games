// Provas do blackjack: as regras da mesa, o cartório do sapato, a carteira e a
// vantagem da casa medida em milhões de mãos.
//
// Nada aqui confere um número contra um número escrito à mão: a vantagem sai
// de uma simulação com semente fixa e é comparada, em erros padrão, com a que
// ferramentas/simular_blackjack.mjs gravou em vantagem.js.

import { bloco, prova, ok, igual, perto, entre, lanca, relatar, fonteDeterministica } from './base.mjs';
import { criarCasa, armazemMemoria } from '../js/nucleo/casa.js';
import { criarGerador, conferirHash } from '../js/nucleo/justo.js';
import { lerCurto, carta, curto } from '../js/nucleo/baralho.js';
import {
  REGRAS, TOTAL_SAPATO, valorMao, valorCarta, bancaDeveComprar, derivar, conferir as conferirBJ,
} from '../js/jogos/blackjack/regras.js';
import { acaoBasica, DURO, MACIO, PARES } from '../js/jogos/blackjack/estrategia.js';
import { avaliar, melhorAcao, distribuicaoBanca, evParar, evComprar, evDobrar, evDividir } from '../js/jogos/blackjack/ev.js';
import { VANTAGEM_BLACKJACK, VANTAGEM_SEGURO, VARIANCIA_SEGURO, vantagemSeguro } from '../js/jogos/blackjack/vantagem.js';
import { criarSessaoBlackjack } from '../js/jogos/blackjack/sessao.js';
import { simularBlackjack, consolidar } from '../ferramentas/simular_blackjack.mjs';

const c = t => lerCurto(t);
const cs = lista => lista.map(c);

// Uma mesa de provas: abre o sapato, cria a sessão e escreve as cartas que a
// cena precisa por cima do começo do sapato. O resto do sapato continua lá.
function mesa(cartas = [], opcoes = {}) {
  const armazem = opcoes.armazem ?? armazemMemoria();
  const casa = criarCasa({ armazem, fonte: fonteDeterministica(opcoes.semente ?? 7) });
  casa.justo.abrir('blackjack');
  const s = criarSessaoBlackjack(casa);
  if (opcoes.saldo !== undefined) casa.carteira.estado.saldo = opcoes.saldo;
  const sapato = s.cartasDoSapato;
  for (let i = 0; i < cartas.length; i++) sapato[i] = c(cartas[i]);
  s.definirAposta(opcoes.aposta ?? 1000);
  return { casa, s, armazem };
}

bloco('blackjack: contagem da mão');

prova('total duro, macio e o rebaixamento do ás', () => {
  igual(valorMao(cs(['KE', '9C'])).total, 19, 'K+9');
  const macio = valorMao(cs(['AE', '6C']));
  igual(macio.total, 17, 'A+6');
  ok(macio.macio, 'A+6 é macio');
  const duro = valorMao(cs(['AE', '6C', 'KE']));
  igual(duro.total, 17, 'A+6+K rebaixa o ás');
  ok(!duro.macio, 'A+6+K é duro');
  ok(valorMao(cs(['KE', 'QC', '5O'])).estourou, '25 estoura');
});

prova('vários ases nunca passam de um contando 11', () => {
  igual(valorMao(cs(['AE', 'AC'])).total, 12, 'A+A');
  igual(valorMao(cs(['AE', 'AC', 'AO'])).total, 13, 'três ases');
  igual(valorMao(cs(['AE', 'AC', 'AO', '8E'])).total, 21, 'três ases e um oito');
  igual(valorMao(cs(['AE', 'AC', 'AO', 'AP', '8E'])).total, 12, 'quatro ases e um oito rebaixam todos menos um');
  const onzeAses = Array.from({ length: 11 }, (_, i) => carta(0, i % 4));
  igual(valorMao(onzeAses).total, 21, 'onze ases');
});

prova('blackjack só existe em duas cartas e não em mão dividida', () => {
  ok(valorMao(cs(['AE', 'KC'])).blackjack, 'A+K é blackjack');
  ok(!valorMao(cs(['AE', 'KC']), true).blackjack, 'A+K de uma divisão não é blackjack');
  ok(!valorMao(cs(['5E', '6C', 'KO'])).blackjack, '21 de três cartas não é blackjack');
  ok(!valorMao(cs(['AE', '9C'])).blackjack, '20 não é blackjack');
});

prova('a banca para em todo 17, inclusive no macio', () => {
  ok(REGRAS.s17, 'a mesa é S17');
  ok(!bancaDeveComprar(cs(['AE', '6C'])), 'para no 17 macio');
  ok(bancaDeveComprar(cs(['AE', '5C'])), 'compra no 16 macio');
  ok(!bancaDeveComprar(cs(['KE', '7C'])), 'para no 17 duro');
  ok(bancaDeveComprar(cs(['KE', '6C'])), 'compra no 16 duro');
  ok(!bancaDeveComprar(cs(['AE', '6C', 'KO'])), 'para no 17 duro de três cartas');
});

bloco('blackjack: pagamentos da mesa');

prova('o natural paga 3 para 2 em centavo exato', () => {
  const { casa, s } = mesa(['AE', '5C', 'KE', '9C'], { aposta: 1000 });
  const saldo = casa.carteira.saldo;
  const { eventos } = s.dar();
  igual(s.estado, 'fim', 'o natural resolve na hora');
  const res = eventos.find(e => e.tipo === 'resultado');
  igual(res.resultado, 'blackjack', 'resultado');
  igual(res.pago, 2500, 'devolve 1000 e paga 1500');
  igual(casa.carteira.saldo, saldo + 1500, 'saldo sobe 1,5 aposta');
  igual(casa.carteira.saldo % 1, 0, 'centavo inteiro');
});

prova('com aposta de 5 fichas o 3 para 2 ainda é inteiro', () => {
  const { casa, s } = mesa(['AE', '5C', 'KE', '9C'], { aposta: 500 });
  const saldo = casa.carteira.saldo;
  s.dar();
  igual(casa.carteira.saldo - saldo, 750, 'paga 750 centavos');
});

prova('a aposta só aceita fichas inteiras dentro do limite', () => {
  const { s } = mesa([]);
  lanca(() => s.definirAposta(150), 'aposta quebrada');
  lanca(() => s.definirAposta(REGRAS.minimo - 100), 'abaixo do mínimo');
  lanca(() => s.definirAposta(REGRAS.maximo + 100), 'acima do máximo');
  s.definirAposta(2000);
  igual(s.aposta, 2000, 'aposta válida entra');
});

bloco('blackjack: seguro e peek');

prova('o seguro custa metade e paga 2 para 1', () => {
  const { casa, s } = mesa(['8E', 'AE', '9C', 'KE'], { aposta: 1000 });
  const saldo = casa.carteira.saldo;
  const r = s.dar();
  igual(s.estado, 'seguro', 'ás aberto oferece seguro');
  ok(r.eventos.some(e => e.tipo === 'seguro' && e.oferecido), 'evento de oferta');
  const r2 = s.seguro(true);
  igual(casa.carteira.saldo, saldo + 0, 'perde a aposta, recupera no seguro: fica zerado');
  const pago = r2.eventos.find(e => e.tipo === 'seguro' && e.pago !== undefined);
  igual(pago.pago, 1500, 'meio seguro de 500 paga 1500');
  igual(s.estado, 'fim', 'o blackjack da banca encerra a rodada');
});

prova('recusar o seguro com blackjack da banca perde só a aposta', () => {
  const { casa, s } = mesa(['8E', 'AE', '9C', 'KE'], { aposta: 1000 });
  const saldo = casa.carteira.saldo;
  s.dar();
  s.seguro(false);
  igual(casa.carteira.saldo, saldo - 1000, 'perde a aposta');
  igual(s.estado, 'fim', 'acabou');
});

prova('o peek com dez aberto encerra a rodada antes de qualquer ação', () => {
  const { casa, s } = mesa(['9E', 'KC', '8C', 'AE'], { aposta: 1000 });
  const saldo = casa.carteira.saldo;
  const { eventos } = s.dar();
  igual(s.estado, 'fim', 'a rodada acabou no peek');
  igual(s.acoes().length, 0, 'não há ação');
  ok(eventos.some(e => e.tipo === 'revelar'), 'a carta furada foi revelada');
  igual(casa.carteira.saldo, saldo - 1000, 'perdeu a aposta');
});

prova('o seguro tem valor esperado negativo e é aritmética, não simulação', () => {
  perto(VANTAGEM_SEGURO, 1 - 3 * (96 / 311), 1e-15, 'fórmula do seguro');
  ok(VANTAGEM_SEGURO > 0, 'a casa ganha no seguro');
  perto(vantagemSeguro(1), 1 - 3 * (16 / 51), 1e-15, 'um baralho');
  perto(vantagemSeguro(8), 1 - 3 * (128 / 415), 1e-15, 'oito baralhos');
  const p = 96 / 311;
  perto(VARIANCIA_SEGURO, (4 * p + (1 - p)) - (3 * p - 1) ** 2, 1e-12, 'variância do seguro');
});

bloco('blackjack: dobrar, dividir e desistir');

prova('dobrar recebe exatamente uma carta e para', () => {
  const { casa, s } = mesa(['5E', '6C', '6E', 'KC', '9O', 'KP'], { aposta: 1000 });
  const saldo = casa.carteira.saldo;
  s.dar();
  ok(s.acoes().includes('dobrar'), 'dobra oferecida no 11');
  const { eventos } = s.agir('dobrar');
  const dadas = eventos.filter(e => e.tipo === 'carta' && e.alvo === 'jogador');
  igual(dadas.length, 1, 'uma carta só');
  ok(dadas[0].deitada, 'a carta da dobra vem deitada');
  igual(s.maos[0].cartas.length, 3, 'três cartas na mão');
  ok(s.maos[0].dobrada, 'marcada como dobrada');
  igual(s.estado, 'fim', 'a rodada resolveu');
  igual(casa.carteira.saldo, saldo + 2000, '20 contra banca estourada paga 4000 sobre 2000 apostados');
});

prova('dividir ases dá uma carta a cada mão e nenhuma delas joga', () => {
  const { s } = mesa(['AE', '5C', 'AC', 'KE', '9O', '7P'], { aposta: 1000 });
  s.dar();
  ok(s.acoes().includes('dividir'), 'par de ases divide');
  s.agir('dividir');
  igual(s.maos.length, 2, 'duas mãos');
  igual(s.maos[0].cartas.length, 2, 'a primeira recebeu uma carta');
  igual(s.maos[1].cartas.length, 2, 'a segunda recebeu uma carta');
  ok(s.maos[0].deAses && s.maos[1].deAses, 'marcadas como ases divididos');
  ok(s.maos[0].terminada && s.maos[1].terminada, 'nenhuma joga');
  igual(s.acoes().length, 0, 'nada a fazer');
  ok(!valorMao(s.maos[0].cartas, true).blackjack, '21 de mão dividida não é blackjack');
});

prova('ás dividido que recebe outro ás não divide de novo', () => {
  const { s } = mesa(['AE', '5C', 'AC', 'KE', 'AO', 'AP'], { aposta: 1000 });
  s.dar();
  s.agir('dividir');
  igual(s.maos.length, 2, 'continua em duas mãos');
  ok(!REGRAS.resplitAses, 'a mesa não permite resplit de ases');
  igual(s.acoes().length, 0, 'sem ação nas mãos de ás');
});

prova('divide até 4 mãos e não passa disso', () => {
  const { s } = mesa(['8E', '6C', '8C', 'KE', '8O', '8P', '8E', '9O', '9C', '9P', '2E'], { aposta: 1000, saldo: 100000 });
  s.dar();
  s.agir('dividir');
  igual(s.maos.length, 2, 'duas');
  s.agir('dividir');
  igual(s.maos.length, 3, 'três');
  s.agir('dividir');
  igual(s.maos.length, 4, 'quatro');
  igual(s.maos[0].cartas.length, 2, 'a mão em jogo tem duas cartas');
  igual(valorCarta(s.maos[0].cartas[0]), valorCarta(s.maos[0].cartas[1]), 'e ainda é um par');
  ok(!s.acoes().includes('dividir'), 'a quinta mão não é oferecida');
  igual(REGRAS.maxMaos, 4, 'o limite é 4');
});

prova('qualquer duas cartas de mesmo valor dividem, dez com dama inclusive', () => {
  const { s } = mesa(['10E', '6C', 'QC', 'KE', '9O', '9C', '5P', '4E'], { aposta: 1000 });
  s.dar();
  ok(s.acoes().includes('dividir'), 'dez e dama dividem');
});

prova('a desistência tardia devolve metade e só na primeira decisão', () => {
  const { casa, s } = mesa(['KE', 'KC', '6C', '9O'], { aposta: 1000 });
  const saldo = casa.carteira.saldo;
  ok(s.REGRAS.desistencia === 'tardia', 'desistência tardia');
  s.dar();
  ok(s.acoes().includes('desistir'), '16 contra dez oferece desistência');
  const { eventos } = s.agir('desistir');
  igual(eventos.find(e => e.tipo === 'resultado').pago, 500, 'metade volta');
  igual(casa.carteira.saldo, saldo - 500, 'perde metade');
});

prova('depois de comprar não dá mais para desistir', () => {
  const { s } = mesa(['KE', 'KC', '6C', '9O', '2E', '3C'], { aposta: 1000 });
  s.dar();
  s.agir('pedir');
  ok(!s.acoes().includes('desistir'), 'não se desiste de mão de três cartas');
  lanca(() => s.agir('desistir'), 'ação ilegal lança');
});

prova('não se desiste de mão dividida', () => {
  const { s } = mesa(['8E', '6C', '8C', 'KE', '3O', '4P', '5E', '6O'], { aposta: 1000, saldo: 100000 });
  s.dar();
  s.agir('dividir');
  ok(!s.acoes().includes('desistir'), 'mão dividida não desiste');
});

bloco('blackjack: sapato verificável');

prova('derivar reproduz o sapato inteiro a partir da semente revelada', () => {
  const casa = criarCasa({ armazem: armazemMemoria(), fonte: fonteDeterministica(21) });
  const { registro, gerador } = casa.justo.abrir('blackjack');
  const sapato = derivar(gerador);
  igual(sapato.length, TOTAL_SAPATO, '312 cartas');
  const conta = new Map();
  for (const x of sapato) conta.set(x, (conta.get(x) ?? 0) + 1);
  igual(conta.size, 52, '52 cartas distintas');
  for (const [, n] of conta) igual(n, REGRAS.baralhos, 'cada carta aparece 6 vezes');
  const outra = derivar(criarGerador(registro.semente, registro.sementeJogador, registro.contador));
  igual(outra.join(','), sapato.join(','), 'recalcula igual');
  ok(conferirHash(registro.semente, registro.hash), 'o hash publicado era da semente');
});

prova('a carta de corte troca o sapato, revela o antigo e abre um compromisso novo', () => {
  const { casa, s } = mesa([], { aposta: 1000 });
  const hashAntigo = s.sapato.hash;
  const sapatoAntigo = s.cartasDoSapato.slice();
  igual(s.sapato.corte, 234, 'corte na 234');
  s.mesa.pos = REGRAS.corte;
  const { eventos } = s.dar();
  igual(eventos[0].tipo, 'embaralhar', 'primeiro evento é o embaralhamento');
  ok(s.sapato.hash !== hashAntigo, 'compromisso novo');
  ok(s.sapato.pos <= 10, 'o sapato novo começou do zero');
  const revelado = casa.justo.revelados[casa.justo.revelados.length - 1];
  ok(conferirHash(revelado.semente, hashAntigo), 'a semente revelada bate com o hash publicado');
  igual(revelado.resultado.usadas, REGRAS.corte, 'o resumo diz quantas cartas saíram');
  ok(conferirBJ(revelado).confere, 'o Conferir refaz o sapato e bate a sequência usada');
  const recomputado = derivar(criarGerador(revelado.semente, revelado.sementeJogador, revelado.contador));
  igual(recomputado.join(','), sapatoAntigo.join(','), 'a semente revelada devolve o mesmo sapato');
});

prova('cada rodada guarda as posições do sapato que usou', () => {
  const { s } = mesa(['9E', '7C', '8C', 'KE', '5O', '2P'], { aposta: 1000 });
  const sapato = s.cartasDoSapato.slice();
  s.dar();
  while (s.estado === 'jogando') s.agir('parar');
  const h = s.historico[0];
  igual(h.posInicio, 0, 'começou na posição zero');
  ok(h.posFim > h.posInicio, 'usou cartas');
  const usadas = sapato.slice(h.posInicio, h.posFim);
  const naMesa = [...h.maos.flatMap(x => x.cartas), ...h.banca];
  igual(naMesa.length, usadas.length, 'todas as cartas da rodada saíram dessas posições');
  igual(usadas.slice().sort((a, b) => a - b).join(','), naMesa.slice().sort((a, b) => a - b).join(','), 'as mesmas cartas');
});

prova('recarregar no meio da rodada devolve a mesma mesa', () => {
  // Sem cartas encenadas: o sapato tem de sair de novo do gerador, e é isso
  // que esta prova mede. Procura uma semente em que a rodada fique em jogo.
  let armazem = null, s = null;
  for (let semente = 1; semente < 60 && !s; semente++) {
    const a = armazemMemoria();
    const r = mesa([], { aposta: 1000, armazem: a, semente });
    r.s.dar();
    if (r.s.estado === 'jogando') { armazem = a; s = r.s; }
  }
  ok(s, 'achou uma rodada em andamento');
  const maosAntes = JSON.stringify(s.maos);
  const bancaAntes = JSON.stringify(s.banca);
  const posAntes = s.mesa.pos;
  const proximaAntes = s.cartasDoSapato[posAntes];

  const casa2 = criarCasa({ armazem, fonte: fonteDeterministica(99) });
  const s2 = criarSessaoBlackjack(casa2);
  igual(JSON.stringify(s2.maos), maosAntes, 'as mesmas mãos');
  igual(JSON.stringify(s2.banca), bancaAntes, 'a mesma banca');
  igual(s2.mesa.pos, posAntes, 'a mesma posição do sapato');
  igual(s2.cartasDoSapato.length, TOTAL_SAPATO, 'o sapato foi recalculado inteiro');
  igual(s2.cartasDoSapato[posAntes], proximaAntes, 'a próxima carta é a mesma');
  s2.agir('pedir');
  ok(s2.maos[0].cartas.length === 3 || s2.estado === 'fim', 'a rodada continua de onde parou');
});

bloco('blackjack: carteira e Livro');

prova('a mesa nunca deixa o saldo ficar negativo', () => {
  const { casa, s } = mesa(['8E', '6C', '8C', 'KE', '2O', '3P'], { aposta: 1000, saldo: 1000 });
  s.dar();
  igual(casa.carteira.saldo, 0, 'gastou tudo na aposta');
  ok(!s.acoes().includes('dobrar'), 'sem dinheiro não se dobra');
  ok(!s.acoes().includes('dividir'), 'sem dinheiro não se divide');
  lanca(() => s.agir('dobrar'), 'dobrar lança');
  lanca(() => s.agir('dividir'), 'dividir lança');
  while (s.estado === 'jogando') s.agir('parar');
  ok(casa.carteira.saldo >= 0, 'saldo nunca negativo');
});

prova('sem saldo para a aposta a mesa recusa dar cartas', () => {
  const { casa, s } = mesa([], { aposta: 1000, saldo: 400 });
  lanca(() => s.dar(), 'saldo insuficiente');
  igual(casa.carteira.saldo, 400, 'nada foi debitado');
});

prova('sem saldo para o seguro a mesa recusa o seguro', () => {
  const { casa, s } = mesa(['8E', 'AE', '9C', '5O', '4P'], { aposta: 1000, saldo: 1200 });
  s.dar();
  igual(s.estado, 'seguro', 'oferta feita');
  lanca(() => s.seguro(true), 'sem saldo para o seguro');
  igual(casa.carteira.saldo, 200, 'nada a mais foi debitado');
});

prova('o Livro recebe a perda esperada exata da aposta e do seguro', () => {
  const { casa, s } = mesa(['8E', 'AE', '9C', 'KE'], { aposta: 1000 });
  s.dar();
  s.seguro(true);
  const r = casa.livro.estado.rodadas.at(-1);
  igual(r.jogo, 'blackjack', 'jogo');
  igual(r.apostado, 1500, 'aposta mais seguro');
  igual(r.retorno, 1500, 'só o seguro voltou');
  perto(r.perdaEsperada, 1000 * VANTAGEM_BLACKJACK.vantagem + 500 * VANTAGEM_SEGURO, 1e-12, 'perda esperada');
  perto(r.variancia, 1000 ** 2 * VANTAGEM_BLACKJACK.variancia + 500 ** 2 * VARIANCIA_SEGURO, 1e-9, 'variância');
  ok(r.custoErro > 0, 'o seguro entra como erro de estratégia');
  perto(r.custoErro, 500 * VANTAGEM_SEGURO, 1e-12, 'custo do seguro');
});

prova('a perda esperada da rodada sem seguro é a aposta vezes a vantagem', () => {
  const { casa, s } = mesa(['9E', '7C', '8C', 'KE', '5O'], { aposta: 2000 });
  s.dar();
  while (s.estado === 'jogando') s.agir('parar');
  const r = casa.livro.estado.rodadas.at(-1);
  perto(r.perdaEsperada, 2000 * VANTAGEM_BLACKJACK.vantagem, 1e-12, 'perda esperada');
  ok(r.rotulo.length > 0, 'rótulo em português no histórico');
  igual(s.historico[0].rotulo, r.rotulo, 'o histórico da mesa guarda o mesmo rótulo');
});

prova('novaRodada volta para a aposta guardando a última', () => {
  const { s } = mesa(['9E', '7C', '8C', 'KE', '5O'], { aposta: 3000 });
  s.dar();
  while (s.estado === 'jogando') s.agir('parar');
  igual(s.estado, 'fim', 'terminou');
  s.novaRodada();
  igual(s.estado, 'aposta', 'pronta para a próxima');
  igual(s.aposta, 3000, 'a aposta ficou');
  igual(s.maos.length, 0, 'mesa limpa');
});

bloco('blackjack: valor esperado e estratégia');

prova('a distribuição da banca soma 1 e condiciona no peek', () => {
  for (const up of [2, 3, 4, 5, 6, 7, 8, 9, 10, 11]) {
    const d = distribuicaoBanca(up);
    perto([...d].reduce((a, b) => a + b, 0), 1, 1e-12, `soma da distribuição contra ${up}`);
    for (const p of d) ok(p >= 0, 'probabilidade não negativa');
  }
  // Com ás aberto e peek, a banca nunca fecha 21 com duas cartas: a chance de
  // 21 cai bem abaixo da de 20.
  const ases = distribuicaoBanca(11);
  ok(ases[4] < ases[3], 'sem blackjack, 21 fica mais raro que 20 contra ás');
  const dez = distribuicaoBanca(10);
  ok(dez[4] < 0.05, 'contra dez, 21 também é raro depois do peek');
});

prova('parar, comprar e dobrar dão os números conhecidos', () => {
  perto(evParar(20, distribuicaoBanca(6)), 0.703, 0.01, 'parar com 20 contra 6');
  ok(evDobrar(11, false, 6) > 0.6, 'dobrar 11 contra 6 vale mais de 0,6');
  ok(evComprar(16, false, 10) < -0.5, 'comprar 16 contra dez é ruim');
  ok(evParar(16, distribuicaoBanca(10)) < -0.5, 'parar com 16 contra dez também');
  ok(evDividir(8, 10) > 2 * -0.5 && evDividir(8, 10) < 0, 'dividir 8,8 contra dez perde menos que duas mãos perdidas');
  ok(evDividir(11, 10) > 0, 'dividir ases contra dez é positivo');
});

prova('a estratégia básica bate com o melhor VE de baralho infinito', () => {
  const porValor = v => (v === 11 ? carta(0, 0) : v === 10 ? carta(9, 0) : carta(v - 1, 0));
  const porValor2 = v => (v === 11 ? carta(0, 1) : v === 10 ? carta(9, 1) : carta(v - 1, 1));
  const desacordos = [];
  let casos = 0;
  const checar = (mao, up, opcoes, rotulo) => {
    casos++;
    const evs = avaliar(mao, porValor(up), opcoes);
    const melhor = melhorAcao(evs);
    const basica = acaoBasica(mao, porValor(up), opcoes);
    if (basica !== melhor.acao && Math.abs(evs[basica] - melhor.ev) > 1e-9) {
      desacordos.push(`${rotulo} contra ${up === 11 ? 'A' : up}: básica ${basica}, VE ${melhor.acao}, custo ${(melhor.ev - evs[basica]).toFixed(5)}`);
    }
  };
  for (const up of [2, 3, 4, 5, 6, 7, 8, 9, 10, 11]) {
    for (let t = 5; t <= 20; t++) {
      let a = -1, b = -1;
      for (let x = 2; x <= 10 && a < 0; x++) { const y = t - x; if (y >= 2 && y <= 10 && y !== x) { a = x; b = y; } }
      if (a < 0) continue;
      const mao = [porValor(a), porValor2(b)];
      checar(mao, up, { podeDobrar: true, podeDividir: false, podeDesistir: true }, `duro ${t}`);
      checar(mao, up, { podeDobrar: false, podeDividir: false, podeDesistir: false }, `duro ${t} travado`);
    }
    for (let x = 2; x <= 9; x++) checar([porValor(11), porValor2(x)], up, { podeDobrar: true, podeDividir: false, podeDesistir: true }, `macio A,${x}`);
    for (let v = 2; v <= 11; v++) checar([porValor(v), porValor2(v)], up, { podeDobrar: true, podeDividir: true, podeDesistir: true }, `par ${v === 11 ? 'A' : v}`);
  }
  ok(desacordos.length <= 3, `a estratégia básica discorda do VE em ${desacordos.length} de ${casos} casos`);
  relatar(`  blackjack  estratégia básica x VE de baralho infinito: ${casos - desacordos.length}/${casos} iguais`);
  for (const d of desacordos) relatar(`             discorda em ${d}`);
});

prova('o quadro da estratégia cobre toda a mesa', () => {
  for (let t = 4; t <= 21; t++) igual(DURO[t].length, 10, `linha dura ${t}`);
  for (let t = 12; t <= 21; t++) igual(MACIO[t].length, 10, `linha macia ${t}`);
  for (let v = 2; v <= 11; v++) igual(PARES[v].length, 10, `linha de par ${v}`);
  igual(PARES[11].filter(x => x === 'V').length, 10, 'ases sempre dividem');
  igual(PARES[8].filter(x => x === 'V').length, 10, 'oitos sempre dividem');
  igual(PARES[10].filter(x => x === 'P').length, 10, 'dez nunca divide');
  igual(PARES[5].filter(x => x === 'V').length, 0, 'cincos nunca dividem');
});

prova('um 11 de três cartas compra e um 18 macio travado para', () => {
  const onzeTresCartas = cs(['2E', '3C', '6O']);
  igual(acaoBasica(onzeTresCartas, c('5C'), { podeDobrar: false, podeDividir: false, podeDesistir: false }), 'pedir', '11 de três cartas compra');
  const dezoitoMacio = cs(['AE', '7C']);
  igual(acaoBasica(dezoitoMacio, c('4C'), { podeDobrar: true, podeDividir: false, podeDesistir: false }), 'dobrar', '18 macio dobra contra 4');
  igual(acaoBasica(dezoitoMacio, c('4C'), { podeDobrar: false, podeDividir: false, podeDesistir: false }), 'parar', '18 macio travado para');
  igual(acaoBasica(cs(['9E', '7C']), c('KC'), { podeDobrar: true, podeDividir: false, podeDesistir: false }), 'pedir', '16 contra dez sem desistência compra');
  igual(acaoBasica(cs(['9E', '7C']), c('KC'), { podeDobrar: true, podeDividir: false, podeDesistir: true }), 'desistir', '16 contra dez desiste quando pode');
});

prova('o conselho traz o custo de cada ficha jogada errado', () => {
  const { s } = mesa(['KE', 'KC', '6C', '9O'], { aposta: 1000 });
  s.dar();
  const cons = s.conselho();
  igual(cons.acao, 'desistir', '16 contra dez');
  ok(cons.evs.desistir === -0.5, 'desistir vale -0,5');
  igual(cons.custoPorFicha.desistir, 0, 'a melhor ação custa zero');
  ok(cons.custoPorFicha.parar > 0, 'parar custa');
  ok(cons.custoPorFicha.pedir > 0, 'comprar custa');
});

bloco('blackjack: vantagem medida');

prova('a simulação devolve a vantagem da casa gravada em vantagem.js', () => {
  const t0 = performance.now();
  // 20 milhões de mãos: erro-padrão de uns 0,026 ponto, para o intervalo de
  // 0,3% a 0,7% não depender de uma semente de sorte.
  const maos = 20_000_000;
  const r = consolidar([simularBlackjack({ maos, semente: 424242 })]);
  const s = (performance.now() - t0) / 1000;
  entre(r.vantagem, 0.003, 0.007, 'vantagem simulada');
  const erroJunto = Math.sqrt(r.erroPadrao ** 2 + VANTAGEM_BLACKJACK.erroPadrao ** 2);
  const z = Math.abs(r.vantagem - VANTAGEM_BLACKJACK.vantagem) / erroJunto;
  ok(z <= 4, `a simulação está a ${z.toFixed(2)} erros padrão da constante gravada`);
  perto(r.variancia, VANTAGEM_BLACKJACK.variancia, 0.05, 'variância por aposta inicial');
  relatar(`  blackjack  vantagem da casa ${(r.vantagem * 100).toFixed(4)} % +/- ${(r.erroPadrao * 100).toFixed(4)} % em ${maos.toLocaleString('pt-BR')} mãos`);
  relatar(`             gravada ${(VANTAGEM_BLACKJACK.vantagem * 100).toFixed(4)} % +/- ${(VANTAGEM_BLACKJACK.erroPadrao * 100).toFixed(4)} % em ${VANTAGEM_BLACKJACK.maos.toLocaleString('pt-BR')} mãos (z = ${z.toFixed(2)})`);
  relatar(`             variância ${r.variancia.toFixed(4)} por aposta inicial ao quadrado, ${Math.round(maos / s).toLocaleString('pt-BR')} mãos/s`);
  relatar(`             seguro: vantagem da casa ${(VANTAGEM_SEGURO * 100).toFixed(4)} %`);
});

prova('nenhuma aposta da mesa favorece o jogador', () => {
  ok(VANTAGEM_BLACKJACK.vantagem > 0, 'a aposta principal favorece a casa');
  ok(VANTAGEM_SEGURO > 0, 'o seguro favorece a casa');
  // O Livro recusa qualquer rodada com perda esperada negativa; se alguma
  // aposta tivesse VE positivo, a mesa não conseguiria fechar rodada.
  const { casa, s } = mesa(['9E', '7C', '8C', 'KE', '5O'], { aposta: 1000 });
  s.dar();
  while (s.estado === 'jogando') s.agir('parar');
  ok(casa.livro.estado.rodadas.at(-1).perdaEsperada > 0, 'toda rodada entra com perda esperada positiva');
  lanca(() => casa.livro.registrar({ jogo: 'blackjack', apostado: 100, retorno: 0, perdaEsperada: -1, variancia: 1 }), 'o Livro recusa VE a favor do jogador');
});

prova('o texto que o jogador lê está em português', () => {
  const { s } = mesa(['AE', '5C', 'KE', '9C'], { aposta: 1000 });
  s.dar();
  ok(/blackjack/.test(s.historico[0].rotulo), 'rótulo do natural');
  const { s: s2 } = mesa(['9E', '7C', '8C', 'KE', '5O'], { aposta: 1000 });
  s2.dar();
  while (s2.estado === 'jogando') s2.agir('parar');
  ok(/contra/.test(s2.historico[0].rotulo), 'rótulo de rodada comum');
  ok(!/[\u2660-\u2667]/.test(JSON.stringify(s2.historico)), 'sem naipes Unicode');
  igual(curto(c('KP')), 'KP', 'texto curto de carta é ASCII');
});
