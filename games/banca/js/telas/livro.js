// O Livro da Casa: quanto você apostou, quanto a matemática dizia que você
// perderia, quanto perdeu de fato e a distância entre as duas coisas em
// desvios-padrão. O gráfico põe o saldo real contra a linha da expectativa
// descendo, com o funil de um e dois desvios em volta.

import { abrirPainel } from '../ui.js';
import { fichas, fichasFrac, pct, numero, sigma } from '../nucleo/formato.js';
import { lerSorte } from '../nucleo/livro.js';
import { SALDO_INICIAL, JUROS_POR_RODADA } from '../nucleo/carteira.js';
import { MESA_POR_ID } from '../mesas.js';

const NOMES = { ...Object.fromEntries(Object.values(MESA_POR_ID).map(m => [m.id, m.nome])), total: 'Todas as mesas' };

function linhaTabela(id, r) {
  const sorteCls = r.sorte >= 0 ? 'bom' : 'ruim';
  return `<tr data-jogo="${id}">
    <td>${NOMES[id] ?? id}</td>
    <td>${numero(r.n)}</td>
    <td>${fichas(r.apostado)}</td>
    <td class="casa">−${fichasFrac(r.perdaEsperada)}</td>
    <td class="${r.real >= 0 ? 'bom' : 'ruim'}">${fichas(r.real, { sinal: true })}</td>
    <td class="${sorteCls}">${fichas(Math.round(r.real - r.esperado), { sinal: true })}</td>
    <td class="${sorteCls}">${sigma(r.sorte)}</td>
    <td>${pct(r.vantagemMedia, 2)}</td>
    <td>${r.custoErros > 0 ? '−' + fichasFrac(r.custoErros) : '0'}</td>
  </tr>`;
}

