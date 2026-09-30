// Provas da roleta: o pano, os pagamentos casa por casa, a pista francesa,
// a vantagem de 1/37 em toda aposta, a física que chega no número sorteado
// e a sessão que paga, registra e revela.

import { bloco, prova, ok, igual, perto, entre, lanca, relatar, quiQuadrado, limiteQui, fonteDeterministica, geradorRapido } from './base.mjs';
import {
  APOSTAS, APOSTA_POR_ID, ORDEM_RODA, VERMELHOS, numeroNa, fichaDe, retornoDe, contaDaMesa, resolver,
  ANUNCIADAS, apostasAnunciada, numerosAnunciada, vizinhosDe, derivar, conferir, corDe,
} from '../js/jogos/roleta/regras.js';
import { simularGiro, amostra, PASSO, RAIO } from '../js/jogos/roleta/fisica.js';
import { criarSessaoRoleta } from '../js/jogos/roleta/sessao.js';
import { criarCasa, armazemMemoria, armazemDescartavel } from '../js/nucleo/casa.js';
import { criarGerador } from '../js/nucleo/justo.js';

bloco('roleta: o pano');

prova('a roda europeia tem os 37 números, uma vez cada, e 18 vermelhos', () => {
  igual(ORDEM_RODA.length, 37, 'casas');
  igual(new Set(ORDEM_RODA).size, 37, 'números distintos');
  igual(Math.min(...ORDEM_RODA), 0, 'zero'); igual(Math.max(...ORDEM_RODA), 36, 'trinta e seis');
  igual(VERMELHOS.size, 18, 'vermelhos');
  // na roda, vermelho e preto alternam em volta de todo o anel, fora o zero
  for (let i = 1; i < 36; i++) ok(corDe(ORDEM_RODA[i]) !== corDe(ORDEM_RODA[i + 1]), `cores repetidas na roda em ${ORDEM_RODA[i]}`);
});

prova('o catálogo tem 157 apostas: 37 plenos, 60 cavalos, 14 transversais, 23 quadras, 11 linhas', () => {
  const por = {};
  for (const a of APOSTAS) por[a.tipo] = (por[a.tipo] ?? 0) + 1;
  igual(APOSTAS.length, 157, 'total');
  igual(por.pleno, 37, 'plenos'); igual(por.cavalo, 60, 'cavalos'); igual(por.transversal, 14, 'transversais');
  igual(por.quadra, 23, 'quadras'); igual(por.linha, 11, 'linhas'); igual(por.duzia, 3, 'dúzias');
  igual(por.coluna, 3, 'colunas'); igual(por.simples, 6, 'chances simples');
  igual(new Set(APOSTAS.map(a => a.id)).size, APOSTAS.length, 'ids repetidos');
});

prova('cada aposta cobre números vizinhos no pano, conferido pela geometria', () => {
  const pos = {};
  for (let c = 0; c < 12; c++) for (let r = 0; r < 3; r++) pos[numeroNa(r, c)] = [r, c];
  pos[0] = [1, -1];
  for (const a of APOSTAS) {
    if (!['cavalo', 'quadra', 'transversal', 'linha'].includes(a.tipo) || a.numeros.includes(0)) continue;
    const rs = a.numeros.map(n => pos[n][0]), cs = a.numeros.map(n => pos[n][1]);
    const dr = Math.max(...rs) - Math.min(...rs), dc = Math.max(...cs) - Math.min(...cs);
    if (a.tipo === 'cavalo') ok(dr + dc === 1, `${a.id} não é vizinho`);
    if (a.tipo === 'quadra') ok(dr === 1 && dc === 1, `${a.id} não é quadrado`);
    if (a.tipo === 'transversal') ok(dr === 2 && dc === 0, `${a.id} não é uma coluna do pano`);
    if (a.tipo === 'linha') ok(dr === 2 && dc === 1, `${a.id} não são duas transversais vizinhas`);
  }
  igual(APOSTA_POR_ID['t0-1-2'].numeros.join(), '0,1,2', 'trio do zero');
  igual(APOSTA_POR_ID.q0.numeros.join(), '0,1,2,3', 'quadra do zero');
});

