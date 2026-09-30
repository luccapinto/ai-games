// A máquina de vídeo pôquer: gabinete déco, tela azul com a tabela 9/6, as
// cinco cartas, e o treinador que conhece as 32 jogadas de cada mão. A
// análise exata roda num Web Worker; a tela só libera a troca quando ela
// chegou, para o custo do erro sair do mesmo número que o treinador mostra.

import { criarSessaoVideoPoquer } from './sessao.js';
import { TABELA, CATEGORIAS, MOEDAS_VALIDAS, MAX_MOEDAS, REGRAS_TEXTO } from './regras.js';
import { RTP5, RTP1A4, VARIANCIA5 } from './constantes.js';
import { elementoCarta, definirFace, iconeNaipe } from '../../visual/cartas.js';
import { respirar, faiscas } from '../../visual/efeitos.js';
import { ICONES, avisar } from '../../ui.js';
import { fichas, fichasFrac, pct, numero } from '../../nucleo/formato.js';
import { INDICES, valorDe, naipeDe } from '../../nucleo/baralho.js';
import * as som from '../../som.js';

export function placa() {
  return [
    { rotulo: 'jogo perfeito', valor: pct(RTP5) },
    { rotulo: 'vantagem', valor: pct(1 - RTP5) },
  ];
}

const ORDEM = CATEGORIAS.filter(c => c !== 'nada');

// Uma máquina por página: o trabalhador sobrevive às trocas de mesa.
let trabalhador = null, pronto = null, proximoId = 1;
const pendentes = new Map();
function obterTrabalhador() {
  if (trabalhador) return pronto;
  pronto = new Promise((resolve, reject) => {
    try {
      trabalhador = new Worker(new URL('./trabalhador.js', import.meta.url), { type: 'module' });
    } catch (e) { reject(e); return; }
    trabalhador.onmessage = ev => {
      const d = ev.data;
      if (d.tipo === 'pronto') { resolve(d.ms); return; }
      const p = pendentes.get(d.id);
      if (!p) return;
      pendentes.delete(d.id);
      if (d.erro) p.reject(new Error(d.erro)); else p.resolve(d);
    };
    trabalhador.onerror = e => reject(e);
  });
  return pronto;
}
function pedir(msg) {
  return obterTrabalhador().then(() => new Promise((resolve, reject) => {
    const id = proximoId++;
    pendentes.set(id, { resolve, reject });
    trabalhador.postMessage({ id, ...msg });
  }));
}

// Nome curto com o naipe desenhado (nada de caractere de naipe no texto).
function nomeCurto(c) {
  return `<span class="nc">${INDICES[valorDe(c)]}${iconeNaipe(naipeDe(c), 11)}</span>`;
}

