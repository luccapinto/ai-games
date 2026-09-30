// A mesa de bacará: feltro vinho, o placar de contas do sapato, as faixas
// de aposta em arco com a vantagem impressa, e a carta revelada devagar, do
// jeito que a mesa de bacará revela.

import { criarSessaoBacara } from './sessao.js';
import { REGRAS, REGRAS_TEXTO, APOSTAS, NOME_APOSTA, PAGA_TEXTO, fichas as fichasBacara, contaDaMesa, totalMao, ENUMERACAO, placa as placaRegras } from './regras.js';
import { criarPalcoCartas } from '../../visual/cena-cartas.js';
import { DENOMINACOES, svgFicha, htmlPilha } from '../../visual/fichas.js';
import { voarFichas, respirar, faiscas, aproximar } from '../../visual/efeitos.js';
import { ICONES, avisar, mostrarDica, esconderDica, htmlConta } from '../../ui.js';
import { fichas, fichasFrac, pct, numero } from '../../nucleo/formato.js';
import * as som from '../../som.js';

export function placa() {
  return placaRegras();
}

// Faixas em arco: centro bem acima da mesa, cada aposta num anel.
const ALTO = 300;
const CX = 500, CY = -590;
const FAIXAS = {
  banca: { r1: 812, r2: 880, a0: -0.42, a1: 0.42 },
  jogador: { r1: 740, r2: 806, a0: -0.40, a1: 0.40 },
  empate: { r1: 676, r2: 734, a0: -0.30, a1: 0.30 },
};
const PARES = { parJogador: { x: 92, y: 238 }, parBanca: { x: 908, y: 238 } };
const PAGA_CURTO = { banca: '0,95 para 1', jogador: '1 para 1', empate: '8 para 1' };

function pontoArco(r, a) { return [CX + Math.sin(a) * r, CY + Math.cos(a) * r]; }
function setorArco({ r1, r2, a0, a1 }) {
  const [x0, y0] = pontoArco(r2, a0), [x1, y1] = pontoArco(r2, a1), [x2, y2] = pontoArco(r1, a1), [x3, y3] = pontoArco(r1, a0);
  return `M${x0} ${y0} A${r2} ${r2} 0 0 0 ${x1} ${y1} L${x2} ${y2} A${r1} ${r1} 0 0 1 ${x3} ${y3} Z`;
}
function arcoTexto(r, a0, a1) {
  const [x0, y0] = pontoArco(r, a0), [x1, y1] = pontoArco(r, a1);
  return `M${x0} ${y0} A${r} ${r} 0 0 0 ${x1} ${y1}`;
}
// No celular em pé, as faixas viram retângulos empilhados, grandes para o dedo.
const ESTREITO = {
  largura: 400, alto: 380,
  zonas: {
    parJogador: { x: 4, y: 4, w: 124, h: 96 },
    empate: { x: 138, y: 4, w: 124, h: 96 },
    parBanca: { x: 272, y: 4, w: 124, h: 96 },
    jogador: { x: 4, y: 110, w: 392, h: 126 },
    banca: { x: 4, y: 246, w: 392, h: 130 },
  },
};

function centroZona(id, estreito = false) {
  if (estreito) { const z = ESTREITO.zonas[id]; return [z.x + z.w / 2, z.y + z.h * 0.62]; }
  if (PARES[id]) return [PARES[id].x, PARES[id].y];
  const f = FAIXAS[id];
  return pontoArco((f.r1 + f.r2) / 2, 0);
}

