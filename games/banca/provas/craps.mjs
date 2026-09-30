// Provas do craps: os 36 resultados de dois dados, a vantagem exata de cada
// aposta do pano, o zero exato das odds e 300.000 lances de um padrão fixo para
// conferir que a perda esperada que o Livro registra é a perda que acontece.

import { bloco, prova, ok, igual, perto, entre, lanca, relatar, geradorRapido, fonteDeterministica } from './base.mjs';
import { criarCasa, armazemMemoria } from '../js/nucleo/casa.js';
import { conferirHash } from '../js/nucleo/justo.js';
import {
  REGRAS, REGRAS_TEXTO, ZONAS, ZONA_POR_ID, FICHA, PONTOS, COMBINACOES,
  PAGA_ODDS, PAGA_LAY, PAGA_PLACE, PAGA_HARD, PAGA_PROPOSTA, ALVO_PROPOSTA, PAGA_CAMPO,
  MULTIPLO, multiploDe, minimoDe, tetoDe, premio, derivar, resolver, fichas, FICHAS,
  fichaDe, contaDoLance, classe, conferir, placa, podeApostar, podeRetirar, ajustarValor,
  LINHA_DAS_ODDS,
} from '../js/jogos/craps/regras.js';
import { criarSessaoCraps } from '../js/jogos/craps/sessao.js';

const F = fichas();

function mesa(opcoes = {}) {
  const armazem = opcoes.armazem ?? armazemMemoria();
  const casa = criarCasa({ armazem, fonte: fonteDeterministica(opcoes.semente ?? 13) });
  const s = criarSessaoCraps(casa);
  if (opcoes.saldo !== undefined) casa.carteira.estado.saldo = opcoes.saldo;
  return { casa, s, armazem };
}

// Um lance forçado: escreve os dados por cima do resolver, sem sessão.
function lance(apostas, ponto, dados) {
  return resolver(apostas, ponto, dados);
}

function porZona(eventos) {
  return Object.fromEntries(eventos.map(e => [e.zona, e]));
}

bloco('craps: os 36 resultados');

prova('as combinações somam 36 e batem com a contagem dos dados', () => {
  const conta = {};
  for (let a = 1; a <= 6; a++) for (let b = 1; b <= 6; b++) conta[a + b] = (conta[a + b] ?? 0) + 1;
  let soma = 0;
  for (let s = 2; s <= 12; s++) {
    igual(COMBINACOES[s], conta[s], `combinações do ${s}`);
    soma += COMBINACOES[s];
  }
  igual(soma, 36, 'trinta e seis saídas');
});

prova('derivar dá dois dados de 1 a 6 e nada mais', () => {
  const conta = new Map();
  for (let i = 0; i < 20000; i++) {
    const g = { inteiro: (() => { const r = geradorRapido(i + 1); return n => r.inteiro(n); })() };
    const d = derivar(g);
    ok(d.length === 2, 'dois dados');
    ok(d[0] >= 1 && d[0] <= 6 && d[1] >= 1 && d[1] <= 6, 'faces de 1 a 6');
    conta.set(d[0] + d[1], (conta.get(d[0] + d[1]) ?? 0) + 1);
  }
  igual(conta.size, 11, 'onze totais possíveis');
});

bloco('craps: vantagem exata de cada aposta');

prova('a linha do passe custa 1,414% e o não passe 1,364%', () => {
  perto(F.pass.vantagem * 100, 1.414, 0.001, 'passe');
  perto(F.dontpass.vantagem * 100, 1.364, 0.001, 'não passe');
  perto(F.come.vantagem * 100, F.pass.vantagem * 100, 1e-12, 'vem é igual ao passe');
  perto(F.dontcome.vantagem * 100, F.dontpass.vantagem * 100, 1e-12, 'não vem é igual ao não passe');
  for (const n of PONTOS) {
    perto(F[`come${n}`].vantagem, F.pass.vantagem, 1e-12, `vem no ${n}`);
    perto(F[`dontcome${n}`].vantagem, F.dontpass.vantagem, 1e-12, `não vem no ${n}`);
  }
  // Frações exatas: 7/495 e 3/220.
  perto(F.pass.vantagem, 7 / 495, 1e-15, 'passe é 7/495');
  perto(F.dontpass.vantagem, 3 / 220, 1e-15, 'não passe é 3/220');
});

