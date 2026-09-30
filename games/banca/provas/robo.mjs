// O robô: senta em cada mesa e joga 200 rodadas com apostas variadas, pelas
// mesmas funções que a interface chama. Ele não pode deixar o saldo negativo
// sem o crédito da casa, nem travar uma mesa num estado de onde não se sai.
// No fim, o Livro precisa fechar: a perda esperada total é a soma exata das
// rodadas, e nenhuma aposta de nenhum jogo favorece o jogador.

import { bloco, prova, ok, igual, perto, relatar, geradorRapido, fonteDeterministica } from './base.mjs';
import { criarCasa, armazemDescartavel } from '../js/nucleo/casa.js';
import { criarSessaoRoleta } from '../js/jogos/roleta/sessao.js';
import { APOSTAS as APOSTAS_ROLETA, fichaDe as fichaRoleta, ANUNCIADAS } from '../js/jogos/roleta/regras.js';
import { criarSessaoBlackjack } from '../js/jogos/blackjack/sessao.js';
import { VANTAGEM_BLACKJACK, VANTAGEM_SEGURO } from '../js/jogos/blackjack/vantagem.js';
import { criarSessaoVideoPoquer } from '../js/jogos/videopoquer/sessao.js';
import { construirTabelas, analisar } from '../js/jogos/videopoquer/analise.js';
import { RTP5, RTP1A4 } from '../js/jogos/videopoquer/constantes.js';
import { criarSessaoBacara } from '../js/jogos/bacara/sessao.js';
import { APOSTAS as APOSTAS_BACARA, fichas as fichasBacara } from '../js/jogos/bacara/regras.js';
import { criarSessaoCraps } from '../js/jogos/craps/sessao.js';
import { ZONAS, fichaDe as fichaCraps, PONTOS } from '../js/jogos/craps/regras.js';
import { criarSessaoNiquel } from '../js/jogos/niquel/sessao.js';
import { APOSTAS_LINHA, rtpExato, conferir as conferirNiquel } from '../js/jogos/niquel/regras.js';
import { conferir as conferirRoleta } from '../js/jogos/roleta/regras.js';
import { conferir as conferirBlackjack } from '../js/jogos/blackjack/regras.js';
import { conferir as conferirVideoPoquer } from '../js/jogos/videopoquer/regras.js';
import { conferir as conferirBacara } from '../js/jogos/bacara/regras.js';
import { conferir as conferirCraps } from '../js/jogos/craps/regras.js';
import { conferirHash } from '../js/nucleo/justo.js';

const CONFERIR = {
  roleta: conferirRoleta, blackjack: conferirBlackjack, videopoquer: conferirVideoPoquer,
  bacara: conferirBacara, craps: conferirCraps, niquel: conferirNiquel,
};

const RODADAS = 200;
let tabelasVP = null;
const analisarVP = (mao, moedas) => analisar(mao, tabelasVP ??= construirTabelas(), moedas);

// Um robô por mesa. Devolve o que aconteceu para o relatório.
function jogar(nome, casa, sessao, rodada) {
  const g = geradorRapido(nome.length * 977 + 13);
  let rodadas = 0, creditos = 0, recusas = 0, passos = 0;
  const n0 = casa.livro.resumo(nome).n;
  while (casa.livro.resumo(nome).n - n0 < RODADAS) {
    if (++passos > RODADAS * 60) throw new Error(`${nome}: o robô travou depois de ${rodadas} rodadas`);
    const antes = casa.livro.resumo(nome).n;
    try { rodada(sessao, g); } catch (e) {
      if (/[Ss]aldo insuficiente/.test(e.message)) { casa.pedirCredito(); creditos++; continue; }
      recusas++;
      if (recusas > RODADAS * 20) throw new Error(`${nome}: recusas demais (${e.message})`);
    }
    if (!Number.isInteger(casa.carteira.saldo) || casa.carteira.saldo < 0) throw new Error(`${nome}: saldo inválido ${casa.carteira.saldo}`);
    if (casa.livro.resumo(nome).n > antes) rodadas++;
  }
  return { rodadas, creditos, recusas, passos };
}

