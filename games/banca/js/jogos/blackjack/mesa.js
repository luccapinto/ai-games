// A mesa de blackjack: feltro em meia-lua com as regras impressas em arco,
// sapato e descarte, cartas que saem do sapato e viram em 3D, fichas que vão
// e voltam do rack da banca, e o treinador de estratégia básica.

import { criarSessaoBlackjack } from './sessao.js';
import { REGRAS, REGRAS_TEXTO, valorMao, valorCarta } from './regras.js';
import { QUADRO, COLUNAS, colunaBanca, codigoBasico } from './estrategia.js';
import { VANTAGEM_BLACKJACK, VANTAGEM_SEGURO } from './vantagem.js';
import { criarPalcoCartas } from '../../visual/cena-cartas.js';
import { DENOMINACOES, svgFicha, htmlPilha } from '../../visual/fichas.js';
import { voarFichas, respirar, faiscas, aproximar } from '../../visual/efeitos.js';
import { ICONES, avisar, mostrarDica, esconderDica, htmlConta, ligarDica } from '../../ui.js';
import { fichas, fichasFrac, pct, numero } from '../../nucleo/formato.js';
import * as som from '../../som.js';

export function placa() {
  return [
    { rotulo: 'com a básica', valor: pct(VANTAGEM_BLACKJACK.vantagem) },
    { rotulo: 'blackjack', valor: '3 para 2' },
  ];
}

const NOMES_ACAO = { pedir: 'Pedir', parar: 'Parar', dobrar: 'Dobrar', dividir: 'Dividir', desistir: 'Desistir' };
const TECLAS = { pedir: '1', parar: '2', dobrar: '3', dividir: '4', desistir: '5' };
const RESULTADO = {
  ganhou: ['Ganhou', 'bom'], blackjack: ['Blackjack', 'bom'], empatou: ['Empate', 'neutro'],
  perdeu: ['Perdeu', 'ruim'], estourou: ['Estourou', 'ruim'], desistiu: ['Desistiu', 'neutro'],
};

function textoTotal(cartas, dividida = false) {
  const t = valorMao(cartas, dividida);
  if (t.blackjack) return 'BJ';
  if (t.estourou) return String(t.total);
  if (t.macio && t.total < 21) return `${t.total - 10}/${t.total}`;
  return String(t.total);
}