prova('todas as 37 casas pagam o valor certo em cada tipo de aposta', () => {
  const PAGA = { pleno: 35, cavalo: 17, transversal: 11, quadra: 8, linha: 5, duzia: 2, coluna: 2, simples: 1 };
  const v = 1000;
  for (let n = 0; n <= 36; n++) {
    for (const a of APOSTAS) {
      igual(a.paga, PAGA[a.tipo], `${a.id} paga`);
      const esperado = a.numeros.includes(n) ? v * (PAGA[a.tipo] + 1) : 0;
      igual(retornoDe(a.id, v, n), esperado, `${a.id} com o ${n}`);
    }
    const cobre = APOSTAS.filter(a => a.numeros.includes(n));
    const tipos = t => cobre.filter(a => a.tipo === t).length;
    igual(tipos('pleno'), 1, `${n}: plenos`);
    if (n > 0) {
      igual(tipos('duzia'), 1, `${n}: dúzias`); igual(tipos('coluna'), 1, `${n}: colunas`); igual(tipos('simples'), 3, `${n}: chances simples`);
    } else {
      igual(tipos('duzia') + tipos('coluna') + tipos('simples'), 0, 'o zero perde as apostas de fora');
    }
  }
});

prova('a vantagem da casa é exatamente 1/37 = 2,70% em todas as 157 apostas', () => {
  for (const a of APOSTAS) {
    const f = fichaDe(a.id);
    perto(f.vantagem, 1 / 37, 1e-12, a.id);
    perto(f.chance, a.numeros.length / 37, 1e-12, `${a.id} chance`);
  }
  igual((100 / 37).toFixed(2), '2.70', 'arredondamento');
});

bloco('roleta: pista francesa');

prova('vizinhos, terço e órfãos dividem a roda inteira, sem sobra e sem repetir', () => {
  const v = numerosAnunciada('vizinhos'), t = numerosAnunciada('terco'), o = numerosAnunciada('orfaos');
  igual(v.length, 17, 'vizinhos cobrem 17'); igual(t.length, 12, 'terço cobre 12'); igual(o.length, 8, 'órfãos cobrem 8');
  const todos = new Set([...v, ...t, ...o]);
  igual(todos.size, 37, 'as três juntas cobrem a roda');
  // e cada uma é um arco contínuo da roda (os órfãos são dois arcos)
  const i0 = ORDEM_RODA.indexOf(22);
  const arcoVizinhos = Array.from({ length: 17 }, (_, k) => ORDEM_RODA[(i0 + k) % 37]);
  igual([...arcoVizinhos].sort((a, b) => a - b).join(), [...v].sort((a, b) => a - b).join(), 'vizinhos do 22 ao 25');
  const i1 = ORDEM_RODA.indexOf(27);
  const arcoTerco = Array.from({ length: 12 }, (_, k) => ORDEM_RODA[(i1 + k) % 37]);
  igual([...arcoTerco].sort((a, b) => a - b).join(), [...t].sort((a, b) => a - b).join(), 'terço do 27 ao 33');
});

prova('as anunciadas usam 9, 6, 5 e 4 fichas, e vizinhos de um número usa 5', () => {
  const fichas = nome => apostasAnunciada(nome).reduce((s, [, k]) => s + k, 0);
  igual(fichas('vizinhos'), 9, 'vizinhos do zero'); igual(fichas('terco'), 6, 'terço');
  igual(fichas('orfaos'), 5, 'órfãos'); igual(fichas('jogozero'), 4, 'jogo zero');
  igual(numerosAnunciada('jogozero').length, 7, 'jogo zero cobre 7');
  for (let n = 0; n <= 36; n++) {
    const viz = vizinhosDe(n);
    igual(viz.length, 5, `vizinhos de ${n}`);
    igual(viz[2], n, `${n} no meio`);
    igual(new Set(viz).size, 5, `vizinhos de ${n} distintos`);
  }
  igual(vizinhosDe(0).join(), '3,26,0,32,15', 'vizinhos do zero na roda');
});