function svgPanoEstreito() {
  const fx = fichasBacara();
  let s = `<svg class="bc-pano estreito" viewBox="0 0 ${ESTREITO.largura} ${ESTREITO.alto}" preserveAspectRatio="xMidYMid meet">`;
  for (const [id, z] of Object.entries(ESTREITO.zonas)) {
    const par = id.startsWith('par');
    const classe = par ? 'bc-par' : `bc-faixa ${id}`;
    const paga = par ? '11 para 1' : PAGA_CURTO[id];
    s += `<g class="bc-zona" data-id="${id}"><rect class="${classe}" x="${z.x}" y="${z.y}" width="${z.w}" height="${z.h}" rx="14"/>
      <text class="${par ? 'bc-par-t' : `bc-nome-r${z.w < 200 ? ' pequeno' : ''}`}" x="${z.x + z.w / 2}" y="${z.y + (par || z.w < 200 ? 32 : 40)}" text-anchor="middle">${par ? (id === 'parJogador' ? 'PAR JOGADOR' : 'PAR BANCA') : NOME_APOSTA[id].toUpperCase()}</text>
      <text class="bc-par-s" x="${z.x + z.w / 2}" y="${z.y + (par || z.w < 200 ? 52 : 62)}" text-anchor="middle">${paga}</text>
      <text class="bc-par-s" x="${z.x + z.w / 2}" y="${z.y + (par || z.w < 200 ? 68 : 80)}" text-anchor="middle">casa ${pct(fx[id].vantagem)}</text></g>`;
  }
  return s + '</svg>';
}

function svgPano(estreito = false) {
  if (estreito) return svgPanoEstreito();
  const fx = fichasBacara();
  let s = `<svg class="bc-pano" viewBox="0 0 1000 ${ALTO}" preserveAspectRatio="xMidYMid meet"><defs>`;
  for (const [id, f] of Object.entries(FAIXAS)) s += `<path id="bc-t-${id}" d="${arcoTexto(f.r1 + (f.r2 - f.r1) * 0.38, f.a0 + 0.02, f.a1 - 0.02)}"/>`;
  s += '</defs>';
  for (const [id, f] of Object.entries(FAIXAS)) {
    s += `<g class="bc-zona" data-id="${id}"><path class="bc-faixa ${id}" d="${setorArco(f)}"/>
      <text class="bc-nome ${id}"><textPath href="#bc-t-${id}" startOffset="50%" text-anchor="middle">${NOME_APOSTA[id].toUpperCase()} · ${PAGA_CURTO[id].toUpperCase()} · CASA ${pct(fx[id].vantagem)}</textPath></text></g>`;
  }
  for (const [id, p] of Object.entries(PARES)) {
    s += `<g class="bc-zona" data-id="${id}"><circle class="bc-par" cx="${p.x}" cy="${p.y}" r="58"/>
      <text class="bc-par-t" x="${p.x}" y="${p.y - 22}" text-anchor="middle">${id === 'parJogador' ? 'PAR DO' : 'PAR DA'}</text>
      <text class="bc-par-t" x="${p.x}" y="${p.y - 3}" text-anchor="middle">${id === 'parJogador' ? 'JOGADOR' : 'BANCA'}</text>
      <text class="bc-par-s" x="${p.x}" y="${p.y + 17}" text-anchor="middle">11 para 1</text>
      <text class="bc-par-s" x="${p.x}" y="${p.y + 32}" text-anchor="middle">casa ${pct(fx[id].vantagem)}</text></g>`;
  }
  return s + '</svg>';
}