prova('a cadeia de Markov do ponto confirma o passe e o não passe', () => {
  // Conta independente: a massa de probabilidade rolando até o ponto ou o 7.
  let ganhaPasse = 0;
  let perdePasse = 0;
  let ganhaContra = 0;
  let perdeContra = 0;
  let empata = 0;
  for (let s = 2; s <= 12; s++) {
    const p = COMBINACOES[s] / 36;
    if (s === 7 || s === 11) { ganhaPasse += p; perdeContra += p; continue; }
    if (s === 2 || s === 3) { perdePasse += p; ganhaContra += p; continue; }
    if (s === 12) { perdePasse += p; empata += p; continue; }
    let massa = p;
    const pn = COMBINACOES[s] / 36;
    const p7 = 6 / 36;
    for (let k = 0; k < 4000; k++) {
      ganhaPasse += massa * pn;
      perdePasse += massa * p7;
      perdeContra += massa * pn;
      ganhaContra += massa * p7;
      massa *= 1 - pn - p7;
    }
  }
  perto(ganhaPasse + perdePasse, 1, 1e-12, 'o passe sempre se decide');
  perto(-(ganhaPasse - perdePasse), F.pass.vantagem, 1e-12, 'vantagem do passe pela cadeia');
  perto(ganhaContra + perdeContra + empata, 1, 1e-12, 'o não passe sempre se decide');
  perto(-(ganhaContra - perdeContra), F.dontpass.vantagem, 1e-12, 'vantagem do não passe pela cadeia');
  relatar(`  craps vantagem exata               passe ${(F.pass.vantagem * 100).toFixed(4)}%, não passe ${(F.dontpass.vantagem * 100).toFixed(4)}%, odds ${(F.passodds.vantagem * 100).toFixed(4)}%`);
});

prova('as odds pagam o preço justo, em conta de inteiros', () => {
  // A favor: ganha em n de (n+6) e paga num/den. O valor esperado é
  // n*num - 6*den, sobre (n+6)*den. O numerador tem de ser ZERO inteiro.
  for (const n of PONTOS) {
    const [num, den] = PAGA_ODDS[n];
    igual(COMBINACOES[n] * num - 6 * den, 0, `odds a favor no ${n}`);
    const [lnum, lden] = PAGA_LAY[n];
    igual(6 * lnum - COMBINACOES[n] * lden, 0, `odds contra no ${n}`);
  }
  for (const z of ZONAS.filter(z => z.tipo === 'odds')) {
    ok(Math.abs(F[z.id].vantagem) < 1e-15, `${z.id} tem vantagem nula`);
    igual(F[z.id].classe, 'boa', `${z.id} é aposta boa`);
  }
});

prova('colocação, campo, difíceis e propostas batem com a contagem dos dados', () => {
  const esperado = {
    place4: 1 / 15, place10: 1 / 15, place5: 0.04, place9: 0.04, place6: 1 / 66, place8: 1 / 66,
    field: 1 / 36,
    hard4: 1 / 9, hard10: 1 / 9, hard6: 1 / 11, hard8: 1 / 11,
    anyseven: 1 / 6, anycraps: 1 / 9, two: 5 / 36, twelve: 5 / 36, three: 1 / 9, eleven: 1 / 9,
  };
  for (const [id, v] of Object.entries(esperado)) perto(F[id].vantagem, v, 1e-12, `vantagem de ${id}`);
  perto(F.place6.vantagem * 100, 1.515, 0.001, 'colocação no 6');
  perto(F.place5.vantagem * 100, 4.000, 0.001, 'colocação no 5');
  perto(F.place4.vantagem * 100, 6.667, 0.001, 'colocação no 4');
  perto(F.field.vantagem * 100, 2.778, 0.001, 'campo');
  perto(F.hard6.vantagem * 100, 9.091, 0.001, 'seis difícil');
  perto(F.hard4.vantagem * 100, 11.111, 0.001, 'quatro difícil');
  perto(F.anyseven.vantagem * 100, 16.667, 0.001, 'qualquer sete');
  perto(F.anycraps.vantagem * 100, 11.111, 0.001, 'qualquer craps');
  perto(F.two.vantagem * 100, 13.889, 0.001, 'o dois');
  perto(F.three.vantagem * 100, 11.111, 0.001, 'o três');
});

prova('cada proposta de um lance bate com a contagem crua das 36 saídas', () => {
  for (const [id, alvos] of Object.entries(ALVO_PROPOSTA)) {
    let acertos = 0;
    for (let a = 1; a <= 6; a++) for (let b = 1; b <= 6; b++) if (alvos.includes(a + b)) acertos++;
    const ev = (acertos * PAGA_PROPOSTA[id] - (36 - acertos)) / 36;
    perto(F[id].vantagem, -ev, 1e-15, `${id} pelas 36 saídas`);
  }
  // Campo pelas 36 saídas, uma a uma.
  let ev = 0;
  for (let a = 1; a <= 6; a++) for (let b = 1; b <= 6; b++) ev += (PAGA_CAMPO[a + b] ?? -1);
  perto(F.field.vantagem, -ev / 36, 1e-15, 'campo pelas 36 saídas');
});

