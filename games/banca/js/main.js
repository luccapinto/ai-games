// Abertura da BANCA: casa, texturas, sprites de cartas e fichas, a barra do
// topo, o salão e o roteador das mesas (#/roleta, #/blackjack, ...).

import { criarCasa, armazemNavegador } from './nucleo/casa.js';
import { fichas } from './nucleo/formato.js';
import { instalarTexturasCss } from './visual/texturas.js';
import { instalarCartas } from './visual/cartas.js';
import { instalarFichas } from './visual/fichas.js';
import * as som from './som.js';
import { ICONES, avisar, abrirPainel, fecharPainel, esconderDica } from './ui.js';
import { criarSalao } from './salao/salao.js';
import { MESAS, MESA_POR_ID } from './mesas.js';

const casa = criarCasa({ armazem: armazemNavegador() });
som.configurar(casa.prefs);

instalarTexturasCss();
instalarCartas();
instalarFichas();

const $ = id => document.getElementById(id);
const elSalao = $('salao'), elMesa = $('mesa'), elPlaca = $('placa');

// ------------------------------------------------------------------ barra

$('b-livro').innerHTML = ICONES.livro;
$('b-conferir').innerHTML = ICONES.selo;
$('b-menu').innerHTML = ICONES.menu;
$('voltar').innerHTML = ICONES.voltar + '<span>Salão</span>';

function pintarSom() {
  $('b-som').innerHTML = casa.prefs.som ? ICONES.somLigado : ICONES.somDesligado;
  $('b-som').classList.toggle('desligado', !casa.prefs.som);
}
pintarSom();

let saldoMostrado = null;
let congelado = 0;
function atualizarSaldo({ forcar = false } = {}) {
  if (congelado > 0 && !forcar) return;
  const v = casa.carteira.saldo;
  const el = $('saldo-valor');
  if (saldoMostrado !== null && v !== saldoMostrado) {
    const caixa = $('saldo');
    caixa.classList.remove('subiu', 'desceu');
    void caixa.offsetWidth;
    caixa.classList.add(v > saldoMostrado ? 'subiu' : 'desceu');
    contar(el, saldoMostrado, v);
  } else el.textContent = fichas(v);
  saldoMostrado = v;
  const d = casa.carteira.divida;
  $('divida').classList.toggle('ativa', d > 0);
  $('divida').textContent = d > 0 ? `deve ${fichas(d)}` : '';
}

// Conta de um valor ao outro. Uma contagem nova cancela a anterior; se as
// duas pontas são fichas inteiras, os números do meio também são.
let contagemAtual = 0;
function contar(el, de, para) {
  const minha = ++contagemAtual;
  const inteiro = de % 100 === 0 && para % 100 === 0;
  const ini = performance.now(), dur = Math.min(900, 250 + Math.abs(para - de) / 100 * 4);
  function passo() {
    if (minha !== contagemAtual) return;
    const p = Math.min(1, (performance.now() - ini) / dur);
    const e = 1 - Math.pow(1 - p, 3);
    const v = de + (para - de) * e;
    el.textContent = fichas(inteiro ? Math.round(v / 100) * 100 : Math.round(v));
    if (p < 1) requestAnimationFrame(passo);
    else el.textContent = fichas(para);
  }
  requestAnimationFrame(passo);
}

casa.ouvir(tipo => { if (tipo === 'saldo' || tipo === 'zerar') atualizarSaldo(); });

// ------------------------------------------------------------------ app

let mesaAtual = null, idAtual = null;

const app = {
  casa, som,
  atualizarSaldo,
  // Enquanto as fichas voam, o saldo do topo espera a animação.
  congelarSaldo() { congelado++; },
  liberarSaldo() { congelado = Math.max(0, congelado - 1); atualizarSaldo({ forcar: true }); },
  elementoSaldo: () => $('saldo'),
  voltar: () => { location.hash = ''; },
  avisar,
  // Chamado pelas mesas quando o saldo não cobre a aposta mínima.
  oferecerCredito(minimo = 100) {
    if (casa.carteira.saldo >= minimo) return false;
    abrirCredito();
    return true;
  },
  abrirLivro: (jogo) => abrirLivro(jogo),
  abrirConferir: (jogo) => abrirConferir(jogo),
};
globalThis.__banca = app;

// ------------------------------------------------------------------ salão

const salao = criarSalao({
  canvas: elSalao,
  placa: elPlaca,
  alturaTopo: () => $('barra').offsetHeight,
  alturaBase: () => $('diretorio').offsetHeight,
  aoEscolher: (id, ponto) => {
    $('cortina-mesa').style.setProperty('--x', ponto.x + 'px');
    $('cortina-mesa').style.setProperty('--y', ponto.y + 'px');
    if (id === 'caixa') { abrirLivro(); return; }
    location.hash = '#/' + id;
  },
  aoFocar: id => {
    for (const b of $('diretorio').querySelectorAll('button')) b.classList.toggle('foco', b.dataset.id === id);
  },
  numeros: placaDe,
});
app.salao = salao;