const ROBOS = {
  roleta: [criarSessaoRoleta, (s, g) => {
    const n = 1 + g.inteiro(4);
    for (let i = 0; i < n; i++) {
      if (g.real() < 0.15) s.apostarAnunciada(Object.keys(ANUNCIADAS)[g.inteiro(4)], 100, g.inteiro(37));
      else s.apostar(APOSTAS_ROLETA[g.inteiro(APOSTAS_ROLETA.length)].id, 100 * (1 + g.inteiro(10)));
    }
    s.girar();
  }],
  blackjack: [criarSessaoBlackjack, (s, g) => {
    if (s.estado === 'fim') s.novaRodada();
    if (s.estado === 'aposta') { s.definirAposta(500 * (1 + g.inteiro(6))); s.dar(); }
    for (let k = 0; k < 30 && (s.estado === 'seguro' || s.estado === 'jogando'); k++) {
      if (s.estado === 'seguro') { s.seguro(g.real() < 0.2); continue; }
      const acoes = s.acoes();
      const c = s.conselho();
      s.agir(g.real() < 0.8 && acoes.includes(c.acao) ? c.acao : acoes[g.inteiro(acoes.length)]);
    }
  }],
  videopoquer: [s => s, (s, g) => {
    if (s.estado !== 'descarte') {
      s.definirMoedas(1 + g.inteiro(5));
      s.definirMoeda([25, 100, 500][g.inteiro(3)]);
      s.dar();
    }
    const { melhor } = s.conselho();
    const mask = g.real() < 0.7 ? melhor : g.inteiro(32);
    for (let i = 0; i < 5; i++) if (!!(mask & (1 << i)) !== s.segurar[i]) s.alternar(i);
    s.trocar();
  }],
  bacara: [criarSessaoBacara, (s, g) => {
    if (s.estado === 'fim') s.novaRodada();
    const n = 1 + g.inteiro(3);
    for (let i = 0; i < n; i++) s.apostar(APOSTAS_BACARA[g.inteiro(APOSTAS_BACARA.length)], 500 * (1 + g.inteiro(4)));
    s.dar();
  }],
  craps: [criarSessaoCraps, (s, g) => {
    const candidatas = ZONAS.filter(z => z.tipo !== 'pontovem' && s.podeApostar(z.id).ok);
    const n = g.inteiro(3);
    for (let i = 0; i < n && candidatas.length; i++) {
      const z = candidatas[g.inteiro(candidatas.length)];
      s.apostar(z.id, 500 * (1 + g.inteiro(3)));
    }
    if (s.total() === 0) s.apostar(s.ponto ? 'field' : 'pass', 500);
    if (g.real() < 0.05) for (const z of ZONAS) if (s.apostas[z.id] > 0 && s.podeRetirar(z.id)) { s.retirar(z.id); break; }
    if (s.total() > 0) s.lancar();
  }],
  niquel: [criarSessaoNiquel, (s, g) => {
    if (!s.emGirosGratis && g.real() < 0.2) s.definirApostaLinha(APOSTAS_LINHA[g.inteiro(5)]);
    s.girar();
  }],
};

bloco('robô: 200 rodadas em cada mesa');

const casa = criarCasa({ armazem: armazemDescartavel(), fonte: fonteDeterministica(2026) });
const relatorio = {};
const sessoes = {};
// o arquivo da casa guarda só os 300 últimos; o robô copia os de cada mesa ao sair dela
const revelados = [];
let perdaDasRodadas = 0;
casa.ouvir((tipo, r) => { if (tipo === 'rodada') perdaDasRodadas += r.perdaEsperada; });

for (const [nome, [criar, rodada]] of Object.entries(ROBOS)) {
  prova(`o robô joga ${RODADAS} rodadas de ${nome} sem saldo negativo e sem travar`, () => {
    const sessao = nome === 'videopoquer' ? criarSessaoVideoPoquer(casa, { analisar: analisarVP }) : criar(casa);
    sessoes[nome] = sessao;
    relatorio[nome] = jogar(nome, casa, sessao, rodada);
    ok(relatorio[nome].rodadas >= RODADAS, `${nome}: só ${relatorio[nome].rodadas} rodadas`);
    revelados.push(...casa.justo.revelados.filter(r => r.jogo === nome));
    // a mesa volta a aceitar aposta depois da última rodada
    if (nome === 'blackjack') ok(['aposta', 'fim'].includes(sessao.estado), `blackjack parado em ${sessao.estado}`);
    if (nome === 'videopoquer') ok(sessao.estado !== 'descarte', 'vídeo pôquer parado no descarte');
  });
}