prova('nenhuma aposta favorece o jogador, e só as odds empatam', () => {
  for (const z of ZONAS) {
    const v = F[z.id].vantagem;
    if (z.tipo === 'odds') ok(Math.abs(v) < 1e-15, `${z.id} é exatamente neutra`);
    else ok(v > 1e-6, `${z.id} tem vantagem da casa positiva (${v})`);
  }
});

prova('a classificação boa, média e ruim segue os cortes declarados', () => {
  igual(classe(0.0141414), 'boa', 'passe');
  igual(classe(0.02), 'media', 'dois por cento é média');
  igual(classe(0.05), 'media', 'cinco por cento é média');
  igual(classe(0.0500001), 'ruim', 'acima de cinco é ruim');
  igual(F.pass.classe, 'boa', 'passe');
  igual(F.field.classe, 'media', 'campo');
  igual(F.place4.classe, 'ruim', 'colocação no 4');
  igual(F.anyseven.classe, 'ruim', 'qualquer sete');
});

prova('a placa mostra os três números da mesa', () => {
  const p = placa();
  igual(p.length, 3, 'três números');
  igual(p[0].valor, '0,00%', 'odds');
  igual(p[1].valor, '1,36%', 'não passe');
  igual(p[2].valor, '16,67%', 'qualquer sete');
});

prova('o texto das regras declara a mesa inteira', () => {
  ok(REGRAS_TEXTO.length >= 15, 'as regras estão escritas');
  ok(REGRAS_TEXTO.some(t => t.includes('múltiplos de 3 fichas')), 'o múltiplo das odds contra está declarado');
  ok(REGRAS_TEXTO.some(t => t.includes('trabalham sempre')), 'as odds do Vem trabalhando sempre estão declaradas');
  ok(ZONAS.every(z => z.nome && z.paga), 'toda zona tem nome e pagamento em português');
});

bloco('craps: centavo inteiro');

prova('todo múltiplo declarado paga em centavo inteiro', () => {
  const dados = { 4: [2, 2], 5: [2, 3], 6: [3, 3], 8: [4, 4], 9: [4, 5], 10: [5, 5] };
  let casos = 0;
  for (const z of ZONAS) {
    const mult = multiploDe(z.id, 6);
    for (let k = 1; k <= 12; k++) {
      const v = k * mult;
      if (v > REGRAS.maximo) break;
      const n = z.numero ?? (z.tipo === 'odds' ? 6 : 6);
      const p = premio(z.id, v, dados[n] ?? [3, 3], 6);
      ok(Number.isInteger(p), `${z.id} com ${v} centavos paga ${p}`);
      casos++;
    }
  }
  ok(casos > 300, `${casos} pagamentos conferidos`);
  // E a multa: um valor fora do múltiplo é recusado na hora de pagar.
  lanca(() => premio('place6', 500, [3, 3], 6), 'colocação no 6 com 5 fichas');
  lanca(() => premio('dontcomeodds5', 100, [2, 3], 5), 'odds contra no 5 com 1 ficha');
  igual(premio('place6', 600, [3, 3], 6), 700, 'seis fichas no 6 pagam sete');
  igual(premio('place5', 500, [2, 3], 5), 700, 'cinco fichas no 5 pagam sete');
  igual(premio('place4', 500, [2, 2], 4), 900, 'cinco fichas no 4 pagam nove');
  igual(premio('dontcomeodds5', 300, [2, 3], 5), 200, 'três fichas contra o 5 ganham duas');
  igual(premio('dontcomeodds6', 600, [3, 3], 6), 500, 'seis fichas contra o 6 ganham cinco');
  igual(premio('passodds', 100, [3, 3], 6), 120, 'uma ficha de odds no 6 paga 1,20');
});

prova('os múltiplos declarados são os menores que a mesa aceita', () => {
  igual(MULTIPLO.place6, 6 * FICHA, 'colocação no 6 vai de 6 em 6 fichas');
  igual(MULTIPLO.place8, 6 * FICHA, 'colocação no 8');
  igual(MULTIPLO.place5, 5 * FICHA, 'colocação no 5');
  igual(MULTIPLO.place4, 5 * FICHA, 'colocação no 4');
  igual(MULTIPLO.dontcomeodds5, 3 * FICHA, 'odds contra no 5');
  igual(MULTIPLO.dontcomeodds6, 6 * FICHA, 'odds contra no 6');
  igual(MULTIPLO.dontcomeodds4, FICHA, 'odds contra no 4 vai de ficha em ficha');
  igual(MULTIPLO.passodds, FICHA, 'odds do passe vai de ficha em ficha');
  igual(multiploDe('dontpassodds', 5), 3 * FICHA, 'odds contra do passe com ponto no 5');
  igual(multiploDe('dontpassodds', 8), 6 * FICHA, 'odds contra do passe com ponto no 8');
  igual(multiploDe('dontpassodds', 10), FICHA, 'odds contra do passe com ponto no 10');
  igual(minimoDe('place6', null), 6 * FICHA, 'mínimo da colocação no 6 é o múltiplo dela');
  igual(minimoDe('pass', null), 5 * FICHA, 'mínimo da linha');
  igual(minimoDe('field', null), FICHA, 'mínimo do campo');
});