async function placaDe(id) {
  const m = MESA_POR_ID[id];
  let linhas = [];
  if (m.modulo) {
    try {
      const mod = await import(m.modulo);
      linhas = mod.placa?.() ?? [];
    } catch { linhas = [{ rotulo: 'mesa', valor: 'em montagem' }]; }
  } else {
    const r = casa.livro.resumo();
    linhas = [{ rotulo: 'rodadas', valor: String(r.n) }, { rotulo: 'sua sorte', valor: (r.sorte >= 0 ? '+' : '') + r.sorte.toFixed(2).replace('.', ',') + ' σ' }];
  }
  const toque = matchMedia('(pointer: coarse)').matches;
  return `<div class="nome">${m.nome}</div><div class="tese">${m.tese}</div>
    <div class="numeros">${linhas.map(l => `<div>${l.rotulo}<b>${l.valor}</b></div>`).join('')}</div>
    <div class="convite">${toque ? 'toque de novo para sentar' : 'clique para sentar'}</div>`;
}

const dir = $('diretorio');
dir.innerHTML = `<div class="fila">${MESAS.map(m => `<button data-id="${m.id}">${m.nome}</button>`).join('')}</div>` +
  '<div class="rodape">Fichas de mentira, contas de verdade: nada aqui aceita ou paga dinheiro. Se apostar deixou de ser diversão, para você ou alguém perto, procure os Jogadores Anônimos.</div>';
dir.addEventListener('click', e => {
  const b = e.target.closest('button');
  if (!b) return;
  som.destravar(); som.clique();
  const id = b.dataset.id;
  if (salao.foco === id) salao.sentar(id); else salao.focar(id, true);
});

// ------------------------------------------------------------------ rotas

async function irPara(id) {
  fecharPainel();
  esconderDica();
  if (mesaAtual) { try { mesaAtual.desmontar?.(); } catch (e) { console.error(e); } mesaAtual = null; }
  elMesa.innerHTML = '';
  idAtual = id;
  if (!id) {
    elMesa.hidden = true;
    $('voltar').hidden = true;
    $('marca').hidden = false;
    $('titulo-mesa').textContent = '';
    dir.hidden = false;
    salao.ligar();
    document.title = 'BANCA';
    return;
  }
  const m = MESA_POR_ID[id];
  salao.desligar();
  dir.hidden = true;
  $('voltar').hidden = false;
  $('titulo-mesa').textContent = m.nome;
  document.title = `${m.nome} · BANCA`;
  elMesa.hidden = false;
  elMesa.classList.remove('entrando'); void elMesa.offsetWidth; elMesa.classList.add('entrando');
  try {
    const mod = await import(m.modulo);
    if (idAtual !== id) return;
    mesaAtual = mod.montar(elMesa, app);
  } catch (e) {
    console.warn(e);
    elMesa.innerHTML = `<div class="feltro"></div><div class="em-montagem"><h2>${m.nome}</h2><p>Esta mesa ainda está sendo montada.</p><button class="btn" id="volta-salao">Voltar ao salão</button></div>`;
    elMesa.querySelector('#volta-salao').onclick = app.voltar;
  }
  atualizarSaldo();
}