prova('toda aposta anunciada tem a mesma vantagem de 2,70%', () => {
  for (const nome of [...Object.keys(ANUNCIADAS), 'vizinhosde']) {
    const apostas = {};
    for (const [id, k] of apostasAnunciada(nome, 17)) apostas[id] = (apostas[id] ?? 0) + k * 100;
    const c = contaDaMesa(apostas);
    perto(c.vantagem, 1 / 37, 1e-12, nome);
  }
});

bloco('roleta: conta da mesa');

prova('a perda esperada de qualquer mesa é o total apostado dividido por 37', () => {
  const g = geradorRapido(21);
  for (let k = 0; k < 400; k++) {
    const apostas = {};
    const n = 1 + g.inteiro(12);
    for (let i = 0; i < n; i++) {
      const a = APOSTAS[g.inteiro(APOSTAS.length)];
      apostas[a.id] = (apostas[a.id] ?? 0) + 100 * (1 + g.inteiro(20));
    }
    const c = contaDaMesa(apostas);
    perto(c.perdaEsperada, c.total / 37, 1e-7, 'perda esperada');
    // variância pela força bruta das 37 casas
    let m1 = 0, m2 = 0;
    for (let x = 0; x <= 36; x++) { const r = resolver(apostas, x).retorno - c.total; m1 += r / 37; m2 += r * r / 37; }
    perto(c.variancia, m2 - m1 * m1, 1e-3, 'variância');
  }
});

bloco('roleta: física da bola');

let giros = [];
prova('para os 37 números, a bola simulada para exatamente na casa sorteada', () => {
  for (let n = 0; n <= 36; n++) for (let s = 1; s <= 8; s++) {
    const g = simularGiro(n, s * 104729 + n * 7);
    giros.push(g);
    igual(g.numeroDaCasa, n, `número ${n}, semente ${s}`);
    ok(g.parou, `a bola não parou no número ${n}`);
  }
});

prova('o ajuste é só a fase inicial do rotor, em casas inteiras', () => {
  for (const g of giros) {
    ok(Number.isInteger(g.casasDeAjuste) && g.casasDeAjuste >= 0 && g.casasDeAjuste < 37, 'ajuste fora de 0..36');
    perto(g.fase0, -g.casasDeAjuste * PASSO, 1e-12, 'fase inicial');
  }
  // mesma semente, números diferentes: a trajetória da bola é idêntica
  const a = simularGiro(0, 99), b = simularGiro(17, 99);
  igual(a.quadros.length, b.quadros.length, 'duração');
  for (let i = 0; i < a.quadros.length; i += 5) {
    igual(a.quadros[i + 1], b.quadros[i + 1], 'ângulo da bola');
    igual(a.quadros[i + 2], b.quadros[i + 2], 'raio da bola');
  }
});

prova('a bola fica entre o trilho e os bolsos, e o giro dura de 7 a 14 segundos', () => {
  for (const g of giros) {
    entre(g.duracao, 7, 14, 'duração');
    for (let i = 0; i < g.quadros.length; i += 5) {
      const rho = g.quadros[i + 2];
      ok(rho <= RAIO.trilho + 1e-9 && rho >= RAIO.bolso - 1e-9, `raio ${rho}`);
      ok(g.quadros[i + 3] >= 0, 'altura negativa');
    }
    const fim = amostra(g, g.duracao);
    ok(fim.fim, 'amostra final');
  }
  const comDefletor = giros.filter(g => g.eventos.some(e => e.tipo === 'defletor')).length;
  relatar(`  roleta    ${giros.length} giros simulados, todos no número sorteado; ${Math.round(100 * comDefletor / giros.length)}% batem num defletor`);
});