bloco('craps: resolução do lance');

prova('a saída paga 7 e 11 e derruba 2, 3 e 12', () => {
  for (const [d, quem] of [[[3, 4], 'ganhou'], [[5, 6], 'ganhou'], [[1, 1], 'perdeu'], [[1, 2], 'perdeu'], [[6, 6], 'perdeu']]) {
    const r = lance({ pass: 500 }, null, d);
    igual(porZona(r.eventos).pass.resultado, quem, `passe com ${d[0]}+${d[1]}`);
    igual(r.ponto, null, 'a saída não virou ponto');
  }
  const r = lance({ pass: 500 }, null, [2, 2]);
  igual(r.eventos.length, 0, 'o ponto não decide nada');
  igual(r.ponto, 4, 'ponto no 4');
  igual(r.apostas.pass, 500, 'a linha continua de pé');
});

prova('o não passe devolve no 12 e ganha no 2 e no 3', () => {
  igual(porZona(lance({ dontpass: 500 }, null, [6, 6]).eventos).dontpass.resultado, 'devolveu', 'o 12 devolve');
  igual(porZona(lance({ dontpass: 500 }, null, [6, 6]).eventos).dontpass.pago, 500, 'devolve a aposta inteira');
  igual(porZona(lance({ dontpass: 500 }, null, [1, 1]).eventos).dontpass.resultado, 'ganhou', 'o 2 paga');
  igual(porZona(lance({ dontpass: 500 }, null, [1, 2]).eventos).dontpass.pago, 1000, 'o 3 paga 1 para 1');
  igual(porZona(lance({ dontpass: 500 }, null, [3, 4]).eventos).dontpass.resultado, 'perdeu', 'o 7 derruba');
  igual(porZona(lance({ dontpass: 500 }, null, [5, 6]).eventos).dontpass.resultado, 'perdeu', 'o 11 derruba');
});

prova('o ponto feito paga linha e odds juntas', () => {
  const r = lance({ pass: 500, passodds: 2500 }, 6, [2, 4]);
  const e = porZona(r.eventos);
  igual(e.pass.pago, 1000, 'a linha paga 1 para 1');
  igual(e.passodds.pago, 2500 + 3000, 'as odds pagam 6 para 5');
  igual(r.ponto, null, 'a série acabou');
  const s = lance({ pass: 500, passodds: 2500 }, 6, [3, 4]);
  igual(porZona(s.eventos).passodds.resultado, 'perdeu', 'o sete leva as odds');
  igual(s.ponto, null, 'a série acabou no sete');
});

prova('as odds contra pagam o inverso do preço justo', () => {
  const r = lance({ dontpass: 500, dontpassodds: 3000 }, 5, [3, 4]);
  const e = porZona(r.eventos);
  igual(e.dontpass.pago, 1000, 'não passe paga 1 para 1');
  igual(e.dontpassodds.pago, 3000 + 2000, 'lay no 5 paga 2 para 3');
  const p = lance({ dontpass: 500, dontpassodds: 3000 }, 5, [2, 3]);
  igual(porZona(p.eventos).dontpassodds.resultado, 'perdeu', 'o ponto derruba o lay');
});

prova('o Vem viaja para o número e paga lá', () => {
  const viagem = lance({ come: 500 }, 5, [2, 4]);
  const e = porZona(viagem.eventos);
  igual(e.come.resultado, 'moveu', 'a caixa do Vem esvaziou');
  igual(e.come.para, 'come6', 'viajou para o 6');
  igual(viagem.apostas.come6, 500, 'a aposta está no 6');
  igual(viagem.apostas.come, 0, 'a caixa ficou vazia');
  igual(viagem.ponto, 5, 'o ponto da mesa não mudou');

  const paga = lance({ ...viagem.apostas, comeodds6: 600 }, 5, [3, 3]);
  const p = porZona(paga.eventos);
  igual(p.come6.pago, 1000, 'o número do Vem paga 1 para 1');
  igual(p.comeodds6.pago, 600 + 720, 'as odds do Vem pagam 6 para 5');

  const sete = lance(viagem.apostas, 5, [3, 4]);
  igual(porZona(sete.eventos).come6.resultado, 'perdeu', 'o sete leva o número do Vem');
});

prova('o Vem que viaja neste lance não é decidido por ele', () => {
  const r = lance({ come: 500, come6: 0 }, 5, [3, 3]);
  const e = porZona(r.eventos);
  igual(e.come.resultado, 'moveu', 'viajou');
  igual(r.apostas.come6, 500, 'ficou no 6');
  ok(!r.eventos.some(x => x.zona === 'come6'), 'o número não foi resolvido no mesmo lance');
});