function rota() {
  const id = location.hash.replace(/^#\/?/, '');
  irPara(MESA_POR_ID[id] && MESA_POR_ID[id].modulo ? id : null);
}
addEventListener('hashchange', rota);

// ------------------------------------------------------------------ painéis

function abrirCredito() {
  const c = casa.carteira;
  const juros = (0.25).toFixed(2).replace('.', ',');
  const p = abrirPainel('credito', `
    <h2>Crédito da casa</h2>
    <p class="sub">A casa sempre empresta. É o que ela tem de mais generoso, e de mais caro.</p>
    <div class="credito-conta">
      <div><span>Você recebe</span><b>${fichas(casa.CREDITO)}</b></div>
      <div><span>Juros</span><b>${juros}% por rodada, compostos</b></div>
      <div><span>Em 100 rodadas, ${fichas(casa.CREDITO)} viram</span><b>${fichas(Math.round(casa.CREDITO * Math.pow(1.0025, 100)))}</b></div>
      <div><span>Dívida atual</span><b>${fichas(c.divida)}</b></div>
    </div>
    <div class="acoes-painel">
      <button class="btn vinho grande" id="aceitar-credito">Aceitar o crédito</button>
      ${c.divida > 0 && c.saldo > 0 ? `<button class="btn escuro" id="pagar-casa">Pagar ${fichas(Math.min(c.divida, c.saldo))}</button>` : ''}
      <button class="btn fantasma" id="recusar-credito">Agora não</button>
    </div>
    <p class="nota-painel">A dívida aparece no Livro da Casa. Juro não é aposta: ele não entra na vantagem das mesas.</p>`);
  p.querySelector('#aceitar-credito').onclick = () => { casa.pedirCredito(); som.ficha(5); fecharPainel(); avisar(`A casa emprestou ${fichas(casa.CREDITO)} fichas.`); };
  p.querySelector('#recusar-credito').onclick = fecharPainel;
  p.querySelector('#pagar-casa')?.addEventListener('click', () => { const v = casa.quitar(); fecharPainel(); avisar(`Você pagou ${fichas(v)} à casa.`); });
}

async function abrirLivro(jogo) {
  const { abrirLivroDaCasa } = await import('./telas/livro.js');
  abrirLivroDaCasa(app, jogo);
}

async function abrirConferir(jogo) {
  const { abrirPainelConferir } = await import('./telas/conferir.js');
  abrirPainelConferir(app, jogo ?? idAtual);
}

function abrirMenu() {
  const pr = casa.prefs;
  const p = abrirPainel('menu', `
    <h2>A casa</h2>
    <p class="sub">Preferências, a sua semente e o botão que apaga tudo.</p>
    <div class="opcoes">
      <label><input type="checkbox" data-pref="som" ${pr.som ? 'checked' : ''}> Som</label>
      <label><input type="checkbox" data-pref="ambiente" ${pr.ambiente ? 'checked' : ''}> Murmúrio do salão</label>
      <label><input type="checkbox" data-pref="treinador" ${pr.treinador ? 'checked' : ''}> Treinador no blackjack e no vídeo pôquer</label>
      <label><input type="checkbox" data-pref="destacarBoas" ${pr.destacarBoas ? 'checked' : ''}> Destacar as apostas boas no craps</label>
    </div>
    <h3>Zerar tudo</h3>
    <p class="sub">Volta a ${fichas(100000)} fichas, apaga o Livro, a dívida e as sementes. Não tem desfazer.</p>
    <button class="btn vinho" id="zerar">Zerar tudo</button>
    <h3>Sobre</h3>
    <p class="sub">A BANCA é um cassino de fichas fictícias feito para mostrar a conta que os cassinos escondem: a vantagem da casa aparece em cada aposta, o Livro registra quanto a matemática previa que você perderia e cada sorteio pode ser conferido. Nada aqui aceita ou paga dinheiro.</p>`);
  p.querySelectorAll('[data-pref]').forEach(inp => inp.addEventListener('change', () => {
    casa.prefs[inp.dataset.pref] = inp.checked;
    casa.salvar();
    som.configurar(casa.prefs);
    if (inp.dataset.pref === 'ambiente') som.ambiente(inp.checked);
    pintarSom();
    casa.avisar('prefs');
  }));
  p.querySelector('#zerar').onclick = () => {
    const b = p.querySelector('#zerar');
    if (!b.dataset.certeza) { b.dataset.certeza = '1'; b.textContent = 'Tem certeza? Clique de novo'; return; }
    casa.zerar();
    fecharPainel();
    location.hash = '';
    avisar('Tudo zerado. A casa abriu um Livro novo.');
  };
}

$('b-livro').onclick = () => { som.destravar(); abrirLivro(idAtual); };
$('b-conferir').onclick = () => { som.destravar(); abrirConferir(idAtual); };
$('b-menu').onclick = () => { som.destravar(); abrirMenu(); };
$('b-som').onclick = () => {
  som.destravar();
  casa.prefs.som = !casa.prefs.som;
  casa.salvar();
  som.configurar(casa.prefs);
  pintarSom();
};
$('saldo').onclick = () => { som.destravar(); abrirCredito(); };
$('divida').onclick = () => { som.destravar(); abrirCredito(); };
$('marca').onclick = app.voltar;
$('voltar').onclick = app.voltar;
addEventListener('pointerdown', () => som.destravar(), { once: true });
addEventListener('keydown', () => som.destravar(), { once: true });

// ------------------------------------------------------------------ início

atualizarSaldo();
// O salão escreve em canvas com as duas fontes: carrega as duas antes do
// primeiro desenho, senão o neon sai em Georgia.
const fontes = document.fonts
  ? Promise.all(['40px Limelight', '600 20px Jost', '300 20px Jost'].map(f => document.fonts.load(f))).catch(() => {})
  : Promise.resolve();
fontes.then(rota);

if ('serviceWorker' in navigator && location.protocol !== 'file:') {
  navigator.serviceWorker.register('sw.js').catch(() => {});
}