export function montar(raiz, app, vida) {
  const { casa } = app;
  const s = criarSessaoBlackjack(casa);
  let ficha = casa.mesa('blackjack').ficha ?? 500;
  let apostaMontada = s.estado === 'aposta' || s.estado === 'fim' ? s.aposta : 0;
  let ocupado = false;
  // o saldo do topo fica congelado da chamada à sessão até as fichas pousarem
  let soltarSaldo = null;
  const congelar = () => { soltarSaldo ??= vida.congelar(); };
  const soltar = () => { soltarSaldo?.(); soltarSaldo = null; };
  const ui = { maos: [], banca: [], rotulos: [] };

  raiz.innerHTML = `
    <div class="feltro"></div><div class="abajur"></div>
    <div class="mesa-grade blackjack">
      <div class="palco bj-palco">
        <svg class="bj-impresso" viewBox="0 0 1000 620" preserveAspectRatio="xMidYMid meet" aria-hidden="true">
          <defs>
            <path id="bj-arco1" d="M 150 250 A 420 360 0 0 0 850 250"/>
            <path id="bj-arco2" d="M 210 250 A 360 300 0 0 0 790 250"/>
            <path id="bj-arco3" d="M 110 250 A 470 410 0 0 0 890 250"/>
          </defs>
          <path d="M 70 250 A 510 450 0 0 0 930 250" class="linha-arco"/>
          <path d="M 250 250 A 320 260 0 0 0 750 250" class="linha-arco fina"/>
          <text class="arco-grande"><textPath href="#bj-arco1" startOffset="50%" text-anchor="middle">BLACKJACK PAGA 3 PARA 2</textPath></text>
          <text class="arco-pequeno"><textPath href="#bj-arco2" startOffset="50%" text-anchor="middle">A BANCA PARA EM TODO 17 · SEGURO PAGA 2 PARA 1</textPath></text>
          <text class="arco-seguro"><textPath href="#bj-arco3" startOffset="50%" text-anchor="middle">SEIS BARALHOS · DOBRA DEPOIS DE DIVIDIR · DESISTÊNCIA TARDIA</textPath></text>
        </svg>
        <div class="bj-sapato" title="Sapato"><div class="bj-pilha"></div><div class="bj-corte"></div><span></span></div>
        <div class="bj-descarte" title="Descarte"><div class="bj-pilha"></div></div>
        <div class="bj-rack" aria-hidden="true"></div>
        <div class="bj-cartas"></div>
        <div class="bj-rotulos"></div>
        <div class="bj-apostas"></div>
        <div class="bj-mensagem mensagem-mesa"></div>
        <div class="treinador" hidden></div>
        <div class="rodape-mesa bj-rodape">
          <div class="rack"></div>
          <div class="acoes bj-acoes"></div>
        </div>
      </div>
      <aside class="conta"></aside>
    </div>
    <button class="aba-conta">${ICONES.conta}<span>a conta</span></button>`;

  const $ = sel => raiz.querySelector(sel);
  const palco = $('.bj-palco');
  const conta = $('.conta');
  const cenaCartas = criarPalcoCartas($('.bj-cartas'), { largura: () => larguraCarta() });

  // ---------------------------------------------------------------- geometria

  function larguraCarta() {
    const w = palco.clientWidth, h = palco.clientHeight;
    return Math.round(Math.max(58, Math.min(118, w * 0.105, h * 0.15)));
  }

  function geo() {
    const w = palco.clientWidth, h = palco.clientHeight, l = larguraCarta();
    const n = Math.max(1, s.maos.length || 1);
    const espac = Math.min(w / Math.max(n, 1.4), l * 2.5);
    return {
      w, h, l,
      sapato: { x: w - l * 1.75, y: h * 0.03 },
      descarte: { x: l * 0.55, y: h * 0.03 },
      banca: i => ({ x: w / 2 - l * 1.05 + i * l * 0.58, y: h * 0.07, rot: 0, z: 10 + i }),
      centroMao: j => w / 2 + (j - (n - 1) / 2) * espac,
      mao: (j, i) => ({ x: w / 2 + (j - (n - 1) / 2) * espac - l / 2 + i * l * 0.28, y: h * (w < 600 ? 0.43 : 0.47) - i * l * 0.2, rot: 0, z: 10 + i }),
      aposta: j => ({ x: w / 2 + (j - (n - 1) / 2) * espac, y: h * (w < 600 ? 0.7 : 0.81) }),
    };
  }

  // ---------------------------------------------------------------- desenho do estado

  function pintarAposta() {
    const g = geo();
    const camada = $('.bj-apostas');
    const maos = ui.mostrarMaos ? s.maos : [];
    let html = '';
    const d = Math.round(g.l * 0.5);
    if (!maos.length) {
      const p = g.aposta(0);
      html += `<button class="bj-circulo" style="left:${p.x}px;top:${p.y}px;--d:${Math.round(g.l * 0.95)}px" title="Clique para pôr a ficha escolhida; botão direito tira"><span>aposta</span></button>`;
      if (apostaMontada > 0) html += `<div class="pilha" style="left:${p.x}px;top:${p.y}px;--d:${d}px">${htmlPilha(apostaMontada)}</div>`;
    } else {
      maos.forEach((m, j) => {
        const p = g.aposta(j);
        html += `<div class="bj-circulo cheio${j === s.maoAtual && s.estado === 'jogando' ? ' ativa' : ''}" style="left:${p.x}px;top:${p.y}px;--d:${Math.round(g.l * 0.95)}px"></div>`;
        html += `<div class="pilha" data-mao="${j}" style="left:${p.x}px;top:${p.y}px;--d:${d}px">${htmlPilha(m.aposta)}</div>`;
      });
    }
    camada.innerHTML = html;
    const c = camada.querySelector('button.bj-circulo');
    if (c) {
      c.onclick = () => mexerAposta(+1);
      c.oncontextmenu = e => { e.preventDefault(); mexerAposta(-1); };
    }
  }

  // Os rótulos saem do que está na mesa, não do estado da sessão: a sessão já
  // sabe o fim da rodada antes de a primeira carta chegar.
  function pintarRotulos() {
    const g = geo();
    const v = ui.vis;
    let html = '';
    if (v.banca.length) {
      const visiveis = v.bancaOculta ? v.banca.slice(0, 1) : v.banca;
      const p = g.banca(0);
      html += `<div class="bj-total banca" style="left:${p.x - 14}px;top:${p.y + g.l * 1.4 + 8}px">${textoTotal(visiveis)}${v.bancaOculta ? ' + ?' : ''}</div>`;
    }
    v.maos.forEach((cs, j) => {
      if (!cs.length) return;
      const m = s.maos[j];
      const p = g.mao(j, 0);
      const ativa = !v.resultados && j === v.ativa;
      html += `<div class="bj-total${ativa ? ' ativa' : ''}" style="left:${p.x - 16}px;top:${p.y + g.l * 1.4 + 8}px">${textoTotal(cs, m?.dividida)}</div>`;
      const r = v.resultados && m?.resultado ? RESULTADO[m.resultado] : null;
      if (r) html += `<div class="bj-resultado ${r[1]}" style="left:${g.centroMao(j)}px;top:${g.h * 0.47 - g.l * 0.35}px">${r[0]}${m.pago > m.aposta ? ` <b>+${fichas(m.pago - m.aposta)}</b>` : ''}</div>`;
    });
    $('.bj-rotulos').innerHTML = html;
  }

  function pintarSapato() {
    const sp = s.sapato;
    const frac = sp.restantes / sp.total;
    $('.bj-sapato .bj-pilha').style.setProperty('--f', frac.toFixed(3));
    $('.bj-sapato span').textContent = `${sp.restantes} cartas`;
    $('.bj-sapato .bj-corte').style.setProperty('--c', ((sp.total - REGRAS.corte) / sp.total).toFixed(3));
    $('.bj-descarte .bj-pilha').style.setProperty('--f', Math.min(1, (sp.total - sp.restantes) / sp.total).toFixed(3));
  }

  function posicionarTudo() {
    const g = geo();
    cenaCartas.limpar();
    ui.banca = []; ui.maos = [];
    ui.vis = {
      banca: s.banca.cartas.slice(), bancaOculta: s.banca.oculta,
      maos: s.maos.map(m => m.cartas.slice()), ativa: s.maoAtual, resultados: s.estado === 'fim',
    };
    s.banca.cartas.forEach((c, i) => {
      const oculta = i === 1 && s.banca.oculta;
      vida.seguir(cenaCartas.dar(c, { para: g.banca(i), oculta, instantaneo: true })).then(el => { ui.banca[i] = el; });
    });
    s.maos.forEach((m, j) => {
      ui.maos[j] = [];
      m.cartas.forEach((c, i) => {
        const deitada = m.dobrada && i === 2;
        vida.seguir(cenaCartas.dar(c, { para: g.mao(j, i), deitada, instantaneo: true })).then(el => { ui.maos[j][i] = el; });
      });
    });
    ui.mostrarMaos = s.estado === 'jogando' || s.estado === 'seguro';
    pintarAposta(); pintarRotulos(); pintarSapato();
  }

  function pintarRack() {
    const saldo = casa.carteira.saldo;
    $('.rack').innerHTML = DENOMINACOES.map(d => `<button class="ficha${d.valor === ficha ? ' escolhida' : ''}" data-v="${d.valor}" ${d.valor > saldo ? 'disabled' : ''}>${svgFicha(d.valor)}</button>`).join('');
  }
  $('.rack').addEventListener('click', e => {
    const b = e.target.closest('.ficha');
    if (!b || b.disabled) return;
    ficha = Number(b.dataset.v);
    casa.mesa('blackjack').ficha = ficha;
    som.ficha(1, 0.6);
    pintarRack();
    if (s.estado === 'aposta' || s.estado === 'fim') mexerAposta(+1);
  });

  // ---------------------------------------------------------------- botões

  function pintarAcoes() {
    const el = $('.bj-acoes');
    const trein = $('.treinador');
    if (ocupado) { el.querySelectorAll('button').forEach(b => { b.disabled = true; }); return; }
    if (s.estado === 'aposta' || s.estado === 'fim') {
      const pode = apostaMontada >= REGRAS.minimo && casa.carteira.pode(apostaMontada);
      el.innerHTML = `
        <button class="icone" data-a="limpar" title="Tirar a aposta">${ICONES.limpar}</button>
        <button class="icone" data-a="dobrarAposta" title="Dobrar a aposta">${ICONES.dobrar}</button>
        <div class="na-mesa"><span>aposta</span><b>${fichas(apostaMontada)}</b><span class="pe">perda esperada ${apostaMontada ? '−' + fichasFrac(apostaMontada * VANTAGEM_BLACKJACK.vantagem, 3) : '0'}</span></div>
        <button class="btn grande" data-a="dar" ${pode ? '' : 'disabled'}>Dar cartas</button>`;
      trein.hidden = true;
      return;
    }
    if (s.estado === 'seguro') {
      const v = s.aposta / 2;
      el.innerHTML = `<div class="bj-pergunta">A banca mostra um ás. Seguro custa <b>${fichas(v)}</b> e paga 2 para 1 se ela tiver blackjack. Vantagem da casa no seguro: <b class="casa">${pct(VANTAGEM_SEGURO)}</b>.</div>
        <button class="btn escuro" data-a="seguroSim" ${casa.carteira.pode(v) ? '' : 'disabled'}>Fazer seguro</button>
        <button class="btn" data-a="seguroNao">Recusar</button>`;
      mostrarTreinador();
      return;
    }
    const permitidas = s.acoes();
    el.innerHTML = ['pedir', 'parar', 'dobrar', 'dividir', 'desistir'].map(a =>
      `<button class="btn ${a === 'pedir' || a === 'parar' ? '' : 'escuro'} bj-acao" data-a="${a}" ${permitidas.includes(a) ? '' : 'disabled'}>${NOMES_ACAO[a]}<small>${TECLAS[a]}</small></button>`).join('');
    mostrarTreinador();
  }

  function mostrarTreinador() {
    const trein = $('.treinador');
    if (!casa.prefs.treinador) { trein.hidden = true; return; }
    const c = s.conselho();
    if (!c) { trein.hidden = true; return; }
    trein.hidden = false;
    if (s.estado === 'seguro') {
      trein.innerHTML = `<span>Treinador</span><b>Recuse o seguro</b><em>ele devolve ${pct(1 - VANTAGEM_SEGURO, 1)} do que custa, em média</em>`;
      return;
    }
    const evs = Object.entries(c.evs).sort((a, b) => b[1] - a[1]);
    trein.innerHTML = `<span>A básica diz</span><b>${NOMES_ACAO[c.acao]}</b><em>${evs.map(([a, v]) => `${NOMES_ACAO[a]} ${v >= 0 ? '+' : '−'}${numero(Math.abs(v), 3)}`).join(' · ')}</em>`;
    pintarQuadro();
  }

  function mexerAposta(sinal) {
    if (ocupado || !(s.estado === 'aposta' || s.estado === 'fim')) return;
    if (s.estado === 'fim') { ocupado = true; varrer().then(() => { ocupado = false; mexerAposta(sinal); }); return; }
    const novo = Math.max(0, apostaMontada + sinal * ficha);
    if (novo > REGRAS.maximo) { avisar(`O limite da mesa é ${fichas(REGRAS.maximo)} fichas.`, { erro: true }); return; }
    if (sinal > 0 && !casa.carteira.pode(novo)) { som.negado(); avisar('Saldo insuficiente para essa aposta.', { erro: true }); if (casa.carteira.saldo < REGRAS.minimo) app.oferecerCredito(REGRAS.minimo); return; }
    if (sinal > 0) {
      const g = geo();
      voarFichas({ de: $(`.rack .ficha[data-v="${ficha}"]`), para: { x: palco.getBoundingClientRect().left + g.aposta(0).x, y: palco.getBoundingClientRect().top + g.aposta(0).y }, valor: ficha, duracao: 340, tamanho: 34, somFinal: false });
    }
    apostaMontada = novo;
    som.ficha(1);
    pintarAposta(); pintarAcoes(); pintarConta();
  }

  function novaRodadaSilenciosa() {
    if (s.estado === 'fim') s.novaRodada();
    cenaCartas.limpar();
    ui.maos = []; ui.banca = [];
    ui.vis = { banca: [], bancaOculta: false, maos: [], ativa: 0, resultados: false };
    ui.mostrarMaos = false;
    pintarRotulos();
  }

  // Antes de dar cartas novas, as da rodada anterior vão para o descarte.
  async function varrer() {
    if (s.estado !== 'fim') return;
    if (cenaCartas.cartas.size) await vida.seguir(cenaCartas.recolher(geo().descarte, { atraso: 22 }));
    novaRodadaSilenciosa();
  }

  $('.bj-acoes').addEventListener('click', e => {
    const b = e.target.closest('[data-a]');
    if (!b || b.disabled) return;
    acao(b.dataset.a);
  });

  function tecla(e) {
    if (document.querySelector('.cortina') || e.target.tagName === 'INPUT') return;
    const mapa = { 1: 'pedir', 2: 'parar', 3: 'dobrar', 4: 'dividir', 5: 'desistir' };
    if (mapa[e.key] && s.estado === 'jogando') acao(mapa[e.key]);
    else if ((e.key === 'Enter' || e.key === ' ') && (s.estado === 'aposta' || s.estado === 'fim')) { e.preventDefault(); acao('dar'); }
  }
  vida.ouvir(window, 'keydown', tecla);

  // Toda chamada à sessão congela o saldo do topo; a encenação solta no fim,
  // depois de as fichas voarem. Assim o topo nunca conta o fim antes da mesa.
  function chamar(fn) {
    congelar();
    try { return fn(); } catch (e) { soltar(); throw e; }
  }

  async function acao(a) {
    if (ocupado) return;
    try {
      if (a === 'limpar') { apostaMontada = 0; som.ficha(2, 0.5); pintarAposta(); pintarAcoes(); pintarConta(); return; }
      if (a === 'dobrarAposta') { const f = ficha; ficha = apostaMontada || f; mexerAposta(+1); ficha = f; return; }
      if (a === 'dar') {
        if (!casa.carteira.pode(apostaMontada)) { if (!app.oferecerCredito(apostaMontada)) avisar('Saldo insuficiente.', { erro: true }); return; }
        ocupado = true;
        await varrer();
        ocupado = false;
        s.definirAposta(apostaMontada);
        const r = chamar(() => s.dar());
        ui.mostrarMaos = true;
        return encenar(r.eventos);
      }
      if (a === 'seguroSim' || a === 'seguroNao') {
        const r = chamar(() => s.seguro(a === 'seguroSim'));
        if (a === 'seguroSim') { som.ficha(2); avisar(`Seguro de ${fichas(s.aposta / 2)} na mesa.`); }
        return encenar(r.eventos);
      }
      // jogada: o treinador mede o desvio antes de agir
      const c = casa.prefs.treinador ? s.conselho() : null;
      const valorMaoAtual = s.maos[s.maoAtual]?.aposta ?? 0;
      const r = chamar(() => s.agir(a));
      if (c && a !== c.acao && c.evs[a] !== undefined && c.evs[c.acao] !== undefined) {
        const custo = c.evs[c.acao] - c.evs[a];
        if (custo > 0.0005) avisar(`${NOMES_ACAO[a]} aqui custou ${numero(custo, 3)} ficha por ficha apostada (${fichasFrac(custo * valorMaoAtual, 2)} nesta mão). A básica manda ${NOMES_ACAO[c.acao].toLowerCase()}.`, { ms: 5200 });
      }
      return encenar(r.eventos, a);
    } catch (err) { som.negado(); avisar(err.message, { erro: true }); }
  }

  // ---------------------------------------------------------------- encenação

  const espera = ms => vida.espera(ms);

  async function encenar(eventos, acaoFeita = null) {
    ocupado = true;
    pintarAcoes();
    const rect = () => palco.getBoundingClientRect();
    const pontoTela = p => ({ x: rect().left + p.x, y: rect().top + p.y });
    const v = ui.vis;
    try {
      if (acaoFeita === 'dobrar') {
        const g = geo();
        await vida.seguir(voarFichas({ de: $('.rack'), para: pontoTela(g.aposta(v.ativa)), valor: s.maos[v.ativa].aposta / 2, duracao: 380, tamanho: 34 }));
        pintarAposta();
      }
      for (const e of eventos) {
        const g = geo();
        if (e.tipo === 'embaralhar') {
          await vida.seguir(cenaCartas.recolher(g.descarte));
          $('.bj-sapato').classList.add('embaralhando');
          som.embaralhar();
          mensagem('Sapato novo: seis baralhos embaralhados pelo gerador verificável.');
          await espera(1100);
          $('.bj-sapato').classList.remove('embaralhando');
          pintarSapato();
        } else if (e.tipo === 'carta') {
          if (e.alvo === 'banca') {
            const i = v.banca.length;
            v.banca.push(e.carta);
            if (e.oculta) v.bancaOculta = true;
            ui.banca[i] = await vida.seguir(cenaCartas.dar(e.carta, { de: g.sapato, para: g.banca(i), oculta: e.oculta }));
          } else {
            const j = e.mao;
            ui.maos[j] ??= [];
            v.maos[j] ??= [];
            if (!v.maos.some(x => x.length)) pintarAposta();
            const i = v.maos[j].length;
            v.maos[j].push(e.carta);
            v.ativa = j;
            ui.maos[j][i] = await vida.seguir(cenaCartas.dar(e.carta, { de: g.sapato, para: g.mao(j, i), deitada: e.deitada }));
          }
          pintarRotulos();
        } else if (e.tipo === 'dividir') {
          const segunda = ui.maos[e.mao].pop();
          ui.maos.splice(e.nova, 0, [segunda]);
          const cs = v.maos[e.mao].pop();
          v.maos.splice(e.nova, 0, [cs]);
          await relayout();
          const gA = geo();
          await vida.seguir(voarFichas({ de: $('.rack'), para: pontoTela(gA.aposta(e.nova)), valor: s.maos[e.nova].aposta, duracao: 420, tamanho: 34 }));
          pintarAposta();
          mensagem('Mão dividida.');
        } else if (e.tipo === 'seguro') {
          if (e.pago > 0) { mensagem(`A banca tinha blackjack: o seguro pagou ${fichas(e.pago)}.`); som.vitoria(1); }
          else if (e.pago === 0) mensagem('A banca não tinha blackjack: o seguro foi para a casa.');
        } else if (e.tipo === 'revelar') {
          const el = ui.banca[e.indice];
          aproximar($('.bj-cartas'), { x: rect().left + g.banca(1).x + g.l / 2, y: rect().top + g.banca(1).y + g.l * 0.7 }, { escala: 1.1, duracao: 1100 });
          await espera(250);
          if (el) await vida.seguir(cenaCartas.revelar(el, e.carta));
          v.bancaOculta = false;
          pintarRotulos();
        } else if (e.tipo === 'fim') {
          v.resultados = true;
          await pagar(e.rodada);
        }
      }
      // a mão ativa da sessão é a que o jogador decide agora
      if (!v.resultados) v.ativa = s.maoAtual;
    } finally {
      ocupado = false;
      soltar();
      pintarRotulos(); pintarAposta(); pintarAcoes(); pintarSapato(); pintarRack();
      pintarConta();
    }
  }

  async function relayout() {
    const g = geo();
    const movs = [];
    ui.maos.forEach((cs, j) => cs.forEach((el, i) => { if (el) movs.push(cenaCartas.mover(el, g.mao(j, i), 300)); }));
    await vida.seguir(Promise.all(movs));
    pintarRotulos();
  }

  async function pagar(rodada) {
    pintarRotulos();
    pintarAposta();
    const g = geo();
    const rect = palco.getBoundingClientRect();
    const tela = p => ({ x: rect.left + p.x, y: rect.top + p.y });
    const rack = $('.bj-rack');
    const voos = [];
    s.maos.forEach((m, j) => {
      const pilha = raiz.querySelector(`.pilha[data-mao="${j}"]`);
      if (m.pago === 0) {
        if (pilha) { pilha.classList.add('desmorona'); voos.push(voarFichas({ de: pilha, para: rack, valor: m.aposta, duracao: 520, tamanho: 30, maximo: 4, somFinal: false })); }
      } else if (m.pago > m.aposta) {
        voos.push(vida.seguir(voarFichas({ de: rack, para: tela(g.aposta(j)), valor: m.pago - m.aposta, duracao: 520, tamanho: 32, maximo: 5 })).then(() => { if (pilha) pilha.innerHTML = htmlPilha(m.pago); }));
      } else if (m.pago < m.aposta && pilha) {
        pilha.innerHTML = htmlPilha(m.pago);
      }
    });
    await vida.seguir(Promise.all(voos));
    const liquido = rodada.retorno - rodada.apostado;
    const bj = s.maos.some(m => m.resultado === 'blackjack');
    if (liquido > 0) {
      som.vitoria(bj ? 3 : liquido >= rodada.apostado ? 2 : 1);
      if (bj) { faiscas({ x: rect.left + g.centroMao(0), y: rect.top + g.h * 0.45 }, 70); respirar(palco, 2); }
    } else if (liquido < 0) som.derrota();
    mensagem(rodada.rotulo);
    await espera(650);
    const restantes = [...raiz.querySelectorAll('.bj-apostas .pilha')].filter(p => !p.classList.contains('desmorona'));
    await vida.seguir(Promise.all(restantes.map((p, i) => voarFichas({ de: p, para: app.elementoSaldo(), valor: s.maos[Number(p.dataset.mao)]?.pago ?? 0, atraso: i * 80, duracao: 600, tamanho: 30, maximo: 4 }))));
    for (const p of raiz.querySelectorAll('.bj-apostas .pilha')) p.remove();
    if (casa.carteira.saldo < REGRAS.minimo) vida.depois(400, () => app.oferecerCredito(REGRAS.minimo));
    const cabe = Math.floor(casa.carteira.saldo / 100) * 100;
    apostaMontada = cabe >= REGRAS.minimo ? Math.min(s.aposta, cabe) : 0;
    ui.mostrarMaos = false;
  }

  function mensagem(t) {
    const m = $('.bj-mensagem');
    m.textContent = t;
    m.classList.remove('mostra'); void m.offsetWidth; m.classList.add('mostra');
  }

  // ---------------------------------------------------------------- conta

  function pintarQuadro() {
    const alvo = conta.querySelector('.quadro-bj');
    if (!alvo) return;
    const h = s.maos[s.maoAtual];
    let marca = null;
    if (s.estado === 'jogando' && h && !h.terminada && s.banca.cartas[0] !== undefined) {
      const up = s.banca.cartas[0];
      const col = colunaBanca(up);
      const acoes = s.acoes();
      const par = h.cartas.length === 2 && valorCarta(h.cartas[0]) === valorCarta(h.cartas[1]) && acoes.includes('dividir');
      const t = valorMao(h.cartas, h.dividida);
      marca = par ? ['pares', valorCarta(h.cartas[0]), col] : t.macio ? ['macio', t.total, col] : ['duro', Math.max(4, Math.min(21, t.total)), col];
    }
    for (const td of alvo.querySelectorAll('td.marcada')) td.classList.remove('marcada');
    if (marca) alvo.querySelector(`td[data-t="${marca[0]}"][data-l="${marca[1]}"][data-c="${marca[2]}"]`)?.classList.add('marcada');
  }

  function tabelaQuadro(nome, dados, rotulo) {
    const linhas = Object.keys(dados).map(Number).sort((a, b) => nome === 'pares' ? b - a : a - b);
    return `<table class="quadro"><thead><tr><th>${rotulo}</th>${COLUNAS.map(c => `<th>${c}</th>`).join('')}</tr></thead><tbody>${linhas.map(l => {
      const nomeLinha = nome === 'pares' ? (l === 11 ? 'A,A' : `${l},${l}`) : nome === 'macio' ? `A,${l - 11}` : String(l);
      return `<tr><th>${nomeLinha}</th>${dados[l].map((c, i) => `<td class="q-${c}" data-t="${nome}" data-l="${l}" data-c="${i}">${c}</td>`).join('')}</tr>`;
    }).join('')}</tbody></table>`;
  }

  function pintarConta() {
    const v = VANTAGEM_BLACKJACK;
    const r = casa.livro.resumo('blackjack');
    const sp = s.sapato;
    conta.innerHTML = `
      <div class="bloco">
        <h4>A conta desta mesa</h4>
        <div class="grande-numero">${pct(v.vantagem)}</div>
        <p class="explica">de vantagem da casa jogando a estratégia básica, medida em ${numero(v.maos / 1e6, 0)} milhões de mãos simuladas com estas regras (erro-padrão de ${pct(v.erroPadrao, 4)}). Fora da básica, ela sobe: o treinador mostra quanto.</p>
        <table>
          <tr><td>Aposta em jogo</td><td>${fichas(s.estado === 'jogando' || s.estado === 'seguro' ? s.maos.reduce((q, m) => q + m.aposta, 0) : apostaMontada)}</td></tr>
          <tr><td>Perda esperada da mão</td><td class="casa">−${fichasFrac((s.estado === 'aposta' || s.estado === 'fim' ? apostaMontada : s.aposta) * v.vantagem, 3)}</td></tr>
          <tr><td>Seguro</td><td class="casa">${pct(VANTAGEM_SEGURO)}</td></tr>
          <tr><td>Seus desvios até agora</td><td class="casa">${r.custoErros > 0 ? '−' + fichasFrac(r.custoErros, 2) : '0'}</td></tr>
        </table>
      </div>
      <div class="bloco">
        <h4>Estratégia básica desta mesa</h4>
        <div class="quadro-bj">
          ${tabelaQuadro('duro', Object.fromEntries(Object.entries(QUADRO.duro).filter(([k]) => Number(k) >= 8 && Number(k) <= 17)), 'duro')}
          ${tabelaQuadro('macio', Object.fromEntries(Object.entries(QUADRO.macio).filter(([k]) => Number(k) >= 13 && Number(k) <= 20)), 'macio')}
          ${tabelaQuadro('pares', QUADRO.pares, 'par')}
        </div>
        <p class="explica">${QUADRO.legenda.map(([c, t]) => `<span class="q-${c} leg">${c}</span> ${t}`).join(' · ')}</p>
      </div>
      <div class="bloco">
        <h4>Regras da mesa</h4>
        <ul class="regras">${REGRAS_TEXTO.map(t => `<li>${t}</li>`).join('')}</ul>
      </div>
      <div class="bloco">
        <h4>Últimas rodadas</h4>
        <div class="historico bj-hist">${s.historico.slice(0, 12).map(h => `<span class="${h.retorno > h.apostado ? 'bom' : h.retorno < h.apostado ? 'ruim' : ''}" title="${h.rotulo}">${fichas(h.retorno - h.apostado, { sinal: true })}</span>`).join('') || '<em>nenhuma ainda</em>'}</div>
      </div>
      <div class="bloco">
        <h4>Sapato em uso</h4>
        <p class="explica">${sp.restantes} de ${sp.total} cartas no sapato; a carta de corte está na ${REGRAS.corte}ª. O hash abaixo cobre o sapato inteiro e a semente é revelada quando ele for trocado.</p>
        <div class="compromisso"><b>HASH DO SAPATO · CONTADOR ${sp.contador}</b>${sp.hash}</div>
      </div>`;
    conta.querySelector('.compromisso').onclick = () => app.abrirConferir('blackjack');
    pintarQuadro();
  }

  $('.aba-conta').addEventListener('click', () => conta.classList.toggle('aberta'));

  // ---------------------------------------------------------------- início

  vida.redimensionar(palco, () => { if (!ocupado) posicionarTudo(); });
  pintarRack();
  posicionarTudo();
  pintarAcoes();
  pintarConta();
  if (s.estado === 'fim') { apostaMontada = s.aposta; }

  return {
    sessao: s,
    get ocupado() { return ocupado; },
    acao,
  };
}