prova('os números do Vem trabalham na saída também', () => {
  const r = lance({ come6: 500, comeodds6: 600, pass: 500 }, null, [3, 4]);
  const e = porZona(r.eventos);
  igual(e.pass.resultado, 'ganhou', 'a saída de sete paga a linha');
  igual(e.come6.resultado, 'perdeu', 'e leva o número do Vem');
  igual(e.comeodds6.resultado, 'perdeu', 'com as odds dele');
});

prova('a colocação dorme na saída e fica de pé depois de ganhar', () => {
  const dormindo = lance({ place6: 600 }, null, [3, 3]);
  igual(dormindo.eventos.length, 0, 'nada acontece na saída');
  igual(dormindo.apostas.place6, 600, 'a aposta continua lá');
  const ganhou = lance({ place6: 600 }, 4, [3, 3]);
  const e = porZona(ganhou.eventos).place6;
  igual(e.resultado, 'ganhou', 'o 6 pagou');
  igual(e.pago, 700, 'sete para seis, só o prêmio');
  ok(e.permanece, 'a aposta fica de pé');
  igual(ganhou.apostas.place6, 600, 'continua na mesa');
  const perdeu = lance({ place6: 600 }, 4, [3, 4]);
  igual(porZona(perdeu.eventos).place6.resultado, 'perdeu', 'o sete leva a colocação');
  igual(perdeu.apostas.place6, 0, 'saiu da mesa');
});

prova('o campo paga dobrado no 2 e triplo no 12', () => {
  igual(porZona(lance({ field: 100 }, null, [1, 1]).eventos).field.pago, 300, 'o 2 paga 2 para 1');
  igual(porZona(lance({ field: 100 }, null, [6, 6]).eventos).field.pago, 400, 'o 12 paga 3 para 1');
  igual(porZona(lance({ field: 100 }, null, [1, 2]).eventos).field.pago, 200, 'o 3 paga 1 para 1');
  for (const s of [5, 6, 7, 8]) {
    const d = [1, s - 1];
    igual(porZona(lance({ field: 100 }, null, d).eventos).field.resultado, 'perdeu', `o ${s} perde`);
  }
});

prova('as difíceis só pagam na dupla e trabalham sempre', () => {
  const dura = lance({ hard8: 100 }, null, [4, 4]);
  const e = porZona(dura.eventos).hard8;
  igual(e.resultado, 'ganhou', 'o 8 na dupla paga');
  igual(e.pago, 900, 'nove para um');
  ok(e.permanece, 'fica de pé');
  igual(porZona(lance({ hard8: 100 }, null, [5, 3]).eventos).hard8.resultado, 'perdeu', 'o 8 fácil derruba');
  igual(porZona(lance({ hard8: 100 }, 6, [3, 4]).eventos).hard8.resultado, 'perdeu', 'o sete derruba');
  igual(lance({ hard8: 100 }, 6, [2, 3]).eventos.length, 0, 'outro total não decide');
  igual(porZona(lance({ hard4: 100 }, null, [2, 2]).eventos).hard4.pago, 700, 'quatro difícil paga sete para um');
});

prova('as propostas de um lance se resolvem sempre', () => {
  igual(porZona(lance({ anyseven: 100 }, null, [3, 4]).eventos).anyseven.pago, 500, 'qualquer sete paga 4 para 1');
  igual(porZona(lance({ anycraps: 100 }, null, [6, 6]).eventos).anycraps.pago, 800, 'qualquer craps paga 7 para 1');
  igual(porZona(lance({ two: 100 }, null, [1, 1]).eventos).two.pago, 3100, 'o 2 paga 30 para 1');
  igual(porZona(lance({ eleven: 100 }, null, [5, 6]).eventos).eleven.pago, 1600, 'o 11 paga 15 para 1');
  igual(porZona(lance({ twelve: 100 }, null, [3, 4]).eventos).twelve.resultado, 'perdeu', 'o 12 perde no sete');
});

bloco('craps: a mesa');

prova('as apostas de linha só entram na saída e não saem depois', () => {
  const { s } = mesa();
  ok(podeApostar('pass', s.apostas, null).ok, 'passe na saída');
  s.apostar('pass', 500);
  ok(s.podeRetirar('pass'), 'dá para tirar antes do primeiro lance');
  s.retirar('pass');
  s.apostar('pass', 500);
  lanca(() => s.apostar('come', 500), 'Vem na saída');
  // Rola até o ponto ficar de pé.
  while (s.ponto === null) { if (s.total() === 0) s.apostar('pass', 500); s.lancar(); }
  lanca(() => s.apostar('pass', 500), 'linha com o ponto de pé');
  ok(!s.podeRetirar('pass'), 'a linha não sai com o ponto de pé');
  lanca(() => s.retirar('pass'), 'retirar a linha com o ponto de pé');
  ok(s.podeApostar('come').ok, 'Vem entra com o ponto de pé');
});