export function montar(raiz, app) {
  const { casa } = app;
  const cache = new Map();
  const chave = (mao, moedas) => `${mao.join(',')}|${moedas === MAX_MOEDAS ? 5 : 1}`;
  const s = criarSessaoVideoPoquer(casa, {
    analisar(mao, moedas) {
      const r = cache.get(chave(mao, moedas));
      if (!r) throw new Error('A máquina ainda está calculando as 32 jogadas desta mão.');
      return r;
    },
  });
  let ocupado = false, vivo = true, analisando = false;
  let cartasEl = [];

  raiz.innerHTML = `
    <div class="feltro azul"></div><div class="abajur"></div>
    <div class="mesa-grade videopoquer">
      <div class="palco vp-palco">
        <div class="gabinete">
          <div class="letreiro"><span>JACKS OR BETTER</span><em>9/6</em></div>
          <div class="tela">
            <table class="vp-tabela"></table>
            <div class="vp-mensagem"></div>
            <div class="vp-cartas"></div>
            <div class="vp-painel">
              <div><span>créditos</span><b class="vp-creditos"></b></div>
              <div><span>aposta</span><b class="vp-aposta"></b></div>
              <div><span>ganho</span><b class="vp-ganho">0</b></div>
            </div>
          </div>
          <div class="vp-botoes">
            <div class="vp-seg"></div>
            <div class="vp-linha">
              <div class="vp-moeda"><span>moeda</span>${MOEDAS_VALIDAS.map(v => `<button data-moeda="${v}">${fichas(v)}</button>`).join('')}</div>
              <button class="btn escuro" data-a="uma">Aposta 1</button>
              <button class="btn vinho" data-a="max">Aposta máxima</button>
              <button class="btn grande vp-dar" data-a="dar">Dar cartas</button>
            </div>
          </div>
        </div>
        <div class="treinador vp-treinador" hidden></div>
      </div>
      <aside class="conta"></aside>
    </div>
    <button class="aba-conta">${ICONES.conta}<span>a conta</span></button>`;

  const $ = sel => raiz.querySelector(sel);
  const conta = $('.conta');

  // ---------------------------------------------------------------- tabela

  function pintarTabela(destaque = null) {
    const moedas = s.moedas;
    $('.vp-tabela').innerHTML = ORDEM.map(cat => {
      const t = TABELA[cat];
      return `<tr class="${cat === destaque ? 'saiu' : ''}"><th>${t.nome}</th>${[1, 2, 3, 4, 5].map(k => {
        const v = k === MAX_MOEDAS ? t.cincoMoedas * k : t.porMoeda * k;
        return `<td class="${k === moedas ? 'ativa' : ''}">${numero(v)}</td>`;
      }).join('')}</tr>`;
    }).join('');
  }

  // cada escrita no medidor de ganho cancela a contagem que ainda estiver subindo
  let contagem = 0;
  function pintarPainel(ganho = null) {
    $('.vp-creditos').textContent = fichas(casa.carteira.saldo);
    $('.vp-aposta').textContent = `${s.moedas} × ${fichas(s.moeda)}`;
    if (ganho !== null) { contagem++; $('.vp-ganho').textContent = fichas(ganho); }
    for (const b of raiz.querySelectorAll('[data-moeda]')) b.classList.toggle('ativa', Number(b.dataset.moeda) === s.moeda);
  }

  // ---------------------------------------------------------------- cartas

  function montarCartas() {
    const alvo = $('.vp-cartas');
    alvo.innerHTML = '';
    cartasEl = [];
    const seg = $('.vp-seg');
    seg.innerHTML = '';
    for (let i = 0; i < 5; i++) {
      const lugar = document.createElement('button');
      lugar.className = 'vp-lugar';
      lugar.dataset.i = i;
      const c = s.mao[i];
      const el = elementoCarta(c ?? 0, { virada: c === undefined });
      lugar.append(el);
      lugar.insertAdjacentHTML('beforeend', '<span class="segura">SEGURA</span><span class="otima">ótima</span>');
      alvo.append(lugar);
      cartasEl.push(el);
      seg.insertAdjacentHTML('beforeend', `<button class="btn escuro vp-segurar" data-i="${i}">Segurar</button>`);
    }
    marcarSegurar();
  }

  function marcarSegurar() {
    raiz.querySelectorAll('.vp-lugar').forEach((l, i) => l.classList.toggle('segurada', !!s.segurar[i] && s.estado === 'descarte'));
    raiz.querySelectorAll('.vp-segurar').forEach((b, i) => { b.classList.toggle('ativo', !!s.segurar[i] && s.estado === 'descarte'); b.disabled = s.estado !== 'descarte' || ocupado; });
  }

  const espera = ms => new Promise(r => setTimeout(r, ms));

  async function virarPara(i, c) {
    const el = cartasEl[i];
    el.classList.add('virada');
    await espera(230);
    definirFace(el, c);
    el.classList.remove('virada');
    el.classList.add('reluz');
    som.carta(0.7);
    await espera(90);
  }

  // ---------------------------------------------------------------- treinador

  function descricaoMascara(mask) {
    const cs = s.mao.filter((_, i) => mask & (1 << i));
    return cs.length ? cs.map(nomeCurto).join(' ') : 'trocar as cinco';
  }

  function pintarTreinador() {
    const t = $('.vp-treinador');
    raiz.querySelectorAll('.vp-lugar').forEach(l => l.classList.remove('otimo'));
    if (!casa.prefs.treinador || s.estado !== 'descarte') { t.hidden = true; return; }
    let c;
    try { c = s.conselho(); } catch { t.hidden = false; t.innerHTML = '<span>Treinador</span><b>calculando…</b><em>as 32 jogadas desta mão</em>'; return; }
    raiz.querySelectorAll('.vp-lugar').forEach((l, i) => l.classList.toggle('otimo', !!(c.melhor & (1 << i))));
    const top = Array.from(c.evs, (ev, mask) => ({ ev, mask })).sort((a, b) => b.ev - a.ev).slice(0, 4);
    const k = s.moedas * s.moeda / 100;
    t.hidden = false;
    t.innerHTML = `<span>Jogada ótima</span><b>${descricaoMascara(c.melhor)}</b>
      <em>${top.map(x => `${descricaoMascara(x.mask)}: ${numero(x.ev * k, 2)}`).join(' · ')}</em>
      <em class="sua">sua escolha agora: ${numero(c.evEscolha * k, 2)} ${c.custo > 0.5 ? `· custa ${fichasFrac(c.custo, 2)} de valor esperado` : '· é a melhor'}</em>`;
  }

  async function analisar() {
    if (s.estado !== 'descarte') return;
    const k = chave(s.mao, s.moedas);
    if (cache.has(k)) { pintarTreinador(); return; }
    analisando = true;
    pintarBotoes();
    try {
      const r = await pedir({ tipo: 'analisar', mao: s.mao.slice(), moedas: s.moedas });
      cache.set(k, { evs: r.evs, melhor: r.melhor });
    } catch (e) {
      // sem trabalhador: calcula na própria página
      const { construirTabelas, analisar: an } = await import('./analise.js');
      obterTrabalhador.tabelas ??= construirTabelas();
      cache.set(k, an(s.mao, obterTrabalhador.tabelas, s.moedas));
    }
    analisando = false;
    if (!vivo) return;
    pintarTreinador();
    pintarBotoes();
  }

  // ---------------------------------------------------------------- botões

  function pintarBotoes() {
    const d = $('.vp-dar');
    const emJogo = s.estado === 'descarte';
    d.textContent = emJogo ? (analisando ? 'Calculando…' : 'Trocar') : 'Dar cartas';
    d.disabled = ocupado || (emJogo && analisando);
    raiz.querySelectorAll('[data-moeda], [data-a="uma"], [data-a="max"]').forEach(b => { b.disabled = ocupado || emJogo; });
    marcarSegurar();
  }

  // no próprio gabinete, não em raiz: raiz é o #mesa, que sobrevive à troca de mesa
  $('.mesa-grade').addEventListener('click', e => {
    if (!vivo) return;
    const lugar = e.target.closest('.vp-lugar, .vp-segurar');
    if (lugar && s.estado === 'descarte' && !ocupado) {
      s.alternar(Number(lugar.dataset.i));
      som.clique();
      marcarSegurar();
      pintarTreinador();
      return;
    }
    const m = e.target.closest('[data-moeda]');
    if (m && !m.disabled) {
      try { s.definirMoeda(Number(m.dataset.moeda)); som.ficha(1, 0.6); pintarPainel(); pintarTabela(); pintarConta(); } catch (err) { avisar(err.message, { erro: true }); }
      return;
    }
    const b = e.target.closest('[data-a]');
    if (!b || b.disabled) return;
    if (b.dataset.a === 'uma') { s.definirMoedas(s.moedas % MAX_MOEDAS + 1); som.ficha(1, 0.6); pintarPainel(); pintarTabela(); pintarConta(); }
    if (b.dataset.a === 'max') { s.definirMoedas(MAX_MOEDAS); som.ficha(3, 0.6); pintarPainel(); pintarTabela(); pintarConta(); jogar(); }
    if (b.dataset.a === 'dar') jogar();
  });

  function tecla(e) {
    if (!vivo || document.querySelector('.cortina')) return;
    if (e.key >= '1' && e.key <= '5' && s.estado === 'descarte' && !ocupado) { s.alternar(Number(e.key) - 1); som.clique(); marcarSegurar(); pintarTreinador(); }
    else if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); jogar(); }
  }
  addEventListener('keydown', tecla);

  async function jogar() {
    if (ocupado) return;
    if (s.estado === 'descarte') return trocar();
    if (!casa.carteira.pode(s.moeda * s.moedas)) {
      if (!app.oferecerCredito(s.moeda * s.moedas)) avisar('Saldo insuficiente para essa aposta.', { erro: true });
      return;
    }
    ocupado = true;
    pintarBotoes();
    let r;
    try { r = s.dar(); } catch (err) { ocupado = false; pintarBotoes(); avisar(err.message, { erro: true }); return; }
    app.atualizarSaldo();
    som.ficha(Math.min(5, s.moedas), 0.8);
    pintarPainel(0); pintarTabela(); mensagem('');
    analisar();
    for (const el of cartasEl) el.classList.add('virada');
    await espera(260);
    for (const e of r.eventos) await virarPara(e.posicao, e.carta);
    ocupado = false;
    pintarBotoes();
    pintarTreinador();
    mensagem('Escolha as cartas que quer segurar.');
  }

  async function trocar() {
    if (analisando) return;
    const antes = casa.prefs.treinador ? s.conselho() : null;
    app.congelarSaldo();
    let r;
    try { r = s.trocar(); } catch (err) { app.liberarSaldo(); avisar(err.message, { erro: true }); return; }
    ocupado = true;
    pintarBotoes();
    $('.vp-treinador').hidden = true;
    raiz.querySelectorAll('.vp-lugar').forEach(l => l.classList.remove('otimo'));
    const trocas = r.eventos.filter(e => e.tipo === 'trocar');
    for (const e of trocas) cartasEl[e.posicao].classList.add('virada');
    await espera(300);
    for (const e of trocas) await virarPara(e.posicao, e.carta);
    const res = r.eventos.find(e => e.tipo === 'resultado');
    pintarTabela(res.pago > 0 ? res.categoria : null);
    if (res.pago > 0) {
      const mult = res.pago / (s.moeda * s.moedas);
      const nivel = res.categoria === 'royal' ? 5 : mult >= 25 ? 4 : mult >= 6 ? 3 : mult >= 2 ? 2 : 1;
      som.vitoria(nivel);
      if (nivel >= 3) { respirar($('.gabinete'), nivel); faiscas($('.tela'), 40 * nivel); }
      contarGanho(res.pago);
      mensagem(`${TABELA[res.categoria].nome}: ${fichas(res.pago)} fichas.`);
    } else {
      mensagem(TABELA[res.categoria].nome === 'Nada' ? 'Nada pago.' : `${TABELA[res.categoria].nome}: não paga.`);
      som.derrota();
    }
    if (antes && antes.custo > 0.5) avisar(`Esta escolha valia ${numero(antes.evEscolha * s.moedas * s.moeda / 100, 2)} fichas em média; a ótima valia ${numero(antes.evMelhor * s.moedas * s.moeda / 100, 2)}. O erro custou ${fichasFrac(antes.custo, 2)}.`, { ms: 5200 });
    await espera(500);
    app.liberarSaldo();
    ocupado = false;
    pintarBotoes(); pintarPainel(); pintarConta();
    if (casa.carteira.saldo < s.moeda * s.moedas && casa.carteira.saldo < 25) app.oferecerCredito(25);
  }

  function contarGanho(v) {
    const el = $('.vp-ganho');
    const minha = ++contagem;
    const ini = performance.now(), dur = Math.min(1600, 300 + v / 100 * 20);
    function passo() {
      if (!vivo || minha !== contagem) return;
      const p = Math.min(1, (performance.now() - ini) / dur);
      el.textContent = fichas(Math.round(v * p / 25) * 25);
      if (p < 1) { requestAnimationFrame(passo); if (Math.random() < 0.3) som.clique(); } else el.textContent = fichas(v);
    }
    requestAnimationFrame(passo);
  }

  function mensagem(t) { $('.vp-mensagem').textContent = t; }

  // ---------------------------------------------------------------- conta

  function pintarConta() {
    const r = casa.livro.resumo('videopoquer');
    const cinco = s.moedas === MAX_MOEDAS;
    conta.innerHTML = `
      <div class="bloco">
        <h4>A conta desta máquina</h4>
        <div class="grande-numero">${pct(cinco ? RTP5 : RTP1A4)}</div>
        <p class="explica">de retorno ${cinco ? 'com as cinco moedas' : `com ${s.moedas} moeda${s.moedas > 1 ? 's' : ''}`}, jogando a melhor das 32 retenções em toda mão. Calculado pela enumeração exata das 2.598.960 mãos iniciais. A casa fica com ${pct(1 - (cinco ? RTP5 : RTP1A4))}.</p>
        ${cinco ? '' : `<p class="explica aviso">Com menos de cinco moedas o royal paga 250 por moeda em vez de 800, e o retorno cai para ${pct(RTP1A4)}. É a única aposta da máquina que te pede para apostar mais.</p>`}
        <button class="btn fantasma recalcular">Recalcular agora</button>
        <p class="explica recalculo"></p>
      </div>
      <div class="bloco">
        <h4>Esta mão</h4>
        <table>
          <tr><td>Aposta</td><td>${fichas(s.moeda * s.moedas)}</td></tr>
          <tr><td>Perda esperada jogando perfeito</td><td class="casa">−${fichasFrac(s.moeda * s.moedas * (1 - (cinco ? RTP5 : RTP1A4)), 3)}</td></tr>
          <tr><td>Desvio-padrão da mão</td><td>${fichasFrac(s.moeda * s.moedas * Math.sqrt(VARIANCIA5), 2)}</td></tr>
          <tr><td>Seus erros até agora</td><td class="casa">${r.custoErros > 0 ? '−' + fichasFrac(r.custoErros, 2) : '0'}</td></tr>
        </table>
      </div>
      <div class="bloco">
        <h4>Regras da máquina</h4>
        <ul class="regras">${REGRAS_TEXTO.map(t => `<li>${t}</li>`).join('')}</ul>
      </div>
      <div class="bloco">
        <h4>Últimas mãos</h4>
        <div class="historico vp-hist">${s.historico.slice(0, 12).map(h => `<span class="${h.retorno > h.aposta ? 'bom' : h.retorno === h.aposta ? '' : 'ruim'}" title="${h.rotulo}">${TABELA[h.categoria].nome === 'Nada' ? '–' : TABELA[h.categoria].nome}</span>`).join('') || '<em>nenhuma ainda</em>'}</div>
      </div>
      <div class="bloco">
        <h4>Próxima mão</h4>
        <div class="compromisso"><b>HASH PUBLICADO · CONTADOR ${s.compromisso().contador}</b>${s.compromisso().hash}</div>
      </div>`;
    conta.querySelector('.compromisso').onclick = () => app.abrirConferir('videopoquer');
    conta.querySelector('.recalcular').onclick = async ev => {
      const b = ev.currentTarget;
      b.disabled = true;
      const saida = conta.querySelector('.recalculo');
      saida.textContent = 'Enumerando as 2.598.960 mãos iniciais e as 32 retenções de cada uma…';
      const t0 = performance.now();
      try {
        const res = await pedir({ tipo: 'rtp', moedas: s.moedas });
        saida.innerHTML = `Recalculado agora, neste navegador: <b>${pct(res.rtp, 4)}</b> em ${numero((performance.now() - t0) / 1000, 1)} s. Variância por moeda: ${numero(res.variancia, 3)}.`;
      } catch (e) { saida.textContent = `Não consegui recalcular aqui: ${e.message}`; }
      b.disabled = false;
    };
  }

  $('.aba-conta').addEventListener('click', () => conta.classList.toggle('aberta'));

  // ---------------------------------------------------------------- início

  obterTrabalhador().catch(() => {});
  montarCartas();
  pintarTabela(s.estado === 'fim' ? s.categoria : null);
  pintarPainel(s.estado === 'fim' ? s.pago : 0);
  pintarBotoes();
  pintarConta();
  if (s.estado === 'descarte') { analisar(); mensagem('Escolha as cartas que quer segurar.'); }
  else if (s.estado === 'aposta') mensagem('Aposte e dê as cartas.');

  const api = {
    sessao: s,
    desmontar() { vivo = false; removeEventListener('keydown', tecla); },
    get ocupado() { return ocupado || analisando; },
    jogar,
  };
  app.mesaAtual = api;
  return api;
}