bloco('roleta: sessão');

function casaTeste(semente = 1) {
  return criarCasa({ armazem: armazemDescartavel(), fonte: fonteDeterministica(semente) });
}

prova('a ficha sai do saldo ao pousar e volta ao ser retirada', () => {
  const casa = casaTeste();
  const s = criarSessaoRoleta(casa);
  const s0 = casa.carteira.saldo;
  s.apostar('p17', 1000);
  s.apostar('vermelho', 500);
  igual(casa.carteira.saldo, s0 - 1500, 'débito');
  s.retirar('p17');
  igual(casa.carteira.saldo, s0 - 500, 'retirada');
  s.desfazer();
  igual(casa.carteira.saldo, s0, 'desfazer');
  lanca(() => s.apostar('p17', 150), 'aceitou ficha fracionária');
  lanca(() => s.apostar('p17', 60000), 'passou do limite do pleno');
  lanca(() => s.girar(), 'girou sem aposta');
});

prova('o giro paga o que o pano diz, registra no Livro e revela a semente', () => {
  const casa = casaTeste(2);
  const s = criarSessaoRoleta(casa);
  for (let k = 0; k < 60; k++) {
    s.apostar('p7', 100); s.apostar('c7-8', 200); s.apostar('preto', 500); s.apostarAnunciada('orfaos', 100);
    const antes = casa.carteira.saldo;
    const r = s.girar();
    const esperado = resolver(r.apostas, r.numero).retorno;
    igual(r.retorno, esperado, 'retorno');
    igual(casa.carteira.saldo, antes + esperado, 'crédito');
    const rev = casa.justo.revelados.at(-1);
    igual(rev.resultado.numero, r.numero, 'resultado revelado');
    ok(conferir(rev).confere, 'o Conferir não reproduziu');
    igual(criarGerador(rev.semente, rev.sementeJogador, rev.contador).inteiro(37), r.numero, 'gerador');
    perto(r.rodada.perdaEsperada, r.apostado / 37, 1e-9, 'perda esperada da rodada');
  }
  perto(casa.livro.resumo('roleta').perdaEsperada, casa.livro.resumo('roleta').apostado / 37, 1e-6, 'soma no Livro');
});

prova('a roleta não olha o saldo: mesmas sementes, saldos diferentes, mesmos números', () => {
  const rico = casaTeste(33), pobre = casaTeste(33);
  pobre.carteira.debitar(pobre.carteira.saldo - 300);
  rico.carteira.creditar(10000000);
  const a = criarSessaoRoleta(rico), b = criarSessaoRoleta(pobre);
  for (let k = 0; k < 200; k++) {
    a.apostar('p0', 100); b.apostar('p0', 100);
    const x = a.girar().numero, y = b.girar().numero;
    igual(x, y, `giro ${k}`);
    if (pobre.carteira.saldo < 100) pobre.pedirCredito();
  }
});

prova('os números da sessão são uniformes: qui-quadrado de 18.500 giros', () => {
  const casa = casaTeste(44);
  const s = criarSessaoRoleta(casa);
  const c = new Array(37).fill(0);
  for (let k = 0; k < 18500; k++) {
    s.apostar('vermelho', 100);
    c[s.girar().numero]++;
    if (casa.carteira.saldo < 100) casa.pedirCredito();
  }
  ok(quiQuadrado(c) < limiteQui(36), `qui-quadrado ${quiQuadrado(c).toFixed(1)}`);
});

prova('recarregar a página com fichas no pano devolve as mesmas apostas', () => {
  const armazem = armazemMemoria();
  const casa = criarCasa({ armazem });
  const s = criarSessaoRoleta(casa);
  s.apostar('d2', 2500); s.apostar('q25', 100);
  const outra = criarSessaoRoleta(criarCasa({ armazem }));
  igual(outra.apostas.d2, 2500, 'dúzia'); igual(outra.apostas.q25, 100, 'quadra');
  igual(outra.total(), 2600, 'total');
});