prova('os números do Vem são contrato e as odds saem quando o jogador quiser', () => {
  const { s } = mesa({ semente: 21 });
  while (s.ponto === null) { s.apostar('pass', 500); s.lancar(); }
  s.apostar('come', 500);
  let tentativas = 0;
  while (!PONTOS.some(n => s.apostas[`come${n}`] > 0) && tentativas < 200) {
    s.lancar();
    if (s.apostas.come === 0 && !PONTOS.some(n => s.apostas[`come${n}`] > 0)) {
      if (s.ponto === null) s.apostar('pass', 500);
      else s.apostar('come', 500);
    }
    tentativas++;
  }
  const n = PONTOS.find(x => s.apostas[`come${x}`] > 0);
  ok(n !== undefined, 'o Vem chegou num número');
  ok(!s.podeRetirar(`come${n}`), 'o número do Vem não sai da mesa');
  s.apostar(`comeodds${n}`, 100);
  ok(s.podeRetirar(`comeodds${n}`), 'as odds saem');
  const saldo = s.mesa.apostas[`comeodds${n}`];
  s.retirar(`comeodds${n}`);
  igual(s.apostas[`comeodds${n}`], 0, `as odds do ${n} voltaram`);
  ok(saldo > 0, 'havia odds na mesa');
});

prova('o limite 3-4-5x das odds é cobrado e a aposta é ajustada para baixo', () => {
  for (const alvo of PONTOS) {
    const { s } = mesa({ semente: 100 + alvo, saldo: 10000000 });
    let voltas = 0;
    while (s.ponto !== alvo && voltas < 4000) {
      if (s.ponto === null) { if (s.apostas.pass === 0) s.apostar('pass', 500); }
      s.lancar();
      voltas++;
    }
    igual(s.ponto, alvo, `ponto no ${alvo}`);
    const teto = s.teto('passodds');
    igual(teto, s.apostas.pass * REGRAS.multiploOdds[alvo], `teto das odds no ${alvo}`);
    const r = s.apostar('passodds', 1000000);
    igual(s.apostas.passodds, teto, 'a mesa ajustou para o teto');
    ok(r.motivo.length > 0, 'e explicou o ajuste');
    ok(!s.podeApostar('passodds').ok, 'no teto não cabe mais nada');
    // Odds contra: 6x em qualquer número.
    const { s: t } = mesa({ semente: 300 + alvo, saldo: 10000000 });
    let v2 = 0;
    while (t.ponto !== alvo && v2 < 4000) {
      if (t.ponto === null && t.apostas.dontpass === 0) t.apostar('dontpass', 600);
      t.lancar();
      v2++;
    }
    igual(t.ponto, alvo, `ponto no ${alvo} na mesa do contra`);
    igual(t.teto('dontpassodds'), t.apostas.dontpass * REGRAS.multiploLay, `teto do lay no ${alvo}`);
  }
});

prova('a mesa arredonda a aposta para o múltiplo que paga inteiro', () => {
  const { s } = mesa({ saldo: 1000000 });
  const r = s.apostar('place6', 1000);
  igual(r.valor, 600, 'dez fichas viram seis no 6');
  ok(r.motivo.includes('6'), 'a mensagem explica o múltiplo');
  igual(s.apostar('place5', 900).valor, 500, 'nove fichas viram cinco no 5');
  lanca(() => s.apostar('place4', 400), 'menos que o mínimo');
  igual(s.apostar('field', 100).valor, 100, 'o campo vai de ficha em ficha');
  lanca(() => s.apostar('field', 50), 'meia ficha');
});

prova('o saldo cobre toda aposta e nunca fica negativo', () => {
  const { casa, s } = mesa({ saldo: 1000 });
  s.apostar('pass', 500);
  s.apostar('field', 500);
  igual(casa.carteira.saldo, 0, 'o saldo zerou');
  lanca(() => s.apostar('anyseven', 100), 'sem saldo');
  for (let i = 0; i < 40; i++) {
    if (s.total() === 0) break;
    s.lancar();
    ok(casa.carteira.saldo >= 0, 'saldo nunca negativo');
  }
  ok(casa.carteira.saldo >= 0, 'saldo final não negativo');
});

prova('não dá para lançar sem aposta na mesa', () => {
  const { s } = mesa();
  lanca(() => s.lancar(), 'lance sem aposta');
});