export function abrirLivroDaCasa(app, jogoInicial) {
  const { casa } = app;
  const livro = casa.livro;
  let jogo = jogoInicial && livro.estado.totais[jogoInicial] ? jogoInicial : 'total';

  const jogos = livro.jogos();
  const c = casa.carteira.estado;
  const painel = abrirPainel('livro', `
    <h2>Livro da Casa</h2>
    <p class="sub">Cada aposta tem uma perda esperada: o valor vezes a vantagem da casa. Somadas, elas formam a linha que desce devagar. O seu saldo real anda em volta dela, e a distância entre os dois é a sua sorte, medida em desvios-padrão.</p>
    <div class="livro-abas">${['total', ...jogos].map(j => `<button data-j="${j}">${NOMES[j] ?? j}</button>`).join('')}</div>
    <div class="livro-manchete"></div>
    <div class="livro-grafico"><canvas></canvas><div class="legenda">
      <span><i class="real"></i>seu saldo de jogo</span><span><i class="esp"></i>o que a matemática previa</span><span><i class="faixa"></i>um e dois desvios-padrão</span>
    </div></div>
    <h3>Por mesa</h3>
    <div class="rolagem"><table class="livro-tabela">
      <thead><tr><th>Mesa</th><th>Rodadas</th><th>Apostado</th><th>Perda esperada</th><th>Resultado</th><th>Sorte</th><th>Desvios</th><th>Vantagem média</th><th>Custo dos erros</th></tr></thead>
      <tbody>${jogos.map(j => linhaTabela(j, livro.resumo(j))).join('')}${linhaTabela('total', livro.resumo()).replace('<tr', '<tr class="soma"')}</tbody>
    </table></div>
    <h3>Dívida com a casa</h3>
    <div class="credito-conta">
      <div><span>Emprestado</span><b>${fichas(c.emprestado)}</b></div>
      <div><span>Juros cobrados</span><b>${fichas(c.juros)}</b></div>
      <div><span>Pago à casa</span><b>${fichas(c.pago)}</b></div>
      <div><span>Deve agora</span><b class="${c.divida ? 'ruim' : ''}">${fichas(c.divida)}</b></div>
    </div>
    <p class="nota-painel">Juro de ${numero(JUROS_POR_RODADA * 100, 2)}% por rodada, composto, arredondado para cima. O juro não entra na vantagem das mesas: é outro jeito de a casa ganhar.</p>
    <h3>Últimas rodadas</h3>
    <div class="rolagem"><table class="livro-tabela ultimas"><thead><tr><th>#</th><th>Mesa</th><th>O que houve</th><th>Apostado</th><th>Resultado</th><th>Perda esperada</th></tr></thead><tbody></tbody></table></div>
  `);

  const canvas = painel.querySelector('canvas');

  function manchete() {
    const r = livro.resumo(jogo);
    const el = painel.querySelector('.livro-manchete');
    if (!r.n) {
      el.innerHTML = `<p class="vazio">Nenhuma rodada ainda${jogo === 'total' ? '' : ' nesta mesa'}. Sente numa mesa: a primeira aposta já começa a linha.</p>`;
      return;
    }
    el.innerHTML = `
      <div><span>Apostado</span><b>${fichas(r.apostado)}</b><small>em ${numero(r.n)} rodadas</small></div>
      <div><span>A matemática previa</span><b class="casa">−${fichasFrac(r.perdaEsperada)}</b><small>vantagem média de ${pct(r.vantagemMedia)}</small></div>
      <div><span>Aconteceu</span><b class="${r.real >= 0 ? 'bom' : 'ruim'}">${fichas(r.real, { sinal: true })}</b><small>${r.real >= 0 ? 'por enquanto' : `${pct(r.vantagemReal)} do que foi apostado`}</small></div>
      <div class="sorte"><span>Sua sorte</span><b class="${r.sorte >= 0 ? 'bom' : 'ruim'}">${sigma(r.sorte)}</b><small>${lerSorte(r.sorte)}</small></div>
      ${r.custoErros > 0 ? `<div><span>Seus erros custaram</span><b class="casa">−${fichasFrac(r.custoErros)}</b><small>em valor esperado, além da vantagem</small></div>` : ''}`;
  }

  function ultimas() {
    const lista = livro.rodadas(jogo).slice(-40).reverse();
    painel.querySelector('.ultimas tbody').innerHTML = lista.map(r => `<tr>
      <td>${r.i}</td><td>${NOMES[r.jogo] ?? r.jogo}</td><td>${r.rotulo || ''}</td><td>${fichas(r.apostado)}</td>
      <td class="${r.retorno - r.apostado >= 0 ? 'bom' : 'ruim'}">${fichas(r.retorno - r.apostado, { sinal: true })}</td>
      <td class="casa">−${fichasFrac(r.perdaEsperada, 3)}</td></tr>`).join('') || '<tr><td colspan="6">Nada ainda.</td></tr>';
  }

  function desenhar() {
    const dpr = Math.min(2, devicePixelRatio || 1);
    const w = canvas.clientWidth, h = canvas.clientHeight;
    canvas.width = w * dpr; canvas.height = h * dpr;
    const g = canvas.getContext('2d');
    g.scale(dpr, dpr);
    g.clearRect(0, 0, w, h);
    const serie = livro.rodadas(jogo);
    const total = jogo === 'total';
    const pts = [{ n: 0, real: 0, esp: 0, sd: 0 }];
    for (const r of serie) pts.push({ n: total ? r.i : r.nJogo, real: total ? r.real : r.realJogo, esp: total ? r.esperado : r.esperadoJogo, sd: Math.sqrt(total ? r.var : r.varJogo) });
    if (serie.length && serie.length === livro.estado.rodadas.length && pts[1].n > 1) pts[0].n = pts[1].n - 1;
    const base = SALDO_INICIAL;
    let min = Infinity, max = -Infinity;
    for (const p of pts) {
      min = Math.min(min, p.real, p.esp - 2 * p.sd);
      max = Math.max(max, p.real, p.esp + 2 * p.sd);
    }
    if (max - min < 2000) { const m = (max + min) / 2; min = m - 1000; max = m + 1000; }
    const pad = { l: 64, r: 16, t: 14, b: 26 };
    const n0 = pts[0].n, n1 = Math.max(pts.at(-1).n, n0 + 1);
    const X = n => pad.l + (n - n0) / (n1 - n0) * (w - pad.l - pad.r);
    const Y = v => pad.t + (1 - (v - min) / (max - min)) * (h - pad.t - pad.b);
    // grade
    g.font = '11px Jost'; g.fillStyle = 'rgba(216,204,176,.6)'; g.strokeStyle = 'rgba(201,164,92,.12)'; g.lineWidth = 1;
    const passo = Math.pow(10, Math.floor(Math.log10((max - min) / 4)));
    const passoBom = [1, 2, 5, 10].map(k => k * passo).find(s => (max - min) / s <= 6);
    for (let v = Math.ceil(min / passoBom) * passoBom; v <= max; v += passoBom) {
      g.beginPath(); g.moveTo(pad.l, Y(v)); g.lineTo(w - pad.r, Y(v)); g.stroke();
      g.textAlign = 'right';
      g.fillText(fichas(Math.round(base + v)), pad.l - 8, Y(v) + 4);
    }
    g.textAlign = 'center';
    g.fillText(`rodada ${numero(n0)}`, pad.l + 30, h - 6);
    g.fillText(`rodada ${numero(n1)}`, w - pad.r - 34, h - 6);
    if (pts.length < 2) {
      g.fillStyle = 'rgba(216,204,176,.5)'; g.font = '14px Jost';
      g.fillText('A linha começa na primeira aposta.', w / 2, h / 2);
      return;
    }
    // funil de 2 e 1 desvios
    for (const [k, a] of [[2, 0.07], [1, 0.12]]) {
      g.beginPath();
      pts.forEach((p, i) => i ? g.lineTo(X(p.n), Y(p.esp + k * p.sd)) : g.moveTo(X(p.n), Y(p.esp + k * p.sd)));
      for (let i = pts.length - 1; i >= 0; i--) g.lineTo(X(pts[i].n), Y(pts[i].esp - k * pts[i].sd));
      g.closePath();
      g.fillStyle = `rgba(201,164,92,${a})`; g.fill();
    }
    // linha da expectativa
    g.setLineDash([6, 5]); g.strokeStyle = '#e8cf8f'; g.lineWidth = 1.6;
    g.beginPath(); pts.forEach((p, i) => i ? g.lineTo(X(p.n), Y(p.esp)) : g.moveTo(X(p.n), Y(p.esp))); g.stroke();
    g.setLineDash([]);
    // zero
    g.strokeStyle = 'rgba(243,234,215,.35)'; g.lineWidth = 1;
    g.beginPath(); g.moveTo(pad.l, Y(0)); g.lineTo(w - pad.r, Y(0)); g.stroke();
    // saldo real em neon
    g.shadowColor = '#ff3d6e'; g.shadowBlur = 8;
    g.strokeStyle = '#ff5c86'; g.lineWidth = 2;
    g.beginPath(); pts.forEach((p, i) => i ? g.lineTo(X(p.n), Y(p.real)) : g.moveTo(X(p.n), Y(p.real))); g.stroke();
    g.shadowBlur = 0;
    const u = pts.at(-1);
    g.fillStyle = '#ff5c86'; g.beginPath(); g.arc(X(u.n), Y(u.real), 3.5, 0, Math.PI * 2); g.fill();
    // créditos da casa como marcas
    if (total) {
      g.strokeStyle = 'rgba(255,110,130,.55)'; g.setLineDash([2, 3]);
      for (const e of livro.estado.eventos) {
        if (e.tipo !== 'credito' || e.apos < n0 || e.apos > n1) continue;
        g.beginPath(); g.moveTo(X(e.apos), pad.t); g.lineTo(X(e.apos), h - pad.b); g.stroke();
      }
      g.setLineDash([]);
    }
  }

  function selecionar(j) {
    jogo = j;
    for (const b of painel.querySelectorAll('.livro-abas button')) b.classList.toggle('ativa', b.dataset.j === j);
    for (const tr of painel.querySelectorAll('.livro-tabela:not(.ultimas) tbody tr')) tr.classList.toggle('ativa', tr.dataset.jogo === j);
    manchete();
    ultimas();
    requestAnimationFrame(desenhar);
  }

  painel.querySelector('.livro-abas').addEventListener('click', e => {
    const b = e.target.closest('button');
    if (b) selecionar(b.dataset.j);
  });
  painel.querySelector('.livro-tabela tbody').addEventListener('click', e => {
    const tr = e.target.closest('tr');
    if (tr?.dataset.jogo) selecionar(tr.dataset.jogo);
  });
  const ro = new ResizeObserver(() => desenhar());
  ro.observe(canvas);
  selecionar(jogo);
  return painel;
}
