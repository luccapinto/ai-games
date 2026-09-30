// Sair da mesa no meio da rodada.
//
// A tela pode morrer a qualquer instante; o dinheiro não pode depender dela.
// Três partes, provadas aqui sem navegador: a vida de uma montagem
// (js/vida.js) corta tudo o que a mesa agendou; nenhuma mesa agenda nada por
// fora da vida nem mexe em dinheiro; e cada sessão já liquidou a rodada, saldo
// e Livro, quando a chamada do sorteio volta, antes de qualquer animação.
// A prova no navegador (ferramentas/prova_sair_no_meio.mjs) junta as três:
// sai de verdade, no meio, e compara com quem esperou.

import { readFileSync } from 'node:fs';
import { bloco, prova, ok, igual, fonteDeterministica } from './base.mjs';
import { criarVida } from '../js/vida.js';
import { criarCasa, armazemDescartavel } from '../js/nucleo/casa.js';
import { SALDO_INICIAL } from '../js/nucleo/carteira.js';
import { criarSessaoRoleta } from '../js/jogos/roleta/sessao.js';
import { criarSessaoBlackjack } from '../js/jogos/blackjack/sessao.js';
import { criarSessaoVideoPoquer } from '../js/jogos/videopoquer/sessao.js';
import { criarSessaoBacara } from '../js/jogos/bacara/sessao.js';
import { criarSessaoCraps } from '../js/jogos/craps/sessao.js';
import { criarSessaoNiquel } from '../js/jogos/niquel/sessao.js';

const MESAS = ['roleta', 'blackjack', 'niquel', 'videopoquer', 'bacara', 'craps'];
const dormir = ms => new Promise(r => setTimeout(r, ms));

// o Node não tem quadro de animação nem ResizeObserver: um relógio de 16 ms e um observador de mentira
globalThis.requestAnimationFrame ??= fn => setTimeout(() => fn(performance.now()), 16);
globalThis.cancelAnimationFrame ??= id => clearTimeout(id);
const observadores = [];
globalThis.ResizeObserver ??= class {
  constructor(fn) { this.fn = fn; this.ligado = false; observadores.push(this); }
  observe() { this.ligado = true; }
  disconnect() { this.ligado = false; }
};

bloco('sair no meio: a vida da mesa');

await prova('viva, a vida entrega tudo o que foi agendado', async () => {
  const v = criarVida();
  const rodou = [];
  v.depois(5, () => rodou.push('depois'));
  v.quadro(() => rodou.push('quadro'));
  (async () => { await v.espera(5); rodou.push('espera'); })();
  (async () => { rodou.push(`seguir ${await v.seguir(Promise.resolve(7))}`); })();
  const alvo = new EventTarget();
  v.ouvir(alvo, 'x', () => rodou.push('ouvir'));
  alvo.dispatchEvent(new Event('x'));
  await dormir(60);
  igual(rodou.sort().join(), 'depois,espera,ouvir,quadro,seguir 7', 'o que rodou');
});

await prova('morta a vida, nada do que ela agendou roda depois: nem timer, nem quadro, nem o resto de um async, nem o finally dele', async () => {
  const v = criarVida();
  const rodou = [];
  v.depois(5, () => rodou.push('depois'));
  v.quadro(() => rodou.push('quadro'));
  (async () => { try { await v.espera(5); rodou.push('espera'); } finally { rodou.push('finally'); } })();
  let terminarAnimacao;
  const animacao = new Promise(r => { terminarAnimacao = r; });
  (async () => { await v.seguir(animacao); rodou.push('seguir'); })();
  (async () => { try { await v.seguir(Promise.reject(new Error('x'))); } catch { rodou.push('rejeição'); } })();
  const alvo = new EventTarget();
  v.ouvir(alvo, 'x', () => rodou.push('ouvir'));
  v.matar();
  terminarAnimacao();
  alvo.dispatchEvent(new Event('x'));
  v.depois(1, () => rodou.push('depois da morte'));
  v.quadro(() => rodou.push('quadro da morte'));
  await dormir(60);
  igual(rodou.join(), '', 'rodou depois da morte');
  ok(!v.viva && v.sinal.aborted, 'a vida não morreu');
});

prova('o saldo congelado solta uma vez só, e a morte solta o que a mesa deixou preso', () => {
  let presos = 0;
  const v = criarVida({ congelarSaldo: () => { presos++; let solto = false; return () => { if (!solto) { solto = true; presos--; } }; } });
  const a = v.congelar(), b = v.congelar();
  igual(presos, 2, 'dois congelamentos');
  a(); a();
  igual(presos, 1, 'soltar duas vezes solta uma');
  v.matar();
  igual(presos, 0, 'a morte soltou o que sobrou');
  b();
  igual(presos, 0, 'soltar depois da morte não solta de novo');
  v.congelar()();
  igual(presos, 0, 'congelar depois da morte não congela');
});