prova('a mesa sobrevive a um recarregamento', () => {
  const armazem = armazemMemoria();
  const { casa, s } = mesa({ armazem });
  s.apostar('pass', 500);
  while (s.ponto === null) { if (s.total() === 0) s.apostar('pass', 500); s.lancar(); }
  s.apostar('place6', 600);
  const ponto = s.ponto;
  const saldo = casa.carteira.saldo;
  const outra = criarCasa({ armazem, fonte: fonteDeterministica(99) });
  const s2 = criarSessaoCraps(outra);
  igual(s2.ponto, ponto, 'o ponto sobreviveu');
  igual(s2.apostas.pass, 500, 'a linha sobreviveu');
  igual(s2.apostas.place6, 600, 'a colocação sobreviveu');
  igual(outra.carteira.saldo, saldo, 'o saldo é o mesmo');
});

bloco('craps: dados verificáveis');

prova('cada lance é uma rodada aberta e revelada, e conferir reproduz os dados', () => {
  const { casa, s } = mesa({ semente: 5 });
  const antes = s.compromisso();
  ok(antes.aberto === false, 'nada aberto antes do lance');
  s.apostar('pass', 500);
  const r = s.lancar();
  const revelado = casa.justo.estado.revelados.at(-1);
  ok(conferirHash(revelado.semente, revelado.hash), 'a semente bate com o hash publicado');
  igual(revelado.hash, antes.hash, 'o hash revelado é o que estava publicado');
  const c = conferir(revelado);
  ok(c.confere, `conferir reproduz os dados: ${c.descricao}`);
  igual(revelado.resultado.dados[0], r.dados[0], 'primeiro dado');
  igual(revelado.resultado.dados[1], r.dados[1], 'segundo dado');
  ok(revelado.resultado.texto.length > 0, 'o resumo em português foi arquivado');
  ok(!conferir({ ...revelado, resultado: { dados: [1, 1] } }).confere, 'dados trocados são recusados');
});

prova('o gerador não vê o saldo nem a aposta', () => {
  const dados = [];
  for (const [saldo, valor] of [[100000, 500], [50000000, 100000]]) {
    const { s } = mesa({ semente: 777, saldo });
    const seq = [];
    for (let i = 0; i < 25; i++) {
      if (s.total() === 0) {
        if (s.ponto === null) s.apostar('pass', valor);
        else s.apostar('field', valor);
      }
      seq.push(s.lancar().dados.join(''));
    }
    dados.push(seq.join(' '));
  }
  igual(dados[0], dados[1], 'a mesma semente dá os mesmos dados com saldos e apostas diferentes');
});

bloco('craps: o Livro');

prova('a perda esperada de um lance é a soma de valor por vantagem', () => {
  const r = lance({ pass: 500, passodds: 2500, place6: 600, field: 100 }, 6, [2, 4]);
  const conta = contaDoLance(r.eventos, 6);
  let esperado = 0;
  for (const e of r.eventos) esperado += e.aposta * fichaDe(e.zona, 6).vantagem;
  perto(conta.perdaEsperada, esperado, 1e-9, 'perda esperada');
  // As odds não cobram nada.
  perto(fichaDe('passodds', 6).vantagem, 0, 1e-15, 'odds do passe no 6');
  igual(conta.apostado, 500 + 2500 + 600 + 100, 'tudo que se decidiu');
});

prova('o lance que só estabelece o ponto não entra no Livro', () => {
  const { casa, s } = mesa({ semente: 31 });
  s.apostar('pass', 500);
  let lances = 0;
  let comPonto = 0;
  while (lances < 40) {
    const antes = s.ponto;
    const r = s.lancar();
    lances++;
    if (antes === null && r.ponto !== null) { igual(r.rodada, null, 'o lance que abre o ponto não é rodada'); comPonto++; }
    if (s.total() === 0 && s.ponto === null) s.apostar('pass', 500);
    if (s.total() === 0) break;
  }
  ok(comPonto > 0, 'houve pelo menos um ponto estabelecido');
  ok(casa.livro.rodadas('craps').length > 0, 'e rodadas registradas nos outros lances');
});

bloco('craps: 300.000 lances');