prova('quebrado, o robô pega o crédito da casa e segue; o saldo nunca fica negativo', () => {
  const pobre = criarCasa({ armazem: armazemDescartavel(), fonte: fonteDeterministica(404) });
  pobre.carteira.debitar(pobre.carteira.saldo - 2000);
  let creditos = 0;
  for (const [nome, [criar, rodada]] of Object.entries(ROBOS)) {
    if (nome === 'videopoquer') continue;
    const r = jogar(nome, pobre, criar(pobre), rodada);
    creditos += r.creditos;
  }
  ok(creditos > 0, 'o robô quebrado nunca pediu crédito');
  ok(pobre.carteira.divida > 0, 'a dívida sumiu');
  ok(pobre.carteira.estado.juros > 0, 'a dívida não cobrou juro');
  ok(pobre.livro.estado.eventos.filter(e => e.tipo === 'credito').length === creditos, 'crédito sem registro no Livro');
  relatar(`  robô      quebrado: ${creditos} créditos da casa em 1.000 rodadas, dívida de ${(pobre.carteira.divida / 100).toFixed(2)} com ${(pobre.carteira.estado.juros / 100).toFixed(2)} de juros`);
});

prova('o Livro fecha: a perda esperada total é a soma exata das rodadas', () => {
  const total = casa.livro.resumo();
  perto(total.perdaEsperada, perdaDasRodadas, 1e-6, 'soma das rodadas');
  let porJogo = 0;
  for (const j of casa.livro.jogos()) porJogo += casa.livro.resumo(j).perdaEsperada;
  perto(porJogo, total.perdaEsperada, 1e-6, 'soma dos jogos');
  igual(total.n, casa.livro.estado.seq, 'rodadas contadas');
  // o dinheiro fecha: saldo = inicial + resultado + crédito - juros pagos
  const c = casa.carteira.estado;
  // fichas que ainda estão no pano do craps (colocação, linha com ponto) saíram do saldo e não foram decididas
  const noPano = sessoes.craps ? sessoes.craps.total() : 0;
  igual(casa.carteira.saldo + noPano, 100000 + total.real + c.emprestado - c.pago, 'saldo reconstruído pelo Livro');
  for (const j of casa.livro.jogos()) {
    const r = casa.livro.resumo(j);
    const q = relatorio[j] ?? {};
    relatar(`  robô      ${j.padEnd(12)} ${String(r.n).padStart(4)} rodadas  apostado ${(r.apostado / 100).toFixed(0).padStart(7)}  esperado ${(-r.perdaEsperada / 100).toFixed(2).padStart(9)}  real ${(r.real / 100).toFixed(2).padStart(9)}  ${r.sorte >= 0 ? '+' : ''}${r.sorte.toFixed(2)} σ  créditos ${q.creditos ?? 0}`);
  }
});

prova('tudo o que a casa revelou nas 1.200 rodadas confere no painel Conferir, sapatos inclusive', () => {
  const porJogo = {}, coincidem = {};
  for (const r of revelados) {
    const conferir = CONFERIR[r.jogo];
    ok(conferir, `jogo sem Conferir: ${r.jogo}`);
    ok(conferirHash(r.semente, r.hash), `${r.jogo} ${r.contador}: a semente não bate com o hash`);
    ok(!conferirHash(r.semente.replace(/^./, x => x === '0' ? '1' : '0'), r.hash), `${r.jogo}: semente adulterada bateu com o hash`);
    const c = conferir(r);
    ok(c.confere, `${r.jogo} ${r.contador}: ${c.descricao}`);
    porJogo[r.jogo] = (porJogo[r.jogo] ?? 0) + 1;
    // com a semente do jogador trocada o sorteio muda; numa roleta de 37 casas
    // ele ainda coincide 1 vez em 37, por puro acaso, e é só isso que se admite
    if (conferir({ ...r, sementeJogador: r.sementeJogador + 'x' }).confere) coincidem[r.jogo] = (coincidem[r.jogo] ?? 0) + 1;
  }
  const ACASO = { roleta: 1 / 37, craps: 1 / 36, niquel: 0, videopoquer: 0, blackjack: 0, bacara: 0 };
  for (const j of Object.keys(ACASO)) {
    ok(porJogo[j] > 0, `nada revelado em ${j}`);
    const n = porJogo[j], k = coincidem[j] ?? 0, p = ACASO[j];
    ok(k <= n * p + 4 * Math.sqrt(n * p * (1 - p)) + 1e-9, `${j}: ${k} de ${n} registros adulterados passaram`);
  }
  relatar(`  conferir  ${Object.entries(porJogo).map(([j, n]) => `${j} ${n}`).join(', ')} revelados: todos conferem; com a semente do jogador trocada, só coincidem por acaso ${Object.entries(coincidem).map(([j, k]) => `${j} ${k}`).join(', ') || 'nenhum'}`);
});

