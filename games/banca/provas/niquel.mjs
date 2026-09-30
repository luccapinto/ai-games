// Provas do MALECÓN 57: o retorno exato por enumeração, a força bruta que
// confere a fórmula, dez milhões de giros simulados, o curinga, a lua, os
// giros grátis e a sessão que paga, registra e revela.

import { bloco, prova, ok, igual, perto, entre, lanca, relatar, geradorRapido, fonteDeterministica } from './base.mjs';
import {
  TIRAS, LINHAS, TABELA, TABELA_DISPERSO, GIROS_GRATIS, APOSTAS_LINHA, N_LINHAS, IDS,
  rtpExato, forcaBruta, simular, premioDeLinha, avaliar, janela, derivar, conferir, COMPRIMENTOS, varianciaPorGiro,
} from '../js/jogos/niquel/regras.js';
import { criarSessaoNiquel } from '../js/jogos/niquel/sessao.js';
import { criarCasa, armazemDescartavel, armazemMemoria } from '../js/nucleo/casa.js';
import { criarGerador } from '../js/nucleo/justo.js';

bloco('caça-níquel: tiras e tabela');

prova('cinco tiras de 30 a 48 paradas, vinte e cinco linhas distintas', () => {
  igual(TIRAS.length, 5, 'rolos');
  for (const t of TIRAS) entre(t.length, 30, 48, 'paradas na tira');
  igual(LINHAS.length, 25, 'linhas');
  igual(new Set(LINHAS.map(l => l.join())).size, 25, 'linhas repetidas');
  for (const l of LINHAS) for (const f of l) ok(f >= 0 && f <= 2, 'fila fora da janela');
  for (const t of TIRAS) for (const s of t) ok(IDS.includes(s), `símbolo desconhecido ${s}`);
});

prova('a lua nunca aparece duas vezes na mesma janela de um rolo', () => {
  for (const [r, t] of TIRAS.entries()) {
    const n = t.length;
    for (let i = 0; i < n; i++) {
      const luas = [0, 1, 2].filter(k => t[(i + k) % n] === 'lua').length;
      ok(luas <= 1, `rolo ${r + 1}, parada ${i}: ${luas} luas visíveis`);
    }
  }
});

prova('o curinga substitui tudo menos a lua e paga a própria linha', () => {
  igual(premioDeLinha(['flamingo', 'casa', 'flamingo', 'copas', 'paus']).quantidade, 3, 'curinga no meio');
  igual(premioDeLinha(['casa', 'casa', 'trompete', 'trompete', 'ouros']).simbolo, 'trompete', 'curinga completa o trompete');
  igual(premioDeLinha(['casa', 'casa', 'casa', 'casa', 'casa']).pago, TABELA.casa[2], 'cinco curingas pagam o prêmio da casa');
  igual(premioDeLinha(['casa', 'casa', 'casa', 'palmeira', 'lua']).pago, Math.max(TABELA.casa[0], TABELA.palmeira[1]), 'escolhe o maior entre curingas sozinhos e o símbolo completado');
  igual(premioDeLinha(['lua', 'casa', 'casa', 'casa', 'casa']).pago, 0, 'linha começando pela lua não paga');
  igual(premioDeLinha(['maraca', 'maraca', 'lua', 'maraca', 'maraca']).pago, 0, 'a lua quebra a sequência');
  igual(premioDeLinha(['copas', 'copas', 'paus', 'copas', 'copas']).pago, 0, 'dois não pagam');
  igual(premioDeLinha(['coquetel', 'coquetel', 'coquetel', 'coquetel', 'coquetel']).pago, TABELA.coquetel[2], 'cinco iguais');
});

bloco('caça-níquel: retorno exato');

let exato;
prova('o retorno exato por enumeração fica entre 94% e 97%', () => {
  exato = rtpExato();
  entre(exato.rtp, 0.94, 0.97, 'retorno');
  ok(exato.t < 1, `giros grátis geram ${exato.t} giros por giro: o bônus nunca acabaria`);
  perto(exato.rtp, exato.base + exato.bonus, 1e-12, 'base + bônus');
  relatar(`  niquel    retorno exato ${(exato.rtp * 100).toFixed(4)}%  (linhas ${(exato.linha * 100).toFixed(3)}%, lua ${(exato.disperso * 100).toFixed(3)}%, giros grátis ${(exato.bonus * 100).toFixed(3)}%)`);
  relatar(`            bônus a cada ${Math.round(1 / exato.chanceBonus)} giros; cada giro grátis dá em média ${exato.t.toFixed(4)} giros novos`);
});