// Padrão fixo: 5 fichas na linha, odds cheias quando o ponto sobe, colocação no
// 6 e no 8, uma ficha no campo e uma no 8 difícil a cada lance. Tudo é contado
// dos dois lados: pelo caixa (o que saiu da mão menos o que voltou menos o que
// ficou na mesa) e pelo Livro (apostado, retorno, perda esperada, variância).
function simularPadrao(n, semente) {
  const g = geradorRapido(semente);
  let apostas = {};
  let ponto = null;
  let colocado = 0;
  let pago = 0;
  let apostadoLivro = 0;
  let retornoLivro = 0;
  let perdaEsperada = 0;
  let variancia = 0;
  let decisoes = 0;
  const t0 = performance.now();

  const por = (z, v) => { apostas[z] = (apostas[z] ?? 0) + v; colocado += v; };

  for (let k = 0; k < n; k++) {
    if (ponto === null && !(apostas.pass > 0)) por('pass', 500);
    if (ponto !== null) {
      const falta = 500 * REGRAS.multiploOdds[ponto] - (apostas.passodds ?? 0);
      if (falta > 0) por('passodds', falta);
      for (const m of [6, 8]) if (!(apostas[`place${m}`] > 0)) por(`place${m}`, 600);
    }
    if (!(apostas.field > 0)) por('field', 100);
    if (!(apostas.hard8 > 0)) por('hard8', 100);

    const dados = [g.inteiro(6) + 1, g.inteiro(6) + 1];
    const r = resolver(apostas, ponto, dados);
    for (const e of r.eventos) pago += e.pago;
    const conta = contaDoLance(r.eventos, ponto);
    apostadoLivro += conta.apostado;
    retornoLivro += conta.retorno;
    perdaEsperada += conta.perdaEsperada;
    variancia += conta.variancia;
    decisoes += r.eventos.filter(e => e.resultado !== 'moveu').length;
    apostas = r.apostas;
    ponto = r.ponto;
  }

  let naMesa = 0;
  for (const v of Object.values(apostas)) naMesa += v;
  return {
    n, colocado, pago, naMesa, apostadoLivro, retornoLivro, perdaEsperada, variancia, decisoes,
    caixa: pago + naMesa - colocado,
    livro: retornoLivro - apostadoLivro,
    ms: performance.now() - t0,
  };
}

prova('as duas contabilidades do padrão fixo dão o mesmo centavo', () => {
  const s = simularPadrao(20000, 4242);
  igual(s.caixa, s.livro, 'o caixa e o Livro fecham no mesmo número');
  ok(Number.isInteger(s.apostadoLivro) && Number.isInteger(s.retornoLivro), 'centavos inteiros');
});

prova('em 300.000 lances a perda real fica a menos de 4 erros padrão da esperada', () => {
  const N = 300000;
  const s = simularPadrao(N, 20260930);
  igual(s.caixa, s.livro, 'caixa e Livro fecham');
  const sigma = Math.sqrt(s.variancia);
  const z = (s.livro + s.perdaEsperada) / sigma;
  ok(Math.abs(z) <= 4, `perda real ${(-s.livro / 100).toFixed(2)} fichas contra esperada ${(s.perdaEsperada / 100).toFixed(2)}, ${z.toFixed(2)} erros padrão`);
  const vantagemReal = -s.livro / s.apostadoLivro;
  const vantagemEsperada = s.perdaEsperada / s.apostadoLivro;
  entre(vantagemEsperada, 0.01, 0.03, 'vantagem média do padrão');
  relatar(`  craps 300.000 lances               ${s.decisoes.toLocaleString('pt-BR')} decisões, apostado ${(s.apostadoLivro / 100).toFixed(0)} fichas`);
  relatar(`  craps perda real x esperada        ${(-s.livro / 100).toFixed(2)} contra ${(s.perdaEsperada / 100).toFixed(2)} fichas (${z >= 0 ? '+' : ''}${z.toFixed(2)} σ), vantagem ${(vantagemReal * 100).toFixed(3)}% contra ${(vantagemEsperada * 100).toFixed(3)}%`);
  relatar(`  craps simulação tempo              ${(s.ms / 1000).toFixed(2)} s, ${Math.round(N / (s.ms / 1000)).toLocaleString('pt-BR')} lances/s`);
});

prova('a linha do passe simulada bate com a vantagem exata', () => {
  const g = geradorRapido(4321);
  const N = 2000000;
  let liquido = 0;
  let ponto = null;
  let decisoes = 0;
  for (let k = 0; k < N; k++) {
    const soma = (g.inteiro(6) + 1) + (g.inteiro(6) + 1);
    if (ponto === null) {
      if (soma === 7 || soma === 11) { liquido++; decisoes++; }
      else if (soma === 2 || soma === 3 || soma === 12) { liquido--; decisoes++; }
      else ponto = soma;
    } else if (soma === ponto) { liquido++; decisoes++; ponto = null; }
    else if (soma === 7) { liquido--; decisoes++; ponto = null; }
  }
  const medida = -liquido / decisoes;
  const se = Math.sqrt(F.pass.variancia / decisoes);
  const z = (medida - F.pass.vantagem) / se;
  ok(Math.abs(z) <= 3, `passe simulado ${(medida * 100).toFixed(4)}% contra ${(F.pass.vantagem * 100).toFixed(4)}%, ${z.toFixed(2)} erros padrão`);
  relatar(`  craps passe simulado               ${decisoes.toLocaleString('pt-BR')} decisões, ${(medida * 100).toFixed(4)}% (${z >= 0 ? '+' : ''}${z.toFixed(2)} σ)`);
});