prova('a morte desconecta o observador de tamanho e roda cada limpeza uma vez, mesmo se uma delas falhar', () => {
  const v = criarVida();
  const n0 = observadores.length;
  v.redimensionar({}, () => {});
  const ro = observadores[n0];
  ok(ro && ro.ligado, 'o observador não ligou');
  const feitas = [];
  const erroOriginal = console.error;
  console.error = () => {};
  try {
    v.aoMorrer(() => feitas.push('som'));
    v.aoMorrer(() => { throw new Error('limpeza que falha'); });
    v.aoMorrer(() => feitas.push('roda'));
    v.matar();
    v.matar();
  } finally { console.error = erroOriginal; }
  ok(!ro.ligado, 'o observador continuou ligado');
  igual(feitas.join(), 'som,roda', 'limpezas');
});

bloco('sair no meio: as mesas');

// Tira comentários para a varredura não confundir texto com código.
const semComentarios = t => t.replace(/\/\*[\s\S]*?\*\//g, m => m.replace(/[^\n]/g, '')).replace(/(^|[^:'"`\\])\/\/.*$/gm, '$1');
const linhaDe = (t, i) => t.slice(0, i).split('\n').length;

for (const mesa of MESAS) {
  prova(`${mesa}: tudo o que a mesa agenda passa pela vida, e todo await dela para quando o jogador sai`, () => {
    const t = semComentarios(readFileSync(new URL(`../js/jogos/${mesa}/mesa.js`, import.meta.url), 'utf8'));
    ok(/export function montar\(raiz, app, vida\)/.test(t), 'montar não recebe a vida');
    const proibidos = [
      [/\bsetTimeout\s*\(/g, 'setTimeout (use vida.depois)'],
      [/\bsetInterval\s*\(/g, 'setInterval'],
      [/\brequestAnimationFrame\s*\(/g, 'requestAnimationFrame (use vida.quadro)'],
      [/\bcancelAnimationFrame\s*\(/g, 'cancelAnimationFrame'],
      [/\bnew ResizeObserver\b/g, 'ResizeObserver (use vida.redimensionar)'],
      [/(^|[^.\w$])addEventListener\s*\(/gm, 'ouvinte na janela (use vida.ouvir)'],
      [/\b(window|document|globalThis|self)\s*\.\s*addEventListener\s*\(/g, 'ouvinte global (use vida.ouvir)'],
      [/\bapp\s*\.\s*(congelarSaldo|liberarSaldo)\b/g, 'congelamento por fora (use vida.congelar)'],
    ];
    for (const [re, nome] of proibidos) for (const m of t.matchAll(re)) throw new Error(`linha ${linhaDe(t, m.index)}: ${nome}`);
    const esperaLocal = t.match(/const espera = [^;\n]*/);
    if (esperaLocal) ok(/vida\.espera\(/.test(esperaLocal[0]), `a espera local não é a da vida: ${esperaLocal[0]}`);
    // Dentro de montar, um await pode esperar a vida (espera, vida.seguir) ou
    // uma função async desta mesma mesa, cujos awaits seguem a mesma regra.
    // O que fica antes de montar é do módulo (o trabalhador do vídeo pôquer,
    // por exemplo) e não pertence a nenhuma montagem.
    const inicio = t.indexOf('export function montar(');
    const corpo = t.slice(inicio);
    const linhaNoArquivo = i => linhaDe(t, inicio + i);
    const assincronas = new Set([...corpo.matchAll(/async function (\w+)/g)].map(m => m[1]));
    const permitido = nome => nome === 'espera' || assincronas.has(nome);
    let awaits = 0;
    for (const m of corpo.matchAll(/\bawait\s+/g)) {
      awaits++;
      const resto = corpo.slice(m.index + m[0].length);
      if (/^vida\.(espera|seguir)\s*\(/.test(resto)) continue;
      const chamada = resto.match(/^(\w+)\s*\(/);
      if (chamada && permitido(chamada[1])) continue;
      throw new Error(`linha ${linhaNoArquivo(m.index)}: await fora da vida: await ${resto.slice(0, 50).split('\n')[0]}`);
    }
    for (const m of corpo.matchAll(/\.then\s*\(/g)) {
      const antes = corpo.slice(corpo.lastIndexOf('\n', m.index) + 1, m.index);
      if (/vida\.seguir\(/.test(antes)) continue;
      const chamada = antes.match(/\b(\w+)\s*\([^()]*\)\s*$/);
      if (chamada && permitido(chamada[1])) continue;
      throw new Error(`linha ${linhaNoArquivo(m.index)}: .then fora da vida: ${antes.trim().slice(-60)}.then(`);
    }
    ok(awaits > 0, 'nenhum await: a varredura não achou a mesa');
  });
}

prova('nenhuma mesa mexe em dinheiro: débito, crédito, Livro e sorteio moram só nas sessões', () => {
  for (const mesa of MESAS) {
    const t = semComentarios(readFileSync(new URL(`../js/jogos/${mesa}/mesa.js`, import.meta.url), 'utf8'));
    const m = t.match(/carteira\s*\.\s*(debitar|creditar|quitar|pedir)\w*\s*\(|\bfecharRodada\s*\(|justo\s*\.\s*(abrir|revelar)\s*\(/);
    ok(!m, `${mesa}/mesa.js, linha ${m && linhaDe(t, m.index)}: ${m && m[0]}`);
  }
});

bloco('sair no meio: liquida no sorteio');

// Casa nova, a rodada jogada só pela sessão, nenhuma tela: quando a chamada
// que sorteia volta, o Livro já tem a rodada e o saldo já fecha com ele.
function casaNova(semente) {
  return criarCasa({ armazem: armazemDescartavel(), fonte: fonteDeterministica(semente) });
}
function fecha(casa, jogo, rodadas, naMesa = 0) {
  const r = casa.livro.resumo(jogo);
  igual(r.n, rodadas, `${jogo}: rodadas no Livro`);
  igual(casa.carteira.saldo + naMesa, SALDO_INICIAL + casa.livro.resumo().real, `${jogo}: saldo contra o Livro`);
}

prova('roleta: o giro volta pago e no Livro antes de a bola sair da mão do crupiê', () => {
  const casa = casaNova(31);
  const s = criarSessaoRoleta(casa);
  s.apostar('vermelho', 500); s.apostar('p17', 100);
  const r = s.girar();
  fecha(casa, 'roleta', 1);
  igual(casa.justo.revelados.at(-1).resultado.numero, r.numero, 'o sorteio já foi revelado');
});

prova('blackjack: parar resolve a mão, a banca joga e paga dentro da mesma chamada', () => {
  const casa = casaNova(32);
  const s = criarSessaoBlackjack(casa);
  for (let k = 1; k <= 20; k++) {
    if (s.estado === 'fim') s.novaRodada();
    s.definirAposta(500);
    s.dar();
    if (s.estado === 'seguro') s.seguro(false);
    while (s.estado === 'jogando') s.agir('parar');
    igual(s.estado, 'fim', 'a mão não terminou');
    fecha(casa, 'blackjack', k);
  }
});

prova('vídeo pôquer: dar só separa a aposta; a troca paga e registra na mesma chamada', () => {
  const casa = casaNova(33);
  const s = criarSessaoVideoPoquer(casa, { analisar: () => ({ evs: new Float64Array(32), melhor: 0 }) });
  s.dar();
  const aposta = SALDO_INICIAL - casa.carteira.saldo;
  ok(aposta > 0, 'dar não separou a aposta');
  fecha(casa, 'videopoquer', 0, aposta);
  s.trocar();
  fecha(casa, 'videopoquer', 1);
});

prova('bacará: o coup inteiro, terceira carta e comissão, está pago quando dar volta', () => {
  const casa = casaNova(34);
  const s = criarSessaoBacara(casa);
  for (let k = 1; k <= 20; k++) {
    if (s.estado === 'fim') s.novaRodada();
    s.apostar('banca', 500); s.apostar('parJogador', 500);
    s.dar();
    fecha(casa, 'bacara', k);
  }
});

prova('craps: cada lance resolve o pano na hora; o que fica no pano é só aposta viva', () => {
  const casa = casaNova(35);
  const s = criarSessaoCraps(casa);
  for (let k = 0; k < 40; k++) {
    if (!s.apostas.pass && s.ponto == null) s.apostar('pass', 500);
    if (!s.apostas.field) s.apostar('field', 500);
    s.lancar();
    fecha(casa, 'craps', casa.livro.resumo('craps').n, s.total());
  }
  ok(casa.livro.resumo('craps').n > 10, 'poucas rodadas decididas');
});

prova('caça-níquel: o giro volta pago; giros grátis ficam guardados na sessão até alguém girá-los', () => {
  const casa = casaNova(36);
  const s = criarSessaoNiquel(casa);
  let n = 0;
  for (let k = 0; k < 5000 && !s.emGirosGratis; k++) { s.girar(); fecha(casa, 'niquel', ++n); }
  ok(s.emGirosGratis, 'nenhum bônus em 5.000 giros');
  const guardados = s.girosRestantes, saldo = casa.carteira.saldo;
  ok(guardados > 0, 'giros grátis');
  // a sessão não gira sozinha: sem ninguém chamar, nada muda
  igual(casa.carteira.saldo, saldo, 'o saldo mudou sem giro');
  igual(s.girosRestantes, guardados, 'os giros grátis sumiram');
  while (s.emGirosGratis) { s.girar(); fecha(casa, 'niquel', ++n); }
});