prova('a força bruta sobre todas as paradas confere a fórmula da linha e da lua', () => {
  const total = COMPRIMENTOS.reduce((a, b) => a * b, 1);
  for (const l of [0, 7, 24]) {
    const b = forcaBruta(l);
    igual(b.combinacoes, total, 'combinações');
    perto(b.esperado, exato.linha, 1e-12, `linha ${l}: valor esperado`);
    for (let k = 0; k < b.distDisperso.length; k++) perto(b.distDisperso[k], exato.distDisperso[k] ?? 0, 1e-12, `luas = ${k}`);
    if (l === 0) relatar(`            força bruta: ${total.toLocaleString('pt-BR')} combinações de paradas por linha em ${b.ms} ms`);
  }
});

prova('o valor dos giros grátis segue o processo de ramificação N·v/(1-t)', () => {
  const m = GIROS_GRATIS.multiplicador;
  ok(m >= 2, 'multiplicador');
  // v é o retorno médio de um giro grátis em apostas totais, já com o multiplicador
  perto(exato.v, m * exato.base, 1e-9, 'um giro grátis vale o giro base vezes o multiplicador');
  const esperadoBonus = [3, 4, 5].reduce((s, k) => s + (exato.distDisperso[k] ?? 0) * GIROS_GRATIS[k] * exato.v / (1 - exato.t), 0);
  perto(exato.bonus, esperadoBonus, 1e-9, 'contribuição do bônus');
});

prova('dez milhões de giros simulados caem a menos de 0,3 ponto do retorno exato', () => {
  const g = geradorRapido(2026);
  const t0 = performance.now();
  const r = simular(10_000_000, g.u32);
  const s = (performance.now() - t0) / 1000;
  const erroPadrao = r.desvio / Math.sqrt(10_000_000);
  ok(Math.abs(r.rtp - exato.rtp) < 0.003, `simulado ${(r.rtp * 100).toFixed(3)}% contra ${(exato.rtp * 100).toFixed(3)}%`);
  relatar(`            10 milhões de giros: ${(r.rtp * 100).toFixed(4)}% (erro-padrão ${(erroPadrao * 100).toFixed(3)} ponto, ${((r.rtp - exato.rtp) / erroPadrao).toFixed(2)} σ), acerto ${(r.acerto * 100).toFixed(1)}%, desvio ${r.desvio.toFixed(2)} apostas por giro, ${Math.round(10_000_000 / s).toLocaleString('pt-BR')} giros/s`);
});

prova('o tamanho da aposta não muda o retorno: o prêmio escala com a aposta', () => {
  const g = geradorRapido(5);
  for (let k = 0; k < 2000; k++) {
    const p = COMPRIMENTOS.map(n => g.inteiro(n));
    const um = avaliar(p, 1).total;
    for (const a of APOSTAS_LINHA) igual(avaliar(p, a).total, um * a, `aposta ${a}`);
    igual(avaliar(p, 1, 3).total, um * 3, 'multiplicador dos giros grátis');
  }
});

prova('a janela avaliada bate com a tira: a linha do meio é a parada + 1', () => {
  const p = [3, 10, 20, 5, 0];
  const j = janela(p);
  for (let r = 0; r < 5; r++) for (let f = 0; f < 3; f++) igual(j[r][f], TIRAS[r][(p[r] + f) % TIRAS[r].length], `rolo ${r}, fila ${f}`);
  const av = avaliar(p, 1);
  let soma = 0;
  for (const l of av.linhas) {
    const simbolos = LINHAS[l.linha].map((f, r) => j[r][f]);
    igual(premioDeLinha(simbolos).pago, l.pago, `linha ${l.linha}`);
    soma += l.pago;
  }
  igual(av.total, soma + av.disperso.pago, 'total');
});

bloco('caça-níquel: sessão');

function casaTeste(semente) {
  return criarCasa({ armazem: armazemDescartavel(), fonte: fonteDeterministica(semente) });
}

prova('o giro pago debita, paga o que a janela diz, revela e o Conferir reproduz', () => {
  const casa = casaTeste(1);
  const s = criarSessaoNiquel(casa);
  s.definirApostaLinha(10);
  for (let k = 0; k < 300; k++) {
    const antes = casa.carteira.saldo;
    const gratis = s.emGirosGratis;
    const r = s.girar();
    const esperado = avaliar(r.paradas, gratis ? casa.mesa('niquel').apostaDoBonus : 10, gratis ? GIROS_GRATIS.multiplicador : 1).total;
    igual(r.avaliacao.total, esperado, 'prêmio');
    igual(casa.carteira.saldo, antes - (gratis ? 0 : 250) + esperado, 'saldo');
    const rev = casa.justo.revelados.at(-1);
    ok(conferir(rev).confere, 'Conferir');
    igual(derivar(criarGerador(rev.semente, rev.sementeJogador, rev.contador)).join(), r.paradas.join(), 'paradas');
    if (casa.carteira.saldo < 250) casa.pedirCredito();
  }
});