bloco('a casa sempre ganha');

prova('nenhuma aposta de nenhum jogo tem valor esperado positivo; só as odds do craps dão zero', () => {
  const vantagens = [];
  for (const a of APOSTAS_ROLETA) vantagens.push(['roleta ' + a.id, fichaRoleta(a.id).vantagem]);
  const fb = fichasBacara();
  for (const id of APOSTAS_BACARA) vantagens.push(['bacará ' + id, fb[id].vantagem]);
  for (const z of ZONAS) {
    if (z.tipo === 'pontovem') continue;
    for (const p of [null, ...PONTOS]) vantagens.push([`craps ${z.id} ponto ${p}`, fichaCraps(z.id, p).vantagem]);
  }
  vantagens.push(['blackjack com a básica', VANTAGEM_BLACKJACK.vantagem]);
  vantagens.push(['blackjack seguro', VANTAGEM_SEGURO]);
  vantagens.push(['vídeo pôquer 5 moedas perfeito', 1 - RTP5]);
  vantagens.push(['vídeo pôquer 1 a 4 moedas perfeito', 1 - RTP1A4]);
  vantagens.push(['caça-níquel', 1 - rtpExato().rtp]);
  let zeros = 0;
  for (const [nome, v] of vantagens) {
    ok(v > -1e-12, `${nome} favorece o jogador: ${v}`);
    if (Math.abs(v) < 1e-12) {
      zeros++;
      ok(/odds/.test(nome), `${nome} tem vantagem zero e não é odds`);
    }
  }
  ok(zeros > 0, 'as odds sumiram');
  relatar(`  casa      ${vantagens.length} apostas conferidas; ${zeros} com vantagem exatamente zero (todas odds do craps); nenhuma a favor do jogador`);
});

prova('a aleatoriedade não olha o saldo: mesmas sementes, saldos opostos, resultados idênticos em todas as mesas', () => {
  const rico = criarCasa({ armazem: armazemDescartavel(), fonte: fonteDeterministica(55) });
  const pobre = criarCasa({ armazem: armazemDescartavel(), fonte: fonteDeterministica(55) });
  rico.carteira.creditar(1_000_000_00);
  pobre.carteira.debitar(pobre.carteira.saldo - 1000);
  const saidas = { rico: [], pobre: [] };
  for (const [quem, c] of [['rico', rico], ['pobre', pobre]]) {
    const r = criarSessaoRoleta(c), b = criarSessaoBacara(c), cr = criarSessaoCraps(c), n = criarSessaoNiquel(c), bj = criarSessaoBlackjack(c);
    for (let k = 0; k < 40; k++) {
      if (c.carteira.saldo < 5000) c.pedirCredito();
      r.apostar('p0', 100); saidas[quem].push(r.girar().numero);
      if (b.estado === 'fim') b.novaRodada();
      b.apostar('banca', 500); b.dar(); saidas[quem].push(b.mao.vencedor + b.mao.totalBanca);
      if (cr.total() === 0) cr.apostar(cr.ponto ? 'field' : 'pass', 500);
      saidas[quem].push(cr.lancar().dados.join());
      saidas[quem].push(n.girar().paradas.join());
      if (bj.estado === 'fim') bj.novaRodada();
      bj.definirAposta(500); bj.dar();
      while (bj.estado === 'seguro' || bj.estado === 'jogando') bj.estado === 'seguro' ? bj.seguro(false) : bj.agir('parar');
      saidas[quem].push(bj.maos.map(m => m.cartas.join()).join('|') + bj.banca.cartas.join());
    }
  }
  igual(saidas.rico.join(';'), saidas.pobre.join(';'), 'resultados divergiram entre saldo alto e baixo');
});