export function montar(raiz, app) {
  const { casa } = app;
  const s = criarSessaoBacara(casa);
  let ficha = casa.mesa('bacara').ficha ?? 500;
  let ocupado = false, vivo = true, estreito = null;
  let rapido = !!casa.mesa('bacara').rapido;
  const ui = { jogador: [], banca: [] };

  raiz.innerHTML = `
    <div class="feltro vinho"></div><div class="abajur"></div>
    <div class="mesa-grade bacara">
      <div class="palco bc-palco">
        <div class="bj-sapato bc-sapato" title="Sapato"><div class="bj-pilha"></div><div class="bj-corte"></div><span></span></div>
        <div class="bj-descarte" title="Descarte"><div class="bj-pilha"></div></div>
        <div class="bj-rack bc-rack" aria-hidden="true"></div>
        <div class="bc-maos">
          <div class="bc-lado jogador"><h3>Jogador</h3><b class="bc-total" data-lado="jogador"></b></div>
          <div class="bc-lado banca"><h3>Banca</h3><b class="bc-total" data-lado="banca"></b></div>
        </div>
        <div class="bc-cartas"></div>
        <div class="bc-placar" title="O placar mostra o passado. O sapato não lembra de nada."></div>
        <div class="bc-mensagem mensagem-mesa"></div>
        <div class="bc-pano-caixa"><div class="bc-pano-escala"><div class="bc-fichas"></div></div></div>
        <div class="rodape-mesa bc-rodape">
          <div class="rack"></div>
          <div class="acoes">
            <button class="icone" data-a="limpar" title="Tirar as apostas">${ICONES.limpar}</button>
            <button class="icone" data-a="repetir" title="Repetir as apostas do coup anterior">${ICONES.repetir}</button>
            <button class="rapido bc-rapido" data-a="rapido">${rapido ? 'rápido' : 'devagar'}</button>
            <div class="na-mesa"><span>na mesa</span><b class="v-total">0</b><span class="pe">perda esperada <b class="v-pe">0</b></span></div>
            <button class="btn grande" data-a="dar">Dar cartas</button>
          </div>
        </div>
      </div>
      <aside class="conta"></aside>
    </div>
    <button class="aba-conta">${ICONES.conta}<span>a conta</span></button>`;

  const $ = sel => raiz.querySelector(sel);
  const palco = $('.bc-palco');
  const conta = $('.conta');
  const cena = criarPalcoCartas($('.bc-cartas'), { largura: () => larguraCarta() });

  function larguraCarta() {
    return Math.round(Math.max(52, Math.min(104, palco.clientWidth * 0.085, palco.clientHeight * 0.12)));
  }

  function geo() {
    const w = palco.clientWidth, h = palco.clientHeight, l = larguraCarta();
    const y = h * 0.075;
    return {
      l,
      sapato: { x: w - l * 1.6, y: h * 0.02 },
      descarte: { x: l * 0.5, y: h * 0.02 },
      // jogador à esquerda, banca à direita; a terceira carta vem deitada
      carta: (lado, i) => {
        const estreito = w < 600;
        const base = lado === 'jogador' ? w * (estreito ? 0.04 : 0.29) : w * (estreito ? 0.52 : 0.56);
        if (i < 2) return { x: base + i * l * 0.72, y, rot: 0, z: 10 + i };
        return { x: base + l * 1.62, y: y + l * 0.25, rot: 90, z: 12 };
      },
    };
  }

  // ---------------------------------------------------------------- fichas e apostas

  function pintarRack() {
    const saldo = casa.carteira.saldo;
    $('.rack').innerHTML = DENOMINACOES.map(d => `<button class="ficha${d.valor === ficha ? ' escolhida' : ''}" data-v="${d.valor}" ${d.valor > saldo ? 'disabled' : ''}>${svgFicha(d.valor)}</button>`).join('');
  }
  $('.rack').addEventListener('click', e => {
    const b = e.target.closest('.ficha');
    if (!b || b.disabled) return;
    ficha = Number(b.dataset.v);
    casa.mesa('bacara').ficha = ficha;
    som.ficha(1, 0.6);
    pintarRack();
  });

  function pintarFichas(novas = []) {
    const camada = $('.bc-fichas');
    const larg = $('.bc-pano-escala').clientWidth;
    const W = estreito ? ESTREITO.largura : 1000, Hs = estreito ? ESTREITO.alto : ALTO;
    const d = Math.max(22, Math.min(46, larg / W * (estreito ? 30 : 50)));
    camada.innerHTML = APOSTAS.filter(id => s.apostas[id] > 0).map(id => {
      const [x, y] = centroZona(id, estreito);
      return `<div class="pilha${novas.includes(id) ? ' cai' : ''}" data-id="${id}" style="left:${x / W * 100}%;top:${y / Hs * 100}%;--d:${d}px">${htmlPilha(s.apostas[id])}</div>`;
    }).join('');
    atualizarTotais();
  }

  function atualizarTotais() {
    const c = contaDaMesa(s.apostas);
    const total = APOSTAS.reduce((q, id) => q + (s.apostas[id] ?? 0), 0);
    $('.v-total').textContent = fichas(total);
    $('.v-pe').textContent = total ? '−' + fichasFrac(c.perdaEsperada, 3) : '0';
    $('[data-a="dar"]').disabled = ocupado || total === 0;
  }

  const dicaDe = id => {
    const f = fichasBacara()[id];
    const nota = {
      banca: 'A banca ganha um pouco mais do que perde por causa da regra da terceira carta, e a comissão de 5% devolve a vantagem para a casa.',
      jogador: 'A mais simples das três. No empate, a aposta volta.',
      empate: 'Paga 8 para 1 por algo que acontece 9,5% das vezes. É a pior aposta da mesa.',
      parJogador: 'As duas primeiras cartas do Jogador com o mesmo valor de índice.',
      parBanca: 'As duas primeiras cartas da Banca com o mesmo valor de índice.',
    }[id];
    return htmlConta({ ...f, nome: NOME_APOSTA[id] }, s.apostas[id] || ficha, { nota });
  };

  async function aoApostar(id, el) {
    if (ocupado) return;
    if (s.estado === 'fim') await varrer();
    try { s.apostar(id, ficha); } catch (e) { som.negado(); avisar(e.message, { erro: true }); if (casa.carteira.saldo < REGRAS.minimo) app.oferecerCredito(REGRAS.minimo); return; }
    som.ficha(1);
    voarFichas({ de: $(`.rack .ficha[data-v="${ficha}"]`), para: el, valor: ficha, duracao: 380, tamanho: 34, somFinal: false });
    pintarFichas([id]); pintarRack(); app.atualizarSaldo(); pintarConta();
  }

  const pano = $('.bc-pano-escala');
  pano.addEventListener('pointerover', e => { const z = e.target.closest('.bc-zona'); if (z && e.pointerType === 'mouse') mostrarDica(z, dicaDe(z.dataset.id)); });
  pano.addEventListener('pointerout', e => { const z = e.target.closest('.bc-zona'); if (z) esconderDica(z); });
  pano.addEventListener('click', e => { const z = e.target.closest('.bc-zona'); if (z) aoApostar(z.dataset.id, z); });
  pano.addEventListener('contextmenu', e => {
    const z = e.target.closest('.bc-zona');
    if (!z || ocupado || s.estado !== 'aposta') return;
    e.preventDefault();
    s.retirar(z.dataset.id); som.ficha(1, 0.5); pintarFichas(); pintarRack(); app.atualizarSaldo();
  });

  $('.acoes').addEventListener('click', async e => {
    const b = e.target.closest('[data-a]');
    if (!b || b.disabled || ocupado) return;
    const a = b.dataset.a;
    try {
      if (a === 'rapido') { rapido = !rapido; casa.mesa('bacara').rapido = rapido; b.textContent = rapido ? 'rápido' : 'devagar'; return; }
      if (a === 'limpar') { if (s.estado === 'fim') await varrer(); s.limpar(); som.ficha(3, 0.5); }
      if (a === 'repetir') { if (s.estado === 'fim') await varrer(); s.repetir(); som.ficha(4); }
      if (a === 'dar') return dar();
    } catch (err) { som.negado(); avisar(err.message, { erro: true }); }
    pintarFichas(APOSTAS); pintarRack(); app.atualizarSaldo(); pintarConta();
  });

  async function varrer() {
    if (s.estado !== 'fim') return;
    ocupado = true;
    if (cena.cartas.size) await cena.recolher(geo().descarte, { atraso: 30 });
    s.novaRodada();
    ui.jogador = []; ui.banca = [];
    pintarTotais(null, null);
    raiz.querySelectorAll('.bc-lado').forEach(l => l.classList.remove('venceu'));
    raiz.querySelectorAll('.bc-zona').forEach(z => z.classList.remove('venceu'));
    ocupado = false;
  }

  function pintarTotais(j, b) {
    raiz.querySelector('.bc-total[data-lado="jogador"]').textContent = j ?? '';
    raiz.querySelector('.bc-total[data-lado="banca"]').textContent = b ?? '';
  }

  // ---------------------------------------------------------------- o coup

  const espera = ms => new Promise(r => setTimeout(r, rapido ? ms * 0.45 : ms));

  async function dar() {
    if (ocupado) return;
    if (s.estado === 'fim') await varrer();
    app.congelarSaldo();
    let r;
    try { r = s.dar(); } catch (e) { app.liberarSaldo(); avisar(e.message, { erro: true }); return; }
    ocupado = true;
    atualizarTotais();
    esconderDica();
    const vis = { jogador: [], banca: [] };
    try {
      for (const e of r.eventos) {
        if (!vivo) return;
        const g = geo();
        if (e.tipo === 'embaralhar') {
          if (cena.cartas.size) await cena.recolher(g.descarte);
          $('.bc-sapato').classList.add('embaralhando');
          som.embaralhar();
          mensagem('Sapato novo: oito baralhos embaralhados pelo gerador verificável.');
          await espera(1200);
          $('.bc-sapato').classList.remove('embaralhando');
          pintarSapato();
        } else if (e.tipo === 'carta') {
          const i = vis[e.alvo].length;
          vis[e.alvo].push(e.carta);
          // as quatro primeiras chegam de costas; a terceira de cada lado também
          const el = await cena.dar(e.carta, { de: g.sapato, para: g.carta(e.alvo, i), oculta: true });
          ui[e.alvo][i] = el;
          el._carta = e.carta;
          pintarSapato();
          if (vis.jogador.length === 2 && vis.banca.length === 2 && i === 1 && e.alvo === 'banca') {
            await revelarLado('jogador', [0, 1], vis);
            await revelarLado('banca', [0, 1], vis);
          } else if (i === 2) {
            await revelarLado(e.alvo, [2], vis);
          }
        } else if (e.tipo === 'fim') {
          await pagar(r, e.rodada);
        }
      }
    } finally {
      ocupado = false;
      app.liberarSaldo();
      pintarFichas(); pintarRack(); pintarPlacar(); pintarConta(); atualizarTotais();
      if (casa.carteira.saldo < REGRAS.minimo) setTimeout(() => app.oferecerCredito(REGRAS.minimo), 400);
    }
  }

  // A saca: a carta sobe de costas, é espiada pela borda e vira.
  async function revelarLado(lado, indices, vis) {
    const g = geo();
    const rect = palco.getBoundingClientRect();
    const alvo = g.carta(lado, indices[0]);
    aproximar($('.bc-cartas'), { x: rect.left + alvo.x + g.l, y: rect.top + alvo.y + g.l * 0.7 }, { escala: 1.12, duracao: rapido ? 700 : 1400 });
    for (const i of indices) {
      const el = ui[lado][i];
      if (!el) continue;
      el.classList.add('espiando');
      await espera(indices.length > 1 ? 420 : 700);
      el.classList.remove('espiando');
      await cena.revelar(el, el._carta);
    }
    const cartasVistas = vis[lado].slice(0, Math.max(...indices) + 1);
    const t = totalMao(cartasVistas);
    raiz.querySelector(`.bc-total[data-lado="${lado}"]`).textContent = t;
    raiz.querySelector(`.bc-total[data-lado="${lado}"]`).classList.remove('pula'); void palco.offsetWidth;
    raiz.querySelector(`.bc-total[data-lado="${lado}"]`).classList.add('pula');
    if (cartasVistas.length === 2 && t >= 8) mensagem(`${lado === 'jogador' ? 'Jogador' : 'Banca'} com ${t} natural.`);
    await espera(300);
  }

  async function pagar(r, rodada) {
    const mao = s.mao;
    const quem = mao.vencedor;
    raiz.querySelector(`.bc-lado.${quem === 'empate' ? 'x' : quem}`)?.classList.add('venceu');
    raiz.querySelectorAll('.bc-zona').forEach(z => {
      const id = z.dataset.id;
      const ganhou = id === quem || (id === 'parJogador' && mao.parJogador) || (id === 'parBanca' && mao.parBanca);
      z.classList.toggle('venceu', ganhou);
    });
    mensagem(quem === 'empate' ? `Empate em ${mao.totalJogador}.` : `${quem === 'banca' ? 'Banca' : 'Jogador'} vence, ${Math.max(mao.totalJogador, mao.totalBanca)} a ${Math.min(mao.totalJogador, mao.totalBanca)}.`);
    await espera(500);
    const rack = $('.bc-rack');
    const voos = [];
    for (const e of r.eventos.filter(x => x.tipo === 'resultado')) {
      const p = raiz.querySelector(`.bc-fichas .pilha[data-id="${e.zona}"]`);
      if (!p) continue;
      if (e.pago === 0) {
        p.classList.add('desmorona');
        voos.push(voarFichas({ de: p, para: rack, valor: e.aposta, duracao: 520, tamanho: 30, maximo: 3, somFinal: false }));
      } else if (e.pago > e.aposta) {
        voos.push(voarFichas({ de: rack, para: p, valor: e.pago - e.aposta, duracao: 520, tamanho: 32, maximo: 5 }).then(() => { p.innerHTML = htmlPilha(e.pago); }));
      }
    }
    await Promise.all(voos);
    const liquido = rodada.retorno - rodada.apostado;
    if (liquido > 0) {
      const mult = rodada.retorno / rodada.apostado;
      som.vitoria(mult >= 8 ? 4 : mult >= 1.9 ? 2 : 1);
      if (mult >= 8) { faiscas($('.bc-pano-escala'), 90); respirar(palco, 3); }
    } else if (liquido < 0) som.derrota();
    await espera(700);
    const restantes = [...raiz.querySelectorAll('.bc-fichas .pilha')].filter(p => !p.classList.contains('desmorona'));
    const pagos = Object.fromEntries(r.eventos.filter(x => x.tipo === 'resultado').map(x => [x.zona, x.pago]));
    await Promise.all(restantes.map((p, i) => voarFichas({ de: p, para: app.elementoSaldo(), valor: pagos[p.dataset.id] ?? 0, atraso: i * 70, duracao: 600, tamanho: 30, maximo: 4 })));
    raiz.querySelector('.bc-fichas').innerHTML = '';
  }

  function mensagem(t) {
    const m = $('.bc-mensagem');
    m.textContent = t;
    m.classList.remove('mostra'); void m.offsetWidth; m.classList.add('mostra');
  }

  // ---------------------------------------------------------------- placar e sapato

  function pintarSapato() {
    const sp = s.sapato;
    $('.bc-sapato .bj-pilha').style.setProperty('--f', (sp.restantes / sp.total).toFixed(3));
    $('.bc-sapato span').textContent = `${sp.restantes} cartas`;
    $('.bc-sapato .bj-corte').style.setProperty('--c', ((sp.total - REGRAS.corte) / sp.total).toFixed(3));
    $('.bj-descarte .bj-pilha').style.setProperty('--f', Math.min(1, (sp.total - sp.restantes) / sp.total).toFixed(3));
  }

  // Placar de contas: seis linhas, coluna a coluna, do mais antigo ao mais novo.
  function pintarPlacar() {
    const ordem = s.estrada.slice(0, 60).reverse();
    let html = '<div class="contas">';
    for (let i = 0; i < 60; i++) {
      const e = ordem[i];
      html += e ? `<i class="${e.vencedor}${e.natural ? ' natural' : ''}" title="${e.totalJogador} a ${e.totalBanca}">${e.vencedor === 'empate' ? e.totalJogador : e.vencedor === 'banca' ? e.totalBanca : e.totalJogador}${e.parJogador ? '<u class="pj"></u>' : ''}${e.parBanca ? '<u class="pb"></u>' : ''}</i>` : '<i></i>';
    }
    html += '</div>';
    const n = s.estrada.length;
    const c = { jogador: 0, banca: 0, empate: 0 };
    for (const e of s.estrada) c[e.vencedor]++;
    html += `<div class="legenda-placar"><span class="banca">B ${c.banca}</span><span class="jogador">J ${c.jogador}</span><span class="empate">E ${c.empate}</span><em>${n ? `em ${n} coups` : 'sapato novo'}</em></div>`;
    $('.bc-placar').innerHTML = html;
  }

  // ---------------------------------------------------------------- conta

  function pintarConta() {
    const fx = fichasBacara();
    const p = ENUMERACAO.p;
    const c = contaDaMesa(s.apostas);
    const total = APOSTAS.reduce((q, id) => q + (s.apostas[id] ?? 0), 0);
    const n = s.estrada.length;
    const obs = { jogador: 0, banca: 0, empate: 0 };
    for (const e of s.estrada) obs[e.vencedor]++;
    conta.innerHTML = `
      <div class="bloco">
        <h4>A conta desta mesa</h4>
        <table>${APOSTAS.map(id => `<tr><td>${NOME_APOSTA[id]}</td><td>${PAGA_TEXTO[id]}</td><td class="casa">${pct(fx[id].vantagem)}</td></tr><tr class="barra-linha"><td colspan="3"><div class="barra-vantagem"><i style="width:${Math.min(100, fx[id].vantagem / 0.15 * 100)}%"></i></div></td></tr>`).join('')}</table>
        <p class="explica">Calculado pela enumeração exata de todos os coups de um sapato cheio de oito baralhos, com as cartas saindo sem reposição. Banca e Jogador contam o empate como devolução.</p>
      </div>
      <div class="bloco">
        <h4>Na mesa agora</h4>
        <table>
          <tr><td>Apostado</td><td>${fichas(total)}</td></tr>
          <tr><td>Perda esperada</td><td class="casa">${total ? '−' + fichasFrac(c.perdaEsperada, 3) : '0'}</td></tr>
          <tr><td>Vantagem da mesa como está</td><td class="casa">${total ? pct(c.perdaEsperada / total) : '–'}</td></tr>
        </table>
      </div>
      <div class="bloco">
        <h4>O que sai, e o que saiu</h4>
        <table>
          <tr><td></td><td>esperado</td><td>${n ? `em ${n}` : 'neste sapato'}</td></tr>
          <tr><td>Banca</td><td>${pct(p.banca)}</td><td>${n ? pct(obs.banca / n, 1) : '–'}</td></tr>
          <tr><td>Jogador</td><td>${pct(p.jogador)}</td><td>${n ? pct(obs.jogador / n, 1) : '–'}</td></tr>
          <tr><td>Empate</td><td>${pct(p.empate)}</td><td>${n ? pct(obs.empate / n, 1) : '–'}</td></tr>
        </table>
        <p class="explica">O placar existe porque os jogadores de bacará adoram procurar padrão nele. Cada coup sai do sapato, não do placar.</p>
      </div>
      <div class="bloco">
        <h4>Regras da mesa</h4>
        <ul class="regras">${REGRAS_TEXTO.map(t => `<li>${t}</li>`).join('')}</ul>
      </div>
      <div class="bloco">
        <h4>Sapato em uso</h4>
        <div class="compromisso"><b>HASH DO SAPATO · CONTADOR ${s.sapato.contador}</b>${s.sapato.hash}</div>
      </div>`;
    conta.querySelector('.compromisso').onclick = () => app.abrirConferir('bacara');
  }

  $('.aba-conta').addEventListener('click', () => conta.classList.toggle('aberta'));

  // ---------------------------------------------------------------- início

  // O pano muda de desenho quando a mesa fica estreita (celular em pé).
  // (estreito é declarado no topo de montar)
  function escolherPano() {
    const agora = palco.clientWidth < 600;
    if (agora === estreito) return;
    estreito = agora;
    const esc = $('.bc-pano-escala');
    esc.querySelector('svg')?.remove();
    esc.insertAdjacentHTML('afterbegin', svgPano(estreito));
    const [w, h] = estreito ? [ESTREITO.largura, ESTREITO.alto] : [1000, ALTO];
    esc.style.aspectRatio = `${w} / ${h}`;
    esc.style.setProperty('--razao', w / h);
  }

  function posicionar() {
    escolherPano();
    cena.limpar();
    ui.jogador = []; ui.banca = [];
    pintarTotais(null, null);
    if (s.estado === 'fim' && s.mao) {
      const g = geo();
      for (const lado of ['jogador', 'banca']) {
        s.mao[lado].forEach((c, i) => cena.dar(c, { para: g.carta(lado, i), instantaneo: true }).then(el => { ui[lado][i] = el; }));
      }
      pintarTotais(s.mao.totalJogador, s.mao.totalBanca);
    }
    pintarFichas(); pintarSapato(); pintarPlacar();
  }
  const ro = new ResizeObserver(() => { if (!ocupado) posicionar(); });
  ro.observe(palco);
  pintarRack();
  posicionar();
  pintarConta();

  const api = {
    sessao: s,
    desmontar() { vivo = false; ro.disconnect(); if (ocupado) app.liberarSaldo(); },
    get ocupado() { return ocupado; },
    dar, apostar: (id) => aoApostar(id, raiz.querySelector(`.bc-zona[data-id="${id}"]`)),
  };
  app.mesaAtual = api;
  return api;
}