prova('giros grátis não custam, pagam triplo e somam quando saem mais luas', () => {
  // procura um bônus com uma fonte fixa e acompanha até o fim
  const casa = casaTeste(77);
  const s = criarSessaoNiquel(casa);
  s.definirApostaLinha(1);
  let achou = false, retomou = false;
  for (let k = 0; k < 20000 && !(achou && !s.emGirosGratis); k++) {
    const gratis = s.emGirosGratis;
    const antes = casa.carteira.saldo;
    const restantes = s.girosRestantes;
    const r = s.girar();
    if (gratis) {
      achou = true;
      igual(r.rodada.apostado, 0, 'giro grátis não cobra');
      igual(r.rodada.perdaEsperada, 0, 'giro grátis não tem perda esperada própria');
      igual(casa.carteira.saldo, antes + r.avaliacao.total, 'giro grátis só paga');
      const novos = GIROS_GRATIS[r.avaliacao.disperso.quantidade] ?? 0;
      igual(s.girosRestantes, restantes - 1 + novos, 'contagem dos giros restantes');
      if (novos) retomou = true;
    }
    if (casa.carteira.saldo < 25) casa.pedirCredito();
  }
  ok(achou, 'nenhum bônus em 20 mil giros');
  relatar(`            sessão: bônus completo acompanhado${retomou ? ', com giros somados no meio' : ''}`);
});

prova('o Livro soma exato: perda esperada só nos giros pagos, retorno de todos', () => {
  const casa = casaTeste(9);
  const s = criarSessaoNiquel(casa);
  s.definirApostaLinha(5);
  let pagos = 0;
  for (let k = 0; k < 2000; k++) {
    if (!s.emGirosGratis) pagos++;
    s.girar();
    if (casa.carteira.saldo < 125) casa.pedirCredito();
  }
  const r = casa.livro.resumo('niquel');
  perto(r.perdaEsperada, pagos * 125 * (1 - exato.rtp), 1e-6, 'perda esperada');
  igual(r.apostado, pagos * 125, 'apostado');
  ok(casa.carteira.saldo >= 0, 'saldo negativo');
  perto(varianciaPorGiro(), r.variancia / (pagos * 125 * 125), 1e-9, 'variância por giro pago');
});

prova('sem saldo não gira, e a aposta é uma das sete declaradas', () => {
  const casa = casaTeste(3);
  const s = criarSessaoNiquel(casa);
  lanca(() => s.definirApostaLinha(3), 'aceitou aposta fora da lista');
  casa.carteira.debitar(casa.carteira.saldo);
  lanca(() => s.girar(), 'girou sem saldo');
  igual(casa.carteira.saldo, 0, 'saldo');
});

prova('a máquina não olha o saldo: mesmas sementes, saldos diferentes, mesmas paradas', () => {
  const a = casaTeste(88), b = casaTeste(88);
  b.carteira.creditar(50000000);
  const sa = criarSessaoNiquel(a), sb = criarSessaoNiquel(b);
  for (let k = 0; k < 200; k++) {
    igual(sa.girar().paradas.join(), sb.girar().paradas.join(), `giro ${k}`);
    if (a.carteira.saldo < 250) a.pedirCredito();
  }
});

prova('recarregar no meio dos giros grátis mantém a contagem e a aposta do bônus', () => {
  const armazem = armazemMemoria();
  const casa = criarCasa({ armazem, fonte: fonteDeterministica(77) });
  const s = criarSessaoNiquel(casa);
  s.definirApostaLinha(1);
  for (let k = 0; k < 20000 && !s.emGirosGratis; k++) { s.girar(); if (casa.carteira.saldo < 25) casa.pedirCredito(); }
  ok(s.emGirosGratis, 'não entrou no bônus');
  const restantes = s.girosRestantes;
  const outra = criarSessaoNiquel(criarCasa({ armazem }));
  igual(outra.girosRestantes, restantes, 'giros restantes');
  ok(outra.emGirosGratis, 'bônus perdido na recarga');
});
